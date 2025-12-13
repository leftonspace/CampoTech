/**
 * Inventory Level Service
 * Phase 12.3: Manage inventory levels across warehouses
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type {
  InventoryLevel,
  AdjustInventoryInput,
  TransferStockInput,
  StockLevelSummary,
  Warehouse,
  CreateWarehouseInput,
  UpdateWarehouseInput,
  StorageLocation,
  CreateStorageLocationInput,
} from './stock.types';
import { createMovement, generateMovementNumber } from './stock-movement.service';

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY LEVEL QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get inventory level for a product at a specific warehouse
 */
export async function getInventoryLevel(
  organizationId: string,
  productId: string,
  warehouseId: string,
  variantId?: string | null,
  lotNumber?: string | null
): Promise<InventoryLevel | null> {
  const level = await prisma.inventoryLevel.findFirst({
    where: {
      organizationId,
      productId,
      warehouseId,
      variantId: variantId || null,
      lotNumber: lotNumber || null,
    },
  });

  return level as InventoryLevel | null;
}

/**
 * Get all inventory levels for a product across all warehouses
 */
export async function getProductInventoryLevels(
  organizationId: string,
  productId: string,
  variantId?: string | null
): Promise<InventoryLevel[]> {
  const levels = await prisma.inventoryLevel.findMany({
    where: {
      organizationId,
      productId,
      variantId: variantId || undefined,
    },
    include: {
      warehouse: true,
      storageLocation: true,
    },
  });

  return levels as InventoryLevel[];
}

/**
 * Get all inventory levels for a warehouse
 */
export async function getWarehouseInventoryLevels(
  organizationId: string,
  warehouseId: string
): Promise<InventoryLevel[]> {
  const levels = await prisma.inventoryLevel.findMany({
    where: {
      organizationId,
      warehouseId,
    },
    include: {
      product: true,
      variant: true,
      storageLocation: true,
    },
    orderBy: {
      product: { name: 'asc' },
    },
  });

  return levels as InventoryLevel[];
}

/**
 * Get stock level summary for a product
 */
export async function getStockLevelSummary(
  organizationId: string,
  productId: string
): Promise<StockLevelSummary | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
    include: {
      inventoryLevels: {
        include: { warehouse: true },
      },
    },
  });

  if (!product) return null;

  const levels = product.inventoryLevels;
  type LevelType = typeof levels[number];
  const totalOnHand = levels.reduce((sum: number, l: LevelType) => sum + l.quantityOnHand, 0);
  const totalReserved = levels.reduce((sum: number, l: LevelType) => sum + l.quantityReserved, 0);
  const totalAvailable = levels.reduce((sum: number, l: LevelType) => sum + l.quantityAvailable, 0);
  const totalOnOrder = levels.reduce((sum: number, l: LevelType) => sum + l.quantityOnOrder, 0);

  let status: 'OK' | 'LOW' | 'OUT' | 'OVERSTOCK';
  if (totalAvailable <= 0) {
    status = 'OUT';
  } else if (totalOnHand <= product.minStockLevel) {
    status = 'LOW';
  } else if (product.maxStockLevel && totalOnHand > product.maxStockLevel) {
    status = 'OVERSTOCK';
  } else {
    status = 'OK';
  }

  type LevelType2 = typeof levels[number];
  const warehouseBreakdown = levels.map((l: LevelType2) => ({
    warehouseId: l.warehouseId,
    warehouseName: (l as any).warehouse?.name || 'Unknown',
    onHand: l.quantityOnHand,
    reserved: l.quantityReserved,
    available: l.quantityAvailable,
  }));

  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    totalOnHand,
    totalReserved,
    totalAvailable,
    totalOnOrder,
    minStockLevel: product.minStockLevel,
    maxStockLevel: product.maxStockLevel,
    reorderQty: product.reorderQty,
    status,
    warehouseBreakdown,
  };
}

/**
 * Get available quantity for a product at a warehouse
 */
