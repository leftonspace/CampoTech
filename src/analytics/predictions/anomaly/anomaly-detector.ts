/**
 * Anomaly Detector
 * ================
 *
 * Phase 10.5: Predictive Analytics
 * Detects unusual patterns and anomalies in business metrics.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { Anomaly } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  summary: {
    totalAnomalies: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
  metricBaselines: MetricBaseline[];
}

export interface MetricBaseline {
  metric: string;
  mean: number;
  stdDev: number;
  upperThreshold: number;
  lowerThreshold: number;
}

type MetricType = 'revenue' | 'jobs' | 'cancellations' | 'response_time' | 'completion_rate';

// ═══════════════════════════════════════════════════════════════════════════════
// ANOMALY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect anomalies across all business metrics
 */
export async function detectAnomalies(
  organizationId: string
): Promise<AnomalyDetectionResult> {
  const anomalies: Anomaly[] = [];

  // Detect anomalies in each metric category
  const [
    revenueAnomalies,
    jobAnomalies,
    cancellationAnomalies,
    responseTimeAnomalies,
  ] = await Promise.all([
    detectRevenueAnomalies(organizationId),
    detectJobAnomalies(organizationId),
    detectCancellationAnomalies(organizationId),
    detectResponseTimeAnomalies(organizationId),
  ]);

  anomalies.push(
    ...revenueAnomalies,
    ...jobAnomalies,
    ...cancellationAnomalies,
    ...responseTimeAnomalies
  );

  // Sort by severity and date
  anomalies.sort((a: typeof anomalies[number], b: typeof anomalies[number]) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.detectedAt.getTime() - a.detectedAt.getTime();
  });

  // Calculate summary
  const summary = {
    totalAnomalies: anomalies.length,
    criticalCount: anomalies.filter((a: typeof anomalies[number]) => a.severity === 'critical').length,
    warningCount: anomalies.filter((a: typeof anomalies[number]) => a.severity === 'warning').length,
    infoCount: anomalies.filter((a: typeof anomalies[number]) => a.severity === 'info').length,
  };

  // Get metric baselines
  const metricBaselines = await getMetricBaselines(organizationId);

  return { anomalies, summary, metricBaselines };
}

/**
 * Detect revenue anomalies
 */
async function detectRevenueAnomalies(organizationId: string): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const now = new Date();

  // Get daily revenue for last 60 days
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: { gte: sixtyDaysAgo },
    },
    select: {
      total: true,
      createdAt: true,
    },
  });

  // Group by date
  const dailyRevenue = groupByDate(invoices, 'createdAt', 'total');

  // Calculate statistics
  const values = Object.values(dailyRevenue);
  const { mean, stdDev } = calculateStats(values);

  // Check last 7 days for anomalies
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const [date, revenue] of Object.entries(dailyRevenue) as [string, number][]) {
    const dateObj = new Date(date);
    if (dateObj < sevenDaysAgo) continue;

    const zScore = stdDev > 0 ? (revenue - mean) / stdDev : 0;

    if (zScore > 3 || zScore < -3) {
      anomalies.push({
        id: `rev_${date}`,
        type: 'revenue',
        severity: Math.abs(zScore) > 4 ? 'critical' : 'warning',
        metric: 'daily_revenue',
        expectedValue: mean,
        actualValue: revenue,
        deviation: zScore,
        detectedAt: dateObj,
        description: zScore > 0
          ? `Ingreso inusualmente alto (${formatCurrency(revenue)} vs ${formatCurrency(mean)} esperado)`
          : `Ingreso inusualmente bajo (${formatCurrency(revenue)} vs ${formatCurrency(mean)} esperado)`,
        possibleCauses: zScore > 0
          ? ['Pago de facturas atrasadas', 'Gran trabajo completado', 'Error de registro']
          : ['Día no laborable', 'Problema operativo', 'Pérdida de clientes'],
      });
    }
  }

  return anomalies;
}

/**
 * Detect job volume anomalies
 */
