---
description: Codebase cleanup workflow - systematic dead code detection, bloat analysis, and cleanup for CampoTech monorepo
---

# 🧹 Codebase Cleanup Workflow

> **Full Guide:** See `docs/CLEANUP-BIBLE.md` for comprehensive cleanup instructions.
> **Cleanup Reports:** Place all cleanup progress documentation inside '.agent/cleanup-results/'

## For AI Agents

When assisting with cleanup:

1. **Run Phase 0-1 first** — Establish baseline metrics
2. **Run Phases 2-8 in order** — Produce the audit report with all findings
3. **Present findings to user BEFORE deleting anything** — Dead code detection has false positives
4. **Never auto-delete API routes or shared modules** — Always verify external consumers
5. **Verify after each batch of deletions** — Run `pnpm type-check && pnpm build` after every batch
6. **Report progress** — "Found X dead routes, Y orphaned components, Z unused modules"
7. **Flag decisions needed** — Don't assume, ask when unclear
8. **Track webhook/cron routes separately** — These won't have frontend references but ARE used
9. **Check mobile app imports** — A "dead" web route might be called by `apps/mobile/`
10. **Preserve audit trail** — Save the report even if no action is taken yet

---

### Phase 2: Dead API Route Detection

**Goal:** Find API routes (`apps/web/app/api/**/route.ts`) that are never called by any frontend code.

```powershell
# 1. List all API route paths
$apiRoutes = git ls-files | Where-Object { $_ -match 'apps/web/app/api/.*/route\.ts$' }
Write-Output "Total API routes: $(($apiRoutes | Measure-Object).Count)"
Write-Output ""

# 2. For each route, extract the URL path and search for it in frontend/mobile code
foreach ($route in $apiRoutes) {
    # Convert file path to API URL path: apps/web/app/api/jobs/[id]/status/route.ts -> /api/jobs
    $urlPath = ($route -replace 'apps/web/app', '' -replace '/route\.ts$', '' -replace '\[.*?\]', '')
    # Get a searchable slug (last meaningful segment)
    $segments = ($urlPath -split '/' | Where-Object { $_ -ne '' -and $_ -ne 'api' })
    $searchTerm = "/api/" + (($urlPath -split '/' | Where-Object { $_ -ne '' }) -join '/' -replace '//+', '/')

    # Search for references in frontend code (exclude the route file itself and other API routes)
    $refs = git grep -l $searchTerm -- '*.ts' '*.tsx' ':!apps/web/app/api/' 2>$null
    if (-not $refs) {
        Write-Output "POTENTIALLY DEAD: $route"
        Write-Output "  Expected URL: $searchTerm"
    }
}
```

**Agent actions:**
- For each "POTENTIALLY DEAD" route, the agent MUST manually verify:
  1. Is it called via a variable/dynamic string construction? (Search for key segments)
  2. Is it a webhook endpoint called by external services (Stripe, MercadoPago, WhatsApp)?
  3. Is it a cron job endpoint?
  4. Is it called by the mobile app or admin app?
- Classify each as: `DEAD` (safe to delete), `EXTERNAL` (webhook/cron), or `UNCLEAR` (needs human decision)
- **Do NOT auto-delete any API route** — present findings for human review

---

### Phase 3: Orphaned Components & Libraries

**Goal:** Find `.ts`/`.tsx` files in `components/`, `lib/`, and `hooks/` that are never imported anywhere.

```powershell
# Find all component/lib/hook files
$targetFiles = git ls-files | Where-Object {
    ($_ -match 'apps/web/(components|lib|hooks)/.*\.(ts|tsx)$') -and
    ($_ -notmatch 'index\.(ts|tsx)$')  # Skip barrel exports
}
Write-Output "Scanning $(($targetFiles | Measure-Object).Count) component/lib/hook files..."

foreach ($file in $targetFiles) {
    # Extract the importable name (filename without extension)
    $fileName = [System.IO.Path]::GetFileNameWithoutExtension($file)
    $dirName = [System.IO.Path]::GetDirectoryName($file) -replace '\\', '/'

    # Search for imports of this file across the codebase
    $refs = git grep -l "$fileName" -- '*.ts' '*.tsx' ':!'"$file" 2>$null
    if (-not $refs) {
        $loc = (Get-Content $file -EA SilentlyContinue).Count
        Write-Output "ORPHAN ($loc LOC): $file"
    }
}
```

