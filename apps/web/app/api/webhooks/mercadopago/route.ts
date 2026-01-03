/**
 * MercadoPago Webhook Handler
 * ===========================
 *
 * POST /api/webhooks/mercadopago
 *
 * Main webhook endpoint for MercadoPago notifications.
 * Handles payment events for subscription processing.
 *
 * Event Types Handled:
 * - payment.created: New payment initiated
 * - payment.updated: Payment status changed (approved, rejected, etc.)
 * - payment: Legacy payment event format
 * - subscription_preapproval: Recurring billing preapproval
 * - subscription_authorized_payment: Recurring payment processed
 * - chargebacks: Payment chargeback/dispute
 *
 * Security:
 * - HMAC-SHA256 signature validation
 * - Rate limiting (100 req/min per IP)
 * - Idempotency checking (prevents duplicate processing)
 *
 * Reference:
 * - https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateSignature,
  parseWebhookEvent,
  isWebhookProcessed,
  wasRecentlyProcessed,
  markAsProcessed,
  isRateLimited,
  getRateLimitRemaining,
  // mapPaymentStatus,
  shouldActivateSubscription,
} from '@/lib/mercadopago/webhooks';
import {
  paymentProcessor,
  parseExternalReference,
  type PaymentData,
} from '@/lib/services/payment-processor';
import { getPaymentAPI } from '@/lib/mercadopago/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface WebhookResponse {
  status: string;
  message?: string;
  webhookId?: string;
  eventType?: string;
  action?: string;
  duration?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get client IP from request
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for real IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback
  return 'unknown';
}

/**
 * Fetch payment details from MercadoPago API
 */
async function fetchPaymentDetails(paymentId: string): Promise<PaymentData | null> {
  try {
    const paymentAPI = getPaymentAPI();
    const payment = await paymentAPI.get({ id: paymentId });

    if (!payment) {
      console.warn('[Webhook] Payment not found:', paymentId);
      return null;
    }

    return {
      mpPaymentId: String(payment.id),
      mpPreferenceId: payment.metadata?.preference_id as string | undefined,
      mpExternalReference: payment.external_reference || undefined,
      amount: payment.transaction_amount || 0,
      currency: payment.currency_id || 'ARS',
      paymentMethod: payment.payment_method_id || undefined,
      payerEmail: payment.payer?.email || undefined,
      payerId: payment.payer?.id ? String(payment.payer.id) : undefined,
      dateCreated: payment.date_created ? new Date(payment.date_created) : undefined,
      dateApproved: payment.date_approved ? new Date(payment.date_approved) : undefined,
    };
  } catch (error) {
    console.error('[Webhook] Error fetching payment details:', error);
    return null;
  }
}

/**
 * Log webhook processing details
 */
