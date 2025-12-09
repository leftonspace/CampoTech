/**
 * Revenue Metrics Calculator
 * ==========================
 *
 * Phase 10.2: Business Intelligence KPIs
 * Calculates core revenue metrics for the organization.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { DateRange, KPIValue, TimeGranularity } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RevenueMetrics {
  totalRevenue: number;
  invoicedAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  averageInvoiceValue: number;
  revenueGrowthRate: number;
  collectionRate: number;
}

export interface RevenueTrend {
  period: string;
  revenue: number;
  invoiceCount: number;
  averageValue: number;
}

export interface RevenueBySource {
  serviceType: string;
  revenue: number;
  percentage: number;
  invoiceCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE METRICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate comprehensive revenue metrics for a period
 */
export async function calculateRevenueMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<RevenueMetrics> {
  // Get all invoices in the period
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      payments: true,
    },
  });

  // Calculate totals
  let totalInvoiced = 0;
  let totalCollected = 0;

  for (const invoice of invoices) {
    totalInvoiced += invoice.total?.toNumber() || 0;

    const paymentSum = invoice.payments.reduce(
      (sum, p) => sum + (p.amount?.toNumber() || 0),
      0
    );
    totalCollected += paymentSum;
  }

  const outstanding = totalInvoiced - totalCollected;
  const avgInvoiceValue = invoices.length > 0 ? totalInvoiced / invoices.length : 0;
  const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

  // Calculate growth rate (compare to previous period)
  const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
  const previousStart = new Date(dateRange.start.getTime() - periodLength);
  const previousEnd = new Date(dateRange.start.getTime() - 1);

  const previousInvoices = await db.invoice.aggregate({
    where: {
      organizationId,
      createdAt: {
        gte: previousStart,
        lte: previousEnd,
      },
    },
    _sum: {
      total: true,
    },
  });

  const previousRevenue = previousInvoices._sum.total?.toNumber() || 0;
  const growthRate = previousRevenue > 0
    ? ((totalInvoiced - previousRevenue) / previousRevenue) * 100
    : 0;

  return {
    totalRevenue: totalInvoiced,
    invoicedAmount: totalInvoiced,
    collectedAmount: totalCollected,
    outstandingAmount: outstanding,
    averageInvoiceValue: avgInvoiceValue,
    revenueGrowthRate: growthRate,
    collectionRate,
  };
}

/**
 * Get revenue trend over time
 */
export async function getRevenueTrend(
  organizationId: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): Promise<RevenueTrend[]> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      total: true,
      createdAt: true,
    },
  });

  // Group by period
  const periodMap = new Map<string, { revenue: number; count: number }>();

  for (const invoice of invoices) {
    const period = formatPeriod(invoice.createdAt, granularity);
    const current = periodMap.get(period) || { revenue: 0, count: 0 };
    current.revenue += invoice.total?.toNumber() || 0;
    current.count++;
    periodMap.set(period, current);
  }

  // Fill in missing periods
  const periods = generatePeriods(dateRange.start, dateRange.end, granularity);

  return periods.map((period) => {
    const data = periodMap.get(period) || { revenue: 0, count: 0 };
    return {
      period,
      revenue: data.revenue,
      invoiceCount: data.count,
      averageValue: data.count > 0 ? data.revenue / data.count : 0,
    };
  });
}

/**
 * Get revenue breakdown by service type
 */
