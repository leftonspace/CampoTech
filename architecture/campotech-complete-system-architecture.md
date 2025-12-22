# CampoTech Complete System Architecture

> **Version:** 1.0.0
> **Date:** 2025-12-21
> **Status:** Production

---

## 1. Overview

CampoTech is an Argentine field service management (FSM) platform designed for SMBs (1-50 employees) in the trades sector (HVAC, plumbing, electrical, etc.). The platform provides end-to-end workflow management from customer intake via WhatsApp to electronic invoicing with AFIP.

### Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend Web** | Next.js 15, React 19, Tailwind CSS | Landing page, Business Dashboard, Admin Portal |
| **Mobile (Business)** | Expo/React Native, WatermelonDB | Offline-first technician app |
| **Mobile (Consumer)** | Expo/React Native | Consumer marketplace app |
| **API** | Next.js API Routes, Express.js | REST APIs, Webhooks |
| **Database** | PostgreSQL, Prisma ORM | Primary data store |
| **Cache/Queue** | Upstash Redis, BullMQ | Caching, job queues |
| **Real-time** | Pusher, SSE, Polling | Live updates, GPS tracking |
| **Storage** | Supabase Storage | Photos, documents, voice messages |
| **AI** | OpenAI GPT-4, Whisper | Intent extraction, voice transcription |
| **Payments** | Mercado Pago | Invoices, subscriptions |
| **Invoicing** | AFIP WSAA/WSFEV1 | Electronic invoicing (Argentina) |
| **Messaging** | WhatsApp Cloud API / Dialog360 | Customer communication |
| **Push Notifications** | Expo Notifications, Firebase | Mobile alerts |
| **Monitoring** | Sentry | Error tracking |

### Scale Targets

- **100,000** active businesses
- **500,000** platform users
- **1,000,000** jobs processed monthly
- **5,000,000** WhatsApp messages monthly

---

## 2. High-Level System Overview

```mermaid
flowchart TB
    subgraph Users ["Users"]
        O["Owner"]
        D["Dispatcher"]
        T["Technician"]
        C["Consumer"]
        CU["Customer"]
        A["CampoTech Admin"]
        DEV["Developer"]
    end

    subgraph Interfaces ["Interfaces"]
        WEB["apps/web<br/>Next.js 15<br/>Landing + Dashboard"]
        MOB["apps/mobile<br/>Expo/React Native<br/>Business App"]
        CMOB["apps/consumer-mobile<br/>Expo/React Native<br/>Marketplace"]
        ADMIN["apps/admin<br/>Next.js<br/>Internal Admin"]
        DEVP["apps/developer-portal<br/>Next.js + MDX<br/>API Docs"]
        TRACK["/track/token<br/>Customer Tracking"]
        RATE["/rate/token<br/>Rating Page"]
    end

    subgraph Core ["Core Platform"]
        API["API Routes<br/>Next.js + Express"]
        AUTH["Auth<br/>OTP + JWT"]
        QUEUE["Queue System<br/>BullMQ + Redis"]
        WS["Real-time<br/>Pusher + SSE"]
        AI["AI Engine<br/>GPT-4 + Whisper"]
    end

    subgraph Data ["Data Layer"]
        DB[(PostgreSQL<br/>Prisma ORM)]
        REDIS[(Redis/Upstash<br/>Cache + Queue)]
        STORAGE[(Supabase<br/>Storage)]
    end

    subgraph External ["External Systems"]
        AFIP["AFIP<br/>WSAA + WSFEV1"]
        MP["Mercado Pago<br/>Payments"]
        WA["WhatsApp<br/>Meta Cloud API"]
        GOOGLE["Google Maps<br/>Places + Directions"]
        OPENAI["OpenAI<br/>GPT-4 + Whisper"]
        EXPO["Expo<br/>Push Notifications"]
    end

    O & D --> WEB
    T --> MOB
    O & D --> MOB
    C --> CMOB
    CU --> WA
    CU --> TRACK
    CU --> RATE
    A --> ADMIN
    DEV --> DEVP

    WEB & MOB & CMOB & ADMIN --> API
    API --> AUTH
    API --> QUEUE
    API --> WS
    API --> AI

    API --> DB
    QUEUE --> REDIS
    API --> STORAGE

    QUEUE --> AFIP
    QUEUE --> MP
    QUEUE --> WA
    API --> GOOGLE
    AI --> OPENAI
    QUEUE --> EXPO
```

