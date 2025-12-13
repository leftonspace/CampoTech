/**
 * WhatsApp Outbound Worker
 * ========================
 *
 * Processes outbound WhatsApp messages with:
 * - Rate limiting (50 messages/minute per organization)
 * - Priority queue (high/normal/low)
 * - Retry with exponential backoff
 * - SMS fallback for failed deliveries
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { sendTemplateMessage, sendTextMessage } from '../../integrations/whatsapp/messages';
import { WhatsAppConfig } from '../../integrations/whatsapp/whatsapp.types';
import { getOrganizationWAConfig } from '../../integrations/whatsapp/customer';
import { getCapabilityService, CapabilityPath } from '../../../core/config/capabilities';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const RATE_LIMIT_PER_MINUTE = 50;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000]; // 5s, 30s, 2min
const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 10;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface OutboundMessage {
  id: string;
  organizationId: string;
  customerId: string;
  phone: string;
  type: 'template' | 'text';
  templateName?: string;
  templateLanguage?: string;
  templateParams?: Record<string, string>;
  textBody?: string;
  priority: 'high' | 'normal' | 'low';
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'fallback_sms';
  retryCount: number;
  lastError?: string;
  scheduledAt: Date;
  createdAt: Date;
}

interface RateLimitState {
  count: number;
  windowStart: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER
// ═══════════════════════════════════════════════════════════════════════════════

const rateLimiters: Map<string, RateLimitState> = new Map();

function checkRateLimit(organizationId: string): boolean {
  const now = Date.now();
  let state = rateLimiters.get(organizationId);

  if (!state || now - state.windowStart >= RATE_LIMIT_WINDOW_MS) {
    state = { count: 0, windowStart: now };
    rateLimiters.set(organizationId, state);
  }

  return state.count < RATE_LIMIT_PER_MINUTE;
}

function incrementRateLimit(organizationId: string): void {
  const state = rateLimiters.get(organizationId);
  if (state) {
    state.count++;
  }
}

function getWaitTime(organizationId: string): number {
  const state = rateLimiters.get(organizationId);
  if (!state) return 0;

  const elapsed = Date.now() - state.windowStart;
  if (elapsed >= RATE_LIMIT_WINDOW_MS) return 0;

  return state.count >= RATE_LIMIT_PER_MINUTE ? RATE_LIMIT_WINDOW_MS - elapsed : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER STATE
// ═══════════════════════════════════════════════════════════════════════════════

let isRunning = false;
let pollTimeout: NodeJS.Timeout | null = null;

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Enqueue a message for sending
 */
export async function enqueueMessage(
  message: Omit<OutboundMessage, 'id' | 'status' | 'retryCount' | 'createdAt'>
): Promise<string> {
  const created = await db.waOutboundQueue.create({
    data: {
      organizationId: message.organizationId,
      customerId: message.customerId,
      phone: message.phone,
      type: message.type,
      templateName: message.templateName,
      templateLanguage: message.templateLanguage || 'es_AR',
      templateParams: message.templateParams || {},
      textBody: message.textBody,
      priority: message.priority,
      status: 'pending',
      retryCount: 0,
      scheduledAt: message.scheduledAt,
    },
  });

  log.info('Message enqueued', {
    messageId: created.id,
    organizationId: message.organizationId,
    type: message.type,
    priority: message.priority,
  });

  return created.id;
}

/**
 * Enqueue a template message
 */
export async function enqueueTemplateMessage(
  organizationId: string,
  customerId: string,
  phone: string,
  templateName: string,
  params: Record<string, string>,
  options: { priority?: 'high' | 'normal' | 'low'; scheduledAt?: Date } = {}
): Promise<string> {
  return enqueueMessage({
    organizationId,
    customerId,
    phone,
    type: 'template',
    templateName,
    templateParams: params,
    priority: options.priority || 'normal',
    scheduledAt: options.scheduledAt || new Date(),
  });
}

/**
 * Enqueue a text message (only works within 24-hour window)
 */
