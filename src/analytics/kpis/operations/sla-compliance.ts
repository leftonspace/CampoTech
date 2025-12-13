/**
 * SLA Compliance Tracker
 * ======================
 *
 * Phase 10.2: Business Intelligence KPIs
 * Service Level Agreement compliance tracking and reporting.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { DateRange, TimeGranularity } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SLADefinition {
  id: string;
  name: string;
  description: string;
  metric: 'response_time' | 'completion_time' | 'first_contact_resolution' | 'on_time_arrival';
  targetValue: number; // Target value (hours for time metrics, percentage for rate metrics)
  urgencyLevel?: 'low' | 'normal' | 'high' | 'emergency';
  serviceType?: string;
}

export interface SLAMetrics {
  overallComplianceRate: number;
  totalJobs: number;
  compliantJobs: number;
  violations: number;
  averagePerformance: number;
  targetValue: number;
  trend: 'improving' | 'declining' | 'stable';
  changePercent: number;
}

export interface SLAByUrgency {
  urgency: string;
  displayName: string;
  complianceRate: number;
  totalJobs: number;
  compliantJobs: number;
  violations: number;
  averageResponseTime: number;
  targetResponseTime: number;
}

export interface SLAByServiceType {
  serviceType: string;
  displayName: string;
  complianceRate: number;
  totalJobs: number;
  compliantJobs: number;
  averageCompletionTime: number;
}

export interface SLAViolation {
  jobId: string;
  jobNumber: string;
  customerName: string;
  slaType: string;
  targetValue: number;
  actualValue: number;
  variance: number;
  violatedAt: Date;
  urgency: string;
}

export interface SLATrend {
  period: string;
  complianceRate: number;
  totalJobs: number;
  violations: number;
  averagePerformance: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT SLA DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_SLAS: SLADefinition[] = [
  {
    id: 'emergency_response',
    name: 'Respuesta Emergencia',
    description: 'Tiempo máximo de respuesta para emergencias',
    metric: 'response_time',
    targetValue: 2, // 2 hours
    urgencyLevel: 'emergency',
  },
  {
    id: 'high_priority_response',
    name: 'Respuesta Alta Prioridad',
    description: 'Tiempo máximo de respuesta para alta prioridad',
    metric: 'response_time',
    targetValue: 4, // 4 hours
    urgencyLevel: 'high',
  },
  {
    id: 'normal_response',
    name: 'Respuesta Normal',
    description: 'Tiempo máximo de respuesta para prioridad normal',
    metric: 'response_time',
    targetValue: 24, // 24 hours
    urgencyLevel: 'normal',
  },
  {
    id: 'low_priority_response',
    name: 'Respuesta Baja Prioridad',
    description: 'Tiempo máximo de respuesta para baja prioridad',
    metric: 'response_time',
    targetValue: 48, // 48 hours
    urgencyLevel: 'low',
  },
  {
    id: 'on_time_arrival',
    name: 'Llegada Puntual',
    description: 'Porcentaje de llegadas dentro del horario programado',
    metric: 'on_time_arrival',
    targetValue: 90, // 90%
  },
  {
    id: 'first_contact_resolution',
    name: 'Resolución Primer Contacto',
    description: 'Porcentaje de trabajos resueltos en primera visita',
    metric: 'first_contact_resolution',
    targetValue: 75, // 75%
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SLA CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate overall SLA compliance metrics
 */
