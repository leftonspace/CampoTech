---
tags:
  - component
  - banner
  - billing
status: 🟢 Functional
type: Component
path: apps/web/components/billing/TrialBanner.tsx
---

# ⏳ Trial Banner

> [!WARNING] **Purpose**
> Display prominent notification about trial status, remaining days, and upgrade CTA. Helps convert trial users to paid subscribers.

---

## 📸 Preview
![[trial-banner.png]]

---

## 🧩 Banner Variants

### Active Trial (Normal)
| Color | When |
|:---|:---|
| 🟢 Green | > 7 days remaining |
| 🟡 Yellow | 3-7 days remaining |
| 🔴 Red | < 3 days remaining |

### Content Structure
```
[Icon] Tu período de prueba vence en X días. [Actualizar Plan →]
```

---

## 🎨 Style Variants

### Green (Safe)
```tsx
className="bg-emerald-50 border-emerald-200 text-emerald-800"
```

### Yellow (Warning)
```tsx
className="bg-yellow-50 border-yellow-200 text-yellow-800"
```

### Red (Urgent)
```tsx
className="bg-red-50 border-red-200 text-red-800"
```

---

## 📊 Display Logic

### Show Conditions
```typescript
const shouldShow = 
  subscription?.status === 'trialing' && 
  daysRemaining <= 21;
```

### Color Selection
```typescript
const bannerColor = 
  daysRemaining <= 3 ? 'red' :
  daysRemaining <= 7 ? 'yellow' :
  'green';
```

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| Banner | `Hover` | Slight shadow |
| "Actualizar Plan" | `Click` | Navigate → [[Billing Settings]] |
| X (Dismiss) | `Click` | Hide for session |

---

## 📍 Placement

Located in `DashboardLayout`:
```tsx
<header>...</header>
<TrialBannerWithFetch />  {/* Here */}
<AccessBanner />
<main>...</main>
```

---

## 🛠️ Technical Context

- **Component Path:** `apps/web/components/billing/TrialBanner.tsx`
- **Wrapper:** `TrialBannerWithFetch` (handles API call)

### Data Fetching
```typescript
const { data } = useQuery({
  queryKey: ['subscription'],
  queryFn: () => api.billing.subscription()
});

const daysRemaining = calculateDaysRemaining(data?.trialEndsAt);
```

### Props Interface
```typescript
interface TrialBannerProps {
  daysRemaining: number;
  trialEndsAt: Date;
  onUpgrade: () => void;
}
```

---

## 🔗 Connections

- **Parent:** [[Dashboard Layout]]
- **Leads To:** [[Billing Settings]]
- **Related:**
  - [[Trial Lifecycle]]
  - [[Subscription Flow]]

---

## 📝 Notes

- [ ] TODO: A/B test banner messaging
- [ ] TODO: Animated countdown on last 3 days
- [ ] TODO: Discount offer on last day
- [ ] Consider: Persistent banner (not dismissible) on last day
