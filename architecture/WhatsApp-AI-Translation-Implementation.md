# WhatsApp AI Translation & Enhancement - Implementation Plan

> **Purpose**: This document is the definitive implementation guide for adding translation capabilities, feedback collection, and technician Copilot access to the CampoTech WhatsApp AI system.

---

## 📁 Current Codebase Structure

### Web Application (`apps/web`)
| Path | Purpose |
|:---|:---|
| `app/dashboard/whatsapp/page.tsx` | Main WhatsApp CRM page |
| `app/dashboard/whatsapp/components/CopilotPanel.tsx` | Internal AI assistant for staff (495 lines) |
| `app/dashboard/whatsapp/components/AIAssistantPanel.tsx` | Quick action buttons for staff (253 lines) |
| `app/dashboard/whatsapp/components/AIActionBanner.tsx` | Action cards display (398 lines) |
| `app/dashboard/whatsapp/components/MessageBubble.tsx` | Chat message rendering (17KB) |
| `app/dashboard/whatsapp/components/ChatWindow.tsx` | Main chat interface |
| `app/dashboard/settings/ai-assistant/page.tsx` | AI settings configuration (56KB) |
| `app/api/copilot/chat/route.ts` | Copilot chat API (269 lines) |
| `app/api/copilot/execute-action/route.ts` | Action execution API (147 lines) |
| `app/api/settings/ai-assistant/route.ts` | Settings CRUD API |
| `app/api/settings/ai-assistant/test/route.ts` | Test AI configuration |

### Python AI Service (`services/ai`)
| Path | Purpose |
|:---|:---|
| `app/workflows/voice_processing.py` | LangGraph voice → job workflow (380 lines) |
| `app/workflows/support_bot.py` | LangGraph support FAQ workflow (623 lines) |
| `app/integrations/openai_client.py` | Whisper + GPT integration (222 lines) |
| `app/integrations/whatsapp.py` | WhatsApp message sending (123 lines) |
| `app/models/schemas.py` | Pydantic models (143 lines) |

### Mobile App (`apps/mobile`)
| Path | Purpose |
|:---|:---|
| `app/(tabs)/_layout.tsx` | Role-based tab navigation |
| `app/(tabs)/today.tsx` | Today's jobs view |
| `app/(tabs)/jobs/` | Job management screens |
| `app/settings/` | Settings screens (no WhatsApp yet) |

### Database (Prisma Schema)
| Model | Relevant Fields |
|:---|:---|
| `Organization` | `aiConfiguration` relation |
| `AIConfiguration` | `isEnabled`, `autoResponseEnabled`, `dataAccessPermissions`, etc. |
| `AIConversationLog` | `wasHelpful`, `feedbackNotes`, `correctedResponse` |
| `WaConversation` | `customerPhone`, `customerId`, `assignedToId` |
| `WaMessage` | `content`, `aiActionTaken`, `aiConfidence`, `senderType` |

---

## 🚀 Implementation Phases

---

## Phase 1: Feedback Collection (Week 1-2)

### Goal
Add 👍/👎 feedback buttons to AI suggestions for training data collection.

### 1.1 Database Changes
**File**: `apps/web/prisma/schema.prisma`

Add fields to `WaMessage`:
```prisma
model WaMessage {
  // ... existing fields
  
  // NEW: Feedback tracking
  aiFeedback         String?   // "positive" | "negative" | null
  aiFeedbackAt       DateTime?
  aiFeedbackUserId   String?
}
```

Add fields to `AIConversationLog` (already has `wasHelpful`, extend):
```prisma
model AIConversationLog {
  // ... existing fields
  
  // NEW: Granular feedback
  feedbackType       String?   // "response" | "action" | "translation"
  userModified       Boolean   @default(false)
  modifiedContent    String?
}
```

### 1.2 API Endpoint
**Create**: `apps/web/app/api/ai/feedback/route.ts`

```typescript
// POST /api/ai/feedback
interface FeedbackRequest {
  messageId?: string;
  conversationLogId?: string;
  feedback: 'positive' | 'negative';
  feedbackType: 'response' | 'action' | 'translation';
  modifiedContent?: string;
}
```

### 1.3 UI Component
**Modify**: `apps/web/app/dashboard/whatsapp/components/AIActionBanner.tsx`

