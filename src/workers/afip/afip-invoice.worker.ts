/**
 * AFIP Invoice Worker
 * ===================
 *
 * Background worker that processes invoice CAE requests.
 * Implements rate limiting, retry logic, and fallback handling.
 */

import { Pool } from 'pg';
import {
  AFIPConfig,
  AFIPJobData,
  AFIPJobResult,
  AFIPInvoiceInput,
  AFIPInvoiceType,
  AFIPDocumentType,
  AFIPConceptType,
} from '../../integrations/afip/afip.types';
import { getAFIPService } from '../../integrations/afip/afip.service';
import { shouldRetryError, calculateDelay, analyzeError, AFIPCircuitBreaker } from './afip-retry.strategy';
import { AFIPFallbackHandler } from './afip-fallback.handler';
import { log } from '../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface WorkerConfig {
  /** Maximum concurrent requests */
  concurrency: number;
  /** Rate limit (requests per minute) */
  rateLimit: number;
  /** Maximum queue size */
  maxQueueSize: number;
  /** Poll interval in milliseconds */
  pollInterval: number;
  /** Maximum retries per job */
  maxRetries: number;
}

const DEFAULT_CONFIG: WorkerConfig = {
  concurrency: 2,
  rateLimit: 10,
  maxQueueSize: 1000,
  pollInterval: 5000,
  maxRetries: 10,
};

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER
// ═══════════════════════════════════════════════════════════════════════════════

class RateLimiter {
  private timestamps: number[] = [];
  private limit: number;
  private windowMs: number;

