---
tags:
  - financial
  - moc
  - afip
  - mercadopago
status: 🟢 Functional
type: Feature Index
updated: 2026-02-13
---

# 💰 Financial System Overview

> [!SUCCESS] **Goal**
> End-to-end financial lifecycle for Argentine field service: from Quote (Presupuesto) → Work Order → Invoice (Factura) → Payment (Cobro) → AFIP Compliance. Handles multi-trade pricing, inflation indexing, on-site collection, and electronic invoicing.

---

## 🏗️ Financial Lifecycle

```
 QUOTE            JOB              INVOICE          PAYMENT
┌──────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐
│Presu-│    │ Work     │    │ Draft        │    │ Efectivo │
│puesto│──▶ │ Order    │──▶ │   ↓          │──▶ │ Mercado  │
│      │    │ (Cobro)  │    │ AFIP Queue   │    │  Pago    │
│      │    │          │    │   ↓          │    │ Transfer │
│      │    │          │    │ CAE Issued   │    │          │
└──────┘    └──────────┘    └──────────────┘    └──────────┘
                │                   │                 │
                ▼                   ▼                 ▼
          ┌──────────┐       ┌──────────┐      ┌──────────┐
          │ Pricing  │       │ AFIP     │      │ Payment  │
          │ Engine   │       │ WebSvc   │      │ Audit    │
          │          │       │ (CAE)    │      │ Trail    │
          └──────────┘       └──────────┘      └──────────┘
```

---

## 🧩 Components

### Invoicing & AFIP

| Feature | Status | Description |
|:---|:---:|:---|
| [[Invoices Page]] | 🟢 | Invoice CRUD with status tracking |
| [[AFIP Integration]] | 🟢 | Electronic invoicing — Queue → CAE → Issued |
| [[AFIP Settings]] | 🟢 | AFIP credential management (AES-256 encrypted) |
| [[Invoice Queue]] | 🟢 | Background AFIP processing with retry |
| [[Fiscal Health Monitor]] | 🟢 | AFIP compliance traffic light |

### Pricing Engine

| Feature | Status | Description |
|:---|:---:|:---|
| [[Multi-Trade Pricing]] | 🟢 | Universal pricing across all trades |
| [[Per-Visit Pricing]] | 🟢 | Sub-visit billing with material tracking |
| [[Smart Rounding]] | 🟢 | Inflation-safe rounding strategies |
| [[Pricebook Settings]] | 🟢 | Service pricing catalog management |
| [[Labor Rates Settings]] | 🟢 | UOCRA wage tier configuration |
| [[Pending Variance Page]] | 🟢 | Rounding drift detection (0.1% threshold) |

### Payments

| Feature | Status | Description |
|:---|:---:|:---|
| [[Payments Page]] | 🟢 | Payment tracking dashboard |
| [[Payment Disputes]] | 🟢 | Dispute resolution queue |
| [[Payment Reconciliation]] | 🟢 | Cross-reference payments vs invoices |
| [[MercadoPago Integration]] | 🟢 | OAuth + webhook payment processing |
| [[Mobile Cobro]] | 🟢 | On-site: Cash, MercadoPago, Transfer |

### Subscription Billing

| Feature | Status | Description |
|:---|:---:|:---|
| [[Billing Settings]] | 🟢 | Plan management + coupon system |
| [[Subscription Flow]] | 🟢 | Upgrade, downgrade, cancel, reactivate |
| [[Trial Lifecycle]] | 🟢 | 21-day trial + 3-day grace period |
| [[Exchange Rate Service]] | 🟢 | USD/ARS tracking for pricing |

---

## 📋 Invoice States

```
DRAFT (Borrador)
  ↓  [Submit to AFIP]
PENDING_CAE (En cola)
  ↓  [Background queue processing]
ISSUED (Emitida) + CAE assigned
  ↓  [Distribute]
SENT (Enviada) - via PDF / WhatsApp
  ↓  [Payment received]
PAID (Pagada):
  └── or OVERDUE (Vencida)
```

### AFIP CAE Queue

| State | Description |
|:---|:---|
| `pending` | Waiting to be processed |
| `processing` | Currently calling AFIP WebService |
| `completed` | CAE assigned, point-of-sale formatted (e.g., 0004-00000005) |
| `failed` | AFIP rejected — requires manual review |
| `retrying` | Automatic retry after transient failure |

---

## 💳 Payment Methods (Argentine Market)

