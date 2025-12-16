# Environment Variables

Complete documentation of all environment variables for the CampoTech web application.

## Quick Start

1. Copy `.env.example` to `.env.local`
2. Fill in required variables (marked with ✅)
3. Configure optional services as needed

---

## Required Variables

### Database

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Supabase) |

```bash
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

### Authentication

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | ✅ | Secret key for JWT token signing (min 32 chars) |
| `NEXTAUTH_SECRET` | ✅ | NextAuth.js secret key (can be same as JWT_SECRET) |

```bash
# Generate with: openssl rand -base64 32
JWT_SECRET="your-super-secret-key-min-32-characters"
NEXTAUTH_SECRET="your-nextauth-secret-key"
```

### Application

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | ✅ | Public URL of the application |
| `NODE_ENV` | ✅ | Environment: `development`, `production`, or `test` |

```bash
NEXT_PUBLIC_APP_URL="https://app.campotech.com"
NODE_ENV="production"
```

---

## SMS / OTP (Twilio)

Required for phone number verification and OTP delivery.

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | ✅ | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | ✅ | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | ✅ | Twilio phone number (with country code) |
| `ALLOW_DEV_OTP` | ❌ | Allow dev OTP bypass (only for staging) |

```bash
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_PHONE_NUMBER="+5491100000000"
```

**Development Note:** If `TWILIO_ACCOUNT_SID` is not set in development, OTP verification is bypassed with code "123456".

---

## Payment Processing (MercadoPago)

Required for subscription payments.

| Variable | Required | Description |
|----------|----------|-------------|
| `MERCADOPAGO_ACCESS_TOKEN` | ✅ | MP API Access Token (server-side) |
| `MERCADOPAGO_PUBLIC_KEY` | ✅ | MP Public Key (client-side) |
| `MP_WEBHOOK_SECRET` | ✅ | Webhook signature secret |
| `MP_PLAN_BASICO` | ❌ | MP Plan ID for Inicial tier |
| `MP_PLAN_PROFESIONAL` | ❌ | MP Plan ID for Profesional tier |
| `MP_PLAN_EMPRESARIAL` | ❌ | MP Plan ID for Empresa tier |

```bash
MERCADOPAGO_ACCESS_TOKEN="APP_USR-xxxxxxxx-xxxxxxxx"
MERCADOPAGO_PUBLIC_KEY="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
MP_WEBHOOK_SECRET="your-webhook-secret"
```

Get credentials from: https://www.mercadopago.com.ar/developers

---

## Electronic Invoicing (AFIP)

Required for issuing electronic invoices in Argentina.

| Variable | Required | Description |
|----------|----------|-------------|
| `AFIP_ENVIRONMENT` | ✅ | `production` or `homologation` (testing) |
| `AFIP_CERTIFICATE_BASE64` | ✅ | Base64-encoded .pfx certificate |
| `AFIP_CERTIFICATE_PASSWORD` | ✅ | Certificate password |

```bash
AFIP_ENVIRONMENT="homologation"
AFIP_CERTIFICATE_BASE64="base64-encoded-certificate"
AFIP_CERTIFICATE_PASSWORD="certificate-password"
```

**Note:** Start with `homologation` for testing, switch to `production` for live invoices.

---

## WhatsApp Business API

Required for WhatsApp messaging and AI assistant.

| Variable | Required | Description |
|----------|----------|-------------|
| `WHATSAPP_APP_SECRET` | ✅ | Meta App Secret (webhook validation) |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | ✅ | Webhook verification token |
| `WHATSAPP_PHONE_NUMBER_ID` | ❌ | Default phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | ❌ | Default access token |
| `WHATSAPP_API_VERSION` | ❌ | API version (default: v18.0) |

```bash
WHATSAPP_APP_SECRET="your-meta-app-secret"
WHATSAPP_WEBHOOK_VERIFY_TOKEN="your-random-verify-token"
WHATSAPP_API_VERSION="v18.0"
```

Get credentials from: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started

---

## Real-Time Updates (Pusher)

Required for live updates in the dashboard.

| Variable | Required | Description |
|----------|----------|-------------|
| `PUSHER_APP_ID` | ✅ | Pusher App ID |
| `PUSHER_KEY` | ✅ | Pusher API Key |
| `PUSHER_SECRET` | ✅ | Pusher Secret (server-side) |
| `PUSHER_CLUSTER` | ✅ | Pusher cluster (e.g., us2, eu) |
| `NEXT_PUBLIC_PUSHER_KEY` | ✅ | Same as PUSHER_KEY (client-side) |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | ✅ | Same as PUSHER_CLUSTER (client-side) |

```bash
PUSHER_APP_ID="1234567"
PUSHER_KEY="xxxxxxxxxxxxxxxxxxxx"
PUSHER_SECRET="xxxxxxxxxxxxxxxxxxxx"
PUSHER_CLUSTER="us2"
NEXT_PUBLIC_PUSHER_KEY="xxxxxxxxxxxxxxxxxxxx"
NEXT_PUBLIC_PUSHER_CLUSTER="us2"
```

Get credentials from: https://dashboard.pusher.com/

---

## Email (Resend)

Required for transactional emails (invoices, notifications).

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | ✅ | Resend API Key |
| `EMAIL_FROM` | ❌ | Sender email address |

```bash
RESEND_API_KEY="re_xxxxxxxxxxxx"
EMAIL_FROM="CampoTech <noreply@campotech.com>"
```

Get API key from: https://resend.com/

---

## Maps & Geocoding (Google Maps)

Required for address autocomplete and map display.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | ✅ | Google Maps API Key |
| `GOOGLE_MAPS_API_KEY` | ❌ | Server-side API Key (if different) |

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Required APIs:**
- Places API (New)
- Maps JavaScript API
- Directions API (for route optimization)

Get credentials from: https://console.cloud.google.com/apis/credentials

---

## Voice AI (OpenAI)

Optional for voice report transcription.

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ❌ | OpenAI API Key |

```bash
OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
```

Get API key from: https://platform.openai.com/api-keys

---

## Background Jobs (Redis)

Required for queue processing.

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_URL` | ✅ | Redis connection URL |

