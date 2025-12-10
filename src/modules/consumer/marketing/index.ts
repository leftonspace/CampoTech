/**
 * Marketing Module
 * ================
 *
 * Exports for SEO pages and referral system.
 * Phase 15: Consumer Marketplace
 */

export {
  SeoPagesService,
  SeoPageData,
  CategoryLandingPage,
  CityLandingPage,
  ServiceLandingPage,
} from './seo-pages.service';

export {
  ReferralService,
  ReferralCode,
  ReferralReward,
  ReferralStats,
  ReferralProgram,
} from './referral.service';

export { createSeoRoutes, createReferralRoutes } from './marketing.routes';
