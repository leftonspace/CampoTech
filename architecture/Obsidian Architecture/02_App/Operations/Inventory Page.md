---
tags:
  - page
  - app
  - inventory
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/inventory/page.tsx
---

# 📦 Inventory Page (Inventario)

> [!INFO] **Purpose**
> Track parts, materials, and equipment used in service jobs. Manage stock levels, costs, and supplier information.

---

## 📸 Preview
![[inventory-list.png]]

---

## 🧩 Page Structure

### Header Section
| Element | Description |
|:---|:---|
| Page Title | "Inventario" |
| Item Count | Total items |
| `+ Nuevo Artículo` | Primary CTA button |

### Filters Bar
| Filter | Options |
|:---|:---|
| Search | Name, SKU, barcode |
| Category | Parts, Materials, Tools, Equipment |
| Stock Status | All, Low Stock, Out of Stock |
| Warehouse | Location dropdown |

### Inventory Table

| Column | Content |
|:---|:---|
| SKU | Stock keeping unit |
| Nombre | Item name |
| Categoría | Category tag |
| Stock | Current quantity |
| Mín | Reorder threshold |
| Costo | Unit cost |
| Precio | Sell price |
| Ubicación | Warehouse/location |
| Acciones | View, Edit, Adjust |

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| `+ Nuevo Artículo` | `Click` | Navigate → [[New Item Page]] |
| Table Row | `Click` | Navigate → [[Item Detail Page]] |
| Stock Number | `Click` | Open adjustment modal |
| Low Stock Badge | `Hover` | Show reorder suggestion |
| Export | `Click` | Download CSV |

---

## 🧩 Item Detail Page

### Sections:
1. **Información** - Name, SKU, description, photos
2. **Stock** - Current levels, history chart
3. **Movimientos** - Stock adjustments log
4. **Proveedores** - Linked suppliers
5. **Uso en Trabajos** - Jobs using this item

### Quick Actions:
- Adjust stock (+/-)
- Create purchase order
- View usage history

---

## 📊 Stock Movements

### Movement Types:
| Type | Description |
|:---|:---|
| `IN` | Purchase received |
| `OUT` | Used in job |
| `ADJUST` | Manual adjustment |
| `TRANSFER` | Move between locations |
| `RETURN` | Customer return |

### Stock Adjustment Modal:
- Quantity (+/-)
- Reason dropdown
- Notes field
- Job link (if applicable)

---

## ⚠️ Alerts

### Low Stock Alert
- Item falls below minimum threshold
- Shows in dashboard notifications
- Optional: Auto-create purchase order

### Stock Value Report
- Total inventory value
- Cost analysis by category
- Slow-moving items

---

## 🔐 Access Control

| Role | Permissions |
|:---|:---|
| OWNER | Full inventory management |
| ADMIN | View, adjust stock |
| TECHNICIAN | View assigned items, log usage |

---

## 🛠️ Technical Context

- **List Page:** `apps/web/app/dashboard/inventory/page.tsx`
- **Detail Page:** `apps/web/app/dashboard/inventory/[id]/page.tsx`

### API Endpoints
- `GET /api/inventory` - List items
- `POST /api/inventory` - Create item
- `GET /api/inventory/:id` - Get details
- `PATCH /api/inventory/:id` - Update item
- `POST /api/inventory/:id/adjustments` - Stock adjustment
- `GET /api/inventory/low-stock` - Low stock alert

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Children:**
  - [[New Item Page]]
  - [[Item Detail Page]]
  - [[Purchase Orders]]
- **Related:**
  - [[Jobs Page]] (Material usage)
  - [[Invoices Page]] (Billable materials)
  - [[Analytics Page]] (Inventory reports)

---

## 📝 Notes

- [ ] TODO: Barcode scanning support
- [ ] TODO: Multi-warehouse support
- [ ] TODO: Supplier integration
- [ ] TODO: Mobile stocktake feature
- [ ] Consider: Serial number tracking for equipment
