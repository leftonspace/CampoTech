# MercadoPago Failure Runbook

## Trigger

- Alert: `mercadopago_panic_mode_active`
- Manual: Payment processing failures reported

## Severity: HIGH

MercadoPago handles all payment processing. Failure impacts revenue collection.

---

## Quick Actions

```bash
# Check panic status
npm run panic:status

# Enable panic mode if not auto-triggered
npm run panic:enable mercadopago "Manual trigger - investigating failure"

# Check queue status
npm run queue:status -- --queue=payment-queue
```

---

## Diagnosis Steps

### Step 1: Identify Failure Type

Check recent errors:
```bash
grep -i "mercadopago\|payment" logs/app.log | tail -100
```

Common failure types:
| Error Pattern | Likely Cause |
|---------------|--------------|
| `401/403` | API credentials issue |
| `rate_limit` | Too many requests |
| `webhook_failed` | Webhook signature invalid |
| `timeout` | MP API slow/unreachable |
| `insufficient_funds` | Customer payment issue (not system) |

### Step 2: Check MercadoPago Status

1. Visit MP status: https://status.mercadopago.com/
2. Check developer dashboard for account alerts
3. Review webhook configuration

### Step 3: Differentiate System vs Customer Issues

```bash
# Check error distribution
npm run payments:error-summary -- --hours=1
```

If majority are `insufficient_funds` or `rejected`:
- These are customer-side issues
- Not a system incident
- May need to adjust alert thresholds

---

## Resolution by Cause

### API Credentials Issue (401/403)

**Action**: Verify and refresh credentials

```bash
# Check credential status
npm run mercadopago:credential-status

# Test with current credentials
npm run mercadopago:test-auth
```

If credentials invalid:
1. Check MercadoPago developer dashboard
2. Verify production vs sandbox credentials
3. Regenerate if compromised

### Rate Limited

**Action**: Wait and reduce load

1. Rate limits typically reset within minutes
2. Reduce concurrent payment requests
3. Implement request queuing

```bash
# Check current rate limit status
npm run mercadopago:rate-status
```

### Webhook Issues

**Action**: Verify webhook configuration

```bash
# Test webhook endpoint
npm run mercadopago:test-webhook

# Check webhook signature secret
npm run mercadopago:verify-webhook-secret
```

If webhook failing:
1. Check our endpoint is accessible from internet
2. Verify SSL certificate is valid
3. Check webhook secret matches dashboard

### MercadoPago API Unavailable

**Action**: Wait for MP recovery

1. Confirm on MP status page
2. Panic mode provides limited fallback
3. Payment collection will resume on recovery

---

## Fallback Behavior

When MercadoPago panic mode is active:

1. **Payment Links**: Still generated (MP-hosted)
2. **Webhook Processing**: Paused
3. **Reconciliation**: Manual may be needed
4. **User Impact**: Payments accepted but confirmation delayed

**Important**: Customers can still pay via MP-hosted links. Only our real-time processing is affected.

### Manual Reconciliation

If panic mode extends beyond 1 hour:

```bash
# Run manual reconciliation
npm run payments:reconcile -- --from="1 hour ago"
```

---

## Recovery

### Automatic Recovery

System probes MercadoPago every 30 seconds. After 3 successful probes:
1. Panic mode automatically disabled
2. Webhook processing resumes
3. Queued reconciliation tasks processed

### Manual Recovery

```bash
# Manually test MP API
npm run mercadopago:test

# If successful, disable panic
npm run panic:disable mercadopago "Manual verification - API responding"

# Run reconciliation to catch up
npm run payments:reconcile -- --from="<panic_start_time>"
```

### Post-Recovery Reconciliation

After extended outage:

```bash
# Full reconciliation for outage period
npm run payments:reconcile -- --from="<start>" --to="<end>"

# Verify no missing payments
npm run payments:audit -- --date=today
```

---

## Financial Considerations

### Data Integrity

- Payment links are MP-hosted, so payments are collected
- Our system may not have real-time updates
- Reconciliation will sync our records

### If Payments Were Lost

1. Check MercadoPago dashboard for actual payments
2. Run reconciliation to import missing records
3. If data mismatch, escalate to Finance team

### Refund Handling During Outage

- Refund requests queued
- Process manually if urgent via MP dashboard
- Queue will process on recovery

---

## Special Scenarios

### During High-Traffic Period (Sales, End of Month)

1. Increase monitoring sensitivity
2. Have reconciliation ready to run
3. Consider pre-emptive capacity increase

### Suspected Fraud/Security Issue

If seeing unusual patterns:

```bash
# Check for suspicious activity
npm run payments:fraud-check

# If confirmed, immediately:
npm run mercadopago:pause-webhooks
```

Escalate to Engineering Lead immediately.

---

## Post-Incident

### If MP External Issue

- Document outage duration
- Run full reconciliation
- Verify payment records match MP dashboard

### If Internal Issue

- Schedule post-mortem
- Review credential management
- Review webhook resilience

### Financial Review

After any payment incident:
- [ ] Reconciliation completed
- [ ] No missing payments
- [ ] Finance team notified
- [ ] Customer refunds processed (if any)

---

## Contacts

| Contact | When |
|---------|------|
| MercadoPago Support | Account/credential issues |
| Engineering Lead | Extended outage (>1 hour) |
| Finance Team | Any payment discrepancy |
| Security Team | Suspected fraud |
