# AI Architecture Deep Dive
> How the AI System Works, Data Access, and Configuration Flow

## Overview

CampoTech has two distinct AI systems that work together:

1. **WhatsApp Auto-Responder** - Autonomous AI that responds to customers
2. **AI Copilot** - Internal assistant helping operators manage conversations

---

## 🔌 How Settings Wire to AI Behavior

### Configuration Storage Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AI Settings Page                                     │
│  /dashboard/settings/ai-assistant                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ General │ Empresa │ Horarios │ FAQ │ Idiomas │ Avanzado │ Permisos  ││
│  └─────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼ PUT /api/settings/ai-assistant
┌─────────────────────────────────────────────────────────────────────────┐
│                     AIConfiguration (Prisma)                             │
│  - isEnabled                  - customInstructions                      │
│  - autoResponseEnabled        - aiTone ("friendly_professional", etc)   │
│  - minConfidenceToRespond     - greetingMessage                         │
│  - minConfidenceToCreateJob   - awayMessage                             │
│  - companyName                - transferKeywords                        │
│  - companyDescription         - dataAccessPermissions (JSON)            │
│  - servicesOffered (JSON)     - businessHours (JSON)                    │
│  - faqItems (JSON)            - escalationUserId                        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼ Read by AI Systems
┌─────────────────────────────────────────────────────────────────────────┐
│                     AI Processing Endpoints                              │
│  /api/copilot/chat          - Copilot queries settings.businessHours    │
│  /api/copilot/availability  - Queries technicians + scheduled jobs      │
│  /api/whatsapp/ai-response  - Auto-responder uses all config            │
└─────────────────────────────────────────────────────────────────────────┘
```

### What Each Setting Controls

| Setting | Where Used | Effect |
|---------|-----------|--------|
| `isEnabled` | AIAssistantContext | Master on/off for both systems |
| `minConfidenceToRespond` | WhatsApp auto-responder | Below this → transfer to human |
| `minConfidenceToCreateJob` | Auto-responder | Below this → ask confirmation |
| `aiTone` | System prompts | "vos" vs "usted", formal vs casual |
| `businessHours` | Copilot + auto-responder | Available slots calculation |
| `dataAccessPermissions` | Prompt building | What info to include in context |
| `transferKeywords` | Intent detection | "queja", "reclamo" → escalate |
| `faqItems` | Context building | Pre-built answers for common Qs |

---

## 🔐 Data Access Permissions

### What the AI Can/Cannot See

The `dataAccessPermissions` object controls exactly what information is shared with GPT:

```typescript
interface DataAccessPermissions {
  companyInfo: boolean;          // Company name, description
  services: boolean;             // Services offered list
  pricing: boolean;              // Price ranges (sensitive!)
  businessHours: boolean;        // Operating hours
  serviceAreas: boolean;         // Geographic coverage
  technicianNames: boolean;      // Real names vs "un técnico"
  technicianAvailability: boolean; // Who is available now
  scheduleSlots: boolean;        // Available appointment times
  faq: boolean;                  // Pre-built Q&A pairs
  policies: boolean;             // Cancellation, warranty, payments
}
```

### Default Privacy Settings

```typescript
// Default: Privacy-first approach
{
  technicianNames: false,     // 🔒 Hidden by default
  pricing: true,              // ⚠️ Consider hiding for custom quotes
  technicianAvailability: true,
  scheduleSlots: true,
  // ...all others: true
}
```

### How Permissions Affect Prompts

When `technicianNames: false`:
> "Mañana puede ir un **técnico** a las 10:00"

When `technicianNames: true`:
> "Mañana puede ir **Carlos López** a las 10:00"

---

## 🧠 AI Scope Limits

### What the AI CAN Do

| Action | AI Type | Implementation |
|--------|---------|----------------|
| Suggest replies | Copilot | `/api/copilot/chat` with intent detection |
| Check availability | Both | `/api/copilot/availability` + DB query |
| Create job drafts | Copilot | Generates proposal, human confirms |
| Answer FAQs | Auto-responder | Matches to configured FAQ |
| Translate messages | Both | GPT translation + store language |
| Greet customers | Auto-responder | Uses `greetingMessage` config |
| Escalate to human | Both | Detects `transferKeywords` |

### What the AI CANNOT Do (Scope Limits)

| Action | Why Not | Workaround |
|--------|---------|------------|
| Create jobs directly | Requires confirmation | Shows draft → human approves |
| Send payments | No payment integration | Provides payment info only |
| Access customer invoices | Privacy concern | Only if explicitly shared |
| Delete data | Destructive action | Human-only operation |
| Change settings | Security | Settings page only |
| Access other orgs | Multi-tenant isolation | organizationId in all queries |

### Scope Enforcement Code

The scope is enforced through:

1. **System Prompt Boundaries**:
```typescript
const SYSTEM_PROMPT = `Tu rol es INTERNO - nunca te comunicas 
directamente con los clientes. Solo ayudas al operador humano.
...
Siempre confirmá antes de ejecutar acciones que crean/modifican datos`
```

2. **Intent Detection** (regex patterns):
```typescript
const isJobRequest = /crear?.* trabajo|agenda|cita|visita/i.test(message);
const isScheduleRequest = /horario|disponib|agenda|libre|turno/i.test(message);
```

3. **Out-of-Scope Responses** (as seen in screenshot):
> "No puedo ayudarte con eso, pero puedo asistirte en gestionar 
> la solicitud de plomería..."

---

## 📊 How AI Interprets Information

### Intent Detection Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     User Message                                     │
│  "verificame la agenda para mañana a que hora le damos turno"       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Intent Detection (Regex)                         │
│  isJobRequest?     /crear?.* trabajo|agenda|cita|visita/i   → false │
│  isReplyRequest?   /respuesta|responder|contestar/i         → false │
│  isSummaryRequest? /resumen|resumí|de qué se trata/i        → false │
│  isScheduleRequest?/horario|disponib|agenda|libre|turno/i   → TRUE  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Context Enrichment                               │
│  If isScheduleRequest → fetch real availability from database       │
│  - Query AIConfiguration for businessHours                          │
│  - Query jobs scheduled for target date                             │
│  - Query active technicians                                         │
│  - Calculate available vs occupied slots                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Build Full Prompt                                │
│  SYSTEM_PROMPT                                                       │
│  + languageAddendum (if customer speaks non-Spanish)                │
│  + scheduleContext:                                                  │
│    "DATOS REALES DE AGENDA (mañana, 22/01/2026):                   │
│     - Horario de trabajo: 9:00 a 18:00                              │
│     - Técnicos disponibles: Juan, Pedro                             │
│     - Horarios DISPONIBLES: 09:00-11:00, 13:00-15:00, 15:00-17:00  │
│     - Horarios OCUPADOS: 11:00-13:00                                │
│     IMPORTANTE: Usá SOLO estos horarios reales, NO inventes."      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     GPT-4o-mini Response                             │
│  Uses ONLY the real data provided                                    │
│  → Suggests available slots from the list                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Why the AI No Longer Makes Up Times

Before Phase 4:
- No schedule data passed to GPT
- GPT "hallucinated" times like 10:00, 14:00, 16:00

After Phase 4:
- Real database query runs first
- Exact available/occupied slots in prompt
- Explicit instruction: "NO inventes horarios"

---

## 🛠️ Action Fetching Flow

### When User Requests an Action

```typescript
// 1. Detect intent from message
const isJobRequest = /crear?.* trabajo/i.test(message);

