/**
 * Aggregation Jobs Service
 * ========================
 *
 * Phase 10.1: Analytics Data Infrastructure
 * Background jobs for aggregating analytics data at various time intervals.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { getRedisConnection } from '../../lib/redis/client';
import { runFullETL, runIncrementalETL } from './etl-pipeline';
import { DateRange, TimeGranularity, AggregatedMetric } from '../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AggregationJobConfig {
  name: string;
  granularity: TimeGranularity;
  schedule: string; // cron expression
  enabled: boolean;
  retentionDays: number;
  batchSize: number;
}

export interface AggregationJobResult {
  jobName: string;
  organizationId: string;
  startTime: Date;
  endTime: Date;
  recordsProcessed: number;
  metricsGenerated: number;
  success: boolean;
  error?: string;
}

export interface AggregationJobStatus {
  jobName: string;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastStatus: 'success' | 'failed' | 'running' | 'never_run';
  lastDurationMs: number | null;
  lastRecordsProcessed: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const AGGREGATION_JOBS: AggregationJobConfig[] = [
  {
    name: 'hourly_metrics',
    granularity: 'hour',
    schedule: '0 * * * *', // Every hour
    enabled: true,
    retentionDays: 365,
    batchSize: 1000,
  },
  {
    name: 'daily_aggregation',
    granularity: 'day',
    schedule: '0 2 * * *', // 2 AM daily
    enabled: true,
    retentionDays: 1095, // 3 years
    batchSize: 5000,
  },
  {
    name: 'weekly_summary',
    granularity: 'week',
    schedule: '0 3 * * 1', // 3 AM every Monday
    enabled: true,
    retentionDays: 1825, // 5 years
    batchSize: 10000,
  },
  {
    name: 'monthly_rollup',
    granularity: 'month',
    schedule: '0 4 1 * *', // 4 AM on 1st of month
    enabled: true,
    retentionDays: -1, // Keep forever
    batchSize: 50000,
  },
];

const JOB_LOCK_PREFIX = 'analytics:job_lock:';
const JOB_STATUS_PREFIX = 'analytics:job_status:';
const LOCK_TTL_SECONDS = 3600; // 1 hour max

// ═══════════════════════════════════════════════════════════════════════════════
// JOB EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run a specific aggregation job for all organizations
 */
