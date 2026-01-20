---
tags:
  - feature
  - app
  - pricing
  - admin
  - mobile
  - api
  - compliance
status: 🟢 Complete
type: Feature Architecture
path: apps/web/lib/services/pricing-calculator.ts
---

# 💵 Per-Visit Pricing

> [!SUCCESS] **✅ FULLY IMPLEMENTED (Jan 16, 2026)**
> All 6 phases complete and verified. This feature enables Argentine field service businesses to bill customers per-visit instead of a fixed job total.

---

## 📋 Overview

The Per-Visit Pricing feature extends CampoTech's pricing capabilities to support:

- **Maintenance contracts** (abonos de mantenimiento)
- **Pest control services** (fumigación)
- **Recurring cleaning services**
- **Pool/garden maintenance**

### Pricing Modes

| Mode | Spanish Label | Icon | Use Case |
|:---|:---|:---|:---|
| `FIXED_TOTAL` | Precio cerrado | 📦 | One price for entire job (default) |
| `PER_VISIT` | Por visita | 📅 | Each visit priced separately |
| `HYBRID` | Híbrido | 🔀 | Diagnóstico + recurring rate |

---

## 🏗️ Architecture

### Database Schema (Prisma)

```prisma
// Job Model (schema.prisma lines 352-357)
pricingMode        JobPricingMode @default(FIXED_TOTAL) @map("pricing_mode")
defaultVisitRate   Decimal?       @db.Decimal(12, 2) @map("default_visit_rate")

// JobVisit Model (schema.prisma lines 442-462)
estimatedPrice      Decimal?   @db.Decimal(12, 2)  // Dispatcher sets
actualPrice         Decimal?   @db.Decimal(12, 2)  // Technician reports
techProposedPrice   Decimal?   @db.Decimal(12, 2)  // Pending approval
priceVarianceReason String?    @map("price_variance_reason")
requiresDeposit     Boolean    @default(false)
depositAmount       Decimal?   @db.Decimal(12, 2)
depositPaidAt       DateTime?

// Enum (schema.prisma lines 3757-3763)
enum JobPricingMode {
  FIXED_TOTAL   // Default behavior
  PER_VISIT     // Each visit priced separately
  HYBRID        // First visit different, then recurring rate
  @@map("job_pricing_mode")
}
```

### Key Services

| Service | Path | Purpose |
|:---|:---|:---|
| **Pricing Calculator** | `apps/web/lib/services/pricing-calculator.ts` | Calculate totals by mode |
| **Pricing Compliance** | `apps/web/lib/services/pricing-compliance.ts` | Ley 24.240 + AFIP validation |
| **Visit Pricing API** | `apps/web/app/api/jobs/[id]/visits/[visitId]/pricing/route.ts` | Update per-visit prices |
| **Job Service** | `src/services/job.service.ts` | Job creation with pricing |

---

## 🎨 UI Implementation

### Web: NewJobModal

**Component:** `apps/web/components/jobs/NewJobModal.tsx`

```
Presupuesto Section (lines 1061-1238)
├── Modo de presupuesto header
├── 3-card selector:
│   ├── [📦 Precio cerrado] - border-emerald when selected
│   ├── [📅 Por visita]
│   └── [🔀 Híbrido]
│
├── FIXED_TOTAL fields:
│   ├── Total estimado ($)
│   └── Seña/Anticipo ($)
│
└── PER_VISIT / HYBRID fields:
    ├── Tarifa por defecto / recurrente ($)
    ├── Seña/Anticipo ($)
    └── Per-visit price in each Visit Card
```

### Mobile: CompleteJobScreen

**Component:** `apps/mobile/app/(tabs)/jobs/complete.tsx`

```typescript
// State (lines 63-66)
const [jobPricingMode, setJobPricingMode] = useState<string | null>(null);
const [visitEstimatedPrice, setVisitEstimatedPrice] = useState<number | null>(null);
const [visitActualPrice, setVisitActualPrice] = useState('');
const [priceVarianceReason, setPriceVarianceReason] = useState('');

// UI Section (lines 503-550)
{jobPricingMode !== 'FIXED_TOTAL' && (
  <View style={styles.pricingSection}>
    <Text>Precio de esta visita</Text>
    <Text>Estimado: ${visitEstimatedPrice}</Text>
    <TextInput
      value={visitActualPrice}
      onChangeText={setVisitActualPrice}
      keyboardType="decimal-pad"
    />
    {/* Variance reason input when price differs */}
  </View>
)}
```

### WatermelonDB Model

**Model:** `apps/mobile/watermelon/models/Job.ts`

```typescript
// Fields (lines 51-58)
@field('pricing_mode') pricingMode!: string | null;
@field('default_visit_rate') defaultVisitRate!: number | null;
@field('visit_estimated_price') visitEstimatedPrice!: number | null;
@field('visit_actual_price') visitActualPrice!: number | null;
@field('price_variance_reason') priceVarianceReason!: string | null;

// Computed (lines 110-120)
get isPerVisitPricing(): boolean {
  return this.pricingMode === 'PER_VISIT' || this.pricingMode === 'HYBRID';
}

get effectiveVisitPrice(): number {
  if (this.visitActualPrice !== null) return this.visitActualPrice;
  if (this.visitEstimatedPrice !== null) return this.visitEstimatedPrice;
  if (this.defaultVisitRate !== null) return this.defaultVisitRate;
  return 0;
}
```

---

## 📊 Pricing Calculation Logic

### calculateJobTotal() Function

