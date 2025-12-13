/**
 * Customer Lifetime Value Calculator
 * ===================================
 *
 * Phase 10.2: Business Intelligence KPIs
 * Customer value and retention metrics.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { DateRange, KPIResult, CustomerDimension } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CustomerMetrics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
  churnRate: number;
  retentionRate: number;
  avgLifetimeValue: number;
  avgCustomerAge: number;
  avgJobsPerCustomer: number;
}

export interface CLVBreakdown {
  segment: string;
  customerCount: number;
  totalRevenue: number;
  avgCLV: number;
  avgJobsPerCustomer: number;
  avgJobValue: number;
}

export interface CustomerCohort {
  cohort: string; // Month of first purchase
  totalCustomers: number;
  activeCustomers: number;
  retentionRate: number;
  totalRevenue: number;
  avgRevenuePerCustomer: number;
}

export interface ChurnRiskCustomer {
  customerId: string;
  name: string;
  lastJobDate: Date | null;
  daysSinceLastJob: number;
  totalJobs: number;
  totalRevenue: number;
  riskScore: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER METRICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate comprehensive customer metrics
 */
export async function calculateCustomerMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<CustomerMetrics> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Get all customers with their jobs
  const customers = await db.customer.findMany({
    where: { organizationId },
    include: {
      jobs: {
        select: {
          id: true,
          completedAt: true,
          invoice: { select: { total: true } },
        },
      },
    },
  });

  const totalCustomers = customers.length;

  // Calculate metrics
  let activeCustomers = 0;
  let newCustomers = 0;
  let churnedCustomers = 0;
  let totalRevenue = 0;
  let totalJobs = 0;
  let totalCustomerAge = 0;

  for (const customer of customers) {
    const completedJobs = customer.jobs.filter((j) => j.completedAt);
    const lastJobAt = completedJobs
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0]
      ?.completedAt || null;

    // New customers (created in date range)
    if (customer.createdAt >= dateRange.start && customer.createdAt <= dateRange.end) {
      newCustomers++;
    }

    // Active customers (job in last 30 days)
    if (lastJobAt && lastJobAt >= thirtyDaysAgo) {
      activeCustomers++;
    }

    // Churned customers (no job in 90+ days, but had at least one job)
    if (completedJobs.length > 0 && (!lastJobAt || lastJobAt < ninetyDaysAgo)) {
      churnedCustomers++;
    }

    // Revenue and jobs
    const customerRevenue = customer.jobs.reduce(
      (sum, j) => sum + (j.invoice?.total?.toNumber() || 0),
      0
    );
    totalRevenue += customerRevenue;
    totalJobs += customer.jobs.length;

    // Customer age
    const age = (now.getTime() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    totalCustomerAge += age;
  }

  const avgLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const avgCustomerAge = totalCustomers > 0 ? totalCustomerAge / totalCustomers : 0;
  const avgJobsPerCustomer = totalCustomers > 0 ? totalJobs / totalCustomers : 0;

  // Churn rate (churned / total with at least one job)
  const customersWithJobs = customers.filter((c) => c.jobs.length > 0).length;
  const churnRate = customersWithJobs > 0 ? (churnedCustomers / customersWithJobs) * 100 : 0;
  const retentionRate = 100 - churnRate;

  return {
    totalCustomers,
    activeCustomers,
    newCustomers,
    churnedCustomers,
    churnRate,
    retentionRate,
    avgLifetimeValue,
    avgCustomerAge,
    avgJobsPerCustomer,
  };
}

/**
 * Calculate Customer Lifetime Value for individual customer
 */
