# CampoTech Complete Implementation Roadmap

## Detailed Phase-by-Phase Build Guide

**Version:** 2.0 (Corrected)
**Purpose:** Step-by-step implementation guide for AI assistant and human developer
**Scale Target:** 100,000 businesses / 500,000 users

---

## 🔑 KEY CORRECTIONS FROM VISION

| Aspect | WRONG | CORRECT |
|--------|-------|---------|
| Mobile Apps | 2 apps (Business + Employee) | **1 app** with role-based access |
| Web Apps | Landing + Dashboard separate | **1 app** (apps/web) does both |
| Consumer Web | Separate marketplace website | **NO consumer web** - mobile only |
| Marketplace | Optional for businesses | **MANDATORY** - all businesses listed |
| Roles | 6 roles | **3 roles**: Owner, Despachador, Técnico |
| Pricing | $0, $12, $18, $25 | **$0, $25, $55, $120** |

---

## 📱 THE APPLICATIONS (Corrected)

| # | App | Type | Description |
|---|-----|------|-------------|
| 1 | **apps/web** | Next.js | Landing page (/) + Business Dashboard (/dashboard) |
| 2 | **apps/mobile** | React Native | ONE app for Owner, Despachador, AND Técnico |
| 3 | **apps/consumer-mobile** | React Native | Consumer marketplace (mobile only) |
| 4 | **apps/admin** | Next.js | CampoTech internal admin (your dashboard) |

**Note:** No `apps/marketplace` web app. Consumers use mobile app only.

---

## 👤 USER ROLES (Corrected to 3)

| Role | Spanish | Access |
|------|---------|--------|
| **Owner** | Dueño | Full access: billing, team, settings, all features |
| **Despachador** | Despachador | Jobs, scheduling, customers, WhatsApp, inventory (NO billing) |
| **Técnico** | Técnico | Their assigned jobs only, inventory usage, voice reports |

---

## 📂 EXISTING CODEBASE STATUS

Based on APPS-WEB-CORRECTIONS.md:

### ✅ Already Built (apps/web)

```
├── Authentication (login, signup, OTP)
├── Dashboard home
├── Jobs management
├── Customers
├── Invoices + AFIP integration
├── Inventory
├── Fleet/Vehicles
├── Calendar
├── WhatsApp integration
├── Analytics
├── Settings
├── Tracking page (/track/[token])
├── Tier system
├── Feature flags
└── Role system (needs simplification)
```

### ❌ Needs Creation

```
├── Landing page (/) with pricing
├── Rating page (/rate/[token])
├── Employee scheduling/availability
├── PDF watermark ("Powered by CampoTech")
├── Market position dashboard
├── Voice reports API
├── Mobile app (apps/mobile)
├── Consumer app (apps/consumer-mobile)
└── Admin dashboard (apps/admin)
```

---

# PHASE 1: Foundation & Existing Code Fixes

**Plain Language:** Before building new stuff, we need to fix what exists and set up proper testing so we don't break things later.

**Duration:** 2-3 weeks
**Priority:** CRITICAL - blocks everything else

---

## Phase 1.1: Landing Page Creation

**What this does:** Creates the public-facing homepage at `/` that shows CampoTech's value proposition and pricing tiers. Currently, going to `/` gives a 404.

### Task 1.1.1: Create Landing Page

**File to create:** `apps/web/app/page.tsx`

**For AI:** Create a Next.js page component with:
- Hero section with headline "Organizá tu negocio de servicios como un profesional"
- Feature highlights (Jobs, Invoicing, WhatsApp AI, Inventory, Analytics)
- Pricing section with 3 tiers (see below)
- "Comenzar" button → `/signup`
- "Iniciar Sesión" button → `/login`
- Footer with legal links

**Pricing to display:**
```
Inicial: $25/mes
- 1 usuario
- 50 trabajos/mes
- App técnico
- Facturación AFIP
- Inventario básico
- WhatsApp manual

Profesional: $55/mes
- 5 usuarios
- 200 trabajos/mes
- WhatsApp + AI (100 conv/mes)
- Reportes de voz
- Analytics básico

Empresa: $120/mes
- Usuarios ilimitados
- Trabajos ilimitados
- WhatsApp + AI ilimitado
- Analytics avanzado
```

**Test (AI):** Run `npm run dev`, visit `http://localhost:3000/`, verify page renders without errors

**Test (Manual - Kevin):**
1. Open browser to localhost:3000
2. Verify you see the landing page, not a 404
3. Click "Comenzar" → should go to /signup
4. Click "Iniciar Sesión" → should go to /login

---

### Task 1.1.2: Update Navigation Header

**File to modify:** `apps/web/components/layout/header.tsx` (or similar)

**For AI:** Add conditional rendering:
- If user is NOT logged in: Show "Iniciar Sesión" and "Comenzar" buttons
- If user IS logged in: Show user menu and link to /dashboard

**Test (AI):** Verify header renders correctly for both states

---

## Phase 1.2: Fix Tier Pricing

**What this does:** Updates the hardcoded pricing values that are currently wrong ($12/$18/$25 → $25/$55/$120).

### Task 1.2.1: Update Tier Configuration

**File to modify:** `apps/web/lib/config/tier-limits.ts`

**For AI:** Find and replace these values:

