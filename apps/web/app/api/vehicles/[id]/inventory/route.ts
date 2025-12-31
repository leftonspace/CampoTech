import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InventoryService } from '@/src/services/inventory.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id: vehicleId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verify vehicle belongs to organization
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        organizationId: session.organizationId,
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: 'Vehículo no encontrado' },
        { status: 404 }
      );
    }

    // Use consolidated service to get vehicle warehouse and stock
    const warehouse = await InventoryService.getVehicleWarehouse(session.organizationId, vehicleId);
    const levels = await InventoryService.getStockLevels(session.organizationId, {
      warehouseId: warehouse.id,
    });

    // Map to frontend format
    let totalValue = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;
    const alerts: any[] = [];

    const items = (levels as any[]).map(level => {
      const product = level.product;
      const value = level.quantityOnHand * Number(product.costPrice || 0);
      totalValue += value;

      let stockStatus: 'OK' | 'LOW' | 'OUT' = 'OK';
      if (level.quantityOnHand <= 0) {
        stockStatus = 'OUT';
        outOfStockItems++;
        alerts.push({
          itemId: product.id,
          itemName: product.name,
          quantity: level.quantityOnHand,
          minLevel: product.minStockLevel,
          status: 'OUT',
        });
      } else if (product.trackInventory && level.quantityOnHand <= product.minStockLevel) {
        stockStatus = 'LOW';
        lowStockItems++;
        alerts.push({
          itemId: product.id,
          itemName: product.name,
          quantity: level.quantityOnHand,
          minLevel: product.minStockLevel,
          status: 'LOW',
        });
      }

      return {
        id: level.id,
        item: {
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          unit: product.unitOfMeasure,
          minStockLevel: product.minStockLevel,
          costPrice: Number(product.costPrice),
          salePrice: Number(product.salePrice),
        },
        quantity: level.quantityOnHand,
        value,
        status: stockStatus,
        lastCountedAt: level.lastMovementAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        vehicle,
        location: {
          id: warehouse.id,
          name: warehouse.name,
          isActive: warehouse.isActive,
        },
        items,
        summary: {
          totalItems: items.length,
          totalValue,
          lowStockItems,
          outOfStockItems,
        },
        alerts: alerts.sort((a, b) => a.quantity - b.quantity),
      },
    });
  } catch (error) {
    console.error('Vehicle inventory list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error cargando inventario del vehículo' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id: vehicleId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!['OWNER', 'DISPATCHER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, itemId, quantity, notes } = body;

    const warehouse = await InventoryService.getVehicleWarehouse(session.organizationId, vehicleId);

    // Determine adjustment quantity based on action
    let adjustmentQty = Number(quantity);
    if (action === 'set') {
      const currentLevel = await prisma.inventoryLevel.findFirst({
        where: { productId: itemId, warehouseId: warehouse.id }
      });
      adjustmentQty = Number(quantity) - (currentLevel?.quantityOnHand || 0);
    } else if (action === 'remove') {
      adjustmentQty = -Math.abs(Number(quantity));
    }

    await InventoryService.adjustStock(session.organizationId, {
      productId: itemId,
      warehouseId: warehouse.id,
      quantity: adjustmentQty,
      reason: notes || `Ajuste en vehículo ${vehicleId}`,
      notes,
      performedById: session.userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Inventario de vehículo actualizado exitosamente',
    });
  } catch (error) {
    console.error('Vehicle inventory update error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error actualizando inventario del vehículo' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id: vehicleId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!['OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId') || searchParams.get('stockId');

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'ID de producto es requerido' },
        { status: 400 }
      );
    }

    const warehouse = await InventoryService.getVehicleWarehouse(session.organizationId, vehicleId);

    // Reset stock to 0 in this vehicle
    const currentLevel = await prisma.inventoryLevel.findFirst({
      where: { productId, warehouseId: warehouse.id }
    });

    if (currentLevel && currentLevel.quantityOnHand !== 0) {
      await InventoryService.adjustStock(session.organizationId, {
        productId,
        warehouseId: warehouse.id,
        quantity: -currentLevel.quantityOnHand,
        reason: 'Removido de vehículo',
        performedById: session.userId,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Artículo removido del inventario del vehículo',
    });
  } catch (error) {
    console.error('Vehicle inventory deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'Error eliminando artículo del inventario' },
      { status: 500 }
    );
  }
}
