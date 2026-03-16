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

> 📌 **DESIGN DECISION (2026-02-19) — Relationship-Aware Context Loading:**  
> When booking a job for a customer, the AI MUST load and surface the customer's "full picture" — pending invoices, recent complaints, preferred technician, relationship score — before presenting slot options to the dispatcher. **The customer already knows their own history, and it would be unprofessional to book without awareness of outstanding issues.** This applies to all sub-agents loading entity context (see [Cross-Domain: Relationship-Aware Context Loading](#relationship-aware-context-loading-all-agents) below).

### Workflow Questions

#### 1.1 Job Booking Flow
- [x] What data is required to create a job? (customer, service type, time slot, technician, address, equipment?) → **Required:** `customerId` (must exist, searched first via CustomerAgent), `serviceType` (from org's `ServiceTypeConfig`), `scheduledDate` (date + time slot), `address` (from customer record or manually entered, with lat/lng for map & routing). **Required but can be deferred:** `technicianId` (can be assigned later by dispatcher, status stays PENDING). **Optional:** `estimatedTotal`/`estimatedPrice` (pricing can be added later — Deferred Itemization pattern), `pricingMode` (defaults to `FIXED_TOTAL`), `notes` (free-form), `vehicleId` (resolved via Technician-Vehicle Handshake), `visitCount` (defaults to 1, can be multi-visit). **The AI must NOT require all fields upfront** — it should guide the conversation progressively: Customer → Service → Date → Technician.
- [x] Can the copilot auto-assign a technician, or must the operator always choose? → **CONFIGURABLE.** Default: AI **suggests** 1-3 ranked technicians but the operator confirms. If the owner enables "Auto-assign" in `/settings/ai-assistant`, the AI picks the #1 ranked available technician autonomously for standard service types. Emergency or high-value jobs ($>100,000 ARS) always require operator confirmation regardless of setting. Solo-worker orgs (1 technician = the owner) should auto-assign by default.
- [x] If multiple technicians are available, how should the AI rank them? (closest, least busy, customer preference, skill match?) → **Weighted multi-factor ranking:** 1️⃣ **Skill match** (trade category must match service type — hard filter, not ranking), 2️⃣ **Customer preference** (from `CustomerAIProfile.preferredTechnicians`, inferred from ratings — highest weight: 0.35), 3️⃣ **Availability** (fewest jobs that day — weight: 0.25), 4️⃣ **Proximity** (closest to job address, using vehicle GPS or home base — weight: 0.20), 5️⃣ **Rating** (technician's average rating — weight: 0.15), 6️⃣ **Recency** (prefer techs who haven't worked in a while for fair distribution — weight: 0.05). Presented as: "Sugiero a Pedro (⭐ 4.8, 2 trabajos hoy, 3km del cliente) o a María (⭐ 4.6, sin trabajos hoy, 7km). ¿Cuál preferís?"
- [x] What happens if no technician is available? (waitlist? suggest different date? suggest different service area?) → **3-step fallback:** 1) Suggest the **next available slot** (same technician, different day), 2) Suggest a **different technician** if one is available sooner, 3) Offer to create the job as **PENDING** (no technician assigned — "Creo el trabajo para esa fecha y lo asigno cuando haya técnico disponible. ¿Dale?"). Never suggest a "different service area" — the org covers what it covers. If it's urgent, escalate to dispatcher: "No hay técnicos disponibles para mañana. ¿Querés que le avise al equipo para ver si alguien puede cubrir?"
- [x] Should the AI check for scheduling conflicts with the customer (existing jobs on same day)? → **YES.** Check for jobs at the same address on the same day. Warn: "⚠️ Juan ya tiene un trabajo agendado para mañana a las 10:00 (instalación de gas). ¿Querés agendarlo igual?" Allow override since the customer may legitimately need two different services on the same day (e.g., electricista + gasista). Also check for CANCELLED jobs on that date and surface them: "Este cliente canceló un trabajo similar la semana pasada."
- [x] Are there time zones or regional considerations within Argentina? → **SINGLE TIMEZONE.** All of Continental Argentina uses `America/Argentina/Buenos_Aires` (UTC-3, no DST). The platform enforces this via `getBuenosAiresNow()`. No multi-timezone logic needed. However, service-area considerations exist: orgs may not cover all of Argentina. The AI should validate that the job address falls within the org's declared coverage zone if one is configured.
- [x] Minimum lead time for bookings? (e.g., can't book for 30 minutes from now) → **CONFIGURABLE PER ORG.** Default: **2 hours** minimum lead time. The owner can adjust in settings (some emergency services like plomero/cerrajero might allow 30-minute lead times). If the requested time violates the minimum: "El turno más próximo es a las [time]. ¿Te va bien?" For emergency intents ("se me inundó", "no tengo gas"), bypass the minimum and flag as URGENT.

#### 1.2 Conflict Resolution
- [x] If the requested time is unavailable, how many alternatives should the AI present? (3? 5? next available only?) → **3 alternatives**, ordered chronologically. Format: "Ese horario no está disponible. Te ofrezco: 1️⃣ Mañana 14:00 (Pedro) 2️⃣ Pasado mañana 9:00 (Pedro) 3️⃣ Viernes 10:00 (María). ¿Cuál te queda mejor?" For busy weeks, offer the first 3 slots within the next 7 days. If nothing available within 7 days, extend to 14 and say so.
- [x] Should alternatives be limited to the same week, or span further out? → **PROGRESSIVE.** First try same week (Mon-Sat). If no slots, expand to next week with a transparent message: "Esta semana está completa. La próxima semana hay lugar el martes a las 9:00 y el jueves a las 14:00." Never go beyond 21 days without checking with the operator.
- [x] If the customer has a preferred technician, should the AI prioritize that over availability? → **YES, with gentle fallback.** Show preferred tech's slots first, even if that means a later date. But ALSO mention the earlier option: "Pedro (tu técnico preferido) tiene turno el jueves. Pero si necesitás antes, María puede ir mañana. ¿Qué preferís?" This respects the relationship while not hiding faster options.
- [x] How should the AI handle overlapping jobs? (reject? warn operator? allow with note?) → **WARN, never silently allow.** If a technician already has a job at the requested time: "⚠️ Pedro ya tiene un trabajo asignado de 10:00 a 12:00. ¿Querés asignarlo en paralelo o buscar otro horario?" Overlapping is ALLOWED with operator override (some services are quick, techs can juggle), but the AI must surface it visually. For multi-visit jobs, check ALL visit dates, not just the first one.

#### 1.3 Rescheduling
- [x] Can the copilot reschedule without operator approval? Under what conditions? → **APPROVAL REQUIRED for most cases.** Exceptions (auto-reschedule allowed): 1) Customer-initiated via WhatsApp ("podríamos cambiar para el jueves?") → auto-reschedule IF the new slot is available, 2) same-day time shift within 2-hour window (moved from 10:00 to 12:00). Always require approval for: technician change, date change >1 day out, multi-visit job reschedules. **Terminal states (COMPLETED, CANCELLED) are IMMUTABLE** — the AI must reject any reschedule attempt with: "⛔ Este trabajo ya fue completado/cancelado y no se puede modificar."
- [x] If a job is rescheduled, should the customer be notified automatically via WhatsApp? → **YES, always.** Auto-send via the `notify_customer` tool: "Tu turno de [service] fue reprogramado para el [new date] a las [new time]. Cualquier consulta, respondé a este mensaje." Include the technician name if assigned. If the reschedule was customer-initiated, confirm instead: "Listo, te cambié el turno para el [date]. ¿Algo más?"
- [x] Is there a maximum number of reschedules per job before escalation? → **YES, 3 reschedules.** After the 3rd reschedule, the AI should flag to the operator: "⚠️ Este trabajo fue reprogramado 3 veces. ¿Querés escalar o contactar al cliente directamente?" This prevents perpetual rescheduling abuse. The count is tracked on the Job model. Customer-initiated cancellations don't count toward this limit.
- [x] What data changes on reschedule? (just time? or also technician, equipment?) → **PRIMARILY time and date.** On reschedule: `scheduledDate` and `scheduledTime` always change. `technicianId` ONLY changes if the original tech isn't available at the new time (AI should ask: "Pedro no está disponible el jueves. ¿Le asigno a María o buscamos otro horario?"). `vehicleId` may change automatically via the Technician-Vehicle Handshake. `address`, `serviceType`, and `pricingMode` NEVER change on reschedule — those require a new job or explicit update.

