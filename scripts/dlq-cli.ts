#!/usr/bin/env ts-node

/**
 * Dead Letter Queue CLI Tool
 * ==========================
 *
 * Command-line interface for managing the dead letter queue.
 *
 * Usage:
 *   npm run dlq:list                  # List all DLQ entries
 *   npm run dlq:list -- --queue=payment-webhook
 *   npm run dlq:retry -- --id=<jobId>
 *   npm run dlq:discard -- --id=<jobId> --reason="Duplicate"
 *   npm run dlq:export -- --format=csv
 */

import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import * as fs from 'fs';

// =============================================================================
// CONFIGURATION
// =============================================================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DLQ_NAME = 'dead-letter-queue';

// Source queues for retry operations
const SOURCE_QUEUES: Record<string, string> = {
  'payment-webhook': 'payment-webhook',
  'job-notification': 'job-notification',
  'invoice-pdf': 'invoice-pdf',
  'voice-processing': 'voice-processing',
  'reminder': 'reminder',
  'cae-queue': 'cae-queue',
  'whatsapp-queue': 'whatsapp-queue',
};

interface DLQEntry {
  id: string;
  sourceQueue: string;
  originalJobId: string;
  jobName: string;
  data: any;
  failedReason: string;
  stacktrace?: string[];
  attemptsMade: number;
  movedAt: Date;
}

// =============================================================================
// HELPERS
// =============================================================================

function parseArgs(): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);

  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value ?? true;
    }
  }

  return args;
}

async function getRedisClient(): Promise<Redis> {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: null });
}

async function getDLQInstance(): Promise<Queue> {
  const connection = await getRedisClient();
  return new Queue(DLQ_NAME, { connection });
}

async function getSourceQueueInstance(queueName: string): Promise<Queue> {
  const connection = await getRedisClient();
  return new Queue(queueName, { connection });
}

function parseDLQJob(job: Job): DLQEntry | null {
  try {
    const payload = job.data.payload || job.data;
    return {
      id: job.id || 'unknown',
      sourceQueue: payload.sourceQueue || job.data.sourceQueue || 'unknown',
      originalJobId: payload.originalJob?.id || 'unknown',
      jobName: payload.originalJob?.name || job.name || 'unknown',
      data: payload.originalJob?.data || job.data,
      failedReason: payload.originalJob?.failedReason || 'Unknown error',
      stacktrace: payload.originalJob?.stacktrace,
      attemptsMade: payload.originalJob?.attemptsMade || 0,
      movedAt: new Date(payload.movedAt || job.timestamp),
    };
  } catch {
    return null;
  }
}

// =============================================================================
// COMMANDS
// =============================================================================

async function listEntries(filterQueue?: string, limit: number = 50): Promise<void> {
  const dlq = await getDLQInstance();

  try {
    const jobs = await dlq.getJobs(['waiting', 'delayed', 'failed'], 0, limit);

    let entries = jobs
      .map(parseDLQJob)
      .filter((e): e is DLQEntry => e !== null);

    if (filterQueue) {
      entries = entries.filter((e) => e.sourceQueue === filterQueue);
    }

    if (entries.length === 0) {
      console.log('No entries in DLQ' + (filterQueue ? ` from '${filterQueue}'` : ''));
      return;
    }

    console.log(`\n=== Dead Letter Queue (${entries.length} entries) ===\n`);
    console.log(
      'ID'.padEnd(20) +
      'Source Queue'.padEnd(20) +
      'Job Name'.padEnd(20) +
      'Attempts'.padStart(10) +
      'Error'.padEnd(40)
    );
    console.log('-'.repeat(110));

    for (const entry of entries) {
      console.log(
        entry.id.slice(0, 18).padEnd(20) +
        entry.sourceQueue.slice(0, 18).padEnd(20) +
        entry.jobName.slice(0, 18).padEnd(20) +
        String(entry.attemptsMade).padStart(10) +
        entry.failedReason.slice(0, 38).padEnd(40)
      );
    }

    console.log('');

    // Show stats
    const byQueue: Record<string, number> = {};
    const byError: Record<string, number> = {};

    for (const entry of entries) {
      byQueue[entry.sourceQueue] = (byQueue[entry.sourceQueue] || 0) + 1;

      const errorType = classifyError(entry.failedReason);
      byError[errorType] = (byError[errorType] || 0) + 1;
    }

    console.log('By Source Queue:');
    for (const [queue, count] of Object.entries(byQueue)) {
      console.log(`  ${queue}: ${count}`);
    }

    console.log('\nBy Error Type:');
    for (const [type, count] of Object.entries(byError)) {
      console.log(`  ${type}: ${count}`);
    }

    console.log('');
  } finally {
    await dlq.close();
  }
}

