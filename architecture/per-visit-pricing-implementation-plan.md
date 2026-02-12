# Per-Visit Pricing Implementation Plan

> **Status:** 🏗️ In Progress  
> **Created:** January 16, 2026  
> **Updated:** January 16, 2026  
> **Priority:** High - Core business functionality gap  
> **Estimated Effort:** 3-4 days across 5 phases
>
> ### Progress
> - [x] **Phase 1: Database Schema** ✅ Completed January 16, 2026
> - [x] **Phase 2: API Enhancements** ✅ Completed January 16, 2026
> - [x] **Phase 3: Web UI** ✅ Completed January 16, 2026
> - [x] **Phase 4: Mobile App** ✅ Completed January 16, 2026
> - [x] **Phase 5: Reporting** ✅ Completed January 16, 2026
> - [x] **Phase 6: Compliance** ✅ Completed January 16, 2026

---

## 📋 Executive Summary

The current CampoTech pricing model supports only **job-level pricing** (one total for the entire job). This creates a significant discrepancy for Argentine field service businesses that commonly use **per-visit pricing** for:

- Maintenance contracts (abonos de mantenimiento)
- Pest control services (fumigación)
- Recurring cleaning services
- Pool/garden maintenance

This plan introduces a **hybrid pricing mode** that allows business owners to choose between:
1. **Precio Cerrado (Fixed Total)** - Current behavior, one price for entire job
2. **Por Visita (Per Visit)** - Each visit has its own price
3. **Híbrido (Hybrid)** - Initial visit + per-visit rates for follow-ups

---

## 🎯 Success Criteria

- [ ] ADMINs can create multi-visit jobs with per-visit pricing
- [ ] Total job price auto-calculates from visit prices
- [ ] Technicians can report actual prices per visit (within limits)
- [ ] Invoice generation respects per-visit pricing mode
- [ ] Existing jobs continue working with fixed pricing (backwards compatible)

---

## 📐 Phase 1: Database Schema Extensions

### 1.1 Add Pricing Mode to Job Model

```prisma
// In schema.prisma

enum JobPricingMode {
  FIXED_TOTAL      // One price for entire job (current behavior)
  PER_VISIT        // Each visit priced separately  
  HYBRID           // First visit different, then recurring rate
  @@map("job_pricing_mode")
}

model Job {
  // ... existing fields ...
  
  // NEW: Pricing mode determines how totals are calculated
  pricingMode        JobPricingMode  @default(FIXED_TOTAL) @map("pricing_mode")
  
  // NEW: Default per-visit rate (used when pricingMode = PER_VISIT)
  defaultVisitRate   Decimal?        @db.Decimal(12, 2) @map("default_visit_rate")
}
```

### 1.2 Add Pricing Fields to JobVisit Model

```prisma
model JobVisit {
  // ... existing fields ...
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PER-VISIT PRICING (Phase 1.X)
  // Only populated when parent Job.pricingMode != FIXED_TOTAL
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Estimated price for this specific visit (set by ADMIN)
  estimatedPrice      Decimal?   @db.Decimal(12, 2) @map("estimated_price")
  
  // Actual price (set by technician after completion, may differ from estimate)
  actualPrice         Decimal?   @db.Decimal(12, 2) @map("actual_price")
  
  // Technician's proposed price (pending approval if exceeds limits)
  techProposedPrice   Decimal?   @db.Decimal(12, 2) @map("tech_proposed_price")
  
  // Reason for price difference (required if actual != estimated)
  priceVarianceReason String?    @map("price_variance_reason")
  
  // Does this visit include a deposit requirement?
  requiresDeposit     Boolean    @default(false) @map("requires_deposit")
  depositAmount       Decimal?   @db.Decimal(12, 2) @map("deposit_amount")
  depositPaidAt       DateTime?  @map("deposit_paid_at")
}
```

### 1.3 Optional: Link JobLineItem to JobVisit

```prisma
model JobLineItem {
  // ... existing fields ...
  
  // NEW: Optional link to specific visit (for per-visit material tracking)
  jobVisitId      String?  @map("job_visit_id")
  jobVisit        JobVisit? @relation("VisitLineItems", fields: [jobVisitId], references: [id])
}

// Also add to JobVisit:
model JobVisit {
  // ... existing fields ...
  lineItems       JobLineItem[]  @relation("VisitLineItems")
}
```

