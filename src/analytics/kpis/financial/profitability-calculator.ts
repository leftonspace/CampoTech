/**
 * Profitability Calculator
 * ========================
 *
 * Phase 10.2: Business Intelligence KPIs
 * Margin, profit, and profitability analysis.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { DateRange, TimeGranularity } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProfitabilityMetrics {
  revenue: number;
  costs: number;
  grossProfit: number;
  grossMargin: number;
  netProfit: number;
  netMargin: number;
  operatingExpenses: number;
  profitPerJob: number;
  revenuePerHour: number;
  costPerJob: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ProfitabilityByServiceType {
  serviceType: string;
  displayName: string;
  revenue: number;
  estimatedCosts: number;
  grossProfit: number;
  grossMargin: number;
  jobCount: number;
  profitPerJob: number;
  averageJobValue: number;
}

export interface ProfitabilityByTechnician {
  technicianId: string;
  technicianName: string;
  revenue: number;
  jobCount: number;
  hoursWorked: number;
  revenuePerHour: number;
  averageJobValue: number;
  efficiency: number; // Jobs per day
}

export interface ProfitabilityByCustomer {
  customerId: string;
  customerName: string;
  revenue: number;
  jobCount: number;
  averageJobValue: number;
  profitability: 'high' | 'medium' | 'low';
  lifetimeValue: number;
}

export interface ProfitabilityTrend {
  period: string;
  revenue: number;
  costs: number;
  grossProfit: number;
  grossMargin: number;
  jobCount: number;
}

export interface CostBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFITABILITY CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate comprehensive profitability metrics
 * Note: Without detailed cost tracking, we estimate costs based on industry averages
 */
export async function calculateProfitability(
  organizationId: string,
  dateRange: DateRange
): Promise<ProfitabilityMetrics> {
  // Get revenue from paid invoices
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      status: { in: ['paid', 'partial'] },
    },
    select: {
      total: true,
      taxAmount: true,
    },
  });

  // Get job data for labor cost estimation
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      completedAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      id: true,
      actualStart: true,
      completedAt: true,
      actualTotal: true,
    },
  });

  const revenue = invoices.reduce((sum, inv) => sum + (inv.total?.toNumber() || 0), 0);
  const taxAmount = invoices.reduce((sum, inv) => sum + (inv.taxAmount?.toNumber() || 0), 0);
  const revenueBeforeTax = revenue - taxAmount;

  // Calculate total hours worked
  let totalHours = 0;
  for (const job of jobs) {
    if (job.actualStart && job.completedAt) {
      const hours = (job.completedAt.getTime() - job.actualStart.getTime()) / (1000 * 60 * 60);
      totalHours += hours;
    }
  }

  // Estimate costs (without actual cost tracking, use industry averages)
  // Typical field service COGS is 40-60% of revenue
  const estimatedCOGSRate = 0.45; // 45% of revenue
  const estimatedOpexRate = 0.25; // 25% of revenue for operating expenses

  const costs = revenueBeforeTax * estimatedCOGSRate;
  const operatingExpenses = revenueBeforeTax * estimatedOpexRate;
  const grossProfit = revenueBeforeTax - costs;
  const netProfit = grossProfit - operatingExpenses;

  const grossMargin = revenueBeforeTax > 0 ? (grossProfit / revenueBeforeTax) * 100 : 0;
  const netMargin = revenueBeforeTax > 0 ? (netProfit / revenueBeforeTax) * 100 : 0;

  const profitPerJob = jobs.length > 0 ? grossProfit / jobs.length : 0;
  const revenuePerHour = totalHours > 0 ? revenueBeforeTax / totalHours : 0;
  const costPerJob = jobs.length > 0 ? costs / jobs.length : 0;

  // Calculate change from previous period
  const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
  const prevRange = {
    start: new Date(dateRange.start.getTime() - periodLength),
    end: new Date(dateRange.start.getTime() - 1),
  };

  const prevMetrics = await calculatePreviousPeriodProfitability(organizationId, prevRange);
  const changePercent = prevMetrics.grossProfit > 0
    ? ((grossProfit - prevMetrics.grossProfit) / prevMetrics.grossProfit) * 100
    : 0;

  const trend: 'up' | 'down' | 'stable' =
    changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable';

  return {
    revenue: revenueBeforeTax,
    costs,
    grossProfit,
    grossMargin,
    netProfit,
    netMargin,
    operatingExpenses,
    profitPerJob,
    revenuePerHour,
    costPerJob,
    changePercent,
    trend,
  };
}

