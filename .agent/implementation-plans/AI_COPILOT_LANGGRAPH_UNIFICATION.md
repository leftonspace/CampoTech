# AI Copilot LangGraph Unification

> **Version:** 4.2 (2026-02-08)  
> **Priority:** HIGH  
> **Timeline:** 2-week design sprint + 22 weeks implementation (24 weeks total)  
> **Goal:** Orchestrator + Domain Sub-Agent AI system with memory, planning, and proactive capabilities

---

## Executive Summary

### Vision

Transform the AI Copilot from a **reactive assistant** to a **proactive agent** with:
- **Domain Sub-Agent orchestration** — specialized workflows that only activate when needed
- Cross-session memory and customer profiles
- Multi-step planning with approval gates
- Dynamic tool selection from whitelisted APIs
- Proactive suggestions based on patterns
- Multi-modal support (images, documents)

### Current State vs Target State

| Capability | Current | Target |
|------------|---------|--------|
| Architecture | Fragmented (TS + Python) | Orchestrator + Domain Sub-Agents (LangGraph) |
| Workflow Pattern | Monolithic single-graph | Category-based sub-agent delegation |
| Memory | None (stateless) | PostgreSQL + Redis |
| Learning | None | Profile extraction from feedback |
| Planning | Single-step | Multi-step with approval |
| Tools | Fixed function calls | Dynamic selection from whitelist |
| Suggestions | Reactive only | Proactive (opportunity detection) |
| Modality | Text only | Text + Voice + Images |
| Observability | Minimal | Full LangSmith tracing |

### Architecture Overview

> 📌 **DESIGN DECISION (2026-02-21):** The architecture has TWO distinct layers:
> - **System Layer** (deterministic, code-only, ~10ms) — runs DURING debounce wait, resolves identity, pre-fetches all context
> - **AI Layer** (LLM-powered, judgment-based, ~400ms-2s) — receives pre-loaded context, focuses on intent understanding + response crafting
>
> This separation reduces LLM calls by ~83% and ensures the AI never starts blind.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│           SYSTEM LAYER + AI LAYER ARCHITECTURE (v5.0)                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ENTRY POINTS                                                                │
│  ────────────                                                                │
│  • WhatsApp Webhook              ┌─────────────────────────────────────┐    │
│  • Dashboard CopilotPanel        │  ⚡ SYSTEM LAYER (Deterministic)     │    │
│  • Voice Messages                │  No LLM. Pure code. ~10ms total.    │    │
│  • Scheduled Proactive           │                                     │    │
│          │                       │  1. Redis lock + debounce start     │    │
│          ▼                       │  2. ∥ PARALLEL: (during debounce)   │    │
│  ┌──────────────────────┐        │     a) Phone→Profile lookup (DB)    │    │
│  │ NEXT.JS (TS Proxy)   │        │        → exists? load it            │    │
│  │ Webhook Handler      │───────▶│        → not found? AUTO-CREATE     │    │
│  └──────────────────────┘        │     b) Active job pre-fetch          │    │
│                                  │     c) Org AI config (cached)        │    │
│                                  │     d) v_customer_360 summary        │    │
│                                  │     e) Voice memo → Whisper (async)  │    │
│                                  │  3. Debounce expires → ALL ready     │    │
│                                  └──────────────┬──────────────────────┘    │
│                                                 │                            │
│                                    Pre-loaded context passed down            │
│                                                 │                            │
│                                                 ▼                            │
│                                  ┌─────────────────────────────────────┐    │
│                                  │  🧠 AI LAYER (LangGraph)            │    │
│                                  │  LLM for judgment. ~400ms-2s.       │    │
│  ┌──────────────────────┐        │                                     │    │
│  │ PYTHON AI SERVICE    │        │  1. CREATE WORKING MEMORY (LLM)     │    │
│  │ (LangGraph)          │        │  2. CLASSIFY INTENT                 │    │
│  │                      │        │  3. ROUTE TO SUB-AGENT              │    │
│  │ Receives pre-loaded: │        │  4. FORMAT RESPONSE                 │    │
│  │ • Profile (or new)   │        └────────────┬────────────────────────┘    │
│  │ • Active job         │                     │                              │
│  │ • Org config         │                     ▼                              │
│  │ • 360 summary        │      ┌──────────────────────────────┐              │
│  │ • is_new_contact     │      │       SUB-AGENT ROUTER       │              │
│  │                      │      │    (Intent → Category Map)   │              │
│  │ AI only does:        │      └───┬──────┬──────┬──────┬─────┘              │
│  │ • Intent detection   │          │      │      │      │                    │
│  │ • Tool calls         │          ▼      ▼      ▼      ▼                    │
│  │ • Response crafting  │     ┌──────┐ ┌─────┐ ┌─────┐ ┌──────┐             │
│  └──────────────────────┘     │SCHED │ │CUST │ │FINAN│ │FLEET │  ...more    │
│                               │Agent │ │Agent│ │Agent│ │Agent │             │
│                               └──┬───┘ └──┬──┘ └──┬──┘ └──┬───┘             │
│                                  │        │       │       │                  │
│                                  ▼        ▼       ▼       ▼                  │
│                               ┌──────────────────────────────────┐           │
│                               │   SHARED RESPONSE GENERATOR      │           │
│                               │   (Style adapt + Memory update)  │           │
│                               └──────────────────────────────────┘           │
│                                                                              │
│  IDENTITY: Phone + OrgId → CustomerAIProfile (auto-created, always exists)  │
│  MEMORY: PostgreSQL + Redis                                                  │
│  OBSERVABILITY: LangSmith per sub-agent                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase A0: Sub-Agent Architecture (Weeks 1-2 — Design Sprint)

### Goal

Design the **Orchestrator + Domain Sub-Agent** pattern before building the unified workflow. This prevents the monolithic `copilot_master.py` from becoming a prompt-drift-prone spider web as domains are added.

> 💡 **Inspiration:** Kimi-K2.5's "Agent Swarm" (PARL) demonstrates that decomposing tasks into parallel sub-agents improves both latency and accuracy. However, their swarm is an emergent behavior trained into the model weights — not a reusable framework. CampoTech needs **deterministic routing** for business-critical WhatsApp operations, so we adopt the *concept* (orchestrator + frozen sub-agents) using LangGraph sub-graphs for predictable, auditable delegation.

### Why Sub-Agents Over Monolithic Agent?

| Problem (Monolithic) | Solution (Sub-Agents) |
|---|---|
| System prompt grows to 2000+ tokens covering ALL domains | Each sub-agent has a focused 200-300 token domain prompt |
| Adding a new domain risks breaking existing behavior (prompt drift) | Sub-agents are isolated; changes don't leak across domains |
| Can't test individual domains independently | Each sub-agent has its own `AIEvaluationDataset` partition |
| Can't version/rollback one domain without affecting others | Independent versioning and rollback per sub-agent |
| Same model used for simple lookups and complex optimization | Each sub-agent selects its optimal model (cost optimization) |
| All context loaded for every request | Only domain-relevant context is loaded (lazy activation) |

### Sub-Agent Workflow Categories

> ⚠️ **Note:** Individual workflow logic (node sequences, prompts, tool calls) will be defined once CampoTech's feature set is finalized. This section defines the **categories, routing boundaries, and infrastructure** only.

> 📌 **DESIGN DECISION (2026-02-21):** Identity resolution (phone → profile) is now handled by the **System Layer** before any sub-agent activates. The `CustomerAgent` no longer searches/creates customers for identity purposes — that's deterministic. Its role is now **profile enrichment and updates** requested by dispatchers or when the AI detects missing fields (e.g., CUIT validation for invoicing). The `create_customer` intent now means "promote a contact to a formal Customer entity" (with CUIT, address, billing info), not "figure out who this person is."

| Category | Sub-Agent Name | Example Intents | Model | Complexity | Tool Families |
|----------|----------------|-----------------|-------|------------|---------------|
| **Scheduling** | `SchedulingAgent` | `book_job`, `reschedule`, `cancel_job`, `check_availability` | gpt-4o-mini | Medium | `query_schedule`, `create_job`, `reschedule_job` |
| **Customer Mgmt** | `CustomerAgent` | `promote_contact`, `update_customer`, `validate_cuit`, `enrich_profile` | gpt-4o-mini | Low | `promote_to_customer`, `update_profile`, `validate_cuit` |
| **Invoicing & Quotes** | `FinancialAgent` | `generate_quote`, `generate_invoice`, `payment_status`, `cobro` | gpt-4o | High | `gen_quote_pdf`, `gen_invoice`, `check_payment` |
| **Fleet & Dispatch** | `FleetAgent` | `assign_vehicle`, `technician_sick`, `bulk_reschedule`, `dispatch` | gpt-4o | High | `query_fleet`, `reassign_jobs`, `check_conflicts` |
| **Complaints & Escalation** | `EscalationAgent` | `complaint`, `emergency`, `frustration_detected`, `escalate` | gpt-4o | Medium | `create_ticket`, `escalate_to_human`, `priority_flag` |
| **Follow-up & Proactive** | `ProactiveAgent` | `maintenance_due`, `follow_up`, `seasonal_reminder` | gpt-4o-mini | Low | `create_suggestion`, `send_reminder`, `check_equipment` |
| **General / FAQ** | `GeneralAgent` | `greeting`, `farewell`, `hours`, `pricing_info`, `unknown` | gpt-4o-mini | Low | None (direct response) |

### Sub-Agent Registry Pattern

```python
# services/ai/app/workflows/registry.py

from dataclasses import dataclass, field
from typing import Optional

@dataclass
class SubAgentConfig:
    """Configuration for a domain-specific sub-agent."""
    name: str
    category: str
    intents: list[str]
    model: str = "gpt-4o-mini"
    tools: list[str] = field(default_factory=list)
    max_plan_steps: int = 5
    min_confidence: float = 0.4       # Per-agent yield threshold (v4.1 — configurable)
    requires_approval_for: list[str] = field(default_factory=list)
    system_prompt_path: str = ""  # Path to domain-specific prompt .md file
    eval_dataset_id: Optional[str] = None  # For isolated evaluation

SUBAGENT_REGISTRY: dict[str, SubAgentConfig] = {
    "scheduling": SubAgentConfig(
        name="SchedulingAgent",
        category="scheduling",
        intents=["book_job", "reschedule", "cancel_job", "check_availability"],
        model="gpt-4o-mini",
        tools=["query_schedule", "create_job", "reschedule_job", "cancel_job"],
        requires_approval_for=["create_job", "reschedule_job", "cancel_job"],
        system_prompt_path="prompts/scheduling.md",
    ),
    # NOTE (v5.0): CustomerAgent no longer handles identity resolution.
    # Phone → Profile lookup is done by the System Layer (deterministic, no LLM).
    # CustomerAgent now handles profile ENRICHMENT and PROMOTION to formal Customer.
    # "promote_contact" = create a Customer entity with CUIT, address, billing info
    #                     from an existing CustomerAIProfile (which always exists).
    "customer": SubAgentConfig(
        name="CustomerAgent",
        category="customer",
        intents=["promote_contact", "update_customer", "validate_cuit", "enrich_profile"],
        model="gpt-4o-mini",
        tools=["promote_to_customer", "update_profile", "validate_cuit"],
        requires_approval_for=["promote_to_customer"],
        system_prompt_path="prompts/customer.md",
    ),
    "financial": SubAgentConfig(
        name="FinancialAgent",
        category="financial",
        intents=["generate_quote", "generate_invoice", "payment_status", "cobro"],
        model="gpt-4o",
        tools=["gen_quote_pdf", "gen_invoice", "check_payment"],
        min_confidence=0.6,  # Higher bar — financial actions are high-stakes
        requires_approval_for=["gen_invoice"],
        system_prompt_path="prompts/financial.md",
    ),
    "fleet": SubAgentConfig(
        name="FleetAgent",
        category="fleet",
        intents=["assign_vehicle", "technician_sick", "bulk_reschedule", "dispatch"],
        model="gpt-4o",
        tools=["query_fleet", "reassign_jobs", "check_conflicts"],
        max_plan_steps=10,
        min_confidence=0.6,  # Higher bar — bulk ops are high-stakes
        requires_approval_for=["reassign_jobs", "bulk_reschedule"],
        system_prompt_path="prompts/fleet.md",
    ),
    "escalation": SubAgentConfig(
        name="EscalationAgent",
        category="escalation",
        intents=["complaint", "emergency", "frustration_detected", "escalate"],
        model="gpt-4o",
        tools=["create_ticket", "escalate_to_human", "priority_flag"],
        requires_approval_for=[],  # Escalations auto-execute
        system_prompt_path="prompts/escalation.md",
    ),
    "proactive": SubAgentConfig(
        name="ProactiveAgent",
        category="proactive",
        intents=["maintenance_due", "follow_up", "seasonal_reminder"],
        model="gpt-4o-mini",
        tools=["create_suggestion", "send_reminder", "check_equipment"],
        requires_approval_for=["send_reminder"],
        system_prompt_path="prompts/proactive.md",
    ),
    "general": SubAgentConfig(
        name="GeneralAgent",
        category="general",
        intents=["greeting", "farewell", "hours", "pricing_info", "unknown"],
        model="gpt-4o-mini",
        tools=[],
        system_prompt_path="prompts/general.md",
    ),
}

def get_subagent_for_intent(intent: str) -> SubAgentConfig:
    """Route an intent to the appropriate sub-agent."""
    for config in SUBAGENT_REGISTRY.values():
        if intent in config.intents:
            return config
    return SUBAGENT_REGISTRY["general"]  # Fallback
```

### Orchestrator Pattern (Infrastructure Only)

```python
# services/ai/app/workflows/orchestrator.py

from langgraph.graph import StateGraph, END
from .registry import SUBAGENT_REGISTRY, get_subagent_for_intent

def build_orchestrator():
    """Build the master orchestrator graph.
    
    NOTE (v5.0): The orchestrator RECEIVES pre-loaded context from the System Layer.
    Identity resolution, active job lookup, org config, and v_customer_360 summary
    are all done deterministically during debounce — BEFORE this graph runs.
    
    The orchestrator handles:
    1. Intake — RECEIVE pre-loaded context from System Layer, create working memory
       (System already resolved: profile, active_job, org_config, is_new_contact)
    2. Classify — detect ALL intents, simplify chain if identity already resolved
    3. Route — pick the next sub-agent from the chain (or yield/escalate)
    4. [Sub-Agent] — execute domain logic, emit context mutations
    5. Respond — format response, advance chain, loop back if more steps
    
    Supports multi-intent chaining, sub-agent yield, and context mutations.
    It does NOT contain any domain-specific logic or identity resolution.
    """
    graph = StateGraph(CopilotState)
    
    # Shared infrastructure nodes
    # NOTE: intake_node no longer does DB lookups — it receives pre-loaded context
    # from the System Layer via state fields (pre_loaded_profile, pre_loaded_job, etc.)
    # and only performs LLM summarization to create working_memory.
    graph.add_node("intake", intake_node)
    graph.add_node("classify", classify_intents_node)     # Plural — detects ALL intents
    graph.add_node("route", route_node)                    # Chain-aware router
    graph.add_node("respond", respond_and_advance_node)    # Advances chain index
    
    # Register each sub-agent as a sub-graph node (loaded lazily)
    for category, config in SUBAGENT_REGISTRY.items():
        graph.add_node(category, load_subagent_graph(config))
    
    # Edges
    graph.set_entry_point("intake")
    graph.add_edge("intake", "classify")
    graph.add_edge("classify", "route")
    graph.add_conditional_edges("route", pick_next_subagent)
    
    # All sub-agents converge to respond (which advances the chain)
    for category in SUBAGENT_REGISTRY:
        graph.add_edge(category, "respond")
    
    # Respond loops back to route if chain continues, otherwise END
    graph.add_conditional_edges("respond", check_chain_or_end)
    
    return graph.compile()


# ── Multi-Intent Classifier ──────────────────────────────────────────

async def classify_intents_node(state: CopilotState) -> CopilotState:
    """Detect ALL intents, ordered by logical dependency.
    
    v5.0 NOTE: The System Layer has already resolved identity:
    - state["is_new_contact"] tells us if this is a first-ever message
    - state["pre_loaded_profile"] contains the profile (auto-created if new)
    - state["pre_loaded_active_job"] has the active job (if any)
    
    This means the classifier can SIMPLIFY chains:
    - Old: "Crear cliente Juan y agendarle" → ["create_customer", "book_job"]
    - New: System already created the profile. If phone maps to known customer,
           drop "create_customer" entirely → ["book_job"]
    - New: If is_new_contact=True, AI surfaces opportunity card to dispatcher
           instead of running a full CustomerAgent chain.
    
    The dependency sort still applies for remaining multi-intent chains.
    """
    intents = await detect_intents(state["input_content"])
    # Prompt: "Identify ALL intents. Return JSON list ordered by dependency."
    
    # v5.0: Simplify chain based on system-layer pre-loaded context
    if not state.get("is_new_contact"):
        # Known contact — remove identity-related intents (system already resolved)
        intents = [i for i in intents if i not in ("promote_contact", "search_customer")]
    
    return {
        **state,
        "intent_chain": intents,
        "current_chain_index": 0,
        "chain_results": {},
        "context_mutations": [],
        "reroute_count": 0,
        "intermediate_responses": [],
        "detected_intent": intents[0] if intents else "unknown",
    }


# ── Chain-Aware Router ───────────────────────────────────────────────

def pick_next_subagent(state: CopilotState) -> str:
    """Route to next sub-agent in the chain, or END if exhausted."""
    
    chain = state.get("intent_chain", [])
    index = state.get("current_chain_index", 0)
    
    if index >= len(chain):
        return END  # All steps completed
    
    # Reroute guard — sub-agent yielded too many times → human handoff
    if state.get("reroute_count", 0) >= 2:
        return "escalation"
    
    next_intent = chain[index]
    config = get_subagent_for_intent(next_intent)
    return config.category


# ── Respond & Advance Chain ──────────────────────────────────────────

async def respond_and_advance_node(state: CopilotState) -> CopilotState:
    """Store intermediate response, advance chain, compose final if done."""
    
    chain = state.get("intent_chain", [])
    index = state.get("current_chain_index", 0)
    
    # If sub-agent yielded (no response), DON'T advance — let route re-try
    if not state.get("response_content"):
        return state
    
    # Accumulate this step's response for partial-success awareness
    intermediate = state.get("intermediate_responses", [])
    intermediate.append(state["response_content"])
    
    # Store structured result
    if index < len(chain):
        current_intent = chain[index]
        state.setdefault("chain_results", {})[current_intent] = {
            "response": state.get("response_content", ""),
        }
    
    return {
        **state,
        "current_chain_index": index + 1,
        "intermediate_responses": intermediate,
    }


def check_chain_or_end(state: CopilotState) -> str:
    """If more intents remain, loop back to route. Otherwise compose final response."""
    if state.get("current_chain_index", 0) < len(state.get("intent_chain", [])):
        return "route"  # Loop back for next sub-agent
    return END

# NOTE: When the chain completes (or breaks mid-chain), the final response
# is composed from intermediate_responses. For single-step chains, the
# response passes through unchanged. For multi-step chains:
#
#   intermediate_responses = [
#       "Creé el perfil de Juan (ID: 555).",
#       "No hay turnos disponibles mañana, pero encontré estas opciones:\n"
#       "  • Martes 11/02 a las 9:00\n"
#       "  • Miércoles 12/02 a las 14:00\n"
#       "  • Jueves 13/02 a las 10:30"
#   ]
#   → LLM stitches: "Creé el perfil de Juan. No hay turnos para mañana,
#                    pero estas son las próximas opciones disponibles:
#                    • Martes 11/02 a las 9:00
#                    • Miércoles 12/02 a las 14:00
#                    • Jueves 13/02 a las 10:30
#                    ¿Cuál te conviene?"
#
# IMPORTANT: Sub-agents must RESOLVE conflicts with data, not deflect.
# When SchedulingAgent finds no slots for the requested date, it MUST
# query for the next N available alternatives and include them in its
# response. The user decides from concrete options — the AI never asks
# "¿querés que pruebe otro día?" without already having the answer.
#
# This composition happens in the orchestrator's final format_response
# step (outside the chain loop), ensuring partial success is always
# communicated — the user never loses track of what DID work.
```