export async function calculateIndividualCLV(
  organizationId: string,
  customerId: string
): Promise<{
  clv: number;
  avgOrderValue: number;
  purchaseFrequency: number;
  customerLifespan: number;
  predictedCLV: number;
}> {
  const customer = await db.customer.findFirst({
    where: {
      id: customerId,
      organizationId,
    },
    include: {
      jobs: {
        select: {
          invoice: { select: { total: true } },
          completedAt: true,
        },
      },
    },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  const completedJobs = customer.jobs.filter((j) => j.completedAt);
  const totalRevenue = completedJobs.reduce(
    (sum, j) => sum + (j.invoice?.total?.toNumber() || 0),
    0
  );

  const avgOrderValue = completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0;

  // Calculate purchase frequency (jobs per year)
  const customerAge = (new Date().getTime() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365);
  const purchaseFrequency = customerAge > 0 ? completedJobs.length / customerAge : 0;

  // Customer lifespan (in years, minimum 1 year for new customers)
  const customerLifespan = Math.max(customerAge, 1);

  // Historical CLV
  const clv = totalRevenue;

  // Predicted CLV (simple model: AOV * frequency * expected lifespan)
  const expectedLifespan = 3; // Assume 3-year average customer lifespan
  const predictedCLV = avgOrderValue * purchaseFrequency * expectedLifespan;

  return {
    clv,
    avgOrderValue,
    purchaseFrequency,
    customerLifespan,
    predictedCLV,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLV ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get CLV breakdown by customer segment
 */
export async function getCLVBySegment(
  organizationId: string
): Promise<CLVBreakdown[]> {
  const customers = await db.customer.findMany({
    where: { organizationId },
    include: {
      jobs: {
        select: {
          invoice: { select: { total: true } },
          completedAt: true,
        },
      },
    },
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Segment customers
  const segments = new Map<string, {
    customers: number;
    revenue: number;
    jobs: number;
  }>();

  for (const customer of customers) {
    const completedJobs = customer.jobs.filter((j) => j.completedAt);
    const totalJobs = completedJobs.length;
    const totalRevenue = completedJobs.reduce(
      (sum, j) => sum + (j.invoice?.total?.toNumber() || 0),
      0
    );
    const lastJobAt = completedJobs
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0]
      ?.completedAt || null;

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

    const current = segments.get(segment) || { customers: 0, revenue: 0, jobs: 0 };
    current.customers++;
    current.revenue += totalRevenue;
    current.jobs += totalJobs;
    segments.set(segment, current);
  }

  return Array.from(segments.entries()).map(([segment, data]) => ({
    segment,
    customerCount: data.customers,
    totalRevenue: data.revenue,
    avgCLV: data.customers > 0 ? data.revenue / data.customers : 0,
    avgJobsPerCustomer: data.customers > 0 ? data.jobs / data.customers : 0,
    avgJobValue: data.jobs > 0 ? data.revenue / data.jobs : 0,
  }));
}

/**
 * Get cohort analysis
 */
export async function getCohortAnalysis(
  organizationId: string,
  months: number = 12
): Promise<CustomerCohort[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const customers = await db.customer.findMany({
    where: {
      organizationId,
      createdAt: { gte: startDate },
    },
    include: {
      jobs: {
        select: {
          invoice: { select: { total: true } },
          completedAt: true,
        },
      },
    },
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Group by cohort (month of customer creation)
  const cohorts = new Map<string, {
    total: number;
    active: number;
    revenue: number;
  }>();

  for (const customer of customers) {
    const cohort = customer.createdAt.toISOString().slice(0, 7);
    const current = cohorts.get(cohort) || { total: 0, active: 0, revenue: 0 };

    current.total++;

    const completedJobs = customer.jobs.filter((j) => j.completedAt);
    const lastJobAt = completedJobs
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0]
      ?.completedAt || null;

    if (lastJobAt && lastJobAt >= thirtyDaysAgo) {
      current.active++;
    }

    const revenue = completedJobs.reduce(
      (sum, j) => sum + (j.invoice?.total?.toNumber() || 0),
      0
    );
    current.revenue += revenue;

    cohorts.set(cohort, current);
  }

  return Array.from(cohorts.entries())
    .map(([cohort, data]) => ({
      cohort,
      totalCustomers: data.total,
      activeCustomers: data.active,
      retentionRate: data.total > 0 ? (data.active / data.total) * 100 : 0,
      totalRevenue: data.revenue,
      avgRevenuePerCustomer: data.total > 0 ? data.revenue / data.total : 0,
    }))
    .sort((a, b) => a.cohort.localeCompare(b.cohort));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHURN ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get customers at risk of churning
 */
export async function getChurnRiskCustomers(
  organizationId: string,
  limit: number = 20
): Promise<ChurnRiskCustomer[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const customers = await db.customer.findMany({
    where: {
      organizationId,
      jobs: {
        some: {
          completedAt: { not: null },
        },
      },
    },
    include: {
      jobs: {
        select: {
          completedAt: true,
          invoice: { select: { total: true } },
        },
      },
    },
  });

  const atRiskCustomers: ChurnRiskCustomer[] = [];

  for (const customer of customers) {
    const completedJobs = customer.jobs.filter((j) => j.completedAt);
    const lastJobAt = completedJobs
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0]
      ?.completedAt || null;

    if (!lastJobAt) continue;

    const daysSinceLastJob = Math.ceil(
      (now.getTime() - lastJobAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Only consider customers who haven't had a job in 30+ days
    if (daysSinceLastJob < 30) continue;

    const totalRevenue = completedJobs.reduce(
      (sum, j) => sum + (j.invoice?.total?.toNumber() || 0),
      0
    );

    // Calculate risk score (0-100)
    // Higher score = higher risk
    let riskScore = 0;

    // Days since last job (max 50 points)
    riskScore += Math.min(daysSinceLastJob / 90 * 50, 50);

    // Low job count (max 30 points)
    if (completedJobs.length < 3) {
      riskScore += 30 - (completedJobs.length * 10);
    }

    // Low revenue (max 20 points)
    const avgRevenue = totalRevenue / Math.max(completedJobs.length, 1);
    if (avgRevenue < 10000) {
      riskScore += 20 - (avgRevenue / 10000 * 20);
    }

    atRiskCustomers.push({
      customerId: customer.id,
      name: customer.name,
      lastJobDate: lastJobAt,
      daysSinceLastJob,
      totalJobs: completedJobs.length,
      totalRevenue,
      riskScore: Math.min(riskScore, 100),
    });
  }

  return atRiskCustomers
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, limit);
}

/**
 * Get top customers by CLV
 */
export async function getTopCustomersByCLV(
  organizationId: string,
  limit: number = 10
): Promise<{
  customerId: string;
  name: string;
  clv: number;
  totalJobs: number;
  avgJobValue: number;
  customerSince: Date;
}[]> {
  const customers = await db.customer.findMany({
    where: { organizationId },
    include: {
      jobs: {
        select: {
          invoice: { select: { total: true } },
          completedAt: true,
        },
      },
    },
  });

  const customerCLVs = customers.map((customer) => {
    const completedJobs = customer.jobs.filter((j) => j.completedAt);
    const totalRevenue = completedJobs.reduce(
      (sum, j) => sum + (j.invoice?.total?.toNumber() || 0),
      0
    );

    return {
      customerId: customer.id,
      name: customer.name,
      clv: totalRevenue,
      totalJobs: completedJobs.length,
      avgJobValue: completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0,
      customerSince: customer.createdAt,
    };
  });

  return customerCLVs
    .sort((a, b) => b.clv - a.clv)
    .slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate customer KPIs for dashboard
 */
export async function generateCustomerKPIs(
  organizationId: string,
  dateRange: DateRange
): Promise<KPIResult[]> {
  const metrics = await calculateCustomerMetrics(organizationId, dateRange);

  // Get previous period for comparison
  const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
  const prevMetrics = await calculateCustomerMetrics(organizationId, {
    start: new Date(dateRange.start.getTime() - periodLength),
    end: new Date(dateRange.start.getTime() - 1),
  });

  const customerGrowth = prevMetrics.totalCustomers > 0
    ? ((metrics.totalCustomers - prevMetrics.totalCustomers) / prevMetrics.totalCustomers) * 100
    : 0;

  const clvGrowth = prevMetrics.avgLifetimeValue > 0
    ? ((metrics.avgLifetimeValue - prevMetrics.avgLifetimeValue) / prevMetrics.avgLifetimeValue) * 100
    : 0;

  return [
    {
      id: 'total_customers',
      name: 'Total Clientes',
      value: metrics.totalCustomers,
      unit: 'number',
      trend: customerGrowth > 0 ? 'up' : customerGrowth < 0 ? 'down' : 'stable',
      changePercent: customerGrowth,
      period: dateRange,
    },
    {
      id: 'active_customers',
      name: 'Clientes Activos',
      value: metrics.activeCustomers,
      unit: 'number',
      trend: 'stable',
      period: dateRange,
    },
    {
      id: 'new_customers',
      name: 'Clientes Nuevos',
      value: metrics.newCustomers,
      unit: 'number',
      trend: metrics.newCustomers > 0 ? 'up' : 'stable',
      period: dateRange,
    },
    {
      id: 'churn_rate',
      name: 'Tasa de Churn',
      value: metrics.churnRate,
      unit: 'percentage',
      trend: metrics.churnRate <= 5 ? 'up' : metrics.churnRate <= 10 ? 'stable' : 'down',
      period: dateRange,
    },
    {
      id: 'retention_rate',
      name: 'Tasa de Retención',
      value: metrics.retentionRate,
      unit: 'percentage',
      trend: metrics.retentionRate >= 90 ? 'up' : metrics.retentionRate >= 80 ? 'stable' : 'down',
      period: dateRange,
    },
    {
      id: 'avg_clv',
      name: 'CLV Promedio',
      value: metrics.avgLifetimeValue,
      unit: 'currency',
      trend: clvGrowth > 0 ? 'up' : clvGrowth < 0 ? 'down' : 'stable',
      changePercent: clvGrowth,
      period: dateRange,
    },
  ];
}
