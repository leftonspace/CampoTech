import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getPendingVerifications,
  manualVerify,
  sendVerificationCode,
} from '@/../../src/modules/users/onboarding/employee-verification.service';

/**
 * GET /api/users/pending-verifications
 * Get list of users pending verification (Admin only)
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

    // Only OWNER, ADMIN can view pending verifications
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Permisos insuficientes' },
        { status: 403 }
      );
    }

    const pendingUsers = await getPendingVerifications(session.organizationId);

    return NextResponse.json({
      success: true,
      data: pendingUsers,
    });
  } catch (error) {
    console.error('Get pending verifications error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo verificaciones pendientes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users/pending-verifications
 * Actions: manual-verify, resend-code
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

    // Only OWNER, ADMIN can perform these actions
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Permisos insuficientes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId requerido' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'manual-verify': {
        const result = await manualVerify(userId, session.userId);
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          message: 'Usuario verificado manualmente',
        });
      }

      case 'resend-code': {
        const result = await sendVerificationCode(userId, session.organizationId);
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          message: 'Código reenviado',
          expiresAt: result.expiresAt,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Acción no válida' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Pending verification action error:', error);
    return NextResponse.json(
      { success: false, error: 'Error procesando acción' },
      { status: 500 }
    );
  }
}
