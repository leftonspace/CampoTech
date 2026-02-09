---
description: Security Audit Phase 2 - Authentication & Session Security (AUTH-SEC Agent)
---

# Phase 2: Authentication & Session Security Audit

**Agent Role:** AUTH-SEC
**Priority:** P0 (Critical)
**Estimated Effort:** 4 hours
**Dependencies:** Phase 1 (Infrastructure)

---

## ⚠️ CRITICAL AUDIT PRINCIPLES

1. **NEVER trust existing documentation** - All `.md` files, knowledge base items, and cached information may be outdated
2. **VERIFY everything from source code** - The actual codebase is the ONLY source of truth
3. **ASSUME existing security docs are stale** - Re-verify all claims independently
4. **DOCUMENT discrepancies** - Note when reality differs from documentation

---

## PHASE OBJECTIVES

Audit the authentication and session management for:
- JWT implementation security
- OTP/2FA security and bypass vectors
- Session management and token rotation
- Password/credential handling
- Account lockout mechanisms
- Auth endpoint security

---

## EXECUTION STEPS

### Step 1: Discover All Auth-Related Files

// turbo
1. Find all authentication-related files:
```powershell
cd d:\projects\CampoTech
Get-ChildItem -Recurse -Include "*auth*", "*session*", "*jwt*", "*token*", "*otp*", "*login*" -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "node_modules|\.next|\.expo" } | Select-Object FullName
```

