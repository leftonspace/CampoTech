/**
 * WhatsApp Webhook API Route
 * ==========================
 *
 * Handles incoming webhook events from WhatsApp Cloud API.
 * - GET: Webhook verification (Meta verification challenge)
 * - POST: Receive and process incoming messages and status updates
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  parseWebhookPayload,
  wasMessageProcessed,
  markMessageProcessed,
} from '@/src/integrations/whatsapp/webhook/webhook.handler';
import {
  processInboundMessage,
  processStatusUpdate,
} from '@/src/integrations/whatsapp/whatsapp.service';

// Environment variables for default webhook handling
const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

/**
 * GET: Webhook verification
 * Meta calls this endpoint to verify the webhook during setup
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('WhatsApp webhook verification request:', { mode, tokenReceived: !!token, challenge: challenge?.slice(0, 10) });

  // Verify token
  if (mode === 'subscribe' && token) {
    // Check against environment variable
    if (token === WEBHOOK_VERIFY_TOKEN) {
      console.log('WhatsApp webhook verified successfully');
      return new NextResponse(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Also try to verify against organization-specific tokens
    try {
      const org = await prisma.organization.findFirst({
        where: { whatsappWebhookVerifyToken: token },
      });

      if (org) {
        console.log('WhatsApp webhook verified for organization:', org.id);
        return new NextResponse(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    } catch (error) {
      console.error('Error checking org-specific webhook token:', error);
    }
  }

  console.warn('WhatsApp webhook verification failed');
  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * POST: Receive webhook events
 * Processes incoming messages, status updates, and errors
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    // Log webhook receipt (for debugging)
    console.log('WhatsApp webhook received:', {
      signature: signature?.slice(0, 20),
      bodyLength: body.length,
    });

    // Verify signature if app secret is configured
    if (APP_SECRET && signature) {
      const isValid = verifySignature(body, signature, APP_SECRET);
      if (!isValid) {
        console.error('WhatsApp webhook signature validation failed');

        // Log the failed attempt
        await logWebhookEvent('signature_failed', {}, signature, null, 'Invalid signature');

        return new NextResponse('Invalid signature', { status: 401 });
      }
    }

    // Parse the payload
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      console.error('WhatsApp webhook: Invalid JSON payload');
      return new NextResponse('Invalid payload', { status: 400 });
    }

    // Quick validation
    if (payload.object !== 'whatsapp_business_account') {
      console.warn('WhatsApp webhook: Invalid object type:', payload.object);
      return new NextResponse('OK', { status: 200 }); // Still return 200 to prevent retries
    }

    // Extract phone number ID to find the organization
    const phoneNumberId = extractPhoneNumberId(payload);

    // Find organization by phone number ID
    let organization = null;
    if (phoneNumberId) {
      organization = await prisma.organization.findFirst({
        where: { whatsappPhoneNumberId: phoneNumberId },
      });
    }

    // Log the webhook event
    const eventType = payload.entry?.[0]?.changes?.[0]?.field || 'unknown';
    await logWebhookEvent(eventType, payload, signature, organization?.id);

    // Process the webhook asynchronously
    // We return 200 immediately to acknowledge receipt
    processWebhookAsync(payload, organization?.id, phoneNumberId).catch((error) => {
      console.error('Error in async webhook processing:', error);
    });

    const processingTime = Date.now() - startTime;
    console.log('WhatsApp webhook acknowledged', { processingTime, eventType });

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);

    // Still return 200 to prevent Meta from retrying
    // We've logged the error, we can investigate later
    return new NextResponse('OK', { status: 200 });
  }
}

/**
 * Process webhook events asynchronously
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processWebhookAsync(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  organizationId: string | null | undefined,
  _phoneNumberId: string | null
) {
  try {
    // Parse events
    const events = parseWebhookPayload(payload);

    for (const event of events) {
      // Skip if no organization found and we can't route the message
      if (!organizationId && event.type === 'message') {
        // Try to find org by phone number ID from the event
        if (event.phoneNumberId) {
          const org = await prisma.organization.findFirst({
            where: { whatsappPhoneNumberId: event.phoneNumberId },
          });
          if (org) {
            organizationId = org.id;
          }
        }
      }

      if (!organizationId) {
        console.warn('WhatsApp webhook: No organization found for event', {
          phoneNumberId: event.phoneNumberId,
          type: event.type,
        });
        continue;
      }

      // Process based on event type
      switch (event.type) {
        case 'message':
          if (event.message) {
            // Check idempotency
            if (wasMessageProcessed(event.message.id)) {
              console.log('Message already processed:', event.message.id);
              continue;
            }

            await processInboundMessage(
              organizationId,
              event.message,
              event.contact?.name
            );

            markMessageProcessed(event.message.id);
          }
          break;

        case 'status':
          if (event.status) {
            await processStatusUpdate(organizationId, event.status);
          }
          break;

        case 'error':
          console.error('WhatsApp webhook error event:', event.error);
          break;
      }
    }
  } catch (error) {
    console.error('Error processing webhook events:', error);
    throw error;
  }
}

/**
 * Verify webhook signature
 */
function verifySignature(body: string, signature: string, secret: string): boolean {
  try {
    const signatureHash = signature.replace('sha256=', '');
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signatureHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Extract phone number ID from webhook payload
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPhoneNumberId(// eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any): string | null {
  try {
    return payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || null;
  } catch {
    return null;
  }
}

/**
 * Log webhook event to database
 */
async function logWebhookEvent(
  eventType: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  signature: string | null,
  organizationId: string | null | undefined,
  error?: string
) {
  try {
    await prisma.waWebhookLog.create({
      data: {
        organizationId: organizationId || null,
        eventType,
        payload,
        signature,
        processed: !error,
        processedAt: error ? null : new Date(),
        error,
      },
    });
  } catch (err) {
    console.error('Failed to log webhook event:', err);
  }
}
