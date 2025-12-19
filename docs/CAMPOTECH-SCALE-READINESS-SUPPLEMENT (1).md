# CampoTech Scale-Readiness Supplement

## Roadmap Addition for 100,000 Business Scale

**Version:** 1.0
**Purpose:** Supplement to main roadmap ensuring production readiness at scale
**Target:** 100,000 businesses / 500,000 users / 1M+ consumers

---

## Overview

This document adds critical infrastructure components missing from the main roadmap. These ensure CampoTech doesn't just *work* at scale, but *survives* traffic spikes, external API failures, and database growth.

**New Phases Added:**
- Phase 5A: Advanced Database Scaling
- Phase 5B: Instrumented Queue System
- Phase 6A: External API Resilience
- Phase 6B: Graceful Degradation System
- Phase 8A: Cost Controls & Alerting

**Modified Phases:**
- Phase 5: Additional caching strategies
- Phase 9: Enhanced load testing scenarios

---

# PHASE 5A: Advanced Database Scaling

**Plain Language:** Your database will have 50-100 million rows within a year at scale. Without partitioning and archival, queries slow to a crawl. This phase prevents that.

**Duration:** 1-2 weeks
**Prerequisite:** Phase 5 (basic database optimization)
**Priority:** HIGH - do before launch

---

## Phase 5A.1: Table Partitioning Strategy

**What this does:** Splits large tables into smaller chunks by date. Queries only scan relevant partitions instead of entire table.

### Task 5A.1.1: Design Partition Schema

**For AI:** Create partition design document covering:

```sql
-- Tables requiring partitioning (by created_at):
-- 1. jobs - highest volume
-- 2. whatsapp_messages - grows fastest
-- 3. technician_locations - GPS pings every 30s
-- 4. audit_logs - compliance requirement
-- 5. notification_logs - high volume

-- Partition strategy:
-- - jobs: Monthly partitions (keeps ~30 days hot)
-- - whatsapp_messages: Weekly partitions
-- - technician_locations: Daily partitions (most volatile)
-- - audit_logs: Monthly partitions
-- - notification_logs: Weekly partitions
```

**Deliverable:** `docs/DATABASE-PARTITION-STRATEGY.md`

**Test (AI):** Document exists with partition definitions for all 5 tables

---

### Task 5A.1.2: Create Jobs Table Partitioning Migration

**File to create:** `prisma/migrations/YYYYMMDD_partition_jobs/migration.sql`

**For AI:**

```sql
-- Step 1: Create partitioned table structure
CREATE TABLE jobs_partitioned (
    id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    customer_id TEXT,
    assigned_to TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    scheduled_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- ... all other columns from current jobs table
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Step 2: Create partitions for next 24 months
CREATE TABLE jobs_y2025m01 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE jobs_y2025m02 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- ... continue for 24 months

-- Step 3: Create indexes on each partition
CREATE INDEX idx_jobs_y2025m01_org_status ON jobs_y2025m01(organization_id, status);
CREATE INDEX idx_jobs_y2025m01_assigned ON jobs_y2025m01(assigned_to, status);
-- ... for each partition

-- Step 4: Migrate existing data
INSERT INTO jobs_partitioned SELECT * FROM jobs;

-- Step 5: Swap tables (during maintenance window)
ALTER TABLE jobs RENAME TO jobs_old;
ALTER TABLE jobs_partitioned RENAME TO jobs;

-- Step 6: Verify and drop old table after confirmation
-- DROP TABLE jobs_old; -- Manual step after verification
```

**Test (AI):**
```sql
-- Verify partition pruning works
EXPLAIN ANALYZE SELECT * FROM jobs 
WHERE created_at > '2025-06-01' AND organization_id = 'xxx';
-- Should show "Partitions selected: 1" not "Partitions selected: 24"
```

**Test (Manual - Kevin):**
1. Run migration on staging database
2. Create test job
3. Query jobs table - verify it works
4. Check EXPLAIN shows partition pruning

**Notes:** Run during low-traffic window. Have rollback plan ready.

---

### Task 5A.1.3: Create WhatsApp Messages Partitioning

**File to create:** `prisma/migrations/YYYYMMDD_partition_whatsapp/migration.sql`

**For AI:** Same pattern as jobs, but:
- Weekly partitions (higher volume per time period)
- Partition by `created_at`
- Create 52 weeks of partitions (1 year)

```sql
CREATE TABLE whatsapp_messages_partitioned (
    id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    direction TEXT NOT NULL, -- 'inbound' | 'outbound'
    content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Weekly partitions
CREATE TABLE wa_msgs_2025w01 PARTITION OF whatsapp_messages_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-01-08');
-- ... continue for 52 weeks
```

---

### Task 5A.1.4: Create Technician Locations Partitioning

**File to create:** `prisma/migrations/YYYYMMDD_partition_locations/migration.sql`

**For AI:** Daily partitions - this table grows fastest (GPS ping every 30s per active technician)

```sql
CREATE TABLE technician_locations_partitioned (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Daily partitions (create 90 days ahead)
CREATE TABLE tech_loc_20250101 PARTITION OF technician_locations_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-01-02');
-- ... continue for 90 days
```

**Critical:** This table will have ~50M rows/month at scale. Daily partitions essential.

---

### Task 5A.1.5: Create Automatic Partition Management

**File to create:** `apps/web/lib/jobs/partition-manager.ts`

**For AI:** Create a cron job that:
1. Runs weekly
2. Creates partitions 3 months ahead
3. Alerts if partitions are missing

```typescript
// Cron: Every Sunday at 2am
// Endpoint: /api/cron/manage-partitions

export async function managePartitions() {
  const tables = [
    { name: 'jobs', interval: 'month', ahead: 3 },
    { name: 'whatsapp_messages', interval: 'week', ahead: 12 },
    { name: 'technician_locations', interval: 'day', ahead: 90 },
    { name: 'audit_logs', interval: 'month', ahead: 3 },
    { name: 'notification_logs', interval: 'week', ahead: 12 },
  ];

  for (const table of tables) {
    await ensurePartitionsExist(table);
  }
}

async function ensurePartitionsExist(config: TableConfig) {
  // Check existing partitions
  // Create missing future partitions
  // Log any issues to monitoring
}
```

**Test (AI):** Unit test that verifies partition creation logic

**Test (Manual):** Run manually, check new partitions created in database

---

## Phase 5A.2: Data Archival System

**What this does:** Moves old data to cheap storage, keeps main database fast.

### Task 5A.2.1: Define Retention Policies

**File to create:** `docs/DATA-RETENTION-POLICY.md`

**For AI:** Document retention rules:

```markdown
# Data Retention Policy

## Hot Data (Main Database)
| Table | Retention | Reason |
|-------|-----------|--------|
| jobs | 2 years | Active reference |
| customers | Forever | CRM data |
| invoices | 10 years | AFIP legal requirement |
| whatsapp_messages | 1 year | Reference |
| technician_locations | 90 days | Only recent needed |
| audit_logs | 3 years | Compliance |
| notification_logs | 6 months | Debugging only |
| ratings | Forever | Marketplace value |

## Archive Storage (Cold - Supabase Storage or S3)
- Jobs older than 2 years → JSON export to storage
- WhatsApp older than 1 year → JSON export
- Locations older than 90 days → Aggregate stats only, delete raw

## Legal Requirements (Argentina)
- AFIP invoices: 10 years minimum
- Employment records: 10 years after termination
- Customer data: Until deletion request (Ley 25.326)
```

---

### Task 5A.2.2: Create Archival Job

**File to create:** `apps/web/lib/jobs/data-archiver.ts`

**For AI:**

```typescript
// Cron: Daily at 3am
// Endpoint: /api/cron/archive-data

interface ArchivalConfig {
  table: string;
  retentionDays: number;
  archiveFormat: 'json' | 'parquet';
  deleteAfterArchive: boolean;
}

const ARCHIVAL_CONFIGS: ArchivalConfig[] = [
  {
    table: 'technician_locations',
    retentionDays: 90,
    archiveFormat: 'json',
    deleteAfterArchive: true,
  },
  {
    table: 'notification_logs',
    retentionDays: 180,
    archiveFormat: 'json',
    deleteAfterArchive: true,
  },
  {
    table: 'jobs',
    retentionDays: 730, // 2 years
    archiveFormat: 'json',
    deleteAfterArchive: true,
  },
  // invoices: NEVER delete (10 year legal requirement)
];

export async function archiveOldData() {
  for (const config of ARCHIVAL_CONFIGS) {
    const cutoffDate = subDays(new Date(), config.retentionDays);
    
    // 1. Export old records to storage
    const records = await db.query(`
      SELECT * FROM ${config.table}
      WHERE created_at < $1
      LIMIT 10000
    `, [cutoffDate]);
    
    if (records.length === 0) continue;
    
    // 2. Upload to cold storage
    const filename = `archives/${config.table}/${format(cutoffDate, 'yyyy-MM-dd')}.json`;
    await storage.upload(filename, JSON.stringify(records));
    
    // 3. Delete from main database
    if (config.deleteAfterArchive) {
      await db.query(`
        DELETE FROM ${config.table}
        WHERE id IN (${records.map(r => r.id).join(',')})
      `);
    }
    
    // 4. Log metrics
    metrics.record('archival', {
      table: config.table,
      recordsArchived: records.length,
    });
  }
}
```