### Sub-Agent Skeleton Template

```python
# services/ai/app/workflows/subagents/_template.py
#
# Template for creating new domain sub-agents.
# Copy this file and customize for each domain category.
# DO NOT add domain logic here — this is infrastructure only.

from langgraph.graph import StateGraph, END
from ..registry import SubAgentConfig

def build_subagent(config: SubAgentConfig) -> StateGraph:
    """Build a domain sub-agent sub-graph.
    
    Each sub-agent follows the same structure:
    1. confidence_gate — Verify this is the right agent; yield if not
    2. load_domain_context — Fetch domain data (+ read chain mutations)
    3. domain_plan — Create domain-specific plan steps
    4. domain_execute — Execute tools (with approval gates if needed)
    5. emit_mutations — Publish ContextMutations for downstream agents
    """
    graph = StateGraph(CopilotState)
    
    graph.add_node("confidence_gate", make_confidence_gate(config))
    graph.add_node("load_domain_context", make_context_loader(config))
    graph.add_node("domain_plan", make_domain_planner(config))
    graph.add_node("domain_execute", make_domain_executor(config))
    graph.add_node("emit_mutations", make_mutation_emitter(config))
    
    graph.set_entry_point("confidence_gate")
    # If confidence < threshold → yield back to orchestrator (exit sub-graph)
    graph.add_conditional_edges("confidence_gate", lambda s:
        "load_domain_context" if s.get("intent_confidence", 1.0) >= config.min_confidence
        else END  # Yields: reroute_count already incremented
    )
    graph.add_edge("load_domain_context", "domain_plan")
    graph.add_edge("domain_plan", "domain_execute")
    graph.add_edge("domain_execute", "emit_mutations")
    graph.add_edge("emit_mutations", END)
    
    return graph.compile()


def make_confidence_gate(config: SubAgentConfig):
    """Standard yield pattern — every sub-agent gets this for free."""
    async def confidence_gate(state: CopilotState) -> CopilotState:
        confidence = await evaluate_domain_fit(state["input_content"], config)
        if confidence < config.min_confidence:
            # Increment reroute counter; orchestrator will re-route or escalate
            return {
                **state,
                "intent_confidence": confidence,
                "reroute_count": state.get("reroute_count", 0) + 1,
                "response_content": "",  # Signal yield to orchestrator
            }
        return {**state, "intent_confidence": confidence}
    return confidence_gate


def make_mutation_emitter(config: SubAgentConfig):
    """Standard mutation output — domain_execute populates mutations during tool calls."""
    async def emit_mutations(state: CopilotState) -> CopilotState:
        # Mutations are appended during domain_execute via:
        #   state["context_mutations"].append(ContextMutation(...))
        # This node is a passthrough that ensures mutations are in the state
        return state
    return emit_mutations
```

### Domain Prompt Files (Stubs)

> Content for each prompt file will be written when CampoTech workflows are finalized.

| File | Domain | Purpose |
|------|--------|---------|
| `services/ai/app/prompts/scheduling.md` | Scheduling | Calendar, technicians, conflicts, Argentine time zones |
| `services/ai/app/prompts/customer.md` | Customer | CUIT validation (Mod-11), onboarding, customer types |
| `services/ai/app/prompts/financial.md` | Invoicing | IVA rules, ARS formatting, Presupuesto → Factura |
| `services/ai/app/prompts/fleet.md` | Fleet | Vehicle assignment, fuel types (Nafta/Diésel), dispatch |
| `services/ai/app/prompts/escalation.md` | Complaints | Urgency detection, de-escalation, human handoff |
| `services/ai/app/prompts/proactive.md` | Follow-up | Maintenance patterns, seasonal suggestions |
| `services/ai/app/prompts/general.md` | General | Greetings, FAQ, fallback responses |

### Schema Addition

```prisma
model AISubAgentExecution {
  id               String   @id @default(cuid())
  organizationId   String
  conversationId   String
  
  subagentCategory String   // "scheduling", "customer", "financial", etc.
  detectedIntent   String
  intentConfidence Float
  
  modelUsed        String   // "gpt-4o-mini", "gpt-4o"
  toolsInvoked     String[] @default([])
  planSteps        Int      @default(0)
  
  latencyMs        Int
  tokenCount       Int?
  success          Boolean  @default(true)
  errorMessage     String?
  
  createdAt        DateTime @default(now())
  
  @@index([organizationId, subagentCategory])
  @@index([createdAt])
  @@map("ai_subagent_executions")
}
```

---

## Phase A: Foundation (Weeks 3-12)

### A1: Opportunity Detection

**Goal:** Detect upsell opportunities from customer conversations.

**Schema Additions:**
```prisma
model AIConfiguration {
  // Add to existing model
  opportunityDetectionEnabled     Boolean  @default(true)
  opportunityKeywords             String[] @default(["mantenimiento", "contrato", "preventivo"])
  upsellProducts                  Json?    // UpsellProduct[]
  minConfidenceToFlagOpportunity  Int      @default(60)
}
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `services/ai/app/workflows/opportunity_detection.py` | LangGraph workflow |
| `services/ai/app/api/opportunity.py` | FastAPI endpoint |
| `apps/web/components/whatsapp/OpportunityCard.tsx` | UI component |

**Key Pattern:**
```python
# Workflow nodes: check_keywords → analyze_context → classify → match_product → suggest
workflow.add_edge("check_keywords", "analyze_context")
workflow.add_edge("analyze_context", "classify_opportunity")
# ... etc
```

### A2: Unified Copilot Workflow

**Goal:** Single LangGraph workflow for all AI interactions.

> ⚠️ **State Explosion Prevention:** Don't pass full history/profile to every node.
> Use "Working Memory" pattern - summarize context once, pass summary to most nodes.

**Master State Definition:**
```python
class CopilotState(TypedDict):
    # Identity
    session_id: str
    organization_id: str
    conversation_id: Optional[str]
    phone: str                           # v5.0: Primary identity token from webhook
    
    # SYSTEM-LAYER PRE-LOADED CONTEXT (v5.0 — populated BEFORE AI wakes up)
    # These fields are set by the System Layer during debounce. The AI layer
    # NEVER does DB lookups for these — they arrive ready in the state.
    is_new_contact: bool                 # True = first-ever message from this phone
    pre_loaded_profile: dict             # CustomerAIProfile (auto-created if new)
    pre_loaded_active_job: Optional[dict]  # Active job for this customer (if any)
    pre_loaded_org_config: dict          # AIConfiguration (cached in Redis)
    pre_loaded_360_summary: Optional[str]  # v_customer_360 pre-computed summary (~100 tokens)
    
    # Input
    input_type: Literal["text", "voice", "action", "image"]
    input_content: str
    image_urls: Optional[list[str]]  # For multi-modal
    
    # WORKING MEMORY (lightweight - passed to all nodes)
    # v5.0: Created by intake_node from pre-loaded context (1 LLM call)
    # NOT from DB queries — those were already done by System Layer.
    working_memory: str              # Summarized context (~200 tokens)
    current_context: str             # Last 3 messages formatted
    
    # RAW DATA (loaded lazily - only for nodes that need it)
    _raw_history: Optional[list[dict]]   # Full history, loaded by response_generator
    _raw_profile: Optional[dict]          # Full profile, loaded by style_adapter
    
    # Processing
    detected_intent: str
    intent_confidence: float
    plan_steps: list[dict]
    current_step: int
    
    # INTENT CHAINING (multi-domain requests — v4.1)
    intent_chain: list[str]            # ["promote_contact", "book_job"] — dependency-sorted
    current_chain_index: int           # Which step in the chain is executing
    chain_results: dict[str, Any]      # Results keyed by intent from completed steps
    
    # CONTEXT MUTATIONS (structured data between chained sub-agents — v4.1)
    context_mutations: list[dict]      # ContextMutation[] — accumulated across chain
    
    # REROUTE GUARD (sub-agent yield protection — v4.1)
    reroute_count: int                 # Incremented on yield; max 2 before escalation
    
    # PARTIAL CHAIN RESULTS (accumulated responses from completed steps — v4.1)
    intermediate_responses: list[str]  # Human-readable result per completed chain step
    
    # REAL-TIME SIGNALS (detected every message)
    detected_urgency: Literal["normal", "urgent", "emergency"]
    detected_sentiment: Literal["positive", "neutral", "negative", "frustrated"]
    frustration_indicators: list[str]
    
    # Output
    response_content: str
    proposed_actions: list[dict]
    requires_approval: bool
```

**Context Mutation Protocol (v4.1 — Cross-Domain Data Flow):**

> 💡 When sub-agents are chained (e.g., Customer → Scheduling), each agent emits
> structured mutations instead of appending text to working memory. This is fast
> (no LLM call), precise (typed data), and free (no extra tokens).

```python
# services/ai/app/structs.py

class ContextMutation(TypedDict):
    """Structured data emitted by a sub-agent for downstream consumers."""
    agent: str             # "CustomerAgent"
    action: str            # "created_entity" | "updated_entity" | "queried_data"
    entity_type: str       # "customer" | "job" | "vehicle"
    entity_id: str         # "cust_abc123"
    key_value_pairs: dict  # {"name": "Juan", "cuit": "20-12345678-9"}
```

**How downstream sub-agents consume mutations (no LLM needed):**
```python
# Inside SchedulingAgent's load_domain_context
def resolve_customer_from_chain(state: CopilotState) -> str | None:
    """Check if a previous chain step already created/found a customer."""
    for mutation in reversed(state.get("context_mutations", [])):
        if mutation["entity_type"] == "customer":
            return mutation["entity_id"]
    return None
```

#### What's Loaded Per Request (4 Layers)

> 📌 **v5.0 CHANGE:** Layer 0 (System Layer) is new. It runs deterministically during debounce, BEFORE the AI wakes up. Layer 1 is now the AI's intake step that creates working memory FROM the pre-loaded data.

**Layer 0 — SYSTEM LAYER (deterministic, during debounce, no LLM):**

| Data | Source | Latency | Notes |
|------|--------|---------|-------|
| CustomerAIProfile | `SELECT ... WHERE phone + orgId` (indexed) | ~5ms | **Auto-created on first contact.** Phone + orgId = guaranteed unique identity. 0 LLM calls. |
| Active Job | `Job` WHERE `customerId` AND non-terminal status | ~3ms (parallel) | Pre-fetched during debounce. If no linked Customer yet, returns null. |
| Org AI Configuration | `AIConfiguration` (Redis-cached) | ~1ms (parallel) | Business hours, services, FAQs, tone setting. Cache hit rate ~99%. |
| v_customer_360 summary | Pre-computed SQL view column | ~5ms (parallel) | Invoices, complaints, preferred tech — already summarized to ~100 tokens. No LLM summarization needed. |
| is_new_contact flag | Result of profile lookup | ~0ms | `true` if profile was just auto-created. Surfaces opportunity card to dispatcher. |
| Voice transcription | Whisper API (async parallel) | ~1.5s (parallel during debounce) | If voice memo, transcription starts immediately and completes during debounce wait. |

**Layer 1 — AI INTAKE (working memory creation, 1 LLM call):**

| Data | Source | Size | Notes |
|------|--------|------|-------|
| Working Memory | LLM summary of **pre-loaded context** | ~200 tokens | Created from `pre_loaded_profile` + `pre_loaded_360_summary` + session messages. One LLM call, ~100ms. |
| Current Session Messages | `WaMessage` WHERE `sessionId` = current | ~500-1500 tokens (last 15 messages max) | Only messages from THIS session, never from previous sessions |

**Layer 2 — ON-DEMAND (loaded by specific sub-agents via tool calls when needed):**

| Data | Loaded By | When | Notes |
|------|-----------|------|-------|
| Past job history | SchedulingAgent, CustomerAgent | Booking request, customer lookup | `SELECT last 5 jobs` — structured data, not raw messages |
| Past complaints | EscalationAgent | Complaint detected | Last 3 complaints with resolution status |
| Invoice history | FinancialAgent | Payment/quote request | Outstanding invoices, payment patterns |
| Service frequency | ProactiveAgent | Maintenance reminder | Last N services by type + dates |
| Previous session summaries | Any agent (rare) | Complex dispute, context needed | Stored as structured JSON, not raw messages |

**Layer 3 — NEVER loaded into AI context:**

| Data | Why Not |
|------|---------|
| Raw messages from previous sessions | Too large, irrelevant, confuses the model, expensive |
| Full conversation thread (months/years of messages) | Would blow out context window — a 6-month thread could be 50K+ tokens |
| Other customers' data | Tenant isolation — the AI only sees data for the current customer + org |
| Internal dashboard actions by the owner/admin | The AI sees WhatsApp messages only, not dashboard clicks |
| Deleted or archived messages | Once removed, they don't exist for the AI |


**Working Memory Pattern (Token Optimization):**
```python
async def context_loader_node(state: CopilotState) -> CopilotState:
    """Intake node — creates compact working memory from PRE-LOADED context.
    
    v5.0: This node NO LONGER does DB queries for profile/job/config.
    Those are already in the state, populated by the System Layer during debounce.
    This node only does:
    1. Fetch session messages (from DB or Redis session cache)
    2. One LLM call to create working_memory summary (~100ms)
    """
    
    # Profile and context are already pre-loaded by System Layer
    profile = state["pre_loaded_profile"]           # Already in state — no DB call
    active_job = state["pre_loaded_active_job"]     # Already in state — no DB call
    summary_360 = state["pre_loaded_360_summary"]   # Already in state — no DB call
    
    # Only DB call: fetch current session messages
    history = await fetch_session_messages(state["session_id"])
    
    # Create compact summary (one LLM call, ~100ms)
    working_memory = await summarize_context(history[-10:], profile, summary_360)
    # Output for known contact:
    #   "María García, contacto frecuente (score: 0.85). Último: AC hace 6 meses.
    #    Prefiere mañanas, estilo formal. Contexto: preguntó sobre mantenimiento."
    # Output for new contact (is_new_contact=True):
    #   "Nuevo contacto (+54 9 11 1234-5678). Primera interacción. Sin historial."
    
    return {
        **state,
        "working_memory": working_memory,  # ~200 tokens
        "current_context": format_last_messages(history[-3:]),  # ~100 tokens
        "_raw_history": history,
        "_raw_profile": profile,
    }
