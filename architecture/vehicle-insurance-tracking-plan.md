# Vehicle & Insurance Tracking Implementation Plan

**Created:** 2026-01-10
**Status:** Phases 1-4 Complete, Phase 5 Pending

---

## Overview

This plan implements comprehensive vehicle and driver tracking for insurance claims, compliance, and fleet management. The goal is to create an immutable audit trail of which vehicle and driver were used for each job.

---

## Phase 1: Schema & Basic UI ✅ COMPLETE

### 1.1 Database Schema Changes
- [x] Add driver's license fields to `User` model
  - `driverLicenseNumber`
  - `driverLicenseExpiry`
  - `driverLicenseCategory`
- [x] Add vehicle/driver audit trail to `Job` model
  - `vehicleId` (relation to Vehicle)
  - `vehiclePlateAtJob` (snapshot)
  - `driverNameAtJob` (snapshot)
  - `driverLicenseAtJob` (snapshot)
  - `vehicleMileageStart`
  - `vehicleMileageEnd`
- [x] Add bidirectional relations (Vehicle ↔ Job)

### 1.2 Team Management UI
- [x] Add driver's license section to `TeamMemberModal`
- [x] Update API endpoints to handle license fields
- [x] Add soft warning for missing license

### 1.3 Vehicle Creation
- [x] Add driver assignment during vehicle creation
- [x] Fix empty driver list in new vehicle form

### 1.4 Unified Vehicle Modal
- [x] Rewrite `VehicleDetailModal` with comprehensive info
- [x] Add inline driver assignment/removal
- [x] Add VIN, notes, registration expiry display

---

## Phase 2: Job-Vehicle Integration ✅ COMPLETE

### 2.1 Vehicle Selection in Job Creation
**Files:**
- `app/dashboard/jobs/new/page.tsx`
- `app/api/jobs/route.ts`
- `src/services/job.service.ts`

**Tasks:**
- [x] Add vehicle dropdown to job creation form (via VehicleSuggestionInline component)
- [x] Auto-populate driver based on vehicle's primary driver (useVehicleSuggestion hook)
- [x] Filter vehicles by organization (automatic via session)
- [x] Show vehicle status indicator (active/maintenance)
- [x] Pass vehicleId to API on job creation

### 2.2 Vehicle Assignment on Job Edit
**Files:**
- `app/dashboard/jobs/[id]/page.tsx`
- `app/api/jobs/[id]/route.ts`
- `types/index.ts`

**Tasks:**
- [x] Add vehicle selector to job detail page sidebar
- [x] Allow changing vehicle before job starts
- [x] Lock vehicle change after job starts (soft lock with warning)
- [x] Show mileage tracking info when available

### 2.3 Mileage Input at Job Start
**Files:**
- `app/api/jobs/[id]/start/route.ts` (NEW)
- `src/services/job.service.ts`

**Tasks:**
- [x] Create /api/jobs/[id]/start endpoint
- [x] Allow technician to input actual starting mileage
- [x] Validate mileage is >= vehicle's recorded mileage
- [x] Auto-update vehicle's `currentMileage` if higher
- [x] Store mileage in job record


---

## Phase 3: Job Completion Snapshot ✅ COMPLETE

### 3.1 Snapshot Logic at Completion
**Files:**
- `app/api/jobs/[id]/complete/route.ts` (NEW)
- `lib/services/job-completion.ts` (NEW)

**Tasks:**
- [x] Create service function `snapshotVehicleDriver(jobId)`
- [x] Create service function `completeJobWithSnapshot()` with full snapshot logic
- [x] Copy vehicle plate number to `vehiclePlateAtJob`
- [x] Copy driver name to `driverNameAtJob`
- [x] Copy driver license to `driverLicenseAtJob`
- [x] Require end mileage input (validated in API)
- [x] Calculate trip distance (`vehicleMileageEnd - vehicleMileageStart`)
- [x] Update vehicle's `currentMileage` to end mileage
- [x] Validate mileage >= start mileage
- [x] Check for expired driver's license and warn
- [x] Generate customer rating token

### 3.2 Completion UI
**Files:**
- `app/dashboard/jobs/[id]/page.tsx` (updated with modal)
- `components/jobs/CompletionForm.tsx` (NEW)

