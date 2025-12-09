# CampoTech Key File Locations Reference

**Version:** 1.0
**Last Updated:** December 2024
**Phase:** 9.11 Technical Architecture Documentation

## Quick Navigation

This document provides a comprehensive reference to key files in the CampoTech codebase, organized by functional area.

## Directory Structure Overview

```
CampoTech/
├── apps/
│   ├── web/                    # Next.js web application
│   │   ├── app/               # App router pages & API
│   │   ├── components/        # React components
│   │   ├── lib/               # Web-specific utilities
│   │   └── prisma/            # Database schema
│   └── mobile/                 # React Native mobile app
│       ├── app/               # Expo router screens
│       ├── components/        # Mobile components
│       ├── lib/               # Mobile utilities
│       └── watermelon/        # Offline database
├── src/
│   ├── integrations/          # External service integrations
│   ├── modules/               # Domain business logic
│   ├── workers/               # Background job processors
│   ├── lib/                   # Shared utilities
│   └── validation/            # Zod schemas
├── database/
│   └── migrations/            # SQL migrations
├── docs/
│   └── architecture/          # Technical documentation
└── architecture/              # Design documents
```

## Authentication & Authorization

| File | Purpose |
|------|---------|
| `apps/web/app/api/auth/otp/route.ts` | OTP request endpoint |
| `apps/web/app/api/auth/verify/route.ts` | OTP verification endpoint |
| `apps/web/app/api/auth/refresh/route.ts` | Token refresh endpoint |
| `apps/web/lib/auth/session.ts` | Session management |
| `src/lib/auth/rbac.ts` | Role-based access control |
| `src/lib/middleware/authorize.ts` | Authorization middleware |
| `src/modules/users/onboarding/employee-verification.service.ts` | Employee verification |

## API Routes (Next.js App Router)

### Jobs
| Route | File |
|-------|------|
| `GET/POST /api/jobs` | `apps/web/app/api/jobs/route.ts` |
| `GET/PUT/DELETE /api/jobs/[id]` | `apps/web/app/api/jobs/[id]/route.ts` |
| `POST /api/jobs/[id]/transition` | `apps/web/app/api/jobs/[id]/transition/route.ts` |
| `POST /api/jobs/[id]/photos` | `apps/web/app/api/jobs/[id]/photos/route.ts` |
| `POST /api/jobs/[id]/signature` | `apps/web/app/api/jobs/[id]/signature/route.ts` |

### Users
| Route | File |
|-------|------|
| `GET/POST /api/users` | `apps/web/app/api/users/route.ts` |
| `GET/PUT/DELETE /api/users/[id]` | `apps/web/app/api/users/[id]/route.ts` |
| `POST /api/users/verify` | `apps/web/app/api/users/verify/route.ts` |

### Customers
| Route | File |
|-------|------|
| `GET/POST /api/customers` | `apps/web/app/api/customers/route.ts` |
| `GET/PUT/DELETE /api/customers/[id]` | `apps/web/app/api/customers/[id]/route.ts` |
| `GET /api/customers/search` | `apps/web/app/api/customers/search/route.ts` |

### Tracking
| Route | File |
|-------|------|
| `GET /api/tracking/[token]` | `apps/web/app/api/tracking/[token]/route.ts` |
| `POST /api/tracking/update` | `apps/web/app/api/tracking/update/route.ts` |
| `POST /api/tracking/start` | `apps/web/app/api/tracking/start/route.ts` |

### Webhooks
| Route | File |
|-------|------|
| `POST /api/webhooks/whatsapp` | `apps/web/app/api/webhooks/whatsapp/route.ts` |
| `POST /api/webhooks/mercadopago` | `apps/web/app/api/webhooks/mercadopago/route.ts` |

## Domain Modules

### Jobs Module
| File | Purpose |
|------|---------|
| `src/modules/jobs/index.ts` | Job CRUD operations |
| `src/modules/jobs/state-machine.ts` | Job state transitions |
| `src/modules/jobs/assignment.ts` | Technician assignment |
| `src/modules/jobs/completion.ts` | Job completion logic |

### Tracking Module
| File | Purpose |
|------|---------|
| `src/modules/tracking/tracking.service.ts` | Main tracking service |
| `src/modules/tracking/eta/calculator.ts` | ETA calculation |
| `src/modules/tracking/tokens.ts` | Tracking token management |

### Notifications Module
| File | Purpose |
|------|---------|
| `src/modules/notifications/notification.service.ts` | Multi-channel delivery |
| `src/modules/notifications/delivery/whatsapp.ts` | WhatsApp delivery |
| `src/modules/notifications/delivery/push.ts` | Push notification delivery |
| `src/modules/notifications/reminders/scheduler.ts` | Job reminder scheduling |

