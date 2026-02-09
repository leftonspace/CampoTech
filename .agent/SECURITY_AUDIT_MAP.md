# CampoTech Monorepo Security Audit Map
## Multi-Agent Swarm Execution Plan

**Generated:** 2026-02-04T19:55:32-05:00
**Scope:** 140k+ files monorepo
**Classification System:** HIGH (🔴), MEDIUM (🟡), LOW (🟢)

---

# 1. MONOREPO TOPOLOGY

## 1.1 Workspace Structure (pnpm-workspace.yaml)
```yaml
packages:
  - 'apps/web'       # Primary SaaS application (Next.js)
  - 'apps/mobile'    # Technician Expo app (Offline-first)
  - 'apps/admin'     # Platform administration silo
  - 'packages/*'     # Shared libraries (sdk, analytics)
```

## 1.2 Application Silos

| Silo | Path | Technology | Risk Profile |
|------|------|------------|--------------|
| SaaS Web | `apps/web` | Next.js 14, Edge Middleware | 🔴 HIGH - Primary data plane |
| Technician Mobile | `apps/mobile` | Expo, WatermelonDB (local sync) | 🔴 HIGH - Offline-first, sync abuse vectors |
| Consumer Mobile | `apps/consumer-mobile` | Expo | 🟡 MEDIUM - End-user facing |
| Admin Portal | `apps/admin` | Next.js | 🔴 HIGH - Platform-wide privilege |
| Developer Portal | `apps/developer-portal` | Next.js | 🟡 MEDIUM - API documentation |
| AI Service | `services/ai` | Python FastAPI | 🟡 MEDIUM - LLM context injection risks |

---

# 2. SECURITY-CRITICAL DIRECTORY MAP

## 🔴 HIGH RISK - Tier 1 (Auth/DB/Payments/Sync)

### 2.1 Authentication Layer
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `apps/web/lib/auth.ts` | Custom JWT implementation (no next-auth), session cookies | P0 |
| `apps/web/lib/auth-security.ts` | Token rotation, lockout logic, refresh token hashing | P0 |
| `apps/web/lib/otp.ts` | OTP generation, test phone bypass patterns | P0 |
| `apps/web/middleware.ts` | Edge middleware: rate limiting, CSRF, session verification | P0 |
| `apps/web/middleware/subscription-guard.ts` | Subscription status enforcement | P0 |
| `apps/web/app/api/auth/**` | 9 auth endpoints (login, register, OTP, refresh, switch-org) | P0 |
| `apps/admin/app/api/auth/**` | Separate admin auth silo | P0 |
| `apps/mobile/lib/auth/` | Mobile token storage patterns | P0 |

### 2.2 Database Layer
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `apps/web/prisma/schema.prisma` | 203KB schema file - all table definitions, relations, enums | P0 |
| `apps/web/prisma/migrations/**` | 30 migration files - schema evolution history | P1 |
| `apps/web/lib/prisma.ts` | Singleton Prisma client instantiation | P0 |
| `apps/web/lib/db/**` | 6 files - connection pooling, raw query patterns | P0 |
| `database/migrate.ts` | Migration orchestration | P1 |
| `database/migrations/**` | 37 additional migration files | P1 |

### 2.3 Payment Processing
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `apps/web/app/api/payments/**` | Payment creation, amount validation | P0 |
| `apps/web/app/api/mercadopago/**` | OAuth, payment processing | P0 |
| `apps/web/app/api/webhooks/mercadopago/**` | 3 webhook handlers - signature validation | P0 |
| `apps/web/lib/mercadopago/**` | 6 files - MP SDK integration | P0 |
| `apps/web/lib/integrations/mercadopago/**` | 5 additional integration files | P0 |
| `apps/web/lib/services/payment-processor.ts` | 31KB - Payment orchestration logic | P0 |
| `src/integrations/mercadopago/**` | 13 files - Shared MP integration | P0 |

### 2.4 Mobile Sync (High-Value Target)
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `apps/web/app/api/mobile/sync/route.ts` | PRIMARY SYNC ENDPOINT - Truth Reconciliation target | P0 |
| `apps/web/app/api/mobile/**` | 3 mobile API endpoints | P0 |
| `apps/mobile/lib/sync/**` | 3 files - Client-side sync logic | P0 |
| `apps/mobile/watermelon/**` | 16 files - WatermelonDB offline storage | P0 |

