---
description: Security Audit Phase 11 - Frontend Security (UI-SEC Agent)
---

# Phase 11: Frontend Security Audit

**Agent Role:** UI-SEC
**Priority:** P2 (Medium)
**Estimated Effort:** 2 hours
**Dependencies:** None (Can run in parallel)

---

## ⚠️ CRITICAL AUDIT PRINCIPLES

1. **NEVER trust existing documentation** - All `.md` files, knowledge base items, and cached information may be outdated
2. **VERIFY everything from source code** - The actual codebase is the ONLY source of truth
3. **ASSUME existing security docs are stale** - Re-verify all claims independently
4. **DOCUMENT discrepancies** - Note when reality differs from documentation

---

## PHASE OBJECTIVES

Audit the frontend layer for:
- Cross-Site Scripting (XSS) vulnerabilities
- Content Security Policy (CSP) configuration
- Client-side secret exposure
- Unsafe JavaScript patterns
- DOM manipulation security
- Third-party script risks

---

## EXECUTION STEPS

### Step 1: Discover All Frontend Components

// turbo
1. Count all frontend components:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\components" -Recurse -Filter "*.tsx" | Measure-Object
Get-ChildItem -Path "d:\projects\CampoTech\apps\mobile\components" -Recurse -Filter "*.tsx" | Measure-Object
Get-ChildItem -Path "d:\projects\CampoTech\apps\admin\components" -Recurse -Filter "*.tsx" -ErrorAction SilentlyContinue | Measure-Object
```

2. List all page components:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app" -Recurse -Filter "page.tsx" | Measure-Object
```

### Step 2: XSS Vulnerability Detection (CRITICAL)

// turbo
3. Search for `dangerouslySetInnerHTML` (HIGH RISK):
```powershell
cd d:\projects\CampoTech
rg "dangerouslySetInnerHTML" --type tsx --type ts -g "!node_modules" -A 5 -B 2
```

4. For EACH `dangerouslySetInnerHTML` usage found:
   - Document the file and line number
   - Check: Is the HTML sanitized before rendering?
   - Check: Does user input flow into the HTML?
   - Check: Is a sanitization library used (DOMPurify, sanitize-html)?

5. Search for innerHTML assignments:
```powershell
rg "\.innerHTML\s*=" --type ts --type tsx -g "!node_modules" -A 5
```

6. Search for document.write (CRITICAL):
```powershell
rg "document\.write" --type ts --type tsx -g "!node_modules" -A 3
```

### Step 3: Unsafe JavaScript Patterns

7. Search for eval() usage (CRITICAL):
```powershell
rg "eval\(" --type ts --type tsx -g "!node_modules" -A 5
```

8. Search for new Function() with dynamic input:
```powershell
rg "new Function\(" --type ts --type tsx -g "!node_modules" -A 5
```

9. Search for setTimeout/setInterval with strings:
```powershell
rg "setTimeout\s*\(\s*['\"\`]|setInterval\s*\(\s*['\"\`]" --type ts --type tsx -g "!node_modules" -A 3
```

10. Search for dynamic script creation:
```powershell
rg "createElement\s*\(\s*['\"]script" --type ts --type tsx -g "!node_modules" -A 5
```

### Step 4: Content Security Policy (CSP) Audit

11. View Next.js security configuration:
    - File: `d:\projects\CampoTech\apps\web\next.config.js`
    - Check: CSP headers defined
    - Check: script-src policy
    - Check: style-src policy
    - Check: frame-ancestors policy

12. Search for security headers configuration:
```powershell
rg "Content-Security-Policy|CSP|securityHeaders|X-Frame-Options|X-Content-Type-Options" --type ts --type js -g "!node_modules" -A 5
```

13. View middleware for security headers:
    - File: `d:\projects\CampoTech\apps\web\middleware.ts`
    - Check: Security headers set on responses

14. Check for inline scripts (CSP violation risk):
```powershell
rg "<script>|<script " --type tsx -g "apps/web/*" -A 3
```

### Step 5: Client-Side Secret Exposure (CRITICAL)

