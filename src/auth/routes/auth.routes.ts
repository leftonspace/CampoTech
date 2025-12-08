/**
 * Authentication Routes
 * =====================
 *
 * REST API endpoints for authentication flow.
 */

import { Router, Request, Response } from 'express';
import { getOTPService, OTPService } from '../services/otp.service';
import { getSessionService, SessionService } from '../services/session.service';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import { AuthErrorCode, DeviceInfo } from '../types/auth.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SendOTPRequest {
  phone: string;
}

interface VerifyOTPRequest {
  phone: string;
  code: string;
  deviceInfo?: DeviceInfo;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create auth router
 */
export function createAuthRouter(
  otpService?: OTPService,
  sessionService?: SessionService
): Router {
  const router = Router();
  const otp = otpService || getOTPService();
  const session = sessionService || getSessionService();

  /**
   * POST /auth/otp/send
   * Send OTP code to phone number
   */
  router.post('/otp/send', async (req: Request, res: Response) => {
    try {
      const { phone } = req.body as SendOTPRequest;

      if (!phone) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Phone number is required',
          },
        });
      }

      // Validate Argentine phone number format
      const normalizedPhone = normalizePhoneNumber(phone);
      if (!normalizedPhone) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PHONE',
            message: 'Invalid Argentine phone number format',
          },
        });
      }

      const result = await otp.sendOTP(normalizedPhone);

      return res.status(200).json({
        success: true,
        data: {
          message: 'OTP sent successfully',
          expiresAt: result.expiresAt,
        },
      });
    } catch (error: any) {
      if (error.code === AuthErrorCode.RATE_LIMITED) {
        return res.status(429).json({
          success: false,
          error: {
            code: AuthErrorCode.RATE_LIMITED,
            message: error.message,
          },
        });
      }

      console.error('OTP send error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to send OTP',
        },
      });
    }
  });

  /**
   * POST /auth/otp/verify
   * Verify OTP and create session
   */
  router.post('/otp/verify', async (req: Request, res: Response) => {
    try {
      const { phone, code, deviceInfo } = req.body as VerifyOTPRequest;

      if (!phone || !code) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Phone and code are required',
          },
        });
      }

      const normalizedPhone = normalizePhoneNumber(phone);
      if (!normalizedPhone) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PHONE',
            message: 'Invalid phone number format',
          },
        });
      }

      // Verify OTP
      const isValid = await otp.verifyOTP(normalizedPhone, code);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: {
            code: AuthErrorCode.INVALID_OTP,
            message: 'Invalid or expired OTP code',
          },
        });
      }

      // Look up user by phone number
      const user = await findUserByPhone(normalizedPhone);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: AuthErrorCode.USER_NOT_FOUND,
            message: 'No account found for this phone number',
          },
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          error: {
            code: AuthErrorCode.USER_DISABLED,
            message: 'This account has been disabled',
          },
        });
      }

      // Create session
      const clientIp = req.ip || req.socket.remoteAddress;
      const authResult = await session.createSession(
        user.id,
        deviceInfo,
        clientIp
      );

      return res.status(200).json({
        success: true,
        data: authResult,
      });
    } catch (error: any) {
      console.error('OTP verification error:', error);

      if (error.code === AuthErrorCode.RATE_LIMITED) {
        return res.status(429).json({
          success: false,
          error: {
            code: AuthErrorCode.RATE_LIMITED,
            message: error.message,
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authentication failed',
        },
      });
    }
  });

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body as RefreshTokenRequest;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Refresh token is required',
          },
        });
      }

      const tokens = await session.refreshTokens(refreshToken);

      return res.status(200).json({
        success: true,
        data: tokens,
      });
    } catch (error: any) {
      const code = error.code || AuthErrorCode.INVALID_TOKEN;

      return res.status(401).json({
        success: false,
        error: {
          code,
          message: error.message || 'Invalid refresh token',
        },
      });
    }
  });

  /**
   * POST /auth/logout
   * Invalidate current session
   */
  router.post('/logout', authenticate(), async (req: Request, res: Response) => {
    try {
      const refreshToken = req.body.refreshToken;

      if (refreshToken) {
        await session.logout(refreshToken);
      }

      return res.status(200).json({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      });
    } catch (error) {
      // Even if logout fails, return success
      return res.status(200).json({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      });
    }
  });

  /**
   * POST /auth/logout/all
   * Invalidate all sessions for current user
   */
  router.post('/logout/all', authenticate(), async (req: Request, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: {
            code: AuthErrorCode.INVALID_TOKEN,
            message: 'Authentication required',
          },
        });
      }

      await session.logoutAllSessions(req.auth.userId);

      return res.status(200).json({
        success: true,
        data: {
          message: 'All sessions invalidated',
        },
      });
    } catch (error) {
      console.error('Logout all error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to logout all sessions',
        },
      });
    }
  });

  /**
   * GET /auth/me
   * Get current authenticated user info
   */
  router.get('/me', authenticate(), async (req: Request, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: {
            code: AuthErrorCode.INVALID_TOKEN,
            message: 'Authentication required',
          },
        });
      }

      // In production, fetch full user profile from database
      const userProfile = await getUserProfile(req.auth.userId);

      return res.status(200).json({
        success: true,
        data: {
          user: userProfile,
          context: {
            orgId: req.auth.orgId,
            role: req.auth.role,
            permissions: req.auth.permissions,
          },
        },
      });
    } catch (error) {
      console.error('Get profile error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user profile',
        },
      });
    }
  });

  /**
   * GET /auth/sessions
   * List all active sessions for current user
   */
  router.get('/sessions', authenticate(), async (req: Request, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: {
            code: AuthErrorCode.INVALID_TOKEN,
            message: 'Authentication required',
          },
        });
      }

      const sessions = await session.getActiveSessions(req.auth.userId);

      return res.status(200).json({
        success: true,
        data: {
          sessions,
        },
      });
    } catch (error) {
      console.error('Get sessions error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get sessions',
        },
      });
    }
  });

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize Argentine phone number to E.164 format
 * Accepts: +54..., 54..., 11..., etc.
 */
function normalizePhoneNumber(phone: string): string | null {
  // Remove all non-digits except leading +
  const hasPlus = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');

  // Argentine numbers: country code 54, then area code and number
  // Mobile numbers have 9 after area code (e.g., 54 9 11 1234-5678)

  if (digits.length < 10 || digits.length > 14) {
    return null;
  }

  // If starts with 54, assume it's complete
  if (digits.startsWith('54')) {
    return '+' + digits;
  }

  // If starts with 9 or local area code (11, 351, etc.), add 54
  if (digits.length >= 10) {
    return '+54' + digits;
  }

  return null;
}

/**
 * Find user by phone number
 * In production, this queries the database
 */
async function findUserByPhone(phone: string): Promise<{
  id: string;
  orgId: string;
  role: string;
  isActive: boolean;
} | null> {
  // TODO: Implement actual database lookup
  // This is a placeholder for the implementation

  // Example query:
  // SELECT id, org_id, role, is_active FROM users WHERE phone = $1

  return null;
}

/**
 * Get user profile
 * In production, this queries the database
 */
async function getUserProfile(userId: string): Promise<{
  id: string;
  phone: string;
  name: string;
  email?: string;
  role: string;
  createdAt: Date;
} | null> {
  // TODO: Implement actual database lookup
  // This is a placeholder for the implementation

  return null;
}

// Default export for convenience
export default createAuthRouter;
