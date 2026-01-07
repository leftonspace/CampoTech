---
tags:
  - flow
  - public
  - growth
status: 🟢 Functional
type: User Flow
path: apps/web/app/(public)/claim/page.tsx
---

# 🔗 Profile Claim Flow

> [!SUCCESS] **Goal**
> Allow professionals who were imported via scrapers to "claim" their profile by verifying their identity through OTP, converting them into registered CampoTech users.

---

## 📸 Preview
![[profile-claim-preview.png]]

---

## 🎯 Purpose

When CampoTech scrapes professional registries (ERSEP, CACAAV, etc.), the data is stored as "Unclaimed Profiles." This flow allows professionals to:

1. **Find** their profile in our database
2. **Verify** their identity via SMS OTP
3. **Link** their profile to a new or existing account
4. **Access** CampoTech with pre-filled professional data

---

## 📍 Navigation Path

```
🌐 Public → 🔗 /claim → 🔍 Search → 📋 Profile → ✅ Verify → 🎉 Success
```

---

## 🔄 Flow Steps

### Step 1: Landing Page (`/claim`)

**URL:** `https://campotech.ar/claim`

| Element | Description |
|:---|:---|
| Hero Title | "Tu perfil profesional te está esperando" |
| Subtitle | "Más de 60,000 profesionales matriculados ya tienen su perfil listo" |
| Search Box | Search by name or matrícula |
| CTA Button | "Buscar mi perfil" |
| Benefits List | Visibility, trust, client acquisition |

**User Actions:**
1. Enter name or matrícula
2. Click "Buscar mi perfil"
3. System searches `UnclaimedProfile` table

---

### Step 2: Search Results

| Element | Description |
|:---|:---|
| Results List | Matching profiles with name, profession, province |
| No Results | "No encontramos tu perfil" message |
| Match Card | Profile preview with "Reclamar" button |

**User Actions:**
1. Review matching profiles
2. Click "Reclamar" on their profile
3. Navigate to `/claim/[profile-id]`

---

### Step 3: Profile Preview (`/claim/[id]`)

| Element | Description |
|:---|:---|
| Profile Card | Full name, profession, matrícula, location |
| Source Badge | Where the data came from (ERSEP, CACAAV, etc.) |
| Verification Form | Phone number input |
| Submit Button | "Verificar y reclamar" |

**User Actions:**
1. Review profile data
2. Enter their phone number
3. Submit to receive OTP

---

### Step 4: OTP Verification

| Element | Description |
|:---|:---|
| OTP Input | 6-digit code input |
| Timer | Countdown for code expiry |
| Resend Link | Request new code |
| Error Message | If code is incorrect |

**User Actions:**
1. Check SMS for 6-digit code
2. Enter code in input fields
3. Submit for verification

---

### Step 5: Success

| Element | Description |
|:---|:---|
| Success Icon | Green checkmark |
| Message | "¡Tu perfil ha sido reclamado!" |
| Next Steps | Create password or login |
| CTA Button | "Ir al Dashboard" |

**Result:**
- Profile marked as `claimed`
- `claimedAt` timestamp set
- User linked to profile
- Redirect to dashboard with pre-filled data

---

## 🖱️ All Clickable Elements

| Element | Action | Result |
|:---|:---|:---|
| Search input | `Type` | Filter profiles |
| "Buscar mi perfil" | `Click` | Perform search |
| Profile card | `Click` | Navigate to claim page |
| "Reclamar" button | `Click` | Navigate to verification |
| Phone input | `Type` | Enter phone number |
| "Verificar" button | `Click` | Request OTP |
| OTP inputs | `Type` | Enter verification code |
| "Enviar código" | `Click` | Verify OTP |
| "Reenviar código" | `Click` | Request new OTP |
| "Ir al Dashboard" | `Click` | Navigate to dashboard |

---

## 🔐 Security Measures

| Risk | Mitigation |
|:---|:---|
| Profile hijacking | OTP verification required |
| Spam requests | Rate limiting on OTP sends |
| Brute force | Max 3 OTP attempts |
| Bot abuse | CAPTCHA on search (future) |

---

## 📊 API Endpoints

### Search Profiles

```http
GET /api/claim-profile/search?q={query}&source={source}
```

**Response:**
```json
{
  "success": true,
  "profiles": [
    {
      "id": "cuid-123",
      "fullName": "Juan Carlos Rodríguez",
      "profession": "Electricista",
      "matricula": "ERSEP-12345",
      "province": "Córdoba",
      "source": "ERSEP"
    }
  ]
}
```

---

### Request OTP

```http
POST /api/claim-profile/request
```

**Body:**
```json
{
  "profileId": "cuid-123",
  "phone": "+5491112345678"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Código enviado",
  "devMode": true  // Only in development
}
```

---

### Verify OTP

```http
POST /api/claim-profile/verify
```

**Body:**
```json
{
  "profileId": "cuid-123",
  "phone": "+5491112345678",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "claimed": true,
  "userId": "user-456"
}
```

---

## 🛠️ Technical Implementation

### File Structure

```
apps/web/app/(public)/claim/
├── page.tsx              # Landing page with search
└── [id]/
    └── page.tsx          # Profile claim with OTP verification
```

### Service Layer

```typescript
// apps/web/lib/services/unclaimed-profile.service.ts

class UnclaimedProfileService {
  // Search profiles
  async search(query: string, source?: string): Promise<ProfileResult[]>
  
  // Request OTP for claiming
  async requestClaim(profileId: string, phone: string): Promise<OTPResult>
  
  // Verify OTP and link profile
  async verifyClaim(profileId: string, phone: string, otp: string): Promise<ClaimResult>
  
  // Get profile stats for dashboard
  async getStats(): Promise<ProfileStats>
}
```

---

## 🔗 Connections

- **Parent:** [[Growth Engine]] (admin side)
- **Related Pages:**
  - [[Login Flow]] (if user has account)
  - [[Signup Flow]] (if new user)
- **API Routes:**
  - `/api/claim-profile/search`
  - `/api/claim-profile/request`
  - `/api/claim-profile/verify`

---

## 📝 Notes & TODOs

- [x] Search page implemented
- [x] Profile preview page implemented
- [x] OTP request flow implemented
- [ ] TODO: Actual SMS sending (currently simulated)
- [ ] TODO: CAPTCHA for search
- [ ] TODO: Email verification option
- [ ] TODO: Analytics tracking

---

*Every claimed profile is a potential premium customer.*