Add to `AIActionBannerProps`:
```typescript
interface AIActionBannerProps {
  // ... existing
  onFeedback?: (actionId: string, feedback: 'positive' | 'negative') => void;
}
```

Add feedback buttons after action buttons:
```tsx
<div className="flex items-center gap-2 mt-2 border-t pt-2">
  <button onClick={() => onFeedback?.(action.id, 'positive')}>
    <ThumbsUp className="h-4 w-4 text-gray-400 hover:text-green-500" />
  </button>
  <button onClick={() => onFeedback?.(action.id, 'negative')}>
    <ThumbsDown className="h-4 w-4 text-gray-400 hover:text-red-500" />
  </button>
</div>
```

**Modify**: `apps/web/app/dashboard/whatsapp/components/CopilotPanel.tsx`

Add feedback to `CopilotMessageBubble` for suggestion messages.

### 1.4 Tasks
- [ ] 1.1.1 Add `aiFeedback`, `aiFeedbackAt`, `aiFeedbackUserId` to `WaMessage` model
- [ ] 1.1.2 Add `feedbackType`, `userModified`, `modifiedContent` to `AIConversationLog`
- [ ] 1.1.3 Run migration: `pnpm prisma migrate dev --name add-ai-feedback`
- [ ] 1.2.1 Create `/api/ai/feedback/route.ts` with POST handler
- [ ] 1.3.1 Add `ThumbsUp`, `ThumbsDown` imports to `AIActionBanner.tsx`
- [ ] 1.3.2 Add `onFeedback` prop and feedback buttons
- [ ] 1.3.3 Wire up feedback mutation in parent component
- [ ] 1.3.4 Add feedback buttons to `CopilotPanel.tsx` suggestion bubbles
- [ ] 1.3.5 Add feedback API call from `whatsapp/page.tsx`

---

## Phase 2: Translation Core (Week 2-4)

### Goal
Enable language detection, translation, and language preferences.

### 2.1 Database Changes
**File**: `apps/web/prisma/schema.prisma`

Add to `Organization`:
```prisma
model Organization {
  // ... existing
  
  // NEW: Translation settings
  translationEnabled    Boolean   @default(false)
  languagesSpoken       String[]  @default(["es"])
}
```

Add to `WaMessage`:
```prisma
model WaMessage {
  // ... existing
  
  // NEW: Translation tracking
  detectedLanguage      String?
  originalContent       String?   // Customer's original message
  translatedContent     String?   // Spanish translation
  languageConfirmed     Boolean   @default(false)
}
```

Add to `WaConversation`:
```prisma
model WaConversation {
  // ... existing
  
  // NEW: Session language
  sessionLanguage       String?   // Detected customer language for session
}
```

### 2.2 Python Translation Service
**Create**: `services/ai/app/services/translation.py`

```python
from typing import Optional
from pydantic import BaseModel
from app.integrations.openai_client import client

class LanguageResult(BaseModel):
    code: str           # "en", "pt", "fr", etc.
    name: str           # "English", "Portuguese"
    confidence: float   # 0.0 - 1.0

async def detect_language(text: str) -> LanguageResult:
    """Detect language using GPT-4o-mini."""
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "system",
            "content": "Detect the language. Return JSON: {\"code\": \"xx\", \"name\": \"Language Name\", \"confidence\": 0.95}"
        }, {"role": "user", "content": text}],
        response_format={"type": "json_object"},
        temperature=0
    )
    return LanguageResult.model_validate_json(response.choices[0].message.content)

async def translate(
    text: str,
    source_lang: str,
    target_lang: str = "es"
) -> str:
    """Translate with Argentine Spanish awareness."""
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "system",
            "content": f"""Translate from {source_lang} to {target_lang}.
If target is Spanish, use Argentine dialect (vos, bacha not pileta, canilla not grifo).
Preserve technical terms, brand names, and model numbers.
Return only the translation, no explanations."""
        }, {"role": "user", "content": text}],
        temperature=0.3
    )
    return response.choices[0].message.content
```

### 2.3 Whisper Auto-Detect
**Modify**: `services/ai/app/integrations/openai_client.py`

Line 32, change:
```python
# FROM
async def transcribe_audio(audio_data: bytes, language: str = "es") -> str:

# TO
async def transcribe_audio(
    audio_data: bytes,
    language: str | None = None  # None = auto-detect
) -> tuple[str, str]:
    """
    Returns:
        (transcription_text, detected_language_code)
    """
```

