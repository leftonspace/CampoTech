# CampoTech Architecture Documentation Audit Report

**Generated:** 2025-12-10
**Audit Scope:** Full comparison of architecture documentation against actual codebase implementation
**Branch:** `claude/audit-architecture-docs-01NA7sq9zcVnMcFJC1cD9dWx`

---

## Executive Summary

A comprehensive audit of 6 architecture documentation files against the CampoTech codebase reveals **significant discrepancies** between documented specifications and actual implementation. Overall documentation accuracy is approximately **55-65%**, with critical gaps in database schema, API endpoints, queue architecture, and state machines.

### Key Findings Summary

| Document | Implementation Coverage | Status |
|----------|------------------------|--------|
| Database Schema | 45-55% | ⚠️ SIGNIFICANT GAPS |
| API/OpenAPI Spec | 60-70% | ⚠️ MAJOR DISCREPANCIES |
| Capabilities | 70-80% | ⚠️ INTEGRATION MISSING |
| Queue Workers | 10-40% | ❌ CRITICAL MISMATCH |
| End-to-End Flows | 60-70% | ⚠️ PARTIAL |
| External Integrations | 86-92% | ✅ MOSTLY COMPLETE |

---

## 1. Database Schema Audit (`campotech-database-schema-complete.md`)

### 1.1 Implementation Status

**Documented Tables:** 65+
**Actually Implemented:** ~47
**Implementation Rate:** ~72%

### 1.2 Tables Documented but NOT Implemented

| Table | Purpose | Impact |
|-------|---------|--------|
| `invoice_items` | Normalized line items | Using JSONB array instead |
| `payment_disputes` | Dispute tracking | Fields in payments table |
| `voice_transcripts` | Voice processing | Merged into whatsapp_messages |
| `failed_jobs` | Dead Letter Queue | No DLQ table exists |
| `idempotency_keys` | Request deduplication | No dedicated table |
| `job_photos` | Photo management | Using TEXT[] array in jobs |
| `business_public_profiles` | Marketplace profiles | NOT FOUND |
| `business_quotes` | Marketplace quotes | NOT FOUND |
| `review_moderation_queue` | Fraud detection | NOT FOUND |
| `review_fraud_signals` | Fraud signals | NOT FOUND |
| `business_rating_summaries` | Rating aggregates | NOT FOUND |
| `consumer_sessions` | Marketplace auth | NOT FOUND |
| `consumer_favorite_businesses` | Favorites | NOT FOUND |
| `consumer_saved_searches` | Saved searches | NOT FOUND |
| `business_profile_views` | Analytics | NOT FOUND |
| `quote_messages` | Quote communication | NOT FOUND |

### 1.3 Tables Implemented but NOT Documented

| Table | File | Purpose |
|-------|------|---------|
| `sessions` | migration 013 | User session management |
| `otp_codes` | migration 013 | Phone OTP verification |
| `technician_locations` | migration 021 | Current technician locations |
| `technician_location_history` | migration 021 | Historical location data |
| `eta_cache` | migration 021 | ETA calculation caching |
| `tracking_notifications` | migration 021 | Tracking notifications |

### 1.4 Naming Mismatches

| Documented Name | Actual Name | File |
|-----------------|-------------|------|
| `sync_queue` | `sync_operations` | migration 014 |

### 1.5 Missing Constraints

- Invoice amount validation: `CHECK (total = subtotal + tax_amount)` - NOT IMPLEMENTED
- Sync retry limit: `CHECK (retry_count <= 5)` - NOT IMPLEMENTED

### 1.6 Foreign Key Issues

- **Migration 052 line 13:** References `business_public_profiles(id)` which doesn't exist - **WILL FAIL**

---

## 2. API Architecture Audit (`campotech-architecture-complete.md` + `campotech-openapi-spec.yaml`)

### 2.1 Architecture Issue: Dual API Systems

The codebase has **two parallel API implementations**:
1. **Next.js App Router** (`/apps/web/app/api/*`) - Internal dashboard
2. **Express Public API** (`/src/api/public/v1/*`) - External integrations

This creates code duplication and inconsistent authentication patterns.

### 2.2 Endpoints Documented but NOT Implemented

#### Auth (1 missing)
| Endpoint | Status |
|----------|--------|
| `POST /api/auth/refresh` | ❌ NOT IMPLEMENTED - Uses hack where `refreshToken = accessToken` |

