# CampoTech - Complete Vision Document

*Powered by CampoTech*

---

## Executive Summary

CampoTech is a field service management platform targeting service businesses in Argentina (plumbers, electricians, AC repair, etc.). The platform enables these businesses to manage jobs, technicians, invoices, and customer communications while also connecting them with consumers through a marketplace app.

---

## Business Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CAMPOTECH REVENUE MODEL                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   BUSINESSES PAY ──► CampoTech Subscription ──► Funds Everything        │
│   (Plumbers, etc.)        │                           │                 │
│                           │                           │                 │
│                           ▼                           ▼                 │
│                    ┌─────────────┐            ┌─────────────────┐       │
│                    │ Business    │            │ Consumer App    │       │
│                    │ Services    │            │ (FREE for       │       │
│                    │ (Web+Mobile)│            │  consumers)     │       │
│                    └─────────────┘            └─────────────────┘       │
│                                                                         │
│   The more businesses subscribe → Better consumer app → More consumers  │
│   → More leads for businesses → More businesses want to subscribe       │
│                                                                         │
│                    🔄 THE ROLLING BALL EFFECT 🔄                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### The Rolling Ball Strategy (Milei Competition Philosophy)

1. **Phase 1**: Acquire business owners with valuable tools (dashboard, technician app, WhatsApp AI, AFIP invoicing)
2. **Phase 2**: Use accumulated business data to power consumer marketplace
3. **Phase 3**: Consumers discover and hire businesses through marketplace
4. **Phase 4**: Successful businesses create FOMO for non-subscribers
5. **Result**: Network effects drive exponential growth

### The Growth Engine (Zero CAC Acquisition)

