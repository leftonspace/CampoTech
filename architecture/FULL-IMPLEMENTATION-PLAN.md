# CampoTech Full Implementation Plan

**Based on:** `campotech-architecture-complete.md` and `CAMPOTECH-SYSTEM-GUIDE.md`
**Target Timeline:** 18-Week MVP + 9-Week Enhanced MVP + 17-Week Post-MVP + 8-Week Marketplace (52 weeks / 1 year)
**Total Estimated Effort:** ~8,150 developer hours (MVP: ~2,500 | Enhanced: ~1,600 | Post-MVP: ~2,700 | Marketplace: ~1,350)

---

## EXECUTIVE OVERVIEW

### MVP Phases (Weeks 1-18)

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

### Enhanced MVP Phases (Weeks 19-27) - Post-Launch, Pre-Scaling

| Phase | Focus | Duration | Dependencies | Priority |
|-------|-------|----------|--------------|----------|
| **Phase 9.5** | Employee Onboarding & Verification | Week 19 | Phase 9 | High |
| **Phase 9.6** | Notification Preferences System | Weeks 19-20 | Phase 9 | High |
| **Phase 9.7** | Argentine Communication Localization | Week 21 | Phase 9.6 | High |
| **Phase 9.8** | Message Aggregation System | Week 22 | Phase 9.7 | High |
| **Phase 9.9** | Customer Live Tracking System | Weeks 23-24 | Phase 9.8 | High |
| **Phase 9.10** | Mobile-First Architecture | Weeks 25-26 | Phase 9.9 | High |
| **Phase 9.11** | Technical Architecture Documentation | Week 27 | All Enhanced | Medium |

### Post-MVP Phases (Weeks 28-44)

| Phase | Focus | Duration | Dependencies | Priority |
|-------|-------|----------|--------------|----------|
| **Phase 10** | Advanced Analytics & Reporting | Weeks 28-30 | Phase 9.11 | High |
| **Phase 11** | Multi-Location Support | Weeks 31-33 | Phase 10 | High |
| **Phase 12** | Inventory Management | Weeks 34-37 | Phase 11 | Medium |
| **Phase 13** | Customer Self-Service Portal | Weeks 38-41 | Phases 10-12 | Medium |
| **Phase 14** | API for Third-Party Integrations | Weeks 42-44 | Phase 13 | Medium |

### Future Roadmap (Year 2)

| Phase | Focus | Duration | Dependencies | Priority |
|-------|-------|----------|--------------|----------|
| **Phase 15** | Consumer Marketplace (Free Service Finder) | Weeks 45-52 | Phase 14 | Strategic |

**Phase 15 Overview:**
- Two-sided marketplace: Business Profile (paid) + Consumer Profile (FREE)
- Consumers find services, request quotes, track technicians, leave reviews
- Businesses receive qualified leads from consumer requests
- Ranking system based on ratings, response time, job completion
- Differentiator: FREE for consumers (competitors charge 10-15% fee)
- Uses existing infrastructure (zero marginal cost per consumer)

### New Enhanced MVP Features Summary

| Phase | Key Deliverables | Business Impact |
|-------|------------------|-----------------|
| **9.8** | WhatsApp message buffering, 8-second aggregation window, trigger detection | Natural conversational AI responses |
| **9.9** | Web-based live tracking, tier-based maps (Static/Mapbox/Google), animated markers | Competitive differentiator, customer satisfaction |
| **9.10** | Full mobile feature parity, offline capability, voice input | Access 85%+ of Argentine SMB market |
| **9.11** | Architecture docs, decision records, integration patterns | Team scaling, maintenance efficiency |

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

## PHASE 9.7: ARGENTINE COMMUNICATION LOCALIZATION
**Duration:** Week 21 (1 week, after Phase 9.6)
**Team:** 1 Backend Engineer, 1 Frontend Engineer
**Priority:** High - Critical for Argentine market success

### Overview: Argentine Communication Patterns

Argentina has unique communication preferences that differ significantly from US/European markets:

| Channel | Usage in Argentina | Role in CampoTech |
|---------|-------------------|-------------------|
| **WhatsApp** | 95%+ penetration, primary for everything | PRIMARY for all notifications |
| **SMS** | Rarely used, costs money | FALLBACK only (OTP, offline) |
| **Email** | Formal/documentation only | DOCUMENTS (invoices, reports) |
| **Push** | Standard mobile | REMINDERS and alerts |

**Key Argentine Behaviors:**
- **Audio messages ("audios")** are preferred over typing
- Informal tone ("vos" instead of "tú", "che", colloquial expressions)
- Quick response expectation on WhatsApp
- Business WhatsApp is trusted and expected
- SMS is seen as outdated/expensive

### 9.7.1 WhatsApp-First Channel Priority

**Tasks (Retroactive fixes to Phases 1-9):**
- [ ] 9.7.1.1 Change employee welcome notification from SMS to WhatsApp (currently in `/apps/web/app/api/users/route.ts`)
- [ ] 9.7.1.2 Add WhatsApp fallback to SMS (not SMS fallback to WhatsApp) for non-critical messages
- [ ] 9.7.1.3 Update notification delivery orchestrator priority order:
  ```
  1. WhatsApp (primary) → 95% of messages
  2. Push notification → Always for mobile users
  3. Email → Documents and summaries only
  4. SMS → OTP codes and critical fallback only
  ```
- [ ] 9.7.1.4 Create WhatsApp connection check before falling back to SMS
- [ ] 9.7.1.5 Update Phase 9.6 notification defaults to WhatsApp-first

### 9.7.2 New WhatsApp Templates for Argentina
```
Location: /src/integrations/whatsapp/templates/
Files to modify/create:
├── template-registry.ts (add new templates)
├── employee-templates.ts (NEW)
└── argentina-templates.ts (NEW - localized versions)
```

**New Employee-Focused Templates:**
```typescript
// Template: employee_welcome
{
  name: 'employee_welcome',
  language: 'es_AR',
  category: 'UTILITY',
  text: '👋 ¡Hola {{1}}!\n\nFuiste agregado al equipo de {{2}} como {{3}}.\n\n📱 Descargá la app CampoTech para:\n• Ver tus trabajos asignados\n• Navegar a las direcciones\n• Registrar fotos y firmas\n\n🔐 Tu número de acceso: {{4}}\n\n¿Tenés alguna duda?',
  buttons: ['Descargar app', 'Tengo dudas']
}

// Template: job_assigned_tech
{
  name: 'job_assigned_tech',
  language: 'es_AR',
  category: 'UTILITY',
  text: '🔧 Nuevo trabajo asignado\n\n📍 {{1}}\n📅 {{2}} a las {{3}} hs\n👤 Cliente: {{4}}\n📞 {{5}}\n\nServicio: {{6}}\n\n¿Podés confirmar?',
  buttons: ['Confirmar', 'No puedo']
}

// Template: job_reminder_tech
{
  name: 'job_reminder_tech',
  language: 'es_AR',
  category: 'UTILITY',
  text: '⏰ Recordatorio: Trabajo en {{1}}\n\n📍 {{2}}\n👤 {{3}}\n\n¿Ya estás en camino?',
  buttons: ['En camino', 'Ver detalles']
}

// Template: schedule_change
{
  name: 'schedule_change',
  language: 'es_AR',
  category: 'UTILITY',
  text: '📅 Cambio de horario\n\n{{1}}, tu trabajo en {{2}} se reprogramó:\n\n❌ Antes: {{3}}\n✅ Ahora: {{4}}\n\n¿Te queda bien?',
  buttons: ['OK', 'No me sirve']
}
```

**Tasks:**
- [ ] 9.7.2.1 Create `employee_welcome` WhatsApp template
- [ ] 9.7.2.2 Create `job_assigned_tech` template for technician notifications
- [ ] 9.7.2.3 Create `job_reminder_tech` template (30min, 1h, 24h versions)
- [ ] 9.7.2.4 Create `schedule_change` template for rescheduling
- [ ] 9.7.2.5 Create `job_completed_admin` template (notify admin when tech completes)
- [ ] 9.7.2.6 Create `new_customer_inquiry` template (voice/text inquiry received)
- [ ] 9.7.2.7 Submit all templates to Meta for approval
- [ ] 9.7.2.8 Add template status monitoring in admin dashboard

### 9.7.3 Audio Message Support (Argentine Preference)
```
Location: /src/integrations/whatsapp/messages/
Files to create:
├── audio.handler.ts (NEW)
├── audio-transcription.ts (NEW)
└── voice-job-request.ts (NEW)
```

**Context:** Argentines prefer sending "audios" (voice messages) over typing. This is especially true for:
- Describing job problems ("Che, tengo una pérdida en el baño...")
- Explaining locations
- Quick updates while working

**Tasks:**
- [ ] 9.7.3.1 Implement WhatsApp audio message reception and storage
- [ ] 9.7.3.2 Integrate audio transcription (Whisper API) for voice messages
- [ ] 9.7.3.3 Auto-create job requests from transcribed audio
- [ ] 9.7.3.4 Send confirmation: "Recibimos tu audio, te confirmamos en breve"
- [ ] 9.7.3.5 Queue audio messages for human review if confidence < 80%
- [ ] 9.7.3.6 Add audio player in web dashboard for review
- [ ] 9.7.3.7 Support audio responses from technicians (optional)

### 9.7.4 SMS Role Redefinition
```
Location: /apps/web/lib/sms.ts, /src/workers/whatsapp/
Files to modify:
├── sms.ts (add usage restrictions)
├── whatsapp-outbound.worker.ts (update fallback logic)
└── notification-router.ts (NEW - smart routing)
```

**SMS should ONLY be used for:**
| Use Case | Reason |
|----------|--------|
| OTP/Verification codes | Works without internet |
| Critical system alerts | Guaranteed delivery |
| WhatsApp delivery failure (after 3 retries) | Fallback |
| Users without WhatsApp (rare, <5%) | Accessibility |

**Tasks:**
- [ ] 9.7.4.1 Add `channel_restriction` to notification types:
  ```typescript
  type NotificationChannel = 'whatsapp' | 'sms' | 'email' | 'push';
  type ChannelRestriction = 'sms_only' | 'whatsapp_preferred' | 'any';

  const CHANNEL_RESTRICTIONS: Record<NotificationType, ChannelRestriction> = {
    otp_verification: 'sms_only',
    employee_welcome: 'whatsapp_preferred',
    job_assigned: 'whatsapp_preferred',
    job_reminder: 'whatsapp_preferred',
    invoice_ready: 'whatsapp_preferred',
    payment_confirmed: 'whatsapp_preferred',
    system_critical: 'any', // Try all channels
  };
  ```
- [ ] 9.7.4.2 Update employee welcome to use WhatsApp template first
- [ ] 9.7.4.3 Create SMS-to-WhatsApp migration prompt for existing users
- [ ] 9.7.4.4 Add WhatsApp number validation on user creation
- [ ] 9.7.4.5 Show "WhatsApp preferred" indicator in team settings

### 9.7.5 Email Role Definition (Documentation Only)
```
Location: /src/modules/notifications/email/
Files to create:
├── email.service.ts
├── email-templates/
│   ├── invoice.template.ts
│   ├── monthly-report.template.ts
│   ├── account-summary.template.ts
│   └── base.template.ts
└── email.types.ts
```

