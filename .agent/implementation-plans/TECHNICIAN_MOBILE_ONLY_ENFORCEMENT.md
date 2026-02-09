# TECHNICIAN Role: Mobile-Only Enforcement Plan
> **Created**: 2026-02-08
> **Updated**: 2026-02-08 — Owner decisions integrated
> **Status**: APPROVED — Ready for implementation
> **Risk Level**: STRUCTURAL — Affects auth, RBAC, frontend, APIs, naming, and business logic

---

## 1. Problem Statement

The `TECHNICIAN` role is currently treated as a "limited web user" who can log into the CampoTech web dashboard. This contradicts the core business model:

- **Technicians work in the field** and should ONLY use the mobile app (`apps/mobile`).
- **The web dashboard** (`apps/web`) is exclusively for **OWNER** and **ADMIN** roles.
- The current architecture assumed parity between all roles on the web, leading to unnecessary complexity (field-level RBAC for technicians on web pages, "own" module access modes, shared inbox agent assignments, etc.).

### Why this matters
1. **Security Risk**: Technicians can access sensitive dashboard sections (even if limited) that were never intended for field staff.
2. **Wasted Complexity**: Hundreds of `TECHNICIAN` role checks in the web codebase serve a use case that shouldn't exist.
3. **Feature Confusion**: Systems like "Shared Inbox Assignment" assume technicians sit at a computer to answer WhatsApp chats — they don't. Technicians communicate with clients via their **personal WhatsApp** directly.
4. **API Confusion**: API routes default to `'TECHNICIAN'` for unknown roles, which masks bugs instead of failing explicitly.
5. **Naming Confusion**: The codebase uses `DISPATCHER` internally but shows "Administrador" to users. This should be `ADMIN` everywhere.

---

## 2. Guiding Principles

> **Technicians NEVER access the web dashboard.** They interact with CampoTech exclusively through the mobile app. All technician-specific data (jobs, location tracking, schedule, payments) flows through the `/api/mobile/` and `/api/sync/` endpoints consumed by the mobile app. The web dashboard is for OWNER + ADMIN only.

> **No technician web portal.** If an owner wants to give a technician more access, they change that person's role to ADMIN in the Equipo section. A technician who wants their own business registers a new account as OWNER.

> **Technicians contact clients via personal WhatsApp.** The mobile app shows the client's phone number. If it's a WhatsApp number, tapping it opens the technician's personal WhatsApp to chat directly. No inbox assignment needed.

---

## 3. Owner Decisions (Resolved Questions)

| Question | Decision |
|---|---|
| **DISPATCHER vs ADMIN naming** | ✅ **Rename to ADMIN.** The Prisma enum changes from `DISPATCHER` → `ADMIN`. All Spanish labels change from "Despachador" → "Administrador". |
| **Future Technician Web Portal** | ❌ **No portal needed.** Technicians who want web access get promoted to ADMIN by the owner. Technicians who want their own business register a new OWNER account. |
| **Conversation Assignment to Technicians** | ✅ **Remove entirely.** Technicians chat with clients via personal WhatsApp (phone link on mobile app). All technician assignment dead code gets cleaned up. No `assignedToId` filtering for technicians. |
| **Role change in Equipo** | ✅ **Must be possible** in the Team (Equipo) section. When changing a role, show a **warning modal** explaining the implications (e.g., TECHNICIAN→ADMIN grants web access; ADMIN→TECHNICIAN removes web access and limits to mobile only). |

---

## 4. Scope of Change

### 4.1 Classification of TECHNICIAN References

After exhaustive codebase analysis, references to `TECHNICIAN` in `apps/web` fall into these categories:

