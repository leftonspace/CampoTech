# Implementation Plan Addendum: Strategic Features
## Version 1.1 | January 2026

This addendum adds **4 strategic growth features** to the existing implementation roadmap. Each feature is assigned to the most logical existing phase.

---

# FEATURE 1: FISCAL HEALTH DASHBOARD ("Traffic Light")
**Assigned Phase:** Phase 2 (Core Features) - Insert after Task 2.3.5
**Priority:** 🟡 HIGH (Monetributo compliance value-add)
**Estimated Effort:** 4 days

## Overview
A proactive dashboard widget warning Monotributistas when approaching their category billing limit. Uses "Green/Yellow/Red" indicators for immediate visual comprehension.

## Task 2.4: Fiscal Health Dashboard

### Task 2.4.1: Create Monotributo Category Reference Data
**Files to create:**
- `apps/web/lib/constants/monotributo-categories.ts`

```typescript
// Hardcoded 2024/2025 AFIP Monotributo limits (update annually)
export const MONOTRIBUTO_CATEGORIES = {
  A: { maxAnnual: 2108288.01, maxMonthly: 175690.67, name: 'Categoría A' },
  B: { maxAnnual: 3133941.63, maxMonthly: 261161.80, name: 'Categoría B' },
  C: { maxAnnual: 4387518.23, maxMonthly: 365626.52, name: 'Categoría C' },
  D: { maxAnnual: 5449094.55, maxMonthly: 454091.21, name: 'Categoría D' },
  E: { maxAnnual: 6416528.72, maxMonthly: 534710.73, name: 'Categoría E' },
  F: { maxAnnual: 8020661.10, maxMonthly: 668388.43, name: 'Categoría F' },
  G: { maxAnnual: 9614793.48, maxMonthly: 801232.79, name: 'Categoría G' },
  H: { maxAnnual: 11915838.24, maxMonthly: 992986.52, name: 'Categoría H' },
  I: { maxAnnual: 13337213.56, maxMonthly: 1111434.46, name: 'Categoría I (Solo servicios)' },
  J: { maxAnnual: 15285088.40, maxMonthly: 1273757.37, name: 'Categoría J (Solo servicios)' },
  K: { maxAnnual: 16957163.23, maxMonthly: 1413096.94, name: 'Categoría K (Solo servicios)' },
} as const;
```

**Acceptance Criteria:**
- [ ] All 2024/2025 Monotributo categories defined
- [ ] Easy to update annually when AFIP publishes new limits

### Task 2.4.2: Create Fiscal Health Service
**Files to create:**
- `apps/web/lib/services/fiscal-health.service.ts`

**Logic:**
```typescript
export class FiscalHealthService {
  async calculateFiscalHealth(orgId: string): Promise<FiscalHealthStatus> {
    // 1. Get org's declared Monotributo category from settings
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true }
    });
    
    const category = org.settings?.monotributoCategory || 'A';
    const limits = MONOTRIBUTO_CATEGORIES[category];
    
    // 2. Sum YTD invoiced amounts (AFIP CAE-issued only)
    const ytdTotal = await this.getYTDBilling(orgId);
    
    // 3. Calculate percentage and status
    const percentUsed = (ytdTotal / limits.maxAnnual) * 100;
    
    return {
      category,
      ytdBilling: ytdTotal,
      annualLimit: limits.maxAnnual,
      percentUsed,
      remainingAmount: limits.maxAnnual - ytdTotal,
      status: this.getTrafficLightStatus(percentUsed),
      recommendation: this.getComplianceRecommendation(percentUsed, category)
    };
  }
  
  private getTrafficLightStatus(percent: number): 'green' | 'yellow' | 'red' {
    if (percent < 70) return 'green';  // Healthy
    if (percent < 90) return 'yellow'; // Approaching limit
    return 'red';                       // At risk - consult accountant
  }
  
  private getComplianceRecommendation(percent: number, category: string): string {
    if (percent >= 90) {
      return 'Te recomendamos consultar con tu contador sobre la recategorización para mantener tu cumplimiento fiscal.';
    }
    if (percent >= 70) {
      return 'Estás acercándote al límite de tu categoría. Planificá con tu contador.';
    }
    return 'Tu facturación está dentro de los límites saludables de tu categoría.';
  }
}
```

### Task 2.4.3: Create Fiscal Health API Endpoint
**Files to create:**
- `apps/web/app/api/analytics/fiscal-health/route.ts`

### Task 2.4.4: Create Dashboard Widget Component
**Files to create:**
- `apps/web/components/dashboard/FiscalHealthWidget.tsx`

**Placement:** 
- ✅ Web Dashboard (primary)
- ✅ Mobile App - Profile screen (secondary, simplified)

**UI Mockup:**
```
┌────────────────────────────────────────┐
│ 🏛️ Salud Fiscal - Monotributo         │
├────────────────────────────────────────┤
│                                        │
│  Categoría: D                          │
│                                        │
│  ████████████░░░░░░░░ 62%             │
│  🟢 SALUDABLE                          │
│                                        │
│  Facturado YTD: $3,378,438            │
│  Límite anual:  $5,449,094            │
│  Disponible:    $2,070,656            │
│                                        │
│  ℹ️ Tu facturación está dentro de     │
│     los límites saludables.           │
│                                        │
│  [Ver detalles]                        │
└────────────────────────────────────────┘
```

**Mobile Simplified (Profile screen):**
```
┌────────────────────────────────────────┐
│ Monotributo: 🟢 62% usado              │
│ Disponible: $2,070,656                 │
└────────────────────────────────────────┘
```

### Task 2.4.5: Add Monotributo Category to Org Settings
**Files to modify:**
- `apps/web/app/(dashboard)/settings/business/page.tsx`
- `apps/web/app/api/settings/business/route.ts`

**Add dropdown to select Monotributo category in business settings.**

**Acceptance Criteria (Phase 2.4 Complete):**
- [ ] Monotributo category selectable in settings
- [ ] YTD billing calculated from CAE-issued invoices
- [ ] Traffic light widget on web dashboard
- [ ] Simplified indicator on mobile profile
- [ ] Wording focuses on "compliance" not "evasion"
- [ ] Recommendations suggest consulting accountant

---

# CRITICAL: COST-SAFE SAAS MODEL (🛡️ Monetization Rules)
**Applies to:** All Features
**Priority:** 🔴 CRITICAL (Must implement BEFORE Growth Engine launch)
**Estimated Effort:** 2 days

## Strategic Context: The Cost Risk

```
⚠️ PROBLEM IDENTIFIED:
┌────────────────────────────────────────────────────────────────┐
│  Giving free WhatsApp API access to 61,000 "Ghost Profiles"     │
│  would result in MASSIVE infrastructure costs.                  │
│                                                                  │
│  WhatsApp API Cost: ~$0.05/message × 61,000 = $3,050/month      │
│  (If each profile sends just 1 message/month)                   │
└────────────────────────────────────────────────────────────────┘

✅ SOLUTION: COST-SAFE SAAS MODEL
┌────────────────────────────────────────────────────────────────┐
│  FREE/TRIAL Experience = Zero cost to us                        │
│  PAID Experience = Unlocks premium API features                 │
│                                                                  │
│  Key Insight: The "Forever Free" public profile is our anchor.  │
│  We NEVER block their visibility. That's the free tier.         │
└────────────────────────────────────────────────────────────────┘
```

---

## Task 2.5.1: The "SaaS Trial" Time Bomb ⏱️
**Goal:** Convert users from "Claimed Profile" to "Paying Subscriber" by giving them a 3-week taste of professional power, then locking premium features.

### Schema Changes
**Files to modify:**
- `apps/web/prisma/schema.prisma`

```prisma
model Organization {
  // ... existing fields ...
  
  // Subscription & Trial Management
  subscriptionStatus    SubscriptionStatus @default(TRIAL)
  trialEndsAt           DateTime?          // Set on profile claim
  plan                  PlanType           @default(FREE)
  planExpiresAt         DateTime?          // For annual subscriptions
  stripeCustomerId      String?            // For payment processing
  stripeSubscriptionId  String?            
}

enum SubscriptionStatus {
  TRIAL           // 21-day trial, full access
  TRIAL_EXPIRED   // Trial ended, locked features
  ACTIVE          // Paying customer
  PAST_DUE        // Payment failed, grace period
  CANCELLED       // Subscription cancelled
  FREE_FOREVER    // Special accounts (partners, etc.)
}

enum PlanType {
  FREE            // Public profile only
  INITIAL         // $25/mo - Basic tools
  PROFESIONAL     // $55/mo - Full features
  EMPRESA         // $120/mo - Unlimited
}
```

### Trial Trigger Logic
**Files to modify:**
- `apps/web/app/api/claim/verify-otp/route.ts`

```typescript
// On successful profile claim:
async function handleSuccessfulClaim(userId: string, unclaimedProfileId: string) {
  // Create or link organization
  const org = await prisma.organization.upsert({
    where: { ownerId: userId },
    update: {},
    create: {
      name: `${user.name}'s Business`,
      ownerId: userId,
      // 🔥 THE TIME BOMB: Trial starts NOW
      subscriptionStatus: 'TRIAL',
      trialEndsAt: addDays(new Date(), 21), // 21 days from now
      plan: 'FREE',
    }
  });
  
  // Link unclaimed profile
  await prisma.unclaimedProfile.update({
    where: { id: unclaimedProfileId },
    data: {
      status: 'claimed',
      claimedByUserId: userId,
      claimedAt: new Date(),
    }
  });
}
```

### Trial Lockout Middleware
**Files to create:**
- `apps/web/middleware/subscription-guard.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

// Routes that require ACTIVE subscription (locked after trial)
const PREMIUM_ROUTES = [
  '/dashboard/invoices',      // Cannot create new fiscal documents
  '/dashboard/invoices/new',
  '/api/invoices',            // Block API too
  '/api/afip',                // Block AFIP integration
];

// Routes that become READ-ONLY after trial
const RESTRICTED_ROUTES = [
  '/dashboard/inventory',     // Can view, cannot edit
  '/dashboard/jobs/new',      // Cannot create new jobs
];

// Routes that are ALWAYS FREE (Forever Free anchor)
const FOREVER_FREE_ROUTES = [
  '/p/',                      // Public profile: /p/[slug]
  '/wa-redirect/',            // WhatsApp redirect
  '/track/',                  // Job tracking
  '/rate/',                   // Ratings
  '/verify-badge/',           // Badge verification
];

export async function subscriptionGuard(req: NextRequest, org: Organization) {
  const path = req.nextUrl.pathname;
  
  // Forever Free routes - NEVER block
  if (FOREVER_FREE_ROUTES.some(r => path.startsWith(r))) {
    return NextResponse.next();
  }
  
  // Check trial status
  const isTrialExpired = org.subscriptionStatus === 'TRIAL' && 
                         org.trialEndsAt && 
                         new Date() > org.trialEndsAt;
  
  const isLockedOut = isTrialExpired || 
                      org.subscriptionStatus === 'TRIAL_EXPIRED' ||
                      org.subscriptionStatus === 'CANCELLED';
  
  // Premium routes - BLOCK if locked out
  if (isLockedOut && PREMIUM_ROUTES.some(r => path.startsWith(r))) {
    // Redirect to upgrade page
    return NextResponse.redirect(new URL('/upgrade?reason=trial_expired', req.url));
  }
  
  // Restricted routes - READ-ONLY if locked out
  if (isLockedOut && RESTRICTED_ROUTES.some(r => path.startsWith(r))) {
    // For API routes, return 403
    if (path.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Subscription required', upgrade_url: '/upgrade' },
        { status: 403 }
      );
    }
    // For pages, add read-only flag to context
    req.headers.set('x-read-only', 'true');
  }
  
  return NextResponse.next();
}
```

### Trial Expiry UI
**Files to create:**
- `apps/web/components/trial/TrialBanner.tsx`
- `apps/web/app/(dashboard)/upgrade/page.tsx`

```
┌────────────────────────────────────────────────────────────────┐
│  ⚠️ Tu período de prueba termina en 5 días                        │
│  Después, perderás acceso a facturación e inventario.           │
│  Tu perfil público seguirá visible.                             │
│                                                                  │
│  [💳 Elegir Plan - desde $25/mes]                               │
└────────────────────────────────────────────────────────────────┘

[After expiry:]
┌────────────────────────────────────────────────────────────────┐
│  🔒 Tu período de prueba terminó                                  │
│                                                                  │
│  ❌ Facturación AFIP - Bloqueada                                 │
│  ❌ Inventario - Solo lectura                                    │
│  ✅ Perfil público - ¡Sigue activo!                              │
│  ✅ Recibir contactos por WhatsApp - ¡Sigue activo!              │
│                                                                  │
│  [💳 Suscribite desde $25/mes para desbloquear]                 │
└────────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Schema updated with `trialEndsAt` and `subscriptionStatus`
- [ ] Trial starts on profile claim (21 days)
- [ ] Premium routes blocked after trial
- [ ] Public profile routes ALWAYS accessible
- [ ] Upgrade page with pricing shown on lockout
- [ ] Trial countdown banner in dashboard

---

## Task 2.5.2: WhatsApp Cost Protection Architecture 💰
**Goal:** Strictly separate the "Free Redirect" from the "Paid API" to ensure zero-cost free tier.

### The Two WhatsApp Paths

```
┌────────────────────────────────────────────────────────────────┐
│                 WHATSAPP INTEGRATION MATRIX                      │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FREE / TRIAL TIER                  PAID TIER (PRO/BUSINESS)    │
│  ─────────────────────────────────  ──────────────────────────────  │
│                                                                  │
│  🔗 REDIRECT METHOD                 🤖 CLOUD API (BSP)            │
│  https://wa.me/{phone}             Meta Business API             │
│                                                                  │
│  ✅ Opens consumer's WA app         ✅ Interactive buttons        │
│  ✅ Pre-filled message              ✅ Rich templates             │
│  ✅ Zero server cost                ✅ Bot automation             │
│  ✅ No API calls                    ✅ Read receipts              │
│                                     ✅ Conversation analytics     │
│  💰 Cost: $0                        💰 Cost: ~$0.05/message       │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### Free Tier: Redirect Implementation
**Files to create:**
- `apps/web/app/wa-redirect/[slug]/route.ts`

```typescript
// apps/web/app/wa-redirect/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const org = await prisma.organization.findFirst({
    where: { slug: params.slug },
    select: { phone: true, name: true }
  });
  
  if (!org?.phone) {
    return NextResponse.redirect('/404');
  }
  
  // Track the click (zero cost - just DB write)
  await prisma.waRedirectClick.create({
    data: {
      organizationSlug: params.slug,
      referrer: req.headers.get('referer'),
      userAgent: req.headers.get('user-agent'),
    }
  });
  
  // Format phone for wa.me (remove +, spaces, dashes)
  const formattedPhone = org.phone.replace(/[^\d]/g, '');
  
  // Pre-filled message (optional)
  const message = encodeURIComponent(
    `Hola ${org.name}! Los encontré en CampoTech.`
  );
  
  // 🔑 THE MAGIC: Simple redirect, ZERO API cost
  const waUrl = `https://wa.me/${formattedPhone}?text=${message}`;
  
  return NextResponse.redirect(waUrl);
}
```

### Feature Gating by Plan
**Files to modify:**
- `apps/web/lib/features/whatsapp-features.ts`

```typescript
// apps/web/lib/features/whatsapp-features.ts

export const WHATSAPP_FEATURES = {
  // FREE / TRIAL - Always available
  redirect: {
    plans: ['FREE', 'INITIAL', 'PROFESIONAL', 'EMPRESA'],
    description: 'WhatsApp redirect link (wa.me)',
    cost: 0,
  },
  
  // PAID ONLY - Requires active subscription
  interactiveButtons: {
    plans: ['PROFESIONAL', 'EMPRESA'],
    description: 'Interactive button messages',
    cost: 0.05, // per message
  },
  
  aiBot: {
    plans: ['PROFESIONAL', 'EMPRESA'],
    description: 'AI-powered auto-responses',
    cost: 0.05, // per message + AI cost
  },
  
  templates: {
    plans: ['INICIAL', 'PROFESIONAL', 'EMPRESA'],
    description: 'Pre-approved message templates',
    cost: 0.05, // per message
  },
} as const;

// ⚠️ CRITICAL: Check before any API call
export function canUseWhatsAppAPI(org: Organization): boolean {
  // Never allow API for non-paying users
  if (org.subscriptionStatus !== 'ACTIVE') {
    return false;
  }
  
  // Only PRO and BUSINESS plans
  return ['PROFESIONAL', 'EMPRESA'].includes(org.plan);
}
```

### ⚠️ IMPORTANT: No "Free API Credits"

```
❌ REMOVED FROM PLAN:
────────────────────────────────────────────────────────────────
• "Free API Credits" concept - DELETED
• "Trial includes X WhatsApp messages" - DELETED
• Any form of free API access - DELETED

✅ REPLACED WITH:
────────────────────────────────────────────────────────────────
• Free tier = Redirect only (wa.me links)
• Paid tier = Full API access (buttons, bots, templates)
• Clear upgrade path with value proposition
```

**Acceptance Criteria:**
- [ ] `/wa-redirect/[slug]` works for all users (free)
- [ ] WhatsApp API calls blocked for non-PROFESIONAL/EMPRESA
- [ ] Click tracking for redirect links
- [ ] Clear messaging about upgrade benefits
- [ ] No "free credits" terminology anywhere

---

## Task 2.5.3: Plan Feature Matrix
**Goal:** Clear documentation of what's included in each tier.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                     PLAN FEATURE MATRIX                                 │
├───────────────────────────────────────────────────────────────────────────┤
│  Feature              │ FREE      │ TRIAL   │ INICIAL │ PRO     │ EMPRESA│
│                       │ $0        │ 21 días │ $25/mo  │ $55/mo  │ $120/mo│
├───────────────────────────────────────────────────────────────────────────┤
│  FOREVER FREE (never locked):                                            │
│  ──────────────────────────────────────────────────────────────────────── │
│  Public Profile       │ ✅        │ ✅      │ ✅      │ ✅      │ ✅     │
│  WhatsApp Redirect    │ ✅        │ ✅      │ ✅      │ ✅      │ ✅     │
│  Digital Badge        │ ✅        │ ✅      │ ✅      │ ✅      │ ✅     │
│  Ratings Display      │ ✅        │ ✅      │ ✅      │ ✅      │ ✅     │
├───────────────────────────────────────────────────────────────────────────┤
│  TRIAL FEATURES (21 days, then locked):                                  │
│  ──────────────────────────────────────────────────────────────────────── │
│  AFIP Invoicing       │ 🔒        │ ✅      │ ✅      │ ✅      │ ✅     │
│  Inventory Mgmt       │ 🔒        │ ✅      │ ✅      │ ✅      │ ✅     │
│  Job Management       │ 🔒        │ ✅      │ ✅      │ ✅      │ ✅     │
│  Fiscal Dashboard     │ 🔒        │ ✅      │ ✅      │ ✅      │ ✅     │
├───────────────────────────────────────────────────────────────────────────┤
│  PAID FEATURES (subscription required):                                  │
│  ──────────────────────────────────────────────────────────────────────── │
│  WA Templates         │ ❌        │ ❌      │ ✅      │ ✅      │ ✅     │
│  WA Interactive       │ ❌        │ ❌      │ ❌      │ ✅      │ ✅     │
│  WA AI Bot            │ ❌        │ ❌      │ ❌      │ ✅      │ ✅     │
│  Barcode Scanner      │ ❌        │ ❌      │ ✅      │ ✅      │ ✅     │
│  Multi-stop Nav       │ ❌        │ ❌      │ ❌      │ ✅      │ ✅     │
│  Team Members         │ ❌        │ ❌      │ 1       │ 5       │ ∞      │
│  Analytics            │ ❌        │ ❌      │ Basic   │ Full    │ Full   │
│                       │          │        │         │         │        │
└───────────────────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Feature matrix documented and enforced
- [ ] Each feature has plan check middleware 
- [ ] Upgrade prompts shown when blocked

---

# FEATURE 2: DIGITAL ENTRY BADGE (Gated Community Access) ✅ COMPLETE
**Assigned Phase:** Phase 4 (Onboarding Automation) - Insert after Task 4.1.3
**Priority:** 🟠 MEDIUM (Differentiation for Countries/gated communities)
**Estimated Effort:** 5 days | **Status:** ✅ Implemented January 2026

## Overview
A "Passport" feature for technicians entering gated communities (Countries). Dynamic QR code displays identity, ART insurance status, and background check status.

## Task 4.3: Digital Entry Badge System

### Task 4.3.1: Extend User Schema for Verification Documents
**Files to modify:**
- `apps/web/prisma/schema.prisma`

```prisma
model User {
  // ... existing fields ...
  
  // Professional Verification Documents
  artCertificateUrl       String?   // ART insurance certificate PDF
  artExpiryDate           DateTime? // ART expiration date
  artProvider             String?   // Insurance company name (e.g., "Galeno ART")
  artPolicyNumber         String?   // Policy number
  
  backgroundCheckStatus   BackgroundCheckStatus @default(pending)
  backgroundCheckDate     DateTime?
  backgroundCheckProvider String?   // e.g., "Veraz", "Nosis"
  
  // QR Badge
  badgeToken              String?   @unique // Secure token for QR validation
  badgeTokenExpiresAt     DateTime? // Token rotation (monthly)
}

