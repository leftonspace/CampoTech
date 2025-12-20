# Existing Codebase Analysis - CampoTech Subscription & Verification System

**Document Version:** 1.0
**Analysis Date:** December 2025
**Scope:** Phase 0 Discovery (Tasks 0.1.1 - 0.1.4)

---

## Executive Summary

This document provides a comprehensive analysis of the existing CampoTech codebase to identify what infrastructure exists, what can be reused, and what gaps need to be filled for the Subscription Billing and Verification/Compliance systems.

### Key Findings

| Category | Status | Notes |
|----------|--------|-------|
| Database Schema | Partial | Organizations & Users exist; subscription tables need to be created |
| Subscription Management | Partial | Service exists but no database tables |
| MercadoPago Integration | Complete | Full client with circuit breaker, fallback handling |
| AFIP Integration | Complete | Rate limiting, batch processing, circuit breaker |
| Authentication | Complete | JWT-based with 24h tokens |
| Email/SMS/WhatsApp | Complete | Resend, Twilio, Meta WhatsApp Cloud API |
| Admin Panel | Partial | Uses mock data; needs real API integration |
| Cron Jobs | Partial | Storage optimization exists; needs subscription jobs |

---

## 1. Database Schema Review

### 1.1 Current Database Structure

**Location:** `apps/web/prisma/schema.prisma`
**Total Models:** 80+ models
**Database:** PostgreSQL

### 1.2 Core Tables Relevant to Subscription/Verification

#### Organizations Table
```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  phone     String?
  email     String?
  logo      String?
  settings  Json     @default("{}")  // Contains subscriptionTier
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // WhatsApp fields exist
  whatsappPhoneNumberId       String?
  whatsappBusinessAccountId   String?
  whatsappAccessToken         String?
  // ... many relations
}
```

**Findings:**
- NO dedicated subscription columns (tier stored in JSON settings)
- NO verification status fields
- NO trial_ends_at field
- NO marketplace visibility fields
- These need to be added

#### Users Table
```prisma
model User {
  id             String   @id @default(cuid())
  email          String?
  phone          String   @unique
  name           String
  passwordHash   String?
  role           UserRole @default(TECHNICIAN)
  specialty      String?
  skillLevel     String?
  isActive       Boolean  @default(true)
  organizationId String
  // ... relations
}

enum UserRole {
  OWNER       // Full access: billing, team, settings
  DISPATCHER  // Jobs, scheduling, customers, WhatsApp, inventory
  TECHNICIAN  // Their assigned jobs only
}
```

**Findings:**
- NO verification_status field
- NO identity_verified field
- NO can_be_assigned_jobs field
- Role structure already supports OWNER (billing access)
- These fields need to be added for employee verification

### 1.3 Existing Related Tables

#### OTP & Authentication
```prisma
model OtpCode {
  id        String   @id @default(cuid())
  phone     String
  codeHash  String
  expiresAt DateTime
  attempts  Int      @default(0)
  verified  Boolean  @default(false)
  createdAt DateTime @default(now())
}

model PendingRegistration {
  id           String @id
  phone        String @unique
  cuit         String
  businessName String
  adminName    String
  email        String?
  expiresAt    DateTime
}
```

**Reusable:** OTP infrastructure for phone verification

#### Existing Payment Tables (for invoices, not subscriptions)
```prisma
model Payment {
  id             String        @id @default(cuid())
  amount         Decimal
  method         PaymentMethod // CASH, TRANSFER, CARD, MERCADOPAGO
  status         PaymentStatus // PENDING, COMPLETED, FAILED, REFUNDED
  reference      String?
  paidAt         DateTime?
  invoiceId      String
  organizationId String
}
```

**Note:** This is for customer payments, NOT subscription billing. Separate tables needed.

### 1.4 Tables That Need to Be Created

#### Subscription System (Phase 1.1)
- `organization_subscriptions` - Main subscription record
- `subscription_payments` - Payment history
- `subscription_events` - Audit log

#### Verification System (Phase 1.2)
- `verification_requirements` - Master list of requirements
- `verification_submissions` - User/org submissions
- `verification_reminders` - Notification tracking
- `compliance_acknowledgments` - Legal agreements
- `compliance_blocks` - Access blocking records

