/**
 * Tracking Routes
 * ===============
 *
 * REST API routes for tracking functionality.
 * WebSocket is handled separately.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { getTrackingService } from './tracking.service';
import { requireCustomerAuth } from '../auth/customer-auth.middleware';

export function createTrackingRoutes(pool: Pool): Router {
  const router = Router();

  // All routes require customer authentication
  router.use(requireCustomerAuth(pool));

  /**
   * GET /tracking/:jobId
   * Get tracking state for a specific job
   */
  router.get('/:jobId', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const customerId = (req as any).customer?.id;

      if (!customerId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
        });
      }

      const trackingService = getTrackingService();
      const state = await trackingService.getJobTrackingState(jobId, customerId);

      if (!state) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Trabajo no encontrado' },
        });
      }

      res.json({
        success: true,
        data: {
          job: {
            id: state.jobId,
            status: state.status,
            address: state.customerLocation.address,
            latitude: state.customerLocation.lat,
            longitude: state.customerLocation.lng,
          },
          technicianLocation: state.technicianLocation
            ? {
                lat: state.technicianLocation.lat,
                lng: state.technicianLocation.lng,
                updatedAt: state.technicianLocation.timestamp,
              }
            : null,
          eta: state.eta
            ? {
                minutes: state.eta.durationMinutes,
                distance: state.eta.distanceText,
                updatedAt: state.eta.calculatedAt,
              }
            : null,
          statusHistory: state.statusHistory,
        },
      });
    } catch (error) {
      console.error('[TrackingRoutes] Get tracking state error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Error del servidor' },
      });
    }
  });

  /**
   * GET /tracking/active
   * Get all active trackable jobs for customer
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const customerId = (req as any).customer?.id;

      if (!customerId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
        });
      }

      const trackingService = getTrackingService();
      const activeJobs = await trackingService.getCustomerActiveJobs(customerId);

      res.json({
        success: true,
        data: { jobs: activeJobs },
      });
    } catch (error) {
      console.error('[TrackingRoutes] Get active jobs error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Error del servidor' },
      });
    }
  });

  /**
   * GET /tracking/:jobId/eta
   * Get just the ETA for a job
   */
  router.get('/:jobId/eta', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const customerId = (req as any).customer?.id;

      if (!customerId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
        });
      }

      const trackingService = getTrackingService();
      const state = await trackingService.getJobTrackingState(jobId, customerId);

      if (!state) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Trabajo no encontrado' },
        });
      }

      res.json({
        success: true,
        data: {
          eta: state.eta
            ? {
                minutes: state.eta.durationMinutes,
                distance: state.eta.distanceText,
                updatedAt: state.eta.calculatedAt,
              }
            : null,
          hasArrived: state.eta && state.eta.durationMinutes <= 0,
        },
      });
    } catch (error) {
      console.error('[TrackingRoutes] Get ETA error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Error del servidor' },
      });
    }
  });

  /**
   * GET /tracking/stats
   * Get WebSocket connection stats (admin only in production)
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const trackingService = getTrackingService();
      const stats = trackingService.getStats();

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      console.error('[TrackingRoutes] Get stats error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Error del servidor' },
      });
    }
  });

  return router;
}

/**
 * Routes for technician app (location updates)
 */
export function createTechnicianTrackingRoutes(pool: Pool): Router {
  const router = Router();

  // These routes require staff authentication
  // Would use requireAuth middleware from main auth module

  /**
   * POST /technician/tracking/location
   * Update technician location
   */
  router.post('/location', async (req: Request, res: Response) => {
    try {
      const technicianId = (req as any).user?.id;

      if (!technicianId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
        });
      }

      const { lat, lng, accuracy, heading, speed, jobId } = req.body;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Coordenadas inválidas' },
        });
      }

      const trackingService = getTrackingService();
      await trackingService.updateTechnicianLocation(
        technicianId,
        {
          lat,
          lng,
          accuracy,
          heading,
          speed,
          timestamp: new Date(),
        },
        jobId
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[TechnicianTracking] Location update error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Error del servidor' },
      });
    }
  });

  /**
   * POST /technician/tracking/status
   * Update job status
   */
  router.post('/status', async (req: Request, res: Response) => {
    try {
      const technicianId = (req as any).user?.id;

      if (!technicianId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
        });
      }

      const { jobId, status, note } = req.body;

      if (!jobId || !status) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Datos inválidos' },
        });
      }

      const trackingService = getTrackingService();
      await trackingService.updateJobStatus(jobId, status, technicianId, note);

      res.json({ success: true });
    } catch (error) {
      console.error('[TechnicianTracking] Status update error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Error del servidor' },
      });
    }
  });

  /**
   * GET /technician/tracking/check-arrival/:jobId
   * Check if technician has arrived at job location
   */
  router.get('/check-arrival/:jobId', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;

      const trackingService = getTrackingService();
      const hasArrived = await trackingService.checkArrival(jobId);

      res.json({
        success: true,
        data: { hasArrived },
      });
    } catch (error) {
      console.error('[TechnicianTracking] Check arrival error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Error del servidor' },
      });
    }
  });

  return router;
}