#### 1.4 Cancellation
- [x] What are the valid cancellation reasons? (customer request, weather, technician unavailable, etc.) → **Enum of reasons:** `CUSTOMER_REQUEST` ("el cliente canceló"), `TECHNICIAN_UNAVAILABLE` ("técnico no disponible"), `WEATHER` ("clima adverso"), `DUPLICATE` ("trabajo duplicado"), `SCOPE_CHANGE` ("el alcance cambió"), `NO_RESPONSE` ("cliente no responde"), `OTHER` (free-text). The reason is stored on the Job record and is mandatory for audit purposes. The AI should ask for the reason: "¿Por qué se cancela? 1) Pedido del cliente 2) Técnico no disponible 3) Otro motivo."
- [x] Is there a cancellation policy? (e.g., <24h notice → fee?) → **CONFIGURABLE PER ORG.** Default: no cancellation fee (most Argentine trade services don't charge). However, orgs with Seña (deposit) enabled have a policy: if Seña was paid and cancellation is <24h before the scheduled time, the Seña may be retained (owner decides). The AI should surface the Seña status: "Este trabajo tiene una seña de $25,000 ya pagada. ¿Se retiene o se devuelve?"
- [x] Should cancelled jobs offer re-booking at the same time? → **YES, proactively.** "El trabajo fue cancelado. ¿Querés reagendar para la misma fecha u otro día?" This reduces churn. If the cancellation reason is CUSTOMER_REQUEST, offer but don't push. If it's WEATHER or TECHNICIAN_UNAVAILABLE, be proactive: "Reprogramamos para el [next available]. ¿Te va?"
- [x] Does cancellation trigger any financial events? (refund, credit note?) → **DEPENDS ON SEÑA STATUS.** If no Seña paid: no financial event, just status → CANCELLED. If Seña was paid: trigger FinancialAgent to handle refund/credit note/retention decision. If invoices were already generated: void or issue Nota de Crédito via AFIP. The SchedulingAgent emits a `deleted_entity` context mutation that the FinancialAgent consumes for these financial cascades. Cancellation sets `status = CANCELLED` (terminal, immutable — the job is never deleted, per "Cancellation over Deletion" policy).

#### 1.5 Availability Queries
- [x] "¿Qué turnos hay para mañana?" — What does the response format look like? (list? calendar? suggested single slot?) → **Grouped list by technician with time slots.** Format: "Mañana hay estos turnos disponibles: 👨‍🔧 **Pedro:** 9:00, 14:00, 16:00 👩‍🔧 **María:** 10:00, 15:00. ¿Cuál te va mejor?" For single-technician orgs, drop the grouping: "Mañana hay turno a las 9:00, 14:00 y 16:00." If the question is about a specific service type, filter by techs qualified for that trade.
- [x] Should availability be per-technician, per-service-type, or general? → **CONTEXTUAL.** If the conversation already established a service type (e.g., customer asked about "instalación de gas"), filter availability to gasistas only. If the conversation identified a preferred technician, show that tech's availability first. If it's a general query ("qué turnos hay"), show all available slots grouped by technician. The AI should use working memory to avoid re-asking context already provided.
- [x] Do specific services require specific technicians or equipment? → **YES.** Service type → Trade mapping is mandatory. Gas work requires a Gasista Matriculado (ENARGAS license), electrical requires an Electricista Matriculado, etc. The AI MUST filter by `TechnicianServiceType` or trade category — never suggest a plumber for electrical work. Equipment is tracked via Vehicle Inventory integration but is informational, not blocking (the tech knows what tools to bring).

#### 1.6 Relationship-Aware Context (Pre-Booking)

> ✅ **ANSWERED (2026-02-19):** The dispatcher MUST see the customer's full context before booking. The AI should proactively surface connected data so the dispatcher is never caught off-guard by something the customer already knows.

- [x] Should the AI surface pending invoices, complaints, and customer history before booking? → **YES, always.** The customer knows their own history — the dispatcher must too. It's unprofessional to book a new job for a customer with a $45,000 ARS unpaid invoice without the dispatcher being aware.
- [x] Should the AI suggest the customer's preferred technician if available? → **YES, prioritize when available.** Inferred from past job ratings and assignment history.
- [x] Should the AI warn the dispatcher about unresolved complaints? → **YES, as a visible note in the response.** E.g., "⚠️ Juan tiene un reclamo abierto del 12/02 sobre un seguimiento pendiente."
- [x] Should the AI show the customer's relationship score / loyalty tier? → **YES**, so the dispatcher can calibrate tone and urgency.
- [x] Should the AI show last service date and type? → **YES**, for continuity. E.g., "Último trabajo: reparación de AC, hace 6 meses (Técnico Pedro, ★★★★★)."

**Implementation:** This data comes from PostgreSQL JOINs (no graph database needed) via the sub-agent's `load_domain_context` node. A view like `v_customer_360` would aggregate: customers → jobs → invoices → ratings → complaints → ai_profiles.

**Example AI response with context:**
> "Hay turno mañana a las 9:00 y a las 14:00.  
> 📋 **Contexto de Juan García:**  
> • ⚠️ Factura pendiente: $45,000 (trabajo #1284, hace 45 días)  
> • ⚠️ Reclamo abierto del 12/02: seguimiento no realizado  
> • ⭐ Técnico preferido: Pedro (5★ en último trabajo)  
> • 📊 Cliente frecuente (8 trabajos, score 0.85)  
> ¿Le asigno a Pedro mañana a las 9:00?"

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
- [x] What fields are required vs. optional? (name, CUIT, phone, email, address, company name?) → **Required:** `name` (string), `phone` (with +54 prefix, validated via `PhoneInput`), `customerType` (defaults to `PARTICULAR`). **Optional but recommended:** `email`, `address` (via `AddressAutocomplete` with Google Places), `cuit` (B2B types only — CONSORCIO, INDUSTRIAL, CONSTRUCTORA require it), `notes` (free-form, also used for Lean Schema Bridge metadata). For B2B types, additional fields are captured via the Lean Schema Bridge into `notes`: Encargado, Razón Social, CUIT, Horario de acceso, Contacto de seguridad, etc. Currency is always ARS, country defaults to AR.
- [x] Can the AI create a customer from a WhatsApp message alone? (extract name + phone from context?) → **YES, with approval gate.** Phone is auto-captured from the WhatsApp sender metadata (guaranteed). Name extraction uses NLP from the conversation context (e.g., "Hola, soy Juan Pérez" or message signature). The AI should present: "¿Creo un cliente nuevo con estos datos? Nombre: Juan Pérez, Tel: +54 9 11 1234-5678" and wait for operator confirmation. **Never auto-create without approval** — the operator must validate to prevent duplicates. The AI should also run a quick `search_customer` by phone before proposing creation.
- [x] Should CUIT be validated immediately via Mod-11, or also checked against AFIP? → **TWO-STAGE validation.** Stage 1 (instant): Mod-11 algorithm validation (client-side, blocks invalid format). Stage 2 (optional, async): AFIP PADRON lookup via `lib/integrations/afip/client.ts` to verify the CUIT is active and retrieve the Razón Social. Stage 2 is a "nice to have" enhancement — don't block customer creation on AFIP being down. Show a "✅ Validado AFIP" or "⚠️ No verificado en AFIP" badge.
- [x] What happens with duplicate CUITs? → **WARN, don't block.** Show the existing customer record and ask: "¿Es el mismo cliente que [existing name]? Podés actualizar sus datos o crear uno nuevo." In Argentina, multiple contacts at the same CONSORCIO might share a company CUIT, so blocking would be overly restrictive. Log the potential duplicate for admin review.
- [x] What happens with duplicate phone numbers? (might be same person, different CUIT?) → **STRONG WARNING + search results.** Phone is the primary WhatsApp identifier, so duplicates are a high signal for the same person. Show: "⚠️ Ya existe un cliente con este número: [Name]. ¿Es el mismo?" with options to merge, update existing, or create separate. The AI should ALWAYS search by phone before creating.
- [x] Is there a customer "type" classification? (residential, commercial, industrial, government?) → **YES, mandatory.** Uses the `customerType` enum: `PARTICULAR` (default), `CONSORCIO`, `COUNTRY`, `BARRIO_PRIVADO`, `COMERCIO`, `INDUSTRIAL`, `INSTITUCIONAL`, `ADMINISTRADORA`, `CONSTRUCTORA`. Each type triggers different UI fields, operational behaviors (e.g., COUNTRY/CONSORCIO triggers digital credential prompts for technicians), and billing requirements (B2B types need CUIT/Razón Social for AFIP invoicing).
- [x] Default values — what should be auto-filled? (currency = ARS, country = AR, etc.) → **Auto-fill:** `currency = ARS`, `country = AR`, `customerType = PARTICULAR`, `phone prefix = +54 9`. For address, default province to the org's primary location. For B2B types, auto-set `taxRate = 21%` (IVA General). The AI should detect Argentine-format phone numbers and normalize them automatically.

#### 2.2 Customer Search
- [x] What fields can users search by? (name, CUIT, phone, address, email?) → **ALL OF THE ABOVE.** Search uses the Global Universal Search with accent-insensitive matching (via `unaccent`/NFD normalization). Fields: `name`, `phone`, `email`, `address`, `cuit` (from notes for B2B), `customerType`. The AI should interpret natural language: "buscame a Pérez" → search by name; "el cliente del 11-2345-6789" → search by phone.
- [x] How should fuzzy matching work? (e.g., "Juan García" vs. "García, Juan"?) → **Accent-insensitive + order-independent.** Uses the existing Hybrid Search Pattern: NFD Unicode decomposition + diacritic removal. "Garcia" matches "García". Name order should be flexible: "Juan García" and "García Juan" should both match. For phone numbers, strip all non-digit characters before comparison (so "11-2345-6789" matches "+5491123456789").
- [x] If multiple results match, how many should the AI show? Format? → **Show up to 5 matches**, ordered by relevance (exact phone match first, then name similarity). Format as a numbered list: "Encontré estos clientes: 1️⃣ Juan García - Tel: +54 9 11 1234-5678 (3 trabajos) 2️⃣ Juan Carlos García - Tel: +54 9 351 9876-5432 (1 trabajo). ¿Cuál es?" Include job count for disambiguation context. If >5 results, show top 5 and say: "Hay más resultados. ¿Podés darme más datos para acotar la búsqueda?"
- [x] Should the AI auto-select if there's exactly one match, or always confirm? → **AUTO-SELECT with confirmation.** If exactly one result: "Encontré a Juan García (+54 9 11 1234-5678, PARTICULAR, 5 trabajos). ¿Es este?" Wait for affirmative before proceeding. Never silently assume — even with one match, the dispatcher might be looking for someone else.

#### 2.3 Customer Updates
- [x] Which fields can the copilot update? (all? only contact info? never CUIT?) → **Contact info only without approval.** Updatable without approval: `phone`, `email`, `address`, `notes`. Updatable WITH approval: `name`, `customerType`. **NEVER updatable via AI:** `cuit` (requires manual verification), `organizationId` (tenant isolation). The AI should detect natural context: "anotá que el nuevo número de Juan es 351-xxx" → update phone.
- [x] Do updates require operator approval? → **DEPENDS ON FIELD.** Contact info updates (phone, email, address): No approval needed if initiated by the customer themselves ("cambié de número"). Name/type changes: Always require approval. All updates are logged in the audit trail. The AI should always confirm: "Actualicé el teléfono de Juan a +54 9 351 XXXX-XXXX. ¿Estaba bien?"
- [x] Should the AI detect when a customer's info might be outdated? (e.g., "nuevo número: 351-xxx") → **YES, via active-intent extraction.** During conversations, if the AI detects a phone number, email, or address that differs from the stored record, it should proactively suggest: "¿Quiere que actualice su número de teléfono a [new number]?" Also flag via `CustomerAIProfile` if the last interaction was >6 months ago for a "data freshness" review.

#### 2.4 CUIT Validation
- [x] Mod-11 validation only, or also AFIP online check? → **BOTH, staged.** Mod-11 is mandatory (instant, blocks obviously invalid CUITs). AFIP online check is optional/best-effort (may be slow or down). See 2.1 answer.
- [x] Should invalid CUITs block customer creation, or just warn? → **WARN for PARTICULAR customers, BLOCK for B2B.** Individuals (PARTICULAR) often don't have or need CUITs — they're "Consumidor Final". But CONSORCIO, INDUSTRIAL, CONSTRUCTORA, ADMINISTRADORA MUST have valid CUITs for AFIP invoicing (Factura A). An invalid CUIT on a B2B type should block creation with: "⛔ El CUIT ingresado no es válido. Verificá el número o dejá el campo vacío si es un consumidor final."
- [x] What about customers without CUIT? (Consumidor Final flow?) → **FULLY SUPPORTED.** Customers without CUIT are treated as "Consumidor Final" for AFIP purposes. Invoice type: Factura B (not A). No CUIT required in the customer record. The AI should not ask for CUIT unless the customer type is B2B or the owner explicitly requires it. For Consumidor Final invoices, use the generic CUIT `00-00000000-0` or the customer's DNI if available.

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
- [x] What data is needed? (customer, services, line items, quantities, labor hours?) → **Required:** `customerId`, `serviceType`, at least one line item (description + amount). **Optional but enriched:** labor hours (from `OrganizationLaborRate` matrix), materials (from org Pricebook), quantities, IVA breakdown, travel costs. The AI should use **Voice-to-Invoice extraction** if the input comes as a voice note — extract materials and labor from natural language ("usé 2 metros de caño de 3/4 y trabajé 4 horas"). For multi-visit jobs, estimates can be per-visit (`PER_VISIT`) or total (`FIXED_TOTAL`).
- [x] Does the AI auto-calculate totals (subtotal + IVA), or pull from a pricing table? → **BOTH.** Pull unit prices from the org's `PriceItem` catalog when available. If no catalog match, accept manual prices. Auto-calculate: `subtotal = Σ(qty × unitPrice)`, `ivaAmount = subtotal × ivaRate`, `total = subtotal + ivaAmount`. Apply the **Smart Rounding** service (`lib/services/smart-rounding.ts`) for cash-natural pricing (e.g., $14,950 → $15,000). Surface the **Rounding Drift** if it exceeds 0.1%.
- [x] What IVA rate(s) apply? (21%? 10.5%? exempt? depends on service?) → **DEPENDS ON SERVICE AND ORG.** Standard: **21% (IVA General)** for most services. **10.5% (IVA Reducido)** for construction/building work. **0% (Exento)** for Monotributo businesses (they don't charge IVA separately — it's included in their flat tax). The AI should check the org's fiscal status: if Responsable Inscripto → add IVA line. If Monotributo → total is final, no IVA line. This comes from `Organization.fiscalStatus` or AFIP credentials.
- [x] Should the AI generate the PDF immediately, or present a preview first? → **PREVIEW FIRST, always.** The AI presents a structured summary in chat: "Presupuesto para Juan García: • Instalación split 3000 frig: $120,000 • Cañería frigorífica: $25,000 • Subtotal: $145,000 + IVA 21%: $30,450 = **Total: $175,450** ¿Genero el PDF?" Only generate PDF on explicit approval. This prevents wasted document generation and gives the operator a chance to adjust.
- [x] What happens if a customer asks "¿Cuánto sale instalar X?" — does the AI quote on the spot or create a formal presupuesto? → **CONTEXTUAL.** If the org has the service in their Pricebook: give the price/range immediately (informational, not a formal quote). If the customer then says "dale, agenda" or "mandame el presupuesto": THEN create the formal Presupuesto with the `gen_quote_pdf` tool. For complex work without catalog pricing: "Depende de las características del trabajo. ¿Querés que coordine una visita de diagnóstico?"
- [x] Quote validity period? (7 days? 15 days? configurable per org?) → **CONFIGURABLE, default 15 days.** Argentine market reality: prices change rapidly due to inflation, so validity should be short. The owner sets the default in `/settings/financial`. The AI stamps the quote with: "Válido hasta el [date]. Pasada esa fecha, los precios podrían ajustarse." For high-inflation periods, the system may suggest shorter validity. The quote can be re-issued with updated prices if expired.

#### 3.2 Invoice Generation (Factura)
- [x] What triggers an invoice? (job completion? operator request? payment received?) → **JOB COMPLETION (Step 7 of the 8-step lifecycle).** The invoice is auto-generated after the technician completes the 4-step Mobile Handshake (Notes → Photos → Signature → Cobro). Once payment is confirmed (Step 4), the system auto-dispatches the Invoice PDF, Job Report, and Rating Link via WhatsApp. The AI Copilot can also generate invoices on-demand for the operator ("generá la factura del trabajo #1284"), but standard flow is automated.
- [x] Does the system need to integrate with AFIP for electronic invoicing (Factura Electrónica)? → **YES, mandatory for Responsable Inscripto orgs.** Uses the `lib/integrations/afip/client.ts` with AFIP Web Services (WSFE). CAE (Código de Autorización Electrónico) is requested from AFIP and stamped on the invoice. Monotributo orgs use simplified Factura C. The AFIP Worker (`afip-invoice.worker.ts`) handles the async generation. Punto de Venta (PV) is centralized per organization.
- [x] Invoice types? (A, B, C? depends on customer type?) → **YES, follows Argentine fiscal rules:** Factura **A** → Responsable Inscripto to Responsable Inscripto (B2B with CUIT). Factura **B** → Responsable Inscripto to Consumidor Final. Factura **C** → Monotributo to anyone. The AI determines the type automatically from `Organization.fiscalStatus` + `Customer.customerType`/CUIT. If the customer is PARTICULAR without CUIT → always Factura B.
- [x] Can a quote be converted to an invoice automatically? → **YES, with approval.** When a job linked to a Presupuesto reaches completion, the AI can suggest: "Este trabajo tenía un presupuesto de $175,450. ¿Genero la factura con los mismos ítems?" Price variance is checked — if the actual cost differs >10% from the estimate (Ley 24.240 guardrail via `validatePriceVariance`), the AI flags it for approval before invoicing.
- [x] Does the AI handle Nota de Crédito / Nota de Débito? → **YES.** Nota de Crédito: issued for cancellations, refunds, or price corrections on already-invoiced jobs. Nota de Débito: for additional charges or interest. Both require operator approval and AFIP authorization (CAE). The AI should suggest the correct type: "El trabajo fue cancelado. ¿Genero una Nota de Crédito por $175,450 para anular la factura?"

#### 3.3 Payment Status
- [x] What payment methods are tracked? (MercadoPago, bank transfer, cash, check?) → **THREE methods (no checks).** 1) **Efectivo (Cash):** Technician collects on-site, records amount in the Mobile Handshake Step 4. Purely administrative audit record ("dinero en mano"). 2) **MercadoPago (Digital):** System sends a payment link via WhatsApp. Async confirmation via `payment-webhook.worker.ts` → Expo Push Notification to technician. 3) **Transferencia Bancaria (Transfer 3.0):** Customer pays to org's CBU/CVU, technician records the reference number. All three are stored on the `Payment` model. The platform is SaaS "No Middleman" — funds go directly to the org, CampoTech never touches the money.
- [x] "¿Ya pagó Juan?" — What data does the AI access? (payment records? MercadoPago API?) → **Primary: `Payment` records in PostgreSQL** linked to the Job. The AI checks: payment status (PENDING, CONFIRMED, PARTIAL), amount, method, and date. For MercadoPago, the webhook updates the record automatically. The AI does NOT query MercadoPago API directly — it reads the synced local record. Response format: "Sí, Juan pagó $175,450 por transferencia el 15/02. Referencia: #ABC123." or "⚠️ Juan tiene un pago pendiente de $45,000 del trabajo #1284 (hace 45 días)."
- [x] Should the AI proactively flag overdue payments? → **YES, via ProactiveAgent integration.** Payments are flagged as overdue based on org-configured payment terms (default: 30 days). The ProactiveAgent scans daily and creates alerts: "💰 Cobros vencidos: 3 clientes con $187,000 pendientes (>30 días). ¿Querés que les mande un recordatorio?" The AI should surface overdue payments in the Relationship-Aware Context when the customer calls for a new booking.
- [x] What's the dunning sequence? (reminder → follow-up → escalation?) → **3-step sequence, configurable:** Step 1 (Day 30): Friendly WhatsApp reminder: "Hola [name], te recordamos que tenés un saldo pendiente de $[amount] del trabajo del [date]. ¿Necesitás que te mandemos los datos para la transferencia?" Step 2 (Day 45): Follow-up with payment options: "Todavía figura un saldo pendiente. Podés pagar por MercadoPago o transferencia. ¿Te mando el link?" Step 3 (Day 60+): Escalate to owner/admin: "⚠️ Deuda de $[amount] con [customer] hace 60 días. Requiere atención manual." The AI NEVER threatens or uses aggressive language — tone stays professional and helpful.

