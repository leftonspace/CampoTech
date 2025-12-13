/**
 * WhatsApp Media Service
 * ======================
 *
 * Handles media URL signing, caching, and expiration
 * for WhatsApp media files.
 */

import crypto from 'crypto';
import { log } from '../../lib/logging/logger';
import { db } from '../../lib/db';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const MEDIA_URL_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const SIGNED_URL_SECRET = process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET || 'default-secret';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SignedUrlParams {
  mediaId: string;
  organizationId: string;
  expiresAt: number;
}

interface MediaCacheEntry {
  url: string;
  mimeType: string;
  expiresAt: number;
}

// Simple in-memory cache for media URLs
const mediaUrlCache = new Map<string, MediaCacheEntry>();

// ═══════════════════════════════════════════════════════════════════════════════
// URL SIGNING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a signed URL for media access
 * This adds a signature and expiration to prevent unauthorized access
 */
export function generateSignedMediaUrl(
  baseUrl: string,
  mediaId: string,
  organizationId: string,
  expiryMs: number = MEDIA_URL_EXPIRY_MS
): string {
  const expiresAt = Date.now() + expiryMs;

  const params: SignedUrlParams = {
    mediaId,
    organizationId,
    expiresAt,
  };

  // Create signature
  const signature = createSignature(params);

  // Build signed URL
  const signedUrl = new URL(baseUrl);
  signedUrl.searchParams.set('mediaId', mediaId);
  signedUrl.searchParams.set('orgId', organizationId);
  signedUrl.searchParams.set('expires', expiresAt.toString());
  signedUrl.searchParams.set('sig', signature);

  return signedUrl.toString();
}

/**
 * Verify a signed media URL
 * Returns true if the signature is valid and URL hasn't expired
 */
export function verifySignedMediaUrl(
  mediaId: string,
  organizationId: string,
  expiresAt: number,
  signature: string
): { valid: boolean; error?: string } {
  // Check expiration
  if (Date.now() > expiresAt) {
    return { valid: false, error: 'URL has expired' };
  }

  // Verify signature
  const params: SignedUrlParams = {
    mediaId,
    organizationId,
    expiresAt,
  };

  const expectedSignature = createSignature(params);

  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true };
}

/**
 * Create HMAC signature for URL parameters
 */
function createSignature(params: SignedUrlParams): string {
  const data = `${params.mediaId}:${params.organizationId}:${params.expiresAt}`;
  const hmac = crypto.createHmac('sha256', SIGNED_URL_SECRET);
  hmac.update(data);
  return hmac.digest('base64url');
}

// ═══════════════════════════════════════════════════════════════════════════════
// URL CACHING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get cached media URL or return null if expired/not found
 */
export function getCachedMediaUrl(mediaId: string): MediaCacheEntry | null {
  const cached = mediaUrlCache.get(mediaId);

  if (!cached) {
    return null;
  }

  // Check if expired
  if (Date.now() > cached.expiresAt) {
    mediaUrlCache.delete(mediaId);
    return null;
  }

  return cached;
}

/**
 * Cache a media URL with expiration
 */
export function cacheMediaUrl(
  mediaId: string,
  url: string,
  mimeType: string,
  expiresAt?: number
): void {
  mediaUrlCache.set(mediaId, {
    url,
    mimeType,
    expiresAt: expiresAt || Date.now() + MEDIA_URL_EXPIRY_MS,
  });
}

/**
 * Clear expired entries from cache
 */
export function cleanupMediaCache(): void {
  const now = Date.now();
  for (const [key, value] of mediaUrlCache.entries()) {
    if (now > value.expiresAt) {
      mediaUrlCache.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupMediaCache, 5 * 60 * 1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA METADATA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get media metadata from database
 */
export async function getMediaMetadata(
  mediaId: string,
  organizationId: string
): Promise<{ url: string; mimeType: string } | null> {
  try {
    // First check cache
    const cached = getCachedMediaUrl(mediaId);
    if (cached) {
      return { url: cached.url, mimeType: cached.mimeType };
    }

    // Look up in messages
    const message = await db.waMessage.findFirst({
      where: {
        mediaId,
        conversation: {
          organizationId,
        },
      },
      select: {
        mediaUrl: true,
        mediaMimeType: true,
      },
    });

    if (message?.mediaUrl) {
      // Cache it
      cacheMediaUrl(mediaId, message.mediaUrl, message.mediaMimeType || 'application/octet-stream');
      return {
        url: message.mediaUrl,
        mimeType: message.mediaMimeType || 'application/octet-stream',
      };
    }

    return null;
  } catch (error) {
    log.error('Error getting media metadata', {
      mediaId,
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

/**
 * Store media URL in database message
 */
export async function storeMediaUrl(
  messageId: string,
  mediaId: string,
  mediaUrl: string,
  mimeType: string
): Promise<void> {
  try {
    await db.waMessage.update({
      where: { id: messageId },
      data: {
        mediaId,
        mediaUrl,
        mediaMimeType: mimeType,
      },
    });

    // Also cache it
    cacheMediaUrl(mediaId, mediaUrl, mimeType);

    log.debug('Media URL stored', { messageId, mediaId });
  } catch (error) {
    log.error('Error storing media URL', {
      messageId,
      mediaId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  generateSignedMediaUrl,
  verifySignedMediaUrl,
  getCachedMediaUrl,
  cacheMediaUrl,
  cleanupMediaCache,
  getMediaMetadata,
  storeMediaUrl,
};