---

## 3. Application Architecture

### 3.1 apps/web (Next.js 15)

The main web application serving landing page and business dashboard.

| Route | Purpose | Access |
|-------|---------|--------|
| `/` | Landing page, pricing, features | Public |
| `/login` | OTP-based authentication | Public |
| `/register` | Business registration | Public |
| `/dashboard/*` | Business management interface | Authenticated |
| `/track/[token]` | Customer job tracking portal | Token-based |
| `/rate/[token]` | Customer rating submission | Token-based |

**Dashboard Modules:**
- `/dashboard` - Overview with KPIs
- `/dashboard/jobs` - Job management (CRUD, assignment)
- `/dashboard/customers` - Customer database
- `/dashboard/calendar` - Schedule visualization (INICIAL+)
- `/dashboard/invoices` - Invoice management
- `/dashboard/payments` - Payment tracking (INICIAL+)
- `/dashboard/fleet` - Vehicle management (PROFESIONAL+)
- `/dashboard/inventory` - Stock control (PROFESIONAL+)
- `/dashboard/dispatch` - Live map + dispatch (PROFESIONAL+)
- `/dashboard/locations` - Multi-zone management (EMPRESA)
- `/dashboard/whatsapp` - Conversation management
- `/dashboard/analytics` - Reports + KPIs (EMPRESA)
- `/dashboard/team` - User management (INICIAL+)
- `/dashboard/settings/*` - Configuration

### 3.2 apps/mobile (Expo/React Native)

Business mobile application for field operations.

**Tab Structure:**
| Tab | Purpose | Roles |
|-----|---------|-------|
| `today` | Today's schedule + pending jobs | All |
| `jobs` | Job list with filters | All |
| `customers` | Customer lookup | Owner, Dispatcher |
| `calendar` | Schedule view | Owner, Dispatcher |
| `inventory` | Stock management | Owner, Dispatcher |
| `invoices` | Invoice creation | Owner, Dispatcher |
| `team` | Team management | Owner |
| `analytics` | Mobile reports | Owner |
| `profile` | Settings + logout | All |

**Key Features:**
- Offline-first with WatermelonDB
- GPS tracking (expo-location)
- Voice reports (expo-av + Whisper)
- Photo capture (expo-camera)
- Customer signatures (react-native-signature-canvas)
- Push notifications (expo-notifications)

### 3.3 apps/consumer-mobile (Expo/React Native)

Consumer marketplace application.

**Structure:**
| Route Group | Purpose |
|-------------|---------|
| `(auth)` | Login/Register |
| `(tabs)` | Main navigation |
| `(booking)` | Service booking flow |
| `category/[id]` | Service category browse |
| `provider/[id]` | Business profile |
| `rate/[id]` | Post-service rating |

**Features:**
- Service discovery by category/location
- Business profiles with reviews
- Quote requests
- Job tracking
- Review submission

### 3.4 apps/admin (Next.js)

Internal CampoTech administration portal.

**Dashboard Sections:**
| Section | Purpose |
|---------|---------|
| `/dashboard` | Platform metrics, alerts |
| `/dashboard/negocios` | Business management |
| `/dashboard/subscriptions` | Subscription management |
| `/dashboard/verificaciones` | Business verification queue |
| `/dashboard/payments` | Failed payments handling |
| `/dashboard/ai` | AI usage monitoring |
| `/dashboard/costs` | Cost analysis |
| `/dashboard/map` | Platform-wide map view |

### 3.5 apps/developer-portal (Next.js + MDX)

Public API documentation and developer resources.

**Sections:**
| Route | Purpose |
|-------|---------|
| `/` | Portal landing |
| `/docs/*` | MDX documentation |
| `/reference` | API reference (Swagger UI) |
| `/console` | API testing console |
| `/playground` | Interactive examples |

---

## 4. Complete User Journey Map

