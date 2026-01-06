---
tags:
  - flow
  - auth
  - critical
status: 🟢 Verified
type: User Flow
---

# 🔐 Login Flow

> [!INFO] **Mechanism**
> We use **Passwordless Auth** (OTP via WhatsApp/SMS). There are no passwords to forget.

## 📸 visual Step-by-Step

### Step 1: Identification
![[login-screen.png]]
- **Input:** Phone Number (International Format).
- **Validation:** Must be a valid mobile number.
- **User Action:** Click "Continuar".

### Step 2: Verification (OTP)
![[login-otp.png]]
- **Process:** System sends a 6-digit code via WhatsApp provider.
- **Input:** 6-digit numeric code.
- **Security:** Code expires in 5 minutes. Rate limited.
- **User Action:** Click "Ingresar".

---

## 🛠️ Technical Implementation
- **Frontend:** `apps/web/app/(auth)/login/page.tsx`
- **Backend:** `apps/web/app/api/auth/login/route.ts`
- **Auth Library:** Custom JWT implementation in `lib/auth.ts`.

## 🔗 Connections
- **Previous:** [[Landing Page]] (Header Link)
- **Next:** [[Dashboard Home]] (Redirect upon success)
- **Alternative:** [[Signup Flow]] (If user is not found)
