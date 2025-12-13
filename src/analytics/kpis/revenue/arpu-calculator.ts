/**
 * ARPU Calculator
 * ===============
 *
 * Phase 10.2: Business Intelligence KPIs
 * Average Revenue Per User calculations with segmentation and trends.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { DateRange, KPIValue, TimeGranularity } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ARPUMetrics {
  arpu: number;
  arpuGrowth: number;
  medianArpu: number;
  topQuartileArpu: number;
  bottomQuartileArpu: number;
  activeCustomers: number;
  totalRevenue: number;
}

export interface ARPUBySegment {
  segment: string;
  arpu: number;
  customerCount: number;
  totalRevenue: number;
  percentOfTotal: number;
}

export interface ARPUByServiceType {
  serviceType: string;
  displayName: string;
  arpu: number;
  customerCount: number;
  totalRevenue: number;
}

export interface ARPUTrend {
  period: string;
  arpu: number;
  activeCustomers: number;
  totalRevenue: number;
  changePercent: number;
}

export interface CustomerRevenueDistribution {
  range: string;
  minValue: number;
  maxValue: number;
  customerCount: number;
  percentOfCustomers: number;
  totalRevenue: number;
  percentOfRevenue: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARPU CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate comprehensive ARPU metrics
 */
export async function calculateARPUMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<ARPUMetrics> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      status: 'PAID',
    },
    select: {
      total: true,
      customerId: true,
    },
  });

  // Group revenue by customer
  const customerRevenue = new Map<string, number>();

  for (const invoice of invoices) {
    if (invoice.customerId) {
      const current = customerRevenue.get(invoice.customerId) || 0;
      customerRevenue.set(invoice.customerId, current + (invoice.total?.toNumber() || 0));
    }
  }

  const revenues = Array.from(customerRevenue.values()).sort((a, b) => a - b);
  const activeCustomers = revenues.length;

  if (activeCustomers === 0) {
    return {
      arpu: 0,
      arpuGrowth: 0,
      medianArpu: 0,
      topQuartileArpu: 0,
      bottomQuartileArpu: 0,
      activeCustomers: 0,
      totalRevenue: 0,
    };
  }

  const totalRevenue = revenues.reduce((sum, r) => sum + r, 0);
  const arpu = totalRevenue / activeCustomers;

  // Calculate quartiles
  const medianIndex = Math.floor(activeCustomers / 2);
  const medianArpu = activeCustomers % 2 === 0
    ? (revenues[medianIndex - 1] + revenues[medianIndex]) / 2
    : revenues[medianIndex];

  const bottomQuartileIndex = Math.floor(activeCustomers * 0.25);
  const topQuartileIndex = Math.floor(activeCustomers * 0.75);
  const bottomQuartileArpu = revenues[bottomQuartileIndex] || 0;
  const topQuartileArpu = revenues[topQuartileIndex] || arpu;

  // Calculate growth compared to previous period
  const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
  const prevRange = {
    start: new Date(dateRange.start.getTime() - periodLength),
    end: new Date(dateRange.start.getTime() - 1),
  };

  const prevArpu = await calculatePreviousPeriodARPU(organizationId, prevRange);
  const arpuGrowth = prevArpu > 0 ? ((arpu - prevArpu) / prevArpu) * 100 : 0;

  return {
    arpu,
    arpuGrowth,
    medianArpu,
    topQuartileArpu,
    bottomQuartileArpu,
    activeCustomers,
    totalRevenue,
  };
}

/**
 * Calculate ARPU for a previous period
 */
async function calculatePreviousPeriodARPU(
  organizationId: string,
  dateRange: DateRange
): Promise<number> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      status: 'PAID',
    },
    select: {
      total: true,
      customerId: true,
    },
  });

  const customerRevenue = new Map<string, number>();

  for (const invoice of invoices) {
    if (invoice.customerId) {
      const current = customerRevenue.get(invoice.customerId) || 0;
      customerRevenue.set(invoice.customerId, current + (invoice.total?.toNumber() || 0));
    }
  }

  const revenues = Array.from(customerRevenue.values());
  if (revenues.length === 0) return 0;

  const totalRevenue = revenues.reduce((sum, r) => sum + r, 0);
  return totalRevenue / revenues.length;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARPU BY SEGMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate ARPU broken down by customer segment
 */
