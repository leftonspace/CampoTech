/**
 * Receiving Service
 * Phase 12.4: Handle purchase order receiving
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type {
  PurchaseReceiving,
  CreateReceivingInput,
  ReceivingItemInput,
  PurchaseOrder,
} from './purchasing.types';
import { receivePurchaseOrderItems } from '../stock/inventory-level.service';

// ═══════════════════════════════════════════════════════════════════════════════
// RECEIVING NUMBER GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

async function generateReceivingNumber(organizationId: string): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  const count = await prisma.purchaseReceiving.count({
    where: {
      purchaseOrder: { organizationId },
      createdAt: {
        gte: new Date(today.setHours(0, 0, 0, 0)),
      },
    },
  });

  const sequence = (count + 1).toString().padStart(3, '0');
  return `REC-${dateStr}-${sequence}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECEIVING OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Receive items from a purchase order
 */
export async function receivePurchaseOrder(
  organizationId: string,
  input: CreateReceivingInput
): Promise<{ receiving: PurchaseReceiving; order: PurchaseOrder }> {
  const { purchaseOrderId, receivedById, notes, items } = input;

  // Get the purchase order
  const order = await prisma.purchaseOrder.findFirst({
    where: {
      id: purchaseOrderId,
      organizationId,
      status: { in: ['SENT', 'PARTIAL'] },
    },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
  });

  if (!order) {
    throw new Error('Orden de compra no encontrada o no está en estado para recibir');
  }

  // Validate items
  type OrderItemType = typeof order.items[number];
  const orderItemMap = new Map(order.items.map((i: OrderItemType) => [i.productId, i]));
  const receivingItems: Array<{
    productId: string;
    quantityExpected: number;
    quantityReceived: number;
    notes?: string;
  }> = [];

  for (const item of items) {
    const orderItem = orderItemMap.get(item.productId);
    if (!orderItem) {
      throw new Error(`Producto ${item.productId} no está en la orden de compra`);
    }

    const pendingQty = (orderItem.quantity as number) - (orderItem.quantityReceived as number);
    if (item.quantityReceived > pendingQty) {
      throw new Error(
        `Cantidad recibida (${item.quantityReceived}) excede la pendiente (${pendingQty}) para producto ${orderItem.product?.name}`
      );
    }

    receivingItems.push({
      productId: item.productId,
      quantityExpected: pendingQty,
      quantityReceived: item.quantityReceived,
      notes: item.notes,
    });
  }

  // Check for variance
  const hasVariance = receivingItems.some(
    (i: typeof receivingItems[number]) => i.quantityReceived !== i.quantityExpected
  );

  // Generate receiving number
  const receivingNumber = await generateReceivingNumber(organizationId);

  // Create receiving record
  const receiving = await prisma.purchaseReceiving.create({
    data: {
      purchaseOrderId,
      receivingNumber,
      receivedById: receivedById || null,
      receivedAt: new Date(),
      notes: notes || null,
      items: receivingItems as unknown as Prisma.InputJsonValue,
      hasVariance,
    },
  });

  // Update PO items with received quantities
  for (const item of receivingItems as typeof receivingItems) {
    await prisma.purchaseOrderItem.updateMany({
      where: {
        purchaseOrderId,
        productId: item.productId,
      },
      data: {
        quantityReceived: {
          increment: item.quantityReceived,
        },
      },
    });
  }

  // Update inventory levels
  type ReceivingItemType = typeof receivingItems[number];
  const inventoryItems = receivingItems
    .filter((i: ReceivingItemType) => i.quantityReceived > 0)
    .map((i: ReceivingItemType) => {
      const orderItem = orderItemMap.get(i.productId)!;
      return {
        productId: i.productId,
        quantity: i.quantityReceived,
        unitCost: Number(orderItem.unitPrice),
      };
    });

  await receivePurchaseOrderItems(
    organizationId,
    order.warehouseId,
    inventoryItems,
    purchaseOrderId,
    receivedById
  );

  // Update supplier last purchase date
  for (const item of inventoryItems as typeof inventoryItems) {
    await prisma.supplierProduct.updateMany({
      where: {
        supplierId: order.supplierId,
        productId: item.productId,
      },
      data: {
        lastPurchaseAt: new Date(),
      },
    });
  }

  // Check if order is fully received
  const updatedItems = await prisma.purchaseOrderItem.findMany({
    where: { purchaseOrderId },
  });

  type UpdatedItemType = typeof updatedItems[number];
  const allReceived = updatedItems.every(
    (i: UpdatedItemType) => i.quantityReceived >= i.quantity
  );
  const anyReceived = updatedItems.some((i: UpdatedItemType) => i.quantityReceived > 0);

  let newStatus = order.status;
  if (allReceived) {
    newStatus = 'RECEIVED';
  } else if (anyReceived) {
    newStatus = 'PARTIAL';
  }

  // Update order status and received date
  const updatedOrder = await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: {
      status: newStatus,
      receivedDate: allReceived ? new Date() : null,
    },
    include: {
      supplier: true,
      warehouse: true,
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
  });

  return {
    receiving: receiving as unknown as PurchaseReceiving,
    order: updatedOrder as unknown as PurchaseOrder,
  };
}

/**
 * Get receiving record by ID
 */
