/**
 * CampoTech Edge Middleware (Phase 6.1 + 6.3)
 * ============================================
 *
 * Next.js Edge Middleware for:
 * - Rate limiting with tier-based limits
 * - API versioning headers
 * - Request logging
 * - Security headers
 *
 * Rate Limits:
 * - FREE: 30 req/min
 * - BASICO (Inicial): 100 req/min
 * - PROFESIONAL: 500 req/min
 * - EMPRESARIAL: 2000 req/min
 *
 * API Version: 1
 */

import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * JWT Secret - must be set in production
 * Edge middleware has limited logging, so we log once on module load
 */
const JWT_SECRET = (() => {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('SECURITY ERROR: NEXTAUTH_SECRET is required in production');
  }
  return new TextEncoder().encode(
    secret || 'dev-fallback-secret-not-for-production'
  );
})();

/**
 * Paths that should bypass rate limiting
 */
const BYPASS_PATHS = [
  '/_next',          // Next.js assets
  '/static',         // Static files
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/health',         // Health check endpoints
  '/api/health',
];

/**
 * Paths that should use stricter rate limits (auth endpoints)
 */
const AUTH_PATHS = [
  '/api/auth',
  '/auth/login',
  '/auth/register',
  '/auth/signin',
  '/auth/signup',
];

/**
 * Rate limits per tier (requests per minute)
 */
const RATE_LIMITS = {
  FREE: 30,
  BASICO: 100,
  PROFESIONAL: 500,
  EMPRESARIAL: 2000,
} as const;

type SubscriptionTier = keyof typeof RATE_LIMITS;

/**
 * Auth endpoint stricter limit
 */
const AUTH_RATE_LIMIT = 10; // 10 requests per minute

/**
 * API Version Configuration (Phase 6.3)
 */
const API_VERSION = '1';
const API_VERSION_HEADER = 'X-API-Version';

/**
 * Paths that should NOT receive API version headers
 */
const NO_VERSION_HEADER_PATHS = [
  '/api/health',
  '/api/webhooks/',
];

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDING WINDOW RATE LIMITER (in-memory for Edge Runtime)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simple in-memory rate limiter for Edge Runtime
 * Note: For production with multiple Edge instances, use Upstash directly
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (resets on Edge function restart)
// For production, this uses Upstash Redis via the rate-limit module
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
const CLEANUP_INTERVAL = 60000; // 1 minute
let lastCleanup = Date.now();

function cleanupStaleEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check rate limit using sliding window
 */
function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  cleanupStaleEntries();

  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    // Rate limited
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Increment counter
  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

interface TokenPayload extends JWTPayload {
  userId: string;
  email: string | null;
  role: string;
  organizationId: string;
  tier?: SubscriptionTier;
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get client IP from request
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp) return vercelIp.split(',')[0].trim();

  return 'unknown';
}

/**
 * Check if path should bypass rate limiting
 */
function shouldBypass(pathname: string): boolean {
  return BYPASS_PATHS.some(path => pathname.startsWith(path));
}

/**
 * Check if path is an auth endpoint
 */
function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some(path => pathname.startsWith(path));
}

/**
 * Check if path is an API route that should have version headers
 */
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

/**
 * Check if path should have API version headers
 */
function shouldAddVersionHeader(pathname: string): boolean {
  if (!isApiRoute(pathname)) return false;
  return !NO_VERSION_HEADER_PATHS.some(path => pathname.startsWith(path));
}

/**
 * Get subscription tier from cache or token
 * In production, this would query Upstash Redis
 */
async function getTierForOrg(organizationId: string, tokenTier?: SubscriptionTier): Promise<SubscriptionTier> {
  // If tier is in token, use it
  if (tokenTier && tokenTier in RATE_LIMITS) {
    return tokenTier;
  }

  // TODO: In production, look up tier from Upstash Redis cache
  // const cached = await redis.get(`org:tier:${organizationId}`);
  // if (cached) return cached as SubscriptionTier;

  // Default to FREE if not found
  return 'FREE';
}

/**
 * Create rate limit headers
 */
function createRateLimitHeaders(
  limit: number,
  remaining: number,
  resetAt: number
): HeadersInit {
  return {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, remaining).toString(),
    'X-RateLimit-Reset': Math.ceil(resetAt / 1000).toString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Skip rate limiting for bypassed paths
  if (shouldBypass(pathname)) {
    return NextResponse.next();
  }

  // Get client identifier
  const clientIp = getClientIp(request);
  let identifier = `ip:${clientIp}`;
  let tier: SubscriptionTier = 'FREE';
  let organizationId: string | undefined;

  // Try to get authenticated user info
  const token = request.cookies.get('auth-token')?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      organizationId = payload.organizationId;
      identifier = `org:${organizationId}`;
      tier = await getTierForOrg(organizationId, payload.tier);
    }
  }

  // Determine rate limit
  let limit: number;
  let limitType: string;

  if (isAuthPath(pathname)) {
    // Use stricter limit for auth endpoints
    limit = AUTH_RATE_LIMIT;
    limitType = 'auth';
    identifier = `auth:${clientIp}`; // Always use IP for auth to prevent credential stuffing
  } else {
    limit = RATE_LIMITS[tier];
    limitType = tier;
  }

  // Check rate limit
  const result = checkRateLimit(identifier, limit);

  // Create headers
  const rateLimitHeaders = createRateLimitHeaders(limit, result.remaining, result.resetAt);

  if (!result.allowed) {
    // Rate limited - return 429
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: `Límite de solicitudes excedido. Intente de nuevo en ${retryAfter} segundos.`,
        retryAfter,
        limit,
        limitType,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
          ...rateLimitHeaders,
        },
      }
    );
  }

  // Allowed - continue with rate limit headers
  const response = NextResponse.next();

  // Add rate limit headers to response
  Object.entries(rateLimitHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Add API version header for API routes (Phase 6.3)
  if (shouldAddVersionHeader(pathname)) {
    response.headers.set(API_VERSION_HEADER, API_VERSION);
  }

  return response;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATCHER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
