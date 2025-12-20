# CampoTech Subscription Billing - Complete Implementation Plan

## Overview

This document outlines the complete implementation plan for CampoTech's subscription billing system. The goal is to create a fully functional payment flow from signup to subscription, with all Argentine payment methods, free trial support, and admin visibility.

---

## Business Requirements

| Requirement | Description |
|-------------|-------------|
| **Free Trial** | 14 days, no payment info required |
| **Payment Methods** | All methods common in Argentina |
| **Billing Cycles** | Monthly + Yearly (with discount) |
| **Access Control** | No access after trial unless paid |
| **Admin Visibility** | Full payment monitoring in admin app |
| **Legal Compliance** | Ley 24.240 (Derecho de Arrepentimiento) |

---

## Subscription Tiers

| Tier | Monthly (ARS) | Yearly (ARS) | Yearly Discount |
|------|---------------|--------------|-----------------|
| Gratis | $0 | $0 | - |
| Inicial | $25,000 | $250,000 | ~17% off (2 months free) |
| Profesional | $55,000 | $550,000 | ~17% off |
| Empresa | $120,000 | $1,200,000 | ~17% off |

*Note: Prices in ARS, approximately $25/55/120 USD equivalent*

---

## Argentine Payment Methods to Support

| Method | Type | Provider | Priority |
|--------|------|----------|----------|
| **Tarjeta de Crédito** | Credit Card | Visa, Mastercard, Amex, Naranja, Cabal | P0 |
| **Tarjeta de Débito** | Debit Card | Maestro, Visa Débito | P0 |
| **Transferencia Bancaria** | Bank Transfer | CBU/CVU | P0 |
| **Rapipago** | Cash | Rapipago network | P1 |
| **Pago Fácil** | Cash | Pago Fácil network | P1 |
| **Mercado Pago Wallet** | Wallet | MP Balance | P0 |
| **QR Code** | QR Payment | MP QR | P1 |
| **Cuotas** | Installments | 3, 6, 12 cuotas | P0 |

---

## Phase 1: Database Schema & Core Models (Foundation)

### Tasks

1. **Create `organization_subscriptions` table migration**
   - `id` (TEXT, PRIMARY KEY)
   - `organization_id` (TEXT, FK to organizations)
   - `tier` (ENUM: FREE, BASICO, PROFESIONAL, EMPRESARIAL)
   - `billing_cycle` (ENUM: MONTHLY, YEARLY)
   - `status` (ENUM: trialing, active, past_due, cancelled, expired, paused)
   - `trial_ends_at` (TIMESTAMPTZ)
   - `current_period_start` (TIMESTAMPTZ)
   - `current_period_end` (TIMESTAMPTZ)
   - `mp_subscription_id` (TEXT, nullable)
   - `mp_payer_id` (TEXT, nullable)
   - `cancelled_at` (TIMESTAMPTZ, nullable)
   - `cancel_reason` (TEXT, nullable)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

2. **Create `subscription_payments` table migration**
   - `id` (TEXT, PRIMARY KEY)
   - `subscription_id` (TEXT, FK)
   - `organization_id` (TEXT, FK)
   - `amount` (DECIMAL)
   - `currency` (TEXT, default 'ARS')
   - `status` (ENUM: pending, processing, completed, failed, refunded)
   - `payment_method` (TEXT)
   - `payment_type` (TEXT) - credit_card, debit_card, bank_transfer, cash, wallet
   - `mp_payment_id` (TEXT)
   - `mp_preference_id` (TEXT)
   - `billing_cycle` (ENUM: MONTHLY, YEARLY)
   - `period_start` (TIMESTAMPTZ)
   - `period_end` (TIMESTAMPTZ)
   - `failure_reason` (TEXT, nullable)
   - `retry_count` (INTEGER, default 0)
   - `paid_at` (TIMESTAMPTZ, nullable)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

3. **Create `subscription_events` table migration**
   - For audit logging of all subscription events
   - `id`, `subscription_id`, `organization_id`
   - `event_type`, `event_data` (JSONB)
   - `created_at`

4. **Update `organizations` table**
   - Add `subscription_tier` (TEXT, default 'FREE')
   - Add `trial_ends_at` (TIMESTAMPTZ, nullable)
   - Add `subscription_status` (TEXT)

