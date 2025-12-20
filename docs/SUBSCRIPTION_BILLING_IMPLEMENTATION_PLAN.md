# CampoTech Subscription Billing - Complete Implementation Plan

## Overview

This document outlines the complete implementation plan for CampoTech's subscription billing system. The goal is to create a fully functional payment flow from signup to subscription, with all Argentine payment methods, free trial support, and admin visibility.

---

## Business Requirements

| Requirement | Description |
|-------------|-------------|
| **Free Trial** | 14 days, no payment info required |
| **Pricing** | USD pricing, charged in ARS at transaction time |
| **Payment Methods** | Cards, cash, bank transfer, wallet (NO installments) |
| **Billing Cycles** | Monthly + Yearly (with discount) |
| **Access Control** | No access after trial unless paid |
| **Invoice History** | Full payment history with downloadable PDF invoices |
| **User Limits** | Strict limits per tier (no unlimited) |
| **Employee Onboarding** | Invite system with WhatsApp notification |
| **Abuse Prevention** | Prevent multi-business sharing of single account |
| **Admin Visibility** | Full payment monitoring in admin app |
| **Legal Compliance** | Ley 24.240 + AFIP invoice requirements |

---

## Subscription Tiers (Updated)

| Tier | Monthly (USD) | Yearly (USD) | Max Users | Cost/User |
|------|---------------|--------------|-----------|-----------|
| Gratis | $0 | $0 | 1 | - |
| Inicial | $25 | $250 | 1 | $25 |
| Profesional | $55 | $550 | 5 | $11 |
| Empresa | $120 | $1,200 | 10 | $12 |

