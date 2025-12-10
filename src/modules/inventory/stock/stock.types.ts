/**
 * Stock Management Types
 * Phase 12.3: Type definitions for stock management
 */

import { Decimal } from '@prisma/client/runtime/library';

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export type MovementType =
  | 'PURCHASE_RECEIPT'
  | 'SALE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'TRANSFER'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'INITIAL_STOCK'
  | 'COUNT_ADJUSTMENT'
  | 'SCRAP'
  | 'VEHICLE_LOAD'
  | 'VEHICLE_RETURN';

export type MovementDirection = 'IN' | 'OUT';

export type ReservationStatus = 'PENDING' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

export type CountType = 'FULL' | 'CYCLE' | 'SPOT' | 'ANNUAL';

export type CountStatus = 'DRAFT' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'APPROVED' | 'CANCELLED';

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  PURCHASE_RECEIPT: 'Recepción de compra',
  SALE: 'Venta/Uso',
  ADJUSTMENT_IN: 'Ajuste positivo',
  ADJUSTMENT_OUT: 'Ajuste negativo',
  TRANSFER: 'Transferencia',
  RETURN_IN: 'Devolución de cliente',
  RETURN_OUT: 'Devolución a proveedor',
  INITIAL_STOCK: 'Stock inicial',
  COUNT_ADJUSTMENT: 'Ajuste por conteo',
  SCRAP: 'Descarte/Merma',
  VEHICLE_LOAD: 'Carga a vehículo',
  VEHICLE_RETURN: 'Devolución de vehículo',
};

export const COUNT_TYPE_LABELS: Record<CountType, string> = {
  FULL: 'Conteo completo',
  CYCLE: 'Conteo cíclico',
  SPOT: 'Conteo puntual',
  ANNUAL: 'Conteo anual',
};

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY LEVEL
// ═══════════════════════════════════════════════════════════════════════════════