Line 45-48, change:
```python
# FROM
response = await client.audio.transcriptions.create(
    model="whisper-1",
    file=("audio.ogg", audio_data, "audio/ogg"),
    language=language,  # Remove this for auto-detect

# TO
kwargs = {
    "model": "whisper-1",
    "file": ("audio.ogg", audio_data, "audio/ogg"),
    "response_format": "verbose_json",  # Get language info
}
if language:
    kwargs["language"] = language
    
response = await client.audio.transcriptions.create(**kwargs)
detected_lang = getattr(response, 'language', 'es')
return response.text, detected_lang
```

### 2.4 Voice Workflow Translation Node
**Modify**: `services/ai/app/workflows/voice_processing.py`

Add new state fields:
```python
class VoiceProcessingState(TypedDict):
    # ... existing
    
    # NEW: Translation
    detected_language: str | None
    original_transcription: str | None
    translated_transcription: str | None
    business_languages: list[str]  # From org settings
```

Add new node after `transcribe_node`:
```python
async def detect_and_translate_node(state: VoiceProcessingState) -> VoiceProcessingState:
    """Detect language and translate if needed."""
    lang = state.get("detected_language", "es")
    
    if lang != "es" and lang not in state.get("business_languages", ["es"]):
        # Business doesn't speak this language, translate
        from app.services.translation import translate
        translated = await translate(
            state["transcription"],
            source_lang=lang,
            target_lang="es"
        )
        return {
            **state,
            "original_transcription": state["transcription"],
            "translated_transcription": translated,
            "transcription": translated,  # Use translated for extraction
        }
    return state
```

Update graph construction to include new node.

### 2.5 AI Settings UI
**Modify**: `apps/web/app/dashboard/settings/ai-assistant/page.tsx`

Add new tab "Idiomas" with:
```tsx
// Languages spoken selector
<div>
  <h3>Idiomas que habla tu equipo</h3>
  <p>Solo traducimos cuando el cliente habla un idioma que no dominás.</p>
  <MultiSelect
    options={ALL_LANGUAGES}
    value={config.languagesSpoken}
    onChange={(langs) => updateConfig('languagesSpoken', langs)}
  />
</div>

// Translation toggle
<div>
  <h3>Traducción automática</h3>
  <Toggle
    checked={config.translationEnabled}
    onChange={(v) => updateConfig('translationEnabled', v)}
    disabled={!canAccessTranslation}  // Plan check
  />
</div>
```

### 2.6 Tasks
- [ ] 2.1.1 Add `translationEnabled`, `languagesSpoken` to `Organization`
- [ ] 2.1.2 Add `detectedLanguage`, `originalContent`, `translatedContent`, `languageConfirmed` to `WaMessage`
- [ ] 2.1.3 Add `sessionLanguage` to `WaConversation`
- [ ] 2.1.4 Run migration: `pnpm prisma migrate dev --name add-translation-fields`
- [ ] 2.2.1 Create `services/ai/app/services/translation.py`
- [ ] 2.2.2 Add `detect_language()` function
- [ ] 2.2.3 Add `translate()` function with Argentine Spanish
- [ ] 2.3.1 Modify `transcribe_audio()` for auto-detect
- [ ] 2.3.2 Update return type to include detected language
- [ ] 2.4.1 Add translation state fields to `VoiceProcessingState`
- [ ] 2.4.2 Create `detect_and_translate_node()`
- [ ] 2.4.3 Add node to workflow graph
- [ ] 2.5.1 Add "Idiomas" tab to AI settings page
- [ ] 2.5.2 Create language multi-select component
- [ ] 2.5.3 Add translation toggle with plan gating

---

## Phase 3: Translation UI Integration (Week 4-5)

### Goal
Display translations in chat UI with confirmation flow.

### 3.1 Language Detection Card
**Modify**: `apps/web/app/dashboard/whatsapp/components/AIActionBanner.tsx`

Add new action type:
```typescript
export type AIActionType =
  // ... existing
  | 'language_detected'
  | 'translation_pending';
```

Add config:
```typescript
language_detected: {
  icon: Globe,
  bgColor: 'bg-blue-50',
  borderColor: 'border-blue-200',
  iconBg: 'bg-blue-100',
  iconColor: 'text-blue-600',
  textColor: 'text-blue-800',
},
```

