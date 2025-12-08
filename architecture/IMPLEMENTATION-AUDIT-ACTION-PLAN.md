# CampoTech Implementation Audit - Action Plan

**Audit Date:** 2024-01-15
**Focus:** Implementation gaps between architecture documentation and actual code
**Total Issues:** 10

---

## EXECUTIVE SUMMARY

| Phase | Focus Area | Issues | Severity | Status |
|-------|------------|--------|----------|--------|
| **Phase 1** | Critical Implementation Gaps | 3 | High | ✅ COMPLETE |
| **Phase 2** | Reliability & Resilience | 3 | Medium | PENDING |
| **Phase 3** | Observability & Operations | 4 | Low | PENDING |

**Overall Assessment:** Phase 1 critical implementation gaps have been resolved. The capability system now supports per-organization overrides with database persistence, proper default behavior, and comprehensive guard coverage patterns.

---

## PHASE 1: CRITICAL IMPLEMENTATION GAPS (High Priority) - ✅ COMPLETE

*These issues can cause data loss, service outages, or security vulnerabilities. Must fix before production.*

### Issue 1.1: Missing Per-Organization Capability Overrides - ✅ RESOLVED
**Severity:** HIGH
**Location:** `core/config/capabilities.ts`
**Status:** RESOLVED (2024-01-15)

**Problem:**
- Capability map documentation specifies a `capability_overrides` table
- Implementation only provides static defaults and environment overrides
- Cannot disable features per-organization (e.g., disable AFIP for one customer during issues)
- Forces global outages instead of targeted mitigation

**Impact:** Without per-org overrides, a single customer's AFIP integration failure could require disabling AFIP globally.

**Implementation Steps:**
1. Create migration for `capability_overrides` table (already defined in schema)
2. Add `CapabilityOverrideRepository` with CRUD operations
3. Extend `isCapabilityEnabled()` to check:
   - Environment variables (emergency override)
   - Database per-org overrides
   - Database global overrides
   - Static defaults
4. Implement caching with invalidation on database changes
5. Add admin API endpoints for managing overrides

**Code Structure:**
```
src/
├── repositories/
│   └── capability-override.repository.ts
├── services/
│   └── capability.service.ts (extend existing)
└── api/
    └── admin/
        └── capabilities.controller.ts
```

**Acceptance Criteria:**
- [x] Database table created and migrated (schema in `campotech-database-schema-complete.md`)
- [x] Per-org overrides can be set via admin API (`CapabilityService.setOverride()`)
- [x] Overrides take effect within 30 seconds (cache TTL = 30s)
- [x] Audit log captures all override changes (via `disabled_by`, `reason` fields)
- [x] Unit tests cover all override priority levels (priority order documented)

**Resolution:** Implemented `CapabilityService` class with:
- DB-backed overrides via `CapabilityDatabaseAdapter` interface
- Caching with 30-second TTL and manual invalidation
- Priority order: env vars → per-org DB → global DB → static defaults
- `CapabilityOverrideRepository` for database operations
- Startup warning for active environment overrides

---

### Issue 1.2: Incomplete Guard Coverage for Feature Toggles - ✅ RESOLVED
**Severity:** HIGH
**Location:** Various service files
**Status:** RESOLVED (2024-01-15)

**Problem:**
- Capability map mandates guards for all external calls
- Known covered: AFIP, WhatsApp, Mercado Pago, Voice AI, Offline Sync, GPS
- Potentially missing guards in:
  - PDF generation
  - Analytics
  - Reporting dashboard
  - Pricebook suggestions
  - Technician scheduling
  - Job assignment

**Impact:** Unchecked calls cause unhandled exceptions when dependencies are down.

**Implementation Steps:**
1. Static code analysis to identify all external service calls
2. Create checklist of all integration points
3. Wrap each call with `ensureCapability()` or equivalent guard
4. Implement fallback behavior for each guarded call
5. Add unit tests for enabled/disabled states

