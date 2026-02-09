# Phase 1 HIGH Severity Vulnerabilities Analysis

**Generated:** 2026-02-05 12:35:37 EST
**Source:** `pnpm audit --json`

---

## Summary

| Metric | Count |
|--------|-------|
| HIGH severity advisories | 5 |
| HIGH severity findings | 6 |
| MODERATE severity | 3 |
| CRITICAL severity | 0 |

---

## HIGH Severity Vulnerabilities (BLOCKING)

### 1. tar - CVE-2026-23745 (Advisory 1112255)

**Severity:** HIGH  
**Module:** `tar`  
**Vulnerable Versions:** < 7.5.3  
**Patched Version:** >= 7.5.3  
**Description:** Arbitrary file overwrite via hardlink path bypass

**Affected Path:**
```
apps/mobile > jest-expo > jest-environment-jsdom > canvas > @mapbox/node-pre-gyp > tar
```

**Remediation:** Update tar to >= 7.5.3 via pnpm override

---

### 2. tar - CVE-2026-23950 (Advisory 1112329)

**Severity:** HIGH  
**Module:** `tar`  
**Vulnerable Versions:** < 7.5.4  
**Patched Version:** >= 7.5.4  
**Description:** Race condition via Unicode path collisions on macOS APFS

**Affected Path:**
```
apps/mobile > jest-expo > jest-environment-jsdom > canvas > @mapbox/node-pre-gyp > tar
```

**Remediation:** Update tar to >= 7.5.4 via pnpm override

---

### 3. tar - CVE-2026-24842 (Advisory 1112659)

**Severity:** HIGH  
**Module:** `tar`  
**Vulnerable Versions:** < 7.5.7  
**Patched Version:** >= 7.5.7  
**Description:** Hardlink path traversal allowing file creation outside extraction directory

**Affected Paths:**
```
apps/mobile > jest-expo > jest-environment-jsdom > canvas > @mapbox/node-pre-gyp > tar
apps/mobile > expo > @expo/cli > tar
```

**Remediation:** Update tar to >= 7.5.7 via pnpm override

---

### 4. fast-xml-parser - CVE-2026-25128 (Advisory 1112708)

**Severity:** HIGH  
**Module:** `fast-xml-parser`  
**Vulnerable Versions:** < 5.3.4  
**Patched Version:** >= 5.3.4  
**Description:** RangeError DoS when parsing XML with out-of-range numeric entities

**Affected Path:**
```
apps/web > firebase-admin > @google-cloud/storage > fast-xml-parser
```

**Remediation:** Update firebase-admin to latest OR add override for fast-xml-parser

---

### 5. @isaacs/brace-expansion - CVE-2026-25547 (Advisory 1112954)

**Severity:** HIGH  
**Module:** `@isaacs/brace-expansion`  
**Vulnerable Versions:** <= 5.0.0  
**Patched Version:** >= 5.0.1  
**Description:** Uncontrolled Resource Consumption leading to DoS

**Affected Paths:**
```
apps/mobile > jest-expo > @expo/config > glob > minimatch > @isaacs/brace-expansion
apps/mobile > expo > @expo/cli > ...
(Multiple paths through expo ecosystem)
```

**Remediation:** Add override for @isaacs/brace-expansion >= 5.0.1

---

## MODERATE Severity Vulnerabilities (Non-Blocking)

### 1. @babel/runtime - CVE-2025-27789 (Advisory 1104000)
- Path: `apps/mobile > @nozbe/watermelondb > @babel/runtime`
- Patched: >= 7.26.10
- Status: Nested in WatermelonDB, awaiting upstream

### 2. lodash - CVE-2025-13465 (Advisory 1112455)
- Path: `apps/mobile > jest-expo > lodash`
- Patched: >= 4.17.23
- Status: Can be overridden

### 3. next - CVE-2025-59472 (Advisory 1112638)
- Path: `apps/web > next@15.5.10`
- Patched: >= 15.6.0-canary.61
- Status: PPR feature not enabled - ACCEPTABLE RISK

---

## Remediation Strategy

### pnpm Overrides Required

```json
{
  "pnpm": {
    "overrides": {
      "tar": "7.5.7",
      "fast-xml-parser": "5.3.4",
      "@isaacs/brace-expansion": "5.0.1",
      "lodash": "4.17.23"
    }
  }
}
```

**Note:** The override syntax `package@<version` is for specifying which versions to override. Use direct version pinning for pnpm overrides.

---

## Files to Modify

1. **Root package.json** - Add/update pnpm.overrides section
2. **Run pnpm install** - Apply overrides
3. **Verify with pnpm audit** - Confirm 0 HIGH

---

**Document Status:** Analysis Complete  
**Next Step:** Apply overrides and verify
