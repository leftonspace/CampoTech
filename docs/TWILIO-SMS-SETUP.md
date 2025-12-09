# Twilio SMS Setup Guide for CampoTech

This guide explains how to set up Twilio for OTP (One-Time Password) delivery in CampoTech.

## Overview

CampoTech uses phone-based authentication with OTP codes sent via SMS. The system supports:

- **Production mode**: Real SMS via Twilio
- **Development mode**: OTPs logged to console + bypass code `123456`

---

## Quick Start

### 1. Create Twilio Account

1. Go to [Twilio Console](https://console.twilio.com/)
2. Sign up for a free trial (or paid account)
3. Verify your phone number

### 2. Get a Phone Number

1. In Twilio Console, go to **Phone Numbers** > **Buy a Number**
2. Select a number with SMS capability
3. Cost: ~$1/month for US numbers

### 3. Get Your Credentials

In Twilio Console, find:
- **Account SID**: `ACxxxxxxxxx...` (from dashboard)
- **Auth Token**: Click to reveal (from dashboard)
- **Phone Number**: The number you purchased

### 4. Add Environment Variables

In **Vercel** (or your hosting):

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token-here
TWILIO_PHONE_NUMBER=+1234567890
```

Or in `.env.local` for local development:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token-here
TWILIO_PHONE_NUMBER=+1234567890
```

### 5. Run Database Migration

The OTP system requires an `otp_codes` table. Run the Prisma migration:

```bash
cd apps/web
npx prisma db push
```

---

## How It Works

### OTP Flow

```
User enters phone → Request OTP → Generate 6-digit code → Store hash in DB → Send SMS via Twilio
                                                                                    ↓
User enters code → Verify against DB hash → Success → Create session/JWT → User logged in
```

### Security Features

| Feature | Description |
|---------|-------------|
| **Hashed storage** | OTPs stored as SHA-256 hashes, not plaintext |
| **Timing-safe comparison** | Prevents timing attacks |
| **Rate limiting** | Max 1 OTP request per minute |
| **Attempt limiting** | Max 3 verification attempts |
| **Expiration** | OTPs expire after 5 minutes |
| **Cleanup** | Old OTPs automatically deleted |

---

## Development Mode

When `NODE_ENV=development` or Twilio credentials are not configured:

1. **OTP codes are logged to console** (not sent via SMS)
2. **Bypass code `123456` always works**

Example console output:
```
🔐 DEV MODE OTP for +18199685685: 847293 (or use 123456)
```

### Force Real SMS in Development

To test real SMS in development:

```bash
# Set credentials AND set this:
NODE_ENV=production
```

### Allow Dev Bypass in Staging

For staging environments that use real SMS but also need test access:

```bash
ALLOW_DEV_OTP=true
```

This allows `123456` to work alongside real OTPs.

---

## SMS Costs

| Destination | Cost per SMS |
|-------------|-------------|
| United States (+1) | ~$0.0079 |
| Canada (+1) | ~$0.0079 |
| Argentina (+54) | ~$0.073 |
| Mexico (+52) | ~$0.037 |

**Estimated monthly cost** (100 users, avg 2 logins/month):
- US users: ~$1.60
- Argentina users: ~$14.60

---

## Twilio Trial Limitations

With a **trial account**:
- Can only send SMS to verified numbers
- Messages prefixed with "Sent from a Twilio trial account"
- $15.50 free credit

To test with unverified numbers, **upgrade to a paid account**.

### Add Verified Numbers (Trial)

1. Go to Twilio Console > **Phone Numbers** > **Verified Caller IDs**
2. Click **Add a new Caller ID**
3. Enter the phone number
4. Verify via call or SMS

---

## Troubleshooting

### "Twilio credentials not configured"

**Cause**: Missing environment variables

**Solution**: Add all three variables:
```bash
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
```

### "Unable to create record: The number +XX is unverified"

**Cause**: Trial account can only send to verified numbers

**Solution**:
1. Add the number to Verified Caller IDs, OR
2. Upgrade to a paid Twilio account

### "Invalid phone number format"

**Cause**: Phone number not in E.164 format

**Solution**: Use format `+[country code][number]`
- US: `+18199685685`
- Argentina: `+5491155551001`

### OTP not received

**Check**:
1. Twilio Console > Messaging > Logs
2. Verify number is SMS-capable
3. Check spam/blocked messages on phone
4. Verify the phone number format

---

## Code Reference

| File | Purpose |
|------|---------|
| `apps/web/lib/sms.ts` | Twilio provider + console fallback |
| `apps/web/lib/otp.ts` | OTP generation, storage, verification |
| `apps/web/app/api/auth/otp/request/route.ts` | Request OTP API |
| `apps/web/app/api/auth/otp/verify/route.ts` | Verify OTP API |
| `apps/web/prisma/schema.prisma` | OtpCode model definition |

---

## Alternative SMS Providers

The `SMSProvider` interface in `lib/sms.ts` can be implemented for other providers:

```typescript
export interface SMSProvider {
  sendSMS(to: string, message: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}
```

Potential alternatives:
- AWS SNS
- MessageBird
- Vonage/Nexmo
- Local providers (Claro, Movistar APIs)

To switch providers, create a new class implementing `SMSProvider` and update `getSMSProvider()`.