### 1.4 Migration Script

```sql
-- Migration: Add per-visit pricing support

-- Step 1: Add pricing mode enum
CREATE TYPE "job_pricing_mode" AS ENUM ('FIXED_TOTAL', 'PER_VISIT', 'HYBRID');

-- Step 2: Add job-level fields
ALTER TABLE "jobs" 
  ADD COLUMN "pricing_mode" "job_pricing_mode" NOT NULL DEFAULT 'FIXED_TOTAL',
  ADD COLUMN "default_visit_rate" DECIMAL(12, 2);

-- Step 3: Add visit-level pricing fields
ALTER TABLE "job_visits"
  ADD COLUMN "estimated_price" DECIMAL(12, 2),
  ADD COLUMN "actual_price" DECIMAL(12, 2),
  ADD COLUMN "tech_proposed_price" DECIMAL(12, 2),
  ADD COLUMN "price_variance_reason" TEXT,
  ADD COLUMN "requires_deposit" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "deposit_amount" DECIMAL(12, 2),
  ADD COLUMN "deposit_paid_at" TIMESTAMP;

-- Step 4: Add JobLineItem -> JobVisit relation
ALTER TABLE "job_line_items"
  ADD COLUMN "job_visit_id" TEXT,
  ADD CONSTRAINT "job_line_items_job_visit_id_fkey" 
    FOREIGN KEY ("job_visit_id") REFERENCES "job_visits"("id") 
    ON DELETE SET NULL;

-- Step 5: Create indexes for efficient queries
CREATE INDEX "job_visits_estimated_price_idx" ON "job_visits"("estimated_price");
CREATE INDEX "job_line_items_job_visit_id_idx" ON "job_line_items"("job_visit_id");
```

---

## 🔌 Phase 2: API Enhancements

### 2.1 Job Creation API Changes

**File:** `apps/web/app/api/jobs/route.ts`

```typescript
// Extended job creation payload
interface CreateJobPayload {
  // ... existing fields ...
  
  // NEW: Pricing mode
  pricingMode?: 'FIXED_TOTAL' | 'PER_VISIT' | 'HYBRID';
  defaultVisitRate?: number;
  
  // Extended visit structure with optional pricing
  visits?: Array<{
    date: string;
    timeStart?: string;
    timeEnd?: string;
    technicianIds: string[];
    // NEW: Per-visit pricing
    estimatedPrice?: number;
    requiresDeposit?: boolean;
    depositAmount?: number;
  }>;
}
```

### 2.2 Pricing Calculation Service

**File:** `apps/web/lib/services/pricing-calculator.ts` (NEW)

```typescript
/**
 * Calculate job totals based on pricing mode
 * Respects the "Budgetary Isolation" pattern for Argentine field service
 */
export function calculateJobTotal(job: JobWithVisits): PricingCalculation {
  switch (job.pricingMode) {
    case 'FIXED_TOTAL':
      // Current behavior: use job.estimatedTotal
      return {
        subtotal: job.estimatedTotal,
        visitBreakdown: null,
        mode: 'FIXED_TOTAL'
      };
      
    case 'PER_VISIT':
      // Sum all visit prices
      const visitTotal = job.visits.reduce((sum, v) => {
        return sum + (v.actualPrice ?? v.estimatedPrice ?? 0);
      }, 0);
      return {
        subtotal: visitTotal,
        visitBreakdown: job.visits.map(v => ({
          visitNumber: v.visitNumber,
          scheduledDate: v.scheduledDate,
          price: v.actualPrice ?? v.estimatedPrice,
          status: v.status
        })),
        mode: 'PER_VISIT'
      };
      
    case 'HYBRID':
      // First visit at custom rate, rest at default rate
      const firstVisit = job.visits[0];
      const remainingVisits = job.visits.slice(1);
      const hybridTotal = 
        (firstVisit?.estimatedPrice ?? 0) +
        remainingVisits.reduce((sum, v) => {
          return sum + (v.estimatedPrice ?? job.defaultVisitRate ?? 0);
        }, 0);
      return {
        subtotal: hybridTotal,
        visitBreakdown: job.visits.map((v, i) => ({
          visitNumber: v.visitNumber,
          scheduledDate: v.scheduledDate,
          price: i === 0 ? v.estimatedPrice : (v.estimatedPrice ?? job.defaultVisitRate),
          status: v.status,
          isInitialVisit: i === 0
        })),
        mode: 'HYBRID'
      };
  }
}
```

