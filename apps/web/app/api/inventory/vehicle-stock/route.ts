import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getVehicleStock,
  getTechnicianStock,
  loadVehicleStock,
  unloadVehicleStock,
  transferBetweenVehicles,
  reconcileVehicleStock,
  getVehicleStockValue,
  getVehiclesNeedingReplenishment,
  getVehicleStockHistory,
  createReplenishmentRequest,
  getReplenishmentRequest,
  updateReplenishmentStatus,
  getPendingReplenishments,
  listReplenishmentRequests,
} from '@/src/modules/inventory';

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

    // Get vehicle stock
    if (view === 'stock' && vehicleId) {
      const stock = await getVehicleStock(session.organizationId, vehicleId);
      return NextResponse.json({ success: true, data: { stock } });
    }

    // Get technician's stock (across all assigned vehicles)
    if (view === 'technician' && technicianId) {
      const stock = await getTechnicianStock(session.organizationId, technicianId);
      return NextResponse.json({ success: true, data: { stock } });
    }

    // Get current user's stock
    if (view === 'my-stock') {
      const stock = await getTechnicianStock(session.organizationId, session.userId);
      return NextResponse.json({ success: true, data: { stock } });
    }

    // Get vehicle stock value
    if (view === 'value' && vehicleId) {
      const value = await getVehicleStockValue(session.organizationId, vehicleId);
      return NextResponse.json({ success: true, data: value });
    }

    // Get vehicles needing replenishment
    if (view === 'needs-replenishment') {
      const vehicles = await getVehiclesNeedingReplenishment(session.organizationId);
      return NextResponse.json({ success: true, data: { vehicles } });
    }

    // Get vehicle stock history
    if (view === 'history' && vehicleId) {
      const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined;
      const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined;
      const history = await getVehicleStockHistory(session.organizationId, vehicleId, dateFrom, dateTo);
      return NextResponse.json({ success: true, data: { history } });
    }

    // Get replenishment request
    if (view === 'replenishment') {
      const requestId = searchParams.get('requestId');
      if (requestId) {
        const request = await getReplenishmentRequest(session.organizationId, requestId);
        if (!request) {
          return NextResponse.json(
            { success: false, error: 'Request not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, data: { request } });
      }

      // List replenishment requests
      const filters = {
        vehicleId: searchParams.get('vehicleId') || undefined,
        technicianId: searchParams.get('technicianId') || undefined,
        status: searchParams.get('status') as any,
        dateFrom: searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined,
        dateTo: searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined,
      };

      const options = {
        page: parseInt(searchParams.get('page') || '1', 10),
        pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
      };

      const result = await listReplenishmentRequests(session.organizationId, filters, options);
      return NextResponse.json({ success: true, data: result });
    }

    // Pending replenishments
    if (view === 'pending-replenishments') {
      const requests = await getPendingReplenishments(session.organizationId);
      return NextResponse.json({ success: true, data: { requests } });
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
    const { action } = body;

    // Load stock to vehicle
    if (action === 'load') {
      const { vehicleId, items, fromWarehouseId, notes } = body;
      const result = await loadVehicleStock({
        organizationId: session.organizationId,
        vehicleId,
        items,
        fromWarehouseId,
        performedById: session.userId,
        notes,
      });
      return NextResponse.json({ success: true, data: result });
    }

    // Unload stock from vehicle
    if (action === 'unload') {
      const { vehicleId, items, toWarehouseId, notes } = body;
      const result = await unloadVehicleStock({
        organizationId: session.organizationId,
        vehicleId,
        items,
        toWarehouseId,
        performedById: session.userId,
        notes,
      });
      return NextResponse.json({ success: true, data: result });
    }

    // Transfer between vehicles
    if (action === 'transfer') {
      const { fromVehicleId, toVehicleId, items, notes } = body;
      const result = await transferBetweenVehicles({
        organizationId: session.organizationId,
        fromVehicleId,
        toVehicleId,
        items,
        performedById: session.userId,
        notes,
      });
      return NextResponse.json({ success: true, data: result });
    }

    // Reconcile vehicle stock
    if (action === 'reconcile') {
      const { vehicleId, items } = body;
      const result = await reconcileVehicleStock({
        organizationId: session.organizationId,
        vehicleId,
        items,
        performedById: session.userId,
      });
      return NextResponse.json({ success: true, data: result });
    }

    // Create replenishment request
    if (action === 'requestReplenishment') {
      const { vehicleId, items, priority, notes } = body;
      const request = await createReplenishmentRequest({
        organizationId: session.organizationId,
        vehicleId,
        technicianId: session.userId,
        items,
        priority,
        notes,
      });
      return NextResponse.json({ success: true, data: { request } });
    }

    // Update replenishment status
    if (action === 'updateReplenishment') {
      const { requestId, status, notes, processedItems } = body;
      const request = await updateReplenishmentStatus(
        session.organizationId,
        requestId,
        status,
        session.userId,
        notes,
        processedItems
      );
      return NextResponse.json({ success: true, data: { request } });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Vehicle stock action error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error processing vehicle stock action' },
      { status: 500 }
    );
  }
}