```typescript
// FIND (around lines 60-124):
FREE: { priceUsd: 0, priceDisplay: 'Gratis' }
BASICO: { priceUsd: 12, priceDisplay: '$12/mes' }
PROFESIONAL: { priceUsd: 18, priceDisplay: '$18/mes' }
EMPRESARIAL: { priceUsd: 25, priceDisplay: '$25/mes' }

// REPLACE WITH:
FREE: { priceUsd: 0, priceDisplay: 'Gratis' }
BASICO: { priceUsd: 25, priceDisplay: '$25/mes' }        // Renamed to "Inicial"
PROFESIONAL: { priceUsd: 55, priceDisplay: '$55/mes' }
EMPRESARIAL: { priceUsd: 120, priceDisplay: '$120/mes' }
```

Also update the tier names:
```typescript
// FIND:
{ id: 'BASICO', name: 'Básico', ... }

// REPLACE:
{ id: 'BASICO', name: 'Inicial', description: 'Para trabajadores independientes', ... }
```

**Test (AI):** Search codebase for "$12" or "$18" - should find 0 occurrences after fix

**Test (Manual - Kevin):**
1. Go to landing page
2. Verify pricing shows $25, $55, $120
3. Go to Settings → Billing (if exists)
4. Verify pricing is correct there too

---

### Task 1.2.2: Update Tier Limits

**File to modify:** `apps/web/lib/config/tier-limits.ts`

**For AI:** Update these limits to match vision:

```typescript
BASICO: {  // "Inicial"
  maxUsers: 1,                           // Changed from 3
  maxJobsPerMonth: 50,                   // Changed from 150
  maxWhatsAppMessagesPerMonth: 0,        // No AI for Inicial
  hasVoiceReports: false,
  hasAnalytics: false,
  hasMarketplace: true,                  // ALL tiers get marketplace
}

PROFESIONAL: {
  maxUsers: 5,                           // Changed from 8
  maxJobsPerMonth: 200,                  // Changed from 500
  maxWhatsAppMessagesPerMonth: 100,      // AI with limit
  hasVoiceReports: true,
  hasAnalytics: true,
  hasMarketplace: true,
}

EMPRESARIAL: {
  maxUsers: Infinity,                    // Unlimited
  maxJobsPerMonth: Infinity,             // Unlimited
  maxWhatsAppMessagesPerMonth: Infinity, // Unlimited
  hasVoiceReports: true,
  hasAnalytics: true,
  hasMarketplace: true,
}
```

**Test (AI):** Unit test that tier limits return correct values

---

## Phase 1.3: Simplify Role System to 3 Roles

**What this does:** The current system has 6 roles (OWNER, ADMIN, DISPATCHER, TECHNICIAN, ACCOUNTANT, VIEWER). We're simplifying to 3 roles.

### Task 1.3.1: Update Role Enum in Prisma Schema

**File to modify:** `apps/web/prisma/schema.prisma`

**For AI:** Find the UserRole enum and update:

```prisma
// FIND:
enum UserRole {
  OWNER
  ADMIN
  DISPATCHER
  TECHNICIAN
  ACCOUNTANT
  VIEWER
}

// REPLACE WITH:
enum UserRole {
  OWNER       // Full access including billing
  DISPATCHER  // Operations: jobs, customers, inventory (NO billing)
  TECHNICIAN  // Field worker: assigned jobs, inventory usage
}
```

**Warning:** This is a breaking change. Needs migration.

---

### Task 1.3.2: Create Role Migration

**For AI:** Create migration SQL that maps old roles to new:

```sql
-- Migration: Simplify UserRole enum
-- File: prisma/migrations/YYYYMMDDHHMMSS_simplify_roles/migration.sql

-- Step 1: Map existing roles to new roles
UPDATE "users" SET "role" = 'OWNER' WHERE "role" = 'ADMIN';
UPDATE "users" SET "role" = 'DISPATCHER' WHERE "role" = 'ACCOUNTANT';
UPDATE "users" SET "role" = 'TECHNICIAN' WHERE "role" = 'VIEWER';

-- Step 2: The enum will be updated by Prisma
```

**For Manual (Kevin):**
1. Backup database first: Supabase Dashboard → Database → Backups
2. Run: `npx prisma migrate dev --name simplify_roles`
3. If errors, restore from backup

---

### Task 1.3.3: Update TypeScript Types

**File to modify:** `apps/web/types/index.ts`

**For AI:**
```typescript
// FIND:
export type UserRole = 'owner' | 'admin' | 'dispatcher' | 'technician' | 'accountant';

// REPLACE:
export type UserRole = 'owner' | 'dispatcher' | 'technician';
```

---

### Task 1.3.4: Update Permission Checks

**File to modify:** `apps/web/lib/config/field-permissions.ts` (and any other permission files)

**For AI:** Search for any references to 'admin', 'accountant', 'viewer' roles and:
- Replace 'admin' checks with 'owner'
- Replace 'accountant' checks with 'dispatcher'
- Replace 'viewer' checks with 'technician'

**Test (AI):** TypeScript compilation passes with no errors about role types

**Test (Manual - Kevin):**
1. Log in as owner → verify full access
2. Create a dispatcher user → verify no billing access
3. Create a technician user → verify only sees assigned jobs

---

## Phase 1.4: Rating System

**What this does:** Creates the `/rate/[token]` page where customers can rate their service after a job is completed. This feeds into marketplace rankings.

### Task 1.4.1: Create Ratings Database Table

**For AI:** Add to Prisma schema:

```prisma
model Rating {
  id             String   @id @default(cuid())
  jobId          String
  job            Job      @relation(fields: [jobId], references: [id])
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  customerId     String?
  customer       Customer? @relation(fields: [customerId], references: [id])
  
  rating         Int      // 1-5 stars
  comment        String?  // Optional text feedback
  token          String   @unique // Secure token for rating link
  
  createdAt      DateTime @default(now())

  @@index([organizationId])
  @@index([jobId])
}
```

