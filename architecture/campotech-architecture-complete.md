# CampoTech: Unified Architecture Specification
## Version 1.0 | Production-Ready | 18-Week MVP

---

# TABLE OF CONTENTS

1. Overview & System Goals
2. Core Principles & Non-Functional Requirements
3. System Architecture (High Level)
4. Domain Model & System of Record
5. Database Schema
6. State Machines
7. API Architecture
8. External Integrations
9. Queue + Worker Architecture
10. Security Architecture
11. Offline Mode Architecture
12. Mobile Technician App Architecture
13. Admin/Owner Portal Architecture
14. 12 Core Workflows
15. Fallback Systems
16. Monitoring & Observability
17. Deployment Architecture
18. Implementation Snippets
19. Glossary

---

# 1. OVERVIEW & SYSTEM GOALS

## Product Definition
- **Name:** CampoTech
- **Type:** Field Service Management (FSM) platform
- **Target Market:** Argentine tradespeople (plumbers, electricians, HVAC, gas)
- **Addressable Market:** 165K+ PyMEs in Buenos Aires metro area

## Primary Goals
- Enable job creation from WhatsApp voice messages
- Generate AFIP-compliant electronic invoices (Factura Electrónica)
- Process payments via Mercado Pago with cuotas (installments)
- Provide mobile app for technicians with offline support
- Achieve < 2 minute signup-to-first-job time

## Competitive Moat
- WhatsApp-native job creation (no competitors offer this)
- Full AFIP integration (foreign tools cannot compete)
- Mercado Pago cuotas with TEA/CFT compliance
- Voice AI for Argentine Spanish (lunfardo, accents)
- Offline-first mobile for poor connectivity areas

## Success Metrics

| Metric | Launch Target | Month 3 Target |
|--------|---------------|----------------|
| Signup to first job | < 2 minutes | < 90 seconds |
| Voice AI accuracy | ≥ 70% | > 80% |
| Cold start (Samsung A10) | < 4 seconds | < 3 seconds |
| Duplicate invoices | 0 | 0 |
| Monthly churn | - | < 10% |

---

# 2. CORE PRINCIPLES & NON-FUNCTIONAL REQUIREMENTS

## Design Principles

### Principle 1: One-Shot Culture
- First task completion < 2 minutes
- Zero visible errors in first session
- All failures handled invisibly with fallbacks

### Principle 2: Aggressive Minimal Onboarding
- **Maximum 2 required fields:** CUIT + Company Name
- Everything else deferred to first use (just-in-time)
- No blocking wizards, ever

### Principle 3: Reliability Over Sophistication
- Every external API has a fallback
- Every background job is monitored
- Panic modes auto-activate on failure
- Silent failures are bugs

### Principle 4: Simple by Default
- Simple mode is default (never ask)
- Advanced features hidden until requested
- Maximum 3 choices per screen

## Non-Functional Requirements

### Performance
- API response time: < 200ms (p95)
- Mobile cold start: < 4s on Samsung A10
- Memory usage: < 150MB on 2GB RAM devices
- Offline sync: Queue up to 50 operations

### Reliability
- System uptime: 99.5%
- Zero duplicate invoices (enforced at DB level)
- Automatic retry with exponential backoff
- Graceful degradation on external service failure

### Security
- Encryption at rest: AES-256-GCM
- Encryption in transit: TLS 1.3
- AFIP certificates encrypted with key rotation
- 10-year invoice retention (AFIP compliance)

### Scalability
- Support 10K concurrent users at launch
- Horizontal scaling for queue workers
- Database read replicas for reporting

---

# 3. SYSTEM ARCHITECTURE (HIGH LEVEL)

## Module Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CAMPOTECH PLATFORM                             │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐            │
│  │  MODULE 1 │  │  MODULE 2 │  │  MODULE 3 │  │  MODULE 4 │            │
│  │   AUTH &  │  │    CRM    │  │   JOBS &  │  │   AFIP    │            │
│  │ ONBOARDING│  │ CUSTOMERS │  │ SCHEDULING│  │ INVOICING │            │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘            │
│        │              │              │              │                   │
│  ┌─────┴──────────────┴──────────────┴──────────────┴─────┐            │
│  │                  SHARED SERVICES LAYER                  │            │
│  │    (Event Bus, Queue, Storage, Notifications, Cache)   │            │
│  └─────┬──────────────┬──────────────┬──────────────┬─────┘            │
│        │              │              │              │                   │
│  ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐            │
│  │  MODULE 5 │  │  MODULE 6 │  │  MODULE 7 │  │  MODULE 8 │            │
│  │  MERCADO  │  │ WHATSAPP  │  │  VOICE AI │  │  MOBILE   │            │
│  │   PAGO    │  │   COMMS   │  │ PROCESSING│  │TECHNICIAN │            │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘            │
├─────────────────────────────────────────────────────────────────────────┤
│                       INFRASTRUCTURE LAYER                               │
│  • Panic Mode Controller    • Idempotency Service    • Encryption       │
│  • Queue System (BullMQ)    • Distributed Locks      • Rate Limiting    │
│  • Event Bus                • Observability          • Feature Flags    │
├─────────────────────────────────────────────────────────────────────────┤
│                        GOVERNANCE LAYER                                  │
│  • Event Ownership Matrix   • User Roles & Permissions  • Audit Logs    │
│  • Data Retention          • Document Versioning        • Abuse Prevention│
└─────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend Web | Next.js 14, React, TypeScript, TailwindCSS |
| Mobile | React Native, Expo, WatermelonDB |
| Backend | Node.js, TypeScript, Express/Fastify |
| Database | Supabase (PostgreSQL), Redis |
| Queue | BullMQ (Redis-backed) |
| Storage | Supabase Storage, S3 (archival) |
| External APIs | AFIP (SOAP), Mercado Pago, WhatsApp Cloud API, OpenAI |
| Monitoring | Sentry, Prometheus, Grafana |
| Deployment | Vercel (web), Railway/Render (workers), EAS (mobile) |

---

# 4. DOMAIN MODEL & SYSTEM OF RECORD

## Event Ownership Matrix

| Domain | System of Record | Event Authority | Conflict Rule |
|--------|------------------|-----------------|---------------|
| **Organizations** | `organizations` table | AuthService | Server wins |
| **Users** | `users` table | UserService | Server wins |
| **Customers** | `customers` table | CustomerService | Server wins, merge on sync |
| **Jobs** | `jobs` table | JobService | Mobile completion wins (unless cancelled) |
| **Invoices** | `invoices` table | InvoiceService | AFIP authoritative for CAE |
| **Payments** | `payments` table | PaymentService | MP webhook authoritative |
| **Messages** | `whatsapp_messages` | MessageService | WA delivery status authoritative |

## Conflict Resolution Rules

```
Job Conflicts:
├── Mobile status='completed' + Server status!='cancelled' → Mobile wins
├── Server status='cancelled' → Server wins (always)
├── Both have edits to notes/photos → Merge (append)
└── Timestamp conflict → Server timestamp wins

Invoice Conflicts:
├── CAE received from AFIP → AFIP data is authoritative
├── Draft with no CAE → Server version wins
└── Payment status → MP webhook is authoritative

Customer Conflicts:
├── Same phone number → Merge non-null fields
├── Different addresses → Keep server address, log conflict
└── New customer from offline → Create if no phone match
```

## Domain Events

```typescript
type DomainEvent =
  // Jobs
  | { type: 'job.created'; payload: Job }
  | { type: 'job.status_changed'; payload: { job: Job; from: string; to: string } }
  | { type: 'job.assigned'; payload: { job: Job; technician: User } }
  | { type: 'job.completed'; payload: { job: Job; invoice?: Invoice } }
  | { type: 'job.cancelled'; payload: Job }
  // Invoices
  | { type: 'invoice.created'; payload: Invoice }
  | { type: 'invoice.cae_received'; payload: { invoice: Invoice; cae: string } }
  | { type: 'invoice.cae_failed'; payload: { invoice: Invoice; error: string } }
  | { type: 'invoice.sent'; payload: Invoice }
  | { type: 'invoice.paid'; payload: Invoice }
  // Payments
  | { type: 'payment.created'; payload: Payment }
  | { type: 'payment.approved'; payload: Payment }
  | { type: 'payment.rejected'; payload: Payment }
  | { type: 'payment.refunded'; payload: Payment }
  | { type: 'payment.chargedback'; payload: Payment }
  // Messages
  | { type: 'message.received'; payload: WhatsAppMessage }
  | { type: 'message.sent'; payload: WhatsAppMessage }
  | { type: 'message.delivered'; payload: WhatsAppMessage }
  | { type: 'message.failed'; payload: WhatsAppMessage }
  // Voice
  | { type: 'voice.received'; payload: VoiceMessage }
  | { type: 'voice.transcribed'; payload: Transcription }
  | { type: 'voice.extracted'; payload: Extraction }
  | { type: 'voice.job_created'; payload: Job };
```