### 3.2 Message Translation Display
**Modify**: `apps/web/app/dashboard/whatsapp/components/MessageBubble.tsx`

Add translation display for inbound messages:
```tsx
{message.direction === 'inbound' && message.translatedContent && (
  <div className="mt-1 text-xs text-gray-500 border-t pt-1">
    <span className="inline-flex items-center gap-1">
      <RefreshCw className="h-3 w-3" />
      {message.translatedContent}
    </span>
  </div>
)}
```

Add language badge:
```tsx
{message.detectedLanguage && message.detectedLanguage !== 'es' && (
  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
    🌐 {getLanguageName(message.detectedLanguage)}
  </span>
)}
```

### 3.3 Language Confirmation Modal
**Create**: `apps/web/app/dashboard/whatsapp/components/LanguageConfirmationCard.tsx`

```tsx
interface LanguageConfirmationCardProps {
  detectedLanguage: string;
  confidence: number;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function LanguageConfirmationCard({
  detectedLanguage,
  confidence,
  onConfirm,
  onDismiss,
}: LanguageConfirmationCardProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="h-5 w-5 text-blue-600" />
        <span className="font-medium text-blue-800">
          Idioma detectado: {getLanguageName(detectedLanguage)}
        </span>
      </div>
      <p className="text-sm text-blue-700 mb-3">
        ¿Confirmar idioma con el cliente?
      </p>
      <div className="flex gap-2">
        <button onClick={onConfirm} className="btn-primary text-sm">
          ✓ Enviar confirmación
        </button>
        <button onClick={onDismiss} className="btn-ghost text-sm">
          No traducir
        </button>
      </div>
    </div>
  );
}
```

### 3.4 Copilot Translation Integration
**Modify**: `apps/web/app/api/copilot/chat/route.ts`

After getting conversation context:
```typescript
// Detect customer language from recent inbound messages
const recentInbound = context?.messages
  ?.filter(m => m.direction === 'inbound')
  ?.slice(-3)
  ?.map(m => m.content)
  ?.join(' ');

if (recentInbound) {
  const langResult = await detectLanguage(recentInbound);
  if (langResult.code !== 'es' && !businessLanguages.includes(langResult.code)) {
    // Add translation context
    contextMessages.push({
      role: 'system',
      content: `El cliente habla ${langResult.name}. Cuando sugierAs respuestas, escribilas en ${langResult.name}.`
    });
  }
}
```

### 3.5 Tasks
- [ ] 3.1.1 Add `language_detected` action type
- [ ] 3.1.2 Add config styling for language actions
- [ ] 3.2.1 Add translation display to `MessageBubble.tsx`
- [ ] 3.2.2 Add language badge component
- [ ] 3.2.3 Create `getLanguageName()` utility function
- [ ] 3.3.1 Create `LanguageConfirmationCard.tsx` component
- [ ] 3.3.2 Wire up confirmation in chat page
- [ ] 3.4.1 Add language detection to Copilot API
- [ ] 3.4.2 Modify AI prompts for translation

---

## Phase 4: Technician Copilot Access (Week 5-6)

### Goal
Allow technicians to access Copilot for their assigned conversations.

### 4.1 API Permission Update
**Modify**: `apps/web/app/api/copilot/chat/route.ts`

Line 77, change:
```typescript
// FROM
if (!['OWNER', 'DISPATCHER'].includes(session.role?.toUpperCase() || '')) {

// TO
const allowedRoles = ['OWNER', 'DISPATCHER', 'TECHNICIAN'];
if (!allowedRoles.includes(session.role?.toUpperCase() || '')) {
  return NextResponse.json(
    { success: false, error: 'No tenés permiso para usar el co-pilot' },
    { status: 403 }
  );
}

// For TECHNICIAN, verify assignment
if (session.role?.toUpperCase() === 'TECHNICIAN' && conversationId) {
  const conversation = await prisma.waConversation.findFirst({
    where: {
      id: conversationId,
      assignedToId: session.userId,
    },
  });
  if (!conversation) {
    return NextResponse.json(
      { success: false, error: 'No estás asignado a esta conversación' },
      { status: 403 }
    );
  }
}
```

Apply same logic to `execute-action/route.ts`.

### 4.2 Mobile App - Chat Screen
**Create**: `apps/mobile/app/(tabs)/chats/index.tsx`

