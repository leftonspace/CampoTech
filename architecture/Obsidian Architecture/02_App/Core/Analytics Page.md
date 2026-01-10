---
tags:
  - page
  - app
  - analytics
status: 🟡 In Progress
type: Application Page
path: apps/web/app/dashboard/analytics/overview/page.tsx
---

# 📈 Analytics Page (Análisis)

> [!INFO] **Purpose**
> Business intelligence dashboard providing insights into operations, revenue, and team performance. Data-driven decision making for service companies.

---

## 📸 Preview
![[analytics-overview.png]]

---

## 🧩 Page Structure

### Navigation Tabs
| Tab | Route | Content |
|:---|:---|:---|
| Resumen | `/analytics/overview` | Key metrics overview |
| Ingresos | `/analytics/revenue` | Revenue analysis |
| Trabajos | `/analytics/jobs` | Job performance |
| Equipo | `/analytics/team` | Team productivity |
| Clientes | `/analytics/customers` | Customer insights |
| Fiscal | `/analytics/fiscal` | Monotributo tracking |

---

## 📊 Overview Dashboard

### KPI Cards
| Metric | Description |
|:---|:---|
| Ingresos del Mes | Monthly revenue vs target |
| Trabajos Completados | Jobs finished this month |
| Tasa de Retención | Returning customer % |
| Rating Promedio | Customer satisfaction |

### Charts
| Chart Type | Shows |
|:---|:---|
| Line Chart | Revenue trend (6 months) |
| Bar Chart | Jobs by service type |
| Pie Chart | Revenue by customer type |
| Heatmap | Busy hours/days |

---

## 💰 Revenue Analytics

### Metrics
- Total revenue (period)
- Average job value
- Revenue per technician
- Revenue by service type
- Payment collection rate

### Filters
- Date range
- Technician
- Service type
- Customer segment

---

## 💼 Job Analytics

### Metrics
- Total jobs
- Completion rate
- Average job duration
- First-time fix rate
- Cancellation rate

### Charts
- Jobs by status (pie)
- Daily job volume (bar)
- Average duration by service type

---

## 👥 Team Analytics

### Per Technician
- Jobs completed
- Revenue generated
- Average rating
- On-time arrival %
- Customer complaints

### Leaderboard
- Top performers this month
- Improvement trends

---

## 🏛️ Fiscal Analytics (Monotributo)

### Traffic Light Dashboard
| Indicator | Status | Meaning |
|:---:|:---|:---|
| 🟢 | Safe | Under 70% of limit |
| 🟡 | Warning | 70-90% of limit |
| 🔴 | Critical | >90% of limit |

### Tracked Limits
- Annual revenue vs category limit
- Monthly invoice count
- Electric consumption (if applicable)

### Alerts
- Recategorization warnings
- Upcoming limit breach
- Tax obligation reminders

---

## 🔐 Access Control

| Role | Access Level |
|:---|:---|
| OWNER | Full analytics |
| ADMIN | Limited (no fiscal) |
| TECHNICIAN | Own performance only |

### Tier Gating
- **INICIAL:** Basic stats only
- **PROFESIONAL:** Full analytics
- **EMPRESA:** Custom reports + export

---

## 🛠️ Technical Context

- **Overview:** `apps/web/app/dashboard/analytics/overview/page.tsx`
- **Revenue:** `apps/web/app/dashboard/analytics/revenue/page.tsx`
- **Jobs:** `apps/web/app/dashboard/analytics/jobs/page.tsx`
- **Team:** `apps/web/app/dashboard/analytics/team/page.tsx`
- **Fiscal:** `apps/web/app/dashboard/analytics/fiscal/page.tsx`

### API Endpoints
- `GET /api/analytics/overview` - Dashboard KPIs
- `GET /api/analytics/revenue` - Revenue data
- `GET /api/analytics/jobs` - Job statistics
- `GET /api/analytics/team` - Team performance
- `GET /api/analytics/fiscal` - Monotributo tracking

### Chart Library
- `recharts` or `chart.js`

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Children:**
  - [[Revenue Report]]
  - [[Jobs Report]]
  - [[Team Report]]
  - [[Fiscal Dashboard]]
- **Related:**
  - [[Settings - AFIP]] (Fiscal config)
  - [[Subscription Flow]] (Tier gatinig)

---

## 📝 Notes

- [ ] TODO: Export reports to PDF/Excel
- [ ] TODO: Scheduled email reports
- [ ] TODO: Custom date ranges
- [ ] TODO: Comparison periods (vs last month/year)
- [ ] COST: Heavy queries should be cached/optimized
- [ ] PREMIUM: Advanced analytics locked to PROFESIONAL+
