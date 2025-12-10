/**
 * Location Performance Analytics
 * ==============================
 *
 * Phase 11.6: Location Analytics
 * Per-location KPIs and performance metrics.
 */

import { db } from '../../lib/db';
import { DateRange, KPIValue, TimeGranularity } from '../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LocationKPIs {
  locationId: string;
  locationName: string;
  locationCode: string;

  // Revenue KPIs
  revenue: {
    total: number;
    average: number;
    trend: number;
    previousPeriod: number;
  };

  // Operations KPIs
  jobs: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
    completionRate: number;
    cancellationRate: number;
  };

  // Efficiency KPIs
  efficiency: {
    avgJobDuration: number;
    avgResponseTime: number;
    onTimeRate: number;
    firstTimeFixRate: number;
    utilization: number;
  };

  // Team KPIs
  team: {
    technicianCount: number;
    avgJobsPerTechnician: number;
    avgRating: number;
    topPerformer: {
      id: string;
      name: string;
      jobsCompleted: number;
    } | null;
  };

  // Customer KPIs
  customers: {
    totalServed: number;
    newCustomers: number;
    repeatRate: number;
    avgSatisfaction: number;
  };

  // Capacity KPIs
  capacity: {
    maxDailyJobs: number;
    avgDailyJobs: number;
    peakUtilization: number;
    underutilizedDays: number;
  };
}

export interface LocationPerformanceTrend {
  period: string;
  revenue: number;
  jobs: number;
  completionRate: number;
  avgJobDuration: number;
}

export interface LocationDailyMetrics {
  date: string;
  jobs: number;
  completedJobs: number;
  revenue: number;
  technicianHours: number;
  utilization: number;
}