### 2.5 Webhooks (External Attack Surface)
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `apps/web/app/api/webhooks/mercadopago/**` | 3 endpoints - Payment webhooks | P0 |
| `apps/web/app/api/webhooks/whatsapp/**` | 1 endpoint - Meta signature validation | P0 |
| `apps/web/app/api/webhooks/resend/**` | 1 endpoint - Email delivery | P1 |
| `apps/web/app/api/webhooks/dialog360/**` | 1 endpoint - WhatsApp BSP | P1 |

### 2.6 AFIP/Fiscal Integration (Regulatory)
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `apps/web/app/api/afip/**` | 2 endpoints - AFIP web services | P0 |
| `apps/web/lib/afip/**` | 4 files - Certificate handling | P0 |
| `apps/web/lib/integrations/afip/**` | 6 files - Electronic invoicing | P0 |
| `src/integrations/afip/**` | 14 files - AFIP WSFE/WSAA integration | P0 |
| `apps/web/lib/services/afip-credentials.service.ts` | 18KB - Credential storage patterns | P0 |

### 2.7 Admin API (Privilege Escalation Vectors)
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `apps/admin/app/api/admin/**` | 10 admin endpoint categories | P0 |
| `apps/admin/app/api/admin/organizations/**` | 3 endpoints - Cross-tenant operations | P0 |
| `apps/admin/app/api/admin/subscriptions/**` | 2 endpoints - Billing manipulation | P0 |
| `apps/admin/app/api/admin/verifications/**` | 2 endpoints - Trust badge grants | P0 |
| `apps/admin/lib/**` | 3 files - Admin-specific utilities | P0 |

---

## 🟡 MEDIUM RISK - Tier 2 (Shared Libraries/Services)

### 2.8 Shared Packages
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `packages/sdk/typescript/**` | 4 files - API client generation | P1 |
| `packages/sdk/python/**` | 4 files - Python SDK | P1 |
| `packages/analytics/**` | 3 files - Tracking implementation | P2 |

### 2.9 Business Logic Services (70+ files)
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `apps/web/lib/services/multi-org.service.ts` | 23KB - Org switching, membership checks | P0 |
| `apps/web/lib/services/subscription-manager.ts` | 20KB - Tier enforcement | P1 |
| `apps/web/lib/services/verification-manager.ts` | 40KB - Professional verification | P1 |
| `apps/web/lib/services/admin-recovery.ts` | 40KB - Account recovery flows | P0 |
| `apps/web/lib/services/edge-cases.ts` | 47KB - Exception handling | P1 |
| `apps/web/lib/services/whatsapp-ai-responder.ts` | 34KB - AI-driven message responses | P1 |
| `apps/web/lib/services/*.ts` | 70 service files total | P1-P2 |

### 2.10 Integration Layer
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `apps/web/lib/integrations/whatsapp/**` | 10 files - Meta Cloud API | P1 |
| `apps/web/lib/integrations/openai/**` | 4 files - AI prompt injection risks | P1 |
| `apps/web/lib/integrations/google-maps/**` | 1 file - API key exposure | P2 |
| `src/integrations/whatsapp/**` | 20 files - WhatsApp business logic | P1 |
| `src/integrations/push/**` | 1 file - Push notification tokens | P2 |

### 2.11 Cron Jobs (Scheduled Attacks)
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `apps/web/app/api/cron/**` | 11 cron endpoints | P1 |
| `apps/web/lib/cron/**` | 5 files - Cron logic | P1 |
| `vercel.json` | 8 scheduled cron paths | P1 |

### 2.12 Access Control Configuration
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `apps/web/lib/access-control/**` | 3 files - Permission definitions | P0 |
| `apps/web/lib/config/field-permissions.ts` | Field-level RBAC registry | P0 |
| `apps/web/lib/middleware/field-filter.ts` | Server-side field filtering | P0 |

