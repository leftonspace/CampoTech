# CampoTech Security Architecture

**Version:** 1.0
**Last Updated:** December 2024
**Phase:** 9.11 Technical Architecture Documentation

## Overview

This document describes the security architecture and patterns used in CampoTech to protect user data, ensure system integrity, and maintain compliance with Argentine data protection regulations.

## Security Layers

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  PERIMETER SECURITY                                                     │   │
│   │  ├── HTTPS/TLS 1.3 everywhere                                           │   │
│   │  ├── CDN-level DDoS protection (Cloudflare/Vercel)                     │   │
│   │  ├── Geographic access controls                                         │   │
│   │  └── WAF rules for common attacks                                       │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                     │                                            │
│                                     ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  API GATEWAY SECURITY                                                   │   │
│   │  ├── Rate limiting (per user, per org, per IP)                         │   │
│   │  ├── Request validation (Zod schemas)                                   │   │
│   │  ├── Webhook signature verification                                     │   │
│   │  └── Input sanitization                                                 │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                     │                                            │
│                                     ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  APPLICATION SECURITY                                                   │   │
│   │  ├── Authentication (OTP-based, JWT)                                    │   │
│   │  ├── Authorization (RBAC, 5 roles)                                      │   │
│   │  ├── Session management (Redis)                                         │   │
│   │  └── CSRF protection                                                    │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                     │                                            │
│                                     ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  DATA SECURITY                                                          │   │
│   │  ├── Row-Level Security (RLS)                                           │   │
│   │  ├── Encryption at rest (AES-256-GCM)                                   │   │
│   │  ├── Field-level encryption (sensitive data)                            │   │
│   │  └── Audit logging with hash chain                                      │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Authentication

### OTP-Based Authentication (WhatsApp/SMS)

```typescript
// Authentication flow
interface OTPAuthFlow {
  // 1. Request OTP
  requestOTP(phone: string): Promise<void>;

  // 2. Verify OTP
  verifyOTP(phone: string, code: string): Promise<AuthTokens>;

  // 3. Refresh tokens
  refreshTokens(refreshToken: string): Promise<AuthTokens>;
}

// OTP Configuration
const OTP_CONFIG = {
  length: 6,                    // 6-digit codes
  expiryMinutes: 5,            // 5-minute validity
  maxAttempts: 3,              // Max verification attempts
  cooldownMinutes: 60,         // Cooldown after max attempts
  channel: 'whatsapp',         // Primary: WhatsApp
  fallback: 'sms'              // Fallback: SMS
};
```

**Key Files:**
- `apps/web/app/api/auth/otp/route.ts` - OTP request endpoint
- `apps/web/app/api/auth/verify/route.ts` - OTP verification
- `src/lib/auth/otp.service.ts` - OTP generation and storage

### JWT Token Management

```typescript
// Token configuration
const TOKEN_CONFIG = {
  accessToken: {
    expiresIn: '15m',           // 15 minutes
    algorithm: 'HS256'
  },
  refreshToken: {
    expiresIn: '7d',            // 7 days
    algorithm: 'HS256'
  }
};

// Token payload
interface TokenPayload {
  userId: string;
  organizationId: string;
  role: UserRole;
  sessionId: string;
  iat: number;
  exp: number;
}
```

**Security Measures:**
- Tokens stored in HTTP-only cookies
- Refresh token rotation on use
- Session invalidation on logout
- Device fingerprinting for anomaly detection

## Authorization

### Role-Based Access Control (RBAC)

```typescript
enum UserRole {
  OWNER = 'owner',           // Full access, billing
  ADMIN = 'admin',           // Management, no billing
  DISPATCHER = 'dispatcher', // Scheduling, assignments
  TECHNICIAN = 'technician', // Field work, own jobs
  READONLY = 'readonly'      // View-only access
}

// Permission matrix
const PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: ['*'],  // All permissions
  admin: [
    'jobs:*', 'customers:*', 'invoices:*',
    'users:read', 'users:write', 'reports:*'
  ],
  dispatcher: [
    'jobs:read', 'jobs:assign', 'jobs:schedule',
    'customers:read', 'users:read'
  ],
  technician: [
    'jobs:read:own', 'jobs:update:own',
    'customers:read', 'tracking:*'
  ],
  readonly: [
    'jobs:read', 'customers:read', 'invoices:read'
  ]
};
```

