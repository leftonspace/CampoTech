---
tags:
  - page
  - app
  - team
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/team/page.tsx
---

# 👨‍👩‍👧‍👦 Team Page (Equipo)

> [!INFO] **Purpose**
> Manage technicians and staff members. Track certifications, availability, and performance metrics.

---

## 📸 Preview
![[team-list.png]]

---

## 🧩 Page Structure

### Header Section
| Element | Description |
|:---|:---|
| Page Title | "Equipo" |
| Member Count | Active team members |
| `+ Agregar Técnico` | Primary CTA button |

### Team Grid/List View

| Display Mode | Description |
|:---|:---|
| Grid | Card layout with avatar, name, status |
| List | Table with detailed info |

### Team Member Card

| Element | Content |
|:---|:---|
| Avatar | Profile photo or initials |
| Name | Full name |
| Role | TECHNICIAN, ADMIN, OWNER |
| Status | 🟢 Available, 🔵 Busy, ⚪ Offline |
| Phone | Contact number |
| Current Job | If working, show job number |

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| `+ Agregar Técnico` | `Click` | Open invite/add modal |
| Team Card | `Click` | Navigate → [[Team Member Detail]] |
| Phone Icon | `Click` | Call or WhatsApp |
| Status Badge | `Hover` | Show last activity time |
| View Toggle | `Click` | Switch Grid/List view |

---

## 🧩 Team Member Detail

### Tabs:
1. **Perfil** - Personal info, contact, certifications
2. **Trabajos** - Assigned and completed jobs
3. **Rendimiento** - Performance metrics
4. **Disponibilidad** - Working hours, time off

### Performance Metrics:
- Jobs completed this month
- Average rating from customers
- On-time arrival percentage
- Revenue generated

---

## 👤 Add Technician Flow

### Option 1: Invite by Phone
1. Enter phone number
2. Send WhatsApp/SMS invitation
3. Technician completes signup
4. Auto-linked to organization

### Option 2: Create Account
1. Fill in details (name, phone, role)
2. System generates temp password
3. Technician logs in and updates

---

## 🔐 Access Control

| Role | Permissions |
|:---|:---|
| OWNER | Full team management |
| ADMIN | View team, limited edits |
| TECHNICIAN | View own profile only |

### Role Hierarchy
```
OWNER → ADMIN → TECHNICIAN
```

---

## 🛠️ Technical Context

- **List Page:** `apps/web/app/dashboard/team/page.tsx`
- **Detail Page:** `apps/web/app/dashboard/team/[id]/page.tsx`
- **Settings Page:** `apps/web/app/dashboard/settings/team/page.tsx`

### API Endpoints
- `GET /api/users?role=TECHNICIAN` - List team members
- `POST /api/users/invite` - Send invitation
- `POST /api/users` - Create user directly
- `GET /api/users/:id` - Get member details
- `PATCH /api/users/:id` - Update member
- `DELETE /api/users/:id` - Remove from team

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Children:**
  - [[Team Member Detail]]
  - [[Invite Technician Flow]]
- **Related:**
  - [[Jobs Page]] (Assignment)
  - [[Calendar Page]] (Availability)
  - [[Map View]] (Location tracking)
  - [[Settings - Team]]

---

## 📝 Notes

- [ ] TODO: Implement certifications/skills tracking
- [ ] TODO: Add vacation/time-off management
- [ ] TODO: Skill-based auto-assignment
- [ ] Consider: Commission tracking per technician
