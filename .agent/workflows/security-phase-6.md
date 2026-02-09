---
description: Security Audit Phase 6 - API Authorization Security (AUTHZ-SEC Agent)
---

# Phase 6: API Authorization Security Audit

**Agent Role:** AUTHZ-SEC
**Priority:** P0 (Critical)
**Estimated Effort:** 4 hours
**Dependencies:** Phase 2 (Auth)

---

## ⚠️ CRITICAL AUDIT PRINCIPLES

1. **NEVER trust existing documentation** - All `.md` files, knowledge base items, and cached information may be outdated
2. **VERIFY everything from source code** - The actual codebase is the ONLY source of truth
3. **ASSUME existing security docs are stale** - Re-verify all claims independently
4. **DOCUMENT discrepancies** - Note when reality differs from documentation

---

## PHASE OBJECTIVES

Audit the authorization layer for:
- Role-Based Access Control (RBAC) implementation
- Route guard enforcement
- Field-level permission filtering
- Privilege escalation vectors
- Missing authorization checks
- Inconsistent role handling

---

## EXECUTION STEPS

### Step 1: Discover Authorization Infrastructure

// turbo
1. Find all authorization-related files:
```powershell
cd d:\projects\CampoTech
Get-ChildItem -Recurse -Include "*access*control*", "*permission*", "*rbac*", "*role*", "*guard*" -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "node_modules|\.next|\.expo" } | Select-Object FullName
```

2. Find access control configuration:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\lib" -Recurse -Filter "*.ts" | Where-Object { $_.Name -match "access|permission|role" } | Select-Object FullName
```

### Step 2: Access Control Configuration Audit

3. View the main access control library:
   - Directory: `d:\projects\CampoTech\apps\web\lib\access-control\`
   - Document: ALL permission definitions
   - Check: Role hierarchy (OWNER > ADMIN > DISPATCHER > TECHNICIAN)
   - Check: Resource-level permissions

4. View field-level permissions registry:
   - File: `d:\projects\CampoTech\apps\web\lib\config\field-permissions.ts`
   - Document: All protected fields
   - Check: Who can read/write each field
   - Check: Sensitive fields properly restricted

5. View the field filter middleware:
   - File: `d:\projects\CampoTech\apps\web\lib\middleware\field-filter.ts`
   - Check: Filter applied BEFORE response
   - Check: Covers all response types

6. Search for all role definitions:
```powershell
rg "OWNER|ADMIN|DISPATCHER|TECHNICIAN|VIEWER" --type ts -g "!node_modules" -g "lib/access-control/*" -A 2
```

### Step 3: Route Guard Analysis

7. Find all layout files with guards:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app" -Recurse -Filter "layout.tsx" | Select-Object FullName
```

8. For EACH critical layout, verify guards exist:
```
apps/web/app/dashboard/layout.tsx - Auth required
apps/web/app/dashboard/settings/layout.tsx - Admin+ required
apps/web/app/dashboard/inventory/layout.tsx - Role check
apps/web/app/dashboard/team/layout.tsx - Admin required
```

9. Search for guard implementations:
```powershell
rg "requireRole|checkRole|authorizeRoute|RouteGuard" --type ts -g "!node_modules" -A 5
```

10. View the subscription guard:
    - File: `d:\projects\CampoTech\apps\web\middleware\subscription-guard.ts`
    - Check: Tier enforcement logic
    - Check: Cannot bypass with role

### Step 4: API Route Authorization Audit (CRITICAL)

// turbo
11. List ALL API routes for audit:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api" -Recurse -Filter "route.ts" -ErrorAction SilentlyContinue | Measure-Object
```

12. Search for routes WITHOUT getSession/auth check:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api" -Recurse -Filter "route.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -notmatch "getSession|authenticateRequest|verifyToken") {
        Write-Host "NO AUTH: $($_.FullName)"
    }
}
```

13. Sample audit critical routes manually:
```
apps/web/app/api/jobs/route.ts - getSession() check
apps/web/app/api/jobs/[id]/route.ts - ownership check
apps/web/app/api/users/route.ts - role check
apps/web/app/api/employees/route.ts - admin check
apps/web/app/api/settings/route.ts - owner/admin check
apps/web/app/api/subscription/route.ts - owner check
```

14. For EACH sampled route, verify:
    - Session is retrieved at start
    - Role is checked for protected operations
    - Response filtered based on role

### Step 5: Role Check Consistency

15. Search for role comparison patterns:
```powershell
rg "role\s*===|role\s*!==|role\s*==|session\.role" --type ts -g "app/api/*" -A 3
```

16. Check for case sensitivity issues:
```powershell
rg "role\.toUpperCase|role\.toLowerCase|OWNER|ADMIN" --type ts -g "app/api/*" -A 2
```

17. Verify consistent role handling:
    - All comparisons use same case
    - Role enum is used (not strings)
    - No case-sensitivity bypass

18. Search for role-based conditions:
```powershell
rg "if.*role|switch.*role|\\.role\s*\?" --type ts -g "app/api/*" -A 5
```

### Step 6: Admin API Authorization

