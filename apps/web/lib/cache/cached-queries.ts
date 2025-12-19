/**
 * CampoTech Cached Queries (Phase 5.2.2)
 * ======================================
 *
 * Pre-built cached query functions for common data access patterns.
 * These functions implement the cache-aside pattern with appropriate TTLs.
 *
 * Cached Queries:
 * - Organization settings (1 hour TTL)
 * - Tier limits (24 hours TTL)
 * - Public profiles (5 minutes TTL)
 * - Search results (1 minute TTL)
 */

import { prisma } from '@/lib/prisma';
import {
  cached,
  cachedWithSWR,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  CACHE_TTL,
  CACHE_PREFIX,
  orgSettingsKey,
  tierLimitsKey,
  publicProfileKey,
  searchResultsKey,
  hashSearchQuery,
  invalidateOrgCache,
} from './index';
import {
  TIER_LIMITS,
  TIER_CONFIGS,
  type SubscriptionTier,
  type TierLimits,
  type TierConfig,
} from '@/lib/config/tier-limits';

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZATION SETTINGS (TTL: 1 hour)
// ═══════════════════════════════════════════════════════════════════════════════

export interface CachedOrganizationSettings {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  logo: string | null;
  settings: Record<string, unknown>;
  tier?: SubscriptionTier;
}

/**
 * Get organization settings from cache or database
 *
 * @param orgId - Organization ID
 * @returns Organization settings or null if not found
 *
 * @example
 * const settings = await getCachedOrgSettings('org_123');
 */
export async function getCachedOrgSettings(
  orgId: string
): Promise<CachedOrganizationSettings | null> {
  const key = orgSettingsKey(orgId);

  return cached(
    key,
    async () => {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          logo: true,
          settings: true,
        },
      });

      if (!org) return null;

      // Parse settings JSON if needed
      const settings =
        typeof org.settings === 'string'
          ? JSON.parse(org.settings)
          : (org.settings as Record<string, unknown>);

      return {
        id: org.id,
        name: org.name,
        phone: org.phone,
        email: org.email,
        logo: org.logo,
        settings,
        tier: (settings?.subscriptionTier as SubscriptionTier) || 'FREE',
      };
    },
    CACHE_TTL.ORGANIZATION_SETTINGS
  );
}

/**
 * Get organization with full details (uses SWR for better UX)
 *
 * @param orgId - Organization ID
 * @returns Full organization data
 */
export async function getCachedOrgFull(orgId: string) {
  const key = `${CACHE_PREFIX.ORG_SETTINGS}:full:${orgId}`;

  return cachedWithSWR(
    key,
    async () => {
      return prisma.organization.findUnique({
        where: { id: orgId },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              role: true,
              isActive: true,
            },
          },
        },
      });
    },
    CACHE_TTL.ORGANIZATION_SETTINGS,
    300 // 5 min SWR window
  );
}

/**
 * Invalidate organization settings cache
 * Call this when organization settings are updated
 */
