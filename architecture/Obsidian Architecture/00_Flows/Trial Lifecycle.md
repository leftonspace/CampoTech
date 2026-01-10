---
tags:
  - flow
  - monetization
  - critical
status: 🟡 Implemented (Partial)
type: Lifecycle Logic
---

# ⏳ Trial & Expiration Lifecycle

> [!INFO] **Current Logic**
> The system operates on a "Safe Fail" model. We never charge automatically because we don't collect payment info upfront.

## 🔄 The Timeline

### Day 0: Signup
- **Action:** User creates account.
- **System:** `TrialManager` grants **21 Days** of `INICIAL` tier.
- **Cost:** $0.

### Day 1-20: The Trial
- **Status:** `trialing`.
- **Features:** "God Mode" (All features active) but with **API Throttling** (Maps, AI).
- **Notifications:**
    - **Day 14:** Email Warning.
    - **Day 18:** Dashboard Banner (Yellow).
    - **Day 20:** Dashboard Banner (Red) + SMS?
    - **Always Visible:** "Subscribe Now" button (Top Right).

### Day 21: Expiration (Strict Lock)
- **Event:** `expireTrial()` job runs.
- **Action:**
    1. Status set to `expired`.
    2. **BLOCK ACCESS:** User cannot access Dashboard. Redirects to `/billing/expired`.
- **Impact:**
    - Data preserved for X days (e.g., 90 days).
    - **Payment Required** to unlock.

### Feature Constraints (During Trial)
> All features are active, but expensive APIs are throttled.
- **Maps API:** Limited to X requests/day.
- **AI WhatsApp:** Lowered token limit or message count.

### Day 21+: Conversion (Upgrade)
- **Action:** User goes to Billing and pays.
- **System:** `convertTrialToActive()` is called.
- **Status:** becomes `active`.

---
## 🔗 Connected Files
- Source of Truth: `apps/web/lib/services/trial-manager.ts`
- Pricing Matrix: `apps/web/lib/features/subscription-matrix.ts`
