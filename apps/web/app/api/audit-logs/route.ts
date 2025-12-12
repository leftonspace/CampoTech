/**
 * Audit Logs API
 * GET /api/audit-logs - List audit logs with filters (OWNER/ADMIN only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface AuditLogRow {
  id: string;
  org_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data: unknown;
  new_data: unknown;
  metadata: Record<string, unknown>;
  created_at: Date;
  user_name: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only OWNER and ADMIN can view audit logs
    const userRole = session.role?.toUpperCase();
    if (!['OWNER', 'ADMIN'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para ver los registros de auditoria' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const entityType = searchParams.get('entityType');
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const offset = (page - 1) * pageSize;
    const { organizationId } = session;

    // Build WHERE conditions
    let whereClause = 'WHERE a.org_id = $1::uuid';
    const params: (string | Date)[] = [organizationId];
    let paramIndex = 2;

    if (entityType) {
      whereClause += ` AND a.entity_type = $${paramIndex}`;
      params.push(entityType);
      paramIndex++;
    }

    if (action) {
      whereClause += ` AND a.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (userId) {
      whereClause += ` AND a.user_id = $${paramIndex}::uuid`;
      params.push(userId);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND a.created_at >= $${paramIndex}::timestamp`;
      params.push(new Date(startDate));
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND a.created_at <= $${paramIndex}::timestamp`;
      params.push(new Date(endDate));
      paramIndex++;
    }

    // Get total count
    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM audit_logs a ${whereClause}`,
      ...params
    );
    const total = Number(countResult[0]?.count || 0);

    // Get logs with user name
    const logs = await prisma.$queryRawUnsafe<AuditLogRow[]>(
      `SELECT
        a.id::text,
        a.org_id::text,
        a.user_id::text,
        a.action,
        a.entity_type,
        a.entity_id::text,
        a.old_data,
        a.new_data,
        a.metadata,
        a.created_at,
        u.name as user_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}`,
      ...params
    );

    // Format response
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      userId: log.user_id,
      userName: log.user_name || 'Sistema',
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      oldData: log.old_data,
      newData: log.new_data,
      metadata: log.metadata,
      createdAt: log.created_at.toISOString(),
      ipAddress: (log.metadata as Record<string, unknown>)?.ipAddress,
    }));

    // Get available filters
    const entityTypes = await prisma.$queryRaw<Array<{ entity_type: string }>>`
      SELECT DISTINCT entity_type
      FROM audit_logs
      WHERE org_id = ${organizationId}::uuid
      ORDER BY entity_type
    `;

    const actions = await prisma.$queryRaw<Array<{ action: string }>>`
      SELECT DISTINCT action
      FROM audit_logs
      WHERE org_id = ${organizationId}::uuid
      ORDER BY action
    `;

    return NextResponse.json({
      success: true,
      data: {
        logs: formattedLogs,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        filters: {
          entityTypes: entityTypes.map((e) => e.entity_type),
          actions: actions.map((a) => a.action),
        },
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo registros de auditoria' },
      { status: 500 }
    );
  }
}
