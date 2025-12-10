/**
 * Customer Authentication Middleware
 * ===================================
 *
 * Express middleware for customer portal authentication.
 */

import { Request, Response, NextFunction } from 'express';
import {
  CustomerAuthContext,
  CustomerAuthErrorCode,
} from './customer-auth.types';
import { getCustomerAuthService, CustomerAuthError } from './customer-auth.service';
import { CustomerSessionError } from './customer-session.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE EXTENSIONS
// ═══════════════════════════════════════════════════════════════════════════════

declare global {
  namespace Express {
    interface Request {
      customerAuth?: CustomerAuthContext;
      isImpersonation?: boolean;
      impersonationSessionId?: string;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Middleware: Require customer authentication
 * Sets req.customerAuth if valid token provided
 */
export function requireCustomerAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extractBearerToken(req);

      if (!token) {
        return res.status(401).json({
          error: {
            code: CustomerAuthErrorCode.TOKEN_INVALID,
            message: 'Authentication required',
          },
        });
      }

      const authService = getCustomerAuthService();
      const authContext = await authService.validateToken(token);

      req.customerAuth = authContext;
      next();
    } catch (error) {
      if (error instanceof CustomerSessionError || error instanceof CustomerAuthError) {
        return res.status(error.httpStatus || 401).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      next(error);
    }
  };
}

/**
 * Middleware: Optional customer authentication
 * Sets req.customerAuth if valid token provided, but doesn't require it
 */
export function optionalCustomerAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extractBearerToken(req);

      if (!token) {
        return next();
      }

      const authService = getCustomerAuthService();
      const authContext = await authService.validateToken(token);

      req.customerAuth = authContext;
      next();
    } catch (error) {
      // Token invalid but auth is optional, continue without auth
      console.warn('[CustomerAuthMiddleware] Invalid token in optional auth:', error);
      next();
    }
  };
}

/**
 * Middleware: Verify customer belongs to specified organization
 * Must be used after requireCustomerAuth
 */
export function requireCustomerOrg(getOrgId: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.customerAuth) {
      return res.status(401).json({
        error: {
          code: CustomerAuthErrorCode.TOKEN_INVALID,
          message: 'Authentication required',
        },
      });
    }

    const requiredOrgId = getOrgId(req);
    if (!requiredOrgId) {
      return res.status(400).json({
        error: {
          code: 'MISSING_ORG_ID',
          message: 'Organization ID is required',
        },
      });
    }

    if (req.customerAuth.orgId !== requiredOrgId) {
      return res.status(403).json({
        error: {
          code: CustomerAuthErrorCode.CUSTOMER_ORG_MISMATCH,
          message: 'You do not have access to this organization',
        },
      });
    }

    next();
  };
}

/**
 * Middleware: Rate limiting for auth endpoints
 */
export function authRateLimit(options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}) {
  const requestCounts = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : req.ip || 'unknown';

    const now = Date.now();
    const entry = requestCounts.get(key);

    if (entry) {
      if (now < entry.resetAt) {
        if (entry.count >= options.maxRequests) {
          return res.status(429).json({
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests. Please try again later.',
              retryAfter: Math.ceil((entry.resetAt - now) / 1000),
            },
          });
        }
        entry.count++;
      } else {
        // Reset window
        requestCounts.set(key, { count: 1, resetAt: now + options.windowMs });
      }
    } else {
      requestCounts.set(key, { count: 1, resetAt: now + options.windowMs });
    }

    next();
  };
}

/**
 * Middleware: Log customer actions for audit
 */
export function auditCustomerAction(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function (body) {
      if (req.customerAuth) {
        console.log(
          `[CustomerAudit] ${action} | Customer: ${req.customerAuth.customerId.slice(0, 8)}... | ` +
          `Org: ${req.customerAuth.orgId.slice(0, 8)}... | Status: ${res.statusCode}`
        );
      }
      return originalSend.call(this, body);
    };

    next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error handler for customer auth errors
 */
export function customerAuthErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (error instanceof CustomerSessionError || error instanceof CustomerAuthError) {
    return res.status(error.httpStatus || 400).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  // Pass to next error handler
  next(error);
}
