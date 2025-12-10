/**
 * Webhook Event Emitter
 * ======================
 *
 * Service for emitting webhook events and queueing deliveries.
 */

import { Pool } from 'pg';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import {
  WebhookEvent,
  WebhookEventType,
  WebhookSubscription,
  WEBHOOK_EVENT_TYPES,
} from './webhook.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmitEventOptions {
  orgId: string;
  type: WebhookEventType;
  data: Record<string, any>;
  metadata?: {
    actor_type?: 'user' | 'api' | 'system';
    actor_id?: string;
    ip_address?: string;
    user_agent?: string;
  };
}

export interface EventEmitterConfig {
  /** Enable local event emitter for in-process listeners */
  enableLocalEmitter?: boolean;
  /** Log events for debugging */
  enableEventLogging?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK EVENT EMITTER
// ═══════════════════════════════════════════════════════════════════════════════

export class WebhookEventEmitter {
  private localEmitter: EventEmitter;
  private config: EventEmitterConfig;

  constructor(
    private pool: Pool,
    config?: EventEmitterConfig
  ) {
    this.localEmitter = new EventEmitter();
    this.config = {
      enableLocalEmitter: true,
      enableEventLogging: false,
      ...config,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENT EMISSION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Emit a webhook event
   */
  async emit(options: EmitEventOptions): Promise<WebhookEvent> {
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      type: options.type,
      org_id: options.orgId,
      created_at: new Date().toISOString(),
      data: options.data,
      metadata: options.metadata,
    };

    if (this.config.enableEventLogging) {
      console.log(`[Webhook] Event emitted: ${event.type}`, { eventId: event.id, orgId: event.org_id });
    }

    // Store event in database
    await this.storeEvent(event);

    // Queue deliveries for matching webhooks
    await this.queueDeliveries(event);

    // Emit locally for in-process listeners
    if (this.config.enableLocalEmitter) {
      this.localEmitter.emit(event.type, event);
      this.localEmitter.emit('*', event);
    }

    return event;
  }

  /**
   * Emit multiple events
   */
  async emitMany(events: EmitEventOptions[]): Promise<WebhookEvent[]> {
    const results: WebhookEvent[] = [];
    for (const eventOptions of events) {
      const event = await this.emit(eventOptions);
      results.push(event);
    }
    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONVENIENCE EMITTERS
  // ─────────────────────────────────────────────────────────────────────────────

  // Customer events
  async emitCustomerCreated(orgId: string, customer: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.CUSTOMER_CREATED,
      data: { customer },
      metadata,
    });
  }

