---
tags:
  - page
  - app
  - fleet
status: 🟡 In Progress
type: Application Page
path: apps/web/app/dashboard/fleet/page.tsx
---

# 🚚 Fleet Page (Vehículos)

> [!INFO] **Purpose**
> Vehicle fleet management for service companies. Track maintenance, fuel, assignments, and location for each vehicle.

---

## 📸 Preview
![[fleet-list.png]]

---

## 🧩 Page Structure

### Header Section
| Element | Description |
|:---|:---|
| Page Title | "Vehículos" |
| Vehicle Count | Active vehicles |
| `+ Agregar Vehículo` | Primary CTA button |

### Filters Bar
| Filter | Options |
|:---|:---|
| Status | All, Active, In Maintenance, Out of Service |
| Assigned To | Technician dropdown |
| Type | Car, Van, Truck, Motorcycle |

### Vehicles Table/Grid

| Column | Content |
|:---|:---|
| Patente | License plate |
| Modelo | Make/Model/Year |
| Asignado | Technician name |
| Estado | Status badge |
| Km | Current odometer |
| Próx. Service | Next maintenance date |
| Acciones | View, Edit, Maintenance |

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| `+ Agregar Vehículo` | `Click` | Open add vehicle form |
| Vehicle Row | `Click` | Navigate → [[Vehicle Detail Page]] |
| Maintenance Icon | `Click` | Log maintenance entry |
| Location Icon | `Click` | Show on map (if GPS equipped) |

---

## 🧩 Vehicle Detail Page

### Sections:
1. **Info General** - Make, model, year, plate, VIN
2. **Asignación** - Current technician, history
3. **Mantenimiento** - Service history, scheduled
4. **Combustible** - Fuel log entries
5. **Documentos** - Insurance, registration, photos

### Quick Actions:
- Assign to technician
- Log fuel fill-up
- Schedule maintenance
- Report issue

---

## 🔧 Maintenance Tracking

### Maintenance Types:
- Oil change
- Tire rotation
- Brake inspection
- General service
- Repair

### Maintenance Alerts:
- 🔴 Overdue maintenance
- 🟡 Due within 500km or 7 days
- 🟢 Up to date

---

## 🔐 Access Control

| Role | Permissions |
|:---|:---|
| OWNER | Full fleet management |
| ADMIN | View, assign vehicles |
| TECHNICIAN | View assigned vehicle only |

---

## 🛠️ Technical Context

- **List Page:** `apps/web/app/dashboard/fleet/page.tsx`
- **Detail Page:** `apps/web/app/dashboard/fleet/[id]/page.tsx`

### API Endpoints
- `GET /api/fleet` - List vehicles
- `POST /api/fleet` - Add vehicle
- `GET /api/fleet/:id` - Get details
- `PATCH /api/fleet/:id` - Update vehicle
- `POST /api/fleet/:id/maintenance` - Log maintenance
- `POST /api/fleet/:id/fuel` - Log fuel

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Children:**
  - [[Vehicle Detail Page]]
  - [[Maintenance Log]]
- **Related:**
  - [[Team Page]] (Vehicle assignments)
  - [[Map View]] (Vehicle locations)
  - [[Analytics Page]] (Fleet costs)

---

## 📝 Notes

- [ ] TODO: GPS integration for live tracking
- [ ] TODO: Fuel cost reporting
- [ ] TODO: Insurance expiration alerts
- [ ] TODO: Mobile app for quick fuel/maintenance logging
- [ ] Consider: OBD-II integration for diagnostics
