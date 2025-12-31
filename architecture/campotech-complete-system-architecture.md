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
        A["Admin"]
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

    O & A --> WEB
    T --> MOB
    O & A --> MOB
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
| `Tab` | `Purpose` | `Roles` |
|-----|---------|-------|
| `today` | Today's schedule + pending jobs | All |
| `jobs` | Job list with filters | All |
| `customers` | Customer lookup | Owner, Admin |
| `calendar` | Schedule view | Owner, Admin |
| `inventory` | Stock management | Owner, Admin |
| `invoices` | Invoice creation | Owner, Admin |
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
    subgraph USERS["👥 USER ACTORS"]
        direction TB
        OWNER["🏢 OWNER<br/>Business owner<br/>Full platform access<br/>Billing & settings"]
        ADMIN["📋 ADMIN<br/>Management staff<br/>Job scheduling<br/>Customer management<br/>(No billing)"]
        TECH["🔧 TECHNICIAN<br/>Field worker<br/>Mobile app focused<br/>Job completion"]
        CONSUMER["🛒 CONSUMER<br/>Marketplace user<br/>Service discovery<br/>Reviews & booking"]
    end

    %% ═══════════════════════════════════════════════════════════════════════
    %% FRONTEND INTERFACES - WEB DASHBOARD
    %% ═══════════════════════════════════════════════════════════════════════
    subgraph FRONTENDS["🖥️ FRONTEND INTERFACES"]
        direction TB
        subgraph WEB_DASHBOARD["Web Dashboard (Next.js) - 80+ Pages"]
            direction LR
            subgraph DASH_CORE["Core Modules"]
                DASH_HOME["📊 Dashboard<br/>KPIs, alerts, activity"]
                DASH_JOBS["📝 Jobs (9 views)<br/>List, detail, calendar"]
                DASH_CUSTOMERS["👥 Customers<br/>CRM, leads, history"]
                DASH_DISPATCH["🚀 Dispatch<br/>AI recommendations"]
            end
            subgraph DASH_OPS["Operations"]
                DASH_INVOICES["🧾 Invoicing<br/>Create, queue, AFIP"]
                DASH_PAYMENTS["💳 Payments<br/>History, disputes"]
                DASH_FLEET["🚗 Fleet (4 views)<br/>Vehicles, docs, VTV"]
                DASH_INVENTORY["📦 Inventory (11)<br/>Products, stock, PO"]
            end
            subgraph DASH_ANALYTICS["Analytics & Admin"]
                DASH_REPORTS["📈 Analytics (8)<br/>Revenue, ops, AI"]
                DASH_TEAM["👔 Team<br/>Users, locations"]
                DASH_SETTINGS["⚙️ Settings (12)<br/>Integrations config"]
                DASH_ADMIN["🔧 Admin (10)<br/>Queues, Health, Sync<br/>Panic Mode"]
            end
            subgraph DASH_COMMS["Communications"]
                DASH_WHATSAPP["💬 WhatsApp (4)<br/>Conversations, templates"]
                DASH_MAP["🗺️ Live Map<br/>Real-time tracking"]
                DASH_CALENDAR["📅 Calendar<br/>Drag-drop scheduling"]
                DASH_COPILOT["🤖 AI Copilot<br/>Chat, actions"]
            end
        end

        subgraph MOBILE_APP["Mobile App (React Native/Expo) - Technician"]
            direction LR
            MOB_TODAY["📱 Today's Jobs<br/>Priority schedule"]
            MOB_JOBS["📋 All Jobs<br/>List & map view"]
            MOB_DETAIL["🔍 Job Detail<br/>Photos, notes, status"]
            MOB_COMPLETE["✅ Completion<br/>Signature, materials"]
            MOB_INVENTORY["📦 Inventory<br/>Vehicle stock, scan"]
            MOB_GPS["📍 GPS Tracking<br/>Background location"]
            MOB_OFFLINE["💾 Offline Mode<br/>WatermelonDB sync"]
            MOB_ANALYTICS["📊 My Stats<br/>Performance metrics"]
            MOB_VOICE["🎤 Voice Notes<br/>Record & Upload"]
        end

        subgraph MARKETPLACE["Consumer Marketplace"]
            MKT_SEARCH["🔍 Search<br/>Category, location"]
            MKT_PROFILES["⭐ Profiles<br/>Reviews, portfolio"]
            MKT_QUOTES["💬 Request Quotes<br/>Compare providers"]
            MKT_BOOK["📅 Book & Pay<br/>Instant scheduling"]
            MKT_TRACK["📍 Track<br/>Real-time updates"]
            MKT_LOGIN["🔐 Consumer Login<br/>Portal Access"]
        end

        subgraph CONSUMER_MOBILE["Consumer Mobile App"]
            CMOB_DISCOVER["🔍 Discover<br/>Services nearby"]
            CMOB_BOOK["📅 Book<br/>Schedule service"]
            CMOB_TRACK["📍 Track<br/>Live updates"]
            CMOB_RATE["⭐ Rate<br/>Leave reviews"]
        end

        subgraph PUBLIC_PAGES["Public Pages"]
            PUB_LANDING["🏠 Landing<br/>Marketing site"]
            PUB_PROFILE["👤 Business Profile<br/>/p/[slug]"]
            PUB_TRACK["📍 Track Job<br/>/track/[token]"]
            PUB_RATE["⭐ Rate Job<br/>/rate/[token]"]
            PUB_LEGAL["📜 Legal<br/>Terms, privacy"]
            PUB_SEARCH["🔍 Public Directory<br/>/search"]
        end
    end
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

