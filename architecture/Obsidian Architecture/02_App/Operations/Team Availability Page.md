---
tags:
  - page
  - app
  - operations
  - scheduling
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/team/page.tsx
---

# 👥 Team & Availability Management (Equipos)

> [!SUCCESS] **Purpose**
> Unified workforce management hub combining employee administration with advanced schedule configuration and daily exception tracking. Implements Argentine labor law categories for absence types.

---

## 🎯 Core Philosophy

This module solves a critical operational challenge: **How do dispatchers understand real-time workforce capacity while maintaining the flexibility to handle Argentine labor law complexities?**

The solution splits concerns into:
1. **Horarios Tab** → Read-only weekly overview (The Visualizer)
2. **Disponibilidad Tab** → Interactive calendar management (The Manager)
3. **ScheduleConfigModal** → Multi-mode recurring schedule setup
4. **EmployeeDayModal** → Single-day exception management

---

## 📸 Visual Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ 👥 Equipo                          [+ Nuevo Miembro] [⚙️ Config]│
├─────────────────────────────────────────────────────────────────┤
│  [Miembros]  [Horarios]  [Disponibilidad]  [Mi Horario]         │
└─────────────────────────────────────────────────────────────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
          ┌──────▼──────┐          ┌───────▼───────┐
          │  Horarios   │          │ Disponibilidad│
          │ (Read-Only) │          │  (Manager)    │
          │ Weekly Grid │          │ Calendar View │
          └─────────────┘          └───────────────┘