export async function getAvailableQuantity(
  organizationId: string,
  productId: string,
  warehouseId: string,
  variantId?: string | null
): Promise<number> {
  const level = await getInventoryLevel(organizationId, productId, warehouseId, variantId);
  return level?.quantityAvailable ?? 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY ADJUSTMENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Adjust inventory level (add or remove stock)
 */
export async function adjustInventory(
  input: AdjustInventoryInput
): Promise<{ level: InventoryLevel; movementId: string }> {
  const {
    organizationId,
    productId,
    variantId,
    warehouseId,
    storageLocationId,
    quantity,
    reason,
    notes,
    unitCost,
    performedById,
    lotNumber,
  } = input;

  // Get or create inventory level
  let level = await prisma.inventoryLevel.findFirst({
    where: {
      organizationId,
      productId,
      warehouseId,
      variantId: variantId || null,
      storageLocationId: storageLocationId || null,
      lotNumber: lotNumber || null,
    },
  });

  // Get product for default cost
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  const cost = unitCost ?? (product ? Number(product.costPrice) : 0);
  const isIncrease = reason === 'ADJUSTMENT_IN' || reason === 'INITIAL_STOCK';
  const direction = isIncrease ? 'IN' : 'OUT';
  const absQuantity = Math.abs(quantity);

  // Validate removal doesn't go negative (unless warehouse allows)
  if (!isIncrease && level) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse?.allowNegative && level.quantityAvailable < absQuantity) {
      throw new Error(
        `Stock insuficiente. Disponible: ${level.quantityAvailable}, Solicitado: ${absQuantity}`
      );
    }
  }

  // Create movement record
  const movementNumber = await generateMovementNumber(organizationId);
  const movement = await createMovement({
    organizationId,
    productId,
    variantId,
    movementType: reason,
    quantity: absQuantity,
    direction,
    toWarehouseId: isIncrease ? warehouseId : undefined,
    fromWarehouseId: isIncrease ? undefined : warehouseId,
    unitCost: cost,
    notes,
    performedById,
  });

  // Update or create inventory level
  if (level) {
    const newOnHand = isIncrease
      ? level.quantityOnHand + absQuantity
      : level.quantityOnHand - absQuantity;
    const newAvailable = newOnHand - level.quantityReserved;
    const newTotalCost = newOnHand * cost;

    level = await prisma.inventoryLevel.update({
      where: { id: level.id },
      data: {
        quantityOnHand: newOnHand,
        quantityAvailable: newAvailable,
        unitCost: cost,
        totalCost: newTotalCost,
        lastMovementAt: new Date(),
      },
    });
  } else if (isIncrease) {
    level = await prisma.inventoryLevel.create({
      data: {
        organizationId,
        productId,
        variantId: variantId || null,
        warehouseId,
        storageLocationId: storageLocationId || null,
        quantityOnHand: absQuantity,
        quantityReserved: 0,
        quantityOnOrder: 0,
        quantityAvailable: absQuantity,
        lotNumber: lotNumber || null,
        unitCost: cost,
        totalCost: absQuantity * cost,
        lastMovementAt: new Date(),
      },
    });
  } else {
    throw new Error('No se puede reducir stock que no existe');
  }

  return { level: level as InventoryLevel, movementId: movement.id };
}

/**
 * Transfer stock between warehouses
 */
export async function transferStock(
  input: TransferStockInput
): Promise<{ fromLevel: InventoryLevel; toLevel: InventoryLevel; movementId: string }> {
  const {
    organizationId,
    productId,
    variantId,
    fromWarehouseId,
    toWarehouseId,
    quantity,
    notes,
    performedById,
  } = input;

  if (fromWarehouseId === toWarehouseId) {
    throw new Error('El almacén origen y destino no pueden ser el mismo');
  }

  // Get source level
  const fromLevel = await prisma.inventoryLevel.findFirst({
    where: {
      organizationId,
      productId,
      warehouseId: fromWarehouseId,
      variantId: variantId || null,
    },
  });

  if (!fromLevel || fromLevel.quantityAvailable < quantity) {
    throw new Error(
      `Stock insuficiente en almacén origen. Disponible: ${fromLevel?.quantityAvailable ?? 0}`
    );
  }

  const unitCost = Number(fromLevel.unitCost);

  // Create transfer movement
  const movementNumber = await generateMovementNumber(organizationId);
  const movement = await createMovement({
    organizationId,
    productId,
    variantId,
    movementType: 'TRANSFER',
    quantity,
    direction: 'OUT', // Primary direction for the record
    fromWarehouseId,
    toWarehouseId,
    unitCost,
    notes,
    performedById,
  });

  // Update source inventory
  const updatedFromLevel = await prisma.inventoryLevel.update({
    where: { id: fromLevel.id },
    data: {
      quantityOnHand: fromLevel.quantityOnHand - quantity,
      quantityAvailable: fromLevel.quantityAvailable - quantity,
      totalCost: (fromLevel.quantityOnHand - quantity) * unitCost,
      lastMovementAt: new Date(),
    },
  });

  // Get or create destination level
  let toLevel = await prisma.inventoryLevel.findFirst({
    where: {
      organizationId,
      productId,
      warehouseId: toWarehouseId,
      variantId: variantId || null,
    },
  });

  if (toLevel) {
    toLevel = await prisma.inventoryLevel.update({
      where: { id: toLevel.id },
      data: {
        quantityOnHand: toLevel.quantityOnHand + quantity,
        quantityAvailable: toLevel.quantityAvailable + quantity,
        unitCost,
        totalCost: (toLevel.quantityOnHand + quantity) * unitCost,
        lastMovementAt: new Date(),
      },
    });
  } else {
    toLevel = await prisma.inventoryLevel.create({
      data: {
        organizationId,
        productId,
        variantId: variantId || null,
        warehouseId: toWarehouseId,
        quantityOnHand: quantity,
        quantityReserved: 0,
        quantityOnOrder: 0,
        quantityAvailable: quantity,
        unitCost,
        totalCost: quantity * unitCost,
        lastMovementAt: new Date(),
      },
    });
  }

  return {
    fromLevel: updatedFromLevel as InventoryLevel,
    toLevel: toLevel as InventoryLevel,
    movementId: movement.id,
  };
}

