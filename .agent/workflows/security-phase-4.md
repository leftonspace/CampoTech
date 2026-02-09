---
description: Security Audit Phase 4 - Payment Processing Security (PAY-SEC Agent)
---

# Phase 4: Payment Processing Security Audit

**Agent Role:** PAY-SEC
**Priority:** P0 (Critical)
**Estimated Effort:** 3 hours
**Dependencies:** Phase 2 (Auth), Phase 3 (Database)

---

## ⚠️ CRITICAL AUDIT PRINCIPLES

1. **NEVER trust existing documentation** - All `.md` files, knowledge base items, and cached information may be outdated
2. **VERIFY everything from source code** - The actual codebase is the ONLY source of truth
3. **ASSUME existing security docs are stale** - Re-verify all claims independently
4. **DOCUMENT discrepancies** - Note when reality differs from documentation

---

## PHASE OBJECTIVES

Audit the payment processing for:
- Amount validation and manipulation prevention
- Webhook signature verification
- Payment provider integration security
- Financial data integrity
- Fraud prevention mechanisms
- Refund security

---

## EXECUTION STEPS **EACH STEP HAS TO BE DOCUMENTED IN `d:\projects\CampoTech\.agent\audit-results\phase-4`**

### Step 1: Discover All Payment-Related Files

// turbo
1. Find all payment-related files:
```powershell
cd d:\projects\CampoTech
Get-ChildItem -Recurse -Include "*payment*", "*mercado*", "*invoice*", "*billing*", "*charge*" -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "node_modules|\.next|\.expo" } | Select-Object FullName
```

2. Find all payment API endpoints:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api" -Recurse -Filter "route.ts" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match "payment|mercado|invoice|billing" } | Select-Object FullName
```

### Step 2: Payment Amount Validation (CRITICAL)

3. View the payment creation endpoint:
   - File: `d:\projects\CampoTech\apps\web\app\api\payments\route.ts`
   - CRITICAL CHECK: Is `amount` validated against server-calculated totals?
   - CRITICAL CHECK: Can a client send arbitrary amounts?

4. Search for amount validation patterns:
```powershell
rg -i "amount|total|price|cost" --type ts -g "app/api/payments/*" -A 5 -B 2
```

5. View the payment processor service:
   - File: `d:\projects\CampoTech\apps\web\lib\services\payment-processor.ts`
   - Check: Server-side total recalculation
   - Check: Invoice/job balance verification
   - Check: Currency handling

6. Search for "Catalog-First Pricing" pattern (prices from DB, not client):
```powershell
rg "priceBookItem|catalogItem|serverPrice|fetchPrice" --type ts -g "!node_modules" -A 5
```

7. Search for line-item price validation:
```powershell
rg "unitPrice|lineItem.*price" --type ts -g "app/api/*" -A 10
```

### Step 3: MercadoPago Integration Audit

8. View MercadoPago API endpoints:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api\mercadopago" -Recurse -Filter "route.ts"
```

9. View each MercadoPago endpoint and check:
   - OAuth flow security
   - Token storage (encrypted?)
   - Payment creation validation

10. View MercadoPago library integration:
    - Directory: `d:\projects\CampoTech\apps\web\lib\mercadopago\`
    - Check: Credential handling
    - Check: API key exposure
    - Check: Error handling (no token leakage)

11. View additional MP integrations:
    - Directory: `d:\projects\CampoTech\apps\web\lib\integrations\mercadopago\`
    - Directory: `d:\projects\CampoTech\src\integrations\mercadopago\`

### Step 4: Webhook Security (CRITICAL)

12. View MercadoPago webhook handlers:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api\webhooks\mercadopago" -Recurse -Filter "route.ts"
```

13. For EACH webhook handler:
    - Check: Signature validation is FIRST operation
    - Check: Uses `MP_WEBHOOK_SECRET` from environment
    - Check: Rejects invalid signatures with 401/403
    - Check: Idempotency handling (duplicate webhooks)

14. Search for webhook signature validation:
```powershell
rg "webhook.*secret|signature|x-signature|validateSignature" --type ts -g "!node_modules" -A 5
```

15. Verify signature validation code:
```powershell
rg "createHmac|hmac|sha256" --type ts -g "app/api/webhooks/*" -A 3
```

16. Check for webhook bypass vulnerabilities:
```powershell
rg -i "(skip.*signature|bypass.*webhook|validate.*false)" --type ts -g "!node_modules"
```

### Step 5: Financial Data Integrity

17. Search for payment status manipulation:
```powershell
rg "status.*PAID|status.*COMPLETED|paymentStatus" --type ts -g "!node_modules" -A 5
```

18. Verify payment status can only be set by server:
    - Check: Client cannot directly set payment status
    - Check: Status changes require signature/webhook verification

