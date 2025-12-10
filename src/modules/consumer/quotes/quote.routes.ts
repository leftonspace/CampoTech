/**
 * Quote Routes
 * ============
 *
 * API routes for quote management.
 * Phase 15: Consumer Marketplace
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { QuoteService, QuoteError, NotificationService } from './quote.service';
import { authenticateConsumer, optionalConsumerAuth } from '../auth/consumer-auth.middleware';
import { QuoteStatus } from '../consumer.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSUMER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createConsumerQuoteRoutes(
  pool: Pool,
  notificationService?: NotificationService
): Router {
  const router = Router();
  const service = new QuoteService(pool, notificationService);

  /**
   * GET /quotes
   * Get all quotes for consumer's requests
   */
  router.get(
    '/',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const consumerId = req.consumer!.consumerId;
        const status = req.query.status as QuoteStatus | undefined;

        // Get quotes from repository directly through service
        const quotes = await service['repository'].findForConsumer(
          consumerId,
          status ? [status] : undefined
        );

        res.json({
          success: true,
          data: quotes,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /quotes/request/:requestId
   * Get quotes for a specific request
   */
  router.get(
    '/request/:requestId',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const quotes = await service.getQuotesForRequest(
          req.params.requestId,
          req.consumer!.consumerId
        );

        res.json({
          success: true,
          data: quotes,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /quotes/request/:requestId/compare
   * Compare quotes for a request
   */
  router.get(
    '/request/:requestId/compare',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const comparison = await service.compareQuotes(
          req.params.requestId,
          req.consumer!.consumerId
        );

        res.json({
          success: true,
          data: comparison,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /quotes/:id
   * Get quote details
   */
  router.get(
    '/:id',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const quote = await service.getQuoteById(
          req.params.id,
          req.consumer!.consumerId,
          'consumer'
        );

        if (!quote) {
          return res.status(404).json({
            error: {
              code: 'QUOTE_NOT_FOUND',
              message: 'Quote not found',
            },
          });
        }

        res.json({
          success: true,
          data: quote,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /quotes/:id/accept
   * Accept a quote
   */
  router.post(
    '/:id/accept',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const quote = await service.acceptQuote(
          req.params.id,
          req.consumer!.consumerId
        );

        res.json({
          success: true,
          data: quote,
          message: 'Quote accepted successfully',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /quotes/:id/reject
   * Reject a quote
   */
  router.post(
    '/:id/reject',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { reason } = req.body;

        const quote = await service.rejectQuote(
          req.params.id,
          req.consumer!.consumerId,
          reason
        );

        res.json({
          success: true,
          data: quote,
          message: 'Quote rejected',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /quotes/:id/messages
   * Get messages for a quote
   */
  router.get(
    '/:id/messages',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const messages = await service.getMessages(
          req.params.id,
          req.consumer!.consumerId
        );

        res.json({
          success: true,
          data: messages,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /quotes/:id/messages
   * Send a message on a quote
   */
  router.post(
    '/:id/messages',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { message, attachments } = req.body;

        if (!message || !message.trim()) {
          return res.status(400).json({
            error: {
              code: 'MISSING_MESSAGE',
              message: 'Message is required',
            },
          });
        }

        const quoteMessage = await service.sendMessage(
          req.params.id,
          req.consumer!.consumerId,
          'consumer',
          message.trim(),
          attachments
        );

        res.json({
          success: true,
          data: quoteMessage,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handler
  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof QuoteError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    console.error('[Consumer Quotes] Unhandled error:', error);
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
// BUSINESS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createBusinessQuoteRoutes(
  pool: Pool,
  notificationService?: NotificationService
): Router {
  const router = Router();
  const service = new QuoteService(pool, notificationService);

  /**
   * GET /quotes
   * Get quotes for business
   */
  router.get(
    '/',
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

        const status = req.query.status as QuoteStatus | undefined;
        const quotes = await service.getQuotesForBusiness(
          businessProfileId,
          status ? [status] : undefined
        );

        res.json({
          success: true,
          data: quotes,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /quotes
   * Submit a quote
   */
  router.post(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const businessProfileId = req.headers['x-business-profile-id'] as string;
        const orgId = req.headers['x-org-id'] as string;

        if (!businessProfileId || !orgId) {
          return res.status(400).json({
            error: {
              code: 'MISSING_HEADERS',
              message: 'Business profile ID and org ID required',
            },
          });
        }

        const {
          requestId,
          estimatedPriceMin,
          estimatedPriceMax,
          estimatedDurationHours,
          description,
          includesPartsMessage,
          validDays,
          notes,
        } = req.body;

        if (!requestId || !estimatedPriceMin || !estimatedPriceMax || !description) {
          return res.status(400).json({
            error: {
              code: 'MISSING_FIELDS',
              message: 'Request ID, price range, and description are required',
            },
          });
        }

        const quote = await service.submitQuote(
          {
            requestId,
            businessProfileId,
            estimatedPriceMin,
            estimatedPriceMax,
            estimatedDurationHours,
            description,
            includesPartsMessage,
            validDays,
            notes,
          },
          orgId
        );

        res.status(201).json({
          success: true,
          data: quote,
          message: 'Quote submitted successfully',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /quotes/:id
   * Get quote details
   */
  router.get(
    '/:id',
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

        const quote = await service.getQuoteById(
          req.params.id,
          businessProfileId,
          'business'
        );

        if (!quote) {
          return res.status(404).json({
            error: {
              code: 'QUOTE_NOT_FOUND',
              message: 'Quote not found',
            },
          });
        }

        res.json({
          success: true,
          data: quote,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /quotes/:id
   * Update a quote
   */
  router.put(
    '/:id',
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

        const {
          estimatedPriceMin,
          estimatedPriceMax,
          estimatedDurationHours,
          description,
          includesPartsMessage,
          validUntil,
          notes,
        } = req.body;

        const quote = await service.updateQuote(
          req.params.id,
          businessProfileId,
          {
            estimatedPriceMin,
            estimatedPriceMax,
            estimatedDurationHours,
            description,
            includesPartsMessage,
            validUntil: validUntil ? new Date(validUntil) : undefined,
            notes,
          }
        );

        res.json({
          success: true,
          data: quote,
          message: 'Quote updated successfully',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /quotes/decline
   * Decline to quote a request
   */
  router.post(
    '/decline',
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

        const { requestId, reason, notes } = req.body;

        if (!requestId || !reason) {
          return res.status(400).json({
            error: {
              code: 'MISSING_FIELDS',
              message: 'Request ID and reason are required',
            },
          });
        }

        await service.declineRequest({
          requestId,
          businessProfileId,
          declineReason: reason,
          declineNotes: notes,
        });

        res.json({
          success: true,
          message: 'Request declined',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /quotes/:id/messages
   * Get messages for a quote
   */
  router.get(
    '/:id/messages',
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

        const messages = await service.getMessages(req.params.id, businessProfileId);

        res.json({
          success: true,
          data: messages,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /quotes/:id/messages
   * Send a message on a quote
   */
  router.post(
    '/:id/messages',
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

        const { message, attachments } = req.body;

        if (!message || !message.trim()) {
          return res.status(400).json({
            error: {
              code: 'MISSING_MESSAGE',
              message: 'Message is required',
            },
          });
        }

        const quoteMessage = await service.sendMessage(
          req.params.id,
          businessProfileId,
          'business',
          message.trim(),
          attachments
        );

        res.json({
          success: true,
          data: quoteMessage,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /quotes/stats
   * Get quote statistics for business
   */
  router.get(
    '/stats',
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

        const stats = await service['repository'].getBusinessStats(businessProfileId);

        res.json({
          success: true,
          data: stats,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handler
  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof QuoteError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    console.error('[Business Quotes] Unhandled error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  return router;
}
