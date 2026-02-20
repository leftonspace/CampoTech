---
tags:
  - index
  - moc
  - navigation
status: 🟢 Active
type: Index
updated: 2026-02-13
---

# 🗂️ CampoTech Architecture Index

> [!INFO] **Welcome to the CampoTech Documentation Hub**
> This is the main entry point for understanding the CampoTech application architecture. CampoTech is a **B2B SaaS platform for field service businesses in Argentina** — plumbers, electricians, HVAC technicians, and similar trades. It provides intelligent dispatch, real-time tracking, AFIP-compliant invoicing, WhatsApp AI automation, and a commission-free marketplace.

---

## 🏛️ Platform Overview

| Attribute | Detail |
|:---|:---|
| **Target Market** | Argentina (es-AR) — field service businesses |
| **Architecture** | Next.js 14+ App Router (web) + Expo React Native (mobile) |
| **Database** | PostgreSQL via Supabase + Prisma ORM |
| **Package Manager** | pnpm (monorepo with workspaces) |
| **Multi-Tenancy** | Organization-scoped (`organizationId` on 81+ tables) |
| **Pricing** | 4-tier: FREE → INICIAL → PROFESIONAL → EMPRESA |
| **Localization** | ARS currency, CUIT validation (Mod-11), +54 phone format |

### Monorepo Structure
```text
CampoTech/
├── apps/
│   ├── web/          # Next.js 14 web application (main)
│   ├── mobile/       # Expo React Native (technician app)
│   └── admin/        # Admin dashboard
├── services/
│   └── ai/           # Python AI service (LangGraph agent)
├── packages/         # Shared TypeScript packages
└── architecture/     # This documentation
```

---

## 📖 Getting Started

| Document | Description |
|:---|:---|
| [[Page Structure Reference]] | Standard patterns for page documentation |
| [[Product Strategy]] | Product roadmap and integrations |
| [[Sitemap.canvas]] | Visual map of application flow |

---

## 🌐 Public Pages

These pages are accessible without authentication.

| Page | Status | Description |
|:---|:---:|:---|
| [[Landing Page]] | 🟢 | Main marketing entry point with security showcase |
| [[Login Flow]] | 🟢 | Passwordless OTP authentication |
| [[Signup Flow]] | 🟡 | Phone-based account creation |
| [[Legal Pages]] | 🟢 | Argentine legal requirements (Ley 25.326, Ley 24.240) |
| [[Company Pages]] | 🟡 | Blog, About Us |
| [[Product Strategy]] | 🟡 | Integrations, API docs |
| [[Public Business Profile]] | 🟢 | `/perfil/[slug]` — SEO-optimized marketplace page |
| [[Public AI Chat]] | 🟢 | Landing page visitor support chatbot |

---

## 📊 Dashboard Pages

Core application pages accessible after login.

### Primary Navigation (Sidebar)

| Page | Route | Status | Tier | Description |
|:---|:---|:---:|:---:|:---|
| [[Dashboard Home]] | `/dashboard` | 🟢 | FREE | Main cockpit: today's jobs, stats, team status |
| [[Map View]] | `/dashboard/map` | 🟢 | PROFESIONAL | Real-time GPS tracking of technicians |
| [[Calendar Page]] | `/dashboard/calendar` | 🟢 | INICIAL | Job scheduling with drag-and-drop |
| [[Schedule Page]] | `/dashboard/schedule` | 🟢 | INICIAL | Technician shift scheduling |
| [[Jobs Page]] | `/dashboard/jobs` | 🟢 | FREE | Work order management (all statuses) |
| [[Dispatch Page]] | `/dashboard/dispatch` | 🟢 | PROFESIONAL | AI dispatch + route intelligence |
| [[Customers Page]] | `/dashboard/customers` | 🟢 | FREE | Client management + data folders |
| [[Leads Page]] | `/dashboard/leads` | 🟢 | INICIAL | Lead pipeline + marketplace conversions |
| [[Team Page]] | `/dashboard/team` | 🟢 | INICIAL | Technician management + availability |
| [[Fleet Page]] | `/dashboard/fleet` | 🟢 | PROFESIONAL | Vehicle management + assignment |
| [[Inventory Page]] | `/dashboard/inventory` | 🟢 | PROFESIONAL | Parts, materials, warehouses, stock |
| [[Invoices Page]] | `/dashboard/invoices` | 🟢 | FREE | Billing, AFIP CAE issuance |
| [[Payments Page]] | `/dashboard/payments` | 🟢 | INICIAL | Payment tracking + reconciliation |
| [[Analytics Page]] | `/dashboard/analytics` | 🟢 | EMPRESA | Business intelligence + predictions |
| [[WhatsApp Page]] | `/dashboard/whatsapp` | 🟢 | INICIAL | AI messaging + shared inbox |
| [[Voice Review Page]] | `/dashboard/voice-review` | 🟢 | PROFESIONAL | Audio message transcription + review |