**Test (AI):**
- Unit test with mock data
- Verify files created in storage
- Verify records deleted from mock DB

**Test (Manual - Kevin):**
1. Insert test records with old dates
2. Run archiver
3. Verify records in storage bucket
4. Verify deleted from database
5. Verify metrics logged

---

### Task 5A.2.3: Create Archive Retrieval API

**File to create:** `apps/web/app/api/v1/archives/route.ts`

**For AI:** Allow businesses to retrieve their archived data (ARCO rights compliance)

```typescript
// GET /api/v1/archives?table=jobs&startDate=2023-01-01&endDate=2023-12-31
// Returns: Signed URL to download archived data

export async function GET(request: Request) {
  const { organizationId } = await getSession();
  const { table, startDate, endDate } = parseParams(request);
  
  // Find relevant archive files
  const archiveFiles = await storage.list(`archives/${table}/`, {
    startAfter: startDate,
    endBefore: endDate,
  });
  
  // Filter to only this organization's data
  // Generate signed download URL
  // Return URL (valid 1 hour)
}
```

---

## Phase 5A.3: Read Replica for Analytics

**What this does:** Heavy analytics queries run on a copy of the database, not the main one. Prevents reports from slowing down the app.

### Task 5A.3.1: Configure Supabase Read Replica

**For Manual (Kevin):**
1. Go to Supabase Dashboard → Database → Read Replicas
2. Enable read replica (requires Pro plan or higher)
3. Note the replica connection string

**For AI:** Create replica configuration:

```typescript
// apps/web/lib/db/connections.ts

import { PrismaClient } from '@prisma/client';

// Primary database (read + write)
export const db = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL }
  }
});

// Read replica (read-only, for analytics)
export const dbReplica = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_REPLICA_URL }
  }
});

// Helper to choose correct connection
export function getDb(options?: { analytics?: boolean }) {
  if (options?.analytics && process.env.DATABASE_REPLICA_URL) {
    return dbReplica;
  }
  return db;
}
```

---

### Task 5A.3.2: Route Analytics Queries to Replica

**File to modify:** All analytics-related API routes

**For AI:** Update analytics endpoints to use replica:

```typescript
// apps/web/app/api/v1/analytics/revenue/route.ts

import { getDb } from '@/lib/db/connections';

export async function GET(request: Request) {
  const db = getDb({ analytics: true }); // Uses replica
  
  const revenue = await db.invoice.aggregate({
    where: { organizationId, status: 'PAID' },
    _sum: { total: true },
  });
  
  return Response.json(revenue);
}
```

**Apply to these routes:**
- `/api/v1/analytics/*` (all analytics)
- `/api/v1/reports/*` (all reports)
- Admin dashboard queries
- Marketplace search (read-heavy)

**Test (AI):** Verify analytics routes use `getDb({ analytics: true })`

**Test (Manual):**
1. Enable query logging
2. Run analytics report
3. Verify query hit replica, not primary

---

## Phase 5A.4: Connection Pool Optimization

### Task 5A.4.1: Configure PgBouncer Settings

**For Manual (Kevin):**
1. Supabase Dashboard → Database → Connection Pooling
2. Set pool mode to `transaction` (not `session`)
3. Set pool size based on plan:
   - Pro: 60 connections
   - Team: 100 connections
   - Enterprise: Custom

**For AI:** Update Prisma configuration:

```typescript
// apps/web/lib/db/connections.ts

// Connection string should use pooler
// Format: postgresql://user:pass@db.xxx-pooler.supabase.com:6543/postgres

export const db = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL } // Pooler URL
  },
  // Prisma-level connection management
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
});

// Ensure connections are released
export async function withDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  try {
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}
```

---

## Phase 5A COMPLETE CHECKLIST

- ⬜ Partition strategy documented
- ⬜ Jobs table partitioned
- ⬜ WhatsApp messages partitioned
- ⬜ Technician locations partitioned
- ⬜ Partition manager cron created
- ⬜ Retention policy documented
- ⬜ Archival job created
- ⬜ Archive retrieval API created
- ⬜ Read replica configured
- ⬜ Analytics routed to replica
- ⬜ Connection pooling optimized
- ⬜ All migrations tested on staging

**Phase 5A Sign-Off Date:** ___________

---

# PHASE 5B: Instrumented Queue System

**Plain Language:** Build the queue system with metrics collection from day 1. Data accumulates as you scale, enabling mathematical optimization later.

**Duration:** 1 week
**Prerequisite:** Phase 5.2 (Redis setup)
**Priority:** HIGH

---

## Phase 5B.1: Queue Infrastructure

### Task 5B.1.1: Create Queue Configuration

**File to create:** `apps/web/lib/queue/config.ts`

**For AI:**

```typescript
import { Queue, Worker, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';

// Redis connection (Upstash)
const connection = new Redis(process.env.UPSTASH_REDIS_URL!, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
});

// Queue tiers by SLA
export const QUEUE_CONFIG = {
  // Realtime: < 5 seconds (user waiting)
  realtime: {
    name: 'realtime',
    concurrency: 10,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 1000,
    },
  },
  
  // Near-realtime: < 60 seconds (acceptable delay)
  background: {
    name: 'background',
    concurrency: 5,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 1000,
    },
  },
  
  // Batch: minutes to hours (scheduled work)
  batch: {
    name: 'batch',
    concurrency: 2,
    defaultJobOptions: {
      attempts: 10,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 50,
      removeOnFail: 500,
    },
  },
} as const;

// Create queues
export const queues = {
  realtime: new Queue(QUEUE_CONFIG.realtime.name, { connection }),
  background: new Queue(QUEUE_CONFIG.background.name, { connection }),
  batch: new Queue(QUEUE_CONFIG.batch.name, { connection }),
};

// Job type to queue mapping
export const JOB_QUEUE_MAP = {
  // Realtime (user waiting)
  'whatsapp:respond': 'realtime',
  'notification:push': 'realtime',
  
  // Background (short delay acceptable)
  'voice:transcribe': 'background',
  'notification:sms': 'background',
  'notification:email': 'background',
  'rating:request': 'background',
  
  // Batch (can wait)
  'invoice:generate': 'batch',
  'invoice:afip-submit': 'batch',
  'report:generate': 'batch',
  'analytics:calculate': 'batch',
  'archive:process': 'batch',
} as const;

export type JobType = keyof typeof JOB_QUEUE_MAP;
```

---

### Task 5B.1.2: Create Job Dispatcher

**File to create:** `apps/web/lib/queue/dispatcher.ts`

**For AI:**

```typescript
import { queues, JOB_QUEUE_MAP, JobType } from './config';
import { metrics } from './metrics';
import { nanoid } from 'nanoid';

interface JobOptions {
  priority?: number;
  delay?: number;
  idempotencyKey?: string;
}

export async function dispatch<T extends JobType>(
  jobType: T,
  data: JobDataMap[T],
  options?: JobOptions
) {
  const queueName = JOB_QUEUE_MAP[jobType];
  const queue = queues[queueName as keyof typeof queues];
  
  // Generate idempotency key if not provided
  const jobId = options?.idempotencyKey || `${jobType}-${nanoid()}`;
  
  // Check for duplicate (idempotency)
  const existing = await queue.getJob(jobId);
  if (existing) {
    metrics.increment('queue.duplicate_prevented', { jobType });
    return existing;
  }
  
  // Add job to queue
  const job = await queue.add(jobType, data, {
    jobId,
    priority: options?.priority,
    delay: options?.delay,
  });
  
  // Record dispatch metric
  metrics.increment('queue.dispatched', {
    jobType,
    queue: queueName,
  });
  
  return job;
}

// Type-safe job data definitions
interface JobDataMap {
  'whatsapp:respond': {
    conversationId: string;
    messageId: string;
    organizationId: string;
  };
  'voice:transcribe': {
    audioUrl: string;
    jobId: string;
    organizationId: string;
  };
  'invoice:generate': {
    jobId: string;
    organizationId: string;
  };
  'invoice:afip-submit': {
    invoiceId: string;
    organizationId: string;
  };
  // ... define all job types
}
```

---

