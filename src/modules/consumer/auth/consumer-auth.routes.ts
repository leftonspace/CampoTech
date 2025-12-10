/**
 * Consumer Authentication Routes
 * ===============================
 *
 * API routes for consumer authentication.
 * Phase 15: Consumer Marketplace
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { getConsumerAuthService, ConsumerAuthError } from './consumer-auth.service';
import {
  authenticateConsumer,
  rateLimitOTP,
  requireActiveConsumer,
} from './consumer-auth.middleware';

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createConsumerAuthRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * POST /auth/otp/request
   * Request OTP for phone number
   */
  router.post(
    '/otp/request',
    rateLimitOTP(3),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { phone } = req.body;

        if (!phone) {
          return res.status(400).json({
            error: {
              code: 'PHONE_REQUIRED',
              message: 'Phone number is required',
            },
          });
        }

        const authService = getConsumerAuthService();
        const result = await authService.requestOTP(phone);

        res.json({
          success: true,
          data: {
            expiresAt: result.expiresAt,
            message: 'OTP sent successfully',
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
        const { phone, code, deviceInfo } = req.body;

        if (!phone || !code) {
          return res.status(400).json({
            error: {
              code: 'MISSING_PARAMS',
              message: 'Phone number and OTP code are required',
            },
          });
        }

        const ipAddress = req.ip || req.connection.remoteAddress;
        const authService = getConsumerAuthService();

        const result = await authService.verifyOTP(phone, code, deviceInfo, ipAddress);

        // Set refresh token in HTTP-only cookie
        res.cookie('consumer_refresh_token', result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          path: '/api/consumer/auth',
        });

        res.json({
          success: true,
          data: {
            accessToken: result.accessToken,
            expiresIn: result.expiresIn,
            consumer: {
              id: result.consumer.id,
              phone: result.consumer.phone,
              firstName: result.consumer.firstName,
              lastName: result.consumer.lastName,
              profilePhotoUrl: result.consumer.profilePhotoUrl,
              phoneVerified: result.consumer.phoneVerified,
              isNewConsumer: result.isNewConsumer,
            },
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/refresh
   * Refresh access token
   */
  router.post(
    '/refresh',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Get refresh token from cookie or body
        const refreshToken =
          req.cookies?.consumer_refresh_token || req.body.refreshToken;

        if (!refreshToken) {
          return res.status(400).json({
            error: {
              code: 'TOKEN_REQUIRED',
              message: 'Refresh token is required',
            },
          });
        }

        const authService = getConsumerAuthService();
        const result = await authService.refreshTokens(refreshToken);

        // Update refresh token cookie
        res.cookie('consumer_refresh_token', result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000,
          path: '/api/consumer/auth',
        });

        res.json({
          success: true,
          data: {
            accessToken: result.accessToken,
            expiresIn: result.expiresIn,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/logout
   * Logout and invalidate session
   */
  router.post(
    '/logout',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const refreshToken =
          req.cookies?.consumer_refresh_token || req.body.refreshToken;

        if (refreshToken) {
          const authService = getConsumerAuthService();
          await authService.logout(refreshToken);
        }

        // Clear cookie
        res.clearCookie('consumer_refresh_token', {
          path: '/api/consumer/auth',
        });

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
    authenticateConsumer(),
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authService = getConsumerAuthService();
        await authService.logoutAll(req.consumer!.consumerId);

        // Clear cookie
        res.clearCookie('consumer_refresh_token', {
          path: '/api/consumer/auth',
        });

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
    authenticateConsumer(),
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authService = getConsumerAuthService();
        const sessions = await authService.getActiveSessions(req.consumer!.consumerId);

        res.json({
          success: true,
          data: sessions.map(session => ({
            id: session.id,
            deviceType: session.deviceType,
            deviceName: session.deviceName,
            lastUsedAt: session.lastUsedAt,
            createdAt: session.createdAt,
            isCurrent: false, // Could be determined by comparing tokens
          })),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /auth/sessions/:id
   * Revoke specific session
   */
  router.delete(
    '/sessions/:id',
    authenticateConsumer(),
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authService = getConsumerAuthService();
        await authService.revokeSession(req.params.id);

        res.json({
          success: true,
          message: 'Session revoked',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /auth/me
   * Get current consumer info
   */
  router.get(
    '/me',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authService = getConsumerAuthService();
        const consumer = await authService.getConsumerById(req.consumer!.consumerId);

        if (!consumer) {
          return res.status(404).json({
            error: {
              code: 'CONSUMER_NOT_FOUND',
              message: 'Consumer not found',
            },
          });
        }

        res.json({
          success: true,
          data: {
            id: consumer.id,
            phone: consumer.phone,
            phoneVerified: consumer.phoneVerified,
            email: consumer.email,
            emailVerified: consumer.emailVerified,
            firstName: consumer.firstName,
            lastName: consumer.lastName,
            profilePhotoUrl: consumer.profilePhotoUrl,
            defaultAddress: consumer.defaultAddress,
            city: consumer.city,
            neighborhood: consumer.neighborhood,
            preferredContact: consumer.preferredContact,
            totalRequests: consumer.totalRequests,
            totalJobsCompleted: consumer.totalJobsCompleted,
            referralCode: consumer.referralCode,
            createdAt: consumer.createdAt,
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

  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof ConsumerAuthError) {
      return res.status(error.httpStatus).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    console.error('[ConsumerAuth] Unhandled error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  return router;
}
