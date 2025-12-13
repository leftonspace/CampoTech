/**
 * Inventory Count Service
 * Phase 12.3: Physical inventory counting and reconciliation
 */

import { prisma } from '@/lib/prisma';
import type {
  InventoryCount,
  InventoryCountItem,
  CreateCountInput,
  CountItemUpdate,
  CountSummary,
  CountType,
  CountStatus,
} from './stock.types';
import { createMovement, generateMovementNumber } from './stock-movement.service';

// ═══════════════════════════════════════════════════════════════════════════════
// COUNT NUMBER GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate unique count number
 */
async function generateCountNumber(organizationId: string): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');

  const count = await prisma.inventoryCount.count({
    where: {
      organizationId,
      createdAt: {
        gte: new Date(year, today.getMonth(), 1),
      },
    },
  });

  const sequence = (count + 1).toString().padStart(4, '0');
  return `INV-${year}${month}-${sequence}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new inventory count
 */
export async function createInventoryCount(
  input: CreateCountInput
): Promise<InventoryCount> {
  const { organizationId, warehouseId, countType, scheduledAt, assignedToId, notes, productIds } =
    input;

  const countNumber = await generateCountNumber(organizationId);

  // Get products to count
  let productsToCount: Array<{ id: string; quantity: number }>;

  if (productIds && productIds.length > 0) {
    // Specific products (for cycle/spot counts)
    const levels = await prisma.inventoryLevel.findMany({
      where: {
        organizationId,
        warehouseId,
        productId: { in: productIds },
      },
      select: { productId: true, quantityOnHand: true },
    });
    type LevelType = typeof levels[number];
    productsToCount = levels.map((l: LevelType) => ({ id: l.productId, quantity: l.quantityOnHand }));
  } else {
    // All products in warehouse (for full counts)
    const levels = await prisma.inventoryLevel.findMany({
      where: { organizationId, warehouseId },
      select: { productId: true, quantityOnHand: true },
    });
    type LevelType = typeof levels[number];
    productsToCount = levels.map((l: LevelType) => ({ id: l.productId, quantity: l.quantityOnHand }));
  }

  // Create count with items
  const inventoryCount = await prisma.inventoryCount.create({
    data: {
      organizationId,
      warehouseId,
      countNumber,
      countType,
      status: 'DRAFT',
      scheduledAt: scheduledAt || null,
      assignedToId: assignedToId || null,
      notes: notes || null,
      totalItems: productsToCount.length,
      items: {
        create: productsToCount.map((p: typeof productsToCount[number]) => ({
          productId: p.id,
          expectedQty: p.quantity,
        })),
      },
    },
    include: {
      items: true,
      warehouse: true,
    },
  });

  return inventoryCount as unknown as InventoryCount;
}

/**
 * Get inventory count by ID
 */
export async function getInventoryCount(
  organizationId: string,
  countId: string
): Promise<InventoryCount | null> {
  const count = await prisma.inventoryCount.findFirst({
    where: {
      id: countId,
      organizationId,
    },
    include: {
      warehouse: true,
      items: {
        include: {
          inventoryCount: false,
        },
      },
    },
  });

  return count as unknown as InventoryCount | null;
}

/**
 * Get inventory count with items and product details
 */
export async function getInventoryCountWithDetails(
  organizationId: string,
  countId: string
): Promise<(InventoryCount & { items: InventoryCountItem[] }) | null> {
  const count = await prisma.inventoryCount.findFirst({
    where: {
      id: countId,
      organizationId,
    },
    include: {
      warehouse: true,
      items: true,
    },
  });

  if (!count) return null;

  // Get product details for items
  const productIds = count.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, sku: true, barcode: true },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  const itemsWithProducts = count.items.map((item: typeof count.items[number]) => ({
    ...item,
    product: productMap.get(item.productId),
  }));

  return {
    ...count,
    items: itemsWithProducts,
  } as unknown as InventoryCount & { items: InventoryCountItem[] };
}

/**
 * List inventory counts
 */
export async function listInventoryCounts(
  organizationId: string,
  options?: {
    warehouseId?: string;
    status?: CountStatus;
    countType?: CountType;
    page?: number;
    pageSize?: number;
  }
): Promise<{ counts: InventoryCount[]; total: number }> {
  const { warehouseId, status, countType, page = 1, pageSize = 20 } = options || {};

  const where: any = { organizationId };
  if (warehouseId) where.warehouseId = warehouseId;
  if (status) where.status = status;
  if (countType) where.countType = countType;

  const [total, counts] = await Promise.all([
    prisma.inventoryCount.count({ where }),
    prisma.inventoryCount.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { counts: counts as unknown as InventoryCount[], total };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNT WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start an inventory count
 */
export async function startInventoryCount(
  organizationId: string,
  countId: string
): Promise<InventoryCount> {
  const count = await prisma.inventoryCount.findFirst({
    where: {
      id: countId,
      organizationId,
      status: 'DRAFT',
    },
  });

  if (!count) {
    throw new Error('Conteo no encontrado o ya iniciado');
  }

  const updated = await prisma.inventoryCount.update({
    where: { id: countId },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
    include: { warehouse: true },
  });

  return updated as unknown as InventoryCount;
}

/**
 * Update count items (record physical counts)
 */
export async function updateCountItems(
  organizationId: string,
  countId: string,
  updates: CountItemUpdate[]
): Promise<{ updated: number }> {
  const count = await prisma.inventoryCount.findFirst({
    where: {
      id: countId,
      organizationId,
      status: 'IN_PROGRESS',
    },
  });

  if (!count) {
    throw new Error('Conteo no encontrado o no está en progreso');
  }

  let updated = 0;

  for (const update of updates as typeof updates) {
    const item = await prisma.inventoryCountItem.findFirst({
      where: {
        id: update.itemId,
        inventoryCountId: countId,
      },
    });

    if (!item) continue;

    const variance = update.countedQty - item.expectedQty;

    // Get product for variance value calculation
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
    });

    const varianceValue = product ? variance * Number(product.costPrice) : 0;

    await prisma.inventoryCountItem.update({
      where: { id: update.itemId },
      data: {
        countedQty: update.countedQty,
        variance,
        varianceValue,
        notes: update.notes || null,
        countedAt: new Date(),
      },
    });

    updated++;
  }

  return { updated };
}

/**
 * Complete counting and move to review
 */
export async function completeCountingPhase(
  organizationId: string,
  countId: string,
  completedById?: string
): Promise<InventoryCount> {
  const count = await prisma.inventoryCount.findFirst({
    where: {
      id: countId,
      organizationId,
      status: 'IN_PROGRESS',
    },
    include: { items: true },
  });

  if (!count) {
    throw new Error('Conteo no encontrado o no está en progreso');
  }

  // Check all items have been counted
  const uncountedItems = count.items.filter((i: typeof count.items[number]) => i.countedQty === null);
  if (uncountedItems.length > 0) {
    throw new Error(`Hay ${uncountedItems.length} items sin contar`);
  }

  // Calculate summary
  type ItemType = typeof count.items[number];
  const matchedItems = count.items.filter((i: ItemType) => i.variance === 0).length;
  const varianceItems = count.items.filter((i: ItemType) => i.variance !== 0).length;
  const totalVariance = count.items.reduce(
    (sum: number, i: ItemType) => sum + Number(i.varianceValue || 0),
    0
  );

  const updated = await prisma.inventoryCount.update({
    where: { id: countId },
    data: {
      status: 'PENDING_REVIEW',
      completedAt: new Date(),
      completedById: completedById || null,
      matchedItems,
      varianceItems,
      totalVariance,
    },
    include: { warehouse: true },
  });

  return updated as unknown as InventoryCount;
}

/**
 * Approve count and apply adjustments
 */
export async function approveInventoryCount(
  organizationId: string,
  countId: string,
  approvedById: string
): Promise<{ count: InventoryCount; adjustmentsApplied: number }> {
  const count = await prisma.inventoryCount.findFirst({
    where: {
      id: countId,
      organizationId,
      status: 'PENDING_REVIEW',
    },
    include: { items: true },
  });

  if (!count) {
    throw new Error('Conteo no encontrado o no está pendiente de aprobación');
  }

  // Apply adjustments for items with variance
  let adjustmentsApplied = 0;

  for (const item of count.items as typeof count.items) {
    if (item.variance === null || item.variance === 0) continue;

    // Get inventory level
    const level = await prisma.inventoryLevel.findFirst({
      where: {
        organizationId,
        productId: item.productId,
        warehouseId: count.warehouseId,
      },
    });

    if (!level) continue;

    const product = await prisma.product.findUnique({
      where: { id: item.productId },
    });

    const unitCost = product ? Number(product.costPrice) : Number(level.unitCost);

    // Create adjustment movement
    const movementType = item.variance > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    const direction = item.variance > 0 ? 'IN' : 'OUT';
    const absVariance = Math.abs(item.variance);

    await createMovement({
      organizationId,
      productId: item.productId,
      movementType: 'COUNT_ADJUSTMENT',
      quantity: absVariance,
      direction,
      toWarehouseId: item.variance > 0 ? count.warehouseId : undefined,
      fromWarehouseId: item.variance < 0 ? count.warehouseId : undefined,
      inventoryCountId: countId,
      unitCost,
      notes: `Ajuste por conteo ${count.countNumber}`,
      performedById: approvedById,
    });

    // Update inventory level
    const newOnHand = level.quantityOnHand + item.variance;
    await prisma.inventoryLevel.update({
      where: { id: level.id },
      data: {
        quantityOnHand: newOnHand,
        quantityAvailable: newOnHand - level.quantityReserved,
        totalCost: newOnHand * unitCost,
        lastCountedAt: new Date(),
        lastMovementAt: new Date(),
      },
    });

    adjustmentsApplied++;
  }

  // Update count status
  const updated = await prisma.inventoryCount.update({
    where: { id: countId },
    data: {
      status: 'APPROVED',
      approvedById,
      approvedAt: new Date(),
    },
    include: { warehouse: true },
  });

  return {
    count: updated as unknown as InventoryCount,
    adjustmentsApplied,
  };
}

/**
 * Cancel an inventory count
 */
export async function cancelInventoryCount(
  organizationId: string,
  countId: string,
  reason?: string
): Promise<InventoryCount> {
  const count = await prisma.inventoryCount.findFirst({
    where: {
      id: countId,
      organizationId,
      status: { in: ['DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW'] },
    },
  });

  if (!count) {
    throw new Error('Conteo no encontrado o ya finalizado');
  }

  const updated = await prisma.inventoryCount.update({
    where: { id: countId },
    data: {
      status: 'CANCELLED',
      notes: reason ? `${count.notes || ''}\nCancelado: ${reason}`.trim() : count.notes,
    },
  });

  return updated as unknown as InventoryCount;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNT SUMMARY & REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get count summary
 */
export async function getCountSummary(
  organizationId: string,
  countId: string
): Promise<CountSummary | null> {
  const count = await prisma.inventoryCount.findFirst({
    where: {
      id: countId,
      organizationId,
    },
    include: { items: true },
  });

  if (!count) return null;

  const totalItems = count.items.length;
  type ItemType = typeof count.items[number];
  const countedItems = count.items.filter((i: ItemType) => i.countedQty !== null).length;
  const matchedItems = count.items.filter((i: ItemType) => i.variance === 0).length;
  const varianceItems = count.items.filter((i: ItemType) => i.variance !== null && i.variance !== 0)
    .length;
  const totalVarianceValue = count.items.reduce(
    (sum: number, i: ItemType) => sum + Math.abs(Number(i.varianceValue || 0)),
    0
  );
  const progress = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;

  return {
    countId: count.id,
    countNumber: count.countNumber,
    status: count.status as CountStatus,
    totalItems,
    countedItems,
    matchedItems,
    varianceItems,
    totalVarianceValue,
    progress,
  };
}

/**
 * Get count history for a warehouse
 */
export async function getWarehouseCountHistory(
  organizationId: string,
  warehouseId: string,
  limit: number = 10
): Promise<InventoryCount[]> {
  const counts = await prisma.inventoryCount.findMany({
    where: {
      organizationId,
      warehouseId,
      status: 'APPROVED',
    },
    orderBy: { approvedAt: 'desc' },
    take: limit,
  });

  return counts as unknown as InventoryCount[];
}

/**
 * Get products that need counting (not counted recently)
 */
export async function getProductsNeedingCount(
  organizationId: string,
  warehouseId: string,
  daysSinceLastCount: number = 90
): Promise<Array<{ productId: string; productName: string; lastCounted: Date | null }>> {
  const threshold = new Date(Date.now() - daysSinceLastCount * 24 * 60 * 60 * 1000);

  const levels = await prisma.inventoryLevel.findMany({
    where: {
      organizationId,
      warehouseId,
      OR: [{ lastCountedAt: null }, { lastCountedAt: { lt: threshold } }],
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
    orderBy: { lastCountedAt: 'asc' },
  });

  return levels.map((l: typeof levels[number]) => ({
    productId: l.productId,
    productName: (l.product as any)?.name || 'Unknown',
    lastCounted: l.lastCountedAt,
  }));
}
