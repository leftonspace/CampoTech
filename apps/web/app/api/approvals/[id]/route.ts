/**
 * Approval Detail API
 * ====================
 *
 * GET /api/approvals/[id] - Get approval details
 * POST /api/approvals/[id] - Process approval (approve or reject)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { approvalWorkflow } from '@/lib/services/approval-workflow';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/approvals/[id]
 * Get approval details
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { organizationId, role } = session;

    // Only OWNER can view approval details
    if (role !== 'OWNER') {
      return NextResponse.json(
        { error: 'forbidden', message: 'Solo el propietario puede ver detalles de aprobaciones.' },
        { status: 403 }
      );
    }

    const approval = await approvalWorkflow.getApproval(id, organizationId);

    if (!approval) {
      return NextResponse.json(
        { error: 'not_found', message: 'Aprobación no encontrada.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ approval });
  } catch (error) {
    console.error('Get approval error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Error al obtener la aprobación' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/approvals/[id]
 * Process approval (approve or reject)
 *
 * Body: { action: 'approve' | 'reject', rejectionReason?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { organizationId, userId, role } = session;

    // Only OWNER can approve/reject
    if (role !== 'OWNER') {
      return NextResponse.json(
        { error: 'forbidden', message: 'Solo el propietario puede aprobar/rechazar solicitudes.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, rejectionReason } = body;

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'invalid_action', message: 'Acción inválida. Use "approve" o "reject".' },
        { status: 400 }
      );
    }

    if (action === 'reject' && !rejectionReason) {
      return NextResponse.json(
        { error: 'reason_required', message: 'Debe proporcionar un motivo de rechazo.' },
        { status: 400 }
      );
    }

    let result;
    if (action === 'approve') {
      result = await approvalWorkflow.approve(id, organizationId, userId);
    } else {
      result = await approvalWorkflow.reject(id, organizationId, userId, rejectionReason);
    }

    if (!result.success) {
      return NextResponse.json(
        { error: 'processing_failed', message: result.error },
        { status: 400 }
      );
    }

    const message = action === 'approve'
      ? 'Solicitud aprobada exitosamente.'
      : 'Solicitud rechazada.';

    return NextResponse.json({
      success: true,
      message,
      action,
    });
  } catch (error) {
    console.error('Process approval error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Error al procesar la aprobación' },
      { status: 500 }
    );
  }
}