---

# 5. DATABASE SCHEMA

## Organizations Table
```sql
organizations (
  id: UUID PRIMARY KEY
  name: TEXT NOT NULL
  cuit: TEXT UNIQUE NOT NULL
  iva_condition: TEXT NOT NULL -- 'responsable_inscripto' | 'monotributista' | 'exento'
  -- AFIP (encrypted)
  afip_punto_venta: INTEGER
  afip_cert: JSONB -- EncryptedData
  afip_key: JSONB -- EncryptedData
  afip_cert_expiry: DATE
  afip_homologated: BOOLEAN DEFAULT false
  -- Mercado Pago (encrypted)
  mp_access_token: JSONB -- EncryptedData
  mp_refresh_token: JSONB -- EncryptedData
  mp_user_id: TEXT
  mp_connected_at: TIMESTAMPTZ
  -- WhatsApp
  whatsapp_phone_id: TEXT
  whatsapp_business_id: TEXT
  whatsapp_verified: BOOLEAN DEFAULT false
  -- Settings
  settings: JSONB DEFAULT '{
    "ui_mode": "simple",
    "auto_invoice_on_complete": true,
    "auto_send_whatsapp": true,
    "voice_auto_create_threshold": 0.7
  }'
  -- Timestamps
  created_at: TIMESTAMPTZ DEFAULT NOW()
  updated_at: TIMESTAMPTZ DEFAULT NOW()
)
```

## Users Table
```sql
users (
  id: UUID PRIMARY KEY REFERENCES auth.users(id)
  org_id: UUID REFERENCES organizations(id) NOT NULL
  role: TEXT NOT NULL DEFAULT 'technician' -- 'owner' | 'admin' | 'dispatcher' | 'technician' | 'accountant'
  full_name: TEXT NOT NULL
  phone: TEXT
  email: TEXT
  avatar_url: TEXT
  is_active: BOOLEAN DEFAULT true
  push_token: TEXT
  last_seen_at: TIMESTAMPTZ
  created_at: TIMESTAMPTZ DEFAULT NOW()
)
```

## Customers Table
```sql
customers (
  id: UUID PRIMARY KEY
  org_id: UUID REFERENCES organizations(id) NOT NULL
  -- Identity
  name: TEXT NOT NULL
  phone: TEXT NOT NULL
  email: TEXT
  -- Argentina documents (for AFIP)
  doc_type: TEXT DEFAULT 'dni' -- 'dni' | 'cuit' | 'cuil'
  doc_number: TEXT
  iva_condition: TEXT DEFAULT 'consumidor_final'
  -- Address
  address: TEXT
  address_extra: TEXT -- piso, depto
  neighborhood: TEXT -- Barrio (Palermo, Belgrano, etc.)
  city: TEXT DEFAULT 'Buenos Aires'
  province: TEXT DEFAULT 'CABA'
  postal_code: TEXT
  lat: DECIMAL(10, 8)
  lng: DECIMAL(11, 8)
  -- WhatsApp
  whatsapp_thread_id: TEXT
  last_message_at: TIMESTAMPTZ
  -- Meta
  notes: TEXT
  tags: TEXT[]
  source: TEXT -- 'manual' | 'whatsapp' | 'voice'
  -- Timestamps
  created_at: TIMESTAMPTZ DEFAULT NOW()
  updated_at: TIMESTAMPTZ DEFAULT NOW()
  
  UNIQUE(org_id, phone)
)
```

## Jobs Table
```sql
jobs (
  id: UUID PRIMARY KEY
  org_id: UUID REFERENCES organizations(id) NOT NULL
  customer_id: UUID REFERENCES customers(id)
  assigned_to: UUID REFERENCES users(id)
  -- Job info
  title: TEXT NOT NULL
  description: TEXT
  job_type: TEXT -- 'plomeria' | 'electricidad' | 'aire_acondicionado' | 'gas' | 'general'
  priority: TEXT DEFAULT 'normal' -- 'low' | 'normal' | 'high' | 'urgent'
  -- Status
  status: TEXT DEFAULT 'pending'
  status_changed_at: TIMESTAMPTZ DEFAULT NOW()
  -- Scheduling
  scheduled_date: DATE
  scheduled_time_start: TIME
  scheduled_time_end: TIME
  estimated_duration: INTEGER -- minutes
  -- Actual times
  actual_start: TIMESTAMPTZ
  actual_end: TIMESTAMPTZ
  -- Location
  address: TEXT
  address_extra: TEXT
  lat: DECIMAL(10, 8)
  lng: DECIMAL(11, 8)
  -- Completion
  photos: TEXT[] -- URLs
  notes: TEXT
  internal_notes: TEXT
  signature_url: TEXT
  -- Billing
  invoice_id: UUID REFERENCES invoices(id)
  -- Source tracking
  source: TEXT DEFAULT 'manual' -- 'manual' | 'whatsapp' | 'voice'
  source_message_id: TEXT
  -- Offline support
  local_id: TEXT -- Mobile-generated ID for offline
  sync_status: TEXT DEFAULT 'synced' -- 'synced' | 'pending' | 'conflict'
  -- Timestamps
  created_at: TIMESTAMPTZ DEFAULT NOW()
  updated_at: TIMESTAMPTZ DEFAULT NOW()
)

INDEXES:
  idx_jobs_org_status ON jobs(org_id, status)
  idx_jobs_org_date ON jobs(org_id, scheduled_date)
  idx_jobs_assigned ON jobs(assigned_to, scheduled_date)
  idx_jobs_customer ON jobs(customer_id)
```

## Invoices Table
```sql
invoices (
  id: UUID PRIMARY KEY
  org_id: UUID REFERENCES organizations(id) NOT NULL
  customer_id: UUID REFERENCES customers(id) NOT NULL
  job_id: UUID REFERENCES jobs(id)
  -- AFIP identification
  invoice_number: INTEGER
  invoice_type: TEXT NOT NULL -- 'A' | 'B' | 'C'
  punto_venta: INTEGER NOT NULL
  -- AFIP authorization
  cae: TEXT
  cae_expiry: DATE
  qr_data: TEXT
  -- Amounts
  subtotal: DECIMAL(12, 2) NOT NULL
  tax_amount: DECIMAL(12, 2) NOT NULL
  total: DECIMAL(12, 2) NOT NULL
  currency: TEXT DEFAULT 'ARS'
  -- Line items
  line_items: JSONB NOT NULL DEFAULT '[]'
  -- Status
  status: TEXT DEFAULT 'draft' -- 'draft' | 'pending_cae' | 'issued' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'refunded'
  afip_error: TEXT
  afip_attempts: INTEGER DEFAULT 0
  last_afip_attempt: TIMESTAMPTZ
  -- PDF
  pdf_url: TEXT
  pdf_hash: TEXT -- SHA-256 for immutability
  -- Idempotency
  idempotency_key: TEXT UNIQUE
  -- Timestamps
  issued_at: TIMESTAMPTZ
  due_date: DATE
  paid_at: TIMESTAMPTZ
  created_at: TIMESTAMPTZ DEFAULT NOW()
  updated_at: TIMESTAMPTZ DEFAULT NOW()
  
  UNIQUE(org_id, punto_venta, invoice_number) -- Prevents duplicates
)
```

## Payments Table
```sql
payments (
  id: UUID PRIMARY KEY
  org_id: UUID REFERENCES organizations(id) NOT NULL
  invoice_id: UUID REFERENCES invoices(id) NOT NULL
  -- Mercado Pago
  mp_payment_id: TEXT UNIQUE
  mp_preference_id: TEXT
  mp_external_reference: TEXT
  -- Amounts
  amount: DECIMAL(12, 2) NOT NULL
  refunded_amount: DECIMAL(12, 2) DEFAULT 0
  currency: TEXT DEFAULT 'ARS'
  -- Cuotas
  installments: INTEGER DEFAULT 1
  installment_amount: DECIMAL(12, 2)
  -- Status
  status: TEXT DEFAULT 'pending' -- 'pending' | 'processing' | 'approved' | 'rejected' | 'refunded' | 'in_dispute' | 'chargedback'
  status_detail: TEXT
  -- Payment method
  payment_method: TEXT -- 'credit_card' | 'debit_card' | 'account_money' | 'cash' | 'transfer'
  payment_type: TEXT
  -- Dispute handling
  dispute_id: TEXT
  dispute_status: TEXT
  dispute_deadline: DATE
  -- Idempotency
  webhook_idempotency_key: TEXT UNIQUE
  -- Timestamps
  approved_at: TIMESTAMPTZ
  created_at: TIMESTAMPTZ DEFAULT NOW()
  updated_at: TIMESTAMPTZ DEFAULT NOW()
)
```