### 2.3 Visit Pricing Update API

**File:** `apps/web/app/api/jobs/[id]/visits/[visitId]/pricing/route.ts` (NEW)

```typescript
// PUT /api/jobs/[id]/visits/[visitId]/pricing
// Updates pricing for a specific visit

export async function PUT(
  request: Request,
  { params }: { params: { id: string; visitId: string } }
) {
  const { estimatedPrice, actualPrice, techProposedPrice, priceVarianceReason } = await request.json();
  
  // Validate pricing limits if technician is updating
  if (session.user.role === 'TECHNICIAN' && techProposedPrice) {
    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: { organization: { include: { pricingSettings: true } } }
    });
    
    const settings = job?.organization?.pricingSettings;
    const visit = await prisma.jobVisit.findUnique({ where: { id: params.visitId } });
    
    if (settings?.techMaxAdjustmentPercent && visit?.estimatedPrice) {
      const maxAllowed = Number(visit.estimatedPrice) * (1 + settings.techMaxAdjustmentPercent / 100);
      if (techProposedPrice > maxAllowed) {
        // Queue for approval instead of direct update
        return { requiresApproval: true, proposedPrice: techProposedPrice };
      }
    }
  }
  
  // Update visit pricing
  const updated = await prisma.jobVisit.update({
    where: { id: params.visitId },
    data: {
      estimatedPrice,
      actualPrice,
      techProposedPrice,
      priceVarianceReason
    }
  });
  
  // Recalculate job total if in per-visit mode
  await recalculateJobTotal(params.id);
  
  return { success: true, visit: updated };
}
```

---

## 🎨 Phase 3: UI Enhancements

### 3.1 NewJobModal - Pricing Mode Selector

**Location:** `apps/web/components/jobs/NewJobModal.tsx`

Add a new section in the "Presupuesto" area:

```tsx
{/* Pricing Mode Section */}
<div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-lg border border-emerald-200">
  <div className="flex items-center gap-2 mb-3">
    <DollarSign className="h-5 w-5 text-emerald-600" />
    <span className="text-sm font-medium text-gray-900">
      Modo de presupuesto
    </span>
  </div>
  
  <div className="grid grid-cols-3 gap-2">
    {/* Fixed Total Option */}
    <button
      type="button"
      onClick={() => setPricingMode('FIXED_TOTAL')}
      className={cn(
        "p-3 rounded-lg border-2 text-left transition-all",
        pricingMode === 'FIXED_TOTAL' 
          ? "border-emerald-500 bg-emerald-50" 
          : "border-gray-200 hover:border-gray-300"
      )}
    >
      <Package className="h-5 w-5 mb-1 text-emerald-600" />
      <div className="text-sm font-medium">Precio cerrado</div>
      <div className="text-xs text-gray-500">Un total para todo el trabajo</div>
    </button>
    
    {/* Per Visit Option */}
    <button
      type="button"
      onClick={() => setPricingMode('PER_VISIT')}
      className={cn(
        "p-3 rounded-lg border-2 text-left transition-all",
        pricingMode === 'PER_VISIT' 
          ? "border-emerald-500 bg-emerald-50" 
          : "border-gray-200 hover:border-gray-300"
      )}
    >
      <Calendar className="h-5 w-5 mb-1 text-emerald-600" />
      <div className="text-sm font-medium">Por visita</div>
      <div className="text-xs text-gray-500">Cada visita tiene su precio</div>
    </button>
    
    {/* Hybrid Option */}
    <button
      type="button"
      onClick={() => setPricingMode('HYBRID')}
      className={cn(
        "p-3 rounded-lg border-2 text-left transition-all",
        pricingMode === 'HYBRID' 
          ? "border-emerald-500 bg-emerald-50" 
          : "border-gray-200 hover:border-gray-300"
      )}
    >
      <Layers className="h-5 w-5 mb-1 text-emerald-600" />
      <div className="text-sm font-medium">Híbrido</div>
      <div className="text-xs text-gray-500">Diagnóstico + visitas</div>
    </button>
  </div>
</div>
```

