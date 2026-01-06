---
tags:
  - flow
  - onboarding
  - growth
status: 🟡 Needs Polish
type: User Flow
---

# 📝 Signup & Onboarding Flow

> [!TIP] **Objective**
> Convert a visitor into a **Categorized Organization** (e.g., Plumber, Gasista) with a simplified "Start Free" trial.

## 📸 Entry Point
![[signup-screen.png]]

### Step 1: Initial Data
- **CUIT:** Validated against AFIP algorithms (Mod 11).
- **Nombre del Negocio:** How they will appear to their customers.
- **Phone:** Used for OTP verification (same as Login).

### Step 2: Verification
- User receives OTP to confirm they own the phone number.

### Step 3: Onboarding Context
*(Visual pending - requires server fix)*
- **Role Selection:** "Soy Plomero", "Soy Electricista", etc.
- **Team Size:** "Solo yo", "1-5", "5+".
- **Subscription:** Auto-enrollment in **Trial** (Phase 2.5 Logic).

---

## 🛠️ Technical Context
- **Form:** `apps/web/app/(auth)/signup/page.tsx`
- **Onboarding Logic:** `apps/web/app/onboarding/page.tsx`
- **Trial Trigger:** `lib/services/trial-manager.ts` starts the 14-day counter.

## 🔗 Connections
- **Previous:** [[Landing Page]] (Hero CTA)
- **Next:** [[Dashboard Home]]
