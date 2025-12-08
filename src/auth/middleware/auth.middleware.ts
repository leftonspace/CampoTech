/**
 * Authentication Middleware
 * =========================
 *
 * Express middleware for authentication and authorization.
 */

import { Request, Response, NextFunction } from 'express';
import {
  AuthContext,
  AuthErrorCode,
  UserRole,
  ROLE_PERMISSIONS,
} from '../types/auth.types';
import { getSessionService, SessionService } from '../services/session.service';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }
  return parts[1];
}

/**
 * Authentication middleware - validates JWT and sets auth context
 */
export function authenticate(sessionService?: SessionService) {
  const service = sessionService || getSessionService();

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extractBearerToken(req.headers.authorization);

      if (!token) {
        return res.status(401).json({
          success: false,
          error: {
            code: AuthErrorCode.INVALID_TOKEN,
            message: 'No authentication token provided',
          },
        });
      }

      // Validate token
      const authContext = await service.validateAccessToken(token);
      req.auth = authContext;

      next();
    } catch (error: any) {
      const code = error.code || AuthErrorCode.INVALID_TOKEN;
      const status = code === AuthErrorCode.TOKEN_EXPIRED ? 401 : 401;

      return res.status(status).json({
        success: false,
        error: {
          code,
          message: error.message || 'Authentication failed',
        },
      });
    }
  };
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuth(sessionService?: SessionService) {
  const service = sessionService || getSessionService();

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extractBearerToken(req.headers.authorization);

      if (token) {
        const authContext = await service.validateAccessToken(token);
        req.auth = authContext;
      }

      next();
    } catch (error) {
      // Continue without auth context
      next();
    }
  };
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({
        success: false,
        error: {
          code: AuthErrorCode.INVALID_TOKEN,
          message: 'Authentication required',
        },
      });
    }

    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: AuthErrorCode.INSUFFICIENT_PERMISSIONS,
          message: `Required role: ${roles.join(' or ')}`,
        },
      });
    }

    next();
  };
}

/**
 * Permission-based authorization middleware
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({
        success: false,
        error: {
          code: AuthErrorCode.INVALID_TOKEN,
          message: 'Authentication required',
        },
      });
    }

    if (!hasPermission(req.auth.role, permission)) {
      return res.status(403).json({
        success: false,
        error: {
          code: AuthErrorCode.INSUFFICIENT_PERMISSIONS,
          message: `Permission denied: ${permission}`,
        },
      });
    }

    next();
  };
}

/**
 * Check if role has permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];

  // Check for wildcard
  if (permissions.includes('*')) return true;

  // Check for exact match
  if (permissions.includes(permission)) return true;

  // Check for category wildcard (e.g., "jobs:*" matches "jobs:read")
  const [category] = permission.split(':');
  if (permissions.includes(`${category}:*`)) return true;

  return false;
}

/**
 * Resource ownership check middleware factory
 */
export function requireOwnership(
  getResourceOrgId: (req: Request) => Promise<string | null>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({
        success: false,
        error: {
          code: AuthErrorCode.INVALID_TOKEN,
          message: 'Authentication required',
        },
      });
    }

    const resourceOrgId = await getResourceOrgId(req);

    if (resourceOrgId && resourceOrgId !== req.auth.orgId) {
      return res.status(403).json({
        success: false,
        error: {
          code: AuthErrorCode.INSUFFICIENT_PERMISSIONS,
          message: 'Access denied to this resource',
        },
      });
    }

    next();
  };
}
