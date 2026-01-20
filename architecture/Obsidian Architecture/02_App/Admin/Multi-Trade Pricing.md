---
tags:
  - page
  - app
  - admin
  - pricing
  - settings
  - per-visit
status: 🟢 Complete
type: Feature Architecture
path: apps/web/app/dashboard/settings/pricebook/page.tsx
---

# 💰 Multi-Trade Pricing System

> [!SUCCESS] **Purpose**
> Universal pricing architecture supporting all field service trades (Plumber, Electrician, Gas Fitter, etc.) with owner-configurable controls for technician adjustments, deposits, invoice generation, and **per-visit pricing modes**.

---

## 🎯 Design Philosophy

> **"Provide options, let owners customize."**
> CampoTech provides all the tools; business owners decide how to use them.
> Only restrict for legal/compliance reasons (AFIP invoicing requirements).

---

## 🔧 Supported Trades & Pricing Models

| Trade | Common Model | Unit | Example |
|:---|:---|:---|:---|
| PLOMERO | Hourly + Materials | hora | $15,000/hora + repuestos |
| ELECTRICISTA | Per Point/Task | punto | $8,000/punto de luz |
| GASISTA | Fixed by Service | servicio | $45,000 instalación |
| REFRIGERACION | Fixed by Service | servicio | $150,000 instalación split |
| ALBANIL | Per Day (Jornal) | jornal | $35,000/jornal |
| PINTOR | Per m² | m² | $4,500/m² |

---

## 📊 Pricing State Machine

```
DRAFT → QUOTED → IN_PROGRESS → PENDING_APPROVAL → FINALIZED
```

### Permission Matrix

| State | Dispatcher | Technician | After Invoice |
|:---|:---:|:---:|:---:|
| Line Items - Add | ✅ | ✅ (if allowed) | 🔒 |
| Line Items - Edit | ✅ | ✅ (within limits) | 🔒 |
| Generate Invoice | ✅ | ❌ | N/A |

---

## ⚙️ Owner Configuration

Settings at `/dashboard/settings/pricebook`:

| Setting | Description |
|:---|:---|
| `techCanModifyPricing` | Allow technicians to modify during jobs |
| `techMaxAdjustmentPercent` | Maximum % increase allowed |
| `enableDeposits` | Enable deposit (seña) tracking |
| `requireDepositToStart` | Block job start without deposit |

---

## ⚖️ Legal Considerations (Argentina)

- **AFIP:** Once CAE assigned, invoice is immutable
- **Consumer Protection:** Final price cannot exceed quote by >10% without consent

---

## 📅 Per-Visit Pricing Mode

> [!SUCCESS] **✅ COMPLETE (Jan 16, 2026)**
> All 6 phases fully implemented and verified. Supports per-visit pricing for maintenance contracts, pest control, and recurring services.

**See full documentation:** [[Per-Visit Pricing]]

### Implementation Status

| Phase | Status | Description |
|:---|:---:|:---|
| Phase 1: Database | ✅ | `JobPricingMode` enum, visit pricing fields |
| Phase 2: API | ✅ | Pricing calculator, visit pricing API |
| Phase 3: Web UI | ✅ | NewJobModal 3-way pricing selector |
| Phase 4: Mobile | ✅ | WatermelonDB + Complete screen |
| Phase 5: Reporting | ✅ | PDF pricing breakdown in job reports |
| Phase 6: Compliance | ✅ | Ley 24.240 + AFIP guardrails |

### Pricing Modes

| Mode | Spanish Label | Use Case | Total Calculation |
|:---|:---|:---|:---|
| **FIXED_TOTAL** | Precio cerrado | Installations, one-time jobs | Single `estimatedTotal` on Job |
| **PER_VISIT** | Por visita | Maintenance contracts, fumigación | Sum of `estimatedPrice` per JobVisit |
| **HYBRID** | Híbrido | Diagnóstico + recurring visits | First visit price + (n-1) × default rate |

### UI Flow (NewJobModal)

```
components/jobs/NewJobModal.tsx
  └── Presupuesto Section (Pricing Mode Selector)
       ├── 3-way toggle: [Precio cerrado | Por visita | Híbrido]
       │
       ├── When FIXED_TOTAL:
       │    ├── Total estimado input ($)
       │    └── Seña/Anticipo input ($)
       │
       └── When PER_VISIT or HYBRID:
            ├── Tarifa por defecto / recurrente ($)
            ├── Seña/Anticipo input ($)
            └── Each Visit Card shows:
                 ├── Fecha/Hora/Técnico
                 └── $ Precio esta visita (per-visit price input)
```

### Schema (Prisma)

```prisma
// Job model (lines 352-357 schema.prisma)
pricingMode        JobPricingMode  @default(FIXED_TOTAL)
defaultVisitRate   Decimal?        @db.Decimal(12, 2)

// JobVisit model (lines 442-462 schema.prisma)
estimatedPrice      Decimal?   @db.Decimal(12, 2)  // Dispatcher sets
actualPrice         Decimal?   @db.Decimal(12, 2)  // Technician reports
techProposedPrice   Decimal?   @db.Decimal(12, 2)  // Pending approval
priceVarianceReason String?    // Required if actual != estimated
requiresDeposit     Boolean    @default(false)
depositAmount       Decimal?   @db.Decimal(12, 2)
depositPaidAt       DateTime?
```

### Key Services

| Service | Path | Purpose |
|:---|:---|:---|
| `pricing-calculator.ts` | `apps/web/lib/services/` | Calculate totals by mode |
| `pricing-compliance.ts` | `apps/web/lib/services/` | Ley 24.240 validation |
| Visit Pricing API | `apps/web/app/api/jobs/[id]/visits/[visitId]/pricing/` | Update per-visit prices |

### Real-World Examples

| Business Type | Mode | Example |
|:---|:---|:---|
| HVAC Installation | FIXED_TOTAL | $150,000 total, 2 visitas |
| Abono Mantenimiento | PER_VISIT | $25,000 × 6 visitas = $150,000 |
| Gas Diagnosis + Repair | HYBRID | $15,000 diagnóstico + $45,000/visita |
| Fumigación mensual | PER_VISIT | $18,000 × 12 visitas |

### Mobile App Support

```typescript
// apps/mobile/watermelon/models/Job.ts
@field('pricing_mode') pricingMode: string | null;
@field('visit_estimated_price') visitEstimatedPrice: number | null;
@field('visit_actual_price') visitActualPrice: number | null;

get isPerVisitPricing(): boolean {
  return this.pricingMode === 'PER_VISIT' || this.pricingMode === 'HYBRID';
}
```

**Implementation Plan:** `architecture/per-visit-pricing-implementation-plan.md`

---

## 🔗 Connections

- **Parent:** [[Settings Page]]
- **Related:** [[Jobs Page]], [[Invoices Page]]

---

*Last updated: January 2026*
