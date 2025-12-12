/**
 * Account Deletion Request API
 * =============================
 *
 * POST /api/users/me/delete-request - Request account deletion
 * GET /api/users/me/delete-request - Get deletion request status
 * DELETE /api/users/me/delete-request - Cancel deletion request
 *
 * Implements Right of Deletion per Ley 25.326
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { accountDeletion } from '@/lib/services/account-deletion';

/**
 * POST /api/users/me/delete-request
 * Request account deletion
 */
export async function POST(): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'No autorizado' },
        { status: 401 }
      );
    }

    const { userId, organizationId } = session;

    // Check for existing request
    const existingRequest = await accountDeletion.getDeletionStatus(userId);
    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return NextResponse.json({
          error: 'pending_confirmation',
          message: 'Ya tienes una solicitud pendiente de confirmación. Revisa tu email.',
          request: {
            id: existingRequest.id,
            status: existingRequest.status,
            requestedAt: existingRequest.requestedAt.toISOString(),
          },
        }, { status: 400 });
      }

      if (existingRequest.status === 'confirmed') {
        return NextResponse.json({
          error: 'already_scheduled',
          message: 'Tu cuenta ya está programada para ser eliminada.',
          request: {
            id: existingRequest.id,
            status: existingRequest.status,
            scheduledDeletionAt: existingRequest.scheduledDeletionAt?.toISOString(),
          },
        }, { status: 400 });
      }
    }

    // Get preview of what will be deleted/retained
    const preview = await accountDeletion.getDeletionPreview(userId, organizationId);

    // Create deletion request
    const result = await accountDeletion.requestDeletion(userId, organizationId);

    if (!result.success) {
      return NextResponse.json(
        { error: 'request_failed', message: result.error },
        { status: 500 }
      );
    }

    // In a real implementation, send confirmation email with token link
    // const confirmationUrl = `${process.env.APP_URL}/account/confirm-deletion?token=${result.confirmationToken}`;
    // await sendEmail(user.email, 'Confirma la eliminación de tu cuenta', ...);

    return NextResponse.json({
      success: true,
      message: 'Solicitud de eliminación creada. Revisa tu email para confirmar.',
      confirmationRequired: true,
      preview,
      // For testing, include token (remove in production)
      ...(process.env.NODE_ENV === 'development' && { _devToken: result.confirmationToken }),
    });
  } catch (error) {
    console.error('Delete request error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users/me/delete-request
 * Get current deletion request status
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'No autorizado' },
        { status: 401 }
      );
    }

    const { userId, organizationId } = session;

    const request = await accountDeletion.getDeletionStatus(userId);

    if (!request) {
      return NextResponse.json({
        hasPendingDeletion: false,
        message: 'No hay solicitud de eliminación activa.',
      });
    }

    // Calculate days remaining if confirmed
    let daysRemaining: number | undefined;
    if (request.status === 'confirmed' && request.scheduledDeletionAt) {
      const now = new Date();
      const scheduled = new Date(request.scheduledDeletionAt);
      daysRemaining = Math.ceil((scheduled.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Get preview
    const preview = await accountDeletion.getDeletionPreview(userId, organizationId);

    return NextResponse.json({
      hasPendingDeletion: true,
      request: {
        id: request.id,
        status: request.status,
        requestedAt: request.requestedAt.toISOString(),
        confirmedAt: request.confirmedAt?.toISOString(),
        scheduledDeletionAt: request.scheduledDeletionAt?.toISOString(),
        daysRemaining,
        canCancel: request.status === 'confirmed' && daysRemaining && daysRemaining > 0,
      },
      preview,
    });
  } catch (error) {
    console.error('Get delete request error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Error al obtener el estado' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/me/delete-request
 * Cancel deletion request
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'No autorizado' },
        { status: 401 }
      );
    }

    const { userId } = session;

    // Get optional reason from body
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason;
    } catch {
      // No body, that's okay
    }

    const result = await accountDeletion.cancelDeletion(userId, reason);

    if (!result.success) {
      return NextResponse.json(
        { error: 'cancel_failed', message: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tu solicitud de eliminación ha sido cancelada.',
    });
  } catch (error) {
    console.error('Cancel delete request error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Error al cancelar la solicitud' },
      { status: 500 }
    );
  }
}
