# High Error Rate Runbook

## Trigger

- Alert: `error_rate > 5%` sustained for 5+ minutes
- Manual: Users reporting widespread failures

## Severity: MEDIUM-HIGH

High error rate indicates systemic issue affecting multiple users/operations.

---

## Quick Actions

```bash
# Check overall health
npm run health:check

# Check error rate by service
npm run metrics:error-rate

# Check panic mode status
npm run panic:status
```

---

## Diagnosis Steps

### Step 1: Identify Error Source

```bash
# View error breakdown by category
npm run metrics:error-breakdown

# Recent error logs
grep ERROR logs/app.log | tail -100 | sort | uniq -c | sort -rn
```

Common error categories:
| Category | Typical Cause |
|----------|---------------|
| External API | Integration failure |
| Database | DB connection/query issue |
| Authentication | Token/session issue |
| Validation | Bad input data |
| Internal | Bug or configuration |

### Step 2: Check Affected Scope

```bash
# Error rate by endpoint
npm run metrics:error-by-endpoint

# Error rate by organization
npm run metrics:error-by-org
```

Determine:
- All users or subset?
- All endpoints or specific?
- Started suddenly or gradual?

### Step 3: Correlate with Changes

```bash
# Recent deployments
git log --oneline -10

# Recent config changes
git log --oneline -10 -- config/
```

---

## Resolution by Cause

### External Integration Failure

**Action**: Enable panic mode

```bash
# If specific integration identified
npm run panic:enable <integration> "High error rate detected"
```

Panic mode will:
- Stop hitting failing service
- Enable fallback behaviors
- Reduce error rate

### Database Issues

**Action**: Check and recover database

```bash
# Check DB connection
npm run db:status

# Check for slow queries
npm run db:slow-queries

# Check connection pool
npm run db:pool-status
```

If connection exhausted:
```bash
# Restart application to reset pool
npm run app:restart
```

### Authentication Issues

**Action**: Check auth service

```bash
# Check auth service health
npm run auth:health

# Check token validation
npm run auth:test-token

# If Redis session store issue
npm run redis:status
```

### Recent Deployment

**Action**: Consider rollback

```bash
# If deployment caused issue
npm run deploy:rollback

# Or revert specific commit
git revert <commit>
npm run deploy
```

### Traffic Spike

**Action**: Scale or rate limit

```bash
# Check traffic levels
npm run metrics:traffic

# Enable rate limiting if needed
npm run ratelimit:enable

# Scale if infrastructure-based
npm run app:scale --replicas=4
```

---

## Error Rate Thresholds

| Rate | Duration | Action |
|------|----------|--------|
| 1-5% | < 5 min | Monitor |
| 5-10% | 5+ min | Investigate |
| 10-25% | Any | Active response |
| 25%+ | Any | SEV-2 Incident |

---

## Mitigation Strategies

### Immediate (Buy Time)

1. **Enable panic modes** for failing integrations
2. **Enable rate limiting** to reduce load
3. **Disable non-critical features** temporarily

```bash
# Disable non-critical via capability
export CAPABILITY_SERVICES_ANALYTICS_PIPELINE=false
npm run app:restart
```

### Short-term (Fix Issue)

1. Identify root cause
2. Apply fix or rollback
3. Verify error rate recovering

### Long-term (Prevent Recurrence)

1. Add monitoring for early detection
2. Improve error handling
3. Add circuit breakers where missing

---

## Recovery Verification

Error rate should return to normal within 15 minutes of fix.

```bash
# Watch error rate recover
watch -n 30 'npm run metrics:error-rate'

# Verify no new error patterns
npm run metrics:error-breakdown
```

If rate not recovering:
- Fix may be incomplete
- Additional issues present
- Continue investigation

---

## Communication

### If User-Facing Impact

1. Update status page
2. Notify customer success
3. Prepare customer communication if extended

### Internal Updates

Post in #incidents:
```
Error Rate Update
Current: X%
Trend: Improving/Stable/Worsening
Cause: [identified/investigating]
ETA: [if known]
```

---

## Post-Incident

### Required Analysis

- What caused the errors?
- Why wasn't it caught earlier?
- How can we prevent recurrence?

### Monitoring Improvements

Consider adding:
- Earlier alerting thresholds
- More granular error categorization
- Automated panic mode triggers

---

## Contacts

| Contact | When |
|---------|------|
| On-call engineer | Error rate > 5% for 5+ min |
| Engineering Lead | Error rate > 10% |
| Customer Success | If user-facing > 15 min |