// turbo
15. Search for exposed API keys in client code:
```powershell
rg "NEXT_PUBLIC_|process\.env\." --type ts --type tsx -g "apps/web/components/*" -A 2
rg "NEXT_PUBLIC_|process\.env\." --type ts --type tsx -g "apps/web/app/*" -A 2
```

16. Verify NEXT_PUBLIC_ variables are safe to expose:
```powershell
Select-String -Path "d:\projects\CampoTech\apps\web\.env.example" -Pattern "NEXT_PUBLIC_" -AllMatches
```

17. Check for hardcoded secrets in components:
```powershell
rg "api.?key|apiKey|secret|password|token" --type tsx -g "apps/web/components/*" -A 3
```

18. Search for exposed credentials in client bundles:
```powershell
rg "sk_live|pk_live|Bearer " --type ts --type tsx -g "apps/web/*" -g "!node_modules"
```

### Step 6: URL and Link Security

19. Search for javascript: URLs (XSS vector):
```powershell
rg "javascript:" --type ts --type tsx -g "!node_modules"
```

20. Search for data: URLs with scripts:
```powershell
rg "data:text/html|data:application/javascript" --type ts --type tsx -g "!node_modules"
```

21. Check href sanitization:
```powershell
rg "href\s*=\s*\{" --type tsx -g "apps/web/components/*" -A 3
```

22. Search for user-controlled redirects:
```powershell
rg "window\.location|location\.href|router\.push\(" --type ts --type tsx -g "apps/web/*" -A 5
```

23. Verify redirect URL validation:
```powershell
rg "validateUrl|isValidRedirect|sanitizeUrl" --type ts -g "!node_modules" -A 5
```

### Step 7: Form Security

24. Search for form action handling:
```powershell
rg "<form|onSubmit|handleSubmit" --type tsx -g "apps/web/components/*" -A 5
```

25. Check for autocomplete on sensitive fields:
```powershell
rg "type=\"password\"|type='password'" --type tsx -g "!node_modules" -A 3
```

26. Verify CSRF tokens on forms:
```powershell
rg "csrf|csrfToken|_csrf" --type tsx -g "apps/web/*" -A 3
```

### Step 8: Third-Party Script Security

27. Search for external script loading:
```powershell
rg "<Script|next/script" --type tsx -g "apps/web/*" -A 5
```

28. Check for third-party SDK initialization:
```powershell
rg "gtag|analytics|hotjar|intercom|zendesk|crisp" --type ts --type tsx -g "apps/web/*" -A 5
```

29. Verify external scripts use integrity hashes:
```powershell
rg "integrity=" --type tsx -g "apps/web/*"
```

30. Search for dynamically loaded scripts:
```powershell
rg "loadScript|injectScript|appendScript" --type ts -g "!node_modules" -A 5
```

### Step 9: Mobile App Frontend Security

31. Search for WebView usage in mobile:
```powershell
rg "WebView|webview" --type tsx -g "apps/mobile/*" -A 5
```

32. Check WebView security settings:
    - JavaScript disabled by default?
    - File access restricted?
    - Origin validation?

33. Search for deep link handling:
```powershell
rg "Linking|deeplink|openURL" --type tsx -g "apps/mobile/*" -A 5
```

34. Check for insecure storage in mobile:
```powershell
rg "AsyncStorage|localStorage" --type tsx -g "apps/mobile/*" -A 3
```

### Step 10: React-Specific Security

35. Search for ref-based DOM manipulation:
```powershell
rg "useRef|createRef|\.current\." --type tsx -g "apps/web/components/*" -A 5 | Select-String "innerHTML|outerHTML"
```

36. Check for uncontrolled components with user input:
```powershell
rg "defaultValue\s*=\s*\{" --type tsx -g "apps/web/*" -A 3
```

37. Search for JSON parsing of user input:
```powershell
rg "JSON\.parse\(" --type tsx -g "apps/web/components/*" -A 5
```

38. Verify error boundaries don't expose sensitive info:
```powershell
rg "ErrorBoundary|componentDidCatch|getDerivedStateFromError" --type tsx -g "apps/web/*" -A 10
```