### 1.5 Existing Enums

```prisma
// Relevant existing enums
enum UserRole { OWNER, DISPATCHER, TECHNICIAN }
enum PaymentMethod { CASH, TRANSFER, CARD, MERCADOPAGO }
enum PaymentStatus { PENDING, COMPLETED, FAILED, REFUNDED }
enum InvoiceType { FACTURA_A, FACTURA_B, FACTURA_C }
enum InvoiceStatus { DRAFT, PENDING, SENT, PAID, OVERDUE, CANCELLED }
```

**Need to add:**
- `SubscriptionTier` (FREE, INICIAL, PROFESIONAL, EMPRESA)
- `SubscriptionStatus` (trialing, active, past_due, cancelled, expired, paused)
- `VerificationStatus` (pending, partial, verified, suspended)

---

## 2. Authentication & Middleware Review

### 2.1 Current Authentication Flow

**Location:** `apps/web/lib/auth.ts`

```typescript
// JWT-based authentication
const ACCESS_TOKEN_EXPIRY = '24h';

export interface TokenPayload extends JWTPayload {
  userId: string;
  email: string | null;
  role: string;
  organizationId: string;
}

export async function getSession(): Promise<TokenPayload | null>
export async function createToken(payload: TokenPayload): Promise<string>
export async function verifyToken(token: string): Promise<TokenPayload | null>
export async function requireAuth(): Promise<TokenPayload>
```

**Findings:**
- Clean JWT implementation with jose library
- 24-hour token expiry (secure)
- Session includes userId, role, organizationId
- Can be extended for subscription/verification checks

### 2.2 Existing Middleware Patterns

#### Tier Enforcement Middleware
**Location:** `apps/web/lib/middleware/tier-enforcement.ts`

```typescript
export async function enforceTierLimit(
  request: NextRequest,
  options: TierEnforcementOptions
): Promise<EnforcementResult>

export function withTierEnforcement<T>(
  handler: Function,
  options: TierEnforcementOptions
): Function

// Convenience functions
export async function checkUserLimit(orgId: string)
export async function checkJobLimit(orgId: string)
export async function checkCustomerLimit(orgId: string)
export async function checkWhatsAppLimit(orgId: string)
```

**Reusable:** This pattern can be extended for subscription + verification checks.

#### Feature Gate Middleware
**Location:** `apps/web/lib/middleware/feature-gate.ts`

Existing feature flag system that can gate features by tier.

### 2.3 Injection Points for Access Control

| Location | Purpose | Injection Point |
|----------|---------|-----------------|
| `apps/web/middleware.ts` | Route protection | Add subscription check |
| `apps/web/lib/middleware/tier-enforcement.ts` | Resource limits | Add verification check |
| `apps/web/lib/auth.ts` | Session creation | Add verification status |
| API route handlers | Per-endpoint checks | Wrap with access control |

### 2.4 Recommended Access Control Location

Create new file: `apps/web/lib/access-control/checker.ts`

```typescript
// Unified access control combining subscription + verification
export interface AccessStatus {
  canAccessDashboard: boolean;
  canReceiveJobs: boolean;
  canAssignEmployees: boolean;
  isMarketplaceVisible: boolean;
  blockReasons: BlockReason[];
  subscriptionStatus: SubscriptionStatus;
  verificationStatus: VerificationStatus;
}

export async function checkAccess(organizationId: string): Promise<AccessStatus>
```

---

## 3. Admin Panel Review

### 3.1 Structure Overview

**Location:** `apps/admin/`

```
apps/admin/
├── app/
│   ├── login/page.tsx
│   ├── dashboard/
│   │   ├── page.tsx          # Main dashboard
│   │   ├── businesses/page.tsx
│   │   ├── payments/page.tsx  # Revenue & failed payments
│   │   ├── ai/page.tsx
│   │   ├── map/page.tsx
│   │   └── costs/page.tsx
│   └── layout.tsx
├── components/
│   └── Sidebar.tsx
├── lib/
│   ├── auth.ts               # Admin authentication (separate from business users)
│   └── mock-data.ts          # Currently using mock data
└── types/
    └── index.ts
```

### 3.2 Current Admin Authentication

**Location:** `apps/admin/lib/auth.ts`

