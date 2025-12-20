/**
 * MercadoPago Integration Module
 * ==============================
 *
 * Resilient MercadoPago integration with circuit breaker and fallback support.
 *
 * Usage:
 *   import { getMPClient, getMPFallbackHandler } from '@/lib/integrations/mercadopago';
 *
 * Components:
 * - MPResilientClient: Main client with circuit breaker
 * - MPCircuitBreaker: Circuit breaker for MP API
 * - MPFallbackHandler: Handles fallback to manual payments
 */

// Client
export {
  MPResilientClient,
  MPAPIError,
  getMPClient,
  resetMPClient,
} from './client';

// Circuit breaker
export {
  MPCircuitBreaker,
  CircuitOpenError,
  getMPCircuitBreaker,
  resetMPCircuitBreaker,
  executeWithResilience,
  retryWithBackoff,
  isRetryableError,
  calculateRetryDelay,
  DEFAULT_RETRY_CONFIG,
} from './circuit-breaker';

// Fallback handler
export {
  MPFallbackHandler,
  getMPFallbackHandler,
  resetMPFallbackHandler,
  formatInstructionsForWhatsApp,
  formatInstructionsForEmail,
} from './fallback';

// Types
export type {
  // Circuit breaker types
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  // Fallback types
  FallbackReason,
  FallbackDecision,
  ManualPaymentInstructions,
  FallbackPaymentRecord,
  // Client options
  MPClientOptions,
  // Status types
  MPServiceStatus,
  MPSystemStatus,
  // Re-exported core types
  MPEnvironment,
  MPConfig,
  MPCredentials,
  PaymentMethodType,
  PaymentMethodId,
  PaymentStatus,
  Payment,
  PreferenceItem,
  PreferencePayer,
  PreferenceBackUrls,
  CreatePreferenceRequest,
  PreferenceResponse,
  WebhookNotification,
  MPError,
  MPErrorType,
} from './types';

export {
  DEFAULT_CIRCUIT_CONFIG,
  DEFAULT_MP_CLIENT_OPTIONS,
  MP_API_BASE_URL,
  MP_AUTH_URL,
  MP_ERROR_CODES,
  classifyMPError,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

import { getMPClient } from './client';
import { getMPFallbackHandler } from './fallback';
import { getMPCircuitBreaker } from './circuit-breaker';
import type { CreatePreferenceRequest, ManualPaymentInstructions } from './types';

/**
 * Create payment with automatic fallback
 * Returns either a preference URL or manual payment instructions
 */
export async function createPaymentWithFallback(
  organizationId: string,
  accessToken: string,
  request: CreatePreferenceRequest
): Promise<{
  success: boolean;
  preferenceUrl?: string;
  preferenceId?: string;
  fallbackInstructions?: ManualPaymentInstructions;
  fallbackMessage?: string;
}> {
  const client = getMPClient();
  const result = await client.createPreference(organizationId, accessToken, request);

  if (result.success) {
    return {
      success: true,
      preferenceUrl: result.preference.initPoint,
      preferenceId: result.preference.id,
    };
  }

  return {
    success: false,
    fallbackInstructions: result.instructions,
    fallbackMessage: result.fallback.message,
  };
}

/**
 * Check if MercadoPago is available for an organization
 */
export async function isMPAvailable(organizationId: string): Promise<{
  available: boolean;
  reason?: string;
  retryAfter?: number;
}> {
  const fallbackHandler = getMPFallbackHandler();
  const decision = await fallbackHandler.shouldFallback(organizationId);

  if (decision.shouldFallback) {
    return {
      available: false,
      reason: decision.message,
      retryAfter: decision.retryAfter,
    };
  }

  return { available: true };
}

/**
 * Get current MP service health
 */
export async function getMPHealth(organizationId?: string): Promise<{
  healthy: boolean;
  circuitState: 'closed' | 'open' | 'half-open';
  successRate: number;
  avgLatency: number;
  pendingFallbacks: number;
}> {
  const client = getMPClient();
  const status = await client.getServiceStatus(organizationId);

  return {
    healthy: status.available,
    circuitState: status.circuitState,
    successRate: status.successRate,
    avgLatency: status.avgLatency,
    pendingFallbacks: status.pendingFallbacks,
  };
}

/**
 * Record a successful MP API call (for external use)
 */
export function recordMPSuccess(): void {
  const circuitBreaker = getMPCircuitBreaker();
  circuitBreaker.recordSuccess();
}

/**
 * Record a failed MP API call (for external use)
 */
export function recordMPFailure(error?: Error): void {
  const circuitBreaker = getMPCircuitBreaker();
  circuitBreaker.recordFailure(error);
}

/**
 * Get formatted payment instructions for a specific channel
 */
export async function getFormattedPaymentInstructions(
  organizationId: string,
  channel: 'whatsapp' | 'email',
  options: {
    method?: 'transfer' | 'cash' | 'card_present';
    invoiceNumber?: string;
    amount?: number;
  } = {}
): Promise<string | { subject: string; body: string }> {
  const client = getMPClient();
  const instructions = await client.getPaymentInstructions(
    organizationId,
    options.method || 'transfer'
  );

  if (channel === 'whatsapp') {
    return client.formatForWhatsApp(instructions, options.invoiceNumber, options.amount);
  }

  return client.formatForEmail(instructions, options.invoiceNumber, options.amount);
}

/**
 * Resolve a fallback payment after manual collection
 */
export async function resolveFallbackPayment(
  fallbackId: string,
  resolution: {
    resolvedBy: string;
    resolvedMethod: string;
    notes?: string;
  }
): Promise<boolean> {
  const client = getMPClient();
  const result = await client.resolveFallback(fallbackId, resolution);
  return result !== null;
}
