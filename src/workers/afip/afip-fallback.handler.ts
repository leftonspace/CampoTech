/**
 * AFIP Fallback Handler
 * =====================
 *
 * Handles fallback scenarios when AFIP is unavailable.
 * Implements panic mode behavior.
 */

import { Pool } from 'pg';
import { AFIPCircuitBreaker, CircuitBreakerState } from './afip-retry.strategy';
import { log } from '../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// PANIC MODE
// ═══════════════════════════════════════════════════════════════════════════════

export interface PanicModeState {
  active: boolean;
  activatedAt: Date | null;
  reason: string | null;
  queueDepth: number;
  avgLatency: number;
}

export interface PanicModeConfig {
  /** Queue depth that triggers panic mode */
  queueDepthThreshold: number;
  /** Latency (ms) that triggers panic mode */
  latencyThreshold: number;
  /** Duration (ms) of low failures before auto-recovery */
  recoveryPeriod: number;
  /** Failure rate threshold for recovery (0-1) */
  recoveryFailureRate: number;
}

const DEFAULT_PANIC_CONFIG: PanicModeConfig = {
  queueDepthThreshold: 100,
  latencyThreshold: 300000,  // 5 minutes
  recoveryPeriod: 300000,    // 5 minutes
  recoveryFailureRate: 0.1,  // 10%
};

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export class AFIPFallbackHandler {
  private pool: Pool;
  private circuitBreaker: AFIPCircuitBreaker;
  private config: PanicModeConfig;
  private panicState: PanicModeState = {
    active: false,
    activatedAt: null,
    reason: null,
    queueDepth: 0,
    avgLatency: 0,
  };
  private metrics = {
    totalRequests: 0,
    failedRequests: 0,
    lastResetAt: new Date(),
  };

  constructor(
    pool: Pool,
    circuitBreaker: AFIPCircuitBreaker,
    config: PanicModeConfig = DEFAULT_PANIC_CONFIG
  ) {
    this.pool = pool;
    this.circuitBreaker = circuitBreaker;
    this.config = config;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PANIC MODE CONTROL
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if panic mode should be activated
   */
  async checkPanicConditions(): Promise<void> {
    // Get current queue metrics
    const queueMetrics = await this.getQueueMetrics();
    this.panicState.queueDepth = queueMetrics.depth;
    this.panicState.avgLatency = queueMetrics.avgLatency;

    // Get circuit breaker state
    const circuitState = this.circuitBreaker.getState();

    // Check panic conditions
    const shouldPanic = this.shouldActivatePanic(queueMetrics, circuitState);

    if (shouldPanic && !this.panicState.active) {
      this.activatePanicMode(this.getPanicReason(queueMetrics, circuitState));
    } else if (!shouldPanic && this.panicState.active) {
      // Check if we should recover
      if (this.shouldRecover()) {
        this.deactivatePanicMode();
      }
    }
  }

  /**
   * Determine if panic mode should activate
   */
  private shouldActivatePanic(
    queueMetrics: { depth: number; avgLatency: number },
    circuitState: CircuitBreakerState
  ): boolean {
    // Panic if queue depth exceeds threshold
    if (queueMetrics.depth > this.config.queueDepthThreshold) {
      return true;
    }

    // Panic if latency exceeds threshold
    if (queueMetrics.avgLatency > this.config.latencyThreshold) {
      return true;
    }

    // Panic if circuit breaker has been open for too long (15 minutes)
    if (circuitState.state === 'open' && circuitState.openedAt) {
      const openDuration = Date.now() - circuitState.openedAt.getTime();
      if (openDuration > 900000) {  // 15 minutes
        return true;
      }
    }

    return false;
  }

  /**
   * Get reason for panic activation
   */
  private getPanicReason(
    queueMetrics: { depth: number; avgLatency: number },
    circuitState: CircuitBreakerState
  ): string {
    const reasons: string[] = [];

    if (queueMetrics.depth > this.config.queueDepthThreshold) {
      reasons.push(`Queue depth: ${queueMetrics.depth}`);
    }
    if (queueMetrics.avgLatency > this.config.latencyThreshold) {
      reasons.push(`Latency: ${Math.round(queueMetrics.avgLatency / 1000)}s`);
    }
    if (circuitState.state === 'open') {
      reasons.push('Circuit breaker open');
    }

    return reasons.join(', ');
  }

  /**
   * Activate panic mode
   */
  activatePanicMode(reason: string): void {
    if (this.panicState.active) return;

    this.panicState.active = true;
    this.panicState.activatedAt = new Date();
    this.panicState.reason = reason;

    log.error('AFIP Panic Mode ACTIVATED', {
      reason,
      queueDepth: this.panicState.queueDepth,
      avgLatency: this.panicState.avgLatency,
    });

    // TODO: Emit event for monitoring/alerting
  }

  /**
   * Deactivate panic mode
   */
  deactivatePanicMode(): void {
    if (!this.panicState.active) return;

    const duration = this.panicState.activatedAt
      ? Date.now() - this.panicState.activatedAt.getTime()
      : 0;

    log.info('AFIP Panic Mode DEACTIVATED', {
      duration: Math.round(duration / 1000),
      previousReason: this.panicState.reason,
    });

    this.panicState = {
      active: false,
      activatedAt: null,
      reason: null,
      queueDepth: this.panicState.queueDepth,
      avgLatency: this.panicState.avgLatency,
    };

    // Reset metrics
    this.resetMetrics();
  }

  /**
   * Check if recovery conditions are met
   */
  private shouldRecover(): boolean {
    // Need a minimum recovery period
    if (!this.panicState.activatedAt) return true;

    const activeDuration = Date.now() - this.panicState.activatedAt.getTime();
    if (activeDuration < this.config.recoveryPeriod) {
      return false;
    }

    // Check failure rate is below threshold
    const failureRate = this.getFailureRate();
    return failureRate < this.config.recoveryFailureRate;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FALLBACK OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if AFIP requests are allowed
   */
  canMakeRequest(): boolean {
    // Check panic mode
    if (this.panicState.active) {
      return false;
    }

    // Check circuit breaker
    return this.circuitBreaker.canRequest();
  }

  /**
   * Create invoice as draft (fallback mode)
   */
  async createDraftInvoice(invoiceId: string, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE invoices
       SET status = 'draft',
           afip_response = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [invoiceId, JSON.stringify({ fallback: true, reason })]
    );

    log.info('Invoice saved as draft (fallback)', { invoiceId, reason });
  }

  /**
   * Queue invoice for retry
   */
  async queueForRetry(invoiceId: string, delayMs: number): Promise<void> {
    const retryAt = new Date(Date.now() + delayMs);

    await this.pool.query(
      `UPDATE invoices
       SET status = 'pending_cae',
           retry_at = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [invoiceId, retryAt]
    );

    log.info('Invoice queued for retry', { invoiceId, retryAt });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METRICS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Record a request result
   */
  recordRequest(success: boolean): void {
    this.metrics.totalRequests++;
    if (!success) {
      this.metrics.failedRequests++;
      this.circuitBreaker.recordFailure();
    } else {
      this.circuitBreaker.recordSuccess();
    }
  }

  /**
   * Get current failure rate
   */
  getFailureRate(): number {
    if (this.metrics.totalRequests === 0) return 0;
    return this.metrics.failedRequests / this.metrics.totalRequests;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      failedRequests: 0,
      lastResetAt: new Date(),
    };
  }

  /**
   * Get queue metrics from database
   */
  private async getQueueMetrics(): Promise<{ depth: number; avgLatency: number }> {
    try {
      const result = await this.pool.query(`
        SELECT
          COUNT(*) as depth,
          COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) * 1000), 0) as avg_latency
        FROM invoices
        WHERE status = 'pending_cae'
      `);

      return {
        depth: parseInt(result.rows[0].depth, 10),
        avgLatency: parseFloat(result.rows[0].avg_latency),
      };
    } catch {
      return { depth: 0, avgLatency: 0 };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get current panic state
   */
  getPanicState(): PanicModeState {
    return { ...this.panicState };
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): CircuitBreakerState {
    return this.circuitBreaker.getState();
  }

  /**
   * Force activate panic mode (manual trigger)
   */
  forceActivatePanic(reason: string = 'Manual activation'): void {
    this.activatePanicMode(reason);
  }

  /**
   * Force deactivate panic mode (manual trigger)
   */
  forceDeactivatePanic(): void {
    this.deactivatePanicMode();
    this.circuitBreaker.reset();
  }
}
