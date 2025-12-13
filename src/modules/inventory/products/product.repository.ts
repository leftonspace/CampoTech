/**
 * Product Repository
 * Phase 12.2: Database operations for products and variants
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductVariant,
  CreateVariantInput,
  UpdateVariantInput,
  ProductFilters,
  ProductListOptions,
  ProductListResult,
  ProductWithInventory,
} from './product.types';
import { getDescendantCategoryIds } from './category-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT CRUD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new product
 */
export async function createProduct(input: CreateProductInput): Promise<Product> {
  // Check SKU uniqueness
  const existing = await prisma.product.findFirst({
    where: {
      organizationId: input.organizationId,
      sku: input.sku,
    },
  });
  if (existing) {
    throw new Error(`Ya existe un producto con el SKU "${input.sku}"`);
  }

  // Check barcode uniqueness if provided
  if (input.barcode) {
    const barcodeExists = await prisma.product.findFirst({
      where: {
        organizationId: input.organizationId,
        barcode: input.barcode,
      },
    });
    if (barcodeExists) {
      throw new Error(`Ya existe un producto con el código de barras "${input.barcode}"`);
    }
  }

  const product = await prisma.product.create({
    data: {
      organizationId: input.organizationId,
      categoryId: input.categoryId || null,
      sku: input.sku,
      barcode: input.barcode || null,
      name: input.name,
      description: input.description || null,
      brand: input.brand || null,
      model: input.model || null,
      productType: input.productType || 'PART',
      unitOfMeasure: input.unitOfMeasure || 'UNIDAD',
      costPrice: input.costPrice,
      salePrice: input.salePrice,
      marginPercent: input.marginPercent ?? null,
      taxRate: input.taxRate ?? 21.0,
      trackInventory: input.trackInventory ?? true,
      minStockLevel: input.minStockLevel ?? 0,
      maxStockLevel: input.maxStockLevel ?? null,
      reorderQty: input.reorderQty ?? null,
      weight: input.weight ?? null,
      dimensions: input.dimensions as Prisma.InputJsonValue ?? null,
      imageUrl: input.imageUrl || null,
      images: input.images || [],
      isActive: input.isActive ?? true,
      isSerialTracked: input.isSerialTracked ?? false,
    },
    include: {
      category: true,
    },
  });

  return product as unknown as Product;
}

/**
 * Get a product by ID
 */
export async function getProductById(
  organizationId: string,
  productId: string,
  options: { includeVariants?: boolean; includeCategory?: boolean } = {}
): Promise<Product | null> {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      organizationId,
    },
    include: {
      category: options.includeCategory ?? true,
      variants: options.includeVariants ?? false,
    },
  });

  return product as unknown as Product | null;
}

/**
 * Get a product by SKU
 */
export async function getProductBySku(
  organizationId: string,
  sku: string
): Promise<Product | null> {
  const product = await prisma.product.findFirst({
    where: {
      organizationId,
      sku,
    },
    include: {
      category: true,
    },
  });

  return product as unknown as Product | null;
}

/**
 * Get a product by barcode
 */
export async function getProductByBarcode(
  organizationId: string,
  barcode: string
): Promise<Product | null> {
  const product = await prisma.product.findFirst({
    where: {
      organizationId,
      barcode,
    },
    include: {
      category: true,
    },
  });

  return product as unknown as Product | null;
}

/**
 * Update a product
 */
export async function updateProduct(
  organizationId: string,
  productId: string,
  input: UpdateProductInput
): Promise<Product> {
  // Verify product exists
  const existing = await prisma.product.findFirst({
    where: {
      id: productId,
      organizationId,
    },
  });
  if (!existing) {
    throw new Error('Producto no encontrado');
  }

  // Check SKU uniqueness if changing
  if (input.sku && input.sku !== existing.sku) {
    const skuExists = await prisma.product.findFirst({
      where: {
        organizationId,
        sku: input.sku,
        id: { not: productId },
      },
    });
    if (skuExists) {
      throw new Error(`Ya existe un producto con el SKU "${input.sku}"`);
    }
  }

  // Check barcode uniqueness if changing
  if (input.barcode && input.barcode !== existing.barcode) {
    const barcodeExists = await prisma.product.findFirst({
      where: {
        organizationId,
        barcode: input.barcode,
        id: { not: productId },
      },
    });
    if (barcodeExists) {
      throw new Error(`Ya existe un producto con el código de barras "${input.barcode}"`);
    }
  }

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      categoryId: input.categoryId,
      sku: input.sku,
      barcode: input.barcode,
      name: input.name,
      description: input.description,
      brand: input.brand,
      model: input.model,
      productType: input.productType,
      unitOfMeasure: input.unitOfMeasure,
      costPrice: input.costPrice,
      salePrice: input.salePrice,
      marginPercent: input.marginPercent,
      taxRate: input.taxRate,
      trackInventory: input.trackInventory,
      minStockLevel: input.minStockLevel,
      maxStockLevel: input.maxStockLevel,
      reorderQty: input.reorderQty,
      weight: input.weight,
      dimensions: input.dimensions as Prisma.InputJsonValue,
      imageUrl: input.imageUrl,
      images: input.images,
      isActive: input.isActive,
      isSerialTracked: input.isSerialTracked,
    },
    include: {
      category: true,
    },
  });

  return product as unknown as Product;
}

