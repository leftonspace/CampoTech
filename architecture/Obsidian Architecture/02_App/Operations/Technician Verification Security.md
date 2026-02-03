---
tags:
  - page
  - app
  - security
  - verification
  - mobile
  - trust
status: 🟢 Functional
type: Feature
path: apps/mobile/components/badge/, apps/web/lib/services/confirmation-code.service.ts
---

# 🔐 Technician Verification & Entry Security

> [!SUCCESS] **Purpose**
> Dual-layer security system that verifies technician identity for customers. Combines a QR-based Digital Badge (optional, for extra trust) with a MANDATORY Rappi/Uber-style 4-digit confirmation code for direct customer verification.

---

## System Summary

| System | Status | Target User | Use Case |
|:---|:---:|:---|:---|
| **4-Digit Confirmation Code** | 🔒 MANDATORY | End customer directly | All jobs - verifies identity before starting work |
| **QR Digital Badge** | ⭐ OPTIONAL | Anyone (guards, customers) | Extra professionalism & trust |

### Key Design Decisions

1. **Confirmation codes are MANDATORY** - No organization toggle, no opt-out. This is a platform-wide security standard.
2. **Digital badge is OPTIONAL** - A daily morning reminder builds the habit without being pushy
3. **Both features are marketing differentiators** - Promote on landing page

---

## 🔢 System 1: 4-Digit Confirmation Code (MANDATORY)

### Overview

When a technician starts navigating to a job, the customer receives a 4-digit code via WhatsApp. The technician MUST enter this code to confirm arrival - there is no way to skip this.

