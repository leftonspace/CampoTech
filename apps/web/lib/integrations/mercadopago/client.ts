/**
 * MercadoPago Resilient Client
 * ============================
 *
 * Wrapper around MercadoPago API with circuit breaker and fallback support.
 * Provides resilient payment processing with automatic fallback to manual methods.
 */

import {
  MPClientOptions,
  DEFAULT_MP_CLIENT_OPTIONS,
  MPServiceStatus,
  MPSystemStatus,
  FallbackDecision,
  ManualPaymentInstructions,
  FallbackPaymentRecord,
  CreatePreferenceRequest,
  PreferenceResponse,
  Payment,
  WebhookNotification,
  MPError,
  classifyMPError,
} from './types';
import {
  MPCircuitBreaker,
  getMPCircuitBreaker,
  executeWithResilience,
  CircuitOpenError,
} from './circuit-breaker';
import {
  MPFallbackHandler,
  getMPFallbackHandler,
  formatInstructionsForWhatsApp,
  formatInstructionsForEmail,
} from './fallback';

// ═══════════════════════════════════════════════════════════════════════════════
// RESILIENT CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export class MPResilientClient {
  private circuitBreaker: MPCircuitBreaker;
  private fallbackHandler: MPFallbackHandler;
  private options: Required<MPClientOptions>;
  private latencies: number[] = [];
  private maxLatencySamples = 100;

  constructor(options: MPClientOptions = {}) {
    this.options = {
      ...DEFAULT_MP_CLIENT_OPTIONS,
      ...options,
      circuitBreaker: {
        ...DEFAULT_MP_CLIENT_OPTIONS.circuitBreaker,
        ...options.circuitBreaker,
      },
      fallbackInstructions: {
        ...DEFAULT_MP_CLIENT_OPTIONS.fallbackInstructions,
        ...options.fallbackInstructions,
      },
    };

    this.circuitBreaker = getMPCircuitBreaker();
    this.fallbackHandler = getMPFallbackHandler();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PREFERENCE CREATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create payment preference with resilience
   */
  async createPreference(
    organizationId: string,
    accessToken: string,
    request: CreatePreferenceRequest
  ): Promise<
    | { success: true; preference: PreferenceResponse }
    | { success: false; fallback: FallbackDecision; instructions: ManualPaymentInstructions }
  > {
    // Check if we should fallback first
    const decision = await this.fallbackHandler.shouldFallback(organizationId);
    if (decision.shouldFallback) {
      if (this.options.debug) {
        console.log('[MP Client] Pre-emptive fallback:', decision.reason);
      }
      const instructions = await this.fallbackHandler.getPaymentInstructions(
        organizationId,
        'transfer'
      );
      return { success: false, fallback: decision, instructions };
    }

    try {
      const startTime = Date.now();

      const preference = await executeWithResilience(
        this.circuitBreaker,
        async () => {
          const response = await this.fetchMP<PreferenceResponse>(
            accessToken,
            'POST',
            '/checkout/preferences',
            request
          );
          return response;
        },
        {
          onCircuitOpen: () => {
            console.warn('[MP Client] Circuit breaker opened');
          },
        }
      );

      this.recordLatency(Date.now() - startTime);
      return { success: true, preference };
    } catch (error) {
      if (this.options.debug) {
        console.error('[MP Client] Create preference failed:', error);
      }

      if (this.options.autoFallback) {
        const instructions = await this.fallbackHandler.getPaymentInstructions(
          organizationId,
          'transfer'
        );

        const fallback: FallbackDecision = {
          shouldFallback: true,
          reason:
            error instanceof CircuitOpenError ? 'circuit_open' : 'api_unavailable',
          message:
            error instanceof Error
              ? error.message
              : 'Error al procesar el pago',
          suggestedActions: ['Usar pago por transferencia'],
          retryAfter:
            error instanceof CircuitOpenError && error.retryAt
              ? error.retryAt.getTime() - Date.now()
              : undefined,
        };

        return { success: false, fallback, instructions };
      }

      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PAYMENT QUERIES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get payment by ID with resilience
   */
  async getPayment(
    accessToken: string,
    paymentId: string
  ): Promise<Payment | null> {
    try {
      return await executeWithResilience(this.circuitBreaker, async () => {
        return this.fetchMP<Payment>(accessToken, 'GET', `/v1/payments/${paymentId}`);
      });
    } catch (error) {
      if (this.options.debug) {
        console.error('[MP Client] Get payment failed:', error);
      }
      return null;
    }
  }

  /**
   * Search payments with resilience
   */
  async searchPayments(
    accessToken: string,
    params: {
      external_reference?: string;
      status?: string;
      begin_date?: string;
      end_date?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ results: Payment[]; paging: { total: number; limit: number; offset: number } } | null> {
    try {
      return await executeWithResilience(this.circuitBreaker, async () => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, String(value));
          }
        });

        return this.fetchMP(
          accessToken,
          'GET',
          `/v1/payments/search?${queryParams.toString()}`
        );
      });
    } catch (error) {
      if (this.options.debug) {
        console.error('[MP Client] Search payments failed:', error);
      }
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WEBHOOK HANDLING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Validate webhook notification
   */
  validateWebhook(
    notification: WebhookNotification,
    signature?: string,
    secretKey?: string
  ): boolean {
    // Basic validation
    if (!notification.type || !notification.data?.id) {
      return false;
    }

    // TODO: Implement signature verification when secretKey is provided
    if (signature && secretKey) {
      // HMAC-SHA256 verification would go here
      console.log('[MP Client] Webhook signature verification not yet implemented');
    }

    return true;
  }

  /**
   * Process webhook notification
   */
  async processWebhook(
    accessToken: string,
    notification: WebhookNotification
  ): Promise<Payment | null> {
    if (notification.type === 'payment' && notification.data?.id) {
      return this.getPayment(accessToken, notification.data.id);
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FALLBACK OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create fallback payment record
   */
  async createFallbackPayment(params: {
    organizationId: string;
    invoiceId: string;
    customerId: string;
    amount: number;
    reason: 'api_unavailable' | 'circuit_open' | 'panic_mode' | 'max_retries' | 'auth_failure' | 'rate_limited' | 'timeout' | 'config_missing';
    originalError?: string;
  }): Promise<FallbackPaymentRecord> {
    return this.fallbackHandler.createFallbackPayment(params);
  }

  /**
   * Get payment instructions for fallback
   */
  async getPaymentInstructions(
    organizationId: string,
    method: 'transfer' | 'cash' | 'card_present' = 'transfer'
  ): Promise<ManualPaymentInstructions> {
    return this.fallbackHandler.getPaymentInstructions(organizationId, method);
  }

  /**
   * Format instructions for WhatsApp
   */
  formatForWhatsApp(
    instructions: ManualPaymentInstructions,
    invoiceNumber?: string,
    amount?: number
  ): string {
    return formatInstructionsForWhatsApp(instructions, invoiceNumber, amount);
  }

  /**
   * Format instructions for email
   */
  formatForEmail(
    instructions: ManualPaymentInstructions,
    invoiceNumber?: string,
    amount?: number
  ): { subject: string; body: string } {
    return formatInstructionsForEmail(instructions, invoiceNumber, amount);
  }

  /**
   * Resolve a fallback payment
   */
  async resolveFallback(
    fallbackId: string,
    resolution: {
      resolvedBy: string;
      resolvedMethod: string;
      notes?: string;
    }
  ): Promise<FallbackPaymentRecord | null> {
    return this.fallbackHandler.resolveFallback(fallbackId, resolution);
  }

  /**
   * Get pending fallbacks
   */
  async getPendingFallbacks(organizationId: string): Promise<FallbackPaymentRecord[]> {
    return this.fallbackHandler.getPendingFallbacks(organizationId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get service status
   */
  async getServiceStatus(organizationId?: string): Promise<MPServiceStatus> {
    const status = await this.fallbackHandler.getServiceStatus(organizationId);
    return {
      ...status,
      avgLatency: this.getAverageLatency(),
    };
  }

  /**
   * Get full system status
   */
  async getSystemStatus(organizationId: string): Promise<MPSystemStatus> {
    const service = await this.getServiceStatus(organizationId);

    // Check configuration
    let configured = false;
    let tokenValid = false;
    let tokenExpiresAt: Date | null = null;

    try {
      const { prisma } = await import('@/lib/prisma');
      const settings = await prisma.organizationSettings.findFirst({
        where: { organizationId },
        select: {
          mercadoPagoAccessToken: true,
          mercadoPagoEnabled: true,
          mercadoPagoRefreshToken: true,
          mercadoPagoTokenExpiresAt: true,
        },
      });

      if (settings) {
        configured = !!(settings.mercadoPagoAccessToken && settings.mercadoPagoEnabled);
        tokenValid = configured && (
          !settings.mercadoPagoTokenExpiresAt ||
          new Date(settings.mercadoPagoTokenExpiresAt) > new Date()
        );
        tokenExpiresAt = settings.mercadoPagoTokenExpiresAt
          ? new Date(settings.mercadoPagoTokenExpiresAt)
          : null;
      }
    } catch {
      // Configuration check failed
    }

    return {
      service,
      configured,
      tokenValid,
      tokenExpiresAt,
      lastWebhook: null, // Would need webhook tracking
      updatedAt: new Date(),
    };
  }

  /**
   * Check if service is healthy
   */
  isHealthy(): boolean {
    return this.circuitBreaker.canRequest();
  }

  /**
   * Force circuit state (admin only)
   */
  forceCircuitState(state: 'closed' | 'open' | 'half-open'): void {
    this.circuitBreaker.forceState(state);
  }

  /**
   * Reset circuit breaker
   */
  resetCircuit(): void {
    this.circuitBreaker.reset();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INTERNAL METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Make authenticated request to MercadoPago API
   */
  private async fetchMP<T>(
    accessToken: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(`https://api.mercadopago.com${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error: MPError = {
          code: errorData.error || String(response.status),
          status: response.status,
          message: errorData.message || response.statusText,
          cause: errorData.cause || [],
        };

        const classification = classifyMPError(error);
        throw new MPAPIError(error.message, error.status, classification);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof MPAPIError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new MPAPIError('Request timeout', 408, 'timeout');
      }

      throw new MPAPIError(
        error instanceof Error ? error.message : 'Unknown error',
        500,
        'unknown'
      );
    }
  }

  /**
   * Record latency for monitoring
   */
  private recordLatency(latency: number): void {
    this.latencies.push(latency);
    if (this.latencies.length > this.maxLatencySamples) {
      this.latencies.shift();
    }
  }

  /**
   * Get average latency
   */
  private getAverageLatency(): number {
    if (this.latencies.length === 0) return 0;
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencies.length);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class MPAPIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly type: string
  ) {
    super(message);
    this.name = 'MPAPIError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let resilientClient: MPResilientClient | null = null;

export function getMPClient(options?: MPClientOptions): MPResilientClient {
  if (!resilientClient) {
    resilientClient = new MPResilientClient(options);
  }
  return resilientClient;
}

export function resetMPClient(): void {
  resilientClient = null;
}
