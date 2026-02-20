---
tags:
  - flow
  - financial
  - cobro
status: 🟢 Functional
type: User Flow
updated: 2026-02-13
---

# 💰 Payment Collection Flow (Cobro)

> [!SUCCESS] **Goal**
> On-site payment collection by the technician at job completion. Supports Argentine market realities: cash is king, MercadoPago is growing, bank transfers are common.

---

## 🔄 Flow Diagram

```
Job COMPLETED
     │
     ▼
┌──────────────────────┐
│   COBRO SCREEN       │
│   (Mobile App)       │
│                      │
│   ┌───────────────┐  │
│   │  Efectivo     │──┼──▶ Record amount → Done
│   └───────────────┘  │
│   ┌───────────────┐  │
│   │  MercadoPago  │──┼──▶ Generate QR/Link → Customer pays
│   └───────────────┘  │        → Webhook confirms → Done
│   ┌───────────────┐  │
│   │  Transfer     │──┼──▶ Show CBU/Alias → Customer transfers
│   └───────────────┘  │        → Manual confirmation → Done
│                      │
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│   POST-PAYMENT       │
│   ┌────────────────┐ │
│   │ Record Payment │ │
│   │ Audit Trail    │ │
│   │ Invoice Gen    │ │
│   │ WhatsApp Send  │ │
│   └────────────────┘ │
└──────────────────────┘
```

---

## 💳 Payment Methods

### Efectivo (Cash)
- Technician records amount received
- No digital verification — trust-based
- Most common method in Argentine field service

### MercadoPago (Digital)
- Generate QR code or payment link
- Customer scans/clicks and pays
- Webhook confirms payment automatically
- HMAC-SHA256 signature validation

### Transferencia Bancaria (Bank Transfer)
- Technician displays organization CBU/Alias
- Customer initiates bank transfer
- Semi-manual confirmation (tech marks as received)
- Transferencia 3.0 compatible

---

## 🔐 Security

| Control | Implementation |
|:---|:---|
| **Decimal precision** | `Decimal(10,2)` in schema — no floats |
| **Truth reconciliation** | Server validates amounts (0.01 ARS threshold) |
| **Idempotency** | Unique payment keys prevent duplicates |
| **Audit trail** | `payment-audit-logger.ts` records every action |
| **Sync audit** | `SyncOperation` tracks mobile → server sync |

---

## 🔗 Connections

- **Parent:** [[Job Lifecycle]]
- **Mobile Screen:** [[Mobile Cobro]]
- **Related:** [[Payments Page]], [[Financial System Overview]]
- **Next Step:** [[Invoice Lifecycle]]

---

*Cobro is where the digital meets the physical — designed for one-handed use in an Argentine living room.*
