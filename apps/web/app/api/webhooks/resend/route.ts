/**
 * Phase 4.6: Resend Webhook Handler
 * ===================================
 * 
 * Handles webhooks from Resend for email tracking.
 * Events: delivered, opened, clicked, bounced, complained
 * 
 * POST - Handle Resend webhook event
 * 
 * Security: Phase 7 Audit Remediation (LOW-01)
 * - Implements Svix signature validation
 * - Sanitizes PII in logs
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getEmailOutreachService } from '@/lib/services/email-outreach.service';

// Resend webhook secret for verification
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ResendWebhookEvent {
    type: 'email.sent' | 'email.delivered' | 'email.delivery_delayed' |
    'email.complained' | 'email.bounced' | 'email.opened' | 'email.clicked';
    created_at: string;
    data: {
        email_id: string;
        from: string;
        to: string[];
        subject: string;
        created_at: string;
        // For clicks
        click?: {
            link: string;
            timestamp: string;
        };
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: SIGNATURE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate Resend webhook signature using Svix HMAC-SHA256
 * 
 * Resend uses Svix for webhook delivery with these headers:
 * - svix-id: Unique message ID
 * - svix-timestamp: Unix timestamp
 * - svix-signature: Comma-separated list of signatures (v1,<signature>)
 * 
 * Signature is computed over: <svix-id>.<svix-timestamp>.<body>
 * 
 * @param rawBody - Raw request body as string
 * @param svixId - svix-id header
 * @param svixTimestamp - svix-timestamp header
 * @param svixSignature - svix-signature header
 * @param secret - RESEND_WEBHOOK_SECRET from environment
 * @returns Object with validation result and optional error
 */
function validateSvixSignature(
    rawBody: string,
    svixId: string | null,
    svixTimestamp: string | null,
    svixSignature: string | null,
    secret: string
): { valid: boolean; error?: string } {
    // In development without secret, allow all webhooks
    if (!secret && process.env.NODE_ENV === 'development') {
        console.warn('[Resend Webhook] DEV MODE: Signature validation skipped');
        return { valid: true };
    }

    if (!svixId || !svixTimestamp || !svixSignature) {
        return { valid: false, error: 'Missing Svix headers' };
    }

    if (!secret) {
        return { valid: false, error: 'Webhook secret not configured' };
    }

    try {
        // Parse secret - Svix secrets are prefixed with "whsec_"
        const secretBytes = secret.startsWith('whsec_')
            ? Buffer.from(secret.slice(6), 'base64')
            : Buffer.from(secret, 'base64');

        // Check timestamp is not too old (prevent replay attacks - 5 minute tolerance)
        const timestamp = parseInt(svixTimestamp, 10);
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - timestamp) > 300) {
            return { valid: false, error: 'Timestamp too old' };
        }

        // Build signed payload: <svix-id>.<svix-timestamp>.<body>
        const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;

        // Calculate expected signature
        const expectedSignature = crypto
            .createHmac('sha256', secretBytes)
            .update(signedPayload)
            .digest('base64');

        // Parse signature header - format: v1,<base64_signature> v1,<base64_signature>
        // Resend may send multiple signatures for key rotation
        const signatures = svixSignature.split(' ');

        for (const sig of signatures) {
            const [version, value] = sig.split(',');
            if (version !== 'v1' || !value) continue;

            // Timing-safe comparison
            try {
                const isValid = crypto.timingSafeEqual(
                    Buffer.from(expectedSignature),
                    Buffer.from(value)
                );
                if (isValid) {
                    return { valid: true };
                }
            } catch {
                // Length mismatch, continue checking other signatures
                continue;
            }
        }

        return { valid: false, error: 'Invalid signature' };
    } catch (error) {
        console.error('[Resend Webhook] Signature validation error:', error);
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Signature validation failed',
        };
    }
}

/**
 * Sanitize event for logging (mask email addresses)
 */
function sanitizeEventForLogging(event: ResendWebhookEvent): Record<string, unknown> {
    const maskEmail = (email: string): string => {
        const [local, domain] = email.split('@');
        if (!domain) return '[REDACTED]';
        const maskedLocal = local.length > 2
            ? local[0] + '***' + local[local.length - 1]
            : '***';
        return `${maskedLocal}@${domain}`;
    };

    return {
        type: event.type,
        email_id: event.data.email_id,
        to: event.data.to.map(maskEmail),
        created_at: event.created_at,
        // Don't log subject (may contain PII)
        hasClick: !!event.data.click,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Handle webhook (SECURED)
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        // 1. Get raw body FIRST (required for signature validation)
        const rawBody = await request.text();

        // 2. Get Svix signature headers
        const svixId = request.headers.get('svix-id');
        const svixTimestamp = request.headers.get('svix-timestamp');
        const svixSignature = request.headers.get('svix-signature');

        // 3. CRITICAL: Validate signature BEFORE processing
        if (RESEND_WEBHOOK_SECRET) {
            const validationResult = validateSvixSignature(
                rawBody,
                svixId,
                svixTimestamp,
                svixSignature,
                RESEND_WEBHOOK_SECRET
            );

            if (!validationResult.valid) {
                console.warn('[Resend Webhook] Signature validation failed:', validationResult.error);
                return NextResponse.json(
                    { error: validationResult.error },
                    { status: 401 }
                );
            }
        } else if (process.env.NODE_ENV === 'production') {
            // In production, require webhook secret
            console.error('[Resend Webhook] RESEND_WEBHOOK_SECRET not configured in production');
            return NextResponse.json(
                { error: 'Webhook secret not configured' },
                { status: 500 }
            );
        }

        // 4. Parse body (safe now that signature is validated)
        let body: ResendWebhookEvent;
        try {
            body = JSON.parse(rawBody) as ResendWebhookEvent;
        } catch {
            console.error('[Resend Webhook] Invalid JSON payload');
            return NextResponse.json(
                { error: 'Invalid JSON' },
                { status: 400 }
            );
        }

        // 5. Log sanitized event (no full email addresses)
        console.log('[Resend Webhook] Received:', JSON.stringify(sanitizeEventForLogging(body)));

        // 6. Process event
        const emailService = getEmailOutreachService();
        const email = body.data.to[0];
        const messageId = body.data.email_id;

        switch (body.type) {
            case 'email.delivered':
                await emailService.handleEmailDelivered(email, messageId);
                break;

            case 'email.opened':
                await emailService.handleEmailOpened(email, messageId);
                break;

            case 'email.clicked':
                const link = body.data.click?.link || '';
                await emailService.handleEmailClicked(email, link);
                break;

            case 'email.bounced':
                await emailService.handleEmailBounced(email, messageId);
                break;

            case 'email.complained':
                // Treat complaint as unsubscribe request
                console.log('[Resend Webhook] Complaint received for email_id:', messageId);
                break;

            case 'email.sent':
            case 'email.delivery_delayed':
                // These are informational, we track sent status locally
                break;

            default:
                console.log('[Resend Webhook] Unknown event type:', body.type);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[Resend Webhook] Error:', error instanceof Error ? error.message : 'Unknown error');
        // Return 200 to prevent Resend from retrying (avoid infinite retries on permanent errors)
        return NextResponse.json(
            { error: 'Error processing webhook', received: true },
            { status: 200 }
        );
    }
}
