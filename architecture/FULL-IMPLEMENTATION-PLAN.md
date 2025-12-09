# CampoTech Full Implementation Plan

**Based on:** `campotech-architecture-complete.md`
**Target Timeline:** 18-Week MVP + 2-Week Enhanced MVP + 18-Week Post-MVP (38 weeks total)
**Total Estimated Effort:** ~5000 developer hours (MVP: ~2500 | Enhanced: ~400 | Post-MVP: ~2100)

---

## EXECUTIVE OVERVIEW

| Phase | Focus | Duration | Dependencies | Launch Blocking? |
|-------|-------|----------|--------------|------------------|
| **Phase 1** | Foundation & Infrastructure | Weeks 1-3 | None | YES |
| **Phase 2** | Core Domain Services | Weeks 4-6 | Phase 1 | YES |
| **Phase 3** | AFIP Integration | Weeks 7-8 | Phase 2 | YES |
| **Phase 4** | MercadoPago Integration | Weeks 9-10 | Phase 2 | YES |
| **Phase 5** | Web Portal (Admin/Owner) | Weeks 11-13 | Phases 2-4 | YES |
| **Phase 6** | WhatsApp Integration | Weeks 14-15 | Phases 2, 5 | Feature-flagged |
| **Phase 7** | Mobile Technician App | Weeks 14-17 | Phases 2-5 | Feature-flagged |
| **Phase 8** | Voice AI Processing | Week 16-17 | Phase 6 | Feature-flagged |
| **Phase 9** | Observability & Hardening | Week 18 | All | YES |

### Enhanced MVP Phases (Post-Launch, Pre-Scaling)

| Phase | Focus | Duration | Dependencies | Priority |
|-------|-------|----------|--------------|----------|
| **Phase 9.5** | Employee Onboarding & Verification | Week 19 | Phase 9 | High |
| **Phase 9.6** | Notification Preferences System | Weeks 19-20 | Phase 9 | High |

### Post-MVP Phases

| Phase | Focus | Duration | Dependencies | Priority |
|-------|-------|----------|--------------|----------|
| **Phase 10** | Advanced Analytics & Reporting | Weeks 21-23 | Phase 9.6 | High |
| **Phase 11** | Multi-Location Support | Weeks 24-26 | Phase 10 | High |
| **Phase 12** | Inventory Management | Weeks 27-30 | Phase 11 | Medium |
| **Phase 13** | Customer Self-Service Portal | Weeks 31-34 | Phases 10-12 | Medium |
| **Phase 14** | API for Third-Party Integrations | Weeks 35-38 | Phase 13 | Medium |

---

## PHASE 1: FOUNDATION & INFRASTRUCTURE
**Duration:** Weeks 1-3
**Team:** 2 Backend Engineers

### 1.1 Database Setup
```
Location: /database/
Files to create:
├── migrations/
│   ├── 001_create_organizations.sql
│   ├── 002_create_users.sql
│   ├── 003_create_customers.sql
│   ├── 004_create_jobs.sql
│   ├── 005_create_invoices.sql
│   ├── 006_create_payments.sql
│   ├── 007_create_whatsapp_messages.sql
│   ├── 008_create_price_book.sql
│   ├── 009_create_audit_logs.sql
│   ├── 010_create_capability_overrides.sql
│   ├── 011_create_afip_sequences.sql
│   └── 012_create_sync_operations.sql
├── seeds/
│   ├── development.sql
│   └── test.sql
└── triggers/
    ├── prevent_fiscal_field_mutation.sql
    ├── auto_updated_at.sql
    └── audit_log_chain.sql
```

**Tasks:**
- [ ] 1.1.1 Set up Supabase project (production + staging)
- [ ] 1.1.2 Create all database tables per schema spec
- [ ] 1.1.3 Create enum types (job_status, invoice_status, payment_status, etc.)
- [ ] 1.1.4 Set up Row Level Security (RLS) policies
- [ ] 1.1.5 Create database triggers for immutability
- [ ] 1.1.6 Create indexes per spec
- [ ] 1.1.7 Set up database migrations tooling

### 1.2 Authentication System
```
Location: /src/auth/
Files to create:
├── services/
│   ├── otp.service.ts
│   ├── session.service.ts
│   └── token.service.ts
├── middleware/
│   ├── auth.middleware.ts
│   ├── rls-context.middleware.ts
│   └── rate-limit.middleware.ts
├── routes/
│   └── auth.routes.ts
└── types/
    └── auth.types.ts
```

**Tasks:**
- [ ] 1.2.1 Implement phone OTP generation and verification
- [ ] 1.2.2 Implement JWT access token generation (15min TTL)
- [ ] 1.2.3 Implement refresh token rotation (7-day TTL)
- [ ] 1.2.4 Create auth middleware for route protection
- [ ] 1.2.5 Implement RLS context setting per request
- [ ] 1.2.6 Create session management (concurrent sessions)
- [ ] 1.2.7 Implement role-based access control helpers

### 1.3 Encryption & Secrets
```
Location: /src/lib/security/
Files to create:
├── encryption.service.ts
├── secrets-manager.ts
├── key-rotation.ts
└── log-redaction.ts
```

**Tasks:**
- [ ] 1.3.1 Set up AWS Secrets Manager integration
- [ ] 1.3.2 Set up AWS KMS for envelope encryption
- [ ] 1.3.3 Implement AES-256-GCM encryption service
- [ ] 1.3.4 Create key hierarchy (AFIP, MP, PII, general)
- [ ] 1.3.5 Implement log redaction for sensitive data
- [ ] 1.3.6 Create secret caching layer (5min TTL)

### 1.4 Queue System
```
Location: /src/queue/
Files to create:
├── config/
│   ├── queue-config.ts
│   └── worker-config.ts
├── base-worker.ts
├── queue-manager.ts
├── dlq-handler.ts
├── retry-strategies.ts
└── metrics-emitter.ts
```

**Tasks:**
- [ ] 1.4.1 Set up Redis (Upstash) for BullMQ
- [ ] 1.4.2 Create queue configuration per spec (5 queues)
- [ ] 1.4.3 Implement BaseWorker class with metrics
- [ ] 1.4.4 Implement retry strategies (exponential backoff)
- [ ] 1.4.5 Implement Dead Letter Queue handling
- [ ] 1.4.6 Create backpressure strategies
- [ ] 1.4.7 Integrate fair scheduler (from existing code)

### 1.5 Core Services
```
Location: /src/lib/
Files to create:
├── idempotency/
│   └── idempotency.service.ts
├── events/
│   ├── event-bus.ts
│   └── domain-events.ts
├── rate-limiting/
│   └── sliding-window.ts
└── mapping/
    └── case-converter.ts
```

**Tasks:**
- [ ] 1.5.1 Implement idempotency service (Redis-backed)
- [ ] 1.5.2 Create domain event bus
- [ ] 1.5.3 Define all domain event types
- [ ] 1.5.4 Implement sliding window rate limiter
- [ ] 1.5.5 Create snake_case ↔ camelCase mappers

### 1.6 Error Handling & Logging
```
Location: /src/lib/errors/
Files to create:
├── error-codes.ts
├── error-handler.ts
├── logger.ts
└── sentry-integration.ts
```

**Tasks:**
- [ ] 1.6.1 Define all error codes per spec
- [ ] 1.6.2 Create standardized error response format
- [ ] 1.6.3 Set up structured JSON logging
- [ ] 1.6.4 Integrate Sentry for error tracking
- [ ] 1.6.5 Implement request tracing (trace_id)

---

## PHASE 2: CORE DOMAIN SERVICES
**Duration:** Weeks 4-6
**Team:** 2 Backend Engineers, 1 Frontend Engineer

### 2.1 Organization Service
```
Location: /src/modules/organizations/
Files to create:
├── organization.service.ts
├── organization.repository.ts
├── organization.controller.ts
├── organization.routes.ts
├── organization.types.ts
└── organization.validation.ts
```

**Tasks:**
- [ ] 2.1.1 Implement org CRUD operations
- [ ] 2.1.2 Create onboarding flow (CUIT + name only)
- [ ] 2.1.3 Implement settings management
- [ ] 2.1.4 Create CUIT validation with AFIP lookup
- [ ] 2.1.5 Implement AFIP certificate upload flow
- [ ] 2.1.6 Create API endpoints per spec

### 2.2 User Service
```
Location: /src/modules/users/
Files to create:
├── user.service.ts
├── user.repository.ts
├── user.controller.ts
├── user.routes.ts
└── role-permissions.ts
```

**Tasks:**
- [ ] 2.2.1 Implement user CRUD operations
- [ ] 2.2.2 Create role management (owner, admin, dispatcher, technician, accountant)
- [ ] 2.2.3 Implement permission checking
- [ ] 2.2.4 Create team invitation flow
- [ ] 2.2.5 Implement user deactivation
- [ ] 2.2.6 Create API endpoints per spec

### 2.3 Customer Service
```
Location: /src/modules/customers/
Files to create:
├── customer.service.ts
├── customer.repository.ts
├── customer.controller.ts
├── customer.routes.ts
├── customer.validation.ts
└── cuit-validator.ts
```

