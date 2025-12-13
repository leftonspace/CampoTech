/**
 * Location Service
 * ================
 *
 * Business logic for multi-location management.
 * Handles CRUD operations, validation, and business rules.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  Location,
  LocationWithRelations,
  Zone,
  ZoneWithRelations,
  LocationSettings,
  LocationAfipConfig,
  InterLocationTransfer,
  InterLocationTransferWithRelations,
  CreateLocationDTO,
  UpdateLocationDTO,
  CreateZoneDTO,
  UpdateZoneDTO,
  CreateLocationSettingsDTO,
  UpdateLocationSettingsDTO,
  CreateLocationAfipConfigDTO,
  UpdateLocationAfipConfigDTO,
  CreateInterLocationTransferDTO,
  UpdateInterLocationTransferDTO,
  LocationFilters,
  ZoneFilters,
  TransferFilters,
  LocationResponse,
  ZoneResponse,
  CoverageCheckResult,
  JobAssignmentSuggestion,
  LocationCapacity,
  Coordinates,
} from './location.types';
import { CoverageCalculator } from './coverage-calculator';
import { ZoneManager } from './zone-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class LocationError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'LocationError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class LocationService {
  private prisma: PrismaClient;
  private coverageCalculator: CoverageCalculator;
  private zoneManager: ZoneManager;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.coverageCalculator = new CoverageCalculator();
    this.zoneManager = new ZoneManager(prisma);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOCATION CRUD
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create a new location
   */
  async createLocation(organizationId: string, data: CreateLocationDTO): Promise<LocationWithRelations> {
    // Check for duplicate code within organization
    const existing = await this.prisma.location.findFirst({
      where: {
        organizationId,
        code: data.code,
      },
    });

    if (existing) {
      throw new LocationError('DUPLICATE_CODE', `Location with code "${data.code}" already exists`);
    }

    // If this is marked as headquarters, ensure no other headquarters exists
    if (data.isHeadquarters) {
      const existingHQ = await this.prisma.location.findFirst({
        where: {
          organizationId,
          isHeadquarters: true,
        },
      });

      if (existingHQ) {
        throw new LocationError(
          'HEADQUARTERS_EXISTS',
          'Organization already has a headquarters. Update the existing one or remove headquarters flag.'
        );
      }
    }

    // Validate manager exists in organization
    if (data.managerId) {
      const manager = await this.prisma.user.findFirst({
        where: {
          id: data.managerId,
          organizationId,
        },
      });

      if (!manager) {
        throw new LocationError('INVALID_MANAGER', 'Manager not found in organization', 404);
      }
    }

    const location = await this.prisma.location.create({
      data: {
        organizationId,
        code: data.code,
        name: data.name,
        type: data.type || 'BRANCH',
        address: data.address as any,
        coordinates: data.coordinates as any,
        timezone: data.timezone || 'America/Argentina/Buenos_Aires',
        phone: data.phone,
        email: data.email,
        managerId: data.managerId,
        isHeadquarters: data.isHeadquarters || false,
        coverageRadius: data.coverageRadius,
        coverageArea: data.coverageArea as any,
        isActive: true,
      },
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
        zones: true,
        settings: true,
        afipConfig: true,
        _count: {
          select: {
            jobs: true,
            customers: true,
            technicians: true,
          },
        },
      },
    });

    return this.mapToLocationWithRelations(location);
  }

  /**
   * Get location by ID
   */
  async getLocation(organizationId: string, locationId: string): Promise<LocationWithRelations> {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
      },
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
        zones: {
          where: { isActive: true },
          orderBy: { priority: 'desc' },
        },
        settings: true,
        afipConfig: true,
        _count: {
          select: {
            jobs: true,
            customers: true,
            technicians: true,
          },
        },
      },
    });

    if (!location) {
      throw new LocationError('LOCATION_NOT_FOUND', 'Location not found', 404);
    }

    return this.mapToLocationWithRelations(location);
  }

  /**
   * List locations with filters
   */
  async listLocations(
    organizationId: string,
    filters: LocationFilters & { page?: number; limit?: number }
  ): Promise<{ locations: LocationWithRelations[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);

    const where: Prisma.LocationWhereInput = {
      organizationId,
      ...(filters.type && { type: filters.type }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.isHeadquarters !== undefined && { isHeadquarters: filters.isHeadquarters }),
      ...(filters.managerId && { managerId: filters.managerId }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { code: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [locations, total] = await Promise.all([
      this.prisma.location.findMany({
        where,
        include: {
          manager: {
            select: { id: true, name: true, email: true },
          },
          zones: {
            where: { isActive: true },
          },
          settings: true,
          _count: {
            select: {
              jobs: true,
              customers: true,
              technicians: true,
            },
          },
        },
        orderBy: [
          { isHeadquarters: 'desc' },
          { name: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.location.count({ where }),
    ]);

    return {
      locations: locations.map((l: typeof locations[number]) => this.mapToLocationWithRelations(l)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update a location
   */
  async updateLocation(
    organizationId: string,
    locationId: string,
    data: UpdateLocationDTO
  ): Promise<LocationWithRelations> {
    // Verify location exists
    const existing = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
      },
    });

    if (!existing) {
      throw new LocationError('LOCATION_NOT_FOUND', 'Location not found', 404);
    }

    // Check for duplicate code if code is being changed
    if (data.code && data.code !== existing.code) {
      const duplicate = await this.prisma.location.findFirst({
        where: {
          organizationId,
          code: data.code,
          NOT: { id: locationId },
        },
      });

      if (duplicate) {
        throw new LocationError('DUPLICATE_CODE', `Location with code "${data.code}" already exists`);
      }
    }

    // If setting as headquarters, check for existing
    if (data.isHeadquarters && !existing.isHeadquarters) {
      const existingHQ = await this.prisma.location.findFirst({
        where: {
          organizationId,
          isHeadquarters: true,
          NOT: { id: locationId },
        },
      });

      if (existingHQ) {
        throw new LocationError(
          'HEADQUARTERS_EXISTS',
          'Organization already has a headquarters'
        );
      }
    }

    // Validate manager if being changed
    if (data.managerId && data.managerId !== existing.managerId) {
      const manager = await this.prisma.user.findFirst({
        where: {
          id: data.managerId,
          organizationId,
        },
      });

      if (!manager) {
        throw new LocationError('INVALID_MANAGER', 'Manager not found in organization', 404);
      }
    }

    // Build update data
    const updateData: Prisma.LocationUpdateInput = {};
    if (data.code !== undefined) updateData.code = data.code;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.address !== undefined) {
      updateData.address = { ...existing.address as any, ...data.address } as any;
    }
    if (data.coordinates !== undefined) updateData.coordinates = data.coordinates as any;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.managerId !== undefined) updateData.managerId = data.managerId;
    if (data.isHeadquarters !== undefined) updateData.isHeadquarters = data.isHeadquarters;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.coverageRadius !== undefined) updateData.coverageRadius = data.coverageRadius;
    if (data.coverageArea !== undefined) updateData.coverageArea = data.coverageArea as any;

    const location = await this.prisma.location.update({
      where: { id: locationId },
      data: updateData,
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
        zones: {
          where: { isActive: true },
        },
        settings: true,
        afipConfig: true,
        _count: {
          select: {
            jobs: true,
            customers: true,
            technicians: true,
          },
        },
      },
    });

    return this.mapToLocationWithRelations(location);
  }

  /**
   * Delete a location (soft delete by deactivating)
   */
  async deleteLocation(organizationId: string, locationId: string): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
      },
      include: {
        _count: {
          select: {
            jobs: true,
            customers: true,
          },
        },
      },
    });

    if (!location) {
      throw new LocationError('LOCATION_NOT_FOUND', 'Location not found', 404);
    }

    // Prevent deletion if location has active jobs
    const activeJobsCount = await this.prisma.job.count({
      where: {
        locationId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    });

    if (activeJobsCount > 0) {
      throw new LocationError(
        'LOCATION_HAS_ACTIVE_JOBS',
        `Cannot delete location with ${activeJobsCount} active jobs`
      );
    }

    // Soft delete
    await this.prisma.location.update({
      where: { id: locationId },
      data: { isActive: false },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOCATION SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get or create location settings
   */
  async getLocationSettings(organizationId: string, locationId: string): Promise<LocationSettings> {
    // Verify location belongs to organization
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId },
    });

    if (!location) {
      throw new LocationError('LOCATION_NOT_FOUND', 'Location not found', 404);
    }

    let settings = await this.prisma.locationSettings.findUnique({
      where: { locationId },
    });

    if (!settings) {
      // Create default settings
      settings = await this.prisma.locationSettings.create({
        data: {
          locationId,
          operatingHours: {},
          holidays: [],
          allowEmergencyJobs: true,
          pricingMultiplier: 1.0,
          notifyOnNewJob: true,
          notifyOnJobComplete: true,
          notificationEmails: [],
        },
      });
    }

    return this.mapToLocationSettings(settings);
  }

  /**
   * Update location settings
   */
  async updateLocationSettings(
    organizationId: string,
    locationId: string,
    data: UpdateLocationSettingsDTO
  ): Promise<LocationSettings> {
    // Verify location belongs to organization
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId },
    });

    if (!location) {
      throw new LocationError('LOCATION_NOT_FOUND', 'Location not found', 404);
    }

    const settings = await this.prisma.locationSettings.upsert({
      where: { locationId },
      create: {
        locationId,
        operatingHours: data.operatingHours || {},
        holidays: data.holidays || [],
        serviceRadius: data.serviceRadius,
        maxJobsPerDay: data.maxJobsPerDay,
        defaultJobDuration: data.defaultJobDuration,
        allowEmergencyJobs: data.allowEmergencyJobs ?? true,
        emergencyFeePercent: data.emergencyFeePercent,
        pricingMultiplier: data.pricingMultiplier ?? 1.0,
        travelFeePerKm: data.travelFeePerKm,
        minimumTravelFee: data.minimumTravelFee,
        notifyOnNewJob: data.notifyOnNewJob ?? true,
        notifyOnJobComplete: data.notifyOnJobComplete ?? true,
        notificationEmails: data.notificationEmails || [],
        whatsappNumber: data.whatsappNumber,
        whatsappBusinessId: data.whatsappBusinessId,
      },
      update: {
        ...(data.operatingHours && { operatingHours: data.operatingHours }),
        ...(data.holidays && { holidays: data.holidays }),
        ...(data.serviceRadius !== undefined && { serviceRadius: data.serviceRadius }),
        ...(data.maxJobsPerDay !== undefined && { maxJobsPerDay: data.maxJobsPerDay }),
        ...(data.defaultJobDuration !== undefined && { defaultJobDuration: data.defaultJobDuration }),
        ...(data.allowEmergencyJobs !== undefined && { allowEmergencyJobs: data.allowEmergencyJobs }),
        ...(data.emergencyFeePercent !== undefined && { emergencyFeePercent: data.emergencyFeePercent }),
        ...(data.pricingMultiplier !== undefined && { pricingMultiplier: data.pricingMultiplier }),
        ...(data.travelFeePerKm !== undefined && { travelFeePerKm: data.travelFeePerKm }),
        ...(data.minimumTravelFee !== undefined && { minimumTravelFee: data.minimumTravelFee }),
        ...(data.notifyOnNewJob !== undefined && { notifyOnNewJob: data.notifyOnNewJob }),
        ...(data.notifyOnJobComplete !== undefined && { notifyOnJobComplete: data.notifyOnJobComplete }),
        ...(data.notificationEmails && { notificationEmails: data.notificationEmails }),
        ...(data.whatsappNumber !== undefined && { whatsappNumber: data.whatsappNumber }),
        ...(data.whatsappBusinessId !== undefined && { whatsappBusinessId: data.whatsappBusinessId }),
      },
    });

    return this.mapToLocationSettings(settings);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOCATION AFIP CONFIG
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get location AFIP config
   */
  async getLocationAfipConfig(
    organizationId: string,
    locationId: string
  ): Promise<LocationAfipConfig | null> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId },
    });

    if (!location) {
      throw new LocationError('LOCATION_NOT_FOUND', 'Location not found', 404);
    }

    const config = await this.prisma.locationAfipConfig.findUnique({
      where: { locationId },
    });

    return config ? this.mapToLocationAfipConfig(config) : null;
  }

  /**
   * Create or update location AFIP config
   */
  async upsertLocationAfipConfig(
    organizationId: string,
    locationId: string,
    data: CreateLocationAfipConfigDTO | UpdateLocationAfipConfigDTO
  ): Promise<LocationAfipConfig> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId },
    });

    if (!location) {
      throw new LocationError('LOCATION_NOT_FOUND', 'Location not found', 404);
    }

    // Verify punto de venta is unique within organization
    if ('puntoDeVenta' in data && data.puntoDeVenta) {
      const existingPDV = await this.prisma.locationAfipConfig.findFirst({
        where: {
          puntoDeVenta: data.puntoDeVenta,
          location: {
            organizationId,
            NOT: { id: locationId },
          },
        },
      });

      if (existingPDV) {
        throw new LocationError(
          'DUPLICATE_PUNTO_VENTA',
          `Punto de venta ${data.puntoDeVenta} is already assigned to another location`
        );
      }
    }

    const config = await this.prisma.locationAfipConfig.upsert({
      where: { locationId },
      create: {
        locationId,
        puntoDeVenta: (data as CreateLocationAfipConfigDTO).puntoDeVenta,
        tiposPuntoDeVenta: data.tiposPuntoDeVenta || 'CAJA',
        cuit: data.cuit,
        razonSocial: data.razonSocial,
        domicilioFiscal: data.domicilioFiscal as any,
        condicionIva: data.condicionIva || 'RESPONSABLE_INSCRIPTO',
        isActive: true,
      },
      update: {
        ...(data.puntoDeVenta !== undefined && { puntoDeVenta: data.puntoDeVenta }),
        ...(data.tiposPuntoDeVenta !== undefined && { tiposPuntoDeVenta: data.tiposPuntoDeVenta }),
        ...(data.cuit !== undefined && { cuit: data.cuit }),
        ...(data.razonSocial !== undefined && { razonSocial: data.razonSocial }),
        ...(data.domicilioFiscal && { domicilioFiscal: data.domicilioFiscal as any }),
        ...(data.condicionIva !== undefined && { condicionIva: data.condicionIva }),
      },
    });

    return this.mapToLocationAfipConfig(config);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // COVERAGE & PRICING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Check if a point is within coverage area
   */
  async checkCoverage(organizationId: string, point: Coordinates): Promise<CoverageCheckResult> {
    const locations = await this.prisma.location.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        zones: {
          where: { isActive: true },
          orderBy: { priority: 'desc' },
        },
        settings: true,
      },
    });

    return this.coverageCalculator.findCoveringLocation(locations as any, point);
  }

  /**
   * Get job assignment suggestions for a location
   */
  async getJobAssignmentSuggestions(
    organizationId: string,
    customerLocation: Coordinates,
    scheduledDate?: Date
  ): Promise<JobAssignmentSuggestion[]> {
    const locations = await this.prisma.location.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        zones: {
          where: { isActive: true },
        },
        settings: true,
        _count: {
          select: {
            technicians: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    return this.coverageCalculator.suggestJobAssignments(
      locations as any,
      customerLocation,
      scheduledDate
    );
  }

  /**
   * Calculate price with location-based adjustments
   */
  async calculateLocationPrice(
    organizationId: string,
    locationId: string,
    basePrice: number,
    customerCoordinates?: Coordinates
  ): Promise<{ finalPrice: number; breakdown: { base: number; multiplier: number; travelFee: number } }> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId },
      include: { settings: true },
    });

    if (!location) {
      throw new LocationError('LOCATION_NOT_FOUND', 'Location not found', 404);
    }

    const settings = location.settings;
    const multiplier = settings?.pricingMultiplier?.toNumber() || 1.0;

    let travelFee = 0;
    if (customerCoordinates && location.coordinates && settings?.travelFeePerKm) {
      const distance = this.coverageCalculator.calculateDistance(
        location.coordinates as any,
        customerCoordinates
      );
      travelFee = Math.max(
        distance * settings.travelFeePerKm.toNumber(),
        settings.minimumTravelFee?.toNumber() || 0
      );
    }

    const finalPrice = basePrice * multiplier + travelFee;

    return {
      finalPrice,
      breakdown: {
        base: basePrice,
        multiplier,
        travelFee,
      },
    };
  }

  /**
   * Get location capacity for a date
   */
  async getLocationCapacity(
    organizationId: string,
    locationId: string,
    date: Date
  ): Promise<LocationCapacity> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId },
      include: { settings: true },
    });

    if (!location) {
      throw new LocationError('LOCATION_NOT_FOUND', 'Location not found', 404);
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [scheduledJobs, completedJobs, techniciansCount] = await Promise.all([
      this.prisma.job.count({
        where: {
          locationId,
          scheduledDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      }),
      this.prisma.job.count({
        where: {
          locationId,
          completedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: 'COMPLETED',
        },
      }),
      this.prisma.user.count({
        where: {
          homeLocationId: locationId,
          isActive: true,
          role: 'TECHNICIAN',
        },
      }),
    ]);

    const maxJobs = location.settings?.maxJobsPerDay || 50;

    return {
      locationId,
      date: date.toISOString().split('T')[0],
      maxJobs,
      scheduledJobs,
      completedJobs,
      availableSlots: Math.max(0, maxJobs - scheduledJobs),
      techniciansAvailable: techniciansCount,
      techniciansOnDuty: techniciansCount, // TODO: Factor in schedules
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ZONE MANAGEMENT (delegated)
  // ═══════════════════════════════════════════════════════════════════════════════

  async createZone(organizationId: string, data: CreateZoneDTO): Promise<ZoneWithRelations> {
    return this.zoneManager.createZone(organizationId, data);
  }

  async getZone(organizationId: string, zoneId: string): Promise<ZoneWithRelations> {
    return this.zoneManager.getZone(organizationId, zoneId);
  }

  async listZones(
    organizationId: string,
    filters: ZoneFilters & { page?: number; limit?: number }
  ): Promise<{ zones: ZoneWithRelations[]; total: number; page: number; limit: number; totalPages: number }> {
    return this.zoneManager.listZones(organizationId, filters);
  }

  async updateZone(organizationId: string, zoneId: string, data: UpdateZoneDTO): Promise<ZoneWithRelations> {
    return this.zoneManager.updateZone(organizationId, zoneId, data);
  }

  async deleteZone(organizationId: string, zoneId: string): Promise<void> {
    return this.zoneManager.deleteZone(organizationId, zoneId);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INTER-LOCATION TRANSFERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create inter-location transfer request
   */
  async createTransfer(
    organizationId: string,
    requestedById: string,
    data: CreateInterLocationTransferDTO
  ): Promise<InterLocationTransferWithRelations> {
    // Verify both locations belong to organization
    const [fromLocation, toLocation] = await Promise.all([
      this.prisma.location.findFirst({
        where: { id: data.fromLocationId, organizationId },
      }),
      this.prisma.location.findFirst({
        where: { id: data.toLocationId, organizationId },
      }),
    ]);

    if (!fromLocation || !toLocation) {
      throw new LocationError('INVALID_LOCATION', 'One or both locations not found', 404);
    }

    const transfer = await this.prisma.interLocationTransfer.create({
      data: {
        organizationId,
        fromLocationId: data.fromLocationId,
        toLocationId: data.toLocationId,
        transferType: data.transferType,
        referenceId: data.referenceId,
        reason: data.reason,
        notes: data.notes,
        amount: data.amount,
        status: 'PENDING',
        requestedById,
        requestedAt: new Date(),
      },
      include: {
        fromLocation: true,
        toLocation: true,
        requestedBy: {
          select: { id: true, name: true },
        },
        approvedBy: {
          select: { id: true, name: true },
        },
      },
    });

    return this.mapToTransferWithRelations(transfer);
  }

  /**
   * Update transfer status
   */
  async updateTransfer(
    organizationId: string,
    transferId: string,
    userId: string,
    data: UpdateInterLocationTransferDTO
  ): Promise<InterLocationTransferWithRelations> {
    const transfer = await this.prisma.interLocationTransfer.findFirst({
      where: { id: transferId, organizationId },
    });

    if (!transfer) {
      throw new LocationError('TRANSFER_NOT_FOUND', 'Transfer not found', 404);
    }

    const updateData: Prisma.InterLocationTransferUpdateInput = {};

    if (data.notes !== undefined) updateData.notes = data.notes;

    if (data.status) {
      updateData.status = data.status;

      if (data.status === 'APPROVED') {
        updateData.approvedById = userId;
        updateData.approvedAt = new Date();
      } else if (data.status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
    }

    const updated = await this.prisma.interLocationTransfer.update({
      where: { id: transferId },
      data: updateData,
      include: {
        fromLocation: true,
        toLocation: true,
        requestedBy: {
          select: { id: true, name: true },
        },
        approvedBy: {
          select: { id: true, name: true },
        },
      },
    });

    return this.mapToTransferWithRelations(updated);
  }

  /**
   * List transfers
   */
  async listTransfers(
    organizationId: string,
    filters: TransferFilters & { page?: number; limit?: number }
  ): Promise<{ transfers: InterLocationTransferWithRelations[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);

    const where: Prisma.InterLocationTransferWhereInput = {
      organizationId,
      ...(filters.fromLocationId && { fromLocationId: filters.fromLocationId }),
      ...(filters.toLocationId && { toLocationId: filters.toLocationId }),
      ...(filters.transferType && { transferType: filters.transferType }),
      ...(filters.status && { status: filters.status }),
      ...(filters.requestedById && { requestedById: filters.requestedById }),
      ...(filters.dateFrom && {
        requestedAt: { gte: filters.dateFrom },
      }),
      ...(filters.dateTo && {
        requestedAt: { lte: filters.dateTo },
      }),
    };

    const [transfers, total] = await Promise.all([
      this.prisma.interLocationTransfer.findMany({
        where,
        include: {
          fromLocation: true,
          toLocation: true,
          requestedBy: {
            select: { id: true, name: true },
          },
          approvedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.interLocationTransfer.count({ where }),
    ]);

    return {
      transfers: transfers.map((t: typeof transfers[number]) => this.mapToTransferWithRelations(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private mapToLocationWithRelations(data: any): LocationWithRelations {
    return {
      id: data.id,
      organizationId: data.organizationId,
      code: data.code,
      name: data.name,
      type: data.type,
      address: data.address,
      coordinates: data.coordinates,
      timezone: data.timezone,
      phone: data.phone,
      email: data.email,
      managerId: data.managerId,
      isHeadquarters: data.isHeadquarters,
      isActive: data.isActive,
      coverageRadius: data.coverageRadius,
      coverageArea: data.coverageArea,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      manager: data.manager,
      zones: data.zones,
      settings: data.settings ? this.mapToLocationSettings(data.settings) : undefined,
      afipConfig: data.afipConfig ? this.mapToLocationAfipConfig(data.afipConfig) : undefined,
      _count: data._count,
    };
  }

  private mapToLocationSettings(data: any): LocationSettings {
    return {
      id: data.id,
      locationId: data.locationId,
      operatingHours: data.operatingHours || {},
      holidays: data.holidays || [],
      serviceRadius: data.serviceRadius,
      maxJobsPerDay: data.maxJobsPerDay,
      defaultJobDuration: data.defaultJobDuration,
      allowEmergencyJobs: data.allowEmergencyJobs,
      emergencyFeePercent: data.emergencyFeePercent?.toNumber?.() ?? data.emergencyFeePercent,
      pricingMultiplier: data.pricingMultiplier?.toNumber?.() ?? data.pricingMultiplier ?? 1.0,
      travelFeePerKm: data.travelFeePerKm?.toNumber?.() ?? data.travelFeePerKm,
      minimumTravelFee: data.minimumTravelFee?.toNumber?.() ?? data.minimumTravelFee,
      notifyOnNewJob: data.notifyOnNewJob,
      notifyOnJobComplete: data.notifyOnJobComplete,
      notificationEmails: data.notificationEmails || [],
      whatsappNumber: data.whatsappNumber,
      whatsappBusinessId: data.whatsappBusinessId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private mapToLocationAfipConfig(data: any): LocationAfipConfig {
    return {
      id: data.id,
      locationId: data.locationId,
      puntoDeVenta: data.puntoDeVenta,
      tiposPuntoDeVenta: data.tiposPuntoDeVenta,
      cuit: data.cuit,
      razonSocial: data.razonSocial,
      domicilioFiscal: data.domicilioFiscal,
      condicionIva: data.condicionIva,
      facturaALastNumber: data.facturaALastNumber,
      facturaBLastNumber: data.facturaBLastNumber,
      facturaCLastNumber: data.facturaCLastNumber,
      notaCreditoALastNumber: data.notaCreditoALastNumber,
      notaCreditoBLastNumber: data.notaCreditoBLastNumber,
      notaCreditoCLastNumber: data.notaCreditoCLastNumber,
      certificatePath: data.certificatePath,
      certificateExpiry: data.certificateExpiry,
      privateKeyPath: data.privateKeyPath,
      wsaaToken: data.wsaaToken,
      wsaaTokenExpiry: data.wsaaTokenExpiry,
      isActive: data.isActive,
      lastSyncAt: data.lastSyncAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private mapToTransferWithRelations(data: any): InterLocationTransferWithRelations {
    return {
      id: data.id,
      organizationId: data.organizationId,
      fromLocationId: data.fromLocationId,
      toLocationId: data.toLocationId,
      transferType: data.transferType,
      referenceId: data.referenceId,
      reason: data.reason,
      notes: data.notes,
      amount: data.amount?.toNumber?.() ?? data.amount,
      status: data.status,
      requestedById: data.requestedById,
      approvedById: data.approvedById,
      requestedAt: data.requestedAt,
      approvedAt: data.approvedAt,
      completedAt: data.completedAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      fromLocation: data.fromLocation,
      toLocation: data.toLocation,
      requestedBy: data.requestedBy,
      approvedBy: data.approvedBy,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let locationService: LocationService | null = null;

export function getLocationService(prisma?: PrismaClient): LocationService {
  if (!locationService && prisma) {
    locationService = new LocationService(prisma);
  }
  if (!locationService) {
    throw new Error('LocationService not initialized');
  }
  return locationService;
}
