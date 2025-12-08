/**
 * Token Service
 * =============
 *
 * Handles JWT access token and refresh token generation/validation.
 */

import * as crypto from 'crypto';
import {
  JWTPayload,
  TokenPair,
  UserRole,
  AuthErrorCode,
} from '../types/auth.types';
import { getTokenBlacklist } from './token-blacklist.service';

// Configuration
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;        // 15 minutes
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;  // 7 days
const JWT_ALGORITHM = 'HS256';

// Base64url encoding helpers
function base64UrlEncode(data: string | Buffer): string {
  const base64 = Buffer.isBuffer(data)
    ? data.toString('base64')
    : Buffer.from(data).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(data: string): string {
  const padded = data + '='.repeat((4 - (data.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Secret provider interface
 */
export interface SecretProvider {
  getJWTSecret(): Promise<string>;
}

/**
 * Token Service class
 */
export class TokenService {
  private secretProvider: SecretProvider;
  private secretCache: string | null = null;
  private secretCacheExpiry = 0;
  private readonly SECRET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(secretProvider: SecretProvider) {
    this.secretProvider = secretProvider;
  }

  /**
   * Get JWT secret with caching
   */
  private async getSecret(): Promise<string> {
    const now = Date.now();
    if (this.secretCache && now < this.secretCacheExpiry) {
      return this.secretCache;
    }

    this.secretCache = await this.secretProvider.getJWTSecret();
    this.secretCacheExpiry = now + this.SECRET_CACHE_TTL;
    return this.secretCache;
  }

  /**
   * Generate a token pair (access + refresh)
   */
  async generateTokenPair(
    userId: string,
    orgId: string,
    role: UserRole
  ): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const jti = crypto.randomUUID();

    // Generate access token
    const accessPayload: JWTPayload = {
      sub: userId,
      orgId,
      role,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL_SECONDS,
      jti,
    };
    const accessToken = await this.signJWT(accessPayload);

    // Generate refresh token (opaque)
    const refreshToken = crypto.randomBytes(32).toString('hex');

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      tokenType: 'Bearer',
    };
  }

  /**
   * Sign a JWT payload
   */
  private async signJWT(payload: JWTPayload): Promise<string> {
    const secret = await this.getSecret();

    // Header
    const header = { alg: JWT_ALGORITHM, typ: 'JWT' };
    const headerB64 = base64UrlEncode(JSON.stringify(header));

    // Payload
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));

    // Signature
    const signatureInput = `${headerB64}.${payloadB64}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signatureInput)
      .digest();
    const signatureB64 = base64UrlEncode(signature);

    return `${headerB64}.${payloadB64}.${signatureB64}`;
  }

  /**
   * Verify and decode a JWT
   */
  async verifyAccessToken(token: string): Promise<JWTPayload> {
    const secret = await this.getSecret();

    // Split token
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new TokenError(AuthErrorCode.INVALID_TOKEN, 'Invalid token format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature using timing-safe comparison to prevent timing attacks
    const signatureInput = `${headerB64}.${payloadB64}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signatureInput)
      .digest();

    // Decode the provided signature for comparison
    const providedSignaturePadded = signatureB64 + '='.repeat((4 - (signatureB64.length % 4)) % 4);
    const providedSignatureBase64 = providedSignaturePadded.replace(/-/g, '+').replace(/_/g, '/');
    let providedSignature: Buffer;
    try {
      providedSignature = Buffer.from(providedSignatureBase64, 'base64');
    } catch {
      throw new TokenError(AuthErrorCode.INVALID_TOKEN, 'Invalid token signature format');
    }

    // Use timing-safe comparison to prevent timing attacks
    if (providedSignature.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(providedSignature, expectedSignature)) {
      throw new TokenError(AuthErrorCode.INVALID_TOKEN, 'Invalid token signature');
    }

    // Decode payload
    let payload: JWTPayload;
    try {
      payload = JSON.parse(base64UrlDecode(payloadB64));
    } catch {
      throw new TokenError(AuthErrorCode.INVALID_TOKEN, 'Invalid token payload');
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new TokenError(AuthErrorCode.TOKEN_EXPIRED, 'Token has expired');
    }

    // Check issued at (not in the future)
    if (payload.iat && payload.iat > now + 60) {
      throw new TokenError(AuthErrorCode.INVALID_TOKEN, 'Token issued in the future');
    }

    // Check if token is revoked (blacklisted)
    try {
      const blacklist = getTokenBlacklist();
      if (payload.jti && payload.sub && payload.iat) {
        const isRevoked = await blacklist.isTokenRevoked(
          payload.jti,
          payload.sub,
          payload.iat
        );
        if (isRevoked) {
          throw new TokenError(AuthErrorCode.TOKEN_REVOKED, 'Token has been revoked');
        }
      }
    } catch (error) {
      // If blacklist service not initialized, skip check (for backwards compatibility)
      if (error instanceof TokenError) {
        throw error;
      }
      // Log but don't fail if blacklist unavailable
      console.warn('Token blacklist check skipped:', error);
    }

    return payload;
  }

  /**
   * Hash refresh token for storage
   */
  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Get refresh token TTL in seconds
   */
  getRefreshTokenTTL(): number {
    return REFRESH_TOKEN_TTL_SECONDS;
  }

  /**
   * Get access token TTL in seconds
   */
  getAccessTokenTTL(): number {
    return ACCESS_TOKEN_TTL_SECONDS;
  }
}

/**
 * Custom Token error
 */
export class TokenError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'TokenError';
  }
}

// Export singleton factory
let instance: TokenService | null = null;

export function getTokenService(secretProvider?: SecretProvider): TokenService {
  if (!instance && secretProvider) {
    instance = new TokenService(secretProvider);
  }
  if (!instance) {
    throw new Error('TokenService not initialized');
  }
  return instance;
}