```typescript
// COMPLETELY SEPARATE from business user auth
const ADMIN_USERS: Record<string, { password: string; user: AdminUser }> = {
  'admin@campotech.com.ar': { ... },
  'kevin@campotech.com.ar': { ... },
};

export type AdminRole = 'super_admin' | 'admin' | 'viewer';

// IP whitelist support
const IP_WHITELIST = process.env.ADMIN_IP_WHITELIST?.split(',') || [];
```

**Note:** Admin auth is independent - good for security.

### 3.3 Existing Admin Pages

#### Dashboard (Mock Data)
- Total businesses, active businesses
- MRR (Monthly Recurring Revenue)
- Churn rate
- System health indicators
- Failed payments section

#### Payments Page (Mock Data)
- Revenue charts
- Revenue by tier breakdown
- Failed payments list with retry/contact buttons
- Upcoming renewals table

### 3.4 Pages That Need to Be Created

| Page | Path | Purpose |
|------|------|---------|
| Subscriptions | `/admin/subscriptions` | List all orgs with subscription status |
| Subscription Detail | `/admin/subscriptions/[id]` | Full subscription history, manual actions |
| Verification Queue | `/admin/verificaciones` | Pending verification submissions |
| Review Modal | `/admin/verificaciones/review/[id]` | Document review interface |
| Compliance Dashboard | `/admin/compliance` | Blocked organizations, compliance scores |

### 3.5 Mock Data to Real API Migration

**Current:** `apps/admin/lib/mock-data.ts`

```typescript
export const mockDashboardMetrics: DashboardMetrics = {
  totalBusinesses: 1247,
  activeBusinesses: 1089,
  mrr: 68450,
  newSignupsThisWeek: 23,
  // ...
};

export const mockBusinesses: Business[] = [...];
export const mockFailedPayments: FailedPayment[] = [...];
```

**Migration Plan:**
1. Create API endpoints in `apps/web/app/api/admin/`
2. Update admin pages to fetch from API
3. Share database access (admin reads from same DB)

### 3.6 Existing Admin Types

```typescript
export interface Business {
  id: string;
  name: string;
  plan: 'FREE' | 'BASICO' | 'PROFESIONAL' | 'EMPRESARIAL';
  mrr: number;
  status: 'active' | 'suspended' | 'cancelled' | 'trial';
  userCount: number;
  jobCount: number;
  notes?: string;
}

export interface FailedPayment {
  id: string;
  businessId: string;
  businessName: string;
  amount: number;
  failedAt: string;
  reason: string;
  retryCount: number;
}
```

---

## 4. Notification System Review

### 4.1 Email Infrastructure

**Location:** `apps/web/lib/email.ts`
**Provider:** Resend

```typescript
export interface EmailProvider {
  sendEmail(options: EmailOptions): Promise<EmailResult>;
}

// Implementations
class ResendEmailProvider implements EmailProvider { ... }
class ConsoleEmailProvider implements EmailProvider { ... } // Dev mode

// Factory with fallback
export function getEmailProvider(): EmailProvider
export function getOrCreateEmailProvider(): EmailProvider // Singleton
```

**Existing Templates:**
- `generateWelcomeEmailHTML()` - Employee welcome
- `generateWelcomeEmailText()` - Plain text version

**Need to Create:**
- Trial reminder emails (7d, 3d, 1d, expired)
- Payment confirmation/failure emails
- Verification status emails
- Document expiration reminders

### 4.2 SMS Infrastructure

**Location:** `apps/web/lib/sms.ts`
**Provider:** Twilio

```typescript
export interface SMSProvider {
  sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// Implementations
export class TwilioSMSProvider implements SMSProvider { ... }
export class ConsoleSMSProvider implements SMSProvider { ... } // Dev mode

export function getSMSProvider(): SMSProvider
export function getOrCreateSMSProvider(): SMSProvider
```

**Ready for:** Phone verification, OTP delivery

### 4.3 WhatsApp Infrastructure

**Location:** `apps/web/lib/whatsapp.ts`
**Provider:** Meta WhatsApp Cloud API