### Core Business
| Group | Purpose |
|-------|---------|
| `/api/customers/*` | Customer management, profiles, history |
| `/api/jobs/*` | Job CRUD, status, workflow execution |
| `/api/invoices/*` | Invoicing, AFIP generation, statuses |
| `/api/payments/*` | Payment collection, tracking, methods |
| `/api/inventory/*` | Product catalog, stock, warehouses, suppliers |
| `/api/locations/*` | Multi-location/branch management |
| `/api/vehicles/*` | Fleet management, maintenance, documents |
| `/api/users/*` | User/Staff management and profiles |
| `/api/employees/*` | Employee-specific records, schedules |
| `/api/team/*` | Team organization and hierarchy |
| `/api/service-types/*` | Configuration of service offerings |
| `/api/zones/*` | Service zone definitions and assignments |
| `/api/organization/*` | Core organization settings and metadata |

### Operations & Access
| Group | Purpose |
|-------|---------|
| `/api/auth/*` | Login, Register, Refresh, Logout, Me |
| `/api/access/*` | Role-based access control (RBAC), Permissions |
| `/api/approvals/*` | Approval workflows (e.g., job completion) |
| `/api/change-requests/*` | Regulated data modification requests |
| `/api/docs/*` | Internal or technical documentation endpoints |
| `/api/documents/*` | General document management/storage |
| `/api/verification/*` | Identity and business verification (KYC/KYB) |

### Finance & Subscriptions
| Group | Purpose |
|-------|---------|
| `/api/billing/*` | Platform billing history, invoices |
| `/api/subscription/*` | Subscription tiers, plan management |
| `/api/usage/*` | Quota tracking (e.g., WhatsApp messages) |

### Communication & Engagement
| Group | Purpose |
|-------|---------|
| `/api/whatsapp/*` | Messaging, templates, conversations |
| `/api/voice/*` | Audio processing (Upload, Transcribe) |
| `/api/notifications/*` | Notification center, preferences |
| `/api/ratings/*` | Customer feedback and reviews |
| `/api/public-profile/*` | Public-facing SEO profiles for marketplace |

### Geospatial & Tracking
| Group | Purpose |
|-------|---------|
| `/api/tracking/*` | Live technician tracking, sessions |
| `/api/dispatch/*` | Active job dispatching logic |
| `/api/map/*` | Map tiling and visualization data |
| `/api/places/*` | Address search and autocomplete |
| `/api/geocoding/*` | Address-to-coordinate conversion |

