/**
 * Marketing Module
 * ================
 *
 * Exports for SEO pages and referral system.
 * Phase 15: Consumer Marketplace
 */

export { SeoPagesService } from './seo-pages.service';
export type {
  SeoPageData,
  CategoryLandingPage,
  CityLandingPage,
  ServiceLandingPage,
} from './seo-pages.service';

export { ReferralService } from './referral.service';
export type {
  ReferralCode,
  ReferralReward,
  ReferralStats,
  ReferralProgram,
} from './referral.service';

export { createSeoRoutes, createReferralRoutes } from './marketing.routes';
