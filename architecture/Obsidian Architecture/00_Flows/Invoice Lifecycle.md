---
tags:
  - flow
  - financial
  - invoice
  - afip
status: 🟢 Functional
type: User Flow
updated: 2026-02-13
---

# 📄 Invoice Lifecycle

> [!SUCCESS] **Goal**
> From draft creation to AFIP CAE issuance, distribution via WhatsApp, and payment tracking.

---

## 📊 State Machine

```
DRAFT (Borrador)
  │
  │  [Submit to AFIP]
  ▼
PENDING_CAE (En cola)
  │
  │  [Background processing]
  │  [Auto-retry on failure]
  ▼
ISSUED (Emitida)
  │  CAE assigned: 0004-00000005
  │
  │  [Distribute]
  ▼
SENT (Enviada)
  │  via PDF download
  │  via WhatsApp message
  │
  ├──▶ PAID (Pagada)         ← Payment received
  │
  └──▶ OVERDUE (Vencida)     ← Past due date
```

---

## 🏛️ AFIP Integration

### CAE Issuance Queue

| State | Description | Auto-Action |
|:---|:---|:---|
| `pending` | Waiting in queue | Processed within 30s |
| `processing` | Calling AFIP WSFE | — |
| `completed` | CAE assigned | Invoice marked ISSUED |
| `failed` | AFIP rejected | Alert + manual review |
| `retrying` | Transient failure | Auto-retry with backoff |

### Invoice Types

| Type | Condition | Tax Treatment |
|:---|:---|:---|
| **Factura C** | Monotributo (small taxpayer) | No IVA discrimination |
| **Factura B** | Responsable Inscripto → Consumer | IVA included |
| **Factura A** | Responsable Inscripto → RI | IVA discriminated |

### Point of Sale Format
`PPPP-NNNNNNNN` (e.g., `0004-00000005`)
- PPPP: Point of sale number (assigned by AFIP)
- NNNNNNNN: Sequential invoice number

---

## 📱 Distribution

| Channel | Method | Automation |
|:---|:---|:---|
| **PDF Download** | Generate in browser | Manual |
| **WhatsApp** | Send via WhatsApp message with PDF | 1-click from mobile |
| **Email** | Future planned | ⚪ Planned |

---

## 🔗 Connections

- **Parent:** [[Job Lifecycle]]
- **Previous:** [[Payment Collection Flow]]
- **Related:** [[Invoices Page]], [[AFIP Settings]], [[Financial System Overview]]

---

*Every factura is legally compliant — from draft to AFIP-stamped CAE.*
