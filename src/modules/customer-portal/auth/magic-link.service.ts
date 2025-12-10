/**
 * Magic Link Service
 * ==================
 *
 * Handles magic link (email-based passwordless) authentication for customers.
 * Magic links are the primary authentication method for the customer portal.
 */

import * as crypto from 'crypto';
import {
  MagicLink,
  MagicLinkMetadata,
  SendMagicLinkRequest,
  VerifyMagicLinkRequest,
  MagicLinkDatabaseAdapter,
  CustomerEmailProvider,
  CustomerAuthErrorCode,
} from './customer-auth.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const MAGIC_LINK_TTL_MINUTES = 15;           // Link expires in 15 minutes
const MAGIC_LINK_TOKEN_LENGTH = 32;          // 32 bytes = 256 bits
const RATE_LIMIT_WINDOW_MINUTES = 60;        // 1 hour window
const MAX_LINKS_PER_WINDOW = 5;              // Max 5 links per hour per email

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Magic link specific error
 */
export class MagicLinkError extends Error {
  code: CustomerAuthErrorCode;
  httpStatus: number;

  constructor(code: CustomerAuthErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.name = 'MagicLinkError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Magic Link Service class
 */
export class MagicLinkService {
  private dbAdapter: MagicLinkDatabaseAdapter;
  private emailProvider: CustomerEmailProvider;
  private portalBaseUrl: string;

  constructor(
    dbAdapter: MagicLinkDatabaseAdapter,
    emailProvider: CustomerEmailProvider,
    portalBaseUrl: string
  ) {
    this.dbAdapter = dbAdapter;
    this.emailProvider = emailProvider;
    this.portalBaseUrl = portalBaseUrl;
  }

  /**
   * Generate a cryptographically secure token
   */
  private generateToken(): string {
    return crypto.randomBytes(MAGIC_LINK_TOKEN_LENGTH).toString('base64url');
  }

  /**
   * Hash token for secure storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Build the magic link URL
   */
  private buildMagicLinkUrl(token: string, orgId: string, metadata?: MagicLinkMetadata): string {
    const url = new URL(`${this.portalBaseUrl}/verify`);
    url.searchParams.set('token', token);
    url.searchParams.set('org', orgId);

    if (metadata?.returnTo) {
      url.searchParams.set('returnTo', metadata.returnTo);
    }
    if (metadata?.context) {
      url.searchParams.set('context', metadata.context);
    }

    return url.toString();
  }

  /**
   * Normalize email for consistent storage/lookup
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Validate email format
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Send a magic link to customer email
   */
  async sendMagicLink(
    request: SendMagicLinkRequest,
    orgName: string,
    customerId?: string
  ): Promise<{ expiresAt: Date; email: string }> {
    const normalizedEmail = this.normalizeEmail(request.email);

    // Validate email format
    if (!this.validateEmail(normalizedEmail)) {
      throw new MagicLinkError(
        CustomerAuthErrorCode.MAGIC_LINK_INVALID,
        'Invalid email format'
      );
    }

    // Check rate limiting
    const recentCount = await this.dbAdapter.countRecentMagicLinks(
      normalizedEmail,
      RATE_LIMIT_WINDOW_MINUTES
    );

    if (recentCount >= MAX_LINKS_PER_WINDOW) {
      throw new MagicLinkError(
        CustomerAuthErrorCode.MAGIC_LINK_RATE_LIMITED,
        'Too many magic link requests. Please try again later.',
        429
      );
    }

    // Generate token
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);

    // Create magic link record
    await this.dbAdapter.createMagicLink({
      orgId: request.orgId,
      customerId,
      email: normalizedEmail,
      tokenHash,
      used: false,
      expiresAt,
      metadata: request.metadata,
    });

    // Build URL
    const magicLinkUrl = this.buildMagicLinkUrl(token, request.orgId, request.metadata);

    // Send email
    const sent = await this.emailProvider.sendMagicLinkEmail(
      normalizedEmail,
      magicLinkUrl,
      orgName,
      MAGIC_LINK_TTL_MINUTES
    );

    if (!sent) {
      console.error(`[MagicLink] Failed to send magic link email to ${normalizedEmail}`);
      throw new MagicLinkError(
        CustomerAuthErrorCode.MAGIC_LINK_INVALID,
        'Failed to send magic link email. Please try again.',
        500
      );
    }

    console.log(`[MagicLink] Sent magic link to ${normalizedEmail.slice(0, 3)}***@${normalizedEmail.split('@')[1]}`);

    return {
      expiresAt,
      email: normalizedEmail,
    };
  }

  /**
   * Verify a magic link token
   * Returns the magic link record if valid, throws error otherwise
   */
  async verifyMagicLink(token: string): Promise<MagicLink> {
    const tokenHash = this.hashToken(token);

    // Find magic link
    const magicLink = await this.dbAdapter.getMagicLinkByTokenHash(tokenHash);

    if (!magicLink) {
      throw new MagicLinkError(
        CustomerAuthErrorCode.MAGIC_LINK_INVALID,
        'Invalid or expired magic link'
      );
    }

    // Check if expired
    if (new Date() > magicLink.expiresAt) {
      throw new MagicLinkError(
        CustomerAuthErrorCode.MAGIC_LINK_EXPIRED,
        'Magic link has expired. Please request a new one.'
      );
    }

    // Check if already used
    if (magicLink.used) {
      throw new MagicLinkError(
        CustomerAuthErrorCode.MAGIC_LINK_USED,
        'Magic link has already been used. Please request a new one.'
      );
    }

    // Mark as used
    await this.dbAdapter.markMagicLinkUsed(magicLink.id);

    console.log(`[MagicLink] Verified magic link for ${magicLink.email.slice(0, 3)}***`);

    return magicLink;
  }

  /**
   * Create a direct magic link for specific contexts (e.g., invoice viewing)
   * These links can have longer TTL and specific permissions
   */
  async createContextualMagicLink(
    orgId: string,
    email: string,
    customerId: string,
    context: 'invoice' | 'job_tracking' | 'booking' | 'support',
    entityId: string,
    orgName: string
  ): Promise<string> {
    const metadata: MagicLinkMetadata = {
      context,
    };

    // Set entity-specific metadata
    if (context === 'invoice') {
      metadata.invoiceId = entityId;
      metadata.returnTo = `/invoices/${entityId}`;
    } else if (context === 'job_tracking') {
      metadata.jobId = entityId;
      metadata.returnTo = `/track/${entityId}`;
    }

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

    // Contextual links have longer TTL (24 hours)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.dbAdapter.createMagicLink({
      orgId,
      customerId,
      email: this.normalizeEmail(email),
      tokenHash,
      used: false,
      expiresAt,
      metadata,
    });

    return this.buildMagicLinkUrl(token, orgId, metadata);
  }

  /**
   * Cleanup expired magic links (run periodically)
   */
  async cleanup(): Promise<void> {
    await this.dbAdapter.cleanupExpiredMagicLinks();
    console.log('[MagicLink] Cleaned up expired magic links');
  }

  /**
   * Get expiry time for magic links
   */
  getExpiryMinutes(): number {
    return MAGIC_LINK_TTL_MINUTES;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let instance: MagicLinkService | null = null;

export function getMagicLinkService(
  dbAdapter?: MagicLinkDatabaseAdapter,
  emailProvider?: CustomerEmailProvider,
  portalBaseUrl?: string
): MagicLinkService {
  if (!instance && dbAdapter && emailProvider && portalBaseUrl) {
    instance = new MagicLinkService(dbAdapter, emailProvider, portalBaseUrl);
  }
  if (!instance) {
    throw new Error('MagicLinkService not initialized');
  }
  return instance;
}

export function resetMagicLinkService(): void {
  instance = null;
}