  async emitCustomerUpdated(orgId: string, customer: any, changes: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.CUSTOMER_UPDATED,
      data: { customer, changes },
      metadata,
    });
  }

  async emitCustomerDeleted(orgId: string, customerId: string, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.CUSTOMER_DELETED,
      data: { customer_id: customerId },
      metadata,
    });
  }

  // Job events
  async emitJobCreated(orgId: string, job: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.JOB_CREATED,
      data: { job },
      metadata,
    });
  }

  async emitJobUpdated(orgId: string, job: any, changes: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.JOB_UPDATED,
      data: { job, changes },
      metadata,
    });
  }

  async emitJobScheduled(orgId: string, job: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.JOB_SCHEDULED,
      data: { job },
      metadata,
    });
  }

  async emitJobAssigned(orgId: string, job: any, technicianId: string, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.JOB_ASSIGNED,
      data: { job, technician_id: technicianId },
      metadata,
    });
  }

  async emitJobStarted(orgId: string, job: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.JOB_STARTED,
      data: { job },
      metadata,
    });
  }

  async emitJobCompleted(orgId: string, job: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.JOB_COMPLETED,
      data: { job },
      metadata,
    });
  }

  async emitJobCancelled(orgId: string, job: any, reason: string, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.JOB_CANCELLED,
      data: { job, reason },
      metadata,
    });
  }

  // Invoice events
  async emitInvoiceCreated(orgId: string, invoice: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.INVOICE_CREATED,
      data: { invoice },
      metadata,
    });
  }

  async emitInvoiceSent(orgId: string, invoice: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.INVOICE_SENT,
      data: { invoice },
      metadata,
    });
  }

  async emitInvoicePaid(orgId: string, invoice: any, payment: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.INVOICE_PAID,
      data: { invoice, payment },
      metadata,
    });
  }

  async emitInvoiceOverdue(orgId: string, invoice: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.INVOICE_OVERDUE,
      data: { invoice },
      metadata,
    });
  }

  // Payment events
  async emitPaymentCreated(orgId: string, payment: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.PAYMENT_CREATED,
      data: { payment },
      metadata,
    });
  }

  async emitPaymentCompleted(orgId: string, payment: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.PAYMENT_COMPLETED,
      data: { payment },
      metadata,
    });
  }

  async emitPaymentFailed(orgId: string, payment: any, error: string, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.PAYMENT_FAILED,
      data: { payment, error },
      metadata,
    });
  }

  async emitPaymentRefunded(orgId: string, payment: any, refund: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.PAYMENT_REFUNDED,
      data: { payment, refund },
      metadata,
    });
  }

  // Inventory events
  async emitInventoryLowStock(orgId: string, item: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.INVENTORY_LOW_STOCK,
      data: { item },
      metadata,
    });
  }

  async emitInventoryOutOfStock(orgId: string, item: any, metadata?: EmitEventOptions['metadata']) {
    return this.emit({
      orgId,
      type: WEBHOOK_EVENT_TYPES.INVENTORY_OUT_OF_STOCK,
      data: { item },
      metadata,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LOCAL LISTENERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Add local listener for webhook events
   */
  on(eventType: WebhookEventType | '*', listener: (event: WebhookEvent) => void): this {
    this.localEmitter.on(eventType, listener);
    return this;
  }

  /**
   * Add one-time local listener
   */
  once(eventType: WebhookEventType | '*', listener: (event: WebhookEvent) => void): this {
    this.localEmitter.once(eventType, listener);
    return this;
  }

  /**
   * Remove local listener
   */
  off(eventType: WebhookEventType | '*', listener: (event: WebhookEvent) => void): this {
    this.localEmitter.off(eventType, listener);
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Store event in database
   */
  private async storeEvent(event: WebhookEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO webhook_events (id, type, org_id, data, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        event.id,
        event.type,
        event.org_id,
        JSON.stringify(event.data),
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.created_at,
      ]
    );
  }

  /**
   * Queue deliveries for all matching webhook subscriptions
   */
  private async queueDeliveries(event: WebhookEvent): Promise<void> {
    // Find all enabled webhooks for this org that subscribe to this event type
    const webhooksResult = await this.pool.query(
      `SELECT * FROM webhooks
       WHERE org_id = $1 AND enabled = true AND $2 = ANY(events)`,
      [event.org_id, event.type]
    );

    const webhooks = webhooksResult.rows as WebhookSubscription[];

    if (webhooks.length === 0) {
      return;
    }

    // Create delivery records for each webhook
    const deliveryInserts = webhooks.map(webhook => {
      return this.pool.query(
        `INSERT INTO webhook_deliveries (
          webhook_id, event_type, event_id, status,
          request_url, request_headers, request_body,
          attempts, created_at
        )
        VALUES ($1, $2, $3, 'pending', $4, $5, $6, 0, NOW())`,
        [
          webhook.id,
          event.type,
          event.id,
          webhook.url,
          JSON.stringify({}), // Headers will be set at delivery time
          JSON.stringify(event),
        ]
      );
    });

    await Promise.all(deliveryInserts);

    if (this.config.enableEventLogging) {
      console.log(`[Webhook] Queued ${webhooks.length} deliveries for event ${event.id}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createWebhookEmitter(
  pool: Pool,
  config?: EventEmitterConfig
): WebhookEventEmitter {
  return new WebhookEventEmitter(pool, config);
}
