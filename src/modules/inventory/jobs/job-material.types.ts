/**
 * Job Material Types
 * Phase 12.6: Type definitions for job-inventory integration
 */

import { Decimal } from '@prisma/client/runtime/library';

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export type MaterialSource = 'WAREHOUSE' | 'VEHICLE' | 'CUSTOMER' | 'PURCHASE';

export const MATERIAL_SOURCE_LABELS: Record<MaterialSource, string> = {
  WAREHOUSE: 'Almacén',
  VEHICLE: 'Vehículo',
  CUSTOMER: 'Cliente',
  PURCHASE: 'Compra directa',
};

// ═══════════════════════════════════════════════════════════════════════════════
// JOB MATERIAL
// ═══════════════════════════════════════════════════════════════════════════════

export interface JobMaterial {
  id: string;
  jobId: string;
  productId: string;
  estimatedQty: number;
  usedQty: number;
  returnedQty: number;
  unitPrice: Decimal;
  unitCost: Decimal;
  discount: Decimal;
  lineTotal: Decimal;
  sourceType: MaterialSource;
  sourceId: string | null;
  isInvoiced: boolean;
  notes: string | null;
  addedAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  product?: {
    id: string;
    name: string;
    sku: string;
    unitOfMeasure: string;
  };
}

export interface AddJobMaterialInput {
  jobId: string;
  productId: string;
  quantity: number;
  unitPrice?: number;
  discount?: number;
  sourceType?: MaterialSource;
  sourceId?: string;
  notes?: string;
  reserveStock?: boolean;
}

export interface UpdateJobMaterialInput {
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  notes?: string;
}

export interface UseMaterialInput {
  jobMaterialId: string;
  usedQty: number;
  fromVehicle?: boolean;
  technicianId?: string;
}

export interface ReturnMaterialInput {
  jobMaterialId: string;
  returnedQty: number;
  reason?: string;
  toWarehouseId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB MATERIAL SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

export interface JobMaterialSummary {
  jobId: string;
  totalItems: number;
  totalEstimated: number;
  totalUsed: number;
  totalReturned: number;
  subtotal: number;
  discount: number;
  total: number;
  profit: number;
  profitMargin: number;
  hasReservations: boolean;
  hasPendingMaterials: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIAL ESTIMATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface MaterialEstimate {
  productId: string;
  productName: string;
  sku: string;
  estimatedQty: number;
  unitPrice: number;
  totalPrice: number;
  inStock: boolean;
  availableQty: number;
}

export interface JobEstimation {
  jobId: string;
  serviceType: string;
  materials: MaterialEstimate[];
  totalMaterialsCost: number;
  laborCost: number;
  totalEstimate: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIAL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MaterialTemplate {
  id: string;
  organizationId: string;
  name: string;
  serviceType: string;
  description: string | null;
  items: MaterialTemplateItem[];
  isActive: boolean;
}

export interface MaterialTemplateItem {
  productId: string;
  productName?: string;
  quantity: number;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface MaterialUsageReport {
  period: { from: Date; to: Date };
  totalJobs: number;
  totalMaterialsCost: number;
  totalMaterialsRevenue: number;
  totalProfit: number;
  averageMaterialsPerJob: number;
  byProduct: Array<{
    productId: string;
    productName: string;
    quantityUsed: number;
    totalCost: number;
    totalRevenue: number;
    jobCount: number;
  }>;
  byTechnician: Array<{
    technicianId: string;
    technicianName: string;
    totalMaterials: number;
    totalCost: number;
    totalRevenue: number;
    jobCount: number;
  }>;
}

export interface JobProfitabilityReport {
  jobId: string;
  jobNumber: string;
  serviceType: string;
  customerName: string;
  technicianName: string;
  completedAt: Date;
  laborRevenue: number;
  materialRevenue: number;
  materialCost: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
}
