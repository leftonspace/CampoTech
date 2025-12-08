# Daily Operations Checklist

## Morning Health Check (Start of Business)

### 1. System Health Overview

```bash
# Run comprehensive health check
npm run health:check
```

Expected output: All services GREEN

### 2. Integration Status

```bash
# Check panic mode status
npm run panic:status
```

Verify:
- [ ] AFIP: healthy (not in panic)
- [ ] WhatsApp: healthy (not in panic)
- [ ] MercadoPago: healthy (not in panic)
- [ ] Voice AI: healthy (not in panic)

### 3. Capability Overrides

```bash
# Check for active overrides
npm run capability:status
```

Review:
- [ ] No stale environment overrides (>24h)
- [ ] Document reason for any active overrides
- [ ] Set calendar reminder if override needs review

### 4. Queue Health

```bash
# Check queue status
npm run queue:status
```

Verify:
- [ ] No stuck jobs (>15 min in active state)
- [ ] Failed job count is acceptable (<5% of total)
- [ ] No single org monopolizing queue capacity

### 5. Error Rate Review

Check monitoring dashboard for:
- [ ] Error rate < 1% over last 24h
- [ ] No spike patterns in errors
- [ ] No new error types appearing

---

## Midday Check (Optional)

### Quick Health Scan

```bash
npm run health:quick
```

Review:
- [ ] All integrations responding
- [ ] Queue depths normal
- [ ] No alerts triggered

---

## End of Day Check

### 1. Pending Items Review

- [ ] Review any incidents from today
- [ ] Document unresolved issues
- [ ] Update on-call notes if needed

### 2. Override Cleanup

```bash
npm run capability:status
```

- [ ] Remove temporary overrides no longer needed
- [ ] Convert long-term overrides to database

### 3. Handoff Notes

If issues exist:
- [ ] Document in #ops-handoff channel
- [ ] Brief incoming on-call if needed

---

## Weekly Tasks (Monday Morning)

### 1. Metrics Review

- [ ] Review weekly error rate trends
- [ ] Check queue processing time trends
- [ ] Identify any degradation patterns

### 2. Capacity Planning

- [ ] Review queue depth growth
- [ ] Check for any orgs hitting limits frequently
- [ ] Flag capacity concerns to engineering

### 3. Documentation Updates

- [ ] Update runbooks if procedures changed
- [ ] Document any new failure modes encountered
- [ ] Review and refresh this checklist

---

## Checklist Template

Copy this for daily use:

```
## Daily Check - [DATE]

### Morning
- [ ] health:check passed
- [ ] panic:status all healthy
- [ ] capability:status no stale overrides
- [ ] queue:status normal
- [ ] Error rate < 1%

### Notes:
[Add any observations or concerns]

### Action Items:
[List any follow-up tasks]
```
