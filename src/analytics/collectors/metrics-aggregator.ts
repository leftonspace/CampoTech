/**
 * Metrics Aggregator Service
 * ==========================
 *
 * Phase 10.1: Analytics Data Infrastructure
 * Aggregates raw metrics into summarized form for efficient querying.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { getRedisConnection } from '../../lib/redis/client';
import { DateRange, TimeGranularity, AggregatedMetric } from '../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MetricDefinition {
  name: string;
  displayName: string;
  category: 'revenue' | 'operations' | 'customers' | 'efficiency';
  aggregationType: 'sum' | 'average' | 'count' | 'min' | 'max' | 'rate';
  unit: 'currency' | 'number' | 'percentage' | 'duration' | 'days';
  description: string;
}

export interface AggregationOptions {
  organizationId: string;
  metrics: string[];
  dateRange: DateRange;
  granularity: TimeGranularity;
  dimensions?: string[];
  filters?: Record<string, unknown>;
}

export interface AggregatedResult {
  metric: string;
  period: string;
  value: number;
  count: number;
  min: number | null;
  max: number | null;
  average: number | null;
  dimensions?: Record<string, string>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRIC DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // Revenue metrics
  {
    name: 'revenue_total',
    displayName: 'Ingresos Totales',
    category: 'revenue',
    aggregationType: 'sum',
    unit: 'currency',
    description: 'Total de ingresos facturados',
  },
  {
    name: 'revenue_collected',
    displayName: 'Ingresos Cobrados',
    category: 'revenue',
    aggregationType: 'sum',
    unit: 'currency',
    description: 'Total de ingresos efectivamente cobrados',
  },
  {
    name: 'avg_invoice_value',
    displayName: 'Ticket Promedio',
    category: 'revenue',
    aggregationType: 'average',
    unit: 'currency',
    description: 'Valor promedio por factura',
  },
  {
    name: 'collection_rate',
    displayName: 'Tasa de Cobro',
    category: 'revenue',
    aggregationType: 'rate',
    unit: 'percentage',
    description: 'Porcentaje de facturas cobradas vs emitidas',
  },

  // Operations metrics
  {
    name: 'jobs_total',
    displayName: 'Total Trabajos',
    category: 'operations',
    aggregationType: 'count',
    unit: 'number',
    description: 'Número total de trabajos creados',
  },
  {
    name: 'jobs_completed',
    displayName: 'Trabajos Completados',
    category: 'operations',
    aggregationType: 'count',
    unit: 'number',
    description: 'Número de trabajos completados',
  },
  {
    name: 'completion_rate',
    displayName: 'Tasa de Completado',
    category: 'operations',
    aggregationType: 'rate',
    unit: 'percentage',
    description: 'Porcentaje de trabajos completados vs creados',
  },
  {
    name: 'avg_job_duration',
    displayName: 'Duración Promedio',
    category: 'operations',
    aggregationType: 'average',
    unit: 'duration',
    description: 'Duración promedio de trabajos en minutos',
  },

  // Customer metrics
  {
    name: 'unique_customers',
    displayName: 'Clientes Únicos',
    category: 'customers',
    aggregationType: 'count',
    unit: 'number',
    description: 'Número de clientes únicos atendidos',
  },
  {
    name: 'new_customers',
    displayName: 'Clientes Nuevos',
    category: 'customers',
    aggregationType: 'count',
    unit: 'number',
    description: 'Número de clientes nuevos',
  },
  {
    name: 'customer_retention_rate',
    displayName: 'Tasa de Retención',
    category: 'customers',
    aggregationType: 'rate',
    unit: 'percentage',
    description: 'Porcentaje de clientes que repiten',
  },

  // Efficiency metrics
  {
    name: 'active_technicians',
    displayName: 'Técnicos Activos',
    category: 'efficiency',
    aggregationType: 'count',
    unit: 'number',
    description: 'Número de técnicos con trabajos asignados',
  },
  {
    name: 'jobs_per_technician',
    displayName: 'Trabajos por Técnico',
    category: 'efficiency',
    aggregationType: 'average',
    unit: 'number',
    description: 'Promedio de trabajos por técnico',
  },
  {
    name: 'days_sales_outstanding',
    displayName: 'DSO',
    category: 'efficiency',
    aggregationType: 'average',
    unit: 'days',
    description: 'Días promedio para cobrar',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// AGGREGATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Aggregate metrics for the specified options
 */