| Category | Count (est.) | Action |
|---|---|---|
| **A. Auth / Login Guard** | 3 files | ⛔ BLOCK technician login to web |
| **B. MODULE_ACCESS config** | 1 file | 🔒 Set ALL modules to `'hidden'` |
| **C. Dashboard UI (role display)** | ~15 files | ✅ Keep — technicians still appear as *data* (team list, job assignments) |
| **D. API routes (data queries)** | ~40 files | ✅ Keep — mobile app calls these APIs |
| **E. Shared Inbox / WA Assignment** | 3 files | 🗑️ Remove technician as assignable "agent". Clean up dead code. |
| **F. Field Permissions (visibleTo)** | 1 file (854 lines) | 🔧 Remove TECHNICIAN from web field visibility |
| **G. Seed / Test scripts** | ~10 files | ✅ Keep — creates technician data |
| **H. Default role fallbacks** | ~25 instances | ⚠️ Review — `'TECHNICIAN'` as default is dangerous |
| **I. DISPATCHER → ADMIN rename** | ~70+ files | 🔄 Full rename across Prisma enum, TS types, labels, and UI |

### 4.2 Classification of DISPATCHER References

References to `DISPATCHER` that need renaming to `ADMIN`:

| Location | Count (est.) | Notes |
|---|---|---|
| **Prisma Schema** (`schema.prisma`) | 1 enum value | `DISPATCHER` → `ADMIN` in `UserRole` enum |
| **TypeScript types** (`types/index.ts`) | 1 type member | `'DISPATCHER'` → `'ADMIN'` |
| **API routes** (`app/api/**`) | ~30 files | Role checks like `role === 'DISPATCHER'` |
| **Dashboard UI** (`app/dashboard/**`) | ~15 files | Role display, conditional rendering |
| **Components** (`components/**`) | ~10 files | Team modals, schedule, maps |
| **Services/Libs** (`lib/**`) | ~10 files | Shared inbox, access control, utils |
| **Spanish labels** (various) | ~8 instances | "Despachador" → "Administrador" |
| **Mobile app** (`apps/mobile`) | ~5 files | Tab layouts, team pages |

---

## 5. Implementation Phases

### Phase 1: DISPATCHER → ADMIN Rename (FOUNDATIONAL)
**Goal**: Align the codebase naming with user-facing language. Do this FIRST because all subsequent phases should use `ADMIN` instead of `DISPATCHER`.

#### 5.1.1 — Prisma Schema Migration
**File**: `apps/web/prisma/schema.prisma` (line 3356-3361)

```prisma
// BEFORE:
enum UserRole {
  SUPER_ADMIN
  OWNER
  DISPATCHER
  TECHNICIAN
}

// AFTER:
enum UserRole {
  SUPER_ADMIN
  OWNER
  ADMIN       // Previously DISPATCHER — web dashboard administrator
  TECHNICIAN
}
```

**Migration**: This requires a Prisma migration that renames the enum value in the database:
```sql
ALTER TYPE "UserRole" RENAME VALUE 'DISPATCHER' TO 'ADMIN';
```

#### 5.1.2 — TypeScript Types
**File**: `apps/web/types/index.ts`

```typescript
// BEFORE:
export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'DISPATCHER' | 'TECHNICIAN';

// AFTER:
export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'TECHNICIAN';
```

#### 5.1.3 — Spanish Labels
**Files to update**:

| File | Current | New |
|---|---|---|
| `lib/utils.ts` (line 439, 444) | `DISPATCHER: 'Administrador'`, `dispatcher: 'Administrador'` | `ADMIN: 'Administrador'`, `admin: 'Administrador'` |
| `lib/email.ts` (line 371) | `'DISPATCHER': 'Despachador'` | `'ADMIN': 'Administrador'` |
| `components/team/TeamMemberDetailModal.tsx` (line 54-57) | `DISPATCHER: { label: 'Despachador' }` | `ADMIN: { label: 'Administrador' }` |
| `components/team/EmployeeListTab.tsx` (line 29) | `label: 'Despachador'` | `label: 'Administrador'` |
| `components/team/TeamMemberModal.tsx` (line 568) | `<option value="DISPATCHER">Despachador</option>` | `<option value="ADMIN">Administrador</option>` |
| `components/verification/EmployeeComplianceTable.tsx` (line 109) | `DISPATCHER: 'Despachador'` | `ADMIN: 'Administrador'` |
| `components/schedule/ScheduleConfigModal.tsx` (line 868) | `'DISPATCHER' ? 'Despachador'` | `'ADMIN' ? 'Administrador'` |
| `app/dashboard/schedule/page.tsx` (line 486) | `'DISPATCHER' ? 'Despachador'` | `'ADMIN' ? 'Administrador'` |
| `app/dashboard/profile/page.tsx` (line 37) | `DISPATCHER: 'Despachador'` | `ADMIN: 'Administrador'` |

