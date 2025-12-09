# CampoTech Module Dependency Diagram

**Version:** 1.0
**Last Updated:** December 2024
**Phase:** 9.11 Technical Architecture Documentation

## Overview

This document illustrates the dependencies between modules in the CampoTech system, helping developers understand the relationships and import directions.

## Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          MODULE DEPENDENCY DIAGRAM                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                          API LAYER                                      │   │
│   │                                                                         │   │
│   │   apps/web/app/api/*                                                    │   │
│   │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │   │
│   │   │  auth   │ │  jobs   │ │customers│ │invoices │ │tracking │          │   │
│   │   └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │   │
│   │        │           │           │           │           │                │   │
│   └────────┼───────────┼───────────┼───────────┼───────────┼────────────────┘   │
│            │           │           │           │           │                    │
│            ▼           ▼           ▼           ▼           ▼                    │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                       DOMAIN MODULES                                    │   │
│   │                       src/modules/                                      │   │
│   │                                                                         │   │
│   │   ┌───────────────────────────────────────────────────────────────┐     │   │
│   │   │                         users                                 │     │   │
│   │   │   ┌─────────────────────────────────────────────────────┐     │     │   │
│   │   │   │ onboarding/employee-verification.service.ts         │     │     │   │
│   │   │   └─────────────────────────────────────────────────────┘     │     │   │
│   │   └───────────────────────┬───────────────────────────────────────┘     │   │
│   │                           │                                             │   │
│   │                           │ creates                                     │   │
│   │                           ▼                                             │   │
│   │   ┌───────────────────────────────────────────────────────────────┐     │   │
│   │   │                         jobs                                  │     │   │
│   │   │   ┌─────────────────────────────────────────────────────┐     │     │   │
│   │   │   │ index.ts ──────────────────────────────────────────▶│     │     │   │
│   │   │   │ state-machine.ts                                    │     │     │   │
│   │   │   └─────────────────────────────────────────────────────┘     │     │   │
│   │   └───────────┬───────────────────────────────────┬───────────────┘     │   │
│   │               │                                   │                     │   │
│   │      triggers │                          creates  │                     │   │
│   │               ▼                                   ▼                     │   │
│   │   ┌───────────────────────┐           ┌───────────────────────┐         │   │
│   │   │       tracking        │           │       invoices        │         │   │
│   │   │                       │           │                       │         │   │
│   │   │ tracking.service.ts   │           │ index.ts              │         │   │
│   │   │ eta/calculator.ts     │           │ afip-integration.ts   │         │   │
│   │   └───────────┬───────────┘           └───────────┬───────────┘         │   │
│   │               │                                   │                     │   │
│   │               │ notifies                 requires │                     │   │
│   │               ▼                                   ▼                     │   │
│   │   ┌───────────────────────────────────────────────────────────────┐     │   │
│   │   │                     notifications                             │     │   │
│   │   │                                                               │     │   │
│   │   │   notification.service.ts                                     │     │   │
│   │   │   ├── delivery/whatsapp.ts                                    │     │   │
│   │   │   ├── delivery/push.ts                                        │     │   │
│   │   │   └── delivery/email.ts                                       │     │   │
│   │   └───────────────────────────────────────────────────────────────┘     │   │
│   │                           │                                             │   │
│   │                           │ uses                                        │   │
│   │                           ▼                                             │   │
│   │   ┌───────────────────────────────────────────────────────────────┐     │   │
│   │   │                    audit                                      │     │   │
│   │   │   audit.service.ts                                            │     │   │
│   │   └───────────────────────────────────────────────────────────────┘     │   │
│   │                                                                         │   │
│   │   ┌───────────────────────┐           ┌───────────────────────┐         │   │
│   │   │      customers        │           │      pricebook        │         │   │
│   │   │   index.ts            │           │   index.ts            │         │   │
│   │   └───────────────────────┘           └───────────────────────┘         │   │
│   │                                                                         │   │
│   │   ┌───────────────────────┐           ┌───────────────────────┐         │   │
│   │   │     organizations     │           │       payments        │         │   │
│   │   │   index.ts            │           │   index.ts            │         │   │
│   │   └───────────────────────┘           └───────────────────────┘         │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    │ uses                                       │
│                                    ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                       INTEGRATIONS                                      │   │
│   │                       src/integrations/                                 │   │
│   │                                                                         │   │
│   │   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │   │
│   │   │     whatsapp     │  │   mercadopago    │  │       afip       │     │   │
│   │   │                  │  │                  │  │                  │     │   │
│   │   │ whatsapp.service │  │ mercadopago.svc  │  │ afip.service     │     │   │
│   │   │ ├── messages/    │  │ ├── oauth/       │  │ ├── wsaa/        │     │   │
│   │   │ ├── webhook/     │  │ ├── preference/  │  │ ├── wsfe/        │     │   │
│   │   │ ├── aggregation/ │  │ ├── webhook/     │  │ └── padron/      │     │   │
│   │   │ └── templates/   │  │ └── chargeback/  │  │                  │     │   │
│   │   └──────────────────┘  └──────────────────┘  └──────────────────┘     │   │
│   │                                                                         │   │
│   │   ┌──────────────────┐  ┌──────────────────┐                           │   │
│   │   │     voice-ai     │  │      maps        │                           │   │
│   │   │                  │  │                  │                           │   │
│   │   │ voice-ai.service │  │ map-providers.ts │                           │   │
│   │   │ ├── transcribe/  │  │ marker-anim.ts   │                           │   │
│   │   │ ├── extraction/  │  │                  │                           │   │
│   │   │ └── routing/     │  │                  │                           │   │
│   │   └──────────────────┘  └──────────────────┘                           │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    │ uses                                       │
│                                    ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                      SHARED LIBRARIES                                   │   │
│   │                      src/lib/                                           │   │
│   │                                                                         │   │
│   │   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐       │   │
│   │   │   queue    │  │   redis    │  │  logging   │  │ middleware │       │   │
│   │   │   index.ts │  │  client.ts │  │  logger.ts │  │ rate-limit │       │   │
│   │   │   workers/ │  │            │  │            │  │ authorize  │       │   │
│   │   └────────────┘  └────────────┘  └────────────┘  └────────────┘       │   │
│   │                                                                         │   │
│   │   ┌────────────┐  ┌────────────┐                                       │   │
│   │   │  circuit-  │  │   retry    │                                       │   │
│   │   │  breaker   │  │            │                                       │   │
│   │   └────────────┘  └────────────┘                                       │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    │ persists to                                │
│                                    ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                       DATA LAYER                                        │   │
│   │                                                                         │   │
│   │   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │   │
│   │   │   PostgreSQL     │  │      Redis       │  │    S3/R2         │     │   │
│   │   │   (Prisma)       │  │   (Upstash)      │  │  (Files)         │     │   │
│   │   └──────────────────┘  └──────────────────┘  └──────────────────┘     │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Dependency Rules

### Layer Dependencies (Top to Bottom)

```
API Layer → Domain Modules → Integrations → Shared Libraries → Data Layer
```

**Rules:**
1. Higher layers can depend on lower layers
2. Lower layers CANNOT depend on higher layers
3. Same-layer dependencies are allowed but should be minimal

### Module Import Restrictions

| Module | Can Import From | Cannot Import From |
|--------|-----------------|-------------------|
| API Routes | modules, integrations, lib | Other API routes |
| Domain Modules | integrations, lib, other modules | API routes |
| Integrations | lib only | modules, API routes |
| Shared Libraries | Nothing (base layer) | All higher layers |

## Key Dependencies by Module

### Jobs Module

```typescript
// src/modules/jobs/index.ts

// Dependencies
import { prisma } from '@/lib/prisma';           // Data layer
import { trackingService } from '../tracking';   // Sibling module
import { notificationService } from '../notifications'; // Sibling
import { auditService } from '../audit';         // Sibling
import { whatsappService } from '@/integrations/whatsapp'; // Integration
```

**Dependencies:**
- tracking (for auto-start on EN_CAMINO)
- notifications (for status updates)
- audit (for logging changes)
- whatsapp (for template messages)

### Tracking Module

```typescript
// src/modules/tracking/tracking.service.ts

// Dependencies
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { notificationService } from '../notifications';
import { whatsappService } from '@/integrations/whatsapp';
import { mapProvider } from '@/integrations/maps';
```

**Dependencies:**
- notifications (for arrival notifications)
- whatsapp (for tracking link delivery)
- maps (for route calculation, ETA)

### Notifications Module

```typescript
// src/modules/notifications/notification.service.ts

// Dependencies
import { prisma } from '@/lib/prisma';
import { whatsappService } from '@/integrations/whatsapp';
import { pushService } from '@/integrations/push';
import { emailService } from '@/integrations/email';
import { queue } from '@/lib/queue';
```

**Dependencies:**
- whatsapp (primary delivery channel)
- push (mobile notifications)
- email (document delivery)
- queue (async delivery)

### Invoices Module

```typescript
// src/modules/invoices/index.ts

// Dependencies
import { prisma } from '@/lib/prisma';
import { afipService } from '@/integrations/afip';
import { notificationService } from '../notifications';
import { queue } from '@/lib/queue';
```

**Dependencies:**
- afip (electronic invoicing)
- notifications (invoice delivery)
- queue (PDF generation)

### WhatsApp Integration

```typescript
// src/integrations/whatsapp/whatsapp.service.ts

// Dependencies (integration layer - minimal)
import { redis } from '@/lib/redis';
import { queue } from '@/lib/queue';
import { logger } from '@/lib/logging';
import { circuitBreaker } from '@/lib/circuit-breaker';
```

**Dependencies:**
- redis (message buffers, rate limiting)
- queue (async message delivery)
- logger (structured logging)
- circuit-breaker (resilience)

## Circular Dependency Prevention

### Problem Patterns

```
❌ BAD: Circular dependency
jobs → notifications → jobs
```

### Solution Patterns

```typescript
// Option 1: Event-based decoupling
// jobs/index.ts
eventEmitter.emit('job:completed', job);

// notifications/index.ts
eventEmitter.on('job:completed', (job) => {
  notificationService.send(...);
});

// Option 2: Dependency injection
// jobs/index.ts
class JobsModule {
  constructor(private notificationService: NotificationService) {}
}

// Option 3: Shared interface in lib
// lib/types/events.ts
interface JobCompletedEvent {
  jobId: string;
  customerId: string;
}
```

## Dependency Injection Pattern

```typescript
// src/lib/container.ts

interface Container {
  // Modules
  jobsModule: JobsModule;
  trackingModule: TrackingModule;
  notificationsModule: NotificationsModule;

  // Integrations
  whatsappService: WhatsAppService;
  afipService: AFIPService;

  // Infrastructure
  prisma: PrismaClient;
  redis: Redis;
  queue: Queue;
}

// Usage in API routes
// apps/web/app/api/jobs/route.ts
import { container } from '@/lib/container';

export async function POST(req: Request) {
  const job = await container.jobsModule.create(data);
  return NextResponse.json(job);
}
```

## Testing with Dependencies

```typescript
// __tests__/modules/jobs.test.ts

// Mock dependencies
const mockNotifications = {
  send: jest.fn()
};

const mockTracking = {
  createSession: jest.fn()
};

// Create module with mocked dependencies
const jobsModule = new JobsModule({
  notifications: mockNotifications,
  tracking: mockTracking
});

describe('JobsModule', () => {
  it('creates tracking session on EN_CAMINO', async () => {
    await jobsModule.transition(jobId, 'en_camino');

    expect(mockTracking.createSession).toHaveBeenCalledWith(
      jobId,
      expect.any(String)
    );
  });
});
```

## Dependency Versioning

### Internal Dependencies

All internal modules use relative imports:

```typescript
// Correct
import { trackingService } from '../tracking';
import { prisma } from '@/lib/prisma';

// Incorrect (avoid package-style imports for internal modules)
import { trackingService } from '@campotech/tracking';
```

### External Dependencies

Managed via `package.json` with strict versioning:

```json
{
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "bullmq": "^4.0.0",
    "ioredis": "^5.0.0",
    "zod": "^3.22.0"
  }
}
```

## Related Documentation

- [High-Level Architecture](./high-level-architecture.md)
- [Key File Locations](./key-file-locations.md)
- [Integration Patterns](./integration-patterns.md)