```mermaid
flowchart TB
    subgraph Onboarding ["Onboarding"]
        REG["1. Register Business"]
        VER["2. AFIP Verification"]
        SETUP["3. Initial Setup"]
        TRIAL["4. Trial Period"]
    end

    subgraph Daily ["Daily Operations"]
        subgraph Inbound ["Inbound"]
            WA_IN["WhatsApp Message"]
            CALL["Phone Call"]
            WALK["Walk-in"]
            MKTPL["Marketplace Request"]
        end

        subgraph Process ["Processing"]
            AGG["Message Aggregation"]
            AI_EXT["AI Intent Extraction"]
            MATCH["Customer Matching"]
            CREATE["Job Creation"]
        end

        subgraph Dispatch ["Dispatch"]
            ASSIGN["Technician Assignment"]
            NEAR["Nearest Available"]
            NOTIFY["Notifications"]
            TRACK["Customer Tracking Link"]
        end

        subgraph Execute ["Execution"]
            EN_ROUTE["En Route GPS Tracking"]
            ARRIVE["Arrival Check-in"]
            WORK["Work Progress Photos Notes"]
            COMPLETE["Completion Signature"]
        end

        subgraph Close ["Closing"]
            INVOICE["Invoice Generation"]
            AFIP_CAE["AFIP CAE Request"]
            PAYMENT["Payment Collection"]
            RATING["Customer Rating"]
        end
    end

    subgraph Management ["Management"]
        REPORTS["Reports Analytics"]
        FLEET["Fleet Management"]
        INVENTORY["Inventory Control"]
        BILLING["Subscription Billing"]
    end

    REG --> VER --> SETUP --> TRIAL
    TRIAL --> Inbound

    WA_IN --> AGG
    CALL --> CREATE
    WALK --> CREATE
    MKTPL --> CREATE
    AGG --> AI_EXT --> MATCH --> CREATE

    CREATE --> ASSIGN --> NEAR --> NOTIFY --> TRACK

    TRACK --> EN_ROUTE --> ARRIVE --> WORK --> COMPLETE

    COMPLETE --> INVOICE --> AFIP_CAE --> PAYMENT --> RATING

    RATING --> REPORTS
    COMPLETE --> FLEET
    WORK --> INVENTORY
    TRIAL --> BILLING
```

---

## 5. Data Entity Relationships

```mermaid
erDiagram
    Organization ||--o{ User : employs
    Organization ||--o{ Customer : serves
    Organization ||--o{ Job : manages
    Organization ||--o{ Invoice : issues
    Organization ||--o{ Location : operates
    Organization ||--o{ Vehicle : owns
    Organization ||--o{ InventoryItem : tracks
    Organization ||--o{ WaConversation : has
    Organization ||--|| OrganizationSubscription : subscribes
    Organization ||--o| AIConfiguration : configures
    Organization ||--o| BusinessPublicProfile : publishes

    User ||--o{ Job : assigned_to
    User ||--o{ JobVisit : performs
    User ||--o{ TrackingSession : tracked_via
    User ||--o{ VehicleAssignment : drives

    Customer ||--o{ Job : requests
    Customer ||--o{ Invoice : billed
    Customer ||--o{ WaConversation : contacts_via
    Customer ||--o| Review : leaves

    Job ||--o{ JobAssignment : assigned_via
    Job ||--o{ JobVisit : has_visits
    Job ||--o{ JobPhoto : documented_by
    Job ||--o{ StockMovement : uses
    Job ||--o| Invoice : invoiced_as
    Job ||--o| Review : rated_via
    Job ||--o{ TrackingSession : tracked

    Location ||--o{ Zone : divided_into
    Location ||--o{ Job : services
    Location ||--o{ Customer : covers
    Location ||--o| LocationSettings : configured_by
    Location ||--o| LocationAfipConfig : invoices_via

    Invoice ||--o{ Payment : paid_by
    Invoice ||--o{ InvoiceItem : contains
    Invoice ||--o{ Chargeback : disputed_via

    Vehicle ||--o{ VehicleAssignment : assigned_via
    Vehicle ||--o{ VehicleMaintenance : serviced_via
    Vehicle ||--o{ VehicleDocument : documented_by

    WaConversation ||--o{ WaMessage : contains
    WaConversation ||--o| Customer : identified_as

    OrganizationSubscription ||--o{ SubscriptionPayment : paid_via
    OrganizationSubscription ||--o{ SubscriptionEvent : logged

    Organization {
        string id PK
        string name
        string phone
        SubscriptionTier subscriptionTier
        SubscriptionStatus subscriptionStatus
        OrgVerificationStatus verificationStatus
        boolean marketplaceVisible
    }

    User {
        string id PK
        string phone UK
        string name
        UserRole role
        string specialty
        string skillLevel
        boolean isActive
    }

    Customer {
        string id PK
        string customerNumber
        string name
        string phone
        json address
        boolean isVip
    }

    Job {
        string id PK
        string jobNumber UK
        ServiceType serviceType
        JobStatus status
        Urgency urgency
        datetime scheduledDate
        JobDurationType durationType
    }

    Invoice {
        string id PK
        string invoiceNumber UK
        InvoiceType type
        InvoiceStatus status
        decimal total
        string afipCae
        datetime afipCaeExpiry
    }

    Location {
        string id PK
        string code
        string name
        LocationType type
        json address
        json coordinates
    }
```