5. **Create indexes for query optimization**
   - Index on `organization_subscriptions(organization_id)`
   - Index on `subscription_payments(subscription_id, status)`
   - Index on `subscription_payments(organization_id, created_at)`
   - Index on `subscription_events(subscription_id, created_at)`

### Tests

- [ ] Migration runs without errors
- [ ] All foreign keys properly created
- [ ] Indexes exist and are used in query plans
- [ ] Enum constraints work correctly
- [ ] Default values applied correctly

---

## Phase 2: Trial System Implementation

### Tasks

1. **Update signup flow to create trial subscription**
   - On organization creation, automatically create subscription record
   - Set `status = 'trialing'`
   - Set `trial_ends_at = NOW() + 14 days`
   - Set `tier = 'FREE'` (trial uses FREE tier limits, not paid limits)

2. **Create trial status checking service**
   - `isTrialActive(orgId)` - Check if trial is still valid
   - `getTrialDaysRemaining(orgId)` - Days left in trial
   - `isTrialExpired(orgId)` - Has trial ended without payment

3. **Create trial expiration warning system**
   - Email notification at 7 days remaining
   - Email notification at 3 days remaining
   - Email notification at 1 day remaining
   - In-app banner showing trial status

4. **Create trial expiration cron job**
   - Runs daily at midnight Buenos Aires time
   - Finds all expired trials (trial_ends_at < NOW())
   - If no active subscription payment: set `status = 'expired'`
   - Restrict access for expired trials

5. **Update middleware for access control**
   - Allow access during active trial
   - Allow access with active paid subscription
   - Block access if trial expired AND no payment
   - Redirect to billing page with upgrade prompt

### Tests

- [ ] New organization gets 14-day trial automatically
- [ ] Trial days remaining calculates correctly across timezones
- [ ] Trial expiration emails sent at correct intervals
- [ ] Access blocked after trial expires without payment
- [ ] Upgrade during trial works correctly
- [ ] Trial status shows correctly in UI

---

## Phase 3: MercadoPago Subscription Integration

### Tasks

1. **Create MercadoPago subscription plans in MP dashboard**
   - Create Inicial Monthly plan
   - Create Inicial Yearly plan
   - Create Profesional Monthly plan
   - Create Profesional Yearly plan
   - Create Empresa Monthly plan
   - Create Empresa Yearly plan
   - Configure auto-debit settings

2. **Create subscription preference builder**
   - Build MP preference with all payment methods enabled
   - Configure installment options (cuotas)
   - Set up back_urls for success/failure/pending
   - Include external_reference with org_id and tier
   - Configure statement_descriptor

3. **Create checkout API endpoint**
   - `POST /api/subscription/checkout`
   - Accepts: tier, billing_cycle (monthly/yearly)
   - Validates organization exists
   - Creates MP preference
   - Returns checkout URL

4. **Configure all payment methods**
   ```javascript
   payment_methods: {
     excluded_payment_types: [],  // Allow all
     excluded_payment_methods: [],  // Allow all
     installments: 12,  // Max 12 cuotas
     default_installments: 1
   }
   ```

5. **Create payment method display component**
   - Show all accepted payment methods with icons
   - Visa, Mastercard, Amex, Naranja, Cabal
   - Maestro, Visa Débito
   - Rapipago, Pago Fácil
   - Bank transfer (CBU/CVU)
   - MercadoPago wallet

6. **Implement yearly discount logic**
   - Monthly price × 10 = Yearly price (2 months free)
   - Display savings on checkout page
   - Show "Ahorrás $XX,XXX al año" message

### Tests

- [ ] Checkout creates valid MP preference
- [ ] All payment methods appear in MP checkout
- [ ] Cuotas options work for credit cards
- [ ] Cash payment (Rapipago/Pago Fácil) generates voucher
- [ ] Bank transfer generates payment code
- [ ] Yearly discount calculated correctly
- [ ] External reference includes correct org/tier info

---

## Phase 4: Payment Webhook Processing

### Tasks

1. **Create subscription webhook endpoint**
   - `POST /api/webhooks/mercadopago/subscription`
   - Validate webhook signature (HMAC-SHA256)
   - Handle idempotency (prevent duplicate processing)