**Tasks:**
- [ ] 2.3.1 Implement customer CRUD operations
- [ ] 2.3.2 Create search functionality (name, phone, CUIT)
- [ ] 2.3.3 Implement CUIT validation with AFIP
- [ ] 2.3.4 Auto-determine IVA condition from CUIT
- [ ] 2.3.5 Handle duplicate detection (phone)
- [ ] 2.3.6 Create API endpoints per spec

### 2.4 Job Service (with State Machine)
```
Location: /src/modules/jobs/
Files to create:
├── job.service.ts
├── job.repository.ts
├── job.controller.ts
├── job.routes.ts
├── job.validation.ts
├── job-state-machine.ts
└── job.events.ts
```

**Tasks:**
- [ ] 2.4.1 Implement job CRUD operations
- [ ] 2.4.2 Create job state machine (pending → scheduled → en_camino → working → completed/cancelled)
- [ ] 2.4.3 Implement status transition validation
- [ ] 2.4.4 Create side effects for transitions (notifications, auto-invoice)
- [ ] 2.4.5 Implement job assignment
- [ ] 2.4.6 Create job completion flow (photos, signature, notes)
- [ ] 2.4.7 Implement calendar/scheduling queries
- [ ] 2.4.8 Create API endpoints per spec

### 2.5 Invoice Service (with State Machine)
```
Location: /src/modules/invoices/
Files to create:
├── invoice.service.ts
├── invoice.repository.ts
├── invoice.controller.ts
├── invoice.routes.ts
├── invoice.validation.ts
├── invoice-state-machine.ts
├── invoice-number.service.ts
├── tax-calculator.ts
├── invoice-type-determiner.ts
└── pdf-generator.ts
```

**Tasks:**
- [ ] 2.5.1 Implement invoice CRUD operations
- [ ] 2.5.2 Create invoice state machine (draft → pending_cae → issued → sent → paid)
- [ ] 2.5.3 Implement AFIP-compliant numbering (sequential, no gaps)
- [ ] 2.5.4 Create tax calculator (IVA by category)
- [ ] 2.5.5 Implement invoice type determination (A/B/C from IVA conditions)
- [ ] 2.5.6 Create line items management
- [ ] 2.5.7 Implement immutability enforcement (post-CAE)
- [ ] 2.5.8 Create PDF generation with QR code
- [ ] 2.5.9 Create API endpoints per spec

### 2.6 Payment Service (with State Machine)
```
Location: /src/modules/payments/
Files to create:
├── payment.service.ts
├── payment.repository.ts
├── payment.controller.ts
├── payment.routes.ts
├── payment-state-machine.ts
├── refund.service.ts
└── dispute.service.ts
```

**Tasks:**
- [ ] 2.6.1 Implement payment record management
- [ ] 2.6.2 Create payment state machine
- [ ] 2.6.3 Implement refund processing
- [ ] 2.6.4 Create dispute handling
- [ ] 2.6.5 Implement manual payment recording (cash/transfer)
- [ ] 2.6.6 Create API endpoints per spec

### 2.7 Price Book Service
```
Location: /src/modules/pricebook/
Files to create:
├── pricebook.service.ts
├── pricebook.repository.ts
├── pricebook.controller.ts
└── pricebook.routes.ts
```

**Tasks:**
- [ ] 2.7.1 Implement price book CRUD
- [ ] 2.7.2 Create category management
- [ ] 2.7.3 Implement regional pricing
- [ ] 2.7.4 Create complexity multipliers
- [ ] 2.7.5 Implement AFIP product codes

### 2.8 Audit Service
```
Location: /src/modules/audit/
Files to create:
├── audit.service.ts
├── audit.repository.ts
└── integrity-chain.ts
```

**Tasks:**
- [ ] 2.8.1 Implement audit log creation
- [ ] 2.8.2 Create integrity chain (hash chain)
- [ ] 2.8.3 Implement audit queries

---

## PHASE 3: AFIP INTEGRATION
**Duration:** Weeks 7-8
**Team:** 1 Senior Backend Engineer

### 3.1 AFIP Core
```
Location: /src/integrations/afip/
Files to create:
├── afip.service.ts
├── wsaa/
│   ├── wsaa.client.ts
│   ├── tra-generator.ts
│   └── token-cache.ts
├── wsfe/
│   ├── wsfe.client.ts
│   ├── cae-request.ts
│   └── invoice-builder.ts
├── padron/
│   └── cuit-lookup.ts
├── qr-generator.ts
└── afip.types.ts
```

**Tasks:**
- [ ] 3.1.1 Implement WSAA authentication (TRA generation, signing)
- [ ] 3.1.2 Create ticket de acceso caching (12-24h)
- [ ] 3.1.3 Implement WSFEv1 client (SOAP)
- [ ] 3.1.4 Create FECompUltimoAutorizado call
- [ ] 3.1.5 Implement FECAESolicitar flow
- [ ] 3.1.6 Handle AFIP error codes per spec
- [ ] 3.1.7 Implement QR code generation (RG 4291)
- [ ] 3.1.8 Create CUIT lookup via WS_SR_PADRON
- [ ] 3.1.9 Handle homologation vs production endpoints

### 3.2 AFIP Worker
```
Location: /src/workers/afip/
Files to create:
├── afip-invoice.worker.ts
├── afip-retry.strategy.ts
└── afip-fallback.handler.ts
```

**Tasks:**
- [ ] 3.2.1 Create AFIP invoice queue worker
- [ ] 3.2.2 Implement retry strategy (5 retries, AFIP backoff)
- [ ] 3.2.3 Create fallback to draft mode
- [ ] 3.2.4 Implement number reservation (before AFIP call)
- [ ] 3.2.5 Handle transient vs permanent errors
- [ ] 3.2.6 Integrate with panic controller

---

## PHASE 4: MERCADOPAGO INTEGRATION
**Duration:** Weeks 9-10
**Team:** 1 Backend Engineer

### 4.1 MercadoPago Core
```
Location: /src/integrations/mercadopago/
Files to create:
├── mercadopago.service.ts
├── oauth/
│   ├── oauth.handler.ts
│   └── token-refresh.ts
├── preference/
│   └── preference.builder.ts
├── webhook/
│   ├── webhook.handler.ts
│   └── signature.validator.ts
├── cuotas/
│   └── installments.service.ts
└── mercadopago.types.ts
```

**Tasks:**
- [ ] 4.1.1 Implement OAuth flow (authorization code)
- [ ] 4.1.2 Create token storage (encrypted)
- [ ] 4.1.3 Implement token refresh mechanism
- [ ] 4.1.4 Create payment preference builder
- [ ] 4.1.5 Implement webhook handler (idempotent)
- [ ] 4.1.6 Handle webhook signature validation
- [ ] 4.1.7 Implement cuotas/installments lookup
- [ ] 4.1.8 Calculate TEA/CFT per BCRA

### 4.2 Payment Workers
```
Location: /src/workers/payments/
Files to create:
├── payment-webhook.worker.ts
├── payment-reconciliation.worker.ts
└── payment-fallback.handler.ts
```

**Tasks:**
- [ ] 4.2.1 Create webhook processing worker
- [ ] 4.2.2 Implement reconciliation worker (15min schedule)
- [ ] 4.2.3 Create discrepancy detection
- [ ] 4.2.4 Implement fallback to manual payment
- [ ] 4.2.5 Integrate with panic controller

---

## PHASE 5: WEB PORTAL (ADMIN/OWNER)
**Duration:** Weeks 11-13
**Team:** 2 Frontend Engineers, 1 Backend Engineer

### 5.1 Portal Foundation
```
Location: /apps/web/
Files to create:
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── api/
├── components/
│   ├── ui/
│   └── shared/
├── lib/
│   ├── api-client.ts
│   └── auth-context.tsx
└── styles/
```

**Tasks:**
- [ ] 5.1.1 Set up Next.js 14 project
- [ ] 5.1.2 Configure TailwindCSS
- [ ] 5.1.3 Create auth context and routes
- [ ] 5.1.4 Build login/signup pages
- [ ] 5.1.5 Create dashboard layout
- [ ] 5.1.6 Build role-based navigation

### 5.2 Dashboard & Analytics
```
Files to create:
├── app/(dashboard)/
│   ├── page.tsx (Overview)
│   └── analytics/
```

**Tasks:**
- [ ] 5.2.1 Build today's summary widget
- [ ] 5.2.2 Create quick actions component
- [ ] 5.2.3 Build system health panel
- [ ] 5.2.4 Create recent activity feed
- [ ] 5.2.5 Implement real-time updates

### 5.3 Jobs Management
```
Files to create:
├── app/(dashboard)/jobs/
│   ├── page.tsx (List)
│   ├── [id]/page.tsx (Detail)
│   ├── new/page.tsx
│   └── calendar/page.tsx
```

**Tasks:**
- [ ] 5.3.1 Build jobs list with filters
- [ ] 5.3.2 Create job detail/edit page
- [ ] 5.3.3 Build job creation form
- [ ] 5.3.4 Create calendar view
- [ ] 5.3.5 Build dispatch board (drag-drop)

### 5.4 Customers Management
```
Files to create:
├── app/(dashboard)/customers/
│   ├── page.tsx
│   ├── [id]/page.tsx
│   └── new/page.tsx
```

