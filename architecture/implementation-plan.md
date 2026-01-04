# CampoTech Implementation Roadmap
## Complete Feature Development Plan
**Document Version:** Final  
**Created:** January 2026  
**Estimated Timeline:** 8-10 weeks (40-50 development days)  
**Target Launch:** March 2026

## 📋 Executive Summary
Based on comprehensive codebase audit, 19/27 features (70%) are complete. This roadmap addresses the remaining 8 critical features plus 3 security regressions discovered during audit.

---

> **📎 ADDENDUM: Strategic Features (January 2026)**
> 
> Four additional strategic features have been defined in a separate addendum document:
> 
> | Feature | Phase | File Reference |
> |---------|-------|----------------|
> | Fiscal Health Dashboard (Monotributo) | Phase 2.4 | See addendum |
> | Barcode Inventory Scanning | Phase 2.2.4 | See addendum |
> | Digital Entry Badge (Countries) | Phase 4.3 | See addendum |
> | Unclaimed Profile Growth Engine | Phase 4.4 | See addendum |
> 
> **📄 Full specifications:** `architecture/implementation-plan-addendum.md`
> 
> These features add **+19 days** to the original timeline (new total: 12-14 weeks).

---

### Critical Path:
- **Week 1-2:** Security fixes + RBAC
- **Week 3-5:** Core features (Vehicle scheduling, Inventory, Navigation)
- **Week 6-7:** WhatsApp enhancements + Onboarding automation
- **Week 8-10:** Voice AI migration to LangGraph


# PHASE 1: CRITICAL SECURITY & INFRASTRUCTURE
**Duration:** 1.5 weeks (7.5 days)  
**Priority:** 🔥 BLOCKING (Must complete before production launch)

## Sub-Phase 1.1: AFIP Security Regression Fix
**Objective:** Restore encryption for AFIP certificates (currently stored as plain text)

### Tasks:

#### Task 1.1.1: Audit Current AFIP Storage
**File:** `apps/web/app/api/settings/afip/route.ts`

**Current (INSECURE):**
```typescript
// Settings stored as plain JSON
await prisma.organization.update({
  where: { id: orgId },
  data: {
    settings: {
      afip: {
        cuit: req.cuit,
        certificate: req.certificate, // ❌ PLAIN TEXT
        password: req.password        // ❌ PLAIN TEXT
      }
    }
  }
});
```

**Action Required:**
1. Review current implementation in `apps/web/app/api/settings/afip/route.ts`
2. Confirm AFIP data is stored in settings JSONB without encryption
3. Document all locations where AFIP credentials are read/written

**Acceptance Criteria:**
- [ ] List of all files that read/write AFIP credentials
- [ ] Confirmation of security regression


#### Task 1.1.2: Implement Encrypted AFIP Storage
**Files to create/modify:**
- `apps/web/lib/services/afip-credentials.service.ts` (NEW)
- `apps/web/app/api/settings/afip/route.ts` (MODIFY)

**Implementation:**
```typescript
// apps/web/lib/services/afip-credentials.service.ts
import { EncryptionService } from '@/lib/services/encryption.service';

export class AFIPCredentialsService {
  private encryption = new EncryptionService();

  async saveCredentials(orgId: string, credentials: {
    cuit: string;
    certificate: string;
    password: string;
  }) {
    // Encrypt sensitive data
    const encryptedCert = await this.encryption.encrypt(
      credentials.certificate,
      'afip_certificate'
    );
    const encryptedPassword = await this.encryption.encrypt(
      credentials.password,
      'afip_password'
    );

    // Store in dedicated encrypted fields, NOT in settings JSONB
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        afip_cuit: credentials.cuit, // Plain (not sensitive)
        afip_certificate_encrypted: JSON.stringify(encryptedCert),
        afip_password_encrypted: JSON.stringify(encryptedPassword),
        afip_connected_at: new Date(),
      }
    });
  }

  async getCredentials(orgId: string): Promise<AFIPCredentials | null> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        afip_cuit: true,
        afip_certificate_encrypted: true,
        afip_password_encrypted: true,
      }
    });

    if (!org?.afip_certificate_encrypted) return null;

    // Decrypt on retrieval
    const certificate = await this.encryption.decrypt(
      JSON.parse(org.afip_certificate_encrypted)
    );
    const password = await this.encryption.decrypt(
      JSON.parse(org.afip_password_encrypted)
    );

    return {
      cuit: org.afip_cuit,
      certificate,
      password,
    };
  }
}
```
**Database Migration Required:**
```sql
-- migrations/add_afip_encrypted_fields.sql
ALTER TABLE organizations 
  ADD COLUMN afip_cuit TEXT,
  ADD COLUMN afip_certificate_encrypted TEXT,
  ADD COLUMN afip_password_encrypted TEXT,
  ADD COLUMN afip_connected_at TIMESTAMPTZ;

-- Migrate existing data from settings JSONB
UPDATE organizations
SET 
  afip_cuit = settings->'afip'->>'cuit',
  afip_certificate_encrypted = settings->'afip'->>'certificate', -- Will be re-encrypted
  afip_password_encrypted = settings->'afip'->>'password'       -- Will be re-encrypted
WHERE settings ? 'afip';

-- Remove from settings JSONB after migration
UPDATE organizations
SET settings = settings - 'afip'
WHERE settings ? 'afip';
```

**Acceptance Criteria:**
- [ ] AFIP credentials encrypted with AES-256-GCM
- [ ] Stored in dedicated columns, not JSONB
- [ ] All existing organizations migrated
- [ ] `settings.afip` JSONB field cleared
- [ ] AFIP integration still works (test CAE request)

**Estimated Effort:** 1 day

#### Task 1.1.3: Update AFIP Integration to Use Encrypted Service
**Files to modify:**
- `src/integrations/afip/afip.service.ts`

**Action Required:**
1. Replace direct database reads with `AFIPCredentialsService.getCredentials()`
2. Update all AFIP workers to use new service
3. Verify encryption/decryption doesn't break certificate format

**Acceptance Criteria:**
- [ ] AFIP service uses `AFIPCredentialsService`
- [ ] CAE requests succeed with encrypted credentials
- [ ] No performance regression (encryption is fast)

**Estimated Effort:** 0.5 days

## Sub-Phase 1.2: RBAC - Add DISPATCHER Role
**Objective:** Separate operational management from billing access

### Tasks:

#### Task 1.2.1: Update UserRole Enum
**Files to modify:**
- `prisma/schema.prisma`
- `apps/web/lib/types/user.ts` (or wherever `UserRole` is defined)

**Current:**
```typescript
enum UserRole {
  OWNER       // Full access
  ADMIN       // Full access (duplicate of OWNER?)
  TECHNICIAN  // Field worker
}
```

**New:**
```typescript
enum UserRole {
  OWNER       // Full access including billing
  DISPATCHER  // Operations only (jobs, customers, team) - NO billing
  TECHNICIAN  // Field worker only
}
```
**Database Migration:**
```sql
-- migrations/add_dispatcher_role.sql

-- Add new role
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DISPATCHER';

-- Migrate existing ADMIN users to DISPATCHER
UPDATE users 
SET role = 'DISPATCHER' 
WHERE role = 'ADMIN';

-- Optional: Remove ADMIN role (after migration completes)
-- This is a two-step process in PostgreSQL
```

**Acceptance Criteria:**
- [ ] `DISPATCHER` role added to enum
- [ ] All existing `ADMIN` users migrated to `DISPATCHER`
- [ ] No `ADMIN` users remain in database

**Estimated Effort:** 0.5 days

#### Task 1.2.2: Implement DISPATCHER Permissions
**Files to modify:**
- `apps/web/lib/access-control/permissions.ts` (or equivalent)
- `apps/web/middleware.ts` (if RBAC is middleware-based)

**Permission Matrix:**

| Feature | OWNER | DISPATCHER | TECHNICIAN |
| :--- | :---: | :---: | :---: |
| View all jobs | ✅ | ✅ | ❌ |
| Create/edit jobs | ✅ | ✅ | ❌ |
| Assign jobs | ✅ | ✅ | ❌ |
| View customers | ✅ | ✅ | ❌ |
| View team | ✅ | ✅ | ❌ |
| View billing | ✅ | ❌ | ❌ |
| Change subscription | ✅ | ❌ | ❌ |
| Invite team | ✅ | ❌ | ❌ |
| View analytics | ✅ | ✅ | ❌ |
| WhatsApp inbox | ✅ | ✅ | ❌ |
| Inventory (adjust) | ✅ | ✅ | ❌ |

**Implementation:**
```typescript
// apps/web/lib/access-control/permissions.ts

export const PERMISSIONS = {
  // Operations (OWNER + DISPATCHER)
  'jobs:read': ['OWNER', 'DISPATCHER'],
  'jobs:create': ['OWNER', 'DISPATCHER'],
  'jobs:assign': ['OWNER', 'DISPATCHER'],
  'customers:read': ['OWNER', 'DISPATCHER'],
  'team:read': ['OWNER', 'DISPATCHER'],
  
  // Billing (OWNER ONLY)
  'billing:read': ['OWNER'],
  'subscription:manage': ['OWNER'],
  'team:invite': ['OWNER'],
  
  // Field operations (ALL)
  'jobs:update_status': ['OWNER', 'DISPATCHER', 'TECHNICIAN'],
  'inventory:log_usage': ['OWNER', 'DISPATCHER', 'TECHNICIAN'],
} as const;
```

**Acceptance Criteria:**
- [ ] `DISPATCHER` can access jobs, customers, team
- [ ] `DISPATCHER` cannot access `/settings/billing`
- [ ] `DISPATCHER` cannot access `/settings/subscription`
- [ ] `DISPATCHER` cannot invite new team members
- [ ] `OWNER` retains full access
- [ ] `TECHNICIAN` permissions unchanged

**Estimated Effort:** 1 day

#### Task 1.2.3: Update UI Navigation
**Files to modify:**
- `apps/web/components/navigation/sidebar.tsx`
- `apps/web/app/(dashboard)/layout.tsx`

**Action Required:**
1. Hide "Facturación" menu item for `DISPATCHER`
2. Hide "Suscripción" menu item for `DISPATCHER`
3. Show "Invitar usuario" button only to `OWNER`

**Implementation:**
```tsx
// apps/web/components/navigation/sidebar.tsx
import { hasPermission } from '@/lib/access-control/permissions';

export function Sidebar({ user }) {
  return (
    <nav>
      <NavItem href="/dashboard" icon={Home}>Dashboard</NavItem>
      <NavItem href="/jobs" icon={Briefcase}>Trabajos</NavItem>
      <NavItem href="/customers" icon={Users}>Clientes</NavItem>
      <NavItem href="/team" icon={Users}>Equipo</NavItem>
      
      {/* Show only to OWNER */}
      {hasPermission(user.role, 'billing:read') && (
        <NavItem href="/settings/billing" icon={CreditCard}>
          Facturación
        </NavItem>
      )}
      
      {hasPermission(user.role, 'subscription:manage') && (
        <NavItem href="/settings/subscription" icon={Star}>
          Suscripción
        </NavItem>
      )}
    </nav>
  );
}
```

**Acceptance Criteria:**
- [ ] `DISPATCHER` does not see billing/subscription nav items
- [ ] `DISPATCHER` sees 404 if manually navigating to `/settings/billing`
- [ ] UI correctly reflects permissions

**Estimated Effort:** 0.5 days

## Sub-Phase 1.3: Validate Distributed Locks
**Objective:** Confirm locks prevent race conditions in production

### Tasks:

#### Task 1.3.1: Load Test AFIP Invoice Number Reservation
**Files to test:**
- `src/lib/services/distributed-lock.service.ts`
- `src/integrations/afip/wsfe/invoice-service.ts`

