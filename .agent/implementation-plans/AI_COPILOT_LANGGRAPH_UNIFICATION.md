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

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                 ORCHESTRATOR + SUB-AGENT ARCHITECTURE                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ENTRY POINTS                   ORCHESTRATOR (Lightweight)                   │
│  ────────────                   ──────────────────────────                   │
│  • WhatsApp Webhook             ┌──────────────────────────┐                │
│  • Dashboard CopilotPanel       │  1. INTAKE (Working Mem) │                │
│  • Voice Messages               │  2. CLASSIFY INTENT      │                │
│  • Scheduled Proactive          │  3. ROUTE TO SUB-AGENT   │                │
│          │                      │  4. FORMAT RESPONSE      │                │
│          ▼                      └────────────┬─────────────┘                │
│  ┌──────────────────────┐                    │                              │
│  │ NEXT.JS (TS Proxy)   │                    ▼                              │
│  │ Hybrid Classifier    │     ┌──────────────────────────────┐              │
│  └──────────┬───────────┘     │       SUB-AGENT ROUTER       │              │
│             │                 │    (Intent → Category Map)   │              │
│             ▼                 └───┬──────┬──────┬──────┬─────┘              │
│  ┌──────────────────────┐        │      │      │      │                    │
│  │ PYTHON AI SERVICE    │        ▼      ▼      ▼      ▼                    │
│  │ (LangGraph)          │   ┌──────┐ ┌─────┐ ┌─────┐ ┌──────┐             │
│  │                      │   │SCHED │ │CUST │ │FINAN│ │FLEET │  ...more    │
│  │ Sub-Agent Registry   │   │Agent │ │Agent│ │Agent│ │Agent │             │
│  │ maps intents to      │   └──┬───┘ └──┬──┘ └──┬──┘ └──┬───┘             │
│  │ domain specialists   │      │        │       │       │                  │
│  │                      │      ▼        ▼       ▼       ▼                  │
│  │ Each sub-agent has:  │   ┌──────────────────────────────────┐           │
│  │ • Own system prompt  │   │   SHARED RESPONSE GENERATOR      │           │
│  │ • Own tool subset    │   │   (Style adapt + Memory update)  │           │
│  │ • Own model choice   │   └──────────────────────────────────┘           │
│  │ • Own eval dataset   │                                                  │
│  └──────────────────────┘   MEMORY: PostgreSQL + Redis                     │
│                              OBSERVABILITY: LangSmith per sub-agent         │
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

