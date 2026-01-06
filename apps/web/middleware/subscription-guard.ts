import { NextResponse, type NextRequest } from 'next/server';

/**
 * Subscription Guard Middleware
 * ============================
 * 
 * Phase 2.5 Task 2.5.1: Trial Lockout Middleware
 * 
 * Enforces access control based on organization subscription status.
 * - Blocks access to dashboard/premium routes if trial is expired or cancelled.
 * - Allows "forever free" routes (public profiles, wa-redirects) always.
 */

// Paths that are ALWAYS accessible, even if subscription is expired/cancelled
const FOREVER_FREE_PATHS = [
    '/p/',            // Public business profiles
    '/wa-redirect/',  // WhatsApp redirects (Phase 2.5.2)
    '/auth/',         // Authentication pages
    '/register/',     // Registration flow
    '/blocked',       // Status information page
    '/api/auth/',     // Auth API
    '/api/public/',   // Public API
    '/api/webhooks/', // Webhooks
    '/favicon.ico',
    '/robots.txt',
];

// Statuses that trigger a block
const BLOCKED_STATUSES = ['expired', 'cancelled'];

export async function subscriptionGuard(
    request: NextRequest,
    payload: {
        subscriptionStatus?: string;
        organizationId?: string;
    }
): Promise<NextResponse | null> {
    const { pathname } = request.nextUrl;
    const { subscriptionStatus } = payload;

    // 1. If it's a forever free path, never block
    if (FOREVER_FREE_PATHS.some(path => pathname.startsWith(path))) {
        return null;
    }

    // 2. If it's a static asset or internal Next.js path, never block
    if (pathname.startsWith('/_next/') || pathname.startsWith('/static/')) {
        return null;
    }

    // 3. Check for blocked status
    if (subscriptionStatus && BLOCKED_STATUSES.includes(subscriptionStatus)) {
        // Redirect to blocked page if they try to access something else (like /dashboard)
        if (pathname !== '/blocked') {
            const url = request.nextUrl.clone();
            url.pathname = '/blocked';
            return NextResponse.redirect(url);
        }
    }

    return null;
}
