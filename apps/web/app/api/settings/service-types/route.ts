/**
 * Service Types Configuration API
 * GET /api/settings/service-types - List all service types for organization
 * POST /api/settings/service-types - Create a new service type
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// Helper to check if table or column doesn't exist (schema mismatch)
function isSchemaError(error: unknown): boolean {
  return (
    error instanceof PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022') // Table not found or column not found
  );
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let serviceTypes: any[] = [];

    try {
      serviceTypes = await prisma.serviceTypeConfig.findMany({
        where: {
          organizationId: session.organizationId,
          isActive: true,
        },
        orderBy: { sortOrder: 'asc' },
      });

      // Return what the business has created (could be empty)
      // Don't auto-seed fake data - let businesses create their own service types
    } catch (queryError) {
      // If table or column doesn't exist (schema mismatch), return empty
      if (isSchemaError(queryError)) {
        console.warn('ServiceTypeConfig schema mismatch. Run database migrations.');
        return NextResponse.json({
          success: true,
          data: [],
          _notice: 'Schema not ready. Run database migrations to enable service types.',
        });
      }
      throw queryError;
    }

    return NextResponse.json({
      success: true,
      data: serviceTypes,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Get service types error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo tipos de servicio' },
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

    // Only admins can create service types
    if (!['OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para crear tipos de servicio' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { code, name, description, color, icon, sortOrder } = body;

    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: 'Código y nombre son requeridos' },
        { status: 400 }
      );
    }

    // Normalize code: uppercase, no spaces, only alphanumeric and underscore
    const normalizedCode = code
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');

    try {
      // Check if code already exists
      const existing = await prisma.serviceTypeConfig.findFirst({
        where: {
          organizationId: session.organizationId,
          code: normalizedCode,
        },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un tipo de servicio con este código' },
          { status: 400 }
        );
      }

      // Get max sort order
      const maxSort = await prisma.serviceTypeConfig.findFirst({
        where: { organizationId: session.organizationId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });

      const serviceType = await prisma.serviceTypeConfig.create({
        data: {
          code: normalizedCode,
          name: name.trim(),
          description: description?.trim() || null,
          color: color || null,
          icon: icon || null,
          sortOrder: sortOrder ?? (maxSort?.sortOrder ?? 0) + 1,
          organizationId: session.organizationId,
        },
      });

      return NextResponse.json({
        success: true,
        data: serviceType,
      });
    } catch (createError) {
      if (isSchemaError(createError)) {
        return NextResponse.json(
          {
            success: false,
            error: 'La configuración de tipos de servicio no está disponible. Contacte al administrador.',
            _notice: 'ServiceTypeConfig schema mismatch. Run database migrations.',
          },
          { status: 503 }
        );
      }
      throw createError;
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Create service type error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error creando tipo de servicio' },
      { status: 500 }
    );
  }
}
