/**
 * Geographic Analytics
 * ====================
 *
 * Phase 11.6: Location Analytics
 * Geographic performance analysis and heatmaps.
 */

import { db } from '../../lib/db';
import { DateRange } from '../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  weight: number;
  label?: string;
}

export interface HeatmapData {
  type: 'revenue' | 'jobs' | 'customers' | 'density' | 'response_time';
  points: HeatmapPoint[];
  bounds: GeoBounds;
  summary: {
    totalPoints: number;
    maxWeight: number;
    minWeight: number;
    avgWeight: number;
  };
}

export interface GeographicPerformance {
  locationId: string;
  locationName: string;
  coordinates: GeoCoordinate;
  metrics: {
    revenue: number;
    jobs: number;
    customers: number;
    avgResponseTime: number;
    completionRate: number;
  };
  zones: ZonePerformance[];
}

export interface ZonePerformance {
  zoneId: string;
  zoneName: string;
  metrics: {
    revenue: number;
    jobs: number;
    customers: number;
    avgTravelTime: number;
  };
  centroid: GeoCoordinate;
}

export interface ServiceDensityMap {
  gridSize: number; // km
  cells: DensityCell[];
  bounds: GeoBounds;
}

export interface DensityCell {
  gridX: number;
  gridY: number;
  center: GeoCoordinate;
  bounds: GeoBounds;
  metrics: {
    jobCount: number;
    customerCount: number;
    revenue: number;
    avgResponseTime: number;
  };
  hasLocation: boolean;
  nearestLocationId?: string;
  nearestLocationDistance?: number;
}

export interface CoverageAnalysis {
  organizationId: string;
  totalCoverageArea: number; // km²
  servicedArea: number; // km² with actual jobs
  coverageGaps: CoverageGap[];
  overlappingAreas: OverlappingArea[];
  recommendations: string[];
}

export interface CoverageGap {
  center: GeoCoordinate;
  radius: number; // km
  potentialCustomers: number;
  nearestLocation: {
    id: string;
    name: string;
    distance: number;
  };
}

export interface OverlappingArea {
  center: GeoCoordinate;
  radius: number;
  locations: {
    id: string;
    name: string;
  }[];
  competitionScore: number; // 0-100, higher = more competition
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEATMAP GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate heatmap data for jobs
 */
export async function generateJobsHeatmap(
  organizationId: string,
  dateRange: DateRange
): Promise<HeatmapData> {
  // Get jobs with customer locations
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    },
    select: {
      id: true,
      customer: {
        select: {
          id: true,
          address: true,
        },
      },
    },
  });

  const points: HeatmapPoint[] = [];
  const pointCounts = new Map<string, { lat: number; lng: number; count: number }>();

  for (const job of jobs) {
    const coords = getAddressCoordinates(job.customer?.address);
    if (coords) {
      const key = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
      const existing = pointCounts.get(key) || {
        lat: coords.lat,
        lng: coords.lng,
        count: 0,
      };
      existing.count++;
      pointCounts.set(key, existing);
    }
  }

  for (const [, data] of pointCounts) {
    points.push({
      lat: data.lat,
      lng: data.lng,
      weight: data.count,
    });
  }

  const bounds = calculateBounds(points);
  const weights = points.map((p) => p.weight);

  return {
    type: 'jobs',
    points,
    bounds,
    summary: {
      totalPoints: points.length,
      maxWeight: Math.max(...weights, 0),
      minWeight: Math.min(...weights, 0),
      avgWeight: weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0,
    },
  };
}

/**
 * Generate heatmap data for revenue
 */
export async function generateRevenueHeatmap(
  organizationId: string,
  dateRange: DateRange
): Promise<HeatmapData> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    },
    select: {
      total: true,
      customer: {
        select: {
          address: true,
        },
      },
    },
  });

  const pointRevenue = new Map<string, { lat: number; lng: number; revenue: number }>();

  for (const invoice of invoices) {
    const coords = getAddressCoordinates(invoice.customer?.address);
    if (coords) {
      const key = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
      const existing = pointRevenue.get(key) || {
        lat: coords.lat,
        lng: coords.lng,
        revenue: 0,
      };
      existing.revenue += invoice.total || 0;
      pointRevenue.set(key, existing);
    }
  }

  const points: HeatmapPoint[] = [];
  for (const [, data] of pointRevenue) {
    points.push({
      lat: data.lat,
      lng: data.lng,
      weight: data.revenue / 1000, // Normalize to thousands
    });
  }

  const bounds = calculateBounds(points);
  const weights = points.map((p) => p.weight);

  return {
    type: 'revenue',
    points,
    bounds,
    summary: {
      totalPoints: points.length,
      maxWeight: Math.max(...weights, 0),
      minWeight: Math.min(...weights, 0),
      avgWeight: weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0,
    },
  };
}

