/**
 * Job Metrics Calculator
 * ======================
 *
 * Phase 10.2: Business Intelligence KPIs
 * Operational metrics for job management.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { DateRange, KPIResult, TimeGranularity } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface JobMetrics {
  totalJobs: number;
  completedJobs: number;
  cancelledJobs: number;
  pendingJobs: number;
  inProgressJobs: number;
  completionRate: number;
  cancellationRate: number;
  averageDuration: number;
  averageResponseTime: number;
  onTimeCompletionRate: number;
}

export interface JobTrend {
  period: string;
  total: number;
  completed: number;
  cancelled: number;
  completionRate: number;
}

export interface JobsByServiceType {
  serviceType: string;
  count: number;
  percentage: number;
  averageDuration: number;
  completionRate: number;
}

export interface JobsByStatus {
  status: string;
  count: number;
  percentage: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE METRICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate comprehensive job metrics
 */
export async function calculateJobMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<JobMetrics> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      scheduledDate: true,
      startedAt: true,
      completedAt: true,
    },
  });

  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED').length;
  const cancelledJobs = jobs.filter((j) => j.status === 'CANCELLED').length;
  const pendingJobs = jobs.filter((j) => j.status === 'pendiente').length;
  const inProgressJobs = jobs.filter((j) => j.status === 'en_progreso').length;

  // Calculate completion rate
  const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;
  const cancellationRate = totalJobs > 0 ? (cancelledJobs / totalJobs) * 100 : 0;

  // Calculate average duration (for completed jobs)
  const jobsWithDuration = jobs.filter((j) => j.startedAt && j.completedAt);
  const totalDuration = jobsWithDuration.reduce((sum, j) => {
    const duration = j.completedAt!.getTime() - j.startedAt!.getTime();
    return sum + duration;
  }, 0);
  const averageDuration = jobsWithDuration.length > 0
    ? totalDuration / jobsWithDuration.length / (1000 * 60) // Convert to minutes
    : 0;

  // Calculate average response time (time from creation to start)
  const jobsWithResponse = jobs.filter((j) => j.startedAt);
  const totalResponse = jobsWithResponse.reduce((sum, j) => {
    const response = j.startedAt!.getTime() - j.createdAt.getTime();
    return sum + response;
  }, 0);
  const averageResponseTime = jobsWithResponse.length > 0
    ? totalResponse / jobsWithResponse.length / (1000 * 60 * 60) // Convert to hours
    : 0;

  // Calculate on-time completion rate
  const scheduledCompletedJobs = jobs.filter(
    (j) => j.status === 'COMPLETED' && j.scheduledDate && j.completedAt
  );
  const onTimeJobs = scheduledCompletedJobs.filter((j) => {
    // Consider on-time if completed within 2 hours of scheduled time
    const scheduledEnd = new Date(j.scheduledDate!.getTime() + 2 * 60 * 60 * 1000);
    return j.completedAt! <= scheduledEnd;
  });
  const onTimeCompletionRate = scheduledCompletedJobs.length > 0
    ? (onTimeJobs.length / scheduledCompletedJobs.length) * 100
    : 0;

  return {
    totalJobs,
    completedJobs,
    cancelledJobs,
    pendingJobs,
    inProgressJobs,
    completionRate,
    cancellationRate,
    averageDuration,
    averageResponseTime,
    onTimeCompletionRate,
  };
}

/**
 * Get job trend over time
 */
export async function getJobTrend(
  organizationId: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): Promise<JobTrend[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      status: true,
      createdAt: true,
    },
  });

  // Group by period
  const periodMap = new Map<string, { total: number; completed: number; cancelled: number }>();

  for (const job of jobs) {
    const period = formatPeriod(job.createdAt, granularity);
    const current = periodMap.get(period) || { total: 0, completed: 0, cancelled: 0 };
    current.total++;
    if (job.status === 'COMPLETED') current.completed++;
    if (job.status === 'CANCELLED') current.cancelled++;
    periodMap.set(period, current);
  }

  // Generate trend
  const periods = generatePeriods(dateRange.start, dateRange.end, granularity);

  return periods.map((period) => {
    const data = periodMap.get(period) || { total: 0, completed: 0, cancelled: 0 };
    return {
      period,
      total: data.total,
      completed: data.completed,
      cancelled: data.cancelled,
      completionRate: data.total > 0 ? (data.completed / data.total) * 100 : 0,
    };
  });
}

/**
 * Get jobs breakdown by service type
 */
