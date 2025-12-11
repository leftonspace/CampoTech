import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requestOTP } from '@/lib/otp';

export async function POST(request: NextRequest) {
  try {
    console.log('[OTP Request] Starting...');

    const body = await request.json();
    const { phone } = body;
    console.log('[OTP Request] Phone received:', phone);

    if (!phone) {
      return NextResponse.json(
        { success: false, error: { message: 'Phone number is required' } },
        { status: 400 }
      );
    }

    // Clean phone number for user lookup
    const cleanPhone = phone.replace(/\D/g, '');
    console.log('[OTP Request] Clean phone:', cleanPhone, 'Last 10:', cleanPhone.slice(-10));

    // Check if user exists
    const user = await prisma.user.findFirst({
      where: {
        phone: {
          contains: cleanPhone.slice(-10), // Match last 10 digits
        },
        isActive: true,
      },
    });
    console.log('[OTP Request] User found:', user ? user.id : 'null');

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Usuario no encontrado' } },
        { status: 404 }
      );
    }

    // Request OTP (will send SMS in production, log in dev)
    console.log('[OTP Request] Calling requestOTP...');
    const result = await requestOTP(phone);
    console.log('[OTP Request] OTP result:', JSON.stringify(result));

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: result.error || 'Error al enviar el código',
            rateLimited: result.rateLimited
          }
        },
        { status: result.rateLimited ? 429 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        sent: true,
        devMode: result.devMode // Let frontend know if in dev mode
      },
    });
  } catch (error) {
    console.error('[OTP Request] EXCEPTION:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: { message: 'Error al enviar el código', debug: errorMessage } },
      { status: 500 }
    );
  }
}