### Secondary Pages

| Page | Route | Status | Description |
|:---|:---|:---:|:---|
| [[Settings Page]] | `/dashboard/settings` | 🟢 | Organization configuration hub |
| [[Profile Page]] | `/dashboard/profile` | 🟢 | Personal settings |
| [[New Job Page]] | `/dashboard/jobs/new` | 🟢 | Create work order |
| [[Job Detail Page]] | `/dashboard/jobs/[id]` | 🟢 | Read-only forensic job view |
| [[Pending Variance Page]] | `/dashboard/jobs/pending-variance` | 🟢 | Rounding drift detection |
| [[Customer Detail Page]] | `/dashboard/customers/[id]` | 🟢 | Individual customer view |
| [[Client Data Folder]] | `/dashboard/customers/[id]/folder` | 🟢 | ARCO compliance data export |
| [[New Customer Page]] | `/dashboard/customers/new` | 🟢 | Customer creation form |
| [[Lead Detail Page]] | `/dashboard/leads/[id]` | 🟢 | Individual lead management |
| [[Lead Analytics]] | `/dashboard/leads/analytics` | 🟢 | Lead source/conversion analysis |
| [[Lead Settings]] | `/dashboard/leads/settings` | 🟢 | Lead pipeline configuration |
| [[Verification Flow]] | `/dashboard/verificacion` | 🟢 | Org identity verification |
| [[My Verification]] | `/dashboard/mi-verificacion` | 🟢 | Personal technician verification |
| [[Job Completion Report]] | (Feature) | 🟢 | PDF job documentation |
| [[Marketplace Profile Editor]] | `/dashboard/marketplace/profile` | 🟢 | Edit public business profile |
| [[Marketplace Moderation]] | `/dashboard/marketplace/moderation` | 🟢 | Review marketplace submissions |
| [[Approvals Page]] | `/dashboard/approvals` | 🟢 | Workflow approval queue |
| [[Integrations Page]] | `/dashboard/integrations` | 🟢 | Third-party service connections |
| [[Support Change Request]] | `/dashboard/support/change-request` | 🟢 | Submit/view change requests |
| [[Credits Configuration]] | `/dashboard/configuracion/creditos` | 🟢 | WhatsApp credit management |

### ⚙️ Settings Sub-Pages

