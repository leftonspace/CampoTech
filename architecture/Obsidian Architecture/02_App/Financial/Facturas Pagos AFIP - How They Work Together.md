---
tags:
  - financial
  - afip
  - facturas
  - pagos
  - guide
  - oficios
status: 🟢 Reference
type: Architecture Guide
updated: 2026-02-13
---

# 💰 Facturas, Pagos & AFIP — How They Work Together

> [!INFO] **Purpose**
> A plain-language guide explaining the 3 financial systems in CampoTech, how they interact, and the full lifecycle for oficios (trades). Written for product understanding, onboarding decisions, and feature planning.

---

## 🎯 The Big Picture

Think of getting paid for field service work as a **chain with 6 links**:

```
┌──────────┐     ┌───────────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐     ┌───────────┐
│  TRABAJO │────▶│  COBRO    │────▶│ FACTURA  │────▶│   AFIP   │────▶│   PAGO   │────▶│CONCILIADO│
│  (Job)   │     │(Collect)  │     │(Invoice) │     │  (Tax)   │     │(Payment) │     │(Matched) │
└──────────┘     └───────────┘     └──────────┘     └───────────┘     └──────────┘     └───────────┘
   Step 1           Step 2           Step 3           Step 4            Step 5           Step 6
```

| Step | In Simple Terms |
|:----:|:---------------|
| 1 | **Trabajo** — The technician does the work |
| 2 | **Cobro** — The technician collects the money on-site (cash, MercadoPago, transfer) |
| 3 | **Factura** — The owner creates a tax document saying "this customer paid $X for this work" |
| 4 | **AFIP** — Argentina's tax office stamps the document with a legal code (CAE) making it official |
| 5 | **Pago** — A formal payment record linking money to the invoice |
| 6 | **Conciliado** — The payment fully covers the invoice — everything matches, the cycle is closed |

---

## 📄 System 1: Facturas (Invoices)

### What Is It?

A **Factura** is a formal document that says _"You owe me $X for this work."_ In Argentina, every formal sale needs one. It's like a receipt, but legally binding.

### Types of Facturas (This is Argentina-specific)

| Type | Who Issues It | Who Receives It | IVA (Sales Tax) | Most Oficios Use This? |
|:----:|:-------------|:----------------|:----------------|:-----:|
| **Factura C** | Monotributista (simplified tax regime) | Anyone | No IVA breakdown — included in price | ✅ **Yes** — most independent tradespeople |
| **Factura B** | Responsable Inscripto (full tax registration) | Final consumer | IVA included in total | Sometimes — larger companies |
| **Factura A** | Responsable Inscripto | Another Responsable Inscripto | IVA shown separately | Rarely — B2B only |

> [!TIP] **For Oficios Context**
> A plumber (plomero), electrician (electricista), or HVAC tech (gasista) who is a _monotributista_ will use **Factura C** for everything. This is the simplest path and the most common for small trades.

### Factura Lifecycle (States)

```
DRAFT (Borrador)          ← Created, can be edited freely
  │
  │  [Owner submits to AFIP]
  ▼
PENDING (Pendiente)       ← In the AFIP queue, waiting for authorization
  │
  │  [AFIP processes it — usually seconds]
  ▼
AUTHORIZED (Autorizada)   ← Has CAE number — LEGALLY LOCKED forever
  │
  │  [Sent to customer via WhatsApp/PDF]
  ▼
PAID (Pagada)             ← Payment received and matched
```

### Key Rules

- ✅ **DRAFT invoices** can be edited, changed, or deleted freely
- ✅ **PENDING invoices** are in the AFIP queue — wait for them
- 🔒 **AUTHORIZED invoices** (with CAE) are **permanently locked** — you CANNOT edit or delete them. This is Argentine law. If there's a mistake, you must issue a _Nota de Crédito_ (credit note)
- Every Factura belongs to a **Customer** and optionally links to a **Job**

### What's in the Database

| Field | What It Means |
|:------|:-------------|
| `invoiceNumber` | Formatted as `C-00000001` (type + sequential number) |
| `type` | `FACTURA_A`, `FACTURA_B`, or `FACTURA_C` |
| `status` | `DRAFT`, `PENDING`, `AUTHORIZED`, `PAID`, `CANCELLED` |
| `subtotal` | Price before tax |
| `taxAmount` | IVA amount (21% for most services) |
| `total` | What the customer pays |
| `afipCae` | The AFIP authorization code — **null** until AFIP stamps it |
| `afipCaeExpiry` | When the CAE expires (usually 10 days to deliver to customer) |
| `lineItems` | Detailed breakdown: "2hrs plumbing @ $5,000 + 1 valve @ $2,000" |

---

## 🏛️ System 2: AFIP (Tax Authority Integration)

### What Is AFIP?

**AFIP** = _Administración Federal de Ingresos Públicos_ — Argentina's federal tax agency (like the IRS in the US).

