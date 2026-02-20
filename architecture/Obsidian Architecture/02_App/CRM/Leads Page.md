---
tags:
  - page
  - app
  - leads
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/leads/page.tsx
updated: 2026-02-13
---

# 📥 Leads Page

> [!SUCCESS] **Goal**
> Manage the pipeline of potential customers — from marketplace inquiries and WhatsApp contacts to converted paying clients.

---

## 🧩 Page Components

### Stats Bar
| Metric | Description |
|:---|:---|
| Nuevos | New leads this period |
| En seguimiento | Leads being actively followed |
| Convertidos | Successfully converted to customers |
| Perdidos | Lost/closed leads |

### Lead Table
| Column | Content |
|:---|:---|
| Nombre | Lead name & contact |
| Fuente | Source: Marketplace, WhatsApp, Manual, Referral |
| Categoría | Service type requested |
| Estado | Pipeline stage (Nuevo, Contactado, Presupuesto, Ganado, Perdido) |
| Fecha | Creation date |
| Valor | Estimated job value |
| Acciones | View, contact, convert |

### Pipeline View
- Kanban-style board with drag-and-drop
- Columns: Nuevo → Contactado → Presupuesto Enviado → Ganado / Perdido

---

## 📊 Sub-Pages

| Page | Route | Description |
|:---|:---|:---|
| [[Lead Detail]] | `/leads/[id]` | Individual lead management |
| [[Lead Analytics]] | `/leads/analytics` | Source analysis + conversion rates |
| [[Lead Settings]] | `/leads/settings` | Pipeline stage configuration |

---

## 🔐 Access Control

| Role | Access |
|:---|:---|
| OWNER | ✅ Full lead management |
| ADMIN | ✅ Full lead management |
| TECHNICIAN | ❌ No access |

**Tier Requirement:** INICIAL or higher

---

## 🔗 Connections

- **Parent:** [[Sidebar Navigation]]
- **Converts To:** [[Customers Page]]
- **Sources:** [[Marketplace Smart Matching]], [[WhatsApp Page]], [[Public AI Chat]]
- **Related:** [[Growth Engine]]

---

*Every marketplace view, every WhatsApp message — a potential customer awaiting conversion.*