// 2. If schedule-related, fetch real data
if (isScheduleRequest || isJobRequest) {
  const aiConfig = await prisma.aIConfiguration.findUnique({
    where: { organizationId },
    select: { businessHours: true }
  });
  
  const jobs = await prisma.job.findMany({
    where: { organizationId, scheduledDate: { gte: targetDate, lte: endOfDay } }
  });
  
  const technicians = await prisma.user.findMany({
    where: { organizationId, role: 'TECHNICIAN', isActive: true }
  });
  
  // Calculate slots...
  scheduleContext = `DATOS REALES: ...`;
}

// 3. Build prompt with real context
const fullSystemPrompt = SYSTEM_PROMPT + languageAddendum + scheduleContext;

// 4. Call OpenAI
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'system', content: fullSystemPrompt }, ...],
});

// 5. Add action buttons based on intent
if (isJobRequest) {
  actions.push({ id: 'confirm', label: 'Confirmar y crear', action: 'create_job' });
  actions.push({ id: 'modify', label: 'Modificar', action: 'modify' });
}

// 6. Log to AIConversationLog
await prisma.aIConversationLog.create({
  data: { organizationId, conversationId, detectedIntent: intent, ... }
});
```

### Action Types and Their Data Sources

| Action | Data Source | Endpoint |
|--------|-------------|----------|
| `check_schedule` | `Job`, `User` tables | `/api/copilot/availability` |
| `create_job` | Form collected from AI | `/api/jobs` (after confirm) |
| `suggest_reply` | GPT + conversation context | `/api/copilot/chat` |
| `transfer` | `transferKeywords` config | Marks conversation for human |
| `summary` | Conversation messages | GPT summarization |

---

## 🔄 Real-Time Updates

### How WhatsApp Messages Reach Copilot

```
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│    WhatsApp        │────▶│   Pusher Event     │────▶│   AIActivityFeed   │
│    Webhook         │     │   "new-message"    │     │   Re-analyzes      │
│/api/whatsapp/webhook│    │   organizationId   │     │   conversation     │
└────────────────────┘     └────────────────────┘     └────────────────────┘
```

The `useEffect` in CopilotPanel listens for new messages and triggers re-analysis.

---

## 📈 Confidence Scoring

### How Confidence Affects Behavior

| Confidence | Action |
|------------|--------|
| ≥ `minConfidenceToRespond` (default 70%) | Auto-respond in WhatsApp |
| < `minConfidenceToRespond` | Transfer to human |
| ≥ `minConfidenceToCreateJob` (default 85%) | Create job automatically |
| < `minConfidenceToCreateJob` | Ask customer for confirmation |

### Where Confidence Comes From

For the copilot, confidence is always 100% (explicit user requests).

For auto-responder, GPT returns confidence based on:
- How well the message matches known patterns
- Whether FAQ has an exact match
- Clarity of customer intent

---

## 🔐 Security Boundaries

### Organization Isolation

Every query includes `organizationId`:
```typescript
where: { organizationId: session.organizationId }
```

### No Cross-Org Data Leakage

- Technicians from org A never appear in org B
- Jobs, customers, invoices all scoped
- AI config is per-organization

### User Role Restrictions

Only `OWNER` and `ADMIN` can:
- Access copilot
- Configure AI settings
- View AI conversation logs

---

## 🎯 Improving AI Understanding

### To Make AI Better Understand Requests:

1. **Add Keywords to Intent Detection**:
```typescript
// Current
const isScheduleRequest = /horario|disponib|agenda|libre|turno|verificar/i.test(message);

// Add more patterns as discovered
const isScheduleRequest = /horario|disponib|agenda|libre|turno|verificar|cuándo|hora/i.test(message);
```

2. **Add Custom Instructions**:
The `customInstructions` field in AI config allows org-specific rules:
> "Siempre ofrecé visita de diagnóstico antes de presupuestar"

3. **Train with FAQ**:
Add common Q&A pairs to improve consistent responses.

4. **Feedback Loop**:
`AIConversationLog` tracks all interactions with `wasHelpful` flag for future training.

---

*Last updated: January 21, 2026*
