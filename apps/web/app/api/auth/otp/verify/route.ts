import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createToken } from '@/lib/auth';

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

    // For demo purposes, accept "123456" as valid code
    if (code !== '123456') {
      return NextResponse.json(
        { success: false, error: { message: 'Código incorrecto' } },
        { status: 401 }
      );
    }

    // Clean phone number
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

    return NextResponse.json({
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
          organization: {
            id: user.organization.id,
            name: user.organization.name,
          },
        },
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Error al verificar el código' } },
      { status: 500 }
    );
  }
}
