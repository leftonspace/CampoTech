#!/usr/bin/env ts-node

/**
 * Queue CLI Tool
 * ==============
 *
 * Command-line interface for queue operations and monitoring.
 *
 * Usage:
 *   npm run queue:status              # Show all queue stats
 *   npm run queue:status -- --queue=payment-webhook
 *   npm run queue:pause -- --queue=payment-webhook
 *   npm run queue:resume -- --queue=payment-webhook
 *   npm run queue:drain -- --queue=payment-webhook --confirm
 *   npm run queue:clean -- --queue=payment-webhook --status=completed --age=24h
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';

// =============================================================================
// CONFIGURATION
// =============================================================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const ALL_QUEUES = [
  'payment-webhook',
  'job-notification',
  'invoice-pdf',
  'voice-processing',
  'reminder',
  'cae-queue',
  'whatsapp-queue',
  'payment-queue',
  'notification-queue',
  'scheduled-queue',
  'dead-letter-queue',
];

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

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function parseAge(age: string): number {
  const match = age.match(/^(\d+)([smhd])$/);
  if (!match) return 24 * 60 * 60 * 1000; // Default 24h

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

// =============================================================================
// COMMANDS
// =============================================================================

async function getQueueInstance(queueName: string): Promise<Queue> {
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  return new Queue(queueName, { connection });
}

async function showStatus(queueName?: string): Promise<void> {
  const queuesToCheck = queueName ? [queueName] : ALL_QUEUES;

  console.log('\n=== Queue Status ===\n');
  console.log(
    'Queue'.padEnd(25) +
    'Waiting'.padStart(10) +
    'Active'.padStart(10) +
    'Completed'.padStart(12) +
    'Failed'.padStart(10) +
    'Delayed'.padStart(10) +
    'Paused'.padStart(8)
  );
  console.log('-'.repeat(85));

  let totalWaiting = 0;
  let totalActive = 0;
  let totalCompleted = 0;
  let totalFailed = 0;
  let totalDelayed = 0;

  for (const name of queuesToCheck) {
    try {
      const queue = await getQueueInstance(name);

      const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);

      totalWaiting += waiting;
      totalActive += active;
      totalCompleted += completed;
      totalFailed += failed;
      totalDelayed += delayed;

      const pausedStr = isPaused ? '⏸️' : '▶️';
      const failedStr = failed > 0 ? `\x1b[31m${formatNumber(failed)}\x1b[0m` : formatNumber(failed);

      console.log(
        name.padEnd(25) +
        formatNumber(waiting).padStart(10) +
        formatNumber(active).padStart(10) +
        formatNumber(completed).padStart(12) +
        failedStr.padStart(failed > 0 ? 19 : 10) +
        formatNumber(delayed).padStart(10) +
        pausedStr.padStart(8)
      );

      await queue.close();
    } catch (error) {
      console.log(`${name.padEnd(25)} Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  console.log('-'.repeat(85));
  console.log(
    'TOTAL'.padEnd(25) +
    formatNumber(totalWaiting).padStart(10) +
    formatNumber(totalActive).padStart(10) +
    formatNumber(totalCompleted).padStart(12) +
    formatNumber(totalFailed).padStart(10) +
    formatNumber(totalDelayed).padStart(10)
  );
  console.log('');
}

async function pauseQueue(queueName: string): Promise<void> {
  const queue = await getQueueInstance(queueName);

  try {
    await queue.pause();
    console.log(`✅ Queue '${queueName}' paused`);
  } finally {
    await queue.close();
  }
}

async function resumeQueue(queueName: string): Promise<void> {
  const queue = await getQueueInstance(queueName);

  try {
    await queue.resume();
    console.log(`✅ Queue '${queueName}' resumed`);
  } finally {
    await queue.close();
  }
}

async function drainQueue(queueName: string): Promise<void> {
  const queue = await getQueueInstance(queueName);

  try {
    const [waiting, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getDelayedCount(),
    ]);

    console.log(`Draining queue '${queueName}'...`);
    console.log(`  - Waiting jobs: ${waiting}`);
    console.log(`  - Delayed jobs: ${delayed}`);

    await queue.drain();
    console.log(`✅ Queue '${queueName}' drained`);
  } finally {
    await queue.close();
  }
}

async function cleanQueue(queueName: string, status: string, ageMs: number): Promise<void> {
  const queue = await getQueueInstance(queueName);

  try {
    const validStatuses = ['completed', 'failed', 'delayed', 'wait', 'active'];
    if (!validStatuses.includes(status)) {
      console.error(`Invalid status '${status}'. Valid: ${validStatuses.join(', ')}`);
      process.exit(1);
    }

    console.log(`Cleaning '${status}' jobs older than ${formatDuration(ageMs)} from '${queueName}'...`);

    const cleaned = await queue.clean(ageMs, 1000, status as any);
    console.log(`✅ Cleaned ${cleaned.length} jobs`);
  } finally {
    await queue.close();
  }
}

async function showJobDetails(queueName: string, jobId: string): Promise<void> {
  const queue = await getQueueInstance(queueName);

  try {
    const job = await queue.getJob(jobId);

    if (!job) {
      console.log(`Job '${jobId}' not found in queue '${queueName}'`);
      return;
    }

    console.log('\n=== Job Details ===\n');
    console.log(`ID: ${job.id}`);
    console.log(`Name: ${job.name}`);
    console.log(`Queue: ${queueName}`);
    console.log(`Timestamp: ${new Date(job.timestamp).toISOString()}`);
    console.log(`Attempts Made: ${job.attemptsMade}`);
    console.log(`Max Attempts: ${job.opts.attempts || 'N/A'}`);

    const state = await job.getState();
    console.log(`State: ${state}`);

    if (job.processedOn) {
      console.log(`Processed On: ${new Date(job.processedOn).toISOString()}`);
    }
    if (job.finishedOn) {
      console.log(`Finished On: ${new Date(job.finishedOn).toISOString()}`);
    }
    if (job.failedReason) {
      console.log(`Failed Reason: ${job.failedReason}`);
    }

    console.log('\nData:');
    console.log(JSON.stringify(job.data, null, 2));

    if (job.returnvalue) {
      console.log('\nReturn Value:');
      console.log(JSON.stringify(job.returnvalue, null, 2));
    }

    if (job.stacktrace?.length) {
      console.log('\nStacktrace:');
      job.stacktrace.forEach((line, i) => console.log(`  ${i + 1}. ${line}`));
    }
  } finally {
    await queue.close();
  }
}

async function retryJob(queueName: string, jobId: string): Promise<void> {
  const queue = await getQueueInstance(queueName);

  try {
    const job = await queue.getJob(jobId);

    if (!job) {
      console.log(`Job '${jobId}' not found in queue '${queueName}'`);
      return;
    }

    await job.retry();
    console.log(`✅ Job '${jobId}' queued for retry`);
  } finally {
    await queue.close();
  }
}

async function listFailedJobs(queueName: string, limit: number = 10): Promise<void> {
  const queue = await getQueueInstance(queueName);

  try {
    const failed = await queue.getFailed(0, limit);

    if (failed.length === 0) {
      console.log(`No failed jobs in queue '${queueName}'`);
      return;
    }

    console.log(`\n=== Failed Jobs in '${queueName}' ===\n`);
    console.log(
      'ID'.padEnd(25) +
      'Name'.padEnd(20) +
      'Failed At'.padEnd(22) +
      'Attempts'.padStart(10) +
      'Error'
    );
    console.log('-'.repeat(100));

    for (const job of failed) {
      const failedAt = job.finishedOn
        ? new Date(job.finishedOn).toISOString().replace('T', ' ').slice(0, 19)
        : 'Unknown';

      console.log(
        (job.id?.slice(0, 23) || 'N/A').padEnd(25) +
        (job.name?.slice(0, 18) || 'N/A').padEnd(20) +
        failedAt.padEnd(22) +
        String(job.attemptsMade).padStart(10) +
        (job.failedReason?.slice(0, 50) || 'Unknown')
      );
    }

    console.log('');
  } finally {
    await queue.close();
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
      case 'status':
        await showStatus(args.queue as string | undefined);
        break;

      case 'pause':
        if (!args.queue) {
          console.error('Error: --queue is required');
          process.exit(1);
        }
        await pauseQueue(args.queue as string);
        break;

      case 'resume':
        if (!args.queue) {
          console.error('Error: --queue is required');
          process.exit(1);
        }
        await resumeQueue(args.queue as string);
        break;

      case 'drain':
        if (!args.queue) {
          console.error('Error: --queue is required');
          process.exit(1);
        }
        if (!args.confirm) {
          console.error('Error: --confirm is required to drain a queue');
          process.exit(1);
        }
        await drainQueue(args.queue as string);
        break;

      case 'clean':
        if (!args.queue) {
          console.error('Error: --queue is required');
          process.exit(1);
        }
        await cleanQueue(
          args.queue as string,
          (args.status as string) || 'completed',
          parseAge((args.age as string) || '24h')
        );
        break;

      case 'job':
        if (!args.queue || !args.id) {
          console.error('Error: --queue and --id are required');
          process.exit(1);
        }
        await showJobDetails(args.queue as string, args.id as string);
        break;

      case 'retry':
        if (!args.queue || !args.id) {
          console.error('Error: --queue and --id are required');
          process.exit(1);
        }
        await retryJob(args.queue as string, args.id as string);
        break;

      case 'failed':
        if (!args.queue) {
          console.error('Error: --queue is required');
          process.exit(1);
        }
        await listFailedJobs(args.queue as string, parseInt(args.limit as string, 10) || 10);
        break;

      default:
        console.log(`
Queue CLI Tool
==============

Commands:
  status              Show status of all queues (or --queue=<name>)
  pause               Pause a queue (--queue=<name>)
  resume              Resume a queue (--queue=<name>)
  drain               Remove all jobs from a queue (--queue=<name> --confirm)
  clean               Clean old jobs (--queue=<name> --status=<status> --age=<age>)
  job                 Show job details (--queue=<name> --id=<jobId>)
  retry               Retry a failed job (--queue=<name> --id=<jobId>)
  failed              List failed jobs (--queue=<name> --limit=<n>)

Examples:
  npm run queue:status
  npm run queue:status -- --queue=payment-webhook
  npm run queue:pause -- --queue=payment-webhook
  npm run queue:resume -- --queue=payment-webhook
  npm run queue:drain -- --queue=payment-webhook --confirm
  npm run queue:clean -- --queue=payment-webhook --status=completed --age=24h
  npm run queue:job -- --queue=payment-webhook --id=abc123
  npm run queue:retry -- --queue=payment-webhook --id=abc123
  npm run queue:failed -- --queue=payment-webhook --limit=20
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