```bash
REDIS_URL="redis://default:password@host:6379"
```

---

## Cron Jobs

| Variable | Required | Description |
|----------|----------|-------------|
| `CRON_SECRET` | ✅ | Secret for authenticating cron endpoints |

```bash
CRON_SECRET="your-random-cron-secret"
```

---

## Alternative Map Provider (Mapbox)

Optional alternative to Google Maps.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | ❌ | Mapbox Access Token |

```bash
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="pk.xxxxxxxxxxxxxxxxxxxx"
```

---

## Environment-Specific Notes

### Development
- `NODE_ENV="development"`
- Can use test phone numbers with Twilio
- AFIP homologation environment recommended
- Missing `TWILIO_ACCOUNT_SID` allows OTP bypass with "123456"
- Missing `RESEND_API_KEY` logs emails to console

### Production
- `NODE_ENV="production"`
- All ✅ required variables must be set
- Use production credentials for all services
- Enable HTTPS for `NEXT_PUBLIC_APP_URL`
- Never set `ALLOW_DEV_OTP="true"`

### Testing
- `NODE_ENV="test"`
- Use test/sandbox credentials where available
- Database can point to test database

---

## Security Best Practices

1. **Never commit** `.env.local` or any file containing secrets
2. **Use strong secrets** - generate with `openssl rand -base64 32`
3. **Rotate secrets** periodically, especially after team changes
4. **Restrict API keys** - use IP restrictions and domain restrictions where possible
5. **Use separate keys** for development and production
6. **Monitor usage** - set up alerts for unusual API usage

---

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` format
- Check if IP is whitelisted in Supabase
- Ensure using pooled connection string for production

### Authentication Failures
- Verify `JWT_SECRET` is at least 32 characters
- Check `NEXTAUTH_SECRET` is set
- Verify cookies are being set correctly

### WhatsApp Not Working
- Verify webhook URL is publicly accessible
- Check `WHATSAPP_WEBHOOK_VERIFY_TOKEN` matches Meta dashboard
- Verify `WHATSAPP_APP_SECRET` for signature validation