2. Find all auth API endpoints:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps" -Recurse -Filter "route.ts" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match "auth" } | Select-Object FullName
```

### Step 2: JWT Implementation Audit

3. View the main auth library and analyze:
   - File: `d:\projects\CampoTech\apps\web\lib\auth.ts`
   - Check: Algorithm used (HS256, RS256, etc.)
   - Check: Secret key handling
   - Check: Token expiration configuration
   - Check: Payload contents (sensitive data exposure)

4. View the auth security module:
   - File: `d:\projects\CampoTech\apps\web\lib\auth-security.ts`
   - Check: Token rotation mechanism
   - Check: Refresh token implementation
   - Check: Lockout implementation

5. Search for JWT library usage across the codebase:
```powershell
rg "jose|jsonwebtoken|jwt" --type ts -g "!node_modules" -l
```

6. For EACH file found, verify:
   - Consistent algorithm usage
   - Proper verification (not just decoding)
   - Expiration enforcement

7. Search for JWT secret handling:
```powershell
rg "JWT_SECRET|NEXTAUTH_SECRET|jwtSecret" --type ts -g "!node_modules" -A 3 -B 1
```

### Step 3: OTP/2FA Security Audit

8. View the OTP implementation:
   - File: `d:\projects\CampoTech\apps\web\lib\otp.ts`
   - Check: OTP generation algorithm (should be cryptographically secure)
   - Check: OTP length and character set
   - Check: OTP expiration time
   - Check: Rate limiting on OTP attempts
   - Check: OTP reuse prevention

9. Search for TEST/BYPASS OTP patterns (CRITICAL):
```powershell
rg -i "(test.*otp|bypass.*otp|123456|000000|dev.*otp|allow.*dev)" --type ts -g "!node_modules" -A 3 -B 3
```

10. Search for phone number bypasses:
```powershell
rg -i "(test.*phone|bypass.*phone|\+1111|555-|fake.*phone)" --type ts -g "!node_modules"
```

11. View OTP API endpoints:
    - `d:\projects\CampoTech\apps\web\app\api\auth\otp\**`
    - Check: Rate limiting implementation
    - Check: Brute force protection
    - Check: OTP verification logic

### Step 4: Session Management Audit

12. View middleware for session handling:
    - File: `d:\projects\CampoTech\apps\web\middleware.ts`
    - Check: Cookie configuration (HttpOnly, Secure, SameSite)
    - Check: Session validation logic
    - Check: Session expiration enforcement

13. Search for cookie configuration:
```powershell
rg "cookie|Cookie|setCookie|httpOnly|SameSite|Secure" --type ts -g "!node_modules" -A 2 -B 1
```

14. View the refresh token endpoint:
    - File: `d:\projects\CampoTech\apps\web\app\api\auth\refresh\route.ts`
    - Check: Token rotation on refresh
    - Check: Refresh token invalidation
    - Check: Family/chain tracking for token theft detection

15. Search for session storage:
```powershell
rg "localStorage|sessionStorage|AsyncStorage|SecureStore" --type ts --type tsx -g "!node_modules" -A 2
```

### Step 5: Login/Logout Flow Audit

16. View the login endpoint:
    - File: `d:\projects\CampoTech\apps\web\app\api\auth\login\route.ts`
    - Check: Credential validation
    - Check: Brute force protection
    - Check: Timing attack resistance
    - Check: Error message enumeration protection

17. View the logout endpoint:
    - File: `d:\projects\CampoTech\apps\web\app\api\auth\logout\route.ts`
    - Check: Proper token invalidation
    - Check: Session cleanup

18. View the register endpoint:
    - File: `d:\projects\CampoTech\apps\web\app\api\auth\register\route.ts`
    - Check: Input validation
    - Check: Password requirements
    - Check: Email/phone verification

### Step 6: Account Lockout Audit

19. Search for lockout implementation:
```powershell
rg -i "(lockout|locked|attempts|failed.*login|max.*attempts)" --type ts -g "!node_modules" -A 5
```

20. Verify lockout parameters:
    - Maximum failed attempts before lockout
    - Lockout duration
    - Lockout scope (account vs IP)
    - Lockout bypass mechanisms

### Step 7: Cross-Silo Auth Isolation

21. View admin auth endpoints:
    - Directory: `d:\projects\CampoTech\apps\admin\app\api\auth\`
    - Check: Completely separate from SaaS auth
    - Check: No shared session tokens
    - Check: Independent secret keys

22. View mobile auth implementation:
    - Directory: `d:\projects\CampoTech\apps\mobile\lib\auth\`
    - Check: Secure token storage
    - Check: Token refresh mechanism
    - Check: Biometric authentication handling

23. View org switching endpoint:
    - File: `d:\projects\CampoTech\apps\web\app\api\auth\switch-org\route.ts`
    - Check: Membership verification
    - Check: Cannot switch to arbitrary orgs
    - Check: New session token generation

### Step 8: CSRF Protection Verification

24. Search for CSRF implementation in middleware:
```powershell
rg -i "(csrf|origin|referer)" --type ts -g "!node_modules" -A 5 -B 2
```

25. Verify in `middleware.ts`:
    - Origin header validation
    - Referer header fallback
    - Bypass paths are legitimate (webhooks, etc.)
    - State-changing methods are protected

### Step 9: Rate Limiting on Auth Endpoints

26. Search for rate limiting implementation:
```powershell
rg -i "(rate.?limit|throttle|upstash)" --type ts -g "!node_modules" -A 3
```

27. Verify rate limits on:
    - Login endpoint (strict)
    - OTP request endpoint (very strict)
    - OTP verify endpoint (strict)
    - Register endpoint (moderate)
    - Password reset endpoint (strict)

### Step 10: Password Security

28. Search for password handling:
```powershell
rg -i "(password|bcrypt|argon|scrypt|hash|salt)" --type ts -g "!node_modules" -A 3
```

29. Verify:
    - Password hashing algorithm (bcrypt/argon2 preferred)
    - Salt handling (unique per password)
    - Work factor/iterations
    - No plaintext password logging

---

## VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] JWT uses HS256/RS256 with proper key management
- [ ] Token expiration is enforced (24h access, 7d refresh recommended)
- [ ] Refresh token rotation is implemented
- [ ] OTP is cryptographically secure (6+ digits, crypto.randomBytes)
- [ ] NO test OTP bypass in production code paths
- [ ] Account lockout activates after 5 failed attempts
- [ ] Cookies are HttpOnly, Secure, SameSite=Strict
- [ ] Admin auth is completely isolated from SaaS auth
- [ ] CSRF protection covers all state-changing endpoints
- [ ] Rate limiting is active on all auth endpoints
- [ ] Passwords are hashed with bcrypt/argon2 (cost factor ≥10)

---

## OUTPUT REQUIREMENTS

Generate a findings report in markdown format at:
`d:\projects\CampoTech\.agent\audit-results\phase-2-authentication-findings.md`

The report MUST include:

1. **Executive Summary** - Overall auth security posture
2. **JWT Security Analysis** - Algorithm, expiration, payload review
3. **OTP/2FA Vulnerabilities** - Any bypass vectors found
4. **Session Management Issues** - Cookie, storage, rotation problems
5. **Brute Force Protection** - Lockout and rate limiting effectiveness
6. **Cross-Silo Isolation** - Admin vs SaaS vs Mobile separation
7. **Remediation Plan** - Prioritized fix recommendations
8. **Code Samples** - Vulnerable code snippets with line numbers

---

## CRITICAL VULNERABILITY PATTERNS TO SEARCH

```powershell
# Search for all patterns - document findings
rg "ALLOW_DEV_OTP|skipVerification|bypassAuth" --type ts -g "!node_modules"
rg "alg.*none|algorithm.*none" --type ts -g "!node_modules"
rg "verify.*false|skipVerify" --type ts -g "!node_modules"
rg "console\.log.*password|console\.log.*token" --type ts -g "!node_modules"
```

---

## ESCALATION CRITERIA

Immediately escalate if ANY of the following are found:
- OTP bypass in production code paths
- JWT algorithm confusion vulnerability (accepts 'none')
- Hardcoded credentials/tokens
- No account lockout mechanism
- Cookies without HttpOnly flag
- Password logged in plaintext

---

## NEXT PHASE

After completing Phase 2, the following phases can begin:
- Phase 3: DATA-SEC (can parallel)
- Phase 4: PAY-SEC (depends on Phase 2, 3)
- Phase 6: AUTHZ-SEC (depends on Phase 2)