```

**Token Savings:**
| Approach | Tokens/Request | Cost Impact |
|----------|----------------|-------------|
| Full history to all nodes | ~10,000 | $$$$ |
| Working memory pattern | ~500 | $ |

#### Hard Limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max messages per session in context | **15** | Beyond 15, use working memory summary. Prevents context window bloat. |
| Max tokens for conversation context | **2,000** | System prompt (~800) + context (2,000) + response (1,000) = ~3,800 total, well within gpt-4o-mini's 128K but keeps costs per-request under ~$0.002 |
| Max tokens for working memory summary | **300** | Compact summary refreshed periodically within the session |
| Max single message length | **4,000 chars** | Via `prompt-sanitizer.ts` — truncates with `[contenido truncado]` |
| Max session duration | **4 hours** | Safety cap — auto-close and fresh session |
| Session inactivity timeout | **30 minutes** (configurable per org) | Balance between keeping context alive and preventing stale sessions |
| Max profile size | **500 tokens** | CustomerAIProfile summary — compact structured data |



**Files to Create:**
| File | Purpose |
|------|---------|
| `services/ai/app/workflows/orchestrator.py` | Main orchestrator (see Phase A0) |
| `services/ai/app/workflows/nodes/context_loader.py` | Working memory creation |
| `services/ai/app/workflows/nodes/sentiment_detector.py` | Real-time urgency/frustration |

### A3: Migration Path with Fast Path Routing

**Goal:** Gradual cutover with feature flag AND latency optimization.

> ⚠️ **Latency Concern:** Adding Python round-trip adds ~400-600ms. 
> **Solution:** Hybrid routing - simple requests stay in TypeScript, complex go to Python.

**Latency Expectations:**
| Request Type | Path | Expected Latency |
|--------------|------|------------------|
| Simple reply (greeting, FAQ) | TypeScript direct | ~400-600ms |
| Complex (planning, tools) | Python LangGraph | ~1-2s |
| Voice message | Python (already) | ~1.5-2s |

**Hybrid Classifier (Regex + SLM Fallback):**
```typescript
// apps/web/app/api/copilot/chat/route.ts

export async function POST(request: NextRequest) {
  const { message, conversationId, organizationId } = await request.json();
  
  // STEP 1: Fast complexity classification
  const complexity = await classifyComplexity(message);
  
  if (complexity === 'simple') {
    // FAST PATH: Direct OpenAI in TypeScript
    return await handleSimpleRequest(message, organizationId);
  } else {
    // COMPLEX PATH: Stream from Python LangGraph
    return await streamFromPythonWorkflow(message, conversationId);
  }
}