  constructor(limit: number, windowMs: number = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  canProceed(): boolean {
    this.cleanup();
    return this.timestamps.length < this.limit;
  }

  record(): void {
    this.timestamps.push(Date.now());
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    this.timestamps = this.timestamps.filter(ts => ts > cutoff);
  }

  getAvailable(): number {
    this.cleanup();
    return Math.max(0, this.limit - this.timestamps.length);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER
// ═══════════════════════════════════════════════════════════════════════════════

export class AFIPInvoiceWorker {
  private pool: Pool;
  private config: WorkerConfig;
  private rateLimiter: RateLimiter;
  private circuitBreaker: AFIPCircuitBreaker;
  private fallbackHandler: AFIPFallbackHandler;
  private running: boolean = false;
  private activeJobs: number = 0;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(pool: Pool, config: WorkerConfig = DEFAULT_CONFIG) {
    this.pool = pool;
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.circuitBreaker = new AFIPCircuitBreaker();
    this.fallbackHandler = new AFIPFallbackHandler(pool, this.circuitBreaker);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Start the worker
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    log.info('AFIP Invoice Worker started', {
      concurrency: this.config.concurrency,
      rateLimit: this.config.rateLimit,
    });

    this.poll();
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    this.running = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait for active jobs to complete
    while (this.activeJobs > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    log.info('AFIP Invoice Worker stopped');
  }

  /**
   * Poll for new jobs
   */
  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      // Check panic conditions
      await this.fallbackHandler.checkPanicConditions();

      // Process jobs if allowed
      if (this.fallbackHandler.canMakeRequest()) {
        await this.processJobs();
      }
    } catch (error) {
      log.error('Worker poll error', error);
    }

    // Schedule next poll
    this.pollTimer = setTimeout(() => this.poll(), this.config.pollInterval);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // JOB PROCESSING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Process pending jobs
   */
  private async processJobs(): Promise<void> {
    // Calculate available slots
    const availableSlots = Math.min(
      this.config.concurrency - this.activeJobs,
      this.rateLimiter.getAvailable()
    );

    if (availableSlots <= 0) return;

    // Fetch pending invoices
    const invoices = await this.fetchPendingInvoices(availableSlots);

    // Process each invoice
    for (const invoice of invoices) {
      if (!this.rateLimiter.canProceed()) break;

      this.rateLimiter.record();
      this.activeJobs++;

      // Process asynchronously
      this.processInvoice(invoice).finally(() => {
        this.activeJobs--;
      });
    }
  }

  /**
   * Fetch pending invoices from database
   */
  private async fetchPendingInvoices(limit: number): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT i.*, o.cuit as org_cuit, o.afip_punto_venta, o.afip_cert, o.afip_key,
              c.cuit as customer_cuit, c.doc_type as customer_doc_type
       FROM invoices i
       JOIN organizations o ON i.org_id = o.id
       JOIN customers c ON i.customer_id = c.id
       WHERE i.status = 'pending_cae'
         AND (i.retry_at IS NULL OR i.retry_at <= NOW())
         AND i.retry_count < $1
       ORDER BY i.created_at ASC
       LIMIT $2
       FOR UPDATE SKIP LOCKED`,
      [this.config.maxRetries, limit]
    );

    return result.rows;
  }

  /**
   * Process a single invoice
   */
  private async processInvoice(invoiceRow: any): Promise<AFIPJobResult> {
    const startTime = Date.now();
    const invoiceId = invoiceRow.id;

    log.info('Processing invoice', { invoiceId });

    try {
      // Build AFIP config
      const config: AFIPConfig = {
        environment: (process.env.AFIP_ENVIRONMENT as any) || 'homologation',
        cuit: invoiceRow.org_cuit,
        puntoVenta: invoiceRow.afip_punto_venta || 1,
        certificate: invoiceRow.afip_cert,
        privateKey: invoiceRow.afip_key,
        certExpiry: invoiceRow.afip_cert_expiry,
      };

      // Build invoice input
      const invoiceInput = this.buildInvoiceInput(invoiceRow);

      // Request CAE
      const afipService = getAFIPService(this.pool);
      const result = await afipService.requestCAE(config, invoiceInput);

      // Record metrics
      this.fallbackHandler.recordRequest(result.success);

      const duration = Date.now() - startTime;

      if (result.success) {
        log.info('Invoice CAE success', {
          invoiceId,
          cae: result.cae,
          invoiceNumber: result.invoiceNumber,
          duration,
        });

        return {
          success: true,
          invoiceId,
          cae: result.cae,
          caeExpiry: result.caeExpiry,
          invoiceNumber: result.invoiceNumber,
          processedAt: new Date(),
        };
      } else {
        // Analyze error for retry
        const errorAnalysis = analyzeError(result.errors?.[0] || null);
        const retryDecision = shouldRetryError(
          result.errors?.[0]?.Code || null,
          invoiceRow.retry_count || 0
        );

        log.warn('Invoice CAE failed', {
          invoiceId,
          errors: result.errors,
          shouldRetry: retryDecision.shouldRetry,
          duration,
        });

        // Handle retry or failure
        if (retryDecision.shouldRetry) {
          await this.fallbackHandler.queueForRetry(invoiceId, retryDecision.delay);
          await this.incrementRetryCount(invoiceId);
        } else {
          await this.markAsFailed(invoiceId, result.errors);
        }

        return {
          success: false,
          invoiceId,
          error: result.errors?.[0]?.Msg || 'Unknown error',
          errorCode: result.errors?.[0]?.Code,
          errorType: result.errorType,
          processedAt: new Date(),
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      log.error('Invoice processing error', { invoiceId, error: message });

      // Record failure
      this.fallbackHandler.recordRequest(false);

      // Queue for retry
      const retryDecision = shouldRetryError(null, invoiceRow.retry_count || 0);
      if (retryDecision.shouldRetry) {
        await this.fallbackHandler.queueForRetry(invoiceId, retryDecision.delay);
        await this.incrementRetryCount(invoiceId);
      } else {
        await this.markAsFailed(invoiceId, [{ Code: 0, Msg: message }]);
      }

      return {
        success: false,
        invoiceId,
        error: message,
        processedAt: new Date(),
      };
    }
  }

  /**
   * Build AFIP invoice input from database row
   */
  private buildInvoiceInput(row: any): AFIPInvoiceInput {
    return {
      id: row.id,
      orgId: row.org_id,
      customerId: row.customer_id,
      customerCuit: row.customer_cuit || '0',
      customerDocType: row.customer_doc_type || AFIPDocumentType.CONSUMIDOR_FINAL,
      invoiceType: row.invoice_type || AFIPInvoiceType.FACTURA_B,
      puntoVenta: row.punto_venta || 1,
      concept: row.concept || AFIPConceptType.PRODUCTOS_Y_SERVICIOS,
      emissionDate: new Date(row.emission_date || row.created_at),
      subtotal: parseFloat(row.subtotal) || 0,
      taxAmount: parseFloat(row.tax_amount) || 0,
      total: parseFloat(row.total) || 0,
      ivaBreakdown: this.parseIVABreakdown(row.line_items),
      serviceStartDate: row.service_start_date ? new Date(row.service_start_date) : undefined,
      serviceEndDate: row.service_end_date ? new Date(row.service_end_date) : undefined,
      dueDate: row.due_date ? new Date(row.due_date) : undefined,
    };
  }

  /**
   * Parse IVA breakdown from line items
   */
  private parseIVABreakdown(lineItemsJson: string | any[]): AFIPInvoiceInput['ivaBreakdown'] {
    const lineItems = typeof lineItemsJson === 'string'
      ? JSON.parse(lineItemsJson)
      : lineItemsJson || [];

    // Group by tax rate
    const byRate = new Map<number, { base: number; amount: number }>();

    for (const item of lineItems) {
      const rate = parseFloat(item.taxRate) || 0.21;
      const base = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      const amount = base * rate;

      const existing = byRate.get(rate) || { base: 0, amount: 0 };
      byRate.set(rate, {
        base: existing.base + base,
        amount: existing.amount + amount,
      });
    }

    return Array.from(byRate.entries()).map(([rate, { base, amount }]) => ({
      rate,
      base: Math.round(base * 100) / 100,
      amount: Math.round(amount * 100) / 100,
    }));
  }

  /**
   * Increment retry count for invoice
   */
  private async incrementRetryCount(invoiceId: string): Promise<void> {
    await this.pool.query(
      `UPDATE invoices
       SET retry_count = COALESCE(retry_count, 0) + 1,
           updated_at = NOW()
       WHERE id = $1`,
      [invoiceId]
    );
  }

  /**
   * Mark invoice as failed
   */
  private async markAsFailed(invoiceId: string, errors: any[]): Promise<void> {
    await this.pool.query(
      `UPDATE invoices
       SET status = 'cae_failed',
           afip_response = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [invoiceId, JSON.stringify({ errors })]
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MANUAL OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Manually add an invoice to the queue
   */
  async enqueue(invoiceId: string): Promise<void> {
    await this.pool.query(
      `UPDATE invoices
       SET status = 'pending_cae',
           retry_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [invoiceId]
    );
  }

  /**
   * Get worker status
   */
  getStatus(): {
    running: boolean;
    activeJobs: number;
    panicMode: boolean;
    circuitState: string;
    availableRate: number;
  } {
    return {
      running: this.running,
      activeJobs: this.activeJobs,
      panicMode: this.fallbackHandler.getPanicState().active,
      circuitState: this.fallbackHandler.getCircuitState().state,
      availableRate: this.rateLimiter.getAvailable(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let worker: AFIPInvoiceWorker | null = null;

export function getAFIPWorker(pool: Pool, config?: WorkerConfig): AFIPInvoiceWorker {
  if (!worker) {
    worker = new AFIPInvoiceWorker(pool, config);
  }
  return worker;
}

export function resetAFIPWorker(): void {
  if (worker) {
    worker.stop();
    worker = null;
  }
}