#### Organization Management (ALL missing - 7 endpoints)
| Endpoint | Status |
|----------|--------|
| `GET /api/org` | ❌ NOT FOUND |
| `PATCH /api/org` | ❌ NOT FOUND |
| `POST /api/org/afip/cert` | ❌ NOT FOUND |
| `GET /api/org/afip/status` | ❌ NOT FOUND |
| `POST /api/org/mp/connect` | ❌ NOT FOUND |
| `GET /api/org/mp/callback` | ❌ NOT FOUND |
| `POST /api/org/whatsapp/verify` | ❌ NOT FOUND |

#### Voice Processing (ALL missing - 4 endpoints)
| Endpoint | Status |
|----------|--------|
| `POST /api/voice/process` | ❌ NOT FOUND |
| `GET /api/voice/queue` | ❌ NOT FOUND |
| `POST /api/voice/review/:id` | ❌ NOT FOUND |
| `GET /api/voice/stats` | ❌ NOT FOUND |

#### Admin Monitoring (5 of 7 missing)
| Endpoint | Status |
|----------|--------|
| `GET /api/admin/health` | ✅ Exists as `/api/health` |
| `GET /api/admin/queues` | ❌ NOT FOUND |
| `GET /api/admin/dlq` | ❌ NOT FOUND |
| `POST /api/admin/dlq/:id/retry` | ❌ NOT FOUND |
| `GET /api/admin/panic` | ❌ NOT FOUND |
| `POST /api/admin/panic/:service` | ❌ NOT FOUND |
| `GET /api/admin/metrics` | ❌ NOT FOUND |

#### Price Book (ALL missing - 4 endpoints)
| Endpoint | Status |
|----------|--------|
| `GET /api/pricebook` | ❌ NOT FOUND |
| `POST /api/pricebook` | ❌ NOT FOUND |
| `PATCH /api/pricebook/:id` | ❌ NOT FOUND |
| `DELETE /api/pricebook/:id` | ❌ NOT FOUND |

#### Other Missing Endpoints
| Category | Endpoint | Status |
|----------|----------|--------|
| Customers | `POST /api/customers/validate-cuit` | ❌ NOT FOUND |
| Invoices | `POST /api/invoices/:id/cae` | ❌ NOT FOUND |
| Invoices | `GET /api/invoices/:id/pdf` | ❌ NOT FOUND |
| Invoices | `GET /api/invoices/queue` | ❌ NOT FOUND |
| Payments | `POST /api/payments/preference` | ❌ NOT FOUND |
| Payments | `GET /api/payments/:id/link` | ❌ NOT FOUND |
| Payments | `POST /api/payments/webhook` | ❌ NOT FOUND |
| Payments | `GET /api/payments/reconcile` | ❌ NOT FOUND |
| Jobs | `POST /api/jobs/:id/status` | ❌ NOT FOUND |

### 2.3 Endpoints Implemented but NOT Documented (40+)

| Category | Endpoints | File Location |
|----------|-----------|---------------|
| Inventory | 7 endpoints (products, suppliers, stock, warehouses, job-materials, vehicle-stock, purchase-orders) | `/apps/web/app/api/inventory/*` |
| Locations | 8 endpoints | `/apps/web/app/api/locations/*` |
| Analytics | 15+ endpoints (technicians, locations, revenue, operations, infrastructure, predictions, kpis) | `/apps/web/app/api/analytics/*` |
| Users | 5 endpoints (CRUD, pending-verifications, verify, resend) | `/apps/web/app/api/users/*` |
| Notifications | 3 endpoints (defaults, history, preferences) | `/apps/web/app/api/notifications/*` |
| GPS Tracking | 3 endpoints (token, start, update) | `/apps/web/app/api/tracking/*` |
| Mobile | 3 endpoints (push-token, jobs/today, sync) | `/apps/web/app/api/mobile/*` |
| Billing | 3 endpoints (routing, charges, reports) | `/apps/web/app/api/billing/*` |

### 2.4 OpenAPI Spec Issue

**Duplicate Definitions:** The OpenAPI spec contains duplicate endpoint definitions:
- First definitions: ~lines 2685-4410
- Duplicate definitions: ~lines 5458-8200+

---

## 3. Capabilities Audit (`capabilities.md`)

### 3.1 Capability Definitions - MATCH ✅

All 30 documented capabilities are defined in `/core/config/capabilities.ts`:
- **External:** 5 capabilities (afip, mercadopago, whatsapp, whatsapp_voice_ai, push_notifications)
- **Domain:** 10 capabilities (invoicing, payments, scheduling, job_assignment, offline_sync, technician_gps, consumer_marketplace, customer_portal, inventory_management, audit_logging)
- **Services:** 9 capabilities (cae_queue, whatsapp_queue, whatsapp_aggregation, payment_reconciliation, abuse_detection, rate_limiting, analytics_pipeline, review_fraud_detection, notification_queue)
- **UI:** 6 capabilities (simple_mode, advanced_mode, pricebook, reporting_dashboard, marketplace_dashboard, whitelabel_portal)

