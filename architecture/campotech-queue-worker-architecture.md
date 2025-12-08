# CampoTech Queue & Worker Architecture

> Complete technical specification for background job processing, queue management, and worker orchestration.

---

## 1. Technology Stack

### 1.1 Primary Queue Technology: BullMQ

**Decision: BullMQ on Redis 7+**

| Criteria | BullMQ | Redis Streams | RabbitMQ |
|----------|--------|---------------|----------|
| Node.js Native | ✓ Excellent | Requires wrapper | Via amqplib |
| Delayed Jobs | ✓ Built-in | Manual implementation | Plugin required |
| Rate Limiting | ✓ Built-in | Manual | Manual |
| Priority Queues | ✓ Built-in | Manual | ✓ Built-in |
| Repeatable Jobs | ✓ Built-in | Manual | Manual |
| Dashboard | ✓ Bull Board | None | Management UI |
| Serverless Compatible | ✓ Yes | Yes | Requires persistent connection |
| Complexity | Low | Medium | High |

**Rationale:**
- Native TypeScript support aligns with Next.js/Node.js stack
- Built-in delayed jobs for scheduling (reminders, retries)
- Built-in rate limiting for external API calls (AFIP, WhatsApp)
- Excellent observability with Bull Board
- Proven at scale (used by GitLab, Mozilla)

### 1.2 Infrastructure Requirements

```yaml
# Redis Configuration
redis:
  version: "7.2+"
  deployment: "Upstash Redis" # Serverless, multi-region
  
  # Production Settings
  maxmemory: "2gb"
  maxmemory-policy: "noeviction"  # Critical for queues
  
  # Persistence
  appendonly: "yes"
  appendfsync: "everysec"
  
  # Connection Pool
  maxclients: 10000
  timeout: 0  # No timeout for workers
  
  # TLS Required
  tls: true
  
  # Cluster Mode (Production)
  cluster-enabled: "yes"
  cluster-node-timeout: 5000
```

### 1.3 BullMQ Configuration

```typescript
// lib/queue/config.ts

import { QueueOptions, WorkerOptions } from 'bullmq';

export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.NODE_ENV === 'production' ? {} : undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
};

export const DEFAULT_QUEUE_OPTIONS: QueueOptions = {
  connection: REDIS_CONFIG,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 24 * 3600,      // Keep completed jobs for 24 hours
      count: 1000,          // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600,  // Keep failed jobs for 7 days
    },
  },
};

export const DEFAULT_WORKER_OPTIONS: WorkerOptions = {
  connection: REDIS_CONFIG,
  concurrency: 5,
  limiter: {
    max: 100,
    duration: 60000, // 100 jobs per minute default
  },
  lockDuration: 30000,      // 30 second lock
  lockRenewTime: 15000,     // Renew every 15 seconds
  stalledInterval: 30000,   // Check stalled every 30 seconds
  maxStalledCount: 2,       // Move to failed after 2 stalls
};
```

---

## 2. Queue Definitions

### 2.1 Queue Registry

```typescript
// lib/queue/queues.ts

export enum QueueName {
  // High Priority - Critical Path
  AFIP_INVOICE = 'afip:invoice',
  PAYMENT_WEBHOOK = 'payment:webhook',
  WHATSAPP_OUTBOUND = 'whatsapp:outbound',
  
  // Normal Priority - Core Operations  
  WHATSAPP_INBOUND = 'whatsapp:inbound',
  VOICE_TRANSCRIPTION = 'voice:transcription',
  VOICE_EXTRACTION = 'voice:extraction',
  JOB_NOTIFICATION = 'job:notification',
  INVOICE_PDF = 'invoice:pdf',
  
  // Low Priority - Background Tasks
  SYNC_OFFLINE = 'sync:offline',
  RECONCILIATION = 'reconciliation',
  CLEANUP = 'cleanup',
  ANALYTICS = 'analytics',
  
  // Scheduled
  SCHEDULER = 'scheduler',
}

export const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = {
  [QueueName.AFIP_INVOICE]: {
    priority: 'high',
    rateLimit: { max: 10, duration: 60000 }, // AFIP rate limit
    concurrency: 3,
    attempts: 5,
    backoff: 'afip',
    timeout: 60000,
    isolation: 'shared', // All orgs share AFIP queue
    ordered: true,       // Per-org ordering required
  },
  
  [QueueName.PAYMENT_WEBHOOK]: {
    priority: 'high',
    rateLimit: { max: 100, duration: 60000 },
    concurrency: 10,
    attempts: 5,
    backoff: 'exponential',
    timeout: 30000,
    isolation: 'shared',
    ordered: false,
    idempotent: true,
  },
  
  [QueueName.WHATSAPP_OUTBOUND]: {
    priority: 'high',
    rateLimit: { max: 50, duration: 60000 }, // WhatsApp limit
    concurrency: 5,
    attempts: 3,
    backoff: 'whatsapp',
    timeout: 30000,
    isolation: 'per-org', // Rate limits per org
    ordered: true,        // Message ordering matters
  },
  
  [QueueName.WHATSAPP_INBOUND]: {
    priority: 'normal',
    rateLimit: { max: 200, duration: 60000 },
    concurrency: 20,
    attempts: 3,
    backoff: 'exponential',
    timeout: 10000,
    isolation: 'shared',
    ordered: false,
  },
  
  [QueueName.VOICE_TRANSCRIPTION]: {
    priority: 'normal',
    rateLimit: { max: 20, duration: 60000 }, // OpenAI Whisper limits
    concurrency: 5,
    attempts: 3,
    backoff: 'exponential',
    timeout: 120000, // 2 min for long audio
    isolation: 'shared',
    ordered: false,
  },
  
  [QueueName.VOICE_EXTRACTION]: {
    priority: 'normal',
    rateLimit: { max: 50, duration: 60000 },
    concurrency: 10,
    attempts: 3,
    backoff: 'exponential',
    timeout: 30000,
    isolation: 'shared',
    ordered: false,
  },
  
  [QueueName.JOB_NOTIFICATION]: {
    priority: 'normal',
    rateLimit: { max: 100, duration: 60000 },
    concurrency: 10,
    attempts: 3,
    backoff: 'exponential',
    timeout: 30000,
    isolation: 'per-org',
    ordered: false,
  },
  
  [QueueName.INVOICE_PDF]: {
    priority: 'normal',
    rateLimit: { max: 50, duration: 60000 },
    concurrency: 5,
    attempts: 3,
    backoff: 'exponential',
    timeout: 60000,
    isolation: 'shared',
    ordered: false,
  },
  
  [QueueName.SYNC_OFFLINE]: {
    priority: 'low',
    rateLimit: { max: 100, duration: 60000 },
    concurrency: 10,
    attempts: 5,
    backoff: 'exponential',
    timeout: 30000,
    isolation: 'per-org',
    ordered: true, // Order matters for conflict resolution
  },
  
  [QueueName.RECONCILIATION]: {
    priority: 'low',
    rateLimit: { max: 5, duration: 60000 },
    concurrency: 2,
    attempts: 3,
    backoff: 'exponential',
    timeout: 300000, // 5 min
    isolation: 'shared',
    ordered: false,
  },
  
  [QueueName.CLEANUP]: {
    priority: 'low',
    rateLimit: { max: 10, duration: 60000 },
    concurrency: 2,
    attempts: 2,
    backoff: 'fixed',
    timeout: 60000,
    isolation: 'shared',
    ordered: false,
  },
  
  [QueueName.ANALYTICS]: {
    priority: 'low',
    rateLimit: { max: 50, duration: 60000 },
    concurrency: 5,
    attempts: 2,
    backoff: 'fixed',
    timeout: 30000,
    isolation: 'shared',
    ordered: false,
  },
  
  [QueueName.SCHEDULER]: {
    priority: 'normal',
    rateLimit: { max: 100, duration: 60000 },
    concurrency: 5,
    attempts: 3,
    backoff: 'exponential',
    timeout: 10000,
    isolation: 'shared',
    ordered: false,
  },
};

interface QueueConfig {
  priority: 'high' | 'normal' | 'low';
  rateLimit: { max: number; duration: number };
  concurrency: number;
  attempts: number;
  backoff: BackoffStrategy;
  timeout: number;
  isolation: 'shared' | 'per-org';
  ordered: boolean;
  idempotent?: boolean;
}

type BackoffStrategy = 'exponential' | 'fixed' | 'afip' | 'whatsapp';
```

