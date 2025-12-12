# CampoTech Complete System Architecture

## Overview

This document provides a comprehensive visual map of the entire CampoTech Field Service Management platform, showing all user types, interfaces, APIs, external systems, and data flows.

---

## 1. High-Level System Overview

```mermaid
flowchart TB
    subgraph USERS["👥 USER TYPES"]
        OWNER["🏢 Business Owner<br/>Full platform access"]
        ADMIN["👔 Admin/Dispatcher<br/>Operations management"]
        TECH["🔧 Technician<br/>Mobile field worker"]
        CONSUMER["🏠 Consumer<br/>Marketplace user"]
        CUSTOMER["📞 Customer<br/>WhatsApp contact"]
    end

    subgraph INTERFACES["📱 INTERFACES"]
        WEB["🌐 Web Dashboard<br/>dashboard.campotech.com"]
        MOBILE["📱 Mobile App<br/>React Native/Expo"]
        PORTAL["🚪 Customer Portal<br/>Self-service"]
        MARKET["🛒 Marketplace<br/>Consumer discovery"]
        WHATSAPP["💬 WhatsApp<br/>Business API"]
    end

    subgraph CORE["⚙️ CORE PLATFORM"]
        API["🔌 API Layer<br/>Next.js API Routes"]
        WS["📡 WebSocket Server<br/>Real-time updates"]
        QUEUE["⏳ Queue Workers<br/>BullMQ + Redis"]
        AI["🤖 AI Engine<br/>GPT + Whisper"]
    end

    subgraph DATA["💾 DATA LAYER"]
        DB[(PostgreSQL<br/>Supabase)]
        STORAGE["📁 File Storage<br/>Supabase Storage"]
        CACHE["⚡ Cache<br/>Redis"]
    end

    subgraph EXTERNAL["🌍 EXTERNAL SYSTEMS"]
        AFIP["🏛️ AFIP<br/>Electronic invoicing"]
        MP["💳 Mercado Pago<br/>Payments"]
        GOOGLE["🗺️ Google APIs<br/>Maps/Distance"]
        META["📲 Meta/WhatsApp<br/>Business API"]
        OPENAI["🧠 OpenAI<br/>GPT-4 + Whisper"]
        EXPO["📲 Expo<br/>Push notifications"]
    end

    %% User to Interface connections
    OWNER --> WEB
    ADMIN --> WEB
    TECH --> MOBILE
    CONSUMER --> MARKET
    CUSTOMER --> WHATSAPP

    %% Interface to Core
    WEB --> API
    WEB --> WS
    MOBILE --> API
    MOBILE --> WS
    PORTAL --> API
    MARKET --> API
    WHATSAPP --> API

    %% Core internal
    API --> QUEUE
    API --> AI
    WS --> CACHE

    %% Core to Data
    API --> DB
    API --> STORAGE
    QUEUE --> DB
    AI --> DB

    %% Core to External
    API --> AFIP
    API --> MP
    API --> GOOGLE
    API --> META
    AI --> OPENAI
    QUEUE --> EXPO
```

---

## 2. Complete User Journey Map

```mermaid
flowchart LR
    subgraph ONBOARD["🚀 ONBOARDING"]
        REG["Register Business<br/>(Phone + OTP)"]
        SETUP["Setup Profile<br/>(CUIT, Services)"]
        PLAN["Select Plan<br/>(Free→Enterprise)"]
        INVITE["Invite Team<br/>(Techs, Admins)"]
    end

    subgraph DAILY["📅 DAILY OPERATIONS"]
        subgraph INBOUND["📥 Inbound"]
            WA_IN["WhatsApp<br/>Message"]
            CALL_IN["Phone Call<br/>(Transcribed)"]
            MKT_REQ["Marketplace<br/>Request"]
            PORTAL_REQ["Portal<br/>Request"]
        end

        subgraph PROCESS["⚙️ Processing"]
            AI_PROC["AI Analysis<br/>Intent + Entity"]
            JOB_CREATE["Job Creation"]
            DISPATCH["Dispatch/<br/>Assignment"]
        end

        subgraph EXECUTE["🔧 Execution"]
            TRACK["Live Tracking<br/>(En route)"]
            WORK["Job Execution<br/>(Photos, Notes)"]
            MATERIALS["Materials<br/>Used"]
        end

        subgraph CLOSE["✅ Closing"]
            COMPLETE["Job Complete"]
            INVOICE["AFIP Invoice<br/>(CAE)"]
            PAYMENT["Payment<br/>(MP Link)"]
            REVIEW["Customer<br/>Review"]
        end
    end

    subgraph MANAGE["📊 MANAGEMENT"]
        CALENDAR["Calendar<br/>Scheduling"]
        FLEET["Fleet<br/>Vehicles"]
        INVENTORY["Inventory<br/>Stock"]
        ANALYTICS["Analytics<br/>Reports"]
    end

    REG --> SETUP --> PLAN --> INVITE
    INVITE --> DAILY

    WA_IN --> AI_PROC
    CALL_IN --> AI_PROC
    MKT_REQ --> JOB_CREATE
    PORTAL_REQ --> JOB_CREATE
    AI_PROC --> JOB_CREATE
    JOB_CREATE --> DISPATCH
    DISPATCH --> TRACK
    TRACK --> WORK
    WORK --> MATERIALS
    MATERIALS --> COMPLETE
    COMPLETE --> INVOICE
    INVOICE --> PAYMENT
    PAYMENT --> REVIEW

    DISPATCH -.-> CALENDAR
    MATERIALS -.-> INVENTORY
    TRACK -.-> FLEET
    REVIEW -.-> ANALYTICS
```

---

## 3. Data Entity Relationships

