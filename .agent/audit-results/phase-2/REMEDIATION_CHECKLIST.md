# Phase 2 Authentication Security - Remediation Checklist

**Created:** 2026-02-05  
**Priority:** P0 (CRITICAL)  
**Estimated Effort:** 3-5 days  
**Dependencies:** Phase 1 PASS ✅

---

## 🚨 CRITICAL PRIORITY (Deploy Within 24-48 Hours)

### ✅ CRIT-1: Fix OTP Verify Cookie Configuration

**File:** `apps/web/app/api/auth/otp/verify/route.ts`

- [ ] **Step 1:** Change `httpOnly: false` to `httpOnly: true` (Line 107)
  ```typescript
  // BEFORE:
  response.cookies.set('auth-token', accessToken, {
    httpOnly: false, // ❌ VULNERABLE
  
  // AFTER:
  response.cookies.set('auth-token', accessToken, {
    httpOnly: true, // ✅ FIXED
  ```

- [ ] **Step 2:** Align token expiration to 24 hours (Line 110)
  ```typescript
  // BEFORE:
  maxAge: 60 * 60 * 24 * 7, // 7 days
  
  // AFTER:
  maxAge: 60 * 60 * 24, // 24 hours (consistent with login)
  ```

- [ ] **Step 3:** Upgrade SameSite to 'strict' (Line 109)
  ```typescript
  // BEFORE:
  sameSite: 'lax',
  
  // AFTER:
  sameSite: 'strict',
  ```

- [ ] **Step 4:** Add refresh token cookie
  ```typescript
  // Add after access token cookie:
  response.cookies.set('refresh-token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: 60 * 60 * 24 * 7,
  });
  ```

- [ ] **Step 5:** Test login flow still works
  ```bash
  # Test OTP login
  curl -X POST http://localhost:3000/api/auth/otp/request \
    -H "Content-Type: application/json" \
    -d '{"phone":"+543516123456"}'
  
  # Verify cookie has httpOnly flag in Chrome DevTools
  ```

- [ ] **Step 6:** Deploy to staging
- [ ] **Step 7:** Verify staging login works
- [ ] **Step 8:** Deploy to production
- [ ] **Step 9:** Monitor error logs for 24 hours

**Verification:**
```bash
# After deployment, inspect cookies in browser DevTools:
# Network → Response Headers → Set-Cookie
# Should see: HttpOnly; Secure; SameSite=Strict
```

---

### ✅ CRIT-2: Fix Test Phone Bypass

**File:** `apps/web/lib/otp.ts`

- [ ] **Step 1:** Add environment check to `isTestPhoneNumber()` (Line 56-59)
  ```typescript
  // BEFORE:
  function isTestPhoneNumber(phone: string): boolean {
    const normalizedPhone = phone.replace(/[^+\d]/g, '');
    return TEST_PHONE_PREFIXES.some(prefix => normalizedPhone.startsWith(prefix));
  }
  
  // AFTER:
  function isTestPhoneNumber(phone: string): boolean {
    // Test phones only work in development
    if (process.env.NODE_ENV !== 'development') {
      return false;
    }
    const normalizedPhone = phone.replace(/[^+\d]/g, '');
    return TEST_PHONE_PREFIXES.some(prefix => normalizedPhone.startsWith(prefix));
  }
  ```

- [ ] **Step 2:** Test in development (should still work)
  ```bash
  # Development: +543516000123 with code 123456 should work
  NODE_ENV=development pnpm dev
  ```

- [ ] **Step 3:** Test in production build (should fail)
  ```bash
  # Production: +543516000123 with code 123456 should require real OTP
  NODE_ENV=production pnpm build && pnpm start
  ```

- [ ] **Step 4:** Deploy to production

**Verification:**
```typescript
// Production test:
// 1. Register with +543516000123
// 2. Request OTP
// 3. Try code 123456
// Expected: "Código incorrecto" (should fail)
```

---

### ✅ CRIT-3: Secure Admin Passwords Immediately

**File:** `apps/admin/lib/auth.ts`

- [ ] **Step 1:** Generate strong passwords
  ```bash
  # Generate secure passwords (DO NOT commit to Git)
  openssl rand -base64 32  # For ADMIN_PASSWORD
  openssl rand -base64 32  # For KEVIN_PASSWORD
  ```

- [ ] **Step 2:** Store in production secrets
  ```bash
  # Vercel:
  vercel env add ADMIN_PASSWORD production
  vercel env add KEVIN_PASSWORD production
  
  # Or use secrets manager (1Password, HashiCorp Vault)
  ```

