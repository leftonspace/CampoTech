/**
 * MRR/ARR Calculator
 * ==================
 *
 * Phase 10.2: Business Intelligence KPIs
 * Monthly and Annual Recurring Revenue calculations.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { DateRange, KPIValue } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MRRMetrics {
  mrr: number;
  arr: number;
  mrrGrowth: number;
  newMrr: number;
  expansionMrr: number;
  churnedMrr: number;
  netNewMrr: number;
}

export interface MRRTrend {
  month: string;
  mrr: number;
  newMrr: number;
  expansionMrr: number;
  churnedMrr: number;
  customerCount: number;
}

export interface ARPUMetrics {
  arpu: number;
  arpuGrowth: number;
  medianArpu: number;
  topQuartileArpu: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MRR CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate MRR based on recurring revenue patterns
 * For service businesses, we estimate MRR from average monthly invoiced amount
 */
export async function calculateMRR(
  organizationId: string,
  referenceDate: Date = new Date()
): Promise<MRRMetrics> {
  // Get last 3 months of invoices for MRR estimation
  const threeMonthsAgo = new Date(referenceDate);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: threeMonthsAgo,
        lte: referenceDate,
      },
      status: { in: ['paid', 'partial'] },
    },
    include: {
      customer: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by month
  const monthlyData = new Map<string, {
    revenue: number;
    customers: Set<string>;
  }>();

  for (const invoice of invoices) {
    const month = invoice.createdAt.toISOString().slice(0, 7);
    const current = monthlyData.get(month) || { revenue: 0, customers: new Set() };
    current.revenue += invoice.total?.toNumber() || 0;
    if (invoice.customerId) {
      current.customers.add(invoice.customerId);
    }
    monthlyData.set(month, current);
  }

  // Calculate average MRR from last 3 months
  const months = Array.from(monthlyData.values());
  const avgMrr = months.length > 0
    ? months.reduce((sum, m) => sum + m.revenue, 0) / months.length
    : 0;

  // Get current and previous month for growth calculation
  const currentMonth = referenceDate.toISOString().slice(0, 7);
  const prevDate = new Date(referenceDate);
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonth = prevDate.toISOString().slice(0, 7);

  const currentMrr = monthlyData.get(currentMonth)?.revenue || avgMrr;
  const prevMrr = monthlyData.get(prevMonth)?.revenue || avgMrr;

  // Calculate MRR components
  const mrrComponents = await calculateMRRComponents(organizationId, referenceDate);

  const mrrGrowth = prevMrr > 0
    ? ((currentMrr - prevMrr) / prevMrr) * 100
    : 0;

  return {
    mrr: currentMrr,
    arr: currentMrr * 12,
    mrrGrowth,
    newMrr: mrrComponents.newMrr,
    expansionMrr: mrrComponents.expansionMrr,
    churnedMrr: mrrComponents.churnedMrr,
    netNewMrr: mrrComponents.newMrr + mrrComponents.expansionMrr - mrrComponents.churnedMrr,
  };
}

/**
 * Calculate MRR components (new, expansion, churned)
 */
async function calculateMRRComponents(
  organizationId: string,
  referenceDate: Date
): Promise<{
  newMrr: number;
  expansionMrr: number;
  churnedMrr: number;
}> {
  const currentMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const lastMonth = new Date(currentMonth);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  // Current month revenue by customer
  const currentInvoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: currentMonth,
        lt: nextMonth,
      },
    },
    select: {
      customerId: true,
      total: true,
    },
  });

  // Previous month revenue by customer
  const prevInvoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: lastMonth,
        lt: currentMonth,
      },
    },
    select: {
      customerId: true,
      total: true,
    },
  });

  // Build customer revenue maps
  const currentRevenue = new Map<string, number>();
  const prevRevenue = new Map<string, number>();

  for (const inv of currentInvoices) {
    if (inv.customerId) {
      const current = currentRevenue.get(inv.customerId) || 0;
      currentRevenue.set(inv.customerId, current + (inv.total?.toNumber() || 0));
    }
  }

  for (const inv of prevInvoices) {
    if (inv.customerId) {
      const current = prevRevenue.get(inv.customerId) || 0;
      prevRevenue.set(inv.customerId, current + (inv.total?.toNumber() || 0));
    }
  }

  // Calculate components
  let newMrr = 0;
  let expansionMrr = 0;
  let churnedMrr = 0;

  // New and expansion
  for (const [customerId, revenue] of currentRevenue) {
    const prevRev = prevRevenue.get(customerId) || 0;
    if (prevRev === 0) {
      newMrr += revenue;
    } else if (revenue > prevRev) {
      expansionMrr += revenue - prevRev;
    }
  }

  // Churned (customers who had revenue last month but not this month)
  for (const [customerId, revenue] of prevRevenue) {
    const currentRev = currentRevenue.get(customerId) || 0;
    if (currentRev === 0) {
      churnedMrr += revenue;
    } else if (currentRev < revenue) {
      churnedMrr += revenue - currentRev; // Contraction counts as partial churn
    }
  }

  return { newMrr, expansionMrr, churnedMrr };
}

/**
 * Get MRR trend over time
 */