```mermaid
erDiagram
    %% Core Business Entities
    ORGANIZATIONS ||--o{ USERS : "employs"
    ORGANIZATIONS ||--o{ CUSTOMERS : "serves"
    ORGANIZATIONS ||--o{ JOBS : "creates"
    ORGANIZATIONS ||--o{ INVOICES : "issues"
    ORGANIZATIONS ||--o{ VEHICLES : "owns"
    ORGANIZATIONS ||--o{ INVENTORY_ITEMS : "stocks"
    ORGANIZATIONS ||--o{ LOCATIONS : "operates_at"
    ORGANIZATIONS ||--o{ PRICE_BOOK : "offers"

    %% User Relations
    USERS ||--o{ JOBS : "assigned_to"
    USERS ||--o{ TECHNICIAN_LOCATIONS : "tracked_at"
    USERS ||--o{ VEHICLE_ASSIGNMENTS : "drives"
    USERS ||--o{ ONBOARDING_PROGRESS : "completes"
    USERS ||--o{ NOTIFICATION_PREFERENCES : "configures"
    USERS ||--o{ PUSH_TOKENS : "registers"

    %% Job Relations
    JOBS ||--o{ JOB_PHOTOS : "has"
    JOBS ||--o{ JOB_MATERIALS : "uses"
    JOBS ||--o{ JOB_STATUS_HISTORY : "tracks"
    JOBS ||--|| INVOICES : "generates"
    JOBS ||--o{ TRACKING_SESSIONS : "tracked_via"
    JOBS ||--o{ INVENTORY_TRANSACTIONS : "consumes"
    CUSTOMERS ||--o{ JOBS : "requests"

    %% Financial
    INVOICES ||--o{ PAYMENTS : "receives"
    INVOICES }o--|| AFIP_SEQUENCES : "numbered_by"

    %% Fleet Management
    VEHICLES ||--o{ VEHICLE_DOCUMENTS : "has"
    VEHICLES ||--o{ VEHICLE_ASSIGNMENTS : "assigned_via"
    VEHICLES ||--o{ INVENTORY_LOCATIONS : "stores_at"

    %% Inventory
    INVENTORY_ITEMS ||--o{ INVENTORY_STOCK : "stored_in"
    INVENTORY_LOCATIONS ||--o{ INVENTORY_STOCK : "holds"
    INVENTORY_ITEMS ||--o{ INVENTORY_TRANSACTIONS : "moved_via"

    %% Tracking
    TRACKING_SESSIONS ||--o{ TRACKING_LOCATION_HISTORY : "records"
    TRACKING_SESSIONS ||--o{ TRACKING_TOKENS : "generates"

    %% Communications
    ORGANIZATIONS ||--o{ WHATSAPP_MESSAGES : "receives"
    ORGANIZATIONS ||--o{ VOICE_MESSAGES : "transcribes"
    ORGANIZATIONS ||--o{ CONVERSATION_CONTEXTS : "maintains"

    %% Marketplace
    CONSUMER_PROFILES ||--o{ CONSUMER_SERVICE_REQUESTS : "creates"
    CONSUMER_SERVICE_REQUESTS ||--o{ BUSINESS_QUOTES : "receives"
    ORGANIZATIONS ||--|| BUSINESS_PUBLIC_PROFILES : "publishes"
    CONSUMER_PROFILES ||--o{ CONSUMER_REVIEWS : "writes"

    %% Notifications
    ORGANIZATIONS ||--o{ NOTIFICATION_TEMPLATES : "defines"
    ORGANIZATIONS ||--o{ NOTIFICATION_LOGS : "sends"
    ORGANIZATIONS ||--o{ SCHEDULED_REMINDERS : "queues"

    %% Multi-location
    LOCATIONS ||--o{ USER_LOCATION_ASSIGNMENTS : "staffed_by"
    LOCATIONS ||--o{ LOCATION_SETTINGS : "configured_with"

    %% API Access
    ORGANIZATIONS ||--o{ API_KEYS : "authenticates_with"
    ORGANIZATIONS ||--o{ WEBHOOK_CONFIGS : "notifies_via"

    %% Audit
    ORGANIZATIONS ||--o{ AUDIT_LOGS : "tracked_in"

    %% Customer Portal
    CUSTOMERS ||--o| CUSTOMER_PORTAL_ACCESS : "logs_in_via"
```

---

## 4. API & External Systems Integration Map

```mermaid
flowchart TB
    subgraph CAMPOTECH["🏠 CAMPOTECH PLATFORM"]
        subgraph API_ROUTES["API Routes"]
            AUTH["/api/auth/*<br/>OTP, Login, Session"]
            JOBS_API["/api/jobs/*<br/>CRUD, Status, Assignment"]
            TRACK_API["/api/tracking/*<br/>Location, Nearest, Subscribe"]
            INV_API["/api/invoices/*<br/>Create, CAE, Send"]
            PAY_API["/api/payments/*<br/>Create, Webhook, Status"]
            FLEET_API["/api/vehicles/*<br/>CRUD, Documents, Assign"]
            STOCK_API["/api/inventory/*<br/>Items, Locations, Transactions"]
            WA_API["/api/whatsapp/*<br/>Webhook, Send, Voice"]
            MKT_API["/api/marketplace/*<br/>Requests, Quotes, Reviews"]
            DASH_API["/api/dashboard/*<br/>Metrics, Alerts, Analytics"]
        end

        subgraph WORKERS["Queue Workers"]
            W_INVOICE["invoice:generate-cae"]
            W_NOTIFY["notification:send"]
            W_FLEET["fleet:check-expiry"]
            W_STOCK["inventory:check-stock"]
            W_WA["whatsapp:process-message"]
            W_VOICE["voice:transcribe"]
            W_SYNC["sync:process-offline"]
        end
    end

    subgraph AFIP_SYS["🏛️ AFIP (Argentina Tax)"]
        AFIP_AUTH["WSAA<br/>Authentication"]
        AFIP_FE["WSFEV1<br/>Electronic Invoice"]
        AFIP_PADRON["Padrón<br/>CUIT Validation"]
    end

    subgraph MP_SYS["💳 MERCADO PAGO"]
        MP_PREF["Preferences API<br/>Create Payment"]
        MP_HOOK["Webhooks<br/>Payment Status"]
        MP_REFUND["Refunds API"]
    end

    subgraph GOOGLE_SYS["🗺️ GOOGLE APIS"]
        G_MAPS["Maps JavaScript<br/>Display Maps"]
        G_PLACES["Places API<br/>Address Autocomplete"]
        G_GEO["Geocoding API<br/>Address ↔ Coords"]
        G_DIR["Directions API<br/>Routes & Polylines"]
        G_DIST["Distance Matrix<br/>ETAs & Traffic"]
    end

    subgraph META_SYS["📱 META / WHATSAPP"]
        WA_CLOUD["Cloud API<br/>Send/Receive"]
        WA_WEBHOOK["Webhook<br/>Message Events"]
        WA_MEDIA["Media API<br/>Voice/Image Download"]
    end

    subgraph OPENAI_SYS["🧠 OPENAI"]
        GPT["GPT-4<br/>Intent & Entity"]
        WHISPER["Whisper<br/>Voice Transcription"]
    end

    subgraph NOTIF_SYS["📬 NOTIFICATIONS"]
        EXPO_PUSH["Expo Push<br/>Mobile Notifications"]
        EMAIL["Email Provider<br/>(Resend/SendGrid)"]
    end

    subgraph STORAGE_SYS["📁 STORAGE"]
        SUPA_STORE["Supabase Storage<br/>Files & Images"]
        SUPA_DB["Supabase PostgreSQL<br/>Database"]
    end

    %% API to External connections
    INV_API --> AFIP_AUTH
    INV_API --> AFIP_FE
    AUTH --> AFIP_PADRON

    PAY_API --> MP_PREF
    MP_HOOK --> PAY_API
    PAY_API --> MP_REFUND

    TRACK_API --> G_MAPS
    TRACK_API --> G_DIST
    JOBS_API --> G_PLACES
    JOBS_API --> G_GEO
    TRACK_API --> G_DIR

    WA_API --> WA_CLOUD
    WA_WEBHOOK --> WA_API
    WA_API --> WA_MEDIA

    W_WA --> GPT
    W_VOICE --> WHISPER

    W_NOTIFY --> EXPO_PUSH
    W_NOTIFY --> EMAIL

    FLEET_API --> SUPA_STORE
    JOBS_API --> SUPA_STORE
    
    %% All APIs to DB
    AUTH --> SUPA_DB
    JOBS_API --> SUPA_DB
    TRACK_API --> SUPA_DB
    INV_API --> SUPA_DB
    PAY_API --> SUPA_DB
    FLEET_API --> SUPA_DB
    STOCK_API --> SUPA_DB
    WA_API --> SUPA_DB
    MKT_API --> SUPA_DB
    DASH_API --> SUPA_DB
```