| Page | Route | Status | Description |
|:---|:---|:---:|:---|
| [[Organization Settings]] | `/settings/organization` | 🟢 | Company name, logo, contact info |
| [[Billing Settings]] | `/settings/billing` | 🟢 | Subscription plan management |
| [[Billing Success]] | `/settings/billing/success` | 🟢 | Post-payment confirmation |
| [[Billing Pending]] | `/settings/billing/pending` | 🟢 | Payment in process screen |
| [[Billing Failure]] | `/settings/billing/failure` | 🟢 | Payment failure recovery |
| [[AFIP Settings]] | `/settings/afip` | 🟢 | AFIP credential management |
| [[AI Assistant Settings]] | `/settings/ai-assistant` | 🟢 | WhatsApp AI configuration |
| [[Labor Rates Settings]] | `/settings/labor-rates` | 🟢 | UOCRA wage tiers |
| [[MercadoPago Settings]] | `/settings/mercadopago` | 🟢 | Payment integration OAuth |
| [[Notification Settings]] | `/settings/notifications` | 🟢 | Alert preferences |
| [[Pricebook Settings]] | `/settings/pricebook` | 🟢 | Service pricing catalog |
| [[Pricing Settings]] | `/settings/pricing` | 🟢 | Pricing strategies + rounding |
| [[Privacy Settings]] | `/settings/privacy` | 🟢 | Data protection preferences |
| [[Service Types Settings]] | `/settings/service-types` | 🟢 | Trade categories configuration |
| [[Verification Settings]] | `/settings/verification` | 🟢 | Org verification management |
| [[WhatsApp Settings]] | `/settings/whatsapp` | 🟢 | WhatsApp number configuration |
| [[WhatsApp Setup]] | `/settings/whatsapp/setup` | 🟢 | Initial WhatsApp connection |
| [[WhatsApp Templates]] | `/settings/whatsapp/templates` | 🟢 | Message template management |
| [[WhatsApp Usage]] | `/settings/whatsapp/usage` | 🟢 | Credit consumption analytics |

### 📊 Analytics Sub-Pages

| Page | Route | Status | Description |
|:---|:---|:---:|:---|
| [[Analytics Overview]] | `/analytics/overview` | 🟢 | Dashboard-level KPIs |
| [[Revenue Analytics]] | `/analytics/revenue` | 🟢 | Income tracking + trends |
| [[Operations Analytics]] | `/analytics/operations` | 🟢 | Job completion metrics |
| [[Technician Analytics]] | `/analytics/technicians` | 🟢 | Per-tech performance |
| [[Customer Analytics]] | `/analytics/customers` | 🟢 | Customer acquisition + retention |
| [[Marketplace Analytics]] | `/analytics/marketplace` | 🟢 | Profile views, clicks, leads |
| [[AI Analytics]] | `/analytics/ai` | 🟢 | AI usage, escalation rates |
| [[Predictions Analytics]] | `/analytics/predictions` | 🟢 | Revenue + demand forecasting |
| [[Reports Page]] | `/analytics/reports` | 🟢 | Custom report builder |
| [[Scheduled Reports]] | `/analytics/reports/scheduled` | 🟢 | Automated report delivery |
| [[Report History]] | `/analytics/reports/history` | 🟢 | Past generated reports |

### 🛡️ Platform Admin (SUPER_ADMIN Only)

> These pages are only accessible to CampoTech platform administrators (SUPER_ADMIN role).

| Page | Route | Status | Description |
|:---|:---|:---:|:---|
| [[Admin Dashboard]] | `/admin` | 🟢 | Platform-wide overview |
| [[Growth Engine]] | `/admin/growth-engine` | 🟢 | Professional acquisition system |
| [[Growth Engine Profiles]] | `/admin/growth-engine/profiles` | 🟢 | Scraped professional profiles |
| [[Growth Engine Scrapers]] | `/admin/growth-engine/scrapers` | 🟢 | Web scraper management |
| [[Growth Engine Campaigns]] | `/admin/growth-engine/campaigns` | 🟢 | Outreach campaign management |
| [[Growth Engine Email]] | `/admin/growth-engine/email` | 🟢 | Email template editor |
| [[Growth Engine Import]] | `/admin/growth-engine/import` | 🟢 | Bulk profile import |
| [[Growth Engine Launch]] | `/admin/growth-engine/launch` | 🟢 | Launch gate checklist |
| [[Support Queue]] | `/admin/support-queue` | 🟢 | Public visitor escalations |
| [[Verification Queue]] | `/admin/verification-queue` | 🟢 | Pending verification reviews |
| [[Capabilities Manager]] | `/admin/capabilities` | 🟢 | Feature toggle management |
| [[System Health]] | `/admin/health` | 🟢 | Infrastructure monitoring |
| [[System Status]] | `/admin/status` | 🟢 | Service status page |
| [[Queue Management]] | `/admin/queues` | 🟢 | Background job queues |
| [[Queue Metrics]] | `/admin/queue-metrics` | 🟢 | Queue performance analytics |
| [[DLQ Management]] | `/admin/dlq` | 🟢 | Dead letter queue inspection |
| [[Audit Logs]] | `/admin/audit-logs` | 🟢 | Security audit trail |
| [[Number Inventory]] | `/admin/number-inventory` | 🟢 | WhatsApp number pool |
| [[Message Buffers]] | `/admin/message-buffers` | 🟢 | WhatsApp message queue |
| [[Sync Dashboard]] | `/admin/sync` | 🟢 | Mobile sync monitoring |

