/**
 * Phase 4.6: Resend Webhook Handler
 * ===================================
 * 
 * Handles webhooks from Resend for email tracking.
 * Events: delivered, opened, clicked, bounced, complained
 * 
 * POST - Handle Resend webhook event
 */

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
// POST - Handle webhook
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        // Verify webhook signature (optional but recommended)
        const signature = request.headers.get('svix-signature');
        const timestamp = request.headers.get('svix-timestamp');

        // In production, verify the signature with RESEND_WEBHOOK_SECRET
        // For now, we'll just check that the webhook secret is configured
        if (RESEND_WEBHOOK_SECRET && !signature) {
            console.warn('[Resend Webhook] Missing signature header');
            // Continue processing but log warning
        }

        const body = await request.json() as ResendWebhookEvent;

        console.log(`[Resend Webhook] Received event: ${body.type} for ${body.data.to[0]}`);

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
                console.log(`[Resend Webhook] Complaint from ${email}`);
                break;

            case 'email.sent':
            case 'email.delivery_delayed':
                // These are informational, we track sent status locally
                break;

            default:
                console.log(`[Resend Webhook] Unknown event type: ${body.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[Resend Webhook] Error:', error);
        // Return 200 to prevent Resend from retrying
        return NextResponse.json(
            { error: 'Error processing webhook', received: true },
            { status: 200 }
        );
    }
}
