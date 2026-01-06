---
tags:
  - component
  - dashboard
  - stats
status: 🟢 Functional
type: Component
path: apps/web/app/dashboard/page.tsx
---

# 📊 Stats Cards

> [!INFO] **Purpose**
> Display key business metrics at a glance on the dashboard. Provide immediate insight into daily operations.

---

## 📸 Preview
![[stats-cards.png]]

---

## 🧩 Card Structure

### Current Stats

| Card | Title | Value Type | Icon Color |
|:---|:---|:---|:---|
| 1 | Trabajos Hoy | Number | Teal |
| 2 | Clientes Activos | Number | Coral |
| 3 | Facturado Hoy | Currency | Green |
| 4 | Rating Promedio | Number/- | Pink |

---

## 🎨 Component Design

### Card Layout
```tsx
<div className="card p-5 hover:shadow-md transition-shadow">
  <div className="flex items-start justify-between">
    <div className="flex-1">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {trend && (
        <p className="text-xs text-emerald-600 font-medium mt-1">{trend}</p>
      )}
    </div>
    <div className={`rounded-full p-3 ${iconBg}`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
  </div>
</div>
```

### Color Classes

| Color Key | Background | Use For |
|:---|:---|:---|
| `teal` | `bg-teal-500` | Operations |
| `coral` | `bg-orange-500` | People |
| `green` | `bg-emerald-500` | Revenue |
| `pink` | `bg-pink-500` | Performance |

---

## 📊 Data Properties

### StatCardProps Interface
```typescript
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: 'teal' | 'coral' | 'pink' | 'green';
  trend?: string | null;
  loading?: boolean;
}
```

### Data Sources

| Stat | API Field | Trend Calculation |
|:---|:---|:---|
| Trabajos Hoy | `stats.todayJobs` | vs yesterday |
| Clientes Activos | `stats.activeCustomers` | vs last week |
| Facturado Hoy | `stats.todayRevenue` | vs yesterday |
| Rating Promedio | `stats.averageRating` | rating count |

---

## 🔄 Loading State

When data is loading:
```tsx
<div className="h-8 w-20 animate-pulse rounded bg-gray-200 mt-1" />
```

---

## 📱 Responsive Grid

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard ... />
</div>
```

| Breakpoint | Columns |
|:---|:---:|
| Mobile | 1 |
| `sm` | 2 |
| `lg` | 4 |

---

## 🔮 Future Enhancements

### Potential Stats
| Stat | Description |
|:---|:---|
| Trabajos Pendientes | Unfinished jobs |
| Inventario Bajo | Low stock alerts |
| Cobros Pendientes | Outstanding payments |
| Nuevos Leads | New inquiries |

### Interactive Features
- Click to drill down
- Period selector (today, week, month)
- Comparison mode

---

## 🛠️ Technical Context

- **Component Location:** Inline in dashboard page
- **Could Extract To:** `@/components/dashboard/StatCard.tsx`

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Data Source:** `/api/dashboard/stats`
- **Related:**
  - [[Analytics Page]] (Detailed metrics)

---

## 📝 Notes

- [ ] TODO: Add click handler to open detailed view
- [ ] TODO: Period toggle (today/week/month)
- [ ] TODO: Comparison with previous period
- [ ] Consider: Animated number transitions
