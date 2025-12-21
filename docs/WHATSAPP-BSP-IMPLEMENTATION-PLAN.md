# WhatsApp Integration Implementation Plan

## Overview

This plan implements two WhatsApp integration tiers:

| Tier | Feature | How It Works | AI Enabled |
|------|---------|--------------|------------|
| **INICIAL** | wa.me Links | Click-to-chat URLs, business uses their own WhatsApp app | No |
| **PROFESIONAL+** | BSP Virtual Number | CampoTech provisions number via 360dialog, full API access | Yes |

---

## Phase 1: wa.me Link Integration (INICIAL Tier)
**Estimated Complexity: Low**

### 1.1 Core wa.me Utility Functions

**Files to create/modify:**
- `apps/web/lib/whatsapp-links.ts` (new)

**Tasks:**
- [ ] Create `generateWhatsAppLink(phone, message?)` utility function
- [ ] Create `generateWhatsAppQRCode(phone, message?)` for QR generation
- [ ] Handle phone number normalization (Argentina format: +54 9 XX XXXX-XXXX)
- [ ] URL encode messages properly
- [ ] Add link click tracking (optional analytics)

```typescript
// Example output:
generateWhatsAppLink('+54 11 5555-1234', 'Consulta factura #0042')
// → "https://wa.me/5491155551234?text=Consulta%20factura%20%230042"
```

### 1.2 Organization WhatsApp Settings (Basic)

**Files to modify:**
- `apps/web/app/dashboard/settings/whatsapp/page.tsx`
- `apps/web/app/api/settings/whatsapp/route.ts`

**Tasks:**
- [ ] Add "WhatsApp Personal Number" field to organization settings
- [ ] Validate phone number format on save
- [ ] Store in `Organization.whatsappPersonalNumber` (new field)
- [ ] Display wa.me preview link in settings

### 1.3 Database Schema Update

**Files to modify:**
- `apps/web/prisma/schema.prisma`

**Tasks:**
- [ ] Add `whatsappPersonalNumber` field to Organization model
- [ ] Add `whatsappIntegrationType` enum: `NONE | WAME_LINK | BSP_API`
- [ ] Run migration

```prisma
model Organization {
  // ... existing fields
  whatsappPersonalNumber    String?   // For wa.me links
  whatsappIntegrationType   WhatsAppIntegrationType @default(NONE)
}

enum WhatsAppIntegrationType {
  NONE
  WAME_LINK
  BSP_API
}
```

### 1.4 Invoice Integration

**Files to modify:**
- `apps/web/app/dashboard/invoices/[id]/page.tsx`
- `apps/web/components/invoices/InvoicePDF.tsx`
- `apps/web/lib/services/invoice.service.ts`

**Tasks:**
- [ ] Add "Consultar por WhatsApp" button on invoice view
- [ ] Include wa.me link in invoice PDF
- [ ] Pre-fill message: "Hola, tengo una consulta sobre la factura #{invoiceNumber}"
- [ ] Add WhatsApp icon/button to invoice email template

### 1.5 Job Confirmation Integration

**Files to modify:**
- `apps/web/lib/notifications/job-notifications.ts`
- `apps/web/components/jobs/JobConfirmationEmail.tsx`

**Tasks:**
- [ ] Add wa.me link to job confirmation SMS/email
- [ ] Pre-fill message: "Consulta sobre turno del {date}"
- [ ] Include in customer-facing job details page

### 1.6 Customer Profile Integration

**Files to modify:**
- `apps/web/app/dashboard/customers/[id]/page.tsx`
- `apps/web/components/customers/CustomerCard.tsx`

**Tasks:**
- [ ] Add "WhatsApp" quick action button on customer profile
- [ ] Opens wa.me link with customer's phone number
- [ ] Pre-fill: "Hola {customerName},"

### 1.7 Public Business Profile

