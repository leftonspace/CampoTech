---
tags:
  - component
  - dashboard
  - navigation
status: 🟢 Functional
type: Component
path: apps/web/app/dashboard/page.tsx
---

# ⚡ Quick Actions

> [!TIP] **Purpose**
> Provide fast access to the most common tasks from the dashboard. Reduces clicks and improves user productivity.

---

## 📸 Preview
![[quick-actions.png]]

---

## 🧩 Action Buttons

### Current Actions

| Button | Icon | Route | Description |
|:---|:---:|:---|:---|
| **Nuevo Trabajo** | ➕ | `/dashboard/jobs/new` | Create new work order |
| **Nuevo Cliente** | 👥 | `/dashboard/customers/new` | Add new customer |
| **Agendar** | 📅 | `/dashboard/calendar` | Open calendar |
| **Nueva Factura** | 📄 | `/dashboard/invoices/new` | Create invoice |

### Visual Styling

**Primary Button (Nuevo Trabajo)**
```tsx
className="bg-emerald-500 text-white hover:bg-emerald-600"
```

**Secondary Buttons**
```tsx
className="bg-gray-50 text-gray-700 hover:bg-gray-100 border"
```

---

## 🎨 Layout

### Grid Structure
```tsx
<div className="grid grid-cols-2 gap-3">
  {actions.map(action => (
    <QuickActionButton {...action} />
  ))}
</div>
```

### Button Anatomy
```tsx
<Link
  href={href}
  className="flex flex-col items-center justify-center gap-2 rounded-lg p-4"
>
  <Icon className="h-5 w-5" />
  <span className="text-sm font-medium">{label}</span>
</Link>
```

---

## 🖱️ Interactions

| Button | Action | Result |
|:---|:---|:---|
| Nuevo Trabajo | `Click` | Navigate → [[New Job Page]] |
| Nuevo Cliente | `Click` | Navigate → [[New Customer Page]] |
| Agendar | `Click` | Navigate → [[Calendar Page]] |
| Nueva Factura | `Click` | Navigate → [[New Invoice Page]] |

---

## 📱 Responsive Behavior

| Breakpoint | Layout |
|:---|:---|
| Mobile | 2x2 grid |
| Tablet | 2x2 grid |
| Desktop | 2x2 grid (in sidebar panel) |

---

## 🔐 Access Control

| Action | OWNER | ADMIN | TECHNICIAN |
|:---|:---:|:---:|:---:|
| Nuevo Trabajo | ✓ | ✓ | ✓ |
| Nuevo Cliente | ✓ | ✓ | - |
| Agendar | ✓ | ✓ | ✓ (own) |
| Nueva Factura | ✓ | ✓ | - |

---

## 🔄 Potential Expansions

### Future Actions
| Button | Description |
|:---|:---|
| Nuevo Técnico | Add team member |
| Nuevo Vehículo | Add fleet vehicle |
| Escanear | Open barcode scanner |
| WhatsApp | Open inbox |

### Smart Suggestions
- Context-aware actions based on time of day
- Recently used actions
- AI-suggested based on patterns

---

## 🛠️ Technical Context

- **Component Location:** Inline in `apps/web/app/dashboard/page.tsx`
- **Alternative:** Could be extracted to `@/components/dashboard/QuickActions.tsx`

### Component Props
```typescript
interface QuickActionButtonProps {
  href: string;
  icon: React.ElementType;
  label: string;
  primary?: boolean;
}
```

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Targets:**
  - [[New Job Page]]
  - [[New Customer Page]]
  - [[Calendar Page]]
  - [[New Invoice Page]]

---

## 📝 Notes

- [ ] TODO: Make actions configurable per user
- [ ] TODO: Add keyboard shortcuts (Ctrl+N for new job)
- [ ] TODO: Show action tooltips with shortcuts
- [ ] Consider: Floating action button for mobile