### 2.13 Source Modules (Business Domain)
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `src/modules/**` | 14 domain modules (inventory, jobs, payments, etc.) | P1 |
| `src/auth/**` | 8 files - Legacy auth patterns | P1 |
| `src/workers/**` | 23 files - Background job processors | P1 |

### 2.14 AI/LLM Services
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `services/ai/app/**` | 21 files - FastAPI AI service | P1 |
| `services/ai/main.py` | AI service entrypoint | P1 |
| `apps/web/lib/services/ai-staff-assistant.ts` | 30KB - AI assistant logic | P1 |
| `apps/web/lib/services/ai-dispatch.ts` | 10KB - AI dispatch decisions | P1 |
| `apps/web/app/api/ai/**` | 5 AI API endpoints | P1 |
| `apps/web/app/api/copilot/**` | 3 Copilot endpoints | P1 |

---

## 🟢 LOW RISK - Tier 3 (Documentation/UI/Tests)

### 2.15 Documentation
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `docs/**` | 33 documentation files | P3 |
| `docs/security/**` | 3 security-specific docs | P2 |
| `architecture/**` | 75 architecture docs | P3 |
| `CODE_QUALITY_REFERENCE.md` | Quality standards | P3 |

### 2.16 Frontend Components (Client-Side Only)
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `apps/web/components/**` | 127 React components | P2 |
| `apps/mobile/components/**` | 30 components | P2 |
| `apps/admin/components/**` | 2 components | P3 |

### 2.17 Testing Infrastructure
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `apps/web/tests/**` | 20 test files | P3 |
| `apps/web/__tests__/**` | 3 test files | P3 |
| `apps/web/e2e/**` | 4 E2E test files | P3 |
| `tests/**` | 11 root test files | P3 |
| `services/ai/tests/**` | 3 AI service tests | P3 |

### 2.18 Tooling/Scripts
| Path | Risk Factors | Audit Priority |
|------|--------------|----------------|
| `scripts/**` | 10 CLI scripts | P2 |
| `apps/web/scripts/**` | 30 web-specific scripts | P2 |
| `apps/mobile/scripts/**` | 2 mobile scripts | P3 |

---

# 3. DATA FLOW ENTRY POINTS

## 3.1 API Surface Area (65 Route Groups)

### Primary Web App (`apps/web/app/api/`)

| Category | Endpoints | Risk Level |
|----------|-----------|------------|
| `auth/**` | 9 | 🔴 HIGH |
| `webhooks/**` | 6 | 🔴 HIGH |
| `mobile/**` | 3 | 🔴 HIGH |
| `payments/**` | 2 | 🔴 HIGH |
| `mercadopago/**` | 3 | 🔴 HIGH |
| `admin/**` | 34 | 🔴 HIGH |
| `afip/**` | 2 | 🔴 HIGH |
| `jobs/**` | 21 | 🟡 MEDIUM |
| `users/**` | 14 | 🟡 MEDIUM |
| `customers/**` | 6 | 🟡 MEDIUM |
| `employees/**` | 7 | 🟡 MEDIUM |
| `inventory/**` | 25 | 🟡 MEDIUM |
| `invoices/**` | 4 | 🟡 MEDIUM |
| `subscription/**` | 8 | 🟡 MEDIUM |
| `settings/**` | 21 | 🟡 MEDIUM |
| `whatsapp/**` | 22 | 🟡 MEDIUM |
| `analytics/**` | 17 | 🟢 LOW |
| `cron/**` | 11 | 🟡 MEDIUM |
| `health/**` | 1 | 🟢 LOW |
| `public/**` | 1 | 🟢 LOW |
| **Other 45 categories** | Various | Mixed |

### Admin App (`apps/admin/app/api/`)

| Category | Endpoints | Risk Level |
|----------|-----------|------------|
| `admin/**` | 20+ | 🔴 HIGH |
| `auth/**` | 3 | 🔴 HIGH |

## 3.2 External Integration Entry Points

| Integration | Entry Point | Auth Method | Risk |
|-------------|-------------|-------------|------|
| MercadoPago Webhooks | `/api/webhooks/mercadopago/` | Signature (x-signature) | 🔴 HIGH |
| WhatsApp Webhooks | `/api/webhooks/whatsapp/` | Meta App Secret | 🔴 HIGH |
| 360Dialog Webhooks | `/api/webhooks/dialog360/` | Custom Secret | 🟡 MEDIUM |
| Resend Webhooks | `/api/webhooks/resend/` | Webhook Secret | 🟡 MEDIUM |
| Vercel Cron | `/api/cron/*` | CRON_SECRET header | 🟡 MEDIUM |

