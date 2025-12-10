/**
 * Purchasing Module
 * Phase 12.4: Exports for purchasing operations
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  POStatus,
  SupplierAddress,
  SupplierBankInfo,
  Supplier,
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierProduct,
  CreateSupplierProductInput,
  UpdateSupplierProductInput,
  PurchaseOrder,
  PurchaseOrderItem,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  AddPOItemInput,
  UpdatePOItemInput,
  CreatePOItemInput,
  PurchaseReceiving,
  ReceivingItemData,
  CreateReceivingInput,
  ReceivingItemInput,
  POFilters,
  POListResult,
  SupplierFilters,
  PurchasingStats,
  SupplierPerformance,
} from './purchasing.types';

export { PO_STATUS_LABELS, PO_STATUS_COLORS } from './purchasing.types';

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIER SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  createSupplier,
  createSupplierWithAutoCode,
  getSupplier,
  getSupplierByCode,
  updateSupplier,
  deleteSupplier,
  listSuppliers,
  searchSuppliers,
  // Supplier products
  addSupplierProduct,
  getSupplierProducts,
  getProductSuppliers,
  getPreferredSupplier,
  updateSupplierProduct,
  removeSupplierProduct,
  setPreferredSupplier,
  // Analytics
  getSupplierPerformance,
  getTopSuppliers,
} from './supplier.service';

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDER SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  createPurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrderByNumber,
  updatePurchaseOrder,
  deletePurchaseOrder,
  // Items
  addPurchaseOrderItem,
  updatePurchaseOrderItem,
  removePurchaseOrderItem,
  // Workflow
  submitForApproval,
  approvePurchaseOrder,
  markAsSent,
  cancelPurchaseOrder,
  // Listing
  listPurchaseOrders,
  getPendingReceiptOrders,
  // Statistics
  getPurchasingStats,
} from './purchase-order.service';

// ═══════════════════════════════════════════════════════════════════════════════
// RECEIVING SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  receivePurchaseOrder,
  getReceiving,
  getReceivingByNumber,
  getOrderReceivings,
  getRecentReceivings,
  quickReceiveOrder,
  getReceivingSummary,
  getReceivingsWithVariance,
} from './receiving.service';
