/**
 * Shared Services
 * ===============
 *
 * Cross-cutting services used by multiple modules.
 */

export {
  initializeWebhookEmitter,
  getWebhookEmitter,
  isWebhookEmitterInitialized,
  emitWebhookSafe,
} from './webhook-bridge';
