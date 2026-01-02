# CampoTech Production Configuration Checklist

This checklist ensures all production configurations are properly set before launch.

## MercadoPago Integration

### Production Credentials
- [ ] Production access token configured (`MP_ACCESS_TOKEN`)
- [ ] Production public key configured (`NEXT_PUBLIC_MP_PUBLIC_KEY`)
- [ ] Sandbox mode disabled (`MP_SANDBOX=false`)

### Webhook Configuration
- [ ] Production webhook URL registered in MercadoPago dashboard
  - URL: `https://app.campotech.com.ar/api/webhooks/mercadopago`
- [ ] Webhook signature secret configured (`MP_WEBHOOK_SECRET`)
- [ ] Webhook events enabled:
  - [ ] `payment.created`
  - [ ] `payment.updated`
  - [ ] `subscription_preapproval.created`
  - [ ] `subscription_preapproval.updated`

### Subscription Plans
- [ ] INICIAL plan created ($25,000 ARS/month)
  - Plan ID: `plan_inicial`
  - Description: "Plan Inicial - CampoTech"
- [ ] PROFESIONAL plan created ($55,000 ARS/month)
  - Plan ID: `plan_profesional`
  - Description: "Plan Profesional - CampoTech"
- [ ] EMPRESA plan created ($120,000 ARS/month)
  - Plan ID: `plan_empresa`
  - Description: "Plan Empresa - CampoTech"

### Payment Testing
- [ ] Test payment flow with real card in sandbox
- [ ] Test refund flow
- [ ] Test subscription creation
- [ ] Test subscription cancellation
- [ ] Verify webhook signature validation works

---

## AFIP Integration

### Production Certificates
- [ ] Production CUIT certificates obtained from AFIP
- [ ] Certificates configured in environment
  - [ ] `AFIP_CERT` (certificate)
  - [ ] `AFIP_KEY` (private key)
  - [ ] `AFIP_CUIT` (CampoTech CUIT)
- [ ] Certificate expiration monitored (set reminder)

### API Configuration
- [ ] Production AFIP endpoints configured
- [ ] API access verified with test CUIT lookup
- [ ] Rate limiting configured (respect AFIP limits)
- [ ] Circuit breaker thresholds set:
  - Failure threshold: 5
  - Recovery timeout: 5 minutes

### Fallback Configuration
- [ ] Manual verification queue enabled
- [ ] Admin notification for manual verification configured
- [ ] AFIP unavailable fallback message translated

---

## Email Service

### Production Email Configuration
- [ ] Production SMTP/API configured
  - [ ] `SMTP_HOST` or email service API key
  - [ ] `SMTP_PORT`
  - [ ] `SMTP_USER`
  - [ ] `SMTP_PASS`
- [ ] From address verified: `noreply@campotech.com.ar`
- [ ] Reply-to address set: `soporte@campotech.com.ar`
- [ ] SPF, DKIM, DMARC records configured

### Email Templates
- [ ] All templates reviewed for production:
  - [ ] Welcome email
  - [ ] Trial started
  - [ ] Trial expiring (7 days)
  - [ ] Trial expiring (3 days)
  - [ ] Trial expiring (1 day)
  - [ ] Trial expired
  - [ ] Payment confirmed
  - [ ] Payment failed
  - [ ] Subscription cancelled
  - [ ] Subscription reactivated
  - [ ] Document approved
  - [ ] Document rejected
  - [ ] Account blocked
  - [ ] Account unblocked
- [ ] All email links point to production domain
- [ ] Unsubscribe links work
- [ ] Footer contains required legal information

### Email Testing
- [ ] Send test emails to verify delivery
- [ ] Check spam score with mail-tester.com
- [ ] Verify mobile rendering
- [ ] Test all template variables

---

## Cron Jobs

### Scheduled Jobs Configuration
- [ ] All cron jobs scheduled in Vercel/hosting:

| Job | Schedule (UTC) | Buenos Aires |
|-----|---------------|--------------|
| Trial expiration check | `0 3 * * *` | 12:00 AM |
| Document expiring (30d) | `0 11 * * *` | 8:00 AM |
| Document expiring (14d) | `0 11 * * *` | 8:00 AM |
| Document expiring (7d) | `0 11 * * *` | 8:00 AM |
| Document expiring (1d) | `0 11 * * *` | 8:00 AM |
| Document expired | `0 9 * * *` | 6:00 AM |
| AFIP revalidation | `0 6 * * 0` | Sunday 3:00 AM |
| Block escalation | `0 3 * * *` | 12:00 AM |
| Scheduled downgrades | `0 3 1 * *` | 1st of month |