### Invoices Module
| File | Purpose |
|------|---------|
| `src/modules/invoices/index.ts` | Invoice CRUD |
| `src/modules/invoices/afip-integration.ts` | AFIP electronic invoicing |
| `src/modules/invoices/pdf-generator.ts` | PDF generation |

### Users Module
| File | Purpose |
|------|---------|
| `src/modules/users/index.ts` | User CRUD |
| `src/modules/users/onboarding/employee-verification.service.ts` | Verification flow |
| `src/modules/users/onboarding/welcome-workflow.ts` | Onboarding steps |

### Audit Module
| File | Purpose |
|------|---------|
| `src/modules/audit/audit.service.ts` | Audit logging |
| `src/modules/audit/hash-chain.ts` | Hash chain integrity |

## External Integrations

### WhatsApp
| File | Purpose |
|------|---------|
| `src/integrations/whatsapp/whatsapp.service.ts` | Main WhatsApp service |
| `src/integrations/whatsapp/messages/send.ts` | Message sending |
| `src/integrations/whatsapp/webhook/handler.ts` | Webhook processing |
| `src/integrations/whatsapp/aggregation/message-aggregator.service.ts` | Message aggregation |
| `src/integrations/whatsapp/templates/argentina-templates.ts` | Argentine templates |
| `src/integrations/whatsapp/templates/template-registry.ts` | Template management |
| `src/integrations/whatsapp/customer/identification.ts` | Customer matching |

### MercadoPago
| File | Purpose |
|------|---------|
| `src/integrations/mercadopago/mercadopago.service.ts` | Main MP service |
| `src/integrations/mercadopago/oauth/connect.ts` | OAuth flow |
| `src/integrations/mercadopago/preference/create.ts` | Payment preferences |
| `src/integrations/mercadopago/webhook/handler.ts` | IPN handling |
| `src/integrations/mercadopago/chargeback/handler.ts` | Dispute management |

### AFIP
| File | Purpose |
|------|---------|
| `src/integrations/afip/afip.service.ts` | Main AFIP service |
| `src/integrations/afip/wsaa/auth.ts` | WSAA authentication |
| `src/integrations/afip/wsaa/token-manager.ts` | Token caching |
| `src/integrations/afip/wsfe/invoice.ts` | Electronic invoicing |
| `src/integrations/afip/padron/query.ts` | Taxpayer lookup |

### Voice AI
| File | Purpose |
|------|---------|
| `src/integrations/voice-ai/voice-ai.service.ts` | Main service |
| `src/integrations/voice-ai/transcription/whisper.ts` | Audio transcription |
| `src/integrations/voice-ai/extraction/gpt.ts` | Intent extraction |
| `src/integrations/voice-ai/routing/intent-router.ts` | Intent routing |

## Background Workers

| File | Purpose |
|------|---------|
| `src/workers/whatsapp/send.worker.ts` | WhatsApp message sending |
| `src/workers/whatsapp/aggregation-processor.worker.ts` | Buffer processing |
| `src/workers/notifications/reminder.worker.ts` | Reminder delivery |
| `src/workers/invoices/generate.worker.ts` | Invoice PDF generation |
| `src/workers/tracking/update.worker.ts` | Position updates |

## Shared Libraries

| File | Purpose |
|------|---------|
| `src/lib/queue/index.ts` | BullMQ queue setup |
| `src/lib/redis/client.ts` | Redis connection |
| `src/lib/logging/logger.ts` | Structured logging |
| `src/lib/middleware/rate-limit.ts` | Rate limiting |
| `src/lib/middleware/error-handler.ts` | Error handling |
| `src/lib/circuit-breaker.ts` | Circuit breaker pattern |

## Database

### Prisma Schema
| File | Purpose |
|------|---------|
| `apps/web/prisma/schema.prisma` | Main schema definition |

### SQL Migrations
| File | Purpose |
|------|---------|
| `database/migrations/001_create_organizations.sql` | Organizations table |
| `database/migrations/002_create_users.sql` | Users table |
| `database/migrations/003_create_customers.sql` | Customers table |
| `database/migrations/004_create_jobs.sql` | Jobs table |
| `database/migrations/005_create_invoices.sql` | Invoices table |
| `database/migrations/007_create_audit_logs.sql` | Audit logs |
| `database/migrations/015_create_notification_preferences.sql` | Notification prefs |
| `database/migrations/016_create_employee_verification.sql` | Verification tokens |
| `database/migrations/017_create_message_aggregation.sql` | Message buffers |
| `database/migrations/018_create_tracking.sql` | Tracking sessions |

## Mobile App