---

## 5. User Interface Access Matrix

```mermaid
flowchart TB
    subgraph ROLES["👤 USER ROLES"]
        R_OWNER["🏢 OWNER<br/>subscription_tier holder"]
        R_ADMIN["👔 ADMIN<br/>full ops access"]
        R_DISPATCH["📋 DISPATCHER<br/>scheduling only"]
        R_TECH["🔧 TECHNICIAN<br/>mobile field work"]
        R_CONSUMER["🏠 CONSUMER<br/>marketplace user"]
        R_CUSTOMER["📞 CUSTOMER<br/>existing client"]
    end

    subgraph MODULES["📦 PLATFORM MODULES"]
        M_DASH["📊 Dashboard<br/>Overview & Alerts"]
        M_JOBS["📋 Jobs<br/>Create & Manage"]
        M_CAL["📅 Calendar<br/>Scheduling"]
        M_MAP["🗺️ Live Map<br/>Tracking"]
        M_CUST["👥 Customers<br/>CRM"]
        M_INV["🧾 Invoices<br/>AFIP Billing"]
        M_PAY["💳 Payments<br/>MP Integration"]
        M_FLEET["🚗 Fleet<br/>Vehicles & Docs"]
        M_STOCK["📦 Inventory<br/>Stock Management"]
        M_TEAM["👥 Team<br/>User Management"]
        M_SETTINGS["⚙️ Settings<br/>Configuration"]
        M_ANALYTICS["📈 Analytics<br/>Reports"]
        M_MOBILE["📱 Mobile App<br/>Field Operations"]
        M_PORTAL["🚪 Customer Portal<br/>Self-Service"]
        M_MARKET["🛒 Marketplace<br/>Discovery"]
    end

    %% Owner access (all)
    R_OWNER --> M_DASH
    R_OWNER --> M_JOBS
    R_OWNER --> M_CAL
    R_OWNER --> M_MAP
    R_OWNER --> M_CUST
    R_OWNER --> M_INV
    R_OWNER --> M_PAY
    R_OWNER --> M_FLEET
    R_OWNER --> M_STOCK
    R_OWNER --> M_TEAM
    R_OWNER --> M_SETTINGS
    R_OWNER --> M_ANALYTICS

    %% Admin access (ops, no billing settings)
    R_ADMIN --> M_DASH
    R_ADMIN --> M_JOBS
    R_ADMIN --> M_CAL
    R_ADMIN --> M_MAP
    R_ADMIN --> M_CUST
    R_ADMIN --> M_INV
    R_ADMIN --> M_PAY
    R_ADMIN --> M_FLEET
    R_ADMIN --> M_STOCK
    R_ADMIN --> M_TEAM
    R_ADMIN --> M_ANALYTICS

    %% Dispatcher access
    R_DISPATCH --> M_DASH
    R_DISPATCH --> M_JOBS
    R_DISPATCH --> M_CAL
    R_DISPATCH --> M_MAP
    R_DISPATCH --> M_CUST

    %% Technician access (mobile only)
    R_TECH --> M_MOBILE

    %% Consumer access (marketplace)
    R_CONSUMER --> M_MARKET

    %% Customer access (portal)
    R_CUSTOMER --> M_PORTAL
```

---

## 6. WhatsApp AI Flow (Customer Intake)

