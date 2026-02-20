---
tags:
  - financial
  - proposal
  - ux
  - oficios
  - simplification
status: � Phase 1 Implemented
type: Design Proposal
updated: 2026-02-13
---

# 🧾 Unified Billing Hub — Design Proposal

> [!INFO] **Goal**
> Replace the current 3-page financial system (Facturas + Pagos + Cola AFIP) with a **single unified page** that shows every job's billing status in one view. Designed to make AFIP compliance invisible and automatic for new entrepreneurs who don't understand tax bureaucracy.

---

## 🔥 The Problem

### Current UX: 3 Separate Pages = Confusion

Right now, a new plumber who just registered has to:

1. Go to **Facturas** → find the right invoice → check if it has a CAE
2. Go to **Cola AFIP** → see if it's processing → check for errors
3. Go to **Pagos** → see if the customer paid → check reconciliation
4. Go to **Conciliación** → match payments to invoices

This is **4 pages** to answer one simple question: _"Did I get paid for that job on Tuesday?"_

### The Roadblock for New Entrepreneurs

```
New plumber thinks:  "I fixed a pipe. Did I get paid? Am I legal?"
                              │
Current CampoTech:            ▼
      ┌─────────────────────────────────────────┐
      │  "Go to Facturas... what's a CAE?"      │
      │  "Cola AFIP? What's a cola?"            │
      │  "Pagos... where's the link to my job?" │
      │  "Conciliación... I just want to know   │
      │   if I was paid!!"                      │
      └─────────────────────────────────────────┘
                              │
                              ▼
                     😤 Abandons the feature
```

**AFIP is the #1 friction point for micro-entrepreneurs in Argentina.** If we can make it feel as simple as _"Done! Your invoice is authorized"_ — that's a massive competitive advantage.

---

## 💡 The Solution: Unified Billing Hub ("Facturación")

### One Page, One Pipeline View

