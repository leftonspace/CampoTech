---
tags:
  - component
  - layout
  - dashboard
status: 🟢 Functional
type: Component
path: apps/web/app/dashboard/layout.tsx
---

# 📐 Dashboard Layout

> [!INFO] **Purpose**
> Main authenticated application shell containing sidebar navigation, header with user menu, trial banner, access banner, and main content area.

---

## 🧩 Layout Structure

```
┌────────────────────────────────────────────────────────────────┐
│ HEADER (h-16, sticky)                                           │
│ ├─ Mobile Menu Toggle (lg:hidden)                               │
│ ├─ Search Bar (hidden md:block)                                 │
│ └─ Right Section: Notifications | User Menu                     │
├────────────────────────────────────────────────────────────────┤
│ TRIAL BANNER (conditional - shows during trial period)          │
├────────────────────────────────────────────────────────────────┤
│ ACCESS BANNER (conditional - verification/subscription warns)   │
├────────────────────────────────────────────────────────────────┤
│ MAIN CONTENT (flex-1, p-6, overflow-auto)                       │
│ └─ Page-specific content                                        │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Sidebar Features

### Navigation Items
| Name | Route | Icon | Module |
|:---|:---|:---|:---|
| Panel | `/dashboard` | LayoutDashboard | dashboard |
| Mapa | `/dashboard/map` | MapPin | map |
| Agenda | `/dashboard/calendar` | Calendar | calendar |
| Trabajos | `/dashboard/jobs` | Briefcase | jobs |
| Clientes | `/dashboard/customers` | Users | customers |
| Equipo | `/dashboard/team` | UsersRound | team |
| Vehículos | `/dashboard/fleet` | Truck | fleet |
| Inventario | `/dashboard/inventory` | Package | inventory |
| Facturas | `/dashboard/invoices` | FileText | invoices |
| Pagos | `/dashboard/payments` | CreditCard | payments |
| Análisis | `/dashboard/analytics/overview` | BarChart3 | analytics |
| Zonas | `/dashboard/locations` | MapPin | locations |
| WhatsApp | `/dashboard/whatsapp` | MessageCircle | whatsapp |
| Configuración | `/dashboard/settings` | Settings | settings |

### Access Control
- **Role-based:** Items filtered by user role (OWNER, DISPATCHER, TECHNICIAN)
- **Tier-based:** Locked items show 🔒 icon and trigger upgrade modal
- **View-only:** Items show 👁 icon when access is restricted

### Collapsible Sidebar
- Desktop: Toggle with collapse button
- Mobile: Overlay with slide-in animation
- Collapsed width: 70px | Expanded: 260px

---

## 🔔 Banner Components

### Trial Banner
- Shows remaining trial days
- Visible when `user.organization.onTrial === true`

### Access Banner
- **Warning:** Yellow - subscription or verification alert
- **Soft Block:** Orange - important action needed
- **Hard Block:** Red - redirects to blocked page

---

## 🛠️ Technical Context

### Component Path
- **Layout:** `apps/web/app/dashboard/layout.tsx` (456 lines)

### Key Dependencies
- `ProtectedRoute` - Authentication wrapper
- `TierUpgradeModal` - Feature unlock prompts
- `NotificationCenter` - Real-time notifications
- `HelpWidget` - Floating AI support chat

---

## 🔗 Connections

- **Children:** All `/dashboard/*` pages
- **Related:**
  - [[Access Banner]] (Warning/block system)
  - [[Sidebar Navigation]] (Nav items)
  - [[User Menu]] (Top-right dropdown)

---

*Last updated: January 2026*