```mermaid
flowchart TB
    subgraph CUSTOMER["📞 CUSTOMER"]
        C_MSG["Sends WhatsApp<br/>Message"]
        C_VOICE["Sends Voice<br/>Note"]
        C_MULTI["Sends Multiple<br/>Messages"]
    end

    subgraph WEBHOOK["🔗 WEBHOOK RECEIVER"]
        WH_RECV["POST /api/whatsapp/webhook<br/>Receive message"]
        WH_VALID["Validate signature<br/>(Meta verification)"]
        WH_QUEUE["Queue for processing"]
    end

    subgraph AGGREGATION["⏳ MESSAGE AGGREGATION"]
        AGG_WAIT["Wait 8 seconds<br/>(collect multi-messages)"]
        AGG_CHECK["Check for more<br/>incoming messages"]
        AGG_COMBINE["Combine into<br/>single context"]
    end

    subgraph AI_PROCESS["🤖 AI PROCESSING"]
        subgraph VOICE_PROC["Voice Processing"]
            VOICE_DL["Download audio<br/>from Meta"]
            VOICE_TRANS["Whisper<br/>Transcription"]
        end

        subgraph TEXT_PROC["Text Analysis"]
            GPT_INTENT["GPT: Extract Intent<br/>(new_job, followup, question)"]
            GPT_ENTITY["GPT: Extract Entities<br/>(service, address, urgency)"]
            GPT_SENTIMENT["GPT: Sentiment<br/>(frustrated, neutral, happy)"]
        end

        AI_DECIDE["Decision:<br/>Auto-respond or<br/>Human needed?"]
    end

    subgraph ACTIONS["⚡ ACTIONS"]
        ACT_JOB["Create Job<br/>(if new request)"]
        ACT_UPDATE["Update Existing<br/>(if followup)"]
        ACT_RESPOND["Auto-respond<br/>(if simple question)"]
        ACT_HUMAN["Flag for Human<br/>(if complex/frustrated)"]
        ACT_QUOTE["Send Quote<br/>(from price book)"]
    end

    subgraph RESPONSE["💬 RESPONSE"]
        RESP_TEMPLATE["Load WhatsApp<br/>Template"]
        RESP_SEND["Send via<br/>Cloud API"]
        RESP_LOG["Log in<br/>conversation_contexts"]
    end

    subgraph CONTEXT["📝 CONTEXT STORAGE"]
        CTX_LOAD["Load 24h<br/>conversation history"]
        CTX_UPDATE["Update with<br/>new messages"]
        CTX_CUSTOMER["Link to<br/>customer record"]
    end

    C_MSG --> WH_RECV
    C_VOICE --> WH_RECV
    C_MULTI --> WH_RECV

    WH_RECV --> WH_VALID --> WH_QUEUE

    WH_QUEUE --> AGG_WAIT
    AGG_WAIT --> AGG_CHECK
    AGG_CHECK -->|more coming| AGG_WAIT
    AGG_CHECK -->|done| AGG_COMBINE

    AGG_COMBINE --> CTX_LOAD
    CTX_LOAD --> VOICE_DL
    VOICE_DL --> VOICE_TRANS
    VOICE_TRANS --> GPT_INTENT

    CTX_LOAD --> GPT_INTENT
    GPT_INTENT --> GPT_ENTITY
    GPT_ENTITY --> GPT_SENTIMENT
    GPT_SENTIMENT --> AI_DECIDE

    AI_DECIDE -->|new service request| ACT_JOB
    AI_DECIDE -->|existing job update| ACT_UPDATE
    AI_DECIDE -->|simple FAQ| ACT_RESPOND
    AI_DECIDE -->|needs human| ACT_HUMAN
    AI_DECIDE -->|price inquiry| ACT_QUOTE

    ACT_JOB --> RESP_TEMPLATE
    ACT_UPDATE --> RESP_TEMPLATE
    ACT_RESPOND --> RESP_TEMPLATE
    ACT_HUMAN --> RESP_TEMPLATE
    ACT_QUOTE --> RESP_TEMPLATE

    RESP_TEMPLATE --> RESP_SEND
    RESP_SEND --> RESP_LOG
    RESP_LOG --> CTX_UPDATE
    CTX_UPDATE --> CTX_CUSTOMER
```

---

## 7. Job Lifecycle & Dispatch Flow

```mermaid
flowchart TB
    subgraph INTAKE["📥 JOB INTAKE"]
        IN_WA["WhatsApp<br/>AI Created"]
        IN_PHONE["Phone Call<br/>Transcribed"]
        IN_MKT["Marketplace<br/>Consumer Request"]
        IN_PORTAL["Customer Portal<br/>Logged Request"]
        IN_MANUAL["Manual Entry<br/>Dashboard"]
    end

    subgraph TRIAGE["🔍 TRIAGE"]
        TRI_CLASSIFY["Classify<br/>Service Type"]
        TRI_PRIORITY["Set Priority<br/>(Emergency/Normal)"]
        TRI_ZONE["Identify<br/>Service Zone"]
    end

    subgraph DISPATCH["📋 DISPATCH"]
        DISP_FIND["Find Nearest<br/>Available Tech"]
        DISP_MATRIX["Google Distance<br/>Matrix API"]
        DISP_RANK["Rank by:<br/>ETA + Skills + Load"]
        DISP_ASSIGN["Assign to<br/>Technician"]
        DISP_CAL["Update<br/>Calendar"]
    end

    subgraph NOTIFY_ASSIGN["📬 NOTIFICATIONS"]
        NOT_TECH["Push to Tech<br/>New Job Assigned"]
        NOT_CUST["WhatsApp to Customer<br/>Tech Assigned + ETA"]
    end

    subgraph EXECUTION["🔧 EXECUTION"]
        EX_ACCEPT["Tech Accepts<br/>(or Rejects)"]
        EX_ENROUTE["Status: EN_ROUTE<br/>Tracking Starts"]
        EX_ARRIVE["Status: ARRIVED<br/>Customer Notified"]
        EX_PROGRESS["Status: IN_PROGRESS<br/>Work Begins"]
        EX_PHOTOS["Upload Photos<br/>Before/During/After"]
        EX_MATERIALS["Log Materials<br/>Used"]
        EX_COMPLETE["Status: COMPLETED<br/>Work Done"]
    end

    subgraph TRACKING["📍 LIVE TRACKING"]
        TRACK_START["Start Tracking<br/>Session"]
        TRACK_UPDATE["Location Updates<br/>Every 15s"]
        TRACK_WS["WebSocket<br/>to Dashboard"]
        TRACK_LINK["Customer<br/>Tracking Link"]
        TRACK_ETA["Real-time<br/>ETA Updates"]
    end

    subgraph CLOSE["✅ CLOSING"]
        CLOSE_SIG["Customer<br/>Signature"]
        CLOSE_INV["Generate<br/>AFIP Invoice"]
        CLOSE_PAY["Send MP<br/>Payment Link"]
        CLOSE_REVIEW["Request<br/>Review"]
    end

    %% Intake to Triage
    IN_WA --> TRI_CLASSIFY
    IN_PHONE --> TRI_CLASSIFY
    IN_MKT --> TRI_CLASSIFY
    IN_PORTAL --> TRI_CLASSIFY
    IN_MANUAL --> TRI_CLASSIFY

    TRI_CLASSIFY --> TRI_PRIORITY --> TRI_ZONE

    %% Triage to Dispatch
    TRI_ZONE --> DISP_FIND
    DISP_FIND --> DISP_MATRIX
    DISP_MATRIX --> DISP_RANK
    DISP_RANK --> DISP_ASSIGN
    DISP_ASSIGN --> DISP_CAL

    %% Dispatch to Notifications
    DISP_ASSIGN --> NOT_TECH
    DISP_ASSIGN --> NOT_CUST

    %% Execution flow
    NOT_TECH --> EX_ACCEPT
    EX_ACCEPT --> EX_ENROUTE
    EX_ENROUTE --> EX_ARRIVE
    EX_ARRIVE --> EX_PROGRESS
    EX_PROGRESS --> EX_PHOTOS
    EX_PHOTOS --> EX_MATERIALS
    EX_MATERIALS --> EX_COMPLETE

    %% Tracking parallel
    EX_ENROUTE --> TRACK_START
    TRACK_START --> TRACK_UPDATE
    TRACK_UPDATE --> TRACK_WS
    TRACK_UPDATE --> TRACK_LINK
    TRACK_UPDATE --> TRACK_ETA
    EX_ARRIVE --> TRACK_START

    %% Closing
    EX_COMPLETE --> CLOSE_SIG
    CLOSE_SIG --> CLOSE_INV
    CLOSE_INV --> CLOSE_PAY
    CLOSE_PAY --> CLOSE_REVIEW
```

