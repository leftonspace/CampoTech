/**
 * Consumer Authentication Middleware
 * ===================================
 *
 * Express middleware for consumer authentication.
 * Phase 15: Consumer Marketplace
 */

import { Request, Response, NextFunction } from 'express';
import { ConsumerAuthContext, ConsumerAuthErrorCode } from '../consumer.types';
import { getConsumerAuthService, ConsumerAuthError } from './consumer-auth.service';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      consumer?: ConsumerAuthContext;
    }
  }
}

/**
 * Authenticate consumer requests
 * Validates the Bearer token in Authorization header
 */
export function authenticateConsumer() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: {
            code: ConsumerAuthErrorCode.TOKEN_INVALID,
            message: 'Missing or invalid authorization header',
          },
        });
      }

      const token = authHeader.substring(7);
      const authService = getConsumerAuthService();

      const context = await authService.validateToken(token);
      req.consumer = context;

      next();
    } catch (error) {
      if (error instanceof ConsumerAuthError) {
        return res.status(error.httpStatus).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      console.error('[ConsumerAuth] Unexpected error:', error);
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authentication failed',
        },
      });
    }
  };
}

/**
 * Optional authentication - doesn't fail if no token provided
 * Useful for endpoints that work with or without authentication
 */
export function optionalConsumerAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token, continue without authentication
        return next();
      }

      const token = authHeader.substring(7);
      const authService = getConsumerAuthService();

      const context = await authService.validateToken(token);
      req.consumer = context;

      next();
    } catch (error) {
      // Token invalid, continue without authentication
      // This is intentional for optional auth
      next();
    }
  };
}

/**
 * Rate limiting middleware for OTP requests
 * Prevents brute force and abuse
 */
export function rateLimitOTP(maxRequestsPerMinute = 3) {
  const requests = new Map<string, { count: number; resetAt: number }>();

  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of requests.entries()) {
      if (value.resetAt < now) {
        requests.delete(key);
      }
    }
  }, 60000); // Every minute

  return (req: Request, res: Response, next: NextFunction) => {
    const phone = req.body.phone;
    if (!phone) {
      return next();
    }

    const key = `otp:${phone}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute

    const current = requests.get(key);

    if (!current || current.resetAt < now) {
      requests.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxRequestsPerMinute) {
      return res.status(429).json({
        error: {
          code: ConsumerAuthErrorCode.RATE_LIMITED,
          message: 'Too many OTP requests. Please try again later.',
        },
      });
    }

    current.count++;
    next();
  };
}

/**
 * Ensure consumer is not suspended
 */
export function requireActiveConsumer() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.consumer) {
      return res.status(401).json({
        error: {
          code: ConsumerAuthErrorCode.TOKEN_INVALID,
          message: 'Authentication required',
        },
      });
    }

    try {
      const authService = getConsumerAuthService();
      const consumer = await authService.getConsumerById(req.consumer.consumerId);

      if (!consumer) {
        return res.status(404).json({
          error: {
            code: ConsumerAuthErrorCode.CONSUMER_NOT_FOUND,
            message: 'Consumer not found',
          },
        });
      }

      if (consumer.isSuspended) {
        return res.status(403).json({
          error: {
            code: ConsumerAuthErrorCode.CONSUMER_SUSPENDED,
            message: consumer.suspensionReason || 'Your account has been suspended',
          },
        });
      }

      next();
    } catch (error) {
      console.error('[ConsumerAuth] Error checking consumer status:', error);
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to verify account status',
        },
      });
    }
  };
}