async function detectJobAnomalies(organizationId: string): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const now = new Date();

  // Get daily jobs for last 60 days
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: { gte: sixtyDaysAgo },
    },
    select: {
      createdAt: true,
    },
  });

  // Group by date
  const dailyCounts = groupByDateCount(jobs, 'createdAt');

  // Calculate statistics
  const values = Object.values(dailyCounts);
  const { mean, stdDev } = calculateStats(values);

  // Check last 7 days for anomalies
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const [date, count] of Object.entries(dailyCounts) as [string, number][]) {
    const dateObj = new Date(date);
    if (dateObj < sevenDaysAgo) continue;

    const zScore = stdDev > 0 ? (count - mean) / stdDev : 0;

    if (zScore < -2.5) {
      anomalies.push({
        id: `job_${date}`,
        type: 'operational',
        severity: zScore < -3.5 ? 'warning' : 'info',
        metric: 'daily_jobs',
        expectedValue: mean,
        actualValue: count,
        deviation: zScore,
        detectedAt: dateObj,
        description: `Volumen de trabajos bajo (${count} vs ${Math.round(mean)} esperado)`,
        possibleCauses: ['Fin de semana', 'Feriado', 'Problema de demanda', 'Estacionalidad'],
      });
    } else if (zScore > 3) {
      anomalies.push({
        id: `job_${date}`,
        type: 'operational',
        severity: 'info',
        metric: 'daily_jobs',
        expectedValue: mean,
        actualValue: count,
        deviation: zScore,
        detectedAt: dateObj,
        description: `Pico de demanda (${count} trabajos vs ${Math.round(mean)} esperado)`,
        possibleCauses: ['Campaña promocional', 'Emergencia', 'Estacionalidad alta'],
      });
    }
  }

  return anomalies;
}

/**
 * Detect cancellation rate anomalies
 */
async function detectCancellationAnomalies(organizationId: string): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const now = new Date();

  // Get daily cancellations for last 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: { gte: thirtyDaysAgo },
    },
    select: {
      status: true,
      createdAt: true,
    },
  });

  // Group by date and calculate cancellation rate
  const dateStats = new Map<string, { total: number; cancelled: number }>();

  for (const job of jobs) {
    const date = job.createdAt.toISOString().slice(0, 10);
    const current = dateStats.get(date) || { total: 0, cancelled: 0 };
    current.total++;
    if (job.status === 'CANCELLED') current.cancelled++;
    dateStats.set(date, current);
  }

  // Calculate daily cancellation rates
  const dailyRates: number[] = [];
  const rateByDate = new Map<string, number>();

  for (const [date, stats] of dateStats) {
    const rate = stats.total > 0 ? stats.cancelled / stats.total : 0;
    dailyRates.push(rate);
    rateByDate.set(date, rate);
  }

  // Calculate statistics
  const { mean, stdDev } = calculateStats(dailyRates);

  // Check for high cancellation days
  for (const [date, rate] of rateByDate as Map<string, number>) {
    const dateObj = new Date(date);
    const stats = dateStats.get(date)!;

    // Only flag if significant volume
    if (stats.total < 3) continue;

    const zScore = stdDev > 0 ? (rate - mean) / stdDev : 0;

    if (rate > 0.3 && zScore > 2) {
      anomalies.push({
        id: `cancel_${date}`,
        type: 'operational',
        severity: rate > 0.5 ? 'critical' : 'warning',
        metric: 'cancellation_rate',
        expectedValue: mean * 100,
        actualValue: rate * 100,
        deviation: zScore,
        detectedAt: dateObj,
        description: `Alta tasa de cancelación (${(rate * 100).toFixed(0)}% vs ${(mean * 100).toFixed(0)}% esperado)`,
        possibleCauses: ['Problema de servicio', 'Cliente insatisfecho', 'Sobreventa de capacidad'],
      });
    }
  }

  return anomalies;
}

/**
 * Detect response time anomalies
 */