> [!IMPORTANT] **Non-Negotiable Security**
> This feature cannot be disabled by organizations. It's a platform-wide security standard that protects both customers and technicians.

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Technician clicks "En Camino" (Start Navigation)        │
│                                                              │
│     → System generates random 4-digit code: 4728            │
│     → WhatsApp message sent to customer automatically       │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Customer receives WhatsApp                              │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Hola María! 👋                                          ││
│  │                                                         ││
│  │ Juan de Tecno Servicio está en camino para             ││
│  │ lunes 3 de febrero a las 14:00.                        ││
│  │                                                         ││
│  │ Tu código de confirmación es:                          ││
│  │ 🔐 *4728*                                               ││
│  │                                                         ││
│  │ Pedíselo al técnico cuando llegue para confirmar       ││
│  │ su identidad.                                          ││
│  │                                                         ││
│  │ Trabajo #JOB-2026-0001234                              ││
│  └─────────────────────────────────────────────────────────┘│
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Technician arrives, asks customer for code              │
│                                                              │
│  "¿Cuál es el código que te llegó?"                         │
│                                                              │
│  Customer: "4728"                                           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Technician enters code in app                           │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  🛡️ Código de Confirmación                              ││
│  │                                                         ││
│  │  Pedí el código a María para confirmar tu llegada       ││
│  │                                                         ││
│  │  ✓ Código enviado por WhatsApp                          ││
│  │                                                         ││
│  │    ┌───┐ ┌───┐ ┌───┐ ┌───┐                             ││
│  │    │ 4 │ │ 7 │ │ 2 │ │ 8 │                             ││
│  │    └───┘ └───┘ └───┘ └───┘                             ││
│  │                                                         ││
│  │        [ Verificar Código ]                            ││
│  └─────────────────────────────────────────────────────────┘│
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼ (Code verified)
┌─────────────────────────────────────────────────────────────┐
│  5. Customer receives confirmation WhatsApp                 │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ✅ *Confirmado!*                                        ││
│  │                                                         ││
│  │ El técnico Juan ha llegado y comenzó el trabajo        ││
│  │ #JOB-2026-0001234.                                     ││
│  │                                                         ││
│  │ Si tenés alguna consulta, contactá a Tecno Servicio    ││
│  │ al +54 11 1234-5678.                                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  → Job can now be marked as "Working"                       │
└─────────────────────────────────────────────────────────────┘
```

### Code Entry Behavior

| Scenario | Behavior |
|:---|:---|
| **Correct code** | ✅ Verified, can proceed to "Working" |
| **Wrong code** | ❌ "Código incorrecto. 2 intentos restantes." |
| **3 failed attempts** | ⛔ "Máximo de intentos alcanzado. Contactá al cliente." |
| **Already verified** | ✅ Shows success state immediately |
| **No customer phone** | ⚠️ Code not sent but logged - technician can skip |

### Technical Details

| Component | File |
|:---|:---|
| Code Service | `apps/web/lib/services/confirmation-code.service.ts` |
| API Routes | `apps/web/app/api/jobs/[id]/confirmation-code/route.ts` |
| Mobile Component | `apps/mobile/components/jobs/ConfirmationCodeEntry.tsx` |
| Mobile API Client | `apps/mobile/lib/api/client.ts` → `api.jobs.confirmationCode` |
| Badge Prompt Hook | `apps/mobile/hooks/useBadgePrompt.ts` |

### Database Schema

```prisma
model Job {
  // Confirmation Code System (Phase 4.4)
  confirmationCode           String?   @map("confirmation_code")
  confirmationCodeSentAt     DateTime? @map("confirmation_code_sent_at")
  confirmationCodeVerifiedAt DateTime? @map("confirmation_code_verified_at")
  confirmationCodeAttempts   Int       @default(0) @map("confirmation_code_attempts")
}
```

> [!NOTE] **No Organization Toggle**
> Unlike most features, there is NO `confirmationCodeEnabled` toggle on Organization. This feature is always on.

### Security Features

- **Random 4-digit codes** - Cryptographically generated (1000-9999)
- **Maximum 3 attempts** - Prevents brute force
- **Code expires with job** - Not reusable
- **Delivered via WhatsApp** - Uses existing WATI integration
- **Audit trail** - Timestamps for sent/verified stored in database

---

## 🎫 System 2: QR Digital Badge (OPTIONAL)

### Overview

The technician carries a digital badge on their phone that ANYONE can scan to verify identity, employment status, and professional credentials. This is an OPTIONAL extra trust layer that we encourage through daily gentle reminders.

### Habit Building Strategy

Instead of prompting for every job or specific customer types, we use a **daily morning reminder** approach:

```
┌─────────────────────────────────────────────────────────────┐
│  First job navigation of the day                            │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  🛡️ Tu Credencial Digital                               ││
│  │                                                         ││
│  │  Recordá que podés mostrar tu credencial digital a     ││
│  │  los clientes para generar más confianza. ¡Les encanta!││
│  │                                                         ││
│  │  [ Ver Credencial ]    [ Entendido ]                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  → Only shown ONCE per day (stored in AsyncStorage)         │
│  → Not tied to customer type                                │
│  → Goal: Build unconscious habit, not annoy                 │
└─────────────────────────────────────────────────────────────┘
```

| Behavior | Implementation |
|:---|:---|
| **Shown once per day** | Stored in AsyncStorage by date |
| **Triggered on first navigation** | `useBadgePrompt.checkDailyBadgeReminder()` |
| **Gentle language** | "Les encanta!" not "Requerido" |
| **Easy dismiss** | "Entendido" button |

### Badge Display

```
┌─────────────────────────────────────────────────────────────┐
│  TECHNICIAN'S PHONE                                         │
│                                                              │
│  ┌─────────────────────────────────────┐                    │
│  │  🛡️ CREDENCIAL DIGITAL              │                    │
│  │                                     │                    │
│  │  ┌──────────┐  Juan Pérez           │                    │
│  │  │  [PHOTO] │  Gasista Matriculado  │                    │
│  │  └──────────┘                       │                    │
│  │                                     │                    │
│  │  Tecno Servicio S.R.L.             │                    │
│  │  CUIT: 30-12345678-9               │                    │
│  │                                     │                    │
│  │  ┌───────────────────┐             │                    │
│  │  │    [QR CODE]      │             │                    │
│  │  │                   │             │                    │
│  │  │  scan to verify   │             │                    │
│  │  └───────────────────┘             │                    │
│  │                                     │                    │
│  │  Válida hasta: 15 Mar 2026         │                    │
│  └─────────────────────────────────────┘                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼ (Anyone scans QR)
┌─────────────────────────────────────────────────────────────┐
│  VERIFICATION PAGE (opens in scanner's phone)               │
│  https://campotech.ar/verify-badge/[token]                  │
│                                                              │
│  ✅ IDENTIDAD VERIFICADA                                     │
│                                                              │
│  ┌──────────┐  Juan Pérez                                   │
│  │  [PHOTO] │  Técnico verificado                           │
│  └──────────┘                                               │
│                                                              │
│  Organización: Tecno Servicio S.R.L.                        │
│  Estado: ✅ Activo                                           │
│  ART: ✅ Vigente hasta 31/12/2026                           │
│  Antecedentes: ✅ Sin observaciones                         │
│                                                              │
│  ⚠️ Si algo parece incorrecto, contacte a CampoTech         │
└─────────────────────────────────────────────────────────────┘
```

### Badge Data

| Field | Description | Privacy |
|:---|:---|:---|
| Photo | Technician's verified photo | ✅ Visible |
| Name | Full name | ✅ Visible |
| Organization | Company name + CUIT | ✅ Visible |
| Status | Active/Inactive | ✅ Visible |
| ART Insurance | Current and valid | ✅ Visible |
| Background Check | Passed | ✅ Visible |
| **DNI Number** | National ID | ❌ NOT shown (privacy) |

> [!WARNING] **Privacy Decision**
> DNI images are NOT shown on badges per Argentine Data Protection Law (Ley 25.326). We show verified identity through photos and attestation instead.

### Technical Details

| Component | File |
|:---|:---|
| Mobile Badge Component | `apps/mobile/components/badge/DigitalBadge.tsx` |
| QR Code Library | `react-native-qrcode-svg` |
| Badge Service | `apps/web/lib/services/digital-badge.service.ts` |
| Verification Page | `apps/web/app/verify-badge/[token]/page.tsx` |
| Daily Reminder | `apps/mobile/hooks/useBadgePrompt.ts` |

### Security Features

- **30-day token rotation** - QR payload refreshes monthly
- **Cryptographic tokens** - Cannot be guessed or forged
- **Real-time verification** - Checks current employment status
- **No sensitive data in QR** - Only contains verification token

---

## 📣 Marketing: Landing Page Feature

These security features are major differentiators and should be prominently displayed on the landing page:

### Suggested Landing Page Section

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  🔐 SEGURIDAD QUE VOS Y TUS CLIENTES MERECEN                │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │  📱 Código de Confirmación          🎫 Credencial QR   ││
│  │                                                         ││
│  │  Cuando tu técnico va en camino,    El técnico puede   ││
│  │  el cliente recibe un código de     mostrar su         ││
│  │  4 dígitos por WhatsApp.            credencial digital ││
│  │                                     verificable con    ││
│  │  El técnico lo pide al llegar       solo escanear el   ││
│  │  para confirmar su identidad.       código QR.         ││
│  │                                                         ││
│  │  ✅ Como Rappi o Uber Eats          ✅ Datos de ART    ││
│  │  ✅ Imposible de falsificar         ✅ Antecedentes    ││
│  │  ✅ Registro de llegada             ✅ Foto verificada ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  "La tranquilidad de saber quién entra a tu casa"           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Benefits

### For Customers
- ✅ Know exactly who is coming to their home
- ✅ Can verify technician before opening the door
- ✅ Receive confirmation when work starts
- ✅ Paper trail of who entered their property

### For Technicians
- ✅ Professional credential to show at entry points
- ✅ Proof they arrived at the correct location
- ✅ Protection against false claims
- ✅ Builds trust with new customers

### For Service Providers (Organizations)
- ✅ Accountability for their team
- ✅ Professional image with customers
- ✅ Audit trail for all job arrivals
- ✅ Competitive advantage over informal services

### For CampoTech
- ✅ Trust layer that differentiates from competitors
- ✅ Appeals to security-conscious customers
- ✅ Captures both formal and informal service providers

---

## 🔗 Connections

- **Parent:** [[Mobile App]], [[Jobs Page]]
- **Related:**
  - [[Profile Page]] (Badge accessible from here)
  - [[Team Page]] (Manage technician credentials)
  - [[WhatsApp AI Copilot]] (Message delivery)
  - [[Argentine Data Protection]] (Privacy compliance)
  - [[Landing Page]] (Feature marketing)

---

*Last updated: February 2026*