**Tasks:**
- [ ] 5.4.1 Build customers list with search
- [ ] 5.4.2 Create customer detail page
- [ ] 5.4.3 Build customer creation form
- [ ] 5.4.4 Implement CUIT validation UI

### 5.5 Invoices & Payments
```
Files to create:
├── app/(dashboard)/invoices/
│   ├── page.tsx
│   ├── [id]/page.tsx
│   └── queue/page.tsx
├── app/(dashboard)/payments/
│   ├── page.tsx
│   ├── reconciliation/page.tsx
│   └── disputes/page.tsx
```

**Tasks:**
- [ ] 5.5.1 Build invoices list
- [ ] 5.5.2 Create invoice detail with PDF preview
- [ ] 5.5.3 Build AFIP queue status page
- [ ] 5.5.4 Create payments list
- [ ] 5.5.5 Build reconciliation page
- [ ] 5.5.6 Create dispute management UI

### 5.6 Settings & Configuration
```
Files to create:
├── app/(dashboard)/settings/
│   ├── page.tsx
│   ├── organization/page.tsx
│   ├── afip/page.tsx
│   ├── mercadopago/page.tsx
│   ├── team/page.tsx
│   └── pricebook/page.tsx
```

**Tasks:**
- [ ] 5.6.1 Build organization settings
- [ ] 5.6.2 Create AFIP configuration page
- [ ] 5.6.3 Build MercadoPago connection flow
- [ ] 5.6.4 Create team management page
- [ ] 5.6.5 Build price book editor

### 5.7 Panic Mode Dashboard
```
Files to create:
├── app/(dashboard)/admin/
│   ├── health/page.tsx
│   ├── queues/page.tsx
│   └── capabilities/page.tsx
```

**Tasks:**
- [ ] 5.7.1 Build service health panel
- [ ] 5.7.2 Create queue status dashboard
- [ ] 5.7.3 Build panic mode controls
- [ ] 5.7.4 Create capability override UI
- [ ] 5.7.5 Build DLQ management page

---

## PHASE 6: WHATSAPP INTEGRATION
**Duration:** Weeks 14-15
**Team:** 1 Backend Engineer, 1 Frontend Engineer

### 6.1 WhatsApp Core
```
Location: /src/integrations/whatsapp/
Files to create:
├── whatsapp.service.ts
├── webhook/
│   ├── webhook.handler.ts
│   └── signature.validator.ts
├── messages/
│   ├── template.sender.ts
│   ├── text.sender.ts
│   └── media.handler.ts
├── templates/
│   └── template-registry.ts
└── whatsapp.types.ts
```

**Tasks:**
- [ ] 6.1.1 Implement webhook handler
- [ ] 6.1.2 Create message status tracking
- [ ] 6.1.3 Implement template message sending
- [ ] 6.1.4 Create inbound message processing
- [ ] 6.1.5 Implement customer matching/creation
- [ ] 6.1.6 Handle media downloads

### 6.2 WhatsApp Worker
```
Location: /src/workers/whatsapp/
Files to create:
├── whatsapp-outbound.worker.ts
├── sms-fallback.handler.ts
└── whatsapp-state-machine.ts
```

**Tasks:**
- [ ] 6.2.1 Create outbound message worker
- [ ] 6.2.2 Implement rate limiting (50/min per org)
- [ ] 6.2.3 Create SMS fallback for critical messages
- [ ] 6.2.4 Implement message state machine
- [ ] 6.2.5 Integrate with panic controller

### 6.3 WhatsApp UI
```
Files to create:
├── app/(dashboard)/whatsapp/
│   ├── page.tsx (Conversations)
│   ├── [customerId]/page.tsx (Thread)
│   └── templates/page.tsx
```

**Tasks:**
- [ ] 6.3.1 Build conversation list
- [ ] 6.3.2 Create message thread view
- [ ] 6.3.3 Build template management UI

---

## PHASE 7: MOBILE TECHNICIAN APP
**Duration:** Weeks 14-17
**Team:** 2 Mobile Engineers

### 7.1 Mobile Foundation
```
Location: /apps/mobile/
Files to create:
├── app/
│   ├── (auth)/
│   ├── (tabs)/
│   └── _layout.tsx
├── components/
├── lib/
│   ├── api/
│   ├── storage/
│   └── sync/
└── watermelon/
    ├── schema.ts
    ├── models/
    └── sync/
```

**Tasks:**
- [ ] 7.1.1 Set up React Native + Expo project
- [ ] 7.1.2 Configure WatermelonDB
- [ ] 7.1.3 Create database schema (jobs, customers, price_book)
- [ ] 7.1.4 Build auth flow
- [ ] 7.1.5 Create simple/advanced mode navigation

### 7.2 Sync Engine
```
Files to create:
├── lib/sync/
│   ├── sync-engine.ts
│   ├── conflict-resolver.ts
│   ├── sync-queue.ts
│   └── network-monitor.ts
```

**Tasks:**
- [ ] 7.2.1 Implement bidirectional sync
- [ ] 7.2.2 Create conflict resolution per spec
- [ ] 7.2.3 Build sync queue (max 50 operations)
- [ ] 7.2.4 Implement network state detection
- [ ] 7.2.5 Create conflict resolution UI

### 7.3 Jobs Flow
```
Files to create:
├── app/(tabs)/today.tsx
├── app/(tabs)/jobs/
│   ├── index.tsx
│   ├── [id].tsx
│   └── complete.tsx
├── components/job/
│   ├── JobCard.tsx
│   ├── JobDetail.tsx
│   ├── StatusButton.tsx
│   └── CompletionFlow.tsx
```

**Tasks:**
- [ ] 7.3.1 Build today's jobs screen
- [ ] 7.3.2 Create job detail screen
- [ ] 7.3.3 Implement status transitions
- [ ] 7.3.4 Build completion flow (photos, signature, notes)
- [ ] 7.3.5 Create photo capture component
- [ ] 7.3.6 Build signature capture component

### 7.4 Offline Capabilities
```
Files to create:
├── components/
│   ├── OfflineBanner.tsx
│   ├── SyncIndicator.tsx
│   └── ConflictResolver.tsx
```

**Tasks:**
- [ ] 7.4.1 Implement offline job viewing
- [ ] 7.4.2 Create offline status updates
- [ ] 7.4.3 Build photo queue (local storage)
- [ ] 7.4.4 Implement offline indicators
- [ ] 7.4.5 Create sync progress UI

### 7.5 Push Notifications
```
Files to create:
├── lib/notifications/
│   ├── notification-handler.ts
│   └── deep-linking.ts
```

**Tasks:**
- [ ] 7.5.1 Set up Expo notifications
- [ ] 7.5.2 Implement push token registration
- [ ] 7.5.3 Create notification handlers
- [ ] 7.5.4 Build deep linking

### 7.6 Performance Optimization
**Tasks:**
- [ ] 7.6.1 Implement code splitting
- [ ] 7.6.2 Optimize list rendering (FlashList)
- [ ] 7.6.3 Configure image compression
- [ ] 7.6.4 Profile and optimize cold start
- [ ] 7.6.5 Target < 4s cold start on Samsung A10

---

## PHASE 8: VOICE AI PROCESSING
**Duration:** Weeks 16-17
**Team:** 1 Backend Engineer (ML experience)

### 8.1 Voice AI Core
```
Location: /src/integrations/voice-ai/
Files to create:
├── voice-ai.service.ts
├── transcription/
│   ├── whisper.client.ts
│   └── preprocessing.ts
├── extraction/
│   ├── gpt-extractor.ts
│   ├── prompts/
│   └── confidence-scorer.ts
├── routing/
│   └── confidence-router.ts
└── voice-ai.types.ts
```

**Tasks:**
- [ ] 8.1.1 Implement Whisper integration
- [ ] 8.1.2 Create audio preprocessing
- [ ] 8.1.3 Build GPT-4o extraction prompts
- [ ] 8.1.4 Implement per-field confidence scoring
- [ ] 8.1.5 Create confidence-based routing
- [ ] 8.1.6 Implement confirmation flow (medium confidence)

### 8.2 Voice AI Worker
```
Location: /src/workers/voice/
Files to create:
├── voice-processing.worker.ts
├── audio-downloader.ts
└── voice-fallback.handler.ts
```

**Tasks:**
- [ ] 8.2.1 Create voice processing worker
- [ ] 8.2.2 Implement audio download from WhatsApp
- [ ] 8.2.3 Build human review queue routing
- [ ] 8.2.4 Create fallback handling

### 8.3 Voice AI Review UI
```
Files to create:
├── app/(dashboard)/voice-review/
│   ├── page.tsx
│   └── [id]/page.tsx
```

**Tasks:**
- [ ] 8.3.1 Build human review queue page
- [ ] 8.3.2 Create audio player component
- [ ] 8.3.3 Build edit & create flow
- [ ] 8.3.4 Implement feedback collection for training

---

## PHASE 9: OBSERVABILITY & HARDENING
**Duration:** Week 18
**Team:** 1 DevOps Engineer, 1 Backend Engineer

### 9.1 Monitoring Setup
```
Location: /infrastructure/monitoring/
Files to create:
├── prometheus/
│   └── alerts.yml
├── grafana/
│   └── dashboards/
└── sentry/
    └── config.ts
```

