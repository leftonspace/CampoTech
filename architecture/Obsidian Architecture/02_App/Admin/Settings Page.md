---
tags:
  - page
  - app
  - settings
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/settings/page.tsx
---

# ⚙️ Settings Page (Configuración)

> [!INFO] **Purpose**
> Central hub for organization settings, integrations, and user preferences. Controls business rules and system configuration.

---

## 📸 Preview
![[settings-overview.png]]

---

## 🧩 Settings Sections

### Navigation Sidebar
| Section | Route | Description |
|:---|:---|:---|
| General | `/settings` | Organization info |
| Equipo | `/settings/team` | Team management |
| Facturación | `/settings/billing` | Subscription & payments |
| AFIP | `/settings/afip` | Fiscal configuration |
| WhatsApp | `/settings/whatsapp` | Messaging settings |
| MercadoPago | `/settings/mercadopago` | Payment gateway |
| Notificaciones | `/settings/notifications` | Alert preferences |
| Servicios | `/settings/service-types` | Service catalog |
| Precios | `/settings/pricebook` | Pricing rules |
| AI Assistant | `/settings/ai-assistant` | AI configuration |
| Privacidad | `/settings/privacy` | Data & privacy |

---

## 🏢 General Settings

### Organization Profile
| Field | Description |
|:---|:---|
| Nombre | Business name |
| CUIT | Tax identification |
| Dirección | Business address |
| Logo | Company logo upload |
| Teléfono | Contact phone |
| Email | Business email |

### Business Hours
- Working days configuration
- Start/end hours
- Timezone setting

---

## 👥 Team Settings

### Roles & Permissions
- Define custom roles
- Assign module access
- Set approval workflows

### Invitation Settings
- Default role for invites
- Auto-approval toggle
- Invitation expiry time

Link: [[Team Page]]

---

## 💳 Billing Settings

### Current Plan
- Plan name and status
- Billing cycle
- Next payment date
- Usage meters

### Actions
- Upgrade/downgrade plan
- Update payment method
- View invoice history
- Download receipts

Link: [[Subscription Flow]]

---

## 🏛️ AFIP Settings

### Certificate Management
| Field | Description |
|:---|:---|
| Certificado | Upload .crt file |
| Clave Privada | Upload .key file |
| CUIT | Linked CUIT |
| Punto de Venta | POS number |

### Testing Mode
- Toggle homologation (testing) vs production
- View API logs

Link: [[AFIP Integration]]

---

## 💬 WhatsApp Settings

### Phone Number
- Connected number
- Connection status
- QR re-link option

### Bot Configuration
- Enable/disable AI
- Business hours
- Auto-response messages

Link: [[WhatsApp Page]]

---

## 💰 MercadoPago Settings

### OAuth Connection
- Connect/disconnect account
- View linked email
- Access token status

### Preferences
- Default payment methods
- Notification URL
- IPN configuration

Link: [[Payments Page]]

---

## 🔔 Notification Settings

### Channels
| Channel | Toggle |
|:---|:---:|
| Email | ✓ |
| WhatsApp | ✓ |
| Push (future) | - |

### Event Types
- New job assigned
- Job completed
- Payment received
- Low inventory
- Invoice overdue

---

## 🔧 Service Types

### Catalog Management
- Add/edit service types
- Set default pricing
- Duration estimates
- Required skills

Link: [[New Job Page]]

---

## 💵 Pricebook Settings

### Pricing Rules
- Base prices per service
- Labor rates
- Material markup
- Zone adjustments

Link: [[Inventory Page]]

---

## 🤖 AI Assistant Settings

### Configuration
- Personality/tone
- Enabled contexts
- Token budget
- Fallback behaviors

### Workflow Permissions
- Suggest responses (AI proposes, user approves)
- Translate messages
- Suggest actions (create customer, job, etc.)
- Access database (query customer history)
- Access schedule (check availability)

### Auto-Approvals
- Auto-approve small price adjustments (< X%)
- Auto-assign technicians
- Threshold configuration

Link: [[WhatsApp Page]]

---

## 🔐 Privacy Settings

### Data Controls
- Export organization data
- Delete account
- GDPR compliance
- Data retention period

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| Section Link | `Click` | Navigate to settings section |
| Save Button | `Click` | Save changes |
| Connect Button | `Click` | OAuth flow |
| Upload Button | `Click` | File picker |
| Toggle | `Click` | Enable/disable feature |

---

## 🔐 Access Control

| Role | Access Level |
|:---|:---|
| OWNER | All settings |
| ADMIN | Limited (no billing, AFIP) |
| TECHNICIAN | Profile only |

---

## 🛠️ Technical Context

- **Main Page:** `apps/web/app/dashboard/settings/page.tsx`
- **Sub-pages:** `apps/web/app/dashboard/settings/[section]/page.tsx`

### API Endpoints
- `GET /api/organization` - Get org settings
- `PATCH /api/organization` - Update settings
- `POST /api/organization/logo` - Upload logo
- `GET /api/settings/[section]` - Section-specific
- `PATCH /api/settings/[section]` - Update section

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Children:**
  - [[Team Settings]]
  - [[Billing Settings]]
  - [[AFIP Settings]]
  - [[WhatsApp Settings]]
  - [[MercadoPago Settings]]
- **Related:**
  - [[User Menu]] (Quick access)
  - [[Profile Page]] (Personal settings)

---

## 📝 Notes

- [ ] TODO: Settings backup/restore
- [ ] TODO: Audit log for setting changes
- [ ] TODO: Import settings from another org
- [ ] Consider: Settings templates by industry
