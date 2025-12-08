/**
 * WhatsApp Webhook Handler
 * ========================
 *
 * Handles incoming webhook events from WhatsApp Business API.
 * Includes signature validation, message parsing, and status updates.
 */

import * as crypto from 'crypto';
import {
  WebhookPayload,
  WebhookValue,
  InboundMessage,
  MessageStatus,
  WAMessageRecord,
  WAConversation,
} from '../whatsapp.types';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNATURE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate webhook signature from Meta
 * Uses HMAC SHA-256 with app secret
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  if (!signature || !appSecret) {
    log.warn('Missing signature or app secret for webhook validation');
    return false;
  }

  try {
    // Signature format: sha256=<hash>
    const signatureHash = signature.replace('sha256=', '');

    const expectedHash = crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('hex');

    // Timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signatureHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );

    if (!isValid) {
      log.warn('Webhook signature validation failed');
    }

    return isValid;
  } catch (error) {
    log.error('Error validating webhook signature', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return false;
  }
}

/**
 * Verify webhook for Meta verification challenge
 */
export function verifyWebhook(
  mode: string,
  token: string,
  challenge: string,
  verifyToken: string
): string | null {
  if (mode === 'subscribe' && token === verifyToken) {
    log.info('Webhook verification successful');
    return challenge;
  }

  log.warn('Webhook verification failed', { mode, tokenMatch: token === verifyToken });
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK PARSING
// ═══════════════════════════════════════════════════════════════════════════════

export interface ParsedWebhookEvent {
  type: 'message' | 'status' | 'error';
  phoneNumberId: string;
  message?: InboundMessage;
  contact?: { name: string; waId: string };
  status?: MessageStatus;
  error?: { code: number; message: string };
}

/**
 * Parse webhook payload into events
 */
export function parseWebhookPayload(payload: WebhookPayload): ParsedWebhookEvent[] {
  const events: ParsedWebhookEvent[] = [];

  if (payload.object !== 'whatsapp_business_account') {
    log.warn('Invalid webhook object type', { object: payload.object });
    return events;
  }

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;

      const value = change.value;
      const phoneNumberId = value.metadata.phoneNumberId;

      // Process messages
      if (value.messages) {
        for (const message of value.messages) {
          const contact = value.contacts?.find((c) => c.waId === message.from);
          events.push({
            type: 'message',
            phoneNumberId,
            message,
            contact: contact
              ? { name: contact.profile.name, waId: contact.waId }
              : undefined,
          });
        }
      }

      // Process statuses
      if (value.statuses) {
        for (const status of value.statuses) {
          events.push({
            type: 'status',
            phoneNumberId,
            status,
          });
        }
      }

      // Process errors
      if (value.errors) {
        for (const error of value.errors) {
          events.push({
            type: 'error',
            phoneNumberId,
            error: { code: error.code, message: error.message },
          });
        }
      }
    }
  }

  return events;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract message content as text
 */
export function extractMessageContent(message: InboundMessage): string {
  switch (message.type) {
    case 'text':
      return message.text?.body || '';

    case 'image':
      return message.image?.caption || '[Imagen]';

    case 'audio':
      return '[Audio]';

    case 'video':
      return message.video?.caption || '[Video]';

    case 'document':
      return message.document?.filename || '[Documento]';

    case 'sticker':
      return '[Sticker]';

    case 'location':
      return message.location?.name || message.location?.address || '[Ubicación]';

    case 'contacts':
      const contactName = message.contacts?.[0]?.name.formattedName;
      return contactName ? `[Contacto: ${contactName}]` : '[Contacto]';

    case 'interactive':
      if (message.interactive?.buttonReply) {
        return message.interactive.buttonReply.title;
      }
      if (message.interactive?.listReply) {
        return message.interactive.listReply.title;
      }
      return '[Respuesta interactiva]';

    case 'button':
      return message.button?.text || '[Botón]';

    case 'reaction':
      return message.reaction?.emoji || '[Reacción]';

    default:
      return '[Mensaje no soportado]';
  }
}

/**
 * Check if message contains media
 */
export function hasMedia(message: InboundMessage): boolean {
  return ['image', 'audio', 'video', 'document', 'sticker'].includes(message.type);
}

/**
 * Get media ID from message
 */
export function getMediaId(message: InboundMessage): string | null {
  switch (message.type) {
    case 'image':
      return message.image?.id || null;
    case 'audio':
      return message.audio?.id || null;
    case 'video':
      return message.video?.id || null;
    case 'document':
      return message.document?.id || null;
    case 'sticker':
      return message.sticker?.id || null;
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

export interface WebhookProcessContext {
  orgId: string;
  phoneNumberId: string;
  onMessage: (message: InboundMessage, contactName?: string) => Promise<void>;
  onStatusUpdate: (status: MessageStatus) => Promise<void>;
  onError?: (error: { code: number; message: string }) => Promise<void>;
}

/**
 * Process webhook events
 */
export async function processWebhookEvents(
  events: ParsedWebhookEvent[],
  context: WebhookProcessContext
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  for (const event of events) {
    // Only process events for our phone number
    if (event.phoneNumberId !== context.phoneNumberId) {
      continue;
    }

    try {
      switch (event.type) {
        case 'message':
          if (event.message) {
            await context.onMessage(event.message, event.contact?.name);
            processed++;
          }
          break;

        case 'status':
          if (event.status) {
            await context.onStatusUpdate(event.status);
            processed++;
          }
          break;

        case 'error':
          if (event.error && context.onError) {
            await context.onError(event.error);
          }
          errors++;
          break;
      }
    } catch (error) {
      log.error('Error processing webhook event', {
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      errors++;
    }
  }

  return { processed, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY
// ═══════════════════════════════════════════════════════════════════════════════

const processedMessages = new Map<string, Date>();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if message was already processed
 */
export function wasMessageProcessed(messageId: string): boolean {
  const processed = processedMessages.get(messageId);
  if (!processed) return false;

  if (Date.now() - processed.getTime() > IDEMPOTENCY_TTL) {
    processedMessages.delete(messageId);
    return false;
  }

  return true;
}

/**
 * Mark message as processed
 */
export function markMessageProcessed(messageId: string): void {
  processedMessages.set(messageId, new Date());
}

/**
 * Clean up old idempotency records
 */
export function cleanupIdempotencyCache(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, date] of processedMessages.entries()) {
    if (now - date.getTime() > IDEMPOTENCY_TTL) {
      processedMessages.delete(id);
      cleaned++;
    }
  }

  return cleaned;
}
