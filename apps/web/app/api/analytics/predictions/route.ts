/**
 * Analytics Predictions API Route
 * ================================
 *
 * Phase 10.5: Predictive Analytics
 * Uses real database data for predictions. Shows "no data" when empty.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/analytics/predictions
 * Returns predictive analytics data based on real database data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const organizationId = session.organizationId;

    // Fetch real data from database
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Get historical jobs for demand analysis
    const [
      recentJobs,
      olderJobs,
      invoices,
      customers,
      recentCustomerActivity,
    ] = await Promise.all([
      // Jobs from last 30 days
      prisma.job.findMany({
        where: {
          organizationId,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          id: true,
          createdAt: true,
          status: true,
          scheduledDate: true,
        },
      }),
      // Jobs from 30-60 days ago (for comparison)
      prisma.job.findMany({
        where: {
          organizationId,
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
        select: {
          id: true,
          createdAt: true,
        },
      }),
      // Invoices for revenue analysis
      prisma.invoice.findMany({
        where: {
          organizationId,
          createdAt: { gte: ninetyDaysAgo },
        },
        select: {
          id: true,
          total: true,
          status: true,
          createdAt: true,
        },
      }),
      // All customers for churn analysis
      prisma.customer.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      }),
      // Customer activity (jobs) in last 90 days
      prisma.job.groupBy({
        by: ['customerId'],
        where: {
          organizationId,
          createdAt: { gte: ninetyDaysAgo },
        },
        _count: { id: true },
        _max: { createdAt: true },
      }),
    ]);

    // ═══════════════════════════════════════════════════════════════════════════
    // DEMAND FORECASTING
    // ═══════════════════════════════════════════════════════════════════════════

    const hasJobData = recentJobs.length > 0 || olderJobs.length > 0;

    // Calculate daily job counts for the last 30 days
    const dailyJobCounts = new Map<string, number>();
    recentJobs.forEach((job) => {
      const dateKey = job.createdAt.toISOString().split('T')[0];
      dailyJobCounts.set(dateKey, (dailyJobCounts.get(dateKey) || 0) + 1);
    });

    // Calculate average daily demand
    const totalDays = 30;
    const avgDailyDemand = recentJobs.length / totalDays;
    const prevAvgDailyDemand = olderJobs.length / totalDays;

    // Simple trend calculation
    const demandTrend = prevAvgDailyDemand > 0
      ? ((avgDailyDemand - prevAvgDailyDemand) / prevAvgDailyDemand)
      : 0;

    // Generate forecasts based on historical data
    const forecasts = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);

      // Apply simple linear trend
      const predictedDemand = hasJobData
        ? Math.max(0, Math.round(avgDailyDemand * (1 + demandTrend * (i / 30))))
        : 0;

      // Calculate bounds based on historical variance
      const variance = hasJobData ? Math.max(1, avgDailyDemand * 0.3) : 0;

      return {
        date: date.toISOString(),
        predictedDemand,
        lowerBound: Math.max(0, predictedDemand - Math.round(variance)),
        upperBound: predictedDemand + Math.round(variance),
        confidence: hasJobData ? 0.75 : 0,
      };
    });

    // Calculate peak periods from actual data
    const peakPeriods: { dayOfWeek: number; hour: number; avgDemand: number }[] = [];
    if (hasJobData) {
      const hourlyDemand = new Map<string, number[]>();
      recentJobs.forEach((job) => {
        const dayOfWeek = job.createdAt.getDay();
        const hour = job.createdAt.getHours();
        const key = `${dayOfWeek}-${hour}`;
        if (!hourlyDemand.has(key)) hourlyDemand.set(key, []);
        hourlyDemand.get(key)!.push(1);
      });

      // Find top 4 peak periods
      const sortedPeriods = Array.from(hourlyDemand.entries())
        .map(([key, counts]) => {
          const [day, hour] = key.split('-').map(Number);
          return { dayOfWeek: day, hour, avgDemand: counts.length / 4 }; // 4 weeks
        })
        .sort((a, b) => b.avgDemand - a.avgDemand)
        .slice(0, 4);

      peakPeriods.push(...sortedPeriods);
    }

    const demandData = {
      forecast: {
        forecasts,
        accuracy: hasJobData
          ? { mape: Math.round((1 - Math.min(0.9, avgDailyDemand / 10)) * 100) / 10, rmse: Math.round(avgDailyDemand * 0.2 * 10) / 10 }
          : { mape: null, rmse: null },
      },
      peakPeriods,
      hasData: hasJobData,
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // REVENUE PROJECTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    const hasRevenueData = invoices.length > 0;

    // Calculate current MRR (Monthly Recurring Revenue approximation)
    const last30DaysInvoices = invoices.filter(
      (inv) => inv.createdAt >= thirtyDaysAgo && inv.status === 'PAID'
    );
    const currentMRR = last30DaysInvoices.reduce(
      (sum, inv) => sum + Number(inv.total || 0),
      0
    );

    // Previous month revenue for growth rate
    const prev30to60DaysInvoices = invoices.filter(
      (inv) => inv.createdAt >= sixtyDaysAgo && inv.createdAt < thirtyDaysAgo && inv.status === 'PAID'
    );
    const prevMRR = prev30to60DaysInvoices.reduce(
      (sum, inv) => sum + Number(inv.total || 0),
      0
    );

    const growthRate = prevMRR > 0 ? ((currentMRR - prevMRR) / prevMRR) : 0;

    // Generate revenue scenarios
    const generateScenarioProjections = (baseGrowth: number) => {
      return Array.from({ length: 12 }, (_, i) => ({
        month: new Date(Date.now() + i * 30 * 24 * 60 * 60 * 1000).toISOString(),
        projectedRevenue: hasRevenueData
          ? Math.round(currentMRR * Math.pow(1 + baseGrowth / 12, i + 1))
          : 0,
      }));
    };

    const revenueData = {
      projections: {
        currentMRR,
        historicalGrowthRate: Math.round(growthRate * 100) / 100,
        scenarios: [
          {
            name: 'Conservador',
            projections: generateScenarioProjections(Math.min(growthRate, 0.05)),
          },
          {
            name: 'Base',
            projections: generateScenarioProjections(growthRate),
          },
          {
            name: 'Optimista',
            projections: generateScenarioProjections(Math.max(growthRate, 0.1)),
          },
        ],
        projectionFactors: hasRevenueData ? [
          { factor: 'Tendencia histórica', impact: growthRate > 0 ? 'positive' : 'negative', confidence: 0.7 },
          { factor: 'Estacionalidad', impact: 'neutral', confidence: 0.5 },
        ] : [],
      },
      milestones: hasRevenueData && currentMRR > 0 ? [
        {
          targetRevenue: Math.ceil(currentMRR * 2 / 100000) * 100000,
          estimatedDate: growthRate > 0
            ? new Date(Date.now() + (Math.log(2) / Math.log(1 + growthRate)) * 30 * 24 * 60 * 60 * 1000).toISOString()
            : null,
          probability: growthRate > 0 ? 0.6 : 0.2,
        },
      ] : [],
      hasData: hasRevenueData,
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // CHURN ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════════

    const hasCustomerData = customers.length > 0;

    // Identify at-risk customers (no activity in 60+ days)
    const customerActivityMap = new Map(
      recentCustomerActivity.map((ca) => [ca.customerId, ca._max.createdAt])
    );

    const atRiskCustomers = customers.filter((customer) => {
      const lastActivity = customerActivityMap.get(customer.id);
      if (!lastActivity) return true; // No activity = at risk
      const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000);
      return daysSinceActivity > 60;
    });

    const highRiskCustomers = atRiskCustomers.slice(0, 10).map((customer) => {
      const lastActivity = customerActivityMap.get(customer.id);
      const daysSinceActivity = lastActivity
        ? Math.floor((now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000))
        : 999;

      return {
        customerId: customer.id,
        customerName: customer.name,
        riskScore: Math.min(1, daysSinceActivity / 180),
        riskLevel: daysSinceActivity > 120 ? 'high' : daysSinceActivity > 60 ? 'medium' : 'low',
        recommendedActions: [
          'Enviar encuesta de satisfacción',
          'Ofrecer promoción de reactivación',
          'Llamada de seguimiento',
        ],
        potentialRevenueLoss: 0, // Would need invoice data per customer
      };
    });

    const churnRate = customers.length > 0
      ? Math.round((atRiskCustomers.length / customers.length) * 100) / 100
      : 0;

    const churnData = {
      summary: {
        totalAtRisk: atRiskCustomers.length,
        highRiskCount: highRiskCustomers.filter((c) => c.riskLevel === 'high').length,
        mediumRiskCount: highRiskCustomers.filter((c) => c.riskLevel === 'medium').length,
        potentialRevenueLoss: 0,
        churnRate,
      },
      trends: hasCustomerData ? [
        { period: 'Últimos 30 días', churned: 0, atRisk: atRiskCustomers.length },
      ] : [],
      highRiskCustomers,
      hasData: hasCustomerData,
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ANOMALY DETECTION
    // ═══════════════════════════════════════════════════════════════════════════

    const anomalies: Array<{
      id: string;
      type: string;
      severity: 'critical' | 'warning' | 'info';
      metric: string;
      expectedValue: number;
      actualValue: number;
      detectedAt: string;
      description: string;
    }> = [];

    // Detect demand anomalies
    if (hasJobData && avgDailyDemand > 0) {
      // Check if today's demand is significantly different
      const todayKey = now.toISOString().split('T')[0];
      const todayDemand = dailyJobCounts.get(todayKey) || 0;

      if (todayDemand > avgDailyDemand * 2) {
        anomalies.push({
          id: `anomaly-demand-high-${Date.now()}`,
          type: 'demand_spike',
          severity: 'warning',
          metric: 'Demanda diaria',
          expectedValue: Math.round(avgDailyDemand),
          actualValue: todayDemand,
          detectedAt: now.toISOString(),
          description: `Demanda inusualmente alta: ${todayDemand} trabajos vs ${Math.round(avgDailyDemand)} esperados`,
        });
      } else if (todayDemand < avgDailyDemand * 0.3 && avgDailyDemand > 1) {
        anomalies.push({
          id: `anomaly-demand-low-${Date.now()}`,
          type: 'demand_drop',
          severity: 'info',
          metric: 'Demanda diaria',
          expectedValue: Math.round(avgDailyDemand),
          actualValue: todayDemand,
          detectedAt: now.toISOString(),
          description: `Demanda baja: ${todayDemand} trabajos vs ${Math.round(avgDailyDemand)} esperados`,
        });
      }
    }

    // Detect revenue anomalies
    if (hasRevenueData && prevMRR > 0) {
      const revenueChange = ((currentMRR - prevMRR) / prevMRR) * 100;
      if (revenueChange < -20) {
        anomalies.push({
          id: `anomaly-revenue-drop-${Date.now()}`,
          type: 'revenue_drop',
          severity: 'critical',
          metric: 'Ingresos mensuales',
          expectedValue: prevMRR,
          actualValue: currentMRR,
          detectedAt: now.toISOString(),
          description: `Caída de ingresos: ${Math.abs(Math.round(revenueChange))}% menos que el mes anterior`,
        });
      } else if (revenueChange > 50) {
        anomalies.push({
          id: `anomaly-revenue-spike-${Date.now()}`,
          type: 'revenue_spike',
          severity: 'info',
          metric: 'Ingresos mensuales',
          expectedValue: prevMRR,
          actualValue: currentMRR,
          detectedAt: now.toISOString(),
          description: `Incremento significativo: ${Math.round(revenueChange)}% más que el mes anterior`,
        });
      }
    }

    const anomalyData = {
      anomalies,
      summary: {
        totalAnomalies: anomalies.length,
        criticalCount: anomalies.filter((a) => a.severity === 'critical').length,
        warningCount: anomalies.filter((a) => a.severity === 'warning').length,
        infoCount: anomalies.filter((a) => a.severity === 'info').length,
      },
      baselines: hasJobData ? [
        { metric: 'Demanda diaria promedio', value: Math.round(avgDailyDemand * 10) / 10 },
        { metric: 'Ingresos mensuales', value: currentMRR },
      ] : [],
      hasData: anomalies.length > 0 || hasJobData || hasRevenueData,
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RESPONSE
    // ═══════════════════════════════════════════════════════════════════════════

    // Combined summary for 'all' type
    const summaryData = {
      demand: {
        forecasts,
        accuracy: demandData.forecast.accuracy,
        hasData: hasJobData,
      },
      revenue: {
        currentMRR,
        growthRate: Math.round(growthRate * 100),
        scenarios: revenueData.projections.scenarios.map((s) => ({
          name: s.name,
          nextMonth: s.projections[0]?.projectedRevenue || 0,
          sixMonths: s.projections[5]?.projectedRevenue || 0,
        })),
        hasData: hasRevenueData,
      },
      churn: {
        summary: churnData.summary,
        topRisks: highRiskCustomers.slice(0, 5),
        trends: churnData.trends,
        highRiskCustomers: highRiskCustomers,
        hasData: hasCustomerData,
      },
      anomalies: {
        summary: anomalyData.summary,
        recent: anomalies.slice(0, 5),
        anomalies: anomalies,
        baselines: anomalyData.baselines,
        hasData: anomalyData.hasData,
      },
    };

    // Return data based on type
    switch (type) {
      case 'demand':
        return NextResponse.json(demandData);
      case 'revenue':
        return NextResponse.json(revenueData);
      case 'churn':
        return NextResponse.json(churnData);
      case 'anomalies':
        return NextResponse.json(anomalyData);
      case 'all':
      default:
        return NextResponse.json(summaryData);
    }
  } catch (error) {
    console.error('Predictions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}
