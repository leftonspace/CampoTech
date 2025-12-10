/**
 * Discovery Service
 * =================
 *
 * Main service for business discovery and search.
 * Combines geo-search, ranking, and filtering.
 * Phase 15: Consumer Marketplace
 */

import { Pool, PoolClient } from 'pg';
import {
  BusinessPublicProfile,
  ServiceCategory,
  BusinessBadge,
  ConsumerPaginationParams,
  ConsumerPaginatedResult,
} from '../consumer.types';
import {
  BusinessSearchParams,
  BusinessSearchResult,
  SearchFilters,
  MatchingCriteria,
  MatchedBusiness,
  RankedBusiness,
  CATEGORY_METADATA,
} from './discovery.types';
import { RankingService } from './ranking.service';
import { GeoSearchService } from './geo-search.service';

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORY (for business profiles)
// ═══════════════════════════════════════════════════════════════════════════════

export class BusinessPublicProfileRepository {
  constructor(private pool: Pool) {}

  async findById(id: string, client?: PoolClient): Promise<BusinessPublicProfile | null> {
    const conn = client || this.pool;
    const result = await conn.query(
      `SELECT * FROM business_public_profiles WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByOrgId(orgId: string, client?: PoolClient): Promise<BusinessPublicProfile | null> {
    const conn = client || this.pool;
    const result = await conn.query(
      `SELECT * FROM business_public_profiles WHERE org_id = $1`,
      [orgId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findBySlug(slug: string, client?: PoolClient): Promise<BusinessPublicProfile | null> {
    const conn = client || this.pool;
    const result = await conn.query(
      `SELECT * FROM business_public_profiles WHERE slug = $1 AND is_visible = true`,
      [slug]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByIds(ids: string[], client?: PoolClient): Promise<BusinessPublicProfile[]> {
    if (ids.length === 0) return [];
    const conn = client || this.pool;
    const result = await conn.query(
      `SELECT * FROM business_public_profiles WHERE id = ANY($1)`,
      [ids]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async search(
    params: BusinessSearchParams,
    pagination: ConsumerPaginationParams,
    client?: PoolClient
  ): Promise<ConsumerPaginatedResult<BusinessPublicProfile>> {
    const conn = client || this.pool;
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE is_visible = true AND is_suspended = false';
    const values: any[] = [];
    let paramIndex = 1;

    // Text search
    if (params.query) {
      whereClause += ` AND (
        display_name ILIKE $${paramIndex} OR
        description ILIKE $${paramIndex} OR
        short_description ILIKE $${paramIndex}
      )`;
      values.push(`%${params.query}%`);
      paramIndex++;
    }

    // Category filter
    if (params.category) {
      whereClause += ` AND $${paramIndex} = ANY(categories)`;
      values.push(params.category);
      paramIndex++;
    }

    if (params.categories && params.categories.length > 0) {
      whereClause += ` AND categories && $${paramIndex}::service_category[]`;
      values.push(params.categories);
      paramIndex++;
    }

    // City filter
    if (params.city) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(service_areas) sa
        WHERE sa->>'city' = $${paramIndex}
      )`;
      values.push(params.city);
      paramIndex++;
    }

    // Neighborhood filter
    if (params.neighborhood) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(service_areas) sa
        WHERE sa->>'neighborhood' = $${paramIndex}
      )`;
      values.push(params.neighborhood);
      paramIndex++;
    }

    // Rating filter
    if (params.minRating) {
      whereClause += ` AND overall_rating >= $${paramIndex}`;
      values.push(params.minRating);
      paramIndex++;
    }

    // Response time filter
    if (params.maxResponseTimeHours) {
      whereClause += ` AND (avg_response_time_hours IS NULL OR avg_response_time_hours <= $${paramIndex})`;
      values.push(params.maxResponseTimeHours);
      paramIndex++;
    }

    // Emergency filter
    if (params.hasEmergency) {
      whereClause += ` AND accepts_emergency = true`;
    }

    // Verified filter
    if (params.verified) {
      whereClause += ` AND cuit_verified = true`;
    }

    // Accepting new clients filter
    if (params.acceptingNewClients) {
      whereClause += ` AND accepting_new_clients = true`;
    }

    // Badge filter
    if (params.badges && params.badges.length > 0) {
      whereClause += ` AND badges && $${paramIndex}::business_badge[]`;
      values.push(params.badges);
      paramIndex++;
    }

    // Count query
    const countResult = await conn.query(
      `SELECT COUNT(*) FROM business_public_profiles ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Sort
    let orderBy = 'overall_rating DESC, rating_count DESC';
    if (params.sortBy) {
      switch (params.sortBy) {
        case 'rating':
          orderBy = `overall_rating ${params.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
          break;
        case 'reviews':
          orderBy = `rating_count ${params.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
          break;
        case 'response_time':
          orderBy = `avg_response_time_hours ${params.sortOrder === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`;
          break;
        default:
          orderBy = 'overall_rating DESC, rating_count DESC';
      }
    }

    // Data query
    const result = await conn.query(
      `SELECT * FROM business_public_profiles ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      data: result.rows.map(row => this.mapRow(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTopRated(
    category?: ServiceCategory,
    city?: string,
    limit = 10,
    client?: PoolClient
  ): Promise<BusinessPublicProfile[]> {
    const conn = client || this.pool;

    let whereClause = 'WHERE is_visible = true AND is_suspended = false AND rating_count >= 5';
    const values: any[] = [];
    let paramIndex = 1;

    if (category) {
      whereClause += ` AND $${paramIndex} = ANY(categories)`;
      values.push(category);
      paramIndex++;
    }

    if (city) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(service_areas) sa
        WHERE sa->>'city' = $${paramIndex}
      )`;
      values.push(city);
      paramIndex++;
    }

    const result = await conn.query(
      `SELECT * FROM business_public_profiles ${whereClause}
       ORDER BY overall_rating DESC, rating_count DESC
       LIMIT $${paramIndex}`,
      [...values, limit]
    );

    return result.rows.map(row => this.mapRow(row));
  }