2. **Handle `payment.created` event**
   - Log payment attempt
   - Update payment record to 'processing'

3. **Handle `payment.approved` event**
   - Update subscription status to 'active'
   - Set current_period_start and current_period_end
   - Update organization tier
   - Send confirmation email
   - Grant access immediately

4. **Handle `payment.rejected` / `payment.failed` event**
   - Update payment status to 'failed'
   - Log failure reason
   - Increment retry count
   - Send failure notification email
   - If 3 failures: escalate to support

5. **Handle `payment.pending` event**
   - For cash payments (Rapipago/Pago Fácil)
   - Update status to 'pending'
   - Send payment instructions email
   - Show pending status in dashboard

6. **Handle `subscription.cancelled` event**
   - Update subscription status
   - Set cancelled_at timestamp
   - Downgrade tier at period end (not immediately)

7. **Handle `subscription.paused` event**
   - Update status to 'paused'
   - Send notification email

8. **Create webhook retry logic**
   - Queue failed webhooks for retry
   - Exponential backoff (1min, 5min, 30min, 2hr, 24hr)
   - Alert after all retries exhausted

### Tests

- [ ] Valid webhook signature accepted
- [ ] Invalid webhook signature rejected (401)
- [ ] Duplicate webhook ignored (idempotency)
- [ ] Approved payment activates subscription
- [ ] Failed payment increments retry count
- [ ] Pending payment shows correct status
- [ ] Cancellation schedules downgrade
- [ ] Webhook retry queue works

---

## Phase 5: Access Control & Enforcement

### Tasks

1. **Create access control middleware**
   - Check subscription status on every protected route
   - Allow: active, trialing
   - Block: expired, cancelled (after period), past_due (after grace)

2. **Implement grace period for failed payments**
   - 7 days after payment failure
   - Show warning banner during grace period
   - Send daily reminder emails
   - Block access after grace period ends

3. **Create subscription status banner component**
   - "Tu prueba gratuita termina en X días"
   - "Tu pago está pendiente"
   - "Tu suscripción venció - Actualiza tu plan"
   - "Plan renovado hasta [fecha]"

4. **Create upgrade wall component**
   - Shown when access is blocked
   - Clear explanation of why access is blocked
   - Plan options with pricing
   - Direct link to checkout

5. **Update all protected API routes**
   - Add subscription check
   - Return 402 Payment Required if blocked
   - Include upgrade URL in response

6. **Create tier feature gates**
   - Check tier limits before actions
   - Show upgrade prompt when limit reached
   - Track usage per billing period

### Tests

- [ ] Active subscription grants full access
- [ ] Expired trial blocks access
- [ ] Grace period allows access for 7 days
- [ ] Warning banner shows during grace period
- [ ] API returns 402 when access blocked
- [ ] Tier limits enforced correctly
- [ ] Upgrade prompt shows when limit reached

---

## Phase 6: Billing Page UI (Web App)

### Tasks

1. **Redesign /dashboard/settings/billing page**
   - Current plan display with status
   - Next billing date
   - Payment method on file
   - Usage statistics
   - Plan comparison table

2. **Create plan selection component**
   - Monthly/Yearly toggle with savings display
   - All 4 tiers with features
   - Highlight current plan
   - "Popular" badge on Profesional
   - Clear CTA buttons

3. **Create checkout flow pages**
   - `/dashboard/settings/billing/checkout` - Plan confirmation
   - `/dashboard/settings/billing/success` - Payment success
   - `/dashboard/settings/billing/pending` - Cash payment pending
   - `/dashboard/settings/billing/failure` - Payment failed

4. **Create payment history table**
   - All past payments
   - Status badges (completed, failed, refunded)
   - Download invoice button
   - Retry button for failed payments

5. **Create payment method management**
   - Show current payment method (last 4 digits)
   - Link to update in MercadoPago
   - Add new payment method option

6. **Implement cancellation flow**
   - Cancel button with confirmation modal
   - Show what happens after cancellation
   - Ley 24.240 refund eligibility check
   - Process refund if eligible

7. **Add yearly upgrade prompt**
   - For monthly subscribers
   - Show savings: "Ahorrá $XX,XXX por año"
   - One-click upgrade to yearly

### Tests