Run migration: `npx prisma migrate dev --name add_ratings`

---

### Task 1.4.2: Create Rating Page

**File to create:** `apps/web/app/rate/[token]/page.tsx`

**For AI:** Create a public page (no auth required) that:
1. Fetches job/organization data using the token
2. Shows business name and service type
3. Star rating selector (1-5 stars, clickable)
4. Optional comment textarea
5. Submit button
6. After submit: Success message + "Guardá este WhatsApp para futuras consultas" + business WhatsApp number
7. Handle invalid/expired tokens gracefully

**Design (Spanish):**
```
┌─────────────────────────────────────────────────────────────┐
│  ⭐ Calificá tu experiencia                                 │
│                                                             │
│  Servicio: Reparación de cañería                           │
│  Proveedor: Plomería García                                │
│                                                             │
│  ¿Cómo calificarías el servicio?                           │
│  [☆] [☆] [☆] [☆] [☆]                                       │
│                                                             │
│  Contanos más (opcional):                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Enviar Calificación]                                      │
└─────────────────────────────────────────────────────────────┘
```

**Test (AI):** 
- Generate test token
- Navigate to `/rate/[test-token]`
- Verify page loads
- Submit rating
- Verify rating saved to database

**Test (Manual - Kevin):**
1. Complete a test job
2. Get the rating link from the system
3. Open link in incognito browser
4. Submit a rating
5. Check database that rating was saved

---

### Task 1.4.3: Create Rating API Route

**File to create:** `apps/web/app/api/ratings/route.ts`

**For AI:**
```typescript
// POST /api/ratings
// Body: { token: string, rating: number (1-5), comment?: string }
// Response: { success: true } or { error: string }

// Must validate:
// - Token exists and is valid
// - Rating is 1-5
// - Token hasn't been used before (one rating per job)
```

---

### Task 1.4.4: Generate Rating Token on Job Completion

**File to modify:** Job completion logic (wherever jobs are marked complete)

**For AI:** When a job status changes to COMPLETED:
1. Generate a unique secure token (use `crypto.randomUUID()`)
2. Create Rating record with token (rating null until submitted)
3. Include rating link in job completion notification

---

### Task 1.4.5: Add Rating Link to Tracking Page

**File to modify:** `apps/web/app/track/[token]/page.tsx`

**For AI:** After job is COMPLETED, show:
- Invoice PDF download link
- Service report PDF download link
- Rating form (inline or link to `/rate/[token]`)
- "Guardá este WhatsApp" prompt with business number

---

## Phase 1.5: Employee Scheduling System

**What this does:** Allows employees to set their available work hours and allows dispatchers to see who's available for urgent jobs.

### Task 1.5.1: Create Availability Database Tables

**For AI:** Add to Prisma schema:

```prisma
// Weekly recurring schedule
model EmployeeSchedule {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  
  dayOfWeek      Int      // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime      String   // "09:00" (24h format)
  endTime        String   // "18:00"
  isAvailable    Boolean  @default(true)
  
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([userId, dayOfWeek])
  @@index([organizationId])
}

// One-time exceptions (day off, vacation, etc.)
model ScheduleException {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  
  date           DateTime @db.Date
  isAvailable    Boolean  @default(false) // false = day off
  reason         String?  // "Vacaciones", "Enfermedad", etc.
  
  createdAt      DateTime @default(now())

  @@unique([userId, date])
  @@index([organizationId])
}
```

Run migration: `npx prisma migrate dev --name add_employee_scheduling`

---

### Task 1.5.2: Create Schedule Management UI for Employees

**File to create:** `apps/web/app/dashboard/schedule/page.tsx`

**For AI:** Create a page where employees (and owners/dispatchers) can:
1. See weekly schedule grid (Mon-Sun)
2. Set start/end times for each day
3. Toggle days on/off
4. Add exceptions (vacation days, sick days)
5. View upcoming schedule

**Design:**
```
┌─────────────────────────────────────────────────────────────┐
│  Mi Horario                                                 │
├─────────────────────────────────────────────────────────────┤
│  Lunes      [✓] 09:00 - 18:00  [Editar]                    │
│  Martes     [✓] 09:00 - 18:00  [Editar]                    │
│  Miércoles  [✓] 09:00 - 18:00  [Editar]                    │
│  Jueves     [✓] 09:00 - 18:00  [Editar]                    │
│  Viernes    [✓] 09:00 - 17:00  [Editar]                    │
│  Sábado     [ ] No disponible                               │
│  Domingo    [ ] No disponible                               │
├─────────────────────────────────────────────────────────────┤
│  Excepciones                                                │
│  + Agregar día libre                                        │
│                                                             │
│  25 Dic - Navidad (No disponible)                          │
│  31 Dic - Año Nuevo (No disponible)                        │
└─────────────────────────────────────────────────────────────┘
```

**Test (Manual - Kevin):**
1. Log in as technician
2. Go to Schedule page
3. Set your hours for the week
4. Add a vacation day
5. Verify it saves correctly

---

### Task 1.5.3: Create Availability Check API

**File to create:** `apps/web/app/api/employees/availability/route.ts`