## WhatsApp Messages Table
```sql
whatsapp_messages (
  id: UUID PRIMARY KEY
  org_id: UUID REFERENCES organizations(id) NOT NULL
  customer_id: UUID REFERENCES customers(id)
  job_id: UUID REFERENCES jobs(id)
  -- WhatsApp IDs
  wa_message_id: TEXT UNIQUE
  wa_conversation_id: TEXT
  -- Content
  direction: TEXT NOT NULL -- 'inbound' | 'outbound'
  message_type: TEXT NOT NULL -- 'text' | 'voice' | 'image' | 'template'
  content: TEXT
  media_url: TEXT
  template_name: TEXT
  -- Voice processing
  voice_duration: INTEGER -- seconds
  transcription: TEXT
  extraction_data: JSONB
  extraction_confidence: DECIMAL(3, 2)
  -- Status
  status: TEXT DEFAULT 'pending' -- 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'fallback_sms'
  error_code: TEXT
  -- Idempotency
  idempotency_key: TEXT UNIQUE
  -- Timestamps
  wa_timestamp: TIMESTAMPTZ
  created_at: TIMESTAMPTZ DEFAULT NOW()
)
```

## Price Book Table
```sql
price_book (
  id: UUID PRIMARY KEY
  org_id: UUID REFERENCES organizations(id) NOT NULL
  name: TEXT NOT NULL
  description: TEXT
  category: TEXT NOT NULL -- 'mano_de_obra' | 'materiales' | 'consumibles' | 'viatico'
  service_type: TEXT -- 'plomeria' | 'electricidad' | 'aire' | 'gas'
  -- Pricing
  base_price: DECIMAL(12, 2) NOT NULL
  tax_rate: DECIMAL(5, 2) DEFAULT 21.00
  includes_tax: BOOLEAN DEFAULT false
  -- Regional pricing
  region_prices: JSONB DEFAULT '{}' -- {"CABA": 15000, "GBA": 12000}
  complexity_multipliers: JSONB DEFAULT '{}' -- {"simple": 0.8, "normal": 1.0, "complex": 1.5}
  -- AFIP
  afip_product_code: TEXT
  afip_unit_code: TEXT DEFAULT '7' -- unidad
  -- Meta
  is_active: BOOLEAN DEFAULT true
  sort_order: INTEGER DEFAULT 0
  created_at: TIMESTAMPTZ DEFAULT NOW()
)
```

## Audit Logs Table
```sql
audit_logs (
  id: UUID PRIMARY KEY
  org_id: UUID REFERENCES organizations(id)
  user_id: UUID REFERENCES users(id)
  -- Event
  action: TEXT NOT NULL -- see audit actions list
  entity_type: TEXT NOT NULL
  entity_id: UUID
  -- Data
  old_data: JSONB
  new_data: JSONB
  metadata: JSONB
  -- Integrity chain
  previous_hash: TEXT
  entry_hash: TEXT NOT NULL
  -- Timestamp
  created_at: TIMESTAMPTZ DEFAULT NOW()
  
  INDEX idx_audit_entity ON audit_logs(entity_type, entity_id)
  INDEX idx_audit_org_time ON audit_logs(org_id, created_at DESC)
)
```

---

# 6. STATE MACHINES

## Job State Machine

```
States: pending | scheduled | en_camino | working | completed | cancelled

Transitions:
  pending    → scheduled   : assign_schedule(technician, date, time)
  pending    → cancelled   : cancel(reason)
  scheduled  → en_camino   : start_travel()
  scheduled  → cancelled   : cancel(reason)
  en_camino  → working     : arrive()
  en_camino  → cancelled   : cancel(reason)
  working    → completed   : complete(photos, signature, notes)
  working    → cancelled   : cancel(reason)
  completed  → (terminal)
  cancelled  → (terminal)

Side Effects:
  → scheduled : Send WhatsApp confirmation to customer
  → en_camino : Send "técnico en camino" notification
  → completed : Create invoice (if auto_invoice enabled), send completion notification
  → cancelled : Send cancellation notification
```

## Invoice State Machine

```
States: draft | pending_cae | issued | sent | paid | overdue | cancelled | refunded

Transitions:
  draft       → pending_cae : request_cae()
  draft       → cancelled   : cancel()
  pending_cae → issued      : cae_received(cae, cae_expiry)
  pending_cae → draft       : cae_failed(error) [after max retries]
  issued      → sent        : send_to_customer()
  issued      → paid        : payment_received()
  issued      → overdue     : due_date_passed()
  issued      → cancelled   : cancel() [only if no payments]
  sent        → paid        : payment_received()
  sent        → overdue     : due_date_passed()
  overdue     → paid        : payment_received()
  paid        → refunded    : refund_processed()
  cancelled   → (terminal)
  refunded    → (terminal)

Side Effects:
  → pending_cae : Queue AFIP CAE request
  → issued      : Generate PDF, store immutably
  → sent        : Send WhatsApp with PDF + payment link
  → paid        : Update payment record, send receipt
  → overdue     : Send reminder notification
```

## Payment State Machine

```
States: pending | processing | approved | rejected | refunded | in_dispute | chargedback

Transitions:
  pending     → processing   : payment_initiated()
  pending     → approved     : mp_webhook(status=approved)
  pending     → rejected     : mp_webhook(status=rejected)
  pending     → cancelled    : cancelled_by_user()
  processing  → approved     : mp_webhook(status=approved)
  processing  → rejected     : mp_webhook(status=rejected)
  approved    → refunded     : refund_requested(amount)
  approved    → in_dispute   : mp_webhook(type=chargeback)
  in_dispute  → approved     : dispute_won()
  in_dispute  → chargedback  : dispute_lost()
  chargedback → (terminal)
  refunded    → (terminal)

Side Effects:
  → approved    : Update invoice to paid, send receipt, audit log
  → rejected    : Notify business, log reason
  → in_dispute  : Notify business urgently, create dispute record
  → chargedback : Update invoice status, notify business
```

## WhatsApp Message State Machine

```
States: queued | sent | delivered | read | failed | fallback_sms | undeliverable

Transitions:
  queued        → sent          : wa_api_accepted()
  queued        → failed        : wa_api_error()
  sent          → delivered     : wa_webhook(status=delivered)
  sent          → failed        : wa_webhook(status=failed)
  delivered     → read          : wa_webhook(status=read)
  failed        → queued        : retry() [if retries < max]
  failed        → fallback_sms  : send_sms() [critical messages only]
  failed        → undeliverable : max_retries_exceeded()
  fallback_sms  → (terminal)
  undeliverable → (terminal)

Side Effects:
  → failed       : Increment retry counter, log error
  → fallback_sms : Send via SMS provider, log fallback
```

## Background Task State Machine

```
States: pending | processing | completed | failed | dead_letter

Transitions:
  pending    → processing  : worker_picked_up()
  processing → completed   : task_succeeded()
  processing → pending     : task_failed() [if retries < max, exponential backoff]
  processing → failed      : task_failed() [if retries >= max]
  failed     → dead_letter : after_review_period()
  failed     → pending     : manual_retry()

Queue Types:
  - afip-invoices     : AFIP CAE requests (2 concurrency, 10/min rate limit)
  - whatsapp-outbound : WhatsApp messages (10 concurrency, 50/min rate limit)
  - photo-upload      : Photo uploads (5 concurrency)
  - voice-processing  : Voice AI (3 concurrency)
  - payment-sync      : Payment reconciliation (3 concurrency)
```

---

# 7. API ARCHITECTURE

## Endpoint Structure

### Auth Endpoints
```
POST   /api/auth/otp/send         → Send OTP to phone
POST   /api/auth/otp/verify       → Verify OTP, return session
POST   /api/auth/logout           → End session
GET    /api/auth/me               → Current user info
```

### Organization Endpoints
```
GET    /api/org                   → Get current org
PATCH  /api/org                   → Update org settings
POST   /api/org/afip/cert         → Upload AFIP certificate
GET    /api/org/afip/status       → AFIP connection status
POST   /api/org/mp/connect        → Start MP OAuth
GET    /api/org/mp/callback       → MP OAuth callback
POST   /api/org/whatsapp/verify   → Start WhatsApp verification
```

### Customer Endpoints
```
GET    /api/customers             → List customers (paginated)
GET    /api/customers/:id         → Get customer
POST   /api/customers             → Create customer
PATCH  /api/customers/:id         → Update customer
DELETE /api/customers/:id         → Soft delete customer
GET    /api/customers/search      → Search by name/phone/CUIT
POST   /api/customers/validate-cuit → Validate CUIT + fetch AFIP data
```