| Category | Sub-Agent Name | Example Intents | Model | Complexity | Tool Families |
|----------|----------------|-----------------|-------|------------|---------------|
| **Scheduling** | `SchedulingAgent` | `book_job`, `reschedule`, `cancel_job`, `check_availability` | gpt-4o-mini | Medium | `query_schedule`, `create_job`, `reschedule_job` |
| **Customer Mgmt** | `CustomerAgent` | `create_customer`, `search_customer`, `update_customer`, `validate_cuit` | gpt-4o-mini | Low | `create_customer`, `search_customer`, `validate_cuit` |
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
    "customer": SubAgentConfig(
        name="CustomerAgent",
        category="customer",
        intents=["create_customer", "search_customer", "update_customer", "validate_cuit"],
        model="gpt-4o-mini",
        tools=["create_customer", "search_customer", "validate_cuit"],
        requires_approval_for=["create_customer"],
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
    
    The orchestrator handles:
    1. Intake — load session, create working memory
    2. Classify — detect ALL intents, build dependency-sorted chain
    3. Route — pick the next sub-agent from the chain (or yield/escalate)
    4. [Sub-Agent] — execute domain logic, emit context mutations
    5. Respond — format response, advance chain, loop back if more steps
    
    Supports multi-intent chaining, sub-agent yield, and context mutations.
    It does NOT contain any domain-specific logic.
    """
    graph = StateGraph(CopilotState)
    
    # Shared infrastructure nodes
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
    
    Example: "Crear cliente Juan y agendarle mañana"
           → ["create_customer", "book_job"]  (create BEFORE book)
    
    The dependency sort ensures entity IDs exist before they're referenced.
    """
    intents = await detect_intents(state["input_content"])
    # Prompt: "Identify ALL intents. Return JSON list ordered by dependency."
    
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
    
    # Input
    input_type: Literal["text", "voice", "action", "image"]
    input_content: str
    image_urls: Optional[list[str]]  # For multi-modal
    
    # WORKING MEMORY (lightweight - passed to all nodes)
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
    intent_chain: list[str]            # ["create_customer", "book_job"] — dependency-sorted
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

**Working Memory Pattern (Token Optimization):**
```python
async def context_loader_node(state: CopilotState) -> CopilotState:
    """First node - creates compact working memory from full context."""
    
    history = await fetch_conversation_history(state["conversation_id"])
    profile = await fetch_customer_profile(state.get("customer_id"))
    
    # Create compact summary (one LLM call, ~100ms)
    working_memory = await summarize_context(history[-10:], profile)
    # Output: "María García, cliente frecuente (8 trabajos). Último: AC hace 6 meses.
    #          Prefiere mañanas, estilo formal. Contexto: preguntó sobre mantenimiento."
    
    return {
        **state,
        "working_memory": working_memory,  # ~200 tokens
        "current_context": format_last_messages(history[-3:]),  # ~100 tokens
        # Raw data stored but NOT passed to most nodes
        "_raw_history": history,
        "_raw_profile": profile,
    }
```

**Token Savings:**
| Approach | Tokens/Request | Cost Impact |
|----------|----------------|-------------|
| Full history to all nodes | ~10,000 | $$$$ |
| Working memory pattern | ~500 | $ |

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

```prisma
model CustomerAIProfile {
  id                     String   @id @default(cuid())
  customerId             String   @unique
  organizationId         String
  
  // Communication style (learned from messages)
  preferredFormality     String?  // "formal" | "casual" | "mixed"
  typicalMessageLength   String?  // "brief" | "detailed"
  responseUrgency        Float?   // 0-1 scale (how fast they expect replies)
  emojiUsage             Boolean  @default(false)
  preferredContactTimes  Json?    // { morning: true, evening: false }
  
  // Relationship metrics
  relationshipScore      Float    @default(0.5)  // 0 = new, 1 = loyal
  totalInteractions      Int      @default(0)
  positiveInteractions   Int      @default(0)
  
  // Preferences (learned from history)
  preferredTechnicians   String[] @default([])
  preferredServices      String[] @default([])
  priceAversion          Float?   // 0 = price-insensitive, 1 = very sensitive
  
  // Timestamps
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  
  customer               Customer @relation(fields: [customerId], references: [id])
  
  @@index([organizationId])
  @@map("customer_ai_profiles")
}
```

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
    
    await update_customer_profile(state["conversation_id"], analysis)
    
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

### B3: Session Context & WhatsApp Message Locking

> ⚠️ **Critical for WhatsApp:** Redis IS required for message locking to prevent race conditions.
> For session caching, PostgreSQL is sufficient initially.

**Redis Requirements by Use Case:**
| Use Case | Required? | Why |
|----------|-----------|-----|
| Session context caching | Optional | Postgres fine for <500 orgs |
| **WhatsApp message locking** | **REQUIRED** | Prevents race conditions |
| Rate limiting | Optional | Can use database counter |
| Pending approvals | Optional | Database with TTL column |

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

**Phase B3a: PostgreSQL-Only (Dashboard Copilot)**
```python
# Works fine for dashboard - no burst messages
async def load_session_context(conversation_id: str) -> dict:
    return await prisma.aiconversationlog.find_many(
        where={"conversationId": conversation_id},
        take=20,
        order={"createdAt": "desc"}
    )
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

### B4: Communication Style Adaptation

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
| `CustomerAIProfile` | B | Customer learning |
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
| B | 13-16 | Memory & Profiles | CustomerAIProfile, Redis, style adaptation |
| C | 17-20 | Planning & Tools | Multi-step, approval gates, tool whitelist |
| D | 21-24 | Proactive & Multi-Modal | Suggestions, images, PDFs |

---

## Key Principles

1. **Orchestrator + Sub-Agents**: Domain logic lives in isolated sub-agents, not a monolithic graph
2. **Deterministic Routing**: Intent → Category mapping is explicit, not emergent — predictable for business-critical WhatsApp
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
| `CustomerAgent` | CUIT validation flow integration, customer type classification, onboarding flow steps |
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
- Ambiguity resolution (e.g., "Quiero agendar" — Scheduling or Customer creation?)
- Cross-domain intent chains (e.g., "Crear cliente y agendar trabajo" spans Customer + Scheduling)

### 4. Cross-Domain Orchestration

> ✅ **v4.1:** Sequential chaining is now **designed** — `intent_chain` + `context_mutations` + loop-back routing.
> The items below are implementation details that remain deferred.

- ~~**Sequential chaining**: Customer → Scheduling~~ → **Designed** (intent_chain + chain loop-back)
- ~~**Context passing between agents**~~ → **Designed** (ContextMutation protocol)
- **Parallel execution**: Fleet + Scheduling simultaneously → Still needs design (LangGraph `Send` API)
- **Conflict resolution**: What if Fleet and Scheduling sub-agents disagree on availability?
- **Dependency sorting algorithm**: Auto-reorder `["book_job", "create_customer"]` → `["create_customer", "book_job"]`

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

---

*Version 4.2 - 2026-02-08*
*Minor: Per-agent configurable confidence thresholds (FinancialAgent/FleetAgent at 0.6, others at 0.4). Redis WhatsApp keys now consistently prefixed with org_id for tenant isolation. Lock heartbeat pattern for multi-intent chains exceeding 30s TTL. intermediate_responses field for partial chain success composition. Created companion document [AI_SUBAGENT_DESIGN_WORKSHOP.md](./AI_SUBAGENT_DESIGN_WORKSHOP.md) for sub-agent content definition.*