---

## 3. Backoff Strategies

### 3.1 Backoff Curve Definitions

```typescript
// lib/queue/backoff.ts

export const BACKOFF_STRATEGIES = {
  // Standard exponential: 1s, 2s, 4s, 8s, 16s (capped at 5 min)
  exponential: {
    type: 'exponential' as const,
    delay: 1000,
  },
  
  // Fixed delay: always 30 seconds
  fixed: {
    type: 'fixed' as const,
    delay: 30000,
  },
  
  // AFIP-specific: longer delays due to service instability
  // 30s, 2min, 5min, 15min, 30min
  afip: {
    type: 'custom' as const,
    delay: (attemptsMade: number) => {
      const delays = [30000, 120000, 300000, 900000, 1800000];
      return delays[Math.min(attemptsMade - 1, delays.length - 1)];
    },
  },
  
  // WhatsApp-specific: respect rate limit windows
  // 5s, 15s, 60s (rate limit window)
  whatsapp: {
    type: 'custom' as const,
    delay: (attemptsMade: number) => {
      const delays = [5000, 15000, 60000];
      return delays[Math.min(attemptsMade - 1, delays.length - 1)];
    },
  },
};

// Backoff curve visualization:
// 
// EXPONENTIAL (default)
// Attempt | Delay    | Total Wait
// --------|----------|------------
// 1       | 1s       | 1s
// 2       | 2s       | 3s
// 3       | 4s       | 7s
// 4       | 8s       | 15s
// 5       | 16s      | 31s
// 6+      | 5min cap | varies
//
// AFIP (service outages)
// Attempt | Delay    | Total Wait
// --------|----------|------------
// 1       | 30s      | 30s
// 2       | 2min     | 2.5min
// 3       | 5min     | 7.5min
// 4       | 15min    | 22.5min
// 5       | 30min    | 52.5min
//
// WHATSAPP (rate limits)
// Attempt | Delay    | Total Wait
// --------|----------|------------
// 1       | 5s       | 5s
// 2       | 15s      | 20s
// 3       | 60s      | 80s
```

### 3.2 Jitter Implementation

```typescript
// Add jitter to prevent thundering herd
export function addJitter(delay: number, jitterPercent: number = 0.2): number {
  const jitter = delay * jitterPercent * (Math.random() * 2 - 1);
  return Math.max(1000, Math.floor(delay + jitter));
}

// Example: 10000ms with 20% jitter = 8000ms to 12000ms
```

---

## 4. Priority System

### 4.1 Priority Levels

```typescript
// lib/queue/priority.ts

export enum JobPriority {
  CRITICAL = 1,    // System health, panic recovery
  HIGH = 5,        // Payments, AFIP (revenue-critical)
  NORMAL = 10,     // Standard operations
  LOW = 20,        // Background tasks
  BULK = 50,       // Batch operations, imports
}

// Priority affects:
// 1. Processing order within a queue
// 2. Worker resource allocation
// 3. Timeout handling (higher priority = longer timeout tolerance)

export const PRIORITY_TIMEOUTS: Record<JobPriority, number> = {
  [JobPriority.CRITICAL]: 300000,  // 5 min
  [JobPriority.HIGH]: 120000,      // 2 min
  [JobPriority.NORMAL]: 60000,     // 1 min
  [JobPriority.LOW]: 30000,        // 30s
  [JobPriority.BULK]: 600000,      // 10 min (batch)
};
```

### 4.2 Dynamic Priority Adjustment

```typescript
// Increase priority based on:
// - Job age (older jobs get priority boost)
// - Retry count (to prevent starvation)
// - Customer tier (future: premium customers)

export function calculateEffectivePriority(job: Job): number {
  let priority = job.opts.priority || JobPriority.NORMAL;
  
  // Age boost: +1 priority per 5 minutes waiting
  const ageMinutes = (Date.now() - job.timestamp) / 60000;
  const ageBoost = Math.floor(ageMinutes / 5);
  
  // Retry boost: +2 priority per retry
  const retryBoost = (job.attemptsMade || 0) * 2;
  
  // Lower number = higher priority
  return Math.max(1, priority - ageBoost - retryBoost);
}
```

---

## 5. Tenant Isolation

### 5.1 Isolation Strategies

