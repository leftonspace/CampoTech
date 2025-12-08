/**
 * MercadoPago Webhook Module
 * ==========================
 *
 * Webhook handling and signature validation
 */

export {
  validateWebhookSignature,
  validateSimpleSignature,
  generateIdempotencyKey,
  wasWebhookProcessed,
  markWebhookProcessed,
  cleanupIdempotencyCache,
  parseWebhookNotification,
  fetchPayment,
  processWebhook,
  mapPaymentStatus,
  isPaymentFinal,
  paymentRequiresAction,
} from './webhook.handler';

export type { WebhookContext } from './webhook.handler';