#### 3.4 Pricing Queries
- [x] Does a price list exist per organization? → **YES.** The `PriceItem` model stores per-org pricing catalogs (Pricebook). Pricebook includes: service description, unit price, trade category, and last-updated date. The owner manages this via `/dashboard/settings/pricing` or the AI can help build it: "Agregá 'Instalación de split' a $150,000." AI can also suggest prices based on market data from the owner's historical jobs.
- [x] Can the AI access service pricing directly, or does it need operator confirmation? → **DIRECT ACCESS for reads.** The `get_pricing` tool queries Pricebook without approval. The AI can share prices with customers per the org's `sharePricing` setting (see GeneralAgent 7.3). Creating or modifying prices always requires operator approval.
- [x] How does pricing vary? (by service type? by customer type? by region? by urgency?) → **Multi-dimensional:** 1) **By service type:** Each trade has its own rate matrix (gasista ≠ electricista). 2) **By pricing mode:** `FIXED_TOTAL` (one-time install), `PER_VISIT` (maintenance contracts), `HYBRID` (diagnosis + recurring). 3) **By customer type:** B2B (CONSORCIO, INDUSTRIAL) may have negotiated rates; VIP customers may get preferential pricing. 4) **By urgency:** Emergency surcharges are owner-configurable (e.g., +30% for weekend/after-hours). 5) **NOT by region** within Argentina (single-market pricing). The Price Variance Guardrail (10%, Ley 24.240) applies to all proposed-vs-estimated deviations.

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
- [x] Is there a fixed technician↔vehicle mapping, or is it flexible? → **THREE-LEVEL assignment hierarchy:** 1) **Permanent (Primary Driver):** Each technician has a default vehicle (`TechnicianVehicle.isPrimary`). 2) **Scheduled (Dynamic Shifts):** Weekly or seasonal overrides for vehicle rotation. 3) **Job-Specific Override:** Dispatcher can assign a different vehicle per job. The Technician-Vehicle Handshake resolves the effective vehicle at job creation: Job Override > Scheduled > Primary. Solo-worker orgs: typically 1 tech + 1 vehicle, always auto-paired.
- [x] What criteria determine assignment? (location, skills, certifications, vehicle type?) → **Vehicle suitability + technician certification.** Criteria: Does the vehicle carry the right tools/inventory for the service type? Does the technician have the correct driving license category (B1, B2, C, D1)? Is the vehicle's VTV current? Is insurance valid? The AI should not assign a vehicle with expired VTV or insurance — flag: "⚠️ La VTV de la camioneta [plate] está vencida. ¿Le asigno otro vehículo?"
- [x] Can a technician have multiple vehicles? Can a vehicle have multiple technicians? → **YES to both.** A technician can have a primary vehicle and access to shared pool vehicles. A vehicle can be shared across shifts (morning: Tech A, afternoon: Tech B). The system tracks this via the `TechnicianVehicle` junction table with `isPrimary`, `startDate`, `endDate` for temporal assignments. The immutable **Snapshot Persistence** captures which vehicle/driver combo was used at job completion for forensic integrity.

