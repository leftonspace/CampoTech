/**
 * Customer Session Service
 * ========================
 *
 * Manages customer sessions, token generation, and session lifecycle.
 */

import * as crypto from 'crypto';
import {
  CustomerSession,
  CustomerTokenPair,
  CustomerJWTPayload,
  CustomerDeviceInfo,
  AuthenticatedCustomer,
  CustomerAuthResult,
  CustomerAuthContext,
  CustomerSessionDatabaseAdapter,
  CustomerAuthRepository,
  CustomerAuthErrorCode,
} from './customer-auth.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const ACCESS_TOKEN_TTL_SECONDS = 30 * 60;           // 30 minutes (longer than internal users)
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days (customers stay logged in longer)
const JWT_ALGORITHM = 'HS256';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Customer session specific error
 */
export class CustomerSessionError extends Error {
  code: CustomerAuthErrorCode;
  httpStatus: number;

  constructor(code: CustomerAuthErrorCode, message: string, httpStatus = 401) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.name = 'CustomerSessionError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECRET PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Secret provider interface for customer tokens
 * Uses separate secret from internal user tokens for additional security
 */
export interface CustomerSecretProvider {
  getCustomerJWTSecret(): Promise<string>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Customer Session Service class
 */
export class CustomerSessionService {
  private sessionAdapter: CustomerSessionDatabaseAdapter;
  private customerRepository: CustomerAuthRepository;
  private secretProvider: CustomerSecretProvider;
  private secretCache: string | null = null;
  private secretCacheExpiry = 0;
  private readonly SECRET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    sessionAdapter: CustomerSessionDatabaseAdapter,
    customerRepository: CustomerAuthRepository,
    secretProvider: CustomerSecretProvider
  ) {
    this.sessionAdapter = sessionAdapter;
    this.customerRepository = customerRepository;
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

    this.secretCache = await this.secretProvider.getCustomerJWTSecret();
    this.secretCacheExpiry = now + this.SECRET_CACHE_TTL;
    return this.secretCache;
  }

  /**
   * Sign a JWT payload
   */
  private async signJWT(payload: CustomerJWTPayload): Promise<string> {
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
   * Verify and decode a customer JWT
   */
  async verifyAccessToken(token: string): Promise<CustomerJWTPayload> {
    const secret = await this.getSecret();

    // Split token
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new CustomerSessionError(
        CustomerAuthErrorCode.TOKEN_INVALID,
        'Invalid token format'
      );
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature using timing-safe comparison
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
      throw new CustomerSessionError(
        CustomerAuthErrorCode.TOKEN_INVALID,
        'Invalid token signature format'
      );
    }

    // Use timing-safe comparison to prevent timing attacks
    if (providedSignature.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(providedSignature, expectedSignature)) {
      throw new CustomerSessionError(
        CustomerAuthErrorCode.TOKEN_INVALID,
        'Invalid token signature'
      );
    }

    // Decode payload
    let payload: CustomerJWTPayload;
    try {
      payload = JSON.parse(base64UrlDecode(payloadB64));
    } catch {
      throw new CustomerSessionError(
        CustomerAuthErrorCode.TOKEN_INVALID,
        'Invalid token payload'
      );
    }

    // Check token type
    if (payload.type !== 'customer') {
      throw new CustomerSessionError(
        CustomerAuthErrorCode.TOKEN_INVALID,
        'Invalid token type'
      );
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new CustomerSessionError(
        CustomerAuthErrorCode.TOKEN_EXPIRED,
        'Token has expired'
      );
    }

    // Check issued at (not in the future)
    if (payload.iat && payload.iat > now + 60) {
      throw new CustomerSessionError(
        CustomerAuthErrorCode.TOKEN_INVALID,
        'Token issued in the future'
      );
    }

    return payload;
  }

  /**
   * Generate token pair for customer
   */
  async generateTokenPair(customer: AuthenticatedCustomer): Promise<CustomerTokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const jti = crypto.randomUUID();

