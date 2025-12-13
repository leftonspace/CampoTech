/**
 * Supplier Service
 * Phase 12.4: Manage suppliers and supplier products
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type {
  Supplier,
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierProduct,
  CreateSupplierProductInput,
  UpdateSupplierProductInput,
  SupplierFilters,
  SupplierPerformance,
} from './purchasing.types';

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIER CODE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

async function generateSupplierCode(organizationId: string): Promise<string> {
  const count = await prisma.supplier.count({
    where: { organizationId },
  });

  const sequence = (count + 1).toString().padStart(4, '0');
  return `PROV-${sequence}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIER CRUD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a supplier
 */
export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  // Check code uniqueness
  const existing = await prisma.supplier.findFirst({
    where: {
      organizationId: input.organizationId,
      code: input.code,
    },
  });
  if (existing) {
    throw new Error(`Ya existe un proveedor con el código "${input.code}"`);
  }

  // Check CUIT uniqueness if provided
  if (input.cuit) {
    const cuitExists = await prisma.supplier.findFirst({
      where: {
        organizationId: input.organizationId,
        cuit: input.cuit,
      },
    });
    if (cuitExists) {
      throw new Error(`Ya existe un proveedor con el CUIT "${input.cuit}"`);
    }
  }

  const supplier = await prisma.supplier.create({
    data: {
      organizationId: input.organizationId,
      code: input.code.toUpperCase(),
      name: input.name,
      legalName: input.legalName || null,
      cuit: input.cuit || null,
      taxCondition: input.taxCondition || null,
      contactName: input.contactName || null,
      email: input.email || null,
      phone: input.phone || null,
      website: input.website || null,
      address: input.address as Prisma.InputJsonValue || null,
      paymentTermDays: input.paymentTermDays ?? 30,
      creditLimit: input.creditLimit ?? null,
      currency: input.currency || 'ARS',
      bankInfo: input.bankInfo as Prisma.InputJsonValue || null,
      notes: input.notes || null,
    },
  });

  return supplier as unknown as Supplier;
}

/**
 * Create supplier with auto-generated code
 */
export async function createSupplierWithAutoCode(
  input: Omit<CreateSupplierInput, 'code'> & { code?: string }
): Promise<Supplier> {
  if (!input.code) {
    input.code = await generateSupplierCode(input.organizationId);
  }
  return createSupplier(input as CreateSupplierInput);
}

/**
 * Get supplier by ID
 */
export async function getSupplier(
  organizationId: string,
  supplierId: string
): Promise<Supplier | null> {
  const supplier = await prisma.supplier.findFirst({
    where: {
      id: supplierId,
      organizationId,
    },
  });

  return supplier as Supplier | null;
}

/**
 * Get supplier by code
 */
export async function getSupplierByCode(
  organizationId: string,
  code: string
): Promise<Supplier | null> {
  const supplier = await prisma.supplier.findFirst({
    where: {
      organizationId,
      code: code.toUpperCase(),
    },
  });

  return supplier as Supplier | null;
}

/**
 * Update a supplier
 */
export async function updateSupplier(
  organizationId: string,
  supplierId: string,
  input: UpdateSupplierInput
): Promise<Supplier> {
  const existing = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId },
  });
  if (!existing) {
    throw new Error('Proveedor no encontrado');
  }

  // Check code uniqueness if changing
  if (input.code && input.code !== existing.code) {
    const codeExists = await prisma.supplier.findFirst({
      where: {
        organizationId,
        code: input.code,
        id: { not: supplierId },
      },
    });
    if (codeExists) {
      throw new Error(`Ya existe un proveedor con el código "${input.code}"`);
    }
  }

  // Check CUIT uniqueness if changing
  if (input.cuit && input.cuit !== existing.cuit) {
    const cuitExists = await prisma.supplier.findFirst({
      where: {
        organizationId,
        cuit: input.cuit,
        id: { not: supplierId },
      },
    });
    if (cuitExists) {
      throw new Error(`Ya existe un proveedor con el CUIT "${input.cuit}"`);
    }
  }

  const supplier = await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      code: input.code?.toUpperCase(),
      name: input.name,
      legalName: input.legalName,
      cuit: input.cuit,
      taxCondition: input.taxCondition,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      website: input.website,
      address: input.address as Prisma.InputJsonValue,
      paymentTermDays: input.paymentTermDays,
      creditLimit: input.creditLimit,
      currency: input.currency,
      bankInfo: input.bankInfo as Prisma.InputJsonValue,
      isActive: input.isActive,
      rating: input.rating,
      notes: input.notes,
    },
  });

  return supplier as unknown as Supplier;
}

