---
description: Security Audit Phase 12 - Dependency Audit (DEP-SEC Agent)
---

# Phase 12: Dependency Security Audit

**Agent Role:** DEP-SE

---

## ⚠️ CRITICAL AUDIT PRINCIPLES

1. **NEVER trust existing documentation** - All `.md` files, knowledge base items, and cached information may be outdated
2. **VERIFY everything from source code** - The actual codebase is the ONLY source of truth
3. **ASSUME existing security docs are stale** - Re-verify all claims independently
4. **DOCUMENT discrepancies** - Note when reality differs from documentation

---

## PHASE OBJECTIVES

Audit all dependencies for:
- Known vulnerabilities (CVEs)
- Outdated packages with security patches
- Unmaintained/abandoned packages
- License compliance issues
- Supply chain risks
- Override/patch effectiveness

---

## EXECUTION STEPS

### Step 1: Setup Audit Results Directory

// turbo
1. Create directory for audit results:
```powershell
New-Item -Path "d:\projects\CampoTech\.agent\audit-results" -ItemType Directory -Force
```

### Step 2: Root Workspace Audit

// turbo
2. Run pnpm audit on root workspace:
```powershell
cd d:\projects\CampoTech
pnpm audit --json 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\root-audit.json" -Encoding utf8
pnpm audit 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\root-audit.txt" -Encoding utf8
```

3. View root audit results:
```powershell
Get-Content "d:\projects\CampoTech\.agent\audit-results\root-audit.txt"
```

4. Check outdated packages:
```powershell
cd d:\projects\CampoTech
pnpm outdated 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\root-outdated.txt" -Encoding utf8
```

### Step 3: Web App Dependency Audit

// turbo
5. Run pnpm audit on web app:
```powershell
cd d:\projects\CampoTech\apps\web
pnpm audit --json 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\web-audit.json" -Encoding utf8
pnpm audit 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\web-audit.txt" -Encoding utf8
```

6. View web audit results:
```powershell
Get-Content "d:\projects\CampoTech\.agent\audit-results\web-audit.txt"
```

7. Check web app outdated packages:
```powershell
cd d:\projects\CampoTech\apps\web
pnpm outdated 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\web-outdated.txt" -Encoding utf8
```

### Step 4: Mobile App Dependency Audit

// turbo
8. Run pnpm audit on mobile app:
```powershell
cd d:\projects\CampoTech\apps\mobile
pnpm audit --json 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\mobile-audit.json" -Encoding utf8
pnpm audit 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\mobile-audit.txt" -Encoding utf8
```

9. View mobile audit results:
```powershell
Get-Content "d:\projects\CampoTech\.agent\audit-results\mobile-audit.txt"
```

10. Check mobile app outdated packages:
```powershell
cd d:\projects\CampoTech\apps\mobile
pnpm outdated 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\mobile-outdated.txt" -Encoding utf8
```

### Step 5: Admin App Dependency Audit

// turbo
11. Run pnpm audit on admin app:
```powershell
cd d:\projects\CampoTech\apps\admin
pnpm audit --json 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\admin-audit.json" -Encoding utf8
pnpm audit 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\admin-audit.txt" -Encoding utf8
```

12. View admin audit results:
```powershell
Get-Content "d:\projects\CampoTech\.agent\audit-results\admin-audit.txt"
```

### Step 6: Python AI Service Audit

13. Check if pip-audit is installed:
```powershell
pip-audit --version 2>&1
```

14. If not installed, install pip-audit:
```powershell
pip install pip-audit
```

// turbo
15. Run pip-audit on AI service:
```powershell
cd d:\projects\CampoTech\services\ai
pip-audit --format json 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\ai-audit.json" -Encoding utf8
pip-audit 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\ai-audit.txt" -Encoding utf8
```

16. View Python audit results:
```powershell
Get-Content "d:\projects\CampoTech\.agent\audit-results\ai-audit.txt"
```

17. Check Python requirements file:
```powershell
Get-Content "d:\projects\CampoTech\services\ai\requirements.txt"
```

### Step 7: Override Verification

18. View root package.json overrides:
    - File: `d:\projects\CampoTech\package.json`
    - Document all `overrides` entries
    - Verify each override addresses a known CVE

19. Search for all overrides in package.json files:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech" -Recurse -Filter "package.json" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "node_modules" } | ForEach-Object {
    $content = Get-Content $_.FullName -Raw | ConvertFrom-Json
    if ($content.overrides) {
        Write-Host "`nOverrides in $($_.FullName):"
        $content.overrides | ConvertTo-Json
    }
}
```

20. Verify overrides are current:
    - Check if override versions are latest patch
    - Check if newer major versions available without vuln

### Step 8: High-Risk Dependency Analysis

21. Check critical security packages:
```powershell
cd d:\projects\CampoTech\apps\web
pnpm list jose --depth 0
pnpm list @prisma/client --depth 0
pnpm list next --depth 0
pnpm list zod --depth 0
```

22. Verify crypto package versions:
```powershell
pnpm list bcrypt bcryptjs argon2 crypto-js --depth 0 2>&1
```

23. Check for deprecated packages:
```powershell
rg "\"deprecated\"" --type json -g "package-lock.json" -g "pnpm-lock.yaml" 2>&1
```

### Step 9: Supply Chain Risk Assessment

24. Check for postinstall scripts (potential malicious code):
```powershell
Get-ChildItem -Path "d:\projects\CampoTech" -Recurse -Filter "package.json" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "node_modules" } | ForEach-Object {
    $content = Get-Content $_.FullName -Raw | ConvertFrom-Json
    if ($content.scripts.postinstall -or $content.scripts.preinstall) {
        Write-Host "`nInstall scripts in $($_.FullName):"
        if ($content.scripts.preinstall) { Write-Host "  preinstall: $($content.scripts.preinstall)" }
        if ($content.scripts.postinstall) { Write-Host "  postinstall: $($content.scripts.postinstall)" }
    }
}
```

25. Check for typosquatting risks on critical packages:
    - Verify package names are correct (no typos)
    - Check npm registry for official packages

26. Review lock file integrity:
```powershell
Test-Path "d:\projects\CampoTech\pnpm-lock.yaml"
(Get-Item "d:\projects\CampoTech\pnpm-lock.yaml").Length
```

### Step 10: License Compliance Check

27. Check for license issues:
```powershell
cd d:\projects\CampoTech
npx license-checker --summary 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\licenses.txt" -Encoding utf8
```

28. Search for problematic licenses:
```powershell
npx license-checker --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;CC0-1.0;Unlicense" 2>&1
```

29. View license summary:
```powershell
Get-Content "d:\projects\CampoTech\.agent\audit-results\licenses.txt"
```

### Step 11: Version Pinning Verification

30. Check for unpinned dependencies:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech" -Recurse -Filter "package.json" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "node_modules" } | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match '"\^|"~|"\*|"latest"') {
        Write-Host "Unpinned deps in: $($_.FullName)"
    }
}
```