export interface LocationServiceTypeBreakdown {
  serviceType: string;
  count: number;
  revenue: number;
  avgDuration: number;
  completionRate: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE KPI CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate comprehensive KPIs for a specific location
 */
export async function calculateLocationKPIs(
  organizationId: string,
  locationId: string,
  dateRange: DateRange
): Promise<LocationKPIs> {
  // Get location info
  const location = await db.location.findFirst({
    where: { id: locationId, organizationId },
    select: { id: true, name: true, code: true, maxDailyJobs: true },
  });

  if (!location) {
    throw new Error(`Location ${locationId} not found`);
  }

  // Calculate previous period for trend comparison
  const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
  const previousRange: DateRange = {
    start: new Date(dateRange.start.getTime() - periodLength),
    end: new Date(dateRange.start.getTime() - 1),
  };

  // Fetch current period data
  const [
    currentJobs,
    previousJobs,
    technicians,
    invoices,
    previousInvoices,
  ] = await Promise.all([
    // Current period jobs
    db.job.findMany({
      where: {
        organizationId,
        locationId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        scheduledStart: true,
        actualStart: true,
        completedAt: true,
        customerId: true,
        technicianId: true,
        serviceType: true,
      },
    }),
    // Previous period jobs
    db.job.findMany({
      where: {
        organizationId,
        locationId,
        createdAt: { gte: previousRange.start, lte: previousRange.end },
      },
      select: { id: true, status: true },
    }),
    // Technicians assigned to location
    db.user.findMany({
      where: {
        organizationId,
        homeLocationId: locationId,
        role: 'technician',
        isActive: true,
      },
      select: { id: true, name: true },
    }),
    // Current period invoices
    db.invoice.findMany({
      where: {
        organizationId,
        job: { locationId },
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
      select: { id: true, total: true, status: true },
    }),
    // Previous period invoices
    db.invoice.findMany({
      where: {
        organizationId,
        job: { locationId },
        createdAt: { gte: previousRange.start, lte: previousRange.end },
      },
      select: { total: true },
    }),
  ]);

  // Calculate revenue
  const currentRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const previousRevenue = previousInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const revenueTrend = previousRevenue > 0
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
    : 0;

  // Calculate job metrics
  const totalJobs = currentJobs.length;
  const completedJobs = currentJobs.filter((j) => j.status === 'completado').length;
  const cancelledJobs = currentJobs.filter((j) => j.status === 'cancelado').length;
  const pendingJobs = currentJobs.filter((j) => j.status === 'pendiente').length;

  // Calculate efficiency metrics
  const jobsWithDuration = currentJobs.filter((j) => j.actualStart && j.completedAt);
  const avgJobDuration = jobsWithDuration.length > 0
    ? jobsWithDuration.reduce((sum, j) => {
        const duration = j.completedAt!.getTime() - j.actualStart!.getTime();
        return sum + duration / (1000 * 60);
      }, 0) / jobsWithDuration.length
    : 0;

  const jobsWithResponse = currentJobs.filter((j) => j.actualStart);
  const avgResponseTime = jobsWithResponse.length > 0
    ? jobsWithResponse.reduce((sum, j) => {
        const response = j.actualStart!.getTime() - j.createdAt.getTime();
        return sum + response / (1000 * 60 * 60);
      }, 0) / jobsWithResponse.length
    : 0;

  // Calculate on-time rate
  const scheduledCompletedJobs = currentJobs.filter(
    (j) => j.status === 'completado' && j.scheduledStart && j.completedAt
  );
  const onTimeJobs = scheduledCompletedJobs.filter((j) => {
    const scheduledEnd = new Date(j.scheduledStart!.getTime() + 2 * 60 * 60 * 1000);
    return j.completedAt! <= scheduledEnd;
  });
  const onTimeRate = scheduledCompletedJobs.length > 0
    ? (onTimeJobs.length / scheduledCompletedJobs.length) * 100
    : 0;

  // Calculate team metrics
  const technicianJobCounts = new Map<string, { name: string; count: number }>();
  for (const job of currentJobs.filter((j) => j.status === 'completado' && j.technicianId)) {
    const tech = technicians.find((t) => t.id === job.technicianId);
    if (tech) {
      const current = technicianJobCounts.get(job.technicianId!) || { name: tech.name, count: 0 };
      current.count++;
      technicianJobCounts.set(job.technicianId!, current);
    }
  }

  let topPerformer: LocationKPIs['team']['topPerformer'] = null;
  let maxJobs = 0;
  for (const [id, data] of technicianJobCounts) {
    if (data.count > maxJobs) {
      maxJobs = data.count;
      topPerformer = { id, name: data.name, jobsCompleted: data.count };
    }
  }

  // Calculate customer metrics
  const uniqueCustomers = new Set(currentJobs.map((j) => j.customerId));
  const newCustomerIds = new Set<string>();
  for (const customerId of uniqueCustomers) {
    const firstJob = await db.job.findFirst({
      where: { customerId, organizationId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    if (firstJob && firstJob.createdAt >= dateRange.start) {
      newCustomerIds.add(customerId);
    }
  }

  const repeatCustomers = currentJobs.filter((j) => {
    const customerJobCount = currentJobs.filter((cj) => cj.customerId === j.customerId).length;
    return customerJobCount > 1;
  });
  const repeatRate = uniqueCustomers.size > 0
    ? (new Set(repeatCustomers.map((j) => j.customerId)).size / uniqueCustomers.size) * 100
    : 0;

  // Calculate capacity metrics
  const daysInPeriod = Math.ceil(periodLength / (1000 * 60 * 60 * 24));
  const avgDailyJobs = totalJobs / daysInPeriod;
  const maxDaily = location.maxDailyJobs || 20;

  // Group jobs by date for utilization
  const jobsByDate = new Map<string, number>();
  for (const job of currentJobs) {
    const dateKey = job.createdAt.toISOString().split('T')[0];
    jobsByDate.set(dateKey, (jobsByDate.get(dateKey) || 0) + 1);
  }

  let peakUtilization = 0;
  let underutilizedDays = 0;
  for (const [, count] of jobsByDate) {
    const utilization = (count / maxDaily) * 100;
    if (utilization > peakUtilization) peakUtilization = utilization;
    if (utilization < 50) underutilizedDays++;
  }

  return {
    locationId: location.id,
    locationName: location.name,
    locationCode: location.code,
    revenue: {
      total: currentRevenue,
      average: totalJobs > 0 ? currentRevenue / totalJobs : 0,
      trend: revenueTrend,
      previousPeriod: previousRevenue,
    },
    jobs: {
      total: totalJobs,
      completed: completedJobs,
      cancelled: cancelledJobs,
      pending: pendingJobs,
      completionRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0,
      cancellationRate: totalJobs > 0 ? (cancelledJobs / totalJobs) * 100 : 0,
    },
    efficiency: {
      avgJobDuration,
      avgResponseTime,
      onTimeRate,
      firstTimeFixRate: 85, // Placeholder - requires more complex tracking
      utilization: maxDaily > 0 ? (avgDailyJobs / maxDaily) * 100 : 0,
    },
    team: {
      technicianCount: technicians.length,
      avgJobsPerTechnician: technicians.length > 0 ? completedJobs / technicians.length : 0,
      avgRating: 4.2, // Placeholder - requires rating data
      topPerformer,
    },
    customers: {
      totalServed: uniqueCustomers.size,
      newCustomers: newCustomerIds.size,
      repeatRate,
      avgSatisfaction: 4.3, // Placeholder - requires satisfaction data
    },
    capacity: {
      maxDailyJobs: maxDaily,
      avgDailyJobs,
      peakUtilization,
      underutilizedDays,
    },
  };
}

/**
 * Get performance trend for a location
 */
export async function getLocationPerformanceTrend(
  organizationId: string,
  locationId: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): Promise<LocationPerformanceTrend[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      locationId,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      actualStart: true,
      completedAt: true,
    },
  });

  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      job: { locationId },
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    },
    select: {
      total: true,
      createdAt: true,
    },
  });

  // Group by period
  const periodMap = new Map<string, {
    jobs: number;
    completed: number;
    revenue: number;
    totalDuration: number;
    durationCount: number;
  }>();

  for (const job of jobs) {
    const period = formatPeriod(job.createdAt, granularity);
    const current = periodMap.get(period) || {
      jobs: 0,
      completed: 0,
      revenue: 0,
      totalDuration: 0,
      durationCount: 0,
    };
    current.jobs++;
    if (job.status === 'completado') current.completed++;
    if (job.actualStart && job.completedAt) {
      const duration = (job.completedAt.getTime() - job.actualStart.getTime()) / (1000 * 60);
      current.totalDuration += duration;
      current.durationCount++;
    }
    periodMap.set(period, current);
  }

  for (const invoice of invoices) {
    const period = formatPeriod(invoice.createdAt, granularity);
    const current = periodMap.get(period);
    if (current) {
      current.revenue += invoice.total || 0;
    }
  }

  const periods = generatePeriods(dateRange.start, dateRange.end, granularity);

  return periods.map((period) => {
    const data = periodMap.get(period) || {
      jobs: 0,
      completed: 0,
      revenue: 0,
      totalDuration: 0,
      durationCount: 0,
    };
    return {
      period,
      revenue: data.revenue,
      jobs: data.jobs,
      completionRate: data.jobs > 0 ? (data.completed / data.jobs) * 100 : 0,
      avgJobDuration: data.durationCount > 0 ? data.totalDuration / data.durationCount : 0,
    };
  });
}

