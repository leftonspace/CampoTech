# CampoTech Production Launch Checklist

**Version:** 1.0
**Last Updated:** 2025-12-20
**Reference:** `docs/CAMPOTECH-IMPLEMENTATION-ROADMAP-DETAILED.md` (Phase 9.2)

---

## Pre-Launch Verification

### Technical Infrastructure

- [ ] **All tests passing**
  ```bash
  cd apps/web && npm run test:run
  ```

- [ ] **Build succeeds without errors**
  ```bash
  cd apps/web && npm run build
  ```

- [ ] **Load tests passed** (see [tests/load/README.md](../tests/load/README.md))
  - [ ] API Baseline test (100 users, p95 < 500ms)
  - [ ] Stress test (500 users, p95 < 2000ms)
  - [ ] Spike test completed
  - [ ] Soak test (2 hours) - run before major releases

- [ ] **Security scan clean**
  - [ ] `npm audit` shows no high/critical vulnerabilities
  - [ ] OWASP Top 10 audit passed (see `apps/web/SECURITY-AUDIT-OWASP.md`)

- [ ] **Error tracking active**
  - [ ] Sentry DSN configured in production
  - [ ] Test error captured successfully
  - [ ] Alert notifications configured

- [ ] **Database ready**
  - [ ] Migrations applied: `npx prisma migrate deploy`
  - [ ] Connection pooling enabled (Supabase pooler URL)
  - [ ] Backups configured in Supabase Dashboard
  - [ ] Read replica configured (if Pro plan)

- [ ] **SSL certificates valid**
  - [ ] Production domain SSL active
  - [ ] Certificate expiration > 30 days

- [ ] **CDN/Edge configured**
  - [ ] Vercel deployment configured
  - [ ] Environment variables set

---

### Environment Variables Configured

#### Required for Production

- [ ] `DATABASE_URL` - Supabase pooled connection string
- [ ] `JWT_SECRET` - Minimum 32 characters, unique per environment
- [ ] `NEXT_PUBLIC_APP_URL` - Production URL
- [ ] `NODE_ENV` - Set to "production"

#### Authentication & SMS

- [ ] `TWILIO_ACCOUNT_SID`
- [ ] `TWILIO_AUTH_TOKEN`
- [ ] `TWILIO_PHONE_NUMBER`
- [ ] `ALLOW_DEV_OTP` - Set to "false" (NEVER "true" in production)

#### Payments

- [ ] `MERCADOPAGO_ACCESS_TOKEN` - Production credentials
- [ ] `MERCADOPAGO_PUBLIC_KEY`

#### Electronic Invoicing

- [ ] `AFIP_ENVIRONMENT` - Set to "production"
- [ ] `AFIP_CERTIFICATE_BASE64` - Production certificate
- [ ] `AFIP_CERTIFICATE_PASSWORD`

#### WhatsApp Business API