| Method | Type | Flow | Verification |
|:---|:---|:---|:---|
| **Efectivo** | Cash | Technician records amount | Manual |
| **MercadoPago** | Digital | QR/Link → Customer pays → Webhook | Automatic |
| **Transferencia** | Bank | Show CBU/Alias → Transfer → Confirm | Semi-manual |

### Payment Security
- **No Float for Money:** `Decimal` types in schema (not `Float`)
- **HMAC-SHA256:** Webhook signature validation
- **Idempotency:** Duplicate payment prevention via unique keys
- **Truth Reconciliation:** Server-side amount validation (0.01 ARS threshold)
- **Audit Trail:** Every payment logged via `payment-audit-logger.ts`

---

## 🔐 AFIP Credential Security

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Encryption** | AES-256-GCM | AFIP private keys encrypted at rest |
| **Key Storage** | Environment variable | Master encryption key |
| **Access Control** | OWNER only | Only org owners can modify AFIP credentials |
| **Credential Service** | `afip-credentials.service.ts` | Encrypt/decrypt lifecycle |

---

## 📊 Financial Analytics

| Metric | Source | Description |
|:---|:---|:---|
| Revenue Today | `dashboard/stats` | Sum of today's paid invoices |
| Revenue Trend | `analytics/revenue` | Monthly revenue chart |
| Outstanding | `analytics/revenue` | Unpaid invoice total |
| Collection Rate | `analytics/operations` | % of invoices paid on time |
| Average Job Value | `analytics/operations` | Mean invoice amount |
| Top Services | `analytics/revenue` | Revenue by service type |

---

## 🛠️ Technical Context

### Key Services
| Service | Path | Purpose |
|:---|:---|:---|
| `payment-processor.ts` | `lib/services/` | MercadoPago + payment processing |
| `payment-audit-logger.ts` | `lib/services/` | Forensic payment trail |
| `pricing-calculator.ts` | `lib/services/` | Multi-trade price computation |
| `pricing-compliance.ts` | `lib/services/` | Price validation + rounding |
| `smart-rounding.ts` | `lib/services/` | Inflation-safe rounding |
| `fiscal-health.service.ts` | `lib/services/` | AFIP compliance monitoring |
| `afip-credentials.service.ts` | `lib/services/` | Encrypted credential management |
| `exchange-rate.service.ts` | `lib/services/` | USD/ARS rate tracking |
| `subscription-flows.ts` | `lib/services/` | Subscription state machine |
| `subscription-manager.ts` | `lib/services/` | Billing lifecycle |
| `subscription-cancellation.ts` | `lib/services/` | Cancel + refund logic |
| `trial-manager.ts` | `lib/services/` | Trial period management |

### Integrations
| Integration | API | Purpose |
|:---|:---|:---|
| **AFIP** | WSFE v1 | Electronic invoicing |
| **MercadoPago** | REST API + OAuth | Payment processing |
| **BCRA** | Exchange rate API | USD/ARS conversion |

---

## 🔗 Connections

- **Parent:** [[Platform Overview]]
- **Children:**
  - [[Invoices Page]], [[Payments Page]]
  - [[AFIP Settings]], [[MercadoPago Settings]]
  - [[Multi-Trade Pricing]], [[Per-Visit Pricing]]
  - [[Billing Settings]], [[Subscription Flow]]
- **Mobile:** [[Mobile Cobro]], [[Mobile Invoice Generation]]
- **Related:** [[Analytics Page]], [[Fiscal Health Monitor]], [[Job Lifecycle]]

---

## 📝 Notes & TODOs

- [x] Multi-method Cobro (Cash, MP, Transfer)
- [x] AFIP CAE queue with retry
- [x] Smart rounding with drift detection
- [x] Per-visit sub-billing
- [x] Subscription lifecycle (upgrade/downgrade/cancel)
- [x] Argentine consumer protection (Ley 24.240 arrepentimiento)
- [ ] TODO: AFIP Factura A support (for Responsable Inscripto)
- [ ] TODO: Multi-currency support (for cross-border services)
- [ ] TODO: Automatic collection reminders via WhatsApp
- [ ] TODO: Credit note (Nota de Crédito) generation
- [ ] 🔥 PROPOSAL: [[Unified Billing Hub — Design Proposal]] — Replace Facturas + Pagos + Cola AFIP with a single pipeline page

---

## 📖 Guides

- [[Facturas Pagos AFIP - How They Work Together]] — Plain-language guide explaining the 3 financial systems and full lifecycle for oficios

---

*Every peso tracked, every factura compliant — from the field to AFIP.*