```tsx
/**
 * Technician Chat List
 * Shows conversations assigned to the current technician
 */
export default function ChatsScreen() {
  const { user } = useAuth();
  const { data: conversations } = useQuery({
    queryKey: ['assigned-conversations'],
    queryFn: () => api.get(`/api/whatsapp/conversations?assignedTo=${user.id}`),
  });
  
  return (
    <FlatList
      data={conversations}
      renderItem={({ item }) => <ConversationItem conversation={item} />}
    />
  );
}
```

### 4.3 Mobile App - Chat Detail with Copilot
**Create**: `apps/mobile/app/(tabs)/chats/[id].tsx`

```tsx
/**
 * Technician Chat Detail
 * Shows conversation with Copilot suggestions
 */
export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams();
  const [copilotSuggestion, setCopilotSuggestion] = useState<string | null>(null);
  
  // ... chat display logic
  
  // Copilot suggestion section
  {copilotSuggestion && (
    <View style={styles.copilotCard}>
      <Text style={styles.copilotLabel}>🤖 Sugerencia</Text>
      <Text>{copilotSuggestion}</Text>
      <View style={styles.copilotActions}>
        <Button title="✓ Enviar" onPress={handleSendSuggestion} />
        <ThumbsUpDownButtons onFeedback={handleFeedback} />
      </View>
    </View>
  )}
}
```

### 4.4 Mobile Tab Navigation Update
**Modify**: `apps/mobile/app/(tabs)/_layout.tsx`

Add chats tab for TECHNICIAN:
```tsx
// After inventory tab
{canSeeChats && (
  <Tabs.Screen
    name="chats"
    options={{
      title: 'Chats',
      tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} />,
    }}
  />
)}

// Add permission check
const canSeeChats = userRole === 'TECHNICIAN' || userRole === 'DISPATCHER' || userRole === 'OWNER';
```

### 4.5 Tasks
- [ ] 4.1.1 Update Copilot chat API to allow TECHNICIAN
- [ ] 4.1.2 Add assignment verification for TECHNICIAN
- [ ] 4.1.3 Update execute-action API with same logic
- [ ] 4.2.1 Create `apps/mobile/app/(tabs)/chats/index.tsx`
- [ ] 4.2.2 Create `ConversationItem` component
- [ ] 4.3.1 Create `apps/mobile/app/(tabs)/chats/[id].tsx`
- [ ] 4.3.2 Create mobile Copilot suggestion card
- [ ] 4.3.3 Create mobile feedback buttons
- [ ] 4.4.1 Add chats tab to navigation
- [ ] 4.4.2 Add `canSeeChats` permission check

---

## Phase 5: Workflow Permissions (Week 6-7)

### Goal
Allow users to configure which AI actions are enabled.

### 5.1 Database Changes
**Modify**: `apps/web/prisma/schema.prisma`

Add to `AIConfiguration`:
```prisma
model AIConfiguration {
  // ... existing
  
  // NEW: Workflow permissions
  workflowPermissions Json @default("{\"suggestResponses\": true, \"translateMessages\": true, \"suggestActions\": true, \"accessDatabase\": true, \"accessSchedule\": true}")
}
```

### 5.2 Settings UI
**Modify**: `apps/web/app/dashboard/settings/ai-assistant/page.tsx`

Add "Permisos de Acción" section:
```tsx
<div className="space-y-4">
  <h3>Permisos de Acción</h3>
  <p className="text-gray-500">Controlá qué puede hacer el AI</p>
  
  <PermissionToggle
    label="Sugerir respuestas"
    description="AI propone respuestas, vos aprobás"
    checked={config.workflowPermissions.suggestResponses}
    onChange={(v) => updateWorkflowPerm('suggestResponses', v)}
  />
  
  <PermissionToggle
    label="Traducir mensajes"
    description="Cuando cliente habla otro idioma"
    checked={config.workflowPermissions.translateMessages}
    onChange={(v) => updateWorkflowPerm('translateMessages', v)}
  />
  
  <PermissionToggle
    label="Sugerir acciones"
    description="Crear cliente, trabajo, etc."
    checked={config.workflowPermissions.suggestActions}
    onChange={(v) => updateWorkflowPerm('suggestActions', v)}
  />
  
  <NestedPermission visible={config.workflowPermissions.suggestActions}>
    <PermissionToggle
      label="Acceso a base de datos"
      description="Consultar historial del cliente"
      checked={config.workflowPermissions.accessDatabase}
      onChange={(v) => updateWorkflowPerm('accessDatabase', v)}
    />
    <PermissionToggle
      label="Acceso a agenda"
      description="Verificar disponibilidad"
      checked={config.workflowPermissions.accessSchedule}
      onChange={(v) => updateWorkflowPerm('accessSchedule', v)}
    />
  </NestedPermission>
</div>
```

