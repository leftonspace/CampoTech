# WhatsApp AI - Remaining Implementation Tasks

## Current State vs. Landing Page Promise

| Feature | Landing Page | Current State | Gap |
|---------|--------------|---------------|-----|
| AI Auto-Response | Shows instant replies | Works, but generic | Need scheduling context |
| Schedule Conflict Detection | Shows "Juan está ocupado..." | Scheduling service built | Need to integrate into responses |
| Voice Transcription | Shows voice memo note | Whisper API works | Need better UI indicator |
| Auto Client Creation | Implied by flow | Manual confirmation needed | Need auto-create workflow |
| Auto Job Creation | Shows "Trabajo creado" | Partial - needs confirmation | Need high-confidence auto-create |
| Technician Assignment | Shows tech notification | Works via triggers | ✅ Complete |
| Contact List AI % | Shows "91% IA Resuelto" | Not displayed | Need to track and show |
| One-Click Booking | Implied in Scenario 1 | Multi-step process | Need streamlined flow |

---

## Architecture Decision: Workflows vs. Pure AI

### Current Approach (Problems)
```
Customer: "Quiero un turno para mañana"
     ↓
AI analyzes → extracts entities → shouldCreateJob=true → creates job
```

**Issues:**
- No validation of required fields
- No check if customer exists
- No confirmation of technician availability
- AI might hallucinate missing data

### Recommended: Action-Based Workflows

```
Customer: "Quiero un turno para mañana"
     ↓
AI analyzes → intent: BOOKING → triggers BookingWorkflow
     ↓
BookingWorkflow:
  1. Check/create customer (by phone)
  2. Validate service type
  3. Query scheduling intelligence
  4. Find best slot
  5. Assign technician
  6. Create job
  7. Send confirmation
  8. Notify technician
```

### Defined Actions

| Action | Trigger | Workflow |
|--------|---------|----------|
| `BOOKING` | "turno", "cita", "agendar", dates | BookingWorkflow |
| `CHECK_STATUS` | "estado", "cómo va", job number | StatusCheckWorkflow |
| `RESCHEDULE` | "cambiar fecha", "reprogramar" | RescheduleWorkflow |
| `CANCEL` | "cancelar", "anular" | CancellationWorkflow |
| `QUESTION` | Questions without booking intent | QuestionAnswerWorkflow |
| `COMPLAINT` | Negative sentiment, "problema" | EscalationWorkflow |
| `HUMAN_TRANSFER` | "hablar con alguien", transfer keywords | TransferWorkflow |

---

## Task Breakdown

### Phase 1: Core Workflow System (Priority: HIGH)

#### Task 1.1: Create Action Workflow Base
**File:** `apps/web/lib/services/workflows/base-workflow.ts`

```typescript
interface WorkflowStep {
  id: string;
  execute: (context: WorkflowContext) => Promise<StepResult>;
  rollback?: (context: WorkflowContext) => Promise<void>;
}

interface WorkflowContext {
  organizationId: string;
  conversationId: string;
  customerId?: string;
  message: IncomingMessage;
  extractedEntities: Record<string, any>;
  schedulingContext?: SchedulingIntelligenceResult;
  stepResults: Map<string, StepResult>;
}

abstract class BaseWorkflow {
  abstract steps: WorkflowStep[];
  abstract canHandle(intent: string, entities: Record<string, any>): boolean;

  async execute(context: WorkflowContext): Promise<WorkflowResult> {
    for (const step of this.steps) {
      const result = await step.execute(context);
      if (!result.success) {
        // Rollback previous steps
        await this.rollback(context);
        return { success: false, failedStep: step.id, error: result.error };
      }
      context.stepResults.set(step.id, result);
    }
    return { success: true, data: context.stepResults };
  }
}
```

**Effort:** 4 hours

---

#### Task 1.2: Implement BookingWorkflow
**File:** `apps/web/lib/services/workflows/booking-workflow.ts`

Steps:
1. **FindOrCreateCustomer** - Lookup by phone, create if not exists
2. **ValidateServiceType** - Check service exists in organization
3. **GetSchedulingContext** - Call SchedulingIntelligenceService
4. **ValidateTimeSlot** - Ensure requested time has availability
5. **SelectTechnician** - Pick best available based on workload/distance
6. **CreateJob** - Create job record with all validated data
7. **AssignTechnician** - Create job assignment
8. **SendConfirmation** - WhatsApp confirmation to customer
9. **NotifyTechnician** - Push notification to assigned tech

**Effort:** 8 hours

---

#### Task 1.3: Integrate Workflows into AI Responder
**File:** `apps/web/lib/services/whatsapp-ai-responder.ts`

```typescript
// After AI analysis
if (analysis.intent === 'booking' && analysis.confidence >= 70) {
  const workflow = new BookingWorkflow();
  const result = await workflow.execute({
    organizationId: message.organizationId,
    conversationId: message.conversationId,
    message,
    extractedEntities: analysis.extractedEntities,
    schedulingContext,
  });

  if (result.success) {
    return {
      action: 'create_job',
      response: this.buildBookingConfirmation(result),
      jobCreated: result.data.get('CreateJob'),
    };
  }
}
```

**Effort:** 4 hours

---

### Phase 2: UI Enhancements (Priority: MEDIUM)