```
┌─────────────────────────────────────────────────────────────────────┐
│               GROWTH ENGINE (61k Profiles)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   STEP 1: Import Public Licenses        STEP 2: WhatsApp Outreach      │
│   ──────────────────────────────   ───────────────────────────────   │
│   • ERSEP (Córdoba): ~33k electricians   • "Product-First" message       │
│   • CACAAV (National): ~23k HVAC         • "Try our Invoicing App FREE"  │
│   • Gasnor/GasNEA: ~5k gas techs         • Trust anchor: "Google us"     │
│                                                                         │
│   STEP 3: Claim & Trial                  STEP 4: Conversion             │
│   ──────────────────────────────   ───────────────────────────────   │
│   • /reclamar search page                • 21-day trial expires          │
│   • OTP verification via SMS/WA          • Premium features locked       │
│   • 21-day trial starts                  • ~15% convert to paid          │
│                                                                         │
│   PROJECTION:                                                           │
│   • 1% claim rate = 610 users (CAC = $0)                                │
│   • 15% trial conversion = 91 subscribers                               │
│   • MRR: $3,640/month                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The Users

| User Type | Description | Payment |
|-----------|-------------|---------|
| **CampoTech (You)** | Platform owner, manages everything | Receives subscription revenue |
| **Business Owners** | Plumbing companies, electrical companies, etc. | Monthly subscription ($25-$120) |

| **Technicians** | Workers who perform services in the field | Included in business subscription |
| **Consumers** | Regular people searching for services | **FREE** |

---

## The Applications

### 1. CampoTech Website (`apps/web`)

**Purpose**: Business dashboard + Landing page with pricing

**Landing Page (`/`):**
- What is CampoTech
- Feature showcase
- Subscription tiers with pricing
- "Sign Up" → Business registration
- "Login" → Business dashboard

**Business Dashboard (`/dashboard`):**
- Jobs management (create, assign, track, complete)
- Customer database with personalized service history
- Team management (3 roles: Owner, Administrador, Técnico)
- Invoices with AFIP integration and job-level financing toggles
- **Tactical Map (Live Path)**:
    - Real-time technician tracking with 60s updates (transit) or 200m displacement triggers (at job).
    - **Visual Itinerary**: Polyline rendering (Grey for past, Solid for current, Violet for future).
    - High-visibility markers (Large, lettered 44px hitboxes) for easy navigation.
- Inventory management (Multi-source: Warehouse + Technician Vehicles)
- Fleet/Vehicles with stock tracking per truck
- WhatsApp integration with AI Scheduling Intelligence
- Analytics and reports
- Settings (organization, billing, notifications)
- **Compliance & Verification**: Business vetting status and compliance scoring
- **Emergency Controls**: "Panic Mode" system overrides
- **Onboarding Progress**: Structured setup flow for new organizations

**Role System:**
| Role | Spanish | Access Level |
|------|---------|--------------|
| Owner | Dueño | Full access: billing, team, settings, all features |
| Admin | Admin | Management of jobs, customers, and team (NO billing/subscription access) |
| Technician | Técnico | Their assigned jobs only, inventory usage, voice reports |

**Job Tracking Page (`/track/[token]`):**
- Progress bar showing job status phases
- ETA when technician is en route
- Contact options (call, WhatsApp)
- After completion: Documents + Rating form

**Rating Page (`/rate/[token]`):**
- Simple 1-page form
- Star rating (1-5)
- Optional comment
- "Save this WhatsApp for future needs" prompt
- Stores rating in database for marketplace AI

---

### 2. Technician Mobile App (`apps/mobile`)

**Purpose**: Field workers manage their day

**Features:**
- Today's jobs with customer info and **Multi-Stop Navigation** (Single Google Maps URL for the whole day).
- Job status updates (pending → en route → arrived → working → complete)
- **Voice AI Reports**: Dictate to auto-fill forms; AI extracts materials used.
- **Cascade Inventory**: 
    - Deduct from vehicle assigned to job first (Truck-level accuracy).
    - Fallback to Warehouse if stock is missing from vehicle.
    - Manual override option for the technician before submission.
- Camera for photos (Before/After)
- Customer signature capture
- Access business WhatsApp (role-restricted)
- Offline support via WatermelonDB with background synchronization.

**Critical Requirement**: Must work on OLD phones (Android 6+, iPhone 6+)

---

### 3. Consumer Marketplace App (`apps/consumer-mobile`)

**Purpose**: Regular people find and hire service businesses

**Discovery Flow:**
1. Consumer opens app, location auto-detected
2. Select category OR use voice/text to describe need
3. AI shows recommendation cards based on:
   - Distance/location
   - Availability (who's free now)
   - Ratings (when enabled)
   - Services offered
   - Response time
4. Consumer taps business → Views profile, ratings, photos
5. Consumer taps "Contact" → Opens WhatsApp with business number.
   - **Stealth Tracking**: No pre-filled or clinical messages (e.g., "Vi tu perfil...").
   - **Analytics**: Uses URL referral tracking and button-level logging to measure performance.

**Consumer Does NOT:**
- Pay for the app
- Create an account (optional)
- Have an ongoing portal relationship

**Rating Flow:**
- After job completion, consumer receives WhatsApp link
- Simple rating form (same as `/rate/[token]` in web)
- Rating feeds into marketplace AI recommendations

**Critical Requirement**: Must work on OLD phones (Android 6+)

---

### 4. CampoTech Admin System (`apps/admin`) - NEW

**Purpose**: Your internal dashboard to manage CampoTech as a business

**Why Separate from apps/web:**
- Data breach protection (if web is compromised, admin isn't exposed)
- Cross-business analytics (businesses only see their own data)
- Legal separation of your data vs client data
- Future staff access without mixing with business users

**Features:**
```
├── Dashboard
│   ├── Total businesses subscribed
│   ├── Monthly recurring revenue (MRR)
│   ├── New signups this week/month
│   ├── Churn rate
│   ├── Active users (businesses + technicians)
│   └── Marketplace usage metrics
│
├── Businesses
│   ├── List all businesses
│   ├── View details (plan, payment status, usage)
│   ├── Their customers data
│   ├── Their jobs history
│   ├── Subscription status
│   └── Sales notes
│
├── Payments
│   ├── All subscription payments
│   ├── Failed payments / Past due
│   ├── Revenue by tier
│   └── Export for accountant
│
├── WhatsApp AI
│   ├── All conversations (for training)
│   ├── AI confidence scores
│   ├── Failed/escalated conversations
│   ├── Voice memo transcriptions
│   └── Model performance metrics
│
├── AI Chat Assistant
│   ├── Query your database naturally
│   ├── "How many businesses signed up this month?"
│   ├── "Which businesses have past due payments?"
│   └── "Show me the most active plumbers in Buenos Aires"
│
├── Activity Map
│   ├── Live view of all technicians (all businesses)
│   ├── Jobs in progress
│   ├── Geographic coverage heatmaps
│   └── Service area analysis
│
├── Analytics
│   ├── Growth metrics
│   ├── Feature adoption
│   ├── AI usage & costs
│   └── Marketplace performance
│
├── Legal & Documents
│   ├── Business contracts
│   ├── Compliance documents
│   └── Export for lawyer/accountant
│
└── Your WhatsApp (CampoTech sales)
    ├── Leads from website
    └── Client communications (manual, no AI)