19. List all admin API endpoints:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\admin\app\api" -Recurse -Filter "route.ts"
```

20. View admin authentication:
    - Check: Separate from SaaS auth
    - Check: Platform-level privilege verification
    - Check: Cross-tenant operations authenticated

21. For critical admin endpoints, verify:
```
apps/admin/app/api/admin/organizations/route.ts - Platform admin only
apps/admin/app/api/admin/subscriptions/route.ts - Billing admin only
apps/admin/app/api/admin/verifications/route.ts - Trust admin only
```

22. Search for admin bypass patterns:
```powershell
rg -i "(skip.*admin|bypass.*admin|admin.*true)" --type ts -g "apps/admin/*"
```

### Step 7: Privilege Escalation Detection

23. Search for role modification endpoints:
```powershell
rg "role.*update|updateRole|assignRole|setRole" --type ts -g "!node_modules" -A 10
```

24. Verify role changes are restricted:
    - Only OWNER can change roles
    - Cannot elevate to OWNER
    - Role changes logged

25. Search for self-elevation patterns:
```powershell
rg "session\.userId.*role|userId.*:.*role" --type ts -g "app/api/*" -A 5
```

26. Check org membership manipulation:
```powershell
rg "addMember|removeMember|membership" --type ts -g "app/api/*" -A 10
```

### Step 8: Data Filtering by Role

27. Search for role-based data filtering:
```powershell
rg "filterByRole|roleFilter|restrictToRole" --type ts -g "!node_modules" -A 5
```

28. Verify Technician-specific restrictions:
    - Technicians see only assigned jobs
    - No access to all customer data
    - Limited financial visibility

29. Check field filtering in responses:
```powershell
rg "omit|pick|exclude|select\s*:" --type ts -g "app/api/*" -A 3
```

### Step 9: Public vs Authenticated Endpoints

30. Identify intentionally public endpoints:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api\public" -Recurse -Filter "route.ts" -ErrorAction SilentlyContinue
```

31. Verify public endpoints don't expose sensitive data:
   - Health check endpoints
   - Public profile endpoints
   - Webhook receiver endpoints

32. Search for auth skip patterns:
```powershell
rg -i "(public|noAuth|skipAuth|allowAnonymous)" --type ts -g "app/api/*" -A 5
```

### Step 10: Cross-Organization Access

33. Search for organization switching:
```powershell
rg "switchOrg|changeOrg|organizationId\s*=" --type ts -g "app/api/*" -A 10
```

34. Verify org switching validation:
    - File: `d:\projects\CampoTech\apps\web\app\api\auth\switch-org\route.ts`
    - Check: Membership verified before switch
    - Check: New session token generated
    - Check: Cannot switch to arbitrary org

35. Search for cross-org data access:
```powershell
rg "all.*organizations|organization.*\!=" --type ts -g "!node_modules" -A 5
```

---

## VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] All API routes require authentication (except intentional public endpoints)
- [ ] Role checks occur at every protected operation
- [ ] Field-level filtering applied before responses
- [ ] Role comparisons are case-insensitive or use enums
- [ ] Admin API completely separate from SaaS API
- [ ] Role changes restricted to OWNER only
- [ ] Technicians can only see assigned resources
- [ ] Org switching validates membership
- [ ] No privilege escalation vectors found
- [ ] Layout guards in place for sensitive pages

---

## OUTPUT REQUIREMENTS

Generate a findings report in markdown format at:
`d:\projects\CampoTech\.agent\audit-results\phase-6-authorization-findings.md`

The report MUST include:

1. **Executive Summary** - Overall authorization security posture
2. **RBAC Configuration Analysis** - Role hierarchy and permissions
3. **Route Guard Verification** - Protected routes and enforcement
4. **Missing Auth Checks** - Routes without proper authorization
5. **Privilege Escalation Risks** - Potential elevation vectors
6. **Field-Level Access** - RBAC on response data
7. **Remediation Plan** - Prioritized fix recommendations
8. **Code Samples** - Vulnerable code snippets with line numbers

---

## CRITICAL VULNERABILITY PATTERNS TO SEARCH

```powershell
# Run all patterns - document ALL findings
rg "role.*body\.|body\.role" --type ts -g "app/api/*"  # Role from client input
rg "session\.role == undefined" --type ts -g "!node_modules"  # Missing role check
rg "isAdmin\s*=\s*true" --type ts -g "app/api/*"  # Hardcoded admin flag
rg "getSession.*\|\|.*\{\}" --type ts -g "!node_modules"  # Empty session fallback
rg "\\.update.*role:" --type ts -g "app/api/*" -A 5  # Direct role updates
```

---

## PRIVILEGE ESCALATION ATTACK SCENARIOS

Test these specific attack vectors:

1. **Horizontal Escalation**: Access resources from other orgs
2. **Vertical Escalation**: Technician accessing admin endpoints
3. **Role Manipulation**: Modify own role via API
4. **Membership Bypass**: Access org without membership
5. **Field Exposure**: See restricted fields for role

---

## ESCALATION CRITERIA

Immediately escalate if ANY of the following are found:
- API routes without any auth check
- Client can specify their own role
- Role changes possible without OWNER permission
- Cross-org data access possible
- Admin endpoints accessible from SaaS app

---

## NEXT PHASE

After completing Phase 6, the following phases can proceed:
- Phase 7: INTEG-SEC (can parallel)
- Phase 8: AI-SEC (can parallel)
- Phase 10: LOGIC-SEC (depends on Phase 3)