---

## 6. API Routes Summary

### Authentication (`/api/auth/*`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/auth/login` | POST | Login with phone/password |
| `/auth/register` | POST | Business registration |
| `/auth/otp/request` | POST | Request OTP code |
| `/auth/otp/verify` | POST | Verify OTP code |
| `/auth/refresh` | POST | Refresh JWT token |
| `/auth/logout` | POST | Logout |
| `/auth/me` | GET | Get current user |

### Core APIs
| Group | Routes | Purpose |
|-------|--------|---------|
| `/api/jobs/*` | 10+ | Job CRUD, assignment, status |
| `/api/customers/*` | 5+ | Customer management |
| `/api/invoices/*` | 8+ | Invoice generation, AFIP |
| `/api/payments/*` | 4+ | Payment tracking |
| `/api/users/*` | 6+ | User management |
| `/api/locations/*` | 8+ | Multi-location |
| `/api/vehicles/*` | 6+ | Fleet management |
| `/api/inventory/*` | 10+ | Stock control |

### External Integrations
| Group | Routes | Purpose |
|-------|--------|---------|
| `/api/webhooks/mercadopago` | POST | MP payment webhooks |
| `/api/webhooks/dialog360` | POST | WhatsApp webhooks |
| `/api/settings/afip` | GET/POST | AFIP configuration |
| `/api/settings/mercadopago` | GET/POST | MP configuration |
| `/api/settings/whatsapp` | GET/POST | WhatsApp configuration |

### Analytics & AI
| Group | Routes | Purpose |
|-------|--------|---------|
| `/api/analytics/*` | 12+ | Reports, KPIs, predictions |
| `/api/ai/*` | 4+ | AI status, usage, escalations |
| `/api/copilot/*` | 3+ | Staff AI assistant |