### Step 11: Clickjacking Protection

39. Check for frame-ancestors policy:
```powershell
rg "frame-ancestors|X-Frame-Options" --type ts --type js -g "!node_modules" -A 3
```

40. Search for framebuster code:
```powershell
rg "top\.location|self\.location|frameElement" --type ts --type tsx -g "!node_modules" -A 3
```

### Step 12: Client-Side Storage Security

41. Search for localStorage usage:
```powershell
rg "localStorage\.(setItem|getItem)" --type ts --type tsx -g "apps/web/*" -A 3
```

42. Check what's stored in localStorage:
    - Tokens? (should use httpOnly cookies)
    - PII? (should be encrypted or avoided)
    - Sensitive settings?

43. Search for sessionStorage usage:
```powershell
rg "sessionStorage\." --type ts --type tsx -g "apps/web/*" -A 3
```

44. Verify sensitive data not in client storage:
```powershell
rg "localStorage.*token|localStorage.*password|localStorage.*secret" --type ts --type tsx -g "!node_modules"
```

---

## VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] No `dangerouslySetInnerHTML` with unsanitized user input
- [ ] No `eval()` or `new Function()` with user input
- [ ] CSP headers configured in next.config.js
- [ ] X-Frame-Options or frame-ancestors set
- [ ] No secrets in NEXT_PUBLIC_ variables (only public keys)
- [ ] No javascript: or data: URLs with user input
- [ ] Form redirects validated to prevent open redirect
- [ ] External scripts use integrity hashes where possible
- [ ] Mobile WebViews have JavaScript disabled or restricted
- [ ] No tokens stored in localStorage (use httpOnly cookies)

---

## OUTPUT REQUIREMENTS

Generate a findings report in markdown format at:
`d:\projects\CampoTech\.agent\audit-results\phase-11-frontend-findings.md`

The report MUST include:

1. **Executive Summary** - Overall frontend security posture
2. **XSS Vulnerabilities** - dangerouslySetInnerHTML, innerHTML findings
3. **Unsafe JavaScript** - eval, new Function, dynamic scripts
4. **CSP Analysis** - Header configuration and gaps
5. **Client-Side Secrets** - Exposed credentials review
6. **Third-Party Scripts** - External script risks
7. **Remediation Plan** - Prioritized fix recommendations
8. **Code Samples** - Vulnerable code snippets with line numbers

---

## CRITICAL VULNERABILITY PATTERNS TO SEARCH

```powershell
# Run all patterns - document ALL findings
rg "dangerouslySetInnerHTML.*\$\{" --type tsx -g "!node_modules"  # Dynamic HTML
rg "eval\(.*body|eval\(.*input|eval\(.*param" --type ts -g "!node_modules"  # Eval with user input
rg "NEXT_PUBLIC_.*SECRET|NEXT_PUBLIC_.*KEY" -g ".env*"  # Secrets in public vars
rg "javascript:.*\$\{|href.*javascript:" --type tsx -g "!node_modules"  # XSS in links
rg "\.innerHTML.*=.*\$\{" --type tsx -g "!node_modules"  # innerHTML with variables
```

---

## XSS ATTACK SCENARIOS

Test these specific attack vectors:

1. **Stored XSS**: User input saved and rendered later (comments, names)
2. **Reflected XSS**: URL parameters rendered in page
3. **DOM XSS**: Client-side JavaScript processing malicious input
4. **Link Injection**: javascript: URLs in user-provided links
5. **SVG XSS**: Malicious SVG with embedded scripts

---

## ESCALATION CRITERIA

Immediately escalate if ANY of the following are found:
- `dangerouslySetInnerHTML` with unsanitized user input
- `eval()` with user-controlled input
- Production secrets in NEXT_PUBLIC_ variables
- No CSP headers configured
- Tokens stored in localStorage
- WebView with unrestricted JavaScript

---

## NEXT PHASE

After completing Phase 11:
- Phase 12: DEP-SEC (can run in parallel)
- All 12 phases complete - generate final security report