**Email should ONLY be used for:**
| Use Case | Reason |
|----------|--------|
| Invoice PDF delivery | Legal documentation |
| Monthly/weekly reports | Scheduled summaries |
| Account statements | Financial records |
| Terms & conditions | Legal requirements |
| Password reset (if implemented) | Security |

**Tasks:**
- [ ] 9.7.5.1 Implement email service (Resend or SendGrid)
- [ ] 9.7.5.2 Create invoice email template with PDF attachment
- [ ] 9.7.5.3 Create monthly report email template
- [ ] 9.7.5.4 Add email delivery logging
- [ ] 9.7.5.5 Implement email bounce handling
- [ ] 9.7.5.6 Do NOT use email for time-sensitive notifications

### 9.7.6 Updated Notification Defaults (Argentine-Optimized)
```
Location: /database/migrations/
File to create:
└── 019_argentine_notification_defaults.sql
```

**New Default Preferences:**
```sql
-- Updated defaults for Argentine market
ALTER TABLE notification_preferences
ALTER COLUMN whatsapp_enabled SET DEFAULT true,  -- Changed from false
ALTER COLUMN sms_enabled SET DEFAULT false,       -- Keep false (SMS is fallback only)
ALTER COLUMN email_enabled SET DEFAULT false;     -- Changed from true (documents only)

-- Updated event preferences (WhatsApp-first)
UPDATE notification_preferences SET event_preferences = '{
    "job_assigned": {"whatsapp": true, "push": true, "email": false, "sms": false},
    "job_reminder": {"whatsapp": true, "push": true, "email": false, "sms": false},
    "job_completed": {"whatsapp": true, "push": true, "email": false, "sms": false},
    "schedule_change": {"whatsapp": true, "push": true, "email": false, "sms": false},
    "invoice_created": {"whatsapp": true, "push": false, "email": true, "sms": false},
    "payment_received": {"whatsapp": true, "push": true, "email": false, "sms": false},
    "payment_reminder": {"whatsapp": true, "push": false, "email": false, "sms": false},
    "team_member_added": {"whatsapp": true, "push": false, "email": false, "sms": false},
    "system_alert": {"whatsapp": true, "push": true, "email": true, "sms": true}
}';
```

**Tasks:**
- [ ] 9.7.6.1 Create migration to update notification defaults
- [ ] 9.7.6.2 Update Phase 9.6 schema to use WhatsApp-first defaults
- [ ] 9.7.6.3 Add "Argentine mode" organization setting (auto-applies these defaults)
- [ ] 9.7.6.4 Create notification preferences presets:
  - "Argentina Standard" (WhatsApp-first)
  - "International" (Email + SMS focus)
  - "Minimal" (Push only)
- [ ] 9.7.6.5 Show channel usage analytics in dashboard

### 9.7.7 Message Tone & Language (Argentine Spanish)
```
Location: /src/shared/i18n/
Files to create:
├── locales/
│   ├── es-AR.json (Argentine Spanish)
│   └── es.json (Generic Spanish fallback)
├── message-templates.ts
└── tone-guidelines.md
```

**Argentine Spanish Guidelines:**
| Feature | Standard Spanish | Argentine Spanish |
|---------|-----------------|-------------------|
| "You" (informal) | tú | vos |
| "You have" | tienes | tenés |
| "You can" | puedes | podés |
| "Download" | descarga | descargá |
| Greeting | Hola | Hola / Che |
| Thanks | Gracias | Gracias / Dale |

**Tasks:**
- [ ] 9.7.7.1 Audit all user-facing messages for Argentine Spanish ("vos" conjugation)
- [ ] 9.7.7.2 Update OTP message: "Tu código de CampoTech es: {{code}}. Expira en 5 min."
- [ ] 9.7.7.3 Update welcome message to use "vos" form
- [ ] 9.7.7.4 Create message tone guidelines document
- [ ] 9.7.7.5 Add informal greetings where appropriate ("Che", "Dale")
- [ ] 9.7.7.6 Review all WhatsApp templates for Argentine tone
- [ ] 9.7.7.7 Add locale selector (future: support other LATAM countries)

### 9.7.8 Business Hours & Response Expectations
```
Location: /src/modules/organizations/settings/
Files to create:
├── business-hours.service.ts
├── response-time.service.ts
└── auto-responder.ts
```

**Argentine Business Context:**
- Business hours: Generally 9:00-18:00 or 9:00-20:00
- Siesta consideration: Some regions have 13:00-16:00 break
- WhatsApp response expected within 1-2 hours during business hours
- After-hours auto-responder is expected

**Tasks:**
- [ ] 9.7.8.1 Add business hours configuration per organization
- [ ] 9.7.8.2 Implement auto-responder for after-hours WhatsApp messages:
  ```
  "Hola! Recibimos tu mensaje. Nuestro horario de atención es de {{start}} a {{end}} hs.
   Te respondemos a la brevedad. Si es urgente, llamanos al {{phone}}."
  ```
- [ ] 9.7.8.3 Add "response time" tracking per organization
- [ ] 9.7.8.4 Show "typically responds within X minutes" on customer portal
- [ ] 9.7.8.5 Alert admin if WhatsApp messages unanswered > 2 hours
- [ ] 9.7.8.6 Support multiple time zones (for organizations with multiple locations)

### 9.7.9 Retroactive Fixes Checklist (Phases 1-9)

These changes need to be applied to already-implemented code:

**Phase 2 - User Service:**
- [ ] 9.7.9.1 Add `whatsappNumber` field to User model (may differ from phone)
- [ ] 9.7.9.2 Add `preferredChannel` field: 'whatsapp' | 'sms' | 'email'
- [ ] 9.7.9.3 Default `preferredChannel` to 'whatsapp'

**Phase 5 - Web Portal:**
- [ ] 9.7.9.4 Update team member form to show "WhatsApp" instead of "SMS" for notifications
- [ ] 9.7.9.5 Add WhatsApp connection status indicator

**Phase 6 - WhatsApp Integration:**
- [ ] 9.7.9.6 Add employee-focused templates to template registry
- [ ] 9.7.9.7 Update outbound worker to check WhatsApp before SMS fallback

**Phase 7 - Mobile App:**
- [ ] 9.7.9.8 Add WhatsApp deep-link for customer contact
- [ ] 9.7.9.9 Show WhatsApp icon instead of SMS for messaging

**API Routes:**
- [ ] 9.7.9.10 Update `/api/users/route.ts` to use WhatsApp for welcome message
- [ ] 9.7.9.11 Add WhatsApp number validation endpoint

---

## PHASE 9.8: MESSAGE AGGREGATION SYSTEM (WHATSAPP CONVERSATIONAL INTELLIGENCE)
**Duration:** Week 22 (1 week)
**Team:** 1 Backend Engineer, 1 Frontend Engineer
**Priority:** High - Critical for natural WhatsApp conversations

### Overview: The Problem with Sequential Message Processing

Customers don't send one perfect message. They send conversational fragments:

```
Customer sends:
├── 14:30:01  "Hola"
├── 14:30:03  "Como estas?"
├── 14:30:08  "Necesito ayuda"
└── 14:30:15  "Se me rompió el aire, no enfría nada, pueden venir hoy?"
```

**Wrong approach:** Respond to each message individually
- "Hola" → Auto-reply "¿En qué podemos ayudarte?" ❌
- Creates fragmented, robotic experience
- Confuses customers expecting human-like conversation

**Correct approach:** Wait, aggregate, then respond once intelligently

### 9.8.1 Message Buffer Database Schema
```
Location: /database/migrations/
Files to create:
├── 020_create_message_buffers.sql
└── 021_create_conversation_contexts.sql
```

**Database Schema:**
```sql
-- Redis-backed buffer (in-memory, not SQL)
-- This schema documents the buffer structure

-- Conversation context for returning customers
CREATE TABLE conversation_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    customer_phone TEXT NOT NULL,

    -- Last 10 messages for context
    message_history JSONB DEFAULT '[]',

    -- Customer identification
    customer_id UUID REFERENCES customers(id),
    customer_name TEXT,

    -- Active job reference
    active_job_id UUID REFERENCES jobs(id),

    -- Service history for context
    previous_requests TEXT[],

    -- Timestamps
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Auto-expire after 24 hours of inactivity
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',

    UNIQUE(organization_id, customer_phone)
);

-- Index for quick lookup
CREATE INDEX idx_conversation_contexts_phone
ON conversation_contexts(organization_id, customer_phone);

CREATE INDEX idx_conversation_contexts_expiry
ON conversation_contexts(expires_at);
```

**Tasks:**
- [ ] 9.8.1.1 Create conversation_contexts table
- [ ] 9.8.1.2 Design Redis buffer structure for active aggregation windows
- [ ] 9.8.1.3 Create TTL-based buffer expiration
- [ ] 9.8.1.4 Add indexes for fast phone lookup

### 9.8.2 Message Aggregator Service
```
Location: /src/integrations/whatsapp/aggregation/
Files to create:
├── message-aggregator.service.ts
├── buffer-manager.ts
├── trigger-detector.ts
├── conversation-context.service.ts
├── aggregation.types.ts
└── aggregation.constants.ts
```

**Configuration Constants:**
```typescript
// aggregation.constants.ts
export const AGGREGATION_WINDOW_MS = 8000;  // 8 seconds
export const MAX_BUFFER_MESSAGES = 10;       // Safety limit
export const CONTEXT_HISTORY_SIZE = 10;      // Messages to keep for context
export const CONTEXT_TTL_HOURS = 24;         // Context expiration

// Trigger patterns that cause immediate processing
export const TRIGGER_PATTERNS = {
  REQUEST_VERBS: /necesito|quiero|pueden|vengan|arreglen|instalen|reparen/i,
  QUESTION_MARK: /\?$/,
  URGENCY: /urgente|emergencia|ahora|hoy|ya/i,
  ADDRESS: /calle|avenida|av\.|piso|depto|departamento|entre/i,
  SCHEDULE: /mañana|lunes|martes|miércoles|jueves|viernes|sábado|domingo/i,
};

// Length threshold for "complete" messages
export const LONG_MESSAGE_THRESHOLD = 100;
```

**Tasks:**
- [ ] 9.8.2.1 Implement MessageAggregator class with Redis backend
- [ ] 9.8.2.2 Create buffer creation and message appending logic
- [ ] 9.8.2.3 Implement 8-second sliding window timer (resets on each message)
- [ ] 9.8.2.4 Build trigger detection for immediate processing
- [ ] 9.8.2.5 Create buffer processing and cleanup
- [ ] 9.8.2.6 Implement conversation context loading and saving
- [ ] 9.8.2.7 Add metrics tracking (buffer sizes, processing times)

### 9.8.3 Trigger Detection Logic
```
Location: /src/integrations/whatsapp/aggregation/trigger-detector.ts
```

**Trigger Conditions (Process Immediately):**