## 3.3 Mobile Sync Protocol

```
┌────────────────────┐      ┌────────────────────┐
│  Technician Mobile │      │   SaaS Backend     │
│  (WatermelonDB)    │      │   (PostgreSQL)     │
└────────┬───────────┘      └─────────┬──────────┘
         │                            │
         │  POST /api/mobile/sync     │
         ├───────────────────────────▶│
         │  {payments, jobUpdates,    │
         │   lineItems, photos}       │
         │                            │
         │  ◀─ TRUTH RECONCILIATION ─▶│
         │  • Re-calculate balances   │
         │  • Ignore client totals    │
         │  • Validate state changes  │
         │                            │
         │  ◀───────────────────────┤ 
         │  {syncResult, conflicts}   │
         └────────────────────────────┘
```

---

# 4. DEPENDENCY GRAPH - HIGH-RISK SHARED PACKAGES

## 4.1 Root Dependencies (package.json)

```json
{
  "dependencies": {
    "@prisma/client": "^5.22.0",   // 🔴 DB access
    "bullmq": "^5.1.0",            // 🟡 Queue system
    "ioredis": "^5.0.0",           // 🟡 Redis client
    "pg": "^8.0.0",                // 🔴 Direct Postgres
    "pusher": "^5.2.0"             // 🟡 Real-time
  },
  "overrides": {
    "@babel/runtime": "^7.26.10",  // Security patch
    "tar": "^7.5.3",               // Security patch
    "undici": "^6.23.0"            // Security patch (fetch)
  }
}
```

## 4.2 Web App Critical Dependencies

| Package | Purpose | Risk Assessment |
|---------|---------|-----------------|
| `jose` | JWT implementation | 🔴 HIGH - Custom auth |
| `@supabase/supabase-js` | Storage client | 🟡 MEDIUM |
| `@prisma/client` | ORM | 🔴 HIGH - All DB queries |
| `zod` | Input validation | 🟢 LOW - Defense layer |
| `@sentry/nextjs` | Error tracking | 🟡 MEDIUM - PII in errors |
| `next` | Framework | 🟡 MEDIUM - Security configs |
| `@upstash/redis` | Rate limiting | 🟡 MEDIUM |
| `twilio` | SMS/OTP | 🔴 HIGH - Auth delivery |
| `resend` | Email | 🟡 MEDIUM |
| `openai` | AI services | 🟡 MEDIUM - Prompt injection |

## 4.3 Mobile App Critical Dependencies

| Package | Purpose | Risk Assessment |
|---------|---------|-----------------|
| `@nozbe/watermelondb` | Offline storage | 🔴 HIGH - Local data |
| `expo-secure-store` | Token storage | 🔴 HIGH - Credentials |
| `expo-crypto` | Cryptography | 🔴 HIGH |
| `@sentry/react-native` | Error tracking | 🟡 MEDIUM |

## 4.4 Shared Internal Dependencies

```
apps/web/lib/
├── auth.ts          ──▶ Used by: ALL API routes
├── prisma.ts        ──▶ Used by: ALL DB operations
├── services/        ──▶ 76 services, cross-referenced
├── middleware/      ──▶ field-filter.ts (RBAC)
└── access-control/  ──▶ Permission definitions

src/
├── modules/         ──▶ 14 domain modules
├── integrations/    ──▶ 6 integration suites
├── workers/         ──▶ 23 background processors
└── shared/          ──▶ 15 shared utilities
```

---

# 5. MULTI-AGENT SWARM EXECUTION PLAN

## Phase 1: Infrastructure Audit (Agent: INFRA-SEC)

**Priority:** P0
**Scope:** Root configurations, environment secrets, deployment configs

