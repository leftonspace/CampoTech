---
tags:
  - component
  - access
  - subscription
status: 🟢 Functional
type: Component
path: apps/web/components/access/AccessBanner.tsx
---

# ⚠️ Access Banner

> [!WARNING] **Purpose**
> Displays banners for access restrictions based on subscription and verification status. Shows warnings, soft blocks, and hard blocks with appropriate actions.

---

## 🎨 Banner Severity Levels

| Level | Style | Dismissible | Use Case |
|:---|:---|:---:|:---|
| **Warning** | Yellow gradient | ✅ | Subscription expiring, verification reminder |
| **Soft Block** | Orange gradient | ✅ | Action needed but not blocking |
| **Hard Block** | Dark gradient | ❌ | Redirects to `/blocked` |

---

## 🔧 Banner Types

| Type | Icon | Description |
|:---|:---|:---|
| `subscription` | 💳 CreditCard | Subscription-related issues |
| `verification` | 📄 FileCheck | Identity/CUIT verification needed |
| `compliance` | 🛡 Shield | Legal/compliance requirements |

---

## 🧩 Component Props

```typescript
interface AccessBannerProps {
  className?: string;
  redirectOnHardBlock?: boolean;      // Default: true
  hardBlockRedirectUrl?: string;      // Default: '/blocked'
  showAllWarnings?: boolean;          // Default: false
}
```

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| Action Button | `Click` | Navigate to resolution page |
| Dismiss Button | `Click` | Hide banner (stored in sessionStorage) |
| Hard Block | Automatic | Redirect to blocked page |

---

## 🛠️ Technical Context

### Component Files
- **Main:** `apps/web/components/access/AccessBanner.tsx` (290 lines)
- **Export:** `apps/web/components/access/index.ts`

### Sub-components
- `BannerItem` - Individual banner display
- `AccessWarningBadge` - Simple badge indicator

### Integration
Used in `app/dashboard/layout.tsx`:
```tsx
<AccessBanner className="px-6 pt-4" />
```

---

## 🔗 Connections

- **Parent:** [[Dashboard Layout]]
- **Related:**
  - [[Trial Banner]] (Separate trial-specific banner)
  - [[Tier Upgrade Modal]] (Feature unlock prompts)

---

*Last updated: January 2026*