**Agent actions:**
- Sort orphans by LOC (largest first = most impactful to remove)
- Check if the file is re-exported through a barrel `index.ts`
- Check if it's dynamically imported via `next/dynamic` or `lazy()`
- Mark each as: `DEAD`, `BARREL-EXPORTED`, or `DYNAMIC-IMPORT`

---

### Phase 4: Unused Shared Modules (`src/`)

**Goal:** Find shared modules in `src/` that are no longer imported by ANY app.

```powershell
# List all source files in src/
$srcFiles = git ls-files | Where-Object { $_ -match '^src/.*\.(ts|tsx)$' }
Write-Output "Scanning $(($srcFiles | Measure-Object).Count) shared module files..."

foreach ($file in $srcFiles) {
    $fileName = [System.IO.Path]::GetFileNameWithoutExtension($file)

    # Search for references in apps/ only (not within src/ itself)
    $refs = git grep -l "$fileName" -- 'apps/' 2>$null
    if (-not $refs) {
        $loc = (Get-Content $file -EA SilentlyContinue).Count
        Write-Output "UNUSED BY APPS ($loc LOC): $file"
    }
}
```

**Agent actions:**
- If a `src/` module is only used internally by other `src/` files but never by any app, flag the entire dependency chain
- Check if it's used by `services/ai/` (Python service might call it indirectly via API)
- Recommend consolidation: if only one app uses a "shared" module, move it into that app

---

### Phase 5: Giant File Detection

**Goal:** Identify files that are too large and should be split.

```powershell
# Find all code files > 300 lines
git ls-files | Where-Object { $_ -match '\.(ts|tsx)$' } | ForEach-Object {
    $loc = (Get-Content $_ -EA SilentlyContinue).Count
    if ($loc -gt 300) { Write-Output "$loc`t$_" }
} | Sort-Object { [int]($_ -split "`t")[0] } -Descending | Select-Object -First 30
```

**Thresholds:**
| LOC | Classification | Action |
|-----|---------------|--------|
| < 300 | ✅ Normal | No action |
| 300–500 | ⚠️ Large | Review for splitting opportunities |
| 500–1000 | 🔶 Very large | Should be split unless it's a schema or config |
| > 1000 | 🔴 Oversized | Must be split (except generated files like Prisma) |

**Agent actions:**
- Ignore `schema.prisma` and generated files
- For each giant file, suggest specific split points (by function grouping)
- Report total LOC that could be redistributed

---

### Phase 6: Stale Code Indicators

**Goal:** Find code smells that indicate abandoned or incomplete work.

```powershell
# TODO/FIXME/HACK/XXX comments
git grep -n "TODO\|FIXME\|HACK\|XXX" -- '*.ts' '*.tsx' '*.py' | Measure-Object -Line
git grep -n "TODO\|FIXME\|HACK\|XXX" -- '*.ts' '*.tsx' '*.py'

# Commented-out code blocks (3+ consecutive comment lines)
# Agent should scan for patterns like:
#   // const oldFunction = ...
#   // if (legacyMode) { ... }

# Console.log statements in production code (not tests/scripts)
git grep -n "console\.log" -- 'apps/web/app/' 'apps/web/lib/' 'apps/web/components/' 'src/' | Measure-Object -Line

# Disabled ESLint rules
git grep -n "eslint-disable" -- '*.ts' '*.tsx' | Measure-Object -Line
```

**Agent actions:**
- Age-check TODOs using `git blame` on each line — flag any older than 30 days
- Count console.logs and report total (they should use the logging service instead)
- Report eslint-disable count — each one is a potential code smell

---

### Phase 7: Duplicate & Near-Duplicate Detection

**Goal:** Find copy-pasted logic that should be abstracted.

**Agent actions (manual analysis):**
1. Look for files with very similar names across different directories:
   ```powershell
   git ls-files | Where-Object { $_ -match '\.(ts|tsx)$' } |
       ForEach-Object { [System.IO.Path]::GetFileNameWithoutExtension($_) } |
       Group-Object | Where-Object { $_.Count -gt 1 } |
       Sort-Object Count -Descending | Select-Object -First 20 |
       ForEach-Object { "$($_.Count)x  $($_.Name)" }
   ```
2. Check API routes that share the same resource name but exist in different paths (e.g., `/api/v1/jobs` vs `/api/jobs`)
3. Look for utility functions defined in multiple places (e.g., `formatCurrency`, `validateCUIT`)
4. Compare files with similar names for copy-paste patterns

---

### Phase 8: Dependency Health

**Goal:** Find unused npm dependencies and security vulnerabilities.

```powershell
# Security audit
pnpm audit

