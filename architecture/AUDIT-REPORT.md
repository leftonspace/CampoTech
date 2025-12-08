# CampoTech Architecture Documentation Audit Report

**Audit Date:** 2024-01
**Auditor:** Architecture Review
**Scope:** All documents in `/architecture/` folder
**Purpose:** Ensure documentation is complete, consistent, and ready for implementation

---

## EXECUTIVE SUMMARY

| Category | Status | Issues Found | Critical |
|----------|--------|--------------|----------|
| **Completeness** | GOOD | 4 | 1 |
| **Consistency** | NEEDS ATTENTION | 12 | 5 |
| **Cross-References** | GOOD | 3 | 0 |
| **Implementation Readiness** | GOOD | 2 | 0 |

**Overall Assessment:** Documentation is comprehensive and well-structured. Several consistency issues between documents need resolution before implementation to avoid bugs.

---

## DOCUMENTS AUDITED

| Document | Lines | Status | Last Updated |
|----------|-------|--------|--------------|
| campotech-architecture-complete.md | ~3900 | CANONICAL | Current |
| campotech-database-schema-complete.md | ~1500 | Active | Current |
| campotech-openapi-spec.yaml | ~2100 | Active | Current |
| campotech-queue-worker-architecture.md | ~1200 | Active | Current |
| campotech-end-to-end-flows.md | ~1600 | Active | Current |
| capabilities.md | ~700 | Active | Current |

---

## CRITICAL ISSUES (Must Fix Before Implementation)

### ISSUE #1: Payment Status Enum Inconsistency
**Severity:** CRITICAL
**Locations:**
- `campotech-architecture-complete.md` line ~836
- `campotech-openapi-spec.yaml` line ~438

**Problem:**
```
Architecture doc PaymentStatus:
  'pending' | 'processing' | 'approved' | 'rejected' | 'refunded' | 'chargeback' | 'cancelled'

OpenAPI PaymentStatus enum:
  'pending' | 'processing' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'partial_refund' | 'in_dispute' | 'chargedback'
```

**Discrepancies:**
- Architecture has `chargeback`, OpenAPI has `chargedback` (different spelling)
- Architecture missing `partial_refund` and `in_dispute`
- OpenAPI has `chargedback` instead of `chargeback`

**Recommendation:** Standardize to OpenAPI values (more complete). Update architecture doc:
```typescript
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIAL_REFUND = 'partial_refund',
  IN_DISPUTE = 'in_dispute',
  CHARGEDBACK = 'chargedback',
}
```

---

### ISSUE #2: Invoice Status Missing `partial`
**Severity:** CRITICAL
**Locations:**
- `campotech-architecture-complete.md` line ~810
- `campotech-openapi-spec.yaml` line ~426

**Problem:**
```
Architecture InvoiceStatus includes: 'partial'
OpenAPI InvoiceStatus MISSING: 'partial'
```

**Impact:** If invoice can have partial payment, API cannot represent this state.

**Recommendation:** Add `partial` to OpenAPI InvoiceStatus enum:
```yaml
InvoiceStatus:
  type: string
  enum:
    - draft
    - pending_cae
    - issued
    - sent
    - paid
    - partial        # ADD THIS
    - overdue
    - cancelled
    - refunded
```

---

### ISSUE #3: Voice Processing Status Mismatch
**Severity:** CRITICAL
**Locations:**
- `campotech-architecture-complete.md` line ~873
- `campotech-openapi-spec.yaml` line ~488

**Problem:**
```
Architecture VoiceProcessingStatus:
  'received' | 'transcribing' | 'extracting' | 'review' | 'processed' | 'failed'

OpenAPI VoiceStatus:
  'pending' | 'transcribing' | 'extracting' | 'completed' | 'needs_review' | 'reviewed' | 'failed'
```

**Discrepancies:**
- `received` vs `pending`
- `review` vs `needs_review` + `reviewed`
- `processed` vs `completed`

