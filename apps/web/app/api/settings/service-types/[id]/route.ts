/**
 * Service Type Individual API
 * GET /api/settings/service-types/[id] - Get single service type
 * PUT /api/settings/service-types/[id] - Update service type
 * DELETE /api/settings/service-types/[id] - Delete (deactivate) service type
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

function isTableNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021'
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const serviceType = await prisma.serviceTypeConfig.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!serviceType) {
      return NextResponse.json(
        { success: false, error: 'Tipo de servicio no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serviceType,
    });
  } catch (error) {
    if (isTableNotFoundError(error)) {
      return NextResponse.json(
        { success: false, error: 'Configuración no disponible' },
        { status: 503 }
      );
    }
    console.error('Get service type error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo tipo de servicio' },
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
    const { id } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!['ADMIN', 'OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para modificar tipos de servicio' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, color, icon, sortOrder, isActive } = body;

    // Check service type exists and belongs to organization
    const existing = await prisma.serviceTypeConfig.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Tipo de servicio no encontrado' },
        { status: 404 }
      );
    }

    const serviceType = await prisma.serviceTypeConfig.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(color !== undefined && { color: color || null }),
        ...(icon !== undefined && { icon: icon || null }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      success: true,
      data: serviceType,
    });
  } catch (error) {
    if (isTableNotFoundError(error)) {
      return NextResponse.json(
        { success: false, error: 'Configuración no disponible' },
        { status: 503 }
      );
    }
    console.error('Update service type error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando tipo de servicio' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!['ADMIN', 'OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para eliminar tipos de servicio' },
        { status: 403 }
      );
    }

    // Check service type exists and belongs to organization
    const existing = await prisma.serviceTypeConfig.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Tipo de servicio no encontrado' },
        { status: 404 }
      );
    }

    // Soft delete - just deactivate
    await prisma.serviceTypeConfig.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Tipo de servicio eliminado',
    });
  } catch (error) {
    if (isTableNotFoundError(error)) {
      return NextResponse.json(
        { success: false, error: 'Configuración no disponible' },
        { status: 503 }
      );
    }
    console.error('Delete service type error:', error);
    return NextResponse.json(
      { success: false, error: 'Error eliminando tipo de servicio' },
      { status: 500 }
    );
  }
}
