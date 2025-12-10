/**
 * Webhook Types
 * ==============
 *
 * Type definitions for the webhook system.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const WEBHOOK_EVENT_TYPES = {
  // Customer events
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_DELETED: 'customer.deleted',

  // Job events
  JOB_CREATED: 'job.created',
  JOB_UPDATED: 'job.updated',
  JOB_SCHEDULED: 'job.scheduled',
  JOB_ASSIGNED: 'job.assigned',
  JOB_STARTED: 'job.started',
  JOB_COMPLETED: 'job.completed',
  JOB_CANCELLED: 'job.cancelled',

  // Invoice events
  INVOICE_CREATED: 'invoice.created',
  INVOICE_SENT: 'invoice.sent',
  INVOICE_VIEWED: 'invoice.viewed',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PARTIALLY_PAID: 'invoice.partially_paid',
  INVOICE_OVERDUE: 'invoice.overdue',
  INVOICE_VOIDED: 'invoice.voided',

  // Payment events
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  // Technician events
  TECHNICIAN_CREATED: 'technician.created',
  TECHNICIAN_UPDATED: 'technician.updated',
  TECHNICIAN_LOCATION_UPDATED: 'technician.location_updated',

  // Route events
  ROUTE_OPTIMIZED: 'route.optimized',
  ROUTE_STARTED: 'route.started',
  ROUTE_COMPLETED: 'route.completed',

  // Inventory events
  INVENTORY_LOW_STOCK: 'inventory.low_stock',
  INVENTORY_OUT_OF_STOCK: 'inventory.out_of_stock',
  INVENTORY_RESTOCKED: 'inventory.restocked',
} as const;

export type WebhookEventType = typeof WEBHOOK_EVENT_TYPES[keyof typeof WEBHOOK_EVENT_TYPES];

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK EVENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  org_id: string;
  created_at: string;
  data: Record<string, any>;
  metadata?: {
    actor_type?: 'user' | 'api' | 'system';
    actor_id?: string;
    ip_address?: string;
    user_agent?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK SUBSCRIPTION
// ═══════════════════════════════════════════════════════════════════════════════

export interface WebhookSubscription {
  id: string;
  org_id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  enabled: boolean;
  headers?: Record<string, string>;
  retry_policy: RetryPolicy;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface RetryPolicy {
  max_attempts: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  max_attempts: 5,
  initial_delay_ms: 1000,
  max_delay_ms: 300000, // 5 minutes
  backoff_multiplier: 2,
};

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK DELIVERY
// ═══════════════════════════════════════════════════════════════════════════════

export type DeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: WebhookEventType;
  event_id: string;
  status: DeliveryStatus;
  request: {
    url: string;
    headers: Record<string, string>;
    body: WebhookEvent;
  };
  response?: {
    status: number;
    headers: Record<string, string>;
    body: string;
  };
  attempts: number;
  next_retry_at: Date | null;
  delivered_at: Date | null;
  duration_ms: number | null;
  error: string | null;
  created_at: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY RESULT
// ═══════════════════════════════════════════════════════════════════════════════

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  duration: number;
  error?: string;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface WebhookConfig {
  /** Request timeout in milliseconds */
  timeout: number;
  /** User agent to send with requests */
  userAgent: string;
  /** Maximum concurrent deliveries */
  maxConcurrency: number;
  /** How often to poll for pending deliveries (ms) */
  pollInterval: number;
  /** Maximum payload size to log (bytes) */
  maxLoggedPayloadSize: number;
}

export const DEFAULT_WEBHOOK_CONFIG: WebhookConfig = {
  timeout: 30000,
  userAgent: 'CampoTech-Webhook/1.0',
  maxConcurrency: 10,
  pollInterval: 5000,
  maxLoggedPayloadSize: 10000,
};