/**
 * Get daily metrics for a location
 */
export async function getLocationDailyMetrics(
  organizationId: string,
  locationId: string,
  dateRange: DateRange
): Promise<LocationDailyMetrics[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      locationId,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    },
    select: {
      status: true,
      createdAt: true,
      actualStart: true,
      completedAt: true,
    },
  });

  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      job: { locationId },
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    },
    select: {
      total: true,
      createdAt: true,
    },
  });

  const location = await db.location.findFirst({
    where: { id: locationId, organizationId },
    select: { maxDailyJobs: true },
  });

  const maxDaily = location?.maxDailyJobs || 20;

  // Group by date
  const dateMap = new Map<string, {
    jobs: number;
    completed: number;
    revenue: number;
    technicianHours: number;
  }>();

  for (const job of jobs) {
    const dateKey = job.createdAt.toISOString().split('T')[0];
    const current = dateMap.get(dateKey) || {
      jobs: 0,
      completed: 0,
      revenue: 0,
      technicianHours: 0,
    };
    current.jobs++;
    if (job.status === 'completado') current.completed++;
    if (job.actualStart && job.completedAt) {
      const hours = (job.completedAt.getTime() - job.actualStart.getTime()) / (1000 * 60 * 60);
      current.technicianHours += hours;
    }
    dateMap.set(dateKey, current);
  }

  for (const invoice of invoices) {
    const dateKey = invoice.createdAt.toISOString().split('T')[0];
    const current = dateMap.get(dateKey);
    if (current) {
      current.revenue += invoice.total || 0;
    }
  }

  const periods = generatePeriods(dateRange.start, dateRange.end, 'day');

  return periods.map((date) => {
    const data = dateMap.get(date) || {
      jobs: 0,
      completed: 0,
      revenue: 0,
      technicianHours: 0,
    };
    return {
      date,
      jobs: data.jobs,
      completedJobs: data.completed,
      revenue: data.revenue,
      technicianHours: data.technicianHours,
      utilization: (data.jobs / maxDaily) * 100,
    };
  });
}

