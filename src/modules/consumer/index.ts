/**
 * Consumer Module
 * ===============
 *
 * Consumer-facing marketplace functionality.
 * Phase 15: Consumer Marketplace
 *
 * This module provides:
 * - Consumer authentication (phone OTP)
 * - Consumer profiles and preferences
 * - Service requests and quotes
 * - Business discovery and search
 * - Reviews and ratings
 */

// Types
export * from './consumer.types';

// Auth
export {
  ConsumerAuthService,
  ConsumerOTPService,
  ConsumerSessionService,
  ConsumerAuthError,
  getConsumerAuthService,
  initializeConsumerAuthService,
  resetConsumerAuthService,
  authenticateConsumer,
  optionalConsumerAuth,
  rateLimitOTP,
  requireActiveConsumer,
  createConsumerAuthRoutes,
} from './auth';

// Profiles
export {
  ConsumerProfileRepository,
  ConsumerProfileService,
  ConsumerProfileError,
  createConsumerProfileRoutes,
} from './profiles';

// Service Requests
export {
  ServiceRequestRepository,
  ServiceRequestService,
  ServiceRequestError,
  createServiceRequestRoutes,
} from './requests';

// Discovery
export {
  RankingService,
  GeoSearchService,
  DiscoveryService,
  BusinessPublicProfileRepository,
  BadgeService,
  createDiscoveryRoutes,
  CATEGORY_METADATA,
  DEFAULT_RANKING_WEIGHTS,
  BADGE_CRITERIA,
  getCategoryDisplayName,
  getCategoryIcon,
  getCategoryMetadata,
} from './discovery';

// Quotes
export {
  QuoteRepository,
  QuoteService,
  QuoteError,
  createConsumerQuoteRoutes,
  createBusinessQuoteRoutes,
} from './quotes';

// Notifications
export {
  WhatsAppService,
  PushNotificationService,
  NotificationService,
  NotificationScheduler,
  MESSAGE_TEMPLATES,
  NOTIFICATION_CHANNELS,
  initializeWhatsAppService,
  initializePushService,
  initializeNotificationService,
  getWhatsAppService,
  getPushService,
  getNotificationService,
} from './notifications';

// Reviews
export {
  ReviewRepository,
  ReviewService,
  ReviewError,
  createReviewRoutes,
  createBusinessReviewRoutes,
  createReviewModerationRoutes,
} from './reviews';

// Trust & Verification
export {
  VerificationService,
  VERIFICATION_REQUIREMENTS,
} from './trust';

// Mode Switching
export {
  ModeSwitchService,
  createModeSwitchRoutes,
} from './mode-switch';

// Leads Dashboard (Business)
export {
  LeadsDashboardService,
  createLeadsDashboardRoutes,
} from './leads';

// Marketing & Growth
export {
  SeoPagesService,
  ReferralService,
  createSeoRoutes,
  createReferralRoutes,
} from './marketing';

// Analytics
export {
  MarketplaceAnalyticsService,
  createMarketplaceAnalyticsRoutes,
} from './analytics';