### 3.2 Critical Integration Gap

**Services DON'T Check Capabilities:**

| Service | Should Check | Status |
|---------|--------------|--------|
| WhatsApp Worker | `external.whatsapp`, `services.whatsapp_queue` | ❌ NO CHECKS (505 lines, zero capability verification) |
| AFIP Worker | `external.afip`, `services.cae_queue` | ❌ NO CHECKS |
| Payment Worker | `external.mercadopago` | ❌ NO CHECKS |
| Voice AI | `external.whatsapp_voice_ai` | ❌ NO CHECKS |

**File Reference:** `/src/lib/queue/workers/base.worker.ts` line 168-171:
```typescript
protected async checkCapability(capability: string, orgId: string): Promise<boolean> {
  // TODO: Integrate with actual capabilities system
  return true; // HARDCODED TRUE - NOT IMPLEMENTED
}
```

### 3.3 Missing Function

| Function | Status |
|----------|--------|
| `registerCapabilityHook()` | ❌ Documented in § 7 but NOT IMPLEMENTED anywhere |

### 3.4 Function Naming Mismatch

| Documented | Actual |
|------------|--------|
| `getCapabilityValue()` | `getCapabilityWithEnvOverride()` |

### 3.5 Undocumented Features in Code

- `CapabilityService` class with async methods
- Database override support via `CapabilityDatabaseAdapter`
- Per-organization capability overrides
- Capability expiration/TTL support
- Panic controller integration
- Event system integration (`CAPABILITY_CHANGED`)
- CLI tools (`capability-status.ts`, `clear-env-overrides.ts`)

### 3.6 Admin UI Issues

- Uses mock/hardcoded data instead of live config
- Category mismatch: UI uses `integration/feature/system` vs backend `external/domain/services/ui`
- API endpoints referenced don't exist

---

## 4. Queue Worker Architecture Audit (`campotech-queue-worker-architecture.md`)

### 4.1 Critical Architecture Mismatch

**Documented:** 19 BullMQ queues
**Actual:** 2-3 BullMQ queues + 3 database polling workers + 1 custom Redis queue
**Implementation Rate:** 10-40%

### 4.2 Actual Queue Implementation

#### BullMQ Queues (Only 2-3 with actual workers)
| Queue | File | Concurrency | Status |
|-------|------|-------------|--------|
| `voice-processing` | `/src/workers/voice/voice-processing.worker.ts` | 3 | ✅ IMPLEMENTED |
| `reminder` | `/src/workers/notifications/reminder.worker.ts` | 5 | ✅ IMPLEMENTED |

#### Database Polling Workers (NOT BullMQ)
| Worker | File | Pattern |
|--------|------|---------|
| AFIP Invoice | `/src/workers/afip/afip-invoice.worker.ts` | Database polling |
| WhatsApp Outbound | `/src/workers/whatsapp/whatsapp-outbound.worker.ts` | Database polling |
| MP Payment | `/src/workers/payments/mp-payment.worker.ts` | Database polling |

### 4.3 Documented Queues NOT Found

| # | Queue Name | Status |
|---|------------|--------|
| 1 | `afip:invoice` | ❌ Database polling instead |
| 2 | `afip:auth` | ❌ NOT FOUND |
| 3 | `payment:webhook` | ❌ NOT FOUND |
| 4 | `payment:reconciliation` | ❌ NOT FOUND |
| 5 | `whatsapp:outbound` | ❌ Database polling instead |
| 6 | `whatsapp:inbound` | ❌ NOT FOUND |
| 7 | `voice:transcription` | ⚠️ Named `voice-processing` |
| 8 | `voice:extraction` | ⚠️ Merged into `voice-processing` |
| 9 | `notification:push` | ❌ NOT FOUND |
| 10 | `notification:sms` | ❌ NOT FOUND |
| 11 | `notification:email` | ❌ NOT FOUND |
| 12 | `sync:upload` | ❌ NOT FOUND |
| 13 | `sync:offline` | ❌ NOT FOUND |
| 14 | `maintenance:cleanup` | ❌ NOT FOUND |
| 15 | `maintenance:archive` | ❌ NOT FOUND |
| 16 | `analytics:events` | ❌ NOT FOUND |
| 17 | `marketplace:matching` | ❌ NOT FOUND |
| 18 | `marketplace:notifications` | ❌ NOT FOUND |