### Task 5B.1.3: Create Worker Processors

**File to create:** `apps/web/lib/queue/workers/index.ts`

**For AI:**

```typescript
import { Worker, Job } from 'bullmq';
import { QUEUE_CONFIG } from '../config';
import { metrics } from '../metrics';
import { connection } from '../config';

// Import processors
import { processWhatsAppRespond } from './whatsapp';
import { processVoiceTranscribe } from './voice';
import { processInvoiceGenerate, processAfipSubmit } from './invoice';
import { processNotification } from './notification';

// Processor registry
const processors: Record<string, (job: Job) => Promise<any>> = {
  'whatsapp:respond': processWhatsAppRespond,
  'voice:transcribe': processVoiceTranscribe,
  'invoice:generate': processInvoiceGenerate,
  'invoice:afip-submit': processAfipSubmit,
  'notification:push': processNotification,
  'notification:sms': processNotification,
  'notification:email': processNotification,
  // ... add all processors
};

// Create workers for each queue
export function startWorkers() {
  const workers: Worker[] = [];
  
  for (const [tier, config] of Object.entries(QUEUE_CONFIG)) {
    const worker = new Worker(
      config.name,
      async (job) => {
        const processor = processors[job.name];
        if (!processor) {
          throw new Error(`No processor for job type: ${job.name}`);
        }
        return processor(job);
      },
      {
        connection,
        concurrency: config.concurrency,
      }
    );
    
    // Attach metrics collection
    attachMetrics(worker, tier);
    
    workers.push(worker);
    console.log(`Started ${tier} worker with concurrency ${config.concurrency}`);
  }
  
  return workers;
}

function attachMetrics(worker: Worker, tier: string) {
  worker.on('completed', (job, result) => {
    const waitTime = job.processedOn! - job.timestamp;
    const processTime = Date.now() - job.processedOn!;
    
    metrics.record('queue.job.completed', {
      queue: tier,
      jobType: job.name,
      waitTime,
      processTime,
      attempts: job.attemptsMade,
    });
  });
  
  worker.on('failed', (job, error) => {
    metrics.record('queue.job.failed', {
      queue: tier,
      jobType: job?.name,
      error: error.message,
      attempts: job?.attemptsMade,
    });
  });
  
  worker.on('stalled', (jobId) => {
    metrics.increment('queue.job.stalled', { queue: tier });
  });
}
```

---

## Phase 5B.2: Metrics Collection System

### Task 5B.2.1: Create Metrics Collector

**File to create:** `apps/web/lib/queue/metrics.ts`

**For AI:**

```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.UPSTASH_REDIS_URL!);

interface MetricData {
  queue?: string;
  jobType?: string;
  waitTime?: number;
  processTime?: number;
  attempts?: number;
  error?: string;
  [key: string]: any;
}

class QueueMetrics {
  private buffer: Array<{
    name: string;
    data: MetricData;
    timestamp: number;
  }> = [];
  
  private flushInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Flush metrics every 10 seconds
    this.flushInterval = setInterval(() => this.flush(), 10000);
  }
  
  increment(name: string, data: MetricData = {}) {
    this.buffer.push({
      name,
      data,
      timestamp: Date.now(),
    });
  }
  
  record(name: string, data: MetricData) {
    this.buffer.push({
      name,
      data,
      timestamp: Date.now(),
    });
  }
  
  async flush() {
    if (this.buffer.length === 0) return;
    
    const toFlush = [...this.buffer];
    this.buffer = [];
    
    // Aggregate metrics
    const aggregated = this.aggregate(toFlush);
    
    // Store in Redis with TTL (30 days)
    const pipeline = redis.pipeline();
    const now = new Date();
    const hourKey = `metrics:${now.toISOString().slice(0, 13)}`; // Hourly bucket
    
    for (const [key, value] of Object.entries(aggregated)) {
      pipeline.hincrby(hourKey, key, value);
    }
    pipeline.expire(hourKey, 60 * 60 * 24 * 30); // 30 days
    
    await pipeline.exec();
    
    // Also store detailed metrics for Little's Law calculations
    await this.storeDetailedMetrics(toFlush);
  }
  
  private aggregate(metrics: typeof this.buffer) {
    const result: Record<string, number> = {};
    
    for (const metric of metrics) {
      // Count by type
      const countKey = `${metric.name}:count`;
      result[countKey] = (result[countKey] || 0) + 1;
      
      // Sum wait times for averaging later
      if (metric.data.waitTime) {
        const waitKey = `${metric.name}:${metric.data.jobType}:waitTime:sum`;
        result[waitKey] = (result[waitKey] || 0) + metric.data.waitTime;
      }
      
      // Sum process times
      if (metric.data.processTime) {
        const processKey = `${metric.name}:${metric.data.jobType}:processTime:sum`;
        result[processKey] = (result[processKey] || 0) + metric.data.processTime;
      }
    }
    
    return result;
  }
  
  private async storeDetailedMetrics(metrics: typeof this.buffer) {
    // Store individual job metrics for analysis
    // Use sorted set for time-series queries
    const pipeline = redis.pipeline();
    
    for (const metric of metrics) {
      if (metric.name === 'queue.job.completed' && metric.data.jobType) {
        const key = `metrics:jobs:${metric.data.jobType}`;
        pipeline.zadd(key, metric.timestamp, JSON.stringify({
          waitTime: metric.data.waitTime,
          processTime: metric.data.processTime,
          attempts: metric.data.attempts,
        }));
        // Keep last 10,000 entries per job type
        pipeline.zremrangebyrank(key, 0, -10001);
      }
    }
    
    await pipeline.exec();
  }
  
  // Query methods for dashboard/analysis
  async getJobStats(jobType: string, hours: number = 24): Promise<{
    count: number;
    avgWaitTime: number;
    avgProcessTime: number;
    p95WaitTime: number;
    p95ProcessTime: number;
  }> {
    const key = `metrics:jobs:${jobType}`;
    const since = Date.now() - (hours * 60 * 60 * 1000);
    
    const entries = await redis.zrangebyscore(key, since, '+inf');
    
    if (entries.length === 0) {
      return {
        count: 0,
        avgWaitTime: 0,
        avgProcessTime: 0,
        p95WaitTime: 0,
        p95ProcessTime: 0,
      };
    }
    
    const parsed = entries.map(e => JSON.parse(e));
    const waitTimes = parsed.map(p => p.waitTime).sort((a, b) => a - b);
    const processTimes = parsed.map(p => p.processTime).sort((a, b) => a - b);
    
    return {
      count: entries.length,
      avgWaitTime: waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length,
      avgProcessTime: processTimes.reduce((a, b) => a + b, 0) / processTimes.length,
      p95WaitTime: waitTimes[Math.floor(waitTimes.length * 0.95)] || 0,
      p95ProcessTime: processTimes[Math.floor(processTimes.length * 0.95)] || 0,
    };
  }
  
  // Little's Law calculation
  async calculateOptimalConcurrency(jobType: string): Promise<{
    currentConcurrency: number;
    recommendedConcurrency: number;
    arrivalRate: number; // λ (jobs per second)
    avgServiceTime: number; // 1/μ (seconds per job)
    currentUtilization: number; // ρ
  }> {
    const stats = await this.getJobStats(jobType, 1); // Last hour
    
    if (stats.count < 100) {
      return {
        currentConcurrency: 0,
        recommendedConcurrency: 0,
        arrivalRate: 0,
        avgServiceTime: 0,
        currentUtilization: 0,
      };
    }
    
    // λ = jobs per second (arrival rate)
    const arrivalRate = stats.count / 3600;
    
    // Average service time in seconds
    const avgServiceTime = stats.avgProcessTime / 1000;
    
    // Current concurrency (from config)
    const queueName = JOB_QUEUE_MAP[jobType as JobType];
    const currentConcurrency = QUEUE_CONFIG[queueName as keyof typeof QUEUE_CONFIG]?.concurrency || 1;
    
    // ρ = λ / (c × μ) where μ = 1/avgServiceTime
    const serviceRate = 1 / avgServiceTime;
    const currentUtilization = arrivalRate / (currentConcurrency * serviceRate);
    
    // Recommended: target 70% utilization for headroom
    // c = λ / (0.7 × μ)
    const targetUtilization = 0.7;
    const recommendedConcurrency = Math.ceil(arrivalRate / (targetUtilization * serviceRate));
    
    return {
      currentConcurrency,
      recommendedConcurrency: Math.max(recommendedConcurrency, 1),
      arrivalRate,
      avgServiceTime,
      currentUtilization,
    };
  }
}

export const metrics = new QueueMetrics();
```

---

### Task 5B.2.2: Create Queue Dashboard API

**File to create:** `apps/web/app/api/admin/queue-metrics/route.ts`