```

---

### 5. Developer Portal (`apps/developer-portal`)

**Purpose**: API documentation for third-party developers

**Priority**: Lowest - complete after everything else

**Features:**
- API documentation
- Quickstart guide
- API Reference (Swagger UI)
- Interactive playground
- Developer console (API keys)

---

## Complete User Flows

### Flow 1: Consumer Finds a Service

```
Consumer opens           Category selection        AI shows business
Marketplace App ───────► or voice/text input ────► recommendation cards
      │                                                   │
      │    Cards show: Rating ⭐, Distance 📍, Status    │
      │                                                   │
      ▼                                                   ▼
Consumer taps                                      Opens WhatsApp
business card  ─────────────────────────────────► with that business
```

### Flow 2: WhatsApp AI Handles the Lead

```
Consumer messages         AI reads message           Based on confidence:
on WhatsApp    ─────────► AI has access to:  ──────► HIGH → Auto-book job
                          - Schedule availability    LOW  → Transfer to owner
                          - Services offered               (based on subscription)
                          - Pricing
                          - Worker locations         Creates job in database
```

### Flow 3: Technician Does the Job

```
Technician sees    Navigation to    Updates status     Voice Report:
job in app     ───► job location ───► throughout  ────► "Used 2 PVC pipes,
      │              (Multi-stop Nav)     │            fixed leak in 45min"
      │                                    │                   │
      │           Cascade Inventory ◄──────┘                   │
      │           (Vehicle -> Warehouse)                       ▼
      │                                              Invoice auto-generated
      ▼                                              (Watermarked until paid)
Job marked complete ──► Payment collected ──────────► Official AFIP Invoice
                        (Cuotas sin interés?)
```

### Flow 4: Customer Receives Documents + Rates

```
Job completed ──► Customer gets WhatsApp message:
                  │
                  ├── 📄 Factura (PDF)
                  ├── 📋 Reporte de servicio (PDF)
                  ├── ⭐ Link to rate experience
                  └── 📱 "Save this WhatsApp for future needs"

