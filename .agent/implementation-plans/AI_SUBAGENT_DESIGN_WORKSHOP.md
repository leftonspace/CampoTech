# AI Sub-Agent Design Workshop

> **Version:** 1.0 (2026-02-08)  
> **Priority:** HIGH  
> **Depends On:** [AI_COPILOT_LANGGRAPH_UNIFICATION.md](./AI_COPILOT_LANGGRAPH_UNIFICATION.md) v4.1+  
> **Purpose:** Define the internal logic, workflows, and decision rules for each sub-agent category before implementation begins

---

## Overview

The [AI Copilot LangGraph Unification Plan](./AI_COPILOT_LANGGRAPH_UNIFICATION.md) defines the **infrastructure** — the orchestrator, sub-agent template, chaining protocol, and mutation system. This document defines the **content** — what each sub-agent actually *does*, what it knows, what it decides, and how it interacts with CampoTech's domain.

**Once this workshop is complete, the answers will be used to:**
1. Write the domain prompt files (`services/ai/prompts/*.md`)
2. Define the internal LangGraph node sequences per sub-agent
3. Finalize the intent taxonomy and tool requirements
4. Update the main unification plan where noted in [§ Cross-References](#cross-references-to-main-plan)

---

## How to Use This Document

For each sub-agent category below:
1. **Read the questions** — they surface the decisions needed before writing code
2. **Answer each question** — with specific CampoTech business rules, not generic answers
3. **Flag "I don't know yet"** items — these become explicit deferred items, not hidden assumptions
4. **Review the cross-references** — understand which parts of the main plan depend on your answers

---

## 1. SchedulingAgent

**Domain:** Job booking, rescheduling, cancellation, availability checks  
**Model:** `gpt-4o-mini` | **Min Confidence:** `0.4`

### Workflow Questions

#### 1.1 Job Booking Flow
- [ ] What data is required to create a job? (customer, service type, time slot, technician, address, equipment?)
- [ ] Can the copilot auto-assign a technician, or must the operator always choose?
- [ ] If multiple technicians are available, how should the AI rank them? (closest, least busy, customer preference, skill match?)
- [ ] What happens if no technician is available? (waitlist? suggest different date? suggest different service area?)
- [ ] Should the AI check for scheduling conflicts with the customer (existing jobs on same day)?
- [ ] Are there time zones or regional considerations within Argentina?
- [ ] Minimum lead time for bookings? (e.g., can't book for 30 minutes from now)

#### 1.2 Conflict Resolution
- [ ] If the requested time is unavailable, how many alternatives should the AI present? (3? 5? next available only?)
- [ ] Should alternatives be limited to the same week, or span further out?
- [ ] If the customer has a preferred technician, should the AI prioritize that over availability?
- [ ] How should the AI handle overlapping jobs? (reject? warn operator? allow with note?)

#### 1.3 Rescheduling
- [ ] Can the copilot reschedule without operator approval? Under what conditions?
- [ ] If a job is rescheduled, should the customer be notified automatically via WhatsApp?
- [ ] Is there a maximum number of reschedules per job before escalation?
- [ ] What data changes on reschedule? (just time? or also technician, equipment?)

#### 1.4 Cancellation
- [ ] What are the valid cancellation reasons? (customer request, weather, technician unavailable, etc.)
- [ ] Is there a cancellation policy? (e.g., < 24h notice → fee?)
- [ ] Should cancelled jobs offer re-booking at the same time?
- [ ] Does cancellation trigger any financial events? (refund, credit note?)

#### 1.5 Availability Queries
- [ ] "¿Qué turnos hay para mañana?" — What does the response format look like? (list? calendar? suggested single slot?)
- [ ] Should availability be per-technician, per-service-type, or general?
- [ ] Do specific services require specific technicians or equipment?

### Tools Needed
| Tool Name | Action | Needs Approval? | Notes |
|-----------|--------|-----------------|-------|
| `query_schedule` | Read calendar | No | |
| `create_job` | Book a job | Yes | |
| `reschedule_job` | Move a job | TBD | Depends on 1.3 |
| `cancel_job` | Cancel a job | Yes | |
| `query_technician_availability` | Check technician slots | No | New? |
| `notify_customer` | Send WhatsApp notification | TBD | |

### Context Mutations Emitted
| Mutation | entity_type | When | Consumed By |
|----------|-------------|------|-------------|
| `created_entity` | `job` | After booking | FinancialAgent (auto-quote?) |
| `updated_entity` | `job` | After reschedule | — |
| `deleted_entity` | `job` | After cancellation | FinancialAgent (credit note?) |

---

## 2. CustomerAgent

**Domain:** Customer creation, search, updates, CUIT validation  
**Model:** `gpt-4o-mini` | **Min Confidence:** `0.4`

### Workflow Questions

#### 2.1 Customer Creation
- [ ] What fields are required vs. optional? (name, CUIT, phone, email, address, company name?)
- [ ] Can the AI create a customer from a WhatsApp message alone? (extract name + phone from context?)
- [ ] Should CUIT be validated immediately via Mod-11, or also checked against AFIP?
- [ ] What happens with duplicate CUITs? (reject? merge? create anyway with warning?)
- [ ] What happens with duplicate phone numbers? (might be same person, different CUIT?)
- [ ] Is there a customer "type" classification? (residential, commercial, industrial, government?)
- [ ] Default values — what should be auto-filled? (currency = ARS, country = AR, etc.)

#### 2.2 Customer Search
- [ ] What fields can users search by? (name, CUIT, phone, address, email?)
- [ ] How should fuzzy matching work? (e.g., "Juan García" vs. "García, Juan"?)
- [ ] If multiple results match, how many should the AI show? Format?
- [ ] Should the AI auto-select if there's exactly one match, or always confirm?

#### 2.3 Customer Updates
- [ ] Which fields can the copilot update? (all? only contact info? never CUIT?)
- [ ] Do updates require operator approval?
- [ ] Should the AI detect when a customer's info might be outdated? (e.g., "nuevo número: 351-xxx")

#### 2.4 CUIT Validation
- [ ] Mod-11 validation only, or also AFIP online check?
- [ ] Should invalid CUITs block customer creation, or just warn?
- [ ] What about customers without CUIT? (Consumidor Final flow?)

### Tools Needed
| Tool Name | Action | Needs Approval? | Notes |
|-----------|--------|-----------------|-------|
| `create_customer` | Create new customer | Yes | |
| `search_customer` | Find customers | No | |
| `update_customer` | Modify customer data | TBD | |
| `validate_cuit` | Validate CUIT (Mod-11 + AFIP?) | No | |

### Context Mutations Emitted
| Mutation | entity_type | When | Consumed By |
|----------|-------------|------|-------------|
| `created_entity` | `customer` | After creation | SchedulingAgent, FinancialAgent |
| `queried_data` | `customer` | After search | SchedulingAgent (booking for found customer) |

---

## 3. FinancialAgent

**Domain:** Quotes, invoices, payment tracking, pricing  
**Model:** `gpt-4o` (higher stakes) | **Min Confidence:** `0.6`

### Workflow Questions

#### 3.1 Quote Generation (Presupuesto)
- [ ] What data is needed? (customer, services, line items, quantities, labor hours?)
- [ ] Does the AI auto-calculate totals (subtotal + IVA), or pull from a pricing table?
- [ ] What IVA rate(s) apply? (21%? 10.5%? exempt? depends on service?)
- [ ] Should the AI generate the PDF immediately, or present a preview first?
- [ ] What happens if a customer asks "¿Cuánto sale instalar X?" — does the AI quote on the spot or create a formal presupuesto?
- [ ] Quote validity period? (7 days? 15 days? configurable per org?)

#### 3.2 Invoice Generation (Factura)
- [ ] What triggers an invoice? (job completion? operator request? payment received?)
- [ ] Does the system need to integrate with AFIP for electronic invoicing (Factura Electrónica)?
- [ ] Invoice types? (A, B, C? depends on customer type?)
- [ ] Can a quote be converted to an invoice automatically?
- [ ] Does the AI handle Nota de Crédito / Nota de Débito?

#### 3.3 Payment Status
- [ ] What payment methods are tracked? (MercadoPago, bank transfer, cash, check?)
- [ ] "¿Ya pagó Juan?" — What data does the AI access? (payment records? MercadoPago API?)
- [ ] Should the AI proactively flag overdue payments?
- [ ] What's the dunning sequence? (reminder → follow-up → escalation?)

#### 3.4 Pricing Queries
- [ ] Does a price list exist per organization?
- [ ] Can the AI access service pricing directly, or does it need operator confirmation?
- [ ] How does pricing vary? (by service type? by customer type? by region? by urgency?)

### Tools Needed
| Tool Name | Action | Needs Approval? | Notes |
|-----------|--------|-----------------|-------|
| `gen_quote_pdf` | Generate quote PDF | Yes | |
| `gen_invoice` | Generate invoice | Yes | AFIP integration? |
| `check_payment` | Query payment status | No | |
| `get_pricing` | Look up service prices | No | New? |
| `create_credit_note` | Issue credit note | Yes | New? |

### Context Mutations Emitted
| Mutation | entity_type | When | Consumed By |
|----------|-------------|------|-------------|
| `created_entity` | `quote` | After generation | — |
| `created_entity` | `invoice` | After generation | — |
| `queried_data` | `payment` | After status check | EscalationAgent (overdue?) |

---

## 4. FleetAgent

**Domain:** Vehicle assignments, technician management, bulk operations, dispatch  
**Model:** `gpt-4o` (complex reasoning) | **Min Confidence:** `0.6`

### Workflow Questions

#### 4.1 Technician-Vehicle Assignment
- [ ] Is there a fixed technician↔vehicle mapping, or is it flexible?
- [ ] What criteria determine assignment? (location, skills, certifications, vehicle type?)
- [ ] Can a technician have multiple vehicles? Can a vehicle have multiple technicians?

#### 4.2 Sick Day / Absence Handling
- [ ] "Juan está enfermo" — What should happen automatically?
  - [ ] Find Juan's jobs for the day
  - [ ] Redistribute to available technicians (by what algorithm?)
  - [ ] Notify affected customers?
  - [ ] Notify other technicians?
- [ ] Should the AI suggest redistributions, or auto-execute with approval?
- [ ] What about multi-day absences?

#### 4.3 Bulk Reschedule
- [ ] What triggers bulk reschedule? (weather, vehicle breakdown, emergency?)
- [ ] How many jobs constitute "bulk"? (threshold for requiring extra approval?)
- [ ] Should the AI optimize the new schedule? (minimize travel time? maintain customer preferences?)
- [ ] Is there a priority system? (emergency jobs first, then VIP customers, then standard?)

#### 4.4 Dispatch
- [ ] Does the AI handle real-time dispatch, or is that pre-planned?
- [ ] Route optimization? (shortest distance, fastest time, most jobs per route?)
- [ ] Integration with maps/GPS?

### Tools Needed
| Tool Name | Action | Needs Approval? | Notes |
|-----------|--------|-----------------|-------|
| `query_fleet` | Check fleet/technician status | No | |
| `reassign_jobs` | Redistribute jobs | Yes | |
| `check_conflicts` | Detect scheduling conflicts | No | |
| `bulk_reschedule` | Reschedule multiple jobs | Yes | |
| `notify_technician` | Send notification to tech | TBD | New? |

### Context Mutations Emitted
| Mutation | entity_type | When | Consumed By |
|----------|-------------|------|-------------|
| `updated_entity` | `job` (multiple) | After reassignment | — |
| `queried_data` | `technician` | After availability check | SchedulingAgent |

---

## 5. EscalationAgent

**Domain:** Complaint handling, emergency routing, human handoff  
**Model:** `gpt-4o` (empathy + judgment) | **Min Confidence:** `0.4` (catches wide net)

### Workflow Questions

#### 5.1 Escalation Triggers
- [ ] What frustration signals trigger escalation? (define thresholds)
  - [ ] N messages without resolution → escalate? (what's N?)
  - [ ] Explicitly asks for human ("quiero hablar con alguien")
  - [ ] Sentiment < threshold for N consecutive messages
  - [ ] Caps lock + repetition pattern
- [ ] Are there severity levels? (low → log, medium → alert, high → immediate handoff?)

#### 5.2 Human Handoff Protocol
- [ ] Where does the handoff go? (WhatsApp group? dashboard notification? email? phone call?)
- [ ] What context does the human receive? (conversation summary, customer profile, AI's assessment?)
- [ ] Can the AI resume after human resolution, or is the conversation "handed off" permanently?
- [ ] What happens outside business hours? (queue? auto-response? emergency-only handoff?)

#### 5.3 Emergency Handling
- [ ] What constitutes an emergency vs. a complaint? (gas leak vs. slow service?)
- [ ] Emergency response time SLA?
- [ ] Does the AI have a different tone for emergencies? (more direct, less casual?)

#### 5.4 Ticket / Complaint Creation
- [ ] Should the AI auto-create a ticket in the system?
- [ ] Ticket fields? (type, severity, description, customer, related jobs?)
- [ ] Follow-up rules? (check back in 24h? 72h?)

### Tools Needed
| Tool Name | Action | Needs Approval? | Notes |
|-----------|--------|-----------------|-------|
| `create_ticket` | Create support ticket | No | Auto-execute |
| `escalate_to_human` | Hand off to human | No | Auto-execute |
| `priority_flag` | Flag conversation as urgent | No | Auto-execute |
| `send_human_notification` | Alert human operator | No | New? |

### Context Mutations Emitted
| Mutation | entity_type | When | Consumed By |
|----------|-------------|------|-------------|
| `created_entity` | `ticket` | After ticket creation | — |
| `updated_entity` | `conversation` | After handoff | — |

---

## 6. ProactiveAgent

**Domain:** Maintenance reminders, follow-ups, seasonal suggestions  
**Model:** `gpt-4o-mini` | **Min Confidence:** `0.4`

### Workflow Questions

#### 6.1 Maintenance Reminders
- [ ] What equipment types get reminders? (AC, heating, water heaters, etc.)
- [ ] Maintenance intervals per equipment type? (6 months? 12 months? seasonal?)
- [ ] How does the AI know what equipment a customer has? (from job history? explicit record?)
- [ ] What triggers the reminder? (cron job? customer profile check? seasonal date?)

#### 6.2 Follow-Up After Service
- [ ] How long after a job should the AI follow up? (24h? 72h? 1 week?)
- [ ] What does the follow-up message look like? ("¿Cómo quedó todo?")
- [ ] Should follow-up frequency depend on job type? (complex job → more follow-up?)
- [ ] What happens if the customer reports an issue in the follow-up? (→ SchedulingAgent? → EscalationAgent?)

#### 6.3 Seasonal Campaigns
- [ ] Does the AI send pre-season reminders? (e.g., AC checkup before summer?)
- [ ] Which seasons map to which services in Argentina?
  - [ ] October-November → AC prep?
  - [ ] March-April → heating prep?
- [ ] Should the AI personalize based on past services, or send generic campaigns?

#### 6.4 Suggestion Fatigue / Spam Prevention
- [ ] Maximum proactive messages per customer per week? Per month?
- [ ] If customer dismisses N suggestions in a row, pause for how long? (7 days? 30 days?)
- [ ] Can customers opt out of proactive messages entirely?
- [ ] Are there time-of-day restrictions? (no messages before 8am or after 9pm?)

### Tools Needed
| Tool Name | Action | Needs Approval? | Notes |
|-----------|--------|-----------------|-------|
| `create_suggestion` | Create proactive suggestion | No | |
| `send_reminder` | Send WhatsApp message | Yes | |
| `check_equipment` | Look up customer equipment | No | |
| `check_suggestion_fatigue` | Query dismissal history | No | New? |

### Context Mutations Emitted
| Mutation | entity_type | When | Consumed By |
|----------|-------------|------|-------------|
| `created_entity` | `suggestion` | After creation | — |

---

## 7. GeneralAgent

**Domain:** Greetings, FAQs, business hours, pricing info, fallback  
**Model:** `gpt-4o-mini` | **Min Confidence:** `0.4`

### Workflow Questions

#### 7.1 Greetings & Farewells
- [ ] What tone should the AI use? (formal, casual, voseo, mixed?) The AI should have a friendly and professional argentinian tone to start but it should learn accross multiple interactions the tone of the user and adapt to it. The AI should also have a memory of the user's tone and adapt to it in future interactions. The AI's tone should be adapted to the region of the customer depending on the area code of the customer's phone number. The AI should be able to switch between tones depending on the context. For example if the user is angry the AI should be more formal and professional. If the user is casual the AI should be more casual. Also in the dashboard/settings, the owner should be able to configure the tone of the AI for both the customer and the technicians. It has to be noted that the tone that is configured is for the customer and the technicians but not for the owner. The reason for this is that only the users of the WhatsApp AI copilot will be mainly the owner and admin. The owner could be upbeat but he would want a tone friendly for the customers and maybe more formal for the technicians. I believe the role "admin" in the system is able to assign whatsapp conversations to technicians on the app this way
- [ ] Should the tone vary by time of day? ("Buenos días" vs. "Buenas tardes")
- [ ] Does the first message include a self-identification? ("Soy el asistente de [Org Name]")
- [ ] Should the AI use the customer's name if known?

#### 7.2 FAQs
- [ ] What questions does the AI need to answer without tools? Define the list:
  - [ ] Business hours?
  - [ ] Service area / coverage zones?
  - [ ] Accepted payment methods?
  - [ ] Emergency contact?
  - [ ] What services are offered?
  - [ ] Company address?
- [ ] Are FAQs per-organization (each org has different hours/services) or global?
- [ ] Where is FAQ content stored? (database? prompt? knowledge base?)

#### 7.3 Pricing Info
- [ ] Can the AI share prices? (exact? ranges? "depends on inspection"?)
- [ ] Is pricing public or confidential?

#### 7.4 Unknown Intent Fallback
- [ ] What does the AI say when it doesn't understand? ("No entendí, ¿podés reformular?")
- [ ] After N consecutive failures, should it escalate to human?
- [ ] Should it suggest options? ("¿Querés agendar un turno, hacer una consulta, o hablar con alguien?")

### Tools Needed
| Tool Name | Action | Needs Approval? | Notes |
|-----------|--------|-----------------|-------|
| (none) | Responds from prompt/knowledge | No | No tools needed |

### Context Mutations Emitted
None — GeneralAgent is stateless and conversational.

---

## Cross-Domain Design Questions

These questions affect multiple sub-agents and the orchestrator:

### Intent Taxonomy
- [ ] Complete list of all intents across all categories (for the classifier)
- [ ] Ambiguous intents — which agent gets them? Examples:
  - "¿Cuánto cuesta?" → FinancialAgent or GeneralAgent?
  - "Necesito un técnico urgente" → SchedulingAgent or EscalationAgent?
  - "Quiero cambiar el horario" → SchedulingAgent or generalized question?
- [ ] Intent overlap resolution rules (priority order? context-dependent?)

### Multi-Intent Chain Dependencies
- [ ] Which intent pairs commonly occur together?
  - Customer + Scheduling ("Crear cliente y agendar")?
  - Scheduling + Financial ("Agendar y enviar presupuesto")?
  - Others?
- [ ] Which pairs can run in parallel vs. must be sequential?
- [ ] Are there cross-domain *conflicts*? (e.g., FleetAgent says technician available, but SchedulingAgent says time slot full)

### Shared Business Rules
- [ ] Business hours — when is the AI available? (24/7? business hours only? configurable per org?)
- [ ] Language rules — formal/informal? voseo always? customer-matching?
- [ ] Approval requirements — which actions across all agents need human approval?
- [ ] Notification rules — which agent actions trigger WhatsApp notifications to customers?

---

## Cross-References to Main Plan

> The answers to the questions above will require updates to specific sections of  
> [`AI_COPILOT_LANGGRAPH_UNIFICATION.md`](./AI_COPILOT_LANGGRAPH_UNIFICATION.md).  
> This section maps each dependency explicitly.

### 1. Sub-Agent Registry (Lines ~132-196)
**Depends on:** All category sections above  
**What needs updating:**
- `intents` list per agent — finalized from intent taxonomy answers
- `tools` list per agent — finalized from tools tables above
- `requires_approval_for` — finalized from approval answers
- `min_confidence` — may be adjusted based on domain risk assessment
- `model` — may change if a domain needs less/more reasoning power

### 2. Domain Prompt Files (Lines ~435-451)
**Depends on:** Tone, FAQ content, business rules per category  
**What needs updating:**
- The stub `.md` files (`prompts/scheduling.md`, etc.) need full content:
  - Domain-specific system prompt in es-AR
  - Example input/output pairs (few-shot)
  - Guardrails and forbidden actions
  - Argentine-specific rules (CUIT, IVA, holidays, voseo)

### 3. Intent Taxonomy (What's Still Needed §3, Lines ~1767)
**Depends on:** Cross-domain intent taxonomy answers  
**What needs updating:**
- Exhaustive intent list per agent
- Ambiguity resolution rules
- Multi-intent chain dependencies defined

### 4. Tool Registry & Approval Matrix (Phase C, Lines ~1100-1200)
**Depends on:** Tools tables from each category  
**What needs updating:**
- `AIToolCategory` enum — finalized tool list
- Per-tool metadata (description, parameters, approval requirement)
- `get_tools_for_intent` mapping — which tools each intent can access

### 5. Evaluation Datasets (Phase A-Eval, Lines ~660-720)
**Depends on:** All workflow questions  
**What needs updating:**
- Golden test cases per agent (need real-world scenarios)
- Edge cases specific to each domain
- Cross-domain chain test scenarios
- `subagentCategory` field on `AIEvaluationDataset`

### 6. Proactive Engine Config (Phase D, Lines ~1400-1450)
**Depends on:** ProactiveAgent answers (§6)  
**What needs updating:**
- Maintenance interval rules
- Seasonal mappings for Argentina
- Suggestion fatigue parameters
- Time-of-day send restrictions

### 7. WhatsApp Notification Rules
**Depends on:** Cross-domain notification answers  
**What needs updating:**
- Which sub-agent actions trigger customer notifications
- Notification templates per action type
- Notification approval requirements

### 8. CopilotState Fields
**Depends on:** Cross-domain design answers  
**What needs updating:**
- `conversation_status` enum — if defined (optional, from review point 11)
- Any new fields needed by specific domain logic

---

## Workshop Process

### Recommended Order
1. **GeneralAgent** first — defines tone, language, and baseline behavior
2. **CustomerAgent** — core entity, outputs consumed by most other agents
3. **SchedulingAgent** — most common workflow, direct customer impact
4. **FinancialAgent** — depends on customer + scheduling outputs
5. **FleetAgent** — depends on scheduling data
6. **EscalationAgent** — cross-cuts all others
7. **ProactiveAgent** — depends on all historical data
8. **Cross-domain questions** — last, once individual agents are clear

### Per-Agent Workshop Format
For each agent:
1. Answer all checkbox questions (15-30 min)
2. Validate tools table and approval matrix
3. Write 3-5 example conversations (real WhatsApp messages)
4. Define 2-3 edge cases that should be handled gracefully
5. Update the cross-referenced sections in the main plan

---

*Version 1.0 - 2026-02-08*  
*Initial creation. Comprehensive sub-agent design questionnaire with 7 categories, cross-domain design questions, and explicit cross-references to AI_COPILOT_LANGGRAPH_UNIFICATION.md v4.1.*