**Test Scenario:**
```typescript
// Load test: Create 100 invoices simultaneously
// Verify no duplicate invoice numbers

const results = await Promise.all(
  Array(100).fill(null).map(() => 
    createInvoice({ orgId, customerId, amount: 1000 })
  )
);

// Check for duplicates
const invoiceNumbers = results.map(r => r.invoice_number);
const hasDuplicates = new Set(invoiceNumbers).size !== invoiceNumbers.length;

expect(hasDuplicates).toBe(false);
```

**Acceptance Criteria:**
- [ ] 100 concurrent invoice requests produce sequential numbers (no gaps, no duplicates)
- [ ] Redis locks release properly (no deadlocks)
- [ ] Performance acceptable (<30s for 100 invoices)

**Estimated Effort:** 0.5 days

#### Task 1.3.2: Load Test Payment Webhook Idempotency
**Files to test:**
- `src/api/public/v1/payments/mercadopago.controller.ts`

**Test Scenario:**
```typescript
// Simulate MP sending same webhook 5 times (network retry)
const webhookPayload = {
  id: 'test-payment-123',
  action: 'payment.approved',
  data: { id: 'payment-456' }
};

await Promise.all(
  Array(5).fill(webhookPayload).map(payload =>
    fetch('/api/v1/payments/webhook', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  )
);

// Check database
const payments = await prisma.payment.findMany({
  where: { mp_payment_id: 'payment-456' }
});

expect(payments).toHaveLength(1); // Only one payment created
```

**Acceptance Criteria:**
- [ ] Duplicate webhooks create only one payment record
- [ ] Idempotency key prevents duplicate processing
- [ ] No race conditions in payment status updates

**Estimated Effort:** 0.5 days

---

**Phase 1 Total Effort:** 5 days  
**Phase 1 Completion Criteria:**
- [ ] AFIP credentials encrypted (security regression fixed)
- [ ] `DISPATCHER` role implemented and tested
- [ ] Distributed locks validated under load
- [ ] All security issues resolved


# PHASE 2: CORE FEATURE COMPLETION
**Duration:** 3 weeks (15 days)  
**Priority:** 🔥 CRITICAL (Blocking features for V1)

## Sub-Phase 2.1: Vehicle Scheduling (Date/Time Aware)
**Objective:** Enable schedule-based vehicle assignments

### Tasks:

#### Task 2.1.1: Create Vehicle Schedules Database Schema
**Files to create:**
- `prisma/migrations/add_vehicle_schedules.sql`

**Schema:**
```sql
CREATE TABLE vehicle_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  
  -- Schedule type
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('permanent', 'date_range', 'recurring')),
  
  -- Date/time constraints
  start_date DATE,
  end_date DATE,
  days_of_week INTEGER[], -- [1,2,3,4,5] for Mon-Fri, 0=Sunday, 6=Saturday
  time_start TIME,
  time_end TIME,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT vehicle_schedules_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id),
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_vehicle_schedules_user_date 
  ON vehicle_schedules(user_id, start_date, end_date);

CREATE INDEX idx_vehicle_schedules_vehicle_date 
  ON vehicle_schedules(vehicle_id, start_date, end_date);
```

**Acceptance Criteria:**
- [ ] Migration runs successfully
- [ ] Foreign keys enforce referential integrity
- [ ] Indexes optimize lookup by user/date and vehicle/date

**Estimated Effort:** 0.5 days

#### Task 2.1.2: Implement VehicleScheduleService
**Files to create:**
- `apps/web/lib/services/vehicle-schedule.service.ts`

**Implementation:**
```typescript
// apps/web/lib/services/vehicle-schedule.service.ts

export class VehicleScheduleService {
  /**
   * Get vehicle assigned to technician for specific date/time
   */
  async getVehicleForDateTime(
    userId: string,
    date: Date,
    time?: string
  ): Promise<Vehicle | null> {
    const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
    const dateOnly = format(date, 'yyyy-MM-dd');

    const schedule = await prisma.vehicleSchedule.findFirst({
      where: {
        user_id: userId,
        OR: [
          // Permanent assignment
          { schedule_type: 'permanent' },
          
          // Date range assignment
          {
            schedule_type: 'date_range',
            start_date: { lte: dateOnly },
            OR: [
              { end_date: null },
              { end_date: { gte: dateOnly } }
            ]
          },
          
          // Recurring (e.g., Mon-Fri every week)
          {
            schedule_type: 'recurring',
            days_of_week: { has: dayOfWeek }
          }
        ]
      },
      include: { vehicle: true },
      orderBy: {
        // Priority: date_range > recurring > permanent
        schedule_type: 'asc'
      }
    });

    if (!schedule) return null;

    // Check time constraints if specified
    if (time && schedule.time_start && schedule.time_end) {
      if (time < schedule.time_start || time > schedule.time_end) {
        return null;
      }
    }

    return schedule.vehicle;
  }

  /**
   * Check if vehicle is available for date/time
   */
  async isVehicleAvailable(
    vehicleId: string,
    date: Date,
    time?: string
  ): Promise<boolean> {
    const dayOfWeek = date.getDay();
    const dateOnly = format(date, 'yyyy-MM-dd');

    const conflictingSchedule = await prisma.vehicleSchedule.findFirst({
      where: {
        vehicle_id: vehicleId,
        OR: [
          { schedule_type: 'permanent' },
          {
            schedule_type: 'date_range',
            start_date: { lte: dateOnly },
            OR: [
              { end_date: null },
              { end_date: { gte: dateOnly } }
            ]
          },
          {
            schedule_type: 'recurring',
            days_of_week: { has: dayOfWeek }
          }
        ]
      }
    });

    return !conflictingSchedule;
  }

  /**
   * Create default vehicle assignment (permanent)
   */
  async setDefaultVehicle(
    userId: string,
    vehicleId: string,
    createdBy: string
  ): Promise<VehicleSchedule> {
    // Remove existing permanent assignment
    await prisma.vehicleSchedule.deleteMany({
      where: {
        user_id: userId,
        schedule_type: 'permanent'
      }
    });

    return prisma.vehicleSchedule.create({
      data: {
        org_id: await this.getOrgId(userId),
        user_id: userId,
        vehicle_id: vehicleId,
        schedule_type: 'permanent',
        created_by: createdBy
      }
    });
  }

  /**
   * Create date-range assignment
   */
  async scheduleVehicle(
    userId: string,
    vehicleId: string,
    startDate: Date,
    endDate: Date | null,
    timeStart?: string,
    timeEnd?: string,
    createdBy: string
  ): Promise<VehicleSchedule> {
    return prisma.vehicleSchedule.create({
      data: {
        org_id: await this.getOrgId(userId),
        user_id: userId,
        vehicle_id: vehicleId,
        schedule_type: 'date_range',
        start_date: startDate,
        end_date: endDate,
        time_start: timeStart,
        time_end: timeEnd,
        created_by: createdBy
      }
    });
  }
}
```

**Acceptance Criteria:**
- [ ] Can get vehicle for user on specific date/time
- [ ] Respects schedule priority (`date_range > recurring > permanent`)
- [ ] Checks time constraints if specified
- [ ] Validates vehicle availability

**Estimated Effort:** 1.5 days

#### Task 2.1.3: Create Vehicle Scheduling API Endpoints
**Files to create:**
- `apps/web/app/api/scheduling/vehicle-assignment/route.ts`
- `apps/web/app/api/scheduling/vehicle-for-job/route.ts`

**Endpoints:**

**1. POST /api/scheduling/vehicle-assignment**
```typescript
// Create or update vehicle schedule
export async function POST(req: Request) {
  const session = await getSession();
  const body = await req.json();

  const schedule = await vehicleScheduleService.scheduleVehicle({
    userId: body.userId,
    vehicleId: body.vehicleId,
    scheduleType: body.scheduleType, // 'permanent' | 'date_range' | 'recurring'
    startDate: body.startDate,
    endDate: body.endDate,
    daysOfWeek: body.daysOfWeek, // [1,2,3,4,5] for Mon-Fri
    timeStart: body.timeStart,
    timeEnd: body.timeEnd,
    createdBy: session.user.id
  });

  return Response.json({ success: true, schedule });
}
```

**2. GET /api/scheduling/vehicle-for-job**
```typescript
// Get vehicle assigned to technician for job date/time
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const technicianId = searchParams.get('technicianId');
  const date = searchParams.get('date'); // ISO date
  const time = searchParams.get('time'); // HH:mm

  const vehicle = await vehicleScheduleService.getVehicleForDateTime(
    technicianId,
    new Date(date),
    time
  );

  return Response.json({ vehicle });
}
```

**Acceptance Criteria:**
- [ ] Can create permanent assignments via API
- [ ] Can create date-range assignments via API
- [ ] Can query vehicle for specific job date/time
- [ ] Returns `null` if no vehicle assigned

**Estimated Effort:** 1 day

#### Task 2.1.4: Integrate Vehicle Scheduling into Job Creation
**Files to modify:**
- `apps/web/app/api/jobs/route.ts` (POST handler)
- `apps/web/components/jobs/job-form.tsx`

**Job Creation Flow:**
```typescript
// When user selects technician + date/time, auto-populate vehicle

// In job form component:
const [selectedTechnician, setSelectedTechnician] = useState(null);
const [scheduledDate, setScheduledDate] = useState(null);
const [scheduledTime, setScheduledTime] = useState(null);
const [suggestedVehicle, setSuggestedVehicle] = useState(null);

useEffect(() => {
  if (selectedTechnician && scheduledDate) {
    // Fetch assigned vehicle
    fetch(`/api/scheduling/vehicle-for-job?technicianId=${selectedTechnician}&date=${scheduledDate}&time=${scheduledTime}`)
      .then(res => res.json())
      .then(data => setSuggestedVehicle(data.vehicle));
  }
}, [selectedTechnician, scheduledDate, scheduledTime]);

// Display:
{suggestedVehicle && (
  <div className="bg-blue-50 p-3 rounded">
    <p className="text-sm">
      Vehículo asignado: <strong>{suggestedVehicle.name}</strong> (según horario)
    </p>
    <Button variant="ghost" onClick={() => setSuggestedVehicle(null)}>
      Cambiar vehículo
    </Button>
  </div>
)}
```

**Acceptance Criteria:**
- [ ] Selecting technician + date auto-populates vehicle field
- [ ] Shows "(según horario)" indicator
- [ ] User can override suggested vehicle
- [ ] Works for permanent, date-range, and recurring schedules

**Estimated Effort:** 1 day

---

#### Task 2.1.5: Create Vehicle Scheduling UI
**Files to create:**
- `apps/web/app/(dashboard)/team/[userId]/vehicle-schedule/page.tsx`

**UI Requirements:**

**1. Default Vehicle Section:**
```
┌─────────────────────────────────────────────┐
│ Vehículo Predeterminado                     │
├─────────────────────────────────────────────┤
│ Este técnico siempre usa este vehículo a    │
│ menos que se especifique lo contrario.      │
│                                             │
│ Vehículo: [Camioneta #3 ▼]                 │
│                                             │
│ [Guardar Predeterminado]                    │
└─────────────────────────────────────────────┘
```

**2. Schedule-Based Assignments:**
```
┌─────────────────────────────────────────────┐
│ Asignaciones por Horario                    │
├─────────────────────────────────────────────┤
│ [+ Nueva Asignación]                        │
│                                             │
│ ╔═══════════════════════════════════════╗   │
│ ║ Camioneta #1                          ║   │
│ ║ Lunes-Miércoles, 8:00-17:00           ║   │
│ ║ Desde: 15/01/2026 | Sin fin           ║   │
│ ║ [Editar] [Eliminar]                   ║   │
│ ╚═══════════════════════════════════════╝   │
│                                             │
│ ╔═══════════════════════════════════════╗   │
│ ║ Camioneta #2                          ║   │
│ ║ Jueves-Viernes, 8:00-17:00            ║   │
│ ║ Desde: 15/01/2026 | Sin fin           ║   │
│ ║ [Editar] [Eliminar]                   ║   │
│ ╚═══════════════════════════════════════╝   │
└─────────────────────────────────────────────┘
```

