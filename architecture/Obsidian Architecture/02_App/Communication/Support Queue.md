---
tags:
  - page
  - app
  - communication
  - support
  - ai
status: 🟢 Functional
type: Feature
path: apps/web/app/dashboard/admin/support-queue/page.tsx
---

# 🎫 Support Queue System

> [!SUCCESS] **Purpose**
> Complete support escalation system that allows public visitors to chat with AI, get escalated to human support when needed, and receive responses via multiple channels.

---

## 🔄 Support Flow

1. Visitor opens chat → AI answers questions
2. If AI can't answer → Collect contact info
3. Create support ticket → Save to database
4. Show ticket # to visitor
5. Admin checks queue → Responds
6. Notify visitor via push/email/WhatsApp

### AI Behavior
- AI stays **ON** until admin sends first response
- Then switches to **human mode**

---

## 📬 Notification Channels

| Channel | Cost |
|:---|:---|
| Browser Push | Free (requires permission) |
| Email | Resend.com: 100/day free |
| WhatsApp | Uses organization credits |

---

## 🧩 Admin Dashboard

### Ticket Statuses
| Status | Description |
|:---|:---|
| `open` | AI handling, not escalated |
| `pending_response` | Waiting for admin |
| `responded` | Admin replied |
| `new_reply` | Visitor replied (needs attention!) |
| `closed` | Resolved |

---

## 🛠️ Technical Context

### Component Files
| Path | Purpose |
|:---|:---|
| `app/dashboard/admin/support-queue/page.tsx` | Admin queue UI |
| `components/support/PublicAIChatBubble.tsx` | Visitor chat widget |
| `lib/services/support-notification.ts` | Multi-channel notifications |

### API Endpoints
| Endpoint | Purpose |
|:---|:---|
| `/api/support/conversations` | List/create tickets |
| `/api/support/conversations/[id]/respond` | Admin response |
| `/api/support/public-chat` | Visitor messages |

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Related:** [[WhatsApp Page]], [[AI Settings Page]]

---

*Last updated: January 2026*
