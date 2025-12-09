# Audit Methodology Guide

**Purpose:** How to generate comprehensive implementation audits for CampoTech phases.

---

## Audit Report Structure

The audit examines **5 dimensions** for each phase:

| Dimension | Description |
|-----------|-------------|
| **1. Implementation Completeness** | What files/components exist vs. what the spec requires |
| **2. Integration Status** | Are the systems connected to each other? |
| **3. API Route Coverage** | Are there endpoints to call the services from frontend/mobile? |
| **4. UI Components** | Are there admin/user interfaces for the features? |
| **5. Route Connections** | Do event triggers actually call the appropriate services? |

---

## Audit Process (Step-by-Step)

```
1. READ the implementation plan (FULL-IMPLEMENTATION-PLAN.md)
   └── Extract: files to create, tasks, database schemas, API endpoints

2. READ the implementation review (PHASES-1-8-IMPLEMENTATION-REVIEW.md)
   └── See what was claimed as "complete"

3. VERIFY actual files exist
   └── Glob for expected file patterns
   └── Read key files to confirm content

4. CHECK integration points
   └── Grep for imports/function calls between systems
   └── Example: Does webhook call aggregator? Does job service call tracking?

5. IDENTIFY gaps
   └── Missing files
   └── Missing API routes
   └── Missing function calls (disconnected systems)
   └── Missing UI components

6. CLASSIFY severity
   └── P0: Production blockers (systems don't work)
   └── P1: High priority (degraded functionality)
   └── P2: Medium (nice to have)

7. GENERATE report with tables for easy scanning
```

---

## Prompt Template for Future Audits

Use this prompt to generate the same type of audit for any phase(s):

```
Audit the implementation of [PHASE RANGE] from '[IMPLEMENTATION PLAN FILE]'.

Be thorough on:
1. **What was done** - List all files/components that exist with their locations
2. **What wasn't done** - List missing files/components per the spec
3. **What needs fixing** - Identify bugs, incomplete implementations, or wrong approaches
4. **Route connections** - Verify that all systems are connected:
   - Does [System A] call [System B] when it should?
   - Are there API routes to expose services to frontend?
   - Are event triggers wired up correctly?

For each phase, provide:
- A percentage completion estimate (Implementation % and Integration %)
- Tables showing Done vs Missing items
- Code blocks showing the specific integration points that are broken
- Priority-ranked fix recommendations (P0/P1/P2)

Check these specific integration points:
- [List key integrations relevant to the phases]

Output format:
- Executive summary table
- Per-phase detailed breakdown
- Critical integration gaps section
- Recommended fixes with file locations
```

---

## Example: Auditing Phases 10-12

```
Audit the implementation of Phases 10 through 12 from 'architecture/FULL-IMPLEMENTATION-PLAN.md'.

Be thorough on:
1. **What was done** - List all files/components that exist with their locations
2. **What wasn't done** - List missing files/components per the spec
3. **What needs fixing** - Identify bugs, incomplete implementations, or wrong approaches
4. **Route connections** - Verify that all systems are connected:
   - Does the analytics service get called by job/invoice completions?
   - Are there API routes for report generation?
   - Is the multi-location system integrated with RLS policies?

For each phase, provide:
- A percentage completion estimate (Implementation % and Integration %)
- Tables showing Done vs Missing items
- Code blocks showing the specific integration points that are broken
- Priority-ranked fix recommendations (P0/P1/P2)

Check these specific integration points:
- Job completion → Analytics event tracking
- Invoice creation → Revenue metrics
- Location assignment → RLS context
- Report scheduler → Email delivery

Output format:
- Executive summary table
- Per-phase detailed breakdown
- Critical integration gaps section
- Recommended fixes with file locations
```

---

## Key Elements That Make Audits Effective

| Element | Why It Matters |
|---------|----------------|
| **Implementation vs Integration split** | Something can be "built" but not "connected" - both matter |
| **Specific file locations** | Easy to find and fix issues |
| **Code blocks showing broken connections** | Shows exactly what's wrong |
| **Priority classification (P0/P1/P2)** | Focus on what blocks production first |
| **Tables for Done/Missing** | Quick visual scan of status |
| **"Files to Modify" section** | Actionable next steps |
| **"New Files Required" section** | Clear deliverables |

---

## Verification Commands

### Check if files exist
```
Glob: database/migrations/01[5-9]*.sql
Glob: src/modules/*/onboarding/*.ts
Glob: apps/web/app/api/[feature]/**/*.ts
```

### Check if systems are connected
```
Grep: "ServiceName|importedFunction" in target/directory/
Grep: "createTrackingSession|tracking" in src/modules/jobs/
Grep: "sendVerificationCode" in apps/web/app/api/users/
```

### Read actual implementations
```
Read: apps/web/app/api/webhooks/whatsapp/route.ts
Read: src/modules/jobs/index.ts
```

**Key insight:** Grepping for function imports/calls reveals integration gaps that file existence checks miss.

---

## Output Report Sections

1. **Executive Summary Table** - Overall status at a glance
2. **Per-Phase Breakdown** - Done/Missing tables for each phase
3. **Route Connections** - Code blocks showing what's connected vs broken
4. **Critical Integration Gaps** - Summary of disconnected systems
5. **Recommended Fixes** - Prioritized list (P0/P1/P2)
6. **Files to Modify** - Existing files needing changes
7. **New Files Required** - Files that need to be created

---

## Related Documents

- `PHASES-9.5-9.11-AUDIT-REPORT.md` - Example audit output
- `architecture/FULL-IMPLEMENTATION-PLAN.md` - Implementation specification
- `PHASES-1-8-IMPLEMENTATION-REVIEW.md` - Implementation status tracker
