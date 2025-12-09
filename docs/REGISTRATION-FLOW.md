# Self-Registration Flow

This document describes the business self-registration flow for CampoTech.

## Overview

CampoTech allows businesses to self-register through a 3-step process:
1. Enter business information (CUIT, business name, admin name)
2. Enter phone number and receive OTP
3. Verify OTP to complete registration

## Flow Diagram

```
User visits /signup
      │
      ▼
┌─────────────────┐
│  Step 1: Info   │
│  - CUIT         │
│  - Business name│
│  - Admin name   │
│  - Email (opt)  │
└────────┬────────┘
         │ Client-side validation
         ▼
┌─────────────────┐
│  Step 2: Phone  │
│  - Phone number │
└────────┬────────┘
         │ POST /api/auth/register
         ▼
┌─────────────────────────────────────────┐
│  Server validates:                      │
│  - CUIT format + verification digit     │
│  - CUIT not already registered          │
│  - Phone not already registered         │
│  - Creates PendingRegistration          │
│  - Sends OTP via SMS/console            │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Step 3: OTP    │
│  - Enter code   │
└────────┬────────┘
         │ POST /api/auth/register/verify
         ▼
┌─────────────────────────────────────────┐
│  Server:                                │
│  - Verifies OTP                         │
│  - Creates Organization                 │
│  - Creates Admin User                   │
│  - Deletes PendingRegistration          │
│  - Returns JWT tokens                   │
└────────┬────────────────────────────────┘
         │
         ▼
   Dashboard
```

## API Endpoints

### POST /api/auth/register

Creates a pending registration and sends OTP.

**Request:**
```json
{
  "cuit": "20-12345678-9",
  "businessName": "Mi Empresa SRL",
  "adminName": "Juan Pérez",
  "phone": "+5491155551234",
  "email": "juan@miempresa.com"  // optional
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "sent": true,
    "devMode": false,
    "expiresInMinutes": 15
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": {
    "message": "Ya existe una empresa registrada con este CUIT",
    "field": "cuit"
  }
}
```

### POST /api/auth/register/verify

Verifies OTP and completes registration.

**Request:**
```json
{
  "phone": "+5491155551234",
  "code": "123456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "user_...",
      "name": "Juan Pérez",
      "email": "juan@miempresa.com",
      "phone": "+5491155551234",
      "role": "ADMIN",
      "organization": {
        "id": "org_...",
        "name": "Mi Empresa SRL"
      }
    },
    "isNewUser": true
  }
}
```

## Database Models

### PendingRegistration

Stores registration data until OTP verification completes.

```prisma
model PendingRegistration {
  id           String   @id @default(cuid())
  phone        String   @unique
  cuit         String
  businessName String
  adminName    String
  email        String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  @@index([phone])
  @@index([cuit])
  @@index([expiresAt])
  @@map("pending_registrations")
}
```

## CUIT Validation

Argentine CUIT (Clave Única de Identificación Tributaria) is validated using:

1. **Length**: Must be exactly 11 digits
2. **Prefix**: Must start with valid type identifier:
   - `20, 23, 24, 27`: Persona física (individual)
   - `30, 33, 34`: Persona jurídica (company)
3. **Verification digit**: Calculated using mod-11 algorithm

## Security Considerations

| Feature | Implementation |
|---------|----------------|
| **Input validation** | All inputs sanitized and validated |
| **CUIT validation** | Proper mod-11 verification algorithm |
| **Rate limiting** | 1 OTP request per minute (via OTP service) |
| **Attempt limiting** | 3 failed OTP attempts max |
| **Registration expiry** | 15 minutes to complete registration |
| **OTP expiry** | 5 minutes |
| **Duplicate prevention** | CUIT and phone uniqueness checks |
| **Race condition protection** | Double-check before creation |
| **Transaction safety** | Org + User created in DB transaction |
| **OTP storage** | SHA-256 hashed |
| **Timing attacks** | Timing-safe comparison for OTP |

## SQL Migration

To add the `pending_registrations` table:

```sql
CREATE TABLE IF NOT EXISTS "pending_registrations" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "email" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pending_registrations_phone_key" ON "pending_registrations"("phone");
CREATE INDEX "pending_registrations_phone_idx" ON "pending_registrations"("phone");
CREATE INDEX "pending_registrations_cuit_idx" ON "pending_registrations"("cuit");
CREATE INDEX "pending_registrations_expiresAt_idx" ON "pending_registrations"("expiresAt");
```

## Testing

### Manual Test Steps

1. Go to `/signup`
2. Enter valid CUIT (e.g., `20-12345678-9`)
3. Enter business name
4. Enter your name
5. Click Continue
6. Enter phone number
7. Click "Enviar código"
8. In dev mode: use code `123456`
9. In production: check SMS for code
10. Enter code and click "Crear cuenta"
11. Should redirect to `/dashboard`

### Test CUIT Numbers

Valid test CUITs (pass validation):
- `20-12345678-9`
- `30-71234567-9`
- `27-12345678-3`

### Error Cases to Test

1. Invalid CUIT format (< 11 digits)
2. Invalid CUIT verification digit
3. Duplicate CUIT registration
4. Duplicate phone registration
5. Expired registration
6. Wrong OTP code
7. Too many OTP attempts
8. Rate limited OTP requests