export async function enqueueTextMessage(
  organizationId: string,
  customerId: string,
  phone: string,
  text: string,
  options: { priority?: 'high' | 'normal' | 'low'; scheduledAt?: Date } = {}
): Promise<string> {
  return enqueueMessage({
    organizationId,
    customerId,
    phone,
    type: 'text',
    textBody: text,
    priority: options.priority || 'normal',
    scheduledAt: options.scheduledAt || new Date(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchPendingMessages(): Promise<OutboundMessage[]> {
  const messages = await db.waOutboundQueue.findMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: new Date() },
    },
    orderBy: [
      { priority: 'asc' }, // high=1, normal=2, low=3
      { scheduledAt: 'asc' },
    ],
    take: BATCH_SIZE * 5, // Fetch more to allow for rate limiting
  });

  return messages.map((m) => ({
    id: m.id,
    organizationId: m.organizationId,
    customerId: m.customerId,
    phone: m.phone,
    type: m.type as 'template' | 'text',
    templateName: m.templateName || undefined,
    templateLanguage: m.templateLanguage || undefined,
    templateParams: m.templateParams as Record<string, string> | undefined,
    textBody: m.textBody || undefined,
    priority: m.priority as 'high' | 'normal' | 'low',
    status: m.status as OutboundMessage['status'],
    retryCount: m.retryCount,
    lastError: m.lastError || undefined,
    scheduledAt: m.scheduledAt,
    createdAt: m.createdAt,
  }));
}

async function processMessage(
  message: OutboundMessage,
  config: WhatsAppConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    if (message.type === 'template' && message.templateName) {
      const result = await sendTemplateMessage(
        config,
        message.phone,
        {
          name: message.templateName,
          language: message.templateLanguage || 'es_AR',
          components: buildTemplateComponents(message.templateParams || {}),
        }
      );

      if (result.success) {
        return { success: true };
      }
      return { success: false, error: result.error };
    } else if (message.type === 'text' && message.textBody) {
      const result = await sendTextMessage(
        config,
        message.phone,
        message.textBody
      );

      if (result.success) {
        return { success: true };
      }

      // Check if outside 24-hour window
      if (result.isOutsideWindow) {
        return {
          success: false,
          error: 'Outside 24-hour window - use template message',
        };
      }

      return { success: false, error: result.error };
    }

    return { success: false, error: 'Invalid message type or missing content' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function buildTemplateComponents(
  params: Record<string, string>
): Array<{ type: string; parameters: Array<{ type: string; text: string }> }> {
  const components = [];

  // Group parameters by component type
  // Assumes params are numbered: 1, 2, 3... for body
  type ParamEntry = [string, string];
  const bodyParams = (Object.entries(params) as ParamEntry[])
    .filter(([key]: ParamEntry) => !key.startsWith('header_') && !key.startsWith('button_'))
    .sort(([a]: ParamEntry, [b]: ParamEntry) => Number(a) - Number(b))
    .map(([, value]: ParamEntry) => ({ type: 'text' as const, text: value }));

  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams,
    });
  }

  // Header parameters (header_1, header_2, etc.)
  const headerParams = (Object.entries(params) as ParamEntry[])
    .filter(([key]: ParamEntry) => key.startsWith('header_'))
    .sort(([a]: ParamEntry, [b]: ParamEntry) => Number(a.replace('header_', '')) - Number(b.replace('header_', '')))
    .map(([, value]: ParamEntry) => ({ type: 'text' as const, text: value }));

  if (headerParams.length > 0) {
    components.push({
      type: 'header',
      parameters: headerParams,
    });
  }

  return components;
}

async function updateMessageStatus(
  messageId: string,
  status: OutboundMessage['status'],
  error?: string,
  waMessageId?: string
): Promise<void> {
  await db.waOutboundQueue.update({
    where: { id: messageId },
    data: {
      status,
      lastError: error,
      waMessageId,
      processedAt: status === 'sent' || status === 'failed' ? new Date() : undefined,
    },
  });
}

async function scheduleRetry(message: OutboundMessage): Promise<boolean> {
  if (message.retryCount >= MAX_RETRIES) {
    return false;
  }

  const delay = RETRY_DELAYS_MS[message.retryCount] || RETRY_DELAYS_MS[MAX_RETRIES - 1];
  const scheduledAt = new Date(Date.now() + delay);

  await db.waOutboundQueue.update({
    where: { id: message.id },
    data: {
      status: 'pending',
      retryCount: message.retryCount + 1,
      scheduledAt,
    },
  });

  log.info('Message scheduled for retry', {
    messageId: message.id,
    retryCount: message.retryCount + 1,
    scheduledAt: scheduledAt.toISOString(),
  });

  return true;
}

