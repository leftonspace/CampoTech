/**
 * Purchase Orders API Route
 * Full implementation for purchase order management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    // Get single order
    if (orderId) {
      const order = await prisma.purchaseOrder.findFirst({
        where: {
          id: orderId,
          organizationId: session.organizationId,
        },
        include: {
          supplier: {
            select: { id: true, code: true, name: true, email: true },
          },
          warehouse: {
            select: { id: true, code: true, name: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, sku: true, name: true, unitOfMeasure: true },
              },
            },
          },
          receivings: {
            orderBy: { receivedAt: 'desc' },
          },
        },
      });

      if (!order) {
        return NextResponse.json(
          { success: false, error: 'Orden de compra no encontrada' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: order });
    }

    // Pending receipt orders
    if (view === 'pending-receipt') {
      const orders = await prisma.purchaseOrder.findMany({
        where: {
          organizationId: session.organizationId,
          status: { in: ['SENT', 'PARTIAL'] },
        },
        include: {
          supplier: {
            select: { id: true, name: true },
          },
          _count: { select: { items: true } },
        },
        orderBy: { expectedDate: 'asc' },
      });

      return NextResponse.json({
        success: true,
        data: {
          orders: orders.map((o: typeof orders[number]) => ({
            ...o,
            itemCount: o._count.items,
            _count: undefined,
          })),
        },
      });
    }

    // Statistics
    if (view === 'stats') {
      const [totalOrders, pendingOrders, orders] = await Promise.all([
        prisma.purchaseOrder.count({
          where: { organizationId: session.organizationId },
        }),
        prisma.purchaseOrder.count({
          where: {
            organizationId: session.organizationId,
            status: { in: ['DRAFT', 'SENT', 'PARTIAL'] },
          },
        }),
        prisma.purchaseOrder.findMany({
          where: {
            organizationId: session.organizationId,
            status: 'RECEIVED',
          },
          select: { total: true },
        }),
      ]);

      const totalSpent = orders.reduce((sum: number, o: typeof orders[number]) => sum + Number(o.total), 0);
      const receivedCount = orders.length;

      return NextResponse.json({
        success: true,
        data: {
          totalOrders,
          pendingOrders,
          receivedOrders: receivedCount,
          totalSpent,
          avgOrderValue: receivedCount > 0 ? totalSpent / receivedCount : 0,
        },
      });
    }

    // Build where clause for list
    const where: Record<string, unknown> = {
      organizationId: session.organizationId,
    };

    if (status) {
      where.status = status as any;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const [total, orders] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, code: true, name: true },
          },
          warehouse: {
            select: { id: true, code: true, name: true },
          },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        orders: orders.map((o: typeof orders[number]) => ({
          ...o,
          itemCount: o._count.items,
          _count: undefined,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
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

    // Check user role
    if (!['OWNER', 'ADMIN', 'DISPATCHER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para gestionar órdenes de compra' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action;

    // Receive items from a purchase order
    if (action === 'receive') {
      const { orderId, items, notes } = body;

      if (!orderId || !items || !Array.isArray(items)) {
        return NextResponse.json(
          { success: false, error: 'orderId e items son requeridos' },
          { status: 400 }
        );
      }

      // Get order
      const order = await prisma.purchaseOrder.findFirst({
        where: {
          id: orderId,
          organizationId: session.organizationId,
        },
        include: {
          items: true,
        },
      });

      if (!order) {
        return NextResponse.json(
          { success: false, error: 'Orden de compra no encontrada' },
          { status: 404 }
        );
      }

      if (order.status === 'RECEIVED' || order.status === 'CANCELLED') {
        return NextResponse.json(
          { success: false, error: 'Esta orden ya fue recibida o cancelada' },
          { status: 400 }
        );
      }

      // Create receiving record
      const receivingNumber = `RCV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      // Build items JSON for receiving record
      const receivingItems = items.map((item: typeof items[number]) => {
        const orderItem = order.items.find((i: typeof order.items[number]) => i.id === item.itemId);
        return {
          productId: orderItem?.productId,
          quantityExpected: orderItem?.quantity || 0,
          quantityReceived: parseInt(item.quantity, 10) || 0,
          notes: item.notes || null,
        };
      }).filter((item: { productId: string | undefined; quantityExpected: number; quantityReceived: number; notes: string | null }) => item.productId);

      const hasVariance = receivingItems.some((item: typeof receivingItems[number]) => item.quantityExpected !== item.quantityReceived);

      await prisma.$transaction(async (tx: typeof prisma) => {
        // Create receiving record
        await tx.purchaseReceiving.create({
          data: {
            purchaseOrderId: orderId,
            receivingNumber,
            notes,
            receivedById: session.userId,
            items: receivingItems,
            hasVariance,
          },
        });

        // Process each received item
        for (const item of items) {
          const orderItem = order.items.find((i: typeof order.items[number]) => i.id === item.itemId);
          if (!orderItem) continue;

          const receivedQty = parseInt(item.quantity, 10);
          if (receivedQty <= 0) continue;

          // Update order item received quantity
          await tx.purchaseOrderItem.update({
            where: { id: item.itemId },
            data: {
              quantityReceived: { increment: receivedQty },
            },
          });

          // Find or create inventory level
          let inventoryLevel = await tx.inventoryLevel.findFirst({
            where: {
              productId: orderItem.productId,
              warehouseId: order.warehouseId,
              storageLocationId: null,
              lotNumber: null,
            },
          });

          if (inventoryLevel) {
            await tx.inventoryLevel.update({
              where: { id: inventoryLevel.id },
              data: {
                quantityOnHand: { increment: receivedQty },
                quantityAvailable: { increment: receivedQty },
                quantityOnOrder: { decrement: receivedQty },
                totalCost: { increment: Number(orderItem.unitPrice) * receivedQty },
                lastMovementAt: new Date(),
              },
            });
          } else {
            await tx.inventoryLevel.create({
              data: {
                organizationId: session.organizationId,
                productId: orderItem.productId,
                warehouseId: order.warehouseId,
                quantityOnHand: receivedQty,
                quantityAvailable: receivedQty,
                unitCost: orderItem.unitPrice,
                totalCost: Number(orderItem.unitPrice) * receivedQty,
              },
            });
          }

          // Create stock movement
          const movementNumber = `PO-${order.orderNumber}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
          await tx.stockMovement.create({
            data: {
              organizationId: session.organizationId,
              productId: orderItem.productId,
              movementNumber,
              movementType: 'PURCHASE_RECEIPT',
              quantity: receivedQty,
              direction: 'IN',
              toWarehouseId: order.warehouseId,
              unitCost: orderItem.unitPrice,
              totalCost: Number(orderItem.unitPrice) * receivedQty,
              reference: `PO: ${order.orderNumber}`,
              purchaseOrderId: orderId,
              performedById: session.userId,
            },
          });
        }

        // Check if order is fully received
        const updatedOrder = await tx.purchaseOrder.findUnique({
          where: { id: orderId },
          include: { items: true },
        });

        type UpdatedOrderItem = typeof updatedOrder.items[number];
        const allReceived = updatedOrder?.items.every((i: UpdatedOrderItem) => i.quantityReceived >= i.quantity);
        const anyReceived = updatedOrder?.items.some((i: UpdatedOrderItem) => i.quantityReceived > 0);

        let newStatus = order.status;
        if (allReceived) {
          newStatus = 'RECEIVED';
        } else if (anyReceived) {
          newStatus = 'PARTIAL';
        }

        await tx.purchaseOrder.update({
          where: { id: orderId },
          data: {
            status: newStatus,
            receivedDate: newStatus === 'RECEIVED' ? new Date() : undefined,
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: 'Recepción registrada exitosamente',
      });
    }

    // Send order to supplier
    if (action === 'send') {
      const { orderId } = body;

      const order = await prisma.purchaseOrder.findFirst({
        where: {
          id: orderId,
          organizationId: session.organizationId,
          status: 'DRAFT',
        },
      });

      if (!order) {
        return NextResponse.json(
          { success: false, error: 'Orden no encontrada o ya fue enviada' },
          { status: 404 }
        );
      }

      await prisma.purchaseOrder.update({
        where: { id: orderId },
        data: { status: 'SENT' },
      });

      return NextResponse.json({
        success: true,
        message: 'Orden de compra enviada',
      });
    }

    // Cancel order
    if (action === 'cancel') {
      const { orderId, reason } = body;

      const order = await prisma.purchaseOrder.findFirst({
        where: {
          id: orderId,
          organizationId: session.organizationId,
          status: { in: ['DRAFT', 'SENT'] },
        },
      });

      if (!order) {
        return NextResponse.json(
          { success: false, error: 'Orden no encontrada o no puede ser cancelada' },
          { status: 404 }
        );
      }

      await prisma.purchaseOrder.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          notes: reason ? `${order.notes || ''}\nCancelado: ${reason}` : order.notes,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Orden de compra cancelada',
      });
    }

    // Create new purchase order
    if (!body.supplierId || !body.warehouseId) {
      return NextResponse.json(
        { success: false, error: 'supplierId y warehouseId son requeridos' },
        { status: 400 }
      );
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Se requiere al menos un producto' },
        { status: 400 }
      );
    }

    // Generate order number
    const orderCount = await prisma.purchaseOrder.count({
      where: { organizationId: session.organizationId },
    });
    const orderNumber = `PO-${(orderCount + 1).toString().padStart(6, '0')}`;

    // Calculate totals
    let subtotal = 0;
    const itemsData = body.items.map((item: typeof body.items[number]) => {
      const itemLineTotal = item.quantity * (item.unitPrice || item.unitCost);
      subtotal += itemLineTotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice || item.unitCost,
        lineTotal: itemLineTotal,
        notes: item.notes || null,
      };
    });

    const taxAmount = body.taxAmount || 0;
    const total = subtotal + taxAmount;

    const order = await prisma.purchaseOrder.create({
      data: {
        organizationId: session.organizationId,
        orderNumber,
        supplierId: body.supplierId,
        warehouseId: body.warehouseId,
        status: 'DRAFT',
        expectedDate: body.expectedDate || body.expectedDeliveryDate ? new Date(body.expectedDate || body.expectedDeliveryDate) : null,
        subtotal,
        taxAmount,
        total,
        notes: body.notes || null,
        items: {
          create: itemsData,
        },
      },
      include: {
        supplier: {
          select: { id: true, code: true, name: true },
        },
        warehouse: {
          select: { id: true, code: true, name: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, sku: true, name: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: order,
      message: 'Orden de compra creada exitosamente',
    });
  } catch (error) {
    console.error('Purchase order error:', error);
    return NextResponse.json(
      { success: false, error: 'Error processing purchase order' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inventory/purchase-orders
 * Update a purchase order
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
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar órdenes de compra' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'ID de la orden es requerido' },
        { status: 400 }
      );
    }

    // Check order exists and is editable
    const existingOrder = await prisma.purchaseOrder.findFirst({
      where: {
        id: body.id,
        organizationId: session.organizationId,
        status: 'DRAFT',
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada o no puede ser editada' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.expectedDate !== undefined || body.expectedDeliveryDate !== undefined) {
      updateData.expectedDate = (body.expectedDate || body.expectedDeliveryDate) ? new Date(body.expectedDate || body.expectedDeliveryDate) : null;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;

    // Update items if provided
    if (body.items && Array.isArray(body.items)) {
      // Delete existing items and recreate
      await prisma.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: body.id },
      });

      let subtotal = 0;
      const itemsData = body.items.map((item: typeof body.items[number]) => {
        const itemLineTotal = item.quantity * (item.unitPrice || item.unitCost);
        subtotal += itemLineTotal;
        return {
          purchaseOrderId: body.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice || item.unitCost,
          lineTotal: itemLineTotal,
          notes: item.notes || null,
        };
      });

      await prisma.purchaseOrderItem.createMany({
        data: itemsData,
      });

      updateData.subtotal = subtotal;
      updateData.total = subtotal + (body.taxAmount || Number(existingOrder.taxAmount));
    }

    const order = await prisma.purchaseOrder.update({
      where: { id: body.id },
      data: updateData,
      include: {
        supplier: {
          select: { id: true, code: true, name: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, sku: true, name: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: order,
      message: 'Orden de compra actualizada',
    });
  } catch (error) {
    console.error('Purchase order update error:', error);
    return NextResponse.json(
      { success: false, error: 'Error updating purchase order' },
      { status: 500 }
    );
  }
}
