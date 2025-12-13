/**
 * Job Material Service
 * Phase 12.6: Manage job materials and inventory integration
 */

import { prisma } from '@/lib/prisma';
import type {
  JobMaterial,
  AddJobMaterialInput,
  UpdateJobMaterialInput,
  UseMaterialInput,
  ReturnMaterialInput,
  JobMaterialSummary,
  MaterialEstimate,
  MaterialUsageReport,
  JobProfitabilityReport,
} from './job-material.types';
import { createReservation, cancelReservation, fulfillReservation } from '../stock/stock-reservation.service';
import { createMovement } from '../stock/stock-movement.service';
import { useFromVehicle } from '../vehicle/vehicle-stock.service';

// ═══════════════════════════════════════════════════════════════════════════════
// JOB MATERIALS CRUD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add material to a job
 */
export async function addJobMaterial(
  organizationId: string,
  input: AddJobMaterialInput
): Promise<JobMaterial> {
  const { jobId, productId, quantity, unitPrice, discount, sourceType, sourceId, notes, reserveStock } =
    input;

  // Verify job exists
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId },
  });

  if (!job) {
    throw new Error('Trabajo no encontrado');
  }

  // Get product
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
  });

  if (!product) {
    throw new Error('Producto no encontrado');
  }

  const price = unitPrice ?? Number(product.salePrice);
  const cost = Number(product.costPrice);
  const discountPercent = discount ?? 0;
  const lineTotal = quantity * price * (1 - discountPercent / 100);

  // Create job material
  const material = await prisma.jobMaterial.create({
    data: {
      jobId,
      productId,
      estimatedQty: quantity,
      usedQty: 0,
      returnedQty: 0,
      unitPrice: price,
      unitCost: cost,
      discount: discountPercent,
      lineTotal,
      sourceType: sourceType || 'WAREHOUSE',
      sourceId: sourceId || null,
      notes: notes || null,
      addedAt: new Date(),
    },
    include: {
      product: {
        select: { id: true, name: true, sku: true, unitOfMeasure: true },
      },
    },
  });

  // Create stock reservation if requested
  if (reserveStock && sourceType !== 'CUSTOMER') {
    const warehouseId = sourceId || (await getDefaultWarehouseId(organizationId));
    if (warehouseId) {
      await createReservation({
        organizationId,
        productId,
        warehouseId,
        jobId,
        quantity,
      });
    }
  }

  return material as unknown as JobMaterial;
}

/**
 * Get job materials
 */
export async function getJobMaterials(
  organizationId: string,
  jobId: string
): Promise<JobMaterial[]> {
  const materials = await prisma.jobMaterial.findMany({
    where: {
      jobId,
      job: { organizationId },
    },
    include: {
      product: {
        select: { id: true, name: true, sku: true, unitOfMeasure: true, imageUrl: true },
      },
    },
    orderBy: { addedAt: 'asc' },
  });

  return materials as unknown as JobMaterial[];
}

/**
 * Update job material
 */
export async function updateJobMaterial(
  organizationId: string,
  materialId: string,
  input: UpdateJobMaterialInput
): Promise<JobMaterial> {
  const material = await prisma.jobMaterial.findFirst({
    where: { id: materialId },
    include: { job: true },
  });

  if (!material || material.job.organizationId !== organizationId) {
    throw new Error('Material no encontrado');
  }

  const quantity = input.quantity ?? material.estimatedQty;
  const price = input.unitPrice ?? Number(material.unitPrice);
  const discount = input.discount ?? Number(material.discount);
  const lineTotal = quantity * price * (1 - discount / 100);

  const updated = await prisma.jobMaterial.update({
    where: { id: materialId },
    data: {
      estimatedQty: quantity,
      unitPrice: price,
      discount,
      lineTotal,
      notes: input.notes,
    },
    include: {
      product: {
        select: { id: true, name: true, sku: true, unitOfMeasure: true },
      },
    },
  });

  return updated as unknown as JobMaterial;
}

/**
 * Remove material from job
 */
