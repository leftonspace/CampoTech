import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';

/**
 * CampoTech Auth Module
 * =====================
 *
 * JWT-based authentication with security enhancements:
 * - Short-lived access tokens (24h instead of 7d)
 * - Refresh token support available via auth-security.ts
 *
 * OWASP A07:2021 - Identification and Authentication Failures
 */

// Token expiration - reduced from 7d to 24h for better security
// Use refresh tokens for longer sessions (see auth-security.ts)
const ACCESS_TOKEN_EXPIRY = '24h';

/**
 * Get JWT secret with validation
 * In production, NEXTAUTH_SECRET must be set
 * In development, uses a fallback (with warning)
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SECURITY ERROR: NEXTAUTH_SECRET environment variable is required in production'
      );
    }
    // Development fallback with warning
    console.warn(
      '⚠️  WARNING: Using fallback JWT secret. Set NEXTAUTH_SECRET in production!'
    );
    return new TextEncoder().encode('dev-fallback-secret-not-for-production');
  }

  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();

export interface TokenPayload extends JWTPayload {
  id: string; // Alias for userId for compatibility
  userId: string;
  email: string | null;
  role: string;
  organizationId: string;
  subscriptionTier: string;
  subscriptionStatus: string;
}

/**
 * Create access token with reduced expiration (24h)
 * For longer sessions, use createTokenPair from auth-security.ts
 */
export async function createToken(payload: Omit<TokenPayload, 'id'> & { id?: string }): Promise<string> {
  const tokenPayload = {
    ...payload,
    id: payload.id || payload.userId, // Ensure id is always set
  };
  return new SignJWT({ ...tokenPayload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<TokenPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}