| Condition | Detection | Reason |
|-----------|-----------|--------|
| Contains clear request | Request verbs detected | Complete intent detected |
| Contains question mark | `\?$` at end | Expecting answer |
| Message is long | >100 characters | Likely complete thought |
| Contains urgency words | "urgente", "emergencia" | Time-sensitive |
| Is a voice message | `type === 'voice'` | Usually complete request |
| Contains address | Street/floor patterns | Booking intent |
| Contains scheduling | Day names, "mañana" | Appointment intent |

**Tasks:**
- [ ] 9.8.3.1 Implement TriggerDetector class
- [ ] 9.8.3.2 Add request verb detection
- [ ] 9.8.3.3 Add question detection
- [ ] 9.8.3.4 Add message length threshold
- [ ] 9.8.3.5 Add urgency word detection
- [ ] 9.8.3.6 Add voice message handling
- [ ] 9.8.3.7 Add address pattern detection
- [ ] 9.8.3.8 Add scheduling intent detection
- [ ] 9.8.3.9 Make trigger patterns configurable per organization

### 9.8.4 WhatsApp Webhook Integration
```
Location: /src/integrations/whatsapp/webhook/
Files to modify:
├── webhook.handler.ts (add aggregation)
└── message.processor.ts (new flow)
```

**Updated Flow:**
```
Message arrives
    │
    ▼
┌─────────────────────────────────┐
│ MessageAggregator.handleMessage │
└─────────────────────────────────┘
    │
    ├── Check for active buffer
    │   │
    │   ├── NO: Create new buffer, set 8s timer
    │   │
    │   └── YES: Append message, RESET timer
    │
    ▼
┌─────────────────────────────────┐
│ TriggerDetector.shouldProcess   │
└─────────────────────────────────┘
    │
    ├── YES (trigger detected): Process immediately
    │   └── Combine all buffered messages
    │   └── Send to GPT-4o as single context
    │   └── Route based on confidence
    │
    └── NO: Wait for timer or next message
```

**Tasks:**
- [ ] 9.8.4.1 Modify webhook.handler.ts to route through aggregator
- [ ] 9.8.4.2 Update message processor to handle combined messages
- [ ] 9.8.4.3 Add buffer metadata to GPT context
- [ ] 9.8.4.4 Implement graceful degradation (if Redis unavailable, process immediately)

### 9.8.5 Worker for Timer-Based Processing
```
Location: /src/workers/whatsapp/
Files to create:
├── aggregation-processor.worker.ts
└── buffer-cleanup.worker.ts
```

**Tasks:**
- [ ] 9.8.5.1 Create scheduled worker to process expired buffers
- [ ] 9.8.5.2 Implement Redis keyspace notifications for buffer expiry
- [ ] 9.8.5.3 Create cleanup worker for orphaned buffers
- [ ] 9.8.5.4 Add monitoring for buffer processing latency

### 9.8.6 Conversation Context Service
```
Location: /src/integrations/whatsapp/aggregation/conversation-context.service.ts
```

**Context includes:**
```typescript
interface ConversationContext {
  phone: string;

  // Message history (last 10 messages, 24h window)
  messages: {
    content: string;
    sender: 'customer' | 'business';
    timestamp: number;
  }[];

  // Customer identification
  customerId?: string;
  customerName?: string;

  // Active job reference
  activeJobId?: string;

  // Service history
  previousRequests: string[];

  // Timestamps
  lastMessageAt: Date;
}
```

**Tasks:**
- [ ] 9.8.6.1 Implement ConversationContext loading from database
- [ ] 9.8.6.2 Create context update on each message
- [ ] 9.8.6.3 Build customer identification (phone → customer lookup)
- [ ] 9.8.6.4 Implement active job detection
- [ ] 9.8.6.5 Create service history extraction
- [ ] 9.8.6.6 Add 24-hour context expiration

### 9.8.7 GPT Prompt Enhancement
```
Location: /src/integrations/voice-ai/extraction/prompts/
Files to modify:
├── extraction.prompt.ts (add context handling)
└── context-builder.ts (new)
```

**Enhanced Prompt Structure:**
```typescript
const buildContextualPrompt = (context: ConversationContext, buffer: MessageBuffer) => `
## Conversation History (last 24h)
${context.messages.map(m => `[${m.time}] ${m.sender}: ${m.content}`).join('\n')}

## Customer Info
${context.customerName ? `Name: ${context.customerName}` : 'Unknown customer'}
${context.activeJobId ? `Active job: ${context.activeJobId}` : 'No active jobs'}
${context.previousRequests.length > 0 ? `Previous services: ${context.previousRequests.join(', ')}` : ''}

## Current Message(s) (${buffer.messages.length} messages, aggregated)
${buffer.messages.map(m => m.content).join('\n')}

## Instructions
- Consider the conversation history when classifying
- If customer has active job, check if they're asking about it
- Respond in a natural, conversational tone
- Use Argentine Spanish (vos form, informal)

Classify and extract job request details if present.
`;
```

**Tasks:**
- [ ] 9.8.7.1 Create ContextBuilder class
- [ ] 9.8.7.2 Modify extraction prompt to include conversation history
- [ ] 9.8.7.3 Add message count metadata to prompt
- [ ] 9.8.7.4 Implement customer context inclusion
- [ ] 9.8.7.5 Add active job awareness

### 9.8.8 Example Scenarios Implementation

**Scenario Tests to Implement:**

| Scenario | Input | Expected Behavior |
|----------|-------|-------------------|
| Greeting → Request | "Hola" → "El aire no enfría" | Wait, aggregate, classify as JOB_REQUEST |
| Greeting only | "Hola" (8s passes) | Classify as GREETING, respond "¿En qué podemos ayudarte?" |
| Complete request | Long message with address | Trigger immediately, create job |
| Question | "Cuánto sale...?" | Trigger on ?, respond with pricing |
| Existing customer | Known phone asks about job | Include active job in response |

**Tasks:**
- [ ] 9.8.8.1 Create test suite for aggregation scenarios
- [ ] 9.8.8.2 Implement integration tests with mock Redis
- [ ] 9.8.8.3 Add performance benchmarks (aggregation latency)

### 9.8.9 Admin UI for Aggregation Monitoring
```
Files to create:
├── app/(dashboard)/whatsapp/aggregation/
│   ├── page.tsx (Buffer Status)
│   └── settings/page.tsx (Configuration)
├── components/whatsapp/
│   ├── BufferMonitor.tsx
│   ├── AggregationStats.tsx
│   └── TriggerConfigEditor.tsx
```

**Tasks:**
- [ ] 9.8.9.1 Build buffer monitoring dashboard
- [ ] 9.8.9.2 Create aggregation statistics display (avg buffer size, trigger rates)
- [ ] 9.8.9.3 Build trigger configuration editor (customize patterns per org)
- [ ] 9.8.9.4 Add real-time buffer count display

---

## PHASE 9.9: CUSTOMER LIVE TRACKING SYSTEM
**Duration:** Weeks 23-24 (2 weeks)
**Team:** 2 Backend Engineers, 2 Frontend Engineers, 1 Mobile Engineer
**Priority:** High - Major competitive differentiator

### Overview: Why Web-Based Tracking (Not In-WhatsApp)

**WhatsApp Limitations:**
- ❌ Cannot send animated/live updating maps inside chat
- ❌ Cannot programmatically share live location (user-initiated only)
- ❌ Cannot embed interactive maps in messages
- ✅ CAN send a tracking link that opens in browser
- ✅ CAN send interactive buttons ("Ver ubicación" → opens link)

**Solution:** Send WhatsApp message with tracking URL → Customer opens in browser → Live map experience

### 9.9.1 Tracking Database Schema
```
Location: /database/migrations/
Files to create:
├── 022_create_tracking_sessions.sql
├── 023_create_location_history.sql
└── 024_create_tracking_tokens.sql
```

**Database Schema:**
```sql
-- Active tracking sessions
CREATE TABLE tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) UNIQUE,
    technician_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Current position (updated every 30 seconds)
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(11, 8),
    current_speed DECIMAL(5, 2),      -- km/h
    current_heading DECIMAL(5, 2),    -- degrees
    movement_mode TEXT DEFAULT 'driving', -- 'driving', 'walking', 'stationary'

    -- ETA information
    eta_minutes INTEGER,
    eta_updated_at TIMESTAMPTZ,
    route_polyline TEXT,              -- Encoded polyline for route
    traffic_aware BOOLEAN DEFAULT false,

    -- Session state
    status TEXT DEFAULT 'active',     -- 'active', 'arrived', 'completed', 'cancelled'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    arrived_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Position update counter
    position_update_count INTEGER DEFAULT 0,
    last_position_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Location history for the session
CREATE TABLE tracking_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES tracking_sessions(id) ON DELETE CASCADE,

    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5, 2),
    heading DECIMAL(5, 2),
    accuracy DECIMAL(5, 2),           -- GPS accuracy in meters
    movement_mode TEXT,

    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Short-lived tracking tokens
CREATE TABLE tracking_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id),

    -- Security
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,  -- 4 hours from creation
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,

    -- Optional: limit by IP for security
    allowed_ip TEXT
);

-- Indexes
CREATE INDEX idx_tracking_sessions_job ON tracking_sessions(job_id);
CREATE INDEX idx_tracking_sessions_technician ON tracking_sessions(technician_id);
CREATE INDEX idx_tracking_tokens_token ON tracking_tokens(token);
CREATE INDEX idx_tracking_tokens_expiry ON tracking_tokens(expires_at);
CREATE INDEX idx_location_history_session ON tracking_location_history(session_id, recorded_at);
```

**Tasks:**
- [ ] 9.9.1.1 Create tracking_sessions table
- [ ] 9.9.1.2 Create tracking_location_history table
- [ ] 9.9.1.3 Create tracking_tokens table
- [ ] 9.9.1.4 Add indexes for performance
- [ ] 9.9.1.5 Create cleanup job for expired tokens and old history

### 9.9.2 Tracking Session Service
```
Location: /src/modules/tracking/
Files to create:
├── tracking.service.ts
├── tracking.repository.ts
├── tracking.controller.ts
├── tracking.routes.ts
├── session-manager.ts
├── eta-calculator.ts
├── mode-detector.ts
├── token-generator.ts
└── tracking.types.ts
```

**Tasks:**
- [ ] 9.9.2.1 Implement tracking session creation (triggered by job status → EN_ROUTE)
- [ ] 9.9.2.2 Create position update endpoint (POST /api/tracking/update)
- [ ] 9.9.2.3 Implement customer tracking endpoint (GET /api/tracking/:token)
- [ ] 9.9.2.4 Build session lifecycle management (start, arrive, complete)
- [ ] 9.9.2.5 Create token generation with 4-hour expiry
- [ ] 9.9.2.6 Implement Redis caching for active sessions (TTL 2 hours)

### 9.9.3 ETA Calculator Service
```
Location: /src/modules/tracking/eta/
Files to create:
├── eta-calculator.service.ts
├── providers/
│   ├── eta-provider.interface.ts
│   ├── google-maps.provider.ts
│   ├── mapbox.provider.ts
│   └── basic.provider.ts
├── haversine.ts
└── eta.types.ts
```

**Tier-Based ETA Strategy:**