```

---

## 📋 Tab Architecture

### 1. Horarios Tab (Weekly Visualizer)

**Role**: Read-only weekly schedule overview

| Day Cell State | Visual Representation |
|:---|:---|
| Working | `09:00 - 18:00` + `bg-green-50/30` |
| Day Off | `Libre` (italics) + `bg-gray-50` |
| Unconfigured | `-` + `bg-gray-50/30` |

**Onboarding Alert**: Users without any schedule records display a `⚠️ Sin Configurar` badge next to their name—not in every cell.

```tsx
// Clean grid cell rendering logic
{schedule?.isAvailable ? (
  <span className="text-sm">{schedule.startTime} - {schedule.endTime}</span>
) : schedule ? (
  <span className="text-gray-400 italic">Libre</span>
) : (
  <span className="text-gray-300">-</span>
)}
```

---

### 2. Disponibilidad Tab (Calendar Manager)

**File**: `components/schedule/TeamCalendar.tsx`

The heart of availability management. Features a **Separate Cards Split-View** architecture:

```
┌────────────────────────────────────────────────────────────┐
│  [◀ Prev] [  Enero 2026  ] [Next ▶]  [Hoy]  [⚙️ Configurar]│
│  [Filter: Todos ▼]  [Filter: Status Pills]                 │
├───────────────────────────────────┬────────────────────────┤
│                                   │                        │
│   Dom  Lun  Mar  Mié  Jue  Vie    │  📅 Lunes 12 Enero     │
│  ┌───┬───┬───┬───┬───┬───┬───┐   │                        │
│  │   │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │   │  ┌──────────────────┐  │
│  │   │●●●│●●●│●●●│●●●│●● │   │   │  │ Kevin Pérez      │  │
│  ├───┼───┼───┼───┼───┼───┼───┤   │  │ 🕐 08:00 - 16:00 │  │
│  │ 7 │ 8 │ 9 │10 │11 │[12]│13 │   │  │ ⚠️ Vacaciones    │  │
│  │●●●│●●●│●●●│●●●│●●●│●●●│   │   │  └──────────────────┘  │
│  └───┴───┴───┴───┴───┴───┴───┘   │                        │
│                                   │  ┌──────────────────┐  │
│   ● Available  ● Vacation         │  │ María González   │  │
│   ● Sick       ● Study            │  │ 🕐 09:00 - 17:00 │  │
│                                   │  └──────────────────┘  │
└───────────────────────────────────┴────────────────────────┘
```

#### Status Priority Resolution

When multiple exceptions exist for the same day, the system resolves to a single dot color using this priority:

```tsx
// Priority: sick > vacation > study > dayoff > special
const getPrimaryStatusForDay = (employeeId: string, date: Date): string => {
  const statuses = dayExceptions.map(e => REASON_TO_STATUS[e.reason || '']);
  if (statuses.includes('sick')) return 'sick';
  if (statuses.includes('vacation')) return 'vacation';
  if (statuses.includes('study')) return 'study';
  if (statuses.includes('dayoff')) return 'dayoff';
  if (statuses.includes('special')) return 'special';
  return 'available';
};
```

#### Status Colors (Semantic Mapping)

```tsx
const STATUS_DOT_COLORS: Record<string, string> = {
  available: 'bg-green-500',   // ● Working normally
  special: 'bg-blue-500',      // ● Modified hours
  vacation: 'bg-yellow-500',   // ● PTO
  sick: 'bg-orange-500',       // ● Medical leave
  study: 'bg-purple-500',      // ● Exam/training
  dayoff: 'bg-gray-300',       // ● Day off
};
```

#### Selection Visual (Teal Inset Ring)

```tsx
// Selected state: thick teal ring, white background for readability
<div className={cn(
  "p-2 rounded-lg transition-all cursor-pointer",
  isSelected && "ring-2 ring-inset ring-teal-600 bg-white",
  isToday && "font-bold text-teal-600"
)}>
```

**Design Decision**: We use a ring instead of background fill to ensure status dots remain visible against the selection highlight.

---

## ⚙️ ScheduleConfigModal (Base Schedule Setup)

**File**: `components/schedule/ScheduleConfigModal.tsx`

A 4-mode configuration hub supporting different business realities:

### Schedule Types

| Mode | Use Case | State Object |
|:---|:---|:---|
| 🗓️ **Horario Base** | Fixed weekly hours | `daySchedules` |
| 🔄 **Turnos Rotativos** | Shift workers (morning/afternoon/night) | `dayShifts` + `shiftTimes` |
| 📱 **A Demanda** | On-call with advance notice | `onDemandSchedules` + `advanceNotice` |
| ✏️ **Personalizado** | Split shifts | `customSchedule` |

### Smart Time Input

The modal implements a **Hybrid 24h Entry** system:

```tsx
// Auto-detection: typing "15" → PM, "00" → AM, "12" → PM (Noon)
const parseTimeInfo = (time: string): { display: string; period: 'AM' | 'PM' } => {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour >= 13 && hour <= 23) return { display: time, period: 'PM' };
  if (hour === 12) return { display: time, period: 'PM' };
  if (hour === 0) return { display: time, period: 'AM' };
  return { display: time, period: 'AM' };
};
```

### Schedule Type Exclusivity

An employee can only belong to ONE schedule type at a time:

```tsx
// Switch confirmation dialog when changing modes with unsaved data
const handleScheduleTypeClick = (newType: string) => {
  if (hasDataInCurrentType() && scheduleType !== newType) {
    setPendingScheduleType(newType);
    setShowSwitchConfirm(true); // Trigger amber warning dialog
  } else {
    setScheduleType(newType);
  }
};
```

**Rationale**: Prevents "ghost schedules" where overlapping configurations from different modes could create conflicting shifts.

### Rotating Shifts (Click-to-Cycle)

```tsx
// Cycle: null → morning → afternoon → night → null
const cycleDayShift = (dayId: number) => {
  const current = dayShifts[dayId];
  const cycle: (string | null)[] = [null, 'morning', 'afternoon', 'night'];
  const currentIndex = cycle.indexOf(current);
  const nextIndex = (currentIndex + 1) % cycle.length;
  setDayShifts({ ...dayShifts, [dayId]: cycle[nextIndex] });
};
```

Visual feedback:
- **Yellow** (`bg-yellow-100`): Mañana (Morning)
- **Orange** (`bg-orange-100`): Tarde (Afternoon)  
- **Indigo** (`bg-indigo-100`): Noche (Night)
- **Gray** (`bg-gray-50`): Day off

---

## 📅 EmployeeDayModal (Exception Management)

**File**: `components/schedule/EmployeeDayModal.tsx`

Manages multiple concurrent exceptions for a single employee on a specific date.

### Exception Types (Argentine Labor Law)

```tsx
const EXCEPTION_TYPES = [
  { id: 'vacation', reason: 'Vacaciones', icon: Palmtree, iconColor: 'text-yellow-600' },
  { id: 'sick', reason: 'Enfermedad', icon: Thermometer, iconColor: 'text-orange-600' },
  { id: 'study', reason: 'Examen / Estudio', icon: GraduationCap, iconColor: 'text-purple-600' },
  { id: 'dayoff', reason: 'Franco / Ausente', icon: Coffee, iconColor: 'text-gray-600' },
];
```

### Multi-Exception Support

The database allows multiple exceptions per user/date:

```prisma
model ScheduleException {
  @@index([userId, date])  // Non-unique: allows multiple records
}
```

**Why not `@@unique`?** Real-world scenarios require it:
- 08:00-09:00: Medical appointment (Sick)
- 14:00-16:00: University exam (Study)

### Overlap Prevention

```tsx
// API validates: start1 < end2 && start2 < end1
if (startMins < existingEnd && endMins > existingStart) {
  throw new Error('El horario se superpone con otra excepción existente');
}
```

### Reactive Data Synchronization

**Problem**: Snapshotting employee data in state causes "stale modal" bugs when background queries refetch.

**Solution**: Store only the ID, derive data during render:

```tsx
// Parent (TeamCalendar) stores only the ID
const [selectedEmployeeIdForEdit, setSelectedEmployeeIdForEdit] = useState<string | null>(null);