**Files to modify:**
- `apps/web/app/[slug]/page.tsx` (public business page)
- `apps/web/components/public/BusinessContact.tsx`

**Tasks:**
- [ ] Add WhatsApp button to public business profile
- [ ] Generate QR code for business cards
- [ ] Pre-fill: "Hola, vi tu perfil en CampoTech"

---

## Phase 2: BSP Provider Abstraction Layer
**Estimated Complexity: Medium**

### 2.1 BSP Provider Interface

**Files to create:**
- `apps/web/lib/integrations/whatsapp/providers/types.ts`
- `apps/web/lib/integrations/whatsapp/providers/index.ts`

**Tasks:**
- [ ] Define `WhatsAppBSPProvider` interface
- [ ] Define common types: `ProvisionResult`, `VerificationResult`, `SendResult`
- [ ] Create provider factory function

```typescript
interface WhatsAppBSPProvider {
  name: string;

  // Number provisioning
  getAvailableNumbers(countryCode: string): Promise<PhoneNumber[]>;
  provisionNumber(orgId: string, phoneNumber: string): Promise<ProvisionResult>;
  releaseNumber(orgId: string): Promise<void>;

  // Verification
  sendVerificationCode(orgId: string, phoneNumber: string): Promise<void>;
  verifyCode(orgId: string, code: string): Promise<VerificationResult>;

  // Messaging (delegates to existing WhatsApp client)
  sendMessage(orgId: string, message: OutboundMessage): Promise<SendResult>;
  sendTemplate(orgId: string, template: TemplateMessage): Promise<SendResult>;

  // Webhook
  getWebhookUrl(orgId: string): string;
  verifyWebhookSignature(payload: string, signature: string): boolean;

  // Status
  getAccountStatus(orgId: string): Promise<AccountStatus>;
  getUsageStats(orgId: string): Promise<UsageStats>;
}
```

### 2.2 Meta Direct Provider (Refactor Existing)

**Files to modify:**
- `apps/web/lib/integrations/whatsapp/providers/meta-direct.provider.ts` (new)

**Tasks:**
- [ ] Wrap existing `WhatsAppClient` in provider interface
- [ ] Implement all interface methods
- [ ] This is for orgs that configure their own Meta credentials
- [ ] No provisioning (manual setup only)

### 2.3 Database Schema for BSP

**Files to modify:**
- `apps/web/prisma/schema.prisma`

**Tasks:**
- [ ] Add BSP provider tracking to `WhatsAppBusinessAccount`
- [ ] Add provisioning status fields
- [ ] Add billing/usage tracking fields

```prisma
model WhatsAppBusinessAccount {
  // ... existing fields

  // BSP Provider Info
  bspProvider           WhatsAppBSPProviderType @default(META_DIRECT)
  bspAccountId          String?    // Provider's account ID
  bspPhoneNumberSid     String?    // Provider's phone number ID

  // Provisioning Status
  provisioningStatus    ProvisioningStatus @default(NOT_STARTED)
  provisionedAt         DateTime?
  verificationCode      String?    // Temporary, cleared after verification
  verificationExpiresAt DateTime?

  // Usage & Billing
  monthlyMessageCount   Int        @default(0)
  lastBillingReset      DateTime   @default(now())
}

enum WhatsAppBSPProviderType {
  META_DIRECT      // Manual Meta credentials
  DIALOG_360       // 360dialog
  TWILIO           // Twilio WhatsApp
}

enum ProvisioningStatus {
  NOT_STARTED
  NUMBER_SELECTED
  VERIFICATION_PENDING
  VERIFIED
  ACTIVE
  SUSPENDED
  RELEASED
}
```

---

## Phase 3: 360dialog BSP Integration
**Estimated Complexity: High**

### 3.1 360dialog Provider Implementation

**Files to create:**
- `apps/web/lib/integrations/whatsapp/providers/dialog360.provider.ts`
- `apps/web/lib/integrations/whatsapp/providers/dialog360.types.ts`

