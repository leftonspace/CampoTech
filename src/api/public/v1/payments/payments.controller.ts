/**
 * Payments Controller
 * ====================
 *
 * Public API controller for payment management.
 * Provides CRUD operations plus payment processing actions.
 */

import { Router, Request, Response } from 'express';
import {
  createPaymentSchema,
  updatePaymentSchema,
  listPaymentsSchema,
  refundPaymentSchema,
  cancelPaymentSchema,
  batchRecordPaymentsSchema,
} from './payments.schema';
import { readScope, writeScope, deleteScope } from '../../middleware';
import { ApiRequestContext } from '../../public-api.types';
import { PaymentService } from '../../../../services/payment.service';

function formatPaymentResponse(payment: any): any {
  return {
    id: payment.id,
    org_id: payment.organizationId,
    customer_id: payment.invoice?.customerId,
    invoice_id: payment.invoiceId,
    amount: Number(payment.amount),
    status: payment.status.toLowerCase(),
    payment_method: payment.method.toLowerCase(),
    reference: payment.reference,
    payment_date: payment.paidAt?.toISOString(),
    created_at: payment.createdAt.toISOString(),
    updated_at: payment.updatedAt.toISOString(),
    customer: payment.invoice?.customer ? {
      id: payment.invoice.customer.id,
      name: payment.invoice.customer.name,
      email: payment.invoice.customer.email,
      phone: payment.invoice.customer.phone
    } : undefined
  };
}

export function createPaymentsController(): Router {
  const router = Router();

  // ─────────────────────────────────────────────────────────────────────────────
  // LIST PAYMENTS
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/',
    readScope('payments'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = listPaymentsSchema.safeParse(req.query);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid query parameters',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const params = parseResult.data;
        const { limit = 20, cursor } = params;

        let page = 1;
        if (cursor) {
          try {
            const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
            page = decoded.page || 1;
          } catch (e) { }
        }

        const result = await PaymentService.listPayments(apiContext.orgId, {
          status: params.status as any,
          invoiceId: params.invoice_id,
          customerId: params.customer_id,
          jobId: params.job_id,
          paymentMethod: params.payment_method,
          paymentType: params.payment_type,
          createdAfter: params.created_after,
          createdBefore: params.created_before,
          minAmount: params.min_amount,
          maxAmount: params.max_amount,
          search: params.search,
        }, {
          page,
          limit,
          sortBy: params.sort_by,
          sortOrder: params.sort_order,
        });

        res.json({
          success: true,
          data: result.items.map(formatPaymentResponse),
          pagination: {
            has_more: result.pagination.page < result.pagination.totalPages,
            next_cursor: result.pagination.page < result.pagination.totalPages
              ? Buffer.from(JSON.stringify({ page: result.pagination.page + 1 })).toString('base64url')
              : undefined,
            limit,
          },
        });
      } catch (error) {
        console.error('[Payments API] List error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: (error as Error).message || 'Failed to list payments' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET SINGLE PAYMENT
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/:id',
    readScope('payments'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        const payment = await PaymentService.getPaymentById(apiContext.orgId, id);

        if (!payment) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Payment not found' },
          });
        }

        res.json({ success: true, data: formatPaymentResponse(payment) });
      } catch (error) {
        console.error('[Payments API] Get error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: (error as Error).message || 'Failed to get payment' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE PAYMENT
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/',
    writeScope('payments'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = createPaymentSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid payment data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const body = parseResult.data;
        const payment = await PaymentService.createPayment(apiContext.orgId, {
          customerId: body.customer_id,
          invoiceId: body.invoice_id,
          jobId: body.job_id,
          amount: body.amount,
          currency: body.currency,
          method: body.payment_method,
          type: body.payment_type,
          reference: body.reference,
          paidAt: body.payment_date,
          status: 'COMPLETED'
        });

        res.status(201).json({ success: true, data: formatPaymentResponse(payment) });
      } catch (error) {
        console.error('[Payments API] Create error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: (error as Error).message || 'Failed to create payment' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // UPDATE PAYMENT
  // ─────────────────────────────────────────────────────────────────────────────

  router.patch(
    '/:id',
    writeScope('payments'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = updatePaymentSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid payment data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const updatedPayment = await PaymentService.updatePayment(apiContext.orgId, id, parseResult.data);

        res.json({ success: true, data: formatPaymentResponse(updatedPayment) });
      } catch (error) {
        console.error('[Payments API] Update error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: (error as Error).message || 'Failed to update payment' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE PAYMENT
  // ─────────────────────────────────────────────────────────────────────────────

  router.delete(
    '/:id',
    deleteScope('payments'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        await PaymentService.deletePayment(apiContext.orgId, id);

        res.json({ success: true, data: { id, deleted: true } });
      } catch (error) {
        console.error('[Payments API] Delete error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: (error as Error).message || 'Failed to delete payment' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // PAYMENT ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  // Refund payment
  router.post(
    '/:id/refund',
    writeScope('payments'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = refundPaymentSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid refund data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const payment = await PaymentService.refundPayment(
          apiContext.orgId,
          id,
          parseResult.data.amount,
          parseResult.data.reason,
          parseResult.data.notes
        );

        res.json({
          success: true,
          data: formatPaymentResponse(payment),
        });
      } catch (error) {
        console.error('[Payments API] Refund error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: (error as Error).message || 'Failed to process refund' },
        });
      }
    }
  );

  // Cancel payment
  router.post(
    '/:id/cancel',
    writeScope('payments'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = cancelPaymentSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid cancellation data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const cancelledPayment = await PaymentService.cancelPayment(apiContext.orgId, id, parseResult.data.reason);

        res.json({ success: true, data: formatPaymentResponse(cancelledPayment) });
      } catch (error) {
        console.error('[Payments API] Cancel error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: (error as Error).message || 'Failed to cancel payment' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // BATCH OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/batch',
    writeScope('payments'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = batchRecordPaymentsSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid batch data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { payments: batchData } = parseResult.data;
        const results = [];

        for (const data of batchData) {
          try {
            const payment = await PaymentService.createPayment(apiContext.orgId, {
              invoiceId: data.invoice_id,
              amount: data.amount,
              method: data.payment_method,
              reference: data.reference,
              paidAt: data.payment_date,
            });
            results.push({ success: true, id: payment.id });
          } catch (e) {
            results.push({ success: false, error: (e as Error).message });
          }
        }

        res.json({ success: true, data: results });
      } catch (error) {
        console.error('[Payments API] Batch error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to process batch payments' },
        });
      }
    }
  );

  return router;
}
