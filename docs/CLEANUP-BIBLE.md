# 🧹 CampoTech Codebase Cleanup Bible

> **The definitive guide for cleaning up after "vibe coding" sessions.**
> 
> Use this document after completing implementation work to ensure code quality, consistency, and maintainability.

---

## Table of Contents

1. [Philosophy](#1-philosophy)
2. [Cleanup Phases Overview](#2-cleanup-phases-overview)
3. [Phase 1: Critical Fixes](#3-phase-1-critical-fixes)
4. [Phase 2: Type Safety](#4-phase-2-type-safety)
5. [Phase 3: Code Quality](#5-phase-3-code-quality)
6. [Phase 4: Dead Code Removal](#6-phase-4-dead-code-removal)
7. [Phase 5: Documentation Sync](#7-phase-5-documentation-sync)
8. [Phase 6: Test Coverage](#8-phase-6-test-coverage)
9. [Phase 7: Performance & Security](#9-phase-7-performance--security)
10. [Quick Reference Commands](#10-quick-reference-commands)
11. [Definition of "Clean"](#11-definition-of-clean)

---

## 1. Philosophy

### Why Cleanup Matters

"Vibe coding" is powerful for rapid prototyping and getting features working quickly. But it leaves behind:
- `any` types scattered everywhere
- Unused imports and variables
- Inconsistent patterns
- Missing error handling
- TODO comments that never get done
- Copy-pasted code that should be abstracted

**Cleanup is not optional** - it's the second half of development.

### When to Clean Up

| Trigger | Cleanup Level |
|---------|--------------|
| After completing a feature | Quick cleanup (30 min) |
| After completing an implementation phase | Full cleanup (2-4 hours) |
| Before major release | Deep cleanup (1-2 days) |
| Quarterly | Comprehensive audit |

### The 80/20 Rule

Focus on fixes that give the most value:
1. **Build-breaking errors** - Must fix
2. **Type errors** - Must fix (prevents runtime bugs)
3. **Security issues** - Must fix
4. **Unused code** - Should remove (reduces confusion)
5. **Style issues** - Nice to fix (consistency)

---

## 2. Cleanup Phases Overview

Execute in order. Each phase builds on the previous.

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Critical Fixes (Build & Runtime)                   │
│ ✓ Build errors    ✓ Runtime crashes    ✓ Blocking issues    │
├─────────────────────────────────────────────────────────────┤
│ PHASE 2: Type Safety                                        │
│ ✓ TypeScript errors    ✓ Remove `any`    ✓ Proper types     │
├─────────────────────────────────────────────────────────────┤
│ PHASE 3: Code Quality                                       │
│ ✓ ESLint errors    ✓ Unused vars    ✓ Formatting            │
├─────────────────────────────────────────────────────────────┤
│ PHASE 4: Dead Code Removal                                  │
│ ✓ Unused files    ✓ Dead imports    ✓ Commented code        │
├─────────────────────────────────────────────────────────────┤
│ PHASE 5: Documentation Sync                                 │
│ ✓ Update architecture docs    ✓ API docs    ✓ Comments      │
├─────────────────────────────────────────────────────────────┤
│ PHASE 6: Test Coverage                                      │
│ ✓ Fix failing tests    ✓ Add missing tests    ✓ E2E tests   │
├─────────────────────────────────────────────────────────────┤
│ PHASE 7: Performance & Security                             │
│ ✓ N+1 queries    ✓ Security audit    ✓ Bundle size          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 1: Critical Fixes

> **Goal:** Code compiles and runs without crashing

### 3.1 Check Build Status

```powershell
cd apps/web
pnpm build 2>&1 | Tee-Object -FilePath build-output.txt
```

### 3.2 Common Build Errors

| Error | Solution |
|-------|----------|
| Module not found | Check import path, install missing package |
| Cannot find type | Run `pnpm prisma generate`, check exports |
| Unexpected token | Check for syntax errors, missing brackets |
| Server component using client hook | Add `'use client'` directive |

### 3.3 Build Error Triage

```powershell
# Count errors by type
(Select-String -Pattern "error TS" build-output.txt).Count          # TypeScript errors
(Select-String -Pattern "Module not found" build-output.txt).Count  # Import errors
(Select-String -Pattern "Cannot find" build-output.txt).Count       # Missing references
```

### 3.4 Checklist

- [ ] `pnpm build` completes without errors
- [ ] `pnpm dev` starts without crashing
- [ ] Main pages load without errors
- [ ] API routes respond (test /api/health)

---

## 4. Phase 2: Type Safety

> **Goal:** No TypeScript errors, minimal `any` types

### 4.1 Run Type Check

```powershell
cd apps/web
pnpm type-check 2>&1 | Tee-Object -FilePath type-errors.txt
```

### 4.2 Count Errors by Category

```powershell
# Get error summary
Select-String -Pattern "error TS\d+" type-errors.txt | ForEach-Object { $_.Matches.Value } | Group-Object | Sort-Object Count -Descending
```

### 4.3 Common Type Errors

| Error Code | Meaning | Fix |
|------------|---------|-----|
| TS2339 | Property doesn't exist | Add to interface, check spelling |
| TS2345 | Argument type mismatch | Cast properly or fix function signature |
| TS2322 | Type not assignable | Match types or use type guard |
| TS7006 | Implicit any | Add explicit type annotation |
| TS2304 | Cannot find name | Import the type/value |
| TS18046 | Variable is of type 'unknown' | Add type guard or assertion |

### 4.4 Eliminating `any`

```powershell
# Find all explicit any usage
pnpm eslint . --rule '@typescript-eslint/no-explicit-any: error' 2>&1 | Tee-Object -FilePath any-errors.txt
```

**Replace `any` with proper types:**

```typescript
// ❌ Bad
function process(data: any) { ... }

// ✅ Good - Use unknown + type guard
function process(data: unknown) {
  if (isValidData(data)) { ... }
}

// ✅ Good - Use generics
function process<T extends BaseType>(data: T) { ... }

// ✅ Good - Use specific interface
function process(data: CustomerInput) { ... }
```

### 4.5 Checklist

- [ ] `pnpm type-check` passes with 0 errors
- [ ] No `any` types in new code
- [ ] Prisma types properly imported
- [ ] API request/response types defined

---

## 5. Phase 3: Code Quality

> **Goal:** ESLint passes, code is consistent

### 5.1 Run Linter

```powershell
cd apps/web
pnpm lint 2>&1 | Tee-Object -FilePath lint-output.txt
```

### 5.2 Analyze Lint Errors

```powershell
# Count by rule
Select-String -Pattern "error" lint-output.txt | ForEach-Object { ($_ -split "\s+")[-1] } | Group-Object | Sort-Object Count -Descending | Select-Object -First 20
```

### 5.3 Priority Order

Fix in this order:

1. **Security-related**
   - `no-eval`
   - `no-implied-eval`
   - `react-hooks/exhaustive-deps` (can cause stale data)

2. **Correctness**
   - `no-unused-vars` (dead code indicator)
   - `no-unreachable` (logic errors)
   - `no-constant-condition` (likely bugs)

3. **Type Safety**
   - `@typescript-eslint/no-explicit-any`
   - `@typescript-eslint/no-non-null-assertion`

4. **Code Quality**
   - `prefer-const`
   - `no-var`
   - `@typescript-eslint/no-unused-expressions`

### 5.4 Bulk Fixes

```powershell
# Auto-fix what ESLint can fix
pnpm eslint . --fix

# Auto-fix specific rules
pnpm eslint . --fix --rule 'prefer-const: error'
```

### 5.5 Handling Unused Variables

```typescript
// Option 1: Remove if truly unused
// import { unused } from 'module';  // DELETE

// Option 2: Prefix with underscore if intentionally unused
function handler(_request: Request) { ... }

// Option 3: Use in code (if it should be used)
```

### 5.6 Checklist

- [ ] `pnpm lint` passes (0 errors)
- [ ] Warnings reviewed and addressed
- [ ] No disabled lint rules without comment
- [ ] Consistent code style across files

---

## 6. Phase 4: Dead Code Removal

> **Goal:** No unused files, imports, or functions

### 6.1 Find Unused Exports

```powershell
# Install if needed
pnpm add -D ts-prune

# Find unused exports
pnpm ts-prune
```

### 6.2 Find Unused Files

```powershell
# Files with no imports (potential dead code)
pnpm madge --orphans apps/web/
```

### 6.3 Common Dead Code Patterns

| Pattern | Action |
|---------|--------|
| Commented-out code blocks | Delete (git has history) |
| Old API route versions | Delete if deprecated |
| Unused component variants | Delete or document why kept |
| TODO/FIXME older than 30 days | Fix or create issue |
| Console.log statements | Remove (use proper logging) |

### 6.4 Find TODOs and FIXMEs

```powershell
# Find all TODO comments
Select-String -Path "apps/web/app/**/*.ts","apps/web/app/**/*.tsx","apps/web/lib/**/*.ts","apps/web/components/**/*.tsx" -Pattern "TODO|FIXME|HACK|XXX" -Recurse
```

### 6.5 Safe Deletion Process

Before deleting any file:

```powershell
# 1. Search for imports
Select-String -Path "apps/web/**/*.ts","apps/web/**/*.tsx" -Pattern "from.*filename" -Recurse

# 2. Search for dynamic imports
Select-String -Path "apps/web/**/*.ts","apps/web/**/*.tsx" -Pattern "import.*filename|require.*filename" -Recurse

# 3. Check git blame for context
git log --oneline -10 -- path/to/file.ts
```

### 6.6 Checklist

- [ ] No commented-out code blocks
- [ ] No orphaned files
- [ ] All TODOs addressed or tracked
- [ ] No console.log in production code
- [ ] Unused dependencies removed from package.json

---

## 7. Phase 5: Documentation Sync

> **Goal:** Docs match reality

### 7.1 Architecture Doc Review

Open `architecture/campotech-architecture-complete.md` and verify:

```
For each section, check:
[ ] Endpoints listed match actual API routes
[ ] Database schema matches Prisma schema
[ ] State machines match implementation
[ ] Feature status (✅/⏳/🔧) is accurate
```

### 7.2 Key Areas to Sync

| Doc Section | Verify Against |
|-------------|----------------|
| API Endpoints | `apps/web/app/api/` routes |
| Database Schema | `apps/web/prisma/schema.prisma` |
| Environment Variables | `.env.example` |
| Feature Status | Actual implementation |

### 7.3 Update Status Markers

```markdown
✅ Fully implemented and working
⏳ Planned / Not yet implemented  
🔧 Implementation differs from spec
⚠️ Partially implemented
```

### 7.4 Checklist

- [ ] Architecture doc reviewed
- [ ] API endpoint list accurate
- [ ] Database schema section updated
- [ ] New features documented
- [ ] Removed features marked/deleted

---

## 8. Phase 6: Test Coverage

> **Goal:** Tests pass, critical paths covered

### 8.1 Run Tests

```powershell
cd apps/web
pnpm test:run 2>&1 | Tee-Object -FilePath test-output.txt
```

### 8.2 Fix Failing Tests

Priority order:
1. Tests that fail due to code changes (update test)
2. Tests that fail due to bugs (fix the bug)
3. Flaky tests (fix or mark as flaky)

### 8.3 Coverage Analysis

```powershell
pnpm test:run --coverage
```

Minimum coverage targets:
- **Critical paths:** 80%+ (auth, payments, AFIP)
- **Business logic:** 60%+ (services, utils)
- **UI components:** 40%+ (key components)

### 8.4 What to Test

| Priority | What | Why |
|----------|------|-----|
| Critical | Authentication flows | Security |
| Critical | Payment processing | Money |
| Critical | AFIP/CAE requests | Legal compliance |
| High | CUIT validation | Data integrity |
| High | Job state transitions | Business logic |
| Medium | API input validation | Data quality |
| Medium | Error handling | User experience |

### 8.5 Checklist

- [ ] All tests pass
- [ ] No skipped tests without reason
- [ ] Critical paths have tests
- [ ] New features have basic tests

---

## 9. Phase 7: Performance & Security

> **Goal:** No obvious performance/security issues

### 9.1 Security Checklist

```powershell
# Check for vulnerabilities in dependencies
pnpm audit

# Check for exposed secrets
Select-String -Path "apps/web/**/*.ts","apps/web/**/*.tsx" -Pattern "sk_live|pk_live|password\s*=" -Recurse
```

Security items to verify:
- [ ] No hardcoded credentials
- [ ] No API keys in client code
- [ ] Proper auth checks on all routes
- [ ] Input validation on all endpoints
- [ ] Rate limiting on sensitive routes

### 9.2 Performance Checklist

```powershell
# Bundle size analysis
cd apps/web
pnpm build
# Check .next/analyze if configured
```

Performance items to verify:
- [ ] No N+1 database queries
- [ ] Proper pagination on list endpoints
- [ ] Images optimized (next/image)
- [ ] No blocking API calls in render

### 9.3 Common N+1 Patterns

```typescript
// ❌ N+1 Query
const customers = await prisma.customer.findMany();
for (const customer of customers) {
  customer.jobs = await prisma.job.findMany({ where: { customerId: customer.id } });
}

// ✅ Single Query with Include
const customers = await prisma.customer.findMany({
  include: { jobs: true }
});
```

### 9.4 Checklist

- [ ] `pnpm audit` shows no high/critical vulnerabilities
- [ ] No exposed secrets in code
- [ ] Database queries are efficient
- [ ] Bundle size reasonable

---

## 10. Quick Reference Commands

### All-in-One Verification

```powershell
cd apps/web

# Quick check (run after every change)
pnpm type-check; if ($?) { pnpm lint }

# Full check (run before committing)
pnpm type-check; if ($?) { pnpm lint }; if ($?) { pnpm build }; if ($?) { pnpm test:run }

# Deep check (run weekly or before release)
pnpm type-check; if ($?) { pnpm lint }; if ($?) { pnpm build }; if ($?) { pnpm test:run }; if ($?) { pnpm audit }
```

### Output to Files (for analysis)

```powershell
cd apps/web

# Create cleanup folder if needed
New-Item -ItemType Directory -Force -Path $HOME/cleanup

# Capture all outputs
pnpm type-check 2>&1 | Tee-Object -FilePath $HOME/cleanup/type-errors.txt
pnpm lint 2>&1 | Tee-Object -FilePath $HOME/cleanup/lint-errors.txt
pnpm build 2>&1 | Tee-Object -FilePath $HOME/cleanup/build-output.txt
pnpm test:run 2>&1 | Tee-Object -FilePath $HOME/cleanup/test-output.txt
```

### Error Counting

```powershell
# Quick error counts
Write-Host "Type errors: $((Select-String -Pattern 'error TS' type-errors.txt).Count)"
Write-Host "Lint errors: $((Select-String -Pattern 'error' lint-errors.txt).Count)"
Write-Host "Test failures: $((Select-String -Pattern 'FAIL' test-output.txt).Count)"
```

---

## 11. Definition of "Clean"

### A file is "clean" when:

- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] No `any` types (or documented exceptions)
- [ ] No unused imports/variables
- [ ] No commented-out code
- [ ] Consistent formatting
- [ ] Clear function/variable names
- [ ] Error handling in place
- [ ] Types for inputs/outputs

### A feature is "clean" when:

- [ ] All files involved are clean
- [ ] Has basic test coverage
- [ ] Documented if complex
- [ ] Error states handled
- [ ] Loading states handled
- [ ] Accessible (a11y basics)

### The codebase is "clean" when:

- [ ] `pnpm build` succeeds
- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` passes (0 errors)
- [ ] `pnpm test:run` passes
- [ ] `pnpm audit` shows no high/critical issues
- [ ] Architecture docs are current
- [ ] No dead code
- [ ] No console.logs

---

## Cleanup Tracking Template

Use this template to track cleanup progress:

```markdown
## Cleanup Session: [Date]

### Scope
- [ ] Files/folders being cleaned: ___

### Phase 1: Critical Fixes
- [ ] Build passes
- [ ] Dev server runs
- Errors fixed: ___

### Phase 2: Type Safety  
- [ ] Type-check passes
- `any` removed: ___
- Errors fixed: ___

### Phase 3: Code Quality
- [ ] Lint passes
- Errors fixed: ___

### Phase 4: Dead Code
- Files deleted: ___
- TODOs addressed: ___

### Phase 5: Docs
- Docs updated: ___

### Phase 6: Tests
- [ ] Tests pass
- Tests added: ___

### Phase 7: Security
- [ ] Audit clean
- Issues found: ___

### Summary
- Time spent: ___
- Errors fixed: ___
- Code deleted: ___ lines
```

---

## Appendix: Vibe Coding Debt Patterns

Common patterns left behind by vibe coding:

| Pattern | Example | Fix |
|---------|---------|-----|
| Lazy `any` | `(data: any)` | Add proper type |
| Copy-paste code | Same logic in 3 files | Extract to shared function |
| Magic numbers | `if (status === 3)` | Use enum/const |
| Hardcoded strings | `"pending"` everywhere | Use type constants |
| Missing error handling | No try-catch | Add proper error handling |
| Callback hell | Nested .then().then() | Use async/await |
| Giant functions | 200+ line functions | Extract smaller functions |
| TODO sprawl | TODOs never addressed | Fix or delete |

---

**Last Updated:** 2026-01-03
**Version:** 1.0