enum BackgroundCheckStatus {
  pending
  approved
  rejected
  expired
}
```

### Task 4.3.2: Create Badge Generation Service
**Files to create:**
- `apps/web/lib/services/digital-badge.service.ts`

```typescript
export class DigitalBadgeService {
  async generateBadgeData(userId: string): Promise<BadgeData> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true }
    });
    
    // Generate or refresh badge token (valid 30 days)
    if (!user.badgeToken || user.badgeTokenExpiresAt < new Date()) {
      await this.refreshBadgeToken(userId);
    }
    
    return {
      technician: {
        name: user.name,
        photo: user.avatar,
        specialty: user.specialty,
      },
      organization: {
        name: user.organization.name,
        logo: user.organization.logo,
      },
      verification: {
        artStatus: this.getARTStatus(user),
        artExpiry: user.artExpiryDate,
        artProvider: user.artProvider,
        backgroundCheck: user.backgroundCheckStatus,
        backgroundCheckDate: user.backgroundCheckDate,
      },
      qrPayload: `${process.env.APP_URL}/verify-badge/${user.badgeToken}`,
      generatedAt: new Date(),
      validUntil: user.badgeTokenExpiresAt,
    };
  }
  
  private getARTStatus(user: User): 'valid' | 'expiring' | 'expired' | 'missing' {
    if (!user.artExpiryDate) return 'missing';
    const daysUntilExpiry = differenceInDays(user.artExpiryDate, new Date());
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry < 30) return 'expiring';
    return 'valid';
  }
}
```

### Task 4.3.3: Create Badge Verification Public Endpoint
**Files to create:**
- `apps/web/app/verify-badge/[token]/page.tsx` (Public page)
- `apps/web/app/api/verify-badge/[token]/route.ts`

**When security guard scans QR, they see:**
```
┌────────────────────────────────────────┐
│ ✅ VERIFICACIÓN DE ACCESO             │
├────────────────────────────────────────┤
│                                        │
│  [PHOTO]  Juan Pérez                   │
│           Electricista                 │
│           TechCorp SA                  │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  ✅ ART Vigente                        │
│     Galeno ART - Vence 15/06/2026     │
│                                        │
│  ✅ Antecedentes Verificados          │
│     Verificado el 01/12/2025          │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  🕐 Verificado: 04/01/2026 13:45      │
│                                        │
└────────────────────────────────────────┘
```

### Task 4.3.4: Mobile Badge Screen
**Files to create:**
- `apps/mobile/app/(tabs)/profile/badge.tsx`
- `apps/mobile/components/DigitalBadge.tsx`

**Mobile UI:**
```
┌────────────────────────────────────────┐
│ 🪪 Mi Credencial Digital               │
├────────────────────────────────────────┤
│                                        │
│          [QR CODE - Dynamic]           │
│                                        │
│  Mostrá este código al ingresar       │
│  a countries/barrios cerrados         │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  ART: ✅ Vigente (vence en 165 días)  │
│  Antecedentes: ✅ Verificados         │
│                                        │
│  [Actualizar documentos]               │
│                                        │
└────────────────────────────────────────┘
```

### Task 4.3.5: ART Certificate Upload Flow
**Files to modify:**
- `apps/web/app/(dashboard)/team/[userId]/page.tsx`
- `apps/web/app/api/verification/employee/route.ts`

**Add section for uploading ART certificate with expiry date picker.**

✅ **Phase 4.3 STATUS: COMPLETE (January 2026)**

**Acceptance Criteria:**
- [x] User schema extended with ART and background check fields (`OrganizationMember` model)
- [x] Badge generation with rotating secure token (`digital-badge.service.ts`)
- [x] QR code displays in mobile app (`apps/mobile/components/badge/DigitalBadge.tsx`)
- [x] Public verification page for security guards (`/verify-badge/[token]`)
- [x] ART certificate upload with expiry tracking (`/api/verification/employee`)
- [x] Expiry warnings (30 days before) - built into `getUsersWithExpiringART()`

**Implemented Files:**
| Task | Web | Mobile |
|------|-----|--------|
| 4.3.1: Schema | `prisma/schema.prisma` (lines 205-227) | - |
| 4.3.2: Badge Service | `lib/services/digital-badge.service.ts` | - |
| 4.3.3: Verification Page | `app/verify-badge/[token]/page.tsx` | - |
| 4.3.4: Mobile Badge | - | `app/(tabs)/profile/badge.tsx` |
| 4.3.5: ART Upload | `app/api/verification/employee/route.ts` | - |

---

# FEATURE 3: ANTI-EXCEL INVENTORY SCANNING
**Assigned Phase:** Phase 2 (Core Features) - Insert after Task 2.2.3
**Priority:** 🟡 HIGH (Mobile-native stock management)
**Estimated Effort:** 4 days

## Overview
Mobile camera barcode scanning for instant stock deduction. Scan → Select quantity → Auto-deduct from vehicle with warehouse fallback.

## Task 2.2.4: Barcode Scanning Integration

### Task 2.2.4.1: Add Expo Barcode Scanner
**Files to modify:**
- `apps/mobile/package.json`
- `apps/mobile/app.json`

```bash
pnpm add expo-barcode-scanner expo-camera
```

### Task 2.2.4.2: Create Barcode Scanner Component
**Files to create:**
- `apps/mobile/components/inventory/BarcodeScanner.tsx`

```typescript
import { CameraView, useCameraPermissions } from 'expo-camera';

export function BarcodeScanner({ onScan }: { onScan: (barcode: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    onScan(data);
  };
  
  return (
    <CameraView
      style={{ flex: 1 }}
      barcodeScannerSettings={{
        barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr'],
      }}
      onBarcodeScanned={handleBarcodeScanned}
    />
  );
}
```

### Task 2.2.4.3: Create Scan & Deduct Flow Screen
**Files to create:**
- `apps/mobile/app/(tabs)/inventory/scan.tsx`

**Flow:**
1. Open scanner
2. Scan product barcode
3. If found: Show product info + quantity picker
4. If not found: "Producto no encontrado en inventario"
5. Confirm → Call cascade deduction API
6. Show success/error + source summary

**UI:**
```
┌────────────────────────────────────────┐
│ 📷 Escanear Material                   │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │         [CAMERA VIEW]            │  │
│  │                                  │  │
│  │     Apuntá al código de barras   │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Último escaneado:                     │
│  ✓ Caño 1/2" (x2) - de Camioneta     │
│                                        │
└────────────────────────────────────────┘

[After scan - Bottom Sheet]
┌────────────────────────────────────────┐
│ Caño de cobre 1/2"                     │
│ Código: 7891234567890                  │
├────────────────────────────────────────┤
│                                        │
│  Cantidad:  [-] 1 [+]                  │
│                                        │
│  En camioneta: 5 disponibles          │
│  En depósito: 23 disponibles          │
│                                        │
│  [Descontar del stock]                 │
│                                        │
└────────────────────────────────────────┘
```

### Task 2.2.4.4: Offline Queue for Scanned Items
**Files to modify:**
- `apps/mobile/watermelon/models/index.ts` (add PendingStockDeduction model)
- `apps/mobile/lib/sync/sync-operations.ts`

**Offline behavior:**
- Scanned items queued in WatermelonDB
- Sync to server when online
- Show pending count: "3 materiales pendientes de sincronizar"

**Acceptance Criteria (Task 2.2.4 Complete):**
- [ ] Camera permissions requested
- [ ] Barcode scanner works (EAN-13, Code128, QR)
- [ ] Product lookup by barcode
- [ ] Quantity picker with cascade deduction
- [ ] Offline queue for scanned items
- [ ] Sync indicator for pending deductions

---

# FEATURE 4: THE GROWTH ENGINE (Unclaimed Profile System) ✅ COMPLETE
**Assigned Phase:** Phase 4 (Onboarding) - Insert after Task 4.2.2
**Priority:** 🟠 MEDIUM (Growth/acquisition strategy)
**Estimated Effort:** 8 days (includes activation workflow)
**Status:** ✅ COMPLETE - 2026-01-06
**Implemented:** Schema, API, landing pages, admin dashboard, all 3 scrapers (ERSEP, CACAAV, PDF parser)

## Overview
Pre-populate database with public professional data from validated sources to create "ghost profiles" that technicians can claim via SMS/WhatsApp verification. This is our **"land grab"** strategy to acquire users with zero CAC.

**Validated Data Sources - "The Gold Mines" (January 2026 Research):**
| Source | Region | Profession | Est. Records | Data Quality | Priority |
|--------|--------|------------|--------------|--------------|----------|
| ERSEP via volta.net.ar | Córdoba | Electricistas | **~33,000** | ⭐⭐⭐ Phone + Email | 🔴 CRITICAL |
| CACAAV | Nacional | HVAC/Refrigeración | **~23,000** | ⭐⭐ Mobile + City | 🟡 HIGH |
| Gasnor/GasNEA PDFs | Norte (Salta, Jujuy, Tucumán) | Gasistas | **~5,000** | ⭐⭐ Email + Matrícula | 🟢 MEDIUM |

**Total Addressable Profiles: ~61,000 professionals**

> ### ⚠️ LAUNCH GATE - OWNER APPROVAL REQUIRED
> 
> **All outbound messaging is BLOCKED by default.** The system will be built fully functional with the ability to:
> - Import and view all 61,000 profiles
> - Create draft campaigns
> - Preview WhatsApp templates
> 
> **However, NO messages will be sent until the owner:**
> 1. Completes the pre-launch checklist (bank account, legal entity, etc.)
> 2. Explicitly approves the launch at `/admin/growth-engine/launch`
> 
> This ensures payments can be processed before offering services.

## Task 4.4: Unclaimed Profile System

### Task 4.4.1: Create Unclaimed Profile Schema
**Files to modify:**
- `apps/web/prisma/schema.prisma`

```prisma
model UnclaimedProfile {
  id                String   @id @default(cuid())
  
  // Professional identity (from public data)
  fullName          String
  matriculaNumber   String   // Professional license number
  matriculaType     String   // GASISTA, ELECTRICISTA, HVAC, etc.
  matriculaAuthority String  // ERSEP, CACAAV, GASNOR, GASNEA, ENARGAS
  phone             String?  // If available from public records
  mobilePhone       String?  // Mobile specifically (CACAAV)
  email             String?
  
  // Location (from registration)
  province          String?
  locality          String?
  
  // Source tracking
  dataSource        String   // "ERSEP_SCRAPER", "CACAAV_SCRAPER", "GASNOR_PDF", "GASNEA_PDF"
  sourceRecordId    String?  // ID from source system
  sourceUrl         String?  // URL where data was scraped from
  scrapedAt         DateTime? // When data was last scraped
  importedAt        DateTime @default(now())
  
  // Claim status
  status            UnclaimedStatus @default(unclaimed)
  claimedByUserId   String?  @unique
  claimedAt         DateTime?
  claimVerificationCode String? // SMS/WhatsApp OTP
  claimVerificationExpiry DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  claimedBy         User?    @relation(fields: [claimedByUserId], references: [id])
  
  @@unique([matriculaNumber, matriculaAuthority])
  @@index([phone])
  @@index([mobilePhone])
  @@index([email])
  @@index([status])
  @@index([matriculaType])
  @@index([province])
  @@index([dataSource])
  @@map("unclaimed_profiles")
}

enum UnclaimedStatus {
  unclaimed
  verification_pending
  claimed
  rejected // Fraudulent claim attempt
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTREACH CAMPAIGN - LAUNCH APPROVAL GATE SYSTEM
// ⚠️ IMPORTANT: All outreach is BLOCKED until owner explicitly approves
// ═══════════════════════════════════════════════════════════════════════════════

model OutreachCampaign {
  id                String         @id @default(cuid())
  organizationId    String         // Which org owns this campaign
  name              String         // "ERSEP Initial Outreach"
  source            String         // "ERSEP", "CACAAV", etc.
  
  // 🔒 LAUNCH GATE - Campaign status
  status            CampaignStatus @default(draft)
  approvedAt        DateTime?      // When owner approved
  approvedBy        String?        // User ID who approved
  
  // WhatsApp Template
  templateName      String         // "profile_claim_product_first"
  templateStatus    TemplateStatus @default(not_submitted)
  templateContent   String?        // Template message content (for reference)
  
  // Targeting
  targetProvince    String?        // Optional province filter
  targetProfession  String?        // Optional profession filter
  targetCount       Int            @default(0) // Profiles matching criteria
  
  // Progress Metrics (all start at 0)
  sentCount         Int            @default(0)
  deliveredCount    Int            @default(0)
  clickedCount      Int            @default(0)
  claimedCount      Int            @default(0)
  errorCount        Int            @default(0)
  
  // Rate Limiting
  dailyLimit        Int            @default(1000) // Messages per day
  batchSize         Int            @default(50)   // Messages per batch
  batchDelayMs      Int            @default(60000) // Delay between batches
  
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  launchedAt        DateTime?      // When campaign actually started sending
  completedAt       DateTime?      // When all messages sent
  
  organization      Organization   @relation(fields: [organizationId], references: [id])
  
  @@index([organizationId])
  @@index([status])
  @@index([source])
  @@map("outreach_campaigns")
}

enum CampaignStatus {
  draft              // Being configured
  ready              // All config done, awaiting approval
  approved           // 🔒 Owner approved, ready to launch
  launching          // Currently sending
  paused             // Temporarily stopped
  completed          // All messages sent
  cancelled          // Cancelled before completion
}

enum TemplateStatus {
  not_submitted      // Template not yet sent to Meta
  pending_approval   // Waiting for Meta review
  approved           // Ready to use
  rejected           // Need to revise
}
```

### Task 4.4.2: Build ERSEP Scraper (Córdoba - Electricity) 🔴 CRITICAL
**Source:** `volta.net.ar` (ERSEP public registry)
**Target Volume:** ~33,000 electricians
**Strategy:** Playwright script to iterate paginated HTML results
**Data Points:** Name, Phone, Email, Category, Matrícula
**Priority:** CRITICAL - Highest quality contact data (phone + email)

**Files to create:**
- `apps/worker/src/scrapers/ersep-scraper.ts`
- `apps/worker/src/scrapers/ersep-scraper.test.ts`

```typescript
// apps/worker/src/scrapers/ersep-scraper.ts
import { chromium } from 'playwright';
import { prisma } from '@/lib/prisma';

interface ERSEPRecord {
  name: string;
  phone: string | null;
  email: string | null;
  category: string; // "Instalador Electricista Categoría I", etc.
  matricula: string;
}

export class ERSEPScraper {
  private baseUrl = 'https://volta.net.ar';
  
  /**
   * Scrape ERSEP electrician registry from volta.net.ar
   * Iterates through paginated HTML results
   */
  async scrapeAll(): Promise<ERSEPRecord[]> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const records: ERSEPRecord[] = [];
    let currentPage = 1;
    let hasNextPage = true;
    
    while (hasNextPage) {
      await page.goto(`${this.baseUrl}/matriculados?page=${currentPage}`);
      
      // Wait for table to load
      await page.waitForSelector('.matriculados-table', { timeout: 10000 });
      
      // Extract records from current page
      const pageRecords = await page.evaluate(() => {
        const rows = document.querySelectorAll('.matriculados-table tbody tr');
        return Array.from(rows).map(row => ({
          name: row.querySelector('.nombre')?.textContent?.trim() || '',
          phone: row.querySelector('.telefono')?.textContent?.trim() || null,
          email: row.querySelector('.email')?.textContent?.trim() || null,
          category: row.querySelector('.categoria')?.textContent?.trim() || '',
          matricula: row.querySelector('.matricula')?.textContent?.trim() || '',
        }));
      });
      
      records.push(...pageRecords);
      
      // Check for next page
      hasNextPage = await page.evaluate(() => {
        const nextButton = document.querySelector('.pagination .next:not(.disabled)');
        return nextButton !== null;
      });
      
      currentPage++;
      
      // Rate limiting - be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    await browser.close();
    return records;
  }
  
  /**
   * Import scraped records into UnclaimedProfile table
   */
  async importRecords(records: ERSEPRecord[]): Promise<{ imported: number; updated: number }> {
    let imported = 0;
    let updated = 0;
    
    for (const record of records) {
      if (!record.matricula || !record.name) continue;
      
      const result = await prisma.unclaimedProfile.upsert({
        where: {
          matriculaNumber_matriculaAuthority: {
            matriculaNumber: record.matricula,
            matriculaAuthority: 'ERSEP',
          }
        },
        create: {
          fullName: record.name,
          matriculaNumber: record.matricula,
          matriculaType: 'ELECTRICISTA',
          matriculaAuthority: 'ERSEP',
          phone: record.phone,
          email: record.email,
          province: 'Córdoba',
          dataSource: 'ERSEP_SCRAPER',
          sourceUrl: 'https://volta.net.ar/matriculados',
          scrapedAt: new Date(),
        },
        update: {
          fullName: record.name,
          phone: record.phone,
          email: record.email,
          scrapedAt: new Date(),
        }
      });
      
      if (result.createdAt === result.updatedAt) {
        imported++;
      } else {
        updated++;
      }
    }
    
    return { imported, updated };
  }
}
```

**Acceptance Criteria:** ✅ IMPLEMENTED
- [x] Scraper handles pagination correctly ✅
- [x] Extracts Name, Phone, Email, Category, Matricula ✅
- [x] Respects rate limiting (1.5 req/sec) ✅
- [x] Handles DOM changes gracefully (try/catch) ✅
- [x] Logs errors without crashing ✅
- [x] Admin UI to trigger scraper ✅


### Task 4.4.3: Build CACAAV Scraper (National - HVAC)
**Source:** `cacaav.com.ar/matriculados/listado`
**Target Volume:** ~23,000 HVAC technicians
**Strategy:** JSDOM HTML Table DOM parsing (simpler than ERSEP)
**Data Points:** Name, Mobile Phone, City

**Files to create:**
- `apps/worker/src/scrapers/cacaav-scraper.ts`
- `apps/worker/src/scrapers/cacaav-scraper.test.ts`

```typescript
// apps/worker/src/scrapers/cacaav-scraper.ts
import { JSDOM } from 'jsdom';
import { prisma } from '@/lib/prisma';

interface CACAAVRecord {
  name: string;
  mobilePhone: string | null;
  city: string | null;
  matricula: string;
}

export class CACAAVScraper {
  private baseUrl = 'https://cacaav.com.ar/matriculados/listado';
  
  /**
   * Scrape CACAAV HVAC registry
   * Simple HTML table parsing - no pagination needed (single page)
   */
  async scrape(): Promise<CACAAVRecord[]> {
    const response = await fetch(this.baseUrl);
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const records: CACAAVRecord[] = [];
    
    // Find the matriculados table
    const table = document.querySelector('table.matriculados, #matriculados-table, .listado-table');
    if (!table) {
      console.error('CACAAV: Could not find matriculados table');
      return [];
    }
    
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 3) {
        records.push({
          name: cells[0]?.textContent?.trim() || '',
          mobilePhone: cells[1]?.textContent?.trim() || null,
          city: cells[2]?.textContent?.trim() || null,
          matricula: cells[3]?.textContent?.trim() || this.generateMatriculaFromName(cells[0]?.textContent?.trim() || ''),
        });
      }
    });
    
    return records;
  }
  
  /**
   * Import scraped records into UnclaimedProfile table
   */
  async importRecords(records: CACAAVRecord[]): Promise<{ imported: number; updated: number }> {
    let imported = 0;
    let updated = 0;
    
    for (const record of records) {
      if (!record.name) continue;
      
      // Generate stable matricula if not provided
      const matricula = record.matricula || `CACAAV-${this.hashName(record.name)}`;
      
      const result = await prisma.unclaimedProfile.upsert({
        where: {
          matriculaNumber_matriculaAuthority: {
            matriculaNumber: matricula,
            matriculaAuthority: 'CACAAV',
          }
        },
        create: {
          fullName: record.name,
          matriculaNumber: matricula,
          matriculaType: 'HVAC',
          matriculaAuthority: 'CACAAV',
          mobilePhone: record.mobilePhone,
          locality: record.city,
          dataSource: 'CACAAV_SCRAPER',
          sourceUrl: 'https://cacaav.com.ar/matriculados/listado',
          scrapedAt: new Date(),
        },
        update: {
          fullName: record.name,
          mobilePhone: record.mobilePhone,
          locality: record.city,
          scrapedAt: new Date(),
        }
      });
      
      if (result.createdAt === result.updatedAt) {
        imported++;
      } else {
        updated++;
      }
    }
    
    return { imported, updated };
  }
  
  private hashName(name: string): string {
    // Simple hash for stable ID generation
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
  
  private generateMatriculaFromName(name: string): string {
    return `CACAAV-${this.hashName(name)}`;
  }
}
```

**Acceptance Criteria:** ✅ IMPLEMENTED
- [x] Parses HTML table correctly ✅
- [x] Extracts Name, Mobile Phone, City ✅
- [x] Handles missing fields gracefully ✅
- [x] Generates stable matricula ID if not present ✅
- [x] Province inference from city ✅
- [x] Admin UI to trigger scraper ✅

### Task 4.4.4: Build PDF Pipeline for Gasnor/GasNEA (North - Gas)
**Source:** Static PDF Lists from distributor websites
**Strategy:** Implement `pdfplumber` (Python) to extract tabular data from PDFs
**Data Points:** Name, Email (often present), Matricula ID

**Files to create:**
- `apps/worker/src/parsers/gasnor-pdf.py`
- `apps/worker/src/parsers/gasnea-pdf.py`
- `apps/worker/src/parsers/pdf-import-coordinator.ts`

```python
# apps/worker/src/parsers/gasnor-pdf.py
"""
PDF Parser for Gasnor/GasNEA matriculados lists
Uses pdfplumber for tabular data extraction
"""

