/**
 * Demand Forecaster
 * =================
 *
 * Phase 10.5: Predictive Analytics
 * Forecasts future job demand based on historical patterns.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DemandForecast {
  period: string;
  predictedJobs: number;
  confidence: number;
  lowerBound: number;
  upperBound: number;
}

export interface DemandPattern {
  dayOfWeek: number;
  avgJobs: number;
  stdDev: number;
}

export interface SeasonalPattern {
  month: number;
  factor: number; // Multiplier relative to average
}

export interface ForecastResult {
  forecasts: DemandForecast[];
  patterns: {
    daily: DemandPattern[];
    seasonal: SeasonalPattern[];
  };
  accuracy: {
    mape: number; // Mean Absolute Percentage Error
    rmse: number; // Root Mean Square Error
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMAND FORECASTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate demand forecast for the next N days
 */
export async function forecastDemand(
  organizationId: string,
  daysAhead: number = 30
): Promise<ForecastResult> {
  // Get historical job data
  const historicalData = await getHistoricalJobData(organizationId);

  // Calculate patterns
  const dailyPatterns = calculateDailyPatterns(historicalData);
  const seasonalPatterns = calculateSeasonalPatterns(historicalData);

  // Calculate baseline (average jobs per day)
  const baseline = calculateBaseline(historicalData);

  // Generate forecasts
  const forecasts: DemandForecast[] = [];
  const today = new Date();

  for (let i = 1; i <= daysAhead; i++) {
    const forecastDate = new Date(today);
    forecastDate.setDate(today.getDate() + i);

    const forecast = predictDayDemand(
      forecastDate,
      baseline,
      dailyPatterns,
      seasonalPatterns
    );

    forecasts.push({
      period: forecastDate.toISOString().slice(0, 10),
      ...forecast,
    });
  }

  // Calculate accuracy metrics based on recent predictions
  const accuracy = await calculateAccuracy(organizationId, baseline, dailyPatterns, seasonalPatterns);

  return {
    forecasts,
    patterns: {
      daily: dailyPatterns,
      seasonal: seasonalPatterns,
    },
    accuracy,
  };
}

/**
 * Get historical job data for analysis
 */