**For AI:**

```typescript
import { metrics } from '@/lib/queue/metrics';
import { JOB_QUEUE_MAP } from '@/lib/queue/config';

// GET /api/admin/queue-metrics
// Returns queue health and optimization recommendations

export async function GET(request: Request) {
  // Admin auth check
  await requireAdmin(request);
  
  const results: Record<string, any> = {};
  
  for (const jobType of Object.keys(JOB_QUEUE_MAP)) {
    const stats = await metrics.getJobStats(jobType, 24);
    const optimization = await metrics.calculateOptimalConcurrency(jobType);
    
    results[jobType] = {
      last24h: stats,
      optimization,
      status: getHealthStatus(stats, optimization),
    };
  }
  
  return Response.json({
    timestamp: new Date().toISOString(),
    queues: results,
  });
}

function getHealthStatus(stats: any, optimization: any): 'healthy' | 'warning' | 'critical' {
  if (optimization.currentUtilization > 0.9) return 'critical';
  if (optimization.currentUtilization > 0.7) return 'warning';
  if (stats.p95WaitTime > 30000) return 'warning'; // 30s wait
  return 'healthy';
}
```

---

### Task 5B.2.3: Create BullBoard Dashboard

**File to create:** `apps/web/app/api/admin/bull-board/route.ts`

**For AI:** Install and configure BullBoard for visual queue management:

```bash
npm install @bull-board/api @bull-board/express
```

```typescript
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { queues } from '@/lib/queue/config';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/admin/bull-board');

createBullBoard({
  queues: [
    new BullMQAdapter(queues.realtime),
    new BullMQAdapter(queues.background),
    new BullMQAdapter(queues.batch),
  ],
  serverAdapter,
});

export const GET = serverAdapter.getRouter();
export const POST = serverAdapter.getRouter();
```

---

## Phase 5B.3: Dead Letter Queue (DLQ) System

### Task 5B.3.1: Create DLQ Handler

**File to create:** `apps/web/lib/queue/dlq.ts`

**For AI:**

```typescript
import { Queue, Job } from 'bullmq';
import { connection } from './config';

// Dead Letter Queue for permanently failed jobs
export const dlq = new Queue('dead-letter', { connection });

export async function moveToDeadLetter(job: Job, error: Error) {
  await dlq.add('failed-job', {
    originalQueue: job.queueName,
    originalJobType: job.name,
    originalData: job.data,
    error: {
      message: error.message,
      stack: error.stack,
    },
    attempts: job.attemptsMade,
    failedAt: new Date().toISOString(),
  }, {
    removeOnComplete: false, // Keep for investigation
  });
  
  // Alert on DLQ growth
  const dlqSize = await dlq.getWaitingCount();
  if (dlqSize > 100) {
    await alertOps(`DLQ has ${dlqSize} jobs - investigation needed`);
  }
}

// API to review and retry DLQ jobs
export async function retryFromDLQ(dlqJobId: string): Promise<boolean> {
  const dlqJob = await dlq.getJob(dlqJobId);
  if (!dlqJob) return false;
  
  const { originalQueue, originalJobType, originalData } = dlqJob.data;
  
  // Re-dispatch to original queue
  const targetQueue = queues[originalQueue as keyof typeof queues];
  await targetQueue.add(originalJobType, originalData, {
    attempts: 3, // Fresh retry attempts
  });
  
  // Remove from DLQ
  await dlqJob.remove();
  
  return true;
}
```

---

### Task 5B.3.2: Add DLQ to Workers

**File to modify:** `apps/web/lib/queue/workers/index.ts`

**For AI:** Update worker error handling:

```typescript
worker.on('failed', async (job, error) => {
  metrics.record('queue.job.failed', { ... });
  
  // If exhausted all retries, move to DLQ
  if (job && job.attemptsMade >= job.opts.attempts!) {
    await moveToDeadLetter(job, error);
  }
});
```

---

## Phase 5B COMPLETE CHECKLIST

- ⬜ Queue configuration created
- ⬜ Job dispatcher with idempotency
- ⬜ Worker processors for all job types
- ⬜ Metrics collector implemented
- ⬜ Little's Law calculator implemented
- ⬜ Queue dashboard API created
- ⬜ BullBoard installed and configured
- ⬜ DLQ handler created
- ⬜ All workers instrumented with metrics
- ⬜ Integration tested end-to-end

**Phase 5B Sign-Off Date:** ___________

---

# PHASE 6A: External API Resilience

**Plain Language:** AFIP, MercadoPago, OpenAI, WhatsApp - all have rate limits and downtime. This phase ensures your system doesn't crash when they do.

**Duration:** 1-2 weeks
**Prerequisite:** Phase 5B (queue system)
**Priority:** CRITICAL - especially AFIP

---

## Phase 6A.1: AFIP Rate Limiting & Retry Strategy

**This is your biggest risk at scale.** AFIP's API is slow, unreliable, and will throttle you hard.

### Task 6A.1.1: Create AFIP Client Wrapper

**File to create:** `apps/web/lib/integrations/afip/client.ts`

**For AI:**

```typescript
import { RateLimiter } from 'limiter';
import { CircuitBreaker } from 'opossum';

// AFIP rate limits (estimated - they don't publish official limits)
const AFIP_RATE_LIMITS = {
  invoicesPerMinute: 60,  // Conservative estimate
  invoicesPerHour: 1000,
  invoicesPerDay: 10000,
};

// Rate limiter
const minuteLimiter = new RateLimiter({
  tokensPerInterval: AFIP_RATE_LIMITS.invoicesPerMinute,
  interval: 'minute',
});

const hourLimiter = new RateLimiter({
  tokensPerInterval: AFIP_RATE_LIMITS.invoicesPerHour,
  interval: 'hour',
});

// Circuit breaker for AFIP outages
const circuitBreaker = new CircuitBreaker(callAfipApi, {
  timeout: 30000,        // 30s timeout
  errorThresholdPercentage: 50, // Open circuit if 50% fail
  resetTimeout: 60000,   // Try again after 1 minute
});

circuitBreaker.on('open', () => {
  console.error('AFIP circuit breaker OPEN - service degraded');
  alertOps('AFIP circuit breaker opened - invoicing degraded');
});

circuitBreaker.on('halfOpen', () => {
  console.log('AFIP circuit breaker half-open - testing');
});

circuitBreaker.on('close', () => {
  console.log('AFIP circuit breaker closed - service restored');
});

export async function submitInvoiceToAfip(invoiceData: AfipInvoiceData): Promise<AfipResponse> {
  // Check rate limits before proceeding
  const canProceed = await checkRateLimits();
  
  if (!canProceed) {
    // Return a "retry later" response
    return {
      success: false,
      error: 'RATE_LIMITED',
      retryAfter: 60, // seconds
    };
  }
  
  try {
    const result = await circuitBreaker.fire(invoiceData);
    return result;
  } catch (error) {
    if (circuitBreaker.opened) {
      return {
        success: false,
        error: 'AFIP_UNAVAILABLE',
        retryAfter: 300, // 5 minutes
      };
    }
    throw error;
  }
}

async function checkRateLimits(): Promise<boolean> {
  const minuteOk = await minuteLimiter.tryRemoveTokens(1);
  if (!minuteOk) return false;
  
  const hourOk = await hourLimiter.tryRemoveTokens(1);
  if (!hourOk) {
    // Refund minute token
    minuteLimiter.tryRemoveTokens(-1);
    return false;
  }
  
  return true;
}

async function callAfipApi(invoiceData: AfipInvoiceData): Promise<AfipResponse> {
  // Actual AFIP API call implementation
  // ... existing AFIP integration code
}
```

---

### Task 6A.1.2: Create AFIP Invoice Queue Processor

**File to create:** `apps/web/lib/queue/workers/afip.ts`

**For AI:**

```typescript
import { Job } from 'bullmq';
import { submitInvoiceToAfip } from '@/lib/integrations/afip/client';

export async function processAfipSubmit(job: Job<AfipJobData>) {
  const { invoiceId, organizationId } = job.data;
  
  // Get invoice from database
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { organization: true },
  });
  
  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }
  
  // Submit to AFIP
  const result = await submitInvoiceToAfip({
    invoice,
    organization: invoice.organization,
  });
  
  if (!result.success) {
    if (result.error === 'RATE_LIMITED' || result.error === 'AFIP_UNAVAILABLE') {
      // Throw error to trigger retry with backoff
      const error = new Error(result.error);
      (error as any).retryAfter = result.retryAfter;
      throw error;
    }
    
    // Permanent failure
    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        afipStatus: 'FAILED',
        afipError: result.error,
      },
    });
    
    // Notify business owner
    await dispatch('notification:push', {
      userId: invoice.organization.ownerId,
      title: 'Error en facturación AFIP',
      body: `La factura #${invoice.number} no pudo procesarse. Error: ${result.error}`,
    });
    
    return { success: false, error: result.error };
  }
  
  // Success - update invoice
  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      afipStatus: 'SUBMITTED',
      afipCae: result.cae,
      afipCaeExpiry: result.caeExpiry,
    },
  });
  
  return { success: true, cae: result.cae };
}
```

---

### Task 6A.1.3: Create AFIP Batch Processor

**What this does:** Instead of submitting invoices one-by-one as they're created, batch them for efficiency.

**File to create:** `apps/web/lib/queue/workers/afip-batch.ts`

**For AI:**

```typescript
// Cron: Every 5 minutes
// Collects pending invoices and submits in batches