### Tasks:
1. [ ] Audit `pnpm-workspace.yaml` for unauthorized package exposure
2. [ ] Audit root `package.json` for outdated/vulnerable dependencies
3. [ ] Verify `vercel.json` cron authentication patterns
4. [ ] Check `.env.example` for leaked production patterns
5. [ ] Audit `apps/web/.env.example` (389 lines) for missing secret documentation
6. [ ] Verify `apps/mobile/.env.example` patterns
7. [ ] Audit `apps/admin/.env` configuration (NOT .example - actual production)
8. [ ] Verify `services/ai/.env.example` for API key patterns
9. [ ] Check GitHub Actions (`.github/`) for secret exposure

### Deliverables:
- [ ] Secret exposure report
- [ ] Dependency vulnerability manifest
- [ ] Cron authentication verification

---

## Phase 2: Authentication & Session Security (Agent: AUTH-SEC)

**Priority:** P0
**Scope:** JWT implementation, OTP flows, session management

### Tasks:
1. [ ] Code review `apps/web/lib/auth.ts` (custom JWT)
2. [ ] Code review `apps/web/lib/auth-security.ts` (token rotation)
3. [ ] Audit `apps/web/lib/otp.ts` for:
   - Test phone bypass patterns (OTP `123456`)
   - Rate limiting on OTP attempts
   - OTP expiration enforcement
4. [ ] Audit `apps/web/middleware.ts` (549 lines):
   - JWT verification flow
   - CSRF bypass conditions
   - Rate limit accuracy
5. [ ] Verify `apps/admin/app/api/auth/**` separation from SaaS silo
6. [ ] Audit `apps/mobile/lib/auth/` token persistence
7. [ ] Verify refresh token rotation in `apps/web/app/api/auth/refresh/`
8. [ ] Audit `apps/web/app/api/auth/switch-org/` membership validation

### Deliverables:
- [ ] Session hijacking assessment
- [ ] OTP bypass vulnerability report
- [ ] Token rotation verification

---

## Phase 3: Database & Tenant Isolation (Agent: DATA-SEC)

**Priority:** P0
**Scope:** Prisma schema, query patterns, multi-tenant boundaries

### Tasks:
1. [ ] Schema analysis: `apps/web/prisma/schema.prisma` (203KB)
   - Identify all `organizationId` foreign keys
   - Find tables WITHOUT tenant isolation
   - Audit cascading delete patterns
2. [ ] Query pattern audit:
   - Search for `$queryRawUnsafe` usage
   - Search for `$executeRawUnsafe` usage
   - Verify parameterized query patterns
3. [ ] Code search for IDOR vulnerabilities:
   - Routes missing `organizationId` in WHERE clauses
   - Direct ID access without ownership verification
4. [ ] Audit `apps/web/lib/db/**` connection pooling
5. [ ] Review `database/migrations/**` for:
   - Data migration security
   - Index patterns on tenant columns

### Deliverables:
- [ ] Tenant isolation gap analysis
- [ ] Raw query injection report
- [ ] IDOR vulnerability manifest

---

## Phase 4: Payment Processing Security (Agent: PAY-SEC)

**Priority:** P0
**Scope:** MercadoPago integration, payment validation, financial fraud vectors

### Tasks:
1. [ ] Audit `apps/web/app/api/payments/` for:
   - Amount validation (server-side recalculation)
   - Invoice balance verification
2. [ ] Audit `apps/web/app/api/mercadopago/` OAuth flow
3. [ ] Webhook signature validation:
   - `apps/web/app/api/webhooks/mercadopago/**` (3 endpoints)
4. [ ] Audit `apps/web/lib/services/payment-processor.ts` (31KB):
   - Payment recording logic
   - Refund handling
5. [ ] Verify Catalog-First Pricing Pattern in line-item creation
6. [ ] Search for `amount` parameters that bypass server validation

### Deliverables:
- [ ] Payment manipulation vulnerability report
- [ ] Webhook security assessment
- [ ] Financial fraud vector analysis

---

## Phase 5: Mobile Sync Security (Agent: SYNC-SEC)

**Priority:** P0
**Scope:** Offline sync protocol, Truth Reconciliation patterns

### Tasks:
1. [ ] Deep audit `apps/web/app/api/mobile/sync/route.ts`:
   - Payment amount reconciliation
   - Status transition restrictions
   - Line item price validation
