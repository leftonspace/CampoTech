import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  listInvoicesSchema,
  sendInvoiceSchema,
  recordPaymentSchema,
  refundInvoiceSchema,
  voidInvoiceSchema,
  batchSendInvoicesSchema,
  batchDeleteInvoicesSchema,
  CreateInvoiceInput,
  UpdateInvoiceInput,
} from './invoices.schema';
import { requireScopes, readScope, writeScope, deleteScope } from '../../middleware';
import { ApiRequestContext, CursorPaginationResult } from '../../public-api.types';
import { InvoiceService } from '../../../../services/invoice.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

function formatInvoiceResponse(invoice: any): any {
  return {
    id: invoice.id,
    customerId: invoice.customerId,
    jobId: invoice.jobId,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    lineItems: invoice.lineItems,
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid || 0),
    amountDue: Number(invoice.total) - Number(invoice.amountPaid || 0),
    issuedAt: invoice.issuedAt instanceof Date ? invoice.issuedAt.toISOString() : invoice.issuedAt,
    dueDate: invoice.dueDate instanceof Date ? invoice.dueDate.toISOString() : (invoice.dueDate || null),
    paidAt: invoice.paidAt instanceof Date ? invoice.paidAt.toISOString() : (invoice.paidAt || null),
    notes: invoice.notes,
    createdAt: invoice.createdAt instanceof Date ? invoice.createdAt.toISOString() : invoice.createdAt,
    updatedAt: invoice.updatedAt instanceof Date ? invoice.updatedAt.toISOString() : invoice.updatedAt,
    customer: invoice.customer ? {
      id: invoice.customer.id,
      name: invoice.customer.name,
      email: invoice.customer.email,
    } : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createInvoicesController(pool: Pool): Router {
  const router = Router();

  // ─────────────────────────────────────────────────────────────────────────────
  // LIST INVOICES
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/',
    readScope('invoices'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = listInvoicesSchema.safeParse(req.query);

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
        const { limit = 20 } = params;

        const result = await InvoiceService.listInvoices(apiContext.orgId, {
          status: params.status as string,
          customerId: params.customer_id,
        }, {
          page: 1, // Simple page-based pagination for now
          limit,
        });

        const data = result.items.map(formatInvoiceResponse);

        const response: CursorPaginationResult<any> = {
          data,
          pagination: {
            has_more: result.pagination.totalPages > result.pagination.page,
            next_cursor: result.pagination.page < result.pagination.totalPages
              ? String(result.pagination.page + 1)
              : undefined,
          },
        };

        res.json({
          success: true,
          ...response,
        });
      } catch (error) {
        console.error('[Invoices API] List error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to list invoices' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET SINGLE INVOICE
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/:id',
    readScope('invoices'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        const invoice = await InvoiceService.getInvoiceById(apiContext.orgId, id);

        if (!invoice) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Invoice not found' },
          });
        }

        res.json({ success: true, data: formatInvoiceResponse(invoice) });
      } catch (error) {
        console.error('[Invoices API] Get error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to get invoice' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE INVOICE
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/',
    writeScope('invoices'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = createInvoiceSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid invoice data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const invoice = await InvoiceService.createInvoice(apiContext.orgId, parseResult.data);
        res.status(201).json({ success: true, data: formatInvoiceResponse(invoice) });
      } catch (error: any) {
        console.error('[Invoices API] Create error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to create invoice' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // UPDATE INVOICE
  // ─────────────────────────────────────────────────────────────────────────────

  router.put(
    '/:id',
    writeScope('invoices'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = updateInvoiceSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid update data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const invoice = await InvoiceService.updateInvoice(apiContext.orgId, id, parseResult.data);
        res.json({ success: true, data: formatInvoiceResponse(invoice) });
      } catch (error) {
        console.error('[Invoices API] Update error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to update invoice' },
        });
      }
    }
  );

  router.patch(
    '/:id',
    writeScope('invoices'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = updateInvoiceSchema.partial().safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid update data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const invoice = await InvoiceService.updateInvoice(apiContext.orgId, id, parseResult.data);
        res.json({ success: true, data: formatInvoiceResponse(invoice) });
      } catch (error) {
        console.error('[Invoices API] Update error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to update invoice' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE INVOICE
  // ─────────────────────────────────────────────────────────────────────────────

  router.delete(
    '/:id',
    deleteScope('invoices'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        await InvoiceService.deleteInvoice(apiContext.orgId, id);

        res.json({ success: true, data: { id, deleted: true } });
      } catch (error) {
        console.error('[Invoices API] Delete error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to delete invoice' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // INVOICE ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  // Send invoice
  router.post(
    '/:id/send',
    writeScope('invoices'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        const invoice = await InvoiceService.updateInvoice(apiContext.orgId, id, {
          status: 'SENT' as any,
          issuedAt: new Date(),
        });

        res.json({ success: true, data: formatInvoiceResponse(invoice) });
      } catch (error) {
        console.error('[Invoices API] Send error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to send invoice' },
        });
      }
    }
  );

  // Record payment
  router.post(
    '/:id/payments',
    requireScopes('write:invoices', 'write:payments'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = recordPaymentSchema.safeParse(req.body);

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

        const invoice = await InvoiceService.recordPayment(apiContext.orgId, id, parseResult.data);

        res.json({ success: true, data: formatInvoiceResponse(invoice) });
      } catch (error) {
        console.error('[Invoices API] Record payment error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to record payment' },
        });
      }
    }
  );

  // Refund invoice
  router.post(
    '/:id/refund',
    requireScopes('write:invoices', 'write:payments'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = refundInvoiceSchema.safeParse(req.body);

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

        const { amount, reason } = parseResult.data;
        const invoice = await InvoiceService.recordPayment(apiContext.orgId, id, {
          amount: -amount,
          method: 'REFUND' as any,
          reference: reason,
        });

        res.json({ success: true, data: formatInvoiceResponse(invoice) });
      } catch (error) {
        console.error('[Invoices API] Refund error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to refund invoice' },
        });
      }
    }
  );
  // Void invoice
  router.post(
    '/:id/void',
    writeScope('invoices'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        const invoice = await InvoiceService.updateInvoice(apiContext.orgId, id, {
          status: 'CANCELLED' as any,
        });

        res.json({ success: true, data: formatInvoiceResponse(invoice) });
      } catch (error) {
        console.error('[Invoices API] Void error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to void invoice' },
        });
      }
    }
  );

  // Mark as viewed
  router.post(
    '/:id/viewed',
    writeScope('invoices'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        const invoice = await InvoiceService.updateInvoice(apiContext.orgId, id, {
          status: 'SENT' as any, // Or a dedicated VIEWED status if we add it
          // viewedAt: new Date() // Add to schema if needed
        });

        res.json({ success: true, data: formatInvoiceResponse(invoice) });
      } catch (error) {
        console.error('[Invoices API] Mark viewed error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to mark viewed' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // BATCH OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/batch-send',
    writeScope('invoices'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { invoice_ids } = req.body;

        const results = await Promise.all(invoice_ids.map((id: string) =>
          InvoiceService.updateInvoice(apiContext.orgId, id, { status: 'SENT' as any, issuedAt: new Date() })
        ));

        res.json({
          success: true,
          data: {
            sent_count: results.length,
            sent_ids: results.map(i => i.id),
          },
        });
      } catch (error) {
        console.error('[Invoices API] Batch send error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to batch send' },
        });
      }
    }
  );

  router.post(
    '/batch-delete',
    deleteScope('invoices'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { invoice_ids } = req.body;

        await Promise.all(invoice_ids.map((id: string) =>
          InvoiceService.deleteInvoice(apiContext.orgId, id)
        ));

        res.json({
          success: true,
          data: {
            deleted_count: invoice_ids.length,
            deleted_ids: invoice_ids,
          },
        });
      } catch (error) {
        console.error('[Invoices API] Batch delete error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to batch delete' },
        });
      }
    }
  );

  return router;
}
