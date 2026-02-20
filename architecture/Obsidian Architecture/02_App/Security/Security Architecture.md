---
tags:
  - security
  - moc
  - auth
  - verification
status: 🟢 Functional
type: Feature Index
updated: 2026-02-13
---

# 🔐 Security Architecture

> [!SUCCESS] **Goal**
> Multi-layered defense-in-depth security for a multi-tenant SaaS platform handling Argentine financial data, personal information, and field service operations. All 12 security audit phases passed (Feb 2026).

---

## 🏗️ Security Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EDGE LAYER                                   │
│    Next.js Middleware → JWT Validation → Rate Limiting              │
├─────────────────────────────────────────────────────────────────────┤
│                         API LAYER                                    │
│    withAuth() → Role Check → Org Isolation → Input Validation       │
├─────────────────────────────────────────────────────────────────────┤
│                         SERVICE LAYER                                │
│    Business Logic Guards → Terminal State Protection → Audit Log    │
├─────────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                                   │
│    organizationId Filter → Encrypted Fields → Decimal Precision     │
├─────────────────────────────────────────────────────────────────────┤
│                         MOBILE LAYER                                 │
│    SecureStore (HW) → WatermelonDB Sync → SyncOperation Audit      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Authentication

### Passwordless OTP

| Step | Description |
|:---|:---|
| 1. User enters phone | `+54 11 XXXX-XXXX` format |
| 2. OTP sent via SMS | 6-digit code with TTL |
| 3. Code verified | Server validates + generates JWT pair |
| 4. JWT issued | Access token (15 min) + Refresh token (7 days) |
| 5. Cookies set | HttpOnly, Secure, SameSite=Strict |

### Token Architecture

| Token | TTL | Storage | Purpose |
|:---|:---|:---|:---|
| Access Token | 15 min | HttpOnly cookie | API authentication |
| Refresh Token | 7 days | HttpOnly cookie | Silent token renewal |
| Mobile Token | 30 days | expo-secure-store | Mobile app auth |

### Session Enforcement

| Layer | Mechanism |
|:---|:---|
| Edge Middleware | Validates JWT on every request |
| API Routes | `getSession()` → `withAuth()` wrapper |
| Client Side | `useAuth()` hook with auto-refresh |
| Mobile | SecureStore + auto-refresh on app foreground |

---

## 🛡️ Authorization (RBAC)

### Role Hierarchy

| Role | Scope | Capabilities |
|:---|:---|:---|
| `SUPER_ADMIN` | Platform-wide | All admin pages, all org data, system health |
| `OWNER` | Organization | Full org access + billing + verification |
| `ADMIN` | Organization | Manage team, operations, customers (no billing) |
| `TECHNICIAN` | Personal | Own jobs, profile, mobile app only |

### Authorization Enforcement

```typescript
// Every authenticated API route uses withAuth()
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!['OWNER', 'ADMIN'].includes(session.role)) return forbidden();
  // All queries MUST include organizationId
  const data = await prisma.job.findMany({
    where: { organizationId: session.organizationId }
  });
}
```

### IDOR Prevention (Double-Key Pattern)
```typescript
// WRONG: only checks id (IDOR vulnerable)
where: { id: jobId }

// CORRECT: double-key prevents cross-tenant access
where: { id: jobId, organizationId: session.organizationId }
```

---

## 🏢 Multi-Tenant Isolation

| Metric | Value |
|:---|:---|
| Tables with `organizationId` | 81 of 133 |
| Tables with inherited isolation | 42 (via parent FK) |
| Global/system tables | 10 (settings, enums) |

### Isolation Rules
1. **Every query** to tenant-scoped tables MUST include `organizationId`
2. **No cross-tenant data access** — enforced by API wrappers
3. **Admin endpoints** use platform-level auth (SUPER_ADMIN only)
4. **Prisma middleware** logs sensitive data access operations

---

## 🔒 Data Protection

### Encryption at Rest

| Data Type | Encryption | Method |
|:---|:---|:---|
| AFIP private keys | AES-256-GCM | `credential-encryption.ts` |
| Audit logs | AES-256-GCM | `audit-encryption.ts` |
| MercadoPago tokens | AES-256-GCM | `credential-encryption.ts` |
| JWT secrets | env variable | Server-side only |
| Database | Supabase managed | TDE (Transparent Data Encryption) |

### Financial Data Integrity

| Rule | Implementation |
|:---|:---|
| No Float for Money | `Decimal` types in Prisma schema |
| Amount validation | Server-side truth reconciliation (0.01 threshold) |
| Payment idempotency | Unique keys prevent duplicate charges |
| Webhook verification | HMAC-SHA256 signature validation |

### Privacy (Ley 25.326)

