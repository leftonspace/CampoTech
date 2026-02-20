# AI 2-Tier Unification Plan

> **Version:** 1.0  
> **Date:** 2026-02-19  
> **Status:** DRAFT  
> **Depends On:** [AI_COPILOT_LANGGRAPH_UNIFICATION.md](./AI_COPILOT_LANGGRAPH_UNIFICATION.md) v4.2+  
> **Source Audit:** [Gemini CLI Task 002](../Gemini_CLI_Interactions/Output/002-ai-tier-audit-report.md)

---

## 1. Problem Statement

CampoTech currently has **4 separate AI touchpoints** (discovered during audit — originally thought to be 3):

| # | System | Component | Endpoint | Status |
|---|--------|-----------|----------|--------|
| 1 | **Public Chat** | `PublicAIChatBubble.tsx` | `/api/support/public-chat` → Python LangGraph | ✅ Working |
| 2 | **Staff Help** | `HelpWidget.tsx` → `AIChatWidget.tsx` | `/api/support/chat` → Python LangGraph | ✅ Working |
| 3 | **Staff Assistant** | `AIAssistantPanel.tsx` | `/api/ai/staff-assist` → `AIStaffAssistant.ts` | ⚠️ Dead code — not imported anywhere |
| 4 | **WhatsApp Copilot** | `CopilotPanel.tsx` | `/api/copilot/chat` → TS/OpenAI | ✅ Working |

### Problems

