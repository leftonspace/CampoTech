# CampoTech Multi-Trade Pricing Architecture
## Universal Pricing System for All Field Service Trades

---

## 1. OVERVIEW

This document defines the pricing architecture for CampoTech's multi-trade field service platform. The system supports all specialty trades (Plomero, Electricista, Gasista, etc.) with **owner-configurable** pricing controls.

### Design Philosophy
> **"Provide options, let owners customize."**  
> CampoTech provides all the tools; business owners decide how to use them.  
> Only restrict for legal/compliance reasons (AFIP invoicing requirements).

---

## 2. SUPPORTED TRADES & PRICING MODELS

### Specialty Types
```typescript
enum Specialty {
  PLOMERO           // Plumber
  ELECTRICISTA      // Electrician
  GASISTA           // Gas Fitter (matriculated)
  CALEFACCIONISTA   // Heating Technician
  REFRIGERACION     // HVAC/Refrigeration
  ALBANIL           // Mason/Builder
  PINTOR            // Painter
  CARPINTERO        // Carpenter
  TECHISTA          // Roofer
  HERRERO           // Blacksmith/Metalworker
  SOLDADOR          // Welder
  OTRO              // Other
}
```

### Pricing Models by Trade

| Trade | Common Model | Unit | Example |
|-------|--------------|------|---------|
| PLOMERO | Hourly + Materials | hora | $15,000/hora + repuestos |
| ELECTRICISTA | Per Point/Task | punto | $8,000/punto de luz |
| GASISTA | Fixed by Service | servicio | $45,000 instalación |
| CALEFACCIONISTA | Fixed by Service | servicio | $50,000 instalación |
| REFRIGERACION | Fixed by Service | servicio | $150,000 instalación split |
| ALBANIL | Per Day (Jornal) | jornal | $35,000/jornal |
| PINTOR | Per m² | m² | $4,500/m² |
| CARPINTERO | Hourly or Fixed | hora/servicio | Variable |
| TECHISTA | Per m² | m² | $12,000/m² |
| HERRERO | Fixed Quote | presupuesto | Quote-based |
| SOLDADOR | Hourly | hora | $18,000/hora |

---

## 3. DATABASE SCHEMA

> **Phase 0 Audit (2026-01-15):** Schema updated to reflect existing models.

### ✅ Existing Models (Enhance These)

#### PriceItem - Already Exists!

**Location:** `schema.prisma` line 1975  
**Table:** `price_items`  
**Status:** Functional, needs enhancement for multi-trade

```prisma
// EXISTING - No changes needed to structure
model PriceItem {
  id             String        @id @default(cuid())
  organizationId String
  name           String
  description    String?
  type           PriceItemType  // SERVICE | PRODUCT
  price          Decimal       @db.Decimal(12, 2)
  unit           String?       // hora, m², unidad
  taxRate        Decimal       @default(21.0) @db.Decimal(5, 2)
  isActive       Boolean       @default(true)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  organization   Organization  @relation(fields: [organizationId], references: [id])
  
  // ADD THESE FIELDS:
  specialty      String?       // PLOMERO, ELECTRICISTA, etc.
  pricingModel   PricingModel? // FIXED, HOURLY, PER_M2, etc.
  
  @@index([organizationId])
  @@map("price_items")
}

// NEW ENUM - Add to schema
enum PricingModel {
  FIXED       // Precio cerrado - one fixed price
  HOURLY      // Por hora
  PER_UNIT    // Por unidad (punto, toma, etc)
  PER_M2      // Por metro cuadrado
  PER_DAY     // Por jornal (day rate)
  QUOTE       // Presupuesto personalizado (custom quote)
}
```

#### ServiceType - ⚠️ Hardcoded Enum Issue

**Problem:** Job.serviceType uses a hardcoded enum with only 7 HVAC values:
```prisma
enum ServiceType {
  INSTALACION_SPLIT
  REPARACION_SPLIT
  MANTENIMIENTO_SPLIT
  INSTALACION_CALEFACTOR
  REPARACION_CALEFACTOR
  MANTENIMIENTO_CALEFACTOR
  OTRO
}
```