**Tasks:**
- [ ] 9.1.1 Set up Prometheus metrics collection
- [ ] 9.1.2 Create Grafana dashboards per spec
- [ ] 9.1.3 Configure Sentry error tracking
- [ ] 9.1.4 Set up alerting per severity levels

### 9.2 Health Checks
```
Files to create:
├── src/health/
│   ├── health.controller.ts
│   ├── readiness.check.ts
│   └── liveness.check.ts
```

**Tasks:**
- [ ] 9.2.1 Implement /health endpoint
- [ ] 9.2.2 Create /health/ready (DB, Redis)
- [ ] 9.2.3 Build /health/live (all dependencies)

### 9.3 CI/CD Pipeline
```
Files to create:
├── .github/workflows/
│   ├── ci.yml
│   ├── deploy-staging.yml
│   └── deploy-production.yml
```

**Tasks:**
- [ ] 9.3.1 Create CI pipeline (lint, test, build)
- [ ] 9.3.2 Set up staging deployment
- [ ] 9.3.3 Create production deployment with approval gate
- [ ] 9.3.4 Implement blue-green deployment
- [ ] 9.3.5 Set up rollback mechanisms

### 9.4 Security Hardening
**Tasks:**
- [ ] 9.4.1 Security audit all endpoints
- [ ] 9.4.2 Verify RLS policies
- [ ] 9.4.3 Test rate limiting
- [ ] 9.4.4 Verify encryption at rest
- [ ] 9.4.5 Penetration testing (basic)

### 9.5 Load Testing
**Tasks:**
- [ ] 9.5.1 Create load test scenarios
- [ ] 9.5.2 Test 10K concurrent users
- [ ] 9.5.3 Verify queue scaling
- [ ] 9.5.4 Document capacity limits

---

## PHASE 9.5: EMPLOYEE ONBOARDING & VERIFICATION
**Duration:** Week 19 (1 week)
**Team:** 1 Backend Engineer, 1 Frontend Engineer
**Priority:** High - Critical for security and compliance

### 9.5.1 Employee SMS Verification System
```
Location: /src/modules/users/onboarding/
Files to create:
├── employee-verification.service.ts
├── onboarding-workflow.ts
├── verification-token.service.ts
├── onboarding.types.ts
└── onboarding.controller.ts
```

**Tasks:**
- [ ] 9.5.1.1 Create employee verification token generation (6-digit code, 15min expiry)
- [ ] 9.5.1.2 Implement verification SMS sending via Twilio
- [ ] 9.5.1.3 Build verification code validation endpoint
- [ ] 9.5.1.4 Add `isVerified` flag to User model (default: false for new employees)
- [ ] 9.5.1.5 Enforce verification before first login
- [ ] 9.5.1.6 Implement verification retry limits (3 attempts, then 1h cooldown)
- [ ] 9.5.1.7 Create resend verification code endpoint
- [ ] 9.5.1.8 Add verification status to user API responses

### 9.5.2 Employee Onboarding Workflow
```
Location: /src/modules/users/onboarding/
Files to create:
├── welcome-message.service.ts
├── onboarding-checklist.ts
└── first-login-handler.ts
```

**Tasks:**
- [ ] 9.5.2.1 Create customizable welcome SMS/WhatsApp message
- [ ] 9.5.2.2 Implement onboarding checklist for new employees:
  - Verify phone number
  - Accept terms & conditions
  - Set profile photo (optional)
  - Complete first job tutorial (mobile)
- [ ] 9.5.2.3 Create first login detection and onboarding flow trigger
- [ ] 9.5.2.4 Build admin notification on employee verification completion
- [ ] 9.5.2.5 Implement onboarding progress tracking

### 9.5.3 Admin Onboarding Management UI
```
Files to create:
├── app/(dashboard)/settings/team/onboarding/
│   ├── page.tsx (Pending Verifications)
│   └── templates/page.tsx (Welcome Message Templates)
├── components/team/
│   ├── PendingVerifications.tsx
│   ├── VerificationStatus.tsx
│   └── ResendVerification.tsx
```

**Tasks:**
- [ ] 9.5.3.1 Build pending verifications list in team settings
- [ ] 9.5.3.2 Create verification status indicators
- [ ] 9.5.3.3 Implement manual verification trigger (for admin use)
- [ ] 9.5.3.4 Build welcome message template editor
- [ ] 9.5.3.5 Create verification analytics (time to verify, completion rate)

### 9.5.4 Mobile Onboarding Experience
```
Files to create (mobile):
├── app/(auth)/verify/
│   ├── page.tsx
│   └── success.tsx
├── app/(onboarding)/
│   ├── layout.tsx
│   ├── welcome.tsx
│   ├── terms.tsx
│   ├── profile.tsx
│   └── tutorial.tsx
├── components/onboarding/
│   ├── OnboardingProgress.tsx
│   ├── TermsAcceptance.tsx
│   └── TutorialSteps.tsx
```

**Tasks:**
- [ ] 9.5.4.1 Build verification code entry screen
- [ ] 9.5.4.2 Create terms & conditions acceptance flow
- [ ] 9.5.4.3 Build profile completion screen
- [ ] 9.5.4.4 Implement interactive app tutorial
- [ ] 9.5.4.5 Add skip tutorial option for experienced users

---

## PHASE 9.6: NOTIFICATION PREFERENCES SYSTEM
**Duration:** Weeks 19-20 (2 weeks, overlaps with Phase 9.5)
**Team:** 1 Backend Engineer, 1 Frontend Engineer, 1 Mobile Engineer
**Priority:** High - Essential for user engagement and retention

### 9.6.1 Notification Preferences Database Schema
```
Location: /database/migrations/
Files to create:
├── 015_create_notification_preferences.sql
├── 016_create_notification_templates.sql
├── 017_create_notification_logs.sql
└── 018_create_scheduled_reminders.sql
```

**Database Schema:**
```sql
-- User notification preferences
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Channel preferences
    web_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    email_enabled BOOLEAN DEFAULT true,
    whatsapp_enabled BOOLEAN DEFAULT false,

    -- Event type preferences (JSON for flexibility)
    event_preferences JSONB DEFAULT '{
        "job_assigned": {"web": true, "push": true, "email": false},
        "job_reminder": {"web": true, "push": true, "sms": false},
        "job_completed": {"web": true, "push": false, "email": true},
        "invoice_created": {"web": true, "push": false, "email": true},
        "payment_received": {"web": true, "push": true, "email": true},
        "team_member_added": {"web": true, "push": false, "email": true},
        "system_alert": {"web": true, "push": true, "email": true}
    }',

    -- Reminder timing preferences (minutes before)
    reminder_intervals JSONB DEFAULT '[1440, 60, 30]', -- 24h, 1h, 30min

    -- Quiet hours (don't disturb)
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '08:00',
    quiet_hours_timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id)
);

-- Notification event types
CREATE TYPE notification_event_type AS ENUM (
    'job_assigned',
    'job_updated',
    'job_reminder',
    'job_completed',
    'job_cancelled',
    'invoice_created',
    'invoice_sent',
    'payment_received',
    'payment_failed',
    'team_member_added',
    'team_member_removed',
    'sync_conflict',
    'system_alert',
    'custom'
);

-- Notification delivery channel
CREATE TYPE notification_channel AS ENUM (
    'web',
    'push',
    'sms',
    'email',
    'whatsapp'
);
```

**Tasks:**
- [ ] 9.6.1.1 Create notification_preferences table
- [ ] 9.6.1.2 Create notification_logs table for delivery tracking
- [ ] 9.6.1.3 Create scheduled_reminders table for job reminders
- [ ] 9.6.1.4 Add default preferences on user creation
- [ ] 9.6.1.5 Create indexes for efficient queries

### 9.6.2 Notification Service
```
Location: /src/modules/notifications/
Files to create:
├── notification.service.ts
├── notification.repository.ts
├── notification.controller.ts
├── notification.routes.ts
├── preferences.service.ts
├── delivery/
│   ├── delivery-orchestrator.ts
│   ├── web-push.service.ts
│   ├── email.service.ts
│   ├── sms.service.ts
│   └── whatsapp-notification.service.ts
├── reminders/
│   ├── reminder-scheduler.ts
│   ├── reminder.worker.ts
│   └── reminder.types.ts
└── notification.types.ts
```

**Tasks:**
- [ ] 9.6.2.1 Implement notification preferences CRUD API
- [ ] 9.6.2.2 Create notification delivery orchestrator (routes to channels based on preferences)
- [ ] 9.6.2.3 Implement web push notifications (browser notifications API)
- [ ] 9.6.2.4 Create email notification delivery via Resend/SendGrid
- [ ] 9.6.2.5 Implement SMS notification via Twilio
- [ ] 9.6.2.6 Create WhatsApp notification via existing integration
- [ ] 9.6.2.7 Build quiet hours enforcement
- [ ] 9.6.2.8 Implement notification logging and delivery status tracking

### 9.6.3 Job Reminder System
```
Location: /src/modules/notifications/reminders/
Files to create:
├── reminder-scheduler.ts
├── reminder-calculator.ts
├── reminder.worker.ts
└── reminder.types.ts
```

**Default Reminder Schedule:**
- **24 hours before** (day before) - Email/Web notification
- **1 hour before** - Push notification + optional SMS
- **30 minutes before** - Push notification (high priority)

