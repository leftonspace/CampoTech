/**
 * Product Catalog Service
 * Phase 12.2: Main service for product management
 */

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
  ProductCategory,
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryTreeNode,
  PricingCalculation,
  ProductImportRow,
  ProductImportResult,
  BulkPriceUpdate,
} from './product.types';
import * as repository from './product.repository';
import * as categoryManager from './category-manager';
import {
  generateSKU,
  generateSKUFromName,
  generateBarcode,
  validateSKU,
  validateBarcode,
  generateVariantSKU,
} from './barcode-generator';

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new product
 */
export async function createProduct(input: CreateProductInput): Promise<Product> {
  // Validate SKU
  const skuValidation = validateSKU(input.sku);
  if (!skuValidation.valid) {
    throw new Error(skuValidation.error);
  }

  // Validate barcode if provided
  if (input.barcode) {
    const barcodeValidation = validateBarcode(input.barcode);
    if (!barcodeValidation.valid) {
      throw new Error(barcodeValidation.error);
    }
  }

  // Calculate margin if not provided
  if (input.marginPercent === undefined && input.costPrice > 0) {
    input.marginPercent = ((input.salePrice - input.costPrice) / input.costPrice) * 100;
  }

  return repository.createProduct(input);
}

/**
 * Create product with auto-generated SKU
 */
export async function createProductWithAutoSku(
  input: Omit<CreateProductInput, 'sku'> & { sku?: string },
  categoryCode?: string | null
): Promise<Product> {
  if (!input.sku) {
    const generated = await generateSKU(
      input.organizationId,
      categoryCode || null,
      repository.getNextSkuSequence
    );
    input.sku = generated.code;
  }

  return createProduct(input as CreateProductInput);
}

/**
 * Get product by ID
 */
export async function getProduct(
  organizationId: string,
  productId: string
): Promise<Product | null> {
  return repository.getProductById(organizationId, productId, {
    includeCategory: true,
    includeVariants: true,
  });
}

/**
 * Get product by SKU
 */
export async function getProductBySku(
  organizationId: string,
  sku: string
): Promise<Product | null> {
  return repository.getProductBySku(organizationId, sku);
}

/**
 * Get product by barcode
 */
export async function getProductByBarcode(
  organizationId: string,
  barcode: string
): Promise<Product | null> {
  return repository.getProductByBarcode(organizationId, barcode);
}

/**
 * Update a product
 */
export async function updateProduct(
  organizationId: string,
  productId: string,
  input: UpdateProductInput
): Promise<Product> {
  // Validate SKU if changing
  if (input.sku) {
    const skuValidation = validateSKU(input.sku);
    if (!skuValidation.valid) {
      throw new Error(skuValidation.error);
    }
  }

  // Validate barcode if changing
  if (input.barcode) {
    const barcodeValidation = validateBarcode(input.barcode);
    if (!barcodeValidation.valid) {
      throw new Error(barcodeValidation.error);
    }
  }

  // Recalculate margin if prices changed
  if (input.costPrice !== undefined || input.salePrice !== undefined) {
    const existingProduct = await repository.getProductById(organizationId, productId);
    if (existingProduct) {
      const costPrice = input.costPrice ?? Number(existingProduct.costPrice);
      const salePrice = input.salePrice ?? Number(existingProduct.salePrice);
      if (costPrice > 0) {
        input.marginPercent = ((salePrice - costPrice) / costPrice) * 100;
      }
    }
  }

  return repository.updateProduct(organizationId, productId, input);
}

/**
 * Delete a product
 */
export async function deleteProduct(
  organizationId: string,
  productId: string,
  hardDelete: boolean = false
): Promise<{ deleted: boolean }> {
  return repository.deleteProduct(organizationId, productId, hardDelete);
}

/**
 * List products with filters
 */
export async function listProducts(
  organizationId: string,
  filters?: ProductFilters,
  options?: ProductListOptions
): Promise<ProductListResult> {
  return repository.listProducts(organizationId, filters || {}, options || {});
}

/**
 * Search products (quick search)
 */