### Cron Jobs
| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/subscription` | Daily | Process renewals |
| `/api/cron/trial-expiration` | Daily | Check trials |
| `/api/cron/archive-data` | Weekly | Archive old data |
| `/api/cron/check-budgets` | Daily | Budget alerts |
| `/api/cron/storage-optimization` | Daily | Cleanup files |

---

## 7. External Service Details

| Service | Purpose | Endpoints Used |
|---------|---------|----------------|
| **AFIP WSAA** | Authentication | `wsaa.afip.gov.ar/ws/services/LoginCms` |
| **AFIP WSFEV1** | Electronic invoicing | `wsfe.afip.gov.ar/wsfev1/service.asmx` |
| **Mercado Pago** | Payment processing | Preferences, Payments, Refunds, Subscriptions |
| **WhatsApp Cloud API** | Messaging | Messages, Media, Templates |
| **Dialog360** | WhatsApp BSP | Alternative provider for WhatsApp API |
| **OpenAI GPT-4** | AI processing | Chat completions for intent extraction |
| **OpenAI Whisper** | Voice transcription | Audio transcriptions |
| **Google Maps** | Geocoding, routing | Places, Geocoding, Directions, Distance Matrix |
| **Supabase** | Storage | File uploads (photos, documents, voice) |
| **Upstash Redis** | Caching, rate limiting | Key-value store, queues |
| **Expo** | Push notifications | Expo Push API |

---

## 8. User Roles & Permissions

### Role Definitions

| Role | Spanish | Description |
|------|---------|-------------|
| `OWNER` | Dueño | Full platform access including billing |
| `DISPATCHER` | Despachador | Operations management, no billing |
| `TECHNICIAN` | Técnico | Mobile field worker, assigned jobs only |

### Permissions Matrix

| Module | Owner | Dispatcher | Technician |
|--------|:-----:|:----------:|:----------:|
| Dashboard | Full | Full | - |
| Jobs (all) | Full | Full | - |
| Jobs (assigned) | Full | Full | View/Update |
| Customers | Full | Full | - |
| Calendar | Full | Full | - |
| Invoices | Full | Full | - |
| Payments | Full | - | - |
| Fleet | Full | - | - |
| Inventory | Full | Full | View only |
| Dispatch Map | Full | Full | - |
| Locations | Full | - | - |
| WhatsApp | Full | Full | - |
| Analytics | Full | Limited | - |
| Team | Full | - | - |
| Settings | Full | - | - |
| Billing | Full | - | - |

---

## 9. WhatsApp AI Flow

```mermaid
flowchart TB
    subgraph Reception ["Message Reception"]
        WH["Webhook /api/webhooks/dialog360"]
        VAL["Validate Signature + Rate Limit"]
        PARSE["Parse Message Text Audio Image"]
    end

    subgraph Aggregation ["Message Aggregation"]
        BUFFER["Message Buffer Redis"]
        TRIGGER{"Trigger Detection"}
        VOICE["Voice Message"]
        LONG["Long Message"]
        QUEST["Question"]
        URGENT["Urgency"]
        ADDR["Address"]
        PRICE["Price Inquiry"]
        TIMEOUT["Timeout 5s"]
    end

    subgraph AIProcessing ["AI Processing"]
        CONTEXT["Build Context Customer History"]
        WHISPER["Whisper Transcription"]
        GPT["GPT-4 Intent Extraction"]
        EXTRACT["Extract Intent Service Address Schedule Urgency"]
    end

    subgraph Actions ["Actions"]
        CREATE_JOB["Create Job"]
        UPDATE_JOB["Update Job"]
        LOOKUP["Customer Lookup"]
        SCHEDULE["Check Availability"]
        QUOTE["Generate Quote"]
        ESCALATE["Escalate to Human"]
    end

    subgraph Response ["Response"]
        GEN["Generate Response GPT-4"]
        TEMPLATE["Select Template"]
        QUEUE["Queue Message"]
        SEND["Send via WhatsApp API"]
    end

    WH --> VAL --> PARSE
    PARSE --> BUFFER
    BUFFER --> TRIGGER

    TRIGGER -->|Voice| VOICE --> WHISPER --> GPT
    TRIGGER -->|Long| LONG --> GPT
    TRIGGER -->|Question| QUEST --> GPT
    TRIGGER -->|Urgent| URGENT --> GPT
    TRIGGER -->|Address| ADDR --> GPT
    TRIGGER -->|Price| PRICE --> GPT
    TRIGGER -->|Timeout| TIMEOUT --> GPT

    GPT --> CONTEXT --> EXTRACT

    EXTRACT --> CREATE_JOB
    EXTRACT --> UPDATE_JOB
    EXTRACT --> LOOKUP
    EXTRACT --> SCHEDULE
    EXTRACT --> QUOTE
    EXTRACT -.->|Low Confidence| ESCALATE

    Actions --> GEN --> TEMPLATE --> QUEUE --> SEND
```

---

## 10. Job Lifecycle

```mermaid
flowchart TB
    subgraph Intake ["Intake"]
        WA_REQ["WhatsApp Request"]
        PHONE["Phone Call"]
        MKTPL["Marketplace Request"]
        MANUAL["Manual Entry"]
    end

    subgraph Triage ["Triage"]
        PARSE_REQ["Parse Request"]
        MATCH_CUST["Match Customer"]
        DET_TYPE["Determine Service Type"]
        DET_URG["Determine Urgency"]
        CREATE["Create Job PENDING"]
    end

    subgraph Dispatch ["Dispatch"]
        AVAIL["Check Availability"]
        GPS["Technician Locations"]
        SKILLS["Match Skills"]
        LOAD["Current Workload"]
        RECOMMEND["AI Recommendation"]
        ASSIGN["Assign ASSIGNED"]
        NOTIFY_TECH["Notify Technician"]
        NOTIFY_CUST["Notify Customer"]
    end

    subgraph Execute ["Execution"]
        ACCEPT["Tech Accepts"]
        EN_ROUTE["En Route EN_ROUTE"]
        TRACK_GPS["GPS Tracking"]
        TRACK_LINK["Customer Tracking Link"]
        ARRIVE["Arrival IN_PROGRESS"]
        WORK["Work + Photos"]
        MATERIALS["Use Materials"]
        VOICE_RPT["Voice Report"]
        COMPLETE["Complete COMPLETED"]
        SIGNATURE["Customer Signature"]
    end

    subgraph Close ["Closing"]
        GEN_INV["Generate Invoice"]
        AFIP_CAE["Request AFIP CAE"]
        SEND_INV["Send Invoice"]
        COLLECT["Collect Payment"]
        RATING_REQ["Request Rating"]
        ARCHIVE["Archive Job"]
    end

    Intake --> PARSE_REQ --> MATCH_CUST --> DET_TYPE --> DET_URG --> CREATE

    CREATE --> AVAIL
    AVAIL --> GPS & SKILLS & LOAD
    GPS & SKILLS & LOAD --> RECOMMEND --> ASSIGN
    ASSIGN --> NOTIFY_TECH & NOTIFY_CUST

    NOTIFY_TECH --> ACCEPT --> EN_ROUTE
    EN_ROUTE --> TRACK_GPS --> TRACK_LINK
    EN_ROUTE --> ARRIVE --> WORK
    WORK --> MATERIALS & VOICE_RPT
    WORK --> COMPLETE --> SIGNATURE

    SIGNATURE --> GEN_INV --> AFIP_CAE --> SEND_INV --> COLLECT --> RATING_REQ --> ARCHIVE
