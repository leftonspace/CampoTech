/**
 * WhatsApp Message Queue
 * ======================
 *
 * Priority queue for WhatsApp messages with rate limiting.
 * Manages message ordering, retries, and expiration.
 */

import { prisma } from '@/lib/prisma';
import {
  QueuedMessage,
  MessagePayload,
  MessagePriority,
  QueueMessageStatus,
  QueueStatistics,
} from './types';
import { getOrgRateLimiter } from './rate-limiter';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [5000, 30000, 120000]; // 5s, 30s, 2min
const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const PRIORITY_ORDER: Record<MessagePriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE QUEUE
// ═══════════════════════════════════════════════════════════════════════════════

export class WhatsAppMessageQueue {
  private inMemoryQueue: QueuedMessage[] = [];
  private processing = false;
  private processInterval: NodeJS.Timeout | null = null;
  private onMessageReady: ((message: QueuedMessage) => Promise<boolean>) | null = null;

  constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // QUEUE OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Enqueue a message for sending
   */
  async enqueue(params: {
    organizationId: string;
    customerId?: string;
    phone: string;
    payload: MessagePayload;
    priority?: MessagePriority;
    scheduledAt?: Date;
    expiresAt?: Date;
    maxRetries?: number;
  }): Promise<QueuedMessage> {
    const message: QueuedMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      organizationId: params.organizationId,
      customerId: params.customerId,
      phone: params.phone,
      type: params.payload.type,
      priority: params.priority || 'normal',
      status: 'queued',
      payload: params.payload,
      retryCount: 0,
      maxRetries: params.maxRetries ?? DEFAULT_MAX_RETRIES,
      createdAt: new Date(),
      scheduledAt: params.scheduledAt || new Date(),
      expiresAt: params.expiresAt || new Date(Date.now() + DEFAULT_EXPIRY_MS),
    };

    // Try to persist to database
    try {
      await prisma.waOutboundQueue.create({
        data: {
          id: message.id,
          organizationId: message.organizationId,
          customerId: message.customerId || null,
          phone: message.phone,
          type: message.type,
          priority: message.priority,
          status: message.status,
          payload: message.payload as object,
          retryCount: message.retryCount,
          maxRetries: message.maxRetries,
          scheduledAt: message.scheduledAt,
          expiresAt: message.expiresAt,
        },
      });
    } catch (error) {
      // Fall back to in-memory queue
      console.warn('[WA Queue] Database write failed, using in-memory:', error);
      this.inMemoryQueue.push(message);
      this.sortQueue();
    }

    console.log('[WA Queue] Message enqueued:', {
      id: message.id,
      type: message.type,
      priority: message.priority,
      phone: message.phone.slice(-4),
    });

