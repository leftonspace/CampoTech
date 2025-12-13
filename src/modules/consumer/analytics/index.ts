/**
 * Marketplace Analytics Module
 * ============================
 *
 * Exports for marketplace analytics and reporting.
 * Phase 15: Consumer Marketplace
 */

export { MarketplaceAnalyticsService } from './marketplace-analytics.service';
export type {
  MarketplaceDashboard,
  OverviewMetrics,
  TrendData,
  CategoryMetric,
  CityMetric,
  FunnelStep,
  ActivityItem,
  CohortAnalysis,
  Cohort,
  DateRange,
} from './marketplace-analytics.service';

export { createMarketplaceAnalyticsRoutes } from './marketplace-analytics.routes';
