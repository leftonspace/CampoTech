/**
 * WhatsApp Integration Module
 * ===========================
 *
 * Resilient WhatsApp integration with rate limiting and circuit breaker.
 *
 * Usage:
 *   import { getWAMessageQueue, getWARateLimiter } from '@/lib/integrations/whatsapp';
 *
 * Components:
 * - WhatsAppMessageQueue: Priority queue with rate limiting
 * - WhatsAppRateLimiter: Token bucket rate limiter (80 msg/sec)
 * - WACircuitBreaker: Circuit breaker for API calls
 */

// Rate limiter
export {
  WhatsAppRateLimiter,
  OrganizationRateLimiter,
  getWARateLimiter,
  getOrgRateLimiter,
  resetRateLimiters,
} from './rate-limiter';

// Message queue
export {
  WhatsAppMessageQueue,
  getWAMessageQueue,
  resetWAMessageQueue,
} from './message-queue';

// Circuit breaker
export {
  WACircuitBreaker,
  CircuitOpenError,
  getWACircuitBreaker,
  resetWACircuitBreaker,
  executeWithCircuitBreaker,
  classifyWAError,
  isRetryableError,
} from './circuit-breaker';

// Types
export type {
  // Rate limiter types
  RateLimiterConfig,
  RateLimiterState,
  RateLimitResult,
  // Queue types
  QueuedMessage,
  MessagePayload,
  TextPayload,
  TemplatePayload,
  InteractivePayload,
  MediaPayload,
  MessagePriority,
  QueueMessageStatus,
  QueueStatistics,
  // Circuit breaker types
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  // Service status
  WAServiceStatus,
  WASystemStatus,
  // Re-exported core types
  WhatsAppConfig,
  InboundMessageType,
  OutboundMessageType,
  MessageStatusType,
} from './types';

export {
  DEFAULT_RATE_LIMITER_CONFIG,
  DEFAULT_CIRCUIT_CONFIG,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

import { getWAMessageQueue } from './message-queue';
import { getOrgRateLimiter, getWARateLimiter } from './rate-limiter';
import { getWACircuitBreaker } from './circuit-breaker';
import type { WAServiceStatus, WASystemStatus, MessagePriority } from './types';

/**
 * Send a text message via the queue
 */
export async function queueTextMessage(
  organizationId: string,
  phone: string,
  text: string,
  options: {
    customerId?: string;
    priority?: MessagePriority;
  } = {}
): Promise<{ messageId: string; queuePosition: number }> {
  const queue = getWAMessageQueue();
  const stats = await queue.getStatistics(organizationId);

  const message = await queue.enqueueText(organizationId, phone, text, options);

  return {
    messageId: message.id,
    queuePosition: stats.totalQueued + 1,
  };
}

/**
 * Send a template message via the queue
 */
export async function queueTemplateMessage(
  organizationId: string,
  phone: string,
  templateName: string,
  language: string = 'es_AR',
  options: {
    customerId?: string;
    priority?: MessagePriority;
    parameters?: Record<string, string>;
  } = {}
): Promise<{ messageId: string; queuePosition: number }> {
  const queue = getWAMessageQueue();
  const stats = await queue.getStatistics(organizationId);

  // Build components from parameters
  const components = options.parameters
    ? [
        {
          type: 'body' as const,
          parameters: Object.entries(options.parameters)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([, value]) => ({ type: 'text' as const, text: value })),
        },
      ]
    : undefined;

  const message = await queue.enqueueTemplate(
    organizationId,
    phone,
    templateName,
    language,
    {
      customerId: options.customerId,
      priority: options.priority,
      components,
    }
  );

  return {
    messageId: message.id,
    queuePosition: stats.totalQueued + 1,
  };
}

/**
 * Check if WhatsApp service is available
 */
export function isWAAvailable(): boolean {
  const circuitBreaker = getWACircuitBreaker();
  return circuitBreaker.canRequest();
}

/**
 * Check rate limit status
 */
export function checkRateLimit(organizationId: string): {
  canSend: boolean;
  waitTimeMs: number;
  orgCount: number;
  globalCapacity: number;
} {
  const orgLimiter = getOrgRateLimiter();
  const status = orgLimiter.getOrgStatus(organizationId);

  return {
    canSend: orgLimiter.checkOrgLimit(organizationId) && status.global.tokens >= 1,
    waitTimeMs: Math.max(status.orgWaitTime, status.global.waitTimeMs),
    orgCount: status.orgCount,
    globalCapacity: status.global.tokens,
  };
}

/**
 * Get service status
 */
export async function getWAServiceStatus(
  organizationId?: string
): Promise<WAServiceStatus> {
  const circuitBreaker = getWACircuitBreaker();
  const rateLimiter = getWARateLimiter();
  const status = circuitBreaker.getStatus();
  const rateStatus = rateLimiter.getStatus();

  return {
    available: status.state !== 'open',
    circuitState: status.state,
    rateLimiter: {
      currentRate: rateStatus.sentThisSecond,
      capacity: rateStatus.maxPerSecond,
      queuedMessages: rateStatus.queuedCount,
    },
    lastSuccess: status.lastSuccess,
    lastError: status.lastFailure,
    successRate: circuitBreaker.getSuccessRate(),
    avgLatency: circuitBreaker.getAverageLatency(),
  };
}

/**
 * Get full system status
 */
export async function getWASystemStatus(
  organizationId: string
): Promise<WASystemStatus> {
  const service = await getWAServiceStatus(organizationId);
  const queue = getWAMessageQueue();
  const queueStats = await queue.getStatistics(organizationId);

  // Check if organization has WA configured
  let configured = false;
  try {
    const { prisma } = await import('@/lib/prisma');
    const settings = await prisma.organizationSettings.findFirst({
      where: { organizationId },
      select: {
        whatsappEnabled: true,
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
      },
    });
    configured = !!(
      settings?.whatsappEnabled &&
      settings?.whatsappPhoneNumberId &&
      settings?.whatsappAccessToken
    );
  } catch {
    // Configuration check failed
  }

  return {
    service,
    queue: queueStats,
    configured,
    updatedAt: new Date(),
  };
}

/**
 * Record a successful send (for external callers)
 */
export function recordWASuccess(latency?: number): void {
  const circuitBreaker = getWACircuitBreaker();
  circuitBreaker.recordSuccess(latency);
}

/**
 * Record a failed send (for external callers)
 */
export function recordWAFailure(error?: Error | string): void {
  const circuitBreaker = getWACircuitBreaker();
  circuitBreaker.recordFailure(error);
}

/**
 * Get queue statistics
 */
export async function getQueueStats(organizationId?: string) {
  const queue = getWAMessageQueue();
  return queue.getStatistics(organizationId);
}

/**
 * Cancel a queued message
 */
export async function cancelQueuedMessage(messageId: string): Promise<boolean> {
  const queue = getWAMessageQueue();
  return queue.cancel(messageId);
}
