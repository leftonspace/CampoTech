/**
 * Customer Portal Routes
 * ======================
 *
 * All routes for the customer self-service portal.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import {
  requireCustomerAuth,
  optionalCustomerAuth,
  authRateLimit,
  customerAuthErrorHandler,
} from './auth/customer-auth.middleware';
import { getPortalService } from './portal.service';
import { getBookingService } from './booking/booking.service';
import { getAvailabilityService } from './booking/availability.service';
import { getJobHistoryService } from './history/job-history.service';
import { getInvoiceHistoryService } from './history/invoice-history.service';
import { getCustomerPaymentsService } from './payments/customer-payments.service';
import { getSupportTicketService } from './communication/ticket.service';
import { getFeedbackService } from './communication/feedback.service';

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createCustomerPortalRoutes(pool: Pool): Router {
  const router = Router();

  // Initialize services
  getPortalService(pool);
  getBookingService(pool);
  getAvailabilityService(pool);
  getJobHistoryService(pool);
  getInvoiceHistoryService(pool);
  getCustomerPaymentsService(pool);
  getSupportTicketService(pool);
  getFeedbackService(pool);

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD & PROFILE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /portal/dashboard
   * Get customer dashboard data
   */
  router.get(
    '/dashboard',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const service = getPortalService();
        const dashboard = await service.getDashboard(
          req.customerAuth!.customerId,
          req.customerAuth!.orgId
        );

        if (!dashboard) {
          return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({ success: true, data: dashboard });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /portal/profile
   * Get customer profile
   */
  router.get(
    '/profile',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const service = getPortalService();
        const profile = await service.getProfile(
          req.customerAuth!.customerId,
          req.customerAuth!.orgId
        );

        if (!profile) {
          return res.status(404).json({ error: 'Profile not found' });
        }

        res.json({ success: true, data: profile });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /portal/profile
   * Update customer profile
   */
  router.put(
    '/profile',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const service = getPortalService();
        const profile = await service.updateProfile(
          req.customerAuth!.customerId,
          req.customerAuth!.orgId,
          req.body
        );

        res.json({ success: true, data: profile });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /portal/organization
   * Get organization info (public)
   */
  router.get(
    '/organization/:orgId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const service = getPortalService();
        const info = await service.getOrganizationInfo(req.params.orgId);

        if (!info) {
          return res.status(404).json({ error: 'Organization not found' });
        }

        res.json({ success: true, data: info });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /portal/services
   * Get available services for booking
   */
  router.get(
    '/services',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const service = getAvailabilityService();
        const services = await service.getAvailableServices(req.customerAuth!.orgId);

        res.json({ success: true, data: services });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /portal/availability
   * Get availability for date range
   */
  router.get(
    '/availability',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { startDate, endDate, serviceTypeId, locationId } = req.query;

        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        const service = getAvailabilityService();
        const availability = await service.getAvailability({
          orgId: req.customerAuth!.orgId,
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string),
          serviceTypeId: serviceTypeId as string,
          locationId: locationId as string,
        });

        res.json({ success: true, data: availability });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /portal/bookings
   * Create a new booking
   */
  router.post(
    '/bookings',
    requireCustomerAuth(),
    authRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 10 }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const service = getBookingService();
        const result = await service.createBooking({
          customerId: req.customerAuth!.customerId,
          orgId: req.customerAuth!.orgId,
          ...req.body,
        });

        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: result.error,
            validation: result.validation,
          });
        }

        res.status(201).json({ success: true, data: result.booking });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /portal/bookings
   * Get customer's bookings
   */
  router.get(
    '/bookings',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { status, limit, offset } = req.query;

        const service = getBookingService();
        const result = await service.getCustomerBookings({
          customerId: req.customerAuth!.customerId,
          orgId: req.customerAuth!.orgId,
          status: status ? (status as string).split(',') as any : undefined,
          limit: limit ? parseInt(limit as string, 10) : 20,
          offset: offset ? parseInt(offset as string, 10) : 0,
        });

        res.json({ success: true, data: result.bookings, meta: { total: result.total } });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /portal/bookings/:id
   * Cancel a booking
   */
  router.delete(
    '/bookings/:id',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { reason } = req.body;

        const service = getBookingService();
        const result = await service.cancelBooking(
          req.params.id,
          req.customerAuth!.customerId,
          req.customerAuth!.orgId,
          reason || 'Cancelled by customer'
        );

        if (!result.success) {
          return res.status(400).json({ success: false, error: result.error });
        }

        res.json({ success: true, message: 'Booking cancelled' });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // JOB HISTORY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /portal/jobs
   * Get job history
   */
  router.get(
    '/jobs',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { status, startDate, endDate, limit, offset } = req.query;

        const service = getJobHistoryService();
        const result = await service.getJobHistory({
          customerId: req.customerAuth!.customerId,
          orgId: req.customerAuth!.orgId,
          status: status ? (status as string).split(',') as any : undefined,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          limit: limit ? parseInt(limit as string, 10) : 20,
          offset: offset ? parseInt(offset as string, 10) : 0,
        });

        res.json({ success: true, data: result.jobs, meta: { total: result.total } });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /portal/jobs/:id
   * Get job details
   */
  router.get(
    '/jobs/:id',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const service = getJobHistoryService();
        const job = await service.getJobById(
          req.params.id,
          req.customerAuth!.customerId,
          req.customerAuth!.orgId
        );

        if (!job) {
          return res.status(404).json({ error: 'Job not found' });
        }

        res.json({ success: true, data: job });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /portal/jobs/upcoming
   * Get upcoming jobs
   */
  router.get(
    '/jobs/upcoming',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const service = getJobHistoryService();
        const jobs = await service.getUpcomingJobs(
          req.customerAuth!.customerId,
          req.customerAuth!.orgId
        );

        res.json({ success: true, data: jobs });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // INVOICES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /portal/invoices
   * Get invoice history
   */
  router.get(
    '/invoices',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { status, startDate, endDate, limit, offset } = req.query;

        const service = getInvoiceHistoryService();
        const result = await service.getInvoiceHistory({
          customerId: req.customerAuth!.customerId,
          orgId: req.customerAuth!.orgId,
          status: status ? (status as string).split(',') as any : undefined,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          limit: limit ? parseInt(limit as string, 10) : 20,
          offset: offset ? parseInt(offset as string, 10) : 0,
        });

        res.json({ success: true, data: result.invoices, meta: { total: result.total } });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /portal/invoices/:id
   * Get invoice details
   */
  router.get(
    '/invoices/:id',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const service = getInvoiceHistoryService();
        const invoice = await service.getInvoiceById(
          req.params.id,
          req.customerAuth!.customerId,
          req.customerAuth!.orgId
        );

        if (!invoice) {
          return res.status(404).json({ error: 'Invoice not found' });
        }

        res.json({ success: true, data: invoice });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /portal/invoices/:id/pdf
   * Get invoice PDF URL
   */
  router.get(
    '/invoices/:id/pdf',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const service = getInvoiceHistoryService();
        const pdfUrl = await service.getInvoicePdfUrl(
          req.params.id,
          req.customerAuth!.customerId,
          req.customerAuth!.orgId
        );

        if (!pdfUrl) {
          return res.status(404).json({ error: 'PDF not available' });
        }

        res.json({ success: true, data: { pdfUrl } });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /portal/invoices/unpaid
   * Get unpaid invoices
   */
  router.get(
    '/invoices/unpaid',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const service = getInvoiceHistoryService();
        const invoices = await service.getUnpaidInvoices(
          req.customerAuth!.customerId,
          req.customerAuth!.orgId
        );

        res.json({ success: true, data: invoices });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /portal/payments
   * Initiate a payment
   */
  router.post(
    '/payments',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { invoiceId, method, returnUrl } = req.body;

        if (!invoiceId || !method) {
          return res.status(400).json({ error: 'invoiceId and method are required' });
        }

        const service = getCustomerPaymentsService();
        const result = await service.initiatePayment({
          customerId: req.customerAuth!.customerId,
          orgId: req.customerAuth!.orgId,
          invoiceId,
          method,
          returnUrl,
        });

        if (!result.success) {
          return res.status(400).json({ success: false, error: result.error });
        }

        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /portal/payments/:id
   * Get payment status
   */
  router.get(
    '/payments/:id',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const service = getCustomerPaymentsService();
        const payment = await service.getPaymentStatus(
          req.params.id,
          req.customerAuth!.customerId,
          req.customerAuth!.orgId
        );

        if (!payment) {
          return res.status(404).json({ error: 'Payment not found' });
        }

        res.json({ success: true, data: payment });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /portal/payments
   * Get payment history
   */
  router.get(
    '/payments',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { limit, offset } = req.query;

        const service = getCustomerPaymentsService();
        const result = await service.getPaymentHistory(
          req.customerAuth!.customerId,
          req.customerAuth!.orgId,
          limit ? parseInt(limit as string, 10) : 20,
          offset ? parseInt(offset as string, 10) : 0
        );

        res.json({ success: true, data: result.payments, meta: { total: result.total } });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPPORT TICKETS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /portal/tickets
   * Create a support ticket
   */
  router.post(
    '/tickets',
    requireCustomerAuth(),
    authRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 5 }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { subject, category, message, relatedJobId, relatedInvoiceId } = req.body;

        if (!subject || !category || !message) {
          return res.status(400).json({ error: 'subject, category, and message are required' });
        }

        const service = getSupportTicketService();
        const ticket = await service.createTicket({
          customerId: req.customerAuth!.customerId,
          orgId: req.customerAuth!.orgId,
          subject,
          category,
          message,
          relatedJobId,
          relatedInvoiceId,
        });

        res.status(201).json({ success: true, data: ticket });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /portal/tickets
   * Get customer's tickets
   */
  router.get(
    '/tickets',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { status, limit, offset } = req.query;

        const service = getSupportTicketService();
        const result = await service.getTickets({
          customerId: req.customerAuth!.customerId,
          orgId: req.customerAuth!.orgId,
          status: status ? (status as string).split(',') as any : undefined,
          limit: limit ? parseInt(limit as string, 10) : 20,
          offset: offset ? parseInt(offset as string, 10) : 0,
        });

        res.json({ success: true, data: result.tickets, meta: { total: result.total } });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /portal/tickets/:id
   * Get ticket details
   */
  router.get(
    '/tickets/:id',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const service = getSupportTicketService();
        const ticket = await service.getTicketById(
          req.params.id,
          req.customerAuth!.customerId,
          req.customerAuth!.orgId
        );

        if (!ticket) {
          return res.status(404).json({ error: 'Ticket not found' });
        }

        res.json({ success: true, data: ticket });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /portal/tickets/:id/messages
   * Add message to ticket
   */
  router.post(
    '/tickets/:id/messages',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { content, attachments } = req.body;

        if (!content) {
          return res.status(400).json({ error: 'content is required' });
        }

        const service = getSupportTicketService();
        const message = await service.addMessage({
          ticketId: req.params.id,
          customerId: req.customerAuth!.customerId,
          orgId: req.customerAuth!.orgId,
          content,
          attachments,
        });

        res.status(201).json({ success: true, data: message });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // FEEDBACK
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /portal/feedback
   * Submit feedback for a job
   */
  router.post(
    '/feedback',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          jobId, rating, comment, serviceQuality,
          punctuality, professionalism, valueForMoney, wouldRecommend
        } = req.body;

        if (!jobId || !rating) {
          return res.status(400).json({ error: 'jobId and rating are required' });
        }

        const service = getFeedbackService();
        const feedback = await service.submitFeedback({
          customerId: req.customerAuth!.customerId,
          orgId: req.customerAuth!.orgId,
          jobId,
          rating,
          comment,
          serviceQuality,
          punctuality,
          professionalism,
          valueForMoney,
          wouldRecommend,
        });

        res.status(201).json({ success: true, data: feedback });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /portal/feedback/pending
   * Get jobs pending feedback
   */
  router.get(
    '/feedback/pending',
    requireCustomerAuth(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const jobService = getJobHistoryService();
        const jobs = await jobService.getUnratedCompletedJobs(
          req.customerAuth!.customerId,
          req.customerAuth!.orgId
        );

        res.json({ success: true, data: jobs });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  router.use(customerAuthErrorHandler);

  return router;
}
