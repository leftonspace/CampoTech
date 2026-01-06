/**
 * CampoTech Auth Security Service (A07:2021)
 * ============================================
 *
 * Security enhancements for authentication:
 * - Shorter access token expiration (24h) with refresh tokens (7d)
 * - Failed login attempt tracking
 * - Account lockout after N failed attempts
 * - Refresh token rotation
 *
 * OWASP A07:2021 - Identification and Authentication Failures
 */

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// Token expiration times
export const ACCESS_TOKEN_EXPIRY = '24h'; // Short-lived access token
export const REFRESH_TOKEN_EXPIRY_DAYS = 7; // Long-lived refresh token

// Account lockout configuration
export const MAX_FAILED_ATTEMPTS = 5; // Lock after 5 failed attempts
export const LOCKOUT_DURATION_MINUTES = 30; // Lock for 30 minutes
export const FAILED_ATTEMPT_WINDOW_MINUTES = 15; // Count failures within this window

// ═══════════════════════════════════════════════════════════════════════════════
// JWT SECRET
// ═══════════════════════════════════════════════════════════════════════════════

function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SECURITY ERROR: NEXTAUTH_SECRET environment variable is required in production'
      );
    }
    console.warn(
      '⚠️  WARNING: Using fallback JWT secret. Set NEXTAUTH_SECRET in production!'
    );
    return new TextEncoder().encode('dev-fallback-secret-not-for-production');
  }

  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TokenPayload extends JWTPayload {
  userId: string;
  email: string | null;
  role: string;
  organizationId: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  tokenType: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface LoginAttemptResult {
  allowed: boolean;
  locked: boolean;
  remainingAttempts?: number;
  lockoutEndsAt?: Date;
  message?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCESS TOKEN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a short-lived access token (24h)
 */
export async function createAccessToken(payload: Omit<TokenPayload, 'tokenType'>): Promise<string> {
  return new SignJWT({ ...payload, tokenType: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * Verify an access token
 */
export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const tokenPayload = payload as unknown as TokenPayload;

    // Ensure it's an access token
    if (tokenPayload.tokenType !== 'access') {
      return null;
    }

    return tokenPayload;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REFRESH TOKEN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a secure random refresh token
 */
function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('base64url');
}

/**
 * Hash a refresh token for secure storage
 */
function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new token pair (access + refresh tokens)
 */
export async function createTokenPair(
  payload: Omit<TokenPayload, 'tokenType'>,
  userAgent?: string,
  ipAddress?: string
): Promise<TokenPair> {
  const accessToken = await createAccessToken(payload);
  const refreshToken = generateRefreshToken();
  const hashedRefreshToken = hashRefreshToken(refreshToken);

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Store refresh token in database
  await prisma.$executeRaw`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip_address, created_at)
    VALUES (gen_random_uuid(), ${payload.userId}::uuid, ${hashedRefreshToken}, ${expiresAt}, ${userAgent || null}, ${ipAddress || null}, NOW())
    ON CONFLICT DO NOTHING
  `;

  // Clean up old refresh tokens for this user (keep only last 5)
  await prisma.$executeRaw`
    DELETE FROM refresh_tokens
    WHERE user_id = ${payload.userId}::uuid
    AND id NOT IN (
      SELECT id FROM refresh_tokens
      WHERE user_id = ${payload.userId}::uuid
      ORDER BY created_at DESC
      LIMIT 5
    )
  `;

  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
}

/**
 * Refresh tokens - issue new access token using refresh token
 * Implements refresh token rotation for security
 */
export async function refreshTokens(
  refreshToken: string,
  userAgent?: string,
  ipAddress?: string
): Promise<TokenPair | null> {
  const hashedToken = hashRefreshToken(refreshToken);

  try {
    // Find valid refresh token
    const tokenRecord = await prisma.$queryRaw<Array<{
      id: string;
      user_id: string;
      expires_at: Date;
    }>>`
      SELECT id, user_id, expires_at
      FROM refresh_tokens
      WHERE token_hash = ${hashedToken}
      AND expires_at > NOW()
      AND revoked = false
      LIMIT 1
    `;

    if (tokenRecord.length === 0) {
      return null;
    }

    const { id: tokenId, user_id: userId } = tokenRecord[0];

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        isActive: true,
        organization: {
          select: {
            subscriptionTier: true,
            subscriptionStatus: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      // Revoke the token if user is inactive
      await prisma.$executeRaw`
        UPDATE refresh_tokens SET revoked = true WHERE id = ${tokenId}::uuid
      `;
      return null;
    }

    // Revoke old refresh token (token rotation)
    await prisma.$executeRaw`
      UPDATE refresh_tokens SET revoked = true WHERE id = ${tokenId}::uuid
    `;

    // Create new token pair
    return createTokenPair(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        subscriptionTier: user.organization.subscriptionTier,
        subscriptionStatus: user.organization.subscriptionStatus,
      },
      userAgent,
      ipAddress
    );
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    return null;
  }
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE refresh_tokens SET revoked = true WHERE user_id = ${userId}::uuid
  `;
}

/**
 * Revoke a specific refresh token
 */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const hashedToken = hashRefreshToken(refreshToken);
  await prisma.$executeRaw`
    UPDATE refresh_tokens SET revoked = true WHERE token_hash = ${hashedToken}
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAILED LOGIN ATTEMPT TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if login is allowed (not locked out)
 * Returns lockout status and remaining attempts
 */
export async function checkLoginAllowed(
  identifier: string,
  identifierType: 'phone' | 'email' | 'user_id' = 'phone'
): Promise<LoginAttemptResult> {
  try {
    const windowStart = new Date(Date.now() - FAILED_ATTEMPT_WINDOW_MINUTES * 60 * 1000);

    // Check for active lockout
    const lockoutRecord = await prisma.$queryRaw<Array<{
      locked_until: Date;
    }>>`
      SELECT locked_until
      FROM login_lockouts
      WHERE identifier = ${identifier}
      AND identifier_type = ${identifierType}
      AND locked_until > NOW()
      LIMIT 1
    `;

    if (lockoutRecord.length > 0) {
      return {
        allowed: false,
        locked: true,
        lockoutEndsAt: lockoutRecord[0].locked_until,
        message: `Cuenta bloqueada temporalmente. Intente de nuevo después de ${Math.ceil((lockoutRecord[0].locked_until.getTime() - Date.now()) / 60000)} minutos.`,
      };
    }

    // Count recent failed attempts
    const failedAttempts = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM login_attempts
      WHERE identifier = ${identifier}
      AND identifier_type = ${identifierType}
      AND success = false
      AND created_at > ${windowStart}
    `;

    const attemptCount = Number(failedAttempts[0]?.count || 0);
    const remainingAttempts = MAX_FAILED_ATTEMPTS - attemptCount;

    if (attemptCount >= MAX_FAILED_ATTEMPTS) {
      // Create lockout
      const lockoutEndsAt = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      await createLockout(identifier, identifierType, lockoutEndsAt);

      return {
        allowed: false,
        locked: true,
        remainingAttempts: 0,
        lockoutEndsAt,
        message: `Demasiados intentos fallidos. Cuenta bloqueada por ${LOCKOUT_DURATION_MINUTES} minutos.`,
      };
    }

    return {
      allowed: true,
      locked: false,
      remainingAttempts: Math.max(0, remainingAttempts),
    };
  } catch (error) {
    console.error('Error checking login allowed:', error);
    // Fail open - allow login if check fails (to avoid blocking legitimate users)
    return { allowed: true, locked: false };
  }
}

/**
 * Record a login attempt
 */
export async function recordLoginAttempt(
  identifier: string,
  identifierType: 'phone' | 'email' | 'user_id',
  success: boolean,
  ipAddress?: string,
  userAgent?: string,
  userId?: string
): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO login_attempts (id, identifier, identifier_type, success, ip_address, user_agent, user_id, created_at)
      VALUES (gen_random_uuid(), ${identifier}, ${identifierType}, ${success}, ${ipAddress || null}, ${userAgent || null}, ${userId ? `${userId}::uuid` : null}, NOW())
    `;

    // If successful login, clear any existing lockout
    if (success) {
      await clearLockout(identifier, identifierType);
    }
  } catch (error) {
    console.error('Error recording login attempt:', error);
    // Don't fail the login if logging fails
  }
}

/**
 * Create a lockout for an identifier
 */
async function createLockout(
  identifier: string,
  identifierType: 'phone' | 'email' | 'user_id',
  lockedUntil: Date
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO login_lockouts (id, identifier, identifier_type, locked_until, created_at)
    VALUES (gen_random_uuid(), ${identifier}, ${identifierType}, ${lockedUntil}, NOW())
    ON CONFLICT (identifier, identifier_type)
    DO UPDATE SET locked_until = ${lockedUntil}
  `;
}

/**
 * Clear a lockout for an identifier
 */
async function clearLockout(
  identifier: string,
  identifierType: 'phone' | 'email' | 'user_id'
): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM login_lockouts
    WHERE identifier = ${identifier}
    AND identifier_type = ${identifierType}
  `;
}

/**
 * Get login history for a user (for security auditing)
 */
export async function getLoginHistory(
  userId: string,
  limit: number = 10
): Promise<Array<{
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}>> {
  const safeLimit = Math.min(Math.max(1, limit), 100);

  const history = await prisma.$queryRaw<Array<{
    success: boolean;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
  }>>`
    SELECT success, ip_address, user_agent, created_at
    FROM login_attempts
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `;

  return history.map(h => ({
    success: h.success,
    ipAddress: h.ip_address,
    userAgent: h.user_agent,
    createdAt: h.created_at,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEANUP FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clean up expired tokens and old login attempts
 * Should be called by a cron job
 */
export async function cleanupAuthData(): Promise<{
  expiredTokens: number;
  oldAttempts: number;
  expiredLockouts: number;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Delete expired/revoked refresh tokens
  const expiredTokens = await prisma.$executeRaw`
    DELETE FROM refresh_tokens
    WHERE expires_at < NOW() OR revoked = true
  `;

  // Delete old login attempts (keep 30 days for audit)
  const oldAttempts = await prisma.$executeRaw`
    DELETE FROM login_attempts
    WHERE created_at < ${thirtyDaysAgo}
  `;

  // Delete expired lockouts
  const expiredLockouts = await prisma.$executeRaw`
    DELETE FROM login_lockouts
    WHERE locked_until < NOW()
  `;

  return {
    expiredTokens: expiredTokens as number,
    oldAttempts: oldAttempts as number,
    expiredLockouts: expiredLockouts as number,
  };
}