In Argentina, **every formal invoice must be electronically reported to AFIP**. You can't just print a receipt and call it done. AFIP must validate it and give you a **CAE** (Electronic Authorization Code) that proves the sale is legitimate and taxed.

### What Is a CAE?

- **CAE** = _Código de Autorización Electrónico_
- It's a unique number AFIP gives your invoice after they verify it
- Without a CAE, your Factura is just a piece of paper with no legal value
- The CAE has an **expiry date** (usually 10 days) — you must deliver the invoice to the customer before it expires

### How It Works in CampoTech

#### Step 1: Configuration (One-time setup per business)

This is the **Configuración → AFIP** page:

| Setting | What You Need |
|:--------|:-------------|
| **CUIT** | Your tax ID number (e.g., `20-12345678-9`) |
| **Digital Certificate (.p12)** | A digital signature file you generate at `auth.afip.gob.ar` — proves you're authorized |
| **Certificate Password** | The password you chose when generating the .p12 |
| **Punto de Venta** | A Point of Sale number registered at AFIP (e.g., `1`, `4`) |
| **Ambiente** | Testing (Homologación) or Production (Producción) |

> [!WARNING] **Security**
> The certificate and password are encrypted with AES-256-GCM before storage. They never leave the server unencrypted.

#### Step 2: Sending an Invoice to AFIP

```
Owner creates Factura (DRAFT)
     │
     │  [Submits to AFIP]
     ▼
La factura entra a la "Cola AFIP" (AFIP Queue)
     │
     │  [Our AFIPClient sends it to AFIP's servers (WSFE API)]
     │  Rate limited: only N requests per minute (AFIP's rules)
     │  Circuit breaker: if AFIP is down, we stop and retry later
     ▼
AFIP validates and returns:
     ├── ✅ CAE assigned → Invoice becomes AUTHORIZED (locked forever)
     └── ❌ Rejected → Error logged, manual review needed
```

#### AFIP Queue States (Cola AFIP)

| State | Icon | What's Happening |
|:------|:----:|:----------------|
| `pending` | ⏳ | Waiting in line to be sent |
| `processing` | 🔄 | Currently being sent to AFIP |
| `completed` | ✅ | CAE received — invoice is stamped |
| `failed` | ❌ | AFIP rejected it — check the error and fix |
| `retrying` | 🔁 | Failed temporarily (AFIP was down), trying again automatically |

#### What Can Go Wrong?

| Error | Cause | Fix |
|:------|:------|:----|
| Certificate expired | Your .p12 file needs renewal at AFIP | Generate new certificate and re-upload |
| Punto de Venta not registered | You haven't enabled this PdV at AFIP's website | Go to AFIP ABM, enable electronic invoicing |
| Duplicate invoice number | Sequential numbering conflict | System auto-resolves on retry |
| AFIP is down | Their servers go down regularly (especially end of month) | Circuit breaker auto-retries |

### Technical Components

| Component | Path | What It Does |
|:----------|:-----|:-------------|
| **AFIP Settings Page** | `/dashboard/settings/afip` | UI for uploading certificate and configuring credentials |
| **Cola AFIP Page** | `/dashboard/invoices/queue` | Queue monitoring: pending, processing, failed invoices |
| **AFIPClient** | `lib/integrations/afip/client.ts` | The engine: rate limiting, circuit breaker, batch processing |
| **AFIP Credentials Service** | `lib/services/afip-credentials.service.ts` | AES-256 encryption for certificate storage |
| **Fiscal Health Service** | `lib/services/fiscal-health.service.ts` | Compliance monitoring — checks if AFIP is configured and healthy |

---

## 💳 System 3: Pagos (Payments)

### What Is It?

A **Pago** (payment) is the record that money actually changed hands. It's always linked to a **Factura** (invoice).

### How It Works

```
Factura exists ($12,100)
     │
     │  [Customer pays]
     ▼
Pago created:
  - Amount: $12,100
  - Method: Efectivo (cash)
  - Status: COMPLETED
  - Linked to: Factura C-00000001
     │
     │  [System checks: total paid ≥ invoice total?]
     ▼
Factura status → PAID ✅
```

### Payment Methods (Argentine Market)

| Method | How It Works | Verification |
|:-------|:-------------|:----------:|
| **Efectivo** (Cash) | Technician takes the cash and records the amount | Manual — trust-based |
| **MercadoPago** | Customer scans a QR code or clicks a payment link | ✅ Automatic via webhook |
| **Transferencia** (Bank Transfer) | Customer sends money to your CBU/Alias | Semi-manual — tech confirms |

### Key Rules