import pdfplumber
import json
import sys
import re
from typing import List, Dict, Optional

def extract_matriculados(pdf_path: str) -> List[Dict]:
    """
    Extract matriculados data from Gasnor/GasNEA PDF
    
    Expected PDF format:
    | Nombre | Email | Matrícula | Localidad |
    |--------|-------|-----------|-----------|
    
    Returns list of dicts with extracted data
    """
    records = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            # Extract tables from page
            tables = page.extract_tables()
            
            for table in tables:
                if not table:
                    continue
                    
                # Skip header row
                for row in table[1:]:
                    if len(row) < 3:
                        continue
                    
                    # Clean and parse row data
                    name = clean_text(row[0]) if row[0] else None
                    email = extract_email(row[1]) if len(row) > 1 else None
                    matricula = clean_text(row[2]) if len(row) > 2 else None
                    locality = clean_text(row[3]) if len(row) > 3 else None
                    
                    if name and matricula:
                        records.append({
                            'name': name,
                            'email': email,
                            'matricula': matricula,
                            'locality': locality,
                            'page': page_num + 1
                        })
    
    return records

def clean_text(text: Optional[str]) -> Optional[str]:
    """Remove extra whitespace and normalize text"""
    if not text:
        return None
    return ' '.join(text.split()).strip()

def extract_email(text: Optional[str]) -> Optional[str]:
    """Extract email from text, handling common OCR issues"""
    if not text:
        return None
    
    # Email regex pattern
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    match = re.search(email_pattern, text)
    
    if match:
        return match.group(0).lower()
    return None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No PDF path provided'}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    source = sys.argv[2] if len(sys.argv) > 2 else 'GASNOR'
    
    try:
        records = extract_matriculados(pdf_path)
        
        # Add source metadata
        for record in records:
            record['source'] = source
            record['source_file'] = pdf_path
        
        print(json.dumps({
            'success': True,
            'count': len(records),
            'records': records
        }))
    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'success': False
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
```

```typescript
// apps/worker/src/parsers/pdf-import-coordinator.ts
import { spawn } from 'child_process';
import { prisma } from '@/lib/prisma';
import path from 'path';

interface PDFRecord {
  name: string;
  email: string | null;
  matricula: string;
  locality: string | null;
  source: string;
  source_file: string;
}

export class PDFImportCoordinator {
  
  /**
   * Process a Gasnor/GasNEA PDF and import records
   */
  async processGasnorPDF(pdfPath: string, source: 'GASNOR' | 'GASNEA'): Promise<{ imported: number; updated: number }> {
    const records = await this.extractFromPDF(pdfPath, source);
    return this.importRecords(records, source);
  }
  
  /**
   * Call Python pdfplumber script to extract data
   */
  private async extractFromPDF(pdfPath: string, source: string): Promise<PDFRecord[]> {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, 'gasnor-pdf.py');
      const python = spawn('python3', [pythonScript, pdfPath, source]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed: ${stderr}`));
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          if (result.success) {
            resolve(result.records);
          } else {
            reject(new Error(result.error));
          }
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${stdout}`));
        }
      });
    });
  }
  
  /**
   * Import extracted records into database
   */
  private async importRecords(records: PDFRecord[], source: 'GASNOR' | 'GASNEA'): Promise<{ imported: number; updated: number }> {
    let imported = 0;
    let updated = 0;
    
    const authority = source === 'GASNOR' ? 'GASNOR' : 'GASNEA';
    const provinces = source === 'GASNOR' 
      ? ['Salta', 'Jujuy', 'Tucumán', 'Santiago del Estero']
      : ['Corrientes', 'Chaco', 'Formosa', 'Misiones'];
    
    for (const record of records) {
      if (!record.matricula || !record.name) continue;
      
      // Infer province from locality if possible
      let province = provinces[0]; // Default to first province in region
      
      const result = await prisma.unclaimedProfile.upsert({
        where: {
          matriculaNumber_matriculaAuthority: {
            matriculaNumber: record.matricula,
            matriculaAuthority: authority,
          }
        },
        create: {
          fullName: record.name,
          matriculaNumber: record.matricula,
          matriculaType: 'GASISTA',
          matriculaAuthority: authority,
          email: record.email,
          locality: record.locality,
          province,
          dataSource: `${source}_PDF`,
          sourceUrl: record.source_file,
          scrapedAt: new Date(),
        },
        update: {
          fullName: record.name,
          email: record.email,
          locality: record.locality,
          scrapedAt: new Date(),
        }
      });
      
      if (result.createdAt === result.updatedAt) {
        imported++;
      } else {
        updated++;
      }
    }
    
    return { imported, updated };
  }
}
```

**Acceptance Criteria:** ✅ IMPLEMENTED (TypeScript pdf-parse instead of Python pdfplumber)
- [x] PDF text extraction via pdf-parse library ✅
- [x] Handles multi-page PDFs ✅
- [x] Email extraction with regex validation ✅
- [x] TypeScript implementation (no Python dependency) ✅
- [x] Imports records to UnclaimedProfile table ✅
- [x] Admin import UI with file upload ✅
- [x] Error logging per record ✅

### Task 4.4.4a: Gasnor Website Email Enrichment Scraper 📧
**Source:** `https://www.naturgynoa.com.ar/instaladores` (Gasnor public registry)
**Purpose:** Enrich existing Gasnor profiles imported from PDF with email addresses
**Strategy:** Playwright browser automation to hover over email elements and extract hidden emails
**Match Key:** Matricula number (since Gasnor doesn't have CUIT in PDF)

**Why This is Needed:**
The Gasnor PDF contains: MAT | CAT | APELLIDO | NOMBRE | DOMICILIO | LOCALIDAD | PROVINCIA | TELEFONO | CELULAR
But the **EMAIL column only shows "Email" link** - the actual email is revealed on hover.
This task enriches the already-imported profiles with their email addresses.

**Files to create:**
- `apps/web/lib/scrapers/gasnor-email-scraper.ts`
- `apps/web/app/api/admin/growth-engine/scrapers/gasnor-emails/route.ts`

```typescript
// apps/web/lib/scrapers/gasnor-email-scraper.ts
import { chromium, Browser, Page } from 'playwright';
import { prisma } from '@/lib/prisma';

interface GasnorEmailRecord {
  matricula: string;
  email: string | null;
  name: string;
}

export class GasnorEmailScraper {
  private baseUrl = 'https://www.naturgynoa.com.ar/instaladores';
  
  /**
   * Scrape Gasnor website to extract emails hidden behind hover
   * Then match with existing profiles by matricula number
   */
  async scrapeEmails(): Promise<{ extracted: number; enriched: number; errors: number }> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    let extracted = 0;
    let enriched = 0;
    let errors = 0;
    
    try {
      console.log('[GasnorEmailScraper] Starting email extraction...');
      
      // Navigate to instaladores page
      await page.goto(this.baseUrl, { waitUntil: 'networkidle' });
      
      // Click "Buscar" button to load results
      const searchButton = page.locator('button:has-text("Buscar"), input[type="submit"][value*="Buscar"]');
      if (await searchButton.count() > 0) {
        await searchButton.click();
        await page.waitForLoadState('networkidle');
      }
      
      // Wait for results table
      await page.waitForSelector('table, .results, .instaladores-list', { timeout: 10000 });
      
      // Get all rows with email elements
      const rows = await page.locator('tr, .instalador-row').all();
      
      for (const row of rows) {
        try {
          // Extract matricula from row (usually first column)
          const matriculaCell = row.locator('td:first-child, .matricula');
          const matricula = await matriculaCell.textContent();
          
          if (!matricula || !/^\d{1,4}$/.test(matricula.trim())) {
            continue; // Skip non-data rows
          }
          
          // Find email element (hover trigger)
          const emailTrigger = row.locator('[class*="email"], a[title*="mail"], td:has-text("Email")');
          
          if (await emailTrigger.count() > 0) {
            // Hover to reveal email
            await emailTrigger.hover();
            await page.waitForTimeout(500); // Wait for tooltip/reveal
            
            // Try to get email from:
            // 1. Tooltip that appeared
            // 2. href="mailto:..." that became visible
            // 3. Text content that changed on hover
            
            let email: string | null = null;
            
            // Check for mailto link
            const mailtoLink = row.locator('a[href^="mailto:"]');
            if (await mailtoLink.count() > 0) {
              const href = await mailtoLink.getAttribute('href');
              email = href?.replace('mailto:', '') || null;
            }
            
            // Check for visible email text
            if (!email) {
              const emailText = await row.textContent();
              const emailMatch = emailText?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
              email = emailMatch ? emailMatch[0] : null;
            }
            
            // Check tooltip
            if (!email) {
              const tooltip = page.locator('[role="tooltip"], .tooltip, [class*="popover"]');
              if (await tooltip.count() > 0) {
                const tooltipText = await tooltip.textContent();
                const emailMatch = tooltipText?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                email = emailMatch ? emailMatch[0] : null;
              }
            }
            
            if (email) {
              extracted++;
              console.log(`[GasnorEmailScraper] Found email for matricula ${matricula}: ${email}`);
              
              // Enrich existing profile
              const updated = await this.enrichProfile(matricula.trim(), email.toLowerCase());
              if (updated) enriched++;
            }
          }
        } catch (rowError) {
          console.error('[GasnorEmailScraper] Error processing row:', rowError);
          errors++;
        }
        
        // Rate limiting - be nice to the server
        await page.waitForTimeout(300);
      }
      
      // Check for pagination
      const nextPage = page.locator('a:has-text("Siguiente"), .pagination .next, a[rel="next"]');
      if (await nextPage.count() > 0 && await nextPage.isVisible()) {
        console.log('[GasnorEmailScraper] Found pagination, continuing to next page...');
        await nextPage.click();
        await page.waitForLoadState('networkidle');
        // Recursive call for next page would go here
        // For safety, implement iterative pagination with max pages
      }
      
    } catch (error) {
      console.error('[GasnorEmailScraper] Fatal error:', error);
      throw error;
    } finally {
      await browser.close();
    }
    
    console.log(`[GasnorEmailScraper] Complete: ${extracted} emails extracted, ${enriched} profiles enriched, ${errors} errors`);
    
    return { extracted, enriched, errors };
  }
  
  /**
   * Update existing profile with email, matching by matricula
   */
  private async enrichProfile(matricula: string, email: string): Promise<boolean> {
    try {
      // Find profiles with this matricula from GASNOR source
      const profiles = await prisma.unclaimedProfile.findMany({
        where: {
          source: 'GASNOR',
          matricula: matricula,
          email: null, // Only update if email is missing
        },
      });
      
      if (profiles.length === 0) {
        console.log(`[GasnorEmailScraper] No profile found for matricula ${matricula}`);
        return false;
      }
      
      // Update all matching profiles with email
      await prisma.unclaimedProfile.updateMany({
        where: {
          source: 'GASNOR',
          matricula: matricula,
          email: null,
        },
        data: {
          email: email,
          scrapedAt: new Date(),
        },
      });
      
      console.log(`[GasnorEmailScraper] Enriched ${profiles.length} profile(s) with email`);
      return true;
    } catch (error) {
      console.error(`[GasnorEmailScraper] Error enriching profile ${matricula}:`, error);
      return false;
    }
  }
}

// Singleton instance
let scraperInstance: GasnorEmailScraper | null = null;

export function getGasnorEmailScraper(): GasnorEmailScraper {
  if (!scraperInstance) {
    scraperInstance = new GasnorEmailScraper();
  }
  return scraperInstance;
}
```

**Admin API Endpoint:**
```typescript
// apps/web/app/api/admin/growth-engine/scrapers/gasnor-emails/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getGasnorEmailScraper } from '@/lib/scrapers/gasnor-email-scraper';

export async function POST(request: Request) {
  const session = await getServerSession();
  
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const scraper = getGasnorEmailScraper();
    const result = await scraper.scrapeEmails();
    
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[API] GasnorEmailScraper error:', error);
    return NextResponse.json(
      { error: 'Scraper failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

**Package Dependencies:**
```bash
pnpm add playwright @playwright/test
npx playwright install chromium  # Install browser binary
```

**Workflow:**
1. **First:** Import Gasnor PDF via existing import UI → Creates profiles with `phone`, `matricula`, no `email`
2. **Then:** Run email enrichment scraper → Updates profiles with `email` field
3. **Match:** Uses `matricula` number to link website email with PDF profile

**UI Integration (Admin Dashboard):**
Add button to Growth Engine profiles page:
```tsx
<button onClick={() => fetch('/api/admin/growth-engine/scrapers/gasnor-emails', { method: 'POST' })}>
  📧 Enrich Gasnor Emails
</button>
```

**Acceptance Criteria:**
- [ ] Playwright opens Gasnor instaladores page
- [ ] Clicks "Buscar" to load results
- [ ] Hovers over each email element to reveal hidden email
- [ ] Extracts email using multiple fallback methods (mailto, text, tooltip)
- [ ] Matches to existing profile by matricula number
- [ ] Updates profile with email (only if currently null)
- [ ] Handles pagination for complete extraction
- [ ] Rate limiting (300ms between rows, 1s between pages)
- [ ] Admin button in dashboard to trigger enrichment
- [ ] Logs extraction progress and errors

### Task 4.4.5: Create Claim Profile API Flow
**Files to create:**
- `apps/web/app/api/claim-profile/search/route.ts`
- `apps/web/app/api/claim-profile/request/route.ts`
- `apps/web/app/api/claim-profile/verify/route.ts`

**Flow:**
1. `GET /claim-profile/search?matricula=12345` - Find unclaimed profile
2. `POST /claim-profile/request` - Send SMS/WhatsApp OTP to registered phone
3. `POST /claim-profile/verify` - Verify OTP, link to user account

### Task 4.4.6: Create Public Claim Landing Page
**Files to create:**
- `apps/web/app/claim/page.tsx`
- `apps/web/app/claim/[matricula]/page.tsx`

**Marketing page where professionals can search for and claim their profile:**
```
┌────────────────────────────────────────┐
│ 🔍 ¿Sos profesional matriculado?      │
├────────────────────────────────────────┤
│                                        │
│ Buscá tu matrícula para reclamar     │
│ tu perfil en CampoTech                │
│                                        │
│ [Número de matrícula: ________]       │
│ [Ente: ERSEP ▼]                        │
│       CACAAV                           │
│       GASNOR                           │
│       GASNEA                           │
│                                        │
│ [Buscar mi perfil]                    │
│                                        │
│ ─────────────────────────────────────│
│                                        │
│ ✅ Tu perfil ya tiene:                │
│    • Matrícula verificada             │
│    • Datos profesionales cargados     │
│    • Listo para recibir trabajos      │
│                                        │
└────────────────────────────────────────┘
```

### Task 4.4.7: Admin Import Dashboard & Scraper Management (ENHANCED)
**Files to create:**
- `apps/web/app/(dashboard)/admin/growth-engine/page.tsx`
- `apps/web/app/(dashboard)/admin/growth-engine/profiles/page.tsx`
- `apps/web/app/(dashboard)/admin/growth-engine/campaigns/page.tsx`
- `apps/web/app/api/admin/scrapers/run/route.ts`
- `apps/web/app/api/admin/scrapers/status/route.ts`
- `apps/web/app/api/admin/unclaimed-profiles/route.ts`

**⚠️ LAUNCH GATE: All outreach is BLOCKED until owner explicitly approves**

**Admin Dashboard Features:**

1. **Import Overview with Warning Banner:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Growth Engine Dashboard                                      │
│                                                                 │
│ ⚠️ OUTBOUND MESSAGING PAUSED                                    │
│ Waiting for owner approval before launching campaigns.          │
│ [Go to Launch Checklist →]                                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ IMPORTED PROFILES BY SOURCE:                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Source   │ Total  │ W/Phone │ W/Email │ Claimed │ Conv %   │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ERSEP    │ 33,247 │ 28,901  │ 25,432  │ 0       │ 0%       │ │
│ │ CACAAV   │ 23,156 │ 19,287  │ 0       │ 0       │ 0%       │ │
│ │ GASNOR   │ 3,421  │ 0       │ 2,156   │ 0       │ 0%       │ │
│ │ GASNEA   │ 1,892  │ 0       │ 1,423   │ 0       │ 0%       │ │
│ │ ─────────────────────────────────────────────────────────── │ │
│ │ TOTAL    │ 61,716 │ 48,188  │ 29,011  │ 0       │ 0%       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ SCRAPER CONTROLS:                                               │
│ [Run ERSEP Scraper] [Run CACAAV Scraper] [Upload PDF]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

2. **Profile Browser (VIEW ALL IMPORTED DATA):**
```
┌─────────────────────────────────────────────────────────────────┐
│ � Profile Browser                                 [Export CSV] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ FILTERS:                                                        │
│ Source: [All ▼]  Province: [All ▼]  Status: [Unclaimed ▼]      │
│ Search: [_________________________________] [🔍]                 │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Name           │ Matrícula│ Type        │ Source │ Province│ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Juan Pérez     │ 12345    │ ELECTRICISTA│ ERSEP  │ Córdoba │ │
│ │ María García   │ 67890    │ HVAC        │ CACAAV │ Buenos A│ │
│ │ Carlos López   │ 11111    │ GASISTA     │ GASNOR │ Salta   │ │
│ │ Ana Rodríguez  │ 22222    │ ELECTRICISTA│ ERSEP  │ Córdoba │ │
│ │ ...            │          │             │        │         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Showing 1-50 of 61,716    [< Prev] [1] [2] [3] ... [Next >]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

3. **Campaign Management (LOCKED):**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📤 Outreach Campaigns                                           │
│                                                                 │
│ ⚠️ CAMPAIGNS LOCKED - Complete pre-launch checklist first       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ DRAFT CAMPAIGNS:                                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Name                 │ Source │ Target  │ Status  │ Actions │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ERSEP Córdoba Launch │ ERSEP  │ 28,901  │ 🔒 DRAFT│ [Edit]  │ │
│ │ CACAAV Nacional      │ CACAAV │ 19,287  │ 🔒 DRAFT│ [Edit]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [+ Create New Campaign] [🔒 Launch - LOCKED]                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**API Endpoints:**
```typescript
// GET /api/admin/unclaimed-profiles
// Query params: source, province, status, search, page, limit
// Returns: Paginated list of all imported profiles

// GET /api/admin/unclaimed-profiles/stats
// Returns: Aggregate stats by source (total, with_phone, with_email, claimed)

// POST /api/admin/scrapers/run
// Body: { scraper: 'ERSEP' | 'CACAAV' }
// Triggers scraper job (async)

// GET /api/admin/scrapers/status
// Returns: Last run status for each scraper

// GET /api/admin/campaigns
// Returns: All campaigns with status

// POST /api/admin/campaigns
// Body: { name, source, targetProvince?, targetProfession? }
// Creates new campaign in DRAFT status
```

**Acceptance Criteria (Phase 4.4 Complete):** ✅ COMPLETE - 2026-01-06
- [x] UnclaimedProfile schema created with source tracking ✅
- [x] OutreachCampaign schema with Launch Gate ✅
- [x] ERSEP scraper functional (volta.net.ar) - ~33k records ✅
- [x] CACAAV scraper functional (cacaav.com.ar) - ~23k records ✅
- [x] Gasnor/GasNEA PDF parser functional (pdf-parse) - ~5k records ✅
- [x] Search by matricula number ✅
- [x] Public landing page for claim flow ✅
- [x] **Admin dashboard with profile browser (view all data)** ✅
- [x] **Stats by source with phone/email counts** ✅
- [x] **Campaign management in DRAFT mode only** ✅
- [x] **Warning banner: "Outreach locked pending approval"** ✅
- [x] Conversion metrics by source ✅
- [x] Scraper management UI ✅

---

## Phase 4.5: THE ACTIVATION WORKFLOW (🛡️ Trust-First Strategy)
**Estimated Effort:** 2 days
**Priority:** 🔴 CRITICAL (Must launch WITH Phase 4.4)

### Overview: The "Trust Anchor" Problem
Sending unsolicited WhatsApp messages with links is a **phishing red flag**. We need a strategy that builds trust BEFORE asking for action.

**Core Insight:** If someone Googles "CampoTech" and finds our site, they trust us. If we ask them to Google us, we're leveraging their own verification process.

```
TRADITIONAL APPROACH (Risky):          OUR APPROACH (Trust-First):
┌─────────────────────┐                 ┌─────────────────────┐
│ "Click this link"    │                 │ "Google 'CampoTech'" │
│   [suspicious URL]   │                 │   (self-verify)      │
└─────────────────────┘                 └─────────────────────┘
         │                                          │
         ▼                                          ▼
   ❌ IGNORED                              ✅ TRUSTED
   (looks like spam)                      (they verified us)
```

### Task 4.5.1: SEO & Identity Setup (Prerequisite) 🏁
**Goal:** Ensure searching "CampoTech" or "CampoTech Matrícula" ranks #1 on Google immediately.

**Files to create/modify:**
- `apps/web/app/reclamar/page.tsx` (or `/claim`)
- `apps/web/app/sitemap.ts`
- Google Search Console configuration

**Actions:**
1. **Submit sitemap to Google Search Console**
   - Include `/reclamar` landing page
   - Priority: 1.0, changefreq: daily

2. **SEO Metadata for Claim Page:**
   ```tsx
   // apps/web/app/reclamar/page.tsx
   export const metadata: Metadata = {
     title: 'CampoTech | Reclamá tu Perfil de Matriculado',
     description: 'Encontrá y reclamá tu perfil profesional en CampoTech. Verificamos tu matrícula de ERSEP, CACAAV, Gasnor y más.',
     keywords: ['CampoTech', 'matriculado', 'reclamar perfil', 'ERSEP', 'CACAAV', 'gasista', 'electricista'],
     openGraph: {
       title: 'CampoTech - Perfil Profesional Verificado',
       description: 'Tu matrícula ya está en nuestro sistema. Reclamá tu perfil gratuito.',
       url: 'https://campotech.com.ar/reclamar',
     }
   };
   ```

3. **Google Business Profile** (if not exists)
   - Verify business for local search
   - Link to `/reclamar` page

**Acceptance Criteria:**
- [ ] "CampoTech" search shows our site as #1 result
- [ ] "CampoTech matricula" search shows claim page
- [ ] Sitemap submitted and indexed
- [ ] Meta descriptions optimized for trust

---

### Task 4.5.2: The "Product-First" Trust Anchor WhatsApp Template 📩
**Goal:** Send outreach messages that sell the TOOL, not just the directory listing.

**⚠️ LAUNCH GATE: Build template system but DO NOT submit to Meta or send messages yet!**

**Key Insight:** Professionals pay for tools that save time (Invoicing), not just for leads.

**Files to create:**
- `apps/web/lib/templates/unclaimed-outreach.ts`
- `apps/web/lib/services/outreach.service.ts`
- `apps/web/app/api/admin/outreach/send/route.ts` (with launch gate check)

**WhatsApp Template (SAVE FOR LATER - DO NOT SUBMIT TO META YET):**
```
Template Name: profile_claim_product_first
Category: UTILITY
Language: es_AR

👋 Hola {{1}},

Encontramos tu matrícula {{2}} en los registros de {{3}}.

💸 **Probá nuestra App de Facturación Profesional GRATIS por 3 semanas.**

✅ Facturá con AFIP en 2 clicks
✅ Control de inventario
✅ Perfil público verificado

🔍 **Buscá 'CampoTech' en Google** para empezar.

O entrá directo: {{4}}

¿Preguntas? Respondé este mensaje.
```

**Template Variables:**
- `{{1}}` = First name (e.g., "Juan")
- `{{2}}` = Matricula number (e.g., "12345")
- `{{3}}` = Authority (e.g., "ERSEP Córdoba")
- `{{4}}` = Short URL (e.g., "campotech.com.ar/r/abc123")

**Key Design Decisions (UPDATED):**
1. **"App de Facturación Profesional"** - Sell the TOOL, not the listing
2. **"GRATIS por 3 semanas"** - Clear trial period, no bait-and-switch
3. **Specific benefits** - Invoicing, Inventory, Profile (power features)
4. **"Buscá CampoTech"** - Trust anchor via Google search
5. **"Respondé este mensaje"** - Enable conversation

**Why Product-First Works Better:**
```
OLD APPROACH:                       NEW APPROACH:
┌──────────────────────────────┐      ┌──────────────────────────────┐
│ "Claim your profile"           │      │ "Try our Invoicing App"     │
│                                │      │ "Free for 3 weeks"          │
└──────────────────────────────┘      └──────────────────────────────┘
         ↓                                       ↓
  "Why do I need this?"              "I HATE invoicing! Let me try!"
  (low engagement)                        (high engagement)
```

**Outreach Service with LAUNCH GATE:**
```typescript
// apps/web/lib/services/outreach.service.ts
export class OutreachService {
  private readonly DAILY_LIMIT = 1000; // Messages per day
  private readonly BATCH_SIZE = 50;     // Messages per batch
  private readonly BATCH_DELAY = 60000; // 1 minute between batches
  
  // 🔒 LAUNCH GATE - All send functions check this first
  private readonly LAUNCH_BLOCKED_MESSAGE = 
    '🔒 Campaign launch is blocked. Owner approval required. ' +
    'Complete pre-launch checklist at /admin/growth-engine/launch';
  
  /**
   * Check if campaigns can be launched
   * Returns false until owner explicitly approves
   */
  async canLaunchCampaigns(organizationId: string): Promise<boolean> {
    const campaign = await prisma.outreachCampaign.findFirst({
      where: { 
        organizationId,
        status: 'approved' 
      }
    });
    return !!campaign;
  }
  
  /**
   * Send campaign - 🔒 BLOCKED until approved
   */
  async sendCampaign(campaignId: string): Promise<void> {
    const campaign = await prisma.outreachCampaign.findUnique({
      where: { id: campaignId }
    });
    
    // 🔒 LAUNCH GATE CHECK
    if (campaign?.status !== 'approved') {
      throw new Error(this.LAUNCH_BLOCKED_MESSAGE);
    }
    
    // Only proceeds if explicitly approved
    const profiles = await this.getUncontactedProfiles(campaign.source, this.DAILY_LIMIT);
    
    for (let i = 0; i < profiles.length; i += this.BATCH_SIZE) {
      const batch = profiles.slice(i, i + this.BATCH_SIZE);
      await this.sendBatch(batch);
      await this.delay(this.BATCH_DELAY);
    }
  }
}
```

**Acceptance Criteria (BUILD ONLY - NO SENDING):**
- [ ] WhatsApp template code saved locally (DO NOT submit to Meta)
- [ ] OutreachService with rate limiting logic
- [ ] **🔒 LAUNCH GATE: All send functions blocked by default**
- [ ] **🔒 Campaign status must be 'approved' before any sending**
- [ ] Tracking schema ready: sent, delivered, clicked, claimed
- [ ] Template preview in admin UI
- [ ] **⚠️ Warning banner: "Outreach paused - pending owner approval"**

---

### Task 4.5.3: The "Pre-Validation" Search Page (✅ Trust Builder) 
**Goal:** When they search, immediately prove we have their data before asking for action.

**URL:** `/reclamar` (primary) or `/claim` (redirect)

**Files to create:**
- `apps/web/app/reclamar/page.tsx`
- `apps/web/app/api/claim/validate/route.ts`
- `apps/web/components/claim/ProfilePreview.tsx`

**UX Flow:**
```
┌────────────────────────────────────────────────┐
│                                                │
│   🔍 Verificá si tu perfil ya existe            │
│                                                │
│   Ingresá tu número de matrícula:              │
│   ┌────────────────────────────────────────┐  │
│   │ 12345                              🔍 │  │
│   └────────────────────────────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘
                         │
                         ▼ (API call)
┌────────────────────────────────────────────────┐
│                                                │
│   ✅ ¡Matrícula Verificada!                     │
│                                                │
│   ┌────────────────────────────────────────┐  │
│   │ 👤 Juan P****z                          │  │
│   │    Electricista - ERSEP Córdoba        │  │
│   │    Matrícula: 12345                    │  │
│   │                                        │  │
│   │    📱 Tel: ****-1234                    │  │
│   │    📧 Email: j***@***.com               │  │
│   └────────────────────────────────────────┘  │
│                                                │
│   ¿Este sos vos?                               │
│                                                │
│   [ ✅ Sí, reclamar mi perfil ]                │
│                                                │
└────────────────────────────────────────────────┘
```

**Privacy-First Data Masking:**
```typescript
// apps/web/lib/utils/mask-pii.ts
export function maskName(name: string): string {
  // "Juan Pérez" -> "Juan P****z"
  const parts = name.split(' ');
  return parts.map((part, i) => {
    if (i === 0) return part; // Keep first name
    if (part.length <= 2) return part;
    return part[0] + '****' + part[part.length - 1];
  }).join(' ');
}

export function maskPhone(phone: string): string {
  // "3514123456" -> "****-3456"
  return '****-' + phone.slice(-4);
}

export function maskEmail(email: string): string {
  // "juan@empresa.com" -> "j***@***.com"
  const [local, domain] = email.split('@');
  const [name, tld] = domain.split('.');
  return `${local[0]}***@***.${tld}`;
}
```

**API Response:**
```typescript
// apps/web/app/api/claim/validate/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const matricula = searchParams.get('matricula');
  
  const profile = await prisma.unclaimedProfile.findFirst({
    where: {
      matriculaNumber: matricula,
      status: 'unclaimed'
    }
  });
  
  if (!profile) {
    return Response.json({ 
      found: false,
      message: 'No encontramos esta matrícula. ¿Está bien escrita?' 
    });
  }
  
  // Return MASKED data only - prove we have it without exposing PII
  return Response.json({
    found: true,
    preview: {
      name: maskName(profile.fullName),
      type: profile.matriculaType,
      authority: profile.matriculaAuthority,
      phone: profile.phone ? maskPhone(profile.phone) : null,
      email: profile.email ? maskEmail(profile.email) : null,
      province: profile.province,
    },
    claimToken: generateClaimToken(profile.id), // Short-lived token
  });
}
```

**Why This Works (Psychology):**
1. **Instant gratification** - They see their name immediately
2. **Proof we're legit** - We already have their public data
3. **Privacy respected** - Masked data shows we're careful
4. **Low commitment** - Just "confirm this is you"
5. **No login required** - Reduce friction to zero

**Acceptance Criteria:**
- [ ] `/reclamar` page with search box
- [ ] API returns masked preview of profile
- [ ] "Matrícula Verificada" success state
- [ ] Claim button leads to SMS/WhatsApp verification
- [ ] Track: searches, found, not found, claimed
- [ ] Mobile-first responsive design

---

### Task 4.5.4: Claim Verification Flow (SMS/WhatsApp OTP)
**Goal:** Verify ownership of the profile via the phone number on file.

**Files to create:**
- `apps/web/app/api/claim/request-otp/route.ts`
- `apps/web/app/api/claim/verify-otp/route.ts`
- `apps/web/app/reclamar/verificar/page.tsx`

**Flow:**
```
[ Reclamar mi perfil ]
         │
         ▼
┌────────────────────────────────────────┐
│  Enviamos un código al:              │
│  📱 ****-1234                         │
│                                        │
│  [WhatsApp] [SMS]                      │
└────────────────────────────────────────┘
         │
         ▼ (OTP sent)
┌────────────────────────────────────────┐
│  Ingresá el código de 6 dígitos:      │
│                                        │
│  [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ] [ 6 ]  │
│                                        │
│  ¿No lo recibiste? [Reenviar]         │
└────────────────────────────────────────┘
         │
         ▼ (OTP verified)
┌────────────────────────────────────────┐
│  🎉 ¡Perfil Reclamado!                  │
│                                        │
│  Bienvenido a CampoTech, Juan.        │
│  Tu matrícula está verificada.         │
│                                        │
│  [ Completar mi perfil → ]            │
└────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] OTP via WhatsApp (preferred) or SMS
- [ ] 6-digit code, 10-minute expiry
- [ ] Rate limiting: 3 attempts per hour
- [ ] On success: create User, link to profile
- [ ] Redirect to onboarding flow

---

### Task 4.5.5: Launch Approval Gate (🔒 OWNER APPROVAL REQUIRED) 🆕
**Goal:** Prevent ANY outbound messages until owner explicitly approves after completing business prerequisites.

**⚠️ THIS IS THE CRITICAL SAFETY GATE - NO OUTREACH UNTIL APPROVED**

**Files to create:**
- `apps/web/app/(dashboard)/admin/growth-engine/launch/page.tsx`
- `apps/web/app/api/admin/growth-engine/launch/route.ts`
- `apps/web/lib/services/launch-gate.service.ts`

**Pre-Launch Checklist UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 🚀 Launch Growth Engine                                         │
│                                                                 │
│ ⚠️ IMPORTANT: Complete ALL items before launching campaigns     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ BUSINESS PREREQUISITES:                                         │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [ ] Argentine bank account configured                       │ │
│ │ [ ] Mercado Pago business account connected                 │ │
│ │ [ ] Legal entity (SAS/SRL) registered with CUIT             │ │
│ │ [ ] AFIP registration complete (Monotributo/RI)             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ TECHNICAL PREREQUISITES:                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [ ] WhatsApp Business API configured                        │ │
│ │ [ ] WhatsApp template submitted to Meta                     │ │
│ │ [ ] Template approved by Meta (UTILITY category)            │ │
│ │ [ ] Test campaign sent to 10 profiles (verified working)    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ CONFIRMATION:                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [ ] I understand this will send 1,000+ messages per day     │ │
│ │ [ ] I have verified all payment processing is working       │ │
│ │ [ ] I am ready to handle incoming inquiries                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ [🔒 LAUNCH CAMPAIGNS]                                           │
│ Button disabled until all items checked                         │
│                                                                 │
│ ⚠️ This action cannot be undone.                                │
│ Messages will be sent according to campaign settings.           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Launch Gate Service:**
```typescript
// apps/web/lib/services/launch-gate.service.ts

interface LaunchChecklist {
  // Business Prerequisites
  bankAccountConfigured: boolean;
  mercadoPagoConnected: boolean;
  legalEntityRegistered: boolean;
  afipRegistrationComplete: boolean;
  
  // Technical Prerequisites
  whatsappApiConfigured: boolean;
  templateSubmittedToMeta: boolean;
  templateApprovedByMeta: boolean;
  testCampaignSent: boolean;
  
  // Confirmation
  understandsMessageVolume: boolean;
  paymentProcessingVerified: boolean;
  readyForInquiries: boolean;
}

export class LaunchGateService {
  /**
   * Check if all prerequisites are met
   */
  canLaunch(checklist: LaunchChecklist): boolean {
    return Object.values(checklist).every(v => v === true);
  }
  
  /**
   * Approve launch - OWNER ONLY
   * Sets organization.settings.growthEngineLaunched = true
   * Logs approval with timestamp and user ID
   */
  async approveLaunch(
    organizationId: string, 
    userId: string,
    checklist: LaunchChecklist
  ): Promise<void> {
    if (!this.canLaunch(checklist)) {
      throw new Error('Cannot launch: checklist incomplete');
    }
    
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        settings: {
          ...existingSettings,
          growthEngine: {
            launched: true,
            launchedAt: new Date().toISOString(),
            launchedBy: userId,
            checklist: checklist,
          }
        }
      }
    });
    
    // Log the approval
    console.log(`[Launch Gate] Growth Engine approved by ${userId} at ${new Date()}`);
  }
  
  /**
   * Check if growth engine is launched for an organization
   */
  async isLaunched(organizationId: string): Promise<boolean> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true }
    });
    
    return org?.settings?.growthEngine?.launched === true;
  }
}
```

**API Endpoint:**
```typescript
// apps/web/app/api/admin/growth-engine/launch/route.ts

