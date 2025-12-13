/**
 * Zone Manager
 * ============
 *
 * Manages service zones within locations.
 * Zones define geographic areas for job assignment and pricing.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  Zone,
  ZoneWithRelations,
  CreateZoneDTO,
  UpdateZoneDTO,
  ZoneFilters,
  Coordinates,
  GeoJSONPolygon,
} from './location.types';
import { LocationError } from './location.service';

// ═══════════════════════════════════════════════════════════════════════════════
// ZONE MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class ZoneManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new zone
   */
  async createZone(organizationId: string, data: CreateZoneDTO): Promise<ZoneWithRelations> {
    // Verify location belongs to organization
    const location = await this.prisma.location.findFirst({
      where: {
        id: data.locationId,
        organizationId,
      },
    });

    if (!location) {
      throw new LocationError('LOCATION_NOT_FOUND', 'Location not found', 404);
    }

    // Check for duplicate code within location
    const existing = await this.prisma.zone.findFirst({
      where: {
        locationId: data.locationId,
        code: data.code,
      },
    });

    if (existing) {
      throw new LocationError('DUPLICATE_ZONE_CODE', `Zone with code "${data.code}" already exists in this location`);
    }

    // Validate boundary polygon if provided
    if (data.boundary) {
      this.validatePolygon(data.boundary);
    }

    const zone = await this.prisma.zone.create({
      data: {
        locationId: data.locationId,
        code: data.code,
        name: data.name,
        description: data.description,
        boundary: data.boundary as any,
        color: data.color,
        priority: data.priority || 0,
        isActive: true,
      },
      include: {
        location: true,
        _count: {
          select: {
            jobs: true,
            customers: true,
          },
        },
      },
    });

    return this.mapToZoneWithRelations(zone);
  }

  /**
   * Get zone by ID
   */
  async getZone(organizationId: string, zoneId: string): Promise<ZoneWithRelations> {
    const zone = await this.prisma.zone.findFirst({
      where: {
        id: zoneId,
        location: {
          organizationId,
        },
      },
      include: {
        location: true,
        _count: {
          select: {
            jobs: true,
            customers: true,
          },
        },
      },
    });

    if (!zone) {
      throw new LocationError('ZONE_NOT_FOUND', 'Zone not found', 404);
    }

    return this.mapToZoneWithRelations(zone);
  }

  /**
   * List zones with filters
   */
  async listZones(
    organizationId: string,
    filters: ZoneFilters & { page?: number; limit?: number }
  ): Promise<{ zones: ZoneWithRelations[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);

    const where: Prisma.ZoneWhereInput = {
      location: {
        organizationId,
      },
      ...(filters.locationId && { locationId: filters.locationId }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { code: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [zones, total] = await Promise.all([
      this.prisma.zone.findMany({
        where,
        include: {
          location: true,
          _count: {
            select: {
              jobs: true,
              customers: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { name: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.zone.count({ where }),
    ]);

    return {
      zones: zones.map((z: typeof zones[number]) => this.mapToZoneWithRelations(z)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update a zone
   */
  async updateZone(
    organizationId: string,
    zoneId: string,
    data: UpdateZoneDTO
  ): Promise<ZoneWithRelations> {
    // Verify zone exists and belongs to organization
    const existing = await this.prisma.zone.findFirst({
      where: {
        id: zoneId,
        location: {
          organizationId,
        },
      },
    });

    if (!existing) {
      throw new LocationError('ZONE_NOT_FOUND', 'Zone not found', 404);
    }

    // Check for duplicate code if code is being changed
    if (data.code && data.code !== existing.code) {
      const duplicate = await this.prisma.zone.findFirst({
        where: {
          locationId: existing.locationId,
          code: data.code,
          NOT: { id: zoneId },
        },
      });

      if (duplicate) {
        throw new LocationError('DUPLICATE_ZONE_CODE', `Zone with code "${data.code}" already exists in this location`);
      }
    }

    // Validate boundary polygon if provided
    if (data.boundary) {
      this.validatePolygon(data.boundary);
    }

    const zone = await this.prisma.zone.update({
      where: { id: zoneId },
      data: {
        ...(data.code !== undefined && { code: data.code }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.boundary !== undefined && { boundary: data.boundary as any }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        location: true,
        _count: {
          select: {
            jobs: true,
            customers: true,
          },
        },
      },
    });

    return this.mapToZoneWithRelations(zone);
  }

  /**
   * Delete a zone (soft delete by deactivating)
   */
  async deleteZone(organizationId: string, zoneId: string): Promise<void> {
    const zone = await this.prisma.zone.findFirst({
      where: {
        id: zoneId,
        location: {
          organizationId,
        },
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

    if (!zone) {
      throw new LocationError('ZONE_NOT_FOUND', 'Zone not found', 404);
    }

    // Check for active jobs in this zone
    const activeJobsCount = await this.prisma.job.count({
      where: {
        zoneId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    });

    if (activeJobsCount > 0) {
      throw new LocationError(
        'ZONE_HAS_ACTIVE_JOBS',
        `Cannot delete zone with ${activeJobsCount} active jobs`
      );
    }

    // Soft delete
    await this.prisma.zone.update({
      where: { id: zoneId },
      data: { isActive: false },
    });
  }

  /**
   * Find zone containing a point
   */
  async findZoneForPoint(
    organizationId: string,
    locationId: string,
    point: Coordinates
  ): Promise<ZoneWithRelations | null> {
    const zones = await this.prisma.zone.findMany({
      where: {
        locationId,
        isActive: true,
        location: {
          organizationId,
        },
      },
      include: {
        location: true,
        _count: {
          select: {
            jobs: true,
            customers: true,
          },
        },
      },
      orderBy: { priority: 'desc' },
    });

    for (const zone of zones) {
      if (zone.boundary && this.isPointInPolygon(point, zone.boundary as GeoJSONPolygon)) {
        return this.mapToZoneWithRelations(zone);
      }
    }

    return null;
  }

  /**
   * Get zones for a location
   */
  async getZonesForLocation(
    organizationId: string,
    locationId: string
  ): Promise<ZoneWithRelations[]> {
    const zones = await this.prisma.zone.findMany({
      where: {
        locationId,
        isActive: true,
        location: {
          organizationId,
        },
      },
      include: {
        location: true,
        _count: {
          select: {
            jobs: true,
            customers: true,
          },
        },
      },
      orderBy: { priority: 'desc' },
    });

    return zones.map((z: typeof zones[number]) => this.mapToZoneWithRelations(z));
  }

  /**
   * Bulk update zone priorities
   */
  async updateZonePriorities(
    organizationId: string,
    updates: Array<{ zoneId: string; priority: number }>
  ): Promise<void> {
    // Verify all zones belong to organization
    const zoneIds = updates.map((u: typeof updates[number]) => u.zoneId);
    const zones = await this.prisma.zone.findMany({
      where: {
        id: { in: zoneIds },
        location: {
          organizationId,
        },
      },
    });

    if (zones.length !== zoneIds.length) {
      throw new LocationError('INVALID_ZONES', 'One or more zones not found');
    }

    // Update priorities in transaction
    await this.prisma.$transaction(
      updates.map(({ zoneId, priority }: typeof updates[number]) =>
        this.prisma.zone.update({
          where: { id: zoneId },
          data: { priority },
        })
      )
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // GEOMETRY HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Validate GeoJSON polygon structure
   */
  private validatePolygon(polygon: GeoJSONPolygon): void {
    if (polygon.type !== 'Polygon') {
      throw new LocationError('INVALID_POLYGON', 'Boundary must be a GeoJSON Polygon');
    }

    if (!polygon.coordinates || polygon.coordinates.length === 0) {
      throw new LocationError('INVALID_POLYGON', 'Polygon must have coordinates');
    }

    const ring = polygon.coordinates[0];
    if (ring.length < 4) {
      throw new LocationError('INVALID_POLYGON', 'Polygon must have at least 4 points');
    }

    // Check if polygon is closed (first and last points are the same)
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      throw new LocationError('INVALID_POLYGON', 'Polygon must be closed (first and last points must be the same)');
    }
  }

  /**
   * Check if a point is inside a polygon using ray casting algorithm
   */
  private isPointInPolygon(point: Coordinates, polygon: GeoJSONPolygon): boolean {
    const x = point.lng;
    const y = point.lat;
    const ring = polygon.coordinates[0];

    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Calculate area of a polygon (in square degrees, approximate)
   */
  calculatePolygonArea(polygon: GeoJSONPolygon): number {
    const ring = polygon.coordinates[0];
    let area = 0;

    for (let i = 0; i < ring.length - 1; i++) {
      const j = (i + 1) % ring.length;
      area += ring[i][0] * ring[j][1];
      area -= ring[j][0] * ring[i][1];
    }

    return Math.abs(area / 2);
  }

  /**
   * Get centroid of a polygon
   */
  getPolygonCentroid(polygon: GeoJSONPolygon): Coordinates {
    const ring = polygon.coordinates[0];
    let sumX = 0;
    let sumY = 0;

    for (let i = 0; i < ring.length - 1; i++) {
      sumX += ring[i][0];
      sumY += ring[i][1];
    }

    const n = ring.length - 1;
    return {
      lng: sumX / n,
      lat: sumY / n,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private mapToZoneWithRelations(data: any): ZoneWithRelations {
    return {
      id: data.id,
      locationId: data.locationId,
      code: data.code,
      name: data.name,
      description: data.description,
      boundary: data.boundary,
      color: data.color,
      priority: data.priority,
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      location: data.location,
      _count: data._count,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let zoneManager: ZoneManager | null = null;

export function getZoneManager(prisma?: PrismaClient): ZoneManager {
  if (!zoneManager && prisma) {
    zoneManager = new ZoneManager(prisma);
  }
  if (!zoneManager) {
    throw new Error('ZoneManager not initialized');
  }
  return zoneManager;
}
