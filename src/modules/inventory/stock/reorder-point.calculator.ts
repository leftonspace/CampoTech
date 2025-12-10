/**
 * Reorder Point Calculator
 * Phase 12.3: Automatic reorder point calculation and purchase order suggestions
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReorderPointCalculation {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  reorderPoint: number;
  safetyStock: number;
  reorderQuantity: number;
  averageDailyUsage: number;
  leadTimeDays: number;
  daysUntilReorder: number | null;
  isAtReorderPoint: boolean;
  isCritical: boolean;
}

export interface ReorderSuggestion {
  productId: string;
  productName: string;
  sku: string;
  suggestedQuantity: number;
  currentStock: number;
  reorderPoint: number;
  supplierId?: string;
  supplierName?: string;
  estimatedCost: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ReorderSettings {
  defaultLeadTimeDays: number;
  defaultSafetyStockDays: number;
  usageWindowDays: number; // Days to consider for average usage calculation
}

const DEFAULT_SETTINGS: ReorderSettings = {
  defaultLeadTimeDays: 7,
  defaultSafetyStockDays: 3,
  usageWindowDays: 30,
};

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULATOR FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate reorder point for a single product
 */
export async function calculateReorderPoint(
  organizationId: string,
  productId: string,
  settings: Partial<ReorderSettings> = {}
): Promise<ReorderPointCalculation> {
  const config = { ...DEFAULT_SETTINGS, ...settings };

  // Get product details
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
    select: {
      id: true,
      name: true,
      sku: true,
      minStockLevel: true,
      maxStockLevel: true,
      reorderQty: true,
      leadTimeDays: true,
    },
  });

  if (!product) {
    throw new Error('Producto no encontrado');
  }

  // Get current stock
  const stockLevels = await prisma.inventoryLevel.findMany({
    where: { productId, organizationId },
  });
  const currentStock = stockLevels.reduce((sum, l) => sum + l.quantityAvailable, 0);

  // Calculate average daily usage from stock movements
  const usageStartDate = new Date();
  usageStartDate.setDate(usageStartDate.getDate() - config.usageWindowDays);

  const usageMovements = await prisma.stockMovement.aggregate({
    where: {
      organizationId,
      productId,
      direction: 'OUT',
      movementType: { in: ['SALE', 'ADJUSTMENT_OUT', 'SCRAP'] },
      performedAt: { gte: usageStartDate },
    },
    _sum: { quantity: true },
  });

  const totalUsage = usageMovements._sum.quantity || 0;
  const averageDailyUsage = totalUsage / config.usageWindowDays;

  // Calculate reorder point components
  const leadTimeDays = product.leadTimeDays || config.defaultLeadTimeDays;
  const safetyStock = Math.ceil(averageDailyUsage * config.defaultSafetyStockDays);
  const reorderPoint = product.minStockLevel || Math.ceil(averageDailyUsage * leadTimeDays + safetyStock);

  // Calculate reorder quantity (Economic Order Quantity simplified)
  const reorderQuantity = product.reorderQty || Math.max(
    Math.ceil(averageDailyUsage * leadTimeDays * 2),
    product.minStockLevel || 10
  );

  // Calculate days until reorder needed
  let daysUntilReorder: number | null = null;
  if (averageDailyUsage > 0) {
    daysUntilReorder = Math.floor((currentStock - reorderPoint) / averageDailyUsage);
    if (daysUntilReorder < 0) daysUntilReorder = 0;
  }

  const isAtReorderPoint = currentStock <= reorderPoint;
  const isCritical = currentStock <= safetyStock;

  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    currentStock,
    reorderPoint,
    safetyStock,
    reorderQuantity,
    averageDailyUsage: Math.round(averageDailyUsage * 100) / 100,
    leadTimeDays,
    daysUntilReorder,
    isAtReorderPoint,
    isCritical,
  };
}

/**
 * Get all products at or below reorder point
 */
export async function getProductsAtReorderPoint(
  organizationId: string,
  settings: Partial<ReorderSettings> = {}
): Promise<ReorderPointCalculation[]> {
  // Get all active products
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      isActive: true,
      trackInventory: true,
    },
    select: { id: true },
  });

  const results: ReorderPointCalculation[] = [];

  for (const product of products) {
    try {
      const calc = await calculateReorderPoint(organizationId, product.id, settings);
      if (calc.isAtReorderPoint) {
        results.push(calc);
      }
    } catch {
      // Skip products with errors
    }
  }

  // Sort by priority (critical first, then by days until reorder)
  return results.sort((a, b) => {
    if (a.isCritical && !b.isCritical) return -1;
    if (!a.isCritical && b.isCritical) return 1;
    return (a.daysUntilReorder || 0) - (b.daysUntilReorder || 0);
  });
}

/**
 * Generate reorder suggestions with supplier info
 */