- [ ] Current plan displays correctly
- [ ] Monthly/Yearly toggle updates prices
- [ ] Checkout redirects to MercadoPago
- [ ] Success page shows confirmation
- [ ] Pending page shows payment instructions
- [ ] Payment history shows all payments
- [ ] Cancellation flow works
- [ ] Ley 24.240 refund calculated correctly

---

## Phase 7: Admin App Integration

### Tasks

1. **Create admin API endpoints**
   - `GET /api/admin/subscriptions` - All subscriptions
   - `GET /api/admin/subscriptions/:id` - Single subscription
   - `GET /api/admin/payments` - All subscription payments
   - `GET /api/admin/payments/failed` - Failed payments only
   - `GET /api/admin/payments/pending` - Pending cash payments
   - `GET /api/admin/metrics/revenue` - Revenue metrics
   - `POST /api/admin/subscriptions/:id/extend` - Manual extension

2. **Update admin dashboard (apps/admin)**
   - Replace mock data with real API calls
   - Real-time MRR calculation
   - Real failed payments list
   - Real upcoming renewals

3. **Create admin subscriptions page**
   - Table of all organizations with subscription status
   - Filter by tier, status, billing cycle
   - Search by organization name/CUIT
   - Bulk actions (extend trial, send reminder)

4. **Create admin payments page (update existing)**
   - Real payment data (not mock)
   - Filter by status, date range, amount
   - Payment details modal
   - Retry failed payment button
   - Refund button
   - Export to CSV

5. **Create admin revenue analytics**
   - MRR trend chart (real data)
   - Revenue by tier breakdown
   - Churn rate calculation
   - New vs churned comparison
   - Revenue forecast

6. **Create admin alerts system**
   - Alert when payment fails 3+ times
   - Alert when high-value customer cancels
   - Alert when unusual refund rate
   - Slack/Discord webhook integration

7. **Add real-time updates**
   - New payment notification
   - Failed payment alert
   - Subscription status changes
   - Use Supabase Realtime or SSE

### Tests

- [ ] Admin can view all subscriptions
- [ ] Admin can filter/search subscriptions
- [ ] Failed payments list is accurate
- [ ] Revenue metrics calculate correctly
- [ ] Admin can manually extend trial
- [ ] Admin can process refund
- [ ] Alerts trigger correctly
- [ ] Real-time updates work

---

## Phase 8: Notifications & Communications

### Tasks

1. **Create email templates**
   - Welcome + trial started
   - Trial ending soon (7, 3, 1 day)
   - Trial expired - upgrade prompt
   - Payment successful
   - Payment failed - retry prompt
   - Payment pending (cash)
   - Subscription renewed
   - Subscription cancelled
   - Grace period warning
   - Access suspended

2. **Create WhatsApp templates (optional)**
   - Payment reminder
   - Trial expiring
   - Payment confirmed
   - For customers who opted in

3. **Create in-app notifications**
   - Real-time toast notifications
   - Notification center with history
   - Mark as read functionality

4. **Create cron jobs for scheduled notifications**
   - Trial expiration reminders (daily check)
   - Payment due reminders (3 days before)
   - Failed payment reminders (daily)
   - Weekly summary for admin

### Tests

- [ ] All email templates render correctly
- [ ] Emails sent at correct times
- [ ] Email contains correct organization info
- [ ] In-app notifications appear in real-time
- [ ] Notification history preserved
- [ ] Cron jobs run on schedule

---

## Phase 9: Testing & QA

### Tasks

1. **Unit tests**
   - Subscription manager service
   - Payment processing service
   - Access control middleware
   - Tier limit enforcement
   - Price calculations
   - Trial date calculations

2. **Integration tests**
   - Full signup → trial → upgrade flow
   - Webhook processing
   - Payment status transitions
   - Admin API endpoints

3. **E2E tests**
   - User signs up and gets trial
   - User upgrades during trial
   - User's trial expires and is blocked
   - User pays with credit card
   - User pays with Rapipago (cash)
   - User cancels subscription
   - User gets refund (Ley 24.240)
   - Admin views failed payments
   - Admin extends trial manually

4. **MercadoPago sandbox testing**
   - Test all payment methods
   - Test webhook events
   - Test failure scenarios
   - Test installments (cuotas)
   - Test refund flow

