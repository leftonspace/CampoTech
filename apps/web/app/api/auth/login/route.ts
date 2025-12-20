import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createToken } from '@/lib/auth';
import {
  checkLoginAllowed,
  recordLoginAttempt,
  createTokenPair,
  REFRESH_TOKEN_EXPIRY_DAYS,
} from '@/lib/auth-security';

/**
 * Login API
 * POST /api/auth/login
 *
 * Security features:
 * - Failed login attempt tracking
 * - Account lockout after N failed attempts
 * - Shorter access tokens (24h) with refresh tokens (7d)
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
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || undefined;

  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, '');

    // Check if login is allowed (not locked out)
    const loginCheck = await checkLoginAllowed(cleanPhone, 'phone');
    if (!loginCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: loginCheck.message || 'Login not allowed',
          locked: loginCheck.locked,
          lockoutEndsAt: loginCheck.lockoutEndsAt?.toISOString(),
        },
        { status: 429 }
      );
    }

    // Find user by phone
    const user = await prisma.user.findFirst({
      where: {
        phone: {
          contains: cleanPhone,
        },
        isActive: true,
      },
      include: {
        organization: true,
      },
    });

    if (!user) {
      // Record failed attempt
      await recordLoginAttempt(cleanPhone, 'phone', false, ipAddress, userAgent);

      // Calculate remaining attempts for user feedback
      const remainingAttempts = loginCheck.remainingAttempts !== undefined
        ? loginCheck.remainingAttempts - 1
        : undefined;

      return NextResponse.json(
        {
          success: false,
          error: 'Usuario no encontrado',
          remainingAttempts,
        },
        { status: 401 }
      );
    }

    // Record successful login attempt
    await recordLoginAttempt(cleanPhone, 'phone', true, ipAddress, userAgent, user.id);

    // Create token pair (access + refresh)
    const tokenPair = await createTokenPair(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
      userAgent,
      ipAddress
    );

    // Set cookies
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          organization: user.organization.name,
        },
        expiresAt: tokenPair.expiresAt.toISOString(),
      },
    });

    // Access token cookie (24h)
    response.cookies.set('auth-token', tokenPair.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    // Refresh token cookie (7 days)
    response.cookies.set('refresh-token', tokenPair.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh', // Only sent to refresh endpoint
      maxAge: 60 * 60 * 24 * REFRESH_TOKEN_EXPIRY_DAYS,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al iniciar sesión' },
      { status: 500 }
    );
  }
}