// GET - Check launch status and get checklist
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'OWNER') {
    return Response.json({ error: 'Owner only' }, { status: 403 });
  }
  
  const launchGate = new LaunchGateService();
  const isLaunched = await launchGate.isLaunched(session.organizationId);
  
  return Response.json({
    launched: isLaunched,
    canLaunch: false, // Always false until checklist submitted
    message: isLaunched 
      ? 'Growth Engine is active' 
      : '⚠️ Complete checklist to launch'
  });
}

// POST - Approve launch (OWNER ONLY)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'OWNER') {
    return Response.json({ error: 'Owner only' }, { status: 403 });
  }
  
  const { checklist } = await request.json();
  
  const launchGate = new LaunchGateService();
  
  if (!launchGate.canLaunch(checklist)) {
    return Response.json({ 
      error: 'Checklist incomplete',
      message: 'Complete all items before launching'
    }, { status: 400 });
  }
  
  await launchGate.approveLaunch(
    session.organizationId, 
    session.userId,
    checklist
  );
  
  return Response.json({
    success: true,
    message: '🚀 Growth Engine launched! Campaigns can now be sent.',
    launchedAt: new Date().toISOString()
  });
}
```

**Acceptance Criteria:**
- [ ] Pre-launch checklist page at `/admin/growth-engine/launch`
- [ ] All checklist items must be checked before launch enabled
- [ ] **🔒 OWNER role required to approve launch**
- [ ] Launch approval logged with timestamp and user ID
- [ ] `organization.settings.growthEngine.launched` flag
- [ ] All send functions check this flag before proceeding
- [ ] Warning banners throughout Growth Engine until launched

---

**Acceptance Criteria (Phase 4.5 Complete):**
- [ ] SEO optimized claim page ranking on Google
- [ ] WhatsApp template built and saved (NOT submitted to Meta)
- [ ] Pre-validation search shows masked preview
- [ ] OTP verification flow working
- [ ] End-to-end claim journey < 2 minutes
- [ ] Tracking: funnel conversion at each step
- [ ] **🔒 LAUNCH GATE: All outreach BLOCKED by default**
- [ ] **🔒 Pre-launch checklist with owner-only approval**
- [ ] **⚠️ Warning banners: "Outreach paused - pending owner approval"**
- [ ] **📧 Email channel ready as primary outreach method**

---

## Phase 4.6: Email Outreach Channel (📧 PRIMARY OUTREACH)
**Estimated Effort:** 2 days
**Priority:** 🔴 CRITICAL (Cheapest path to 29k contacts)

> ### 💡 MULTI-CHANNEL OUTREACH STRATEGY
>
> **Phase 1 (Email First - $15/month):** Target 29,000 profiles with email addresses
> - ERSEP: ~25,432 emails
> - Gasnor/GasNEA: ~3,579 emails
> - Cost: $15/month (SendGrid) or $2.90 total (AWS SES)
> - Time to complete: 2-3 days
>
> **Phase 2 (WhatsApp BSP - Deferred):** Based on email conversion success
> - Target: 32,000 profiles without email (CACAAV mainly)
> - Cost: ~$2,000 for full reach
> - Decision: Wait until email proves conversion before investing

### Task 4.6.1: Email Provider Integration (SendGrid/Resend)
**Files to create:**
- `apps/web/lib/services/email-outreach.service.ts`
- `apps/web/lib/email/templates/claim-profile.tsx`
- `apps/web/app/api/admin/outreach/email/send/route.ts`

**Provider Options (choose one):**
```typescript
// Option 1: SendGrid ($15/month = 50k emails)
// Option 2: Resend ($20/month = 50k emails, better DX)
// Option 3: AWS SES ($0.10/1000 emails, lowest cost)

// apps/web/lib/services/email-outreach.service.ts
import { Resend } from 'resend'; // or SendGrid

export class EmailOutreachService {
  private resend = new Resend(process.env.RESEND_API_KEY);
  
  private readonly DAILY_LIMIT = 10000; // 10k/day with paid plan
  private readonly BATCH_SIZE = 100;    // 100 emails per batch
  private readonly BATCH_DELAY = 1000;  // 1 second between batches
  
  /**
   * Send outreach email to unclaimed profile
   */
  async sendClaimEmail(profile: UnclaimedProfile): Promise<void> {
    const claimUrl = `${process.env.APP_URL}/reclamar?m=${profile.matriculaNumber}`;
    
    await this.resend.emails.send({
      from: 'CampoTech <hola@campotech.com.ar>',
      to: profile.email!,
      subject: `${profile.fullName}, tu matrícula ${profile.matriculaNumber} ya está en CampoTech`,
      react: ClaimProfileEmail({
        name: profile.fullName.split(' ')[0],
        matricula: profile.matriculaNumber,
        authority: profile.matriculaAuthority,
        claimUrl,
      }),
    });
  }
  
