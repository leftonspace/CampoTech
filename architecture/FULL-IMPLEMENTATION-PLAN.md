# CampoTech Full Implementation Plan

**Based on:** `campotech-architecture-complete.md`
**Target Timeline:** 18-Week MVP
**Total Estimated Effort:** ~2500 developer hours

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

## POST-MVP ROADMAP

### Future Phases (Post-Launch)
- **Phase 10:** Advanced Analytics & Reporting
- **Phase 11:** Multi-location Support
- **Phase 12:** Inventory Management
- **Phase 13:** Customer Self-Service Portal
- **Phase 14:** API for Third-Party Integrations

---

## TEAM RECOMMENDATIONS

| Role | Count | Phases |
|------|-------|--------|
| Backend Engineer (Senior) | 1 | 1-4, 6, 8, 9 |
| Backend Engineer | 2 | 1-4, 6, 9 |
| Frontend Engineer | 2 | 5, 6.3, 8.3 |
| Mobile Engineer | 2 | 7 |
| DevOps Engineer | 1 | 1.1, 9 |
| QA Engineer | 1 | All phases |
| Product Manager | 1 | All phases |

**Total Team Size:** 9-10 people

---

## RISK MITIGATION

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AFIP API changes | Medium | High | Abstract AFIP client, version endpoints |
| Voice AI accuracy below target | Medium | Medium | Feature-flag, manual fallback |
| Mobile performance on low-end devices | Medium | High | Early device testing, performance budgets |
| WhatsApp template rejection | Medium | Medium | Prepare multiple template variants |
| Team velocity slower than planned | Medium | High | Buffer time in estimates, MVP scope flexibility |

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