```

### Job Status Flow

```
PENDING -> ASSIGNED -> EN_ROUTE -> IN_PROGRESS -> COMPLETED
    |          |          |            |
    v          v          v            v
CANCELLED  CANCELLED  CANCELLED  CANCELLED
```

---

## 11. Invoicing & Payment Flow

```mermaid
flowchart TB
    subgraph Trigger ["Invoice Trigger"]
        JOB_DONE["Job Completed"]
        MANUAL["Manual Creation"]
        RECURRING["Recurring Service"]
    end

    subgraph Prepare ["Invoice Preparation"]
        CALC["Calculate Totals + Materials"]
        TYPE["Determine Type A B C"]
        CUSTOMER["Get Customer CUIT CF"]
        ITEMS["Build Line Items"]
        DRAFT["Create Draft"]
    end

    subgraph AFIP ["AFIP Processing"]
        QUEUE_AFIP["Queue Job afip-invoice"]
        WSAA["WSAA Auth Token"]
        WSFEV1["WSFEV1 CAE Request"]
        CAE_OK{"CAE Success"}
        SAVE_CAE["Save CAE + QR Code"]
        RETRY["Retry 3 attempts"]
        FALLBACK["Fallback Manual"]
    end

    subgraph Delivery ["Invoice Delivery"]
        PDF["Generate PDF"]
        STATUS["Update Status SENT"]
        WA_SEND["Send via WhatsApp"]
        EMAIL["Send via Email"]
        PORTAL["Customer Portal"]
    end

    subgraph Payment ["Payment"]
        CASH["Cash Payment"]
        TRANSFER["Bank Transfer"]
        MP_LINK["Mercado Pago Link"]
        MP_WH["MP Webhook"]
        UPDATE_PAY["Update Payment Status"]
        PAID["Mark as PAID"]
    end

    Trigger --> CALC --> TYPE --> CUSTOMER --> ITEMS --> DRAFT

    DRAFT --> QUEUE_AFIP --> WSAA --> WSFEV1 --> CAE_OK
    CAE_OK -->|Yes| SAVE_CAE --> PDF
    CAE_OK -->|No| RETRY --> WSFEV1
    RETRY -->|Max Retries| FALLBACK

    PDF --> STATUS --> WA_SEND & EMAIL & PORTAL

    STATUS --> CASH & TRANSFER & MP_LINK
    CASH & TRANSFER --> UPDATE_PAY --> PAID
    MP_LINK --> MP_WH --> UPDATE_PAY