**Tasks:**
- [ ] 9.6.3.1 Create reminder scheduling service (on job creation/update)
- [ ] 9.6.3.2 Implement configurable reminder intervals per user
- [ ] 9.6.3.3 Build reminder worker (processes scheduled reminders)
- [ ] 9.6.3.4 Handle job time changes (reschedule reminders)
- [ ] 9.6.3.5 Handle job cancellation (cancel reminders)
- [ ] 9.6.3.6 Implement batch reminder processing for efficiency
- [ ] 9.6.3.7 Create reminder delivery with escalation (if not acknowledged)

### 9.6.4 Real-Time Web Notifications
```
Location: /src/modules/notifications/websocket/
Files to create:
├── notification-socket.ts
├── socket-manager.ts
├── connection-tracker.ts
└── broadcast.service.ts
```

**Tasks:**
- [ ] 9.6.4.1 Implement WebSocket connection for real-time notifications
- [ ] 9.6.4.2 Create browser notification API integration
- [ ] 9.6.4.3 Build notification center component (bell icon with dropdown)
- [ ] 9.6.4.4 Implement notification read/unread status
- [ ] 9.6.4.5 Create notification badge count
- [ ] 9.6.4.6 Build notification history page
- [ ] 9.6.4.7 Implement notification actions (mark all as read, clear)

### 9.6.5 Notification Preferences UI (Web)
```
Files to create:
├── app/(dashboard)/settings/notifications/
│   ├── page.tsx (Notification Settings)
│   └── history/page.tsx (Notification History)
├── components/notifications/
│   ├── NotificationCenter.tsx
│   ├── NotificationBell.tsx
│   ├── NotificationDropdown.tsx
│   ├── NotificationItem.tsx
│   ├── NotificationPreferencesForm.tsx
│   ├── ChannelToggle.tsx
│   ├── EventTypeSettings.tsx
│   ├── ReminderIntervalPicker.tsx
│   └── QuietHoursSettings.tsx
```

**Tasks:**
- [ ] 9.6.5.1 Build notification settings page with channel toggles
- [ ] 9.6.5.2 Create event type configuration matrix
- [ ] 9.6.5.3 Implement reminder interval customization
- [ ] 9.6.5.4 Build quiet hours configuration
- [ ] 9.6.5.5 Create notification center (bell icon) in header
- [ ] 9.6.5.6 Build notification dropdown with recent notifications
- [ ] 9.6.5.7 Create notification history page with filters
- [ ] 9.6.5.8 Implement test notification button

### 9.6.6 Mobile Notification Enhancements
```
Files to create (mobile):
├── app/(tabs)/notifications/
│   └── index.tsx (Notification History)
├── app/settings/notifications/
│   └── page.tsx (Notification Preferences)
├── components/notifications/
│   ├── NotificationList.tsx
│   ├── NotificationCard.tsx
│   └── NotificationPreferences.tsx
├── lib/notifications/
│   ├── reminder-manager.ts
│   └── notification-sync.ts
```

**Tasks:**
- [ ] 9.6.6.1 Enhance push notification with multiple reminder intervals
- [ ] 9.6.6.2 Build notification history screen
- [ ] 9.6.6.3 Create notification preferences screen
- [ ] 9.6.6.4 Implement notification sync with server
- [ ] 9.6.6.5 Add notification actions (quick reply, mark complete)
- [ ] 9.6.6.6 Handle notification grouping for multiple job reminders

### 9.6.7 Organization-Level Notification Defaults
```
Location: /src/modules/organizations/notifications/
Files to create:
├── org-notification-defaults.service.ts
├── notification-policy.ts
└── mandatory-notifications.ts
```

**Tasks:**
- [ ] 9.6.7.1 Create organization-level notification defaults
- [ ] 9.6.7.2 Implement role-based notification policies:
  - Owners/Admins: All notifications by default
  - Dispatchers: Job assignments, completions, customer messages
  - Technicians: Job assignments, reminders, schedule changes
  - Viewers: Read-only summaries
- [ ] 9.6.7.3 Build mandatory notification types (cannot be disabled)
- [ ] 9.6.7.4 Create notification policy management UI for admins
- [ ] 9.6.7.5 Implement notification override hierarchy (org → role → user)

---

## POST-MVP ROADMAP

---

## PHASE 10: ADVANCED ANALYTICS & REPORTING
**Duration:** Weeks 21-23
**Team:** 1 Backend Engineer, 1 Frontend Engineer, 1 Data Engineer

### 10.1 Analytics Data Infrastructure
```
Location: /src/analytics/
Files to create:
├── infrastructure/
│   ├── data-warehouse.ts
│   ├── etl-pipeline.ts
│   ├── materialized-views.sql
│   └── aggregation-jobs.ts
├── collectors/
│   ├── event-collector.ts
│   ├── metrics-aggregator.ts
│   └── time-series-storage.ts
├── models/
│   ├── kpi-definitions.ts
│   ├── dimension-tables.ts
│   └── fact-tables.ts
└── analytics.types.ts
```

**Tasks:**
- [ ] 10.1.1 Design star schema for analytics (fact tables: jobs, invoices, payments)
- [ ] 10.1.2 Create dimension tables (time, customers, technicians, services, locations)
- [ ] 10.1.3 Implement ETL pipeline for real-time aggregation
- [ ] 10.1.4 Create materialized views for common queries
- [ ] 10.1.5 Set up time-series storage for trend analysis
- [ ] 10.1.6 Implement data retention policies (raw: 90 days, aggregated: 3 years)

### 10.2 Business Intelligence KPIs
```
Location: /src/analytics/kpis/
Files to create:
├── revenue/
│   ├── revenue-metrics.ts
│   ├── mrr-calculator.ts
│   ├── arpu-calculator.ts
│   └── churn-analyzer.ts
├── operations/
│   ├── job-metrics.ts
│   ├── technician-efficiency.ts
│   ├── completion-rates.ts
│   └── sla-compliance.ts
├── financial/
│   ├── cash-flow-analyzer.ts
│   ├── accounts-receivable.ts
│   ├── profitability-calculator.ts
│   └── tax-summary.ts
└── customers/
    ├── customer-lifetime-value.ts
    ├── retention-analyzer.ts
    ├── satisfaction-scorer.ts
    └── segment-analyzer.ts
```

**Tasks:**
- [ ] 10.2.1 Implement revenue KPIs (MRR, ARR, ARPU, revenue by service type)
- [ ] 10.2.2 Create operational KPIs (jobs/day, completion rate, avg. time on site)
- [ ] 10.2.3 Build technician efficiency metrics (jobs/tech, avg. completion time, ratings)
- [ ] 10.2.4 Implement financial KPIs (gross margin, collection rate, days sales outstanding)
- [ ] 10.2.5 Create customer KPIs (CLV, retention rate, repeat customer rate)
- [ ] 10.2.6 Build SLA compliance tracking (on-time arrivals, resolution time)

### 10.3 Report Generation Engine
```
Location: /src/analytics/reports/
Files to create:
├── engine/
│   ├── report-builder.ts
│   ├── report-scheduler.ts
│   ├── report-exporter.ts
│   └── template-engine.ts
├── templates/
│   ├── daily-summary.template.ts
│   ├── weekly-performance.template.ts
│   ├── monthly-financial.template.ts
│   ├── tax-report.template.ts
│   └── custom-report.template.ts
├── exporters/
│   ├── pdf-exporter.ts
│   ├── excel-exporter.ts
│   ├── csv-exporter.ts
│   └── email-sender.ts
└── scheduling/
    ├── cron-jobs.ts
    └── delivery-queue.ts
```

**Tasks:**
- [ ] 10.3.1 Create report template engine with dynamic filters
- [ ] 10.3.2 Implement PDF report generation (with charts)
- [ ] 10.3.3 Build Excel export with multiple sheets and formulas
- [ ] 10.3.4 Create CSV export for data portability
- [ ] 10.3.5 Implement scheduled report delivery (daily, weekly, monthly)
- [ ] 10.3.6 Build email delivery system with branded templates
- [ ] 10.3.7 Create AFIP-compliant tax reports (Libro IVA Digital)

### 10.4 Analytics Dashboard UI
```
Files to create:
├── app/(dashboard)/analytics/
│   ├── page.tsx (Overview)
│   ├── revenue/page.tsx
│   ├── operations/page.tsx
│   ├── technicians/page.tsx
│   ├── customers/page.tsx
│   └── reports/
│       ├── page.tsx (Report Builder)
│       ├── scheduled/page.tsx
│       └── history/page.tsx
├── components/analytics/
│   ├── charts/
│   │   ├── LineChart.tsx
│   │   ├── BarChart.tsx
│   │   ├── PieChart.tsx
│   │   ├── HeatMap.tsx
│   │   └── Sparkline.tsx
│   ├── widgets/
│   │   ├── KPICard.tsx
│   │   ├── TrendIndicator.tsx
│   │   ├── ComparisonWidget.tsx
│   │   └── LeaderBoard.tsx
│   └── filters/
│       ├── DateRangePicker.tsx
│       ├── TechnicianFilter.tsx
│       └── ServiceTypeFilter.tsx
```

