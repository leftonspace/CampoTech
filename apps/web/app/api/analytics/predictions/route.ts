/**
 * Analytics Predictions API Route
 * ================================
 *
 * Phase 10: Advanced Analytics & Reporting
 * Returns predictive analytics data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';

import { forecastDemand, getPeakDemandPeriods } from '../../../../../../src/analytics/predictions/demand/demand-forecaster';
import { projectRevenue, getRevenueMilestones } from '../../../../../../src/analytics/predictions/revenue/revenue-projector';
import { predictChurn, getHighRiskCustomers } from '../../../../../../src/analytics/predictions/churn/churn-predictor';
import { detectAnomalies } from '../../../../../../src/analytics/predictions/anomaly/anomaly-detector';

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/predictions
// Returns all predictions
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // Get specific prediction type from query params
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all';

    switch (type) {
      case 'demand': {
        const daysAhead = parseInt(searchParams.get('days') || '30', 10);
        const [forecast, peakPeriods] = await Promise.all([
          forecastDemand(organizationId, daysAhead),
          getPeakDemandPeriods(organizationId),
        ]);
        return NextResponse.json({ forecast, peakPeriods });
      }

      case 'revenue': {
        const months = parseInt(searchParams.get('months') || '12', 10);
        const [projections, milestones] = await Promise.all([
          projectRevenue(organizationId, months),
          getRevenueMilestones(organizationId, 1000000), // 1M milestone
        ]);
        return NextResponse.json({ projections, milestones });
      }

      case 'churn': {
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const [analysis, highRisk] = await Promise.all([
          predictChurn(organizationId),
          getHighRiskCustomers(organizationId, limit),
        ]);
        return NextResponse.json({
          summary: analysis.summary,
          trends: analysis.trends,
          highRiskCustomers: highRisk,
        });
      }

      case 'anomalies': {
        const result = await detectAnomalies(organizationId);
        return NextResponse.json({
          anomalies: result.anomalies.slice(0, 20),
          summary: result.summary,
          baselines: result.metricBaselines,
        });
      }

      case 'all':
      default: {
        // Fetch all predictions in parallel
        const [
          demandForecast,
          revenueProjection,
          churnAnalysis,
          anomalyDetection,
        ] = await Promise.all([
          forecastDemand(organizationId, 14), // 2 weeks
          projectRevenue(organizationId, 6), // 6 months
          predictChurn(organizationId),
          detectAnomalies(organizationId),
        ]);

        return NextResponse.json({
          demand: {
            forecasts: demandForecast.forecasts.slice(0, 7),
            accuracy: demandForecast.accuracy,
          },
          revenue: {
            currentMRR: revenueProjection.currentMRR,
            growthRate: revenueProjection.historicalGrowthRate,
            scenarios: revenueProjection.scenarios.map((s) => ({
              name: s.name,
              nextMonth: s.projections[0]?.projectedRevenue || 0,
              sixMonths: s.projections[5]?.projectedRevenue || 0,
            })),
          },
          churn: {
            summary: churnAnalysis.summary,
            topRisks: churnAnalysis.predictions.slice(0, 5).map((p) => ({
              customerId: p.customerId,
              customerName: p.customerName,
              riskScore: p.riskScore,
              riskLevel: p.riskLevel,
            })),
          },
          anomalies: {
            summary: anomalyDetection.summary,
            recent: anomalyDetection.anomalies.slice(0, 5).map((a) => ({
              type: a.type,
              severity: a.severity,
              description: a.description,
              detectedAt: a.detectedAt,
            })),
          },
        });
      }
    }
  } catch (error) {
    console.error('Predictions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}
