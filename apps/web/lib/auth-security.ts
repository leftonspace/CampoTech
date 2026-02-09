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
import * as crypto from 'crypto';

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

  // Store refresh token in database using Prisma models
  await prisma.refreshToken.create({
    data: {
      userId: payload.userId,
      tokenHash: hashedRefreshToken,
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
    },
  });

  // Clean up old refresh tokens for this user (keep only last 5)
  const oldTokens = await prisma.refreshToken.findMany({
    where: { userId: payload.userId },
    orderBy: { createdAt: 'desc' },
    skip: 5,
    select: { id: true },
  });

  if (oldTokens.length > 0) {
    await prisma.refreshToken.deleteMany({
      where: { id: { in: oldTokens.map((t: { id: string }) => t.id) } },
    });
  }

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
    // Find valid refresh token using Prisma model
    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        tokenHash: hashedToken,
        expiresAt: { gt: new Date() },
        revoked: false,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
      },
    });

    if (!tokenRecord) {
      return null;
    }

    const { id: tokenId, userId } = tokenRecord;

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
      await prisma.refreshToken.update({
        where: { id: tokenId },
        data: { revoked: true },
      });
      return null;
    }

    // Revoke old refresh token (token rotation)
    await prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revoked: true },
    });

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
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revoked: true },
  });
}

/**
 * Revoke a specific refresh token
 */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const hashedToken = hashRefreshToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashedToken },
    data: { revoked: true },
  });
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

    // Check for active lockout using Prisma model
    const lockoutRecord = await prisma.loginLockout.findFirst({
      where: {
        identifier,
        identifierType,
        lockedUntil: { gt: new Date() },
      },
    });

    if (lockoutRecord) {
      return {
        allowed: false,
        locked: true,
        lockoutEndsAt: lockoutRecord.lockedUntil,
        message: `Cuenta bloqueada temporalmente. Intente de nuevo después de ${Math.ceil((lockoutRecord.lockedUntil.getTime() - Date.now()) / 60000)} minutos.`,
      };
    }

    // Count recent failed attempts using Prisma model
    const attemptCount = await prisma.loginAttempt.count({
      where: {
        identifier,
        identifierType,
        success: false,
        createdAt: { gt: windowStart },
      },
    });

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
    await prisma.loginAttempt.create({
      data: {
        identifier,
        identifierType,
        success,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        userId: userId || null,
      },
    });

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
  await prisma.loginLockout.upsert({
    where: {
      identifier_identifierType: {
        identifier,
        identifierType,
      },
    },
    create: {
      identifier,
      identifierType,
      lockedUntil,
    },
    update: {
      lockedUntil,
    },
  });
}

/**
 * Clear a lockout for an identifier
 */
async function clearLockout(
  identifier: string,
  identifierType: 'phone' | 'email' | 'user_id'
): Promise<void> {
  await prisma.loginLockout.deleteMany({
    where: {
      identifier,
      identifierType,
    },
  });
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

  const history = await prisma.loginAttempt.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
    select: {
      success: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
  });

  return history;
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
  const expiredTokensResult = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revoked: true },
      ],
    },
  });

  // Delete old login attempts (keep 30 days for audit)
  const oldAttemptsResult = await prisma.loginAttempt.deleteMany({
    where: {
      createdAt: { lt: thirtyDaysAgo },
    },
  });

  // Delete expired lockouts
  const expiredLockoutsResult = await prisma.loginLockout.deleteMany({
    where: {
      lockedUntil: { lt: new Date() },
    },
  });

  return {
    expiredTokens: expiredTokensResult.count,
    oldAttempts: oldAttemptsResult.count,
    expiredLockouts: expiredLockoutsResult.count,
  };
}
