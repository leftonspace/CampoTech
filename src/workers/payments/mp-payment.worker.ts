/**
 * MercadoPago Payment Worker
 * ==========================
 *
 * Background worker for processing MercadoPago payment updates.
 * Handles webhook events, status synchronization, and retries.
 */

import {
  MPConfig,
  MPCredentials,
  Payment,
  PaymentStatus,
  MPPaymentRecord,
} from '../../integrations/mercadopago/mercadopago.types';
import {
  fetchPayment,
  parseExternalReference,
  isPaymentFinal,
} from '../../integrations/mercadopago';
import { log } from '../../lib/logging/logger';
import { getCapabilityService, CapabilityPath } from '../../../core/config/capabilities';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PaymentWorkerConfig {
  concurrency: number;
  pollIntervalMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

export interface PaymentJob {
  id: string;
  type: 'webhook' | 'sync' | 'reconcile';
  mpPaymentId?: string;
  invoiceId?: string;
  orgId: string;
  attempt: number;
  createdAt: Date;
  scheduledFor?: Date;
}

export interface PaymentJobResult {
  success: boolean;
  jobId: string;
  paymentId?: string;
  status?: PaymentStatus;
  error?: string;
  processedAt: Date;
}

const DEFAULT_CONFIG: PaymentWorkerConfig = {
  concurrency: 3,
  pollIntervalMs: 5000,
  maxRetries: 5,
  retryDelayMs: 30000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT WORKER
// ═══════════════════════════════════════════════════════════════════════════════

export class MPPaymentWorker {
  private config: PaymentWorkerConfig;
  private mpConfig: MPConfig;
  private running = false;
  private pollTimeout: NodeJS.Timeout | null = null;
  private activeJobs = 0;

  // Callbacks for database operations (injected)
  private getCredentials: (orgId: string) => Promise<MPCredentials | null>;
  private getPaymentRecord: (invoiceId: string) => Promise<MPPaymentRecord | null>;
  private updatePaymentRecord: (record: Partial<MPPaymentRecord> & { id: string }) => Promise<void>;
  private updateInvoiceStatus: (invoiceId: string, status: string, paymentData?: Payment) => Promise<void>;
  private fetchPendingJobs: () => Promise<PaymentJob[]>;
  private markJobComplete: (jobId: string, result: PaymentJobResult) => Promise<void>;
  private scheduleRetry: (job: PaymentJob, delayMs: number) => Promise<void>;

  constructor(
    mpConfig: MPConfig,
    config: Partial<PaymentWorkerConfig>,
    callbacks: {
      getCredentials: (orgId: string) => Promise<MPCredentials | null>;
      getPaymentRecord: (invoiceId: string) => Promise<MPPaymentRecord | null>;
      updatePaymentRecord: (record: Partial<MPPaymentRecord> & { id: string }) => Promise<void>;
      updateInvoiceStatus: (invoiceId: string, status: string, paymentData?: Payment) => Promise<void>;
      fetchPendingJobs: () => Promise<PaymentJob[]>;
      markJobComplete: (jobId: string, result: PaymentJobResult) => Promise<void>;
      scheduleRetry: (job: PaymentJob, delayMs: number) => Promise<void>;
    }
  ) {
    this.mpConfig = mpConfig;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.getCredentials = callbacks.getCredentials;
    this.getPaymentRecord = callbacks.getPaymentRecord;
    this.updatePaymentRecord = callbacks.updatePaymentRecord;
    this.updateInvoiceStatus = callbacks.updateInvoiceStatus;
    this.fetchPendingJobs = callbacks.fetchPendingJobs;
    this.markJobComplete = callbacks.markJobComplete;
    this.scheduleRetry = callbacks.scheduleRetry;
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.poll();
    log.info('MPPaymentWorker started', { config: this.config });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    this.running = false;
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    log.info('MPPaymentWorker stopped');
  }

  /**
   * Poll for pending jobs
   */
  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      // Check capability system first
      const capabilityService = getCapabilityService();
      const mpEnabled = await capabilityService.ensure('external.mercadopago' as CapabilityPath);
      const paymentsEnabled = await capabilityService.ensure('domain.payments' as CapabilityPath);
      const reconciliationEnabled = await capabilityService.ensure('services.payment_reconciliation' as CapabilityPath);

      if (!mpEnabled || !paymentsEnabled) {
        log.warn('MercadoPago capability disabled, skipping poll', {
          mpEnabled,
          paymentsEnabled,
          reconciliationEnabled,
        });
        this.schedulePoll();
        return;
      }

      // Check if we have capacity
      if (this.activeJobs >= this.config.concurrency) {
        this.schedulePoll();
        return;
      }

      // Fetch pending jobs
      const jobs = await this.fetchPendingJobs();
      const availableSlots = this.config.concurrency - this.activeJobs;
      const jobsToProcess = jobs.slice(0, availableSlots);

      // Process jobs concurrently
      for (const job of jobsToProcess) {
        this.processJob(job);
      }
    } catch (error) {
      log.error('Error polling for payment jobs', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    this.schedulePoll();
  }

  private schedulePoll(): void {
    if (!this.running) return;
    this.pollTimeout = setTimeout(() => this.poll(), this.config.pollIntervalMs);
  }

  /**
   * Process a single job
   */
  private async processJob(job: PaymentJob): Promise<void> {
    this.activeJobs++;

    try {
      log.info('Processing payment job', { jobId: job.id, type: job.type });

      let result: PaymentJobResult;

      switch (job.type) {
        case 'webhook':
          result = await this.processWebhookJob(job);
          break;
        case 'sync':
          result = await this.processSyncJob(job);
          break;
        case 'reconcile':
          result = await this.processReconcileJob(job);
          break;
        default:
          result = {
            success: false,
            jobId: job.id,
            error: `Unknown job type: ${job.type}`,
            processedAt: new Date(),
          };
      }

      if (result.success) {
        await this.markJobComplete(job.id, result);
      } else if (job.attempt < this.config.maxRetries) {
        // Schedule retry with exponential backoff
        const delay = this.config.retryDelayMs * Math.pow(2, job.attempt);
        await this.scheduleRetry({ ...job, attempt: job.attempt + 1 }, delay);
      } else {
        // Max retries exceeded
        await this.markJobComplete(job.id, {
          ...result,
          error: `Max retries exceeded: ${result.error}`,
        });
      }
    } catch (error) {
      log.error('Error processing payment job', {
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    } finally {
      this.activeJobs--;
    }
  }

  /**
   * Process webhook notification job
   */
  private async processWebhookJob(job: PaymentJob): Promise<PaymentJobResult> {
    if (!job.mpPaymentId) {
      return {
        success: false,
        jobId: job.id,
        error: 'Missing mpPaymentId',
        processedAt: new Date(),
      };
    }

    // Get credentials
    const credentials = await this.getCredentials(job.orgId);
    if (!credentials) {
      return {
        success: false,
        jobId: job.id,
        error: 'No credentials for organization',
        processedAt: new Date(),
      };
    }

    // Fetch payment from MP
    const fetchResult = await fetchPayment(credentials.accessToken, job.mpPaymentId);
    if (!fetchResult.success) {
      return {
        success: false,
        jobId: job.id,
        paymentId: job.mpPaymentId,
        error: fetchResult.error,
        processedAt: new Date(),
      };
    }

    const payment = fetchResult.payment;

    // Parse external reference
    if (!payment.externalReference) {
      return {
        success: false,
        jobId: job.id,
        paymentId: job.mpPaymentId,
        error: 'Payment has no external reference',
        processedAt: new Date(),
      };
    }

    const parsed = parseExternalReference(payment.externalReference);
    if (!parsed) {
      return {
        success: false,
        jobId: job.id,
        paymentId: job.mpPaymentId,
        error: 'Invalid external reference format',
        processedAt: new Date(),
      };
    }

    // Update local records
    await this.syncPaymentData(parsed.invoiceId, payment);

    return {
      success: true,
      jobId: job.id,
      paymentId: job.mpPaymentId,
      status: payment.status,
      processedAt: new Date(),
    };
  }

  /**
   * Process sync job (fetch latest status from MP)
   */
  private async processSyncJob(job: PaymentJob): Promise<PaymentJobResult> {
    if (!job.invoiceId) {
      return {
        success: false,
        jobId: job.id,
        error: 'Missing invoiceId',
        processedAt: new Date(),
      };
    }

    // Get local payment record
    const record = await this.getPaymentRecord(job.invoiceId);
    if (!record || !record.mpPaymentId) {
      return {
        success: false,
        jobId: job.id,
        error: 'No payment record found',
        processedAt: new Date(),
      };
    }

    // Get credentials
    const credentials = await this.getCredentials(job.orgId);
    if (!credentials) {
      return {
        success: false,
        jobId: job.id,
        error: 'No credentials for organization',
        processedAt: new Date(),
      };
    }

    // Fetch payment from MP
    const fetchResult = await fetchPayment(credentials.accessToken, record.mpPaymentId);
    if (!fetchResult.success) {
      return {
        success: false,
        jobId: job.id,
        error: fetchResult.error,
        processedAt: new Date(),
      };
    }

    // Update local records
    await this.syncPaymentData(job.invoiceId, fetchResult.payment);

    return {
      success: true,
      jobId: job.id,
      paymentId: record.mpPaymentId,
      status: fetchResult.payment.status,
      processedAt: new Date(),
    };
  }

  /**
   * Process reconciliation job
   */
  private async processReconcileJob(job: PaymentJob): Promise<PaymentJobResult> {
    // Reconciliation is handled by the reconciliation service
    // This just triggers a sync for a specific invoice
    return this.processSyncJob(job);
  }

  /**
   * Sync payment data with local database
   */
  private async syncPaymentData(invoiceId: string, payment: Payment): Promise<void> {
    // Update payment record
    await this.updatePaymentRecord({
      id: invoiceId, // Assuming invoice ID is used as payment record ID
      mpPaymentId: String(payment.id),
      status: payment.status,
      paymentMethod: payment.paymentTypeId,
      installments: payment.installments,
      installmentAmount: payment.installmentAmount,
      mpResponse: payment,
      updatedAt: new Date(),
    });

    // Update invoice status
    const internalStatus = mapMPStatusToInternal(payment.status);
    await this.updateInvoiceStatus(invoiceId, internalStatus, payment);

    log.info('Payment data synced', {
      invoiceId,
      mpPaymentId: payment.id,
      status: payment.status,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

function mapMPStatusToInternal(mpStatus: PaymentStatus): string {
  const statusMap: Record<PaymentStatus, string> = {
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

  return statusMap[mpStatus] || 'unknown';
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let workerInstance: MPPaymentWorker | null = null;

export function getMPPaymentWorker(): MPPaymentWorker | null {
  return workerInstance;
}

export function setMPPaymentWorker(worker: MPPaymentWorker): void {
  workerInstance = worker;
}

export function resetMPPaymentWorker(): void {
  if (workerInstance) {
    workerInstance.stop();
  }
  workerInstance = null;
}