**For AI:**
```typescript
// GET /api/employees/availability?date=2025-12-15&time=10:00
// Returns: { availableEmployees: User[] }

// Logic:
// 1. Get day of week from date
// 2. Find employees with schedule for that day
// 3. Filter by time range (startTime <= time <= endTime)
// 4. Exclude employees with exception on that date
// 5. Exclude employees already assigned to jobs at that time
// 6. Return list with employee info + current location (if tracked)
```

---

### Task 1.5.4: Integrate Availability into Job Assignment

**File to modify:** Job assignment UI/logic

**For AI:** When assigning a job:
1. Check scheduled date/time
2. Show only available employees
3. Sort by proximity (if GPS available)
4. Show "No hay técnicos disponibles" if none available
5. Allow override with warning

---

## Phase 1.6: Testing Infrastructure

**What this does:** Sets up automated testing so we can catch bugs before they reach production.

### Task 1.6.1: Install Testing Framework

**For AI:** Run in `apps/web`:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```

Create `apps/web/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
```

Create `apps/web/tests/setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

Add to `apps/web/package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

**Test (AI):** Run `npm test` - should pass (even if no tests yet)

---

### Task 1.6.2: Create Test Utilities

**File to create:** `apps/web/tests/utils/test-helpers.ts`

**For AI:** Create helper functions for:
- Mock authenticated user
- Mock organization context
- Factory functions for test data (jobs, customers, etc.)

---

### Task 1.6.3: Write Critical Path Tests

**For AI:** Create unit tests for:
- `apps/web/tests/unit/tier-limits.test.ts` - Test tier limits are correct
- `apps/web/tests/unit/permissions.test.ts` - Test role permissions
- `apps/web/tests/unit/rating.test.ts` - Test rating validation

**Test (Manual - Kevin):**
1. Run `npm run test:coverage`
2. Review coverage report
3. Verify critical functions are tested

---

## Phase 1.7: Environment & CI/CD

### Task 1.7.1: Document Environment Variables

**File to create:** `apps/web/ENV.md`

**For AI:** List ALL required environment variables with descriptions:
```markdown
# Environment Variables

## Required
- `DATABASE_URL` - PostgreSQL connection string (Supabase)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server only)

## Payment (MercadoPago)
- `MERCADOPAGO_ACCESS_TOKEN` - MP access token
- `MERCADOPAGO_PUBLIC_KEY` - MP public key

## AFIP
- `AFIP_CERT` - Certificate (base64)
- `AFIP_KEY` - Private key (base64)
- `AFIP_CUIT` - Business CUIT
- `AFIP_ENVIRONMENT` - 'testing' or 'production'

... etc
```

---

### Task 1.7.2: Create .env.example

**File to create:** `apps/web/.env.example`

**For AI:** Copy all var names from ENV.md with placeholder values

---

### Task 1.7.3: Set Up GitHub Actions CI

**File to create:** `.github/workflows/ci.yml`

**For AI:**
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

**Test (Manual - Kevin):**
1. Create a Pull Request
2. Verify GitHub Actions runs
3. Check that tests pass

---

# PHASE 2: Mobile App (Role-Based)

**Plain Language:** Build ONE mobile app that works for all business users (owners, dispatchers, technicians). What they see depends on their role.

**Duration:** 4-6 weeks
**Prerequisite:** Phase 1 complete

---

## Phase 2.1: React Native Setup

### Task 2.1.1: Initialize React Native Project

**For AI:** Create new Expo project:
```bash
cd apps
npx create-expo-app@latest mobile --template blank-typescript
```

**Project structure:**
```
apps/mobile/
├── app/                    # Expo Router (file-based routing)
├── components/
├── hooks/
├── services/
├── store/
├── types/
└── package.json
```

---

### Task 2.1.2: Configure Navigation Structure

**For AI:** Set up Expo Router with role-based layouts:

```
apps/mobile/app/
├── _layout.tsx             # Root layout with auth check
├── (auth)/                 # Login screens
│   ├── _layout.tsx
│   ├── login.tsx
│   └── invite/[token].tsx  # Employee invite acceptance
│
├── (app)/                  # Main app (authenticated)
│   ├── _layout.tsx         # Tab navigation
│   │
│   ├── (owner)/           # Owner-only screens
│   │   ├── team.tsx
│   │   ├── billing.tsx
│   │   └── analytics.tsx
│   │
│   ├── (dispatcher)/      # Dispatcher screens (Owner also sees these)
│   │   ├── jobs/
│   │   ├── customers/
│   │   ├── schedule.tsx
│   │   ├── map.tsx        # Live tracking
│   │   └── whatsapp.tsx
│   │
│   └── (technician)/      # Technician screens (all roles see these)
│       ├── today.tsx      # Today's jobs
│       ├── job/[id].tsx   # Job detail
│       ├── inventory.tsx
│       └── profile.tsx
```

**Key concept:** Role-based routing in `_layout.tsx`:
```typescript
// apps/mobile/app/(app)/_layout.tsx
const { user } = useAuth();

// Show/hide tabs based on role
const tabs = [
  { name: 'today', icon: 'calendar', roles: ['owner', 'dispatcher', 'technician'] },
  { name: 'jobs', icon: 'briefcase', roles: ['owner', 'dispatcher'] },
  { name: 'map', icon: 'map', roles: ['owner', 'dispatcher'] },
  { name: 'team', icon: 'users', roles: ['owner'] },
  { name: 'profile', icon: 'user', roles: ['owner', 'dispatcher', 'technician'] },
];

