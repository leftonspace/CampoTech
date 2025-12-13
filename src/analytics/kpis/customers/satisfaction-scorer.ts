/**
 * Customer Satisfaction Scorer
 * ============================
 *
 * Phase 10.2: Business Intelligence KPIs
 * Customer satisfaction metrics and NPS calculation.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { DateRange, TimeGranularity } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SatisfactionMetrics {
  overallScore: number; // 0-100
  nps: number; // -100 to 100
  promoters: number;
  passives: number;
  detractors: number;
  responseRate: number;
  totalResponses: number;
  totalCustomers: number;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

export interface SatisfactionByCategory {
  category: string;
  displayName: string;
  score: number;
  responses: number;
  weight: number;
}

export interface SatisfactionByServiceType {
  serviceType: string;
  displayName: string;
  score: number;
  nps: number;
  responses: number;
  jobCount: number;
}

export interface SatisfactionByTechnician {
  technicianId: string;
  technicianName: string;
  averageScore: number;
  nps: number;
  totalRatings: number;
  jobCount: number;
  trend: 'up' | 'down' | 'stable';
}

export interface SatisfactionTrend {
  period: string;
  score: number;
  nps: number;
  responses: number;
  responseRate: number;
}

export interface CustomerFeedback {
  customerId: string;
  customerName: string;
  jobId: string;
  jobNumber: string;
  score: number;
  npsScore: number;
  category: 'promoter' | 'passive' | 'detractor';
  feedbackDate: Date;
  comment?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SATISFACTION CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate overall customer satisfaction metrics
 * Note: Without actual feedback data, we derive satisfaction from behavioral indicators
 */
export async function calculateSatisfactionMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<SatisfactionMetrics> {
  // Get customers with jobs in the period
  const customers = await db.customer.findMany({
    where: { organizationId },
    include: {
      jobs: {
        where: {
          completedAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        select: {
          id: true,
          status: true,
          completedAt: true,
        },
      },
    },
  });

  // Calculate satisfaction based on behavioral indicators:
  // 1. Repeat business (high = satisfied)
  // 2. Job completion rate
  // 3. No cancellations

  type SatisfactionCustomerType = typeof customers[number];
  type SatisfactionJobType = SatisfactionCustomerType['jobs'][number];

  const customerScores: number[] = [];
  let promoters = 0;
  let passives = 0;
  let detractors = 0;

  for (const customer of customers) {
    const jobCount = customer.jobs.length;
    if (jobCount === 0) continue;

    // Calculate behavioral satisfaction score (0-100)
    const completedJobs = customer.jobs.filter((j: SatisfactionJobType) => j.status === 'COMPLETED').length;
    const cancelledJobs = customer.jobs.filter((j: SatisfactionJobType) => j.status === 'CANCELLED').length;

    const completionRate = jobCount > 0 ? completedJobs / jobCount : 0;
    const cancelRate = jobCount > 0 ? cancelledJobs / jobCount : 0;
    const isRepeatCustomer = jobCount > 1;

    // Score calculation:
    // Base: 50
    // + 30 for high completion rate
    // + 20 for repeat business
    // - 30 for cancellations
    let score = 50;
    score += completionRate * 30;
    if (isRepeatCustomer) score += 20;
    score -= cancelRate * 30;

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));
    customerScores.push(score);

    // NPS categorization (score > 80 = promoter, 60-80 = passive, < 60 = detractor)
    if (score >= 80) {
      promoters++;
    } else if (score >= 60) {
      passives++;
    } else {
      detractors++;
    }
  }

  const totalResponses = customerScores.length;
  const totalCustomers = customers.length;
  const overallScore =
    totalResponses > 0
      ? customerScores.reduce((sum, s) => sum + s, 0) / totalResponses
      : 0;

  // Calculate NPS: (% promoters - % detractors) * 100
  const nps =
    totalResponses > 0
      ? ((promoters - detractors) / totalResponses) * 100
      : 0;

  const responseRate = totalCustomers > 0 ? (totalResponses / totalCustomers) * 100 : 0;

  // Calculate trend from previous period
  const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
  const prevRange = {
    start: new Date(dateRange.start.getTime() - periodLength),
    end: new Date(dateRange.start.getTime() - 1),
  };

  const prevScore = await calculatePreviousPeriodScore(organizationId, prevRange);
  const changePercent = prevScore > 0 ? ((overallScore - prevScore) / prevScore) * 100 : 0;

  const trend: 'up' | 'down' | 'stable' =
    changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable';

  return {
    overallScore,
    nps,
    promoters,
    passives,
    detractors,
    responseRate,
    totalResponses,
    totalCustomers,
    trend,
    changePercent,
  };
}