```

### Invoice Types (AFIP)

| Type | Customer Type | IVA Treatment |
|------|---------------|---------------|
| **Factura A** | Responsable Inscripto | IVA discriminado |
| **Factura B** | Consumidor Final | IVA incluido |
| **Factura C** | Monotributista | Sin IVA |

---

## 12. Real-Time Systems

```mermaid
flowchart LR
    subgraph Sources ["Event Sources"]
        GPS["GPS Updates Mobile App"]
        JOB_CHG["Job Status Changes"]
        MSG_NEW["New Messages WhatsApp"]
        NOTIF["Notifications"]
        INV["Invoice Events"]
    end

    subgraph Server ["Real-time Server"]
        PUSHER["Pusher Primary"]
        SSE["SSE Fallback"]
        POLL["Polling Fallback"]
    end

    subgraph Events ["Event Types"]
        E_LOC["technician_location"]
        E_STATUS["technician_status"]
        E_JOB["job_status"]
        E_ASSIGN["job_assigned"]
        E_COMPLETE["job_completed"]
        E_ETA["eta_updated"]
        E_MSG["message_received"]
    end

    subgraph Channels ["Channels"]
        CH_ORG["private-org-orgId"]
        CH_TECH["private-tech-userId"]
        CH_JOB["private-job-jobId"]
        CH_TRACK["private-track-token"]
        CH_USER["private-user-userId"]
    end

    subgraph Subscribers ["Subscribers"]
        DASH["Dashboard Web"]
        MAP["Dispatch Map Web"]
        MOBILE["Mobile App"]
        TRACK_PAGE["Tracking Page Customer"]
    end

    Sources --> PUSHER
    PUSHER --> Events
    PUSHER -.->|Fallback| SSE -.->|Fallback| POLL

    Events --> Channels

    CH_ORG --> DASH & MAP
    CH_TECH --> MOBILE
    CH_JOB --> DASH & TRACK_PAGE
    CH_TRACK --> TRACK_PAGE
    CH_USER --> MOBILE & DASH
```

### Connection Modes

| Mode | Latency | Use Case |
|------|---------|----------|
| **WebSocket (Pusher)** | < 100ms | Primary, real-time updates |
| **SSE** | < 500ms | Fallback for restricted networks |
| **Polling** | 5-15s | Last resort, poor connectivity |

---

## 13. Queue & Background Jobs

```mermaid
flowchart TB
    subgraph Triggers ["Triggers"]
        API_REQ["API Request"]
        WH_EVT["Webhook Event"]
        CRON["Cron Schedule"]
        USER["User Action"]
    end

    subgraph Queues ["Queue Tiers"]
        subgraph RT ["Realtime 5s SLA"]
            RT_PUSH["notification.push"]
            RT_INAPP["notification.inApp"]
            RT_WH["webhook.send"]
            RT_SYNC["sync.realtime"]
            RT_JOB["job.statusNotify"]
        end

        subgraph BG ["Background 60s SLA"]
            BG_EMAIL["email.send"]
            BG_SMS["sms.send"]
            BG_WA["whatsapp.send"]
            BG_WA_AI["whatsapp.aiProcess"]
            BG_VOICE["voice.transcribe"]
            BG_PDF["pdf.generate"]
            BG_INV["invoice.generate"]
            BG_AFIP["invoice.afip"]
        end

        subgraph BATCH ["Batch hours SLA"]
            BA_REPORT["report.generate"]
            BA_ANAL["analytics.aggregate"]
            BA_EXPORT["data.export"]
            BA_ARCHIVE["data.archive"]
            BA_CLEANUP["cleanup.expired"]
            BA_BILLING["billing.process"]
        end
    end

    subgraph Workers ["Workers"]
        W_NOTIF["notification-dispatch.worker"]
        W_WA["whatsapp-outbound.worker"]
        W_AGG["aggregation-processor.worker"]
        W_VOICE["voice-processing.worker"]
        W_INV["invoice-pdf.worker"]
        W_AFIP["afip-invoice.worker"]
        W_PAY["mp-payment.worker"]
        W_REMIND["reminder.worker"]
    end

    subgraph DLQ ["Dead Letter Queue"]
        DLQ_RT["dlq:realtime"]
        DLQ_BG["dlq:background"]
        DLQ_BATCH["dlq:batch"]
        ALERT["Alert Admin"]
        RETRY_MAN["Manual Retry"]
    end

    Triggers --> Queues
    RT --> W_NOTIF
    BG --> W_WA & W_AGG & W_VOICE & W_INV & W_AFIP & W_PAY
    BATCH --> Workers

    Workers -->|Failed 3x| DLQ --> ALERT --> RETRY_MAN
