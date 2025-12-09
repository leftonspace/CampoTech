# CampoTech System Guide

> Comprehensive documentation of the CampoTech platform architecture, business model, WhatsApp integration strategy, and pricing structure for field service businesses in Argentina.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Complete System Flow](#2-complete-system-flow)
3. [User Journeys](#3-user-journeys)
4. [WhatsApp Integration Strategy](#4-whatsapp-integration-strategy)
5. [Message Classification System](#5-message-classification-system)
6. [Subscription Tiers & Pricing](#6-subscription-tiers--pricing)
7. [Privacy & Trust Communication](#7-privacy--trust-communication)
8. [Technical Architecture](#8-technical-architecture)
   - [8.4 Customer Live Tracking System](#84-customer-live-tracking-system)
9. [Rejected Alternatives](#9-rejected-alternatives)
10. [Glossary](#10-glossary)

---

## 1. System Overview

CampoTech is a field service management platform designed specifically for Argentine service businesses (plumbers, HVAC technicians, electricians, etc.). The platform handles the complete workflow from customer contact to job completion and payment.

### Core Value Proposition

```
BEFORE CampoTech:
┌─────────────────────────────────────────────────────────────┐
│ 📱 WhatsApp chaos                                           │
│ 📝 Paper notes lost                                         │
│ 🗓️ Mental calendar                                          │
│ 💸 "Te pago después" (unpaid invoices)                      │
│ 🤷 "¿Dónde está el técnico?" (no tracking)                  │
└─────────────────────────────────────────────────────────────┘

AFTER CampoTech:
┌─────────────────────────────────────────────────────────────┐
│ ✅ Organized customer communication                         │
│ ✅ Digital job records with photos                          │
│ ✅ Automated scheduling & reminders                         │
│ ✅ Online payments (MercadoPago)                            │
│ ✅ Real-time technician tracking                            │
│ ✅ AFIP-compliant invoicing                                 │
└─────────────────────────────────────────────────────────────┘
```

### Target Market

- **Primary**: Small to medium field service businesses in Argentina
- **Industries**: HVAC (climatización), plumbing (plomería), electrical, gas fitting
- **Size**: 1-50 technicians
- **Current tools**: WhatsApp Business App (free), paper/Excel, manual everything

---

## 2. Complete System Flow

### 2.1 Business Owner Onboarding

```
Step 1: Registration
┌─────────────────────────────────────────────────────────────┐
│ campotech.com.ar/registro                                   │
│                                                             │
│ Nombre del negocio: [ServiFrío Climatización    ]          │
│ Tu nombre:          [María García                ]          │
│ Email:              [maria@servifrio.com.ar      ]          │
│ Teléfono:           [+54 11 4567-8901            ]          │
│ Rubro:              [Climatización (HVAC)       ▼]          │
│                                                             │
│              [Crear cuenta gratis →]                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
Step 2: Email Verification
                           │
                           ▼
Step 3: Business Setup Wizard
┌─────────────────────────────────────────────────────────────┐
│ Configurá tu negocio                              [2/5]     │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Servicios que ofrecés:                                  │ │
│ │ ☑️ Instalación de splits                                │ │
│ │ ☑️ Reparación de aires                                  │ │
│ │ ☑️ Mantenimiento/limpieza                               │ │
│ │ ☐ Instalación de calefactores                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Zona de cobertura:                                          │
│ ☑️ CABA    ☑️ GBA Norte    ☐ GBA Sur    ☐ GBA Oeste        │
│                                                             │
│                    [← Anterior]  [Siguiente →]              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
Step 4: Add Team Members (Optional)
┌─────────────────────────────────────────────────────────────┐
│ Agregá tu equipo                                  [3/5]     │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 👤 Carlos Rodríguez                                     │ │
│ │    +54 11 2345-6789 | Oficial Especializado             │ │
│ │    Especialidad: Instalación de splits                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [+ Agregar técnico]                                         │
│                                                             │
│ 💡 También podés agregar técnicos después                   │
│                                                             │
│                    [← Anterior]  [Siguiente →]              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
Step 5: Choose Subscription Plan
                           │
                           ▼
Step 6: Dashboard Ready!
```

### 2.2 Team Member Addition

```
Settings → Team → Add Member
┌─────────────────────────────────────────────────────────────┐
│ Agregar Miembro del Equipo                                  │
│                                                             │
│ Nombre: *           [Juan Pérez                  ]          │
│ Email: *            [juan@email.com              ]          │
│ Teléfono: *         [🇦🇷 +54 ▼] [11 5678 1234    ]          │
│                                                             │
│ Rol:                [Técnico                    ▼]          │
│                     ├── Técnico                             │
│                     ├── Despachador                         │
│                     └── Administrador                       │
│                                                             │
│ Especialidad:       [Instalación de splits      ▼]          │
│ Nivel:              [Oficial                    ▼]          │
│                     ├── Ayudante (UOCRA)                    │
│                     ├── Medio Oficial                       │
│                     ├── Oficial                             │
│                     └── Oficial Especializado               │
│                                                             │
│ ☑️ Enviar notificación de bienvenida                        │
│                                                             │
│              [Cancelar]  [Agregar Miembro]                  │
└─────────────────────────────────────────────────────────────┘
```

**Phone Validation Rules:**
| Country | Code | Min Digits | Max Digits | Example |
|---------|------|------------|------------|---------|
| Argentina | +54 | 10 | 11 | 11 1234 5678 |
| USA/Canada | +1 | 10 | 10 | 555 123 4567 |
| Chile | +56 | 9 | 9 | 9 1234 5678 |
| Uruguay | +598 | 8 | 9 | 91 234 567 |
| Paraguay | +595 | 9 | 9 | 981 123 456 |
| Brasil | +55 | 10 | 11 | 11 91234 5678 |

### 2.3 Customer Contact Flow

```
CUSTOMER INITIATES CONTACT
         │
         ├──────────────────┬──────────────────┬─────────────────┐
         ▼                  ▼                  ▼                 ▼
    [WhatsApp]          [Phone]           [Website]         [Referral]
         │                  │                  │                 │
         ▼                  ▼                  ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     CampoTech Processing                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  WhatsApp Message Received                                          │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────┐                                                │
│  │ Voice message?  │──Yes──► Whisper API transcription              │
│  └────────┬────────┘                    │                           │
│           │ No                          │                           │
│           ▼                             ▼                           │
│  ┌─────────────────────────────────────────────────────┐            │
│  │              GPT-4o Analysis                        │            │
│  │  • Extract: name, address, service type, urgency    │            │
│  │  • Classify: job request vs question vs unrelated   │            │
│  │  • Score: confidence level (0-100%)                 │            │
│  └─────────────────────────────────────────────────────┘            │
│                          │                                          │
│         ┌────────────────┼────────────────┐                         │
│         ▼                ▼                ▼                         │
│    [≥85%]           [65-85%]          [<65%]                        │
│   Auto-create      Confirm with       Human review                  │
│      job            customer            queue                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.4 Job Lifecycle

```
┌──────────────────────────────────────────────────────────────────────┐
│                         JOB LIFECYCLE                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌─────────────────┐ │
│  │ CREATED │───►│ ASSIGNED │───►│ EN ROUTE │───►│ IN PROGRESS     │ │
│  └─────────┘    └──────────┘    └──────────┘    └─────────────────┘ │
│       │              │              │                   │            │
│       │              │              │                   │            │
│       ▼              ▼              ▼                   ▼            │
│  Customer        Technician     Customer sees      Technician       │
│  notified:       notified:      live location:     updates:         │
│  "Recibimos      "Nuevo         GPS tracking       • Photos         │
│   tu pedido"      trabajo        on map            • Notes          │
│                   asignado"                        • Parts used     │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │    ┌───────────┐         ┌────────────┐         ┌─────────┐  │  │
│  │    │ COMPLETED │────────►│  INVOICED  │────────►│  PAID   │  │  │
│  │    └───────────┘         └────────────┘         └─────────┘  │  │
│  │          │                     │                     │       │  │
│  │          ▼                     ▼                     ▼       │  │
│  │    Customer rates         AFIP Factura          MercadoPago  │  │
│  │    service (1-5⭐)        generated             or cash      │  │
│  │                                                              │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Alternative paths:                                                  │
│  • CREATED → CANCELLED (customer cancels)                            │
│  • IN_PROGRESS → ON_HOLD (waiting for parts)                         │
│  • COMPLETED → REQUIRES_FOLLOWUP (issue found)                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.5 Notification Flow

```
JOB STATUS CHANGE
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│              Notification Orchestrator                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Check user preferences:                                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Channel Priority (Argentina):                          │  │
│  │   1. WhatsApp (95% open rate)                          │  │
│  │   2. Push notification                                 │  │
│  │   3. Email (formal/documentation only)                 │  │
│  │   4. SMS (OTP/fallback only)                           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  For each recipient (customer, technician, admin):           │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Try WhatsApp                                            │ │
│  │    │                                                    │ │
│  │    ├── Success → Done                                   │ │
│  │    │                                                    │ │
│  │    └── Failed → Try Push                                │ │
│  │                   │                                     │ │
│  │                   ├── Success → Done                    │ │
│  │                   │                                     │ │
│  │                   └── Failed → Try Email                │ │
│  │                                  │                      │ │
│  │                                  └── Log delivery       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.6 Real-Time Tracking

**Important:** Customers don't use the CampoTech app - they receive a tracking link via WhatsApp that opens in their browser.

#### WhatsApp Tracking Notification

When a technician marks "En camino", the customer receives:

```
WhatsApp Message:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  🔧 Tu técnico está en camino                               │
│                                                             │
│  Carlos R. salió hacia tu ubicación.                        │
│  Llegada estimada: ~12 minutos                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📍 Seguí tu servicio en vivo                        │   │
│  │    track.campotech.com.ar/j/ABC123                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [🗺️ Ver ubicación en vivo]  ← Button opens browser        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Note:** WhatsApp cannot display live/animated maps inside the chat. The tracking link opens a web page with the live map.

#### Customer Tracking Page (Web Browser)

When the customer taps the tracking link, this opens in their browser:

```
┌─────────────────────────────────────────────────────────────┐
│ 🔧 ServiFrío - Tu servicio en camino          [Logo]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │    [LIVE MAP - Google Maps / Mapbox]                │   │
│  │                                                     │   │
│  │         📍 Tu casa                                  │   │
│  │              ╲                                      │   │
│  │               ╲  ← Animated route line              │   │
│  │                ╲                                    │   │
│  │              🚐 ← Cute van icon (moves every 30s)  │   │
│  │             Carlos                                  │   │
│  │                                                     │   │
│  │    Supports: driving, walking, public transit       │   │
│  │    (technicians often walk in BA neighborhoods)     │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  ⏱️ Llegada estimada: 12 min (~14:30)               │   │
│  │  ████████████░░░░░░░░  ← Progress bar               │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ 👤 Carlos R.     │  │ 📞 Llamar        │                │
│  │ ⭐ 4.8 (127)     │  │ 💬 WhatsApp      │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                             │
│  Servicio: Instalación split 3000 frigorías                │
│  Referencia: #JOB-2024-001234                               │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Powered by CampoTech                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Tracking Experience by Tier

| Tier | Tracking Type | Map Provider | Features |
|------|---------------|--------------|----------|
| **BÁSICO** | Static snapshot | Google Static Maps | Single map image + estimated time, no live updates |
| **PROFESIONAL** | Live tracking | Mapbox | Animated technician icon, route line, auto-refresh every 30s |
| **EMPRESARIAL** | Premium live | Google Maps | Traffic-aware ETA, walking/driving detection, street view preview |

#### Technician View (Mobile App)

```
TECHNICIAN VIEW (CampoTech Mobile App)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  📍 Navegando a: Av. Corrientes 1234, 5°A                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │         [NAVIGATION MODE]                           │   │
│  │         Opens Google Maps / Waze                    │   │
│  │                                                     │   │
│  │         Deep link to navigation app                 │   │
│  │         with destination pre-filled                 │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Cliente: María López                                       │
│  📞 +54 11 9876-5432                                        │
│                                                             │
│  Notas: Portero eléctrico, timbre 5A                        │
│         Tiene perro (no muerde)                             │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ 📞 Llamar   │  │ 💬 WhatsApp │  │ ✅ Llegué           │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                             │
│  GPS tracking: Active (sending every 30 seconds)            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. User Journeys

### 3.1 Business Owner Journey

```
Day 1: Discovery & Setup
├── Finds CampoTech via Google/referral
├── Signs up for free trial
├── Completes business setup wizard
├── Adds 2 technicians
└── Creates first test job

Week 1: Learning
├── Receives real customer inquiry
├── Creates job manually
├── Assigns to technician
├── Sees job completed in dashboard
└── Sends first invoice

Month 1: Adoption
├── 15 jobs processed
├── Upgrades to paid plan
├── Connects WhatsApp (Profesional tier)
├── Team using mobile app daily
└── First automated job from WhatsApp

Month 3: Scaling
├── 50+ jobs/month
├── Adds 3 more technicians
├── Uses reporting for business insights
├── Customer reviews building reputation
└── Considers Empresarial tier
```

### 3.2 Technician Journey

```
Onboarding:
├── Receives WhatsApp: "Fuiste agregado al equipo de ServiFrío"
├── Downloads CampoTech app
├── Logs in with phone number
└── Completes profile (photo, skills, availability)

Daily Workflow:
┌─────────────────────────────────────────────────────────────┐
│ 8:00 AM  📱 Push notification: "3 trabajos asignados hoy"   │
│                                                             │
│ 8:30 AM  Review day's schedule in app                       │
│          ┌─────────────────────────────────────────────┐    │
│          │ 09:00 - Instalación split - Palermo         │    │
│          │ 12:00 - Reparación - Belgrano               │    │
│          │ 16:00 - Mantenimiento - Recoleta            │    │
│          └─────────────────────────────────────────────┘    │
│                                                             │
│ 9:00 AM  Tap "En camino" → Customer notified               │
│          GPS tracking starts                                │
│                                                             │
│ 9:25 AM  Tap "Llegué" → Customer notified                  │
│                                                             │
│ 9:30 AM  Tap "Iniciar trabajo"                             │
│          Take before photos                                 │
│                                                             │
│ 11:00 AM Tap "Completar"                                   │
│          • Take after photos                                │
│          • Note materials used                              │
│          • Customer signs on screen                         │
│          • Rating requested                                 │
│                                                             │
│ 11:05 AM Move to next job                                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Customer Journey

```
Initial Contact:
├── Has HVAC problem
├── Searches "técnico aire acondicionado" or asks friend
├── Contacts ServiFrío via WhatsApp
└── Sends voice message describing problem

Booking:
├── Receives auto-reply or confirmation message
├── Confirms date/time
├── Gets job reference number
└── Receives calendar reminder

Service Day:
├── Morning reminder notification
├── "Técnico en camino" notification
├── Tracks technician on map
├── Technician arrives, completes work
├── Signs completion on technician's phone
└── Rates service (1-5 stars)

Post-Service:
├── Receives invoice via WhatsApp
├── Pays via MercadoPago link or cash
├── Gets payment confirmation
└── Stored in system for future reference
```

---

## 4. WhatsApp Integration Strategy

### 4.1 WhatsApp Business App vs API

| Feature | Business App (Free) | Business API |
|---------|---------------------|--------------|
| **Cost** | Free | ~$50-100/month via BSP |
| **Setup** | Download app | Meta verification required |
| **Automation** | None | Full (webhooks, bots) |
| **Multi-user** | Limited | Unlimited agents |
| **Message templates** | No | Yes (pre-approved) |
| **CampoTech integration** | Manual forward | Automatic |
| **Best for** | Básico tier | Profesional/Empresarial |

### 4.2 Integration Models Evaluated

#### Model A: Become a BSP (Business Solution Provider)
```
Meta → CampoTech (BSP) → Customers
```
**Decision: REJECTED**
- Requires Meta partnership approval (6-12 months)
- Complex compliance requirements
- High support burden
- Only viable at 500+ customers

#### Model B: Customer Gets Own API Account
```
Meta → Twilio → Customer's Account → CampoTech webhook
```
**Decision: REJECTED for primary model**
- Complex for small businesses
- Customer manages two relationships
- Inconsistent experience

#### Model C: CampoTech as Aggregator ✅ SELECTED
```
Meta → Twilio → CampoTech Master Account → Customer numbers
```
**Decision: SELECTED**
- Simple for customer (one bill)
- CampoTech controls experience
- Better margins
- Handles verification for customers

#### Model D: Forward-to-Process (Básico) ✅ SELECTED
```
Customer's WhatsApp App → Forward to CampoTech → Process
```
**Decision: SELECTED for Básico tier**
- Zero Meta dependencies
- Works with free WhatsApp Business App
- Good entry point for small businesses

### 4.3 Dual-App Solution

Addresses the concern: *"Do they need two phones?"*

```
📱 Same Phone, Two Apps
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │   [WhatsApp]     │    │ [WhatsApp        │              │
│  │                  │    │  Business]       │              │
│  │   Personal       │    │                  │              │
│  │   +54 11 1111    │    │  Business        │              │
│  │                  │    │  +54 11 2222     │              │
│  │   Family         │    │       │          │              │
│  │   Friends        │    │       ▼          │              │
│  │                  │    │  [CampoTech]     │              │
│  │   ❌ CampoTech   │    │  Only sees       │              │
│  │   cannot access  │    │  business msgs   │              │
│  └──────────────────┘    └──────────────────┘              │
│                                                             │
│  Second number options:                                     │
│  • eSIM: ~$500 ARS/month (Tuenti, Personal prepago)        │
│  • Dual-SIM: Most Argentine phones support this            │
│  • Virtual number: Provided by CampoTech (Profesional)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 WhatsApp Templates (Pre-approved)

All templates use Argentine Spanish (`es_AR`) with "vos" conjugation:

| Template | Trigger | Content |
|----------|---------|---------|
| `job_scheduled` | Job created | "¡Hola {{name}}! Tu servicio de {{service}} está agendado para el {{date}}. Te vamos a avisar cuando el técnico esté en camino." |
| `technician_on_way` | Status: EN_ROUTE | "{{tech_name}} está en camino. Llegada estimada: {{eta}}. Podés seguir su ubicación acá: {{tracking_url}}" |
| `job_completed` | Status: COMPLETED | "✅ Trabajo completado. {{tech_name}} terminó el servicio. ¿Cómo fue tu experiencia? {{rating_url}}" |
| `invoice_ready` | Invoice generated | "Tu factura está lista: {{invoice_url}}. Total: ${{amount}}. Pagá con MercadoPago: {{payment_url}}" |
| `payment_confirmed` | Payment received | "¡Gracias! Recibimos tu pago de ${{amount}}. Comprobante: {{receipt_url}}" |
| `appointment_reminder` | 24h before job | "Recordatorio: Mañana {{date}} a las {{time}} tenés agendado {{service}}. ¿Confirmamos? Respondé SI o NO" |

---

## 5. Message Classification System

### 5.1 How It Works

When a WhatsApp message arrives, CampoTech uses GPT-4o to understand intent:

```
📱 Message arrives → 🤖 GPT-4o analyzes → Classification
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
              JOB REQUEST            QUESTION/INQUIRY            UNRELATED
         "Necesito instalar        "¿Cuánto sale              "Hola che, cómo
          un aire en Palermo"       una instalación?"          andás?"
                    │                         │                         │
                    ▼                         ▼                         ▼
            Extract details            Auto-reply with            Human review
            → Create job               pricing/FAQ                queue
```

### 5.2 Confidence-Based Routing

| Confidence Score | Route | Action |
|------------------|-------|--------|
| ≥85% | `auto_create` | Create job automatically, notify customer |
| 65-84% | `confirm_user` | Send confirmation message, wait for reply |
| <65% | `human_review` | Add to review queue for manual processing |

### 5.3 Extraction Fields

GPT-4o extracts the following from messages:

| Field | Example | Confidence Indicators |
|-------|---------|----------------------|
| `customerName` | "María López" | 0.9+ if explicitly stated |
| `customerPhone` | "+54 11 4567-8901" | Usually from message metadata |
| `customerAddress` | "Av. Corrientes 1234, 5°A, CABA" | 0.7+ if complete |
| `serviceType` | "instalacion_split" | Mapped from keywords |
| `urgency` | "urgente" / "normal" / "programado" | Based on keywords |
| `description` | "El aire no enfría" | Direct extraction |
| `preferredDate` | "2024-12-15" | Parsed from "mañana", "el lunes", etc. |
| `preferredTimeSlot` | "por la mañana" | Morning/afternoon/evening |

### 5.4 Message Type Handling

| Type | Detection | Response |
|------|-----------|----------|
| **Job Request** | Service keywords + urgency | Extract → Route by confidence |
| **Pricing Question** | "cuánto", "precio", "costo" | Send pricing template |
| **Status Inquiry** | "dónde está", "cuándo viene" | Lookup job, send status |
| **Complaint** | Negative sentiment | Route to human |
| **Greeting Only** | "Hola", "Buen día" | Auto-reply: "¿En qué podemos ayudarte?" |
| **Unrelated** | No service context | Route to human |

### 5.5 Voice Message Processing

```
Voice Message Received
         │
         ▼
┌─────────────────────────────────────────┐
│ Whisper API Transcription               │
│ • Language: Spanish (Argentine)         │
│ • Handles background noise              │
│ • ~95% accuracy for clear audio         │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ GPT-4o Extraction                       │
│ • Same as text messages                 │
│ • Handles informal speech               │
│ • Understands Argentine slang           │
└─────────────────────────────────────────┘
         │
         ▼
    Standard routing
```

---

## 6. Subscription Tiers & Pricing

### 6.1 Tier Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │     BÁSICO      │  │  PROFESIONAL    │  │   EMPRESARIAL   │     │
│  │                 │  │                 │  │                 │     │
│  │    $20/mes      │  │    $45/mes      │  │    $89/mes      │     │
│  │                 │  │                 │  │                 │     │
│  │  Small business │  │ Growing business│  │ Established     │     │
│  │  starting out   │  │ ready to scale  │  │ company         │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Feature Comparison

| Feature | BÁSICO ($20/mes) | PROFESIONAL ($45/mes) | EMPRESARIAL ($89/mes) |
|---------|------------------|----------------------|----------------------|
| **Dashboard & Mobile App** | ✅ | ✅ | ✅ |
| **Team Members** | Up to 3 | Up to 10 | Unlimited |
| **Jobs per Month** | 50 | 200 | Unlimited |
| **Customer Database** | ✅ | ✅ | ✅ |
| **Basic Scheduling** | ✅ | ✅ | ✅ |
| **Email Notifications** | ✅ | ✅ | ✅ |
| **WhatsApp Integration** | Manual forward | Full API integration | Full API + multi-number |
| **WhatsApp Number** | — | 1 dedicated number | 3 numbers included |
| **WhatsApp Conversations** | — | 200/month included | Unlimited |
| **Voice AI Processing** | — | ✅ | ✅ |
| **Auto Job Creation** | — | ✅ | ✅ |
| **Customer Tracking** | Static map + ETA | Live tracking (Mapbox) | Premium live (Google Maps) |
| **Traffic-Aware ETA** | — | — | ✅ (Google Directions API) |
| **AFIP Invoicing** | Basic | Full | Full + batch |
| **MercadoPago Integration** | — | ✅ | ✅ |
| **Reports & Analytics** | Basic | Advanced | Advanced + export |
| **API Access** | — | — | ✅ |
| **Priority Support** | Email | Email + Chat | Dedicated account manager |

### 6.3 WhatsApp Add-on Pricing

For Profesional and Empresarial tiers:

| Item | Included | Extra Cost |
|------|----------|------------|
| **Dedicated Number** | 1 (Pro) / 3 (Emp) | $15/month per additional |
| **Conversations** | 200 (Pro) / Unlimited | $0.15 per extra conversation |
| **Voice Transcription** | 100 min (Pro) / 500 min | $0.10 per extra minute |

### 6.4 Cost Structure for CampoTech (100 Customers)

**Wholesale Costs (what you pay):**

| Item | Per Customer | 100 Customers |
|------|--------------|---------------|
| Phone number (Twilio) | $1.50/month | $150/month |
| Meta conversation fees | ~$7.50/month (avg 150 convos) | $750/month |
| Whisper API (voice) | ~$1.00/month | $100/month |
| GPT-4o (extraction) | ~$2.00/month | $200/month |
| Infrastructure | ~$0.50/month | $50/month |
| **Total Cost** | **~$12.50/month** | **~$1,250/month** |

**Retail Revenue:**

| Plan Mix | Customers | Revenue |
|----------|-----------|---------|
| 40% Básico | 40 × $20 | $800/month |
| 45% Profesional | 45 × $45 | $2,025/month |
| 15% Empresarial | 15 × $89 | $1,335/month |
| **Total Revenue** | **100** | **$4,160/month** |

**Margin:**
```
Revenue:     $4,160/month
Costs:       $1,250/month
─────────────────────────
Margin:      $2,910/month (70%)
```

### 6.5 Trial & Onboarding

```
FREE TRIAL (14 days):
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ✅ Full Profesional features                               │
│  ✅ WhatsApp integration enabled                            │
│  ✅ Up to 20 test jobs                                      │
│  ✅ Up to 50 WhatsApp conversations                         │
│                                                             │
│  No credit card required to start                           │
│                                                             │
│  Day 10: "Tu prueba termina en 4 días. Elegí tu plan:"     │
│  Day 14: Account limited to Básico features                 │
│  Day 21: Account paused if no plan selected                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Privacy & Trust Communication

### 7.1 Key Privacy Message

**Core message:** *"CampoTech solo ve los mensajes de tu número de negocio. Tu WhatsApp personal es imposible que lo veamos."*

### 7.2 Technical Explanation

```
┌─────────────────────────────────────────────────────────────┐
│ 📱 Tu celular                                               │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │   WhatsApp       │    │ WhatsApp Business │              │
│  │   (personal)     │    │   (negocio)       │              │
│  │                  │    │                   │              │
│  │ +54 11 1111-1111 │    │ +54 11 2222-2222  │              │
│  │                  │    │        │          │              │
│  │  Mamá            │    │        ▼          │              │
│  │  Amigos          │    │   [CampoTech]     │              │
│  │  Familia         │    │   Solo ve estos   │              │
│  │                  │    │   mensajes        │              │
│  │  ❌ CampoTech    │    │                   │              │
│  │  NO puede        │    │                   │              │
│  │  ver nada        │    │                   │              │
│  └──────────────────┘    └──────────────────┘              │
│                                                             │
│  DOS apps diferentes, DOS números diferentes                │
│  Técnicamente IMPOSIBLE que veamos tu WhatsApp personal     │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 In-App Privacy Notice (During Setup)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  🔒 Tu privacidad está protegida                           │
│                                                             │
│  Al conectar WhatsApp Business a CampoTech:                │
│                                                             │
│  ✅ Vemos: Mensajes de clientes a tu número de negocio     │
│  ❌ NO vemos: Tu WhatsApp personal                         │
│  ❌ NO vemos: Tus contactos                                │
│  ❌ NO vemos: Tus fotos o archivos                         │
│                                                             │
│  Son dos aplicaciones separadas. Es técnicamente           │
│  imposible que accedamos a tu WhatsApp personal.           │
│                                                             │
│  [Más información]              [Continuar →]              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 Privacy Policy Section

```markdown
## Privacidad de WhatsApp

CampoTech SOLO tiene acceso a los mensajes enviados al número
de WhatsApp Business conectado a tu cuenta de CampoTech.

### Lo que SÍ procesamos:
- Mensajes de texto enviados por tus clientes al número de negocio
- Mensajes de voz enviados por tus clientes (para transcripción)
- Archivos enviados por clientes (fotos de problemas, etc.)

### Lo que NO podemos acceder (técnicamente imposible):
- Tu WhatsApp personal
- Otros números de WhatsApp que tengas
- Mensajes de otras aplicaciones
- Contactos de tu teléfono
- Fotos, archivos o datos personales no enviados al número de negocio

### Por qué es imposible:
WhatsApp Business API envía webhooks SOLO del número específico
conectado. No existe forma técnica de acceder a otras conversaciones,
ya que cada número opera en un canal completamente separado.
```

### 7.5 FAQ Responses

**P: ¿CampoTech puede ver mis mensajes personales de WhatsApp?**

R: No, es técnicamente imposible. WhatsApp Business usa un número SEPARADO de tu WhatsApp personal. Son dos aplicaciones diferentes. CampoTech solo recibe los mensajes que tus clientes envían al número de negocio que conectaste. Tu WhatsApp personal (familia, amigos) nunca pasa por nuestros servidores.

**P: ¿Y si uso el mismo número para todo?**

R: Para usar CampoTech Profesional, necesitás un número dedicado al negocio. Podés:
- Usar tu número actual de WhatsApp Business (si ya tenés uno separado)
- Te damos un número nuevo incluido en el plan
- Conseguir un chip prepago (~$500 ARS/mes) para el negocio

Esto también te ayuda a separar vida personal y trabajo.

**P: ¿Qué pasa si un cliente me escribe algo personal?**

R: Si un cliente te escribe algo personal al número de negocio (ej: "feliz cumpleaños"), CampoTech lo recibe porque fue enviado al número conectado. Sin embargo, nuestro sistema clasifica estos mensajes como "no relacionados a trabajo" y los deja para que vos respondas manualmente. No se crea ningún trabajo automáticamente.

---

## 8. Technical Architecture

### 8.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                     │
├─────────────────────────────────────────────────────────────────────┤
│  📱 Mobile App        🖥️ Web Dashboard        💬 WhatsApp          │
│  (React Native)       (Next.js)              (Business API)        │
└──────────┬───────────────────┬───────────────────────┬─────────────┘
           │                   │                       │
           ▼                   ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Next.js API Routes (/api/*)                                        │
│  ├── /api/auth/*           Authentication                           │
│  ├── /api/jobs/*           Job management                           │
│  ├── /api/users/*          User/team management                     │
│  ├── /api/customers/*      Customer database                        │
│  ├── /api/invoices/*       AFIP invoicing                           │
│  └── /api/webhooks/*       External service callbacks               │
└──────────┬─────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BUSINESS LOGIC                                  │
├─────────────────────────────────────────────────────────────────────┤
│  src/                                                               │
│  ├── integrations/                                                  │
│  │   ├── whatsapp/          WhatsApp Business API                   │
│  │   ├── voice-ai/          Whisper + GPT extraction                │
│  │   ├── mercadopago/       Payments                                │
│  │   └── afip/              Argentine tax invoicing                 │
│  ├── workers/               Background job processing               │
│  └── lib/                   Shared utilities                        │
└──────────┬─────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                     │
├─────────────────────────────────────────────────────────────────────┤
│  PostgreSQL (Prisma)        Redis                 S3/R2             │
│  ├── Users                  ├── Sessions          ├── Job photos    │
│  ├── Organizations          ├── Rate limits       ├── Invoices PDF  │
│  ├── Jobs                   ├── Job queues        └── Attachments   │
│  ├── Customers              └── Cache                               │
│  ├── Invoices                                                       │
│  └── Notifications                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 WhatsApp Integration Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WHATSAPP MESSAGE FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Customer Phone                                                     │
│       │                                                             │
│       ▼                                                             │
│  WhatsApp Cloud API (Meta)                                          │
│       │                                                             │
│       ▼                                                             │
│  /api/webhooks/whatsapp                                             │
│       │                                                             │
│       ├── Verify signature (HMAC)                                   │
│       ├── Parse message                                             │
│       │       │                                                     │
│       │       ├── Text → Direct to extraction                       │
│       │       ├── Voice → Download → Whisper → Extraction           │
│       │       └── Image → Store for job attachment                  │
│       │                                                             │
│       ▼                                                             │
│  GPT Extractor                                                      │
│       │                                                             │
│       ├── Extract fields (name, address, service, etc.)             │
│       ├── Calculate confidence                                      │
│       └── Return ExtractedJobRequest                                │
│               │                                                     │
│               ▼                                                     │
│       Confidence Router                                             │
│               │                                                     │
│               ├── ≥85% → JobService.create() → Notify customer      │
│               ├── 65-84% → Send confirmation template               │
│               └── <65% → Add to review queue                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.3 Key File Locations

| Component | Location |
|-----------|----------|
| WhatsApp webhook handler | `src/integrations/whatsapp/webhook/webhook.handler.ts` |
| GPT extraction | `src/integrations/voice-ai/extraction/gpt-extractor.ts` |
| Extraction prompts | `src/integrations/voice-ai/extraction/prompts/extraction.prompt.ts` |
| Confidence routing | `src/integrations/voice-ai/routing/confidence-router.ts` |
| WhatsApp templates | `src/integrations/whatsapp/templates/template-registry.ts` |
| Team member management | `apps/web/app/dashboard/settings/team/page.tsx` |
| User API (create members) | `apps/web/app/api/users/route.ts` |
| AFIP integration | `src/integrations/afip/` |
| MercadoPago integration | `src/integrations/mercadopago/` |

### 8.4 Customer Live Tracking System

The tracking system allows customers (who don't have the CampoTech app) to track their technician via a web link sent through WhatsApp.

#### 8.4.1 Why Web-Based (Not In-WhatsApp)

**WhatsApp Limitations:**
- ❌ Cannot send animated/live updating maps inside chat
- ❌ Cannot programmatically share live location (user-initiated only)
- ❌ Cannot embed interactive maps in messages
- ✅ CAN send a tracking link that opens in browser
- ✅ CAN send interactive buttons ("Ver ubicación" → opens link)

**Solution:** Send WhatsApp message with tracking URL → Customer opens in browser → Live map experience

#### 8.4.2 Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     LIVE TRACKING FLOW                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TECHNICIAN APP                         SERVER                      │
│       │                                    │                        │
│       │ GPS coords every 30 sec            │                        │
│       │ ──────────────────────────────────►│                        │
│       │ POST /api/tracking/update          │                        │
│       │ {                                  │                        │
│       │   jobId: "ABC123",                 │                        │
│       │   lat: -34.6037,                   │                        │
│       │   lng: -58.3816,                   │                        │
│       │   speed: 15,        // km/h        │                        │
│       │   heading: 45,      // degrees     │                        │
│       │   mode: "walking",  // or driving  │                        │
│       │   timestamp: ...                   │                        │
│       │ }                                  │                        │
│       │                                    │                        │
│       │                                    │  Store in Redis        │
│       │                                    │  Key: tracking:ABC123  │
│       │                                    │  TTL: 2 hours          │
│       │                                    │                        │
│                                            │                        │
│  CUSTOMER BROWSER                          │                        │
│  (track.campotech.com.ar/j/ABC123)         │                        │
│       │                                    │                        │
│       │  Poll every 10 sec                 │                        │
│       │  GET /api/tracking/ABC123          │                        │
│       │ ──────────────────────────────────►│                        │
│       │                                    │                        │
│       │◄────────────────────────────────── │                        │
│       │  {                                 │                        │
│       │    lat, lng,                       │                        │
│       │    eta: "12 min",                  │                        │
│       │    route: [...polyline...],        │                        │
│       │    techName: "Carlos R.",          │                        │
│       │    techPhoto: "...",               │                        │
│       │    techRating: 4.8                 │                        │
│       │  }                                 │                        │
│       │                                    │                        │
│       ▼                                    │                        │
│  Animate van icon to new position          │                        │
│  Update ETA display                        │                        │
│  Redraw route if changed                   │                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 8.4.3 Map Provider Strategy by Tier

| Tier | Provider | API Used | Cost per 1000 | Features |
|------|----------|----------|---------------|----------|
| **BÁSICO** | Google Static Maps | Static Maps API | ~$2 | Single image, no live updates |
| **PROFESIONAL** | Mapbox | Maps JS + Directions | ~$5 | Live animation, basic routing |
| **EMPRESARIAL** | Google Maps | Maps JS + Directions | ~$12 | Traffic-aware, walking detection |

**Cost Calculation (100 customers, ~200 jobs/month):**

```
BÁSICO (40 customers × 80 jobs × 1 static image):
├── Static map loads: 3,200/month
├── Cost: ~$6.40/month
└── Per customer: ~$0.16/month

PROFESIONAL (45 customers × 90 jobs × avg 5 page loads):
├── Map loads: 20,250/month
├── Direction requests: 4,050/month
├── Mapbox cost: ~$125/month
└── Per customer: ~$2.78/month

EMPRESARIAL (15 customers × 300 jobs × avg 8 page loads):
├── Map loads: 36,000/month
├── Direction requests (traffic): 7,200/month
├── Google Maps cost: ~$432/month
└── Per customer: ~$28.80/month
```

#### 8.4.4 Frontend Implementation

**Animated Van Movement:**

```javascript
// Smooth animation between GPS updates
class TechnicianMarker {
  constructor(map, initialPosition) {
    this.marker = new mapboxgl.Marker({
      element: this.createVanElement()
    }).setLngLat(initialPosition).addTo(map);
  }

  createVanElement() {
    const el = document.createElement('div');
    el.className = 'technician-van';
    el.innerHTML = '🚐'; // Or custom SVG
    el.style.fontSize = '32px';
    el.style.transition = 'transform 0.5s ease-out';
    return el;
  }

  animateTo(newPosition, duration = 2000) {
    const start = this.marker.getLngLat();
    const startTime = performance.now();

    // Calculate rotation angle (van faces direction of travel)
    const angle = this.calculateBearing(start, newPosition);
    this.marker.getElement().style.transform = `rotate(${angle}deg)`;

    // Smooth position animation
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out function for natural movement
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const lng = start.lng + (newPosition.lng - start.lng) * easeOut;
      const lat = start.lat + (newPosition.lat - start.lat) * easeOut;

      this.marker.setLngLat([lng, lat]);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  calculateBearing(start, end) {
    const dLng = (end.lng - start.lng) * Math.PI / 180;
    const lat1 = start.lat * Math.PI / 180;
    const lat2 = end.lat * Math.PI / 180;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
}
```

**Tracking Page Component (React):**

```typescript
// apps/web/app/track/[jobId]/page.tsx

interface TrackingData {
  lat: number;
  lng: number;
  eta: string;
  etaMinutes: number;
  route: [number, number][];
  technician: {
    name: string;
    photo: string;
    rating: number;
    phone: string;
  };
  job: {
    service: string;
    reference: string;
    customerAddress: string;
  };
  status: 'en_route' | 'arrived' | 'completed';
}

export default function TrackingPage({ params }: { params: { jobId: string } }) {
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const markerRef = useRef<TechnicianMarker | null>(null);

  // Poll for updates every 10 seconds
  useEffect(() => {
    const fetchTracking = async () => {
      const res = await fetch(`/api/tracking/${params.jobId}`);
      const data = await res.json();

      setTracking(data);

      // Animate marker to new position
      if (markerRef.current && data.lat && data.lng) {
        markerRef.current.animateTo({ lat: data.lat, lng: data.lng });
      }
    };

    fetchTracking();
    const interval = setInterval(fetchTracking, 10000);

    return () => clearInterval(interval);
  }, [params.jobId]);

  // ... render map and UI
}
```

#### 8.4.5 ETA Calculation

**For Buenos Aires**, traffic-aware routing is essential:

```typescript
// src/services/tracking/eta-calculator.ts

interface ETARequest {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode: 'driving' | 'walking' | 'transit';
  tier: 'basico' | 'profesional' | 'empresarial';
}

async function calculateETA(request: ETARequest): Promise<{
  duration: string;
  durationMinutes: number;
  trafficAware: boolean;
}> {
  const { tier, mode, origin, destination } = request;

  // BÁSICO: Simple distance-based estimate (no API call)
  if (tier === 'basico') {
    const distance = haversineDistance(origin, destination);
    const speed = mode === 'walking' ? 5 : 20; // km/h (conservative for BA traffic)
    const minutes = Math.ceil((distance / speed) * 60);
    return {
      duration: `~${minutes} min`,
      durationMinutes: minutes,
      trafficAware: false
    };
  }

  // PROFESIONAL: Mapbox Directions (no real-time traffic)
  if (tier === 'profesional') {
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${mode}/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
      `?access_token=${MAPBOX_TOKEN}`
    );
    const data = await response.json();
    const minutes = Math.ceil(data.routes[0].duration / 60);
    return {
      duration: `~${minutes} min`,
      durationMinutes: minutes,
      trafficAware: false
    };
  }

  // EMPRESARIAL: Google Maps with real-time traffic
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?` +
    `origin=${origin.lat},${origin.lng}&` +
    `destination=${destination.lat},${destination.lng}&` +
    `mode=${mode}&` +
    `departure_time=now&` +  // Enables traffic-aware routing
    `key=${GOOGLE_MAPS_KEY}`
  );
  const data = await response.json();
  const leg = data.routes[0].legs[0];

  // Use duration_in_traffic when available
  const durationSeconds = leg.duration_in_traffic?.value || leg.duration.value;
  const minutes = Math.ceil(durationSeconds / 60);

  return {
    duration: `~${minutes} min`,
    durationMinutes: minutes,
    trafficAware: !!leg.duration_in_traffic
  };
}
```

#### 8.4.6 Walking vs Driving Detection

Technicians in Buenos Aires often walk between nearby jobs. The system auto-detects movement mode:

```typescript
// src/services/tracking/mode-detector.ts

interface LocationUpdate {
  lat: number;
  lng: number;
  speed: number;      // km/h from device
  timestamp: number;
}

function detectMovementMode(
  history: LocationUpdate[],
  currentSpeed: number
): 'walking' | 'driving' | 'stationary' {
  // Stationary if speed < 1 km/h for 30+ seconds
  if (currentSpeed < 1) {
    const recentUpdates = history.filter(
      u => Date.now() - u.timestamp < 30000
    );
    if (recentUpdates.every(u => u.speed < 1)) {
      return 'stationary';
    }
  }

  // Walking: 1-7 km/h
  if (currentSpeed >= 1 && currentSpeed <= 7) {
    return 'walking';
  }

  // Driving: > 7 km/h
  return 'driving';
}
```

#### 8.4.7 Tracking Link Security

```typescript
// Tracking links use short-lived, unguessable tokens

// Generate tracking token when job status → EN_ROUTE
function generateTrackingToken(jobId: string): string {
  const token = crypto.randomBytes(16).toString('base64url');

  // Store in Redis with 4-hour expiry
  redis.setex(`tracking:token:${token}`, 14400, jobId);

  return token;
}

// Tracking URL format
// track.campotech.com.ar/j/{token}
// Example: track.campotech.com.ar/j/xK9mNp2qR5tY8wZ1

// Validation on page load
async function validateTrackingToken(token: string): Promise<string | null> {
  const jobId = await redis.get(`tracking:token:${token}`);
  return jobId;
}
```

#### 8.4.8 WhatsApp Template for Tracking

```typescript
// Template: technician_en_route_tracking
{
  name: 'technician_en_route_tracking',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: '🔧 Tu técnico está en camino'
    },
    {
      type: 'BODY',
      text: '{{1}} salió hacia tu ubicación.\n\nLlegada estimada: ~{{2}} minutos\n\nPodés seguir su ubicación en tiempo real:',
      example: { body_text: [['Carlos R.', '12']] }
    },
    {
      type: 'BUTTONS',
      buttons: [
        {
          type: 'URL',
          text: '📍 Ver ubicación en vivo',
          url: 'https://track.campotech.com.ar/j/{{1}}',
          example: ['xK9mNp2qR5tY8wZ1']
        }
      ]
    }
  ]
}
```

---

## 9. Rejected Alternatives

### 9.1 WhatsApp Integration Alternatives

#### Alternative: Become a BSP (Business Solution Provider)
**Why rejected:**
- Meta approval process takes 6-12 months
- Requires dedicated compliance team
- Minimum volume requirements (~500 businesses)
- High liability for message content
- Only makes sense at scale

**When to reconsider:** 500+ active customers on WhatsApp

#### Alternative: Customer Gets Own API Account
**Why rejected:**
- Too complex for small Argentine businesses
- Customer manages two accounts (BSP + CampoTech)
- Inconsistent onboarding experience
- Higher churn due to friction
- Can't control pricing

**When to reconsider:** Enterprise customers who want full control

#### Alternative: SMS-First Communication
**Why rejected:**
- SMS costs money in Argentina (WhatsApp is free)
- 95%+ of Argentines prefer WhatsApp
- SMS seen as outdated/spammy
- Lower open rates (~30% vs 95% for WhatsApp)

**SMS is still used for:**
- OTP/verification codes (required by some regulations)
- Fallback when WhatsApp unreachable
- Customers without smartphones (rare)

#### Alternative: Email-First Communication
**Why rejected:**
- Argentines don't check email regularly for service businesses
- Blue-collar workers often don't have professional email
- Email for documentation only (invoices, receipts)

**Email is used for:**
- Invoice delivery (legal requirement)
- Account notifications
- Weekly/monthly reports (optional)

### 9.2 Pricing Model Alternatives

#### Alternative: Per-Job Pricing
**Why rejected:**
- Unpredictable revenue for CampoTech
- Customers hate variable costs
- Incentivizes underreporting jobs
- Harder to forecast

**When to reconsider:** Very large enterprises with 1000+ jobs/month

#### Alternative: Free Tier with Ads
**Why rejected:**
- Ad revenue too low for B2B SaaS
- Damages professional image
- Argentine SMB market too small for ad scale
- Undermines trust with customer data

#### Alternative: One-Time License
**Why rejected:**
- No recurring revenue
- Can't fund ongoing development
- No incentive to improve after sale
- Support becomes cost center

### 9.3 Technical Architecture Alternatives

#### Alternative: Separate Microservices
**Why rejected:**
- Overkill for current scale
- Higher infrastructure costs
- More complex deployment
- Team too small to manage

**When to reconsider:** 10,000+ active users, dedicated DevOps team

#### Alternative: Mobile-Only (No Web)
**Why rejected:**
- Business owners need desktop for admin tasks
- Scheduling easier on big screen
- Reports and analytics need space
- Some users are desktop-first

#### Alternative: WhatsApp Business App Integration (No API)
**Why rejected:**
- No automation possible
- Can't receive webhooks
- Would require screen scraping (against ToS)
- No programmatic message sending

**However:** Básico tier accommodates free app users via forward-to-process model

### 9.4 Map Provider Alternatives

#### Alternative: OpenStreetMap + Self-Hosted Routing (Free)
**Why rejected:**
- No real-time traffic data - critical failure for Buenos Aires
- BA has notoriously unpredictable traffic (protests, construction, flooding)
- Technicians frequently walk between nearby jobs - need accurate walking ETAs
- Self-hosted routing (OSRM/Valhalla) requires significant DevOps
- ETA accuracy directly impacts customer satisfaction

**The Buenos Aires reality:**
- A 2km trip can take 5 minutes or 45 minutes depending on traffic
- Without traffic awareness, ETAs are essentially useless
- Customers get frustrated when "12 min" becomes 40 min
- Walking is often faster than driving for <1km distances

**Cost savings don't justify poor UX:**
```
OpenStreetMap: $0/month
BUT: Inaccurate ETAs → Customer complaints → Churn → Lost revenue

Google Maps: $30-50/month per 100 customers
BUT: Accurate ETAs → Happy customers → Retention → Worth it
```

**When to reconsider:** Never for Buenos Aires. Only if expanding to rural areas with no traffic.

#### Alternative: HERE Maps
**Why rejected:**
- Less familiar to Argentine users (everyone knows Google Maps)
- Traffic data quality inferior to Google in Buenos Aires
- Similar pricing to Google without the brand recognition
- Smaller developer ecosystem

**When to reconsider:** If Google Maps pricing increases significantly

#### Alternative: Apple MapKit
**Why rejected:**
- Only works well on Apple devices
- Many Argentine technicians use Android (cost)
- Limited traffic data for Buenos Aires
- Web implementation less mature than Google/Mapbox

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **BSP** | Business Solution Provider - Meta-authorized WhatsApp API reseller |
| **CUIT** | Clave Única de Identificación Tributaria - Argentine tax ID |
| **AFIP** | Administración Federal de Ingresos Públicos - Argentine tax authority |
| **UOCRA** | Unión Obrera de la Construcción - Argentine construction workers union (skill level standards) |
| **CCT 76/75** | Convenio Colectivo de Trabajo - Labor agreement defining skill levels |
| **Webhook** | HTTP callback triggered by external events |
| **Conversation** | WhatsApp pricing unit - 24-hour messaging window |
| **Whisper** | OpenAI's speech-to-text API |
| **GPT-4o** | OpenAI model used for message extraction |
| **MercadoPago** | Argentine payment processor (like PayPal/Stripe) |
| **Split** | Air conditioning unit (common term in Argentina) |
| **Voseo** | Argentine Spanish using "vos" instead of "tú" |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12-09 | Initial comprehensive documentation |
| 1.1 | 2024-12-09 | Added Customer Live Tracking System (Section 8.4) with technical implementation, tier-based map providers (Básico: static, Profesional: Mapbox, Empresarial: Google Maps), walking/driving detection, and rejected OpenStreetMap alternative |

---

*This document is part of the CampoTech architecture documentation. For implementation details, see `FULL-IMPLEMENTATION-PLAN.md`.*
