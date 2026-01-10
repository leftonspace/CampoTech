---
tags:
  - flow
  - onboarding
  - verification
status: 🟡 In Progress
type: User Flow
path: apps/web/app/dashboard/verificacion/page.tsx
---

# 🔐 Verification Flow

> [!WARNING] **Critical for Marketplace Access**
> Users must complete identity verification to receive jobs from the CampoTech marketplace. This protects both customers and service providers.

---

## 📸 Preview
![[verification-steps.png]]

---

## 🔄 Verification Steps

### Step-by-Step Flow

```
1. Crear cuenta ✓ (Signup)
        ↓
2. Verificar email ✓ (Click link)
        ↓
3. Verificar CUIT → AFIP validation
        ↓
4. Subir DNI (frente) → Document upload
        ↓
5. Subir DNI (dorso) → Document upload
        ↓
6. Selfie con DNI → Identity match
        ↓
7. Primer trabajo ○ (Optional)
        ↓
   ✅ Fully Verified
```

---

## 📋 Step Details

### Step 1: Crear Cuenta
- **Trigger:** [[Signup Flow]] completion
- **Auto-complete:** Yes
- **Data Collected:** Name, phone, email, business name

### Step 2: Verificar Email
- **Trigger:** Click link in confirmation email
- **Auto-complete:** Yes
- **Expiry:** 7 days
- **Resend:** Available after 60 seconds

### Step 3: Verificar CUIT
- **Input:** CUIT number (XX-XXXXXXXX-X)
- **Validation:**
  - Mod 11 algorithm check
  - AFIP web service call (if enabled)
  - Cross-check with business name
- **Errors:**
  - Invalid format
  - Already registered
  - AFIP service unavailable

### Step 4: Subir DNI (Frente)
- **Input:** Photo/scan of ID front
- **Requirements:**
  - Clear, readable image
  - All corners visible
  - JPG/PNG, max 10MB
- **AI Check:** OCR validation (optional)

### Step 5: Subir DNI (Dorso)
- **Input:** Photo/scan of ID back
- **Requirements:** Same as front
- **Cross-check:** Name matches CUIT registration

### Step 6: Selfie con DNI
- **Input:** Live photo or upload
- **Requirements:**
  - Face clearly visible
  - DNI visible in frame
  - Good lighting
- **AI Check:** Face match with DNI (optional)

### Step 7: Primer Trabajo (Optional)
- **Purpose:** Encourage platform usage
- **Trigger:** Complete any work order
- **Skip:** Does not block access

---

## 🔄 Verification States

| State | Description | Access Level |
|:---|:---|:---|
| `PENDING` | Not started | Limited |
| `IN_PROGRESS` | Some steps done | Limited |
| `UNDER_REVIEW` | Documents submitted | Limited |
| `APPROVED` | Fully verified | Full access |
| `REJECTED` | Failed verification | Blocked |
| `EXPIRED` | Needs re-verification | Blocked |

---

## ⚠️ Feature Gating

### Until Verified:
| Feature | Available? |
|:---|:---:|
| Create jobs | ✓ |
| Manage customers | ✓ |
| Issue invoices | ✓ (Non-fiscal) |
| AFIP invoicing | ✗ |
| Marketplace jobs | ✗ |
| Full analytics | ✗ |

---

## 📱 Document Upload UI

### Upload Component
```tsx
<DocumentUpload
  type="dni_front" | "dni_back" | "selfie"
  onUpload={(file) => handleUpload(file)}
  onCapture={() => openCamera()}
  status="pending" | "uploaded" | "approved" | "rejected"
  rejectionReason="Image blurry"
/>
```

### Actions
- Upload from device
- Take photo with camera
- View uploaded image
- Re-upload if rejected

---

## 🔐 Access Control

- All users must verify themselves
- OWNER can view team member verification status
- ADMIN can prompt team members to verify
- Documents only viewable by account owner + system

---

## 🛠️ Technical Context

- **Verification Page:** `apps/web/app/dashboard/verificacion/page.tsx`
- **My Verification:** `apps/web/app/dashboard/mi-verificacion/page.tsx`
- **API Endpoints:**
  - `GET /api/organization/verification-status` - Current status
  - `POST /api/organization/verify-cuit` - CUIT validation
  - `POST /api/organization/documents` - Upload document
  - `GET /api/organization/documents/:type` - Get document
  - `POST /api/organization/selfie` - Upload selfie

### Storage
- Documents stored in secure bucket
- Encrypted at rest
- Access logged for audit

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Triggered By:**
  - [[Onboarding Checklist]]
  - [[Access Banner]]
- **Related:**
  - [[Signup Flow]] (Initial account)
  - [[AFIP Settings]] (CUIT config)
  - [[Marketplace Page]] (Requires verification)

---

## 📝 Notes

- [ ] TODO: Implement AI document verification
- [ ] TODO: Face matching for selfie
- [ ] TODO: Re-verification after 2 years
- [ ] TODO: Admin manual approval flow
- [ ] CRITICAL: GDPR-compliant document storage
- [ ] SECURITY: Rate limiting on upload attempts
