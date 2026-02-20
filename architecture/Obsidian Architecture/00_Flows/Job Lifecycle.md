---
tags:
  - flow
  - operations
  - job
status: 🟢 Functional
type: User Flow
updated: 2026-02-13
---

# 🔄 Job Lifecycle

> [!SUCCESS] **Goal**
> The complete end-to-end lifecycle of a field service job — from creation through dispatch, execution, completion, invoicing, and payment collection.

---

## 📊 State Machine

```
PENDING ─────────▶ ASSIGNED ─────────▶ EN_ROUTE
  │                   │                   │
  │ [cancel]          │ [cancel]          │ [arrive]
  ▼                   ▼                   ▼
CANCELLED         CANCELLED          IN_PROGRESS
                                         │
                                         │ [complete]
                                         ▼
                                     COMPLETED ──▶ [TERMINAL STATE]
                                         │            (no edits)
                                         │
                                         ▼
                                     INVOICED ──▶ PAID
```

---

## 📋 8-Step End-to-End Platform Lifecycle

| Step | Actor | Action | Systems Involved |
|:---|:---|:---|:---|
| **1. Crear Trabajo** | Dispatcher (web) | Create job with customer, category, schedule | [[New Job Page]] |
| **2. Asignar Técnico** | Dispatcher (web) | Assign via AI dispatch or manual | [[Dispatch System]] |
| **3. En Camino** | Technician (mobile) | Start route, GPS tracking begins | [[Mobile App Architecture]] |
| **4. Confirmación** | Both | 4-digit mutual code exchange | [[Technician Verification Security]] |
| **5. En Progreso** | Technician (mobile) | Execute work, capture photos | [[Mobile Job Execution]] |
| **6. Completar** | Technician (mobile) | Mark job complete with documentation | [[Job Completion Report]] |
| **7. Cobro** | Technician (mobile) | Collect payment (Cash/MP/Transfer) | [[Mobile Cobro]] |
| **8. Factura** | Technician (mobile) | Generate + send invoice via WhatsApp | [[Invoices Page]] |

---

## 🔒 Terminal State Protection

Once a job reaches `COMPLETED` or `CANCELLED`:

| Protection | Implementation |
|:---|:---|
| **No field edits** | Server-side guards prevent modification |
| **Forensic snapshot** | Vehicle, driver, customer data frozen |
| **Payment immutability** | Amounts cannot be changed |
| **Audit trail** | All state transitions logged |

---

## 📸 Documentation at Each Stage

| Stage | Documentation |
|:---|:---|
| **Before (Arrival)** | Site photos, existing conditions |
| **During (Execution)** | Work-in-progress photos, material usage |
| **After (Completion)** | Finished work photos, customer sign-off |
| **Report** | Auto-generated PDF with all evidence |

---

## 🔗 Connections

- **Parent:** [[Jobs Page]]
- **Related Flows:**
  - [[Payment Collection Flow]]
  - [[Invoice Lifecycle]]
  - [[Dispatch System]]
  - [[Technician Verification Security]]
- **Mobile:** [[Mobile Job Execution]]

---

*A job is not complete until it's documented, invoiced, and paid.*