/**
 * Receive purchase order items into inventory
 */
export async function receivePurchaseOrderItems(
  organizationId: string,
  warehouseId: string,
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
    lotNumber?: string;
  }>,
  purchaseOrderId: string,
  performedById?: string
): Promise<{ levelsUpdated: number; movementIds: string[] }> {
  const movementIds: string[] = [];

  for (const item of items) {
    const movementNumber = await generateMovementNumber(organizationId);
    const movement = await createMovement({
      organizationId,
      productId: item.productId,
      movementType: 'PURCHASE_RECEIPT',
      quantity: item.quantity,
      direction: 'IN',
      toWarehouseId: warehouseId,
      purchaseOrderId,
      unitCost: item.unitCost,
      performedById,
    });
    movementIds.push(movement.id);

    // Update or create inventory level
    const existingLevel = await prisma.inventoryLevel.findFirst({
      where: {
        organizationId,
        productId: item.productId,
        warehouseId,
        variantId: null,
        lotNumber: item.lotNumber || null,
      },
    });

    if (existingLevel) {
      const newOnHand = existingLevel.quantityOnHand + item.quantity;
      await prisma.inventoryLevel.update({
        where: { id: existingLevel.id },
        data: {
          quantityOnHand: newOnHand,
          quantityAvailable: newOnHand - existingLevel.quantityReserved,
          quantityOnOrder: Math.max(0, existingLevel.quantityOnOrder - item.quantity),
          unitCost: item.unitCost,
          totalCost: newOnHand * item.unitCost,
          lastMovementAt: new Date(),
        },
      });
    } else {
      await prisma.inventoryLevel.create({
        data: {
          organizationId,
          productId: item.productId,
          warehouseId,
          quantityOnHand: item.quantity,
          quantityReserved: 0,
          quantityOnOrder: 0,
          quantityAvailable: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.quantity * item.unitCost,
          lotNumber: item.lotNumber || null,
          lastMovementAt: new Date(),
        },
      });
    }
  }

  return { levelsUpdated: items.length, movementIds };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAREHOUSE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a warehouse
 */
export async function createWarehouse(input: CreateWarehouseInput): Promise<Warehouse> {
  // Check code uniqueness
  const existing = await prisma.warehouse.findFirst({
    where: {
      organizationId: input.organizationId,
      code: input.code,
    },
  });
  if (existing) {
    throw new Error(`Ya existe un almacén con el código "${input.code}"`);
  }

  // If this is the first warehouse or marked as default, ensure no other defaults
  if (input.isDefault) {
    await prisma.warehouse.updateMany({
      where: { organizationId: input.organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const warehouse = await prisma.warehouse.create({
    data: {
      organizationId: input.organizationId,
      locationId: input.locationId || null,
      code: input.code.toUpperCase(),
      name: input.name,
      type: input.type || 'MAIN',
      address: input.address as Prisma.InputJsonValue,
      contactName: input.contactName || null,
      contactPhone: input.contactPhone || null,
      contactEmail: input.contactEmail || null,
      isDefault: input.isDefault ?? false,
      allowNegative: input.allowNegative ?? false,
    },
  });

  return warehouse as Warehouse;
}

/**
 * Get warehouse by ID
 */
export async function getWarehouse(
  organizationId: string,
  warehouseId: string
): Promise<Warehouse | null> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, organizationId },
    include: { location: true },
  });

  return warehouse as Warehouse | null;
}

/**
 * Get all warehouses for an organization
 */
export async function getAllWarehouses(
  organizationId: string,
  includeInactive: boolean = false
): Promise<Warehouse[]> {
  const warehouses = await prisma.warehouse.findMany({
    where: {
      organizationId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: { location: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });

  return warehouses as Warehouse[];
}

/**
 * Get default warehouse
 */
export async function getDefaultWarehouse(organizationId: string): Promise<Warehouse | null> {
  const warehouse = await prisma.warehouse.findFirst({
    where: {
      organizationId,
      isDefault: true,
      isActive: true,
    },
  });

  // Fallback to first active warehouse if no default
  if (!warehouse) {
    return prisma.warehouse.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'asc' },
    }) as Promise<Warehouse | null>;
  }

  return warehouse as Warehouse;
}