#### 4.2 Sick Day / Absence Handling
- [x] "Juan está enfermo" — What should happen automatically?
  - [x] Find Juan's jobs for the day → **YES.** Query all jobs with `technicianId = Juan.id` and `scheduledDate = today` and status NOT in terminal states.
  - [x] Redistribute to available technicians (by what algorithm?) → **Same ranking algorithm as SchedulingAgent 1.1** (skill match → customer preference → availability → proximity → rating). Present a redistribution plan: "Juan tiene 4 trabajos hoy: 1️⃣ 9:00 García (gas) → Sugiero Pedro 2️⃣ 11:00 López (gas) → Sugiero Pedro 3️⃣ 14:00 Martínez (electricidad) → Sugiero María 4️⃣ 16:00 Fernández (gas) → Sugiero Pedro. ¿Apruebo estos reasignos?"
  - [x] Notify affected customers? → **YES, after operator approval of the redistribution.** Message: "Hola [name], te informamos que por un cambio operativo, tu turno de hoy será atendido por [new tech name]. El horario se mantiene. ¿Alguna consulta?"
  - [x] Notify other technicians? → **YES.** Via push notification to the reassigned technician's mobile app: "Te asignaron el trabajo de [customer] a las [time] (reasignado de Juan)." Include job details.
- [x] Should the AI suggest redistributions, or auto-execute with approval? → **SUGGEST with one-click approval.** The AI presents the full redistribution plan (as above) and waits for operator confirmation. One approval covers all reassignments. Never auto-execute without approval for sick-day scenarios — too many variables.
- [x] What about multi-day absences? → **Create an Availability Exception.** The AI uses the Unified Operational Calendar to block Juan for the requested dates. For each day with jobs, present the redistribution plan separately. Message: "Juan está de baja hasta el viernes. Tiene 12 trabajos en 3 días. ¿Querés que prepare un plan de redistribución para cada día?"

#### 4.3 Bulk Reschedule
- [x] What triggers bulk reschedule? (weather, vehicle breakdown, emergency?) → **PRIMARY:** Severe weather (forecast integration or manual trigger), vehicle breakdown (tech reports), technician emergency (personal/medical), public holiday overlap (calendar awareness). **SECONDARY:** Road closures, utility outages (power/water), social events (national strikes are common in Argentina — "paro nacional"). The AI should recognize natural language: "mañana hay paro, cancelá todo" → trigger bulk reschedule flow.
- [x] How many jobs constitute "bulk"? (threshold for requiring extra approval?) → **≥3 jobs = bulk.** 1-2 jobs: handled individually via SchedulingAgent. ≥3 jobs: triggers the FleetAgent's bulk flow with an aggregate approval gate. ≥10 jobs: extra warning — "⚠️ Esto afecta 10+ trabajos y clientes. ¿Estás seguro?"
- [x] Should the AI optimize the new schedule? (minimize travel time? maintain customer preferences?) → **YES, optimization with priorities.** Order: 1) Maintain time-sensitive jobs (medical, emergency), 2) Preserve VIP customer slots, 3) Minimize technician travel distance, 4) Respect customer preferences. Present the optimized plan before execution.
- [x] Is there a priority system? (emergency jobs first, then VIP customers, then standard?) → **YES.** Tier 1: Emergency/urgent jobs (gas leaks, flooding, security). Tier 2: VIP customers (`isVip = true`). Tier 3: B2B customers (CONSORCIO, INDUSTRIAL — contractual obligations). Tier 4: Standard customers. When redistributing, Tier 1 gets the best slot, Tier 4 may get pushed further.