```typescript
export interface WhatsAppProvider {
  sendMessage(to: string, message: string): Promise<Result>;
  sendTemplate(to: string, templateName: string, languageCode: string, components?: TemplateComponent[]): Promise<Result>;
}

export class MetaWhatsAppProvider implements WhatsAppProvider {
  async sendOTP(to: string, otp: string): Promise<Result>
  // ...
}
```

**Existing Database Tables:**
- `WaConversation` - Conversations
- `WaMessage` - Messages
- `WaTemplate` - Approved templates
- `WaOutboundQueue` - Message queue
- `WaWebhookLog` - Webhook logs
- `WhatsAppBusinessAccount` - Per-org credentials

### 4.4 Cron Job Infrastructure

**Location:** `apps/web/app/api/cron/`

**Existing Jobs:**
```
apps/web/app/api/cron/
├── archive-data/route.ts      # Data archiving
├── check-budgets/route.ts     # Budget checks
├── manage-partitions/route.ts # DB partitions
└── storage-optimization/route.ts # Storage cleanup
```

**Pattern Used:**
```typescript
function validateCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const token = authHeader.replace('Bearer ', '');
  return token === cronSecret;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!validateCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... job logic
}
```

**Cron Jobs Needed:**
| Job | Schedule | Purpose |
|-----|----------|---------|
| `trial-expiration` | Daily 00:00 | Expire trials, send reminders |
| `subscription-renewal` | Daily 00:00 | Process renewals, check payments |
| `verification-expiration` | Daily 00:00 | Check document expirations |
| `afip-revalidation` | Weekly | Revalidate CUIT/AFIP status |
| `compliance-status` | Daily | Update org compliance scores |

---

## 5. Subscription Manager Review

### 5.1 Existing Service

**Location:** `apps/web/lib/services/subscription-manager.ts`

```typescript
export type SubscriptionTier = 'FREE' | 'BASICO' | 'PROFESIONAL' | 'EMPRESARIAL';

export type SubscriptionStatus =
  | 'pending' | 'active' | 'paused' | 'cancelled' | 'past_due' | 'expired';

class SubscriptionManager {
  // Stores tier in organization.settings JSON
  async getCurrentTier(orgId: string): Promise<SubscriptionTier>
  async updateOrganizationTier(orgId: string, tier: SubscriptionTier): Promise<void>

  // Uses raw SQL for non-existent tables
  async getSubscription(orgId: string): Promise<Subscription | null>
  async upsertSubscription(data: { ... }): Promise<Subscription>

  // Webhook handling (ready but tables don't exist)
  async handleWebhookEvent(eventType: string, mpSubscriptionId: string, eventData: object)

  // Cron job (ready)
  async processExpiredSubscriptions(): Promise<number>
}

export const subscriptionManager = new SubscriptionManager();
```

### 5.2 Tier Limits Configuration

**Location:** `apps/web/lib/config/tier-limits.ts`

```typescript
export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  FREE: {
    maxUsers: 1,
    maxJobsPerMonth: 30,
    maxCustomers: 50,
    maxWhatsAppMessagesPerMonth: 0,
    priceUsd: 0,
    priceDisplay: 'Gratis',
  },
  BASICO: {
    maxUsers: 1,
    maxJobsPerMonth: 50,
    priceUsd: 25,
    priceDisplay: '$25/mes',
  },
  PROFESIONAL: {
    maxUsers: 5,
    maxJobsPerMonth: 200,
    priceUsd: 55,
    priceDisplay: '$55/mes',
  },
  EMPRESARIAL: {
    maxUsers: UNLIMITED,
    maxJobsPerMonth: UNLIMITED,
    priceUsd: 120,
    priceDisplay: '$120/mes',
  },
};
```

**Ready for use** - tier limits are fully defined.

### 5.3 Issues to Address

1. **No Database Tables**: Service queries non-existent tables
2. **Tier Storage**: Currently in JSON, should be dedicated columns
3. **Trial System**: Not implemented
4. **MP Subscription API**: Placeholder checkout URL

---

## 6. MercadoPago Integration

### 6.1 Existing Implementation

**Location:** `apps/web/lib/integrations/mercadopago/`

```
mercadopago/
├── client.ts         # MPResilientClient with resilience patterns
├── circuit-breaker.ts # Circuit breaker implementation
├── fallback.ts       # Manual payment fallback handling
├── types.ts          # Full type definitions
└── index.ts
```

