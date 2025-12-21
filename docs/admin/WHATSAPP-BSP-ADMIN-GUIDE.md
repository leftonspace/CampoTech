# WhatsApp BSP Administration Guide

This guide covers the technical setup and administration of the WhatsApp Business Solution Provider (BSP) integration for CampoTech.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Environment Configuration](#environment-configuration)
3. [360dialog Account Setup](#360dialog-account-setup)
4. [Webhook Configuration](#webhook-configuration)
5. [Tier Features Matrix](#tier-features-matrix)
6. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
7. [Database Schema](#database-schema)

---

## Architecture Overview

CampoTech uses a tiered WhatsApp integration:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CampoTech Platform                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────┐    ┌───────────────────┐                    │
│  │   INICIAL Tier    │    │  PROFESIONAL+     │                    │
│  │                   │    │  Tier             │                    │
│  │  wa.me Links      │    │  360dialog BSP    │                    │
│  │  (No backend)     │    │  (Full API)       │                    │
│  └───────────────────┘    └─────────┬─────────┘                    │
│                                     │                               │
│                                     ▼                               │
│                     ┌───────────────────────────────┐              │
│                     │    BSP Provider Abstraction   │              │
│                     │    (WhatsAppBSPProvider)      │              │
│                     └───────────────┬───────────────┘              │
│                                     │                               │
└─────────────────────────────────────┼───────────────────────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────────┐
                        │      360dialog API          │
                        │                             │
                        │  Partner API (provisioning) │
                        │  WABA API (messaging)       │
                        └─────────────────────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────────┐
                        │    Meta/WhatsApp Cloud      │
                        └─────────────────────────────┘
```

### Components

| Component | Purpose | Location |
|-----------|---------|----------|
| BSP Provider Interface | Abstract provider for multiple BSPs | `lib/integrations/whatsapp/providers/types.ts` |
| Dialog360 Provider | 360dialog implementation | `lib/integrations/whatsapp/providers/dialog360.provider.ts` |
| Webhook Handler | Receives messages from 360dialog | `app/api/webhooks/dialog360/route.ts` |
| Provisioning API | Number provisioning endpoints | `app/api/whatsapp/provision/` |
| AI Responder | Automated AI responses | `lib/services/whatsapp-ai-responder.ts` |
| Usage Service | Tracks message limits | `lib/services/whatsapp-usage.service.ts` |

---

## Environment Configuration

### Required Environment Variables

Add these to your `.env` file:

```env
# 360dialog BSP Configuration
DIALOG360_PARTNER_API_KEY="your-partner-api-key"
DIALOG360_PARTNER_ID="your-partner-id"
DIALOG360_WEBHOOK_SECRET="your-webhook-secret"

# Optional: API base URL (defaults to production)
DIALOG360_API_BASE_URL="https://waba.360dialog.io"
```

### Variable Descriptions

| Variable | Description | Required |
|----------|-------------|----------|
| `DIALOG360_PARTNER_API_KEY` | API key from 360dialog Partner Hub | Yes |
| `DIALOG360_PARTNER_ID` | Your partner account ID | Yes |
| `DIALOG360_WEBHOOK_SECRET` | Secret for webhook signature verification | Yes |
| `DIALOG360_API_BASE_URL` | Base URL for 360dialog API | No (default: production) |

### Obtaining Credentials

1. Log in to [360dialog Partner Hub](https://hub.360dialog.com)
2. Navigate to **Settings** → **API Keys**
3. Generate a new Partner API key
4. Copy your Partner ID from the dashboard
5. Set up a webhook secret for signature verification

---

## 360dialog Account Setup

### Initial Partner Setup

1. **Register as 360dialog Partner**
   - Apply at [360dialog.com/partners](https://www.360dialog.com/partners)
   - Complete business verification
   - Sign partner agreement

2. **Configure Webhook Endpoint**
   - Base URL: `https://your-domain.com/api/webhooks/dialog360`
   - Add organization ID as query param: `?orgId={org_id}`

3. **Request Number Pool**
   - Request Argentine numbers (+54)
   - Specify area codes needed (11, 351, 261, etc.)
   - Minimum pool size: 10 numbers

### Per-Organization Setup

When a customer provisions a number:

1. **Number Allocation**
   - Customer selects from available pool
   - Number is reserved for 5 minutes during verification

2. **Verification**
   - SMS code sent to customer's registered phone
   - Customer enters 6-digit code
   - Upon verification, WABA API key is generated

3. **Webhook Registration**
   - Webhook URL configured with org-specific query param
   - Example: `/api/webhooks/dialog360?orgId=org_xxx`

---

## Webhook Configuration

### Webhook URL Structure

```
https://campotech.com.ar/api/webhooks/dialog360?orgId={organization_id}
```

### Signature Verification

All webhooks are verified using HMAC-SHA256:

```typescript
const isValid = crypto
  .createHmac('sha256', webhookSecret)
  .update(rawBody)
  .digest('hex') === signature.replace('sha256=', '');
```

### Webhook Events Handled

| Event Type | Handler | Description |
|------------|---------|-------------|
| `messages` | `processInboundMessage` | New customer messages |
| `statuses` | `processStatusUpdate` | Delivery receipts |
| `errors` | Logged | API errors |

### Retry Policy

- 360dialog retries failed webhooks up to 5 times
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Always return 200 quickly to acknowledge

---

## Tier Features Matrix

### WhatsApp Features by Subscription Tier

| Feature | FREE | INICIAL | PROFESIONAL | EMPRESARIAL | ENTERPRISE |
|---------|------|---------|-------------|-------------|------------|
| wa.me click-to-chat links | - | ✅ | ✅ | ✅ | ✅ |
| WhatsApp on invoices | - | ✅ | ✅ | ✅ | ✅ |
| QR code generation | - | ✅ | ✅ | ✅ | ✅ |
| Virtual WhatsApp number | - | - | ✅ | ✅ | ✅ |
| AI auto-responses | - | - | ✅ | ✅ | ✅ |
| Voice transcription | - | - | ✅ | ✅ | ✅ |
| Auto job creation | - | - | ✅ | ✅ | ✅ |
| Conversation history | - | - | ✅ | ✅ | ✅ |
| Multiple responders | - | - | - | ✅ | ✅ |
| Custom AI instructions | - | - | ✅ | ✅ | ✅ |
| Priority support | - | - | - | - | ✅ |

### Message Limits by Tier

| Tier | Monthly Messages | AI Conversations |
|------|------------------|------------------|
| FREE | 0 | 0 |
| INICIAL | 0 (wa.me only) | 0 |
| PROFESIONAL | 1,000 | 500 |
| EMPRESARIAL | 5,000 | 2,500 |
| ENTERPRISE | Unlimited | Unlimited |

### Limit Enforcement

Limits are enforced in `dialog360.provider.ts`:

```typescript
const usageCheck = await WhatsAppUsageService.canSendMessage(organizationId);
if (!usageCheck.allowed) {
  return {
    success: false,
    error: usageCheck.reason,
    errorCode: 'LIMIT_REACHED',
  };
}
```

---

## Monitoring & Troubleshooting

### Logging

All WhatsApp operations are logged with prefixes:

- `[Dialog360]` - Provider operations
- `[Dialog360 Webhook]` - Webhook processing
- `[Dialog360 AI]` - AI response handling

### Common Issues

#### 1. Webhook Not Receiving Messages

**Symptoms:**
- Messages sent but not appearing in CampoTech
- No webhook logs

**Solutions:**
1. Verify webhook URL is correct in 360dialog Hub
2. Check SSL certificate is valid
3. Verify `orgId` query parameter is correct
4. Check server logs for signature failures

#### 2. Message Sending Failures

**Symptoms:**
- AI responds but message not delivered
- Error in logs

**Solutions:**
1. Check WABA API key is valid (not expired)
2. Verify phone number format (international)
3. Check usage limits not reached
4. Verify 24-hour window for non-template messages

#### 3. Number Provisioning Stuck

**Symptoms:**
- Customer stuck on verification step
- Status stays "PENDING_VERIFICATION"

**Solutions:**
1. Check verification code hasn't expired (10 min limit)
2. Allow customer to resend verification code
3. Manually reset provisioning status if needed
4. Contact 360dialog support for number issues

#### 4. AI Not Responding

**Symptoms:**
- Messages received but no AI response
- AI disabled in settings

**Solutions:**
1. Check AI configuration is enabled
2. Verify `autoResponseEnabled` is true
3. Check business hours if set
4. Verify OpenAI API key is valid
5. Check usage limits

### Health Checks

Implement periodic health checks:

```typescript
// Check 360dialog API connectivity
const healthCheck = async () => {
  const response = await fetch('https://waba.360dialog.io/v1/health');
  return response.ok;
};
```

### Metrics to Monitor

| Metric | Alert Threshold | Description |
|--------|-----------------|-------------|
| Webhook response time | > 5s | Slow processing |
| Message delivery rate | < 95% | Delivery issues |
| AI response rate | < 90% | AI failures |
| Usage approaching limit | 80% | Approaching tier limit |

---

## Database Schema

### Key Models

#### WhatsAppBusinessAccount

```prisma
model WhatsAppBusinessAccount {
  id                    String   @id @default(cuid())
  organizationId        String   @unique

  // BSP Configuration
  bspProvider           WhatsAppBSPProviderType @default(META_DIRECT)
  bspAccountId          String?
  phoneNumber           String?
  phoneNumberId         String?
  displayPhoneNumber    String?
  accessToken           String?

  // Provisioning Status
  provisioningStatus    ProvisioningStatus @default(NOT_STARTED)
  verificationCode      String?
  verificationExpiresAt DateTime?

  // Usage Tracking
  monthlyMessageCount   Int      @default(0)
  monthlyAICount        Int      @default(0)
  lastBillingReset      DateTime @default(now())
}

enum WhatsAppBSPProviderType {
  META_DIRECT
  DIALOG_360
}

enum ProvisioningStatus {
  NOT_STARTED
  PENDING_NUMBER_SELECTION
  PENDING_VERIFICATION
  ACTIVE
  SUSPENDED
  RELEASED
}
```

#### WhatsAppConversation

```prisma
model WhatsAppConversation {
  id              String   @id @default(cuid())
  organizationId  String
  customerId      String?
  customerPhone   String
  customerName    String?
  status          ConversationStatus @default(OPEN)
  assignedToId    String?
  lastMessageAt   DateTime?
  messages        WhatsAppMessage[]
}
```

#### WhatsAppMessage

```prisma
model WhatsAppMessage {
  id                String   @id @default(cuid())
  conversationId    String
  whatsappMessageId String?
  direction         MessageDirection
  type              String
  content           String
  status            String
  metadata          Json?
}
```

### Indexes

Ensure these indexes exist for performance:

```prisma
@@index([organizationId, provisioningStatus])
@@index([customerPhone, organizationId])
@@index([conversationId, createdAt])
```

---

## Rollback Procedures

### Disabling BSP for an Organization

```sql
UPDATE "WhatsAppBusinessAccount"
SET "provisioningStatus" = 'SUSPENDED',
    "accessToken" = NULL
WHERE "organizationId" = 'org_xxx';
```

### Resetting Usage Counters

```sql
UPDATE "WhatsAppBusinessAccount"
SET "monthlyMessageCount" = 0,
    "monthlyAICount" = 0,
    "lastBillingReset" = NOW()
WHERE "organizationId" = 'org_xxx';
```

### Releasing a Number

1. Call `provider.releaseNumber(organizationId)`
2. Update database status
3. Number returns to pool

---

## Security Considerations

1. **API Key Storage**: Store all API keys in environment variables, never in code
2. **Webhook Verification**: Always verify webhook signatures
3. **Access Token Encryption**: Consider encrypting WABA API keys at rest
4. **Rate Limiting**: Implement rate limiting on provisioning endpoints
5. **Audit Logging**: Log all provisioning and administrative actions

---

## Support Contacts

- **360dialog Support**: support@360dialog.com
- **CampoTech Engineering**: engineering@campotech.com.ar
- **360dialog Status**: status.360dialog.com

---

*Last Updated: December 2024*