**Solution:** Add `serviceTypeCode` String field to Job for dynamic service types:
```prisma
model Job {
  serviceType      ServiceType  // Keep for backwards compatibility
  serviceTypeCode  String?      // NEW: Dynamic code from ServiceTypeConfig
  // For non-HVAC jobs: serviceType = OTRO, serviceTypeCode = actual code
}
```

---

### 🆕 New Models (Create These)

#### JobLineItem - Detailed Pricing Breakdown

```prisma
model JobLineItem {
  id              String          @id @default(cuid())
  jobId           String
  priceItemId     String?         // Optional link to PriceItem
  description     String
  quantity        Decimal         @db.Decimal(10, 3)
  unit            String          @default("unidad")
  unitPrice       Decimal         @db.Decimal(12, 2)
  total           Decimal         @db.Decimal(12, 2)
  
  // Audit trail
  source          LineItemSource  @default(QUOTE)
  createdById     String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  job             Job             @relation(fields: [jobId], references: [id], onDelete: Cascade)
  priceItem       PriceItem?      @relation(fields: [priceItemId], references: [id])
  createdBy       User            @relation(fields: [createdById], references: [id])
  
  @@index([jobId])
  @@map("job_line_items")
}

enum LineItemSource {
  QUOTE           // Created in original quote by dispatcher
  TECH_ADDED      // Added by technician during job
  TECH_ADJUSTED   // Modified by technician (tracks original)
  SYSTEM          // Auto-generated (e.g., mileage charge)
}
```

### Job Model Enhancements

```prisma
model Job {
  // ... existing fields ...
  
  // ═══════════════════════════════════════════════════════════════
  // MULTI-TRADE SERVICE TYPE (NEW)
  // ═══════════════════════════════════════════════════════════════
  serviceType         ServiceType              // EXISTING - keep for backwards compat
  serviceTypeCode     String?    @map("service_type_code")  // NEW - dynamic service type
  
  // ═══════════════════════════════════════════════════════════════
  // PRICING FIELDS (ALL NEW)
  // ═══════════════════════════════════════════════════════════════
  
  // Deposit/Advance Payment
  depositAmount       Decimal?      @db.Decimal(12, 2) @map("deposit_amount")
  depositPaidAt       DateTime?     @map("deposit_paid_at")
  depositPaymentMethod String?      @map("deposit_payment_method")
  
  // Pricing Totals
  estimatedTotal      Decimal?      @db.Decimal(12, 2) @map("estimated_total")
  techProposedTotal   Decimal?      @db.Decimal(12, 2) @map("tech_proposed_total")
  finalTotal          Decimal?      @db.Decimal(12, 2) @map("final_total")
  
  // Pricing Lock (after invoice generation)
  pricingLockedAt     DateTime?     @map("pricing_locked_at")
  pricingLockedById   String?       @map("pricing_locked_by_id")
  
  // Line items
  lineItems           JobLineItem[]
}
```

---

## 4. OWNER-CONFIGURABLE SETTINGS

All pricing behavior is controlled by **Organization Settings**. Business owners configure these in their dashboard.

### Organization Pricing Settings

```prisma
// Add to OrganizationSettings or create new model

model OrganizationPricingSettings {
  id                      String   @id @default(cuid())
  organizationId          String   @unique
  
  // ═══════════════════════════════════════════════════════════════
  // TECHNICIAN ADJUSTMENT CONTROLS
  // ═══════════════════════════════════════════════════════════════
  
  // Can technicians modify pricing during jobs?
  techCanModifyPricing    Boolean  @default(true)
  
  // Limits on technician adjustments (null = unlimited)
  techMaxAdjustmentPercent  Decimal?  @db.Decimal(5, 2)  // e.g., 20.00 = max 20% increase
  techMaxAdjustmentAmount   Decimal?  @db.Decimal(12, 2) // e.g., 50000 = max $50,000 ARS
  
  // Approval required for adjustments over limit?
  requireApprovalOverLimit  Boolean  @default(true)
  
  // ═══════════════════════════════════════════════════════════════
  // INVOICE GENERATION CONTROLS
  // ═══════════════════════════════════════════════════════════════
  
  // When to generate invoice?
  invoiceGeneration       InvoiceGenerationMode  @default(MANUAL)
  
  // Auto-lock pricing when invoice generated?
  autoLockOnInvoice       Boolean  @default(true)
  
  // ═══════════════════════════════════════════════════════════════
  // DEPOSIT (SEÑA) SETTINGS
  // ═══════════════════════════════════════════════════════════════
  
  // Enable deposit tracking?
  enableDeposits          Boolean  @default(true)
  
  // Default deposit percentage (null = no default)
  defaultDepositPercent   Decimal?  @db.Decimal(5, 2)  // e.g., 50.00 = 50%
  
  // Require deposit before job start?
  requireDepositToStart   Boolean  @default(false)
  
  // ═══════════════════════════════════════════════════════════════
  // PRICE BOOK SETTINGS
  // ═══════════════════════════════════════════════════════════════
  
  // Use price book for suggestions?
  usePriceBook            Boolean  @default(true)
  
  // Price book is mandatory? (can't enter custom prices)
  priceBookMandatory      Boolean  @default(false)
  
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  
  organization            Organization @relation(fields: [organizationId], references: [id])
  
  @@map("organization_pricing_settings")
}

enum InvoiceGenerationMode {
  MANUAL              // Dispatcher manually generates invoice
  AUTO_ON_COMPLETION  // Auto-generate when job completed
  AUTO_ON_APPROVAL    // Auto-generate when dispatcher approves technician report
}
```