```typescript
// lib/queue/isolation.ts

// Strategy 1: Shared Queue with Org Prefix (Default)
// All orgs share infrastructure, jobs tagged with orgId
// Pros: Simple, cost-effective
// Cons: Noisy neighbor risk

// Strategy 2: Per-Org Rate Limiting
// Shared queue but per-org rate limits
// Pros: Fair resource allocation
// Cons: Complexity

// Strategy 3: Per-Org Queues (Premium)
// Separate queues for high-volume orgs
// Pros: Complete isolation
// Cons: Resource overhead

export class TenantIsolation {
  // Get queue name with optional tenant isolation
  static getQueueName(
    baseQueue: QueueName, 
    orgId: string,
    config: QueueConfig
  ): string {
    if (config.isolation === 'per-org') {
      return `${baseQueue}:${orgId}`;
    }
    return baseQueue;
  }
  
  // Per-org rate limiter key
  static getRateLimitKey(queue: QueueName, orgId: string): string {
    return `ratelimit:${queue}:${orgId}`;
  }
  
  // Check if org is rate limited
  static async isOrgRateLimited(
    redis: Redis,
    queue: QueueName,
    orgId: string,
    config: QueueConfig
  ): Promise<boolean> {
    const key = this.getRateLimitKey(queue, orgId);
    const count = await redis.incr(key);
    
    if (count === 1) {
      await redis.pexpire(key, config.rateLimit.duration);
    }
    
    return count > config.rateLimit.max;
  }
}
```

### 5.2 Fair Scheduling

```typescript
// Round-robin processing across orgs to prevent monopolization
export class FairScheduler {
  private orgCursors: Map<QueueName, string[]> = new Map();
  
  async getNextOrg(queue: QueueName): Promise<string | null> {
    const orgs = this.orgCursors.get(queue) || [];
    if (orgs.length === 0) return null;
    
    // Rotate: move first org to end
    const nextOrg = orgs.shift()!;
    orgs.push(nextOrg);
    this.orgCursors.set(queue, orgs);
    
    return nextOrg;
  }
  
  async refreshOrgList(queue: QueueName, redis: Redis): Promise<void> {
    // Get all orgs with pending jobs in this queue
    const pattern = `bull:${queue}:*:waiting`;
    const keys = await redis.keys(pattern);
    const orgs = keys.map(k => k.split(':')[2]).filter(Boolean);
    this.orgCursors.set(queue, [...new Set(orgs)]);
  }
}
```

---

## 6. Worker Architecture

### 6.1 Worker Pool Configuration

```typescript
// lib/queue/workers.ts

export const WORKER_POOLS = {
  // High-priority pool: dedicated resources
  high: {
    queues: [
      QueueName.AFIP_INVOICE,
      QueueName.PAYMENT_WEBHOOK,
      QueueName.WHATSAPP_OUTBOUND,
    ],
    instances: 2,
    concurrencyPerInstance: 5,
    memoryLimit: '512Mi',
    cpuLimit: '500m',
  },
  
  // Normal pool: standard operations
  normal: {
    queues: [
      QueueName.WHATSAPP_INBOUND,
      QueueName.VOICE_TRANSCRIPTION,
      QueueName.VOICE_EXTRACTION,
      QueueName.JOB_NOTIFICATION,
      QueueName.INVOICE_PDF,
    ],
    instances: 3,
    concurrencyPerInstance: 10,
    memoryLimit: '1Gi',
    cpuLimit: '1000m',
  },
  
  // Low-priority pool: background tasks
  low: {
    queues: [
      QueueName.SYNC_OFFLINE,
      QueueName.RECONCILIATION,
      QueueName.CLEANUP,
      QueueName.ANALYTICS,
    ],
    instances: 1,
    concurrencyPerInstance: 5,
    memoryLimit: '256Mi',
    cpuLimit: '250m',
  },
  
  // Scheduler pool: cron-like jobs
  scheduler: {
    queues: [QueueName.SCHEDULER],
    instances: 1,
    concurrencyPerInstance: 5,
    memoryLimit: '256Mi',
    cpuLimit: '250m',
  },
};

// Total resources:
// - High: 2 instances × (512Mi RAM, 0.5 CPU) = 1Gi RAM, 1 CPU
// - Normal: 3 instances × (1Gi RAM, 1 CPU) = 3Gi RAM, 3 CPU
// - Low: 1 instance × (256Mi RAM, 0.25 CPU) = 256Mi RAM, 0.25 CPU
// - Scheduler: 1 instance × (256Mi RAM, 0.25 CPU) = 256Mi RAM, 0.25 CPU
// TOTAL: ~4.5Gi RAM, ~4.5 CPU
```

### 6.2 Worker Implementation

```typescript
// workers/base-worker.ts

import { Worker, Job, QueueEvents } from 'bullmq';
import { metrics } from '../lib/metrics';

export abstract class BaseWorker<T = unknown> {
  protected worker: Worker;
  protected queueEvents: QueueEvents;
  
  constructor(
    protected queueName: QueueName,
    protected config: QueueConfig
  ) {
    this.worker = new Worker(
      queueName,
      this.process.bind(this),
      {
        connection: REDIS_CONFIG,
        concurrency: config.concurrency,
        limiter: config.rateLimit,
        lockDuration: config.timeout + 10000,
        stalledInterval: Math.min(config.timeout / 2, 30000),
      }
    );
    
    this.setupEventHandlers();
    this.setupMetrics();
  }
  
  // Abstract method - implement in concrete workers
  abstract process(job: Job<T>): Promise<unknown>;
  
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      metrics.increment(`queue.${this.queueName}.completed`);
      metrics.timing(`queue.${this.queueName}.duration`, job.finishedOn! - job.processedOn!);
    });
    
    this.worker.on('failed', (job, err) => {
      metrics.increment(`queue.${this.queueName}.failed`);
      metrics.increment(`queue.${this.queueName}.error.${err.name}`);
      
      if (job && job.attemptsMade >= this.config.attempts) {
        this.moveToDLQ(job, err);
      }
    });
    
    this.worker.on('stalled', (jobId) => {
      metrics.increment(`queue.${this.queueName}.stalled`);
      console.warn(`Job ${jobId} stalled in ${this.queueName}`);
    });
    
    this.worker.on('error', (err) => {
      metrics.increment(`queue.${this.queueName}.worker_error`);
      console.error(`Worker error in ${this.queueName}:`, err);
    });
  }
  
  private async moveToDLQ(job: Job<T>, error: Error): Promise<void> {
    const dlqQueue = new Queue('dlq', { connection: REDIS_CONFIG });
    
    await dlqQueue.add('failed-job', {
      originalQueue: this.queueName,
      originalJobId: job.id,
      jobData: job.data,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      attempts: job.attemptsMade,
      failedAt: new Date().toISOString(),
      orgId: (job.data as any).orgId,
    });
    
    metrics.increment(`queue.dlq.added`);
  }
  
  private setupMetrics(): void {
    // Emit queue depth every 10 seconds
    setInterval(async () => {
      const counts = await this.worker.getJobCounts();
      metrics.gauge(`queue.${this.queueName}.waiting`, counts.waiting);
      metrics.gauge(`queue.${this.queueName}.active`, counts.active);
      metrics.gauge(`queue.${this.queueName}.delayed`, counts.delayed);
      metrics.gauge(`queue.${this.queueName}.failed`, counts.failed);
    }, 10000);
  }
  
  async shutdown(): Promise<void> {
    await this.worker.close();
    await this.queueEvents?.close();
  }
}
```

