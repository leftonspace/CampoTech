/**
 * Event Collector Service
 * =======================
 *
 * Phase 10.1: Analytics Data Infrastructure
 * Collects and processes analytics events from system operations.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { getRedisConnection } from '../../lib/redis/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type EventCategory =
  | 'job'
  | 'invoice'
  | 'payment'
  | 'customer'
  | 'technician'
  | 'user'
  | 'system';

export type JobEventType =
  | 'job_created'
  | 'job_assigned'
  | 'job_started'
  | 'job_completed'
  | 'job_cancelled'
  | 'job_rescheduled';

export type InvoiceEventType =
  | 'invoice_created'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'invoice_cancelled';

export type PaymentEventType =
  | 'payment_received'
  | 'payment_failed'
  | 'payment_refunded';

export type CustomerEventType =
  | 'customer_created'
  | 'customer_updated'
  | 'customer_first_job'
  | 'customer_churned';

export type EventType =
  | JobEventType
  | InvoiceEventType
  | PaymentEventType
  | CustomerEventType
  | 'user_login'
  | 'user_logout'
  | 'system_error'
  | 'api_call';

export interface AnalyticsEvent {
  id?: string;
  organizationId: string;
  eventType: EventType;
  category: EventCategory;
  entityType?: string;
  entityId?: string;
  userId?: string;
  sessionId?: string;
  data: Record<string, unknown>;
  timestamp: Date;
  processed?: boolean;
}

export interface EventCollectorConfig {
  batchSize: number;
  flushIntervalMs: number;
  maxQueueSize: number;
  enableRealTimeProcessing: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: EventCollectorConfig = {
  batchSize: 100,
  flushIntervalMs: 5000, // 5 seconds
  maxQueueSize: 10000,
  enableRealTimeProcessing: true,
};

const EVENT_QUEUE_KEY = 'analytics:event_queue';
const EVENT_COUNTER_KEY = 'analytics:event_counter';
const PROCESSING_LOCK_KEY = 'analytics:event_processing_lock';

// In-memory buffer for high-performance collection
let eventBuffer: AnalyticsEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let config: EventCollectorConfig = DEFAULT_CONFIG;

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize the event collector with optional configuration
 */
export function initializeEventCollector(customConfig?: Partial<EventCollectorConfig>): void {
  config = { ...DEFAULT_CONFIG, ...customConfig };

  // Start periodic flush
  if (flushTimer) {
    clearInterval(flushTimer);
  }

  flushTimer = setInterval(() => {
    flushEvents().catch((error) => {
      log.error('Event flush failed', { error: error instanceof Error ? error.message : 'Unknown' });
    });
  }, config.flushIntervalMs);

  log.info('Event collector initialized', { config });
}

/**
 * Shutdown the event collector gracefully
 */
export async function shutdownEventCollector(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }

  // Flush remaining events
  await flushEvents();

  log.info('Event collector shutdown complete');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT COLLECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Collect a single analytics event
 */
export async function collectEvent(event: Omit<AnalyticsEvent, 'timestamp' | 'id'>): Promise<void> {
  const fullEvent: AnalyticsEvent = {
    ...event,
    id: generateEventId(),
    timestamp: new Date(),
    processed: false,
  };

  // Add to buffer
  eventBuffer.push(fullEvent);

  // Check if we need to flush
  if (eventBuffer.length >= config.batchSize) {
    await flushEvents();
  }

  // Real-time processing for certain events
  if (config.enableRealTimeProcessing && shouldProcessRealTime(fullEvent)) {
    await processEventRealTime(fullEvent);
  }
}

/**
 * Collect multiple events at once
 */
