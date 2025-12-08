/**
 * Authorization Middleware
 * ========================
 *
 * Role-based access control middleware.
 * Checks if user has required permissions for an operation.
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/domain.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuthContext {
  userId: string;
  orgId: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Role permissions mapping
 * Uses hierarchical permission structure: resource:action or resource:action:scope
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: ['*'], // Full access
  admin: [
    'jobs:*',
    'customers:*',
    'invoices:*',
    'payments:read', 'payments:create',
    'pricebook:*',
    'users:read', 'users:create', 'users:update',
    'reports:*',
    'settings:read', 'settings:update',
    'audit:read',
  ],
  dispatcher: [
    'jobs:*',
    'customers:read', 'customers:create', 'customers:update',
    'invoices:read',
    'pricebook:read',
    'users:read',
  ],
  technician: [
    'jobs:read:assigned',
    'jobs:update:assigned',
    'jobs:transition:assigned',
    'customers:read',
    'pricebook:read',
  ],
  accountant: [
    'invoices:*',
    'payments:*',
    'customers:read',
    'jobs:read',
    'reports:read',
    'audit:read',
  ],
};

/**
 * Check if role has specific permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];

  // Owner has full access
  if (perms.includes('*')) return true;

  // Exact match
  if (perms.includes(permission)) return true;

  // Check wildcard permissions
  const [resource, action] = permission.split(':');

  // Check resource:* wildcard
  if (perms.includes(`${resource}:*`)) return true;

  // Check resource:action wildcard (matches resource:action:scope)
  if (perms.some(p => p.startsWith(`${resource}:${action}:`))) {
    return perms.includes(`${resource}:${action}:assigned`);
  }

  return false;
}

/**
 * Check if user can access a specific resource based on ownership
 */
export function canAccessResource(
  auth: AuthContext,
  resource: { assignedTo?: string; createdBy?: string; userId?: string }
): boolean {
  // Owners and admins can access everything
  if (auth.role === 'owner' || auth.role === 'admin') return true;

  // Check if user owns/is assigned to the resource
  if (resource.assignedTo === auth.userId) return true;
  if (resource.createdBy === auth.userId) return true;
  if (resource.userId === auth.userId) return true;

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.userId || !req.auth?.orgId) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }
  next();
}

/**
 * Require specific permission
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    if (!hasPermission(req.auth.role, permission)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
    }

    next();
  };
}

/**
 * Require one of several permissions
 */
export function requireAnyPermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const hasAny = permissions.some(p => hasPermission(req.auth!.role, p));
    if (!hasAny) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
    }

    next();
  };
}

/**
 * Require specific roles
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient role',
        },
      });
    }

    next();
  };
}

/**
 * Check resource ownership for technician-scoped access
 * Use after loading the resource
 */
export function checkResourceAccess(
  resourceGetter: (req: Request) => { assignedTo?: string } | null
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Owners and admins bypass resource checks
    if (req.auth.role === 'owner' || req.auth.role === 'admin') {
      return next();
    }

    const resource = resourceGetter(req);
    if (!resource) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
      });
    }

    // Technicians can only access assigned resources
    if (req.auth.role === 'technician') {
      if (resource.assignedTo !== req.auth.userId) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot access resources assigned to other users',
          },
        });
      }
    }

    next();
  };
}