/**
 * Calculate satisfaction score for previous period
 */
async function calculatePreviousPeriodScore(
  organizationId: string,
  dateRange: DateRange
): Promise<number> {
  const customers = await db.customer.findMany({
    where: { organizationId },
    include: {
      jobs: {
        where: {
          completedAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        select: {
          status: true,
        },
      },
    },
  });

  type PrevCustomerType = typeof customers[number];
  type PrevJobType = PrevCustomerType['jobs'][number];

  const scores: number[] = [];

  for (const customer of customers) {
    const jobCount = customer.jobs.length;
    if (jobCount === 0) continue;

    const completedJobs = customer.jobs.filter((j: PrevJobType) => j.status === 'COMPLETED').length;
    const cancelledJobs = customer.jobs.filter((j: PrevJobType) => j.status === 'CANCELLED').length;

    const completionRate = completedJobs / jobCount;
    const cancelRate = cancelledJobs / jobCount;
    const isRepeatCustomer = jobCount > 1;

    let score = 50 + completionRate * 30;
    if (isRepeatCustomer) score += 20;
    score -= cancelRate * 30;
    score = Math.max(0, Math.min(100, score));

    scores.push(score);
  }

  return scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SATISFACTION BY CATEGORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get satisfaction breakdown by category
 * Categories are derived from job outcomes and behaviors
 */
export async function getSatisfactionByCategory(
  organizationId: string,
  dateRange: DateRange
): Promise<SatisfactionByCategory[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      completedAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      status: true,
      serviceType: true,
      startedAt: true,
      scheduledDate: true,
      completedAt: true,
      urgency: true,
    },
  });

  // Calculate scores for different categories
  const categories = {
    punctuality: { total: 0, satisfied: 0, weight: 25 },
    completion: { total: 0, satisfied: 0, weight: 30 },
    response_time: { total: 0, satisfied: 0, weight: 25 },
    quality: { total: 0, satisfied: 0, weight: 20 },
  };

  for (const job of jobs) {
    // Punctuality (arrived on time)
    if (job.scheduledDate && job.startedAt) {
      categories.punctuality.total++;
      const timeDiff =
        (job.startedAt.getTime() - job.scheduledDate.getTime()) / (1000 * 60);
      if (timeDiff <= 15) {
        // Within 15 minutes
        categories.punctuality.satisfied++;
      }
    }

    // Completion (job was completed, not cancelled)
    categories.completion.total++;
    if (job.status === 'COMPLETED') {
      categories.completion.satisfied++;
    }

    // Response time (based on urgency)
    if (job.startedAt) {
      categories.response_time.total++;
      const urgency = (job.urgency || 'normal').toLowerCase();
      const targetHours: Record<string, number> = {
        emergency: 2,
        high: 4,
        normal: 24,
        low: 48,
      };
      const target = targetHours[urgency] || 24;
      // Assuming createdAt is close to when job was scheduled - simplified check
      categories.response_time.satisfied++; // Simplified - mark as satisfied if started
    }

    // Quality (proxy: job completed without rework)
    if (job.status === 'COMPLETED') {
      categories.quality.total++;
      categories.quality.satisfied++; // Simplified - no rework tracking yet
    }
  }

  const categoryNames: Record<string, string> = {
    punctuality: 'Puntualidad',
    completion: 'Finalización de Trabajos',
    response_time: 'Tiempo de Respuesta',
    quality: 'Calidad del Servicio',
  };

  return Object.entries(categories).map(([key, data]) => ({
    category: key,
    displayName: categoryNames[key] || key,
    score: data.total > 0 ? (data.satisfied / data.total) * 100 : 0,
    responses: data.total,
    weight: data.weight,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SATISFACTION BY SERVICE TYPE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get satisfaction by service type
 */
export async function getSatisfactionByServiceType(
  organizationId: string,
  dateRange: DateRange
): Promise<SatisfactionByServiceType[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      customer: {
        select: { id: true },
      },
    },
  });

  const serviceData = new Map<string, {
    completed: number;
    cancelled: number;
    total: number;
    customers: Set<string>;
    repeatCustomers: number;
  }>();

  // Count jobs per customer to identify repeat customers
  const customerJobCounts = new Map<string, number>();
  for (const job of jobs) {
    if (job.customer?.id) {
      const count = customerJobCounts.get(job.customer.id) || 0;
      customerJobCounts.set(job.customer.id, count + 1);
    }
  }

  for (const job of jobs) {
    const serviceType = job.serviceType || 'other';
    const current = serviceData.get(serviceType) || {
      completed: 0,
      cancelled: 0,
      total: 0,
      customers: new Set(),
      repeatCustomers: 0,
    };

    current.total++;
    if (job.status === 'COMPLETED') current.completed++;
    if (job.status === 'CANCELLED') current.cancelled++;
    if (job.customer?.id) {
      current.customers.add(job.customer.id);
      if ((customerJobCounts.get(job.customer.id) || 0) > 1) {
        current.repeatCustomers++;
      }
    }

    serviceData.set(serviceType, current);
  }

  const serviceNames: Record<string, string> = {
    installation: 'Instalación',
    repair: 'Reparación',
    maintenance: 'Mantenimiento',
    inspection: 'Inspección',
    emergency: 'Emergencia',
    other: 'Otro',
  };

  const results: SatisfactionByServiceType[] = [];

  for (const [serviceType, data] of serviceData) {
    // Calculate score based on completion and repeat rate
    const completionRate = data.total > 0 ? data.completed / data.total : 0;
    const cancelRate = data.total > 0 ? data.cancelled / data.total : 0;
    const repeatRate = data.total > 0 ? data.repeatCustomers / data.total : 0;

    const score = Math.min(
      100,
      50 + completionRate * 30 + repeatRate * 20 - cancelRate * 30
    );

    // Calculate NPS proxy
    const promoterRate = completionRate * 0.4 + repeatRate * 0.6;
    const detractorRate = cancelRate;
    const nps = (promoterRate - detractorRate) * 100;

    results.push({
      serviceType,
      displayName: serviceNames[serviceType] || serviceType,
      score,
      nps,
      responses: data.customers.size,
      jobCount: data.total,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SATISFACTION BY TECHNICIAN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get satisfaction by technician
 */
export async function getSatisfactionByTechnician(
  organizationId: string,
  dateRange: DateRange
): Promise<SatisfactionByTechnician[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      completedAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      technicianId: { not: null },
    },
    include: {
      technician: {
        select: { id: true, name: true },
      },
    },
  });

  const techData = new Map<string, {
    name: string;
    completed: number;
    cancelled: number;
    total: number;
    onTime: number;
    scheduledWithTime: number;
  }>();

  for (const job of jobs) {
    if (!job.technician) continue;

    const current = techData.get(job.technician.id) || {
      name: job.technician.name,
      completed: 0,
      cancelled: 0,
      total: 0,
      onTime: 0,
      scheduledWithTime: 0,
    };

    current.total++;
    if (job.status === 'COMPLETED') current.completed++;
    if (job.status === 'CANCELLED') current.cancelled++;

    if (job.scheduledDate && job.startedAt) {
      current.scheduledWithTime++;
      const timeDiff =
        (job.startedAt.getTime() - job.scheduledDate.getTime()) / (1000 * 60);
      if (timeDiff <= 15) current.onTime++;
    }

    techData.set(job.technician.id, current);
  }

  const results: SatisfactionByTechnician[] = [];

  for (const [techId, data] of techData) {
    const completionRate = data.total > 0 ? data.completed / data.total : 0;
    const cancelRate = data.total > 0 ? data.cancelled / data.total : 0;
    const onTimeRate =
      data.scheduledWithTime > 0 ? data.onTime / data.scheduledWithTime : 1;

    // Calculate score
    const score = Math.min(
      100,
      40 + completionRate * 30 + onTimeRate * 20 - cancelRate * 20
    );

    // Calculate NPS proxy
    const nps = (completionRate * 0.7 + onTimeRate * 0.3 - cancelRate) * 100;

    results.push({
      technicianId: techId,
      technicianName: data.name,
      averageScore: score,
      nps,
      totalRatings: data.total,
      jobCount: data.total,
      trend: 'stable', // Would need historical data for trend
    });
  }

  return results.sort((a, b) => b.averageScore - a.averageScore);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SATISFACTION TRENDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get satisfaction trend over time
 */
export async function getSatisfactionTrend(
  organizationId: string,
  dateRange: DateRange,
  granularity: TimeGranularity = 'month'
): Promise<SatisfactionTrend[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      completedAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      customer: {
        select: { id: true },
      },
    },
    orderBy: { completedAt: 'asc' },
  });

  const periodData = new Map<string, {
    completed: number;
    cancelled: number;
    total: number;
    customers: Set<string>;
    repeatCustomers: Set<string>;
  }>();

  // First pass: count total jobs per customer
  const customerJobCounts = new Map<string, number>();
  for (const job of jobs) {
    if (job.customer?.id) {
      const count = customerJobCounts.get(job.customer.id) || 0;
      customerJobCounts.set(job.customer.id, count + 1);
    }
  }

  // Second pass: group by period
  for (const job of jobs) {
    if (!job.completedAt) continue;

    const period = formatPeriod(job.completedAt, granularity);
    const current = periodData.get(period) || {
      completed: 0,
      cancelled: 0,
      total: 0,
      customers: new Set(),
      repeatCustomers: new Set(),
    };

    current.total++;
    if (job.status === 'COMPLETED') current.completed++;
    if (job.status === 'CANCELLED') current.cancelled++;

    if (job.customer?.id) {
      current.customers.add(job.customer.id);
      if ((customerJobCounts.get(job.customer.id) || 0) > 1) {
        current.repeatCustomers.add(job.customer.id);
      }
    }

    periodData.set(period, current);
  }

  const sortedPeriods = Array.from(periodData.keys()).sort();

  return sortedPeriods.map((period) => {
    const data = periodData.get(period)!;

    const completionRate = data.total > 0 ? data.completed / data.total : 0;
    const cancelRate = data.total > 0 ? data.cancelled / data.total : 0;
    const repeatRate =
      data.customers.size > 0 ? data.repeatCustomers.size / data.customers.size : 0;

    const score = Math.min(100, 50 + completionRate * 30 + repeatRate * 20 - cancelRate * 30);
    const nps = (completionRate * 0.6 + repeatRate * 0.4 - cancelRate) * 100;

    return {
      period,
      score,
      nps,
      responses: data.customers.size,
      responseRate: data.total > 0 ? (data.customers.size / data.total) * 100 : 0,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate satisfaction KPIs for dashboard
 */
export async function generateSatisfactionKPIs(
  organizationId: string,
  dateRange: DateRange
): Promise<Array<{
  id: string;
  name: string;
  value: number;
  unit: 'percentage' | 'number' | 'score';
  trend: 'up' | 'down' | 'stable';
  changePercent?: number;
  description?: string;
  status?: 'good' | 'warning' | 'critical';
}>> {
  const metrics = await calculateSatisfactionMetrics(organizationId, dateRange);
  const byCategory = await getSatisfactionByCategory(organizationId, dateRange);

  // Find lowest category score
  const lowestCategory = byCategory.reduce(
    (min, cat) => (cat.score < min.score ? cat : min),
    { score: 100, displayName: 'N/A' }
  );

  // Status determination
  const getScoreStatus = (score: number): 'good' | 'warning' | 'critical' => {
    if (score >= 80) return 'good';
    if (score >= 60) return 'warning';
    return 'critical';
  };

  const getNPSStatus = (nps: number): 'good' | 'warning' | 'critical' => {
    if (nps >= 50) return 'good';
    if (nps >= 0) return 'warning';
    return 'critical';
  };

  return [
    {
      id: 'satisfaction_score',
      name: 'Satisfacción General',
      value: metrics.overallScore,
      unit: 'score',
      trend: metrics.trend,
      changePercent: metrics.changePercent,
      description: 'Puntuación de satisfacción 0-100',
      status: getScoreStatus(metrics.overallScore),
    },
    {
      id: 'nps',
      name: 'NPS',
      value: metrics.nps,
      unit: 'score',
      trend: metrics.trend,
      description: 'Net Promoter Score (-100 a 100)',
      status: getNPSStatus(metrics.nps),
    },
    {
      id: 'promoters',
      name: 'Promotores',
      value: metrics.promoters,
      unit: 'number',
      trend: 'stable',
      description: 'Clientes muy satisfechos',
    },
    {
      id: 'detractors',
      name: 'Detractores',
      value: metrics.detractors,
      unit: 'number',
      trend: metrics.detractors > 0 ? 'down' : 'stable',
      description: 'Clientes insatisfechos',
      status: metrics.detractors === 0 ? 'good' : metrics.detractors < 5 ? 'warning' : 'critical',
    },
    {
      id: 'lowest_category',
      name: lowestCategory.displayName,
      value: lowestCategory.score,
      unit: 'percentage',
      trend: 'stable',
      description: 'Categoría con menor puntuación',
      status: getScoreStatus(lowestCategory.score),
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
    default:
      return date.toISOString().slice(0, 10);
  }
}
