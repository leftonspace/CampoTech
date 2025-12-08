# Queue Backup Runbook

## Trigger

- Alert: `queue_waiting_jobs > 5000`
- Manual: Jobs not being processed, backlog growing

## Severity: MEDIUM

Growing queue backlog indicates processing capacity issue or downstream failure.

---

## Quick Actions

```bash
# Check queue status
npm run queue:status

# Check panic mode (may explain backup)
npm run panic:status

# Check worker health
npm run worker:status
```

---

## Diagnosis Steps

### Step 1: Identify Affected Queue

```bash
npm run queue:status
```

Look for:
- High `waiting` count
- Low `active` count (capacity issue)
- High `failed` count (processing issue)

### Step 2: Determine Root Cause

| Symptom | Likely Cause |
|---------|--------------|
| Low active, high waiting | Workers down or paused |
| High active, high waiting | Capacity insufficient |
| High failed, growing waiting | Processing errors |
| Single org dominating | Fair scheduler working |

### Step 3: Check Related Systems

```bash
# If CAE queue: Check AFIP
npm run panic:status | grep afip

# If WhatsApp queue: Check WhatsApp
npm run panic:status | grep whatsapp

# Check worker processes
npm run worker:status
```

---

## Resolution by Cause

### Workers Down

**Action**: Restart workers

```bash
# Check worker status
npm run worker:status

# Restart workers
npm run worker:restart

# Verify recovery
npm run queue:status
```

### Queue Paused

**Action**: Resume queue

```bash
# Check if paused
npm run queue:info -- --queue=<queue-name>

# Resume
npm run queue:resume -- --queue=<queue-name>
```

### Capacity Insufficient

**Action**: Scale workers temporarily

```bash
# Add more workers
npm run worker:scale -- --queue=<queue-name> --count=5

# Monitor recovery
watch -n 10 'npm run queue:status -- --queue=<queue-name>'
```

After backlog cleared:
```bash
# Scale back down
npm run worker:scale -- --queue=<queue-name> --count=2
```

### Processing Errors

**Action**: Investigate and fix errors

```bash
# View recent failures
npm run queue:failures -- --queue=<queue-name> --limit=20

# Check error patterns
npm run queue:error-summary -- --queue=<queue-name>
```

If external integration issue:
```bash
# Enable panic mode for graceful degradation
npm run panic:enable <integration> "Queue backup due to failures"
```

### Single Org Dominating

This is expected behavior of fair scheduler.

```bash
# View per-org distribution
npm run queue:org-stats

# The org is limited, other orgs should process normally
```

If other orgs also blocked:
- Check total capacity
- May need scaling

---

## Escalation Thresholds

| Queue Depth | Wait Time | Action |
|-------------|-----------|--------|
| 5,000 | < 5 min | Monitor |
| 10,000 | 5-15 min | Investigate |
| 20,000 | > 15 min | Scale + Escalate |
| 50,000+ | > 30 min | SEV-2 Incident |

---

## Emergency Actions

### If Backlog Critical (>20k jobs)

1. **Scale workers aggressively**
   ```bash
   npm run worker:scale -- --queue=<queue-name> --count=10
   ```

2. **Prioritize critical jobs**
   ```bash
   npm run queue:prioritize -- --queue=<queue-name> --priority=high
   ```

3. **Consider pausing non-critical queues**
   ```bash
   npm run queue:pause -- --queue=notification-queue
   ```

### If System Unstable

1. **Pause incoming jobs** (buys time)
   ```bash
   npm run queue:pause-intake -- --queue=<queue-name>
   ```

2. **Process existing backlog**
   ```bash
   npm run worker:drain-mode -- --queue=<queue-name>
   ```

3. **Resume intake after stable**
   ```bash
   npm run queue:resume-intake -- --queue=<queue-name>
   ```

---

## Recovery Verification

After backlog cleared:

```bash
# Verify queue healthy
npm run queue:status -- --queue=<queue-name>

# Check no failed jobs need retry
npm run queue:failures -- --queue=<queue-name>

# Verify processing time normal
npm run queue:metrics -- --queue=<queue-name>
```

---

## Post-Incident

### Review Questions

- What caused the backup?
- Did monitoring detect it early enough?
- Were scaling procedures adequate?
- Should baseline capacity be increased?

### Capacity Planning

If backups recurring:
1. Review historical throughput
2. Analyze peak patterns
3. Consider permanent capacity increase
4. Implement auto-scaling if not present

---

## Contacts

| Contact | When |
|---------|------|
| On-call engineer | Queue depth > 10k |
| Engineering Lead | Queue depth > 20k or > 30 min |
