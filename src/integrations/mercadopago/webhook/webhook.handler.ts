/**
 * MercadoPago Webhook Handler
 * ===========================
 *
 * Handles incoming webhook notifications from MercadoPago.
 * Includes signature validation, idempotency, and payment status processing.
 */

import * as crypto from 'crypto';
import {
  WebhookNotification,
  WebhookProcessResult,
  WebhookAction,
  Payment,
  PaymentStatus,
} from '../mercadopago.types';
import { makeAuthenticatedRequest } from '../oauth';
import { parseExternalReference } from '../preference';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNATURE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate webhook signature (x-signature header)
 * MercadoPago uses HMAC-SHA256 for webhook signatures
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  requestId?: string,
  timestamp?: string
): boolean {
  if (!signature || !secret) {
    log.warn('Missing signature or secret for webhook validation');
    return false;
  }

  try {
    // Parse the x-signature header
    // Format: ts=<timestamp>,v1=<signature>
    const signatureParts: Record<string, string> = {};
    signature.split(',').forEach((part) => {
      const [key, value] = part.split('=');
      if (key && value) {
        signatureParts[key.trim()] = value.trim();
      }
    });

    const ts = signatureParts['ts'] || timestamp;
    const v1 = signatureParts['v1'];

    if (!v1) {
      log.warn('No v1 signature found in header');
      return false;
    }

    // Build the signed payload
    // Template: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
    let manifest = '';
    if (requestId) {
      manifest += `id:${requestId};`;
    }
    if (ts) {
      manifest += `ts:${ts};`;
    }
    manifest += payload;

    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    // Timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(v1, 'hex'),
      Buffer.from(expectedSignature, 'hex')
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
 * Simple signature validation for older webhook format
 */
export function validateSimpleSignature(
  dataId: string,
  timestamp: string,
  signature: string,
  secret: string
): boolean {
  const signedPayload = `${dataId}:${timestamp}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY
// ═══════════════════════════════════════════════════════════════════════════════

const processedWebhooks = new Map<string, { processedAt: Date; result: WebhookProcessResult }>();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate idempotency key for webhook
 */
export function generateIdempotencyKey(notification: WebhookNotification): string {
  return `mp-webhook:${notification.id}:${notification.action}:${notification.data.id}`;
}

/**
 * Check if webhook was already processed
 */
export function wasWebhookProcessed(key: string): WebhookProcessResult | null {
  const cached = processedWebhooks.get(key);
  if (!cached) return null;

  // Check TTL
  if (Date.now() - cached.processedAt.getTime() > IDEMPOTENCY_TTL) {
    processedWebhooks.delete(key);
    return null;
  }

  return cached.result;
}

/**
 * Mark webhook as processed
 */
export function markWebhookProcessed(key: string, result: WebhookProcessResult): void {
  processedWebhooks.set(key, {
    processedAt: new Date(),
    result,
  });
}

/**
 * Clean up old idempotency records
 */
export function cleanupIdempotencyCache(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of processedWebhooks.entries()) {
    if (now - value.processedAt.getTime() > IDEMPOTENCY_TTL) {
      processedWebhooks.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK PARSING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse webhook notification from request body
 */
export function parseWebhookNotification(body: unknown): WebhookNotification | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const raw = body as Record<string, unknown>;

  // Validate required fields
  if (typeof raw.id !== 'number' && typeof raw.id !== 'string') return null;
  if (typeof raw.type !== 'string') return null;
  if (typeof raw.action !== 'string') return null;
  if (!raw.data || typeof raw.data !== 'object') return null;

  const data = raw.data as Record<string, unknown>;
  if (typeof data.id !== 'string' && typeof data.id !== 'number') return null;

  return {
    id: typeof raw.id === 'string' ? parseInt(raw.id, 10) : raw.id,
    liveMode: raw.live_mode === true,
    type: raw.type as WebhookNotification['type'],
    dateCreated: typeof raw.date_created === 'string' ? raw.date_created : new Date().toISOString(),
    userId: typeof raw.user_id === 'number' ? raw.user_id : 0,
    apiVersion: typeof raw.api_version === 'string' ? raw.api_version : 'v1',
    action: raw.action as WebhookAction,
    data: {
      id: String(data.id),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT FETCHING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch payment details from MercadoPago
 */
export async function fetchPayment(
  accessToken: string,
  paymentId: string
): Promise<{ success: true; payment: Payment } | { success: false; error: string }> {
  const result = await makeAuthenticatedRequest<Payment>(
    accessToken,
    'GET',
    `/v1/payments/${paymentId}`
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, payment: result.data };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

export interface WebhookContext {
  accessToken: string;
  webhookSecret?: string;
  onPaymentUpdate?: (payment: Payment, invoiceId: string, orgId: string) => Promise<void>;
}

/**
 * Process a webhook notification
 */
export async function processWebhook(
  notification: WebhookNotification,
  context: WebhookContext
): Promise<WebhookProcessResult> {
  const idempotencyKey = generateIdempotencyKey(notification);

  // Check idempotency
  const existing = wasWebhookProcessed(idempotencyKey);
  if (existing) {
    log.info('Webhook already processed', { idempotencyKey });
    return existing;
  }

  log.info('Processing webhook', {
    type: notification.type,
    action: notification.action,
    dataId: notification.data.id,
  });

  let result: WebhookProcessResult;

  try {
    switch (notification.type) {
      case 'payment':
        result = await processPaymentWebhook(notification, context);
        break;

      case 'chargebacks':
        result = await processChargebackWebhook(notification, context);
        break;

      case 'merchant_orders':
        result = {
          success: true,
          action: notification.action,
        };
        break;

      default:
        result = {
          success: false,
          action: notification.action,
          error: `Unknown webhook type: ${notification.type}`,
        };
    }
  } catch (error) {
    result = {
      success: false,
      action: notification.action,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Mark as processed
  markWebhookProcessed(idempotencyKey, result);

  return result;
}

/**
 * Process payment webhook
 */
async function processPaymentWebhook(
  notification: WebhookNotification,
  context: WebhookContext
): Promise<WebhookProcessResult> {
  const paymentId = notification.data.id;

  // Fetch payment details
  const fetchResult = await fetchPayment(context.accessToken, paymentId);
  if (!fetchResult.success) {
    return {
      success: false,
      action: notification.action,
      paymentId,
      error: fetchResult.error,
    };
  }

  const payment = fetchResult.payment;

  // Parse external reference to get invoice ID
  let invoiceId: string | undefined;
  let orgId: string | undefined;

  if (payment.externalReference) {
    const parsed = parseExternalReference(payment.externalReference);
    if (parsed) {
      invoiceId = parsed.invoiceId;
      orgId = parsed.orgId;
    }
  }

  // Call handler if provided
  if (context.onPaymentUpdate && invoiceId && orgId) {
    await context.onPaymentUpdate(payment, invoiceId, orgId);
  }

  log.info('Payment webhook processed', {
    paymentId,
    status: payment.status,
    invoiceId,
    amount: payment.transactionAmount,
  });

  return {
    success: true,
    action: notification.action,
    paymentId,
    invoiceId,
    status: payment.status,
  };
}

/**
 * Process chargeback webhook
 */
async function processChargebackWebhook(
  notification: WebhookNotification,
  context: WebhookContext
): Promise<WebhookProcessResult> {
  const chargebackId = notification.data.id;

  log.warn('Chargeback notification received', {
    chargebackId,
    action: notification.action,
  });

  // TODO: Implement chargeback handling
  // For now, just log and acknowledge

  return {
    success: true,
    action: notification.action,
    paymentId: chargebackId,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map MercadoPago payment status to internal status
 */
export function mapPaymentStatus(mpStatus: PaymentStatus): string {
  const statusMap: Record<PaymentStatus, string> = {
    pending: 'pending',
    approved: 'paid',
    authorized: 'authorized',
    in_process: 'processing',
    in_mediation: 'disputed',
    rejected: 'failed',
    cancelled: 'cancelled',
    refunded: 'refunded',
    charged_back: 'charged_back',
  };

  return statusMap[mpStatus] || 'unknown';
}

/**
 * Check if payment status is final (no more updates expected)
 */
export function isPaymentFinal(status: PaymentStatus): boolean {
  return ['approved', 'rejected', 'cancelled', 'refunded', 'charged_back'].includes(status);
}

/**
 * Check if payment requires action
 */
export function paymentRequiresAction(status: PaymentStatus): boolean {
  return ['in_mediation', 'charged_back'].includes(status);
}