/**
 * Calculate profitability for previous period
 */
async function calculatePreviousPeriodProfitability(
  organizationId: string,
  dateRange: DateRange
): Promise<{ grossProfit: number }> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      status: { in: ['paid', 'partial'] },
    },
    select: {
      total: true,
      taxAmount: true,
    },
  });

  const revenue = invoices.reduce((sum, inv) => sum + (inv.total?.toNumber() || 0), 0);
  const taxAmount = invoices.reduce((sum, inv) => sum + (inv.taxAmount?.toNumber() || 0), 0);
  const revenueBeforeTax = revenue - taxAmount;

  const estimatedCOGSRate = 0.45;
  const grossProfit = revenueBeforeTax * (1 - estimatedCOGSRate);

  return { grossProfit };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFITABILITY BY SERVICE TYPE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate profitability by service type
 */
export async function getProfitabilityByServiceType(
  organizationId: string,
  dateRange: DateRange
): Promise<ProfitabilityByServiceType[]> {
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
      actualStart: true,
      completedAt: true,
    },
  });

  const serviceData = new Map<string, {
    revenue: number;
    jobCount: number;
    totalHours: number;
  }>();

  for (const job of jobs) {
    const serviceType = job.serviceType || 'other';
    const current = serviceData.get(serviceType) || {
      revenue: 0,
      jobCount: 0,
      totalHours: 0,
    };

    current.revenue += job.actualTotal?.toNumber() || 0;
    current.jobCount++;

    if (job.actualStart && job.completedAt) {
      current.totalHours +=
        (job.completedAt.getTime() - job.actualStart.getTime()) / (1000 * 60 * 60);
    }

    serviceData.set(serviceType, current);
  }

  // Service-specific cost rates (estimated)
  const serviceCostRates: Record<string, number> = {
    installation: 0.50, // Higher material costs
    repair: 0.40,
    maintenance: 0.35, // Lower costs
    inspection: 0.30,
    emergency: 0.45, // Premium labor costs
    other: 0.45,
  };

  const serviceNames: Record<string, string> = {
    installation: 'Instalación',
    repair: 'Reparación',
    maintenance: 'Mantenimiento',
    inspection: 'Inspección',
    emergency: 'Emergencia',
    other: 'Otro',
  };

  const results: ProfitabilityByServiceType[] = [];

  for (const [serviceType, data] of serviceData) {
    const costRate = serviceCostRates[serviceType] || 0.45;
    const estimatedCosts = data.revenue * costRate;
    const grossProfit = data.revenue - estimatedCosts;
    const grossMargin = data.revenue > 0 ? (grossProfit / data.revenue) * 100 : 0;

    results.push({
      serviceType,
      displayName: serviceNames[serviceType] || serviceType,
      revenue: data.revenue,
      estimatedCosts,
      grossProfit,
      grossMargin,
      jobCount: data.jobCount,
      profitPerJob: data.jobCount > 0 ? grossProfit / data.jobCount : 0,
      averageJobValue: data.jobCount > 0 ? data.revenue / data.jobCount : 0,
    });
  }

  return results.sort((a, b) => b.grossProfit - a.grossProfit);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFITABILITY BY TECHNICIAN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate profitability by technician
 */
