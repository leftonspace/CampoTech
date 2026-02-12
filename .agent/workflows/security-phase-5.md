---
description: Security Audit Phase 5 - Mobile Sync Security (SYNC-SEC Agent)
---

# Phase 5: Mobile Sync Security Audit

**Agent Role:** SYNC-SEC
**Priority:** P0 (Critical)
**Estimated Effort:** 3 hours
**Dependencies:** Phase 2 (Auth), Phase 3 (Database), Phase 4 (Payments)

---

## ⚠️ CRITICAL AUDIT PRINCIPLES

1. **NEVER trust existing documentation** - All `.md` files, knowledge base items, and cached information may be outdated
2. **VERIFY everything from source code** - The actual codebase is the ONLY source of truth
3. **ASSUME existing security docs are stale** - Re-verify all claims independently
4. **DOCUMENT discrepancies** - Note when reality differs from documentation

---

## PHASE OBJECTIVES

Audit the mobile sync protocol for:
- Payment amount reconciliation (Truth Reconciliation pattern)
- Client-side data manipulation prevention
- Offline-first security risks
- Status transition enforcement
- Conflict resolution security
- Local data encryption

---

## EXECUTION STEPS **EACH STEP HAS TO BE DOCUMENTED IN `d:\projects\CampoTech\.agent\audit-results\phase-5`**

### Step 1: Discover All Sync-Related Files

// turbo
1. Find all sync-related files:
```powershell
cd d:\projects\CampoTech
Get-ChildItem -Recurse -Include "*sync*", "*watermelon*", "*offline*", "*mobile*" -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "node_modules|\.next|\.expo|\.git" } | Select-Object FullName
```

2. Find mobile sync API endpoints:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api" -Recurse -Filter "route.ts" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match "mobile|sync" } | Select-Object FullName
```

### Step 2: Primary Sync Endpoint Audit (CRITICAL)

3. View the main mobile sync endpoint:
   - File: `d:\projects\CampoTech\apps\web\app\api\mobile\sync\route.ts`
   - **CRITICAL CHECK:** Does it implement Truth Reconciliation?
   - **CRITICAL CHECK:** Are client-provided totals ignored?
   - **CRITICAL CHECK:** Is balance recalculated from source records?

4. Document the complete sync endpoint structure:
   - List ALL accepted payload fields
   - Identify which fields are trusted vs recalculated
   - Check validation for each field

5. Search for specific Truth Reconciliation patterns:
```powershell
rg "calculateBalance|recalculateTotal|serverTotal|truthReconciliation" --type ts -g "!node_modules" -A 10
```

6. Verify payment amount handling in sync:
```powershell
rg "amount|total|payment" --type ts -g "app/api/mobile/sync/*" -A 8 -B 2
```

### Step 3: Status Transition Security (CRITICAL)

7. Search for job status transitions in sync:
```powershell
rg "status|COMPLETED|CANCELLED|IN_PROGRESS|PENDING" --type ts -g "app/api/mobile/sync/*" -A 5
```

8. Verify status transition rules:
   - **CRITICAL:** Can client set job status to COMPLETED directly?
   - **CRITICAL:** Are terminal states (COMPLETED/CANCELLED) immutable?
   - Check: Status changes require business logic validation

9. Search for immutability enforcement:
```powershell
rg -i "(terminal.*state|immutable|cannot.*modify|prevent.*update)" --type ts -g "!node_modules" -A 5
```

10. Verify status change authorization:
```powershell
rg "status.*update|updateStatus|changeStatus" --type ts -g "!node_modules" -A 10
```

### Step 4: Line Item Price Manipulation

11. Search for line item sync handling:
```powershell
rg "lineItem|unit.?Price|unitCost|parts|labor" --type ts -g "app/api/mobile/sync/*" -A 8
```

12. Verify line item pricing:
    - **CRITICAL:** Are prices validated against Pricebook?
    - **CRITICAL:** Can technician send arbitrary prices?
    - Check: Catalog-First Pricing enforcement

13. Search for Pricebook validation in sync:
```powershell
rg "pricebook|catalogItem|validatePrice|fetchPrice" --type ts -g "app/api/mobile/*" -A 5
```

### Step 5: WatermelonDB Local Storage Audit

14. List all WatermelonDB files:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\mobile\watermelon" -Recurse -Filter "*.ts"
```

15. View each WatermelonDB model and check:
    - Schema definitions
    - Sync field mappings
    - Local validation rules

16. Search for local data encryption:
```powershell
rg "encrypt|Secure|AsyncStorage|ExpoSecure" --type ts -g "apps/mobile/*" -A 5
```

17. Check WatermelonDB sync adapter:
```powershell
rg "synchronize|pullChanges|pushChanges|SyncDatabaseChangeSet" --type ts -g "apps/mobile/*" -A 10
```

### Step 6: Client-Side Sync Logic Audit

