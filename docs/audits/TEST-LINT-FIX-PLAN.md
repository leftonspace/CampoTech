# Test & Lint Fixes - Implementation Plan
**Created:** January 2, 2026  
**Goal:** Fix all 85 failing tests and lint errors before starting new implementation  
**Status:** 📋 PLANNING

---

## 📊 CURRENT STATE

### Lint Errors Summary
**Total Issues:** ~100+ warnings + 12 errors

**Error Types:**
1. **@typescript-eslint/no-explicit-any** (10 errors) - Using `any` type
2. **prefer-const** (3 errors) - Variables that should be const
3. **@typescript-eslint/no-empty-object-type** (1 error) - Empty interface
4. **react-hooks/exhaustive-deps** (1 error) - Missing dependency

**Warning Types:**
- **@typescript-eslint/no-unused-vars** (~80 warnings) - Unused variables/imports
- **import/no-anonymous-default-export** (1 warning) - Anonymous default export

### Test Failures Summary
**Total Tests:** 324  
**Passing:** 239 (74%)  
**Failing:** 85 (26%)

**Failed Test Files:**
1. `tests/unit/tier-limits.test.ts` - 16 failures
2. `tests/unit/feature-flags.test.ts` - 16 failures
3. `tests/unit/afip-client.test.ts` - 13 failures
4. `tests/unit/whatsapp/*` - Multiple failures
5. Other test files - Various failures

**Common Failure Patterns:**
- Module resolution errors (`Cannot find module '@/lib/prisma'`)
- Assertion failures (expected vs actual values)
- Mock configuration issues

---

## 🎯 STRATEGY

### Phase 1: Fix Critical Lint Errors (30 min)
Fix the 12 **errors** first (warnings can wait):
1. Replace `any` types with proper types
2. Change `let` to `const` where appropriate
3. Fix empty interface
4. Fix React hook dependencies

### Phase 2: Fix Test Infrastructure (30 min)
Fix module resolution and setup issues:
1. Fix `@/lib/prisma` import errors
2. Configure test path aliases
3. Fix mock setup

### Phase 3: Fix Failing Tests (1-2 hours)
Fix tests by category:
1. Tier limits tests (pricing/config mismatches)
2. Feature flags tests (tier access issues)
3. AFIP client tests (validation logic)
4. WhatsApp tests (module imports)

### Phase 4: Clean Up Lint Warnings (30 min - Optional)
Remove unused variables/imports:
1. Auto-fix with ESLint
2. Manual review of intentional unused vars
3. Add `// eslint-disable-next-line` where needed

---

## 📋 DETAILED TASKS

### PHASE 1: CRITICAL LINT ERRORS

#### Task 1.1: Fix `@typescript-eslint/no-explicit-any` (10 errors)
**Files:**
- `lib/services/acknowledgment-service.ts` (8 errors)
- `lib/websocket/tracking-client.ts` (2 errors)

**Fix:** Replace `any` with proper types

**Example:**
```typescript
// Before:
function processData(data: any) { }

// After:
function processData(data: Record<string, unknown>) { }
// Or better: define proper interface
interface ProcessData {
  id: string;
  value: number;
}
function processData(data: ProcessData) { }
```

#### Task 1.2: Fix `prefer-const` (3 errors)
**Files:**
- `lib/services/account-deletion.ts` (line 317)
- `lib/services/audit-encryption.ts` (line 324)
- `lib/services/scheduling-intelligence.ts` (line 339)

**Fix:** Change `let` to `const`

#### Task 1.3: Fix `@typescript-eslint/no-empty-object-type`
**File:** `lib/queue/processors.ts` (line 224)

**Fix:** Remove empty interface or add members

#### Task 1.4: Fix `react-hooks/exhaustive-deps`
**File:** `lib/websocket/tracking-client.ts` (line 154)

**Fix:** Add missing dependency or use `useCallback` correctly

---

### PHASE 2: FIX TEST INFRASTRUCTURE

#### Task 2.1: Fix Module Resolution
**Issue:** `Cannot find module '@/lib/prisma'`

**Files Affected:**
- `tests/unit/whatsapp/provisioning.test.ts`
- Other test files

**Fix:** Update `vitest.config.ts` or `tsconfig.json` to resolve `@/` alias

