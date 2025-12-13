/**
 * Dimension Tables Service
 * ========================
 *
 * Phase 10.1: Analytics Data Infrastructure
 * Dimension table management for analytics star schema.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { getRedisConnection } from '../../lib/redis/client';
import {
  CustomerDimension,
  TechnicianDimension,
  ServiceDimension,
  TimeDimension,
} from '../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LocationDimension {
  locationId: string;
  organizationId: string;
  city: string;
  province: string;
  region: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
}

export interface DimensionRefreshResult {
  dimension: string;
  recordsProcessed: number;
  recordsUpdated: number;
  recordsCreated: number;
  durationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DIMENSION_CACHE_PREFIX = 'analytics:dim:';
const DIMENSION_CACHE_TTL = 3600; // 1 hour

// ═══════════════════════════════════════════════════════════════════════════════
// TIME DIMENSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate time dimension data for a date range
 */
export function generateTimeDimension(startDate: Date, endDate: Date): TimeDimension[] {
  const dimensions: TimeDimension[] = [];
  const current = new Date(startDate);

  // Argentine holidays (simplified - would need a full holiday calendar)
  const holidays: Record<string, string> = {
    '01-01': 'Año Nuevo',
    '02-20': 'Carnaval',
    '02-21': 'Carnaval',
    '03-24': 'Día de la Memoria',
    '04-02': 'Día del Veterano',
    '05-01': 'Día del Trabajador',
    '05-25': 'Revolución de Mayo',
    '06-17': 'Paso a la Inmortalidad Güemes',
    '06-20': 'Día de la Bandera',
    '07-09': 'Día de la Independencia',
    '08-17': 'Paso a la Inmortalidad San Martín',
    '10-12': 'Día del Respeto a la Diversidad Cultural',
    '11-20': 'Día de la Soberanía Nacional',
    '12-08': 'Inmaculada Concepción',
    '12-25': 'Navidad',
  };

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const month = current.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    const mmdd = `${String(month).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;

    dimensions.push({
      date: new Date(current),
      dayOfWeek,
      dayOfMonth: current.getDate(),
      weekOfYear: getWeekOfYear(current),
      month,
      quarter,
      year: current.getFullYear(),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isHoliday: holidays[mmdd] !== undefined,
      holidayName: holidays[mmdd],
    });

    current.setDate(current.getDate() + 1);
  }

  return dimensions;
}

/**
 * Get time dimension for a specific date
 */
export function getTimeDimensionForDate(date: Date): TimeDimension {
  const dayOfWeek = date.getDay();
  const month = date.getMonth() + 1;
  const quarter = Math.ceil(month / 3);

  return {
    date,
    dayOfWeek,
    dayOfMonth: date.getDate(),
    weekOfYear: getWeekOfYear(date),
    month,
    quarter,
    year: date.getFullYear(),
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    isHoliday: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER DIMENSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get customer dimension data
 */
export async function getCustomerDimension(
  organizationId: string
): Promise<CustomerDimension[]> {
  // Check cache first
  const cached = await getCachedDimension<CustomerDimension[]>(
    `customer:${organizationId}`
  );
  if (cached) return cached;

  const customers = await db.customer.findMany({
    where: { organizationId },
    include: {
      jobs: {
        select: {
          id: true,
          status: true,
          completedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      invoices: {
        where: { status: 'PAID' },
        select: {
          total: true,
        },
      },
    },
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  type DimCustomerType = typeof customers[number];
  type DimJobType = DimCustomerType['jobs'][number];
  type DimInvoiceType = DimCustomerType['invoices'][number];

  const dimensions = customers.map((customer: DimCustomerType): CustomerDimension => {
    const totalJobs = customer.jobs.length;
    const completedJobs = customer.jobs.filter((j: DimJobType) => j.status === 'COMPLETED');
    const totalRevenue = customer.invoices.reduce(
      (sum: number, inv: DimInvoiceType) => sum + inv.total.toNumber(),
      0
    );

    const lastJobAt = completedJobs.length > 0
      ? completedJobs[completedJobs.length - 1].completedAt
      : null;

    // Determine segment
    let segment: CustomerDimension['segment'] = 'new';
    if (totalJobs === 0) {
      segment = 'new';
    } else if (!lastJobAt || lastJobAt < ninetyDaysAgo) {
      segment = 'churned';
    } else if (lastJobAt < thirtyDaysAgo) {
      segment = 'at_risk';
    } else if (totalJobs >= 5) {
      segment = 'loyal';
    } else {
      segment = 'active';
    }

    // Parse address for location info
    const address = customer.address as Record<string, string> || {};

    return {
      customerId: customer.id,
      organizationId: customer.organizationId,
      name: customer.name,
      taxCondition: 'consumidor_final',
      city: address.city || null,
      province: address.province || null,
      customerSince: customer.createdAt,
      totalJobs,
      totalRevenue,
      averageJobValue: totalJobs > 0 ? totalRevenue / totalJobs : 0,
      lastJobAt,
      segment,
    };
  });

  // Cache the result
  await setCachedDimension(`customer:${organizationId}`, dimensions);

  return dimensions;
}

/**
 * Get customer dimension by ID
 */
export async function getCustomerById(
  organizationId: string,
  customerId: string
): Promise<CustomerDimension | null> {
  const dimensions = await getCustomerDimension(organizationId);
  return dimensions.find((d) => d.customerId === customerId) || null;
}

/**
 * Get customers by segment
 */
export async function getCustomersBySegment(
  organizationId: string,
  segment: CustomerDimension['segment']
): Promise<CustomerDimension[]> {
  const dimensions = await getCustomerDimension(organizationId);
  return dimensions.filter((d) => d.segment === segment);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TECHNICIAN DIMENSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get technician dimension data
 */
export async function getTechnicianDimension(
  organizationId: string
): Promise<TechnicianDimension[]> {
  // Check cache first
  const cached = await getCachedDimension<TechnicianDimension[]>(
    `technician:${organizationId}`
  );
  if (cached) return cached;

  const technicians = await db.user.findMany({
    where: {
      organizationId,
      role: { in: ['TECHNICIAN', 'ADMIN', 'OWNER'] },
      isActive: true,
    },
    include: {
      assignedJobs: {
        select: {
          id: true,
          status: true,
          actualDuration: true,
          completedAt: true,
        },
      },
    },
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  type DimTechType = typeof technicians[number];
  type TechJobType = DimTechType['assignedJobs'][number];

  const dimensions = technicians.map((tech: DimTechType): TechnicianDimension => {
    const totalJobs = tech.assignedJobs.length;
    const completedJobs = tech.assignedJobs.filter((j: TechJobType) => j.status === 'COMPLETED').length;

    // Calculate efficiency (jobs per working day in last 30 days)
    const recentJobs = tech.assignedJobs.filter(
      (j: TechJobType) => j.completedAt && j.completedAt >= thirtyDaysAgo
    );
    const efficiency = recentJobs.length / 22; // Assuming 22 working days per month

    return {
      technicianId: tech.id,
      organizationId: tech.organizationId,
      name: tech.name,
      role: tech.role,
      specialty: tech.specialty,
      skillLevel: tech.skillLevel,
      hiredAt: tech.createdAt,
      totalJobs,
      completedJobs,
      averageRating: null, // Would need feedback/rating system
      efficiency,
    };
  });

  // Cache the result
  await setCachedDimension(`technician:${organizationId}`, dimensions);

  return dimensions;
}

/**
 * Get technician by ID
 */
export async function getTechnicianById(
  organizationId: string,
  technicianId: string
): Promise<TechnicianDimension | null> {
  const dimensions = await getTechnicianDimension(organizationId);
  return dimensions.find((d) => d.technicianId === technicianId) || null;
}

/**
 * Get technicians sorted by efficiency
 */
export async function getTechniciansByEfficiency(
  organizationId: string,
  limit: number = 10
): Promise<TechnicianDimension[]> {
  const dimensions = await getTechnicianDimension(organizationId);
  return dimensions
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE DIMENSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get service dimension data
 */
export async function getServiceDimension(
  organizationId: string
): Promise<ServiceDimension[]> {
  // Check cache first
  const cached = await getCachedDimension<ServiceDimension[]>(
    `service:${organizationId}`
  );
  if (cached) return cached;

  const jobs = await db.job.findMany({
    where: { organizationId },
    select: {
      serviceType: true,
      actualDuration: true,
      invoice: {
        select: { total: true },
      },
    },
  });

  // Group by service type
  const serviceMap = new Map<string, {
    count: number;
    totalRevenue: number;
    totalDuration: number;
    durationCount: number;
  }>();

  for (const job of jobs) {
    const serviceType = job.serviceType;
    const current = serviceMap.get(serviceType) || {
      count: 0,
      totalRevenue: 0,
      totalDuration: 0,
      durationCount: 0,
    };

    current.count++;
    if (job.invoice) {
      current.totalRevenue += job.invoice.total.toNumber();
    }
    if (job.actualDuration) {
      current.totalDuration += job.actualDuration;
      current.durationCount++;
    }

    serviceMap.set(serviceType, current);
  }

  // Convert to array and sort by popularity
  const dimensions = Array.from(serviceMap.entries())
    .map(([serviceType, data], index) => ({
      serviceType,
      organizationId,
      displayName: formatServiceType(serviceType),
      category: getServiceCategory(serviceType),
      averagePrice: data.count > 0 ? data.totalRevenue / data.count : 0,
      averageDuration: data.durationCount > 0 ? data.totalDuration / data.durationCount : 0,
      popularityRank: 0,
    }))
    .sort((a, b) => b.averagePrice * b.averageDuration - a.averagePrice * a.averageDuration);

  // Assign popularity ranks
  dimensions.forEach((s, i) => {
    s.popularityRank = i + 1;
  });

  // Cache the result
  await setCachedDimension(`service:${organizationId}`, dimensions);

  return dimensions;
}

/**
 * Get service by type
 */
export async function getServiceByType(
  organizationId: string,
  serviceType: string
): Promise<ServiceDimension | null> {
  const dimensions = await getServiceDimension(organizationId);
  return dimensions.find((d) => d.serviceType === serviceType) || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION DIMENSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get location dimension data (derived from customer addresses)
 */
export async function getLocationDimension(
  organizationId: string
): Promise<LocationDimension[]> {
  const cached = await getCachedDimension<LocationDimension[]>(
    `location:${organizationId}`
  );
  if (cached) return cached;

  const customers = await db.customer.findMany({
    where: { organizationId },
    select: {
      id: true,
      address: true,
    },
  });

  const locationMap = new Map<string, LocationDimension>();

  for (const customer of customers) {
    const address = customer.address as Record<string, unknown> || {};
    const city = (address.city as string) || 'Unknown';
    const province = (address.province as string) || 'Unknown';
    const key = `${city}-${province}`;

    if (!locationMap.has(key)) {
      locationMap.set(key, {
        locationId: key,
        organizationId,
        city,
        province,
        region: getRegionForProvince(province),
        postalCode: (address.postalCode as string) || null,
        latitude: (address.coordinates as { lat?: number })?.lat || null,
        longitude: (address.coordinates as { lng?: number })?.lng || null,
        timezone: 'America/Argentina/Buenos_Aires',
      });
    }
  }

  const dimensions = Array.from(locationMap.values());
  await setCachedDimension(`location:${organizationId}`, dimensions);

  return dimensions;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIMENSION REFRESH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Refresh all dimensions for an organization
 */
export async function refreshAllDimensions(
  organizationId: string
): Promise<DimensionRefreshResult[]> {
  const results: DimensionRefreshResult[] = [];

  // Clear caches
  await clearDimensionCache(organizationId);

  // Refresh each dimension
  const dimensionFunctions = [
    { name: 'customer', fn: () => getCustomerDimension(organizationId) },
    { name: 'technician', fn: () => getTechnicianDimension(organizationId) },
    { name: 'service', fn: () => getServiceDimension(organizationId) },
    { name: 'location', fn: () => getLocationDimension(organizationId) },
  ];

  for (const { name, fn } of dimensionFunctions) {
    const startTime = Date.now();
    try {
      const data = await fn();
      results.push({
        dimension: name,
        recordsProcessed: data.length,
        recordsUpdated: data.length,
        recordsCreated: 0,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      log.error('Dimension refresh failed', {
        dimension: name,
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      results.push({
        dimension: name,
        recordsProcessed: 0,
        recordsUpdated: 0,
        recordsCreated: 0,
        durationMs: Date.now() - startTime,
      });
    }
  }

  return results;
}

/**
 * Clear dimension cache
 */
export async function clearDimensionCache(organizationId: string): Promise<void> {
  const redis = await getRedisConnection();
  const keys = await redis.keys(`${DIMENSION_CACHE_PREFIX}*:${organizationId}`);

  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function getCachedDimension<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedisConnection();
    const data = await redis.get(`${DIMENSION_CACHE_PREFIX}${key}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function setCachedDimension<T>(key: string, data: T): Promise<void> {
  try {
    const redis = await getRedisConnection();
    await redis.setex(
      `${DIMENSION_CACHE_PREFIX}${key}`,
      DIMENSION_CACHE_TTL,
      JSON.stringify(data)
    );
  } catch (error) {
    log.warn('Failed to cache dimension', { key, error: error instanceof Error ? error.message : 'Unknown' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getWeekOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 604800000; // milliseconds in a week
  return Math.ceil((diff + start.getDay() * 86400000) / oneWeek);
}

function formatServiceType(type: string): string {
  const names: Record<string, string> = {
    INSTALACION_SPLIT: 'Instalación Split',
    REPARACION_SPLIT: 'Reparación Split',
    MANTENIMIENTO_SPLIT: 'Mantenimiento Split',
    INSTALACION_CALEFACTOR: 'Instalación Calefactor',
    REPARACION_CALEFACTOR: 'Reparación Calefactor',
    MANTENIMIENTO_CALEFACTOR: 'Mantenimiento Calefactor',
    OTRO: 'Otro',
  };
  return names[type] || type.replace(/_/g, ' ');
}

function getServiceCategory(type: string): string {
  if (type.includes('INSTALACION')) return 'Instalaciones';
  if (type.includes('REPARACION')) return 'Reparaciones';
  if (type.includes('MANTENIMIENTO')) return 'Mantenimiento';
  return 'General';
}

function getRegionForProvince(province: string): string {
  const regions: Record<string, string> = {
    'Buenos Aires': 'Centro',
    'CABA': 'Centro',
    'Córdoba': 'Centro',
    'Santa Fe': 'Centro',
    'Mendoza': 'Cuyo',
    'San Juan': 'Cuyo',
    'San Luis': 'Cuyo',
    'Tucumán': 'NOA',
    'Salta': 'NOA',
    'Jujuy': 'NOA',
    'Catamarca': 'NOA',
    'La Rioja': 'NOA',
    'Santiago del Estero': 'NOA',
    'Chaco': 'NEA',
    'Corrientes': 'NEA',
    'Misiones': 'NEA',
    'Formosa': 'NEA',
    'Entre Ríos': 'Litoral',
    'Neuquén': 'Patagonia',
    'Río Negro': 'Patagonia',
    'Chubut': 'Patagonia',
    'Santa Cruz': 'Patagonia',
    'Tierra del Fuego': 'Patagonia',
    'La Pampa': 'Pampeana',
  };
  return regions[province] || 'Otros';
}