**Key Files:**
- `src/lib/auth/rbac.ts` - Permission definitions
- `src/lib/middleware/authorize.ts` - Authorization middleware

### Resource-Level Authorization

```typescript
// Check ownership for technician access
async function canAccessJob(userId: string, jobId: string): Promise<boolean> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { assignedToId: true, organizationId: true }
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, organizationId: true }
  });

  // Same organization required
  if (job.organizationId !== user.organizationId) {
    return false;
  }

  // Technicians can only access assigned jobs
  if (user.role === 'technician') {
    return job.assignedToId === userId;
  }

  return true;
}
```

## Data Security

### Row-Level Security (RLS)

All database tables implement organization-scoped RLS:

```sql
-- Example: Jobs table RLS policy
CREATE POLICY jobs_organization_isolation ON jobs
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Enable RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Set organization context for each request
SET app.current_organization_id = '${organizationId}';
```

**Tables with RLS:**
- users
- jobs
- customers
- invoices
- tracking_sessions
- notification_logs
- audit_logs

### Encryption

#### At-Rest Encryption

```typescript
// Sensitive field encryption
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  tagLength: 16
};

// Encrypted fields
const ENCRYPTED_FIELDS = [
  'afip_certificate',      // AFIP certificates
  'mercadopago_credentials', // Payment credentials
  'refresh_tokens',        // Session refresh tokens
  'cuit',                  // Tax identification (PII)
  'customer_phone'         // Customer phone numbers
];
```

#### In-Transit Encryption

- All connections use TLS 1.3
- Certificate pinning on mobile app
- HSTS enabled with 1-year max-age

### Audit Logging

```typescript
// Audit log structure
interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  organizationId: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  changes: Record<string, { old: any; new: any }>;
  ipAddress: string;
  userAgent: string;
  previousHash: string;  // Hash chain
  hash: string;          // Current entry hash
}

// Immutable audit logging
async function logAudit(entry: Omit<AuditLog, 'hash' | 'previousHash'>) {
  const lastLog = await prisma.auditLog.findFirst({
    orderBy: { timestamp: 'desc' }
  });

  const previousHash = lastLog?.hash || 'genesis';
  const hash = createHash('sha256')
    .update(JSON.stringify({ ...entry, previousHash }))
    .digest('hex');

  await prisma.auditLog.create({
    data: { ...entry, previousHash, hash }
  });
}
```

**Key Files:**
- `src/modules/audit/audit.service.ts` - Audit logging service
- `database/migrations/007_create_audit_logs.sql` - Audit table schema

## API Security

### Rate Limiting

```typescript
// Rate limit configuration
const RATE_LIMITS = {
  // Per-user limits
  user: {
    requests: 100,
    window: '1m'
  },
  // Per-organization limits
  organization: {
    requests: 1000,
    window: '1m'
  },
  // Per-IP limits (unauthenticated)
  ip: {
    requests: 20,
    window: '1m'
  },
  // Specific endpoint limits
  endpoints: {
    '/api/auth/otp': { requests: 5, window: '15m' },
    '/api/invoices': { requests: 30, window: '1m' },
    '/api/whatsapp/send': { requests: 100, window: '1h' }
  }
};
```

**Implementation:**
- Redis-based sliding window
- Response headers: `X-RateLimit-*`
- 429 response with `Retry-After`

### Webhook Signature Verification

```typescript
// WhatsApp webhook signature verification
function verifyWebhookSignature(
  signature: string,
  body: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}

// MercadoPago webhook verification
function verifyMercadoPagoSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  secret: string
): boolean {
  // Parse x-signature header
  const parts = xSignature.split(',');
  const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1];
  const v1 = parts.find(p => p.startsWith('v1='))?.split('=')[1];

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expectedHmac = createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  return timingSafeEqual(Buffer.from(v1), Buffer.from(expectedHmac));
}
```

### Input Validation

