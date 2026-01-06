---
tags:
  - page
  - app
  - profile
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/profile/page.tsx
---

# 👤 Profile Page (Perfil)

> [!INFO] **Purpose**
> Personal profile management for the logged-in user. Update personal info, preferences, and security settings.

---

## 📸 Preview
![[profile-page.png]]

---

## 🧩 Page Structure

### Profile Header
| Element | Content |
|:---|:---|
| Avatar | Photo or initials |
| Name | User's full name |
| Role | OWNER, ADMIN, TECHNICIAN |
| Member Since | Account creation date |

### Tabs
| Tab | Content |
|:---|:---|
| Personal | Name, phone, email |
| Seguridad | Password, 2FA |
| Preferencias | Language, notifications |
| Sesiones | Active sessions |

---

## 👤 Personal Info

### Editable Fields
| Field | Type | Description |
|:---|:---|:---|
| Nombre | Text | Full name |
| Email | Email | Contact email |
| Teléfono | Phone | Mobile number |
| Avatar | Image | Profile photo |

### Non-Editable Fields
| Field | Description |
|:---|:---|
| Organización | Linked organization |
| Rol | Assigned role |
| CUIT | From organization |

---

## 🔐 Security Settings

### Password (If Applicable)
- Current password
- New password
- Confirm password
- Password strength meter

### Two-Factor Authentication
- Enable/disable 2FA
- Authenticator app setup
- Backup codes

### Session Management
- List of active sessions
- Device info, location, last activity
- Revoke session button

---

## ⚙️ Preferences

### Display
| Setting | Options |
|:---|:---|
| Idioma | Español (default) |
| Tema | Light / Dark / System |
| Formato de Fecha | DD/MM/YYYY |
| Zona Horaria | America/Argentina/Buenos_Aires |

### Notifications
| Type | Channel |
|:---|:---|
| Trabajo Asignado | Email, WhatsApp |
| Pago Recibido | Email |
| Recordatorios | WhatsApp |

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| Edit Avatar | `Click` | Open image upload |
| Save Button | `Click` | Save changes |
| Change Password | `Click` | Open password form |
| Enable 2FA | `Click` | Start 2FA setup |
| Revoke Session | `Click` | End remote session |
| Delete Account | `Click` | Confirmation → Account deletion |

---

## 🔐 Access Control

All users can access their own profile page.

| Feature | OWNER | ADMIN | TECHNICIAN |
|:---|:---:|:---:|:---:|
| Edit personal info | ✓ | ✓ | ✓ |
| Change password | ✓ | ✓ | ✓ |
| Enable 2FA | ✓ | ✓ | ✓ |
| View organization | ✓ | ✓ | ✓ |
| Edit organization | ✓ | - | - |
| Delete account | ✓ | - | - |

---

## 🛠️ Technical Context

- **Component Path:** `apps/web/app/dashboard/profile/page.tsx`
- **Auth Context:** `useAuth()` from `@/lib/auth-context`

### API Endpoints
- `GET /api/users/me` - Get current user
- `PATCH /api/users/me` - Update profile
- `POST /api/users/me/avatar` - Upload avatar
- `POST /api/users/me/password` - Change password
- `GET /api/users/me/sessions` - List sessions
- `DELETE /api/users/me/sessions/:id` - Revoke session

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Related:**
  - [[User Menu]] (Quick access)
  - [[Settings Page]] (Organization settings)
  - [[Login Flow]] (Auth)

---

## 📝 Notes

- [ ] TODO: Social login connections (Google)
- [ ] TODO: Activity log
- [ ] TODO: Avatar cropping tool
- [ ] Consider: Profile completeness indicator
