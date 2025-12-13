/**
 * Queue Manager
 * =============
 *
 * BullMQ queue setup and management for CampoTech.
 * Handles job queues for AFIP, WhatsApp, payments, and notifications.
 */

import { Queue, Worker, Job, QueueEvents, JobsOptions, WorkerOptions } from 'bullmq';
import { Redis } from 'ioredis';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface QueueConfig {
  /** Redis connection URL */
  redisUrl: string;
  /** Default job options */
  defaultJobOptions?: JobsOptions;
  /** Queue-specific configurations */
  queues?: Record<string, QueueOptions>;
}

export interface QueueOptions {
  /** Maximum number of concurrent jobs */
  concurrency?: number;
  /** Rate limit configuration */
  rateLimit?: {
    max: number;
    duration: number;
  };
  /** Default job options for this queue */
  defaultJobOptions?: JobsOptions;
  /** Job lock duration in ms (how long a job can run before stalling) */
  lockDuration?: number;
  /** How often to check for stalled jobs in ms */
  stalledInterval?: number;
}

export interface JobData {
  /** Organization ID for multi-tenant isolation */
  orgId: string;
  /** Job type within the queue */
  type: string;
  /** Job payload */
  payload: Record<string, any>;
  /** Idempotency key to prevent duplicates */
  idempotencyKey?: string;
  /** Priority (1-highest to 10-lowest) */
  priority?: number;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Queue names used across the application
 */
export const QueueNames = {
  /** AFIP invoice/CAE processing */
  CAE: 'cae-queue',
  /** WhatsApp message delivery */
  WHATSAPP: 'whatsapp-queue',
  /** Payment processing and reconciliation */
  PAYMENT: 'payment-queue',
  /** Push notifications */
  NOTIFICATION: 'notification-queue',
  /** Scheduled tasks (cron jobs) */
  SCHEDULED: 'scheduled-queue',
  /** Dead letter queue for failed jobs */
  DLQ: 'dead-letter-queue',
} as const;

export type QueueName = typeof QueueNames[keyof typeof QueueNames];

/**
 * Default job options by queue type
 */
const DEFAULT_JOB_OPTIONS: Record<string, JobsOptions> = {
  [QueueNames.CAE]: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: false, // Keep failed jobs for analysis
  },
  [QueueNames.WHATSAPP]: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: { count: 5000 },
    removeOnFail: { count: 1000 },
  },
  [QueueNames.PAYMENT]: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: false,
  },
  [QueueNames.NOTIFICATION]: {
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 1000,
    },
    removeOnComplete: { count: 10000 },
    removeOnFail: { count: 1000 },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class QueueManager {
  private static instance: QueueManager | null = null;
  private connection: Redis;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private config: QueueConfig;

  /**
   * Get singleton instance of QueueManager
   */
  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager({
        redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      });
    }
    return QueueManager.instance;
  }

  constructor(config: QueueConfig) {
    this.config = config;
    this.connection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  /**
   * Initialize all queues
   */
  async initialize(): Promise<void> {
    // Create all standard queues
    for (const queueName of Object.values(QueueNames)) {
      this.createQueue(queueName);
    }

    console.log(`Queue manager initialized with ${this.queues.size} queues`);
  }

  /**
   * Create a queue
   */
  createQueue(name: string): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const defaultOpts = DEFAULT_JOB_OPTIONS[name] || {};
    const customOpts = this.config.queues?.[name]?.defaultJobOptions || {};

    const queue = new Queue(name, {
      connection: this.connection.duplicate(),
      defaultJobOptions: {
        ...this.config.defaultJobOptions,
        ...defaultOpts,
        ...customOpts,
      },
    });

    // Create queue events for monitoring
    const events = new QueueEvents(name, {
      connection: this.connection.duplicate(),
    });

    this.queues.set(name, queue);
    this.queueEvents.set(name, events);

    return queue;
  }

  /**
   * Get a queue by name
   */
  getQueue(name: string): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue not found: ${name}`);
    }
    return queue;
  }

  /**
   * Add a job to a queue
   */
  async addJob(
    queueName: string,
    data: JobData,
    options?: JobsOptions
  ): Promise<Job<JobData>> {
    const queue = this.getQueue(queueName);

    // Generate job ID from idempotency key if provided
    const jobId = data.idempotencyKey
      ? `${data.orgId}:${data.idempotencyKey}`
      : undefined;

    return queue.add(data.type, data, {
      ...options,
      jobId,
      priority: data.priority,
    });
  }

  /**
   * Add multiple jobs in bulk
   */
  async addBulk(
    queueName: string,
    jobs: Array<{ data: JobData; options?: JobsOptions }>
  ): Promise<Job<JobData>[]> {
    const queue = this.getQueue(queueName);

    const bulkJobs = jobs.map((job) => ({
      name: job.data.type,
      data: job.data,
      opts: {
        ...job.options,
        jobId: job.data.idempotencyKey
          ? `${job.data.orgId}:${job.data.idempotencyKey}`
          : undefined,
        priority: job.data.priority,
      },
    }));

    return queue.addBulk(bulkJobs);
  }

  /**
   * Register a worker for a queue
   */
  registerWorker(
    queueName: string,
    processor: (job: Job<JobData>) => Promise<JobResult>,
    options?: Partial<WorkerOptions>
  ): Worker {
    if (this.workers.has(queueName)) {
      throw new Error(`Worker already registered for queue: ${queueName}`);
    }

    const queueConfig = this.config.queues?.[queueName];

    // Default timeouts by queue type (in ms)
    const defaultTimeouts: Record<string, number> = {
      [QueueNames.CAE]: 60000,        // 60s - AFIP can be slow
      [QueueNames.WHATSAPP]: 30000,   // 30s
      [QueueNames.PAYMENT]: 120000,   // 120s - Payment APIs can be slow
      [QueueNames.NOTIFICATION]: 15000, // 15s - Should be fast
      [QueueNames.DLQ]: 30000,        // 30s
    };

    const lockDuration = queueConfig?.lockDuration || defaultTimeouts[queueName] || 30000;

    const worker = new Worker<JobData, JobResult>(
      queueName,
      processor,
      {
        connection: this.connection.duplicate(),
        concurrency: queueConfig?.concurrency || 5,
        limiter: queueConfig?.rateLimit,
        lockDuration,
        stalledInterval: queueConfig?.stalledInterval || 30000, // Check every 30s
        ...options,
      }
    );

    // Set up event handlers
    this.setupWorkerEvents(worker, queueName);

    this.workers.set(queueName, worker);
    return worker;
  }

  /**
   * Set up worker event handlers
   */
  private setupWorkerEvents(worker: Worker, queueName: string): void {
    worker.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed in queue ${queueName}`, {
        jobId: job.id,
        type: job.name,
        orgId: job.data.orgId,
        success: result?.success,
      });
    });

    worker.on('failed', (job, error) => {
      console.error(`Job ${job?.id} failed in queue ${queueName}`, {
        jobId: job?.id,
        type: job?.name,
        orgId: job?.data.orgId,
        error: error.message,
        attempts: job?.attemptsMade,
      });

      // Move to DLQ if max attempts exceeded
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        this.moveToDeadLetterQueue(queueName, job, error);
      }
    });

    worker.on('error', (error) => {
      console.error(`Worker error in queue ${queueName}:`, error);
    });

    worker.on('stalled', (jobId) => {
      console.warn(`Job ${jobId} stalled in queue ${queueName}`);
    });
  }

  /**
   * Move failed job to dead letter queue
   */
  private async moveToDeadLetterQueue(
    sourceQueue: string,
    job: Job<JobData>,
    error: Error
  ): Promise<void> {
    try {
      const dlq = this.getQueue(QueueNames.DLQ);

      await dlq.add('failed-job', {
        orgId: job.data.orgId,
        type: 'dlq-entry',
        payload: {
          sourceQueue,
          originalJob: {
            id: job.id,
            name: job.name,
            data: job.data,
            attemptsMade: job.attemptsMade,
            failedReason: error.message,
            stacktrace: job.stacktrace,
          },
          movedAt: new Date().toISOString(),
        },
      });

      console.log(`Job ${job.id} moved to DLQ from ${sourceQueue}`);
    } catch (dlqError) {
      console.error('Failed to move job to DLQ:', dlqError);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }> {
    const queue = this.getQueue(queueName);

    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    };
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats(): Promise<Map<string, Awaited<ReturnType<typeof this.getQueueStats>>>> {
    const stats = new Map();

    for (const queueName of this.queues.keys()) {
      stats.set(queueName, await this.getQueueStats(queueName));
    }

    return stats;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    console.log(`Queue ${queueName} paused`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    console.log(`Queue ${queueName} resumed`);
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(
    queueName: string,
    grace: number = 24 * 60 * 60 * 1000, // 24 hours
    status: 'completed' | 'failed' | 'delayed' | 'wait' | 'active' = 'completed'
  ): Promise<string[]> {
    const queue = this.getQueue(queueName);
    return queue.clean(grace, 1000, status);
  }

  /**
   * Gracefully shutdown all queues and workers
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down queue manager...');

    // Close workers first
    for (const [name, worker] of this.workers) {
      console.log(`Closing worker: ${name}`);
      await worker.close();
    }

    // Close queue events
    for (const [name, events] of this.queueEvents) {
      await events.close();
    }

    // Close queues
    for (const [name, queue] of this.queues) {
      await queue.close();
    }

    // Close Redis connection
    await this.connection.quit();

    console.log('Queue manager shutdown complete');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let queueManager: QueueManager | null = null;

/**
 * Initialize the global queue manager
 */
export async function initializeQueueManager(config: QueueConfig): Promise<void> {
  queueManager = new QueueManager(config);
  await queueManager.initialize();
}

/**
 * Get the global queue manager
 */
export function getQueueManager(): QueueManager {
  if (!queueManager) {
    throw new Error('Queue manager not initialized. Call initializeQueueManager first.');
  }
  return queueManager;
}
