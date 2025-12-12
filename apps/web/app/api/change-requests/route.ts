/**
 * Change Requests API Route
 * GET /api/change-requests - List change requests for organization
 * POST /api/change-requests - Create a new change request
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@/lib/config/field-permissions';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const userRole = (session.role?.toUpperCase() || 'VIEWER') as UserRole;

    // Only OWNER and ADMIN can view change requests
    if (!['OWNER', 'ADMIN'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver solicitudes de cambio' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const entityType = searchParams.get('entityType');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {
      organizationId: session.organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    // Execute raw query since change_requests table might not be in Prisma schema yet
    const offset = (page - 1) * limit;

    const [requests, countResult] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          cr.*,
          u.name as requested_by_name,
          r.name as reviewed_by_name
        FROM change_requests cr
        LEFT JOIN users u ON cr.requested_by = u.id
        LEFT JOIN users r ON cr.reviewed_by = r.id
        WHERE cr.organization_id = ${session.organizationId}
        ${status ? prisma.$queryRaw`AND cr.status = ${status}` : prisma.$queryRaw``}
        ${entityType ? prisma.$queryRaw`AND cr.entity_type = ${entityType}` : prisma.$queryRaw``}
        ORDER BY cr.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      ` as Promise<Record<string, unknown>[]>,
      prisma.$queryRaw`
        SELECT COUNT(*) as count FROM change_requests
        WHERE organization_id = ${session.organizationId}
        ${status ? prisma.$queryRaw`AND status = ${status}` : prisma.$queryRaw``}
        ${entityType ? prisma.$queryRaw`AND entity_type = ${entityType}` : prisma.$queryRaw``}
      ` as Promise<[{ count: bigint }]>,
    ]);

    const total = Number(countResult[0]?.count || 0);

    return NextResponse.json({
      success: true,
      data: requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get change requests error:', error);
    // If table doesn't exist, return empty data
    if (String(error).includes('does not exist')) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        _notice: 'Change requests table not yet created. Run database migrations.',
      });
    }
    return NextResponse.json(
      { success: false, error: 'Error obteniendo solicitudes de cambio' },
      { status: 500 }
    );
  }
}

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
    const { entityType, entityId, fieldName, currentValue, requestedValue, reason, documentUrls } = body;

    // Validate required fields
    if (!entityType || !entityId || !fieldName || !requestedValue || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: 'Faltan campos requeridos: entityType, entityId, fieldName, requestedValue, reason',
        },
        { status: 400 }
      );
    }

    // Validate entity type
    const validEntityTypes = ['organization', 'user', 'customer', 'vehicle', 'product'];
    if (!validEntityTypes.includes(entityType)) {
      return NextResponse.json(
        { success: false, error: `Tipo de entidad invalido. Tipos validos: ${validEntityTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Insert using raw query
    const result = await prisma.$queryRaw`
      INSERT INTO change_requests (
        organization_id,
        requested_by,
        entity_type,
        entity_id,
        field_name,
        current_value,
        requested_value,
        reason,
        document_urls,
        status,
        created_at,
        updated_at
      ) VALUES (
        ${session.organizationId},
        ${session.userId},
        ${entityType},
        ${entityId},
        ${fieldName},
        ${currentValue || null},
        ${requestedValue},
        ${reason},
        ${documentUrls ? JSON.stringify(documentUrls) : '[]'}::text[],
        'pending',
        NOW(),
        NOW()
      )
      RETURNING *
    ` as Record<string, unknown>[];

    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'Solicitud de cambio creada. Un administrador revisara su solicitud.',
    });
  } catch (error) {
    console.error('Create change request error:', error);
    // If table doesn't exist, show helpful message
    if (String(error).includes('does not exist')) {
      return NextResponse.json(
        {
          success: false,
          error: 'El sistema de solicitudes de cambio no esta disponible. Contacte al administrador.',
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Error creando solicitud de cambio' },
      { status: 500 }
    );
  }
}
