/**
 * Phase 4.8: Mercado Pago Webhook - Credit Purchases
 * ====================================================
 * 
 * Handles payment webhooks specifically for WhatsApp credit purchases.
 * Triggered when a customer pays for a credit package via Mercado Pago.
 * 
 * POST /api/webhooks/mercadopago/credits
 * 
 * Flow:
 * 1. Validate webhook signature (CRITICAL)
 * 2. Check idempotency to prevent replay attacks
 * 3. Fetch payment details from MP API
 * 4. Parse external_reference to get purchaseId
 * 5. Complete credit purchase in database
 * 6. Send confirmation email
 * 
 * Security: Phase 7 Audit Remediation (MED-01)
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getPaymentAPI } from '@/lib/mercadopago/client';
import { getWhatsAppCreditsService } from '@/lib/services/whatsapp-credits.service';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface WebhookPayload {
    id: string;
    type: string;
    action: string;
    data: {
        id: string;
    };
}

interface SignatureValidationResult {
    valid: boolean;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: SIGNATURE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate MercadoPago webhook signature using HMAC-SHA256
 * 
 * Header format: x-signature: ts=<timestamp>,v1=<signature>
 * Manifest format: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * 
 * @param signature - x-signature header value
 * @param secret - MP_WEBHOOK_SECRET from environment
 * @param dataId - data.id from the webhook payload
 * @param requestId - x-request-id header value (optional)
 */