async function getHistoricalJobData(organizationId: string): Promise<{
  date: Date;
  count: number;
}[]> {
  // Get last 365 days of data
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: { gte: oneYearAgo },
    },
    select: {
      createdAt: true,
    },
  });

  // Group by date
  const dateMap = new Map<string, number>();

  for (const job of jobs) {
    const dateKey = job.createdAt.toISOString().slice(0, 10);
    dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
  }

  // Fill in missing dates with 0
  const result: { date: Date; count: number }[] = [];
  const current = new Date(oneYearAgo);
  const today = new Date();

  while (current <= today) {
    const dateKey = current.toISOString().slice(0, 10);
    result.push({
      date: new Date(current),
      count: dateMap.get(dateKey) || 0,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Calculate daily patterns (day of week effects)
 */
function calculateDailyPatterns(data: { date: Date; count: number }[]): DemandPattern[] {
  const dayData: { sums: number[]; counts: number[]; values: number[][] } = {
    sums: Array(7).fill(0),
    counts: Array(7).fill(0),
    values: Array(7).fill(null).map(() => []),
  };

  for (const d of data) {
    const dayOfWeek = d.date.getDay();
    dayData.sums[dayOfWeek] += d.count;
    dayData.counts[dayOfWeek]++;
    dayData.values[dayOfWeek].push(d.count);
  }

  return Array(7)
    .fill(null)
    .map((_, i) => {
      const avg = dayData.counts[i] > 0 ? dayData.sums[i] / dayData.counts[i] : 0;
      const variance = dayData.values[i].reduce(
        (sum, v) => sum + Math.pow(v - avg, 2),
        0
      ) / Math.max(dayData.values[i].length - 1, 1);

      return {
        dayOfWeek: i,
        avgJobs: avg,
        stdDev: Math.sqrt(variance),
      };
    });
}

/**
 * Calculate seasonal patterns (monthly effects)
 */
function calculateSeasonalPatterns(data: { date: Date; count: number }[]): SeasonalPattern[] {
  const monthData: { sums: number[]; counts: number[] } = {
    sums: Array(12).fill(0),
    counts: Array(12).fill(0),
  };

  for (const d of data) {
    const month = d.date.getMonth();
    monthData.sums[month] += d.count;
    monthData.counts[month]++;
  }

  // Calculate overall average
  const totalAvg = data.reduce((sum, d) => sum + d.count, 0) / data.length;

  return Array(12)
    .fill(null)
    .map((_, i) => {
      const monthAvg = monthData.counts[i] > 0 ? monthData.sums[i] / monthData.counts[i] : totalAvg;
      return {
        month: i,
        factor: totalAvg > 0 ? monthAvg / totalAvg : 1,
      };
    });
}

/**
 * Calculate baseline average
 */
function calculateBaseline(data: { date: Date; count: number }[]): number {
  if (data.length === 0) return 0;
  return data.reduce((sum, d) => sum + d.count, 0) / data.length;
}

/**
 * Predict demand for a specific day
 */
function predictDayDemand(
  date: Date,
  baseline: number,
  dailyPatterns: DemandPattern[],
  seasonalPatterns: SeasonalPattern[]
): { predictedJobs: number; confidence: number; lowerBound: number; upperBound: number } {
  const dayOfWeek = date.getDay();
  const month = date.getMonth();

  const dailyPattern = dailyPatterns[dayOfWeek];
  const seasonalFactor = seasonalPatterns[month].factor;

  // Adjust baseline by day-of-week pattern
  const dailyFactor = baseline > 0 ? dailyPattern.avgJobs / baseline : 1;

  // Predicted value
  const predicted = baseline * dailyFactor * seasonalFactor;

  // Confidence interval (using standard deviation)
  const stdDev = dailyPattern.stdDev;
  const confidence = 0.8; // 80% confidence interval
  const zScore = 1.28; // Z-score for 80% CI

  const lowerBound = Math.max(0, predicted - zScore * stdDev);
  const upperBound = predicted + zScore * stdDev;

  return {
    predictedJobs: Math.round(predicted),
    confidence,
    lowerBound: Math.round(lowerBound),
    upperBound: Math.round(upperBound),
  };
}

/**
 * Calculate forecast accuracy metrics
 */
async function calculateAccuracy(
  organizationId: string,
  baseline: number,
  dailyPatterns: DemandPattern[],
  seasonalPatterns: SeasonalPattern[]
): Promise<{ mape: number; rmse: number }> {
  // Use last 30 days as validation set
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { createdAt: true },
  });

  // Group by date
  const actualByDate = new Map<string, number>();
  for (const job of jobs) {
    const dateKey = job.createdAt.toISOString().slice(0, 10);
    actualByDate.set(dateKey, (actualByDate.get(dateKey) || 0) + 1);
  }

  // Calculate errors
  let sumAbsPercentError = 0;
  let sumSquaredError = 0;
  let count = 0;

  const current = new Date(thirtyDaysAgo);
  const today = new Date();

  while (current < today) {
    const dateKey = current.toISOString().slice(0, 10);
    const actual = actualByDate.get(dateKey) || 0;
    const predicted = predictDayDemand(current, baseline, dailyPatterns, seasonalPatterns).predictedJobs;

    if (actual > 0) {
      sumAbsPercentError += Math.abs(actual - predicted) / actual;
    }
    sumSquaredError += Math.pow(actual - predicted, 2);
    count++;

    current.setDate(current.getDate() + 1);
  }

  const mape = count > 0 ? (sumAbsPercentError / count) * 100 : 0;
  const rmse = count > 0 ? Math.sqrt(sumSquaredError / count) : 0;

  return { mape, rmse };
}

/**
 * Get peak demand periods
 */
export async function getPeakDemandPeriods(
  organizationId: string
): Promise<{ period: string; avgJobs: number; peakFactor: number }[]> {
  const historicalData = await getHistoricalJobData(organizationId);
  const baseline = calculateBaseline(historicalData);

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dailyPatterns = calculateDailyPatterns(historicalData);

  return dailyPatterns
    .map((p, i) => ({
      period: dayNames[i],
      avgJobs: p.avgJobs,
      peakFactor: baseline > 0 ? p.avgJobs / baseline : 1,
    }))
    .sort((a, b) => b.peakFactor - a.peakFactor);
}
