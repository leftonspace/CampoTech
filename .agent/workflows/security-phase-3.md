---
description: Security Audit Phase 3 - Database & Tenant Isolation (DATA-SEC Agent)
---

# Phase 3: Database & Tenant Isolation Audit

**Agent Role:** DATA-SEC
**Priority:** P0 (Critical)
**Estimated Effort:** 4 hours
**Dependencies:** Phase 1 (Infrastructure)

---

## ⚠️ CRITICAL AUDIT PRINCIPLES

1. **NEVER trust existing documentation** - All `.md` files, knowledge base items, and cached information may be outdated
2. **VERIFY everything from source code** - The actual codebase is the ONLY source of truth
3. **ASSUME existing security docs are stale** - Re-verify all claims independently
4. **DOCUMENT discrepancies** - Note when reality differs from documentation

---

## PHASE OBJECTIVES

Audit the database layer for:
- Multi-tenant data isolation
- SQL injection vulnerabilities
- Raw query security
- IDOR (Insecure Direct Object Reference) vulnerabilities
- Data access patterns
- Connection security

---

## EXECUTION STEPS

### Step 1: Schema Analysis

// turbo
1. View the complete Prisma schema:
```powershell
Get-Content "d:\projects\CampoTech\apps\web\prisma\schema.prisma" | Measure-Object -Line
```

2. Open and analyze the schema file:
   - File: `d:\projects\CampoTech\apps\web\prisma\schema.prisma`
   - Document: ALL tables/models defined
   - For EACH model, check if it has `organizationId` field

3. Find all models WITHOUT organizationId (potential isolation gaps):
```powershell
$schema = Get-Content "d:\projects\CampoTech\apps\web\prisma\schema.prisma" -Raw
$models = [regex]::Matches($schema, 'model\s+(\w+)\s*\{[^}]+\}')
foreach ($model in $models) {
    if ($model.Value -notmatch 'organizationId') {
        Write-Host "NO orgId: $($model.Groups[1].Value)"
    }
}
```

4. Manually review schema for:
   - Tables that SHOULD have organizationId but don't
   - Tables that are intentionally global (e.g., SystemSettings)
   - Cascading delete configurations
   - Sensitive field definitions (passwords, tokens, certificates)

### Step 2: Prisma Client Configuration

5. View Prisma client instantiation:
   - File: `d:\projects\CampoTech\apps\web\lib\prisma.ts`
   - Check: Singleton pattern (prevents connection exhaustion)
   - Check: Logging configuration (sensitive data in logs?)

6. View database connection utilities:
   - Directory: `d:\projects\CampoTech\apps\web\lib\db\`
   - Check: Connection pooling settings
   - Check: SSL/TLS configuration
   - Check: Query timeout settings

### Step 3: Raw SQL Injection Audit (CRITICAL)

// turbo
7. Search for ALL raw SQL usage:
```powershell
cd d:\projects\CampoTech
rg "\$queryRaw|\$executeRaw" --type ts -g "!node_modules" -A 5 -B 2
```

8. Search for UNSAFE raw SQL (HIGH PRIORITY):
```powershell
rg "\$queryRawUnsafe|\$executeRawUnsafe" --type ts -g "!node_modules" -A 10 -B 2
```

9. For EACH `$queryRawUnsafe`/`$executeRawUnsafe` usage found:
   - View the full function
   - Check: Is user input passed directly?
   - Check: Is there whitelist validation for table/column names?
   - Check: Are values parameterized with `$1`, `$2`, etc.?

10. Search for SQL string concatenation:
```powershell
rg "(SELECT|INSERT|UPDATE|DELETE).*\+.*\`|.*\+.*(SELECT|INSERT|UPDATE|DELETE)" --type ts -g "!node_modules"
```

11. Search for SQL template literals with variables:
```powershell
rg "\`.*\$\{.*\}.*(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)|\`(SELECT|INSERT|UPDATE|DELETE).*\$\{" --type ts -g "!node_modules" -A 3
```

### Step 4: Tenant Isolation Verification (CRITICAL)

12. Find all Prisma queries and verify organizationId filtering:
```powershell
rg "prisma\.\w+\.find(Many|First|Unique)|prisma\.\w+\.create|prisma\.\w+\.update|prisma\.\w+\.delete" --type ts -g "!node_modules" -A 8
```

13. Search for queries that might bypass tenant isolation:
```powershell
rg "prisma\.\w+\.find" --type ts -g "!node_modules" -A 10 | Select-String -NotMatch "organizationId"
```

14. For EACH API route in `apps/web/app/api/`, verify:
    - `session.organizationId` is used in WHERE clauses
    - No direct ID access without ownership verification

15. Sample check - critical routes to manually verify:
```
apps/web/app/api/jobs/route.ts
apps/web/app/api/jobs/[id]/route.ts
apps/web/app/api/customers/route.ts
apps/web/app/api/customers/[id]/route.ts
apps/web/app/api/users/route.ts
apps/web/app/api/users/[id]/route.ts
apps/web/app/api/invoices/route.ts
apps/web/app/api/payments/route.ts
```

### Step 5: IDOR Vulnerability Detection

16. Search for direct ID usage without ownership check:
```powershell
rg "params\.(id|userId|customerId|jobId)" --type ts -g "!node_modules" -A 10
```

17. For EACH dynamic route (`[id]`, `[userId]`, etc.):
    - View the route handler
    - Check: Is the ID validated against session.organizationId?
    - Check: Can a user access another org's resources by guessing IDs?

18. Search for potential ID enumeration:
```powershell
rg "findUnique.*id:" --type ts -g "!node_modules" -A 5 | Select-String -NotMatch "organizationId"
```

### Step 6: Data Access Pattern Audit

19. Find all service files that access the database:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\lib\services" -Filter "*.ts" | ForEach-Object { $_.FullName }
```

