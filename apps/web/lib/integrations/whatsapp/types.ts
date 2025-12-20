/**
 * WhatsApp Integration Types for Web App
 * =======================================
 *
 * Type definitions for WhatsApp message queue with rate limiting.
 */

// Re-export core types from src
export type {
  WhatsAppConfig,
  InboundMessageType,
  OutboundMessageType,
  MessageStatusType,
  WAMessageRecord,
  TemplateMessage,
  TemplateComponent,
  InteractiveButton,
  InteractiveSection,
} from '@/../../src/integrations/whatsapp/whatsapp.types';

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RateLimiterConfig {
  /** Messages per second (Meta limit is 80/sec for Business API) */
  messagesPerSecond: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Maximum burst size allowed */
  burstSize: number;
  /** Whether to queue excess messages or reject them */
  queueExcess: boolean;
}

export interface RateLimiterState {
  /** Tokens available (token bucket algorithm) */
  tokens: number;
  /** Last token refill time */
  lastRefill: number;
  /** Messages currently queued */
  queuedCount: number;
  /** Messages sent in current second */
  sentThisSecond: number;
  /** Current second timestamp (floored) */
  currentSecond: number;
}

export interface RateLimitResult {
  /** Whether the message can be sent immediately */
  allowed: boolean;
  /** If not allowed, wait time in milliseconds */
  waitTimeMs?: number;
  /** Current queue position if queued */
  queuePosition?: number;
  /** Remaining capacity this second */
  remainingCapacity: number;
}

export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  messagesPerSecond: 80, // Meta's WhatsApp Business API limit
  windowMs: 1000,
  burstSize: 100, // Allow slight burst above limit
  queueExcess: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE QUEUE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type MessagePriority = 'urgent' | 'high' | 'normal' | 'low';

export type QueueMessageStatus =
  | 'queued'
  | 'rate_limited'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'expired';

export interface QueuedMessage {
  id: string;
  organizationId: string;
  customerId?: string;
  phone: string;
  type: 'text' | 'template' | 'interactive' | 'media';
  priority: MessagePriority;
  status: QueueMessageStatus;
  payload: MessagePayload;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  scheduledAt: Date;
  expiresAt?: Date;
  lastAttempt?: Date;
  lastError?: string;
  waMessageId?: string;
}

export type MessagePayload =
  | TextPayload
  | TemplatePayload
  | InteractivePayload
  | MediaPayload;

export interface TextPayload {
  type: 'text';
  body: string;
  previewUrl?: boolean;
}

export interface TemplatePayload {
  type: 'template';
  name: string;
  language: string;
  components?: TemplateComponentPayload[];
}

export interface TemplateComponentPayload {
  type: 'header' | 'body' | 'button';
  parameters: Array<{
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
    text?: string;
    currency?: { fallback_value: string; code: string; amount_1000: number };
    date_time?: { fallback_value: string };
    image?: { link: string };
    document?: { link: string; filename?: string };
    video?: { link: string };
  }>;
  sub_type?: 'quick_reply' | 'url';
  index?: number;
}

export interface InteractivePayload {
  type: 'interactive';
  interactiveType: 'button' | 'list' | 'product' | 'product_list';
  header?: {
    type: 'text' | 'image' | 'video' | 'document';
    text?: string;
    image?: { link: string };
    video?: { link: string };
    document?: { link: string; filename?: string };
  };
  body: string;
  footer?: string;
  buttons?: Array<{ type: 'reply'; reply: { id: string; title: string } }>;
  sections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
}

export interface MediaPayload {
  type: 'media';
  mediaType: 'image' | 'video' | 'audio' | 'document';
  url?: string;
  mediaId?: string;
  caption?: string;
  filename?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

export interface QueueStatistics {
  /** Total messages in queue */
  totalQueued: number;
  /** Messages by priority */
  byPriority: Record<MessagePriority, number>;
  /** Messages by status */
  byStatus: Record<QueueMessageStatus, number>;
  /** Messages sent in last minute */
  sentLastMinute: number;
  /** Messages sent in last hour */
  sentLastHour: number;
  /** Current rate (messages/second) */
  currentRate: number;
  /** Average wait time in queue (ms) */
  avgWaitTime: number;
  /** Queue health status */
  health: 'healthy' | 'degraded' | 'overloaded';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  /** Failures before opening circuit */
  failureThreshold: number;
  /** Successes in half-open to close */
  successThreshold: number;
  /** Time circuit stays open (ms) */
  openDurationMs: number;
  /** Requests allowed in half-open */
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
  openDurationMs: 30000,
  halfOpenRequests: 3,
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE STATUS
// ═══════════════════════════════════════════════════════════════════════════════

export interface WAServiceStatus {
  /** Is service available */
  available: boolean;
  /** Circuit breaker state */
  circuitState: CircuitState;
  /** Rate limiter status */
  rateLimiter: {
    currentRate: number;
    capacity: number;
    queuedMessages: number;
  };
  /** Last successful send */
  lastSuccess: Date | null;
  /** Last error */
  lastError: Date | null;
  /** Success rate (last 100 requests) */
  successRate: number;
  /** Average latency (ms) */
  avgLatency: number;
}

export interface WASystemStatus {
  service: WAServiceStatus;
  queue: QueueStatistics;
  /** Organization's WA configuration status */
  configured: boolean;
  /** Updated at */
  updatedAt: Date;
}
