---
tags:
  - page
  - app
  - whatsapp
  - ai
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/whatsapp/page.tsx
---

# 💬 WhatsApp Page

> [!SUCCESS] **Purpose**
> AI-powered WhatsApp integration for customer communication. Manage conversations, configure automation, and track engagement.

---

## 📸 Preview
![[whatsapp-inbox.png]]

---

## 🧩 Page Structure

### Navigation Tabs
| Tab | Route | Content |
|:---|:---|:---|
| Inbox | `/whatsapp` | Conversation list |
| Templates | `/whatsapp/templates` | Message templates |
| Automatización | `/whatsapp/automation` | AI bot settings |
| Métricas | `/whatsapp/metrics` | Engagement stats |

---

## 📥 Inbox View

### Conversation List
| Column | Content |
|:---|:---|
| Contact | Customer name/phone |
| Preview | Last message snippet |
| Time | Last activity |
| Status | 🔴 Unread, 🟡 Waiting, 🟢 Resolved |
| Agent | Assigned user or "🤖 Bot" |

### Conversation Detail
- Full message history
- Customer info sidebar
- Quick action buttons
- Message input with templates

---

## 🤖 AI Automation

### Auto-Response Rules
| Trigger | Response |
|:---|:---|
| New message (off-hours) | "Recibimos tu mensaje..." |
| Price inquiry | AI-generated quote |
| Appointment request | Calendar availability |
| Follow-up (24h) | Satisfaction survey |

### AI Capabilities
- Intent detection (quote, appointment, complaint)
- Entity extraction (service type, address)
- Context memory (previous conversations)
- Human handoff triggers

### AI Configuration
- Personality/tone settings
- Business hours
- Escalation keywords
- Language (Spanish)

---

## 📝 Message Templates

### Template Types
| Type | Use Case |
|:---|:---|
| Appointment Reminder | Day-before notification |
| Quote | Service pricing |
| Job Completion | Thank you + survey |
| Payment Reminder | Invoice follow-up |

### Template Variables
```
{{customer_name}} - Customer's name
{{job_number}} - Work order number
{{scheduled_date}} - Appointment date
{{total_amount}} - Invoice amount
```

---

## 📊 Metrics

### Engagement Stats
- Response time (average)
- Messages sent/received
- Conversion rate (inquiry → job)
- Bot resolution rate

### Charts
- Messages by hour (heatmap)
- Response time trend
- Satisfaction ratings

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| Conversation | `Click` | Open chat panel |
| Send Button | `Click` | Send message |
| Template Button | `Click` | Insert template |
| Transfer | `Click` | Assign to human agent |
| Mark Resolved | `Click` | Archive conversation |
| Create Job | `Click` | Create job from conversation |

---

## 🔐 Access Control

| Role | Permissions |
|:---|:---|
| OWNER | Full WhatsApp management |
| ADMIN | View inbox, respond |
| TECHNICIAN | View own conversations |

### Tier Gating
- **INICIAL:** Basic WhatsApp (manual only)
- **PROFESIONAL:** AI automation included
- **EMPRESA:** Advanced AI + analytics

---

## 🛠️ Technical Context

- **Inbox:** `apps/web/app/dashboard/whatsapp/page.tsx`
- **Templates:** `apps/web/app/dashboard/whatsapp/templates/page.tsx`
- **Automation:** `apps/web/app/dashboard/whatsapp/automation/page.tsx`

### API Endpoints
- `GET /api/whatsapp/conversations` - List conversations
- `GET /api/whatsapp/conversations/:id` - Get messages
- `POST /api/whatsapp/send` - Send message
- `GET /api/whatsapp/templates` - List templates
- `POST /api/whatsapp/templates` - Create template

### External Services
- **WhatsApp Business API** via Meta Cloud API
- **AI Processing** via LangGraph/OpenAI

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Children:**
  - [[WhatsApp Templates]]
  - [[WhatsApp Automation]]
  - [[WhatsApp Metrics]]
- **Related:**
  - [[Customers Page]] (Customer context)
  - [[Jobs Page]] (Create from chat)
  - [[Settings - WhatsApp]] (Configuration)

---

## 📝 Notes

- [ ] TODO: Multi-language support
- [ ] TODO: Attachment handling (photos, documents)
- [ ] TODO: Voice message transcription
- [ ] TODO: Group chat support
- [ ] COST: AI tokens are metered - implement limits per tier
- [ ] CRITICAL: WhatsApp Business API approval required