| Feature | Implementation |
|:---|:---|
| **ARCO Rights** | Client Data Folder export (PDF) |
| **Data Access Requests** | `data-access-request.ts` service |
| **Account Deletion** | 30-day grace period + data purge |
| **Consent Tracking** | `consent-service.ts` per-org |
| **PII in Logs** | Sentry PII filtering enabled |
| **Right of Withdrawal** | Ley 24.240 — 10-day refund (billing) |

---

## 🎫 Verification & Identity

### Organization Verification

| Level | Checks | Badge |
|:---|:---|:---|
| **Basic** | Phone + email confirmed | ✅ Account created |
| **CUIT Verified** | Mod-11 CUIT validation | 🏛️ CUIT badge |
| **Insurance** | ART documentation uploaded | 🛡️ Insurance badge |
| **Background** | Background check completed | 📋 Background badge |
| **Professional** | Trade license verified | 🎓 License badge |

### Technician Identity (Field)

| Feature | Description |
|:---|:---|
| **Digital Badge** | QR code shown to building security |
| **Confirmation Code** | 4-digit mutual verification at job start |
| **GPS Tracking** | Live location + audit trail |
| **Photo Documentation** | Before/during/after photos per job |

---

## 🔍 Security Audit Results (Feb 2026)

All 12 audit phases completed and passed:

| Phase | Domain | Status |
|:---|:---|:---:|
| 1 | Infrastructure Security | ✅ PASS |
| 2 | Auth & Session Security | ✅ PASS |
| 3 | Database & Tenant Isolation | ✅ PASS |
| 4 | Payment Processing | ✅ PASS |
| 5 | Mobile Sync Security | ✅ PASS |
| 6 | API Authorization | ✅ PASS |
| 7 | Webhook & Integration Security | ✅ PASS |
| 8 | AI/LLM Security | ✅ PASS |
| 9 | Regulatory Compliance | ✅ PASS |
| 10 | State Immutability & Business Logic | ✅ PASS |
| 11 | Frontend Security (CSP, XSS, CSRF) | ✅ PASS |
| 12 | Dependency Audit | ✅ PASS |

---

## 🌐 Frontend Security

| Protection | Implementation |
|:---|:---|
| **CSP** | Content-Security-Policy headers via `next.config.js` |
| **XSS** | React auto-escaping + no `dangerouslySetInnerHTML` |
| **CSRF** | SameSite=Strict cookies + origin validation |
| **Clickjacking** | X-Frame-Options: DENY |
| **HSTS** | Strict-Transport-Security header |
| **Client Secrets** | No sensitive keys in `NEXT_PUBLIC_*` except Maps API |

---

## 🛠️ Technical Context

### Key Security Services
| Service | Path | Purpose |
|:---|:---|:---|
| `credential-encryption.ts` | `lib/services/` | AES-256 encrypt/decrypt |
| `audit-encryption.ts` | `lib/services/` | Encrypted audit storage |
| `verification-manager.ts` | `lib/services/` | Multi-step verification |
| `digital-badge.service.ts` | `lib/services/` | QR badge generation |
| `confirmation-code.service.ts` | `lib/services/` | 4-digit mutual verification |
| `account-deletion.ts` | `lib/services/` | GDPR-style data purge |
| `data-access-request.ts` | `lib/services/` | ARCO compliance handler |
| `consent-service.ts` | `lib/services/` | Privacy consent tracking |
| `block-manager.ts` | `lib/services/` | Rate limiting + abuse prevention |
| `compliance-check.ts` | `lib/services/` | Regulatory compliance validation |

### Security Middleware
| File | Purpose |
|:---|:---|
| `middleware.ts` | Edge JWT validation, session enforcement |
| `lib/auth.ts` | `getSession()`, token verification |
| `lib/security/*` | CSP, headers, rate limiting |

---

## 🔗 Connections

- **Parent:** [[Platform Overview]]
- **Children:**
  - [[Technician Verification Security]]
  - [[Digital Badge System]]
  - [[Client Data Folder]]
  - [[Login Flow]]
  - [[Verification Flow]]
- **Audit Report:** [[Security Audit Report Feb 2026]]
- **Related:** [[Mobile App Architecture]], [[Financial System Overview]]

---

## 📝 Notes & TODOs

- [x] 12-phase security audit completed
- [x] AES-256 encryption for all credentials
- [x] Multi-tenant isolation verified (81 tables)
- [x] ARCO compliance (Ley 25.326)
- [x] Consumer protection (Ley 24.240)
- [x] Mutual confirmation code system
- [ ] TODO: WAF integration (Cloudflare)
- [ ] TODO: Automated penetration testing
- [ ] TODO: SOC 2 preparation
- [ ] TODO: Data residency enforcement (AR-only)

---

*Security is not a feature — it's the foundation. Every request authenticated, every query tenant-scoped, every peso tracked.*
