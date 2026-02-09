# AI Integration Deep Dive: CampoTech WhatsApp & AI System

> **Date:** 2026-02-06  
> **Scope:** Dashboard WhatsApp, AI Assistant Settings, WhatsApp Settings  
> **Author:** System Analysis

---

## Executive Summary

CampoTech's AI system is a **hybrid architecture** combining:
1. **Next.js API Routes** (TypeScript) for web/dashboard AI features
2. **Python FastAPI Service** (LangGraph) for voice processing and chatbot workflows
3. **OpenAI Direct Integration** (via Next.js) for Copilot chat
4. **LangSmith** for observability/tracing (Python service only)

---

## Table of Contents

1. [Page Interconnections](#1-page-interconnections)
2. [AI Execution Flows](#2-ai-execution-flows)
3. [Technology Stack Usage](#3-technology-stack-usage)
4. [Key Files Reference](#4-key-files-reference)
5. [Configuration System](#5-configuration-system)
6. [Code Accuracy Assessment](#6-code-accuracy-assessment)
7. [Data Flow Diagrams](#7-data-flow-diagrams)

---

## 1. Page Interconnections

### Three Key Pages Analyzed

| Page | Path | Purpose |
|------|------|---------|
| **WhatsApp Dashboard** | `/dashboard/whatsapp` | Main conversation interface with AI Copilot |
| **AI Assistant Settings** | `/dashboard/settings/ai-assistant` | AI configuration and testing |
| **WhatsApp Settings** | `/dashboard/settings/whatsapp` | WhatsApp integration (BSP/Personal) |

### Interconnection Map

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           THREE KEY PAGES                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────┐      Uses Settings     ┌────────────────────────────┐  │
│  │ /dashboard/whatsapp │ ────────────────────► │ /dashboard/settings/       │  │
│  │                     │                        │    ai-assistant            │  │
│  │  • CopilotPanel     │ ◄─────┐               │                            │  │
│  │  • ChatWindow       │       │               │  • AIConfiguration (DB)    │  │
│  │  • AI Toggle        │       │               │  • Confidence thresholds   │  │
│  └─────────────────────┘       │               │  • Transfer keywords       │  │
│          │                     │               │  • Data permissions        │  │
│          │ Shared via          │               └────────────────────────────┘  │
│          │ AIAssistantProvider │                           │                    │
│          │                     └───────────────────────────┘                    │
│          │                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    /dashboard/settings/whatsapp                          │   │
│  │                                                                          │   │
│  │   • WhatsApp BSP Credentials (required for AI features)                  │   │
│  │   • Phone Number Configuration                                           │   │
│  │   • Personal Number (wa.me links) - NO AI                                │   │
│  │   • BSP API Mode → ENABLES Voice AI + Copilot                            │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Interconnection Details

| Source → Target | Mechanism | Purpose |
|-----------------|-----------|---------|
| `whatsapp/page.tsx` → `ai-assistant` settings | `useAIAssistant()` context | Sync AI enabled state |
| `CopilotPanel` → `/api/copilot/chat` | React Query mutation | AI chat responses |
| `settings/whatsapp` → `settings/ai-assistant` | BSP connection | AI features require BSP |
| `ai-assistant/page.tsx` → `/api/settings/ai-assistant` | React Query | Load/save AI config |

### Shared State: AIAssistantProvider

The `lib/ai-assistant-context.tsx` provides global AI state:

```typescript
// Key exports from AIAssistantProvider
export function useAIAssistant() {
  return {
    settings,           // Full AIConfiguration
    isEnabled,          // Master toggle state
    isLoading,
    toggleEnabled,      // Toggle AI on/off
    updateSettings,     // Update configuration
    refetch,
  };
}
```

**Used by:**
- `dashboard/whatsapp/page.tsx` - Read `isEnabled`, navigate to settings
- `dashboard/settings/ai-assistant/page.tsx` - Read/write all settings
- `AIStatusToggle` component - Shared toggle widget

---

## 2. AI Execution Flows

### Flow 1: Copilot Chat (Dashboard Internal Assistant)

**Path:** User sends message in CopilotPanel → API → OpenAI → Response

```
┌─────────────────┐    /api/copilot/chat    ┌─────────────────────────────┐
│  CopilotPanel   │ ───────────────────────►│  Next.js Route Handler      │
│  (React)        │                         │  copilot/chat/route.ts      │
└─────────────────┘                         └──────────────┬──────────────┘
                                                           │
                                            ┌──────────────▼──────────────┐
                                            │  1. Session validation      │
                                            │  2. Role check (OWNER/      │
                                            │     DISPATCHER/TECHNICIAN)  │
                                            │  3. Rate limiting           │
                                            └──────────────┬──────────────┘
                                                           │
                                            ┌──────────────▼──────────────┐
                                            │  Context Building:          │
                                            │  • Conversation messages    │
                                            │  • Customer history (jobs)  │
                                            │  • Schedule availability    │
                                            │  • Business hours           │
                                            └──────────────┬──────────────┘
                                                           │
                                            ┌──────────────▼──────────────┐
                                            │  OpenAI Call (gpt-4o-mini)  │
                                            │  • SYSTEM_PROMPT (Spanish)  │
                                            │  • Context messages         │
                                            │  • User query               │
                                            └──────────────┬──────────────┘
                                                           │
                                            ┌──────────────▼──────────────┐
                                            │  Intent Detection:          │
                                            │  • isJobRequest             │
                                            │  • isReplyRequest           │
                                            │  • isSummaryRequest         │
                                            │  • isScheduleRequest        │
                                            └──────────────┬──────────────┘
                                                           │
                                            ┌──────────────▼──────────────┐
                                            │  Log to AIConversationLog   │
                                            │  (Prisma audit trail)       │
                                            └──────────────┬──────────────┘
                                                           │
                                            ┌──────────────▼──────────────┐
                                            │  Response with Actions:     │
                                            │  • type: message/suggestion │
                                            │  • actions: create_job,     │
                                            │    use_reply, modify        │
                                            └─────────────────────────────┘
```

**Key Code (`/api/copilot/chat/route.ts`):**
- Lines 17-19: OpenAI client initialization
- Lines 22-44: System prompt in Argentine Spanish
- Lines 151-169: Conversation context building
- Lines 233-238: Intent detection via regex
- Lines 349-359: OpenAI API call
- Lines 424-437: AIConversationLog creation

**Technology:** TypeScript + OpenAI SDK (NO LangGraph)

---

### Flow 2: AI Test Sandbox (Settings Page)

**Path:** User tests message in settings → API → OpenAI (JSON mode) → Analysis

```
┌──────────────────────┐    /api/settings/ai-assistant/test    
│  AI Settings Page    │ ──────────────────────────────────────►
│  "Probar" Tab        │                                        
└──────────────────────┘                                        
                                                          │
                                           ┌──────────────▼──────────────┐
                                           │  Pre-AI Processing:         │
                                           │  1. Check if transferred    │
                                           │  2. Transfer keyword match  │
                                           │     (Spanish stem matching) │
                                           └──────────────┬──────────────┘
                                                          │
                                           ┌──────────────▼──────────────┐
                                           │  Real-Time Data Fetch:      │
                                           │  • getTechnicianAvail()     │
                                           │  • getAvailableSlots()      │
                                           │  • 7-day schedule           │
                                           └──────────────┬──────────────┘
                                                          │
                                           ┌──────────────▼──────────────┐
                                           │  Dynamic Prompt Building:   │
                                           │  • Data access permissions  │
                                           │  • Business hours (open?)   │
                                           │  • Technician anonymization │
                                           │  • Tone instructions        │
                                           └──────────────┬──────────────┘
                                                          │
                                           ┌──────────────▼──────────────┐
                                           │  OpenAI (JSON response):    │
                                           │  {                          │
                                           │    intent,                  │
                                           │    confidence,              │
                                           │    suggestedResponse,       │
                                           │    shouldCreateJob,         │
                                           │    shouldTransfer,          │
                                           │    suggestedTimeSlot        │
                                           │  }                          │
                                           └─────────────────────────────┘
```

**Key Features:**
- Transfer keyword stemming for Spanish verbs (lines 172-204)
- Data access permission filtering (lines 502-546)
- Real-time technician availability (lines 301-377)
- Business hours open/closed detection (lines 571-592)

**Technology:** TypeScript + OpenAI SDK (NO LangGraph)

---

### Flow 3: Voice Message Processing (LangGraph)

**Path:** WhatsApp Audio → Webhook → Python Service → LangGraph Workflow

```
┌──────────────────────┐   
│  WhatsApp Cloud API  │   POST /api/whatsapp/webhook
│  (Incoming Audio)    │ ─────────────────────────────►
└──────────────────────┘                              
                                                │
                                 ┌──────────────▼──────────────┐
                                 │  processInboundMessage()    │
                                 │  (whatsapp.service.ts)      │
                                 └──────────────┬──────────────┘
                                                │
                                 ┌──────────────▼──────────────┐
                                 │  voiceAIService.isEnabled() │
                                 │                             │
                                 │  Checks:                    │
                                 │  • VOICE_AI_ENABLED env     │
                                 │  • voice_ai_v2_langgraph    │
                                 │  • WhatsApp BSP connected   │
                                 │  • Org settings             │
                                 └──────────────┬──────────────┘
                                                │
                                 ┌──────────────▼──────────────┐
                                 │  HTTP → Python Service      │
                                 │  VOICE_AI_SERVICE_URL       │
                                 └──────────────┬──────────────┘
                                                │
            ╔═══════════════════════════════════▼═══════════════════════════════════╗
            ║           PYTHON FASTAPI + LANGGRAPH SERVICE                          ║
            ║           services/ai                                                  ║
            ╠═══════════════════════════════════════════════════════════════════════╣
            ║                                                                       ║
            ║  LangGraph StateGraph (voice_processing.py):                          ║
            ║                                                                       ║
            ║   [transcribe] ──► [translate] ──► [extract]                          ║
            ║        │                              │                               ║
            ║        │         Route by Confidence  │                               ║
            ║        ▼                              ▼                               ║
            ║   [failed]          ┌────────────────┼────────────────┐               ║
            ║        │            │                │                │               ║
            ║        ▼            ▼                ▼                ▼               ║
            ║   [handle_failure]  [confirm]   [auto_create]   [human_review]        ║
            ║        │            │                │                │               ║
            ║        └────────────┴────────────────┴────────────────┘               ║
            ║                              │                                        ║
            ║                              ▼                                        ║
            ║                            [END]                                      ║
            ║                                                                       ║
            ║  External Calls:                                                      ║
            ║  • OpenAI Whisper (transcription)                                     ║
            ║  • OpenAI GPT-4 (extraction)                                          ║
            ║  • LangSmith (tracing, if LANGSMITH_API_KEY set)                      ║
            ╚═══════════════════════════════════════════════════════════════════════╝
```

**LangGraph Nodes (voice_processing.py):**

| Node | Lines | Function |
|------|-------|----------|
| `transcribe_node` | 121-149 | Download audio, Whisper transcription |
| `translate_node` | 152-224 | Detect language, translate to Spanish |
| `extract_node` | 227-264 | Extract job data with GPT-4 |
| `route_by_confidence` | 267-283 | Conditional routing |
| `send_confirmation_node` | 286-321 | Send WhatsApp confirmation |
| `auto_create_job_node` | 324-369 | Create job automatically |
| `human_review_node` | 372-413 | Queue for human review |
| `handle_failure_node` | 416-449 | Handle errors |

**Confidence Thresholds:**
- `>= CONFIDENCE_AUTO_CREATE_THRESHOLD` → auto_create
- `>= CONFIDENCE_CONFIRM_THRESHOLD` → confirm
- `< CONFIDENCE_CONFIRM_THRESHOLD` → human_review

**Technology:** Python + LangGraph + LangChain + LangSmith

---

### Flow 4: Action Execution

**Path:** User clicks action button → Execute API → Database mutation

```
┌─────────────────────┐    /api/copilot/execute-action
│  CopilotPanel       │ ───────────────────────────────►
│  Action Button      │                                 
└─────────────────────┘                                 
                                               │
                                ┌──────────────▼──────────────┐
                                │  Supported Actions:         │
                                │  • create_job               │
                                │  • create_customer          │
                                │  • schedule_followup        │
                                └──────────────┬──────────────┘
                                               │
                                ┌──────────────▼──────────────┐
                                │  create_job flow:           │
                                │  1. Get/create customer     │
                                │  2. Link to conversation    │
                                │  3. Create Job record       │
                                │  4. Return jobNumber        │
                                └─────────────────────────────┘
```

**Technology:** TypeScript + Prisma (NO AI)

---

## 3. Technology Stack Usage

### Usage Matrix

| Feature | Normal Code | LangGraph | LangChain | LangSmith | OpenAI Direct |
|---------|:-----------:|:---------:|:---------:|:---------:|:-------------:|
| **Copilot Chat** | ✅ TS | ❌ | ❌ | ❌ | ✅ gpt-4o-mini |
| **AI Test Sandbox** | ✅ TS | ❌ | ❌ | ❌ | ✅ gpt-4o-mini |
| **AI Settings CRUD** | ✅ TS | ❌ | ❌ | ❌ | ❌ |
| **Voice Processing** | ✅ HTTP | ✅ Python | ✅ Python | ✅ Optional | ✅ Whisper+GPT-4 |
| **Support Bot** | ✅ HTTP | ✅ Python | ✅ Python | ✅ Optional | ✅ gpt-4o-mini |
| **Action Execution** | ✅ TS | ❌ | ❌ | ❌ | ❌ |

### LangGraph Specifics

**Where LangGraph is used:**
- `services/ai/app/workflows/voice_processing.py` - Voice message workflow
- `services/ai/app/workflows/support_bot.py` - Customer support workflow

**LangGraph imports:**
```python
from langgraph.graph import END, StateGraph
```

**State definition pattern:**
```python
class VoiceProcessingState(TypedDict):
    message_id: str
    audio_url: str
    customer_phone: str
    organization_id: str
    status: Literal["transcribing", "translating", ...]
    transcription: str | None
    extraction: JobExtraction | None
    confidence: float | None
    # ... more fields
```

### LangSmith Integration

**Setup (`services/ai/app/middleware/monitoring.py`):**
```python
def setup_langsmith() -> None:
    if settings.LANGSMITH_API_KEY:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = settings.LANGSMITH_API_KEY
        os.environ["LANGCHAIN_PROJECT"] = settings.LANGSMITH_PROJECT
```

**Environment Variables:**
- `LANGSMITH_API_KEY` - API key for tracing
- `LANGSMITH_PROJECT` - Project name (default: `campotech-ai`)
- `LANGCHAIN_TRACING_V2` - Enable v2 tracing

---

## 4. Key Files Reference

### TypeScript/Next.js Files

| File | Path | Purpose |
|------|------|---------|
| WhatsApp Page | `apps/web/app/dashboard/whatsapp/page.tsx` | Main conversation UI |
| CopilotPanel | `apps/web/app/dashboard/whatsapp/components/CopilotPanel.tsx` | AI Copilot UI |
| AI Settings Page | `apps/web/app/dashboard/settings/ai-assistant/page.tsx` | AI configuration |
| WhatsApp Settings | `apps/web/app/dashboard/settings/whatsapp/page.tsx` | BSP integration |
| AI Context | `apps/web/lib/ai-assistant-context.tsx` | Global AI state |
| Copilot Chat API | `apps/web/app/api/copilot/chat/route.ts` | Chat endpoint |
| AI Test API | `apps/web/app/api/settings/ai-assistant/test/route.ts` | Test sandbox |
| AI Settings API | `apps/web/app/api/settings/ai-assistant/route.ts` | CRUD endpoint |
| Execute Action API | `apps/web/app/api/copilot/execute-action/route.ts` | Action execution |
| Voice AI Service | `apps/web/lib/services/voice-ai-service.ts` | Python bridge |
| Webhook Handler | `apps/web/app/api/whatsapp/webhook/route.ts` | WhatsApp events |

### Python/LangGraph Files

| File | Path | Purpose |
|------|------|---------|
| Voice Workflow | `services/ai/app/workflows/voice_processing.py` | LangGraph voice processing |
| Support Bot | `services/ai/app/workflows/support_bot.py` | LangGraph support |
| Monitoring | `services/ai/app/middleware/monitoring.py` | LangSmith setup |
| Main App | `services/ai/main.py` | FastAPI entry point |
| Config | `services/ai/app/config.py` | Settings/env vars |

---

## 5. Configuration System

### AIConfiguration Schema (Prisma)

```prisma
model AIConfiguration {
  id                      String   @id @default(cuid())
  organizationId          String   @unique
  
  // Master controls
  isEnabled               Boolean  @default(false)
  autoResponseEnabled     Boolean  @default(true)
  
  // Confidence thresholds
  minConfidenceToRespond  Int      @default(70)
  minConfidenceToCreateJob Int     @default(85)
  
  // Data access
  dataAccessPermissions   Json?    // Permissions object
  
  // Company context
  companyName             String?
  companyDescription      String?
  servicesOffered         Json?    // ServiceInfo[]
  businessHours           Json?    // Day -> {open, close}
  serviceAreas            String?
  pricingInfo             String?
  
  // Policies
  cancellationPolicy      String?
  paymentMethods          String?
  warrantyInfo            String?
  
  // FAQ and instructions
  faqItems                Json?    // FAQItem[]
  customInstructions      String?
  
  // Behavior
  aiTone                  String   @default("friendly_professional")
  greetingMessage         String?
  awayMessage             String?
  transferKeywords        String[] @default([])
  
  // Escalation
  escalationUserId        String?
  escalationUser          User?    @relation(...)
}
```

### Data Access Permissions

```typescript
interface DataAccessPermissions {
  companyInfo: boolean;           // Company name/description
  services: boolean;              // Service catalog
  pricing: boolean;               // Price information
  businessHours: boolean;         // Operating hours
  serviceAreas: boolean;          // Service zones
  technicianNames: boolean;       // Real names (privacy)
  technicianAvailability: boolean; // Availability status
  scheduleSlots: boolean;         // Available time slots
  faq: boolean;                   // FAQ access
  policies: boolean;              // Business policies
}
```

### Configuration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AIConfiguration Usage                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Read By:                                                                   │
│  ├── /api/settings/ai-assistant (GET/PUT) - Full config                    │
│  ├── /api/copilot/chat - businessHours for schedule context                │
│  ├── /api/settings/ai-assistant/test - All fields for prompt building      │
│  └── Python Voice AI - workflow_permissions in state                       │
│                                                                             │
│  Written By:                                                                │
│  ├── AI Settings Page - User saves configuration                           │
│  └── AIStatusToggle - Quick enable/disable                                 │
│                                                                             │
│  Role Requirements:                                                         │
│  ├── Read: Any authenticated user                                          │
│  └── Write: OWNER or DISPATCHER only                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Code Accuracy Assessment

### ✅ Well-Designed Patterns

| Pattern | Location | Description |
|---------|----------|-------------|
| Context Sync | `ai-assistant-context.tsx` | Shares AI state between pages correctly |
| Rate Limiting | `copilot/chat/route.ts:118` | Uses `checkCombinedAILimits()` (Phase 8) |
| Transfer Keywords | `test/route.ts:172-204` | Spanish verb stemming for matching |
| Data Privacy | `test/route.ts:502-546` | `dataAccessPermissions` filtering |
| Real-Time Data | `test/route.ts:301-377` | Live technician availability |
| Audit Logging | `copilot/chat/route.ts:424-437` | AIConversationLog for all interactions |
| Role-Based Access | Multiple files | OWNER/DISPATCHER for config, TECHNICIAN limited |
| Idempotency | `webhook/route.ts:193-197` | `wasMessageProcessed()` prevents duplicates |

### ⚠️ Potential Issues

| Issue | Location | Description |
|-------|----------|-------------|
| Model Inconsistency | Multiple | Copilot: gpt-4o-mini, Voice: gpt-4 |
| No Web AI Tracing | Web APIs | LangSmith only in Python service |
| Threshold Duplication | TS + Python | Confidence thresholds in both configs |
| Translation Timing | voice_processing.py | Permission checked after transcription |

### 💡 Recommendations

1. **Unified Tracing**: Consider adding OpenTelemetry to web AI endpoints
2. **Config Centralization**: Single source of truth for thresholds
3. **Model Strategy**: Document intentional model choices
4. **Permission Pre-check**: Verify permissions before expensive operations

---

## 7. Data Flow Diagrams

### Complete AI Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AI REQUEST TYPES                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐   │
│  │  Copilot Chat   │         │   AI Test       │         │  Voice Message  │   │
│  │  (Dashboard)    │         │   (Settings)    │         │  (WhatsApp)     │   │
│  └────────┬────────┘         └────────┬────────┘         └────────┬────────┘   │
│           │                           │                           │             │
│           ▼                           ▼                           ▼             │
│  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐   │
│  │ /api/copilot/   │         │ /api/settings/  │         │ /api/whatsapp/  │   │
│  │ chat            │         │ ai-assistant/   │         │ webhook         │   │
│  │                 │         │ test            │         │                 │   │
│  └────────┬────────┘         └────────┬────────┘         └────────┬────────┘   │
│           │                           │                           │             │
│           │ OpenAI                    │ OpenAI                    │ HTTP        │
│           │ gpt-4o-mini               │ gpt-4o-mini               │             │
│           │                           │                           │             │
│           ▼                           ▼                           ▼             │
│  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐   │
│  │ Response with   │         │ JSON Analysis   │         │ Python Service  │   │
│  │ Actions         │         │ Object          │         │ (LangGraph)     │   │
│  └─────────────────┘         └─────────────────┘         └─────────────────┘   │
│                                                                                 │
│  Technology:                 Technology:                 Technology:            │
│  • TypeScript               • TypeScript                • Python                │
│  • OpenAI SDK               • OpenAI SDK                • LangGraph             │
│  • NO LangGraph             • NO LangGraph              • LangChain             │
│  • NO LangSmith             • NO LangSmith              • LangSmith (optional)  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Database Entities Involved

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE ENTITIES                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  AIConfiguration (per Organization)                                             │
│  ├── Settings and thresholds                                                    │
│  ├── Company knowledge base                                                     │
│  └── Permissions and behavior                                                   │
│                                                                                 │
│  AIConversationLog (audit trail)                                                │
│  ├── organizationId                                                             │
│  ├── conversationId                                                             │
│  ├── customerMessage                                                            │
│  ├── detectedIntent                                                             │
│  ├── confidenceScore                                                            │
│  ├── aiResponse                                                                 │
│  └── feedbackType                                                               │
│                                                                                 │
│  WaConversation (WhatsApp)                                                      │
│  ├── Messages                                                                   │
│  ├── Customer link                                                              │
│  └── aiEnabled toggle                                                           │
│                                                                                 │
│  Job (created by AI)                                                            │
│  ├── Source: 'voice_ai_auto' or 'copilot'                                      │
│  └── Linked to customer and conversation                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix: Quick Reference

### Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `OPENAI_API_KEY` | Both | OpenAI API access |
| `VOICE_AI_SERVICE_URL` | Web | Python service URL |
| `VOICE_AI_SERVICE_KEY` | Web | Python service auth |
| `VOICE_AI_ENABLED` | Web | Master toggle |
| `LANGSMITH_API_KEY` | Python | LangSmith tracing |
| `LANGSMITH_PROJECT` | Python | Project name |
| `LANGCHAIN_TRACING_V2` | Python | Enable v2 tracing |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/settings/ai-assistant` | GET/PUT | AI configuration CRUD |
| `/api/settings/ai-assistant/test` | POST | Test AI sandbox |
| `/api/copilot/chat` | POST | Copilot conversation |
| `/api/copilot/execute-action` | POST | Execute AI actions |
| `/api/copilot/availability` | GET | Check availability |
| `/api/whatsapp/webhook` | POST | Incoming messages |

### Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `useAIAssistant()` | ai-assistant-context.tsx | AI state hook |
| `processVoiceMessageWithAI()` | voice-ai-service.ts | Voice processing entry |
| `buildTestSystemPrompt()` | test/route.ts | Dynamic prompt generation |
| `route_by_confidence()` | voice_processing.py | LangGraph routing |
| `build_voice_workflow()` | voice_processing.py | LangGraph graph builder |

---

*Document generated: 2026-02-06*