export async function runAggregationJob(
  jobName: string
): Promise<AggregationJobResult[]> {
  const config = AGGREGATION_JOBS.find((j) => j.name === jobName);
  if (!config) {
    throw new Error(`Unknown aggregation job: ${jobName}`);
  }

  if (!config.enabled) {
    log.info('Aggregation job is disabled', { jobName });
    return [];
  }

  // Acquire lock
  const lockKey = `${JOB_LOCK_PREFIX}${jobName}`;
  const redis = await getRedisConnection();
  const acquired = await redis.set(lockKey, Date.now().toString(), 'EX', LOCK_TTL_SECONDS, 'NX');

  if (!acquired) {
    log.warn('Aggregation job already running', { jobName });
    return [];
  }

  try {
    const results: AggregationJobResult[] = [];

    // Get all organizations
    const organizations = await db.organization.findMany({
      select: { id: true, name: true },
    });

    log.info('Starting aggregation job', {
      jobName,
      granularity: config.granularity,
      organizationCount: organizations.length,
    });

    for (const org of organizations) {
      try {
        const result = await runOrganizationAggregation(org.id, config);
        results.push(result);
      } catch (error) {
        results.push({
          jobName,
          organizationId: org.id,
          startTime: new Date(),
          endTime: new Date(),
          recordsProcessed: 0,
          metricsGenerated: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update job status
    await updateJobStatus(jobName, results);

    return results;
  } finally {
    // Release lock
    await redis.del(lockKey);
  }
}

/**
 * Run aggregation for a specific organization
 */
async function runOrganizationAggregation(
  organizationId: string,
  config: AggregationJobConfig
): Promise<AggregationJobResult> {
  const startTime = new Date();
  let recordsProcessed = 0;
  let metricsGenerated = 0;

  try {
    // Determine date range based on granularity
    const dateRange = getDateRangeForGranularity(config.granularity);

    // Run appropriate aggregation based on granularity
    switch (config.granularity) {
      case 'hour':
        const hourlyResult = await aggregateHourlyMetrics(organizationId, dateRange);
        recordsProcessed = hourlyResult.recordsProcessed;
        metricsGenerated = hourlyResult.metricsGenerated;
        break;

      case 'day':
        const dailyResult = await aggregateDailyMetrics(organizationId, dateRange);
        recordsProcessed = dailyResult.recordsProcessed;
        metricsGenerated = dailyResult.metricsGenerated;
        break;

      case 'week':
        const weeklyResult = await aggregateWeeklyMetrics(organizationId, dateRange);
        recordsProcessed = weeklyResult.recordsProcessed;
        metricsGenerated = weeklyResult.metricsGenerated;
        break;

      case 'month':
        const monthlyResult = await aggregateMonthlyMetrics(organizationId, dateRange);
        recordsProcessed = monthlyResult.recordsProcessed;
        metricsGenerated = monthlyResult.metricsGenerated;
        break;
    }

    return {
      jobName: config.name,
      organizationId,
      startTime,
      endTime: new Date(),
      recordsProcessed,
      metricsGenerated,
      success: true,
    };
  } catch (error) {
    return {
      jobName: config.name,
      organizationId,
      startTime,
      endTime: new Date(),
      recordsProcessed,
      metricsGenerated,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGGREGATION IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface AggregationResult {
  recordsProcessed: number;
  metricsGenerated: number;
}

/**
 * Aggregate hourly metrics
 */
async function aggregateHourlyMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<AggregationResult> {
  let recordsProcessed = 0;
  let metricsGenerated = 0;

  // Aggregate jobs per hour
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
      actualDuration: true,
    },
  });

  recordsProcessed += jobs.length;

  // Group by hour
  const hourlyJobs = new Map<string, { total: number; completed: number; duration: number; durationCount: number }>();

  for (const job of jobs) {
    const hourKey = job.createdAt.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const current = hourlyJobs.get(hourKey) || { total: 0, completed: 0, duration: 0, durationCount: 0 };

    current.total++;
    if (job.status === 'COMPLETED') current.completed++;
    if (job.actualDuration) {
      current.duration += job.actualDuration;
      current.durationCount++;
    }

    hourlyJobs.set(hourKey, current);
  }

  // Store aggregated metrics
  for (const [period, data] of hourlyJobs) {
    await storeAggregatedMetric(organizationId, 'jobs_total', period, 'hour', data.total, data.total);
    await storeAggregatedMetric(organizationId, 'jobs_completed', period, 'hour', data.completed, data.completed);
    if (data.durationCount > 0) {
      await storeAggregatedMetric(
        organizationId,
        'avg_job_duration',
        period,
        'hour',
        data.duration / data.durationCount,
        data.durationCount,
        data.duration / data.durationCount,
        data.duration / data.durationCount,
        data.duration / data.durationCount
      );
    }
    metricsGenerated += 3;
  }

  // Aggregate invoices per hour
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      id: true,
      total: true,
      createdAt: true,
      status: true,
    },
  });

  recordsProcessed += invoices.length;

  const hourlyRevenue = new Map<string, { total: number; count: number }>();

  for (const invoice of invoices) {
    const hourKey = invoice.createdAt.toISOString().slice(0, 13);
    const current = hourlyRevenue.get(hourKey) || { total: 0, count: 0 };

    current.total += invoice.total.toNumber();
    current.count++;

    hourlyRevenue.set(hourKey, current);
  }

  for (const [period, data] of hourlyRevenue) {
    await storeAggregatedMetric(organizationId, 'revenue_total', period, 'hour', data.total, data.count);
    metricsGenerated++;
  }

  return { recordsProcessed, metricsGenerated };
}

/**
 * Aggregate daily metrics
 */
async function aggregateDailyMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<AggregationResult> {
  let recordsProcessed = 0;
  let metricsGenerated = 0;

  // Get all jobs for the period
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
      serviceType: true,
      technicianId: true,
      customerId: true,
      createdAt: true,
      actualDuration: true,
    },
  });

  recordsProcessed += jobs.length;

  // Group by day
  const dailyStats = new Map<string, {
    total: number;
    completed: number;
    cancelled: number;
    uniqueTechs: Set<string>;
    uniqueCustomers: Set<string>;
    serviceTypes: Map<string, number>;
  }>();

  for (const job of jobs) {
    const dayKey = job.createdAt.toISOString().slice(0, 10);
    const current = dailyStats.get(dayKey) || {
      total: 0,
      completed: 0,
      cancelled: 0,
      uniqueTechs: new Set(),
      uniqueCustomers: new Set(),
      serviceTypes: new Map(),
    };

    current.total++;
    if (job.status === 'COMPLETED') current.completed++;
    if (job.status === 'CANCELLED') current.cancelled++;
    if (job.technicianId) current.uniqueTechs.add(job.technicianId);
    if (job.customerId) current.uniqueCustomers.add(job.customerId);

    const stCount = current.serviceTypes.get(job.serviceType) || 0;
    current.serviceTypes.set(job.serviceType, stCount + 1);

    dailyStats.set(dayKey, current);
  }

  // Store daily job metrics
  for (const [period, data] of dailyStats) {
    await storeAggregatedMetric(organizationId, 'jobs_total', period, 'day', data.total, data.total);
    await storeAggregatedMetric(organizationId, 'jobs_completed', period, 'day', data.completed, data.completed);
    await storeAggregatedMetric(organizationId, 'jobs_cancelled', period, 'day', data.cancelled, data.cancelled);
    await storeAggregatedMetric(organizationId, 'active_technicians', period, 'day', data.uniqueTechs.size, 1);
    await storeAggregatedMetric(organizationId, 'unique_customers', period, 'day', data.uniqueCustomers.size, 1);

    if (data.total > 0) {
      const completionRate = (data.completed / data.total) * 100;
      await storeAggregatedMetric(organizationId, 'completion_rate', period, 'day', completionRate, 1);
    }

    metricsGenerated += 6;

    // Store per service type
    for (const [serviceType, count] of data.serviceTypes) {
      await storeAggregatedMetric(organizationId, `jobs_${serviceType}`, period, 'day', count, count);
      metricsGenerated++;
    }
  }

  // Get invoices and aggregate daily revenue
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      id: true,
      total: true,
      taxAmount: true,
      status: true,
      createdAt: true,
    },
  });

  recordsProcessed += invoices.length;

  const dailyRevenue = new Map<string, {
    total: number;
    tax: number;
    count: number;
    paid: number;
    paidAmount: number;
  }>();

  for (const invoice of invoices) {
    const dayKey = invoice.createdAt.toISOString().slice(0, 10);
    const current = dailyRevenue.get(dayKey) || { total: 0, tax: 0, count: 0, paid: 0, paidAmount: 0 };

    current.total += invoice.total.toNumber();
    current.tax += invoice.taxAmount.toNumber();
    current.count++;
    if (invoice.status === 'PAID') {
      current.paid++;
      current.paidAmount += invoice.total.toNumber();
    }

    dailyRevenue.set(dayKey, current);
  }

  for (const [period, data] of dailyRevenue) {
    await storeAggregatedMetric(organizationId, 'revenue_total', period, 'day', data.total, data.count);
    await storeAggregatedMetric(organizationId, 'revenue_tax', period, 'day', data.tax, data.count);
    await storeAggregatedMetric(organizationId, 'revenue_collected', period, 'day', data.paidAmount, data.paid);
    await storeAggregatedMetric(
      organizationId,
      'avg_invoice_value',
      period,
      'day',
      data.count > 0 ? data.total / data.count : 0,
      data.count
    );
    metricsGenerated += 4;
  }

  return { recordsProcessed, metricsGenerated };
}

