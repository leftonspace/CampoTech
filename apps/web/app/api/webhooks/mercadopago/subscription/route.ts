/**
 * Mercado Pago Subscription Webhook Handler
 * ==========================================
 *
 * POST /api/webhooks/mercadopago/subscription
 *
 * Handles subscription-related events from Mercado Pago:
 * - subscription.authorized
 * - subscription.payment.approved
 * - subscription.payment.rejected
 * - subscription.paused
 * - subscription.cancelled
 * - subscription.updated
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { subscriptionManager } from '@/lib/services/subscription-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SubscriptionWebhookPayload {
  id: number | string;
  live_mode: boolean;
  type: string;
  date_created: string;
  user_id: number;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNATURE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

function validateSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    console.warn('Missing signature or secret for webhook validation');
    // In development, allow without signature
    if (process.env.NODE_ENV === 'development') return true;
    return false;
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
      console.warn('No v1 signature in header');
      return false;
    }

    // Build manifest
    let manifest = '';
    if (ts) manifest += `ts:${ts};`;
    manifest += payload;

    // Calculate expected signature
    const expected = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(v1, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch (error) {
    console.error('Signature validation error:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY
// ═══════════════════════════════════════════════════════════════════════════════

const processedWebhooks = new Map<string, Date>();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

function wasAlreadyProcessed(webhookId: string, action: string): boolean {
  const key = `sub:${webhookId}:${action}`;
  const processed = processedWebhooks.get(key);

  if (!processed) return false;

  // Check TTL
  if (Date.now() - processed.getTime() > IDEMPOTENCY_TTL) {
    processedWebhooks.delete(key);
    return false;
  }

  return true;
}

function markAsProcessed(webhookId: string, action: string): void {
  const key = `sub:${webhookId}:${action}`;
  processedWebhooks.set(key, new Date());
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Get raw body for signature validation
    const rawBody = await request.text();
    const signature = request.headers.get('x-signature');
    const webhookSecret = process.env.MP_WEBHOOK_SECRET || '';

    // Validate signature
    if (!validateSignature(rawBody, signature, webhookSecret)) {
      console.warn('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse payload
    let payload: SubscriptionWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!payload.id || !payload.type || !payload.data?.id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const webhookId = String(payload.id);
    const eventType = payload.action || payload.type;
    const subscriptionId = payload.data.id;

    console.log('Processing subscription webhook:', {
      webhookId,
      eventType,
      subscriptionId,
      liveMode: payload.live_mode,
    });

    // Check idempotency
    if (wasAlreadyProcessed(webhookId, eventType)) {
      console.log('Webhook already processed:', webhookId);
      return NextResponse.json({ status: 'already_processed' });
    }

    // Fetch full subscription details from MP API if needed
    let eventData: Record<string, unknown> = {
      webhook_id: webhookId,
      subscription_id: subscriptionId,
      live_mode: payload.live_mode,
      date_created: payload.date_created,
    };

    // If it's a payment event, we might need to fetch payment details
    if (eventType.includes('payment')) {
      // TODO: Fetch payment details from MP API
      eventData.payment_id = subscriptionId;
    } else {
      // Fetch subscription details
      eventData.preapproval_id = subscriptionId;
      // TODO: Fetch subscription details from MP API to get plan_id, etc.
    }

    // Process the event
    const result = await subscriptionManager.handleWebhookEvent(
      eventType,
      subscriptionId,
      eventData
    );

    // Mark as processed
    if (result.success) {
      markAsProcessed(webhookId, eventType);
    }

    const duration = Date.now() - startTime;
    console.log('Subscription webhook processed:', {
      webhookId,
      eventType,
      success: result.success,
      duration: `${duration}ms`,
    });

    if (!result.success) {
      // Return 500 so MP retries
      return NextResponse.json(
        { error: result.error || 'Processing failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'processed',
      event: eventType,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('Subscription webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFY ENDPOINT (for MP webhook configuration)
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'subscription_webhook',
    timestamp: new Date().toISOString(),
  });
}
