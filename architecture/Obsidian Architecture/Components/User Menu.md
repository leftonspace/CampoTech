---
tags:
  - component
  - navigation
  - user
status: 🟢 Functional
type: Component
path: apps/web/app/dashboard/layout.tsx
---

# 👤 User Menu

> [!INFO] **Purpose**
> The user menu provides quick access to account settings, billing, and session management. It appears in the top-right corner of the dashboard header.

---

## 📸 Preview
![[user-menu-dropdown.png]]

---

## 🧩 Menu Structure

### Header Section
| Element | Content |
|:---|:---|
| Avatar | User initials on primary color circle |
| Name | `{user.name}` |
| Role | `{user.role}` (capitalized) |
| Chevron | Dropdown indicator |

### Menu Items

| Item | Route | Description |
|:---|:---|:---|
| **Mi Cuenta** | (Header label) | Section divider |
| Perfil | `/dashboard/profile` | Personal information & preferences |
| Facturación | `/dashboard/settings/billing` | Subscription & payment history |
| Configuración | `/dashboard/settings` | Organization settings |
| **Cerrar Sesión** | (Action) | End current session |

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| Avatar/Name | `Click` | Toggle dropdown |
| Outside Click | `Click` | Close dropdown |
| Perfil | `Click` | Navigate → [[Profile Page]] |
| Facturación | `Click` | Navigate → [[Billing Settings]] |
| Configuración | `Click` | Navigate → [[Settings Page]] |
| Cerrar Sesión | `Click` | `logout()` → [[Login Flow]] |

---

## 🎨 Styling

### Dropdown Container
```tsx
className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-card shadow-lg z-50 animate-scale-in"
```

### Menu Item
```tsx
className="block px-3 py-2 text-sm rounded-md hover:bg-muted"
```

### Logout Button (Destructive)
```tsx
className="w-full text-left px-3 py-2 text-sm rounded-md text-destructive hover:bg-destructive/10"
```

---

## 📱 Responsive Behavior

| Breakpoint | Behavior |
|:---|:---|
| Mobile | Avatar only (name/role hidden) |
| `≥ md` | Full display with name, role, chevron |

---

## 🛠️ Technical Context

- **Component Location:** Inline in `apps/web/app/dashboard/layout.tsx`
- **Auth Hook:** `useAuth()` from `@/lib/auth-context`
- **Click Outside:** Uses `useRef` and `useEffect` for document click handler

### State Management
```typescript
const [userMenuOpen, setUserMenuOpen] = useState(false);
const userMenuRef = useRef<HTMLDivElement>(null);
```

---

## 🔗 Connections

- **Parent:** [[Dashboard Layout]]
- **Children:**
  - [[Profile Page]]
  - [[Billing Settings]]
  - [[Settings Page]]
- **Related:**
  - [[Login Flow]] (on logout)
  - [[Auth Context]]

---

## 📝 Notes

- [ ] TODO: Add user avatar image support (currently initials only)
- [ ] Consider: Adding "Help" or "Support" link
- [ ] Consider: Showing subscription tier badge