const visibleTabs = tabs.filter(t => t.roles.includes(user.role));
```

---

### Task 2.1.3: Set Up API Client

**File to create:** `apps/mobile/services/api.ts`

**For AI:** Create API client that:
- Uses same endpoints as web app
- Handles authentication token
- Implements retry logic
- Works offline (queue requests)

---

## Phase 2.2: Authentication for Mobile

### Task 2.2.1: Implement OTP Login

**File to create:** `apps/mobile/app/(auth)/login.tsx`

**For AI:** Same flow as web:
1. Enter phone number
2. Receive OTP via WhatsApp/SMS
3. Enter OTP
4. Redirected to appropriate screen based on role

---

### Task 2.2.2: Implement Invite Acceptance

**File to create:** `apps/mobile/app/(auth)/invite/[token].tsx`

**For AI:** When owner invites employee:
1. Employee receives WhatsApp with link containing token
2. Link opens app (deep link) to invite screen
3. Employee enters phone, verifies OTP
4. Account created and linked to organization
5. Redirected to main app

---

## Phase 2.3: Technician Features

**These are the core features a field technician needs.**

### Task 2.3.1: Today's Jobs Screen

**File:** `apps/mobile/app/(app)/(technician)/today.tsx`

**For AI:** Show:
- List of jobs assigned for today
- Job status badges (Pendiente, En camino, En progreso, Completado)
- Customer name and address
- Scheduled time
- Tap to view details

---

### Task 2.3.2: Job Detail Screen

**File:** `apps/mobile/app/(app)/(technician)/job/[id].tsx`

**For AI:** Show:
- Customer info (name, phone, address)
- Service description
- Job notes from dispatcher
- Status update buttons
- Navigate button (opens Google Maps)
- Material usage logging
- Photo capture (before/during/after)
- Signature capture
- Complete job button

**Status flow:**
```
PENDING → EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED
         ↓
    (GPS tracking starts)