#### 5.1.4 — Bulk Code Rename
All `'DISPATCHER'` string literals and `=== 'DISPATCHER'` / `role: 'DISPATCHER'` checks across:
- `apps/web/app/api/**` (~30 files)
- `apps/web/app/dashboard/**` (~15 files)
- `apps/web/components/**` (~10 files)
- `apps/web/lib/**` (~10 files)
- `apps/web/lib/config/field-permissions.ts` (entire permission map uses `DISPATCHER`)
- `apps/mobile/**` (~5 files)

> **Note**: The `lib/queue/dispatcher.ts` file is a **job queue dispatcher** (not a user role) — its name stays unchanged.

---

### Phase 2: Hard Block Web Login (CRITICAL)
**Goal**: Prevent technicians from accessing the web dashboard entirely. Show a friendly redirect page.

#### 5.2.1 — Edge Middleware: Block Dashboard Access
**File**: `apps/web/middleware.ts`

Add a check after token verification (~line 445) that rejects `TECHNICIAN` role from accessing `/dashboard` routes:

```typescript
// After payload verification succeeds:
if (payload.role === 'TECHNICIAN' && pathname.startsWith('/dashboard')) {
  const url = request.nextUrl.clone();
  url.pathname = '/mobile-only';
  return NextResponse.redirect(url);
}
```

#### 5.2.2 — ProtectedRoute Component: Enforce on Client
**File**: `apps/web/lib/auth-context.tsx` → `ProtectedRoute` function

Currently `ProtectedRoute` checks `allowedRoles` only when explicitly passed. The `DashboardLayout` does NOT pass `allowedRoles`, so technicians pass through.

**Change**: The `DashboardLayout` (`apps/web/app/dashboard/layout.tsx` line 240) currently uses `<ProtectedRoute>` without `allowedRoles`. Update to:

```tsx
<ProtectedRoute allowedRoles={['OWNER', 'ADMIN', 'SUPER_ADMIN']}>
```

#### 5.2.3 — Create "Mobile Only" Landing Page
**File**: `apps/web/app/mobile-only/page.tsx` (NEW)

A friendly page with two clear sections:

**Section 1 — Acceso Técnico (primary message)**
- **"CampoTech para técnicos está disponible en la app móvil"**
- Download links for iOS/Android
- **"Si sos propietario o administrador, iniciá sesión aquí"** (link to `/login`)

**Section 2 — Upsell to Own Business (conversion funnel)**
- **"¿Querés gestionar tu propio negocio?"**
- Brief value proposition: "Conseguí nuevos clientes, gestioná trabajos, cobrá online"
- **Show subscription tiers inline** — pull from existing plan config:
  - 🆓 **Prueba Gratis** — 21 días sin compromiso → CTA: "Empezar gratis" → `/register`
  - 💼 **Plan Inicial** — $X/mes → CTA: "Suscribirme" → `/register?plan=inicial`
  - 🚀 **Plan Profesional** — $X/mes → CTA: "Suscribirme" → `/register?plan=profesional`
- They register as OWNER with the selected plan (or free trial by default)
- This turns the redirect into a **growth opportunity** — every blocked technician is a potential new business customer.

---

### Phase 3: Module Access Config Cleanup
**Goal**: Make the config source-of-truth reflect reality.

#### 5.3.1 — Update MODULE_ACCESS
**File**: `apps/web/lib/config/field-permissions.ts` (line 687-716)

Set ALL modules for TECHNICIAN to `'hidden'` (using new `ADMIN` name):

