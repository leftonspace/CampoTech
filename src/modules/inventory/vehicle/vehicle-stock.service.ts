/**
 * Vehicle Stock Service
 * Phase 12.5: Manage technician vehicle inventory
 */

import { prisma } from '@/lib/prisma';
import type {
  VehicleStock,
  SetVehicleStockInput,
  UpdateVehicleStockInput,
  VehicleStockSummary,
  LoadVehicleInput,
  UnloadVehicleInput,
  LoadUnloadResult,
  TechnicianStockReport,
  FleetStockReport,
} from './vehicle-stock.types';
import { createMovement, generateMovementNumber } from '../stock/stock-movement.service';

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE STOCK MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get technician's vehicle stock
 */
export async function getTechnicianStock(
  organizationId: string,
  technicianId: string
): Promise<VehicleStock[]> {
  const stock = await prisma.vehicleStock.findMany({
    where: {
      organizationId,
      technicianId,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          costPrice: true,
          salePrice: true,
        },
      },
      technician: {
        select: { id: true, name: true, phone: true },
      },
    },
    orderBy: { product: { name: 'asc' } },
  });

  return stock as unknown as VehicleStock[];
}

/**
 * Get vehicle stock for a specific product
 */
export async function getVehicleStockItem(
  organizationId: string,
  technicianId: string,
  productId: string
): Promise<VehicleStock | null> {
  const stock = await prisma.vehicleStock.findFirst({
    where: {
      organizationId,
      technicianId,
      productId,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          costPrice: true,
          salePrice: true,
        },
      },
    },
  });

  return stock as VehicleStock | null;
}

/**
 * Set vehicle stock (create or update)
 */
export async function setVehicleStock(
  input: SetVehicleStockInput
): Promise<VehicleStock> {
  const { organizationId, technicianId, productId, quantity, minLevel, maxLevel } = input;

  const existing = await prisma.vehicleStock.findFirst({
    where: { technicianId, productId },
  });

  let stock;
  if (existing) {
    stock = await prisma.vehicleStock.update({
      where: { id: existing.id },
      data: {
        quantity,
        minLevel: minLevel ?? existing.minLevel,
        maxLevel: maxLevel ?? existing.maxLevel,
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, costPrice: true, salePrice: true },
        },
      },
    });
  } else {
    stock = await prisma.vehicleStock.create({
      data: {
        organizationId,
        technicianId,
        productId,
        quantity,
        minLevel: minLevel ?? 0,
        maxLevel: maxLevel ?? null,
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, costPrice: true, salePrice: true },
        },
      },
    });
  }

  return stock as unknown as VehicleStock;
}

/**
 * Update vehicle stock item
 */
export async function updateVehicleStock(
  vehicleStockId: string,
  input: UpdateVehicleStockInput
): Promise<VehicleStock> {
  const stock = await prisma.vehicleStock.update({
    where: { id: vehicleStockId },
    data: {
      quantity: input.quantity,
      minLevel: input.minLevel,
      maxLevel: input.maxLevel,
    },
    include: {
      product: {
        select: { id: true, name: true, sku: true, costPrice: true, salePrice: true },
      },
    },
  });

  return stock as unknown as VehicleStock;
}

/**
 * Remove product from vehicle stock
 */