**3. Create/Edit Assignment Modal:**
```
┌─────────────────────────────────────────────┐
│ Nueva Asignación de Vehículo                │
├─────────────────────────────────────────────┤
│ Vehículo: [Camioneta #1 ▼]                 │
│                                             │
│ Tipo de Horario:                            │
│ ( ) Específico (Fechas exactas)            │
│ (•) Recurrente (Días de la semana)         │
│                                             │
│ Días:                                       │
│ [✓] Lun  [✓] Mar  [✓] Mié  [ ] Jue  [ ] Vie│
│ [ ] Sáb  [ ] Dom                            │
│                                             │
│ Horario:                                    │
│ Desde: [08:00]  Hasta: [17:00]             │
│                                             │
│ Vigencia:                                   │
│ Desde: [15/01/2026]                         │
│ Hasta: [Sin fin ▼]                          │
│                                             │
│ [Cancelar]  [Guardar Asignación]           │
└─────────────────────────────────────────────┘
**Acceptance Criteria:**
- [ ] Can set default vehicle for technician
- [ ] Can create date-specific assignments
- [ ] Can create recurring (weekday-based) assignments
- [ ] Can edit/delete assignments
- [ ] Shows conflict warnings if vehicle double-booked

**Estimated Effort:** 2 days

Sub-Phase 2.1 Total: 6 days

## Sub-Phase 2.2: Inventory Cascade Logic (Automatic Fallback)
**Objective:** Auto-deduct from vehicle first, fallback to warehouse if empty

### Tasks:

#### Task 2.2.1: Implement Cascade Deduction Logic
**Files to modify:**
- `apps/web/app/api/inventory/job-materials/route.ts`

**Current Implementation (Manual):**
```typescript
// User must specify source
{
  fromVehicle: "truck-123",  // OR
  fromWarehouse: "WAREHOUSE" // Must pick one
}
```

**New Implementation (Automatic Cascade):**
```typescript
// apps/web/lib/services/inventory-cascade.service.ts

export class InventoryCascadeService {
  /**
   * Deduct inventory with automatic cascade
   * Priority: 1. Assigned vehicle 2. Warehouse
   */
  async deductWithCascade(
    jobId: string,
    items: Array<{ productId: string; quantity: number }>,
    userId: string
  ): Promise<DeductionResult> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { assigned_vehicle: true }
    });

    const results: DeductionResult[] = [];

    for (const item of items) {
      let deducted = false;

      // Step 1: Try vehicle first (if assigned to job)
      if (job.assigned_vehicle) {
        const vehicleStock = await prisma.vehicleStock.findFirst({
          where: {
            vehicle_id: job.assigned_vehicle.id,
            product_id: item.productId,
            quantity: { gte: item.quantity }
          }
        });

        if (vehicleStock) {
          await this.deductFromVehicle(
            job.assigned_vehicle.id,
            item.productId,
            item.quantity,
            userId,
            jobId
          );
          
          results.push({
            productId: item.productId,
            quantity: item.quantity,
            source: 'vehicle',
            vehicleId: job.assigned_vehicle.id
          });
          
          deducted = true;
        }
      }

      // Step 2: Fallback to warehouse if vehicle empty or no vehicle
      if (!deducted) {
        const warehouseStock = await prisma.inventoryLevel.findFirst({
          where: {
            product_id: item.productId,
            warehouse: { type: 'WAREHOUSE' },
            quantity: { gte: item.quantity }
          }
        });

        if (!warehouseStock) {
          throw new Error(
            `Insufficient stock for ${item.productId}. Vehicle: ${job.assigned_vehicle?.name || 'none'}, Warehouse: insufficient.`
          );
        }

        await this.deductFromWarehouse(
          item.productId,
          item.quantity,
          userId,
          jobId
        );

        results.push({
          productId: item.productId,
          quantity: item.quantity,
          source: 'warehouse',
          warehouseId: warehouseStock.warehouse_id
        });
      }
    }

    return {
      success: true,
      deductions: results,
      message: this.generateSummary(results)
    };
  }

  private generateSummary(results: DeductionResult[]): string {
    const vehicleCount = results.filter(r => r.source === 'vehicle').length;
    const warehouseCount = results.filter(r => r.source === 'warehouse').length;

    if (vehicleCount > 0 && warehouseCount > 0) {
      return `${vehicleCount} items from vehicle, ${warehouseCount} from warehouse`;
    } else if (vehicleCount > 0) {
      return `All items deducted from vehicle`;
    } else {
      return `All items deducted from warehouse`;
    }
  }
}
```
**Acceptance Criteria:**
- [ ] Tries vehicle inventory first (if assigned to job)
- [ ] Falls back to warehouse if vehicle empty
- [ ] Throws clear error if both sources insufficient
- [ ] Logs deduction source for audit trail
- [ ] Returns summary of where items came from

**Estimated Effort:** 1.5 days

#### Task 2.2.2: Add Manual Override Option
**Files to modify:**
- `apps/web/components/jobs/job-completion-form.tsx`

**UI Enhancement:**
```tsx
// Job completion form
<MaterialsUsedSection>
  {/* Auto-cascade by default */}
  <Checkbox 
    checked={useManualSelection}
    onChange={setUseManualSelection}
  >
    Seleccionar origen manualmente
  </Checkbox>

  {useManualSelection && (
    <RadioGroup value={manualSource} onChange={setManualSource}>
      <Radio value="vehicle">
        Deducir solo de vehículo ({vehicleName})
      </Radio>
      <Radio value="warehouse">
        Deducir solo de depósito
      </Radio>
    </RadioGroup>
  )}

  {!useManualSelection && (
    <p className="text-sm text-gray-500">
      Los materiales se deducirán automáticamente del vehículo asignado.
      Si no hay stock suficiente, se usará el depósito.
    </p>
  )}
</MaterialsUsedSection>
```

**Acceptance Criteria:**
- [ ] Default behavior is automatic cascade
- [ ] User can opt-in to manual selection
- [ ] Manual mode works as before (specify vehicle or warehouse)
- [ ] Clear messaging about cascade behavior

**Estimated Effort:** 0.5 days

#### Task 2.2.3: Update Mobile App (Technician) to Use Cascade
**Files to modify:**
- `apps/mobile/screens/job-completion/materials-screen.tsx`
- `apps/mobile/lib/api/inventory-api.ts`

**Mobile Implementation:**
```typescript
// Mobile app - simplified UI
// Just log materials used, system decides source automatically

async function submitJobCompletion(jobId: string, materials: Material[]) {
  const response = await api.post('/inventory/job-materials', {
    jobId,
    items: materials.map(m => ({
      productId: m.id,
      quantity: m.quantity
    })),
    // No source specified - backend handles cascade
  });

  // Show summary to tech
  showToast(response.message); 
  // e.g., "2 items from vehicle, 1 from warehouse"
}
```

**Acceptance Criteria:**
- [ ] Technician doesn't need to choose source (auto cascade)
- [ ] Mobile UI simplified (just quantity input)
- [ ] Shows summary after submission ("2 from vehicle, 1 from warehouse")
- [ ] Works offline (queued for sync)

**Estimated Effort:** 1 day

---

**Sub-Phase 2.2 Total:** 3 days

## Sub-Phase 2.3: Multi-Stop Navigation (Google Maps Integration)
**Objective:** Generate daily routes for technicians with >10 job handling

### Tasks:

#### Task 2.3.1: Set Up Google Maps API
**Files to create:**
- `apps/web/lib/integrations/google-maps/config.ts`

**API Keys Required:**
- **Distance Matrix API:** Find nearest technician
- **Directions API:** Route generation
- **Geocoding API:** Address to coordinates
- **Maps JavaScript API:** Dashboard map display

**Setup Instructions:**
```bash
# 1. Go to Google Cloud Console
https://console.cloud.google.com/

# 2. Create/select project: "CampoTech Production"

# 3. Enable APIs:
- Distance Matrix API
- Directions API
- Geocoding API
- Maps JavaScript API (for dashboard map)

# 4. Create API Key (Server-side)
# Restrict by IP address (server only)

# 5. Create API Key (Client-side)  
# Restrict by HTTP referrer (app.campotech.com/*)

# 6. Add to environment variables
GOOGLE_MAPS_SERVER_KEY=AIza...
GOOGLE_MAPS_CLIENT_KEY=AIza...
```

**Configuration:**
```typescript
// apps/web/lib/integrations/google-maps/config.ts

export const GOOGLE_MAPS_CONFIG = {
  serverKey: process.env.GOOGLE_MAPS_SERVER_KEY!,
  clientKey: process.env.GOOGLE_MAPS_CLIENT_KEY!,
  
  rateLimits: {
    distanceMatrix: 100, // requests per minute
    directions: 100,
    geocoding: 100,
  },
  
  defaults: {
    region: 'ar', // Argentina
    language: 'es', // Spanish
    travelMode: 'driving',
  }
};
```
**Acceptance Criteria:**
- [ ] Google Cloud project created
- [ ] All 4 APIs enabled
- [ ] API keys generated and restricted
- [ ] Keys added to `.env` files
- [ ] Rate limits configured

**Estimated Effort:** 0.5 days

#### Task 2.3.2: Implement Route Generation Service
**Files to create:**
- `apps/web/lib/services/route-generation.service.ts`

**Implementation:**
```typescript
// apps/web/lib/services/route-generation.service.ts
import { Client } from '@googlemaps/google-maps-services-js';

export class RouteGenerationService {
  private client = new Client({});