18. View mobile sync client implementation:
    - Directory: `d:\projects\CampoTech\apps\mobile\lib\sync\`
    - Check: What data is sent from client
    - Check: Are there client-side validations that can be bypassed?

19. Search for sync payload construction:
```powershell
rg "syncPayload|buildPayload|prepareSync" --type ts -g "apps/mobile/*" -A 15
```

20. Identify ALL fields client can send:
```powershell
rg "body\.|payload\." --type ts -g "apps/mobile/lib/sync/*" -A 3
```

### Step 7: Conflict Resolution Security

21. Search for conflict resolution logic:
```powershell
rg "conflict|merge|lastUpdated|timestamp|version" --type ts -g "!node_modules" -A 5
```

22. Verify LWW (Last-Writer-Wins) implementation:
    - Check: Server timestamps used (not client)?
    - Check: Conflict detection mechanism
    - Check: Resolution doesn't favor client-side changes blindly

23. Search for timestamp handling:
```powershell
rg "updatedAt|createdAt|syncedAt|lastSync" --type ts -g "app/api/mobile/sync/*" -A 5
```

### Step 8: Variance Detection and Flagging

24. Search for variance/discrepancy detection:
```powershell
rg -i "(variance|discrepancy|mismatch|flag.*payment|alert)" --type ts -g "!node_modules" -A 8
```

25. Verify payment variance handling:
    - **CRITICAL:** Are payment mismatches flagged?
    - Check: Does variance trigger alerts to ADMIN?
    - Check: Are mismatched jobs prevented from marking as COMPLETED?

26. Search for payment validation in sync:
```powershell
rg "validatePayment|paymentVariance|expectedAmount" --type ts -g "!node_modules" -A 10
```

### Step 9: Authentication in Sync Requests

27. Verify sync endpoints require authentication:
```powershell
rg "getSession|authenticateRequest|verifyToken" --type ts -g "app/api/mobile/*" -A 5
```

28. Check session handling in mobile sync:
    - Valid JWT required
    - Session contains organizationId
    - User role is verified

29. Search for auth bypass in mobile endpoints:
```powershell
rg -i "(skip.*auth|bypass.*auth|no.*auth)" --type ts -g "app/api/mobile/*"
```

### Step 10: Audit Trail for Sync Operations

30. Search for sync operation logging:
```powershell
rg "auditLog|logSync|syncAudit" --type ts -g "!node_modules" -A 5
```

31. Verify sync operations are logged:
    - All sync attempts (success/failure)
    - Variance detections
    - Status transitions initiated from mobile
    - Payment recordings

32. Check for sensitive data in sync logs:
```powershell
rg "console\\.log.*sync|console\\.log.*payload" --type ts -g "!node_modules"
```

---

## VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] Server recalculates payment totals (ignores client amounts)
- [ ] Truth Reconciliation pattern is implemented
- [ ] Client cannot directly set terminal states (COMPLETED/CANCELLED)
- [ ] Line item prices validated against Pricebook
- [ ] Payment variances are detected and flagged
- [ ] Conflict resolution uses server timestamps
- [ ] All sync endpoints require authentication
- [ ] Sync operations are logged in audit trail
- [ ] WatermelonDB data is encrypted at rest
- [ ] Mobile cannot bypass business logic validation

---

## OUTPUT REQUIREMENTS

Generate a findings report in markdown format at:
`d:\projects\CampoTech\.agent\audit-results\phase-5-sync-findings.md`

The report MUST include:

1. **Executive Summary** - Overall mobile sync security posture
2. **Truth Reconciliation Analysis** - Payment/amount handling verification
3. **Status Transition Security** - Terminal state immutability
4. **Line Item Manipulation Risk** - Pricing validation status
5. **Conflict Resolution Assessment** - LWW implementation security
6. **Variance Detection Status** - Payment mismatch handling
7. **Remediation Plan** - Prioritized fix recommendations
8. **Code Samples** - Vulnerable code snippets with line numbers

---

## CRITICAL VULNERABILITY PATTERNS TO SEARCH

```powershell
# Run all patterns - document ALL findings
rg "body\.amount|payload\.amount" --type ts -g "app/api/mobile/sync/*" -A 5  # Client-provided amounts trusted
rg "status.*body\.|body\.status" --type ts -g "app/api/mobile/sync/*" -A 5  # Client sets status directly
rg "unitPrice.*body|body.*unitPrice" --type ts -g "app/api/mobile/sync/*"  # Client-provided prices
rg "syncPayload|pushChanges" --type ts -g "apps/mobile/*" -A 10 | Select-String "(total|amount|status)"  # What client sends
```

---

## SYNC MANIPULATION ATTACK SCENARIOS

Test these specific attack vectors:

1. **Amount Inflation**: Technician reports collecting $10,000 when job was $1,000
2. **Status Skip**: Technician marks job COMPLETED without payment
3. **Price Override**: Technician sends custom line item prices
4. **Timestamp Manipulation**: Client sends future timestamps to win conflicts
5. **Partial Sync Attack**: Sync payments but not line items

---

## ESCALATION CRITERIA

Immediately escalate if ANY of the following are found:
- Server trusts client-provided payment amounts
- Client can set terminal status directly (COMPLETED/CANCELLED)
- No price validation against Pricebook
- Payment variances not detected/flagged
- Sync endpoints accessible without authentication
- No audit trail for sync operations

---

## NEXT PHASE

After completing Phase 5, the following phases can proceed:
- Phase 6: AUTHZ-SEC (parallel, depends on Phase 2)
- Phase 7: INTEG-SEC (parallel, depends on Phase 1, 2)