**Solution:**
```typescript
// vitest.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

#### Task 2.2: Fix Prisma Mocking
**Issue:** Tests trying to import Prisma client

**Fix:** Create proper mock for `@/lib/prisma`

**Solution:**
```typescript
// tests/setup.ts or individual test files
vi.mock('@/lib/prisma', () => ({
  prisma: {
    // Mock Prisma client methods
  },
}));
```

---

### PHASE 3: FIX FAILING TESTS

#### Task 3.1: Fix Tier Limits Tests (16 failures)
**File:** `tests/unit/tier-limits.test.ts`

**Failures:**
- "should have correct pricing for BASICO tier ($25)" - Expected $25, got different value
- "should have correct pricing for EMPRESARIAL tier ($120)" - Expected $120, got different value
- "BASICO tier should have 1 user max" - Expected 1, got different value
- etc.

**Root Cause:** Tier configuration mismatch between test expectations and actual config

**Fix:** Update test expectations to match actual `TIER_CONFIGS` or update config to match tests

**Investigation Needed:**
1. Check `lib/subscription/tier-config.ts` for actual values
2. Determine if tests or config is correct
3. Update accordingly

#### Task 3.2: Fix Feature Flags Tests (16 failures)
**File:** `tests/unit/feature-flags.test.ts`

**Failures:**
- "should have access to BASICO features" - Access check failing
- "should have access to all features except white_label" - Feature access mismatch
- etc.

**Root Cause:** Feature flag configuration mismatch

**Fix:** Similar to tier limits - verify actual config vs test expectations

#### Task 3.3: Fix AFIP Client Tests (13 failures)
**File:** `tests/unit/afip-client.test.ts`

**Failures:**
- CUIT validation tests
- Prefix validation tests
- etc.

**Root Cause:** Validation logic changes or test setup issues

**Fix:** Review AFIP validation logic and update tests

#### Task 3.4: Fix WhatsApp Tests
**Files:** Multiple files in `tests/unit/whatsapp/`

**Common Issues:**
- Module import errors
- Mock configuration
- API response mocking

**Fix:** 
1. Fix module resolution (Task 2.1)
2. Update mocks for WhatsApp providers
3. Fix test setup

---

### PHASE 4: CLEAN UP WARNINGS (OPTIONAL)

#### Task 4.1: Auto-Fix Unused Variables
**Command:**
```bash
pnpm lint --fix
```

**This will auto-fix:**
- Remove unused imports
- Remove unused variables (where safe)

#### Task 4.2: Manual Review
**For variables that can't be auto-fixed:**
1. Determine if actually unused
2. Remove if truly unused
3. Add `// eslint-disable-next-line` if intentionally unused (e.g., destructuring)

**Example:**
```typescript
// Intentionally unused (destructuring to omit)
const { password, ...userWithoutPassword } = user;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
```

---

## ⏱️ TIME ESTIMATES

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | Fix 12 critical lint errors | 30 minutes |
| Phase 2 | Fix test infrastructure | 30 minutes |
| Phase 3 | Fix 85 failing tests | 1-2 hours |
| Phase 4 | Clean up warnings (optional) | 30 minutes |
| **Total** | | **2.5-3.5 hours** |

---

## 🚀 EXECUTION ORDER

### Recommended Approach:
1. **Start with Phase 1** (lint errors) - Quick wins, prevents new errors
2. **Move to Phase 2** (test infrastructure) - Fixes root cause of many test failures
3. **Tackle Phase 3** (failing tests) - Most time-consuming
4. **Optionally Phase 4** (warnings) - Nice to have, not blocking

### Alternative Approach (Faster):
1. **Phase 2 first** (test infrastructure) - May auto-fix many test failures
2. **Phase 3** (remaining test failures)
3. **Phase 1** (lint errors) - Can be done alongside
4. **Skip Phase 4** for now - Address warnings later

---

## 📝 NOTES

### Important Considerations:
1. **Don't break working code** - Some "unused" variables might be intentional
2. **Verify test expectations** - Tests might be wrong, not the code
3. **Check git history** - Understand why code was written a certain way
4. **Run tests frequently** - After each fix, verify nothing else broke

### Questions to Answer:
1. **Tier pricing** - What are the correct prices? ($25 or different?)
2. **Feature flags** - What's the correct tier access matrix?
3. **AFIP validation** - What's the correct CUIT validation logic?

---

## 🎯 SUCCESS CRITERIA

### Phase 1 Complete:
- ✅ 0 lint errors (only warnings remain)
- ✅ `pnpm lint` exits with code 0 (or only warnings)

### Phase 2 Complete:
- ✅ No module resolution errors in tests
- ✅ Test setup runs without errors

### Phase 3 Complete:
- ✅ All 324 tests passing (100%)
- ✅ `pnpm test:run` exits with code 0

### Phase 4 Complete (Optional):
- ✅ Minimal lint warnings (<10)
- ✅ All warnings are intentional/documented

---

## 🤔 DECISION NEEDED

**Before starting, we need to decide:**

1. **Do you want to fix everything now?** (2.5-3.5 hours)
2. **Or fix critical errors only?** (Phase 1 + 2 = 1 hour)
3. **Or should I start and you review as I go?**

**My recommendation:** Start with Phase 1 + 2 (1 hour), verify tests improve, then decide on Phase 3.

---

**What would you like me to do?**
