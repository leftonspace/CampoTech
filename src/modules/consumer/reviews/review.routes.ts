/**
 * Review Routes
 * =============
 *
 * API routes for review management.
 * Phase 15: Consumer Marketplace
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { ReviewService, ReviewError } from './review.service';
import { authenticateConsumer, optionalConsumerAuth } from '../auth/consumer-auth.middleware';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSUMER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createReviewRoutes(pool: Pool): Router {
  const router = Router();
  const service = new ReviewService(pool);

  /**
   * GET /reviews/business/:businessId
   * Get reviews for a business (public)
   */
  router.get(
    '/business/:businessId',
    optionalConsumerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { businessId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const sortBy = req.query.sortBy as 'recent' | 'rating_high' | 'rating_low' | 'helpful';

        const result = await service.getBusinessReviews(businessId, {
          page,
          limit,
          sortBy,
        });

        res.json({
          success: true,
          data: result.reviews.map(review => ({
            id: review.id,
            consumerName: review.consumerName,
            consumerPhoto: review.consumerPhoto,
            overallRating: review.overallRating,
            punctualityRating: review.punctualityRating,
            qualityRating: review.qualityRating,
            priceRating: review.priceRating,
            communicationRating: review.communicationRating,
            comment: review.comment,
            photos: review.photos,
            wouldRecommend: review.wouldRecommend,
            isVerified: review.isVerified,
            helpfulCount: review.helpfulCount,
            businessResponse: review.businessResponse,
            businessResponseAt: review.businessResponseAt,
            createdAt: review.createdAt,
          })),
          meta: {
            total: result.total,
            page: result.page,
            totalPages: result.totalPages,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /reviews/business/:businessId/summary
   * Get rating summary for a business (public)
   */
  router.get(
    '/business/:businessId/summary',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { businessId } = req.params;
        const summary = await service.getRatingSummary(businessId);

        res.json({
          success: true,
          data: summary,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /reviews
   * Submit a review (authenticated)
   */
  router.post(
    '/',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          businessProfileId,
          jobId,
          overallRating,
          punctualityRating,
          qualityRating,
          priceRating,
          communicationRating,
          comment,
          wouldRecommend,
          photos,
        } = req.body;

        if (!businessProfileId || !overallRating || wouldRecommend === undefined) {
          return res.status(400).json({
            error: {
              code: 'MISSING_FIELDS',
              message: 'Faltan campos requeridos',
            },
          });
        }

        const review = await service.submitReview({
          consumerId: req.consumer!.consumerId,
          businessProfileId,
          jobId,
          overallRating,
          punctualityRating,
          qualityRating,
          priceRating,
          communicationRating,
          comment,
          wouldRecommend,
          photos,
        });

        res.status(201).json({
          success: true,
          data: review,
          message: review.status === 'published'
            ? 'Reseña publicada exitosamente'
            : 'Reseña enviada, será revisada antes de publicarse',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /reviews/mine
   * Get consumer's own reviews (authenticated)
   */
  router.get(
    '/mine',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const reviews = await service.getConsumerReviews(req.consumer!.consumerId);

        res.json({
          success: true,
          data: reviews,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /reviews/:id
   * Update a review (authenticated, owner only)
   */
  router.put(
    '/:id',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          overallRating,
          punctualityRating,
          qualityRating,
          priceRating,
          communicationRating,
          comment,
          wouldRecommend,
          photos,
        } = req.body;

        const review = await service.updateReview(
          req.params.id,
          req.consumer!.consumerId,
          {
            overallRating,
            punctualityRating,
            qualityRating,
            priceRating,
            communicationRating,
            comment,
            wouldRecommend,
            photos,
          }
        );

        res.json({
          success: true,
          data: review,
          message: 'Reseña actualizada',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /reviews/:id
   * Delete a review (authenticated, owner only)
   */
  router.delete(
    '/:id',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await service.deleteReview(req.params.id, req.consumer!.consumerId);

        res.json({
          success: true,
          message: 'Reseña eliminada',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /reviews/:id/helpful
   * Mark review as helpful (authenticated)
   */
  router.post(
    '/:id/helpful',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await service.markHelpful(req.params.id, req.consumer!.consumerId);

        res.json({
          success: true,
          message: 'Marcado como útil',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /reviews/:id/not-helpful
   * Mark review as not helpful (authenticated)
   */
  router.post(
    '/:id/not-helpful',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await service.markNotHelpful(req.params.id, req.consumer!.consumerId);

        res.json({
          success: true,
          message: 'Marcado como no útil',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /reviews/:id/report
   * Report a review (authenticated)
   */
  router.post(
    '/:id/report',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { reason, details } = req.body;

        if (!reason) {
          return res.status(400).json({
            error: {
              code: 'MISSING_REASON',
              message: 'Motivo requerido',
            },
          });
        }

        await service.reportReview(
          req.params.id,
          req.consumer!.consumerId,
          reason,
          details
        );

        res.json({
          success: true,
          message: 'Reseña reportada',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handler
  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof ReviewError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    console.error('[Reviews] Unhandled error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno',
      },
    });
  });

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createBusinessReviewRoutes(pool: Pool): Router {
  const router = Router();
  const service = new ReviewService(pool);

  /**
   * POST /reviews/:id/respond
   * Add business response to review
   */
  router.post(
    '/:id/respond',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const businessProfileId = req.headers['x-business-profile-id'] as string;
        if (!businessProfileId) {
          return res.status(400).json({
            error: {
              code: 'MISSING_PROFILE',
              message: 'Business profile ID required',
            },
          });
        }

        const { response } = req.body;
        if (!response) {
          return res.status(400).json({
            error: {
              code: 'MISSING_RESPONSE',
              message: 'Respuesta requerida',
            },
          });
        }

        const review = await service.addBusinessResponse(
          req.params.id,
          businessProfileId,
          response
        );

        res.json({
          success: true,
          data: review,
          message: 'Respuesta agregada',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /reviews/summary
   * Get rating summary for business
   */
  router.get(
    '/summary',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const businessProfileId = req.headers['x-business-profile-id'] as string;
        if (!businessProfileId) {
          return res.status(400).json({
            error: {
              code: 'MISSING_PROFILE',
              message: 'Business profile ID required',
            },
          });
        }

        const summary = await service.getRatingSummary(businessProfileId);

        res.json({
          success: true,
          data: summary,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handler
  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof ReviewError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    console.error('[Business Reviews] Unhandled error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno',
      },
    });
  });

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODERATION ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createReviewModerationRoutes(pool: Pool): Router {
  const router = Router();
  const service = new ReviewService(pool);

  /**
   * GET /moderation/pending
   * Get pending reviews for moderation
   */
  router.get(
    '/pending',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const reviews = await service.getPendingModeration();

        res.json({
          success: true,
          data: reviews,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /moderation/flagged
   * Get flagged reviews
   */
  router.get(
    '/flagged',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const reviews = await service.getFlaggedReviews();

        res.json({
          success: true,
          data: reviews,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /moderation/:id/approve
   * Approve a review
   */
  router.post(
    '/:id/approve',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { notes } = req.body;
        const review = await service.approveReview(req.params.id, notes);

        res.json({
          success: true,
          data: review,
          message: 'Reseña aprobada y publicada',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /moderation/:id/reject
   * Reject a review
   */
  router.post(
    '/:id/reject',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { reason } = req.body;
        if (!reason) {
          return res.status(400).json({
            error: {
              code: 'MISSING_REASON',
              message: 'Motivo requerido',
            },
          });
        }

        const review = await service.rejectReview(req.params.id, reason);

        res.json({
          success: true,
          data: review,
          message: 'Reseña rechazada',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handler
  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof ReviewError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    console.error('[Review Moderation] Unhandled error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno',
      },
    });
  });

  return router;
}
