/**
 * Discovery Routes
 * ================
 *
 * API routes for business discovery and search.
 * Phase 15: Consumer Marketplace
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { DiscoveryService, BusinessPublicProfileRepository } from './discovery.service';
import { RankingService } from './ranking.service';
import { optionalConsumerAuth } from '../auth/consumer-auth.middleware';
import { ServiceCategory, BusinessBadge } from '../consumer.types';
import { CATEGORY_METADATA, getCategoryDisplayName } from './discovery.types';

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createDiscoveryRoutes(pool: Pool): Router {
  const router = Router();
  const service = new DiscoveryService(pool);
  const rankingService = new RankingService();

  /**
   * GET /discover/search
   * Search businesses with filters
   */
  router.get(
    '/search',
    optionalConsumerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const params = {
          query: req.query.q as string | undefined,
          category: req.query.category as ServiceCategory | undefined,
          categories: req.query.categories
            ? (req.query.categories as string).split(',') as ServiceCategory[]
            : undefined,
          lat: req.query.lat ? parseFloat(req.query.lat as string) : undefined,
          lng: req.query.lng ? parseFloat(req.query.lng as string) : undefined,
          radiusKm: req.query.radius ? parseFloat(req.query.radius as string) : undefined,
          city: req.query.city as string | undefined,
          neighborhood: req.query.neighborhood as string | undefined,
          minRating: req.query.minRating ? parseFloat(req.query.minRating as string) : undefined,
          maxResponseTimeHours: req.query.maxResponseTime
            ? parseFloat(req.query.maxResponseTime as string)
            : undefined,
          hasEmergency: req.query.emergency === 'true',
          verified: req.query.verified === 'true',
          acceptingNewClients: req.query.acceptingNew !== 'false',
          badges: req.query.badges
            ? (req.query.badges as string).split(',') as BusinessBadge[]
            : undefined,
          sortBy: req.query.sortBy as 'rating' | 'distance' | 'response_time' | 'reviews' | 'relevance',
          sortOrder: req.query.sortOrder as 'asc' | 'desc',
        };

        const pagination = {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
        };

        const results = await service.searchBusinesses(params, pagination);

        res.json({
          success: true,
          data: results.results.map(r => formatSearchResult(r)),
          meta: {
            total: results.total,
            page: results.page,
            totalPages: results.totalPages,
          },
          filters: results.filters,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /discover/categories
   * Get available service categories
   */
  router.get(
    '/categories',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const city = req.query.city as string | undefined;
        const popular = await service.getPopularCategories(city);

        res.json({
          success: true,
          data: CATEGORY_METADATA.map(meta => ({
            id: meta.category,
            name: meta.displayNameEs,
            nameEn: meta.displayName,
            icon: meta.icon,
            description: meta.description,
            popularServices: meta.popularServices,
          })),
          popular: popular.slice(0, 8),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /discover/top-rated
   * Get top-rated businesses
   */
  router.get(
    '/top-rated',
    optionalConsumerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const category = req.query.category as ServiceCategory | undefined;
        const city = req.query.city as string | undefined;
        const limit = parseInt(req.query.limit as string) || 10;

        const businesses = await service.getTopRated(category, city, limit);

        res.json({
          success: true,
          data: businesses.map(formatBusinessCard),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /discover/featured
   * Get featured businesses
   */
  router.get(
    '/featured',
    optionalConsumerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        const businesses = await service.getFeatured(limit);

        res.json({
          success: true,
          data: businesses.map(formatBusinessCard),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /discover/neighborhoods
   * Get popular neighborhoods
   */
  router.get(
    '/neighborhoods',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const city = (req.query.city as string) || 'Buenos Aires';
        const category = req.query.category as ServiceCategory | undefined;
        const limit = parseInt(req.query.limit as string) || 20;

        const neighborhoods = await service.getPopularNeighborhoods(city, category, limit);

        res.json({
          success: true,
          data: neighborhoods,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /discover/business/:id
   * Get business detail by ID
   */
  router.get(
    '/business/:id',
    optionalConsumerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const business = await service.getBusinessById(req.params.id);

        if (!business) {
          return res.status(404).json({
            error: {
              code: 'BUSINESS_NOT_FOUND',
              message: 'Business not found',
            },
          });
        }

        // Record view
        const source = req.query.source as string || 'direct';
        await service.recordProfileView(
          business.id,
          req.consumer?.consumerId || null,
          source,
          req.query.category as ServiceCategory,
          req.query.lat ? parseFloat(req.query.lat as string) : undefined,
          req.query.lng ? parseFloat(req.query.lng as string) : undefined
        );

        // Get ranking explanation
        const ranked = rankingService.calculateScore(business, {
          consumerLat: req.query.lat ? parseFloat(req.query.lat as string) : undefined,
          consumerLng: req.query.lng ? parseFloat(req.query.lng as string) : undefined,
        });
        const highlights = rankingService.explainRanking(ranked);

        res.json({
          success: true,
          data: {
            ...formatBusinessDetail(business),
            highlights,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /discover/business/slug/:slug
   * Get business by URL slug (SEO)
   */
  router.get(
    '/business/slug/:slug',
    optionalConsumerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const business = await service.getBusinessBySlug(req.params.slug);

        if (!business) {
          return res.status(404).json({
            error: {
              code: 'BUSINESS_NOT_FOUND',
              message: 'Business not found',
            },
          });
        }

        // Record view
        await service.recordProfileView(
          business.id,
          req.consumer?.consumerId || null,
          'seo',
          undefined,
          undefined,
          undefined
        );

        res.json({
          success: true,
          data: formatBusinessDetail(business),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /discover/match
   * Find businesses matching criteria (for service requests)
   */
  router.post(
    '/match',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { category, lat, lng, city, neighborhood, urgency, budgetRange, maxBusinesses } =
          req.body;

        if (!category || lat === undefined || lng === undefined) {
          return res.status(400).json({
            error: {
              code: 'MISSING_PARAMS',
              message: 'Category and location (lat, lng) are required',
            },
          });
        }

        const matches = await service.matchBusinessesForRequest({
          serviceCategory: category,
          location: { lat, lng, city, neighborhood },
          urgency,
          budgetRange,
          maxBusinesses,
        });

        res.json({
          success: true,
          data: matches,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[Discovery] Unhandled error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatSearchResult(result: any) {
  return {
    id: result.business.id,
    displayName: result.business.displayName,
    slug: result.business.slug,
    logoUrl: result.business.logoUrl,
    shortDescription: result.business.shortDescription,
    categories: result.business.categories,
    overallRating: result.business.overallRating,
    ratingCount: result.business.ratingCount,
    badges: result.business.badges,
    acceptsEmergency: result.business.acceptsEmergency,
    avgResponseTimeHours: result.business.avgResponseTimeHours,
    distance: result.distance,
    matchScore: result.matchScore,
  };
}

function formatBusinessCard(business: any) {
  return {
    id: business.id,
    displayName: business.displayName,
    slug: business.slug,
    logoUrl: business.logoUrl,
    shortDescription: business.shortDescription,
    categories: business.categories,
    overallRating: business.overallRating,
    ratingCount: business.ratingCount,
    badges: business.badges,
    acceptsEmergency: business.acceptsEmergency,
    avgResponseTimeHours: business.avgResponseTimeHours,
  };
}

function formatBusinessDetail(business: any) {
  return {
    id: business.id,
    orgId: business.orgId,
    displayName: business.displayName,
    slug: business.slug,
    logoUrl: business.logoUrl,
    coverPhotoUrl: business.coverPhotoUrl,
    description: business.description,
    shortDescription: business.shortDescription,
    galleryPhotos: business.galleryPhotos,
    workShowcase: business.workShowcase,
    categories: business.categories,
    services: business.services,
    serviceAreas: business.serviceAreas,
    maxTravelDistanceKm: business.maxTravelDistanceKm,
    workingHours: business.workingHours,
    acceptsEmergency: business.acceptsEmergency,
    emergencySurchargePercentage: business.emergencySurchargePercentage,
    acceptingNewClients: business.acceptingNewClients,
    quoteResponseTimeHours: business.quoteResponseTimeHours,
    cuitVerified: business.cuitVerified,
    licenseVerified: business.licenseVerified,
    insuranceVerified: business.insuranceVerified,
    backgroundCheckVerified: business.backgroundCheckVerified,
    badges: business.badges,
    overallRating: business.overallRating,
    ratingCount: business.ratingCount,
    punctualityRating: business.punctualityRating,
    qualityRating: business.qualityRating,
    priceRating: business.priceRating,
    communicationRating: business.communicationRating,
    totalJobsCompleted: business.totalJobsCompleted,
    yearsOnPlatform: business.yearsOnPlatform,
    profileCompleteness: business.profileCompleteness,
    isFeatured: business.isFeatured,
    createdAt: business.createdAt,
  };
}
