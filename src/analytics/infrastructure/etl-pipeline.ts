/**
 * ETL Pipeline Service
 * ====================
 *
 * Phase 10.1: Analytics Data Infrastructure
 * Extract, Transform, Load pipeline for analytics data.
 *
 * Uses Redis-based storage for analytics data, avoiding the need
 * for additional Prisma migrations for analytics-specific tables.
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
import { writePoints, TimeSeriesPoint, queryTimeSeries } from '../collectors/time-series-storage';
import { aggregateMetrics } from '../collectors/metrics-aggregator';
import { flushEvents } from '../collectors/event-collector';
import { DateRange, TimeGranularity } from '../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// ETL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const ETL_CONFIG = {
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
// ETL STATUS TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export interface ETLStatus {
  organizationId: string;
  lastFullRun: Date | null;
  lastIncrementalRun: Date | null;
  lastRunStatus: 'success' | 'failed' | 'running' | 'never';
  lastError: string | null;
  recordsProcessed: {
    jobs: number;
    invoices: number;
    payments: number;
    customers: number;
    technicians: number;
    services: number;
  };
}

/**
 * Get ETL status for an organization
 */
export async function getETLStatus(organizationId: string): Promise<ETLStatus> {
  try {
    const redis = await getRedisConnection();
    const statusKey = `${ETL_CONFIG.cacheKeyPrefix}${organizationId}:etl_status`;
    const statusJson = await redis.get(statusKey);

    if (statusJson) {
      const status = JSON.parse(statusJson);
      return {
        ...status,
        lastFullRun: status.lastFullRun ? new Date(status.lastFullRun) : null,
        lastIncrementalRun: status.lastIncrementalRun ? new Date(status.lastIncrementalRun) : null,
      };
    }
  } catch (error) {
    log.warn('Failed to get ETL status', { organizationId, error });
  }

  return {
    organizationId,
    lastFullRun: null,
    lastIncrementalRun: null,
    lastRunStatus: 'never',
    lastError: null,
    recordsProcessed: {
      jobs: 0,
      invoices: 0,
      payments: 0,
      customers: 0,
      technicians: 0,
      services: 0,
    },
  };
}

/**
 * Update ETL status
 */
