import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { resendVerificationCode } from '@/../../src/modules/users/onboarding/employee-verification.service';

/**
 * POST /api/users/verify/resend
 * Resend verification code to user
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const result = await resendVerificationCode(session.userId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Código reenviado exitosamente',
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Error reenviando código de verificación' },
      { status: 500 }
    );
  }
}