2. [ ] Audit `apps/mobile/watermelon/**` (16 files):
   - Local data encryption
   - Sync conflict resolution
3. [ ] Verify Truth Reconciliation:
   - Server ignores client-provided totals
   - Balance recalculation from source records
   - Variance detection and flagging
4. [ ] Audit `apps/mobile/lib/sync/**` client-side logic

### Deliverables:
- [ ] Sync manipulation vulnerability report
- [ ] Offline-first security assessment
- [ ] Conflict resolution security analysis

---

## Phase 6: API Authorization (Agent: AUTHZ-SEC)

**Priority:** P0
**Scope:** Role-based access, route guards, field-level permissions

### Tasks:
1. [ ] Audit `apps/web/lib/access-control/**` permission definitions
2. [ ] Audit `apps/web/lib/config/field-permissions.ts` RBAC registry
3. [ ] Audit `apps/web/lib/middleware/field-filter.ts` enforcement
4. [ ] Search all 65 API route groups for:
   - Missing `session.role` checks
   - Routes without `getSession()` calls
   - Inconsistent role case handling (`.toUpperCase()`)
5. [ ] Verify Layout Guards:
   - `apps/web/app/dashboard/settings/layout.tsx`
   - `apps/web/app/dashboard/inventory/products/new/page.tsx`
6. [ ] Audit `apps/admin/app/api/admin/**` for platform-level privilege checks

### Deliverables:
- [ ] Privilege escalation vulnerability report
- [ ] Missing authorization check manifest
- [ ] Field-level RBAC verification

---

## Phase 7: Webhook & External Integration (Agent: INTEG-SEC)

**Priority:** P1
**Scope:** All external webhooks, signature validation, SSRF prevention

### Tasks:
1. [ ] Audit all webhook handlers:
   - `apps/web/app/api/webhooks/mercadopago/**` (3 endpoints)
   - `apps/web/app/api/webhooks/whatsapp/**` (1 endpoint)
   - `apps/web/app/api/webhooks/resend/**` (1 endpoint)
   - `apps/web/app/api/webhooks/dialog360/**` (1 endpoint)
2. [ ] Verify signature validation for each integration
3. [ ] Audit cron endpoints:
   - `apps/web/app/api/cron/**` (11 endpoints)
   - CRON_SECRET header validation
4. [ ] SSRF analysis:
   - Search for user-controlled URLs in fetch/axios calls
   - Verify URL whitelisting

### Deliverables:
- [ ] Webhook security assessment
- [ ] Cron authentication verification
- [ ] SSRF vulnerability report

---

## Phase 8: AI/LLM Security (Agent: AI-SEC)

**Priority:** P1
**Scope:** Prompt injection, context leakage, API key exposure

### Tasks:
1. [ ] Audit `services/ai/**` Python FastAPI service:
   - `main.py` - API authentication
   - `app/**` (21 files) - Prompt construction
2. [ ] Audit AI integration in web app:
   - `apps/web/lib/services/ai-staff-assistant.ts` (30KB)
   - `apps/web/lib/services/whatsapp-ai-responder.ts` (34KB)
   - `apps/web/app/api/ai/**` (5 endpoints)
   - `apps/web/app/api/copilot/**` (3 endpoints)
3. [ ] Audit prompt construction for injection vectors
4. [ ] Verify API key isolation (`OPENAI_API_KEY`)
5. [ ] Check for PII leakage in AI context

### Deliverables:
- [ ] Prompt injection vulnerability report
- [ ] AI context leakage assessment
- [ ] API key exposure analysis

---

## Phase 9: Regulatory Compliance (Agent: COMPLIANCE-SEC)

**Priority:** P1
**Scope:** AFIP integration, CUIT validation, data protection

### Tasks:
1. [ ] Audit AFIP integration:
   - `apps/web/app/api/afip/**` (2 endpoints)
   - `apps/web/lib/afip/**` (4 files)
   - `apps/web/lib/integrations/afip/**` (6 files)
   - `src/integrations/afip/**` (14 files)
2. [ ] Verify certificate handling:
   - `apps/web/lib/services/afip-credentials.service.ts` (18KB)
