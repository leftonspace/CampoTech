/**
 * Token Blacklist Service
 * =======================
 *
 * Redis-based JWT blacklist for immediate token revocation.
 * Uses the JWT's jti (JWT ID) claim for tracking.
 */

import { Redis } from 'ioredis';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TokenBlacklistConfig {
  /** Redis connection URL */
  redisUrl: string;
  /** Key prefix for namespacing */
  keyPrefix?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const KEY_PREFIX = 'token:blacklist:';

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN BLACKLIST SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class TokenBlacklistService {
  private redis: Redis;
  private keyPrefix: string;

  constructor(config: TokenBlacklistConfig) {
    this.redis = new Redis(config.redisUrl);
    this.keyPrefix = config.keyPrefix || KEY_PREFIX;
  }

  /**
   * Revoke a token by its JTI
   * @param jti - The JWT ID (from the jti claim)
   * @param expiresAt - Unix timestamp when the token expires
   */
  async revokeToken(jti: string, expiresAt: number): Promise<void> {
    const key = this.getKey(jti);
    const now = Math.floor(Date.now() / 1000);
    const ttl = expiresAt - now;

    if (ttl <= 0) {
      // Token already expired, no need to blacklist
      return;
    }

    // Store with TTL matching token expiry (no need to keep after expiry)
    await this.redis.setex(key, ttl, '1');
  }

  /**
   * Revoke all tokens for a user
   * @param userId - User ID to revoke all tokens for
   * @param maxTTL - Maximum TTL in seconds (default: 7 days for refresh tokens)
   */
  async revokeAllUserTokens(userId: string, maxTTL: number = 7 * 24 * 60 * 60): Promise<void> {
    const key = `${this.keyPrefix}user:${userId}`;
    const now = Math.floor(Date.now() / 1000);

    // Store the revocation timestamp - any token issued before this is invalid
    await this.redis.setex(key, maxTTL, String(now));
  }

  /**
   * Check if a token is revoked
   * @param jti - The JWT ID
   * @returns true if the token is revoked
   */
  async isRevoked(jti: string): Promise<boolean> {
    const key = this.getKey(jti);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Check if all user tokens were revoked after a specific time
   * @param userId - User ID
   * @param issuedAt - Token's issued at timestamp
   * @returns true if user tokens were revoked after issuedAt
   */
  async isUserTokenRevoked(userId: string, issuedAt: number): Promise<boolean> {
    const key = `${this.keyPrefix}user:${userId}`;
    const revokedAt = await this.redis.get(key);

    if (!revokedAt) {
      return false;
    }

    // Token is revoked if it was issued before the revocation timestamp
    return issuedAt < parseInt(revokedAt, 10);
  }

  /**
   * Check both individual token and user-wide revocation
   * @param jti - JWT ID
   * @param userId - User ID (sub claim)
   * @param issuedAt - Token's issued at timestamp
   */
  async isTokenRevoked(jti: string, userId: string, issuedAt: number): Promise<boolean> {
    // Check individual token first (faster for specific revocations)
    const isIndividuallyRevoked = await this.isRevoked(jti);
    if (isIndividuallyRevoked) {
      return true;
    }

    // Check user-wide revocation
    return this.isUserTokenRevoked(userId, issuedAt);
  }

  /**
   * Get the Redis key for a JTI
   */
  private getKey(jti: string): string {
    return `${this.keyPrefix}jti:${jti}`;
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    await this.redis.quit();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let tokenBlacklistService: TokenBlacklistService | null = null;

/**
 * Initialize the global token blacklist service
 */
export function initializeTokenBlacklist(config: TokenBlacklistConfig): void {
  tokenBlacklistService = new TokenBlacklistService(config);
}

/**
 * Get the global token blacklist service
 */
export function getTokenBlacklist(): TokenBlacklistService {
  if (!tokenBlacklistService) {
    throw new Error('Token blacklist service not initialized');
  }
  return tokenBlacklistService;
}