- [ ] **Step 3:** Update `.env.example` with placeholder
  ```bash
  # .env.example
  ADMIN_PASSWORD=<generate-secure-password-here>
  KEVIN_PASSWORD=<generate-secure-password-here>
  ```

- [ ] **Step 4:** Verify environment variables are set
  ```bash
  # Check production environment
  vercel env pull .env.production.local
  grep ADMIN_PASSWORD .env.production.local
  ```

- [ ] **Step 5:** Test admin login
- [ ] **Step 6:** Notify admins of new passwords (via secure channel)

**⚠️ IMPORTANT:** Delete old passwords from:
- [ ] Local `.env` files
- [ ] Git history (if committed)
- [ ] Shared documents
- [ ] Slack/email

---

## 🔴 HIGH PRIORITY (Within 1 Week)

### ✅ HIGH-1: Implement Database Tables for Auth Security

**Files:** Prisma schema + migrations

- [ ] **Step 1:** Add models to `apps/web/prisma/schema.prisma`
  ```prisma
  model RefreshToken {
    id          String   @id @default(uuid())
    userId      String   @map("user_id")
    tokenHash   String   @map("token_hash")
    expiresAt   DateTime @map("expires_at")
    userAgent   String?  @map("user_agent")
    ipAddress   String?  @map("ip_address")
    revoked     Boolean  @default(false)
    createdAt   DateTime @default(now()) @map("created_at")
    
    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
    
    @@map("refresh_tokens")
    @@index([userId])
    @@index([tokenHash])
  }

  model LoginAttempt {
    id             String   @id @default(uuid())
    identifier     String
    identifierType String   @map("identifier_type")
    success        Boolean
    ipAddress      String?  @map("ip_address")
    userAgent      String?  @map("user_agent")
    userId         String?  @map("user_id")
    createdAt      DateTime @default(now()) @map("created_at")
    
    @@map("login_attempts")
    @@index([identifier, identifierType])
    @@index([createdAt])
  }

  model LoginLockout {
    id             String   @id @default(uuid())
    identifier     String
    identifierType String   @map("identifier_type")
    lockedUntil    DateTime @map("locked_until")
    createdAt      DateTime @default(now()) @map("created_at")
    
    @@unique([identifier, identifierType])
    @@map("login_lockouts")
  }
  ```

- [ ] **Step 2:** Add RefreshToken relation to User model
  ```prisma
  model User {
    // ... existing fields
    refreshTokens RefreshToken[]
  }
  ```

- [ ] **Step 3:** Generate migration
  ```bash
  cd apps/web
  pnpm prisma migrate dev --name add-auth-security-tables
  ```

- [ ] **Step 4:** Review generated SQL migration
  ```bash
  cat prisma/migrations/YYYYMMDDHHMMSS_add-auth-security-tables/migration.sql
  ```

- [ ] **Step 5:** Test migration in development
  ```bash
  pnpm prisma migrate dev
  pnpm prisma studio  # Verify tables exist
  ```

- [ ] **Step 6:** Deploy migration to staging
  ```bash
  # Staging environment
  pnpm prisma migrate deploy
  ```

- [ ] **Step 7:** Test login/refresh in staging
  ```bash
  # Login and verify refresh_tokens table has records
  # Check login_attempts and login_lockouts work
  ```

- [ ] **Step 8:** Deploy to production (during maintenance window)
  ```bash
  # Production database backup FIRST
  # Then:
  pnpm prisma migrate deploy
  ```

- [ ] **Step 9:** Monitor production logs for database errors

**Verification Queries:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('refresh_tokens', 'login_attempts', 'login_lockouts');

-- Count refresh tokens
SELECT COUNT(*) FROM refresh_tokens;

