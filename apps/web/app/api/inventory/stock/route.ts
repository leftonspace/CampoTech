import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  adjustInventory,
  transferStock,
  getStockLevelSummary,
  listMovements,
  generateMovementReport,
  getReservationStats,
  createInventoryCount,
  listInventoryCounts,
} from '@/src/modules/inventory';

/**
 * GET /api/inventory/stock
 * Get stock levels, movements, or counts
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
    const view = searchParams.get('view') || 'levels';

    // Stock levels for a product
    if (view === 'levels') {
      const productId = searchParams.get('productId');
      if (!productId) {
        return NextResponse.json(
          { success: false, error: 'productId is required' },
          { status: 400 }
        );
      }

      const summary = await getStockLevelSummary(session.organizationId, productId);
      return NextResponse.json({ success: true, data: summary });
    }

    // Stock movements
    if (view === 'movements') {
      const filters = {
        productId: searchParams.get('productId') || undefined,
        warehouseId: searchParams.get('warehouseId') || undefined,
        movementType: searchParams.get('movementType') as any,
        dateFrom: searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined,
        dateTo: searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined,
      };

      const options = {
        page: parseInt(searchParams.get('page') || '1', 10),
        pageSize: parseInt(searchParams.get('pageSize') || '50', 10),
      };

      const result = await listMovements(session.organizationId, filters, options);
      return NextResponse.json({ success: true, data: result });
    }

    // Movement report
    if (view === 'report') {
      const dateFrom = new Date(searchParams.get('dateFrom') || Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateTo = new Date(searchParams.get('dateTo') || Date.now());

      const report = await generateMovementReport(session.organizationId, dateFrom, dateTo);
      return NextResponse.json({ success: true, data: report });
    }

    // Reservation stats
    if (view === 'reservations') {
      const stats = await getReservationStats(session.organizationId);
      return NextResponse.json({ success: true, data: stats });
    }

    // Inventory counts
    if (view === 'counts') {
      const result = await listInventoryCounts(session.organizationId, {
        warehouseId: searchParams.get('warehouseId') || undefined,
        status: searchParams.get('status') as any,
        page: parseInt(searchParams.get('page') || '1', 10),
        pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
      });
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid view parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Stock API error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching stock data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/stock
 * Adjust stock, transfer, or create inventory count
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
    const { action } = body;

    // Adjust stock
    if (action === 'adjust') {
      const { productId, warehouseId, quantity, reason, notes, unitCost } = body;
      const result = await adjustInventory({
        organizationId: session.organizationId,
        productId,
        warehouseId,
        quantity,
        reason,
        notes,
        unitCost,
        performedById: session.userId,
      });
      return NextResponse.json({ success: true, data: result });
    }

    // Transfer stock
    if (action === 'transfer') {
      const { productId, fromWarehouseId, toWarehouseId, quantity, notes } = body;
      const result = await transferStock({
        organizationId: session.organizationId,
        productId,
        fromWarehouseId,
        toWarehouseId,
        quantity,
        notes,
        performedById: session.userId,
      });
      return NextResponse.json({ success: true, data: result });
    }

    // Create inventory count
    if (action === 'createCount') {
      const { warehouseId, countType, scheduledAt, productIds, notes } = body;
      const count = await createInventoryCount({
        organizationId: session.organizationId,
        warehouseId,
        countType,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        assignedToId: session.userId,
        productIds,
        notes,
      });
      return NextResponse.json({ success: true, data: { count } });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Stock action error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error processing stock action' },
      { status: 500 }
    );
  }
}
