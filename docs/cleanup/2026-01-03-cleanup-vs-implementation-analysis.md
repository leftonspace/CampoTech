# 🔍 Cleanup vs Implementation Plan Analysis
> **Date:** 2026-01-03  
> **Purpose:** Identify cleanup items that should be SKIPPED because they will be replaced/changed by upcoming implementation work

---

## Executive Summary

After analyzing the implementation plan (8-10 weeks of work) against the cleanup workflow, I've identified **multiple areas where cleanup effort would be wasted** because the code is scheduled for replacement, major refactoring, or deletion.

### Key Principle
> **Don't polish code that's about to be demolished.**

---

## ❌ SKIP These Cleanup Items

### 1. AFIP Settings Route (`apps/web/app/api/settings/afip/route.ts`)
**Implementation Plan Reference:** Phase 1, Task 1.1.1 - 1.1.3

| Cleanup Phase | Why Skip |
|--------------|----------|
| Type Safety | Route will be completely rewritten to use encrypted credentials service |
| Code Quality | Storage logic being replaced - JSONB → dedicated encrypted columns |
| Dead Code | Current implementation marked as "INSECURE" and scheduled for replacement |

**What's Happening:**
- Current route stores AFIP credentials in plain text in `settings` JSONB
- New implementation creates `apps/web/lib/services/afip-credentials.service.ts`
- Database migration adds new columns: `afip_certificate_encrypted`, `afip_password_encrypted`
- Old code will be completely replaced

**Recommendation:** Wait until Phase 1 is complete (Week 1-2)

---

### 2. RBAC / Permissions System
**Implementation Plan Reference:** Phase 1, Task 1.2.1 - 1.2.3

| Cleanup Phase | Why Skip |
|--------------|----------|
| Type Safety | `UserRole` enum being modified (adding DISPATCHER, removing ADMIN) |
| Dead Code | `ADMIN` role code will become dead code |
| All Phases | Permission logic in `middleware.ts` and `permissions.ts` being rewritten |

**Files Affected:**
- `prisma/schema.prisma` (UserRole enum)
- `apps/web/lib/access-control/permissions.ts`
- `apps/web/middleware.ts`
- `apps/web/components/navigation/sidebar.tsx`
- `apps/web/app/(dashboard)/layout.tsx`

**What's Happening:**
- New permission matrix for DISPATCHER role
- All `ADMIN` references migrated to `DISPATCHER`
- UI components updated to conditionally show/hide billing

**Recommendation:** Don't touch permission-related code until Phase 1 is complete

---

### 3. Job Creation / Assignment (`apps/web/app/api/jobs/route.ts`)
**Implementation Plan Reference:** Phase 2, Task 2.1.4

| Cleanup Phase | Why Skip |
|--------------|----------|
| Type Safety | New vehicle scheduling integration being added |
| Code Quality | Job creation logic being modified for auto vehicle population |
| All Phases | Component `jobs/job-form.tsx` getting new state management |

**What's Happening:**
- Job creation will auto-fetch assigned vehicle based on date/time
- New `VehicleScheduleService` integration
- New UI states: `selectedTechnician`, `scheduledDate`, `scheduledTime`, `suggestedVehicle`

**Recommendation:** Wait until Phase 2 Sub-Phase 2.1 is complete (Week 3-5)

---

### 4. Inventory / Job Materials API
**Implementation Plan Reference:** Phase 2, Task 2.2.1 - 2.2.2

| Cleanup Phase | Why Skip |
|--------------|----------|
| Type Safety | Cascade logic replacing manual source selection |
| Code Quality | New `InventoryCascadeService` being created |
| All Phases | API signature changing (removing required `fromVehicle`/`fromWarehouse` params) |

**Files Affected:**
- `apps/web/app/api/inventory/job-materials/route.ts`
- `apps/web/components/jobs/job-completion-form.tsx`

**What's Happening:**
- Manual source selection → automatic cascade (vehicle → warehouse)
- New service file: `apps/web/lib/services/inventory-cascade.service.ts`
- Simplified UI - users no longer pick source

**Recommendation:** Wait until Phase 2 Sub-Phase 2.2 is complete

---

### 5. WhatsApp Workflow Files
**Implementation Plan Reference:** Phase 3, Task 3.1.1 - 3.1.3

| Cleanup Phase | Why Skip |
|--------------|----------|
| Type Safety | Interactive message types being added |
| Code Quality | Template calls → interactive button calls |
| Dead Code | Template-based patterns being replaced |

**Files Affected:**
- `src/ai/workflows/booking.workflow.ts`
- `src/ai/workflows/inquiry.workflow.ts`
- `src/ai/workflows/*.ts` (any workflow using `sendTemplate`)

**What's Happening:**
- `sendTemplate()` → `sendInteractiveButtonMessage()`
- New button click handlers
- New list message integrations
- FAQ workflow being created

**Recommendation:** Wait until Phase 3 is complete (Week 6)

---

### 6. Organizations Controller (OBSOLETE - DELETE DON'T FIX)
**Implementation Plan Reference:** Phase 4, Task 4.2.1 - 4.2.2

| Cleanup Phase | Why Skip |
|--------------|----------|
| ALL | Scheduled for deletion |

**Files Affected:**
- `src/api/public/v1/organizations/organizations.controller.ts`

**What's Happening:**
- File marked as "obsolete" - superseded by Next.js API routes
- Task explicitly says: "Delete Dead Code"

**Recommendation:** **DO NOT CLEAN THIS FILE** - it will be deleted in Phase 4

---

### 7. Voice Processing (Node.js)
**Implementation Plan Reference:** Phase 5 (Entire Phase)