export async function searchProducts(
  organizationId: string,
  query: string,
  limit?: number
): Promise<Product[]> {
  return repository.searchProducts(organizationId, query, limit);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a product variant
 */
export async function createVariant(input: CreateVariantInput): Promise<ProductVariant> {
  // Validate SKU
  const skuValidation = validateSKU(input.sku);
  if (!skuValidation.valid) {
    throw new Error(skuValidation.error);
  }

  return repository.createVariant(input);
}

/**
 * Create variant with auto-generated SKU
 */
export async function createVariantWithAutoSku(
  productId: string,
  input: Omit<CreateVariantInput, 'productId' | 'sku'> & { sku?: string }
): Promise<ProductVariant> {
  const product = await repository.getProductById('', productId, { includeCategory: false });
  if (!product) {
    throw new Error('Producto no encontrado');
  }

  if (!input.sku) {
    input.sku = generateVariantSKU(product.sku, input.attributes);
  }

  return createVariant({
    ...input,
    productId,
    sku: input.sku,
  } as CreateVariantInput);
}

/**
 * Get product variants
 */
export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  return repository.getProductVariants(productId);
}

/**
 * Update a variant
 */
export async function updateVariant(
  variantId: string,
  input: UpdateVariantInput
): Promise<ProductVariant> {
  if (input.sku) {
    const skuValidation = validateSKU(input.sku);
    if (!skuValidation.valid) {
      throw new Error(skuValidation.error);
    }
  }

  return repository.updateVariant(variantId, input);
}

/**
 * Delete a variant
 */