  /**
   * Send batch campaign - respects rate limits
   */
  async sendEmailCampaign(campaignId: string): Promise<void> {
    const campaign = await prisma.outreachCampaign.findUnique({
      where: { id: campaignId }
    });
    
    // 🔒 LAUNCH GATE CHECK
    if (campaign?.status !== 'approved') {
      throw new Error('Campaign not approved');
    }
    
    const profiles = await this.getProfilesWithEmail(campaign.source, this.DAILY_LIMIT);
    
    for (let i = 0; i < profiles.length; i += this.BATCH_SIZE) {
      const batch = profiles.slice(i, i + this.BATCH_SIZE);
      await Promise.all(batch.map(p => this.sendClaimEmail(p)));
      await this.delay(this.BATCH_DELAY);
    }
  }
}
```

**Acceptance Criteria:**
- [ ] SendGrid or Resend integrated
- [ ] API keys in environment variables
- [ ] Rate limiting (10k/day, 100/batch)
- [ ] Respects Launch Gate approval

---

### Task 4.6.2: Email Template (React Email)
**Files to create:**
- `apps/web/lib/email/templates/claim-profile.tsx`

**Email Template Design:**
```tsx
// apps/web/lib/email/templates/claim-profile.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface ClaimProfileEmailProps {
  name: string;
  matricula: string;
  authority: string;
  claimUrl: string;
}

