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
    // Acknowledge webhook to prevent retries
    // WhatsApp integration not yet implemented
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ status: 'error' });
  }
}