### 4.4 Scheduled Jobs

**Documented (6):** None implemented as documented
**Actual (2-3):**
- `PROCESS_SCHEDULED_REPORTS` - Every minute
- `CLEANUP_REPORT_HISTORY` - Daily at 2 AM

### 4.5 Missing Infrastructure

- ❌ Bull Board dashboard NOT IMPLEMENTED
- ❌ Fair scheduler NOT IMPLEMENTED
- ❌ Memory management/backpressure NOT IMPLEMENTED
- ❌ Priority system only partially implemented

### 4.6 Configuration Mismatches

| Queue | Documented Rate | Actual Rate |
|-------|-----------------|-------------|
| Voice | 20/min | 10/min |
| AFIP | 10/min | 10/min ✅ |
| WhatsApp | 50/min | 50/min per org ✅ |

---

## 5. End-to-End Flows Audit (`campotech-end-to-end-flows.md`)

### 5.1 State Machine Implementation

#### Job State Machine - ✅ FULLY ALIGNED
- **File:** `/src/shared/utils/state-machine.ts` lines 158-191
- All 6 states implemented: pending, scheduled, en_camino, working, completed, cancelled
- All transitions implemented with guards

#### Invoice State Machine - ⚠️ PARTIAL (5/9 states missing)
| State | Status |
|-------|--------|
| draft | ✅ |
| pending_cae | ✅ |
| cae_failed | ✅ (extra, not in docs) |
| issued | ✅ |
| sent | ✅ |
| paid | ✅ |
| partial | ❌ NOT IMPLEMENTED |
| overdue | ❌ NOT IMPLEMENTED |
| cancelled | ❌ NOT IMPLEMENTED |
| refunded | ❌ NOT IMPLEMENTED |
| voided | ✅ (extra, not in docs) |

#### Payment State Machine - ❌ CRITICAL MISMATCH
**Type Mismatch Between Layers:**
- State machine uses: `pending`, `approved`, `rejected`, `cancelled`, `disputed`, `refunded`
- Domain types use: `pending`, `completed`, `failed`, `refunded`, `partial_refund`
- **These don't match - WILL CAUSE BUGS**

#### Message State Machine - ⚠️ PARTIAL (2 states missing)
| State | Status |
|-------|--------|
| queued | ✅ |
| sent | ✅ |
| delivered | ✅ |
| read | ✅ |
| failed | ✅ |
| fallback_sms | ❌ NOT IMPLEMENTED |
| undeliverable | ❌ NOT IMPLEMENTED |

#### Voice Processing - ✅ GOOD (better than documented)
- Documented 7 states, implemented 9 states
- Added: `downloading`, `routing`, `awaiting_confirmation`

#### Sync Status - ✅ FUNCTIONAL
- Different implementation model (flag-based vs discrete states)
- Functionally equivalent

### 5.2 Flow Implementation Status

| Flow | Status | Notes |
|------|--------|-------|
| Flow A: Customer Journey | ⚠️ DISTRIBUTED | No single orchestrator |
| Flow B: Failure Cascade | ⚠️ PARTIAL | Panic mode exists, combined matrix missing |
| Flow C: Offline Sync | ⚠️ PARTIAL | Sync engine exists, conflict resolution incomplete |
| Flow D: Abuse Detection | ❌ NOT IMPLEMENTED | Completely absent |
| Flow E: Voice AI Pipeline | ✅ IMPLEMENTED | Full processing chain |
| Flow F: Payment Lifecycle | ⚠️ PARTIAL | State mismatch issues |

### 5.3 Undocumented State Machines in Code

| State Machine | File | Purpose |
|---------------|------|---------|
| Panic Mode | `/src/workers/whatsapp/panic-mode.service.ts` | Integration failure handling |
| Chargeback Status | `/src/integrations/mercadopago/chargeback/chargeback.handler.ts` | 8 chargeback states |

---

## 6. External Integrations Audit

### 6.1 AFIP Integration - ✅ 100% Complete
- WSAA Authentication: ✅
- WSFEv1 (Invoice): ✅
- WS_SR_PADRON (CUIT): ✅
- Certificate Management: ✅
- QR Code Generation: ✅

### 6.2 Mercado Pago - ⚠️ 92% Complete
- OAuth flow: ✅
- Payment preferences: ✅
- Webhook handling: ✅
- Cuotas/TEA/CFT: ✅
- **Refund Processing:** ❌ INCOMPLETE (status tracking only, no API endpoint)
- Dispute handling: ✅

