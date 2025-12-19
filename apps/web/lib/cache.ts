/**
 * CampoTech Cache Module (Phase 5.2)
 * ==================================
 *
 * Re-exports cache utilities from the cache module.
 * This file exists for backward compatibility with the roadmap specification.
 *
 * @see /lib/cache/index.ts for full implementation
 * @see /lib/cache/cached-queries.ts for cached query functions
 */

// Re-export everything from cache module
export {
  // Redis client
  redis,
  isRedisConfigured,

  // TTL constants
  CACHE_TTL,
  CACHE_PREFIX,

  // Key builders
  orgSettingsKey,
  tierLimitsKey,
  publicProfileKey,
  searchResultsKey,
  userKey,
  featureFlagsKey,

  // Core cache functions
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  cacheExists,

  // Cache-aside patterns
  cached,
  cachedWithSWR,

  // Invalidation helpers
  invalidateOrgCache,
  invalidateUserCache,
  invalidateSearchCache,

  // Utilities
  hashSearchQuery,
  getCacheStats,
} from './cache/index';

// Re-export cached queries for convenience
export {
  // Organization
  getCachedOrgSettings,
  getCachedOrgFull,
  invalidateOrgSettings,

  // Tier limits
  getCachedTierLimits,
  getCachedTierConfigs,
  getOrgTierLimits,

  // Public profiles
  getCachedPublicProfile,
  getCachedPublicProfiles,
  invalidatePublicProfile,

  // Search
  searchMarketplaceProfiles,
  getTopRatedProfiles,
  getProfilesByCategory,
  invalidateAllSearchCaches,

  // User session
  getCachedUserSession,
  invalidateUserSession,

  // Feature flags
  getCachedFeatureFlags,
  isFeatureEnabled,

  // Types
  type CachedOrganizationSettings,
  type CachedPublicProfile,
  type CachedUserSession,
  type MarketplaceSearchParams,
  type MarketplaceSearchResult,
} from './cache/cached-queries';