#### Task 2.1: Add AI Confidence to Conversation List
**Files:**
- `apps/web/app/dashboard/whatsapp/page.tsx`
- `apps/web/app/api/whatsapp/conversations/route.ts`

Display:
```
┌─────────────────────────────────────┐
│ 🟢 María García          15:32    │
│ "Hola, necesito un técnico..."     │
│ IA: 94% ✓                          │
├─────────────────────────────────────┤
│ 🟡 Carlos Ruiz            14:18    │
│ "Tengo un problema con..."         │
│ IA: 45% ⚠️ Requiere atención       │
└─────────────────────────────────────┘
```

Data source: `AIConversationLog.confidenceScore` (already stored)

**Effort:** 4 hours

---

#### Task 2.2: Create AI Resolution Analytics Dashboard
**File:** `apps/web/app/dashboard/analytics/ai/page.tsx`

Metrics:
- Total conversations
- AI-resolved vs human-handled
- Average confidence score
- Response time
- Most common intents
- Booking conversion rate

```sql
SELECT
  COUNT(*) as total,
  AVG(confidence_score) as avg_confidence,
  SUM(CASE WHEN response_status = 'sent' THEN 1 ELSE 0 END) as ai_resolved,
  SUM(CASE WHEN response_status = 'transferred' THEN 1 ELSE 0 END) as transferred
FROM "AIConversationLog"
WHERE organization_id = $1
  AND created_at >= NOW() - INTERVAL '30 days'
```

**Effort:** 6 hours

---

### Phase 3: Automation Improvements (Priority: MEDIUM)

#### Task 3.1: Auto-Client Creation
**File:** `apps/web/lib/services/workflows/steps/find-or-create-customer.ts`

Logic:
1. Search customer by phone number (exact match)
2. If found, return existing customer
3. If not found:
   - Extract name from conversation (AI or ask)
   - Create customer with phone + name
   - Mark source as 'whatsapp_ai'

```typescript
async execute(context: WorkflowContext): Promise<StepResult> {
  const phone = context.message.customerPhone;

  let customer = await prisma.customer.findFirst({
    where: { organizationId: context.organizationId, phone }
  });

  if (!customer) {
    const name = context.extractedEntities.customerName || 'Cliente WhatsApp';
    customer = await prisma.customer.create({
      data: {
        organizationId: context.organizationId,
        phone,
        name,
        source: 'whatsapp_ai',
      }
    });
  }

  context.customerId = customer.id;
  return { success: true, data: customer };
}
```

**Effort:** 3 hours

---

#### Task 3.2: One-Click Booking (High Confidence)
**Threshold:** confidence >= 85% AND all required fields present

Required fields for auto-booking:
- Service type (mapped to organization's services)
- Date (explicit or inferred)
- Time slot with availability
- Customer phone (from WhatsApp)

If all present + high confidence:
1. Skip confirmation step
2. Create job immediately
3. Send "¡Listo! Tu turno está confirmado para [date] a las [time]"

**Effort:** 4 hours

---

### Phase 4: Voice & Media Handling (Priority: LOW)

#### Task 4.1: Voice Message Indicator in UI
Show microphone icon + "Transcripción:" prefix for voice messages

**Effort:** 2 hours

#### Task 4.2: Image Handling
- Store image URL
- Show thumbnail in conversation
- AI can reference "the image the customer sent"

**Effort:** 4 hours

---

## Priority Order

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 1 | BookingWorkflow | 8h | HIGH - Core functionality |
| 2 | AI Confidence in UI | 4h | MEDIUM - User visibility |
| 3 | Auto-Client Creation | 3h | HIGH - Reduces friction |
| 4 | Workflow Base System | 4h | HIGH - Foundation |
| 5 | One-Click Booking | 4h | HIGH - Landing page promise |
| 6 | Analytics Dashboard | 6h | MEDIUM - Business insights |
| 7 | Voice UI Indicator | 2h | LOW - Polish |
| 8 | Image Handling | 4h | LOW - Nice to have |

**Total estimated effort:** ~35 hours

---

## Quick Wins (Can do in < 2 hours each)

1. **Show transcription in conversation view** - Already have the data
2. **Add "IA" badge to auto-responses** - Visual indicator
3. **Store confidence score on waMessage** - For history/analytics
4. **Add "Ver detalle IA" button** - Show extracted entities

---

## Data Flow Summary

```
┌──────────────────┐
│  WhatsApp        │
│  Webhook         │
└────────┬─────────┘
         ↓
┌──────────────────┐
│  Queue Processor │
│  (whatsapp.ai)   │
└────────┬─────────┘
         ↓
┌──────────────────┐     ┌─────────────────────┐
│  AI Responder    │────→│ Scheduling          │
│  (GPT-4o-mini)   │     │ Intelligence        │
└────────┬─────────┘     └─────────────────────┘
         ↓
┌──────────────────┐
│  Intent + Entities│
│  + Confidence     │
└────────┬─────────┘
         ↓
┌──────────────────┐
│  Workflow        │
│  Router          │
└────────┬─────────┘
         ↓
┌──────────────────────────────────────────────┐
│  BookingWorkflow / StatusWorkflow / etc      │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│  │Step1│→│Step2│→│Step3│→│Step4│→│Step5│    │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘    │
└──────────────────────────────────────────────┘
         ↓
┌──────────────────┐
│  Response +      │
│  Side Effects    │
│  (Job, Customer) │
└──────────────────┘
```
