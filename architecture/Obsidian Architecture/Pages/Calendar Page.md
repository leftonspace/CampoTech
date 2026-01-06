---
tags:
  - page
  - app
  - scheduling
status: 🟡 In Progress
type: Application Page
path: apps/web/app/dashboard/calendar/page.tsx
---

# 📅 Calendar / Agenda

> [!INFO] **Purpose**
> Visual scheduling interface for managing work orders across days, weeks, and months. Core tool for dispatchers and technicians to manage their time.

---

## 📸 Preview
![[calendar-view.png]]

---

## 🧩 View Modes

### 1. Day View
- Hourly time slots (7:00 - 20:00 default)
- Drag-and-drop job scheduling
- Technician columns side-by-side

### 2. Week View
- 7-day grid layout
- Jobs shown as colored blocks
- Quick overview of workload distribution

### 3. Month View
- Calendar grid with job counts per day
- Click day to drill down

---

## 🎨 Job Block Colors

| Status | Color | Meaning |
|:---|:---:|:---|
| PENDING | ⚪ Gray | Unconfirmed |
| ASSIGNED | 🟣 Purple | Tech assigned, not started |
| EN_ROUTE | 🔵 Blue | Tech traveling |
| IN_PROGRESS | 🟢 Green | Active work |
| COMPLETED | ✅ Green border | Finished |
| CANCELLED | 🔴 Red | Cancelled |

### Urgency Indicators
- 🔴 Red border = URGENT
- 🟠 Orange border = HIGH
- No border = NORMAL/LOW

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| Empty Slot | `Click` | Open quick-create job modal |
| Job Block | `Click` | Show job details popup |
| Job Block | `Drag` | Reschedule to new time/day |
| Job Block | `Double-click` | Navigate → [[Job Detail Page]] |
| Day Number | `Click` | Switch to day view for that date |
| View Toggle | `Click` | Switch Day/Week/Month |
| `+` Button | `Click` | Navigate → [[New Job Page]] |
| Tech Filter | `Select` | Filter by specific technician |

---

## 🧩 Key Components

### Quick Create Modal
Fields:
- Customer (autocomplete)
- Service Type (dropdown)
- Time Slot (start/end)
- Technician (assign or leave pending)

### Job Detail Popup
- Customer name & address
- Service type
- Assigned technician
- Status badge
- Quick actions: Edit, Reschedule, Cancel

---

## 📊 Technician Workload

Side panel showing:
- Each technician's scheduled jobs for selected day
- Available hours
- Capacity indicator (bar chart)

---

## 🔐 Access Control

| Role | Access Level |
|:---|:---|
| OWNER | All technicians, all dates |
| ADMIN | Managed technicians |
| TECHNICIAN | Own calendar only |

---

## 🛠️ Technical Context

- **Component Path:** `apps/web/app/dashboard/calendar/page.tsx`
- **Calendar Library:** `@fullcalendar/react` or custom implementation
- **API Endpoints:**
  - `GET /api/jobs?dateFrom=X&dateTo=Y` - Jobs in range
  - `PATCH /api/jobs/:id` - Reschedule job
  - `GET /api/technicians/availability` - Tech schedules

### State Management
```typescript
const [currentDate, setCurrentDate] = useState(new Date());
const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null);
```

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Related:**
  - [[New Job Page]] (Create from calendar)
  - [[Job Detail Page]] (View details)
  - [[Team Page]] (Technician availability)
  - [[Dispatch View]] (Job assignment)

---

## 📝 Notes

- [ ] TODO: Add recurring job support
- [ ] TODO: Implement drag-and-drop rescheduling
- [ ] TODO: Add Google Calendar sync
- [ ] TODO: Time zone handling
- [ ] Consider: Working hours configuration per organization
