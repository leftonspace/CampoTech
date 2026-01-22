---
tags:
  - page
  - ai
  - whatsapp
  - copilot
  - core
status: 🟡 In Progress
type: Feature
path: apps/web/lib/services/whatsapp-ai-responder.ts
---

# 🤖 WhatsApp AI Copilot

> [!SUCCESS] **Purpose**
> The main AI system for automating customer WhatsApp conversations. Handles auto-responses, intent detection, booking suggestions, and provides real-time assistance to staff managing conversations.

---

## 📊 Status Summary

| Component | Status | Notes |
|:---|:---:|:---|
| Backend Auto-Responder | 🟢 | Works via webhooks |
| Settings Page | 🟢 | Full configuration UI |
| Database Model | 🟢 | `AIConfiguration` complete |
| CopilotPanel UI | 🟢 | **Phase 1 DONE** - Always visible as 3rd column |
| Activity Cards | 🟢 | **Phase 2 DONE** - Tabbed Activity/Chat interface |
| Test Simulation | � | **Phase 3 DONE** - Dev simulation panel |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    WhatsApp AI Copilot Flow                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Inbound WhatsApp Message                                        │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐     ┌──────────────────┐                      │
│  │ Webhook      │────▶│ processInbound   │                      │
│  │ /api/webhook │     │ Message()        │                      │
│  └──────────────┘     └──────────────────┘                      │
│                              │                                   │
│                              ▼                                   │
│                       ┌──────────────────┐                      │
│                       │ getAIConfiguration│                     │
│                       │ (per-org)         │                      │
│                       └──────────────────┘                      │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐        │
│  │ Intent     │      │ Entity     │      │ Scheduling │        │
│  │ Detection  │      │ Extraction │      │ Intelligence│       │
│  └────────────┘      └────────────┘      └────────────┘        │
│         │                    │                    │             │
│         └────────────────────┼────────────────────┘             │
│                              ▼                                   │
│                       ┌──────────────────┐                      │
│                       │ Generate Response│                      │
│                       │ (GPT-4o-mini)    │                      │
│                       └──────────────────┘                      │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐        │
│  │ Auto-Send  │      │ Transfer   │      │ Create Job │        │
│  │ Response   │      │ to Human   │      │ (if conf>85%)│      │
│  └────────────┘      └────────────┘      └────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Key Components

### 1. Backend: `whatsapp-ai-responder.ts`
- Main AI response generation
- Intent detection (booking, question, complaint, greeting)
- Entity extraction (service type, date, address)
- Confidence scoring
- Human handoff logic

### 2. UI: `CopilotPanel.tsx` 
- Sidebar panel in WhatsApp page
- **Always visible** as permanent 3rd column (Phase 1)
- **Tabbed interface:** Activity / Chat tabs (Phase 2)
- Activity tab shows real-time AI action cards
- Chat tab retains legacy Q&A interface

### 3. UI: `AIActivityFeed.tsx` (NEW - Phase 2)
- Card-based activity feed component
- Activity types: `job_created`, `customer_created`, `conflict_detected`, `audio_transcribed`, `response_suggested`, `availability_checked`
- Demo mode toggle for testing
- Action buttons for "Use Response", "View Job", etc.

### 4. Settings: `settings/ai-assistant/page.tsx`
- 71KB comprehensive settings UI
- All `AIConfiguration` fields editable

### 5. Context Provider: `ai-assistant-context.tsx`
- React context for AI state
- `useAIAssistant()` hook

---

## ⚙️ Configuration Model

```prisma
model AIConfiguration {
  id                       String  @id
  organizationId           String  @unique
  
  // Core toggles
  isEnabled                Boolean @default(false)
  autoResponseEnabled      Boolean @default(true)
  
  // Confidence thresholds
  minConfidenceToRespond   Int     @default(70)
  minConfidenceToCreateJob Int     @default(85)
  
  // Company Knowledge
  companyName              String?
  companyDescription       String?
  servicesOffered          Json    @default("[]")
  businessHours            Json    @default("{}")
  serviceAreas             String?
  pricingInfo              String?
  
  // Customization
  aiTone                   String  @default("friendly_professional")
  greetingMessage          String?
  awayMessage              String?
  faqItems                 Json    @default("[]")
  customInstructions       String?
  
  // Human handoff
  transferKeywords         Json    @default("[]")
  escalationUserId         String?
  
  // Data access permissions
  dataAccessPermissions    Json
  workflowPermissions      Json
}
```