3. [ ] Audit CUIT validation: `apps/web/lib/cuit.ts`
4. [ ] Data protection (Ley 25.326):
   - Audit PII handling patterns
   - Verify data retention policies
5. [ ] Audit `docs/compliance/**` (3 files) for implementation gaps

### Deliverables:
- [ ] Regulatory compliance gap analysis
- [ ] Certificate security assessment
- [ ] PII handling verification

---

## Phase 10: State Immutability & Business Logic (Agent: LOGIC-SEC)

**Priority:** P1
**Scope:** Terminal state enforcement, status transition guards

### Tasks:
1. [ ] Verify COMPLETED/CANCELLED immutability across:
   - All job update endpoints
   - Invoice modification endpoints
   - Payment modification endpoints
2. [ ] Audit status transition logic:
   - `apps/web/lib/services/job-completion.ts`
   - State machine enforcement patterns
3. [ ] Search for state bypass patterns:
   - API routes that modify terminal records
   - Missing status checks before mutations

### Deliverables:
- [ ] State immutability verification
- [ ] Status transition security analysis

---

## Phase 11: Frontend Security (Agent: UI-SEC)

**Priority:** P2
**Scope:** XSS prevention, client-side security

### Tasks:
1. [ ] Search for `dangerouslySetInnerHTML` usage
2. [ ] Audit CSP configuration in `apps/web/next.config.js`
3. [ ] Verify no `eval()` or `new Function()` with user input
4. [ ] Audit `apps/web/components/**` (127 files) for unsafe patterns
5. [ ] Check for exposed secrets in client bundles

### Deliverables:
- [ ] XSS vulnerability report
- [ ] Client-side security assessment

---

## Phase 12: Dependency Audit (Agent: DEP-SEC)

**Priority:** P2
**Scope:** npm audit, dependency vulnerabilities

### Tasks:
1. [ ] Run `pnpm audit` on root workspace
2. [ ] Run `pnpm audit` on `apps/web`
3. [ ] Run `pnpm audit` on `apps/mobile`
4. [ ] Run `pnpm audit` on `apps/admin`
5. [ ] Run `pip-audit` on `services/ai`
6. [ ] Verify all `overrides` in root `package.json` are current

### Deliverables:
- [ ] Dependency vulnerability manifest
- [ ] Upgrade recommendations

---

# 6. KNOWN SECURITY PATTERNS (FROM AUDIT HISTORY)

## 6.1 Remediated Vulnerabilities (Feb 2026)

| Issue | Location | Status |
|-------|----------|--------|
| Payment Amount Trust | `apps/web/app/api/payments/route.ts` | REMEDIATED |
| Manual Pricing Overrides | `apps/web/app/api/jobs/[id]/line-items/route.ts` | REMEDIATED |
| Mobile Sync Financial Integrity | `apps/web/app/api/mobile/sync/route.ts` | REMEDIATED |
| Inventory Product Manipulation | `apps/web/app/api/inventory/products/route.ts` | REMEDIATED |
| Settings Pricebook Governance | `apps/web/app/api/settings/pricebook/route.ts` | REMEDIATED |
| Middleware Role-Guard Gap | Various layout.tsx files | REMEDIATED |

## 6.2 Active Security Controls

| Control | Implementation |
|---------|----------------|
| JWT Authentication | `lib/auth.ts`, `lib/auth-security.ts` |
| CSRF Protection | `middleware.ts` |
| Rate Limiting | `middleware.ts` (Tier-based) |
| Security Headers | `next.config.js` |
| Audit Logging | `lib/audit/logger.ts` |
| Field-Level Encryption | `lib/services/audit-encryption.ts` |
| Account Lockout | `lib/auth-security.ts` (5 attempts, 30min) |
| Multi-Tenant Isolation | All API routes |
| Role-Based Access | `lib/middleware/field-filter.ts` |
| Token Rotation | `lib/auth-security.ts` (7-day refresh) |

---

# 7. ENVIRONMENT VARIABLES REQUIRING SECURITY AUDIT

## Critical Secrets (.env.example analysis)

