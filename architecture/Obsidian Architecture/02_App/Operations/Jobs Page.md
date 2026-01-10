---
tags:
  - page
  - app
  - core
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/jobs/page.tsx
---

# 💼 Jobs Page (Trabajos)

> [!SUCCESS] **Purpose**
> Central hub for managing all work orders. View, filter, create, and track jobs from initial request through completion.

---

## 📸 Preview
![[jobs-list.png]]

---

## 🧩 Page Structure

### Header Section
| Element | Description |
|:---|:---|
| Page Title | "Trabajos" |
| Job Count | Total active jobs |
| `+ Nuevo Trabajo` | Primary CTA button |

### Filters Bar
| Filter | Options |
|:---|:---|
| Status | All, Pending, Assigned, In Progress, Completed, Cancelled |
| Date Range | Today, This Week, This Month, Custom |
| Technician | Dropdown of team members |
| Urgency | All, Urgent, High, Normal, Low |
| Search | Job number, customer name |

### Jobs Table

| Column | Content |
|:---|:---|
| # | Job number (e.g., TRB-00234) |
| Cliente | Customer name + address preview |
| Servicio | Service type label |
| Técnico | Assigned technician or "Sin asignar" |
| Estado | Status badge |
| Urgencia | Urgency badge |
| Fecha | Scheduled date/time |
| Acciones | View, Edit, Delete dropdown |

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| `+ Nuevo Trabajo` | `Click` | Navigate → [[New Job Page]] |
| Table Row | `Click` | Navigate → [[Job Detail Page]] |
| Status Filter | `Change` | Filter table by status |
| Search | `Type` | Live filter by text |
| Pagination | `Click` | Load next/prev page |
| Actions → Edit | `Click` | Navigate → Edit job page |
| Actions → Delete | `Click` | Confirm dialog → Delete job |

---

## 📊 Status Flow

```
PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED
                  ↘ CANCELLED ↙
```

---

## 🔐 Access Control

| Role | Permissions |
|:---|:---|
| OWNER | All jobs, create, edit, delete |
| ADMIN | Managed technicians' jobs |
| TECHNICIAN | Own assigned jobs only |

---

## 🛠️ Technical Context

- **List Page:** `apps/web/app/dashboard/jobs/page.tsx`
- **New Page:** `apps/web/app/dashboard/jobs/new/page.tsx`
- **Detail Page:** `apps/web/app/dashboard/jobs/[id]/page.tsx`

### API Endpoints
- `GET /api/jobs` - List with filters
- `POST /api/jobs` - Create new
- `GET /api/jobs/:id` - Get details
- `PATCH /api/jobs/:id` - Update
- `DELETE /api/jobs/:id` - Delete

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Children:**
  - [[New Job Page]]
  - [[Job Detail Page]]
- **Related:**
  - [[Calendar Page]] (Job scheduling)
  - [[Customers Page]] (Customer link)
  - [[Team Page]] (Technician assignment)

---

## 📝 Notes

- [ ] TODO: Add bulk actions (assign, reschedule)
- [ ] TODO: Export to CSV/PDF
- [ ] TODO: Job templates for common services
