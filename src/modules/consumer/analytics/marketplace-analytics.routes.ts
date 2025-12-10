/**
 * Marketplace Analytics Routes
 * ============================
 *
 * API routes for marketplace analytics dashboard.
 * Phase 15: Consumer Marketplace
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { MarketplaceAnalyticsService } from './marketplace-analytics.service';

export function createMarketplaceAnalyticsRoutes(pool: Pool): Router {
  const router = Router();
  const service = new MarketplaceAnalyticsService(pool);

  /**
   * GET /analytics/dashboard
   * Get complete marketplace dashboard
   */
  router.get(
    '/dashboard',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);

        const dashboard = await service.getDashboard({ start, end });

        res.json({
          success: true,
          data: dashboard,
          meta: {
            period: { start, end, days },
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /analytics/overview
   * Get overview metrics only
   */
  router.get(
    '/overview',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);

        const overview = await service.getOverviewMetrics({ start, end });

        res.json({
          success: true,
          data: overview,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /analytics/trends
   * Get trend data
   */
  router.get(
    '/trends',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);

        const trends = await service.getTrends({ start, end });

        res.json({
          success: true,
          data: trends,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /analytics/categories
   * Get top categories
   */
  router.get(
    '/categories',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);

        const categories = await service.getTopCategories({ start, end });

        res.json({
          success: true,
          data: categories,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /analytics/cities
   * Get top cities
   */
  router.get(
    '/cities',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);

        const cities = await service.getTopCities({ start, end });

        res.json({
          success: true,
          data: cities,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /analytics/funnel
   * Get conversion funnel
   */
  router.get(
    '/funnel',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);

        const funnel = await service.getConversionFunnel({ start, end });

        res.json({
          success: true,
          data: funnel,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /analytics/cohorts
   * Get cohort analysis
   */
  router.get(
    '/cohorts',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const months = parseInt(req.query.months as string) || 6;
        const cohorts = await service.getCohortAnalysis(months);

        res.json({
          success: true,
          data: cohorts,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /analytics/businesses
   * Get business performance metrics
   */
  router.get(
    '/businesses',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);

        const metrics = await service.getBusinessMetrics({ start, end });

        res.json({
          success: true,
          data: metrics,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /analytics/activity
   * Get recent activity feed
   */
  router.get(
    '/activity',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const activity = await service.getRecentActivity();

        res.json({
          success: true,
          data: activity,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /analytics/export
   * Export analytics data as CSV
   */
  router.get(
    '/export',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);

        const trends = await service.getTrends({ start, end });

        // Generate CSV
        const headers = ['Fecha', 'Consumidores', 'Solicitudes', 'Cotizaciones', 'Completados'];
        const rows = trends.map((t) => [
          t.date,
          t.consumers,
          t.requests,
          t.quotes,
          t.completedJobs,
        ]);

        const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="marketplace-analytics-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv"`
        );
        res.send(csv);
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handler
  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[Marketplace Analytics] Error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno',
      },
    });
  });

  return router;
}