  /**
   * Generate optimized route for technician's daily jobs
   * Handles waypoint limit (max 10 per request)
   */
  async generateDailyRoute(
    technicianId: string,
    date: Date
  ): Promise<RouteSegment[]> {
    // 1. Get technician's jobs for the day
    const jobs = await prisma.job.findMany({
      where: {
        assigned_to: technicianId,
        scheduled_date: format(date, 'yyyy-MM-dd'),
        status: { in: ['scheduled', 'en_camino', 'working'] }
      },
      orderBy: { scheduled_time_start: 'asc' }
    });

    if (jobs.length === 0) return [];

    // 2. Get technician's current location
    const techLocation = await this.getTechnicianLocation(technicianId);

    // 3. Split into chunks of 10 (Google Maps waypoint limit)
    const jobChunks = this.chunkArray(jobs, 10);

    // 4. Generate route for each chunk
    const segments: RouteSegment[] = [];
    let origin = techLocation;

    for (let i = 0; i < jobChunks.length; i++) {
      const chunk = jobChunks[i];
      
      const response = await this.client.directions({
        params: {
          origin: origin,
          destination: chunk[chunk.length - 1].address,
          waypoints: chunk.slice(0, -1).map(job => job.address),
          optimize: true, // Google optimizes order
          mode: 'driving',
          language: 'es',
          region: 'ar',
          key: GOOGLE_MAPS_CONFIG.serverKey
        }
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Maps error: ${response.data.status}`);
      }

      // Generate shareable URL
      const routeUrl = this.generateMapsUrl(origin, chunk);

      segments.push({
        segmentNumber: i + 1,
        jobs: chunk.map(j => j.id),
        origin: origin,
        destination: chunk[chunk.length - 1].address,
        waypoints: chunk.slice(0, -1).map(j => j.address),
        optimizedOrder: response.data.routes[0].waypoint_order,
        url: routeUrl,
        distance: response.data.routes[0].legs.reduce((sum, leg) => 
          sum + leg.distance.value, 0
        ),
        duration: response.data.routes[0].legs.reduce((sum, leg) => 
          sum + leg.duration.value, 0
        )
      });

      // Next segment starts from last job's location
      origin = chunk[chunk.length - 1].address;
    }

    // 5. Store routes in database
    await this.storeRoutes(technicianId, date, segments);

    return segments;
  }

  /**
   * Generate Google Maps URL for route
   */
  private generateMapsUrl(
    origin: string,
    jobs: Job[]
  ): string {
    const waypoints = jobs.map(j => encodeURIComponent(j.address)).join('/');
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(jobs[jobs.length - 1].address)}&waypoints=${waypoints}&travelmode=driving`;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```
**Database Schema for Routes:**
```sql
CREATE TABLE technician_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  technician_id UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  segment_number INTEGER NOT NULL, -- 1, 2, 3 (for >10 jobs)
  
  -- Route data
  job_ids UUID[] NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  waypoints TEXT[],
  optimized_order INTEGER[],
  
  -- Google Maps data
  route_url TEXT NOT NULL,
  distance_meters INTEGER,
  duration_seconds INTEGER,
  
  -- Status
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(technician_id, date, segment_number)
);

CREATE INDEX idx_technician_routes_tech_date 
  ON technician_routes(technician_id, date);
```

**Acceptance Criteria:**
- [ ] Generates routes for technicians with jobs
- [ ] Handles >10 jobs (creates multiple segments)
- [ ] Uses Google Maps Directions API
- [ ] Optimizes waypoint order
- [ ] Stores routes in database
- [ ] Returns shareable Google Maps URLs

**Estimated Effort:** 2 days

#### Task 2.3.3: Auto-Generate Routes on Job Changes
**Files to modify:**
- `apps/web/lib/services/job.service.ts`

**Trigger Route Regeneration:**
```typescript
// After job assigned/updated/completed
async function onJobChange(job: Job) {
  if (!job.assigned_to || !job.scheduled_date) return;

  // Regenerate route for that technician's day
  await routeGenerationService.generateDailyRoute(
    job.assigned_to,
    new Date(job.scheduled_date)
  );

  // Notify technician if route changed
  if (job.status === 'scheduled') {
    await notificationService.send({
      userId: job.assigned_to,
      title: 'Ruta actualizada',
      body: 'Tu ruta del día ha sido actualizada',
      data: { type: 'route_updated', date: job.scheduled_date }
    });
  }
}
```

**Acceptance Criteria:**
- [ ] Routes regenerate when jobs assigned
- [ ] Routes regenerate when jobs rescheduled
- [ ] Routes regenerate when jobs completed (for remaining jobs)
- [ ] Technicians receive push notification on route update

**Estimated Effort:** 0.5 days

#### Task 2.3.4: Auto-Generate Next Segment After 10th Job
**Files to modify:**
- `apps/web/app/api/jobs/[id]/status/route.ts` (status update handler)

**Implementation:**
```typescript
// When technician completes a job
async function onJobCompleted(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { assigned_user: true }
  });

  // Count completed jobs today
  const completedToday = await prisma.job.count({
    where: {
      assigned_to: job.assigned_to,
      scheduled_date: job.scheduled_date,
      status: 'completed'
    }
  });

  // Check if just completed a multiple of 10
  if (completedToday % 10 === 0) {
    // Get remaining jobs
    const remaining = await prisma.job.findMany({
      where: {
        assigned_to: job.assigned_to,
        scheduled_date: job.scheduled_date,
        status: { in: ['scheduled', 'en_camino', 'working'] }
      }
    });

    if (remaining.length > 0) {
      // Generate new route segment starting from current location
      const newSegment = await routeGenerationService.generateRouteSegment(
        job.assigned_to,
        job.address, // Current location
        remaining.slice(0, 10) // Next 10 jobs
      );

      // Push notification
      await notificationService.send({
        userId: job.assigned_to,
        title: 'Nueva ruta generada',
        body: `${remaining.length} trabajos restantes. Toca para ver ruta.`,
        data: {
          type: 'new_route_segment',
          segmentNumber: Math.floor(completedToday / 10) + 1,
          routeUrl: newSegment.url
        }
      });
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Detects when 10th, 20th, 30th job completed
- [ ] Generates new route segment with remaining jobs
- [ ] Uses current location as origin (not home base)
- [ ] Sends push notification with new route
- [ ] Works for any multiple of 10

**Estimated Effort:** 1 day

#### Task 2.3.5: Mobile App Route Integration
**Files to modify:**
- `apps/mobile/screens/today/today-screen.tsx`
- `apps/mobile/components/route-button.tsx`

**Mobile UI:**
```tsx
// apps/mobile/screens/today/today-screen.tsx

export function TodayScreen() {
  const { jobs, route, loading } = useTodayJobs();

  return (
    <View>
      <Text className="text-2xl font-bold mb-4">
        Trabajos de Hoy ({jobs.length})
      </Text>

      {/* Route Button */}
      {route && (
        <RouteButton 
          url={route.url}
          jobCount={route.job_ids.length}
          segmentNumber={route.segment_number}
          totalSegments={route.total_segments}
        />
      )}

      {/* Job List */}
      <JobList jobs={jobs} />
    </View>
  );
}

// apps/mobile/components/route-button.tsx
export function RouteButton({ url, jobCount, segmentNumber, totalSegments }) {
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(url)}
      className="bg-blue-500 p-4 rounded-lg mb-4"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <MapPin size={24} color="white" />
          <View className="ml-3">
            <Text className="text-white font-semibold">
              Navegar todos ({jobCount} trabajos)
            </Text>
            {totalSegments > 1 && (
              <Text className="text-white/80 text-sm">
                Ruta {segmentNumber} de {totalSegments}
              </Text>
            )}
          </View>
        </View>
        <ChevronRight size={24} color="white" />
      </View>
    </TouchableOpacity>
);
}
```

**After 10th Job Completed:**
```
// Show notification banner
<View className="bg-green-50 p-3 rounded-lg mb-4 border border-green-200">
  <Text className="font-semibold text-green-800">
    🎉 ¡Nueva ruta generada!
  </Text>
  <Text className="text-green-700 text-sm mt-1">
    {remainingJobs} trabajos restantes. Toca el botón de navegación para ver la nueva ruta.
  </Text>
</View>
```

**Acceptance Criteria:**
- [ ] "Navegar todos" button opens Google Maps with route
- [ ] Shows segment number if multiple routes (e.g., "Ruta 2 de 3")
- [ ] After 10th job, shows celebratory message + new route button
- [ ] Works offline (opens Google Maps which can cache routes)

**Estimated Effort:** 1 day

---

**Sub-Phase 2.3 Total:** 5 days

---

**Phase 2 Total Effort:** 14 days  
**Phase 2 Completion Criteria:**
- [ ] Vehicle scheduling working (date/time aware)
- [ ] Inventory cascade automatic (vehicle → warehouse)
- [ ] Multi-stop navigation generating routes
- [ ] Mobile app showing navigation buttons
- [ ] Routes regenerate after 10th job completion

---

# PHASE 3: WHATSAPP ENHANCEMENTS
**Duration:** 1 week (5 days)  
**Priority:** 🟡 HIGH (UX improvements)

## Sub-Phase 3.1: Wire Interactive Messages
**Objective:** Connect existing button/list code to workflows

### Tasks:

#### Task 3.1.1: Update BookingWorkflow to Use Buttons
**Files to modify:**
- `src/ai/workflows/booking.workflow.ts` (or equivalent)

**Current (Template):**
```typescript
// Current implementation sends plain text
await whatsapp.sendTemplate({
  to: customer.phone,
  template: 'time_slot_confirmation',
  params: ['Mañana 9-12hs o 14-18hs?']
});
```

**New (Interactive Buttons):**
```typescript
// Use interactive buttons instead
await whatsapp.sendInteractiveButtonMessage({
  to: customer.phone,
  text: '¿Cuándo te gustaría agendar el servicio?',
  buttons: [
    { id: 'tomorrow_morning', title: 'Mañana 9-12hs' },
    { id: 'tomorrow_afternoon', title: 'Mañana 14-18hs' },
    { id: 'day_after', title: 'Pasado mañana' },
    { id: 'custom', title: 'Otro horario' }
  ]
});

// Handle button response
onButtonClick(async (buttonId, messageContext) => {
  switch (buttonId) {
    case 'tomorrow_morning':
      return createJob({
        ...jobData,
        scheduledDate: addDays(new Date(), 1),
        scheduledTime: '09:00-12:00'
      });
    case 'custom':
      return askForCustomDateTime();
    // ... other cases
  }
});
```

**Acceptance Criteria:**
- [ ] Booking workflow uses buttons instead of text
- [ ] Button clicks create jobs automatically
- [ ] Falls back to text if buttons not supported
- [ ] Error handling for button timeout (user doesn't click)

**Estimated Effort:** 1 day

---

#### Task 3.1.2: Add Service Type Selection with Lists
**Files to modify:**
- `src/ai/workflows/inquiry.workflow.ts`

**Implementation:**
```typescript
// When customer says "necesito un servicio" but doesn't specify type
await whatsapp.sendInteractiveListMessage({
  to: customer.phone,
  header: 'Servicios Disponibles',
  text: '¿Qué tipo de servicio necesitás?',
  buttonText: 'Ver servicios',
  sections: [
    {
      title: 'Servicios Principales',
      rows: [
        { id: 'plomeria', title: 'Plomería', description: 'Pérdidas, instalaciones, desagües' },
        { id: 'electricidad', title: 'Electricidad', description: 'Instalaciones, tableros, arreglos' },
        { id: 'gas', title: 'Gas', description: 'Instalaciones, fugas, certificados' },
        { id: 'aire', title: 'Aire Acondicionado', description: 'Instalación, mantenimiento, reparación' }
      ]
    },
    {
      title: 'Otros Servicios',
      rows: [
        { id: 'general', title: 'Mantenimiento General', description: 'Arreglos varios' }
      ]
    }
  ]
});
```

**Acceptance Criteria:**
- [ ] Service type selection uses list messages
- [ ] Lists show descriptions for each service
- [ ] Selection auto-fills service type in job
- [ ] Works with existing AI extraction

**Estimated Effort:** 1 day

---

#### Task 3.1.3: Add Quick Reply Buttons for Common Questions
**Files to create:**
- `src/ai/workflows/faq.workflow.ts`

**Common Questions:**
```typescript
const FAQ_BUTTONS = {
  pricing: [
    { id: 'faq_pricing', title: '💰 Precios' },
    { id: 'faq_payment', title: '💳 Formas de pago' },
    { id: 'faq_warranty', title: '✅ Garantía' }
  ],
  scheduling: [
    { id: 'faq_hours', title: '🕒 Horarios' },
    { id: 'faq_emergency', title: '🚨 Urgencias' },
    { id: 'faq_zones', title: '📍 Zonas de cobertura' }
  ]
};

// When customer asks "cuanto sale?"
await whatsapp.sendInteractiveButtonMessage({
  to: customer.phone,
  text: '¿Qué información necesitás?',
  buttons: FAQ_BUTTONS.pricing
});
```

**Acceptance Criteria:**
- [ ] FAQ buttons for common questions
- [ ] Reduces need for AI parsing
- [ ] Faster response time for common queries
- [ ] Seamless integration with AI workflow

**Estimated Effort:** 1 day

---

**Sub-Phase 3.1 Total:** 3 days

---

## Sub-Phase 3.2: WhatsApp Attribution Tracking
**Objective:** Track marketplace clicks to WhatsApp

### Tasks:

#### Task 3.2.1: Create MarketplaceClick Database Schema
**Files to create:**
- `prisma/migrations/add_marketplace_clicks.sql`

**Schema:**
```sql
CREATE TABLE marketplace_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Business info
  business_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_slug TEXT NOT NULL,
  
  -- Consumer info (anonymous)
  consumer_ip TEXT,
  consumer_fingerprint TEXT,
  consumer_user_agent TEXT,
  
  -- Attribution
  source TEXT, -- 'marketplace_web' | 'marketplace_mobile'
  referrer TEXT,
  
  -- Conversion tracking
  converted_job_id UUID REFERENCES jobs(id),
  converted_at TIMESTAMPTZ,
  
  -- Timestamps
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT marketplace_clicks_business_id_fkey 
    FOREIGN KEY (business_id) REFERENCES organizations(id)
);

CREATE INDEX idx_marketplace_clicks_business_time 
  ON marketplace_clicks(business_id, clicked_at DESC);

CREATE INDEX idx_marketplace_clicks_conversion 
  ON marketplace_clicks(business_id, converted_at) 
  WHERE converted_at IS NOT NULL;

-- Attribution window: 7 days
CREATE INDEX idx_marketplace_clicks_attribution_window
  ON marketplace_clicks(consumer_ip, clicked_at)
  WHERE clicked_at > NOW() - INTERVAL '7 days';
```

**Acceptance Criteria:**
- [ ] Table created with proper indexes
- [ ] Foreign keys enforce referential integrity
- [ ] Attribution window index optimizes conversion matching

**Estimated Effort:** 0.5 days

---

#### Task 3.2.2: Implement Redirect Endpoint
**Files to create:**
- `apps/web/app/wa-redirect/[slug]/route.ts`

**Implementation:**
```typescript
// apps/web/app/wa-redirect/[slug]/route.ts

export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  // 1. Find business by slug
  const business = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, whatsapp_phone: true }
  });

  if (!business || !business.whatsapp_phone) {
    return redirect('/marketplace'); // Business not found or no WhatsApp
  }

  // 2. Log click analytics
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  const userAgent = req.headers.get('user-agent');
  const referrer = req.headers.get('referer');
  
  // Generate fingerprint (simple hash of IP + UA)
  const fingerprint = createHash('sha256')
    .update(`${ip}:${userAgent}`)
    .digest('hex')
    .substring(0, 16);

  await prisma.marketplaceClick.create({
    data: {
      business_id: business.id,
      business_slug: slug,
      consumer_ip: ip,
      consumer_fingerprint: fingerprint,
      consumer_user_agent: userAgent,
      source: req.headers.get('user-agent')?.includes('Mobile') 
        ? 'marketplace_mobile' 
        : 'marketplace_web',
      referrer,
    }
  });

  // 3. Redirect to WhatsApp (NO pre-filled message)
  const whatsappUrl = `https://wa.me/${business.whatsapp_phone}`;
  
  return redirect(whatsappUrl);
}
```

**Acceptance Criteria:**
- [ ] Captures IP, user agent, referrer
- [ ] Generates fingerprint for tracking
- [ ] Logs click to database
- [ ] Redirects to WhatsApp cleanly (no pre-fill)
- [ ] Works on mobile and desktop

**Estimated Effort:** 1 day

---

#### Task 3.2.3: Implement Conversion Matching
**Files to create:**
- `apps/web/lib/services/attribution.service.ts`

**Implementation:**
```typescript
// apps/web/lib/services/attribution.service.ts

export class AttributionService {
  /**
   * Match job to marketplace click (7-day attribution window)
   */
  async attributeJobToClick(jobId: string): Promise<boolean> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { customer: true }
    });

    if (!job?.customer?.phone) return false;

    // Get customer's IP from recent activity (if available)
    // Or use phone number matching (less accurate)
    
    // Find recent clicks for this business
    const recentClicks = await prisma.marketplaceClick.findMany({
      where: {
        business_id: job.org_id,
        clicked_at: {
          gte: subDays(new Date(), 7), // 7-day attribution window
        },
        converted_job_id: null, // Not yet attributed
      },
      orderBy: { clicked_at: 'desc' }
    });

    // Match by IP + time proximity
    // (This is best-effort - not perfect but good enough)
    for (const click of recentClicks) {
      // If job created within reasonable time after click (e.g., 1 hour)
      const timeDiff = job.created_at.getTime() - click.clicked_at.getTime();
      
      if (timeDiff > 0 && timeDiff < 3600000) { // Within 1 hour
        // Attribute this job to the click
        await prisma.marketplaceClick.update({
          where: { id: click.id },
          data: {
            converted_job_id: jobId,
            converted_at: new Date()
          }
        });
        
        return true;
      }
    }

    return false;
  }
}
```

**Acceptance Criteria:**
- [ ] Matches jobs to clicks within 7-day window
- [ ] Uses time proximity for matching
- [ ] Only attributes once (first match wins)
- [ ] Handles cases where no match found

**Estimated Effort:** 1 day

---

#### Task 3.2.4: Add Attribution Analytics to Dashboard
**Files to create:**
- `apps/web/app/(dashboard)/analytics/marketplace/page.tsx`

**Dashboard UI:**
```tsx
// Marketplace Performance Dashboard

export function MarketplaceAnalyticsPage() {
  const { data } = useMarketplaceAnalytics();

  return (
    <div>
      <h1>Rendimiento en Marketplace</h1>

      <StatsGrid>
        <StatCard
          title="Clicks al WhatsApp"
          value={data.totalClicks}
          change={data.clicksChange}
        />
        <StatCard
          title="Trabajos Generados"
          value={data.convertedJobs}
          change={data.conversionChange}
        />
        <StatCard
          title="Tasa de Conversión"
          value={`${data.conversionRate}%`}
          change={data.conversionRateChange}
        />
      </StatsGrid>

      {/* Chart: Clicks over time */}
      <LineChart
        data={data.clicksOverTime}
        xAxis="date"
        yAxis="clicks"
        title="Clicks del Marketplace"
      />

      {/* Table: Top performing days */}
      <Table
        columns={[
          { key: 'date', label: 'Fecha' },
          { key: 'clicks', label: 'Clicks' },
          { key: 'conversions', label: 'Trabajos' },
          { key: 'rate', label: 'Conversión' }
        ]}
        data={data.dailyBreakdown}
      />
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Shows total clicks from marketplace
- [ ] Shows conversion rate (clicks → jobs)
- [ ] Chart of clicks over time
- [ ] Daily breakdown table
- [ ] Accessible to OWNER only

**Estimated Effort:** 0.5 days

---

**Sub-Phase 3.2 Total:** 3 days

---

**Phase 3 Total Effort:** 6 days  
**Phase 3 Completion Criteria:**
- [ ] Interactive buttons/lists wired to workflows
- [ ] Marketplace attribution tracking working
- [ ] Attribution dashboard showing conversion data
- [ ] All WhatsApp enhancements tested

---

# PHASE 4: ONBOARDING AUTOMATION
**Duration:** 1 week (5 days)  
**Priority:** 🟠 MEDIUM (Process improvement)

## Sub-Phase 4.1: Automated OAuth Flows
**Objective:** Replace manual credential pasting with one-click OAuth

### Tasks:

#### Task 4.1.1: Implement Mercado Pago OAuth
**Files to create:**
- `apps/web/app/api/settings/mercadopago/connect/route.ts`
- `apps/web/app/api/settings/mercadopago/callback/route.ts`

**OAuth Flow:**
```typescript
// 1. Start OAuth flow
// apps/web/app/api/settings/mercadopago/connect/route.ts

export async function GET(req: Request) {
  const session = await getSession();
  
  const authUrl = new URL('https://auth.mercadopago.com/authorization');
  authUrl.searchParams.set('client_id', process.env.MP_CLIENT_ID!);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('platform_id', 'mp');
  authUrl.searchParams.set('redirect_uri', `${process.env.APP_URL}/api/settings/mercadopago/callback`);
  authUrl.searchParams.set('state', session.user.org_id); // CSRF protection

  return redirect(authUrl.toString());
}

// 2. Handle OAuth callback
// apps/web/app/api/settings/mercadopago/callback/route.ts

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // org_id
  
  if (!code) {
    return redirect('/settings/integrations?error=mp_auth_failed');
  }

  // Exchange code for access token
  const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.APP_URL}/api/settings/mercadopago/callback`
    })
  });

  const tokens = await tokenResponse.json();

  // Encrypt and store tokens
  const encryptedAccess = await encryption.encrypt(tokens.access_token, 'mp_access_token');
  const encryptedRefresh = await encryption.encrypt(tokens.refresh_token, 'mp_refresh_token');

  await prisma.organization.update({
    where: { id: state },
    data: {
      mp_access_token_encrypted: JSON.stringify(encryptedAccess),
      mp_refresh_token_encrypted: JSON.stringify(encryptedRefresh),
      mp_user_id: tokens.user_id,
      mp_connected_at: new Date()
    }
  });

  return redirect('/settings/integrations?success=mp_connected');
}
```

**UI Button:**
```tsx
// apps/web/app/(dashboard)/settings/integrations/page.tsx