### 6.3 Concrete Worker Examples

```typescript
// workers/afip-invoice-worker.ts

interface AfipInvoiceJob {
  orgId: string;
  invoiceId: string;
  idempotencyKey: string;
  attempt: number;
}

export class AfipInvoiceWorker extends BaseWorker<AfipInvoiceJob> {
  constructor() {
    super(QueueName.AFIP_INVOICE, QUEUE_CONFIGS[QueueName.AFIP_INVOICE]);
  }
  
  async process(job: Job<AfipInvoiceJob>): Promise<{ cae: string; expiry: string }> {
    const { orgId, invoiceId, idempotencyKey } = job.data;
    
    // Check idempotency
    const existing = await this.checkIdempotency(idempotencyKey);
    if (existing) {
      return existing;
    }
    
    // Check panic mode
    if (await this.isPanicMode('afip')) {
      throw new PanicModeError('AFIP service in panic mode');
    }
    
    try {
      // Get invoice and org data
      const invoice = await db.invoices.findUnique({ where: { id: invoiceId } });
      const org = await db.organizations.findUnique({ where: { id: orgId } });
      
      // Call AFIP
      const result = await afipService.requestCAE(org, invoice);
      
      // Store result
      await this.storeIdempotency(idempotencyKey, result);
      
      // Update invoice
      await db.invoices.update({
        where: { id: invoiceId },
        data: {
          cae: result.cae,
          caeExpiry: result.expiry,
          status: 'issued',
        },
      });
      
      // Queue PDF generation
      await pdfQueue.add('generate', { invoiceId }, { priority: JobPriority.NORMAL });
      
      // Queue customer notification
      await notificationQueue.add('invoice-ready', { invoiceId }, { priority: JobPriority.NORMAL });
      
      return result;
      
    } catch (error) {
      if (error instanceof AfipError) {
        metrics.increment('afip.error', { code: error.code });
        
        if (error.isRetryable) {
          throw error; // Will retry with backoff
        }
        
        // Non-retryable: mark invoice as failed
        await db.invoices.update({
          where: { id: invoiceId },
          data: {
            status: 'failed',
            afipError: error.message,
          },
        });
        
        return { cae: '', expiry: '' };
      }
      
      throw error;
    }
  }
}
```

---

## 7. Message Schemas

### 7.1 Base Message Schema

```typescript
// lib/queue/schemas.ts

import { z } from 'zod';

// Base schema all messages must include
const BaseJobSchema = z.object({
  orgId: z.string().uuid(),
  idempotencyKey: z.string().min(16).max(64),
  correlationId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  priority: z.number().int().min(1).max(100).optional(),
  metadata: z.record(z.string()).optional(),
});
```

### 7.2 Queue-Specific Schemas

```typescript
// AFIP Invoice Queue
export const AfipInvoiceJobSchema = BaseJobSchema.extend({
  invoiceId: z.string().uuid(),
  invoiceType: z.enum(['A', 'B', 'C']),
  puntoVenta: z.number().int().min(1).max(99999),
  customerId: z.string().uuid(),
  total: z.number().positive(),
});

// Payment Webhook Queue
export const PaymentWebhookJobSchema = BaseJobSchema.extend({
  webhookId: z.string(),
  eventType: z.enum(['payment', 'chargeback', 'refund']),
  mpPaymentId: z.string(),
  rawPayload: z.record(z.unknown()),
  receivedAt: z.string().datetime(),
  signature: z.string(),
});

// WhatsApp Outbound Queue
export const WhatsAppOutboundJobSchema = BaseJobSchema.extend({
  messageType: z.enum(['text', 'template', 'media']),
  recipientPhone: z.string().regex(/^\+54[0-9]{10,11}$/),
  customerId: z.string().uuid().optional(),
  
  // For text messages
  text: z.string().max(4096).optional(),
  
  // For template messages
  templateName: z.string().optional(),
  templateParams: z.array(z.string()).optional(),
  
  // For media messages
  mediaUrl: z.string().url().optional(),
  mediaCaption: z.string().optional(),
  
  // Tracking
  jobId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
});

// WhatsApp Inbound Queue
export const WhatsAppInboundJobSchema = BaseJobSchema.extend({
  waMessageId: z.string(),
  waTimestamp: z.string().datetime(),
  senderPhone: z.string(),
  messageType: z.enum(['text', 'voice', 'image', 'document', 'interactive']),
  content: z.string().optional(),
  mediaId: z.string().optional(),
  mediaMimeType: z.string().optional(),
  isBusinessInitiated: z.boolean(),
});

// Voice Transcription Queue
export const VoiceTranscriptionJobSchema = BaseJobSchema.extend({
  messageId: z.string().uuid(),
  audioUrl: z.string().url(),
  audioDuration: z.number().int().positive(),
  audioMimeType: z.string(),
  language: z.string().default('es'),
  customerId: z.string().uuid().optional(),
});

// Voice Extraction Queue
export const VoiceExtractionJobSchema = BaseJobSchema.extend({
  transcriptId: z.string().uuid(),
  transcription: z.string(),
  confidence: z.number().min(0).max(1),
  messageId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
});

// Job Notification Queue
export const JobNotificationJobSchema = BaseJobSchema.extend({
  jobId: z.string().uuid(),
  notificationType: z.enum([
    'scheduled',
    'reminder_24h',
    'reminder_1h',
    'en_camino',
    'completed',
    'cancelled',
  ]),
  customerId: z.string().uuid(),
  technicianId: z.string().uuid().optional(),
  scheduledTime: z.string().datetime().optional(),
});

// Invoice PDF Queue
export const InvoicePdfJobSchema = BaseJobSchema.extend({
  invoiceId: z.string().uuid(),
  regenerate: z.boolean().default(false),
  sendAfter: z.boolean().default(true),
});

// Sync Offline Queue
export const SyncOfflineJobSchema = BaseJobSchema.extend({
  userId: z.string().uuid(),
  deviceId: z.string(),
  operations: z.array(z.object({
    type: z.enum(['create', 'update', 'status_change', 'photo_upload']),
    localId: z.string(),
    serverId: z.string().uuid().optional(),
    entityType: z.enum(['job', 'photo', 'customer']),
    data: z.record(z.unknown()),
    clientTimestamp: z.string().datetime(),
    vectorClock: z.record(z.number()).optional(),
  })),
});

// Reconciliation Queue
export const ReconciliationJobSchema = BaseJobSchema.extend({
  reconciliationType: z.enum(['payments', 'invoices', 'messages']),
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
  fullReconciliation: z.boolean().default(false),
});

// Cleanup Queue
export const CleanupJobSchema = BaseJobSchema.extend({
  cleanupType: z.enum([
    'expired_otps',
    'old_audit_logs',
    'orphaned_files',
    'expired_idempotency',
    'completed_jobs',
  ]),
  olderThan: z.string().datetime().optional(),
  dryRun: z.boolean().default(false),
});

// Analytics Queue
export const AnalyticsJobSchema = BaseJobSchema.extend({
  eventType: z.string(),
  eventData: z.record(z.unknown()),
  userId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
  timestamp: z.string().datetime(),
});

// Scheduler Queue
export const SchedulerJobSchema = BaseJobSchema.extend({
  scheduledJobType: z.enum([
    'job_reminder',
    'invoice_overdue_check',
    'daily_reconciliation',
    'weekly_report',
    'cert_expiry_check',
  ]),
  targetId: z.string().uuid().optional(),
  scheduledFor: z.string().datetime(),
});
```

