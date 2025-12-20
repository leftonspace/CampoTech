/**
 * MercadoPago Webhook Utilities
 * =============================
 *
 * Utilities for validating and parsing MercadoPago webhook notifications.
 * Handles signature verification, idempotency, and event parsing.
 */

import * as crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type WebhookEventType =
  | 'payment'
  | 'payment.created'
  | 'payment.updated'
  | 'subscription_preapproval'
  | 'subscription_preapproval_plan'
  | 'subscription_authorized_payment'
  | 'chargebacks'
  | 'merchant_orders';

export type PaymentAction =
  | 'payment.created'
  | 'payment.updated';

export interface WebhookNotification {
  id: number | string;
  live_mode: boolean;
  type: WebhookEventType;
  date_created: string;
  user_id?: number;
  api_version?: string;
  action: string;
  data: {
    id: string;
  };
}

export interface ParsedWebhookEvent {
  webhookId: string;
  eventType: WebhookEventType;
  action: string;
  dataId: string;
  liveMode: boolean;
  dateCreated: Date;
  userId?: number;
  apiVersion?: string;
}

export interface SignatureValidationResult {
  valid: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNATURE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate MercadoPago webhook signature
 *
 * MercadoPago uses HMAC-SHA256 for webhook signatures.
 * Header format: x-signature: ts=<timestamp>,v1=<signature>
 *
 * @param payload - Raw request body as string
 * @param signature - x-signature header value
 * @param secret - Webhook secret from MP dashboard
 * @param dataId - data.id from the webhook payload
 * @param requestId - x-request-id header value (optional)
 */
export function validateSignature(
  payload: string,
  signature: string | null,
  secret: string,
  dataId?: string,
  requestId?: string
): SignatureValidationResult {
  // In development without secret, allow all webhooks
  if (!secret && process.env.NODE_ENV === 'development') {
    console.warn('[Webhook] No webhook secret configured - skipping signature validation');
    return { valid: true };
  }

  if (!signature) {
    return { valid: false, error: 'Missing x-signature header' };
  }

  if (!secret) {
    return { valid: false, error: 'Webhook secret not configured' };
  }

  try {
    // Parse x-signature header: ts=<timestamp>,v1=<signature>
    const parts: Record<string, string> = {};
    signature.split(',').forEach((part) => {
      const [key, value] = part.split('=');
      if (key && value) {
        parts[key.trim()] = value.trim();
      }
    });

    const ts = parts['ts'];
    const v1 = parts['v1'];

    if (!v1) {
      return { valid: false, error: 'No v1 signature in header' };
    }

    // Build the manifest for signature verification
    // Format: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
    let manifest = '';
    if (dataId) {
      manifest += `id:${dataId};`;
    }
    if (requestId) {
      manifest += `request-id:${requestId};`;
    }
    if (ts) {
      manifest += `ts:${ts};`;
    }

    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    let isValid = false;
    try {
      isValid = crypto.timingSafeEqual(
        Buffer.from(v1, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      // Buffer lengths differ
      isValid = false;
    }

    if (!isValid) {
      // Log for debugging (don't expose in response)
      console.warn('[Webhook] Signature validation failed', {
        manifest,
        expected: expectedSignature.slice(0, 16) + '...',
        received: v1.slice(0, 16) + '...',
      });
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true };
  } catch (error) {
    console.error('[Webhook] Signature validation error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Signature validation failed',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK PARSING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse and validate webhook notification body
 */
export function parseWebhookEvent(body: unknown): ParsedWebhookEvent | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const raw = body as Record<string, unknown>;

  // Validate required fields
  if (!raw.id) {
    console.warn('[Webhook] Missing id field');
    return null;
  }
  if (!raw.type && !raw.action) {
    console.warn('[Webhook] Missing type and action fields');
    return null;
  }
  if (!raw.data || typeof raw.data !== 'object') {
    console.warn('[Webhook] Missing or invalid data field');
    return null;
  }

  const data = raw.data as Record<string, unknown>;
  if (!data.id) {
    console.warn('[Webhook] Missing data.id field');
    return null;
  }

  const eventType = (raw.type || raw.action) as WebhookEventType;
  const action = String(raw.action || raw.type);

  return {
    webhookId: String(raw.id),
    eventType,
    action,
    dataId: String(data.id),
    liveMode: raw.live_mode === true,
    dateCreated: raw.date_created
      ? new Date(raw.date_created as string)
      : new Date(),
    userId: typeof raw.user_id === 'number' ? raw.user_id : undefined,
    apiVersion: typeof raw.api_version === 'string' ? raw.api_version : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a webhook has already been processed
 * Uses subscription_events table for persistent idempotency
 */
export async function isWebhookProcessed(
  webhookId: string,
  action: string
): Promise<boolean> {
  try {
    const existing = await prisma.subscriptionEvent.findFirst({
      where: {
        eventData: {
          path: ['webhook_id'],
          equals: webhookId,
        },
        eventType: action,
      },
      select: { id: true },
    });

    return !!existing;
  } catch (error) {
    console.error('[Webhook] Idempotency check error:', error);
    // On error, assume not processed to avoid duplicate blocking
    return false;
  }
}

/**
 * Generate idempotency key for in-memory cache (backup)
 */
export function generateIdempotencyKey(webhookId: string, action: string): string {
  return `mp-sub-webhook:${webhookId}:${action}`;
}

// In-memory cache for quick idempotency checks
const processedCache = new Map<string, { timestamp: number; result: string }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Quick check using in-memory cache
 */
export function wasRecentlyProcessed(webhookId: string, action: string): boolean {
  const key = generateIdempotencyKey(webhookId, action);
  const cached = processedCache.get(key);

  if (!cached) return false;

  // Check TTL
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    processedCache.delete(key);
    return false;
  }

  return true;
}

/**
 * Mark webhook as processed in cache
 */
export function markAsProcessed(webhookId: string, action: string, result: string): void {
  const key = generateIdempotencyKey(webhookId, action);
  processedCache.set(key, { timestamp: Date.now(), result });

  // Cleanup old entries periodically
  if (processedCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of processedCache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        processedCache.delete(k);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT STATUS HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export type MPPaymentStatus =
  | 'pending'
  | 'approved'
  | 'authorized'
  | 'in_process'
  | 'in_mediation'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back';

/**
 * Map MercadoPago payment status to our internal status
 */
export function mapPaymentStatus(mpStatus: string): 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' {
  switch (mpStatus) {
    case 'approved':
      return 'completed';
    case 'pending':
    case 'in_process':
    case 'authorized':
      return 'pending';
    case 'in_mediation':
      return 'processing';
    case 'rejected':
    case 'cancelled':
    case 'charged_back':
      return 'failed';
    case 'refunded':
      return 'refunded';
    default:
      return 'pending';
  }
}

/**
 * Check if payment status is final (no more updates expected)
 */
export function isPaymentFinal(status: string): boolean {
  return ['approved', 'rejected', 'cancelled', 'refunded', 'charged_back'].includes(status);
}

/**
 * Check if payment should activate subscription
 */
export function shouldActivateSubscription(status: string): boolean {
  return status === 'approved';
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════════

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute

/**
 * Check rate limit for webhook endpoint
 * Returns true if rate limit exceeded
 */
export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    // New window
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }

  bucket.count++;

  if (bucket.count > RATE_LIMIT_MAX) {
    console.warn('[Webhook] Rate limit exceeded for IP:', ip);
    return true;
  }

  return false;
}

/**
 * Get remaining rate limit
 */
export function getRateLimitRemaining(ip: string): number {
  const bucket = rateLimitBuckets.get(ip);
  if (!bucket) return RATE_LIMIT_MAX;

  if (Date.now() > bucket.resetAt) {
    return RATE_LIMIT_MAX;
  }

  return Math.max(0, RATE_LIMIT_MAX - bucket.count);
}