export async function calculateSLACompliance(
  organizationId: string,
  dateRange: DateRange,
  slas: SLADefinition[] = DEFAULT_SLAS
): Promise<SLAMetrics> {
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
      urgency: true,
      serviceType: true,
      createdAt: true,
      scheduledDate: true,
      startedAt: true,
      completedAt: true,
      status: true,
    },
  });

  if (jobs.length === 0) {
    return {
      overallComplianceRate: 100,
      totalJobs: 0,
      compliantJobs: 0,
      violations: 0,
      averagePerformance: 0,
      targetValue: 0,
      trend: 'stable',
      changePercent: 0,
    };
  }

  let compliantJobs = 0;
  let totalResponseTime = 0;
  let jobsWithResponse = 0;

  for (const job of jobs) {
    const urgency = (job.urgency || 'normal').toLowerCase();
    const sla = slas.find(
      (s) => s.metric === 'response_time' && s.urgencyLevel === urgency
    ) || slas.find((s) => s.metric === 'response_time' && s.urgencyLevel === 'normal');

    if (sla && job.startedAt) {
      const responseTime =
        (job.startedAt.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60);
      totalResponseTime += responseTime;
      jobsWithResponse++;

      if (responseTime <= sla.targetValue) {
        compliantJobs++;
      }
    } else if (!job.startedAt && job.status === 'COMPLETED') {
      // Completed without start time - assume compliant
      compliantJobs++;
    }
  }

  const overallComplianceRate = jobs.length > 0 ? (compliantJobs / jobs.length) * 100 : 100;
  const averagePerformance = jobsWithResponse > 0 ? totalResponseTime / jobsWithResponse : 0;

  // Calculate trend from previous period
  const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
  const prevRange = {
    start: new Date(dateRange.start.getTime() - periodLength),
    end: new Date(dateRange.start.getTime() - 1),
  };

  const prevCompliance = await calculatePreviousPeriodCompliance(organizationId, prevRange, slas);
  const changePercent = prevCompliance > 0
    ? ((overallComplianceRate - prevCompliance) / prevCompliance) * 100
    : 0;

  const trend: 'improving' | 'declining' | 'stable' =
    changePercent > 2 ? 'improving' : changePercent < -2 ? 'declining' : 'stable';

  return {
    overallComplianceRate,
    totalJobs: jobs.length,
    compliantJobs,
    violations: jobs.length - compliantJobs,
    averagePerformance,
    targetValue: 24, // Default target
    trend,
    changePercent,
  };
}

/**
 * Calculate compliance for previous period
 */
async function calculatePreviousPeriodCompliance(
  organizationId: string,
  dateRange: DateRange,
  slas: SLADefinition[]
): Promise<number> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      urgency: true,
      createdAt: true,
      startedAt: true,
      status: true,
    },
  });

  if (jobs.length === 0) return 100;

  let compliantJobs = 0;

  for (const job of jobs) {
    const urgency = (job.urgency || 'normal').toLowerCase();
    const sla = slas.find(
      (s) => s.metric === 'response_time' && s.urgencyLevel === urgency
    );

    if (sla && job.startedAt) {
      const responseTime =
        (job.startedAt.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60);
      if (responseTime <= sla.targetValue) {
        compliantJobs++;
      }
    } else if (!job.startedAt && job.status === 'COMPLETED') {
      compliantJobs++;
    }
  }

  return (compliantJobs / jobs.length) * 100;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLA BY URGENCY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get SLA compliance broken down by urgency level
 */
