/**
 * WhatsApp Webhook Module
 * =======================
 */

export {
  validateWebhookSignature,
  verifyWebhook,
  parseWebhookPayload,
  extractMessageContent,
  hasMedia,
  getMediaId,
  processWebhookEvents,
  wasMessageProcessed,
  markMessageProcessed,
  cleanupIdempotencyCache,
} from './webhook.handler';

export type { ParsedWebhookEvent, WebhookProcessContext } from './webhook.handler';
