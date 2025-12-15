# apps/web Corrections & Implementation Guide

*Powered by CampoTech*

---

## Implementation Status Summary

| Category | Implemented | Pending |
|----------|-------------|---------|
| Authentication APIs | ✅ Complete | - |
| Registration Flow | ✅ Complete | - |
| OTP System | ✅ Complete | - |
| Dashboard Core | ✅ Complete | - |
| Landing Page | ❌ | HIGH PRIORITY |
| Rating System | ❌ | HIGH PRIORITY |
| Tier Pricing | ⚠️ Needs Update | Values incorrect |
| Role System | ⚠️ Needs Update | Simplify to 3 roles |
| PDF Watermark | ❌ | MEDIUM |

---

## Overview

This document details all corrections, additions, and modifications needed for `apps/web` to align with the CampoTech vision.

---

## Current State Analysis

### What Exists (✅ Good)

| Feature | Status | Location |
|---------|--------|----------|
| Login/Signup | ✅ Built | `app/(auth)/login`, `app/(auth)/signup` |
| Dashboard | ✅ Built | `app/dashboard/page.tsx` |
| Jobs Management | ✅ Built | `app/dashboard/jobs/` |
| Customers | ✅ Built | `app/dashboard/customers/` |
| Invoices + AFIP | ✅ Built | `app/dashboard/invoices/` |
| Inventory | ✅ Built | `app/dashboard/inventory/` |
| Fleet/Vehicles | ✅ Built | `app/dashboard/fleet/` |
| Calendar | ✅ Built | `app/dashboard/calendar/` |
| WhatsApp Integration | ✅ Built | `app/dashboard/whatsapp/` |
| Analytics | ✅ Built | `app/dashboard/analytics/` |
| Settings | ✅ Built | `app/dashboard/settings/` |
| Tracking Page | ✅ Built | `app/track/[token]/` |
| Tier System | ✅ Built | `lib/config/tier-limits.ts` |
| Feature Flags | ✅ Built | `lib/config/feature-flags.ts` |
| Role System | ✅ Built | `types/index.ts`, `lib/auth-context.tsx` |

### What's Missing (❌ Needs Creation)

| Feature | Priority | Description |
|---------|----------|-------------|
| Landing Page | HIGH | Root page (`/`) with pricing tiers |
| Rating Page | HIGH | `/rate/[token]` for customer ratings |
| PDF Customization | MEDIUM | Business branding for invoices/reports |
| Market Position Dashboard | MEDIUM | Competitor insights (anonymized) |
| Voice Reports API | MEDIUM | Whisper transcription integration |

### What Needs Correction (⚠️ Needs Fix)

| Issue | Priority | Current State | Required State |
|-------|----------|---------------|----------------|
| Tier Pricing | HIGH | $0, $12, $18, $25 | $0, $25, $55, $120 |
| Role System | HIGH | 6 roles | 3 roles (Owner, Despachador, Técnico) |
| Root 404 | HIGH | No `page.tsx` at root | Landing page needed |
| PDF Watermark | MEDIUM | No watermark | "Powered by CampoTech" on all PDFs |

---

## Detailed Corrections

### 1. Create Landing Page (HIGH PRIORITY)

**File to Create**: `apps/web/app/page.tsx`

**Content Requirements**:
- Hero section explaining CampoTech
- Feature highlights
- Pricing table with 3 tiers:
  - Inicial: $25/mes
  - Profesional: $55/mes
  - Empresa: $120/mes
- "Comenzar" button → `/signup`
- "Iniciar Sesión" button → `/login`
- Footer with links

