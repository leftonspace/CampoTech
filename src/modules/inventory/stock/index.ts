/**
 * Stock Management Module
 * Phase 12.3: Exports for stock management
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  MovementType,
  MovementDirection,
  ReservationStatus,
  CountType,
  CountStatus,
  WarehouseType,
  InventoryLevel,
  AdjustInventoryInput,
  TransferStockInput,
  StockLevelSummary,
  StockMovement,
  CreateMovementInput,
  MovementFilters,
  MovementListResult,
  StockReservation,
  CreateReservationInput,
  ReservationResult,
  InventoryCount,
  InventoryCountItem,
  CreateCountInput,
  CountItemUpdate,
  CountSummary,
  Warehouse,
  CreateWarehouseInput,
  UpdateWarehouseInput,
  StorageLocation,
  CreateStorageLocationInput,
  StockValueReport,
  StockMovementReport,
  LowStockReport,
} from './stock.types';

export { MOVEMENT_TYPE_LABELS, COUNT_TYPE_LABELS } from './stock.types';

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY LEVEL SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Inventory queries
  getInventoryLevel,
  getProductInventoryLevels,
  getWarehouseInventoryLevels,
  getStockLevelSummary,
  getAvailableQuantity,
  // Inventory adjustments
  adjustInventory,
  transferStock,
  receivePurchaseOrderItems,
  // Warehouse management
  createWarehouse,
  getWarehouse,
  getAllWarehouses,
  getDefaultWarehouse,
  updateWarehouse,
  deleteWarehouse,
  // Storage locations
  createStorageLocation,
  getWarehouseStorageLocations,
  deleteStorageLocation,
} from './inventory-level.service';

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK MOVEMENT SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  generateMovementNumber,
  createMovement,
  getMovement,
  getMovementByNumber,
  listMovements,
  getProductMovements,
  getWarehouseMovements,
  getJobMovements,
  generateMovementReport,
  getMovementSummaryByType,
  getDailyMovementTotals,
  reverseMovement,
} from './stock-movement.service';

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK RESERVATION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  createReservation,
  getReservation,
  getJobReservations,
  getProductReservations,
  fulfillReservation,
  cancelReservation,
  cancelJobReservations,
  updateReservationQuantity,
  processExpiredReservations,
  getTotalReservedQuantity,
  getExpiringReservations,
  getReservationStats,
} from './stock-reservation.service';

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY COUNT SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  createInventoryCount,
  getInventoryCount,
  getInventoryCountWithDetails,
  listInventoryCounts,
  startInventoryCount,
  updateCountItems,
  completeCountingPhase,
  approveInventoryCount,
  cancelInventoryCount,
  getCountSummary,
  getWarehouseCountHistory,
  getProductsNeedingCount,
} from './inventory-count.service';