export async function removeJobMaterial(
  organizationId: string,
  materialId: string
): Promise<void> {
  const material = await prisma.jobMaterial.findFirst({
    where: { id: materialId },
    include: { job: true },
  });

  if (!material || material.job.organizationId !== organizationId) {
    throw new Error('Material no encontrado');
  }

  if (material.usedQty > 0) {
    throw new Error('No se puede eliminar un material que ya fue utilizado');
  }

  // Cancel any reservations
  const reservations = await prisma.stockReservation.findMany({
    where: {
      jobId: material.jobId,
      productId: material.productId,
      status: 'PENDING',
    },
  });

  for (const res of reservations as typeof reservations) {
    await cancelReservation(organizationId, res.id);
  }

  await prisma.jobMaterial.delete({
    where: { id: materialId },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIAL USAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record material usage
 */
export async function useMaterial(
  organizationId: string,
  input: UseMaterialInput
): Promise<JobMaterial> {
  const { jobMaterialId, usedQty, fromVehicle, technicianId } = input;

  const material = await prisma.jobMaterial.findFirst({
    where: { id: jobMaterialId },
    include: { job: true, product: true },
  });

  if (!material || material.job.organizationId !== organizationId) {
    throw new Error('Material no encontrado');
  }

  const remainingQty = material.estimatedQty - material.usedQty - material.returnedQty;
  if (usedQty > remainingQty) {
    throw new Error(`Cantidad excede lo disponible. Restante: ${remainingQty}`);
  }

  // Handle stock deduction
  if (fromVehicle && technicianId) {
    // Use from technician's vehicle
    const result = await useFromVehicle(
      organizationId,
      technicianId,
      material.productId,
      usedQty,
      material.jobId
    );

    if (!result.success) {
      throw new Error(result.error || 'Error al usar stock del vehículo');
    }
  } else if (material.sourceType === 'WAREHOUSE' && material.sourceId) {
    // Fulfill reservation or create movement
    const reservation = await prisma.stockReservation.findFirst({
      where: {
        jobId: material.jobId,
        productId: material.productId,
        status: 'PENDING',
      },
    });

    if (reservation) {
      await fulfillReservation(organizationId, reservation.id);
    } else {
      // Direct consumption from warehouse
      await createMovement({
        organizationId,
        productId: material.productId,
        movementType: 'SALE',
        quantity: usedQty,
        direction: 'OUT',
        fromWarehouseId: material.sourceId,
        jobId: material.jobId,
        unitCost: Number(material.unitCost),
        notes: `Uso en trabajo ${material.job.jobNumber}`,
      });
    }
  }

  // Update material record
  const newUsedQty = material.usedQty + usedQty;
  const updated = await prisma.jobMaterial.update({
    where: { id: jobMaterialId },
    data: {
      usedQty: newUsedQty,
      usedAt: new Date(),
      lineTotal: newUsedQty * Number(material.unitPrice) * (1 - Number(material.discount) / 100),
    },
    include: {
      product: {
        select: { id: true, name: true, sku: true, unitOfMeasure: true },
      },
    },
  });

  return updated as unknown as JobMaterial;
}

/**
 * Return unused material
 */
export async function returnMaterial(
  organizationId: string,
  input: ReturnMaterialInput
): Promise<JobMaterial> {
  const { jobMaterialId, returnedQty, reason, toWarehouseId } = input;

  const material = await prisma.jobMaterial.findFirst({
    where: { id: jobMaterialId },
    include: { job: true },
  });

  if (!material || material.job.organizationId !== organizationId) {
    throw new Error('Material no encontrado');
  }

  const unusedQty = material.estimatedQty - material.usedQty - material.returnedQty;
  if (returnedQty > unusedQty) {
    throw new Error(`Cantidad excede lo no utilizado. Disponible: ${unusedQty}`);
  }

  // If returning to warehouse, create movement
  if (toWarehouseId) {
    await createMovement({
      organizationId,
      productId: material.productId,
      movementType: 'RETURN_IN',
      quantity: returnedQty,
      direction: 'IN',
      toWarehouseId,
      jobId: material.jobId,
      unitCost: Number(material.unitCost),
      notes: reason || `Devolución de trabajo ${material.job.jobNumber}`,
    });
  }

  // Update material record
  const newReturnedQty = material.returnedQty + returnedQty;
  const actualUsed = material.usedQty;
  const updated = await prisma.jobMaterial.update({
    where: { id: jobMaterialId },
    data: {
      returnedQty: newReturnedQty,
      lineTotal: actualUsed * Number(material.unitPrice) * (1 - Number(material.discount) / 100),
    },
    include: {
      product: {
        select: { id: true, name: true, sku: true, unitOfMeasure: true },
      },
    },
  });

  return updated as unknown as JobMaterial;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIAL SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get job material summary
 */
export async function getJobMaterialSummary(
  organizationId: string,
  jobId: string
): Promise<JobMaterialSummary> {
  const materials = await prisma.jobMaterial.findMany({
    where: { jobId, job: { organizationId } },
  });

  const reservations = await prisma.stockReservation.findMany({
    where: { jobId, status: 'PENDING' },
  });

  let totalEstimated = 0;
  let totalUsed = 0;
  let totalReturned = 0;
  let subtotal = 0;
  let totalDiscount = 0;
  let totalCost = 0;

  for (const m of materials as typeof materials) {
    totalEstimated += m.estimatedQty;
    totalUsed += m.usedQty;
    totalReturned += m.returnedQty;

    const itemSubtotal = m.usedQty * Number(m.unitPrice);
    const itemDiscount = itemSubtotal * (Number(m.discount) / 100);
    subtotal += itemSubtotal;
    totalDiscount += itemDiscount;
    totalCost += m.usedQty * Number(m.unitCost);
  }

  const total = subtotal - totalDiscount;
  const profit = total - totalCost;
  const profitMargin = total > 0 ? (profit / total) * 100 : 0;

  const hasPendingMaterials = materials.some(
    (m: typeof materials[number]) => m.estimatedQty > m.usedQty + m.returnedQty
  );

  return {
    jobId,
    totalItems: materials.length,
    totalEstimated,
    totalUsed,
    totalReturned,
    subtotal,
    discount: totalDiscount,
    total,
    profit,
    profitMargin,
    hasReservations: reservations.length > 0,
    hasPendingMaterials,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIAL ESTIMATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get material estimates for a service type
 */
export async function getMaterialEstimates(
  organizationId: string,
  serviceType: string,
  warehouseId?: string
): Promise<MaterialEstimate[]> {
  // This would typically come from templates or historical data
  // For now, returning common materials for the service type
  const estimates: MaterialEstimate[] = [];

  // Get common products for this service type
  const commonProducts = await prisma.product.findMany({
    where: {
      organizationId,
      isActive: true,
      // Filter by category or tags related to service type
    },
    take: 10,
  });

  for (const product of commonProducts) {
    let availableQty = 0;

    if (warehouseId) {
      const level = await prisma.inventoryLevel.findFirst({
        where: { productId: product.id, warehouseId },
      });
      availableQty = level?.quantityAvailable ?? 0;
    } else {
      const levels = await prisma.inventoryLevel.findMany({
        where: { productId: product.id },
      });
      availableQty = levels.reduce((sum: number, l: typeof levels[number]) => sum + l.quantityAvailable, 0);
    }

    estimates.push({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      estimatedQty: 1,
      unitPrice: Number(product.salePrice),
      totalPrice: Number(product.salePrice),
      inStock: availableQty > 0,
      availableQty,
    });
  }

  return estimates;
}

/**
 * Add materials from estimate
 */
export async function addMaterialsFromEstimate(
  organizationId: string,
  jobId: string,
  estimates: Array<{ productId: string; quantity: number }>,
  options?: { reserveStock?: boolean; warehouseId?: string }
): Promise<JobMaterial[]> {
  const materials: JobMaterial[] = [];

  for (const est of estimates as typeof estimates) {
    const material = await addJobMaterial(organizationId, {
      jobId,
      productId: est.productId,
      quantity: est.quantity,
      sourceType: 'WAREHOUSE',
      sourceId: options?.warehouseId,
      reserveStock: options?.reserveStock ?? true,
    });
    materials.push(material);
  }

  return materials;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get materials for invoice
 */
export async function getMaterialsForInvoice(
  organizationId: string,
  jobId: string
): Promise<Array<{ description: string; quantity: number; unitPrice: number; total: number }>> {
  const materials = await prisma.jobMaterial.findMany({
    where: {
      jobId,
      job: { organizationId },
      usedQty: { gt: 0 },
      isInvoiced: false,
    },
    include: {
      product: { select: { name: true, sku: true } },
    },
  });

  return materials.map((m: typeof materials[number]) => ({
    description: `${(m.product as any)?.name || 'Material'} (${(m.product as any)?.sku})`,
    quantity: m.usedQty,
    unitPrice: Number(m.unitPrice),
    total: Number(m.lineTotal),
  }));
}

/**
 * Mark materials as invoiced
 */
export async function markMaterialsInvoiced(
  organizationId: string,
  jobId: string
): Promise<number> {
  const result = await prisma.jobMaterial.updateMany({
    where: {
      jobId,
      job: { organizationId },
      usedQty: { gt: 0 },
      isInvoiced: false,
    },
    data: { isInvoiced: true },
  });

  return result.count;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate material usage report
 */
export async function generateMaterialUsageReport(
  organizationId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<MaterialUsageReport> {
  const jobs = await prisma.job.findMany({
    where: {
      organizationId,
      completedAt: { gte: dateFrom, lte: dateTo },
    },
    include: {
      materials: {
        where: { usedQty: { gt: 0 } },
        include: { product: { select: { id: true, name: true } } },
      },
      technician: { select: { id: true, name: true } },
    },
  });

  let totalMaterialsCost = 0;
  let totalMaterialsRevenue = 0;
  const byProduct: Record<string, { name: string; qty: number; cost: number; revenue: number; jobs: Set<string> }> = {};
  const byTechnician: Record<string, { name: string; materials: number; cost: number; revenue: number; jobs: Set<string> }> = {};

  for (const job of jobs as typeof jobs) {
    const techId = job.technicianId;
    const techName = (job.technician as any)?.name || 'Sin asignar';

    for (const mat of job.materials as typeof job.materials) {
      const cost = mat.usedQty * Number(mat.unitCost);
      const revenue = Number(mat.lineTotal);

      totalMaterialsCost += cost;
      totalMaterialsRevenue += revenue;

      // By product
      if (!byProduct[mat.productId]) {
        byProduct[mat.productId] = {
          name: (mat.product as any)?.name || 'Unknown',
          qty: 0,
          cost: 0,
          revenue: 0,
          jobs: new Set(),
        };
      }
      byProduct[mat.productId].qty += mat.usedQty;
      byProduct[mat.productId].cost += cost;
      byProduct[mat.productId].revenue += revenue;
      byProduct[mat.productId].jobs.add(job.id);

      // By technician
      if (techId) {
        if (!byTechnician[techId]) {
          byTechnician[techId] = {
            name: techName,
            materials: 0,
            cost: 0,
            revenue: 0,
            jobs: new Set(),
          };
        }
        byTechnician[techId].materials += mat.usedQty;
        byTechnician[techId].cost += cost;
        byTechnician[techId].revenue += revenue;
        byTechnician[techId].jobs.add(job.id);
      }
    }
  }

  const totalJobs = jobs.length;

  return {
    period: { from: dateFrom, to: dateTo },
    totalJobs,
    totalMaterialsCost,
    totalMaterialsRevenue,
    totalProfit: totalMaterialsRevenue - totalMaterialsCost,
    averageMaterialsPerJob: totalJobs > 0 ? totalMaterialsRevenue / totalJobs : 0,
    byProduct: Object.entries(byProduct)
      .map(([productId, data]: [string, any]) => ({
        productId,
        productName: data.name,
        quantityUsed: data.qty,
        totalCost: data.cost,
        totalRevenue: data.revenue,
        jobCount: data.jobs.size,
      }))
      .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue),
    byTechnician: Object.entries(byTechnician)
      .map(([technicianId, data]: [string, any]) => ({
        technicianId,
        technicianName: data.name,
        totalMaterials: data.materials,
        totalCost: data.cost,
        totalRevenue: data.revenue,
        jobCount: data.jobs.size,
      }))
      .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue),
  };
}

/**
 * Get job profitability report
 */
export async function getJobProfitabilityReport(
  organizationId: string,
  jobId: string
): Promise<JobProfitabilityReport | null> {
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId },
    include: {
      customer: { select: { name: true } },
      technician: { select: { name: true } },
      materials: true,
      invoice: true,
    },
  });

  if (!job) return null;

  let materialRevenue = 0;
  let materialCost = 0;

  for (const mat of job.materials as typeof job.materials) {
    materialRevenue += Number(mat.lineTotal);
    materialCost += mat.usedQty * Number(mat.unitCost);
  }

  const laborRevenue = job.invoice ? Number(job.invoice.subtotal) - materialRevenue : 0;
  const totalRevenue = laborRevenue + materialRevenue;
  const totalCost = materialCost; // Labor cost would need separate tracking
  const profit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  return {
    jobId: job.id,
    jobNumber: job.jobNumber,
    serviceType: job.serviceType,
    customerName: (job.customer as any)?.name || 'Unknown',
    technicianName: (job.technician as any)?.name || 'Sin asignar',
    completedAt: job.completedAt || new Date(),
    laborRevenue,
    materialRevenue,
    materialCost,
    totalRevenue,
    totalCost,
    profit,
    profitMargin,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function getDefaultWarehouseId(organizationId: string): Promise<string | null> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { organizationId, isDefault: true, isActive: true },
    select: { id: true },
  });

  if (warehouse) return warehouse.id;

  const anyWarehouse = await prisma.warehouse.findFirst({
    where: { organizationId, isActive: true },
    select: { id: true },
  });

  return anyWarehouse?.id || null;
}