export async function getARPUBySegment(
  organizationId: string,
  dateRange: DateRange
): Promise<ARPUBySegment[]> {
  // Get all customers with their revenue
  const customers = await db.customer.findMany({
    where: { organizationId },
    include: {
      invoices: {
        where: {
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
          status: 'PAID',
        },
        select: {
          total: true,
        },
      },
      jobs: {
        select: {
          completedAt: true,
        },
      },
    },
  });

  // Segment customers
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  type ARPUCustomerType = typeof customers[number];
  type ARPUInvoiceType = ARPUCustomerType['invoices'][number];
  type ARPUJobType = ARPUCustomerType['jobs'][number];

  const segmentData = new Map<string, { revenue: number; count: number }>();

  for (const customer of customers) {
    const revenue = customer.invoices.reduce(
      (sum: number, inv: ARPUInvoiceType) => sum + (inv.total?.toNumber() || 0),
      0
    );

    const totalJobs = customer.jobs.length;
    const lastJobAt = customer.jobs
      .filter((j: ARPUJobType) => j.completedAt)
      .sort((a: ARPUJobType, b: ARPUJobType) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0]
      ?.completedAt;

    // Determine segment
    let segment: string;
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

    const current = segmentData.get(segment) || { revenue: 0, count: 0 };
    current.revenue += revenue;
    if (revenue > 0) current.count++;
    segmentData.set(segment, current);
  }

  // Calculate total revenue for percentages
  const totalRevenue = Array.from(segmentData.values()).reduce(
    (sum, s) => sum + s.revenue,
    0
  );

  // Format results
  const segmentNames: Record<string, string> = {
    new: 'Nuevos',
    active: 'Activos',
    loyal: 'Leales',
    at_risk: 'En Riesgo',
    churned: 'Perdidos',
  };

  const results: ARPUBySegment[] = [];

  for (const [segment, data] of segmentData) {
    if (data.count > 0) {
      results.push({
        segment: segmentNames[segment] || segment,
        arpu: data.revenue / data.count,
        customerCount: data.count,
        totalRevenue: data.revenue,
        percentOfTotal: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      });
    }
  }

  return results.sort((a, b) => b.arpu - a.arpu);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARPU BY SERVICE TYPE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate ARPU by service type
 */
export async function getARPUByServiceType(
  organizationId: string,
  dateRange: DateRange
): Promise<ARPUByServiceType[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      completedAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      serviceType: true,
      customerId: true,
      invoice: {
        select: { total: true },
      },
    },
  });

  // Group by service type
  const serviceData = new Map<string, {
    revenue: number;
    customers: Set<string>;
  }>();

  for (const job of jobs) {
    const serviceType = job.serviceType || 'other';
    const current = serviceData.get(serviceType) || {
      revenue: 0,
      customers: new Set(),
    };

    current.revenue += job.invoice?.total?.toNumber() || 0;
    if (job.customerId) {
      current.customers.add(job.customerId);
    }
    serviceData.set(serviceType, current);
  }

  const serviceNames: Record<string, string> = {
    installation: 'Instalación',
    repair: 'Reparación',
    maintenance: 'Mantenimiento',
    inspection: 'Inspección',
    emergency: 'Emergencia',
    other: 'Otro',
  };

  const results: ARPUByServiceType[] = [];

  for (const [serviceType, data] of serviceData) {
    const customerCount = data.customers.size;
    if (customerCount > 0) {
      results.push({
        serviceType,
        displayName: serviceNames[serviceType] || serviceType,
        arpu: data.revenue / customerCount,
        customerCount,
        totalRevenue: data.revenue,
      });
    }
  }

  return results.sort((a, b) => b.arpu - a.arpu);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARPU TRENDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get ARPU trend over time
 */