export async function aggregateMetrics(
  options: AggregationOptions
): Promise<AggregatedResult[]> {
  const results: AggregatedResult[] = [];

  for (const metricName of options.metrics) {
    const definition = METRIC_DEFINITIONS.find((m) => m.name === metricName);
    if (!definition) {
      log.warn('Unknown metric requested', { metricName });
      continue;
    }

    const metricResults = await aggregateMetric(
      options.organizationId,
      definition,
      options.dateRange,
      options.granularity,
      options.dimensions,
      options.filters
    );

    results.push(...metricResults);
  }

  return results;
}

/**
 * Aggregate a single metric
 */
async function aggregateMetric(
  organizationId: string,
  definition: MetricDefinition,
  dateRange: DateRange,
  granularity: TimeGranularity,
  dimensions?: string[],
  filters?: Record<string, unknown>
): Promise<AggregatedResult[]> {
  // First, try to get from cache
  const cached = await getCachedAggregation(
    organizationId,
    definition.name,
    dateRange,
    granularity
  );

  if (cached.length > 0) {
    return cached;
  }

  // Calculate fresh aggregation
  let results: AggregatedResult[];

  switch (definition.category) {
    case 'revenue':
      results = await aggregateRevenueMetric(
        organizationId,
        definition.name,
        dateRange,
        granularity
      );
      break;
    case 'operations':
      results = await aggregateOperationsMetric(
        organizationId,
        definition.name,
        dateRange,
        granularity
      );
      break;
    case 'customers':
      results = await aggregateCustomerMetric(
        organizationId,
        definition.name,
        dateRange,
        granularity
      );
      break;
    case 'efficiency':
      results = await aggregateEfficiencyMetric(
        organizationId,
        definition.name,
        dateRange,
        granularity
      );
      break;
    default:
      results = [];
  }

  // Cache the results
  await cacheAggregation(results, granularity);

  return results;
}

/**
 * Aggregate revenue metrics
 */
async function aggregateRevenueMetric(
  organizationId: string,
  metricName: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): Promise<AggregatedResult[]> {
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

  const aggregated = new Map<string, {
    total: number;
    collected: number;
    count: number;
    values: number[];
  }>();

  for (const invoice of invoices) {
    const period = formatPeriod(invoice.createdAt, granularity);
    const current = aggregated.get(period) || {
      total: 0,
      collected: 0,
      count: 0,
      values: [],
    };

    const invoiceTotal = invoice.total.toNumber();
    current.total += invoiceTotal;
    current.count++;
    current.values.push(invoiceTotal);

    if (invoice.status === 'PAID') {
      current.collected += invoiceTotal;
    }

    aggregated.set(period, current);
  }

  const results: AggregatedResult[] = [];

  for (const [period, data] of aggregated) {
    let value: number;
    let average: number | null = null;
    let min: number | null = null;
    let max: number | null = null;

    switch (metricName) {
      case 'revenue_total':
        value = data.total;
        break;
      case 'revenue_collected':
        value = data.collected;
        break;
      case 'avg_invoice_value':
        value = data.count > 0 ? data.total / data.count : 0;
        average = value;
        min = data.values.length > 0 ? Math.min(...data.values) : null;
        max = data.values.length > 0 ? Math.max(...data.values) : null;
        break;
      case 'collection_rate':
        value = data.total > 0 ? (data.collected / data.total) * 100 : 0;
        break;
      default:
        value = 0;
    }

    results.push({
      metric: metricName,
      period,
      value,
      count: data.count,
      min,
      max,
      average,
    });
  }

  return results;
}

/**
 * Aggregate operations metrics
 */
