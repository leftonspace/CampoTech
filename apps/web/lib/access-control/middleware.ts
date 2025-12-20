/**
 * Access Control Middleware
 * =========================
 *
 * Middleware wrapper for API routes that enforces access control
 * based on subscription and verification status.
 *
 * Usage:
 * ```typescript
 * export const GET = withAccessControl(
 *   async (req, context) => {
 *     // Handler code with access to context.accessStatus
 *     return NextResponse.json({ data: ... });
 *   },
 *   { requireJobs: true }
 * );
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkAccess, checkUserAccess, type AccessStatus, type UserAccessStatus } from './checker';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AccessControlOptions {
  /** Require dashboard access (active subscription, not hard-blocked) */
  requireDashboard?: boolean;
  /** Require job access (dashboard + verified + no blocks) */
  requireJobs?: boolean;
  /** Require employee assignment access (jobs + user verified) */
  requireEmployees?: boolean;
  /** Require marketplace visibility */
  requireMarketplace?: boolean;
  /** Custom access check function */
  customCheck?: (accessStatus: AccessStatus) => boolean | Promise<boolean>;
  /** Override redirect URL for blocked access */
  blockedRedirectUrl?: string;
}

export interface AccessControlContext {
  /** Current user's session */
  session: {
    id: string;
    email: string | null;
    role: string;
    organizationId: string;
  };
  /** Organization's access status */
  accessStatus: AccessStatus;
  /** User's access status (if employee) */
  userAccessStatus?: UserAccessStatus;
  /** Request object */
  request: NextRequest;
  /** Route params */
  params?: Record<string, string>;
}

export type AccessControlHandler = (
  request: NextRequest,
  context: AccessControlContext
) => Promise<NextResponse> | NextResponse;

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wrap an API handler with access control checks
 */