### Job Endpoints
```
GET    /api/jobs                  → List jobs (filters: status, date, technician)
GET    /api/jobs/:id              → Get job detail
POST   /api/jobs                  → Create job
PATCH  /api/jobs/:id              → Update job
DELETE /api/jobs/:id              → Cancel job
POST   /api/jobs/:id/status       → Update status
POST   /api/jobs/:id/assign       → Assign technician
POST   /api/jobs/:id/complete     → Complete job (photos, signature)
GET    /api/jobs/calendar         → Jobs for date range
GET    /api/jobs/today            → Today's jobs for current user
```

### Invoice Endpoints
```
GET    /api/invoices              → List invoices
GET    /api/invoices/:id          → Get invoice detail
POST   /api/invoices              → Create invoice (draft or request CAE)
POST   /api/invoices/:id/cae      → Request CAE for draft
POST   /api/invoices/:id/send     → Send to customer
GET    /api/invoices/:id/pdf      → Download PDF
POST   /api/invoices/:id/cancel   → Cancel invoice
GET    /api/invoices/queue        → AFIP queue status
```

### Payment Endpoints
```
GET    /api/payments              → List payments
GET    /api/payments/:id          → Get payment detail
POST   /api/payments/preference   → Create MP payment preference
GET    /api/payments/:id/link     → Get payment link
POST   /api/payments/:id/refund   → Request refund
POST   /api/payments/webhook      → MP webhook handler (idempotent)
GET    /api/payments/reconcile    → Pending reconciliation items
```

### WhatsApp Endpoints
```
GET    /api/whatsapp/conversations → List conversations
GET    /api/whatsapp/messages/:customerId → Messages for customer
POST   /api/whatsapp/send         → Send message
POST   /api/whatsapp/webhook      → WA webhook handler
GET    /api/whatsapp/templates    → Available templates
```

### Voice AI Endpoints
```
POST   /api/voice/process         → Process voice message
GET    /api/voice/queue           → Human review queue
POST   /api/voice/review/:id      → Submit human review
GET    /api/voice/stats           → Accuracy statistics
```

### Admin Endpoints
```
GET    /api/admin/health          → System health
GET    /api/admin/queues          → All queue statuses
GET    /api/admin/dlq             → Dead letter queue items
POST   /api/admin/dlq/:id/retry   → Retry DLQ item
GET    /api/admin/panic           → Panic mode status per service
POST   /api/admin/panic/:service  → Manual panic mode control
GET    /api/admin/metrics         → Operational metrics
```

## Input/Output Specs

### Standard Response Format
```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: { code: string, message: string, details?: any } }

// Paginated
{ success: true, data: T[], pagination: { page: number, limit: number, total: number, hasMore: boolean } }
```

### Error Codes
```
AUTH_001: Invalid OTP
AUTH_002: Session expired
AUTH_003: Insufficient permissions

CUSTOMER_001: Invalid CUIT format
CUSTOMER_002: Duplicate phone number
CUSTOMER_003: Customer not found

JOB_001: Invalid status transition
JOB_002: Job not found
JOB_003: Cannot modify completed job

INVOICE_001: AFIP unavailable (queued for retry)
INVOICE_002: Invalid invoice data
INVOICE_003: Duplicate invoice number
INVOICE_004: Cannot cancel paid invoice

PAYMENT_001: MP connection required
PAYMENT_002: Payment not found
PAYMENT_003: Refund exceeds payment amount

WHATSAPP_001: WhatsApp not configured
WHATSAPP_002: Template not approved
WHATSAPP_003: Rate limit exceeded

VOICE_001: Audio too short
VOICE_002: Audio processing failed
VOICE_003: Low confidence, needs review

RATE_001: Rate limit exceeded
SYSTEM_001: Internal error
```

## Idempotency Guarantees

| Endpoint | Idempotency Key | TTL |
|----------|-----------------|-----|
| POST /api/invoices | `X-Idempotency-Key` header | 24h |
| POST /api/invoices/:id/cae | `afip:cae:{org}:{invoice}` | 7d |
| POST /api/payments/preference | `mp:pref:{org}:{invoice}` | 24h |
| POST /api/payments/webhook | `mp:webhook:{webhook_id}` | 7d |
| POST /api/whatsapp/send | `wa:msg:{org}:{to}:{template}:{job}` | 1h |

---

# 8. EXTERNAL INTEGRATIONS

## AFIP Integration

### Services Used
- **WSAA:** Authentication service (token generation)
- **WSFEv1:** Electronic invoicing (CAE requests)
- **WS_SR_PADRON:** Taxpayer validation (CUIT lookup)

### Authentication Flow (WSAA)
```
1. Generate TRA (Ticket de Requerimiento de Acceso)
   - XML with service, generation time, expiration time
   - Sign with organization's private key (PKCS#7)
2. Call LoginCms SOAP endpoint
3. Receive TA (Ticket de Acceso)
   - Contains token + sign
   - Valid for 12-24 hours
4. Cache TA, refresh before expiry
```

### Invoice Flow (WSFEv1)
```
1. Get last invoice number: FECompUltimoAutorizado
2. Build invoice request: FECAESolicitar
   - CbteTipo: 1 (A), 6 (B), 11 (C)
   - DocTipo: 80 (CUIT), 96 (DNI), 99 (Final Consumer)
   - Concept: 1 (Products), 2 (Services), 3 (Both)
3. Handle response:
   - Result 'A': Success, extract CAE + expiry
   - Result 'R': Rejected, extract error codes
4. Generate QR code (RG 4291 format)
```

### Error Handling
```
Transient (retry):
  - Connection timeout
  - Service unavailable
  - Token expired (re-authenticate)

Permanent (fail):
  - Invalid CUIT
  - Invalid punto de venta
  - Invalid invoice type
  - Certificate expired
```

### Homologation vs Production
```
Homologation:
  - WSAA: https://wsaahomo.afip.gov.ar/ws/services/LoginCms
  - WSFE: https://wswhomo.afip.gov.ar/wsfev1/service.asmx

Production:
  - WSAA: https://wsaa.afip.gov.ar/ws/services/LoginCms
  - WSFE: https://servicios1.afip.gov.ar/wsfev1/service.asmx
```

## Mercado Pago Integration

### OAuth Flow
```
1. Redirect to MP authorization:
   https://auth.mercadopago.com/authorization?
     client_id={APP_ID}&
     response_type=code&
     redirect_uri={CALLBACK_URL}&
     platform_id=mp
2. User authorizes, MP redirects with code
3. Exchange code for tokens:
   POST https://api.mercadopago.com/oauth/token
4. Store access_token (encrypted), refresh_token
5. Refresh before expiry (~6 hours)
```

### Payment Preference
```
POST /checkout/preferences
{
  items: [{ title, quantity, unit_price }],
  payer: { email, phone },
  back_urls: { success, failure, pending },
  notification_url: webhook_url,
  external_reference: invoice_id,
  payment_methods: {
    installments: 12,
    default_installments: 1
  }
}
→ Returns: { id, init_point, sandbox_init_point }
```

### Webhook Events
```
payment.created    → Create pending payment record
payment.approved   → Mark invoice as paid
payment.rejected   → Log rejection reason
payment.refunded   → Update refund amount
chargeback.created → Create dispute, notify urgently
```

### Cuotas (TEA/CFT)
```
GET /v1/payment_methods/installments?amount={amount}&payment_method_id={pm_id}
→ Returns installment options with:
  - installments: number of payments
  - installment_amount: per-payment amount
  - total_amount: total with interest
  - labels: ["CFT: XX%"]
  
Calculate TEA: ((total/principal)^(12/months) - 1) * 100
```

## WhatsApp Cloud API Integration

### Setup
```
1. Create Meta Business account
2. Create WhatsApp Business App
3. Add phone number, verify
4. Submit message templates for approval
5. Configure webhook URL
```

### Message Templates (Pre-approved)
```
job_confirmation:
  "Hola {{1}}, tu servicio de {{2}} está agendado para {{3}}. Te avisamos cuando el técnico esté en camino."

tech_en_route:
  "{{1}}, tu técnico está en camino. Llegada estimada: {{2}} minutos."

job_completed:
  "{{1}}, tu servicio fue completado. Te enviamos la factura a continuación."

invoice_with_payment:
  "Factura #{{1}} por ${{2}}. Pagá con Mercado Pago: {{3}}"

payment_received:
  "{{1}}, recibimos tu pago de ${{2}}. ¡Gracias!"
```

### Webhook Events
```
messages       → New inbound message
statuses       → Delivery status updates (sent, delivered, read, failed)
```

### Rate Limits
```
Per phone number:
  - 1000 business-initiated conversations/day
  - Template messages: 50/second
  - 24-hour session window for free-form replies
```

