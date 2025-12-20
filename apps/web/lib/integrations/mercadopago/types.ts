/**
 * MercadoPago Integration Types for Web App
 * =========================================
 *
 * Type definitions for MercadoPago client wrapper with resilience patterns.
 */

// Re-export core types
export type {
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
} from '@/../../src/integrations/mercadopago/mercadopago.types';

export {
  MP_API_BASE_URL,
  MP_AUTH_URL,
  MP_ERROR_CODES,
  classifyMPError,
} from '@/../../src/integrations/mercadopago/mercadopago.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  /** Number of failures before opening */
  failureThreshold: number;
  /** Number of successes in half-open before closing */
  successThreshold: number;
  /** Duration to keep circuit open (ms) */
  openDurationMs: number;
  /** Number of test requests allowed in half-open state */
  halfOpenRequests: number;
}

export interface CircuitBreakerStatus {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  openedAt: Date | null;
  nextRetryAt: Date | null;
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  openDurationMs: 30000, // 30 seconds
  halfOpenRequests: 3,
};

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type FallbackReason =
  | 'api_unavailable'
  | 'circuit_open'
  | 'panic_mode'
  | 'max_retries'
  | 'auth_failure'
  | 'rate_limited'
  | 'timeout'
  | 'config_missing';

export interface FallbackDecision {
  shouldFallback: boolean;
  reason?: FallbackReason;
  message: string;
  suggestedActions: string[];
  /** Time until retry (ms), if applicable */
  retryAfter?: number;
}

export interface ManualPaymentInstructions {
  /** Payment method type */
  method: 'transfer' | 'cash' | 'card_present';
  /** Display title */
  title: string;
  /** Step-by-step instructions */
  instructions: string[];
  /** Bank details for transfer */
  bankDetails?: {
    bankName: string;
    accountHolder: string;
    cbu: string;
    alias?: string;
    cuit: string;
  };
  /** Message to send to customer */
  customerMessage: string;
  /** QR code data for transfer (if applicable) */
  qrData?: string;
}

export interface FallbackPaymentRecord {
  id: string;
  organizationId: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  currency: 'ARS';
  reason: FallbackReason;
  originalError?: string;
  suggestedMethod: 'cash' | 'transfer' | 'card_present';
  status: 'pending' | 'resolved' | 'expired';
  notificationSent: boolean;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolvedMethod?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface MPClientOptions {
  /** Circuit breaker configuration */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Request timeout (ms) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Auto-fallback when circuit opens */
  autoFallback?: boolean;
  /** Default payment instructions for fallback */
  fallbackInstructions?: Partial<ManualPaymentInstructions>;
}

export const DEFAULT_MP_CLIENT_OPTIONS: Required<MPClientOptions> = {
  circuitBreaker: DEFAULT_CIRCUIT_CONFIG,
  timeout: 30000,
  debug: false,
  autoFallback: true,
  fallbackInstructions: {
    method: 'transfer',
    title: 'Pago por Transferencia',
    instructions: [],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE STATUS TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MPServiceStatus {
  /** Is service available */
  available: boolean;
  /** Circuit breaker state */
  circuitState: CircuitState;
  /** Last successful request */
  lastSuccess: Date | null;
  /** Last error */
  lastError: Date | null;
  /** Success rate (last 100 requests) */
  successRate: number;
  /** Average latency (ms) */
  avgLatency: number;
  /** Pending fallback payments */
  pendingFallbacks: number;
}

export interface MPSystemStatus {
  service: MPServiceStatus;
  /** Organization's MP configuration status */
  configured: boolean;
  /** OAuth token valid */
  tokenValid: boolean;
  /** Token expires at */
  tokenExpiresAt: Date | null;
  /** Last webhook received */
  lastWebhook: Date | null;
  /** Updated at */
  updatedAt: Date;
}