    return message;
  }

  /**
   * Enqueue a text message
   */
  async enqueueText(
    organizationId: string,
    phone: string,
    text: string,
    options: {
      customerId?: string;
      priority?: MessagePriority;
      previewUrl?: boolean;
    } = {}
  ): Promise<QueuedMessage> {
    return this.enqueue({
      organizationId,
      phone,
      customerId: options.customerId,
      priority: options.priority,
      payload: {
        type: 'text',
        body: text,
        previewUrl: options.previewUrl,
      },
    });
  }

  /**
   * Enqueue a template message
   */
  async enqueueTemplate(
    organizationId: string,
    phone: string,
    templateName: string,
    language: string,
    options: {
      customerId?: string;
      priority?: MessagePriority;
      components?: Array<{
        type: 'header' | 'body' | 'button';
        parameters: Array<{
          type: 'text' | 'image' | 'document' | 'video' | 'currency' | 'date_time';
          text?: string;
          image?: { link: string };
          document?: { link: string; filename?: string };
          video?: { link: string };
          currency?: { fallback_value: string; code: string; amount_1000: number };
          date_time?: { fallback_value: string };
        }>;
        sub_type?: 'quick_reply' | 'url';
        index?: number;
      }>;
    } = {}
  ): Promise<QueuedMessage> {
    return this.enqueue({
      organizationId,
      phone,
      customerId: options.customerId,
      priority: options.priority || 'high', // Templates are typically higher priority
      payload: {
        type: 'template',
        name: templateName,
        language,
        components: options.components,
      },
    });
  }

  /**
   * Get next messages ready for sending
   */
  async getNextBatch(limit: number = 10): Promise<QueuedMessage[]> {
    const now = new Date();
    const rateLimiter = getOrgRateLimiter();

    try {
      // Fetch from database
      const dbMessages = await prisma.waOutboundQueue.findMany({
        where: {
          status: 'queued',
          scheduledAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: [{ priority: 'asc' }, { scheduledAt: 'asc' }],
        take: limit * 2, // Fetch more to account for rate limiting
      });

      const messages: QueuedMessage[] = dbMessages.map((m: typeof dbMessages[number]) => ({
        id: m.id,
        organizationId: m.organizationId,
        customerId: m.customerId || undefined,
        phone: m.phone,
        type: (m.type as QueuedMessage['type']) || 'text',
        priority: (m.priority as MessagePriority) || 'normal',
        status: m.status as QueueMessageStatus,
        payload: m.payload as MessagePayload,
        retryCount: m.retryCount,
        maxRetries: m.maxRetries || DEFAULT_MAX_RETRIES,
        createdAt: m.createdAt,
        scheduledAt: m.scheduledAt,
        expiresAt: m.expiresAt || undefined,
        lastAttempt: m.lastAttempt || undefined,
        lastError: m.lastError || undefined,
        waMessageId: m.waMessageId || undefined,
      }));

      // Filter by rate limit
      const available: QueuedMessage[] = [];
      for (const msg of messages) {
        if (available.length >= limit) break;

        const canSend = rateLimiter.checkOrgLimit(msg.organizationId);
        if (canSend) {
          available.push(msg);
        }
      }

      return available;
    } catch {
      // Fall back to in-memory queue
      return this.inMemoryQueue
        .filter(
          (m) =>
            m.status === 'queued' &&
            m.scheduledAt <= now &&
            (!m.expiresAt || m.expiresAt > now)
        )
        .slice(0, limit);
    }
  }

  /**
   * Update message status
   */
  async updateStatus(
    messageId: string,
    status: QueueMessageStatus,
    extra?: {
      error?: string;
      waMessageId?: string;
    }
  ): Promise<void> {
    try {
      await prisma.waOutboundQueue.update({
        where: { id: messageId },
        data: {
          status,
          lastAttempt: new Date(),
          lastError: extra?.error,
          waMessageId: extra?.waMessageId,
          processedAt: ['sent', 'failed', 'expired'].includes(status)
            ? new Date()
            : undefined,
        },
      });
    } catch {
      // Update in-memory queue
      const msg = this.inMemoryQueue.find((m) => m.id === messageId);
      if (msg) {
        msg.status = status;
        msg.lastAttempt = new Date();
        if (extra?.error) msg.lastError = extra.error;
        if (extra?.waMessageId) msg.waMessageId = extra.waMessageId;
      }
    }
  }

  /**
   * Schedule a retry for a failed message
   */
  async scheduleRetry(messageId: string, error: string): Promise<boolean> {
    try {
      const message = await prisma.waOutboundQueue.findUnique({
        where: { id: messageId },
      });

      if (!message || message.retryCount >= (message.maxRetries || DEFAULT_MAX_RETRIES)) {
        return false;
      }

      const delay = RETRY_DELAYS_MS[message.retryCount] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      const scheduledAt = new Date(Date.now() + delay);

      await prisma.waOutboundQueue.update({
        where: { id: messageId },
        data: {
          status: 'queued',
          retryCount: message.retryCount + 1,
          scheduledAt,
          lastError: error,
          lastAttempt: new Date(),
        },
      });

      console.log('[WA Queue] Retry scheduled:', {
        messageId,
        retryCount: message.retryCount + 1,
        scheduledAt: scheduledAt.toISOString(),
      });

      return true;
    } catch {
      // Handle in-memory
      const msg = this.inMemoryQueue.find((m) => m.id === messageId);
      if (!msg || msg.retryCount >= msg.maxRetries) {
        return false;
      }

      const delay = RETRY_DELAYS_MS[msg.retryCount] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      msg.status = 'queued';
      msg.retryCount++;
      msg.scheduledAt = new Date(Date.now() + delay);
      msg.lastError = error;
      this.sortQueue();

      return true;
    }
  }

  /**
   * Cancel a queued message
   */
  async cancel(messageId: string): Promise<boolean> {
    try {
      const result = await prisma.waOutboundQueue.updateMany({
        where: { id: messageId, status: 'queued' },
        data: { status: 'expired' },
      });
      return result.count > 0;
    } catch {
      const idx = this.inMemoryQueue.findIndex(
        (m) => m.id === messageId && m.status === 'queued'
      );
      if (idx >= 0) {
        this.inMemoryQueue[idx].status = 'expired';
        return true;
      }
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATISTICS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get queue statistics
   */
  async getStatistics(organizationId?: string): Promise<QueueStatistics> {
    const rateLimiter = getOrgRateLimiter();
    const globalStatus = rateLimiter.getGlobalStatus();

    try {
      const where = organizationId ? { organizationId } : {};

      // Count by status
      const statusCounts = await prisma.waOutboundQueue.groupBy({
        by: ['status'],
        where,
        _count: true,
      });

      // Count by priority
      const priorityCounts = await prisma.waOutboundQueue.groupBy({
        by: ['priority'],
        where: { ...where, status: 'queued' },
        _count: true,
      });

      // Messages sent in last minute
      const oneMinuteAgo = new Date(Date.now() - 60000);
      const sentLastMinute = await prisma.waOutboundQueue.count({
        where: {
          ...where,
          status: 'sent',
          processedAt: { gte: oneMinuteAgo },
        },
      });

      // Messages sent in last hour
      const oneHourAgo = new Date(Date.now() - 3600000);
      const sentLastHour = await prisma.waOutboundQueue.count({
        where: {
          ...where,
          status: 'sent',
          processedAt: { gte: oneHourAgo },
        },
      });

      // Calculate avg wait time
      const recentSent = await prisma.waOutboundQueue.findMany({
        where: {
          ...where,
          status: 'sent',
          processedAt: { gte: oneMinuteAgo },
        },
        select: { createdAt: true, processedAt: true },
        take: 100,
      });

      let avgWaitTime = 0;
      if (recentSent.length > 0) {
        const totalWait = recentSent.reduce(
          (sum: number, m: typeof recentSent[number]) => {
            if (m.processedAt) {
              return sum + (m.processedAt.getTime() - m.createdAt.getTime());
            }
            return sum;
          },
          0
        );
        avgWaitTime = totalWait / recentSent.length;
      }

      const byStatus: Record<QueueMessageStatus, number> = {
        queued: 0,
        rate_limited: 0,
        sending: 0,
        sent: 0,
        failed: 0,
        expired: 0,
      };

      for (const stat of statusCounts) {
        if (stat.status in byStatus) {
          byStatus[stat.status as QueueMessageStatus] = stat._count;
        }
      }

      const byPriority: Record<MessagePriority, number> = {
        urgent: 0,
        high: 0,
        normal: 0,
        low: 0,
      };

      for (const stat of priorityCounts) {
        if (stat.priority in byPriority) {
          byPriority[stat.priority as MessagePriority] = stat._count;
        }
      }

      const totalQueued = Object.values(byPriority).reduce((a, b) => a + b, 0);
      const currentRate = globalStatus.sentThisSecond;

      // Determine health
      let health: 'healthy' | 'degraded' | 'overloaded' = 'healthy';
      if (globalStatus.queuedCount > 100 || byStatus.failed > byStatus.sent * 0.1) {
        health = 'degraded';
      }
      if (globalStatus.queuedCount > 500 || byStatus.failed > byStatus.sent * 0.3) {
        health = 'overloaded';
      }

      return {
        totalQueued,
        byPriority,
        byStatus,
        sentLastMinute,
        sentLastHour,
        currentRate,
        avgWaitTime,
        health,
      };
    } catch {
      // Return from in-memory queue
      return {
        totalQueued: this.inMemoryQueue.filter((m) => m.status === 'queued').length,
        byPriority: {
          urgent: this.inMemoryQueue.filter(
            (m) => m.status === 'queued' && m.priority === 'urgent'
          ).length,
          high: this.inMemoryQueue.filter(
            (m) => m.status === 'queued' && m.priority === 'high'
          ).length,
          normal: this.inMemoryQueue.filter(
            (m) => m.status === 'queued' && m.priority === 'normal'
          ).length,
          low: this.inMemoryQueue.filter(
            (m) => m.status === 'queued' && m.priority === 'low'
          ).length,
        },
        byStatus: {
          queued: this.inMemoryQueue.filter((m) => m.status === 'queued').length,
          rate_limited: this.inMemoryQueue.filter((m) => m.status === 'rate_limited')
            .length,
          sending: this.inMemoryQueue.filter((m) => m.status === 'sending').length,
          sent: this.inMemoryQueue.filter((m) => m.status === 'sent').length,
          failed: this.inMemoryQueue.filter((m) => m.status === 'failed').length,
          expired: this.inMemoryQueue.filter((m) => m.status === 'expired').length,
        },
        sentLastMinute: globalStatus.sentThisSecond,
        sentLastHour: 0,
        currentRate: globalStatus.sentThisSecond,
        avgWaitTime: 0,
        health: 'healthy',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INTERNAL METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  private sortQueue(): void {
    this.inMemoryQueue.sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    });
  }

  private cleanup(): void {
    const now = new Date();

    // Clean expired messages from in-memory queue
    this.inMemoryQueue = this.inMemoryQueue.filter((m) => {
      if (m.status === 'queued' && m.expiresAt && m.expiresAt < now) {
        m.status = 'expired';
        return false;
      }
      // Remove old completed messages
      if (['sent', 'failed', 'expired'].includes(m.status)) {
        const age = now.getTime() - m.createdAt.getTime();
        return age < 3600000; // Keep for 1 hour
      }
      return true;
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let messageQueue: WhatsAppMessageQueue | null = null;

export function getWAMessageQueue(): WhatsAppMessageQueue {
  if (!messageQueue) {
    messageQueue = new WhatsAppMessageQueue();
  }
  return messageQueue;
}

export function resetWAMessageQueue(): void {
  messageQueue = null;
}
