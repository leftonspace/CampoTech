/**
 * Revenue Projector
 * =================
 *
 * Phase 10.5: Predictive Analytics
 * Projects future revenue based on trends and patterns.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RevenueProjection {
  period: string;
  projectedRevenue: number;
  confidence: number;
  lowerBound: number;
  upperBound: number;
  assumptions: string[];
}

export interface GrowthScenario {
  name: 'pessimistic' | 'baseline' | 'optimistic';
  growthRate: number;
  projections: RevenueProjection[];
}

export interface ProjectionResult {
  scenarios: GrowthScenario[];
  currentMRR: number;
  historicalGrowthRate: number;
  factors: ProjectionFactor[];
}

export interface ProjectionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVENUE PROJECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Project revenue for the next N months
 */
export async function projectRevenue(
  organizationId: string,
  monthsAhead: number = 12
): Promise<ProjectionResult> {
  // Get historical revenue data
  const historicalData = await getHistoricalRevenueData(organizationId);

  // Calculate current MRR and growth rate
  const currentMRR = calculateCurrentMRR(historicalData);
  const historicalGrowthRate = calculateGrowthRate(historicalData);

  // Identify projection factors
  const factors = await identifyProjectionFactors(organizationId, historicalData);

  // Generate scenarios
  const scenarios = generateScenarios(
    currentMRR,
    historicalGrowthRate,
    monthsAhead,
    factors
  );

  return {
    scenarios,
    currentMRR,
    historicalGrowthRate,
    factors,
  };
}

/**
 * Get historical revenue data
 */
async function getHistoricalRevenueData(organizationId: string): Promise<{
  month: string;
  revenue: number;
}[]> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: { gte: oneYearAgo },
      status: 'PAID',
    },
    select: {
      total: true,
      createdAt: true,
    },
  });

  // Group by month
  const monthMap = new Map<string, number>();

  for (const invoice of invoices) {
    const month = invoice.createdAt.toISOString().slice(0, 7);
    const current = monthMap.get(month) || 0;
    monthMap.set(month, current + (invoice.total?.toNumber() || 0));
  }

  // Sort by month
  return Array.from(monthMap.entries())
    .map(([month, revenue]) => ({ month, revenue }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Calculate current MRR
 */
function calculateCurrentMRR(data: { month: string; revenue: number }[]): number {
  if (data.length === 0) return 0;

  // Use last 3 months average as MRR estimate
  const recentMonths = data.slice(-3);
  return recentMonths.reduce((sum, d) => sum + d.revenue, 0) / recentMonths.length;
}

/**
 * Calculate historical growth rate
 */
function calculateGrowthRate(data: { month: string; revenue: number }[]): number {
  if (data.length < 2) return 0;

  // Calculate month-over-month growth rates
  const growthRates: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1].revenue;
    const curr = data[i].revenue;
    if (prev > 0) {
      growthRates.push((curr - prev) / prev);
    }
  }

  // Return average growth rate
  return growthRates.length > 0
    ? growthRates.reduce((sum, r) => sum + r, 0) / growthRates.length
    : 0;
}

/**
 * Identify factors affecting revenue projections
 */