/**
 * Update a warehouse
 */
export async function updateWarehouse(
  organizationId: string,
  warehouseId: string,
  input: UpdateWarehouseInput
): Promise<Warehouse> {
  const existing = await prisma.warehouse.findFirst({
    where: { id: warehouseId, organizationId },
  });
  if (!existing) {
    throw new Error('Almacén no encontrado');
  }

  // Check code uniqueness if changing
  if (input.code && input.code !== existing.code) {
    const codeExists = await prisma.warehouse.findFirst({
      where: {
        organizationId,
        code: input.code,
        id: { not: warehouseId },
      },
    });
    if (codeExists) {
      throw new Error(`Ya existe un almacén con el código "${input.code}"`);
    }
  }

  // Handle default flag
  if (input.isDefault === true) {
    await prisma.warehouse.updateMany({
      where: { organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const warehouse = await prisma.warehouse.update({
    where: { id: warehouseId },
    data: {
      locationId: input.locationId,
      code: input.code?.toUpperCase(),
      name: input.name,
      type: input.type,
      address: input.address as Prisma.InputJsonValue,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      isDefault: input.isDefault,
      allowNegative: input.allowNegative,
      isActive: input.isActive,
    },
  });

  return warehouse as Warehouse;
}

/**
 * Delete a warehouse
 */
export async function deleteWarehouse(
  organizationId: string,
  warehouseId: string
): Promise<{ deleted: boolean }> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, organizationId },
    include: {
      _count: {
        select: { inventoryLevels: true, stockMovementsFrom: true, stockMovementsTo: true },
      },
    },
  });

  if (!warehouse) {
    throw new Error('Almacén no encontrado');
  }

  const hasHistory =
    warehouse._count.inventoryLevels > 0 ||
    warehouse._count.stockMovementsFrom > 0 ||
    warehouse._count.stockMovementsTo > 0;

  if (hasHistory) {
    // Soft delete
    await prisma.warehouse.update({
      where: { id: warehouseId },
      data: { isActive: false },
    });
  } else {
    // Hard delete
    await prisma.warehouse.delete({
      where: { id: warehouseId },
    });
  }

  return { deleted: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE LOCATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a storage location
 */
export async function createStorageLocation(
  input: CreateStorageLocationInput
): Promise<StorageLocation> {
  // Check code uniqueness
  const existing = await prisma.storageLocation.findFirst({
    where: {
      warehouseId: input.warehouseId,
      code: input.code,
    },
  });
  if (existing) {
    throw new Error(`Ya existe una ubicación con el código "${input.code}"`);
  }

  const location = await prisma.storageLocation.create({
    data: {
      warehouseId: input.warehouseId,
      code: input.code.toUpperCase(),
      name: input.name || null,
      description: input.description || null,
      sortOrder: input.sortOrder ?? 0,
    },
  });

  return location as StorageLocation;
}

/**
 * Get storage locations for a warehouse
 */
export async function getWarehouseStorageLocations(
  warehouseId: string
): Promise<StorageLocation[]> {
  const locations = await prisma.storageLocation.findMany({
    where: { warehouseId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });

  return locations as StorageLocation[];
}

/**
 * Delete a storage location
 */
export async function deleteStorageLocation(locationId: string): Promise<{ deleted: boolean }> {
  const location = await prisma.storageLocation.findUnique({
    where: { id: locationId },
    include: {
      _count: { select: { inventoryLevels: true } },
    },
  });

  if (!location) {
    throw new Error('Ubicación no encontrada');
  }

  if (location._count.inventoryLevels > 0) {
    // Soft delete
    await prisma.storageLocation.update({
      where: { id: locationId },
      data: { isActive: false },
    });
  } else {
    await prisma.storageLocation.delete({
      where: { id: locationId },
    });
  }

  return { deleted: true };
}