    // Generate access token
    const accessPayload: CustomerJWTPayload = {
      sub: customer.id,
      orgId: customer.orgId,
      type: 'customer',
      email: customer.email,
      phone: customer.phone,
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
   * Hash refresh token for storage
   */
  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create a new customer session
   */
  async createSession(
    customer: AuthenticatedCustomer,
    deviceInfo?: CustomerDeviceInfo,
    ipAddress?: string,
    userAgent?: string
  ): Promise<CustomerAuthResult> {
    // Generate tokens
    const tokens = await this.generateTokenPair(customer);

    // Create session
    const refreshTokenHash = this.hashRefreshToken(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    const session = await this.sessionAdapter.createSession({
      customerId: customer.id,
      orgId: customer.orgId,
      deviceInfo,
      ipAddress,
      userAgent,
      refreshTokenHash,
      isActive: true,
      lastUsedAt: new Date(),
      expiresAt,
    });

    // Update customer last login
    await this.customerRepository.updateLastLoginAt(customer.id);

    console.log(`[CustomerSession] Created session for customer ${customer.id.slice(0, 8)}...`);

    return {
      customer,
      tokens,
      session,
      isNewCustomer: false,
    };
  }

  /**
   * Refresh tokens using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<CustomerTokenPair> {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    // Find session
    const session = await this.sessionAdapter.getSessionByRefreshTokenHash(refreshTokenHash);

    if (!session) {
      throw new CustomerSessionError(
        CustomerAuthErrorCode.SESSION_INVALID,
        'Invalid refresh token'
      );
    }

    if (!session.isActive) {
      throw new CustomerSessionError(
        CustomerAuthErrorCode.SESSION_REVOKED,
        'Session has been revoked'
      );
    }

    if (new Date() > session.expiresAt) {
      throw new CustomerSessionError(
        CustomerAuthErrorCode.SESSION_EXPIRED,
        'Session has expired. Please log in again.'
      );
    }

    // Get customer
    const customer = await this.customerRepository.getCustomerById(
      session.orgId,
      session.customerId
    );
    if (!customer) {
      throw new CustomerSessionError(
        CustomerAuthErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found'
      );
    }

    // Generate new tokens
    const newTokens = await this.generateTokenPair(customer);

    // Create new session with rotated refresh token
    const newRefreshTokenHash = this.hashRefreshToken(newTokens.refreshToken);
    await this.sessionAdapter.createSession({
      customerId: customer.id,
      orgId: customer.orgId,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      refreshTokenHash: newRefreshTokenHash,
      isActive: true,
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    });

    // Revoke old session
    await this.sessionAdapter.revokeSession(session.id, 'token_rotation');

    console.log(`[CustomerSession] Refreshed tokens for customer ${customer.id.slice(0, 8)}...`);

    return newTokens;
  }

  /**
   * Logout - revoke current session
   */
  async logout(refreshToken: string): Promise<void> {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const session = await this.sessionAdapter.getSessionByRefreshTokenHash(refreshTokenHash);

    if (session) {
      await this.sessionAdapter.revokeSession(session.id, 'customer_logout');
      console.log(`[CustomerSession] Customer ${session.customerId.slice(0, 8)}... logged out`);
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAllDevices(customerId: string): Promise<void> {
    await this.sessionAdapter.revokeAllCustomerSessions(customerId, 'logout_all_devices');
    console.log(`[CustomerSession] All sessions revoked for customer ${customerId.slice(0, 8)}...`);
  }

  /**
   * Get active sessions for customer
   */
  async getActiveSessions(customerId: string): Promise<CustomerSession[]> {
    return this.sessionAdapter.getActiveSessionsForCustomer(customerId);
  }

  /**
   * Revoke specific session
   */
  async revokeSession(sessionId: string, reason: string): Promise<void> {
    await this.sessionAdapter.revokeSession(sessionId, reason);
  }

  /**
   * Validate access token and return auth context
   */
  async validateAccessToken(accessToken: string): Promise<CustomerAuthContext> {
    const payload = await this.verifyAccessToken(accessToken);

    return {
      customerId: payload.sub,
      orgId: payload.orgId,
      sessionId: payload.jti,
    };
  }

  /**
   * Clean up expired sessions
   */
  async cleanup(): Promise<void> {
    await this.sessionAdapter.cleanupExpiredSessions();
    console.log('[CustomerSession] Cleaned up expired sessions');
  }

  /**
   * Get token TTL values
   */
  getAccessTokenTTL(): number {
    return ACCESS_TOKEN_TTL_SECONDS;
  }

  getRefreshTokenTTL(): number {
    return REFRESH_TOKEN_TTL_SECONDS;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let instance: CustomerSessionService | null = null;

export function getCustomerSessionService(
  sessionAdapter?: CustomerSessionDatabaseAdapter,
  customerRepository?: CustomerAuthRepository,
  secretProvider?: CustomerSecretProvider
): CustomerSessionService {
  if (!instance && sessionAdapter && customerRepository && secretProvider) {
    instance = new CustomerSessionService(sessionAdapter, customerRepository, secretProvider);
  }
  if (!instance) {
    throw new Error('CustomerSessionService not initialized');
  }
  return instance;
}

export function resetCustomerSessionService(): void {
  instance = null;
}