---

## 8. Invoicing & Payment Flow

```mermaid
flowchart TB
    subgraph TRIGGER["⚡ INVOICE TRIGGERS"]
        TRIG_COMPLETE["Job Completed"]
        TRIG_MANUAL["Manual Creation"]
        TRIG_QUOTE["Quote Accepted"]
    end

    subgraph PREPARE["📝 PREPARATION"]
        PREP_DATA["Gather Data:<br/>Customer, Items, Materials"]
        PREP_TYPE["Determine Invoice Type:<br/>A, B, C (based on customer)"]
        PREP_SEQ["Get Next Number<br/>from afip_sequences"]
        PREP_CALC["Calculate:<br/>Subtotal, IVA, Total"]
    end

    subgraph AFIP_FLOW["🏛️ AFIP AUTHORIZATION"]
        AFIP_TOKEN["Get WSAA Token<br/>(24h validity)"]
        AFIP_REQ["Send to WSFEV1<br/>FECAESolicitar"]
        AFIP_WAIT["Wait for Response"]
        AFIP_CAE["Receive CAE<br/>(Authorization Code)"]
        AFIP_STORE["Store CAE +<br/>Expiry Date"]
    end

    subgraph ERRORS["❌ ERROR HANDLING"]
        ERR_RETRY["Retry Logic<br/>(3 attempts)"]
        ERR_QUEUE["Queue for<br/>Manual Review"]
        ERR_NOTIFY["Notify Owner<br/>AFIP Error"]
    end

    subgraph DELIVERY["📤 DELIVERY"]
        DEL_PDF["Generate PDF<br/>with QR Code"]
        DEL_STORE["Store in<br/>Supabase Storage"]
        DEL_WA["Send via<br/>WhatsApp"]
        DEL_EMAIL["Send via<br/>Email (optional)"]
        DEL_PORTAL["Available in<br/>Customer Portal"]
    end

    subgraph PAYMENT["💳 PAYMENT"]
        PAY_LINK["Generate MP<br/>Payment Link"]
        PAY_INSTALL["Offer Installments<br/>(3, 6, 12 cuotas)"]
        PAY_SEND["Send Link<br/>with Invoice"]
        PAY_WAIT["Wait for<br/>Payment"]
    end

    subgraph MP_WEBHOOK["🔔 MP WEBHOOK"]
        MP_RECV["Receive Webhook<br/>payment.updated"]
        MP_VERIFY["Verify with<br/>MP API"]
        MP_UPDATE["Update Invoice<br/>Status: PAID"]
        MP_NOTIFY["Notify Owner<br/>Payment Received"]
    end

    %% Triggers
    TRIG_COMPLETE --> PREP_DATA
    TRIG_MANUAL --> PREP_DATA
    TRIG_QUOTE --> PREP_DATA

    %% Preparation
    PREP_DATA --> PREP_TYPE
    PREP_TYPE --> PREP_SEQ
    PREP_SEQ --> PREP_CALC

    %% AFIP
    PREP_CALC --> AFIP_TOKEN
    AFIP_TOKEN --> AFIP_REQ
    AFIP_REQ --> AFIP_WAIT
    AFIP_WAIT -->|success| AFIP_CAE
    AFIP_WAIT -->|error| ERR_RETRY
    ERR_RETRY -->|retry| AFIP_REQ
    ERR_RETRY -->|max attempts| ERR_QUEUE
    ERR_QUEUE --> ERR_NOTIFY
    AFIP_CAE --> AFIP_STORE

    %% Delivery
    AFIP_STORE --> DEL_PDF
    DEL_PDF --> DEL_STORE
    DEL_STORE --> DEL_WA
    DEL_STORE --> DEL_EMAIL
    DEL_STORE --> DEL_PORTAL

    %% Payment
    DEL_WA --> PAY_LINK
    PAY_LINK --> PAY_INSTALL
    PAY_INSTALL --> PAY_SEND
    PAY_SEND --> PAY_WAIT

    %% MP Webhook
    PAY_WAIT --> MP_RECV
    MP_RECV --> MP_VERIFY
    MP_VERIFY --> MP_UPDATE
    MP_UPDATE --> MP_NOTIFY
```

---

## 9. Fleet & Inventory Management

