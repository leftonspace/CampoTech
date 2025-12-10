import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrder,
  getPendingReceiptOrders,
  getPurchasingStats,
  approvePurchaseOrder,
  markAsSent,
  cancelPurchaseOrder,
  receivePurchaseOrder,
  quickReceiveOrder,
} from '@/src/modules/inventory';

/**
 * GET /api/inventory/purchase-orders
 * List purchase orders
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
    const view = searchParams.get('view');
    const orderId = searchParams.get('orderId');

    // Get single order
    if (orderId) {
      const order = await getPurchaseOrder(session.organizationId, orderId);
      if (!order) {
        return NextResponse.json(
          { success: false, error: 'Order not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: { order } });
    }

    // Pending receipt orders
    if (view === 'pending-receipt') {
      const orders = await getPendingReceiptOrders(session.organizationId);
      return NextResponse.json({ success: true, data: { orders } });
    }

    // Statistics
    if (view === 'stats') {
      const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined;
      const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined;
      const stats = await getPurchasingStats(session.organizationId, dateFrom, dateTo);
      return NextResponse.json({ success: true, data: stats });
    }

    // List orders with filters
    const filters = {
      supplierId: searchParams.get('supplierId') || undefined,
      warehouseId: searchParams.get('warehouseId') || undefined,
      status: searchParams.get('status') as any,
      dateFrom: searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined,
      dateTo: searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined,
      search: searchParams.get('search') || undefined,
    };

    const options = {
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
    };

    const result = await listPurchaseOrders(session.organizationId, filters, options);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Purchase orders list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error listing purchase orders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/purchase-orders
 * Create or process purchase order
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
    const { action, orderId } = body;

    // Process order actions
    if (action && orderId) {
      switch (action) {
        case 'approve':
          const approved = await approvePurchaseOrder(
            session.organizationId,
            orderId,
            session.userId
          );
          return NextResponse.json({ success: true, data: { order: approved } });

        case 'send':
          const sent = await markAsSent(session.organizationId, orderId);
          return NextResponse.json({ success: true, data: { order: sent } });

        case 'cancel':
          const cancelled = await cancelPurchaseOrder(
            session.organizationId,
            orderId,
            body.reason
          );
          return NextResponse.json({ success: true, data: { order: cancelled } });

        case 'receive':
          const received = await receivePurchaseOrder(session.organizationId, {
            purchaseOrderId: orderId,
            receivedById: session.userId,
            items: body.items,
            notes: body.notes,
          });
          return NextResponse.json({ success: true, data: received });

        case 'quickReceive':
          const quickReceived = await quickReceiveOrder(
            session.organizationId,
            orderId,
            session.userId
          );
          return NextResponse.json({ success: true, data: quickReceived });

        default:
          return NextResponse.json(
            { success: false, error: 'Invalid action' },
            { status: 400 }
          );
      }
    }

    // Create new order
    const order = await createPurchaseOrder({
      organizationId: session.organizationId,
      createdById: session.userId,
      ...body,
    });

    return NextResponse.json({
      success: true,
      data: { order },
    });
  } catch (error) {
    console.error('Purchase order error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error processing purchase order' },
      { status: 500 }
    );
  }
}
