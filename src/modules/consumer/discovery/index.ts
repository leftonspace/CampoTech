/**
 * Discovery Module
 * ================
 *
 * Exports for business discovery and search.
 * Phase 15: Consumer Marketplace
 */

export {
  CATEGORY_METADATA,
  DEFAULT_RANKING_WEIGHTS,
  getCategoryDisplayName,
  getCategoryMetadata,
} from './discovery.types';
export type {
  GeoSearchParams,
  RankingWeights,
  RankedBusiness,
  CategoryMetadata,
} from './discovery.types';

export { RankingService } from './ranking.service';
export { GeoSearchService } from './geo-search.service';
export { DiscoveryService, BusinessPublicProfileRepository } from './discovery.service';
export { createDiscoveryRoutes } from './discovery.routes';
export { BadgeService, BADGE_CRITERIA } from './badge.service';
export type { BadgeCriteria, BadgeInfo, BusinessMetrics } from './badge.service';