```mermaid
flowchart TB
    subgraph FLEET["🚗 FLEET MANAGEMENT"]
        subgraph VEHICLES["Vehicle Registry"]
            VEH_ADD["Add Vehicle<br/>(Plate, Make, Model)"]
            VEH_DOCS["Upload Documents<br/>(Insurance, VTV, Title)"]
            VEH_ASSIGN["Assign Workers<br/>(Primary + Secondary)"]
        end

        subgraph COMPLIANCE["Buenos Aires Compliance"]
            COMP_VTV["VTV Tracking<br/>(Verificación Técnica)"]
            COMP_INS["Insurance Expiry<br/>Tracking"]
            COMP_REG["Registration<br/>Tracking"]
        end

        subgraph ALERTS_FLEET["Fleet Alerts"]
            ALT_30["⚠️ 30 days<br/>before expiry"]
            ALT_15["⚠️ 15 days<br/>before expiry"]
            ALT_7["🔴 7 days<br/>before expiry"]
            ALT_EXP["🚨 EXPIRED<br/>Critical alert"]
        end
    end

    subgraph INVENTORY["📦 INVENTORY MANAGEMENT"]
        subgraph LOCATIONS["Storage Locations"]
            LOC_HUB["🏢 Hub/Warehouse<br/>Central Storage"]
            LOC_VEH["🚐 Vehicle Inventory<br/>Per Technician"]
        end

        subgraph OPERATIONS["Stock Operations"]
            OP_PURCHASE["Purchase<br/>New Stock"]
            OP_TRANSFER["Transfer<br/>Hub ↔ Vehicle"]
            OP_USE["Usage<br/>Job Materials"]
            OP_ADJUST["Adjustment<br/>Count Correction"]
            OP_RETURN["Return<br/>Unused Items"]
        end

        subgraph ALERTS_INV["Inventory Alerts"]
            ALT_LOW["⚠️ Low Stock<br/>Below minimum"]
            ALT_OUT["🔴 Out of Stock<br/>Zero quantity"]
            ALT_REORDER["📋 Reorder<br/>Suggestion"]
        end
    end

    subgraph JOB_MATERIALS["🔧 JOB INTEGRATION"]
        JOB_START["Job Starts"]
        JOB_USE["Tech Records<br/>Materials Used"]
        JOB_DEDUCT["Auto-Deduct<br/>from Vehicle Stock"]
        JOB_COST["Calculate<br/>Material Cost"]
        JOB_INVOICE["Add to<br/>Invoice"]
    end

    subgraph DASHBOARD["📊 DASHBOARD WIDGETS"]
        DASH_FLEET["Fleet Status<br/>Compliance Overview"]
        DASH_STOCK["Stock Alerts<br/>Critical Items"]
        DASH_UNIFIED["Unified Alerts<br/>All Systems"]
    end

    %% Fleet flow
    VEH_ADD --> VEH_DOCS
    VEH_DOCS --> VEH_ASSIGN
    VEH_DOCS --> COMP_VTV
    VEH_DOCS --> COMP_INS
    VEH_DOCS --> COMP_REG

    COMP_VTV --> ALT_30
    COMP_INS --> ALT_30
    COMP_REG --> ALT_30
    ALT_30 --> ALT_15 --> ALT_7 --> ALT_EXP

    %% Inventory flow
    OP_PURCHASE --> LOC_HUB
    LOC_HUB --> OP_TRANSFER
    OP_TRANSFER --> LOC_VEH
    LOC_VEH --> OP_USE
    OP_USE --> OP_ADJUST
    OP_ADJUST --> OP_RETURN

    LOC_HUB --> ALT_LOW
    LOC_VEH --> ALT_LOW
    ALT_LOW --> ALT_OUT
    ALT_OUT --> ALT_REORDER

    %% Job integration
    JOB_START --> JOB_USE
    JOB_USE --> JOB_DEDUCT
    JOB_DEDUCT --> LOC_VEH
    JOB_DEDUCT --> JOB_COST
    JOB_COST --> JOB_INVOICE

    %% Dashboard
    ALT_EXP --> DASH_FLEET
    ALT_OUT --> DASH_STOCK
    DASH_FLEET --> DASH_UNIFIED
    DASH_STOCK --> DASH_UNIFIED
```

---

## 10. Consumer Marketplace Flow

```mermaid
flowchart TB
    subgraph CONSUMER["🏠 CONSUMER JOURNEY"]
        CON_LAND["Land on Marketplace<br/>(SEO/Ads)"]
        CON_AUTH["Phone Auth<br/>(OTP only)"]
        CON_PROFILE["Create Profile<br/>(Name, Address)"]
    end

    subgraph REQUEST["📝 SERVICE REQUEST"]
        REQ_CAT["Select Category<br/>(Plomería, Gas, etc.)"]
        REQ_DESC["Describe Problem<br/>(Text + Photos)"]
        REQ_VOICE["Optional: Voice Note<br/>(Transcribed)"]
        REQ_URGENCY["Set Urgency<br/>(Emergency → Flexible)"]
        REQ_BUDGET["Budget Range<br/>(Optional)"]
        REQ_SUBMIT["Submit Request"]
    end

    subgraph MATCHING["🎯 MATCHING ENGINE"]
        MATCH_ZONE["Filter by<br/>Service Zone"]
        MATCH_CAT["Filter by<br/>Service Category"]
        MATCH_AVAIL["Filter by<br/>Availability"]
        MATCH_SCORE["Rank by<br/>Profile Score"]
        MATCH_SEND["Send to<br/>Top 5 Businesses"]
    end

    subgraph BUSINESS["🏢 BUSINESS RESPONSE"]
        BIZ_NOTIF["Receive<br/>Notification"]
        BIZ_VIEW["View Request<br/>Details"]
        BIZ_QUOTE["Submit Quote<br/>(Price + Availability)"]
        BIZ_MSG["Add Message<br/>(Optional)"]
    end

    subgraph SELECTION["✅ CONSUMER SELECTION"]
        SEL_VIEW["View Quotes<br/>+ Business Profiles"]
        SEL_COMPARE["Compare:<br/>Price, Rating, Response Time"]
        SEL_ACCEPT["Accept Quote"]
        SEL_JOB["Job Created<br/>in Business System"]
    end

    subgraph COMPLETION["⭐ COMPLETION"]
        COMP_DONE["Job Completed"]
        COMP_PAY["Payment Made"]
        COMP_REVIEW["Leave Review<br/>(1-5 Stars + Text)"]
        COMP_UPDATE["Update Business<br/>Public Profile"]
    end

    subgraph BIZ_PROFILE["📊 BUSINESS PROFILE"]
        PROF_BASIC["Basic Info<br/>(Name, Logo, Services)"]
        PROF_VERIFY["Verification Badges<br/>(CUIT, License, Insurance)"]
        PROF_RATING["Aggregated Rating<br/>(Avg + Count)"]
        PROF_RESPONSE["Response Metrics<br/>(Time, Rate)"]
        PROF_SCORE["Profile Score<br/>(0-100)"]
    end

    %% Consumer journey
    CON_LAND --> CON_AUTH
    CON_AUTH --> CON_PROFILE
    CON_PROFILE --> REQ_CAT

    %% Request flow
    REQ_CAT --> REQ_DESC
    REQ_DESC --> REQ_VOICE
    REQ_VOICE --> REQ_URGENCY
    REQ_URGENCY --> REQ_BUDGET
    REQ_BUDGET --> REQ_SUBMIT

    %% Matching
    REQ_SUBMIT --> MATCH_ZONE
    MATCH_ZONE --> MATCH_CAT
    MATCH_CAT --> MATCH_AVAIL
    MATCH_AVAIL --> MATCH_SCORE
    MATCH_SCORE --> MATCH_SEND

    %% Business response
    MATCH_SEND --> BIZ_NOTIF
    BIZ_NOTIF --> BIZ_VIEW
    BIZ_VIEW --> BIZ_QUOTE
    BIZ_QUOTE --> BIZ_MSG

    %% Selection
    BIZ_MSG --> SEL_VIEW
    SEL_VIEW --> SEL_COMPARE
    SEL_COMPARE --> SEL_ACCEPT
    SEL_ACCEPT --> SEL_JOB

    %% Completion
    SEL_JOB --> COMP_DONE
    COMP_DONE --> COMP_PAY
    COMP_PAY --> COMP_REVIEW
    COMP_REVIEW --> COMP_UPDATE

    %% Profile
    COMP_UPDATE --> PROF_RATING
    PROF_BASIC --> PROF_VERIFY
    PROF_VERIFY --> PROF_RATING
    PROF_RATING --> PROF_RESPONSE
    PROF_RESPONSE --> PROF_SCORE
    PROF_SCORE --> MATCH_SCORE
```