export async function collectEvents(events: Omit<AnalyticsEvent, 'timestamp' | 'id'>[]): Promise<void> {
  const fullEvents = events.map((event) => ({
    ...event,
    id: generateEventId(),
    timestamp: new Date(),
    processed: false,
  }));

  eventBuffer.push(...fullEvents);

  // Flush if buffer is too large
  if (eventBuffer.length >= config.maxQueueSize) {
    await flushEvents();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB EVENT COLLECTORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Collect job created event
 */
export async function collectJobCreated(
  organizationId: string,
  jobId: string,
  data: {
    customerId: string;
    serviceType: string;
    createdById: string;
    estimatedDuration?: number;
  }
): Promise<void> {
  await collectEvent({
    organizationId,
    eventType: 'job_created',
    category: 'job',
    entityType: 'job',
    entityId: jobId,
    userId: data.createdById,
    data: {
      customerId: data.customerId,
      serviceType: data.serviceType,
      estimatedDuration: data.estimatedDuration,
    },
  });
}

/**
 * Collect job assigned event
 */
export async function collectJobAssigned(
  organizationId: string,
  jobId: string,
  data: {
    technicianId: string;
    assignedById?: string;
    scheduledDate?: Date;
  }
): Promise<void> {
  await collectEvent({
    organizationId,
    eventType: 'job_assigned',
    category: 'job',
    entityType: 'job',
    entityId: jobId,
    userId: data.assignedById,
    data: {
      technicianId: data.technicianId,
      scheduledDate: data.scheduledDate?.toISOString(),
    },
  });
}

/**
 * Collect job started event
 */
export async function collectJobStarted(
  organizationId: string,
  jobId: string,
  data: {
    technicianId: string;
    startedAt: Date;
  }
): Promise<void> {
  await collectEvent({
    organizationId,
    eventType: 'job_started',
    category: 'job',
    entityType: 'job',
    entityId: jobId,
    userId: data.technicianId,
    data: {
      startedAt: data.startedAt.toISOString(),
    },
  });
}

/**
 * Collect job completed event
 */
export async function collectJobCompleted(
  organizationId: string,
  jobId: string,
  data: {
    technicianId: string;
    completedAt: Date;
    durationMinutes: number;
    actualTotal?: number;
  }
): Promise<void> {
  await collectEvent({
    organizationId,
    eventType: 'job_completed',
    category: 'job',
    entityType: 'job',
    entityId: jobId,
    userId: data.technicianId,
    data: {
      completedAt: data.completedAt.toISOString(),
      durationMinutes: data.durationMinutes,
      actualTotal: data.actualTotal,
    },
  });
}

/**
 * Collect job cancelled event
 */
export async function collectJobCancelled(
  organizationId: string,
  jobId: string,
  data: {
    cancelledById: string;
    reason?: string;
  }
): Promise<void> {
  await collectEvent({
    organizationId,
    eventType: 'job_cancelled',
    category: 'job',
    entityType: 'job',
    entityId: jobId,
    userId: data.cancelledById,
    data: {
      reason: data.reason,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE EVENT COLLECTORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Collect invoice created event
 */
export async function collectInvoiceCreated(
  organizationId: string,
  invoiceId: string,
  data: {
    customerId: string;
    jobId?: string;
    total: number;
    type: string;
  }
): Promise<void> {
  await collectEvent({
    organizationId,
    eventType: 'invoice_created',
    category: 'invoice',
    entityType: 'invoice',
    entityId: invoiceId,
    data: {
      customerId: data.customerId,
      jobId: data.jobId,
      total: data.total,
      type: data.type,
    },
  });
}

/**
 * Collect invoice paid event
 */
export async function collectInvoicePaid(
  organizationId: string,
  invoiceId: string,
  data: {
    customerId: string;
    amount: number;
    paymentMethod: string;
    daysToPayment: number;
  }
): Promise<void> {
  await collectEvent({
    organizationId,
    eventType: 'invoice_paid',
    category: 'invoice',
    entityType: 'invoice',
    entityId: invoiceId,
    data: {
      customerId: data.customerId,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      daysToPayment: data.daysToPayment,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT EVENT COLLECTORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Collect payment received event
 */
export async function collectPaymentReceived(
  organizationId: string,
  paymentId: string,
  data: {
    invoiceId: string;
    customerId: string;
    amount: number;
    method: string;
    processingFee?: number;
  }
): Promise<void> {
  await collectEvent({
    organizationId,
    eventType: 'payment_received',
    category: 'payment',
    entityType: 'payment',
    entityId: paymentId,
    data: {
      invoiceId: data.invoiceId,
      customerId: data.customerId,
      amount: data.amount,
      method: data.method,
      processingFee: data.processingFee,
      netAmount: data.amount - (data.processingFee || 0),
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER EVENT COLLECTORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Collect customer created event
 */
export async function collectCustomerCreated(
  organizationId: string,
  customerId: string,
  data: {
    name: string;
    source?: string;
  }
): Promise<void> {
  await collectEvent({
    organizationId,
    eventType: 'customer_created',
    category: 'customer',
    entityType: 'customer',
    entityId: customerId,
    data: {
      name: data.name,
      source: data.source,
    },
  });
}

/**
 * Collect customer first job event
 */
export async function collectCustomerFirstJob(
  organizationId: string,
  customerId: string,
  data: {
    jobId: string;
    serviceType: string;
  }
): Promise<void> {
  await collectEvent({
    organizationId,
    eventType: 'customer_first_job',
    category: 'customer',
    entityType: 'customer',
    entityId: customerId,
    data: {
      jobId: data.jobId,
      serviceType: data.serviceType,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Flush buffered events to storage
 */
export async function flushEvents(): Promise<number> {
  if (eventBuffer.length === 0) {
    return 0;
  }

  const eventsToFlush = [...eventBuffer];
  eventBuffer = [];

  try {
    const redis = await getRedisConnection();

    // Store events in Redis queue for batch processing
    const pipeline = redis.pipeline();
    for (const event of eventsToFlush) {
      pipeline.rpush(EVENT_QUEUE_KEY, JSON.stringify(event));
    }
    pipeline.incrby(EVENT_COUNTER_KEY, eventsToFlush.length);
    await pipeline.exec();

    log.debug('Events flushed', { count: eventsToFlush.length });

    return eventsToFlush.length;
  } catch (error) {
    // Put events back in buffer on failure
    eventBuffer = [...eventsToFlush, ...eventBuffer];
    throw error;
  }
}

/**
 * Process events from the queue
 */
export async function processEventQueue(batchSize: number = 100): Promise<number> {
  const redis = await getRedisConnection();

  // Try to acquire processing lock
  const lockAcquired = await redis.set(
    PROCESSING_LOCK_KEY,
    Date.now().toString(),
    'EX',
    60,
    'NX'
  );

  if (!lockAcquired) {
    log.debug('Event queue processing already in progress');
    return 0;
  }

  try {
    let processedCount = 0;

    while (processedCount < batchSize) {
      const eventData = await redis.lpop(EVENT_QUEUE_KEY);
      if (!eventData) break;

      try {
        const event: AnalyticsEvent = JSON.parse(eventData);
        await processEvent(event);
        processedCount++;
      } catch (error) {
        log.error('Failed to process event', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    return processedCount;
  } finally {
    await redis.del(PROCESSING_LOCK_KEY);
  }
}

/**
 * Process a single event
 */
async function processEvent(event: AnalyticsEvent): Promise<void> {
  // Update real-time counters
  await updateRealTimeCounters(event);

  // Store for historical analysis
  await storeEventForAnalysis(event);

  // Trigger any event-specific actions
  await triggerEventActions(event);
}

/**
 * Process certain events in real-time
 */
async function processEventRealTime(event: AnalyticsEvent): Promise<void> {
  // Update real-time counters immediately
  await updateRealTimeCounters(event);

  // Update live dashboards via pub/sub
  await publishEventUpdate(event);
}

/**
 * Update real-time counters
 */
async function updateRealTimeCounters(event: AnalyticsEvent): Promise<void> {
  const redis = await getRedisConnection();
  const today = new Date().toISOString().slice(0, 10);

  const pipeline = redis.pipeline();

  // Update daily counters
  const dayKey = `analytics:daily:${event.organizationId}:${today}`;

  switch (event.eventType) {
    case 'job_created':
      pipeline.hincrby(dayKey, 'jobs_created', 1);
      break;
    case 'job_completed':
      pipeline.hincrby(dayKey, 'jobs_completed', 1);
      if (event.data.durationMinutes) {
        pipeline.hincrbyfloat(dayKey, 'total_duration', event.data.durationMinutes as number);
      }
      break;
    case 'job_cancelled':
      pipeline.hincrby(dayKey, 'jobs_cancelled', 1);
      break;
    case 'invoice_created':
      pipeline.hincrby(dayKey, 'invoices_created', 1);
      if (event.data.total) {
        pipeline.hincrbyfloat(dayKey, 'revenue_generated', event.data.total as number);
      }
      break;
    case 'payment_received':
      pipeline.hincrby(dayKey, 'payments_received', 1);
      if (event.data.amount) {
        pipeline.hincrbyfloat(dayKey, 'revenue_collected', event.data.amount as number);
      }
      break;
    case 'customer_created':
      pipeline.hincrby(dayKey, 'customers_created', 1);
      break;
  }

  // Set expiry on the day key (7 days)
  pipeline.expire(dayKey, 7 * 24 * 60 * 60);

  await pipeline.exec();
}

/**
 * Store event for historical analysis
 */
async function storeEventForAnalysis(event: AnalyticsEvent): Promise<void> {
  const redis = await getRedisConnection();

  // Store in time-series list (keep last 1000 events per org)
  const listKey = `analytics:events:${event.organizationId}:${event.category}`;
  await redis.lpush(listKey, JSON.stringify(event));
  await redis.ltrim(listKey, 0, 999);
  await redis.expire(listKey, 30 * 24 * 60 * 60); // 30 days
}

/**
 * Trigger event-specific actions
 */
async function triggerEventActions(event: AnalyticsEvent): Promise<void> {
  // Example: Send alerts for certain events
  if (event.eventType === 'job_cancelled') {
    // Could trigger cancellation analysis
    log.debug('Job cancelled event received', {
      organizationId: event.organizationId,
      jobId: event.entityId,
    });
  }
}

/**
 * Publish event update for real-time dashboards
 */
async function publishEventUpdate(event: AnalyticsEvent): Promise<void> {
  try {
    const redis = await getRedisConnection();
    const channel = `analytics:updates:${event.organizationId}`;
    await redis.publish(channel, JSON.stringify({
      type: 'event',
      eventType: event.eventType,
      category: event.category,
      timestamp: event.timestamp,
      data: event.data,
    }));
  } catch (error) {
    // Non-critical, just log
    log.debug('Failed to publish event update', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function shouldProcessRealTime(event: AnalyticsEvent): boolean {
  // Process these events immediately
  const realTimeEvents: EventType[] = [
    'job_completed',
    'payment_received',
    'job_cancelled',
  ];
  return realTimeEvents.includes(event.eventType);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get event collector statistics
 */
export async function getEventCollectorStats(): Promise<{
  bufferSize: number;
  queueSize: number;
  totalEventsCollected: number;
}> {
  const redis = await getRedisConnection();

  const [queueSize, totalEvents] = await Promise.all([
    redis.llen(EVENT_QUEUE_KEY),
    redis.get(EVENT_COUNTER_KEY),
  ]);

  return {
    bufferSize: eventBuffer.length,
    queueSize: queueSize || 0,
    totalEventsCollected: totalEvents ? parseInt(totalEvents, 10) : 0,
  };
}

/**
 * Get daily event counts for an organization
 */
export async function getDailyEventCounts(
  organizationId: string,
  date?: string
): Promise<Record<string, number>> {
  const redis = await getRedisConnection();
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const dayKey = `analytics:daily:${organizationId}:${targetDate}`;

  const data = await redis.hgetall(dayKey);

  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = parseFloat(value);
  }

  return result;
}

/**
 * Get recent events for an organization
 */
export async function getRecentEvents(
  organizationId: string,
  category: EventCategory,
  limit: number = 50
): Promise<AnalyticsEvent[]> {
  const redis = await getRedisConnection();
  const listKey = `analytics:events:${organizationId}:${category}`;

  const events = await redis.lrange(listKey, 0, limit - 1);

  return events.map((e) => JSON.parse(e));
}