async function triggerSMSFallback(message: OutboundMessage): Promise<void> {
  log.warn('Triggering SMS fallback', {
    messageId: message.id,
    phone: message.phone,
  });

  await updateMessageStatus(message.id, 'fallback_sms', 'Max retries exceeded');

  // Create SMS job in SMS outbound queue
  await db.smsOutboundQueue.create({
    data: {
      organizationId: message.organizationId,
      customerId: message.customerId,
      phone: message.phone,
      body: message.textBody || `Mensaje de ${message.templateName}`,
      status: 'pending',
      source: 'whatsapp_fallback',
      sourceMessageId: message.id,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER LOOP
// ═══════════════════════════════════════════════════════════════════════════════

async function processBatch(): Promise<void> {
  if (!isRunning) return;

  try {
    // Check capability system
    const capabilityService = getCapabilityService();
    const whatsappEnabled = await capabilityService.ensure('external.whatsapp' as CapabilityPath);
    const queueEnabled = await capabilityService.ensure('services.whatsapp_queue' as CapabilityPath);

    if (!whatsappEnabled || !queueEnabled) {
      log.warn('WhatsApp capability disabled, skipping batch', {
        whatsappEnabled,
        queueEnabled,
      });
      scheduleNextPoll();
      return;
    }

    const messages = await fetchPendingMessages();

    if (messages.length === 0) {
      scheduleNextPoll();
      return;
    }

    // Group messages by organization
    const byOrg = new Map<string, OutboundMessage[]>();
    for (const message of messages) {
      const list = byOrg.get(message.organizationId) || [];
      list.push(message);
      byOrg.set(message.organizationId, list);
    }

    // Process each organization respecting rate limits
    for (const [orgId, orgMessages] of byOrg) {
      // Check rate limit
      if (!checkRateLimit(orgId)) {
        const waitTime = getWaitTime(orgId);
        log.debug('Rate limit reached', { orgId, waitTime });
        continue;
      }

      // Get org config
      const waConfig = await getOrganizationWAConfig(orgId);
      if (!waConfig) {
        log.warn('Organization WhatsApp not configured', { orgId });
        continue;
      }

      const config: WhatsAppConfig = {
        phoneNumberId: waConfig.phoneNumberId,
        businessAccountId: waConfig.businessAccountId,
        accessToken: waConfig.accessToken,
        webhookVerifyToken: '',
        appSecret: '',
        apiVersion: 'v18.0',
      };

      // Process messages for this org
      for (const message of orgMessages.slice(0, BATCH_SIZE)) {
        if (!checkRateLimit(orgId)) break;

        // Mark as sending
        await updateMessageStatus(message.id, 'sending');

        const result = await processMessage(message, config);
        incrementRateLimit(orgId);

        if (result.success) {
          await updateMessageStatus(message.id, 'sent');
          log.info('Message sent', {
            messageId: message.id,
            type: message.type,
          });
        } else {
          log.error('Failed to send message', {
            messageId: message.id,
            error: result.error,
          });

          // Try retry
          const scheduled = await scheduleRetry(message);
          if (!scheduled) {
            // Max retries exceeded, fallback to SMS
            await triggerSMSFallback(message);
          }
        }
      }
    }
  } catch (error) {
    log.error('Error processing message batch', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  scheduleNextPoll();
}

function scheduleNextPoll(): void {
  if (!isRunning) return;
  pollTimeout = setTimeout(processBatch, POLL_INTERVAL_MS);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start the outbound worker
 */
export function startWorker(): void {
  if (isRunning) {
    log.warn('WhatsApp outbound worker already running');
    return;
  }

  isRunning = true;
  log.info('WhatsApp outbound worker started');
  processBatch();
}

/**
 * Stop the outbound worker
 */
export function stopWorker(): void {
  isRunning = false;
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
  log.info('WhatsApp outbound worker stopped');
}

/**
 * Get worker status
 */
export function getWorkerStatus(): {
  running: boolean;
  rateLimiters: Array<{ orgId: string; count: number; windowStart: number }>;
} {
  return {
    running: isRunning,
    rateLimiters: Array.from(rateLimiters.entries()).map(([orgId, state]) => ({
      orgId,
      count: state.count,
      windowStart: state.windowStart,
    })),
  };
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  fallbackSms: number;
}> {
  const stats = await db.waOutboundQueue.groupBy({
    by: ['status'],
    _count: true,
  });

  const result = {
    pending: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    fallbackSms: 0,
  };

  for (const stat of stats) {
    switch (stat.status) {
      case 'pending':
        result.pending = stat._count;
        break;
      case 'sending':
        result.sending = stat._count;
        break;
      case 'sent':
        result.sent = stat._count;
        break;
      case 'failed':
        result.failed = stat._count;
        break;
      case 'fallback_sms':
        result.fallbackSms = stat._count;
        break;
    }
  }

  return result;
}