async function identifyProjectionFactors(
  organizationId: string,
  historicalData: { month: string; revenue: number }[]
): Promise<ProjectionFactor[]> {
  const factors: ProjectionFactor[] = [];

  // Growth trend
  const growthRate = calculateGrowthRate(historicalData);
  if (growthRate > 0.05) {
    factors.push({
      name: 'Tendencia de crecimiento',
      impact: 'positive',
      weight: 0.3,
      description: `Crecimiento mensual promedio de ${(growthRate * 100).toFixed(1)}%`,
    });
  } else if (growthRate < -0.05) {
    factors.push({
      name: 'Tendencia de declive',
      impact: 'negative',
      weight: 0.3,
      description: `Decrecimiento mensual promedio de ${(Math.abs(growthRate) * 100).toFixed(1)}%`,
    });
  }

  // Customer base
  const customerCount = await db.customer.count({
    where: { organizationId },
  });

  const activeCustomers = await db.customer.count({
    where: {
      organizationId,
      jobs: {
        some: {
          completedAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
      },
    },
  });

  const activeRate = customerCount > 0 ? activeCustomers / customerCount : 0;
  if (activeRate > 0.5) {
    factors.push({
      name: 'Base de clientes activa',
      impact: 'positive',
      weight: 0.2,
      description: `${(activeRate * 100).toFixed(0)}% de clientes activos en los últimos 90 días`,
    });
  } else if (activeRate < 0.3) {
    factors.push({
      name: 'Baja actividad de clientes',
      impact: 'negative',
      weight: 0.2,
      description: `Solo ${(activeRate * 100).toFixed(0)}% de clientes activos`,
    });
  }

  // Seasonality
  if (historicalData.length >= 12) {
    const variance = calculateVariance(historicalData.map((d) => d.revenue));
    const mean = historicalData.reduce((sum, d) => sum + d.revenue, 0) / historicalData.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

    if (cv > 0.3) {
      factors.push({
        name: 'Alta estacionalidad',
        impact: 'neutral',
        weight: 0.15,
        description: 'Los ingresos muestran variación estacional significativa',
      });
    }
  }

  // Collection rate
  const totalInvoiced = await db.invoice.aggregate({
    where: {
      organizationId,
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
    _sum: { total: true },
  });

  const totalCollected = await db.payment.aggregate({
    where: {
      organizationId,
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
    _sum: { amount: true },
  });

  const invoiced = totalInvoiced._sum.total?.toNumber() || 0;
  const collected = totalCollected._sum.amount?.toNumber() || 0;
  const collectionRate = invoiced > 0 ? collected / invoiced : 0;

  if (collectionRate > 0.9) {
    factors.push({
      name: 'Alta tasa de cobro',
      impact: 'positive',
      weight: 0.15,
      description: `Tasa de cobro del ${(collectionRate * 100).toFixed(0)}%`,
    });
  } else if (collectionRate < 0.7) {
    factors.push({
      name: 'Baja tasa de cobro',
      impact: 'negative',
      weight: 0.2,
      description: `Tasa de cobro del ${(collectionRate * 100).toFixed(0)}%`,
    });
  }

  return factors;
}

/**
 * Generate projection scenarios
 */
function generateScenarios(
  currentMRR: number,
  historicalGrowthRate: number,
  monthsAhead: number,
  factors: ProjectionFactor[]
): GrowthScenario[] {
  // Adjust growth rates based on factors
  const factorAdjustment = factors.reduce((adj, f) => {
    const impact = f.impact === 'positive' ? 0.02 : f.impact === 'negative' ? -0.02 : 0;
    return adj + impact * f.weight;
  }, 0);

  const baseGrowthRate = Math.max(-0.1, Math.min(0.3, historicalGrowthRate + factorAdjustment));

  // Define scenario parameters
  const scenarios: GrowthScenario[] = [
    {
      name: 'pessimistic',
      growthRate: Math.max(-0.05, baseGrowthRate - 0.03),
      projections: [],
    },
    {
      name: 'baseline',
      growthRate: baseGrowthRate,
      projections: [],
    },
    {
      name: 'optimistic',
      growthRate: Math.min(0.2, baseGrowthRate + 0.03),
      projections: [],
    },
  ];

  // Generate projections for each scenario
  const today = new Date();

  for (const scenario of scenarios) {
    let projectedMRR = currentMRR;

    for (let i = 1; i <= monthsAhead; i++) {
      const futureDate = new Date(today);
      futureDate.setMonth(today.getMonth() + i);
      const period = futureDate.toISOString().slice(0, 7);

      // Apply growth
      projectedMRR *= 1 + scenario.growthRate;

      // Calculate confidence (decreases over time)
      const confidence = Math.max(0.5, 0.95 - i * 0.03);

      // Calculate bounds
      const uncertainty = currentMRR * 0.1 * Math.sqrt(i);
      const lowerBound = Math.max(0, projectedMRR - uncertainty);
      const upperBound = projectedMRR + uncertainty;

      scenario.projections.push({
        period,
        projectedRevenue: Math.round(projectedMRR),
        confidence,
        lowerBound: Math.round(lowerBound),
        upperBound: Math.round(upperBound),
        assumptions: getScenarioAssumptions(scenario.name),
      });
    }
  }

  return scenarios;
}

/**
 * Get assumptions for each scenario
 */
function getScenarioAssumptions(scenario: 'pessimistic' | 'baseline' | 'optimistic'): string[] {
  switch (scenario) {
    case 'pessimistic':
      return [
        'Contracción del mercado',
        'Pérdida de clientes existentes',
        'Mayor competencia',
      ];
    case 'baseline':
      return [
        'Continuación de tendencias actuales',
        'Sin cambios significativos en el mercado',
        'Retención estable de clientes',
      ];
    case 'optimistic':
      return [
        'Expansión de mercado',
        'Adquisición de nuevos clientes',
        'Aumento de ticket promedio',
      ];
  }
}

/**
 * Calculate variance
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}

/**
 * Get revenue milestone projections
 */
export async function getRevenueMilestones(
  organizationId: string,
  targetRevenue: number
): Promise<{
  milestone: number;
  pessimisticDate: string | null;
  baselineDate: string | null;
  optimisticDate: string | null;
}> {
  const result = await projectRevenue(organizationId, 24);

  const findMilestoneDate = (
    projections: RevenueProjection[],
    target: number
  ): string | null => {
    const milestone = projections.find((p) => p.projectedRevenue >= target);
    return milestone?.period || null;
  };

  const pessimistic = result.scenarios.find((s) => s.name === 'pessimistic');
  const baseline = result.scenarios.find((s) => s.name === 'baseline');
  const optimistic = result.scenarios.find((s) => s.name === 'optimistic');

  return {
    milestone: targetRevenue,
    pessimisticDate: pessimistic
      ? findMilestoneDate(pessimistic.projections, targetRevenue)
      : null,
    baselineDate: baseline
      ? findMilestoneDate(baseline.projections, targetRevenue)
      : null,
    optimisticDate: optimistic
      ? findMilestoneDate(optimistic.projections, targetRevenue)
      : null,
  };
}
