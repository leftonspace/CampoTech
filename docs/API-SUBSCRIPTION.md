# CampoTech Subscription API Documentation

This document describes the API endpoints for subscription management, verification, and billing.

## Authentication

All API endpoints require authentication via NextAuth session or API key.

```
Authorization: Bearer <session_token>
```

---

## Subscription Endpoints

### Get Current Subscription

```
GET /api/subscription
```

Returns the current organization's subscription details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "sub_123",
    "tier": "INICIAL",
    "status": "active",
    "currentPeriodStart": "2024-01-01T00:00:00Z",
    "currentPeriodEnd": "2024-01-31T00:00:00Z",
    "trialEndsAt": null,
    "cancelAtPeriodEnd": false
  }
}
```

### Get Trial Status

```
GET /api/subscription/trial
```

Returns trial status for the current organization.

**Response:**
```json
{
  "success": true,
  "data": {
    "isActive": true,
    "daysRemaining": 7,
    "trialEndsAt": "2024-01-15T00:00:00Z",
    "isExpiringSoon": true,
    "isExpired": false
  }
}
```

### Upgrade Subscription

```
POST /api/subscription/upgrade
```

Upgrade to a higher tier with proration.

**Request Body:**
```json
{
  "newTier": "PROFESIONAL"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "proratedAmount": 15000,
    "paymentUrl": "https://mercadopago.com/checkout/..."
  }
}
```

### Downgrade Subscription

```
POST /api/subscription/downgrade
```

Schedule downgrade at end of current period.

**Request Body:**
```json
{
  "newTier": "INICIAL"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scheduledTier": "INICIAL",
    "effectiveDate": "2024-02-01T00:00:00Z",
    "message": "Tu plan cambiará al final del período actual"
  }
}
```

### Cancel Subscription

```
POST /api/subscription/cancel
```

Cancel subscription with optional refund.

**Request Body:**
```json
{
  "reason": "too_expensive"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cancelledAt": "2024-01-15T00:00:00Z",
    "refundEligible": true,
    "refundAmount": 25000,
    "effectiveDate": "2024-01-15T00:00:00Z"
  }
}
```

---

## Payment Endpoints

### Get Payment History

```
GET /api/payments
```

**Query Parameters:**
- `status`: Filter by status (completed, failed, pending, refunded)
- `limit`: Number of results (default: 20)
- `offset`: Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pay_123",
      "amount": 25000,
      "currency": "ARS",
      "status": "completed",
      "paidAt": "2024-01-01T00:00:00Z",
      "invoiceUrl": "https://..."
    }
  ],
  "meta": {
    "total": 12,
    "limit": 20,
    "offset": 0
  }
}
```

### Check Refund Eligibility

```
GET /api/payments/:paymentId/refund-eligibility
```

**Response:**
```json
{
  "success": true,
  "data": {
    "eligible": true,
    "daysRemaining": 5,
    "isLey24240": true,
    "maxRefundAmount": 25000
  }
}
```

---

## Verification Endpoints

### Get Verification Status

```
GET /api/verification/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overallStatus": "in_review",
    "tier2Complete": false,
    "documents": [
      {
        "type": "cuit",
        "status": "approved",
        "submittedAt": "2024-01-01T00:00:00Z"
      },
      {
        "type": "dni_front",
        "status": "review",
        "submittedAt": "2024-01-02T00:00:00Z"
      }
    ],
    "pendingDocuments": ["dni_back", "selfie"],
    "canReceiveJobs": false
  }
}
```

### Submit Document

```
POST /api/verification/documents
```

**Request Body (multipart/form-data):**
- `documentType`: cuit, dni_front, dni_back, selfie, driver_license, insurance
- `file`: Document file (JPG, PNG, PDF)

**Response:**
```json
{
  "success": true,
  "data": {
    "documentId": "doc_123",
    "status": "pending",
    "message": "Documento recibido. Será revisado en 24-48 horas."
  }
}
```

### Validate CUIT

```
POST /api/verification/cuit
```

