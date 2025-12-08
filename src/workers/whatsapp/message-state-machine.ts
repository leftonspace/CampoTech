/**
 * WhatsApp Message State Machine
 * ==============================
 *
 * Tracks message delivery states and handles status updates from webhooks.
 * Implements the WhatsApp message lifecycle:
 * queued → sent → delivered → read (or failed at any step)
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { PanicModeService } from './panic-mode.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type MessageState =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export interface MessageStatusUpdate {
  waMessageId: string;
  status: MessageState;
  timestamp: Date;
  errorCode?: number;
  errorTitle?: string;
  recipientId?: string;
}

export interface MessageRecord {
  id: string;
  waMessageId: string;
  organizationId: string;
  customerId: string;
  direction: 'inbound' | 'outbound';
  type: string;
  content: string;
  state: MessageState;
  stateHistory: StateTransition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StateTransition {
  from: MessageState | null;
  to: MessageState;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<MessageState | 'initial', MessageState[]> = {
  initial: ['queued', 'sent'], // Can start as queued or sent
  queued: ['sent', 'failed'],
  sent: ['delivered', 'failed'],
  delivered: ['read', 'failed'],
  read: [], // Terminal state
  failed: [], // Terminal state
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  from: MessageState | null,
  to: MessageState
): boolean {
  const key = from || 'initial';
  return VALID_TRANSITIONS[key]?.includes(to) ?? false;
}

/**
 * Process a status update from WhatsApp webhook
 */
export async function processStatusUpdate(
  update: MessageStatusUpdate
): Promise<{ success: boolean; error?: string }> {
  try {
    // Find the message by WhatsApp message ID
    const message = await db.waMessage.findFirst({
      where: { waMessageId: update.waMessageId },
    });

    if (!message) {
      log.warn('Message not found for status update', {
        waMessageId: update.waMessageId,
        status: update.status,
      });
      return { success: false, error: 'Message not found' };
    }

    const currentState = message.state as MessageState;

    // Check if transition is valid
    if (!isValidTransition(currentState, update.status)) {
      log.warn('Invalid state transition', {
        messageId: message.id,
        from: currentState,
        to: update.status,
      });
      // Still record it for debugging but don't change state
      return { success: true };
    }

    // Update state history
    const stateHistory = (message.stateHistory as StateTransition[]) || [];
    stateHistory.push({
      from: currentState,
      to: update.status,
      timestamp: update.timestamp.toISOString(),
      metadata: update.errorCode
        ? { errorCode: update.errorCode, errorTitle: update.errorTitle }
        : undefined,
    });

    // Update the message
    await db.waMessage.update({
      where: { id: message.id },
      data: {
        state: update.status,
        stateHistory,
        updatedAt: update.timestamp,
        errorCode: update.errorCode,
        errorTitle: update.errorTitle,
      },
    });

    log.info('Message state updated', {
      messageId: message.id,
      from: currentState,
      to: update.status,
    });

    // Handle failure - check if panic mode should be triggered
    if (update.status === 'failed') {
      await handleMessageFailure(message.organizationId, update);
    }

    return { success: true };
  } catch (error) {
    log.error('Error processing status update', {
      waMessageId: update.waMessageId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a new message record when sending
 */
export async function createMessageRecord(
  organizationId: string,
  customerId: string,
  waMessageId: string,
  direction: 'inbound' | 'outbound',
  type: string,
  content: string
): Promise<string> {
  const message = await db.waMessage.create({
    data: {
      organizationId,
      customerId,
      waMessageId,
      direction,
      type,
      content,
      state: direction === 'outbound' ? 'sent' : 'delivered',
      stateHistory: [
        {
          from: null,
          to: direction === 'outbound' ? 'sent' : 'delivered',
          timestamp: new Date().toISOString(),
        },
      ],
    },
  });

  return message.id;
}

/**
 * Get message delivery statistics for an organization
 */
export async function getDeliveryStats(
  organizationId: string,
  hoursBack: number = 24
): Promise<{
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
}> {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const messages = await db.waMessage.groupBy({
    by: ['state'],
    where: {
      organizationId,
      direction: 'outbound',
      createdAt: { gte: since },
    },
    _count: true,
  });

  const counts: Record<string, number> = {};
  let total = 0;

  for (const m of messages) {
    counts[m.state] = m._count;
    total += m._count;
  }

  const delivered = (counts.delivered || 0) + (counts.read || 0);

  return {
    total,
    sent: counts.sent || 0,
    delivered: counts.delivered || 0,
    read: counts.read || 0,
    failed: counts.failed || 0,
    deliveryRate: total > 0 ? delivered / total : 0,
    readRate: total > 0 ? (counts.read || 0) / total : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAILURE HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle message failure - check if panic mode should be triggered
 */
async function handleMessageFailure(
  organizationId: string,
  update: MessageStatusUpdate
): Promise<void> {
  // Check for specific error codes that might indicate rate limiting or blocking
  const criticalErrorCodes = [
    131047, // Outside 24-hour window
    131048, // Spam rate limit
    131049, // Recipient unavailable
    131051, // Account restricted
    131052, // Template paused
    131056, // Pair rate limit
  ];

  if (update.errorCode && criticalErrorCodes.includes(update.errorCode)) {
    log.warn('Critical WhatsApp error detected', {
      organizationId,
      errorCode: update.errorCode,
      errorTitle: update.errorTitle,
    });

    // Check failure rate
    const stats = await getDeliveryStats(organizationId, 1); // Last hour
    const failureRate = stats.total > 0 ? stats.failed / stats.total : 0;

    // If failure rate > 30% or critical spam error, consider panic mode
    if (failureRate > 0.3 || update.errorCode === 131048) {
      await PanicModeService.evaluate(organizationId, 'whatsapp', {
        failureRate,
        errorCode: update.errorCode,
        errorTitle: update.errorTitle,
        recentFailures: stats.failed,
        totalMessages: stats.total,
      });
    }
  }
}

/**
 * Get recent failed messages for debugging
 */
export async function getRecentFailures(
  organizationId: string,
  limit: number = 10
): Promise<
  Array<{
    id: string;
    waMessageId: string;
    errorCode?: number;
    errorTitle?: string;
    createdAt: Date;
  }>
> {
  const failures = await db.waMessage.findMany({
    where: {
      organizationId,
      state: 'failed',
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      waMessageId: true,
      errorCode: true,
      errorTitle: true,
      createdAt: true,
    },
  });

  return failures;
}

/**
 * Retry failed messages (batch operation)
 */
export async function retryFailedMessages(
  organizationId: string,
  messageIds?: string[]
): Promise<{ queued: number; skipped: number }> {
  const where = messageIds
    ? { id: { in: messageIds }, organizationId, state: 'failed' }
    : { organizationId, state: 'failed' };

  const messages = await db.waMessage.findMany({
    where,
    take: 100,
  });

  let queued = 0;
  let skipped = 0;

  for (const message of messages) {
    // Re-queue for sending
    try {
      await db.waOutboundQueue.create({
        data: {
          organizationId: message.organizationId,
          customerId: message.customerId,
          phone: '', // Would need to be looked up from customer
          type: message.type as 'template' | 'text',
          textBody: message.content,
          priority: 'normal',
          status: 'pending',
          retryCount: 0,
          scheduledAt: new Date(),
        },
      });
      queued++;
    } catch {
      skipped++;
    }
  }

  return { queued, skipped };
}
