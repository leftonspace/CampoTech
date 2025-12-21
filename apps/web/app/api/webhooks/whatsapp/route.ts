/**
 * WhatsApp Webhook API Route
 * Self-contained implementation (placeholder)
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * GET - WhatsApp Webhook Verification
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode') || '';
  const token = searchParams.get('hub.verify_token') || '';
  const challenge = searchParams.get('hub.challenge') || '';

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'campotech_webhook_verify';

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json(
    { error: 'Webhook verification failed' },
    { status: 403 }
  );
}

/**
 * POST - WhatsApp Webhook Handler
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log the incoming webhook for debugging
    console.log('=== WhatsApp Webhook Received ===');
    console.log(JSON.stringify(body, null, 2));

    // Extract message details if present
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.messages) {
      for (const message of value.messages) {
        console.log('📱 Incoming WhatsApp Message:');
        console.log(`   From: ${message.from}`);
        console.log(`   Type: ${message.type}`);
        if (message.text) {
          console.log(`   Text: ${message.text.body}`);
        }
        console.log(`   Timestamp: ${new Date(parseInt(message.timestamp) * 1000).toLocaleString()}`);
      }
    }

    if (value?.statuses) {
      for (const status of value.statuses) {
        console.log('📬 Message Status Update:');
        console.log(`   Status: ${status.status}`);
        console.log(`   Recipient: ${status.recipient_id}`);
      }
    }

    // Acknowledge webhook to prevent retries
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ status: 'error' });
  }
}