---

## 🔄 User Flows

Multi-step processes and journeys.

| Flow | Status | Description |
|:---|:---:|:---|
| [[Signup Flow]] | 🟢 | Phone-based account creation |
| [[Login Flow]] | 🟢 | Passwordless OTP authentication |
| [[Verification Flow]] | 🟢 | CUIT/DNI identity verification |
| [[Subscription Flow]] | 🟢 | MercadoPago payment + upgrade |
| [[Trial Lifecycle]] | 🟢 | 21-day trial → grace → downgrade |
| [[App Onboarding]] | 🟢 | Feature education checklist |
| [[Profile Claim Flow]] | 🟢 | Professional claims scraped profile |
| [[New User Journey]] | 🟡 | End-to-end new user experience |
| [[Job Lifecycle]] | 🟢 | PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED |
| [[Invoice Lifecycle]] | 🟢 | Draft → CAE → Issued → Paid |
| [[Payment Collection Flow]] | 🟢 | Mobile Cobro: Cash, MercadoPago, Transfer |
| [[Marketplace Listing Flow]] | 🟢 | Verification → Profile → Marketplace visibility |

---

## 🏗️ Feature Architectures

Complex features with detailed implementation documentation.

### 📡 Real-Time Operations

| Feature | Location | Status | Description |
|:---|:---|:---:|:---|
| [[Route Intelligence]] | `02_App/Operations/` | 🟢 | Traffic-aware ETA + Distance Matrix API |
| [[Dispatch System]] | `02_App/Operations/` | 🟢 | AI-scored technician recommendations |
| [[Marketplace Smart Matching]] | `02_App/Operations/` | 🟢 | Cross-org nearest search (Phase 3) |
| [[Live Tracking]] | `02_App/Core/` | 🟢 | Real-time GPS via mobile + WebSocket |
| [[Scheduling Intelligence]] | `02_App/Operations/` | 🟢 | Conflict detection + availability |
| [[Vehicle Schedule]] | `02_App/Operations/` | 🟢 | Fleet-technician assignment |

### 💰 Financial System

| Feature | Location | Status | Description |
|:---|:---|:---:|:---|
| [[Multi-Trade Pricing]] | `02_App/Admin/` | 🟢 | Universal pricing for all trades |
| [[Per-Visit Pricing]] | `02_App/Admin/` | 🟢 | Sub-visit billing with material tracking |
| [[Smart Rounding]] | `02_App/Admin/` | 🟢 | Inflation-safe rounding strategies |
| [[AFIP Integration]] | `02_App/Admin/` | 🟢 | Electronic invoicing (Factura C/B/A) |
| [[MercadoPago Integration]] | `02_App/Admin/` | 🟢 | OAuth payments + reconciliation |
| [[Exchange Rate Service]] | `02_App/Admin/` | 🟢 | USD/ARS tracking for pricing |
| [[Fiscal Health Monitor]] | `02_App/Admin/` | 🟢 | AFIP compliance traffic light |

### 🔐 Security & Trust

| Feature | Location | Status | Description |
|:---|:---|:---:|:---|
| [[Technician Verification Security]] | `02_App/Operations/` | 🟢 | QR badge + 4-digit confirmation code |
| [[Digital Badge System]] | `02_App/Operations/` | 🟢 | Professional identity QR cards |
| [[Verification Manager]] | `02_App/Operations/` | 🟢 | CUIT, DNI, ART, license verification |
| [[Client Data Folder]] | `02_App/CRM/` | 🟢 | ARCO compliance data management |
| [[Audit Encryption]] | `02_App/Infrastructure/` | 🟢 | Encrypted audit log storage |
| [[Credential Encryption]] | `02_App/Infrastructure/` | 🟢 | AES-256 for AFIP credentials |

