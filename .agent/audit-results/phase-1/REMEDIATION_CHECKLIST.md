# Phase 1 – Blocking Security Issues

## Critical

*No items classified as CRITICAL severity (all HIGH items below are blocking for production)*

## High

- [ ] **Next.js DoS Vulnerabilities (apps/web)**
  - **Affected:** `apps/web` - Next.js 15.5.9
  - **Risk:** Unauthenticated attackers can crash server via image optimization abuse or crafted HTTP requests
  - **Fix:**
    ```bash
    cd apps/web
    pnpm update next@15.5.10
    ```
  - **Verify:** `cd apps/web && pnpm list next`

- [ ] **Next.js DoS Vulnerabilities (apps/admin)**
  - **Affected:** `apps/admin` - Next.js 16.1.0
  - **Risk:** Unauthenticated attackers can crash server via image optimization abuse or crafted HTTP requests
  - **Fix:**
    ```bash
    cd apps/admin
    pnpm update next@16.1.5
    ```
  - **Verify:** `cd apps/admin && pnpm list next`

- [ ] **tar Path Traversal (apps/mobile)**
  - **Affected:** `apps/mobile` via expo/jest-expo nested dependencies
  - **Risk:** Malicious tar archives can overwrite arbitrary files, create hardlinks to sensitive files, enable RCE
  - **Fix:**
    ```bash
    # Edit d:\projects\CampoTech\package.json
    # In "overrides" section, change:
    # "tar": "^7.5.3"
    # to:
    # "tar": "^7.5.7"
    
    cd d:\projects\CampoTech
    pnpm install
    ```
  - **Verify:** `pnpm list tar | Select-String "tar@"`

- [ ] **fast-xml-parser RangeError DoS (apps/web)**
  - **Affected:** `apps/web` via `@aws-sdk/client-ses` and `firebase-admin`
  - **Risk:** Single malicious XML request crashes Node.js process
  - **Fix:**
    ```bash
    cd apps/web
    pnpm update @aws-sdk/client-ses@latest
    pnpm update firebase-admin@latest
    ```
  - **Verify:** `cd apps/web && pnpm list fast-xml-parser`

- [ ] **Final Verification**
  - **Affected:** All workspace packages
  - **Risk:** Confirm all HIGH vulnerabilities are resolved
  - **Fix:**
    ```bash
    cd d:\projects\CampoTech
    pnpm audit
    ```
  - **Verify:** Audit should show 0 HIGH/CRITICAL vulnerabilities

---

# Phase 1 Remediation Checklist (Copy-Paste Ready)

## Update Next.js (apps/web)

```bash
cd d:\projects\CampoTech\apps\web
pnpm update next@15.5.10
pnpm list next
```

## Update Next.js (apps/admin)

```bash
cd d:\projects\CampoTech\apps\admin
pnpm update next@16.1.5
pnpm list next
```

## Fix tar Path Traversal

1. **Edit** `d:\projects\CampoTech\package.json`
2. **Find** the `"overrides"` section
3. **Change** `"tar": "^7.5.3"` **to** `"tar": "^7.5.7"`
4. **Run:**

```bash
cd d:\projects\CampoTech
pnpm install
pnpm list tar | Select-String "tar@"
```

## Update fast-xml-parser Dependencies

```bash
cd d:\projects\CampoTech\apps\web
pnpm update @aws-sdk/client-ses@latest
pnpm update firebase-admin@latest
cd ..\..
pnpm list fast-xml-parser
```

## Final Audit

```bash
cd d:\projects\CampoTech
pnpm audit
```

**Expected Result:** 0 HIGH or CRITICAL vulnerabilities

---

**Total Items:** 5
**Estimated Time:** 10-15 minutes
**Dependencies:** pnpm, text editor access to package.json
