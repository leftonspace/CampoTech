/**
 * 360dialog Webhook API Route
 * ============================
 *
 * Handles incoming webhooks from 360dialog WhatsApp Business API.
 * 360dialog uses the same webhook format as Meta Cloud API.
 *
 * This webhook handles:
 * - Inbound messages from customers
 * - Message status updates (sent, delivered, read, failed)
 * - Account status changes
 *
 * Documentation: https://docs.360dialog.com/whatsapp-api/whatsapp-api/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { Dialog360Provider } from '@/lib/integrations/whatsapp/providers/dialog360.provider';
import { prisma } from '@/lib/prisma';
import type {
  WebhookPayload,
  WebhookMessage,
  WebhookContact,
  WebhookStatus,
} from '@/lib/integrations/whatsapp/providers/dialog360.types';

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK VERIFICATION (GET)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET - Webhook Verification
 *
 * 360dialog (like Meta) verifies webhooks by sending a GET request with:
 * - hub.mode: Should be "subscribe"
 * - hub.verify_token: Token we configured
 * - hub.challenge: Challenge string to echo back
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode') || '';
  const token = searchParams.get('hub.verify_token') || '';
  const challenge = searchParams.get('hub.challenge') || '';

  // Get verify token from environment or org-specific setting
  const verifyToken = process.env.DIALOG360_WEBHOOK_SECRET || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error('[Dialog360 Webhook] No verify token configured');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    );
  }

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[Dialog360 Webhook] Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn('[Dialog360 Webhook] Verification failed', { mode, tokenMatch: token === verifyToken });
  return NextResponse.json(
    { error: 'Webhook verification failed' },
    { status: 403 }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK HANDLER (POST)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST - Webhook Handler
 *
 * Receives and processes webhook events from 360dialog.
 */
