/**
 * Resource Sharing Service
 * ========================
 *
 * Manages sharing of resources (technicians, equipment, vehicles) between locations.
 * Handles temporary loans, permanent transfers, and resource availability.
 */

import { PrismaClient, TransferType, TransferStatus } from '@prisma/client';
import { CoverageCalculator } from '../coverage-calculator';
import { Coordinates } from '../location.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ResourceType = 'TECHNICIAN' | 'EQUIPMENT' | 'VEHICLE' | 'INVENTORY';

export interface SharedResource {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  startDate: Date;
  endDate?: Date;
  status: 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  transferId?: string;
}

export interface ResourceAvailability {
  resourceId: string;
  resourceType: ResourceType;
  resourceName: string;
  homeLocationId: string;
  homeLocationName: string;
  currentLocationId: string;
  currentLocationName: string;
  isAvailable: boolean;
  unavailableUntil?: Date;
  activeShares: SharedResource[];
}

export interface SharingRequest {
  resourceType: ResourceType;
  resourceId: string;
  fromLocationId: string;
  toLocationId: string;
  startDate: Date;
  endDate?: Date;
  reason: string;
  requestedById: string;
}

export interface SharingMetrics {
  organizationId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalShares: number;
  activeShares: number;
  completedShares: number;
  sharesByResourceType: Record<ResourceType, number>;
  sharesByLocation: {
    locationId: string;
    locationName: string;
    sentCount: number;
    receivedCount: number;
    netBalance: number;
  }[];
  averageShareDuration: number; // in days
}

export interface LocationResourceSummary {
  locationId: string;
  locationName: string;
  ownResources: {
    technicians: number;
    equipment: number;
    vehicles: number;
  };
  borrowedResources: {
    technicians: number;
    equipment: number;
    vehicles: number;
  };
  lentResources: {
    technicians: number;
    equipment: number;
    vehicles: number;
  };
  availableResources: {
    technicians: number;
    equipment: number;
    vehicles: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class ResourceSharingError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'ResourceSharingError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCE SHARING SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ResourceSharingService {
  private prisma: PrismaClient;
  private coverageCalculator: CoverageCalculator;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.coverageCalculator = new CoverageCalculator();
  }

