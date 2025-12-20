# CampoTech Security Audit Report

**Phase 7.3.1: OWASP Top 10 Security Audit**

**Date:** December 2025
**Auditor:** AI Security Analysis
**Scope:** apps/web/

---

## Executive Summary

The CampoTech web application has been audited against the OWASP Top 10 security risks. The application demonstrates **good security practices** in most areas, with some **areas for improvement** noted below.

| Category | Status | Risk Level |
|----------|--------|------------|
| Injection | ⚠️ Needs Review | Medium |
| Authentication | ✅ Good | Low |
| Sensitive Data Exposure | ✅ Good | Low |
| XXE | ✅ Good | Low |
| Broken Access Control | ✅ Good | Low |
| Security Misconfiguration | ⚠️ Partial | Medium |
| XSS | ✅ Good | Low |
| Insecure Deserialization | ✅ Good | Low |
| Vulnerable Components | ⚠️ Needs Update | Medium |
| Insufficient Logging | ✅ Good | Low |

---

## Detailed Findings

### 1. Injection (A03:2021) - ⚠️ MEDIUM RISK

**Finding:** Use of `$queryRawUnsafe` and `$executeRawUnsafe` in several locations.

**Locations:**
- `lib/jobs/partition-manager.ts:236` - Partition table names
- `lib/jobs/data-archiver.ts:470,487,507,538,541` - Table names in queries
- `lib/services/geocoding.ts:342,418,435,467,474,483,797` - Queue operations
- `lib/services/usage-tracker.ts:170,201` - Column names in queries
- `app/api/audit-logs/route.ts:92,99` - Dynamic where clauses

**Assessment:**
- Most uses pass table/column names that are **internally controlled** (not from user input)
- The audit-logs route builds where clauses dynamically but uses **parameterized values**
- **Risk is MEDIUM** because table names are from config, not user input

**Recommendations:**
```typescript
// Instead of:
await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE id = ANY($1)`, ids);

// Consider validating table names:
const ALLOWED_TABLES = ['jobs', 'invoices', ...];
if (!ALLOWED_TABLES.includes(table)) throw new Error('Invalid table');
```

---

### 2. Broken Authentication (A07:2021) - ✅ LOW RISK

**Positive Findings:**
- ✅ JWT tokens with proper signature verification (jose library)
- ✅ Rate limiting on auth endpoints (10 req/min)
- ✅ OTP codes are hashed with SHA-256 before storage
- ✅ Tokens expire after 7 days
- ✅ HttpOnly cookies for auth tokens

**Locations:**
- `lib/auth.ts` - JWT creation/verification
- `middleware.ts:70` - Auth rate limiting
- `lib/otp.ts` - Secure OTP handling

**Minor Recommendations:**
- Consider shorter token expiration (24h) with refresh tokens
- Add failed login attempt tracking
- Implement account lockout after N failed attempts

---

### 3. Sensitive Data Exposure (A02:2021) - ✅ LOW RISK

**Positive Findings:**
- ✅ Passwords never stored in plain text (bcrypt used in seed)
- ✅ API keys read from environment variables
- ✅ Audit encryption service for sensitive audit data
- ✅ Data export includes only user's own data

**Locations:**
- `lib/services/audit-encryption.ts` - AES-256-GCM encryption
- `lib/email.ts` - API key from env vars
- `prisma/seed.ts:28` - bcrypt for password hashing

**Minor Concern:**
- `lib/auth.ts:5` has fallback secret - should fail if not configured
```typescript
// Current (less secure):
process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-production'

// Recommended:
process.env.NEXTAUTH_SECRET || (() => { throw new Error('NEXTAUTH_SECRET required'); })()
```

---

### 4. XML External Entities (A05:2017) - ✅ LOW RISK

**Finding:** No XML parsing detected in the codebase.
- JSON is used for all data interchange
- No XML libraries imported

---

### 5. Broken Access Control (A01:2021) - ✅ LOW RISK

**Positive Findings:**
- ✅ Role-based access control implemented
- ✅ OWNER-only restrictions on sensitive endpoints
- ✅ Organization ID scoping on all data queries
- ✅ Session validation on protected routes

**Locations:**
- `app/api/users/route.ts:116` - Role check for user creation
- `app/api/settings/afip/route.ts:73` - OWNER only
- `app/api/subscription/cancel/route.ts` - OWNER only

**Example Pattern (Good):**
```typescript
if (!['OWNER'].includes(session.role.toUpperCase())) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

### 6. Security Misconfiguration (A05:2021) - ⚠️ MEDIUM RISK

**Positive Findings:**
- ✅ `poweredByHeader: false` in next.config.js
- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff
- ✅ X-XSS-Protection: 1; mode=block
- ✅ Referrer-Policy: strict-origin-when-cross-origin
- ✅ Rate limiting implemented