---

## 5. PRICING LIFECYCLE

### State Machine

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           PRICING STATE MACHINE                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│     DRAFT          QUOTED         IN_PROGRESS      PENDING_APPROVAL    FINALIZED   │
│       │               │               │                   │               │        │
│       ▼               ▼               ▼                   ▼               ▼        │
│   ┌───────┐       ┌───────┐       ┌───────┐           ┌───────┐       ┌───────┐   │
│   │ No    │  ──►  │ Quote │  ──►  │ Tech  │  ──►      │ Review │  ──► │ Final │   │
│   │ Price │       │ Sent  │       │ Working│           │ Needed │      │ Price │   │
│   └───────┘       └───────┘       └───────┘           └───────┘       └───────┘   │
│       │               │               │                   │               │        │
│   Dispatcher      Dispatcher      Technician          Dispatcher       Invoice     │
│   adds line       confirms,       adds/modifies       approves or      Generated   │
│   items           sends to        materials           adjusts          (LOCKED)    │
│                   customer                                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Permission Matrix

| State | Dispatcher | Technician | After Invoice |
|-------|------------|------------|---------------|
| Line Items - View | ✅ | ✅ | ✅ |
| Line Items - Add | ✅ | ✅ (if allowed) | 🔒 |
| Line Items - Edit | ✅ | ✅ (within limits) | 🔒 |
| Line Items - Delete | ✅ | ❌ | 🔒 |
| Deposit - Set | ✅ | ❌ | 🔒 |
| Deposit - Record Payment | ✅ | ✅ | 🔒 |
| Final Total - Approve | ✅ | ❌ | 🔒 |
| Generate Invoice | ✅ | ❌ | N/A |

---

## 6. INTEGRATION WITH SETTINGS PAGE

> **Reference:** See `architecture/Obsidian Architecture/02_App/Admin/Settings Page.md`

The pricing controls integrate with the existing **Settings Page** (`/dashboard/settings`).

### Existing Settings Structure

```
/settings
├── General            → Organization info
├── Equipo             → Team management  
├── Facturación        → Subscription & payments
├── AFIP               → Fiscal configuration
├── WhatsApp           → Messaging settings
├── MercadoPago        → Payment gateway
├── Notificaciones     → Alert preferences
├── Servicios          → Service catalog
├── Precios            → Pricing rules ✅ (Enhance this section)
├── AI Assistant       → AI configuration
└── Privacidad         → Data & privacy
```

### Enhanced Precios Section (`/settings/precios`)

This section becomes the owner's **Pricing Control Center**, combining:
1. **Pricebook** - Service catalog with prices
2. **Business Rules** - Technician limits, approvals, invoice generation
3. **Deposit Settings** - Seña defaults and requirements

### Settings Sub-Navigation

```
/settings/precios
├── /settings/precios/pricebook     → Libro de Precios (service catalog)
├── /settings/precios/rules         → Reglas de Negocio (business rules)
└── /settings/precios/deposits      → Seña y Depósitos (deposit settings)
```