async function detectResponseTimeAnomalies(organizationId: string): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const now = new Date();

  // Get jobs with actual start times from last 14 days
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: { gte: fourteenDaysAgo },
      startedAt: { not: null },
    },
    select: {
      createdAt: true,
      startedAt: true,
    },
  });

  // Calculate response times (in hours)
  const responseTimes = jobs.map((job: typeof jobs[number]) => {
    const created = job.createdAt.getTime();
    const started = job.startedAt!.getTime();
    return (started - created) / (1000 * 60 * 60);
  });

  if (responseTimes.length < 10) return anomalies;

  // Calculate statistics
  const { mean, stdDev } = calculateStats(responseTimes);

  // Check for recent slow responses
  const recentJobs = jobs.slice(-10);
  const avgRecentResponse = recentJobs.reduce((sum: number, job: typeof recentJobs[number]) => {
    const created = job.createdAt.getTime();
    const started = job.startedAt!.getTime();
    return sum + (started - created) / (1000 * 60 * 60);
  }, 0) / recentJobs.length;

  const zScore = stdDev > 0 ? (avgRecentResponse - mean) / stdDev : 0;

  if (zScore > 2) {
    anomalies.push({
      id: `response_${now.toISOString().slice(0, 10)}`,
      type: 'operational',
      severity: zScore > 3 ? 'warning' : 'info',
      metric: 'response_time',
      expectedValue: mean,
      actualValue: avgRecentResponse,
      deviation: zScore,
      detectedAt: now,
      description: `Tiempo de respuesta elevado (${avgRecentResponse.toFixed(1)} hrs vs ${mean.toFixed(1)} hrs esperado)`,
      possibleCauses: ['Falta de capacidad', 'Alta demanda', 'Problemas de programación'],
    });
  }

  return anomalies;
}

/**
 * Get metric baselines
 */
async function getMetricBaselines(organizationId: string): Promise<MetricBaseline[]> {
  const baselines: MetricBaseline[] = [];
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  // Revenue baseline
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: { gte: sixtyDaysAgo },
    },
    select: { total: true, createdAt: true },
  });

  const dailyRevenue = Object.values(groupByDate(invoices, 'createdAt', 'total'));
  const revStats = calculateStats(dailyRevenue);
  baselines.push({
    metric: 'daily_revenue',
    mean: revStats.mean,
    stdDev: revStats.stdDev,
    upperThreshold: revStats.mean + 3 * revStats.stdDev,
    lowerThreshold: Math.max(0, revStats.mean - 3 * revStats.stdDev),
  });

  // Jobs baseline
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: { gte: sixtyDaysAgo },
    },
    select: { createdAt: true },
  });

  const dailyJobs = Object.values(groupByDateCount(jobs, 'createdAt'));
  const jobStats = calculateStats(dailyJobs);
  baselines.push({
    metric: 'daily_jobs',
    mean: jobStats.mean,
    stdDev: jobStats.stdDev,
    upperThreshold: jobStats.mean + 3 * jobStats.stdDev,
    lowerThreshold: Math.max(0, jobStats.mean - 3 * jobStats.stdDev),
  });

  return baselines;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function groupByDate<T extends Record<string, any>>(
  items: T[],
  dateField: keyof T,
  valueField: keyof T
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const item of items) {
    const date = (item[dateField] as Date).toISOString().slice(0, 10);
    const value = (item[valueField] as { toNumber(): number })?.toNumber() || 0;
    result[date] = (result[date] || 0) + value;
  }

  return result;
}

function groupByDateCount<T extends Record<string, any>>(
  items: T[],
  dateField: keyof T
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const item of items) {
    const date = (item[dateField] as Date).toISOString().slice(0, 10);
    result[date] = (result[date] || 0) + 1;
  }

  return result;
}

function calculateStats(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };

  const mean = values.reduce((sum: number, v: number) => sum + v, 0) / values.length;
  const variance = values.reduce((sum: number, v: number) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(value);
}