### SMS Fallback
```
Trigger conditions:
  - WhatsApp delivery failed after 3 retries
  - Message is critical (payment confirmation, job completion)
  - Customer has no WhatsApp

Provider: Twilio or local (e.g., Vonage)
Rate: ~$0.05 per SMS to Argentina
```

---

# 9. QUEUE + WORKER ARCHITECTURE

## Queue Configuration

| Queue | Concurrency | Rate Limit | Max Size | Overflow | Retries | Backoff |
|-------|-------------|------------|----------|----------|---------|---------|
| afip-invoices | 2 | 10/min | 1000 | priority_only | 10 | exponential (1m base) |
| whatsapp-outbound | 10 | 50/min | 5000 | drop_oldest | 3 | exponential (30s base) |
| photo-upload | 5 | - | 10000 | reject | 5 | exponential (1m base) |
| voice-processing | 3 | - | 500 | reject | 3 | exponential (30s base) |
| payment-sync | 3 | - | 500 | reject | 5 | exponential (1m base) |

## Retry Logic

```typescript
retryStrategy = {
  maxAttempts: config.retries,
  backoff: {
    type: 'exponential',
    delay: config.baseDelay,
    maxDelay: 300000 // 5 minutes max
  },
  retryOn: (error) => isTransientError(error)
}

isTransientError(error):
  - Connection timeout
  - Service unavailable (5xx)
  - Rate limited (429)
  - NOT: validation errors, auth errors, permanent failures
```

## Dead Letter Queue (DLQ)

```
DLQ Entry:
  - Original job data
  - Error message + stack
  - Attempt count
  - Timestamps (created, last_attempt)
  - Queue name

DLQ Handling:
  1. Alert if DLQ size > 10 items
  2. Alert if item age > 1 hour
  3. Manual review required
  4. Options: retry, discard, fix data + retry
```

## Backpressure Strategies

```typescript
overflowStrategies = {
  reject: () => {
    // Return error, alert
    throw new QueueOverflowError();
  },
  drop_oldest: () => {
    // Remove oldest low-priority items
    await queue.clean(10, 'delayed', { priority: 'low' });
  },
  priority_only: (job) => {
    // Only accept priority >= 8
    if (job.priority < 8) throw new LowPriorityRejectedError();
  }
}
```

## Priority Processing

```
Priority levels: 1 (low) to 10 (high)

Processing ratio: [1, 2, 4]
  - Process 4 high-priority jobs
  - Then 2 medium-priority jobs
  - Then 1 low-priority job

Default priorities:
  - AFIP retry after failure: 8
  - New invoice: 5
  - WhatsApp notification: 5
  - Photo upload: 3
```

## Worker Scaling

```
Scaling rules:
  - Queue depth > 100: scale up workers
  - Queue depth < 10 for 5min: scale down
  - Error rate > 10%: pause scaling, alert
  - Min workers: 1 per queue
  - Max workers: 5 per queue
```
# CampoTech: Unified Architecture Specification (Part 2)
## Sections 10-19

---

# 10. SECURITY ARCHITECTURE

## Encryption Strategy

| Data Type | At Rest | In Transit | Key Rotation |
|-----------|---------|------------|--------------|
| AFIP Certificates | AES-256-GCM | TLS 1.3 | Manual (2yr cert life) |
| MP Access Tokens | AES-256-GCM | TLS 1.3 | On refresh (~6h) |
| Customer PII (CUIT, phone) | AES-256-GCM | TLS 1.3 | Yearly |
| Passwords | bcrypt (cost 12) | TLS 1.3 | N/A |
| Session Tokens | Short-lived JWT | TLS 1.3 | Per session |
| Invoices (PDF) | Storage encryption | TLS 1.3 | Yearly |
| Audit Logs | Storage encryption | TLS 1.3 | Immutable |

## Key Management

```
Key hierarchy:
  Master Key (AWS KMS)
    └── afip_credentials_key
    └── mp_tokens_key
    └── customer_pii_key
    └── general_encryption_key

Key versioning:
  - Each key has version ID
  - Old versions kept for decryption
  - Re-encryption scheduled during rotation
```

## Encrypted Data Format

```typescript
EncryptedData = {
  ciphertext: string   // Base64-encoded encrypted data
  iv: string           // Base64-encoded initialization vector
  authTag: string      // Base64-encoded GCM auth tag
  keyId: string        // Key version used
  algorithm: 'aes-256-gcm'
}
```

## Log Redaction

```
Sensitive patterns (auto-redacted):
  - CUIT: /\b\d{2}-\d{8}-\d{1}\b/g → 'CUIT:[REDACTED]'
  - Phone: /\b\d{10,11}\b/g → 'PHONE:[REDACTED]'
  - CBU: /\b\d{22}\b/g → 'CBU:[REDACTED]'
  - Bearer tokens: /Bearer\s+[A-Za-z0-9\-_]+/gi → 'Bearer [REDACTED]'
  - API keys: /api[_-]?key[=:]\s*["']?[A-Za-z0-9\-_]+/gi → 'api_key:[REDACTED]'

Always-redact fields:
  - password, secret, token, api_key, certificate
  - cuit, cuil, dni, cbu, card_number
```

## Abuse Detection

```
Abuse patterns checked:
  1. message_flood: >20 messages/minute from sender → rate_limit
  2. spam_content: spam score >0.8 → flag_for_review
  3. url_spam: >2 URLs in message → block
  4. new_number_flood: new sender + 5 msgs in 5min → block
  5. duplicate_messages: >3 identical messages → rate_limit
  6. off_hours_flood: 2-6am + high volume → flag_for_review
  7. known_bad_actor: on blacklist → block

Actions:
  - allow: normal processing
  - rate_limit: reduce to 5/5min
  - flag_for_review: add to review queue
  - block: add to temporary blacklist (24h)
```

## Rate Limiting

```
Per-organization limits:
  - API requests: 100/min
  - WhatsApp messages: 50/min
  - Voice messages: 50/hour
  - Job creations: 200/day

Per-sender limits (within org):
  - Messages: 10/min
  - Voice: 5/hour

Implementation: Sliding window (Redis sorted sets)
```

## Session Management

```
Session configuration:
  - Type: JWT (short-lived) + refresh token
  - Access token TTL: 15 minutes
  - Refresh token TTL: 7 days
  - Refresh rotation: Yes (new refresh on use)
  - Device tracking: Yes (user_agent, IP)
  - Concurrent sessions: Unlimited (mobile + web)

Session invalidation:
  - Logout: Revoke current session
  - Password change: Revoke all sessions
  - Suspicious activity: Revoke all + notify
```

---

# 11. OFFLINE MODE ARCHITECTURE

## Local Database (WatermelonDB)

```
Tables synced to mobile:
  - jobs (assigned to current user, last 30 days)
  - customers (associated with synced jobs)
  - price_book (full)
  - user (current user profile)

Tables NOT synced:
  - invoices (web-only creation)
  - payments
  - messages
  - audit_logs
```

## Sync Strategy

```
Sync direction: Bidirectional
Sync frequency: 
  - On app launch
  - On network reconnect
  - Every 5 minutes (when online)
  - Manual pull-to-refresh

Conflict resolution:
  - Server timestamp wins for most fields
  - Mobile completion data wins for job completion
  - Photos/signatures always merged (append)
```

## Offline Queue

```typescript
SyncQueue entry = {
  id: string
  action_type: 'job_update' | 'job_complete' | 'photo_upload' | 'signature_upload'
  entity_type: 'job' | 'photo' | 'signature'
  entity_id: string
  payload: JSON
  status: 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed'
  created_at: timestamp
  retry_count: number
}

Max queue size: 50 operations
Retry on failure: 3 times with exponential backoff
```

## Offline-Capable Actions

```
✅ Fully offline:
  - View assigned jobs
  - View customer details
  - Update job status (en_camino, working)
  - Complete job (photos, signature, notes)
  - View price book

⚠️ Queued for sync:
  - Photo uploads
  - Signature uploads
  - Job completion data

❌ Online required:
  - Create new job
  - Create invoice
  - Send WhatsApp
  - Process payment
```

## Photo Handling (Offline)

```
Photo specifications:
  - Max resolution: 1200x1200
  - Compression: 70% JPEG
  - Max file size: 500KB
  - Thumbnail: 200x200 @ 60%

Local storage:
  - Location: App documents directory
  - Max cache: 200MB
  - Cleanup: Delete uploaded photos when cache > 150MB

Upload queue:
  - Priority: Low (priority 3)
  - Retry: 5 times
  - Batch: Upload max 3 concurrent
```

## Conflict Resolution Flow

