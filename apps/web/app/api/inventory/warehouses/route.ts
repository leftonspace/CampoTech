import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getAllWarehouses,
  createWarehouse,
  getWarehouse,
  getWarehouseInventoryLevels,
} from '@/src/modules/inventory';

/**
 * GET /api/inventory/warehouses
 * List warehouses
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
    const warehouseId = searchParams.get('warehouseId');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const includeStock = searchParams.get('includeStock') === 'true';

    // Get single warehouse with stock
    if (warehouseId && includeStock) {
      const [warehouse, stock] = await Promise.all([
        getWarehouse(session.organizationId, warehouseId),
        getWarehouseInventoryLevels(session.organizationId, warehouseId),
      ]);

      if (!warehouse) {
        return NextResponse.json(
          { success: false, error: 'Warehouse not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { warehouse, stock },
      });
    }

    // Get single warehouse
    if (warehouseId) {
      const warehouse = await getWarehouse(session.organizationId, warehouseId);
      if (!warehouse) {
        return NextResponse.json(
          { success: false, error: 'Warehouse not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: { warehouse } });
    }

    // List all warehouses
    const warehouses = await getAllWarehouses(session.organizationId, includeInactive);

    return NextResponse.json({
      success: true,
      data: { warehouses },
    });
  } catch (error) {
    console.error('Warehouses list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error listing warehouses' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/warehouses
 * Create a warehouse
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

    const warehouse = await createWarehouse({
      organizationId: session.organizationId,
      ...body,
    });

    return NextResponse.json({
      success: true,
      data: { warehouse },
    });
  } catch (error) {
    console.error('Warehouse creation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error creating warehouse' },
      { status: 500 }
    );
  }
}