**Tasks:**
- [ ] 10.4.1 Build analytics overview dashboard with key metrics
- [ ] 10.4.2 Create revenue analytics page (trends, forecasts, comparisons)
- [ ] 10.4.3 Build operations dashboard (job funnel, geographic heatmap)
- [ ] 10.4.4 Create technician leaderboard and performance dashboard
- [ ] 10.4.5 Build customer analytics (segments, cohorts, CLV distribution)
- [ ] 10.4.6 Implement custom report builder with drag-and-drop
- [ ] 10.4.7 Create scheduled reports management UI
- [ ] 10.4.8 Implement data export functionality from all dashboards

### 10.5 Predictive Analytics (Basic)
```
Location: /src/analytics/predictions/
Files to create:
├── demand-forecasting.ts
├── churn-prediction.ts
├── revenue-projection.ts
└── anomaly-detection.ts
```

**Tasks:**
- [ ] 10.5.1 Implement basic demand forecasting (seasonal patterns)
- [ ] 10.5.2 Create revenue projection model (linear regression)
- [ ] 10.5.3 Build simple churn risk scoring
- [ ] 10.5.4 Implement anomaly detection for unusual patterns (fraud, errors)

---

## PHASE 11: MULTI-LOCATION SUPPORT
**Duration:** Weeks 22-24
**Team:** 2 Backend Engineers, 1 Frontend Engineer

### 11.1 Database Schema Extensions
```
Location: /database/migrations/
Files to create:
├── 020_create_locations.sql
├── 021_add_location_to_jobs.sql
├── 022_create_location_settings.sql
├── 023_create_inter_location_transfers.sql
├── 024_add_location_afip_config.sql
└── 025_update_rls_for_locations.sql
```

**Tasks:**
- [ ] 11.1.1 Design location hierarchy (Organization → Locations → Zones)
- [ ] 11.1.2 Create locations table with geographic boundaries
- [ ] 11.1.3 Add location_id to jobs, users, customers, invoices
- [ ] 11.1.4 Create location-specific settings table
- [ ] 11.1.5 Implement per-location AFIP punto de venta
- [ ] 11.1.6 Update RLS policies for location-based access

### 11.2 Location Service
```
Location: /src/modules/locations/
Files to create:
├── location.service.ts
├── location.repository.ts
├── location.controller.ts
├── location.routes.ts
├── location.validation.ts
├── zone-manager.ts
├── coverage-calculator.ts
└── location.types.ts
```

**Tasks:**
- [ ] 11.2.1 Implement location CRUD operations
- [ ] 11.2.2 Create zone management (service areas)
- [ ] 11.2.3 Build coverage area calculator (polygon/radius)
- [ ] 11.2.4 Implement location-based pricing variations
- [ ] 11.2.5 Create automatic job assignment by location/zone
- [ ] 11.2.6 Build API endpoints for location management

### 11.3 Multi-Location Billing & Invoicing
```
Location: /src/modules/locations/billing/
Files to create:
├── location-invoice-router.ts
├── punto-venta-manager.ts
├── consolidated-billing.ts
└── inter-location-charges.ts
```

**Tasks:**
- [ ] 11.3.1 Implement per-location punto de venta for AFIP
- [ ] 11.3.2 Create automatic invoice routing by service location
- [ ] 11.3.3 Build consolidated invoice generation (multi-location)
- [ ] 11.3.4 Implement inter-location charge transfers
- [ ] 11.3.5 Create location-specific numbering sequences

### 11.4 Team & Resource Management
```
Location: /src/modules/locations/resources/
Files to create:
├── location-assignment.service.ts
├── resource-sharing.ts
├── capacity-manager.ts
└── inter-location-dispatch.ts
```

**Tasks:**
- [ ] 11.4.1 Implement technician home location assignment
- [ ] 11.4.2 Create resource sharing between locations
- [ ] 11.4.3 Build capacity planning per location
- [ ] 11.4.4 Implement cross-location job dispatch
- [ ] 11.4.5 Create travel time estimation between locations

### 11.5 Multi-Location UI
```
Files to create:
├── app/(dashboard)/locations/
│   ├── page.tsx (Location List)
│   ├── [id]/
│   │   ├── page.tsx (Location Detail)
│   │   ├── settings/page.tsx
│   │   ├── team/page.tsx
│   │   └── zones/page.tsx
│   └── new/page.tsx
├── components/locations/
│   ├── LocationSelector.tsx
│   ├── ZoneMap.tsx
│   ├── CoverageEditor.tsx
│   └── LocationSwitcher.tsx
```

**Tasks:**
- [ ] 11.5.1 Build location management page
- [ ] 11.5.2 Create zone editor with map interface
- [ ] 11.5.3 Implement location switcher in header
- [ ] 11.5.4 Build per-location dashboard views
- [ ] 11.5.5 Create cross-location reporting
- [ ] 11.5.6 Build location-based team management

### 11.6 Location Analytics
```
Location: /src/analytics/locations/
Files to create:
├── location-performance.ts
├── geographic-analytics.ts
├── location-comparison.ts
└── expansion-analyzer.ts
```

**Tasks:**
- [ ] 11.6.1 Implement per-location KPIs
- [ ] 11.6.2 Build location comparison reports
- [ ] 11.6.3 Create geographic performance heatmaps
- [ ] 11.6.4 Implement expansion opportunity analysis

---

## PHASE 12: INVENTORY MANAGEMENT
**Duration:** Weeks 25-28
**Team:** 2 Backend Engineers, 1 Frontend Engineer, 1 Mobile Engineer

### 12.1 Inventory Database Schema
```
Location: /database/migrations/
Files to create:
├── 030_create_products.sql
├── 031_create_warehouses.sql
├── 032_create_inventory_levels.sql
├── 033_create_stock_movements.sql
├── 034_create_purchase_orders.sql
├── 035_create_suppliers.sql
├── 036_create_inventory_counts.sql
└── 037_create_vehicle_inventory.sql
```

**Tasks:**
- [ ] 12.1.1 Design product catalog schema (SKU, barcode, category, unit)
- [ ] 12.1.2 Create warehouse/storage location tables
- [ ] 12.1.3 Implement inventory levels with lot tracking
- [ ] 12.1.4 Create stock movement ledger (immutable)
- [ ] 12.1.5 Design purchase order workflow tables
- [ ] 12.1.6 Create supplier management tables
- [ ] 12.1.7 Implement vehicle inventory (mobile stock per technician)

### 12.2 Product Catalog Service
```
Location: /src/modules/inventory/products/
Files to create:
├── product.service.ts
├── product.repository.ts
├── product.controller.ts
├── product.routes.ts
├── category-manager.ts
├── barcode-generator.ts
└── product.types.ts
```

**Tasks:**
- [ ] 12.2.1 Implement product CRUD operations
- [ ] 12.2.2 Create category hierarchy management
- [ ] 12.2.3 Build barcode/SKU generation
- [ ] 12.2.4 Implement product variants (size, color)
- [ ] 12.2.5 Create product pricing (cost, margin, sale price)
- [ ] 12.2.6 Link products to price book items

### 12.3 Stock Management Service
```
Location: /src/modules/inventory/stock/
Files to create:
├── stock.service.ts
├── stock.repository.ts
├── stock-movement.service.ts
├── reservation.service.ts
├── reorder-point.calculator.ts
├── fifo-calculator.ts
└── stock.types.ts
```

**Tasks:**
- [ ] 12.3.1 Implement real-time stock level tracking
- [ ] 12.3.2 Create stock movement recording (in, out, transfer, adjustment)
- [ ] 12.3.3 Build stock reservation for jobs
- [ ] 12.3.4 Implement FIFO/LIFO cost calculation
- [ ] 12.3.5 Create reorder point automation
- [ ] 12.3.6 Build low stock alerts
- [ ] 12.3.7 Implement stock valuation reports

### 12.4 Purchase Order Service
```
Location: /src/modules/inventory/purchasing/
Files to create:
├── purchase-order.service.ts
├── purchase-order.repository.ts
├── purchase-order.controller.ts
├── supplier.service.ts
├── receiving.service.ts
├── po-state-machine.ts
└── purchasing.types.ts
```

**Tasks:**
- [ ] 12.4.1 Implement supplier management
- [ ] 12.4.2 Create purchase order workflow (draft → sent → partial → received)
- [ ] 12.4.3 Build receiving workflow with variance handling
- [ ] 12.4.4 Implement automatic PO generation from reorder points
- [ ] 12.4.5 Create supplier price lists
- [ ] 12.4.6 Build purchase order reporting

### 12.5 Vehicle/Technician Inventory
```
Location: /src/modules/inventory/vehicle/
Files to create:
├── vehicle-inventory.service.ts
├── vehicle-stock.repository.ts
├── replenishment.service.ts
├── usage-tracker.ts
└── vehicle-transfer.service.ts
```

**Tasks:**
- [ ] 12.5.1 Implement per-technician mobile stock
- [ ] 12.5.2 Create stock transfer to/from vehicles
- [ ] 12.5.3 Build automatic usage deduction on job completion
- [ ] 12.5.4 Implement replenishment requests
- [ ] 12.5.5 Create vehicle inventory auditing

### 12.6 Job-Inventory Integration
```
Location: /src/modules/jobs/inventory/
Files to create:
├── job-materials.service.ts
├── material-reservation.ts
├── usage-recording.ts
└── costing.service.ts
```