export async function getReceiving(
  organizationId: string,
  receivingId: string
): Promise<PurchaseReceiving | null> {
  const receiving = await prisma.purchaseReceiving.findFirst({
    where: {
      id: receivingId,
      purchaseOrder: { organizationId },
    },
    include: {
      purchaseOrder: {
        select: { id: true, orderNumber: true, supplierId: true },
      },
    },
  });

  return receiving as unknown as PurchaseReceiving | null;
}

/**
 * Get receiving by number
 */
export async function getReceivingByNumber(
  organizationId: string,
  receivingNumber: string
): Promise<PurchaseReceiving | null> {
  const receiving = await prisma.purchaseReceiving.findFirst({
    where: {
      receivingNumber,
      purchaseOrder: { organizationId },
    },
    include: {
      purchaseOrder: {
        select: { id: true, orderNumber: true, supplierId: true },
      },
    },
  });

  return receiving as unknown as PurchaseReceiving | null;
}

/**
 * Get receivings for a purchase order
 */
export async function getOrderReceivings(
  purchaseOrderId: string
): Promise<PurchaseReceiving[]> {
  const receivings = await prisma.purchaseReceiving.findMany({
    where: { purchaseOrderId },
    orderBy: { receivedAt: 'desc' },
  });

  return receivings as unknown as PurchaseReceiving[];
}

/**
 * Get recent receivings
 */
export async function getRecentReceivings(
  organizationId: string,
  limit: number = 20
): Promise<PurchaseReceiving[]> {
  const receivings = await prisma.purchaseReceiving.findMany({
    where: {
      purchaseOrder: { organizationId },
    },
    include: {
      purchaseOrder: {
        select: {
          id: true,
          orderNumber: true,
          supplier: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { receivedAt: 'desc' },
    take: limit,
  });

  return receivings as unknown as PurchaseReceiving[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK RECEIVE (full order)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quick receive - receive all pending items in full
 */
export async function quickReceiveOrder(
  organizationId: string,
  purchaseOrderId: string,
  receivedById?: string
): Promise<{ receiving: PurchaseReceiving; order: PurchaseOrder }> {
  const order = await prisma.purchaseOrder.findFirst({
    where: {
      id: purchaseOrderId,
      organizationId,
      status: { in: ['SENT', 'PARTIAL'] },
    },
    include: { items: true },
  });

  if (!order) {
    throw new Error('Orden de compra no encontrada o no está en estado para recibir');
  }

  // Build items to receive (all pending quantities)
  const items: ReceivingItemInput[] = order.items
    .filter((i: typeof order.items[number]) => i.quantity > i.quantityReceived)
    .map((i: typeof order.items[number]) => ({
      productId: i.productId,
      quantityReceived: i.quantity - i.quantityReceived,
    }));

  if (items.length === 0) {
    throw new Error('No hay items pendientes de recibir');
  }

  return receivePurchaseOrder(organizationId, {
    purchaseOrderId,
    receivedById,
    notes: 'Recepción completa',
    items,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECEIVING REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get receiving summary for a period
 */
export async function getReceivingSummary(
  organizationId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<{
  totalReceivings: number;
  totalItemsReceived: number;
  withVariance: number;
  bySupplier: Array<{
    supplierId: string;
    supplierName: string;
    receivingCount: number;
    itemCount: number;
  }>;
}> {
  const receivings = await prisma.purchaseReceiving.findMany({
    where: {
      purchaseOrder: { organizationId },
      receivedAt: { gte: dateFrom, lte: dateTo },
    },
    include: {
      purchaseOrder: {
        select: {
          supplierId: true,
          supplier: { select: { name: true } },
        },
      },
    },
  });

  let totalItemsReceived = 0;
  let withVariance = 0;
  const supplierStats: Record<
    string,
    { name: string; receivingCount: number; itemCount: number }
  > = {};

  for (const rec of receivings) {
    const items = rec.items as any[];
    const itemCount = items.reduce((sum: number, i: any) => sum + i.quantityReceived, 0);
    totalItemsReceived += itemCount;

    if (rec.hasVariance) {
      withVariance++;
    }

    const supplierId = rec.purchaseOrder.supplierId;
    if (!supplierStats[supplierId]) {
      supplierStats[supplierId] = {
        name: (rec.purchaseOrder.supplier as any)?.name || 'Unknown',
        receivingCount: 0,
        itemCount: 0,
      };
    }
    supplierStats[supplierId].receivingCount++;
    supplierStats[supplierId].itemCount += itemCount;
  }

  const bySupplier = (Object.entries(supplierStats) as [string, { name: string; receivingCount: number; itemCount: number }][])
    .map(([supplierId, data]: [string, { name: string; receivingCount: number; itemCount: number }]) => ({
      supplierId,
      supplierName: data.name,
      receivingCount: data.receivingCount,
      itemCount: data.itemCount,
    }))
    .sort((a: { itemCount: number }, b: { itemCount: number }) => b.itemCount - a.itemCount);

  return {
    totalReceivings: receivings.length,
    totalItemsReceived,
    withVariance,
    bySupplier,
  };
}

/**
 * Get receivings with variance (for quality control)
 */
export async function getReceivingsWithVariance(
  organizationId: string,
  limit: number = 50
): Promise<PurchaseReceiving[]> {
  const receivings = await prisma.purchaseReceiving.findMany({
    where: {
      purchaseOrder: { organizationId },
      hasVariance: true,
    },
    include: {
      purchaseOrder: {
        select: {
          id: true,
          orderNumber: true,
          supplier: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { receivedAt: 'desc' },
    take: limit,
  });

  return receivings as unknown as PurchaseReceiving[];
}