**Recommendation:** Align to more descriptive OpenAPI values. Update architecture:
```typescript
export enum VoiceProcessingStatus {
  PENDING = 'pending',
  TRANSCRIBING = 'transcribing',
  EXTRACTING = 'extracting',
  NEEDS_REVIEW = 'needs_review',
  REVIEWED = 'reviewed',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
```

---

### ISSUE #4: WhatsApp Message Status Missing Values
**Severity:** CRITICAL
**Locations:**
- `campotech-architecture-complete.md` line ~984 (state machine)
- `campotech-database-schema-complete.md` line ~662
- `campotech-openapi-spec.yaml` line ~477

**Problem:** State machine includes `undeliverable` status but DB schema doesn't:
```
State Machine states: queued | sent | delivered | read | failed | fallback_sms | undeliverable
DB Schema status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'fallback_sms'
OpenAPI: queued | sent | delivered | read | failed | fallback_sms | undeliverable
```

**Recommendation:** Add `undeliverable` to database schema:
```sql
-- In whatsapp_messages table
status: TEXT DEFAULT 'pending' -- 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'fallback_sms' | 'undeliverable'
```

---

### ISSUE #5: Missing `afip_sequences` Table
**Severity:** CRITICAL
**Location:** Referenced in `campotech-architecture-complete.md` line ~1258

**Problem:** The AFIP invoice numbering strategy references `afip_sequences` table:
```typescript
const seq = await tx.afip_sequences.update({
  where: {
    org_id_punto_venta_cbte_tipo: {...}
  },
  data: { last_number: { increment: 1 } },
});
```

But this table is NOT defined in `campotech-database-schema-complete.md`.

**Recommendation:** Add table definition:
```sql
-- ADD TO DATABASE SCHEMA
afip_sequences (
  id: UUID PRIMARY KEY
  org_id: UUID REFERENCES organizations(id) NOT NULL
  punto_venta: INTEGER NOT NULL
  cbte_tipo: TEXT NOT NULL -- 'A' | 'B' | 'C'
  last_number: INTEGER NOT NULL DEFAULT 0

  UNIQUE(org_id, punto_venta, cbte_tipo)

  INDEX idx_afip_seq_lookup ON afip_sequences(org_id, punto_venta, cbte_tipo)
)
```

---

## MODERATE ISSUES (Should Fix)

### ISSUE #6: Missing `capability_overrides` Table
**Severity:** MODERATE
**Location:** `capabilities.md` references admin dashboard toggle but no storage table

**Problem:** The capabilities system supports admin dashboard toggles but there's no database table to persist capability overrides beyond environment variables.

**Recommendation:** Add table:
```sql
capability_overrides (
  id: UUID PRIMARY KEY
  org_id: UUID REFERENCES organizations(id)  -- NULL = global override
  capability_path: TEXT NOT NULL  -- e.g., 'external.afip'
  enabled: BOOLEAN NOT NULL
  reason: TEXT  -- Why it was disabled
  disabled_by: UUID REFERENCES users(id)
  disabled_at: TIMESTAMPTZ DEFAULT NOW()
  expires_at: TIMESTAMPTZ  -- Optional auto-re-enable

  UNIQUE(org_id, capability_path)
)
```

---

### ISSUE #7: Job Status `pending` vs Database Default
**Severity:** MODERATE
**Locations:**
- `campotech-architecture-complete.md` line ~521
- `campotech-database-schema-complete.md` (jobs table)

**Problem:** Database schema shows:
```sql
status: TEXT DEFAULT 'pending'
```

But the comment shows additional statuses not in the enum definition. Should have explicit CREATE TYPE.

**Recommendation:** Add explicit enum creation in database schema:
```sql
-- Add before jobs table
CREATE TYPE job_status AS ENUM (
  'pending',
  'scheduled',
  'en_camino',
  'working',
  'completed',
  'cancelled'
);
```

---

### ISSUE #8: Rate Limit Values Inconsistency
**Severity:** MODERATE
**Locations:**
- `campotech-openapi-spec.yaml` line ~28-29
- `campotech-queue-worker-architecture.md` queue config

**Problem:**
```
OpenAPI: WhatsApp: 50 messages/minute per organization
Queue Config: whatsapp-outbound: 50/min rate limit

But architecture doc section 8 says:
  "Template messages: 50/second"
```