**Design Reference**:
```
┌─────────────────────────────────────────────────────────────────┐
│  CampoTech - Gestión de Servicios de Campo                     │
│  [Logo]                              [Iniciar Sesión] [Comenzar]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  "Organizá tu negocio de servicios                              │
│   como un profesional"                                          │
│                                                                 │
│  [Comenzar Gratis]                                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Features: Jobs | Invoicing | WhatsApp | Inventory | Analytics │
├─────────────────────────────────────────────────────────────────┤
│  PRICING SECTION                                                │
│  [Inicial $25] [Profesional $55] [Empresa $120]                │
├─────────────────────────────────────────────────────────────────┤
│  Footer: About | Privacy | Terms | Contact                      │
│  "Powered by CampoTech"                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2. Update Tier Pricing (HIGH PRIORITY)

**File to Modify**: `apps/web/lib/config/tier-limits.ts`

**Current Values (Lines 60-124)**:
```typescript
FREE: { priceUsd: 0, priceDisplay: 'Gratis' }
BASICO: { priceUsd: 12, priceDisplay: '$12/mes' }
PROFESIONAL: { priceUsd: 18, priceDisplay: '$18/mes' }
EMPRESARIAL: { priceUsd: 25, priceDisplay: '$25/mes' }
```

**Required Values**:
```typescript
FREE: { priceUsd: 0, priceDisplay: 'Gratis' }
BASICO: { priceUsd: 25, priceDisplay: '$25/mes' }        // Changed from $12
PROFESIONAL: { priceUsd: 55, priceDisplay: '$55/mes' }   // Changed from $18
EMPRESARIAL: { priceUsd: 120, priceDisplay: '$120/mes' } // Changed from $25
```

**Also Update Tier Names** (Lines 130-156):
```typescript
// Rename BASICO to INICIAL
{
  id: 'BASICO',  // Keep ID for backwards compatibility
  name: 'Inicial',  // Changed from 'Básico'
  description: 'Para trabajadores independientes',
  limits: TIER_LIMITS.BASICO,
}
```

**Update Limits Per Tier**:
```typescript
BASICO: {  // Now "Inicial"
  maxUsers: 1,           // Changed from 3
  maxJobsPerMonth: 50,   // Changed from 150
  maxWhatsAppMessagesPerMonth: 0,  // No AI for Inicial
  // ... rest
}

PROFESIONAL: {
  maxUsers: 5,           // Changed from 8
  maxJobsPerMonth: 200,  // Changed from 500
  maxWhatsAppMessagesPerMonth: 100,  // AI with limit
  // ... rest
}

