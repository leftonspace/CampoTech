# CampoTech Architecture Documentation

## Overview

This directory contains the complete technical architecture documentation for CampoTech, a field service management platform for the Argentine market.

## Document Index

### Core Architecture

| Document | Description | Status |
|----------|-------------|--------|
| [campotech-architecture-complete.md](./campotech-architecture-complete.md) | **Primary architecture document** - System overview, tech stack, data models, API design, security | Canonical |
| [campotech-database-schema-complete.md](./campotech-database-schema-complete.md) | Complete PostgreSQL schema with all tables, indices, and constraints | Active |
| [campotech-openapi-spec.yaml](./campotech-openapi-spec.yaml) | OpenAPI 3.0 specification for all REST endpoints | Active |

### Feature-Specific Architecture

| Document | Description | Status |
|----------|-------------|--------|
| [campotech-queue-worker-architecture.md](./campotech-queue-worker-architecture.md) | BullMQ queue system, worker patterns, job processing | Active |
| [campotech-end-to-end-flows.md](./campotech-end-to-end-flows.md) | Complete user flows from scheduling to invoicing | Active |
| [capabilities.md](./capabilities.md) | Kill-switch/capability system for feature flags and graceful degradation | Active |

### Audit & Maintenance

| Document | Description | Status |
|----------|-------------|--------|
| [AUDIT-REPORT.md](./AUDIT-REPORT.md) | Documentation audit results and issue tracking | Complete |
| [IMPLEMENTATION-AUDIT-ACTION-PLAN.md](./IMPLEMENTATION-AUDIT-ACTION-PLAN.md) | Implementation gap analysis and remediation plan | In Progress |

---

## Quick Start

### For New Developers

1. Start with [campotech-architecture-complete.md](./campotech-architecture-complete.md) for system overview
2. Review [campotech-database-schema-complete.md](./campotech-database-schema-complete.md) for data models
3. Reference [campotech-openapi-spec.yaml](./campotech-openapi-spec.yaml) for API contracts

### For Operations

1. See [capabilities.md](./capabilities.md) for kill-switch operations
2. Review [campotech-queue-worker-architecture.md](./campotech-queue-worker-architecture.md) for queue operations
3. Check [../docs/ops/](../docs/ops/) for operational runbooks

### For Feature Development

1. Check [capabilities.md](./capabilities.md) for feature flag patterns
2. Review [campotech-end-to-end-flows.md](./campotech-end-to-end-flows.md) for user journey context
3. Reference API spec for endpoint contracts

---

## Key Concepts

### Multi-Tenant Architecture

CampoTech is a multi-tenant SaaS platform. All data is scoped by `org_id`. Key considerations:
- Row-level security via org_id filtering
- Per-org capability overrides for customization
- Fair scheduling in queues to prevent starvation

### External Integrations

| Integration | Purpose | Kill-Switch |
|-------------|---------|-------------|
| AFIP | Electronic invoicing (Argentina) | `external.afip` |
| MercadoPago | Payment processing | `external.mercadopago` |
| WhatsApp | Customer communication | `external.whatsapp` |
| OpenAI | Voice AI assistant | `external.whatsapp_voice_ai` |
| Firebase | Push notifications | `external.push_notifications` |

### Capability System

Features can be enabled/disabled at multiple levels:
1. **Global defaults** - Code-defined baseline
2. **Global overrides** - System-wide changes
3. **Per-org overrides** - Customer-specific settings
4. **Environment overrides** - Emergency kill-switches

See [capabilities.md](./capabilities.md) for complete documentation.

---

## Document Standards

### Versioning

- Documents are versioned via git
- Breaking changes require review
- Keep AUDIT-REPORT.md updated after changes

### Consistency Rules

1. **Enums** - Must match between architecture doc, OpenAPI spec, and database schema
2. **Field names** - Use snake_case consistently
3. **Timestamps** - Always UTC, ISO 8601 format
4. **IDs** - UUIDv4 for primary keys

### When Updating

1. Update all related documents together
2. Run consistency checks
3. Update AUDIT-REPORT.md if issues resolved
4. Get review for breaking changes

---

## Related Documentation

| Location | Content |
|----------|---------|
| `/docs/ops/` | Operational runbooks and procedures |
| `/docs/ENV_OVERRIDE_GUIDELINES.md` | Environment variable override guide |
| `/core/config/` | Configuration implementation |
| `/core/services/` | Service implementations |

---

## Contact

For architecture questions:
- Check existing documentation first
- Review AUDIT-REPORT.md for known issues
- Consult Engineering Lead for unresolved questions

---

*Last Updated: 2024-01*