### System & Admin
| Group | Purpose |
|-------|---------|
| `/api/admin/*` | Super-admin tools (DLQ, Panic, Health) |
| `/api/audit-logs/*` | Activity trails for compliance |
| `/api/cron/*` | Scheduled background tasks |
| `/api/dashboard/*` | Aggregated metrics for dashboard views |
| `/api/health/*` | System uptime and capability checks |
| `/api/monitoring/*` | Performance and error monitoring |
| `/api/settings/*` | Global system configuration |
| `/api/sync/*` | Offline-first synchronization (WatermelonDB) |
| `/api/version/*` | API versioning info |

### Integrations
| Group | Purpose |
|-------|---------|
| `/api/afip/*` | Argentina tax authority integration |
| `/api/mercadopago/*` | Payment gateway integration |
| `/api/webhooks/*` | Incoming events (MP, Dialog360, etc.) |

### Analytics & Intelligence
| Group | Purpose |
|-------|---------|
| `/api/analytics/*` | Reporting, KPIs, predictive models |
| `/api/ai/*` | General AI services (Escalation, analysis) |
| `/api/copilot/*` | Staff AI assistant endpoints |

### Mobile & Legacy
| Group | Purpose |
|-------|---------|
| `/api/mobile/*` | Mobile-app specific optimizations |
| `/api/v1/*` | Legacy or versioned public endpoints |

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
| **Supabase** | Storage, Realtime | File uploads (photos, docs, voice) |
| **Twilio** | SMS Fallback | OTP delivery only |
| **Upstash Redis** | Caching, rate limiting | Key-value store, queues |
| **Expo** | Push notifications | Expo Push API |

---

## 8. User Roles & Permissions

### Role Definitions

| Role | Spanish | Description |
|------|---------|-------------|
| `OWNER` | Dueño | Full platform access including billing |
| `ADMIN` | Administrador | Operations management, limited billing |
| `TECHNICIAN` | Técnico | Mobile field worker, assigned jobs only |

### Permissions Matrix

| Module | Owner | Admin | Technician |
|--------|:-----:|:----------:|:----------:|
| Dashboard | Full | Full | - |
| Jobs (all) | Full | Full | - |
| Jobs (assigned) | Full | Full | View/Update |
| Customers | Full | Full | - |
| Calendar | Full | Full | - |
| Invoices | Full | Full | - |
| Payments | Full | View | - |
| Fleet | Full | View | - |
| Inventory | Full | Full | View only |
| Dispatch Map | Full | Full | - |
| Locations | Full | View | - |
| WhatsApp | Full | Full | - |
| Analytics | Full | Limited | - |
| Team | Full | View | - |
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
| **Applications** | Next.js Web Apps | 1 (Dashboard/Marketing/Admin) |
| | React Native Mobile Apps | 2 (Technician, Consumer) |
| | Total Interfaces | 5 (Dash, Mobile Facades) |
| **API Routes** | **Total API Endpoints** | **242** (Physical Files) |
| | Core Business APIs | 80+ |
| | Admin/Ops APIs | 45+ |
| | Webhook Endpoints | 5 |
| | Cron/Scheduled Tasks | 7 |
| **Database** | Prisma Models | 167 |
| | Enums | 45+ |
| **External Integrations** | **Total Integrations** | **8** |
| | Payment | Mercado Pago |
| | Tax | AFIP (WSAA/WSFE) |
| | Messaging | WhatsApp (Dialog360) |
| | AI | OpenAI (GPT-4, Whisper) |
| | Maps | Google Maps |
| | Push | Expo |
| | Storage | Supabase |
| | SMS | Twilio (Fallback) |
| **User Types** | Business Roles | 3 (Owner, Admin, Tech) |
| | Consumer | 1 |
| | Customer | 1 |
| **Subscription Tiers** | Plans | 4 |
| | Features | 25+ |
| **Background Processing** | **Worker Types** | **28** |
| | Queue Tiers | 3 (RT, BG, Batch) |
| | Event Types | 12+ |

---

## Document Metadata

| Attribute | Value |
|-----------|-------|
| **Version** | 1.1.0 |
| **Last Updated** | 2025-12-30 |
| **Status** | Implementation Verified |
| **Total Models** | 167 |
| **Total API Routes** | 242 |
| **External Integrations** | 8 |
| **Diagram Count** | 13 |
