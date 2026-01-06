---
tags:
  - flow
  - monetization
  - missing
status: 🔴 Blocked / Missing
type: User Flow
---

# 💳 Subscription & Payment Flow

> [!WARNING] **Current Status: NOT IMPLEMENTED**
> Currently, all signups default to a **21-Day Free Trial** on the `INICIAL` tier. There is no UI to input credit card details or upgrade to `PROFESSIONAL` or `EMPRESA`.

## 🛑 The Gap
1.  **Landing Page:** User clicks "$55 Profesional".
2.  **Signup:** User creates account.
3.  **Dashboard:** User is placed on "Free Trial (Inicial)".
4.  **Issue:** User *cannot* pay even if they want to.

## 🛠️ Required Implementation
We need to build the `Upgrade / Checkout` flow inside the Dashboard.

### 1. New Page: `/dashboard/billing`
- **Plan Selector:** Card view of current plan vs upgrades.
- **Payment Method:** Form for Card / MercadoPago.
- **Invoice History:** List of past payments.

### 2. Logic (MercadoPago Integration)
- **Frontend:** SDK to tokenize card.
- **Backend:** `POST /api/billing/subscribe`
    - Creates Customer in MercadoPago.
    - Creates Subscription (Preapproval).
    - Calls `TrialManager.convertTrialToActive()`.

## 🔗 Connections
- **Linked to:** [[Dashboard Home]] (Settings > Billing)
- **Linked from:** [[Landing Page]] (Pricing Buttons - *Future state: Pass `?plan=profesional` param*)