-- Check login attempts tracking
SELECT * FROM login_attempts ORDER BY created_at DESC LIMIT 10;
```

---

### ✅ HIGH-2: Implement Admin Password Hashing

**File:** `apps/admin/lib/auth.ts`

- [ ] **Step 1:** Install bcryptjs
  ```bash
  cd apps/admin
  pnpm add bcryptjs
  pnpm add -D @types/bcryptjs
  ```

- [ ] **Step 2:** Generate password hashes (OFFLINE)
  ```bash
  node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YOUR_ADMIN_PASSWORD', 12));"
  node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YOUR_KEVIN_PASSWORD', 12));"
  ```

- [ ] **Step 3:** Update environment variables with hashes
  ```bash
  # Store HASHES in production env (not plaintext passwords)
  ADMIN_PASSWORD_HASH=$2a$12$abcdef123456...
  KEVIN_PASSWORD_HASH=$2a$12$ghijkl789012...
  ```

- [ ] **Step 4:** Update `ADMIN_USERS` to use hashes
  ```typescript
  const ADMIN_USERS: Record<string, { passwordHash: string; user: AdminUser }> = {
    'admin@campotech.com.ar': {
      passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
      user: { id: 'admin-1', email: 'admin@campotech.com.ar', name: 'Admin Principal', role: 'super_admin' },
    },
    'kevin@campotech.com.ar': {
      passwordHash: process.env.KEVIN_PASSWORD_HASH || '',
      user: { id: 'admin-2', email: 'kevin@campotech.com.ar', name: 'Kevin', role: 'super_admin' },
    },
  };
  ```

- [ ] **Step 5:** Update `validateCredentials()` to use bcrypt
  ```typescript
  import bcrypt from 'bcryptjs';

  export async function validateCredentials(email: string, password: string): Promise<AdminUser | null> {
    const adminEntry = ADMIN_USERS[email.toLowerCase()];
    if (!adminEntry) return null;
    
    if (!adminEntry.passwordHash) {
      console.error('Admin password hash not configured');
      return null;
    }

    const isValid = await bcrypt.compare(password, adminEntry.passwordHash);
    if (!isValid) return null;

    return adminEntry.user;
  }
  ```

- [ ] **Step 6:** Update login route to handle async
  ```typescript
  // apps/admin/app/api/auth/login/route.ts
  const user = await validateCredentials(email, password); // Add await
  ```

- [ ] **Step 7:** Test admin login
- [ ] **Step 8:** Deploy to production
- [ ] **Step 9:** Verify login still works

---

### ✅ HIGH-3: Fix Admin Session Token Crypto

**File:** `apps/admin/lib/auth.ts`

- [ ] **Step 1:** Import Node.js crypto module
  ```typescript
  import crypto from 'crypto';
  ```

- [ ] **Step 2:** Replace `Math.random()` with `crypto.randomBytes()`
  ```typescript
  // BEFORE:
  export function generateSessionToken(userId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2); // ❌
    return `${SESSION_PREFIX}${userId}_${timestamp}_${random}`;
  }

  // AFTER:
  export function generateSessionToken(userId: string): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(32).toString('hex'); // ✅
    return `${SESSION_PREFIX}${userId}_${timestamp}_${random}`;
  }
  ```

- [ ] **Step 3:** Test admin login
- [ ] **Step 4:** Verify tokens are unpredictable
  ```typescript
  // Generate 5 tokens, should all be unique
  console.log(generateSessionToken('admin-1'));
  console.log(generateSessionToken('admin-1'));
  console.log(generateSessionToken('admin-1'));
  ```

- [ ] **Step 5:** Deploy to production

---

### ✅ HIGH-4: Remove/Protect Dev OTP Bypass

**File:** `apps/web/lib/otp.ts`

- [ ] **Step 1:** Document the bypass in README
  ```markdown
  # Development OTP Bypass
  
  For local development, you can use the dev OTP bypass:
  1. Set `ALLOW_DEV_OTP=true` in `.env`
  2. Use code `123456` for any phone number
  
  ⚠️ NEVER set ALLOW_DEV_OTP=true in production!
  ```

- [ ] **Step 2:** Add warning in code
  ```typescript
  function isDevBypassAllowed(): boolean {
    if (process.env.NODE_ENV === 'production') {
      // Hard-coded false in production builds
      return false;
    }
    return process.env.NODE_ENV === 'development' || process.env.ALLOW_DEV_OTP === 'true';
  }
  ```

- [ ] **Step 3:** Add to `.env.example` with warning
  ```bash
  # .env.example
  # ⚠️ DEVELOPMENT ONLY - NEVER set to 'true' in production
  # ALLOW_DEV_OTP=true
  ```

- [ ] **Step 4:** Verify production environment DOES NOT have `ALLOW_DEV_OTP` set
  ```bash
  vercel env ls production | grep ALLOW_DEV_OTP
  # Should return nothing
  ```

- [ ] **Step 5:** Add deployment check
  ```bash
  # Add to CI/CD pipeline
  if [ "$NODE_ENV" = "production" ] && [ "$ALLOW_DEV_OTP" = "true" ]; then
    echo "ERROR: ALLOW_DEV_OTP must not be set in production"
    exit 1
  fi
  ```

---

### ✅ HIGH-5: Fix Switch-Org Token Refresh

**File:** `apps/web/app/api/auth/switch-org/route.ts`

- [ ] **Step 1:** Import token creation functions
  ```typescript
  import { createTokenPair } from '@/lib/auth-security';
  ```

- [ ] **Step 2:** Generate new tokens after org switch (after Line 85)
  ```typescript
  // After successful org switch:
  const user = await prisma.user.findUnique({
    where: { id: auth.user.userId },
    include: { organization: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 500 });
  }

  // Create new token pair with updated organizationId
  const tokenPair = await createTokenPair({
    userId: user.id,
    email: user.email,
    role: result.role,
    organizationId: result.organizationId, // ✅ Updated
    subscriptionTier: user.organization.subscriptionTier,
    subscriptionStatus: user.organization.subscriptionStatus,
  });

  const response = NextResponse.json({
    success: true,
    message: `Switched to ${result.organizationName}`,
    organizationId: result.organizationId,
    // Remove requiresSessionRefresh flag
  });

  // Set new cookies
  response.cookies.set('auth-token', tokenPair.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24,
  });

  response.cookies.set('refresh-token', tokenPair.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
  ```

- [ ] **Step 3:** Test org switching
- [ ] **Step 4:** Verify JWT contains new organizationId
- [ ] **Step 5:** Deploy to production

---

## 🟡 MEDIUM PRIORITY (Within 2 Weeks)

### ✅ MED-1: Upgrade All Cookies to SameSite=Strict

**Files:** All auth endpoints

- [ ] **Login endpoint:** `apps/web/app/api/auth/login/route.ts`
- [ ] **Refresh endpoint:** `apps/web/app/api/auth/refresh/route.ts`
- [ ] **Admin login:** `apps/admin/app/api/auth/login/route.ts`

Change all cookies to:
```typescript
sameSite: 'strict'
```

**Testing Required:**
- [ ] Test OAuth flows (if any)
- [ ] Test deep links from emails
- [ ] Test mobile app auth

---

### ✅ MED-2: Implement Logout Endpoint

**New File:** `apps/web/app/api/auth/logout/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { revokeAllUserTokens } from '@/lib/auth-security';

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (session) {
    // Revoke all refresh tokens
    await revokeAllUserTokens(session.userId);
  }

  const response = NextResponse.json({ success: true });

  // Clear cookies
  response.cookies.delete('auth-token');
  response.cookies.delete('refresh-token');

  return response;
}
```

---

## ✅ FINAL VERIFICATION

After completing all critical and high priority items:

- [ ] **Re-run Phase 2 audit**
  ```bash
  # Verify all findings are remediated
  ```

- [ ] **Penetration testing:**
  - [ ] Test XSS token theft (should fail)
  - [ ] Test test phone bypass (should fail in prod)
  - [ ] Test brute force protection (should activate)
  - [ ] Test admin password guessing (should fail)

- [ ] **Production monitoring:**
  - [ ] Set up alerts for failed login attempts
  - [ ] Monitor refresh token errors
  - [ ] Track admin login events

- [ ] **Documentation:**
  - [ ] Update security documentation
  - [ ] Document emergency procedures
  - [ ] Create runbook for token revocation

---

## 📊 PROGRESS TRACKING

| Priority | Item | Status | Assignee | Due Date | Completed |
|----------|------|--------|----------|----------|-----------|
| 🔴 CRIT | OTP Cookie httpOnly | ⏳ Pending | | 2026-02-06 | ☐ |
| 🔴 CRIT | Test Phone Bypass | ⏳ Pending | | 2026-02-06 | ☐ |
| 🔴 CRIT | Admin Passwords | ⏳ Pending | | 2026-02-06 | ☐ |
| 🔴 HIGH | Database Tables | ⏳ Pending | | 2026-02-12 | ☐ |
| 🔴 HIGH | Admin Password Hash | ⏳ Pending | | 2026-02-12 | ☐ |
| 🔴 HIGH | Admin Token Crypto | ⏳ Pending | | 2026-02-12 | ☐ |
| 🔴 HIGH | Dev Bypass Protection | ⏳ Pending | | 2026-02-12 | ☐ |
| 🔴 HIGH | Switch-Org Token | ⏳ Pending | | 2026-02-12 | ☐ |

---

**Last Updated:** 2026-02-05  
**Next Review:** After critical items completed  
**Escalation Contact:** Security Team Lead