**Tasks:**
- [x] Add mileage end input field with minimum validation
- [x] Show calculated trip distance with visual feedback
- [x] Show warning if mileage seems unusual (> 500km or negative)
- [x] Show preview of snapshot data before completing
- [x] Confirm warnings before completing (skipWarnings flow)
- [x] Integrated into job detail page as modal

---

## Phase 4: Reporting & Compliance ✅ COMPLETE

### 4.1 Vehicle Job History
**Files:**
- `app/dashboard/fleet/[id]/page.tsx` (updated with Jobs tab)
- `app/api/vehicles/[id]/jobs/route.ts` (NEW)

**Tasks:**
- [x] Add "Historial de Trabajos" tab to vehicle detail page
- [x] Show list of jobs with date, customer, technician, mileage
- [x] Calculate total kilometers driven (summary stats)
- [x] Display job status with color coding
- [x] Link to job detail pages

### 4.2 Driver Job History
**Files:**
- `app/api/users/[id]/vehicles/route.ts` (NEW)

**Tasks:**
- [x] Create API endpoint for vehicle usage by driver
- [x] Show which vehicles they've used
- [x] Show total jobs per vehicle with mileage stats
- [x] Calculate overall totals (jobs, km, vehicles used)
- [ ] UI in team page (deferred - API ready)

### 4.3 Insurance Report Generator
**Status:** Core functionality is now available through the vehicle job history tab, which provides:
- Vehicle details (plate, make/model)
- Driver details (name, from snapshot)
- Job details (date, customer, mileage)
- Total kilometers driven

**Deferred to future:**
- [ ] Dedicated reports page with PDF export
- [ ] Date range filtering UI
- [ ] Digital signature timestamp


---

## Phase 5: Compliance Alerts 🚨

### 5.1 Driver License Expiry Tracking
**Files:**
- `lib/services/compliance-check.ts`
- `app/api/cron/compliance/route.ts`

**Tasks:**
- [ ] Check for expiring licenses (30-day warning)
- [ ] Block vehicle assignment for expired licenses
- [ ] Send notification to OWNER/DISPATCHER

### 5.2 Vehicle-Driver Mismatch Alerts
**Tasks:**
- [ ] Alert if job assigned to technician without license
- [ ] Soft warning (not blocking) since many drive without documentation
- [ ] Log for audit purposes

---

## Data Flow Diagram

```
┌─────────────────┐
│  Job Creation   │
│  + vehicleId    │
│  + auto-driver  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Job Start     │
│ + mileageStart  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Job Complete   │ ──► Snapshot frozen:
│  + mileageEnd   │     - vehiclePlateAtJob
│                 │     - driverNameAtJob
│                 │     - driverLicenseAtJob
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Vehicle Updated │
│ currentMileage  │
└─────────────────┘
```

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/jobs` | POST | Create job with vehicleId |
| `/api/jobs/[id]` | PUT | Update job with vehicle |
| `/api/jobs/[id]/start` | POST | Record starting mileage |
| `/api/jobs/[id]/complete` | POST | Snapshot + record end mileage |
| `/api/vehicles/[id]/jobs` | GET | Job history for vehicle |
| `/api/users/[id]/vehicles` | GET | Vehicle usage for employee |
| `/api/reports/insurance` | POST | Generate insurance report |

---

## Migration Required

```bash
npx prisma migrate dev --name add_driver_license_and_vehicle_job_tracking
```

This migration adds:
- 3 columns to `users` table (driver license fields)
- 6 columns to `jobs` table (vehicle audit trail)
- 1 foreign key constraint (job → vehicle)
- 1 index on `jobs.vehicleId`

---

## Estimated Timeline

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1 | ✅ Done | - |
| Phase 2 | ✅ Done | Phase 1, Migration |
| Phase 3 | ✅ Done | Phase 2 |
| Phase 4 | ✅ Done | Phase 3 |
| Phase 5 | 2-3 hours | Phase 1 |

**Total remaining:** ~2-3 hours

---

## Notes

### Insurance Claim Use Case
When an accident occurs:
1. Go to Vehicle → Job History
2. Find job on accident date
3. Export includes:
   - Vehicle plate (frozen at job time)
   - Driver name (frozen at job time)
   - Driver license number (frozen at job time)
   - Mileage at start/end of job
   - Job location and time

### Why Snapshots?
- Drivers may change vehicles
- Vehicle plates may be updated
- Drivers may renew licenses with new numbers
- Snapshot preserves the **exact state at job completion** for legal/insurance purposes