#### 4.4 Dispatch
- [x] Does the AI handle real-time dispatch, or is that pre-planned? → **BOTH.** Pre-planned: Jobs are scheduled via SchedulingAgent/dashboard in advance. Real-time: When an urgent job comes in or a technician finishes early, the AI can suggest dynamic dispatch: "Pedro terminó el trabajo de las 10:00 antes de tiempo. Tiene un hueco hasta las 14:00. ¿Le asigno el trabajo pendiente de Fernández que está a 2km?"
- [x] Route optimization? (shortest distance, fastest time, most jobs per route?) → **MINIMIZE TRAVEL TIME** as primary metric (traffic matters more than distance in Buenos Aires/GBA). Secondary: cluster geographically close jobs. The AI should suggest route order: "Recomiendo: 1) García (Palermo, 9:00) → 2) López (Belgrano, 11:00) → 3) Martínez (Núñez, 14:00). Distancia total: 15km." Future: Google Maps Directions API integration.
- [x] Integration with maps/GPS? → **YES, existing.** Job addresses include `lat/lng` coordinates from Google Places. Technician location is tracked via the mobile app's GPS (`real_time_tracking_infrastructure`). The map view (`/dashboard/map`) shows all active jobs and technician positions. The AI uses coordinates for proximity calculations but delegates visual routing to the map UI.

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
- [x] What frustration signals trigger escalation? (define thresholds)
  - [x] N messages without resolution → escalate? (what's N?) → **3 messages without resolution.** If the AI has attempted 3 responses and the customer's intent remains unresolved (assessed by either repeated rephrasing or explicit dissatisfaction), auto-escalate. This aligns with the GeneralAgent's 3-failure threshold.
  - [x] Explicitly asks for human ("quiero hablar con alguien") → **IMMEDIATE escalation, no counter.** If the customer says any variant of: "quiero hablar con alguien", "pasáme con una persona", "con el dueño", "basta de bot" → instant handoff. No persuasion, no "antes dejame intentar ayudarte". Respect the request immediately: "Entendido, ya le aviso a [name] para que te contacte. ¡Gracias por tu paciencia!"
  - [x] Sentiment < threshold for N consecutive messages → **Sentiment < -0.5 for 2 consecutive messages** (using real-time sentiment analysis from the `detect_sentiment` check in each turn). One angry message is tolerable (customer may be venting), but sustained negativity across 2 messages signals genuine frustration.
  - [x] Caps lock + repetition pattern → **YES.** Detect: all-caps messages, repeated messages (same text sent 2+ times), excessive punctuation ("!!!", "???"), or escalation keywords ("URGENTE", "INSERVIBLE", "DENUNCIA", "DEFENSA DEL CONSUMIDOR"). These are high-confidence frustration signals specific to Argentine communication patterns.
- [x] Are there severity levels? (low → log, medium → alert, high → immediate handoff?) → **YES, 3 tiers.** **LOW (Log):** Customer is mildly confused but not frustrated → log the interaction for quality review, AI continues. **MEDIUM (Alert):** Customer shows frustration OR topic is financial (disputes, overcharges) → send dashboard notification to owner, AI continues but offers human handoff. **HIGH (Immediate Handoff):** Customer explicitly requests human, mentions legal action ("Defensa del Consumidor"), reports a safety emergency, or sentiment triggers are met → immediate human handoff, no AI continues.

#### 5.2 Human Handoff Protocol
- [x] Where does the handoff go? (WhatsApp group? dashboard notification? email? phone call?) → **PRIMARY: Dashboard real-time notification** (toast + badge counter on `/dashboard`). **SECONDARY: WhatsApp message to the owner's personal number** (ensures visibility even when not at the computer). The notification includes: customer name, phone, conversation summary (last 5 messages), AI's assessment, and a "Take Over" button. Email is used only for after-hours (see below). Phone call: only for EMERGENCY tier.
- [x] What context does the human receive? (conversation summary, customer profile, AI's assessment?) → **FULL CONTEXT PACKAGE:** 1) **Conversation summary:** Last 5-10 messages with timestamps, 2) **Customer profile:** Name, phone, type, relationship score, VIP status, pending invoices, 3) **AI's assessment:** Detected intent, sentiment scores, escalation reason, 4) **Related entities:** Any jobs, quotes, or complaints referenced in the conversation, 5) **Suggested actions:** What the AI thinks the human should do (e.g., "El cliente tiene una factura pendiente de $45,000 — podría estar relacionado").
- [x] Can the AI resume after human resolution, or is the conversation "handed off" permanently? → **RESUMABLE.** The human resolves the issue and clicks "Return to AI" in the dashboard. The AI resumes with the resolution context injected into memory: "[Owner name] resolvió tu consulta. ¿Puedo ayudarte con algo más?" If the customer re-contacts after the human left and the issue recurs, the AI has the resolution history and can reference it. The conversation is NEVER permanently handed off — the AI is always the default handler.
- [x] What happens outside business hours? (queue? auto-response? emergency-only handoff?) → **Governed by the org's AI Response Window configuration** (see [Cross-Domain: AI Availability & Action Permissions](#shared-business-rules)). If the AI is configured to respond outside hours (`ALWAYS` or `OUTSIDE_HOURS_ONLY`), it responds within its configured action permissions — nothing more. If the AI is NOT active during that window, the message goes to the human inbox and the dashboard shows it the next morning. The AI does NOT bypass its configuration for any reason, including perceived emergencies. If the org wants after-hours coverage, they enable the response window for it. **CampoTech does not guarantee response times for any org's customers** — we are the platform, not the service provider.

#### 5.3 Emergency Handling
- [x] What constitutes an emergency vs. a complaint? (gas leak vs. slow service?) → **Distinction exists, but the AI treats both within its configured permissions.** The AI can distinguish between urgent language ("fuga de gas", "se me inundó") and complaints ("el técnico no vino", "me cobraron de más") for internal classification purposes (dashboard priority flagging, ticket severity). However, **the AI NEVER gives safety advice, emergency instructions, or medical/safety recommendations.** CampoTech is a SaaS platform — we are not qualified to give safety instructions, and wrong advice creates direct liability. There are hundreds of possible emergency types across dozens of trades, and we cannot anticipate them all correctly. The AI's response to urgent language is the same as any other message: process it within the org's configured action permissions. If the org has `escalate_to_human` enabled, the AI can say "Entendido, le paso tu mensaje al equipo de forma urgente" and flag the conversation as high-priority in the dashboard. But it does NOT give instructions like "abrí las ventanas" or "llamá al 911" — that is the org's responsibility, not ours.
- [x] Emergency response time SLA? → **NO SLAs from CampoTech.** CampoTech does not promise or guarantee any response times to the org's customers. We are the platform, not the service provider. The org may choose to set internal response time targets for their own dashboard analytics, but these are their commitments, not ours. The AI must NEVER tell a customer "te contactamos en X minutos" — we can't guarantee the org will respond. The AI can say: "Tu mensaje quedó registrado" (factual) but NOT "ya le avisé al dueño" (promise we can't verify was received/acted on).
- [x] Does the AI have a different tone for emergencies? (more direct, less casual?) → **Slightly more direct, but NO safety advice.** For messages flagged as urgent by keyword detection, the AI can adopt a more direct, concise tone (drop emojis, skip small talk). Example: "Entendido. Le paso tu mensaje al equipo de forma prioritaria." But it must NOT: 1) Give safety instructions of any kind, 2) Promise a specific response time, 3) Claim it's "notifying" someone (we can't guarantee delivery), 4) Override the org's configured action permissions. The emergency/urgency classification is used for **internal dashboard prioritization only** (a red badge vs. a normal badge) — it is NOT an AI behavior override.

#### 5.4 Ticket / Complaint Creation
- [x] Should the AI auto-create a ticket in the system? → **YES, automatically for all MEDIUM and HIGH escalations.** LOW-severity issues are logged but don't generate tickets. The ticket is created in the CRM as a `SupportTicket` linked to the customer and conversation. The AI confirms: "Quedó registrado tu reclamo (#TKT-1234). Te vamos a contactar para resolverlo."
- [x] Ticket fields? (type, severity, description, customer, related jobs?) → **Fields:** `type` (COMPLAINT, INQUIRY, EMERGENCY, FEEDBACK), `severity` (LOW, MEDIUM, HIGH), `description` (AI-generated summary of the issue, max 500 chars), `customerId`, `organizationId`, `relatedJobIds[]` (auto-linked if the conversation references specific jobs), `conversationId` (link to full WhatsApp thread), `assignedTo` (defaults to owner), `status` (OPEN, IN_PROGRESS, RESOLVED, CLOSED), `createdAt`, `resolvedAt`.
- [x] Follow-up rules? (check back in 24h? 72h?) → **CONFIGURABLE, default 48h.** After a ticket is created, the ProactiveAgent schedules a follow-up check: "Hola [name], ¿se resolvió el tema de [ticket description]? Queremos asegurarnos de que quedó bien." If resolved: close ticket. If not: re-escalate to owner. The follow-up interval depends on severity: HIGH → 24h, MEDIUM → 48h, LOW → 72h. Maximum follow-ups: 3 before flagging as "Requires owner attention".

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
- [x] What equipment types get reminders? (AC, heating, water heaters, etc.) → **Trade-specific equipment list:** • **HVAC:** Aires acondicionados (split, central), calefacción (radiadores, piso radiante, estufas a gas), ventilación. • **Plumbing:** Termotanques, calefones, bombas de agua, tanques de agua. • **Gas:** Calefactores, cocinas, hornos, calderas (require annual inspection by ley). • **Electrical:** Puesta a tierra, tableros eléctricos, disyuntores (recommended annual check). • **Fumigación:** Periodic pest control (regulatory for restaurants/CONSORCIO). Equipment is inferred from job history — no separate equipment registry needed initially.
- [x] Maintenance intervals per equipment type? (6 months? 12 months? seasonal?) → **Service-specific defaults:** AC: pre-season (October before summer, April before winter) = effectively 6 months. Gas appliances: **12 months** (ENARGAS mandatory annual revision). Water heaters: 12 months (descaling). Pest control: depends on customer type (CONSORCIO → quarterly, PARTICULAR → 6-12 months). These are defaults; the owner can customize intervals per service type in `/settings/services`.
- [x] How does the AI know what equipment a customer has? (from job history? explicit record?) → **FROM JOB HISTORY.** The AI scans completed jobs for the customer and infers equipment: "Juan tuvo una instalación de split en enero 2025 → remind about AC maintenance in October 2025." Future enhancement: explicit equipment registry per customer. For now, `JobLineItem` descriptions + `serviceType` are the data source.
- [x] What triggers the reminder? (cron job? customer profile check? seasonal date?) → **DAILY CRON JOB** (`proactive-reminders.cron.ts`). The cron runs at 8am Argentina time, scans all customers with completed jobs, calculates days since last service, and generates `ProactiveSuggestion` records for any that exceed the maintenance interval. The ProactiveAgent then reviews these suggestions and sends approved ones as WhatsApp messages during business hours.

