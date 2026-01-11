/**
 * AFIP Batch Processor
 * ====================
 *
 * Processes multiple AFIP invoice requests in optimized batches.
 * Handles rate limiting, prioritization, and error recovery.
 *
 * Features:
 * - Priority queue (high, normal, low)
 * - Configurable batch sizes
 * - Rate limit aware processing
 * - Circuit breaker integration
 * - Progress tracking
 */

import { prisma } from '@/lib/prisma';
import { getAFIPRateLimiter } from './rate-limiter';
import { getAFIPCircuitBreaker, CircuitBreakerOpenError } from './circuit-breaker';
import {
  BatchConfig,
  BatchJob,
  BatchResult,
  BatchJobResult,
} from './types';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONFIGURATION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxBatchSize: 10,
  maxConcurrency: 2,
  batchDelayMs: 5000,
  priorityEnabled: true,
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// BATCH JOB QUEUE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface InternalBatchJob extends BatchJob {
  resolver?: (result: BatchJobResult) => void;
  rejecter?: (error: Error) => void;
}

export class AFIPBatchProcessor {
  private config: BatchConfig;
  private queue: InternalBatchJob[] = [];
  private processing: Set<string> = new Set();
  private isRunning: boolean = false;
  private processTimer: ReturnType<typeof setTimeout> | null = null;
  private batchCounter: number = 0;

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
  }

  /**
   * Add an invoice to the batch queue
   */
  enqueue(
    invoiceId: string,
    orgId: string,
    priority: BatchJob['priority'] = 'normal'
  ): Promise<BatchJobResult> {
    return new Promise((resolve, reject) => {
      const job: InternalBatchJob = {
        id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        invoiceId,
        orgId,
        priority,
        createdAt: new Date(),
        attempts: 0,
        status: 'pending',
        resolver: resolve,
        rejecter: reject,
      };

      // Insert based on priority
      if (this.config.priorityEnabled) {
        this.insertWithPriority(job);
      } else {
        this.queue.push(job);
      }

      // Start processing if not already running
      if (!this.isRunning) {
        this.start();
      }
    });
  }

  /**
   * Add multiple invoices to the queue
   */
  enqueueBatch(
    invoices: Array<{ invoiceId: string; orgId: string; priority?: BatchJob['priority'] }>
  ): Promise<BatchResult> {
    const batchId = `batch_${Date.now()}_${++this.batchCounter}`;
    const promises = invoices.map((inv) =>
      this.enqueue(inv.invoiceId, inv.orgId, inv.priority || 'normal')
    );

    return Promise.all(promises).then((results) => ({
      batchId,
      processedAt: new Date(),
      totalJobs: results.length,
      successCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      results,
    }));
  }

  /**
   * Start the batch processor
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.info('[AFIP BatchProcessor] Started');
    this.scheduleNextBatch();
  }

  /**
   * Stop the batch processor
   */
  stop(): void {
    this.isRunning = false;

    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }

    console.info('[AFIP BatchProcessor] Stopped');
  }

  /**
   * Get queue status
   */
  getStatus(): {
    isRunning: boolean;
    queueLength: number;
    processing: number;
    byPriority: { high: number; normal: number; low: number };
  } {
    const byPriority = { high: 0, normal: 0, low: 0 };
    for (const job of this.queue) {
      byPriority[job.priority]++;
    }

    return {
      isRunning: this.isRunning,
      queueLength: this.queue.length,
      processing: this.processing.size,
      byPriority,
    };
  }

  /**
   * Get pending jobs
   */
  getPendingJobs(): BatchJob[] {
    return this.queue.map(({ resolver: _resolver, rejecter: _rejecter, ...job }) => job);
  }

  /**
   * Cancel a pending job
   */
  cancel(jobId: string): boolean {
    const index = this.queue.findIndex((j) => j.id === jobId);
    if (index === -1) return false;

    const job = this.queue[index];
    if (job.status !== 'pending') return false;

    this.queue.splice(index, 1);
    job.rejecter?.(new Error('Job cancelled'));
    return true;
  }

  /**
   * Clear all pending jobs
   */
  clearQueue(): number {
    const count = this.queue.length;
    for (const job of this.queue) {
      job.rejecter?.(new Error('Queue cleared'));
    }
    this.queue = [];
    return count;
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PRIVATE METHODS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private insertWithPriority(job: InternalBatchJob): void {
    const priorityOrder = { high: 0, normal: 1, low: 2 };

    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (priorityOrder[job.priority] < priorityOrder[this.queue[i].priority]) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, job);
  }

  private scheduleNextBatch(): void {
    if (!this.isRunning) return;

    // Check if we have jobs and capacity
    if (this.queue.length === 0) {
      this.processTimer = setTimeout(() => this.scheduleNextBatch(), 1000);
      return;
    }

    if (this.processing.size >= this.config.maxConcurrency) {
      this.processTimer = setTimeout(() => this.scheduleNextBatch(), 100);
      return;
    }

    // Process batch
    this.processBatch().then(() => {
      this.processTimer = setTimeout(
        () => this.scheduleNextBatch(),
        this.config.batchDelayMs
      );
    });
  }

  private async processBatch(): Promise<void> {
    const circuitBreaker = getAFIPCircuitBreaker();
    const rateLimiter = getAFIPRateLimiter();

    // Get jobs for this batch
    const batchSize = Math.min(
      this.config.maxBatchSize,
      this.config.maxConcurrency - this.processing.size
    );

    const jobs: InternalBatchJob[] = [];
    for (let i = 0; i < this.queue.length && jobs.length < batchSize; i++) {
      const job = this.queue[i];
      if (job.status !== 'pending') continue;

      // Check rate limit for this org
      if (!rateLimiter.canProceed(job.orgId)) continue;

      // Check circuit breaker for this org
      if (!circuitBreaker.canRequest(job.orgId)) continue;

      job.status = 'processing';
      jobs.push(job);
    }

    if (jobs.length === 0) return;

    // Process jobs concurrently
    const processPromises = jobs.map((job) => this.processJob(job));
    await Promise.allSettled(processPromises);
  }

  private async processJob(job: InternalBatchJob): Promise<void> {
    const startTime = Date.now();
    this.processing.add(job.id);

    try {
      // Remove from queue
      const queueIndex = this.queue.findIndex((j) => j.id === job.id);
      if (queueIndex !== -1) {
        this.queue.splice(queueIndex, 1);
      }

      job.attempts++;

      // Get rate limiter and circuit breaker
      const rateLimiter = getAFIPRateLimiter();
      const circuitBreaker = getAFIPCircuitBreaker();

      // Acquire rate limit slot
      const rateResult = rateLimiter.tryAcquire(job.orgId);
      if (!rateResult.acquired) {
        // Requeue with delay
        job.status = 'retrying';
        job.lastError = 'Rate limited';
        this.queue.push(job);
        return;
      }

      // Execute with circuit breaker
      try {
        const result = await circuitBreaker.execute(job.orgId, async () => {
          return this.executeAFIPRequest(job);
        });

        // Success
        job.status = 'completed';
        const jobResult: BatchJobResult = {
          jobId: job.id,
          invoiceId: job.invoiceId,
          success: true,
          cae: result.cae,
          caeExpiry: result.caeExpiry,
          invoiceNumber: result.invoiceNumber,
          processingTime: Date.now() - startTime,
        };

        job.resolver?.(jobResult);
      } catch (error) {
        if (error instanceof CircuitBreakerOpenError) {
          // Circuit breaker is open, requeue
          job.status = 'retrying';
          job.lastError = 'Circuit breaker open';
          this.queue.push(job);
          return;
        }

        // Other errors
        const message = error instanceof Error ? error.message : 'Unknown error';
        const shouldRetry = job.attempts < 3;

        if (shouldRetry) {
          job.status = 'retrying';
          job.lastError = message;
          this.queue.push(job);
        } else {
          job.status = 'failed';
          const jobResult: BatchJobResult = {
            jobId: job.id,
            invoiceId: job.invoiceId,
            success: false,
            error: message,
            processingTime: Date.now() - startTime,
          };
          job.resolver?.(jobResult);
        }
      }
    } finally {
      this.processing.delete(job.id);
    }
  }

  private async executeAFIPRequest(
    job: InternalBatchJob
  ): Promise<{ cae?: string; caeExpiry?: Date; invoiceNumber?: number }> {
    // Get invoice from database
    const invoice = await prisma.invoice.findUnique({
      where: { id: job.invoiceId },
      include: {
        organization: {
          select: {
            cuit: true,
            afipPuntoVenta: true,
            afipCertificate: true,
            afipPrivateKey: true,
          },
        },
        customer: {
          select: {
            cuit: true,
            documentType: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new Error(`Invoice ${job.invoiceId} not found`);
    }

    if (!invoice.organization.afipCertificate || !invoice.organization.afipPrivateKey) {
      throw new Error('AFIP credentials not configured');
    }

    // For now, we'll update the invoice status to indicate it was processed
    // The actual AFIP call would be made here
    // This integrates with the worker system in src/workers/afip/

    await prisma.invoice.update({
      where: { id: job.invoiceId },
      data: {
        status: 'pending_cae',
        retryAt: null,
        retryCount: 0,
      },
    });

    // Return placeholder - actual CAE would come from AFIP worker
    return {
      // The actual AFIP processing happens in the worker
      // This batch processor queues items for the worker
    };
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// IMMEDIATE PROCESSOR (SYNCHRONOUS)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Process a single invoice immediately (bypasses queue)
 * Use for urgent/high-priority invoices
 */
export async function processInvoiceImmediate(
  invoiceId: string,
  orgId: string
): Promise<BatchJobResult> {
  const startTime = Date.now();
  const circuitBreaker = getAFIPCircuitBreaker();
  const rateLimiter = getAFIPRateLimiter();

  // Check circuit breaker
  if (!circuitBreaker.canRequest(orgId)) {
    const status = circuitBreaker.getStatus(orgId);
    throw new CircuitBreakerOpenError(
      'AFIP circuit breaker is open',
      status.org.nextRetryAt
    );
  }

  // Check rate limit
  const rateResult = rateLimiter.tryAcquire(orgId);
  if (!rateResult.acquired) {
    throw new Error(`Rate limited. Wait ${rateResult.waitTime}ms`);
  }

  try {
    // Queue for worker processing
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'pending_cae',
        retryAt: null,
      },
    });

    circuitBreaker.recordSuccess(orgId);

    return {
      jobId: `immediate_${Date.now()}`,
      invoiceId,
      success: true,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    circuitBreaker.recordFailure(orgId);
    const message = error instanceof Error ? error.message : 'Unknown error';

    return {
      jobId: `immediate_${Date.now()}`,
      invoiceId,
      success: false,
      error: message,
      processingTime: Date.now() - startTime,
    };
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SINGLETON
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let globalBatchProcessor: AFIPBatchProcessor | null = null;

export function getAFIPBatchProcessor(): AFIPBatchProcessor {
  if (!globalBatchProcessor) {
    globalBatchProcessor = new AFIPBatchProcessor();
    globalBatchProcessor.start();
  }
  return globalBatchProcessor;
}

export function stopAFIPBatchProcessor(): void {
  if (globalBatchProcessor) {
    globalBatchProcessor.stop();
    globalBatchProcessor = null;
  }
}
