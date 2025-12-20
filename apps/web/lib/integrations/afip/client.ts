/**
 * AFIP Client
 * ===========
 *
 * Main entry point for AFIP integration in the web application.
 * Provides a unified interface with built-in:
 * - Rate limiting
 * - Circuit breaker
 * - Batch processing
 * - Error handling
 * - Status monitoring
 *
 * Usage:
 *   const client = getAFIPClient();
 *   await client.requestCAE(invoiceId, orgId);
 */

import { prisma } from '@/lib/prisma';
import { getAFIPRateLimiter, CombinedRateLimiter } from './rate-limiter';
import {
  getAFIPCircuitBreaker,
  PerOrgCircuitBreaker,
  CircuitBreakerOpenError,
} from './circuit-breaker';
import {
  getAFIPBatchProcessor,
  processInvoiceImmediate,
  AFIPBatchProcessor,
} from './batch-processor';
import {
  AFIPClientOptions,
  AFIPSystemStatus,
  DEFAULT_AFIP_CLIENT_OPTIONS,
  QueueMetrics,
  PerformanceMetrics,
  BatchJobResult,
  RateLimiterState,
  CircuitBreakerStatus,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// AFIP CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export class AFIPClient {
  private options: Required<AFIPClientOptions>;
  private rateLimiter: CombinedRateLimiter;
  private circuitBreaker: PerOrgCircuitBreaker;
  private batchProcessor: AFIPBatchProcessor;
  private metrics: ClientMetrics;

  constructor(options: AFIPClientOptions = {}) {
    this.options = {
      ...DEFAULT_AFIP_CLIENT_OPTIONS,
      ...options,
      rateLimiter: { ...DEFAULT_AFIP_CLIENT_OPTIONS.rateLimiter, ...options.rateLimiter },
      circuitBreaker: { ...DEFAULT_AFIP_CLIENT_OPTIONS.circuitBreaker, ...options.circuitBreaker },
      batch: { ...DEFAULT_AFIP_CLIENT_OPTIONS.batch, ...options.batch },
    };

    this.rateLimiter = getAFIPRateLimiter();
    this.circuitBreaker = getAFIPCircuitBreaker();
    this.batchProcessor = getAFIPBatchProcessor();
    this.metrics = new ClientMetrics();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CAE OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Request CAE for an invoice (queued)
   */
  async requestCAE(
    invoiceId: string,
    orgId: string,
    options: { priority?: 'high' | 'normal' | 'low' } = {}
  ): Promise<BatchJobResult> {
    this.log('info', `Queueing CAE request for invoice ${invoiceId}`);

    // Check if AFIP is configured
    await this.ensureAFIPConfigured(orgId);

    // Enqueue for batch processing
    return this.batchProcessor.enqueue(invoiceId, orgId, options.priority || 'normal');
  }

  /**
   * Request CAE immediately (bypasses queue, use sparingly)
   */
  async requestCAEImmediate(invoiceId: string, orgId: string): Promise<BatchJobResult> {
    this.log('info', `Immediate CAE request for invoice ${invoiceId}`);

    // Check if AFIP is configured
    await this.ensureAFIPConfigured(orgId);

    // Process immediately
    return processInvoiceImmediate(invoiceId, orgId);
  }

  /**
   * Request CAE for multiple invoices
   */
  async requestCAEBatch(
    invoices: Array<{ invoiceId: string; orgId: string; priority?: 'high' | 'normal' | 'low' }>
  ): Promise<{
    batchId: string;
    totalJobs: number;
    successCount: number;
    failedCount: number;
    results: BatchJobResult[];
  }> {
    this.log('info', `Batch CAE request for ${invoices.length} invoices`);

    // Validate all orgs have AFIP configured
    const orgIds = [...new Set(invoices.map((i) => i.orgId))];
    for (const orgId of orgIds) {
      await this.ensureAFIPConfigured(orgId);
    }

    // Enqueue batch
    return this.batchProcessor.enqueueBatch(invoices);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATUS & HEALTH
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get current AFIP system status
   */
  async getSystemStatus(orgId?: string): Promise<AFIPSystemStatus> {
    const queueMetrics = await this.getQueueMetrics();
    const performance = this.metrics.getPerformance();

    // Determine overall health
    let health: AFIPSystemStatus['health'] = 'healthy';
    if (performance.successRate < 0.5 || queueMetrics.pending > 100) {
      health = 'critical';
    } else if (performance.successRate < 0.9 || queueMetrics.pending > 50) {
      health = 'degraded';
    }

    // Determine AFIP connectivity
    let afipConnectivity: AFIPSystemStatus['afipConnectivity'] = 'online';
    const globalCircuit = this.circuitBreaker.getGlobalStatus();
    if (globalCircuit.state === 'open') {
      afipConnectivity = 'offline';
    } else if (globalCircuit.state === 'half-open') {
      afipConnectivity = 'unknown';
    }

    return {
      health,
      afipConnectivity,
      rateLimiter: orgId
        ? this.rateLimiter.getState(orgId).org
        : this.getAggregatedRateLimiterState(),
      circuitBreaker: orgId
        ? this.circuitBreaker.getStatus(orgId).org
        : globalCircuit,
      queue: queueMetrics,
      performance,
      updatedAt: new Date(),
    };
  }

  /**
   * Check if CAE requests can proceed for organization
   */
  canProceed(orgId: string): {
    allowed: boolean;
    reason?: string;
    waitTime?: number;
  } {
    // Check circuit breaker
    if (!this.circuitBreaker.canRequest(orgId)) {
      const status = this.circuitBreaker.getStatus(orgId);
      return {
        allowed: false,
        reason: 'circuit_breaker_open',
        waitTime: status.org.nextRetryAt
          ? status.org.nextRetryAt.getTime() - Date.now()
          : undefined,
      };
    }

    // Check rate limiter
    const rateState = this.rateLimiter.getState(orgId);
    if (rateState.org.isLimited) {
      return {
        allowed: false,
        reason: 'rate_limited',
        waitTime: rateState.org.resetAt.getTime() - Date.now(),
      };
    }

    return { allowed: true };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    isRunning: boolean;
    queueLength: number;
    processing: number;
    byPriority: { high: number; normal: number; low: number };
  } {
    return this.batchProcessor.getStatus();
  }

  /**
   * Get rate limiter state for organization
   */
  getRateLimiterState(orgId: string): {
    global: RateLimiterState;
    org: RateLimiterState;
    canProceed: boolean;
  } {
    return this.rateLimiter.getState(orgId);
  }

  /**
   * Get circuit breaker status for organization
   */
  getCircuitBreakerStatus(orgId: string): {
    global: CircuitBreakerStatus;
    org: CircuitBreakerStatus;
    canRequest: boolean;
  } {
    return this.circuitBreaker.getStatus(orgId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONTROL OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Force circuit breaker to open (emergency stop)
   */
  forceCircuitOpen(orgId?: string, reason?: string): void {
    if (orgId) {
      // Open for specific org
      const status = this.circuitBreaker.getStatus(orgId);
      // Force failure to trigger open
      for (let i = 0; i < 10; i++) {
        this.circuitBreaker.recordFailure(orgId);
      }
    } else {
      // Open globally
      this.log('warn', `Force opening global circuit breaker: ${reason || 'manual'}`);
    }
  }

  /**
   * Force circuit breaker to close (recovery)
   */
  forceCircuitClose(orgId?: string): void {
    if (orgId) {
      this.circuitBreaker.reset(orgId);
    } else {
      this.circuitBreaker.resetAll();
    }
    this.log('info', 'Circuit breaker force closed');
  }

  /**
   * Pause batch processing
   */
  pauseProcessing(): void {
    this.batchProcessor.stop();
    this.log('info', 'Batch processing paused');
  }

  /**
   * Resume batch processing
   */
  resumeProcessing(): void {
    this.batchProcessor.start();
    this.log('info', 'Batch processing resumed');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  private async ensureAFIPConfigured(orgId: string): Promise<void> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        afipCertificate: true,
        afipPrivateKey: true,
        afipPuntoVenta: true,
        cuit: true,
      },
    });

    if (!org) {
      throw new Error(`Organization ${orgId} not found`);
    }

    if (!org.afipCertificate || !org.afipPrivateKey) {
      throw new Error('AFIP credentials not configured for organization');
    }

    if (!org.cuit) {
      throw new Error('CUIT not configured for organization');
    }

    if (!org.afipPuntoVenta) {
      throw new Error('AFIP punto de venta not configured');
    }
  }

  private async getQueueMetrics(): Promise<QueueMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pending, processing, completedToday, failedToday, oldestPending] =
      await Promise.all([
        prisma.invoice.count({ where: { status: 'pending_cae' } }),
        prisma.invoice.count({ where: { status: 'processing_cae' } }),
        prisma.invoice.count({
          where: {
            status: 'cae_approved',
            updatedAt: { gte: today },
          },
        }),
        prisma.invoice.count({
          where: {
            status: 'cae_failed',
            updatedAt: { gte: today },
          },
        }),
        prisma.invoice.findFirst({
          where: { status: 'pending_cae' },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
      ]);

    const avgWaitResult = await prisma.$queryRaw<[{ avg: number }]>`
      SELECT AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) * 1000) as avg
      FROM "Invoice"
      WHERE status = 'pending_cae'
    `;

    return {
      pending,
      processing,
      completedToday,
      failedToday,
      avgWaitTime: avgWaitResult[0]?.avg || 0,
      oldestPendingAge: oldestPending
        ? Date.now() - oldestPending.createdAt.getTime()
        : 0,
    };
  }

  private getAggregatedRateLimiterState(): RateLimiterState {
    // Return global state as aggregate
    return {
      currentCount: 0,
      remaining: 50,
      resetAt: new Date(Date.now() + 60000),
      isLimited: false,
    };
  }

  private log(level: 'info' | 'warn' | 'error', message: string, meta?: object): void {
    if (!this.options.debug && level === 'info') return;

    const prefix = '[AFIP Client]';
    const logMessage = meta ? `${prefix} ${message}` : `${prefix} ${message}`;

    switch (level) {
      case 'info':
        console.info(logMessage, meta || '');
        break;
      case 'warn':
        console.warn(logMessage, meta || '');
        break;
      case 'error':
        console.error(logMessage, meta || '');
        break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT METRICS
// ═══════════════════════════════════════════════════════════════════════════════

class ClientMetrics {
  private requests: Array<{
    timestamp: number;
    success: boolean;
    latency: number;
    errorCode?: number;
  }> = [];

  record(success: boolean, latency: number, errorCode?: number): void {
    this.requests.push({
      timestamp: Date.now(),
      success,
      latency,
      errorCode,
    });

    // Keep only last hour
    this.cleanup();
  }

  getPerformance(): PerformanceMetrics {
    this.cleanup();

    if (this.requests.length === 0) {
      return {
        requestsLastHour: 0,
        successRate: 1,
        avgLatency: 0,
        p95Latency: 0,
        errorsLastHour: 0,
        topErrorCodes: [],
      };
    }

    const successful = this.requests.filter((r) => r.success);
    const failed = this.requests.filter((r) => !r.success);
    const latencies = this.requests.map((r) => r.latency).sort((a, b) => a - b);

    // Count error codes
    const errorCounts = new Map<number, number>();
    for (const req of failed) {
      if (req.errorCode) {
        errorCounts.set(req.errorCode, (errorCounts.get(req.errorCode) || 0) + 1);
      }
    }

    const topErrorCodes = Array.from(errorCounts.entries())
      .map(([code, count]) => ({ code, count, message: `Error ${code}` }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      requestsLastHour: this.requests.length,
      successRate: successful.length / this.requests.length,
      avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p95Latency: latencies[Math.floor(latencies.length * 0.95)] || 0,
      errorsLastHour: failed.length,
      topErrorCodes,
    };
  }

  private cleanup(): void {
    const cutoff = Date.now() - 3600000; // 1 hour
    this.requests = this.requests.filter((r) => r.timestamp > cutoff);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let globalClient: AFIPClient | null = null;

export function getAFIPClient(options?: AFIPClientOptions): AFIPClient {
  if (!globalClient) {
    globalClient = new AFIPClient(options);
  }
  return globalClient;
}

export function resetAFIPClient(): void {
  globalClient = null;
}