---

## 11. Real-Time Systems (WebSocket)

```mermaid
flowchart LR
    subgraph SOURCES["📡 EVENT SOURCES"]
        SRC_MOBILE["Mobile App<br/>Location Updates"]
        SRC_JOB["Job Status<br/>Changes"]
        SRC_PAY["Payment<br/>Webhooks"]
        SRC_WA["WhatsApp<br/>Messages"]
        SRC_ALERT["System<br/>Alerts"]
    end

    subgraph WS_SERVER["🔌 WEBSOCKET SERVER"]
        WS_AUTH["Authenticate<br/>Connection"]
        WS_ROOMS["Room Management<br/>(per organization)"]
        WS_BROADCAST["Broadcast<br/>to Subscribers"]
    end

    subgraph EVENTS["📨 EVENT TYPES"]
        EV_LOC["technician_location_update<br/>{userId, lat, lng, speed}"]
        EV_JOB["job_status_changed<br/>{jobId, status, techId}"]
        EV_PAY["payment_received<br/>{invoiceId, amount}"]
        EV_MSG["new_whatsapp_message<br/>{from, content}"]
        EV_ALERT["system_alert<br/>{type, severity, message}"]
    end

    subgraph SUBSCRIBERS["👥 SUBSCRIBERS"]
        SUB_MAP["Live Map<br/>Dashboard"]
        SUB_JOBS["Jobs List<br/>Page"]
        SUB_DASH["Main<br/>Dashboard"]
        SUB_NOTIF["Notification<br/>Center"]
    end

    %% Sources to WS
    SRC_MOBILE --> WS_AUTH
    SRC_JOB --> WS_AUTH
    SRC_PAY --> WS_AUTH
    SRC_WA --> WS_AUTH
    SRC_ALERT --> WS_AUTH

    %% WS Internal
    WS_AUTH --> WS_ROOMS
    WS_ROOMS --> WS_BROADCAST

    %% Events
    WS_BROADCAST --> EV_LOC
    WS_BROADCAST --> EV_JOB
    WS_BROADCAST --> EV_PAY
    WS_BROADCAST --> EV_MSG
    WS_BROADCAST --> EV_ALERT

    %% To subscribers
    EV_LOC --> SUB_MAP
    EV_JOB --> SUB_JOBS
    EV_JOB --> SUB_MAP
    EV_PAY --> SUB_DASH
    EV_MSG --> SUB_NOTIF
    EV_ALERT --> SUB_DASH
    EV_ALERT --> SUB_NOTIF
```

---

## 12. Queue & Background Jobs

```mermaid
flowchart TB
    subgraph QUEUES["⏳ JOB QUEUES (BullMQ)"]
        Q_INVOICE["invoice:*<br/>AFIP processing"]
        Q_NOTIFY["notification:*<br/>Push/Email/SMS"]
        Q_WA["whatsapp:*<br/>Message processing"]
        Q_VOICE["voice:*<br/>Transcription"]
        Q_FLEET["fleet:*<br/>Document checks"]
        Q_INV["inventory:*<br/>Stock alerts"]
        Q_SYNC["sync:*<br/>Offline sync"]
        Q_ANALYTICS["analytics:*<br/>Aggregation"]
    end

    subgraph TRIGGERS["⚡ TRIGGERS"]
        TRIG_API["API Request"]
        TRIG_WEBHOOK["External Webhook"]
        TRIG_CRON["Scheduled Cron"]
        TRIG_EVENT["Database Event"]
    end

    subgraph WORKERS["👷 WORKERS"]
        W_INV["Invoice Worker<br/>AFIP CAE generation"]
        W_NOT["Notification Worker<br/>Multi-channel send"]
        W_WA["WhatsApp Worker<br/>AI + Send"]
        W_VOI["Voice Worker<br/>Whisper transcription"]
        W_FLE["Fleet Worker<br/>Expiry checks"]
        W_STO["Inventory Worker<br/>Low stock alerts"]
        W_SYN["Sync Worker<br/>Conflict resolution"]
        W_ANA["Analytics Worker<br/>Daily aggregation"]
    end

    subgraph SCHEDULES["🕐 CRON SCHEDULES"]
        CRON_FLEET["fleet:check-expiry<br/>Daily 6:00 AM"]
        CRON_STOCK["inventory:check-stock<br/>Every 4 hours"]
        CRON_REMIND["notification:send-reminders<br/>Every 15 min"]
        CRON_ANALYTICS["analytics:aggregate-daily<br/>Daily 1:00 AM"]
        CRON_CLEANUP["system:cleanup-expired<br/>Daily 3:00 AM"]
    end

    %% Triggers to Queues
    TRIG_API --> Q_INVOICE
    TRIG_API --> Q_NOTIFY
    TRIG_WEBHOOK --> Q_WA
    TRIG_WEBHOOK --> Q_VOICE
    TRIG_CRON --> Q_FLEET
    TRIG_CRON --> Q_INV
    TRIG_CRON --> Q_ANALYTICS
    TRIG_EVENT --> Q_SYNC

    %% Queues to Workers
    Q_INVOICE --> W_INV
    Q_NOTIFY --> W_NOT
    Q_WA --> W_WA
    Q_VOICE --> W_VOI
    Q_FLEET --> W_FLE
    Q_INV --> W_STO
    Q_SYNC --> W_SYN
    Q_ANALYTICS --> W_ANA

    %% Cron scheduling
    CRON_FLEET --> Q_FLEET
    CRON_STOCK --> Q_INV
    CRON_REMIND --> Q_NOTIFY
    CRON_ANALYTICS --> Q_ANALYTICS
```

---

## 13. Capability & Tier Matrix

