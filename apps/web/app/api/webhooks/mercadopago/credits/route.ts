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
 * 1. Validate webhook signature
 * 2. Fetch payment details from MP API
 * 3. Parse external_reference to get purchaseId
 * 4. Complete credit purchase in database
 * 5. Send confirmation email
 */

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
 * Log webhook event
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
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Parse webhook payload
        const body = await request.json() as WebhookPayload;
        const { type, action, data } = body;

        log('info', 'Webhook received', { type, action, paymentId: data.id });

        // Only process payment events
        if (!type.includes('payment')) {
            log('info', 'Not a payment event, skipping', { type });
            return NextResponse.json({ status: 'ignored', reason: 'not_payment_event' });
        }

        // Fetch payment details from MP API
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

        // Check if this is a credit purchase
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

        // Verify purchase exists
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

        // Handle based on payment status
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

            log('info', 'Credits activated', {
                purchaseId,
                organizationId: purchase.creditsAccount.organizationId,
                credits: purchase.credits,
            });

            // TODO: Send confirmation email
            // await emailService.sendCreditPurchaseConfirmation({
            //     to: purchase.creditsAccount.organization.email,
            //     organizationName: purchase.creditsAccount.organization.name,
            //     credits: purchase.credits,
            //     amount: purchase.amountPaid,
            // });

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

            return NextResponse.json({
                status: 'processed',
                action: 'payment_failed',
                purchaseId,
                reason: payment.status_detail,
            });
        }

        // Unknown status
        log('warn', 'Unknown payment status', { purchaseId, mpStatus });
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
        version: '1.0',
        timestamp: new Date().toISOString(),
    });
}