export async function deleteVariant(variantId: string): Promise<{ deleted: boolean }> {
  return repository.deleteVariant(variantId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a category
 */
export async function createCategory(input: CreateCategoryInput): Promise<ProductCategory> {
  return categoryManager.createCategory(input);
}

/**
 * Get a category
 */
export async function getCategory(
  organizationId: string,
  categoryId: string
): Promise<ProductCategory | null> {
  return categoryManager.getCategory(organizationId, categoryId);
}

/**
 * Update a category
 */
export async function updateCategory(
  organizationId: string,
  categoryId: string,
  input: UpdateCategoryInput
): Promise<ProductCategory> {
  return categoryManager.updateCategory(organizationId, categoryId, input);
}

/**
 * Delete a category
 */
export async function deleteCategory(
  organizationId: string,
  categoryId: string,
  reassignTo?: string
): Promise<{ deleted: boolean; reassigned: number }> {
  return categoryManager.deleteCategory(organizationId, categoryId, reassignTo);
}

/**
 * Get all categories
 */
export async function getAllCategories(
  organizationId: string,
  includeInactive?: boolean
): Promise<ProductCategory[]> {
  return categoryManager.getAllCategories(organizationId, includeInactive);
}

/**
 * Get category tree
 */
export async function getCategoryTree(
  organizationId: string,
  includeInactive?: boolean
): Promise<CategoryTreeNode[]> {
  return categoryManager.getCategoryTree(organizationId, includeInactive);
}

/**
 * Get category path (breadcrumb)
 */
export async function getCategoryPath(
  organizationId: string,
  categoryId: string
): Promise<ProductCategory[]> {
  return categoryManager.getCategoryPath(organizationId, categoryId);
}

/**
 * Search categories
 */
export async function searchCategories(
  organizationId: string,
  query: string,
  limit?: number
): Promise<ProductCategory[]> {
  return categoryManager.searchCategories(organizationId, query, limit);
}

/**
 * Move category in hierarchy
 */
export async function moveCategory(
  organizationId: string,
  categoryId: string,
  newParentId: string | null,
  newSortOrder: number
): Promise<ProductCategory> {
  return categoryManager.moveCategory(organizationId, categoryId, newParentId, newSortOrder);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate pricing details
 */
export function calculatePricing(
  costPrice: number,
  marginPercent: number,
  taxRate: number = 21
): PricingCalculation {
  const salePrice = costPrice * (1 + marginPercent / 100);
  const priceWithTax = salePrice * (1 + taxRate / 100);
  const profit = salePrice - costPrice;

  return {
    costPrice: Math.round(costPrice * 100) / 100,
    marginPercent: Math.round(marginPercent * 100) / 100,
    salePrice: Math.round(salePrice * 100) / 100,
    taxRate,
    priceWithTax: Math.round(priceWithTax * 100) / 100,
    profit: Math.round(profit * 100) / 100,
  };
}

/**
 * Calculate margin from prices
 */
export function calculateMargin(costPrice: number, salePrice: number): number {
  if (costPrice <= 0) return 0;
  return ((salePrice - costPrice) / costPrice) * 100;
}

/**
 * Calculate sale price from cost and margin
 */
export function calculateSalePrice(costPrice: number, marginPercent: number): number {
  return costPrice * (1 + marginPercent / 100);
}

/**
 * Bulk update product prices
 */
export async function bulkUpdatePrices(
  organizationId: string,
  update: BulkPriceUpdate
): Promise<{ updated: number }> {
  return repository.bulkUpdatePrices(
    organizationId,
    update.productIds,
    update.field,
    update.type,
    update.value
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CODE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a new SKU for a product
 */
export async function generateProductSKU(
  organizationId: string,
  categoryCode?: string | null
): Promise<string> {
  const generated = await generateSKU(
    organizationId,
    categoryCode || null,
    repository.getNextSkuSequence
  );
  return generated.code;
}

/**
 * Generate a new barcode for a product
 */
export async function generateProductBarcode(
  organizationId: string,
  type: 'EAN13' | 'EAN8' | 'INTERNAL' = 'INTERNAL'
): Promise<string> {
  const generated = await generateBarcode(
    organizationId,
    repository.getNextBarcodeSequence,
    { type }
  );
  return generated.code;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT/EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Import products from data
 */
export async function importProducts(
  organizationId: string,
  rows: ProductImportRow[]
): Promise<ProductImportResult> {
  const result: ProductImportResult = {
    success: true,
    totalRows: rows.length,
    imported: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Check if product exists
      const existing = await repository.getProductBySku(organizationId, row.sku);

      if (existing) {
        // Update existing product
        await repository.updateProduct(organizationId, existing.id, {
          name: row.name,
          description: row.description,
          brand: row.brand,
          model: row.model,
          costPrice: row.costPrice,
          salePrice: row.salePrice,
          taxRate: row.taxRate,
          minStockLevel: row.minStockLevel,
          barcode: row.barcode,
          isActive: row.isActive,
        });
        result.updated++;
      } else {
        // Find category by code if provided
        let categoryId: string | null = null;
        if (row.categoryCode) {
          const categories = await categoryManager.searchCategories(
            organizationId,
            row.categoryCode,
            1
          );
          if (categories.length > 0) {
            categoryId = categories[0].id;
          }
        }

        // Create new product
        await repository.createProduct({
          organizationId,
          categoryId,
          sku: row.sku,
          name: row.name,
          description: row.description,
          brand: row.brand,
          model: row.model,
          productType: (row.productType as any) || 'PART',
          unitOfMeasure: row.unitOfMeasure || 'UNIDAD',
          costPrice: row.costPrice,
          salePrice: row.salePrice,
          taxRate: row.taxRate ?? 21,
          minStockLevel: row.minStockLevel ?? 0,
          barcode: row.barcode,
          isActive: row.isActive ?? true,
        });
        result.imported++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        row: i + 1,
        sku: row.sku,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  result.success = result.failed === 0;
  return result;
}

/**
 * Get products for export
 */
export async function getProductsForExport(
  organizationId: string,
  filters?: ProductFilters,
  includeInactive?: boolean
): Promise<Product[]> {
  const result = await repository.listProducts(
    organizationId,
    { ...filters, isActive: includeInactive ? undefined : true },
    { pageSize: 10000, includeCategory: true }
  );

  return result.products;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get product statistics
 */
export async function getProductStats(organizationId: string): Promise<{
  total: number;
  active: number;
  inactive: number;
  byType: Record<string, number>;
  withLowStock: number;
  outOfStock: number;
  categoryStats: Awaited<ReturnType<typeof categoryManager.getCategoryStats>>;
}> {
  const [allProducts, categoryStats] = await Promise.all([
    repository.listProducts(
      organizationId,
      {},
      { pageSize: 10000, includeInventory: true }
    ),
    categoryManager.getCategoryStats(organizationId),
  ]);

  const products = allProducts.products;
  const active = products.filter(p => p.isActive).length;
  const byType: Record<string, number> = {};

  for (const product of products) {
    byType[product.productType] = (byType[product.productType] || 0) + 1;
  }

  const withLowStock = products.filter(p => p.stockStatus === 'LOW_STOCK').length;
  const outOfStock = products.filter(p => p.stockStatus === 'OUT_OF_STOCK').length;

  return {
    total: products.length,
    active,
    inactive: products.length - active,
    byType,
    withLowStock,
    outOfStock,
    categoryStats,
  };
}