async function classifyComplexity(message: string): Promise<'simple' | 'complex'> {
  // TIER 1: Obvious patterns (free, instant, ~1ms)
  const trimmed = message.trim().toLowerCase();
  
  // Definite simple
  if (/^(hola|buenos días|gracias|ok|sí|no|dale|perfecto)$/i.test(trimmed)) {
    return 'simple';
  }
  
  // Definite complex
  if (/reprogramar todos|cancelar.*citas|emergencia|reagendar/i.test(message)) {
    return 'complex';
  }
  
  // TIER 2: Ambiguous → quick SLM classification (~150ms, ~$0.00005)
  // Example: "Quiero agendar con Juan para mañana" - is this simple or complex?
  const classification = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Classify if this message needs multi-step planning (complex) or is a simple request (simple). Reply with only: simple or complex' },
      { role: 'user', content: message }
    ],
    max_tokens: 5,
  });
  
  return classification.choices[0].message.content?.includes('complex') ? 'complex' : 'simple';
}
```

**Why Hybrid > Pure Regex:**
| Approach | Speed | Accuracy | Example Failure |
|----------|-------|----------|----------------|
| Pure Regex | ~1ms | ~70% | "Agendar con Juan" triggers /agendar/ but is simple |
| Pure SLM | ~150ms | ~95% | Adds latency to ALL requests |
| **Hybrid** | ~5ms avg | ~92% | Best of both worlds |

**Streaming Pattern (for complex requests):**
```typescript
// Stream tokens from Python to avoid "waiting" UX
async function streamFromPythonWorkflow(message: string, conversationId: string) {
  const response = await fetch(`${AI_SERVICE_URL}/api/copilot/stream`, {
    method: 'POST',
    body: JSON.stringify({ message, conversationId }),
  });
  
  return new Response(response.body, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

**Python Streaming Endpoint:**
```python
# services/ai/app/api/copilot.py
from fastapi.responses import StreamingResponse

@router.post("/stream")
async def stream_copilot_response(request: CopilotRequest):
    async def generate():
        async for chunk in copilot_workflow.astream(request.dict()):
            yield f"data: {json.dumps(chunk)}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
```

### A4: Observability

**Goal:** Full LangSmith tracing.

**Environment:**
```env
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=campotech-copilot
LANGSMITH_TRACING_V2=true
```

---

## Phase A-Eval: Evaluation System (Weeks 7-12)

### Schema Additions

```prisma
model AIEvaluationDataset {
  id              String   @id @default(cuid())
  organizationId  String
  name            String
  isGolden        Boolean  @default(false)
  cases           AIEvaluationCase[]
  runs            AIEvaluationRun[]
  @@map("ai_evaluation_datasets")
}

model AIEvaluationCase {
  id                String   @id @default(cuid())
  datasetId         String
  inputMessage      String
  expectedIntent    String?
  expectedEntities  Json?
  expectedAction    String?
  sourceLogId       String?  // From AIConversationLog
  humanVerified     Boolean  @default(false)
  @@map("ai_evaluation_cases")
}

model AIEvaluationRun {
  id              String   @id @default(cuid())
  datasetId       String
  configSnapshot  Json
  status          String   @default("pending")
  intentAccuracy  Float?
  entityF1Score   Float?
  avgLatencyMs    Int?
  @@map("ai_evaluation_runs")
}

model AIConfidenceCalibration {
  id                 String   @id @default(cuid())
  organizationId     String
  confidenceBucket   Int      // 70, 80, 90
  totalPredictions   Int      @default(0)
  correctPredictions Int      @default(0)
  @@map("ai_confidence_calibration")
}

model AIABTest {
  id              String   @id @default(cuid())
  organizationId  String
  configA         Json
  configB         Json
  trafficSplit    Int      @default(50)
  status          String   @default("draft")
  impressionsA    Int      @default(0)
  impressionsB    Int      @default(0)
  @@map("ai_ab_tests")
}
```

**Files to Create:**
| File | Purpose |
|------|---------|
| `services/ai/app/api/evaluation.py` | Dataset & batch eval API |
| `services/ai/app/evaluation/engine.py` | Metrics calculation |
| `services/ai/app/calibration/updater.py` | Update calibration on feedback |
| `services/ai/app/ab_testing/router.py` | A/B assignment logic |
| `apps/web/app/dashboard/settings/ai-assistant/evaluation/` | Dashboard UI |

---

## Phase B: Memory & Profiles (Weeks 13-16)

### Goal

Enable cross-session learning through customer profiles and conversation memory.

### B1: Customer AI Profile Schema

> 📌 **DESIGN DECISION (2026-02-21):** `CustomerAIProfile` is the AI's **memory notebook** for a phone number, NOT a business entity. It is:
> - **Keyed by `phone + organizationId`** (not `customerId`)
> - **Auto-created on first-ever message** from any phone number — no approval needed
> - **Exists for ALL contacts** — even spam, wrong numbers, one-time inquiries (~1KB per record)
> - **Optionally linked to a Customer** entity when the contact is "promoted" to a formal customer
>
> The existence/non-existence of a profile IS the identity check:
> - Profile exists → AI has full memory.
> - Profile not found → First-ever message from this number. Auto-create NOW.

```prisma
model CustomerAIProfile {
  id                     String   @id @default(cuid())
  
  // ═══ PRIMARY IDENTITY (phone + org = unique contact) ═══
  phone                  String                        // +54 9 11 1234-5678 — the guaranteed identity
  organizationId         String
  
  // Optional link to formal Customer (set when contact is "promoted")
  customerId             String?  @unique              // null until dispatcher creates a Customer entity
  customer               Customer? @relation(fields: [customerId], references: [id])
  
  // ═══ CONTACT LIFECYCLE ═══
  status                 String   @default("contact")  // "contact" → "lead" → "customer"
  displayName            String?                        // Extracted from messages: "María", "Juan"
  firstContactAt         DateTime @default(now())       // When this phone first messaged this org
  
  // ═══ AI DISCLOSURE & CONSENT ═══
  aiDisclosureSentAt     DateTime?                      // When first-contact AI disclosure was sent
  aiCommunicationOptOut  Boolean  @default(false)       // Level 2: never respond with AI
  aiTrainingOptOut       Boolean  @default(false)       // Level 3: exclude from training data
  
  // ═══ COMMUNICATION STYLE (learned from messages) ═══
  preferredFormality     String?  // "formal" | "casual" | "mixed"
  typicalMessageLength   String?  // "brief" | "detailed"
  responseUrgency        Float?   // 0-1 scale (how fast they expect replies)
  emojiUsage             Boolean  @default(false)
  preferredContactTimes  Json?    // { morning: true, evening: false }
  
  // ═══ RELATIONSHIP METRICS ═══
  relationshipScore      Float    @default(0.0)  // 0 = brand new contact, 1 = loyal customer
  totalInteractions      Int      @default(0)
  positiveInteractions   Int      @default(0)
  
  // ═══ PREFERENCES (learned from history) ═══
  preferredTechnicians   String[] @default([])
  preferredServices      String[] @default([])
  priceAversion          Float?   // 0 = price-insensitive, 1 = very sensitive
  
  // ═══ TIMESTAMPS ═══
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  
  @@unique([phone, organizationId])  // ONE profile per phone per org
  @@index([organizationId])
  @@index([organizationId, status])  // Fast filtering by lifecycle stage
  @@map("customer_ai_profiles")
}
```

**System-Level Auto-Creation (no LLM, no approval):**
```python
# services/ai/app/system/identity_resolver.py
# This runs in the SYSTEM LAYER during debounce — BEFORE AI wakes up.

async def resolve_or_create_profile(
    phone: str, organization_id: str, message_text: str
) -> tuple[CustomerAIProfile, bool]:
    """Resolve phone to profile, or auto-create on first contact.
    
    Returns: (profile, is_new_contact)
    Cost: ~5ms (indexed DB query) or ~8ms (query + insert)
    LLM calls: 0
    """
    profile = await prisma.customeraiprofile.find_unique(
        where={"phone_organizationId": {"phone": phone, "organizationId": organization_id}}
    )
    
    if profile:
        # Known contact — AI has full memory
        return (profile, False)
    
    # First-ever message from this phone number!
    # Auto-create profile immediately — no approval needed.
    display_name = extract_name_from_message(message_text)  # Simple regex, not LLM
    
    new_profile = await prisma.customeraiprofile.create(
        data={
            "phone": phone,
            "organizationId": organization_id,
            "displayName": display_name,
            "status": "contact",
            "relationshipScore": 0.0,
        }
    )
    
    return (new_profile, True)
```

#### How the AI References Past Interactions

**The AI NEVER loads raw messages from previous sessions.** Instead, it uses two mechanisms:

**1. Profile-based context (automatic, every request):**
The `CustomerAIProfile` contains learned facts that the AI uses naturally.

For a **known contact** (has history):
```
"María García, clienta frecuente (12 trabajos, 2 años). Último servicio: AC split
 hace 4 meses. Prefiere mañanas, tono formal. Score: 0.85 (excelente).
 Técnico preferido: Carlos. Servicios frecuentes: AC, electricidad."
```
This lets the AI say "¡Hola María! ¿Cómo anduvo el AC que arreglamos en octubre?" without loading October's messages.

For a **new contact** (first-ever message, auto-created profile):
```
"Nuevo contacto (+54 9 11 1234-5678). Primera interacción. Sin historial.
 Status: contact. Nombre detectado: 'Juan' (del mensaje). Score: 0.0."
```
The AI still responds intelligently using org config (services, hours, pricing) even with zero contact history.

**2. On-demand database queries (via sub-agent tools, when needed):**
If the customer asks "¿cuándo fue la última vez que vinieron?" or there's a dispute about past work, the sub-agent can call a tool like `query_job_history` which returns structured data:
```json
{
  "lastJobs": [
    {"date": "2025-10-15", "service": "AC Split - Mantenimiento", "tech": "Carlos", "status": "COMPLETED", "rating": 5},
    {"date": "2025-06-20", "service": "Electricidad - Tablero", "tech": "Pedro", "status": "COMPLETED", "rating": 4}
  ]
}
```
This is **structured data from the database**, not raw WhatsApp messages. It's cheaper, more reliable, and doesn't pollute the context window.

**What this means in practice:**

| Scenario | How AI handles it |
|----------|-------------------|
| **First-ever message from unknown number** | System auto-creates `CustomerAIProfile` with phone+orgId. AI greets: "¡Hola! Soy el asistente de [Empresa]. ¿En qué te puedo ayudar?" Profile starts at score 0.0, status "contact". |
| Customer returns after 6 months | New session. AI greets using profile: "¡Hola María! Hace un tiempo que no nos escribías. ¿En qué te puedo ayudar?" |
| Customer asks about a past job | Sub-agent queries `Job` table, returns structured data. AI responds with facts from DB, not from recalled messages. |
| Customer is angry about unresolved issue | EscalationAgent loads last 3 complaints from DB. Profile shows low relationship score. AI adapts tone. |
| Customer has been chatting for 20 messages in current session | Working memory is refreshed (re-summarized). Only last 15 raw messages in context. Older session messages are summarized. |
| Customer messages after job completion | Previous session is closed. New session starts with updated profile (includes the completed job's data). |



### B2: Two-Tier Learning (Real-Time + Intent-Based Extraction)

> ⚠️ **Concern:** Waiting 30 minutes for conversation end misses mid-conversation signals.
> **Solution:** Two-tier approach - real-time signals + intent-based profile extraction.

**Tier 1: Real-Time Detection (Every Message)**
```python
# In orchestrator.py intake phase OR as a shared node injected into all sub-agents
async def detect_signals_node(state: CopilotState) -> CopilotState:
    """Detect urgency and sentiment in real-time."""
    message = state["input_content"]
    
    # Fast heuristics (no LLM call needed)
    frustration_indicators = []
    
    if message.isupper():
        frustration_indicators.append("caps_lock")
    if message.count("!") >= 3:
        frustration_indicators.append("excessive_exclamation")
    if message.count("?") >= 3:
        frustration_indicators.append("repeated_questions")
    if any(word in message.lower() for word in ["urgente", "emergencia", "ya"]):
        frustration_indicators.append("urgency_keywords")
    
    # Check conversation history for patterns
    history = state.get("_raw_history", [])
    if len(history) >= 3:
        last_3_intents = [m.get("intent") for m in history[-3:]]
        if len(set(last_3_intents)) == 1:  # Same question 3x
            frustration_indicators.append("repeated_same_question")
    
    urgency = "emergency" if "emergencia" in message.lower() else \
              "urgent" if len(frustration_indicators) >= 2 else "normal"
    
    return {
        **state,
        "detected_urgency": urgency,
        "detected_sentiment": "frustrated" if len(frustration_indicators) >= 2 else "neutral",
        "frustration_indicators": frustration_indicators,
    }
```

**Tier 2: Intent-Based Profile Extraction (Not Cron)**

#### Profile Update Triggers

The `CustomerAIProfile` is the AI's permanent memory. It's updated at specific lifecycle moments, NOT on every message (that would be expensive and noisy). **Exception:** auto-creation on first-ever message is instant and deterministic (no LLM call).

| Trigger | What's Updated | How |
|---------|---------------|-----|
| **First message from unknown phone** | `phone`, `organizationId`, `displayName`, `firstContactAt`, `status:"contact"` | **Deterministic system-level INSERT** (no LLM needed). Auto-created by System Layer during debounce. Cost: ~8ms. |
| **Session close (any reason)** | `preferredFormality`, `typicalMessageLength`, `emojiUsage`, `relationshipScore` | LLM summarization of session → profile delta extraction. Single LLM call (~100ms, ~$0.0005) |
| **Job completed** | `preferredTechnicians`, `preferredServices`, relationship score boost | Deterministic update from job data (no LLM needed) |
| **Job cancelled** | Relationship score adjustment | Small negative adjustment (configurable weight) |
| **Complaint resolved** | `positiveInteractions` or `totalInteractions` | Deterministic |
| **Explicit positive feedback** | `relationshipScore` boost | Deterministic — "excelente servicio" → +0.1 |
| **Contact promoted to Customer** | `customerId`, `status:"customer"` | Deterministic — links profile to new Customer entity |
| **Inactivity fallback (cron)** | Same as session close | Safety net — runs every 30 min for sessions with no explicit close. Catches edge cases where the customer just stops replying mid-conversation. |



> 💡 **Better than 30-min gap:** Trigger on "goodbye" intent within the workflow itself.

> ⚠️ **v4.0 Note:** The old flat `route_by_intent()` below is **superseded** by the Phase A0
> `route_to_subagent()` pattern that maps intents → sub-agent categories. Profile extraction
> now runs as a shared post-processing node in the orchestrator's `respond` step when the
> `GeneralAgent` detects a farewell intent.

```python
# LEGACY PATTERN — for reference only. See Phase A0 orchestrator for current routing.
# In the sub-agent architecture, farewell intents route to GeneralAgent,
# which triggers summarize_and_extract as its domain_execute step.
async def route_by_intent(state: CopilotState) -> str:
    intent = state["detected_intent"]
    
    if intent in ["goodbye", "thanks_bye", "done", "exit"]:
        return "summarize_and_extract"  # Triggers profile extraction
    elif intent == "booking":
        return "handle_booking"  # → Now handled by SchedulingAgent
    elif intent == "question":
        return "handle_question"  # → Now handled by GeneralAgent
    else:
        return "generate_response"  # → Fallback to GeneralAgent

async def summarize_and_extract_node(state: CopilotState) -> CopilotState:
    """Final node for conversation - extracts learnings immediately."""
    
    # Extract profile updates from this conversation
    analysis = await llm.invoke(f"""
    Analyze this conversation and extract:
    1. Formality level (formal/casual/mixed)
    2. Typical message length (brief/detailed)
    3. Response speed expectations
    4. Any preferences mentioned (technicians, times, services)
    
    Conversation: {state.get('_raw_history', [])}
    """)
    
    await update_customer_profile(state["pre_loaded_profile"]["id"], analysis)
    
    # Generate closing response
    response = "¡Perfecto! Si necesitás algo más, escribime. ¡Buen día!"
    
    return {**state, "response_content": response, "conversation_closed": True}
```

**Why Intent-Based > Cron-Based:**
| Approach | Latency | Overhead | Edge Cases |
|----------|---------|----------|------------|
| 30-min gap cron | Delayed | Cron job running | Miss if user starts new convo immediately |
| **Intent-based** | Immediate | None | Handles all cases |

| Type | When | What | Storage |
|------|------|------|---------|  
| Real-time | Every message | Urgency, frustration, sentiment | Workflow state (transient) |
| Post-hoc | On "goodbye" intent | Formality, preferences, patterns | CustomerAIProfile (persistent) |

**Files to Create:**
| File | Purpose |
|------|---------|
| `services/ai/app/memory/profile_extractor.py` | Profile extraction logic |
| `services/ai/app/memory/context_loader.py` | Load profile + history |
| `services/ai/app/workflows/nodes/signal_detector.py` | Real-time urgency/sentiment |
| `services/ai/app/workflows/nodes/session_summarizer.py` | Intent-based extraction |

### B3: Session Management & WhatsApp Infrastructure

> 📌 **DESIGN DECISION (2026-02-21):** WhatsApp conversations between an org and a customer can span months or years in a single chat thread (same phone number). The AI cannot load years of raw message history — it would blow out the context window, cost a fortune in tokens, and confuse the model with irrelevant past interactions. Instead, the AI operates on **sessions** within conversations, with a **persistent profile** that acts as its long-term memory.

#### Core Concepts

| Concept | Scope | Lifespan | Purpose |
|---------|-------|----------|---------|
| **Conversation** | 1 phone number × 1 org (the WhatsApp thread) | Permanent — never deleted or reset | The persistent "channel." Contains ALL messages ever exchanged. Used for dashboard display and audit logs, NOT for AI context. |
| **Session** | One "interaction burst" within a conversation | Active while the customer is engaged. Closes on inactivity timeout or job lifecycle event. | The AI's working context window. Contains only the messages exchanged during this session. |
| **CustomerAIProfile** | **One phone number × one org** | Permanent — **auto-created on first message**, updated at session close | The AI's "memory." Keyed by `phone + organizationId`. Exists for ALL contacts from first message. Optionally linked to a formal Customer entity when promoted. Learned preferences, communication style, relationship score. |

#### Session Lifecycle

```
Customer sends message
        │
        ▼
┌─ Is there an active session? ─────────────────────────────────┐
│                                                                │
│  NO (first contact or session expired)                        │
│    → Create NEW session                                        │
│    → Load or AUTO-CREATE CustomerAIProfile (by phone + orgId)  │
│    → Pre-fetch: active job (if any) + org config (System Layer) │
│    → Session starts with this message as message #1            │
│    → If AI is enabled + within response window: self-identify  │
│    → If is_new_contact: include AI disclosure footer (once)     │
│                                                                │
│  YES (session still active)                                    │
│    → Append message to current session                         │
│    → Load: session messages + working memory + profile         │
│    → No self-identification needed (already greeted)           │
└────────────────────────────────────────────────────────────────┘
        │
        ▼
   AI processes within configured permissions
        │
        ▼
┌─ Session close triggers ──────────────────────────────────────┐
│                                                                │
│  1. INACTIVITY TIMEOUT (default: 30 min, configurable per org) │
│     → Customer stops messaging for >30 minutes                 │
│     → Session closes silently (no goodbye message)             │
│     → Profile update triggered                                 │
│                                                                │
│  2. JOB LIFECYCLE EVENT                                        │
│     → Job reaches terminal state (COMPLETED or CANCELLED)      │
│     → Session closes — next message starts fresh session        │
│     → Profile update triggered (includes job outcome data)     │
│                                                                │
│  3. EXPLICIT FAREWELL                                          │
│     → Customer says "gracias", "chau", "listo"                 │
│     → AI responds with farewell                                │
│     → Session closes after farewell response                   │
│     → Profile update triggered                                 │
│                                                                │
│  4. HUMAN HANDOFF                                              │
│     → Escalation to human takes over the conversation          │
│     → AI session pauses (not closed)                           │
│     → Resumes if human clicks "Return to AI" in dashboard      │
│                                                                │
│  5. MAX SESSION DURATION (safety cap: 4 hours)                 │
│     → Prevents runaway sessions from accumulating              │
│       unbounded context                                        │
│     → Auto-closes and starts fresh if customer continues       │
└────────────────────────────────────────────────────────────────┘
```

> ⚠️ **Critical for WhatsApp:** Redis IS required for message locking to prevent race conditions.
> For session caching, PostgreSQL is sufficient initially.

**Redis Requirements by Use Case:**
| Use Case | Required? | Why |
|----------|-----------|-----|
| Session context caching | Optional | Postgres fine for <500 orgs |
| **WhatsApp message locking** | **REQUIRED** | Prevents race conditions |
| Rate limiting | Optional | Can use database counter |
| Pending approvals | Optional | Database with TTL column |

#### Message Burst Handling & Debounce

> 📌 **DESIGN DECISION (2026-02-21):** WhatsApp customers commonly send 2-5+ messages in rapid succession — a greeting, then the problem description, then a voice memo, then a photo. If the AI responds to "Hola" immediately, it looks dumb when the actual request arrives 3 seconds later. The solution is a **debounce timer at the infrastructure level** — NO LLM calls happen during the wait, so there is ZERO token consumption while buffering.

**The Problem:**
```
14:05:01 → "Hola"                              ← AI should NOT respond here
14:05:03 → "Necesito un plomero"                ← Still building request
14:05:08 → "Se me rompió la canilla de cocina"  ← Still building request
14:05:12 → 🎤 [voice memo - 15 seconds]         ← Transcription starts in parallel
14:05:15 → 📷 [photo of broken faucet]           ← Final piece
14:05:23 → (8 seconds of silence)               ← NOW the AI processes everything
```

**The Flow:**

```
  WhatsApp Webhook receives message
           │
           ▼
  ┌─ Message Buffer (Redis) ──────────────────────────────────────┐
  │                                                                │
  │  1. Store message in buffer list                               │
  │     Key: wa:buffer:{conversationId}                            │
  │     Value: RPUSH message JSON (ordered list)                   │
  │     TTL: 5 minutes (safety — auto-cleanup if never processed)  │
  │                                                                │
  │  2. If voice memo → kick off async transcription               │
  │     Key: wa:transcription:{messageId} = "PENDING"              │
  │     Whisper runs in parallel, updates to "DONE:{text}"         │
  │                                                                │
  │  3. Set/reset debounce timer                                   │
  │     Key: wa:debounce:{conversationId}                          │
  │     Mechanism: Redis EXPIRE or scheduled task (see below)      │
  │     Duration: adaptive (see timing table)                      │
  │                                                                │
  │  4. If AI enabled → send "typing" indicator to customer        │
  │     (WhatsApp "..." bubble — shows the business is active)     │
  │                                                                │
  │  5. Return 200 OK to webhook IMMEDIATELY                       │
  │     ⚠️ NO LLM call. NO token consumption. Pure infrastructure. │
  └────────────────────────────────────────────────────────────────┘
           │
           │  Debounce timer fires (no new message for N seconds)
           ▼
  ┌─ Batch Processor ─────────────────────────────────────────────┐
  │                                                                │
  │  1. Acquire Redis concurrency lock (existing NX pattern)       │
  │     Key: wa:lock:{conversationId}, TTL: 30s                    │
  │     If locked → re-queue (another batch is in flight)          │
  │                                                                │
  │  2. Read ALL messages from wa:buffer:{conversationId}          │
  │     Typically 1-5 messages                                     │
  │                                                                │
  │  3. Check pending transcriptions                               │
  │     For each voice memo in buffer:                             │
  │       - Read wa:transcription:{messageId}                      │
  │       - If still PENDING → wait up to 15s more (polling 1s)    │
  │       - If timed out → use placeholder "[Audio no transcripto]"│
  │     This is the ONLY wait that might happen — and it's rare    │
  │                                                                │
  │  4. Compose unified input                                      │
  │     Concatenate all text messages + transcriptions + captions   │
  │     into a single context block (see format below)             │
  │                                                                │
  │  4.5. SYSTEM LAYER: Deterministic pre-fetch (v5.0)            │
  │     ∥ PARALLEL (all execute simultaneously, ~5-8ms total):     │
  │       a) resolve_or_create_profile(phone, orgId, message)      │
  │          → Returns (profile, is_new_contact)                   │
  │          → Auto-creates on first-ever message (0 LLM calls)    │
  │       b) pre_fetch_active_job(profile.customerId)              │
  │       c) load_org_config(orgId)  // Redis-cached, ~1ms          │
  │       d) fetch_360_summary(profile.customerId)                 │
  │     Result: pre-loaded context ready for AI pipeline            │
  │                                                                │
  │  5. Process through AI pipeline (NOW the LLM is called)        │
  │     → Session lookup/creation                                  │
  │     → Receive pre-loaded context from System Layer (step 4.5)  │
  │     → Create working memory (1 LLM call)                       │
  │     → Classify intent + route to sub-agent                     │
  │     → Single response generated                                │
  │                                                                │
  │  6. Send ONE response to customer                              │
  │     (Not 5 responses for 5 messages — one comprehensive reply) │
  │                                                                │
  │  7. Clear buffer + delete debounce key                         │
  │     LRANGE + DEL on wa:buffer:{conversationId}                 │
  └────────────────────────────────────────────────────────────────┘
```

**Composed Input Format (what the LLM sees):**
```
[Mensaje 1, 14:05:01]: Hola
[Mensaje 2, 14:05:03]: Necesito un plomero
[Mensaje 3, 14:05:08]: Se me rompió la canilla de cocina
[Mensaje 4, 14:05:12, audio transcripto]: Mirá, el problema es que la canilla
  de la cocina pierde agua todo el tiempo, ya probé apretar la llave de paso
  pero sigue goteando. Necesito que vengan lo antes posible.
[Mensaje 5, 14:05:15, imagen]: [Cliente envió una foto]
```
The LLM receives all messages as a single batch with timestamps, so it can understand the full context and respond once comprehensively.

**Adaptive Debounce Timing:**

| Scenario | Timer Duration | Rationale |
|----------|---------------|-----------|
| **First message of new session** | **8 seconds** | Customer is likely composing their full request. Give them time to type it all out. |
| **First message contains voice memo** | **12 seconds** | Voice memos take longer. Customer might follow up with text or photos after recording. Also gives Whisper time to transcribe. |
| **First message contains image/photo** | **10 seconds** | Photos are usually followed by a caption or description message. |
| **Mid-conversation reply** (AI already responded) | **5 seconds** | Customer is responding to a question — shorter burst expected. |
| **After AI asked a yes/no question** | **4 seconds** | Expected reply is short ("sí", "dale"). Quick turnaround. |
| **Single word/emoji message** ("ok", "👍") | **3 seconds** | Acknowledgement — probably no follow-up coming. |

**How the Timer Doesn't Consume Tokens:**

This is the critical point — the debounce is **pure infrastructure**:

```
              NO LLM INVOLVEMENT
┌──────────────────────────────────────────────┐
│                                              │
│   Webhook → Redis RPUSH → Redis EXPIRE       │
│                                              │
│   That's it. Three Redis commands.           │
│   Cost: ~0.001ms per message.                │
│   Token cost: $0.00                          │
│                                              │
│   The LLM is only called ONCE after the      │
│   debounce timer fires and processes the     │
│   full batch.                                │
│                                              │
└──────────────────────────────────────────────┘
```

- **No "thinking" state.** The AI is not loaded, not running, not consuming anything during the wait.
- **No "waiting" state.** There's no open connection to OpenAI. The timer is a Redis TTL or a scheduled task — passive, cost-free.
- **The customer sees a "typing" indicator** (WhatsApp's native `...` bubble), so they know the business received their messages. This is a simple API call to Meta, not an AI operation.

**Voice Memo Handling (Parallel Transcription):**

```
Message arrives: 🎤 voice memo (15 seconds)
         │
         ├──→ [Buffer] Add to wa:buffer:{conversationId}
         │             (body: "<audio_url>", type: "voice")
         │
         └──→ [Async] Kick off Whisper transcription
                       Key: wa:transcription:{messageId} = "PENDING"
                       Whisper processes audio → ~3-5 seconds
                       Key: wa:transcription:{messageId} = "DONE:Mirá, el problema es..."
                       
When debounce timer fires:
  → Batch processor reads buffer
  → Finds voice message → checks wa:transcription:{messageId}
  → If "DONE:{text}" → uses transcription
  → If "PENDING" → polls for up to 15s
  → If timeout → "[Audio no pudo ser transcripto — se requiere atención humana]"
```

This means transcription runs **in parallel** with the debounce timer. By the time the timer fires (8 seconds), a 15-second voice memo's transcription is usually already complete or nearly done.

**Edge Case: Customer Sends Messages 3+ Minutes Apart**

```
14:05:00 → "Hola"           → Buffer + debounce (8s)
14:05:08 → Timer fires      → AI processes "Hola" → responds
14:05:30 → Customer reads response
14:08:45 → "¿Cuánto sale?"  → Buffer + debounce (5s — mid-conversation)
14:08:50 → Timer fires      → AI processes "¿Cuánto sale?" → responds
```

This is NOT a burst — it's a normal conversation. The debounce timer fires after 8 seconds with a single message, the AI processes it, and the session continues. The 3-minute gap is just idle time where **nothing is running** — no timers, no AI, no tokens. The session remains ACTIVE (inactivity timeout is 30 minutes, not 3 minutes), so the next message is processed within the existing session context.

**Relationship to Redis Concurrency Lock:**

| Mechanism | Purpose | When |
|-----------|---------|------|
| **Debounce timer** (NEW) | Wait for message burst to complete before processing | Before any AI processing — prevents premature responses |
| **Concurrency lock** (EXISTING) | Prevent two batch processors from running simultaneously for the same conversation | After debounce — prevents race conditions if two timers fire close together |

These work in sequence:
```
Webhook → Buffer + Debounce → [timer fires] → Acquire Lock → Process Batch → Release Lock
```


**The WhatsApp Race Condition Problem:**
```
Customer sends: "Hola" → API call 1
Customer sends: "Tengo una fuga" → API call 2 (100ms later)

Without locking:
- Both requests hit Python simultaneously
- Both load same conversation state
- Both respond → Customer gets 2 messages (bad UX)
```

**WhatsApp Message Lock Pattern (Required):**
```python
# services/ai/app/api/whatsapp.py

async def process_whatsapp_message(message: WhatsAppMessage):
    lock_key = f"org:{message.organization_id}:whatsapp:lock:{message.conversation_id}"
    
    # Try to acquire lock (TTL: 30 seconds)
    acquired = await redis.set(lock_key, "1", nx=True, ex=30)
    
    # NOTE: For multi-intent chains that may exceed 30s, use heartbeat extension:
    #   async for step in task:
    #       await redis.expire(lock_key, 30)  # Extend lock every step
    #       yield step
    
    if not acquired:
        # Another message is being processed - queue this one
        await redis.rpush(
            f"whatsapp:queue:{message.conversation_id}", 
            message.json()
        )
        return {"status": "queued"}
    
    try:
        result = await process_message(message)
        
        # Process any queued messages (FIFO)
        while queued := await redis.lpop(f"whatsapp:queue:{message.conversation_id}"):
            queued_msg = Message.parse_raw(queued)
            await process_message(queued_msg)
        
        return result
    finally:
        await redis.delete(lock_key)
```

**Infrastructure:**
```env
# Recommended: Upstash (serverless, free tier)
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379
```

#### Session Storage Schema

```prisma
model AISession {
  id               String    @id @default(cuid())
  conversationId   String    // FK to WaConversation
  organizationId   String
  customerId       String?   // FK to Customer (if identified)
  profileId        String?   // v5.0: FK to CustomerAIProfile (always exists after first message)

  status           String    @default("ACTIVE")  // ACTIVE, CLOSED, PAUSED (human handoff)
  closeReason      String?   // INACTIVITY, JOB_COMPLETED, FAREWELL, HUMAN_HANDOFF, MAX_DURATION, JOB_CANCELLED

  // Working memory
  workingMemory    String?   // Compact summary, refreshed periodically
  messageCount     Int       @default(0)

  // Timestamps
  startedAt        DateTime  @default(now())
  lastActivityAt   DateTime  @default(now())
  closedAt         DateTime?

  // Profile snapshot at close (for audit)
  profileDeltaJson Json?     // What changed in CustomerAIProfile at session close

  @@index([conversationId, status])
  @@index([organizationId, lastActivityAt])
  @@index([profileId])  // v5.0: lookup sessions by profile
  @@map("ai_sessions")
}
```



**Phase B3b: Redis Enhancement (When Needed)**
```python
REDIS_KEYS = {
    "session": "org:{org_id}:session:{conversation_id}",  # TTL: 1 hour
    "lock": "org:{org_id}:whatsapp:lock:{conversation_id}",   # TTL: 30s + heartbeat
    "queue": "org:{org_id}:whatsapp:queue:{conversation_id}",  # No TTL
    "rate": "org:{org_id}:rate:{user_id}",                 # TTL: 60 seconds
}
```

#### Relationship to Existing Infrastructure

| Existing Component | How It Interacts with Sessions |
|-------------------|-------------------------------|
| `WaConversation` | 1 conversation → many sessions. The conversation is the permanent thread; sessions are bounded windows within it. |
| `WaMessage` | Messages belong to conversations (existing). Sessions are identified by timestamp range, not by a FK on each message (avoids migration on millions of rows). |
| `CustomerAIProfile` | **Auto-created on first-ever message** from this phone number for this org. Read at session start (by System Layer). Updated at session close. This is the bridge between sessions — the AI's "long-term memory." |
| `AIConversationLog` | Existing logging continues as-is. Session ID can be added as optional field for traceability. |
| Redis concurrency lock | Lock key remains `whatsapp:lock:{conversationId}` — unchanged. Session lookup happens after lock acquisition. |
| `prompt-sanitizer.ts` | Hard limits still apply as a safety net. Session-based context loading operates within these limits. |


```

#### Adaptive Debounce Learning (Per-Customer)

> 📌 **DESIGN DECISION (2026-02-21):** The static debounce timers (8s, 5s, etc.) are good defaults for unknown customers. But they'll be wrong for a customer who always sends 3 voice memos with 20-second gaps, or a grandmother who types one word per minute across 6 messages. The system must **learn each customer's messaging rhythm** and adjust automatically — reducing interruptions over time to near zero.

**The Problem with Static Timers:**
```
Customer "Doña Rosa" (types slowly, always sends 4-6 short messages):

14:05:00 → "Hola"
14:05:09 → "Tengo"                ← 9 seconds gap (static 8s timer would fire HERE)
14:05:17 → "un problema"          ← AI already responded to "Hola" — INTERRUPTION
14:05:25 → "con la canilla"
14:05:33 → "de la cocina"

Static 8s debounce: 60% interruption rate for this customer
After learning (debounce = 12s): 5% interruption rate
```

**Architecture Split:**

| System | Role | Data Lifespan |
|--------|------|---------------|
| **Redis** | Track real-time timestamps during current session. Calculate gaps on-the-fly. | Ephemeral — cleared after batch processing |
| **PostgreSQL (`CustomerAIProfile`)** | Store learned burst patterns, calibrated debounce value, interruption history | Permanent — improves over time |
| **Admin Dashboard** | View interruption rates per org/customer. Manual flag interruptions. Verify system is working. | Read-only analytics surface |

**How It Works — The Learning Loop:**

```
┌─ STEP 1: Record (every message) ─────────────────────────────────┐
│                                                                    │
│  On each incoming message:                                         │
│    → RPUSH wa:timestamps:{conversationId} {timestamp_ms}           │
│    → RPUSH wa:msg_types:{conversationId} {type: text|voice|image}  │
│                                                                    │
│  Redis now holds the exact timing of every message in this burst.  │
│  Cost: 2 Redis commands, ~0.01ms.                                  │
└────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ STEP 2: Calculate (when batch processor runs) ──────────────────┐
│                                                                    │
│  When debounce fires and batch processor starts:                   │
│    → Read wa:timestamps:{conversationId}                           │
│    → Calculate inter-message gaps:                                 │
│      [14:05:00, 14:05:09, 14:05:17, 14:05:25, 14:05:33]           │
│                            ↓                                       │
│      gaps = [9000ms, 8000ms, 8000ms, 8000ms]                       │
│      maxGap = 9000ms                                               │
│      avgGap = 8250ms                                               │
│      burstSize = 5 messages                                        │
│      burstDuration = 33000ms                                       │
│      hasVoice = false                                              │
│                                                                    │
│  Store in session-scoped variable (not DB yet — wait for close).   │
└────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ STEP 3: Aggregate (on session close) ──────────────────────────┐
│                                                                    │
│  When session closes → update CustomerAIProfile:                   │
│                                                                    │
│  Exponential Moving Average (EMA) with α = 0.3:                    │
│    (gives 70% weight to history, 30% to this session)              │
│                                                                    │
│  profile.avgBurstGapMs =                                           │
│    (0.7 × profile.avgBurstGapMs) + (0.3 × session.avgGapMs)       │
│                                                                    │
│  profile.maxBurstGapMs =                                           │
│    max(profile.maxBurstGapMs × 0.9, session.maxGapMs)              │
│    (slight decay so outliers don't anchor forever)                  │
│                                                                    │
│  profile.avgBurstSize =                                            │
│    (0.7 × profile.avgBurstSize) + (0.3 × session.burstSize)       │
│                                                                    │
│  profile.totalBursts += 1                                          │
│                                                                    │
│  After 3+ sessions → profile.learnedDebounceMs is calculated:     │
│    (before 3 sessions, use static defaults — not enough data)      │
└────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ STEP 4: Apply (next session) ──────────────────────────────────┐
│                                                                    │
│  When customer sends first message of new session:                 │
│    → Load CustomerAIProfile (always exists — auto-created on       │
│      first contact by System Layer)                               │
│    → If profile.learnedDebounceMs exists (≥3 past sessions):       │
│        debounceTimer = profile.learnedDebounceMs                   │
│    → Else:                                                         │
│        debounceTimer = STATIC_DEFAULT (8 seconds)                  │
│                                                                    │
│  The learned value overrides the static default.                   │
│  Static defaults are ONLY for brand-new contacts (≤3 sessions).   │
└────────────────────────────────────────────────────────────────────┘
```

**The Debounce Calibration Formula:**

```
learnedDebounceMs = clamp(
    floor  = MIN_DEBOUNCE_MS,          // 3000 (never less than 3 seconds)
    ceiling = MAX_DEBOUNCE_MS,         // 20000 (never more than 20 seconds)
    value  = maxBurstGapMs × 1.5       // 150% of their longest within-burst gap
)

// Why 1.5×?
// If Doña Rosa's longest gap between messages is 9 seconds,
// setting debounce to 9s would catch exactly 50% of bursts.
// 1.5× (13.5s) gives comfortable margin → catches ~95% of bursts.
```

**Debounce Floor/Ceiling Rationale:**

| Limit | Value | Why |
|-------|-------|-----|
| **Floor** | 3 seconds | Even the fastest typer benefits from a brief buffer to catch "Hola" + "necesito plomero" combos |
| **Ceiling** | 20 seconds | Beyond 20s, the customer is probably done and would feel ignored. If they aren't done, they can still continue after the AI responds — it's a conversation, not a one-shot. |
| **Mid-conversation override** | `max(3s, learnedDebounceMs × 0.6)` | Once the conversation is flowing, the customer is in "response mode" — shorter gaps expected, so use 60% of their learned value |

**Interruption Detection (Automatic):**

An "interruption" is when the AI responded too early — the customer wasn't done with their burst:

```
┌─ Interruption Detection Logic ──────────────────────────────────┐
│                                                                    │
│  TRIGGER: Customer sends a message within 10 seconds of            │
│           receiving an AI response                                 │
│                                                                    │
│  CLASSIFICATION:                                                   │
│                                                                    │
│  IS an interruption if:                                            │
│    • Message starts with continuation markers:                     │
│      "y también", "ah y", "otra cosa", "además", "aparte",        │
│      "me olvidé", "y otra cosa", "también"                         │
│    • OR message is clearly a continuation (same topic/entity)      │
│    • OR message is a voice memo (customer was recording,           │
│      AI jumped in before they could send it)                       │
│                                                                    │
│  NOT an interruption if:                                           │
│    • Message is a direct response to the AI's question             │
│      ("sí", "no", "dale", "perfecto", a date, an address)         │
│    • Message starts a new topic                                    │
│    • Time gap > 10 seconds (they read the AI response first)       │
│                                                                    │
│  WHEN DETECTED:                                                    │
│    1. Log: AIInterruptionEvent in PostgreSQL                       │
│    2. Increment: profile.interruptionCount += 1                    │
│    3. Adjust: increase learnedDebounceMs by 15%                    │
│       (immediate correction — don't wait for session close)        │
│    4. Flag: conversation gets "⚡ Interrupted" badge in dashboard  │
│                                                                    │
│  SELF-HEALING:                                                     │
│    If interruptionRate drops below 5% over 10+ bursts → stable.    │
│    No further upward adjustments until a new interruption.         │
│    Debounce slowly decays (−2% per session close) toward the       │
│    calculated optimal, preventing permanent over-correction.       │
└────────────────────────────────────────────────────────────────────┘
```

**Org Manual Feedback (from Dashboard):**

In addition to automatic detection, the org's dispatchers/owners can manually flag interruptions from the WhatsApp conversation view in the dashboard:

```
┌──────────────────────────────────────────────────────────┐
│  WhatsApp Chat View (Dashboard)                          │
│                                                          │
│  Cliente: "Hola, necesito"                    14:05:01   │
│  AI: "¡Hola! ¿En qué te puedo ayudar?"       14:05:09   │
│  Cliente: "un plomero para mañana"            14:05:11   │
│                                                          │
│  [⚡ Auto-detected: Possible interruption]               │
│                                                          │
│  Dispatcher sees this and can:                           │
│    [✅ Confirm Interruption]  [❌ Not an interruption]    │
│                                                          │
│  If confirmed → same correction logic as auto-detection  │
│  If dismissed → auto-detection fine-tuned (false positive │
│                 logged for system improvement)            │
└──────────────────────────────────────────────────────────┘
```

**Schema Additions for Learning:**

```prisma
// Add to existing CustomerAIProfile (phone+orgId keyed, v5.0):
// NOTE: These fields extend the phone-keyed profile, NOT the Customer entity.
model CustomerAIProfile {
  // ... existing fields ...

  // Messaging Behavior (learned from burst patterns)
  avgBurstGapMs      Int?      // EMA of average gap between messages in a burst
  maxBurstGapMs      Int?      // Longest observed gap within a burst (with decay)
  avgBurstSize       Float?    // EMA of messages per burst
  learnedDebounceMs  Int?      // Calibrated debounce timer (null = use static default)
  totalBursts        Int       @default(0)  // Total bursts processed (need 3+ to learn)

  // Interruption tracking
  interruptionCount  Int       @default(0)  // Total AI interruptions
  recentInterruptions Int      @default(0)  // Interruptions in last 10 bursts (rolling)
}

// New model: per-event interruption log
model AIInterruptionEvent {
  id               String   @id @default(cuid())
  organizationId   String
  conversationId   String
  sessionId        String?  // FK to AISession
  customerId       String?

  // What happened
  aiResponseAt     DateTime          // When AI responded
  customerMessageAt DateTime         // When customer sent follow-up
  gapMs            Int               // Time between AI response and customer message
  customerMessage  String            // The message that was classified as interrupted

  // Classification
  detectedBy       String            // "AUTO" or "MANUAL"
  isConfirmed      Boolean?          // null = pending, true = confirmed, false = dismissed
  confirmedBy      String?           // userId who confirmed/dismissed (for manual)

  // Correction applied
  previousDebounceMs Int?            // What debounce was before correction
  newDebounceMs      Int?            // What debounce was adjusted to

  createdAt        DateTime @default(now())

  @@index([organizationId, createdAt])
  @@index([customerId])
  @@map("ai_interruption_events")
}
```

**Admin Analytics Surface (apps/admin + per-org dashboard):**

> 📌 **DESIGN DECISION (2026-02-21):** The analytics surface has THREE distinct access tiers with different privacy requirements:
> - **Tier A** — Per-Org Dashboard (org sees their OWN data) → No extra consent needed — they own it
> - **Tier B** — CampoTech Platform Analytics (you as platform owner) → Aggregated/anonymized only by default
> - **Tier C** — Full Message Access for AI Improvement (you as platform owner) → Requires explicit opt-in consent

---

### B5: Communication Style Adaptation

**Pattern:**
```python
async def adapt_response_style(response: str, profile: CustomerAIProfile) -> str:
    """Adapt AI response to match customer's communication style."""
    
    if profile.preferredFormality == "formal":
        response = response.replace(" vos ", " usted ")
    
    if profile.typicalMessageLength == "brief":
        response = await llm.invoke(f"Shorten to 2 sentences: {response}")
    
    return response
```

---

#### Privacy & Data Access Legal Framework (Ley 25.326 + AAIP)

> ⚖️ **CRITICAL LEGAL CONTEXT:** Under Argentine law, CampoTech is a **Data Processor** — the organizations (tenants) are the **Data Controllers**. The end customers are the **Data Subjects**. This tri-party relationship creates specific rules about who can see what.

**The CampoTech Data Access Hierarchy:**

```
┌────────────────────────────────────────────────────────────────────┐
│                   WHO CAN ACCESS WHAT?                              │
│                                                                    │
│  DATA SUBJECT (end customer)                                       │
│    → Can see/delete their own data (ARCO rights — already built)   │
│    → Can withdraw consent at any time                              │
│                                                                    │
│  DATA CONTROLLER (organization / tenant)                           │
│    → Full access to their own customers' conversation data         │
│    → Can assign dispatchers to read/respond to conversations       │
│    → Already covered by the org's own privacy policy               │
│    → They ARE the business — these are their business messages     │
│                                                                    │
│  DATA PROCESSOR (CampoTech — you)                                  │
│    → Can process data ONLY as instructed by the Data Controller    │
│    → Default: aggregated metrics only (no message content)         │
│    → With org opt-in: anonymized samples for AI improvement        │
│    → With org + customer opt-in: full message access               │
│    → Must have a Data Processing Agreement (DPA) with each org    │
│    → Must register the database with AAIP (DNPDP)                 │
└────────────────────────────────────────────────────────────────────┘
```

**Can you (CampoTech owner) read customer messages?**

| Scenario | Legal? | Requirement |
|----------|--------|-------------|
| **Aggregated metrics** (interruption rate, avg response time, debounce values — no message content) | ✅ YES — always | Standard DPA with org. No PII exposed. |
| **Anonymized conversation samples** (messages with names/phones/addresses stripped) | ✅ YES — with org consent | Org opts in to "AI Improvement Program." Anonymization must be irreversible. |
| **Full message content** (raw conversations with PII) | ⚠️ CONDITIONAL | Requires: (1) Org opts in, (2) End customer is informed via org's privacy policy, (3) Specific purpose stated, (4) DPA covers this use case. |
| **Using messages to train AI models** | ⚠️ CONDITIONAL — ChatGPT model | Same as above PLUS separate explicit consent for AI training use. Customer must be able to opt out at any time. |
| **Sharing data with third parties** | ❌ NO | Not without explicit consent from both org and customer. |

**The ChatGPT-Style Opt-In Model for CampoTech:**

This is the industry standard approach (used by ChatGPT, Zendesk, Intercom, HubSpot):

```
┌─────────────────────────────────────────────────────────────────┐
│           AI IMPROVEMENT OPT-IN (3 LAYERS)                       │
│                                                                   │
│  LAYER 1: Organization Opt-In (during onboarding or in Settings) │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  ⚙️ Configuración de IA                                  │    │
│  │                                                           │    │
│  │  ☐ Programa de Mejora de IA                               │    │
│  │    "Permitir que CampoTech utilice datos anónimos de      │    │
│  │     conversaciones para mejorar la calidad del asistente  │    │
│  │     de IA. Los datos son anonimizados (sin nombres,       │    │
│  │     teléfonos ni direcciones) antes de ser procesados.    │    │
│  │     Podés desactivar esta opción en cualquier momento."   │    │
│  │                                                           │    │
│  │  ☐ Acceso a conversaciones para soporte técnico           │    │
│  │    "Permitir que el equipo de CampoTech acceda a          │    │
│  │     conversaciones específicas cuando sea necesario       │    │
│  │     para resolver problemas técnicos o verificar el       │    │
│  │     correcto funcionamiento del asistente de IA.          │    │
│  │     Nombre de la organización y datos de clientes         │    │
│  │     pueden ser visibles. Solo accesible por personal      │    │
│  │     autorizado bajo acuerdo de confidencialidad."         │    │
│  │                                                           │    │
│  │  [Guardar Cambios]                                        │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  LAYER 2: End Customer Consent (HOW it actually works)           │
│                                                                   │
│  The org (Data Controller) is legally responsible for informing   │
│  their customers. CampoTech makes this effortless with 4         │
│  automatic mechanisms:                                            │
│                                                                   │
│  MECHANISM A — WhatsApp Business Profile (passive, always-on)    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  When the org connects their WhatsApp number, CampoTech  │    │
│  │  auto-populates the WhatsApp Business profile with:       │    │
│  │                                                           │    │
│  │  📋 Descripción del negocio:                              │    │
│  │  "[Nombre Empresa] utiliza inteligencia artificial para    │    │
│  │   agilizar la atención al cliente. Política de privacidad:│    │
│  │   [link autogenerado]"                                    │    │
│  │                                                           │    │
│  │  This is visible BEFORE the customer sends their first    │    │
│  │  message — they see it when they open the chat profile.   │    │
│  │  WhatsApp Business API allows setting this programmatically│   │
│  │  via the Business Profile API endpoint.                   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  MECHANISM B — AI First-Contact Disclosure (one-time, automatic) │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  The FIRST TIME the AI responds to a new customer (not    │    │
│  │  the org's human staff), the response includes a brief    │    │
│  │  footer disclosure. This is appended ONCE — never again.  │    │
│  │                                                           │    │
│  │  Example AI response:                                     │    │
│  │  "¡Hola! 👋 Soy el asistente virtual de [Empresa].       │    │
│  │   ¿En qué te puedo ayudar?                               │    │
│  │                                                           │    │
│  │   ℹ️ Este chat utiliza inteligencia artificial.            │    │
│  │   Tus derechos:                                           │    │
│  │   • Escribí 'hablar con alguien' para hablar con una      │    │
│  │     persona en cualquier momento                          │    │
│  │   • Más info sobre privacidad y tus datos: [link]"        │    │
│  │                                                           │    │
│  │  WHY THIS WORDING:                                        │    │
│  │  • Tells them AI is being used (mandatory disclosure)     │    │
│  │  • Gives ONE clear action ("hablar con alguien")          │    │
│  │  • Links to privacy page for full details                 │    │
│  │  • Does NOT overwhelm with legal jargon — keep it short   │    │
│  │  • In Argentine voseo ("Escribí" not "Escriba")           │    │
│  │                                                           │    │
│  │  Tracked via: CustomerAIProfile.aiDisclosureSentAt (v5.0)  │    │
│  │  If null → include disclosure. If set → never again.      │    │
│  │  Uses phone+orgId profile (exists for ALL contacts).       │    │
│  │  The customer continuing the conversation = implicit       │    │
│  │  consent for AI-assisted communication (Ley 25.326 Art.5) │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  MECHANISM C — Privacy Policy Page (auto-generated, org-edited)  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  CampoTech auto-generates a privacy policy page for each │    │
│  │  org at: campotech.com.ar/privacidad/[org-slug]           │    │
│  │                                                           │    │
│  │  The page includes (all in Spanish):                      │    │
│  │  ┌─────────────────────────────────────────────────┐      │    │
│  │  │ 🔒 Política de Privacidad — [Nombre Empresa]   │      │    │
│  │  │                                                 │      │    │
│  │  │ § Qué datos recopilamos                         │      │    │
│  │  │   Nombre, teléfono, y mensajes de WhatsApp     │      │    │
│  │  │                                                 │      │    │
│  │  │ § Cómo los usamos                               │      │    │
│  │  │   Para gestionar tu solicitud de servicio.      │      │    │
│  │  │   Este chat es asistido por inteligencia        │      │    │
│  │  │   artificial para agilizar la atención.         │      │    │
│  │  │                                                 │      │    │
│  │  │ § Mejora de IA (solo si la empresa participó)   │      │    │
│  │  │   Tus conversaciones pueden ser utilizadas de   │      │    │
│  │  │   forma anónima para mejorar la calidad del     │      │    │
│  │  │   asistente. Podés excluirte escribiendo "no    │      │    │
│  │  │   usen mis datos" en el chat o contactándonos.  │      │    │
│  │  │                                                 │      │    │
│  │  │ § Tus derechos                                  │      │    │
│  │  │   • Pedir hablar con una persona real            │      │    │
│  │  │   • Desactivar el asistente virtual              │      │    │
│  │  │   • Excluir tus datos del programa de mejora IA │      │    │
│  │  │   • Pedir la eliminación de todos tus datos     │      │    │
│  │  │   Podés ejercer estos derechos escribiendo en   │      │    │
│  │  │   el chat o contactando a [org email/phone].    │      │    │
│  │  │                                                 │      │    │
│  │  │ § Contacto: [org email] | [org phone]           │      │    │
│  │  └─────────────────────────────────────────────────┘      │    │
│  │                                                           │    │
│  │  WHERE THE ORG EDITS THIS:                                │    │
│  │  Dashboard → Settings → Legal y Privacidad                │    │
│  │  (NOT under AI settings — privacy is a broader concern)   │    │
│  │                                                           │    │
│  │  What they CAN customize:                                 │    │
│  │    ✅ Business contact info (email, phone)                │    │
│  │    ✅ Additional clauses (e.g., industry-specific)        │    │
│  │    ✅ Business description                                │    │
│  │    ✅ Logo and branding                                   │    │
│  │                                                           │    │
│  │  What they CANNOT remove (locked sections):               │    │
│  │    🔒 Data collection disclosure                          │    │
│  │    🔒 AI usage disclosure                                 │    │
│  │    🔒 Customer rights (ARCO)                              │    │
│  │    🔒 AI training opt-out instructions                    │    │
│  │    🔒 Data deletion process                               │    │
│  │                                                           │    │
│  │  These locked sections update automatically when:         │    │
│  │    • Org toggles AI Improvement Program on/off            │    │
│  │    • Org enables/disables AI auto-responder               │    │
│  │    • CampoTech updates platform-wide privacy terms        │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  MECHANISM D — Natural Language Opt-Out (via WhatsApp itself)    │
│                                                                   │
│  The customer doesn't need to know exact phrases. The AI uses    │
│  INTENT DETECTION (not just regex matching) to understand what   │
│  they want. There are 4 distinct levels of opt-out:              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  LEVEL 1: "HABLAR CON ALGUIEN" (Human Escalation)        │    │
│  │  ───────────────────────────────────────────────────────  │    │
│  │  Intent: Customer wants a human for THIS conversation     │    │
│  │                                                           │    │
│  │  Triggers (intent detection, not exact match):            │    │
│  │    "hablar con alguien", "quiero una persona",            │    │
│  │    "dejá de hablar", "sos un robot?", "necesito un        │    │
│  │    humano", "pasame con alguien de verdad",               │    │
│  │    "esto no me sirve, pasame con otro"                    │    │
│  │                                                           │    │
│  │  What happens:                                            │    │
│  │    → AI: "Perfecto, te comunico con [Nombre/equipo].      │    │
│  │      Puede tardar unos minutos."                          │    │
│  │    → Session flagged as HUMAN_HANDOFF                     │    │
│  │    → Dispatcher notified in dashboard                     │    │
│  │    → AI STOPS responding in this conversation             │    │
│  │                                                           │    │
│  │  Scope: THIS CONVERSATION ONLY                           │    │
│  │  AI can respond again in future conversations unless      │    │
│  │  Level 2 is triggered.                                    │    │
│  │  Duration: Until dispatcher clicks "Return to AI" or      │    │
│  │  next session starts.                                     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  LEVEL 2: "NO QUIERO IA" (Permanent AI Communication Off) │    │
│  │  ───────────────────────────────────────────────────────  │    │
│  │  Intent: Customer NEVER wants AI to respond to them       │    │
│  │                                                           │    │
│  │  Triggers:                                                │    │
│  │    "no quiero IA", "no quiero robot", "no quiero que me   │    │
│  │    atienda una máquina", "desactivar asistente virtual",  │    │
│  │    "siempre quiero hablar con personas"                   │    │
│  │                                                           │    │
│  │  What happens:                                            │    │
│  │    → AI: "Entendido. A partir de ahora siempre vas a      │    │
│  │      ser atendido/a por una persona. Si en algún          │    │
│  │      momento querés reactivar el asistente, escribí       │    │
│  │      'activar asistente'."                                │    │
│  │    → Sets CustomerAIProfile.aiCommunicationOptOut = true    │    │
│  │      (v5.0: on profile, not Customer — profile always      │    │
│  │       exists; Customer entity may not exist yet)           │    │
│  │    → ALL future messages go directly to dispatcher queue  │    │
│  │    → AI NEVER auto-responds to this customer again        │    │
│  │                                                           │    │
│  │  Scope: PERMANENT (until customer re-opts in)             │    │
│  │  AI training can still use their past data (if org opted  │    │
│  │  in and customer didn't trigger Level 3)                  │    │
│  │  Reversible: Customer says "activar asistente" or         │    │
│  │  "quiero que me atienda el asistente"                     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  LEVEL 3: "NO USEN MIS DATOS" (AI Training Opt-Out)       │    │
│  │  ───────────────────────────────────────────────────────  │    │
│  │  Intent: Customer doesn't want data used for AI training  │    │
│  │                                                           │    │
│  │  Triggers:                                                │    │
│  │    "no usen mis datos", "no quiero que entrenen con mis   │    │
│  │    mensajes", "excluirme", "mis datos son privados",      │    │
│  │    "no compartan mi información"                          │    │
│  │                                                           │    │
│  │  What happens:                                            │    │
│  │    → AI: "Listo. Tus conversaciones no serán utilizadas   │    │
│  │      para mejorar el asistente de IA. El servicio sigue   │    │
│  │      funcionando igual para vos — solo cambia que tus     │    │
│  │      datos no se usan para entrenamiento."                │    │
│  │    → Sets CustomerAIProfile.aiTrainingOptOut = true         │    │
│  │      (v5.0: on profile; also set on Customer entity if     │    │
│  │       one exists for this contact)                         │    │
│  │    → Logged in UserConsentLog                             │    │
│  │                                                           │    │
│  │  Scope: AI TRAINING ONLY                                  │    │
│  │  AI STILL works for them normally (responds, schedules,   │    │
│  │  etc.) — their messages are just excluded from Tier C      │    │
│  │  platform-level analytics and training datasets.          │    │
│  │  Reversible: "Podés usar mis datos" or org toggles back   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  LEVEL 4: "BORRAR MIS DATOS" (Full Data Deletion — ARCO)  │    │
│  │  ───────────────────────────────────────────────────────  │    │
│  │  Intent: Customer wants all their data erased              │    │
│  │                                                           │    │
│  │  Triggers:                                                │    │
│  │    "borrar mis datos", "eliminar mi cuenta",              │    │
│  │    "quiero que borren todo", "derecho al olvido"          │    │
│  │                                                           │    │
│  │  What happens:                                            │    │
│  │    → AI: "Entendido. Para eliminar tus datos, necesitamos │    │
│  │      verificar tu identidad. Podés iniciar el proceso     │    │
│  │      en [link a /data-request?org=XXX] o te podemos       │    │
│  │      enviar un enlace por este mismo chat."               │    │
│  │    → Triggers existing ARCO data request flow             │    │
│  │    → 30-day waiting period (already implemented)          │    │
│  │    → Full anonymization per existing AccountDeletionService│   │
│  │                                                           │    │
│  │  Scope: EVERYTHING — irreversible after 30 days           │    │
│  │  This is NOT handled by the AI alone — requires identity  │    │
│  │  verification (DNI) through the existing ARCO portal.     │    │
│  │  AI just initiates the process and provides the link.     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  SUMMARY TABLE — What Each Level Affects:                        │
│                                                                   │
│  Level │ AI Responds? │ AI Trains? │ Data Stored? │ Reversible?  │
│  ──────┼──────────────┼────────────┼──────────────┼──────────────│
│  1     │ No (this     │ Yes        │ Yes          │ Auto (next   │
│        │ convo only)  │            │              │ session)     │
│  2     │ NEVER        │ Yes        │ Yes          │ Yes (say     │
│        │              │            │              │ "activar")   │
│  3     │ Yes (normal) │ NEVER      │ Yes          │ Yes (say     │
│        │              │            │              │ "usar datos")│
│  4     │ N/A          │ N/A        │ DELETED      │ No (after    │
│        │              │            │              │ 30 days)     │
│                                                                   │
│  HOW DOES THE CUSTOMER DISCOVER THEIR RIGHTS?                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  4 touchpoints where rights are communicated:             │    │
│  │                                                           │    │
│  │  1. WhatsApp Business Profile (Mechanism A)               │    │
│  │     → Customer sees AI disclosure + privacy link BEFORE   │    │
│  │       their first message (in the chat profile header)    │    │
│  │                                                           │    │
│  │  2. First-Contact Disclosure (Mechanism B)                │    │
│  │     → First AI reply says: "Escribí 'hablar con alguien'  │    │
│  │       para hablar con una persona" + links to privacy     │    │
│  │                                                           │    │
│  │  3. Privacy Policy Page (Mechanism C)                     │    │
│  │     → Lists ALL 4 levels in plain Spanish with examples   │    │
│  │       of what to say in the chat                          │    │
│  │                                                           │    │
│  │  4. The AI itself (Mechanism D)                           │    │
│  │     → If a customer seems frustrated or asks about        │    │
│  │       privacy, the AI proactively explains their options  │    │
│  │     → Example: customer says "quién lee esto?"            │    │
│  │       AI: "Soy un asistente virtual. Tus mensajes son     │    │
│  │       procesados por IA para darte mejor atención. Podés  │    │
│  │       pedir hablar con una persona, desactivar el         │    │
│  │       asistente, o excluir tus datos del entrenamiento    │    │
│  │       de IA. ¿Querés saber más? [link]"                   │    │
│  │                                                           │    │
│  │  KEY PRINCIPLE: The customer should NEVER need to know    │    │
│  │  exact phrases. They express themselves naturally, and     │    │
│  │  the AI detects their intent. The privacy page has        │    │
│  │  example phrases for reference, but the AI understands    │    │
│  │  "dejá de hablar robot" just as well as "no quiero IA".   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  LAYER 3: Consent Storage & Enforcement                          │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  How consent state is tracked per contact:                 │    │
│  │                                                           │    │
│  │  CustomerAIProfile record (v5.0 — always exists):         │    │
│  │    aiDisclosureSentAt:      DateTime? // Mechanism B sent  │    │
│  │    aiCommunicationOptOut:   Boolean   // Level 2 — no AI  │    │
│  │    aiTrainingOptOut:        Boolean   // Level 3 — no train│   │
│  │    aiOptOutTimestamp:       DateTime? // When opted out    │    │
│  │    aiOptOutMethod:          String?   // "WHATSAPP_CHAT" | │    │
│  │                                       // "ARCO_REQUEST" |  │    │
│  │                                       // "ORG_MANUAL"      │    │
│  │                                                           │    │
│  │  Enforcement:                                             │    │
│  │    → aiCommunicationOptOut = true:                        │    │
│  │      All messages go to dispatcher queue, AI never fires  │    │
│  │    → aiTrainingOptOut = true:                             │    │
│  │      Tier C queries auto-filter: WHERE NOT aiTrainingOptOut│   │
│  │      Anonymization pipeline skips this customer           │    │
│  │    → Audit log records EVERY consent change               │    │
│  │    → Opt-out is INSTANT — no waiting period               │    │
│  │    → Opt-in again is possible via chat or org toggle      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Schema Additions for Consent:**

```prisma
// Add to Organization model (settings JSON or dedicated fields):
model Organization {
  // ... existing fields ...

  // AI Improvement Program consent
  aiImprovementOptIn       Boolean   @default(false)  // Org consents to anonymized data use
  aiSupportAccessOptIn     Boolean   @default(false)  // Org consents to CampoTech support access
  aiConsentTimestamp        DateTime?                  // When consent was granted
  aiConsentGrantedBy        String?                    // userId who toggled it
}

// Add to Customer model (for contacts that have been promoted):
model Customer {
  // ... existing fields ...

  // AI training exclusion (customer opt-out via ARCO "O" right)
  // NOTE (v5.0): These fields are ALSO on CustomerAIProfile for contacts
  // that haven't been promoted to Customer yet. When a contact is promoted,
  // the profile flags are copied to the Customer entity for consistency.
  aiTrainingOptOut         Boolean   @default(false)
  aiOptOutTimestamp         DateTime?
}
```

**What Each Tier Can See:**

---

**Tier A — Per-Org Dashboard (the organization sees their OWN metrics):**

No extra consent needed — this is their data, their customers, their business.

| Metric | What It Shows | Location |
|--------|--------------|----------|
| **Interruption Rate** | % of AI responses that were interruptions (last 30 days) | Dashboard → AI Settings → Analytics tab |
| **Trend Line** | Interruption rate over time — should decrease as system learns | Same tab, line chart |
| **Top Interrupted Customers** | Which customers get interrupted most (might need manual debounce override) | Same tab, table |
| **Avg Response Time** | Average time from first message to AI response (debounce + processing) | Same tab, KPI card |
| **Manual Flags Pending** | Conversations with auto-detected interruptions awaiting confirmation | Dashboard notification badge |
| **Full Conversations** | Complete message history with customer names, phones, content | WhatsApp hub (existing feature) |

---

**Tier B — CampoTech Platform Analytics (you — always available, no PII):**

This is what you see by default in `apps/admin`. NO message content. NO customer names. NO phone numbers. Pure aggregate metrics.

| Metric | What It Shows | Purpose | Contains PII? |
|--------|--------------|---------|---------------|
| **Global Interruption Rate** | Platform-wide % across all orgs | Verify the adaptive system is working | ❌ No |
| **Learning Curve** | Avg sessions until interruptions < 5% | Tune the EMA α coefficient | ❌ No |
| **False Positive Rate** | % of auto-detected interruptions dismissed by orgs | Tune continuation markers | ❌ No |
| **Debounce Distribution** | Histogram of learnedDebounceMs across all customers | Detect if defaults are too aggressive | ❌ No |
| **AI Response Quality Score** | Aggregated satisfaction per org (from org feedback) | Identify orgs that need attention | ❌ No |
| **Token Usage & Cost** | LLM tokens consumed per org/day/month | Pricing and capacity planning | ❌ No |
| **Session Metrics** | Avg session duration, messages per session, close reasons | UX optimization | ❌ No |

---

**Tier C — CampoTech AI Improvement Access (you — opt-in orgs only):**

Only available for organizations that toggled `aiImprovementOptIn = true`.

| Access Level | What You See | When | Requirement |
|-------------|-------------|------|-------------|
| **Anonymized Conversations** | Messages with PII stripped: names → "[CLIENTE]", phones → "[TELÉFONO]", addresses → "[DIRECCIÓN]", CUIT → "[CUIT]" | AI improvement research, prompt tuning, evaluation datasets | Org opted in. Customer NOT opted out. |
| **Anonymized Interruption Samples** | The exact message sequence that caused an interruption (anonymized) | Debug false positives, tune continuation markers | Same as above |
| **Full Conversation Access** | Raw messages with all data visible | Technical support escalation (specific conversation, time-bounded) | Org opted in to `aiSupportAccessOptIn`. Logged in audit trail. Time-limited access window (e.g., 24h). |

**Anonymization Pipeline (for Tier C):**

```
Raw message: "Hola, soy María García. Mi teléfono es 11-5555-1234.
              Vivo en Av. Corrientes 1234, necesito un plomero."

                    ↓ Anonymization engine ↓

Anonymized: "Hola, soy [CLIENTE]. Mi teléfono es [TELÉFONO].
             Vivo en [DIRECCIÓN], necesito un plomero."

Rules:
  • Customer names → [CLIENTE]
  • Phone numbers → [TELÉFONO]  (regex: +54, 011, 11-, etc.)
  • Addresses → [DIRECCIÓN]     (regex: Av., Calle, Nº, piso, depto)
  • CUIT/DNI → [DOCUMENTO]      (regex: XX-XXXXXXXX-X)
  • Email → [EMAIL]             (regex: standard email)
  • Organization name → [EMPRESA]
  • Technician names → [TÉCNICO]
  • Job IDs remain (non-PII, useful for debugging)
  • Timestamps remain (non-PII, essential for timing analysis)
```

**Data Processing Agreement (DPA) — Required:**

Under Ley 25.326, CampoTech must have a written DPA with every organization. This is standard in SaaS. The DPA must state:

```
┌─ DPA Key Clauses ───────────────────────────────────────────────┐
│                                                                  │
│  1. CampoTech processes data ONLY per the org's instructions     │
│  2. CampoTech will NOT sell, share, or transfer data to third    │
│     parties without explicit consent                             │
│  3. CampoTech implements AES-256-GCM encryption at rest and      │
│     TLS 1.3 in transit                                           │
│  4. CampoTech will notify the org within 72 hours of any         │
│     data breach (AAIP requirement)                               │
│  5. The org retains full ownership of their data                 │
│  6. CampoTech will delete all org data within 30 days of         │
│     contract termination                                         │
│  7. AI Improvement Program participation is optional and         │
│     revocable at any time                                        │
│  8. CampoTech's DNPDP database registration number: [TBD]       │
│                                                                  │
│  Location: Legal document + embedded in Terms of Service         │
│  Implementation: Accept during onboarding, stored in             │
│  Organization.settings.dpa with timestamp and IP                 │
└──────────────────────────────────────────────────────────────────┘
```

**Industry Reference (how others do it):**

| Platform | Approach | Opt-in/Out |
|----------|----------|------------|
| **ChatGPT** (OpenAI) | Conversations used for training by default. Users can opt OUT via settings. Business/API plans: opted out by default. | Opt-out (consumer), Opt-in (business) |
| **Zendesk** | "AI Data Retention" setting per account. Aggregated data always. Message content only with consent. | Opt-in for message content |
| **Intercom** | "Help improve Intercom" checkbox. Uses anonymized conversation data. | Opt-out |
| **HubSpot** | "Data enrichment" opt-in. Customer conversations visible to HubSpot support with explicit permission. | Opt-in |
| **CampoTech** (our approach) | **Conservative / Argentine-compliant.** Nothing by default. Org must explicitly opt in. Customer can opt out. Full audit trail. | **Double opt-in** (org + customer right to oppose) |

> **Why double opt-in?** Argentina's PDPL (Ley 25.326) requires "free, express, and informed consent." The AAIP's 2024 AI transparency guide (Resolution 161/2023) specifically calls out AI training as a distinct processing purpose requiring its own consent. By being conservative, we avoid regulatory risk AND build trust — "CampoTech no lee tus mensajes" is a strong market differentiator in Argentina where data privacy concerns are high.

---

**Lifecycle Summary:**

```
┌─────────────────────────────────────────────────────────────────┐
│                   ADAPTIVE DEBOUNCE LIFECYCLE                    │
│                                                                  │
│  NEW CUSTOMER (first 3 sessions):                                │
│    → Static defaults (8s new session, 5s mid-convo)              │
│    → Record all burst patterns silently                          │
│    → No learned debounce applied yet                             │
│                                                                  │
│  LEARNING CUSTOMER (sessions 3-10):                              │
│    → learnedDebounceMs calculated and applied                    │
│    → Interruption detection active                               │
│    → Each interruption → +15% debounce correction                │
│    → Each clean session → −2% decay toward optimal               │
│                                                                  │
│  STABLE CUSTOMER (10+ sessions, <5% interruption rate):          │
│    → Learned debounce is well-calibrated                         │
│    → Minimal adjustments (only if behavior changes)              │
│    → Org can see stable green status in analytics                │
│                                                                  │
│  BEHAVIOR CHANGE DETECTION:                                      │
│    → If a stable customer suddenly gets 2+ interruptions         │
│      in 3 sessions → learning rate increases temporarily         │
│      (α bumps to 0.5 for faster adaptation)                     │
│    → Possible causes: new phone, typing injury, dictation mode   │
│    → System re-stabilizes within 3-5 sessions                    │
└─────────────────────────────────────────────────────────────────┘
```


---

## Phase C: Planning & Tools (Weeks 17-20)

### Goal

Enable multi-step planning with approval gates and dynamic tool selection.

### C1: Multi-Step Planner Node

**Pattern:**
```python
async def create_plan_node(state: CopilotState) -> CopilotState:
    """Decompose complex request into executable steps."""
    
    # Only complex requests need planning
    if is_simple_request(state["input_content"]):
        return {**state, "plan_steps": [{"type": "direct_response"}]}
    
    plan = await llm.invoke(f"""
    Request: {state["input_content"]}
    
    Break into steps. Each step is one of:
    - QUERY: Fetch data (jobs, schedule, customers)
    - ANALYZE: Process/filter/compare
    - PROPOSE: Suggest to user (no execution)
    - EXECUTE: Perform action (requires approval)
    
    Example for "Juan is sick, reschedule his jobs":
    1. QUERY: Find Juan's upcoming jobs
    2. QUERY: Find available technicians for those dates
    3. ANALYZE: Match jobs to available technicians
    4. PROPOSE: Show reassignment plan to user
    5. EXECUTE: Reassign jobs (after approval)
    """)
    
    return {**state, "plan_steps": plan, "current_step": 0}
```

### C2: Tool Categories & Whitelist

**Schema:**
```prisma
model AIToolCategory {
  id              String   @id @default(cuid())
  name            String   // "safe", "suggest", "execute"
  description     String
  tools           AITool[]
  
  @@map("ai_tool_categories")
}

model AITool {
  id              String   @id @default(cuid())
  name            String   // "query_schedule", "create_job"
  description     String
  categoryId      String
  apiEndpoint     String   // "/api/schedule/available"
  parameters      Json     // Parameter schema
  requiresApproval Boolean @default(false)
  
  category        AIToolCategory @relation(fields: [categoryId], references: [id])
  
  @@map("ai_tools")
}
```

**Tool Categories:**
| Category | Examples | Approval |
|----------|----------|----------|
| SAFE | query_schedule, search_customers, check_conflicts | Never |
| SUGGEST | draft_reply, suggest_slots, estimate_price | Never |
| EXECUTE | create_job, send_message, update_schedule | Always |
| BULK | reassign_all_jobs, send_bulk_message | Always + Confirmation |

### C3: Approval Gate Pattern with TTL & Re-Validation

> ⚠️ **Ghost Approval Problem:** If user doesn't click "Approve" for 4 hours, is the state still valid?
> **Solution:** TTL on pending approvals + re-validation before execution.

**Schema for Pending Approvals:**
```prisma
model AIPendingApproval {
  id              String   @id @default(cuid())
  organizationId  String
  conversationId  String
  
  workflowState   Json     // Serialized CopilotState at pause time
  proposedActions Json     // Actions awaiting approval
  snapshotHash    String   // Hash of relevant data at proposal time
  
  createdAt       DateTime @default(now())
  expiresAt       DateTime // TTL: 4 hours from creation
  
  status          String   @default("pending")  // pending, approved, expired, stale
  
  @@index([organizationId, status])
  @@index([expiresAt])
  @@map("ai_pending_approvals")
}
```

**Approval Gate Node:**
```python
import hashlib
from datetime import datetime, timedelta

async def approval_gate_node(state: CopilotState) -> CopilotState:
    """Pause workflow and wait for human approval."""
    
    action = state["proposed_actions"][0]
    tool = await get_tool(action["tool_name"])
    
    if not tool.requiresApproval:
        return {**state, "status": "executing"}
    
    # Create snapshot hash for stale detection
    snapshot_data = await get_relevant_data_for_action(action)
    snapshot_hash = hashlib.sha256(json.dumps(snapshot_data, sort_keys=True).encode()).hexdigest()
    
    # Store pending approval with TTL (4 hours)
    pending = await prisma.aipendingapproval.create(
        data={
            "organizationId": state["organization_id"],
            "conversationId": state["conversation_id"],
            "workflowState": state,
            "proposedActions": state["proposed_actions"],
            "snapshotHash": snapshot_hash,
            "expiresAt": datetime.now() + timedelta(hours=4),
        }
    )
    
    return {
        **state,
        "status": "awaiting_approval",
        "requires_approval": True,
        "approval_id": pending.id,
        "approval_message": f"AI wants to: {action['description']}",
        "expires_in": "4 hours",
    }
```

**Approval Handler with Re-Validation:**
```python
async def handle_approval(approval_id: str, user_approved: bool) -> dict:
    """Process user's approval decision with staleness check."""
    
    pending = await prisma.aipendingapproval.find_unique(where={"id": approval_id})
    
    if not pending:
        return {"error": "not_found", "message": "Approval request not found"}
    
    # Check expiry
    if pending.expiresAt < datetime.now():
        await prisma.aipendingapproval.update(
            where={"id": approval_id},
            data={"status": "expired"}
        )
        return {
            "error": "expired",
            "message": "Esta acción expiró. ¿Querés que vuelva a analizar?",
            "action": "re_analyze"
        }
    
    if not user_approved:
        await prisma.aipendingapproval.update(
            where={"id": approval_id},
            data={"status": "rejected"}
        )
        return {"status": "rejected"}
    
    # Re-validate that data hasn't changed (prevent stale operations)
    current_snapshot = await get_relevant_data_for_action(pending.proposedActions[0])
    current_hash = hashlib.sha256(json.dumps(current_snapshot, sort_keys=True).encode()).hexdigest()
    
    if current_hash != pending.snapshotHash:
        await prisma.aipendingapproval.update(
            where={"id": approval_id},
            data={"status": "stale"}
        )
        return {
            "error": "stale",
            "message": "La agenda cambió desde mi propuesta. Déjame volver a revisar...",
            "action": "re_analyze",
            "changes_detected": True
        }
    
    # Safe to execute!
    await prisma.aipendingapproval.update(
        where={"id": approval_id},
        data={"status": "approved"}
    )
    
    return await execute_approved_actions(pending.workflowState, pending.proposedActions)
```

**Cleanup Cron (Daily):**
```python
# Clean up expired pending approvals
await prisma.aipendingapproval.delete_many(
    where={"expiresAt": {"lt": datetime.now()}}
)
```

### C4: Dynamic Tool Selection (OpenAI Function Calling)

> ⚠️ **Important:** Use OpenAI Function Calling, NOT free-text tool selection.
> Function calling is more reliable for structured outputs.

**Tool Registry Pattern:**
```python
# services/ai/app/tools/registry.py

async def get_tools_for_intent(intent: str, category_filter: list[str] = None) -> list[dict]:
    """Return OpenAI function-calling compatible tool definitions."""
    
    tools = {
        "query_schedule": {
            "type": "function",
            "function": {
                "name": "query_schedule",
                "description": "Query technician availability for a date range",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "start_date": {"type": "string", "format": "date"},
                        "end_date": {"type": "string", "format": "date"},
                        "technician_id": {"type": "string", "description": "Optional specific technician"}
                    },
                    "required": ["start_date"]
                }
            }
        },
        "create_job": {
            "type": "function",
            "function": {
                "name": "create_job",
                "description": "Create a new job/service appointment",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "customer_id": {"type": "string"},
                        "service_type": {"type": "string"},
                        "scheduled_date": {"type": "string", "format": "date"},
                        "scheduled_time": {"type": "string", "format": "time"},
                        "notes": {"type": "string"}
                    },
                    "required": ["customer_id", "service_type", "scheduled_date"]
                }
            }
        },
        # ... more tools
    }
    
    # Filter by category if specified
    if category_filter:
        tool_categories = await get_tool_categories()  # Returns {"safe": [...], "execute": [...]}
        allowed_names = set()
        for cat in category_filter:
            allowed_names.update(tool_categories.get(cat, []))
        return [t for t in tools.values() if t["function"]["name"] in allowed_names]
    
    return list(tools.values())
```

**Function Calling Pattern:**
```python
async def select_and_call_tools_node(state: CopilotState) -> CopilotState:
    """Use OpenAI function calling for reliable tool selection."""
    
    available_tools = await get_tools_for_intent(state["detected_intent"])
    
    # Let OpenAI select and parameterize the tool
    response = await openai.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Select appropriate tools for the user request."},
            {"role": "user", "content": state["input_content"]}
        ],
        tools=available_tools,
        tool_choice="auto"  # or "required" to force tool use
    )
    
    # Extract tool calls
    tool_calls = response.choices[0].message.tool_calls or []
    
    proposed_actions = []
    for call in tool_calls:
        proposed_actions.append({
            "tool_name": call.function.name,
            "arguments": json.loads(call.function.arguments),
            "call_id": call.id,
        })
    
    return {**state, "proposed_actions": proposed_actions}
```

**Why Function Calling > Free-Text:**
| Approach | Reliability | Parsing | Schema Validation |
|----------|-------------|---------|-------------------|
| Free-text "pick from list" | ~70% | Requires regex/parsing | Manual |
| OpenAI Function Calling | ~95%+ | Automatic JSON | Built-in |

---

## Phase D: Proactive & Multi-Modal (Weeks 21-24)

### Goal

Add proactive suggestions and image/document handling.

### D1: Proactive Suggestion Engine

**Schema:**
```prisma
model AISuggestion {
  id              String   @id @default(cuid())
  organizationId  String
  customerId      String?
  jobId           String?
  
  type            String   // "maintenance_due", "followup", "opportunity"
  priority        Int      @default(0)
  title           String
  message         String
  suggestedAction Json?
  
  status          String   @default("pending")  // pending, shown, acted, dismissed
  shownAt         DateTime?
  actedAt         DateTime?
  
  expiresAt       DateTime?
  createdAt       DateTime @default(now())
  
  @@index([organizationId, status])
  @@map("ai_suggestions")
}
```

**Cron Job Pattern:**
```python
# Run daily at 8 AM
async def generate_proactive_suggestions():
    for org in await get_active_organizations():
        # 1. Maintenance due
        equipment = await find_equipment_needing_maintenance(org.id)
        for item in equipment:
            await create_suggestion(
                type="maintenance_due",
                title=f"Mantenimiento pendiente: {item.customer_name}",
                message=f"El {item.equipment_type} tiene {item.days_since_service} días sin servicio",
            )
        
        # 2. Follow-up on recent jobs
        jobs = await find_jobs_needing_followup(org.id, days_ago=3)
        for job in jobs:
            await create_suggestion(
                type="followup",
                title=f"Seguimiento: {job.customer_name}",
                message=f"Trabajo completado hace 3 días. ¿Todo bien?",
            )
        
        # 3. Seasonal patterns
        if is_summer():
            await generate_ac_maintenance_suggestions(org.id)
```

### D2: Image Analysis with Parallel Nodes (GPT-4 Vision)

> 💡 **Optimization:** Don't wait for image analysis before text analysis.
> Use LangGraph parallel nodes - analyze image and text simultaneously.

**Sequential (Slow):**
```
Image received → [Wait 2s for Vision] → [Analyze text] → [Respond]
Total: ~3-4 seconds
```

**Parallel (Fast):**
```
Image received → [Vision 2s] ─┐
                             ├→ [Combine] → [Respond]
Text received  → [Intent 0.5s]┘
Total: ~2.5 seconds
```

**LangGraph Parallel Node Pattern:**
```python
from langgraph.graph import StateGraph, END

def build_multimodal_workflow():
    workflow = StateGraph(CopilotState)
    
    # Entry point
    workflow.add_node("intake", intake_node)
    
    # Parallel branches for image + text (both run simultaneously)
    workflow.add_node("analyze_image", analyze_image_node)
    workflow.add_node("analyze_text", analyze_text_node)
    
    # Route to parallel nodes from intake
    workflow.add_edge("intake", "analyze_image")
    workflow.add_edge("intake", "analyze_text")
    
    # Join node waits for BOTH to complete
    workflow.add_node("combine_analysis", combine_analysis_node)
    workflow.add_edge("analyze_image", "combine_analysis")
    workflow.add_edge("analyze_text", "combine_analysis")
    
    # Continue with combined context
    workflow.add_node("generate_response", generate_response_node)
    workflow.add_edge("combine_analysis", "generate_response")
    workflow.add_edge("generate_response", END)
    
    return workflow.compile()
```

**Image Analysis Node:**
```python
async def analyze_image_node(state: CopilotState) -> CopilotState:
    """Analyze customer-sent images for diagnosis (runs in parallel)."""
    
    if not state.get("image_urls"):
        return {**state, "image_analysis": None}
    
    response = await openai.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system", 
                "content": "You're a technician assistant. Analyze this image and provide diagnosis. Be specific about what you see."
            },
            {
                "role": "user", 
                "content": [
                    {"type": "text", "text": state.get("input_content", "Analyze this image")},
                    {"type": "image_url", "image_url": {"url": state["image_urls"][0]}}
                ]
            }
        ]
    )
    
    return {**state, "image_analysis": response.choices[0].message.content}
```

**Text Analysis Node (runs in parallel):**
```python
async def analyze_text_node(state: CopilotState) -> CopilotState:
    """Analyze text intent and entities (runs in parallel with image)."""
    
    # Standard intent/entity extraction
    intent_result = await detect_intent(state["input_content"])
    
    return {
        **state,
        "detected_intent": intent_result.intent,
        "intent_confidence": intent_result.confidence,
        "extracted_entities": intent_result.entities,
    }
```

**Combine Node (waits for both):**
```python
async def combine_analysis_node(state: CopilotState) -> CopilotState:
    """Combine image and text analysis into unified context."""
    
    combined_context = f"""
    Customer message: {state.get('input_content', '')}
    Detected intent: {state.get('detected_intent', 'unknown')}
    Image analysis: {state.get('image_analysis', 'No image')}
    """
    
    return {**state, "combined_context": combined_context}
```

### D3: Document Generation (Quote PDFs)

**Pattern:**
```python
async def generate_quote_pdf(quote_data: dict) -> str:
    """Generate PDF quote and return storage URL."""
    
    # Use existing PDF template
    html = await render_template("quote.html", quote_data)
    pdf_bytes = await html_to_pdf(html)
    
    # Upload to Supabase Storage
    url = await supabase.storage.upload(
        bucket="quotes",
        path=f"{quote_data['id']}.pdf",
        file=pdf_bytes,
    )
    
    return url
```

---

## File Checklist

### Phase A0 Files (Sub-Agent Architecture)

| File | Purpose |
|------|---------|
| `services/ai/app/workflows/registry.py` | Sub-agent registry & config |
| `services/ai/app/workflows/orchestrator.py` | Master orchestrator graph |
| `services/ai/app/workflows/subagents/_template.py` | Sub-agent skeleton template |
| `services/ai/app/workflows/subagents/scheduling.py` | Scheduling sub-agent (stub) |
| `services/ai/app/workflows/subagents/customer.py` | Customer sub-agent (stub) |
| `services/ai/app/workflows/subagents/financial.py` | Financial sub-agent (stub) |
| `services/ai/app/workflows/subagents/fleet.py` | Fleet sub-agent (stub) |
| `services/ai/app/workflows/subagents/escalation.py` | Escalation sub-agent (stub) |
| `services/ai/app/workflows/subagents/proactive.py` | Proactive sub-agent (stub) |
| `services/ai/app/workflows/subagents/general.py` | General/FAQ sub-agent (stub) |
| `services/ai/app/prompts/scheduling.md` | Scheduling domain prompt (stub) |
| `services/ai/app/prompts/customer.md` | Customer domain prompt (stub) |
| `services/ai/app/prompts/financial.md` | Financial domain prompt (stub) |
| `services/ai/app/prompts/fleet.md` | Fleet domain prompt (stub) |
| `services/ai/app/prompts/escalation.md` | Escalation domain prompt (stub) |
| `services/ai/app/prompts/proactive.md` | Proactive domain prompt (stub) |
| `services/ai/app/prompts/general.md` | General domain prompt (stub) |

### Phase A Files

| File | Purpose |
|------|---------|
| `services/ai/app/workflows/opportunity_detection.py` | Opportunity workflow |
| `services/ai/app/api/opportunity.py` | Opportunity API |
| `services/ai/app/api/evaluation.py` | Evaluation API |
| `services/ai/app/evaluation/engine.py` | Metrics engine |
| `apps/web/app/api/copilot/chat/route.ts` | Proxy (modify existing) |

### Phase B Files

| File | Purpose |
|------|---------|
| `services/ai/app/memory/profile_extractor.py` | Profile learning |
| `services/ai/app/memory/context_loader.py` | Load context |
| `services/ai/app/memory/redis_cache.py` | Redis abstraction |

### Phase C Files

| File | Purpose |
|------|---------|
| `services/ai/app/planning/planner.py` | Multi-step planner |
| `services/ai/app/planning/approval_gate.py` | Approval logic |
| `services/ai/app/tools/registry.py` | Tool whitelist |
| `services/ai/app/tools/executor.py` | Tool execution |

### Phase D Files

| File | Purpose |
|------|---------|
| `services/ai/app/proactive/suggestion_engine.py` | Generate suggestions |
| `services/ai/app/proactive/cron.py` | Scheduled jobs |
| `services/ai/app/multimodal/image_analyzer.py` | GPT-4 Vision |
| `services/ai/app/multimodal/pdf_generator.py` | Quote PDFs |

---

## Schema Summary

| Model | Phase | Purpose |
|-------|-------|---------|
| `AISubAgentExecution` | A0 | Per-sub-agent execution tracking |
| `AIConfiguration` (extend) | A | Opportunity settings |
| `AIEvaluationDataset` | A | Test datasets |
| `AIEvaluationCase` | A | Test cases |
| `AIEvaluationRun` | A | Evaluation runs |
| `AIConfidenceCalibration` | A | Calibration tracking |
| `AIABTest` | A | A/B testing |
| `CustomerAIProfile` | B | Contact memory (phone-keyed, auto-created on first message) |
| `AIPendingApproval` | C | TTL-enforced approval queue |
| `AIToolCategory` | C | Tool categories |
| `AITool` | C | Tool definitions |
| `AISuggestion` | D | Proactive suggestions |

---

## Implementation Timeline

| Phase | Weeks | Focus | Deliverables |
|-------|-------|-------|--------------|
| **A0** | **1-2** | **Sub-Agent Architecture** | **Registry, orchestrator, sub-agent stubs, domain prompts** |
| A1-A2 | 3-4 | Opportunity + Unified Workflow | LangGraph workflows |
| A3 | 5 | Migration + Feature Flag | TS→Python proxy |
| A4 | 6 | LangSmith Observability | Full tracing |
| A-Eval | 7-12 | Evaluation System | Dataset, batch eval, calibration, A/B |
| B | 13-16 | Memory & Profiles | CustomerAIProfile (phone-keyed), phone-based identity resolution, system-layer pre-fetch, Redis, style adaptation |
| C | 17-20 | Planning & Tools | Multi-step, approval gates, tool whitelist |
| D | 21-24 | Proactive & Multi-Modal | Suggestions, images, PDFs |

---

## Key Principles

1. **Orchestrator + Sub-Agents**: Domain logic lives in isolated sub-agents, not a monolithic graph
2. **Deterministic Routing**: Intent → Category mapping is explicit, not emergent. Identity resolution is also deterministic (phone → profile via DB index) — predictable for business-critical WhatsApp
3. **Frozen Sub-Agent Prompts**: Each sub-agent has a focused 200-300 token domain prompt — prevents prompt drift
4. **Lazy Activation**: Only the relevant sub-agent's context and tools are loaded per request
5. **Hybrid Routing**: Simple requests stay in TypeScript (fast), complex go to Python (powerful)
6. **Hybrid Classifier**: Regex for obvious cases, SLM fallback for ambiguous (~92% accuracy)
7. **Working Memory Pattern**: Summarize context once, don't pass full history to every node
8. **Streaming for Complex**: Always stream responses from Python to avoid "waiting" UX
9. **Approval Gates with TTL**: Never auto-execute bulk operations, re-validate before execution
10. **OpenAI Function Calling**: Use structured tool calls, not free-text selection
11. **Intent-Based Profile Extraction**: Trigger on "goodbye" intent, not 30-min gap cron
12. **WhatsApp Message Locking**: Redis required for preventing race conditions
13. **Multi-Modal Parallel Nodes**: Analyze image and text simultaneously
14. **Per-Sub-Agent Observability**: LangSmith traces per sub-agent category for isolated debugging
15. **Per-Sub-Agent Evaluation**: Each domain has its own golden dataset for regression testing
16. **Intent Chaining**: Multi-intent messages are dependency-sorted and executed sequentially through the chain
17. **Context Mutations over Text**: Sub-agents emit structured `ContextMutation` payloads, not free-text memory appends
18. **Yield-to-Orchestrator with Guard**: Sub-agents yield on low confidence; max 2 reroutes before human escalation
19. **System-Layer Pre-Fetch**: Identity resolution and context loading happen deterministically during debounce, before AI wakes up — zero LLM calls for lookups
20. **Phone-Keyed Auto-Created Profiles**: CustomerAIProfile exists for every phone number that contacts the org, created on first message with no approval needed

---

## Security: Multi-Tenant Isolation

> ⚠️ **Critical:** All AI operations are strictly tenant-isolated.

**Isolation Guarantees:**

| Layer | Isolation Mechanism |
|-------|--------------------|
| Database | `organizationId` on every table, enforced by Prisma |
| API | `organizationId` extracted from auth, passed to all queries |
| LangGraph | Stateless per-request, state keyed by `(org_id, session_id)` |
| Redis | Keys prefixed: `org:{org_id}:*` or `whatsapp:{conversation_id}` |
| Memory | No global in-memory caches, no shared state |

**LangGraph Instance Pattern:**
```python
# Each request creates a fresh workflow run - NOT shared between orgs
@router.post("/process")
async def process_message(request: CopilotRequest):
    # Validate organization ownership
    await verify_organization_access(request.organization_id, request.auth_token)
    
    # Fresh workflow instance per request
    result = await copilot_workflow.ainvoke({
        "organization_id": request.organization_id,  # Scoped
        "session_id": f"{request.organization_id}:{request.conversation_id}",  # Composite key
        # ...
    })
    return result
```

**If using LangGraph MemorySaver:**
```python
# Memory is keyed by composite (org_id, session_id)
# No cross-tenant access possible
checkpointer = PostgresCheckpointer()

workflow = copilot_workflow.compile(
    checkpointer=checkpointer,
    # Thread ID includes org_id to prevent cross-tenant access
    thread_id=f"{organization_id}:{conversation_id}"
)
```

---

## What's Still Needed

The following items are required to complete the sub-agent architecture but are **deferred until CampoTech's feature set is finalized**:

### 1. Domain Workflow Logic (Per Sub-Agent)

Each sub-agent needs its internal LangGraph node sequence defined:

| Sub-Agent | Needs |
|-----------|-------|
| `SchedulingAgent` | Calendar conflict detection logic, technician matching algorithm, time slot suggestion strategy |
| `CustomerAgent` | Profile enrichment (v5.0: no longer handles identity resolution — that's System Layer), CUIT validation for invoicing, contact promotion to formal Customer entity |
| `FinancialAgent` | Presupuesto → Factura pipeline, IVA calculation integration, MercadoPago payment status checks |
| `FleetAgent` | Vehicle-technician matching optimization, bulk reschedule algorithm, sick-day redistribution logic |
| `EscalationAgent` | Frustration threshold tuning, human handoff protocol, ticket creation rules |
| `ProactiveAgent` | Equipment maintenance interval rules, seasonal pattern definitions, follow-up timing logic |
| `GeneralAgent` | FAQ knowledge base, greeting patterns, fallback response templates |

### 2. Domain System Prompts (es-AR)

Each `.md` prompt file in `services/ai/app/prompts/` needs content written in es-AR with:
- Domain-specific instructions and guardrails
- Example input/output pairs for few-shot learning
- Argentine market specifics (CUIT formats, IVA edge cases, holiday calendar, voseo)

### 3. Intent Taxonomy Finalization

The current intent list per sub-agent is preliminary. Final taxonomy requires:
- Exhaustive mapping of all user intents from WhatsApp conversation logs
- Ambiguity resolution (e.g., "Quiero agendar" — less ambiguous in v5.0 since system already resolved if customer exists)
- Cross-domain intent chains (e.g., "Crear cliente y agendar trabajo" spans Customer + Scheduling — simplified in v5.0 since identity is pre-resolved)

### 4. Cross-Domain Orchestration

> ✅ **v4.1:** Sequential chaining is now **designed** — `intent_chain` + `context_mutations` + loop-back routing.
> The items below are implementation details that remain deferred.

- ~~**Sequential chaining**: Customer → Scheduling~~ → **Designed** (intent_chain + chain loop-back)
- ~~**Context passing between agents**~~ → **Designed** (ContextMutation protocol)
- **Parallel execution**: Fleet + Scheduling simultaneously → Still needs design (LangGraph `Send` API)
- **Conflict resolution**: What if Fleet and Scheduling sub-agents disagree on availability?
- **Dependency sorting algorithm**: Auto-reorder `["book_job", "promote_contact"]` → `["promote_contact", "book_job"]` (v5.0: simplified since system already resolved identity — `promote_contact` is only needed when dispatcher explicitly requests formal Customer creation)

### 5. Per-Sub-Agent Evaluation Datasets

The `AIEvaluationDataset` model needs a `subagentCategory` field and golden test cases for each domain, including:
- Edge cases specific to each domain
- Cross-domain scenarios
- Argentine market specifics (CUIT formats, IVA cases, holiday calendar)

### 6. Per-Sub-Agent Monitoring Dashboard

The `AISubAgentExecution` tracking table enables per-domain dashboards:
- Latency P50/P95 per sub-agent
- Success rate per sub-agent
- Token cost per sub-agent
- Intent misrouting detection (when classify sends to wrong sub-agent)

### 7. Error Boundaries Between Sub-Agents

> ✅ **v4.1:** The yield-to-orchestrator pattern with `reroute_count` guard (max 2) is now **designed**.
> The items below are implementation details that remain deferred.

- ~~**Sub-agent can't handle request**~~ → **Designed** (confidence_gate + yield + reroute_count)
- ~~**Infinite reroute loops**~~ → **Designed** (max 2 reroutes → EscalationAgent)
- If a sub-agent fails (e.g., GPT-4 Vision timeout), the orchestrator needs a graceful fallback
- Circuit breaker integration with existing `lib/degradation` patterns
- Retry policies per sub-agent (some domains tolerate retries, others don't)

---

## Refinement History

| Version | Date | Changes |
|---------|------|---------|
| 3.0 | 2026-02-06 | Initial restructure with Phases A-D |
| 3.1 | 2026-02-06 | Hybrid routing, real-time sentiment, function calling, Redis optionality, multi-tenant security |
| 3.2 | 2026-02-06 | Working memory pattern, hybrid classifier, ghost approval TTL, intent-based extraction, WhatsApp locking, parallel multi-modal nodes |
| **4.0** | **2026-02-08** | **Orchestrator + Domain Sub-Agent architecture (Phase A0), workflow categories, sub-agent registry, Kimi-K2.5 inspiration analysis, md5→sha256 fix, async tool registry fix, What's Still Needed section** |
| **4.1** | **2026-02-08** | **Multi-intent chaining (intent_chain + chain loop-back), ContextMutation protocol for cross-domain data flow, yield-to-orchestrator with reroute guard (max 2), confidence_gate in sub-agent template, tool filter bug fix, stray brace fix** |
| **4.2** | **2026-02-08** | **Configurable per-agent min_confidence in SubAgentConfig, Redis key org-prefix consistency fix, lock heartbeat for long chains, intermediate_responses for partial chain success, created AI_SUBAGENT_DESIGN_WORKSHOP.md** |
| **5.0** | **2026-02-21** | **System Layer + AI Layer separation (deterministic pre-fetch during debounce), phone-keyed CustomerAIProfile (auto-created on first message), optional customerId, 4-layer context loading, Batch Processor step 4.5, consent fields moved to profile, CustomerAgent scope reduced to enrichment/promotion, 2 new Key Principles (#19, #20)** |

---

*Version 5.0 - 2026-02-21*
*Major: Architecture split into System Layer (deterministic, ~10ms) and AI Layer (LLM-powered, ~400ms-2s). CustomerAIProfile now keyed by phone+organizationId (not customerId), auto-created on first-ever message from any phone number. customerId is optional — profile exists for ALL contacts. Consent and disclosure tracking moved from Customer to CustomerAIProfile. CustomerAgent scope reduced from identity resolution to profile enrichment and formal Customer promotion. Batch Processor gained step 4.5 (parallel system pre-fetch). Context loading restructured from 3 to 4 layers (Layer 0 = System Layer). classify_intents_node simplified to drop identity intents when system already resolved. 35 coordinated changes across the document.*