```typescript
dashboard: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'limited', TECHNICIAN: 'hidden' },
jobs:      { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'full', TECHNICIAN: 'hidden' },
customers: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'full', TECHNICIAN: 'hidden' },
invoices:  { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'hidden', TECHNICIAN: 'hidden' },
payments:  { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'hidden', TECHNICIAN: 'hidden' },
fleet:     { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'view', TECHNICIAN: 'hidden' },
inventory: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'view', TECHNICIAN: 'hidden' },
team:      { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'view', TECHNICIAN: 'hidden' },
settings:  { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'hidden', TECHNICIAN: 'hidden' },
analytics: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'limited', TECHNICIAN: 'hidden' },
calendar:  { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'full', TECHNICIAN: 'hidden' },
map:       { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'full', TECHNICIAN: 'hidden' },
whatsapp:  { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'full', TECHNICIAN: 'hidden' },
schedule:  { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'full', TECHNICIAN: 'hidden' },
```

#### 5.3.2 — Update Field Permissions (visibleTo arrays)
**File**: `apps/web/lib/config/field-permissions.ts`

Remove `'TECHNICIAN'` from all `visibleTo` and `editableBy` arrays in the web field config. These permissions only govern what the web dashboard renders. The mobile app has its own field-visibility logic.

**Affected field groups** (lines 28-680):
- `ORGANIZATION_FIELDS`: Remove from `name`, `nombreComercial`, `phone`, `email`, `direccionComercial`, `logo`, `horariosAtencion`, `cuit`
- `USER_FIELDS`: Remove from `legalName`, `name`, `phone`, `email`, `ubicacionAsignada`, `specialty`, `skillLevel`, `avatar`
- `CUSTOMER_FIELDS`: Remove from `cuit`, `razonSocial`, `condicionIva`, `dni`, `direccionFiscal`, `phone`, `email`, `address`, `notes`
- `VEHICLE_FIELDS`: Remove from `plateNumber`, `make`, `model`, `year`, `vtvCertificadoUrl`, `vtvExpiry`, `insuranceExpiry`, `currentMileage`, `status`, `color`, `notes`, `primaryDriver`
- `PRODUCT_FIELDS`: Remove from `sku`, `name`, `description`, `salePrice`, `category`
- `JOB_FIELDS`: Remove from ALL fields (technicians see jobs via mobile, not web)

> **Note**: `editableBy` arrays referencing `'TECHNICIAN'` (e.g., `resolution`, `materialsUsed`, `photos`, `currentMileage`) represent actions technicians perform **via the mobile app**, which calls APIs directly. These API-level checks remain valid in the API routes — the field config is purely for web UI rendering.

---

### Phase 4: Shared Inbox & WhatsApp Assignment Dead Code Cleanup
**Goal**: Remove technician-as-agent concept entirely. Technicians communicate with clients via personal WhatsApp.

#### 5.4.1 — Remove TECHNICIAN from Inbox Role Map
**File**: `apps/web/lib/services/shared-inbox.service.ts` (line 25-29)

```typescript
// BEFORE:
const INBOX_ROLE_MAP: Record<string, InboxRole> = {
    'OWNER': 'owner',
    'DISPATCHER': 'admin',    // Also rename to ADMIN
    'TECHNICIAN': 'agent',    // REMOVE
};

// AFTER:
const INBOX_ROLE_MAP: Record<string, InboxRole> = {
    'OWNER': 'owner',
    'ADMIN': 'admin',
    // TECHNICIAN: removed — techs use personal WhatsApp to contact clients
};
```

#### 5.4.2 — Filter Technicians from Assignable Team List
**File**: `apps/web/lib/services/shared-inbox.service.ts` (line 447-472)

In `getAssignableTeamMembers()`, add role filter to exclude technicians:

```typescript
const members = await prisma.user.findMany({
    where: {
        organizationId,
        isActive: true,
        role: { in: ['OWNER', 'ADMIN'] }, // Only web users can be assigned conversations
    },
    // ...
});
```

