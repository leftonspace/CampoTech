---
description: Verification commands to run after code changes - ALWAYS verify after modifications
---

# ✅ Verification After Code Changes

**IMPORTANT:** Run these verification commands after ANY code change (creation, modification, or deletion).

## Quick Verification (After Every Change)

// turbo-all
```powershell
# Run from project root
cd apps/web

# 1. Type checking - catches TypeScript errors
pnpm type-check

# 2. Linting - catches code quality issues
pnpm lint
```

## Full Verification (After Significant Changes)

// turbo-all
```powershell
# Run from apps/web
cd apps/web

# 1. Type checking
pnpm type-check

# 2. Linting
pnpm lint

# 3. Build - ensures production build works
pnpm build

# 4. Tests - ensures existing functionality works
pnpm test:run
```

## When to Use Each Level

### Quick Verification (type-check + lint)
Use after:
- Editing a single file
- Fixing a bug
- Refactoring code
- Adding/removing imports

### Full Verification (+ build + test)
Use after:
- Creating new files/components
- Deleting files
- Changing APIs or interfaces
- Modifying shared code
- Database schema changes
- Major refactoring

## Interpreting Results

### TypeScript Errors (`pnpm type-check`)
- **MUST FIX** before proceeding
- Indicates type mismatches or missing types
- Check imports and interface definitions

### ESLint Errors (`pnpm lint`)
- **SHOULD FIX** most errors
- `@typescript-eslint/no-unused-vars` - Remove or prefix with `_`
- `@typescript-eslint/no-explicit-any` - Add proper types
- Some warnings may be acceptable temporarily

### Build Errors (`pnpm build`)
- **MUST FIX** - code won't deploy
- Often related to SSR issues in Next.js
- Check for client-only code in server components

### Test Failures (`pnpm test:run`)
- **INVESTIGATE** - may indicate broken functionality
- Could be outdated tests or actual bugs
- Report to user if unclear

## Reporting Issues

When verification fails, report:
1. Which command failed
2. The specific error message
3. The file(s) involved
4. Your assessment of the cause
5. Proposed fix (if known)

## Commands for Specific Scenarios

### After Prisma Schema Changes
```powershell
cd apps/web
pnpm prisma generate   # Regenerate client
pnpm type-check        # Verify types
```

### After Adding Dependencies
```powershell
pnpm install           # Install deps
pnpm type-check        # Check for type issues
pnpm build             # Verify build works
```

### After Deleting Files
```powershell
pnpm type-check        # Find broken imports
pnpm lint              # Find unused exports
pnpm build             # Verify nothing breaks
```