export async function generateReorderSuggestions(
  organizationId: string,
  settings: Partial<ReorderSettings> = {}
): Promise<ReorderSuggestion[]> {
  const productsAtReorder = await getProductsAtReorderPoint(organizationId, settings);
  const suggestions: ReorderSuggestion[] = [];

  for (const product of productsAtReorder) {
    // Find preferred supplier
    const supplierProduct = await prisma.supplierProduct.findFirst({
      where: {
        productId: product.productId,
        supplier: { organizationId, isActive: true },
        isPreferred: true,
      },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });

    // Fallback to any active supplier if no preferred
    const supplier = supplierProduct || await prisma.supplierProduct.findFirst({
      where: {
        productId: product.productId,
        supplier: { organizationId, isActive: true },
      },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });

    const unitCost = supplier ? Number(supplier.unitCost) : 0;
    const suggestedQty = product.reorderQuantity;

    // Determine priority
    let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (product.isCritical) {
      priority = 'CRITICAL';
    } else if (product.daysUntilReorder !== null && product.daysUntilReorder <= 3) {
      priority = 'HIGH';
    } else if (product.isAtReorderPoint) {
      priority = 'MEDIUM';
    }

    suggestions.push({
      productId: product.productId,
      productName: product.productName,
      sku: product.sku,
      suggestedQuantity: suggestedQty,
      currentStock: product.currentStock,
      reorderPoint: product.reorderPoint,
      supplierId: supplier?.supplier.id,
      supplierName: supplier?.supplier.name,
      estimatedCost: suggestedQty * unitCost,
      priority,
    });
  }

  // Sort by priority
  const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/**
 * Auto-create purchase orders for products at reorder point
 * Groups by supplier
 */
export async function autoCreatePurchaseOrders(
  organizationId: string,
  options: {
    minPriority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    onlyPreferredSuppliers?: boolean;
    asDraft?: boolean;
  } = {}
): Promise<{ ordersCreated: number; itemsOrdered: number; totalValue: number }> {
  const { minPriority = 'MEDIUM', asDraft = true } = options;
  const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const minPriorityValue = priorityOrder[minPriority];

  const suggestions = await generateReorderSuggestions(organizationId);
  const filteredSuggestions = suggestions.filter(
    s => priorityOrder[s.priority] <= minPriorityValue && s.supplierId
  );

  // Group by supplier
  const bySupplier = new Map<string, ReorderSuggestion[]>();
  for (const suggestion of filteredSuggestions) {
    if (suggestion.supplierId) {
      const existing = bySupplier.get(suggestion.supplierId) || [];
      existing.push(suggestion);
      bySupplier.set(suggestion.supplierId, existing);
    }
  }

  let ordersCreated = 0;
  let itemsOrdered = 0;
  let totalValue = 0;

  // Create PO for each supplier
  for (const [supplierId, items] of bySupplier.entries()) {
    const subtotal = items.reduce((sum, i) => sum + i.estimatedCost, 0);

    // Generate order number
    const lastOrder = await prisma.purchaseOrder.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true },
    });
    const lastNum = lastOrder?.orderNumber
      ? parseInt(lastOrder.orderNumber.replace('PO-', ''))
      : 0;
    const orderNumber = `PO-${String(lastNum + 1).padStart(6, '0')}`;

    await prisma.purchaseOrder.create({
      data: {
        organizationId,
        supplierId,
        orderNumber,
        status: asDraft ? 'DRAFT' : 'PENDING_APPROVAL',
        subtotal,
        taxAmount: 0,
        shippingCost: 0,
        totalAmount: subtotal,
        notes: 'Auto-generado por sistema de reorden automático',
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.suggestedQuantity,
            receivedQty: 0,
            unitCost: item.estimatedCost / item.suggestedQuantity,
            lineTotal: item.estimatedCost,
          })),
        },
      },
    });

    ordersCreated++;
    itemsOrdered += items.length;
    totalValue += subtotal;
  }

  return { ordersCreated, itemsOrdered, totalValue };
}

/**
 * Update product reorder settings based on historical data
 */
export async function optimizeReorderSettings(
  organizationId: string,
  productId: string,
  lookbackDays: number = 90
): Promise<{ minStockLevel: number; reorderQty: number; leadTimeDays: number }> {
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

  // Calculate average daily usage
  const usageMovements = await prisma.stockMovement.aggregate({
    where: {
      organizationId,
      productId,
      direction: 'OUT',
      movementType: { in: ['SALE', 'ADJUSTMENT_OUT'] },
      performedAt: { gte: lookbackDate },
    },
    _sum: { quantity: true },
    _count: true,
  });

  const totalUsage = usageMovements._sum.quantity || 0;
  const averageDailyUsage = totalUsage / lookbackDays;

  // Calculate average lead time from purchase orders
  const completedOrders = await prisma.purchaseOrder.findMany({
    where: {
      organizationId,
      status: 'RECEIVED',
      items: { some: { productId } },
      createdAt: { gte: lookbackDate },
    },
    select: {
      createdAt: true,
      receivedAt: true,
    },
  });

  let avgLeadTimeDays = 7; // Default
  if (completedOrders.length > 0) {
    const leadTimes = completedOrders
      .filter(o => o.receivedAt)
      .map(o => Math.ceil((o.receivedAt!.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    if (leadTimes.length > 0) {
      avgLeadTimeDays = Math.ceil(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length);
    }
  }

  // Calculate recommended values
  const safetyStockDays = 3;
  const minStockLevel = Math.ceil(averageDailyUsage * (avgLeadTimeDays + safetyStockDays));
  const reorderQty = Math.max(Math.ceil(averageDailyUsage * avgLeadTimeDays * 2), minStockLevel);

  return {
    minStockLevel: Math.max(minStockLevel, 1),
    reorderQty: Math.max(reorderQty, 1),
    leadTimeDays: avgLeadTimeDays,
  };
}

/**
 * Get reorder point dashboard summary
 */
export async function getReorderDashboard(
  organizationId: string
): Promise<{
  criticalCount: number;
  atReorderCount: number;
  suggestions: ReorderSuggestion[];
  totalEstimatedCost: number;
}> {
  const suggestions = await generateReorderSuggestions(organizationId);

  const criticalCount = suggestions.filter(s => s.priority === 'CRITICAL').length;
  const atReorderCount = suggestions.length;
  const totalEstimatedCost = suggestions.reduce((sum, s) => sum + s.estimatedCost, 0);

  return {
    criticalCount,
    atReorderCount,
    suggestions: suggestions.slice(0, 10), // Top 10 suggestions
    totalEstimatedCost,
  };
}