Rating stored in DB ──► Feeds into marketplace AI
```

### Flow 5: Business Sees Market Position

```
Business Dashboard → Analytics:
┌─────────────────────────────────────────────────────────────┐
│  Tu Rendimiento (Your Performance)                          │
├─────────────────────────────────────────────────────────────┤
│  Rating promedio: ⭐ 4.6                                    │
│  Total reseñas: 47                                          │
│  Trabajos este mes: 23                                      │
│  Leads desde marketplace: 8                                 │
├─────────────────────────────────────────────────────────────┤
│  Tu Posición en el Mercado                                  │
│  ─────────────────────────────────────────────────────────  │
│  📊 Estás en el TOP 25% de plomeros en Buenos Aires         │
│  📈 Tu rating subió 0.3 puntos este mes                     │
│  🏆 3 negocios tienen mejor rating que vos en tu zona       │
│  💡 Tip: Responder más rápido mejora tu posición            │
└─────────────────────────────────────────────────────────────┘
```

**Competition Data Policy:**
- Businesses see their OWN rating and performance
- Businesses see anonymized market benchmarks ("Top 25%")
- Businesses see count of competitors above them (not names)
- Consumers see full ratings in marketplace (public)
- No direct competitor data exposure

---

## Subscription Tiers & Cost-Safe SaaS Model

### The Forever Free Anchor

```
┌─────────────────────────────────────────────────────────────────────────┐
│             COST-SAFE SAAS MODEL (Zero Infrastructure Cost)              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   FOREVER FREE (∞ Free)                 TRIAL (21 days)                 │
│   ──────────────────────────────   ──────────────────────────────────   │
│   ✅ Public profile (verified)          ✅ AFIP invoicing               │
│   ✅ WhatsApp redirect (wa.me)          ✅ Inventory management         │
│   ✅ Digital badge (countries)          ✅ Job management               │
│   ✅ Ratings display                    ✅ Fiscal health dashboard      │
│   ✅ Job tracking links                 ✅ Full mobile app              │
│                                                                         │
│   💰 Our cost: $0                       💰 Our cost: $0                 │
│   (No API calls, just redirects)       (No WA API during trial)        │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   After trial expires, if not subscribed:                               │
│   ❌ Invoicing → BLOCKED                                                │
│   ❌ Inventory → READ-ONLY                                              │
│   ❌ New jobs → BLOCKED                                                 │
│   ✅ Public profile → STILL ACTIVE (forever free anchor)                │
│   ✅ WhatsApp redirect → STILL ACTIVE                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### WhatsApp Cost Protection

| Tier | WhatsApp Method | Our Cost | Features |
|------|-----------------|----------|----------|
| FREE/TRIAL | `wa.me/{phone}` redirect | $0 | Opens consumer's WhatsApp app |
| INICIAL+ | Cloud API (BSP) | ~$0.05/msg | Templates, Interactive buttons |
| PROFESIONAL+ | Cloud API (BSP) | ~$0.05/msg | + AI Bot, conversation tracking |

**Important**: NO "Free API Credits." Free tier = redirect only.

### Pricing Tiers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAMPOTECH PRICING                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   FREE               INICIAL              PROFESIONAL        EMPRESA        │
│   $0 (∞ Free)        $25/mes              $55/mes            $120/mes       │
│   ─────────────      ─────────────        ─────────────      ─────────────  │
│                                                                             │
│   ✅ Public profile  ✅ 1 user            ✅ 5 users          ✅ Unlimited   │
│   ✅ WA redirect     ✅ 50 jobs/mo        ✅ 200 jobs/mo      ✅ Unlimited   │
│   ✅ Digital badge   ✅ AFIP invoicing    ✅ AFIP invoicing   ✅ Everything  │
│   ✅ Ratings         ✅ Basic inventory   ✅ Full inventory   ✅ Priority    │
│   ❌ Invoicing       ✅ WA Templates      ✅ WA + AI Bot      ✅ WA + AI     │
│   ❌ Inventory       ✅ Barcode scan      ✅ Multi-stop nav   ✅ Analytics   │
│   ❌ Jobs mgmt       ❌ Analytics         ✅ Analytics        ✅ Marketplace │
│                                                              highlight      │
│                                                                             │
│   Ideal for:         Ideal for:          Ideal for:         Ideal for:     │
│   Claimed profiles   Solo workers        Small teams        Companies      │
│   (trial expired)    (1 person)          (2-5 employees)    (6+ people)    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│   💡 All paid plans include: Support, Updates, Backup, Marketplace access  │
│   🎁 Early Adopter: 50% off first 3 months                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**AI Usage Model**: Included in tiers with limits, NOT separate billing
- Free: WhatsApp redirect only (no AI)
- Inicial: WhatsApp templates (100 messages/month)
- Profesional: 100 AI conversations/month + templates
- Empresa: Unlimited AI

**Marketplace**: Available for ALL paid tiers when launched (no tier advantage for ranking)

---

## Feature Toggles (For Phased Rollout)