/**
 * Delete a product (soft delete by deactivating)
 */
export async function deleteProduct(
  organizationId: string,
  productId: string,
  hardDelete: boolean = false
): Promise<{ deleted: boolean }> {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      organizationId,
    },
    include: {
      _count: {
        select: {
          stockMovements: true,
          jobMaterials: true,
          inventoryLevels: true,
        },
      },
    },
  });

  if (!product) {
    throw new Error('Producto no encontrado');
  }

  // Check if product has been used
  const hasHistory =
    product._count.stockMovements > 0 ||
    product._count.jobMaterials > 0;

  if (hardDelete && hasHistory) {
    throw new Error('No se puede eliminar el producto porque tiene historial de uso');
  }

  if (hardDelete && !hasHistory) {
    // Delete inventory levels first
    await prisma.inventoryLevel.deleteMany({
      where: { productId },
    });

    // Delete the product
    await prisma.product.delete({
      where: { id: productId },
    });

    return { deleted: true };
  }

  // Soft delete
  await prisma.product.update({
    where: { id: productId },
    data: { isActive: false },
  });

  return { deleted: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT LISTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * List products with filters and pagination
 */
export async function listProducts(
  organizationId: string,
  filters: ProductFilters = {},
  options: ProductListOptions = {}
): Promise<ProductListResult> {
  const {
    page = 1,
    pageSize = 20,
    sortBy = 'name',
    sortOrder = 'asc',
    includeVariants = false,
    includeCategory = true,
    includeInventory = false,
  } = options;

  // Build where clause
  const where: Prisma.ProductWhereInput = {
    organizationId,
  };

  // Category filter (include descendants)
  if (filters.categoryId) {
    const categoryIds = await getDescendantCategoryIds(organizationId, filters.categoryId);
    where.categoryId = { in: categoryIds };
  } else if (filters.categoryId === null) {
    where.categoryId = null;
  }

  if (filters.productType) {
    where.productType = filters.productType;
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters.trackInventory !== undefined) {
    where.trackInventory = filters.trackInventory;
  }

  if (filters.brand) {
    where.brand = { contains: filters.brand, mode: 'insensitive' };
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { sku: { contains: filters.search, mode: 'insensitive' } },
      { barcode: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.minPrice !== undefined) {
    where.salePrice = { gte: filters.minPrice };
  }

  if (filters.maxPrice !== undefined) {
    where.salePrice = {
      ...(where.salePrice as object || {}),
      lte: filters.maxPrice,
    };
  }

  // Get total count
  const total = await prisma.product.count({ where });

  // Build order by
  const orderBy: Prisma.ProductOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  // Get products
  const products = await prisma.product.findMany({
    where,
    include: {
      category: includeCategory,
      variants: includeVariants,
      inventoryLevels: includeInventory ? {
        select: {
          quantityOnHand: true,
          quantityReserved: true,
          quantityAvailable: true,
        },
      } : false,
    },
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // Calculate inventory totals if requested
  let productsWithInventory: ProductWithInventory[];

  if (includeInventory) {
    productsWithInventory = products.map(p => {
      const levels = (p as any).inventoryLevels || [];
      type LevelType = typeof levels[number];
      const totalOnHand = levels.reduce((sum: number, l: LevelType) => sum + l.quantityOnHand, 0);
      const totalReserved = levels.reduce((sum: number, l: LevelType) => sum + l.quantityReserved, 0);
      const totalAvailable = levels.reduce((sum: number, l: LevelType) => sum + l.quantityAvailable, 0);

      let stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
      if (totalAvailable <= 0) {
        stockStatus = 'OUT_OF_STOCK';
      } else if (totalOnHand <= p.minStockLevel) {
        stockStatus = 'LOW_STOCK';
      } else {
        stockStatus = 'IN_STOCK';
      }

      return {
        ...p,
        totalOnHand,
        totalReserved,
        totalAvailable,
        stockStatus,
      } as unknown as ProductWithInventory;
    });
  } else {
    productsWithInventory = products.map(p => ({
      ...p,
      totalOnHand: 0,
      totalReserved: 0,
      totalAvailable: 0,
      stockStatus: 'IN_STOCK' as const,
    })) as unknown as ProductWithInventory[];
  }

  // Apply stock filters after inventory calculation
  if (filters.lowStock) {
    productsWithInventory = productsWithInventory.filter(
      p => p.stockStatus === 'LOW_STOCK'
    );
  }
  if (filters.outOfStock) {
    productsWithInventory = productsWithInventory.filter(
      p => p.stockStatus === 'OUT_OF_STOCK'
    );
  }

  return {
    products: productsWithInventory,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Search products (quick search)
 */
export async function searchProducts(
  organizationId: string,
  query: string,
  limit: number = 10
): Promise<Product[]> {
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } },
        { barcode: { contains: query, mode: 'insensitive' } },
      ],
    },
    include: {
      category: true,
    },
    take: limit,
    orderBy: { name: 'asc' },
  });

  return products as unknown as Product[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a product variant
 */
export async function createVariant(input: CreateVariantInput): Promise<ProductVariant> {
  // Verify product exists
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
  });
  if (!product) {
    throw new Error('Producto no encontrado');
  }

  // Check SKU uniqueness
  const existing = await prisma.productVariant.findFirst({
    where: {
      productId: input.productId,
      sku: input.sku,
    },
  });
  if (existing) {
    throw new Error(`Ya existe una variante con el SKU "${input.sku}"`);
  }

  const variant = await prisma.productVariant.create({
    data: {
      productId: input.productId,
      sku: input.sku,
      name: input.name,
      attributes: input.attributes as Prisma.InputJsonValue,
      costPrice: input.costPrice,
      salePrice: input.salePrice,
      barcode: input.barcode || null,
      isActive: input.isActive ?? true,
    },
    include: {
      product: true,
    },
  });

  return variant as unknown as ProductVariant;
}

