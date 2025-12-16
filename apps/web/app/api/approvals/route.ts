/**
 * Approvals API
 * ==============
 *
 * GET /api/approvals - Get pending approvals (OWNER only)
 * POST /api/approvals/[id]/approve - Approve a request (OWNER only)
 * POST /api/approvals/[id]/reject - Reject a request (OWNER only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { approvalWorkflow } from '@/lib/services/approval-workflow';

/**
 * GET /api/approvals
 * Get pending approvals for the organization
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

    // Only OWNER and ADMIN can view approvals
    if (!['OWNER'].includes(session.role)) {
      return NextResponse.json(
        { error: 'forbidden', message: 'No tienes permiso para ver aprobaciones.' },
        { status: 403 }
      );
    }

    const { organizationId } = session;

    const approvals = await approvalWorkflow.getPendingApprovals(organizationId);
    const pendingCount = await approvalWorkflow.getPendingCount(organizationId);

    return NextResponse.json({
      approvals,
      pendingCount,
    });
  } catch (error) {
    console.error('Get approvals error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Error al obtener aprobaciones' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/approvals
 * Create a new approval request (internal use)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entityType, entityId, fieldName, currentValue, requestedValue, reason } = body;

    if (!entityType || !entityId || !fieldName || requestedValue === undefined) {
      return NextResponse.json(
        { error: 'invalid_input', message: 'Datos incompletos' },
        { status: 400 }
      );
    }

    // Check for existing pending approval
    const hasPending = await approvalWorkflow.hasPendingApproval(entityType, entityId, fieldName);
    if (hasPending) {
      return NextResponse.json(
        { error: 'already_pending', message: 'Ya existe una solicitud pendiente para este campo.' },
        { status: 400 }
      );
    }

    const approval = await approvalWorkflow.createApproval({
      orgId: session.organizationId,
      entityType,
      entityId,
      fieldName,
      currentValue,
      requestedValue,
      requestedBy: session.userId,
      reason,
    });

    return NextResponse.json({
      success: true,
      message: 'Solicitud de aprobación creada.',
      approval: {
        id: approval.id,
        status: approval.status,
        requestedAt: approval.requestedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create approval error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Error al crear la solicitud' },
      { status: 500 }
    );
  }
}