  async getFeatured(limit = 10, client?: PoolClient): Promise<BusinessPublicProfile[]> {
    const conn = client || this.pool;
    const result = await conn.query(
      `SELECT * FROM business_public_profiles
       WHERE is_visible = true AND is_suspended = false AND is_featured = true
       ORDER BY overall_rating DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async recordProfileView(
    businessProfileId: string,
    consumerId: string | null,
    source: string,
    category?: ServiceCategory,
    viewLat?: number,
    viewLng?: number,
    client?: PoolClient
  ): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `INSERT INTO business_profile_views (
        business_profile_id, consumer_id, source, category, view_lat, view_lng
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [businessProfileId, consumerId, source, category, viewLat, viewLng]
    );
  }

  private mapRow(row: Record<string, any>): BusinessPublicProfile {
    return {
      id: row.id,
      orgId: row.org_id,
      displayName: row.display_name,
      slug: row.slug,
      logoUrl: row.logo_url,
      coverPhotoUrl: row.cover_photo_url,
      description: row.description,
      shortDescription: row.short_description,
      galleryPhotos: row.gallery_photos || [],
      workShowcase: row.work_showcase || [],
      categories: row.categories || [],
      services: row.services || [],
      serviceAreas: row.service_areas || [],
      maxTravelDistanceKm: row.max_travel_distance_km || 20,
      acceptsQuotes: row.accepts_quotes,
      autoRespondQuotes: row.auto_respond_quotes,
      responseTemplate: row.response_template,
      workingHours: row.working_hours || {},
      acceptsEmergency: row.accepts_emergency,
      emergencySurchargePercentage: row.emergency_surcharge_percentage,
      acceptingNewClients: row.accepting_new_clients,
      maxActiveQuotes: row.max_active_quotes,
      quoteResponseTimeHours: row.quote_response_time_hours,
      cuitVerified: row.cuit_verified,
      licenseVerified: row.license_verified,
      licenseNumber: row.license_number,
      licenseExpiry: row.license_expiry,
      insuranceVerified: row.insurance_verified,
      insuranceProvider: row.insurance_provider,
      insuranceExpiry: row.insurance_expiry,
      backgroundCheckVerified: row.background_check_verified,
      backgroundCheckDate: row.background_check_date,
      badges: row.badges || [],
      overallRating: parseFloat(row.overall_rating) || 0,
      ratingCount: row.rating_count || 0,
      punctualityRating: row.punctuality_rating ? parseFloat(row.punctuality_rating) : undefined,
      qualityRating: row.quality_rating ? parseFloat(row.quality_rating) : undefined,
      priceRating: row.price_rating ? parseFloat(row.price_rating) : undefined,
      communicationRating: row.communication_rating ? parseFloat(row.communication_rating) : undefined,
      totalJobsCompleted: row.total_jobs_completed || 0,
      totalQuotesSent: row.total_quotes_sent || 0,
      quoteAcceptanceRate: row.quote_acceptance_rate ? parseFloat(row.quote_acceptance_rate) : undefined,
      avgResponseTimeHours: row.avg_response_time_hours ? parseFloat(row.avg_response_time_hours) : undefined,
      yearsOnPlatform: parseFloat(row.years_on_platform) || 0,
      profileCompleteness: row.profile_completeness || 0,
      isVisible: row.is_visible,
      isFeatured: row.is_featured,
      isSuspended: row.is_suspended,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastActiveAt: row.last_active_at,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISCOVERY SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class DiscoveryService {
  private profileRepo: BusinessPublicProfileRepository;
  private rankingService: RankingService;
  private geoSearchService: GeoSearchService;

  constructor(pool: Pool) {
    this.profileRepo = new BusinessPublicProfileRepository(pool);
    this.rankingService = new RankingService();
    this.geoSearchService = new GeoSearchService(pool);
  }

  /**
   * Search businesses with full-featured search
   */
  async searchBusinesses(
    params: BusinessSearchParams,
    pagination: ConsumerPaginationParams
  ): Promise<{
    results: BusinessSearchResult[];
    total: number;
    page: number;
    totalPages: number;
    filters: SearchFilters;
  }> {
    // Get initial results from database
    const dbResults = await this.profileRepo.search(params, pagination);

    // If geo-search is requested, filter and sort by distance
    let results: BusinessSearchResult[];

    if (params.lat !== undefined && params.lng !== undefined) {
      // Apply ranking with location context
      const rankedBusinesses = this.rankingService.rankBusinesses(dbResults.data, {
        consumerLat: params.lat,
        consumerLng: params.lng,
        requestedCategory: params.category,
      });

      results = rankedBusinesses.map(ranked => ({
        business: ranked.business,
        distance: this.geoSearchService.calculateDistance(
          params.lat!,
          params.lng!,
          -34.6037, // Default BA coordinates (would use actual business location)
          -58.3816
        ),
        matchScore: ranked.score,
        relevanceScore: ranked.breakdown.relevanceScore,
      }));

      // Sort by distance if requested
      if (params.sortBy === 'distance') {
        results.sort((a, b) =>
          params.sortOrder === 'asc'
            ? (a.distance || 0) - (b.distance || 0)
            : (b.distance || 0) - (a.distance || 0)
        );
      }
    } else {
      // Apply ranking without location
      const rankedBusinesses = this.rankingService.rankBusinesses(dbResults.data, {
        requestedCategory: params.category,
      });

      results = rankedBusinesses.map(ranked => ({
        business: ranked.business,
        matchScore: ranked.score,
        relevanceScore: ranked.breakdown.relevanceScore,
      }));
    }

    // Build filters from results
    const filters = this.buildSearchFilters(dbResults.data);

    return {
      results,
      total: dbResults.total,
      page: dbResults.page,
      totalPages: dbResults.totalPages,
      filters,
    };
  }

  /**
   * Get business by ID
   */
  async getBusinessById(id: string): Promise<BusinessPublicProfile | null> {
    return this.profileRepo.findById(id);
  }

  /**
   * Get business by slug (for SEO URLs)
   */
  async getBusinessBySlug(slug: string): Promise<BusinessPublicProfile | null> {
    return this.profileRepo.findBySlug(slug);
  }

  /**
   * Get top-rated businesses
   */
  async getTopRated(
    category?: ServiceCategory,
    city?: string,
    limit = 10
  ): Promise<BusinessPublicProfile[]> {
    return this.profileRepo.getTopRated(category, city, limit);
  }

  /**
   * Get featured businesses
   */
  async getFeatured(limit = 10): Promise<BusinessPublicProfile[]> {
    return this.profileRepo.getFeatured(limit);
  }

  /**
   * Find businesses to match with a service request
   */
  async matchBusinessesForRequest(
    criteria: MatchingCriteria
  ): Promise<MatchedBusiness[]> {
    const maxBusinesses = criteria.maxBusinesses || 10;

    // First, find businesses serving the area
    const nearbyBusinesses = await this.geoSearchService.findServingArea(
      criteria.location.lat,
      criteria.location.lng,
      criteria.location.city || 'Buenos Aires',
      criteria.location.neighborhood,
      criteria.serviceCategory,
      maxBusinesses * 2 // Get more candidates for ranking
    );

    if (nearbyBusinesses.length === 0) {
      return [];
    }

    // Get full profiles
    const businessIds = nearbyBusinesses.map(b => b.businessId);
    const profiles = await this.profileRepo.findByIds(businessIds);

    // Rank them
    const rankedBusinesses = this.rankingService.rankBusinesses(profiles, {
      consumerLat: criteria.location.lat,
      consumerLng: criteria.location.lng,
      requestedCategory: criteria.serviceCategory,
      requestedUrgency: criteria.urgency,
    });

    // Take top N
    const topBusinesses = rankedBusinesses.slice(0, maxBusinesses);

    // Map to MatchedBusiness
    const distanceMap = new Map(nearbyBusinesses.map(b => [b.businessId, b.distance]));

    return topBusinesses.map(ranked => ({
      businessId: ranked.business.id,
      orgId: ranked.business.orgId,
      displayName: ranked.business.displayName,
      overallRating: ranked.business.overallRating,
      ratingCount: ranked.business.ratingCount,
      distance: distanceMap.get(ranked.business.id),
      matchScore: ranked.score,
      responseTimeHours: ranked.business.avgResponseTimeHours,
    }));
  }

  /**
   * Record a profile view
   */
  async recordProfileView(
    businessProfileId: string,
    consumerId: string | null,
    source: string,
    category?: ServiceCategory,
    viewLat?: number,
    viewLng?: number
  ): Promise<void> {
    await this.profileRepo.recordProfileView(
      businessProfileId,
      consumerId,
      source,
      category,
      viewLat,
      viewLng
    );
  }

  /**
   * Get popular categories in a city
   */
  async getPopularCategories(city?: string): Promise<{
    category: ServiceCategory;
    displayName: string;
    icon: string;
    businessCount: number;
  }[]> {
    // Return predefined categories with metadata
    return CATEGORY_METADATA.slice(0, 8).map(meta => ({
      category: meta.category,
      displayName: meta.displayNameEs,
      icon: meta.icon,
      businessCount: 0, // Would query actual count
    }));
  }

  /**
   * Get popular neighborhoods for a category
   */
  async getPopularNeighborhoods(
    city: string,
    category?: ServiceCategory,
    limit = 20
  ): Promise<{ neighborhood: string; businessCount: number }[]> {
    return this.geoSearchService.getPopularNeighborhoods(city, category, limit);
  }

  /**
   * Build search filters from results
   */
  private buildSearchFilters(businesses: BusinessPublicProfile[]): SearchFilters {
    const categoryCount = new Map<ServiceCategory, number>();
    const badgeCount = new Map<BusinessBadge, number>();
    const neighborhoodCount = new Map<string, number>();
    const ratingBuckets = [
      { min: 4.5, max: 5, count: 0 },
      { min: 4, max: 4.5, count: 0 },
      { min: 3.5, max: 4, count: 0 },
      { min: 3, max: 3.5, count: 0 },
      { min: 0, max: 3, count: 0 },
    ];

    for (const business of businesses) {
      // Categories
      for (const cat of business.categories) {
        categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
      }

      // Badges
      for (const badge of business.badges) {
        badgeCount.set(badge, (badgeCount.get(badge) || 0) + 1);
      }

      // Neighborhoods
      for (const area of business.serviceAreas) {
        if (area.neighborhood) {
          neighborhoodCount.set(area.neighborhood, (neighborhoodCount.get(area.neighborhood) || 0) + 1);
        }
      }

      // Ratings
      for (const bucket of ratingBuckets) {
        if (business.overallRating >= bucket.min && business.overallRating < bucket.max) {
          bucket.count++;
          break;
        }
      }
    }

    return {
      categories: Array.from(categoryCount.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      badges: Array.from(badgeCount.entries())
        .map(([badge, count]) => ({ badge, count }))
        .sort((a, b) => b.count - a.count),
      ratingRanges: ratingBuckets.filter(b => b.count > 0),
      neighborhoods: Array.from(neighborhoodCount.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    };
  }
}
