/**
 * MercadoPago Panic Controller
 * ============================
 *
 * Integrates MercadoPago payment processing with the panic mode system.
 * Monitors payment failures, rate limiting, and auth errors to trigger
 * automatic panic mode when critical thresholds are exceeded.
 *
 * Features:
 * - Automatic panic triggering based on failure rates
 * - Circuit breaker pattern for MercadoPago API
 * - Rate limiting detection and handling
 * - Authentication failure monitoring
 * - Manual payment fallback activation
 */

import {
  PanicModeService,
  IntegrationType,
  PanicReason,
  canProcessMessage,
} from '../whatsapp/panic-mode.service';
import { MPRetryStrategy, MPCircuitBreaker } from './mp-retry.strategy';
import { log } from '../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MPPanicConfig {
  /** Failure rate threshold to trigger panic (default: 0.3 = 30%) */
  failureRateThreshold: number;
  /** Minimum sample size before evaluating failure rate (default: 5) */
  minSampleSize: number;
  /** Time window for failure rate calculation in ms (default: 15 minutes) */
  windowMs: number;
  /** Auto-resolve timeout in minutes (default: 30) */
  autoResolveMinutes: number;
  /** Enable automatic panic mode (default: true) */
  enableAutoPanic: boolean;
}

export interface PaymentMetrics {
  total: number;
  successful: number;
  failed: number;
  rateLimited: number;
  authErrors: number;
  lastFailureAt?: Date;
  lastSuccessAt?: Date;
  windowStart: Date;
}

