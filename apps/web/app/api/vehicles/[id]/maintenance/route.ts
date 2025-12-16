/**
 * Vehicle Maintenance API Route
 * GET /api/vehicles/[id]/maintenance - List maintenance logs
 * POST /api/vehicles/[id]/maintenance - Create maintenance record
 * DELETE /api/vehicles/[id]/maintenance - Delete maintenance record
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    const maintenanceLogs = await prisma.vehicleMaintenance.findMany({
      where: { vehicleId: id },
      orderBy: { completedDate: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: maintenanceLogs,
    });
  } catch (error) {
    console.error('Vehicle maintenance list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error cargando historial de mantenimiento' },
      { status: 500 }
    );
  }
}

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

    // Only owners and dispatchers can add maintenance
    if (!['OWNER', 'DISPATCHER'].includes(session.role.toUpperCase())) {
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
    const {
      maintenanceType,
      description,
      mileageAtService,
      cost,
      vendor,
      invoiceNumber,
      scheduledDate,
      completedDate,
      nextServiceDate,
      nextServiceMileage,
      notes,
    } = body;

    // Validate required fields
    if (!maintenanceType || !description) {
      return NextResponse.json(
        { success: false, error: 'Tipo y descripción son requeridos' },
        { status: 400 }
      );
    }

    // Validate maintenance type
    const validTypes = ['OIL_CHANGE', 'TIRE_ROTATION', 'BRAKE_SERVICE', 'INSPECTION', 'REPAIR', 'OTHER'];
    if (!validTypes.includes(maintenanceType)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de mantenimiento inválido' },
        { status: 400 }
      );
    }

    // Create maintenance record
    const maintenance = await prisma.vehicleMaintenance.create({
      data: {
        vehicleId: id,
        maintenanceType,
        description,
        mileageAtService: mileageAtService ? parseInt(mileageAtService) : null,
        cost: cost ? parseFloat(cost) : null,
        vendor: vendor || null,
        invoiceNumber: invoiceNumber || null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        completedDate: completedDate ? new Date(completedDate) : new Date(),
        nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
        nextServiceMileage: nextServiceMileage ? parseInt(nextServiceMileage) : null,
        notes: notes || null,
        createdById: session.userId,
      },
    });

    // Update vehicle's last service date and mileage if completed
    const updateData: Record<string, any> = {};
    if (completedDate || !scheduledDate) {
      updateData.lastServiceDate = completedDate ? new Date(completedDate) : new Date();
    }
    if (mileageAtService && parseInt(mileageAtService) > (vehicle.currentMileage || 0)) {
      updateData.currentMileage = parseInt(mileageAtService);
    }
    if (nextServiceDate) {
      updateData.nextServiceDate = new Date(nextServiceDate);
    }
    if (nextServiceMileage) {
      updateData.nextServiceMileage = parseInt(nextServiceMileage);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.vehicle.update({
        where: { id },
        data: updateData,
      });
    }

    return NextResponse.json({
      success: true,
      data: maintenance,
      message: 'Registro de mantenimiento creado',
    });
  } catch (error) {
    console.error('Vehicle maintenance creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creando registro de mantenimiento' },
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

    // Only owners can delete maintenance records
    if (!['OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const maintenanceId = searchParams.get('maintenanceId');

    if (!maintenanceId) {
      return NextResponse.json(
        { success: false, error: 'ID de mantenimiento es requerido' },
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

    // Verify maintenance record exists and belongs to vehicle
    const maintenance = await prisma.vehicleMaintenance.findFirst({
      where: {
        id: maintenanceId,
        vehicleId: id,
      },
    });

    if (!maintenance) {
      return NextResponse.json(
        { success: false, error: 'Registro de mantenimiento no encontrado' },
        { status: 404 }
      );
    }

    await prisma.vehicleMaintenance.delete({
      where: { id: maintenanceId },
    });

    return NextResponse.json({
      success: true,
      message: 'Registro de mantenimiento eliminado',
    });
  } catch (error) {
    console.error('Vehicle maintenance deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'Error eliminando registro de mantenimiento' },
      { status: 500 }
    );
  }
}