**Notes:**
- Prices in USD for stability
- Charged in ARS equivalent at transaction time (using MercadoPago's exchange rate)
- Yearly = 10 months price (2 months free = ~17% discount)
- **NO installments (cuotas)** - single payment only

---

## Argentine Payment Methods to Support

| Method | Type | Provider | Status |
|--------|------|----------|--------|
| **Tarjeta de Crédito** | Credit Card | Visa, Mastercard, Amex, Naranja, Cabal | ✅ Include |
| **Tarjeta de Débito** | Debit Card | Maestro, Visa Débito | ✅ Include |
| **Transferencia Bancaria** | Bank Transfer | CBU/CVU | ✅ Include |
| **Rapipago** | Cash | Rapipago network | ✅ Include |
| **Pago Fácil** | Cash | Pago Fácil network | ✅ Include |
| **Mercado Pago Wallet** | Wallet | MP Balance | ✅ Include |
| **QR Code** | QR Payment | MP QR | ✅ Include |
| **Cuotas** | Installments | 3, 6, 12 cuotas | ❌ EXCLUDED |

**Why no cuotas:** Risk of missed payments on installment plans. Single payment only to ensure predictable revenue.

---

## NEW: Multi-Business Abuse Prevention

### The Problem
A user could buy the Empresa plan (10 users, $120/month) and share it with friends who run different businesses, essentially getting 10 businesses for the price of 1.

### Proposed Solutions

#### Solution 1: CUIT-Based Validation (RECOMMENDED)
```
┌─────────────────────────────────────────────────────────────────┐
│  ORGANIZATION SETUP                                             │
│  └─ Owner registers with CUIT: 30-12345678-9                    │
│                                                                 │
│  EMPLOYEE INVITATION                                            │
│  └─ Owner invites employee by CUIL: 20-98765432-1               │
│  └─ System validates CUIL belongs to person                     │
│  └─ Employee's work history linked to org's CUIT                │
│                                                                 │
│  VALIDATION                                                     │
│  └─ Cross-reference CUIL with AFIP employment records           │
│  └─ OR: Manual CUIT letter upload (constancia de CUIT)          │
│  └─ OR: ANSES employment verification                           │
└─────────────────────────────────────────────────────────────────┘
```

**Pros:** Legal, verifiable, Argentine standard
**Cons:** Requires AFIP/ANSES integration or manual verification

---

#### Solution 2: Single Business Verification (SIMPLER)

| Check | Description | Implementation |
|-------|-------------|----------------|
| **Same Address** | All employees must operate from same service area | Owner defines service area (provincias/partidos), employees must have jobs in that area |
| **Shared Customers** | Employees work on same customer base | Flag if employee creates jobs for customers with addresses 500km+ from org's base |
| **Device Fingerprint** | Track unique devices per account | Flag if 10 users from 10 completely different devices/IPs never overlap |
| **Activity Patterns** | Real companies have coordinated activity | Flag if "employees" work completely independent schedules on different customers |

---

#### Solution 3: Attestation + Audit (BALANCED - RECOMMENDED)

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: OWNER ATTESTATION                                      │
│  ─────────────────────────────                                  │
│  When inviting an employee, owner must:                         │
│  ☑ Check box: "Confirmo que [nombre] es empleado de [empresa]   │
│    y trabaja exclusivamente para esta organización"             │
│  ☑ Provide employee's CUIL number                               │
│  ☑ Agree to Terms: Sharing accounts across multiple businesses  │
│    is a violation that will result in account termination       │
│                                                                 │
│  STEP 2: EMPLOYEE CONFIRMATION                                  │
│  ─────────────────────────────                                  │
│  Employee receives WhatsApp invite and must:                    │
│  ☑ Confirm they work for [empresa name]                         │
│  ☑ Enter their CUIL (validated format)                          │
│  ☑ Upload selfie with DNI (optional but encouraged)             │
│  ☑ Agree: "Solo usaré esta cuenta para trabajos de [empresa]"   │
│                                                                 │
│  STEP 3: AUTOMATED MONITORING                                   │
│  ─────────────────────────────                                  │
│  System continuously monitors for red flags:                    │
│  ⚠ Jobs created in multiple distant cities                      │
│  ⚠ Completely different customer bases per user                 │
│  ⚠ No overlap in work schedules/areas                           │
│  ⚠ Different business categories (plomería + electricidad +     │
│    fumigación all under one account)                            │
│                                                                 │
│  STEP 4: ADMIN REVIEW                                           │
│  ─────────────────────────────                                  │
│  Flagged accounts reviewed by admin:                            │
│  → Warning email first                                          │
│  → Account suspension if confirmed abuse                        │
│  → Upgrade path offered (multiple business licenses)            │
└─────────────────────────────────────────────────────────────────┘
```

---

#### Solution 4: Terms of Service + Enforcement

Add clear terms:

> **Uso Exclusivo por Empresa**
>
> Cada cuenta de CampoTech representa UNA empresa con UN CUIT.
> Está prohibido compartir una cuenta entre múltiples negocios.
>
> Violaciones detectadas resultarán en:
> 1. Primera vez: Advertencia por email
> 2. Segunda vez: Suspensión de 7 días
> 3. Tercera vez: Terminación permanente sin reembolso
>
> Si operás múltiples negocios, contactanos para un plan Multi-Empresa.

---

### Recommended Approach: Combination

| Layer | Method | Effort |
|-------|--------|--------|
| **Legal** | Terms of Service + Attestation | Low |
| **Technical** | CUIL collection + format validation | Low |
| **Monitoring** | Geographic + activity pattern analysis | Medium |
| **Manual** | Admin review of flagged accounts | Low |
| **Future** | AFIP CUIL verification API | High (optional) |

---

## NEW: Employee Invitation System

### Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. OWNER CREATES EMPLOYEE                                      │
│     ─────────────────────────                                   │
│     Dashboard → Configuración → Equipo → "Agregar empleado"     │
│                                                                 │
│     Form:                                                       │
│     ┌───────────────────────────────────────────────────┐       │
│     │ Nombre: [Juan Pérez                            ]  │       │
│     │ Teléfono: [+54 9 11 1234-5678                  ]  │       │
│     │ CUIL: [20-12345678-9                           ]  │       │
│     │ Rol: [Técnico ▼]                                  │       │
│     │                                                   │       │
│     │ ☑ Confirmo que esta persona es empleado de mi    │       │
│     │   empresa y trabajará exclusivamente para        │       │
│     │   [Fumigaciones García S.R.L.]                   │       │
│     │                                                   │       │
│     │ [Enviar invitación por WhatsApp]                  │       │
│     └───────────────────────────────────────────────────┘       │
│                                                                 │
│  2. SYSTEM SENDS WHATSAPP                                       │
│     ─────────────────────────                                   │
│     ┌───────────────────────────────────────────────────┐       │
│     │ 🔔 CampoTech                                      │       │
│     │                                                   │       │
│     │ ¡Hola Juan!                                       │       │
│     │                                                   │       │
│     │ Fumigaciones García S.R.L. te invitó a unirte    │       │
│     │ a su equipo en CampoTech.                         │       │
│     │                                                   │       │
│     │ Completá tu registro aquí:                        │       │
│     │ 🔗 https://app.campotech.com/join/abc123xyz       │       │
│     │                                                   │       │
│     │ Este enlace expira en 7 días.                     │       │
│     └───────────────────────────────────────────────────┘       │
│                                                                 │
│  3. EMPLOYEE COMPLETES REGISTRATION                             │
│     ───────────────────────────────                             │
│     /join/[token] page:                                         │
│                                                                 │
│     ┌───────────────────────────────────────────────────┐       │
│     │ Únete a Fumigaciones García S.R.L.                │       │
│     │                                                   │       │
│     │ Tu nombre: Juan Pérez (confirmado por tu jefe)    │       │
│     │                                                   │       │
│     │ Verificar teléfono:                               │       │
│     │ [Enviar código por WhatsApp]                      │       │
│     │                                                   │       │
│     │ Código: [______]                                  │       │
│     │                                                   │       │
│     │ ☑ Confirmo que trabajo para Fumigaciones García  │       │
│     │   y solo usaré esta cuenta para trabajos de      │       │
│     │   esta empresa.                                   │       │
│     │                                                   │       │
│     │ [Completar registro]                              │       │
│     └───────────────────────────────────────────────────┘       │
│                                                                 │
│  4. EMPLOYEE ACTIVATED                                          │
│     ─────────────────────                                       │
│     → User record created with role                             │
│     → Linked to organization                                    │
│     → Can download mobile app and login                         │
│     → Owner notified: "Juan se unió a tu equipo"                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Database: Employee Invitations Table

```sql
CREATE TABLE employee_invitations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    invited_by_user_id TEXT NOT NULL REFERENCES users(id),

    -- Invitee info
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    cuil TEXT NOT NULL,  -- Format: XX-XXXXXXXX-X
    role TEXT NOT NULL DEFAULT 'TECHNICIAN',

    -- Invitation status
    token TEXT UNIQUE NOT NULL,  -- Secure random token for invite link
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, accepted, expired, revoked

    -- Attestation
    owner_attestation_at TIMESTAMPTZ NOT NULL,  -- When owner confirmed
    employee_attestation_at TIMESTAMPTZ,  -- When employee confirmed

    -- Tracking
    whatsapp_sent_at TIMESTAMPTZ,
    whatsapp_delivered_at TIMESTAMPTZ,

    -- Result
    created_user_id TEXT REFERENCES users(id),  -- After registration complete

    expires_at TIMESTAMPTZ NOT NULL,  -- Token expiry (7 days)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## NEW: Invoice History & PDF Downloads

### Owner's Invoice View

```
┌─────────────────────────────────────────────────────────────────┐
│  Facturación → Historial de pagos                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Próximo pago: 15 Enero 2025                                ││
│  │ Monto: $120 USD (≈ $120,000 ARS)                           ││
│  │ Plan: Empresa (mensual)                                     ││
│  │ Método: Visa ****1234                                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Historial de pagos                                             │
│  ─────────────────────────────────────────────────────────────  │
│  │ Fecha      │ Concepto           │ Monto    │ Estado  │ PDF │ │
│  ├────────────┼────────────────────┼──────────┼─────────┼─────┤ │
│  │ 15/12/2024 │ Plan Empresa (Dic) │ $120 USD │ ✅ Pagado│ 📄  │ │
│  │ 15/11/2024 │ Plan Empresa (Nov) │ $120 USD │ ✅ Pagado│ 📄  │ │
│  │ 15/10/2024 │ Plan Empresa (Oct) │ $120 USD │ ✅ Pagado│ 📄  │ │
│  │ 15/09/2024 │ Plan Empresa (Sep) │ $120 USD │ ✅ Pagado│ 📄  │ │
│  │ 01/09/2024 │ Upgrade a Empresa  │ $65 USD  │ ✅ Pagado│ 📄  │ │
│  │ 15/08/2024 │ Plan Profesional   │ $55 USD  │ ✅ Pagado│ 📄  │ │
│  └────────────┴────────────────────┴──────────┴─────────┴─────┘ │
│                                                                 │
│  [Exportar historial CSV]                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Invoice PDF Requirements (Argentine Law)

Each invoice PDF must contain:

| Field | Description | Example |
|-------|-------------|---------|
| **Emisor** | CampoTech legal entity | CampoTech S.A.S. |
| **CUIT Emisor** | CampoTech's CUIT | 30-71234567-8 |
| **Domicilio Emisor** | CampoTech address | Av. Corrientes 1234, CABA |
| **Receptor** | Customer's business name | Fumigaciones García S.R.L. |
| **CUIT Receptor** | Customer's CUIT | 30-12345678-9 |
| **Domicilio Receptor** | Customer's address | Calle Falsa 123, Buenos Aires |
| **Número de Factura** | Sequential invoice number | B 0001-00000123 |
| **Fecha de Emisión** | Invoice date | 15/12/2024 |
| **Concepto** | Service description | Suscripción CampoTech - Plan Empresa (Diciembre 2024) |
| **Período** | Service period | 15/12/2024 - 14/01/2025 |
| **Precio USD** | Price in USD | USD 120.00 |
| **Tipo de Cambio** | Exchange rate used | 1 USD = 1,000 ARS |
| **Precio ARS** | Price in ARS | ARS 120,000.00 |
| **IVA** | Tax (21% if applicable) | ARS 25,200.00 (if applicable) |
| **Total** | Total amount | ARS 145,200.00 |
| **CAE** | AFIP electronic auth code | 12345678901234 |
| **Vencimiento CAE** | CAE expiry | 25/12/2024 |
| **QR Code** | AFIP verification QR | [QR Image] |

### Invoice Generation Options

| Option | Description | Complexity |
|--------|-------------|------------|
| **Option A: AFIP Electronic Invoice** | Full legal invoice via AFIP web services | High (requires AFIP integration) |
| **Option B: Factura C (Monotributo)** | Simplified invoice for small taxpayers | Medium |
| **Option C: Recibo/Comprobante** | Receipt (not full factura) for exempt services | Low |

**Recommendation:** Start with Option C (receipt), upgrade to Option A later.

---

## Phase 1: Database Schema & Core Models (UPDATED)

### Tasks

1. **Create `organization_subscriptions` table migration**
   - `id` (TEXT, PRIMARY KEY)
   - `organization_id` (TEXT, FK to organizations)
   - `tier` (ENUM: FREE, BASICO, PROFESIONAL, EMPRESARIAL)
   - `billing_cycle` (ENUM: MONTHLY, YEARLY)
   - `status` (ENUM: trialing, active, past_due, cancelled, expired, paused)
   - `price_usd` (DECIMAL) - Price in USD
   - `price_ars` (DECIMAL) - Price charged in ARS
   - `exchange_rate` (DECIMAL) - USD/ARS rate at transaction
   - `trial_ends_at` (TIMESTAMPTZ)
   - `current_period_start` (TIMESTAMPTZ)
   - `current_period_end` (TIMESTAMPTZ)
   - `mp_subscription_id` (TEXT, nullable)
   - `mp_payer_id` (TEXT, nullable)
   - `cancelled_at` (TIMESTAMPTZ, nullable)
   - `cancel_reason` (TEXT, nullable)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

2. **Create `subscription_invoices` table migration**
   - `id` (TEXT, PRIMARY KEY)
   - `subscription_id` (TEXT, FK)
   - `organization_id` (TEXT, FK)
   - `invoice_number` (TEXT, UNIQUE) - e.g., "B 0001-00000123"
   - `amount_usd` (DECIMAL)
   - `amount_ars` (DECIMAL)
   - `exchange_rate` (DECIMAL)
   - `status` (ENUM: draft, issued, paid, cancelled, refunded)
   - `concept` (TEXT) - e.g., "Plan Empresa - Diciembre 2024"
   - `period_start` (DATE)
   - `period_end` (DATE)
   - `payment_method` (TEXT)
   - `mp_payment_id` (TEXT)
   - `pdf_url` (TEXT) - S3/Supabase storage URL
   - `afip_cae` (TEXT, nullable) - For AFIP integration
   - `afip_cae_expiry` (DATE, nullable)
   - `issued_at` (TIMESTAMPTZ)
   - `paid_at` (TIMESTAMPTZ, nullable)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

3. **Create `employee_invitations` table migration** (see above)

4. **Update `users` table**
   - Add `cuil` (TEXT, nullable) - Argentine CUIL number
   - Add `invited_by_user_id` (TEXT, FK, nullable)
   - Add `invitation_id` (TEXT, FK, nullable)
   - Add `attestation_confirmed_at` (TIMESTAMPTZ, nullable)

5. **Update `organizations` table**
   - Add `max_users` (INTEGER) - Limit based on tier
   - Add `current_user_count` (INTEGER, computed or cached)

6. **Update tier limits configuration**
   ```typescript
   const TIER_LIMITS = {
     FREE: { maxUsers: 1 },
     BASICO: { maxUsers: 1 },
     PROFESIONAL: { maxUsers: 5 },
     EMPRESARIAL: { maxUsers: 10 },
   };
   ```

### Tests

- [ ] Migration runs without errors
- [ ] User limit enforced when adding employees
- [ ] Invoice number sequence is unique
- [ ] CUIL format validation works
- [ ] Invitation token is cryptographically secure

---

## Phase 2: Trial System (Same as before)

See original plan - no changes needed.

---

## Phase 3: MercadoPago Integration (UPDATED)

### Tasks

1. **Configure MP checkout WITHOUT cuotas**
   ```javascript
   payment_methods: {
     excluded_payment_types: [],
     excluded_payment_methods: [],
     installments: 1,  // ONLY single payment
     default_installments: 1
   }
   ```

2. **USD pricing with ARS conversion**
   ```javascript
   // Preference creation
   const preference = {
     items: [{
       title: `CampoTech - Plan ${tierName}`,
       quantity: 1,
       currency_id: 'ARS',  // MP only accepts ARS
       unit_price: priceUsd * currentExchangeRate,
     }],
     metadata: {
       price_usd: priceUsd,
       exchange_rate: currentExchangeRate,
       tier: tier,
       billing_cycle: billingCycle,
     }
   };
   ```

3. **Get exchange rate**
   - Option A: Use MercadoPago's rate (from payment response)
   - Option B: Use Banco Nación oficial rate
   - Option C: Use Dólar Blue API (not recommended for legal)

   **Recommendation:** Use MP's rate from transaction for consistency.

4. **Store exchange rate with each transaction**
   - Save `price_usd`, `price_ars`, `exchange_rate` on every payment
   - Display both on invoices

### Tests

- [ ] Cuotas NOT available at checkout
- [ ] USD price stored correctly
- [ ] ARS price matches exchange rate
- [ ] Exchange rate saved with payment

---

## Phase 4: Webhook Processing (Same as before + Invoice)

### Additional Tasks

1. **Generate invoice on successful payment**
   - Create invoice record
   - Generate invoice PDF
   - Upload to storage
   - Send invoice via email

2. **Invoice PDF generation**
   - Use library like `@react-pdf/renderer` or `puppeteer`
   - Include all required fields
   - Generate QR code if AFIP integration exists

---

## Phase 5: Access Control (Same as before)

---

## Phase 6: Billing UI (UPDATED)

### Additional Tasks

1. **Upcoming payment display**
   - Next payment date
   - Amount (USD and estimated ARS)
   - Payment method on file
   - [Change payment method] link

2. **Invoice history table**
   - All past invoices
   - Status column
   - PDF download button
   - Export CSV option

3. **PDF invoice download**
   - Generates on-demand if not cached
   - Proper filename: `CampoTech-Factura-B0001-00000123.pdf`

---

## Phase 7: Employee Invitation System (NEW)

### Tasks

1. **Create "Equipo" settings page**
   - List current team members
   - Show remaining slots (e.g., "3 de 5 usuarios")
   - [Agregar empleado] button

2. **Create invitation form component**
   - Name, phone, CUIL fields
   - CUIL validation (format + checksum)
   - Owner attestation checkbox
   - Terms agreement

3. **Create invitation API endpoint**
   - `POST /api/team/invite`
   - Validates user limit not exceeded
   - Creates invitation record
   - Sends WhatsApp message

4. **Create WhatsApp template for invitation**
   - Register template with Meta
   - Include personalization (name, company)
   - Include invite link

5. **Create join page** (`/join/[token]`)
   - Validate token not expired
   - Show company name
   - Phone verification (OTP)
   - Employee attestation
   - Complete registration

6. **Create invitation status tracking**
   - pending → sent → delivered → opened → completed
   - Notify owner on completion
   - Allow resend if not completed

7. **Add user limit enforcement**
   - Check limit before creating invitation
   - Show upgrade prompt when limit reached

### Tests

- [ ] Invitation creates secure token
- [ ] WhatsApp message sends correctly
- [ ] Join page validates token
- [ ] OTP verification works
- [ ] User created with correct org link
- [ ] User limit prevents over-invitation
- [ ] Expired token rejected

---

## Phase 8: Abuse Prevention (NEW)

### Tasks

1. **Add CUIL collection and validation**
   - Format validation: XX-XXXXXXXX-X
   - Checksum validation (Argentine CUIL algorithm)
   - Store encrypted

2. **Add attestation tracking**
   - Owner attestation timestamp
   - Employee attestation timestamp
   - Terms version agreed to

3. **Create monitoring system**
   - Track job locations per user
   - Flag accounts with dispersed activity
   - Dashboard in admin for review

4. **Add Terms of Service clauses**
   - Single business per account
   - Violation consequences
   - Multi-business option available

5. **Create admin flagging system**
   - Automated flags for suspicious patterns
   - Manual review queue
   - Warning/suspend/terminate actions

### Monitoring Flags

| Flag | Trigger | Severity |
|------|---------|----------|
| `DISPERSED_LOCATIONS` | Jobs in 3+ provinces | Medium |
| `NO_CUSTOMER_OVERLAP` | Each user has unique customers | Low |
| `DIFFERENT_CATEGORIES` | Multiple service types | Low |
| `SUSPICIOUS_DEVICES` | 5+ unique devices, no overlap | High |
| `MULTIPLE_CUITS` | Different CUITs in job data | Critical |

### Tests

- [ ] CUIL validation catches invalid numbers
- [ ] Dispersed location flag triggers
- [ ] Admin can view flagged accounts
- [ ] Warning email sends correctly
- [ ] Suspension blocks access

---

## Phase 9: Admin Integration (UPDATED)

### Additional Tasks

1. **Subscription management**
   - View all invitations
   - User count per org
   - Abuse flags dashboard

2. **Flag review queue**
   - List of flagged accounts
   - Details view with evidence
   - Actions: dismiss, warn, suspend, terminate

---

## Phase 10: Testing & Launch (Same as before)

---

## Updated File List

### New Files
- `apps/web/app/dashboard/settings/team/page.tsx` - Team management
- `apps/web/app/dashboard/settings/team/invite/page.tsx` - Invitation form
- `apps/web/app/join/[token]/page.tsx` - Employee join page
- `apps/web/app/api/team/invite/route.ts` - Create invitation
- `apps/web/app/api/team/[id]/route.ts` - Manage invitation
- `apps/web/lib/services/invitation-manager.ts` - Invitation logic
- `apps/web/lib/services/invoice-generator.ts` - PDF invoice generation
- `apps/web/lib/services/abuse-detector.ts` - Abuse monitoring
- `apps/web/lib/validation/cuil.ts` - CUIL validation
- `apps/admin/app/dashboard/flags/page.tsx` - Abuse flags review

### Updated Files
- All files from original plan
- Plus employee invitation integration

---

## Environment Variables (Updated)

```bash
# MercadoPago
MP_ACCESS_TOKEN="production-access-token"
MP_PUBLIC_KEY="production-public-key"

# NO cuotas - single payment only
MP_MAX_INSTALLMENTS=1

# Exchange Rate (optional - use MP rate by default)
# EXCHANGE_RATE_API_URL="https://api.bcra.gob.ar/..."

# WhatsApp (for invitations)
WHATSAPP_INVITATION_TEMPLATE_ID="employee_invitation_v1"

# Invoice Storage
INVOICE_STORAGE_BUCKET="campotech-invoices"

# Abuse Detection
ABUSE_LOCATION_THRESHOLD_KM=500
ABUSE_MIN_PROVINCES_FLAG=3
```

---

## Summary of Changes

| Original | Updated |
|----------|---------|
| Prices in ARS | Prices in USD, charged in ARS |
| Cuotas enabled | Cuotas DISABLED |
| No invoice history | Full invoice history with PDF |
| Unlimited users (Empresa) | Max 10 users (Empresa) |
| Self-registration | Invite-only for employees |
| No abuse prevention | Multi-layer abuse prevention |

---

*Document Version: 2.0*
*Updated: 2025-12-20*
*Author: CampoTech Development Team*
