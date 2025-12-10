/**
 * Purchasing Types
 * Phase 12.4: Type definitions for purchase orders and suppliers
 */

import { Decimal } from '@prisma/client/runtime/library';

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export type POStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'SENT'
  | 'PARTIAL'
  | 'RECEIVED'
  | 'CANCELLED';

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  DRAFT: 'Borrador',
  PENDING: 'Pendiente de aprobación',
  APPROVED: 'Aprobada',
  SENT: 'Enviada al proveedor',
  PARTIAL: 'Parcialmente recibida',
  RECEIVED: 'Recibida completa',
  CANCELLED: 'Cancelada',
};

export const PO_STATUS_COLORS: Record<POStatus, string> = {
  DRAFT: 'gray',
  PENDING: 'yellow',
  APPROVED: 'blue',
  SENT: 'indigo',
  PARTIAL: 'orange',
  RECEIVED: 'green',
  CANCELLED: 'red',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIER
// ═══════════════════════════════════════════════════════════════════════════════

export interface SupplierAddress {
  street?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}

export interface SupplierBankInfo {
  bankName?: string;
  accountNumber?: string;
  cbu?: string;
  alias?: string;
}

export interface Supplier {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  legalName: string | null;
  cuit: string | null;
  taxCondition: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: SupplierAddress | null;
  paymentTermDays: number;
  creditLimit: Decimal | null;
  currency: string;
  bankInfo: SupplierBankInfo | null;
  isActive: boolean;
  rating: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSupplierInput {
  organizationId: string;
  code: string;
  name: string;
  legalName?: string;
  cuit?: string;
  taxCondition?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: SupplierAddress;
  paymentTermDays?: number;
  creditLimit?: number;
  currency?: string;
  bankInfo?: SupplierBankInfo;
  notes?: string;
}

export interface UpdateSupplierInput {
  code?: string;
  name?: string;
  legalName?: string;
  cuit?: string;
  taxCondition?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: SupplierAddress;
  paymentTermDays?: number;
  creditLimit?: number;
  currency?: string;
  bankInfo?: SupplierBankInfo;
  isActive?: boolean;
  rating?: number;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIER PRODUCT
// ═══════════════════════════════════════════════════════════════════════════════

export interface SupplierProduct {
  id: string;
  supplierId: string;
  productId: string;
  supplierSku: string | null;
  supplierName: string | null;
  purchasePrice: Decimal;
  minOrderQty: number;
  leadTimeDays: number | null;
  isPreferred: boolean;
  lastPurchaseAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSupplierProductInput {
  supplierId: string;
  productId: string;
  supplierSku?: string;
  supplierName?: string;
  purchasePrice: number;
  minOrderQty?: number;
  leadTimeDays?: number;
  isPreferred?: boolean;
}

export interface UpdateSupplierProductInput {
  supplierSku?: string;
  supplierName?: string;
  purchasePrice?: number;
  minOrderQty?: number;
  leadTimeDays?: number;
  isPreferred?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDER
// ═══════════════════════════════════════════════════════════════════════════════

export interface PurchaseOrder {
  id: string;
  organizationId: string;
  supplierId: string;
  warehouseId: string;
  orderNumber: string;
  status: POStatus;
  orderDate: Date;
  expectedDate: Date | null;
  receivedDate: Date | null;
  subtotal: Decimal;
  taxAmount: Decimal;
  total: Decimal;
  currency: string;
  shippingMethod: string | null;
  shippingCost: Decimal | null;
  trackingNumber: string | null;
  notes: string | null;
  internalNotes: string | null;
  createdById: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  quantityReceived: number;
  unitPrice: Decimal;
  discount: Decimal;
  taxRate: Decimal;
  lineTotal: Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePurchaseOrderInput {
  organizationId: string;
  supplierId: string;
  warehouseId: string;
  expectedDate?: Date;
  shippingMethod?: string;
  shippingCost?: number;
  notes?: string;
  internalNotes?: string;
  createdById?: string;
  items: CreatePOItemInput[];
}

export interface CreatePOItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  notes?: string;
}

export interface UpdatePurchaseOrderInput {
  supplierId?: string;
  warehouseId?: string;
  expectedDate?: Date;
  shippingMethod?: string;
  shippingCost?: number;
  trackingNumber?: string;
  notes?: string;
  internalNotes?: string;
}

export interface AddPOItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  notes?: string;
}

export interface UpdatePOItemInput {
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  taxRate?: number;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE RECEIVING
// ═══════════════════════════════════════════════════════════════════════════════

export interface PurchaseReceiving {
  id: string;
  purchaseOrderId: string;
  receivingNumber: string;
  receivedById: string | null;
  receivedAt: Date;
  notes: string | null;
  items: ReceivingItemData[];
  hasVariance: boolean;
  createdAt: Date;
}

export interface ReceivingItemData {
  productId: string;
  quantityExpected: number;
  quantityReceived: number;
  notes?: string;
}

export interface CreateReceivingInput {
  purchaseOrderId: string;
  receivedById?: string;
  notes?: string;
  items: ReceivingItemInput[];
}

export interface ReceivingItemInput {
  productId: string;
  quantityReceived: number;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILTERS & REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface POFilters {
  supplierId?: string;
  warehouseId?: string;
  status?: POStatus;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface POListResult {
  orders: PurchaseOrder[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SupplierFilters {
  isActive?: boolean;
  search?: string;
}

export interface PurchasingStats {
  totalOrders: number;
  pendingOrders: number;
  totalValue: number;
  averageOrderValue: number;
  topSuppliers: Array<{
    supplierId: string;
    supplierName: string;
    orderCount: number;
    totalValue: number;
  }>;
  byStatus: Record<POStatus, number>;
}

export interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  totalOrders: number;
  totalValue: number;
  averageLeadTime: number;
  onTimeDeliveryRate: number;
  qualityScore: number;
  lastOrderDate: Date | null;
}