/**
 * Aggregate weekly metrics
 */
async function aggregateWeeklyMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<AggregationResult> {
  let recordsProcessed = 0;
  let metricsGenerated = 0;

  // Get all jobs for the period
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
      technicianId: true,
      customerId: true,
      createdAt: true,
      actualDuration: true,
    },
  });

  recordsProcessed += jobs.length;

  // Group by week
  const weeklyStats = new Map<string, {
    total: number;
    completed: number;
    techJobs: Map<string, number>;
    uniqueCustomers: Set<string>;
    totalDuration: number;
    durationCount: number;
  }>();

  for (const job of jobs) {
    const weekKey = getWeekKey(job.createdAt);
    const current = weeklyStats.get(weekKey) || {
      total: 0,
      completed: 0,
      techJobs: new Map(),
      uniqueCustomers: new Set(),
      totalDuration: 0,
      durationCount: 0,
    };

    current.total++;
    if (job.status === 'COMPLETED') current.completed++;
    if (job.customerId) current.uniqueCustomers.add(job.customerId);

    if (job.technicianId) {
      const techCount = current.techJobs.get(job.technicianId) || 0;
      current.techJobs.set(job.technicianId, techCount + 1);
    }

    if (job.actualDuration) {
      current.totalDuration += job.actualDuration;
      current.durationCount++;
    }

    weeklyStats.set(weekKey, current);
  }

  // Store weekly metrics
  for (const [period, data] of weeklyStats) {
    await storeAggregatedMetric(organizationId, 'jobs_total', period, 'week', data.total, data.total);
    await storeAggregatedMetric(organizationId, 'jobs_completed', period, 'week', data.completed, data.completed);
    await storeAggregatedMetric(organizationId, 'unique_customers', period, 'week', data.uniqueCustomers.size, 1);

    const techCount = data.techJobs.size;
    await storeAggregatedMetric(organizationId, 'active_technicians', period, 'week', techCount, 1);

    if (techCount > 0) {
      const jobsPerTech = data.total / techCount;
      await storeAggregatedMetric(organizationId, 'jobs_per_technician', period, 'week', jobsPerTech, techCount);
    }

    if (data.total > 0) {
      const completionRate = (data.completed / data.total) * 100;
      await storeAggregatedMetric(organizationId, 'completion_rate', period, 'week', completionRate, 1);
    }

    if (data.durationCount > 0) {
      const avgDuration = data.totalDuration / data.durationCount;
      await storeAggregatedMetric(organizationId, 'avg_job_duration', period, 'week', avgDuration, data.durationCount);
    }

    metricsGenerated += 7;
  }

  // Weekly revenue
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
      status: true,
      createdAt: true,
    },
  });

  recordsProcessed += invoices.length;

  const weeklyRevenue = new Map<string, { total: number; collected: number; count: number }>();

  for (const invoice of invoices) {
    const weekKey = getWeekKey(invoice.createdAt);
    const current = weeklyRevenue.get(weekKey) || { total: 0, collected: 0, count: 0 };

    current.total += invoice.total.toNumber();
    current.count++;
    if (invoice.status === 'PAID') {
      current.collected += invoice.total.toNumber();
    }

    weeklyRevenue.set(weekKey, current);
  }

  for (const [period, data] of weeklyRevenue) {
    await storeAggregatedMetric(organizationId, 'revenue_total', period, 'week', data.total, data.count);
    await storeAggregatedMetric(organizationId, 'revenue_collected', period, 'week', data.collected, data.count);

    if (data.total > 0) {
      const collectionRate = (data.collected / data.total) * 100;
      await storeAggregatedMetric(organizationId, 'collection_rate', period, 'week', collectionRate, 1);
    }

    metricsGenerated += 3;
  }

  return { recordsProcessed, metricsGenerated };
}