**Tasks:**
- [ ] 12.6.1 Add materials/parts to job workflow
- [ ] 12.6.2 Implement material reservation on job creation
- [ ] 12.6.3 Create usage recording during job completion
- [ ] 12.6.4 Build job costing with materials
- [ ] 12.6.5 Implement automatic invoice line items from materials

### 12.7 Inventory UI (Web)
```
Files to create:
├── app/(dashboard)/inventory/
│   ├── page.tsx (Overview)
│   ├── products/
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx
│   │   └── new/page.tsx
│   ├── stock/
│   │   ├── page.tsx
│   │   ├── movements/page.tsx
│   │   └── adjustments/page.tsx
│   ├── warehouses/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── purchasing/
│   │   ├── page.tsx
│   │   ├── orders/[id]/page.tsx
│   │   └── suppliers/page.tsx
│   └── vehicles/page.tsx
├── components/inventory/
│   ├── ProductCard.tsx
│   ├── StockLevelIndicator.tsx
│   ├── MovementHistory.tsx
│   ├── BarcodeScanner.tsx
│   └── WarehouseSelector.tsx
```

**Tasks:**
- [ ] 12.7.1 Build inventory dashboard with stock alerts
- [ ] 12.7.2 Create product catalog management UI
- [ ] 12.7.3 Build stock level viewer with history
- [ ] 12.7.4 Create stock adjustment interface
- [ ] 12.7.5 Build purchase order management UI
- [ ] 12.7.6 Create supplier management page
- [ ] 12.7.7 Build vehicle inventory tracking page
- [ ] 12.7.8 Implement barcode scanning support

### 12.8 Mobile Inventory Features
```
Files to create (mobile):
├── app/(tabs)/inventory/
│   ├── index.tsx
│   ├── scan.tsx
│   ├── request.tsx
│   └── usage.tsx
├── components/inventory/
│   ├── InventoryList.tsx
│   ├── BarcodeScanner.tsx
│   ├── UsageForm.tsx
│   └── ReplenishmentRequest.tsx
```

**Tasks:**
- [ ] 12.8.1 Build technician vehicle inventory view
- [ ] 12.8.2 Implement barcode scanning for usage
- [ ] 12.8.3 Create replenishment request flow
- [ ] 12.8.4 Add materials selection to job completion
- [ ] 12.8.5 Implement offline inventory with sync

---

## PHASE 13: CUSTOMER SELF-SERVICE PORTAL
**Duration:** Weeks 29-32
**Team:** 2 Frontend Engineers, 1 Backend Engineer

### 13.1 Customer Authentication System
```
Location: /src/modules/customer-portal/auth/
Files to create:
├── customer-auth.service.ts
├── magic-link.service.ts
├── customer-session.service.ts
├── customer-otp.service.ts
└── customer-auth.types.ts
```

**Tasks:**
- [ ] 13.1.1 Implement customer authentication (separate from internal users)
- [ ] 13.1.2 Create magic link login flow (email-based)
- [ ] 13.1.3 Implement phone OTP as secondary option
- [ ] 13.1.4 Create customer session management
- [ ] 13.1.5 Build account linking (phone → email)
- [ ] 13.1.6 Implement "Login as customer" for support

### 13.2 Customer Portal Backend
```
Location: /src/modules/customer-portal/
Files to create:
├── portal.service.ts
├── portal.controller.ts
├── portal.routes.ts
├── booking/
│   ├── booking.service.ts
│   ├── availability.service.ts
│   └── booking-rules.ts
├── history/
│   ├── job-history.service.ts
│   └── invoice-history.service.ts
├── payments/
│   ├── customer-payments.service.ts
│   └── payment-methods.service.ts
└── communication/
    ├── ticket.service.ts
    └── feedback.service.ts
```

**Tasks:**
- [ ] 13.2.1 Create customer-facing API endpoints (limited scope)
- [ ] 13.2.2 Implement job booking/request flow
- [ ] 13.2.3 Build availability checking service
- [ ] 13.2.4 Create booking rules engine (service types, locations, times)
- [ ] 13.2.5 Implement job history viewing
- [ ] 13.2.6 Create invoice viewing and PDF download
- [ ] 13.2.7 Build online payment flow
- [ ] 13.2.8 Create support ticket system
- [ ] 13.2.9 Implement feedback/rating submission

### 13.3 Customer Portal Web App
```
Location: /apps/customer-portal/
Files to create:
├── app/
│   ├── layout.tsx
│   ├── page.tsx (Landing/Login)
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── verify/page.tsx
│   ├── (portal)/
│   │   ├── layout.tsx
│   │   ├── page.tsx (Dashboard)
│   │   ├── book/
│   │   │   ├── page.tsx
│   │   │   ├── service/page.tsx
│   │   │   ├── datetime/page.tsx
│   │   │   └── confirm/page.tsx
│   │   ├── jobs/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── invoices/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── payments/
│   │   │   ├── page.tsx
│   │   │   └── pay/[invoiceId]/page.tsx
│   │   ├── support/
│   │   │   ├── page.tsx
│   │   │   └── [ticketId]/page.tsx
│   │   └── profile/page.tsx
│   └── api/
├── components/
│   ├── ui/
│   ├── booking/
│   │   ├── ServiceSelector.tsx
│   │   ├── DateTimePicker.tsx
│   │   ├── AddressForm.tsx
│   │   └── BookingSummary.tsx
│   ├── jobs/
│   │   ├── JobCard.tsx
│   │   ├── JobTimeline.tsx
│   │   └── TechnicianInfo.tsx
│   └── payments/
│       ├── PaymentForm.tsx
│       └── PaymentHistory.tsx
└── lib/
    ├── customer-api.ts
    └── customer-auth.tsx
```

**Tasks:**
- [ ] 13.3.1 Set up separate Next.js app for customer portal
- [ ] 13.3.2 Build login/authentication pages
- [ ] 13.3.3 Create customer dashboard (upcoming jobs, recent invoices)
- [ ] 13.3.4 Build multi-step booking flow
- [ ] 13.3.5 Create service selection with pricing
- [ ] 13.3.6 Implement date/time slot picker
- [ ] 13.3.7 Build job history and detail pages
- [ ] 13.3.8 Create invoice viewing with PDF download
- [ ] 13.3.9 Implement online payment flow (MercadoPago)
- [ ] 13.3.10 Build support ticket creation and tracking
- [ ] 13.3.11 Create profile management page
- [ ] 13.3.12 Implement job rating/feedback flow

### 13.4 Real-Time Job Tracking
```
Location: /src/modules/customer-portal/tracking/
Files to create:
├── tracking.service.ts
├── eta-calculator.ts
├── websocket-handler.ts
└── notification-preferences.ts
```

**Tasks:**
- [ ] 13.4.1 Implement real-time job status updates (WebSocket)
- [ ] 13.4.2 Create ETA calculation and updates
- [ ] 13.4.3 Build technician location sharing (with privacy controls)
- [ ] 13.4.4 Implement push notifications for customers
- [ ] 13.4.5 Create notification preference management

### 13.5 Customer Portal UI (Tracking Page)
```
Files to create:
├── app/(portal)/track/[jobId]/page.tsx
├── components/tracking/
│   ├── LiveMap.tsx
│   ├── ETADisplay.tsx
│   ├── StatusTimeline.tsx
│   └── TechnicianCard.tsx
```

**Tasks:**
- [ ] 13.5.1 Build live tracking page with map
- [ ] 13.5.2 Create ETA display with real-time updates
- [ ] 13.5.3 Implement status timeline visualization
- [ ] 13.5.4 Build technician profile card

### 13.6 White-Label Configuration
```
Location: /src/modules/customer-portal/branding/
Files to create:
├── branding.service.ts
├── theme-generator.ts
└── domain-router.ts
```

**Tasks:**
- [ ] 13.6.1 Implement per-organization branding (logo, colors)
- [ ] 13.6.2 Create custom domain support
- [ ] 13.6.3 Build theme configuration UI (admin portal)
- [ ] 13.6.4 Implement email template customization

---

## PHASE 14: API FOR THIRD-PARTY INTEGRATIONS
**Duration:** Weeks 33-36
**Team:** 2 Backend Engineers, 1 Technical Writer

### 14.1 Public API Design
```
Location: /src/api/public/
Files to create:
├── v1/
│   ├── router.ts
│   ├── customers/
│   │   ├── customers.controller.ts
│   │   └── customers.schema.ts
│   ├── jobs/
│   │   ├── jobs.controller.ts
│   │   └── jobs.schema.ts
│   ├── invoices/
│   │   ├── invoices.controller.ts
│   │   └── invoices.schema.ts
│   ├── payments/
│   │   ├── payments.controller.ts
│   │   └── payments.schema.ts
│   └── webhooks/
│       ├── webhooks.controller.ts
│       └── webhook-events.ts
├── middleware/
│   ├── api-key.middleware.ts
│   ├── oauth.middleware.ts
│   ├── rate-limit.middleware.ts
│   ├── scope-check.middleware.ts
│   └── api-versioning.middleware.ts
└── public-api.types.ts
```