export async function invalidateOrgSettings(orgId: string): Promise<void> {
  await Promise.all([
    cacheDelete(orgSettingsKey(orgId)),
    cacheDelete(`${CACHE_PREFIX.ORG_SETTINGS}:full:${orgId}`),
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER LIMITS (TTL: 24 hours)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get tier limits from cache
 * Since tier limits are static, we cache them for 24 hours
 *
 * @param tier - Subscription tier
 * @returns Tier limits
 */
export async function getCachedTierLimits(tier: SubscriptionTier): Promise<TierLimits> {
  const key = tierLimitsKey(tier);

  return cached(
    key,
    async () => {
      // Tier limits are defined in config, no DB query needed
      return TIER_LIMITS[tier] || TIER_LIMITS.FREE;
    },
    CACHE_TTL.TIER_LIMITS
  );
}

/**
 * Get all tier configurations from cache
 *
 * @returns All tier configurations
 */
export async function getCachedTierConfigs(): Promise<TierConfig[]> {
  const key = `${CACHE_PREFIX.TIER_LIMITS}:all`;

  return cached(
    key,
    async () => {
      return TIER_CONFIGS;
    },
    CACHE_TTL.TIER_LIMITS
  );
}

/**
 * Get tier limits for an organization (combines org lookup + tier limits)
 *
 * @param orgId - Organization ID
 * @returns Tier limits for the organization
 */
export async function getOrgTierLimits(orgId: string): Promise<TierLimits> {
  const orgSettings = await getCachedOrgSettings(orgId);
  const tier = orgSettings?.tier || 'FREE';
  return getCachedTierLimits(tier);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC PROFILES (TTL: 5 minutes)
// ═══════════════════════════════════════════════════════════════════════════════

export interface CachedPublicProfile {
  id: string;
  organizationId: string;
  displayName: string;
  description: string | null;
  logo: string | null;
  coverPhoto: string | null;
  categories: string[];
  services: Record<string, unknown>[];
  serviceArea: Record<string, unknown> | null;
  address: string | null;
  whatsappNumber: string;
  phone: string | null;
  averageRating: number;
  totalReviews: number;
  totalJobs: number;
  responseRate: number;
  responseTime: number;
  cuitVerified: boolean;
  insuranceVerified: boolean;
  isActive: boolean;
}

/**
 * Get public profile for marketplace display
 *
 * @param orgId - Organization ID
 * @returns Public profile or null if not found
 */
export async function getCachedPublicProfile(
  orgId: string
): Promise<CachedPublicProfile | null> {
  const key = publicProfileKey(orgId);

  return cached(
    key,
    async () => {
      const profile = await prisma.businessPublicProfile.findUnique({
        where: { organizationId: orgId },
      });

      if (!profile) return null;

      return {
        id: profile.id,
        organizationId: profile.organizationId,
        displayName: profile.displayName,
        description: profile.description,
        logo: profile.logo,
        coverPhoto: profile.coverPhoto,
        categories: profile.categories,
        services: (profile.services as Record<string, unknown>[]) || [],
        serviceArea: profile.serviceArea as Record<string, unknown> | null,
        address: profile.address,
        whatsappNumber: profile.whatsappNumber,
        phone: profile.phone,
        averageRating: profile.averageRating,
        totalReviews: profile.totalReviews,
        totalJobs: profile.totalJobs,
        responseRate: profile.responseRate,
        responseTime: profile.responseTime,
        cuitVerified: profile.cuitVerified,
        insuranceVerified: profile.insuranceVerified,
        isActive: profile.isActive,
      };
    },
    CACHE_TTL.PUBLIC_PROFILES
  );
}

/**
 * Get multiple public profiles (for listing pages)
 *
 * @param orgIds - Array of organization IDs
 * @returns Map of orgId to profile
 */
export async function getCachedPublicProfiles(
  orgIds: string[]
): Promise<Map<string, CachedPublicProfile>> {
  const results = new Map<string, CachedPublicProfile>();

  // Fetch all profiles in parallel
  const profiles = await Promise.all(
    orgIds.map((orgId) => getCachedPublicProfile(orgId))
  );

  // Build map
  orgIds.forEach((orgId, index) => {
    const profile = profiles[index];
    if (profile) {
      results.set(orgId, profile);
    }
  });

  return results;
}

/**
 * Invalidate public profile cache
 * Call when profile is updated
 */
export async function invalidatePublicProfile(orgId: string): Promise<void> {
  await cacheDelete(publicProfileKey(orgId));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH RESULTS (TTL: 1 minute)
// ═══════════════════════════════════════════════════════════════════════════════

export interface MarketplaceSearchParams {
  query?: string;
  categories?: string[];
  minRating?: number;
  location?: {
    lat: number;
    lng: number;
    radiusKm: number;
  };
  sortBy?: 'rating' | 'distance' | 'responseTime';
  page?: number;
  limit?: number;
}

export interface MarketplaceSearchResult {
  profiles: CachedPublicProfile[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Search marketplace profiles with caching
 *
 * @param params - Search parameters
 * @returns Search results
 */
export async function searchMarketplaceProfiles(
  params: MarketplaceSearchParams
): Promise<MarketplaceSearchResult> {
  // Generate cache key from params
  const queryHash = hashSearchQuery(params);
  const key = searchResultsKey(queryHash);

  return cached(
    key,
    async () => {
      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Record<string, unknown> = {
        isActive: true,
      };

      if (params.minRating) {
        where.averageRating = { gte: params.minRating };
      }

      if (params.categories && params.categories.length > 0) {
        where.categories = { hasSome: params.categories };
      }

      if (params.query) {
        where.OR = [
          { displayName: { contains: params.query, mode: 'insensitive' } },
          { description: { contains: params.query, mode: 'insensitive' } },
        ];
      }

      // Build order by
      let orderBy: Record<string, unknown> = { averageRating: 'desc' };
      if (params.sortBy === 'responseTime') {
        orderBy = { responseTime: 'asc' };
      }

      // Execute query
      const [profiles, total] = await Promise.all([
        prisma.businessPublicProfile.findMany({
          where,
          orderBy,
          skip,
          take: limit,
        }),
        prisma.businessPublicProfile.count({ where }),
      ]);

      return {
        profiles: profiles.map((p) => ({
          id: p.id,
          organizationId: p.organizationId,
          displayName: p.displayName,
          description: p.description,
          logo: p.logo,
          coverPhoto: p.coverPhoto,
          categories: p.categories,
          services: (p.services as Record<string, unknown>[]) || [],
          serviceArea: p.serviceArea as Record<string, unknown> | null,
          address: p.address,
          whatsappNumber: p.whatsappNumber,
          phone: p.phone,
          averageRating: p.averageRating,
          totalReviews: p.totalReviews,
          totalJobs: p.totalJobs,
          responseRate: p.responseRate,
          responseTime: p.responseTime,
          cuitVerified: p.cuitVerified,
          insuranceVerified: p.insuranceVerified,
          isActive: p.isActive,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    },
    CACHE_TTL.SEARCH_RESULTS
  );
}

/**
 * Get top-rated profiles (for homepage/featured section)
 *
 * @param limit - Number of profiles to return
 * @returns Top-rated profiles
 */
export async function getTopRatedProfiles(
  limit: number = 10
): Promise<CachedPublicProfile[]> {
  const key = `${CACHE_PREFIX.SEARCH}:top-rated:${limit}`;

  return cached(
    key,
    async () => {
      const profiles = await prisma.businessPublicProfile.findMany({
        where: {
          isActive: true,
          totalReviews: { gte: 5 }, // At least 5 reviews
        },
        orderBy: { averageRating: 'desc' },
        take: limit,
      });

      return profiles.map((p) => ({
        id: p.id,
        organizationId: p.organizationId,
        displayName: p.displayName,
        description: p.description,
        logo: p.logo,
        coverPhoto: p.coverPhoto,
        categories: p.categories,
        services: (p.services as Record<string, unknown>[]) || [],
        serviceArea: p.serviceArea as Record<string, unknown> | null,
        address: p.address,
        whatsappNumber: p.whatsappNumber,
        phone: p.phone,
        averageRating: p.averageRating,
        totalReviews: p.totalReviews,
        totalJobs: p.totalJobs,
        responseRate: p.responseRate,
        responseTime: p.responseTime,
        cuitVerified: p.cuitVerified,
        insuranceVerified: p.insuranceVerified,
        isActive: p.isActive,
      }));
    },
    CACHE_TTL.PUBLIC_PROFILES // 5 minutes for featured content
  );
}

/**
 * Get profiles by category
 *
 * @param category - Category slug
 * @param limit - Number of profiles to return
 * @returns Profiles in category
 */
export async function getProfilesByCategory(
  category: string,
  limit: number = 20
): Promise<CachedPublicProfile[]> {
  const key = `${CACHE_PREFIX.SEARCH}:category:${category}:${limit}`;

  return cached(
    key,
    async () => {
      const profiles = await prisma.businessPublicProfile.findMany({
        where: {
          isActive: true,
          categories: { has: category },
        },
        orderBy: { averageRating: 'desc' },
        take: limit,
      });

      return profiles.map((p) => ({
        id: p.id,
        organizationId: p.organizationId,
        displayName: p.displayName,
        description: p.description,
        logo: p.logo,
        coverPhoto: p.coverPhoto,
        categories: p.categories,
        services: (p.services as Record<string, unknown>[]) || [],
        serviceArea: p.serviceArea as Record<string, unknown> | null,
        address: p.address,
        whatsappNumber: p.whatsappNumber,
        phone: p.phone,
        averageRating: p.averageRating,
        totalReviews: p.totalReviews,
        totalJobs: p.totalJobs,
        responseRate: p.responseRate,
        responseTime: p.responseTime,
        cuitVerified: p.cuitVerified,
        insuranceVerified: p.insuranceVerified,
        isActive: p.isActive,
      }));
    },
    CACHE_TTL.SEARCH_RESULTS
  );
}

/**
 * Invalidate all search-related caches
 * Call when profile data changes significantly
 */
export async function invalidateAllSearchCaches(): Promise<void> {
  await cacheDeletePattern(`${CACHE_PREFIX.SEARCH}:*`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER SESSION DATA (TTL: 15 minutes)
// ═══════════════════════════════════════════════════════════════════════════════

export interface CachedUserSession {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: string;
  organizationId: string;
  organizationName: string;
  tier: SubscriptionTier;
}

/**
 * Get user session data from cache
 *
 * @param userId - User ID
 * @returns User session data
 */
export async function getCachedUserSession(
  userId: string
): Promise<CachedUserSession | null> {
  const key = `user:session:${userId}`;

  return cached(
    key,
    async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              settings: true,
            },
          },
        },
      });

      if (!user || !user.organization) return null;

      const settings =
        typeof user.organization.settings === 'string'
          ? JSON.parse(user.organization.settings)
          : (user.organization.settings as Record<string, unknown>);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        tier: (settings?.subscriptionTier as SubscriptionTier) || 'FREE',
      };
    },
    CACHE_TTL.USER_SESSION
  );
}

/**
 * Invalidate user session cache
 */
export async function invalidateUserSession(userId: string): Promise<void> {
  await cacheDelete(`user:session:${userId}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE FLAGS (TTL: 5 minutes)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get feature flags for an organization
 *
 * @param orgId - Organization ID
 * @returns Feature flags object
 */
export async function getCachedFeatureFlags(
  orgId: string
): Promise<Record<string, boolean>> {
  const key = `features:${orgId}`;

  return cached(
    key,
    async () => {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { settings: true },
      });

      if (!org) return {};

      const settings =
        typeof org.settings === 'string'
          ? JSON.parse(org.settings)
          : (org.settings as Record<string, unknown>);

      return (settings?.featureFlags as Record<string, boolean>) || {};
    },
    CACHE_TTL.FEATURE_FLAGS
  );
}

/**
 * Check if a feature is enabled for an organization
 *
 * @param orgId - Organization ID
 * @param feature - Feature name
 * @returns Whether the feature is enabled
 */
export async function isFeatureEnabled(
  orgId: string,
  feature: string
): Promise<boolean> {
  const flags = await getCachedFeatureFlags(orgId);
  return flags[feature] === true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  invalidateOrgCache,
};
