import { NextRequest, NextResponse } from 'next/server';
import { revokeRefreshToken } from '@/lib/auth-security';

/**
 * Logout API
 * POST /api/auth/logout
 *
 * Clears authentication cookies and revokes refresh token
 *
 * OWASP A07:2021 - Identification and Authentication Failures
 */
export async function POST(request: NextRequest) {
  // Get refresh token to revoke it
  const refreshToken = request.cookies.get('refresh-token')?.value;

  // Revoke refresh token if it exists
  if (refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);
    } catch (error) {
      // Log but don't fail the logout
      console.error('Error revoking refresh token:', error);
    }
  }

  const response = NextResponse.json({ success: true });

  // Clear access token
  // SECURITY FIX (MEDIUM-8): sameSite=strict for consistency
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
  });

  // Clear refresh token
  // SECURITY FIX (MEDIUM-8): sameSite=strict for consistency
  response.cookies.set('refresh-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: 0,
  });

  return response;
}
