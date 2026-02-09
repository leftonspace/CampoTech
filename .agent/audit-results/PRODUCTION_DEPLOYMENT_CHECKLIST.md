# 🚀 Production Deployment Checklist - Security Audit

**Generated:** 2026-02-05 14:31 EST  
**Phases Covered:** Phase 1 (Infrastructure) + Phase 2 (Authentication)  
**Status:** Ready for Production Deployment

---

## Pre-Deployment Requirements

### ✅ Prerequisites Verified

| Item | Status | Notes |
|------|--------|-------|
| Phase 1 Closure | ✅ PASS | Infrastructure security complete |
| Phase 2 Closure | ✅ PASS | Authentication security complete |
| Development DB Synced | ✅ Done | Tables created via `prisma db push` |
| Dev Environment Tested | ⏳ Pending | Recommend manual testing before prod |

---

## Phase 1: Infrastructure Security

### GitHub Actions (Already Applied)
- [x] All actions pinned to commit SHAs
- [x] No `@latest` or `@v1` tags in workflows

### Dependencies (Verified in `pnpm-lock.yaml`)
- [x] `tar` patched via pnpm.overrides
- [x] `fast-xml-parser` patched via pnpm.overrides
- [x] `@isaacs/brace-expansion` patched via pnpm.overrides

**No production action required** - already in codebase.

---

## Phase 2: Authentication Security

### 🔴 CRITICAL - Environment Variables

Before deploying, set these in your **production environment** (Vercel/Railway/etc.):

```bash
# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN APP - Password Hashes (REQUIRED)
# ═══════════════════════════════════════════════════════════════════════════════

# Generate your own production hashes:
# node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YOUR_PROD_PASSWORD', 12));"

ADMIN_PASSWORD_HASH=<your-production-hash>
KEVIN_PASSWORD_HASH=<your-production-hash>
```

⚠️ **DO NOT use the development hashes in production!**

### 🔴 CRITICAL - Database Migration

Run against your **production database**:

```bash
# Option 1: If using Prisma migrations
pnpm prisma migrate deploy --schema=apps/web/prisma/schema.prisma

# Option 2: Direct schema push (simpler but less audit trail)
pnpm prisma db push --schema=apps/web/prisma/schema.prisma
```

**Tables to verify exist after migration:**
- `refresh_tokens`
- `login_attempts`
- `login_lockouts`

---

## Deployment Steps

### Step 1: Generate Production Password Hashes

```bash
# Run locally - DO NOT commit these hashes to git!
cd apps/admin

# For admin@campotech.com.ar
node -e "const bcrypt = require('bcryptjs'); console.log('ADMIN:', bcrypt.hashSync('YOUR_SECURE_ADMIN_PASSWORD', 12));"

# For kevin@campotech.com.ar  
node -e "const bcrypt = require('bcryptjs'); console.log('KEVIN:', bcrypt.hashSync('YOUR_SECURE_KEVIN_PASSWORD', 12));"
```

### Step 2: Configure Production Environment

**Vercel:**
1. Go to Project Settings → Environment Variables
2. Add `ADMIN_PASSWORD_HASH` with the generated hash
3. Add `KEVIN_PASSWORD_HASH` with the generated hash
4. Select "Production" environment only

**Railway:**
1. Go to your service → Variables
2. Add the same environment variables
3. Ensure they're only for production

### Step 3: Run Production Migration

```bash
# Set your production DATABASE_URL first
export DATABASE_URL="postgresql://..."
export DIRECT_URL="postgresql://..."

# Run migration
cd apps/web
pnpm prisma migrate deploy
```

### Step 4: Deploy Code

```bash
# Push to main/production branch
git add .
git commit -m "chore(security): Phase 2 authentication security fixes

- Fixed OTP cookie httpOnly and sameSite flags (CRIT-2)
- Added auth security tables (CRIT-1)
- Implemented bcrypt password hashing for admin (HIGH-1)
- Replaced Math.random with crypto.randomBytes (HIGH-2)
- Added production guards for test phone bypass (HIGH-3)
- Disabled ALLOW_DEV_OTP in production (HIGH-4)"

git push origin main
```

### Step 5: Verify Deployment

After deployment, verify in browser DevTools:

1. **OTP Cookie Security:**
   - Open DevTools → Application → Cookies
   - Find `auth-token` cookie
   - Verify: `HttpOnly: true`, `SameSite: Strict`, `Secure: true`

2. **Admin Login:**
   - Navigate to admin panel
   - Login with production credentials
   - Verify session works correctly

3. **Database Tables:**
   ```sql
   -- Run against production DB
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_name IN ('refresh_tokens', 'login_attempts', 'login_lockouts');
   ```

---

## Security Verification Checklist

### Cookie Security
- [ ] `auth-token` cookie has `HttpOnly: true`
- [ ] `auth-token` cookie has `SameSite: Strict`
- [ ] `auth-token` cookie has `Secure: true` (HTTPS only)
- [ ] `admin_session` cookie has `HttpOnly: true`
- [ ] `admin_session` cookie has `SameSite: Strict`

### OTP Bypass Verification
- [ ] Test phone numbers (+543516000XXX) do NOT bypass OTP in production
- [ ] `ALLOW_DEV_OTP=true` does NOT work in production
- [ ] OTP codes expire after 5 minutes

### Admin Authentication
- [ ] Admin login works with new bcrypt passwords
- [ ] Old plaintext passwords do NOT work
- [ ] Session tokens are 64+ characters (crypto.randomBytes)

### Database
- [ ] `refresh_tokens` table exists
- [ ] `login_attempts` table exists
- [ ] `login_lockouts` table exists
- [ ] User relation to refresh_tokens works

---

## Rollback Plan

If issues arise after deployment:

### Quick Rollback (Code)
```bash
git revert HEAD
git push origin main
```

### Database Rollback
The new tables are **additive only** - existing functionality won't break.
To remove (only if necessary):
```sql
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS login_lockouts CASCADE;
```

### Authentication Fallback
If bcrypt issues occur in admin:
1. The code has a fallback to scrypt comparison
2. Worst case: revert to previous auth.ts file

---

## Post-Deployment Monitoring

### First 24 Hours
- [ ] Monitor error logs for auth failures
- [ ] Check for abnormal login_attempts table growth
- [ ] Verify no users are unexpectedly locked out

### Ongoing
- [ ] Set up alerts for >100 failed login attempts/hour
- [ ] Monitor refresh_token table size (cleanup cron recommended)
- [ ] Review login_lockouts for attack patterns

---

## Support Contacts

If issues arise during deployment:

| Issue | Action |
|-------|--------|
| Admin can't login | Verify password hash env vars are set |
| OTP not working | Check Twilio/WhatsApp credentials |
| Database errors | Verify migration ran successfully |
| Cookie issues | Check HTTPS is enabled |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Security Auditor | AUTH-SEC Agent | 2026-02-05 | ✅ |
| Lead Developer | _______________ | __________ | ☐ |
| DevOps | _______________ | __________ | ☐ |

---

*This checklist was generated as part of the CampoTech Security Audit - Phases 1 & 2.*
