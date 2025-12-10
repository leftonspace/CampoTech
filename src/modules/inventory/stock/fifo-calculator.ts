/**
 * FIFO Cost Calculator
 * Phase 12.3: First-In-First-Out inventory costing
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface InventoryLayer {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedAt: Date;
  sourceType: 'PURCHASE' | 'ADJUSTMENT' | 'RETURN' | 'INITIAL';
  sourceReference?: string;
}

export interface FIFOCostResult {
  totalQuantity: number;
  totalCost: number;
  averageCost: number;
  layers: InventoryLayer[];
}

export interface CostingResult {
  quantityCosted: number;
  totalCost: number;
  averageCost: number;
  layersUsed: Array<{
    layerId: string;
    quantityUsed: number;
    unitCost: number;
    totalCost: number;
  }>;
  remainingQuantity: number;
}

export interface StockValuation {
  productId: string;
  productName: string;
  sku: string;
  totalQuantity: number;
  totalValue: number;
  averageCost: number;
  oldestLayerDate: Date | null;
  newestLayerDate: Date | null;
  layerCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIFO LAYER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add a new inventory layer (when receiving stock)
 */
export async function addInventoryLayer(
  organizationId: string,
  productId: string,
  warehouseId: string,
  quantity: number,
  unitCost: number,
  sourceType: InventoryLayer['sourceType'],
  sourceReference?: string
): Promise<InventoryLayer> {
  const layer = await prisma.inventoryLayer.create({
    data: {
      organizationId,
      productId,
      warehouseId,
      quantity,
      remainingQty: quantity,
      unitCost,
      totalCost: quantity * unitCost,
      sourceType,
      sourceReference: sourceReference || null,
      receivedAt: new Date(),
    },
  });

  return {
    id: layer.id,
    productId: layer.productId,
    warehouseId: layer.warehouseId,
    quantity: layer.remainingQty,
    unitCost: Number(layer.unitCost),
    totalCost: Number(layer.totalCost),
    receivedAt: layer.receivedAt,
    sourceType: layer.sourceType as InventoryLayer['sourceType'],
    sourceReference: layer.sourceReference || undefined,
  };
}

/**
 * Get all inventory layers for a product (FIFO order - oldest first)
 */
export async function getInventoryLayers(
  organizationId: string,
  productId: string,
  warehouseId?: string
): Promise<InventoryLayer[]> {
  const whereClause: any = {
    organizationId,
    productId,
    remainingQty: { gt: 0 },
  };

  if (warehouseId) {
    whereClause.warehouseId = warehouseId;
  }

  const layers = await prisma.inventoryLayer.findMany({
    where: whereClause,
    orderBy: { receivedAt: 'asc' }, // FIFO: oldest first
  });

  return layers.map(layer => ({
    id: layer.id,
    productId: layer.productId,
    warehouseId: layer.warehouseId,
    quantity: layer.remainingQty,
    unitCost: Number(layer.unitCost),
    totalCost: layer.remainingQty * Number(layer.unitCost),
    receivedAt: layer.receivedAt,
    sourceType: layer.sourceType as InventoryLayer['sourceType'],
    sourceReference: layer.sourceReference || undefined,
  }));
}

/**
 * Calculate FIFO cost for current inventory
 */