export async function processAfipBatch() {
  // Get pending invoices (max 50 per batch)
  const pendingInvoices = await db.invoice.findMany({
    where: {
      afipStatus: 'PENDING',
      createdAt: { lt: subMinutes(new Date(), 2) }, // At least 2 min old
    },
    take: 50,
    orderBy: { createdAt: 'asc' },
  });
  
  if (pendingInvoices.length === 0) return;
  
  console.log(`Processing AFIP batch of ${pendingInvoices.length} invoices`);
  
  // Process with rate limiting
  for (const invoice of pendingInvoices) {
    await dispatch('invoice:afip-submit', {
      invoiceId: invoice.id,
      organizationId: invoice.organizationId,
    });
    
    // Small delay between dispatches to spread load
    await sleep(100);
  }
}
```

---

### Task 6A.1.4: Create AFIP Status Dashboard

**File to create:** `apps/web/app/api/admin/afip-status/route.ts`

**For AI:**

```typescript
// GET /api/admin/afip-status
// Returns AFIP integration health

export async function GET() {
  const [pending, failed, submitted, circuitStatus] = await Promise.all([
    db.invoice.count({ where: { afipStatus: 'PENDING' } }),
    db.invoice.count({ where: { afipStatus: 'FAILED' } }),
    db.invoice.count({ where: { afipStatus: 'SUBMITTED', createdAt: { gt: subDays(new Date(), 1) } } }),
    getCircuitBreakerStatus(),
  ]);
  
  return Response.json({
    status: circuitStatus.opened ? 'degraded' : 'healthy',
    circuitBreaker: circuitStatus,
    invoices: {
      pending,
      failed,
      submittedLast24h: submitted,
    },
    rateLimits: await getRateLimitStatus(),
  });
}
```

---

## Phase 6A.2: OpenAI Cost Controls

### Task 6A.2.1: Create OpenAI Usage Tracker

**File to create:** `apps/web/lib/integrations/openai/usage.ts`

**For AI:**

```typescript
const MONTHLY_BUDGET_USD = 500; // Adjust based on your budget
const DAILY_BUDGET_USD = MONTHLY_BUDGET_USD / 30;

// Token costs (as of 2024, update as needed)
const COSTS = {
  'gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 },
  'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
  'gpt-3.5-turbo': { input: 0.0005 / 1000, output: 0.0015 / 1000 },
  'whisper-1': { perMinute: 0.006 },
};

export async function trackOpenAIUsage(usage: {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  audioMinutes?: number;
  organizationId: string;
}) {
  let cost = 0;
  
  if (usage.model === 'whisper-1' && usage.audioMinutes) {
    cost = usage.audioMinutes * COSTS['whisper-1'].perMinute;
  } else if (usage.inputTokens && usage.outputTokens) {
    const modelCosts = COSTS[usage.model as keyof typeof COSTS] as any;
    cost = (usage.inputTokens * modelCosts.input) + (usage.outputTokens * modelCosts.output);
  }
  
  // Store in Redis for fast aggregation
  const today = new Date().toISOString().slice(0, 10);
  const monthKey = `openai:cost:${today.slice(0, 7)}`;
  const dayKey = `openai:cost:${today}`;
  const orgKey = `openai:cost:${today}:${usage.organizationId}`;
  
  await redis.incrbyfloat(monthKey, cost);
  await redis.incrbyfloat(dayKey, cost);
  await redis.incrbyfloat(orgKey, cost);
  
  // Check budget
  const dailySpend = parseFloat(await redis.get(dayKey) || '0');
  if (dailySpend > DAILY_BUDGET_USD * 0.8) {
    await alertOps(`OpenAI daily spend at ${Math.round(dailySpend / DAILY_BUDGET_USD * 100)}% of budget`);
  }
  
  return { cost, dailySpend };
}

export async function checkOpenAIBudget(): Promise<{
  canProceed: boolean;
  reason?: string;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const dayKey = `openai:cost:${today}`;
  
  const dailySpend = parseFloat(await redis.get(dayKey) || '0');
  
  if (dailySpend >= DAILY_BUDGET_USD) {
    return {
      canProceed: false,
      reason: 'Daily OpenAI budget exceeded',
    };
  }
  
  return { canProceed: true };
}
```

---

### Task 6A.2.2: Create AI Fallback Handler

**File to create:** `apps/web/lib/integrations/openai/fallback.ts`

**For AI:**

```typescript
// When OpenAI is unavailable or over budget, fall back gracefully

export async function handleWhatsAppWithFallback(
  message: string,
  context: WhatsAppContext
): Promise<WhatsAppResponse> {
  // Check budget
  const budget = await checkOpenAIBudget();
  if (!budget.canProceed) {
    return escalateToHuman(context, 'AI temporarily unavailable');
  }
  
  // Check circuit breaker
  if (openaiCircuitBreaker.opened) {
    return escalateToHuman(context, 'AI service temporarily degraded');
  }
  
  try {
    // Try AI response
    const response = await processWithAI(message, context);
    return response;
  } catch (error) {
    // AI failed, escalate to human
    return escalateToHuman(context, `AI error: ${error.message}`);
  }
}

function escalateToHuman(context: WhatsAppContext, reason: string): WhatsAppResponse {
  // Notify business owner/dispatcher
  dispatch('notification:push', {
    userId: context.organization.ownerId,
    title: 'WhatsApp necesita atención',
    body: `Mensaje de ${context.customerPhone} requiere respuesta manual`,
    data: { conversationId: context.conversationId },
  });
  
  // Send holding message to customer
  return {
    message: 'Gracias por tu mensaje. Un representante te responderá en breve.',
    aiHandled: false,
    escalationReason: reason,
  };
}
```

---

## Phase 6A.3: MercadoPago Resilience

### Task 6A.3.1: Create MercadoPago Client Wrapper

**File to create:** `apps/web/lib/integrations/mercadopago/client.ts`

**For AI:**

```typescript
import { CircuitBreaker } from 'opossum';

