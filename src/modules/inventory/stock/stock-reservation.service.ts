/**
 * Stock Reservation Service
 * Phase 12.3: Manage stock reservations for jobs
 */

import { prisma } from '@/lib/prisma';
import type {
  StockReservation,
  CreateReservationInput,
  ReservationResult,
  ReservationStatus,
} from './stock.types';

// ═══════════════════════════════════════════════════════════════════════════════
// RESERVATION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a stock reservation for a job
 */
export async function createReservation(
  input: CreateReservationInput
): Promise<ReservationResult> {
  const { organizationId, productId, warehouseId, jobId, quantity, expiresAt } = input;

  // Check available quantity
  const level = await prisma.inventoryLevel.findFirst({
    where: {
      organizationId,
      productId,
      warehouseId,
    },
  });

  const available = level?.quantityAvailable ?? 0;

  if (available < quantity) {
    return {
      success: false,
      error: `Stock insuficiente. Disponible: ${available}, Solicitado: ${quantity}`,
      availableQuantity: available,
    };
  }

  // Create reservation in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create reservation
    const reservation = await tx.stockReservation.create({
      data: {
        organizationId,
        productId,
        warehouseId,
        jobId,
        quantity,
        status: 'PENDING',
        expiresAt: expiresAt || null,
      },
    });

    // Update inventory level
    await tx.inventoryLevel.update({
      where: { id: level!.id },
      data: {
        quantityReserved: level!.quantityReserved + quantity,
        quantityAvailable: level!.quantityAvailable - quantity,
      },
    });

    return reservation;
  });

  return {
    success: true,
    reservation: result as StockReservation,
  };
}

/**
 * Get reservation by ID
 */
export async function getReservation(
  organizationId: string,
  reservationId: string
): Promise<StockReservation | null> {
  const reservation = await prisma.stockReservation.findFirst({
    where: {
      id: reservationId,
      organizationId,
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      job: { select: { id: true, jobNumber: true } },
    },
  });

  return reservation as StockReservation | null;
}

/**
 * Get reservations for a job
 */