---

## 🎨 Desired UI Design (NOT YET IMPLEMENTED)

Based on mockups, the CopilotPanel should show:

### 1. Status Header
```
┌─────────────────────────────────────┐
│ 🤖 Asistente IA         ● Connected │
│    Respondiendo automáticamente     │
└─────────────────────────────────────┘
```

### 2. Activity Cards (Real-time)
```
┌─────────────────────────────────────┐
│ ✅ Turno Creado                     │
│    Instalación Split - Mañana 15:00 │
│    📋 Ver turno                     │
├─────────────────────────────────────┤
│ 👤 Cliente Creado                   │
│    María García agregada a la base  │
│    🔗 Ver ficha                     │
├─────────────────────────────────────┤
│ ⚠️ Conflicto Detectado             │
│    Lunes 14hs ya tiene 2 trabajos   │
│    📅 Ver agenda                    │
├─────────────────────────────────────┤
│ 🎤 Audio Transcripto               │
│    "Consulta por mantenimiento..."  │
├─────────────────────────────────────┤
│ 💡 Respuesta Sugerida              │
│    "El lunes 14hs tenemos la..."    │
│    ✅ Usar                          │
└─────────────────────────────────────┘
```

### 3. Voice Note Info
```
┌─────────────────────────────────────┐
│ 🎵 La IA transcribe audios de voz  │
│    automáticamente pero siempre     │
│    responde por texto               │
└─────────────────────────────────────┘
```

---

## ✅ Completed: Phase 1 Issues Fixed

~~1. **Panel Hidden by Default**~~
   - ~~`showCopilot` state starts as `false`~~
   - ~~Only shows via small toggle button on chat edge~~
   - ✅ **FIXED Jan 21, 2026**: Now always visible as 3rd column

## 🔴 Remaining Issues

1. **Wrong UI Design**
   - Current: Chat Q&A interface
   - Needed: Real-time activity feed with cards

2. **Missing Activity Cards**
   - No "Turno Creado" cards
   - No "Conflicto Detectado" warnings
   - No "Audio Transcripto" display
   - No "Respuesta Sugerida" with use button

3. **No Test Simulation**
   - Cannot inject fake messages
   - Cannot test without real WhatsApp connection

---

## 🔗 API Endpoints

| Endpoint | Method | Purpose |
|:---|:---:|:---|
| `/api/settings/ai-assistant` | GET | Get AI config |
| `/api/settings/ai-assistant` | PUT | Update AI config |
| `/api/copilot/chat` | POST | Chat with copilot |
| `/api/copilot/execute-action` | POST | Execute AI action |
| `/api/copilot/availability` | GET | Check scheduling |
| `/api/whatsapp/conversations/:id/ai` | POST | Enable/disable AI |

---

## 🔗 Connections

- **Parent:** [[AI Systems Overview]]
- **Settings:** [[AI Settings Page]]
- **Related:**
  - [[WhatsApp Page]]
  - [[Support Queue]] (escalation target)
  - [[Customers Page]] (customer creation)
  - [[Jobs Page]] (job creation)

---

## 📝 Implementation Roadmap

### Phase 1: UI Visibility ✅ COMPLETE
- [x] Make CopilotPanel always visible (3-column layout)
- [x] Remove toggle button approach
- [x] Add empty state when no conversation selected

### Phase 2: Activity Feed ✅ COMPLETE
- [x] Replace chat interface with card-based feed
- [x] Implement activity card components (`AIActivityFeed.tsx`)
- [x] Create tabbed interface (Activity/Chat tabs)
- [x] Add demo mode toggle to preview activities

### Phase 3: Test Simulation ✅ COMPLETE
- [x] Create `/api/dev/whatsapp-simulate` endpoint
- [x] Allow injecting fake customer messages
- [x] Link to real customer profiles
- [x] Add `SimulationPanel.tsx` UI component
- [x] Integrate simulation buttons in CopilotPanel

### Phase 4: Polish
- [x] Real-time WebSocket updates (via Pusher already integrated)
- [x] Action buttons on cards (Usar respuesta, Confirmar y crear, etc.)
- [x] Integration with scheduling intelligence (queries real jobs/availability)
- [x] Wire `AIConversationLog` to real-time updates (logs all copilot interactions)

---

*Last updated: January 21, 2026 (Phase 4 completed)*
