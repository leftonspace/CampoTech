/**
 * Message Aggregator Service
 * ==========================
 *
 * Phase 9.8: WhatsApp Conversational Intelligence
 * Aggregates sequential messages from customers before processing.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { Redis } from 'ioredis';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const AGGREGATION_WINDOW_MS = 8000; // 8 seconds
export const MAX_BUFFER_MESSAGES = 10;
export const CONTEXT_HISTORY_SIZE = 10;
export const CONTEXT_TTL_HOURS = 24;

// Trigger patterns for immediate processing (Argentine Spanish)
export const TRIGGER_PATTERNS = {
  REQUEST_VERBS: /necesito|quiero|pueden|vengan|arreglen|instalen|reparen|preciso/i,
  QUESTION_MARK: /\?$/,
  URGENCY: /urgente|emergencia|ahora|hoy|ya|rapido|rápido/i,
  ADDRESS: /calle|avenida|av\.|piso|depto|departamento|entre|esquina|altura/i,
  SCHEDULE: /mañana|lunes|martes|miércoles|jueves|viernes|sábado|domingo|semana/i,
  PRICE: /cuanto|cuánto|precio|cuesta|cobran|presupuesto/i,
};

export const LONG_MESSAGE_THRESHOLD = 100;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BufferedMessage {
  id: string;
  content: string;
  type: string;
  timestamp: number;
  mediaId?: string;
}

export interface MessageBuffer {
  organizationId: string;
  phone: string;
  messages: BufferedMessage[];
  createdAt: number;
  lastMessageAt: number;
  triggeredAt?: number;
  triggerReason?: string;
}

export interface ConversationContext {
  phone: string;
  messages: Array<{
    content: string;
    sender: 'customer' | 'business';
    timestamp: number;
  }>;
  customerId?: string;
  customerName?: string;
  activeJobId?: string;
  previousRequests: string[];
  lastMessageAt: Date;
}

export interface AggregationResult {
  shouldProcess: boolean;
  combinedContent: string;
  messageCount: number;
  context?: ConversationContext;
  triggerReason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE AGGREGATOR SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class MessageAggregatorService {
  private redis: Redis | null = null;

  constructor() {
    this.initRedis();
  }

  private async initRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = new Redis(redisUrl);
      log.info('MessageAggregator Redis connected');
    } catch (error) {
      log.warn('Redis not available, using immediate processing', { error });
      this.redis = null;
    }
  }

  /**
   * Handle incoming message - either buffer or process immediately
   */
  async handleMessage(
    organizationId: string,
    phone: string,
    message: BufferedMessage
  ): Promise<AggregationResult | null> {
    // If Redis not available, process immediately
    if (!this.redis) {
      return this.processImmediately(organizationId, phone, message);
    }

    const bufferKey = `msgbuf:${organizationId}:${phone}`;

    try {
      // Check for existing buffer
      const existingBuffer = await this.getBuffer(bufferKey);

      if (existingBuffer) {
        // Append to existing buffer
        existingBuffer.messages.push(message);
        existingBuffer.lastMessageAt = Date.now();

        // Check if should trigger immediately
        const triggerResult = this.checkTrigger(existingBuffer);

        if (triggerResult.shouldTrigger) {
          // Process immediately
          await this.clearBuffer(bufferKey);
          return this.processBuffer(organizationId, phone, existingBuffer, triggerResult.reason);
        }

        // Update buffer and reset timer
        await this.saveBuffer(bufferKey, existingBuffer);
        return null; // Wait for timer or next message
      }

      // Create new buffer
      const newBuffer: MessageBuffer = {
        organizationId,
        phone,
        messages: [message],
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
      };

      // Check if first message triggers immediate processing
      const triggerResult = this.checkTrigger(newBuffer);

      if (triggerResult.shouldTrigger) {
        return this.processBuffer(organizationId, phone, newBuffer, triggerResult.reason);
      }

      // Save buffer with TTL
      await this.saveBuffer(bufferKey, newBuffer);

      // Schedule timeout processing
      await this.scheduleTimeout(bufferKey, organizationId, phone);

      return null; // Wait for timer or next message
    } catch (error) {
      log.error('Error in message aggregation', {
        organizationId,
        phone,
        error: error instanceof Error ? error.message : 'Unknown',
      });

      // Fallback to immediate processing
      return this.processImmediately(organizationId, phone, message);
    }
  }

  /**
   * Process buffer after timeout (called by worker)
   */
  async processTimeout(bufferKey: string): Promise<AggregationResult | null> {
    if (!this.redis) return null;

    const buffer = await this.getBuffer(bufferKey);
    if (!buffer) return null;

    await this.clearBuffer(bufferKey);
    return this.processBuffer(buffer.organizationId, buffer.phone, buffer, 'timeout');
  }

  /**
   * Check if buffer should trigger immediate processing
   */
  private checkTrigger(buffer: MessageBuffer): { shouldTrigger: boolean; reason?: string } {
    const lastMessage = buffer.messages[buffer.messages.length - 1];

    // Voice message - usually complete request
    if (lastMessage.type === 'audio' || lastMessage.type === 'voice') {
      return { shouldTrigger: true, reason: 'voice_message' };
    }

    // Long message - likely complete thought
    if (lastMessage.content.length > LONG_MESSAGE_THRESHOLD) {
      return { shouldTrigger: true, reason: 'long_message' };
    }

    // Question mark - expecting answer
    if (TRIGGER_PATTERNS.QUESTION_MARK.test(lastMessage.content)) {
      return { shouldTrigger: true, reason: 'question' };
    }

    // Request verbs
    if (TRIGGER_PATTERNS.REQUEST_VERBS.test(lastMessage.content)) {
      return { shouldTrigger: true, reason: 'request_verb' };
    }

    // Urgency words
    if (TRIGGER_PATTERNS.URGENCY.test(lastMessage.content)) {
      return { shouldTrigger: true, reason: 'urgency' };
    }

    // Address patterns - booking intent
    if (TRIGGER_PATTERNS.ADDRESS.test(lastMessage.content)) {
      return { shouldTrigger: true, reason: 'address' };
    }

    // Schedule patterns
    if (TRIGGER_PATTERNS.SCHEDULE.test(lastMessage.content)) {
      return { shouldTrigger: true, reason: 'schedule' };
    }

    // Price inquiry
    if (TRIGGER_PATTERNS.PRICE.test(lastMessage.content)) {
      return { shouldTrigger: true, reason: 'price_inquiry' };
    }

    // Max buffer size reached
    if (buffer.messages.length >= MAX_BUFFER_MESSAGES) {
      return { shouldTrigger: true, reason: 'max_buffer' };
    }

    return { shouldTrigger: false };
  }

  /**
   * Process buffer and return aggregated result
   */
  private async processBuffer(
    organizationId: string,
    phone: string,
    buffer: MessageBuffer,
    triggerReason: string
  ): Promise<AggregationResult> {
    // Load conversation context
    const context = await this.loadContext(organizationId, phone);

    // Combine all messages
    const combinedContent = buffer.messages
      .map((m) => m.content)
      .join('\n');

    // Update context with new messages
    await this.updateContext(organizationId, phone, buffer.messages, context);

    // Track stats
    await this.trackAggregation(organizationId, buffer.messages.length, triggerReason);

    return {
      shouldProcess: true,
      combinedContent,
      messageCount: buffer.messages.length,
      context,
      triggerReason,
    };
  }

  /**
   * Process message immediately (fallback)
   */
  private async processImmediately(
    organizationId: string,
    phone: string,
    message: BufferedMessage
  ): Promise<AggregationResult> {
    const context = await this.loadContext(organizationId, phone);

    return {
      shouldProcess: true,
      combinedContent: message.content,
      messageCount: 1,
      context,
      triggerReason: 'immediate',
    };
  }

  /**
   * Load conversation context from database
   */
  async loadContext(organizationId: string, phone: string): Promise<ConversationContext | undefined> {
    const dbContext = await db.conversationContext.findUnique({
      where: {
        organizationId_customerPhone: {
          organizationId,
          customerPhone: phone,
        },
      },
    });

    if (!dbContext) return undefined;

    return {
      phone,
      messages: (dbContext.messageHistory as any[]) || [],
      customerId: dbContext.customerId || undefined,
      customerName: dbContext.customerName || undefined,
      activeJobId: dbContext.activeJobId || undefined,
      previousRequests: dbContext.previousRequests || [],
      lastMessageAt: dbContext.lastMessageAt,
    };
  }

  /**
   * Update conversation context
   */
  private async updateContext(
    organizationId: string,
    phone: string,
    newMessages: BufferedMessage[],
    existingContext?: ConversationContext
  ): Promise<void> {
    const messages = existingContext?.messages || [];

    // Add new messages
    for (const msg of newMessages) {
      messages.push({
        content: msg.content,
        sender: 'customer',
        timestamp: msg.timestamp,
      });
    }

    // Keep only last N messages
    const trimmedMessages = messages.slice(-CONTEXT_HISTORY_SIZE);

    // Look up customer if not identified
    let customerId = existingContext?.customerId;
    let customerName = existingContext?.customerName;

    if (!customerId) {
      const customer = await db.customer.findFirst({
        where: {
          organizationId,
          phone: { contains: phone.slice(-10) },
        },
      });

      if (customer) {
        customerId = customer.id;
        customerName = customer.name;
      }
    }

    // Look for active job
    let activeJobId = existingContext?.activeJobId;
    if (customerId && !activeJobId) {
      const activeJob = await db.job.findFirst({
        where: {
          customerId,
          status: { in: ['scheduled', 'en_camino', 'working'] },
        },
        orderBy: { scheduledDate: 'asc' },
      });

      if (activeJob) {
        activeJobId = activeJob.id;
      }
    }

    // Upsert context
    await db.conversationContext.upsert({
      where: {
        organizationId_customerPhone: {
          organizationId,
          customerPhone: phone,
        },
      },
      create: {
        organizationId,
        customerPhone: phone,
        messageHistory: trimmedMessages,
        customerId,
        customerName,
        activeJobId,
        lastMessageAt: new Date(),
        expiresAt: new Date(Date.now() + CONTEXT_TTL_HOURS * 60 * 60 * 1000),
      },
      update: {
        messageHistory: trimmedMessages,
        customerId,
        customerName,
        activeJobId,
        lastMessageAt: new Date(),
        expiresAt: new Date(Date.now() + CONTEXT_TTL_HOURS * 60 * 60 * 1000),
      },
    });
  }

  /**
   * Track aggregation statistics
   */
  private async trackAggregation(
    organizationId: string,
    messageCount: number,
    triggerReason: string
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    try {
      await db.messageBufferStats.upsert({
        where: {
          organizationId_date: {
            organizationId,
            date: new Date(today),
          },
        },
        create: {
          organizationId,
          date: new Date(today),
          totalBuffersCreated: 1,
          totalMessagesAggregated: messageCount,
          totalImmediateTriggers: triggerReason !== 'timeout' ? 1 : 0,
          totalTimeoutTriggers: triggerReason === 'timeout' ? 1 : 0,
        },
        update: {
          totalBuffersCreated: { increment: 1 },
          totalMessagesAggregated: { increment: messageCount },
          totalImmediateTriggers:
            triggerReason !== 'timeout' ? { increment: 1 } : undefined,
          totalTimeoutTriggers:
            triggerReason === 'timeout' ? { increment: 1 } : undefined,
        },
      });
    } catch (error) {
      log.warn('Failed to track aggregation stats', { error });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // REDIS OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  private async getBuffer(key: string): Promise<MessageBuffer | null> {
    if (!this.redis) return null;

    const data = await this.redis.get(key);
    if (!data) return null;

    return JSON.parse(data);
  }

  private async saveBuffer(key: string, buffer: MessageBuffer): Promise<void> {
    if (!this.redis) return;

    // Save with TTL slightly longer than aggregation window
    await this.redis.setex(key, Math.ceil(AGGREGATION_WINDOW_MS / 1000) + 5, JSON.stringify(buffer));
  }

  private async clearBuffer(key: string): Promise<void> {
    if (!this.redis) return;

    await this.redis.del(key);
  }

  private async scheduleTimeout(
    bufferKey: string,
    organizationId: string,
    phone: string
  ): Promise<void> {
    if (!this.redis) return;

    // Use Redis keyspace notifications or a scheduled job
    // For now, we'll rely on the TTL and a worker polling for expired buffers
    const timeoutKey = `msgbuf_timeout:${organizationId}:${phone}`;
    await this.redis.setex(
      timeoutKey,
      Math.ceil(AGGREGATION_WINDOW_MS / 1000),
      bufferKey
    );
  }
}

// Singleton instance
let aggregatorInstance: MessageAggregatorService | null = null;

export function getMessageAggregator(): MessageAggregatorService {
  if (!aggregatorInstance) {
    aggregatorInstance = new MessageAggregatorService();
  }
  return aggregatorInstance;
}
