/**
 * Marketing Routes
 * ================
 *
 * API routes for SEO pages and referral system.
 * Phase 15: Consumer Marketplace
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { SeoPagesService } from './seo-pages.service';
import { ReferralService } from './referral.service';
import { authenticateConsumer, optionalConsumerAuth } from '../auth/consumer-auth.middleware';

export function createSeoRoutes(pool: Pool): Router {
  const router = Router();
  const service = new SeoPagesService(pool);

  /**
   * GET /seo/category/:slug
   * Get category landing page data
   */
  router.get(
    '/category/:slug',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = await service.getCategoryPage(req.params.slug);

        if (!data) {
          return res.status(404).json({
            error: {
              code: 'PAGE_NOT_FOUND',
              message: 'Categoría no encontrada',
            },
          });
        }

        res.json({
          success: true,
          data,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /seo/city/:slug
   * Get city landing page data
   */
  router.get(
    '/city/:slug',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = await service.getCityPage(req.params.slug);

        if (!data) {
          return res.status(404).json({
            error: {
              code: 'PAGE_NOT_FOUND',
              message: 'Ciudad no encontrada',
            },
          });
        }

        res.json({
          success: true,
          data,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /seo/city/:citySlug/:categorySlug
   * Get city + category combo page data
   */
  router.get(
    '/city/:citySlug/:categorySlug',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = await service.getCityCategoryPage(
          req.params.citySlug,
          req.params.categorySlug
        );

        if (!data) {
          return res.status(404).json({
            error: {
              code: 'PAGE_NOT_FOUND',
              message: 'Página no encontrada',
            },
          });
        }

        res.json({
          success: true,
          data,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /seo/sitemap
   * Get sitemap URLs
   */
  router.get(
    '/sitemap',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const urls = await service.getSitemapUrls();

        res.json({
          success: true,
          data: urls,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handler
  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[SEO Pages] Error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno',
      },
    });
  });

  return router;
}

export function createReferralRoutes(pool: Pool): Router {
  const router = Router();
  const service = new ReferralService(pool);

  /**
   * GET /referral/code
   * Get or create referral code
   */
  router.get(
    '/code',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const code = await service.getOrCreateReferralCode(req.consumer!.consumerId);

        res.json({
          success: true,
          data: code,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /referral/share
   * Get shareable referral link and message
   */
  router.get(
    '/share',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shareData = await service.getShareLink(req.consumer!.consumerId);

        res.json({
          success: true,
          data: shareData,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /referral/apply
   * Apply referral code during signup
   */
  router.post(
    '/apply',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { code } = req.body;

        if (!code) {
          return res.status(400).json({
            error: {
              code: 'MISSING_CODE',
              message: 'Código requerido',
            },
          });
        }

        const result = await service.applyReferralCode(
          req.consumer!.consumerId,
          code
        );

        if (!result.success) {
          return res.status(400).json({
            error: {
              code: 'INVALID_CODE',
              message: result.error,
            },
          });
        }

        res.json({
          success: true,
          data: {
            reward: result.reward,
          },
          message: `¡Código aplicado! Obtuviste $${result.reward} de descuento.`,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /referral/stats
   * Get referral statistics
   */
  router.get(
    '/stats',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const stats = await service.getReferralStats(req.consumer!.consumerId);

        res.json({
          success: true,
          data: stats,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /referral/history
   * Get referral history
   */
  router.get(
    '/history',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const history = await service.getReferralHistory(req.consumer!.consumerId);

        res.json({
          success: true,
          data: history,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /referral/balance
   * Get credit balance
   */
  router.get(
    '/balance',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const balance = await service.getCreditBalance(req.consumer!.consumerId);

        res.json({
          success: true,
          data: {
            balance,
            currency: 'ARS',
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /referral/program
   * Get referral program details
   */
  router.get(
    '/program',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const details = service.getProgramDetails();

        res.json({
          success: true,
          data: details,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /referral/validate
   * Validate a referral code without applying
   */
  router.post(
    '/validate',
    optionalConsumerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { code } = req.body;

        if (!code) {
          return res.status(400).json({
            error: {
              code: 'MISSING_CODE',
              message: 'Código requerido',
            },
          });
        }

        // Check if code exists
        const result = await pool.query(
          `SELECT c.code, cp.display_name as referrer_name
           FROM consumer.referral_codes c
           JOIN consumer.consumer_profiles cp ON cp.id = c.consumer_id
           WHERE c.code = $1`,
          [code.toUpperCase()]
        );

        if (result.rows.length === 0) {
          return res.json({
            success: true,
            data: {
              valid: false,
            },
          });
        }

        const details = service.getProgramDetails();

        res.json({
          success: true,
          data: {
            valid: true,
            referrerName: result.rows[0].referrer_name || 'Un amigo',
            discount: details.refereeReward,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handler
  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[Referral] Error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno',
      },
    });
  });

  return router;
}
