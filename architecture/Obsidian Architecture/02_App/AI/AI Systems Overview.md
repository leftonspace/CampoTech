---
tags:
  - reference
  - ai
  - architecture
  - moc
status: 🟢 Functional
type: Reference Document
---

# 🤖 AI Systems Overview

> [!INFO] **Purpose**
> CampoTech implements three distinct AI systems, each serving different user segments and use cases. This document provides a comprehensive map of all AI capabilities, their configurations, and interconnections.

---

## 📊 AI Systems at a Glance

| # | System | Purpose | Users | Status |
|:---:|:---|:---|:---|:---:|
| 1 | [[Public AI Chat]] | Landing page visitor support | Visitors & Prospects | 🟢 |
| 2 | [[Staff Help AI]] | Dashboard help & troubleshooting | Logged-in Staff | 🟢 |
| 3 | [[WhatsApp AI Copilot]] | Customer WhatsApp automation | Organizations | 🟡 |

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CampoTech AI Systems                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐   │
│  │   AI #1         │   │   AI #2         │   │   AI #3                 │   │
│  │   PUBLIC CHAT   │   │   STAFF HELP    │   │   WHATSAPP COPILOT      │   │
│  │                 │   │                 │   │                         │   │
│  │  ┌───────────┐  │   │  ┌───────────┐  │   │  ┌───────────────────┐  │   │
│  │  │ Landing   │  │   │  │ Dashboard │  │   │  │ WhatsApp Page     │  │   │
│  │  │ Page      │  │   │  │ (Any Tab) │  │   │  │ + Customer Inbox  │  │   │
│  │  └───────────┘  │   │  └───────────┘  │   │  └───────────────────┘  │   │
│  │       │         │   │       │         │   │           │             │   │
│  │       ▼         │   │       ▼         │   │           ▼             │   │
│  │  ┌───────────┐  │   │  ┌───────────┐  │   │  ┌───────────────────┐  │   │
│  │  │ /api/     │  │   │  │ /api/ai/  │  │   │  │ /api/settings/    │  │   │
│  │  │ support/  │  │   │  │ staff-    │  │   │  │ ai-assistant      │  │   │
│  │  │ public-   │  │   │  │ assist    │  │   │  └───────────────────┘  │   │
│  │  │ chat      │  │   │  └───────────┘  │   │           │             │   │
│  │  └───────────┘  │   │       │         │   │           ▼             │   │
│  │       │         │   │       ▼         │   │  ┌───────────────────┐  │   │
│  │       ▼         │   │  ┌───────────┐  │   │  │ AIConfiguration   │  │   │
│  │  ┌───────────┐  │   │  │ ai-staff- │  │   │  │ (per-org DB)      │  │   │
│  │  │ LangGraph │  │   │  │ assistant │  │   │  └───────────────────┘  │   │
│  │  │ Workflow  │  │   │  │ .ts       │  │   │           │             │   │
│  │  └───────────┘  │   │  └───────────┘  │   │           ▼             │   │
│  │       │         │   │       │         │   │  ┌───────────────────┐  │   │
│  │       ▼         │   │       ▼         │   │  │ whatsapp-ai-      │  │   │
│  │  CampoTech KB   │   │  GPT-4o-mini    │   │  │ responder.ts      │  │   │
│  │  (static)       │   │  (generic ctx)  │   │  └───────────────────┘  │   │
│  └─────────────────┘   └─────────────────┘   └─────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Configuration Isolation

> [!IMPORTANT] **Key Finding**
> Each AI system is **isolated** - the `AIConfiguration` settings only affect **AI #3 (WhatsApp Copilot)**. The other two AIs use static/global knowledge.

| Setting | AI #1 Public | AI #2 Staff | AI #3 WhatsApp |
|:---|:---:|:---:|:---:|
| Per-Organization Config | ❌ | ❌ | ✅ |
| Uses `AIConfiguration` | ❌ | ❌ | ✅ |
| Custom Company Info | ❌ | ❌ | ✅ |
| Custom FAQ | ❌ | ❌ | ✅ |
| Tone/Personality Settings | ❌ | ❌ | ✅ |
| Business Hours Awareness | ❌ | ❌ | ✅ |

---

## 🛠️ Technical Stack

| Component | AI #1 | AI #2 | AI #3 |
|:---|:---|:---|:---|
| **Model** | LangGraph | GPT-4o-mini | GPT-4o-mini |
| **UI Component** | `PublicAIChatBubble` | `AIChatWidget` | `CopilotPanel` |
| **API Route** | `/api/support/public-chat` | `/api/ai/staff-assist` | `/api/copilot/chat` |
| **Service** | LangGraph Workflow | `ai-staff-assistant.ts` | `whatsapp-ai-responder.ts` |
| **Storage** | Session-based | Session-based | `AIConfiguration` + `AIConversationLog` |

---

## 📁 File Locations

```text
apps/web/
├── components/support/
│   ├── PublicAIChatBubble.tsx    # AI #1 UI
│   ├── AIChatWidget.tsx          # AI #2 Chat Interface
│   └── HelpWidget.tsx            # AI #2 Container
├── lib/
│   ├── ai-assistant-context.tsx  # AI #3 React Context
│   └── services/
│       ├── ai-staff-assistant.ts # AI #2 Backend
│       └── whatsapp-ai-responder.ts # AI #3 Backend
├── app/
│   ├── page.tsx                  # Landing (AI #1 rendered here)
│   ├── api/
│   │   ├── support/public-chat/  # AI #1 API
│   │   ├── ai/staff-assist/      # AI #2 API
│   │   ├── copilot/              # AI #3 API
│   │   └── settings/ai-assistant/ # AI #3 Config API
│   └── dashboard/
│       ├── settings/ai-assistant/ # AI #3 Settings Page
│       └── whatsapp/
│           └── components/
│               └── CopilotPanel.tsx # AI #3 UI
└── prisma/schema.prisma          # AIConfiguration model
```

---

## 🔗 Connections

- **Related Pages:**
  - [[Public AI Chat]] - Detailed AI #1 documentation
  - [[Staff Help AI]] - Detailed AI #2 documentation
  - [[WhatsApp AI Copilot]] - Detailed AI #3 documentation
  - [[AI Settings Page]] - Configuration interface
  - [[AI Architecture Deep Dive]] - **NEW**: Data access, permissions, scope limits
- **Parent:** [[README|Architecture Index]]

---

## 📝 Status Summary

| System | Backend | Frontend | Settings | Database | Testing |
|:---|:---:|:---:|:---:|:---:|:---:|
| AI #1 Public | 🟢 | 🟢 | N/A | 🟢 | 🟡 |
| AI #2 Staff | 🟢 | 🟢 | N/A | 🟡 | 🟡 |
| AI #3 WhatsApp | 🟢 | 🟡 | 🟢 | 🟢 | 🔴 |

---

*Last updated: January 2026*
