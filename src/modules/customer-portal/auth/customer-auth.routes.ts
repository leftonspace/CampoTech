/**
 * Customer Authentication Routes
 * ================================
 *
 * Express routes for customer portal authentication.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import {
  CustomerDeviceInfo,
  MagicLinkMetadata,
} from './customer-auth.types';
import { getCustomerAuthService } from './customer-auth.service';
import {
  requireCustomerAuth,
  optionalCustomerAuth,
  authRateLimit,
  customerAuthErrorHandler,
  auditCustomerAction,
} from './customer-auth.middleware';

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RequestMagicLinkBody {
  email: string;
  orgId: string;
  metadata?: MagicLinkMetadata;
}

interface VerifyMagicLinkBody {
  token: string;
  deviceInfo?: CustomerDeviceInfo;
}

interface RequestOTPBody {
  phone: string;
  orgId: string;
}

interface VerifyOTPBody {
  phone: string;
  code: string;
  orgId: string;
  deviceInfo?: CustomerDeviceInfo;
}

interface RefreshTokenBody {
  refreshToken: string;
}

interface LogoutBody {
  refreshToken: string;
}

interface LinkPhoneBody {
  phone: string;
}

interface VerifyPhoneLinkBody {
  phone: string;
  code: string;
}

interface LinkEmailBody {
  email: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createCustomerAuthRoutes(pool: Pool): Router {
  const router = Router();

  // ═══════════════════════════════════════════════════════════════════════════
  // MAGIC LINK AUTH
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/magic-link/request
   * Request a magic link to be sent to email
   */
  router.post(
    '/magic-link/request',
    authRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 10 }), // 10 per hour
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, orgId, metadata } = req.body as RequestMagicLinkBody;

        if (!email || !orgId) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Email and organization ID are required',
            },
          });
        }

        const authService = getCustomerAuthService();
        const result = await authService.requestMagicLink(orgId, email, metadata);

        res.json({
          success: true,
          data: {
            email: result.email,
            expiresAt: result.expiresAt.toISOString(),
            message: 'Magic link sent. Please check your email.',
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/magic-link/verify
   * Verify magic link and authenticate
   */
  router.post(
    '/magic-link/verify',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token, deviceInfo } = req.body as VerifyMagicLinkBody;

        if (!token) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Token is required',
            },
          });
        }

        const authService = getCustomerAuthService();
        const result = await authService.authenticateWithMagicLink(
          token,
          deviceInfo,
          req.ip,
          req.headers['user-agent']
        );

        res.json({
          success: true,
          data: {
            customer: {
              id: result.customer.id,
              fullName: result.customer.fullName,
              email: result.customer.email,
              phone: result.customer.phone,
            },
            tokens: {
              accessToken: result.tokens.accessToken,
              refreshToken: result.tokens.refreshToken,
              expiresIn: result.tokens.expiresIn,
              tokenType: result.tokens.tokenType,
            },
            isNewCustomer: result.isNewCustomer,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // OTP AUTH
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/otp/request
   * Request an OTP to be sent to phone
   */
  router.post(
    '/otp/request',
    authRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 }), // 5 per 15 minutes
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { phone, orgId } = req.body as RequestOTPBody;

        if (!phone || !orgId) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Phone and organization ID are required',
            },
          });
        }

        const authService = getCustomerAuthService();
        const result = await authService.requestOTP(orgId, phone);

        res.json({
          success: true,
          data: {
            phone: result.phone.slice(-4).padStart(result.phone.length, '*'),
            expiresAt: result.expiresAt.toISOString(),
            message: 'OTP sent. Please check your phone.',
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/otp/verify
   * Verify OTP and authenticate
   */
  router.post(
    '/otp/verify',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { phone, code, orgId, deviceInfo } = req.body as VerifyOTPBody;

        if (!phone || !code || !orgId) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Phone, code, and organization ID are required',
            },
          });
        }

        const authService = getCustomerAuthService();
        const result = await authService.authenticateWithOTP(
          orgId,
          phone,
          code,
          deviceInfo,
          req.ip,
          req.headers['user-agent']
        );

        res.json({
          success: true,
          data: {
            customer: {
              id: result.customer.id,
              fullName: result.customer.fullName,
              email: result.customer.email,
              phone: result.customer.phone,
            },
            tokens: {
              accessToken: result.tokens.accessToken,
              refreshToken: result.tokens.refreshToken,
              expiresIn: result.tokens.expiresIn,
              tokenType: result.tokens.tokenType,
            },
            isNewCustomer: result.isNewCustomer,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/refresh
   * Refresh access token
   */
  router.post(
    '/refresh',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { refreshToken } = req.body as RefreshTokenBody;

        if (!refreshToken) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Refresh token is required',
            },
          });
        }

        const authService = getCustomerAuthService();
        const tokens = await authService.refreshTokens(refreshToken);

        res.json({
          success: true,
          data: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            tokenType: tokens.tokenType,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/logout
   * Logout from current session
   */
  router.post(
    '/logout',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { refreshToken } = req.body as LogoutBody;

        if (!refreshToken) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Refresh token is required',
            },
          });
        }

        const authService = getCustomerAuthService();
        await authService.logout(refreshToken);

        res.json({
          success: true,
          message: 'Logged out successfully',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/logout-all
   * Logout from all devices
   */
  router.post(
    '/logout-all',
    requireCustomerAuth(),
    auditCustomerAction('logout_all_devices'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authService = getCustomerAuthService();
        await authService.logoutAllDevices(req.customerAuth!.customerId);

        res.json({
          success: true,
          message: 'Logged out from all devices',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /auth/sessions
   * Get active sessions
   */
  router.get(
    '/sessions',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authService = getCustomerAuthService();
        const sessions = await authService.getActiveSessions(req.customerAuth!.customerId);

        res.json({
          success: true,
          data: sessions.map(session => ({
            id: session.id,
            deviceInfo: session.deviceInfo,
            lastUsedAt: session.lastUsedAt,
            createdAt: session.createdAt,
            isCurrent: session.id === req.customerAuth!.sessionId,
          })),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /auth/sessions/:sessionId
   * Revoke specific session
   */
  router.delete(
    '/sessions/:sessionId',
    requireCustomerAuth(),
    auditCustomerAction('revoke_session'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authService = getCustomerAuthService();
        await authService.revokeSession(req.params.sessionId, 'customer_revoked');

        res.json({
          success: true,
          message: 'Session revoked',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNT LINKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/link-phone
   * Start phone linking process
   */
  router.post(
    '/link-phone',
    requireCustomerAuth(),
    authRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 3 }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { phone } = req.body as LinkPhoneBody;

        if (!phone) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Phone is required',
            },
          });
        }

        const authService = getCustomerAuthService();
        const result = await authService.linkPhone(
          req.customerAuth!.customerId,
          req.customerAuth!.orgId,
          phone
        );

        res.json({
          success: true,
          data: {
            phone: result.phone.slice(-4).padStart(result.phone.length, '*'),
            expiresAt: result.expiresAt.toISOString(),
            message: 'OTP sent. Please verify to link your phone.',
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/link-phone/verify
   * Verify phone link OTP
   */
  router.post(
    '/link-phone/verify',
    requireCustomerAuth(),
    auditCustomerAction('link_phone'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { phone, code } = req.body as VerifyPhoneLinkBody;

        if (!phone || !code) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Phone and code are required',
            },
          });
        }

        const authService = getCustomerAuthService();
        await authService.verifyPhoneLink(
          req.customerAuth!.customerId,
          req.customerAuth!.orgId,
          phone,
          code
        );

        res.json({
          success: true,
          message: 'Phone linked successfully',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/link-email
   * Start email linking process
   */
  router.post(
    '/link-email',
    requireCustomerAuth(),
    authRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 3 }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email } = req.body as LinkEmailBody;

        if (!email) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Email is required',
            },
          });
        }

        const authService = getCustomerAuthService();
        const result = await authService.linkEmail(
          req.customerAuth!.customerId,
          req.customerAuth!.orgId,
          email
        );

        res.json({
          success: true,
          data: {
            email: result.email,
            expiresAt: result.expiresAt.toISOString(),
            message: 'Magic link sent. Please check your email to complete linking.',
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/link-email/verify
   * Verify email link
   */
  router.post(
    '/link-email/verify',
    auditCustomerAction('link_email'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token } = req.body as { token: string };

        if (!token) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Token is required',
            },
          });
        }

        const authService = getCustomerAuthService();
        await authService.verifyEmailLink(token);

        res.json({
          success: true,
          message: 'Email linked successfully',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // CURRENT USER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /auth/me
   * Get current authenticated customer info
   */
  router.get(
    '/me',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.json({
          success: true,
          data: {
            customerId: req.customerAuth!.customerId,
            orgId: req.customerAuth!.orgId,
            sessionId: req.customerAuth!.sessionId,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  router.use(customerAuthErrorHandler);

  return router;
}