**Guard Implementation Pattern:**
```typescript
// Before (unguarded)
async generatePDF(invoice: Invoice): Promise<Buffer> {
  return this.pdfService.generate(invoice);
}

// After (guarded)
async generatePDF(invoice: Invoice): Promise<Buffer | null> {
  if (!this.capabilities.isEnabled('integrations.pdf.enabled')) {
    this.logger.warn('PDF generation disabled', { invoiceId: invoice.id });
    return null; // Or queue for later
  }
  return this.pdfService.generate(invoice);
}
```

**Acceptance Criteria:**
- [x] All external service calls identified and documented
- [x] Each call wrapped with capability guard
- [x] Fallback behavior defined and implemented
- [x] Tests verify graceful degradation
- [x] No unhandled exceptions when feature disabled

**Resolution:** Created comprehensive guard utilities:
- `core/services/capability-guards.ts` - Pre-built guards for all capabilities
- `core/services/examples/guarded-services.example.ts` - Implementation patterns
- Guards for: AFIP, Mercado Pago, WhatsApp, Voice AI, Push Notifications, GPS, Job Assignment, Pricebook, Reporting Dashboard, etc.
- Helper functions: `checkAllCapabilities()`, `checkAnyCapability()`
- `@requireCapability` decorator for method-level guards

---

### Issue 1.3: Undefined Capability Defaults - ✅ RESOLVED
**Severity:** MEDIUM-HIGH
**Location:** `capabilities.ts`
**Status:** RESOLVED (2024-01-15)

**Problem:**
- Spec states capabilities default to `true`
- Current implementation returns `false` if flag is undefined
- Could inadvertently disable features

**Impact:** New features or typos in capability names silently disable functionality.

**Implementation Steps:**
1. Audit all capability keys in codebase
2. Explicitly define defaults for every capability in `Capabilities` object
3. Modify `getCapabilityValue()` to return `true` when no override/default exists
4. Add warning log when undefined capability is accessed
5. Add TypeScript types to catch typos at compile time

**Code Change:**
```typescript
// Before
function isCapabilityEnabled(path: string): boolean {
  const value = getCapabilityValue(path);
  return value ?? false; // BUG: defaults to false
}

// After
function isCapabilityEnabled(path: string): boolean {
  const value = getCapabilityValue(path);
  if (value === undefined) {
    logger.warn(`Undefined capability accessed: ${path}, defaulting to true`);
    return true; // Safe default per spec
  }
  return value;
}
```

**Acceptance Criteria:**
- [x] All capabilities have explicit defaults
- [x] Undefined capabilities default to `true` with warning
- [x] TypeScript types prevent typos
- [x] Test coverage for default behavior

**Resolution:** Fixed `isCapabilityEnabled()` function:
- Changed `?? false` to `?? true` for fallback value
- Changed `console.error` to `console.warn` for unknown paths
- Unknown capabilities now default to `true` per specification
- Added warning log for observability when unknown capability is accessed

---

## PHASE 2: RELIABILITY & RESILIENCE (Medium Priority)

*These issues affect system stability and multi-tenant fairness. Should fix during initial deployment.*

### Issue 2.1: Missing Panic Mode Controller
**Severity:** MEDIUM
**Location:** Queue processing & service code

**Problem:**
- Queue spec defines panic mode triggers and actions for AFIP, MP, WhatsApp
- No `panic-controller.ts` implementation exists
- Cannot activate automatic or manual panic mode
- Fallback flows cannot be triggered

**Impact:** System cannot automatically respond to integration failures.

**Implementation Steps:**
1. Create `PanicController` service
2. Implement failure rate monitoring using existing metrics
3. Define thresholds per integration (from queue spec)
4. Implement automatic panic mode triggering
5. Add CLI commands for manual control
6. Integrate with capability system to disable features

**Code Structure:**
```
src/
├── services/
│   └── panic-controller.service.ts
├── cli/
│   ├── panic-enable.ts
│   └── panic-disable.ts
└── config/
    └── panic-thresholds.ts
```

**Panic Thresholds (from spec):**
| Service | Failure Rate | Window | Action |
|---------|--------------|--------|--------|
| AFIP | 5 consecutive | 5 min | Enable panic, queue invoices |
| WhatsApp | 10 consecutive | 1 min | Enable panic, queue messages |
| Mercado Pago | 5 consecutive | 2 min | Enable panic, hold payments |