EMPRESARIAL: {
  maxUsers: UNLIMITED,   // Changed from 20
  maxJobsPerMonth: UNLIMITED,
  maxWhatsAppMessagesPerMonth: UNLIMITED,  // Unlimited AI
  // ... rest
}
```

---

### 3. Simplify Role System (HIGH PRIORITY)

**File to Modify**: `apps/web/prisma/schema.prisma`

**Current (Line 138-145)**:
```prisma
enum UserRole {
  OWNER
  ADMIN
  DISPATCHER
  TECHNICIAN
  ACCOUNTANT
  VIEWER
}
```

**Required**:
```prisma
enum UserRole {
  OWNER       // Full access
  DISPATCHER  // Jobs, scheduling, customers, WhatsApp, inventory (NO billing)
  TECHNICIAN  // Their jobs only, inventory usage, voice reports
}
```

**Migration Steps**:
1. Create migration to update existing ADMIN → OWNER
2. Create migration to update existing ACCOUNTANT → DISPATCHER
3. Create migration to update existing VIEWER → TECHNICIAN
4. Remove unused roles from enum

**File to Modify**: `apps/web/types/index.ts`

**Current (Line 12)**:
```typescript
export type UserRole = 'owner' | 'admin' | 'dispatcher' | 'technician' | 'accountant';
```

**Required**:
```typescript
export type UserRole = 'owner' | 'dispatcher' | 'technician';
```

**File to Modify**: `apps/web/lib/config/field-permissions.ts`

Update all permission checks to use only 3 roles.

---

### 4. Create Rating Page (HIGH PRIORITY)

**File to Create**: `apps/web/app/rate/[token]/page.tsx`

**Functionality**:
- Fetch job/business data from token
- Display business name and service description
- Star rating selector (1-5)
- Optional comment textarea
- Submit button
- Success message with "Save this WhatsApp" prompt
- Store rating in database (link to Job and Organization)

**API Route to Create**: `apps/web/app/api/ratings/route.ts`

```typescript
// POST /api/ratings
// Body: { token, rating: 1-5, comment?: string }
// Response: { success: true }
```

**Database Schema Addition** (if not exists):
```prisma
model Rating {
  id             String   @id @default(cuid())
  jobId          String
  job            Job      @relation(fields: [jobId], references: [id])
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  rating         Int      // 1-5
  comment        String?
  token          String   @unique
  createdAt      DateTime @default(now())

  @@index([organizationId])
  @@index([jobId])
}
```

---

### 5. Update Tracking Page to Include Rating (MEDIUM PRIORITY)

**File to Modify**: `apps/web/app/track/[token]/page.tsx`

**Current**: Shows tracking only

**Required**: After job completion:
1. Show documents (Invoice PDF, Service Report PDF)
2. Show rating form (inline or link to `/rate/[token]`)
3. Show "Save this WhatsApp" prompt

**Add to TrackingData interface**:
```typescript
interface TrackingData {
  // ... existing fields
  isCompleted: boolean;
  documents?: {
    invoiceUrl?: string;
    reportUrl?: string;
  };
  ratingSubmitted?: boolean;
  businessWhatsApp: string;
}
```

---

### 6. Add PDF Watermark (MEDIUM PRIORITY)

**Files to Modify**: All PDF generation functions

**Locations**:
- `lib/services/invoice-pdf.ts` (or similar)
- `lib/services/report-pdf.ts` (or similar)

**Requirement**: Add "Powered by CampoTech" watermark to footer of all generated PDFs.

```typescript
// Example using pdfkit or similar
function addWatermark(doc) {
  doc.fontSize(8)
     .fillColor('#999999')
     .text('Powered by CampoTech', {
       align: 'center',
       y: doc.page.height - 30
     });
}
```

---

### 7. Add Market Position Analytics (MEDIUM PRIORITY)

**File to Create**: `apps/web/app/dashboard/analytics/market-position/page.tsx`

**API Route to Create**: `apps/web/app/api/analytics/market-position/route.ts`

**Functionality**:
- Calculate business's rating percentile vs competitors in same category/zone
- Count competitors with higher ratings
- Generate improvement tips based on data

**Data Structure**:
```typescript
interface MarketPosition {
  averageRating: number;
  totalReviews: number;
  percentile: number;  // e.g., 75 = "Top 25%"
  competitorsAbove: number;
  category: string;
  zone: string;
  tips: string[];
}
```

**Privacy**: Never expose competitor names, only aggregate data.

---

### 8. Add Voice Transcription API (MEDIUM PRIORITY)

**File to Create**: `apps/web/app/api/voice/transcribe/route.ts`

**Functionality**:
- Accept audio file (from mobile app or WhatsApp)
- Send to OpenAI Whisper API
- Return transcription
- Handle noisy audio gracefully

```typescript
// POST /api/voice/transcribe
// Body: FormData with audio file
// Response: { success: true, transcription: string, confidence: number }
```

**Integration Points**:
- Mobile app voice reports
- WhatsApp voice memos

---

### 9. Add Feature Toggles for Phased Rollout (MEDIUM PRIORITY)

**File to Modify**: `apps/web/lib/config/feature-flags.ts`

**Add New Global Toggles**:
```typescript
export type GlobalFeatureId =
  | 'ratings_enabled'        // Collect ratings from customers
  | 'marketplace_listing'    // Business visible in consumer app
  | 'consumer_app_enabled';  // Consumer marketplace active