```

---

### Task 2.3.3: GPS Tracking Service

**File:** `apps/mobile/services/location.ts`

**For AI:** When technician sets status to EN_ROUTE:
1. Request location permission
2. Start background location updates (every 30 seconds)
3. Send to API endpoint
4. Stop when status changes to COMPLETED

**Important:** Must work in background (battery-efficient mode)

---

### Task 2.3.4: Voice Report Feature

**File:** `apps/mobile/components/VoiceReport.tsx`

**For AI:** 
1. Press and hold to record
2. Send audio to API
3. API transcribes with Whisper
4. Returns structured data (materials used, work done, notes)
5. Show transcription for confirmation
6. Auto-fill job completion form

---

### Task 2.3.5: Offline Support

**File:** `apps/mobile/services/offline.ts`

**For AI:** Queue operations when offline:
- Status updates
- Photos
- Notes
- Material usage

When back online, sync automatically.

---

## Phase 2.4: Dispatcher Features

### Task 2.4.1: Job Management Screen

**File:** `apps/mobile/app/(app)/(dispatcher)/jobs/index.tsx`

**For AI:** Show:
- All jobs (filterable by status, date, technician)
- Create new job button
- Quick assign to technician
- Search functionality

---

### Task 2.4.2: Live Map / Tracking Screen

**File:** `apps/mobile/app/(app)/(dispatcher)/map.tsx`

**For AI:** Show:
- Map with all active technicians as pins
- Filter by technician
- See current job status
- Tap pin for details
- Show ETAs to active jobs

---

### Task 2.4.3: Schedule Overview

**File:** `apps/mobile/app/(app)/(dispatcher)/schedule.tsx`

**For AI:** Show:
- Calendar view of all jobs
- Which technician assigned to each
- Who's available (from Phase 1.5)
- Quick reschedule by dragging

---

## Phase 2.5: Owner Features

### Task 2.5.1: Team Management

**File:** `apps/mobile/app/(app)/(owner)/team.tsx`

**For AI:** Show:
- List of all team members
- Their role
- Invite new member button
- Edit role button
- Remove button (with confirmation)

---

### Task 2.5.2: Analytics Dashboard

**File:** `apps/mobile/app/(app)/(owner)/analytics.tsx`

**For AI:** Show:
- Jobs this month (number + trend)
- Revenue this month
- Average rating (from Phase 1.4)
- Top performing technicians
- Quick insights

---

## Phase 2.6: Device Compatibility

### Task 2.6.1: Test on Old Devices

**For Manual (Kevin):**
1. Test on Android 8 device (API 26)
2. Test on iPhone 6S (iOS 14)
3. Test on low-RAM device (2GB)
4. Document any issues

**For AI:** Optimize:
- Reduce bundle size (code splitting)
- Lazy load heavy components
- Optimize images
- Minimize memory usage

---

## Phase 2.7: App Store Preparation

### Task 2.7.1: Create App Assets

**For Manual (Kevin):**
1. Create app icon (1024x1024 PNG)
2. Create screenshots (various sizes)
3. Write app description (Spanish)
4. Prepare privacy policy URL

### Task 2.7.2: Configure App Stores

**For Manual (Kevin):**
1. Create Apple Developer account ($99/year)
2. Create Google Play Console account ($25 one-time)
3. Fill out questionnaires
4. Submit for review

---

# PHASE 3: Consumer Marketplace App

**Plain Language:** This is the FREE app for regular people to find and hire service businesses. Mobile only, no web version.

**Duration:** 4-6 weeks
**Prerequisite:** Phase 2 complete (mobile foundation)

---

## Phase 3.1: Consumer App Setup

### Task 3.1.1: Initialize Project

**For AI:**
```bash
cd apps
npx create-expo-app@latest consumer-mobile --template blank-typescript
```

---

### Task 3.1.2: App Structure

```
apps/consumer-mobile/app/
├── _layout.tsx
├── index.tsx               # Home / Discovery
├── search.tsx              # Search results
├── category/[slug].tsx     # Category listings
├── provider/[id].tsx       # Business profile
├── (auth)/
│   ├── login.tsx          # Phone + OTP (optional)
│   └── profile.tsx
├── (booking)/
│   ├── request/[providerId].tsx
│   └── history.tsx
└── rate/[token].tsx        # Rating after service
```

---

## Phase 3.2: Discovery Features

### Task 3.2.1: Home Screen

**File:** `apps/consumer-mobile/app/index.tsx`

**For AI:** Show:
- Location auto-detected (or ask permission)
- Category grid (Plomería, Electricidad, Gas, Aires Acondicionados, etc.)
- "¿Qué necesitás?" search bar
- Featured/top-rated providers nearby
- Recent searches (if logged in)

---

### Task 3.2.2: Search Functionality

**File:** `apps/consumer-mobile/app/search.tsx`

**For AI:** 
- Text search with autocomplete
- Voice search option
- Filter by: distance, rating, availability
- Sort by: relevance, rating, distance
- Results show: business name, rating, distance, services

---

### Task 3.2.3: Category Pages

**File:** `apps/consumer-mobile/app/category/[slug].tsx`

**For AI:** Show businesses in category:
- List view or map view toggle
- Filter by sub-service
- Rating filter (4+ stars, etc.)
- Available now filter

---

## Phase 3.3: Business Profiles (Public)

### Task 3.3.1: Create Public Profile Schema

**For AI:** Add to Prisma:

```prisma
model BusinessPublicProfile {
  id              String   @id @default(cuid())
  organizationId  String   @unique
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  displayName     String
  description     String?
  logo            String?  // URL
  coverPhoto      String?  // URL
  
  // Services offered
  categories      String[] // e.g., ["plomeria", "gas"]
  services        Json     // Detailed service list with descriptions
  
  // Location
  serviceArea     Json     // GeoJSON polygon or radius
  address         String?  // Physical address (optional)
  
  // Contact
  whatsappNumber  String
  phone           String?
  
  // Metrics (calculated)
  averageRating   Float    @default(0)
  totalReviews    Int      @default(0)
  totalJobs       Int      @default(0)
  responseRate    Float    @default(0)  // % of requests responded to
  responseTime    Int      @default(0)  // Average minutes to respond
  
  // Verification badges
  cuitVerified    Boolean  @default(false)
  insuranceVerified Boolean @default(false)
  
  isActive        Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([averageRating])
}
```

**Important:** ALL businesses have a public profile (mandatory marketplace presence). Created automatically when business signs up.

---

### Task 3.3.2: Provider Profile Screen

**File:** `apps/consumer-mobile/app/provider/[id].tsx`

**For AI:** Show:
- Header with logo, name, rating
- Verification badges
- Description
- Services offered with prices (if disclosed)
- Photos gallery (job photos)
- Reviews list (from ratings)
- "Contactar por WhatsApp" button (main CTA)
- "Solicitar Presupuesto" button

---

## Phase 3.4: Contact & Booking

### Task 3.4.1: WhatsApp Contact Button

**For AI:** When user taps "Contactar por WhatsApp":
1. Open WhatsApp with pre-filled message
2. Message includes: service category + user location
3. Track this as a "lead" in the system

---

### Task 3.4.2: Quote Request (Optional)

**File:** `apps/consumer-mobile/app/(booking)/request/[providerId].tsx`

**For AI:** Form to request quote:
- Service needed (dropdown)
- Description of problem
- Photos (optional)
- Preferred date/time
- Address (auto-filled from location)
- Submit → Creates lead in business's queue

---

## Phase 3.5: Consumer Account (Optional)

**Note:** Consumers don't NEED an account to browse or contact. Account is only for:
- Saving favorite providers
- Viewing booking history
- Submitting ratings

### Task 3.5.1: Simple Auth

**File:** `apps/consumer-mobile/app/(auth)/login.tsx`

**For AI:** Phone + OTP only (same as business app)
- No password
- No email required
- Quick and simple

---

## Phase 3.6: Rating Integration

### Task 3.6.1: In-App Rating

**File:** `apps/consumer-mobile/app/rate/[token].tsx`

**For AI:** Same rating form as web `/rate/[token]`:
- Receives link via WhatsApp after job completion
- 1-5 stars
- Optional comment
- Submit updates business's averageRating

---

## Phase 3.7: SEO & Deep Links

### Task 3.7.1: Configure Deep Linking

**For AI:** Set up universal links so:
- `campotech.com/provider/[id]` → Opens app to provider page
- `campotech.com/rate/[token]` → Opens app to rating page
- If app not installed → Opens App Store

---

# PHASE 4: Admin Dashboard

**Plain Language:** Your internal dashboard to manage CampoTech as a business - see all subscribers, revenue, AI conversations, etc.

**Duration:** 2-3 weeks
**Prerequisite:** Phase 1 complete

---

## Phase 4.1: Admin App Setup

### Task 4.1.1: Initialize Project

**For AI:**
```bash
cd apps
npx create-next-app@latest admin --typescript --tailwind --app
```

---

### Task 4.1.2: Separate Authentication

**For AI:** Admin uses completely separate auth:
- NOT the same auth as business users
- Hardcoded admin users or separate Supabase project
- IP whitelist (optional but recommended)

---

## Phase 4.2: Admin Features

### Task 4.2.1: Dashboard Overview

**File:** `apps/admin/app/dashboard/page.tsx`

**For AI:** Show:
- Total active businesses
- MRR (Monthly Recurring Revenue)
- New signups this week/month
- Churn rate
- Active users today
- System health indicators

---

### Task 4.2.2: Business Management

**File:** `apps/admin/app/dashboard/businesses/page.tsx`

**For AI:** Show:
- Table of all businesses
- Columns: Name, Plan, MRR, Status, Created, Last Active
- Search/filter
- Click to view details
- Actions: Suspend, Upgrade, Add Notes

---

### Task 4.2.3: Revenue & Payments

**File:** `apps/admin/app/dashboard/payments/page.tsx`

**For AI:** Show:
- Revenue chart (daily/monthly)
- Revenue by tier
- Failed payments list
- Upcoming renewals
- Export to CSV

---

### Task 4.2.4: WhatsApp AI Monitor

**File:** `apps/admin/app/dashboard/ai/page.tsx`

**For AI:** Show:
- All AI conversations (anonymized customer names)
- AI confidence scores
- Failed/escalated conversations
- Voice transcriptions
- Model performance metrics
- Training data export

---

### Task 4.2.5: Activity Map

**File:** `apps/admin/app/dashboard/map/page.tsx`

**For AI:** Show:
- Live map of ALL technicians (across all businesses)
- Jobs in progress
- Geographic coverage heatmap
- Service area analysis

---

# PHASE 5: Database Optimization

**Plain Language:** Make the database fast enough to handle 100,000 businesses and their data.

**Duration:** 2-3 weeks
**Prerequisite:** Core apps working

---

## Phase 5.1: Index Audit

### Task 5.1.1: Analyze Query Patterns

**For AI:** Identify common queries and add indexes:

```sql
-- Jobs queries (most common)
CREATE INDEX idx_jobs_org_status ON jobs(organization_id, status);
CREATE INDEX idx_jobs_org_date ON jobs(organization_id, scheduled_date);
CREATE INDEX idx_jobs_assigned_status ON jobs(assigned_to, status);

