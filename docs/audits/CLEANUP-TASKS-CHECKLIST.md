# CampoTech Cleanup Tasks - Quick Reference
**Generated:** January 2, 2026  
**Source:** CODEBASE-CLEANUP-AUDIT.md  
**Status:** Ready to Execute

---

## 🚀 QUICK START

**Total Tasks:** 12  
**Estimated Time:** 40 minutes  
**Priority Order:** Critical → High → Medium

---

## ✅ PHASE 1: CRITICAL DELETIONS (5 min)

### Task 1.1: Delete AWS Deployment Workflows ❌
```bash
# Delete broken AWS ECS workflows
rm .github/workflows/deploy-production.yml
rm .github/workflows/deploy-staging.yml
```
**Why:** Using Vercel (serverless), not AWS ECS (containers)  
**Impact:** Removes 505 lines of broken code

---

### Task 1.2: Delete Legacy npm Lock Files ❌
```bash
# Find all package-lock.json files
find . -name "package-lock.json" -not -path "*/node_modules/*"

# Delete them (review list first!)
find . -name "package-lock.json" -not -path "*/node_modules/*" -delete
```
**Why:** Standardizing on pnpm  
**Impact:** Eliminates package manager conflicts

---

## 🔧 PHASE 2: WORKFLOW FIXES (15 min)

### Task 2.1: Update CI Workflow to pnpm ⚠️
**File:** `.github/workflows/ci.yml`

**Changes:**
1. Add pnpm setup before Node.js setup
2. Change cache from 'npm' to 'pnpm'
3. Replace all `npm ci` with `pnpm install --frozen-lockfile`
4. Replace all `npm run` with `pnpm`

**See:** Full diff in CODEBASE-CLEANUP-AUDIT.md, Task 1.5

---

### Task 2.2: Fix E2E Workflow ⚠️
**File:** `.github/workflows/e2e.yml`

**Changes:**
1. **DELETE** entire `api-e2e` job (lines 210-282)
2. **DELETE** entire `e2e-mobile` job (lines 133-208)
3. **KEEP** only `e2e-web` job
4. Update `e2e-web` to use pnpm
5. Fix working directory to `apps/web`

**See:** Full details in CODEBASE-CLEANUP-AUDIT.md, Tasks 1.2 & 1.3

---

### Task 2.3: Add E2E Test Script ➕
**File:** `apps/web/package.json`

**Add to scripts section:**
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

**Verify:**
```bash
cd apps/web
pnpm test:e2e
```

---

### Task 2.4: Add Database Seed Script ➕
**File:** `apps/web/package.json`

**Add to scripts section:**
```json
{
  "scripts": {
    "db:seed": "tsx prisma/seed.ts",
    "db:seed:test": "NODE_ENV=test tsx prisma/seed-test.ts"
  }
}
```

**Note:** Check if `prisma/seed-test.ts` exists, create if needed

---

## 📚 PHASE 3: DOCUMENTATION (10 min)

### Task 3.1: Update Architecture Doc - Remove AWS ⚠️
**File:** `architecture/campotech-architecture-complete.md`

**Changes:**
1. Line 4842: Update "Preview deploy (Vercel)" section
2. Lines 4855-4869: Replace "Blue-Green Deployment" with "Vercel Deployment Strategy"
3. Lines 4900-4916: Update "Rollback Mechanisms" (remove Docker references)

**See:** Full replacement text in CODEBASE-CLEANUP-AUDIT.md, Task 2.1

---

### Task 3.2: Create Workflow Documentation ➕
**File:** `.github/workflows/README.md` (NEW)

**Content:** See CODEBASE-CLEANUP-AUDIT.md, Task 3.3

**Purpose:** Explain what each workflow does and why AWS workflows were removed

---

### Task 3.3: Verify Vercel Configuration ✅
**File:** `vercel.json`

**Action:** Check if file exists and is correctly configured for monorepo

**Expected structure:** See CODEBASE-CLEANUP-AUDIT.md, Task 2.2

---

## 🧪 PHASE 4: VERIFICATION (10 min)

### Verification Checklist

```bash
# 1. Install dependencies
cd apps/web
pnpm install

# 2. Verify linting works
pnpm lint
# Expected: ✅ Pass

# 3. Verify type checking works
pnpm type-check
# Expected: ✅ Pass

# 4. Verify unit tests work
pnpm test:run
# Expected: ✅ Pass (or show test results)

# 5. Verify E2E tests work
pnpm test:e2e
# Expected: ✅ Playwright runs tests in e2e/ folder

# 6. Check for leftover references
cd ../..
grep -r "apps/api" --exclude-dir=node_modules --exclude-dir=.git
# Expected: No results (or only comments/docs)

# 7. Check for leftover npm locks
find . -name "package-lock.json" -not -path "*/node_modules/*"
# Expected: No results

# 8. Verify only 2 workflows remain
ls .github/workflows/
# Expected: ci.yml, e2e.yml (no deploy-*.yml)
```

---

## 📊 PROGRESS TRACKER

### Folders Audited
- [x] `.expo` - ✅ No issues
- [x] `.github` - 🔴 6 critical issues, 12 tasks created
- [ ] `/lib` - Pending
- [ ] `/prisma` - Pending
- [ ] `/public` - Pending
- [ ] `/scripts` - Pending
- [ ] Root config files - Pending
- [ ] `/apps` - Excluded (will audit last)
- [ ] `/docs` - Excluded (will audit last)

### Tasks Completed
- [ ] Task 1.1: Delete AWS workflows
- [ ] Task 1.2: Delete npm lock files
- [ ] Task 2.1: Update CI to pnpm
- [ ] Task 2.2: Fix E2E workflow
- [ ] Task 2.3: Add test:e2e script
- [ ] Task 2.4: Add db:seed:test script
- [ ] Task 3.1: Update architecture doc
- [ ] Task 3.2: Create workflow README
- [ ] Task 3.3: Verify vercel.json
- [ ] Phase 4: Run all verification steps

---

## 🎯 NEXT STEPS

**Option A: Execute Cleanup Now**
1. Review tasks above
2. Execute Phase 1-4 in order
3. Run verification checklist
4. Continue to next folder audit

**Option B: Continue Auditing**
1. Save cleanup tasks for later
2. Audit next folder (e.g., `/lib`, `/prisma`)
3. Accumulate all cleanup tasks
4. Execute all cleanups at once

---

## 📝 NOTES

### Why These Tasks Matter

**Critical Issues Fixed:**
- ❌ Removes 505 lines of broken AWS deployment code
- ❌ Eliminates package manager conflicts (npm vs pnpm)
- ❌ Fixes E2E tests that never run
- ❌ Removes references to non-existent `apps/api`

**Benefits After Cleanup:**
- ✅ CI/CD workflows actually work
- ✅ Consistent tooling across project
- ✅ Architecture docs match reality
- ✅ New developers won't be confused
- ✅ ~600 lines of dead code removed

---

## 🔗 RELATED FILES

- **Full Audit Report:** `docs/audits/CODEBASE-CLEANUP-AUDIT.md`
- **Architecture Source of Truth:** `architecture/campotech-architecture-complete.md`
- **Implementation Plan:** `architecture/implementation-plan.md`

---

**Ready to Execute?** Start with Phase 1 (deletions) - safest and quickest wins!
