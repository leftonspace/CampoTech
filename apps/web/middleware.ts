/**
 * CampoTech Edge Middleware (Phase 6.1 + 6.3 + 7.3)
 * ==================================================
 *
 * Next.js Edge Middleware for:
 * - Rate limiting with tier-based limits
 * - API versioning headers
 * - Request logging
 * - Security headers
 * - CSRF protection (Origin validation)
 *
 * Rate Limits:
 * - FREE: 30 req/min
 * - INICIAL: 100 req/min
 * - PROFESIONAL: 500 req/min
 * - EMPRESA: 2000 req/min
 *
 * API Version: 1
 *
 * OWASP A05:2021 - Security Misconfiguration
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
  INICIAL: 100,
  PROFESIONAL: 500,
  EMPRESA: 2000,
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
// CSRF PROTECTION (OWASP A05:2021)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * HTTP methods that modify state and require CSRF protection
 */
const STATE_CHANGING_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Paths that should bypass CSRF validation (webhooks from external services)
 */
const CSRF_BYPASS_PATHS = [
  '/api/webhooks/',
  '/api/cron/',
];

/**
 * Allowed origins for CSRF validation
 * In production, this should match your domain(s)
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  // Add production domain
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
  }

  // Add Vercel preview URLs
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }

  // Development origins
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:3000');
    origins.push('http://localhost:3001');
    origins.push('http://127.0.0.1:3000');
  }

  return origins;
}

/**
 * Validate Origin/Referer header for CSRF protection
 * Returns true if the request is safe, false if it should be blocked
 */
function validateCsrf(request: NextRequest): { valid: boolean; reason?: string } {
  const method = request.method;

  // GET, HEAD, OPTIONS are safe methods
  if (!STATE_CHANGING_METHODS.includes(method)) {
    return { valid: true };
  }

  const pathname = request.nextUrl.pathname;

  // Bypass CSRF for webhooks and cron (they use API keys/secrets)
  if (CSRF_BYPASS_PATHS.some(path => pathname.startsWith(path))) {
    return { valid: true };
  }

  // Get Origin header (preferred)
  const origin = request.headers.get('origin');

  // Get Referer header as fallback
  const referer = request.headers.get('referer');

  // At least one must be present for state-changing requests
  if (!origin && !referer) {
    // Allow requests without Origin/Referer only if they have a valid auth cookie
    // This handles same-origin requests from some browsers
    const hasAuthCookie = request.cookies.has('auth-token');
    if (hasAuthCookie) {
      return { valid: true };
    }
    return { valid: false, reason: 'Missing Origin or Referer header' };
  }

  const allowedOrigins = getAllowedOrigins();

  // Validate Origin if present
  if (origin) {
    if (allowedOrigins.length === 0) {
      // If no allowed origins configured, allow all (dev mode fallback)
      return { valid: true };
    }
    if (allowedOrigins.includes(origin)) {
      return { valid: true };
    }
    return { valid: false, reason: `Origin ${origin} not allowed` };
  }

  // Validate Referer as fallback
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowedOrigins.length === 0) {
        return { valid: true };
      }
      if (allowedOrigins.includes(refererOrigin)) {
        return { valid: true };
      }
      return { valid: false, reason: `Referer origin ${refererOrigin} not allowed` };
    } catch {
      return { valid: false, reason: 'Invalid Referer URL' };
    }
  }

  return { valid: true };
}

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

  // CSRF Protection - validate Origin for state-changing requests
  const csrfResult = validateCsrf(request);
  if (!csrfResult.valid) {
    return new NextResponse(
      JSON.stringify({
        error: 'CSRF Validation Failed',
        message: 'Request blocked due to invalid origin',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
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
