/**
 * Queue Metrics Exporter
 * ======================
 *
 * Prometheus-compatible metrics for queue monitoring.
 * Exposes metrics for all BullMQ queues.
 */

import { Queue } from 'bullmq';
import { getRedis } from '../redis/redis-manager';

// =============================================================================
// TYPES
// =============================================================================

export interface QueueMetric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  labels?: string[];
}

export interface MetricsSnapshot {
  timestamp: Date;
  queues: Map<string, QueueStats>;
  totals: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  latestJobAge?: number;
  oldestJobAge?: number;
}

// =============================================================================
// METRIC DEFINITIONS
// =============================================================================

const METRIC_DEFINITIONS: QueueMetric[] = [
  {
    name: 'queue_jobs_waiting',
    help: 'Number of jobs waiting to be processed',
    type: 'gauge',
    labels: ['queue'],
  },
  {
    name: 'queue_jobs_active',
    help: 'Number of jobs currently being processed',
    type: 'gauge',
    labels: ['queue'],
  },
  {
    name: 'queue_jobs_completed_total',
    help: 'Total number of completed jobs',
    type: 'counter',
    labels: ['queue'],
  },
  {
    name: 'queue_jobs_failed_total',
    help: 'Total number of failed jobs',
    type: 'counter',
    labels: ['queue'],
  },
  {
    name: 'queue_jobs_delayed',
    help: 'Number of delayed jobs',
    type: 'gauge',
    labels: ['queue'],
  },
  {
    name: 'queue_paused',
    help: 'Whether the queue is paused (1) or running (0)',
    type: 'gauge',
    labels: ['queue'],
  },
  {
    name: 'queue_oldest_job_age_seconds',
    help: 'Age of the oldest waiting job in seconds',
    type: 'gauge',
    labels: ['queue'],
  },
  {
    name: 'queue_processing_time_seconds',
    help: 'Job processing time in seconds',
    type: 'histogram',
    labels: ['queue', 'job_name'],
  },
  {
    name: 'queue_wait_time_seconds',
    help: 'Job wait time before processing in seconds',
    type: 'histogram',
    labels: ['queue', 'job_name'],
  },
];

// =============================================================================
// QUEUE LIST
// =============================================================================

