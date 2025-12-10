/**
 * Location Comparison Analytics
 * =============================
 *
 * Phase 11.6: Location Analytics
 * Cross-location comparison and benchmarking.
 */

import { db } from '../../lib/db';
import { DateRange } from '../analytics.types';
import { calculateLocationKPIs, LocationKPIs } from './location-performance';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LocationComparisonReport {
  period: DateRange;
  organizationSummary: {
    totalLocations: number;
    activeLocations: number;
    totalRevenue: number;
    totalJobs: number;
    avgCompletionRate: number;
    avgUtilization: number;
  };
  locations: LocationComparisonEntry[];
  rankings: LocationRankings;
  insights: ComparisonInsight[];
}

export interface LocationComparisonEntry {
  locationId: string;
  locationName: string;
  locationCode: string;
  type: string;
  isHeadquarters: boolean;

  // Core metrics
  revenue: number;
  revenueShare: number;
  revenueTrend: number;
  jobs: number;
  jobsShare: number;
  completedJobs: number;
  completionRate: number;
  cancellationRate: number;

  // Efficiency
  avgJobDuration: number;
  avgResponseTime: number;
  onTimeRate: number;
  utilization: number;

  // Team
  technicianCount: number;
  avgJobsPerTechnician: number;

  // Customers
  customersServed: number;
  newCustomers: number;

  // Performance score (0-100)
  performanceScore: number;

  // Comparison to organization average
  vsOrgAvg: {
    revenue: number;
    completionRate: number;
    utilization: number;
    avgJobDuration: number;
  };
}

export interface LocationRankings {
  byRevenue: RankingEntry[];
  byJobs: RankingEntry[];
  byCompletionRate: RankingEntry[];
  byEfficiency: RankingEntry[];
  byGrowth: RankingEntry[];
  overall: RankingEntry[];
}

export interface RankingEntry {
  rank: number;
  locationId: string;
  locationName: string;
  value: number;
  change?: number;
}

export interface ComparisonInsight {
  type: 'positive' | 'negative' | 'neutral';
  category: 'revenue' | 'operations' | 'efficiency' | 'team' | 'growth';
  title: string;
  description: string;
  locationId?: string;
  locationName?: string;
  value?: number;
  recommendation?: string;
}