export function ClaimProfileEmail({ name, matricula, authority, claimUrl }: ClaimProfileEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Tu matrícula {matricula} ya está en CampoTech</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>👋 Hola {name},</Heading>
          
          <Text style={text}>
            Encontramos tu matrícula <strong>{matricula}</strong> en los registros de {authority}.
          </Text>
          
          <Text style={text}>
            Tu perfil profesional ya está listo en CampoTech. Solo necesitás reclamarlo para:
          </Text>
          
          <Section style={benefits}>
            <Text style={benefitItem}>✅ Facturar con AFIP en 2 clicks</Text>
            <Text style={benefitItem}>✅ Recibir pedidos de clientes por WhatsApp</Text>
            <Text style={benefitItem}>✅ Control de inventario y materiales</Text>
            <Text style={benefitItem}>✅ Perfil público verificado con tu matrícula</Text>
          </Section>
          
          <Text style={text}>
            <strong>Probá GRATIS por 21 días.</strong> Sin tarjeta de crédito.
          </Text>
          
          <Section style={buttonContainer}>
            <Button style={button} href={claimUrl}>
              Reclamar mi perfil →
            </Button>
          </Section>
          
          <Text style={footer}>
            ¿Preguntas? Respondé este email o escribinos por WhatsApp.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' };
const container = { backgroundColor: '#ffffff', margin: '0 auto', padding: '40px', borderRadius: '8px' };
const h1 = { color: '#1f2937', fontSize: '24px', fontWeight: 'bold' };
const text = { color: '#374151', fontSize: '16px', lineHeight: '24px' };
const benefits = { backgroundColor: '#ecfdf5', padding: '20px', borderRadius: '8px', margin: '20px 0' };
const benefitItem = { color: '#059669', fontSize: '14px', margin: '8px 0' };
const buttonContainer = { textAlign: 'center' as const, margin: '32px 0' };
const button = { backgroundColor: '#059669', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' };
const footer = { color: '#9ca3af', fontSize: '14px', marginTop: '32px' };
```

**Acceptance Criteria:**
- [ ] React Email template created
- [ ] Responsive design
- [ ] Clear CTA button
- [ ] Benefits highlighted
- [ ] Unsubscribe link (required for compliance)

---

### Task 4.6.3: Email Campaign Dashboard
**Files to create:**
- `apps/web/app/(dashboard)/admin/growth-engine/email/page.tsx`
- `apps/web/app/api/admin/outreach/email/campaigns/route.ts`

**Dashboard Features:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📧 Email Outreach Dashboard                                     │
│                                                                 │
│ ⚠️ OUTREACH PAUSED - Pending owner approval                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ PROFILES WITH EMAIL:                                            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Source    │ Total  │ Sent │ Opened │ Clicked │ Claimed     │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ERSEP     │ 25,432 │ 0    │ 0      │ 0       │ 0           │ │
│ │ GASNOR    │ 2,156  │ 0    │ 0      │ 0       │ 0           │ │
│ │ GASNEA    │ 1,423  │ 0    │ 0      │ 0       │ 0           │ │
│ │ ───────────────────────────────────────────────────────────│ │
│ │ TOTAL     │ 29,011 │ 0    │ 0      │ 0       │ 0           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ EMAIL CAMPAIGNS:                                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Name                │ Source │ Target │ Status  │ Actions   │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ERSEP First Wave    │ ERSEP  │ 10,000 │ 🔒 DRAFT│ [Preview] │ │
│ │ ERSEP Second Wave   │ ERSEP  │ 15,432 │ 🔒 DRAFT│ [Preview] │ │
│ │ Gasnor/GasNEA       │ GASNOR │ 3,579  │ 🔒 DRAFT│ [Preview] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [+ Create Email Campaign] [📧 Preview Template] [🔒 Send - LOCKED]│
│                                                                 │
│ ESTIMATED COST:                                                 │
│ • SendGrid: $15/month (unlimited for 50k)                       │
│ • AWS SES: $2.90 for 29k emails                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Tracking Schema Addition:**
```prisma
// Add to UnclaimedProfile model
model UnclaimedProfile {
  // ... existing fields
  
  // Email tracking
  emailSentAt       DateTime?
  emailOpenedAt     DateTime?
  emailClickedAt    DateTime?
  emailBouncedAt    DateTime?
  emailError        String?
}
```

**Acceptance Criteria:**
- [ ] Email campaign dashboard at `/admin/growth-engine/email`
- [ ] Create/edit draft email campaigns
- [ ] Preview email template with sample data
- [ ] Tracking: sent, opened, clicked, bounced
- [ ] Stats by source
- [ ] Send button locked until approved

---

**Acceptance Criteria (Phase 4.6 Complete):**
- [ ] Email provider integrated (SendGrid/Resend/SES)
- [ ] Professional email template
- [ ] Campaign management dashboard
- [ ] Tracking for opens/clicks
- [ ] Rate limiting (10k/day)
- [ ] **🔒 LAUNCH GATE: Respects owner approval**
- [ ] **📧 Ready to send 29k emails in 2-3 days**

---

## Phase 4.7: WhatsApp BSP Outreach (⏳ DEFERRED)
**Status:** Deferred until email proves conversion
**Estimated Effort:** 3 days (when implemented)
**Trigger:** Email conversion rate > 1% claim rate

> ### ⏳ DEFERRED PHASE - Implement After Email Success
>
> **When to implement:**
> - Email campaigns have been sent
> - Conversion rate meets target (>1% claims)
> - Revenue justifies $2,000 BSP investment
>
> **What this covers:**
> - WhatsApp Business API integration (Twilio/MessageBird/360dialog)
> - Template submission to Meta for approval
> - Send campaigns to 32,000 phone-only profiles (CACAAV)
> - Cost: ~$0.0625/message = ~$2,000 total

---

## Phase 4.8: WhatsApp AI Credits & BSP Reseller System
**Estimated Effort:** 5 days
**Priority:** 🟡 HIGH (Revenue infrastructure + AI feature enablement)

> ### 💡 BUSINESS MODEL: Credit-Based WhatsApp AI
>
> **How it works:**
> - Clients purchase credit packages upfront
> - 1 credit = 1 WhatsApp conversation
> - Credits enable AI copilot, auto-responses, analytics
> - When credits run out → ONE-TIME grace period → then wa.me fallback
>
> **Why credits over subscription:**
> - Predictable costs for us (no surprise overages)
> - Fair pricing for clients (pay for what you use)
> - Clear value proposition (credits = AI features)

---

### Task 4.8.1: WhatsApp Credits Schema
**Files to create:**
- `apps/web/prisma/schema.prisma` (add to existing)
- `apps/web/lib/services/whatsapp-credits.service.ts`

```prisma
// WhatsApp AI Credits System
model WhatsAppCredits {
  id              String   @id @default(cuid())
  organizationId  String   @unique
  
  // Credit balance
  creditsBalance  Int      @default(0)  // Current available credits
  creditsPurchased Int     @default(0)  // Lifetime purchased
  creditsUsed     Int      @default(0)  // Lifetime used
  
  // ⚠️ ONE-TIME GRACE PERIOD (Anti-abuse)
  graceCreditsTotal     Int      @default(50)   // One-time 50 free credits
  graceCreditsUsed      Int      @default(0)    // How many used (max 50)
  graceActivatedAt      DateTime?               // When grace was triggered
  graceEverActivated    Boolean  @default(false) // TRUE = never again eligible
  graceForfeited        Boolean  @default(false) // TRUE = paid without using
  
  // Alert tracking (reset each credit purchase)
  alert75SentAt   DateTime?
  alert90SentAt   DateTime?
  alert100SentAt  DateTime?
  
  // Status
  status          WhatsAppCreditStatus @default(inactive)
  
  // BSP Integration
  bspPhoneNumber  String?  // Provisioned WhatsApp number
  bspNumberId     String?  // Meta's phone number ID
  bspStatus       BSPStatus @default(not_provisioned)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  organization    Organization @relation(fields: [organizationId], references: [id])
  purchases       CreditPurchase[]
  
  @@map("whatsapp_credits")
}

model CreditPurchase {
  id              String   @id @default(cuid())
  creditsAccountId String
  
  packageName     String   // "starter", "standard", "professional", "enterprise"
  creditsAmount   Int      // 200, 500, 1000, 5000
  priceARS        Float    // Price in Argentine Pesos
  priceUSD        Float    // Price in USD (for reference)
  
  // Payment
  paymentId       String?  // Mercado Pago payment ID
  paymentStatus   String   @default("pending")
  
  createdAt       DateTime @default(now())
  
  creditsAccount  WhatsAppCredits @relation(fields: [creditsAccountId], references: [id])
  
  @@map("credit_purchases")
}

enum WhatsAppCreditStatus {
  inactive        // Never purchased credits
  active          // Has credits, AI working
  grace           // Out of credits, using one-time grace
  exhausted       // Grace used OR forfeited, wa.me fallback active
}

enum BSPStatus {
  not_provisioned // No number assigned
  pending         // Number requested, awaiting Meta approval
  active          // Number provisioned and working
  suspended       // Number suspended (payment issues)
}
```

**One-Time Grace Period Logic:**
```typescript
// apps/web/lib/services/whatsapp-credits.service.ts

export class WhatsAppCreditsService {
  /**
   * Deduct a credit for a conversation
   * Returns false if no credits available (triggers downgrade)
   */
  async useCredit(organizationId: string): Promise<{ success: boolean; mode: 'paid' | 'grace' | 'exhausted' }> {
    const account = await prisma.whatsAppCredits.findUnique({
      where: { organizationId }
    });
    
    if (!account) {
      return { success: false, mode: 'exhausted' };
    }
    
    // Has paid credits → use them
    if (account.creditsBalance > 0) {
      await prisma.whatsAppCredits.update({
        where: { id: account.id },
        data: {
          creditsBalance: { decrement: 1 },
          creditsUsed: { increment: 1 },
          status: 'active',
        }
      });
      return { success: true, mode: 'paid' };
    }
    
    // No paid credits → check grace eligibility
    // ⚠️ GRACE IS ONE-TIME ONLY
    if (!account.graceEverActivated && !account.graceForfeited) {
      // First time hitting 0 → activate grace
      if (!account.graceActivatedAt) {
        await prisma.whatsAppCredits.update({
          where: { id: account.id },
          data: {
            graceActivatedAt: new Date(),
            graceEverActivated: true, // NEVER AGAIN ELIGIBLE
            status: 'grace',
          }
        });
        await this.sendGraceActivatedNotification(organizationId);
      }
      
      // Still have grace credits
      if (account.graceCreditsUsed < account.graceCreditsTotal) {
        await prisma.whatsAppCredits.update({
          where: { id: account.id },
          data: {
            graceCreditsUsed: { increment: 1 },
          }
        });
        return { success: true, mode: 'grace' };
      }
    }
    
    // Grace exhausted OR never eligible → wa.me fallback
    await prisma.whatsAppCredits.update({
      where: { id: account.id },
      data: { status: 'exhausted' }
    });
    return { success: false, mode: 'exhausted' };
  }
  
  /**
   * Purchase credits - if grace was activated but never used, forfeit it
   */
  async purchaseCredits(organizationId: string, packageName: string): Promise<void> {
    const account = await prisma.whatsAppCredits.findUnique({
      where: { organizationId }
    });
    
    const packages = {
      starter: { credits: 200, priceARS: 12000, priceUSD: 12 },
      standard: { credits: 500, priceARS: 25000, priceUSD: 25 },
      professional: { credits: 1000, priceARS: 45000, priceUSD: 45 },
      enterprise: { credits: 5000, priceARS: 175000, priceUSD: 175 },
    };
    
    const pkg = packages[packageName];
    if (!pkg) throw new Error('Invalid package');
    
    await prisma.whatsAppCredits.update({
      where: { organizationId },
      data: {
        creditsBalance: { increment: pkg.credits },
        creditsPurchased: { increment: pkg.credits },
        status: 'active',
        // Reset alerts for new cycle
        alert75SentAt: null,
        alert90SentAt: null,
        alert100SentAt: null,
        // ⚠️ If grace was activated but unused credits remain, FORFEIT THEM
        graceForfeited: account?.graceEverActivated && account.graceCreditsUsed < account.graceCreditsTotal,
      }
    });
  }
}
```

**Acceptance Criteria:**
- [ ] WhatsAppCredits schema with one-time grace
- [ ] `graceEverActivated` flag prevents re-triggering
- [ ] `graceForfeited` flag tracks unused grace credits
- [ ] Credit purchase forfeits remaining grace
- [ ] Status transitions: inactive → active → grace → exhausted

---

### Task 4.8.2: Credit Alert System
**Files to create:**
- `apps/web/lib/services/credit-alerts.service.ts`
- `apps/web/app/api/webhooks/credit-check/route.ts`

**Alert Thresholds:**
```typescript
// apps/web/lib/services/credit-alerts.service.ts

export class CreditAlertService {
  /**
   * Check credit levels and send alerts
   * Called after each credit deduction
   */
  async checkAndAlert(organizationId: string): Promise<void> {
    const account = await prisma.whatsAppCredits.findUnique({
      where: { organizationId },
      include: { organization: true }
    });
    
    if (!account || account.creditsPurchased === 0) return;
    
    const usagePercent = (account.creditsUsed / account.creditsPurchased) * 100;
    const remaining = account.creditsBalance;
    
    // 75% used - First warning
    if (usagePercent >= 75 && !account.alert75SentAt) {
      await this.sendAlert(account, '75%', remaining);
      await prisma.whatsAppCredits.update({
        where: { id: account.id },
        data: { alert75SentAt: new Date() }
      });
    }
    
    // 90% used - Urgent warning
    if (usagePercent >= 90 && !account.alert90SentAt) {
      await this.sendAlert(account, '90%', remaining);
      await prisma.whatsAppCredits.update({
        where: { id: account.id },
        data: { alert90SentAt: new Date() }
      });
    }
    
    // 100% used - Grace period activated
    if (remaining === 0 && !account.alert100SentAt) {
      await this.sendGraceNotification(account);
      await prisma.whatsAppCredits.update({
        where: { id: account.id },
        data: { alert100SentAt: new Date() }
      });
    }
  }
  
  private async sendAlert(account: WhatsAppCredits, threshold: string, remaining: number): Promise<void> {
    // Send email
    await emailService.send({
      to: account.organization.email,
      template: 'credit-warning',
      data: {
        threshold,
        remaining,
        buyUrl: `${APP_URL}/configuracion/creditos`,
      }
    });
    
    // Send WhatsApp (if they have credits for it 😅)
    // OR use free tier notification
  }
  
  private async sendGraceNotification(account: WhatsAppCredits): Promise<void> {
    const isFirstTime = !account.graceEverActivated;
    
    await emailService.send({
      to: account.organization.email,
      template: isFirstTime ? 'grace-activated' : 'credits-exhausted',
      data: {
        graceCredits: isFirstTime ? 50 : 0,
        message: isFirstTime 
          ? '⚠️ Activamos 50 créditos de emergencia (ÚNICO USO). El AI sigue funcionando.'
          : '❌ Sin créditos. Tu WhatsApp ahora redirige a tu número personal.',
        buyUrl: `${APP_URL}/configuracion/creditos`,
      }
    });
  }
}
```

**Acceptance Criteria:**
- [ ] Alerts at 75%, 90%, 100% thresholds
- [ ] Email notifications with clear messaging
- [ ] Dashboard banner warnings
- [ ] Grace period notice (first time only)
- [ ] Exhausted notice (after grace or if ineligible)

---

### Task 4.8.3: BSP Number Provisioning
**Files to create:**
- `apps/web/lib/services/bsp-provisioning.service.ts`
- `apps/web/app/api/admin/bsp/provision/route.ts`

**How BSP Provisioning Works:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📱 BSP NUMBER PROVISIONING FLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. Client enables "WhatsApp AI" add-on                          │
│         ↓                                                       │
│ 2. Client purchases initial credit package                      │
│         ↓                                                       │
│ 3. CampoTech requests new number from BSP (Twilio/360dialog)    │
│         ↓                                                       │
│ 4. Meta reviews & approves (24-72 hours)                        │
│         ↓                                                       │
│ 5. Number provisioned → assigned to client                      │
│         ↓                                                       │
│ 6. Webhooks configured → client's incoming messages routed      │
│         ↓                                                       │
│ 7. AI copilot active! 🤖                                        │
│                                                                 │
│ IF CLIENT RUNS OUT OF CREDITS (and grace exhausted):            │
│ • Number stays assigned (we've paid for it)                     │
│ • Messages still delivered (basic forward to dashboard)         │
│ • AI features disabled                                          │
│ • After 30 days inactive: number released, wa.me fallback       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] BSP integration (Twilio or 360dialog)
- [ ] Number request workflow
- [ ] Webhook configuration per client
- [ ] Number assignment tracking
- [ ] Inactive number release logic (30 days)

---

### Task 4.8.4: Credit Purchase UI & Mercado Pago Integration
**Files to create:**
- `apps/web/app/(dashboard)/configuracion/creditos/page.tsx`
- `apps/web/app/api/credits/purchase/route.ts`
- `apps/web/app/api/webhooks/mercadopago/credits/route.ts`

**Credits Dashboard:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 💳 Créditos de WhatsApp AI                                      │
│                                                                 │
│ ⚠️ Te quedan 23 créditos (23% restante)                         │
│ [Comprar más créditos]                                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ESTADO ACTUAL:                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Créditos disponibles:     23                                │ │
│ │ Créditos usados:          177                               │ │
│ │ Total comprados:          200                               │ │
│ │ Estado:                   ✅ Activo                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ CRÉDITOS DE EMERGENCIA (uso único):                             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Estado: ⚪ No activado                                       │ │
│ │ Créditos de emergencia: 50                                  │ │
│ │ ℹ️ Se activan automáticamente cuando llegás a 0 créditos.   │ │
│ │ ⚠️ Solo se pueden usar UNA VEZ. Si pagás antes de usarlos,  │ │
│ │    se pierden.                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ COMPRAR PAQUETE:                                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [○] Starter    │ 200 créditos  │ $12.000 ARS │ $0.06/crédito│ │
│ │ [●] Standard   │ 500 créditos  │ $25.000 ARS │ $0.05/créd ⭐│ │
│ │ [○] Profesional│ 1000 créditos │ $45.000 ARS │ $0.045/créd  │ │
│ │ [○] Empresa    │ 5000 créditos │ $175.000 ARS│ $0.035/créd  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [💳 Pagar con Mercado Pago]                                     │
│                                                                 │
│ HISTORIAL DE COMPRAS:                                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Fecha       │ Paquete  │ Créditos │ Monto     │ Estado      │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ 15/01/2026  │ Starter  │ 200      │ $12.000   │ ✅ Pagado   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Credit balance display with visual indicator
- [ ] One-time grace status clearly shown
- [ ] Package selection with pricing
- [ ] Mercado Pago checkout integration
- [ ] Purchase history
- [ ] Immediate credit activation on payment

---

### Task 4.8.5: Public WhatsApp Pricing Page
**Files to create:**
- `apps/web/app/(public)/precios/whatsapp-ai/page.tsx`
- `apps/web/components/pricing/WhatsAppPricingTable.tsx`

**Page Content (Transparent explanation):**
```tsx
// apps/web/app/(public)/precios/whatsapp-ai/page.tsx

export const metadata = {
  title: 'WhatsApp con Inteligencia Artificial | CampoTech',
  description: 'Automatizá tus respuestas de WhatsApp con AI. Precios transparentes, sin sorpresas.',
};

export default function WhatsAppAIPricingPage() {
  return (
    <>
      <h1>WhatsApp Inteligente para Profesionales</h1>
      
      {/* FREE OPTION */}
      <section>
        <h2>🆓 Opción Gratuita: Links de WhatsApp</h2>
        <p>Incluído en todos los planes, para siempre.</p>
        
        <h3>✅ Qué incluye:</h3>
        <ul>
          <li>Link directo a tu WhatsApp personal</li>
          <li>Clientes hacen click → abre chat con vos</li>
          <li>Sin costo adicional</li>
        </ul>
        
        <h3>❌ Qué NO incluye:</h3>
        <ul>
          <li>Asistente AI que responde automáticamente</li>
          <li>Creación automática de trabajos</li>
          <li>Análisis de conversaciones</li>
        </ul>
        
        <div className="example-box">
          <h4>📱 Ejemplo:</h4>
          <p>"Juan envía un mensaje a tu WhatsApp. Vos lo recibís en tu teléfono 
          personal y respondés manualmente cuando podés."</p>
        </div>
      </section>
      
      {/* PREMIUM OPTION */}
      <section>
        <h2>🤖 Opción Premium: WhatsApp con AI</h2>
        <p>Add-on para planes pagos. Funciona con créditos prepagos.</p>
        
        <h3>✅ Qué incluye:</h3>
        <ul>
          <li>Número de WhatsApp Business dedicado (separado de tu personal)</li>
          <li>Asistente AI que responde automáticamente 24/7</li>
          <li>Crea trabajos desde los mensajes de clientes</li>
          <li>Análisis de todas tus conversaciones</li>
          <li>Respuestas inteligentes basadas en tus servicios</li>
        </ul>
        
        <div className="example-box">
          <h4>📱 Ejemplo:</h4>
          <p>"Juan manda mensaje a las 11pm preguntando por un presupuesto. 
          El AI responde: 'Hola Juan, soy el asistente de Pedro. Gracias por 
          escribirnos. ¿Necesitás un presupuesto para reparación de aire 
          acondicionado? Te paso los horarios disponibles de Pedro para esta 
          semana...' Y crea automáticamente un trabajo pendiente para vos."</p>
        </div>
        
        {/* Pricing table */}
        <WhatsAppPricingTable />
        
        {/* Grace period explanation */}
        <div className="warning-box">
          <h4>⚠️ ¿Qué pasa si se me acaban los créditos?</h4>
          <ol>
            <li><strong>Primera vez:</strong> Se activan 50 créditos de emergencia 
            (gratis, uso único). El AI sigue funcionando.</li>
            <li><strong>Si pagás antes de usar los de emergencia:</strong> Los 
            créditos de emergencia se pierden (no son acumulables).</li>
            <li><strong>Si usás todos los de emergencia:</strong> Tu WhatsApp 
            vuelve a la opción gratuita (link a tu número personal).</li>
            <li><strong>NUNCA perdés mensajes:</strong> Siempre te llegan, 
            solo que sin las funciones de AI.</li>
          </ol>
        </div>
      </section>
    </>
  );
}
```

**Acceptance Criteria:**
- [ ] Clear explanation of free vs premium
- [ ] Examples in plain language
- [ ] Pricing table with packages
- [ ] One-time grace period explanation
- [ ] "Never lose messages" guarantee
- [ ] Mobile-responsive design

---

**Acceptance Criteria (Phase 4.8 Complete):**
- [ ] WhatsAppCredits schema with one-time grace
- [ ] Credit deduction logic with grace handling
- [ ] Alert system (75%, 90%, 100%)
- [ ] BSP provisioning workflow
- [ ] Credit purchase via Mercado Pago
- [ ] Credits dashboard UI
- [ ] Public pricing page with transparent explanations
- [ ] **⚠️ One-time grace: `graceEverActivated` flag prevents re-use**
- [ ] **⚠️ Grace forfeit: paying before using = credits lost**

---

## Understanding: Marketplace + WhatsApp AI Flow

> ### 💡 WHY DEDICATED NUMBERS ARE REQUIRED
>
> CampoTech is a **marketplace** where customers choose **specific professionals**.
> Each profile displays a WhatsApp number that customers save in their contacts.
> Therefore, **number pooling is impossible** - each professional needs their own number.

**The Complete Flow:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📱 MARKETPLACE → WHATSAPP AI FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ STEP 1: CUSTOMER FINDS PROFESSIONAL                             │
│ ─────────────────────────────────────                           │
│ Customer visits CampoTech marketplace                           │
│ Searches for "electricista en Córdoba"                          │
│ Finds Juan Pérez's verified profile                             │
│                                                                 │
│ STEP 2: PROFILE SHOWS DEDICATED NUMBER                          │
│ ─────────────────────────────────────                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ⭐⭐⭐⭐⭐ Juan Pérez - Electricista Matriculado            │ │
│ │ Matrícula ERSEP: 12345 ✓ Verificado                        │ │
│ │ Zona: Córdoba Capital                                       │ │
│ │                                                             │ │
│ │ [📱 WhatsApp: +54 351 555-1234]  ← JUAN'S DEDICATED NUMBER │ │
│ │ [📞 Llamar] [📧 Email]                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ STEP 3: CUSTOMER CLICKS WHATSAPP                                │
│ ─────────────────────────────────                               │
│ • Opens WhatsApp to +54 351 555-1234                            │
│ • We track this click (attribution)                             │
│ • Customer types: "Hola, necesito un electricista"              │
│                                                                 │
│ STEP 4: AI RESPONDS (if Juan has credits)                       │
│ ─────────────────────────────────────────                       │
│ Juan is busy on a job, but AI responds instantly:               │
│                                                                 │
│ "Hola! Soy el asistente de Juan Pérez, electricista             │
│ matriculado. Gracias por escribirnos.                           │
│                                                                 │
│ ¿En qué podemos ayudarte?                                       │
│ 1️⃣ Instalación eléctrica                                       │
│ 2️⃣ Reparación                                                   │
│ 3️⃣ Presupuesto                                                  │
│                                                                 │
│ Juan te responderá personalmente a la brevedad."                │
│                                                                 │
│ STEP 5: CONVERSATION CONTINUES                                  │
│ ───────────────────────────────                                 │
│ • AI gathers details (address, issue, preferred time)           │
│ • Creates a "Lead" or "Job" in Juan's CampoTech dashboard       │
│ • Juan gets notification: "New lead from marketplace"           │
│ • Juan can take over the conversation anytime                   │
│                                                                 │
│ STEP 6: CUSTOMER SAVES NUMBER                                   │
│ ──────────────────────────────                                  │
│ Customer saves +54 351 555-1234 as "Juan Electricista"          │
│ • Forever: That number = Juan                                   │
│ • Customer can message anytime                                  │
│ • Return customers tracked in CRM                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Free Tier vs. WhatsApp AI:**
```
┌─────────────────────────────────────────────────────────────────┐
│ FREE TIER (wa.me link to personal number)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Profile shows: [📱 WhatsApp] ← wa.me/+54XXXXXXXXXX              │
│                                                                 │
│ • Links to Juan's personal WhatsApp                             │
│ • Juan's personal # shown on profile                            │
│ • No AI, no auto-response                                       │
│ • Juan manages manually on his phone                            │
│ • Mixed with his personal chats                                 │
│ • Cost to us: $0                                                │
│                                                                 │
│ ⚠️ Issue: We never see the messages (no analytics, no AI)       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ WHATSAPP AI (BSP-provisioned dedicated number)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Profile shows: [📱 WhatsApp: +54 351 555-1234] ← BSP NUMBER     │
│                                                                 │
│ • Dedicated business number (separate from personal)            │
│ • Messages come through CampoTech (we see them)                 │
│ • AI responds 24/7                                              │
│ • Auto-creates leads/jobs                                       │
│ • Full conversation analytics                                   │
│ • Cost to us: ~$5/month number + $0.03/conversation             │
│                                                                 │
│ ✅ Benefit: Complete automation, professional image             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 6 (FUTURE): Advanced BSP Infrastructure
**Status:** Future roadmap (when 50+ WhatsApp AI clients)
**Estimated Effort:** 8 days
**Trigger:** 50+ clients using WhatsApp AI add-on

> ### 📌 IMPORTANT: Dedicated Numbers Required
>
> Unlike call centers where any agent can help any customer, CampoTech is a 
> **marketplace** where customers choose specific professionals. Each profile
> displays a WhatsApp number that customers save in their contacts.
>
> **Therefore:** Every WhatsApp AI client MUST have their own dedicated number.
> Number pooling/sharing is NOT possible for this business model.

---

### Task 6.1: Multi-Number Inventory Management
**Goal:** Pre-purchase numbers in bulk for instant provisioning
**Effort:** 2 days

**Current Flow (Phase 4.8):**
```
Client signs up for WhatsApp AI
    ↓
We request number from BSP (Twilio/360dialog)
    ↓
BSP requests from Meta
    ↓
Wait 24-72 hours for approval
    ↓
Number provisioned, assigned to client
```

**Improved Flow (Phase 6.1):**
```
CampoTech pre-purchases 50 numbers from BSP
    ↓
Numbers stored in inventory (pre-approved)
    ↓
Client signs up for WhatsApp AI
    ↓
INSTANTLY assign from inventory
    ↓
Client active in minutes, not days
```

**Schema Addition:**
```prisma
model WhatsAppNumberInventory {
  id              String   @id @default(cuid())
  phoneNumber     String   @unique
  bspNumberId     String   // Meta/BSP ID
  
  status          NumberInventoryStatus @default(available)
  assignedToOrgId String?  // Which organization is using it
  assignedAt      DateTime?
  
  // Cost tracking
  monthlyRentalCost Float @default(5.0) // USD per month
  
  createdAt       DateTime @default(now())
  releasedAt      DateTime? // When unassigned (if ever)
  
  assignedOrg     Organization? @relation(fields: [assignedToOrgId], references: [id])
  
  @@map("whatsapp_number_inventory")
}

enum NumberInventoryStatus {
  available     // Ready to assign
  assigned      // Currently in use
  pending       // Being provisioned
  suspended     // Payment issue
  released      // Was assigned, now available again
}
```

**Acceptance Criteria:**
- [ ] Pre-purchase numbers in bulk from BSP
- [ ] Number inventory management dashboard
- [ ] Instant assignment on signup
- [ ] Auto-release inactive numbers (30+ days no activity)
- [ ] Cost tracking per number

---

### Task 6.2: Shared Inbox for Teams
**Goal:** Allow multiple team members to access one company number
**Effort:** 3 days

> **Use Case:** A company like "AC Servicios del Norte S.A." has 5 employees.
> They want ONE company WhatsApp number, but multiple team members need to
> see and respond to incoming messages.

**How Shared Inbox Works:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📥 SHARED INBOX: 1 COMPANY NUMBER → MULTIPLE TEAM MEMBERS       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ COMPANY: "AC Servicios del Norte S.A."                          │
│ DEDICATED NUMBER: +54 381 555-9999                              │
│                                                                 │
│ MARKETPLACE PROFILE:                                            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ AC Servicios del Norte - HVAC Profesional                   │ │
│ │ [📱 WhatsApp: +54 381 555-9999]                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Customer clicks → Messages this number                          │
│ AI responds (company credits)                                   │
│                                                                 │
│ INSIDE CAMPOTECH DASHBOARD:                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ TEAM MEMBERS:                                               │ │
│ │ 👤 Carlos (Owner)     → Sees ALL, can assign                │ │
│ │ 👤 Ana (Receptionist) → Sees ALL, can assign                │ │
│ │ 👤 Juan (Tech)        → Sees ASSIGNED to him only           │ │
│ │ 👤 María (Tech)       → Sees ASSIGNED to her only           │ │
│ │ 👤 Pedro (Tech)       → Sees ASSIGNED to him only           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ WORKFLOW:                                                       │
│ 1. Customer messages company WhatsApp                           │
│ 2. AI responds, creates lead                                    │
│ 3. Lead appears in "Unassigned" queue                           │
│ 4. Ana assigns to Juan: "Instalación en zona norte"             │
│ 5. Juan gets notification, sees conversation                    │
│ 6. Juan responds (through CampoTech, not personal phone)        │
│ 7. Customer sees reply from company number                      │
│                                                                 │
│ KEY: Number is DEDICATED to this company, not shared with       │
│      other companies. Only the TEAM inside shares access.       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Permission Levels:**
```typescript
enum TeamRole {
  owner       // Full access, billing, team management
  admin       // Full access, team management (no billing)
  agent       // See and respond to assigned conversations
  viewer      // Read-only access to assigned conversations
}
```

**Acceptance Criteria:**
- [ ] Team member management (invite, remove, roles)
- [ ] Conversation assignment workflow
- [ ] Per-agent conversation view
- [ ] Owner/Admin sees all conversations
- [ ] Notifications to assigned agent
- [ ] Agent performance analytics

---

### Task 6.3: Official Meta BSP Partnership
**Goal:** Become a registered BSP for better pricing and direct API access
**Effort:** 3 days (application) + ongoing relationship

> **When to pursue:** 100+ WhatsApp AI clients, $2,000+/month in message costs

**Current State (Phase 4.8):**
```
CampoTech → Twilio/360dialog (BSP) → Meta
                   ↑
            They take 30-50% markup
```

**Future State (Phase 6.3):**
```
CampoTech (as BSP) → Meta directly
                ↑
         No middleman, wholesale pricing
```

**BSP Partnership Requirements:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📋 META BSP PARTNERSHIP REQUIREMENTS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. COMPANY:                                                     │
│    • Registered legal entity                                    │
│    • 1-2 years in business                                      │
│    • Technical infrastructure proven                            │
│                                                                 │
│ 2. TECHNICAL:                                                   │
│    • Working WhatsApp integration demonstrated                  │
│    • 99.9% uptime SLA capability                                │
│    • Security certifications (ISO 27001 preferred)              │
│                                                                 │
│ 3. BUSINESS:                                                    │
│    • Minimum 50-100 business clients                            │
│    • $1,000-5,000/month minimum commitment                      │
│    • Business growth plan                                       │
│                                                                 │
│ 4. TIMELINE: 3-6 months application process                     │
│                                                                 │
│ BENEFIT: ~30-50% cost reduction on all messages                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Decision:** Do NOT pursue BSP partnership until you have 100+ WhatsApp AI clients.
The application process is complex and requires ongoing compliance obligations.

**Acceptance Criteria:**
- [ ] Document BSP application requirements
- [ ] Prepare technical documentation
- [ ] Apply when volume justifies (~100 clients)

---

### ~~Task 6.4: Number Pooling~~ ❌ REMOVED

> **Why removed:** CampoTech is a marketplace where customers choose specific
> professionals. The WhatsApp number is displayed on the profile and saved by
> customers. Sharing numbers between different professionals would cause
> customers to reach the wrong person.
>
> **Number pooling only works for:**
> - Call centers (any agent can help)
> - Support teams (customer doesn't care who responds)
> - Transactional messages (order confirmations)
>
> **Does NOT work for:**
> - Marketplaces (customer chose a specific profile)
> - Professional directories (relationship matters)
> - Public profiles (number saved in contacts)

---

**Acceptance Criteria (Phase 6 Complete):**
- [ ] Number inventory with instant provisioning
- [ ] Shared inbox for team/company accounts
- [ ] BSP partnership evaluation (when volume justifies)
- [ ] ~~Number pooling~~ (REMOVED - not applicable)

---

## Phase 7: Customer Support Infrastructure
**Status:** To be built alongside core product
**Estimated Effort:** 4 days
**Priority:** 🟡 HIGH (Enables self-service, reduces manual support burden)

> ### 📌 EXISTING MONITORING INFRASTRUCTURE
>
> CampoTech already has comprehensive error detection:
> - ✅ **Sentry Integration:** `infrastructure/monitoring/sentry/config.ts`
> - ✅ **Error Handler:** `src/lib/logging/error-handler.ts`
> - ✅ **Alert Manager:** `apps/web/lib/monitoring/alerts.ts`
> - ✅ **Business Metrics:** `apps/web/lib/monitoring/business-metrics.ts`
> - ✅ **DLQ Handler with Sentry:** `src/lib/queue/dlq-handler.ts`
>
> **What we CAN detect automatically:**
> - Server errors (500s, API failures, database issues)
> - Third-party failures (AFIP, WhatsApp, Mercado Pago)
> - Performance degradation (slow responses)
> - Business anomalies (traffic drops, payment failures)
>
> **What customers MUST report:**
> - UX confusion / feature requests
> - Mobile-specific bugs
> - Data issues ("my invoice is wrong")
> - Network/device issues on their side

---

### Task 7.1: Public Status Page
**Goal:** Communicate system health to customers proactively
**Effort:** 0.5 days

**Files to create:**
- `apps/web/app/(public)/estado/page.tsx`
- `apps/web/lib/services/status-page.service.ts`
- `apps/web/app/api/status/route.ts`

**Status Page Design:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 🟢 Estado del Sistema - CampoTech                               │
│ https://campotech.com.ar/estado                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Todos los sistemas operativos                                   │
│ Última actualización: hace 5 minutos                            │
│                                                                 │
│ SERVICIOS:                                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🟢 Dashboard Web              Operativo                     │ │
│ │ 🟢 App Móvil                  Operativo                     │ │
│ │ 🟢 WhatsApp AI                Operativo                     │ │
│ │ 🟢 Facturación AFIP           Operativo                     │ │
│ │ 🟢 Pagos (Mercado Pago)       Operativo                     │ │
│ │ 🟢 Maps / Navegación          Operativo                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ÚLTIMOS 30 DÍAS:                                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ████████████████████████████ 99.9% uptime                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ INCIDENTES RECIENTES:                                           │
│ • 15/Ene 14:00-14:30 - AFIP timeout (resuelto)                 │
│ • 10/Ene 09:00-09:15 - Mantenimiento programado                │
│                                                                 │
│ [🔔 Suscribirse a actualizaciones]                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Status Check Service:**
```typescript
// apps/web/lib/services/status-page.service.ts

type ServiceStatus = 'operational' | 'degraded' | 'outage' | 'maintenance';

interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  latencyMs?: number;
  lastChecked: Date;
}

export class StatusPageService {
  private readonly services = [
    { name: 'Dashboard Web', check: () => this.checkWeb() },
    { name: 'App Móvil API', check: () => this.checkApi() },
    { name: 'WhatsApp AI', check: () => this.checkWhatsApp() },
    { name: 'Facturación AFIP', check: () => this.checkAfip() },
    { name: 'Pagos (Mercado Pago)', check: () => this.checkMercadoPago() },
    { name: 'Maps / Navegación', check: () => this.checkMaps() },
  ];
  
  async getStatus(): Promise<ServiceHealth[]> {
    const results = await Promise.all(
      this.services.map(async (s) => ({
        name: s.name,
        ...await s.check(),
        lastChecked: new Date(),
      }))
    );
    return results;
  }
  
  async checkAfip(): Promise<{ status: ServiceStatus; latencyMs: number }> {
    const start = Date.now();
    try {
      // Ping AFIP test endpoint
      const response = await fetch(process.env.AFIP_WSFE_URL!, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      return {
        status: response.ok ? 'operational' : 'degraded',
        latencyMs: Date.now() - start,
      };
    } catch {
      return { status: 'outage', latencyMs: Date.now() - start };
    }
  }
  
  // ... similar for other services
}
```

**Acceptance Criteria:**
- [ ] Public status page at `/estado`
- [ ] Real-time service health checks
- [ ] 30-day uptime history
- [ ] Incident history
- [ ] Email subscription for updates

---

### Task 7.2: In-App Help Widget
**Goal:** Provide self-service help within the app
**Effort:** 1 day

**Files to create:**
- `apps/web/components/support/HelpWidget.tsx`
- `apps/web/components/support/FaqModal.tsx`
- `apps/web/components/support/ReportIssueForm.tsx`
- `apps/web/app/api/support/report/route.ts`

**Help Widget Design:**
```tsx
// apps/web/components/support/HelpWidget.tsx

export function HelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      {/* Floating button bottom-right */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-emerald-600 text-white p-3 rounded-full shadow-lg hover:bg-emerald-700"
      >
        <HelpCircle className="h-6 w-6" />
      </button>
      
      {/* Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🤖 ¿En qué podemos ayudarte?</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4">
            <Button variant="outline" onClick={() => router.push('/ayuda')}>
              📄 Ver preguntas frecuentes
            </Button>
            
            <Button variant="outline" onClick={() => setShowReportForm(true)}>
              🔧 Reportar un problema
            </Button>
            
            <Button variant="outline" onClick={() => setShowSuggestion(true)}>
              💡 Sugerir una mejora
            </Button>
            
            <Button variant="outline" asChild>
              <a href="mailto:soporte@campotech.com.ar">
                📧 Contactar soporte
              </a>
            </Button>
            
            <Button variant="outline" asChild>
              <a href="/estado" target="_blank">
                📊 Ver estado del sistema
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Issue Report Form:**
```tsx
// apps/web/components/support/ReportIssueForm.tsx

export function ReportIssueForm() {
  const { user, organization } = useAuth();
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  
  async function handleSubmit() {
    // Automatically collect context
    const context = {
      userId: user?.id,
      organizationId: organization?.id,
      appVersion: process.env.NEXT_PUBLIC_VERSION,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };
    
    await fetch('/api/support/report', {
      method: 'POST',
      body: JSON.stringify({ description, context }),
    });
    
    toast.success('Reporte enviado. Te contactaremos pronto.');
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <Label>Describí el problema:</Label>
      <Textarea 
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="¿Qué pasó? ¿Qué esperabas que pase?"
      />
      
      <Label>Captura de pantalla (opcional):</Label>
      <Input 
        type="file" 
        accept="image/*"
        onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
      />
      
      <p className="text-sm text-muted-foreground">
        ✅ Automáticamente incluimos tu ID de usuario, versión de la app,
        y dispositivo para resolver el problema más rápido.
      </p>
      
      <Button type="submit">Enviar reporte</Button>
    </form>
  );
}
```

**Mobile App Implementation (React Native):**
```tsx
// apps/mobile/components/support/HelpButton.tsx
// apps/consumer-mobile/components/support/HelpButton.tsx

import { Linking } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

export function HelpButton() {
  const { user, organization } = useAuth();
  const [showModal, setShowModal] = useState(false);
  
  // Collect device info automatically
  const getDeviceContext = async () => ({
    userId: user?.id,
    organizationId: organization?.id,
    appVersion: Application.nativeApplicationVersion,
    buildNumber: Application.nativeBuildVersion,
    deviceModel: Device.modelName,
    osName: Device.osName,
    osVersion: Device.osVersion,
    platform: Platform.OS,
    timestamp: new Date().toISOString(),
  });
  
  return (
    <>
      {/* FAB in bottom navigation or settings */}
      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => setShowModal(true)}
      >
        <HelpCircleIcon color="white" size={24} />
      </TouchableOpacity>
      
      <Modal visible={showModal} onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>🤖 ¿En qué podemos ayudarte?</Text>
          
          <TouchableOpacity onPress={() => openFAQ()}>
            <Text>📄 Ver preguntas frecuentes</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => openReportForm()}>
            <Text>🔧 Reportar un problema</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => Linking.openURL('mailto:soporte@campotech.com.ar')}>
            <Text>📧 Contactar soporte</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => Linking.openURL('https://campotech.com.ar/estado')}>
            <Text>📊 Ver estado del sistema</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}