Replace the sidebar items `Facturas` + `Pagos` with a single **"Facturación"** page that shows every completed job's billing status as a **pipeline** (like a Kanban board):

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Facturación                                                    [+ Nueva] │
│  Tu panel de cobros y facturación electrónica                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │ COBRADO │  │ FACTURAR  │  │ EN AFIP   │  │ ENVIADA   │  │ CERRADO  │ │
│  │  (3)    │  │   (1)     │  │   (2)     │  │   (4)     │  │  (12)    │ │
│  ├─────────┤  ├───────────┤  ├───────────┤  ├───────────┤  ├──────────┤ │
│  │ ██████  │  │ ██████    │  │ ████████  │  │ ██████    │  │ ████████ │ │
│  │ Pérez   │  │ Rodriguez │  │ Martínez  │  │ López     │  │ García   │ │
│  │ $15,730 │  │ $22,400   │  │ $8,900    │  │ $31,200   │  │ $45,600  │ │
│  │ 2 días  │  │ ⚡Crear   │  │ ⏳ Cola   │  │ ✅ CAE    │  │ ✅ Pagada│ │
│  ├─────────┤  ├───────────┤  ├───────────┤  ├───────────┤  ├──────────┤ │
│  │ ██████  │  │           │  │ ████████  │  │ ██████    │  │ ████████ │ │
│  │ Gómez   │  │           │  │ Sánchez   │  │ Díaz      │  │ Ruiz     │ │
│  │ $9,200  │  │           │  │ $12,500   │  │ $18,700   │  │ $28,900  │ │
│  │ 5 min   │  │           │  │ ❌ Error  │  │ ✅ CAE    │  │ ✅ Pagada│ │
│  └─────────┘  └───────────┘  └───────────┘  └───────────┘  └──────────┘ │
│                                                                           │
│  ───── Resumen ─────────────────────────────────────────────────────────  │
│  💰 Por cobrar: $46,330    📄 Por facturar: 1    ❌ Errores AFIP: 1     │
└────────────────────────────────────────────────────────────────────────────┘
```

### The 5 Pipeline Stages

| # | Stage | Color | Meaning | What User Sees | Action Available |
|:-:|:------|:-----:|:--------|:--------------|:----------------|
| 1 | **COBRADO** | 🟡 Yellow | Technician collected money at the job site, but no invoice created yet | Customer name, amount, time since collection | **[Crear Factura]** button |
| 2 | **FACTURAR** | 🟠 Orange | Invoice draft created, needs to be sent to AFIP | Invoice number, customer, total | **[Enviar a AFIP]** button |
| 3 | **EN AFIP** | 🔵 Blue | Invoice is in the AFIP queue being processed | Sub-status: ⏳ Cola / 🔄 Procesando / ❌ Error / 🔁 Reintentando | **[Reintentar]** on errors |
| 4 | **ENVIADA** | 🟢 Green | Invoice has CAE and was delivered to customer. Waiting for payment reconciliation | CAE number, customer, sent method (WhatsApp/PDF) | **[Registrar Pago]** button |
| 5 | **CERRADO** | ⚪ Gray | Invoice authorized + payment received + matched. Done! | Completion date, amounts matched | **[Ver detalle]** link |

### Key Design Principles

1. **Auto-advance**: Cards move between stages automatically. When AFIP gives a CAE, the card slides from "En AFIP" → "Enviada" without the user doing anything.

2. **Zero-jargon**: Don't say "CAE" or "WSFE" or "Punto de Venta" — say "Tu factura fue autorizada ✅"

3. **Action-first**: Each card has ONE primary action (the next thing to do). No dropdowns, no menus.

4. **Error surfacing**: AFIP errors show as a red badge on the card with a human-readable message, not "AFIP Error Code 10016"

5. **Totals bar**: Always show the money summary at the bottom: Por cobrar / Por facturar / Errores

---

## ⚡ Auto-Facturación: Kill the Manual Step

### The Real Magic for Oficios

The biggest simplification isn't the UI — it's **making the Factura step automatic**.

Right now:
```
Job completed → Technician collects cash → Owner manually creates invoice → Submits to AFIP
```

Proposed:
```
Job completed → Technician collects cash → System auto-creates Factura C → Auto-sends to AFIP
```

### How Auto-Facturación Works

| Trigger | Action | Conditions |
|:--------|:-------|:-----------|
| Job marked as `COMPLETED` + payment collected on mobile | System auto-creates a **Factura C** (draft) | AFIP must be configured for the organization |
| Factura C created with `asDraft = false` | System auto-submits to AFIP queue | All line items must be present |
| AFIP returns CAE | System auto-sends WhatsApp to customer with invoice | Customer has a phone number |

### Configuration Toggle

In **Configuración → Facturación**:

```
┌──────────────────────────────────────────────────────────┐
│  Facturación Automática                                  │
│                                                          │
│  ☑ Crear factura automáticamente cuando se cobra un      │
│    trabajo completado                                    │
│                                                          │
│  ☑ Enviar a AFIP automáticamente (requiere certificado)  │
│                                                          │
│  ☑ Enviar factura por WhatsApp al cliente                │
│                                                          │
│  Tipo de factura por defecto: [Factura C ▼]              │
│                                                          │
│  ⚠️ Podés cambiar estos ajustes en cualquier momento.    │
│     Las facturas ya enviadas a AFIP no se pueden anular. │
└──────────────────────────────────────────────────────────┘
```

---

## 🎯 Detail View: Expanding a Card

When a user clicks on any card in the pipeline, it expands into a **detail panel** (slide-in drawer or inline expansion) showing everything in one place:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Volver a Facturación                                              │
│                                                                      │
│ 🔧 TRABAJO: Reparación de pérdida — Pérez, Thames 1234             │
│ ──────────────────────────────────────────────────────────────────── │
│                                                                      │
│ PROGRESO DEL COBRO                                                   │
│ ═════════════════════════════════════════════                        │
│ ✅ Trabajo completado ─── 12/02/2026 14:32                          │
│ ✅ Cobro en sitio ──────── $15,730 Efectivo                         │
│ ✅ Factura creada ──────── C-00000005                               │
│ ✅ Autorizada AFIP ─────── CAE 74293817425123                       │
│ ✅ Enviada al cliente ──── WhatsApp 12/02 15:01                     │
│ ⏳ Pago registrado ─────── Pendiente                                │
│ ○  Conciliado ───────────  —                                         │
│                                                                      │
│ ──────────────────────────────────────────────────────────────────── │
│                                                                      │
│ DETALLE DE LA FACTURA                                                │
│ ├── Tipo: Factura C (Monotributo)                                   │
│ ├── Número: 0004-00000005                                           │
│ ├── Fecha: 12/02/2026                                               │
│ ├── Items:                                                           │
│ │     2hs mano de obra plomería ........... $10,000                 │
│ │     1x kit válvula ....................... $3,000                  │
│ │     IVA 21% ............................. $2,730                   │
│ │     ─────────────────────────────────────                         │
│ │     TOTAL ................................$15,730                  │
│ └── CAE: 74293817425123 (vence 22/02/2026)                          │
│                                                                      │
│ PAGOS RECIBIDOS                                                      │
│ └── (ninguno registrado aún)                                        │
│                                                                      │
│ [📄 Descargar PDF]  [📲 Reenviar WhatsApp]  [💳 Registrar Pago]    │
└──────────────────────────────────────────────────────────────────────┘
```

