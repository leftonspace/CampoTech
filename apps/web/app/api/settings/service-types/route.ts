/**
 * Service Types Configuration API
 * GET /api/settings/service-types - List all service types for organization
 * POST /api/settings/service-types - Create a new service type
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Default service types to seed for new organizations
const DEFAULT_SERVICE_TYPES = [
  { code: 'INSTALACION_SPLIT', name: 'Instalación Split', sortOrder: 1 },
  { code: 'REPARACION_SPLIT', name: 'Reparación Split', sortOrder: 2 },
  { code: 'MANTENIMIENTO_SPLIT', name: 'Mantenimiento Split', sortOrder: 3 },
  { code: 'INSTALACION_CALEFACTOR', name: 'Instalación Calefactor', sortOrder: 4 },
  { code: 'REPARACION_CALEFACTOR', name: 'Reparación Calefactor', sortOrder: 5 },
  { code: 'MANTENIMIENTO_CALEFACTOR', name: 'Mantenimiento Calefactor', sortOrder: 6 },
  { code: 'OTRO', name: 'Otro', sortOrder: 99 },
];

// Helper to check if table doesn't exist
function isTableNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021'
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    let serviceTypes: any[] = [];

    try {
      serviceTypes = await prisma.serviceTypeConfig.findMany({
        where: {
          organizationId: session.organizationId,
          isActive: true,
        },
        orderBy: { sortOrder: 'asc' },
      });

      // If no service types configured, seed with defaults
      if (serviceTypes.length === 0) {
        const created = await prisma.serviceTypeConfig.createMany({
          data: DEFAULT_SERVICE_TYPES.map((st) => ({
            ...st,
            organizationId: session.organizationId,
          })),
        });

        // Fetch the created types
        serviceTypes = await prisma.serviceTypeConfig.findMany({
          where: {
            organizationId: session.organizationId,
            isActive: true,
          },
          orderBy: { sortOrder: 'asc' },
        });
      }
    } catch (queryError) {
      // If table doesn't exist, return default types
      if (isTableNotFoundError(queryError)) {
        console.warn('ServiceTypeConfig table not found - returning defaults. Run database migrations.');
        return NextResponse.json({
          success: true,
          data: DEFAULT_SERVICE_TYPES.map((st, index) => ({
            id: `default-${index}`,
            ...st,
            isActive: true,
            description: null,
            color: null,
            icon: null,
          })),
          _notice: 'Using default service types. Run database migrations to enable customization.',
        });
      }
      throw queryError;
    }

    return NextResponse.json({
      success: true,
      data: serviceTypes,
    });
  } catch (error) {
    console.error('Get service types error:', error);
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
    if (!['ADMIN', 'OWNER'].includes(session.role.toUpperCase())) {
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
      if (isTableNotFoundError(createError)) {
        return NextResponse.json(
          {
            success: false,
            error: 'La configuración de tipos de servicio no está disponible. Contacte al administrador.',
            _notice: 'ServiceTypeConfig table not found. Run database migrations.',
          },
          { status: 503 }
        );
      }
      throw createError;
    }
  } catch (error) {
    console.error('Create service type error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creando tipo de servicio' },
      { status: 500 }
    );
  }
}
