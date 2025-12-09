/**
 * Churn Predictor
 * ===============
 *
 * Phase 10.5: Predictive Analytics
 * Predicts customer churn risk based on behavior patterns.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { ChurnRiskScore } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChurnPrediction {
  customerId: string;
  customerName: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: ChurnFactor[];
  predictedChurnDate: Date | null;
  recommendedActions: string[];
  potentialRevenueLoss: number;
}

export interface ChurnFactor {
  name: string;
  weight: number;
  value: number;
  maxValue: number;
  description: string;
}

export interface ChurnAnalysis {
  predictions: ChurnPrediction[];
  summary: {
    totalAtRisk: number;
    highRiskCount: number;
    mediumRiskCount: number;
    potentialRevenueLoss: number;
    churnRate: number;
  };
  trends: {
    period: string;
    churned: number;
    atRisk: number;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHURN PREDICTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Predict churn risk for all active customers
 */
export async function predictChurn(organizationId: string): Promise<ChurnAnalysis> {
  const customers = await db.customer.findMany({
    where: {
      organizationId,
      jobs: { some: {} }, // Has at least one job
    },
    include: {
      jobs: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          completedAt: true,
          actualTotal: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const predictions: ChurnPrediction[] = [];
  const now = new Date();

  for (const customer of customers) {
    const prediction = calculateChurnPrediction(customer, now);
    predictions.push(prediction);
  }

  // Sort by risk score (highest first)
  predictions.sort((a, b) => b.riskScore - a.riskScore);

  // Calculate summary
  const summary = {
    totalAtRisk: predictions.filter((p) => p.riskLevel !== 'low').length,
    highRiskCount: predictions.filter((p) => p.riskLevel === 'high' || p.riskLevel === 'critical').length,
    mediumRiskCount: predictions.filter((p) => p.riskLevel === 'medium').length,
    potentialRevenueLoss: predictions
      .filter((p) => p.riskLevel !== 'low')
      .reduce((sum, p) => sum + p.potentialRevenueLoss, 0),
    churnRate: calculateChurnRate(customers),
  };

  // Calculate trends
  const trends = await getChurnTrends(organizationId);

  return { predictions, summary, trends };
}

/**
 * Calculate churn prediction for a single customer
 */
function calculateChurnPrediction(
  customer: {
    id: string;
    name: string;
    createdAt: Date;
    jobs: {
      id: string;
      status: string;
      createdAt: Date;
      completedAt: Date | null;
      actualTotal: { toNumber(): number } | null;
    }[];
  },
  now: Date
): ChurnPrediction {
  const completedJobs = customer.jobs.filter((j) => j.completedAt);
  const lastJobDate = completedJobs[0]?.completedAt || null;
  const daysSinceLastJob = lastJobDate
    ? Math.floor((now.getTime() - lastJobDate.getTime()) / (1000 * 60 * 60 * 24))
    : 365;

  // Calculate factors
  const factors: ChurnFactor[] = [];

  // Factor 1: Days since last job (0-35 points)
  const recencyScore = Math.min(35, (daysSinceLastJob / 90) * 35);
  factors.push({
    name: 'Recencia',
    weight: 0.35,
    value: recencyScore,
    maxValue: 35,
    description: `${daysSinceLastJob} días desde el último trabajo`,
  });

  // Factor 2: Job frequency (0-25 points)
  const customerAge = Math.max(1, Math.floor(
    (now.getTime() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
  ));
  const avgJobsPerMonth = completedJobs.length / customerAge;
  const frequencyScore = avgJobsPerMonth < 0.5 ? 25 : avgJobsPerMonth < 1 ? 15 : avgJobsPerMonth < 2 ? 5 : 0;
  factors.push({
    name: 'Frecuencia',
    weight: 0.25,
    value: frequencyScore,
    maxValue: 25,
    description: `${avgJobsPerMonth.toFixed(1)} trabajos/mes promedio`,
  });

  // Factor 3: Declining spend (0-20 points)
  let spendDeclineScore = 0;
  if (completedJobs.length >= 3) {
    const recentAvg = completedJobs.slice(0, 3).reduce(
      (sum, j) => sum + (j.actualTotal?.toNumber() || 0), 0
    ) / 3;
    const olderAvg = completedJobs.slice(-3).reduce(
      (sum, j) => sum + (j.actualTotal?.toNumber() || 0), 0
    ) / Math.min(3, completedJobs.length);

    if (olderAvg > 0 && recentAvg < olderAvg * 0.7) {
      spendDeclineScore = 20;
    } else if (olderAvg > 0 && recentAvg < olderAvg * 0.9) {
      spendDeclineScore = 10;
    }
  }
  factors.push({
    name: 'Tendencia de gasto',
    weight: 0.2,
    value: spendDeclineScore,
    maxValue: 20,
    description: spendDeclineScore > 10 ? 'Gasto en declive' : 'Gasto estable',
  });

  // Factor 4: Cancelled jobs (0-10 points)
  const cancelledJobs = customer.jobs.filter((j) => j.status === 'cancelado').length;
  const cancelRate = customer.jobs.length > 0 ? cancelledJobs / customer.jobs.length : 0;
  const cancelScore = cancelRate > 0.3 ? 10 : cancelRate > 0.15 ? 5 : 0;
  factors.push({
    name: 'Cancelaciones',
    weight: 0.1,
    value: cancelScore,
    maxValue: 10,
    description: `${(cancelRate * 100).toFixed(0)}% tasa de cancelación`,
  });

  // Factor 5: Customer tenure (0-10 points)
  const tenureMonths = customerAge;
  const tenureScore = tenureMonths < 3 ? 10 : tenureMonths < 6 ? 5 : 0;
  factors.push({
    name: 'Antigüedad',
    weight: 0.1,
    value: tenureScore,
    maxValue: 10,
    description: `${tenureMonths} meses como cliente`,
  });

  // Calculate total risk score
  const riskScore = Math.min(100, Math.round(
    factors.reduce((sum, f) => sum + f.value, 0)
  ));

  // Determine risk level
  let riskLevel: ChurnPrediction['riskLevel'];
  if (riskScore >= 70) riskLevel = 'critical';
  else if (riskScore >= 50) riskLevel = 'high';
  else if (riskScore >= 30) riskLevel = 'medium';
  else riskLevel = 'low';

  // Calculate potential revenue loss
  const avgJobValue = completedJobs.length > 0
    ? completedJobs.reduce((sum, j) => sum + (j.actualTotal?.toNumber() || 0), 0) / completedJobs.length
    : 0;
  const potentialRevenueLoss = avgJobValue * Math.max(1, avgJobsPerMonth * 12);

  // Predict churn date
  let predictedChurnDate: Date | null = null;
  if (riskLevel !== 'low' && lastJobDate) {
    const daysUntilChurn = riskScore >= 70 ? 30 : riskScore >= 50 ? 60 : 90;
    predictedChurnDate = new Date(lastJobDate.getTime() + daysUntilChurn * 24 * 60 * 60 * 1000);
    if (predictedChurnDate < now) {
      predictedChurnDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  // Generate recommendations
  const recommendedActions = generateRecommendations(riskLevel, factors, daysSinceLastJob);

  return {
    customerId: customer.id,
    customerName: customer.name,
    riskScore,
    riskLevel,
    factors,
    predictedChurnDate,
    recommendedActions,
    potentialRevenueLoss,
  };
}

/**
 * Generate recommended actions based on risk factors
 */
function generateRecommendations(
  riskLevel: ChurnPrediction['riskLevel'],
  factors: ChurnFactor[],
  daysSinceLastJob: number
): string[] {
  const recommendations: string[] = [];

  if (riskLevel === 'low') {
    recommendations.push('Mantener comunicación regular');
    return recommendations;
  }

  if (daysSinceLastJob > 60) {
    recommendations.push('Contactar para ofrecer servicio de mantenimiento');
  }

  if (daysSinceLastJob > 30 && daysSinceLastJob <= 60) {
    recommendations.push('Enviar recordatorio de servicios disponibles');
  }

  const spendFactor = factors.find((f) => f.name === 'Tendencia de gasto');
  if (spendFactor && spendFactor.value > 10) {
    recommendations.push('Ofrecer descuento o promoción especial');
  }

  const cancelFactor = factors.find((f) => f.name === 'Cancelaciones');
  if (cancelFactor && cancelFactor.value > 5) {
    recommendations.push('Investigar razones de cancelaciones previas');
  }

  if (riskLevel === 'critical' || riskLevel === 'high') {
    recommendations.push('Llamar personalmente para retención');
    recommendations.push('Considerar oferta de fidelización');
  }

  return recommendations;
}

/**
 * Calculate historical churn rate
 */
function calculateChurnRate(
  customers: {
    id: string;
    jobs: { completedAt: Date | null }[];
  }[]
): number {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  let customersWithActivity = 0;
  let churnedCustomers = 0;

  for (const customer of customers) {
    const completedJobs = customer.jobs.filter((j) => j.completedAt);
    if (completedJobs.length === 0) continue;

    customersWithActivity++;

    const lastJobDate = completedJobs
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0]
      ?.completedAt;

    if (lastJobDate && lastJobDate < ninetyDaysAgo) {
      churnedCustomers++;
    }
  }

  return customersWithActivity > 0 ? (churnedCustomers / customersWithActivity) * 100 : 0;
}

/**
 * Get churn trends over time
 */
async function getChurnTrends(organizationId: string): Promise<{
  period: string;
  churned: number;
  atRisk: number;
}[]> {
  // Simplified trend calculation
  // In production, this would track actual churn events over time
  const trends: { period: string; churned: number; atRisk: number }[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const period = date.toISOString().slice(0, 7);

    // Placeholder data - would be calculated from actual churn events
    trends.push({
      period,
      churned: Math.floor(Math.random() * 5),
      atRisk: Math.floor(Math.random() * 10) + 5,
    });
  }

  return trends;
}

/**
 * Get high-risk customers for immediate action
 */
export async function getHighRiskCustomers(
  organizationId: string,
  limit: number = 10
): Promise<ChurnPrediction[]> {
  const analysis = await predictChurn(organizationId);
  return analysis.predictions
    .filter((p) => p.riskLevel === 'high' || p.riskLevel === 'critical')
    .slice(0, limit);
}
