---
description: Security Audit Phase 7 - Webhook & External Integration Security (INTEG-SEC Agent)
---

# Phase 7: Webhook & External Integration Security Audit

**Agent Role:** INTEG-SEC
**Priority:** P1 (High)
**Estimated Effort:** 3 hours
**Dependencies:** Phase 1 (Infrastructure), Phase 2 (Auth)

---

## ⚠️ CRITICAL AUDIT PRINCIPLES

1. **NEVER trust existing documentation** - All `.md` files, knowledge base items, and cached information may be outdated
2. **VERIFY everything from source code** - The actual codebase is the ONLY source of truth
3. **ASSUME existing security docs are stale** - Re-verify all claims independently
4. **DOCUMENT discrepancies** - Note when reality differs from documentation

---

## PHASE OBJECTIVES

Audit external integrations for:
- Webhook signature validation
- SSRF (Server-Side Request Forgery) prevention
- Cron endpoint authentication
- API key management
- Third-party SDK security
- Rate limiting on external calls

---

## EXECUTION STEPS

### Step 1: Discover All Webhook Handlers

// turbo
1. List all webhook endpoints:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api\webhooks" -Recurse -Filter "route.ts" -ErrorAction SilentlyContinue | Select-Object FullName
```

2. Find all webhook-related code:
```powershell
cd d:\projects\CampoTech
rg "webhook|Webhook|WEBHOOK" --type ts -g "!node_modules" -l
```

### Step 2: MercadoPago Webhook Security (CRITICAL)

3. List MercadoPago webhook handlers:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api\webhooks\mercadopago" -Recurse -Filter "route.ts"
```

4. For EACH MercadoPago webhook handler, verify:
   - **CRITICAL:** Signature validation is FIRST operation
   - **CRITICAL:** Uses `x-signature` or `x-signature-id` header
   - **CRITICAL:** Compares HMAC with `MP_WEBHOOK_SECRET`
   - Check: Invalid signatures return 401/403
   - Check: Idempotency key handling

5. Search for MercadoPago signature validation:
```powershell
rg "x-signature|validateMPSignature|createHmac.*mercado" --type ts -g "app/api/webhooks/mercadopago/*" -A 10
```

6. Verify webhook secret is from environment:
```powershell
rg "MP_WEBHOOK_SECRET|MERCADOPAGO.*SECRET" --type ts -g "!node_modules" -A 3
```

### Step 3: WhatsApp Webhook Security

7. View WhatsApp webhook handler:
   - File: `d:\projects\CampoTech\apps\web\app\api\webhooks\whatsapp\route.ts`
   - Check: Meta/Facebook signature validation
   - Check: Uses `WHATSAPP_APP_SECRET`
   - Check: Verify callback validation (`hub.verify_token`)

8. Search for Meta signature validation:
```powershell
rg "x-hub-signature|validateMetaSignature|sha256" --type ts -g "app/api/webhooks/whatsapp/*" -A 10
```

9. Check WhatsApp webhook verification:
```powershell
rg "hub\\.mode|hub\\.verify_token|hub\\.challenge" --type ts -g "app/api/webhooks/whatsapp/*" -A 5
```

### Step 4: Other Webhook Handlers

10. View Resend webhook handler:
    - File: `d:\projects\CampoTech\apps\web\app\api\webhooks\resend\route.ts`
    - Check: Signature validation with `RESEND_WEBHOOK_SECRET`
    - Check: Event type validation

11. View Dialog360 webhook handler:
    - File: `d:\projects\CampoTech\apps\web\app\api\webhooks\dialog360\route.ts`
    - Check: Custom secret validation
    - Check: Origin/IP whitelisting

12. Search for ALL webhook signature patterns:
```powershell
rg "validateSignature|verifySignature|webhookSecret" --type ts -g "app/api/webhooks/*" -A 10
```

### Step 5: Cron Endpoint Security

// turbo
13. List all cron endpoints:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api\cron" -Recurse -Filter "route.ts" | Select-Object FullName
```

14. For EACH cron endpoint, verify:
    - `CRON_SECRET` header validation
    - Runs at correct time (vercel.json)
    - No sensitive data in response

15. Search for cron authentication:
```powershell
rg "CRON_SECRET|x-vercel-cron|authorization.*cron" --type ts -g "app/api/cron/*" -A 5
```

16. View vercel.json cron configuration:
    - File: `d:\projects\CampoTech\vercel.json`
    - Check: All cron paths listed
    - Check: Appropriate schedules

17. Check for cron bypass:
```powershell
rg -i "(skip.*cron|bypass.*cron|cron.*false)" --type ts -g "app/api/cron/*"
```

### Step 6: SSRF Prevention (CRITICAL)

18. Search for external URL fetches:
```powershell
rg "fetch\(|axios\.|http\.get|https\.get" --type ts -g "!node_modules" -l
```

19. Search for user-controlled URLs:
```powershell
rg "fetch\(.*\$\{|fetch\(.*body\.|axios.*body\." --type ts -g "!node_modules" -A 5
```

20. For EACH file with external fetches, check:
    - URL is hardcoded or from whitelist
    - User input is NOT used in URLs
    - Response is validated before use

21. Search for URL whitelisting:
```powershell
rg "allowedHosts|urlWhitelist|validDomains" --type ts -g "!node_modules" -A 5
```

22. Check for private IP access prevention:
```powershell
rg "127\\.0\\.0|192\\.168|10\\.|172\\." --type ts -g "!node_modules" -A 2
```

### Step 7: Third-Party SDK Security

23. List all integration directories:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\lib\integrations" -Directory
Get-ChildItem -Path "d:\projects\CampoTech\src\integrations" -Directory
```

