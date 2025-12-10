/**
 * Leads Dashboard Routes
 * ======================
 *
 * API routes for business leads dashboard.
 * Phase 15: Consumer Marketplace
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { LeadsDashboardService, LeadFilterParams } from './leads-dashboard.service';

export function createLeadsDashboardRoutes(pool: Pool): Router {
  const router = Router();
  const service = new LeadsDashboardService(pool);

  /**
   * GET /leads
   * Get leads for business dashboard
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

        const params: LeadFilterParams = {
          status: req.query.status
            ? (req.query.status as string).split(',')
            : undefined,
          category: req.query.category as string,
          urgency: req.query.urgency
            ? (req.query.urgency as string).split(',')
            : undefined,
          dateFrom: req.query.dateFrom
            ? new Date(req.query.dateFrom as string)
            : undefined,
          dateTo: req.query.dateTo
            ? new Date(req.query.dateTo as string)
            : undefined,
          city: req.query.city as string,
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
        };

        const result = await service.getLeads(businessProfileId, params);

        res.json({
          success: true,
          data: result.leads.map((lead) => ({
            id: lead.id,
            requestNumber: lead.requestNumber,
            title: lead.title,
            description: lead.description.substring(0, 150) + (lead.description.length > 150 ? '...' : ''),
            category: lead.category,
            urgency: lead.urgency,
            budgetRange: lead.budgetRange,
            consumer: {
              displayName: lead.consumer.displayName || 'Cliente',
              profilePhotoUrl: lead.consumer.profilePhotoUrl,
              completedJobs: lead.consumer.completedJobs,
            },
            location: {
              city: lead.location.city,
              neighborhood: lead.location.neighborhood,
            },
            status: lead.status,
            hasQuote: !!lead.myQuote,
            competingQuotes: lead.competingQuotes,
            createdAt: lead.createdAt,
            expiresAt: lead.expiresAt,
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
   * GET /leads/stats
   * Get lead statistics
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

        const stats = await service.getLeadStats(businessProfileId);

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
   * GET /leads/:id
   * Get lead details
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

        const lead = await service.getLeadDetails(req.params.id, businessProfileId);

        if (!lead) {
          return res.status(404).json({
            error: {
              code: 'LEAD_NOT_FOUND',
              message: 'Lead no encontrado',
            },
          });
        }

        res.json({
          success: true,
          data: {
            id: lead.id,
            requestNumber: lead.requestNumber,
            title: lead.title,
            description: lead.description,
            category: lead.category,
            urgency: lead.urgency,
            budgetRange: lead.budgetRange,
            preferredSchedule: lead.preferredSchedule,
            photos: lead.photos,
            consumer: lead.consumer,
            location: lead.location,
            status: lead.status,
            myQuote: lead.myQuote,
            competingQuotes: lead.competingQuotes,
            createdAt: lead.createdAt,
            expiresAt: lead.expiresAt,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /leads/:id/quote
   * Submit quote for a lead
   */
  router.post(
    '/:id/quote',
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

        const { priceMin, priceMax, durationHours, description, includesPartsMessage, validDays, notes } = req.body;

        if (!priceMin || !description) {
          return res.status(400).json({
            error: {
              code: 'MISSING_FIELDS',
              message: 'Precio mínimo y descripción son requeridos',
            },
          });
        }

        const result = await service.submitQuote(businessProfileId, {
          serviceRequestId: req.params.id,
          priceMin,
          priceMax: priceMax || priceMin,
          durationHours,
          description,
          includesPartsMessage,
          validDays,
          notes,
        });

        res.status(201).json({
          success: true,
          data: result,
          message: 'Cotización enviada exitosamente',
        });
      } catch (error: any) {
        if (error.message === 'Ya has enviado una cotización para esta solicitud') {
          return res.status(400).json({
            error: {
              code: 'ALREADY_QUOTED',
              message: error.message,
            },
          });
        }
        next(error);
      }
    }
  );

  /**
   * POST /leads/:quoteId/convert
   * Convert accepted lead to job
   */
  router.post(
    '/:quoteId/convert',
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

        const { scheduledDate, scheduledTime, notes } = req.body;

        const result = await service.convertLeadToJob(
          req.params.quoteId,
          businessProfileId,
          {
            scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
            scheduledTime,
            notes,
          }
        );

        res.json({
          success: true,
          data: result,
          message: 'Lead convertido a trabajo exitosamente',
        });
      } catch (error: any) {
        if (error.message === 'Cotización no encontrada') {
          return res.status(404).json({
            error: {
              code: 'QUOTE_NOT_FOUND',
              message: error.message,
            },
          });
        }
        if (error.message === 'La cotización no ha sido aceptada') {
          return res.status(400).json({
            error: {
              code: 'QUOTE_NOT_ACCEPTED',
              message: error.message,
            },
          });
        }
        next(error);
      }
    }
  );

  // Error handler
  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[Leads Dashboard] Error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno',
      },
    });
  });

  return router;
}