export interface LocationBenchmark {
  metric: string;
  organizationAvg: number;
  organizationBest: number;
  organizationWorst: number;
  industryAvg?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARISON CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate comprehensive location comparison report
 */
export async function generateLocationComparisonReport(
  organizationId: string,
  dateRange: DateRange
): Promise<LocationComparisonReport> {
  // Get all active locations
  const locations = await db.location.findMany({
    where: { organizationId, isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      isHeadquarters: true,
    },
  });

  if (locations.length === 0) {
    return {
      period: dateRange,
      organizationSummary: {
        totalLocations: 0,
        activeLocations: 0,
        totalRevenue: 0,
        totalJobs: 0,
        avgCompletionRate: 0,
        avgUtilization: 0,
      },
      locations: [],
      rankings: {
        byRevenue: [],
        byJobs: [],
        byCompletionRate: [],
        byEfficiency: [],
        byGrowth: [],
        overall: [],
      },
      insights: [],
    };
  }

  // Calculate KPIs for each location
  const locationKPIs: Map<string, LocationKPIs> = new Map();
  for (const location of locations) {
    const kpis = await calculateLocationKPIs(organizationId, location.id, dateRange);
    locationKPIs.set(location.id, kpis);
  }

  // Calculate organization totals and averages
  let totalRevenue = 0;
  let totalJobs = 0;
  let totalCompletedJobs = 0;
  let totalUtilization = 0;

  for (const kpis of locationKPIs.values()) {
    totalRevenue += kpis.revenue.total;
    totalJobs += kpis.jobs.total;
    totalCompletedJobs += kpis.jobs.completed;
    totalUtilization += kpis.efficiency.utilization;
  }

  const avgCompletionRate = totalJobs > 0 ? (totalCompletedJobs / totalJobs) * 100 : 0;
  const avgUtilization = locations.length > 0 ? totalUtilization / locations.length : 0;

  // Build comparison entries
  const entries: LocationComparisonEntry[] = [];

  for (const location of locations) {
    const kpis = locationKPIs.get(location.id)!;

    // Calculate performance score (weighted average of key metrics)
    const performanceScore = calculatePerformanceScore({
      completionRate: kpis.jobs.completionRate,
      utilization: kpis.efficiency.utilization,
      onTimeRate: kpis.efficiency.onTimeRate,
      revenueTrend: kpis.revenue.trend,
    });

    entries.push({
      locationId: location.id,
      locationName: location.name,
      locationCode: location.code,
      type: location.type,
      isHeadquarters: location.isHeadquarters,

      revenue: kpis.revenue.total,
      revenueShare: totalRevenue > 0 ? (kpis.revenue.total / totalRevenue) * 100 : 0,
      revenueTrend: kpis.revenue.trend,
      jobs: kpis.jobs.total,
      jobsShare: totalJobs > 0 ? (kpis.jobs.total / totalJobs) * 100 : 0,
      completedJobs: kpis.jobs.completed,
      completionRate: kpis.jobs.completionRate,
      cancellationRate: kpis.jobs.cancellationRate,

      avgJobDuration: kpis.efficiency.avgJobDuration,
      avgResponseTime: kpis.efficiency.avgResponseTime,
      onTimeRate: kpis.efficiency.onTimeRate,
      utilization: kpis.efficiency.utilization,

      technicianCount: kpis.team.technicianCount,
      avgJobsPerTechnician: kpis.team.avgJobsPerTechnician,

      customersServed: kpis.customers.totalServed,
      newCustomers: kpis.customers.newCustomers,

      performanceScore,

      vsOrgAvg: {
        revenue: totalRevenue > 0
          ? ((kpis.revenue.total - (totalRevenue / locations.length)) / (totalRevenue / locations.length)) * 100
          : 0,
        completionRate: avgCompletionRate > 0
          ? kpis.jobs.completionRate - avgCompletionRate
          : 0,
        utilization: avgUtilization > 0
          ? kpis.efficiency.utilization - avgUtilization
          : 0,
        avgJobDuration: 0, // Would need org avg calculation
      },
    });
  }

  // Generate rankings
  const rankings = generateRankings(entries);

  // Generate insights
  const insights = generateInsights(entries, {
    totalRevenue,
    avgCompletionRate,
    avgUtilization,
  });

  return {
    period: dateRange,
    organizationSummary: {
      totalLocations: locations.length,
      activeLocations: locations.length,
      totalRevenue,
      totalJobs,
      avgCompletionRate,
      avgUtilization,
    },
    locations: entries.sort((a, b) => b.revenue - a.revenue),
    rankings,
    insights,
  };
}

/**
 * Get location benchmarks
 */
export async function getLocationBenchmarks(
  organizationId: string,
  dateRange: DateRange
): Promise<LocationBenchmark[]> {
  const report = await generateLocationComparisonReport(organizationId, dateRange);

  if (report.locations.length === 0) {
    return [];
  }

  const entries = report.locations;

  return [
    {
      metric: 'Revenue',
      organizationAvg: report.organizationSummary.totalRevenue / entries.length,
      organizationBest: Math.max(...entries.map((e) => e.revenue)),
      organizationWorst: Math.min(...entries.map((e) => e.revenue)),
    },
    {
      metric: 'Completion Rate',
      organizationAvg: report.organizationSummary.avgCompletionRate,
      organizationBest: Math.max(...entries.map((e) => e.completionRate)),
      organizationWorst: Math.min(...entries.map((e) => e.completionRate)),
    },
    {
      metric: 'Utilization',
      organizationAvg: report.organizationSummary.avgUtilization,
      organizationBest: Math.max(...entries.map((e) => e.utilization)),
      organizationWorst: Math.min(...entries.map((e) => e.utilization)),
    },
    {
      metric: 'Jobs per Technician',
      organizationAvg: entries.reduce((sum, e) => sum + e.avgJobsPerTechnician, 0) / entries.length,
      organizationBest: Math.max(...entries.map((e) => e.avgJobsPerTechnician)),
      organizationWorst: Math.min(...entries.map((e) => e.avgJobsPerTechnician)),
    },
    {
      metric: 'On-Time Rate',
      organizationAvg: entries.reduce((sum, e) => sum + e.onTimeRate, 0) / entries.length,
      organizationBest: Math.max(...entries.map((e) => e.onTimeRate)),
      organizationWorst: Math.min(...entries.map((e) => e.onTimeRate)),
    },
  ];
}

/**
 * Compare two specific locations
 */
export async function compareLocations(
  organizationId: string,
  locationId1: string,
  locationId2: string,
  dateRange: DateRange
): Promise<{
  location1: LocationComparisonEntry;
  location2: LocationComparisonEntry;
  differences: Array<{
    metric: string;
    location1Value: number;
    location2Value: number;
    difference: number;
    winner: 'location1' | 'location2' | 'tie';
  }>;
}> {
  const report = await generateLocationComparisonReport(organizationId, dateRange);

  const location1 = report.locations.find((l) => l.locationId === locationId1);
  const location2 = report.locations.find((l) => l.locationId === locationId2);

  if (!location1 || !location2) {
    throw new Error('One or both locations not found');
  }

  const differences = [
    {
      metric: 'Revenue',
      location1Value: location1.revenue,
      location2Value: location2.revenue,
      difference: location1.revenue - location2.revenue,
      winner: (location1.revenue > location2.revenue ? 'location1' : location1.revenue < location2.revenue ? 'location2' : 'tie') as 'location1' | 'location2' | 'tie',
    },
    {
      metric: 'Jobs Completed',
      location1Value: location1.completedJobs,
      location2Value: location2.completedJobs,
      difference: location1.completedJobs - location2.completedJobs,
      winner: (location1.completedJobs > location2.completedJobs ? 'location1' : location1.completedJobs < location2.completedJobs ? 'location2' : 'tie') as 'location1' | 'location2' | 'tie',
    },
    {
      metric: 'Completion Rate',
      location1Value: location1.completionRate,
      location2Value: location2.completionRate,
      difference: location1.completionRate - location2.completionRate,
      winner: (location1.completionRate > location2.completionRate ? 'location1' : location1.completionRate < location2.completionRate ? 'location2' : 'tie') as 'location1' | 'location2' | 'tie',
    },
    {
      metric: 'Utilization',
      location1Value: location1.utilization,
      location2Value: location2.utilization,
      difference: location1.utilization - location2.utilization,
      winner: (location1.utilization > location2.utilization ? 'location1' : location1.utilization < location2.utilization ? 'location2' : 'tie') as 'location1' | 'location2' | 'tie',
    },
    {
      metric: 'Avg Job Duration (lower is better)',
      location1Value: location1.avgJobDuration,
      location2Value: location2.avgJobDuration,
      difference: location1.avgJobDuration - location2.avgJobDuration,
      winner: (location1.avgJobDuration < location2.avgJobDuration ? 'location1' : location1.avgJobDuration > location2.avgJobDuration ? 'location2' : 'tie') as 'location1' | 'location2' | 'tie',
    },
    {
      metric: 'On-Time Rate',
      location1Value: location1.onTimeRate,
      location2Value: location2.onTimeRate,
      difference: location1.onTimeRate - location2.onTimeRate,
      winner: (location1.onTimeRate > location2.onTimeRate ? 'location1' : location1.onTimeRate < location2.onTimeRate ? 'location2' : 'tie') as 'location1' | 'location2' | 'tie',
    },
    {
      metric: 'Performance Score',
      location1Value: location1.performanceScore,
      location2Value: location2.performanceScore,
      difference: location1.performanceScore - location2.performanceScore,
      winner: (location1.performanceScore > location2.performanceScore ? 'location1' : location1.performanceScore < location2.performanceScore ? 'location2' : 'tie') as 'location1' | 'location2' | 'tie',
    },
  ];

  return { location1, location2, differences };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function calculatePerformanceScore(metrics: {
  completionRate: number;
  utilization: number;
  onTimeRate: number;
  revenueTrend: number;
}): number {
  // Weighted scoring
  const weights = {
    completionRate: 0.30,
    utilization: 0.25,
    onTimeRate: 0.25,
    revenueTrend: 0.20,
  };

  // Normalize metrics to 0-100 scale
  const normalized = {
    completionRate: Math.min(100, metrics.completionRate),
    utilization: Math.min(100, metrics.utilization),
    onTimeRate: Math.min(100, metrics.onTimeRate),
    revenueTrend: Math.max(0, Math.min(100, 50 + metrics.revenueTrend)), // Center at 50, adjust by trend
  };

  return (
    normalized.completionRate * weights.completionRate +
    normalized.utilization * weights.utilization +
    normalized.onTimeRate * weights.onTimeRate +
    normalized.revenueTrend * weights.revenueTrend
  );
}

function generateRankings(entries: LocationComparisonEntry[]): LocationRankings {
  const sortAndRank = (
    arr: LocationComparisonEntry[],
    getValue: (e: LocationComparisonEntry) => number,
    ascending = false
  ): RankingEntry[] => {
    const sorted = [...arr].sort((a, b) =>
      ascending ? getValue(a) - getValue(b) : getValue(b) - getValue(a)
    );
    return sorted.map((e, index) => ({
      rank: index + 1,
      locationId: e.locationId,
      locationName: e.locationName,
      value: getValue(e),
    }));
  };

  return {
    byRevenue: sortAndRank(entries, (e) => e.revenue),
    byJobs: sortAndRank(entries, (e) => e.jobs),
    byCompletionRate: sortAndRank(entries, (e) => e.completionRate),
    byEfficiency: sortAndRank(entries, (e) => e.avgJobDuration, true), // Lower is better
    byGrowth: sortAndRank(entries, (e) => e.revenueTrend),
    overall: sortAndRank(entries, (e) => e.performanceScore),
  };
}

function generateInsights(
  entries: LocationComparisonEntry[],
  orgAvg: { totalRevenue: number; avgCompletionRate: number; avgUtilization: number }
): ComparisonInsight[] {
  const insights: ComparisonInsight[] = [];

  // Top performer
  const topByScore = [...entries].sort((a, b) => b.performanceScore - a.performanceScore)[0];
  if (topByScore) {
    insights.push({
      type: 'positive',
      category: 'operations',
      title: 'Mejor rendimiento general',
      description: `${topByScore.locationName} lidera con un puntaje de rendimiento de ${topByScore.performanceScore.toFixed(1)}`,
      locationId: topByScore.locationId,
      locationName: topByScore.locationName,
      value: topByScore.performanceScore,
    });
  }

  // Highest growth
  const topGrowth = [...entries].sort((a, b) => b.revenueTrend - a.revenueTrend)[0];
  if (topGrowth && topGrowth.revenueTrend > 5) {
    insights.push({
      type: 'positive',
      category: 'growth',
      title: 'Mayor crecimiento',
      description: `${topGrowth.locationName} muestra un crecimiento de ${topGrowth.revenueTrend.toFixed(1)}% en ingresos`,
      locationId: topGrowth.locationId,
      locationName: topGrowth.locationName,
      value: topGrowth.revenueTrend,
    });
  }

  // Underperforming locations
  const underperforming = entries.filter(
    (e) => e.completionRate < orgAvg.avgCompletionRate - 10 || e.utilization < orgAvg.avgUtilization - 15
  );
  for (const loc of underperforming.slice(0, 2)) {
    insights.push({
      type: 'negative',
      category: 'operations',
      title: 'Bajo rendimiento',
      description: `${loc.locationName} está por debajo del promedio de la organización`,
      locationId: loc.locationId,
      locationName: loc.locationName,
      recommendation: 'Revisar asignación de técnicos y procesos operativos',
    });
  }

  // High cancellation rate
  const highCancellation = entries.filter((e) => e.cancellationRate > 15);
  for (const loc of highCancellation.slice(0, 2)) {
    insights.push({
      type: 'negative',
      category: 'operations',
      title: 'Alta tasa de cancelación',
      description: `${loc.locationName} tiene ${loc.cancellationRate.toFixed(1)}% de cancelaciones`,
      locationId: loc.locationId,
      locationName: loc.locationName,
      value: loc.cancellationRate,
      recommendation: 'Analizar causas de cancelación y mejorar comunicación con clientes',
    });
  }

  // Understaffed locations
  const understaffed = entries.filter(
    (e) => e.utilization > 85 && e.avgJobsPerTechnician > 5
  );
  for (const loc of understaffed.slice(0, 2)) {
    insights.push({
      type: 'neutral',
      category: 'team',
      title: 'Alta carga de trabajo',
      description: `${loc.locationName} opera al ${loc.utilization.toFixed(1)}% de capacidad`,
      locationId: loc.locationId,
      locationName: loc.locationName,
      value: loc.utilization,
      recommendation: 'Considerar agregar técnicos adicionales',
    });
  }

  // Revenue concentration
  const revenueConcentration = entries.filter((e) => e.revenueShare > 40);
  if (revenueConcentration.length > 0) {
    insights.push({
      type: 'neutral',
      category: 'revenue',
      title: 'Concentración de ingresos',
      description: `${revenueConcentration[0].locationName} genera ${revenueConcentration[0].revenueShare.toFixed(1)}% de los ingresos totales`,
      locationId: revenueConcentration[0].locationId,
      locationName: revenueConcentration[0].locationName,
      value: revenueConcentration[0].revenueShare,
      recommendation: 'Diversificar operaciones para reducir riesgo',
    });
  }

  return insights;
}