const circuitBreaker = new CircuitBreaker(callMercadoPagoApi, {
  timeout: 15000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

export async function createPaymentPreference(data: PaymentData): Promise<PaymentResponse> {
  try {
    return await circuitBreaker.fire(data);
  } catch (error) {
    if (circuitBreaker.opened) {
      // Fallback: Return manual payment instructions
      return {
        success: false,
        fallback: true,
        manualPaymentInstructions: {
          alias: process.env.MP_ALIAS,
          cbu: process.env.MP_CBU,
          amount: data.amount,
          reference: data.referenceId,
        },
      };
    }
    throw error;
  }
}

// Webhook handler with idempotency
export async function handleMercadoPagoWebhook(payload: MPWebhook): Promise<void> {
  // Idempotency check
  const processed = await redis.get(`mp:webhook:${payload.id}`);
  if (processed) {
    console.log(`MP webhook ${payload.id} already processed, skipping`);
    return;
  }
  
  // Process webhook
  await processPaymentUpdate(payload);
  
  // Mark as processed (24h TTL)
  await redis.set(`mp:webhook:${payload.id}`, 'processed', 'EX', 86400);
}
```

---

## Phase 6A.4: WhatsApp API Resilience

### Task 6A.4.1: Create WhatsApp Message Queue

**File to create:** `apps/web/lib/integrations/whatsapp/queue.ts`

**For AI:**

```typescript
// WhatsApp has strict rate limits (80 messages/second for business API)
// Queue ensures we don't exceed limits

const WA_RATE_LIMIT = 80; // per second

const rateLimiter = new RateLimiter({
  tokensPerInterval: WA_RATE_LIMIT,
  interval: 'second',
});

export async function queueWhatsAppMessage(message: WAMessage): Promise<void> {
  await dispatch('whatsapp:send', message, {
    // Deduplicate by conversation + content hash
    idempotencyKey: `wa-${message.conversationId}-${hash(message.content)}`,
  });
}

export async function processWhatsAppSend(job: Job<WAMessage>): Promise<void> {
  // Wait for rate limit token
  await rateLimiter.removeTokens(1);
  
  // Send message
  const result = await sendWhatsAppMessage(job.data);
  
  if (!result.success && result.error === 'RATE_LIMITED') {
    // Re-queue with delay
    throw new Error('RATE_LIMITED'); // BullMQ will retry with backoff
  }
}
```

---

## Phase 6A COMPLETE CHECKLIST

- ⬜ AFIP client wrapper with rate limiting
- ⬜ AFIP circuit breaker implemented
- ⬜ AFIP batch processor created
- ⬜ AFIP status dashboard
- ⬜ OpenAI usage tracker
- ⬜ OpenAI budget controls
- ⬜ AI fallback handler (escalate to human)
- ⬜ MercadoPago circuit breaker
- ⬜ MercadoPago fallback (manual payment)
- ⬜ WhatsApp rate limiter
- ⬜ All integrations have circuit breakers
- ⬜ All integrations have fallbacks

**Phase 6A Sign-Off Date:** ___________

---

# PHASE 6B: Graceful Degradation System

**Plain Language:** When things break (and they will), the system should slow down, not crash. This phase builds the safety nets.

**Duration:** 1 week
**Prerequisite:** Phase 6A
**Priority:** HIGH

---

## Phase 6B.1: Feature Degradation Framework

### Task 6B.1.1: Create Degradation Manager

**File to create:** `apps/web/lib/degradation/manager.ts`

**For AI:**

```typescript
// Feature health states
type FeatureStatus = 'healthy' | 'degraded' | 'offline';

interface FeatureHealth {
  status: FeatureStatus;
  message?: string;
  since?: Date;
}

// Features that can be degraded
const FEATURES = {
  'ai.whatsapp': { critical: false, fallback: 'manual' },
  'ai.voice': { critical: false, fallback: 'manual' },
  'payments.mercadopago': { critical: false, fallback: 'manual' },
  'invoicing.afip': { critical: true, fallback: 'queue' },
  'tracking.realtime': { critical: false, fallback: 'polling' },
  'notifications.push': { critical: false, fallback: 'email' },
} as const;

type FeatureKey = keyof typeof FEATURES;

class DegradationManager {
  private health: Map<FeatureKey, FeatureHealth> = new Map();
  
  constructor() {
    // Initialize all features as healthy
    for (const feature of Object.keys(FEATURES) as FeatureKey[]) {
      this.health.set(feature, { status: 'healthy' });
    }
  }
  
  setStatus(feature: FeatureKey, status: FeatureStatus, message?: string) {
    const previous = this.health.get(feature);
    
    this.health.set(feature, {
      status,
      message,
      since: status !== previous?.status ? new Date() : previous?.since,
    });
    
    // Alert on status change
    if (status !== previous?.status) {
      this.alertStatusChange(feature, previous?.status || 'healthy', status);
    }
  }
  
  getStatus(feature: FeatureKey): FeatureHealth {
    return this.health.get(feature) || { status: 'healthy' };
  }
  
  isHealthy(feature: FeatureKey): boolean {
    return this.getStatus(feature).status === 'healthy';
  }
  
  shouldUseFallback(feature: FeatureKey): boolean {
    const status = this.getStatus(feature).status;
    return status === 'degraded' || status === 'offline';
  }
  
  getFallbackType(feature: FeatureKey): string {
    return FEATURES[feature].fallback;
  }
  
  getSystemHealth(): {
    overall: FeatureStatus;
    features: Record<FeatureKey, FeatureHealth>;
  } {
    const features = Object.fromEntries(this.health) as Record<FeatureKey, FeatureHealth>;
    
    // Overall status is worst status of critical features
    let overall: FeatureStatus = 'healthy';
    
    for (const [key, health] of this.health) {
      if (FEATURES[key as FeatureKey].critical) {
        if (health.status === 'offline') {
          overall = 'offline';
          break;
        } else if (health.status === 'degraded' && overall === 'healthy') {
          overall = 'degraded';
        }
      }
    }
    
    return { overall, features };
  }
  
  private async alertStatusChange(
    feature: FeatureKey,
    from: FeatureStatus,
    to: FeatureStatus
  ) {
    console.log(`Feature ${feature} changed from ${from} to ${to}`);
    
    if (to === 'offline' && FEATURES[feature].critical) {
      await alertOps(`CRITICAL: ${feature} is offline`, 'urgent');
    } else if (to !== 'healthy') {
      await alertOps(`Feature ${feature} is ${to}`, 'warning');
    }
  }
}

export const degradation = new DegradationManager();
```

---

### Task 6B.1.2: Connect Circuit Breakers to Degradation Manager

**File to modify:** All circuit breaker configurations

**For AI:**

```typescript
// Example: AFIP circuit breaker
afipCircuitBreaker.on('open', () => {
  degradation.setStatus('invoicing.afip', 'degraded', 'AFIP rate limited or unavailable');
});

afipCircuitBreaker.on('close', () => {
  degradation.setStatus('invoicing.afip', 'healthy');
});

// Example: OpenAI circuit breaker
openaiCircuitBreaker.on('open', () => {
  degradation.setStatus('ai.whatsapp', 'offline', 'OpenAI unavailable');
  degradation.setStatus('ai.voice', 'offline', 'OpenAI unavailable');
});

openaiCircuitBreaker.on('close', () => {
  degradation.setStatus('ai.whatsapp', 'healthy');
  degradation.setStatus('ai.voice', 'healthy');
});
```

---

### Task 6B.1.3: Create System Health Endpoint

**File to create:** `apps/web/app/api/health/route.ts`

**For AI:**

```typescript
// GET /api/health
// Returns system health for monitoring and load balancers

export async function GET() {
  const health = degradation.getSystemHealth();
  
  // HTTP status based on health
  const status = health.overall === 'healthy' ? 200 :
                 health.overall === 'degraded' ? 200 :
                 503; // offline
  
  return Response.json({
    status: health.overall,
    timestamp: new Date().toISOString(),
    features: health.features,
    database: await checkDatabaseHealth(),
    cache: await checkCacheHealth(),
  }, { status });
}

async function checkDatabaseHealth(): Promise<FeatureHealth> {
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'offline', message: error.message };
  }
}

async function checkCacheHealth(): Promise<FeatureHealth> {
  try {
    await redis.ping();
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'offline', message: error.message };
  }
}
```

---

### Task 6B.1.4: Create Client-Side Degradation Handler

**File to create:** `apps/web/lib/client/degradation.ts`

**For AI:**

```typescript
// Client-side handling of degraded features

interface DegradationState {
  features: Record<string, {
    status: 'healthy' | 'degraded' | 'offline';
    message?: string;
  }>;
}

class ClientDegradation {
  private state: DegradationState = { features: {} };
  private listeners: Set<(state: DegradationState) => void> = new Set();
  