export async function getJobsByServiceType(
  organizationId: string,
  dateRange: DateRange
): Promise<JobsByServiceType[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      serviceType: true,
      status: true,
      startedAt: true,
      completedAt: true,
    },
  });

  // Group by service type
  const serviceMap = new Map<string, {
    count: number;
    completed: number;
    totalDuration: number;
    durationCount: number;
  }>();

  for (const job of jobs) {
    const serviceType = job.serviceType || 'other';
    const current = serviceMap.get(serviceType) || {
      count: 0,
      completed: 0,
      totalDuration: 0,
      durationCount: 0,
    };

    current.count++;
    if (job.status === 'COMPLETED') current.completed++;

    if (job.startedAt && job.completedAt) {
      const duration = (job.completedAt.getTime() - job.startedAt.getTime()) / (1000 * 60);
      current.totalDuration += duration;
      current.durationCount++;
    }

    serviceMap.set(serviceType, current);
  }

  const totalJobs = jobs.length;

  return Array.from(serviceMap.entries())
    .map(([serviceType, data]) => ({
      serviceType,
      count: data.count,
      percentage: totalJobs > 0 ? (data.count / totalJobs) * 100 : 0,
      averageDuration: data.durationCount > 0 ? data.totalDuration / data.durationCount : 0,
      completionRate: data.count > 0 ? (data.completed / data.count) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get jobs breakdown by status
 */
export async function getJobsByStatus(
  organizationId: string,
  dateRange: DateRange
): Promise<JobsByStatus[]> {
  const jobs = await db.job.groupBy({
    by: ['status'],
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    _count: true,
  });

  const totalJobs = jobs.reduce((sum, j) => sum + j._count, 0);

  return jobs.map((j) => ({
    status: j.status,
    count: j._count,
    percentage: totalJobs > 0 ? (j._count / totalJobs) * 100 : 0,
  }));
}

/**
 * Get jobs by day of week
 */
export async function getJobsByDayOfWeek(
  organizationId: string,
  dateRange: DateRange
): Promise<{ dayOfWeek: number; name: string; count: number }[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      scheduledDate: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      scheduledDate: true,
    },
  });

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayCounts = new Array(7).fill(0);

  for (const job of jobs) {
    if (job.scheduledDate) {
      const day = job.scheduledDate.getDay();
      dayCounts[day]++;
    }
  }

  return dayCounts.map((count, index) => ({
    dayOfWeek: index,
    name: dayNames[index],
    count,
  }));
}

/**
 * Get jobs by hour of day
 */
export async function getJobsByHourOfDay(
  organizationId: string,
  dateRange: DateRange
): Promise<{ hour: number; count: number }[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      scheduledDate: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      scheduledDate: true,
    },
  });

  const hourCounts = new Array(24).fill(0);

  for (const job of jobs) {
    if (job.scheduledDate) {
      const hour = job.scheduledDate.getHours();
      hourCounts[hour]++;
    }
  }

  return hourCounts.map((count, hour) => ({ hour, count }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate job KPIs for dashboard
 */
export async function generateJobKPIs(
  organizationId: string,
  dateRange: DateRange
): Promise<KPIResult[]> {
  const metrics = await calculateJobMetrics(organizationId, dateRange);

  // Get previous period for comparison
  const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
  const prevMetrics = await calculateJobMetrics(organizationId, {
    start: new Date(dateRange.start.getTime() - periodLength),
    end: new Date(dateRange.start.getTime() - 1),
  });

  const jobsGrowth = prevMetrics.totalJobs > 0
    ? ((metrics.totalJobs - prevMetrics.totalJobs) / prevMetrics.totalJobs) * 100
    : 0;

  return [
    {
      id: 'total_jobs',
      name: 'Total Trabajos',
      value: metrics.totalJobs,
      unit: 'number',
      trend: jobsGrowth > 0 ? 'up' : jobsGrowth < 0 ? 'down' : 'stable',
      changePercent: jobsGrowth,
      period: dateRange,
    },
    {
      id: 'completed_jobs',
      name: 'Trabajos Completados',
      value: metrics.completedJobs,
      unit: 'number',
      trend: 'stable',
      period: dateRange,
    },
    {
      id: 'completion_rate',
      name: 'Tasa de Completado',
      value: metrics.completionRate,
      unit: 'percentage',
      trend: metrics.completionRate >= 90 ? 'up' : metrics.completionRate >= 70 ? 'stable' : 'down',
      period: dateRange,
    },
    {
      id: 'avg_duration',
      name: 'Duración Promedio',
      value: metrics.averageDuration,
      unit: 'minutes',
      trend: 'stable',
      period: dateRange,
    },
    {
      id: 'avg_response_time',
      name: 'Tiempo de Respuesta',
      value: metrics.averageResponseTime,
      unit: 'hours',
      trend: metrics.averageResponseTime <= 24 ? 'up' : metrics.averageResponseTime <= 48 ? 'stable' : 'down',
      period: dateRange,
    },
    {
      id: 'on_time_rate',
      name: 'Puntualidad',
      value: metrics.onTimeCompletionRate,
      unit: 'percentage',
      trend: metrics.onTimeCompletionRate >= 80 ? 'up' : metrics.onTimeCompletionRate >= 60 ? 'stable' : 'down',
      period: dateRange,
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