```
On sync:
1. Fetch server version of entity
2. Compare timestamps:
   - If server.updated_at > local.updated_at:
     - Check for local uncommitted changes
     - If no local changes: Accept server version
     - If local changes: Apply conflict rules
3. Conflict rules:
   - Job status: Mobile 'completed' wins (unless server 'cancelled')
   - Photos: Merge (union of both sets)
   - Notes: Append with separator
   - Address: Server wins
4. If conflict cannot be auto-resolved:
   - Mark as 'conflict'
   - Show in app for manual resolution
```

---

# 12. MOBILE TECHNICIAN APP ARCHITECTURE

## Technology Stack

```
Framework: React Native + Expo
Local DB: WatermelonDB
State: React Context + useReducer
Navigation: React Navigation (Stack + Bottom Tabs)
Camera: expo-camera + expo-image-manipulator
Signature: react-native-signature-canvas
Push: expo-notifications
```

## Screen Structure

```
Simple Mode (Default):
  BottomNav:
    - Hoy (Today's jobs)
    - Buzón (Inbox/Messages)
    - Perfil (Profile)

Advanced Mode (Opt-in):
  BottomNav:
    - Calendario (Calendar)
    - Trabajos (All jobs)
    - Buzón (Inbox)
    - Reportes (Reports)
    - Más (Settings)
```

## Performance Budgets

| Metric | Target | Measured On |
|--------|--------|-------------|
| Cold start | < 4s | Samsung A10 |
| JS bundle | < 2MB | Minified |
| Initial render | < 1.5s | Any device |
| Memory usage | < 150MB | 2GB RAM device |
| List scroll | 60 FPS | 50+ items |

## Performance Optimizations

```
1. Code splitting:
   - Lazy load screens (React.lazy)
   - Separate bundle for advanced mode

2. Image optimization:
   - FastImage for caching
   - Progressive loading
   - Aggressive compression

3. List optimization:
   - FlashList instead of FlatList
   - Windowing (10 items)
   - Memoized row components

4. Startup optimization:
   - Defer non-critical initialization
   - Preload critical data
   - Skeleton screens
```

## Offline UI Indicators

```
Network status bar:
  - 🟢 Online: Hidden
  - 🟡 Syncing: "Sincronizando..."
  - 🔴 Offline: "Sin conexión - Los cambios se guardan localmente"

Per-item indicators:
  - ☁️ Synced
  - ⏳ Pending sync
  - ⚠️ Conflict (tap to resolve)
  - ❌ Failed (tap to retry)
```

## Job Completion Flow

```
1. Tap "Completar trabajo"
2. Photo capture screen:
   - Take photos (min 1, max 10)
   - Preview thumbnails
   - Delete unwanted
3. Signature capture:
   - Customer signs on screen
   - Clear/redo option
4. Notes (optional):
   - Free text field
   - Voice-to-text option
5. Summary screen:
   - Review all data
   - "Confirmar" button
6. On confirm:
   - Save locally
   - Queue for sync
   - Show success animation
   - If online: auto-invoice triggered
```

## Push Notification Handling

```
Notification types:
  - new_job_assigned: Open job detail
  - job_status_changed: Refresh job
  - payment_received: Show toast
  - message_received: Open inbox

Deep linking:
  - campotech://job/{id}
  - campotech://inbox
  - campotech://invoice/{id}
```

---

# 13. ADMIN/OWNER PORTAL ARCHITECTURE

## Role-Based Access

| Feature | Owner | Admin | Dispatcher | Technician | Accountant |
|---------|-------|-------|------------|------------|------------|
| Dashboard | ✅ | ✅ | ✅ | ❌ | ❌ |
| All jobs | ✅ | ✅ | ✅ | Own only | ❌ |
| Create jobs | ✅ | ✅ | ✅ | ❌ | ❌ |
| Invoices | ✅ | ✅ | ❌ | ❌ | ✅ |
| Payments | ✅ | ✅ | ❌ | ❌ | View |
| Reports | ✅ | ✅ | ❌ | ❌ | ✅ |
| Team management | ✅ | ❌ | ❌ | ❌ | ❌ |
| AFIP config | ✅ | ❌ | ❌ | ❌ | ❌ |
| Billing | ✅ | ❌ | ❌ | ❌ | ❌ |
| Danger zone | ✅ | ❌ | ❌ | ❌ | ❌ |

## Dashboard Components

```
Owner/Admin Dashboard:
  ┌─────────────────────────────────────────────────┐
  │  Today's Summary                                │
  │  ├── Jobs: 12 pending, 5 in progress, 8 done   │
  │  ├── Revenue: $45,000 today                    │
  │  └── Outstanding: $120,000                      │
  ├─────────────────────────────────────────────────┤
  │  Quick Actions                                  │
  │  [+ Nuevo trabajo] [+ Nueva factura] [Buzón]   │
  ├─────────────────────────────────────────────────┤
  │  System Health                                  │
  │  ├── AFIP: 🟢 Online                           │
  │  ├── WhatsApp: 🟢 Online                       │
  │  ├── Mercado Pago: 🟢 Online                   │
  │  └── Queue: 3 pending, 0 failed                │
  ├─────────────────────────────────────────────────┤
  │  Recent Activity                                │
  │  └── [Activity feed with timestamps]           │
  └─────────────────────────────────────────────────┘
```

## Operational Pages

```
Jobs:
  - List view (filterable by status, date, technician)
  - Calendar view (day/week)
  - Dispatch board (drag-drop assignment)
  - Job detail (full editing)

Invoices:
  - List view (filterable by status, date range)
  - AFIP queue status
  - Draft management
  - Failed CAE retry

Payments:
  - Transaction list
  - Reconciliation page (pending MP sync)
  - Dispute management
  - Refund processing

WhatsApp:
  - Conversation list
  - Message thread view
  - Voice message review queue
  - Template management

Team:
  - User list
  - Invite new user
  - Role assignment
  - Deactivate user

Settings:
  - Organization profile
  - AFIP configuration
  - Mercado Pago connection
  - WhatsApp setup
  - Price book
  - Notification preferences
```

## Panic Mode Dashboard

```
Service Status Panel:
  ┌─────────────────────────────────────────────────┐
  │  Service        Status    Last Check   Actions  │
  ├─────────────────────────────────────────────────┤
  │  AFIP           🟢 OK     2m ago       [Force]  │
  │  MercadoPago    🟢 OK     1m ago       [Force]  │
  │  WhatsApp       🟡 DEGRADED 30s ago    [Force]  │
  │  Voice AI       🟢 OK     5m ago       [Force]  │
  └─────────────────────────────────────────────────┘

Queue Health Panel:
  ┌─────────────────────────────────────────────────┐
  │  Queue              Pending   Failed   DLQ     │
  ├─────────────────────────────────────────────────┤
  │  afip-invoices      3         0        0       │
  │  whatsapp-outbound  12        2        0       │
  │  photo-upload       45        0        0       │
  │  voice-processing   5         0        0       │
  └─────────────────────────────────────────────────┘
```

---

# 14. 12 CORE WORKFLOWS

## Workflow 1: User Signup
```
Trigger: New user visits app
Steps:
  1. Enter phone number
  2. Receive + enter OTP
  3. Enter CUIT (auto-fetch company name from AFIP)
  4. Enter company name (pre-filled if AFIP responded)
  5. → User in app, no more setup screens
Duration: < 90 seconds
Just-in-time: AFIP cert, MP, WhatsApp, Price Book (deferred)
```

## Workflow 2: Customer Creation
```
Trigger: Manual creation or auto from WhatsApp/Voice
Steps:
  1. Enter name + phone (required)
  2. Validate CUIT if provided (auto-fetch IVA condition)
  3. Enter address with barrio (optional)
  4. Save customer
Result: Customer record linked to org
```

## Workflow 3: Job Scheduling
```
Trigger: Manual, WhatsApp, or Voice message
Steps:
  1. Select/create customer
  2. Enter job details (type, description, priority)
  3. Select date/time (or "ASAP")
  4. Assign technician (or leave unassigned)
  5. Save job
Side effects:
  - WhatsApp confirmation sent to customer (if auto-send enabled)
  - Push notification to assigned technician
```

## Workflow 4: WhatsApp Message Reception
```
Trigger: Inbound WhatsApp message
Steps:
  1. Webhook receives message
  2. Match sender to customer (create if new)
  3. Store message
  4. If voice message: queue for Voice AI processing
  5. If text: show in inbox for dispatcher
Result: Message visible in inbox, customer linked
```

## Workflow 5: AFIP Electronic Invoicing
```
Trigger: Job completion (auto) or manual invoice creation
Steps:
  1. Build invoice with line items
  2. Calculate taxes (IVA based on categories)
  3. Determine invoice type (A/B/C from IVA conditions)
  4. Request CAE from AFIP (via queue)
  5. On success: Store CAE, generate PDF with QR
  6. On failure: Retry with backoff, fallback to draft
Idempotency: Key = org:invoice_id
Fallback: Draft mode (save without CAE, retry later)
```