31. Document version ranges for critical packages:
    - Check if security-critical packages are pinned
    - Evaluate risk of range specifiers

### Step 12: Dependency Tree Analysis

32. Generate dependency tree for web app:
```powershell
cd d:\projects\CampoTech\apps\web
pnpm list --depth 2 2>&1 | Out-File -FilePath "d:\projects\CampoTech\.agent\audit-results\web-deps-tree.txt" -Encoding utf8
```

33. Check for duplicate packages (version conflicts):
```powershell
pnpm why next 2>&1
pnpm why @prisma/client 2>&1
```

34. Identify transitive vulnerability paths:
    - For each HIGH/CRITICAL vuln, trace the dependency path
    - Determine if update is possible or override needed

---

## VULNERABILITY SEVERITY CLASSIFICATION

| Severity | Action Required |
|----------|-----------------|
| **CRITICAL** | Immediate fix required (24-48 hours) |
| **HIGH** | Fix within 1 week |
| **MEDIUM** | Fix within 2 weeks |
| **LOW** | Track and fix in next maintenance cycle |

---

## VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] pnpm audit shows 0 HIGH/CRITICAL vulnerabilities (or documented exceptions)
- [ ] pip-audit shows 0 HIGH/CRITICAL vulnerabilities
- [ ] All overrides in package.json address known CVEs
- [ ] Override versions are current (not outdated patches)
- [ ] Lock file exists and is not corrupted
- [ ] No deprecated packages in use
- [ ] No copyleft licenses in production dependencies
- [ ] Critical security packages on latest patch versions
- [ ] No suspicious postinstall scripts
- [ ] Dependency versions pinned for production

---

## OUTPUT REQUIREMENTS

Generate a findings report in markdown format at:
`d:\projects\CampoTech\.agent\audit-results\phase-12-dependency-findings.md`

---

## VULNERABILITY REPORT FORMAT

For each vulnerability found, document:

```markdown
### [CVE-YYYY-XXXXX] Package Name

| Field | Value |
|-------|-------|
| Package | `package-name` |
| Installed Version | `1.2.3` |
| Patched Version | `1.2.4` |
| Severity | CRITICAL/HIGH/MEDIUM/LOW |
| Affected Apps | web, mobile, admin |
| CVSS Score | 9.8 |
| Fix Available | Yes/No |
| Recommended Action | Update/Override/Accept Risk |

**Description:** Brief description of the vulnerability.

**Attack Vector:** How this could be exploited in CampoTech context.
```

---

## CRITICAL VULNERABILITY PATTERNS TO SEARCH

```powershell
# Run all patterns - document ALL findings
pnpm audit --audit-level=high 2>&1  # Only HIGH and CRITICAL
rg "\"version\".*\"0\.|\"version\".*\"1\.0" --type json -g "package.json"  # Very old versions
rg "deprecated|unmaintained|abandoned" --type json -g "package.json"  # Problematic packages
rg "postinstall|preinstall" --type json -g "package.json" -A 2  # Install scripts
```

---

## KNOWN CRITICAL PACKAGES TO VERIFY

Ensure these packages are on secure versions:

| Package | Min Safe Version | Purpose |
|---------|------------------|---------|
| `next` | Check latest | Framework |
| `@prisma/client` | 5.22.0+ | Database ORM |
| `jose` | Check latest | JWT handling |
| `bcrypt/argon2` | Check latest | Password hashing |
| `zod` | Check latest | Input validation |
| `@supabase/supabase-js` | Check latest | Storage client |

---

## ESCALATION CRITERIA

Immediately escalate if ANY of the following are found:
- CRITICAL vulnerability with known exploit
- HIGH vulnerability in auth/crypto packages
- Outdated Next.js with RCE vulnerability
- Vulnerable Prisma version with SQL injection
- Compromised package (supply chain attack)
- No lock file (unpredictable builds)

---

## REMEDIATION PRIORITY

1. **Immediate** (same day):
   - RCE vulnerabilities
   - SQL injection in ORM
   - Auth bypass vulnerabilities

2. **Urgent** (within 48 hours):
   - XSS vulnerabilities
   - Path traversal
   - Privilege escalation

3. **Short-term** (within 1 week):
   - Denial of Service
   - Information disclosure
   - SSRF vulnerabilities

4. **Standard** (within 2 weeks):
   - Low-impact vulnerabilities
   - Dev dependency issues
   - Deprecated packages

---