- [ ] Cron secret configured (`CRON_SECRET`)
- [ ] Cron endpoints protected with authentication
- [ ] Cron job monitoring configured

### Cron Testing
- [ ] Each cron job tested manually
- [ ] Cron job error handling verified
- [ ] Alerting for cron failures configured

---

## Storage (Supabase)

### Bucket Configuration
- [ ] `verification-documents` bucket created
- [ ] Bucket set to private (not public)
- [ ] RLS policies configured:
  - [ ] Users can upload to their org's folder
  - [ ] Users can read their org's documents
  - [ ] Admins can read all documents
- [ ] File size limits set (10MB max)
- [ ] Allowed file types: JPG, PNG, PDF

### Storage Testing
- [ ] Test document upload
- [ ] Test document retrieval
- [ ] Verify access controls work
- [ ] Test signed URL generation

---

## Database

### Production Database
- [ ] Production PostgreSQL configured
- [ ] Connection pooling enabled
- [ ] SSL required for connections
- [ ] Backup schedule configured (daily)
- [ ] Point-in-time recovery enabled

### Migrations
- [ ] All migrations applied to production
- [ ] Migration history verified
- [ ] Rollback plan documented

### Performance
- [ ] Indexes created for common queries:
  - [ ] `organizations.cuit`
  - [ ] `organizations.subscription_status`
  - [ ] `subscription_payments.organization_id`
  - [ ] `verification_documents.organization_id`
- [ ] Query performance tested
- [ ] Connection limits set appropriately

---

## Monitoring & Logging

### Sentry Configuration
- [ ] Production Sentry DSN configured
- [ ] Server config: `SENTRY_DSN`
- [ ] Client config: `NEXT_PUBLIC_SENTRY_DSN`
- [ ] Sample rates configured:
  - [ ] Error: 100%
  - [ ] Performance: 10%
  - [ ] Replay: 10%
- [ ] PII filtering enabled
- [ ] Alert rules configured for critical errors

### Application Logging
- [ ] Structured logging enabled
- [ ] Log levels configured (warn/error in prod)
- [ ] Sensitive data redacted from logs

### Uptime Monitoring
- [ ] Health check endpoint configured (`/api/health`)
- [ ] Uptime monitoring service configured
- [ ] Downtime alerts configured

---

## Security

### Authentication
- [ ] Session secret configured (`NEXTAUTH_SECRET`)
- [ ] Session timeout configured
- [ ] Rate limiting on auth endpoints
- [ ] Brute force protection enabled

### API Security
- [ ] API rate limiting configured
- [ ] CORS properly configured
- [ ] CSRF protection enabled
- [ ] Content Security Policy configured

### Data Protection
- [ ] Encryption at rest enabled
- [ ] Encryption in transit (HTTPS only)
- [ ] Sensitive env vars not logged
- [ ] No secrets in client-side code

---

## DNS & SSL

### Domain Configuration
- [ ] Production domain configured: `app.campotech.com.ar`
- [ ] SSL certificate active
- [ ] HSTS enabled
- [ ] www redirect configured

### Subdomains
- [ ] API domain: `api.campotech.com.ar`
- [ ] Admin domain: `admin.campotech.com.ar`

---

## Performance

### Caching
- [ ] Static asset caching configured
- [ ] API response caching where appropriate
- [ ] CDN configured (Vercel Edge)

### Optimization
- [ ] Image optimization enabled
- [ ] Bundle size optimized
- [ ] Lazy loading implemented
- [ ] Core Web Vitals targets met

---

## Pre-Launch Verification

### Smoke Tests
- [ ] User can sign up
- [ ] User can complete verification
- [ ] User can make payment
- [ ] User can access dashboard
- [ ] Admin can access admin panel
- [ ] Emails are delivered

### Load Testing
- [ ] Load test completed
- [ ] Performance acceptable under load
- [ ] No memory leaks detected

### Rollback Plan
- [ ] Rollback procedure documented
- [ ] Database rollback tested
- [ ] Previous version accessible

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | | | |
| DevOps | | | |
| QA Lead | | | |
| Product Owner | | | |