-- Ratings for marketplace
CREATE INDEX idx_ratings_org ON ratings(organization_id);
CREATE INDEX idx_ratings_org_rating ON ratings(organization_id, rating);

-- Employee schedules
CREATE INDEX idx_schedule_user_day ON employee_schedules(user_id, day_of_week);
CREATE INDEX idx_exceptions_user_date ON schedule_exceptions(user_id, date);

-- Public profiles for marketplace search
CREATE INDEX idx_profiles_active_rating ON business_public_profiles(is_active, average_rating DESC);
CREATE INDEX idx_profiles_categories ON business_public_profiles USING GIN(categories);
```

---

## Phase 5.2: Caching Layer

### Task 5.2.1: Set Up Redis

**For Manual (Kevin):**
1. Create Upstash account (free tier)
2. Create Redis database
3. Get connection URL

**For AI:** Install and configure:
```bash
npm install @upstash/redis
```

Create `apps/web/lib/cache.ts`:
```typescript
import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Cache helper
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cached = await redis.get<T>(key)
  if (cached) return cached
  
  const result = await fn()
  await redis.set(key, result, { ex: ttlSeconds })
  return result
}
```

---

### Task 5.2.2: Cache Common Queries

**For AI:** Add caching to:
- Organization settings (TTL: 1 hour)
- Tier limits (TTL: 24 hours)
- Public profiles (TTL: 5 minutes)
- Search results (TTL: 1 minute)

---

## Phase 5.3: Connection Pooling

### Task 5.3.1: Configure Supabase Pooler

**For Manual (Kevin):**
1. Go to Supabase Dashboard → Database → Settings
2. Find "Connection pooling" section
3. Enable pooling
4. Copy the pooled connection string

**For AI:** Update DATABASE_URL to use pooler:
```
# Direct (for migrations only)
DIRECT_URL="postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres"

# Pooled (for app connections)
DATABASE_URL="postgresql://postgres:xxx@xxx-pooler.supabase.com:6543/postgres"
```

---

# PHASE 6: API Hardening

**Plain Language:** Make the API secure, fast, and able to handle high traffic.

**Duration:** 2-3 weeks

---

## Phase 6.1: Rate Limiting

### Task 6.1.1: Implement Rate Limits

**For AI:** Use Upstash rate limiting:

```bash
npm install @upstash/ratelimit
```

Create middleware:
```typescript
// apps/web/middleware.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
})