### 7.3 Schema Validation Middleware

```typescript
// lib/queue/validation.ts

export function validateJobData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    throw new JobValidationError(
      `Invalid job data: ${result.error.message}`,
      result.error.flatten()
    );
  }
  
  return result.data;
}

// Usage in worker
async process(job: Job<unknown>): Promise<void> {
  const data = validateJobData(AfipInvoiceJobSchema, job.data);
  // data is now typed as AfipInvoiceJob
}
```

---

## 8. Idempotency

### 8.1 Idempotency Key Format

```typescript
// lib/queue/idempotency.ts

export class IdempotencyKey {
  // Format: {prefix}_{orgId}_{entityType}_{entityId}_{action}_{timestamp}
  // Example: idem_org123_invoice_inv456_cae_1701234567
  
  static generate(params: {
    orgId: string;
    entityType: string;
    entityId: string;
    action: string;
  }): string {
    const timestamp = Math.floor(Date.now() / 1000);
    return `idem_${params.orgId}_${params.entityType}_${params.entityId}_${params.action}_${timestamp}`;
  }
  
  // For webhooks: use external ID
  static fromWebhook(source: string, externalId: string): string {
    return `webhook_${source}_${externalId}`;
  }
  
  // Parse key back to components
  static parse(key: string): {
    orgId: string;
    entityType: string;
    entityId: string;
    action: string;
    timestamp: number;
  } | null {
    const match = key.match(/^idem_([^_]+)_([^_]+)_([^_]+)_([^_]+)_(\d+)$/);
    if (!match) return null;
    
    return {
      orgId: match[1],
      entityType: match[2],
      entityId: match[3],
      action: match[4],
      timestamp: parseInt(match[5]),
    };
  }
}

// Per-queue idempotency key formats
export const IDEMPOTENCY_FORMATS = {
  [QueueName.AFIP_INVOICE]: 'idem_{orgId}_invoice_{invoiceId}_cae_{puntoVenta}',
  [QueueName.PAYMENT_WEBHOOK]: 'webhook_mp_{mpPaymentId}_{eventType}',
  [QueueName.WHATSAPP_OUTBOUND]: 'idem_{orgId}_wa_{customerId}_{templateName}_{timestamp}',
  [QueueName.INVOICE_PDF]: 'idem_{orgId}_pdf_{invoiceId}_{version}',
  [QueueName.SYNC_OFFLINE]: 'idem_{orgId}_sync_{deviceId}_{operationHash}',
};
```

### 8.2 Idempotency Store

```typescript
// lib/queue/idempotency-store.ts

export class IdempotencyStore {
  constructor(private redis: Redis) {}
  
  private getKey(idempotencyKey: string): string {
    return `idempotency:${idempotencyKey}`;
  }
  
  async check(idempotencyKey: string): Promise<{
    exists: boolean;
    result?: unknown;
    status?: 'pending' | 'completed' | 'failed';
  }> {
    const data = await this.redis.get(this.getKey(idempotencyKey));
    
    if (!data) {
      return { exists: false };
    }
    
    const parsed = JSON.parse(data);
    return {
      exists: true,
      result: parsed.result,
      status: parsed.status,
    };
  }
  
  async setPending(idempotencyKey: string, ttlSeconds: number = 3600): Promise<boolean> {
    // Use SET NX to prevent race conditions
    const result = await this.redis.set(
      this.getKey(idempotencyKey),
      JSON.stringify({ status: 'pending', startedAt: Date.now() }),
      'EX',
      ttlSeconds,
      'NX'
    );
    
    return result === 'OK';
  }
  
  async setCompleted(
    idempotencyKey: string, 
    result: unknown, 
    ttlSeconds: number = 86400
  ): Promise<void> {
    await this.redis.set(
      this.getKey(idempotencyKey),
      JSON.stringify({ 
        status: 'completed', 
        result, 
        completedAt: Date.now() 
      }),
      'EX',
      ttlSeconds
    );
  }
  
  async setFailed(
    idempotencyKey: string, 
    error: string, 
    ttlSeconds: number = 3600
  ): Promise<void> {
    await this.redis.set(
      this.getKey(idempotencyKey),
      JSON.stringify({ 
        status: 'failed', 
        error, 
        failedAt: Date.now() 
      }),
      'EX',
      ttlSeconds
    );
  }
  
  async clear(idempotencyKey: string): Promise<void> {
    await this.redis.del(this.getKey(idempotencyKey));
  }
}
```