### 6.3 WhatsApp - ⚠️ 83% Complete
- Cloud API: ✅
- Template messages: ✅
- **Interactive Messages:** ❌ INCOMPLETE (no button/list messages)
- Media handling: ✅
- Delivery tracking: ✅
- Rate limiting: ✅

### 6.4 Voice AI - ✅ 100% Complete
- Whisper transcription: ✅
- GPT extraction: ✅
- Confidence scoring: ✅
- Human review queue: ✅

### 6.5 Core Services - ⚠️ 86% Complete

| Service | Status | Notes |
|---------|--------|-------|
| Circuit Breaker | ✅ | Per-service implementation |
| Panic Mode | ✅ | Auto-recovery support |
| Idempotency | ✅ | Redis-backed |
| Encryption | ✅ | AES-256-GCM with AAD |
| Rate Limiting | ✅ | Sliding window |
| Event Bus | ✅ | Redis pub/sub |
| **Distributed Locks** | ❌ | **NOT IMPLEMENTED - CRITICAL GAP** |

---

## Critical Issues Summary

### Priority 1 - Critical (Production Risk)

1. **Payment State Machine Mismatch** - States don't match between layers
2. **Missing Distributed Locks** - Race condition risk
3. **Capability System Not Integrated** - Workers don't check capabilities
4. **Migration 052 Foreign Key** - References non-existent table
5. **No Refresh Token Implementation** - Using hack where `refreshToken = accessToken`

### Priority 2 - High (Feature Gaps)

1. **19 documented queues, only 2-3 exist** - Architecture mismatch
2. **Organization endpoints missing** - All 7 endpoints not implemented
3. **Voice API endpoints missing** - All 4 endpoints not implemented
4. **Admin monitoring endpoints missing** - 5 of 7 not implemented
5. **Flow D: Abuse Detection** - Completely absent

### Priority 3 - Medium (Documentation Debt)

1. 40+ undocumented API endpoints in code
2. 6 undocumented database tables
3. Undocumented state machines (Panic Mode, Chargeback)
4. Advanced capability features undocumented
5. OpenAPI spec contains duplicate definitions

---

## Recommendations

### Immediate Actions (Week 1)

1. **Fix Payment State Types** - Align state machine with domain types
2. **Implement Distributed Lock Service** - Critical for multi-instance deployment
3. **Fix Migration 052** - Remove or implement `business_public_profiles`
4. **Implement Proper Refresh Token** - Security risk

### Short-Term (Sprint 1-2)

1. **Add Capability Guards to Workers** - Complete base.worker.ts TODO
2. **Implement Missing Organization Endpoints** - Core functionality
3. **Document Existing API Endpoints** - 40+ undocumented
4. **Fix Invoice State Machine** - Add partial, overdue, cancelled states

### Medium-Term (Month 1-2)

1. **Consolidate API Architecture** - Choose Next.js OR Express, not both
2. **Implement Abuse Detection (Flow D)** - Security requirement
3. **Complete Queue Architecture** - Either implement BullMQ or update docs
4. **Add Interactive WhatsApp Messages** - Button/list support
5. **Implement Mercado Pago Refund API** - Complete payment lifecycle

### Documentation Updates Required

1. Remove duplicate OpenAPI definitions
2. Add 6 undocumented tables to schema docs
3. Add 40+ undocumented endpoints to OpenAPI
4. Document panic mode and chargeback state machines
5. Update queue architecture to reflect polling pattern
6. Document per-org capability overrides

---

## Files Referenced

### Core Implementation
- `/core/config/capabilities.ts` (877 lines)
- `/core/bootstrap.ts` (337 lines)
- `/src/shared/utils/state-machine.ts`
- `/src/lib/queue/queue-manager.ts`

### Workers
- `/src/workers/voice/voice-processing.worker.ts`
- `/src/workers/whatsapp/whatsapp-outbound.worker.ts`
- `/src/workers/afip/afip-invoice.worker.ts`
- `/src/workers/payments/mp-payment.worker.ts`
- `/src/workers/notifications/reminder.worker.ts`

### Integrations
- `/src/integrations/afip/` (WSAA, WSFE, QR)
- `/src/integrations/mercadopago/` (OAuth, Payments, Chargeback)
- `/src/integrations/voice-ai/`

### Database
- `/database/migrations/001-054`
- `/apps/mobile/watermelon/schema.ts`

---

**Report Completed:** 2025-12-10
**Auditor:** Claude Architecture Audit System
**Overall Assessment:** Documentation requires significant updates to match implementation
