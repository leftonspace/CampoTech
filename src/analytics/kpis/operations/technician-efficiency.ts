/**
 * Technician Efficiency Calculator
 * =================================
 *
 * Phase 10.2: Business Intelligence KPIs
 * Performance metrics for technicians and field staff.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { DateRange, KPIResult } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TechnicianPerformance {
  technicianId: string;
  name: string;
  totalJobs: number;
  completedJobs: number;
  cancelledJobs: number;
  completionRate: number;
  averageDuration: number;
  totalRevenue: number;
  averageJobValue: number;
  efficiency: number; // Jobs per working day
  utilizationRate: number; // Percentage of available time spent working
  onTimeRate: number;
  firstTimeFixRate: number;
}

export interface TeamEfficiency {
  totalTechnicians: number;
  activeTechnicians: number;
  avgCompletionRate: number;
  avgJobsPerTech: number;
  avgRevenuePerTech: number;
  topPerformerId: string | null;
  topPerformerName: string | null;
  improvementNeeded: string[];
}

export interface TechnicianRanking {
  technicianId: string;
  name: string;
  rank: number;
  score: number;
  metrics: {
    completionRate: number;
    efficiency: number;
    avgJobValue: number;
    onTimeRate: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDIVIDUAL TECHNICIAN METRICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate performance metrics for a single technician
 */
export async function calculateTechnicianPerformance(
  organizationId: string,
  technicianId: string,
  dateRange: DateRange
): Promise<TechnicianPerformance> {
  // Get technician details
  const technician = await db.user.findFirst({
    where: {
      id: technicianId,
      organizationId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!technician) {
    throw new Error('Technician not found');
  }

  // Get jobs assigned to technician
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      technicianId: technicianId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      id: true,
      status: true,
      scheduledDate: true,
      startedAt: true,
      completedAt: true,
      invoice: {
        select: { total: true },
      },
    },
  });

  type TechJobType = typeof jobs[number];

  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j: TechJobType) => j.status === 'COMPLETED').length;
  const cancelledJobs = jobs.filter((j: TechJobType) => j.status === 'CANCELLED').length;
  const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

  // Calculate average duration
  const jobsWithDuration = jobs.filter((j: TechJobType) => j.startedAt && j.completedAt);
  const totalDuration = jobsWithDuration.reduce((sum: number, j: TechJobType) => {
    return sum + (j.completedAt!.getTime() - j.startedAt!.getTime());
  }, 0);
  const averageDuration = jobsWithDuration.length > 0
    ? totalDuration / jobsWithDuration.length / (1000 * 60)
    : 0;

  // Calculate revenue
  const totalRevenue = jobs.reduce((sum: number, j: TechJobType) => sum + (j.invoice?.total?.toNumber() || 0), 0);
  const averageJobValue = completedJobs > 0 ? totalRevenue / completedJobs : 0;

  // Calculate efficiency (jobs per working day)
  const workingDays = calculateWorkingDays(dateRange.start, dateRange.end);
  const efficiency = workingDays > 0 ? completedJobs / workingDays : 0;

  // Calculate utilization rate (assuming 8 hour work days)
  const totalWorkMinutes = workingDays * 8 * 60;
  const workedMinutes = jobsWithDuration.reduce((sum: number, j: TechJobType) => {
    return sum + (j.completedAt!.getTime() - j.startedAt!.getTime()) / (1000 * 60);
  }, 0);
  const utilizationRate = totalWorkMinutes > 0 ? (workedMinutes / totalWorkMinutes) * 100 : 0;

  // Calculate on-time rate
  const scheduledJobs = jobs.filter((j: TechJobType) => j.scheduledDate && j.completedAt);
  const onTimeJobs = scheduledJobs.filter((j: TechJobType) => {
    const scheduledEnd = new Date(j.scheduledDate!.getTime() + 2 * 60 * 60 * 1000);
    return j.completedAt! <= scheduledEnd;
  });
  const onTimeRate = scheduledJobs.length > 0 ? (onTimeJobs.length / scheduledJobs.length) * 100 : 0;

  // First time fix rate (jobs completed without follow-up visits)
  // Simplified: assume all completed jobs are first-time fixes for now
  const firstTimeFixRate = completionRate;

  return {
    technicianId: technician.id,
    name: technician.name,
    totalJobs,
    completedJobs,
    cancelledJobs,
    completionRate,
    averageDuration,
    totalRevenue,
    averageJobValue,
    efficiency,
    utilizationRate,
    onTimeRate,
    firstTimeFixRate,
  };
}

/**
 * Get performance for all technicians
 */