**Tasks:**
- [ ] Implement `WhatsAppBSPProvider` interface for 360dialog
- [ ] API client for 360dialog Partner API
- [ ] Handle authentication (API key)
- [ ] Implement number provisioning flow
- [ ] Implement message sending via 360dialog

**360dialog API Endpoints:**
```
POST /v1/configs/webhook      - Set webhook URL
POST /v1/messages             - Send message
GET  /v1/configs/phone        - Get phone info
POST /v1/partners/channels    - Create channel (provision)
```

### 3.2 Environment Configuration

**Files to modify:**
- `apps/web/.env.example`

**Tasks:**
- [ ] Add 360dialog credentials
```env
# 360dialog BSP
DIALOG360_API_KEY="your-partner-api-key"
DIALOG360_PARTNER_ID="your-partner-id"
DIALOG360_WEBHOOK_SECRET="your-webhook-secret"
```

### 3.3 360dialog Webhook Handler

**Files to create:**
- `apps/web/app/api/webhooks/dialog360/route.ts`

**Tasks:**
- [ ] Handle inbound messages from 360dialog format
- [ ] Transform to internal message format
- [ ] Route to correct organization
- [ ] Handle status updates
- [ ] Signature verification

### 3.4 Number Provisioning API

**Files to create:**
- `apps/web/app/api/whatsapp/provision/route.ts`
- `apps/web/app/api/whatsapp/provision/verify/route.ts`
- `apps/web/app/api/whatsapp/provision/available/route.ts`

**Tasks:**
- [ ] `GET /api/whatsapp/provision/available` - List available numbers
- [ ] `POST /api/whatsapp/provision` - Start provisioning flow
- [ ] `POST /api/whatsapp/provision/verify` - Verify with code
- [ ] `DELETE /api/whatsapp/provision` - Release number

---

## Phase 4: Provisioning UI Flow
**Estimated Complexity: Medium**

### 4.1 WhatsApp Setup Wizard

**Files to create:**
- `apps/web/app/dashboard/settings/whatsapp/setup/page.tsx`
- `apps/web/components/whatsapp/SetupWizard.tsx`
- `apps/web/components/whatsapp/NumberSelector.tsx`
- `apps/web/components/whatsapp/VerificationStep.tsx`

