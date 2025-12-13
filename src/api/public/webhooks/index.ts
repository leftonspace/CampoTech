/**
 * Webhook Module
 * ===============
 *
 * Exports for the webhook system.
 */

// Types and Constants
export { WEBHOOK_EVENT_TYPES, DEFAULT_RETRY_POLICY, DEFAULT_WEBHOOK_CONFIG } from './webhook.types';
export type {
  WebhookEventType,
  WebhookEvent,
  WebhookSubscription,
  RetryPolicy,
  DeliveryStatus,
  WebhookDelivery,
  DeliveryResult,
  WebhookConfig,
} from './webhook.types';

// Signature utilities
export {
  generateSignature,
  generateWebhookHeaders,
  verifySignature,
  verifyWebhookRequest,
  generateWebhookSecret,
  isValidWebhookSecret,
  SIGNATURE_VERSION,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  WEBHOOK_ID_HEADER,
  SIGNATURE_MAX_AGE_SECONDS,
} from './webhook.signature';

// Event emitter
export { WebhookEventEmitter, createWebhookEmitter } from './webhook.emitter';
export type { EmitEventOptions, EventEmitterConfig } from './webhook.emitter';

// Delivery worker
export { WebhookDeliveryWorker, createWebhookWorker } from './webhook.worker';
export type { WorkerStats } from './webhook.worker';