```typescript
// Zod schema validation example
import { z } from 'zod';

const CreateJobSchema = z.object({
  customerId: z.string().uuid(),
  serviceType: z.enum(['installation', 'repair', 'maintenance']),
  scheduledStart: z.string().datetime(),
  address: z.string().min(5).max(200),
  notes: z.string().max(1000).optional(),
  // Prevent injection
  priority: z.number().int().min(1).max(5)
}).strict();  // Reject unknown fields

// Middleware usage
async function validateRequest(
  schema: z.ZodSchema,
  data: unknown
): Promise<z.infer<typeof schema>> {
  return schema.parseAsync(data);
}
```

## Security Headers

```typescript
// Security headers configuration
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.whatsapp.com https://*.mercadopago.com",
    "frame-ancestors 'none'"
  ].join('; '),
  'Permissions-Policy': 'geolocation=(self), camera=(self), microphone=(self)'
};
```

## Secret Management

### Environment Variables

```bash
# Required secrets (never commit to git)
DATABASE_URL=             # PostgreSQL connection
REDIS_URL=               # Redis connection
JWT_SECRET=              # JWT signing key
ENCRYPTION_KEY=          # AES-256 key (32 bytes, base64)

# External service credentials
WHATSAPP_TOKEN=          # Meta Business API
WHATSAPP_VERIFY_TOKEN=   # Webhook verification
MERCADOPAGO_ACCESS_TOKEN=
OPENAI_API_KEY=
AFIP_CERTIFICATE=        # Base64 encoded
AFIP_PRIVATE_KEY=        # Base64 encoded
```

### Secret Rotation

| Secret | Rotation Period | Process |
|--------|-----------------|---------|
| JWT_SECRET | 90 days | Deploy new, grace period for old |
| ENCRYPTION_KEY | 180 days | Re-encrypt affected data |
| API tokens | Per provider | Update in secure vault |
| AFIP certificates | 2 years | AFIP renewal process |

## Incident Response

### Security Events

```typescript
// Security event types
enum SecurityEvent {
  FAILED_LOGIN_ATTEMPT = 'failed_login',
  RATE_LIMIT_EXCEEDED = 'rate_limit',
  INVALID_SIGNATURE = 'invalid_signature',
  UNAUTHORIZED_ACCESS = 'unauthorized',
  SUSPICIOUS_ACTIVITY = 'suspicious',
  DATA_EXPORT = 'data_export'
}

// Alert thresholds
const ALERT_THRESHOLDS = {
  [SecurityEvent.FAILED_LOGIN_ATTEMPT]: 5,  // Per 15 min
  [SecurityEvent.RATE_LIMIT_EXCEEDED]: 10,  // Per hour
  [SecurityEvent.UNAUTHORIZED_ACCESS]: 1,   // Immediate
  [SecurityEvent.SUSPICIOUS_ACTIVITY]: 1    // Immediate
};
```

### Panic Mode

```typescript
// Emergency security measures
async function activatePanicMode(reason: string): Promise<void> {
  // 1. Invalidate all sessions
  await redis.flushAll();

  // 2. Disable external integrations
  await disableWebhooks();

  // 3. Alert administrators
  await sendAdminAlert({
    type: 'PANIC_MODE_ACTIVATED',
    reason,
    timestamp: new Date()
  });

  // 4. Log incident
  await logSecurityIncident(reason);
}
```

## Compliance

### Argentine Data Protection (Ley 25.326)

- Personal data processing with user consent
- Right to access, rectify, delete personal data
- Data export functionality
- Data retention policies documented
- Cross-border transfer restrictions

### PCI-DSS Considerations

- No direct card data storage
- MercadoPago handles payment processing
- Tokenized payment references only

## Security Checklist

### Pre-Deployment

- [ ] All secrets in environment variables
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] RLS enabled on all tables
- [ ] Audit logging functional
- [ ] Webhook signatures verified

### Regular Audits

- [ ] Monthly: Review access logs
- [ ] Quarterly: Penetration testing
- [ ] Semi-annually: Dependency audit (npm audit)
- [ ] Annually: Security architecture review

## Related Documentation

- [High-Level Architecture](./high-level-architecture.md)
- [Data Flow](./data-flow.md)
- [Integration Patterns](./integration-patterns.md)
