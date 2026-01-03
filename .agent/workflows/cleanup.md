---
description: Codebase cleanup workflow - systematic cleanup after vibe coding sessions
---

# 🧹 Codebase Cleanup Workflow

> **Full Guide:** See `docs/CLEANUP-BIBLE.md` for comprehensive cleanup instructions. Any clean up progress documentation should be placed inside `docs/cleanup/`.

## Quick Cleanup (After Every Feature)

// turbo-all
```bash
cd apps/web

# 1. Type check
pnpm type-check

# 2. Lint check  
pnpm lint

# 3. Build check
pnpm build
```

**Time:** ~30 minutes

## Full Cleanup (After Implementation Phase)

### Phase 1: Critical Fixes
```bash
pnpm build 2>&1 | tee build-output.txt
```
- Fix all build errors before proceeding

### Phase 2: Type Safety
```bash
pnpm type-check 2>&1 | tee type-errors.txt
```
- Eliminate TypeScript errors
- Replace `any` with proper types

### Phase 3: Code Quality
```bash
pnpm lint 2>&1 | tee lint-output.txt
pnpm eslint . --fix  # Auto-fix what's possible
```
- Fix remaining lint errors manually

### Phase 4: Dead Code
```bash
# Find TODOs
grep -rn "TODO\|FIXME" apps/web/app apps/web/lib

# Find unused exports (if ts-prune installed)
pnpm ts-prune
```
- Remove commented code
- Address or track TODOs
- Delete unused files

### Phase 5: Documentation
- Update `architecture/campotech-architecture-complete.md`
- Verify API endpoints match
- Update feature status markers

### Phase 6: Tests
```bash
pnpm test:run 2>&1 | tee test-output.txt
```
- Fix failing tests
- Add tests for new features

### Phase 7: Security
```bash
pnpm audit
```
- Address vulnerabilities
- Check for exposed secrets

**Time:** 2-4 hours

## Cleanup Success Criteria

All must pass:
```bash
pnpm type-check  # ✓ 0 errors
pnpm lint        # ✓ 0 errors  
pnpm build       # ✓ Success
pnpm test:run    # ✓ All pass
pnpm audit       # ✓ No high/critical
```

## Error Priority

1. **MUST FIX:** Build errors, type errors, security issues
2. **SHOULD FIX:** Lint errors, unused vars, missing tests
3. **NICE TO FIX:** Style issues, minor warnings

## For AI Agents

When assisting with cleanup:

1. **Run diagnostics first** - Get current error counts
2. **Fix by category** - All type errors, then all lint errors
3. **Verify after each batch** - Ensure fixes don't break things
4. **Report progress** - "Fixed X/Y errors in category Z"
5. **Flag decisions needed** - Don't assume, ask when unclear

## Cleanup Tracking

Create a tracking issue or document for each cleanup session:

```markdown
## Cleanup: [Date]

### Before
- Type errors: ___
- Lint errors: ___
- Test failures: ___

### After
- Type errors: ___
- Lint errors: ___
- Test failures: ___

### Files modified: ___
### Time spent: ___
```