// Modal derives current data from query result
const employeeData = useMemo(() => {
  if (!selectedEmployeeIdForEdit) return null;
  return getEmployeeStatusForDay(selectedEmployeeIdForEdit, selectedDate);
}, [calendarData, selectedEmployeeIdForEdit, selectedDate]);
```

---

## 🛡️ Assignment Validation System

**File**: `hooks/useAssignmentValidation.ts`

Prevents scheduling conflicts when assigning technicians to jobs.

### Validation API

```tsx
// POST /api/employees/schedule/validate-assignment
const response = await fetch('/api/employees/schedule/validate-assignment', {
  method: 'POST',
  body: JSON.stringify({
    technicianId,
    scheduledDate: '2026-01-12',
    scheduledTimeStart: '10:00',
    scheduledTimeEnd: '12:00',  // Optional, defaults to +1hr
  }),
});
```

### Warning Types

| Type | Cause | Visual |
|:---|:---|:---|
| `advance_notice` | On-call tech, insufficient notice | 🕐 Amber |
| `outside_availability` | Outside working hours | 🟠 Orange |
| `day_off` | Technician's day off | 🔴 Red |
| `exception` | Overlaps vacation/sick | 🟣 Purple |

### Interval Overlap Detection

```tsx
// Standard interval overlap formula
const hasConflict = jobStart < excEnd && jobEnd > excStart;
```

**Integration Points**:
- ✅ `ReassignJobDialog.tsx` (Map reassignment)
- ✅ `NearestTechnicians.tsx` (Quick assignment list)
- ✅ `dashboard/jobs/new` (Job creation form)

---

## 🌐 Timezone Policy

All scheduling logic uses **Argentina Time (ART, UTC-3)**.

```tsx
// lib/timezone.ts
export const getBuenosAiresNow = () => {
  return new Date(new Date().toLocaleString('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires'
  }));
};
```

**Why?** An admin in Canada must see the same "Today" and shift boundaries as staff in Argentina.

---

## 🔗 API Endpoints

| Method | Endpoint | Purpose |
|:---|:---|:---|
| `GET` | `/api/employees/schedule/calendar` | Monthly aggregated data |
| `PUT` | `/api/employees/schedule` | Update base schedule day |
| `PATCH` | `/api/employees/schedule` | Update `scheduleType`, `advanceNoticeHours` |
| `POST` | `/api/employees/schedule/exceptions` | Create exception |
| `DELETE` | `/api/employees/schedule/exceptions?id=` | Delete exception (Query param!) |
| `POST` | `/api/employees/schedule/validate-assignment` | Check conflicts |

> [!WARNING] **API Gotcha**
> - Always use `/exceptions` (plural). `/exception` returns 404.
> - Deletion uses query param `?id=...`, not path `/exceptions/:id` (405).

---

## 🔐 Access Control

| Role | Permissions |
|:---|:---|
| OWNER | All schedules, config, exceptions |
| DISPATCHER | Manage team schedules |
| TECHNICIAN | View own schedule only (read-only) |

---

## 🔗 Connections

- **Parent**: [[Dashboard Home]]
- **Related**:
  - [[Jobs Page]] (Technician assignment)
  - [[Fleet Page]] (Vehicle-driver scheduling)
  - [[Calendar Page]] (Job visibility)

---

## 📝 Design Decisions Log

| Decision | Rationale |
|:---|:---|
| **Separate Cards Split-View** | Grid and panel are distinct containers with `gap-4` for visual independence |
| **Individual Dots (max 4)** | Shows per-technician status; `+N` overflow prevents grid distortion |
| **Selection Ring vs Fill** | Ring preserves content readability when cell is selected |
| **Today = Bold Teal Text** | Reduces visual noise vs. solid circle backgrounds |
| **Multi-Exception Support** | Real-world: dentist 10-11, then exam 14-16 on same day |
| **Schedule Type Exclusivity** | Prevents ghost schedules from mode overlap |
| **ID-based Modal Sync** | Prevents stale data when background queries refetch |