function validateSignature(
    signature: string | null,
    secret: string,
    dataId?: string,
    requestId?: string
): SignatureValidationResult {
    // In development without secret, allow all webhooks
    if (!secret && process.env.NODE_ENV === 'development') {
        console.warn('[Credits Webhook] DEV MODE: Signature validation skipped');
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
            console.warn('[Credits Webhook] Signature validation failed', {
                manifest,
                expected: expectedSignature.slice(0, 16) + '...',
                received: v1.slice(0, 16) + '...',
            });
            return { valid: false, error: 'Invalid signature' };
        }

        return { valid: true };
    } catch (error) {
        console.error('[Credits Webhook] Signature validation error:', error);
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Signature validation failed',
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY
// ═══════════════════════════════════════════════════════════════════════════════

// In-memory cache for idempotency (backup to database check)
const processedWebhooks = new Map<string, { timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if webhook was already processed (prevents replay attacks)
 */
function wasRecentlyProcessed(webhookId: string): boolean {
    const cached = processedWebhooks.get(webhookId);
    if (!cached) return false;

    if (Date.now() - cached.timestamp > CACHE_TTL) {
        processedWebhooks.delete(webhookId);
        return false;
    }

    return true;
}

/**
 * Mark webhook as processed
 */
function markAsProcessed(webhookId: string): void {
    processedWebhooks.set(webhookId, { timestamp: Date.now() });

    // Cleanup old entries periodically
    if (processedWebhooks.size > 1000) {
        const now = Date.now();
        for (const [key, value] of processedWebhooks.entries()) {
            if (now - value.timestamp > CACHE_TTL) {
                processedWebhooks.delete(key);
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse external reference to extract purchase ID
 * Format: "credits_purchase_{purchaseId}"
 */
function parseCreditPurchaseReference(externalRef: string): string | null {
    const match = externalRef.match(/^credits_purchase_(.+)$/);
    return match ? match[1] : null;
}

/**
 * Log webhook event (sanitized)
 */
function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
    const logData = {
        ...data,
        timestamp: new Date().toISOString(),
        service: 'mp-credits-webhook',
    };

    switch (level) {
        case 'error':
            console.error(`[Credits Webhook] ${message}`, JSON.stringify(logData));
            break;
        case 'warn':
            console.warn(`[Credits Webhook] ${message}`, JSON.stringify(logData));
            break;
        default:
            console.log(`[Credits Webhook] ${message}`, JSON.stringify(logData));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER (SECURED)
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // 1. Get raw body FIRST (required for signature validation)
        const rawBody = await request.text();

        // 2. Parse body to extract data.id for signature manifest
        let body: WebhookPayload;
        try {
            body = JSON.parse(rawBody) as WebhookPayload;
        } catch {
            log('error', 'Invalid JSON payload');
            return NextResponse.json(
                { status: 'error', message: 'Invalid JSON' },
                { status: 400 }
            );
        }

        const { id: webhookId, type, action, data } = body;
        const dataId = data?.id ? String(data.id) : undefined;

        // 3. Get signature headers
        const signature = request.headers.get('x-signature');
        const requestId = request.headers.get('x-request-id') || undefined;
        const webhookSecret = process.env.MP_WEBHOOK_SECRET || '';

        // 4. CRITICAL: Validate signature BEFORE processing
        const signatureResult = validateSignature(signature, webhookSecret, dataId, requestId);
        if (!signatureResult.valid) {
            log('warn', 'Signature validation failed', { error: signatureResult.error });
            return NextResponse.json(
                { status: 'error', message: signatureResult.error },
                { status: 401 }
            );
        }

        // 5. Check idempotency (prevent replay attacks)
        const idempotencyKey = `${webhookId}:${action}`;
        if (wasRecentlyProcessed(idempotencyKey)) {
            log('info', 'Webhook already processed', { webhookId, action });
            return NextResponse.json({ status: 'already_processed' });
        }

        log('info', 'Webhook received (verified)', { webhookId, type, action, paymentId: data.id });

        // 6. Only process payment events
        if (!type.includes('payment')) {
            log('info', 'Not a payment event, skipping', { type });
            return NextResponse.json({ status: 'ignored', reason: 'not_payment_event' });
        }

        // 7. Fetch payment details from MP API
        const paymentAPI = getPaymentAPI();
        const payment = await paymentAPI.get({ id: data.id });

        if (!payment) {
            log('error', 'Payment not found', { paymentId: data.id });
            return NextResponse.json(
                { status: 'error', message: 'Payment not found' },
                { status: 404 }
            );
        }

        const mpStatus = payment.status || 'unknown';
        const externalRef = payment.external_reference;

        log('info', 'Payment details fetched', {
            paymentId: data.id,
            status: mpStatus,
            externalRef,
        });

        // 8. Check if this is a credit purchase
        if (!externalRef || !externalRef.startsWith('credits_purchase_')) {
            log('info', 'Not a credit purchase, skipping', { externalRef });
            return NextResponse.json({ status: 'ignored', reason: 'not_credit_purchase' });
        }

        const purchaseId = parseCreditPurchaseReference(externalRef);
        if (!purchaseId) {
            log('error', 'Invalid external reference format', { externalRef });
            return NextResponse.json(
                { status: 'error', message: 'Invalid external reference' },
                { status: 400 }
            );
        }

        // 9. Verify purchase exists
        const purchase = await prisma.creditPurchase.findUnique({
            where: { id: purchaseId },
            include: {
                creditsAccount: {
                    include: {
                        organization: {
                            select: { name: true, email: true },
                        },
                    },
                },
            },
        });

        if (!purchase) {
            log('error', 'Purchase not found', { purchaseId });
            return NextResponse.json(
                { status: 'error', message: 'Purchase not found' },
                { status: 404 }
            );
        }

        // 10. Handle based on payment status
        if (mpStatus === 'approved') {
            // Payment approved - complete the purchase
            log('info', 'Processing approved payment', {
                purchaseId,
                credits: purchase.credits,
                amount: purchase.amountPaid,
            });

            // Update purchase with payment details
            await prisma.creditPurchase.update({
                where: { id: purchaseId },
                data: {
                    mpPaymentId: data.id,
                    status: 'completed',
                    completedAt: new Date(),
                },
            });

            // Complete the credit purchase (adds credits to account)
            const creditsService = getWhatsAppCreditsService();
            await creditsService.completePurchase(purchaseId);

            // Mark webhook as processed (AFTER successful completion)
            markAsProcessed(idempotencyKey);

            log('info', 'Credits activated', {
                purchaseId,
                organizationId: purchase.creditsAccount.organizationId,
                credits: purchase.credits,
            });

            // TODO: Send confirmation email
            // await emailService.sendCreditPurchaseConfirmation(...)

            const duration = Date.now() - startTime;
            return NextResponse.json({
                status: 'processed',
                action: 'credits_activated',
                purchaseId,
                credits: purchase.credits,
                duration: `${duration}ms`,
            });
        } else if (mpStatus === 'pending' || mpStatus === 'in_process') {
            // Payment pending - update status but don't activate credits yet
            log('info', 'Payment pending', { purchaseId, mpStatus });

            await prisma.creditPurchase.update({
                where: { id: purchaseId },
                data: {
                    mpPaymentId: data.id,
                    status: 'pending',
                },
            });

            markAsProcessed(idempotencyKey);

            return NextResponse.json({
                status: 'processed',
                action: 'payment_pending',
                purchaseId,
            });
        } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
            // Payment failed
            log('warn', 'Payment failed', { purchaseId, mpStatus });

            await prisma.creditPurchase.update({
                where: { id: purchaseId },
                data: {
                    mpPaymentId: data.id,
                    status: 'failed',
                    failureReason: payment.status_detail || mpStatus,
                },
            });

            markAsProcessed(idempotencyKey);

            return NextResponse.json({
                status: 'processed',
                action: 'payment_failed',
                purchaseId,
                reason: payment.status_detail,
            });
        }

        // Unknown status
        log('warn', 'Unknown payment status', { purchaseId, mpStatus });
        markAsProcessed(idempotencyKey);

        return NextResponse.json({
            status: 'processed',
            action: 'unknown_status',
            purchaseId,
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        log('error', 'Webhook handler error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            duration: `${duration}ms`,
        });

        // Return 500 to trigger retry (webhook may be legitimate)
        return NextResponse.json(
            { status: 'error', message: 'Internal server error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        endpoint: 'mercadopago_credits_webhook',
        version: '1.1',
        timestamp: new Date().toISOString(),
        security: 'signature_validation_enabled',
    });
}