<Card>
  <CardHeader>
    <CardTitle>Mercado Pago</CardTitle>
    <CardDescription>
      Procesa pagos y ofrece cuotas sin interés
    </CardDescription>
  </CardHeader>
  <CardContent>
    {!mpConnected ? (
      <Button onClick={() => window.location.href = '/api/settings/mercadopago/connect'}>
        <Icons.mercadopago className="mr-2" />
        Conectar con Mercado Pago
      </Button>
    ) : (
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <CheckCircle className="text-green-500 mr-2" />
          <span>Conectado como {mpUserName}</span>
        </div>
        <Button variant="outline" onClick={disconnectMP}>
          Desconectar
        </Button>
      </div>
    )}
  </CardContent>
</Card>
```

**Acceptance Criteria:**
- [ ] "Connect with Mercado Pago" button starts OAuth
- [ ] Tokens encrypted and stored securely
- [ ] Shows connected status with account name
- [ ] Can disconnect and reconnect
- [ ] No more manual token pasting

**Estimated Effort:** 2 days

---

#### Task 4.1.2: Implement WhatsApp Business OAuth (Meta)
**Files to create:**
- `apps/web/app/api/settings/whatsapp/connect/route.ts`
- `apps/web/app/api/settings/whatsapp/callback/route.ts`

**OAuth Flow (Meta Business):**
```typescript
// Similar pattern to MP OAuth
// Uses Meta's Business Login flow

export async function GET(req: Request) {
  const session = await getSession();
  
  const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
  authUrl.searchParams.set('client_id', process.env.META_APP_ID!);
  authUrl.searchParams.set('redirect_uri', `${process.env.APP_URL}/api/settings/whatsapp/callback`);
  authUrl.searchParams.set('state', session.user.org_id);
  authUrl.searchParams.set('scope', 'business_management,whatsapp_business_management,whatsapp_business_messaging');

  return redirect(authUrl.toString());
}

// Callback handles token exchange and WhatsApp Business Account selection
```

**Note:** WhatsApp OAuth is complex (requires Meta Business verification). 

**Alternative for V1:** Keep manual entry but improve UX:
```tsx
<Card>
  <CardHeader>
    <CardTitle>WhatsApp Business</CardTitle>
  </CardHeader>
  <CardContent>
    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription>
        Necesitarás tu Phone Number ID y Business Account ID de la{' '}
        <a href="https://business.facebook.com/" target="_blank" className="underline">
          Meta Business Suite
        </a>
      </AlertDescription>
    </Alert>
    
    <div className="space-y-4 mt-4">
      <Input
        label="Phone Number ID"
        placeholder="123456789012345"
        value={phoneNumberId}
        onChange={setPhoneNumberId}
      />
      <Input
        label="Business Account ID"
        placeholder="987654321098765"
        value={businessAccountId}
        onChange={setBusinessAccountId}
      />
      <Input
        label="Access Token"
        type="password"
        placeholder="EAAB..."
        value={accessToken}
        onChange={setAccessToken}
      />
      
      <Button onClick={saveWhatsAppCredentials}>
        Guardar Configuración
      </Button>
    </div>
  </CardContent>