export async function getSLAByUrgency(
  organizationId: string,
  dateRange: DateRange
): Promise<SLAByUrgency[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      urgency: true,
      createdAt: true,
      startedAt: true,
      status: true,
    },
  });

  const urgencyData = new Map<string, {
    total: number;
    compliant: number;
    totalResponseTime: number;
    jobsWithResponse: number;
  }>();

  const urgencyTargets: Record<string, number> = {
    emergency: 2,
    high: 4,
    normal: 24,
    low: 48,
  };

  const urgencyNames: Record<string, string> = {
    emergency: 'Emergencia',
    high: 'Alta',
    normal: 'Normal',
    low: 'Baja',
  };

  for (const job of jobs) {
    const urgency = (job.urgency || 'normal').toLowerCase();
    const current = urgencyData.get(urgency) || {
      total: 0,
      compliant: 0,
      totalResponseTime: 0,
      jobsWithResponse: 0,
    };

    current.total++;

    if (job.startedAt) {
      const responseTime =
        (job.startedAt.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60);
      current.totalResponseTime += responseTime;
      current.jobsWithResponse++;

      const target = urgencyTargets[urgency] || 24;
      if (responseTime <= target) {
        current.compliant++;
      }
    } else if (job.status === 'COMPLETED') {
      current.compliant++;
    }

    urgencyData.set(urgency, current);
  }

  const results: SLAByUrgency[] = [];

  for (const [urgency, data] of urgencyData) {
    results.push({
      urgency,
      displayName: urgencyNames[urgency] || urgency,
      complianceRate: data.total > 0 ? (data.compliant / data.total) * 100 : 100,
      totalJobs: data.total,
      compliantJobs: data.compliant,
      violations: data.total - data.compliant,
      averageResponseTime: data.jobsWithResponse > 0
        ? data.totalResponseTime / data.jobsWithResponse
        : 0,
      targetResponseTime: urgencyTargets[urgency] || 24,
    });
  }

  // Sort by urgency priority
  const urgencyOrder = ['emergency', 'high', 'normal', 'low'];
  return results.sort(
    (a, b) => urgencyOrder.indexOf(a.urgency) - urgencyOrder.indexOf(b.urgency)
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLA BY SERVICE TYPE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get SLA compliance by service type
 */
export async function getSLAByServiceType(
  organizationId: string,
  dateRange: DateRange
): Promise<SLAByServiceType[]> {
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
      createdAt: true,
      startedAt: true,
      completedAt: true,
      urgency: true,
      status: true,
    },
  });

  const serviceData = new Map<string, {
    total: number;
    compliant: number;
    totalCompletionTime: number;
    completedJobs: number;
  }>();

  const serviceNames: Record<string, string> = {
    installation: 'Instalación',
    repair: 'Reparación',
    maintenance: 'Mantenimiento',
    inspection: 'Inspección',
    emergency: 'Emergencia',
    other: 'Otro',
  };

  for (const job of jobs) {
    const serviceType = job.serviceType || 'other';
    const current = serviceData.get(serviceType) || {
      total: 0,
      compliant: 0,
      totalCompletionTime: 0,
      completedJobs: 0,
    };

    current.total++;

    // Check SLA compliance based on response time
    if (job.startedAt) {
      const urgency = (job.urgency || 'normal').toLowerCase();
      const target = { emergency: 2, high: 4, normal: 24, low: 48 }[urgency] || 24;
      const responseTime =
        (job.startedAt.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60);

      if (responseTime <= target) {
        current.compliant++;
      }
    } else if (job.status === 'COMPLETED') {
      current.compliant++;
    }

    // Calculate completion time
    if (job.completedAt && job.startedAt) {
      const completionTime =
        (job.completedAt.getTime() - job.startedAt.getTime()) / (1000 * 60 * 60);
      current.totalCompletionTime += completionTime;
      current.completedJobs++;
    }

    serviceData.set(serviceType, current);
  }

  const results: SLAByServiceType[] = [];

  for (const [serviceType, data] of serviceData) {
    results.push({
      serviceType,
      displayName: serviceNames[serviceType] || serviceType,
      complianceRate: data.total > 0 ? (data.compliant / data.total) * 100 : 100,
      totalJobs: data.total,
      compliantJobs: data.compliant,
      averageCompletionTime: data.completedJobs > 0
        ? data.totalCompletionTime / data.completedJobs
        : 0,
    });
  }

  return results.sort((a, b) => b.complianceRate - a.complianceRate);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLA VIOLATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get list of SLA violations
 */