export interface InventoryLevel {
  id: string;
  organizationId: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  storageLocationId: string | null;
  quantityOnHand: number;
  quantityReserved: number;
  quantityOnOrder: number;
  quantityAvailable: number;
  lotNumber: string | null;
  expiryDate: Date | null;
  unitCost: Decimal;
  totalCost: Decimal;
  lastCountedAt: Date | null;
  lastMovementAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdjustInventoryInput {
  organizationId: string;
  productId: string;
  variantId?: string | null;
  warehouseId: string;
  storageLocationId?: string | null;
  quantity: number;
  reason: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'INITIAL_STOCK' | 'SCRAP';
  notes?: string;
  unitCost?: number;
  performedById?: string;
  lotNumber?: string | null;
}

export interface TransferStockInput {
  organizationId: string;
  productId: string;
  variantId?: string | null;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  notes?: string;
  performedById?: string;
}

export interface StockLevelSummary {
  productId: string;
  productName: string;
  sku: string;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  totalOnOrder: number;
  minStockLevel: number;
  maxStockLevel: number | null;
  reorderQty: number | null;
  status: 'OK' | 'LOW' | 'OUT' | 'OVERSTOCK';
  warehouseBreakdown: Array<{
    warehouseId: string;
    warehouseName: string;
    onHand: number;
    reserved: number;
    available: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK MOVEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface StockMovement {
  id: string;
  organizationId: string;
  productId: string;
  variantId: string | null;
  movementNumber: string;
  movementType: MovementType;
  quantity: number;
  direction: MovementDirection;
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  jobId: string | null;
  purchaseOrderId: string | null;
  inventoryCountId: string | null;
  transferId: string | null;
  unitCost: Decimal;
  totalCost: Decimal;
  reference: string | null;
  notes: string | null;
  performedById: string | null;
  performedAt: Date;
  createdAt: Date;
}

export interface CreateMovementInput {
  organizationId: string;
  productId: string;
  variantId?: string | null;
  movementType: MovementType;
  quantity: number;
  direction: MovementDirection;
  fromWarehouseId?: string | null;
  toWarehouseId?: string | null;
  jobId?: string | null;
  purchaseOrderId?: string | null;
  inventoryCountId?: string | null;
  unitCost: number;
  reference?: string | null;
  notes?: string | null;
  performedById?: string | null;
}

export interface MovementFilters {
  productId?: string;
  warehouseId?: string;
  movementType?: MovementType;
  direction?: MovementDirection;
  jobId?: string;
  purchaseOrderId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  performedById?: string;
}

export interface MovementListResult {
  movements: StockMovement[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK RESERVATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface StockReservation {
  id: string;
  organizationId: string;
  productId: string;
  warehouseId: string;
  jobId: string;
  quantity: number;
  status: ReservationStatus;
  reservedAt: Date;
  fulfilledAt: Date | null;
  cancelledAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReservationInput {
  organizationId: string;
  productId: string;
  warehouseId: string;
  jobId: string;
  quantity: number;
  expiresAt?: Date | null;
}

export interface ReservationResult {
  success: boolean;
  reservation?: StockReservation;
  error?: string;
  availableQuantity?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY COUNT
// ═══════════════════════════════════════════════════════════════════════════════

export interface InventoryCount {
  id: string;
  organizationId: string;
  warehouseId: string;
  countNumber: string;
  countType: CountType;
  status: CountStatus;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  totalItems: number | null;
  matchedItems: number | null;
  varianceItems: number | null;
  totalVariance: Decimal | null;
  assignedToId: string | null;
  completedById: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryCountItem {
  id: string;
  inventoryCountId: string;
  productId: string;
  expectedQty: number;
  countedQty: number | null;
  variance: number | null;
  varianceValue: Decimal | null;
  notes: string | null;
  countedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCountInput {
  organizationId: string;
  warehouseId: string;
  countType: CountType;
  scheduledAt?: Date;
  assignedToId?: string;
  notes?: string;
  productIds?: string[]; // For cycle/spot counts
}

export interface CountItemUpdate {
  itemId: string;
  countedQty: number;
  notes?: string;
}

export interface CountSummary {
  countId: string;
  countNumber: string;
  status: CountStatus;
  totalItems: number;
  countedItems: number;
  matchedItems: number;
  varianceItems: number;
  totalVarianceValue: number;
  progress: number; // Percentage
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAREHOUSE
// ═══════════════════════════════════════════════════════════════════════════════

export type WarehouseType = 'MAIN' | 'SECONDARY' | 'TRANSIT' | 'VEHICLE';

export interface Warehouse {
  id: string;
  organizationId: string;
  locationId: string | null;
  code: string;
  name: string;
  type: WarehouseType;
  address: any | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  isDefault: boolean;
  allowNegative: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWarehouseInput {
  organizationId: string;
  locationId?: string | null;
  code: string;
  name: string;
  type?: WarehouseType;
  address?: any;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  isDefault?: boolean;
  allowNegative?: boolean;
}

export interface UpdateWarehouseInput {
  locationId?: string | null;
  code?: string;
  name?: string;
  type?: WarehouseType;
  address?: any;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  isDefault?: boolean;
  allowNegative?: boolean;
  isActive?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE LOCATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface StorageLocation {
  id: string;
  warehouseId: string;
  code: string;
  name: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStorageLocationInput {
  warehouseId: string;
  code: string;
  name?: string;
  description?: string;
  sortOrder?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS & ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

export interface StockValueReport {
  totalValue: number;
  totalItems: number;
  totalSKUs: number;
  byWarehouse: Array<{
    warehouseId: string;
    warehouseName: string;
    value: number;
    items: number;
  }>;
  byCategory: Array<{
    categoryId: string | null;
    categoryName: string;
    value: number;
    items: number;
  }>;
}

export interface StockMovementReport {
  period: { from: Date; to: Date };
  totalIn: number;
  totalOut: number;
  netChange: number;
  byType: Array<{
    type: MovementType;
    count: number;
    quantity: number;
    value: number;
  }>;
  topMovedProducts: Array<{
    productId: string;
    productName: string;
    totalIn: number;
    totalOut: number;
  }>;
}

export interface LowStockReport {
  products: Array<{
    productId: string;
    productName: string;
    sku: string;
    currentStock: number;
    minLevel: number;
    reorderQty: number | null;
    daysUntilStockout: number | null;
  }>;
  totalProducts: number;
  criticalCount: number; // Products at or below 25% of min level
}
