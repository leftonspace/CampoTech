# CampoTech Support Runbook

Operational procedures for handling common support scenarios and system issues.

---

## Table of Contents

1. [System Health Checks](#system-health-checks)
2. [Subscription Issues](#subscription-issues)
3. [Payment Issues](#payment-issues)
4. [Verification Issues](#verification-issues)
5. [Integration Failures](#integration-failures)
6. [Emergency Procedures](#emergency-procedures)

---

## System Health Checks

### Daily Health Check Routine

**Time**: 09:00 Buenos Aires

1. Check dashboard health status
   ```
   GET /api/admin/dashboard/metrics
   ```

2. Verify all services show "healthy":
   - Database connection
   - MercadoPago API
   - AFIP API
   - Email service
   - File storage

3. Review overnight alerts in Sentry

4. Check pending verification queue count

5. Review failed payments from last 24 hours

### Service Status Commands

```bash
# Check database connectivity
SELECT 1 FROM "Organization" LIMIT 1;

# Check pending verifications count
SELECT COUNT(*) FROM "VerificationDocument" WHERE status = 'pending';

# Check recent payment failures
SELECT COUNT(*) FROM "SubscriptionPayment"
WHERE status = 'failed'
AND "createdAt" > NOW() - INTERVAL '24 hours';
```

---

## Subscription Issues

### Issue: Trial Not Starting

**Symptoms**: New organization not getting 14-day trial

**Diagnosis**:
```sql
SELECT id, "subscriptionStatus", "trialEndsAt", "createdAt"
FROM "Organization"
WHERE id = ':orgId';
```

**Resolution**:
1. Check if organization was created successfully
2. Verify trial creation wasn't blocked by existing subscription
3. Manual fix:
   ```
   POST /api/admin/organizations/:id/create-trial
   ```

### Issue: Trial Expired Prematurely

**Symptoms**: User claims trial ended before 14 days

**Diagnosis**:
```sql
SELECT "trialEndsAt", "createdAt",
       "trialEndsAt" - "createdAt" AS trial_duration
FROM "Organization"
WHERE id = ':orgId';
```

**Resolution**:
1. If system error, grant extension:
   ```
   POST /api/admin/organizations/:id/extend-trial
   { "days": <remaining_days>, "reason": "System error correction" }
   ```

### Issue: Subscription Not Activating After Payment

**Symptoms**: Payment completed but status still "trialing" or "expired"

**Diagnosis**:
```sql
-- Check payment status
SELECT * FROM "SubscriptionPayment"
WHERE "organizationId" = ':orgId'
ORDER BY "createdAt" DESC
LIMIT 1;

-- Check subscription events
SELECT * FROM "SubscriptionEvent"
WHERE "organizationId" = ':orgId'
ORDER BY "createdAt" DESC
LIMIT 5;
```

**Resolution**:
1. Verify payment was processed in MercadoPago
2. Check webhook was received
3. Manual activation:
   ```
   POST /api/admin/organizations/:id/activate
   { "paymentId": ":paymentId", "reason": "Manual activation - webhook missed" }
   ```

### Issue: Downgrade Not Applied

**Symptoms**: Scheduled downgrade didn't happen at period end

**Diagnosis**:
```sql
SELECT "pendingTierChange", "pendingTierChangeDate"
FROM "OrganizationSubscription"
WHERE "organizationId" = ':orgId';
```

**Resolution**:
1. Check cron job ran successfully
2. Manual application:
   ```
   POST /api/admin/organizations/:id/apply-tier-change
   { "newTier": ":scheduledTier" }
   ```

---

## Payment Issues

### Issue: Payment Stuck in Pending

**Symptoms**: Payment shows pending for > 1 hour

**Diagnosis**:
1. Check MercadoPago dashboard for payment status
2. Look for webhook in logs:
   ```bash
   grep "mp-payment-:paymentId" /var/log/webhooks.log
   ```

**Resolution**:
1. If MercadoPago shows approved, manually complete:
   ```
   POST /api/admin/payments/:id/complete
   { "mercadoPagoPaymentId": ":mpId" }
   ```

2. If still pending in MP, wait or contact customer

### Issue: Duplicate Payment

**Symptoms**: Customer charged twice for same period

**Diagnosis**:
```sql
SELECT * FROM "SubscriptionPayment"
WHERE "organizationId" = ':orgId'
AND status = 'completed'
AND "createdAt" > NOW() - INTERVAL '7 days'
ORDER BY "createdAt" DESC;
```

**Resolution**:
1. Verify both payments in MercadoPago
2. Refund the duplicate:
   ```
   POST /api/admin/payments/:id/refund
   { "reason": "Duplicate payment", "amount": :fullAmount }
   ```

### Issue: Refund Failed

**Symptoms**: MercadoPago refund rejected

**Common Causes**:
- Original payment too old (> 180 days)
- Card cancelled/expired
- MercadoPago balance insufficient

**Resolution**:
1. Check MercadoPago error message
2. If card issue, offer bank transfer refund
3. Document in payment notes:
   ```
   PUT /api/admin/payments/:id/notes
   { "notes": "Refund via bank transfer - TRF#12345" }
   ```

### Issue: Recurring Payment Failed

**Symptoms**: Monthly charge declined

**Diagnosis**:
```sql
SELECT p.*, o.email, o.name
FROM "SubscriptionPayment" p
JOIN "Organization" o ON p."organizationId" = o.id
WHERE p.status = 'failed'
AND p."createdAt" > NOW() - INTERVAL '24 hours';
```

**Resolution**:
1. Send payment failed notification (automatic)
2. After 3 failures, soft block applied (automatic)
3. If customer contacts support:
   - Help update payment method
   - Retry payment manually
   - Consider grace period extension

---

## Verification Issues

### Issue: Document Upload Failing

**Symptoms**: Users report upload errors

**Diagnosis**:
1. Check storage service status
2. Check file size limits (max 10MB)
3. Check file type (JPG, PNG, PDF only)

**Resolution**:
1. If storage issue, failover to backup:
   ```bash
   export STORAGE_PROVIDER=backup
   ```
2. If file issue, guide user on requirements

### Issue: CUIT Validation Failing

**Symptoms**: Valid CUITs being rejected

**Diagnosis**:
1. Check AFIP service status
2. Test CUIT manually on AFIP website
3. Check circuit breaker status:
   ```
   GET /api/admin/health/afip
   ```

**Resolution**:
1. If AFIP down, queue for retry:
   ```
   POST /api/admin/verifications/:id/queue-retry
   { "retryAfter": "24h" }
   ```
2. If circuit open, manual override:
   ```
   POST /api/admin/verifications/:id/approve
   { "skipAFIP": true, "reason": "AFIP unavailable - manual verification" }
   ```

### Issue: Verification Stuck in Review

**Symptoms**: Document pending review > 48 hours

**Resolution**:
1. Assign to specific reviewer
2. Priority flag:
   ```
   PUT /api/admin/verifications/:id/priority
   { "priority": "high" }
   ```

### Issue: Wrong Document Approved

**Symptoms**: Approved document doesn't meet requirements

**Resolution**:
1. Cannot un-approve - create new verification request:
   ```
   POST /api/admin/verifications/:orgId/request-resubmit
   { "documentType": ":type", "reason": "Previous submission did not meet requirements" }
   ```
2. Log incident for audit

---

## Integration Failures

### MercadoPago Down

**Symptoms**:
- Payment creation failing
- Webhooks not arriving
- Dashboard showing MP errors

**Immediate Actions**:
1. Check MercadoPago status page
2. Enable maintenance mode for payments:
   ```bash
   export PAYMENTS_MAINTENANCE=true
   ```
3. Display user message: "Pagos temporalmente no disponibles"

**Recovery**:
1. Disable maintenance mode
2. Process queued payments
3. Verify webhook backlog

### AFIP Down

**Symptoms**:
- CUIT validation failing
- Circuit breaker open

**Immediate Actions**:
1. System automatically queues validations
2. Manual verifications continue
3. Check AFIP status: https://www.afip.gob.ar

**Recovery**:
1. Circuit breaker auto-resets after 5 minutes
2. Process validation queue:
   ```
   POST /api/admin/afip/process-queue
   ```

### Email Service Down

**Symptoms**:
- Notification emails not sending
- Confirmation emails delayed

**Immediate Actions**:
1. Check email provider status
2. Enable email queue:
   ```bash
   export EMAIL_QUEUE_MODE=true
   ```

**Recovery**:
1. Process email queue:
   ```
   POST /api/admin/email/process-queue
   ```

### Database Issues

**Symptoms**:
- Slow response times
- Connection errors

**Immediate Actions**:
1. Check connection pool:
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```
2. If pool exhausted, restart application servers

**Escalate to**: Technical Team immediately

---

## Emergency Procedures

### Complete System Outage

1. **Assess scope** - Which services affected?
2. **Enable maintenance page**
   ```bash
   export MAINTENANCE_MODE=true
   ```
3. **Notify stakeholders**
4. **Document timeline**
5. **Coordinate with technical team**

### Data Breach Suspected

1. **Do not attempt to fix**
2. **Preserve logs**
3. **Immediately contact**: security@campotech.com
4. **Document observation**
5. **Limit access to affected systems**

### Mass Payment Failure

**Threshold**: > 50 failures in 1 hour

1. **Pause payment processing**
   ```bash
   export PAYMENTS_PAUSED=true
   ```
2. **Identify pattern** - Same error? Same bank?
3. **Contact MercadoPago support**
4. **Prepare customer communication**

### Incorrect Mass Charge

1. **Immediately pause recurring charges**
2. **Identify affected customers**:
   ```sql
   SELECT * FROM "SubscriptionPayment"
   WHERE "createdAt" > ':incident_time'
   AND status = 'completed';
   ```
3. **Prepare bulk refund**
4. **Draft customer apology**
5. **Escalate to senior admin**

---

## Cron Job Monitoring

### Daily Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| trial-expiring | 09:00 | Notify trials expiring in 3 days |
| trial-expired | 00:05 | Expire and block overdue trials |
| block-escalation | 00:30 | Escalate soft to hard blocks |
| document-expiring | 10:00 | Notify expiring documents |
| afip-revalidation | 02:00 | Weekly AFIP status check |

### Checking Cron Status

```bash
# Check last run
GET /api/admin/cron/status

# Force run specific job
POST /api/admin/cron/run
{ "job": "trial-expired" }
```

### Cron Failure Recovery

If cron job failed:
1. Check logs for error
2. Fix underlying issue
3. Run manually:
   ```
   POST /api/cron/subscription?job=:jobName
   Authorization: Bearer $CRON_SECRET
   ```

---

## Quick Reference Cards

### Payment Status Flow
```
pending → processing → completed
                    ↘ failed

completed → refunded
         → partially_refunded
```

### Block Escalation
```
Day 0:  Trial expires → soft_block
Day 7:  Grace ends → hard_block
Day 30: Data retention review
```

### Verification Status Flow
```
pending → approved
       → rejected → resubmitted → pending
```

### Priority Levels
```
P1 - Critical: System down, mass failures
P2 - High: Payment issues, blocking bugs
P3 - Medium: Verification delays, individual issues
P4 - Low: Questions, feature requests
```

---

## Contact Directory

| Role | Contact | Escalation Path |
|------|---------|-----------------|
| Admin Lead | admin-lead@campotech.com | P2+ issues |
| Technical Team | dev@campotech.com | Integration failures |
| Security | security@campotech.com | Any security concern |
| MercadoPago Support | - | Payment integration issues |
| AFIP Queries | - | Manual CUIT verification |

---

## Appendix: Common Error Codes

| Code | Message | Action |
|------|---------|--------|
| `PAYMENT_FAILED` | Payment processing failed | Check MP error |
| `PAYMENT_DECLINED` | Card declined | Customer to contact bank |
| `CUIT_DUPLICATE` | CUIT already registered | Find existing org |
| `TRIAL_EXPIRED` | Trial ended | Direct to payment |
| `BLOCKED` | Account blocked | Resolve block reason |
| `VERIFICATION_REQUIRED` | Documents needed | Guide to verification |
| `AFIP_UNAVAILABLE` | AFIP service down | Queue for retry |
| `RATE_LIMITED` | Too many requests | Wait and retry |
