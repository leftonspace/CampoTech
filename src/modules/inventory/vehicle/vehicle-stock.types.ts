/**
 * Vehicle Stock Types
 * Phase 12.5: Type definitions for vehicle/technician inventory
 */

import { Decimal } from '@prisma/client/runtime/library';

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export type ReplenishmentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export const REPLENISHMENT_STATUS_LABELS: Record<ReplenishmentStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  IN_TRANSIT: 'En tránsito',
  COMPLETED: 'Completada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE STOCK
// ═══════════════════════════════════════════════════════════════════════════════

export interface VehicleStock {
  id: string;
  organizationId: string;
  technicianId: string;
  productId: string;
  quantity: number;
  minLevel: number;
  maxLevel: number | null;
  lastRefilledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  technician?: {
    id: string;
    name: string;
    phone: string;
  };
  product?: {
    id: string;
    name: string;
    sku: string;
    salePrice: Decimal;
    costPrice: Decimal;
  };
}

export interface SetVehicleStockInput {
  organizationId: string;
  technicianId: string;
  productId: string;
  quantity: number;
  minLevel?: number;
  maxLevel?: number | null;
}

export interface UpdateVehicleStockInput {
  quantity?: number;
  minLevel?: number;
  maxLevel?: number | null;
}

export interface VehicleStockSummary {
  technicianId: string;
  technicianName: string;
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  lastActivityAt: Date | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD/UNLOAD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface LoadVehicleInput {
  organizationId: string;
  technicianId: string;
  warehouseId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  notes?: string;
  performedById?: string;
}

export interface UnloadVehicleInput {
  organizationId: string;
  technicianId: string;
  warehouseId: string;
  items: Array<{
    productId: string;
    quantity: number;
    reason?: 'return' | 'damaged' | 'expired';
  }>;
  notes?: string;
  performedById?: string;
}

export interface LoadUnloadResult {
  success: boolean;
  itemsProcessed: number;
  movementIds: string[];
  errors: Array<{
    productId: string;
    error: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPLENISHMENT REQUEST
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReplenishmentRequest {
  id: string;
  organizationId: string;
  technicianId: string;
  warehouseId: string | null;
  requestNumber: string;
  status: ReplenishmentStatus;
  requestedAt: Date;
  processedAt: Date | null;
  processedById: string | null;
  notes: string | null;
  items: ReplenishmentItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReplenishmentItem {
  productId: string;
  productName?: string;
  quantity: number;
  notes?: string;
}

export interface CreateReplenishmentInput {
  organizationId: string;
  technicianId: string;
  warehouseId?: string;
  items: Array<{
    productId: string;
    quantity: number;
    notes?: string;
  }>;
  notes?: string;
}

export interface ProcessReplenishmentInput {
  requestId: string;
  action: 'approve' | 'reject';
  processedById: string;
  warehouseId?: string;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS & ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

export interface TechnicianStockReport {
  technicianId: string;
  technicianName: string;
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    minLevel: number;
    maxLevel: number | null;
    status: 'OK' | 'LOW' | 'OUT' | 'OVERSTOCK';
    unitValue: number;
    totalValue: number;
  }>;
  summary: {
    totalItems: number;
    totalValue: number;
    itemsOk: number;
    itemsLow: number;
    itemsOut: number;
    itemsOverstock: number;
  };
}

export interface FleetStockReport {
  organizationId: string;
  generatedAt: Date;
  totalTechnicians: number;
  totalValue: number;
  byTechnician: TechnicianStockReport[];
  lowStockAlerts: Array<{
    technicianId: string;
    technicianName: string;
    productId: string;
    productName: string;
    quantity: number;
    minLevel: number;
  }>;
}

export interface StockConsumptionReport {
  technicianId: string;
  technicianName: string;
  period: { from: Date; to: Date };
  consumption: Array<{
    productId: string;
    productName: string;
    quantityUsed: number;
    totalValue: number;
    jobCount: number;
  }>;
  totalValue: number;
  averagePerJob: number;
}