### 6.2 Client Capabilities

```typescript
export class MPResilientClient {
  // Preference creation with fallback
  async createPreference(orgId: string, accessToken: string, request: CreatePreferenceRequest)

  // Payment queries
  async getPayment(accessToken: string, paymentId: string): Promise<Payment | null>
  async searchPayments(accessToken: string, params: object): Promise<Results>

  // Webhook handling
  validateWebhook(notification: WebhookNotification, signature?: string): boolean
  async processWebhook(accessToken: string, notification: WebhookNotification): Promise<Payment | null>

  // Fallback operations
  async createFallbackPayment(params: FallbackParams): Promise<FallbackPaymentRecord>
  async getPaymentInstructions(orgId: string, method: 'transfer' | 'cash')
  formatForWhatsApp(instructions: ManualPaymentInstructions): string

  // Status
  async getServiceStatus(orgId?: string): Promise<MPServiceStatus>
  isHealthy(): boolean
}
```

### 6.3 Database Tables for MP

```prisma
model FallbackPayment {
  id             String @id
  organizationId String
  invoiceId      String
  customerId     String
  amount         Decimal
  status         FallbackPaymentStatus // pending, confirmed, expired, cancelled
  reason         String // api_unavailable, circuit_open, etc.
  createdAt      DateTime
  // ...
}
```

### 6.4 Ready for Subscriptions

The MP client is **production-ready** for:
- Creating checkout preferences
- Processing webhooks
- Handling payment failures with fallback
- Circuit breaker for API resilience

**Needs Extension:**
- Subscription plan creation/management API calls
- Subscription-specific webhook handling
- Recurring payment processing

---

## 7. AFIP Integration

### 7.1 Existing Implementation

**Location:** `apps/web/lib/integrations/afip/`

```
afip/
├── client.ts         # AFIPClient with all resilience patterns
├── rate-limiter.ts   # Global + per-org rate limiting
├── circuit-breaker.ts # Per-org circuit breaker
├── batch-processor.ts # Queue processing
├── types.ts
└── index.ts
```

### 7.2 Client Capabilities

```typescript
export class AFIPClient {
  // CAE operations
  async requestCAE(invoiceId: string, orgId: string, options?: { priority: string })
  async requestCAEImmediate(invoiceId: string, orgId: string)
  async requestCAEBatch(invoices: Array<{ invoiceId, orgId, priority }>)

  // Status
  async getSystemStatus(orgId?: string): Promise<AFIPSystemStatus>
  canProceed(orgId: string): { allowed: boolean; reason?: string; waitTime?: number }

  // Control
  forceCircuitOpen(orgId?: string, reason?: string)
  forceCircuitClose(orgId?: string)
  pauseProcessing()
  resumeProcessing()
}
```

### 7.3 Organization AFIP Fields