---

## 9. Ordering Guarantees

### 9.1 Queue Ordering Modes

```typescript
// lib/queue/ordering.ts

export enum OrderingMode {
  // No ordering - maximum throughput
  UNORDERED = 'unordered',
  
  // FIFO within org - jobs for same org processed in order
  ORG_FIFO = 'org_fifo',
  
  // FIFO within entity - jobs for same entity processed in order
  ENTITY_FIFO = 'entity_fifo',
  
  // Strict global FIFO - single processor
  GLOBAL_FIFO = 'global_fifo',
}

// Queue ordering requirements
export const QUEUE_ORDERING: Record<QueueName, OrderingMode> = {
  [QueueName.AFIP_INVOICE]: OrderingMode.ORG_FIFO,      // Per-org invoice numbering
  [QueueName.PAYMENT_WEBHOOK]: OrderingMode.UNORDERED,  // Idempotent
  [QueueName.WHATSAPP_OUTBOUND]: OrderingMode.ORG_FIFO, // Message ordering per recipient
  [QueueName.WHATSAPP_INBOUND]: OrderingMode.UNORDERED, // Fast processing
  [QueueName.VOICE_TRANSCRIPTION]: OrderingMode.UNORDERED,
  [QueueName.VOICE_EXTRACTION]: OrderingMode.UNORDERED,
  [QueueName.JOB_NOTIFICATION]: OrderingMode.UNORDERED,
  [QueueName.INVOICE_PDF]: OrderingMode.UNORDERED,
  [QueueName.SYNC_OFFLINE]: OrderingMode.ENTITY_FIFO,   // Per-job ordering
  [QueueName.RECONCILIATION]: OrderingMode.GLOBAL_FIFO, // One at a time
  [QueueName.CLEANUP]: OrderingMode.UNORDERED,
  [QueueName.ANALYTICS]: OrderingMode.UNORDERED,
  [QueueName.SCHEDULER]: OrderingMode.UNORDERED,
};
```

### 9.2 Ordered Queue Implementation

```typescript
// lib/queue/ordered-queue.ts

export class OrderedQueue {
  private locks: Map<string, Promise<void>> = new Map();
  
  async processInOrder<T>(
    orderingKey: string,
    processor: () => Promise<T>
  ): Promise<T> {
    // Wait for any existing processing for this key
    const existingLock = this.locks.get(orderingKey);
    if (existingLock) {
      await existingLock;
    }
    
    // Create new lock
    let resolve: () => void;
    const lock = new Promise<void>(r => { resolve = r; });
    this.locks.set(orderingKey, lock);
    
    try {
      return await processor();
    } finally {
      resolve!();
      this.locks.delete(orderingKey);
    }
  }
  
  // Generate ordering key based on mode
  static getOrderingKey(
    mode: OrderingMode,
    job: Job<{ orgId: string; entityId?: string }>
  ): string | null {
    switch (mode) {
      case OrderingMode.UNORDERED:
        return null;
      case OrderingMode.ORG_FIFO:
        return `org:${job.data.orgId}`;
      case OrderingMode.ENTITY_FIFO:
        return `entity:${job.data.orgId}:${job.data.entityId}`;
      case OrderingMode.GLOBAL_FIFO:
        return 'global';
    }
  }
}
```

---

## 10. Metrics & Observability

### 10.1 Metrics Definitions

```typescript
// lib/queue/metrics.ts

export const QUEUE_METRICS = {
  // Counter metrics
  counters: [
    'queue.{name}.enqueued',        // Jobs added
    'queue.{name}.completed',       // Jobs completed successfully
    'queue.{name}.failed',          // Jobs failed
    'queue.{name}.retried',         // Jobs retried
    'queue.{name}.stalled',         // Jobs stalled
    'queue.{name}.dlq_added',       // Jobs moved to DLQ
    'queue.{name}.rate_limited',    // Jobs rate limited
    'queue.{name}.idempotent_skip', // Jobs skipped (idempotent)
  ],
  
  // Gauge metrics
  gauges: [
    'queue.{name}.waiting',         // Jobs waiting in queue
    'queue.{name}.active',          // Jobs currently processing
    'queue.{name}.delayed',         // Jobs delayed (scheduled)
    'queue.{name}.paused',          // Queue paused (1/0)
    'queue.{name}.workers',         // Active workers
  ],
  
  // Histogram metrics (timing)
  histograms: [
    'queue.{name}.wait_time',       // Time from enqueue to start
    'queue.{name}.process_time',    // Time to process
    'queue.{name}.total_time',      // Total time enqueue to complete
  ],
};

// Example metric emission
function emitMetrics(queueName: string, job: Job, result: 'completed' | 'failed'): void {
  const now = Date.now();
  const waitTime = job.processedOn! - job.timestamp;
  const processTime = now - job.processedOn!;
  const totalTime = now - job.timestamp;
  
  metrics.increment(`queue.${queueName}.${result}`);
  metrics.histogram(`queue.${queueName}.wait_time`, waitTime);
  metrics.histogram(`queue.${queueName}.process_time`, processTime);
  metrics.histogram(`queue.${queueName}.total_time`, totalTime);
  
  // Add tags for filtering
  metrics.increment(`queue.${queueName}.${result}`, {
    orgId: job.data.orgId,
    priority: job.opts.priority?.toString() || 'default',
    attempt: job.attemptsMade.toString(),
  });
}
```

### 10.2 Alerting Thresholds

