import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InventoryService } from '@/src/services/inventory.service';

/**
 * GET /api/inventory/vehicle-stock
 * Get vehicle/technician stock information
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
    const view = searchParams.get('view') || 'stock';
    const vehicleId = searchParams.get('vehicleId');
    const technicianId = searchParams.get('technicianId');

    // Helper to get stock for a vehicle
    const getStockForVehicle = async (vId: string) => {
      const warehouse = await InventoryService.getVehicleWarehouse(session.organizationId, vId);
      return InventoryService.getStockLevels(session.organizationId, { warehouseId: warehouse.id });
    };

    // Get vehicle stock
    if (view === 'stock' && vehicleId) {
      const stock = await getStockForVehicle(vehicleId);
      return NextResponse.json({ success: true, data: { stock } });
    }

    // Get technician's stock
    if (view === 'technician' && technicianId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { technicianId, organizationId: session.organizationId }
      });
      if (!vehicle) return NextResponse.json({ success: true, data: { stock: [] } });
      const stock = await getStockForVehicle(vehicle.id);
      return NextResponse.json({ success: true, data: { stock } });
    }

    // Get current user's stock
    if (view === 'my-stock') {
      const vehicle = await prisma.vehicle.findFirst({
        where: { technicianId: session.userId, organizationId: session.organizationId }
      });
      if (!vehicle) return NextResponse.json({ success: true, data: { stock: [] } });
      const stock = await getStockForVehicle(vehicle.id);
      return NextResponse.json({ success: true, data: { stock } });
    }

    // Get vehicle stock value
    if (view === 'value' && vehicleId) {
      const stock = await getStockForVehicle(vehicleId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalValue = (stock as any[]).reduce((sum, lvl) => {
        return sum + (lvl.quantityOnHand * Number(lvl.product.costPrice || 0));
      }, 0);
      return NextResponse.json({
        success: true,
        data: { totalValue, itemCount: stock.length },
      });
    }

    // Get vehicles needing replenishment (low stock)
    if (view === 'needs-replenishment') {
      const allVehicleLevels = await InventoryService.getStockLevels(session.organizationId, {
        lowStock: true
      });
      // Filter for only VEHICLE type warehouses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vehicleNeeds = allVehicleLevels.filter((lvl: any) => lvl.warehouse?.type === 'VEHICLE');
      return NextResponse.json({ success: true, data: { items: vehicleNeeds } });
    }

    // Get vehicle stock history (movements)
    if (view === 'history' && vehicleId) {
      const warehouse = await InventoryService.getVehicleWarehouse(session.organizationId, vehicleId);
      const movements = await prisma.stockMovement.findMany({
        where: {
          organizationId: session.organizationId,
          OR: [
            { fromWarehouseId: warehouse.id },
            { toWarehouseId: warehouse.id }
          ]
        },
        include: { product: true, performedBy: true },
        orderBy: { performedAt: 'desc' },
        take: 50
      });
      return NextResponse.json({ success: true, data: { history: movements } });
    }

    // Placeholder for replenishment requests (requires model)
    if (view === 'replenishment' || view === 'pending-replenishments') {
      return NextResponse.json({
        success: true,
        data: {
          requests: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid view parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Vehicle stock API error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching vehicle stock data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/vehicle-stock
 * Load, unload, transfer, or reconcile vehicle stock
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

    const body = await request.json();
    const { action, vehicleId, itemId, quantity, notes } = body;

    if (!vehicleId || !itemId || !quantity) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const warehouse = await InventoryService.getVehicleWarehouse(session.organizationId, vehicleId);

    // Get default warehouse for transfers
    const defaultWarehouse = await prisma.warehouse.findFirst({
      where: { organizationId: session.organizationId, isDefault: true }
    });

    switch (action) {
      case 'load':
        if (!defaultWarehouse) throw new Error('No hay un depósito principal configurado');
        await InventoryService.transferStock(session.organizationId, {
          productId: itemId,
          fromWarehouseId: defaultWarehouse.id,
          toWarehouseId: warehouse.id,
          quantity: Number(quantity),
          notes: notes || 'Carga de vehículo',
          performedById: session.userId,
        });
        break;

      case 'unload':
        if (!defaultWarehouse) throw new Error('No hay un depósito principal configurado');
        await InventoryService.transferStock(session.organizationId, {
          productId: itemId,
          fromWarehouseId: warehouse.id,
          toWarehouseId: defaultWarehouse.id,
          quantity: Number(quantity),
          notes: notes || 'Descarga de vehículo',
          performedById: session.userId,
        });
        break;

      case 'reconcile':
      case 'adjust':
        await InventoryService.adjustStock(session.organizationId, {
          productId: itemId,
          warehouseId: warehouse.id,
          quantity: Number(quantity),
          reason: notes || 'Ajuste de inventario en vehículo',
          notes,
          performedById: session.userId,
        });
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Action not supported' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Acción ${action} completada exitosamente`,
    });
  } catch (error) {
    console.error('Vehicle stock action error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error processing vehicle stock action' },
      { status: 500 }
    );
  }
}