| Cleanup Phase | Why Skip |
|--------------|----------|
| ALL | Entire voice AI system being rewritten in Python |

**Files Affected:**
- `src/workers/voice/voice-processing.worker.ts`
- `src/ai/voice/*` (all voice-related files)
- `VoiceAIService` or similar

**What's Happening:**
- Complete migration from Node.js to Python LangGraph
- New `services/ai/` directory with FastAPI service
- Feature flag controls gradual rollout
- After successful V2 rollout: "Remove V1 code"

**Recommendation:** **DO NOT CLEAN ANY VOICE AI CODE** - it's all being replaced

---

### 8. Settings/Integrations Page
**Implementation Plan Reference:** Phase 4, Task 4.1.1 - 4.1.3

| Cleanup Phase | Why Skip |
|--------------|----------|
| Type Safety | OAuth flows being added |
| Code Quality | UI completely redesigned with tabs, file upload |
| All Phases | Major UX overhaul scheduled |

**Files Affected:**
- `apps/web/app/(dashboard)/settings/integrations/page.tsx`
- Related API routes for MP and WhatsApp OAuth

**What's Happening:**
- Mercado Pago OAuth replacing manual token entry
- AFIP certificate upload with improved UX (tabs, file upload)
- WhatsApp setup UX improvements

**Recommendation:** Wait until Phase 4 is complete (Week 7)

---

### 9. Mobile App Files
**Implementation Plan Reference:** Multiple phases touch mobile

| Cleanup Phase | Why Skip |
|--------------|----------|
| ALL | Mobile app changes are parallel to web changes |

**Files Affected:**
- `apps/mobile/screens/job-completion/materials-screen.tsx`
- `apps/mobile/screens/today/today-screen.tsx`
- `apps/mobile/components/route-button.tsx` (NEW)
- `apps/mobile/lib/api/inventory-api.ts`

**What's Happening:**
- Inventory cascade simplifies mobile UI
- Multi-stop navigation adds route buttons
- New "Navigate all" functionality

**Recommendation:** Clean mobile app AFTER web implementation is complete

---

## ✅ SAFE TO CLEAN (Won't Be Affected)

These areas are **NOT** mentioned in the implementation plan and are safe to clean:

### 1. Customer-Related Code
- `apps/web/app/(dashboard)/customers/*`
- Customer API routes
- Customer components

### 2. Analytics Dashboard
- `apps/web/app/(dashboard)/analytics/*` (except marketplace - being added)
- Existing analytics components

### 3. Team Management (except permissions)
- `apps/web/app/(dashboard)/team/*`
- Team API routes (except role-related)

### 4. UI Components (General)
- `apps/web/components/ui/*` (shadcn components)
- Layout components (except navigation for permissions)
- Form components (except job form)

### 5. Utility Libraries
- `apps/web/lib/utils/*`
- `apps/web/lib/hooks/*` (general hooks)
- `apps/web/lib/validators/*`

### 6. Core Services (Not Voice/AFIP)
- `apps/web/lib/services/encryption.service.ts` (already exists, being used)
- `apps/web/lib/services/notification.service.ts`
- General utility services

### 7. Existing Test Files
- Tests for stable features
- Integration tests

---

## 📊 Phase-by-Phase Safe Cleanup Windows

| After Phase Complete | Safe to Clean |
|---------------------|---------------|
| Phase 1 (Week 2) | AFIP routes, Permission files, RBAC code |
| Phase 2 (Week 5) | Job creation, Inventory, Vehicle scheduling |
| Phase 3 (Week 6) | WhatsApp workflows |
| Phase 4 (Week 7) | Settings/Integrations pages, Dead controller |
| Phase 5 (Week 10) | Voice AI code (or delete entirely) |

---

## 🎯 Recommended Cleanup Strategy

### Option A: Minimal Cleanup Now (Recommended)
1. **Run diagnostics only** - get baseline error counts
2. **Fix only build-breaking errors** in areas NOT scheduled for replacement
3. **Skip** all code mentioned above
4. **Clean fully after each phase** completes

### Option B: Targeted Cleanup Now
Focus cleanup on SAFE areas only:
- Customer management
- Analytics (non-marketplace)
- Team management (non-permissions)
- UI components
- Utilities

### Option C: Wait Until Week 10
Clean entire codebase after all implementation phases complete.

---

## Summary Table

| Area | Clean Now? | Reason |
|------|-----------|--------|
| AFIP routes | ❌ NO | Being rewritten with encryption |
| RBAC/Permissions | ❌ NO | Adding DISPATCHER, removing ADMIN |
| Job creation | ❌ NO | Vehicle scheduling integration |
| Inventory API | ❌ NO | Cascade logic replacement |
| WhatsApp workflows | ❌ NO | Interactive messages overhaul |
| Organizations controller | ❌ NO | **Being deleted** |
| Voice AI (Node.js) | ❌ NO | **Being replaced entirely** |
| Settings/Integrations | ❌ NO | OAuth + UX redesign |
| Mobile app | ❌ NO | Changes dependent on web |
| Customer management | ✅ YES | Not affected |
| Analytics (general) | ✅ YES | Not affected |
| Team (non-permissions) | ✅ YES | Not affected |
| UI components | ✅ YES | Not affected |
| Utilities | ✅ YES | Not affected |

---

## Next Steps

1. **Decision needed:** Which cleanup option (A, B, or C)?
2. If Option A/B: Run diagnostics to get baseline counts
3. Document current error counts for tracking
4. Begin cleanup on SAFE areas only
5. Re-run full cleanup after each implementation phase

---

*Generated by analyzing `/cleanup` workflow against `architecture/implementation-plan.md`*