export async function getProfitabilityByTechnician(
  organizationId: string,
  dateRange: DateRange
): Promise<ProfitabilityByTechnician[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      completedAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      assignedToId: { not: null },
    },
    include: {
      assignedTo: {
        select: { id: true, name: true },
      },
    },
  });

  const techData = new Map<string, {
    name: string;
    revenue: number;
    jobCount: number;
    totalHours: number;
    workDays: Set<string>;
  }>();

  for (const job of jobs) {
    if (!job.assignedTo) continue;

    const current = techData.get(job.assignedTo.id) || {
      name: job.assignedTo.name,
      revenue: 0,
      jobCount: 0,
      totalHours: 0,
      workDays: new Set(),
    };

    current.revenue += job.actualTotal?.toNumber() || 0;
    current.jobCount++;

    if (job.actualStart && job.completedAt) {
      const hours =
        (job.completedAt.getTime() - job.actualStart.getTime()) / (1000 * 60 * 60);
      current.totalHours += hours;
      current.workDays.add(job.completedAt.toISOString().slice(0, 10));
    }

    techData.set(job.assignedTo.id, current);
  }

  const results: ProfitabilityByTechnician[] = [];

  for (const [techId, data] of techData) {
    const workDays = data.workDays.size || 1;
    const efficiency = data.jobCount / workDays;

    results.push({
      technicianId: techId,
      technicianName: data.name,
      revenue: data.revenue,
      jobCount: data.jobCount,
      hoursWorked: data.totalHours,
      revenuePerHour: data.totalHours > 0 ? data.revenue / data.totalHours : 0,
      averageJobValue: data.jobCount > 0 ? data.revenue / data.jobCount : 0,
      efficiency,
    });
  }

  return results.sort((a, b) => b.revenue - a.revenue);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFITABILITY BY CUSTOMER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get top customers by profitability
 */
export async function getProfitabilityByCustomer(
  organizationId: string,
  dateRange: DateRange,
  limit: number = 20
): Promise<ProfitabilityByCustomer[]> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      status: { in: ['paid', 'partial'] },
    },
    include: {
      customer: {
        select: { id: true, name: true },
      },
    },
  });

  // Get lifetime revenue for all customers
  const lifetimeData = await db.invoice.groupBy({
    by: ['customerId'],
    where: {
      organizationId,
      status: { in: ['paid', 'partial'] },
    },
    _sum: {
      total: true,
    },
    _count: {
      id: true,
    },
  });

  const lifetimeMap = new Map<string, { revenue: number; jobs: number }>();
  for (const item of lifetimeData) {
    if (item.customerId) {
      lifetimeMap.set(item.customerId, {
        revenue: item._sum.total?.toNumber() || 0,
        jobs: item._count.id,
      });
    }
  }

  // Calculate period revenue by customer
  const customerData = new Map<string, {
    name: string;
    revenue: number;
    jobCount: number;
  }>();

  for (const invoice of invoices) {
    if (!invoice.customer) continue;

    const current = customerData.get(invoice.customer.id) || {
      name: invoice.customer.name,
      revenue: 0,
      jobCount: 0,
    };

    current.revenue += invoice.total?.toNumber() || 0;
    current.jobCount++;
    customerData.set(invoice.customer.id, current);
  }

  // Calculate average revenue to determine profitability tiers
  const revenues = Array.from(customerData.values()).map((c) => c.revenue);
  const avgRevenue = revenues.length > 0
    ? revenues.reduce((sum, r) => sum + r, 0) / revenues.length
    : 0;

  const results: ProfitabilityByCustomer[] = [];

  for (const [customerId, data] of customerData) {
    const lifetime = lifetimeMap.get(customerId) || { revenue: data.revenue, jobs: data.jobCount };

    let profitability: 'high' | 'medium' | 'low';
    if (data.revenue >= avgRevenue * 1.5) {
      profitability = 'high';
    } else if (data.revenue >= avgRevenue * 0.5) {
      profitability = 'medium';
    } else {
      profitability = 'low';
    }

    results.push({
      customerId,
      customerName: data.name,
      revenue: data.revenue,
      jobCount: data.jobCount,
      averageJobValue: data.jobCount > 0 ? data.revenue / data.jobCount : 0,
      profitability,
      lifetimeValue: lifetime.revenue,
    });
  }

  return results.sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFITABILITY TRENDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get profitability trend over time
 */
