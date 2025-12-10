/**
 * Replenishment Service
 * Phase 12.5: Manage technician stock replenishment requests
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type {
  ReplenishmentRequest,
  ReplenishmentItem,
  CreateReplenishmentInput,
  ProcessReplenishmentInput,
  ReplenishmentStatus,
} from './vehicle-stock.types';
import { loadVehicle } from './vehicle-stock.service';

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST NUMBER GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

async function generateRequestNumber(organizationId: string): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  const count = await prisma.replenishmentRequest.count({
    where: {
      organizationId,
      createdAt: {
        gte: new Date(today.setHours(0, 0, 0, 0)),
      },
    },
  });

  const sequence = (count + 1).toString().padStart(3, '0');
  return `REP-${dateStr}-${sequence}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPLENISHMENT CRUD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a replenishment request
 */
export async function createReplenishmentRequest(
  input: CreateReplenishmentInput
): Promise<ReplenishmentRequest> {
  const { organizationId, technicianId, warehouseId, items, notes } = input;

  // Validate technician exists
  const technician = await prisma.user.findFirst({
    where: { id: technicianId, organizationId, role: 'TECHNICIAN' },
  });

  if (!technician) {
    throw new Error('Técnico no encontrado');
  }

  // Get product names for items
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });

  const productMap = new Map(products.map((p) => [p.id, p.name]));

  const itemsWithNames: ReplenishmentItem[] = items.map((item) => ({
    productId: item.productId,
    productName: productMap.get(item.productId) || 'Unknown',
    quantity: item.quantity,
    notes: item.notes,
  }));

  const requestNumber = await generateRequestNumber(organizationId);

  const request = await prisma.replenishmentRequest.create({
    data: {
      organizationId,
      technicianId,
      warehouseId: warehouseId || null,
      requestNumber,
      status: 'PENDING',
      requestedAt: new Date(),
      notes: notes || null,
      items: itemsWithNames as unknown as Prisma.InputJsonValue,
    },
  });

  return request as unknown as ReplenishmentRequest;
}

/**
 * Get replenishment request by ID
 */
export async function getReplenishmentRequest(
  organizationId: string,
  requestId: string
): Promise<ReplenishmentRequest | null> {
  const request = await prisma.replenishmentRequest.findFirst({
    where: {
      id: requestId,
      organizationId,
    },
  });

  return request as ReplenishmentRequest | null;
}

/**
 * Get replenishment request by number
 */
export async function getReplenishmentByNumber(
  organizationId: string,
  requestNumber: string
): Promise<ReplenishmentRequest | null> {
  const request = await prisma.replenishmentRequest.findFirst({
    where: {
      organizationId,
      requestNumber,
    },
  });

  return request as ReplenishmentRequest | null;
}

/**
 * List replenishment requests
 */