| Tier | Provider | API | Traffic-Aware | Cost per 1000 |
|------|----------|-----|---------------|---------------|
| **BÁSICO** | Basic calculation | None | ❌ | $0 |
| **PROFESIONAL** | Mapbox | Directions API | ❌ | ~$5 |
| **EMPRESARIAL** | Google Maps | Directions API | ✅ | ~$12 |

**Tasks:**
- [ ] 9.9.3.1 Create ETAProvider interface
- [ ] 9.9.3.2 Implement BasicETAProvider (haversine distance + speed estimate)
- [ ] 9.9.3.3 Implement MapboxETAProvider (Directions API)
- [ ] 9.9.3.4 Implement GoogleMapsETAProvider (with traffic via departure_time=now)
- [ ] 9.9.3.5 Create ETA calculator factory (selects provider by tier)
- [ ] 9.9.3.6 Implement ETA caching (refresh every 2 minutes, not every request)
- [ ] 9.9.3.7 Add traffic condition monitoring for Empresarial tier

### 9.9.4 Movement Mode Detector
```
Location: /src/modules/tracking/mode-detector.ts
```

**Detection Logic:**
```typescript
function detectMovementMode(
  history: LocationUpdate[],
  currentSpeed: number
): 'walking' | 'driving' | 'stationary' {
  // Stationary: < 1 km/h for 30+ seconds
  if (currentSpeed < 1) {
    const recent = history.filter(u => Date.now() - u.timestamp < 30000);
    if (recent.every(u => u.speed < 1)) return 'stationary';
  }

  // Walking: 1-7 km/h
  if (currentSpeed >= 1 && currentSpeed <= 7) return 'walking';

  // Driving: > 7 km/h
  return 'driving';
}
```

**Tasks:**
- [ ] 9.9.4.1 Implement ModeDetector class
- [ ] 9.9.4.2 Add speed history analysis
- [ ] 9.9.4.3 Create mode change event emission
- [ ] 9.9.4.4 Update ETA calculation based on detected mode

### 9.9.5 Map Provider Integration
```
Location: /src/modules/tracking/maps/
Files to create:
├── map-provider.service.ts
├── providers/
│   ├── google-static.provider.ts
│   ├── mapbox.provider.ts
│   └── google-maps.provider.ts
├── route-renderer.ts
└── map.types.ts
```

**Tier-Based Map Strategy:**

| Tier | Provider | Map Type | Features |
|------|----------|----------|----------|
| **BÁSICO** | Google Static Maps | Static image | Single snapshot, ETA text only |
| **PROFESIONAL** | Mapbox | Interactive JS | Live animation, route line |
| **EMPRESARIAL** | Google Maps Platform | Interactive JS | Traffic layer, street view, walking detection |

**Tasks:**
- [ ] 9.9.5.1 Create MapProvider interface
- [ ] 9.9.5.2 Implement GoogleStaticMapsProvider (generates image URL)
- [ ] 9.9.5.3 Implement MapboxProvider (returns config for Mapbox GL JS)
- [ ] 9.9.5.4 Implement GoogleMapsProvider (returns config for Google Maps JS API)
- [ ] 9.9.5.5 Create provider factory (selects by organization tier)
- [ ] 9.9.5.6 Implement route polyline encoding/decoding

### 9.9.6 Technician Mobile App Integration
```
Location (mobile): /apps/mobile/
Files to create:
├── lib/tracking/
│   ├── location-tracker.ts
│   ├── background-location.ts
│   ├── tracking-api.ts
│   └── tracking.types.ts
├── components/tracking/
│   ├── TrackingStatusBar.tsx
│   └── NavigationButton.tsx
```

**GPS Update Strategy:**
- Update frequency: Every 30 seconds when in EN_ROUTE status
- Background location: Use Expo Location with background permissions
- Battery optimization: Reduce accuracy when stationary
- Offline handling: Queue updates when offline, sync when back online

**Tasks:**
- [ ] 9.9.6.1 Implement background location tracking (Expo Location)
- [ ] 9.9.6.2 Create 30-second position update interval
- [ ] 9.9.6.3 Build tracking status indicator in app header
- [ ] 9.9.6.4 Add deep link to navigation apps (Google Maps, Waze)
- [ ] 9.9.6.5 Implement battery-efficient tracking modes
- [ ] 9.9.6.6 Handle location permission requests
- [ ] 9.9.6.7 Create offline queue for position updates

### 9.9.7 Customer Tracking Web Page
```
Location: /apps/web/
Files to create:
├── app/track/
│   ├── [token]/page.tsx
│   └── layout.tsx
├── components/tracking/
│   ├── TrackingMap.tsx
│   ├── MapboxTracker.tsx
│   ├── GoogleMapsTracker.tsx
│   ├── StaticMapView.tsx
│   ├── TechnicianMarker.tsx
│   ├── ETADisplay.tsx
│   ├── ProgressBar.tsx
│   ├── TechnicianCard.tsx
│   └── ContactButtons.tsx
├── lib/tracking/
│   ├── tracking-client.ts
│   ├── marker-animation.ts
│   └── tracking.hooks.ts
```

**Page Design:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🔧 ServiFrío - Tu servicio en camino          [Logo]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │    [LIVE MAP - Provider based on tier]              │   │
│  │                                                     │   │
│  │         📍 Tu casa                                  │   │
│  │              ╲                                      │   │
│  │               ╲  ← Animated route line              │   │
│  │                ╲                                    │   │
│  │              🚐 ← Cute van icon (moves every 10s)  │   │
│  │             Carlos                                  │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ⏱️ Llegada estimada: 12 min (~14:30)               │   │
│  │  ████████████░░░░░░░░  ← Progress bar               │   │
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
└─────────────────────────────────────────────────────────────┘
```

**Tasks:**
- [ ] 9.9.7.1 Create tracking page with token validation
- [ ] 9.9.7.2 Implement tier-based map component selection
- [ ] 9.9.7.3 Build animated technician marker (smooth 2-second transitions)
- [ ] 9.9.7.4 Create ETA display with countdown
- [ ] 9.9.7.5 Implement progress bar visualization
- [ ] 9.9.7.6 Build technician profile card with rating
- [ ] 9.9.7.7 Add contact buttons (call, WhatsApp)
- [ ] 9.9.7.8 Create job details display
- [ ] 9.9.7.9 Implement 10-second polling for position updates
- [ ] 9.9.7.10 Add "arrived" state transition UI
- [ ] 9.9.7.11 Apply organization branding (logo, colors)

### 9.9.8 Marker Animation Implementation
```
Location: /apps/web/lib/tracking/marker-animation.ts
```

**Smooth Animation Logic:**
```typescript
class TechnicianMarker {
  animateTo(newPosition: LatLng, duration = 2000) {
    const start = this.marker.getPosition();
    const startTime = performance.now();

    // Calculate rotation angle (van faces direction of travel)
    const angle = this.calculateBearing(start, newPosition);
    this.element.style.transform = `rotate(${angle}deg)`;

    // Smooth position animation with ease-out
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const lat = start.lat + (newPosition.lat - start.lat) * easeOut;
      const lng = start.lng + (newPosition.lng - start.lng) * easeOut;

      this.marker.setPosition({ lat, lng });

      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }
}
```

**Tasks:**
- [ ] 9.9.8.1 Implement TechnicianMarker class for Mapbox
- [ ] 9.9.8.2 Implement TechnicianMarker class for Google Maps
- [ ] 9.9.8.3 Add bearing calculation for marker rotation
- [ ] 9.9.8.4 Create custom van/truck SVG marker
- [ ] 9.9.8.5 Implement ease-out animation curve

### 9.9.9 WhatsApp Template for Tracking
```
Location: /src/integrations/whatsapp/templates/
Files to modify:
└── template-registry.ts (add tracking template)
```

**Template Definition:**
```typescript
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
          url: 'https://track.campotech.com.ar/{{1}}',
          example: ['xK9mNp2qR5tY8wZ1']
        }
      ]
    }
  ]
}
```

**Tasks:**
- [ ] 9.9.9.1 Create tracking WhatsApp template
- [ ] 9.9.9.2 Submit template to Meta for approval
- [ ] 9.9.9.3 Implement template sending when job status → EN_ROUTE
- [ ] 9.9.9.4 Add fallback SMS for customers without WhatsApp

### 9.9.10 Job Status Integration
```
Location: /src/modules/jobs/
Files to modify:
├── job.service.ts (add tracking triggers)
└── job-state-machine.ts (add tracking events)
```

**Status → Tracking Events:**

| Job Status | Tracking Action |
|------------|-----------------|
| ASSIGNED → EN_ROUTE | Create session, generate token, send WhatsApp |
| EN_ROUTE → ARRIVED | Update session status, notify customer |
| ARRIVED → IN_PROGRESS | Mark session arrived |
| IN_PROGRESS → COMPLETED | Complete session, archive history |
| Any → CANCELLED | Cancel session, invalidate token |

**Tasks:**
- [ ] 9.9.10.1 Add tracking session creation on EN_ROUTE transition
- [ ] 9.9.10.2 Trigger WhatsApp notification with tracking link
- [ ] 9.9.10.3 Update session on ARRIVED status
- [ ] 9.9.10.4 Complete session on job completion
- [ ] 9.9.10.5 Handle cancellation cleanup

### 9.9.11 Cost Monitoring & Tier Enforcement
```
Location: /src/modules/tracking/billing/
Files to create:
├── tracking-usage.service.ts
├── tier-enforcer.ts
└── cost-calculator.ts
```

**Cost Calculation (per 100 customers, ~200 jobs/month):**

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

**Tasks:**
- [ ] 9.9.11.1 Implement tracking usage counter per organization
- [ ] 9.9.11.2 Create tier limit enforcement
- [ ] 9.9.11.3 Add cost tracking and alerts
- [ ] 9.9.11.4 Build usage dashboard for admins

### 9.9.12 Static Map Fallback (Básico Tier)
```
Location: /apps/web/components/tracking/StaticMapView.tsx
```

**For Básico tier, show static experience:**
- Single map image (Google Static Maps)
- ETA text only (no countdown)
- Manual refresh button
- No route line or animation

**Tasks:**
- [ ] 9.9.12.1 Create StaticMapView component
- [ ] 9.9.12.2 Generate static map URL with technician marker
- [ ] 9.9.12.3 Add manual refresh button
- [ ] 9.9.12.4 Show simplified ETA text

### 9.9.13 Security & Privacy
```
Location: /src/modules/tracking/security/
Files to create:
├── token-validator.ts
├── rate-limiter.ts
└── privacy-controls.ts
```

**Security Measures:**
- Short-lived tokens (4-hour expiry)
- Rate limiting on tracking endpoint (60 req/min per token)
- No exact technician home location
- Location history retention: 7 days
- Option to disable tracking per job

**Tasks:**
- [ ] 9.9.13.1 Implement token validation middleware
- [ ] 9.9.13.2 Add rate limiting to tracking endpoints
- [ ] 9.9.13.3 Create location history retention policy (7 days)
- [ ] 9.9.13.4 Add per-job tracking opt-out
- [ ] 9.9.13.5 Implement privacy buffer (don't show exact start location)

---

## PHASE 9.10: MOBILE-FIRST ARCHITECTURE
**Duration:** Weeks 25-26 (2 weeks)
**Team:** 2 Mobile Engineers, 1 Backend Engineer, 1 Frontend Engineer
**Priority:** High - Essential for Argentine market adoption

### Overview: Core Principle

**A plumber starting their business with only a smartphone must be able to run their entire operation from CampoTech mobile app. No laptop required.**

```
Reality of Argentine tradespeople:
┌─────────────────────────────────────────────────────────────┐
│  👷 Juan wants to start a plumbing business                │
│                                                             │
│  What he has:                                               │
│  ✅ Smartphone (probably Android)                          │
│  ✅ WhatsApp                                                │
│  ✅ Tools and skills                                        │
│  ❌ Laptop                                                  │
│  ❌ Office                                                  │
│  ❌ IT knowledge                                            │
│                                                             │
│  CampoTech must work 100% on his phone                      │
│  or we lose this customer to competitors                    │
└─────────────────────────────────────────────────────────────┘
```

**Market Reality:**
- 85%+ of Argentine SMB owners manage business primarily from phone
- Many tradespeople have never owned a laptop
- Field service = always on the move
- Phone is the office, cash register, and communication hub

### 9.10.1 Feature Parity Audit
```
Location: Documentation
Files to create:
├── docs/mobile-parity-checklist.md
└── docs/mobile-first-guidelines.md
```

**Feature Parity Matrix:**

| Feature | Mobile App | Web Dashboard | Status |
|---------|------------|---------------|--------|
| Account Setup | ✅ Full signup from phone | ✅ Full | Required |
| Team Management | ✅ Add/edit/remove members | ✅ Same + bulk | Required |
| Job Creation | ✅ Full with voice input | ✅ Same | Required |
| Scheduling | ✅ Calendar + drag/drop | ✅ Same + views | Required |
| Job Assignment | ✅ One-tap assign | ✅ Same + bulk | Required |
| Customer Database | ✅ Full CRUD | ✅ Same + export | Required |
| Invoicing | ✅ Create + send | ✅ Same + batch | Required |
| Payments | ✅ Record + MercadoPago | ✅ Same | Required |
| Reports | ✅ Summary charts | ✅ Detailed + export | Enhanced web |
| Settings | ✅ Full configuration | ✅ Same | Required |

**Rule:** If it's in the web dashboard, it MUST be in the mobile app (even if simplified).

**Tasks:**
- [ ] 9.10.1.1 Audit current mobile app for missing features
- [ ] 9.10.1.2 Create parity checklist document
- [ ] 9.10.1.3 Identify web-only features that need mobile implementation
- [ ] 9.10.1.4 Create mobile-first design guidelines document

### 9.10.2 Mobile Account Setup Flow
```
Location (mobile): /apps/mobile/
Files to create/modify:
├── app/(auth)/
│   ├── signup/
│   │   ├── page.tsx
│   │   ├── business-info.tsx
│   │   ├── services.tsx
│   │   └── verification.tsx
│   └── onboarding/
│       ├── layout.tsx
│       ├── welcome.tsx
│       ├── setup-business.tsx
│       └── add-first-team.tsx
├── components/signup/
│   ├── BusinessTypeSelector.tsx
│   ├── ServiceSelector.tsx
│   ├── CoverageZonePicker.tsx
│   └── PhoneVerification.tsx
```

**Tasks:**
- [ ] 9.10.2.1 Implement full signup flow on mobile
- [ ] 9.10.2.2 Create business setup wizard (services, coverage area)
- [ ] 9.10.2.3 Build phone verification with OTP
- [ ] 9.10.2.4 Add "Add first team member" step
- [ ] 9.10.2.5 Implement progress indicator for setup
- [ ] 9.10.2.6 Create skip options for optional steps

### 9.10.3 Mobile Team Management
```
Location (mobile): /apps/mobile/
Files to create:
├── app/(tabs)/team/
│   ├── index.tsx (Team List)
│   ├── add.tsx (Add Member)
│   ├── [id]/index.tsx (Member Detail)
│   └── [id]/edit.tsx (Edit Member)
├── components/team/
│   ├── TeamMemberCard.tsx
│   ├── AddMemberForm.tsx
│   ├── RoleSelector.tsx
│   ├── SkillLevelPicker.tsx
│   └── SpecialtySelector.tsx
```

**Mobile Team Management UI:**
```
┌─────────────────────────────────────────┐
│ ← Agregar Técnico                       │
├─────────────────────────────────────────┤
│                                         │
│  📷 [Agregar foto]                      │
│                                         │
│  Nombre *                               │
│  ┌─────────────────────────────────┐   │
│  │ Juan Pérez                      │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Teléfono *                             │
│  ┌──────┐ ┌──────────────────────┐     │
│  │🇦🇷+54│ │ 11 5678 1234         │     │
│  └──────┘ └──────────────────────┘     │
│                                         │
│  Email *                                │
│  ┌─────────────────────────────────┐   │
│  │ juan@email.com                  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Rol                                    │
│  ┌─────────────────────────────────┐   │
│  │ Técnico                       ▼ │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Especialidad                           │
│  ┌─────────────────────────────────┐   │
│  │ Instalación de splits         ▼ │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ☑️ Enviar invitación por WhatsApp      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │        AGREGAR TÉCNICO          │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**Tasks:**
- [ ] 9.10.3.1 Build team list screen with search
- [ ] 9.10.3.2 Create add team member form
- [ ] 9.10.3.3 Implement role selector
- [ ] 9.10.3.4 Add skill level picker (UOCRA categories)
- [ ] 9.10.3.5 Build specialty selector
- [ ] 9.10.3.6 Implement WhatsApp invitation sending
- [ ] 9.10.3.7 Create member detail/edit screens
- [ ] 9.10.3.8 Add member removal with confirmation