### 3.2 Per-Visit Pricing Inputs

When `pricingMode === 'PER_VISIT'`, show price input **per visit card**:

```tsx
{/* Visit Card with Pricing */}
<div className="border rounded-lg p-4 bg-white">
  <div className="flex justify-between items-start mb-3">
    <span className="font-medium">Visita {index + 1}</span>
    {visits.length > 1 && (
      <button onClick={() => removeVisit(visit.id)} className="text-red-500">
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
  
  {/* Existing date/time/technician fields */}
  {/* ... */}
  
  {/* NEW: Per-visit price input (shown when pricingMode !== 'FIXED_TOTAL') */}
  {pricingMode !== 'FIXED_TOTAL' && (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <label className="label text-sm mb-1 flex items-center gap-1">
        <DollarSign className="h-3 w-3" />
        Precio visita {index + 1}
        {pricingMode === 'HYBRID' && index === 0 && (
          <span className="text-xs text-amber-600 ml-1">(Diagnóstico)</span>
        )}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
        <input
          type="number"
          value={visit.estimatedPrice || ''}
          onChange={(e) => updateVisit(visit.id, 'estimatedPrice', e.target.value)}
          placeholder={pricingMode === 'HYBRID' && index > 0 
            ? `${defaultVisitRate || '0'} (tarifa recurrente)` 
            : '0.00'
          }
          className="input pl-7"
        />
      </div>
    </div>
  )}
</div>
```

### 3.3 Auto-Calculated Total Display

Add a summary section that shows the calculated total:

```tsx
{/* Total Summary */}
{pricingMode !== 'FIXED_TOTAL' && (
  <div className="bg-gray-50 p-4 rounded-lg border mt-4">
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">
        Total estimado ({visits.length} visitas)
      </span>
      <span className="text-lg font-bold text-gray-900">
        ${calculateVisitsTotal().toLocaleString('es-AR', { minimumFractionDigits: 2 })}
      </span>
    </div>
    {depositAmount && (
      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
        <span className="text-sm text-gray-600">Saldo pendiente</span>
        <span className="text-sm font-medium text-emerald-600">
          ${(calculateVisitsTotal() - parseFloat(depositAmount)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </span>
      </div>
    )}
  </div>
)}
```

---

## 📱 Phase 4: Mobile App Updates

### 4.1 Technician Visit Completion

When a technician completes a visit, show the pricing section if applicable:

**File:** `apps/mobile/components/job/VisitCompletionSheet.tsx`

```tsx
{/* Per-Visit Pricing (only for PER_VISIT or HYBRID jobs) */}
{job.pricingMode !== 'FIXED_TOTAL' && (
  <View style={styles.pricingSection}>
    <Text style={styles.sectionTitle}>Precio de esta visita</Text>
    
    <View style={styles.priceRow}>
      <Text style={styles.priceLabel}>Estimado:</Text>
      <Text style={styles.priceValue}>
        ${visit.estimatedPrice?.toLocaleString('es-AR') ?? '-'}
      </Text>
    </View>
    
    <View style={styles.priceRow}>
      <Text style={styles.priceLabel}>Precio real:</Text>
      <TextInput
        value={actualPrice}
        onChangeText={setActualPrice}
        keyboardType="decimal-pad"
        placeholder={visit.estimatedPrice?.toString() ?? '0'}
        style={styles.priceInput}
      />
    </View>
    
    {actualPrice && Number(actualPrice) !== visit.estimatedPrice && (
      <TextInput
        value={priceVarianceReason}
        onChangeText={setPriceVarianceReason}
        placeholder="¿Por qué cambió el precio?"
        multiline
        style={styles.reasonInput}
      />
    )}
  </View>
)}
```

---

## 📊 Phase 5: Reporting & Analytics

### 5.1 Job Completion Report Updates

**File:** `apps/web/lib/reports/job-completion-report.ts`

