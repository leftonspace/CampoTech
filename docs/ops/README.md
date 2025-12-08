# CampoTech Operations Guide

## Overview

This directory contains operational documentation and runbooks for CampoTech system administrators and on-call engineers.

## Quick Links

| Document | Purpose |
|----------|---------|
| [Daily Checklist](./daily-checklist.md) | Morning health checks |
| [Incident Response](./incident-response/README.md) | Emergency procedures |
| [Panic Mode Guide](./panic-mode.md) | Kill-switch operations |
| [Queue Operations](./queue-operations.md) | Queue monitoring & recovery |

## Common Commands

```bash
# Check system health
npm run health:check

# View panic mode status
npm run panic:status

# View capability overrides
npm run capability:status

# Check queue health
npm run queue:status
```

## Emergency Contacts

| Role | Contact |
|------|---------|
| On-Call Primary | Refer to PagerDuty |
| On-Call Secondary | Refer to PagerDuty |
| Engineering Lead | Refer to internal directory |

## Escalation Path

1. **Level 1**: On-call engineer (0-15 min response)
2. **Level 2**: Engineering lead (15-30 min response)
3. **Level 3**: CTO/VP Engineering (30+ min critical issues)

## Related Documentation

- [Environment Override Guidelines](../ENV_OVERRIDE_GUIDELINES.md)
- [Architecture Overview](../../architecture/README.md)
- [Capability System](../../architecture/capabilities.md)
