import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  verifyCode,
  resendVerificationCode,
  checkVerificationStatus,
} from '@/../../src/modules/users/onboarding/employee-verification.service';

/**
 * POST /api/users/verify
 * Verify employee code
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

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json(
        { success: false, error: 'Código de verificación inválido' },
        { status: 400 }
      );
    }

    const result = await verifyCode(session.userId, code);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          attemptsRemaining: result.attemptsRemaining,
          cooldownUntil: result.cooldownUntil,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verificación exitosa',
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Error verificando código' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users/verify
 * Check verification status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const status = await checkVerificationStatus(session.userId);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Verification status error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo estado de verificación' },
      { status: 500 }
    );
  }
}