export function withAccessControl(
  handler: AccessControlHandler,
  options: AccessControlOptions = {}
) {
  return async (
    request: NextRequest,
    routeContext?: { params?: Record<string, string> }
  ): Promise<NextResponse> => {
    try {
      // Get session
      const session = await getSession();

      if (!session) {
        return NextResponse.json(
          {
            success: false,
            error: 'No autorizado',
            code: 'unauthorized',
          },
          { status: 401 }
        );
      }

      // Check access status
      const accessStatus = await checkAccess(session.organizationId);

      // Check user access if needed
      let userAccessStatus: UserAccessStatus | undefined;
      if (options.requireEmployees || session.role !== 'OWNER') {
        userAccessStatus = await checkUserAccess(session.id, session.organizationId);
      }

      // Apply access checks
      const { allowed, reason, redirectUrl } = evaluateAccess(
        accessStatus,
        userAccessStatus,
        options
      );

      if (!allowed) {
        // Check if custom check passes
        if (options.customCheck) {
          const customPasses = await options.customCheck(accessStatus);
          if (customPasses) {
            // Custom check passed, allow access
          } else {
            return buildBlockedResponse(reason, redirectUrl, accessStatus);
          }
        } else {
          return buildBlockedResponse(reason, redirectUrl, accessStatus);
        }
      }

      // Build context
      const context: AccessControlContext = {
        session: {
          id: session.id,
          email: session.email,
          role: session.role || 'TECHNICIAN',
          organizationId: session.organizationId,
        },
        accessStatus,
        userAccessStatus,
        request,
        params: routeContext?.params,
      };

      // Call handler
      return await handler(request, context);
    } catch (error) {
      console.error('[AccessControl] Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Error de acceso',
          code: 'access_error',
        },
        { status: 500 }
      );
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCESS EVALUATION
// ═══════════════════════════════════════════════════════════════════════════════

interface AccessEvaluationResult {
  allowed: boolean;
  reason?: string;
  redirectUrl?: string;
}

function evaluateAccess(
  accessStatus: AccessStatus,
  userAccessStatus: UserAccessStatus | undefined,
  options: AccessControlOptions
): AccessEvaluationResult {
  const defaultRedirectUrl = options.blockedRedirectUrl || '/blocked';

  // Check hard block first
  if (accessStatus.isHardBlocked) {
    const blockReason = accessStatus.blockReasons.find(
      (r) => r.severity === 'hard_block'
    );
    return {
      allowed: false,
      reason: blockReason?.message || 'Acceso bloqueado',
      redirectUrl: blockReason?.actionUrl || defaultRedirectUrl,
    };
  }

  // Check dashboard access
  if (options.requireDashboard !== false) {
    if (!accessStatus.canAccessDashboard) {
      const reason = accessStatus.subscription.isTrialExpired
        ? 'Tu período de prueba ha terminado'
        : 'No tenés acceso al dashboard';
      return {
        allowed: false,
        reason,
        redirectUrl: '/dashboard/settings/billing',
      };
    }
  }

  // Check job access
  if (options.requireJobs) {
    if (!accessStatus.canReceiveJobs) {
      const reason = !accessStatus.verification.tier2Complete
        ? 'Completá la verificación para acceder a esta función'
        : accessStatus.verification.expiredDocuments.length > 0
          ? 'Tenés documentos vencidos'
          : 'No podés recibir trabajos';
      return {
        allowed: false,
        reason,
        redirectUrl: '/dashboard/settings/verification',
      };
    }
  }

  // Check employee access
  if (options.requireEmployees) {
    if (!accessStatus.canAssignEmployees) {
      return {
        allowed: false,
        reason: 'No podés asignar empleados',
        redirectUrl: '/dashboard/settings/verification',
      };
    }

    // Also check user-level access
    if (userAccessStatus && !userAccessStatus.canBeAssignedJobs) {
      return {
        allowed: false,
        reason: userAccessStatus.blockReasons[0]?.message || 'Usuario no puede recibir trabajos',
        redirectUrl: '/dashboard/settings/verification',
      };
    }
  }

  // Check marketplace access
  if (options.requireMarketplace) {
    if (!accessStatus.isMarketplaceVisible) {
      return {
        allowed: false,
        reason: 'Tu negocio no está visible en el marketplace',
        redirectUrl: '/dashboard/settings/verification',
      };
    }
  }

  return { allowed: true };
}

function buildBlockedResponse(
  reason: string | undefined,
  redirectUrl: string | undefined,
  accessStatus: AccessStatus
): NextResponse {
  const statusCode = accessStatus.isHardBlocked ? 403 : 423; // 423 = Locked

  return NextResponse.json(
    {
      success: false,
      error: reason || 'Acceso restringido',
      code: accessStatus.isHardBlocked ? 'hard_blocked' : 'soft_blocked',
      redirectUrl,
      blockReasons: accessStatus.blockReasons,
      requiresAction: accessStatus.requiresAction,
    },
    { status: statusCode }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE ACCESS CHECK MIDDLEWARE (for page routes)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simple access check for use in server components or API routes
 * Returns the access status or throws an error if not accessible
 */
export async function requireAccess(
  organizationId: string,
  options: AccessControlOptions = {}
): Promise<AccessStatus> {
  const accessStatus = await checkAccess(organizationId);

  const { allowed, reason } = evaluateAccess(accessStatus, undefined, options);

  if (!allowed) {
    throw new AccessDeniedError(reason || 'Acceso denegado', accessStatus);
  }

  return accessStatus;
}

/**
 * Custom error class for access denied
 */
export class AccessDeniedError extends Error {
  accessStatus: AccessStatus;

  constructor(message: string, accessStatus: AccessStatus) {
    super(message);
    this.name = 'AccessDeniedError';
    this.accessStatus = accessStatus;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { checkAccess, checkUserAccess } from './checker';
export type { AccessStatus, UserAccessStatus, BlockReason, ExpiringDoc } from './checker';
