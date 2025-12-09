import { NextRequest, NextResponse } from 'next/server';
import {
  validateWebhookSignature,
  verifyWebhook,
  parseWebhookPayload,
} from '@/../../src/integrations/whatsapp/webhook/webhook.handler';
import {
  processInboundMessage,
  processStatusUpdate,
  getWhatsAppConfig,
} from '@/../../src/integrations/whatsapp/whatsapp.service';
import { prisma } from '@/lib/prisma';

/**
 * WhatsApp Webhook Verification (GET)
 * Handles Meta's verification challenge
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode') || '';
  const token = searchParams.get('hub.verify_token') || '';
  const challenge = searchParams.get('hub.challenge') || '';

  // Get verify token from environment or first organization
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'campotech_webhook_verify';

  const result = verifyWebhook(mode, token, challenge, verifyToken);

  if (result) {
    return new NextResponse(result, { status: 200 });
  }

  return NextResponse.json(
    { error: 'Webhook verification failed' },
    { status: 403 }
  );
}

/**
 * WhatsApp Webhook Handler (POST)
 * Processes incoming messages and status updates
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256') || '';

    // Parse payload first to get phone number ID
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Extract phone number ID from payload
    const phoneNumberId = payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    if (!phoneNumberId) {
      // Just acknowledge - may be a test webhook
      return NextResponse.json({ status: 'ok' });
    }

    // Find organization by phone number ID
    const organization = await prisma.organization.findFirst({
      where: { whatsappPhoneNumberId: phoneNumberId },
    });

    if (!organization) {
      console.warn('No organization found for WhatsApp phone number:', phoneNumberId);
      // Still acknowledge to avoid webhook retries
      return NextResponse.json({ status: 'ok' });
    }

    // Validate signature if app secret is configured
    if (organization.whatsappAppSecret) {
      const isValid = validateWebhookSignature(
        rawBody,
        signature,
        organization.whatsappAppSecret
      );

      if (!isValid) {
        console.warn('WhatsApp webhook signature validation failed');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Parse webhook events
    const events = parseWebhookPayload(payload);

    // Process each event
    for (const event of events) {
      try {
        if (event.type === 'message' && event.message) {
          await processInboundMessage(
            organization.id,
            event.message,
            event.contact?.name
          );
        } else if (event.type === 'status' && event.status) {
          await processStatusUpdate(organization.id, event.status);
        }
      } catch (error) {
        console.error('Error processing webhook event:', error);
        // Continue processing other events
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    // Still return 200 to prevent webhook retries
    return NextResponse.json({ status: 'error' });
  }
}
