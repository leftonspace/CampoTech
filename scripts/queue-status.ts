#!/usr/bin/env ts-node
/**
 * Queue Status CLI
 * ================
 *
 * Shows current queue status and fair scheduler metrics.
 *
 * USAGE:
 *   npm run queue:status              # Show queue status
 *   npm run queue:status -- --metrics # Show detailed metrics
 *   npm run queue:status -- --queue=cae-queue  # Show specific queue
 */

import { getFairScheduler, type OrgQueueStats } from '../core/queue/fair-scheduler';

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const QUEUES = [
  { name: 'cae-queue', description: 'AFIP invoice processing' },
  { name: 'whatsapp-queue', description: 'WhatsApp message delivery' },
  { name: 'payment-queue', description: 'Payment reconciliation' },
  { name: 'notification-queue', description: 'Push notifications' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CLI IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

async function showStatus(specificQueue?: string): Promise<void> {
  const scheduler = getFairScheduler();
  const metrics = scheduler.getMetrics();

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              QUEUE STATUS                                       ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');

  const queuesToShow = specificQueue
    ? QUEUES.filter(q => q.name === specificQueue)
    : QUEUES;

  if (queuesToShow.length === 0) {
    console.log(`║ Queue not found: ${specificQueue?.padEnd(45)} ║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');
    return;
  }

  for (const queue of queuesToShow) {
    // In production, these would come from BullMQ
    const waiting = 0; // Simulated
    const active = metrics.totalActiveJobs;
    const failed = 0; // Simulated

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (waiting > 5000) status = 'unhealthy';
    else if (waiting > 1000) status = 'degraded';

    const statusIcon = {
      healthy: '✅',
      degraded: '⚠️ ',
      unhealthy: '❌',
    }[status];

    console.log(`║                                                                ║`);
    console.log(`║ ${statusIcon} ${queue.name.padEnd(20)} ${queue.description.padEnd(35)} ║`);
    console.log('║ ────────────────────────────────────────────────────────────── ║');
    console.log(`║   Waiting: ${waiting.toString().padEnd(10)} Active: ${active.toString().padEnd(10)} Failed: ${failed.toString().padEnd(5)} ║`);
  }

  console.log('║                                                                ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║ Total Active Jobs: ${metrics.totalActiveJobs.toString().padEnd(44)} ║`);
  console.log(`║ Active Organizations: ${metrics.totalOrgsActive.toString().padEnd(41)} ║`);
  console.log(`║ Avg Wait Time: ${metrics.overallAverageWaitTimeMs.toFixed(0).padEnd(6)} ms${' '.repeat(39)} ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\n');
}

async function showMetrics(): Promise<void> {
  const scheduler = getFairScheduler();
  const metrics = scheduler.getMetrics();

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              QUEUE METRICS                                      ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');

  console.log('║ Overall Metrics                                                ║');
  console.log('║ ────────────────────────────────────────────────────────────── ║');
  console.log(`║   Total Active Jobs: ${metrics.totalActiveJobs.toString().padEnd(42)} ║`);
  console.log(`║   Active Organizations: ${metrics.totalOrgsActive.toString().padEnd(39)} ║`);
  console.log(`║   Average Wait Time: ${metrics.overallAverageWaitTimeMs.toFixed(2).padEnd(10)} ms${' '.repeat(29)} ║`);

  if (metrics.orgStats.size > 0) {
    console.log('║                                                                ║');
    console.log('║ Per-Organization Stats                                         ║');
    console.log('║ ────────────────────────────────────────────────────────────── ║');
    console.log('║ Org ID          | Active | Completed | Failed | Avg Wait (ms)  ║');
    console.log('║ ────────────────────────────────────────────────────────────── ║');

    for (const [orgId, stats] of metrics.orgStats) {
      const shortOrgId = orgId.substring(0, 12) + '...';
      console.log(
        `║ ${shortOrgId.padEnd(15)} | ${stats.activeJobs.toString().padEnd(6)} | ${stats.completedJobs.toString().padEnd(9)} | ${stats.failedJobs.toString().padEnd(6)} | ${stats.averageWaitTimeMs.toFixed(0).padEnd(14)} ║`
      );
    }
  } else {
    console.log('║                                                                ║');
    console.log('║   No organization stats available yet.                         ║');
  }

  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\n');
}

function showHelp(): void {
  console.log(`
Queue Status CLI
================

Usage:
  npm run queue:status                    Show all queue status
  npm run queue:status -- --metrics       Show detailed metrics
  npm run queue:status -- --queue=NAME    Show specific queue

Options:
  --metrics, -m     Show detailed per-org metrics
  --queue=NAME      Filter to specific queue
  --help, -h        Show this help

Queues:
  cae-queue         AFIP invoice processing
  whatsapp-queue    WhatsApp message delivery
  payment-queue     Payment reconciliation
  notification-queue  Push notifications
`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const showMetricsFlag = args.includes('--metrics') || args.includes('-m');
  const queueArg = args.find(a => a.startsWith('--queue='));
  const specificQueue = queueArg?.split('=')[1];

  try {
    if (showMetricsFlag) {
      await showMetrics();
    } else {
      await showStatus(specificQueue);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(console.error);
