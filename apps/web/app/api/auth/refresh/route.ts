import { NextRequest, NextResponse } from 'next/server';
import {
  refreshTokens,
  REFRESH_TOKEN_EXPIRY_DAYS,
} from '@/lib/auth-security';

/**
 * Refresh Token API
 * POST /api/auth/refresh
 *
 * Exchanges a valid refresh token for a new access token
 * Implements refresh token rotation for security
 *
 * OWASP A07:2021 - Identification and Authentication Failures
 */

// Helper to get client IP
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    // Get refresh token from cookie
    const refreshToken = request.cookies.get('refresh-token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'Refresh token required' },
        { status: 401 }
      );
    }

    // Attempt to refresh tokens
    const tokenPair = await refreshTokens(refreshToken, userAgent, ipAddress);

    if (!tokenPair) {
      // Invalid or expired refresh token - clear cookies
      const response = NextResponse.json(
        { success: false, error: 'Invalid or expired refresh token' },
        { status: 401 }
      );

      response.cookies.delete('auth-token');
      response.cookies.delete('refresh-token');

      return response;
    }

    // Set new cookies
    const response = NextResponse.json({
      success: true,
      data: {
        expiresAt: tokenPair.expiresAt.toISOString(),
      },
    });

    // New access token (24h)
    // SECURITY FIX (MEDIUM-8): sameSite=strict for enhanced CSRF protection
    response.cookies.set('auth-token', tokenPair.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    // New refresh token (7 days) - rotated for security
    // SECURITY FIX (MEDIUM-8): sameSite=strict for enhanced CSRF protection
    response.cookies.set('refresh-token', tokenPair.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 60 * 60 * 24 * REFRESH_TOKEN_EXPIRY_DAYS,
    });

    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { success: false, error: 'Error refreshing token' },
      { status: 500 }
    );
  }
}