async function aggregateOperationsMetric(
  organizationId: string,
  metricName: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): Promise<AggregatedResult[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
  });

  const aggregated = new Map<string, {
    total: number;
    completed: number;
    cancelled: number;
    durations: number[];
  }>();

  for (const job of jobs) {
    const period = formatPeriod(job.createdAt, granularity);
    const current = aggregated.get(period) || {
      total: 0,
      completed: 0,
      cancelled: 0,
      durations: [],
    };

    current.total++;
    if (job.status === 'COMPLETED') current.completed++;
    if (job.status === 'CANCELLED') current.cancelled++;
    if (job.actualDuration) current.durations.push(job.actualDuration);

    aggregated.set(period, current);
  }

  const results: AggregatedResult[] = [];

  for (const [period, data] of aggregated) {
    let value: number;
    let average: number | null = null;
    let min: number | null = null;
    let max: number | null = null;

    switch (metricName) {
      case 'jobs_total':
        value = data.total;
        break;
      case 'jobs_completed':
        value = data.completed;
        break;
      case 'jobs_cancelled':
        value = data.cancelled;
        break;
      case 'completion_rate':
        value = data.total > 0 ? (data.completed / data.total) * 100 : 0;
        break;
      case 'cancellation_rate':
        value = data.total > 0 ? (data.cancelled / data.total) * 100 : 0;
        break;
      case 'avg_job_duration':
        if (data.durations.length > 0) {
          value = data.durations.reduce((a, b) => a + b, 0) / data.durations.length;
          average = value;
          min = Math.min(...data.durations);
          max = Math.max(...data.durations);
        } else {
          value = 0;
        }
        break;
      default:
        value = 0;
    }

    results.push({
      metric: metricName,
      period,
      value,
      count: data.total,
      min,
      max,
      average,
    });
  }

  return results;
}

/**
 * Aggregate customer metrics
 */
async function aggregateCustomerMetric(
  organizationId: string,
  metricName: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): Promise<AggregatedResult[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      customerId: true,
      createdAt: true,
    },
  });

  // Get first job for each customer
  const firstJobDates = new Map<string, Date>();
  const allCustomerJobs = await db.job.groupBy({
    by: ['customerId'],
    where: { organizationId },
    _min: { createdAt: true },
  });

  for (const cj of allCustomerJobs) {
    if (cj._min.createdAt) {
      firstJobDates.set(cj.customerId, cj._min.createdAt);
    }
  }

  const aggregated = new Map<string, {
    uniqueCustomers: Set<string>;
    newCustomers: Set<string>;
    totalJobs: number;
  }>();

  for (const job of jobs) {
    const period = formatPeriod(job.createdAt, granularity);
    const current = aggregated.get(period) || {
      uniqueCustomers: new Set(),
      newCustomers: new Set(),
      totalJobs: 0,
    };

    current.uniqueCustomers.add(job.customerId);
    current.totalJobs++;

    // Check if new customer in this period
    const firstJob = firstJobDates.get(job.customerId);
    if (firstJob) {
      const firstJobPeriod = formatPeriod(firstJob, granularity);
      if (firstJobPeriod === period) {
        current.newCustomers.add(job.customerId);
      }
    }

    aggregated.set(period, current);
  }

  const results: AggregatedResult[] = [];

  for (const [period, data] of aggregated) {
    let value: number;

    switch (metricName) {
      case 'unique_customers':
        value = data.uniqueCustomers.size;
        break;
      case 'new_customers':
        value = data.newCustomers.size;
        break;
      case 'customer_retention_rate':
        const returning = data.uniqueCustomers.size - data.newCustomers.size;
        value = data.uniqueCustomers.size > 0
          ? (returning / data.uniqueCustomers.size) * 100
          : 0;
        break;
      default:
        value = 0;
    }

    results.push({
      metric: metricName,
      period,
      value,
      count: data.totalJobs,
      min: null,
      max: null,
      average: null,
    });
  }

  return results;
}

/**
 * Aggregate efficiency metrics
 */