export async function getJobReservations(
  organizationId: string,
  jobId: string
): Promise<StockReservation[]> {
  const reservations = await prisma.stockReservation.findMany({
    where: {
      organizationId,
      jobId,
      status: { in: ['PENDING', 'FULFILLED'] },
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      warehouse: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return reservations as StockReservation[];
}

/**
 * Get reservations for a product
 */
export async function getProductReservations(
  organizationId: string,
  productId: string,
  warehouseId?: string
): Promise<StockReservation[]> {
  const where: any = {
    organizationId,
    productId,
    status: 'PENDING',
  };

  if (warehouseId) {
    where.warehouseId = warehouseId;
  }

  const reservations = await prisma.stockReservation.findMany({
    where,
    include: {
      job: { select: { id: true, jobNumber: true, scheduledDate: true } },
      warehouse: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return reservations as StockReservation[];
}

/**
 * Fulfill a reservation (stock is consumed)
 */
export async function fulfillReservation(
  organizationId: string,
  reservationId: string
): Promise<StockReservation> {
  const reservation = await prisma.stockReservation.findFirst({
    where: {
      id: reservationId,
      organizationId,
      status: 'PENDING',
    },
  });

  if (!reservation) {
    throw new Error('Reservación no encontrada o ya procesada');
  }

  // Get inventory level
  const level = await prisma.inventoryLevel.findFirst({
    where: {
      organizationId,
      productId: reservation.productId,
      warehouseId: reservation.warehouseId,
    },
  });

  if (!level) {
    throw new Error('Nivel de inventario no encontrado');
  }

  // Update in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update reservation status
    const updated = await tx.stockReservation.update({
      where: { id: reservationId },
      data: {
        status: 'FULFILLED',
        fulfilledAt: new Date(),
      },
    });

    // Reduce reserved and on-hand quantities
    await tx.inventoryLevel.update({
      where: { id: level.id },
      data: {
        quantityOnHand: level.quantityOnHand - reservation.quantity,
        quantityReserved: level.quantityReserved - reservation.quantity,
        totalCost: (level.quantityOnHand - reservation.quantity) * Number(level.unitCost),
        lastMovementAt: new Date(),
      },
    });

    return updated;
  });

  return result as StockReservation;
}

/**
 * Cancel a reservation
 */
export async function cancelReservation(
  organizationId: string,
  reservationId: string,
  reason?: string
): Promise<StockReservation> {
  const reservation = await prisma.stockReservation.findFirst({
    where: {
      id: reservationId,
      organizationId,
      status: 'PENDING',
    },
  });

  if (!reservation) {
    throw new Error('Reservación no encontrada o ya procesada');
  }

  // Get inventory level
  const level = await prisma.inventoryLevel.findFirst({
    where: {
      organizationId,
      productId: reservation.productId,
      warehouseId: reservation.warehouseId,
    },
  });

  if (!level) {
    throw new Error('Nivel de inventario no encontrado');
  }

  // Update in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update reservation status
    const updated = await tx.stockReservation.update({
      where: { id: reservationId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    // Release reserved quantity
    await tx.inventoryLevel.update({
      where: { id: level.id },
      data: {
        quantityReserved: level.quantityReserved - reservation.quantity,
        quantityAvailable: level.quantityAvailable + reservation.quantity,
      },
    });

    return updated;
  });

  return result as StockReservation;
}

/**
 * Cancel all reservations for a job
 */
export async function cancelJobReservations(
  organizationId: string,
  jobId: string
): Promise<{ cancelled: number }> {
  const reservations = await prisma.stockReservation.findMany({
    where: {
      organizationId,
      jobId,
      status: 'PENDING',
    },
  });

  let cancelled = 0;
  for (const reservation of reservations) {
    try {
      await cancelReservation(organizationId, reservation.id);
      cancelled++;
    } catch (error) {
      console.error(`Error cancelling reservation ${reservation.id}:`, error);
    }
  }

  return { cancelled };
}

/**
 * Update reservation quantity
 */
export async function updateReservationQuantity(
  organizationId: string,
  reservationId: string,
  newQuantity: number
): Promise<ReservationResult> {
  const reservation = await prisma.stockReservation.findFirst({
    where: {
      id: reservationId,
      organizationId,
      status: 'PENDING',
    },
  });

  if (!reservation) {
    return {
      success: false,
      error: 'Reservación no encontrada o ya procesada',
    };
  }

  const level = await prisma.inventoryLevel.findFirst({
    where: {
      organizationId,
      productId: reservation.productId,
      warehouseId: reservation.warehouseId,
    },
  });

  if (!level) {
    return { success: false, error: 'Nivel de inventario no encontrado' };
  }

  const quantityDiff = newQuantity - reservation.quantity;

  // Check if increasing and enough stock
  if (quantityDiff > 0 && level.quantityAvailable < quantityDiff) {
    return {
      success: false,
      error: `Stock insuficiente. Disponible para aumentar: ${level.quantityAvailable}`,
      availableQuantity: level.quantityAvailable,
    };
  }

  // Update in transaction
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.stockReservation.update({
      where: { id: reservationId },
      data: { quantity: newQuantity },
    });

    await tx.inventoryLevel.update({
      where: { id: level.id },
      data: {
        quantityReserved: level.quantityReserved + quantityDiff,
        quantityAvailable: level.quantityAvailable - quantityDiff,
      },
    });

    return updated;
  });

  return {
    success: true,
    reservation: result as StockReservation,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESERVATION EXPIRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process expired reservations
 */
export async function processExpiredReservations(): Promise<{ expired: number }> {
  const now = new Date();

  const expiredReservations = await prisma.stockReservation.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lte: now },
    },
  });

  let expired = 0;
  for (const reservation of expiredReservations) {
    try {
      const level = await prisma.inventoryLevel.findFirst({
        where: {
          organizationId: reservation.organizationId,
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      });

      if (level) {
        await prisma.$transaction([
          prisma.stockReservation.update({
            where: { id: reservation.id },
            data: { status: 'EXPIRED' },
          }),
          prisma.inventoryLevel.update({
            where: { id: level.id },
            data: {
              quantityReserved: level.quantityReserved - reservation.quantity,
              quantityAvailable: level.quantityAvailable + reservation.quantity,
            },
          }),
        ]);
        expired++;
      }
    } catch (error) {
      console.error(`Error expiring reservation ${reservation.id}:`, error);
    }
  }

  return { expired };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESERVATION QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get total reserved quantity for a product
 */
export async function getTotalReservedQuantity(
  organizationId: string,
  productId: string,
  warehouseId?: string
): Promise<number> {
  const where: any = {
    organizationId,
    productId,
    status: 'PENDING',
  };

  if (warehouseId) {
    where.warehouseId = warehouseId;
  }

  const result = await prisma.stockReservation.aggregate({
    where,
    _sum: { quantity: true },
  });

  return result._sum.quantity || 0;
}

/**
 * Get reservations expiring soon
 */
export async function getExpiringReservations(
  organizationId: string,
  withinHours: number = 24
): Promise<StockReservation[]> {
  const expiryThreshold = new Date(Date.now() + withinHours * 60 * 60 * 1000);

  const reservations = await prisma.stockReservation.findMany({
    where: {
      organizationId,
      status: 'PENDING',
      expiresAt: {
        not: null,
        lte: expiryThreshold,
      },
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      job: { select: { id: true, jobNumber: true } },
    },
    orderBy: { expiresAt: 'asc' },
  });

  return reservations as StockReservation[];
}

/**
 * Get reservation statistics
 */
export async function getReservationStats(organizationId: string): Promise<{
  total: number;
  pending: number;
  fulfilled: number;
  cancelled: number;
  expired: number;
  totalReservedValue: number;
}> {
  const [counts, totalValue] = await Promise.all([
    prisma.stockReservation.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: true,
    }),
    prisma.$queryRaw<[{ total: number }]>`
      SELECT COALESCE(SUM(sr.quantity * p."costPrice"), 0) as total
      FROM stock_reservations sr
      JOIN products p ON sr."productId" = p.id
      WHERE sr."organizationId" = ${organizationId}
      AND sr.status = 'PENDING'
    `,
  ]);

  const stats = {
    total: 0,
    pending: 0,
    fulfilled: 0,
    cancelled: 0,
    expired: 0,
    totalReservedValue: Number(totalValue[0]?.total || 0),
  };

  type CountType = typeof counts[number];
  for (const count of counts as CountType[]) {
    const status = count.status as ReservationStatus;
    stats[status.toLowerCase() as keyof typeof stats] = count._count as number;
    stats.total += count._count;
  }

  return stats;
}