#### 5.4.3 — Clean Up Dead Assignment Code
Remove any code that specifically handles technician conversation assignment:
- Ensure `assignedToId` on `WaConversation` can still be used for OWNER/ADMIN assignment — no schema change needed.
- Remove any technician-specific filtering in assignment queries.

#### 5.4.4 — Mobile App: Client Phone → Personal WhatsApp
**File**: `apps/mobile` — relevant job detail / client info screens

Ensure the mobile app displays the client's phone number prominently on job details. When tapped:
- If the number is a WhatsApp number, open the technician's personal WhatsApp with a `wa.me/{phone}` deep link.
- If not, open the native phone dialer.

This replaces any concept of "assigned conversations" for technicians.

---

### Phase 5: Role Change Warning in Equipo (Team) Section
**Goal**: Allow owners to change roles with full awareness of implications.

#### 5.5.1 — Add Warning Modal to TeamMemberModal
**File**: `apps/web/components/team/TeamMemberModal.tsx` (around line 556-584)

When the role `<select>` changes, intercept the change and show a confirmation modal:

**TECHNICIAN → ADMIN**:
```
⚠️ Cambio de Rol: Técnico → Administrador

Este cambio tiene las siguientes implicaciones:
• El usuario tendrá acceso al panel web (dashboard)
• Podrá ver y gestionar clientes, trabajos, y equipo
• Podrá asignar y reasignar trabajos
• Ya no aparecerá como técnico de campo

¿Estás seguro de que querés hacer este cambio?
[Cancelar] [Confirmar Cambio]
```

**ADMIN → TECHNICIAN**:
```
⚠️ Cambio de Rol: Administrador → Técnico

Este cambio tiene las siguientes implicaciones:
• El usuario perderá acceso al panel web (dashboard)
• Solo podrá usar la app móvil
• Solo verá los trabajos que le fueron asignados
• No podrá gestionar clientes ni equipo

¿Estás seguro de que querés hacer este cambio?
[Cancelar] [Confirmar Cambio]
```

#### 5.5.2 — Update Role Options Label
**File**: `apps/web/components/team/TeamMemberModal.tsx` (line 567-569)

```tsx
// BEFORE:
<option value="TECHNICIAN">Técnico</option>
<option value="DISPATCHER">Despachador</option>
{isOwner && <option value="OWNER">Dueño</option>}

// AFTER:
<option value="TECHNICIAN">Técnico (solo app móvil)</option>
<option value="ADMIN">Administrador (acceso web)</option>
{isOwner && <option value="OWNER">Dueño</option>}
```

---

### Phase 6: Default Role Fallback Audit
**Goal**: Stop masking bugs by defaulting unknown roles to `TECHNICIAN`.

#### 5.6.1 — Dangerous Pattern Found (25+ instances)
Throughout the codebase, this pattern appears:

```typescript
const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;
```

**Problem**: If `session.role` is ever `null`/`undefined` due to a bug, the system silently downgrades to `TECHNICIAN` instead of failing. With our new model, this would cause an immediate redirect to `/mobile-only`.

**Recommended Fix**: Change default to cause explicit failure:

```typescript
const userRole = session.role?.toUpperCase() as UserRole;
if (!userRole) {
    return NextResponse.json({ error: 'Role not found in session' }, { status: 401 });
}
```