### 🏪 Marketplace

| Feature | Location | Status | Description |
|:---|:---|:---:|:---|
| [[Business Profile Service]] | `02_App/CRM/` | 🟢 | Auto-created public profiles for orgs |
| [[Marketplace Nearest API]] | `02_App/Operations/` | 🟢 | Cross-org nearest org search with ETA |
| [[Unclaimed Profile Service]] | `02_App/CRM/` | 🟢 | Scraped profiles awaiting claim |
| [[Growth Engine]] | `02_App/Admin/` | 🟢 | Professional acquisition pipeline |

### 📱 Communication

| Feature | Location | Status | Description |
|:---|:---|:---:|:---|
| [[WhatsApp AI Copilot]] | `02_App/Communication/` | 🟢 | LangGraph-powered AI agent |
| [[WhatsApp AI Translation]] | `02_App/Communication/` | 🟢 | Multi-language AI capabilities |
| [[Shared Inbox]] | `02_App/Communication/` | 🟢 | Team WhatsApp conversation management |
| [[Support Queue]] | `02_App/Communication/` | 🟢 | AI-to-human escalation system |
| [[Voice AI Service]] | `02_App/Communication/` | 🟢 | Audio transcription + analysis |
| [[WhatsApp Credits]] | `02_App/Communication/` | 🟢 | Usage metering + tier quotas |

---

## 🤖 AI Systems

CampoTech implements four distinct AI systems:

| System | Location | Status | Description |
|:---|:---|:---:|:---|
| [[AI Systems Overview]] | `02_App/AI/` | 🟢 | Master index for all AI systems |
| [[Public AI Chat]] | `02_App/AI/` | 🟢 | Landing page visitor support |
| [[Staff Help AI]] | `02_App/AI/` | 🟢 | Dashboard contextual help (any tab) |
| [[WhatsApp AI Copilot]] | `02_App/AI/` | 🟢 | LangGraph agent for customer WhatsApp |
| [[AI Dispatch Intelligence]] | `02_App/AI/` | 🟢 | Traffic-aware scheduling + scoring |
| [[AI Settings Page]] | `02_App/AI/` | 🟢 | Configuration for WhatsApp AI |
| [[AI Architecture Deep Dive]] | `02_App/AI/` | 🟢 | Technical implementation details |

---

## 📱 Mobile App (Technician)

The React Native (Expo) mobile app is the field technician's primary tool.

### Mobile Features

| Feature | Status | Description |
|:---|:---:|:---|
| [[Mobile Dashboard]] | 🟢 | Today's assigned jobs at a glance |
| [[Mobile Job List]] | 🟢 | View and manage assigned work orders |
| [[Mobile Job Detail]] | 🟢 | Full job info with customer contact |
| [[Mobile Job Execution]] | 🟢 | Start/pause/complete job workflow |
| [[Mobile Navigation]] | 🟢 | Turn-by-turn directions via Google Maps |
| [[Mobile Photos]] | 🟢 | Before/during/after photo capture |
| [[Mobile Cobro (Collection)]] | 🟢 | On-site payment: Cash, MercadoPago, Transfer |
| [[Mobile Invoice Generation]] | 🟢 | Create + send invoice from field |
| [[Mobile Digital Badge]] | 🟢 | QR identity card for security access |
| [[Mobile Confirmation Code]] | 🟢 | 4-digit mutual verification at job start |
| [[Mobile GPS Tracking]] | 🟢 | Background location reporting |
| [[Mobile Offline Sync]] | 🟢 | WatermelonDB offline-first architecture |
| [[Mobile Push Notifications]] | 🟢 | Job assignments + reminders |
| [[Mobile Profile]] | 🟢 | Personal settings + availability toggle |
| [[Mobile OTA Updates]] | 🟢 | Expo EAS OTA update channel |

