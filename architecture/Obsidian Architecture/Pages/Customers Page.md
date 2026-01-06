---
tags:
  - page
  - app
  - core
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/customers/page.tsx
---

# 👥 Customers Page (Clientes)

> [!INFO] **Purpose**
> Customer relationship management for service businesses. Track contact info, service history, and notes for each client.

---

## 📸 Preview
![[customers-list.png]]

---

## 🧩 Page Structure

### Header Section
| Element | Description |
|:---|:---|
| Page Title | "Clientes" |
| Customer Count | Total customers |
| `+ Nuevo Cliente` | Primary CTA button |

### Filters Bar
| Filter | Options |
|:---|:---|
| Search | Name, phone, email, CUIT |
| Status | Active, Inactive |
| Type | Residential, Commercial |
| Zone | Service zone dropdown |

### Customers Table

| Column | Content |
|:---|:---|
| Nombre | Customer name |
| Contacto | Phone + email |
| Dirección | Primary address |
| CUIT | Tax ID (if business) |
| Trabajos | Count of jobs |
| Último Servicio | Date of last job |
| Acciones | View, Edit, Delete |

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| `+ Nuevo Cliente` | `Click` | Navigate → [[New Customer Page]] |
| Table Row | `Click` | Navigate → [[Customer Detail Page]] |
| Search | `Type` | Live filter |
| Phone Number | `Click` | Open WhatsApp/phone app |
| Email | `Click` | Open mail client |

---

## 🧩 Customer Detail Page

### Sections:
1. **Contact Info** - Name, phone, email, addresses
2. **Service History** - Timeline of all jobs
3. **Equipment** - Registered equipment (AC units, etc.)
4. **Notes** - Internal notes about customer
5. **Documents** - Uploaded files (contracts, warranties)

### Quick Actions:
- Create new job for this customer
- Send WhatsApp message
- Export customer data

---

## 🔐 Access Control

| Role | Permissions |
|:---|:---|
| OWNER | All customers, full access |
| ADMIN | View, edit customers |
| TECHNICIAN | View assigned customers only |

---

## 🛠️ Technical Context

- **List Page:** `apps/web/app/dashboard/customers/page.tsx`
- **New Page:** `apps/web/app/dashboard/customers/new/page.tsx`
- **Detail Page:** `apps/web/app/dashboard/customers/[id]/page.tsx`

### API Endpoints
- `GET /api/customers` - List with filters
- `POST /api/customers` - Create new
- `GET /api/customers/:id` - Get details
- `PATCH /api/customers/:id` - Update
- `DELETE /api/customers/:id` - Delete

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Children:**
  - [[New Customer Page]]
  - [[Customer Detail Page]]
- **Related:**
  - [[Jobs Page]] (Create job from customer)
  - [[Invoices Page]] (Customer billing)
  - [[WhatsApp Page]] (Customer communication)

---

## 📝 Notes

- [ ] TODO: Import customers from CSV
- [ ] TODO: Merge duplicate customers
- [ ] TODO: Customer portal (future)
- [ ] AFIP: CUIT validation integration
