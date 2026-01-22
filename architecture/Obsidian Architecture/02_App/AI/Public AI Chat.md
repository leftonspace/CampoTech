---
tags:
  - page
  - ai
  - public
  - support
status: 🟢 Functional
type: Feature
path: apps/web/components/support/PublicAIChatBubble.tsx
---

# 💬 Public AI Chat

> [!SUCCESS] **Purpose**
> AI-powered chat bubble on public pages (landing, pricing) that helps potential customers and visitors with questions about CampoTech. Can escalate to human support queue with ticket tracking.

---

## 📸 Location

The chat bubble appears as a **floating button** in the bottom-right corner of all public pages:
- Landing page (`/`)
- Pricing page (`/precios`)
- Other marketing pages

---

## 🧩 Key Components

### 1. Chat Bubble Button
- Fixed position: `bottom-6 right-6`
- Green gradient background
- Pulsing notification indicator when tickets exist
- Toggle open/close on click

### 2. Chat Window
- Slides up from button
- Max height: 600px
- Responsive width: 380px

### 3. Session Management
- Persists in `localStorage` for 14 days
- Keys: `campotech_support_session`, `campotech_support_ticket`
- Loads conversation history on open

---

## 🤖 AI Capabilities

| Feature | Description |
|:---|:---|
| **Knowledge Base** | Static CampoTech product information |
| **Intent Recognition** | Pricing, features, integrations, how-to |
| **Ticket Escalation** | Creates support ticket when AI can't help |
| **Admin Responses** | Shows responses from support queue |

### Sample Interactions

```
User: "¿Cuánto cuesta el plan profesional?"
AI: "El plan Profesional tiene un costo de $X/mes. 
     Incluye: [features]. ¿Te gustaría más información?"

User: "Tengo un problema con mi cuenta"
AI: "Voy a crear un ticket de soporte para que nuestro 
     equipo te ayude. Tu número de ticket es #1234."
```

---

## 🔗 Integration Points

### API Endpoint
```
POST /api/support/public-chat
Body: {
  message: string,
  sessionId: string,
  context: "landing_page",
  pageUrl: string
}
Response: {
  response: string,
  ticketNumber?: string
}
```

### History Endpoint
```
GET /api/support/public-chat/history?sessionId={id}
Response: {
  messages: Message[],
  ticketNumber?: string,
  hasUnreadAdmin: boolean
}
```

---

## 🛠️ Technical Context

| Aspect | Details |
|:---|:---|
| **Component** | `components/support/PublicAIChatBubble.tsx` |
| **Used In** | `app/page.tsx` (landing page) |
| **Backend** | LangGraph workflow |
| **Database** | Support queue tables for escalation |
| **AI Model** | LangGraph (custom workflow) |

### Key Features
- Session persistence (14 days)
- Ticket number display in header
- Admin response styling (different color)
- Loading states with animations
- Unread indicator on bubble

---

## 🔐 Access Control

| Aspect | Value |
|:---|:---|
| **Authentication** | None required (public) |
| **Rate Limiting** | Session-based soft limits |
| **Data Privacy** | Anonymous until escalated |

---

## 🔗 Connections

- **Parent:** [[AI Systems Overview]]
- **Related:**
  - [[Support Queue]] (Admin side)
  - [[Landing Page]]
- **Escalates To:** `/dashboard/admin/support-queue`

---

## 📝 Notes

- [x] Session persistence implemented
- [x] Ticket escalation working
- [x] Admin responses displayed
- [ ] TODO: Multi-language support
- [ ] TODO: Attachment handling
- [ ] TODO: Analytics tracking

---

*Last updated: January 2026*