function classifyError(errorMessage: string): string {
  const lower = errorMessage.toLowerCase();

  if (lower.includes('timeout')) return 'timeout';
  if (lower.includes('rate limit')) return 'rate_limit';
  if (lower.includes('connection') || lower.includes('network')) return 'network';
  if (lower.includes('auth') || lower.includes('unauthorized')) return 'auth';
  if (lower.includes('validation') || lower.includes('invalid')) return 'validation';
  if (lower.includes('not found') || lower.includes('404')) return 'not_found';
  if (lower.includes('500') || lower.includes('internal')) return 'server_error';

  return 'other';
}

async function retryEntry(jobId: string): Promise<void> {
  const dlq = await getDLQInstance();

  try {
    const job = await dlq.getJob(jobId);

    if (!job) {
      console.error(`DLQ entry '${jobId}' not found`);
      process.exit(1);
    }

    const entry = parseDLQJob(job);
    if (!entry) {
      console.error(`Could not parse DLQ entry '${jobId}'`);
      process.exit(1);
    }

    const sourceQueueName = SOURCE_QUEUES[entry.sourceQueue];
    if (!sourceQueueName) {
      console.error(`Unknown source queue: ${entry.sourceQueue}`);
      process.exit(1);
    }

    const sourceQueue = await getSourceQueueInstance(sourceQueueName);

    try {
      // Re-add job to source queue
      await sourceQueue.add(entry.jobName, entry.data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
      });

      // Remove from DLQ
      await job.remove();

      console.log(`✅ Job '${jobId}' retried to queue '${sourceQueueName}'`);
    } finally {
      await sourceQueue.close();
    }
  } finally {
    await dlq.close();
  }
}

async function discardEntry(jobId: string, reason: string): Promise<void> {
  const dlq = await getDLQInstance();

  try {
    const job = await dlq.getJob(jobId);

    if (!job) {
      console.error(`DLQ entry '${jobId}' not found`);
      process.exit(1);
    }

    // Log the discard action
    console.log(`Discarding job '${jobId}'...`);
    console.log(`  Reason: ${reason}`);
    console.log(`  Original error: ${job.data.payload?.originalJob?.failedReason || 'Unknown'}`);

    // Update job data with discard info
    await job.updateData({
      ...job.data,
      discarded: true,
      discardReason: reason,
      discardedAt: new Date().toISOString(),
      discardedBy: process.env.USER || 'cli',
    });

    // Remove from DLQ
    await job.remove();

    console.log(`✅ Job '${jobId}' discarded`);
  } finally {
    await dlq.close();
  }
}

async function bulkRetry(filterQueue?: string, errorPattern?: string): Promise<void> {
  const dlq = await getDLQInstance();

  try {
    const jobs = await dlq.getJobs(['waiting', 'delayed', 'failed']);

    let entries = jobs
      .map((job) => ({ job, entry: parseDLQJob(job) }))
      .filter((e): e is { job: Job; entry: DLQEntry } => e.entry !== null);

    if (filterQueue) {
      entries = entries.filter((e) => e.entry.sourceQueue === filterQueue);
    }

    if (errorPattern) {
      entries = entries.filter((e) =>
        e.entry.failedReason.toLowerCase().includes(errorPattern.toLowerCase())
      );
    }

    if (entries.length === 0) {
      console.log('No matching entries to retry');
      return;
    }

    console.log(`Found ${entries.length} entries to retry`);

    let retried = 0;
    let failed = 0;

    for (const { job, entry } of entries) {
      try {
        const sourceQueueName = SOURCE_QUEUES[entry.sourceQueue];
        if (!sourceQueueName) {
          failed++;
          continue;
        }

        const sourceQueue = await getSourceQueueInstance(sourceQueueName);

        try {
          await sourceQueue.add(entry.jobName, entry.data, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 10000 },
          });

          await job.remove();
          retried++;
        } finally {
          await sourceQueue.close();
        }
      } catch {
        failed++;
      }
    }

    console.log(`✅ Retried: ${retried}, Failed: ${failed}`);
  } finally {
    await dlq.close();
  }
}