const ALL_QUEUES = [
  'payment-webhook',
  'job-notification',
  'invoice-pdf',
  'notification-dispatch',
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
// METRICS EXPORTER
// =============================================================================

export class QueueMetricsExporter {
  private queues: Map<string, Queue> = new Map();
  private lastSnapshot?: MetricsSnapshot;
  private collectionInterval?: NodeJS.Timeout;
  private listeners: Array<(metrics: MetricsSnapshot) => void> = [];

  // Histogram buckets for timing metrics (in seconds)
  private readonly HISTOGRAM_BUCKETS = [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300];

  // Track completed/failed counts for counter metrics
  private completedCounts: Map<string, number> = new Map();
  private failedCounts: Map<string, number> = new Map();

  constructor(queueNames: string[] = ALL_QUEUES) {
    const connection = getRedis();

    for (const name of queueNames) {
      this.queues.set(name, new Queue(name, { connection }));
    }
  }

  /**
   * Start automatic metrics collection
   */
  startCollection(intervalMs: number = 15000): void {
    if (this.collectionInterval) {
      return;
    }

    // Collect immediately
    this.collect();

    // Then collect periodically
    this.collectionInterval = setInterval(() => {
      this.collect();
    }, intervalMs);

    console.log(`[Metrics] Started collection every ${intervalMs}ms`);
  }

  /**
   * Stop automatic metrics collection
   */
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
    }
  }

  /**
   * Collect metrics from all queues
   */
  async collect(): Promise<MetricsSnapshot> {
    const queues = new Map<string, QueueStats>();
    const totals = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };

    for (const [name, queue] of this.queues) {
      try {
        const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
          queue.isPaused(),
        ]);

        // Calculate oldest job age
        let oldestJobAge: number | undefined;
        const waitingJobs = await queue.getWaiting(0, 0);
        if (waitingJobs.length > 0) {
          oldestJobAge = (Date.now() - waitingJobs[0].timestamp) / 1000;
        }

        const stats: QueueStats = {
          waiting,
          active,
          completed,
          failed,
          delayed,
          paused: isPaused,
          oldestJobAge,
        };

        queues.set(name, stats);

        // Update totals
        totals.waiting += waiting;
        totals.active += active;
        totals.completed += completed;
        totals.failed += failed;
        totals.delayed += delayed;

        // Track counter deltas
        const prevCompleted = this.completedCounts.get(name) || 0;
        const prevFailed = this.failedCounts.get(name) || 0;
        this.completedCounts.set(name, completed);
        this.failedCounts.set(name, failed);
      } catch (error) {
        console.error(`[Metrics] Failed to collect from ${name}:`, error);
      }
    }

    const snapshot: MetricsSnapshot = {
      timestamp: new Date(),
      queues,
      totals,
    };

    this.lastSnapshot = snapshot;

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[Metrics] Listener error:', error);
      }
    }

    return snapshot;
  }

  /**
   * Get the latest metrics snapshot
   */
  getSnapshot(): MetricsSnapshot | undefined {
    return this.lastSnapshot;
  }

  /**
   * Subscribe to metrics updates
   */
  onMetrics(listener: (metrics: MetricsSnapshot) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Export metrics in Prometheus text format
   */
  async exportPrometheus(): Promise<string> {
    const snapshot = await this.collect();
    const lines: string[] = [];

    // Add metric definitions and values
    for (const def of METRIC_DEFINITIONS) {
      lines.push(`# HELP ${def.name} ${def.help}`);
      lines.push(`# TYPE ${def.name} ${def.type}`);

      if (def.name === 'queue_jobs_waiting') {
        for (const [queueName, stats] of snapshot.queues) {
          lines.push(`${def.name}{queue="${queueName}"} ${stats.waiting}`);
        }
      } else if (def.name === 'queue_jobs_active') {
        for (const [queueName, stats] of snapshot.queues) {
          lines.push(`${def.name}{queue="${queueName}"} ${stats.active}`);
        }
      } else if (def.name === 'queue_jobs_completed_total') {
        for (const [queueName, stats] of snapshot.queues) {
          lines.push(`${def.name}{queue="${queueName}"} ${stats.completed}`);
        }
      } else if (def.name === 'queue_jobs_failed_total') {
        for (const [queueName, stats] of snapshot.queues) {
          lines.push(`${def.name}{queue="${queueName}"} ${stats.failed}`);
        }
      } else if (def.name === 'queue_jobs_delayed') {
        for (const [queueName, stats] of snapshot.queues) {
          lines.push(`${def.name}{queue="${queueName}"} ${stats.delayed}`);
        }
      } else if (def.name === 'queue_paused') {
        for (const [queueName, stats] of snapshot.queues) {
          lines.push(`${def.name}{queue="${queueName}"} ${stats.paused ? 1 : 0}`);
        }
      } else if (def.name === 'queue_oldest_job_age_seconds') {
        for (const [queueName, stats] of snapshot.queues) {
          if (stats.oldestJobAge !== undefined) {
            lines.push(`${def.name}{queue="${queueName}"} ${stats.oldestJobAge.toFixed(2)}`);
          }
        }
      }

      lines.push('');
    }

    // Add totals
    lines.push('# HELP queue_total_waiting Total jobs waiting across all queues');
    lines.push('# TYPE queue_total_waiting gauge');
    lines.push(`queue_total_waiting ${snapshot.totals.waiting}`);
    lines.push('');

    lines.push('# HELP queue_total_active Total active jobs across all queues');
    lines.push('# TYPE queue_total_active gauge');
    lines.push(`queue_total_active ${snapshot.totals.active}`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Export metrics as JSON (for dashboards)
   */
  async exportJSON(): Promise<object> {
    const snapshot = await this.collect();

    return {
      timestamp: snapshot.timestamp.toISOString(),
      queues: Object.fromEntries(snapshot.queues),
      totals: snapshot.totals,
    };
  }

  /**
   * Get alert conditions
   */
  getAlerts(thresholds: {
    maxWaiting?: number;
    maxFailed?: number;
    maxOldestJobAge?: number;
  } = {}): Array<{
    queue: string;
    type: 'waiting_high' | 'failed_high' | 'job_stuck';
    value: number;
    threshold: number;
  }> {
    if (!this.lastSnapshot) return [];

    const alerts: Array<{
      queue: string;
      type: 'waiting_high' | 'failed_high' | 'job_stuck';
      value: number;
      threshold: number;
    }> = [];

    const {
      maxWaiting = 1000,
      maxFailed = 100,
      maxOldestJobAge = 3600, // 1 hour
    } = thresholds;

    for (const [name, stats] of this.lastSnapshot.queues) {
      if (stats.waiting > maxWaiting) {
        alerts.push({
          queue: name,
          type: 'waiting_high',
          value: stats.waiting,
          threshold: maxWaiting,
        });
      }

      if (stats.failed > maxFailed) {
        alerts.push({
          queue: name,
          type: 'failed_high',
          value: stats.failed,
          threshold: maxFailed,
        });
      }

      if (stats.oldestJobAge && stats.oldestJobAge > maxOldestJobAge) {
        alerts.push({
          queue: name,
          type: 'job_stuck',
          value: stats.oldestJobAge,
          threshold: maxOldestJobAge,
        });
      }
    }

    return alerts;
  }

  /**
   * Shutdown the metrics exporter
   */
  async shutdown(): Promise<void> {
    this.stopCollection();

    for (const queue of this.queues.values()) {
      await queue.close();
    }

    this.queues.clear();
    this.listeners = [];
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let metricsExporter: QueueMetricsExporter | null = null;

/**
 * Get the global metrics exporter instance
 */
export function getMetricsExporter(): QueueMetricsExporter {
  if (!metricsExporter) {
    metricsExporter = new QueueMetricsExporter();
  }
  return metricsExporter;
}

/**
 * Initialize and start the metrics exporter
 */
export function initializeMetrics(
  intervalMs: number = 15000,
  queueNames?: string[]
): QueueMetricsExporter {
  if (metricsExporter) {
    metricsExporter.stopCollection();
  }

  metricsExporter = new QueueMetricsExporter(queueNames);
  metricsExporter.startCollection(intervalMs);

  return metricsExporter;
}

/**
 * Shutdown the metrics exporter
 */
export async function shutdownMetrics(): Promise<void> {
  if (metricsExporter) {
    await metricsExporter.shutdown();
    metricsExporter = null;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  METRIC_DEFINITIONS,
  ALL_QUEUES,
};
