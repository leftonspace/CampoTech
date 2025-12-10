/**
 * Payment Webhook Worker
 * ======================
 *
 * BullMQ-based worker for processing MercadoPago webhook events.
 * Processes payment notifications asynchronously with retry logic.
 */

import { Worker, Queue, Job } from 'bullmq';
import { getRedis } from '../../lib/redis/redis-manager';
import { getCapabilityService, CapabilityPath } from '../../../core/config/capabilities';
import { getFairScheduler, createFairProcessor } from '../../../core/queue/fair-scheduler';
import { log } from '../../lib/logging/logger';
import { prisma } from '../../lib/prisma';
import {
  fetchPayment,
  parseExternalReference,
} from '../../integrations/mercadopago';
import { publishEvent } from '../../lib/events';

// =============================================================================
// CONFIGURATION
// =============================================================================

const QUEUE_NAME = 'payment-webhook';

const WORKER_CONFIG = {
  concurrency: 10,
  limiter: {
    max: 50, // Max 50 jobs per minute
    duration: 60000,
  },
};

const JOB_CONFIG = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 10000, // Start with 10 second delay
  },
  removeOnComplete: {
    age: 24 * 60 * 60, // Keep completed jobs for 24 hours
    count: 1000,
  },
  removeOnFail: false, // Keep failed jobs for DLQ analysis
};

// =============================================================================
// TYPES
// =============================================================================

export interface PaymentWebhookJobData {
  /** MercadoPago payment ID */
  mpPaymentId: string;
  /** Organization ID */
  orgId: string;
  /** Webhook action (payment.created, payment.updated) */
  action: string;
  /** Idempotency key to prevent duplicate processing */
  idempotencyKey: string;
  /** Original webhook timestamp */
  webhookTimestamp: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface PaymentWebhookJobResult {
  success: boolean;
  mpPaymentId: string;
  invoiceId?: string;
  status?: string;
  error?: string;
  processedAt: Date;
}

// =============================================================================
// QUEUE
// =============================================================================

let webhookQueue: Queue<PaymentWebhookJobData, PaymentWebhookJobResult> | null = null;

export function getPaymentWebhookQueue(): Queue<PaymentWebhookJobData, PaymentWebhookJobResult> {
  if (!webhookQueue) {
    webhookQueue = new Queue(QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: JOB_CONFIG,
    });
  }
  return webhookQueue;
}

/**
 * Add a payment webhook to the processing queue
 */
export async function queuePaymentWebhook(
  data: PaymentWebhookJobData
): Promise<Job<PaymentWebhookJobData, PaymentWebhookJobResult>> {
  const queue = getPaymentWebhookQueue();

  return queue.add(`webhook-${data.mpPaymentId}`, data, {
    jobId: data.idempotencyKey, // Prevent duplicate processing
    priority: 1, // High priority
  });
}

/**
 * Get queue status
 */
