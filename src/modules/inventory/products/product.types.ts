/**
 * Product Catalog Types
 * Phase 12.2: Product type definitions for inventory management
 */

import { Decimal } from '@prisma/client/runtime/library';

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export type ProductType = 'PART' | 'CONSUMABLE' | 'EQUIPMENT' | 'SERVICE';

export const PRODUCT_TYPES: Record<ProductType, string> = {
  PART: 'Repuesto',
  CONSUMABLE: 'Consumible',
  EQUIPMENT: 'Equipo/Herramienta',
  SERVICE: 'Servicio',
};

export type UnitOfMeasure =
  | 'UNIDAD'
  | 'METRO'
  | 'METRO2'
  | 'METRO3'
  | 'LITRO'
  | 'KG'
  | 'GRAMO'
  | 'ROLLO'
  | 'CAJA'
  | 'PACK';

export const UNITS_OF_MEASURE: Record<UnitOfMeasure, string> = {
  UNIDAD: 'Unidad',
  METRO: 'Metro',
  METRO2: 'Metro²',
  METRO3: 'Metro³',
  LITRO: 'Litro',
  KG: 'Kilogramo',
  GRAMO: 'Gramo',
  ROLLO: 'Rollo',
  CAJA: 'Caja',
  PACK: 'Pack',
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT CATEGORY
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProductCategory {
  id: string;
  organizationId: string;
  parentId: string | null;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  parent?: ProductCategory | null;
  children?: ProductCategory[];
  products?: Product[];
}

export interface CreateCategoryInput {
  organizationId: string;
  parentId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCategoryInput {
  parentId?: string | null;
  code?: string;
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CategoryTreeNode extends ProductCategory {
  children: CategoryTreeNode[];
  level: number;
  path: string[];
  productCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProductDimensions {
  length: number;
  width: number;
  height: number;
}

export interface Product {
  id: string;
  organizationId: string;
  categoryId: string | null;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  productType: ProductType;
  unitOfMeasure: string;
  costPrice: Decimal;
  salePrice: Decimal;
  marginPercent: Decimal | null;
  taxRate: Decimal;
  trackInventory: boolean;
  minStockLevel: number;
  maxStockLevel: number | null;
  reorderQty: number | null;
  weight: Decimal | null;
  dimensions: ProductDimensions | null;
  imageUrl: string | null;
  images: string[];
  isActive: boolean;
  isSerialTracked: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  category?: ProductCategory | null;
  variants?: ProductVariant[];
}

export interface CreateProductInput {
  organizationId: string;
  categoryId?: string | null;
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  brand?: string | null;
  model?: string | null;
  productType?: ProductType;
  unitOfMeasure?: string;
  costPrice: number;
  salePrice: number;
  marginPercent?: number | null;
  taxRate?: number;
  trackInventory?: boolean;
  minStockLevel?: number;
  maxStockLevel?: number | null;
  reorderQty?: number | null;
  weight?: number | null;
  dimensions?: ProductDimensions | null;
  imageUrl?: string | null;
  images?: string[];
  isActive?: boolean;
  isSerialTracked?: boolean;
}

export interface UpdateProductInput {
  categoryId?: string | null;
  sku?: string;
  barcode?: string | null;
  name?: string;
  description?: string | null;
  brand?: string | null;
  model?: string | null;
  productType?: ProductType;
  unitOfMeasure?: string;
  costPrice?: number;
  salePrice?: number;
  marginPercent?: number | null;
  taxRate?: number;
  trackInventory?: boolean;
  minStockLevel?: number;
  maxStockLevel?: number | null;
  reorderQty?: number | null;
  weight?: number | null;
  dimensions?: ProductDimensions | null;
  imageUrl?: string | null;
  images?: string[];
  isActive?: boolean;
  isSerialTracked?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT VARIANT
// ═══════════════════════════════════════════════════════════════════════════════

export interface VariantAttributes {
  [key: string]: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  attributes: VariantAttributes;
  costPrice: Decimal;
  salePrice: Decimal;
  barcode: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  product?: Product;
}

export interface CreateVariantInput {
  productId: string;
  sku: string;
  name: string;
  attributes: VariantAttributes;
  costPrice: number;
  salePrice: number;
  barcode?: string | null;
  isActive?: boolean;
}

export interface UpdateVariantInput {
  sku?: string;
  name?: string;
  attributes?: VariantAttributes;
  costPrice?: number;
  salePrice?: number;
  barcode?: string | null;
  isActive?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT FILTERS & QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProductFilters {
  categoryId?: string | null;
  productType?: ProductType;
  isActive?: boolean;
  trackInventory?: boolean;
  search?: string; // Search in name, sku, barcode
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  lowStock?: boolean; // Products below minStockLevel
  outOfStock?: boolean;
}

export interface ProductListOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'sku' | 'createdAt' | 'salePrice' | 'costPrice';
  sortOrder?: 'asc' | 'desc';
  includeVariants?: boolean;
  includeCategory?: boolean;
  includeInventory?: boolean;
}

export interface ProductListResult {
  products: ProductWithInventory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductWithInventory extends Product {
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING
// ═══════════════════════════════════════════════════════════════════════════════

export interface PricingCalculation {
  costPrice: number;
  marginPercent: number;
  salePrice: number;
  taxRate: number;
  priceWithTax: number;
  profit: number;
}

export interface BulkPriceUpdate {
  productIds: string[];
  type: 'percentage' | 'fixed';
  field: 'costPrice' | 'salePrice';
  value: number; // Percentage increase/decrease or fixed amount
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT/EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProductImportRow {
  sku: string;
  name: string;
  categoryCode?: string;
  description?: string;
  brand?: string;
  model?: string;
  productType?: string;
  unitOfMeasure?: string;
  costPrice: number;
  salePrice: number;
  taxRate?: number;
  minStockLevel?: number;
  barcode?: string;
  isActive?: boolean;
}

export interface ProductImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  updated: number;
  failed: number;
  errors: Array<{
    row: number;
    sku: string;
    error: string;
  }>;
}

export interface ProductExportOptions {
  format: 'csv' | 'xlsx';
  fields?: string[];
  filters?: ProductFilters;
  includeInactive?: boolean;
  includeVariants?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BARCODE/SKU GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface SKUGeneratorConfig {
  prefix?: string;
  includeCategory?: boolean;
  sequenceLength?: number;
  separator?: string;
}

export interface BarcodeGeneratorConfig {
  type: 'EAN13' | 'EAN8' | 'CODE128' | 'INTERNAL';
  prefix?: string;
  sequenceLength?: number;
}

export interface GeneratedCode {
  code: string;
  type: 'sku' | 'barcode';
  format: string;
}
