/**
 * Location Analytics Module
 * =========================
 *
 * Phase 11.6: Location Analytics
 * Comprehensive analytics for multi-location operations.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  calculateLocationKPIs,
  getLocationPerformanceTrend,
  getLocationDailyMetrics,
  getLocationServiceTypeBreakdown,
  generateLocationKPIValues,
  type LocationKPIs,
  type LocationPerformanceTrend,
  type LocationDailyMetrics,
  type LocationServiceTypeBreakdown,
} from './location-performance';

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION COMPARISON
// ═══════════════════════════════════════════════════════════════════════════════

export {
  generateLocationComparisonReport,
  getLocationBenchmarks,
  compareLocations,
  type LocationComparisonReport,
  type LocationComparisonEntry,
  type LocationRankings,
  type RankingEntry,
  type ComparisonInsight,
  type LocationBenchmark,
} from './location-comparison';

// ═══════════════════════════════════════════════════════════════════════════════
// GEOGRAPHIC ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  generateJobsHeatmap,
  generateRevenueHeatmap,
  generateResponseTimeHeatmap,
  getGeographicPerformance,
  generateServiceDensityMap,
  analyzeCoverage,
  type GeoCoordinate,
  type GeoBounds,
  type HeatmapPoint,
  type HeatmapData,
  type GeographicPerformance,
  type ZonePerformance,
  type ServiceDensityMap,
  type DensityCell,
  type CoverageAnalysis,
  type CoverageGap,
  type OverlappingArea,
} from './geographic-analytics';

// ═══════════════════════════════════════════════════════════════════════════════
// EXPANSION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  analyzeExpansionOpportunities,
  calculateLocationSaturation,
  identifyMarketPotential,
  type ExpansionOpportunity,
  type ExpansionAnalysis,
  type ExpansionAction,
  type RiskAssessment,
  type RiskFactor,
  type MarketPotential,
  type LocationSaturation,
} from './expansion-analyzer';
