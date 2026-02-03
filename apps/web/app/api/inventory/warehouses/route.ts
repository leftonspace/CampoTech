/**
 * Warehouses API Route
 * Full CRUD for inventory warehouses/storage locations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
// import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

/**
 * GET /api/inventory/warehouses
 * List all warehouses
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const type = searchParams.get('type');
    const warehouseId = searchParams.get('warehouseId');
    const includeStock = searchParams.get('includeStock') === 'true';

    // Get single warehouse
    if (warehouseId) {
      const warehouse = await prisma.warehouse.findFirst({
        where: {
          id: warehouseId,
          organizationId: session.organizationId,
        },
        include: {
          storageLocations: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      if (!warehouse) {
        return NextResponse.json(
          { success: false, error: 'Depósito no encontrado' },
          { status: 404 }
        );
      }

      // Include stock if requested
      if (includeStock) {
        const stockLevels = await prisma.inventoryLevel.findMany({
          where: { warehouseId },
          include: {
            product: {
              select: { id: true, sku: true, name: true, minStockLevel: true },
            },
            storageLocation: {
              select: { id: true, code: true, name: true },
            },
          },
        });

        return NextResponse.json({
          success: true,
          data: { ...warehouse, stockLevels },
        });
      }

      return NextResponse.json({
        success: true,
        data: warehouse,
      });
    }

    const where: Record<string, unknown> = {
      organizationId: session.organizationId,
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (type) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where.type = type as any;
    }

    const warehouses = await prisma.warehouse.findMany({
      where,
      include: {
        _count: {
          select: {
            inventoryLevels: true,
            storageLocations: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { type: 'asc' }, { name: 'asc' }],
    });

    // Try to fetch vehicle info separately (handles case where migration hasn't run)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let vehicleMap: Record<string, any> = {};
    try {
      const warehousesWithVehicles = await prisma.warehouse.findMany({
        where: {
          organizationId: session.organizationId,
          vehicleId: { not: null },
        },
        select: {
          id: true,
          vehicle: {
            select: {
              id: true,
              plateNumber: true,
              make: true,
              model: true,
              status: true,
            },
          },
        },
      });
      vehicleMap = Object.fromEntries(
        warehousesWithVehicles.map((w: typeof warehousesWithVehicles[number]) => [w.id, w.vehicle])
      );
    } catch {
      // vehicleId column may not exist yet - migration not run
      console.log('Vehicle relation not available - migration may be pending');
    }

    // Calculate stock value for each warehouse
    const warehousesWithStats = await Promise.all(
      warehouses.map(async (warehouse: typeof warehouses[number]) => {
        const stockValue = await prisma.inventoryLevel.aggregate({
          where: { warehouseId: warehouse.id },
          _sum: { totalCost: true },
        });

        const itemCount = await prisma.inventoryLevel.aggregate({
          where: { warehouseId: warehouse.id },
          _sum: { quantityOnHand: true },
        });

        return {
          ...warehouse,
          vehicle: vehicleMap[warehouse.id] || null,
          productCount: warehouse._count.inventoryLevels,
          storageLocationCount: warehouse._count.storageLocations,
          totalItems: itemCount._sum.quantityOnHand || 0,
          stockValue: Number(stockValue._sum.totalCost || 0),
          _count: undefined,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: { warehouses: warehousesWithStats },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Warehouses list error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error listing warehouses' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/warehouses
 * Create a new warehouse
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user role
    if (!['OWNER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para crear depósitos' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.code) {
      return NextResponse.json(
        { success: false, error: 'Nombre y código son requeridos' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existingWarehouse = await prisma.warehouse.findFirst({
      where: {
        organizationId: session.organizationId,
        code: body.code.toUpperCase(),
      },
    });

    if (existingWarehouse) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un depósito con este código' },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (body.isDefault) {
      await prisma.warehouse.updateMany({
        where: {
          organizationId: session.organizationId,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        organizationId: session.organizationId,
        code: body.code.toUpperCase(),
        name: body.name,
        type: body.type || 'MAIN',
        address: body.address || null,
        contactName: body.contactName || null,
        contactPhone: body.contactPhone || null,
        contactEmail: body.contactEmail || null,
        isDefault: body.isDefault || false,
        allowNegative: body.allowNegative || false,
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json({
      success: true,
      data: warehouse,
      message: 'Depósito creado exitosamente',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Warehouse creation error:', err.message);

    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'Ya existe un depósito con este código' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Error creating warehouse' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inventory/warehouses
 * Update warehouse
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user role
    if (!['OWNER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar depósitos' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'ID del depósito es requerido' },
        { status: 400 }
      );
    }

    // Check warehouse exists
    const existingWarehouse = await prisma.warehouse.findFirst({
      where: {
        id: body.id,
        organizationId: session.organizationId,
      },
    });

    if (!existingWarehouse) {
      return NextResponse.json(
        { success: false, error: 'Depósito no encontrado' },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults
    if (body.isDefault && !existingWarehouse.isDefault) {
      await prisma.warehouse.updateMany({
        where: {
          organizationId: session.organizationId,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const updateData: Record<string, unknown> = {};

    if (body.code !== undefined) updateData.code = body.code.toUpperCase();
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.contactName !== undefined) updateData.contactName = body.contactName;
    if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone;
    if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail;
    if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;
    if (body.allowNegative !== undefined) updateData.allowNegative = body.allowNegative;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const warehouse = await prisma.warehouse.update({
      where: { id: body.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: warehouse,
      message: 'Depósito actualizado exitosamente',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Warehouse update error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error updating warehouse' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/warehouses
 * Delete a warehouse
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user role
    if (!['OWNER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para eliminar depósitos' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('id');

    if (!warehouseId) {
      return NextResponse.json(
        { success: false, error: 'ID del depósito es requerido' },
        { status: 400 }
      );
    }

    // Check warehouse exists
    const warehouse = await prisma.warehouse.findFirst({
      where: {
        id: warehouseId,
        organizationId: session.organizationId,
      },
      include: {
        _count: { select: { inventoryLevels: true } },
      },
    });

    if (!warehouse) {
      return NextResponse.json(
        { success: false, error: 'Depósito no encontrado' },
        { status: 404 }
      );
    }

    // Don't allow deleting vehicle warehouses - they are linked to fleet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isVehicleWarehouse = warehouse.type === 'VEHICLE' || (warehouse as any).vehicleId;
    if (isVehicleWarehouse) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede eliminar un almacén de vehículo. El almacén se elimina automáticamente al eliminar el vehículo de la flota.',
        },
        { status: 400 }
      );
    }

    // Check if warehouse has inventory
    if (warehouse._count.inventoryLevels > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede eliminar un depósito con stock. Transfiera el inventario primero.',
        },
        { status: 400 }
      );
    }

    // Check if it's the default warehouse
    if (warehouse.isDefault) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede eliminar el depósito predeterminado. Establezca otro como predeterminado primero.',
        },
        { status: 400 }
      );
    }

    await prisma.warehouse.delete({
      where: { id: warehouseId },
    });

    return NextResponse.json({
      success: true,
      message: 'Depósito eliminado exitosamente',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Warehouse delete error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error deleting warehouse' },
      { status: 500 }
    );
  }
}