### Screens (Expo Router)
| File | Purpose |
|------|---------|
| `apps/mobile/app/(tabs)/_layout.tsx` | Tab navigation |
| `apps/mobile/app/(tabs)/today.tsx` | Today's jobs |
| `apps/mobile/app/(tabs)/jobs/index.tsx` | Job list |
| `apps/mobile/app/(tabs)/calendar/index.tsx` | Calendar view |
| `apps/mobile/app/(tabs)/invoices/index.tsx` | Invoices list |
| `apps/mobile/app/(tabs)/team/index.tsx` | Team management |
| `apps/mobile/app/settings/index.tsx` | Settings screen |

### Offline/Sync
| File | Purpose |
|------|---------|
| `apps/mobile/lib/sync/sync-engine.ts` | Bidirectional sync |
| `apps/mobile/lib/hooks/use-sync-status.ts` | Sync status hook |
| `apps/mobile/lib/hooks/use-offline-data.ts` | Offline data access |
| `apps/mobile/watermelon/database.ts` | WatermelonDB setup |
| `apps/mobile/watermelon/models/index.ts` | Data models |
| `apps/mobile/components/offline/ConflictResolver.tsx` | Conflict resolution UI |

### Components
| File | Purpose |
|------|---------|
| `apps/mobile/components/forms/PhoneInput.tsx` | Phone number input |
| `apps/mobile/components/job/JobCard.tsx` | Job card component |
| `apps/mobile/components/customer/CustomerCard.tsx` | Customer card |
| `apps/mobile/components/offline/OfflineBanner.tsx` | Offline indicator |

## Web Dashboard

### Pages (Next.js App Router)
| File | Purpose |
|------|---------|
| `apps/web/app/dashboard/page.tsx` | Dashboard home |
| `apps/web/app/dashboard/jobs/page.tsx` | Jobs list |
| `apps/web/app/dashboard/customers/page.tsx` | Customers list |
| `apps/web/app/dashboard/invoices/page.tsx` | Invoices list |
| `apps/web/app/dashboard/settings/page.tsx` | Settings |
| `apps/web/app/track/[token]/page.tsx` | Customer tracking page |

### Components
| File | Purpose |
|------|---------|
| `apps/web/components/maps/TrackingMap.tsx` | Interactive map |
| `apps/web/components/maps/map-providers.ts` | Map provider abstraction |
| `apps/web/components/maps/marker-animation.ts` | Marker animations |

## Validation Schemas

| File | Purpose |
|------|---------|
| `src/validation/job.schema.ts` | Job validation |
| `src/validation/customer.schema.ts` | Customer validation |
| `src/validation/invoice.schema.ts` | Invoice validation |
| `src/validation/user.schema.ts` | User validation |
| `src/validation/common.ts` | Common validators (CUIT, phone) |

## Documentation

| File | Purpose |
|------|---------|
| `docs/architecture/overview.md` | Architecture overview |
| `docs/architecture/high-level-architecture.md` | System architecture |
| `docs/architecture/data-flow.md` | Data flow diagrams |
| `docs/architecture/security-architecture.md` | Security patterns |
| `docs/architecture/integration-patterns.md` | Integration patterns |
| `docs/mobile-first-guidelines.md` | Mobile development guidelines |
| `docs/mobile-parity-checklist.md` | Feature parity tracking |
| `docs/AUDIT-METHODOLOGY.md` | Audit process |

### Architecture Decision Records (ADRs)
| File | Decision |
|------|----------|
| `docs/architecture/decision-records/ADR-001-whatsapp-aggregator-model.md` | Message aggregation |
| `docs/architecture/decision-records/ADR-002-mobile-first-strategy.md` | Mobile-first approach |
| `docs/architecture/decision-records/ADR-003-map-provider-selection.md` | Map provider tiers |
| `docs/architecture/decision-records/ADR-004-offline-sync-strategy.md` | Offline sync approach |

## Configuration Files

| File | Purpose |
|------|---------|
| `apps/web/next.config.js` | Next.js configuration |
| `apps/mobile/app.json` | Expo configuration |
| `apps/mobile/eas.json` | EAS Build configuration |
| `tsconfig.json` | TypeScript configuration |
| `.env.example` | Environment variables template |

## Testing

| File | Purpose |
|------|---------|
| `__tests__/modules/jobs.test.ts` | Job module tests |
| `__tests__/integrations/whatsapp.test.ts` | WhatsApp integration tests |
| `__tests__/api/auth.test.ts` | Auth API tests |
| `jest.config.js` | Jest configuration |

## Related Documentation

- [High-Level Architecture](./high-level-architecture.md)
- [Data Flow](./data-flow.md)
- [Security Architecture](./security-architecture.md)
- [Integration Patterns](./integration-patterns.md)