The **progress tracker** (vertical timeline) is the critical UI element — it answers the question _"Where is this job in the billing process?"_ at a glance, with definitions so clear that even someone who doesn't know what AFIP is can understand.

---

## 📊 Summary Stats Bar

Always visible at the top of the page:

```
┌──────────────────────────────────────────────────────────────────────┐
│  💰 $46,330         📄 1              ❌ 1              ✅ $289,100 │
│  Por cobrar         Por facturar      Errores AFIP      Cobrado     │
│  (pendiente)        (crear factura)   (requiere acción) (este mes)  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Sidebar Impact

### Before (3+ items)

```
📄 Facturas
💳 Pagos
```

### After (1 item)

```
🧾 Facturación
```

The **Cola AFIP** becomes a section _within_ the page (the "EN AFIP" pipeline column), no longer a separate page.

The **Conciliación** becomes part of the detail view, not a separate page.

The **Pagos** page becomes the "ENVIADA" and "CERRADO" columns.

---

## 🔧 Technical Implementation Plan

### Phase 1: Pipeline API

Create a new unified endpoint:

```
GET /api/billing/pipeline
```

Returns all jobs + invoices + payments grouped by pipeline stage:

```json
{
  "stages": {
    "collected": [{ "jobId": "...", "customerName": "Pérez", "amount": 15730, "collectedAt": "..." }],
    "to_invoice": [{ "invoiceId": "...", "status": "DRAFT", ... }],
    "at_afip": [{ "invoiceId": "...", "queueStatus": "pending|processing|failed", ... }],
    "delivered": [{ "invoiceId": "...", "cae": "742938...", "sentVia": "whatsapp", ... }],
    "closed": [{ "invoiceId": "...", "paymentId": "...", "matchedAt": "...", ... }]
  },
  "summary": {
    "pendingAmount": 46330,
    "toInvoiceCount": 1,
    "afipErrors": 1,
    "collectedThisMonth": 289100
  }
}
```

### Phase 2: Auto-Facturación Service

New service `auto-invoicing.service.ts`:

```
Event: Job status → COMPLETED + paymentCollectedAt is set
  → Check org has AFIP configured
  → Check org has auto-invoicing enabled
  → Create Factura C from job line items
  → Submit to AFIP queue
  → Send WhatsApp on CAE success