### 9.10.4 Mobile Scheduling View
```
Location (mobile): /apps/mobile/
Files to create:
├── app/(tabs)/calendar/
│   ├── index.tsx (Day View)
│   ├── week.tsx (Week View)
│   └── month.tsx (Month View)
├── components/calendar/
│   ├── DaySchedule.tsx
│   ├── WeekView.tsx
│   ├── JobSlot.tsx
│   ├── AssignmentSheet.tsx
│   └── QuickAssign.tsx
```

**Mobile Scheduling UI:**
```
┌─────────────────────────────────────────┐
│ 📅 Hoy - Lunes 9 Dic           [+ Nuevo]│
├─────────────────────────────────────────┤
│                                         │
│  09:00 ┌────────────────────────────┐  │
│        │ 🔧 Instalación split       │  │
│        │ María López - Palermo      │  │
│        │ [Carlos R.] ⭐             │  │
│        └────────────────────────────┘  │
│                                         │
│  12:00 ┌────────────────────────────┐  │
│        │ 🔧 Reparación              │  │
│        │ Pedro García - Belgrano    │  │
│        │ [Sin asignar] ⚠️           │  │
│        │                            │  │
│        │ [Asignarme] [Asignar otro] │  │
│        └────────────────────────────┘  │
│                                         │
│  16:00 ┌────────────────────────────┐  │
│        │ 🔧 Mantenimiento           │  │
│        │ Ana Ruiz - Recoleta        │  │
│        │ [Carlos R.] ⭐             │  │
│        └────────────────────────────┘  │
│                                         │
├─────────────────────────────────────────┤
│  [◀ Ayer]   [Hoy]   [Mañana ▶]         │
├─────────────────────────────────────────┤
│ 🏠   📅   ➕   👥   ⚙️               │
│ Home Cal  New Team  Settings           │
└─────────────────────────────────────────┘
```

**Tasks:**
- [ ] 9.10.4.1 Build day view calendar
- [ ] 9.10.4.2 Create job slot component
- [ ] 9.10.4.3 Implement quick assign sheet
- [ ] 9.10.4.4 Add "Assign to me" one-tap action
- [ ] 9.10.4.5 Build week view (horizontal scroll)
- [ ] 9.10.4.6 Create month overview
- [ ] 9.10.4.7 Implement navigation between days

### 9.10.5 Mobile Customer Management
```
Location (mobile): /apps/mobile/
Files to create:
├── app/(tabs)/customers/
│   ├── index.tsx (List)
│   ├── add.tsx (New Customer)
│   ├── [id]/index.tsx (Detail)
│   └── [id]/edit.tsx (Edit)
├── components/customers/
│   ├── CustomerCard.tsx
│   ├── CustomerForm.tsx
│   ├── CustomerHistory.tsx
│   ├── CUITInput.tsx
│   └── AddressInput.tsx
```

**Tasks:**
- [ ] 9.10.5.1 Build customer list with search and filters
- [ ] 9.10.5.2 Create customer detail view
- [ ] 9.10.5.3 Implement customer creation form
- [ ] 9.10.5.4 Add CUIT validation component
- [ ] 9.10.5.5 Build address input with autocomplete
- [ ] 9.10.5.6 Show customer job history
- [ ] 9.10.5.7 Add quick actions (call, WhatsApp, new job)

### 9.10.6 Mobile Invoicing
```
Location (mobile): /apps/mobile/
Files to create:
├── app/(tabs)/invoices/
│   ├── index.tsx (List)
│   ├── create.tsx (New Invoice)
│   ├── [id]/index.tsx (Detail)
│   └── [id]/send.tsx (Send)
├── components/invoices/
│   ├── InvoiceCard.tsx
│   ├── InvoiceForm.tsx
│   ├── LineItemEditor.tsx
│   ├── TaxCalculator.tsx
│   ├── InvoicePDFViewer.tsx
│   └── SendInvoiceSheet.tsx
```

**Tasks:**
- [ ] 9.10.6.1 Build invoice list with status filters
- [ ] 9.10.6.2 Create invoice detail view with PDF preview
- [ ] 9.10.6.3 Implement invoice creation from job
- [ ] 9.10.6.4 Add line item editor
- [ ] 9.10.6.5 Build tax calculation display
- [ ] 9.10.6.6 Implement send via WhatsApp/email
- [ ] 9.10.6.7 Add payment recording

### 9.10.7 Mobile Settings
```
Location (mobile): /apps/mobile/
Files to create:
├── app/settings/
│   ├── index.tsx (Main Settings)
│   ├── business/page.tsx
│   ├── notifications/page.tsx
│   ├── integrations/page.tsx
│   └── billing/page.tsx
├── components/settings/
│   ├── SettingsSection.tsx
│   ├── SettingsRow.tsx
│   ├── BusinessInfoForm.tsx
│   └── NotificationPreferences.tsx
```

**Tasks:**
- [ ] 9.10.7.1 Build main settings screen
- [ ] 9.10.7.2 Create business information editor
- [ ] 9.10.7.3 Implement notification preferences
- [ ] 9.10.7.4 Add integration settings (WhatsApp, MercadoPago)
- [ ] 9.10.7.5 Build subscription/billing view

### 9.10.8 Offline Capability Enhancement
```
Location (mobile): /apps/mobile/lib/offline/
Files to create:
├── offline-manager.ts
├── sync-queue.ts
├── conflict-resolver.ts
├── offline-storage.ts
└── network-monitor.ts
```

