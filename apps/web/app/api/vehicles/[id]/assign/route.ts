/**
 * Vehicle Assignment API Route
 * POST /api/vehicles/[id]/assign - Assign driver to vehicle
 * DELETE /api/vehicles/[id]/assign - Remove driver assignment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
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

    // Only owners and Admins can assign drivers
    if (!['OWNER', 'ADMIN'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify vehicle belongs to organization
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: 'Vehículo no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { userId, isPrimaryDriver = false } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario es requerido' },
        { status: 400 }
      );
    }

    // Verify user belongs to same organization
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: session.organizationId,
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Check if assignment already exists (active assignment has no assignedUntil date)
    const existingAssignment = await prisma.vehicleAssignment.findFirst({
      where: {
        vehicleId: id,
        userId,
        assignedUntil: null,
      },
    });

    if (existingAssignment) {
      // Update existing assignment
      const updated = await prisma.vehicleAssignment.update({
        where: { id: existingAssignment.id },
        data: { isPrimaryDriver },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
              phone: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Asignación actualizada',
      });
    }

    // If setting as primary driver, unset any existing primary
    if (isPrimaryDriver) {
      await prisma.vehicleAssignment.updateMany({
        where: {
          vehicleId: id,
          isPrimaryDriver: true,
          assignedUntil: null,
        },
        data: { isPrimaryDriver: false },
      });
    }

    // Create new assignment
    const assignment = await prisma.vehicleAssignment.create({
      data: {
        vehicleId: id,
        userId,
        isPrimaryDriver,
        assignedFrom: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            phone: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    console.error('Vehicle assignment error:', error);
    return NextResponse.json(
      { success: false, error: 'Error asignando conductor' },
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

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only owners and Admins can remove assignments
    if (!['OWNER', 'ADMIN'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario es requerido' },
        { status: 400 }
      );
    }

    // Verify vehicle belongs to organization
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: 'Vehículo no encontrado' },
        { status: 404 }
      );
    }

    // Find active assignment
    const assignment = await prisma.vehicleAssignment.findFirst({
      where: {
        vehicleId: id,
        userId,
        assignedUntil: null,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: 'Asignación no encontrada' },
        { status: 404 }
      );
    }

    // End the assignment (soft delete)
    await prisma.vehicleAssignment.update({
      where: { id: assignment.id },
      data: { assignedUntil: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'Asignación eliminada',
    });
  } catch (error) {
    console.error('Vehicle unassignment error:', error);
    return NextResponse.json(
      { success: false, error: 'Error eliminando asignación' },
      { status: 500 }
    );
  }
}
