/**
 * Base Worker Class
 * =================
 *
 * Abstract base class for queue workers with common functionality:
 * - Error handling and retries
 * - Logging and metrics
 * - Capability checks
 * - Multi-tenant context
 */

import { Job } from 'bullmq';
import { JobData, JobResult } from '../queue-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WorkerContext {
  /** Job being processed */
  job: Job<JobData>;
  /** Organization ID */
  orgId: string;
  /** Logger instance */
  logger: WorkerLogger;
  /** Job start time */
  startedAt: Date;
}

export interface WorkerLogger {
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
  debug(message: string, meta?: Record<string, any>): void;
}

export interface WorkerConfig {
  /** Worker name for logging */
  name: string;
  /** Queue name this worker processes */
  queueName: string;
  /** Capability required to process jobs */
  requiredCapability?: string;
  /** Maximum processing time before timeout (ms) */
  timeout?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BASE WORKER
// ═══════════════════════════════════════════════════════════════════════════════

export abstract class BaseWorker {
  protected config: WorkerConfig;

  constructor(config: WorkerConfig) {
    this.config = {
      timeout: 30000, // 30 seconds default
      ...config,
    };
  }

  /**
   * Process a job - entry point called by queue manager
   */
  async process(job: Job<JobData>): Promise<JobResult> {
    const startedAt = new Date();
    const logger = this.createLogger(job);

    const context: WorkerContext = {
      job,
      orgId: job.data.orgId,
      logger,
      startedAt,
    };

    try {
      logger.info('Starting job processing', {
        type: job.data.type,
        attempt: job.attemptsMade + 1,
      });

      // Check capability if required
      if (this.config.requiredCapability) {
        const canProcess = await this.checkCapability(
          this.config.requiredCapability,
          job.data.orgId
        );

        if (!canProcess) {
          logger.warn('Capability disabled, skipping job');
          return {
            success: false,
            error: {
              code: 'CAPABILITY_DISABLED',
              message: `Capability ${this.config.requiredCapability} is disabled`,
            },
          };
        }
      }

      // Execute with timeout
      const result = await this.executeWithTimeout(context);

      const duration = Date.now() - startedAt.getTime();
      logger.info('Job completed successfully', { duration });

      return result;
    } catch (error) {
      const duration = Date.now() - startedAt.getTime();
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Job processing failed', {
        error: errorMessage,
        duration,
        attempt: job.attemptsMade + 1,
      });

      // Determine if error is retryable
      const isRetryable = this.isRetryableError(error);

      if (!isRetryable) {
        // Non-retryable error - fail immediately
        return {
          success: false,
          error: {
            code: 'NON_RETRYABLE_ERROR',
            message: errorMessage,
          },
        };
      }

      // Re-throw for BullMQ to handle retry
      throw error;
    }
  }

  /**
   * Execute the job with timeout protection
   */
  private async executeWithTimeout(context: WorkerContext): Promise<JobResult> {
    const timeout = this.config.timeout!;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Job timed out after ${timeout}ms`));
      }, timeout);

      this.execute(context)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Abstract method - implement job processing logic
   */
  protected abstract execute(context: WorkerContext): Promise<JobResult>;

  /**
   * Check if capability is enabled
   */
  protected async checkCapability(capability: string, orgId: string): Promise<boolean> {
    // TODO: Integrate with actual capabilities system
    // For now, return true
    return true;
  }

  /**
   * Determine if an error is retryable
   */
  protected isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Network errors are retryable
      if (error.message.includes('ECONNREFUSED') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('ENOTFOUND') ||
          error.message.includes('rate limit') ||
          error.message.includes('timeout')) {
        return true;
      }

      // HTTP 5xx errors are retryable
      if (error.message.includes('500') ||
          error.message.includes('502') ||
          error.message.includes('503') ||
          error.message.includes('504')) {
        return true;
      }

      // Specific non-retryable errors
      if (error.message.includes('invalid') ||
          error.message.includes('unauthorized') ||
          error.message.includes('forbidden') ||
          error.message.includes('not found')) {
        return false;
      }
    }

    // Default to retryable
    return true;
  }

  /**
   * Create a logger for the job
   */
  protected createLogger(job: Job<JobData>): WorkerLogger {
    const prefix = `[${this.config.name}:${job.id}]`;

    return {
      info: (message: string, meta?: Record<string, any>) => {
        console.log(`${prefix} INFO: ${message}`, {
          ...meta,
          orgId: job.data.orgId,
          jobType: job.data.type,
        });
      },
      warn: (message: string, meta?: Record<string, any>) => {
        console.warn(`${prefix} WARN: ${message}`, {
          ...meta,
          orgId: job.data.orgId,
          jobType: job.data.type,
        });
      },
      error: (message: string, meta?: Record<string, any>) => {
        console.error(`${prefix} ERROR: ${message}`, {
          ...meta,
          orgId: job.data.orgId,
          jobType: job.data.type,
        });
      },
      debug: (message: string, meta?: Record<string, any>) => {
        if (process.env.DEBUG) {
          console.debug(`${prefix} DEBUG: ${message}`, {
            ...meta,
            orgId: job.data.orgId,
            jobType: job.data.type,
          });
        }
      },
    };
  }

  /**
   * Update job progress
   */
  protected async updateProgress(job: Job<JobData>, progress: number): Promise<void> {
    await job.updateProgress(Math.min(100, Math.max(0, progress)));
  }

  /**
   * Add data to job log
   */
  protected async log(job: Job<JobData>, message: string): Promise<void> {
    await job.log(message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPED WORKER BASE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Typed base worker for specific payload types
 */
export abstract class TypedWorker<TPayload extends Record<string, any>> extends BaseWorker {
  protected async execute(context: WorkerContext): Promise<JobResult> {
    const payload = context.job.data.payload as TPayload;
    return this.processPayload(payload, context);
  }

  /**
   * Process typed payload
   */
  protected abstract processPayload(
    payload: TPayload,
    context: WorkerContext
  ): Promise<JobResult>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH WORKER BASE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Base class for workers that process items in batches
 */
export abstract class BatchWorker<TItem> extends BaseWorker {
  protected batchSize: number;

  constructor(config: WorkerConfig & { batchSize?: number }) {
    super(config);
    this.batchSize = config.batchSize || 100;
  }

  protected async execute(context: WorkerContext): Promise<JobResult> {
    const items = context.job.data.payload.items as TItem[];
    const results: { success: number; failed: number; errors: string[] } = {
      success: 0,
      failed: 0,
      errors: [],
    };

    // Process in batches
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);

      try {
        const batchResults = await this.processBatch(batch, context);
        results.success += batchResults.success;
        results.failed += batchResults.failed;
        results.errors.push(...batchResults.errors);
      } catch (error) {
        results.failed += batch.length;
        results.errors.push(error instanceof Error ? error.message : String(error));
      }

      // Update progress
      const progress = Math.round(((i + batch.length) / items.length) * 100);
      await this.updateProgress(context.job, progress);
    }

    return {
      success: results.failed === 0,
      data: results,
      error: results.failed > 0
        ? { code: 'PARTIAL_FAILURE', message: `${results.failed} items failed` }
        : undefined,
    };
  }

  /**
   * Process a batch of items
   */
  protected abstract processBatch(
    items: TItem[],
    context: WorkerContext
  ): Promise<{ success: number; failed: number; errors: string[] }>;
}
