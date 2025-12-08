/**
 * Event Bus
 * =========
 *
 * Pub/Sub event system for decoupled communication between components.
 * Supports both in-memory and Redis-backed event distribution.
 */

import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Event<T = any> {
  /** Event type */
  type: string;
  /** Event payload */
  payload: T;
  /** Event metadata */
  metadata: {
    /** Event ID */
    id: string;
    /** Organization ID for multi-tenant filtering */
    orgId?: string;
    /** Event timestamp */
    timestamp: Date;
    /** Source of the event */
    source?: string;
    /** Correlation ID for tracing */
    correlationId?: string;
  };
}

export type EventHandler<T = any> = (event: Event<T>) => void | Promise<void>;

export interface EventBusConfig {
  /** Redis URL for distributed events (optional) */
  redisUrl?: string;
  /** Channel prefix for Redis */
  channelPrefix?: string;
  /** Maximum listeners per event type */
  maxListeners?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Domain event types
 */
export const EventTypes = {
  // Job events
  JOB_CREATED: 'job.created',
  JOB_UPDATED: 'job.updated',
  JOB_STATUS_CHANGED: 'job.status_changed',
  JOB_COMPLETED: 'job.completed',
  JOB_CANCELLED: 'job.cancelled',

  // Invoice events
  INVOICE_CREATED: 'invoice.created',
  INVOICE_CAE_RECEIVED: 'invoice.cae_received',
  INVOICE_SENT: 'invoice.sent',
  INVOICE_PAYMENT_RECEIVED: 'invoice.payment_received',

  // Payment events
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  // Customer events
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',

  // User events
  USER_LOGGED_IN: 'user.logged_in',
  USER_LOGGED_OUT: 'user.logged_out',
  USER_SESSION_CREATED: 'user.session_created',

  // WhatsApp events
  WHATSAPP_MESSAGE_RECEIVED: 'whatsapp.message_received',
  WHATSAPP_MESSAGE_SENT: 'whatsapp.message_sent',
  WHATSAPP_VOICE_TRANSCRIBED: 'whatsapp.voice_transcribed',

  // System events
  CAPABILITY_CHANGED: 'system.capability_changed',
  PANIC_MODE_ACTIVATED: 'system.panic_mode_activated',
  PANIC_MODE_DEACTIVATED: 'system.panic_mode_deactivated',

  // Sync events
  SYNC_STARTED: 'sync.started',
  SYNC_COMPLETED: 'sync.completed',
  SYNC_CONFLICT: 'sync.conflict',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT BUS
// ═══════════════════════════════════════════════════════════════════════════════

export class EventBus {
  private emitter: EventEmitter;
  private redisPublisher?: Redis;
  private redisSubscriber?: Redis;
  private config: EventBusConfig;
  private handlers: Map<string, Set<EventHandler>> = new Map();

  constructor(config: EventBusConfig = {}) {
    this.config = {
      channelPrefix: config.channelPrefix || 'events:',
      maxListeners: config.maxListeners || 100,
      ...config,
    };

    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(this.config.maxListeners!);

    // Initialize Redis if URL provided
    if (config.redisUrl) {
      this.initializeRedis(config.redisUrl);
    }
  }

  /**
   * Initialize Redis pub/sub
   */
  private initializeRedis(redisUrl: string): void {
    this.redisPublisher = new Redis(redisUrl);
    this.redisSubscriber = new Redis(redisUrl);

    // Handle incoming messages
    this.redisSubscriber.on('message', (channel, message) => {
      try {
        const event = JSON.parse(message) as Event;
        event.metadata.timestamp = new Date(event.metadata.timestamp);
        this.emitter.emit(event.type, event);
      } catch (error) {
        console.error('Failed to parse event message:', error);
      }
    });
  }

  /**
   * Publish an event
   */
  async publish<T>(
    type: EventType | string,
    payload: T,
    metadata?: Partial<Event['metadata']>
  ): Promise<Event<T>> {
    const event: Event<T> = {
      type,
      payload,
      metadata: {
        id: this.generateEventId(),
        timestamp: new Date(),
        ...metadata,
      },
    };

    // Emit locally
    this.emitter.emit(type, event);

    // Publish to Redis if available
    if (this.redisPublisher) {
      const channel = `${this.config.channelPrefix}${type}`;
      await this.redisPublisher.publish(channel, JSON.stringify(event));
    }

    return event;
  }

  /**
   * Subscribe to an event type
   */
  subscribe<T>(type: EventType | string, handler: EventHandler<T>): () => void {
    // Add to local handlers
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as EventHandler);

    // Subscribe to local emitter
    this.emitter.on(type, handler as EventHandler);

    // Subscribe to Redis channel if available
    if (this.redisSubscriber) {
      const channel = `${this.config.channelPrefix}${type}`;
      this.redisSubscriber.subscribe(channel);
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(type, handler);
    };
  }

  /**
   * Subscribe to event once
   */
  once<T>(type: EventType | string, handler: EventHandler<T>): () => void {
    const wrappedHandler: EventHandler<T> = (event) => {
      this.unsubscribe(type, wrappedHandler);
      handler(event);
    };

    return this.subscribe(type, wrappedHandler);
  }

  /**
   * Unsubscribe from an event type
   */
  unsubscribe<T>(type: EventType | string, handler: EventHandler<T>): void {
    this.emitter.off(type, handler as EventHandler);

    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.handlers.delete(type);

        // Unsubscribe from Redis if no more handlers
        if (this.redisSubscriber) {
          const channel = `${this.config.channelPrefix}${type}`;
          this.redisSubscriber.unsubscribe(channel);
        }
      }
    }
  }

  /**
   * Subscribe to events for a specific organization
   */
  subscribeForOrg<T>(
    orgId: string,
    type: EventType | string,
    handler: EventHandler<T>
  ): () => void {
    const filteredHandler: EventHandler<T> = (event) => {
      if (event.metadata.orgId === orgId) {
        handler(event);
      }
    };

    return this.subscribe(type, filteredHandler);
  }

  /**
   * Subscribe to multiple event types
   */
  subscribeMany<T>(
    types: (EventType | string)[],
    handler: EventHandler<T>
  ): () => void {
    const unsubscribers = types.map((type) => this.subscribe(type, handler));

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }

  /**
   * Wait for an event with optional timeout
   */
  waitFor<T>(
    type: EventType | string,
    timeout?: number,
    filter?: (event: Event<T>) => boolean
  ): Promise<Event<T>> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined;

      const handler: EventHandler<T> = (event) => {
        if (!filter || filter(event)) {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          unsubscribe();
          resolve(event);
        }
      };

      const unsubscribe = this.subscribe(type, handler);

      if (timeout) {
        timeoutId = setTimeout(() => {
          unsubscribe();
          reject(new Error(`Timeout waiting for event: ${type}`));
        }, timeout);
      }
    });
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${random}`;
  }

  /**
   * Get count of subscribers for a type
   */
  subscriberCount(type: EventType | string): number {
    return this.emitter.listenerCount(type);
  }

  /**
   * Remove all subscribers for a type
   */
  removeAllSubscribers(type?: EventType | string): void {
    if (type) {
      this.emitter.removeAllListeners(type);
      this.handlers.delete(type);
    } else {
      this.emitter.removeAllListeners();
      this.handlers.clear();
    }
  }

  /**
   * Shutdown the event bus
   */
  async shutdown(): Promise<void> {
    this.removeAllSubscribers();

    if (this.redisPublisher) {
      await this.redisPublisher.quit();
    }

    if (this.redisSubscriber) {
      await this.redisSubscriber.quit();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let eventBus: EventBus | null = null;

/**
 * Initialize the global event bus
 */
export function initializeEventBus(config?: EventBusConfig): void {
  eventBus = new EventBus(config);
}

/**
 * Get the global event bus
 */
export function getEventBus(): EventBus {
  if (!eventBus) {
    // Auto-initialize with defaults (in-memory only)
    eventBus = new EventBus();
  }
  return eventBus;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Publish an event
 */
export async function publishEvent<T>(
  type: EventType | string,
  payload: T,
  metadata?: Partial<Event['metadata']>
): Promise<Event<T>> {
  return getEventBus().publish(type, payload, metadata);
}

/**
 * Subscribe to an event type
 */
export function subscribeToEvent<T>(
  type: EventType | string,
  handler: EventHandler<T>
): () => void {
  return getEventBus().subscribe(type, handler);
}