export async function listReplenishmentRequests(
  organizationId: string,
  options?: {
    technicianId?: string;
    status?: ReplenishmentStatus;
    page?: number;
    pageSize?: number;
  }
): Promise<{ requests: ReplenishmentRequest[]; total: number }> {
  const { technicianId, status, page = 1, pageSize = 20 } = options || {};

  const where: any = { organizationId };
  if (technicianId) where.technicianId = technicianId;
  if (status) where.status = status;

  const [total, requests] = await Promise.all([
    prisma.replenishmentRequest.count({ where }),
    prisma.replenishmentRequest.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { requests: requests as ReplenishmentRequest[], total };
}

/**
 * Get pending requests (for dispatch/warehouse team)
 */
export async function getPendingReplenishmentRequests(
  organizationId: string
): Promise<ReplenishmentRequest[]> {
  const requests = await prisma.replenishmentRequest.findMany({
    where: {
      organizationId,
      status: { in: ['PENDING', 'APPROVED'] },
    },
    orderBy: { requestedAt: 'asc' },
  });

  // Get technician names
  const techIds = [...new Set(requests.map((r) => r.technicianId))];
  const technicians = await prisma.user.findMany({
    where: { id: { in: techIds } },
    select: { id: true, name: true },
  });

  const techMap = new Map(technicians.map((t) => [t.id, t.name]));

  return requests.map((r) => ({
    ...r,
    technicianName: techMap.get(r.technicianId),
  })) as ReplenishmentRequest[];
}

/**
 * Get technician's pending requests
 */
export async function getTechnicianPendingRequests(
  organizationId: string,
  technicianId: string
): Promise<ReplenishmentRequest[]> {
  const requests = await prisma.replenishmentRequest.findMany({
    where: {
      organizationId,
      technicianId,
      status: { in: ['PENDING', 'APPROVED', 'IN_TRANSIT'] },
    },
    orderBy: { requestedAt: 'desc' },
  });

  return requests as ReplenishmentRequest[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPLENISHMENT WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process replenishment request (approve/reject)
 */
export async function processReplenishmentRequest(
  organizationId: string,
  input: ProcessReplenishmentInput
): Promise<ReplenishmentRequest> {
  const { requestId, action, processedById, warehouseId, notes } = input;

  const request = await prisma.replenishmentRequest.findFirst({
    where: {
      id: requestId,
      organizationId,
      status: 'PENDING',
    },
  });

  if (!request) {
    throw new Error('Solicitud no encontrada o ya procesada');
  }

  const newStatus: ReplenishmentStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

  const updated = await prisma.replenishmentRequest.update({
    where: { id: requestId },
    data: {
      status: newStatus,
      warehouseId: warehouseId || request.warehouseId,
      processedById,
      processedAt: new Date(),
      notes: notes ? `${request.notes || ''}\n[${action}]: ${notes}`.trim() : request.notes,
    },
  });

  return updated as unknown as ReplenishmentRequest;
}

/**
 * Mark request as in transit
 */
export async function markInTransit(
  organizationId: string,
  requestId: string
): Promise<ReplenishmentRequest> {
  const request = await prisma.replenishmentRequest.findFirst({
    where: {
      id: requestId,
      organizationId,
      status: 'APPROVED',
    },
  });

  if (!request) {
    throw new Error('Solicitud no encontrada o no está aprobada');
  }

  const updated = await prisma.replenishmentRequest.update({
    where: { id: requestId },
    data: { status: 'IN_TRANSIT' },
  });

  return updated as unknown as ReplenishmentRequest;
}

/**
 * Complete replenishment (items delivered to technician)
 */
export async function completeReplenishment(
  organizationId: string,
  requestId: string,
  performedById?: string
): Promise<ReplenishmentRequest> {
  const request = await prisma.replenishmentRequest.findFirst({
    where: {
      id: requestId,
      organizationId,
      status: { in: ['APPROVED', 'IN_TRANSIT'] },
    },
  });

  if (!request) {
    throw new Error('Solicitud no encontrada o no está lista para completar');
  }

  if (!request.warehouseId) {
    throw new Error('No se ha especificado el almacén origen');
  }

  const items = request.items as unknown as ReplenishmentItem[];

  // Load items to technician's vehicle
  const loadResult = await loadVehicle({
    organizationId,
    technicianId: request.technicianId,
    warehouseId: request.warehouseId,
    items: items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
    })),
    notes: `Reposición solicitud ${request.requestNumber}`,
    performedById,
  });

  if (!loadResult.success && loadResult.itemsProcessed === 0) {
    throw new Error(
      `Error al cargar items: ${loadResult.errors.map((e) => e.error).join(', ')}`
    );
  }

  const updated = await prisma.replenishmentRequest.update({
    where: { id: requestId },
    data: {
      status: 'COMPLETED',
      notes: loadResult.errors.length > 0
        ? `${request.notes || ''}\nItems con error: ${loadResult.errors.map((e) => e.productId).join(', ')}`
        : request.notes,
    },
  });

  return updated as unknown as ReplenishmentRequest;
}

/**
 * Cancel replenishment request
 */
export async function cancelReplenishmentRequest(
  organizationId: string,
  requestId: string,
  reason?: string
): Promise<ReplenishmentRequest> {
  const request = await prisma.replenishmentRequest.findFirst({
    where: {
      id: requestId,
      organizationId,
      status: { in: ['PENDING', 'APPROVED'] },
    },
  });

  if (!request) {
    throw new Error('Solicitud no encontrada o no puede ser cancelada');
  }

  const updated = await prisma.replenishmentRequest.update({
    where: { id: requestId },
    data: {
      status: 'CANCELLED',
      notes: reason ? `${request.notes || ''}\nCancelado: ${reason}`.trim() : request.notes,
    },
  });

  return updated as unknown as ReplenishmentRequest;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-REPLENISHMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate auto-replenishment suggestions for a technician
 */
export async function generateReplenishmentSuggestions(
  organizationId: string,
  technicianId: string
): Promise<ReplenishmentItem[]> {
  const vehicleStock = await prisma.vehicleStock.findMany({
    where: {
      technicianId,
      quantity: {
        lte: prisma.vehicleStock.fields.minLevel,
      },
    },
    include: {
      product: {
        select: { id: true, name: true },
      },
    },
  });

  const suggestions: ReplenishmentItem[] = [];

  for (const item of vehicleStock) {
    const targetQty = item.maxLevel || item.minLevel * 3; // Default to 3x min level
    const neededQty = targetQty - item.quantity;

    if (neededQty > 0) {
      suggestions.push({
        productId: item.productId,
        productName: (item.product as any)?.name || 'Unknown',
        quantity: neededQty,
        notes:
          item.quantity <= 0 ? 'Sin stock' : `Stock bajo (${item.quantity}/${item.minLevel})`,
      });
    }
  }

  return suggestions;
}

/**
 * Create auto-replenishment request for technician
 */
export async function createAutoReplenishment(
  organizationId: string,
  technicianId: string,
  warehouseId?: string
): Promise<ReplenishmentRequest | null> {
  const suggestions = await generateReplenishmentSuggestions(organizationId, technicianId);

  if (suggestions.length === 0) {
    return null;
  }

  return createReplenishmentRequest({
    organizationId,
    technicianId,
    warehouseId,
    items: suggestions.map((s) => ({
      productId: s.productId,
      quantity: s.quantity,
      notes: s.notes,
    })),
    notes: 'Solicitud automática por stock bajo',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get replenishment statistics
 */
export async function getReplenishmentStats(
  organizationId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<{
  total: number;
  pending: number;
  completed: number;
  rejected: number;
  averageProcessingTime: number;
  byTechnician: Array<{
    technicianId: string;
    technicianName: string;
    requestCount: number;
    completedCount: number;
  }>;
}> {
  const dateFilter: any = {};
  if (dateFrom) dateFilter.gte = dateFrom;
  if (dateTo) dateFilter.lte = dateTo;

  const requests = await prisma.replenishmentRequest.findMany({
    where: {
      organizationId,
      ...(dateFrom || dateTo ? { requestedAt: dateFilter } : {}),
    },
  });

  const byStatus = {
    total: requests.length,
    pending: 0,
    completed: 0,
    rejected: 0,
  };

  let totalProcessingTime = 0;
  let processedCount = 0;
  const techStats: Record<string, { count: number; completed: number }> = {};

  for (const req of requests) {
    if (req.status === 'PENDING' || req.status === 'APPROVED' || req.status === 'IN_TRANSIT') {
      byStatus.pending++;
    } else if (req.status === 'COMPLETED') {
      byStatus.completed++;
    } else if (req.status === 'REJECTED') {
      byStatus.rejected++;
    }

    if (req.processedAt) {
      const processingTime =
        (req.processedAt.getTime() - req.requestedAt.getTime()) / (1000 * 60 * 60);
      totalProcessingTime += processingTime;
      processedCount++;
    }

    if (!techStats[req.technicianId]) {
      techStats[req.technicianId] = { count: 0, completed: 0 };
    }
    techStats[req.technicianId].count++;
    if (req.status === 'COMPLETED') {
      techStats[req.technicianId].completed++;
    }
  }

  // Get technician names
  const techIds = Object.keys(techStats);
  const technicians = await prisma.user.findMany({
    where: { id: { in: techIds } },
    select: { id: true, name: true },
  });

  const techMap = new Map(technicians.map((t) => [t.id, t.name]));

  return {
    ...byStatus,
    averageProcessingTime: processedCount > 0 ? totalProcessingTime / processedCount : 0,
    byTechnician: Object.entries(techStats)
      .map(([technicianId, stats]) => ({
        technicianId,
        technicianName: techMap.get(technicianId) || 'Unknown',
        requestCount: stats.count,
        completedCount: stats.completed,
      }))
      .sort((a, b) => b.requestCount - a.requestCount),
  };
}