```

**Mobile Issue Report Form:**
```tsx
// apps/mobile/components/support/ReportIssueForm.tsx

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export function ReportIssueForm() {
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  
  async function pickScreenshot() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    
    if (!result.canceled) {
      setScreenshot(result.assets[0].base64);
    }
  }
  
  async function handleSubmit() {
    const context = await getDeviceContext();
    
    await fetch(`${API_URL}/api/support/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, screenshot, context }),
    });
    
    Alert.alert('Reporte enviado', 'Te contactaremos pronto.');
  }
  
  return (
    <ScrollView>
      <Text style={styles.label}>Describí el problema:</Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
        placeholder="¿Qué pasó? ¿Qué esperabas que pase?"
      />
      
      <TouchableOpacity onPress={pickScreenshot} style={styles.button}>
        <Text>📸 Adjuntar captura de pantalla</Text>
      </TouchableOpacity>
      
      {screenshot && (
        <Image source={{ uri: `data:image/jpeg;base64,${screenshot}` }} style={styles.preview} />
      )}
      
      <Text style={styles.hint}>
        ✅ Automáticamente incluimos tu ID de usuario, versión de la app,
        modelo del dispositivo y sistema operativo.
      </Text>
      
      <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
        <Text style={styles.submitText}>Enviar reporte</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

**Files to create (Mobile):**
- `apps/mobile/components/support/HelpButton.tsx`
- `apps/mobile/components/support/ReportIssueForm.tsx`
- `apps/mobile/screens/support/FAQScreen.tsx`
- `apps/consumer-mobile/components/support/HelpButton.tsx`
- `apps/consumer-mobile/components/support/ReportIssueForm.tsx`
- `apps/consumer-mobile/screens/support/FAQScreen.tsx`

**Acceptance Criteria:**
- [ ] **Web:** Floating help button on all dashboard pages
- [ ] **Mobile:** Help button in settings/profile screen (both apps)
- [ ] **Web + Mobile:** FAQ quick access (WebView or native screen)
- [ ] **Web + Mobile:** Issue report form with auto-context
- [ ] **Web:** Screenshot upload via file input
- [ ] **Mobile:** Screenshot from gallery via expo-image-picker
- [ ] **Mobile:** Device info auto-collected (model, OS, app version)
- [ ] Email notification to support@campotech.com.ar

---

### Task 7.3: Support AI Bot (LangGraph)
**Goal:** Deflect common questions with AI, escalate only complex issues
**Effort:** 2 days
**Dependency:** Phase 5 LangGraph infrastructure

> **Note:** This extends the existing LangGraph infrastructure from Phase 5.
> The Support Bot uses the same FastAPI service, just a different workflow.

**Files to create:**
- `ai-service/app/workflows/support_bot.py`
- `ai-service/app/prompts/support_bot.yaml`
- `apps/web/components/support/AIChatWidget.tsx`
- `apps/web/app/api/support/chat/route.ts`

**LangGraph Support Bot Workflow:**
```python
# ai-service/app/workflows/support_bot.py

from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

class SupportBotState(TypedDict):
    messages: list[dict]
    user_id: str | None
    organization_id: str | None
    issue_category: str | None
    resolved: bool
    escalate_to_human: bool

# Define support categories
SUPPORT_CATEGORIES = [
    "facturacion",      # AFIP, invoices
    "pagos",            # Mercado Pago, subscriptions
    "whatsapp",         # WhatsApp AI, credits
    "cuenta",           # Login, settings
    "app_movil",        # Mobile app issues
    "otro",             # Unknown - escalate
]

def create_support_bot_graph():
    graph = StateGraph(SupportBotState)
    
    # Node 1: Classify user issue
    async def classify_issue(state: SupportBotState) -> SupportBotState:
        prompt = ChatPromptTemplate.from_messages([
            ("system", """Sos el asistente de soporte de CampoTech.
            Clasificá el mensaje del usuario en una de estas categorías:
            - facturacion: problemas con AFIP, facturas, CBU
            - pagos: problemas de pago, suscripción, Mercado Pago
            - whatsapp: WhatsApp AI, créditos, mensajes
            - cuenta: login, configuración, perfil
            - app_movil: app móvil, cámara, GPS
            - otro: no encaja en ninguna
            
            Respondé SOLO con la categoría."""),
            ("user", "{message}")
        ])
        
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        chain = prompt | llm
        
        last_message = state["messages"][-1]["content"]
        response = await chain.ainvoke({"message": last_message})
        
        return {**state, "issue_category": response.content.strip().lower()}
    
    # Node 2: Provide FAQ answer based on category
    async def provide_answer(state: SupportBotState) -> SupportBotState:
        category = state["issue_category"]
        
        # Load FAQ for category
        faqs = await load_faqs_for_category(category)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """Sos el asistente de soporte de CampoTech.
            Usá esta información para responder al usuario:
            
            {faqs}
            
            Si no podés resolver el problema con esta información,
            decí que lo vas a escalar a un humano.
            
            Respondé en español argentino, amigable y conciso."""),
            ("user", "{message}")
        ])
        
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
        chain = prompt | llm
        
        last_message = state["messages"][-1]["content"]
        response = await chain.ainvoke({
            "message": last_message,
            "faqs": faqs
        })
        
        # Check if escalation needed
        escalate = any(phrase in response.content.lower() for phrase in [
            "escalar", "humano", "soporte", "no puedo resolver"
        ])
        
        return {
            **state,
            "messages": state["messages"] + [{"role": "assistant", "content": response.content}],
            "escalate_to_human": escalate,
            "resolved": not escalate,
        }
    
    # Node 3: Handle escalation
    async def escalate(state: SupportBotState) -> SupportBotState:
        # Create support ticket
        await create_support_ticket(
            user_id=state["user_id"],
            organization_id=state["organization_id"],
            messages=state["messages"],
            category=state["issue_category"],
        )
        
        return {
            **state,
            "messages": state["messages"] + [{
                "role": "assistant",
                "content": "Tu consulta fue escalada a nuestro equipo de soporte. "
                          "Te contactaremos por email en las próximas 24 horas. "
                          "¿Hay algo más en lo que pueda ayudarte?"
            }],
        }
    
    # Build graph
    graph.add_node("classify", classify_issue)
    graph.add_node("answer", provide_answer)
    graph.add_node("escalate", escalate)
    
    graph.set_entry_point("classify")
    graph.add_edge("classify", "answer")
    graph.add_conditional_edges(
        "answer",
        lambda s: "escalate" if s["escalate_to_human"] else END,
        {"escalate": "escalate", END: END}
    )
    graph.add_edge("escalate", END)
    
    return graph.compile()

support_bot = create_support_bot_graph()
```

**Chat Widget:**
```tsx
// apps/web/components/support/AIChatWidget.tsx

export function AIChatWidget() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Hola! Soy el asistente de CampoTech. ¿En qué puedo ayudarte?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  async function sendMessage() {
    if (!input.trim()) return;
    
    const userMessage = { role: 'user' as const, content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    const response = await fetch('/api/support/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [...messages, userMessage] }),
    });
    
    const data = await response.json();
    setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
    setIsLoading(false);
  }
  
  return (
    <div className="flex flex-col h-[400px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <span className={`inline-block p-3 rounded-lg ${
              msg.role === 'user' ? 'bg-emerald-100' : 'bg-gray-100'
            }`}>
              {msg.content}
            </span>
          </div>
        ))}
        {isLoading && <TypingIndicator />}
      </div>
      
      {/* Input */}
      <div className="border-t p-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Escribí tu pregunta..."
        />
        <Button onClick={sendMessage} disabled={isLoading}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] LangGraph workflow for support classification
- [ ] FAQ-based answers for common issues
- [ ] Automatic escalation for complex issues
- [ ] Chat widget in help modal
- [ ] Support ticket creation on escalation
- [ ] Spanish language support

---

### Task 7.4: Knowledge Base / FAQ Pages
**Goal:** Self-service documentation for common questions
**Effort:** 0.5 days

**Files to create:**
- `apps/web/app/(public)/ayuda/page.tsx`
- `apps/web/app/(public)/ayuda/[category]/page.tsx`
- `apps/web/lib/content/faqs.ts`

**FAQ Categories:**
```typescript
// apps/web/lib/content/faqs.ts

export const FAQ_CATEGORIES = {
  facturacion: {
    title: 'Facturación AFIP',
    icon: '🧾',
    faqs: [
      {
        question: '¿Cómo cargo mi certificado AFIP?',
        answer: 'Ve a Configuración > AFIP > Subir certificado...',
      },
      {
        question: '¿Qué hago si AFIP rechaza mi factura?',
        answer: 'Los rechazos más comunes son...',
      },
      // ...more
    ],
  },
  pagos: {
    title: 'Pagos y Suscripción',
    icon: '💳',
    faqs: [
      {
        question: '¿Cómo cambio mi plan?',
        answer: 'Ve a Configuración > Plan > Cambiar plan...',
      },
      // ...more
    ],
  },
  whatsapp: {
    title: 'WhatsApp AI',
    icon: '📱',
    faqs: [
      {
        question: '¿Cómo funcionan los créditos?',
        answer: '1 crédito = 1 conversación con un cliente...',
      },
      {
        question: '¿Qué pasa si me quedo sin créditos?',
        answer: 'La primera vez, tenés 50 créditos de emergencia...',
      },
      // ...more
    ],
  },
  // ...more categories
};
```

**Mobile FAQ Options:**
```tsx
// Option 1: WebView (easiest, consistent with web)
// apps/mobile/screens/support/FAQScreen.tsx

import { WebView } from 'react-native-webview';

export function FAQScreen() {
  return (
    <WebView 
      source={{ uri: 'https://campotech.com.ar/ayuda' }}
      style={{ flex: 1 }}
    />
  );
}

// Option 2: Native screen (better UX, offline support)
// apps/mobile/screens/support/FAQScreen.tsx

import { FAQ_CATEGORIES } from '@/lib/content/faqs';

export function FAQScreen() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  return (
    <ScrollView>
      <TextInput
        placeholder="Buscar..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      
      {Object.entries(FAQ_CATEGORIES).map(([key, category]) => (
        <View key={key}>
          <Text style={styles.categoryTitle}>{category.icon} {category.title}</Text>
          
          {category.faqs
            .filter(faq => 
              faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
              faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((faq, i) => (
              <TouchableOpacity 
                key={i} 
                onPress={() => setExpanded(expanded === `${key}-${i}` ? null : `${key}-${i}`)}
              >
                <Text style={styles.question}>{faq.question}</Text>
                {expanded === `${key}-${i}` && (
                  <Text style={styles.answer}>{faq.answer}</Text>
                )}
              </TouchableOpacity>
            ))}
        </View>
      ))}
    </ScrollView>
  );
}
```

**Files to create (Mobile):**
- `apps/mobile/screens/support/FAQScreen.tsx`
- `apps/consumer-mobile/screens/support/FAQScreen.tsx`
- `packages/shared/content/faqs.ts` (shared FAQ data)

**Acceptance Criteria:**
- [ ] **Web:** Public FAQ page at `/ayuda`
- [ ] **Web + Mobile:** Category-based organization
- [ ] **Web + Mobile:** Search functionality
- [ ] **Web + Mobile:** Linked from help widget
- [ ] **Web:** SEO optimized
- [ ] **Mobile:** Native screen or WebView (both apps)
- [ ] **Shared:** FAQs in shared package for consistency

---

**Acceptance Criteria (Phase 7 Complete):**
- [ ] Public status page with real-time health checks
- [ ] **Web:** In-app help widget (floating button)
- [ ] **Mobile:** Help button in settings screen (both apps)
- [ ] AI support bot with LangGraph (deflects 60-70% of queries)
- [ ] Human escalation workflow (email ticket creation)
- [ ] **Web + Mobile:** Knowledge base with searchable FAQs
- [ ] **Mobile:** Device/OS info auto-collected in reports
- [ ] **Sentry integration verified working (Web + Mobile)**
- [ ] **Alert system configured (Slack/Discord optional)**

---

## Growth Engine Metrics Dashboard

**KPIs to Track:**
```
┌────────────────────────────────────────────────────────────────┐
│ 📊 GROWTH ENGINE - Conversion Funnel                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Step                    Count      Rate      Cumulative       │
│  ─────────────────────────────────────────────────────────────  │
│  1. Profiles Imported    61,000     100%      100%             │
│  2. WhatsApp Sent        12,000     19.7%     19.7%            │
│  3. Message Delivered    10,800     90%       17.7%            │
│  4. Link Clicked         1,620      15%       2.7%             │
│  5. Search Performed     1,458      90%       2.4%             │
│  6. Profile Found        1,312      90%       2.2%             │
│  7. Claim Started        919        70%       1.5%             │
│  8. OTP Verified         826        90%       1.4%             │
│  9. Profile Claimed      743        90%       1.2%             │
│  10. Started Trial       743        100%      1.2%             │
│  11. Converted to Paid   111        15%       0.18%            │
│                                                                │
│  🎯 Target: 1% claim rate = 610 new users (zero CAC)           │
│  💰 Revenue: 15% trial conversion = 91 paid × $40 = $3,640 MRR  │
│                                                                │
│  ⚠️ COST-SAFE CHECK:                                           │
│  • Free tier cost: $0 (redirect only)                         │
│  • Trial tier cost: $0 (no API access during trial)           │
│  • Paid tier profit: $40 - ~$5 API cost = $35/user            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```
---

# REVISED TIMELINE

```
ORIGINAL PHASES (unchanged):
├── Phase 1: Security & Infrastructure (5 days)
├── Phase 2: Core Features (16 days) 
│   └── 2.1: Vehicle Scheduling (6d)
│   └── 2.2: Inventory Cascade (3d)
│   └── 2.2.4: Barcode Scanning (4d) ← NEW
│   └── 2.3: Multi-stop Navigation (5d)
│   └── 2.4: Fiscal Health Dashboard (4d) ← NEW
│   └── 2.5: Cost-Safe SaaS Model (2d) 🔴 CRITICAL ← NEW
│       └── 2.5.1: Trial Time Bomb Schema (0.5d)
│       └── 2.5.2: WhatsApp Cost Protection (1d)
│       └── 2.5.3: Plan Feature Matrix (0.5d)
├── Phase 3: WhatsApp Enhancements (6 days)
├── Phase 4: Onboarding & Growth (5 days + 8 days growth)
│   └── 4.1: OAuth Flows (4d)
│   └── 4.2: Dead Code Cleanup (1d)
│   └── 4.3: Digital Entry Badge (5d) ← NEW
│   └── 4.4: The Growth Engine - Data Pipelines (6d) ← NEW
│       └── 4.4.1: Schema Setup (0.5d)
│       └── 4.4.2: ERSEP Scraper - 33k records (1.5d) 🔴 CRITICAL
│       └── 4.4.3: CACAAV Scraper - 23k records (1d)
│       └── 4.4.4: PDF Pipeline - 5k records (1.5d)
│       └── 4.4.5-7: Claim API + Admin UI (1.5d)
│   └── 4.5: The Activation Workflow - Product-First (2.5d) ← MODIFIED
│       └── 4.5.1: SEO & Identity Setup (0.5d)
│       └── 4.5.2: Product-First WhatsApp Template (0.5d) 🔒 BUILD ONLY
│       └── 4.5.3: Pre-Validation Search Page (0.5d)
│       └── 4.5.4: OTP Verification Flow (0.5d)
│       └── 4.5.5: Launch Approval Gate (0.5d) 🆕 🔒 OWNER APPROVAL REQ
│   └── 4.6: Email Outreach Channel (2d) 🆕 📧 PRIMARY OUTREACH
│       └── 4.6.1: Email Provider Integration (0.5d)
│       └── 4.6.2: Email Template (React Email) (0.5d)
│       └── 4.6.3: Email Campaign Dashboard (1d)
│   └── 4.7: WhatsApp BSP Outreach (⏳ DEFERRED)
│       └── Status: Wait for email conversion success
│       └── Trigger: >1% claim rate from email
│       └── Cost: ~$2,000 for 32k phone-only profiles
│   └── 4.8: WhatsApp AI Credits & BSP Reseller (5d) 🆕 💳
│       └── 4.8.1: WhatsApp Credits Schema + One-Time Grace (1d)
│       └── 4.8.2: Credit Alert System (0.5d)
│       └── 4.8.3: BSP Number Provisioning (1.5d)
│       └── 4.8.4: Credit Purchase UI + Mercado Pago (1.5d)
│       └── 4.8.5: Public WhatsApp Pricing Page (0.5d)
└── Phase 5: Voice AI Migration (12.5 days)
├── Phase 6 (FUTURE): Advanced BSP Infrastructure (8d) ⏳
│   └── 6.1: Multi-Number Inventory (2d)
│   └── 6.2: Shared Inbox for Teams (3d)
│   └── 6.3: Official Meta BSP Partnership (3d)
│   └── 6.4: ~~Number Pooling~~ ❌ REMOVED (N/A for marketplaces)
│   └── Trigger: 50+ WhatsApp AI clients
├── Phase 7: Customer Support Infrastructure (4d) 🆕 🛠️
│   └── 7.1: Public Status Page (0.5d)
│   └── 7.2: In-App Help Widget (1d)
│   └── 7.3: Support AI Bot - LangGraph (2d)
│   └── 7.4: Knowledge Base / FAQ Pages (0.5d)
│   └── ✅ EXISTING: Sentry, Alert Manager, Business Metrics

NEW TOTAL TIMELINE:
├── Original: 8-10 weeks (42.5 days)
├── Addendum: +34 days (was 30, +4 for Support Infrastructure)
├── Phase 6: +8 days (FUTURE - not included in initial estimate)
└── New Total: 15-18 weeks (76.5 days) + Phase 6 when triggered

⚠️ DEPENDENCY: Phase 2.5 (Cost-Safe SaaS) MUST complete BEFORE Phase 4.4 (Growth Engine)
└── Reason: Cannot launch Growth Engine without trial/monetization infrastructure

📧 OUTREACH STRATEGY (Multi-Channel):
├── Phase 1: Email First (29k profiles with email)
│   └── Cost: $15/month (SendGrid) or $2.90 (AWS SES)
│   └── Time: 2-3 days to send all
│   └── Expected: 2-5% click rate → 580-1,450 visits
├── Phase 2: WhatsApp BSP (32k phone-only profiles) ⏳ DEFERRED
│   └── Trigger: Email proves >1% conversion
│   └── Cost: ~$2,000 for full reach
│   └── Decision: Based on email ROI

GROWTH ENGINE IMPACT (Updated):
├── Total Profiles to Import: ~61,000 professionals
├── Email-Addressable Profiles: ~29,000 (48%)
├── Phone-Only Profiles: ~32,000 (52%)
├── Target Claim Rate: 1% = ~610 new users
├── Trial Conversion Rate: 15% = ~91 paid subscribers
├── Cost per Acquisition: $0 (zero CAC)
├── ──────────────────────────────────────────────────
├── MRR Projection: 91 × $40/mo = $3,640 MRR
├── Infrastructure Cost: $0 (free tier = redirect only)
└── Profit Margin: ~87% ($3,640 - ~$455 API costs)