```

### Queue Configuration

| Tier | SLA | Concurrency | Max Retries | Retry Delay |
|------|-----|-------------|-------------|-------------|
| **Realtime** | < 5s | 10 | 2 | 1s |
| **Background** | < 60s | 5 | 3 | 5s |
| **Batch** | < 1hr | 2 | 5 | 30s |

---

## 14. Subscription Tiers

```mermaid
flowchart TB
    subgraph Tiers ["Subscription Tiers"]
        FREE["FREE $0/mo"]
        INIC["INICIAL $25/mo"]
        PROF["PROFESIONAL $55/mo"]
        EMP["EMPRESA $120/mo"]
    end

    subgraph Core ["Core Features"]
        F_JOBS["Jobs"]
        F_CUST["Customers"]
        F_INV["Invoices"]
        F_WA_RCV["WA Receive"]
    end

    subgraph Inicial ["INICIAL+"]
        F_AFIP["AFIP Integration"]
        F_MP["Mercado Pago"]
        F_CAL["Calendar"]
        F_WA_SEND["WA Send"]
        F_MULTI["Multi-user"]
    end

    subgraph Prof ["PROFESIONAL+"]
        F_WA_AI["WhatsApp AI"]
        F_VOICE["Voice Transcription"]
        F_TRACK["Live Tracking"]
        F_NEAR["Nearest Tech"]
        F_FLEET["Fleet"]
        F_STOCK["Inventory"]
    end

    subgraph Emp ["EMPRESA"]
        F_MULTI_LOC["Multi-location"]
        F_ANALYTICS["Advanced Analytics"]
        F_PORTAL["Customer Portal"]
        F_API["Public API"]
        F_WEBHOOKS["Webhooks"]
    end

    FREE --> Core
    INIC --> Core & Inicial
    PROF --> Core & Inicial & Prof
    EMP --> Core & Inicial & Prof & Emp
```

### Resource Limits by Tier

| Resource | FREE | INICIAL | PROFESIONAL | EMPRESA |
|----------|------|---------|-------------|---------|
| Users | 1 | 1 | 5 | Unlimited |
| Jobs/month | 30 | 50 | 200 | Unlimited |
| Customers | 50 | 100 | 500 | Unlimited |
| Invoices/month | 15 | 50 | 200 | Unlimited |
| Vehicles | 0 | 1 | 5 | Unlimited |
| Products | 0 | 50 | 200 | Unlimited |
| Storage | 50MB | 100MB | 500MB | 5GB |
| Photos/job | 3 | 5 | 10 | 50 |
| WA AI/month | 0 | 0 | 100 | Unlimited |
| API calls/day | 0 | 0 | 0 | 10,000 |

---

## 15. Security & Authentication

### Token Specifications

| Token Type | Lifetime | Storage | Purpose |
|------------|----------|---------|---------|
| **Access Token** | 15 minutes | Memory | API authentication |
| **Refresh Token** | 7 days | Secure storage | Token renewal |
| **OTP Code** | 5 minutes | Database (hashed) | Phone verification |
| **API Key** | No expiry | Database | Public API access |
| **Tracking Token** | 48 hours | URL parameter | Customer tracking |
| **Rating Token** | 7 days | URL parameter | Customer rating |

### Security Measures

- OTP rate limiting (5 attempts/hour)
- JWT RS256 signing
- Webhook signature validation
- CORS configuration
- Helmet security headers
- API rate limiting (Upstash)
- Row-level security (Prisma)
- Input validation (Zod)
- SQL injection prevention (Prisma)
- XSS prevention (React)

---

## 16. Summary Table

| Layer | Component | Count |
|-------|-----------|-------|
| **Applications** | Next.js Web Apps | 3 |
| | React Native Mobile Apps | 2 |
| | Total Apps | 5 |
| **API Routes** | Web API Routes | 150+ |
| | Admin API Routes | 16 |
| | Webhook Endpoints | 3 |
| | Cron Endpoints | 7 |
| **Database** | Prisma Models | 60+ |
| | Enums | 30+ |
| **External Integrations** | Payment (Mercado Pago) | 1 |
| | Tax (AFIP) | 1 |
| | Messaging (WhatsApp) | 2 providers |
| | AI (OpenAI) | 2 models |
| | Maps (Google) | 4 APIs |
| | Push (Expo) | 1 |
| **User Types** | Business Roles | 3 |
| | Consumer | 1 |
| | Customer | 1 |
| | Admin | 1 |
| **Subscription Tiers** | Plans | 4 |
| | Features | 20+ |
| **Queue Workers** | Worker Types | 8 |
| | Job Types | 30+ |
| **Real-time** | Event Types | 7 |
| | Channel Types | 5 |

---

## Document Metadata

| Attribute | Value |
|-----------|-------|
| **Version** | 1.0.0 |
| **Generated** | 2025-12-21 |
| **Author** | Claude (Architecture Analysis) |
| **Total Models** | 60+ |
| **Total API Routes** | 175+ |
| **External Integrations** | 10 |
| **Diagram Count** | 12 |