export async function getQueueStatus(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getPaymentWebhookQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

// =============================================================================
// WORKER
// =============================================================================

let webhookWorker: Worker<PaymentWebhookJobData, PaymentWebhookJobResult> | null = null;

export function startPaymentWebhookWorker(): Worker<PaymentWebhookJobData, PaymentWebhookJobResult> {
  if (webhookWorker) {
    return webhookWorker;
  }

  const scheduler = getFairScheduler();

  webhookWorker = new Worker<PaymentWebhookJobData, PaymentWebhookJobResult>(
    QUEUE_NAME,
    createFairProcessor(scheduler, async (job) => {
      const { mpPaymentId, orgId, action, idempotencyKey } = job.data;

      log.info('Processing payment webhook', {
        jobId: job.id,
        mpPaymentId,
        action,
        orgId,
      });

      try {
        // Check capability system
        const capabilityService = getCapabilityService();
        const mpEnabled = await capabilityService.ensure(
          'external.mercadopago' as CapabilityPath,
          orgId
        );
        const paymentsEnabled = await capabilityService.ensure(
          'domain.payments' as CapabilityPath,
          orgId
        );

        if (!mpEnabled || !paymentsEnabled) {
          log.warn('MercadoPago/Payments capability disabled', {
            mpPaymentId,
            mpEnabled,
            paymentsEnabled,
          });
          return {
            success: false,
            mpPaymentId,
            error: 'Payment processing capability is disabled',
            processedAt: new Date(),
          };
        }

        // Check idempotency
        const existingKey = await prisma.idempotencyKey.findUnique({
          where: { key: idempotencyKey },
        });

        if (existingKey?.status === 'completed') {
          log.info('Webhook already processed (idempotent)', {
            mpPaymentId,
            idempotencyKey,
          });
          return {
            success: true,
            mpPaymentId,
            processedAt: new Date(),
          };
        }

        // Mark as processing
        await prisma.idempotencyKey.upsert({
          where: { key: idempotencyKey },
          update: { status: 'processing' },
          create: {
            key: idempotencyKey,
            status: 'processing',
            organizationId: orgId,
            operationType: 'payment_webhook',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });

        // Get organization credentials
        const organization = await prisma.organization.findUnique({
          where: { id: orgId },
          select: {
            mpAccessToken: true,
            mpPublicKey: true,
          },
        });

        if (!organization?.mpAccessToken) {
          throw new Error('No MercadoPago credentials for organization');
        }

        // Fetch payment details from MercadoPago
        const fetchResult = await fetchPayment(
          organization.mpAccessToken,
          mpPaymentId
        );

        if (!fetchResult.success) {
          throw new Error(fetchResult.error || 'Failed to fetch payment');
        }

        const payment = fetchResult.payment;

        // Parse external reference to get invoice ID
        if (!payment.externalReference) {
          throw new Error('Payment has no external reference');
        }

        const parsed = parseExternalReference(payment.externalReference);
        if (!parsed) {
          throw new Error('Invalid external reference format');
        }

        // Update payment record in database
        await updatePaymentRecord(parsed.invoiceId, payment);

        // Mark idempotency key as completed
        await prisma.idempotencyKey.update({
          where: { key: idempotencyKey },
          data: {
            status: 'completed',
            result: { paymentId: mpPaymentId, status: payment.status },
            completedAt: new Date(),
          },
        });

        // Emit event for downstream processing
        await publishEvent('payment.webhook_processed', {
          mpPaymentId,
          invoiceId: parsed.invoiceId,
          status: payment.status,
          orgId,
        });

        log.info('Payment webhook processed successfully', {
          mpPaymentId,
          invoiceId: parsed.invoiceId,
          status: payment.status,
        });

        return {
          success: true,
          mpPaymentId,
          invoiceId: parsed.invoiceId,
          status: payment.status,
          processedAt: new Date(),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        log.error('Payment webhook processing failed', {
          mpPaymentId,
          error: errorMessage,
          attempt: job.attemptsMade + 1,
        });

        // Mark idempotency key as failed
        await prisma.idempotencyKey.update({
          where: { key: idempotencyKey },
          data: {
            status: 'failed',
            result: { error: errorMessage },
          },
        }).catch(() => {});

        // Re-throw for BullMQ retry handling
        throw error;
      }
    }),
    {
      connection: getRedis(),
      concurrency: WORKER_CONFIG.concurrency,
      limiter: WORKER_CONFIG.limiter,
    }
  );

  // Event handlers
  webhookWorker.on('completed', async (job, result) => {
    log.debug('Payment webhook job completed', {
      jobId: job.id,
      mpPaymentId: result.mpPaymentId,
      status: result.status,
    });

    await publishEvent('queue.payment_webhook.completed', {
      jobId: job.id,
      mpPaymentId: job.data.mpPaymentId,
      orgId: job.data.orgId,
    });
  });

  webhookWorker.on('failed', async (job, error) => {
    log.error('Payment webhook job failed', {
      jobId: job?.id,
      mpPaymentId: job?.data.mpPaymentId,
      error: error.message,
      attempts: job?.attemptsMade,
    });

    if (job) {
      await publishEvent('queue.payment_webhook.failed', {
        jobId: job.id,
        mpPaymentId: job.data.mpPaymentId,
        orgId: job.data.orgId,
        error: error.message,
        attempts: job.attemptsMade,
      });
    }
  });

  webhookWorker.on('progress', (job, progress) => {
    log.debug('Payment webhook job progress', {
      jobId: job.id,
      progress,
    });
  });

  webhookWorker.on('error', (error) => {
    log.error('Payment webhook worker error', { error: error.message });
  });

  log.info('Payment webhook worker started');

  return webhookWorker;
}

export function stopPaymentWebhookWorker(): Promise<void> {
  if (webhookWorker) {
    return webhookWorker.close();
  }
  return Promise.resolve();
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Update payment record in database
 */
async function updatePaymentRecord(
  invoiceId: string,
  payment: any
): Promise<void> {
  // Map MP status to internal status
  const statusMap: Record<string, string> = {
    pending: 'payment_pending',
    approved: 'paid',
    authorized: 'payment_authorized',
    in_process: 'payment_processing',
    in_mediation: 'payment_disputed',
    rejected: 'payment_failed',
    cancelled: 'cancelled',
    refunded: 'refunded',
    charged_back: 'charged_back',
  };

  const internalStatus = statusMap[payment.status] || 'unknown';

  // Update invoice
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: internalStatus,
      mpPaymentId: String(payment.id),
      mpStatus: payment.status,
      mpPaymentMethod: payment.paymentTypeId,
      mpInstallments: payment.installments,
      paidAt: payment.status === 'approved' ? new Date() : null,
      updatedAt: new Date(),
    },
  });

  // Create payment record if needed
  const existingPayment = await prisma.payment.findFirst({
    where: { mpPaymentId: String(payment.id) },
  });

  if (!existingPayment && payment.status === 'approved') {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { organizationId: true, customerId: true, total: true },
    });

    if (invoice) {
      await prisma.payment.create({
        data: {
          invoiceId,
          organizationId: invoice.organizationId,
          customerId: invoice.customerId,
          amount: payment.transactionAmount || invoice.total,
          method: 'mercadopago',
          mpPaymentId: String(payment.id),
          status: 'completed',
          paidAt: new Date(),
        },
      });
    }
  }

  log.info('Payment record updated', {
    invoiceId,
    mpPaymentId: payment.id,
    status: internalStatus,
  });
}

// =============================================================================
// MANAGEMENT
// =============================================================================

/**
 * Retry a failed job
 */
export async function retryFailedJob(jobId: string): Promise<void> {
  const queue = getPaymentWebhookQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  await job.retry();
}

/**
 * Get failed jobs for review
 */
export async function getFailedJobs(
  start: number = 0,
  end: number = 20
): Promise<Job<PaymentWebhookJobData, PaymentWebhookJobResult>[]> {
  const queue = getPaymentWebhookQueue();
  return queue.getFailed(start, end);
}

/**
 * Pause the queue
 */
export async function pauseQueue(): Promise<void> {
  const queue = getPaymentWebhookQueue();
  await queue.pause();
}

/**
 * Resume the queue
 */
export async function resumeQueue(): Promise<void> {
  const queue = getPaymentWebhookQueue();
  await queue.resume();
}
