/**
 * Single Change Request API Route
 * GET /api/change-requests/[id] - Get change request details
 * PUT /api/change-requests/[id] - Update change request status (approve/reject)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@/lib/config/field-permissions';
import { validateBody } from '@/lib/validation/api-schemas';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Only OWNER can view change requests
    if (!['OWNER'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver solicitudes de cambio' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const result = await prisma.$queryRaw`
      SELECT
        cr.*,
        u.name as requested_by_name,
        r.name as reviewed_by_name
      FROM change_requests cr
      LEFT JOIN users u ON cr.requested_by = u.id
      LEFT JOIN users r ON cr.reviewed_by = r.id
      WHERE cr.id = ${id}
        AND cr.organization_id = ${session.organizationId}
    ` as Record<string, unknown>[];

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Solicitud de cambio no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error('Get change request error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo solicitud de cambio' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Only OWNER can approve/reject change requests
    if (userRole !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Solo el propietario puede aprobar o rechazar solicitudes de cambio' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Zod validation schema for approve/reject
    const updateSchema = z.object({
      status: z.enum(['approved', 'rejected']),
      rejectionReason: z.string().max(1000).optional(),
    }).refine((data) => {
      // If rejecting, require a reason
      if (data.status === 'rejected' && !data.rejectionReason) {
        return false;
      }
      return true;
    }, { message: 'Debe proporcionar una razon para rechazar la solicitud' });

    const validation = validateBody(body, updateSchema);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { status, rejectionReason } = validation.data;

    // Verify the request exists and belongs to this organization
    const existing = await prisma.$queryRaw`
      SELECT * FROM change_requests
      WHERE id = ${id}
        AND organization_id = ${session.organizationId}
    ` as Record<string, unknown>[];

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Solicitud de cambio no encontrada' },
        { status: 404 }
      );
    }

    const changeRequest = existing[0] as {
      status: string;
      entity_type: string;
      entity_id: string;
      field_name: string;
      requested_value: string;
    };

    if (changeRequest.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Esta solicitud ya ha sido procesada' },
        { status: 400 }
      );
    }

    // Update the change request
    const result = await prisma.$queryRaw`
      UPDATE change_requests
      SET
        status = ${status},
        reviewed_by = ${session.userId},
        reviewed_at = NOW(),
        rejection_reason = ${rejectionReason || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    ` as Record<string, unknown>[];

    // If approved, we would need to apply the change
    // This is a complex operation that varies by entity type
    // For now, we just log it and let the admin make the change manually
    // In production, you'd want to implement the actual change application

    const message = status === 'approved'
      ? 'Solicitud aprobada. El cambio debe ser aplicado manualmente por el administrador del sistema.'
      : `Solicitud rechazada: ${rejectionReason}`;

    return NextResponse.json({
      success: true,
      data: result[0],
      message,
    });
  } catch (error) {
    console.error('Update change request error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando solicitud de cambio' },
      { status: 500 }
    );
  }
}
