/**
 * ETL Pipeline Service
 * ====================
 *
 * Phase 10: Advanced Analytics & Reporting
 * Extract, Transform, Load pipeline for analytics data.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { getRedisConnection } from '../../lib/redis/client';
import {
  getJobFacts,
  getInvoiceFacts,
  getPaymentFacts,
  getCustomerDimension,
  getTechnicianDimension,
  getServiceDimension,
} from './data-warehouse';
import { DateRange, AggregatedMetric, TimeGranularity } from '../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// ETL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const ETL_CONFIG = {
  batchSize: 1000,
  retentionDays: {
    raw: 90,
    hourly: 365,
    daily: 1095, // 3 years
  },
  cacheKeyPrefix: 'analytics:',
  cacheTTL: {
    realtime: 60, // 1 minute
    hourly: 3600, // 1 hour
    daily: 86400, // 24 hours
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ETL JOBS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run full ETL pipeline for an organization
 */
export async function runFullETL(organizationId: string): Promise<void> {
  const startTime = Date.now();
  log.info('Starting full ETL pipeline', { organizationId });

  try {
    // Define date range (last 90 days for raw data)
    const dateRange: DateRange = {
      start: new Date(Date.now() - ETL_CONFIG.retentionDays.raw * 24 * 60 * 60 * 1000),
      end: new Date(),
    };

    // Extract and transform facts
    await processJobFacts(organizationId, dateRange);
    await processInvoiceFacts(organizationId, dateRange);
    await processPaymentFacts(organizationId, dateRange);

    // Update dimensions
    await updateDimensions(organizationId);

    // Aggregate metrics
    await aggregateMetrics(organizationId, dateRange);

    // Update cache
    await updateAnalyticsCache(organizationId);

    const duration = Date.now() - startTime;
    log.info('ETL pipeline completed', { organizationId, durationMs: duration });
  } catch (error) {
    log.error('ETL pipeline failed', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

/**
 * Run incremental ETL (last 24 hours)
 */
export async function runIncrementalETL(organizationId: string): Promise<void> {
  const startTime = Date.now();
  log.info('Starting incremental ETL', { organizationId });

  try {
    const dateRange: DateRange = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
    };

    await processJobFacts(organizationId, dateRange);
    await processInvoiceFacts(organizationId, dateRange);
    await processPaymentFacts(organizationId, dateRange);
    await updateAnalyticsCache(organizationId);

    const duration = Date.now() - startTime;
    log.info('Incremental ETL completed', { organizationId, durationMs: duration });
  } catch (error) {
    log.error('Incremental ETL failed', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACT PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

async function processJobFacts(organizationId: string, dateRange: DateRange): Promise<void> {
  const facts = await getJobFacts(organizationId, dateRange);

  // Enrich with additional data
  const enrichedFacts = await enrichJobFacts(organizationId, facts);

  // Store in analytics tables (upsert)
  for (const fact of enrichedFacts) {
    await db.analyticsJobFact.upsert({
      where: { id: fact.id },
      create: {
        id: fact.id,
        organizationId: fact.organizationId,
        jobId: fact.jobId,
        customerId: fact.customerId,
        technicianId: fact.technicianId,
        serviceType: fact.serviceType,
        createdAt: fact.createdAt,
        scheduledAt: fact.scheduledAt,
        startedAt: fact.startedAt,
        completedAt: fact.completedAt,
        status: fact.status,
        durationMinutes: fact.durationMinutes,
        estimatedAmount: fact.estimatedAmount,
        actualAmount: fact.actualAmount,
        isFirstTimeCustomer: fact.isFirstTimeCustomer,
        isRepeatJob: fact.isRepeatJob,
      },
      update: {
        status: fact.status,
        startedAt: fact.startedAt,
        completedAt: fact.completedAt,
        durationMinutes: fact.durationMinutes,
        actualAmount: fact.actualAmount,
      },
    });
  }

  log.debug('Processed job facts', { organizationId, count: facts.length });
}

async function processInvoiceFacts(organizationId: string, dateRange: DateRange): Promise<void> {
  const facts = await getInvoiceFacts(organizationId, dateRange);

  for (const fact of facts) {
    await db.analyticsInvoiceFact.upsert({
      where: { id: fact.id },
      create: {
        id: fact.id,
        organizationId: fact.organizationId,
        invoiceId: fact.invoiceId,
        customerId: fact.customerId,
        jobId: fact.jobId,
        invoiceType: fact.invoiceType,
        createdAt: fact.createdAt,
        dueDate: fact.dueDate,
        paidAt: fact.paidAt,
        subtotal: fact.subtotal,
        taxAmount: fact.taxAmount,
        total: fact.total,
        status: fact.status,
        daysToPayment: fact.daysToPayment,
        paymentMethod: fact.paymentMethod,
      },
      update: {
        status: fact.status,
        paidAt: fact.paidAt,
        daysToPayment: fact.daysToPayment,
        paymentMethod: fact.paymentMethod,
      },
    });
  }

  log.debug('Processed invoice facts', { organizationId, count: facts.length });
}

async function processPaymentFacts(organizationId: string, dateRange: DateRange): Promise<void> {
  const facts = await getPaymentFacts(organizationId, dateRange);

  for (const fact of facts) {
    await db.analyticsPaymentFact.upsert({
      where: { id: fact.id },
      create: {
        id: fact.id,
        organizationId: fact.organizationId,
        paymentId: fact.paymentId,
        invoiceId: fact.invoiceId,
        customerId: fact.customerId,
        receivedAt: fact.receivedAt,
        amount: fact.amount,
        method: fact.method,
        processingFee: fact.processingFee,
        netAmount: fact.netAmount,
      },
      update: {},
    });
  }

  log.debug('Processed payment facts', { organizationId, count: facts.length });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIMENSION UPDATES
// ═══════════════════════════════════════════════════════════════════════════════

async function updateDimensions(organizationId: string): Promise<void> {
  // Update customer dimensions
  const customers = await getCustomerDimension(organizationId);
  for (const customer of customers) {
    await db.analyticsCustomerDim.upsert({
      where: { customerId: customer.customerId },
      create: customer,
      update: {
        totalJobs: customer.totalJobs,
        totalRevenue: customer.totalRevenue,
        averageJobValue: customer.averageJobValue,
        lastJobAt: customer.lastJobAt,
        segment: customer.segment,
      },
    });
  }

  // Update technician dimensions
  const technicians = await getTechnicianDimension(organizationId);
  for (const tech of technicians) {
    await db.analyticsTechnicianDim.upsert({
      where: { technicianId: tech.technicianId },
      create: tech,
      update: {
        totalJobs: tech.totalJobs,
        completedJobs: tech.completedJobs,
        efficiency: tech.efficiency,
        averageRating: tech.averageRating,
      },
    });
  }

  // Update service dimensions
  const services = await getServiceDimension(organizationId);
  for (const service of services) {
    await db.analyticsServiceDim.upsert({
      where: {
        organizationId_serviceType: {
          organizationId: service.organizationId,
          serviceType: service.serviceType,
        },
      },
      create: service,
      update: {
        averagePrice: service.averagePrice,
        averageDuration: service.averageDuration,
        popularityRank: service.popularityRank,
      },
    });
  }

  log.debug('Updated dimensions', {
    organizationId,
    customers: customers.length,
    technicians: technicians.length,
    services: services.length,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRIC AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════════

async function aggregateMetrics(organizationId: string, dateRange: DateRange): Promise<void> {
  const granularities: TimeGranularity[] = ['day', 'week', 'month'];

  for (const granularity of granularities) {
    await aggregateRevenueMetrics(organizationId, dateRange, granularity);
    await aggregateJobMetrics(organizationId, dateRange, granularity);
    await aggregateCustomerMetrics(organizationId, dateRange, granularity);
  }

  log.debug('Aggregated metrics', { organizationId });
}

async function aggregateRevenueMetrics(
  organizationId: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): Promise<void> {
  const invoices = await getInvoiceFacts(organizationId, dateRange);

  const aggregated = new Map<string, AggregatedMetric>();

  for (const invoice of invoices) {
    const period = formatPeriodKey(invoice.createdAt, granularity);
    const key = `${period}_revenue`;

    const current = aggregated.get(key) || {
      period,
      granularity,
      organizationId,
      metric: 'revenue',
      value: 0,
      count: 0,
      min: null,
      max: null,
      average: null,
    };

    current.value += invoice.total;
    current.count++;
    current.min = current.min === null ? invoice.total : Math.min(current.min, invoice.total);
    current.max = current.max === null ? invoice.total : Math.max(current.max, invoice.total);

    aggregated.set(key, current);
  }

  // Calculate averages and store
  for (const metric of aggregated.values()) {
    metric.average = metric.count > 0 ? metric.value / metric.count : null;

    await db.analyticsAggregatedMetric.upsert({
      where: {
        organizationId_metric_period_granularity: {
          organizationId: metric.organizationId,
          metric: metric.metric,
          period: metric.period,
          granularity: metric.granularity,
        },
      },
      create: metric,
      update: {
        value: metric.value,
        count: metric.count,
        min: metric.min,
        max: metric.max,
        average: metric.average,
      },
    });
  }
}

async function aggregateJobMetrics(
  organizationId: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): Promise<void> {
  const jobs = await getJobFacts(organizationId, dateRange);

  const metrics = ['jobs_total', 'jobs_completed', 'job_duration'];
  const aggregated = new Map<string, AggregatedMetric>();

  for (const job of jobs) {
    const period = formatPeriodKey(job.createdAt, granularity);

    // Total jobs
    const totalKey = `${period}_jobs_total`;
    const total = aggregated.get(totalKey) || createEmptyMetric(period, granularity, organizationId, 'jobs_total');
    total.value++;
    total.count++;
    aggregated.set(totalKey, total);

    // Completed jobs
    if (job.status === 'completado') {
      const completedKey = `${period}_jobs_completed`;
      const completed = aggregated.get(completedKey) || createEmptyMetric(period, granularity, organizationId, 'jobs_completed');
      completed.value++;
      completed.count++;
      aggregated.set(completedKey, completed);
    }

    // Duration
    if (job.durationMinutes) {
      const durationKey = `${period}_job_duration`;
      const duration = aggregated.get(durationKey) || createEmptyMetric(period, granularity, organizationId, 'job_duration');
      duration.value += job.durationMinutes;
      duration.count++;
      duration.min = duration.min === null ? job.durationMinutes : Math.min(duration.min, job.durationMinutes);
      duration.max = duration.max === null ? job.durationMinutes : Math.max(duration.max, job.durationMinutes);
      aggregated.set(durationKey, duration);
    }
  }

  // Store aggregated metrics
  for (const metric of aggregated.values()) {
    if (metric.metric === 'job_duration') {
      metric.average = metric.count > 0 ? metric.value / metric.count : null;
    }

    await db.analyticsAggregatedMetric.upsert({
      where: {
        organizationId_metric_period_granularity: {
          organizationId: metric.organizationId,
          metric: metric.metric,
          period: metric.period,
          granularity: metric.granularity,
        },
      },
      create: metric,
      update: {
        value: metric.value,
        count: metric.count,
        min: metric.min,
        max: metric.max,
        average: metric.average,
      },
    });
  }
}

async function aggregateCustomerMetrics(
  organizationId: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): Promise<void> {
  // Customer metrics are typically calculated differently (snapshots)
  // This is a simplified version
  const customers = await getCustomerDimension(organizationId);

  const segmentCounts: Record<string, number> = {
    new: 0,
    active: 0,
    loyal: 0,
    at_risk: 0,
    churned: 0,
  };

  for (const customer of customers) {
    segmentCounts[customer.segment]++;
  }

  const period = formatPeriodKey(new Date(), granularity);

  for (const [segment, count] of Object.entries(segmentCounts)) {
    await db.analyticsAggregatedMetric.upsert({
      where: {
        organizationId_metric_period_granularity: {
          organizationId,
          metric: `customers_${segment}`,
          period,
          granularity,
        },
      },
      create: {
        organizationId,
        metric: `customers_${segment}`,
        period,
        granularity,
        value: count,
        count: 1,
        min: null,
        max: null,
        average: null,
      },
      update: {
        value: count,
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function updateAnalyticsCache(organizationId: string): Promise<void> {
  try {
    const redis = await getRedisConnection();
    const cacheKey = `${ETL_CONFIG.cacheKeyPrefix}${organizationId}:last_update`;
    await redis.set(cacheKey, new Date().toISOString(), 'EX', ETL_CONFIG.cacheTTL.daily);
  } catch (error) {
    log.warn('Failed to update analytics cache', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function enrichJobFacts(organizationId: string, facts: any[]): Promise<any[]> {
  // Get first job date for each customer
  const firstJobDates = new Map<string, Date>();

  const customerJobs = await db.job.groupBy({
    by: ['customerId'],
    where: { organizationId },
    _min: { createdAt: true },
  });

  for (const cj of customerJobs) {
    if (cj._min.createdAt) {
      firstJobDates.set(cj.customerId, cj._min.createdAt);
    }
  }

  return facts.map((fact) => ({
    ...fact,
    isFirstTimeCustomer: firstJobDates.get(fact.customerId)?.getTime() === fact.createdAt.getTime(),
    isRepeatJob: firstJobDates.get(fact.customerId)?.getTime() !== fact.createdAt.getTime(),
  }));
}

function formatPeriodKey(date: Date, granularity: TimeGranularity): string {
  switch (granularity) {
    case 'hour':
      return date.toISOString().slice(0, 13);
    case 'day':
      return date.toISOString().slice(0, 10);
    case 'week':
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return `${weekStart.toISOString().slice(0, 10)}_W`;
    case 'month':
      return date.toISOString().slice(0, 7);
    case 'quarter':
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()}-Q${quarter}`;
    case 'year':
      return date.getFullYear().toString();
  }
}

function createEmptyMetric(
  period: string,
  granularity: TimeGranularity,
  organizationId: string,
  metric: string
): AggregatedMetric {
  return {
    period,
    granularity,
    organizationId,
    metric,
    value: 0,
    count: 0,
    min: null,
    max: null,
    average: null,
  };
}
