/**
 * Webhook Bridge Service
 * ======================
 *
 * Provides a shared webhook emitter singleton for use across core modules.
 * This bridges the public API webhook system with internal domain events.
 */

import { Pool } from 'pg';
import { WebhookEventEmitter, createWebhookEmitter } from '../../api/public/webhooks';

// Singleton instance
let webhookEmitterInstance: WebhookEventEmitter | null = null;

/**
 * Initialize the shared webhook emitter
 * Should be called once at application startup
 */
export function initializeWebhookEmitter(pool: Pool): WebhookEventEmitter {
  if (!webhookEmitterInstance) {
    webhookEmitterInstance = createWebhookEmitter(pool, {
      enableLocalEmitter: true,
      enableEventLogging: process.env.NODE_ENV === 'development',
    });
  }
  return webhookEmitterInstance;
}

/**
 * Get the shared webhook emitter instance
 * Throws if not initialized
 */
export function getWebhookEmitter(): WebhookEventEmitter {
  if (!webhookEmitterInstance) {
    throw new Error('Webhook emitter not initialized. Call initializeWebhookEmitter first.');
  }
  return webhookEmitterInstance;
}

/**
 * Check if webhook emitter is initialized
 */
export function isWebhookEmitterInitialized(): boolean {
  return webhookEmitterInstance !== null;
}

/**
 * Emit webhook event safely (no-throw)
 * Logs errors but doesn't propagate them to avoid breaking business logic
 */
export async function emitWebhookSafe(
  orgId: string,
  type: string,
  data: Record<string, any>,
  metadata?: { actor_type?: 'user' | 'api' | 'system'; actor_id?: string }
): Promise<void> {
  if (!webhookEmitterInstance) {
    console.warn('[Webhook] Emitter not initialized, skipping event:', type);
    return;
  }

  try {
    await webhookEmitterInstance.emit({
      orgId,
      type: type as any,
      data,
      metadata,
    });
  } catch (error) {
    console.error('[Webhook] Failed to emit event:', type, error);
  }
}