export async function removeFromVehicleStock(
  technicianId: string,
  productId: string
): Promise<void> {
  await prisma.vehicleStock.deleteMany({
    where: { technicianId, productId },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD/UNLOAD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load items to technician's vehicle from warehouse
 */
export async function loadVehicle(input: LoadVehicleInput): Promise<LoadUnloadResult> {
  const { organizationId, technicianId, warehouseId, items, notes, performedById } = input;

  const result: LoadUnloadResult = {
    success: true,
    itemsProcessed: 0,
    movementIds: [],
    errors: [],
  };

  for (const item of items) {
    try {
      // Check warehouse has enough stock
      const level = await prisma.inventoryLevel.findFirst({
        where: {
          organizationId,
          productId: item.productId,
          warehouseId,
        },
      });

      if (!level || level.quantityAvailable < item.quantity) {
        result.errors.push({
          productId: item.productId,
          error: `Stock insuficiente. Disponible: ${level?.quantityAvailable ?? 0}`,
        });
        continue;
      }

      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      const unitCost = product ? Number(product.costPrice) : 0;

      // Create movement record
      const movement = await createMovement({
        organizationId,
        productId: item.productId,
        movementType: 'VEHICLE_LOAD',
        quantity: item.quantity,
        direction: 'OUT',
        fromWarehouseId: warehouseId,
        unitCost,
        notes: notes || `Carga a vehículo de técnico ${technicianId}`,
        performedById,
      });

      result.movementIds.push(movement.id);

      // Reduce warehouse stock
      await prisma.inventoryLevel.update({
        where: { id: level.id },
        data: {
          quantityOnHand: level.quantityOnHand - item.quantity,
          quantityAvailable: level.quantityAvailable - item.quantity,
          totalCost: (level.quantityOnHand - item.quantity) * Number(level.unitCost),
          lastMovementAt: new Date(),
        },
      });

      // Add to vehicle stock
      const existingVehicleStock = await prisma.vehicleStock.findFirst({
        where: { technicianId, productId: item.productId },
      });

      if (existingVehicleStock) {
        await prisma.vehicleStock.update({
          where: { id: existingVehicleStock.id },
          data: {
            quantity: existingVehicleStock.quantity + item.quantity,
            lastRefilledAt: new Date(),
          },
        });
      } else {
        await prisma.vehicleStock.create({
          data: {
            organizationId,
            technicianId,
            productId: item.productId,
            quantity: item.quantity,
            minLevel: 0,
            lastRefilledAt: new Date(),
          },
        });
      }

      result.itemsProcessed++;
    } catch (error) {
      result.errors.push({
        productId: item.productId,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Unload items from technician's vehicle to warehouse
 */
export async function unloadVehicle(input: UnloadVehicleInput): Promise<LoadUnloadResult> {
  const { organizationId, technicianId, warehouseId, items, notes, performedById } = input;

  const result: LoadUnloadResult = {
    success: true,
    itemsProcessed: 0,
    movementIds: [],
    errors: [],
  };

  for (const item of items) {
    try {
      // Check vehicle has enough stock
      const vehicleStock = await prisma.vehicleStock.findFirst({
        where: { technicianId, productId: item.productId },
      });

      if (!vehicleStock || vehicleStock.quantity < item.quantity) {
        result.errors.push({
          productId: item.productId,
          error: `Stock insuficiente en vehículo. Disponible: ${vehicleStock?.quantity ?? 0}`,
        });
        continue;
      }

      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      const unitCost = product ? Number(product.costPrice) : 0;

      // Determine movement type based on reason
      const movementType =
        item.reason === 'damaged' || item.reason === 'expired'
          ? 'SCRAP'
          : 'VEHICLE_RETURN';

      // Create movement record
      const movement = await createMovement({
        organizationId,
        productId: item.productId,
        movementType,
        quantity: item.quantity,
        direction: 'IN',
        toWarehouseId: warehouseId,
        unitCost,
        notes:
          notes || `Devolución de vehículo de técnico ${technicianId}${item.reason ? ` (${item.reason})` : ''}`,
        performedById,
      });

      result.movementIds.push(movement.id);

      // Reduce vehicle stock
      const newQty = vehicleStock.quantity - item.quantity;
      if (newQty <= 0) {
        await prisma.vehicleStock.delete({
          where: { id: vehicleStock.id },
        });
      } else {
        await prisma.vehicleStock.update({
          where: { id: vehicleStock.id },
          data: { quantity: newQty },
        });
      }

      // Add to warehouse stock (except for damaged/expired)
      if (item.reason !== 'damaged' && item.reason !== 'expired') {
        const level = await prisma.inventoryLevel.findFirst({
          where: {
            organizationId,
            productId: item.productId,
            warehouseId,
          },
        });

        if (level) {
          await prisma.inventoryLevel.update({
            where: { id: level.id },
            data: {
              quantityOnHand: level.quantityOnHand + item.quantity,
              quantityAvailable: level.quantityAvailable + item.quantity,
              totalCost: (level.quantityOnHand + item.quantity) * unitCost,
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
              unitCost,
              totalCost: item.quantity * unitCost,
              lastMovementAt: new Date(),
            },
          });
        }
      }

      result.itemsProcessed++;
    } catch (error) {
      result.errors.push({
        productId: item.productId,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Use item from vehicle stock (for job consumption)
 */
export async function useFromVehicle(
  organizationId: string,
  technicianId: string,
  productId: string,
  quantity: number,
  jobId?: string
): Promise<{ success: boolean; newQuantity: number; error?: string }> {
  const vehicleStock = await prisma.vehicleStock.findFirst({
    where: { technicianId, productId },
  });

  if (!vehicleStock || vehicleStock.quantity < quantity) {
    return {
      success: false,
      newQuantity: vehicleStock?.quantity ?? 0,
      error: `Stock insuficiente. Disponible: ${vehicleStock?.quantity ?? 0}`,
    };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  // Create usage movement
  await createMovement({
    organizationId,
    productId,
    movementType: 'SALE',
    quantity,
    direction: 'OUT',
    jobId,
    unitCost: product ? Number(product.costPrice) : 0,
    notes: `Uso en trabajo desde vehículo`,
  });

  // Update vehicle stock
  const newQty = vehicleStock.quantity - quantity;
  if (newQty <= 0) {
    await prisma.vehicleStock.delete({
      where: { id: vehicleStock.id },
    });
  } else {
    await prisma.vehicleStock.update({
      where: { id: vehicleStock.id },
      data: { quantity: newQty },
    });
  }

  return { success: true, newQuantity: newQty };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK SUMMARIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get vehicle stock summary for a technician
 */
export async function getTechnicianStockSummary(
  organizationId: string,
  technicianId: string
): Promise<VehicleStockSummary | null> {
  const technician = await prisma.user.findFirst({
    where: { id: technicianId, organizationId, role: 'TECHNICIAN' },
    select: { id: true, name: true },
  });

  if (!technician) return null;

  const stock = await prisma.vehicleStock.findMany({
    where: { organizationId, technicianId },
    include: {
      product: {
        select: { costPrice: true },
      },
    },
  });

  let totalValue = 0;
  let lowStockItems = 0;
  let outOfStockItems = 0;
  let lastActivityAt: Date | null = null;

  for (const item of stock) {
    totalValue += item.quantity * Number((item.product as any)?.costPrice || 0);

    if (item.quantity <= 0) {
      outOfStockItems++;
    } else if (item.quantity <= item.minLevel) {
      lowStockItems++;
    }

    if (item.lastRefilledAt && (!lastActivityAt || item.lastRefilledAt > lastActivityAt)) {
      lastActivityAt = item.lastRefilledAt;
    }
  }

  return {
    technicianId,
    technicianName: technician.name,
    totalItems: stock.length,
    totalValue,
    lowStockItems,
    outOfStockItems,
    lastActivityAt,
  };
}

/**
 * Get technicians with low vehicle stock
 */
export async function getTechniciansWithLowStock(
  organizationId: string
): Promise<Array<VehicleStockSummary & { lowStockProducts: string[] }>> {
  const technicians = await prisma.user.findMany({
    where: {
      organizationId,
      role: 'TECHNICIAN',
      isActive: true,
    },
    select: { id: true, name: true },
  });

  const results: Array<VehicleStockSummary & { lowStockProducts: string[] }> = [];

  for (const tech of technicians) {
    const stock = await prisma.vehicleStock.findMany({
      where: { technicianId: tech.id },
      include: {
        product: {
          select: { name: true, costPrice: true },
        },
      },
    });

    const lowStockProducts: string[] = [];
    let totalValue = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;

    for (const item of stock) {
      totalValue += item.quantity * Number((item.product as any)?.costPrice || 0);

      if (item.quantity <= 0) {
        outOfStockItems++;
        lowStockProducts.push((item.product as any)?.name || 'Unknown');
      } else if (item.quantity <= item.minLevel) {
        lowStockItems++;
        lowStockProducts.push((item.product as any)?.name || 'Unknown');
      }
    }

    if (lowStockItems > 0 || outOfStockItems > 0) {
      results.push({
        technicianId: tech.id,
        technicianName: tech.name,
        totalItems: stock.length,
        totalValue,
        lowStockItems,
        outOfStockItems,
        lastActivityAt: null,
        lowStockProducts,
      });
    }
  }

  return results.sort((a, b) => b.outOfStockItems - a.outOfStockItems);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate technician stock report
 */
export async function generateTechnicianStockReport(
  organizationId: string,
  technicianId: string
): Promise<TechnicianStockReport | null> {
  const technician = await prisma.user.findFirst({
    where: { id: technicianId, organizationId },
    select: { id: true, name: true },
  });

  if (!technician) return null;

  const stock = await prisma.vehicleStock.findMany({
    where: { technicianId },
    include: {
      product: {
        select: { id: true, name: true, sku: true, costPrice: true, salePrice: true },
      },
    },
    orderBy: { product: { name: 'asc' } },
  });

  const items: TechnicianStockReport['items'] = [];
  let totalValue = 0;
  let itemsOk = 0;
  let itemsLow = 0;
  let itemsOut = 0;
  let itemsOverstock = 0;

  for (const item of stock) {
    const product = item.product as any;
    const unitValue = Number(product?.costPrice || 0);
    const itemTotalValue = item.quantity * unitValue;
    totalValue += itemTotalValue;

    let status: 'OK' | 'LOW' | 'OUT' | 'OVERSTOCK';
    if (item.quantity <= 0) {
      status = 'OUT';
      itemsOut++;
    } else if (item.quantity <= item.minLevel) {
      status = 'LOW';
      itemsLow++;
    } else if (item.maxLevel && item.quantity > item.maxLevel) {
      status = 'OVERSTOCK';
      itemsOverstock++;
    } else {
      status = 'OK';
      itemsOk++;
    }

    items.push({
      productId: item.productId,
      productName: product?.name || 'Unknown',
      sku: product?.sku || '',
      quantity: item.quantity,
      minLevel: item.minLevel,
      maxLevel: item.maxLevel,
      status,
      unitValue,
      totalValue: itemTotalValue,
    });
  }

  return {
    technicianId,
    technicianName: technician.name,
    items,
    summary: {
      totalItems: items.length,
      totalValue,
      itemsOk,
      itemsLow,
      itemsOut,
      itemsOverstock,
    },
  };
}

/**
 * Generate fleet stock report (all technicians)
 */
export async function generateFleetStockReport(
  organizationId: string
): Promise<FleetStockReport> {
  const technicians = await prisma.user.findMany({
    where: {
      organizationId,
      role: 'TECHNICIAN',
      isActive: true,
    },
    select: { id: true },
  });

  const byTechnician: TechnicianStockReport[] = [];
  const lowStockAlerts: FleetStockReport['lowStockAlerts'] = [];
  let totalValue = 0;

  for (const tech of technicians) {
    const report = await generateTechnicianStockReport(organizationId, tech.id);
    if (report) {
      byTechnician.push(report);
      totalValue += report.summary.totalValue;

      // Collect low stock alerts
      for (const item of report.items) {
        if (item.status === 'LOW' || item.status === 'OUT') {
          lowStockAlerts.push({
            technicianId: report.technicianId,
            technicianName: report.technicianName,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            minLevel: item.minLevel,
          });
        }
      }
    }
  }

  return {
    organizationId,
    generatedAt: new Date(),
    totalTechnicians: byTechnician.length,
    totalValue,
    byTechnician,
    lowStockAlerts: lowStockAlerts.sort((a, b) => a.quantity - b.quantity),
  };
}