Update the PDF generation to show per-visit pricing breakdown:

```typescript
// Add pricing breakdown section for per-visit jobs
if (job.pricingMode !== 'FIXED_TOTAL' && job.visits.length > 0) {
  const pricingBreakdownHTML = `
    <div class="pricing-breakdown">
      <h3>Desglose por Visita</h3>
      <table class="visits-table">
        <thead>
          <tr>
            <th>Visita</th>
            <th>Fecha</th>
            <th>Estado</th>
            <th>Estimado</th>
            <th>Real</th>
          </tr>
        </thead>
        <tbody>
          ${job.visits.map((v, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${formatDate(v.scheduledDate)}</td>
              <td>${STATUS_LABELS[v.status]}</td>
              <td>${formatCurrency(v.estimatedPrice)}</td>
              <td>${formatCurrency(v.actualPrice ?? '-')}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="3">Total</td>
            <td>${formatCurrency(totalEstimated)}</td>
            <td>${formatCurrency(totalActual)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}
```

---

## 🔒 Phase 6: Compliance & Validation

### 6.1 Business Rules

| Rule | Implementation |
|------|----------------|
| Per-visit price cannot exceed estimate by >10% without approval | `OrganizationPricingSettings.techMaxAdjustmentPercent` |
| Deposit tracking per visit (optional) | `JobVisit.depositAmount`, `JobVisit.depositPaidAt` |
| Pricing mode cannot change after first visit completed | Validate in API before update |
| Invoice shows visit breakdown for per-visit mode | Update invoice generation template |

### 6.2 Argentina Consumer Protection (Ley 24.240)

```typescript
// Validate price variance on visit completion
async function validatePriceVariance(
  visit: JobVisit, 
  proposedPrice: number
): Promise<ValidationResult> {
  if (!visit.estimatedPrice) return { valid: true };
  
  const variance = (proposedPrice - Number(visit.estimatedPrice)) / Number(visit.estimatedPrice);
  
  // Argentine consumer law: >10% increase requires explicit consent
  if (variance > 0.1) {
    return {
      valid: false,
      requiresApproval: true,
      message: 'El precio supera el 10% del estimado. Requiere aprobación del cliente.',
      variancePercent: Math.round(variance * 100)
    };
  }
  
  return { valid: true };
}
```

---

## 📅 Implementation Timeline

| Phase | Duration | Dependencies | Owner |
|-------|----------|--------------|-------|
| Phase 1: Schema | 0.5 days | None | Backend |
| Phase 2: API | 1 day | Phase 1 | Backend |
| Phase 3: Web UI | 1 day | Phase 2 | Frontend |
| Phase 4: Mobile | 0.5 days | Phase 2 | Mobile |
| Phase 5: Reports | 0.5 days | Phase 2 | Backend |
| Phase 6: Validation | 0.5 days | All | QA |

**Total: ~4 days**

---

## ✅ Acceptance Checklist

### Functional
- [ ] Can create job with `FIXED_TOTAL` mode (existing behavior)
- [ ] Can create job with `PER_VISIT` mode with per-visit prices
- [ ] Can create job with `HYBRID` mode (diagnostic + recurring)
- [ ] Total auto-calculates from visit prices
- [ ] Technician can update actual price per visit (mobile)
- [ ] Price variance triggers approval workflow if >10%

### UI/UX
- [ ] Pricing mode selector is intuitive (3-option cards)
- [ ] Per-visit price inputs appear in visit cards
- [ ] Total summary updates in real-time
- [ ] Clear labels distinguish pricing modes

### Data Integrity
- [ ] Backward compatible with existing jobs
- [ ] Migration runs without data loss
- [ ] Pricing mode cannot change after work starts

### Compliance
- [ ] Invoice shows visit breakdown for per-visit mode
- [ ] >10% variance flagged for approval
- [ ] AFIP immutability respected for invoiced jobs

---

## 🔗 Related Documentation

- [Field Service Financials and Ledger](/knowledge/field_service_financials_and_ledger)
- [Multi-Trade Pricing Architecture](/architecture/02_App/Admin/Multi-Trade%20Pricing.md)
- [Argentina Regulatory Compliance](/knowledge/argentina_regulatory_compliance)
