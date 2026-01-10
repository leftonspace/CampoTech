---
tags:
  - page
  - app
  - core
status: 🟢 Functional
type: Application Core
path: apps/web/app/dashboard/page.tsx
---

# 📊 Dashboard Home (Panel)

> [!SUCCESS] **Goal**
> The "Cockpit" for the business owner. Shows immediate status of jobs, income, team activity, and pending actions. First screen after login.

---

## 📸 Preview
![[dashboard-preview.png]]

---

## 🧩 Page Components

### Header Section
| Element | Description |
|:---|:---|
| Greeting | "Buenos días/tardes/noches, {firstName}" |
| Subtitle | "Acá tenés el resumen de tu negocio hoy." |
| **`+ Nuevo trabajo`** | Primary CTA → [[New Job Page]] |

---

### Onboarding Checklist (Conditional)
> Shown when `isOnboardingComplete === false`

See: [[Onboarding Checklist]]

- Progress bar with percentage
- Warning banner for blocked features
- Step-by-step verification items

---

### Stats Cards Row

| Card | Icon | Color | Data Source |
|:---|:---:|:---:|:---|
| **Trabajos Hoy** | 💼 | Teal | `stats.todayJobs` |
| **Clientes Activos** | 👥 | Coral | `stats.activeCustomers` |
| **Facturado Hoy** | 💵 | Green | `stats.todayRevenue` |
| **Rating Promedio** | 📈 | Pink | `stats.averageRating` |

Each card shows:
- Title
- Large value
- Trend indicator (optional)
- Colored icon badge

---

### Main Content Grid (3 columns)

#### Left Column (2/3 width)
**Trabajos de Hoy Table**
| Column | Content |
|:---|:---|
| Trabajo | Job number, service type, urgency badge |
| Cliente | Name, address preview |
| Técnico | Assigned technician or "Sin asignar" |
| Estado | Status badge |
| Hora | Scheduled time slot |
| Acciones | View details button |

**Empty State:**
- Briefcase icon
- "No hay trabajos programados para hoy"
- `+ Crear trabajo` button

---

#### Right Column (1/3 width)

**Quick Actions Panel**
See: [[Quick Actions]]

| Button | Route |
|:---|:---|
| Nuevo Trabajo | `/dashboard/jobs/new` |
| Nuevo Cliente | `/dashboard/customers/new` |
| Agendar | `/dashboard/calendar` |
| Nueva Factura | `/dashboard/invoices/new` |

---

**Team Status Panel**
| Element | Content |
|:---|:---|
| Title | "Estado del Equipo" |
| Subtitle | "{count} técnicos activos hoy" |
| List | Up to 4 technicians with status |

Per Technician:
- Avatar (photo or initials)
- Name
- Status badge (Disponible, En camino, Trabajando)
- Current job info (if working)
- Phone number

**Empty State:**
- Users icon
- "No hay técnicos registrados"

---

## 🖱️ All Clickable Elements

| Element | Action | Result |
|:---|:---|:---|
| `+ Nuevo trabajo` | `Click` | Navigate → [[New Job Page]] |
| Stats Card | `Hover` | Shadow effect |
| Job Row | `Click` | Navigate → [[Job Detail Page]] |
| `+ Crear trabajo` | `Click` | Navigate → [[New Job Page]] |
| Quick Action Buttons | `Click` | Navigate to respective page |
| Technician Card | `Click` | Could navigate to [[Team Member Detail]] |
| "Ver X más" | `Click` | Navigate → [[Team Page]] |

---

## 📊 Data Queries

### API Calls on Page Load
```typescript
// Dashboard stats
useQuery({ queryKey: ['dashboard-stats'], queryFn: api.dashboard.stats });

// Today's jobs
useQuery({ queryKey: ['today-jobs'], queryFn: api.jobs.today });

// Technician list
useQuery({ queryKey: ['technicians-status'], queryFn: api.users.list });

// Onboarding status
useOnboardingStatus();
```

---

## 🎨 Design Tokens

### Stat Card Colors
| Color Key | Background Class |
|:---|:---|
| `teal` | `bg-teal-500` |
| `coral` | `bg-orange-500` |
| `pink` | `bg-pink-500` |
| `green` | `bg-emerald-500` |

### Status Badge Colors
| Status | Background | Text |
|:---|:---|:---|
| PENDING | `bg-gray-100` | `text-gray-700` |
| ASSIGNED | `bg-purple-100` | `text-purple-700` |
| EN_ROUTE | `bg-teal-100` | `text-teal-700` |
| IN_PROGRESS | `bg-green-100` | `text-green-700` |
| COMPLETED | `bg-green-50` | `text-green-700` |
| CANCELLED | `bg-red-100` | `text-red-700` |

---

## 🔐 Access Control

All authenticated users see the dashboard, but content is filtered:

| Role | Sees |
|:---|:---|
| OWNER | All stats, all jobs, all technicians |
| ADMIN | Managed team stats and jobs |
| TECHNICIAN | Own stats, assigned jobs only |

---

## 📱 Responsive Layout

| Breakpoint | Layout |
|:---|:---|
| Mobile | Single column, stacked sections |
| `sm` | 2 stats per row |
| `lg` | 4 stats per row, 3-column grid |

---

## 🛠️ Technical Context

- **Component Path:** `apps/web/app/dashboard/page.tsx`
- **Layout:** `apps/web/app/dashboard/layout.tsx`
- **API Client:** `@/lib/api-client`

### Key Dependencies
```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { OnboardingChecklist } from '@/components/dashboard';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
```

---

## 🔗 Connections

- **Parent:** [[Login Flow]]
- **Layout:** [[Dashboard Layout]]
- **Children Components:**
  - [[Onboarding Checklist]]
  - [[Quick Actions]]
  - [[Stats Cards]]
  - [[Jobs Table]]
  - [[Team Status]]
- **Navigates To:**
  - [[New Job Page]]
  - [[Job Detail Page]]
  - [[New Customer Page]]
  - [[Calendar Page]]
  - [[New Invoice Page]]
  - [[Team Page]]
- **Related:**
  - [[Sidebar Navigation]]
  - [[User Menu]]
  - [[Trial Banner]]
  - [[Access Banner]]

---

## 📝 Notes & TODOs

- [ ] TODO: Add fiscal health traffic light (Phase 2.4)
- [ ] TODO: Upgrade Now button (during trial)
- [ ] TODO: Help Center widget (?)
- [ ] TODO: Expiration banner (< 7 days yellow, < 3 days red)
- [ ] TODO: Income vs expenses graph
- [ ] TODO: Weather widget for outdoor service companies
- [ ] Consider: Customizable widget layout
- [ ] Consider: Recent activity feed

---

*The dashboard is the heart of CampoTech - make every pixel count.*