```

---

# FEATURE SUMMARY TABLE

| Feature | Phase | Effort | Files Touched | Priority | Impact |
|---------|-------|--------|---------------|----------|--------|
| Fiscal Health Dashboard | 2.4 | 4 days | 5 new, 2 modified | HIGH | Compliance |
| Digital Entry Badge | 4.3 | 5 days | 8 new, 3 modified | MEDIUM | Differentiation |
| Barcode Scanning | 2.2.4 | 4 days | 4 new, 2 modified | HIGH | Efficiency |
| Growth Engine (Data) | 4.4 | 6 days | 12 new, 1 modified | HIGH | **61k leads** |
| Growth Engine (Activation) | 4.5 | 2.5 days | 8 new, 2 modified | CRITICAL | **Zero CAC** |
| Email Outreach | 4.6 | 2 days | 6 new, 1 modified | CRITICAL | **29k emails** |
| WhatsApp BSP Outreach | 4.7 | ⏳ DEFERRED | - | HIGH | **32k phone** |
| WhatsApp AI Credits | 4.8 | 5 days | 10 new, 3 modified | HIGH | **Revenue** |
| Advanced BSP Infrastructure | 6 | 8 days (FUTURE) | 8 new, 2 modified | MEDIUM | Scale |
| Customer Support Infrastructure | 7 | 4 days | 10 new, 2 modified | HIGH | **Self-Service** |


---

# DEPENDENCIES

```
Feature Dependencies:
├── Fiscal Health Dashboard
│   └── Requires: AFIP invoicing working (Phase 1 complete)
│
├── Digital Entry Badge
│   └── Requires: User verification framework (existing)
│   └── Requires: Supabase storage for certificates
│
├── Barcode Scanning
│   └── Requires: Inventory cascade logic (Task 2.2.1-2.2.3)
│   └── Requires: Product barcode field populated
│
└── Unclaimed Profile Engine
    └── Requires: SMS/WhatsApp OTP service (existing)
    └── Requires: Admin dashboard access
    └── Requires: Python 3.9+ with pdfplumber (for PDF parsing)
    └── Requires: Playwright or JSDOM (for web scraping)
```

---

# RISK ASSESSMENT

| Feature | Risk | Mitigation |
|---------|------|------------|
| Fiscal Health | Monotributo limits change annually | Easy constant update, add AFIP update reminder |
| Digital Badge | ART verification accuracy | Manual admin review option, clear disclaimers |
| Barcode Scanner | Camera compatibility on low-end devices | Fallback to manual SKU entry |
| Unclaimed Profiles | Privacy concerns with public data | Only use publicly available matricula data, clear consent |
| **ERSEP/CACAAV Scrapers** | **DOM structure changes break scraper** | **Build with try/catch, log errors, add health monitoring. Scrapers should fail gracefully and alert admin.** |
| **ERSEP/CACAAV Scrapers** | **Rate limiting / IP blocking** | **Implement 1 req/sec throttling, rotate user agents, consider proxy rotation for production** |
| **PDF Pipeline** | **PDF format changes** | **Table extraction is format-dependent. Keep original PDFs, log extraction issues per page** |

---

# ENVIRONMENT VARIABLES

## Phase 4.4-4.6: Growth Engine & Email Outreach

```bash
# ═══════════════════════════════════════════════════════════════════════════════
# EMAIL PROVIDER (Choose one)
# ═══════════════════════════════════════════════════════════════════════════════

# Option A: Resend (recommended for simplicity)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Option B: SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Option C: AWS SES
AWS_SES_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SES_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_SES_REGION=sa-east-1

# Email Configuration
EMAIL_FROM_ADDRESS=noreply@campotech.com.ar
EMAIL_FROM_NAME=CampoTech
EMAIL_REPLY_TO=soporte@campotech.com.ar

# ═══════════════════════════════════════════════════════════════════════════════
# SCRAPER CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Rate limiting for registry scrapers
SCRAPER_DELAY_MS=1000
SCRAPER_MAX_RETRIES=3
SCRAPER_USER_AGENTS=Mozilla/5.0 (Windows NT 10.0; Win64; x64)

# Proxy rotation (optional, for production)
PROXY_ROTATION_ENABLED=false
PROXY_LIST_URL=
```

## Phase 4.8: WhatsApp Credits & BSP

```bash
# ═══════════════════════════════════════════════════════════════════════════════
# BSP PROVIDER (for number provisioning)
# ═══════════════════════════════════════════════════════════════════════════════

# Dialog360
DIALOG360_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DIALOG360_CHANNEL_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Twilio (alternative)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+5491234567890

# Meta Direct (future)
META_WABA_ID=
META_PHONE_ID=
META_ACCESS_TOKEN=

# ═══════════════════════════════════════════════════════════════════════════════
# CREDIT SERVICE CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Grace period settings
CREDIT_GRACE_MAX=50
CREDIT_GRACE_DAYS=7

# Alert thresholds
CREDIT_ALERT_75_ENABLED=true
CREDIT_ALERT_90_ENABLED=true
CREDIT_ALERT_100_ENABLED=true

# Pricing (ARS)
CREDIT_PRICE_SMALL_100=8000
CREDIT_PRICE_MEDIUM_500=35000
CREDIT_PRICE_LARGE_1000=60000
```

## Phase 7: Customer Support

```bash
# ═══════════════════════════════════════════════════════════════════════════════
# SUPPORT INFRASTRUCTURE
# ═══════════════════════════════════════════════════════════════════════════════

# LangGraph AI Service (for Support Bot)
LANGGRAPH_API_URL=http://localhost:8000
LANGGRAPH_API_KEY=

# OpenAI (for Support Bot if not using LangGraph)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Error Tracking (already exists)
SENTRY_DSN=https://xxxx@xxxxx.ingest.sentry.io/xxxxx

# Support Email
SUPPORT_EMAIL=soporte@campotech.com.ar
```

---

# API ROUTE SPECIFICATIONS

## Phase 4.4: Unclaimed Profiles

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/admin/unclaimed-profiles` | List all unclaimed profiles with filters |
| `GET` | `/api/admin/unclaimed-profiles/[id]` | Get single profile details |
| `POST` | `/api/admin/unclaimed-profiles/import` | Trigger scraper or upload CSV |
| `DELETE` | `/api/admin/unclaimed-profiles/[id]` | Remove invalid profile |
| `GET` | `/api/claim/[token]` | Validate claim token |
| `POST` | `/api/claim/verify-otp` | OTP verification for claiming |
| `POST` | `/api/claim/complete` | Complete profile claim |

## Phase 4.5: Outreach Campaigns

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/admin/campaigns` | List all campaigns |
| `POST` | `/api/admin/campaigns` | Create new campaign |
| `GET` | `/api/admin/campaigns/[id]` | Get campaign details |
| `PATCH` | `/api/admin/campaigns/[id]` | Update campaign |
| `POST` | `/api/admin/campaigns/[id]/approve` | 🔒 Owner approval |
| `POST` | `/api/admin/campaigns/[id]/launch` | Start sending |
| `POST` | `/api/admin/campaigns/[id]/pause` | Pause campaign |
| `GET` | `/api/admin/launch-gate/status` | Pre-launch checklist |
| `POST` | `/api/admin/launch-gate/approve` | Approve launch gate |

## Phase 4.6: Email Outreach

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/webhooks/email/sendgrid` | SendGrid webhook receiver |
| `GET` | `/api/webhooks/email/resend` | Resend webhook receiver |
| `POST` | `/api/admin/email/preview` | Preview email template |
| `POST` | `/api/admin/email/test-send` | Send test email |

## Phase 4.8: WhatsApp Credits

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/credits/status` | Get current credit balance |
| `POST` | `/api/credits/purchase` | Initiate credit purchase |
| `GET` | `/api/credits/packages` | Get available packages |
| `GET` | `/api/credits/usage` | Get usage history |
| `POST` | `/api/webhooks/credits/mercadopago` | MP payment webhook |
| `POST` | `/api/credits/deduct` | Internal: deduct credit |
| `GET` | `/api/whatsapp/pricing` | Public pricing page data |

## Phase 7: Customer Support

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/status` | Public status API |
| `POST` | `/api/support/report` | Report issue |
| `POST` | `/api/support/chat` | AI chat message |
| `GET` | `/api/support/tickets` | List support tickets |
| `GET` | `/api/support/faqs` | Get FAQ data |

---

# DATABASE MIGRATIONS

## Migration Order

```bash
# Phase 4.4: Growth Engine
prisma/migrations/XXX_add_unclaimed_profiles.sql
prisma/migrations/XXX_add_outreach_campaigns.sql

# Phase 4.8: WhatsApp Credits
prisma/migrations/XXX_add_whatsapp_credits.sql
prisma/migrations/XXX_add_credit_purchases.sql
prisma/migrations/XXX_add_credit_usage_logs.sql
prisma/migrations/XXX_add_whatsapp_number_inventory.sql
```

## Migration Commands

```bash
# Generate migration from schema changes
cd apps/web
pnpm prisma migrate dev --name add_growth_engine_models

# Apply migrations to production
pnpm prisma migrate deploy

# Generate Prisma client
pnpm prisma generate
```

---

# TESTING REQUIREMENTS

## Unit Tests Required

### Phase 4.4: Unclaimed Profiles
- [ ] `tests/unit/growth-engine/claim-token.test.ts` - Token generation/validation
- [ ] `tests/unit/growth-engine/outreach-status.test.ts` - Status transitions
- [ ] `tests/unit/growth-engine/profile-matching.test.ts` - Deduplication logic

### Phase 4.8: WhatsApp Credits
- [ ] `tests/unit/credits/deduction.test.ts` - Credit deduction logic
- [ ] `tests/unit/credits/grace-period.test.ts` - Grace period transitions
- [ ] `tests/unit/credits/alerts.test.ts` - Alert threshold triggers
- [ ] `tests/unit/credits/forfeiture.test.ts` - Grace forfeiture on payment

### Phase 7: Support
- [ ] `tests/unit/support/status-check.test.ts` - Health check logic
- [ ] `tests/unit/support/issue-context.test.ts` - Auto-context collection

## Integration Tests Required

### Phase 4.6: Email Outreach
- [ ] `tests/integration/email/sendgrid-webhook.test.ts`
- [ ] `tests/integration/email/resend-webhook.test.ts`
- [ ] `tests/integration/email/campaign-flow.test.ts`

### Phase 4.8: Credits
- [ ] `tests/integration/credits/purchase-flow.test.ts`
- [ ] `tests/integration/credits/mp-webhook.test.ts`

## E2E Tests Required

### Phase 4.4-4.5: Claim Flow
- [ ] `tests/e2e/claim/full-claim-flow.test.ts` - Token → OTP → Profile created
- [ ] `tests/e2e/claim/duplicate-prevention.test.ts` - Can't claim twice

### Phase 4.8: Credits Purchase
- [ ] `tests/e2e/credits/purchase-flow.test.ts` - Select package → Pay → Credits added

---

# PHASE DEPENDENCIES CLARIFIED

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE DEPENDENCY GRAPH                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ COMPLETED (Phases 1-3):                                                     │
│   ✅ AFIP Credentials Encryption (1.1)                                      │
│   ✅ DISPATCHER Role (1.2)                                                  │
│   ✅ Vehicle Scheduling (2.1)                                               │
│   ✅ Fiscal Health Service (2.4)                                            │
│   ✅ Trial Manager (2.5)                                                    │
│   ✅ WhatsApp Integration (3)                                               │
│   ✅ Sentry / Alert Manager                                                 │
│                                                                             │
│ READY TO START:                                                             │
│   ⏳ Phase 4.4: Growth Engine Data                                          │
│       └── REQUIRES: prisma migrate (schema added ✅)                        │
│                                                                             │
│   ⏳ Phase 4.5: Activation Workflow                                         │
│       └── REQUIRES: Phase 4.4 complete                                      │
│                                                                             │
│   ⏳ Phase 4.6: Email Outreach                                              │
│       └── REQUIRES: Phase 4.5 complete                                      │
│       └── REQUIRES: Email provider API key                                  │
│                                                                             │
│   ⏳ Phase 4.8: WhatsApp Credits                                            │
│       └── REQUIRES: prisma migrate (schema added ✅)                        │
│       └── CAN RUN IN PARALLEL with 4.4-4.6                                  │
│                                                                             │
│   ⏳ Phase 7: Customer Support                                              │
│       └── 7.1-7.2: CAN START NOW (no dependencies)                         │
│       └── 7.3: REQUIRES Phase 5 LangGraph (ai-service)                      │
│       └── 7.4: CAN START NOW (no dependencies)                              │
│                                                                             │
│ FUTURE (Triggered by scale):                                                │
│   ⏳ Phase 5: Voice AI Migration (LangGraph) - 12.5 days                    │
│   ⏳ Phase 6: Advanced BSP Infrastructure - 8 days                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# SCHEMA STATUS ✅ ADDED

The following models were **added to schema.prisma** (January 2026):

| Model | Table | Purpose |
|-------|-------|---------|
| `UnclaimedProfile` | `unclaimed_profiles` | Ghost profiles from registries |
| `OutreachCampaign` | `outreach_campaigns` | Email/WhatsApp campaigns |
| `WhatsAppCredits` | `whatsapp_credits` | Credit balance per org |
| `CreditPurchase` | `credit_purchases` | Credit purchase history |
| `CreditUsageLog` | `credit_usage_logs` | Credit deduction audit |
| `WhatsAppNumberInventory` | `whatsapp_number_inventory` | BSP number pool |

**Enums Added:**
- `UnclaimedProfileSource` (ERSEP, CACAAV, GASNOR, GASNEA, MANUAL)
- `OutreachStatus` (not_contacted → claimed)
- `DataQuality` (raw → verified)
- `CampaignStatus` (draft → completed)
- `OutreachChannel` (email, whatsapp)
- `TemplateApprovalStatus` (Meta approval flow)
- `CreditServiceStatus` (inactive → degraded)
- `CreditPaymentStatus` (pending → refunded)
- `CreditUsageType` (ai_conversation, etc.)
- `NumberInventoryStatus` (available → released)

**Migration Required:**
```bash
cd apps/web
pnpm prisma migrate dev --name add_phase4_growth_engine
```

---

# SUBSCRIPTION & PAYMENT SYSTEM ✅ IMPLEMENTED

The subscription and payment infrastructure is fully implemented. Here's the comprehensive documentation:

## Trial System (21 Days)

**Constant:** `TRIAL_DAYS = 21` (3 weeks)

| File | Purpose |
|------|---------|
| `lib/services/trial-manager.ts` | Core trial management logic |
| `lib/services/block-manager.ts` | Compliance blocks on trial expiry |
| `lib/cron/subscription-crons.ts` | Trial expiration & reminder emails |
| `components/billing/TrialBanner.tsx` | UI banner for trial status |

### Trial Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TRIAL LIFECYCLE (Netflix Model - Immediate Block)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Day 0: Account Created                                                     │
│    └── trialEndsAt = now + 21 days                                         │
│    └── subscriptionStatus = 'trialing'                                      │
│    └── subscriptionTier = 'INICIAL' (full access during trial)             │
│                                                                             │
│  Day 14: "7 days remaining" email reminder                                  │
│  Day 18: "3 days remaining" email reminder                                  │
│  Day 20: "1 day remaining" urgent email                                     │
│                                                                             │
│  Day 21: Trial Expires → IMMEDIATE HARD BLOCK                               │
│    └── subscriptionStatus = 'expired'                                       │
│    └── Dashboard redirects to /blocked                                      │
│    └── Message: "Tu período de prueba ha terminado. Elegí un plan."        │
│    └── Billing page always accessible                                       │
│                                                                             │
│  ⚠️ NO VISIBLE GRACE PERIOD                                                 │
│    └── No countdown after expiry (prevents gaming the system)               │
│    └── Data retained silently for 30 days (internal safety net)            │
│    └── User only sees: "Pay to continue"                                   │
│                                                                             │
│  Payment Received (anytime):                                                │
│    └── All blocks removed                                                   │
│    └── subscriptionStatus = 'active'                                        │
│    └── trialEndsAt = null                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Trial Manager API

```typescript
// @lib/services/trial-manager.ts

// Create trial for new organization
await trialManager.createTrial(orgId);

// Check trial status
const status = await trialManager.getTrialStatus(orgId);
// Returns: { isActive, isTrialing, daysRemaining, trialEndsAt, isExpired, isExpiringSoon }

// Extend trial (admin action)
await trialManager.extendTrial(orgId, days, reason);

// Expire trial
await trialManager.expireTrial(orgId);

// Convert trial to paid subscription
await trialManager.convertTrialToSubscription(orgId, tier, mpSubscriptionId);
```

## Payment Flow

### Mercado Pago Integration

| File | Purpose |
|------|---------|
| `lib/mercadopago/client.ts` | MP SDK initialization |
| `lib/mercadopago/checkout.ts` | Checkout preference creation |
| `lib/mercadopago/config.ts` | Plan pricing configuration |
| `lib/services/payment-processor.ts` | Payment processing logic |
| `lib/services/subscription-manager.ts` | Subscription CRUD |
| `lib/services/subscription-flows.ts` | Upgrade/downgrade logic |

### Checkout Flow

```
User clicks "Elegir Plan"
    ↓
POST /api/subscription/checkout
    { tier: 'INICIAL', billingCycle: 'MONTHLY' }
    ↓
Creates MercadoPago preference
    ↓
Returns checkoutUrl
    ↓
User redirected to MercadoPago
    ↓
On success: webhook POST /api/webhooks/mercadopago
    ↓
Updates org: subscriptionStatus = 'active'
    ↓
Removes all trial/payment blocks
    ↓
Redirects to /dashboard/settings/billing/success
```

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/subscription/checkout` | POST | Create checkout preference |
| `/api/subscription/checkout` | GET | Get available plans & pricing |
| `/api/subscription/trial-status` | GET | Get current trial status |
| `/api/subscription/change-plan` | POST | Upgrade/downgrade plan |
| `/api/subscription/cancel` | POST | Request cancellation |
| `/api/subscription/cancel` | DELETE | Undo pending cancellation |
| `/api/webhooks/mercadopago` | POST | Handle MP payment webhooks |

### Billing Page (`/dashboard/settings/billing`)

**Features:**
- ✅ Trial status banner with countdown
- ✅ Current subscription display
- ✅ Plan selector (monthly/yearly toggle)
- ✅ Usage dashboard (jobs, users, storage)
- ✅ Payment history
- ✅ Payment methods
- ✅ Cancellation with Ley 24.240 compliance (10-day refund window)

### Subscription Tiers (ARS)

| Tier | Monthly | Yearly | Features |
|------|---------|--------|----------|
| FREE | $0 | $0 | Public profile only |
| INICIAL | $25,000 | $255,000 (17% off) | 50 jobs/mo, 3 users |
| PROFESIONAL | $55,000 | $561,000 (17% off) | Full features |
| EMPRESA | $120,000 | $1,224,000 (17% off) | Unlimited |

### Block System

```typescript
// @lib/services/block-manager.ts

// Reason codes for blocks
BLOCK_REASON_CODES = {
  TRIAL_EXPIRED: 'trial_expired',
  // No TRIAL_EXPIRED_GRACE - we use immediate block (Netflix model)
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_PAST_DUE: 'payment_past_due',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  // ... verification blocks
};

// Data retention (internal, not communicated to users)
DATA_RETENTION_DAYS = 30;       // Silent safety net for returning customers
PAYMENT_GRACE_PERIOD_DAYS = 7;  // Payment needs retry window (communicated)
```

### Middleware Protection

```typescript
// @middleware/subscription-guard.ts

// Protected routes redirect to /blocked when:
// - subscriptionStatus === 'expired'
// - subscriptionStatus === 'cancelled'

// Forever-free paths (always accessible):
// - /p/*               (public profiles)
// - /wa-redirect/*     (WhatsApp redirects)
// - /auth/*            (authentication)
// - /blocked           (info page)
// - /api/auth/*        (auth API)
// - /api/webhooks/*    (webhooks)
```

## Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `checkTrialExpiring` | Daily 9:00 AM | Send 7/3/1 day reminders |
| `checkTrialExpired` | Daily 6:00 AM | Process expired trials |
| `sendPaymentReminders` | Daily 9:00 AM | Payment reminder 3 days before renewal |

---

**✅ PAYMENT SYSTEM STATUS: COMPLETE**

All core payment functionality is implemented:
- ✅ 21-day trial system
- ✅ MercadoPago checkout integration
- ✅ Subscription management
- ✅ Block system on expiry
- ✅ Billing page with plan selection
- ✅ Trial banner with urgency levels
- ✅ Cancellation with Ley 24.240 compliance
- ✅ Email reminders (7/3/1 days)
- ✅ Grace period (3 days soft → hard block)