/**
 * Delete a supplier
 */
export async function deleteSupplier(
  organizationId: string,
  supplierId: string
): Promise<{ deleted: boolean }> {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId },
    include: {
      _count: {
        select: { purchaseOrders: true },
      },
    },
  });

  if (!supplier) {
    throw new Error('Proveedor no encontrado');
  }

  if (supplier._count.purchaseOrders > 0) {
    // Soft delete
    await prisma.supplier.update({
      where: { id: supplierId },
      data: { isActive: false },
    });
  } else {
    // Hard delete - remove products first
    await prisma.supplierProduct.deleteMany({
      where: { supplierId },
    });
    await prisma.supplier.delete({
      where: { id: supplierId },
    });
  }

  return { deleted: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIER LISTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * List suppliers
 */
export async function listSuppliers(
  organizationId: string,
  filters: SupplierFilters = {},
  options: { page?: number; pageSize?: number } = {}
): Promise<{ suppliers: Supplier[]; total: number }> {
  const { page = 1, pageSize = 50 } = options;

  const where: any = { organizationId };

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
      { cuit: { contains: filters.search } },
    ];
  }

  const [total, suppliers] = await Promise.all([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { suppliers: suppliers as Supplier[], total };
}

/**
 * Search suppliers (quick search)
 */
export async function searchSuppliers(
  organizationId: string,
  query: string,
  limit: number = 10
): Promise<Supplier[]> {
  const suppliers = await prisma.supplier.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { code: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: limit,
    orderBy: { name: 'asc' },
  });

  return suppliers as Supplier[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIER PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add product to supplier catalog
 */
export async function addSupplierProduct(
  input: CreateSupplierProductInput
): Promise<SupplierProduct> {
  // Check if already exists
  const existing = await prisma.supplierProduct.findFirst({
    where: {
      supplierId: input.supplierId,
      productId: input.productId,
    },
  });
  if (existing) {
    throw new Error('Este producto ya está asociado al proveedor');
  }

  const supplierProduct = await prisma.supplierProduct.create({
    data: {
      supplierId: input.supplierId,
      productId: input.productId,
      supplierSku: input.supplierSku || null,
      supplierName: input.supplierName || null,
      purchasePrice: input.purchasePrice,
      minOrderQty: input.minOrderQty ?? 1,
      leadTimeDays: input.leadTimeDays ?? null,
      isPreferred: input.isPreferred ?? false,
    },
  });

  return supplierProduct as unknown as SupplierProduct;
}

/**
 * Get supplier products
 */
export async function getSupplierProducts(supplierId: string): Promise<SupplierProduct[]> {
  const products = await prisma.supplierProduct.findMany({
    where: { supplierId },
    include: {
      product: { select: { id: true, name: true, sku: true, barcode: true } },
    },
    orderBy: { product: { name: 'asc' } },
  });

  return products as unknown as SupplierProduct[];
}

/**
 * Get suppliers for a product
 */
export async function getProductSuppliers(
  organizationId: string,
  productId: string
): Promise<Array<SupplierProduct & { supplier: Supplier }>> {
  const suppliers = await prisma.supplierProduct.findMany({
    where: {
      productId,
      supplier: { organizationId, isActive: true },
    },
    include: {
      supplier: true,
    },
    orderBy: [{ isPreferred: 'desc' }, { purchasePrice: 'asc' }],
  });

  return suppliers as unknown as Array<SupplierProduct & { supplier: Supplier }>;
}

/**
 * Get preferred supplier for a product
 */
export async function getPreferredSupplier(
  organizationId: string,
  productId: string
): Promise<(SupplierProduct & { supplier: Supplier }) | null> {
  const preferred = await prisma.supplierProduct.findFirst({
    where: {
      productId,
      isPreferred: true,
      supplier: { organizationId, isActive: true },
    },
    include: { supplier: true },
  });

  if (preferred) {
    return preferred as unknown as SupplierProduct & { supplier: Supplier };
  }

  // Fallback to cheapest
  const cheapest = await prisma.supplierProduct.findFirst({
    where: {
      productId,
      supplier: { organizationId, isActive: true },
    },
    include: { supplier: true },
    orderBy: { purchasePrice: 'asc' },
  });

  return cheapest as unknown as (SupplierProduct & { supplier: Supplier }) | null;
}

/**
 * Update supplier product
 */
export async function updateSupplierProduct(
  supplierProductId: string,
  input: UpdateSupplierProductInput
): Promise<SupplierProduct> {
  const updated = await prisma.supplierProduct.update({
    where: { id: supplierProductId },
    data: {
      supplierSku: input.supplierSku,
      supplierName: input.supplierName,
      purchasePrice: input.purchasePrice,
      minOrderQty: input.minOrderQty,
      leadTimeDays: input.leadTimeDays,
      isPreferred: input.isPreferred,
    },
  });

  return updated as unknown as SupplierProduct;
}

/**
 * Remove product from supplier catalog
 */
export async function removeSupplierProduct(supplierProductId: string): Promise<void> {
  await prisma.supplierProduct.delete({
    where: { id: supplierProductId },
  });
}

/**
 * Set preferred supplier for a product
 */
export async function setPreferredSupplier(
  organizationId: string,
  productId: string,
  supplierId: string
): Promise<void> {
  // Clear existing preferred
  await prisma.supplierProduct.updateMany({
    where: {
      productId,
      supplier: { organizationId },
    },
    data: { isPreferred: false },
  });

  // Set new preferred
  await prisma.supplierProduct.updateMany({
    where: {
      productId,
      supplierId,
    },
    data: { isPreferred: true },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIER ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get supplier performance metrics
 */
export async function getSupplierPerformance(
  organizationId: string,
  supplierId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<SupplierPerformance | null> {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId },
  });

  if (!supplier) return null;

  const dateFilter: any = {};
  if (dateFrom) dateFilter.gte = dateFrom;
  if (dateTo) dateFilter.lte = dateTo;

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      supplierId,
      status: { in: ['RECEIVED', 'PARTIAL'] },
      ...(dateFrom || dateTo ? { receivedDate: dateFilter } : {}),
    },
    select: {
      id: true,
      total: true,
      expectedDate: true,
      receivedDate: true,
      orderDate: true,
    },
  });

  const totalOrders = orders.length;
  const totalValue = orders.reduce((sum: number, o: typeof orders[number]) => sum + Number(o.total), 0);

  // Calculate average lead time (order date to received date)
  let totalLeadTime = 0;
  let leadTimeCount = 0;
  let onTimeCount = 0;

  for (const order of orders) {
    if (order.receivedDate) {
      const leadTime = Math.floor(
        (order.receivedDate.getTime() - order.orderDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalLeadTime += leadTime;
      leadTimeCount++;

      if (order.expectedDate && order.receivedDate <= order.expectedDate) {
        onTimeCount++;
      }
    }
  }

  const averageLeadTime = leadTimeCount > 0 ? totalLeadTime / leadTimeCount : 0;
  const onTimeDeliveryRate = totalOrders > 0 ? (onTimeCount / totalOrders) * 100 : 0;

  const lastOrder = await prisma.purchaseOrder.findFirst({
    where: { supplierId },
    orderBy: { orderDate: 'desc' },
    select: { orderDate: true },
  });

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    totalOrders,
    totalValue,
    averageLeadTime: Math.round(averageLeadTime),
    onTimeDeliveryRate: Math.round(onTimeDeliveryRate),
    qualityScore: supplier.rating || 0,
    lastOrderDate: lastOrder?.orderDate || null,
  };
}

/**
 * Get top suppliers by purchase volume
 */
export async function getTopSuppliers(
  organizationId: string,
  limit: number = 10,
  dateFrom?: Date,
  dateTo?: Date
): Promise<Array<{ supplierId: string; supplierName: string; totalValue: number; orderCount: number }>> {
  const dateFilter: any = {};
  if (dateFrom) dateFilter.gte = dateFrom;
  if (dateTo) dateFilter.lte = dateTo;

  const suppliers = await prisma.supplier.findMany({
    where: { organizationId, isActive: true },
    include: {
      purchaseOrders: {
        where: {
          status: { in: ['RECEIVED', 'PARTIAL', 'SENT', 'APPROVED'] },
          ...(dateFrom || dateTo ? { orderDate: dateFilter } : {}),
        },
        select: { total: true },
      },
    },
  });

  type SupplierType = typeof suppliers[number];
  const supplierStats = suppliers.map((s: SupplierType) => ({
    supplierId: s.id,
    supplierName: s.name,
    totalValue: s.purchaseOrders.reduce((sum: number, o: typeof s.purchaseOrders[number]) => sum + Number(o.total), 0),
    orderCount: s.purchaseOrders.length,
  }));

  type StatType = typeof supplierStats[number];
  return supplierStats
    .filter((s: StatType) => s.orderCount > 0)
    .sort((a: typeof supplierStats[number], b: typeof supplierStats[number]) => b.totalValue - a.totalValue)
    .slice(0, limit);
}