  async refresh() {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      this.state = { features: data.features };
      this.notify();
    } catch (error) {
      // Can't reach API - assume degraded
      console.error('Health check failed:', error);
    }
  }
  
  subscribe(listener: (state: DegradationState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
  
  isFeatureAvailable(feature: string): boolean {
    const featureHealth = this.state.features[feature];
    return !featureHealth || featureHealth.status === 'healthy';
  }
  
  getFeatureMessage(feature: string): string | undefined {
    return this.state.features[feature]?.message;
  }
}

export const clientDegradation = new ClientDegradation();

// Refresh every 30 seconds
setInterval(() => clientDegradation.refresh(), 30000);
```

---

### Task 6B.1.5: Create Degradation UI Components

**File to create:** `apps/web/components/DegradationBanner.tsx`

**For AI:**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { clientDegradation } from '@/lib/client/degradation';
import { AlertTriangle, AlertCircle } from 'lucide-react';

export function DegradationBanner() {
  const [degradedFeatures, setDegradedFeatures] = useState<string[]>([]);
  
  useEffect(() => {
    const unsubscribe = clientDegradation.subscribe((state) => {
      const degraded = Object.entries(state.features)
        .filter(([_, health]) => health.status !== 'healthy')
        .map(([feature, _]) => feature);
      setDegradedFeatures(degraded);
    });
    
    clientDegradation.refresh();
    
    return unsubscribe;
  }, []);
  
  if (degradedFeatures.length === 0) return null;
  
  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
      <div className="flex items-center gap-2 text-yellow-800 text-sm">
        <AlertTriangle className="h-4 w-4" />
        <span>
          Algunas funciones están temporalmente limitadas: {' '}
          {degradedFeatures.map(f => FEATURE_NAMES[f]).join(', ')}
        </span>
      </div>
    </div>
  );
}

const FEATURE_NAMES: Record<string, string> = {
  'ai.whatsapp': 'IA de WhatsApp',
  'ai.voice': 'Reportes por voz',
  'payments.mercadopago': 'Pagos online',
  'invoicing.afip': 'Facturación AFIP',
  'tracking.realtime': 'Seguimiento en vivo',
};
```

---

## Phase 6B.2: Database Fallbacks

### Task 6B.2.1: Create Cached Read Fallback

**File to create:** `apps/web/lib/db/fallback.ts`

**For AI:**

```typescript
// When database is slow or unavailable, serve from cache

export async function withCacheFallback<T>(
  key: string,
  dbQuery: () => Promise<T>,
  options: {
    ttl?: number;
    staleWhileRevalidate?: boolean;
  } = {}
): Promise<T> {
  const { ttl = 300, staleWhileRevalidate = true } = options;
  
  // Try cache first
  const cached = await redis.get(key);
  
  // Try database
  try {
    const result = await Promise.race([
      dbQuery(),
      sleep(5000).then(() => { throw new Error('DB_TIMEOUT'); }),
    ]);
    
    // Update cache
    await redis.set(key, JSON.stringify(result), 'EX', ttl);
    
    return result;
  } catch (error) {
    // If we have cached data, use it (stale)
    if (cached && staleWhileRevalidate) {
      console.warn(`Using stale cache for ${key}: ${error.message}`);
      return JSON.parse(cached);
    }
    
    throw error;
  }
}

// Usage example:
// const org = await withCacheFallback(
//   `org:${organizationId}`,
//   () => db.organization.findUnique({ where: { id: organizationId } }),
//   { ttl: 3600 }
// );
```

---

### Task 6B.2.2: Create Write Queue for Database Overload

**File to create:** `apps/web/lib/db/write-queue.ts`

**For AI:**

```typescript
// When database is under heavy load, queue writes instead of failing

const WRITE_QUEUE_THRESHOLD_MS = 2000; // If writes take longer than 2s

export async function safeDbWrite<T>(
  operation: () => Promise<T>,
  fallback: {
    queue: string;
    data: any;
  }
): Promise<T | { queued: true; jobId: string }> {
  const start = Date.now();
  
  try {
    const result = await Promise.race([
      operation(),
      sleep(WRITE_QUEUE_THRESHOLD_MS).then(() => { 
        throw new Error('DB_WRITE_SLOW'); 
      }),
    ]);
    
    return result;
  } catch (error) {
    if (error.message === 'DB_WRITE_SLOW') {
      // Queue the write for later processing
      const job = await dispatch(fallback.queue as any, fallback.data);
      
      return {
        queued: true,
        jobId: job.id!,
      };
    }
    
    throw error;
  }
}
```

---

## Phase 6B.3: Real-time to Polling Fallback

### Task 6B.3.1: Create Adaptive Tracking System

**File to create:** `apps/web/lib/tracking/adaptive.ts`

**For AI:**

```typescript
// Automatically switch between WebSocket and polling based on system health

type TrackingMode = 'realtime' | 'polling';

class AdaptiveTracking {
  private mode: TrackingMode = 'realtime';
  private pollingInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Listen to degradation manager
    // When realtime is degraded, switch to polling
  }
  
  setMode(mode: TrackingMode) {
    if (this.mode === mode) return;
    
    this.mode = mode;
    console.log(`Tracking mode changed to: ${mode}`);
    
    if (mode === 'polling') {
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }
  
  private startPolling() {
    if (this.pollingInterval) return;
    
    this.pollingInterval = setInterval(async () => {
      await this.pollTrackingUpdates();
    }, 30000); // Poll every 30 seconds
  }
  
  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
  
  private async pollTrackingUpdates() {
    // Fetch latest tracking data via REST API
    // Update local state
  }
}
```

---

## Phase 6B COMPLETE CHECKLIST

- ⬜ Degradation manager created
- ⬜ All circuit breakers connected to degradation manager
- ⬜ System health endpoint created
- ⬜ Client-side degradation handler created
- ⬜ Degradation banner component created
- ⬜ Database cache fallback implemented
- ⬜ Database write queue implemented
- ⬜ Real-time to polling fallback implemented
- ⬜ All fallbacks tested manually

**Phase 6B Sign-Off Date:** ___________

---

# PHASE 8A: Cost Controls & Alerting

**Plain Language:** At scale, costs can spiral. This phase ensures you know what you're spending and get alerts before bills surprise you.

**Duration:** 3-4 days
**Prerequisite:** Phase 8 (Observability)
**Priority:** MEDIUM-HIGH

---

## Phase 8A.1: Cost Tracking Infrastructure

### Task 8A.1.1: Create Cost Dashboard

**File to create:** `apps/admin/app/dashboard/costs/page.tsx`

**For AI:**

```tsx
export default async function CostsPage() {
  const costs = await getCostBreakdown();
  
  return (
    <div className="space-y-6">
      <h1>Cost Overview</h1>
      
      {/* Current month summary */}
      <CostSummaryCard 
        total={costs.total}
        budget={costs.budget}
        percentUsed={(costs.total / costs.budget) * 100}
      />
      
      {/* Breakdown by service */}
      <CostBreakdownChart data={costs.byService} />
      
      {/* Breakdown by organization (top consumers) */}
      <TopConsumersTable data={costs.topOrganizations} />
      
      {/* Trends */}
      <CostTrendChart data={costs.dailyTrend} />
      
      {/* Alerts */}
      <CostAlerts alerts={costs.alerts} />
    </div>
  );
}
```

---

### Task 8A.1.2: Create Cost Aggregator

**File to create:** `apps/web/lib/costs/aggregator.ts`

**For AI:**

```typescript
interface CostEntry {
  service: 'openai' | 'twilio' | 'supabase' | 'vercel' | 'maps';
  amount: number;
  organizationId?: string;
  metadata?: Record<string, any>;
}

class CostAggregator {
  async track(entry: CostEntry) {
    const date = new Date().toISOString().slice(0, 10);
    
    // Store in Redis for fast aggregation
    const keys = [
      `costs:${date}:total`,
      `costs:${date}:${entry.service}`,
    ];
    
    if (entry.organizationId) {
      keys.push(`costs:${date}:org:${entry.organizationId}`);
      keys.push(`costs:${date}:org:${entry.organizationId}:${entry.service}`);
    }
    
    const pipeline = redis.pipeline();
    for (const key of keys) {
      pipeline.incrbyfloat(key, entry.amount);
      pipeline.expire(key, 60 * 60 * 24 * 90); // 90 days
    }
    await pipeline.exec();
    
    // Check thresholds
    await this.checkThresholds(date, entry.service);
  }
  
  async getBreakdown(date?: string): Promise<CostBreakdown> {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    
    const [total, openai, twilio, supabase, vercel, maps] = await Promise.all([
      redis.get(`costs:${targetDate}:total`),
      redis.get(`costs:${targetDate}:openai`),
      redis.get(`costs:${targetDate}:twilio`),
      redis.get(`costs:${targetDate}:supabase`),
      redis.get(`costs:${targetDate}:vercel`),
      redis.get(`costs:${targetDate}:maps`),
    ]);
    
    return {
      total: parseFloat(total || '0'),
      byService: {
        openai: parseFloat(openai || '0'),
        twilio: parseFloat(twilio || '0'),
        supabase: parseFloat(supabase || '0'),
        vercel: parseFloat(vercel || '0'),
        maps: parseFloat(maps || '0'),
      },
    };
  }
  
  private async checkThresholds(date: string, service: string) {
    const thresholds = {
      openai: { daily: 50, monthly: 500 },
      twilio: { daily: 20, monthly: 200 },
      maps: { daily: 30, monthly: 300 },
    };
    
    const threshold = thresholds[service as keyof typeof thresholds];
    if (!threshold) return;
    
    const current = parseFloat(await redis.get(`costs:${date}:${service}`) || '0');
    
    if (current > threshold.daily * 0.8) {
      await alertOps(`${service} daily spend at ${Math.round(current / threshold.daily * 100)}%`);
    }
  }
}

export const costs = new CostAggregator();
```

---

### Task 8A.1.3: Integrate Cost Tracking with Services

**For AI:** Add cost tracking to each external service call:

```typescript
// OpenAI - already done in Phase 6A.2

// Twilio (SMS)
async function sendSMS(to: string, body: string) {
  const result = await twilioClient.messages.create({ to, body, from: TWILIO_NUMBER });
  
  // Track cost (approximate $0.0079 per SMS segment)
  const segments = Math.ceil(body.length / 160);
  await costs.track({
    service: 'twilio',
    amount: segments * 0.0079,
    organizationId: contextOrganizationId,
  });
  
  return result;
}

// Google Maps
async function geocodeAddress(address: string) {
  const result = await mapsClient.geocode({ address });
  
  // Track cost ($0.005 per geocode request)
  await costs.track({
    service: 'maps',
    amount: 0.005,
    organizationId: contextOrganizationId,
  });
  
  return result;
}
```

---

## Phase 8A.2: Budget Alerts

### Task 8A.2.1: Create Alert Configuration

**File to create:** `apps/web/lib/costs/alerts.ts`

**For AI:**

```typescript
interface BudgetConfig {
  service: string;
  daily: number;
  monthly: number;
  alertThresholds: number[]; // e.g., [0.5, 0.8, 1.0]
}

const BUDGETS: BudgetConfig[] = [
  { service: 'openai', daily: 50, monthly: 500, alertThresholds: [0.5, 0.8, 1.0] },
  { service: 'twilio', daily: 20, monthly: 200, alertThresholds: [0.8, 1.0] },
  { service: 'supabase', daily: 10, monthly: 100, alertThresholds: [0.9, 1.0] },
  { service: 'vercel', daily: 5, monthly: 50, alertThresholds: [0.9, 1.0] },
  { service: 'maps', daily: 30, monthly: 300, alertThresholds: [0.8, 1.0] },
  { service: 'total', daily: 200, monthly: 2000, alertThresholds: [0.5, 0.8, 0.9, 1.0] },
];

// Cron: Every hour
export async function checkBudgetAlerts() {
  for (const budget of BUDGETS) {
    const costs = await getCostsForService(budget.service);
    
    for (const threshold of budget.alertThresholds) {
      const dailyPercent = costs.daily / budget.daily;
      const monthlyPercent = costs.monthly / budget.monthly;
      
      if (dailyPercent >= threshold) {
        await sendBudgetAlert({
          service: budget.service,
          period: 'daily',
          percent: dailyPercent * 100,
          threshold: threshold * 100,
          current: costs.daily,
          budget: budget.daily,
        });
      }
      
      if (monthlyPercent >= threshold) {
        await sendBudgetAlert({
          service: budget.service,
          period: 'monthly',
          percent: monthlyPercent * 100,
          threshold: threshold * 100,
          current: costs.monthly,
          budget: budget.monthly,
        });
      }
    }
  }
}

async function sendBudgetAlert(alert: BudgetAlert) {
  // Deduplicate alerts (only send each threshold once per day)
  const alertKey = `alert:${alert.service}:${alert.period}:${alert.threshold}:${new Date().toISOString().slice(0, 10)}`;
  const alreadySent = await redis.get(alertKey);
  if (alreadySent) return;
  
  // Send alert
  await alertOps(
    `💰 ${alert.service} ${alert.period} budget at ${alert.percent.toFixed(0)}% ` +
    `($${alert.current.toFixed(2)} / $${alert.budget})`,
    alert.percent >= 100 ? 'urgent' : 'warning'
  );
  
  // Mark as sent
  await redis.set(alertKey, 'sent', 'EX', 86400);
}
```

---

## Phase 8A COMPLETE CHECKLIST

- ⬜ Cost dashboard created
- ⬜ Cost aggregator implemented
- ⬜ OpenAI costs tracked
- ⬜ Twilio costs tracked
- ⬜ Google Maps costs tracked
- ⬜ Budget alerts configured
- ⬜ Alert deduplication working
- ⬜ Daily cost report cron

**Phase 8A Sign-Off Date:** ___________

---

# PHASE 9 ADDITIONS: Enhanced Load Testing

**Plain Language:** Your existing Phase 9 load testing needs additional scenarios to properly test the new infrastructure.

---

## Additional Task 9.1.3: Test External API Degradation

**For AI:** Add k6 scenarios that simulate external API failures:

```javascript
// k6 script for degradation testing

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    // Normal load
    normal: {
      executor: 'constant-vus',
      vus: 100,
      duration: '5m',
    },
    // AFIP unavailable simulation
    afip_degraded: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      startTime: '2m',
      env: { SIMULATE_AFIP_DOWN: 'true' },
    },
    // OpenAI budget exceeded
    ai_limited: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      startTime: '3m',
      env: { SIMULATE_AI_BUDGET_EXCEEDED: 'true' },
    },
  },
};

export default function () {
  // Test that system degrades gracefully
  const healthRes = http.get('https://app.campotech.com/api/health');
  
  check(healthRes, {
    'health endpoint responds': (r) => r.status === 200 || r.status === 503,
    'response time under 1s': (r) => r.timings.duration < 1000,
  });
  
  // Test invoice creation during AFIP degradation
  if (__ENV.SIMULATE_AFIP_DOWN === 'true') {
    const invoiceRes = http.post(
      'https://app.campotech.com/api/v1/invoices',
      JSON.stringify({ /* test data */ }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    check(invoiceRes, {
      'invoice queued or created': (r) => r.status === 200 || r.status === 202,
    });
  }
  
  sleep(1);
}
```

---

## Additional Task 9.1.4: Test Database Partition Performance

**For AI:**

```javascript
// k6 script for partition testing

export default function () {
  // Query that should use partition pruning
  const recentJobsRes = http.get(
    'https://app.campotech.com/api/v1/jobs?since=2025-01-01',
    { headers: { Authorization: `Bearer ${__ENV.TOKEN}` } }
  );
  
  check(recentJobsRes, {
    'recent jobs under 200ms': (r) => r.timings.duration < 200,
  });
  
  // Query that spans partitions (should be slower but still acceptable)
  const allJobsRes = http.get(
    'https://app.campotech.com/api/v1/jobs?since=2023-01-01',
    { headers: { Authorization: `Bearer ${__ENV.TOKEN}` } }
  );
  
  check(allJobsRes, {
    'historical jobs under 2s': (r) => r.timings.duration < 2000,
  });
}
```

---

## Additional Task 9.1.5: Test Queue System Under Load

**For AI:**

```javascript
// k6 script for queue stress testing

export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Warm up
    { duration: '5m', target: 1000 },  // Ramp to high load
    { duration: '5m', target: 1000 },  // Sustain
    { duration: '2m', target: 0 },     // Cool down
  ],
};

export default function () {
  // Simulate completing a job (triggers invoice queue)
  const completeRes = http.post(
    'https://app.campotech.com/api/v1/jobs/test-job/complete',
    JSON.stringify({ /* completion data */ }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(completeRes, {
    'completion accepted': (r) => r.status === 200 || r.status === 202,
    'response under 500ms': (r) => r.timings.duration < 500,
  });
  
  // Check queue metrics
  const metricsRes = http.get(
    'https://app.campotech.com/api/admin/queue-metrics',
    { headers: { Authorization: `Bearer ${__ENV.ADMIN_TOKEN}` } }
  );
  
  const metrics = JSON.parse(metricsRes.body);
  
  check(null, {
    'no critical queues': () => {
      return Object.values(metrics.queues).every(q => q.status !== 'critical');
    },
  });
  
  sleep(0.5);
}
```

---

# FINAL SCALE-READINESS CHECKLIST

Before considering the system ready for 100k businesses, verify:

## Database Layer
- ⬜ Jobs table partitioned by month
- ⬜ WhatsApp messages partitioned by week
- ⬜ Technician locations partitioned by day
- ⬜ Partition manager cron running
- ⬜ Data archival running
- ⬜ Read replica configured for analytics
- ⬜ Connection pooling optimized

## Queue System
- ⬜ Three-tier queue structure (realtime, background, batch)
- ⬜ All jobs instrumented with metrics
- ⬜ DLQ configured and monitored
- ⬜ Queue dashboard accessible
- ⬜ Little's Law calculator working (data accumulating)

## External API Resilience
- ⬜ AFIP rate limiting implemented
- ⬜ AFIP circuit breaker configured
- ⬜ AFIP batch processor running
- ⬜ OpenAI budget controls active
- ⬜ AI fallback to human working
- ⬜ MercadoPago circuit breaker configured
- ⬜ WhatsApp rate limiter active

## Graceful Degradation
- ⬜ Degradation manager active
- ⬜ All circuit breakers connected
- ⬜ Health endpoint returning status
- ⬜ Client-side degradation banner working
- ⬜ Database fallbacks configured
- ⬜ Real-time to polling fallback working

## Cost Controls
- ⬜ Cost tracking for all paid services
- ⬜ Budget alerts configured
- ⬜ Cost dashboard in admin

## Load Testing
- ⬜ 100k concurrent user test passed
- ⬜ Degradation scenarios tested
- ⬜ Partition performance verified
- ⬜ Queue performance under load verified

---

**READY FOR 100K SCALE:** ⬜ Yes / ⬜ No

**Sign-Off Date:** ___________

**Signed By:** ___________

---

*Document Version: 1.0*
*Supplement to CAMPOTECH-IMPLEMENTATION-ROADMAP-DETAILED.md*
