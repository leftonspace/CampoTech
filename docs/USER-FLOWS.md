# CampoTech User Flows Documentation

This document details the complete user flows implemented in CampoTech, including decision points, error handling, and integration points.

## Table of Contents

1. [New User Onboarding Flow](#1-new-user-onboarding-flow)
2. [Subscription Change Flows](#2-subscription-change-flows)
3. [Verification Renewal Flow](#3-verification-renewal-flow)
4. [Funnel Tracking](#4-funnel-tracking)

---

## 1. New User Onboarding Flow

### Overview

The onboarding flow guides new organizations from signup through trial activation, verification completion, and job readiness.

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NEW USER ONBOARDING FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

   ┌──────────┐
   │  SIGNUP  │
   └────┬─────┘
        │
        ▼
   ┌──────────────────┐
   │ Create Account   │
   │ - Email/Password │
   │ - Org Name       │
   │ - Owner Info     │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐     ┌─────────────────────────────────────────┐
   │  TRIAL START     │────▶│ 14-day trial with INICIAL tier features │
   │  (Automatic)     │     │ trialEndsAt = now + 14 days             │
   └────────┬─────────┘     └─────────────────────────────────────────┘
            │
            ▼
   ┌──────────────────┐
   │ VERIFICATION     │
   │ (Required)       │
   └────────┬─────────┘
            │
            ├───────────────────────────────────────┐
            ▼                                       ▼
   ┌──────────────────┐                    ┌──────────────────┐
   │ CUIT Submission  │                    │ Phone Verification│
   │ - AFIP Lookup    │                    │ - SMS Code        │
   │ - Auto-verify    │                    │ - WhatsApp opt    │
   └────────┬─────────┘                    └────────┬─────────┘
            │                                       │
            ▼                                       │
   ┌──────────────────┐                             │
   │ DNI Submission   │                             │
   │ - Front/Back     │                             │
   │ - OCR Extract    │                             │
   └────────┬─────────┘                             │
            │                                       │
            ▼                                       │
   ┌──────────────────┐                             │
   │ Selfie Liveness  │                             │
   │ - Face Match     │                             │
   │ - Liveness Check │                             │
   └────────┬─────────┘                             │
            │                                       │
            ▼                                       │
   ┌──────────────────┐◀────────────────────────────┘
   │ VERIFICATION     │
   │ COMPLETE         │
   │ (Tier 2 Done)    │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐     ┌───────────────────────────────────────┐
   │ CAN RECEIVE JOBS │────▶│ Organization is job-ready when:       │
   │ (Ready State)    │     │ - Trial active OR paid subscription   │
   │                  │     │ - Tier 2 verification complete        │
   └────────┬─────────┘     │ - Not blocked (soft or hard)          │
            │               └───────────────────────────────────────┘
            │
            ▼
   ┌──────────────────┐
   │ FIRST JOB        │
   │ CREATED          │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ TRIAL EXPIRING   │─────▶ Reminders at: 7 days, 3 days, 1 day
   │ (Day 7-14)       │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ CONVERT TO PAID? │
   └────────┬─────────┘
            │
     ┌──────┴──────┐
     │             │
     ▼             ▼
   ┌─────┐     ┌─────────────┐
   │ YES │     │     NO      │
   └──┬──┘     └──────┬──────┘
      │               │
      ▼               ▼
   ┌──────────┐   ┌─────────────────┐
   │ PAID     │   │ TRIAL EXPIRED   │
   │ CUSTOMER │   │ - Soft Block    │
   └──────────┘   │ - Grace Period  │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ HARD BLOCK      │
                  │ (After 7 days)  │
                  └─────────────────┘
```

### Decision Points

| Point | Condition | Action |
|-------|-----------|--------|
| Trial Start | Account created | Auto-start 14-day trial with INICIAL features |
| Verification Required | Before receiving jobs | Must complete Tier 2 (CUIT, DNI, Selfie, Phone) |
| Can Receive Jobs | Trial active + Tier 2 complete + Not blocked | Enable job assignment |
| Trial Expiring | 7, 3, 1 days remaining | Send email/notification reminders |
| Trial Expired | trialEndsAt passed | Apply soft_block, 7-day grace period |
| Grace Period Expired | 7 days after trial end | Apply hard_block |

### Error Handling

| Error | Handling |
|-------|----------|
| AFIP lookup fails | Allow manual entry, flag for review |
| DNI OCR fails | Request manual data entry confirmation |
| Selfie liveness fails | Allow up to 3 retries, then manual review |
| Phone verification fails | Allow resend after 60 seconds, max 5/day |
| Payment fails | Soft block, retry prompts, support escalation |

### Integration Points

- **TrialManager**: `trialManager.startTrial()`, `trialManager.checkTrialStatus()`
- **VerificationManager**: `verificationManager.submitDocument()`, `verificationManager.getStatus()`
- **BlockManager**: `blockManager.applyBlock()`, `blockManager.removeBlock()`
- **FunnelTracker**: Events logged at each step for conversion analytics

---

## 2. Subscription Change Flows

### Overview

Handles all subscription lifecycle changes including upgrades, downgrades, cancellations, and reactivations.

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SUBSCRIPTION CHANGE FLOWS                               │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                               UPGRADE FLOW
═══════════════════════════════════════════════════════════════════════════════

   ┌──────────────┐
   │ CURRENT TIER │
   │ (e.g. INICIAL)│
   └──────┬───────┘
          │
          ▼
   ┌──────────────────┐
   │ SELECT NEW TIER  │
   │ (e.g. PROFESIONAL)│
   └────────┬─────────┘
          │
          ▼
   ┌──────────────────┐     ┌───────────────────────────────────────┐
   │ CALCULATE        │     │ Prorated Amount Calculation:          │
   │ PRORATION        │────▶│                                       │
   └────────┬─────────┘     │ daysRemaining = periodEnd - today     │
            │               │ dailyDiff = (newPrice - oldPrice) / 30│
            │               │ prorated = dailyDiff × daysRemaining  │
            │               └───────────────────────────────────────┘
            ▼
   ┌──────────────────┐
   │ PREVIEW CHANGE   │
   │ - Show price diff│
   │ - Show prorated  │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ CONFIRM & PAY    │
   │ (MercadoPago)    │
   └────────┬─────────┘
            │
     ┌──────┴──────┐
     │             │
     ▼             ▼
   ┌─────┐     ┌────────┐
   │ OK  │     │ FAILED │
   └──┬──┘     └────┬───┘
      │             │
      ▼             ▼
   ┌──────────┐  ┌─────────────┐
   │ UPGRADE  │  │ KEEP        │
   │ APPLIED  │  │ CURRENT TIER│
   │ IMMEDIATE│  └─────────────┘
   └──────────┘

═══════════════════════════════════════════════════════════════════════════════
                              DOWNGRADE FLOW
═══════════════════════════════════════════════════════════════════════════════

   ┌──────────────────┐
   │ CURRENT TIER     │
   │ (e.g. EMPRESA)   │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ SELECT LOWER TIER│
   │ (e.g. PROFESIONAL)│
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐     ┌───────────────────────────────────────┐
   │ SCHEDULE         │────▶│ Downgrade takes effect at:            │
   │ DOWNGRADE        │     │ currentPeriodEnd (no refund)          │
   └────────┬─────────┘     │                                       │
            │               │ User keeps current tier features      │
            │               │ until period ends                     │
            │               └───────────────────────────────────────┘
            ▼
   ┌──────────────────┐
   │ CONFIRM          │
   │ DOWNGRADE        │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ SCHEDULED        │
   │ scheduledTier =  │
   │ new tier         │
   └────────┬─────────┘
            │
            │ (at period end, cron runs)
            ▼
   ┌──────────────────┐
   │ DOWNGRADE        │
   │ APPLIED          │
   └──────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                           CANCELLATION FLOW
═══════════════════════════════════════════════════════════════════════════════

   ┌──────────────────┐
   │ REQUEST          │
   │ CANCELLATION     │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ LEY 24.240       │
   │ REFUND CHECK     │
   └────────┬─────────┘
            │
     ┌──────┴──────────────────────┐
     │                             │
     ▼                             ▼
┌───────────────────┐      ┌───────────────────┐
│ WITHIN 10 DAYS    │      │ AFTER 10 DAYS     │
│ OF SIGNUP/PAYMENT │      │                   │
└─────────┬─────────┘      └─────────┬─────────┘
          │                          │
          ▼                          ▼
   ┌──────────────────┐      ┌───────────────────┐
   │ FULL REFUND      │      │ NO REFUND         │
   │ (Ley 24.240)     │      │ Access until      │
   │                  │      │ period end        │
   └────────┬─────────┘      └─────────┬─────────┘
            │                          │
            ▼                          ▼
   ┌──────────────────┐      ┌───────────────────┐
   │ IMMEDIATE        │      │ SCHEDULED         │
   │ CANCELLATION     │      │ CANCELLATION      │
   │ - Status: expired│      │ - Cancel at       │
   │ - Apply blocks   │      │   period end      │
   └──────────────────┘      └───────────────────┘

   ┌───────────────────────────────────────────────────────────────┐
   │ Ley 24.240 (Argentine Consumer Protection Law):              │
   │ - 10-day "cooling off" period from first payment             │
   │ - Customer entitled to FULL refund within this period        │
   │ - Must process refund within 72 hours                        │
   └───────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                           REACTIVATION FLOW
═══════════════════════════════════════════════════════════════════════════════

   ┌──────────────────┐
   │ CANCELLED/       │
   │ EXPIRED ACCOUNT  │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ SELECT PLAN      │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ PROCESS PAYMENT  │
   │ (Full month)     │
   └────────┬─────────┘
            │
     ┌──────┴──────┐
     │             │
     ▼             ▼
   ┌─────┐     ┌────────┐
   │ OK  │     │ FAILED │
   └──┬──┘     └────┬───┘
      │             │
      ▼             ▼
   ┌──────────────────┐  ┌─────────────┐
   │ REACTIVATE       │  │ REMAIN      │
   │ - Remove blocks  │  │ CANCELLED   │
   │ - Status: active │  └─────────────┘
   │ - Clear scheduled│
   │   cancellation   │
   └──────────────────┘
```

### Tier Pricing (ARS)

| Tier | Monthly Price | Features |
|------|---------------|----------|
| FREE | $0 | Basic access, limited jobs |
| INICIAL | $25,000 | Standard features, 50 jobs/month |
| PROFESIONAL | $55,000 | Advanced features, 200 jobs/month |
| EMPRESA | $120,000 | Enterprise features, unlimited jobs |

### Decision Points

| Point | Condition | Action |
|-------|-----------|--------|
| Upgrade | New tier > Current tier | Calculate proration, immediate apply |
| Downgrade | New tier < Current tier | Schedule for period end |
| Cancel within 10 days | First payment ≤ 10 days ago | Full refund (Ley 24.240) |
| Cancel after 10 days | First payment > 10 days ago | No refund, access until period end |
| Reactivate | Status = cancelled/expired | Full payment, immediate activation |

### Error Handling

| Error | Handling |
|-------|----------|
| Payment fails | Keep current tier, show error, log attempt |
| Proration calculation error | Fall back to full price, alert support |
| Refund fails | Retry 3 times, escalate to manual processing |
| MercadoPago timeout | Queue for retry, notify user |

---

## 3. Verification Renewal Flow

### Overview

Manages document expiration, renewal submissions, and approval/rejection with grace periods.

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     VERIFICATION RENEWAL FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                         DOCUMENT EXPIRATION REMINDERS
═══════════════════════════════════════════════════════════════════════════════

   ┌──────────────────┐
   │ ACTIVE DOCUMENT  │
   │ status: approved │
   │ expiresAt: X     │
   └────────┬─────────┘
            │
            │ (daily cron check at 8am Buenos Aires)
            ▼
   ┌──────────────────┐
   │ EXPIRATION       │
   │ CALCULATION      │
   └────────┬─────────┘
            │
   ┌────────┼────────────────────────────────────────┐
   │        │                                        │
   ▼        ▼                ▼                       ▼
┌──────┐ ┌──────┐        ┌──────┐               ┌──────┐
│30 DAY│ │14 DAY│        │7 DAY │               │1 DAY │
│NOTICE│ │NOTICE│        │URGENT│               │FINAL │
└──┬───┘ └──┬───┘        └──┬───┘               └──┬───┘
   │        │               │                      │
   ▼        ▼               ▼                      ▼
┌──────────────────────────────────────────────────────┐
│ SEND NOTIFICATIONS:                                   │
│ - Email (if enabled in preferences)                   │
│ - In-app notification (always)                        │
│ - WhatsApp (if available and enabled)                 │
└──────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                           RENEWAL SUBMISSION
═══════════════════════════════════════════════════════════════════════════════

   ┌──────────────────┐     ┌───────────────────────────────────────┐
   │ USER STARTS      │     │ IMPORTANT: Old document remains       │
   │ RENEWAL          │────▶│ VALID while new one is being reviewed │
   └────────┬─────────┘     └───────────────────────────────────────┘
            │
            ▼
   ┌──────────────────┐
   │ CREATE NEW       │
   │ DOCUMENT RECORD  │
   │ status: pending  │
   │ isRenewal: true  │
   │ previousDocId: X │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ UPLOAD NEW       │
   │ DOCUMENT FILES   │
   │ (front/back/etc) │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ SUBMIT FOR       │
   │ REVIEW           │
   │ status: review   │
   └────────┬─────────┘
            │
            │ (Admin reviews)
            │
     ┌──────┴──────┐
     │             │
     ▼             ▼
┌─────────┐   ┌──────────┐
│APPROVED │   │ REJECTED │
└────┬────┘   └────┬─────┘
     │             │
     ▼             ▼
┌──────────────┐  ┌───────────────────────────────────┐
│ NEW DOC      │  │ REJECTION HANDLING:               │
│ BECOMES      │  │ - 7-day grace period to fix       │
│ ACTIVE       │  │ - Old doc remains valid           │
│              │  │ - Clear rejection reason provided │
│ Old doc      │  │ - Can resubmit multiple times     │
│ archived     │  └─────────────┬─────────────────────┘
└──────────────┘                │
                                ▼
                       ┌─────────────────┐
                       │ GRACE PERIOD    │
                       │ EXPIRED?        │
                       └────────┬────────┘
                                │
                         ┌──────┴──────┐
                         │             │
                         ▼             ▼
                      ┌─────┐      ┌──────┐
                      │ NO  │      │ YES  │
                      └──┬──┘      └──┬───┘
                         │            │
                         ▼            ▼
                  ┌───────────┐  ┌────────────┐
                  │ CAN STILL │  │ SOFT BLOCK │
                  │ RESUBMIT  │  │ APPLIED    │
                  └───────────┘  └────────────┘

═══════════════════════════════════════════════════════════════════════════════
                         DOCUMENT EXPIRATION
═══════════════════════════════════════════════════════════════════════════════

   ┌──────────────────┐
   │ DOCUMENT         │
   │ EXPIRES          │
   │ (expiresAt past) │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ RENEWAL          │
   │ IN PROGRESS?     │
   └────────┬─────────┘
            │
     ┌──────┴──────┐
     │             │
     ▼             ▼
   ┌─────┐     ┌──────┐
   │ YES │     │  NO  │
   └──┬──┘     └──┬───┘
      │           │
      ▼           ▼
┌───────────┐  ┌────────────────┐
│ EXTEND    │  │ MARK EXPIRED   │
│ GRACE     │  │ status: expired│
│ PERIOD    │  └───────┬────────┘
│ (+7 days) │          │
└───────────┘          ▼
               ┌────────────────┐
               │ 7-DAY GRACE    │
               │ PERIOD         │
               │ - Soft block   │
               │ - Can renew    │
               └───────┬────────┘
                       │
                       ▼
               ┌────────────────┐
               │ GRACE EXPIRED? │
               └───────┬────────┘
                       │
                ┌──────┴──────┐
                │             │
                ▼             ▼
             ┌─────┐      ┌──────┐
             │ NO  │      │ YES  │
             └─────┘      └──┬───┘
                            │
                            ▼
                     ┌─────────────┐
                     │ HARD BLOCK  │
                     │ APPLIED     │
                     │             │
                     │ Can only    │
                     │ access:     │
                     │ - /blocked  │
                     │ - /billing  │
                     └─────────────┘
```

### Document Types & Expiration

| Document | Typical Validity | Renewal Timing |
|----------|------------------|----------------|
| DNI | Until replacement | Manual review only |
| CUIT | Permanent (AFIP validated) | Weekly AFIP revalidation |
| Driver License | 1-5 years | 30 days before expiry |
| Insurance | 1 year | 30 days before expiry |
| Vehicle Registration | 1 year | 30 days before expiry |
| Work Permit | Varies | 30 days before expiry |

### Grace Periods

| Scenario | Grace Period | Block Type |
|----------|--------------|------------|
| Document expires | 7 days | Soft block |
| Renewal rejected | 7 days | None (old doc still valid) |
| Grace period expires | Immediate | Hard block |
| Renewal submitted in grace | Extended +7 days | Soft block lifted if approved |

### Decision Points

| Point | Condition | Action |
|-------|-----------|--------|
| Send reminder | expiresAt - 30/14/7/1 days | Email + in-app notification |
| Start renewal | User initiates | Create new doc record, keep old valid |
| Approve renewal | Admin approves | Archive old, activate new |
| Reject renewal | Admin rejects | Notify user, start 7-day grace |
| Document expired | expiresAt passed | 7-day grace, soft block |
| Grace expired | 7 days post-expiry | Hard block applied |

### Error Handling

| Error | Handling |
|-------|----------|
| File upload fails | Retry 3 times, show clear error |
| Notification send fails | Queue for retry, log error |
| AFIP revalidation fails | Keep current status, retry next week |
| Multiple renewals conflict | Only allow one pending renewal per doc type |

---

## 4. Funnel Tracking

### Overview

The FunnelTracker service monitors user journeys through conversion funnels for analytics and optimization.

### Tracked Funnels

#### Main Conversion Funnel
```
signup_completed → trial_started → verification_started → cuit_verified →
verification_completed → plan_viewed → checkout_started → payment_succeeded
```

#### Verification Funnel
```
verification_started → cuit_submitted → cuit_verified → dni_submitted →
dni_verified → selfie_submitted → selfie_verified → phone_verified →
verification_completed
```

### Event Types

| Category | Events |
|----------|--------|
| Signup & Trial | signup_started, signup_completed, trial_started, trial_activated, trial_expiring_soon, trial_expired, trial_converted |
| Onboarding | onboarding_started, onboarding_step_completed, onboarding_completed, onboarding_dropped |
| Verification | verification_started, cuit_submitted, cuit_verified, dni_submitted, dni_verified, selfie_submitted, selfie_verified, phone_verified, verification_completed |
| Document Renewal | document_expiring_notified, document_renewal_started, document_renewal_submitted, document_renewal_approved, document_renewal_rejected, document_expired |
| Subscription | plan_viewed, checkout_started, checkout_completed, checkout_abandoned, payment_succeeded, payment_failed |
| Subscription Changes | upgrade_initiated, upgrade_completed, downgrade_scheduled, subscription_cancelled, subscription_reactivated |
| Jobs | first_job_created, first_job_assigned, first_job_completed |

### Metrics Available

| Metric | Description |
|--------|-------------|
| Conversion Rate | % completing the funnel |
| Drop-off Points | Where users abandon |
| Time to Conversion | Avg days from start to complete |
| Step Completion | Users reaching each step |

### Usage

```typescript
import { funnelTracker } from '@/lib/services/funnel-tracker';

// Track an event
await funnelTracker.trackEvent({
  event: 'verification_completed',
  organizationId: 'org_123',
  userId: 'user_456',
  metadata: { tier: 2 }
});

// Get funnel metrics
const metrics = await funnelTracker.getFunnelMetrics('verification', {
  start: new Date('2024-01-01'),
  end: new Date('2024-12-31')
});

// Get org status
const status = await funnelTracker.getOrganizationFunnelStatus('org_123');
```

---

## Implementation Files

| Flow | File | Key Class/Export |
|------|------|------------------|
| Onboarding | `apps/web/lib/services/onboarding-flow.ts` | `onboardingFlow` |
| Subscription Changes | `apps/web/lib/services/subscription-flows.ts` | `subscriptionFlows` |
| Verification Renewal | `apps/web/lib/services/verification-renewal-flow.ts` | `verificationRenewalFlow` |
| Funnel Tracking | `apps/web/lib/services/funnel-tracker.ts` | `funnelTracker` |

---

## Buenos Aires Timezone Considerations

All date/time calculations use Buenos Aires timezone (America/Argentina/Buenos_Aires, UTC-3):

- **Cron jobs** run at Buenos Aires local time
- **Trial expiration** calculated at midnight Buenos Aires
- **Document expiration** calculated at midnight Buenos Aires
- **Grace periods** start at midnight Buenos Aires

### Cron Schedule (UTC)

| Job | Buenos Aires | UTC |
|-----|--------------|-----|
| Document Expiring | 8:00 AM | 11:00 UTC |
| Document Expired | 6:00 AM | 09:00 UTC |
| Employee Compliance | 8:00 AM | 11:00 UTC |
| AFIP Revalidation | 3:00 AM Sunday | 06:00 UTC Sunday |
| Scheduled Downgrades | 12:01 AM | 03:01 UTC |

---

## Related Documentation

- [Subscription & Verification Roadmap](./CAMPOTECH-SUBSCRIPTION-VERIFICATION-ROADMAP.md)
- [API Documentation](./API.md)
- [Database Schema](./DATABASE.md)