/**
 * Generate heatmap data for response times
 */
export async function generateResponseTimeHeatmap(
  organizationId: string,
  dateRange: DateRange
): Promise<HeatmapData> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
      startedAt: { not: null },
    },
    select: {
      createdAt: true,
      startedAt: true,
      customer: {
        select: {
          address: true,
        },
      },
    },
  });

  const pointResponseTimes = new Map<string, { lat: number; lng: number; times: number[] }>();

  for (const job of jobs) {
    const coords = getAddressCoordinates(job.customer?.address);
    if (coords && job.startedAt) {
      const key = `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`;
      const responseTime = (job.startedAt.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60); // hours
      const existing = pointResponseTimes.get(key) || {
        lat: coords.lat,
        lng: coords.lng,
        times: [],
      };
      existing.times.push(responseTime);
      pointResponseTimes.set(key, existing);
    }
  }

  const points: HeatmapPoint[] = [];
  for (const [, data] of pointResponseTimes) {
    const avgTime = data.times.reduce((a, b) => a + b, 0) / data.times.length;
    points.push({
      lat: data.lat,
      lng: data.lng,
      weight: avgTime,
      label: `${avgTime.toFixed(1)}h`,
    });
  }

  const bounds = calculateBounds(points);
  const weights = points.map((p) => p.weight);

  return {
    type: 'response_time',
    points,
    bounds,
    summary: {
      totalPoints: points.length,
      maxWeight: Math.max(...weights, 0),
      minWeight: Math.min(...weights, 0),
      avgWeight: weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEOGRAPHIC PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get geographic performance for all locations
 */
export async function getGeographicPerformance(
  organizationId: string,
  dateRange: DateRange
): Promise<GeographicPerformance[]> {
  const locations = await db.location.findMany({
    where: { organizationId, isActive: true },
    select: {
      id: true,
      name: true,
      coordinates: true,
    },
  });

  const results: GeographicPerformance[] = [];

  for (const location of locations) {
    const locCoords = getLocationCoordinates(location.coordinates);
    if (!locCoords) continue;

    // Get metrics for this location
    const [jobs, invoices, zones] = await Promise.all([
      db.job.findMany({
        where: {
          organizationId,
          locationId: location.id,
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          startedAt: true,
          customerId: true,
        },
      }),
      db.invoice.findMany({
        where: {
          organizationId,
          job: { locationId: location.id },
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
        select: { total: true },
      }),
      db.zone.findMany({
        where: { locationId: location.id, isActive: true },
        select: { id: true, name: true },
      }),
    ]);

    const uniqueCustomers = new Set(jobs.map((j) => j.customerId));
    const completedJobs = jobs.filter((j) => j.status === 'COMPLETED').length;

    // Calculate avg response time
    const jobsWithResponse = jobs.filter((j) => j.startedAt);
    const avgResponseTime = jobsWithResponse.length > 0
      ? jobsWithResponse.reduce((sum, j) => {
          return sum + (j.startedAt!.getTime() - j.createdAt.getTime()) / (1000 * 60 * 60);
        }, 0) / jobsWithResponse.length
      : 0;

    // Get zone performance
    const zonePerformances: ZonePerformance[] = [];
    for (const zone of zones) {
      const zoneJobs = await db.job.findMany({
        where: {
          organizationId,
          zoneId: zone.id,
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
        select: {
          customerId: true,
        },
      });

      const zoneInvoices = await db.invoice.findMany({
        where: {
          organizationId,
          job: { zoneId: zone.id },
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
        select: { total: true },
      });

      zonePerformances.push({
        zoneId: zone.id,
        zoneName: zone.name,
        metrics: {
          revenue: zoneInvoices.reduce((sum, i) => sum + (i.total || 0), 0),
          jobs: zoneJobs.length,
          customers: new Set(zoneJobs.map((j) => j.customerId)).size,
          avgTravelTime: 15, // Placeholder - would need actual travel tracking
        },
        centroid: locCoords, // Would calculate actual zone centroid
      });
    }

    results.push({
      locationId: location.id,
      locationName: location.name,
      coordinates: locCoords,
      metrics: {
        revenue: invoices.reduce((sum, i) => sum + (i.total || 0), 0),
        jobs: jobs.length,
        customers: uniqueCustomers.size,
        avgResponseTime,
        completionRate: jobs.length > 0 ? (completedJobs / jobs.length) * 100 : 0,
      },
      zones: zonePerformances,
    });
  }

  return results;
}

/**
 * Generate service density map
 */
export async function generateServiceDensityMap(
  organizationId: string,
  dateRange: DateRange,
  gridSizeKm: number = 5
): Promise<ServiceDensityMap> {
  // Get all customer locations with jobs
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    },
    select: {
      id: true,
      createdAt: true,
      startedAt: true,
      customer: {
        select: {
          id: true,
          address: true,
        },
      },
    },
  });

  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    },
    select: {
      total: true,
      customerId: true,
    },
  });

  const locations = await db.location.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, coordinates: true },
  });

  // Create revenue map by customer
  const customerRevenue = new Map<string, number>();
  for (const inv of invoices) {
    customerRevenue.set(inv.customerId, (customerRevenue.get(inv.customerId) || 0) + (inv.total || 0));
  }

  // Filter jobs with valid coordinates
  const jobsWithCoords = jobs
    .map((j) => ({
      ...j,
      coords: getAddressCoordinates(j.customer?.address),
    }))
    .filter((j): j is typeof j & { coords: GeoCoordinate } => j.coords !== null);

  if (jobsWithCoords.length === 0) {
    return {
      gridSize: gridSizeKm,
      cells: [],
      bounds: { north: 0, south: 0, east: 0, west: 0 },
    };
  }

  // Calculate bounds
  const lats = jobsWithCoords.map((j) => j.coords.lat);
  const lngs = jobsWithCoords.map((j) => j.coords.lng);
  const bounds: GeoBounds = {
    north: Math.max(...lats) + 0.05,
    south: Math.min(...lats) - 0.05,
    east: Math.max(...lngs) + 0.05,
    west: Math.min(...lngs) - 0.05,
  };

  // Create grid
  const latStep = gridSizeKm / 111; // Approximate degrees per km
  const lngStep = gridSizeKm / (111 * Math.cos((bounds.north + bounds.south) / 2 * Math.PI / 180));

  const cells: DensityCell[] = [];
  let gridX = 0;

  for (let lat = bounds.south; lat < bounds.north; lat += latStep) {
    let gridY = 0;
    for (let lng = bounds.west; lng < bounds.east; lng += lngStep) {
      const cellBounds: GeoBounds = {
        south: lat,
        north: lat + latStep,
        west: lng,
        east: lng + lngStep,
      };

      // Find jobs in this cell
      const cellJobs = jobsWithCoords.filter((j) => {
        return j.coords.lat >= cellBounds.south && j.coords.lat < cellBounds.north &&
               j.coords.lng >= cellBounds.west && j.coords.lng < cellBounds.east;
      });

      // Calculate metrics
      const uniqueCustomers = new Set(cellJobs.map((j) => j.customer!.id));
      let cellRevenue = 0;
      for (const customerId of uniqueCustomers) {
        cellRevenue += customerRevenue.get(customerId) || 0;
      }

      const jobsWithResponse = cellJobs.filter((j) => j.startedAt);
      const avgResponseTime = jobsWithResponse.length > 0
        ? jobsWithResponse.reduce((sum, j) => {
            return sum + (j.startedAt!.getTime() - j.createdAt.getTime()) / (1000 * 60 * 60);
          }, 0) / jobsWithResponse.length
        : 0;

      // Check if any location is in this cell
      const centerLat = lat + latStep / 2;
      const centerLng = lng + lngStep / 2;

      let nearestLocation: { id: string; distance: number } | null = null;
      for (const loc of locations) {
        const locCoords = getLocationCoordinates(loc.coordinates);
        if (locCoords) {
          const distance = haversineDistance(
            { lat: centerLat, lng: centerLng },
            locCoords
          );
          if (!nearestLocation || distance < nearestLocation.distance) {
            nearestLocation = { id: loc.id, distance };
          }
        }
      }

      const hasLocation = locations.some((loc) => {
        const locCoords = getLocationCoordinates(loc.coordinates);
        if (!locCoords) return false;
        return locCoords.lat >= cellBounds.south && locCoords.lat < cellBounds.north &&
               locCoords.lng >= cellBounds.west && locCoords.lng < cellBounds.east;
      });

      cells.push({
        gridX,
        gridY,
        center: { lat: centerLat, lng: centerLng },
        bounds: cellBounds,
        metrics: {
          jobCount: cellJobs.length,
          customerCount: uniqueCustomers.size,
          revenue: cellRevenue,
          avgResponseTime,
        },
        hasLocation,
        nearestLocationId: nearestLocation?.id,
        nearestLocationDistance: nearestLocation?.distance,
      });

      gridY++;
    }
    gridX++;
  }

  return {
    gridSize: gridSizeKm,
    cells,
    bounds,
  };
}