  /**
   * Request to share a resource from one location to another
   */
  async requestResourceShare(
    organizationId: string,
    request: SharingRequest
  ): Promise<SharedResource> {
    // Validate locations
    const [fromLocation, toLocation] = await Promise.all([
      this.prisma.location.findFirst({
        where: { id: request.fromLocationId, organizationId, isActive: true },
      }),
      this.prisma.location.findFirst({
        where: { id: request.toLocationId, organizationId, isActive: true },
      }),
    ]);

    if (!fromLocation || !toLocation) {
      throw new ResourceSharingError(
        'LOCATION_NOT_FOUND',
        'One or both locations not found',
        404
      );
    }

    if (request.fromLocationId === request.toLocationId) {
      throw new ResourceSharingError(
        'SAME_LOCATION',
        'Cannot share resource with the same location'
      );
    }

    // Validate resource exists and belongs to from location
    await this.validateResourceOwnership(
      organizationId,
      request.resourceType,
      request.resourceId,
      request.fromLocationId
    );

    // Check if resource is already shared
    const existingShare = await this.getActiveShare(request.resourceId);
    if (existingShare) {
      throw new ResourceSharingError(
        'ALREADY_SHARED',
        'Resource is already being shared'
      );
    }

    // Determine transfer type based on resource type
    let transferType: TransferType;
    switch (request.resourceType) {
      case 'TECHNICIAN':
        transferType = TransferType.TECHNICIAN_LOAN;
        break;
      case 'EQUIPMENT':
        transferType = TransferType.EQUIPMENT_LOAN;
        break;
      case 'INVENTORY':
        transferType = TransferType.INVENTORY;
        break;
      default:
        transferType = TransferType.OTHER;
    }

    // Create transfer record
    const transfer = await this.prisma.interLocationTransfer.create({
      data: {
        organizationId,
        fromLocationId: request.fromLocationId,
        toLocationId: request.toLocationId,
        transferType,
        referenceId: request.resourceId,
        reason: request.reason,
        notes: request.endDate
          ? `Temporary share until ${request.endDate.toISOString()}`
          : 'Ongoing share',
        status: TransferStatus.PENDING,
        requestedById: request.requestedById,
      },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    return {
      id: transfer.id,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      resourceName: await this.getResourceName(request.resourceType, request.resourceId),
      fromLocationId: transfer.fromLocationId,
      fromLocationName: transfer.fromLocation.name,
      toLocationId: transfer.toLocationId,
      toLocationName: transfer.toLocation.name,
      startDate: request.startDate,
      endDate: request.endDate,
      status: 'PENDING',
      notes: request.reason,
      transferId: transfer.id,
    };
  }

  /**
   * Approve a resource sharing request
   */
  async approveResourceShare(
    transferId: string,
    approverId: string
  ): Promise<SharedResource> {
    const transfer = await this.prisma.interLocationTransfer.findUnique({
      where: { id: transferId },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    if (!transfer) {
      throw new ResourceSharingError(
        'TRANSFER_NOT_FOUND',
        'Transfer request not found',
        404
      );
    }

    if (transfer.status !== TransferStatus.PENDING) {
      throw new ResourceSharingError(
        'INVALID_STATUS',
        'Transfer is not in pending status'
      );
    }

    const updated = await this.prisma.interLocationTransfer.update({
      where: { id: transferId },
      data: {
        status: TransferStatus.APPROVED,
        approvedById: approverId,
        approvedAt: new Date(),
      },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    // If it's a technician, update their current assignment
    if (transfer.transferType === TransferType.TECHNICIAN_LOAN && transfer.referenceId) {
      // Note: For temporary loans, we don't change homeLocationId
      // Instead, we track it via the transfer record
    }

    return {
      id: updated.id,
      resourceType: this.transferTypeToResourceType(transfer.transferType),
      resourceId: transfer.referenceId || '',
      resourceName: await this.getResourceName(
        this.transferTypeToResourceType(transfer.transferType),
        transfer.referenceId || ''
      ),
      fromLocationId: updated.fromLocationId,
      fromLocationName: updated.fromLocation.name,
      toLocationId: updated.toLocationId,
      toLocationName: updated.toLocation.name,
      startDate: updated.approvedAt || new Date(),
      status: 'ACTIVE',
      notes: updated.notes || undefined,
      transferId: updated.id,
    };
  }

  /**
   * Complete/end a resource share
   */
  async completeResourceShare(
    transferId: string,
    completedById: string
  ): Promise<SharedResource> {
    const transfer = await this.prisma.interLocationTransfer.findUnique({
      where: { id: transferId },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    if (!transfer) {
      throw new ResourceSharingError(
        'TRANSFER_NOT_FOUND',
        'Transfer not found',
        404
      );
    }

    if (transfer.status !== TransferStatus.APPROVED) {
      throw new ResourceSharingError(
        'INVALID_STATUS',
        'Transfer is not in approved status'
      );
    }

    const updated = await this.prisma.interLocationTransfer.update({
      where: { id: transferId },
      data: {
        status: TransferStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    return {
      id: updated.id,
      resourceType: this.transferTypeToResourceType(transfer.transferType),
      resourceId: transfer.referenceId || '',
      resourceName: await this.getResourceName(
        this.transferTypeToResourceType(transfer.transferType),
        transfer.referenceId || ''
      ),
      fromLocationId: updated.fromLocationId,
      fromLocationName: updated.fromLocation.name,
      toLocationId: updated.toLocationId,
      toLocationName: updated.toLocation.name,
      startDate: updated.approvedAt || updated.requestedAt,
      endDate: updated.completedAt || undefined,
      status: 'COMPLETED',
      notes: updated.notes || undefined,
      transferId: updated.id,
    };
  }

  /**
   * Get all active shares for an organization
   */
  async getActiveShares(organizationId: string): Promise<SharedResource[]> {
    const transfers = await this.prisma.interLocationTransfer.findMany({
      where: {
        organizationId,
        status: TransferStatus.APPROVED,
        transferType: {
          in: [
            TransferType.TECHNICIAN_LOAN,
            TransferType.EQUIPMENT_LOAN,
            TransferType.INVENTORY,
          ],
        },
      },
      include: {
        fromLocation: true,
        toLocation: true,
      },
      orderBy: { approvedAt: 'desc' },
    });

    const shares: SharedResource[] = [];

    for (const transfer of transfers) {
      const resourceType = this.transferTypeToResourceType(transfer.transferType);
      shares.push({
        id: transfer.id,
        resourceType,
        resourceId: transfer.referenceId || '',
        resourceName: await this.getResourceName(resourceType, transfer.referenceId || ''),
        fromLocationId: transfer.fromLocationId,
        fromLocationName: transfer.fromLocation.name,
        toLocationId: transfer.toLocationId,
        toLocationName: transfer.toLocation.name,
        startDate: transfer.approvedAt || transfer.requestedAt,
        status: 'ACTIVE',
        notes: transfer.notes || undefined,
        transferId: transfer.id,
      });
    }

    return shares;
  }

  /**
   * Get shares for a specific location
   */
  async getLocationShares(
    organizationId: string,
    locationId: string,
    direction: 'sent' | 'received' | 'all' = 'all'
  ): Promise<SharedResource[]> {
    const where: any = {
      organizationId,
      status: { in: [TransferStatus.PENDING, TransferStatus.APPROVED] },
      transferType: {
        in: [
          TransferType.TECHNICIAN_LOAN,
          TransferType.EQUIPMENT_LOAN,
          TransferType.INVENTORY,
        ],
      },
    };

    if (direction === 'sent') {
      where.fromLocationId = locationId;
    } else if (direction === 'received') {
      where.toLocationId = locationId;
    } else {
      where.OR = [{ fromLocationId: locationId }, { toLocationId: locationId }];
    }

    const transfers = await this.prisma.interLocationTransfer.findMany({
      where,
      include: {
        fromLocation: true,
        toLocation: true,
      },
      orderBy: { requestedAt: 'desc' },
    });

    const shares: SharedResource[] = [];

    for (const transfer of transfers) {
      const resourceType = this.transferTypeToResourceType(transfer.transferType);
      shares.push({
        id: transfer.id,
        resourceType,
        resourceId: transfer.referenceId || '',
        resourceName: await this.getResourceName(resourceType, transfer.referenceId || ''),
        fromLocationId: transfer.fromLocationId,
        fromLocationName: transfer.fromLocation.name,
        toLocationId: transfer.toLocationId,
        toLocationName: transfer.toLocation.name,
        startDate: transfer.approvedAt || transfer.requestedAt,
        status: transfer.status === TransferStatus.APPROVED ? 'ACTIVE' : 'PENDING',
        notes: transfer.notes || undefined,
        transferId: transfer.id,
      });
    }

    return shares;
  }

  /**
   * Get resource availability across locations
   */
  async getResourceAvailability(
    organizationId: string,
    resourceType: ResourceType
  ): Promise<ResourceAvailability[]> {
    const availability: ResourceAvailability[] = [];

    if (resourceType === 'TECHNICIAN') {
      const technicians = await this.prisma.user.findMany({
        where: {
          organizationId,
          role: 'TECHNICIAN',
          isActive: true,
        },
        include: {
          homeLocation: true,
        },
      });

      for (const tech of technicians) {
        const activeShares = await this.getActiveSharesForResource(tech.id);
        const currentShare = activeShares.find((s) => s.status === 'ACTIVE');

        availability.push({
          resourceId: tech.id,
          resourceType: 'TECHNICIAN',
          resourceName: tech.name,
          homeLocationId: tech.homeLocationId || '',
          homeLocationName: tech.homeLocation?.name || 'Unassigned',
          currentLocationId: currentShare?.toLocationId || tech.homeLocationId || '',
          currentLocationName: currentShare?.toLocationName || tech.homeLocation?.name || 'Unassigned',
          isAvailable: !currentShare,
          activeShares,
        });
      }
    }

    return availability;
  }

  /**
   * Get sharing metrics for reporting
   */
  async getSharingMetrics(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SharingMetrics> {
    const transfers = await this.prisma.interLocationTransfer.findMany({
      where: {
        organizationId,
        requestedAt: {
          gte: startDate,
          lte: endDate,
        },
        transferType: {
          in: [
            TransferType.TECHNICIAN_LOAN,
            TransferType.EQUIPMENT_LOAN,
            TransferType.INVENTORY,
          ],
        },
      },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    // Count by status
    const activeShares = transfers.filter(
      (t) => t.status === TransferStatus.APPROVED
    ).length;
    const completedShares = transfers.filter(
      (t) => t.status === TransferStatus.COMPLETED
    ).length;

    // Count by resource type
    const sharesByResourceType: Record<ResourceType, number> = {
      TECHNICIAN: 0,
      EQUIPMENT: 0,
      VEHICLE: 0,
      INVENTORY: 0,
    };

    for (const transfer of transfers) {
      const resourceType = this.transferTypeToResourceType(transfer.transferType);
      sharesByResourceType[resourceType]++;
    }

    // Count by location
    const locationMap = new Map<
      string,
      { locationId: string; locationName: string; sentCount: number; receivedCount: number }
    >();

    for (const transfer of transfers) {
      // From location
      if (!locationMap.has(transfer.fromLocationId)) {
        locationMap.set(transfer.fromLocationId, {
          locationId: transfer.fromLocationId,
          locationName: transfer.fromLocation.name,
          sentCount: 0,
          receivedCount: 0,
        });
      }
      locationMap.get(transfer.fromLocationId)!.sentCount++;

      // To location
      if (!locationMap.has(transfer.toLocationId)) {
        locationMap.set(transfer.toLocationId, {
          locationId: transfer.toLocationId,
          locationName: transfer.toLocation.name,
          sentCount: 0,
          receivedCount: 0,
        });
      }
      locationMap.get(transfer.toLocationId)!.receivedCount++;
    }

    const sharesByLocation = Array.from(locationMap.values()).map((loc) => ({
      ...loc,
      netBalance: loc.receivedCount - loc.sentCount,
    }));

    // Calculate average duration
    let totalDuration = 0;
    let durationCount = 0;

    for (const transfer of transfers) {
      if (transfer.completedAt && transfer.approvedAt) {
        const duration =
          (transfer.completedAt.getTime() - transfer.approvedAt.getTime()) /
          (1000 * 60 * 60 * 24);
        totalDuration += duration;
        durationCount++;
      }
    }

    return {
      organizationId,
      period: { startDate, endDate },
      totalShares: transfers.length,
      activeShares,
      completedShares,
      sharesByResourceType,
      sharesByLocation,
      averageShareDuration: durationCount > 0 ? totalDuration / durationCount : 0,
    };
  }

  /**
   * Get resource summary for a location
   */
  async getLocationResourceSummary(
    organizationId: string,
    locationId: string
  ): Promise<LocationResourceSummary> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId },
    });

    if (!location) {
      throw new ResourceSharingError(
        'LOCATION_NOT_FOUND',
        'Location not found',
        404
      );
    }

    // Get own technicians
    const ownTechnicians = await this.prisma.user.count({
      where: {
        organizationId,
        homeLocationId: locationId,
        role: 'TECHNICIAN',
        isActive: true,
      },
    });

    // Get borrowed resources (approved transfers TO this location)
    const borrowedTransfers = await this.prisma.interLocationTransfer.findMany({
      where: {
        toLocationId: locationId,
        status: TransferStatus.APPROVED,
        transferType: {
          in: [TransferType.TECHNICIAN_LOAN, TransferType.EQUIPMENT_LOAN],
        },
      },
    });

    // Get lent resources (approved transfers FROM this location)
    const lentTransfers = await this.prisma.interLocationTransfer.findMany({
      where: {
        fromLocationId: locationId,
        status: TransferStatus.APPROVED,
        transferType: {
          in: [TransferType.TECHNICIAN_LOAN, TransferType.EQUIPMENT_LOAN],
        },
      },
    });

    const borrowedTechnicians = borrowedTransfers.filter(
      (t) => t.transferType === TransferType.TECHNICIAN_LOAN
    ).length;
    const borrowedEquipment = borrowedTransfers.filter(
      (t) => t.transferType === TransferType.EQUIPMENT_LOAN
    ).length;
    const lentTechnicians = lentTransfers.filter(
      (t) => t.transferType === TransferType.TECHNICIAN_LOAN
    ).length;
    const lentEquipment = lentTransfers.filter(
      (t) => t.transferType === TransferType.EQUIPMENT_LOAN
    ).length;

    return {
      locationId,
      locationName: location.name,
      ownResources: {
        technicians: ownTechnicians,
        equipment: 0, // Would need equipment model
        vehicles: 0, // Would need vehicle model
      },
      borrowedResources: {
        technicians: borrowedTechnicians,
        equipment: borrowedEquipment,
        vehicles: 0,
      },
      lentResources: {
        technicians: lentTechnicians,
        equipment: lentEquipment,
        vehicles: 0,
      },
      availableResources: {
        technicians: ownTechnicians + borrowedTechnicians - lentTechnicians,
        equipment: borrowedEquipment - lentEquipment,
        vehicles: 0,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private async validateResourceOwnership(
    organizationId: string,
    resourceType: ResourceType,
    resourceId: string,
    locationId: string
  ): Promise<void> {
    if (resourceType === 'TECHNICIAN') {
      const tech = await this.prisma.user.findFirst({
        where: {
          id: resourceId,
          organizationId,
          homeLocationId: locationId,
        },
      });

      if (!tech) {
        throw new ResourceSharingError(
          'RESOURCE_NOT_FOUND',
          'Technician not found or not assigned to this location',
          404
        );
      }
    }
    // Add validation for other resource types as needed
  }

  private async getActiveShare(resourceId: string): Promise<SharedResource | null> {
    const transfer = await this.prisma.interLocationTransfer.findFirst({
      where: {
        referenceId: resourceId,
        status: TransferStatus.APPROVED,
      },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    if (!transfer) {
      return null;
    }

    return {
      id: transfer.id,
      resourceType: this.transferTypeToResourceType(transfer.transferType),
      resourceId: resourceId,
      resourceName: await this.getResourceName(
        this.transferTypeToResourceType(transfer.transferType),
        resourceId
      ),
      fromLocationId: transfer.fromLocationId,
      fromLocationName: transfer.fromLocation.name,
      toLocationId: transfer.toLocationId,
      toLocationName: transfer.toLocation.name,
      startDate: transfer.approvedAt || transfer.requestedAt,
      status: 'ACTIVE',
      transferId: transfer.id,
    };
  }

  private async getActiveSharesForResource(resourceId: string): Promise<SharedResource[]> {
    const transfers = await this.prisma.interLocationTransfer.findMany({
      where: {
        referenceId: resourceId,
        status: { in: [TransferStatus.PENDING, TransferStatus.APPROVED] },
      },
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });

    const shares: SharedResource[] = [];

    for (const transfer of transfers) {
      shares.push({
        id: transfer.id,
        resourceType: this.transferTypeToResourceType(transfer.transferType),
        resourceId: resourceId,
        resourceName: await this.getResourceName(
          this.transferTypeToResourceType(transfer.transferType),
          resourceId
        ),
        fromLocationId: transfer.fromLocationId,
        fromLocationName: transfer.fromLocation.name,
        toLocationId: transfer.toLocationId,
        toLocationName: transfer.toLocation.name,
        startDate: transfer.approvedAt || transfer.requestedAt,
        status: transfer.status === TransferStatus.APPROVED ? 'ACTIVE' : 'PENDING',
        transferId: transfer.id,
      });
    }

    return shares;
  }

  private async getResourceName(
    resourceType: ResourceType,
    resourceId: string
  ): Promise<string> {
    if (!resourceId) return 'Unknown';

    if (resourceType === 'TECHNICIAN') {
      const user = await this.prisma.user.findUnique({
        where: { id: resourceId },
        select: { name: true },
      });
      return user?.name || 'Unknown Technician';
    }

    return `${resourceType} ${resourceId}`;
  }

  private transferTypeToResourceType(transferType: TransferType): ResourceType {
    switch (transferType) {
      case TransferType.TECHNICIAN_LOAN:
        return 'TECHNICIAN';
      case TransferType.EQUIPMENT_LOAN:
        return 'EQUIPMENT';
      case TransferType.INVENTORY:
        return 'INVENTORY';
      default:
        return 'EQUIPMENT';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let resourceSharingService: ResourceSharingService | null = null;

export function getResourceSharingService(
  prisma?: PrismaClient
): ResourceSharingService {
  if (!resourceSharingService && prisma) {
    resourceSharingService = new ResourceSharingService(prisma);
  }
  if (!resourceSharingService) {
    throw new Error('ResourceSharingService not initialized');
  }
  return resourceSharingService;
}