## Workflow 6: Mercado Pago Payment
```
Trigger: Invoice issued
Steps:
  1. Create MP payment preference (cuotas 1-12)
  2. Generate payment link
  3. Send link to customer via WhatsApp
  4. Customer pays (redirect to MP)
  5. Webhook receives payment status
  6. Update payment + invoice records
TEA/CFT: Displayed per BCRA regulations
Fallback: Cash or bank transfer option always available
```

## Workflow 7: Voice AI Processing
```
Trigger: Voice message received via WhatsApp
Steps:
  1. Download audio (OGG/OPUS)
  2. Preprocess (normalize, noise filter optional)
  3. Transcribe with Whisper (Spanish-AR)
  4. Extract entities with GPT-4o (few-shot)
  5. Calculate confidence scores
  6. Route by confidence:
     - ≥0.7: Auto-create job
     - 0.4-0.7: Create draft, notify for review
     - <0.4: Human review queue
  7. Human corrections feed back to training
Target accuracy: 70% (launch), 80% (month 3)
```

## Workflow 8: SMS Fallback
```
Trigger: WhatsApp delivery failed + message is critical
Steps:
  1. WhatsApp fails after 3 retries
  2. Check if message type is critical (payment, completion)
  3. Format message for SMS (shorter version)
  4. Send via SMS provider (Twilio)
  5. Update message status to 'fallback_sms'
Critical messages: job_confirmation, payment_received, invoice_sent
```

## Workflow 9: Payment Reconciliation
```
Trigger: Scheduled (every 15 min) + webhook gaps
Steps:
  1. Fetch recent payments from MP API
  2. Compare with local records
  3. For each discrepancy:
     - Missing local: Create payment record
     - Status mismatch: Update local status
     - Amount mismatch: Flag for review
  4. Log reconciliation results
Alert: If discrepancies > 5, alert admin
```

## Workflow 10: PDF Invoice Generation
```
Trigger: CAE received from AFIP
Steps:
  1. Load invoice data + org data + customer data
  2. Generate QR code (AFIP RG 4291 format)
  3. Render PDF template:
     - Header: Company logo, name, CUIT, address
     - Customer: Name, CUIT/DNI, address
     - Line items: Description, quantity, unit price, subtotal
     - Taxes: IVA breakdown
     - Total: Net + Tax = Total
     - Footer: CAE, expiry, QR code
  4. Store PDF (immutable, with hash)
  5. Return download URL
```

## Workflow 11: Job Completion Flow
```
Trigger: Technician marks job as working → completed
Steps:
  1. Technician arrives, sets status to 'working'
  2. After work, taps "Completar"
  3. Captures photos (min 1)
  4. Captures customer signature
  5. Adds notes (optional)
  6. Confirms completion
  7. If online + auto_invoice:
     - Create invoice
     - Request CAE (queued)
     - Send to customer with payment link
  8. If offline:
     - Save locally
     - Queue for sync
     - Invoice created when back online
```

## Workflow 12: Panic Mode Activation
```
Trigger: Service health degradation
Steps:
  1. Monitor consecutive failures or error rate
  2. At threshold (e.g., 5 failures for AFIP):
     - Set service status to 'panic'
     - Log audit entry
     - Alert admin (Slack + SMS)
  3. Activate fallback:
     - AFIP panic: All invoices go to draft
     - WhatsApp panic: Critical → SMS, others → queued
     - MP panic: Show cash/transfer options only
  4. Recovery check:
     - After N successes + minimum time
     - Auto-recover or wait for manual
  5. Recovery:
     - Process queued items
     - Alert admin of recovery
```

---

# 15. FALLBACK SYSTEMS

## AFIP Fallback

```
Normal mode:
  Invoice → Request CAE → Store → Send

Panic mode (AFIP unavailable):
  Invoice → Save as Draft → Queue for retry → User sees "Factura guardada ✓"
  
Recovery:
  Background job processes draft queue
  On CAE success: Update invoice, generate PDF, notify user
  
User experience:
  - Never sees AFIP errors
  - Invoice appears created (draft)
  - Email/WhatsApp sent when CAE ready (async)
```

## WhatsApp Fallback

```
Normal mode:
  Message → WhatsApp API → Delivered

Fallback cascade:
  1. WhatsApp fails → Retry 3x with backoff
  2. Still failing → Check if critical message
  3. If critical → Send via SMS
  4. If not critical → Queue for later

Critical messages (always SMS fallback):
  - job_confirmation
  - tech_en_route
  - payment_received
  - invoice_sent

Non-critical (no SMS fallback):
  - promotional
  - follow-up surveys
```

## Mercado Pago Fallback

```
Normal mode:
  Invoice → Create MP preference → Send payment link

Fallback (MP unavailable):
  1. Show cash payment option
  2. Show bank transfer option (with org CBU)
  3. Manual payment recording

Manual payment flow:
  1. Admin marks invoice as "paid manually"
  2. Selects payment method (cash/transfer)
  3. Enters reference (receipt number/transfer ID)
  4. Invoice updated to paid
```

## Voice AI Fallback

```
Normal mode:
  Voice → Transcribe → Extract → Create job

Fallback cascade:
  1. Whisper fails → Retry 2x
  2. Still failing → Queue for later + notify
  3. Extraction fails → Human review queue
  4. Low confidence → Human review queue

Human review queue:
  - Shows audio player
  - Shows transcription (if available)
  - Shows AI extraction (if available)
  - Dispatcher corrects/completes
  - Correction feeds training data
```

---

# 16. MONITORING & OBSERVABILITY

## Logging

```
Log format (structured JSON):
  - timestamp: ISO 8601
  - level: debug | info | warn | error
  - service: service name
  - trace_id: request trace ID
  - user_id: if authenticated
  - org_id: if authenticated
  - message: human-readable
  - data: additional context (redacted)

Log levels by environment:
  - Production: info and above
  - Staging: debug and above
  - Development: all

Log retention:
  - Hot: 7 days (Elasticsearch)
  - Warm: 30 days (S3)
  - Cold: 1 year (S3 Glacier)
```

## Metrics

```
Application metrics:
  - api.request.duration (histogram, by endpoint)
  - api.request.count (counter, by endpoint, status)
  - api.error.count (counter, by type)
  - job.created (counter)
  - job.completed (counter)
  - invoice.created (counter)
  - invoice.cae.success (counter)
  - invoice.cae.failure (counter)
  - payment.received (counter)
  - voice.processed (counter)
  - voice.accuracy (gauge)

Queue metrics:
  - queue.size (gauge, by queue)
  - queue.processing (gauge, by queue)
  - queue.failed (counter, by queue)
  - queue.dlq.size (gauge, by queue)

External service metrics:
  - external.latency (histogram, by service)
  - external.error.rate (gauge, by service)
  - external.availability (gauge, by service)
```

## Alerts

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| API Error Spike | error_rate > 5% for 5min | High | Slack + SMS |
| AFIP Unavailable | 3 consecutive failures | High | Slack + SMS |
| Queue Backlog | size > 100 for 10min | Medium | Slack |
| DLQ Growing | dlq_size > 10 | Medium | Slack |
| Panic Mode Activated | any service | High | Slack + SMS |
| Payment Discrepancy | reconcile_errors > 5 | Medium | Slack |
| Budget Alert | projected > 80% budget | Medium | Slack |
| Certificate Expiry | < 30 days remaining | Medium | Slack |

## Health Checks

```
Endpoints:
  GET /health → Basic (always 200 if app running)
  GET /health/ready → Ready (checks DB, Redis)
  GET /health/live → Live (checks all dependencies)

Dependency checks:
  - Database: SELECT 1
  - Redis: PING
  - AFIP: HEAD to WSAA endpoint
  - Mercado Pago: GET /v1/payment_methods
  - WhatsApp: Token validation
```

---

# 17. DEPLOYMENT ARCHITECTURE

## Environments

```
Development:
  - Local Docker Compose
  - Supabase local
  - MP sandbox
  - WA test phone

Staging:
  - Vercel preview
  - Supabase staging project
  - MP sandbox
  - WA test phone
  - AFIP homologation

Production:
  - Vercel (web)
  - Railway/Render (workers)
  - Supabase production
  - MP production
  - WA production
  - AFIP production
```

## CI/CD Pipeline

```
On PR:
  1. Lint + type check
  2. Unit tests
  3. Build check
  4. Preview deploy (Vercel)

On merge to main:
  1. All PR checks
  2. Integration tests
  3. Deploy to staging
  4. Smoke tests on staging
  5. Manual approval gate
  6. Deploy to production
  7. Health check
  8. Rollback if health fails
```

## Blue-Green Deployment