```typescript
// lib/queue/alerts.ts

export const ALERT_THRESHOLDS = {
  // Queue depth alerts
  queueDepth: {
    [QueueName.AFIP_INVOICE]: { warning: 50, critical: 100 },
    [QueueName.PAYMENT_WEBHOOK]: { warning: 100, critical: 500 },
    [QueueName.WHATSAPP_OUTBOUND]: { warning: 200, critical: 500 },
    [QueueName.VOICE_TRANSCRIPTION]: { warning: 50, critical: 100 },
    default: { warning: 100, critical: 300 },
  },
  
  // Wait time alerts (milliseconds)
  waitTime: {
    [QueueName.AFIP_INVOICE]: { warning: 60000, critical: 300000 },
    [QueueName.PAYMENT_WEBHOOK]: { warning: 5000, critical: 30000 },
    [QueueName.WHATSAPP_OUTBOUND]: { warning: 10000, critical: 60000 },
    default: { warning: 30000, critical: 120000 },
  },
  
  // Error rate alerts (percentage)
  errorRate: {
    default: { warning: 5, critical: 15 },
  },
  
  // Stalled job alerts (count per hour)
  stalledJobs: {
    default: { warning: 5, critical: 20 },
  },
};

// Alert evaluation
async function evaluateAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  
  for (const queueName of Object.values(QueueName)) {
    const counts = await getQueueCounts(queueName);
    const thresholds = ALERT_THRESHOLDS.queueDepth[queueName] 
      || ALERT_THRESHOLDS.queueDepth.default;
    
    if (counts.waiting >= thresholds.critical) {
      alerts.push({
        severity: 'critical',
        queue: queueName,
        metric: 'depth',
        value: counts.waiting,
        threshold: thresholds.critical,
        message: `Queue ${queueName} depth critical: ${counts.waiting} jobs waiting`,
      });
    } else if (counts.waiting >= thresholds.warning) {
      alerts.push({
        severity: 'warning',
        queue: queueName,
        metric: 'depth',
        value: counts.waiting,
        threshold: thresholds.warning,
        message: `Queue ${queueName} depth warning: ${counts.waiting} jobs waiting`,
      });
    }
  }
  
  return alerts;
}
```

### 10.3 Dashboard Configuration (Bull Board)

```typescript
// lib/queue/dashboard.ts

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

export function setupDashboard(app: Express): void {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  
  const queues = Object.values(QueueName).map(name => 
    new BullMQAdapter(new Queue(name, { connection: REDIS_CONFIG }))
  );
  
  createBullBoard({
    queues,
    serverAdapter,
  });
  
  // Protect with admin auth
  app.use(
    '/admin/queues',
    requireRole(['owner', 'admin']),
    serverAdapter.getRouter()
  );
}
```

---

## 11. Dead Letter Queue

### 11.1 DLQ Configuration

```typescript
// lib/queue/dlq.ts

export const DLQ_CONFIG = {
  queueName: 'dlq',
  
  // Retention
  retentionDays: 30,
  maxItems: 10000,
  
  // Auto-retry policies
  autoRetry: {
    enabled: true,
    maxAutoRetries: 2,
    retryDelay: 3600000, // 1 hour
    
    // Only auto-retry certain error types
    retryableErrors: [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'RATE_LIMIT',
      'SERVICE_UNAVAILABLE',
    ],
  },
  
  // Alerting
  alerts: {
    newItemThreshold: 10,     // Alert after 10 items in 1 hour
    ageThreshold: 86400000,   // Alert if items older than 24h
  },
};

export interface DLQItem {
  id: string;
  originalQueue: QueueName;
  originalJobId: string;
  jobData: unknown;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  attempts: number;
  orgId: string;
  createdAt: string;
  status: 'pending' | 'retried' | 'discarded' | 'resolved';
  resolution?: {
    action: 'retry' | 'discard' | 'manual';
    reason: string;
    resolvedBy: string;
    resolvedAt: string;
  };
}
```

### 11.2 DLQ Operations

```typescript
// lib/queue/dlq-operations.ts

export class DLQOperations {
  constructor(
    private dlqQueue: Queue,
    private redis: Redis
  ) {}
  
  async list(filters: {
    queue?: QueueName;
    status?: string;
    orgId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: DLQItem[]; nextCursor?: string }> {
    // Implementation with pagination
    const jobs = await this.dlqQueue.getJobs(['waiting', 'delayed'], 0, filters.limit || 50);
    
    const items = jobs
      .map(j => j.data as DLQItem)
      .filter(item => {
        if (filters.queue && item.originalQueue !== filters.queue) return false;
        if (filters.status && item.status !== filters.status) return false;
        if (filters.orgId && item.orgId !== filters.orgId) return false;
        return true;
      });
    
    return { items };
  }
  
  async retry(dlqItemId: string, userId: string): Promise<void> {
    const job = await this.dlqQueue.getJob(dlqItemId);
    if (!job) throw new Error('DLQ item not found');
    
    const item = job.data as DLQItem;
    
    // Re-add to original queue
    const originalQueue = new Queue(item.originalQueue, { connection: REDIS_CONFIG });
    await originalQueue.add(
      'retry',
      {
        ...item.jobData,
        _dlqRetry: true,
        _originalDlqId: dlqItemId,
      },
      {
        priority: JobPriority.HIGH, // Boost priority for retries
      }
    );
    
    // Update DLQ item
    await job.update({
      ...item,
      status: 'retried',
      resolution: {
        action: 'retry',
        reason: 'Manual retry',
        resolvedBy: userId,
        resolvedAt: new Date().toISOString(),
      },
    });
    
    metrics.increment('dlq.retried', { queue: item.originalQueue });
  }
  
  async discard(dlqItemId: string, userId: string, reason: string): Promise<void> {
    const job = await this.dlqQueue.getJob(dlqItemId);
    if (!job) throw new Error('DLQ item not found');
    
    const item = job.data as DLQItem;
    
    await job.update({
      ...item,
      status: 'discarded',
      resolution: {
        action: 'discard',
        reason,
        resolvedBy: userId,
        resolvedAt: new Date().toISOString(),
      },
    });
    
    // Move to completed so it's eventually cleaned up
    await job.moveToCompleted('discarded', true);
    
    metrics.increment('dlq.discarded', { queue: item.originalQueue });
  }
  
  async getStats(): Promise<{
    total: number;
    byQueue: Record<string, number>;
    byStatus: Record<string, number>;
    oldestItem?: string;
  }> {
    const jobs = await this.dlqQueue.getJobs(['waiting', 'delayed']);
    
    const stats = {
      total: jobs.length,
      byQueue: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      oldestItem: undefined as string | undefined,
    };
    
    for (const job of jobs) {
      const item = job.data as DLQItem;
      stats.byQueue[item.originalQueue] = (stats.byQueue[item.originalQueue] || 0) + 1;
      stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
      
      if (!stats.oldestItem || item.createdAt < stats.oldestItem) {
        stats.oldestItem = item.createdAt;
      }
    }
    
    return stats;
  }
}
```

---

## 12. Memory Management

### 12.1 Memory Limits