**Tasks:**
- [ ] Step 1: Choose integration type (wa.me vs BSP)
- [ ] Step 2: Select country/area code (for BSP)
- [ ] Step 3: Choose available number from list
- [ ] Step 4: Enter verification code (SMS to owner's personal phone)
- [ ] Step 5: Success - WhatsApp active

**UI Flow:**
```
┌─────────────────────────────────────────────────────────────┐
│  Configurar WhatsApp                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ¿Cómo querés integrar WhatsApp?                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📱 Usar mi número personal                          │   │
│  │  Tus clientes te escriben a tu WhatsApp actual.     │   │
│  │  Sin IA, sin automatización.                        │   │
│  │  [Incluido en tu plan]                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🤖 Número exclusivo con IA                          │   │
│  │  Te asignamos un número de WhatsApp para tu negocio.│   │
│  │  La IA responde automáticamente.                    │   │
│  │  [Requiere Plan Profesional - $55/mes]              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Number Selection UI

**Tasks:**
- [ ] Fetch available numbers from BSP
- [ ] Display with area code grouping
- [ ] Show monthly cost (if any)
- [ ] Handle number reservation (5 min hold)

```
┌─────────────────────────────────────────────────────────────┐
│  Elegí tu número de WhatsApp                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  País: 🇦🇷 Argentina                                        │
│                                                             │
│  Números disponibles:                                       │
│                                                             │
│  ○ +54 11 2345-6789  (Buenos Aires)                        │
│  ● +54 11 3456-7890  (Buenos Aires)  ← Seleccionado        │
│  ○ +54 351 234-5678  (Córdoba)                             │
│  ○ +54 261 345-6789  (Mendoza)                             │
│                                                             │
│  [← Volver]                      [Continuar →]             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Verification UI

**Tasks:**
- [ ] Send SMS to owner's personal phone
- [ ] 6-digit code input
- [ ] Resend option (with cooldown)
- [ ] Error handling

```
┌─────────────────────────────────────────────────────────────┐
│  Verificá tu identidad                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Enviamos un código de 6 dígitos a:                        │
│  +54 11 ****-5678                                          │
│                                                             │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┐                     │
│  │  4  │  2  │  8  │  _  │  _  │  _  │                     │
│  └─────┴─────┴─────┴─────┴─────┴─────┘                     │
│                                                             │
│  ¿No recibiste el código? [Reenviar] (disponible en 45s)   │
│                                                             │
│  [← Volver]                      [Verificar →]             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Success & Onboarding

**Tasks:**
- [ ] Display new WhatsApp number prominently
- [ ] Show QR code for testing
- [ ] Quick tips for first message
- [ ] Link to AI configuration

---

## Phase 5: Billing & Usage Tracking
**Estimated Complexity: Medium**

### 5.1 Usage Metering

**Files to create:**
- `apps/web/lib/services/whatsapp-usage.service.ts`
- `apps/web/app/api/whatsapp/usage/route.ts`

**Tasks:**
- [ ] Track messages sent/received per organization
- [ ] Track conversations opened (24-hour windows)
- [ ] Track AI responses generated
- [ ] Monthly reset logic
- [ ] Usage alerts (80%, 100% of limit)

### 5.2 Tier Limits Enforcement

**Files to modify:**
- `apps/web/lib/integrations/whatsapp/providers/dialog360.provider.ts`
- `apps/web/lib/services/whatsapp.service.ts`

**Tasks:**
- [ ] Check subscription tier before sending
- [ ] Enforce monthly message limits per tier:
  - PROFESIONAL: 500 messages/month
  - EMPRESA: Unlimited
- [ ] Return clear error when limit reached
- [ ] Suggest upgrade path

### 5.3 Usage Dashboard

**Files to create:**
- `apps/web/app/dashboard/settings/whatsapp/usage/page.tsx`
- `apps/web/components/whatsapp/UsageChart.tsx`

**Tasks:**
- [ ] Display current month usage
- [ ] Messages sent vs limit
- [ ] AI conversations used
- [ ] Cost breakdown (if applicable)
- [ ] Historical usage graph

---

## Phase 6: AI Integration with BSP
**Estimated Complexity: Low (already built)**

### 6.1 Connect AI Responder to BSP

**Files to modify:**
- `apps/web/lib/services/whatsapp-ai-responder.ts`
- `apps/web/lib/integrations/whatsapp/providers/dialog360.provider.ts`

**Tasks:**
- [ ] Route inbound messages from 360dialog to AI responder
- [ ] Ensure AI responses go back through 360dialog
- [ ] Maintain conversation context across provider

### 6.2 AI Configuration per Organization

**Already implemented, verify:**
- [ ] `AIConfiguration` model works with BSP numbers
- [ ] Business context, hours, FAQ all apply
- [ ] Transfer to human works with BSP

---

## Phase 7: Testing & Quality Assurance
**Estimated Complexity: Medium**

### 7.1 Unit Tests

**Files to create:**
- `apps/web/__tests__/whatsapp/providers/dialog360.test.ts`
- `apps/web/__tests__/whatsapp/provisioning.test.ts`
- `apps/web/__tests__/whatsapp/wame-links.test.ts`

**Tasks:**
- [ ] Test wa.me link generation
- [ ] Test phone number normalization
- [ ] Test 360dialog API client
- [ ] Test provisioning flow
- [ ] Test webhook signature verification

### 7.2 Integration Tests

**Tasks:**
- [ ] Test full provisioning flow (sandbox)
- [ ] Test message sending/receiving
- [ ] Test AI response integration
- [ ] Test usage tracking accuracy

### 7.3 E2E Tests

**Tasks:**
- [ ] Test setup wizard UI flow
- [ ] Test settings page functionality
- [ ] Test invoice WhatsApp button
- [ ] Test customer profile WhatsApp button

---

## Phase 8: Documentation & Rollout
**Estimated Complexity: Low**

### 8.1 User Documentation

**Files to create:**
- `docs/user-guides/WHATSAPP-SETUP.md`
- `docs/user-guides/WHATSAPP-AI-CONFIG.md`

**Tasks:**
- [ ] Setup guide for wa.me links
- [ ] Setup guide for BSP number
- [ ] AI configuration guide
- [ ] Troubleshooting FAQ

### 8.2 Admin Documentation

**Files to modify:**
- `docs/CAMPOTECH-SUBSCRIPTION-VERIFICATION-ROADMAP.md`

**Tasks:**
- [ ] Update with WhatsApp tier features
- [ ] Document 360dialog account setup
- [ ] Document environment variables
- [ ] Document webhook configuration

### 8.3 Rollout Plan

**Tasks:**
- [ ] Phase 1: wa.me links for all tiers (immediate)
- [ ] Phase 2: BSP beta for select EMPRESA customers
- [ ] Phase 3: BSP general availability for PROFESIONAL+
- [ ] Monitor usage and adjust limits

---

## Implementation Priority

| Phase | Priority | Dependencies | Effort |
|-------|----------|--------------|--------|
| Phase 1 (wa.me) | **HIGH** | None | 1-2 days |
| Phase 2 (Abstraction) | **HIGH** | Phase 1 | 1-2 days |
| Phase 3 (360dialog) | **HIGH** | Phase 2 | 3-4 days |
| Phase 4 (UI) | **HIGH** | Phase 3 | 2-3 days |
| Phase 5 (Billing) | MEDIUM | Phase 4 | 2 days |
| Phase 6 (AI) | LOW | Phase 3 | 1 day |
| Phase 7 (Testing) | MEDIUM | All above | 2-3 days |
| Phase 8 (Docs) | LOW | All above | 1 day |

**Total Estimated Effort: 13-18 days**

---

## Environment Variables Summary

```env
# Existing (keep)
WHATSAPP_APP_SECRET="..."
WHATSAPP_WEBHOOK_VERIFY_TOKEN="..."
WHATSAPP_API_VERSION="v18.0"

# New for 360dialog
DIALOG360_API_KEY="your-partner-api-key"
DIALOG360_PARTNER_ID="your-partner-id"
DIALOG360_WEBHOOK_SECRET="your-webhook-secret"
DIALOG360_API_BASE_URL="https://waba.360dialog.io"

# Optional: Twilio as backup BSP
TWILIO_WHATSAPP_ACCOUNT_SID="..."
TWILIO_WHATSAPP_AUTH_TOKEN="..."
```

---

## Subscription Tier Features (Final)

| Feature | INICIAL ($25) | PROFESIONAL ($55) | EMPRESA ($120) |
|---------|---------------|-------------------|----------------|
| wa.me click-to-chat links | ✅ | ✅ | ✅ |
| WhatsApp on invoices/jobs | ✅ | ✅ | ✅ |
| QR code generation | ✅ | ✅ | ✅ |
| Virtual WhatsApp number | ❌ | ✅ | ✅ |
| AI auto-responses | ❌ | ✅ (500 msg/mo) | ✅ Unlimited |
| Voice message transcription | ❌ | ✅ | ✅ |
| Auto job creation | ❌ | ✅ | ✅ |
| Conversation history | ❌ | ✅ | ✅ |
| Multiple team responders | ❌ | ❌ | ✅ |
| Custom AI instructions | ❌ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ |
