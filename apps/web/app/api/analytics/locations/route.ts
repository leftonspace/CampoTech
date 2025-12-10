import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  calculateLocationKPIs,
  getLocationPerformanceTrend,
  getLocationDailyMetrics,
  getLocationServiceTypeBreakdown,
  generateLocationComparisonReport,
  getLocationBenchmarks,
  compareLocations,
  generateJobsHeatmap,
  generateRevenueHeatmap,
  generateResponseTimeHeatmap,
  getGeographicPerformance,
  generateServiceDensityMap,
  analyzeCoverage,
  analyzeExpansionOpportunities,
  calculateLocationSaturation,
  identifyMarketPotential,
} from '@/src/analytics';
import { DateRange, TimeGranularity } from '@/src/analytics/analytics.types';

/**
 * GET /api/analytics/locations
 * Get location analytics data
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
    const view = searchParams.get('view') || 'comparison';
    const locationId = searchParams.get('locationId');

    // Parse date range
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date();

    const dateRange: DateRange = { start: startDate, end: endDate };
    const granularity = (searchParams.get('granularity') || 'day') as TimeGranularity;

    // Location comparison report (default)
    if (view === 'comparison') {
      const report = await generateLocationComparisonReport(
        session.organizationId,
        dateRange
      );
      return NextResponse.json({
        success: true,
        data: report,
      });
    }

    // Location benchmarks
    if (view === 'benchmarks') {
      const benchmarks = await getLocationBenchmarks(
        session.organizationId,
        dateRange
      );
      return NextResponse.json({
        success: true,
        data: { benchmarks },
      });
    }

    // Compare two locations
    if (view === 'compare' && locationId) {
      const compareToId = searchParams.get('compareToId');
      if (!compareToId) {
        return NextResponse.json(
          { success: false, error: 'compareToId is required' },
          { status: 400 }
        );
      }
      const comparison = await compareLocations(
        session.organizationId,
        locationId,
        compareToId,
        dateRange
      );
      return NextResponse.json({
        success: true,
        data: comparison,
      });
    }

    // Location KPIs
    if (view === 'kpis' && locationId) {
      const kpis = await calculateLocationKPIs(
        session.organizationId,
        locationId,
        dateRange
      );
      return NextResponse.json({
        success: true,
        data: kpis,
      });
    }

    // Location trend
    if (view === 'trend' && locationId) {
      const trend = await getLocationPerformanceTrend(
        session.organizationId,
        locationId,
        dateRange,
        granularity
      );
      return NextResponse.json({
        success: true,
        data: { trend },
      });
    }

    // Location daily metrics
    if (view === 'daily' && locationId) {
      const daily = await getLocationDailyMetrics(
        session.organizationId,
        locationId,
        dateRange
      );
      return NextResponse.json({
        success: true,
        data: { daily },
      });
    }

    // Service type breakdown
    if (view === 'services' && locationId) {
      const services = await getLocationServiceTypeBreakdown(
        session.organizationId,
        locationId,
        dateRange
      );
      return NextResponse.json({
        success: true,
        data: { services },
      });
    }

    // Geographic performance
    if (view === 'geographic') {
      const performance = await getGeographicPerformance(
        session.organizationId,
        dateRange
      );
      return NextResponse.json({
        success: true,
        data: { performance },
      });
    }

    // Heatmaps
    if (view === 'heatmap') {
      const heatmapType = searchParams.get('type') || 'jobs';
      let heatmap;

      switch (heatmapType) {
        case 'jobs':
          heatmap = await generateJobsHeatmap(session.organizationId, dateRange);
          break;
        case 'revenue':
          heatmap = await generateRevenueHeatmap(session.organizationId, dateRange);
          break;
        case 'response_time':
          heatmap = await generateResponseTimeHeatmap(session.organizationId, dateRange);
          break;
        default:
          return NextResponse.json(
            { success: false, error: 'Invalid heatmap type' },
            { status: 400 }
          );
      }

      return NextResponse.json({
        success: true,
        data: heatmap,
      });
    }

    // Service density map
    if (view === 'density') {
      const gridSize = parseInt(searchParams.get('gridSize') || '5', 10);
      const densityMap = await generateServiceDensityMap(
        session.organizationId,
        dateRange,
        gridSize
      );
      return NextResponse.json({
        success: true,
        data: densityMap,
      });
    }

    // Coverage analysis
    if (view === 'coverage') {
      const coverage = await analyzeCoverage(session.organizationId, dateRange);
      return NextResponse.json({
        success: true,
        data: coverage,
      });
    }

    // Expansion opportunities
    if (view === 'expansion') {
      const expansion = await analyzeExpansionOpportunities(
        session.organizationId,
        dateRange
      );
      return NextResponse.json({
        success: true,
        data: expansion,
      });
    }

    // Location saturation
    if (view === 'saturation') {
      const saturation = await calculateLocationSaturation(
        session.organizationId,
        dateRange
      );
      return NextResponse.json({
        success: true,
        data: { saturation },
      });
    }

    // Market potential
    if (view === 'market-potential') {
      const potential = await identifyMarketPotential(
        session.organizationId,
        dateRange
      );
      return NextResponse.json({
        success: true,
        data: { potential },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid view parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Location analytics error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching location analytics' },
      { status: 500 }
    );
  }
}