```typescript
// lib/queue/memory.ts

export const MEMORY_LIMITS = {
  // Per-worker memory limits
  workerLimits: {
    high: 512 * 1024 * 1024,    // 512MB
    normal: 1024 * 1024 * 1024, // 1GB (processing large files)
    low: 256 * 1024 * 1024,     // 256MB
    scheduler: 256 * 1024 * 1024,
  },
  
  // Job data size limits
  jobDataLimits: {
    maxPayloadSize: 1024 * 1024, // 1MB max job payload
    maxBatchSize: 100,           // Max items per batch job
  },
  
  // Redis memory management
  redis: {
    maxMemory: '2gb',
    evictionPolicy: 'noeviction', // Critical: don't evict queue data
    
    // Key TTLs
    ttl: {
      idempotency: 86400,        // 24 hours
      completedJobs: 86400,      // 24 hours
      failedJobs: 604800,        // 7 days
      dlqItems: 2592000,         // 30 days
    },
  },
};

// Memory monitoring
export async function checkMemoryUsage(redis: Redis): Promise<{
  used: number;
  total: number;
  percentage: number;
  alert: boolean;
}> {
  const info = await redis.info('memory');
  const usedMemory = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0');
  const maxMemory = parseInt(info.match(/maxmemory:(\d+)/)?.[1] || '0');
  
  const percentage = maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0;
  
  return {
    used: usedMemory,
    total: maxMemory,
    percentage,
    alert: percentage > 80,
  };
}
```

### 12.2 Backpressure Handling

```typescript
// lib/queue/backpressure.ts

export class BackpressureController {
  private queueDepths: Map<QueueName, number> = new Map();
  
  // Thresholds for backpressure
  private readonly THRESHOLDS = {
    softLimit: 100,  // Start slowing down
    hardLimit: 500,  // Reject new jobs
  };
  
  async shouldAcceptJob(queueName: QueueName): Promise<{
    accept: boolean;
    delay?: number;
    reason?: string;
  }> {
    const depth = await this.getQueueDepth(queueName);
    
    if (depth >= this.THRESHOLDS.hardLimit) {
      metrics.increment('backpressure.rejected', { queue: queueName });
      return {
        accept: false,
        reason: `Queue ${queueName} at capacity (${depth} jobs)`,
      };
    }
    
    if (depth >= this.THRESHOLDS.softLimit) {
      // Calculate delay based on how close to hard limit
      const ratio = (depth - this.THRESHOLDS.softLimit) / 
                   (this.THRESHOLDS.hardLimit - this.THRESHOLDS.softLimit);
      const delay = Math.floor(ratio * 5000); // 0-5 second delay
      
      metrics.increment('backpressure.delayed', { queue: queueName });
      return {
        accept: true,
        delay,
      };
    }
    
    return { accept: true };
  }
  
  private async getQueueDepth(queueName: QueueName): Promise<number> {
    const queue = new Queue(queueName, { connection: REDIS_CONFIG });
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
    return counts.waiting + counts.active + counts.delayed;
  }
}
```

---

## 13. Deployment Configuration

### 13.1 Kubernetes Deployment

```yaml
# k8s/workers/high-priority-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: campotech-worker-high
  labels:
    app: campotech-worker
    priority: high
spec:
  replicas: 2
  selector:
    matchLabels:
      app: campotech-worker
      priority: high
  template:
    metadata:
      labels:
        app: campotech-worker
        priority: high
    spec:
      containers:
        - name: worker
          image: campotech/worker:latest
          env:
            - name: WORKER_POOL
              value: "high"
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: redis-credentials
                  key: url
          resources:
            requests:
              memory: "384Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 5
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: campotech-worker
                topologyKey: kubernetes.io/hostname
---
# Similar deployments for normal-priority and low-priority workers
```

### 13.2 Environment Variables

```bash
# Worker environment configuration

# Redis
REDIS_HOST=redis.campotech.internal
REDIS_PORT=6379
REDIS_PASSWORD=<secret>
REDIS_TLS=true

# Worker identity
WORKER_POOL=high|normal|low|scheduler
WORKER_ID=<auto-generated>

# Concurrency overrides (optional)
WORKER_CONCURRENCY=5
WORKER_RATE_LIMIT_MAX=100
WORKER_RATE_LIMIT_DURATION=60000

# Feature flags
ENABLE_DLQ_AUTO_RETRY=true
ENABLE_FAIR_SCHEDULING=true
ENABLE_BACKPRESSURE=true

# Monitoring
METRICS_ENDPOINT=https://metrics.campotech.internal
LOG_LEVEL=info
```

---

## 14. Summary

### Queue Technology Stack
- **Primary**: BullMQ on Redis 7+
- **Deployment**: Upstash Redis (serverless, multi-region)
- **Dashboard**: Bull Board at `/admin/queues`

### 13 Queues Defined
| Queue | Priority | Concurrency | Rate Limit | Isolation |
|-------|----------|-------------|------------|-----------|
| afip:invoice | High | 3 | 10/min | Shared |
| payment:webhook | High | 10 | 100/min | Shared |
| whatsapp:outbound | High | 5 | 50/min | Per-org |
| whatsapp:inbound | Normal | 20 | 200/min | Shared |
| voice:transcription | Normal | 5 | 20/min | Shared |
| voice:extraction | Normal | 10 | 50/min | Shared |
| job:notification | Normal | 10 | 100/min | Per-org |
| invoice:pdf | Normal | 5 | 50/min | Shared |
| sync:offline | Low | 10 | 100/min | Per-org |
| reconciliation | Low | 2 | 5/min | Shared |
| cleanup | Low | 2 | 10/min | Shared |
| analytics | Low | 5 | 50/min | Shared |
| scheduler | Normal | 5 | 100/min | Shared |

### Worker Pools
- **High**: 2 instances, 512MB each, 5 concurrency
- **Normal**: 3 instances, 1GB each, 10 concurrency
- **Low**: 1 instance, 256MB, 5 concurrency
- **Scheduler**: 1 instance, 256MB, 5 concurrency

### Key Features
- Per-queue message schemas with Zod validation
- 4 backoff strategies (exponential, fixed, AFIP, WhatsApp)
- Idempotency with Redis-backed store
- Ordering guarantees (FIFO per-org, per-entity, global)
- Dead letter queue with manual/auto retry
- Comprehensive metrics and alerting
- Backpressure handling with soft/hard limits

This specification provides everything needed for unambiguous implementation.