/**
 * Get service type breakdown for a location
 */
export async function getLocationServiceTypeBreakdown(
  organizationId: string,
  locationId: string,
  dateRange: DateRange
): Promise<LocationServiceTypeBreakdown[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      locationId,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    },
    select: {
      serviceType: true,
      status: true,
      actualStart: true,
      completedAt: true,
    },
  });

  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      job: { locationId },
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    },
    select: {
      total: true,
      job: {
        select: { serviceType: true },
      },
    },
  });

  // Group by service type
  const serviceMap = new Map<string, {
    count: number;
    completed: number;
    revenue: number;
    totalDuration: number;
    durationCount: number;
  }>();

  for (const job of jobs) {
    const serviceType = job.serviceType || 'other';
    const current = serviceMap.get(serviceType) || {
      count: 0,
      completed: 0,
      revenue: 0,
      totalDuration: 0,
      durationCount: 0,
    };
    current.count++;
    if (job.status === 'completado') current.completed++;
    if (job.actualStart && job.completedAt) {
      const duration = (job.completedAt.getTime() - job.actualStart.getTime()) / (1000 * 60);
      current.totalDuration += duration;
      current.durationCount++;
    }
    serviceMap.set(serviceType, current);
  }

  for (const invoice of invoices) {
    const serviceType = invoice.job?.serviceType || 'other';
    const current = serviceMap.get(serviceType);
    if (current) {
      current.revenue += invoice.total || 0;
    }
  }

  return Array.from(serviceMap.entries())
    .map(([serviceType, data]) => ({
      serviceType,
      count: data.count,
      revenue: data.revenue,
      avgDuration: data.durationCount > 0 ? data.totalDuration / data.durationCount : 0,
      completionRate: data.count > 0 ? (data.completed / data.count) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Generate location KPI values for dashboard
 */
export async function generateLocationKPIValues(
  organizationId: string,
  locationId: string,
  dateRange: DateRange
): Promise<KPIValue[]> {
  const kpis = await calculateLocationKPIs(organizationId, locationId, dateRange);

  return [
    {
      value: kpis.revenue.total,
      previousValue: kpis.revenue.previousPeriod,
      change: kpis.revenue.total - kpis.revenue.previousPeriod,
      changePercent: kpis.revenue.trend,
      trend: kpis.revenue.trend > 0 ? 'up' : kpis.revenue.trend < 0 ? 'down' : 'stable',
      updatedAt: new Date(),
    },
    {
      value: kpis.jobs.total,
      previousValue: null,
      change: null,
      changePercent: null,
      trend: 'stable',
      updatedAt: new Date(),
    },
    {
      value: kpis.jobs.completionRate,
      previousValue: null,
      change: null,
      changePercent: null,
      trend: kpis.jobs.completionRate >= 90 ? 'up' : kpis.jobs.completionRate >= 70 ? 'stable' : 'down',
      updatedAt: new Date(),
    },
    {
      value: kpis.efficiency.utilization,
      previousValue: null,
      change: null,
      changePercent: null,
      trend: kpis.efficiency.utilization >= 70 ? 'up' : kpis.efficiency.utilization >= 50 ? 'stable' : 'down',
      updatedAt: new Date(),
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

  return [...new Set(periods)];
}