export async function getRevenueByServiceType(
  organizationId: string,
  dateRange: DateRange
): Promise<RevenueBySource[]> {
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
      actualTotal: true,
    },
  });

  // Group by service type
  const serviceMap = new Map<string, { revenue: number; count: number }>();
  let totalRevenue = 0;

  for (const job of jobs) {
    const serviceType = job.serviceType || 'other';
    const revenue = job.actualTotal?.toNumber() || 0;

    const current = serviceMap.get(serviceType) || { revenue: 0, count: 0 };
    current.revenue += revenue;
    current.count++;
    serviceMap.set(serviceType, current);

    totalRevenue += revenue;
  }

  // Convert to array and calculate percentages
  return Array.from(serviceMap.entries())
    .map(([serviceType, data]) => ({
      serviceType,
      revenue: data.revenue,
      percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      invoiceCount: data.count,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * Get revenue by customer segment
 */
export async function getRevenueByCustomerSegment(
  organizationId: string,
  dateRange: DateRange
): Promise<{ segment: string; revenue: number; customerCount: number }[]> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      customer: {
        include: {
          jobs: {
            select: {
              id: true,
              completedAt: true,
            },
          },
        },
      },
    },
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Segment customers and aggregate revenue
  const segmentMap = new Map<string, { revenue: number; customers: Set<string> }>();

  for (const invoice of invoices) {
    const customer = invoice.customer;
    if (!customer) continue;

    // Determine segment
    const totalJobs = customer.jobs.length;
    const lastJobAt = customer.jobs
      .filter((j) => j.completedAt)
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0]
      ?.completedAt || null;

    let segment = 'new';
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

    const current = segmentMap.get(segment) || { revenue: 0, customers: new Set<string>() };
    current.revenue += invoice.total?.toNumber() || 0;
    current.customers.add(customer.id);
    segmentMap.set(segment, current);
  }

  return Array.from(segmentMap.entries())
    .map(([segment, data]) => ({
      segment,
      revenue: data.revenue,
      customerCount: data.customers.size,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate revenue KPIs for dashboard
 */
export async function generateRevenueKPIs(
  organizationId: string,
  dateRange: DateRange
): Promise<KPIValue[]> {
  const metrics = await calculateRevenueMetrics(organizationId, dateRange);

  return [
    {
      id: 'total_revenue',
      name: 'Ingresos Totales',
      value: metrics.totalRevenue,
      unit: 'currency',
      trend: metrics.revenueGrowthRate > 0 ? 'up' : metrics.revenueGrowthRate < 0 ? 'down' : 'stable',
      changePercent: metrics.revenueGrowthRate,
      period: {
        start: dateRange.start,
        end: dateRange.end,
      },
    },
    {
      id: 'collected_amount',
      name: 'Cobrado',
      value: metrics.collectedAmount,
      unit: 'currency',
      trend: 'stable',
      period: {
        start: dateRange.start,
        end: dateRange.end,
      },
    },
    {
      id: 'outstanding_amount',
      name: 'Pendiente de Cobro',
      value: metrics.outstandingAmount,
      unit: 'currency',
      trend: 'stable',
      period: {
        start: dateRange.start,
        end: dateRange.end,
      },
    },
    {
      id: 'avg_invoice_value',
      name: 'Ticket Promedio',
      value: metrics.averageInvoiceValue,
      unit: 'currency',
      trend: 'stable',
      period: {
        start: dateRange.start,
        end: dateRange.end,
      },
    },
    {
      id: 'collection_rate',
      name: 'Tasa de Cobro',
      value: metrics.collectionRate,
      unit: 'percentage',
      trend: metrics.collectionRate >= 90 ? 'up' : metrics.collectionRate >= 70 ? 'stable' : 'down',
      period: {
        start: dateRange.start,
        end: dateRange.end,
      },
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatPeriod(date: Date, granularity: TimeGranularity): string {
  switch (granularity) {
    case 'hour':
      return `${date.toISOString().slice(0, 10)} ${date.getHours().toString().padStart(2, '0')}:00`;
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

function generatePeriods(start: Date, end: Date, granularity: TimeGranularity): string[] {
  const periods: string[] = [];
  const current = new Date(start);

  while (current <= end) {
    periods.push(formatPeriod(current, granularity));

    switch (granularity) {
      case 'hour':
        current.setHours(current.getHours() + 1);
        break;
      case 'day':
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'quarter':
        current.setMonth(current.getMonth() + 3);
        break;
      case 'year':
        current.setFullYear(current.getFullYear() + 1);
        break;
    }
  }

  return [...new Set(periods)]; // Remove duplicates
}