5. **Load testing**
   - Webhook throughput
   - Concurrent checkout creation
   - Access control performance

6. **Security testing**
   - Webhook signature validation
   - Access token security
   - Admin endpoint authorization
   - SQL injection prevention
   - Rate limiting

### Test Cases

```
[ ] TEST_SIGNUP_01: New user gets 14-day trial
[ ] TEST_SIGNUP_02: Trial end date is exactly 14 days in Buenos Aires timezone
[ ] TEST_TRIAL_01: User has full access during trial
[ ] TEST_TRIAL_02: User sees trial expiration warning at 7 days
[ ] TEST_TRIAL_03: User sees trial expiration warning at 3 days
[ ] TEST_TRIAL_04: User sees trial expiration warning at 1 day
[ ] TEST_TRIAL_05: User is blocked after trial expires
[ ] TEST_UPGRADE_01: User can upgrade during trial
[ ] TEST_UPGRADE_02: User can upgrade after trial expires
[ ] TEST_UPGRADE_03: Monthly/Yearly toggle works
[ ] TEST_UPGRADE_04: Yearly shows 17% discount
[ ] TEST_PAY_01: Credit card payment works
[ ] TEST_PAY_02: Debit card payment works
[ ] TEST_PAY_03: Cuotas (installments) work
[ ] TEST_PAY_04: Rapipago generates voucher
[ ] TEST_PAY_05: Pago Fácil generates voucher
[ ] TEST_PAY_06: Bank transfer generates code
[ ] TEST_PAY_07: MP wallet payment works
[ ] TEST_PAY_08: Pending cash payment shows instructions
[ ] TEST_PAY_09: Failed payment shows error
[ ] TEST_PAY_10: Failed payment allows retry
[ ] TEST_WEBHOOK_01: Valid signature accepted
[ ] TEST_WEBHOOK_02: Invalid signature rejected
[ ] TEST_WEBHOOK_03: Duplicate webhook is idempotent
[ ] TEST_WEBHOOK_04: Payment approved activates subscription
[ ] TEST_WEBHOOK_05: Payment failed updates status
[ ] TEST_ACCESS_01: Active subscription grants access
[ ] TEST_ACCESS_02: Expired subscription blocks access
[ ] TEST_ACCESS_03: Grace period allows access
[ ] TEST_ACCESS_04: Past grace period blocks access
[ ] TEST_CANCEL_01: Cancellation sets end date
[ ] TEST_CANCEL_02: Access continues until period end
[ ] TEST_CANCEL_03: Ley 24.240 refund within 10 days
[ ] TEST_CANCEL_04: No refund after 10 days
[ ] TEST_ADMIN_01: Admin sees all subscriptions
[ ] TEST_ADMIN_02: Admin sees real revenue
[ ] TEST_ADMIN_03: Admin can extend trial
[ ] TEST_ADMIN_04: Admin can process refund
[ ] TEST_ADMIN_05: Failed payment alerts work
```

---

## Phase 10: Launch & Monitoring

### Tasks

1. **Pre-launch checklist**
   - [ ] All payment methods tested in sandbox
   - [ ] Webhook endpoint deployed and verified
   - [ ] Email templates reviewed and approved
   - [ ] Admin dashboard working with real data
   - [ ] Access control verified
   - [ ] Legal text reviewed (terms, privacy, Ley 24.240)

2. **Switch to production MercadoPago**
   - Update credentials in environment
   - Verify webhook URL in MP dashboard
   - Test with small real payment
   - Enable all payment methods

3. **Set up monitoring**
   - Payment success rate dashboard
   - Failed payment alerts
   - Revenue tracking
   - Churn monitoring
   - Error rate tracking

4. **Set up Sentry alerts**
   - Webhook processing errors
   - Payment failures
   - Access control errors
   - Database errors

5. **Create runbooks**
   - How to process manual refund
   - How to extend trial manually
   - How to investigate failed payment
   - How to handle MP outage

6. **Launch plan**
   - Soft launch to 10 test organizations
   - Monitor for 1 week
   - Fix any issues
   - Full launch
   - Announce via email/WhatsApp

### Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Trial → Paid Conversion | >20% | <10% |
| Payment Success Rate | >95% | <90% |
| Monthly Churn Rate | <5% | >10% |
| Average Revenue Per User | $50+ | <$30 |
| Cash Payment Completion | >70% | <50% |
| Webhook Processing Time | <2s | >10s |

---

## Timeline Summary

| Phase | Description | Estimated Effort |
|-------|-------------|-----------------|
| Phase 1 | Database Schema | 1 day |
| Phase 2 | Trial System | 1-2 days |
| Phase 3 | MP Integration | 2-3 days |
| Phase 4 | Webhook Processing | 2 days |
| Phase 5 | Access Control | 1-2 days |
| Phase 6 | Billing UI | 2-3 days |
| Phase 7 | Admin Integration | 2-3 days |
| Phase 8 | Notifications | 1-2 days |
| Phase 9 | Testing | 3-4 days |
| Phase 10 | Launch | 1-2 days |
| **Total** | | **~17-24 days** |

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| MercadoPago account | Required | Production credentials needed |
| MercadoPago Plans | To Create | 6 plans (3 tiers × 2 cycles) |
| Email service | Required | For transactional emails |
| Supabase | Existing | Already configured |
| Sentry | Existing | Already configured |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| MP webhook delays | Users see stale status | Polling fallback |
| Cash payment abandonment | Lost revenue | Reminder emails |
| Card rejection rate high | Failed conversions | Multiple retry attempts |
| Chargebacks | Revenue loss | Fraud detection, clear billing descriptor |
| Trial abuse (new accounts) | Lost revenue | CUIT uniqueness check, device fingerprint |

---

## Files to Create/Modify

### New Files
- `apps/web/prisma/migrations/YYYYMMDD_add_subscription_tables/migration.sql`
- `apps/web/lib/services/trial-manager.ts`
- `apps/web/lib/services/subscription-checkout.ts`
- `apps/web/app/api/subscription/checkout/route.ts`
- `apps/web/app/api/webhooks/mercadopago/subscription/route.ts`
- `apps/web/app/dashboard/settings/billing/checkout/page.tsx`
- `apps/web/app/dashboard/settings/billing/success/page.tsx`
- `apps/web/app/dashboard/settings/billing/pending/page.tsx`
- `apps/web/components/billing/PlanSelector.tsx`
- `apps/web/components/billing/PaymentMethods.tsx`
- `apps/web/components/billing/TrialBanner.tsx`
- `apps/web/components/billing/UpgradeWall.tsx`
- `apps/web/middleware/subscription-check.ts`
- `apps/admin/app/dashboard/subscriptions/page.tsx`
- `apps/admin/lib/api/subscriptions.ts`

### Modified Files
- `apps/web/app/api/auth/register/verify/route.ts` - Add trial creation
- `apps/web/lib/services/subscription-manager.ts` - Complete implementation
- `apps/web/app/dashboard/settings/billing/page.tsx` - Complete redesign
- `apps/web/middleware.ts` - Add subscription check
- `apps/admin/app/dashboard/payments/page.tsx` - Use real data
- `apps/admin/app/dashboard/page.tsx` - Use real data
- `apps/admin/lib/mock-data.ts` - Remove (replace with real API)

---

## Environment Variables to Add

```bash
# MercadoPago Production
MP_ACCESS_TOKEN="your-production-access-token"
MP_PUBLIC_KEY="your-production-public-key"

# MercadoPago Plan IDs (created in MP dashboard)
MP_PLAN_INICIAL_MONTHLY="plan_id_here"
MP_PLAN_INICIAL_YEARLY="plan_id_here"
MP_PLAN_PROFESIONAL_MONTHLY="plan_id_here"
MP_PLAN_PROFESIONAL_YEARLY="plan_id_here"
MP_PLAN_EMPRESA_MONTHLY="plan_id_here"
MP_PLAN_EMPRESA_YEARLY="plan_id_here"

# Subscription Settings
TRIAL_DAYS=14
GRACE_PERIOD_DAYS=7
```

---

## Approval

- [ ] Technical review completed
- [ ] Business review completed
- [ ] Legal review completed (Ley 24.240 compliance)
- [ ] Ready to start implementation

---

*Document Version: 1.0*
*Created: 2025-12-20*
*Author: CampoTech Development Team*
