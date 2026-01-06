---
tags:
  - component
  - navigation
  - core
status: 🟢 Functional
type: Component
path: apps/web/app/dashboard/layout.tsx
---

# 🧭 Sidebar Navigation

> [!INFO] **Purpose**
> The sidebar is the primary navigation hub for the CampoTech dashboard. It provides access to all modules and adapts based on user role and subscription tier.

---

## 📸 Preview
![[sidebar-navigation.png]]

---

## 🗂️ Navigation Structure

### Main Navigation (Top Section)
| Icon | Name | Route | Module Key |
|:---:|:---|:---|:---|
| 📊 | Panel | `/dashboard` | `dashboard` |
| 📍 | Mapa | `/dashboard/map` | `map` |
| 📅 | Agenda | `/dashboard/calendar` | `calendar` |
| 💼 | Trabajos | `/dashboard/jobs` | `jobs` |
| 👥 | Clientes | `/dashboard/customers` | `customers` |
| 👨‍👩‍👧‍👦 | Equipo | `/dashboard/team` | `team` |
| 🚚 | Vehículos | `/dashboard/fleet` | `fleet` |
| 📦 | Inventario | `/dashboard/inventory` | `inventory` |
| 📄 | Facturas | `/dashboard/invoices` | `invoices` |
| 💳 | Pagos | `/dashboard/payments` | `payments` |
| 📈 | Análisis | `/dashboard/analytics/overview` | `analytics` |
| 🗺️ | Zonas | `/dashboard/locations` | `locations` |
| 💬 | WhatsApp | `/dashboard/whatsapp` | `whatsapp` |

### Bottom Navigation (Fixed)
| Icon | Name | Route | Module Key |
|:---:|:---|:---|:---|
| ⚙️ | Configuración | `/dashboard/settings` | `settings` |
| ◀️ | Colapsar | (Toggle action) | - |

---

## 🔐 Access Control

### Role-Based Visibility
Items are filtered based on `MODULE_ACCESS[module][role]`:
- `hidden` → Not rendered
- `view` → Shown with 👁️ eye icon
- `own` → Access to own records only
- `edit` → Full editing access
- `full` → Complete control

### Tier-Based Locking
Premium modules show 🔒 lock icon when tier is insufficient:
```typescript
const TIER_GATED_MODULES = {
  'whatsapp': 'WHATSAPP_AI',
  'analytics': 'ADVANCED_REPORTS',
  // ...
}
```

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| Nav Item | `Click` | Navigate to route |
| Locked Item | `Click` | Open [[Tier Upgrade Modal]] |
| Colapsar | `Click` | Toggle sidebar width (260px ↔ 70px) |
| Mobile Menu | `Click` | Toggle sidebar overlay |
| User Avatar | `Click` | Open user dropdown |
| Logout | `Click` | Clear session → [[Login Flow]] |

---

## 🎨 States

### Active State
```tsx
className="bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
```

### Hover State
```tsx
className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
```

### Collapsed State
- Width: `70px` (vs `260px` expanded)
- Labels hidden, only icons visible
- User info hidden except avatar

---

## 📱 Responsive Behavior

| Breakpoint | Behavior |
|:---|:---|
| `< lg` | Sidebar hidden, overlay on mobile menu click |
| `≥ lg` | Sidebar fixed, collapsible |

---

## 🛠️ Technical Context

- **Component Path:** `apps/web/app/dashboard/layout.tsx`
- **Access Config:** `lib/config/field-permissions.ts`
- **Feature Flags:** `lib/config/feature-flags.ts`
- **Tier Limits:** `lib/config/tier-limits.ts`

---

## 🔗 Connections

- **Parent:** [[Dashboard Layout]]
- **Children:** All dashboard pages
- **Related:** 
  - [[Tier Upgrade Modal]]
  - [[User Menu]]
  - [[Role Permissions]]

---

## 📝 Notes

- [ ] TODO: Add keyboard navigation support
- [ ] TODO: Remember collapsed state in localStorage
- [ ] Consider: Badge indicators for notifications per module
