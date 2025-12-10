/**
 * Webhook Delivery Worker
 * ========================
 *
 * Background worker that processes webhook delivery queue.
 * Handles retries with exponential backoff.
 */

import { Pool } from 'pg';
import {
  WebhookDelivery,
  WebhookSubscription,
  DeliveryResult,
  RetryPolicy,
  DEFAULT_RETRY_POLICY,
  WebhookConfig,
  DEFAULT_WEBHOOK_CONFIG,
} from './webhook.types';
import { generateWebhookHeaders } from './webhook.signature';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WorkerStats {
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
  currentlyProcessing: number;
  isRunning: boolean;
  startedAt: Date | null;
  lastProcessedAt: Date | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK DELIVERY WORKER
// ═══════════════════════════════════════════════════════════════════════════════

export class WebhookDeliveryWorker {
  private isRunning: boolean = false;
  private pollTimeoutId: NodeJS.Timeout | null = null;
  private config: WebhookConfig;
  private stats: WorkerStats;
  private processingSet: Set<string> = new Set();

  constructor(
    private pool: Pool,
    config?: Partial<WebhookConfig>
  ) {
    this.config = { ...DEFAULT_WEBHOOK_CONFIG, ...config };
    this.stats = {
      totalProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      currentlyProcessing: 0,
      isRunning: false,
      startedAt: null,
      lastProcessedAt: null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Start the delivery worker
   */
  start(): void {
    if (this.isRunning) {
      console.log('[Webhook Worker] Already running');
      return;
    }

    console.log('[Webhook Worker] Starting...');
    this.isRunning = true;
    this.stats.isRunning = true;
    this.stats.startedAt = new Date();
    this.scheduleNextPoll();
  }

  /**
   * Stop the delivery worker
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[Webhook Worker] Already stopped');
      return;
    }

    console.log('[Webhook Worker] Stopping...');
    this.isRunning = false;
    this.stats.isRunning = false;

    if (this.pollTimeoutId) {
      clearTimeout(this.pollTimeoutId);
      this.pollTimeoutId = null;
    }
  }

  /**
   * Get worker statistics
   */
  getStats(): WorkerStats {
    return {
      ...this.stats,
      currentlyProcessing: this.processingSet.size,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POLLING
  // ─────────────────────────────────────────────────────────────────────────────

  private scheduleNextPoll(): void {
    if (!this.isRunning) return;

    this.pollTimeoutId = setTimeout(async () => {
      await this.processQueue();
      this.scheduleNextPoll();
    }, this.config.pollInterval);
  }

  private async processQueue(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Get pending deliveries
      const availableSlots = this.config.maxConcurrency - this.processingSet.size;
      if (availableSlots <= 0) return;

      const result = await this.pool.query(
        `SELECT d.*, w.url, w.secret, w.headers as webhook_headers, w.retry_policy
         FROM webhook_deliveries d
         JOIN webhooks w ON d.webhook_id = w.id
         WHERE d.status = 'pending'
           AND (d.next_retry_at IS NULL OR d.next_retry_at <= NOW())
           AND d.id NOT IN (SELECT unnest($1::uuid[]))
         ORDER BY d.created_at ASC
         LIMIT $2`,
        [Array.from(this.processingSet), availableSlots]
      );

      if (result.rows.length === 0) return;

      // Process deliveries concurrently
      const promises = result.rows.map(row => this.processDelivery(row));
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('[Webhook Worker] Error processing queue:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DELIVERY PROCESSING
  // ─────────────────────────────────────────────────────────────────────────────

  private async processDelivery(row: any): Promise<void> {
    const deliveryId = row.id;

    if (this.processingSet.has(deliveryId)) return;
    this.processingSet.add(deliveryId);

    try {
      const webhook: Partial<WebhookSubscription> = {
        id: row.webhook_id,
        url: row.url,
        secret: row.secret,
        headers: row.webhook_headers,
        retry_policy: row.retry_policy || DEFAULT_RETRY_POLICY,
      };

      const payload = row.request_body;

      // Attempt delivery
      const result = await this.attemptDelivery(
        webhook as WebhookSubscription,
        payload
      );

      // Update delivery record
      await this.updateDeliveryResult(deliveryId, row, webhook, result);

      this.stats.totalProcessed++;
      this.stats.lastProcessedAt = new Date();

      if (result.success) {
        this.stats.totalSuccessful++;
      }
    } catch (error) {
      console.error(`[Webhook Worker] Error processing delivery ${deliveryId}:`, error);
      this.stats.totalFailed++;
    } finally {
      this.processingSet.delete(deliveryId);
    }
  }

  private async attemptDelivery(
    webhook: WebhookSubscription,
    payload: any
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      // Generate signature and headers
      const headers = generateWebhookHeaders(
        webhook.id,
        payload,
        webhook.secret,
        webhook.headers
      );

      // Make request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const duration = Date.now() - startTime;
        const responseBody = await response.text();
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // Consider 2xx responses as success
        const success = response.status >= 200 && response.status < 300;

        return {
          success,
          statusCode: response.status,
          duration,
          responseBody: this.truncatePayload(responseBody),
          responseHeaders,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        duration,
        error: error.name === 'AbortError' ? 'Request timeout' : error.message,
      };
    }
  }

  private async updateDeliveryResult(
    deliveryId: string,
    row: any,
    webhook: Partial<WebhookSubscription>,
    result: DeliveryResult
  ): Promise<void> {
    const newAttempts = (row.attempts || 0) + 1;
    const retryPolicy = webhook.retry_policy || DEFAULT_RETRY_POLICY;

    if (result.success) {
      // Mark as delivered
      await this.pool.query(
        `UPDATE webhook_deliveries
         SET status = 'delivered',
             response_status = $1,
             response_headers = $2,
             response_body = $3,
             attempts = $4,
             delivered_at = NOW(),
             duration_ms = $5,
             request_headers = $6
         WHERE id = $7`,
        [
          result.statusCode,
          result.responseHeaders ? JSON.stringify(result.responseHeaders) : null,
          result.responseBody,
          newAttempts,
          result.duration,
          JSON.stringify(generateWebhookHeaders(webhook.id!, row.request_body, webhook.secret!, webhook.headers)),
          deliveryId,
        ]
      );

      // Update webhook stats
      await this.pool.query(
        `UPDATE webhooks
         SET total_deliveries = COALESCE(total_deliveries, 0) + 1,
             successful_deliveries = COALESCE(successful_deliveries, 0) + 1,
             last_delivery_at = NOW(),
             last_delivery_status = 'delivered'
         WHERE id = $1`,
        [webhook.id]
      );
    } else {
      // Check if we should retry
      const shouldRetry = newAttempts < retryPolicy.max_attempts;

      if (shouldRetry) {
        // Calculate next retry time with exponential backoff
        const delay = this.calculateRetryDelay(newAttempts, retryPolicy);
        const nextRetryAt = new Date(Date.now() + delay);

        await this.pool.query(
          `UPDATE webhook_deliveries
           SET response_status = $1,
               response_headers = $2,
               response_body = $3,
               attempts = $4,
               next_retry_at = $5,
               duration_ms = $6,
               error = $7,
               request_headers = $8
           WHERE id = $9`,
          [
            result.statusCode || null,
            result.responseHeaders ? JSON.stringify(result.responseHeaders) : null,
            result.responseBody || null,
            newAttempts,
            nextRetryAt,
            result.duration,
            result.error || null,
            JSON.stringify(generateWebhookHeaders(webhook.id!, row.request_body, webhook.secret!, webhook.headers)),
            deliveryId,
          ]
        );
      } else {
        // Mark as permanently failed
        await this.pool.query(
          `UPDATE webhook_deliveries
           SET status = 'failed',
               response_status = $1,
               response_headers = $2,
               response_body = $3,
               attempts = $4,
               duration_ms = $5,
               error = $6,
               request_headers = $7
           WHERE id = $8`,
          [
            result.statusCode || null,
            result.responseHeaders ? JSON.stringify(result.responseHeaders) : null,
            result.responseBody || null,
            newAttempts,
            result.duration,
            result.error || `Failed after ${newAttempts} attempts`,
            JSON.stringify(generateWebhookHeaders(webhook.id!, row.request_body, webhook.secret!, webhook.headers)),
            deliveryId,
          ]
        );

        // Update webhook stats
        await this.pool.query(
          `UPDATE webhooks
           SET total_deliveries = COALESCE(total_deliveries, 0) + 1,
               failed_deliveries = COALESCE(failed_deliveries, 0) + 1,
               last_delivery_at = NOW(),
               last_delivery_status = 'failed'
           WHERE id = $1`,
          [webhook.id]
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private calculateRetryDelay(attempt: number, policy: RetryPolicy): number {
    // Exponential backoff with jitter
    const baseDelay = policy.initial_delay_ms * Math.pow(policy.backoff_multiplier, attempt - 1);
    const cappedDelay = Math.min(baseDelay, policy.max_delay_ms);

    // Add jitter (up to 20% variance)
    const jitter = cappedDelay * 0.2 * Math.random();
    return Math.floor(cappedDelay + jitter);
  }

  private truncatePayload(payload: string): string {
    if (payload.length <= this.config.maxLoggedPayloadSize) {
      return payload;
    }
    return payload.substring(0, this.config.maxLoggedPayloadSize) + '... [truncated]';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MANUAL OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Manually retry a failed delivery
   */
  async retryDelivery(deliveryId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE webhook_deliveries
       SET status = 'pending', next_retry_at = NOW()
       WHERE id = $1 AND status = 'failed'
       RETURNING id`,
      [deliveryId]
    );

    return result.rows.length > 0;
  }

  /**
   * Process a specific delivery immediately
   */
  async processDeliveryNow(deliveryId: string): Promise<DeliveryResult | null> {
    const result = await this.pool.query(
      `SELECT d.*, w.url, w.secret, w.headers as webhook_headers, w.retry_policy
       FROM webhook_deliveries d
       JOIN webhooks w ON d.webhook_id = w.id
       WHERE d.id = $1`,
      [deliveryId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const webhook: Partial<WebhookSubscription> = {
      id: row.webhook_id,
      url: row.url,
      secret: row.secret,
      headers: row.webhook_headers,
      retry_policy: row.retry_policy || DEFAULT_RETRY_POLICY,
    };

    const deliveryResult = await this.attemptDelivery(
      webhook as WebhookSubscription,
      row.request_body
    );

    await this.updateDeliveryResult(deliveryId, row, webhook, deliveryResult);

    return deliveryResult;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createWebhookWorker(
  pool: Pool,
  config?: Partial<WebhookConfig>
): WebhookDeliveryWorker {
  return new WebhookDeliveryWorker(pool, config);
}