From schema (Organization doesn't have these directly, but referenced in client):
```typescript
// Expected on organization:
afipCertificate: string
afipPrivateKey: string
afipPuntoVenta: number
cuit: string
```

### 7.4 Usable for CUIT Validation

The AFIP client can be extended/used for:
- CUIT validation during verification
- AFIP status checks
- Activity code verification

---

## 8. CUIT Validation

### 8.1 Existing Implementation

**Location:** `apps/web/lib/cuit.ts`

```typescript
// CUIT/CUIL validation utilities (algorithm only, no API)
export function validateCUITChecksum(cuit: string): boolean
export function formatCUIT(cuit: string): string
export function parseCUIT(formatted: string): string
```

### 8.2 Needs for Verification

Need to add AFIP API integration for:
- Validate CUIT exists and is active
- Get taxpayer info (razón social, condición)
- Get activity codes
- Verify fiscal address

---

## 9. Files That Need Modification

### 9.1 Schema Changes

| File | Changes Needed |
|------|----------------|
| `apps/web/prisma/schema.prisma` | Add subscription tables, verification tables, org/user fields |

### 9.2 Service Updates

| File | Changes Needed |
|------|----------------|
| `apps/web/lib/services/subscription-manager.ts` | Use real database tables |
| `apps/web/lib/auth.ts` | Add subscription/verification to session |

### 9.3 New Files to Create

```
apps/web/lib/
├── services/
│   ├── trial-manager.ts
│   ├── verification-manager.ts
│   ├── auto-verifier.ts
│   ├── block-manager.ts
│   └── notification-manager.ts
├── access-control/
│   ├── checker.ts
│   └── middleware.ts
├── afip/
│   └── cuit-validator.ts
└── config/
    └── verification-requirements.ts

apps/web/app/api/
├── subscription/
│   ├── checkout/route.ts
│   ├── cancel/route.ts
│   └── status/route.ts
├── verification/
│   ├── upload/route.ts
│   ├── validate-cuit/route.ts
│   ├── acknowledge/route.ts
│   └── status/route.ts
└── webhooks/
    └── mercadopago/
        └── subscription/route.ts

apps/web/app/dashboard/
├── settings/billing/
│   ├── page.tsx
│   ├── checkout/page.tsx
│   └── success/page.tsx
└── verificacion/
    └── page.tsx

apps/admin/app/dashboard/
├── subscriptions/
│   ├── page.tsx
│   └── [id]/page.tsx
└── verificaciones/
    ├── page.tsx
    └── review/[id]/page.tsx
```

---

## 10. Patterns to Follow

### 10.1 Service Pattern
```typescript
// Singleton services with factory function
class MyService {
  // ... implementation
}
export const myService = new MyService();
```

### 10.2 API Route Pattern
```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ... business logic

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

### 10.3 Middleware Pattern
```typescript
export function withSomeMiddleware<T>(
  handler: (request: NextRequest, context: { params: Promise<T> }) => Promise<NextResponse>,
  options: MiddlewareOptions
): (request: NextRequest, context: { params: Promise<T> }) => Promise<NextResponse> {
  return async (request, context) => {
    // pre-processing
    const response = await handler(request, context);
    // post-processing
    return response;
  };
}
```

### 10.4 Cron Job Pattern
```typescript
function validateCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return process.env.NODE_ENV === 'development';
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  return token === cronSecret;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!validateCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... job logic
}
```

---

## 11. Existing Code to Reuse

### 11.1 Direct Reuse

| Component | Location | Use Case |
|-----------|----------|----------|
| Email provider | `lib/email.ts` | All notification emails |
| SMS provider | `lib/sms.ts` | Phone verification OTP |
| WhatsApp provider | `lib/whatsapp.ts` | Reminders, verification messages |
| MP Client | `lib/integrations/mercadopago/` | Subscription payments |
| AFIP Client | `lib/integrations/afip/` | CUIT validation |
| Tier limits | `lib/config/tier-limits.ts` | Subscription tier enforcement |
| Tier enforcement | `lib/middleware/tier-enforcement.ts` | Resource limit checking |
| OTP system | `prisma/schema.prisma` (OtpCode) | Phone verification |

### 11.2 Extend/Modify

| Component | Changes Needed |
|-----------|----------------|
| Subscription manager | Use real tables instead of raw SQL |
| Auth middleware | Add subscription/verification checks |
| Admin mock data | Replace with real API calls |
| Organization model | Add subscription/verification fields |

---

## 12. Gaps to Fill

### 12.1 Critical Gaps (Must Have)

| Gap | Priority | Phase |
|-----|----------|-------|
| Subscription database tables | P0 | 1.1 |
| Verification database tables | P0 | 1.2 |
| Trial management system | P0 | 2.1 |
| MP subscription webhooks | P0 | 2.3 |
| AFIP CUIT validation API | P0 | 3.1 |
| Document upload/storage | P0 | 3.2 |
| Unified access control | P0 | 4.1 |

### 12.2 Important Gaps (Should Have)

| Gap | Priority | Phase |
|-----|----------|-------|
| Billing UI in dashboard | P1 | 5.1 |
| Verification center UI | P1 | 5.2 |
| Admin subscription management | P1 | 7.1 |
| Admin verification queue | P1 | 7.2 |

### 12.3 Nice to Have

| Gap | Priority | Phase |
|-----|----------|-------|
| In-app notifications | P2 | 8.3 |
| Employee verification portal | P2 | 6.1 |
| Optional badges/certifications | P2 | 3.4 |

---

## 13. Environment Variables Needed

### 13.1 Existing (Already Used)
```bash
# Database
DATABASE_URL=

