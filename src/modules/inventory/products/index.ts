/**
 * Product Catalog Module
 * Phase 12.2: Exports for product management
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  ProductType,
  UnitOfMeasure,
  ProductCategory,
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryTreeNode,
  ProductDimensions,
  Product,
  CreateProductInput,
  UpdateProductInput,
  VariantAttributes,
  ProductVariant,
  CreateVariantInput,
  UpdateVariantInput,
  ProductFilters,
  ProductListOptions,
  ProductListResult,
  ProductWithInventory,
  PricingCalculation,
  BulkPriceUpdate,
  ProductImportRow,
  ProductImportResult,
  ProductExportOptions,
  SKUGeneratorConfig,
  BarcodeGeneratorConfig,
  GeneratedCode,
} from './product.types';

export { PRODUCT_TYPES, UNITS_OF_MEASURE } from './product.types';

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Product operations
  createProduct,
  createProductWithAutoSku,
  getProduct,
  getProductBySku,
  getProductByBarcode,
  updateProduct,
  deleteProduct,
  listProducts,
  searchProducts,
  // Variant operations
  createVariant,
  createVariantWithAutoSku,
  getProductVariants,
  updateVariant,
  deleteVariant,
  // Category operations
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
  getCategoryTree,
  getCategoryPath,
  searchCategories,
  moveCategory,
  // Pricing utilities
  calculatePricing,
  calculateMargin,
  calculateSalePrice,
  bulkUpdatePrices,
  // Code generation
  generateProductSKU,
  generateProductBarcode,
  // Import/Export
  importProducts,
  getProductsForExport,
  // Statistics
  getProductStats,
} from './product.service';

// ═══════════════════════════════════════════════════════════════════════════════
// BARCODE/SKU GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export {
  generateSKU,
  generateSKUFromName,
  generateBarcode,
  generateEAN13,
  generateEAN8,
  generateInternalBarcode,
  validateSKU,
  validateBarcode,
  validateEAN13,
  validateEAN8,
  generateVariantSKU,
} from './barcode-generator';

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export {
  getRootCategories,
  getDescendantCategoryIds,
  reorderCategories,
  getCategoryStats,
} from './category-manager';