export async function getMRRTrend(
  organizationId: string,
  months: number = 12
): Promise<MRRTrend[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      total: true,
      createdAt: true,
      customerId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by month
  const monthlyData = new Map<string, {
    revenue: number;
    customers: Set<string>;
    invoices: { customerId: string; total: number }[];
  }>();

  for (const invoice of invoices) {
    const month = invoice.createdAt.toISOString().slice(0, 7);
    const current = monthlyData.get(month) || {
      revenue: 0,
      customers: new Set(),
      invoices: [],
    };
    const total = invoice.total?.toNumber() || 0;
    current.revenue += total;
    if (invoice.customerId) {
      current.customers.add(invoice.customerId);
      current.invoices.push({ customerId: invoice.customerId, total });
    }
    monthlyData.set(month, current);
  }

  // Generate trend data
  const sortedMonths = Array.from(monthlyData.keys()).sort();
  const trend: MRRTrend[] = [];
  let prevCustomerRevenue = new Map<string, number>();

  for (const month of sortedMonths) {
    const data = monthlyData.get(month)!;

    // Build current month customer revenue
    const currentCustomerRevenue = new Map<string, number>();
    for (const inv of data.invoices) {
      const current = currentCustomerRevenue.get(inv.customerId) || 0;
      currentCustomerRevenue.set(inv.customerId, current + inv.total);
    }

    // Calculate components
    let newMrr = 0;
    let expansionMrr = 0;
    let churnedMrr = 0;

    for (const [customerId, revenue] of currentCustomerRevenue) {
      const prevRev = prevCustomerRevenue.get(customerId) || 0;
      if (prevRev === 0) {
        newMrr += revenue;
      } else if (revenue > prevRev) {
        expansionMrr += revenue - prevRev;
      }
    }

    for (const [customerId, revenue] of prevCustomerRevenue) {
      const currentRev = currentCustomerRevenue.get(customerId) || 0;
      if (currentRev < revenue) {
        churnedMrr += revenue - currentRev;
      }
    }

    trend.push({
      month,
      mrr: data.revenue,
      newMrr,
      expansionMrr,
      churnedMrr,
      customerCount: data.customers.size,
    });

    prevCustomerRevenue = currentCustomerRevenue;
  }

  return trend;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARPU CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate Average Revenue Per User (ARPU)
 */
export async function calculateARPU(
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

  const revenues = Array.from(customerRevenue.values()).sort((a, b) => a - b);

  if (revenues.length === 0) {
    return {
      arpu: 0,
      arpuGrowth: 0,
      medianArpu: 0,
      topQuartileArpu: 0,
    };
  }

  const totalRevenue = revenues.reduce((sum, r) => sum + r, 0);
  const arpu = totalRevenue / revenues.length;
  const medianIndex = Math.floor(revenues.length / 2);
  const medianArpu = revenues.length % 2 === 0
    ? (revenues[medianIndex - 1] + revenues[medianIndex]) / 2
    : revenues[medianIndex];
  const topQuartileIndex = Math.floor(revenues.length * 0.75);
  const topQuartileArpu = revenues[topQuartileIndex] || arpu;

  // Calculate growth (compare to previous period)
  const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
  const prevRange = {
    start: new Date(dateRange.start.getTime() - periodLength),
    end: new Date(dateRange.start.getTime() - 1),
  };

  const prevInvoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: prevRange.start,
        lte: prevRange.end,
      },
    },
    select: {
      total: true,
      customerId: true,
    },
  });

  const prevCustomerRevenue = new Map<string, number>();
  for (const invoice of prevInvoices) {
    if (invoice.customerId) {
      const current = prevCustomerRevenue.get(invoice.customerId) || 0;
      prevCustomerRevenue.set(invoice.customerId, current + (invoice.total?.toNumber() || 0));
    }
  }

  const prevRevenues = Array.from(prevCustomerRevenue.values());
  const prevArpu = prevRevenues.length > 0
    ? prevRevenues.reduce((sum, r) => sum + r, 0) / prevRevenues.length
    : 0;

  const arpuGrowth = prevArpu > 0 ? ((arpu - prevArpu) / prevArpu) * 100 : 0;

  return {
    arpu,
    arpuGrowth,
    medianArpu,
    topQuartileArpu,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate MRR/ARR KPIs for dashboard
 */
export async function generateMRRKPIs(
  organizationId: string
): Promise<KPIValue[]> {
  const metrics = await calculateMRR(organizationId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return [
    {
      id: 'mrr',
      name: 'MRR',
      value: metrics.mrr,
      unit: 'currency',
      trend: metrics.mrrGrowth > 0 ? 'up' : metrics.mrrGrowth < 0 ? 'down' : 'stable',
      changePercent: metrics.mrrGrowth,
      period: {
        start: monthStart,
        end: now,
      },
    },
    {
      id: 'arr',
      name: 'ARR',
      value: metrics.arr,
      unit: 'currency',
      trend: metrics.mrrGrowth > 0 ? 'up' : metrics.mrrGrowth < 0 ? 'down' : 'stable',
      changePercent: metrics.mrrGrowth,
      period: {
        start: monthStart,
        end: now,
      },
    },
    {
      id: 'net_new_mrr',
      name: 'MRR Neto Nuevo',
      value: metrics.netNewMrr,
      unit: 'currency',
      trend: metrics.netNewMrr > 0 ? 'up' : metrics.netNewMrr < 0 ? 'down' : 'stable',
      period: {
        start: monthStart,
        end: now,
      },
    },
    {
      id: 'new_mrr',
      name: 'MRR Nuevo',
      value: metrics.newMrr,
      unit: 'currency',
      trend: 'stable',
      period: {
        start: monthStart,
        end: now,
      },
    },
    {
      id: 'churned_mrr',
      name: 'MRR Perdido',
      value: metrics.churnedMrr,
      unit: 'currency',
      trend: metrics.churnedMrr > 0 ? 'down' : 'stable',
      period: {
        start: monthStart,
        end: now,
      },
    },
  ];
}