1. **Dead code (#3):** `AIAssistantPanel.tsx` (253 lines) is not imported anywhere, not in the barrel export, but still has its API route (`/api/ai/staff-assist`) and service (`ai-staff-assistant.ts`, 837 lines) active.

2. **Feature cross-contamination:** The `AIStaffAssistant` service contains **5 operational features** (check availability, suggest booking, create booking, analyze customer, detect conflicts) that belong in the Copilot tier, not in a help widget.

3. **Knowledge duplication:** Business knowledge (pricing, plans, features) is hardcoded in Python (`support_bot.py` → `BUSINESS_KNOWLEDGE`) AND stored dynamically in PostgreSQL (`AIConfiguration` model). These will drift.

4. **Inconsistent infrastructure:** Each AI system creates its own OpenAI client, has its own prompt construction, and uses different logging models.

5. **No rate limiting on Public Chat:** Visitors can spam the landing page AI with no throttling.

---

## 2. Target Architecture

### 2-Tier Model

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  TIER 1: INFORMATIONAL — "Answers questions, never mutates data"     │
│  ────────────────────────────────────────────────────────────────     │
│                                                                      │
│  ┌──────────────────────────┐   ┌──────────────────────────────┐    │
│  │  Public Chat (Landing)   │   │  Staff Help (Dashboard)       │    │
│  │                          │   │                               │    │
│  │  WHO: Unauthenticated    │   │  WHO: Authenticated users     │    │
│  │       visitors           │   │       (owner, admin, tech)    │    │
│  │  KNOWS: Marketing,       │   │  KNOWS: Platform docs,       │    │
│  │         pricing, plans   │   │         how-to guides,        │    │
│  │  DOES: Answers FAQs      │   │         pricing, draft text   │    │
│  │  TOOLS: None             │   │  DOES: Answers how-to,        │    │
│  │  RISK: Zero              │   │        drafts responses,      │    │
│  │                          │   │        looks up pricing        │    │
│  │  Endpoint:               │   │  TOOLS: None (read-only)      │    │
│  │  /api/support/public-chat│   │  RISK: Low                    │    │
│  │  → Python AI Service     │   │                               │    │
│  │                          │   │  Endpoint:                    │    │
│  │  Component:              │   │  /api/support/chat            │    │
│  │  PublicAIChatBubble.tsx  │   │  → Python AI Service          │    │
│  │                          │   │                               │    │
│  │  Logging:                │   │  Component:                   │    │
│  │  PublicSupportMessage    │   │  HelpWidget.tsx →             │    │
│  │  (anonymous)             │   │    AIChatWidget.tsx            │    │
│  └──────────────────────────┘   │                               │    │
│                                  │  Logging:                     │    │
│                                  │  AIConversationLog            │    │
│                                  └──────────────────────────────┘    │
│                                                                      │
│  SHARED INFRASTRUCTURE:                                              │
│  • Python AI Service (services/ai) with LangGraph support_bot.py     │
│  • Knowledge base from AIConfiguration (Prisma) — NOT hardcoded      │
│  • Rate limiting via lib/ai/rate-limiter.ts                          │
│  • Usage tracking via lib/integrations/openai/usage-tracker.ts       │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  TIER 2: OPERATIONAL — "Acts on business data with approval gates"   │
│  ────────────────────────────────────────────────────────────────     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              AI Copilot (ONE brain, TWO views)                │   │
│  │                                                               │   │
│  │   Entry: WhatsApp webhook ──┐                                 │   │
│  │                             ├──► LangGraph Orchestrator       │   │
│  │   Entry: Dashboard Panel ───┘    + Sub-Agents                 │   │
│  │                                                               │   │
│  │   Capabilities (from sub-agents):                             │   │
│  │   • SchedulingAgent: Book, reschedule, cancel, availability   │   │
│  │   • CustomerAgent: Create, search, update, CUIT validation    │   │
│  │   • FinancialAgent: Quotes, invoices, payment tracking        │   │
│  │   • FleetAgent: Vehicle assignment, bulk reschedule, dispatch  │   │
│  │   • EscalationAgent: Complaints, emergency, human handoff     │   │
│  │   • ProactiveAgent: Maintenance reminders, follow-ups         │   │
│  │   • GeneralAgent: Greetings, FAQs, fallback                   │   │
│  │                                                               │   │
│  │   See: AI_COPILOT_LANGGRAPH_UNIFICATION.md for full plan      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Phases

### Overview

| Phase | Name | Effort | Risk | Priority |
|-------|------|--------|------|----------|
| **Phase 0** | Dead Code Cleanup | 1 hour | Zero | P0 — Do immediately |
| **Phase 1** | Staff Help Scope Reduction | 2-3 hours | Low | P1 — Do this week |
| **Phase 2** | Knowledge Base Unification | 3-4 hours | Medium | P2 — Do next week |
| **Phase 3** | Infrastructure Hardening | 2-3 hours | Low | P3 — Do before launch |
| **Phase 4** | Operational Feature Migration | Deferred | N/A | Handled by Copilot Unification Plan |

---

### Phase 0: Dead Code Cleanup

**Goal:** Remove the ghost `AIAssistantPanel` system that is not used anywhere.

**Evidence of dead code:**
- `AIAssistantPanel.tsx` is NOT imported in any file
- `AIAssistantPanel` is NOT in the barrel export (`components/index.ts`)
- Only `CopilotPanel` is exported and used in the WhatsApp page
- The `/api/ai/staff-assist` route is only called by `AIAssistantPanel.tsx`

#### Changes

| Action | File | Details |
|--------|------|---------|
| **DELETE** | `apps/web/app/dashboard/whatsapp/components/AIAssistantPanel.tsx` | 253 lines. Dead code — not imported anywhere. |
| **DELETE** | `apps/web/app/api/ai/staff-assist/route.ts` | 130 lines. Only consumer was `AIAssistantPanel`. |
| **KEEP (for now)** | `apps/web/lib/services/ai-staff-assistant.ts` | 837 lines. Still needed for Phase 1 scope reduction. Will be trimmed, not deleted. |

#### Verification

- [ ] `pnpm build` succeeds (no import errors)
- [ ] `pnpm lint` passes
- [ ] WhatsApp page still works (CopilotPanel unaffected)
- [ ] Dashboard help widget still works (AIChatWidget unaffected)
- [ ] grep confirms no remaining references to `AIAssistantPanel` or `/api/ai/staff-assist`

---

### Phase 1: Staff Help AI Scope Reduction

**Goal:** Remove operational features from `AIStaffAssistant` service, keeping only Tier 1 (informational) capabilities.

#### Feature Classification (Final)

| Feature | Method | Lines | Classification | Action |
|---------|--------|-------|---------------|--------|
| General Help | `processRequest` (general routing) | 242-291 | **TIER 1 ✅** | KEEP |
| Draft Response | `generateDraftResponse` | 293-339 | **TIER 1 ✅** | KEEP — generates text, no mutation |
| Lookup Pricing | `lookupPricing` | 660-724 | **TIER 1 ✅** | KEEP — reads `AIConfiguration`, no mutation |
| Check Availability | `checkAvailability` | 403-449 | **TIER 2 ❌** | REMOVE — uses `SchedulingIntelligenceService`, org-scoped |
| Suggest Booking | `suggestBooking` | 341-401 | **TIER 2 ❌** | REMOVE — extracts entities for job creation |
| Create Booking | `createBooking` | 451-514 | **TIER 2 ❌** | REMOVE — **MUTATES data** (creates Job records) |
| Analyze Customer | `analyzeCustomer` | 516-595 | **TIER 2 ❌** | REMOVE — accesses org-specific customer data |
| Detect Conflicts | `detectConflicts` | 597-658 | **TIER 2 ❌** | REMOVE — accesses org-specific job data |

#### Changes

| Action | File | Details |
|--------|------|---------|
| **MODIFY** | `apps/web/lib/services/ai-staff-assistant.ts` | Remove 5 methods: `checkAvailability`, `suggestBooking`, `createBooking`, `analyzeCustomer`, `detectConflicts`. Remove their imports (`SchedulingIntelligenceService`, `BookingWorkflow`). Remove corresponding types (`CustomerInsights`, `ConflictInfo`). Update `StaffAssistantAction` type to only allow `'draft_response' \| 'lookup_pricing' \| 'general_help'`. **Estimated reduction: ~400 lines removed (837 → ~437).** |
| **MODIFY** | `apps/web/lib/services/ai-staff-assistant.ts` | Update `buildStaffAssistantPrompt` (lines 112-224) to remove operational action prompts. Simplify the system prompt to focus on platform help only. |
| **MODIFY** | `apps/web/lib/services/ai-staff-assistant.ts` | Remove `processRequest` switch cases for removed actions. Add a clear error for unknown actions: `"Esta función se ha movido al Copilot de WhatsApp."` |
| **VERIFY** | `apps/web/components/support/AIChatWidget.tsx` | Confirm this component does NOT call any of the removed actions. If it does, remove those UI elements. |
| **VERIFY** | `apps/web/components/support/HelpWidget.tsx` | Confirm the help widget menu only exposes Tier 1 actions. |

#### Operational Feature → Sub-Agent Migration Map

These removed features will be **naturally replaced** when the Copilot sub-agents are built (Phase A0 of `AI_COPILOT_LANGGRAPH_UNIFICATION.md`):

| Removed Feature | Future Sub-Agent | Notes |
|-----------------|-----------------|-------|
| `checkAvailability` | **SchedulingAgent** | Tool: `query_technician_availability` |
| `suggestBooking` | **SchedulingAgent** | Tool: `create_job` (with approval gate) |
| `createBooking` | **SchedulingAgent** | Tool: `create_job` (with approval gate) |
| `analyzeCustomer` | **CustomerAgent** | Tool: `search_customer` + relationship-aware context loading |
| `detectConflicts` | **FleetAgent** | Tool: `check_conflicts` |

> ⚠️ **No functionality is lost.** These capabilities move from a disconnected side panel into the main Copilot, where they belong — with proper approval gates, audit trails, and LangSmith tracing.

#### Verification

- [ ] `pnpm build` succeeds
- [ ] `pnpm type-check` passes (no type errors from removed interfaces)
- [ ] `StaffAssistantAction` type only allows `'draft_response' | 'lookup_pricing' | 'general_help'`
- [ ] No remaining imports of `SchedulingIntelligenceService` or `BookingWorkflow` in staff assistant
- [ ] Help Widget / AIChatWidget still renders and responds to informational queries
- [ ] Manual test: ask "¿Cómo creo un técnico?" → gets helpful answer
- [ ] Manual test: ask "¿Cuánto cuesta el plan Profesional?" → gets pricing info

---

### Phase 2: Knowledge Base Unification

**Goal:** Eliminate the dual knowledge base problem where `support_bot.py` has hardcoded `BUSINESS_KNOWLEDGE` that can drift from the `AIConfiguration` Prisma model.

#### Current State

```
TWO SOURCES OF TRUTH (BAD):

┌─────────────────────────────┐     ┌──────────────────────────────┐
│  Python: support_bot.py     │     │  PostgreSQL: AIConfiguration │
│                             │     │                              │
│  BUSINESS_KNOWLEDGE = """   │     │  services: [...]             │
│  Planes: Gratis, Inicial,   │  ≠  │  pricing: [...]              │
│  Profesional, Empresa       │     │  businessHours: [...]        │
│  Precios: $0, $20, $35...   │     │  companyInfo: [...]          │
│  """                        │     │                              │
│                             │     │  (Owner can edit via UI)     │
│  (Developer must update)    │     │                              │
└─────────────────────────────┘     └──────────────────────────────┘
```

#### Target State

```
SINGLE SOURCE OF TRUTH (GOOD):

┌──────────────────────────────┐
│  PostgreSQL: AIConfiguration │  ← Owner edits via Dashboard Settings
│                              │
│  services: [...]             │
│  pricing: [...]              │
│  businessHours: [...]        │
│  companyInfo: [...]          │
│  platformKnowledge: [...]    │  ← NEW: Platform-level FAQ for Public Chat
└──────────┬───────────────────┘
           │
     ┌─────┴─────┐
     │  API       │
     │  endpoint  │
     └─────┬──────┘
           │
    ┌──────┴───────────────────────────┐
    │                                  │
    ▼                                  ▼
 Python AI Service              TypeScript Services
 (support_bot.py)               (ai-staff-assistant.ts)
 Fetches context on             Already reads from
 each request via API           AIConfiguration
```

#### Changes

| Action | File | Details |
|--------|------|---------|
| **CREATE** | `apps/web/app/api/ai/knowledge/route.ts` | New read-only API endpoint that returns platform knowledge (plans, pricing, features, FAQ) from `AIConfiguration` and static platform content. Unauthenticated for Public Chat, org-scoped for Staff Help. |
| **MODIFY** | `services/ai/app/workflows/support_bot.py` | Replace hardcoded `BUSINESS_KNOWLEDGE` and `FAQ_DATABASE` strings with a fetch to the new `/api/ai/knowledge` endpoint at workflow start. Cache for 5 minutes to avoid repeated DB calls. |
| **CREATE** | `apps/web/lib/ai/platform-knowledge.ts` | Centralized module that builds the platform knowledge string from `AIConfiguration` + static content. Used by both the Python service (via API) and TypeScript services (via import). |
| **VERIFY** | `apps/web/app/dashboard/settings/ai-assistant/page.tsx` | Confirm the settings UI allows editing of business knowledge fields that both tiers consume. |

#### Platform vs. Organization Knowledge

| Knowledge Type | Scope | Source | Used By |
|----------------|-------|--------|---------|
| **Platform Knowledge** | Global (all orgs) | Static in code + admin DB | Public Chat (Tier 1) |
| Plans & Pricing | Global | Static (hardcoded or DB) | Public Chat, Staff Help |
| Features & How-To | Global | Static docs | Staff Help (Tier 1) |
| **Organization Knowledge** | Per-org | `AIConfiguration` model | Staff Help (Tier 1), Copilot (Tier 2) |
| Business Hours | Per-org | `AIConfiguration.businessHours` | Staff Help, Copilot |
| Services Offered | Per-org | `AIConfiguration.services` | Staff Help, Copilot |
| Company Info | Per-org | `AIConfiguration.companyInfo` | Copilot |

#### Verification

- [ ] `support_bot.py` no longer has hardcoded `BUSINESS_KNOWLEDGE`
- [ ] `/api/ai/knowledge` returns up-to-date knowledge
- [ ] Public Chat still answers pricing questions correctly
- [ ] Changing pricing in Dashboard Settings → reflected in Public Chat within 5 minutes (cache TTL)

---

### Phase 3: Infrastructure Hardening

**Goal:** Fix security gaps and inconsistencies across both tiers.

#### 3a. Rate Limiting for Public Chat

| Action | File | Details |
|--------|------|---------|
| **MODIFY** | `apps/web/app/api/support/public-chat/route.ts` | Add rate limiting using existing `lib/ai/rate-limiter.ts`. Key by IP address (visitors are unauthenticated). Limits: 20 messages/hour per IP, 5 messages/minute burst. |

#### 3b. OpenAI Client Singleton

| Action | File | Details |
|--------|------|---------|
| **MODIFY** | `apps/web/lib/services/ai-staff-assistant.ts` | Replace `new OpenAI()` in constructor with shared singleton from `lib/integrations/openai/index.ts`. |
| **VERIFY** | All AI-related files | Confirm all TypeScript AI code uses the shared OpenAI client, not individual instances. |

#### 3c. Unified Error Handling

| Action | File | Details |
|--------|------|---------|
| **MODIFY** | `apps/web/app/api/support/public-chat/route.ts` | Add fallback pattern from `lib/integrations/openai/fallback-handler.ts`. If AI fails, show a friendly es-AR message: "Disculpá, no puedo responder ahora. Podés escribirnos a soporte@campotech.com." |
| **MODIFY** | `apps/web/app/api/support/chat/route.ts` | Same fallback pattern. |

#### 3d. Usage Tracking Consistency

| Action | File | Details |
|--------|------|---------|
| **VERIFY** | `apps/web/lib/integrations/openai/usage-tracker.ts` | Confirm all 3 remaining AI endpoints (public-chat, support/chat, copilot/chat) record token usage to the tracker. Tag usage with `tier: 'informational' | 'operational'` for cost analysis. |

#### Verification

- [ ] Rate limiting test: 21st message from same IP within 1 hour returns 429
- [ ] Burst test: 6th message within 1 minute returns 429
- [ ] AI service failure → friendly es-AR fallback message (not stack trace)
- [ ] Usage dashboard shows per-tier token costs

---

### Phase 4: Operational Feature Migration (DEFERRED)

> **This phase is NOT part of this plan.** It is handled by [AI_COPILOT_LANGGRAPH_UNIFICATION.md](./AI_COPILOT_LANGGRAPH_UNIFICATION.md) Phase A0.

The 5 operational features removed from `AIStaffAssistant` in Phase 1 will be **replaced** — not migrated — by the Copilot sub-agents. The sub-agents will be more capable than the original features because they will have:

- ✅ Relationship-aware context loading (customer 360° view before any action)
- ✅ Approval gates with TTL (no auto-execution of risky actions)
- ✅ Intent chaining (multi-step workflows)
- ✅ LangSmith tracing (full observability)
- ✅ Working memory (token-efficient context)
- ✅ Confidence-based yield to human (with max 2 reroutes)

**No user-facing functionality is lost.** The features temporarily disappear from the dead `AIAssistantPanel` (which nobody uses) and reappear in the Copilot (which everyone uses).

---

## 4. File Impact Summary

### Files to DELETE (Phase 0)

| File | Lines | Reason |
|------|-------|--------|
| `apps/web/app/dashboard/whatsapp/components/AIAssistantPanel.tsx` | 253 | Dead code — not imported, not exported |
| `apps/web/app/api/ai/staff-assist/route.ts` | 130 | Only consumer was deleted `AIAssistantPanel` |
| **Total removed:** | **383** | |

### Files to MODIFY

| File | Phase | Change |
|------|-------|--------|
| `apps/web/lib/services/ai-staff-assistant.ts` | 1 | Remove 5 operational methods (~400 lines). Simplify types and prompts. |
| `services/ai/app/workflows/support_bot.py` | 2 | Replace hardcoded knowledge with API fetch + cache. |
| `apps/web/app/api/support/public-chat/route.ts` | 3 | Add rate limiting + fallback error handling. |
| `apps/web/app/api/support/chat/route.ts` | 3 | Add fallback error handling. |

### Files to CREATE

| File | Phase | Purpose |
|------|-------|---------|
| `apps/web/app/api/ai/knowledge/route.ts` | 2 | Platform knowledge API endpoint |
| `apps/web/lib/ai/platform-knowledge.ts` | 2 | Centralized knowledge builder module |

---

## 5. API Route Inventory (Post-Unification)

### Tier 1 Routes (Informational)

| Route | Auth | Purpose | Status |
|-------|------|---------|--------|
| `POST /api/support/public-chat` | No | Visitor questions → Python AI Service | ✅ Keep (add rate limiting) |
| `GET /api/support/public-chat/history` | No | Visitor chat history (localStorage session) | ✅ Keep |
| `POST /api/support/chat` | Yes | Staff help questions → Python AI Service | ✅ Keep (add fallback) |
| `GET /api/ai/knowledge` | No/Yes | Platform knowledge for AI context | 🆕 Create |

### Tier 2 Routes (Operational — unchanged)

| Route | Auth | Purpose | Status |
|-------|------|---------|--------|
| `POST /api/copilot/chat` | Yes | Copilot conversations | ✅ Keep |
| `POST /api/copilot/execute-action` | Yes | Job creation, reschedule, etc. | ✅ Keep |
| `GET /api/copilot/availability` | Yes | Technician availability | ✅ Keep |

### Support/Admin Routes (Not AI — keep as-is)

| Route | Auth | Purpose | Status |
|-------|------|---------|--------|
| `GET/POST /api/support/conversations` | Yes (Admin) | Ticket management | ✅ Keep |
| `GET/PATCH /api/support/conversations/[id]` | Yes (Admin) | Individual ticket | ✅ Keep |
| `POST /api/support/conversations/[id]/close` | Yes (Admin) | Close ticket | ✅ Keep |
| `POST /api/support/report` | Yes | Bug/feature reports | ✅ Keep |

### DELETED Routes

| Route | Reason |
|-------|--------|
| `POST /api/ai/staff-assist` | Phase 0 — only consumer was dead `AIAssistantPanel` |

---

## 6. Monitoring & Observability

### Per-Tier Metrics

| Metric | Tier 1 | Tier 2 |
|--------|--------|--------|
| **Logging model** | `PublicSupportMessage` (anonymous) / `AIConversationLog` (authenticated) | `AIConversationLog` |
| **Token tracking** | `OpenAIUsageTracker` with `tier: 'informational'` | `OpenAIUsageTracker` with `tier: 'operational'` |
| **Rate limiting** | IP-based (public) / User-based (staff) | User + Org-based |
| **Tracing** | Basic (no LangSmith) | Full LangSmith tracing |
| **Error handling** | Fallback message | Circuit breaker + human escalation |

### Cost Visibility

After unification, the `/api/ai/usage` endpoint should report:

```json
{
  "tier1_informational": {
    "public_chat": { "tokens": 15420, "cost_usd": 0.23 },
    "staff_help": { "tokens": 8930, "cost_usd": 0.13 }
  },
  "tier2_operational": {
    "copilot": { "tokens": 142300, "cost_usd": 2.14 }
  },
  "total_cost_usd": 2.50
}
```

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Deleting `AIAssistantPanel` breaks something | Low — confirmed dead code via grep | Run `pnpm build` + `pnpm type-check` after deletion |
| Removing operational features from Staff Help breaks a workflow | Low — only consumer was deleted panel | Verify `AIChatWidget` and `HelpWidget` don't call removed actions |
| `support_bot.py` knowledge fetch fails | Medium — Public Chat returns errors | Cache last-known-good knowledge in Python service; fallback to minimal hardcoded FAQ |
| Rate limiting blocks legitimate users | Low | Set generous initial limits (20/hour); monitor and adjust |
| Phase 1 and Phase A0 (Copilot) timing gap | Low — features in dead panel | No user impact since `AIAssistantPanel` is already unused |

---

## 8. Execution Timeline

| Week | Phase | Deliverables | Verification |
|------|-------|-------------|--------------|
| **Week 1** | Phase 0: Dead Code Cleanup | Delete `AIAssistantPanel.tsx`, delete `/api/ai/staff-assist` | Build + type-check pass, grep clean |
| **Week 1** | Phase 1: Staff Help Scope Reduction | Trim `AIStaffAssistant` to 3 actions, update types | Build pass, manual test help widget |
| **Week 2** | Phase 2: Knowledge Base Unification | Create `/api/ai/knowledge`, update `support_bot.py` | Dynamic pricing in Public Chat works |
| **Week 2-3** | Phase 3: Infrastructure Hardening | Rate limiting, error handling, usage tracking | Rate limit test, failure simulation |
| **Deferred** | Phase 4: Operational Migration | Handled by `AI_COPILOT_LANGGRAPH_UNIFICATION.md` Phase A0 | N/A |

---

## 9. Success Criteria

When this plan is fully executed:

- [ ] **Only 2 AI tiers exist** — Informational (Tier 1) and Operational (Tier 2)
- [ ] **Zero dead code** — No unused AI components, routes, or services
- [ ] **Single source of truth** — All AI knowledge comes from `AIConfiguration` + platform knowledge module
- [ ] **Rate limiting on all endpoints** — No unauthenticated endpoint can be spammed
- [ ] **Consistent error handling** — All AI endpoints have graceful fallbacks in es-AR
- [ ] **Usage tracking with tier labels** — Cost per tier is visible in the usage dashboard
- [ ] **Staff Help AI is purely informational** — No data mutations, no org-specific schedule access
- [ ] **Build passes** — `pnpm build` + `pnpm type-check` + `pnpm lint` all green

---

## 10. Cross-References

| Document | Relationship |
|----------|-------------|
| [AI_COPILOT_LANGGRAPH_UNIFICATION.md](./AI_COPILOT_LANGGRAPH_UNIFICATION.md) | Master plan for Tier 2 (Copilot). Phase 4 of THIS plan defers to Phase A0 of THAT plan. |
| [AI_SUBAGENT_DESIGN_WORKSHOP.md](./AI_SUBAGENT_DESIGN_WORKSHOP.md) | Defines the sub-agent logic that will replace the removed operational features. |
| [AI_INTEGRATION_DEEP_DIVE.md](../.agent/AI_INTEGRATION_DEEP_DIVE.md) | Current-state analysis of all AI systems (baseline for this plan). |
| [Gemini CLI Audit 002](../Gemini_CLI_Interactions/Output/002-ai-tier-audit-report.md) | Codebase audit that sourced the file inventory and dependency graph. |

---

*Version 1.0 — 2026-02-19*  
*Authors: Antigravity + Gemini CLI (Task 002)*