export async function getAllTechnicianPerformance(
  organizationId: string,
  dateRange: DateRange
): Promise<TechnicianPerformance[]> {
  const technicians = await db.user.findMany({
    where: {
      organizationId,
      role: { in: ['TECHNICIAN', 'ADMIN', 'OWNER'] },
    },
    select: {
      id: true,
    },
  });

  const performances: TechnicianPerformance[] = [];

  for (const tech of technicians) {
    try {
      const performance = await calculateTechnicianPerformance(
        organizationId,
        tech.id,
        dateRange
      );
      performances.push(performance);
    } catch (err) {
      log.error('Error calculating technician performance', { technicianId: tech.id, error: err });
    }
  }

  return performances.sort((a, b) => b.completedJobs - a.completedJobs);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM EFFICIENCY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate overall team efficiency metrics
 */
export async function calculateTeamEfficiency(
  organizationId: string,
  dateRange: DateRange
): Promise<TeamEfficiency> {
  const performances = await getAllTechnicianPerformance(organizationId, dateRange);

  const totalTechnicians = performances.length;
  const activeTechnicians = performances.filter((p) => p.totalJobs > 0).length;

  if (activeTechnicians === 0) {
    return {
      totalTechnicians,
      activeTechnicians: 0,
      avgCompletionRate: 0,
      avgJobsPerTech: 0,
      avgRevenuePerTech: 0,
      topPerformerId: null,
      topPerformerName: null,
      improvementNeeded: [],
    };
  }

  const activePerformances = performances.filter((p) => p.totalJobs > 0);

  const avgCompletionRate =
    activePerformances.reduce((sum, p) => sum + p.completionRate, 0) / activeTechnicians;

  const avgJobsPerTech =
    activePerformances.reduce((sum, p) => sum + p.completedJobs, 0) / activeTechnicians;

  const avgRevenuePerTech =
    activePerformances.reduce((sum, p) => sum + p.totalRevenue, 0) / activeTechnicians;

  // Find top performer based on composite score
  const rankings = calculateTechnicianRankings(activePerformances);
  const topPerformer = rankings[0] || null;

  // Identify technicians needing improvement (below average in key metrics)
  const improvementNeeded = activePerformances
    .filter((p) => p.completionRate < avgCompletionRate - 10 || p.efficiency < avgJobsPerTech / 2)
    .map((p) => p.technicianId);

  return {
    totalTechnicians,
    activeTechnicians,
    avgCompletionRate,
    avgJobsPerTech,
    avgRevenuePerTech,
    topPerformerId: topPerformer?.technicianId || null,
    topPerformerName: topPerformer?.name || null,
    improvementNeeded,
  };
}

/**
 * Calculate technician rankings based on composite score
 */
export function calculateTechnicianRankings(
  performances: TechnicianPerformance[]
): TechnicianRanking[] {
  // Normalize metrics and calculate composite score
  const maxCompletionRate = Math.max(...performances.map((p) => p.completionRate), 1);
  const maxEfficiency = Math.max(...performances.map((p) => p.efficiency), 1);
  const maxJobValue = Math.max(...performances.map((p) => p.averageJobValue), 1);
  const maxOnTimeRate = Math.max(...performances.map((p) => p.onTimeRate), 1);

  const rankings = performances.map((p) => {
    // Weighted composite score
    const score =
      (p.completionRate / maxCompletionRate) * 0.3 +
      (p.efficiency / maxEfficiency) * 0.25 +
      (p.averageJobValue / maxJobValue) * 0.25 +
      (p.onTimeRate / maxOnTimeRate) * 0.2;

    return {
      technicianId: p.technicianId,
      name: p.name,
      rank: 0,
      score: score * 100,
      metrics: {
        completionRate: p.completionRate,
        efficiency: p.efficiency,
        avgJobValue: p.averageJobValue,
        onTimeRate: p.onTimeRate,
      },
    };
  });

  // Sort by score and assign ranks
  rankings.sort((a, b) => b.score - a.score);
  rankings.forEach((r, i) => {
    r.rank = i + 1;
  });

  return rankings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARATIVE ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compare technician performance across periods
 */
export async function compareTechnicianPerformance(
  organizationId: string,
  technicianId: string,
  currentRange: DateRange,
  previousRange: DateRange
): Promise<{
  current: TechnicianPerformance;
  previous: TechnicianPerformance;
  changes: {
    completionRate: number;
    efficiency: number;
    avgJobValue: number;
    totalRevenue: number;
  };
}> {
  const [current, previous] = await Promise.all([
    calculateTechnicianPerformance(organizationId, technicianId, currentRange),
    calculateTechnicianPerformance(organizationId, technicianId, previousRange),
  ]);

  return {
    current,
    previous,
    changes: {
      completionRate: current.completionRate - previous.completionRate,
      efficiency: previous.efficiency > 0
        ? ((current.efficiency - previous.efficiency) / previous.efficiency) * 100
        : 0,
      avgJobValue: previous.averageJobValue > 0
        ? ((current.averageJobValue - previous.averageJobValue) / previous.averageJobValue) * 100
        : 0,
      totalRevenue: previous.totalRevenue > 0
        ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100
        : 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate technician efficiency KPIs for dashboard
 */
export async function generateTechnicianKPIs(
  organizationId: string,
  dateRange: DateRange
): Promise<KPIResult[]> {
  const teamEfficiency = await calculateTeamEfficiency(organizationId, dateRange);

  return [
    {
      id: 'active_technicians',
      name: 'Técnicos Activos',
      value: teamEfficiency.activeTechnicians,
      unit: 'number',
      trend: 'stable',
      period: dateRange,
    },
    {
      id: 'avg_completion_rate',
      name: 'Tasa Completado Promedio',
      value: teamEfficiency.avgCompletionRate,
      unit: 'percentage',
      trend: teamEfficiency.avgCompletionRate >= 85 ? 'up' : teamEfficiency.avgCompletionRate >= 70 ? 'stable' : 'down',
      period: dateRange,
    },
    {
      id: 'avg_jobs_per_tech',
      name: 'Trabajos por Técnico',
      value: teamEfficiency.avgJobsPerTech,
      unit: 'number',
      trend: 'stable',
      period: dateRange,
    },
    {
      id: 'avg_revenue_per_tech',
      name: 'Ingreso por Técnico',
      value: teamEfficiency.avgRevenuePerTech,
      unit: 'currency',
      trend: 'stable',
      period: dateRange,
    },
    {
      id: 'improvement_needed_count',
      name: 'Técnicos a Mejorar',
      value: teamEfficiency.improvementNeeded.length,
      unit: 'number',
      trend: teamEfficiency.improvementNeeded.length === 0 ? 'up' : 'down',
      period: dateRange,
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // Exclude weekends
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}