function logWebhook(
  level: 'info' | 'warn' | 'error',
  message: string,
  data: Record<string, unknown>
): void {
  const logData = {
    ...data,
    timestamp: new Date().toISOString(),
    service: 'mercadopago-webhook',
  };

  switch (level) {
    case 'error':
      console.error(`[Webhook] ${message}`, JSON.stringify(logData));
      break;
    case 'warn':
      console.warn(`[Webhook] ${message}`, JSON.stringify(logData));
      break;
    default:
      console.log(`[Webhook] ${message}`, JSON.stringify(logData));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle payment events (created, updated)
 */
async function handlePaymentEvent(
  paymentId: string,
  action: string
): Promise<{ success: boolean; action?: string; error?: string }> {
  // Fetch payment details from MP API
  const paymentData = await fetchPaymentDetails(paymentId);

  if (!paymentData) {
    return { success: false, error: 'Could not fetch payment details' };
  }

  // Check if this is a subscription payment by external reference
  const refInfo = paymentData.mpExternalReference
    ? parseExternalReference(paymentData.mpExternalReference)
    : null;

  if (!refInfo) {
    // Not a subscription payment, might be a marketplace payment
    logWebhook('info', 'Non-subscription payment, skipping', {
      paymentId,
      externalRef: paymentData.mpExternalReference,
    });
    return { success: true, action: 'non_subscription_payment' };
  }

  // Fetch full payment status from MP to determine action
  try {
    const paymentAPI = getPaymentAPI();
    const fullPayment = await paymentAPI.get({ id: paymentId });

    if (!fullPayment) {
      return { success: false, error: 'Payment not found' };
    }

    const mpStatus = fullPayment.status || 'unknown';
    const statusDetail = fullPayment.status_detail || undefined;

    logWebhook('info', 'Processing payment', {
      paymentId,
      mpStatus,
      statusDetail,
      action,
      tier: refInfo.tier,
      orgId: refInfo.organizationId,
    });

    // Route based on payment status
    if (shouldActivateSubscription(mpStatus)) {
      // Approved payment
      const result = await paymentProcessor.processApprovedPayment(paymentData);
      return { success: result.success, action: result.action, error: result.error };
    } else if (mpStatus === 'pending' || mpStatus === 'in_process' || mpStatus === 'authorized') {
      // Pending payment (cash, transfer)
      const result = await paymentProcessor.processPendingPayment(paymentData);
      return { success: result.success, action: result.action, error: result.error };
    } else if (
      mpStatus === 'rejected' ||
      mpStatus === 'cancelled' ||
      mpStatus === 'charged_back'
    ) {
      // Failed payment
      const failureReason = statusDetail || mpStatus;
      const result = await paymentProcessor.processFailedPayment(
        paymentData,
        failureReason,
        statusDetail
      );
      return { success: result.success, action: result.action, error: result.error };
    } else if (mpStatus === 'refunded') {
      // Refunded payment
      const result = await paymentProcessor.processRefund({
        mpPaymentId: paymentId,
        reason: 'Payment refunded via MercadoPago',
      });
      return { success: result.success, action: result.action, error: result.error };
    }

    // Unknown status
    logWebhook('warn', 'Unknown payment status', { paymentId, mpStatus });
    return { success: true, action: 'unknown_status' };
  } catch (error) {
    console.error('[Webhook] Error processing payment event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle subscription preapproval events
 */
async function handlePreapprovalEvent(
  preapprovalId: string,
  action: string
): Promise<{ success: boolean; action?: string; error?: string }> {
  logWebhook('info', 'Processing preapproval event', { preapprovalId, action });

  // TODO: Fetch preapproval details from MP API
  // For now, log and acknowledge
  // This would be used for recurring billing setup

  return { success: true, action: 'preapproval_acknowledged' };
}

/**
 * Handle chargeback events
 */
async function handleChargebackEvent(
  chargebackId: string,
  action: string
): Promise<{ success: boolean; action?: string; error?: string }> {
  logWebhook('warn', 'Chargeback event received', { chargebackId, action });

  // TODO: Implement chargeback handling
  // - Fetch chargeback details
  // - Find related payment
  // - Update payment status
  // - Notify admins
  // - May need to suspend subscription

  return { success: true, action: 'chargeback_acknowledged' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse<WebhookResponse>> {
  const startTime = Date.now();
  const clientIP = getClientIP(request);

  // Check rate limit
  if (isRateLimited(clientIP)) {
    logWebhook('warn', 'Rate limit exceeded', { ip: clientIP });
    return NextResponse.json(
      { status: 'error', message: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  try {
    // Get raw body and headers for signature validation
    const rawBody = await request.text();
    const signature = request.headers.get('x-signature');
    const requestId = request.headers.get('x-request-id') || undefined;
    const webhookSecret = process.env.MP_WEBHOOK_SECRET || '';

    // Parse body first to get data.id for signature validation
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      logWebhook('error', 'Invalid JSON payload', { ip: clientIP });
      return NextResponse.json(
        { status: 'error', message: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Extract data.id for signature validation
    const bodyObj = body as { data?: { id?: unknown } };
    const dataId = bodyObj?.data?.id
      ? String(bodyObj.data.id)
      : undefined;

    // Validate signature
    const signatureResult = validateSignature(
      rawBody,
      signature,
      webhookSecret,
      dataId,
      requestId
    );

    if (!signatureResult.valid) {
      logWebhook('warn', 'Invalid signature', {
        ip: clientIP,
        error: signatureResult.error,
      });
      return NextResponse.json(
        { status: 'error', message: signatureResult.error || 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse webhook event
    const event = parseWebhookEvent(body);

    if (!event) {
      logWebhook('error', 'Invalid webhook payload', { ip: clientIP });
      return NextResponse.json(
        { status: 'error', message: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    const { webhookId, eventType, action, dataId: eventDataId, liveMode } = event;

    logWebhook('info', 'Webhook received', {
      webhookId,
      eventType,
      action,
      dataId: eventDataId,
      liveMode,
      ip: clientIP,
    });

    // Quick idempotency check (in-memory)
    if (wasRecentlyProcessed(webhookId, action)) {
      logWebhook('info', 'Webhook already processed (cache)', { webhookId, action });
      return NextResponse.json({
        status: 'already_processed',
        webhookId,
        eventType,
      });
    }

    // Full idempotency check (database)
    const alreadyProcessed = await isWebhookProcessed(webhookId, action);
    if (alreadyProcessed) {
      logWebhook('info', 'Webhook already processed (database)', { webhookId, action });
      markAsProcessed(webhookId, action, 'duplicate');
      return NextResponse.json({
        status: 'already_processed',
        webhookId,
        eventType,
      });
    }

    // Route to appropriate handler based on event type
    let result: { success: boolean; action?: string; error?: string };

    switch (eventType) {
      case 'payment':
      case 'payment.created':
      case 'payment.updated':
        result = await handlePaymentEvent(eventDataId, action);
        break;

      case 'subscription_preapproval':
      case 'subscription_preapproval_plan':
        result = await handlePreapprovalEvent(eventDataId, action);
        break;

      case 'subscription_authorized_payment':
        // Recurring payment - treat as regular payment
        result = await handlePaymentEvent(eventDataId, action);
        break;

      case 'chargebacks':
        result = await handleChargebackEvent(eventDataId, action);
        break;

      case 'merchant_orders':
        // Merchant orders - usually for marketplace, skip for subscriptions
        logWebhook('info', 'Merchant order event, skipping', { dataId: eventDataId });
        result = { success: true, action: 'merchant_order_skipped' };
        break;

      default:
        logWebhook('warn', 'Unknown event type', { eventType, action });
        result = { success: true, action: 'unknown_event_type' };
    }

    // Mark as processed if successful
    if (result.success) {
      markAsProcessed(webhookId, action, result.action || 'processed');
    }

    const duration = Date.now() - startTime;

    logWebhook('info', 'Webhook processed', {
      webhookId,
      eventType,
      action: result.action,
      success: result.success,
      duration: `${duration}ms`,
    });

    if (!result.success) {
      // Return 500 so MercadoPago retries
      return NextResponse.json(
        {
          status: 'error',
          message: result.error || 'Processing failed',
          webhookId,
          eventType,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        status: 'processed',
        webhookId,
        eventType,
        action: result.action,
        duration: `${duration}ms`,
      },
      {
        headers: {
          'X-RateLimit-Remaining': String(getRateLimitRemaining(clientIP)),
        },
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logWebhook('error', 'Webhook handler error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${duration}ms`,
      ip: clientIP,
    });

    return NextResponse.json(
      { status: 'error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET endpoint for webhook verification
 * MercadoPago may call this to verify the endpoint is active
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'mercadopago_webhook',
    version: '2.0',
    timestamp: new Date().toISOString(),
    events_supported: [
      'payment',
      'payment.created',
      'payment.updated',
      'subscription_preapproval',
      'subscription_preapproval_plan',
      'subscription_authorized_payment',
      'chargebacks',
      'merchant_orders',
    ],
  });
}