export async function getARPUTrend(
  organizationId: string,
  dateRange: DateRange,
  granularity: TimeGranularity = 'month'
): Promise<ARPUTrend[]> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      status: 'PAID',
    },
    select: {
      total: true,
      customerId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by period
  const periodData = new Map<string, {
    revenue: number;
    customers: Set<string>;
  }>();

  for (const invoice of invoices) {
    const period = formatPeriod(invoice.createdAt, granularity);
    const current = periodData.get(period) || {
      revenue: 0,
      customers: new Set(),
    };

    current.revenue += invoice.total?.toNumber() || 0;
    if (invoice.customerId) {
      current.customers.add(invoice.customerId);
    }
    periodData.set(period, current);
  }

  // Generate trend data
  const sortedPeriods = Array.from(periodData.keys()).sort();
  const trend: ARPUTrend[] = [];
  let previousArpu = 0;

  for (const period of sortedPeriods) {
    const data = periodData.get(period)!;
    const activeCustomers = data.customers.size;
    const arpu = activeCustomers > 0 ? data.revenue / activeCustomers : 0;
    const changePercent = previousArpu > 0 ? ((arpu - previousArpu) / previousArpu) * 100 : 0;

    trend.push({
      period,
      arpu,
      activeCustomers,
      totalRevenue: data.revenue,
      changePercent,
    });

    previousArpu = arpu;
  }

  return trend;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVENUE DISTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get customer revenue distribution (for identifying revenue concentration)
 */
export async function getCustomerRevenueDistribution(
  organizationId: string,
  dateRange: DateRange
): Promise<CustomerRevenueDistribution[]> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      status: 'PAID',
    },
    select: {
      total: true,
      customerId: true,
    },
  });

  // Group by customer
  const customerRevenue = new Map<string, number>();

  for (const invoice of invoices) {
    if (invoice.customerId) {
      const current = customerRevenue.get(invoice.customerId) || 0;
      customerRevenue.set(invoice.customerId, current + (invoice.total?.toNumber() || 0));
    }
  }

  const revenues = Array.from(customerRevenue.values()).filter(r => r > 0);
  const totalCustomers = revenues.length;
  const totalRevenue = revenues.reduce((sum, r) => sum + r, 0);

  if (totalCustomers === 0) {
    return [];
  }

  // Define revenue ranges based on data
  const maxRevenue = Math.max(...revenues);
  const ranges = [
    { label: '$0 - $10,000', min: 0, max: 10000 },
    { label: '$10,000 - $50,000', min: 10000, max: 50000 },
    { label: '$50,000 - $100,000', min: 50000, max: 100000 },
    { label: '$100,000 - $500,000', min: 100000, max: 500000 },
    { label: '$500,000+', min: 500000, max: Infinity },
  ];

  const distribution: CustomerRevenueDistribution[] = ranges
    .map((range) => {
      const customersInRange = revenues.filter(
        (r) => r >= range.min && r < range.max
      );
      const revenueInRange = customersInRange.reduce((sum, r) => sum + r, 0);

      return {
        range: range.label,
        minValue: range.min,
        maxValue: range.max === Infinity ? maxRevenue : range.max,
        customerCount: customersInRange.length,
        percentOfCustomers: (customersInRange.length / totalCustomers) * 100,
        totalRevenue: revenueInRange,
        percentOfRevenue: totalRevenue > 0 ? (revenueInRange / totalRevenue) * 100 : 0,
      };
    })
    .filter((d) => d.customerCount > 0);

  return distribution;
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate ARPU KPIs for dashboard
 */
export async function generateARPUKPIs(
  organizationId: string,
  dateRange: DateRange
): Promise<Array<{
  id: string;
  name: string;
  value: number;
  unit: 'currency' | 'percentage' | 'number';
  trend: 'up' | 'down' | 'stable';
  changePercent?: number;
  description?: string;
}>> {
  const metrics = await calculateARPUMetrics(organizationId, dateRange);
  const bySegment = await getARPUBySegment(organizationId, dateRange);

  // Find top segment by ARPU
  const topSegment = bySegment[0];

  return [
    {
      id: 'arpu',
      name: 'ARPU',
      value: metrics.arpu,
      unit: 'currency',
      trend: metrics.arpuGrowth > 0 ? 'up' : metrics.arpuGrowth < 0 ? 'down' : 'stable',
      changePercent: metrics.arpuGrowth,
      description: 'Ingreso Promedio por Usuario',
    },
    {
      id: 'median_arpu',
      name: 'ARPU Mediano',
      value: metrics.medianArpu,
      unit: 'currency',
      trend: 'stable',
      description: 'Valor central de ingresos por cliente',
    },
    {
      id: 'top_quartile_arpu',
      name: 'ARPU Top 25%',
      value: metrics.topQuartileArpu,
      unit: 'currency',
      trend: 'stable',
      description: 'ARPU del cuartil superior',
    },
    {
      id: 'active_customers',
      name: 'Clientes Activos',
      value: metrics.activeCustomers,
      unit: 'number',
      trend: 'stable',
      description: 'Clientes con facturación en el período',
    },
    {
      id: 'top_segment_arpu',
      name: `ARPU ${topSegment?.segment || 'N/A'}`,
      value: topSegment?.arpu || 0,
      unit: 'currency',
      trend: 'stable',
      description: `Segmento con mayor ARPU`,
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatPeriod(date: Date, granularity: TimeGranularity): string {
  switch (granularity) {
    case 'day':
      return date.toISOString().slice(0, 10);
    case 'week':
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return weekStart.toISOString().slice(0, 10);
    case 'month':
      return date.toISOString().slice(0, 7);
    case 'quarter':
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()}-Q${quarter}`;
    case 'year':
      return date.getFullYear().toString();
    default:
      return date.toISOString().slice(0, 10);
  }
}
