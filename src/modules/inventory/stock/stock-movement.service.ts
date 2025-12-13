/**
 * Stock Movement Service
 * Phase 12.3: Track and record all stock movements
 */

import { prisma } from '@/lib/prisma';
import type {
  StockMovement,
  CreateMovementInput,
  MovementFilters,
  MovementListResult,
  MovementType,
  StockMovementReport,
} from './stock.types';

// ═══════════════════════════════════════════════════════════════════════════════
// MOVEMENT NUMBER GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate unique movement number
 */
export async function generateMovementNumber(organizationId: string): Promise<string> {
  const today = new Date();
  const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');

  // Get count of movements today
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const count = await prisma.stockMovement.count({
    where: {
      organizationId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const sequence = (count + 1).toString().padStart(4, '0');
  return `MOV-${datePrefix}-${sequence}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOVEMENT CRUD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a stock movement record
 */
export async function createMovement(input: CreateMovementInput): Promise<StockMovement> {
  const movementNumber = await generateMovementNumber(input.organizationId);

  const movement = await prisma.stockMovement.create({
    data: {
      organizationId: input.organizationId,
      productId: input.productId,
      variantId: input.variantId || null,
      movementNumber,
      movementType: input.movementType,
      quantity: input.quantity,
      direction: input.direction,
      fromWarehouseId: input.fromWarehouseId || null,
      toWarehouseId: input.toWarehouseId || null,
      jobId: input.jobId || null,
      purchaseOrderId: input.purchaseOrderId || null,
      inventoryCountId: input.inventoryCountId || null,
      unitCost: input.unitCost,
      totalCost: input.unitCost * input.quantity,
      reference: input.reference || null,
      notes: input.notes || null,
      performedById: input.performedById || null,
      performedAt: new Date(),
    },
    include: {
      product: true,
      fromWarehouse: true,
      toWarehouse: true,
    },
  });

  return movement as unknown as StockMovement;
}

/**
 * Get a movement by ID
 */
export async function getMovement(
  organizationId: string,
  movementId: string
): Promise<StockMovement | null> {
  const movement = await prisma.stockMovement.findFirst({
    where: {
      id: movementId,
      organizationId,
    },
    include: {
      product: true,
      variant: true,
      fromWarehouse: true,
      toWarehouse: true,
      job: true,
      purchaseOrder: true,
    },
  });

  return movement as unknown as StockMovement | null;
}

/**
 * Get movement by number
 */
export async function getMovementByNumber(
  organizationId: string,
  movementNumber: string
): Promise<StockMovement | null> {
  const movement = await prisma.stockMovement.findFirst({
    where: {
      organizationId,
      movementNumber,
    },
    include: {
      product: true,
      variant: true,
      fromWarehouse: true,
      toWarehouse: true,
    },
  });

  return movement as unknown as StockMovement | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOVEMENT LISTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * List movements with filters and pagination
 */
export async function listMovements(
  organizationId: string,
  filters: MovementFilters = {},
  options: { page?: number; pageSize?: number } = {}
): Promise<MovementListResult> {
  const { page = 1, pageSize = 50 } = options;

  const where: any = { organizationId };

  if (filters.productId) {
    where.productId = filters.productId;
  }

  if (filters.warehouseId) {
    where.OR = [
      { fromWarehouseId: filters.warehouseId },
      { toWarehouseId: filters.warehouseId },
    ];
  }

  if (filters.movementType) {
    where.movementType = filters.movementType;
  }

  if (filters.direction) {
    where.direction = filters.direction;
  }

  if (filters.jobId) {
    where.jobId = filters.jobId;
  }

  if (filters.purchaseOrderId) {
    where.purchaseOrderId = filters.purchaseOrderId;
  }

  if (filters.performedById) {
    where.performedById = filters.performedById;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.performedAt = {};
    if (filters.dateFrom) {
      where.performedAt.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.performedAt.lte = filters.dateTo;
    }
  }

  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        variant: { select: { id: true, name: true, sku: true } },
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        job: { select: { id: true, jobNumber: true } },
      },
      orderBy: { performedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    movements: movements as unknown as StockMovement[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get movements for a product
 */
export async function getProductMovements(
  organizationId: string,
  productId: string,
  options?: { dateFrom?: Date; dateTo?: Date; limit?: number }
): Promise<StockMovement[]> {
  const where: any = { organizationId, productId };

  if (options?.dateFrom || options?.dateTo) {
    where.performedAt = {};
    if (options.dateFrom) where.performedAt.gte = options.dateFrom;
    if (options.dateTo) where.performedAt.lte = options.dateTo;
  }

  const movements = await prisma.stockMovement.findMany({
    where,
    include: {
      fromWarehouse: { select: { id: true, name: true, code: true } },
      toWarehouse: { select: { id: true, name: true, code: true } },
      job: { select: { id: true, jobNumber: true } },
    },
    orderBy: { performedAt: 'desc' },
    take: options?.limit,
  });

  return movements as unknown as StockMovement[];
}

/**
 * Get movements for a warehouse
 */
export async function getWarehouseMovements(
  organizationId: string,
  warehouseId: string,
  options?: { dateFrom?: Date; dateTo?: Date; limit?: number }
): Promise<StockMovement[]> {
  const where: any = {
    organizationId,
    OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }],
  };

  if (options?.dateFrom || options?.dateTo) {
    where.performedAt = {};
    if (options.dateFrom) where.performedAt.gte = options.dateFrom;
    if (options.dateTo) where.performedAt.lte = options.dateTo;
  }

  const movements = await prisma.stockMovement.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, sku: true } },
      fromWarehouse: { select: { id: true, name: true, code: true } },
      toWarehouse: { select: { id: true, name: true, code: true } },
    },
    orderBy: { performedAt: 'desc' },
    take: options?.limit,
  });

  return movements as unknown as StockMovement[];
}

/**
 * Get movements for a job
 */
export async function getJobMovements(
  organizationId: string,
  jobId: string
): Promise<StockMovement[]> {
  const movements = await prisma.stockMovement.findMany({
    where: {
      organizationId,
      jobId,
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      fromWarehouse: { select: { id: true, name: true, code: true } },
      toWarehouse: { select: { id: true, name: true, code: true } },
    },
    orderBy: { performedAt: 'desc' },
  });

  return movements as unknown as StockMovement[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOVEMENT REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate stock movement report
 */
export async function generateMovementReport(
  organizationId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<StockMovementReport> {
  const movements = await prisma.stockMovement.findMany({
    where: {
      organizationId,
      performedAt: { gte: dateFrom, lte: dateTo },
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
  });

  // Calculate totals
  let totalIn = 0;
  let totalOut = 0;
  const byType: Record<
    MovementType,
    { count: number; quantity: number; value: number }
  > = {} as any;
  const productMovements: Record<
    string,
    { productId: string; productName: string; in: number; out: number }
  > = {};

  for (const mov of movements) {
    const qty = mov.quantity;
    const value = Number(mov.totalCost);

    if (mov.direction === 'IN') {
      totalIn += qty;
    } else {
      totalOut += qty;
    }

    // By type
    if (!byType[mov.movementType as MovementType]) {
      byType[mov.movementType as MovementType] = { count: 0, quantity: 0, value: 0 };
    }
    byType[mov.movementType as MovementType].count++;
    byType[mov.movementType as MovementType].quantity += qty;
    byType[mov.movementType as MovementType].value += value;

    // By product
    const product = mov.product as any;
    if (!productMovements[mov.productId]) {
      productMovements[mov.productId] = {
        productId: mov.productId,
        productName: product?.name || 'Unknown',
        in: 0,
        out: 0,
      };
    }
    if (mov.direction === 'IN') {
      productMovements[mov.productId].in += qty;
    } else {
      productMovements[mov.productId].out += qty;
    }
  }

  // Get top moved products
  type ProductMovementType = { productId: string; productName: string; in: number; out: number };
  const topMovedProducts = (Object.values(productMovements) as ProductMovementType[])
    .sort((a: ProductMovementType, b: ProductMovementType) => (b.in + b.out) - (a.in + a.out))
    .slice(0, 10)
    .map((p: ProductMovementType) => ({
      productId: p.productId,
      productName: p.productName,
      totalIn: p.in,
      totalOut: p.out,
    }));

  return {
    period: { from: dateFrom, to: dateTo },
    totalIn,
    totalOut,
    netChange: totalIn - totalOut,
    byType: (Object.entries(byType) as [string, { in: number; out: number }][]).map(([type, data]) => ({
      type: type as MovementType,
      ...data,
    })),
    topMovedProducts,
  };
}

/**
 * Get movement summary by type for a period
 */
export async function getMovementSummaryByType(
  organizationId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<Array<{ type: MovementType; count: number; totalQuantity: number }>> {
  const movements = await prisma.stockMovement.groupBy({
    by: ['movementType'],
    where: {
      organizationId,
      performedAt: { gte: dateFrom, lte: dateTo },
    },
    _count: true,
    _sum: { quantity: true },
  });

  return movements.map((m: typeof movements[number]) => ({
    type: m.movementType as MovementType,
    count: m._count,
    totalQuantity: m._sum.quantity || 0,
  }));
}

/**
 * Get daily movement totals
 */
export async function getDailyMovementTotals(
  organizationId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<Array<{ date: string; in: number; out: number }>> {
  const movements = await prisma.stockMovement.findMany({
    where: {
      organizationId,
      performedAt: { gte: dateFrom, lte: dateTo },
    },
    select: {
      performedAt: true,
      quantity: true,
      direction: true,
    },
  });

  // Group by date
  const dailyTotals: Record<string, { in: number; out: number }> = {};

  for (const mov of movements as typeof movements) {
    const dateKey = mov.performedAt.toISOString().slice(0, 10);
    if (!dailyTotals[dateKey]) {
      dailyTotals[dateKey] = { in: 0, out: 0 };
    }
    if (mov.direction === 'IN') {
      dailyTotals[dateKey].in += mov.quantity;
    } else {
      dailyTotals[dateKey].out += mov.quantity;
    }
  }

  return Object.entries(dailyTotals)
    .map(([date, totals]: [string, { in: number; out: number }]) => ({ date, ...totals }))
    .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOVEMENT REVERSAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reverse a stock movement (creates a new opposite movement)
 */
export async function reverseMovement(
  organizationId: string,
  movementId: string,
  reason: string,
  performedById?: string
): Promise<StockMovement> {
  const original = await prisma.stockMovement.findFirst({
    where: { id: movementId, organizationId },
  });

  if (!original) {
    throw new Error('Movimiento no encontrado');
  }

  // Create reverse movement
  const reverseDirection = original.direction === 'IN' ? 'OUT' : 'IN';
  const reverseType =
    original.direction === 'IN' ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN';

  const reverseMovement = await createMovement({
    organizationId,
    productId: original.productId,
    variantId: original.variantId,
    movementType: reverseType,
    quantity: original.quantity,
    direction: reverseDirection,
    fromWarehouseId: original.toWarehouseId,
    toWarehouseId: original.fromWarehouseId,
    unitCost: Number(original.unitCost),
    reference: `REV-${original.movementNumber}`,
    notes: `Reversión: ${reason}`,
    performedById,
  });

  return reverseMovement;
}