// Different limits per tier
const tierLimits = {
  BASICO: 100,      // 100/min
  PROFESIONAL: 500, // 500/min
  EMPRESARIAL: 2000 // 2000/min
}
```

---

## Phase 6.2: Queue System

### Task 6.2.1: Set Up BullMQ

**For AI:** For heavy operations (AFIP, AI, notifications):

```bash
npm install bullmq
```

Create queues for:
- `invoice:generate` - AFIP invoice generation
- `notification:send` - Push/SMS/Email
- `whatsapp:process` - AI message processing
- `voice:transcribe` - Whisper transcription

---

## Phase 6.3: API Versioning

### Task 6.3.1: Implement Versioning

**For AI:** Move all API routes under `/api/v1/`:

```
apps/web/app/api/v1/
├── jobs/
├── customers/
├── invoices/
├── employees/
└── ...
```

Add version header to responses:
```typescript
return NextResponse.json(data, {
  headers: { 'X-API-Version': '1' }
})
```

---

# PHASE 7: Security & Compliance

**Plain Language:** Make sure we're legally compliant and secure against attacks.

**Duration:** 2-3 weeks

---

## Phase 7.1: Data Protection (Ley 25.326)

### Task 7.1.1: Privacy Policy

**For Manual (Kevin):**
1. Draft privacy policy in Spanish
2. Include: what data collected, how used, user rights
3. Reference ARCO rights (Acceso, Rectificación, Cancelación, Oposición)
4. Get lawyer review (recommended)

**For AI:** Create pages:
- `/legal/privacidad` - Privacy policy
- `/legal/terminos` - Terms of service
- `/legal/cookies` - Cookie policy

---

### Task 7.1.2: Data Export API (ARCO Rights)

**For AI:** Create endpoint for users to export their data:

```typescript
// GET /api/user/data-export
// Returns: ZIP file with all user's data in JSON format
```

---

### Task 7.1.3: Data Deletion API

**For AI:** Create endpoint for account deletion:

```typescript
// DELETE /api/user/account
// Anonymizes or deletes all user data
// Keeps invoices (AFIP 10-year requirement)
```

---

## Phase 7.2: Consumer Protection (Ley 24.240)

### Task 7.2.1: "Botón de Arrepentimiento"

**For AI:** Add visible cancellation button:
- Footer of all pages
- Settings page
- Clear link in subscription emails
- Process refund within 10 days if cancelled within window

---

## Phase 7.3: Security Audit

### Task 7.3.1: OWASP Top 10 Check

**For AI:** Verify protection against:
1. Injection (SQL, XSS)
2. Broken authentication
3. Sensitive data exposure
4. XML external entities
5. Broken access control
6. Security misconfiguration
7. Cross-site scripting
8. Insecure deserialization
9. Using components with known vulnerabilities
10. Insufficient logging

---

# PHASE 8: Observability & Monitoring

**Plain Language:** Set up systems to know when something breaks before users notice.

**Duration:** 1-2 weeks

---

## Phase 8.1: Error Tracking

### Task 8.1.1: Set Up Sentry

**For Manual (Kevin):**
1. Create Sentry account (free tier)
2. Create project
3. Get DSN

**For AI:**
```bash
npm install @sentry/nextjs
```

Configure to capture:
- Unhandled errors
- API failures
- Performance issues

---

## Phase 8.2: Application Metrics

### Task 8.2.1: Key Metrics to Track

**For AI:** Track and dashboard:
- Request latency (p50, p95, p99)
- Error rate
- Active users
- Jobs created/day
- Invoices generated/day
- AI conversations/day
- Database query times

---

## Phase 8.3: Alerting

### Task 8.3.1: Set Up Alerts

**For Manual (Kevin):**
1. Configure Sentry alerts for critical errors
2. Set up uptime monitoring (UptimeRobot free)
3. Get Slack/WhatsApp notifications

---

# PHASE 9: Load Testing & Launch

**Plain Language:** Test that everything works under heavy load, then launch.

**Duration:** 1-2 weeks

---

## Phase 9.1: Load Testing

### Task 9.1.1: Create Load Test Scripts

**For AI:** Use k6 for load testing:

```javascript
// k6 script for 100K concurrent users simulation
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 1000 },   // Ramp up to 1K
    { duration: '5m', target: 10000 },  // Ramp up to 10K
    { duration: '5m', target: 50000 },  // Ramp up to 50K
    { duration: '5m', target: 100000 }, // Ramp up to 100K
    { duration: '5m', target: 100000 }, // Stay at 100K
    { duration: '2m', target: 0 },      // Ramp down
  ],
};

export default function () {
  // Simulate typical user actions
  http.get('https://app.campotech.com/api/v1/jobs');
  sleep(1);
}
```

**For Manual (Kevin):**
1. Temporarily upgrade Supabase to Team tier
2. Run load test
3. Record results
4. Identify bottlenecks
5. Downgrade after test

---

## Phase 9.2: Launch Checklist

### Task 9.2.1: Pre-Launch Verification

**For Manual (Kevin):**

**Technical:**
- [ ] All tests passing
- [ ] Load test passed (100K concurrent)
- [ ] Security scan clean
- [ ] Error tracking active
- [ ] Backups configured
- [ ] SSL certificates valid

**Legal:**
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Ley 25.326 compliance (AAIP registration submitted)
- [ ] Ley 24.240 compliance (cancellation button)
- [ ] AFIP integration certified

**Business:**
- [ ] Pricing finalized
- [ ] Payment processing working
- [ ] Support contact ready
- [ ] Mobile apps in stores

---

## Summary: Phase Order

| Phase | Name | Duration | Prerequisites |
|-------|------|----------|---------------|
| 1 | Foundation & Fixes | 2-3 weeks | None |
| 2 | Mobile App | 4-6 weeks | Phase 1 |
| 3 | Consumer App | 4-6 weeks | Phase 2 |
| 4 | Admin Dashboard | 2-3 weeks | Phase 1 |
| 5 | Database Optimization | 2-3 weeks | Phase 1-4 |
| 6 | API Hardening | 2-3 weeks | Phase 5 |
| 7 | Security & Compliance | 2-3 weeks | Phase 6 |
| 8 | Observability | 1-2 weeks | Phase 7 |
| 9 | Load Testing & Launch | 1-2 weeks | Phase 8 |

**Total: 20-32 weeks** (with parallelization: 14-20 weeks)

---

*Document Version: 2.0*
*Corrected per CampoTech Vision*