- Every Pago **must** link to a Factura (you can't have a floating payment)
- One Factura can have **multiple** Pagos (partial payments)
- When sum of Pagos ≥ Factura total → invoice becomes **PAID**
- Payment amounts use `Decimal` types (never floats) — prevents rounding errors with Argentine pesos

### What's in the Database

| Field | What It Means |
|:------|:-------------|
| `amount` | How much was paid |
| `method` | `CASH`, `MERCADOPAGO`, `TRANSFER`, `CARD` |
| `status` | `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED` |
| `reference` | External payment ID (e.g., MercadoPago payment ID) |
| `paidAt` | When the money was received |
| `invoiceId` | Which Factura this payment covers |

---

## 🔗 How All 3 Interact — Real-Life Example

### Scenario: A plumber fixes a leak in Palermo, Buenos Aires

```
1. 📱 OWNER creates a Trabajo (job) in CampoTech
   → Assigns it to Carlos (plumber)
   → Scheduled for Tuesday 10am at Calle Thames 1234

2. 🔧 CARLOS arrives, fixes the leak in 2 hours
   → Uses 1 valve kit ($3,000) and 2 hours labor ($5,000/hr)
   → Marks job as COMPLETED in mobile app

3. 💵 CARLOS collects payment on-site (Cobro)
   → Total: $10,000 + $2,100 IVA = $12,100
   → Customer pays $12,100 in Efectivo (cash)
   → Carlos records it in the app

4. 📄 OWNER creates a Factura C for the job
   → Line items auto-populated from job:
      "2hs mano de obra plomería: $10,000"
      "1x kit válvula: $3,000"
      "IVA 21%: $2,730"
      "Total: $15,730"
   → Status: DRAFT

5. 🏛️ OWNER submits Factura to AFIP
   → Status changes to PENDING
   → Enters the Cola AFIP
   → Our AFIPClient sends it to AFIP's WSFE API
   → AFIP returns CAE: "74293817425123"
   → Status: AUTHORIZED (locked forever)

6. 💬 SYSTEM auto-sends WhatsApp to customer
   → "Tu factura C-00000001 por $15,730 está lista"
   → Includes QR code with AFIP validation data

7. 💳 SYSTEM creates a Pago record
   → Amount: $15,730
   → Method: CASH
   → Reference: linked to the job's on-site collection
   → Status: COMPLETED

8. ✅ RECONCILED
   → Pago total ($15,730) ≥ Factura total ($15,730)
   → Factura status → PAID
   → Job billing cycle: COMPLETE
```

---

## 🗂️ Where Things Live in the App

### Pages (What the user sees)

| Sidebar Item | URL | What It Shows |
|:------------|:----|:-------------|
| **Facturas** | `/dashboard/invoices` | List of all invoices with status, "Cola AFIP" button |
| **Cola AFIP** | `/dashboard/invoices/queue` | AFIP processing queue: pending, processing, failed |
| **Pagos** | `/dashboard/payments` | List of all payments linked to invoices |
| **Conciliación** | `/dashboard/payments/reconciliation` | Match payments to invoices |
| **Configuración → AFIP** | `/dashboard/settings/afip` | Certificate upload, CUIT, Punto de Venta |

### APIs (What the code calls)

| API | Methods | What It Does |
|:----|:--------|:-------------|
| `/api/invoices` | GET, POST | List and create invoices |
| `/api/invoices/[id]` | GET, PUT, DELETE | View, edit, delete a single invoice |
| `/api/invoices/queue-status` | GET | Get queue stats (pending/processing/failed counts) |
| `/api/payments` | GET, POST | List and create payments |
| `/api/payments/disputes` | GET, POST | Payment dispute management |

### Services (Backend logic)

| Service | Purpose |
|:--------|:--------|
| `InvoiceService` | Create/list/update invoices, lock pricing, calculate IVA |
| `PaymentService` | Create/list payments, link to invoices |
| `AFIPClient` | Rate-limited, circuit-breaker-protected AFIP communication |
| `FiscalHealthService` | Monitors AFIP compliance status |

---

## ⚠️ Dead Routes Context (Audit Feb 2026)

The following API routes exist but have **zero consumers** — they are **not** used by any page:

| Dead Route | What It Does | Why It's Dead |
|:-----------|:-------------|:-------------|
| `api/afip/queue` | Alternative queue management API (add/cancel items) | The Cola AFIP page uses `api.admin.queues()` and `api.invoices.queueStatus()` instead — this was a duplicate |
| `api/afip/status` | AFIP system health check (circuit breaker, rate limits) | No admin health dashboard was ever built |

> See: [[Audit Feb 2026 — Dead API Routes]] for full list.

---

## 🔗 Connections

- **Parent:** [[Financial System Overview]]
- **Flows:** [[Invoice Lifecycle]], [[Payment Collection Flow]], [[Job Lifecycle]]
- **Settings:** [[AFIP Settings]], [[MercadoPago Settings]]
- **Related:** [[Fiscal Health Monitor]], [[Multi-Trade Pricing]]

---

*The chain: Trabajo → Cobro → Factura → AFIP → Pago → Conciliado. One clean flow from the field to the tax office.*