export async function calculateFIFOCost(
  organizationId: string,
  productId: string,
  warehouseId?: string
): Promise<FIFOCostResult> {
  const layers = await getInventoryLayers(organizationId, productId, warehouseId);

  const totalQuantity = layers.reduce((sum, l) => sum + l.quantity, 0);
  const totalCost = layers.reduce((sum, l) => sum + l.totalCost, 0);
  const averageCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;

  return {
    totalQuantity,
    totalCost: Math.round(totalCost * 100) / 100,
    averageCost: Math.round(averageCost * 100) / 100,
    layers,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIFO COSTING FOR CONSUMPTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate cost for consuming inventory using FIFO
 * Does NOT actually deduct from layers - use consumeInventoryFIFO for that
 */
export async function calculateConsumptionCost(
  organizationId: string,
  productId: string,
  quantity: number,
  warehouseId?: string
): Promise<CostingResult> {
  const layers = await getInventoryLayers(organizationId, productId, warehouseId);

  let remainingToConsume = quantity;
  let totalCost = 0;
  const layersUsed: CostingResult['layersUsed'] = [];

  for (const layer of layers) {
    if (remainingToConsume <= 0) break;

    const quantityFromLayer = Math.min(layer.quantity, remainingToConsume);
    const costFromLayer = quantityFromLayer * layer.unitCost;

    layersUsed.push({
      layerId: layer.id,
      quantityUsed: quantityFromLayer,
      unitCost: layer.unitCost,
      totalCost: costFromLayer,
    });

    totalCost += costFromLayer;
    remainingToConsume -= quantityFromLayer;
  }

  const quantityCosted = quantity - remainingToConsume;

  return {
    quantityCosted,
    totalCost: Math.round(totalCost * 100) / 100,
    averageCost: quantityCosted > 0 ? Math.round((totalCost / quantityCosted) * 100) / 100 : 0,
    layersUsed,
    remainingQuantity: remainingToConsume,
  };
}

/**
 * Consume inventory using FIFO - updates layer quantities
 */
export async function consumeInventoryFIFO(
  organizationId: string,
  productId: string,
  quantity: number,
  warehouseId?: string,
  reference?: string
): Promise<CostingResult> {
  const costResult = await calculateConsumptionCost(
    organizationId,
    productId,
    quantity,
    warehouseId
  );

  if (costResult.remainingQuantity > 0) {
    throw new Error(
      `Stock insuficiente. Disponible: ${costResult.quantityCosted}, Solicitado: ${quantity}`
    );
  }

  // Update layers in database
  for (const layerUsage of costResult.layersUsed) {
    await prisma.inventoryLayer.update({
      where: { id: layerUsage.layerId },
      data: {
        remainingQty: { decrement: layerUsage.quantityUsed },
        totalCost: { decrement: layerUsage.totalCost },
      },
    });

    // Record the consumption for audit
    await prisma.inventoryLayerConsumption.create({
      data: {
        layerId: layerUsage.layerId,
        quantityConsumed: layerUsage.quantityUsed,
        unitCost: layerUsage.unitCost,
        totalCost: layerUsage.totalCost,
        reference: reference || null,
        consumedAt: new Date(),
      },
    });
  }

  return costResult;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALUATION & REPORTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get stock valuation for a product
 */
export async function getProductValuation(
  organizationId: string,
  productId: string
): Promise<StockValuation> {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
    select: { id: true, name: true, sku: true },
  });

  if (!product) {
    throw new Error('Producto no encontrado');
  }

  const layers = await getInventoryLayers(organizationId, productId);

  const totalQuantity = layers.reduce((sum, l) => sum + l.quantity, 0);
  const totalValue = layers.reduce((sum, l) => sum + l.totalCost, 0);

  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    totalQuantity,
    totalValue: Math.round(totalValue * 100) / 100,
    averageCost: totalQuantity > 0 ? Math.round((totalValue / totalQuantity) * 100) / 100 : 0,
    oldestLayerDate: layers.length > 0 ? layers[0].receivedAt : null,
    newestLayerDate: layers.length > 0 ? layers[layers.length - 1].receivedAt : null,
    layerCount: layers.length,
  };
}

/**
 * Get total inventory valuation
 */
export async function getTotalInventoryValuation(
  organizationId: string,
  warehouseId?: string
): Promise<{
  totalValue: number;
  totalItems: number;
  byCategory: Array<{ categoryId: string | null; categoryName: string; value: number }>;
  byWarehouse: Array<{ warehouseId: string; warehouseName: string; value: number }>;
}> {
  const whereClause: any = {
    organizationId,
    remainingQty: { gt: 0 },
  };

  if (warehouseId) {
    whereClause.warehouseId = warehouseId;
  }

  const layers = await prisma.inventoryLayer.findMany({
    where: whereClause,
    include: {
      product: {
        select: {
          categoryId: true,
          category: { select: { name: true } },
        },
      },
      warehouse: {
        select: { id: true, name: true },
      },
    },
  });

  // Calculate totals
  let totalValue = 0;
  const byCategory = new Map<string | null, { name: string; value: number }>();
  const byWarehouse = new Map<string, { name: string; value: number }>();

  for (const layer of layers) {
    const layerValue = layer.remainingQty * Number(layer.unitCost);
    totalValue += layerValue;

    // By category
    const catId = layer.product.categoryId;
    const catName = layer.product.category?.name || 'Sin categoría';
    const existing = byCategory.get(catId) || { name: catName, value: 0 };
    existing.value += layerValue;
    byCategory.set(catId, existing);

    // By warehouse
    const whId = layer.warehouse.id;
    const whName = layer.warehouse.name;
    const existingWh = byWarehouse.get(whId) || { name: whName, value: 0 };
    existingWh.value += layerValue;
    byWarehouse.set(whId, existingWh);
  }

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    totalItems: layers.length,
    byCategory: Array.from(byCategory.entries()).map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      value: Math.round(data.value * 100) / 100,
    })),
    byWarehouse: Array.from(byWarehouse.entries()).map(([warehouseId, data]) => ({
      warehouseId,
      warehouseName: data.name,
      value: Math.round(data.value * 100) / 100,
    })),
  };
}