**Essential Offline Features:**

| Feature | Offline Support | Sync Behavior |
|---------|-----------------|---------------|
| View schedule | ✅ Cached | Auto on reconnect |
| View customer details | ✅ Cached | Auto on reconnect |
| Update job status | ✅ Queued | Auto sync |
| Take photos | ✅ Stored locally | Background upload |
| Record notes | ✅ Queued | Auto sync |
| View maps | ❌ Network required | - |
| Send messages | ✅ Queued | Auto send |
| Create invoice | ❌ Network required | - |

**Tasks:**
- [ ] 9.10.8.1 Implement offline storage for jobs and customers
- [ ] 9.10.8.2 Create sync queue for offline operations
- [ ] 9.10.8.3 Build conflict resolution UI
- [ ] 9.10.8.4 Implement photo queue with background upload
- [ ] 9.10.8.5 Add offline indicator in app header
- [ ] 9.10.8.6 Create sync progress display
- [ ] 9.10.8.7 Handle network state changes

### 9.10.9 Mobile Performance Optimization
```
Location (mobile): /apps/mobile/
Files to modify/optimize:
├── Performance profiling
├── Memory management
├── Bundle size
└── Cold start time
```

**Target: Samsung Galaxy A10 (low-end device)**
- Cold start: < 4 seconds
- Memory footprint: < 150MB
- Bundle size: < 30MB

**Tasks:**
- [ ] 9.10.9.1 Profile cold start on low-end devices
- [ ] 9.10.9.2 Implement code splitting
- [ ] 9.10.9.3 Optimize images and assets
- [ ] 9.10.9.4 Use FlashList for all list components
- [ ] 9.10.9.5 Implement lazy loading for non-critical screens
- [ ] 9.10.9.6 Optimize WatermelonDB queries
- [ ] 9.10.9.7 Reduce JavaScript bundle size

### 9.10.10 Voice Input Integration
```
Location (mobile): /apps/mobile/
Files to create:
├── lib/voice/
│   ├── voice-input.service.ts
│   ├── speech-recognition.ts
│   └── voice-commands.ts
├── components/voice/
│   ├── VoiceInputButton.tsx
│   └── VoiceRecordingModal.tsx
```

**Voice Input Use Cases:**
- Creating job notes
- Adding customer notes
- Search by voice
- Job description dictation

**Tasks:**
- [ ] 9.10.10.1 Implement speech recognition integration
- [ ] 9.10.10.2 Create voice input button component
- [ ] 9.10.10.3 Add voice input to job notes
- [ ] 9.10.10.4 Implement voice search
- [ ] 9.10.10.5 Build voice recording modal with visualization

### 9.10.11 Mobile-First Onboarding Message
```
Location: All marketing and onboarding materials
```

**Correct onboarding message:**
```
"Descargá la app CampoTech para manejar tu negocio desde el celular.
Si tenés computadora, también podés acceder desde campotech.com.ar"
```

**NOT:**
```
"Registrate en campotech.com.ar y descargá la app para tus técnicos."
```

**Tasks:**
- [ ] 9.10.11.1 Update all marketing copy to mobile-first language
- [ ] 9.10.11.2 Modify onboarding emails to promote mobile first
- [ ] 9.10.11.3 Update app store descriptions
- [ ] 9.10.11.4 Create mobile-first demo videos

---

## PHASE 9.11: TECHNICAL ARCHITECTURE DOCUMENTATION
**Duration:** Week 27 (1 week, parallel with development)
**Team:** 1 Senior Engineer + Technical Writer
**Priority:** Medium - Essential for team scaling and maintenance

### 9.11.1 Architecture Documentation
```
Location: /docs/architecture/
Files to create:
├── overview.md
├── high-level-architecture.md
├── data-flow.md
├── security-architecture.md
├── integration-patterns.md
└── decision-records/
    ├── ADR-001-whatsapp-aggregator-model.md
    ├── ADR-002-mobile-first-strategy.md
    ├── ADR-003-map-provider-selection.md
    └── ADR-004-offline-sync-strategy.md
```

