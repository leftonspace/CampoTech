# Queue Operations Guide

## Overview

CampoTech uses BullMQ-based queues for background job processing. This guide covers monitoring, troubleshooting, and operational procedures.

---

## Queue Architecture

| Queue | Purpose | Workers | Max Concurrency |
|-------|---------|---------|-----------------|
| `cae-queue` | AFIP invoice processing | 2 | 10/org, 100 total |
| `whatsapp-queue` | WhatsApp message delivery | 3 | 20/org, 200 total |
| `payment-queue` | Payment reconciliation | 1 | 5/org, 50 total |
| `notification-queue` | Push notifications | 2 | 50/org, 500 total |

---

## Monitoring Commands

### Check Queue Status

```bash
# Overview of all queues
npm run queue:status

# Detailed status for specific queue
npm run queue:status -- --queue=cae-queue
```

### View Queue Metrics

```bash
# Current metrics
npm run queue:metrics

# Metrics for specific queue
npm run queue:metrics -- --queue=whatsapp-queue
```

### Watch Queue in Real-Time

```bash
# Watch all queues (refreshes every 5s)
watch -n 5 'npm run queue:status'

# Watch specific queue
watch -n 2 'npm run queue:status -- --queue=cae-queue'
```

---

## Queue Health Indicators

### Healthy Queue

- Active jobs: < 80% of max concurrency
- Waiting jobs: < 1000
- Failed jobs (last hour): < 5% of completed
- Average wait time: < 30 seconds

### Degraded Queue

- Active jobs: 80-95% of max concurrency
- Waiting jobs: 1000-5000
- Failed jobs (last hour): 5-10% of completed
- Average wait time: 30 sec - 2 min

### Unhealthy Queue

- Active jobs: > 95% of max concurrency
- Waiting jobs: > 5000
- Failed jobs (last hour): > 10% of completed
- Average wait time: > 2 min

---

## Common Operations

### Pause a Queue

Use during incidents or maintenance:

```bash
# Pause queue (no new jobs processed)
npm run queue:pause -- --queue=cae-queue

# Resume queue
npm run queue:resume -- --queue=cae-queue
```

### Retry Failed Jobs

```bash
# Retry all failed jobs in queue
npm run queue:retry -- --queue=cae-queue

# Retry specific job
npm run queue:retry -- --queue=cae-queue --job=<job-id>

# Retry jobs failed with specific error
npm run queue:retry -- --queue=cae-queue --error="timeout"
```

### Clear Stuck Jobs

```bash
# List stuck jobs (active > 10 min)
npm run queue:stuck -- --queue=cae-queue

# Move stuck jobs to failed
npm run queue:unstick -- --queue=cae-queue

# Force remove stuck jobs (use with caution)
npm run queue:remove-stuck -- --queue=cae-queue
```

### Drain a Queue

For emergency situations:

```bash
# Move all waiting jobs to delayed (24h)
npm run queue:drain -- --queue=cae-queue --delay=24h

# Remove all waiting jobs (data loss!)
npm run queue:drain -- --queue=cae-queue --remove
```

---

## Fair Scheduling

The fair scheduler prevents any single organization from monopolizing queue resources.

### Limits

| Limit | Value | Purpose |
|-------|-------|---------|
| Max per org | 10 | Prevent single org domination |
| Max total | 100 | Global capacity limit |
| Max org % | 50% | No org can use >50% of capacity |

### Check Org Usage

```bash
# View per-org queue usage
npm run queue:org-stats

# View specific org
npm run queue:org-stats -- --org=<org-id>
```

### Adjust Limits (Temporary)

```bash
# Increase limit for specific org (temporary)
npm run queue:set-limit -- --org=<org-id> --max=20

# Reset to default
npm run queue:reset-limit -- --org=<org-id>
```

---

## Troubleshooting

### Jobs Not Processing

1. **Check workers are running:**
   ```bash
   npm run worker:status
   ```

2. **Check queue is not paused:**
   ```bash
   npm run queue:status -- --queue=<queue-name>
   ```

3. **Check for stuck jobs blocking capacity:**
   ```bash
   npm run queue:stuck -- --queue=<queue-name>
   ```

4. **Check related integration is not in panic mode:**
   ```bash
   npm run panic:status
   ```

### High Failure Rate

1. **View recent failures:**
   ```bash
   npm run queue:failures -- --queue=<queue-name> --limit=20
   ```

2. **Check error patterns:**
   ```bash
   npm run queue:error-summary -- --queue=<queue-name>
   ```

3. **If external integration issue:**
   - Enable panic mode if not already triggered
   - Wait for auto-recovery or fix external issue

### Queue Backlog Growing

1. **Check current throughput:**
   ```bash
   npm run queue:throughput -- --queue=<queue-name>
   ```

2. **Check for slow jobs:**
   ```bash
   npm run queue:slow-jobs -- --queue=<queue-name>
   ```

3. **Consider temporary scaling:**
   ```bash
   npm run worker:scale -- --queue=<queue-name> --count=5
   ```

### Single Org Blocking Others

1. **Identify the org:**
   ```bash
   npm run queue:org-stats
   ```

2. **Check if hitting fair scheduler limits:**
   - If yes, working as designed
   - If no, may need investigation

3. **Temporary throttle if needed:**
   ```bash
   npm run queue:throttle-org -- --org=<org-id> --max=5
   ```

---

## Metrics & Dashboards

### Key Metrics

| Metric | Description |
|--------|-------------|
| `queue_waiting_jobs` | Jobs waiting to be processed |
| `queue_active_jobs` | Jobs currently processing |
| `queue_completed_total` | Total completed jobs |
| `queue_failed_total` | Total failed jobs |
| `queue_wait_time_seconds` | Time jobs wait before processing |
| `queue_processing_time_seconds` | Job processing duration |

### Grafana Dashboards

- **Queue Overview**: `/grafana/d/queues-overview`
- **Queue Details**: `/grafana/d/queue-details`
- **Per-Org Stats**: `/grafana/d/queue-org-stats`

---

## Emergency Procedures

### Complete Queue Failure

1. Pause all affected queues
2. Check worker health
3. Check Redis connectivity
4. Review recent deployments
5. Restart workers if needed
6. Resume queues gradually

### Redis Connection Lost

1. Check Redis server status
2. Workers will auto-reconnect
3. Monitor for job duplication
4. May need to check job idempotency

### Worker Out of Memory

1. Worker will be killed by OS
2. Active jobs will stall
3. Run `queue:unstick` to recover
4. Investigate memory leak
5. Consider reducing concurrency

---

## Related Documentation

- [Panic Mode Guide](./panic-mode.md)
- [Fair Scheduler Architecture](../../architecture/queue-architecture.md)
- [Incident Response](./incident-response/README.md)