async function aggregateEfficiencyMetric(
  organizationId: string,
  metricName: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): Promise<AggregatedResult[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      technicianId: true,
      createdAt: true,
    },
  });

  const aggregated = new Map<string, {
    technicians: Set<string>;
    jobCount: number;
  }>();

  for (const job of jobs) {
    const period = formatPeriod(job.createdAt, granularity);
    const current = aggregated.get(period) || {
      technicians: new Set(),
      jobCount: 0,
    };

    if (job.technicianId) {
      current.technicians.add(job.technicianId);
    }
    current.jobCount++;

    aggregated.set(period, current);
  }

  // For DSO, need invoice data
  let invoiceData: Map<string, number[]> | null = null;
  if (metricName === 'days_sales_outstanding') {
    invoiceData = new Map();
    const invoices = await db.invoice.findMany({
      where: {
        organizationId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
        status: 'PAID',
      },
      include: { payments: true },
    });

    for (const invoice of invoices) {
      const period = formatPeriod(invoice.createdAt, granularity);
      const current = invoiceData.get(period) || [];

      if (invoice.payments.length > 0 && invoice.payments[0].paidAt) {
        const days = Math.ceil(
          (invoice.payments[0].paidAt.getTime() - invoice.createdAt.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        current.push(days);
        invoiceData.set(period, current);
      }
    }
  }

  const results: AggregatedResult[] = [];

  for (const [period, data] of aggregated) {
    let value: number;
    let average: number | null = null;
    let min: number | null = null;
    let max: number | null = null;

    switch (metricName) {
      case 'active_technicians':
        value = data.technicians.size;
        break;
      case 'jobs_per_technician':
        value = data.technicians.size > 0 ? data.jobCount / data.technicians.size : 0;
        average = value;
        break;
      case 'days_sales_outstanding':
        const dsoValues = invoiceData?.get(period) || [];
        if (dsoValues.length > 0) {
          value = dsoValues.reduce((a, b) => a + b, 0) / dsoValues.length;
          average = value;
          min = Math.min(...dsoValues);
          max = Math.max(...dsoValues);
        } else {
          value = 0;
        }
        break;
      default:
        value = 0;
    }

    results.push({
      metric: metricName,
      period,
      value,
      count: data.jobCount,
      min,
      max,
      average,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHING
// ═══════════════════════════════════════════════════════════════════════════════

async function getCachedAggregation(
  organizationId: string,
  metricName: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): Promise<AggregatedResult[]> {
  try {
    const redis = await getRedisConnection();
    const cacheKey = buildCacheKey(organizationId, metricName, dateRange, granularity);
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    log.debug('Cache miss or error', { error: error instanceof Error ? error.message : 'Unknown' });
  }

  return [];
}

async function cacheAggregation(
  results: AggregatedResult[],
  granularity: TimeGranularity
): Promise<void> {
  if (results.length === 0) return;

  try {
    const redis = await getRedisConnection();

    // Cache TTL based on granularity
    const ttl = granularity === 'hour' ? 300 : granularity === 'day' ? 3600 : 86400;

    for (const result of results) {
      const key = `analytics:agg:${result.metric}:${granularity}:${result.period}`;
      await redis.setex(key, ttl, JSON.stringify(result));
    }
  } catch (error) {
    log.debug('Failed to cache aggregation', { error: error instanceof Error ? error.message : 'Unknown' });
  }
}

function buildCacheKey(
  organizationId: string,
  metricName: string,
  dateRange: DateRange,
  granularity: TimeGranularity
): string {
  const startKey = dateRange.start.toISOString().slice(0, 10);
  const endKey = dateRange.end.toISOString().slice(0, 10);
  return `analytics:cache:${organizationId}:${metricName}:${granularity}:${startKey}:${endKey}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatPeriod(date: Date, granularity: TimeGranularity): string {
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

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export function getMetricDefinition(name: string): MetricDefinition | undefined {
  return METRIC_DEFINITIONS.find((m) => m.name === name);
}

export function getMetricsByCategory(category: MetricDefinition['category']): MetricDefinition[] {
  return METRIC_DEFINITIONS.filter((m) => m.category === category);
}

export function getAllMetricNames(): string[] {
  return METRIC_DEFINITIONS.map((m) => m.name);
}
