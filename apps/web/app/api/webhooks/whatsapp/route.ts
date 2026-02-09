/**
 * WhatsApp Webhook API Route
 * ==========================
 * 
 * Handles webhooks from Meta's WhatsApp Business API.
 * Implements secure signature validation using HMAC-SHA256.
 * 
 * Security: Phase 7 Audit Remediation (CRIT-01)
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface WebhookPayload {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      field: string;
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
    }>;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: SIGNATURE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate Meta webhook signature using HMAC-SHA256
 * 
 * Meta signs webhooks with x-hub-signature-256 header:
 * sha256=<signature>
 * 
 * @param rawBody - Raw request body as string
 * @param signature - x-hub-signature-256 header value
 * @param secret - App secret from Meta dashboard
 * @returns true if signature is valid
 */
function validateMetaSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  // Meta format: sha256=<hex_signature>
  if (!signature.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const actualSignature = signature.slice(7); // Remove 'sha256=' prefix

  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(actualSignature, 'hex')
    );
  } catch {
    // Buffer lengths differ (invalid signature format)
    return false;
  }
}

/**
 * Sanitize webhook payload for logging (redact PII)
 */
function sanitizePayloadForLogging(payload: WebhookPayload): Record<string, unknown> {
  return {
    object: payload.object,
    entryCount: payload.entry?.length ?? 0,
    entries: payload.entry?.map((entry) => ({
      id: entry.id,
      changesCount: entry.changes?.length ?? 0,
      fields: entry.changes?.map((c) => c.field),
      messageCount: entry.changes?.reduce((sum, c) => sum + (c.value.messages?.length ?? 0), 0),
      statusCount: entry.changes?.reduce((sum, c) => sum + (c.value.statuses?.length ?? 0), 0),
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - WhatsApp Webhook Verification
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode') || '';
  const token = searchParams.get('hub.verify_token') || '';
  const challenge = searchParams.get('hub.challenge') || '';

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'campotech_webhook_verify';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn('[WhatsApp Webhook] Verification failed', { mode, tokenMatch: token === verifyToken });
  return NextResponse.json(
    { error: 'Webhook verification failed' },
    { status: 403 }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - WhatsApp Webhook Handler (SECURED)
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    // 1. Get raw body FIRST (required for signature validation)
    const rawBody = await request.text();

    // 2. Get signature header
    const signature = request.headers.get('x-hub-signature-256');
    const appSecret = process.env.WHATSAPP_APP_SECRET || '';

    // 3. CRITICAL: Validate signature BEFORE processing
    // Skip validation only in development without secret configured
    if (process.env.NODE_ENV === 'production' || appSecret) {
      if (!signature) {
        console.warn('[WhatsApp Webhook] Missing signature header');
        return NextResponse.json(
          { error: 'Missing signature' },
          { status: 401 }
        );
      }

      if (!validateMetaSignature(rawBody, signature, appSecret)) {
        console.warn('[WhatsApp Webhook] Invalid signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    } else {
      console.warn('[WhatsApp Webhook] DEV MODE: Signature validation skipped');
    }

    // 4. Parse body (safe now that signature is validated)
    let body: WebhookPayload;
    try {
      body = JSON.parse(rawBody) as WebhookPayload;
    } catch {
      console.error('[WhatsApp Webhook] Invalid JSON payload');
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    // 5. Log sanitized webhook (no PII)
    console.log('[WhatsApp Webhook] Received:', JSON.stringify(sanitizePayloadForLogging(body)));

    // 6. Process messages and statuses
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.messages) {
      for (const message of value.messages) {
        console.log('[WhatsApp Webhook] Incoming message:', {
          id: message.id,
          type: message.type,
          timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
          // Note: 'from' and 'text' intentionally not logged (PII)
        });
      }
    }

    if (value?.statuses) {
      for (const status of value.statuses) {
        console.log('[WhatsApp Webhook] Status update:', {
          id: status.id,
          status: status.status,
          timestamp: new Date(parseInt(status.timestamp) * 1000).toISOString(),
          // Note: 'recipient_id' intentionally not logged (PII)
        });
      }
    }

    // 7. Acknowledge webhook to prevent retries
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[WhatsApp Webhook] Error:', error instanceof Error ? error.message : 'Unknown error');
    // Return 500 to trigger retry (webhook may be legitimate)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