</Card>
```

**Acceptance Criteria:**
- [ ] WhatsApp credentials saved securely (encrypted)
- [ ] Link to Meta Business Suite for guidance
- [ ] Validates credentials by making test API call
- [ ] Shows connection status

**Estimated Effort:** 1 day (manual) OR 3 days (full OAuth)

**Recommendation:** Start with manual (1 day), defer OAuth to V1.1

---

#### Task 4.1.3: Improve AFIP Certificate Upload UX
**Files to modify:**
- `apps/web/app/(dashboard)/settings/integrations/page.tsx`

**Better UI:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>AFIP - Facturación Electrónica</CardTitle>
  </CardHeader>
  <CardContent>
    <Tabs defaultValue="upload">
      <TabsList>
        <TabsTrigger value="upload">Subir Certificado</TabsTrigger>
        <TabsTrigger value="help">¿Cómo obtenerlo?</TabsTrigger>
      </TabsList>
      
      <TabsContent value="upload">
        <div className="space-y-4">
          <Input
            label="CUIT"
            placeholder="20-12345678-9"
            value={cuit}
            onChange={setCuit}
          />
          
          <div>
            <Label>Certificado (.p12 o .pfx)</Label>
            <FileUpload
              accept=".p12,.pfx"
              onFileSelect={handleCertificateUpload}
              maxSize={5 * 1024 * 1024} // 5MB
            />
          </div>
          
          <Input
            label="Contraseña del Certificado"
            type="password"
            value={password}
            onChange={setPassword}
          />
          
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Tu certificado y contraseña se almacenan encriptados y nunca se comparten.
            </AlertDescription>
          </Alert>
          
          <Button onClick={saveAFIPCredentials}>
            Guardar y Probar Conexión
          </Button>
        </div>
      </TabsContent>
      
      <TabsContent value="help">
        <div className="prose prose-sm">
          <h3>Cómo obtener tu certificado AFIP</h3>
          <ol>
            <li>Ingresa a <a href="https://auth.afip.gob.ar" target="_blank">AFIP con Clave Fiscal</a></li>
            <li>Ve a "Administrador de Relaciones de Clave Fiscal"</li>
            <li>Selecciona "Nueva Relación"</li>
            <li>Busca "Factura Electrónica - Servicio web" (WSFE)</li>
            <li>Genera el certificado (.p12)</li>
            <li>Guarda la contraseña que elijas</li>
            <li>Sube el certificado aquí</li>
          </ol>
          
          <p><strong>Video tutorial:</strong></p>
          <a href="https://youtube.com/..." target="_blank" className="text-blue-600 underline">
            Ver video paso a paso →
          </a>
        </div>
      </TabsContent>
    </Tabs>
  </CardContent>
</Card>
```

**Acceptance Criteria:**
- [ ] Clear instructions for obtaining certificate
- [ ] File upload with validation (.p12/.pfx only)
- [ ] Password field with encryption notice
- [ ] Test connection button verifies credentials
- [ ] Link to video tutorial

**Estimated Effort:** 1 day

---

**Sub-Phase 4.1 Total:** 4 days (if manual WhatsApp) OR 6 days (if OAuth)

**Recommendation:** Go with manual WhatsApp (4 days total) for V1

---

## Sub-Phase 4.2: Delete Obsolete Code
**Objective:** Remove dead `organizations.controller.ts`

### Tasks:

#### Task 4.2.1: Verify No References to Obsolete Controller
**Action Required:**
```bash
# Search for imports/references
grep -r "organizations.controller" src/
grep -r "src/api/public/v1/organizations" src/

# Should return zero results (already not routed)
```

**Acceptance Criteria:**
- [ ] No imports of obsolete controller
- [ ] No routes pointing to it
- [ ] Safe to delete

**Estimated Effort:** 0.5 days

---

#### Task 4.2.2: Delete Dead Code
**Files to delete:**
- `src/api/public/v1/organizations/organizations.controller.ts`

**Create PR with:**
- Clear commit message: "Remove obsolete organizations.controller.ts - superseded by Next.js API routes"
- Documentation update explaining new flow

**Acceptance Criteria:**
- [ ] File deleted
- [ ] No build errors
- [ ] Tests pass
- [ ] Documentation updated

**Estimated Effort:** 0.5 days

---

**Sub-Phase 4.2 Total:** 1 day

---

**Phase 4 Total Effort:** 5 days  
**Phase 4 Completion Criteria:**
- [ ] Mercado Pago OAuth working
- [ ] WhatsApp manual setup improved
- [ ] AFIP upload UX enhanced
- [ ] Dead code removed
- [ ] Onboarding < 10 minutes (target)

---

# PHASE 5: VOICE AI MIGRATION TO LANGGRAPH
**Duration:** 2-3 weeks (10-15 days)  
**Priority:** 🟡 MEDIUM (Architecture upgrade)

## Sub-Phase 5.1: Setup Python AI Service
**Objective:** Create FastAPI service with LangGraph

### Tasks:

#### Task 5.1.1: Initialize Python Service
**Files to create:**
- `services/ai/` (new directory)
- `services/ai/requirements.txt`
- `services/ai/main.py`
- `services/ai/Dockerfile`

**Project Structure:**
services/ai/
├── pyproject.toml
├── requirements.txt
├── Dockerfile
├── main.py (FastAPI entry point)
├── app/
│   ├── api/
│   │   └── voice.py (API routes)
│   ├── workflows/
│   │   └── voice_processing.py (LangGraph workflow)
│   ├── models/
│   │   └── schemas.py (Pydantic models)
│   └── integrations/
│       ├── whisper.py
│       ├── openai.py
│       └── postgres.py
└── tests/

**Dependencies:**
```txt
# requirements.txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
langgraph==0.0.25
langchain==0.1.0
openai==1.10.0
psycopg2-binary==2.9.9
pydantic==2.5.3
redis==5.0.1
python-dotenv==1.0.0
httpx==0.26.0
```

**Acceptance Criteria:**
- [ ] Python project initialized with Poetry or pip
- [ ] FastAPI server runs locally
- [ ] Dependencies installed
- [ ] Basic health endpoint works

**Estimated Effort:** 1 day

---

#### Task 5.1.2: Implement LangGraph Voice Workflow
**Files to create:**
- `services/ai/app/workflows/voice_processing.py`

**LangGraph Workflow:**
```python
# services/ai/app/workflows/voice_processing.py
from langgraph.graph import StateGraph, END
from typing import TypedDict, Literal
from datetime import datetime, timedelta

class VoiceProcessingState(TypedDict):
    message_id: str
    audio_url: str
    transcription: str | None
    extraction: dict | None
    confidence: float | None
    customer_phone: str
    conversation_history: list[dict]
    status: Literal['transcribing', 'extracting', 'confirming', 'completed', 'failed']
    confirmation_message_id: str | None
    
# Create graph
workflow = StateGraph(VoiceProcessingState)

# Node: Transcribe audio
async def transcribe(state: VoiceProcessingState):
    audio = await download_audio(state['audio_url'])
    text = await whisper_api.transcribe(audio, language='es')
    
    return {
        **state,
        'transcription': text,
        'status': 'extracting'
    }

# Node: Extract job data
async def extract(state: VoiceProcessingState):
    extraction = await openai_api.extract_job_data(
        transcription=state['transcription'],
        conversation_history=state['conversation_history']
    )
    
    return {
        **state,
        'extraction': extraction['fields'],
        'confidence': extraction['overall_confidence'],
        'status': 'routing'
    }

# Node: Route based on confidence
def route_confidence(state: VoiceProcessingState):
    if state['confidence'] >= 0.85:
        return 'auto_create'
    elif state['confidence'] >= 0.50:
        return 'confirm'
    else:
        return 'human_review'

# Node: Send confirmation
async def send_confirmation(state: VoiceProcessingState):
    message = format_confirmation_message(state['extraction'])
    
    msg_id = await whatsapp_api.send_message(
        to=state['customer_phone'],
        text=message
    )
    
    # Sleep waiting for reply (LangGraph handles this)
    reply = await wait_for_reply(
        phone=state['customer_phone'],
        timeout=timedelta(hours=2)
    )
    
    if reply and ('si' in reply.lower() or 'sí' in reply.lower()):
        return {**state, 'status': 'auto_create'}
    else:
        return {**state, 'status': 'human_review'}

# Node: Auto-create job
async def auto_create_job(state: VoiceProcessingState):
    job = await create_job_in_db(state['extraction'])
    
    await whatsapp_api.send_message(
        to=state['customer_phone'],
        text=f"✅ Trabajo creado: {job['title']}\nTe avisamos cuando asignemos un técnico."
    )
    
    return {**state, 'status': 'completed'}

# Node: Add to human review queue
async def add_to_review_queue(state: VoiceProcessingState):
    await db.voice_review_queue.insert({
        'message_id': state['message_id'],
        'transcription': state['transcription'],
        'extraction': state['extraction'],
        'confidence': state['confidence'],
        'status': 'pending_review'
    })
    
    await whatsapp_api.send_message(
        to=state['customer_phone'],
        text="Recibimos tu mensaje de voz. Un operador lo revisará pronto."
    )
    
    return {**state, 'status': 'human_review'}

# Build graph
workflow.add_node('transcribe', transcribe)
workflow.add_node('extract', extract)
workflow.add_node('confirm', send_confirmation)
workflow.add_node('auto_create', auto_create_job)
workflow.add_node('human_review', add_to_review_queue)

# Add edges
workflow.set_entry_point('transcribe')
workflow.add_edge('transcribe', 'extract')
workflow.add_conditional_edges(
    'extract',
    route_confidence,
    {
        'auto_create': 'auto_create',
        'confirm': 'confirm',
        'human_review': 'human_review'
    }
)
workflow.add_edge('auto_create', END)
workflow.add_edge('confirm', END)
workflow.add_edge('human_review', END)

# Compile
app = workflow.compile()
```

**Acceptance Criteria:**
- [ ] LangGraph workflow compiles
- [ ] Can process voice messages end-to-end
- [ ] Handles confirmation wait (sleep/resume)
- [ ] Routes based on confidence
- [ ] Creates jobs or adds to review queue

**Estimated Effort:** 4 days

---

#### Task 5.1.3: Create FastAPI Endpoints
**Files to create:**
- `services/ai/app/api/voice.py`

**API Endpoints:**
```python
# services/ai/app/api/voice.py
from fastapi import APIRouter, HTTPException
from app.workflows.voice_processing import app as workflow_app
from app.models.schemas import VoiceProcessingRequest

router = APIRouter()

@router.post("/voice/process")
async def process_voice_message(request: VoiceProcessingRequest):
    """
    Start voice processing workflow
    """
    try:
        result = await workflow_app.ainvoke({
            'message_id': request.message_id,
            'audio_url': request.audio_url,
            'customer_phone': request.customer_phone,
            'conversation_history': request.conversation_history or [],
            'status': 'transcribing'
        })
        
        return {
            'success': True,
            'status': result['status'],
            'confidence': result.get('confidence'),
            'job_id': result.get('job_id')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/voice/resume")
async def resume_workflow(workflow_id: str, customer_reply: str):
    """
    Resume workflow after customer reply
    """
    # LangGraph handles state persistence
    # This endpoint triggers resume from wait
    pass
```

**Acceptance Criteria:**
- [ ] API accepts voice processing requests
- [ ] Returns workflow status
- [ ] Handles errors gracefully
- [ ] Can resume workflows after waits

**Estimated Effort:** 1 day

---

#### Task 5.1.4: Integrate with Node.js Backend
**Files to modify:**
- `src/api/public/v1/whatsapp/webhook.controller.ts`