export interface PanicCheckResult {
  shouldPanic: boolean;
  reason?: PanicReason;
  message?: string;
  metrics?: PaymentMetrics;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: MPPanicConfig = {
  failureRateThreshold: 0.3,
  minSampleSize: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  autoResolveMinutes: 30,
  enableAutoPanic: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MP PANIC CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

export class MPPanicController {
  private config: MPPanicConfig;
  private circuitBreaker: MPCircuitBreaker;
  private metricsPerOrg: Map<string, PaymentMetrics> = new Map();

  constructor(config: Partial<MPPanicConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.circuitBreaker = new MPCircuitBreaker({
      failureThreshold: 5,
      openDurationMs: 30000, // 30 seconds
      halfOpenRequests: 3,
      successThreshold: 3,
    });
  }

  /**
   * Check if payment processing can proceed
   * Returns false if org is in panic mode or circuit is open
   */
  async canProcess(orgId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Check panic mode
    const inPanic = await PanicModeService.isInPanic(orgId, 'mercadopago');
    if (inPanic) {
      return {
        allowed: false,
        reason: 'MercadoPago integration is in panic mode',
      };
    }

    // Check circuit breaker
    if (this.circuitBreaker.getState().state === 'open') {
      return {
        allowed: false,
        reason: 'MercadoPago circuit breaker is open',
      };
    }

    return { allowed: true };
  }

  /**
   * Record a successful payment operation
   */
  async recordSuccess(orgId: string): Promise<void> {
    const metrics = this.getOrCreateMetrics(orgId);
    metrics.total++;
    metrics.successful++;
    metrics.lastSuccessAt = new Date();

    // Record with circuit breaker
    this.circuitBreaker.recordSuccess();

    log.debug('MP payment success recorded', {
      orgId,
      total: metrics.total,
      successRate: this.calculateSuccessRate(metrics),
    });
  }

  /**
   * Record a failed payment operation
   */
  async recordFailure(
    orgId: string,
    errorCode?: number,
    errorMessage?: string
  ): Promise<PanicCheckResult> {
    const metrics = this.getOrCreateMetrics(orgId);
    metrics.total++;
    metrics.failed++;
    metrics.lastFailureAt = new Date();

    // Classify error
    const isRateLimit = this.isRateLimitError(errorCode, errorMessage);
    const isAuthError = this.isAuthError(errorCode, errorMessage);

    if (isRateLimit) {
      metrics.rateLimited++;
    }
    if (isAuthError) {
      metrics.authErrors++;
    }

    // Record with circuit breaker
    this.circuitBreaker.recordFailure();

    log.warn('MP payment failure recorded', {
      orgId,
      errorCode,
      errorMessage,
      total: metrics.total,
      failureRate: this.calculateFailureRate(metrics),
      isRateLimit,
      isAuthError,
    });

    // Check if panic should be triggered
    return this.evaluatePanicConditions(orgId, metrics, errorCode, errorMessage);
  }

  /**
   * Evaluate if panic conditions are met
   */
  private async evaluatePanicConditions(
    orgId: string,
    metrics: PaymentMetrics,
    errorCode?: number,
    errorMessage?: string
  ): Promise<PanicCheckResult> {
    if (!this.config.enableAutoPanic) {
      return { shouldPanic: false };
    }

    // Refresh metrics window
    this.refreshMetricsWindow(orgId);
    const refreshedMetrics = this.getOrCreateMetrics(orgId);

    // Check sample size
    if (refreshedMetrics.total < this.config.minSampleSize) {
      return {
        shouldPanic: false,
        message: `Insufficient sample size (${refreshedMetrics.total}/${this.config.minSampleSize})`,
        metrics: refreshedMetrics,
      };
    }

    // Check for immediate panic triggers
    // Rate limiting - trigger immediately
    if (this.isRateLimitError(errorCode, errorMessage) && refreshedMetrics.rateLimited >= 2) {
      const result = await PanicModeService.evaluate(orgId, 'mercadopago', {
        errorCode,
        errorTitle: 'Rate limit exceeded',
      });

      if (result.triggered) {
        return {
          shouldPanic: true,
          reason: 'rate_limited',
          message: 'MercadoPago rate limit detected',
          metrics: refreshedMetrics,
        };
      }
    }

    // Auth failure - trigger immediately
    if (this.isAuthError(errorCode, errorMessage)) {
      const result = await PanicModeService.evaluate(orgId, 'mercadopago', {
        errorCode,
        errorTitle: 'Authentication failure',
      });

      if (result.triggered) {
        return {
          shouldPanic: true,
          reason: 'auth_failure',
          message: 'MercadoPago authentication failed',
          metrics: refreshedMetrics,
        };
      }
    }

    // Check failure rate threshold
    const failureRate = this.calculateFailureRate(refreshedMetrics);
    if (failureRate > this.config.failureRateThreshold) {
      const result = await PanicModeService.evaluate(orgId, 'mercadopago', {
        failureRate,
        totalMessages: refreshedMetrics.total,
        recentFailures: refreshedMetrics.failed,
      });

      if (result.triggered) {
        return {
          shouldPanic: true,
          reason: 'high_failure_rate',
          message: `Failure rate ${(failureRate * 100).toFixed(1)}% exceeds threshold`,
          metrics: refreshedMetrics,
        };
      }
    }

    return {
      shouldPanic: false,
      metrics: refreshedMetrics,
    };
  }

  /**
   * Get current metrics for an organization
   */
  getMetrics(orgId: string): PaymentMetrics | undefined {
    return this.metricsPerOrg.get(orgId);
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): 'closed' | 'open' | 'half-open' {
    return this.circuitBreaker.getState().state;
  }

  /**
   * Manually trigger panic mode
   */
  async forcePanic(orgId: string, reason: string): Promise<void> {
    await PanicModeService.trigger(orgId, 'mercadopago', 'manual', {
      reason,
      triggeredBy: 'MPPanicController.forcePanic',
    });

    log.warn('MP panic mode manually triggered', { orgId, reason });
  }

  /**
   * Resolve panic mode
   */
  async resolvePanic(orgId: string): Promise<void> {
    await PanicModeService.resolve(orgId, 'mercadopago', 'manual');

    // Reset metrics after resolution
    this.resetMetrics(orgId);
    this.circuitBreaker.reset();

    log.info('MP panic mode resolved', { orgId });
  }

  /**
   * Reset metrics for an organization
   */
  resetMetrics(orgId: string): void {
    this.metricsPerOrg.set(orgId, this.createEmptyMetrics());
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    this.metricsPerOrg.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private getOrCreateMetrics(orgId: string): PaymentMetrics {
    let metrics = this.metricsPerOrg.get(orgId);
    if (!metrics) {
      metrics = this.createEmptyMetrics();
      this.metricsPerOrg.set(orgId, metrics);
    }
    return metrics;
  }

  private createEmptyMetrics(): PaymentMetrics {
    return {
      total: 0,
      successful: 0,
      failed: 0,
      rateLimited: 0,
      authErrors: 0,
      windowStart: new Date(),
    };
  }

  private refreshMetricsWindow(orgId: string): void {
    const metrics = this.metricsPerOrg.get(orgId);
    if (!metrics) return;

    const now = Date.now();
    const windowStart = metrics.windowStart.getTime();

    // If window has expired, reset metrics
    if (now - windowStart > this.config.windowMs) {
      this.metricsPerOrg.set(orgId, this.createEmptyMetrics());
    }
  }

  private calculateFailureRate(metrics: PaymentMetrics): number {
    if (metrics.total === 0) return 0;
    return metrics.failed / metrics.total;
  }

  private calculateSuccessRate(metrics: PaymentMetrics): number {
    if (metrics.total === 0) return 1;
    return metrics.successful / metrics.total;
  }

  private isRateLimitError(errorCode?: number, errorMessage?: string): boolean {
    if (errorCode === 429) return true;
    if (errorCode === 503) return true;
    if (errorMessage?.toLowerCase().includes('rate limit')) return true;
    if (errorMessage?.toLowerCase().includes('too many requests')) return true;
    return false;
  }

  private isAuthError(errorCode?: number, errorMessage?: string): boolean {
    if (errorCode === 401) return true;
    if (errorCode === 403) return true;
    if (errorMessage?.toLowerCase().includes('unauthorized')) return true;
    if (errorMessage?.toLowerCase().includes('authentication')) return true;
    if (errorMessage?.toLowerCase().includes('invalid token')) return true;
    if (errorMessage?.toLowerCase().includes('expired token')) return true;
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let panicControllerInstance: MPPanicController | null = null;

/**
 * Get the global panic controller instance
 */
export function getMPPanicController(): MPPanicController {
  if (!panicControllerInstance) {
    panicControllerInstance = new MPPanicController();
  }
  return panicControllerInstance;
}

/**
 * Initialize panic controller with custom config
 */
export function initializeMPPanicController(config?: Partial<MPPanicConfig>): void {
  panicControllerInstance = new MPPanicController(config);
}

/**
 * Reset the panic controller (for testing)
 */
export function resetMPPanicController(): void {
  panicControllerInstance = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if MercadoPago operations can proceed for an organization
 */
export async function canProcessMPPayment(orgId: string): Promise<boolean> {
  const controller = getMPPanicController();
  const result = await controller.canProcess(orgId);
  return result.allowed;
}

/**
 * Record MP payment result for panic monitoring
 */
export async function recordMPPaymentResult(
  orgId: string,
  success: boolean,
  errorCode?: number,
  errorMessage?: string
): Promise<PanicCheckResult> {
  const controller = getMPPanicController();

  if (success) {
    await controller.recordSuccess(orgId);
    return { shouldPanic: false };
  }

  return controller.recordFailure(orgId, errorCode, errorMessage);
}