async function updateETLStatus(
  organizationId: string,
  updates: Partial<ETLStatus>
): Promise<void> {
  try {
    const redis = await getRedisConnection();
    const statusKey = `${ETL_CONFIG.cacheKeyPrefix}${organizationId}:etl_status`;

    const current = await getETLStatus(organizationId);
    const updated = { ...current, ...updates };

    await redis.set(statusKey, JSON.stringify(updated), 'EX', ETL_CONFIG.cacheTTL.daily * 30);
  } catch (error) {
    log.warn('Failed to update ETL status', { organizationId, error });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETL JOBS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run full ETL pipeline for an organization
 */
export async function runFullETL(organizationId: string): Promise<ETLStatus> {
  const startTime = Date.now();
  log.info('Starting full ETL pipeline', { organizationId });

  await updateETLStatus(organizationId, { lastRunStatus: 'running' });

  try {
    // Define date range (last 90 days for raw data)
    const dateRange: DateRange = {
      start: new Date(Date.now() - ETL_CONFIG.retentionDays.raw * 24 * 60 * 60 * 1000),
      end: new Date(),
    };

    // Flush any pending events first
    await flushEvents();

    // Extract and transform facts
    const jobCount = await processJobFacts(organizationId, dateRange);
    const invoiceCount = await processInvoiceFacts(organizationId, dateRange);
    const paymentCount = await processPaymentFacts(organizationId, dateRange);

    // Update dimensions
    const dimensions = await updateDimensions(organizationId);

    // Aggregate metrics for all granularities
    await aggregateAllMetrics(organizationId, dateRange);

    // Update analytics cache
    await updateAnalyticsCache(organizationId);

    const duration = Date.now() - startTime;
    log.info('ETL pipeline completed', { organizationId, durationMs: duration });

    const status: ETLStatus = {
      organizationId,
      lastFullRun: new Date(),
      lastIncrementalRun: null,
      lastRunStatus: 'success',
      lastError: null,
      recordsProcessed: {
        jobs: jobCount,
        invoices: invoiceCount,
        payments: paymentCount,
        customers: dimensions.customers,
        technicians: dimensions.technicians,
        services: dimensions.services,
      },
    };

    await updateETLStatus(organizationId, status);
    return status;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('ETL pipeline failed', { organizationId, error: errorMessage });

    await updateETLStatus(organizationId, {
      lastRunStatus: 'failed',
      lastError: errorMessage,
    });

    throw error;
  }
}

/**
 * Run incremental ETL (last 24 hours)
 */
export async function runIncrementalETL(organizationId: string): Promise<ETLStatus> {
  const startTime = Date.now();
  log.info('Starting incremental ETL', { organizationId });

  await updateETLStatus(organizationId, { lastRunStatus: 'running' });

  try {
    const dateRange: DateRange = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
    };

    // Flush any pending events
    await flushEvents();

    // Process recent facts
    const jobCount = await processJobFacts(organizationId, dateRange);
    const invoiceCount = await processInvoiceFacts(organizationId, dateRange);
    const paymentCount = await processPaymentFacts(organizationId, dateRange);

    // Update cache
    await updateAnalyticsCache(organizationId);

    const duration = Date.now() - startTime;
    log.info('Incremental ETL completed', { organizationId, durationMs: duration });

    const currentStatus = await getETLStatus(organizationId);
    const status: ETLStatus = {
      ...currentStatus,
      lastIncrementalRun: new Date(),
      lastRunStatus: 'success',
      lastError: null,
      recordsProcessed: {
        ...currentStatus.recordsProcessed,
        jobs: currentStatus.recordsProcessed.jobs + jobCount,
        invoices: currentStatus.recordsProcessed.invoices + invoiceCount,
        payments: currentStatus.recordsProcessed.payments + paymentCount,
      },
    };

    await updateETLStatus(organizationId, status);
    return status;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Incremental ETL failed', { organizationId, error: errorMessage });

    await updateETLStatus(organizationId, {
      lastRunStatus: 'failed',
      lastError: errorMessage,
    });

    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACT PROCESSING - Using Redis Time Series Storage
// ═══════════════════════════════════════════════════════════════════════════════

async function processJobFacts(organizationId: string, dateRange: DateRange): Promise<number> {
  const facts = await getJobFacts(organizationId, dateRange);
  const enrichedFacts = await enrichJobFacts(organizationId, facts);

  // Store job metrics in time series
  const points: TimeSeriesPoint[] = [];

  for (const fact of enrichedFacts) {
    const timestamp = fact.createdAt.getTime();

    // Job created metric
    points.push({
      metric: 'jobs_created',
      timestamp,
      value: 1,
      tags: {
        organization_id: organizationId,
        service_type: fact.serviceType,
        status: fact.status,
      },
    });

    // Revenue metric (estimated)
    if (fact.estimatedAmount > 0) {
      points.push({
        metric: 'jobs_estimated_revenue',
        timestamp,
        value: fact.estimatedAmount,
        tags: {
          organization_id: organizationId,
          service_type: fact.serviceType,
        },
      });
    }

    // Actual revenue when completed
    if (fact.status === 'completado' && fact.actualAmount > 0) {
      points.push({
        metric: 'jobs_actual_revenue',
        timestamp: fact.completedAt?.getTime() || timestamp,
        value: fact.actualAmount,
        tags: {
          organization_id: organizationId,
          service_type: fact.serviceType,
        },
      });
    }

    // Duration metric
    if (fact.durationMinutes && fact.durationMinutes > 0) {
      points.push({
        metric: 'job_duration',
        timestamp: fact.completedAt?.getTime() || timestamp,
        value: fact.durationMinutes,
        tags: {
          organization_id: organizationId,
          service_type: fact.serviceType,
        },
      });
    }

    // First-time customer metric
    if (fact.isFirstTimeCustomer) {
      points.push({
        metric: 'first_time_customers',
        timestamp,
        value: 1,
        tags: { organization_id: organizationId },
      });
    }
  }

  if (points.length > 0) {
    await writePoints(points);
  }

  // Store fact summary in Redis hash for quick lookups
  await storeFactSummary(organizationId, 'jobs', {
    total: facts.length,
    completed: facts.filter(f => f.status === 'completado').length,
    dateRange: { start: dateRange.start.toISOString(), end: dateRange.end.toISOString() },
    lastUpdated: new Date().toISOString(),
  });

  log.debug('Processed job facts', { organizationId, count: facts.length, points: points.length });
  return facts.length;
}

async function processInvoiceFacts(organizationId: string, dateRange: DateRange): Promise<number> {
  const facts = await getInvoiceFacts(organizationId, dateRange);
  const points: TimeSeriesPoint[] = [];

  for (const fact of facts) {
    const timestamp = fact.createdAt.getTime();

    // Invoice created metric
    points.push({
      metric: 'invoices_created',
      timestamp,
      value: 1,
      tags: {
        organization_id: organizationId,
        invoice_type: fact.invoiceType,
        status: fact.status,
      },
    });

    // Invoice amount metric
    points.push({
      metric: 'invoice_amount',
      timestamp,
      value: fact.total,
      tags: {
        organization_id: organizationId,
        invoice_type: fact.invoiceType,
      },
    });

    // Paid invoice metrics
    if (fact.paidAt) {
      points.push({
        metric: 'invoices_paid',
        timestamp: fact.paidAt.getTime(),
        value: 1,
        tags: {
          organization_id: organizationId,
          payment_method: fact.paymentMethod || 'unknown',
        },
      });

      points.push({
        metric: 'revenue_collected',
        timestamp: fact.paidAt.getTime(),
        value: fact.total,
        tags: {
          organization_id: organizationId,
          payment_method: fact.paymentMethod || 'unknown',
        },
      });

      // Days to payment metric
      if (fact.daysToPayment !== null) {
        points.push({
          metric: 'days_to_payment',
          timestamp: fact.paidAt.getTime(),
          value: fact.daysToPayment,
          tags: { organization_id: organizationId },
        });
      }
    }
  }

  if (points.length > 0) {
    await writePoints(points);
  }

  await storeFactSummary(organizationId, 'invoices', {
    total: facts.length,
    paid: facts.filter(f => f.paidAt !== null).length,
    totalAmount: facts.reduce((sum, f) => sum + f.total, 0),
    dateRange: { start: dateRange.start.toISOString(), end: dateRange.end.toISOString() },
    lastUpdated: new Date().toISOString(),
  });

  log.debug('Processed invoice facts', { organizationId, count: facts.length, points: points.length });
  return facts.length;
}

async function processPaymentFacts(organizationId: string, dateRange: DateRange): Promise<number> {
  const facts = await getPaymentFacts(organizationId, dateRange);
  const points: TimeSeriesPoint[] = [];

  for (const fact of facts) {
    const timestamp = fact.receivedAt.getTime();

    // Payment received metric
    points.push({
      metric: 'payments_received',
      timestamp,
      value: 1,
      tags: {
        organization_id: organizationId,
        method: fact.method,
      },
    });

    // Payment amount metric
    points.push({
      metric: 'payment_amount',
      timestamp,
      value: fact.amount,
      tags: {
        organization_id: organizationId,
        method: fact.method,
      },
    });

    // Net amount (after fees)
    points.push({
      metric: 'payment_net_amount',
      timestamp,
      value: fact.netAmount,
      tags: {
        organization_id: organizationId,
        method: fact.method,
      },
    });

    // Processing fees
    if (fact.processingFee > 0) {
      points.push({
        metric: 'processing_fees',
        timestamp,
        value: fact.processingFee,
        tags: {
          organization_id: organizationId,
          method: fact.method,
        },
      });
    }
  }

  if (points.length > 0) {
    await writePoints(points);
  }

  await storeFactSummary(organizationId, 'payments', {
    total: facts.length,
    totalAmount: facts.reduce((sum, f) => sum + f.amount, 0),
    totalFees: facts.reduce((sum, f) => sum + f.processingFee, 0),
    dateRange: { start: dateRange.start.toISOString(), end: dateRange.end.toISOString() },
    lastUpdated: new Date().toISOString(),
  });

  log.debug('Processed payment facts', { organizationId, count: facts.length, points: points.length });
  return facts.length;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIMENSION UPDATES - Using Redis Hash Storage
// ═══════════════════════════════════════════════════════════════════════════════

interface DimensionCounts {
  customers: number;
  technicians: number;
  services: number;
}

async function updateDimensions(organizationId: string): Promise<DimensionCounts> {
  const redis = await getRedisConnection();
  const baseKey = `${ETL_CONFIG.cacheKeyPrefix}${organizationId}:dimensions`;

  // Update customer dimensions
  const customers = await getCustomerDimension(organizationId);
  for (const customer of customers) {
    const customerKey = `${baseKey}:customers:${customer.customerId}`;
    await redis.hset(customerKey, {
      data: JSON.stringify(customer),
      updatedAt: new Date().toISOString(),
    });
    await redis.expire(customerKey, ETL_CONFIG.cacheTTL.daily * 7); // Keep for 7 days
  }

  // Store customer segment counts
  const segmentCounts: Record<string, number> = {};
  for (const customer of customers) {
    segmentCounts[customer.segment] = (segmentCounts[customer.segment] || 0) + 1;
  }
  await redis.hset(`${baseKey}:customer_segments`, segmentCounts as Record<string, string>);

  // Update technician dimensions
  const technicians = await getTechnicianDimension(organizationId);
  for (const tech of technicians) {
    const techKey = `${baseKey}:technicians:${tech.technicianId}`;
    await redis.hset(techKey, {
      data: JSON.stringify(tech),
      updatedAt: new Date().toISOString(),
    });
    await redis.expire(techKey, ETL_CONFIG.cacheTTL.daily * 7);
  }

  // Update service dimensions
  const services = await getServiceDimension(organizationId);
  for (const service of services) {
    const serviceKey = `${baseKey}:services:${service.serviceType}`;
    await redis.hset(serviceKey, {
      data: JSON.stringify(service),
      updatedAt: new Date().toISOString(),
    });
    await redis.expire(serviceKey, ETL_CONFIG.cacheTTL.daily * 7);
  }

  // Store dimension summary
  await redis.hset(`${baseKey}:summary`, {
    customerCount: String(customers.length),
    technicianCount: String(technicians.length),
    serviceCount: String(services.length),
    updatedAt: new Date().toISOString(),
  });

  log.debug('Updated dimensions', {
    organizationId,
    customers: customers.length,
    technicians: technicians.length,
    services: services.length,
  });

  return {
    customers: customers.length,
    technicians: technicians.length,
    services: services.length,
  };
}

/**
 * Get cached dimension data
 */
export async function getCachedDimension<T>(
  organizationId: string,
  type: 'customers' | 'technicians' | 'services',
  id: string
): Promise<T | null> {
  try {
    const redis = await getRedisConnection();
    const key = `${ETL_CONFIG.cacheKeyPrefix}${organizationId}:dimensions:${type}:${id}`;
    const result = await redis.hget(key, 'data');
    return result ? JSON.parse(result) : null;
  } catch (error) {
    log.warn('Failed to get cached dimension', { organizationId, type, id, error });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRIC AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════════

async function aggregateAllMetrics(organizationId: string, dateRange: DateRange): Promise<void> {
  const granularities: TimeGranularity[] = ['hour', 'day', 'week', 'month'];

  for (const granularity of granularities) {
    await aggregateMetrics(organizationId, dateRange, granularity);
  }

  log.debug('Aggregated all metrics', { organizationId });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function updateAnalyticsCache(organizationId: string): Promise<void> {
  try {
    const redis = await getRedisConnection();
    const cacheKey = `${ETL_CONFIG.cacheKeyPrefix}${organizationId}:last_update`;
    await redis.set(cacheKey, new Date().toISOString(), 'EX', ETL_CONFIG.cacheTTL.daily);

    // Invalidate any stale query caches
    const stalePattern = `${ETL_CONFIG.cacheKeyPrefix}${organizationId}:query:*`;
    const keys = await redis.keys(stalePattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    log.debug('Updated analytics cache', { organizationId, invalidatedKeys: keys.length });
  } catch (error) {
    log.warn('Failed to update analytics cache', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Get last update time for analytics
 */
export async function getLastAnalyticsUpdate(organizationId: string): Promise<Date | null> {
  try {
    const redis = await getRedisConnection();
    const cacheKey = `${ETL_CONFIG.cacheKeyPrefix}${organizationId}:last_update`;
    const result = await redis.get(cacheKey);
    return result ? new Date(result) : null;
  } catch (error) {
    return null;
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

async function storeFactSummary(
  organizationId: string,
  factType: string,
  summary: Record<string, any>
): Promise<void> {
  try {
    const redis = await getRedisConnection();
    const key = `${ETL_CONFIG.cacheKeyPrefix}${organizationId}:facts:${factType}:summary`;
    await redis.set(key, JSON.stringify(summary), 'EX', ETL_CONFIG.cacheTTL.daily);
  } catch (error) {
    log.warn('Failed to store fact summary', { organizationId, factType, error });
  }
}

/**
 * Get fact summary from cache
 */
export async function getFactSummary(
  organizationId: string,
  factType: string
): Promise<Record<string, any> | null> {
  try {
    const redis = await getRedisConnection();
    const key = `${ETL_CONFIG.cacheKeyPrefix}${organizationId}:facts:${factType}:summary`;
    const result = await redis.get(key);
    return result ? JSON.parse(result) : null;
  } catch (error) {
    return null;
  }
}

/**
 * Clean up old analytics data
 */
export async function cleanupOldData(organizationId: string): Promise<{ deleted: number }> {
  try {
    const redis = await getRedisConnection();
    let deletedCount = 0;

    // Get all analytics keys for this organization
    const pattern = `${ETL_CONFIG.cacheKeyPrefix}${organizationId}:*`;
    const keys = await redis.keys(pattern);

    // Check TTLs and delete expired data (Redis handles this, but we can force cleanup)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ETL_CONFIG.retentionDays.raw);

    for (const key of keys) {
      if (key.includes(':timeseries:')) {
        // Time series data - check if it's old raw data
        const ttl = await redis.ttl(key);
        if (ttl === -1) {
          // No expiry set, check if it's old and set appropriate expiry
          await redis.expire(key, ETL_CONFIG.cacheTTL.daily * 90);
        }
      }
    }

    log.info('Cleanup completed', { organizationId, deletedCount });
    return { deleted: deletedCount };
  } catch (error) {
    log.error('Cleanup failed', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { deleted: 0 };
  }
}
