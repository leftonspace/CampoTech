/**
 * Service Request Routes
 * ======================
 *
 * API routes for consumer service requests.
 * Phase 15: Consumer Marketplace
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { ServiceRequestService, ServiceRequestError } from './service-request.service';
import {
  authenticateConsumer,
  optionalConsumerAuth,
  requireActiveConsumer,
} from '../auth/consumer-auth.middleware';

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createServiceRequestRoutes(pool: Pool): Router {
  const router = Router();
  const service = new ServiceRequestService(pool);

  /**
   * GET /requests
   * Get current consumer's service requests
   */
  router.get(
    '/',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const status = req.query.status as string | undefined;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        const result = await service.getConsumerRequests(
          req.consumer!.consumerId,
          { status: status as any },
          { page, limit }
        );

        res.json({
          success: true,
          data: result.data.map(formatRequestSummary),
          meta: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /requests/stats
   * Get consumer's request statistics
   */
  router.get(
    '/stats',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const stats = await service.getConsumerStats(req.consumer!.consumerId);

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
   * POST /requests
   * Create a new service request
   */
  router.post(
    '/',
    authenticateConsumer(),
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          category,
          serviceType,
          title,
          description,
          photoUrls,
          voiceNoteUrl,
          address,
          addressExtra,
          lat,
          lng,
          neighborhood,
          city,
          province,
          urgency,
          preferredDate,
          preferredTimeSlot,
          flexibleDates,
          budgetRange,
          budgetMin,
          budgetMax,
          budgetNotes,
        } = req.body;

        const request = await service.create(req.consumer!.consumerId, {
          category,
          serviceType,
          title,
          description,
          photoUrls,
          voiceNoteUrl,
          address,
          addressExtra,
          lat,
          lng,
          neighborhood,
          city,
          province,
          urgency,
          preferredDate: preferredDate ? new Date(preferredDate) : undefined,
          preferredTimeSlot,
          flexibleDates,
          budgetRange,
          budgetMin,
          budgetMax,
          budgetNotes,
        });

        res.status(201).json({
          success: true,
          data: formatRequestDetail(request),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /requests/:id
   * Get service request detail
   */
  router.get(
    '/:id',
    optionalConsumerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const detail = await service.getRequestDetail(
          req.params.id,
          req.consumer?.consumerId
        );

        res.json({
          success: true,
          data: {
            ...formatRequestDetail(detail.request),
            isOwner: detail.isOwner,
            canEdit: detail.canEdit,
            canCancel: detail.canCancel,
            canAcceptQuote: detail.canAcceptQuote,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /requests/:id
   * Update service request
   */
  router.put(
    '/:id',
    authenticateConsumer(),
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          title,
          description,
          photoUrls,
          urgency,
          preferredDate,
          preferredTimeSlot,
          budgetRange,
          budgetMin,
          budgetMax,
        } = req.body;

        const request = await service.update(req.params.id, req.consumer!.consumerId, {
          title,
          description,
          photoUrls,
          urgency,
          preferredDate: preferredDate ? new Date(preferredDate) : undefined,
          preferredTimeSlot,
          budgetRange,
          budgetMin,
          budgetMax,
        });

        res.json({
          success: true,
          data: formatRequestDetail(request),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /requests/:id/cancel
   * Cancel service request
   */
  router.post(
    '/:id/cancel',
    authenticateConsumer(),
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { reason } = req.body;

        const request = await service.cancel(
          req.params.id,
          req.consumer!.consumerId,
          reason
        );

        res.json({
          success: true,
          data: formatRequestDetail(request),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /requests/:id
   * Delete service request (soft delete)
   */
  router.delete(
    '/:id',
    authenticateConsumer(),
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await service.delete(req.params.id, req.consumer!.consumerId);

        res.json({
          success: true,
          message: 'Request deleted',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /requests/:id/accept-quote
   * Accept a quote for the request
   */
  router.post(
    '/:id/accept-quote',
    authenticateConsumer(),
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { quoteId } = req.body;

        if (!quoteId) {
          return res.status(400).json({
            error: {
              code: 'QUOTE_REQUIRED',
              message: 'Quote ID is required',
            },
          });
        }

        const request = await service.acceptQuote(
          req.params.id,
          req.consumer!.consumerId,
          quoteId
        );

        res.json({
          success: true,
          data: formatRequestDetail(request),
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
    if (error instanceof ServiceRequestError) {
      return res.status(error.httpStatus).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    console.error('[ServiceRequest] Unhandled error:', error);
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
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatRequestSummary(request: any) {
  return {
    id: request.id,
    requestNumber: request.requestNumber,
    category: request.category,
    title: request.title,
    status: request.status,
    urgency: request.urgency,
    quotesReceived: request.quotesReceived,
    city: request.city,
    neighborhood: request.neighborhood,
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
  };
}

function formatRequestDetail(request: any) {
  return {
    id: request.id,
    requestNumber: request.requestNumber,
    category: request.category,
    serviceType: request.serviceType,
    title: request.title,
    description: request.description,
    photoUrls: request.photoUrls,
    voiceNoteUrl: request.voiceNoteUrl,
    address: request.address,
    addressExtra: request.addressExtra,
    lat: request.lat,
    lng: request.lng,
    neighborhood: request.neighborhood,
    city: request.city,
    province: request.province,
    urgency: request.urgency,
    preferredDate: request.preferredDate,
    preferredTimeSlot: request.preferredTimeSlot,
    flexibleDates: request.flexibleDates,
    budgetRange: request.budgetRange,
    budgetMin: request.budgetMin,
    budgetMax: request.budgetMax,
    budgetNotes: request.budgetNotes,
    status: request.status,
    statusChangedAt: request.statusChangedAt,
    quotesReceived: request.quotesReceived,
    acceptedQuoteId: request.acceptedQuoteId,
    acceptedAt: request.acceptedAt,
    cancelledAt: request.cancelledAt,
    cancellationReason: request.cancellationReason,
    jobId: request.jobId,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    expiresAt: request.expiresAt,
  };
}
