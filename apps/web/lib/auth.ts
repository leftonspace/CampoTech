import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';

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
  userId: string;
  email: string | null;
  role: string;
  organizationId: string;
}

export async function createToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
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
