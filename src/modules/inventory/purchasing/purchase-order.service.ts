/**
 * Purchase Order Service
 * Phase 12.4: Manage purchase orders
 */

import { prisma } from '@/lib/prisma';
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  AddPOItemInput,
  UpdatePOItemInput,
  POFilters,
  POListResult,
  POStatus,
  PurchasingStats,
} from './purchasing.types';

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER NUMBER GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

async function generateOrderNumber(organizationId: string): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');

  const count = await prisma.purchaseOrder.count({
    where: {
      organizationId,
      createdAt: {
        gte: new Date(year, today.getMonth(), 1),
      },
    },
  });

  const sequence = (count + 1).toString().padStart(4, '0');
  return `OC-${year}${month}-${sequence}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDER CRUD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a purchase order
 */
export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput
): Promise<PurchaseOrder> {
  const orderNumber = await generateOrderNumber(input.organizationId);

  // Calculate totals
  let subtotal = 0;
  let taxAmount = 0;

  const itemsData = input.items.map((item: typeof input.items[number]) => {
    const discount = item.discount || 0;
    const taxRate = item.taxRate ?? 21;
    const lineSubtotal = item.quantity * item.unitPrice * (1 - discount / 100);
    const lineTax = lineSubtotal * (taxRate / 100);

    subtotal += lineSubtotal;
    taxAmount += lineTax;

    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: discount,
      taxRate: taxRate,
      lineTotal: lineSubtotal + lineTax,
      notes: item.notes || null,
    };
  });

  const total = subtotal + taxAmount + (input.shippingCost || 0);

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      organizationId: input.organizationId,
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      orderNumber,
      status: 'DRAFT',
      orderDate: new Date(),
      expectedDate: input.expectedDate || null,
      subtotal,
      taxAmount,
      total,
      shippingMethod: input.shippingMethod || null,
      shippingCost: input.shippingCost || null,
      notes: input.notes || null,
      internalNotes: input.internalNotes || null,
      createdById: input.createdById || null,
      items: {
        create: itemsData,
      },
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

  return purchaseOrder as unknown as PurchaseOrder;
}

/**
 * Get purchase order by ID
 */
export async function getPurchaseOrder(
  organizationId: string,
  orderId: string
): Promise<PurchaseOrder | null> {
  const order = await prisma.purchaseOrder.findFirst({
    where: {
      id: orderId,
      organizationId,
    },
    include: {
      supplier: true,
      warehouse: true,
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, barcode: true } },
        },
      },
      receivings: true,
    },
  });

  return order as unknown as PurchaseOrder | null;
}

/**
 * Get purchase order by number
 */
export async function getPurchaseOrderByNumber(
  organizationId: string,
  orderNumber: string
): Promise<PurchaseOrder | null> {
  const order = await prisma.purchaseOrder.findFirst({
    where: {
      organizationId,
      orderNumber,
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

  return order as unknown as PurchaseOrder | null;
}

/**
 * Update purchase order
 */
export async function updatePurchaseOrder(
  organizationId: string,
  orderId: string,
  input: UpdatePurchaseOrderInput
): Promise<PurchaseOrder> {
  const existing = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, organizationId },
  });

  if (!existing) {
    throw new Error('Orden de compra no encontrada');
  }

  if (!['DRAFT', 'PENDING'].includes(existing.status)) {
    throw new Error('Solo se pueden modificar órdenes en estado Borrador o Pendiente');
  }

  const order = await prisma.purchaseOrder.update({
    where: { id: orderId },
    data: {
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      expectedDate: input.expectedDate,
      shippingMethod: input.shippingMethod,
      shippingCost: input.shippingCost,
      trackingNumber: input.trackingNumber,
      notes: input.notes,
      internalNotes: input.internalNotes,
    },
    include: {
      supplier: true,
      warehouse: true,
      items: true,
    },
  });

  return order as unknown as PurchaseOrder;
}

/**
 * Delete purchase order (only drafts)
 */
export async function deletePurchaseOrder(
  organizationId: string,
  orderId: string
): Promise<{ deleted: boolean }> {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, organizationId },
  });

  if (!order) {
    throw new Error('Orden de compra no encontrada');
  }

  if (order.status !== 'DRAFT') {
    throw new Error('Solo se pueden eliminar órdenes en estado Borrador');
  }

  // Delete items first
  await prisma.purchaseOrderItem.deleteMany({
    where: { purchaseOrderId: orderId },
  });

  await prisma.purchaseOrder.delete({
    where: { id: orderId },
  });

  return { deleted: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER ITEMS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add item to purchase order
 */
export async function addPurchaseOrderItem(
  organizationId: string,
  orderId: string,
  input: AddPOItemInput
): Promise<PurchaseOrderItem> {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, organizationId },
  });

  if (!order) {
    throw new Error('Orden de compra no encontrada');
  }

  if (!['DRAFT', 'PENDING'].includes(order.status)) {
    throw new Error('No se pueden agregar items a esta orden');
  }

  const discount = input.discount || 0;
  const taxRate = input.taxRate ?? 21;
  const lineSubtotal = input.quantity * input.unitPrice * (1 - discount / 100);
  const lineTax = lineSubtotal * (taxRate / 100);
  const lineTotal = lineSubtotal + lineTax;

  const item = await prisma.purchaseOrderItem.create({
    data: {
      purchaseOrderId: orderId,
      productId: input.productId,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      discount,
      taxRate,
      lineTotal,
      notes: input.notes || null,
    },
  });

  // Update order totals
  await recalculateOrderTotals(orderId);

  return item as unknown as PurchaseOrderItem;
}

/**
 * Update purchase order item
 */
export async function updatePurchaseOrderItem(
  organizationId: string,
  itemId: string,
  input: UpdatePOItemInput
): Promise<PurchaseOrderItem> {
  const item = await prisma.purchaseOrderItem.findUnique({
    where: { id: itemId },
    include: {
      purchaseOrder: true,
    },
  });

  if (!item || item.purchaseOrder.organizationId !== organizationId) {
    throw new Error('Item no encontrado');
  }

  if (!['DRAFT', 'PENDING'].includes(item.purchaseOrder.status)) {
    throw new Error('No se puede modificar este item');
  }

  const quantity = input.quantity ?? item.quantity;
  const unitPrice = input.unitPrice ?? Number(item.unitPrice);
  const discount = input.discount ?? Number(item.discount);
  const taxRate = input.taxRate ?? Number(item.taxRate);

  const lineSubtotal = quantity * unitPrice * (1 - discount / 100);
  const lineTax = lineSubtotal * (taxRate / 100);
  const lineTotal = lineSubtotal + lineTax;

  const updated = await prisma.purchaseOrderItem.update({
    where: { id: itemId },
    data: {
      quantity,
      unitPrice,
      discount,
      taxRate,
      lineTotal,
      notes: input.notes,
    },
  });

  // Update order totals
  await recalculateOrderTotals(item.purchaseOrderId);

  return updated as unknown as PurchaseOrderItem;
}

/**
 * Remove item from purchase order
 */
export async function removePurchaseOrderItem(
  organizationId: string,
  itemId: string
): Promise<void> {
  const item = await prisma.purchaseOrderItem.findUnique({
    where: { id: itemId },
    include: {
      purchaseOrder: true,
    },
  });

  if (!item || item.purchaseOrder.organizationId !== organizationId) {
    throw new Error('Item no encontrado');
  }

  if (!['DRAFT', 'PENDING'].includes(item.purchaseOrder.status)) {
    throw new Error('No se puede eliminar este item');
  }

  await prisma.purchaseOrderItem.delete({
    where: { id: itemId },
  });

  // Update order totals
  await recalculateOrderTotals(item.purchaseOrderId);
}

/**
 * Recalculate order totals
 */
async function recalculateOrderTotals(orderId: string): Promise<void> {
  const items = await prisma.purchaseOrderItem.findMany({
    where: { purchaseOrderId: orderId },
  });

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) return;

  let subtotal = 0;
  let taxAmount = 0;

  for (const item of items as typeof items) {
    const discount = Number(item.discount);
    const taxRate = Number(item.taxRate);
    const lineSubtotal = item.quantity * Number(item.unitPrice) * (1 - discount / 100);
    const lineTax = lineSubtotal * (taxRate / 100);

    subtotal += lineSubtotal;
    taxAmount += lineTax;
  }

  const total = subtotal + taxAmount + Number(order.shippingCost || 0);

  await prisma.purchaseOrder.update({
    where: { id: orderId },
    data: { subtotal, taxAmount, total },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Submit order for approval
 */
export async function submitForApproval(
  organizationId: string,
  orderId: string
): Promise<PurchaseOrder> {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, organizationId },
    include: { items: true },
  });

  if (!order) {
    throw new Error('Orden de compra no encontrada');
  }

  if (order.status !== 'DRAFT') {
    throw new Error('Solo se pueden enviar órdenes en estado Borrador');
  }

  if (order.items.length === 0) {
    throw new Error('La orden debe tener al menos un item');
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id: orderId },
    data: { status: 'PENDING' },
    include: { supplier: true, items: true },
  });

  return updated as unknown as PurchaseOrder;
}

/**
 * Approve order
 */
export async function approvePurchaseOrder(
  organizationId: string,
  orderId: string,
  approvedById: string
): Promise<PurchaseOrder> {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, organizationId },
  });

  if (!order) {
    throw new Error('Orden de compra no encontrada');
  }

  if (order.status !== 'PENDING') {
    throw new Error('Solo se pueden aprobar órdenes pendientes');
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id: orderId },
    data: {
      status: 'APPROVED',
      approvedById,
      approvedAt: new Date(),
    },
    include: { supplier: true, items: true },
  });

  return updated as unknown as PurchaseOrder;
}

/**
 * Mark order as sent to supplier
 */
export async function markAsSent(
  organizationId: string,
  orderId: string
): Promise<PurchaseOrder> {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, organizationId },
  });

  if (!order) {
    throw new Error('Orden de compra no encontrada');
  }

  if (order.status !== 'APPROVED') {
    throw new Error('Solo se pueden enviar órdenes aprobadas');
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id: orderId },
    data: { status: 'SENT' },
    include: { supplier: true, items: true },
  });

  // Update inventory levels - add to on order quantity
  const items = await prisma.purchaseOrderItem.findMany({
    where: { purchaseOrderId: orderId },
  });

  for (const item of items as typeof items) {
    await prisma.inventoryLevel.updateMany({
      where: {
        organizationId,
        productId: item.productId,
        warehouseId: order.warehouseId,
      },
      data: {
        quantityOnOrder: { increment: item.quantity },
      },
    });
  }

  return updated as unknown as PurchaseOrder;
}

/**
 * Cancel order
 */
export async function cancelPurchaseOrder(
  organizationId: string,
  orderId: string,
  reason?: string
): Promise<PurchaseOrder> {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, organizationId },
    include: { items: true },
  });

  if (!order) {
    throw new Error('Orden de compra no encontrada');
  }

  if (['RECEIVED', 'CANCELLED'].includes(order.status)) {
    throw new Error('Esta orden no puede ser cancelada');
  }

  // If order was sent, reduce on order quantities
  if (['SENT', 'PARTIAL'].includes(order.status)) {
    for (const item of order.items as typeof order.items) {
      const pendingQty = item.quantity - item.quantityReceived;
      if (pendingQty > 0) {
        await prisma.inventoryLevel.updateMany({
          where: {
            organizationId,
            productId: item.productId,
            warehouseId: order.warehouseId,
          },
          data: {
            quantityOnOrder: { decrement: pendingQty },
          },
        });
      }
    }
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id: orderId },
    data: {
      status: 'CANCELLED',
      notes: reason ? `${order.notes || ''}\nCancelado: ${reason}`.trim() : order.notes,
    },
    include: { supplier: true, items: true },
  });

  return updated as unknown as PurchaseOrder;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER LISTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * List purchase orders
 */
export async function listPurchaseOrders(
  organizationId: string,
  filters: POFilters = {},
  options: { page?: number; pageSize?: number } = {}
): Promise<POListResult> {
  const { page = 1, pageSize = 20 } = options;

  const where: any = { organizationId };

  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.status) where.status = filters.status;

  if (filters.dateFrom || filters.dateTo) {
    where.orderDate = {};
    if (filters.dateFrom) where.orderDate.gte = filters.dateFrom;
    if (filters.dateTo) where.orderDate.lte = filters.dateTo;
  }

  if (filters.search) {
    where.OR = [
      { orderNumber: { contains: filters.search, mode: 'insensitive' } },
      { supplier: { name: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  const [total, orders] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    orders: orders as unknown as PurchaseOrder[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get orders pending receipt
 */
export async function getPendingReceiptOrders(
  organizationId: string
): Promise<PurchaseOrder[]> {
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      organizationId,
      status: { in: ['SENT', 'PARTIAL'] },
    },
    include: {
      supplier: { select: { id: true, name: true } },
      warehouse: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
    orderBy: { expectedDate: 'asc' },
  });

  return orders as unknown as PurchaseOrder[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get purchasing statistics
 */
export async function getPurchasingStats(
  organizationId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<PurchasingStats> {
  const dateFilter: any = {};
  if (dateFrom) dateFilter.gte = dateFrom;
  if (dateTo) dateFilter.lte = dateTo;

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      organizationId,
      ...(dateFrom || dateTo ? { orderDate: dateFilter } : {}),
    },
    include: {
      supplier: { select: { id: true, name: true } },
    },
  });

  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o: typeof orders[number]) =>
    ['DRAFT', 'PENDING', 'APPROVED', 'SENT', 'PARTIAL'].includes(o.status)
  ).length;
  const totalValue = orders.reduce((sum: number, o: typeof orders[number]) => sum + Number(o.total), 0);
  const averageOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0;

  // By status
  const byStatus: Record<POStatus, number> = {
    DRAFT: 0,
    PENDING: 0,
    APPROVED: 0,
    SENT: 0,
    PARTIAL: 0,
    RECEIVED: 0,
    CANCELLED: 0,
  };

  for (const order of orders as typeof orders) {
    byStatus[order.status as POStatus]++;
  }

  // Top suppliers
  const supplierTotals: Record<string, { name: string; count: number; value: number }> = {};
  for (const order of orders) {
    if (!supplierTotals[order.supplierId]) {
      supplierTotals[order.supplierId] = {
        name: (order.supplier as any)?.name || 'Unknown',
        count: 0,
        value: 0,
      };
    }
    supplierTotals[order.supplierId].count++;
    supplierTotals[order.supplierId].value += Number(order.total);
  }

  const topSuppliers = (Object.entries(supplierTotals) as [string, { name: string; count: number; value: number }][])
    .map(([supplierId, data]: [string, { name: string; count: number; value: number }]) => ({
      supplierId,
      supplierName: data.name,
      orderCount: data.count,
      totalValue: data.value,
    }))
    .sort((a: { totalValue: number }, b: { totalValue: number }) => b.totalValue - a.totalValue)
    .slice(0, 5);

  return {
    totalOrders,
    pendingOrders,
    totalValue,
    averageOrderValue,
    topSuppliers,
    byStatus,
  };
}