**Request Body:**
```json
{
  "cuit": "30-71659554-9"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "type": "persona_juridica",
    "name": "Company SA",
    "afipStatus": "ACTIVO"
  }
}
```

---

## Webhook Endpoints

### MercadoPago Webhook

```
POST /api/webhooks/mercadopago
```

Receives payment notifications from MercadoPago.

**Headers:**
- `x-signature`: HMAC signature for validation

**Events Handled:**
- `payment.created`
- `payment.updated`
- `subscription_preapproval.created`
- `subscription_preapproval.updated`

---

## Cron Endpoints

### Trial Expiration Check

```
POST /api/cron/subscription
Authorization: Bearer <CRON_SECRET>
```

**Query Parameters:**
- `job`: trial-expiring, trial-expired, block-escalation, all

**Response:**
```json
{
  "success": true,
  "job": "all",
  "results": {
    "trialExpiring": {
      "processed": 5,
      "notified": 5
    },
    "trialExpired": {
      "processed": 2,
      "blocked": 2
    }
  }
}
```

### Verification Cron

```
POST /api/cron/verification
Authorization: Bearer <CRON_SECRET>
```

**Query Parameters:**
- `job`: document-expiring, document-expired, afip-revalidation, all

---

## Notification Endpoints

### Get Notifications

```
GET /api/notifications
```

**Query Parameters:**
- `unreadOnly`: true/false
- `limit`: Number of results

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "notif_123",
      "type": "trial_expiring",
      "title": "Tu prueba vence pronto",
      "message": "Te quedan 3 días de prueba",
      "read": false,
      "createdAt": "2024-01-12T00:00:00Z"
    }
  ],
  "unreadCount": 5
}
```

### Mark as Read

```
PUT /api/notifications/:id/read
```

### Update Preferences

```
PUT /api/notifications/preferences
```

**Request Body:**
```json
{
  "trialExpiringEmail": true,
  "documentExpiringEmail": true,
  "paymentFailedEmail": true,
  "marketingEmail": false
}
```

---

## Admin Endpoints

### Get Dashboard Metrics

```
GET /api/admin/dashboard/metrics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "subscriptions": {
        "total": 150,
        "byTier": { "FREE": 50, "INICIAL": 80, "PROFESIONAL": 18, "EMPRESA": 2 },
        "conversionRate": 45.5
      },
      "verification": {
        "verified": 100,
        "pending": 30,
        "completionRate": 66.7
      },
      "payments": {
        "totalRevenue": 5000000,
        "failureRate": 2.5
      }
    },
    "health": {
      "status": "healthy",
      "services": { ... }
    }
  }
}
```

### Pending Verifications

```
GET /api/admin/verifications/pending
```

### Approve Verification

```
POST /api/admin/verifications/:id/approve
```

### Reject Verification

```
POST /api/admin/verifications/:id/reject
```

**Request Body:**
```json
{
  "reason": "Image is blurry and text is not readable"
}
```

### Process Manual Refund

```
POST /api/admin/payments/:id/refund
```

**Request Body:**
```json
{
  "reason": "Customer request",
  "amount": 25000
}
```

### Override Block

```
POST /api/admin/organizations/:id/unblock
```

**Request Body:**
```json
{
  "reason": "Customer paid via bank transfer"
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_FAILED",
    "message": "No pudimos procesar tu pago",
    "suggestion": "Verificá los datos de tu tarjeta e intentá de nuevo"
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid request data |
| `PAYMENT_FAILED` | Payment processing failed |
| `PAYMENT_DECLINED` | Payment was declined |
| `CUIT_DUPLICATE` | CUIT already registered |
| `TRIAL_EXPIRED` | Trial period has ended |
| `BLOCKED` | Account is blocked |

---

## Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| General API | 100 requests/minute |
| Payment endpoints | 20 requests/minute |
| Verification uploads | 10 requests/minute |
| Webhook endpoints | 1000 requests/minute |

Exceeded rate limits return:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "retryAfter": 60
  }
}
```
