---
tags:
  - page
  - app
  - admin
  - settings
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/settings/team/page.tsx
---

# 👥 Team Settings

> [!SUCCESS] **Purpose**
> Manage team members, roles, and permissions. Add technicians, ADMINs, and configure their access levels.

---

## 🧩 Page Structure

### Team Members List
| Column | Content |
|:---|:---|
| Avatar | Profile image or initials |
| Name | Full name |
| Phone | With country flag |
| Role | OWNER, ADMIN, TECHNICIAN |
| Specialty | Trade category |
| Status | Active/Inactive, Verified badge |
| Actions | Edit, Delete |

### Pending Verifications
Shows team members awaiting verification.

---

## 👤 Role System

| Role | Icon | Permissions |
|:---|:---|:---|
| **OWNER** | 🛡 Shield | Full access: billing, team, configuration |
| **ADMIN** | 👥 Users | Jobs, customers, schedule, reporting |
| **TECHNICIAN** | 🔧 Wrench | Own assigned jobs, inventory usage |

---

## 🔧 Specialty Categories

Based on Argentine construction trade categories (UOCRA CCT 76/75):

| Specialty | Icon |
|:---|:---|
| PLOMERO | 🚿 |
| ELECTRICISTA | ⚡ |
| GASISTA | 🔥 |
| CALEFACCIONISTA | ♨️ |
| REFRIGERACION | ❄️ |
| ALBANIL | 🧱 |
| PINTOR | 🎨 |
| CARPINTERO | 🪚 |
| TECHISTA | 🏠 |
| HERRERO | 🔨 |
| SOLDADOR | 🔥 |
| OTRO | 🛠️ |

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| `+ Agregar Miembro` | `Click` | Open add member modal |
| Team Row | `Click` | Open edit modal |
| Delete Button | `Click` | Confirm and remove |
| Resend Invite | `Click` | Resend verification email |

---

## 🛠️ Technical Context

### Component Path
- **Page:** `apps/web/app/dashboard/settings/team/page.tsx` (922 lines)

### Key Components
- `TeamMemberModal` - Add/edit form with phone validation
- `FlagImage` - Country flags via flagcdn.com

### API Endpoints
| Endpoint | Method | Purpose |
|:---|:---|:---|
| `/api/team` | GET | List team members |
| `/api/team` | POST | Add team member |
| `/api/team/[id]` | PATCH | Update member |
| `/api/team/[id]` | DELETE | Remove member |
| `/api/team/[id]/resend-invite` | POST | Resend verification |

---

## 🔗 Connections

- **Parent:** [[Settings Page]]
- **Related:**
  - [[Team Page]] (Team at-a-glance view)
  - [[Verification Flow]] (Team member verification)

---

*Last updated: January 2026*
