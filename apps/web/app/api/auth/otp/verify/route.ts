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

    // Find user by phone
    const user = await prisma.user.findFirst({
      where: {
        phone: {
          contains: cleanPhone.slice(-10), // Match last 10 digits
        },
        isActive: true,
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

    // Create JWT tokens
    const accessToken = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    // For simplicity, use same token as refresh token
    const refreshToken = accessToken;

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
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

    // Also set token as HTTP cookie for reliability
    response.cookies.set('auth-token', accessToken, {
      httpOnly: false, // Allow JS access for now
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Error al verificar el código' } },
      { status: 500 }
    );
  }
}