/**
 * Analyze coverage and identify gaps
 */
export async function analyzeCoverage(
  organizationId: string,
  dateRange: DateRange
): Promise<CoverageAnalysis> {
  const densityMap = await generateServiceDensityMap(organizationId, dateRange, 5);

  const locations = await db.location.findMany({
    where: { organizationId, isActive: true },
    select: {
      id: true,
      name: true,
      coordinates: true,
      coverageRadius: true,
    },
  });

  // Calculate total coverage area
  let totalCoverageArea = 0;
  for (const loc of locations) {
    if (loc.coverageRadius) {
      totalCoverageArea += Math.PI * loc.coverageRadius * loc.coverageRadius;
    }
  }

  // Calculate serviced area (cells with jobs)
  const servicedCells = densityMap.cells.filter((c) => c.metrics.jobCount > 0);
  const servicedArea = servicedCells.length * densityMap.gridSize * densityMap.gridSize;

  // Identify coverage gaps (cells with customers but far from locations)
  const coverageGaps: CoverageGap[] = [];
  const highDemandCells = densityMap.cells.filter(
    (c) => c.metrics.jobCount > 5 && c.nearestLocationDistance && c.nearestLocationDistance > 15
  );

  for (const cell of highDemandCells.slice(0, 5)) {
    const nearestLoc = locations.find((l) => l.id === cell.nearestLocationId);
    if (nearestLoc) {
      coverageGaps.push({
        center: cell.center,
        radius: 5,
        potentialCustomers: cell.metrics.customerCount,
        nearestLocation: {
          id: nearestLoc.id,
          name: nearestLoc.name,
          distance: cell.nearestLocationDistance!,
        },
      });
    }
  }

  // Identify overlapping areas (locations with overlapping coverage)
  const overlappingAreas: OverlappingArea[] = [];
  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      const loc1 = locations[i];
      const loc2 = locations[j];

      const coords1 = getLocationCoordinates(loc1.coordinates);
      const coords2 = getLocationCoordinates(loc2.coordinates);

      if (!coords1 || !coords2) continue;

      const distance = haversineDistance(coords1, coords2);

      const combinedRadius = (loc1.coverageRadius || 10) + (loc2.coverageRadius || 10);

      if (distance < combinedRadius) {
        overlappingAreas.push({
          center: {
            lat: (coords1.lat + coords2.lat) / 2,
            lng: (coords1.lng + coords2.lng) / 2,
          },
          radius: combinedRadius - distance,
          locations: [
            { id: loc1.id, name: loc1.name },
            { id: loc2.id, name: loc2.name },
          ],
          competitionScore: Math.min(100, (1 - distance / combinedRadius) * 100),
        });
      }
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (coverageGaps.length > 0) {
    recommendations.push(
      `Hay ${coverageGaps.length} áreas con alta demanda pero lejos de sucursales existentes. Considerar expansión.`
    );
  }

  if (overlappingAreas.length > 0) {
    recommendations.push(
      `${overlappingAreas.length} pares de sucursales tienen áreas de cobertura superpuestas. Revisar límites de zona.`
    );
  }

  const avgUtilization = servicedCells.length > 0
    ? servicedCells.reduce((sum, c) => sum + c.metrics.jobCount, 0) / servicedCells.length
    : 0;

  if (avgUtilization < 3) {
    recommendations.push(
      'La densidad de trabajos es baja. Considerar campañas de marketing en áreas específicas.'
    );
  }

  return {
    organizationId,
    totalCoverageArea,
    servicedArea,
    coverageGaps,
    overlappingAreas,
    recommendations,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract coordinates from Customer address JSON field
 * Address format: { street, number, floor, apartment, city, postalCode, coordinates: { lat, lng } }
 */
function getAddressCoordinates(address: unknown): GeoCoordinate | null {
  if (!address || typeof address !== 'object') return null;
  const addr = address as Record<string, unknown>;
  const coords = addr.coordinates;
  if (!coords || typeof coords !== 'object') return null;
  const c = coords as Record<string, unknown>;
  if (typeof c.lat === 'number' && typeof c.lng === 'number') {
    return { lat: c.lat, lng: c.lng };
  }
  return null;
}

/**
 * Extract coordinates from Location coordinates JSON field
 * Coordinates format: { lat, lng }
 */
function getLocationCoordinates(coordinates: unknown): GeoCoordinate | null {
  if (!coordinates || typeof coordinates !== 'object') return null;
  const c = coordinates as Record<string, unknown>;
  if (typeof c.lat === 'number' && typeof c.lng === 'number') {
    return { lat: c.lat, lng: c.lng };
  }
  return null;
}

function calculateBounds(points: HeatmapPoint[]): GeoBounds {
  if (points.length === 0) {
    return { north: 0, south: 0, east: 0, west: 0 };
  }

  return {
    north: Math.max(...points.map((p) => p.lat)),
    south: Math.min(...points.map((p) => p.lat)),
    east: Math.max(...points.map((p) => p.lng)),
    west: Math.min(...points.map((p) => p.lng)),
  };
}

function haversineDistance(coord1: GeoCoordinate, coord2: GeoCoordinate): number {
  const R = 6371; // Earth's radius in km
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