export async function POST(request: NextRequest) {
  try {
    // Get organization ID from query params (set when configuring webhook)
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    // Get raw body for signature verification
    const rawBody = await request.text();
    let payload: WebhookPayload;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[Dialog360 Webhook] Invalid JSON payload');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Verify webhook signature if secret is configured
    const signature = request.headers.get('x-hub-signature-256') || request.headers.get('x-hub-signature') || '';
    const webhookSecret = process.env.DIALOG360_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const provider = new Dialog360Provider({
        apiKey: process.env.DIALOG360_PARTNER_API_KEY || '',
        partnerId: process.env.DIALOG360_PARTNER_ID || '',
        webhookSecret,
      });

      if (!provider.verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        console.error('[Dialog360 Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Log webhook for debugging
    console.log('[Dialog360 Webhook] Received:', JSON.stringify(payload, null, 2));

    // Process the webhook
    await processWebhook(payload, orgId);

    // Always return 200 quickly to acknowledge receipt
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[Dialog360 Webhook] Error:', error);
    // Still return 200 to prevent retries on processing errors
    return NextResponse.json({ status: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

async function processWebhook(payload: WebhookPayload, orgId: string | null): Promise<void> {
  if (payload.object !== 'whatsapp_business_account') {
    console.log('[Dialog360 Webhook] Ignoring non-WhatsApp payload');
    return;
  }

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;

      const value = change.value;

      // Determine organization from metadata or query param
      const phoneNumberId = value.metadata.phone_number_id;
      const organizationId = orgId || await findOrganizationByPhoneNumber(phoneNumberId);

      if (!organizationId) {
        console.warn('[Dialog360 Webhook] Unknown phone number:', phoneNumberId);
        continue;
      }

      // Process messages
      if (value.messages?.length) {
        for (const message of value.messages) {
          await processInboundMessage(organizationId, message, value.contacts?.[0]);
        }
      }

      // Process status updates
      if (value.statuses?.length) {
        for (const status of value.statuses) {
          await processStatusUpdate(organizationId, status);
        }
      }

      // Process errors
      if (value.errors?.length) {
        for (const error of value.errors) {
          console.error('[Dialog360 Webhook] Error from API:', error);
        }
      }
    }
  }
}

/**
 * Find organization by phone number ID
 */
async function findOrganizationByPhoneNumber(phoneNumberId: string): Promise<string | null> {
  const account = await prisma.whatsAppBusinessAccount.findFirst({
    where: {
      OR: [
        { phoneNumberId },
        { bspAccountId: phoneNumberId },
      ],
    },
    select: { organizationId: true },
  });

  return account?.organizationId || null;
}

/**
 * Process an inbound message
 */
async function processInboundMessage(
  organizationId: string,
  message: WebhookMessage,
  contact?: WebhookContact
): Promise<void> {
  try {
    const senderPhone = message.from;
    const senderName = contact?.profile?.name || senderPhone;

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: {
        organizationId,
        phone: senderPhone,
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          organizationId,
          name: senderName,
          phone: senderPhone,
        },
      });
    }

    // Find or create conversation
    let conversation = await prisma.whatsAppConversation.findFirst({
      where: {
        organizationId,
        customerPhone: senderPhone,
        status: { not: 'CLOSED' },
      },
    });

    if (!conversation) {
      conversation = await prisma.whatsAppConversation.create({
        data: {
          organizationId,
          customerId: customer.id,
          customerPhone: senderPhone,
          customerName: senderName,
          status: 'OPEN',
        },
      });
    } else {
      // Update conversation activity
      await prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          status: 'OPEN',
        },
      });
    }

    // Extract message content based on type
    let content = '';
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;

    switch (message.type) {
      case 'text':
        content = message.text?.body || '';
        break;
      case 'image':
        content = message.image?.caption || '[Image]';
        mediaType = 'image';
        // Media URL would need to be fetched separately via the media endpoint
        break;
      case 'video':
        content = message.video?.caption || '[Video]';
        mediaType = 'video';
        break;
      case 'audio':
        content = '[Audio message]';
        mediaType = 'audio';
        break;
      case 'document':
        content = message.document?.caption || `[Document: ${message.document?.filename || 'file'}]`;
        mediaType = 'document';
        break;
      case 'sticker':
        content = '[Sticker]';
        mediaType = 'sticker';
        break;
      case 'location':
        content = `[Location: ${message.location?.name || `${message.location?.latitude}, ${message.location?.longitude}`}]`;
        break;
      case 'contacts':
        content = `[Contact: ${message.contacts?.[0]?.name?.formatted_name || 'Unknown'}]`;
        break;
      case 'interactive':
        if (message.interactive?.button_reply) {
          content = `[Button: ${message.interactive.button_reply.title}]`;
        } else if (message.interactive?.list_reply) {
          content = `[Selected: ${message.interactive.list_reply.title}]`;
        }
        break;
      case 'button':
        content = message.button?.text || '[Button response]';
        break;
      case 'reaction':
        content = `[Reacted with ${message.reaction?.emoji}]`;
        break;
      default:
        content = '[Unsupported message type]';
    }

    // Create the message record
    await prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        whatsappMessageId: message.id,
        direction: 'INBOUND',
        type: message.type.toUpperCase(),
        content,
        mediaUrl,
        mediaType,
        status: 'RECEIVED',
        metadata: {
          timestamp: message.timestamp,
          context: message.context,
          referral: message.referral,
        },
      },
    });

    console.log('[Dialog360 Webhook] Message saved:', message.id);

    // TODO: Trigger AI response if configured
    // TODO: Send real-time update via Pusher

  } catch (error) {
    console.error('[Dialog360 Webhook] Error processing message:', error);
    throw error;
  }
}

/**
 * Process a status update
 */
async function processStatusUpdate(
  organizationId: string,
  status: WebhookStatus
): Promise<void> {
  try {
    // Update message status
    await prisma.whatsAppMessage.updateMany({
      where: {
        whatsappMessageId: status.id,
        conversation: { organizationId },
      },
      data: {
        status: status.status.toUpperCase(),
        ...(status.status === 'failed' && status.errors?.[0]
          ? {
              errorCode: String(status.errors[0].code),
              errorMessage: status.errors[0].message || status.errors[0].title,
            }
          : {}),
      },
    });

    console.log('[Dialog360 Webhook] Status updated:', status.id, '->', status.status);

  } catch (error) {
    console.error('[Dialog360 Webhook] Error processing status:', error);
    throw error;
  }
}
