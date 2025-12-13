/**
 * Inter-Location Charges
 * ======================
 *
 * Manages financial transfers and charges between locations.
 * Handles:
 * - Revenue attribution for cross-location services
 * - Resource sharing costs (technician loans, equipment)
 * - Internal billing between locations
 * - Settlement calculations
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { TransferType, TransferStatus } from '../location.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface InterLocationCharge {
  id: string;
  organizationId: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  chargeType: ChargeType;
  description: string;
  referenceId?: string;
  referenceType?: ReferenceType;
  amount: number;
  status: ChargeStatus;
  createdById: string;
  approvedById?: string;
  createdAt: Date;
  settledAt?: Date;
  settlementId?: string;
  notes?: string;
}

export type ChargeType =
  | 'JOB_REVENUE_SHARE'      // Share of revenue for cross-location job
  | 'TECHNICIAN_LOAN'        // Cost for borrowed technician
  | 'EQUIPMENT_RENTAL'       // Equipment/vehicle usage fee
  | 'CUSTOMER_REFERRAL'      // Referral fee for customer
  | 'ADMINISTRATIVE_FEE'     // Admin overhead allocation
  | 'INVENTORY_TRANSFER'     // Cost of transferred materials
  | 'ADJUSTMENT';            // Manual adjustment

export type ReferenceType =
  | 'JOB'
  | 'INVOICE'
  | 'TRANSFER'
  | 'USER'
  | 'OTHER';

export type ChargeStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'SETTLED'
  | 'DISPUTED'
  | 'CANCELLED';

export interface CreateChargeInput {
  fromLocationId: string;
  toLocationId: string;
  chargeType: ChargeType;
  description: string;
  amount: number;
  referenceId?: string;
  referenceType?: ReferenceType;
  notes?: string;
}

export interface SettlementSummary {
  settlementId: string;
  organizationId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  locationBalances: {
    locationId: string;
    locationName: string;
    totalOwed: number;      // Amount this location owes to others
    totalDue: number;       // Amount owed to this location
    netBalance: number;     // Positive = receives, Negative = pays
  }[];
  totalCharges: number;
  chargeCount: number;
  status: 'DRAFT' | 'FINALIZED' | 'SETTLED';
  createdAt: Date;
  settledAt?: Date;
}

export interface LocationBalance {
  locationId: string;
  locationName: string;
  pendingCharges: {
    owed: number;
    due: number;
  };
  settledCharges: {
    owed: number;
    due: number;
  };
  netBalance: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class InterLocationChargeError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'InterLocationChargeError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTER-LOCATION CHARGES SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class InterLocationChargesService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create an inter-location charge
   */
  async createCharge(
    organizationId: string,
    userId: string,
    input: CreateChargeInput
  ): Promise<InterLocationCharge> {
    // Validate locations belong to organization
    const [fromLocation, toLocation] = await Promise.all([
      this.prisma.location.findFirst({
        where: { id: input.fromLocationId, organizationId },
      }),
      this.prisma.location.findFirst({
        where: { id: input.toLocationId, organizationId },
      }),
    ]);

    if (!fromLocation || !toLocation) {
      throw new InterLocationChargeError(
        'INVALID_LOCATION',
        'One or both locations not found',
        404
      );
    }

    if (input.fromLocationId === input.toLocationId) {
      throw new InterLocationChargeError(
        'SAME_LOCATION',
        'Cannot create charge between same location'
      );
    }

    if (input.amount <= 0) {
      throw new InterLocationChargeError(
        'INVALID_AMOUNT',
        'Charge amount must be positive'
      );
    }

    // Create the transfer record (reusing InterLocationTransfer model)
    const transfer = await this.prisma.interLocationTransfer.create({
      data: {
        organizationId,
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        transferType: this.mapChargeTypeToTransferType(input.chargeType),
        referenceId: input.referenceId,
        reason: input.description,
        notes: input.notes,
        amount: input.amount,
        status: 'PENDING',
        requestedById: userId,
        requestedAt: new Date(),
      },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    return this.mapTransferToCharge(transfer, input.chargeType);
  }

  /**
   * Approve a pending charge
   */
  async approveCharge(
    organizationId: string,
    chargeId: string,
    approverId: string
  ): Promise<InterLocationCharge> {
    const transfer = await this.prisma.interLocationTransfer.findFirst({
      where: {
        id: chargeId,
        organizationId,
        status: 'PENDING',
      },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    if (!transfer) {
      throw new InterLocationChargeError(
        'CHARGE_NOT_FOUND',
        'Pending charge not found',
        404
      );
    }

    const updated = await this.prisma.interLocationTransfer.update({
      where: { id: chargeId },
      data: {
        status: 'APPROVED',
        approvedById: approverId,
        approvedAt: new Date(),
      },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    return this.mapTransferToCharge(updated);
  }

  /**
   * Cancel a charge
   */
  async cancelCharge(
    organizationId: string,
    chargeId: string,
    reason?: string
  ): Promise<void> {
    const transfer = await this.prisma.interLocationTransfer.findFirst({
      where: {
        id: chargeId,
        organizationId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    if (!transfer) {
      throw new InterLocationChargeError(
        'CHARGE_NOT_FOUND',
        'Charge not found or already settled',
        404
      );
    }

    await this.prisma.interLocationTransfer.update({
      where: { id: chargeId },
      data: {
        status: 'CANCELLED',
        notes: reason ? `Cancelled: ${reason}` : transfer.notes,
      },
    });
  }

  /**
   * Get charges for a location
   */
  async getLocationCharges(
    organizationId: string,
    locationId: string,
    filters?: {
      status?: ChargeStatus;
      startDate?: Date;
      endDate?: Date;
      direction?: 'OWED' | 'DUE' | 'ALL';
    }
  ): Promise<InterLocationCharge[]> {
    const where: Prisma.InterLocationTransferWhereInput = {
      organizationId,
      amount: { not: null },
      ...(filters?.status && { status: filters.status }),
      ...(filters?.startDate && {
        requestedAt: { gte: filters.startDate },
      }),
      ...(filters?.endDate && {
        requestedAt: { lte: filters.endDate },
      }),
    };

    // Filter by direction
    if (filters?.direction === 'OWED') {
      where.fromLocationId = locationId;
    } else if (filters?.direction === 'DUE') {
      where.toLocationId = locationId;
    } else {
      where.OR = [
        { fromLocationId: locationId },
        { toLocationId: locationId },
      ];
    }

    const transfers = await this.prisma.interLocationTransfer.findMany({
      where,
      include: {
        fromLocation: true,
        toLocation: true,
      },
      orderBy: {
        requestedAt: 'desc',
      },
    });

    return transfers.map((t: typeof transfers[number]) => this.mapTransferToCharge(t));
  }

  /**
   * Get balance summary for all locations
   */
  async getOrganizationBalances(organizationId: string): Promise<LocationBalance[]> {
    const locations = await this.prisma.location.findMany({
      where: {
        organizationId,
        isActive: true,
      },
    });

    const balances: LocationBalance[] = [];

    for (const location of locations) {
      const balance = await this.getLocationBalance(organizationId, location.id);
      balances.push({
        locationId: location.id,
        locationName: location.name,
        ...balance,
      });
    }

    return balances.sort((a, b) => b.netBalance - a.netBalance);
  }

  /**
   * Get balance for a specific location
   */
  async getLocationBalance(
    organizationId: string,
    locationId: string
  ): Promise<Omit<LocationBalance, 'locationId' | 'locationName'>> {
    // Pending charges owed by this location
    const pendingOwed = await this.prisma.interLocationTransfer.aggregate({
      where: {
        organizationId,
        fromLocationId: locationId,
        status: { in: ['PENDING', 'APPROVED'] },
        amount: { not: null },
      },
      _sum: { amount: true },
    });

    // Pending charges due to this location
    const pendingDue = await this.prisma.interLocationTransfer.aggregate({
      where: {
        organizationId,
        toLocationId: locationId,
        status: { in: ['PENDING', 'APPROVED'] },
        amount: { not: null },
      },
      _sum: { amount: true },
    });

    // Settled charges owed by this location
    const settledOwed = await this.prisma.interLocationTransfer.aggregate({
      where: {
        organizationId,
        fromLocationId: locationId,
        status: 'COMPLETED',
        amount: { not: null },
      },
      _sum: { amount: true },
    });

    // Settled charges due to this location
    const settledDue = await this.prisma.interLocationTransfer.aggregate({
      where: {
        organizationId,
        toLocationId: locationId,
        status: 'COMPLETED',
        amount: { not: null },
      },
      _sum: { amount: true },
    });

    const pendingOwedAmount = Number(pendingOwed._sum.amount) || 0;
    const pendingDueAmount = Number(pendingDue._sum.amount) || 0;
    const settledOwedAmount = Number(settledOwed._sum.amount) || 0;
    const settledDueAmount = Number(settledDue._sum.amount) || 0;

    return {
      pendingCharges: {
        owed: pendingOwedAmount,
        due: pendingDueAmount,
      },
      settledCharges: {
        owed: settledOwedAmount,
        due: settledDueAmount,
      },
      netBalance: (pendingDueAmount + settledDueAmount) - (pendingOwedAmount + settledOwedAmount),
    };
  }

  /**
   * Create automatic charge for cross-location job
   */
  async createJobRevenueShare(
    organizationId: string,
    jobId: string,
    serviceLocationId: string,
    issuingLocationId: string,
    invoiceTotal: number,
    sharePercent: number = 10, // Default 10% to service location
    userId: string
  ): Promise<InterLocationCharge | null> {
    // Skip if same location
    if (serviceLocationId === issuingLocationId) {
      return null;
    }

    const shareAmount = (invoiceTotal * sharePercent) / 100;

    if (shareAmount <= 0) {
      return null;
    }

    return this.createCharge(organizationId, userId, {
      fromLocationId: issuingLocationId,
      toLocationId: serviceLocationId,
      chargeType: 'JOB_REVENUE_SHARE',
      description: `Revenue share for job service (${sharePercent}%)`,
      amount: shareAmount,
      referenceId: jobId,
      referenceType: 'JOB',
    });
  }

  /**
   * Create charge for technician loan
   */
  async createTechnicianLoanCharge(
    organizationId: string,
    technicianId: string,
    fromLocationId: string,
    toLocationId: string,
    hoursWorked: number,
    hourlyRate: number,
    userId: string,
    notes?: string
  ): Promise<InterLocationCharge> {
    const amount = hoursWorked * hourlyRate;

    return this.createCharge(organizationId, userId, {
      fromLocationId: toLocationId, // Borrowing location pays
      toLocationId: fromLocationId, // Home location receives
      chargeType: 'TECHNICIAN_LOAN',
      description: `Technician loan: ${hoursWorked}h @ $${hourlyRate}/h`,
      amount,
      referenceId: technicianId,
      referenceType: 'USER',
      notes,
    });
  }

  /**
   * Settle pending charges between locations
   */
  async settleCharges(
    organizationId: string,
    chargeIds: string[],
    settledById: string
  ): Promise<{ settled: number; total: number }> {
    const transfers = await this.prisma.interLocationTransfer.findMany({
      where: {
        id: { in: chargeIds },
        organizationId,
        status: 'APPROVED',
      },
    });

    if (transfers.length === 0) {
      throw new InterLocationChargeError(
        'NO_CHARGES_TO_SETTLE',
        'No approved charges found to settle'
      );
    }

    type TransferType = typeof transfers[number];
    const total = transfers.reduce((sum: number, t: TransferType) => sum + Number(t.amount || 0), 0);

    await this.prisma.interLocationTransfer.updateMany({
      where: {
        id: { in: transfers.map((t: TransferType) => t.id) },
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return {
      settled: transfers.length,
      total,
    };
  }

  /**
   * Get settlement summary for a period
   */
  async getSettlementSummary(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SettlementSummary> {
    const locations = await this.prisma.location.findMany({
      where: {
        organizationId,
        isActive: true,
      },
    });

    const transfers = await this.prisma.interLocationTransfer.findMany({
      where: {
        organizationId,
        status: { in: ['APPROVED', 'COMPLETED'] },
        amount: { not: null },
        requestedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    // Calculate balances per location
    const locationBalances = new Map<string, {
      name: string;
      owed: number;
      due: number;
    }>();

    for (const location of locations) {
      locationBalances.set(location.id, {
        name: location.name,
        owed: 0,
        due: 0,
      });
    }

    let totalCharges = 0;

    for (const transfer of transfers) {
      const amount = Number(transfer.amount);
      totalCharges += amount;

      const fromBalance = locationBalances.get(transfer.fromLocationId);
      const toBalance = locationBalances.get(transfer.toLocationId);

      if (fromBalance) {
        fromBalance.owed += amount;
      }
      if (toBalance) {
        toBalance.due += amount;
      }
    }

    type BalanceData = { name: string; owed: number; due: number };
    return {
      settlementId: `SETTLE-${Date.now()}`,
      organizationId,
      period: { startDate, endDate },
      locationBalances: (Array.from(locationBalances.entries()) as [string, BalanceData][]).map(([locationId, data]) => ({
        locationId,
        locationName: data.name,
        totalOwed: data.owed,
        totalDue: data.due,
        netBalance: data.due - data.owed,
      })),
      totalCharges,
      chargeCount: transfers.length,
      status: 'DRAFT',
      createdAt: new Date(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private mapChargeTypeToTransferType(chargeType: ChargeType): TransferType {
    switch (chargeType) {
      case 'JOB_REVENUE_SHARE':
        return 'JOB_ASSIGNMENT';
      case 'TECHNICIAN_LOAN':
        return 'TECHNICIAN_LOAN';
      case 'CUSTOMER_REFERRAL':
        return 'CUSTOMER_REFERRAL';
      case 'EQUIPMENT_RENTAL':
      case 'INVENTORY_TRANSFER':
        return 'RESOURCE_SHARE';
      case 'ADMINISTRATIVE_FEE':
      case 'ADJUSTMENT':
      default:
        return 'FINANCIAL';
    }
  }

  private mapTransferTypeToChargeType(transferType: TransferType): ChargeType {
    switch (transferType) {
      case 'JOB_ASSIGNMENT':
        return 'JOB_REVENUE_SHARE';
      case 'TECHNICIAN_LOAN':
        return 'TECHNICIAN_LOAN';
      case 'CUSTOMER_REFERRAL':
        return 'CUSTOMER_REFERRAL';
      case 'RESOURCE_SHARE':
        return 'EQUIPMENT_RENTAL';
      case 'FINANCIAL':
      default:
        return 'ADJUSTMENT';
    }
  }

  private mapTransferToCharge(
    transfer: any,
    chargeType?: ChargeType
  ): InterLocationCharge {
    return {
      id: transfer.id,
      organizationId: transfer.organizationId,
      fromLocationId: transfer.fromLocationId,
      fromLocationName: transfer.fromLocation?.name || '',
      toLocationId: transfer.toLocationId,
      toLocationName: transfer.toLocation?.name || '',
      chargeType: chargeType || this.mapTransferTypeToChargeType(transfer.transferType),
      description: transfer.reason || '',
      referenceId: transfer.referenceId,
      referenceType: this.inferReferenceType(transfer.transferType),
      amount: Number(transfer.amount) || 0,
      status: this.mapTransferStatusToChargeStatus(transfer.status),
      createdById: transfer.requestedById,
      approvedById: transfer.approvedById,
      createdAt: transfer.requestedAt || transfer.createdAt,
      settledAt: transfer.completedAt,
      notes: transfer.notes,
    };
  }

  private mapTransferStatusToChargeStatus(status: TransferStatus): ChargeStatus {
    switch (status) {
      case 'PENDING':
        return 'PENDING';
      case 'APPROVED':
      case 'IN_PROGRESS':
        return 'APPROVED';
      case 'COMPLETED':
        return 'SETTLED';
      case 'REJECTED':
        return 'DISPUTED';
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        return 'PENDING';
    }
  }

  private inferReferenceType(transferType: TransferType): ReferenceType {
    switch (transferType) {
      case 'JOB_ASSIGNMENT':
        return 'JOB';
      case 'TECHNICIAN_LOAN':
        return 'USER';
      case 'CUSTOMER_REFERRAL':
        return 'OTHER';
      default:
        return 'TRANSFER';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let interLocationChargesService: InterLocationChargesService | null = null;

export function getInterLocationChargesService(
  prisma?: PrismaClient
): InterLocationChargesService {
  if (!interLocationChargesService && prisma) {
    interLocationChargesService = new InterLocationChargesService(prisma);
  }
  if (!interLocationChargesService) {
    throw new Error('InterLocationChargesService not initialized');
  }
  return interLocationChargesService;
}