/**
 * Get aging analysis of inventory (for slow-moving stock identification)
 */
export async function getInventoryAgingAnalysis(
  organizationId: string,
  productId?: string
): Promise<{
  ageRanges: Array<{
    range: string;
    dayMin: number;
    dayMax: number | null;
    quantity: number;
    value: number;
    productCount: number;
  }>;
  oldestStock: Array<{
    productId: string;
    productName: string;
    sku: string;
    daysOld: number;
    quantity: number;
    value: number;
  }>;
}> {
  const now = new Date();
  const whereClause: any = {
    organizationId,
    remainingQty: { gt: 0 },
  };

  if (productId) {
    whereClause.productId = productId;
  }

  const layers = await prisma.inventoryLayer.findMany({
    where: whereClause,
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
    orderBy: { receivedAt: 'asc' },
  });

  // Define age ranges
  const ranges = [
    { range: '0-30 días', dayMin: 0, dayMax: 30, quantity: 0, value: 0, products: new Set<string>() },
    { range: '31-60 días', dayMin: 31, dayMax: 60, quantity: 0, value: 0, products: new Set<string>() },
    { range: '61-90 días', dayMin: 61, dayMax: 90, quantity: 0, value: 0, products: new Set<string>() },
    { range: '91-180 días', dayMin: 91, dayMax: 180, quantity: 0, value: 0, products: new Set<string>() },
    { range: 'Más de 180 días', dayMin: 181, dayMax: null, quantity: 0, value: 0, products: new Set<string>() },
  ];

  const oldestByProduct = new Map<string, { product: any; daysOld: number; quantity: number; value: number }>();

  for (const layer of layers) {
    const daysOld = Math.floor((now.getTime() - layer.receivedAt.getTime()) / (1000 * 60 * 60 * 24));
    const layerValue = layer.remainingQty * Number(layer.unitCost);

    // Find matching range
    for (const range of ranges) {
      if (daysOld >= range.dayMin && (range.dayMax === null || daysOld <= range.dayMax)) {
        range.quantity += layer.remainingQty;
        range.value += layerValue;
        range.products.add(layer.productId);
        break;
      }
    }

    // Track oldest by product
    const existing = oldestByProduct.get(layer.productId);
    if (!existing || daysOld > existing.daysOld) {
      oldestByProduct.set(layer.productId, {
        product: layer.product,
        daysOld,
        quantity: layer.remainingQty,
        value: layerValue,
      });
    }
  }

  // Sort oldest stock by age
  const oldestStock = Array.from(oldestByProduct.values())
    .sort((a, b) => b.daysOld - a.daysOld)
    .slice(0, 20)
    .map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      sku: item.product.sku,
      daysOld: item.daysOld,
      quantity: item.quantity,
      value: Math.round(item.value * 100) / 100,
    }));

  return {
    ageRanges: ranges.map(r => ({
      range: r.range,
      dayMin: r.dayMin,
      dayMax: r.dayMax,
      quantity: r.quantity,
      value: Math.round(r.value * 100) / 100,
      productCount: r.products.size,
    })),
    oldestStock,
  };
}

/**
 * Calculate weighted average cost (alternative to FIFO)
 */
export async function calculateWeightedAverageCost(
  organizationId: string,
  productId: string,
  warehouseId?: string
): Promise<{ averageCost: number; totalQuantity: number; totalValue: number }> {
  const fifoResult = await calculateFIFOCost(organizationId, productId, warehouseId);
  return {
    averageCost: fifoResult.averageCost,
    totalQuantity: fifoResult.totalQuantity,
    totalValue: fifoResult.totalCost,
  };
}