**Tasks:**
- [ ] 14.1.1 Design RESTful API following OpenAPI 3.0 spec
- [ ] 14.1.2 Define API versioning strategy (URL-based: /v1/)
- [ ] 14.1.3 Create resource endpoints (customers, jobs, invoices, payments)
- [ ] 14.1.4 Implement pagination (cursor-based)
- [ ] 14.1.5 Design webhook event system
- [ ] 14.1.6 Create rate limiting per API key

### 14.2 API Authentication & Authorization
```
Location: /src/api/public/auth/
Files to create:
├── api-key.service.ts
├── oauth-server.ts
├── oauth-clients.service.ts
├── scopes.ts
├── token-introspection.ts
└── api-auth.types.ts
```

**Tasks:**
- [ ] 14.2.1 Implement API key authentication
- [ ] 14.2.2 Create API key management (generate, revoke, rotate)
- [ ] 14.2.3 Build OAuth 2.0 server (authorization code + client credentials)
- [ ] 14.2.4 Define granular scopes (read:customers, write:jobs, etc.)
- [ ] 14.2.5 Implement scope-based access control
- [ ] 14.2.6 Create token introspection endpoint

### 14.3 Webhook System
```
Location: /src/api/public/webhooks/
Files to create:
├── webhook.service.ts
├── webhook.repository.ts
├── webhook-delivery.worker.ts
├── webhook-retry.strategy.ts
├── signature.generator.ts
├── event-types.ts
└── webhook.types.ts
```

**Tasks:**
- [ ] 14.3.1 Define webhook event types (job.created, invoice.issued, payment.received, etc.)
- [ ] 14.3.2 Implement webhook registration API
- [ ] 14.3.3 Create webhook delivery worker with retries
- [ ] 14.3.4 Implement webhook signature (HMAC-SHA256)
- [ ] 14.3.5 Build webhook delivery logs
- [ ] 14.3.6 Create webhook testing tools (test endpoint, replay)
- [ ] 14.3.7 Implement webhook filtering by event type

### 14.4 Developer Portal
```
Location: /apps/developer-portal/
Files to create:
├── app/
│   ├── layout.tsx
│   ├── page.tsx (Landing)
│   ├── docs/
│   │   ├── page.tsx
│   │   ├── [...slug]/page.tsx
│   │   └── api-reference/page.tsx
│   ├── console/
│   │   ├── layout.tsx
│   │   ├── page.tsx (Dashboard)
│   │   ├── apps/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── new/page.tsx
│   │   ├── keys/page.tsx
│   │   ├── webhooks/page.tsx
│   │   └── logs/page.tsx
│   └── playground/page.tsx
├── components/
│   ├── docs/
│   │   ├── CodeBlock.tsx
│   │   ├── ApiEndpoint.tsx
│   │   └── SchemaViewer.tsx
│   └── console/
│       ├── AppCard.tsx
│       ├── ApiKeyManager.tsx
│       └── WebhookTester.tsx
└── content/
    └── docs/
        ├── getting-started.mdx
        ├── authentication.mdx
        ├── rate-limits.mdx
        ├── webhooks.mdx
        └── api-reference/
```

**Tasks:**
- [ ] 14.4.1 Build developer portal landing page
- [ ] 14.4.2 Create documentation site (MDX-based)
- [ ] 14.4.3 Build interactive API reference (from OpenAPI spec)
- [ ] 14.4.4 Create developer console for app management
- [ ] 14.4.5 Build API key management UI
- [ ] 14.4.6 Create webhook configuration UI
- [ ] 14.4.7 Build API playground for testing
- [ ] 14.4.8 Implement request logs viewer
- [ ] 14.4.9 Create SDK code generation examples

### 14.5 SDK Generation
```
Location: /packages/sdk/
Files to create:
├── typescript/
│   ├── src/
│   │   ├── index.ts
│   │   ├── client.ts
│   │   ├── resources/
│   │   │   ├── customers.ts
│   │   │   ├── jobs.ts
│   │   │   ├── invoices.ts
│   │   │   └── payments.ts
│   │   └── types/
│   ├── package.json
│   └── README.md
├── python/
│   ├── campotech/
│   │   ├── __init__.py
│   │   ├── client.py
│   │   └── resources/
│   ├── setup.py
│   └── README.md
└── openapi/
    └── campotech-api.yaml
```

**Tasks:**
- [ ] 14.5.1 Generate OpenAPI specification from code
- [ ] 14.5.2 Create TypeScript SDK
- [ ] 14.5.3 Create Python SDK
- [ ] 14.5.4 Publish SDKs to npm/PyPI
- [ ] 14.5.5 Create SDK documentation with examples

### 14.6 Pre-Built Integrations
```
Location: /src/integrations/third-party/
Files to create:
├── google-calendar/
│   ├── calendar-sync.service.ts
│   └── google-oauth.ts
├── quickbooks/
│   ├── quickbooks-sync.service.ts
│   └── quickbooks-oauth.ts
├── zapier/
│   ├── zapier-triggers.ts
│   └── zapier-actions.ts
└── integration-manager.ts
```

**Tasks:**
- [ ] 14.6.1 Create Google Calendar two-way sync
- [ ] 14.6.2 Build QuickBooks/accounting software integration
- [ ] 14.6.3 Create Zapier app (triggers and actions)
- [ ] 14.6.4 Implement integration marketplace UI
- [ ] 14.6.5 Build connected apps management

### 14.7 API Analytics & Monitoring
```
Location: /src/api/public/analytics/
Files to create:
├── api-usage.service.ts
├── rate-limit-tracker.ts
├── error-tracker.ts
└── usage-reports.ts
```

**Tasks:**
- [ ] 14.7.1 Implement API usage tracking per key
- [ ] 14.7.2 Create rate limit monitoring
- [ ] 14.7.3 Build error rate tracking
- [ ] 14.7.4 Create usage dashboard for developers
- [ ] 14.7.5 Implement usage alerts and quotas

---

## TEAM RECOMMENDATIONS

### MVP Team (Phases 1-9)

| Role | Count | Phases |
|------|-------|--------|
| Backend Engineer (Senior) | 1 | 1-4, 6, 8, 9 |
| Backend Engineer | 2 | 1-4, 6, 9 |
| Frontend Engineer | 2 | 5, 6.3, 8.3 |
| Mobile Engineer | 2 | 7 |
| DevOps Engineer | 1 | 1.1, 9 |
| QA Engineer | 1 | All phases |
| Product Manager | 1 | All phases |

**MVP Team Size:** 9-10 people

### Post-MVP Team (Phases 10-14)

| Role | Count | Phases |
|------|-------|--------|
| Backend Engineer (Senior) | 1 | 10-14 |
| Backend Engineer | 2 | 10-14 |
| Frontend Engineer | 2 | 10, 11.5, 12.7, 13, 14.4 |
| Mobile Engineer | 1 | 12.8 |
| Data Engineer | 1 | 10.1-10.5 |
| Technical Writer | 1 | 14.4-14.5 |
| DevOps Engineer | 1 | Infrastructure support |
| QA Engineer | 1 | All phases |

**Post-MVP Team Size:** 10-11 people

### Estimated Effort by Phase (Post-MVP)

| Phase | Estimated Hours | Key Deliverables |
|-------|-----------------|------------------|
| **Phase 10** | ~400 hours | Analytics infrastructure, KPIs, dashboards, reports |
| **Phase 11** | ~350 hours | Multi-location, zones, cross-location dispatch |
| **Phase 12** | ~500 hours | Full inventory system, purchasing, mobile features |
| **Phase 13** | ~450 hours | Customer portal, booking, tracking, payments |
| **Phase 14** | ~400 hours | Public API, developer portal, SDKs, integrations |

**Total Post-MVP Effort:** ~2100 additional developer hours

---

## RISK MITIGATION

### MVP Risks (Phases 1-9)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AFIP API changes | Medium | High | Abstract AFIP client, version endpoints |
| Voice AI accuracy below target | Medium | Medium | Feature-flag, manual fallback |
| Mobile performance on low-end devices | Medium | High | Early device testing, performance budgets |
| WhatsApp template rejection | Medium | Medium | Prepare multiple template variants |
| Team velocity slower than planned | Medium | High | Buffer time in estimates, MVP scope flexibility |

### Post-MVP Risks (Phases 10-14)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Analytics query performance | Medium | High | Pre-aggregated data, materialized views, caching |
| Multi-location data isolation | Medium | High | Thorough RLS testing, audit logging |
| Inventory sync conflicts | Medium | Medium | Conflict resolution UI, clear merge rules |
| Customer portal security | Low | Critical | Security audit, rate limiting, fraud detection |
| API backward compatibility | Medium | High | Semantic versioning, deprecation policy, SDKs |
| Third-party integration changes | Medium | Medium | Webhook retry logic, integration health monitoring |
| Data migration complexity | Medium | High | Staged rollouts, feature flags, rollback plans |
| Customer adoption of portal | Medium | Medium | UX testing, gradual feature introduction, tutorials |

---

## DEFINITION OF DONE

Each phase is complete when:
1. All code reviewed and merged
2. Unit tests passing (>80% coverage)
3. Integration tests passing
4. Documentation updated
5. Deployed to staging
6. QA sign-off
7. Product owner acceptance

---

*This plan should be reviewed weekly and adjusted based on actual velocity and learnings.*