#### 6.2 Follow-Up After Service
- [x] How long after a job should the AI follow up? (24h? 72h? 1 week?) → **72 hours after completion.** Not too soon (customer needs time to use the service) and not too late (experience is still fresh). Exception: emergency/urgent jobs → 24h follow-up. Multi-visit jobs → follow up after the LAST visit, not each one. This is separate from the Rating Link (which is sent immediately on completion).
- [x] What does the follow-up message look like? ("¿Cómo quedó todo?") → **Personalized and brief:** "Hola [name], te escribimos de [org]. Queríamos saber si quedó todo bien con el trabajo de [service type] del [date]. ¿Algún comentario o algo que podamos mejorar?" Tone: warm, not pushy. If the customer already submitted a rating, skip the follow-up or adjust: "Vimos que nos dejaste una reseña, ¡gracias! ¿Hay algo más que necesites?"
- [x] Should follow-up frequency depend on job type? (complex job → more follow-up?) → **YES.** Simple/one-time jobs (unclog drain, light fixture): single follow-up at 72h. Complex/multi-visit (AC installation, electrical rewiring): follow-up after each major milestone AND after final visit. High-value (>$100,000 ARS): additional check-in at 30 days for long-term satisfaction.
- [x] What happens if the customer reports an issue in the follow-up? (→ SchedulingAgent? → EscalationAgent?) → **DEPENDS ON SEVERITY.** Minor issue ("queda un ruidito"): → SchedulingAgent to book a warranty follow-up visit. Major issue ("no funciona", "se rompió"): → EscalationAgent to create a HIGH-severity ticket + immediate owner notification. Compliment ("quedó perfecto"): → No escalation, store positive signal in `CustomerAIProfile.positiveInteractions` and suggest the rating link if not already submitted.

#### 6.3 Seasonal Campaigns
- [x] Does the AI send pre-season reminders? (e.g., AC checkup before summer?) → **YES, critical for Argentine service businesses.** Pre-season campaigns are a major revenue driver. The AI generates bulk campaign suggestions 30-45 days before the season starts, targeting customers with matching equipment history.
- [x] Which seasons map to which services in Argentina?
  - [x] October-November → AC prep? → **YES.** "Verano se acerca. ¿Querés que revisemos tu aire acondicionado antes de que pegue el calor?" Also: pool preparation, outdoor electrical, pest control.
  - [x] March-April → heating prep? → **YES.** "Se viene el frío, ¿hacemos el service de la calefacción?" Also: caldera/calefactor inspection, chimney cleaning, gas system check (ENARGAS annual). Winter = gas season in Argentina.
  - **Additional mappings:** June-July → mid-winter emergency reminders ("tener a mano el contacto de un gasista"), September → electrical system check before storms, December → plumbing check before holidays (nobody wants a broken pipe on Christmas).
- [x] Should the AI personalize based on past services, or send generic campaigns? → **ALWAYS PERSONALIZE.** Generic campaigns feel spam-like. The AI should reference the customer's specific history: "¡Hola Juan! El próximo mes se cumple un año desde que Pedro te instaló el split en la oficina. ¿Agendamos el mantenimiento preventivo? 😊" vs. generic: "Es época de service de aire." Customer-specific context increases conversion and builds trust.