**Clarification Needed:** Is WhatsApp limit 50/minute or 50/second? (Meta's actual limit is per-second for templates)

**Recommendation:** Clarify in all documents:
- Template messages: 50/second (Meta limit)
- Internal rate limit: 50/minute per org (our conservative limit)

---

### ISSUE #9: Missing `received` Status in DB MessageStatus
**Severity:** MODERATE
**Location:** `campotech-architecture-complete.md` line ~844

**Problem:** Architecture defines MessageStatus with `RECEIVED` for inbound messages:
```typescript
export enum MessageStatus {
  RECEIVED = 'received',  // Inbound message received
  ...
}
```

But DB schema and OpenAPI don't include this value.

**Recommendation:** Add `received` to all message status definitions for inbound message tracking.

---

### ISSUE #10: SyncStatus Enum Missing `syncing`
**Severity:** MODERATE
**Locations:**
- `campotech-architecture-complete.md` line ~858
- `campotech-database-schema-complete.md` (jobs.sync_status)

**Problem:** Architecture defines SyncStatus with `SYNCING`:
```typescript
export enum SyncStatus {
  SYNCING = 'syncing',  // Currently syncing
  ...
}
```

But jobs table shows:
```sql
sync_status: TEXT DEFAULT 'synced' -- 'synced' | 'pending' | 'conflict'
```

Missing: `syncing`, `failed`

**Recommendation:** Update database schema to include all sync statuses:
```sql
sync_status: TEXT DEFAULT 'synced' -- 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed'
```

---

### ISSUE #11: Webhook Endpoint Path Inconsistency
**Severity:** MODERATE
**Locations:**
- `campotech-architecture-complete.md` line ~1093
- `campotech-openapi-spec.yaml` (paths section)

**Problem:** Architecture shows:
```
POST /api/payments/webhook   → MP webhook handler
```

OpenAPI should define this endpoint with proper idempotency handling and MP signature verification.

**Recommendation:** Verify OpenAPI paths section includes:
- `POST /payments/webhook` with proper request/response schemas
- Document MP signature verification requirement
- Include idempotency key handling

---

### ISSUE #12: Circuit Breaker Configuration Not in Architecture
**Severity:** MODERATE
**Location:** Referenced in `campotech-end-to-end-flows.md` Flow B but not defined in main architecture

**Problem:** End-to-end flows reference circuit breaker states (CLOSED, OPEN, HALF_OPEN, PANIC) but the main architecture document doesn't define the circuit breaker configuration parameters.

**Recommendation:** Add Circuit Breaker Configuration section to architecture doc:
```
## Circuit Breaker Configuration

| Service | Failure Threshold | Open Duration | Probe Interval | Panic Threshold |
|---------|-------------------|---------------|----------------|-----------------|
| AFIP | 5 consecutive | 5 min | 30 sec | 15 min open |
| WhatsApp | 10 consecutive | 1 min | 15 sec | 10 min open |
| Mercado Pago | 5 consecutive | 2 min | 30 sec | 10 min open |
```

---

## MINOR ISSUES (Nice to Fix)

### ISSUE #13: Inconsistent Endpoint Prefix
**Severity:** LOW
**Problem:** Architecture shows `/api/` prefix but OpenAPI uses `/v1/` prefix in server URL.

**Recommendation:** Clarify that full path is `https://api.campotech.com/v1/` so actual endpoints are `/v1/customers` not `/api/customers`.

---

### ISSUE #14: Missing TEA/CFT Storage Fields
**Severity:** LOW
**Location:** `campotech-database-schema-complete.md` payments table

**Problem:** Architecture mentions TEA/CFT display for installments but payments table doesn't store these values.

**Recommendation:** Add fields:
```sql
tea_rate: DECIMAL(5, 2)  -- Tasa Efectiva Anual
cft_rate: DECIMAL(5, 2)  -- Costo Financiero Total
```

---

### ISSUE #15: Document Last Updated Dates
**Severity:** LOW
**Problem:** Documents have `Last Updated: 2024-01` but should be more specific.

**Recommendation:** Use ISO format with day: `2024-01-15`

---

## CROSS-REFERENCE VERIFICATION

### Verified Alignments (GOOD)

| Source | Target | Status |
|--------|--------|--------|
| Architecture DB Schema | Database Schema Doc | ALIGNED |
| Architecture API Endpoints | OpenAPI Paths | MOSTLY ALIGNED |
| Architecture Queue Config | Queue Worker Doc | ALIGNED |
| End-to-End Flows | Architecture Workflows | ALIGNED |
| Capabilities | Architecture Feature Flags | ALIGNED |

### Cross-Reference Issues

1. **JobSource enum**: Architecture has `'manual' | 'whatsapp' | 'voice'`, OpenAPI adds `'recurring'` - ADD to architecture
2. **PaymentMethod enum**: OpenAPI has `'check'` not in architecture - ADD to architecture
3. **MessageType enum**: OpenAPI has `'document'` and `'interactive'` not in architecture - ADD to architecture

---

## COMPLETENESS CHECKLIST

### Core Documentation
- [x] System overview and goals
- [x] Database schema (all tables)
- [x] API specification (OpenAPI)
- [x] State machines (Job, Invoice, Payment, Message)
- [x] External integrations (AFIP, MP, WhatsApp)
- [x] Queue/Worker architecture
- [x] Security architecture
- [x] Offline mode architecture
- [x] Mobile app architecture
- [x] Admin portal architecture
- [x] Core workflows (12 defined)
- [x] Fallback systems
- [x] Monitoring & observability
- [x] Deployment architecture
- [x] Kill-switch/capabilities system

### Missing Documentation (Recommended Additions)
- [ ] **API Versioning Strategy** - How will API versions be managed?
- [ ] **Data Migration Guide** - How to handle schema changes?
- [ ] **Testing Strategy** - Unit, integration, E2E test approach
- [ ] **Performance Benchmarks** - Expected throughput, latency targets
- [ ] **Disaster Recovery Plan** - Backup, restore, failover procedures
- [ ] **GDPR/Data Privacy** - Customer data handling, deletion flows

---

## IMPLEMENTATION READINESS SCORE

| Category | Score | Notes |
|----------|-------|-------|
| Database Schema | 9/10 | Missing afip_sequences table |
| API Specification | 8/10 | Some enum mismatches |
| Business Logic | 10/10 | Well-defined workflows |
| External Integrations | 10/10 | Comprehensive coverage |
| Error Handling | 9/10 | Missing some edge cases |
| Security | 10/10 | RLS, encryption, audit logs defined |
| Mobile/Offline | 10/10 | Excellent conflict resolution |
| Operations | 9/10 | Circuit breaker config needed |

**Overall Implementation Readiness: 94%**

---

## RECOMMENDED ACTION PLAN

### Phase 1: Critical Fixes (Before Any Implementation)
1. Fix Payment Status enum (Issue #1)
2. Add `partial` to Invoice Status (Issue #2)
3. Align Voice Processing Status (Issue #3)
4. Add `undeliverable` to Message Status (Issue #4)
5. Add `afip_sequences` table (Issue #5)

### Phase 2: Moderate Fixes (During Initial Implementation)
6. Add `capability_overrides` table (Issue #6)
7. Add explicit enum types to DB (Issue #7)
8. Clarify rate limit documentation (Issue #8)
9. Add `received` to Message Status (Issue #9)
10. Complete SyncStatus enum (Issue #10)

### Phase 3: Polish (Before Production)
11. Verify all webhook endpoints (Issue #11)
12. Add circuit breaker config (Issue #12)
13. Standardize endpoint prefixes (Issue #13)
14. Add TEA/CFT fields (Issue #14)
15. Update document dates (Issue #15)

---

## APPROVAL

| Role | Name | Date | Status |
|------|------|------|--------|
| Technical Lead | | | PENDING |
| Product Owner | | | PENDING |
| Security Review | | | PENDING |

---

*This audit report should be reviewed and issues resolved before beginning implementation. Update this document as issues are fixed.*