19. Search for refund handling:
```powershell
rg -i "refund|chargeback|reversal" --type ts -g "!node_modules" -A 5
```

20. Check refund security:
    - Only authorized roles can initiate refunds
    - Refund amount validated against original payment
    - Refund creates audit trail

### Step 6: Invoice/Balance Calculation Security

21. View invoice-related endpoints:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api\invoices" -Recurse -Filter "route.ts"
```

22. Check invoice total calculation:
    - Server-side calculation from line items
    - No client-provided totals accepted
    - Tax calculations verified server-side

23. Search for balance calculation:
```powershell
rg "calculateBalance|remainingBalance|outstandingAmount|getBalance" --type ts -g "!node_modules" -A 10
```

24. Verify balance is always recalculated from source records

### Step 7: Currency and Amount Security

25. Search for currency handling:
```powershell
rg "currency|ARS|USD|Decimal|BigNumber" --type ts -g "!node_modules" -A 3
```

26. Check for:
    - Proper decimal handling (avoid floating point)
    - Currency conversion security
    - Rounding attack prevention

27. Search for Decimal/BigNumber usage:
```powershell
rg "new Decimal|Decimal\(|BigNumber" --type ts -g "!node_modules" -A 2
```

### Step 8: Payment Credential Security

28. Search for payment credential storage:
```powershell
rg "accessToken|refreshToken|mpAccessToken|mercadopago.*token" --type ts -g "!node_modules" -A 3
```

29. Check credential storage:
    - Encrypted in database?
    - Not logged?
    - Properly scoped per organization?

30. View OAuth token storage:
    - Check: Tokens stored securely
    - Check: Tokens have proper TTL
    - Check: Refresh mechanism is secure

### Step 9: Subscription/Recurring Payment Security

31. View subscription-related code:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api\subscription" -Recurse -Filter "route.ts"
```

32. Check subscription security:
    - Plan changes validated server-side
    - No free tier bypass
    - Proper cancellation handling

33. Search for subscription manipulation:
```powershell
rg "tier|subscriptionTier|PROFESIONAL|EMPRESA|INICIAL|FREE" --type ts -g "app/api/*" -A 5
```

### Step 10: Payment Logging and Audit Trail

34. Search for payment logging:
```powershell
rg "logAuditEntry|auditLog.*payment|payment.*log" --type ts -g "!node_modules" -A 3
```

35. Verify all payment operations are logged:
    - Creation, update, deletion
    - Status changes
    - Refunds
    - Failed attempts

---

## VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] Payment amounts validated against server-calculated totals
- [ ] Client cannot provide arbitrary payment amounts
- [ ] All webhook handlers validate signatures FIRST
- [ ] Webhook secrets properly stored in environment variables
- [ ] Refunds require authorization and are audited
- [ ] Invoice totals calculated server-side from line items
- [ ] Decimal/BigNumber used for financial calculations (no floats)
- [ ] Payment credentials encrypted in database
- [ ] Subscription tier changes validated server-side
- [ ] All payment operations logged in audit trail

---

## OUTPUT REQUIREMENTS

Generate a findings report in markdown format at:
`d:\projects\CampoTech\.agent\audit-results\phase-4-payment-findings.md`

The report MUST include:

1. **Executive Summary** - Overall payment security posture
2. **Amount Validation Analysis** - Client input handling
3. **Webhook Security** - Signature validation status
4. **MercadoPago Integration** - OAuth and API security
5. **Financial Calculation Security** - Decimal handling, rounding
6. **Credential Management** - Token storage and handling
7. **Remediation Plan** - Prioritized fix recommendations
8. **Code Samples** - Vulnerable code snippets with line numbers

---

## CRITICAL VULNERABILITY PATTERNS TO SEARCH

```powershell
# Run all patterns - document ALL findings
rg "body\.amount|req\.body\.amount|amount.*body" --type ts -g "!node_modules" -A 5  # Client-provided amounts
rg "parseFloat|Number\(.*amount" --type ts -g "!node_modules"  # Float conversion of money
rg "webhook.*\.json\(\)" --type ts -g "!node_modules" -A 10 | Select-String -NotMatch "signature"  # Webhooks without signature check
rg "console\.log.*token|console\.log.*payment" --type ts -g "!node_modules"  # Token logging
```

---

## ESCALATION CRITERIA

Immediately escalate if ANY of the following are found:
- Client can specify arbitrary payment amounts
- Webhook handlers don't validate signatures
- Payment credentials stored unencrypted
- Float arithmetic used for financial calculations
- No audit logging for payment operations

---

## NEXT PHASE

After completing Phase 4, the following phases can begin:
- Phase 5: SYNC-SEC (depends on Phase 2, 3, 4)