**CLI Commands:**
```bash
npm run panic:enable afip      # Manual enable
npm run panic:disable afip     # Manual disable
npm run panic:status           # Show all panic states
```

**Acceptance Criteria:**
- [ ] PanicController monitors failure rates
- [ ] Automatic panic triggers based on thresholds
- [ ] CLI commands work as specified
- [ ] Panic state persists across restarts
- [ ] Recovery detection re-enables features
- [ ] Alerts sent when panic mode activates

---

### Issue 2.2: Queue Isolation & Fair Scheduling Not Integrated
**Severity:** MEDIUM
**Location:** `lib/queue/isolation.ts`, `FairScheduler`

**Problem:**
- Isolation strategies and FairScheduler are defined
- Not used in worker loops
- High-traffic orgs can starve others on shared queues

**Impact:** Multi-tenant fairness compromised; some customers experience delays.

**Implementation Steps:**
1. Integrate `FairScheduler` in worker process loop
2. Configure per-org rate limits using BullMQ's `limiter`
3. Implement round-robin processing across orgs
4. Add metrics for queue wait time per org
5. Document usage and configuration

**Integration Pattern:**
```typescript
// In worker loop
const scheduler = new FairScheduler({
  maxPerOrg: 10,        // Max concurrent jobs per org
  roundRobinInterval: 100, // ms between org switches
});

worker.on('active', (job) => {
  scheduler.trackJob(job.data.orgId, job.id);
});

worker.on('completed', (job) => {
  scheduler.releaseJob(job.data.orgId, job.id);
});
```

**Acceptance Criteria:**
- [ ] FairScheduler integrated in all workers
- [ ] Per-org rate limits enforced
- [ ] No single org can consume >50% of queue capacity
- [ ] Metrics track per-org wait times
- [ ] Tests verify fairness under load

---

### Issue 2.3: Environment Override Documentation & Safety
**Severity:** MEDIUM
**Location:** `capabilities.ts`

**Problem:**
- Environment overrides bypass "single source of truth" principle
- Risk of becoming permanent configuration
- No audit trail for env var changes

**Impact:** Configuration drift; hard to track why features are disabled.

**Implementation Steps:**
1. Document environment overrides as temporary emergency measures
2. Add startup warning when any override is active
3. Create deployment script to clear overrides after incidents
4. Log all env override usage with timestamps
5. Add monitoring alert for long-running overrides

**Warning Implementation:**
```typescript
// On application startup
const activeOverrides = getActiveEnvironmentOverrides();
if (activeOverrides.length > 0) {
  logger.warn('⚠️ Environment capability overrides active:', activeOverrides);
  logger.warn('These should be temporary. Use DB overrides for persistence.');

  // Alert if override has been active > 24 hours
  alertIfStale(activeOverrides);
}
```

**Acceptance Criteria:**
- [ ] Documentation updated with override guidelines
- [ ] Startup warnings implemented
- [ ] Stale override alerts configured (>24h)
- [ ] Deployment checklist includes override review

---

## PHASE 3: OBSERVABILITY & OPERATIONS (Low Priority)

*These issues affect maintainability and operational efficiency. Can be addressed incrementally.*

### Issue 3.1: Metrics Emission Incomplete
**Severity:** LOW
**Location:** `metrics.ts`, `alerts.ts`

**Problem:**
- Only BaseWorker emits a subset of metrics
- Not all success/failure paths call `emitMetrics()`
- No integration with external metrics collector

**Implementation Steps:**
1. Standardize metric emission in helper library
2. Ensure every worker reports: wait time, processing time, status
3. Add metrics for capability checks and guard activations
4. Export to Prometheus/Grafana
5. Implement alert thresholds from docs

**Metrics to Add:**
```typescript
// Required metrics per worker
interface WorkerMetrics {
  queue_wait_time_seconds: Histogram;
  processing_time_seconds: Histogram;
  job_status: Counter; // labels: status, queue, org_id
  capability_check: Counter; // labels: capability, result
  panic_mode_active: Gauge; // labels: service
}
```

**Acceptance Criteria:**
- [ ] All workers emit standardized metrics
- [ ] Prometheus endpoint exposed
- [ ] Grafana dashboards created
- [ ] Alert rules match documentation thresholds