/**
 * Get variants for a product
 */
export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  const variants = await prisma.productVariant.findMany({
    where: { productId },
    orderBy: { name: 'asc' },
  });

  return variants as unknown as ProductVariant[];
}

/**
 * Update a variant
 */
export async function updateVariant(
  variantId: string,
  input: UpdateVariantInput
): Promise<ProductVariant> {
  const existing = await prisma.productVariant.findUnique({
    where: { id: variantId },
  });
  if (!existing) {
    throw new Error('Variante no encontrada');
  }

  // Check SKU uniqueness if changing
  if (input.sku && input.sku !== existing.sku) {
    const skuExists = await prisma.productVariant.findFirst({
      where: {
        productId: existing.productId,
        sku: input.sku,
        id: { not: variantId },
      },
    });
    if (skuExists) {
      throw new Error(`Ya existe una variante con el SKU "${input.sku}"`);
    }
  }

  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      sku: input.sku,
      name: input.name,
      attributes: input.attributes as Prisma.InputJsonValue,
      costPrice: input.costPrice,
      salePrice: input.salePrice,
      barcode: input.barcode,
      isActive: input.isActive,
    },
    include: {
      product: true,
    },
  });

  return variant as unknown as ProductVariant;
}

/**
 * Delete a variant
 */
export async function deleteVariant(variantId: string): Promise<{ deleted: boolean }> {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      _count: {
        select: {
          inventoryLevels: true,
          stockMovements: true,
        },
      },
    },
  });

  if (!variant) {
    throw new Error('Variante no encontrada');
  }

  const hasHistory = variant._count.stockMovements > 0;

  if (hasHistory) {
    // Soft delete
    await prisma.productVariant.update({
      where: { id: variantId },
      data: { isActive: false },
    });
  } else {
    // Delete inventory levels
    await prisma.inventoryLevel.deleteMany({
      where: { variantId },
    });

    // Hard delete
    await prisma.productVariant.delete({
      where: { id: variantId },
    });
  }

  return { deleted: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Bulk update product prices
 */
export async function bulkUpdatePrices(
  organizationId: string,
  productIds: string[],
  field: 'costPrice' | 'salePrice',
  type: 'percentage' | 'fixed',
  value: number
): Promise<{ updated: number }> {
  let updated = 0;

  for (const productId of productIds) {
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId,
      },
    });

    if (!product) continue;

    let newValue: number;
    const currentValue = Number(product[field]);

    if (type === 'percentage') {
      newValue = currentValue * (1 + value / 100);
    } else {
      newValue = currentValue + value;
    }

    await prisma.product.update({
      where: { id: productId },
      data: { [field]: Math.max(0, newValue) },
    });

    updated++;
  }

  return { updated };
}

/**
 * Bulk update product category
 */
export async function bulkUpdateCategory(
  organizationId: string,
  productIds: string[],
  categoryId: string | null
): Promise<{ updated: number }> {
  const result = await prisma.product.updateMany({
    where: {
      id: { in: productIds },
      organizationId,
    },
    data: { categoryId },
  });

  return { updated: result.count };
}

/**
 * Bulk activate/deactivate products
 */
export async function bulkSetActive(
  organizationId: string,
  productIds: string[],
  isActive: boolean
): Promise<{ updated: number }> {
  const result = await prisma.product.updateMany({
    where: {
      id: { in: productIds },
      organizationId,
    },
    data: { isActive },
  });

  return { updated: result.count };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEQUENCE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get next SKU sequence number
 */
export async function getNextSkuSequence(organizationId: string): Promise<number> {
  const result = await prisma.product.aggregate({
    where: { organizationId },
    _count: true,
  });

  return (result._count || 0) + 1;
}

/**
 * Get next barcode sequence number
 */
export async function getNextBarcodeSequence(organizationId: string): Promise<number> {
  const result = await prisma.product.aggregate({
    where: {
      organizationId,
      barcode: { not: null },
    },
    _count: true,
  });

  return (result._count || 0) + 1;
}
