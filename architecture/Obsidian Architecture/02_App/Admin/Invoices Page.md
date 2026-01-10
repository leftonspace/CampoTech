---
tags:
  - page
  - app
  - billing
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/invoices/page.tsx
---

# 📄 Invoices Page (Facturas)

> [!INFO] **Purpose**
> Create and manage invoices for completed work. Integration with AFIP for electronic invoicing in Argentina.

---

## 📸 Preview
![[invoices-list.png]]

---

## 🧩 Page Structure

### Header Section
| Element | Description |
|:---|:---|
| Page Title | "Facturas" |
| Stats | Total invoiced this month |
| `+ Nueva Factura` | Primary CTA button |

### Filters Bar
| Filter | Options |
|:---|:---|
| Search | Invoice number, customer name |
| Status | Draft, Sent, Paid, Overdue, Cancelled |
| Date Range | This month, last 3 months, custom |
| Type | Factura A, B, C, Presupuesto |

### Invoices Table

| Column | Content |
|:---|:---|
| # | Invoice number (CAE for AFIP) |
| Fecha | Issue date |
| Cliente | Customer name |
| Tipo | A, B, C, or Quote |
| Total | Amount with IVA |
| Estado | Status badge |
| Vencimiento | Due date |
| Acciones | View, Download, Resend |

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| `+ Nueva Factura` | `Click` | Navigate → [[New Invoice Page]] |
| Table Row | `Click` | Navigate → [[Invoice Detail Page]] |
| Status Badge | `Click` | Quick status change (e.g., mark paid) |
| Download Icon | `Click` | Download PDF |
| WhatsApp Icon | `Click` | Send via WhatsApp |
| Email Icon | `Click` | Send via email |

---

## 🧩 Invoice Types

### AFIP Invoice Types (Argentina)
| Type | Usage | Recipient |
|:---|:---|:---|
| **Factura A** | B2B | Responsable Inscripto |
| **Factura B** | B2C | Consumidor Final, Monotributista |
| **Factura C** | Monotributista issuing | Any recipient |

### Other Documents
| Type | Description |
|:---|:---|
| Presupuesto | Quote (not fiscal) |
| Nota de Crédito | Credit note |
| Nota de Débito | Debit note |
| Recibo | Payment receipt |

---

## 🏛️ AFIP Integration

### Electronic Invoice Flow
1. Create invoice in CampoTech
2. Submit to AFIP via web service
3. Receive CAE (Código de Autorización Electrónica)
4. Generate PDF with QR code
5. Store in system

### Required Fields
- CUIT (emisor y receptor)
- Punto de Venta
- Tipo de Comprobante
- Concepto (productos/servicios)
- Fecha de emisión
- Importe total

---

## 📊 Invoice Detail Page

### Sections:
1. **Encabezado** - Invoice number, dates, customer
2. **Líneas** - Items, quantities, prices
3. **Totales** - Subtotal, IVA, total
4. **Pagos** - Payment records
5. **Historial** - Sent/viewed log

### Quick Actions:
- Mark as paid
- Send reminder
- Download PDF
- Duplicate invoice
- Create credit note

---

## 🔐 Access Control

| Role | Permissions |
|:---|:---|
| OWNER | Full invoice management |
| ADMIN | Create, view invoices |
| TECHNICIAN | View own job invoices |

---

## 🛠️ Technical Context

- **List Page:** `apps/web/app/dashboard/invoices/page.tsx`
- **New Page:** `apps/web/app/dashboard/invoices/new/page.tsx`
- **Detail Page:** `apps/web/app/dashboard/invoices/[id]/page.tsx`

### API Endpoints
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/:id` - Get details
- `PATCH /api/invoices/:id` - Update invoice
- `POST /api/invoices/:id/afip` - Submit to AFIP
- `GET /api/invoices/:id/pdf` - Download PDF

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Children:**
  - [[New Invoice Page]]
  - [[Invoice Detail Page]]
- **Related:**
  - [[Jobs Page]] (Create invoice from job)
  - [[Customers Page]] (Customer billing)
  - [[Payments Page]] (Payment tracking)
  - [[Settings - AFIP]] (AFIP configuration)

---

## 📝 Notes

- [ ] TODO: Batch invoice creation
- [ ] TODO: Recurring invoices
- [ ] TODO: Payment gateway integration
- [ ] TODO: Aging report for overdue invoices
- [ ] CRITICAL: AFIP certificate must be valid