#### 6.4 Suggestion Fatigue / Spam Prevention
- [x] Maximum proactive messages per customer per week? Per month? → **1 message per week max, 3 per month max.** This prevents the org from becoming "that annoying WhatsApp business." Exception: direct responses to ongoing conversations don't count toward these limits (only outbound proactive messages count). VIP customers and B2B CONSORCIO may have higher tolerance (2/week, 5/month) if they opt in.
- [x] If customer dismisses N suggestions in a row, pause for how long? (7 days? 30 days?) → **3 dismissals → 30-day pause.** After 3 consecutive dismissed/ignored proactive messages (no response within 48h = implicit dismissal), the system pauses all proactive outreach for 30 days. After the pause, try ONE more message. If dismissed again → flag as "proactive opt-out" and only contact reactively (when they reach out first).
- [x] Can customers opt out of proactive messages entirely? → **YES, mandatory.** Per Argentine consumer protection (Ley 24.240): the customer can opt out anytime by replying "NO" or "BASTA" or similar. The AI should recognize opt-out keywords and immediately confirm: "Entendido, no te vamos a enviar más mensajes proactivos. Si necesitás algo, podés escribirnos cuando quieras." Store `optOutProactive = true` in `CustomerAIProfile`. The owner can see opt-out status in the CRM.
- [x] Are there time-of-day restrictions? (no messages before 8am or after 9pm?) → **YES, strict.** No proactive messages before **9:00** or after **20:00** (Argentina time). These are the WhatsApp-acceptable hours. Emergency notifications bypass this (customer safety > timing). Business hours for proactive campaigns are narrower: **10:00-18:00** (when people are most receptive). Weekend messages: only Saturday 10:00-14:00, never Sunday (Argentine cultural respect for Sunday rest).

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
- [x] What tone should the AI use? (formal, casual, voseo, mixed?) → **Adaptive voseo with configurable base.** The AI starts with a friendly, professional Argentine tone using voseo ("vos") by default. Over multiple interactions it learns each user's communication style via `CustomerAIProfile.preferredFormality` and adapts. Regional adaptation uses the customer's phone area code (e.g., 011=CABA tends more neutral, 351=Córdoba more casual, 261=Mendoza, etc.). Context-reactive switching: angry customer → more formal/empathetic, casual customer → mirror their energy. **Owner-configurable via Dashboard `/settings/ai-assistant`**: the owner sets a single base tone that shapes how the AI communicates with **customers** via WhatsApp. This tone does NOT affect the Copilot sidebar (the internal AI assistant for the owner/admin — they interact with it directly, not through the customer-facing persona). An owner might be upbeat in their own style but want courteous formality toward customers.
- [x] Should the tone vary by time of day? ("Buenos días" vs. "Buenas tardes") → **YES.** Use Argentina timezone (`America/Argentina/Buenos_Aires`, UTC-3, via `getBuenosAiresNow()`). Greetings: 6:00-12:00 → "Buenos días", 12:00-19:00 → "Buenas tardes", 19:00-23:59 → "Buenas noches". Between 00:00-06:00 → "Hola" (neutral, since contacting at these hours implies urgency — no cheerful greeting). The AI should never say "Buenos días" at 10pm, even if the server is in a different timezone.
- [x] Does the first message include a self-identification? ("Soy el asistente de [Org Name]") → **YES, when the AI is enabled and auto-responding.** This answer is conditional on the organization having the AI auto-response feature turned on (see [Cross-Domain: AI Availability & Action Permissions](#shared-business-rules) below). If the org has AI disabled, no auto-response occurs at all — messages go to the human inbox. If AI IS enabled: on **first contact per session**, the AI MUST identify itself: "¡Hola! Soy el asistente virtual de **[Organization.name]**. ¿En qué te puedo ayudar?" This is a **regulatory requirement** per Argentine AI Transparency rules (Res 424) — the customer must know they are interacting with a bot. If the conversation is resumed (customer returns within the same session window), skip the self-identification and greet more casually: "¡Hola de nuevo, [name]!" **Key nuance:** some orgs may configure the AI to respond ONLY outside business hours (to capture leads while the office is closed). In that case, the self-identification only triggers during those after-hours windows — during business hours the human team responds directly and no bot greeting is sent.
- [x] Should the AI use the customer's name if known? → **YES, always when available.** Pull from the matched `Customer.name` via phone number lookup. Use first name only for warmth: "Hola Juan, ¿cómo andás?" If the customer is not in the database yet (new WhatsApp contact), use a neutral greeting until context is established. Once the name is learned, store it and use it in future interactions. For B2B customers (CONSORCIO, INDUSTRIAL), use the contact person's name, not the entity name.

#### 7.2 FAQs
- [x] What questions does the AI need to answer without tools? Define the list:
  - [x] Business hours? → **YES.** Sourced from `AIConfiguration.businessHours` (per-org). Format: "Atendemos de lunes a viernes de 8:00 a 18:00." If outside hours, add: "En este momento estamos fuera de horario, pero podés dejarnos tu consulta y te respondemos mañana a primera hora."
  - [x] Service area / coverage zones? → **YES.** From `AIConfiguration.services` or org settings. E.g., "Cubrimos CABA, GBA Norte y GBA Oeste."
  - [x] Accepted payment methods? → **YES.** Standard list: Efectivo, MercadoPago, Transferencia bancaria. Pulled from org payment configuration. Note: mention "Seña del 50% para trabajos con materiales" if org has deposits enabled.
  - [x] Emergency contact? → **YES.** From `AIConfiguration.companyInfo` or org contact. "Para emergencias fuera de horario, podés llamar al [phone]."
  - [x] What services are offered? → **YES.** From `ServiceTypeConfig` entries for the org. List active service types with friendly names.
  - [x] Company address? → **YES.** From `Organization.address`. Include a Google Maps link if coordinates are available.
- [x] Are FAQs per-organization (each org has different hours/services) or global? → **PER-ORGANIZATION.** Each org has its own business hours, services, coverage area, and payment methods stored in `AIConfiguration`. Platform-level FAQs ("¿Qué es CampoTech?", plan pricing) exist separately and are only relevant for the Public Chat (Tier 1), never for Copilot (Tier 2). The GeneralAgent in the Copilot always answers in the context of the specific organization.
- [x] Where is FAQ content stored? (database? prompt? knowledge base?) → **PRIMARY: `AIConfiguration` model in PostgreSQL** (per-org, owner-editable via `/settings/ai-assistant`). **SECONDARY: Domain prompt file** (`prompts/general.md`) contains the static platform knowledge and conversation patterns. The GeneralAgent's `load_domain_context` node fetches org-specific FAQ data at the start of each conversation and injects it into the system prompt. No separate vector database or RAG pipeline needed — the FAQ corpus is small enough (<2000 tokens) to fit directly in context.

#### 7.3 Pricing Info
- [x] Can the AI share prices? (exact? ranges? "depends on inspection"?) → **CONFIGURABLE PER ORG.** Default behavior: share **ranges** from the `PriceItem` catalog (e.g., "Una instalación de split arranca desde $150,000 ARS, dependiendo del equipo y la ubicación"). If the owner enables exact pricing in settings, share specific `PriceItem.price` values. For complex work (plumbing, electrical), always add the caveat: "El precio final depende de la visita de diagnóstico." The AI should NEVER invent prices — it must pull from the org's Pricebook or explicitly say it doesn't have that information. For trades that charge hourly/per-m² (painting, masonry), share the rate but explain the formula: "El precio de pintura es $X por m². ¿Cuántos metros cuadrados necesitás?"
- [x] Is pricing public or confidential? → **OWNER DECIDES.** Default: semi-public (share ranges, not exact margins). The `AIConfiguration` should include a `sharePricing` toggle: `always` (share exact prices), `ranges` (approximate ranges from Pricebook), `inspection_only` (always redirect to diagnostic visit). The AI must respect this setting. Internal margin data, labor cost breakdowns, and technician commissions are ALWAYS confidential — never shared with customers.

#### 7.4 Unknown Intent Fallback
- [x] What does the AI say when it doesn't understand? ("No entendí, ¿podés reformular?") → **YES, with empathetic framing.** First attempt: "Disculpá, no estoy seguro de haber entendido bien. ¿Podés reformularlo de otra manera?" Second attempt: "Parece que no estoy captando lo que necesitás. ¿Querés que te conecte con alguien del equipo?" Always avoid making the customer feel at fault — the AI takes responsibility ("no estoy captando" not "no fuiste claro").
- [x] After N consecutive failures, should it escalate to human? → **YES, after 3 consecutive unresolved turns.** Definition of "failure": the AI's confidence remains below `min_confidence` (0.4) for 3 turns in a row, OR the customer explicitly expresses frustration, OR the customer sends the same question 3 times. On the 3rd failure: auto-escalate to `EscalationAgent` which triggers the human handoff protocol. Message: "Veo que no estoy pudiendo ayudarte como necesitás. Ya le avisé a [Owner/Admin name] para que te contacte personalmente. ¡Disculpá las molestias!"
- [x] Should it suggest options? ("¿Querés agendar un turno, hacer una consulta, o hablar con alguien?") → **YES, on first failure and on initial greeting.** After the first misunderstood message, present a structured menu: "¿En qué te puedo ayudar? 1️⃣ Agendar o reprogramar un turno 2️⃣ Consultar precios o presupuestos 3️⃣ Estado de un trabajo 4️⃣ Hablar con alguien del equipo." This menu should also be offered proactively when the customer sends a vague opening message like "hola" or "necesito ayuda". The menu options map directly to sub-agent intents: 1→SchedulingAgent, 2→FinancialAgent/GeneralAgent, 3→SchedulingAgent, 4→EscalationAgent.

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
- [x] Complete list of all intents across all categories (for the classifier) → **FULL TAXONOMY:**
  - **SchedulingAgent:** `book_job`, `reschedule_job`, `cancel_job`, `check_availability`, `check_job_status`, `check_job_details`
  - **CustomerAgent:** `create_customer`, `search_customer`, `update_customer`, `validate_cuit`, `get_customer_profile`
  - **FinancialAgent:** `generate_quote`, `generate_invoice`, `check_payment_status`, `get_pricing`, `create_credit_note`, `send_payment_reminder`
  - **FleetAgent:** `assign_technician`, `handle_absence`, `bulk_reschedule`, `check_fleet_status`, `optimize_routes`
  - **EscalationAgent:** `escalate_to_human`, `create_ticket`, `handle_emergency`, `flag_urgent`
  - **ProactiveAgent:** `send_maintenance_reminder`, `follow_up_service`, `send_seasonal_campaign`, `check_suggestion_fatigue`
  - **GeneralAgent:** `greet`, `answer_faq`, `share_pricing_info`, `fallback_unknown`, `say_goodbye`
- [x] Ambiguous intents — which agent gets them? Examples:
  - "¿Cuánto cuesta?" → **CONTEXT-DEPENDENT.** If in an active booking conversation → FinancialAgent (formal quote context). If cold/opening message → GeneralAgent (informational pricing). Rule: if `working_memory` contains a `customer_id` or `job_id` → FinancialAgent. Otherwise → GeneralAgent.
  - "Necesito un técnico urgente" → **SchedulingAgent FIRST** with urgency flag. SchedulingAgent checks availability and books. If no availability within 2 hours → auto-escalate to EscalationAgent for emergency handoff. The SchedulingAgent handles the booking, the EscalationAgent handles the exception path.
  - "Quiero cambiar el horario" → **SchedulingAgent** always. This is a clear `reschedule_job` intent. If the conversation has a known job → reschedule that one. If ambiguous → "Decime el número de trabajo o el nombre del cliente para encontrarlo."
- [x] Intent overlap resolution rules (priority order? context-dependent?) → **CONTEXT-FIRST, then confidence, then priority.** Rule: 1) If `working_memory` contains relevant entity context (customer, job), route to the agent handling that entity. 2) If two agents score similarly on confidence, use this priority order: **EscalationAgent > SchedulingAgent > FinancialAgent > CustomerAgent > FleetAgent > ProactiveAgent > GeneralAgent** (safety and scheduling take priority). 3) If confidence for all agents is below `min_confidence` (0.4) → GeneralAgent fallback (which then offers the structured menu).

### Multi-Intent Chain Dependencies
- [x] Which intent pairs commonly occur together?
  - Customer + Scheduling ("Crear cliente y agendar")? → **YES, most common chain.** New WhatsApp contact → CustomerAgent creates customer → SchedulingAgent books job. The `created_entity` mutation from CustomerAgent flows into SchedulingAgent seamlessly.
  - Scheduling + Financial ("Agendar y enviar presupuesto")? → **YES, very common.** Book a diagnostic visit → after visit, generate presupuesto. These are SEQUENTIAL (financial comes after job context exists).
  - Others? → **Additional common chains:** 1) Search Customer → Check Payment → Book Job ("buscame a Juan, ¿cuánto debe? y agendame un turno"), 2) Cancel Job → Reschedule ("cancelá el de mañana y pasálo al jueves"), 3) Escalation → Scheduling (after human resolves complaint, rebook warranty visit), 4) FAQ → Scheduling ("¿cubren Zona Norte? Sí → entonces agendar").
- [x] Which pairs can run in parallel vs. must be sequential? → **MOSTLY SEQUENTIAL** due to data dependencies. Parallel: `search_customer` + `check_availability` (independent queries). Sequential (order matters): `create_customer` → `book_job` (need customer_id first), `book_job` → `generate_quote` (need job context), `cancel_job` → `create_credit_note` (need cancellation confirmation first). Rule of thumb: **reads can parallel, writes must sequence.**
- [x] Are there cross-domain *conflicts*? (e.g., FleetAgent says technician available, but SchedulingAgent says time slot full) → **YES, possible.** Resolution: SchedulingAgent is the authority for TIME conflicts (it owns the calendar). FleetAgent is the authority for RESOURCE conflicts (vehicle/technician pairing). If FleetAgent says Pedro's vehicle is in maintenance but SchedulingAgent shows Pedro with open slots → FleetAgent wins (no vehicle = can't dispatch). The orchestrator resolves by checking both: availability (time) AND resources (vehicle/equipment) before confirming.