```
Strategy:
  1. Deploy new version to "green" (inactive)
  2. Run health checks on green
  3. Gradually shift traffic (10% → 50% → 100%)
  4. If errors spike, rollback to "blue"
  5. Blue becomes green for next deploy

Worker deployment:
  1. Deploy new workers
  2. Drain old workers (finish current jobs)
  3. Terminate old workers
```

## Feature Flags

```
Flags by category:
  - Module toggles: afip_enabled, whatsapp_enabled, voice_ai_enabled
  - Kill switches: afip_kill, whatsapp_kill, mp_kill
  - Gradual rollout: new_invoice_ui, voice_v2
  - Org-specific: beta_features

Implementation:
  - Stored in Redis for speed
  - Admin UI to toggle
  - Audit logged
```

## Rollback Mechanisms

```
Application rollback:
  - Vercel: Instant rollback to previous deploy
  - Workers: Redeploy previous image

Database rollback:
  - Migrations are versioned
  - Rollback scripts for each migration
  - Point-in-time recovery (Supabase)

Mobile rollback:
  - OTA updates via Expo
  - Version pinning: min_supported_version
  - Force update if critical
```

---

# 18. IMPLEMENTATION SNIPPETS

## Idempotency Service

```typescript
class IdempotencyService {
  async executeOnce<T>(key: string, ttlSeconds: number, operation: () => Promise<T>): Promise<T> {
    const resultKey = `idem:result:${key}`;
    const lockKey = `idem:lock:${key}`;
    
    // Check existing result
    const cached = await redis.get(resultKey);
    if (cached) return JSON.parse(cached);
    
    // Acquire lock
    const locked = await redis.set(lockKey, '1', 'NX', 'EX', 60);
    if (!locked) return this.waitForResult(resultKey);
    
    try {
      const result = await operation();
      await redis.setex(resultKey, ttlSeconds, JSON.stringify(result));
      return result;
    } finally {
      await redis.del(lockKey);
    }
  }
}
```

## Encryption Service

```typescript
class EncryptionService {
  async encrypt(data: string, purpose: KeyPurpose): Promise<EncryptedData> {
    const key = await this.getKey(purpose);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key.value, iv);
    
    let ciphertext = cipher.update(data, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    
    return {
      ciphertext,
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      keyId: key.id,
      algorithm: 'aes-256-gcm'
    };
  }
}
```

## Panic Mode Controller

```typescript
class PanicController {
  private state: Map<string, ServiceHealth> = new Map();
  
  async recordOutcome(service: string, success: boolean): Promise<void> {
    const health = this.state.get(service);
    
    if (success) {
      health.consecutiveFailures = 0;
      health.consecutiveSuccesses++;
    } else {
      health.consecutiveFailures++;
      health.consecutiveSuccesses = 0;
    }
    
    await this.evaluateState(service, health);
  }
  
  private async evaluateState(service: string, health: ServiceHealth): Promise<void> {
    const config = PANIC_CONFIGS[service];
    
    if (health.status !== 'panic' && health.consecutiveFailures >= config.panicThreshold) {
      await this.enterPanicMode(service);
    }
    
    if (health.status === 'panic' && 
        health.consecutiveSuccesses >= config.recoveryThreshold &&
        Date.now() - health.panicStartedAt > config.recoveryMinTime) {
      await this.recover(service);
    }
  }
}
```

## Voice AI Extraction

```typescript
async function extractJobData(transcription: string): Promise<ExtractedJobData> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: transcription }
    ],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(response.choices[0].message.content);
}

const EXTRACTION_SYSTEM_PROMPT = `Extract job information from Argentine Spanish voice messages.
Return JSON with confidence scores (0-1) for each field:
{
  "customer_name": { "value": string, "confidence": number },
  "phone": { "value": string, "confidence": number },
  "address": { "value": string, "confidence": number },
  "neighborhood": { "value": string, "confidence": number },
  "problem_description": { "value": string, "confidence": number },
  "service_type": { "value": string, "confidence": number },
  "urgency": { "value": "normal"|"urgent"|"emergency", "confidence": number }
}`;
```

## Offline Sync Manager

```typescript
class SyncManager {
  async sync(): Promise<SyncResult> {
    const pending = await db.get('sync_queue')
      .query(Q.where('status', 'pending'))
      .fetch();
    
    for (const item of pending) {
      try {
        await item.update(r => r.status = 'syncing');
        await this.processItem(item);
        await item.update(r => r.status = 'synced');
      } catch (error) {
        if (isConflict(error)) {
          await item.update(r => r.status = 'conflict');
        } else if (item.retry_count < 3) {
          await item.update(r => { r.status = 'pending'; r.retry_count++; });
        } else {
          await item.update(r => r.status = 'failed');
        }
      }
    }
  }
}
```

## AFIP CAE Request

```typescript
async function requestCAE(invoice: Invoice): Promise<CAEResult> {
  const auth = await afipAuth.getToken('wsfe');
  
  const request = {
    Auth: { Token: auth.token, Sign: auth.sign, Cuit: invoice.org.cuit },
    FeCAEReq: {
      FeCabReq: { CantReg: 1, PtoVta: invoice.punto_venta, CbteTipo: getInvoiceTypeCode(invoice.invoice_type) },
      FeDetReq: {
        FECAEDetRequest: [{
          Concepto: 1,
          DocTipo: getDocTypeCode(invoice.customer.doc_type),
          DocNro: invoice.customer.doc_number,
          CbteDesde: invoice.invoice_number,
          CbteHasta: invoice.invoice_number,
          CbteFch: formatDate(new Date()),
          ImpTotal: invoice.total,
          ImpNeto: invoice.subtotal,
          ImpIVA: invoice.tax_amount,
          MonId: 'PES',
          MonCotiz: 1
        }]
      }
    }
  };
  
  const response = await wsfeClient.FECAESolicitar(request);
  // Handle response...
}
```

---

# 19. GLOSSARY

## Argentine Terms

| Term | Definition |
|------|------------|
| AFIP | Administración Federal de Ingresos Públicos (tax authority) |
| CAE | Código de Autorización Electrónico (electronic invoice authorization code) |
| CUIT | Clave Única de Identificación Tributaria (tax ID for businesses) |
| CUIL | Clave Única de Identificación Laboral (tax ID for individuals) |
| DNI | Documento Nacional de Identidad (national ID) |
| IVA | Impuesto al Valor Agregado (VAT, typically 21%) |
| Factura A | Invoice for registered IVA taxpayers |
| Factura B | Invoice for final consumers or exempt |
| Factura C | Invoice issued by monotributistas |
| Monotributista | Small business with simplified tax regime |
| Responsable Inscripto | Registered IVA taxpayer |
| Consumidor Final | End consumer (not business) |
| Punto de Venta | Point of sale number (required for AFIP) |
| WSAA | Web Service de Autenticación y Autorización |
| WSFEv1 | Web Service de Factura Electrónica |
| CBU | Clave Bancaria Uniforme (bank account number) |
| TEA | Tasa Efectiva Anual (annual effective rate) |
| CFT | Costo Financiero Total (total financial cost) |
| Cuotas | Installments |
| Lunfardo | Argentine Spanish slang |
| Barrio | Neighborhood |
| PyME | Small/medium business |

## Technical Terms

| Term | Definition |
|------|------------|
| Idempotency Key | Unique identifier to prevent duplicate operations |
| DLQ | Dead Letter Queue (failed jobs requiring manual review) |
| Panic Mode | Automatic fallback when external service fails |
| CAE Queue | Background queue for AFIP invoice authorization |
| Voice AI | System that extracts job data from voice messages |
| WatermelonDB | Local database for React Native offline support |
| Backpressure | Queue overflow handling strategy |
| Circuit Breaker | Pattern to prevent cascading failures |
| Blue-Green | Deployment strategy with zero downtime |
| Feature Flag | Toggle to enable/disable features without deploy |

## Status Values

| Entity | Statuses |
|--------|----------|
| Job | pending, scheduled, en_camino, working, completed, cancelled |
| Invoice | draft, pending_cae, issued, sent, paid, overdue, cancelled, refunded |
| Payment | pending, processing, approved, rejected, refunded, in_dispute, chargedback |
| Message | queued, sent, delivered, read, failed, fallback_sms, undeliverable |
| Sync | pending, syncing, synced, conflict, failed |

---

# DOCUMENT METADATA

```
Version: 1.0
Created: December 2025
Source: Merged from v1-v7 roadmaps
Timeline: 18 weeks
Target Launch: Q1 2026

Authors: Architecture Team
Review: Product, Engineering, Security

Supersedes:
  - campotech-argentina-mvp-roadmap-v1.md through v7.md
  - All previous architecture documents
```

---

*This document is the single source of truth for CampoTech architecture.*
*All implementation must align with this specification.*