**Path:** `apps/web/lib/services/pricing-calculator.ts` (lines 127-238)

```typescript
export function calculateJobTotal(job: JobWithPricing): PricingCalculation {
  switch (job.pricingMode) {
    case 'FIXED_TOTAL':
      // Use job.estimatedTotal directly
      return { subtotal: toNumber(estimatedTotal), ... };

    case 'PER_VISIT':
      // Sum all visit prices (actual → estimated → default)
      const visitTotal = visits.reduce((sum, v) => 
        sum + getVisitEffectivePrice(v, defaultRate, false, 'PER_VISIT')
      , 0);
      return { subtotal: visitTotal, visitBreakdown: [...], ... };

    case 'HYBRID':
      // First visit at custom rate, rest at default rate
      const hybridTotal = firstVisitPrice + 
        remainingVisits.reduce((sum, v) => 
          sum + getVisitEffectivePrice(v, defaultRate, false, 'HYBRID')
        , 0);
      return { subtotal: hybridTotal, visitBreakdown: [...], ... };
  }
}
```

### Price Priority Order

1. `visit.actualPrice` (technician-reported)
2. `visit.estimatedPrice` (dispatcher-set)
3. `job.defaultVisitRate` (fallback for PER_VISIT/HYBRID)

---

## ⚖️ Compliance (Phase 6)

### Argentine Consumer Protection (Ley 24.240)

| Rule | Implementation |
|:---|:---|
| >10% price increase requires consent | `validatePriceVariance()` returns `requiresApproval: true` |
| Variance reason required | `priceVarianceReason` field mandatory if price differs |
| Decreases always allowed | Validation passes for any reduction |

### AFIP Immutability

| Rule | Implementation |
|:---|:---|
| Invoiced jobs are read-only | `validateJobModification()` blocks with `INVOICED_JOB_MODIFICATION` |
| Pricing mode locked after first visit | `canChangePricingMode()` returns `false` if any visit completed |

### Compliance Service Functions

```typescript
// apps/web/lib/services/pricing-compliance.ts

validatePriceVariance(estimatedPrice, proposedPrice, maxVariance);
canChangePricingMode(visits);
validateJobModification(job);
validateVisitPriceUpdate(request, policy);
validateFullPricingCompliance(job, priceUpdate, policy);
```

---

## 📄 Reporting (Phase 5)

### Job Completion Report PDF

**Path:** `apps/web/lib/reports/job-completion-report.ts`

When `job.pricingMode !== 'FIXED_TOTAL'`, the report includes:

**"💵 Desglose de Precios por Visita"** section with:

| Column | Description |
|:---|:---|
| Visita | Number (HYBRID: 1 shows "Diagnóstico") |
| Fecha | Scheduled date |
| Estado | Status chip |
| Estimado | Dispatcher price |
| Real | Actual price |
| Variación | Percentage with color coding |

**Variance Styling:**
- `variance-high` (>10%): Red, requires justification
- `variance-up` (>0%): Amber
- `variance-down` (<0%): Green

---

## 🔌 API Endpoints

### Visit Pricing Update

```http
PUT /api/jobs/{id}/visits/{visitId}/pricing
Authorization: Bearer {token}

{
  "estimatedPrice": 25000,
  "actualPrice": 27500,
  "techProposedPrice": 27500,
  "priceVarianceReason": "Materiales adicionales",
  "requiresDeposit": false,
  "depositAmount": null
}
```

**Response (approval required):**
```json
{
  "success": true,
  "requiresApproval": true,
  "proposedPrice": 30000,
  "variancePercent": 20,
  "message": "El precio supera el 10% del estimado..."
}
```

### Job Creation with Per-Visit Pricing

```http
POST /api/jobs
{
  ...
  "pricingMode": "PER_VISIT",
  "defaultVisitRate": 25000,
  "visits": [
    { "date": "2026-01-20", "estimatedPrice": 25000 },
    { "date": "2026-02-20", "estimatedPrice": 25000 }
  ]
}
```

---

## 📱 Mobile Sync

### Sync Payload (Job Completion)

```typescript
// apps/mobile/app/(tabs)/jobs/complete.tsx (lines 270-283)
const syncPayload = {
  status: 'completed',
  completionNotes: notes,
  materialsUsed: materials,
  signatureUrl: signature,
  actualEnd: Date.now(),
  // Per-visit pricing (Phase 1)
  visitActualPrice: visitPricing?.actualPrice,
  priceVarianceReason: visitPricing?.priceVarianceReason,
};
```

---

## 🔗 Connections

- **Parent:** [[Multi-Trade Pricing]]
- **Related:**
  - [[New Job Page]] (UI implementation)
  - [[Job Completion Report]] (PDF pricing breakdown)
  - [[Invoices Page]] (Visit breakdown in invoices)
- **Implementation Plan:** `architecture/per-visit-pricing-implementation-plan.md`

---

## ✅ Implementation Phases

| Phase | Status | Key Deliverables |
|:---|:---:|:---|
| **Phase 1: Database** | ✅ | `JobPricingMode` enum, visit pricing fields |
| **Phase 2: API** | ✅ | `pricing-calculator.ts`, visit pricing route |
| **Phase 3: Web UI** | ✅ | NewJobModal 3-way selector |
| **Phase 4: Mobile** | ✅ | WatermelonDB model, complete screen |
| **Phase 5: Reporting** | ✅ | PDF pricing breakdown table |
| **Phase 6: Compliance** | ✅ | Ley 24.240, AFIP guardrails |

---

*Last updated: January 16, 2026*