| Variable | Purpose | Risk if Exposed |
|----------|---------|-----------------|
| `DATABASE_URL` | PostgreSQL connection | 🔴 CRITICAL - Full DB access |
| `JWT_SECRET` / `NEXTAUTH_SECRET` | Token signing | 🔴 CRITICAL - Session forgery |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage admin | 🔴 CRITICAL - Full storage access |
| `AUDIT_ENCRYPTION_KEY` | Sensitive field encryption | 🔴 CRITICAL - PII decryption |
| `TWILIO_AUTH_TOKEN` | SMS sending | 🔴 HIGH - OTP bypass |
| `MERCADOPAGO_ACCESS_TOKEN` | Payment processing | 🔴 CRITICAL - Financial fraud |
| `MP_CLIENT_SECRET` | OAuth | 🔴 HIGH |
| `MP_WEBHOOK_SECRET` | Webhook validation | 🔴 HIGH - Payment spoofing |
| `WHATSAPP_APP_SECRET` | Meta webhook validation | 🔴 HIGH |
| `OPENAI_API_KEY` | AI services | 🟡 MEDIUM - Cost abuse |
| `CRON_SECRET` | Scheduled job auth | 🟡 MEDIUM |
| `RESEND_API_KEY` | Email sending | 🟡 MEDIUM |
| `PUSHER_SECRET` | Real-time events | 🟡 MEDIUM |

---

# 8. EXECUTION PRIORITY MATRIX

| Phase | Agent | Priority | Est. Effort | Dependencies |
|-------|-------|----------|-------------|--------------|
| 1 | INFRA-SEC | P0 | 2h | None |
| 2 | AUTH-SEC | P0 | 4h | Phase 1 |
| 3 | DATA-SEC | P0 | 4h | Phase 1 |
| 4 | PAY-SEC | P0 | 3h | Phase 2, 3 |
| 5 | SYNC-SEC | P0 | 3h | Phase 2, 3, 4 |
| 6 | AUTHZ-SEC | P0 | 4h | Phase 2 |
| 7 | INTEG-SEC | P1 | 3h | Phase 1, 2 |
| 8 | AI-SEC | P1 | 2h | Phase 2 |
| 9 | COMPLIANCE-SEC | P1 | 3h | Phase 3 |
| 10 | LOGIC-SEC | P1 | 2h | Phase 3 |
| 11 | UI-SEC | P2 | 2h | None |
| 12 | DEP-SEC | P2 | 1h | None |

**Total Estimated Effort:** 33 hours across 12 parallel agents

---

# 9. QUICK REFERENCE COMMANDS

## Security Scanning

```powershell
# Dependency audit
cd d:\projects\CampoTech
pnpm audit
cd apps\web && pnpm audit
cd apps\mobile && pnpm audit

# Search for raw SQL patterns
rg '\$queryRawUnsafe|\$executeRawUnsafe' --type ts

# Search for missing org isolation
rg 'findMany|findFirst|findUnique' --type ts -A 5 | rg -v 'organizationId'

# Search for dangerous patterns
rg 'dangerouslySetInnerHTML|eval\(|new Function\(' --type tsx --type ts

# Search for hardcoded secrets
rg 'sk_live|pk_live|password.*=|secret.*=' --type ts

# Search for console.log of sensitive data
rg 'console\.log.*token|console\.log.*password|console\.log.*secret' --type ts
```

## Endpoint Mapping

```powershell
# Count API endpoints
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api" -Recurse -Filter "route.ts" | Measure-Object

# List all webhook handlers
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api\webhooks" -Recurse -Filter "route.ts"
```

---

# 10. ARTIFACT REFERENCES

## Knowledge Items Referenced
- `authentication_and_security_infrastructure` - Auth architecture
- `mobile_offline_sync_architecture` - Sync security patterns
- `code_quality_and_maintenance` - Hardening patterns

## Existing Security Documentation
- `apps/web/SECURITY-AUDIT-OWASP.md` - OWASP Top 10 audit (2025-12-20)
- `docs/security/SECURITY-ASSESSMENT-REPORT.md`
- `docs/security/SECURITY-README.md`
- `docs/security/ZERO-COST-SECURITY-PLAN.md`
- `apps/web/security-audit.json` - Structured audit data

---

*Security Map Version: 1.0*
*Last Updated: 2026-02-04T19:55:32-05:00*