### Owner Settings UI: `/settings/precios`

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Configuración → Precios                                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─ Tabs ────────────────────────────────────────────────────────────────────────┐ │
│  │  [Libro de Precios]  [Reglas de Técnicos]  [Seña]  [Facturas]                │ │
│  └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│  ═══════════════════════════════════════════════════════════════════════════════   │
│  Tab: Reglas de Técnicos                                                           │
│  ═══════════════════════════════════════════════════════════════════════════════   │
│                                                                                     │
│  ┌─ Control de Precios ──────────────────────────────────────────────────────────┐ │
│  │                                                                               │ │
│  │  ☑ Permitir que técnicos modifiquen precios durante el trabajo               │ │
│  │                                                                               │ │
│  │  Límite de ajuste:                                                            │ │
│  │  ○ Sin límite                                                                 │ │
│  │  ● Máximo porcentaje: [  20  ] %                                              │ │
│  │  ○ Máximo monto:      [       ] ARS                                           │ │
│  │                                                                               │ │
│  │  ☑ Requerir aprobación si excede el límite                                   │ │
│  │      └─ Notificar por: ☑ App  ☑ WhatsApp  ☐ Email                           │ │
│  │                                                                               │ │
│  └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│  ═══════════════════════════════════════════════════════════════════════════════   │
│  Tab: Seña                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════   │
│                                                                                     │
│  ┌─ Configuración de Seña ───────────────────────────────────────────────────────┐ │
│  │                                                                               │ │
│  │  ☑ Habilitar seguimiento de seña                                             │ │
│  │                                                                               │ │
│  │  Seña por defecto: [  50  ] %  (dejar vacío para no sugerir)                  │ │
│  │                                                                               │ │
│  │  ☐ Requerir seña antes de iniciar trabajo                                    │ │
│  │                                                                               │ │
│  └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│  ═══════════════════════════════════════════════════════════════════════════════   │
│  Tab: Facturas                                                                     │
│  ═══════════════════════════════════════════════════════════════════════════════   │
│                                                                                     │
│  ┌─ Generación de Facturas ──────────────────────────────────────────────────────┐ │
│  │                                                                               │ │
│  │  Cuándo generar factura:                                                      │ │
│  │  ● Manual (yo decido cuándo)                                                  │ │
│  │  ○ Automático al completar trabajo                                            │ │
│  │  ○ Automático al aprobar reporte del técnico                                 │ │
│  │                                                                               │ │
│  │  ☑ Bloquear precios después de generar factura (requerido por AFIP)          │ │
│  │                                                                               │ │
│  └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│                                                          [  Guardar Cambios  ]     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. INVOICE CALCULATION

### Formula

```typescript
// Final invoice calculation
const calculateInvoiceTotal = (job: Job) => {
  // Sum all line items
  const lineItemsTotal = job.lineItems.reduce((sum, item) => sum + item.total, 0);
  
  // Subtract deposit if paid
  const depositCredit = job.depositPaidAt ? job.depositAmount : 0;
  
  // Final amount due
  const amountDue = lineItemsTotal - depositCredit;
  
  return {
    subtotal: lineItemsTotal,
    depositPaid: depositCredit,
    amountDue: amountDue,
    // IVA calculated per OrganizationSettings.defaultIvaRate
  };
};
```

### Invoice Display