| Toggle | Description | Default |
|--------|-------------|---------|
| `ratingsEnabled` | Collect ratings from customers | OFF (until Phase 2) |
| `marketplaceListing` | Business visible in consumer app | OFF (until Phase 2) |
| `whatsappAI` | AI handles WhatsApp leads | ON (per subscription tier) |
| `voiceReports` | Voice-to-text for reports | ON (per subscription tier) |
| `consumerAppEnabled` | Consumer marketplace active | OFF (until Phase 2) |

---

## PDF Documents & Branding

All PDFs sent to consumers include:
- Business branding (logo, colors)
- Legal business info (CUIT, address, contact)
- Job/service details
- AFIP fiscal data (when applicable)
- **"Powered by CampoTech"** watermark (always shown)

**Customization per Business:**
```
Business Settings → PDF Templates
─────────────────────────────────────────────────────────────
│ Logo: [Upload]                                            │
│ Business Name: Plomería García                            │
│ CUIT: 20-12345678-9                                       │
│ Address: Av. Corrientes 1234, CABA                        │
│ Phone: +54 11 1234-5678                                   │
│ Email: info@plomeriagarcia.com                            │
│                                                           │
│ Invoice Template: [Preview] [Edit Colors]                 │
│ Service Report Template: [Preview] [Edit]                 │
│ Custom Footer Text: "Gracias por confiar en nosotros"     │
─────────────────────────────────────────────────────────────
```

---

## Argentina Legal Requirements

**Action Required**: Research and implement per business type:

| Business Type | Consumer Receives | Business Must Keep |
|---------------|-------------------|-------------------|
| Plomero | Factura, Service Report | Copy of all, AFIP submission |
| Electricista | Factura, Safety Cert? | TBD - research needed |
| Gasista | Factura, Gas Certificate | Matricula requirements |
| Refrigeración | Factura, Service Report | TBD |
| General | Factura | TBD |

**Recommendation**: Consult Argentine lawyer/accountant specializing in service businesses before implementation.

---

## Job Completion & Payment Flow

```
Technician completes work
         │
         ▼
Technician enters: materials used, time, notes (voice report)
         │
         ▼
System calculates total & generates **Watermarked PDF Report** ("Pago Pendiente")
         │
         ▼
Payment collected:
├── Cash: Technician marks "Paid - Cash" (logged with GPS + timestamp)
├── MercadoPago: Customer pays via link (Job-specific "Cuotas" logic applies)
└── Card (business terminal): Technician marks "Paid - Card"
         │
         ▼
Payment confirmed → **Watermark removed** → Documents auto-generated:
├── Factura (Official AFIP Invoice PDF)
├── Service Report (Clean PDF)
└── Payment receipt
         │
         ▼
Rating link sent via WhatsApp (Safe greeting logic: focus on help, not past success)
```

---

## Job Tracking (Progress Bar Style)

NOT live map. Simple progress tracker like pizza delivery:

```
┌─────────────────────────────────────────────────────────────────┐
│  Tu Servicio - Plomería García                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ✅ ────────── ✅ ────────── 🔵 ────────── ⚪ ────────── ⚪    │
│  Confirmado   Asignado    En camino     Trabajando   Completado │
│                              │                                  │
│                              ▼                                  │
│                    Juan está en camino                          │
│                    Llegada estimada: 15 minutos                 │
│                                                                 │
│  Técnico: Juan Pérez                                           │
│  Servicio: Reparación de pérdida                               │
│  Dirección: Av. Corrientes 1234                                │
│                                                                 │
│  ¿Necesitás contactar al técnico?                              │
│  [📱 Llamar] [💬 WhatsApp]                                      │
└─────────────────────────────────────────────────────────────────┘
```

Status Phases:
1. **Confirmado** - Job booked
2. **Asignado** - Technician assigned
3. **En camino** - Technician traveling (ETA shown)
4. **Trabajando** - Technician arrived, working
5. **Completado** - Job done (documents + rating available)

---

## Workflow Orchestration (Pure LangGraph)

CampoTech is transitioning from stateless workers to a **Pure LangGraph** architecture implemented as a dedicated **Python/FastAPI AI Service**. This moves the system from "managing code" to "managing stateful workflows," enabling long-running operations and high-trust automation.