export async function getProfitabilityTrend(
  organizationId: string,
  dateRange: DateRange,
  granularity: TimeGranularity = 'month'
): Promise<ProfitabilityTrend[]> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      status: { in: ['paid', 'partial'] },
    },
    select: {
      total: true,
      taxAmount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const jobs = await db.job.findMany({
    where: {
      organizationId,
      completedAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      completedAt: true,
    },
  });

  // Group invoices by period
  const periodRevenue = new Map<string, number>();
  for (const invoice of invoices) {
    const period = formatPeriod(invoice.createdAt, granularity);
    const current = periodRevenue.get(period) || 0;
    const revenueNet = (invoice.total?.toNumber() || 0) - (invoice.taxAmount?.toNumber() || 0);
    periodRevenue.set(period, current + revenueNet);
  }

  // Group jobs by period
  const periodJobs = new Map<string, number>();
  for (const job of jobs) {
    if (job.completedAt) {
      const period = formatPeriod(job.completedAt, granularity);
      const current = periodJobs.get(period) || 0;
      periodJobs.set(period, current + 1);
    }
  }

  // Generate trend data
  const allPeriods = new Set([...periodRevenue.keys(), ...periodJobs.keys()]);
  const sortedPeriods = Array.from(allPeriods).sort();

  const estimatedCOGSRate = 0.45;

  return sortedPeriods.map((period) => {
    const revenue = periodRevenue.get(period) || 0;
    const costs = revenue * estimatedCOGSRate;
    const grossProfit = revenue - costs;

    return {
      period,
      revenue,
      costs,
      grossProfit,
      grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      jobCount: periodJobs.get(period) || 0,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COST BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get estimated cost breakdown
 * Note: Without actual expense tracking, this provides industry-standard estimates
 */
export async function getCostBreakdown(
  organizationId: string,
  dateRange: DateRange
): Promise<CostBreakdown[]> {
  const metrics = await calculateProfitability(organizationId, dateRange);
  const totalCosts = metrics.costs + metrics.operatingExpenses;

  if (totalCosts === 0) {
    return [];
  }

  // Industry-standard breakdown for field service companies
  const breakdown: CostBreakdown[] = [
    {
      category: 'Mano de Obra',
      amount: totalCosts * 0.45,
      percentage: 45,
    },
    {
      category: 'Materiales',
      amount: totalCosts * 0.25,
      percentage: 25,
    },
    {
      category: 'Transporte',
      amount: totalCosts * 0.10,
      percentage: 10,
    },
    {
      category: 'Administración',
      amount: totalCosts * 0.12,
      percentage: 12,
    },
    {
      category: 'Otros',
      amount: totalCosts * 0.08,
      percentage: 8,
    },
  ];

  return breakdown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate profitability KPIs for dashboard
 */
export async function generateProfitabilityKPIs(
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
  status?: 'good' | 'warning' | 'critical';
}>> {
  const metrics = await calculateProfitability(organizationId, dateRange);

  // Determine status based on margins
  const getMarginStatus = (margin: number): 'good' | 'warning' | 'critical' => {
    if (margin >= 50) return 'good';
    if (margin >= 30) return 'warning';
    return 'critical';
  };

  return [
    {
      id: 'gross_profit',
      name: 'Ganancia Bruta',
      value: metrics.grossProfit,
      unit: 'currency',
      trend: metrics.trend,
      changePercent: metrics.changePercent,
      description: 'Ingresos menos costos directos',
    },
    {
      id: 'gross_margin',
      name: 'Margen Bruto',
      value: metrics.grossMargin,
      unit: 'percentage',
      trend: metrics.trend,
      description: 'Porcentaje de ganancia sobre ingresos',
      status: getMarginStatus(metrics.grossMargin),
    },
    {
      id: 'net_profit',
      name: 'Ganancia Neta',
      value: metrics.netProfit,
      unit: 'currency',
      trend: metrics.trend,
      description: 'Ganancia después de gastos operativos',
    },
    {
      id: 'net_margin',
      name: 'Margen Neto',
      value: metrics.netMargin,
      unit: 'percentage',
      trend: metrics.trend,
      description: 'Porcentaje de ganancia neta',
      status: getMarginStatus(metrics.netMargin),
    },
    {
      id: 'profit_per_job',
      name: 'Ganancia por Trabajo',
      value: metrics.profitPerJob,
      unit: 'currency',
      trend: 'stable',
      description: 'Ganancia bruta promedio por trabajo',
    },
    {
      id: 'revenue_per_hour',
      name: 'Ingreso por Hora',
      value: metrics.revenuePerHour,
      unit: 'currency',
      trend: 'stable',
      description: 'Ingresos generados por hora trabajada',
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
