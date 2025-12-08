# Incident Response Runbooks

## Overview

This directory contains runbooks for responding to common incidents. Each runbook provides step-by-step procedures for diagnosis and resolution.

## Runbook Index

| Runbook | Trigger | Severity |
|---------|---------|----------|
| [AFIP Failure](./afip-failure.md) | AFIP panic mode triggered | High |
| [WhatsApp Failure](./whatsapp-failure.md) | WhatsApp panic mode triggered | High |
| [MercadoPago Failure](./mercadopago-failure.md) | Payment processing failures | High |
| [Queue Backup](./queue-backup.md) | Queue depth > 5000 | Medium |
| [High Error Rate](./high-error-rate.md) | Error rate > 5% | Medium |

---

## Incident Classification

### Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|------------|
| **SEV-1** | Complete service outage | Immediate | VP Engineering |
| **SEV-2** | Major feature unavailable | 15 min | Engineering Lead |
| **SEV-3** | Degraded performance | 1 hour | On-call engineer |
| **SEV-4** | Minor issue, workaround exists | Next business day | Ticket |

### Classification Guide

**SEV-1 Indicators:**
- All users affected
- Core functionality broken (scheduling, invoicing)
- Data loss potential
- Revenue impact immediate

**SEV-2 Indicators:**
- Subset of users affected
- Important feature unavailable
- Workaround not available
- Revenue impact possible

**SEV-3 Indicators:**
- Performance degradation
- Feature slow but functional
- Workaround available
- Limited user impact

---

## General Incident Response Flow

### 1. Detection (0-5 min)

- [ ] Acknowledge alert
- [ ] Open incident channel (if SEV-1/2)
- [ ] Initial assessment

### 2. Triage (5-15 min)

- [ ] Classify severity
- [ ] Identify affected systems
- [ ] Check for obvious cause
- [ ] Engage additional responders if needed

### 3. Mitigation (15-30 min)

- [ ] Apply immediate fixes
- [ ] Enable fallbacks/panic mode
- [ ] Communicate to stakeholders

### 4. Resolution (30+ min)

- [ ] Fix root cause
- [ ] Verify recovery
- [ ] Monitor for recurrence

### 5. Post-Incident

- [ ] Update documentation
- [ ] Schedule post-mortem (SEV-1/2)
- [ ] Create follow-up tickets

---

## Communication Templates

### Internal (Slack #incidents)

```
🚨 INCIDENT: [Brief Description]
Severity: SEV-X
Status: Investigating/Mitigating/Resolved
Impact: [Who/what is affected]
Current Actions: [What we're doing]
Updates: [Time] - [Update]
```

### Customer-Facing (if needed)

```
We are currently experiencing [brief, non-technical description].

Impact: [What customers may notice]
Workaround: [If any]

We are actively working to resolve this and will provide updates.

Status page: [URL]
```

---

## Quick Reference

### Enable Panic Mode

```bash
npm run panic:enable <integration> "<reason>"
```

### Check System Health

```bash
npm run health:check
```

### View Logs

```bash
# Recent errors
grep ERROR logs/app.log | tail -50

# Specific integration
grep -i afip logs/app.log | tail -50
```

### Restart Workers

```bash
npm run worker:restart -- --queue=<queue-name>
```

---

## Escalation Contacts

| Role | When to Engage |
|------|----------------|
| Engineering Lead | SEV-1/2, or if stuck > 30 min |
| VP Engineering | SEV-1, or if customer impact > 1 hour |
| External (AFIP/etc) | After confirming external issue |

---

## Post-Incident Requirements

### SEV-1/2 Required

- Post-mortem document within 3 business days
- Follow-up tickets for improvements
- Timeline review with team

### SEV-3/4 Optional

- Incident summary in ticket
- Process improvements if pattern emerges