### Core Principles
- **Durable Execution**: Workflows can "sleep" for days (waiting for user input) and resume with full context.
- **Human-in-the-Loop**: Active monitoring by owners through the Copilot Side Panel. Breaking points for automated "Trigger Words."
- **Observable Brain**: Every decision, intent extraction, and failure is traceable via LangSmith and evaluation frameworks.

### 1. The Autonomous Receptionist (Graph)
Replaces standard auto-responders with a stateful agent:
- **Safety & Trigger Words**: Detects specific triggers (e.g., "lawsuit", "complaint", "human") and enters a dormant mode, escalating immediately to the owner via dashboard alerts and push notifications.
- **Strategic Delay**: Waits 3 minutes before responding to allow for natural human interaction.
- **Retrieval Augmented Generation (RAG)**: Consults business-specific manuals (PDFs) and price estimates before answering.
- **Autonomous Follow-up**: Proactively asks "Are you still interested?" after 24 hours of silence using an Argentine-tailored tone (customizable by the owner).

### 2. The AI Copilot (Side Panel)
Supports human ADMINs in real-time within the Dashboard:
- **Intelligent Suggestion**: Proposes replies based on the conversation context.
- **Automated Data Entry**: Detects addresses or names and offers one-click CRM updates via a Side Panel interface.
- **Skill-Based Scheduling**: Automatically checks specific technician calendars based on the service requested (e.g., Gasista vs. Electricista).

### 3. Technician Voice Reporting (Option A)
Advanced flow for field workers:
- **Action Confirmation**: When a technician dictates a report, the AI extracts the data and **replies via WhatsApp to confirm** (e.g., "Got it, I recorded 2 pipes and 1 hour of labor. Correct?").
- **Stateful Completion**: If fields are missing (e.g., odometer), the Graph loops back to ask for the specific missing data rather than rejecting the report.

---

## Technical Stack Shift
To support production-grade Agentic workflows, the AI logic is hosted as a dedicated **FastAPI service** using the LangGraph production-ready template. We prioritize **Code Integrity** and **Prompt Reliability** through a modern Python stack:
- **Pydantic**: Guarantees strict data validation for every AI output.
- **DSPy**: Replaces fragile manual prompts with programmatic, optimizable signatures.
- **Arize Phoenix**: Provides full observability with local tracing for high-speed debugging.
- **Ruff & MyPy**: Ensure enterprise-grade code hygiene and type-safety.

---

## WhatsApp AI System (Powered by LangGraph)

**Consumer → Business Flow:**
1. Consumer finds business in marketplace
2. Consumer taps "WhatsApp" button (Tracked via referral SKU/URL)
3. Opens WhatsApp with business number
4. AI reads incoming message with **Safe Greeting Logic**: 
   - *"Hola [Nombre], gracias por contactarte con [Empresa] nuevamente. ¿En qué podemos ayudarte hoy?"* (Avoids assuming previous job success).
5. AI has access to **Scheduling Intelligence**:
   - Availability based on real-time fleet locations
   - Services offered & Pricing
   - Distance-optimized slot proposals
6. Based on confidence level:
   - HIGH confidence → Proposal of valid slots → Creation of job assignment
   - LOW confidence → Transfer to owner/ADMIN

**Voice Memo Handling:**
```
Customer sends voice memo
         │
         ▼
Whisper API transcribes audio → text
         │
         ▼
If unclear audio → AI responds: "Disculpá, no pude entender bien.
                                 ¿Podrías escribir tu consulta?"
         │
         ▼
AI processes text, responds appropriately
```

**Phone Calls**: AI NEVER answers phone calls. Calls go directly to business owner.

**AI Training Loop:**
1. All conversations logged
2. You review in CampoTech Admin
3. Mark good/bad examples
4. Periodic model fine-tuning
5. AI improves over time

---