async function exportEntries(format: 'json' | 'csv'): Promise<void> {
  const dlq = await getDLQInstance();

  try {
    const jobs = await dlq.getJobs(['waiting', 'delayed', 'failed']);

    const entries = jobs
      .map(parseDLQJob)
      .filter((e): e is DLQEntry => e !== null);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `dlq-export-${timestamp}.${format}`;

    if (format === 'json') {
      fs.writeFileSync(filename, JSON.stringify(entries, null, 2));
    } else {
      // CSV format
      const headers = ['id', 'sourceQueue', 'originalJobId', 'jobName', 'failedReason', 'attemptsMade', 'movedAt'];
      const rows = entries.map((e) => [
        e.id,
        e.sourceQueue,
        e.originalJobId,
        e.jobName,
        `"${e.failedReason.replace(/"/g, '""')}"`,
        e.attemptsMade,
        e.movedAt.toISOString(),
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      fs.writeFileSync(filename, csv);
    }

    console.log(`✅ Exported ${entries.length} entries to ${filename}`);
  } finally {
    await dlq.close();
  }
}

async function showStats(): Promise<void> {
  const dlq = await getDLQInstance();

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      dlq.getWaitingCount(),
      dlq.getActiveCount(),
      dlq.getCompletedCount(),
      dlq.getFailedCount(),
      dlq.getDelayedCount(),
    ]);

    const total = waiting + active + failed + delayed;

    console.log('\n=== DLQ Statistics ===\n');
    console.log(`Total entries: ${total}`);
    console.log(`  Waiting: ${waiting}`);
    console.log(`  Active: ${active}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Delayed: ${delayed}`);
    console.log(`  Completed: ${completed}`);
    console.log('');
  } finally {
    await dlq.close();
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  const args = parseArgs();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'list':
        await listEntries(
          args.queue as string | undefined,
          parseInt(args.limit as string, 10) || 50
        );
        break;

      case 'retry':
        if (!args.id) {
          console.error('Error: --id is required');
          process.exit(1);
        }
        await retryEntry(args.id as string);
        break;

      case 'discard':
        if (!args.id) {
          console.error('Error: --id is required');
          process.exit(1);
        }
        if (!args.reason) {
          console.error('Error: --reason is required');
          process.exit(1);
        }
        await discardEntry(args.id as string, args.reason as string);
        break;

      case 'bulk-retry':
        await bulkRetry(
          args.queue as string | undefined,
          args.error as string | undefined
        );
        break;

      case 'export':
        await exportEntries((args.format as 'json' | 'csv') || 'json');
        break;

      case 'stats':
        await showStats();
        break;

      default:
        console.log(`
DLQ CLI Tool
============

Commands:
  list                List DLQ entries (--queue=<name> --limit=<n>)
  retry               Retry a specific entry (--id=<jobId>)
  discard             Discard an entry (--id=<jobId> --reason="<reason>")
  bulk-retry          Retry multiple entries (--queue=<name> --error=<pattern>)
  export              Export entries (--format=json|csv)
  stats               Show DLQ statistics

Examples:
  npm run dlq:list
  npm run dlq:list -- --queue=payment-webhook --limit=100
  npm run dlq:retry -- --id=abc123
  npm run dlq:discard -- --id=abc123 --reason="Duplicate request"
  npm run dlq:bulk-retry -- --queue=payment-webhook
  npm run dlq:bulk-retry -- --error=timeout
  npm run dlq:export -- --format=csv
  npm run dlq:stats
        `);
    }
  } finally {
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