### Shared Business Rules
- [x] Business hours — when is the AI available? (24/7? business hours only? configurable per org?) → **Fully owner-configurable via `/settings/ai-assistant`.** The AI system has a **master toggle** (`isEnabled`) and a **response window** configuration that together determine when and how the AI auto-responds to incoming WhatsApp messages.

  **Master Toggle (`isEnabled`):**
  - **OFF:** The AI never auto-responds. All incoming WhatsApp messages go to the human inbox on the dashboard. The org operates in manual mode. No bot greeting, no self-identification, no auto-actions. The Copilot sidebar (internal AI assistant for the dispatcher) remains available regardless — it's a separate feature.
  - **ON:** The AI auto-responds to incoming messages according to the response window and action permissions configured below.

  **Response Window (`aiResponseWindow`):**
  Defines WHEN the AI auto-responds. Options:
  - `ALWAYS` — AI responds 24/7. Full autonomy within configured action permissions.
  - `OUTSIDE_HOURS_ONLY` — AI responds ONLY outside the org's configured business hours. During business hours, the human team handles messages directly. This is the **recommended default** for most orgs: capture leads and appointment requests after hours (evenings, weekends) while letting the team handle conversations personally during the workday.
  - `BUSINESS_HOURS_ONLY` — AI responds during business hours only. After hours, messages queue for morning review with an auto-acknowledgment: "Tu mensaje quedó registrado. Te contactamos mañana a primera hora."
  - `CUSTOM` — Owner defines specific time windows (e.g., Mon-Fri 18:00-08:00 + weekends all day).

  **Action Permissions (`aiAllowedActions`):**
  When the AI IS responding, the owner controls WHAT it can do. This is a granular permission set:
  - `answer_faqs` — Answer business hours, services offered, coverage area, payment methods (always ON if AI is enabled)
  - `share_pricing` — Share pricing info from Pricebook (configurable: exact prices, ranges, or "requires diagnosis visit")
  - `create_jobs` — Book appointments / create jobs (requires customer confirmation flow)
  - `create_customers` — Auto-create new customer records from WhatsApp contacts
  - `send_quotes` — Generate and send presupuestos
  - `handle_rescheduling` — Process reschedule requests autonomously
  - `handle_cancellations` — Process cancellation requests
  - `send_reminders` — Send proactive maintenance/seasonal reminders
  - `escalate_to_human` — Trigger human handoff (always ON — safety net)

  **Example configurations:**
  - **Solo plumber, wants leads 24/7:** `isEnabled: true`, `aiResponseWindow: ALWAYS`, `aiAllowedActions: [answer_faqs, share_pricing, create_jobs, create_customers]`
  - **Medium org, human-first:** `isEnabled: true`, `aiResponseWindow: OUTSIDE_HOURS_ONLY`, `aiAllowedActions: [answer_faqs, share_pricing, create_jobs]` — After hours the AI captures new leads and books appointments; during the day the team talks to customers directly.
  - **Large org, AI as FAQ bot only:** `isEnabled: true`, `aiResponseWindow: ALWAYS`, `aiAllowedActions: [answer_faqs]` — AI only answers static questions, never creates or modifies data.
  - **No AI:** `isEnabled: false` — Pure manual operation.

  **Behavior when AI is active but action is not permitted:** The AI acknowledges the request and queues it: "Entendido, querés agendar un turno. Le paso tu mensaje al equipo y te confirman a la brevedad." This prevents the customer from feeling ignored while respecting the org's configured limits.

  **🚫 No bypass — absolute boundary:**
  The AI's configured permission boundary is **absolute**. No exceptions, no overrides, no "smart bypasses" — not for emergencies, not for VIP customers, not for any reason. This is enforced at the **code level** (middleware guard before every tool call), not at the prompt level (prompts can be jailbroken). Rationale:
  1. **Liability protection:** CampoTech is SaaS, not the service provider. If the AI gives wrong safety advice during an emergency, CampoTech is liable. By constraining the AI to configured actions only, we limit our exposure to exactly what the org opted into.
  2. **Abuse prevention:** Without hard boundaries, customers could manipulate the AI via social engineering ("es una emergencia, necesito que me agendes YA") to bypass approval flows or action restrictions. Org owners could also over-rely on AI for situations it shouldn't handle.
  3. **Predictability:** Orgs need to know exactly what their AI will and won't do. Surprise behaviors erode trust and make adoption harder.
  4. **Emergency keyword detection** is used ONLY for **internal dashboard priority flagging** (visual indicator for the human team — e.g., a red badge on the conversation). It does NOT change the AI's response behavior, does NOT trigger auto-notifications, and does NOT bypass any configured limits.
  5. **The AI never gives safety advice** ("abrí las ventanas", "llamá al 911") — there are hundreds of possible emergency types across dozens of trades, and we cannot anticipate them all correctly. Wrong advice is worse than no advice.

- [x] Language rules — formal/informal? voseo always? customer-matching? → **Covered in GeneralAgent 7.1.** Summary: voseo default, adaptive per customer via `CustomerAIProfile.preferredFormality`, regional adjustment via area code, context-reactive (angry → more formal), owner-configurable base tone via `/settings/ai-assistant`.
- [x] Approval requirements — which actions across all agents need human approval? → **MASTER APPROVAL MATRIX:**
  | Action | Approval Required? | Override |
  |--------|-------------------|----------|
  | Search/Query (any data) | ❌ No | — |
  | Create Customer | ✅ Yes | Auto for solo-worker orgs |
  | Update Customer (contact info) | ❌ No | — |
  | Update Customer (name/type) | ✅ Yes | — |
  | Create Job | ✅ Yes | Auto if auto-assign enabled |
  | Reschedule Job (customer-initiated) | ❌ No | — |
  | Reschedule Job (operator-initiated) | ✅ Yes | — |
  | Cancel Job | ✅ Yes | — |
  | Generate Quote PDF | ✅ Yes | — |
  | Generate Invoice | ✅ Yes | — |
  | Send Payment Reminder | ✅ Yes | Auto after Day 30+ |
  | Reassign Jobs (sick day) | ✅ Yes | — |
  | Bulk Reschedule | ✅ Yes + extra warning | — |
  | Escalate to Human | ❌ No (auto) | — |
  | Create Ticket | ❌ No (auto) | — |
  | Send Proactive Reminder | ✅ Yes | Auto if below fatigue limits |
  | Send Notification (WhatsApp) | ❌ No (system) | — |
- [x] Notification rules — which agent actions trigger WhatsApp notifications to customers? → **NOTIFICATION MAP:**
  | Agent Action | Customer Notification? | Template |
  |-------------|----------------------|----------|
  | Job Booked | ✅ Yes | "Tu turno de [service] quedó agendado para [date] a las [time] con [tech]." |
  | Job Rescheduled | ✅ Yes | "Tu turno fue reprogramado para [new date/time]." |
  | Job Cancelled | ✅ Yes | "Tu turno del [date] fue cancelado. [Reason]." |
  | Job Completed | ✅ Yes (auto) | Invoice + Report + Rating Link via WhatsApp |
  | Quote Generated | ✅ Yes | PDF via WhatsApp |
  | Payment Reminder | ✅ Yes | Dunning sequence (see FinancialAgent 3.3) |
  | Technician Reassigned | ✅ Yes | "Tu turno será atendido por [new tech]." |
  | Proactive Reminder | ✅ Yes | Seasonal/maintenance message |
  | Escalation Created | ❌ No | Internal only (owner notification) |
  | Customer Created | ❌ No | Internal only |

### Relationship-Aware Context Loading (All Agents)

> 📌 **DESIGN DECISION (2026-02-19):** Inspired by GraphRAG concepts but implemented with PostgreSQL views (no Neo4j needed). When ANY sub-agent loads context for an entity (customer, job, technician), it should also load the most relevant connected data points. The customer/user already knows their own history — it's unprofessional for the AI to operate without that context. This is implemented in each sub-agent's `load_domain_context` node.

| Sub-Agent | When entity loaded | Also load (connected context) |
|-----------|-------------------|-------------------------------|
| **SchedulingAgent** | Customer for booking | Pending invoices, open complaints, preferred tech, relationship score, last service |
| **CustomerAgent** | Customer profile | Job history count, payment patterns, last interaction date |
| **FinancialAgent** | Invoice/Quote | Related job status, customer payment history, overdue pattern |
| **FleetAgent** | Technician for assignment | Skill ratings, customer preferences for that tech, performance scores |
| **EscalationAgent** | Conversation for complaint | Past complaints, relationship score, full interaction history |
| **ProactiveAgent** | Customer for reminder | Service history, equipment types, last maintenance dates |
| **GeneralAgent** | Customer for greeting | Name, last interaction, relationship tier (for tone calibration) |

**Implementation:** PostgreSQL view(s) like `v_customer_360` with JOINs across customers, jobs, invoices, ratings, complaints, and `customer_ai_profiles`. Loaded once per request in `load_domain_context`, summarized into working memory (~200 tokens). No separate graph database required — the relationships already exist as foreign keys in the Prisma schema.

> 📌 **MOVED TO UNIFICATION DOCUMENT:**
> The infrastructure sections previously located here (Context Window, Session Management, Message Burst Handling, Debounce Learning, Privacy Framework, Context Limits, Profile Triggers, and Storage Schemas) have been officially migrated to `AI_COPILOT_LANGGRAPH_UNIFICATION.md` as they pertain to system orchestration rather than sub-agent domain design.

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

### 9. Context Window & Session Management (Phase A2, Lines ~515-625)
**Depends on:** Session lifecycle, context loading, and profile update trigger answers
**What needs updating:**
- `CopilotState` — add `session_id` field, session boundary logic in `intake_node`
- `AISession` schema — new model for session tracking
- `context_loader_node` — implement 3-layer loading (always / on-demand / never)
- Working Memory refresh logic — re-summarize every ~5 messages within a session
- Profile update extraction — LLM call at session close for `CustomerAIProfile` delta
- Inactivity cron — close stale sessions and trigger profile updates

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

*Version 2.0 - 2026-02-19*  
*All 100+ questions answered with CampoTech-specific business rules. Answers informed by domain KIs: jobs lifecycle, financials & ledger, workforce & fleet, Argentine regulatory compliance, AI service architecture, CRM & customer success, communication infrastructure, and ratings system. Ready for prompt engineering, LangGraph node design, and tool registry finalization.*