export const GLOBAL_FEATURES: Record<GlobalFeatureId, {
  id: GlobalFeatureId;
  name: string;
  description: string;
  defaultEnabled: boolean;
}> = {
  ratings_enabled: {
    id: 'ratings_enabled',
    name: 'Sistema de Calificaciones',
    description: 'Recopilar calificaciones de clientes después de cada trabajo',
    defaultEnabled: false,  // OFF until Phase 2
  },
  marketplace_listing: {
    id: 'marketplace_listing',
    name: 'Listado en Marketplace',
    description: 'Aparecer en la app de consumidores',
    defaultEnabled: false,  // OFF until Phase 2
  },
  consumer_app_enabled: {
    id: 'consumer_app_enabled',
    name: 'App de Consumidores',
    description: 'Marketplace de consumidores activo',
    defaultEnabled: false,  // OFF until Phase 2
  },
};
```

**Admin API to Toggle**:
```typescript
// POST /api/admin/features/toggle
// Body: { featureId: GlobalFeatureId, enabled: boolean }
// Requires: CampoTech admin access (not business owner)
```

---

### 10. PDF Customization Settings (LOW PRIORITY)

**File to Create**: `apps/web/app/dashboard/settings/pdf-templates/page.tsx`

**Functionality**:
- Upload business logo
- Set primary color
- Edit footer text
- Preview templates (Invoice, Service Report)

**API Routes**:
```typescript
// GET /api/settings/pdf-templates - Get current settings
// PUT /api/settings/pdf-templates - Update settings
// POST /api/settings/pdf-templates/preview - Generate preview PDF
```

**Database Addition** (Organization settings):
```typescript
interface PdfTemplateSettings {
  logoUrl?: string;
  primaryColor: string;  // hex
  secondaryColor: string;  // hex
  footerText?: string;
  invoiceTemplate: 'default' | 'professional' | 'minimal';
  reportTemplate: 'default' | 'detailed';
}
```

---

## Files to Delete

None identified in apps/web.

---

## Files to Move/Remove (Other Apps)

### apps/mobile - Remove Consumer Features

The `apps/mobile/(consumer)/` folder should be **REMOVED**. Consumer features belong in `apps/consumer-mobile/`, not in the technician app.

**Files to Remove from apps/mobile:**
```
apps/mobile/app/(consumer)/_layout.tsx
apps/mobile/app/(consumer)/index.tsx
apps/mobile/app/(consumer)/search/
apps/mobile/app/(consumer)/request/
apps/mobile/app/(consumer)/jobs/
apps/mobile/app/(consumer)/profile/
apps/mobile/app/(consumer)/business/
apps/mobile/app/(consumer)/reviews/
apps/mobile/lib/consumer/   (if exists)
```

**Reason:** Per CampoTech vision, technician app and consumer app are separate applications.

### apps/consumer-mobile - Needs Proper App Structure

Currently has screens but no proper Expo Router app structure. Needs:
- [ ] Add `apps/consumer-mobile/app/` folder with Expo Router structure
- [ ] Move screens from `src/screens/` to `app/` routes
- [ ] Add `app.json` or `expo.json` configuration
- [ ] Add proper navigation layout

---

## Database Migrations Required

### Migration 1: Add Rating Model
```sql
CREATE TABLE "ratings" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ratings_token_key" ON "ratings"("token");
CREATE INDEX "ratings_organizationId_idx" ON "ratings"("organizationId");
CREATE INDEX "ratings_jobId_idx" ON "ratings"("jobId");
```

### Migration 2: Simplify UserRole Enum
```sql
-- Step 1: Update existing users
UPDATE "users" SET "role" = 'OWNER' WHERE "role" = 'ADMIN';
UPDATE "users" SET "role" = 'DISPATCHER' WHERE "role" = 'ACCOUNTANT';
UPDATE "users" SET "role" = 'TECHNICIAN' WHERE "role" = 'VIEWER';

-- Step 2: Create new enum
CREATE TYPE "UserRole_new" AS ENUM ('OWNER', 'DISPATCHER', 'TECHNICIAN');

-- Step 3: Alter column
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING "role"::text::"UserRole_new";

-- Step 4: Drop old enum
DROP TYPE "UserRole";

-- Step 5: Rename new enum
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
```

### Migration 3: Add PDF Template Settings
```sql
-- Add column to organizations
ALTER TABLE "organizations" ADD COLUMN "pdfTemplateSettings" JSONB DEFAULT '{}';
```

---

## Environment Variables

**No new environment variables required** for these corrections.

Existing variables that should be verified:
- `DATABASE_URL` - PostgreSQL connection
- `OPENAI_API_KEY` - For voice transcription (Whisper)
- `WHATSAPP_ACCESS_TOKEN` - WhatsApp Business API
- `AFIP_*` - AFIP integration variables

---

## Testing Checklist

After implementing corrections:

- [ ] Landing page loads at `/`
- [ ] Pricing shows correct values ($25, $55, $120)
- [ ] Sign up flow works
- [ ] Login works
- [ ] Dashboard loads with correct role permissions
- [ ] Only 3 roles visible in team management
- [ ] Rating page works at `/rate/[token]`
- [ ] Tracking page shows documents after job completion
- [ ] PDFs include "Powered by CampoTech" watermark
- [ ] Tier limits enforce correctly
- [ ] WhatsApp AI respects tier limits

---

## Priority Order

1. **HIGH** - Landing Page (blocks deployment)
2. **HIGH** - Tier Pricing Update (blocks sales)
3. **HIGH** - Role System Simplification (blocks user management)
4. **HIGH** - Rating Page (needed for Phase 2)
5. **MEDIUM** - Tracking Page Update
6. **MEDIUM** - PDF Watermark
7. **MEDIUM** - Market Position Analytics
8. **MEDIUM** - Voice Transcription API
9. **MEDIUM** - Feature Toggles
10. **LOW** - PDF Customization

---

## Document Version

- **Version**: 1.0
- **Last Updated**: December 2024
- **Applies To**: `apps/web` directory

*Powered by CampoTech*