```
┌─────────────────────────────────────────────────────────────────┐
│                    FACTURA C - 0001-00000123                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Cliente: Juan Pérez                                            │
│  CUIL: 20-12345678-9                                            │
│  Dirección: Av. Corrientes 1234, CABA                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Descripción                  │ Cant │ P.Unit │ Total    │   │
│  ├──────────────────────────────┼──────┼────────┼──────────┤   │
│  │ Instalación split 3000fg     │  1   │$150,000│ $150,000 │   │
│  │ Soporte exterior             │  1   │ $15,000│  $15,000 │   │
│  │ Mano de obra adicional       │ 2 hs │ $12,000│  $24,000 │   │
│  └──────────────────────────────┴──────┴────────┴──────────┘   │
│                                                                 │
│                                    Subtotal:       $189,000     │
│                                    IVA 21%:         $39,690     │
│                                    ─────────────────────────    │
│                                    TOTAL:          $228,690     │
│                                                                 │
│                                    Seña pagada:   -$100,000     │
│                                    ─────────────────────────    │
│                                    A PAGAR:        $128,690     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. IMPLEMENTATION PHASES

> **Updated based on Phase 0 Audit (2026-01-15)**

| Phase | Description | Effort | Priority |
|-------|-------------|--------|----------|
| **1.1** | Add `serviceTypeCode` to Job model | 30 min | HIGH |
| **1.2** | Add pricing fields to Job (`depositAmount`, `estimatedTotal`, `finalTotal`, etc) | 1 hr | HIGH |
| **1.3** | Add `specialty` and `pricingModel` to existing PriceItem model | 30 min | HIGH |
| **1.4** | Create JobLineItem model + migrations | 1 hr | HIGH |
| **1.5** | Create OrganizationPricingSettings model + migrations | 1 hr | HIGH |
| **2.1** | Enhance `/settings/pricebook` UI with specialty filter | 2 hrs | HIGH |
| **2.2** | Create `/settings/pricebook/rules` for business rules | 3 hrs | HIGH |
| **3.1** | Update Job creation modal with pricing inputs | 4 hrs | HIGH |
| **3.2** | Update Job edit modal with line items | 3 hrs | HIGH |
| **4** | Technician mobile app pricing UI | 4 hrs | MEDIUM |
| **5** | Technician limit enforcement logic | 2 hrs | MEDIUM |
| **6** | Invoice generation from Job line items | 3 hrs | MEDIUM |
| **7** | Approval workflow for over-limit adjustments | 3 hrs | LOW |

**Total Estimated Effort: ~28 hours (3-4 days)**

### Migration Strategy

**Breaking changes:** NONE - all additions are optional fields

```bash
# Single migration for all schema changes
pnpm prisma migrate dev --name add_pricing_fields
```

---

## 9. LEGAL CONSIDERATIONS (Argentina)

### AFIP Compliance
- Invoice generation MUST comply with AFIP electronic invoicing requirements
- Once CAE is assigned, invoice is **immutable** (this is non-negotiable)
- Pricing lock after invoice is a **legal requirement**, not a preference

### Consumer Protection
- Presupuesto (quote) should be provided before starting work
- Final price cannot exceed quote by more than 10% without explicit consent (Ley 24.240)
- This enforcement is **optional** per OrganizationPricingSettings

---

## 10. APPROVAL WORKFLOW FOR OVER-LIMIT ADJUSTMENTS

When a technician proposes a price adjustment that exceeds the owner-configured limits, an approval workflow is triggered:

```typescript
// When technician submits adjustment over limit
if (adjustmentExceedsLimit && settings.requireApprovalOverLimit) {
  await createApprovalRequest({
    type: 'PRICING_ADJUSTMENT',
    jobId: job.id,
    requestedBy: technicianId,
    currentTotal: job.estimatedTotal,
    proposedTotal: techProposedTotal,
    adjustmentPercent: calculateAdjustmentPercent(),
    lineItemChanges: getLineItemDiff(),
  });
  
  // Notify dispatcher for manual review
  await sendNotification({
    channels: settings.approvalNotificationChannels, // App, WhatsApp, Email
    message: `Técnico solicita ajuste de precio: ${adjustmentPercent}%`,
  });
}
```

### Approval Options (Owner-Configurable)

| Setting | Description |
|---------|-------------|
| **Manual Review** | Dispatcher reviews and approves/rejects |
| **Auto-Approve Small Adjustments** | Owner can set threshold (e.g., auto-approve < 5%) |
| **Notification Channels** | Where to send approval requests (App, WhatsApp, Email) |

> **AI Integration:** Owners can enable AI auto-approval for small price adjustments via `/settings/ai-assistant`. See `WhatsApp-AI-Translation-Implementation.md` Phase 5 (Workflow Permissions) for implementation details.

---

## 11. SUMMARY

CampoTech's Multi-Trade Pricing System provides:

1. **Universal Support** - Works for all 12+ specialty trades
2. **Owner Control** - All behavior is configurable by business owner
3. **Technician Flexibility** - Can adjust pricing within defined limits
4. **Deposit Tracking** - Seña support with invoice deduction
5. **Legal Compliance** - AFIP requirements enforced automatically
6. **Audit Trail** - Full history of who changed what

**The owner decides. The platform enforces.**