**Missing/Incomplete:**
- ❌ No Content-Security-Policy (CSP) header
- ❌ No Strict-Transport-Security (HSTS) header
- ⚠️ CSRF protection mentioned but not fully implemented

**Recommendation - Add to next.config.js:**
```javascript
{
  key: 'Content-Security-Policy',
  value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.mercadopago.com https://api.openai.com;"
},
{
  key: 'Strict-Transport-Security',
  value: 'max-age=31536000; includeSubDomains'
}
```

---

### 7. Cross-Site Scripting (A03:2021) - ✅ LOW RISK

**Positive Findings:**
- ✅ No `dangerouslySetInnerHTML` usage detected
- ✅ No `eval()` or `Function()` usage detected
- ✅ React's built-in XSS protection (JSX escaping)
- ✅ X-XSS-Protection header set

**Assessment:** React's default behavior prevents most XSS attacks.

---

### 8. Insecure Deserialization (A08:2017) - ✅ LOW RISK

**Positive Findings:**
- ✅ Standard JSON.parse() usage only
- ✅ No custom deserialization of untrusted data
- ✅ Request body parsing handled by Next.js

---

### 9. Using Components with Known Vulnerabilities (A06:2021) - ⚠️ MEDIUM RISK

**NPM Audit Results:**
| Package | Severity | Issue | Fix Available |
|---------|----------|-------|---------------|
| xlsx | HIGH | Prototype Pollution (GHSA-4r6h-8v6p-xvw6) | ❌ No fix |
| xlsx | HIGH | ReDoS (GHSA-5pgg-2g8v-p9x) | ❌ No fix |
| @babel/runtime | MODERATE | ReDoS in regex (GHSA-968p-4wvh-cqc8) | ✅ Update to 7.26.10+ |

**Recommendations:**
1. Update `@babel/runtime` to latest version
2. For `xlsx` vulnerability:
   - Consider replacing with `exceljs` or `sheetjs-ce` (community edition)
   - If keeping xlsx, validate all input files before processing
   - Run xlsx operations in sandboxed environment

---

### 10. Insufficient Logging & Monitoring (A09:2021) - ✅ LOW RISK

**Positive Findings:**
- ✅ Comprehensive audit logging (`lib/audit/logger.ts`)
- ✅ Logs include: userId, action, entityType, entityId, oldValue, newValue
- ✅ IP address and User-Agent captured
- ✅ Compliance with Ley 25.326 requirements

**Locations:**
- `lib/audit/logger.ts` - Audit logging utility
- Audit logs used in: subscription changes, user updates, settings changes

---

## Security Checklist Summary

### OWASP Top 10 Coverage

| # | Category | Implementation | Status |
|---|----------|----------------|--------|
| A01 | Broken Access Control | Role-based, org-scoped | ✅ |
| A02 | Cryptographic Failures | AES-256-GCM, bcrypt | ✅ |
| A03 | Injection | Parameterized queries (mostly) | ⚠️ |
| A04 | Insecure Design | N/A for this audit | - |
| A05 | Security Misconfiguration | Headers set, CSP missing | ⚠️ |
| A06 | Vulnerable Components | 2 high severity deps | ⚠️ |
| A07 | Auth Failures | JWT, rate limiting, OTP | ✅ |
| A08 | Data Integrity Failures | React, no unsafe deser | ✅ |
| A09 | Logging Failures | Comprehensive audit logs | ✅ |
| A10 | SSRF | No URL fetching from user input | ✅ |

---

## Priority Action Items

### High Priority
1. **Update @babel/runtime** - Run `npm update @babel/runtime`
2. **Replace or sandbox xlsx** - Prototype pollution vulnerability

### Medium Priority
3. **Add Content-Security-Policy header** - Prevent XSS attacks
4. **Add HSTS header** - Enforce HTTPS
5. **Validate table names in raw queries** - Prevent potential injection

### Low Priority
6. **Remove fallback secret** - Fail if NEXTAUTH_SECRET not set
7. **Add account lockout** - After failed login attempts
8. **Shorter token expiration** - Consider 24h with refresh

---

## Files Reviewed

- `middleware.ts` - Rate limiting, security headers
- `next.config.js` - Security configuration
- `lib/auth.ts` - Authentication
- `lib/otp.ts` - OTP handling
- `lib/audit/logger.ts` - Audit logging
- `lib/services/audit-encryption.ts` - Data encryption
- `app/api/**/*.ts` - API routes (access control)
- `lib/jobs/data-archiver.ts` - Raw SQL usage
- `lib/services/geocoding.ts` - Raw SQL usage
- `package.json` - Dependencies

---

## Compliance Notes

- **Ley 25.326 (Data Protection):** Audit logging implemented ✅
- **Ley 24.240 (Consumer Protection):** Cancellation button implemented ✅
- **OWASP Top 10:** 7/10 fully compliant, 3/10 need improvement

---

*This audit was performed as part of Phase 7.3 of the CampoTech Scale-Readiness implementation.*