### Mobile Architecture

| Component | Technology | Description |
|:---|:---|:---|
| **Framework** | Expo (React Native) | Cross-platform iOS + Android |
| **Local DB** | WatermelonDB | Offline-first SQLite with sync |
| **Navigation** | Expo Router | File-based routing |
| **State** | Zustand | Lightweight state management |
| **Auth** | SecureStore | Hardware-backed token storage |
| **Maps** | react-native-maps | Google Maps integration |
| **Camera** | expo-camera | Photo capture for job docs |

---

## 🔧 Infrastructure & Monitoring

System health, capacity monitoring, and DevOps documentation.

| System | Location | Status | Description |
|:---|:---|:---:|:---|
| [[System Health and Capacity]] | `02_App/Infrastructure/` | 🟢 | Unified health + capacity monitoring |
| [[Circuit Breaker System]] | `02_App/Infrastructure/` | 🟢 | Degradation patterns (lib/degradation) |
| [[Caching Layer]] | `02_App/Infrastructure/` | 🟢 | Multi-tier cache with SWR |
| [[Background Jobs]] | `02_App/Infrastructure/` | 🟢 | Queue-based async processing |
| [[Error Handling]] | `02_App/Infrastructure/` | 🟢 | Standardized error patterns |
| [[Sentry Integration]] | `02_App/Infrastructure/` | 🟢 | Error tracking with PII filtering |