# Auth
NEXTAUTH_SECRET=

# Email
RESEND_API_KEY=
EMAIL_FROM=

# SMS
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_BUSINESS_ACCOUNT_ID=

# Cron
CRON_SECRET=
```

### 13.2 Needed for Subscription/Verification
```bash
# MercadoPago Subscriptions
MP_ACCESS_TOKEN=
MP_PUBLIC_KEY=
MP_WEBHOOK_SECRET=
MP_PLAN_INICIAL_MONTHLY=
MP_PLAN_INICIAL_YEARLY=
MP_PLAN_PROFESIONAL_MONTHLY=
MP_PLAN_PROFESIONAL_YEARLY=
MP_PLAN_EMPRESA_MONTHLY=
MP_PLAN_EMPRESA_YEARLY=

# AFIP (for CUIT validation)
AFIP_ENVIRONMENT=production
AFIP_CERT_PATH=
AFIP_KEY_PATH=
AFIP_CUIT=

# Settings
TRIAL_DAYS=14
GRACE_PERIOD_DAYS=7
DEFAULT_TIMEZONE=America/Argentina/Buenos_Aires

# File Storage
SUPABASE_STORAGE_BUCKET=verifications
```

---

## 14. Recommendations

### 14.1 Implementation Order

1. **Phase 1**: Database schema first (creates foundation)
2. **Phase 2**: Trial + basic checkout (immediate business value)
3. **Phase 4**: Access control (blocking works before verification complete)
4. **Phase 3**: Verification system (can iterate on requirements)
5. **Phase 5-6**: Dashboard UI (can test with API)
6. **Phase 7**: Admin panel (after main flows work)
7. **Phase 8-10**: Polish and testing

### 14.2 Testing Strategy

- Unit tests for services (trial manager, verification manager)
- Integration tests for webhooks
- E2E tests for critical flows (signup → trial → pay)

### 14.3 Migration Strategy

- Add new tables in separate migrations
- Add new columns as nullable first
- Backfill existing organizations with trial or free status
- Deploy incrementally

---

## Appendix A: Complete Table List

### Existing Tables (80+)
<details>
<summary>Click to expand full list</summary>

- organizations
- users
- customers
- jobs
- job_assignments
- job_visits
- invoices
- invoice_items
- payments
- payment_disputes
- otp_codes
- pending_registrations
- whatsapp_messages
- voice_messages
- voice_transcripts
- wa_conversations
- wa_messages
- wa_templates
- wa_outbound_queue
- wa_webhook_logs
- whatsapp_business_accounts
- scheduled_reminders
- audio_messages
- auto_response_logs
- conversation_contexts
- message_buffer_stats
- message_aggregation_events
- scheduled_reports
- reports
- report_executions
- report_history
- reviews
- locations
- zones
- location_settings
- location_afip_configs
- inter_location_transfers
- product_categories
- products
- product_variants
- warehouses
- storage_locations
- inventory_levels
- stock_movements
- stock_reservations
- suppliers
- supplier_products
- purchase_orders
- purchase_order_items
- purchase_receivings
- inventory_counts
- inventory_count_items
- vehicle_stocks
- replenishment_requests
- job_materials
- job_photos
- failed_jobs
- idempotency_keys
- technician_locations
- technician_location_history
- tracking_sessions
- tracking_tokens
- tracking_location_history
- eta_cache
- vehicles
- vehicle_documents
- vehicle_assignments
- vehicle_maintenance
- inventory_items
- inventory_locations
- inventory_stock
- inventory_transactions
- dashboard_alerts
- price_items
- service_type_configs
- audit_logs
- notification_preferences
- notification_logs
- events
- onboarding_progress
- panic_modes
- fallback_payments
- employee_verification_tokens
- chargebacks
- support_tickets
- sms_outbound_queue
- employee_schedules
- schedule_exceptions
- ai_configuration
- ai_conversation_logs
- business_public_profiles
- notifications

</details>

### Tables to Create
- organization_subscriptions
- subscription_payments
- subscription_events
- verification_requirements
- verification_submissions
- verification_reminders
- compliance_acknowledgments
- compliance_blocks

---

*End of Analysis Document*