- [ ] `WHATSAPP_APP_SECRET`
- [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- [ ] `WHATSAPP_API_VERSION`

#### Real-Time Updates

- [ ] `PUSHER_APP_ID`
- [ ] `PUSHER_KEY`
- [ ] `PUSHER_SECRET`
- [ ] `PUSHER_CLUSTER`
- [ ] `NEXT_PUBLIC_PUSHER_KEY`
- [ ] `NEXT_PUBLIC_PUSHER_CLUSTER`

#### Caching & Queues

- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`

#### Background Jobs

- [ ] `CRON_SECRET` - Unique per environment

#### Monitoring

- [ ] `SENTRY_DSN` - Production project DSN
- [ ] `SENTRY_ENVIRONMENT` - Set to "production"

#### Storage

- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`

#### Optional Services

- [ ] `OPENAI_API_KEY` - For voice AI processing
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - For address autocomplete

---

### Legal Compliance

#### Ley 25.326 (Data Protection)

- [ ] **Privacy policy published**
  - URL: `/legal/privacidad`
  - Contains ARCO rights information
  - Last reviewed: ___________

- [ ] **Terms of service published**
  - URL: `/legal/terminos`
  - Last reviewed: ___________

- [ ] **Cookie policy published**
  - URL: `/legal/cookies`
  - Last reviewed: ___________

- [ ] **Data export API functional**
  - Endpoint: `POST /api/users/me/export`
  - Tested: [ ] Yes [ ] No

- [ ] **Account deletion API functional**
  - 30-day waiting period enforced
  - Tested: [ ] Yes [ ] No

- [ ] **AAIP registration submitted** (if applicable)
  - Registration number: ___________

#### Ley 24.240 (Consumer Protection)

- [ ] **"Botón de Arrepentimiento" visible**
  - Footer link present: [ ] Yes [ ] No
  - Settings page link present: [ ] Yes [ ] No
  - Dedicated page: `/arrepentimiento`

- [ ] **10-day withdrawal period documented**

- [ ] **Refund processing within 10 days**

#### AFIP Compliance

- [ ] **AFIP integration certified**
  - Homologation passed: [ ] Yes [ ] No
  - Production certificate installed: [ ] Yes [ ] No

---

### Business Readiness

- [ ] **Pricing finalized**
  - FREE: $0
  - Inicial: $25/mes
  - Profesional: $55/mes
  - Empresa: $120/mes

- [ ] **Payment processing working**
  - [ ] Test payment completed in production
  - [ ] Webhook configured and tested
  - [ ] Subscription renewal tested

- [ ] **Support contact ready**
  - Email: ___________
  - WhatsApp: ___________
  - Hours: ___________

- [ ] **Mobile apps in stores** (if applicable)
  - [ ] iOS App Store - Status: ___________
  - [ ] Google Play - Status: ___________

---

### Monitoring & Alerting

- [ ] **Uptime monitoring configured**
  - Service: ___________ (e.g., UptimeRobot, Pingdom)
  - Endpoints monitored:
    - [ ] `/health`
    - [ ] `/api/health`
    - [ ] Landing page

- [ ] **Alert channels configured**
  - [ ] Email notifications
  - [ ] Slack/WhatsApp notifications
  - [ ] On-call rotation (if applicable)

- [ ] **Prometheus alerts active** (27 rules)
  - [ ] Application health (5 rules)
  - [ ] Database (4 rules)
  - [ ] Redis (3 rules)
  - [ ] Queue processing (4 rules)
  - [ ] External integrations (4 rules)
  - [ ] Infrastructure (4 rules)
  - [ ] Business metrics (3 rules)

- [ ] **Grafana dashboards accessible**
  - [ ] Application overview
  - [ ] Infrastructure metrics

---

### Final Verification

- [ ] **Staging environment tested**
  - All features working
  - Edge cases verified

- [ ] **Production smoke test**
  - [ ] Landing page loads
  - [ ] Login/signup works
  - [ ] Dashboard accessible
  - [ ] Job creation works
  - [ ] Invoice generation works
  - [ ] WhatsApp integration responds

- [ ] **Rollback plan documented**
  - Previous version tag: ___________
  - Rollback command: `git revert HEAD && git push`

---

## Launch Day Checklist

- [ ] Announce maintenance window (if applicable)
- [ ] Deploy to production
- [ ] Run database migrations
- [ ] Verify all services healthy
- [ ] Complete smoke test
- [ ] Monitor error rates for 30 minutes
- [ ] Announce launch (if applicable)

---

## Post-Launch Monitoring (First 24 Hours)

- [ ] Error rate < 1%
- [ ] p95 response time < 500ms
- [ ] No critical alerts triggered
- [ ] Customer feedback reviewed
- [ ] Any hotfixes deployed

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Technical Lead | | | |
| Product Owner | | | |
| Security Review | | | |

---

*Checklist generated from implementation roadmap audit*
