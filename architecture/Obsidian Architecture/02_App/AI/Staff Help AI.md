---
tags:
  - page
  - ai
  - dashboard
  - help
status: 🟢 Functional
type: Feature
path: apps/web/components/support/HelpWidget.tsx
---

# ❓ Staff Help AI

> [!SUCCESS] **Purpose**
> Floating help button available on all dashboard pages. Provides staff with AI-powered assistance for platform usage, troubleshooting, and feature guidance.

---

## 📸 Location

Help widget appears as a **floating `?` button** in the bottom-right corner of all dashboard pages.

---

## 🧩 Key Components

### 1. HelpWidget Container
- **Location:** `components/support/HelpWidget.tsx`
- Floating button: `?` icon
- Opens modal with help options

### 2. Help Options Menu
| Option | Description |
|:---|:---|
| 📚 FAQ | Common questions |
| 🐛 Report Issue | Bug report form |
| 💡 Suggest Feature | Feature request form |
| 🤖 AI Chat | Open AI assistant |

### 3. AIChatWidget
- **Location:** `components/support/AIChatWidget.tsx`
- Embedded in help modal
- Conversational AI interface

---

## 🤖 AI Capabilities

| Action | Description |
|:---|:---|
| `DRAFT_RESPONSE` | Generate suggested replies |
| `SUGGEST_BOOKING` | Help with job creation |
| `CHECK_AVAILABILITY` | Query technician schedules |
| `ANALYZE_CUSTOMER` | Get customer insights |
| `DETECT_CONFLICTS` | Find scheduling conflicts |
| `LOOKUP_PRICING` | Query service pricing |

### Sample Interactions

```
Staff: "¿Cómo creo un cliente nuevo?"
AI: "Para crear un cliente nuevo:
     1. Ve a Clientes en el menú
     2. Click en 'Nuevo Cliente'
     3. Completa nombre, teléfono y dirección
     ¿Necesitás más detalles?"

Staff: "El mapa no carga"
AI: "Algunos pasos para solucionar:
     1. Verificá tu conexión a internet
     2. Refrescá la página (F5)
     3. Limpiá el caché del navegador
     Si persiste, podés reportar el problema."
```

---

## 🔗 API Endpoints

### Staff Assist
```
POST /api/ai/staff-assist
Body: {
  organizationId: string,
  conversationId: string,
  userId: string,
  action: StaffAssistantAction,
  query?: string,
  context?: {
    customerMessage?: string,
    staffDraft?: string,
    additionalInfo?: Record<string, unknown>
  }
}
```

### Response
```json
{
  "success": true,
  "action": "DRAFT_RESPONSE",
  "result": "Suggested response text...",
  "data": {
    "suggestedResponse": "...",
    "availability": {...},
    "customerInsights": {...}
  }
}
```

---

## 🛠️ Technical Context

| Aspect | Details |
|:---|:---|
| **Container** | `components/support/HelpWidget.tsx` |
| **Chat Widget** | `components/support/AIChatWidget.tsx` |
| **Backend Service** | `lib/services/ai-staff-assistant.ts` |
| **API Route** | `/api/ai/staff-assist` |
| **AI Model** | GPT-4o-mini |

### Integration Points
- Scheduling Intelligence Service (for availability)
- Booking Workflow (for job creation)
- Prisma DB (for customer/job lookups)

---

## 🔐 Access Control

| Aspect | Value |
|:---|:---|
| **Authentication** | Required (logged-in users) |
| **Roles** | All roles: OWNER, ADMIN, TECHNICIAN |
| **Scope** | Generic platform help (not conversation-specific) |

---

## ⚠️ Important Notes

> [!WARNING] **Configuration Isolation**
> This AI uses **generic platform context**, NOT the organization-specific `AIConfiguration`. It helps with "how to use CampoTech" questions, not customer conversations.

---

## 🔗 Connections

- **Parent:** [[AI Systems Overview]]
- **Appears On:** All dashboard pages
- **Related:**
  - [[Dashboard Home]]
  - [[Settings Page]]

---

## 📝 Notes

- [x] Help widget implemented
- [x] AI chat functional
- [x] Issue reporting form
- [x] Feature suggestion form
- [ ] TODO: Context-aware help (detect current page)
- [ ] TODO: Video tutorials integration
- [ ] TODO: Guided walkthroughs

---

*Last updated: January 2026*