```mermaid
flowchart TB
    subgraph TIERS["💎 SUBSCRIPTION TIERS"]
        T_FREE["FREE<br/>$0/mo"]
        T_BASICO["BASICO<br/>~$12/mo"]
        T_PROF["PROFESIONAL<br/>~$18/mo"]
        T_EMP["EMPRESARIAL<br/>~$25/mo"]
        T_ENT["ENTERPRISE<br/>Custom"]
    end

    subgraph CAPABILITIES["🔓 CAPABILITIES"]
        subgraph CORE["Core (All Tiers)"]
            C_JOBS["Jobs & Customers"]
            C_BASIC_INV["Basic Invoicing"]
            C_WA_BASIC["WhatsApp (receive)"]
        end

        subgraph BASICO_UP["BASICO+"]
            C_CAL["Calendar View"]
            C_AFIP["AFIP Integration"]
            C_MP["Mercado Pago"]
            C_WA_FULL["WhatsApp (AI)"]
        end

        subgraph PROF_UP["PROFESIONAL+"]
            C_MAP["Live Tracking Map"]
            C_NEAREST["Nearest Technician"]
            C_FLEET["Fleet Management"]
            C_STOCK["Inventory Management"]
            C_VOICE["Voice Transcription"]
            C_MULTI_USER["Multi-User (5)"]
        end

        subgraph EMP_UP["EMPRESARIAL+"]
            C_MULTI_LOC["Multi-Location"]
            C_ADV_ANALYTICS["Advanced Analytics"]
            C_API["Public API Access"]
            C_WEBHOOKS["Webhooks"]
            C_MULTI_USER_20["Multi-User (20)"]
        end

        subgraph ENT_UP["ENTERPRISE"]
            C_WHITE["White Label"]
            C_SLA["SLA Guarantee"]
            C_DEDICATED["Dedicated Support"]
            C_CUSTOM["Custom Integrations"]
            C_UNLIMITED["Unlimited Users"]
        end
    end

    %% Tier access
    T_FREE --> C_JOBS
    T_FREE --> C_BASIC_INV
    T_FREE --> C_WA_BASIC

    T_BASICO --> CORE
    T_BASICO --> C_CAL
    T_BASICO --> C_AFIP
    T_BASICO --> C_MP
    T_BASICO --> C_WA_FULL

    T_PROF --> CORE
    T_PROF --> BASICO_UP
    T_PROF --> C_MAP
    T_PROF --> C_NEAREST
    T_PROF --> C_FLEET
    T_PROF --> C_STOCK
    T_PROF --> C_VOICE
    T_PROF --> C_MULTI_USER

    T_EMP --> CORE
    T_EMP --> BASICO_UP
    T_EMP --> PROF_UP
    T_EMP --> C_MULTI_LOC
    T_EMP --> C_ADV_ANALYTICS
    T_EMP --> C_API
    T_EMP --> C_WEBHOOKS
    T_EMP --> C_MULTI_USER_20

    T_ENT --> CORE
    T_ENT --> BASICO_UP
    T_ENT --> PROF_UP
    T_ENT --> EMP_UP
    T_ENT --> C_WHITE
    T_ENT --> C_SLA
    T_ENT --> C_DEDICATED
    T_ENT --> C_CUSTOM
    T_ENT --> C_UNLIMITED
```

---

## 14. Security & Authentication Flow

```mermaid
flowchart TB
    subgraph AUTH_METHODS["🔐 AUTHENTICATION METHODS"]
        AUTH_OTP["Phone + OTP<br/>(Primary)"]
        AUTH_SESSION["JWT Session<br/>(Web/Mobile)"]
        AUTH_API["API Key<br/>(External)"]
        AUTH_WH["Webhook Signature<br/>(Meta, MP)"]
    end

    subgraph FLOWS["🔄 AUTH FLOWS"]
        subgraph OWNER_AUTH["Business Owner"]
            O1["Enter Phone"]
            O2["Receive OTP<br/>(WhatsApp/SMS)"]
            O3["Verify OTP"]
            O4["Create/Load Org"]
            O5["Issue JWT"]
        end

        subgraph TECH_AUTH["Technician"]
            T1["Receive Invite<br/>(Link + Token)"]
            T2["Verify Phone"]
            T3["Complete Onboarding"]
            T4["Issue JWT"]
        end

        subgraph CONSUMER_AUTH["Consumer"]
            C1["Enter Phone"]
            C2["Receive OTP"]
            C3["Create Profile"]
            C4["Issue JWT"]
        end

        subgraph API_AUTH["API Client"]
            A1["Send API Key<br/>(Header)"]
            A2["Hash & Lookup"]
            A3["Check Permissions"]
            A4["Rate Limit"]
        end
    end

    subgraph MIDDLEWARE["🛡️ MIDDLEWARE"]
        MW_VERIFY["Verify JWT"]
        MW_ORG["Load Organization"]
        MW_ROLE["Check Role"]
        MW_CAP["Check Capability"]
        MW_RATE["Rate Limit"]
    end

    subgraph RLS["🔒 ROW LEVEL SECURITY"]
        RLS_ORG["Filter by<br/>organization_id"]
        RLS_USER["Filter by<br/>user_id"]
        RLS_ROLE["Filter by<br/>user role"]
    end

    %% Owner flow
    O1 --> O2 --> O3 --> O4 --> O5

    %% Tech flow
    T1 --> T2 --> T3 --> T4

    %% Consumer flow
    C1 --> C2 --> C3 --> C4

    %% API flow
    A1 --> A2 --> A3 --> A4

    %% Middleware chain
    O5 --> MW_VERIFY
    T4 --> MW_VERIFY
    C4 --> MW_VERIFY
    A4 --> MW_ORG

    MW_VERIFY --> MW_ORG
    MW_ORG --> MW_ROLE
    MW_ROLE --> MW_CAP
    MW_CAP --> MW_RATE

    %% RLS
    MW_RATE --> RLS_ORG
    RLS_ORG --> RLS_USER
    RLS_USER --> RLS_ROLE
```

---

## Summary: Complete System Web

| Layer | Components | Count |
|-------|------------|-------|
| **User Types** | Owner, Admin, Dispatcher, Technician, Consumer, Customer | 6 |
| **Interfaces** | Web Dashboard, Mobile App, Customer Portal, Marketplace, WhatsApp | 5 |
| **API Routes** | Auth, Jobs, Tracking, Invoices, Payments, Fleet, Inventory, WhatsApp, Marketplace, Dashboard | 10+ groups |
| **Database Tables** | Core + Fleet + Inventory + Marketplace + Notifications | 55+ |
| **External APIs** | AFIP (3), Mercado Pago (3), Google (5), Meta (3), OpenAI (2), Expo (1) | 17 |
| **Queue Workers** | Invoice, Notification, WhatsApp, Voice, Fleet, Inventory, Sync, Analytics | 8 |
| **WebSocket Events** | Location, Job Status, Payment, Message, Alert | 5 |
| **Subscription Tiers** | Free, Basico, Profesional, Empresarial, Enterprise | 5 |

---

*This document provides the complete architectural map of CampoTech. Each diagram can be rendered using any Mermaid-compatible viewer.*