/**
 * Aggregate monthly metrics
 */
async function aggregateMonthlyMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<AggregationResult> {
  let recordsProcessed = 0;
  let metricsGenerated = 0;

  // Get all data for comprehensive monthly rollup
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      technician: { select: { id: true, name: true } },
      customer: { select: { id: true } },
    },
  });

  recordsProcessed += jobs.length;

  // Group by month
  const monthlyStats = new Map<string, {
    totalJobs: number;
    completedJobs: number;
    cancelledJobs: number;
    uniqueCustomers: Set<string>;
    newCustomers: Set<string>;
    techPerformance: Map<string, { jobs: number; completed: number; duration: number }>;
    totalDuration: number;
    durationCount: number;
    totalValue: number;
    valueCount: number;
  }>();

  // Get first job dates for all customers to determine new vs returning
  const firstJobDates = new Map<string, Date>();
  const customerFirstJobs = await db.job.groupBy({
    by: ['customerId'],
    where: { organizationId },
    _min: { createdAt: true },
  });

  for (const cj of customerFirstJobs) {
    if (cj._min.createdAt) {
      firstJobDates.set(cj.customerId, cj._min.createdAt);
    }
  }

  for (const job of jobs) {
    const monthKey = job.createdAt.toISOString().slice(0, 7); // YYYY-MM
    const current = monthlyStats.get(monthKey) || {
      totalJobs: 0,
      completedJobs: 0,
      cancelledJobs: 0,
      uniqueCustomers: new Set(),
      newCustomers: new Set(),
      techPerformance: new Map(),
      totalDuration: 0,
      durationCount: 0,
      totalValue: 0,
      valueCount: 0,
    };

    current.totalJobs++;
    if (job.status === 'COMPLETED') current.completedJobs++;
    if (job.status === 'CANCELLED') current.cancelledJobs++;

    current.uniqueCustomers.add(job.customerId);

    // Check if new customer this month
    const firstJob = firstJobDates.get(job.customerId);
    if (firstJob && firstJob.toISOString().slice(0, 7) === monthKey) {
      current.newCustomers.add(job.customerId);
    }

    // Tech performance
    if (job.technicianId) {
      const techStats = current.techPerformance.get(job.technicianId) || { jobs: 0, completed: 0, duration: 0 };
      techStats.jobs++;
      if (job.status === 'COMPLETED') techStats.completed++;
      if (job.actualDuration) techStats.duration += job.actualDuration;
      current.techPerformance.set(job.technicianId, techStats);
    }

    if (job.actualDuration) {
      current.totalDuration += job.actualDuration;
      current.durationCount++;
    }

    monthlyStats.set(monthKey, current);
  }

  // Store monthly job metrics
  for (const [period, data] of monthlyStats) {
    await storeAggregatedMetric(organizationId, 'jobs_total', period, 'month', data.totalJobs, data.totalJobs);
    await storeAggregatedMetric(organizationId, 'jobs_completed', period, 'month', data.completedJobs, data.completedJobs);
    await storeAggregatedMetric(organizationId, 'jobs_cancelled', period, 'month', data.cancelledJobs, data.cancelledJobs);
    await storeAggregatedMetric(organizationId, 'unique_customers', period, 'month', data.uniqueCustomers.size, 1);
    await storeAggregatedMetric(organizationId, 'new_customers', period, 'month', data.newCustomers.size, 1);
    await storeAggregatedMetric(organizationId, 'active_technicians', period, 'month', data.techPerformance.size, 1);

    if (data.totalJobs > 0) {
      const completionRate = (data.completedJobs / data.totalJobs) * 100;
      await storeAggregatedMetric(organizationId, 'completion_rate', period, 'month', completionRate, 1);

      const cancellationRate = (data.cancelledJobs / data.totalJobs) * 100;
      await storeAggregatedMetric(organizationId, 'cancellation_rate', period, 'month', cancellationRate, 1);
    }

    if (data.durationCount > 0) {
      await storeAggregatedMetric(
        organizationId,
        'avg_job_duration',
        period,
        'month',
        data.totalDuration / data.durationCount,
        data.durationCount
      );
    }

    // Store per-technician metrics
    for (const [techId, techStats] of data.techPerformance) {
      await storeAggregatedMetric(
        organizationId,
        `tech_${techId}_jobs`,
        period,
        'month',
        techStats.jobs,
        techStats.jobs
      );
      metricsGenerated++;
    }

    metricsGenerated += 9;
  }

  // Monthly revenue
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      payments: { select: { paidAt: true, amount: true } },
    },
  });

  recordsProcessed += invoices.length;

  const monthlyRevenue = new Map<string, {
    total: number;
    tax: number;
    collected: number;
    count: number;
    overdue: number;
    daysToPayment: number[];
  }>();

  for (const invoice of invoices) {
    const monthKey = invoice.createdAt.toISOString().slice(0, 7);
    const current = monthlyRevenue.get(monthKey) || {
      total: 0,
      tax: 0,
      collected: 0,
      count: 0,
      overdue: 0,
      daysToPayment: [],
    };

    current.total += invoice.total.toNumber();
    current.tax += invoice.taxAmount.toNumber();
    current.count++;

    if (invoice.status === 'PAID') {
      current.collected += invoice.total.toNumber();

      // Calculate days to payment
      if (invoice.payments.length > 0 && invoice.payments[0].paidAt) {
        const days = Math.ceil(
          (invoice.payments[0].paidAt.getTime() - invoice.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        current.daysToPayment.push(days);
      }
    }

    if (invoice.status === 'OVERDUE') {
      current.overdue += invoice.total.toNumber();
    }

    monthlyRevenue.set(monthKey, current);
  }

  for (const [period, data] of monthlyRevenue) {
    await storeAggregatedMetric(organizationId, 'revenue_total', period, 'month', data.total, data.count);
    await storeAggregatedMetric(organizationId, 'revenue_tax', period, 'month', data.tax, data.count);
    await storeAggregatedMetric(organizationId, 'revenue_collected', period, 'month', data.collected, data.count);
    await storeAggregatedMetric(organizationId, 'revenue_overdue', period, 'month', data.overdue, 1);

    if (data.count > 0) {
      await storeAggregatedMetric(organizationId, 'avg_invoice_value', period, 'month', data.total / data.count, data.count);
    }

    if (data.total > 0) {
      const collectionRate = (data.collected / data.total) * 100;
      await storeAggregatedMetric(organizationId, 'collection_rate', period, 'month', collectionRate, 1);
    }

    if (data.daysToPayment.length > 0) {
      const avgDays = data.daysToPayment.reduce((a, b) => a + b, 0) / data.daysToPayment.length;
      await storeAggregatedMetric(organizationId, 'days_sales_outstanding', period, 'month', avgDays, data.daysToPayment.length);
    }

    metricsGenerated += 7;
  }

  return { recordsProcessed, metricsGenerated };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getDateRangeForGranularity(granularity: TimeGranularity): DateRange {
  const now = new Date();
  let start: Date;

  switch (granularity) {
    case 'hour':
      // Last 24 hours
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'day':
      // Last 7 days
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'week':
      // Last 4 weeks
      start = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      // Last 3 months
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  return { start, end: now };
}

function getWeekKey(date: Date): string {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  return `${weekStart.toISOString().slice(0, 10)}_W`;
}

async function storeAggregatedMetric(
  organizationId: string,
  metricName: string,
  period: string,
  granularity: TimeGranularity,
  value: number,
  count: number,
  minValue?: number,
  maxValue?: number,
  avgValue?: number
): Promise<void> {
  try {
    const redis = await getRedisConnection();
    const key = `analytics:metrics:${organizationId}:${granularity}:${metricName}:${period}`;

    const data = {
      value,
      count,
      min: minValue ?? value,
      max: maxValue ?? value,
      avg: avgValue ?? value,
      updatedAt: new Date().toISOString(),
    };

    // Store in Redis with appropriate TTL
    const ttlDays = granularity === 'hour' ? 7 : granularity === 'day' ? 90 : 365;
    await redis.setex(key, ttlDays * 24 * 60 * 60, JSON.stringify(data));
  } catch (error) {
    log.warn('Failed to store aggregated metric', {
      organizationId,
      metricName,
      period,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

async function updateJobStatus(jobName: string, results: AggregationJobResult[]): Promise<void> {
  try {
    const redis = await getRedisConnection();
    const key = `${JOB_STATUS_PREFIX}${jobName}`;

    const successCount = results.filter((r) => r.success).length;
    const totalRecords = results.reduce((sum, r) => sum + r.recordsProcessed, 0);
    const totalMetrics = results.reduce((sum, r) => sum + r.metricsGenerated, 0);
    const totalDuration = results.reduce((sum, r) => sum + (r.endTime.getTime() - r.startTime.getTime()), 0);

    const status = {
      lastRunAt: new Date().toISOString(),
      lastStatus: successCount === results.length ? 'success' : 'failed',
      organizationsProcessed: results.length,
      successCount,
      failedCount: results.length - successCount,
      totalRecordsProcessed: totalRecords,
      totalMetricsGenerated: totalMetrics,
      totalDurationMs: totalDuration,
    };

    await redis.set(key, JSON.stringify(status));
  } catch (error) {
    log.warn('Failed to update job status', { jobName, error: error instanceof Error ? error.message : 'Unknown' });
  }
}

/**
 * Get status of all aggregation jobs
 */
export async function getAggregationJobStatuses(): Promise<AggregationJobStatus[]> {
  const statuses: AggregationJobStatus[] = [];
  const redis = await getRedisConnection();

  for (const config of AGGREGATION_JOBS) {
    const key = `${JOB_STATUS_PREFIX}${config.name}`;
    const data = await redis.get(key);

    if (data) {
      const parsed = JSON.parse(data);
      statuses.push({
        jobName: config.name,
        lastRunAt: parsed.lastRunAt ? new Date(parsed.lastRunAt) : null,
        nextRunAt: null, // Would be calculated from cron expression
        lastStatus: parsed.lastStatus,
        lastDurationMs: parsed.totalDurationMs,
        lastRecordsProcessed: parsed.totalRecordsProcessed,
      });
    } else {
      statuses.push({
        jobName: config.name,
        lastRunAt: null,
        nextRunAt: null,
        lastStatus: 'never_run',
        lastDurationMs: null,
        lastRecordsProcessed: null,
      });
    }
  }

  return statuses;
}

/**
 * Run all enabled aggregation jobs
 */
export async function runAllAggregationJobs(): Promise<void> {
  log.info('Running all aggregation jobs');

  for (const config of AGGREGATION_JOBS) {
    if (config.enabled) {
      try {
        await runAggregationJob(config.name);
      } catch (error) {
        log.error('Aggregation job failed', {
          jobName: config.name,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }
  }
}

/**
 * Clean up old aggregated data based on retention policies
 */
export async function cleanupOldAggregatedData(): Promise<void> {
  log.info('Starting cleanup of old aggregated data');

  const redis = await getRedisConnection();
  const now = Date.now();

  for (const config of AGGREGATION_JOBS) {
    if (config.retentionDays === -1) continue; // Keep forever

    const cutoffDate = new Date(now - config.retentionDays * 24 * 60 * 60 * 1000);

    // Scan and delete old keys
    // Note: In production, use SCAN to avoid blocking
    const pattern = `analytics:metrics:*:${config.granularity}:*`;
    const keys = await redis.keys(pattern);

    let deletedCount = 0;
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (new Date(parsed.updatedAt) < cutoffDate) {
          await redis.del(key);
          deletedCount++;
        }
      }
    }

    log.info('Cleaned up old aggregated data', {
      granularity: config.granularity,
      deletedCount,
    });
  }
}
