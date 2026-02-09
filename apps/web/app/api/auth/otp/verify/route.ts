import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createToken } from '@/lib/auth';
import { verifyOTP } from '@/lib/otp';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code } = body;

    if (!phone || !code) {
      return NextResponse.json(
        { success: false, error: { message: 'Phone and code are required' } },
        { status: 400 }
      );
    }

    // Verify OTP (handles dev bypass with code "123456" automatically)
    const otpResult = await verifyOTP(phone, code);

    if (!otpResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: otpResult.error || 'Código incorrecto',
            expired: otpResult.expired,
            attemptsRemaining: otpResult.attemptsRemaining
          }
        },
        { status: 401 }
      );
    }

    // Clean phone number for user lookup
    const cleanPhone = phone.replace(/\D/g, '');

    // Find user by phone (first check if exists at all)
    const user = await prisma.user.findFirst({
      where: {
        phone: {
          contains: cleanPhone.slice(-10), // Match last 10 digits
        },
      },
      include: {
        organization: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Usuario no encontrado' } },
        { status: 401 }
      );
    }

    // KILL SWITCH: Check if account is deactivated
    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Cuenta desactivada. Contacte al administrador.',
            code: 'ACCOUNT_DEACTIVATED'
          }
        },
        { status: 403 }
      );
    }

    // Create JWT tokens
    const accessToken = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      subscriptionTier: user.organization.subscriptionTier,
      subscriptionStatus: user.organization.subscriptionStatus,
    });

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          organizationId: user.organizationId,
          organization: {
            id: user.organization.id,
            name: user.organization.name,
          },
        },
      },
    });

    // SECURITY FIX (CRIT-2): Set secure HTTP-only cookies
    // - httpOnly: true prevents XSS token theft
    // - sameSite: strict prevents CSRF
    // - 24h expiration aligned with login endpoint
    response.cookies.set('auth-token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours (aligned with login)
      path: '/',
    });

    // Note: Refresh tokens will be properly implemented once database
    // tables are created (CRIT-1 remediation). For now, users should
    // re-authenticate via OTP after 24h.

    return response;
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Error al verificar el código' } },
      { status: 500 }
    );
  }
}