24. For EACH integration, audit:
    - API key handling
    - Error response handling (no credential leakage)
    - Rate limiting awareness

25. View critical integrations:
```
apps/web/lib/integrations/whatsapp/ - WhatsApp Cloud API
apps/web/lib/integrations/openai/ - AI service
apps/web/lib/integrations/google-maps/ - Maps API
apps/web/lib/integrations/afip/ - Fiscal integration
```

26. Search for API key exposure:
```powershell
rg "apiKey|api_key|API_KEY" --type ts -g "lib/integrations/*" -A 3
```

### Step 8: Outbound Request Security

27. Search for outbound authentication:
```powershell
rg "Authorization.*Bearer|headers.*token" --type ts -g "lib/integrations/*" -A 3
```

28. Verify outbound requests use HTTPS:
```powershell
rg "http://" --type ts -g "lib/integrations/*" -g "!node_modules"
```

29. Check for certificate validation:
```powershell
rg "rejectUnauthorized|NODE_TLS_REJECT_UNAUTHORIZED" --type ts -g "!node_modules"
```

### Step 9: Rate Limiting on External Calls

30. Search for rate limiting on outbound:
```powershell
rg "rateLimitOutbound|throttleExternal|externalRateLimit" --type ts -g "!node_modules" -A 5
```

31. Check for retry logic abuse:
```powershell
rg "retry|backoff|maxRetries" --type ts -g "lib/integrations/*" -A 5
```

32. Verify exponential backoff implementation:
    - Not infinite retries
    - Proper delay between retries
    - Circuit breaker for failing services

### Step 10: Webhook Logging and Monitoring

33. Search for webhook logging:
```powershell
rg "logWebhook|webhookAudit|auditLog.*webhook" --type ts -g "!node_modules" -A 5
```

34. Verify webhook operations are logged:
    - All incoming webhooks (success/failure)
    - Signature validation failures
    - Processing errors

35. Check for sensitive data in logs:
```powershell
rg "console\\.log.*webhook|logger.*webhook" --type ts -g "app/api/webhooks/*" -A 3
```

---

## VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] ALL webhook handlers validate signatures FIRST
- [ ] Webhook secrets stored in environment variables only
- [ ] Invalid signatures return 401/403 (not 200)
- [ ] All cron endpoints require CRON_SECRET
- [ ] No user-controlled URLs in fetch/axios calls
- [ ] Private IP ranges blocked in outbound requests
- [ ] All external calls use HTTPS
- [ ] API keys not logged or exposed
- [ ] Retry logic has proper backoff
- [ ] Webhook operations logged for audit

---

## OUTPUT REQUIREMENTS

Generate a findings report in markdown format at:
`d:\projects\CampoTech\.agent\audit-results\phase-7-integration-findings.md`

The report MUST include:

1. **Executive Summary** - Overall external integration security posture
2. **Webhook Security Matrix** - All handlers with signature validation status
3. **Cron Security Analysis** - Authentication verification
4. **SSRF Risk Assessment** - User-controlled URL analysis
5. **Third-Party SDK Audit** - API key handling review
6. **Rate Limiting Status** - Outbound request controls
7. **Remediation Plan** - Prioritized fix recommendations
8. **Code Samples** - Vulnerable code snippets with line numbers

---

## CRITICAL VULNERABILITY PATTERNS TO SEARCH

```powershell
# Run all patterns - document ALL findings
rg "await.*\.json\(\)" --type ts -g "app/api/webhooks/*" -B 10 | Select-String -NotMatch "signature|verify"  # Webhooks without signature check
rg "fetch\(.*body\." --type ts -g "!node_modules"  # User input in fetch URL
rg "http://" --type ts -g "lib/integrations/*"  # Non-HTTPS outbound
rg "console\\.log.*secret|console\\.log.*key" --type ts -g "!node_modules"  # Logging credentials
rg "rejectUnauthorized.*false" --type ts -g "!node_modules"  # Certificate bypass
```

---

## WEBHOOK SECURITY ATTACK SCENARIOS

Test these specific attack vectors:

1. **Replay Attack**: Resubmit old webhook with valid signature
2. **Signature Bypass**: Send webhook without signature header
3. **Forged Webhook**: Create fake webhook for different org
4. **SSRF via Webhook**: Webhook payload with internal URL
5. **Cron Timing Attack**: Trigger cron outside schedule

---

## ESCALATION CRITERIA

Immediately escalate if ANY of the following are found:
- Webhook handlers without signature validation
- User input in fetch/axios URLs (SSRF risk)
- HTTP (not HTTPS) for external calls
- API keys logged or in source code
- Cron endpoints accessible without CRON_SECRET
- Certificate validation disabled

---

## NEXT PHASE

After completing Phase 7, the following phases can proceed:
- Phase 8: AI-SEC (can parallel)
- Phase 9: COMPLIANCE-SEC (can parallel)