```

### Phase 3: Unified Page Component

Replace `/dashboard/invoices/page.tsx` and `/dashboard/payments/page.tsx` with:

```
/dashboard/billing/page.tsx       ← Pipeline view (the Kanban)
/dashboard/billing/[id]/page.tsx  ← Detail view (the timeline + actions)
```

### Phase 4: Migration

- Keep old `/dashboard/invoices` and `/dashboard/payments` routes as redirects for 30 days
- Update sidebar navigation
- Update global search integration

---

## ✅ Implementation Status

| Phase | Status | Files |
|:------|:------:|:------|
| Phase 1: Pipeline API | ✅ Done | `app/api/billing/pipeline/route.ts` |
| Phase 2: Auto-Facturación | ✅ Done | `lib/services/auto-invoicing.service.ts`, `app/api/billing/settings/route.ts` |
| Phase 3: Unified Page | ✅ Done | `app/dashboard/billing/page.tsx` |
| Phase 4: Migration | ✅ Done | Sidebar, GlobalSearch, feature-flags, field-permissions updated |

### Phase 1 & 3 Details (Implemented 2026-02-13)

**New files created:**
- `apps/web/app/api/billing/pipeline/route.ts` — Unified pipeline API
- `apps/web/app/dashboard/billing/page.tsx` — Pipeline view page

**Files modified:**
- `apps/web/app/dashboard/layout.tsx` — Sidebar: Facturas+Pagos → Facturación
- `apps/web/lib/api-client.ts` — Added `billing.pipeline()` method
- `apps/web/lib/config/feature-flags.ts` — Added billing to ALWAYS_AVAILABLE, replaced nav entries
- `apps/web/lib/config/field-permissions.ts` — Added billing module access (Owner-only)
- `apps/web/components/search/GlobalSearch.tsx` — Added billing category

**Key decisions:**
- Used card grid + detail panel (not Kanban columns) for better mobile support
- Detail panel shows as side drawer on desktop, bottom sheet on mobile
- Old routes (`/dashboard/invoices`, `/dashboard/payments`) remain accessible via direct URL
- Pipeline auto-refreshes every 30 seconds via React Query

### Phase 2 Details: Auto-Facturación (Implemented 2026-02-13)

**New files created:**
- `apps/web/lib/services/auto-invoicing.service.ts` — Core auto-invoicing service:
  - `getAutoInvoiceSettings()` / `updateAutoInvoiceSettings()` — Read/write from Organization.settings JSON
  - `tryAutoInvoice(jobId, orgId, userId)` — Fire-and-forget entry point triggered on job COMPLETED
  - Flow: Check settings → Fetch job + line items → Create Factura C → (Optional) Submit AFIP → (Optional) WhatsApp
- `apps/web/app/api/billing/settings/route.ts` — GET/PUT endpoint for auto-invoicing settings

**Files modified:**
- `apps/web/app/api/mobile/sync/route.ts` — Added `tryAutoInvoice` trigger after payment sync (exact match + overpayment paths)
- `apps/web/app/api/jobs/[id]/status/route.ts` — Added `tryAutoInvoice` trigger when job transitions to COMPLETED
- `apps/web/lib/api-client.ts` — Added `billing.settings.get()` and `billing.settings.update()` methods
- `apps/web/app/dashboard/billing/page.tsx` — Added `AutoInvoiceSettingsPanel` UI component with toggles

**Key decisions:**
- Settings stored in Organization.settings JSON field (no migration needed)
- Fire-and-forget pattern: auto-invoicing never blocks the main request flow
- Safe guards: won't create duplicate invoices, won't create for jobs without customers or line items
- When auto-AFIP fails, invoice reverts to DRAFT status for manual review
- Default invoice type: Factura C (monotributista), configurable to A or B
- WhatsApp notification reuses existing `onInvoiceCreated` trigger
- All hooks are idempotent: checking `job.invoice` exists before creating

---

## 💬 Human-Readable Status Messages

Instead of technical jargon, show these messages in the progress tracker:

| Technical Status | What We Show Instead |
|:----------------|:--------------------|
| `DRAFT` | "Factura creada — revisá los datos" |
| `PENDING_CAE` | "Enviada a AFIP, esperando autorización..." |
| `processing` (queue) | "AFIP está procesando tu factura..." |
| `completed` (queue) | "✅ Factura autorizada por AFIP" |
| `failed` (queue) | "❌ AFIP rechazó la factura — {error humano}" |
| `retrying` (queue) | "🔁 Reintentando envío a AFIP (AFIP estaba caído)" |
| `ISSUED` + WhatsApp sent | "📲 Factura enviada al cliente por WhatsApp" |
| `PAID` | "✅ Pago recibido y registrado" |
| Reconciled | "✅ Todo listo — cobro, factura y pago coinciden" |

### AFIP Error Messages (Human-Friendly)

| AFIP Error | What We Show |
|:-----------|:-------------|
| Certificate expired | "Tu certificado AFIP venció. Renoválo en Configuración → AFIP" |
| Invalid punto de venta | "El punto de venta no está habilitado. Habilitalo en afip.gob.ar" |
| Duplicate number | "Número de factura duplicado — se creará uno nuevo automáticamente" |
| AFIP server down | "Los servidores de AFIP están caídos. Se reintentará automáticamente" |

---

## 🏆 Competitive Advantage

| Feature | CampoTech | Competitor (generic ERP) |
|:--------|:---------:|:-----------------------:|
| Understand billing status at a glance | ✅ Pipeline view | ❌ Separate tables |
| Auto-create invoice from job | ✅ Auto-facturación | ❌ Manual process |
| Auto-send to AFIP | ✅ Automatic | ❌ Manual submission |
| Auto-WhatsApp invoice to customer | ✅ Automatic | ❌ Email/download |
| Human-readable AFIP errors | ✅ Plain Spanish | ❌ Error codes |
| One page for everything | ✅ Unified | ❌ 3-5 separate pages |

---

## 🔗 Connections

- **Parent:** [[Financial System Overview]]
- **Replaces:** [[Invoices Page]], [[Payments Page]], [[Invoice Queue]]
- **Related:** [[Facturas Pagos AFIP - How They Work Together]]
- **Settings:** [[AFIP Settings]], [[Auto-Facturación Settings]]

---

*A plumber should never have to think about AFIP. They fix pipes — we handle the paperwork.*