20. For critical services, verify tenant isolation:
```
payment-processor.ts (financial data)
subscription-manager.ts (billing data)
verification-manager.ts (identity data)
multi-org.service.ts (org switching - special attention)
admin-recovery.ts (admin operations - verify scope)
```

21. Search for cross-tenant data access patterns:
```powershell
rg "organizationId.*!=" --type ts -g "!node_modules"
rg "organizationId.*notIn" --type ts -g "!node_modules"
```

### Step 7: Migration Security Review

22. List all migrations:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\prisma\migrations" -Directory | Select-Object Name
```

23. Check recent migrations for:
    - Data migration scripts that might leak cross-tenant data
    - Column additions without proper defaults
    - Index patterns on organizationId (should exist for performance)

24. View the migration runner:
    - File: `d:\projects\CampoTech\database\migrate.ts`
    - Check: No hardcoded credentials
    - Check: Migration runs with restricted permissions

### Step 8: Sensitive Data Handling

25. Search for sensitive field patterns in schema:
```powershell
Select-String -Path "d:\projects\CampoTech\apps\web\prisma\schema.prisma" -Pattern "(password|token|secret|certificate|key|cuit|cbu|apiKey)" -AllMatches
```

26. For EACH sensitive field found:
    - Check: Is it encrypted at rest?
    - Check: Is it excluded from default selects?
    - Check: Are there field-level access controls?

27. Search for encryption usage:
```powershell
rg "encrypt|decrypt|aes|cipher" --type ts -g "!node_modules" -A 3
```

### Step 9: Database Connection Security

28. View environment example for database URLs:
```powershell
Select-String -Path "d:\projects\CampoTech\apps\web\.env.example" -Pattern "DATABASE|POSTGRES|SUPABASE" -AllMatches
```

29. Check for:
    - SSL enforcement in connection strings
    - Connection pooler usage (prevents connection exhaustion)
    - Direct database URLs not exposed to client

30. Search for database URL handling:
```powershell
rg "DATABASE_URL|DIRECT_DATABASE_URL" --type ts -g "!node_modules" -A 2
```

### Step 10: Admin/Super-user Access Patterns

31. Search for admin bypass patterns:
```powershell
rg -i "(super.?admin|platform.?admin|skip.*org|bypass.*tenant)" --type ts -g "!node_modules" -A 5
```

32. View admin API routes:
    - Directory: `d:\projects\CampoTech\apps\admin\app\api\admin\`
    - Check: Cross-tenant queries are properly authorized
    - Check: Admin actions are logged

---

## VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] All user-facing tables have organizationId field
- [ ] All Prisma queries include organizationId in WHERE clause
- [ ] No $queryRawUnsafe with unvalidated user input
- [ ] All dynamic route parameters validated against session org
- [ ] Sensitive fields are encrypted or properly protected
- [ ] Database connections use SSL/TLS
- [ ] Connection pooling is properly configured
- [ ] Migrations don't contain hardcoded credentials
- [ ] Admin routes have proper cross-tenant authorization

---

## OUTPUT REQUIREMENTS

Generate a findings report in markdown format at:
`d:\projects\CampoTech\.agent\audit-results\phase-3-database-findings.md`

The report MUST include:

1. **Executive Summary** - Overall database security posture
2. **Schema Analysis** - Tables with/without tenant isolation
3. **SQL Injection Findings** - All raw SQL usage with risk ratings
4. **IDOR Vulnerabilities** - Routes with missing ownership checks
5. **Tenant Isolation Gaps** - Queries missing organizationId
6. **Sensitive Data Handling** - Encryption status of sensitive fields
7. **Remediation Plan** - Prioritized fix recommendations
8. **Code Samples** - Vulnerable code snippets with line numbers

---

## CRITICAL VULNERABILITY PATTERNS TO SEARCH

```powershell
# Run all patterns - document ALL findings
rg "\$queryRawUnsafe.*\$\{" --type ts -g "!node_modules"  # String interpolation in raw SQL
rg "findMany\(\)" --type ts -g "!node_modules" -A 3  # findMany without WHERE
rg "deleteMany\(\)" --type ts -g "!node_modules" -A 3  # deleteMany without WHERE
rg "updateMany\(\)" --type ts -g "!node_modules" -A 3  # updateMany without WHERE
rg "\.connect\(.*password" --type ts -g "!node_modules"  # Hardcoded DB passwords
```

---

## ESCALATION CRITERIA

Immediately escalate if ANY of the following are found:
- SQL injection vulnerability (unparameterized user input in raw SQL)
- Tables with sensitive data lacking organizationId
- API routes allowing cross-tenant data access
- Unencrypted passwords or tokens in database
- Database credentials in source code

---

## NEXT PHASE

After completing Phase 3, the following phases can begin:
- Phase 4: PAY-SEC (depends on Phase 2, 3)
- Phase 5: SYNC-SEC (depends on Phase 2, 3)
- Phase 9: COMPLIANCE-SEC (depends on Phase 3)
- Phase 10: LOGIC-SEC (depends on Phase 3)
