---
tags:
  - component
  - dashboard
  - team
status: 🟢 Functional
type: Component
path: apps/web/app/dashboard/page.tsx
---

# 👥 Team Status Widget

> [!INFO] **Purpose**
> Display real-time status of technicians on the dashboard. Shows who is available, working, or traveling.

---

## 📸 Preview
![[team-status-widget.png]]

---

## 🧩 Widget Structure

### Header
| Element | Content |
|:---|:---|
| Title | "Estado del Equipo" |
| Subtitle | "{count} técnicos activos hoy" |

### Technician List
Shows up to 4 technicians. Each card displays:

| Element | Content |
|:---|:---|
| Avatar | Photo or initials on colored circle |
| Name | Technician's full name |
| Status Badge | Availability state |
| Current Job | Service type (if working) |
| Location | Address (if on job) |
| Phone | Contact number |

---

## 🎨 Status Badges

| Status | Color | Label |
|:---|:---|:---|
| Available | `bg-green-100 text-green-700` | Disponible |
| En Route | `bg-teal-100 text-teal-700` | En camino |
| Working | `bg-teal-100 text-teal-700` | Trabajando |
| Offline | `bg-gray-100 text-gray-700` | Desconectado |

---

## 📊 Status Logic

### Determining Technician Status
```typescript
const getTechnicianCurrentJob = (techId: string) => {
  return jobs.find(
    (j) => j.technician?.id === techId && 
           ['EN_ROUTE', 'IN_PROGRESS'].includes(j.status)
  );
};

const currentJob = getTechnicianCurrentJob(tech.id);
const isAvailable = !currentJob;
```

---

## 🎨 Card Design

### Individual Technician Card
```tsx
<div className="flex items-start gap-3 p-3 rounded-lg border">
  {/* Avatar */}
  {tech.avatar ? (
    <img src={tech.avatar} className="h-10 w-10 rounded-full" />
  ) : (
    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
      {getInitials(tech.name)}
    </div>
  )}
  
  {/* Info */}
  <div className="flex-1 min-w-0">
    <div className="flex items-center justify-between gap-2">
      <p className="font-medium truncate">{tech.name}</p>
      <span className={statusColor}>{statusLabel}</span>
    </div>
    {currentJob && (
      <>
        <p className="text-sm text-gray-500">{serviceType}</p>
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {address}
        </p>
      </>
    )}
    {tech.phone && (
      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Phone className="h-3 w-3" />
        {tech.phone}
      </p>
    )}
  </div>
</div>
```

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| Technician Card | `Click` | Could navigate to tech detail |
| Phone Icon | `Click` | Open phone/WhatsApp |
| "Ver X más" | `Click` | Navigate → [[Team Page]] |

---

## 📱 Empty State

When no technicians registered:
```tsx
<div className="text-center py-6">
  <Users className="mx-auto h-8 w-8 text-gray-300" />
  <p className="mt-2 text-sm text-gray-500">
    No hay técnicos registrados
  </p>
</div>
```

---

## 🔢 Overflow Handling

If more than 4 technicians:
```tsx
{technicians.length > 4 && (
  <Link href="/dashboard/settings/team" className="text-sm text-primary-600">
    Ver {technicians.length - 4} más
  </Link>
)}
```

---

## 🛠️ Technical Context

- **Component Location:** Inline in dashboard page
- **Could Extract To:** `@/components/dashboard/TeamStatus.tsx`

### Props Interface
```typescript
interface TeamStatusProps {
  technicians: Array<{
    id: string;
    name: string;
    avatar?: string;
    phone?: string;
  }>;
  jobs: Job[];
}
```

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Data Sources:**
  - `/api/users?role=TECHNICIAN`
  - `/api/jobs/today`
- **Links To:**
  - [[Team Page]]
  - [[Team Member Detail]]

---

## 📝 Notes

- [ ] TODO: Real-time status updates via WebSocket
- [ ] TODO: Click to call/message
- [ ] TODO: Show last GPS location
- [ ] TODO: Availability toggle by technician
- [ ] Consider: Color-coded avatars by status