### 5.3 LangGraph Permission Checks
**Modify**: `services/ai/app/workflows/voice_processing.py`

Add permission checks:
```python
async def check_permissions(state: VoiceProcessingState) -> dict:
    """Fetch and check workflow permissions."""
    # Fetch from API or pass in state
    permissions = state.get("workflow_permissions", {})
    return permissions

async def suggest_action_node(state: VoiceProcessingState) -> VoiceProcessingState:
    permissions = await check_permissions(state)
    
    if not permissions.get("suggestActions", True):
        return state  # Skip action suggestions
    
    # ... existing logic
```

### 5.4 Tasks
- [ ] 5.1.1 Add `workflowPermissions` JSON field to `AIConfiguration`
- [ ] 5.1.2 Run migration
- [ ] 5.2.1 Create `PermissionToggle` component
- [ ] 5.2.2 Add "Permisos de Acción" section to settings
- [ ] 5.2.3 Wire up permission updates
- [ ] 5.3.1 Add permission fetching to LangGraph state
- [ ] 5.3.2 Add permission checks to workflow nodes

---

## Future: International Marketplace (Phase 6+)

> **Note**: This phase is documented for planning purposes. Implementation details will be refined when we begin this phase.

### Concept
Create a dedicated "Internacional" section in the marketplace showing only businesses with translation enabled.

### Key Features
1. **International Section**: `/marketplace/internacional`
   - Filter by service type + location
   - Only shows `translationEnabled: true` businesses
   - Translated service names/descriptions for visitor's language

2. **Verification for Free/Starter Plans**:
   - Users claim to speak a language
   - After 10 completed jobs with international customers + positive ratings → verified badge
   - Stops sending rating requests after verification

3. **Search Filters**:
   - "Speaks English" filter
   - "Translation Available" filter
   - Language badges on business cards

### Files to Create
- `apps/web/app/marketplace/internacional/page.tsx`
- `apps/web/app/api/marketplace/international/route.ts`
- `apps/web/components/marketplace/InternationalBadge.tsx`

### Database Additions
```prisma
model Organization {
  // ... existing
  
  internationalJobsCompleted   Int      @default(0)
  internationalRatingSum       Float    @default(0)
  internationalRatingCount     Int      @default(0)
  languagesVerified            String[] @default([])
}
```

### UI Translation
- Use browser language detection
- Translate service type names
- Keep business-specific content (names, descriptions) in Spanish with translation tooltip

---

## 📋 Summary Checklist

### Phase 1: Feedback Collection
- [ ] Database migration for feedback fields
- [ ] Feedback API endpoint
- [ ] 👍/👎 buttons on AI cards
- [ ] Feedback buttons in Copilot

### Phase 2: Translation Core
- [ ] Database fields for translation
- [ ] Python translation service
- [ ] Whisper auto-detect
- [ ] Voice workflow translation node
- [ ] AI settings language UI

### Phase 3: Translation UI
- [ ] Language detection cards
- [ ] Message translation display
- [ ] Language confirmation component
- [ ] Copilot translation integration

### Phase 4: Technician Copilot
- [ ] API permission updates
- [ ] Mobile chat list screen
- [ ] Mobile chat detail with Copilot
- [ ] Tab navigation update

### Phase 5: Workflow Permissions
- [ ] Database field
- [ ] Settings UI
- [ ] LangGraph permission checks

### Phase 6 (Future): International Marketplace
- [ ] Internacional section page
- [ ] Verification system
- [ ] Language filters
- [ ] UI translation

---

## 🔗 Related Documentation

- [[Obsidian Architecture/02_App/Operations/Team Availability Page]] - Availability management patterns
- [[Obsidian Architecture/02_App/AI Service Architecture]] - AI service overview
- Knowledge Item: `ai_service_architecture` - LangGraph workflow details
- Knowledge Item: `workforce_and_team_management` - Role-based access patterns