### High-Level Architecture Diagram

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
│  ├── /api/tracking/*       Live tracking                            │
│  └── /api/webhooks/*       External service callbacks               │
└──────────┬─────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BUSINESS LOGIC                                  │
├─────────────────────────────────────────────────────────────────────┤
│  src/                                                               │
│  ├── integrations/                                                  │
│  │   ├── whatsapp/          WhatsApp Business API + Aggregation     │
│  │   ├── voice-ai/          Whisper + GPT extraction                │
│  │   ├── mercadopago/       Payments                                │
│  │   └── afip/              Argentine tax invoicing                 │
│  ├── modules/                                                       │
│  │   ├── tracking/          Live location tracking                  │
│  │   ├── notifications/     Multi-channel notifications             │
│  │   └── ...                                                        │
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
│  ├── Customers              ├── Message buffers                     │
│  ├── Invoices               ├── Tracking cache                      │
│  ├── Tracking sessions      └── Cache                               │
│  └── Notifications                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Tasks:**
- [ ] 9.11.1.1 Create architecture overview documentation
- [ ] 9.11.1.2 Document data flow diagrams
- [ ] 9.11.1.3 Write security architecture documentation
- [ ] 9.11.1.4 Create integration patterns guide
- [ ] 9.11.1.5 Write architecture decision records (ADRs)

### 9.11.2 Key File Locations Reference

| Component | Location |
|-----------|----------|
| WhatsApp webhook handler | `src/integrations/whatsapp/webhook/webhook.handler.ts` |
| Message aggregator | `src/integrations/whatsapp/aggregation/message-aggregator.service.ts` |
| GPT extraction | `src/integrations/voice-ai/extraction/gpt-extractor.ts` |
| Extraction prompts | `src/integrations/voice-ai/extraction/prompts/extraction.prompt.ts` |
| Confidence routing | `src/integrations/voice-ai/routing/confidence-router.ts` |
| WhatsApp templates | `src/integrations/whatsapp/templates/template-registry.ts` |
| Tracking service | `src/modules/tracking/tracking.service.ts` |
| ETA calculator | `src/modules/tracking/eta/eta-calculator.service.ts` |
| Team member management | `apps/web/app/dashboard/settings/team/page.tsx` |
| User API (create members) | `apps/web/app/api/users/route.ts` |
| AFIP integration | `src/integrations/afip/` |
| MercadoPago integration | `src/integrations/mercadopago/` |

**Tasks:**
- [ ] 9.11.2.1 Create file location reference document
- [ ] 9.11.2.2 Add inline code documentation for key files
- [ ] 9.11.2.3 Create module dependency diagram

---

## POST-MVP ROADMAP

---

## PHASE 10: ADVANCED ANALYTICS & REPORTING
**Duration:** Weeks 28-30
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
**Duration:** Weeks 31-33
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
**Duration:** Weeks 34-37
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
**Duration:** Weeks 38-41
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
**Duration:** Weeks 42-44
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

### Estimated Effort by Phase (Enhanced MVP)

| Phase | Estimated Hours | Key Deliverables |
|-------|-----------------|------------------|
| **Phase 9.5** | ~120 hours | Employee onboarding, SMS/WhatsApp verification |
| **Phase 9.6** | ~200 hours | Notification preferences, multi-channel delivery |
| **Phase 9.7** | ~150 hours | Argentine Spanish localization, WhatsApp-first |
| **Phase 9.8** | ~200 hours | Message aggregation, 8-second buffer, trigger detection |
| **Phase 9.9** | ~400 hours | Live tracking, tier-based maps, animated markers, ETA |
| **Phase 9.10** | ~450 hours | Full mobile parity, offline capability, voice input |
| **Phase 9.11** | ~80 hours | Architecture documentation, ADRs |

**Total Enhanced MVP Effort:** ~1600 additional developer hours

### Estimated Effort by Phase (Post-MVP)

| Phase | Estimated Hours | Key Deliverables |
|-------|-----------------|------------------|
| **Phase 10** | ~500 hours | Analytics infrastructure, KPIs, dashboards, reports |
| **Phase 11** | ~450 hours | Multi-location, zones, cross-location dispatch |
| **Phase 12** | ~600 hours | Full inventory system, purchasing, mobile features |
| **Phase 13** | ~550 hours | Customer portal, booking, tracking, payments |
| **Phase 14** | ~600 hours | Public API, developer portal, SDKs, integrations |

**Total Post-MVP Effort:** ~2700 additional developer hours

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

### Enhanced MVP Risks (Phases 9.5-9.11)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Message aggregation timing issues | Medium | Medium | Configurable window duration, fallback to immediate processing |
| Map provider API costs exceed budget | Medium | High | Strict tier enforcement, usage alerts, caching aggressively |
| GPS battery drain on technician phones | Medium | Medium | Adaptive polling frequency, battery-efficient tracking modes |
| Mobile feature parity scope creep | High | Medium | Strict parity checklist, prioritize core features |
| WhatsApp API rate limits hit | Low | High | Queue management, backpressure, per-org limits |
| OpenStreetMap temptation for cost savings | Low | High | Document why rejected (no BA traffic data), enforce decision |
| Offline sync conflicts | Medium | Medium | Clear conflict resolution rules, user-facing resolution UI |
| Low-end Android performance | Medium | High | Early A10 testing, bundle size budgets, performance profiling |

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

## FUTURE ROADMAP: CONSUMER MARKETPLACE

---

## PHASE 15: CONSUMER MARKETPLACE (FREE SERVICE FINDER)
**Duration:** Weeks 45-52 (8 weeks)
**Team:** 2 Backend Engineers, 2 Frontend Engineers, 2 Mobile Engineers, 1 Product Designer
**Priority:** Strategic - Market expansion opportunity
**Status:** Future planning (not in current roadmap)

### Strategic Overview: Two-Sided Marketplace

**Market Observation:**
Argentina has apps connecting consumers with service providers (plumbers, electricians, etc.), but they all charge the customer a fee or commission. This creates friction and drives consumers to informal WhatsApp groups or word-of-mouth.

**CampoTech Opportunity:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                    CAMPOTECH ECOSYSTEM                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐         ┌─────────────────────┐           │
│  │  BUSINESS PROFILE   │         │  CONSUMER PROFILE   │           │
│  │  (Current Build)    │         │  (Phase 15)         │           │
│  │                     │         │                     │           │
│  │  • Manage business  │         │  • Find services    │           │
│  │  • Team management  │   ◄──►  │  • View ratings     │           │
│  │  • Invoicing/AFIP   │         │  • Request quotes   │           │
│  │  • Job tracking     │         │  • Book directly    │           │
│  │  • Analytics        │         │  • Track technician │           │
│  │                     │         │                     │           │
│  │  💰 Paid subscription│         │  🆓 FREE forever    │           │
│  └─────────────────────┘         └─────────────────────┘           │
│                                                                     │
│  Revenue: Business subscriptions    Value: Lead generation          │
│                                     + Brand awareness               │
│                                     + Network effects               │
└─────────────────────────────────────────────────────────────────────┘
```

**Competitive Advantage:**
| Competitor Model | CampoTech Model |
|------------------|-----------------|
| Charges consumer 10-15% fee | FREE for consumers |
| Charges business per lead | Business pays flat subscription |
| Consumer = cost center | Consumer = lead magnet |
| Limited technician info | Full profile, ratings, history |

**Why This Works:**
1. **Zero marginal cost:** Consumer profiles use existing database infrastructure
2. **Lead generation:** Every consumer search is a potential customer for our business subscribers
3. **Network effects:** More consumers → more value for businesses → more businesses → more services for consumers
4. **Brand awareness:** Free app downloads → market presence → word of mouth

### 15.1 Consumer Profile Type & Authentication
```
Location: /src/modules/consumer/
Files to create:
├── consumer.service.ts
├── consumer.repository.ts
├── consumer.controller.ts
├── consumer.routes.ts
├── consumer-auth.service.ts
└── consumer.types.ts

Location: /database/migrations/
Files to create:
├── 050_create_consumer_profiles.sql
└── 051_create_service_requests.sql
```

**Database Schema:**
```sql
-- Consumer profiles (regular people looking for services)
CREATE TABLE consumer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Authentication (can be phone-only, no email required)
    phone TEXT NOT NULL UNIQUE,
    phone_verified BOOLEAN DEFAULT false,
    email TEXT,

    -- Profile
    first_name TEXT NOT NULL,
    last_name TEXT,
    profile_photo_url TEXT,

    -- Location (for service matching)
    default_address TEXT,
    default_lat DECIMAL(10, 8),
    default_lng DECIMAL(11, 8),
    neighborhood TEXT,                    -- "Palermo", "Belgrano"
    city TEXT DEFAULT 'Buenos Aires',

    -- Preferences
    preferred_contact TEXT DEFAULT 'whatsapp', -- 'whatsapp', 'phone', 'app'
    language TEXT DEFAULT 'es-AR',

    -- Stats
    total_requests INTEGER DEFAULT 0,
    total_jobs_completed INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service requests from consumers
CREATE TABLE consumer_service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_id UUID NOT NULL REFERENCES consumer_profiles(id),

    -- What they need
    service_category TEXT NOT NULL,       -- 'plumbing', 'electrical', 'hvac', etc.
    service_type TEXT,                    -- 'installation', 'repair', 'maintenance'
    description TEXT NOT NULL,

    -- Photos of the issue
    photo_urls TEXT[],
    voice_note_url TEXT,                  -- Audio description

    -- Location
    address TEXT NOT NULL,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),

    -- Timing
    urgency TEXT DEFAULT 'flexible',      -- 'emergency', 'today', 'this_week', 'flexible'
    preferred_date DATE,
    preferred_time_slot TEXT,             -- 'morning', 'afternoon', 'evening'

    -- Budget
    budget_range TEXT,                    -- 'under_5000', '5000_15000', '15000_50000', 'over_50000'

    -- Status
    status TEXT DEFAULT 'open',           -- 'open', 'quotes_received', 'accepted', 'completed', 'cancelled'

    -- Matching
    matched_businesses UUID[],            -- Businesses that received this request
    quotes_received INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- Consumer reviews of businesses (after job completion)
CREATE TABLE consumer_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_id UUID NOT NULL REFERENCES consumer_profiles(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    job_id UUID REFERENCES jobs(id),

    -- Ratings (1-5 stars)
    overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    punctuality_rating INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5),
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
    price_rating INTEGER CHECK (price_rating BETWEEN 1 AND 5),
    communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),

    -- Review content
    review_text TEXT,
    photos_urls TEXT[],

    -- Verification
    verified_job BOOLEAN DEFAULT false,   -- True if linked to actual completed job

    -- Response from business
    business_response TEXT,
    business_responded_at TIMESTAMPTZ,

    -- Moderation
    status TEXT DEFAULT 'published',      -- 'pending', 'published', 'flagged', 'removed'
    flagged_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(consumer_id, job_id)
);

-- Indexes
CREATE INDEX idx_consumer_profiles_phone ON consumer_profiles(phone);
CREATE INDEX idx_consumer_profiles_location ON consumer_profiles(city, neighborhood);
CREATE INDEX idx_service_requests_status ON consumer_service_requests(status, created_at);
CREATE INDEX idx_service_requests_category ON consumer_service_requests(service_category, status);
CREATE INDEX idx_consumer_reviews_org ON consumer_reviews(organization_id, status);
```

**Tasks:**
- [ ] 15.1.1 Create consumer_profiles table
- [ ] 15.1.2 Create consumer_service_requests table
- [ ] 15.1.3 Create consumer_reviews table
- [ ] 15.1.4 Implement phone-only authentication (no email required)
- [ ] 15.1.5 Build consumer profile CRUD API
- [ ] 15.1.6 Create service request API

### 15.2 Business Discovery & Ranking System
```
Location: /src/modules/discovery/
Files to create:
├── discovery.service.ts
├── search.service.ts
├── ranking.service.ts
├── matching.service.ts
├── geo-search.service.ts
└── discovery.types.ts
```

**Ranking Algorithm:**
```typescript
interface BusinessRankingFactors {
  // Rating factors (40% weight)
  averageRating: number;              // 1-5 stars
  totalReviews: number;               // More reviews = more trust
  recentReviewTrend: number;          // Recent ratings vs. historical
  verifiedReviewPercentage: number;   // Reviews from actual jobs

  // Activity factors (25% weight)
  responseTime: number;               // Average time to respond to requests
  acceptanceRate: number;             // % of requests they respond to
  completionRate: number;             // % of accepted jobs completed
  lastActiveAt: Date;                 // Recent activity bonus

  // Quality factors (20% weight)
  profileCompleteness: number;        // Photos, description, services listed
  licenseVerified: boolean;           // If applicable
  insuranceVerified: boolean;         // If applicable
  yearsInBusiness: number;

  // Relevance factors (15% weight)
  distanceToConsumer: number;         // Closer = better
  serviceMatch: number;               // How well services match request
  availabilityMatch: number;          // Can they do it when needed
}

function calculateBusinessScore(factors: BusinessRankingFactors): number {
  const ratingScore = (
    (factors.averageRating / 5) * 0.5 +
    Math.min(factors.totalReviews / 50, 1) * 0.3 +
    factors.verifiedReviewPercentage * 0.2
  ) * 0.40;

  const activityScore = (
    Math.max(0, 1 - factors.responseTime / 24) * 0.4 +  // Penalize >24h response
    factors.acceptanceRate * 0.3 +
    factors.completionRate * 0.3
  ) * 0.25;

  const qualityScore = (
    factors.profileCompleteness * 0.4 +
    (factors.licenseVerified ? 0.3 : 0) +
    (factors.insuranceVerified ? 0.3 : 0)
  ) * 0.20;

  const relevanceScore = (
    Math.max(0, 1 - factors.distanceToConsumer / 20) * 0.5 +  // Within 20km
    factors.serviceMatch * 0.3 +
    factors.availabilityMatch * 0.2
  ) * 0.15;

  return ratingScore + activityScore + qualityScore + relevanceScore;
}
```

**Tasks:**
- [ ] 15.2.1 Implement business search by category and location
- [ ] 15.2.2 Create ranking algorithm
- [ ] 15.2.3 Build geo-search with PostGIS
- [ ] 15.2.4 Implement service matching logic
- [ ] 15.2.5 Create search filters (rating, distance, availability)
- [ ] 15.2.6 Build search result caching

### 15.3 Business Public Profile
```
Location: /src/modules/discovery/profiles/
Files to create:
├── public-profile.service.ts
├── public-profile.controller.ts
└── profile-views.tracker.ts
```

**Public Profile Data (visible to consumers):**
```typescript
interface PublicBusinessProfile {
  // Basic info
  id: string;
  businessName: string;
  slug: string;                       // URL-friendly name
  logo: string;
  coverPhoto: string;
  description: string;

  // Services
  categories: string[];               // ['plumbing', 'gas']
  services: {
    name: string;
    description: string;
    priceRange?: string;              // "Desde $5.000"
  }[];

  // Location
  neighborhoods: string[];            // Areas they serve
  city: string;

  // Ratings
  rating: {
    overall: number;
    punctuality: number;
    quality: number;
    price: number;
    communication: number;
    totalReviews: number;
  };

  // Reviews (latest 10)
  recentReviews: {
    rating: number;
    text: string;
    consumerName: string;             // "María L."
    date: Date;
    photos?: string[];
    businessResponse?: string;
  }[];

  // Trust signals
  badges: string[];                   // ['verified', 'top_rated', 'fast_responder']
  yearsOnPlatform: number;
  totalJobsCompleted: number;
  responseTime: string;               // "Responde en menos de 1 hora"

  // Availability
  workingHours: {
    day: string;
    hours: string;
  }[];
  acceptingNewClients: boolean;

  // Contact (only shown after request)
  hasWhatsApp: boolean;
}
```

**Tasks:**
- [ ] 15.3.1 Create public profile API endpoint
- [ ] 15.3.2 Build profile view tracking (for business analytics)
- [ ] 15.3.3 Implement badge system (verified, top_rated, fast_responder)
- [ ] 15.3.4 Create profile photo gallery
- [ ] 15.3.5 Build "before/after" work showcase

### 15.4 Quote Request System
```
Location: /src/modules/quotes/
Files to create:
├── quote-request.service.ts
├── quote-matching.service.ts
├── quote.controller.ts
├── quote-notification.service.ts
└── quote.types.ts
```

**Quote Flow:**
```
Consumer creates request
         │
         ▼
┌─────────────────────────────────┐
│ System matches nearby businesses │
│ (max 5-10 based on ranking)     │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Businesses receive notification │
│ (WhatsApp + App push)           │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Business can:                   │
│ • View request details          │
│ • Send quote (price + timeline) │
│ • Decline (limited declines)    │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Consumer receives quotes        │
│ • Compare prices                │
│ • See business profiles         │
│ • Chat with business            │
│ • Accept one quote              │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Job created in business's       │
│ CampoTech dashboard             │
└─────────────────────────────────┘
```

**Tasks:**
- [ ] 15.4.1 Create quote request submission API
- [ ] 15.4.2 Build business matching algorithm
- [ ] 15.4.3 Implement quote submission from businesses
- [ ] 15.4.4 Create quote comparison view for consumers
- [ ] 15.4.5 Build in-app chat for quote clarification
- [ ] 15.4.6 Implement quote acceptance and job creation
- [ ] 15.4.7 Add WhatsApp notifications for new requests

### 15.5 Consumer Mobile App
```
Location (mobile): /apps/mobile/
Files to create:
├── app/(consumer)/
│   ├── layout.tsx
│   ├── page.tsx (Home - Search)
│   ├── search/
│   │   ├── page.tsx (Search Results)
│   │   ├── [category]/page.tsx
│   │   └── filters.tsx
│   ├── business/
│   │   └── [id]/page.tsx (Business Profile)
│   ├── request/
│   │   ├── new.tsx (Create Request)
│   │   ├── [id]/page.tsx (Request Detail)
│   │   └── quotes/page.tsx (Compare Quotes)
│   ├── jobs/
│   │   ├── page.tsx (My Jobs)
│   │   └── [id]/page.tsx (Job Detail + Tracking)
│   ├── reviews/
│   │   └── new/[jobId]/page.tsx
│   └── profile/
│       └── page.tsx
├── components/consumer/
│   ├── CategoryGrid.tsx
│   ├── BusinessCard.tsx
│   ├── BusinessProfile.tsx
│   ├── RatingStars.tsx
│   ├── ReviewCard.tsx
│   ├── QuoteCard.tsx
│   ├── RequestForm.tsx
│   └── ServiceRequestCard.tsx
```

**Consumer Home Screen:**
```
┌─────────────────────────────────────────┐
│ 📍 Palermo, Buenos Aires        [👤]    │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🔍 ¿Qué necesitás?              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Categorías populares                   │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 🔧 │ │ ⚡ │ │ ❄️ │ │ 🔨 │      │
│  │Plom.│ │Elec.│ │Aire │ │Const│      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 🔒 │ │ 🎨 │ │ 🚿 │ │ ➕ │      │
│  │Cerr.│ │Pint.│ │Gasf.│ │ Más │      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│                                         │
│  ⭐ Mejor valorados cerca tuyo          │
│  ┌─────────────────────────────────┐   │
│  │ ServiFrío                       │   │
│  │ ⭐ 4.9 (234) • Aire acond.      │   │
│  │ 📍 2.3km • "Responde en 30min"  │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ Plomería Express                │   │
│  │ ⭐ 4.7 (189) • Plomería         │   │
│  │ 📍 1.8km • "Disponible hoy"     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  📋 Mis solicitudes (2)                 │
│  ┌─────────────────────────────────┐   │
│  │ Reparación aire - 3 presupuestos│   │
│  │ Hace 2 horas                    │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│ 🏠   🔍   ➕   📋   👤                 │
│ Home Search New  Jobs Profile           │
└─────────────────────────────────────────┘
```

**Tasks:**
- [ ] 15.5.1 Create consumer app navigation structure
- [ ] 15.5.2 Build category grid home screen
- [ ] 15.5.3 Implement search with filters
- [ ] 15.5.4 Create business profile view
- [ ] 15.5.5 Build request creation flow with photos
- [ ] 15.5.6 Implement quote comparison screen
- [ ] 15.5.7 Create job tracking (reuse Phase 9.9 tracking)
- [ ] 15.5.8 Build review submission flow
- [ ] 15.5.9 Implement consumer profile management

### 15.6 App Mode Switching
```
Location (mobile): /apps/mobile/
Files to modify:
├── app/_layout.tsx (add mode detection)
├── lib/auth/
│   ├── mode-switcher.ts
│   └── dual-profile.service.ts
```

**Dual Profile Support:**
```typescript
// User can have both profiles
interface UserProfiles {
  // Business profile (if they have a business)
  businessProfile?: {
    organizationId: string;
    role: 'OWNER' | 'ADMIN' | 'TECHNICIAN';
  };

  // Consumer profile (everyone can have this)
  consumerProfile?: {
    consumerId: string;
  };
}

// App mode switching
type AppMode = 'business' | 'consumer';

// A plumber can:
// 1. Use business mode to manage their plumbing business
// 2. Switch to consumer mode to find an electrician for their home
```

**Tasks:**
- [ ] 15.6.1 Implement dual profile detection
- [ ] 15.6.2 Create mode switcher UI in app header
- [ ] 15.6.3 Build "Add business profile" upsell for consumers
- [ ] 15.6.4 Create "Use as consumer" option for business users
- [ ] 15.6.5 Implement seamless navigation between modes

### 15.7 Business Dashboard Integration
```
Location: /apps/web/app/(dashboard)/leads/
Files to create:
├── page.tsx (Consumer Requests)
├── [id]/page.tsx (Request Detail)
├── settings/page.tsx (Lead Preferences)
├── components/
│   ├── LeadCard.tsx
│   ├── QuoteForm.tsx
│   └── LeadFilters.tsx
```

**Business View of Consumer Requests:**
```
┌─────────────────────────────────────────────────────────────┐
│ Solicitudes de Clientes                    [⚙️ Preferencias]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔴 Nuevas (3)                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Instalación split 3000 frigorías                    │   │
│  │ 📍 Palermo, 2.1km • ⏱️ Esta semana                  │   │
│  │ 💰 $15.000 - $50.000                                │   │
│  │                                                     │   │
│  │ "Necesito instalar un split en mi departamento..." │   │
│  │ 📷 3 fotos adjuntas                                 │   │
│  │                                                     │   │
│  │ [Ver detalle]  [Enviar presupuesto]  [No me interesa]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⏳ Presupuesto enviado (2)                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Reparación pérdida de agua                          │   │
│  │ Tu presupuesto: $8.500 • Enviado hace 2h           │   │
│  │ Estado: Esperando respuesta (2 competidores)        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ✅ Ganados este mes: 12 trabajos                           │
└─────────────────────────────────────────────────────────────┘
```

**Tasks:**
- [ ] 15.7.1 Create lead inbox in business dashboard
- [ ] 15.7.2 Build quote submission form
- [ ] 15.7.3 Implement lead notification preferences
- [ ] 15.7.4 Create lead-to-job conversion flow
- [ ] 15.7.5 Build lead analytics (win rate, response time)

### 15.8 Rating & Review System
```
Location: /src/modules/reviews/
Files to create:
├── review.service.ts
├── review.repository.ts
├── review.controller.ts
├── review-moderation.service.ts
├── rating-aggregator.ts
└── review.types.ts
```

**Review Verification:**
```typescript
enum ReviewVerification {
  VERIFIED = 'verified',       // Linked to completed job
  UNVERIFIED = 'unverified',   // Consumer claims they used service
  PENDING = 'pending',         // Awaiting verification
}

// Trust scoring for reviews
function calculateReviewTrust(review: Review): number {
  let trust = 0.5; // Base trust

  if (review.linkedJobId) trust += 0.3;           // Verified job
  if (review.hasPhotos) trust += 0.1;             // Photos add credibility
  if (review.consumerHasHistory) trust += 0.1;    // Established consumer

  return Math.min(trust, 1.0);
}
```

**Tasks:**
- [ ] 15.8.1 Create review submission API
- [ ] 15.8.2 Implement review verification (job linking)
- [ ] 15.8.3 Build rating aggregation service
- [ ] 15.8.4 Create review moderation queue
- [ ] 15.8.5 Implement business response feature
- [ ] 15.8.6 Build fake review detection
- [ ] 15.8.7 Create review analytics for businesses

### 15.9 Trust & Safety
```
Location: /src/modules/trust/
Files to create:
├── trust.service.ts
├── verification.service.ts
├── fraud-detection.ts
├── report.service.ts
└── trust.types.ts
```

**Trust Signals:**

| Signal | Implementation | Display |
|--------|----------------|---------|
| Verified Business | CUIT validation | ✅ Negocio verificado |
| License Verified | Manual upload + review | 🎓 Matrícula verificada |
| Insurance Verified | Manual upload + review | 🛡️ Seguro al día |
| Background Check | Integration with AFIP/ANSES | ✓ Antecedentes verificados |
| Response Time | Auto-calculated | ⚡ Responde en <1h |
| Top Rated | Rating + volume threshold | ⭐ Mejor valorado |

**Tasks:**
- [ ] 15.9.1 Implement business verification flow
- [ ] 15.9.2 Create license/insurance upload and review
- [ ] 15.9.3 Build fraud detection for fake reviews
- [ ] 15.9.4 Implement consumer reporting system
- [ ] 15.9.5 Create business suspension for violations
- [ ] 15.9.6 Build trust score display

### 15.10 Marketing & Growth
```
Location: /src/modules/growth/
Files to create:
├── referral.service.ts
├── promotion.service.ts
├── seo-pages.generator.ts
└── growth.types.ts
```

**Growth Strategies:**

1. **SEO Landing Pages:**
   - `/plomero-palermo` → Plumbers in Palermo
   - `/electricista-belgrano` → Electricians in Belgrano
   - Auto-generated from business data

2. **Consumer Referrals:**
   - "Invitá a un amigo" → Both get priority matching

3. **Business Upsell:**
   - Consumer sees "¿Tenés un negocio de servicios?" banner
   - Easy conversion path from consumer to business

**Tasks:**
- [ ] 15.10.1 Create SEO landing page generator
- [ ] 15.10.2 Implement referral system
- [ ] 15.10.3 Build consumer → business upsell flow
- [ ] 15.10.4 Create share functionality for businesses

### 15.11 Analytics for Consumer Marketplace
```
Location: /src/analytics/marketplace/
Files to create:
├── marketplace-metrics.ts
├── conversion-tracking.ts
├── funnel-analyzer.ts
└── marketplace-reports.ts
```

**Key Metrics:**

| Metric | Definition | Target |
|--------|------------|--------|
| Consumer acquisition | New consumer signups/month | Growth |
| Request volume | Service requests created/month | Growth |
| Quote response rate | % of requests that get quotes | >80% |
| Quote-to-job conversion | % of quotes that become jobs | >25% |
| Consumer satisfaction | Post-job rating average | >4.5 |
| Business lead quality | Business satisfaction with leads | >4.0 |
| Time to first quote | Average time from request to first quote | <2 hours |

**Tasks:**
- [ ] 15.11.1 Implement marketplace analytics dashboard
- [ ] 15.11.2 Create conversion funnel tracking
- [ ] 15.11.3 Build A/B testing framework for marketplace
- [ ] 15.11.4 Implement cohort analysis for consumers

### Estimated Effort (Phase 15)

| Component | Estimated Hours |
|-----------|-----------------|
| Database & Backend | ~400 hours |
| Consumer Mobile App | ~350 hours |
| Business Dashboard Integration | ~150 hours |
| Ranking & Discovery | ~200 hours |
| Trust & Safety | ~150 hours |
| Marketing & Growth | ~100 hours |
| **Total Phase 15** | **~1350 hours** |

### Phase 15 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Low consumer adoption | Medium | High | Strong marketing, free value proposition |
| Businesses overwhelmed by leads | Medium | Medium | Lead volume controls, qualification |
| Fake reviews manipulation | High | High | Verification system, moderation |
| Business confusion (two modes) | Medium | Medium | Clear UX, onboarding |
| Support burden increases | Medium | Medium | Self-service tools, FAQ |

---

## COMPLETE TIMELINE SUMMARY

```
YEAR 1 (Weeks 1-44): Core Platform
├── Weeks 1-18:   MVP Launch (Phases 1-9)
├── Weeks 19-27:  Enhanced MVP (Phases 9.5-9.11)
└── Weeks 28-44:  Post-MVP (Phases 10-14)

YEAR 2 (Weeks 45-52+): Market Expansion
└── Weeks 45-52:  Consumer Marketplace (Phase 15)

Total Estimated Effort:
├── MVP (Phases 1-9):           ~2,500 hours
├── Enhanced MVP (9.5-9.11):    ~1,600 hours
├── Post-MVP (Phases 10-14):    ~2,700 hours
├── Marketplace (Phase 15):     ~1,350 hours
└── GRAND TOTAL:                ~8,150 hours
```

---

*This plan should be reviewed weekly and adjusted based on actual velocity and learnings.*