# Check for unused dependencies (agent should cross-reference)
# For each dependency in package.json, search for imports:
$pkg = Get-Content "apps/web/package.json" | ConvertFrom-Json
$deps = @()
$deps += $pkg.dependencies.PSObject.Properties.Name
$deps += $pkg.devDependencies.PSObject.Properties.Name

foreach ($dep in $deps) {
    $refs = git grep -l """$dep""" -- 'apps/web/' ':!apps/web/package.json' ':!apps/web/node_modules/' 2>$null
    if (-not $refs) {
        Write-Output "POTENTIALLY UNUSED DEP: $dep"
    }
}
```

**Agent actions:**
- For each unused dep, check if it's a build tool, CLI, or plugin (may not be directly imported)
- Check if it's a peer dependency required by another package
- Recommend removal only for truly unused dependencies

---

## Phase 9: Critical Fixes (Build, Types, Lint)

> This is the original "Quick Cleanup" expanded. Run AFTER the audit phases.

### 9.1 Build Check
```powershell
cd apps/web
pnpm build 2>&1 | Tee-Object -FilePath docs/cleanup/build-output.txt
```

### 9.2 Type Safety
```powershell
cd apps/web
pnpm type-check 2>&1 | Tee-Object -FilePath docs/cleanup/type-errors.txt
```

### 9.3 Lint
```powershell
cd apps/web
pnpm lint 2>&1 | Tee-Object -FilePath docs/cleanup/lint-errors.txt
```

### 9.4 Tests
```powershell
cd apps/web
pnpm test:run 2>&1 | Tee-Object -FilePath docs/cleanup/test-output.txt
```

---

## Audit Report Template

After completing the Deep Audit, the agent MUST produce a report at `.agent/cleanup-results/audit-YYYY-MM-DD.md`:

```markdown
# 🧹 CampoTech Cleanup Audit — [Date]

## Executive Summary
- **Total git-tracked files:** ___
- **Total code files:** ___
- **Total LOC (TypeScript):** ___
- **Reclaimable disk space:** ___ MB

## Findings

### 🔴 Critical (Should fix now)
| # | Category | File/Area | LOC | Recommendation |
|---|----------|-----------|-----|----------------|
| 1 | Dead API Route | `apps/web/app/api/...` | ___ | Delete |
| ... | | | | |

### 🟡 Warning (Should fix soon)
| # | Category | File/Area | LOC | Recommendation |
|---|----------|-----------|-----|----------------|
| ... | | | | |

### 🟢 Info (Nice to fix)
| # | Category | File/Area | LOC | Recommendation |
|---|----------|-----------|-----|----------------|
| ... | | | | |

## Metrics
| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Git-tracked files | ___ | ___ | ___ |
| Code files | ___ | ___ | ___ |
| Total LOC | ___ | ___ | ___ |
| Dead API routes | ___ | ___ | ___ |
| Orphaned files | ___ | ___ | ___ |
| TODO/FIXME count | ___ | ___ | ___ |
| console.log count | ___ | ___ | ___ |
| eslint-disable count | ___ | ___ | ___ |
| Giant files (>500 LOC) | ___ | ___ | ___ |
| Build errors | ___ | ___ | ___ |
| Type errors | ___ | ___ | ___ |
| Lint errors | ___ | ___ | ___ |
| Test failures | ___ | ___ | ___ |

## Recommendations (Prioritized)
1. ...
2. ...
3. ...
```

## Error Priority

1. **MUST FIX:** Build errors, type errors, security issues
2. **SHOULD FIX:** Dead code, unused routes, orphaned files
3. **NICE TO FIX:** Style issues, minor warnings, TODOs