**Integration:**
```typescript
// When voice message received
async function onVoiceMessageReceived(message: WhatsAppMessage) {
  // Call Python AI service instead of Node.js processing
  const response = await fetch('http://ai-service:8000/voice/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message_id: message.wa_message_id,
      audio_url: message.media_url,
      customer_phone: message.from,
      conversation_history: await getConversationHistory(message.from)
    })
  });

  const result = await response.json();

  // Update message record with processing status
  await prisma.waMessage.update({
    where: { id: message.id },
    data: {
      transcription: result.transcription,
      extraction_data: result.extraction,
      extraction_confidence: result.confidence,
      status: result.status
    }
  });
}
```

**Acceptance Criteria:**
- [ ] Node.js backend calls Python service
- [ ] Handles service unavailable (fallback to old flow)
- [ ] Updates database with results
- [ ] Monitors service health

**Estimated Effort:** 1 day

---

#### Task 5.1.5: Deploy Python Service
**Files to create:**
- `services/ai/Dockerfile`
- `services/ai/.env.example`

**Dockerfile:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Deployment (Railway/Render):**
```bash
# Deploy to Railway
railway up

# Or Render
render deploy
```

**Acceptance Criteria:**
- [ ] Python service deployed
- [ ] Accessible from Node.js backend
- [ ] Environment variables configured
- [ ] Health checks passing
- [ ] Logs visible in dashboard

**Estimated Effort:** 2 days

---

#### Task 5.1.6: Monitor and Optimize
**Files to create:**
- `services/ai/app/middleware/monitoring.py`

**LangSmith Integration:**
```python
# services/ai/app/middleware/monitoring.py
from langsmith import Client
from langsmith.run_helpers import traceable

langsmith_client = Client(api_key=os.getenv('LANGSMITH_API_KEY'))

@traceable(run_type="workflow", name="voice_processing")
async def process_voice_workflow(state):
    # LangGraph automatically logs to LangSmith
    # Every step traced
    pass
```

**Acceptance Criteria:**
- [ ] All workflows traced in LangSmith
- [ ] Can debug failed workflows
- [ ] Confidence scores logged
- [ ] Performance metrics tracked

**Estimated Effort:** 1 day

---

**Sub-Phase 5.1 Total:** 10 days

---

## Sub-Phase 5.2: Gradual Migration Strategy
**Objective:** Migrate smoothly without breaking existing flow

### Tasks:

#### Task 5.2.1: Feature Flag for Voice AI V2
**Files to modify:**
- `core/config/capabilities.ts`

**Add Feature Flag:**
```typescript
// core/config/capabilities.ts
export const CAPABILITIES = {
  // ... existing capabilities
  
  voice_ai_v2_langgraph: {
    id: 'voice_ai_v2_langgraph',
    name: 'Voice AI V2 (LangGraph)',
    description: 'Use stateful LangGraph workflow for voice processing',
    category: 'ai',
    enabled: false, // Start disabled
    per_org_override: true, // Enable for beta orgs
    fallback_behavior: 'Use V1 (Node.js) voice processing'
  }
};
```

**Rollout Strategy:**
Week 1: Enable for 1 beta org (your own)
Week 2: Enable for 5 friendly orgs
Week 3: Enable for 25% of orgs
Week 4: Enable for 50% of orgs
Week 5: Enable for 100% of orgs
Week 6: Remove V1 code

**Acceptance Criteria:**
- [ ] Feature flag controls which voice AI is used
- [ ] Can toggle per org
- [ ] Falls back to V1 if V2 unavailable
- [ ] Clear logging which version processed each message

**Estimated Effort:** 0.5 days

---

#### Task 5.2.2: A/B Test V1 vs V2
**Files to create:**
- `apps/web/lib/analytics/voice-ai-comparison.ts`

**Track Metrics:**
```typescript
export interface VoiceAIMetrics {
  version: 'v1' | 'v2';
  accuracy: number; // % of jobs created without correction
  processing_time: number; // seconds
  confirmation_rate: number; // % that needed confirmation
  human_review_rate: number; // % sent to human review
  customer_satisfaction: number; // from ratings
}

// Compare V1 vs V2 weekly
async function compareVersions() {
  const v1Metrics = await getMetrics('v1', last7Days);
  const v2Metrics = await getMetrics('v2', last7Days);
  
  console.log({
    accuracy_improvement: v2Metrics.accuracy - v1Metrics.accuracy,
    speed_improvement: v1Metrics.processing_time - v2Metrics.processing_time,
    confidence_improvement: v1Metrics.confirmation_rate - v2Metrics.confirmation_rate
  });
}
```

**Acceptance Criteria:**
- [ ] Side-by-side metrics dashboard
- [ ] Clear winner determination criteria
- [ ] Can make data-driven decision on full migration

**Estimated Effort:** 1 day

---

#### Task 5.2.3: Remove V1 Code (After V2 Proven)
**Action Required (After successful rollout):**

**Files to remove/modify:**
- Remove `src/workers/voice/voice-processing.worker.ts` (old Node.js worker)
- Remove V1-specific code from `VoiceAIService`
- Update docs to reference V2 only

**Acceptance Criteria:**
- [ ] V2 proven stable (>90% uptime, accuracy > V1)
- [ ] All orgs migrated
- [ ] V1 code removed
- [ ] No regressions

**Estimated Effort:** 1 day

---

**Sub-Phase 5.2 Total:** 2.5 days

---

**Phase 5 Total Effort:** 12.5 days  
**Phase 5 Completion Criteria:**
- [ ] Python AI service deployed
- [ ] LangGraph workflow working
- [ ] Integrated with Node.js backend
- [ ] Feature flag controls rollout
- [ ] V2 metrics tracked and improving
- [ ] V1 code removed after successful migration

---

# IMPLEMENTATION TIMELINE

## Gantt Chart (8-10 weeks)
Week 1-2: Phase 1 (Security & Infrastructure)
├─ AFIP encryption fix (1d)
├─ RBAC - DISPATCHER role (2d)
├─ Distributed locks validation (1d)
└─ Phase 1 complete ✓
Week 3-5: Phase 2 (Core Features)
├─ Vehicle scheduling (6d)
├─ Inventory cascade (3d)
├─ Multi-stop navigation (5d)
└─ Phase 2 complete ✓
Week 6: Phase 3 (WhatsApp)
├─ Interactive messages (3d)
├─ Attribution tracking (3d)
└─ Phase 3 complete ✓
Week 7: Phase 4 (Onboarding)
├─ MP OAuth (2d)
├─ WhatsApp setup UX (1d)
├─ AFIP upload UX (1d)
└─ Phase 4 complete ✓
Week 8-10: Phase 5 (Voice AI)
├─ Python service setup (1d)
├─ LangGraph workflow (4d)
├─ FastAPI endpoints (1d)
├─ Node.js integration (1d)
├─ Deployment (2d)
├─ Gradual rollout (2.5d)
└─ Phase 5 complete ✓

---

# MANUAL INSTRUCTIONS (PLAIN LANGUAGE)

## How to Execute This Plan

### Step 1: Start with Security Fixes (Week 1)

**What you need to do:**

1. **Fix AFIP Encryption:**
   - Open `apps/web/app/api/settings/afip/route.ts`
   - You'll see AFIP credentials stored in `settings` JSONB
   - Create new file `apps/web/lib/services/afip-credentials.service.ts`
   - Copy the encryption code I provided above
   - Create database migration to add encrypted columns
   - Run migration: `npx prisma migrate dev --name add_afip_encryption`
   - Update all code that reads AFIP credentials to use new service
   - Test by requesting a CAE - should still work

2. **Add DISPATCHER Role:**
   - Open `prisma/schema.prisma`
   - Find `enum UserRole`
   - Add `DISPATCHER` to the list
   - Run `npx prisma generate`
   - Create migration: `npx prisma migrate dev --name add_dispatcher_role`
   - Find all `ADMIN` users in database, change them to `DISPATCHER`
   - Open permission files (look for `hasPermission` functions)
   - Add rules: DISPATCHER can't access billing/subscription
   - Test: Log in as DISPATCHER, try to access `/settings/billing` - should be blocked

3. **Test Distributed Locks:**
   - Already implemented, just verify it works
   - Create test script that creates 100 invoices simultaneously
   - Check database - no duplicate invoice numbers = ✅
   - If you find duplicates, we have a problem

### Step 2: Build Core Features (Week 3-5)

**Vehicle Scheduling:**

1. Create database table (copy SQL from above)
2. Run migration
3. Create new file `apps/web/lib/services/vehicle-schedule.service.ts`
4. Copy service code from above
5. Create API routes in `apps/web/app/api/scheduling/`
6. Create UI page at `apps/web/app/(dashboard)/team/[userId]/vehicle-schedule/page.tsx`
7. Test: Assign vehicle to technician for "Mon-Fri 8am-5pm", create job on Monday - vehicle should auto-populate

**Inventory Cascade:**

1. Open `apps/web/app/api/inventory/job-materials/route.ts`
2. Replace manual selection with cascade logic (code provided above)
3. Update mobile app to not require source selection
4. Test: Technician uses 5 screws, vehicle has 3, warehouse has 10 - should deduct 3 from vehicle, 2 from warehouse

**Multi-Stop Navigation:**

1. Get Google Maps API key (instructions above)
2. Create `apps/web/lib/services/route-generation.service.ts`
3. Copy route generation code
4. Create database table for routes
5. Wire up to job creation/completion
6. Test: Create 12 jobs for technician - should generate 2 route URLs (10 + 2)

### Step 3: Wire WhatsApp Features (Week 6)

**Interactive Messages:**

1. Find `src/ai/workflows/booking.workflow.ts` (or similar)
2. Replace `sendTemplate` calls with `sendInteractiveButtonMessage`
3. Add button click handler
4. Test: Customer gets buttons instead of text, clicks button, job created

**Attribution Tracking:**

1. Create database table (SQL provided)
2. Create redirect endpoint `apps/web/app/wa-redirect/[slug]/route.ts`
3. Update marketplace to link to `/wa-redirect/business-slug` instead of direct WhatsApp
4. Create attribution dashboard page
5. Test: Click WhatsApp from marketplace, create job within 1 hour - should be attributed

### Step 4: Improve Onboarding (Week 7)

**Mercado Pago OAuth:**

1. Go to Mercado Pago developer portal
2. Get client ID + secret
3. Create OAuth routes (code provided above)
4. Add "Connect with Mercado Pago" button to UI
5. Test: Click button, authorize in MP, tokens saved encrypted

**AFIP Upload UX:**

1. Create better UI with tabs (code provided)
2. Add file upload component
3. Add "How to get certificate" instructions
4. Test: Upload .p12 file, save, request CAE - should work

### Step 5: Migrate to LangGraph (Week 8-10)

**Python Service:**

1. Create new directory: `services/ai/`
2. Initialize Python project: `poetry init` or `pip install -r requirements.txt`
3. Copy LangGraph workflow code
4. Create FastAPI endpoints
5. Build Docker image
6. Deploy to Railway/Render
7. Update Node.js WhatsApp webhook to call Python service
8. Enable for 1 org first (yours)
9. Monitor metrics
10. Gradually roll out to all orgs
11. Remove old Node.js voice worker

---

## Testing Checklist

After each phase, test these scenarios:

### Phase 1 Tests:
- [ ] Create invoice - CAE received, credentials encrypted
- [ ] DISPATCHER can't access billing page
- [ ] 100 concurrent invoices = no duplicates

### Phase 2 Tests:
- [ ] Assign vehicle to tech Mon-Fri, create Mon job - vehicle pre-filled
- [ ] Tech uses 10 screws, vehicle has 5 - deducts 5 from vehicle, 5 from warehouse
- [ ] Tech has 15 jobs today - gets 2 route URLs (10 + 5), after 10th job gets notification