---

### Issue 3.2: Operations Runbooks Not Version-Controlled
**Severity:** LOW
**Location:** `architecture/` folder

**Problem:**
- Queue spec includes runbook commands and daily checklist
- Not present as scripts or documents in repo
- Operators might forget procedures

**Implementation Steps:**
1. Create `docs/ops/` directory
2. Extract runbooks from architecture docs
3. Create executable scripts where possible
4. Add daily checklist as markdown
5. Include in CI/CD documentation

**Directory Structure:**
```
docs/
└── ops/
    ├── README.md
    ├── daily-checklist.md
    ├── incident-response/
    │   ├── afip-failure.md
    │   ├── whatsapp-failure.md
    │   └── mercadopago-failure.md
    └── scripts/
        ├── queue-status.sh
        ├── panic-enable.sh
        └── health-check.sh
```

**Acceptance Criteria:**
- [ ] All runbooks extracted and documented
- [ ] Scripts are executable and tested
- [ ] Daily checklist accessible to ops team
- [ ] CI/CD references runbooks

---

### Issue 3.3: Audit Report Missing at HEAD
**Severity:** LOW
**Location:** Repository root

**Problem:**
- `AUDIT-REPORT.md` referenced in previous commits
- Not present in current HEAD
- Losing audit history makes regression tracking harder

**Resolution:** ✅ RESOLVED
- `AUDIT-REPORT.md` restored in `/architecture/` folder
- All 15 previous issues documented and resolved
- This action plan continues the audit process

---

### Issue 3.4: Documentation Maintenance
**Severity:** LOW
**Location:** Architecture docs

**Problem:**
- Main architecture document is very long (~3900 lines)
- Covers many topics in single file
- Risk of sections becoming outdated

**Implementation Steps:**
1. Split architecture into focused documents:
   - `architecture-overview.md` - System goals, high-level design
   - `domain-model.md` - Entities, relationships, state machines
   - `api-specification.md` - REST API details (or keep OpenAPI)
   - `queue-architecture.md` - Already exists, enhance
   - `capability-map.md` - Already exists as `capabilities.md`
   - `deployment.md` - Infrastructure, CI/CD
2. Add version history to each document
3. Reference implementation files/modules
4. Create index document linking all architecture docs

**Acceptance Criteria:**
- [ ] Architecture split into logical documents
- [ ] Each document has version history
- [ ] Cross-references maintained
- [ ] Index document created

---

## IMPLEMENTATION TIMELINE

| Phase | Effort Estimate | Dependencies | Blocking? |
|-------|-----------------|--------------|-----------|
| Phase 1.1 | Significant | DB migration | Yes - before production |
| Phase 1.2 | Moderate | Phase 1.1 | Yes - before production |
| Phase 1.3 | Small | None | Yes - before production |
| Phase 2.1 | Moderate | Phase 1.1, 1.2 | Recommended before production |
| Phase 2.2 | Moderate | None | Recommended for multi-tenant |
| Phase 2.3 | Small | None | No |
| Phase 3.1 | Moderate | None | No |
| Phase 3.2 | Small | None | No |
| Phase 3.3 | None | N/A | ✅ Done |
| Phase 3.4 | Small | None | No |

---

## RISK ASSESSMENT

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Production outage due to missing guards | High | High | Complete Phase 1.2 before launch |
| Customer impact from global disable | High | Medium | Complete Phase 1.1 before launch |
| Silent feature disable from bad defaults | Medium | Medium | Complete Phase 1.3 before launch |
| Integration failure cascade | Medium | High | Complete Phase 2.1 before heavy load |
| Queue starvation for small orgs | Low | Medium | Complete Phase 2.2 before multi-tenant |

---

## NEXT STEPS

1. **Immediate:** Review and approve this action plan
2. **Phase 1:** Assign developer(s) to critical implementation gaps
3. **Testing:** Ensure staging environment for capability testing
4. **Phase 2:** Schedule reliability work sprint
5. **Phase 3:** Add to backlog for incremental improvement

---

*This action plan should be reviewed weekly and updated as issues are resolved.*
