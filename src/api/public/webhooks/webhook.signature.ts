/**
 * Webhook Signature
 * ==================
 *
 * Utilities for signing and verifying webhook payloads.
 * Uses HMAC-SHA256 for signatures.
 */

import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const SIGNATURE_VERSION = 'v1';
const SIGNATURE_HEADER = 'X-Webhook-Signature';
const TIMESTAMP_HEADER = 'X-Webhook-Timestamp';
const WEBHOOK_ID_HEADER = 'X-Webhook-ID';

/** Maximum age of a valid signature (5 minutes) */
const SIGNATURE_MAX_AGE_SECONDS = 300;

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNATURE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a webhook signature for a payload
 */
export function generateSignature(
  payload: string | object,
  secret: string,
  timestamp?: number
): { signature: string; timestamp: number } {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

  // Create signature payload: timestamp.payload
  const signaturePayload = `${ts}.${payloadString}`;

  // Generate HMAC-SHA256 signature
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  return {
    signature: `${SIGNATURE_VERSION}=${signature}`,
    timestamp: ts,
  };
}

/**
 * Generate webhook headers for a request
 */
export function generateWebhookHeaders(
  webhookId: string,
  payload: string | object,
  secret: string,
  customHeaders?: Record<string, string>
): Record<string, string> {
  const { signature, timestamp } = generateSignature(payload, secret);

  return {
    'Content-Type': 'application/json',
    [WEBHOOK_ID_HEADER]: webhookId,
    [TIMESTAMP_HEADER]: timestamp.toString(),
    [SIGNATURE_HEADER]: signature,
    'User-Agent': 'CampoTech-Webhook/1.0',
    ...customHeaders,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNATURE VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface VerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Verify a webhook signature
 */
export function verifySignature(
  payload: string | object,
  signature: string,
  timestamp: number | string,
  secret: string,
  options?: {
    maxAgeSeconds?: number;
    currentTime?: number;
  }
): VerificationResult {
  const maxAge = options?.maxAgeSeconds ?? SIGNATURE_MAX_AGE_SECONDS;
  const currentTime = options?.currentTime ?? Math.floor(Date.now() / 1000);
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;

  // Validate timestamp
  if (isNaN(ts)) {
    return { valid: false, error: 'Invalid timestamp format' };
  }

  // Check timestamp age
  const age = currentTime - ts;
  if (age > maxAge) {
    return { valid: false, error: `Signature expired (age: ${age}s, max: ${maxAge}s)` };
  }

  // Don't accept future timestamps (with small tolerance)
  if (ts > currentTime + 60) {
    return { valid: false, error: 'Timestamp is in the future' };
  }

  // Parse signature
  const signatureParts = signature.split(',');
  const signatures: Record<string, string> = {};

  for (const part of signatureParts) {
    const [version, sig] = part.split('=');
    if (version && sig) {
      signatures[version.trim()] = sig.trim();
    }
  }

  // Get v1 signature
  const providedSignature = signatures[SIGNATURE_VERSION];
  if (!providedSignature) {
    return { valid: false, error: `No ${SIGNATURE_VERSION} signature found` };
  }

  // Generate expected signature
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signaturePayload = `${ts}.${payloadString}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  // Timing-safe comparison
  const isValid = timingSafeEqual(providedSignature, expectedSignature);

  if (!isValid) {
    return { valid: false, error: 'Signature mismatch' };
  }

  return { valid: true };
}

/**
 * Verify webhook headers
 */
export function verifyWebhookRequest(
  payload: string | object,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
  options?: {
    maxAgeSeconds?: number;
    currentTime?: number;
  }
): VerificationResult {
  const signature = getHeader(headers, SIGNATURE_HEADER);
  const timestamp = getHeader(headers, TIMESTAMP_HEADER);

  if (!signature) {
    return { valid: false, error: `Missing ${SIGNATURE_HEADER} header` };
  }

  if (!timestamp) {
    return { valid: false, error: `Missing ${TIMESTAMP_HEADER} header` };
  }

  return verifySignature(payload, signature, timestamp, secret, options);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECRET GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a new webhook secret
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Validate webhook secret format
 */
export function isValidWebhookSecret(secret: string): boolean {
  return /^whsec_[a-f0-9]{64}$/.test(secret);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  // Headers are case-insensitive
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return undefined;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to maintain constant time
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  SIGNATURE_VERSION,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  WEBHOOK_ID_HEADER,
  SIGNATURE_MAX_AGE_SECONDS,
};