### Quick Health Check Links
- **Local:** [System Status](http://localhost:3000/api/system/capacity?format=text) | [Health Check](http://localhost:3000/api/health)
- **Production:** [System Status](https://campo-tech-rho.vercel.app/api/system/capacity?format=simple) | [Health Check](https://campo-tech-rho.vercel.app/api/health)

---

## 🔌 Third-Party Integrations

| Integration | Provider | Purpose | Status |
|:---|:---|:---|:---:|
| **AFIP** | Argentine Tax Authority | Electronic invoicing (CAE) | 🟢 |
| **MercadoPago** | Payment Gateway | Subscriptions + field payments | 🟢 |
| **Google Maps** | Distance Matrix + Directions | Traffic-aware routing + ETA | 🟢 |
| **Google Maps** | Geocoding API | Address → coordinates | 🟢 |
| **Google Maps** | Maps JavaScript API | Dashboard map rendering | 🟢 |
| **OpenAI** | GPT-4 / GPT-4 Vision | AI copilot + image analysis | 🟢 |
| **Meta Cloud API** | WhatsApp Business | Direct messaging (no BSP) | 🟢 |
| **Twilio** | Phone Numbers | Managed WhatsApp number purchase | 🟢 |
| **Resend** | Email | Transactional emails | 🟢 |
| **Supabase** | Database | Managed PostgreSQL | 🟢 |
| **Vercel** | Hosting | Next.js deployment + Edge | 🟢 |
| **Expo EAS** | Mobile CI/CD | Build + OTA updates | 🟢 |
| **Sentry** | Error Tracking | Monitoring + PII filtering | 🟢 |

---

## 🔐 Security Architecture

### Multi-Tenant Isolation
- **81+ tables** with `organizationId` column
- Mandatory tenant filtering on every query (enforced by `withAuth` wrapper)
- Double-key IDOR prevention: `where: { id, organizationId }`

### Authentication
- **Passwordless OTP** via phone (not password)
- **JWT** with HttpOnly cookies — access + refresh token pair
- **Edge middleware** for session enforcement
- **SecureStore** (hardware-backed) on mobile

### Authorization (RBAC)
| Role | Scope | Access |
|:---|:---|:---|
| `SUPER_ADMIN` | Platform-wide | All admin pages + all org data |
| `OWNER` | Organization | Full org access + billing |
| `ADMIN` | Organization | Manage team + operations |
| `TECHNICIAN` | Personal | Own jobs + mobile app |

### Data Protection (Ley 25.326)
- Client Data Folder with ARCO compliance (Access, Rectification, Cancellation, Opposition)
- Consent tracking service
- Account deletion with 30-day grace period
- PII filtering in Sentry

---

## 💲 Subscription Tiers

| Tier | Monthly Price | Key Features |
|:---|:---:|:---|
| **FREE** | $0 | Single worker, basic jobs + invoicing |
| **INICIAL** | ~ARS 15,000 | Calendar, team (5 users), WhatsApp send, MercadoPago |
| **PROFESIONAL** | ~ARS 35,000 | Live map, fleet, inventory, dispatch, voice review |
| **EMPRESA** | ~ARS 65,000 | Advanced analytics, predictions, unlimited users |

### Trial System
- **21-day trial** of PROFESIONAL features
- **3-day grace period** after expiry
- Auto-downgrade to FREE if no payment

### Feature Gating
| Module | Required Tier | Why Gated |
|:---|:---:|:---|
| Live GPS Tracking | PROFESIONAL | Fleet-level operational cost |
| Calendar/Scheduling | INICIAL | Office management optimization |
| Multi-User Team | INICIAL | Administrative scaling |
| Fleet Management | PROFESIONAL | High-liability asset tracking |
| Inventory | PROFESIONAL | Supply chain optimization |
| MercadoPago Payment Links | INICIAL | API fees subsidized by paid tiers |
| Advanced Analytics | EMPRESA | Executive-level features |
| WhatsApp Outbound | INICIAL | Meta API messaging fees |

---

## 🧩 Components

Reusable UI components documented.

### Dashboard Components
| Component | Status | Description |
|:---|:---:|:---|
| [[Sidebar Navigation]] | 🟢 | Role + tier-aware main nav sidebar |
| [[User Menu]] | 🟢 | Top-right user dropdown |
| [[Stats Cards]] | 🟢 | KPI display cards |
| [[Quick Actions]] | 🟢 | Dashboard shortcuts |
| [[Team Status Widget]] | 🟢 | Technician status overview |
| [[Onboarding Checklist]] | 🟢 | Setup progress tracker |
| [[TechnicianRouteWidget]] | 🟢 | Route visualization with ETA |

### System Components
| Component | Status | Description |
|:---|:---:|:---|
| [[Trial Banner]] | 🟢 | Trial countdown notification |
| [[Tier Upgrade Modal]] | 🟢 | Feature unlock upsell prompt |
| [[Access Banner]] | 🟢 | Verification/subscription warnings |

---

## 🗄️ Key API Routes

### Public APIs (No Auth)
| Route | Method | Description |
|:---|:---:|:---|
| `/api/marketplace/nearest` | GET | Cross-org nearest available business |
| `/api/copilot/chat` | POST | Public AI chatbot |
| `/api/claim-profile/search` | POST | Search unclaimed profiles |
| `/api/auth/login` | POST | OTP login |
| `/api/auth/register` | POST | Account creation |

### Dispatch & Routing (Auth Required)
| Route | Method | Description |
|:---|:---:|:---|
| `/api/tracking/nearest` | GET | Find nearest org technician |
| `/api/dispatch/recommend` | POST | AI-scored dispatch recommendations |
| `/api/tracking/location` | POST | Mobile GPS location update |
| `/api/routes/generate` | POST | Traffic-aware route generation |

### Financial (Auth Required)
| Route | Method | Description |
|:---|:---:|:---|
| `/api/invoices` | GET/POST | Invoice CRUD |
| `/api/afip/queue` | POST | AFIP CAE issuance queue |
| `/api/payments` | GET/POST | Payment tracking |
| `/api/subscription/*` | Various | Billing lifecycle |

### WhatsApp (Auth Required)
| Route | Method | Description |
|:---|:---:|:---|
| `/api/whatsapp/send` | POST | Send WhatsApp message |
| `/api/whatsapp/webhook` | POST | Incoming message handler |
| `/api/copilot/availability` | GET | AI assistant status |

---

## 🎨 Status Legend

| Emoji | Meaning | Next Steps |
|:---:|:---|:---|
| 🟢 | Functional | May need refinement |
| 🟡 | In Progress | Actively developing |
| 🔴 | Missing/Blocked | Needs implementation |
| ⚪ | Planned | Designed, not started |

---

## 📁 Directory Structure

```text
architecture/Obsidian Architecture/
├── 📄 README.md                    (This file — master index)
├── 📊 Sitemap.canvas
├── 📄 Page Structure Reference.md
├── 📄 Product Strategy.md
├── 📁 00_Flows/                    # User Journeys
│   ├── Signup Flow.md
│   ├── Login Flow.md
│   ├── Verification Flow.md
│   ├── Subscription Flow.md
│   ├── Trial Lifecycle.md
│   ├── App Onboarding.md
│   ├── Profile Claim Flow.md
│   └── New User Journey.md
├── 📁 01_Website/                  # Public Pages
│   ├── Landing Page.md
│   └── Legal Pages.md
├── 📁 02_App/                      # Authenticated Application
│   ├── 📁 AI/                     # AI Systems (4 types)
│   ├── 📁 Core/                   # Dashboard, Map, Calendar
│   ├── 📁 CRM/                    # Customers, Leads, Profiles
│   ├── 📁 Operations/            # Jobs, Fleet, Inventory, Dispatch
│   ├── 📁 Admin/                  # Settings, Billing, Pricing
│   ├── 📁 Communication/         # WhatsApp, Voice, Support
│   ├── 📁 Infrastructure/        # Health, Capacity, Monitoring
│   ├── 📁 Marketplace/           # Public profiles, smart matching
│   ├── 📁 Financial/             # Invoicing, Payments, AFIP
│   └── 📁 Security/              # Verification, badges, encryption
├── 📁 03_Auth/                     # Authentication Pages
├── 📁 04_Mobile/                   # React Native Mobile App
├── 📁 05_Integrations/             # Third-party services
└── 📁 Components/                  # Reusable UI Patterns
```

---

## 🔍 Quick Find

### By Feature Area
- **Jobs & Scheduling:** [[Jobs Page]], [[Calendar Page]], [[Schedule Page]], [[New Job Page]], [[Dispatch Page]]
- **Customer Management:** [[Customers Page]], [[Client Data Folder]], [[Leads Page]], [[WhatsApp Page]]
- **Finance:** [[Invoices Page]], [[Payments Page]], [[AFIP Settings]], [[MercadoPago Settings]]
- **Team & Fleet:** [[Team Page]], [[Fleet Page]], [[Map View]], [[Team Availability Page]]
- **Marketplace:** [[Public Business Profile]], [[Marketplace Profile Editor]], [[Marketplace Nearest API]], [[Growth Engine]]
- **AI Systems:** [[Public AI Chat]], [[Staff Help AI]], [[WhatsApp AI Copilot]], [[AI Dispatch Intelligence]]
- **Configuration:** [[Settings Page]], [[Profile Page]], [[Pricebook Settings]], [[Pricing Settings]]
- **Security:** [[Technician Verification Security]], [[Digital Badge System]], [[Verification Flow]]
- **Platform Admin:** [[Admin Dashboard]], [[Growth Engine]], [[System Health]], [[Audit Logs]]

### By User Role
- **SUPER_ADMIN (CampoTech Staff):** All admin pages, growth engine, system health
- **OWNER:** All pages + billing, verification, subscription management
- **ADMIN:** Operations + team management (no billing)
- **TECHNICIAN:** Mobile app + personal dashboard (own jobs, profile, availability)

### By Subscription Tier
- **FREE:** Dashboard, Jobs (10), Customers (20), Invoices (10), Profile
- **INICIAL:** + Calendar, Team (5), WhatsApp, Leads, Payments, Schedule
- **PROFESIONAL:** + Map, Fleet, Inventory, Dispatch, Voice Review, Live Tracking
- **EMPRESA:** + Analytics, Predictions, Reports, Unlimited Users, API Access

---

## 📝 Contributing

When adding new documentation:
1. Follow [[Page Structure Reference]] guidelines
2. Use proper frontmatter with tags and status
3. Link to parent and child pages
4. Update this index
5. Add to [[Sitemap.canvas]] if major page

---

*Last updated: February 13, 2026*