### Phase 3 Tests:
- [ ] Customer receives buttons in WhatsApp, clicks, job created
- [ ] Click WhatsApp from marketplace, create job - attributed in dashboard

### Phase 4 Tests:
- [ ] Click "Connect MP", authorize, tokens saved
- [ ] Upload AFIP cert, password, save - CAE request works

### Phase 5 Tests:
- [ ] Voice message processed by Python service
- [ ] Confirmation sent, customer replies "si", job created
- [ ] Low confidence message goes to review queue

---

## Deployment Checklist

Before launching each phase to production:

- [ ] All tests passing
- [ ] Code reviewed
- [ ] Database migrations tested on staging
- [ ] Feature flags configured
- [ ] Monitoring dashboards show green
- [ ] Rollback plan documented
- [ ] Team trained on new features

---

# SUCCESS METRICS

## Phase 1 (Security):
- [ ] Zero AFIP credentials in plain text
- [ ] Zero duplicate invoices in production
- [ ] DISPATCHER role enforced (no billing access)

## Phase 2 (Core Features):
- [ ] 90%+ of jobs auto-populate vehicle
- [ ] Zero inventory errors from cascade logic
- [ ] 95%+ of technicians use navigation routes

## Phase 3 (WhatsApp):
- [ ] 50%+ of customers use interactive buttons
- [ ] 20%+ conversion rate (marketplace clicks → jobs)

## Phase 4 (Onboarding):

 MP OAuth adoption: 80%+ use OAuth vs manual
 Average onboarding time < 10 minutes
 Zero failed AFIP certificate uploads

## Phase 5 (Voice AI):

 Voice AI accuracy > 80% (up from 70%)
 50%+ reduction in human review queue
 Zero downtime during migration


RISK MITIGATION
Technical Risks
Risk 1: Google Maps API Costs
Impact: High usage = high costs
Mitigation:

Set daily quota limits ($50/day)
Cache routes for same-day requests
Monitor costs daily
Alert at 80% of budget

Risk 2: LangGraph Learning Curve
Impact: Phase 5 takes longer than estimated
Mitigation:

Keep V1 running in parallel
Feature flag controls rollout
Can pause migration if issues arise
2.5 days buffer in timeline

Risk 3: Database Migration Failures
Impact: Downtime during AFIP encryption migration
Mitigation:

Test migration on staging 3 times
Backup production before migration
Run migration during low-traffic hours (2am-4am)
Have rollback script ready

Risk 4: WhatsApp Rate Limits
Impact: Interactive messages hit rate limits
Mitigation:

Monitor message volume
Queue messages if approaching limit
Fall back to templates if interactive fails
Alert at 80% of limit


Business Risks
Risk 1: User Confusion with New Features
Impact: Support tickets increase
Mitigation:

In-app tooltips for new features
Video tutorials
Gradual rollout (10% → 50% → 100%)
Email announcement before launch

Risk 2: Marketplace Attribution Privacy Concerns
Impact: Users uncomfortable with click tracking
Mitigation:

Clear privacy policy
Anonymous tracking (no personal data)
Opt-out option for businesses
Transparent about what's tracked

Risk 3: OAuth Setup Complexity
Impact: Businesses struggle with MP OAuth
Mitigation:

Keep manual option available
Step-by-step video tutorial
Live chat support during setup
Fall back to manual if OAuth fails


ROLLBACK PROCEDURES
Phase 1 Rollback (Security):
bash# If AFIP encryption breaks:
1. Revert migration: npx prisma migrate rollback
2. Revert code: git revert <commit>
3. Deploy previous version
4. Test CAE request
5. Decrypt any encrypted data if needed
Phase 2 Rollback (Core Features):
bash# If vehicle scheduling breaks:
1. Disable feature flag: CAPABILITY_VEHICLE_SCHEDULING=false
2. Jobs revert to manual vehicle selection
3. Fix issues
4. Re-enable flag

# If navigation breaks:
1. Google Maps API unavailable = graceful degradation
2. Show job addresses without routes
3. Technicians navigate manually
Phase 3 Rollback (WhatsApp):
bash# If interactive messages fail:
1. Feature flag: CAPABILITY_WHATSAPP_INTERACTIVE=false
2. Falls back to template messages
3. No user impact

# If attribution breaks:
1. Redirect endpoint returns 500 = direct WhatsApp link
2. No click tracking but WhatsApp still works
Phase 5 Rollback (Voice AI):
bash# If LangGraph service down:
1. Node.js webhook detects Python service unavailable
2. Falls back to V1 (Node.js) voice processing
3. No user-facing errors
4. Alert sent to admin

# If V2 accuracy worse than V1:
1. Disable feature flag per org
2. Compare metrics
3. Fix prompt/workflow
4. Re-enable when improved
```

---

# COMMUNICATION PLAN

## Internal Team Communication

### Weekly Stand-ups:
- **Monday:** Review last week, plan current week
- **Wednesday:** Mid-week check-in, blockers
- **Friday:** Demo completed features, retrospective

### Slack Channels:
- `#dev-implementation` - Development updates
- `#production-alerts` - Production issues
- `#feature-launches` - New feature announcements

---

## External (User) Communication

### Phase 1 (Security):
**No announcement** - Backend improvements, users won't notice

### Phase 2 (Core Features):
**Email to all businesses:**
```
Subject: 🚀 Nuevas funciones: Programación de vehículos y navegación

Hola [Name],

Estamos emocionados de anunciar nuevas funciones en CampoTech:

✅ Programación Inteligente de Vehículos
   Ahora podés asignar vehículos a técnicos por día/horario.
   
✅ Navegación Multi-Parada
   Tus técnicos reciben rutas optimizadas con Google Maps.
   
✅ Gestión Automática de Inventario
   El sistema deduce automáticamente desde el vehículo o depósito.

📹 Video Tutorial: [link]
📖 Guía Completa: [link]

¿Preguntas? Respondé este email o chateanos en la app.

Equipo CampoTech
```

### Phase 3 (WhatsApp):
**In-app banner:**
```
🎉 Nuevo: Botones Interactivos en WhatsApp
Tus clientes ahora pueden agendar con un toque.
[Ver Demo →]
```

### Phase 4 (Onboarding):
**Email to new signups:**
```
Subject: Conectá Mercado Pago en 2 clicks

Hola [Name],

¡Buenas noticias! Ahora podés conectar Mercado Pago con un solo click.

[Conectar Mercado Pago →]

Sin más copiar y pegar tokens. Seguro y rápido.
```

### Phase 5 (Voice AI):
**No announcement initially** - Gradual rollout, monitor silently

**After successful rollout:**
```
Subject: 📣 Mejoras en el Asistente de Voz

Hola [Name],

Mejoramos nuestro asistente de voz:
- 80% de precisión (antes 70%)
- Maneja conversaciones complejas
- Confirma automáticamente con clientes

No necesitás hacer nada, ya está activo.

APPENDIX A: TECH STACK SUMMARY
Frontend

Web: Next.js 14 (App Router), React, TypeScript, TailwindCSS
Mobile: React Native (Expo), TypeScript, WatermelonDB

Backend

API: Node.js, TypeScript, Express (v1 routes) + Next.js API (dashboard)
AI Service: Python 3.11, FastAPI, LangGraph, LangChain

Database & Storage

Primary: PostgreSQL (via Supabase/Prisma)
Cache: Redis (Upstash)
Queue: BullMQ (Redis-backed)
Storage: Supabase Storage

External Services

AFIP: WSAA, WSFEv1, WS_SR_PADRON (SOAP)
Mercado Pago: Preferences, Webhooks, OAuth
WhatsApp: Cloud API (via Dialog360)
OpenAI: Whisper (transcription), GPT-4 (extraction)
Google Maps: Directions, Distance Matrix, Geocoding

Infrastructure

Web Hosting: Vercel
Workers: Railway or Render
AI Service: Railway or Render
CI/CD: GitHub Actions
Monitoring: Sentry, LangSmith (for AI)


APPENDIX B: ENVIRONMENT VARIABLES
Required Environment Variables
bash# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Authentication
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://app.campotech.com

# AFIP
AFIP_ENVIRONMENT=production  # or 'homologation'
AFIP_WSAA_URL=https://wsaa.afip.gov.ar/ws/services/LoginCms
AFIP_WSFE_URL=https://servicios1.afip.gov.ar/wsfev1/service.asmx

# Mercado Pago
MP_CLIENT_ID=...
MP_CLIENT_SECRET=...
MP_PUBLIC_KEY=...
MP_WEBHOOK_SECRET=...

# WhatsApp
WA_PHONE_NUMBER_ID=...
WA_BUSINESS_ACCOUNT_ID=...
WA_ACCESS_TOKEN=...
WA_VERIFY_TOKEN=...

# OpenAI
OPENAI_API_KEY=...

# Google Maps
GOOGLE_MAPS_SERVER_KEY=...
GOOGLE_MAPS_CLIENT_KEY=...

# Python AI Service
AI_SERVICE_URL=https://ai.campotech.com
AI_SERVICE_API_KEY=...

# LangSmith (AI monitoring)
LANGSMITH_API_KEY=...
LANGSMITH_PROJECT=campotech-production

# Feature Flags
CAPABILITY_VOICE_AI_V2_LANGGRAPH=false
CAPABILITY_VEHICLE_SCHEDULING=true
CAPABILITY_INTERACTIVE_MESSAGES=true

# Encryption
ENCRYPTION_KEY=... # 32-byte hex string

APPENDIX C: DATABASE SCHEMA ADDITIONS
New Tables (Create these migrations)
sql-- 1. Vehicle Schedules
CREATE TABLE vehicle_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('permanent', 'date_range', 'recurring')),
  start_date DATE,
  end_date DATE,
  days_of_week INTEGER[],
  time_start TIME,
  time_end TIME,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Technician Routes
CREATE TABLE technician_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  technician_id UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  segment_number INTEGER NOT NULL,
  job_ids UUID[] NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  waypoints TEXT[],
  optimized_order INTEGER[],
  route_url TEXT NOT NULL,
  distance_meters INTEGER,
  duration_seconds INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(technician_id, date, segment_number)
);

-- 3. Marketplace Clicks
CREATE TABLE marketplace_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES organizations(id),
  business_slug TEXT NOT NULL,
  consumer_ip TEXT,
  consumer_fingerprint TEXT,
  consumer_user_agent TEXT,
  source TEXT,
  referrer TEXT,
  converted_job_id UUID REFERENCES jobs(id),
  converted_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AFIP Encrypted Fields
ALTER TABLE organizations 
  ADD COLUMN afip_cuit TEXT,
  ADD COLUMN afip_certificate_encrypted TEXT,
  ADD COLUMN afip_password_encrypted TEXT,
  ADD COLUMN afip_connected_at TIMESTAMPTZ;

-- 5. Add DISPATCHER Role
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DISPATCHER';

CONCLUSION
This roadmap provides a complete, actionable plan to finish CampoTech V1.
Key Points:

70% done - Most infrastructure exists
8-10 weeks to complete remaining features
Phased approach - Can launch after Phase 1-3 (5 weeks)
Risk mitigation - Rollback plans, feature flags, gradual rollouts
Clear metrics - Know when each phase succeeds

Next Steps:

Review this plan with your team
Adjust timeline if needed
Start Phase 1 (Security) immediately
Set up project management board (GitHub Projects, Linear, etc.)
Begin weekly stand-ups
Execute! 🚀

Questions to Answer Before Starting:

Do you have a developer to help, or are you coding this yourself?
What's your target launch date for V1?
Any features you want to deprioritize or remove?
Budget confirmed for Google Maps API costs?
Meta Business account ready for WhatsApp OAuth (or stick with manual)?