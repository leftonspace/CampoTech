/**
 * Auth Wrapper Middleware
 * =======================
 * 
 * Provides explicit authentication wrappers for API routes.
 * Use this to ensure auth is checked even when re-exporting handlers.
 * 
 * Security Fix: MEDIUM-1 from Phase 6 Authorization Audit
 * - Ensures v1 re-export routes maintain auth protection
 * - Provides defense-in-depth against accidental auth removal
 * 
 * Usage:
 * ```typescript
 * import { withAuth } from '@/lib/middleware/with-auth';
 * export const GET = withAuth(baseGET);
 * export const POST = withAuth(basePOST);
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, type TokenPayload } from '@/lib/auth';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuthenticatedRequest extends NextRequest {
    session: TokenPayload;
}

export type AuthenticatedHandler = (
    request: AuthenticatedRequest,
    context?: unknown
) => Promise<NextResponse> | NextResponse;

export type StandardHandler = (
    request: NextRequest,
    context?: any // eslint-disable-line @typescript-eslint/no-explicit-any -- Required: route handlers have varying context shapes
) => Promise<NextResponse> | NextResponse;

export interface WithAuthOptions {
    /** Allow specific roles only */
    allowedRoles?: string[];
    /** Skip auth check (for intentionally public endpoints) */
    skipAuth?: boolean;
    /** Custom error message */
    unauthorizedMessage?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wraps an API route handler with authentication check
 * 
 * @param handler - The original route handler
 * @param options - Optional configuration
 * @returns Wrapped handler that checks auth before executing
 */
export function withAuth(
    handler: StandardHandler,
    options: WithAuthOptions = {}
): StandardHandler {
    const {
        allowedRoles,
        skipAuth = false,
        unauthorizedMessage = 'Unauthorized',
    } = options;

    return async (request: NextRequest, context?: unknown): Promise<NextResponse> => {
        // Skip auth if explicitly configured (for documented public endpoints)
        if (skipAuth) {
            return handler(request, context);
        }

        try {
            const session = await getSession();

            if (!session) {
                return NextResponse.json(
                    { success: false, error: unauthorizedMessage },
                    { status: 401 }
                );
            }

            // Check role if specified
            if (allowedRoles && allowedRoles.length > 0) {
                const userRole = session.role?.toUpperCase();
                const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

                if (!userRole || !normalizedAllowed.includes(userRole)) {
                    return NextResponse.json(
                        { success: false, error: 'Forbidden: insufficient permissions' },
                        { status: 403 }
                    );
                }
            }

            // Attach session to request for downstream use
            const authenticatedRequest = request as AuthenticatedRequest;
            authenticatedRequest.session = session;

            // Execute original handler
            return handler(request, context);
        } catch (error) {
            console.error('[withAuth] Authentication error:', error);
            return NextResponse.json(
                { success: false, error: 'Authentication error' },
                { status: 401 }
            );
        }
    };
}

/**
 * Wraps an API route handler requiring specific roles
 * 
 * @param handler - The original route handler
 * @param roles - Required roles (any match allows access)
 * @returns Wrapped handler with role check
 */
export function withRole(
    handler: StandardHandler,
    roles: string[]
): StandardHandler {
    return withAuth(handler, { allowedRoles: roles });
}

/**
 * Wraps an API route handler requiring OWNER role
 */
export function withOwner(handler: StandardHandler): StandardHandler {
    return withRole(handler, ['OWNER']);
}

/**
 * Wraps an API route handler requiring OWNER or ADMIN role
 */
export function withManagement(handler: StandardHandler): StandardHandler {
    return withRole(handler, ['OWNER', 'ADMIN']);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates that session has required fields
 * Throws if session is invalid instead of using fallbacks
 * 
 * Security Fix: LOW-1 from Phase 6 Authorization Audit
 */
export function requireValidSession(session: TokenPayload | null): TokenPayload {
    if (!session) {
        throw new AuthError('No session found');
    }

    if (!session.userId) {
        throw new AuthError('Session missing userId');
    }

    if (!session.organizationId) {
        throw new AuthError('Session missing organizationId');
    }

    if (!session.role) {
        throw new AuthError('Session missing role');
    }

    return session;
}

/**
 * Validates and normalizes role from session
 * Throws if role is missing instead of defaulting
 * 
 * Security Fix: LOW-1 from Phase 6 Authorization Audit
 */
export function requireValidRole(session: TokenPayload): string {
    if (!session.role) {
        throw new AuthError('Session missing role - please log out and log back in');
    }

    return session.role.toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthError';
    }
}
