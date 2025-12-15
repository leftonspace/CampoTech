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

---

## The Users

| User Type | Description | Payment |
|-----------|-------------|---------|
| **CampoTech (You)** | Platform owner, manages everything | Receives subscription revenue |
| **Business Owners** | Plumbing companies, electrical companies, etc. | Monthly subscription ($25-$120) |
| **Despachadores** | Office staff who schedule and dispatch jobs | Included in business subscription |
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
- Customer database
- Team management (3 roles: Owner, Despachador, Técnico)
- Invoices with AFIP integration
- Inventory management
- Fleet/Vehicles
- WhatsApp integration with AI
- Analytics and reports
- Settings (organization, billing, notifications)

**Role System:**
| Role | Spanish | Access Level |
|------|---------|--------------|
| Owner | Dueño | Full access: billing, team, settings, all features |
| Dispatcher | Despachador | Jobs, scheduling, customers, WhatsApp, inventory, reports (NO billing) |
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
- Today's jobs with customer info and navigation
- Job status updates (pending → en route → arrived → working → complete)
- Voice AI reports (dictate → auto-fills form with customer data, materials used, charges)
- Inventory: View vehicle stock, log usage, request replenishment
- Camera for photos
- Customer signature capture
- Access business WhatsApp (role-restricted)
- Offline support for areas with poor connectivity

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
5. Consumer taps "Contact" → Opens WhatsApp with business number

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
      │                                    │            fixed leak in 45min"
      │                                    │                   │
      │           Inventory updated ◄──────┘                   │
      │                                                        ▼
      │                                              Invoice auto-generated
      ▼
Job marked complete ──► Payment collected
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

## Subscription Tiers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAMPOTECH PRICING                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   INICIAL              PROFESIONAL           EMPRESA                        │
│   $25/mes              $55/mes               $120/mes                       │
│   ─────────────        ─────────────         ─────────────                  │
│                                                                             │
│   ✓ 1 usuario          ✓ 5 usuarios          ✓ Usuarios ilimitados         │
│   ✓ 50 trabajos/mes    ✓ 200 trabajos/mes    ✓ Trabajos ilimitados         │
│   ✓ App técnico        ✓ App técnico         ✓ App técnico                  │
│   ✓ Facturación AFIP   ✓ Facturación AFIP    ✓ Facturación AFIP            │
│   ✓ Inventario básico  ✓ Inventario completo ✓ Inventario completo         │
│   ✓ WhatsApp manual    ✓ WhatsApp + AI       ✓ WhatsApp + AI               │
│                          (100 conv/mes)        (ilimitado)                  │
│   ✗ Reportes voz       ✓ Reportes voz        ✓ Reportes voz                │
│   ✗ Analytics          ✓ Analytics básico    ✓ Analytics avanzado          │
│   ✗ Marketplace        ✓ Marketplace         ✓ Marketplace destacado       │
│                                                                             │
│   Ideal para:          Ideal para:           Ideal para:                   │
│   Trabajadores         Pequeñas empresas     Empresas medianas             │
│   independientes       (2-5 empleados)       (6+ empleados)                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│   💡 Todos los planes incluyen: Soporte WhatsApp, Actualizaciones,         │
│      Backup de datos                                                        │
│                                                                             │
│   🎁 Primeros 3 meses: 50% descuento para early adopters                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**AI Usage Model**: Included in tiers with limits, NOT separate billing
- Inicial: WhatsApp manual only (no AI)
- Profesional: 100 AI conversations/month
- Empresa: Unlimited AI

**Marketplace**: Available for ALL tiers when launched (no tier advantage for ranking)

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
System calculates total
         │
         ▼
Payment collected:
├── Cash: Technician marks "Paid - Cash" (logged with GPS + timestamp)
├── MercadoPago: Customer pays via link, system confirms
└── Card (business terminal): Technician marks "Paid - Card"
         │
         ▼
Payment confirmed → Documents auto-generated & sent via WhatsApp:
├── Factura (Invoice PDF)
├── Service Report (PDF)
└── Payment receipt
         │
         ▼
Rating link sent (separate or same message)
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

## WhatsApp AI System

**Consumer → Business Flow:**
1. Consumer finds business in marketplace
2. Consumer taps "WhatsApp" button
3. Opens WhatsApp with business number
4. AI reads incoming message
5. AI has access to:
   - Schedule availability
   - Services offered
   - Pricing
   - Worker locations
6. Based on confidence level:
   - HIGH confidence → Auto-book job
   - LOW confidence → Transfer to owner/dispatcher

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
│  ├── Users (Owner, Dispatcher, Technician)                     │
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
| Database | Supabase/PlanetScale | $25-100 |
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

- **Version**: 1.0
- **Last Updated**: December 2024
- **Author**: CampoTech Team

*Powered by CampoTech*