export async function getSLAViolations(
  organizationId: string,
  dateRange: DateRange,
  limit: number = 50
): Promise<SLAViolation[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      startedAt: { not: null },
    },
    include: {
      customer: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const urgencyTargets: Record<string, number> = {
    emergency: 2,
    high: 4,
    normal: 24,
    low: 48,
  };

  const violations: SLAViolation[] = [];

  for (const job of jobs) {
    if (!job.startedAt) continue;

    const urgency = (job.urgency || 'normal').toLowerCase();
    const target = urgencyTargets[urgency] || 24;
    const responseTime =
      (job.startedAt.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60);

    if (responseTime > target) {
      violations.push({
        jobId: job.id,
        jobNumber: job.jobNumber,
        customerName: job.customer?.name || 'N/A',
        slaType: 'response_time',
        targetValue: target,
        actualValue: responseTime,
        variance: responseTime - target,
        violatedAt: job.startedAt,
        urgency,
      });
    }

    if (violations.length >= limit) break;
  }

  return violations.sort((a, b) => b.variance - a.variance);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLA TRENDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get SLA compliance trend over time
 */
export async function getSLATrend(
  organizationId: string,
  dateRange: DateRange,
  granularity: TimeGranularity = 'week'
): Promise<SLATrend[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      createdAt: true,
      startedAt: true,
      urgency: true,
      status: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const periodData = new Map<string, {
    total: number;
    compliant: number;
    totalResponseTime: number;
    jobsWithResponse: number;
  }>();

  const urgencyTargets: Record<string, number> = {
    emergency: 2,
    high: 4,
    normal: 24,
    low: 48,
  };

  for (const job of jobs) {
    const period = formatPeriod(job.createdAt, granularity);
    const current = periodData.get(period) || {
      total: 0,
      compliant: 0,
      totalResponseTime: 0,
      jobsWithResponse: 0,
    };

    current.total++;

    if (job.startedAt) {
      const urgency = (job.urgency || 'normal').toLowerCase();
      const target = urgencyTargets[urgency] || 24;
      const responseTime =
        (job.startedAt.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60);

      current.totalResponseTime += responseTime;
      current.jobsWithResponse++;

      if (responseTime <= target) {
        current.compliant++;
      }
    } else if (job.status === 'COMPLETED') {
      current.compliant++;
    }

    periodData.set(period, current);
  }

  const sortedPeriods = Array.from(periodData.keys()).sort();

  return sortedPeriods.map((period) => {
    const data = periodData.get(period)!;
    return {
      period,
      complianceRate: data.total > 0 ? (data.compliant / data.total) * 100 : 100,
      totalJobs: data.total,
      violations: data.total - data.compliant,
      averagePerformance: data.jobsWithResponse > 0
        ? data.totalResponseTime / data.jobsWithResponse
        : 0,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate SLA KPIs for dashboard
 */
export async function generateSLAKPIs(
  organizationId: string,
  dateRange: DateRange
): Promise<Array<{
  id: string;
  name: string;
  value: number;
  unit: 'percentage' | 'number' | 'hours';
  trend: 'up' | 'down' | 'stable';
  changePercent?: number;
  description?: string;
  status?: 'good' | 'warning' | 'critical';
}>> {
  const metrics = await calculateSLACompliance(organizationId, dateRange);
  const byUrgency = await getSLAByUrgency(organizationId, dateRange);

  const emergencyCompliance = byUrgency.find((u) => u.urgency === 'emergency');

  // Determine status based on compliance
  const getStatus = (rate: number): 'good' | 'warning' | 'critical' => {
    if (rate >= 90) return 'good';
    if (rate >= 75) return 'warning';
    return 'critical';
  };

  return [
    {
      id: 'sla_compliance',
      name: 'Cumplimiento SLA',
      value: metrics.overallComplianceRate,
      unit: 'percentage',
      trend: metrics.trend === 'improving' ? 'up' : metrics.trend === 'declining' ? 'down' : 'stable',
      changePercent: metrics.changePercent,
      description: 'Porcentaje de trabajos dentro del SLA',
      status: getStatus(metrics.overallComplianceRate),
    },
    {
      id: 'sla_violations',
      name: 'Violaciones SLA',
      value: metrics.violations,
      unit: 'number',
      trend: metrics.violations > 0 ? 'down' : 'stable',
      description: 'Trabajos que excedieron el tiempo de respuesta',
      status: metrics.violations === 0 ? 'good' : metrics.violations < 5 ? 'warning' : 'critical',
    },
    {
      id: 'avg_response_time',
      name: 'Tiempo Respuesta Promedio',
      value: metrics.averagePerformance,
      unit: 'hours',
      trend: 'stable',
      description: 'Tiempo promedio de primera respuesta',
      status: metrics.averagePerformance <= 8 ? 'good' : metrics.averagePerformance <= 24 ? 'warning' : 'critical',
    },
    {
      id: 'emergency_compliance',
      name: 'SLA Emergencias',
      value: emergencyCompliance?.complianceRate || 100,
      unit: 'percentage',
      trend: 'stable',
      description: 'Cumplimiento SLA para emergencias (2h)',
      status: getStatus(emergencyCompliance?.complianceRate || 100),
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