**Files with this pattern** (approx. 25):
- `apps/web/app/api/vehicles/route.ts` (line 164)
- `apps/web/app/api/vehicles/[id]/route.ts` (lines 170, 214)
- `apps/web/app/api/users/[id]/route.ts` (lines 58, 120)
- `apps/web/app/api/users/route.ts` (line 140)
- `apps/web/app/api/users/me/profile/route.ts` (lines 58, 92)
- `apps/web/app/api/organization/route.ts` (lines 45, 104)
- `apps/web/app/api/invoices/route.ts` (line 35)
- `apps/web/app/api/invoices/[id]/route.ts` (lines 35, 112, 210)
- `apps/web/app/api/jobs/[id]/route.ts` (lines 50, 123)
- `apps/web/app/api/jobs/route.ts` (line 60)
- `apps/web/app/api/jobs/v2/route.ts` (line 117)
- `apps/web/app/api/customers/[id]/route.ts` (lines 39, 77)
- `apps/web/app/api/customers/route.ts` (line 56)
- `apps/web/app/api/inventory/items/[id]/route.ts` (lines 103, 135)
- `apps/web/app/dashboard/layout.tsx` (line 127)
- `apps/web/app/dashboard/settings/organization/page.tsx` (line 80)
- `apps/web/app/dashboard/team/page.tsx` (line 40)
- `apps/web/lib/access-control/middleware.ts` (line 131)

---

### Phase 7: Dashboard UI References (KEEP — No Change Needed)
**Goal**: Clarify which `TECHNICIAN` references in the dashboard are **data-display** (correct) vs **access-control** (incorrect).

These files reference `TECHNICIAN` to **display technician data** to owners/admins. They are correct and should NOT be changed:

| File | Purpose | Action |
|---|---|---|
| `app/dashboard/page.tsx` | Shows technician count in dashboard stats | ✅ KEEP |
| `app/dashboard/team/page.tsx` | Lists technicians in team management | ✅ KEEP |
| `app/dashboard/team/TeamMemberDetailModal.tsx` | Shows technician profile details | ✅ KEEP |
| `app/dashboard/schedule/page.tsx` | Shows technicians in calendar view | ✅ KEEP |
| `app/dashboard/jobs/page.tsx` | Assign technician dropdown, filter by tech | ✅ KEEP |
| `app/dashboard/jobs/[id]/page.tsx` | Shows assigned technicians | ✅ KEEP |
| `app/dashboard/dispatch/page.tsx` | Dispatch board with tech list | ✅ KEEP |
| `app/dashboard/map/page.tsx` | Shows technician locations on map | ✅ KEEP |
| `app/dashboard/analytics/technicians/page.tsx` | Technician performance analytics | ✅ KEEP |
| `app/dashboard/profile/page.tsx` | Role label display | ✅ KEEP |
| `components/team/EmployeeListTab.tsx` | Team member list | ✅ KEEP |
| `components/team/TeamMemberModal.tsx` | Team member edit modal (+ new role warning) | ✅ KEEP (+ Phase 5 changes) |
| `components/team/AvailabilityTabs.tsx` | Availability management | ✅ KEEP |
| `components/schedule/TeamCalendar.tsx` | Calendar with tech names | ✅ KEEP |
| `components/schedule/ScheduleConfigModal.tsx` | Schedule config | ✅ KEEP |
| `components/maps/TrackingMap.tsx` | Map markers for technicians | ✅ KEEP |
| `components/maps/ReassignJobDialog.tsx` | Reassign job dialog | ✅ KEEP |
| `components/maps/MapFiltersPanel.tsx` | Filter by technician | ✅ KEEP |
| `components/jobs/NewJobModal.tsx` | Assign tech to new job | ✅ KEEP |
| `components/jobs/EditJobModal.tsx` | Change tech assignment | ✅ KEEP |
| `components/jobs/NearestTechnicians.tsx` | Nearest tech component | ✅ KEEP |
| `components/jobs/VehicleSuggestion.tsx` | Vehicle suggestion for tech | ✅ KEEP |

---

### Phase 8: API Route References (KEEP — Mobile App Dependency)
**Goal**: These API routes use `TECHNICIAN` role checks because the **mobile app** calls them.

These must NOT be changed — they correctly scope data for technicians calling from the mobile app:

