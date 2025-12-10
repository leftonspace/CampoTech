/**
 * Vehicle/Technician Inventory Module
 * Phase 12.5: Exports for vehicle stock management
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  ReplenishmentStatus,
  VehicleStock,
  SetVehicleStockInput,
  UpdateVehicleStockInput,
  VehicleStockSummary,
  LoadVehicleInput,
  UnloadVehicleInput,
  LoadUnloadResult,
  ReplenishmentRequest,
  ReplenishmentItem,
  CreateReplenishmentInput,
  ProcessReplenishmentInput,
  TechnicianStockReport,
  FleetStockReport,
  StockConsumptionReport,
} from './vehicle-stock.types';

export { REPLENISHMENT_STATUS_LABELS } from './vehicle-stock.types';

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE STOCK SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Stock management
  getTechnicianStock,
  getVehicleStockItem,
  setVehicleStock,
  updateVehicleStock,
  removeFromVehicleStock,
  // Load/unload operations
  loadVehicle,
  unloadVehicle,
  useFromVehicle,
  // Summaries
  getTechnicianStockSummary,
  getTechniciansWithLowStock,
  // Reports
  generateTechnicianStockReport,
  generateFleetStockReport,
} from './vehicle-stock.service';

// ═══════════════════════════════════════════════════════════════════════════════
// REPLENISHMENT SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // CRUD
  createReplenishmentRequest,
  getReplenishmentRequest,
  getReplenishmentByNumber,
  listReplenishmentRequests,
  getPendingReplenishmentRequests,
  getTechnicianPendingRequests,
  // Workflow
  processReplenishmentRequest,
  markInTransit,
  completeReplenishment,
  cancelReplenishmentRequest,
  // Auto-replenishment
  generateReplenishmentSuggestions,
  createAutoReplenishment,
  // Statistics
  getReplenishmentStats,
} from './replenishment.service';