## Data Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SHARED DATABASE                             │
│  (PostgreSQL - All apps connect to same database)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Organizations (Businesses)                                     │
│  ├── Users (Owner, ADMIN, Technician)                     │
│  ├── Customers                                                  │
│  ├── Jobs                                                       │
│  ├── Invoices                                                   │
│  ├── Inventory                                                  │
│  ├── Vehicles                                                   │
│  ├── WhatsApp Conversations                                     │
│  └── Ratings/Reviews                                            │
│                                                                 │
│  Consumers (Marketplace Users)                                  │
│  ├── Optional accounts                                          │
│  └── Search history                                             │
│                                                                 │
│  CampoTech Admin Data                                           │
│  ├── Subscription payments                                      │
│  ├── Platform analytics                                         │
│  └── AI training data                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
   apps/web      apps/mobile   apps/consumer   apps/admin
   (Business)    (Technician)   (Marketplace)  (Your Admin)
```

---

## Cost Estimates (Monthly)

| Item | Description | Estimate (USD) |
|------|-------------|----------------|
| Database | Supabase (PostgreSQL) | $25-100 |
| Hosting | Vercel Pro | $20 |
| WhatsApp Business API | Per conversation | Variable |
| OpenAI API | GPT-4 for AI | Variable |
| SMS | Twilio for OTP | Variable |
| Developer | Full-stack (Argentina) | $2,000-4,000 |
| Accountant | Monthly retainer | $200-400 |
| Lawyer | As needed | $300-500 |
| **Total Fixed** | | ~$3,000-5,000/month |

**Break-even Analysis:**
- At $25/business: Need ~160-200 businesses
- At $55/business: Need ~55-90 businesses
- At $120/business: Need ~25-42 businesses

---

## Document Version

- **Version**: 1.1
- **Last Updated**: December 2025
- **Author**: CampoTech Team

---

## Recent Core Implementations

Since the initial vision, several key components have been implemented to strengthen the ecosystem:

### 1. Price Book Module
**Purpose**: Centralized service and pricing management.
- Hierarchical category organization for services.
- Detailed price book items with standard rates and descriptions.
- Dynamic filtering and search for quick job quoting.

### 2. System-Wide Audit & Integrity
**Purpose**: High-trust logging for sensitive operations.
- Cryptographic hashing of audit logs to prevent tampering.
- Complete history of changes to organizations, users, and financial records.
- Verification tools to ensure data consistency.

### 3. Argentine Localization Shell
**Purpose**: Deep integration with local standards.
- `es-AR` localization layer for all internal and external communications.
- Argentine-specific phone validation and business hour logic.
- Automated auto-responders tailored for the local market tone.

### 4. Developer SDKs (`packages/sdk`)
**Purpose**: Enabling programmatic access to the CampoTech ecosystem.
- **TypeScript SDK**: Full-featured client for web and Node.js environments.
- **Python SDK**: Targeting automation and data science workflows.

### 5. Cost-Safe SaaS Infrastructure (January 2026)
**Purpose**: Sustainable growth without infrastructure cost explosion.
- **Trial Time Bomb**: 21-day trial with automatic lockout on premium features.
- **WhatsApp Cost Protection**: Free tier uses `wa.me` redirect ($0 cost), paid tier uses Cloud API.
- **Forever Free Anchor**: Public profile + WhatsApp redirect never locked.

### 6. Growth Engine (January 2026)
**Purpose**: Zero-CAC user acquisition at scale.
- **Data Scrapers**: ERSEP (33k), CACAAV (23k), Gasnor/GasNEA (5k) = 61k profiles.
- **Product-First Messaging**: "Try our Invoicing App FREE for 3 weeks."
- **Trust Anchor Strategy**: "Google 'CampoTech'" builds credibility.
- **Claim Flow**: /reclamar page with masked preview + OTP verification.

---

## Document Version

- **Version**: 2.0
- **Last Updated**: January 2026
- **Author**: CampoTech Team
- **Changelog**:
  - v2.0: Added Cost-Safe SaaS Model, Growth Engine (61k profiles), Product-First positioning
  - v1.1: Added Price Book, Audit system, Argentine localization, SDKs

*Powered by CampoTech*