| File | Purpose |
|---|---|
| `app/api/mobile/jobs/today/route.ts` | Mobile: today's jobs for tech |
| `app/api/jobs/[id]/start/route.ts` | Mobile: tech starts job |
| `app/api/jobs/[id]/complete/route.ts` | Mobile: tech completes job |
| `app/api/jobs/[id]/visits/[visitId]/pricing/route.ts` | Mobile: tech proposes price |
| `app/api/tracking/status/route.ts` | Mobile: tech sends location |
| `app/api/tracking/locations/route.ts` | Web: fetches tech locations for map |
| `app/api/tracking/nearest/route.ts` | Web: finds nearest technician |
| `app/api/sync/pull/route.ts` | Mobile: offline sync |
| `app/api/users/me/privacy/route.ts` | Mobile: tech privacy settings |
| `app/api/copilot/chat/route.ts` | AI copilot used by all |

---

### Phase 9: Test & Script References (KEEP)
Seed scripts and test helpers that create technician user records remain valid:

- `scripts/simulation/seed-technicians-vehicles.ts`
- `scripts/simulation/seed-demo-technicians.ts`
- `scripts/simulation/data/technicians.ts`
- `scripts/simulation/master-seed.ts`
- `tests/utils/test-helpers.ts`
- `tests/unit/permissions.test.ts` → Update assertions to reflect new MODULE_ACCESS values and ADMIN rename
- `prisma/seed.ts`

---

### Phase 10: Utility & Label References (KEEP)
These display the Spanish label "Técnico" and are correct regardless of web access:

| File | Reference |
|---|---|
| `lib/utils.ts` (line 440) | `TECHNICIAN: 'Técnico'` in USER_ROLE_LABELS |
| `lib/team/trade-config.ts` | Trade specialty labels |
| Various WhatsApp template files | "Técnico en Camino" message templates |

---

## 6. Files Changed Summary

| Phase | Description | Files Modified | Files Created |
|---|---|---|---|
| Phase 1 (DISPATCHER → ADMIN) | Prisma enum rename + bulk code rename | ~70 | 1 (migration) |
| Phase 2 (Block Login) | Middleware + ProtectedRoute | 2 | 1 (mobile-only page) |
| Phase 3 (Module Config) | field-permissions.ts | 1 | 0 |
| Phase 4 (Shared Inbox Cleanup) | shared-inbox.service.ts + mobile WA link | 2 | 0 |
| Phase 5 (Role Change Warning) | TeamMemberModal.tsx | 1 | 0 |
| Phase 6 (Default Audit) | API route fallback fixes | ~25 | 0 |
| **Total** | | **~101** | **2** |

---

## 7. Migration / Rollout Strategy

1. **Phase 1 first** — The `DISPATCHER → ADMIN` rename is foundational. All other phases use the new name.
   - Prisma migration: `ALTER TYPE "UserRole" RENAME VALUE 'DISPATCHER' TO 'ADMIN';`
   - Bulk find-and-replace across codebase.
   - Deploy together as one atomic change.
2. **Phase 2 next** — Blocking technician login is the critical security fix.
3. **Phase 3-5** — Deploy together. Config cleanup + shared inbox + role change warning.
4. **Phase 6** — Separate PR. The default fallback audit is broad but low-risk.
5. **Test**: Verify mobile app still works for technicians (all `/api/mobile/`, `/api/sync/`, `/api/jobs/[id]/start`, `/api/jobs/[id]/complete` etc.).
6. **Communication**: Notify any organizations where technicians may have been using the web dashboard. Show the "mobile-only" landing page.

---

## 8. What This Does NOT Change

- **Prisma Schema**: `UserRole` enum still includes `TECHNICIAN`. It's a valid role — just not a web role.
- **Mobile App**: Zero changes to core functionality. The mobile app continues to call APIs with TECHNICIAN tokens. (Add personal WhatsApp deep link for client contact.)
- **API Security**: Role checks in API routes (e.g., "only TECHNICIAN can complete a job") remain valid.
- **Team Management UI**: Owners/Admins still see, create, and manage technicians from the web dashboard.
- **Existing Technician Data**: No data migration needed.
- **`lib/queue/dispatcher.ts`**: This is a job queue dispatcher, not a user role. Name unchanged.

---

## 9. Resolved Questions (No Open Questions Remaining)

All three original questions have been resolved by owner decision. See Section 3 above.
