# CampoTech Security Guidelines

## Overview

This document outlines security best practices and implementation details for the CampoTech platform.

## Authentication & Authorization

### JWT Token Management

```typescript
// Token configuration
{
  accessToken: {
    expiresIn: '15m',  // Short-lived access tokens
    algorithm: 'RS256' // Asymmetric signing
  },
  refreshToken: {
    expiresIn: '7d',
    rotateOnUse: true  // Rotation on refresh
  }
}
```

**Best Practices:**
- Access tokens expire in 15 minutes
- Refresh tokens rotate on each use
- Tokens are stored in httpOnly cookies
- Mobile apps use secure storage (Keychain/Keystore)

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| ADMIN | Full access to all resources |
| DISPATCHER | Manage jobs, view technicians, manage customers |
| TECHNICIAN | View/update assigned jobs, view customer contact info |

### Row-Level Security (RLS)

All database queries are scoped by organization:

```sql
-- Example RLS policy
CREATE POLICY org_isolation ON jobs
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

## Input Validation

### Required Validation

All user input MUST be validated using Zod schemas:

```typescript
import { createJobSchema } from '@/validation/schemas';

// In controller
const validated = createJobSchema.parse(req.body);
```

### Sanitization Rules

1. **HTML Escaping**: All string inputs are escaped
2. **SQL Injection**: Prevented by Prisma ORM
3. **NoSQL Injection**: $ prefixed keys are stripped
4. **Path Traversal**: File paths are validated
5. **XSS**: CSP headers + output encoding

## API Security

### Rate Limiting

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Standard API | 100 | 1 minute |
| Authentication | 10 | 15 minutes |
| Webhooks | 500 | 1 minute |
| File Upload | 10 | 1 minute |

### CORS Configuration

```typescript
allowedOrigins: [
  'https://app.campotech.com.ar',
  'https://staging.campotech.com.ar',
  'https://admin.campotech.com.ar'
]
```

### Security Headers

Implemented via Helmet.js:
- Content-Security-Policy
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security
- X-XSS-Protection

## Data Protection

### Sensitive Data Handling

| Data Type | Storage | Transmission |
|-----------|---------|--------------|
| Passwords | bcrypt hash (cost 12) | HTTPS only |
| API Keys | Encrypted at rest | Never in logs |
| PII | Encrypted columns | TLS 1.3 |
| Tokens | Redis with TTL | httpOnly cookies |

### Data Retention

- Audit logs: 2 years
- Job data: 5 years
- Customer data: Until deletion request
- Voice recordings: 90 days

### GDPR Compliance

- Right to access: `/api/users/me/data-export`
- Right to deletion: `/api/users/me/delete`
- Data portability: JSON export available

## Infrastructure Security

### Network Security

```
Internet → CloudFlare (WAF) → ALB → VPC (Private Subnets)
                                    ├── API Servers
                                    ├── Database (RDS)
                                    └── Redis (ElastiCache)
```

### Database Security

- **Encryption**: RDS encryption at rest (AES-256)
- **Network**: Private subnet only, no public access
- **Access**: IAM authentication for applications
- **Backups**: Automated daily backups, 7-day retention

### Secret Management

All secrets stored in AWS Secrets Manager:
- Database credentials
- API keys (OpenAI, WhatsApp)
- JWT signing keys
- Encryption keys

## Logging & Monitoring

### Audit Logging

All security-relevant events are logged:

```typescript
interface AuditLog {
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failure';
  details?: Record<string, unknown>;
}
```

### Sensitive Data Redaction

```typescript
// Automatically redacted fields
const REDACTED_FIELDS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'authorization',
  'cookie'
];
```

### Alert Triggers

- Failed login attempts > 5 in 5 minutes
- API errors > 1% of requests
- Response time > 2 seconds (p95)
- Unusual traffic patterns
- Database connection failures

## Vulnerability Management

### Dependency Scanning

```bash
# Run weekly
pnpm audit --audit-level=high

# Automated via GitHub Actions
trivy fs --severity HIGH,CRITICAL .
```

### Security Updates

- Critical: Within 24 hours
- High: Within 7 days
- Medium: Within 30 days
- Low: Next release cycle

### Penetration Testing

- Frequency: Quarterly
- Scope: Full application + infrastructure
- Provider: External security firm

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 | Data breach, system down | 15 minutes |
| P2 | Security vulnerability exploited | 1 hour |
| P3 | Potential vulnerability discovered | 24 hours |
| P4 | Security improvement needed | 1 week |

### Response Process

1. **Detect**: Automated monitoring + manual reports
2. **Contain**: Isolate affected systems
3. **Investigate**: Root cause analysis
4. **Remediate**: Fix vulnerability
5. **Recover**: Restore normal operations
6. **Learn**: Post-mortem and documentation

## Developer Guidelines

### Secure Coding Checklist

- [ ] All inputs validated with Zod schemas
- [ ] No secrets in code or logs
- [ ] Parameterized queries only
- [ ] Authentication required for all endpoints
- [ ] Authorization checks on resources
- [ ] Rate limiting applied
- [ ] Error messages don't leak information
- [ ] HTTPS enforced
- [ ] Content-Type headers set correctly

### Code Review Security Checklist

- [ ] No hardcoded credentials
- [ ] Input validation present
- [ ] Output encoding applied
- [ ] Access control verified
- [ ] Logging appropriate (no PII)
- [ ] Dependencies up to date
- [ ] No dangerous functions used

## Compliance

### Standards

- **OWASP Top 10**: All vulnerabilities addressed
- **PCI DSS**: Not applicable (no direct card processing)
- **LGPD/GDPR**: Data protection measures implemented

### Regular Audits

- Monthly: Dependency vulnerability scan
- Quarterly: Penetration testing
- Annually: Full security audit
