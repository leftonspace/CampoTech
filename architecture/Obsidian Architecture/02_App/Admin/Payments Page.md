---
tags:
  - page
  - app
  - billing
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/payments/page.tsx
---

# 💳 Payments Page (Pagos)

> [!INFO] **Purpose**
> Track incoming payments from customers and manage payment methods. View payment history and outstanding balances.

---

## 📸 Preview
![[payments-list.png]]

---

## 🧩 Page Structure

### Header Section
| Element | Description |
|:---|:---|
| Page Title | "Pagos" |
| Stats Summary | Today's payments, pending amount |
| `+ Registrar Pago` | Primary CTA button |

### Summary Cards
| Card | Content |
|:---|:---|
| Cobrado Hoy | Amount received today |
| Pendiente | Total outstanding |
| Este Mes | Monthly collection |
| Promedio | Average invoice value |

### Filters Bar
| Filter | Options |
|:---|:---|
| Search | Payment ID, customer, invoice |
| Status | All, Completed, Pending, Failed |
| Method | Cash, Transfer, MercadoPago, Card |
| Date Range | Today, week, month, custom |

### Payments Table

| Column | Content |
|:---|:---|
| # | Payment ID |
| Fecha | Payment date |
| Cliente | Customer name |
| Factura | Linked invoice |
| Método | Payment method icon |
| Monto | Amount |
| Estado | Status badge |

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| `+ Registrar Pago` | `Click` | Open payment form modal |
| Table Row | `Click` | View payment details |
| Invoice Link | `Click` | Navigate → [[Invoice Detail Page]] |
| Export | `Click` | Download CSV/PDF |
| Receipt Icon | `Click` | Download/print receipt |

---

## 💰 Payment Methods

### Supported Methods
| Method | Icon | Processing |
|:---|:---:|:---|
| Efectivo | 💵 | Manual entry |
| Transferencia | 🏦 | Manual confirmation |
| MercadoPago | 🔵 | Automatic via API |
| Tarjeta | 💳 | Via MercadoPago |
| Cheque | 📝 | Manual entry |

### MercadoPago Integration
- Real-time payment notifications
- QR code payment support
- Split payments (marketplace model)
- Automatic reconciliation

---

## 📊 Payment Recording

### Manual Payment Form
| Field | Type | Required |
|:---|:---|:---:|
| Cliente | Autocomplete | ✓ |
| Factura | Select from pending | ✓ |
| Monto | Number | ✓ |
| Método | Dropdown | ✓ |
| Fecha | Date picker | ✓ |
| Referencia | Text | ○ |
| Notas | Textarea | ○ |

### Partial Payments
- Allow paying less than invoice total
- Track remaining balance
- Multiple payments per invoice

---

## 🔐 Access Control

| Role | Permissions |
|:---|:---|
| OWNER | Full payment management |
| ADMIN | Record and view payments |
| TECHNICIAN | View related payments only |

---

## 🛠️ Technical Context

- **List Page:** `apps/web/app/dashboard/payments/page.tsx`
- **Detail Page:** `apps/web/app/dashboard/payments/[id]/page.tsx`

### API Endpoints
- `GET /api/payments` - List payments
- `POST /api/payments` - Record payment
- `GET /api/payments/:id` - Get details
- `PATCH /api/payments/:id` - Update payment
- `GET /api/payments/summary` - Dashboard stats

### MercadoPago Webhooks
- `POST /api/webhooks/mercadopago` - Payment notifications

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Children:**
  - [[Payment Detail Page]]
  - [[Payment Report]]
- **Related:**
  - [[Invoices Page]] (Linked invoices)
  - [[Customers Page]] (Customer balance)
  - [[Analytics Page]] (Revenue reports)
  - [[Settings - MercadoPago]] (Integration config)

---

## 📝 Notes

- [ ] TODO: Automated payment reminders
- [ ] TODO: Payment plan support
- [ ] TODO: Multiple currency support
- [ ] TODO: Bank reconciliation import
- [ ] Consider: Technician field collection feature
