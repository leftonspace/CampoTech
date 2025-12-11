/**
 * Invoices AFIP Controller
 * ========================
 *
 * API endpoints for AFIP electronic invoicing:
 * - POST /invoices/:id/cae - Request CAE for invoice
 * - GET /invoices/:id/pdf - Download invoice PDF
 * - GET /invoices/queue - Show AFIP queue status
 * - POST /invoices/:id/cae/retry - Retry failed CAE request
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import {
  getDistributedLockService,
  getAfipSequenceLockKey,
} from '../../../../lib/services/distributed-lock.service';
import { requireScopes, readScope, writeScope } from '../../middleware';
import { ApiRequestContext } from '../../public-api.types';
import { log } from '../../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const requestCaeSchema = z.object({
  invoice_type: z.enum(['A', 'B', 'C', 'M', 'E']).optional(),
  punto_venta: z.number().int().min(1).max(99999).optional(),
  concepto: z.enum(['productos', 'servicios', 'productos_y_servicios']).optional().default('servicios'),
});

const listQueueSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AfipQueueItem {
  id: string;
  invoice_id: string;
  invoice_number: string;
  status: string;
  attempts: number;
  last_error?: string;
  queued_at: Date;
  completed_at?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createInvoicesAfipController(pool: Pool): Router {
  const router = Router();

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /invoices/:id/cae - Request CAE for invoice
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/:id/cae',
    requireScopes(writeScope('invoices')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = requestCaeSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid CAE request data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { invoice_type, punto_venta, concepto } = parseResult.data;

        // Get invoice with customer data
        const invoiceResult = await pool.query(
          `SELECT i.*,
                  c.doc_type as customer_doc_type,
                  c.doc_number as customer_doc_number,
                  c.name as customer_name,
                  c.iva_condition as customer_iva_condition,
                  o.cuit as org_cuit,
                  o.iva_condition as org_iva_condition,
                  o.afip_connected,
                  o.afip_environment
           FROM invoices i
           JOIN customers c ON i.customer_id = c.id
           JOIN organizations o ON i.org_id = o.id
           WHERE i.id = $1 AND i.org_id = $2`,
          [id, apiContext.orgId]
        );

        if (invoiceResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Invoice not found' },
          });
        }

        const invoice = invoiceResult.rows[0];

        // Validate invoice status
        if (invoice.status !== 'draft') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: 'Only draft invoices can request CAE',
            },
          });
        }

        // Check AFIP connection
        if (!invoice.afip_connected) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'AFIP_NOT_CONNECTED',
              message: 'AFIP not connected for this organization',
            },
          });
        }

        // Determine invoice type based on IVA conditions
        let finalInvoiceType = invoice_type;
        if (!finalInvoiceType) {
          if (invoice.org_iva_condition === 'responsable_inscripto') {
            if (invoice.customer_iva_condition === 'responsable_inscripto') {
              finalInvoiceType = 'A';
            } else if (invoice.customer_iva_condition === 'monotributista') {
              finalInvoiceType = 'A';
            } else {
              finalInvoiceType = 'B';
            }
          } else if (invoice.org_iva_condition === 'monotributista') {
            finalInvoiceType = 'C';
          } else {
            finalInvoiceType = 'B';
          }
        }

        // Validate customer doc_number for Factura A
        if (finalInvoiceType === 'A' && !invoice.customer_doc_number) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'MISSING_CUSTOMER_DOC',
              message: 'Factura A requires customer CUIT/CUIL',
            },
          });
        }

        // Reserve invoice number with distributed lock
        let lockService;
        try {
          lockService = getDistributedLockService();
        } catch {
          // Continue without lock in dev environment
        }

        const lockKey = getAfipSequenceLockKey(apiContext.orgId, `factura_${finalInvoiceType.toLowerCase()}`);
        const finalPuntoVenta = punto_venta || invoice.punto_venta || 1;

        const reserveNumber = async () => {
          // Get next invoice number
          const seqResult = await pool.query(
            `SELECT COALESCE(MAX(afip_invoice_number), 0) + 1 as next_number
             FROM invoices
             WHERE org_id = $1
               AND afip_invoice_type = $2
               AND punto_venta = $3
               AND cae IS NOT NULL`,
            [apiContext.orgId, finalInvoiceType, finalPuntoVenta]
          );

          return seqResult.rows[0].next_number;
        };

        let nextNumber: number;
        if (lockService) {
          nextNumber = await lockService.withLock(lockKey, reserveNumber, { ttlMs: 10000 });
        } else {
          nextNumber = await reserveNumber();
        }

        // Queue CAE request
        const queueResult = await pool.query(
          `INSERT INTO afip_cae_queue (
            org_id, invoice_id, invoice_type, punto_venta, invoice_number,
            concepto, total, customer_doc_type, customer_doc_number,
            status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
          RETURNING id`,
          [
            apiContext.orgId,
            id,
            finalInvoiceType,
            finalPuntoVenta,
            nextNumber,
            concepto === 'productos' ? 1 : concepto === 'servicios' ? 2 : 3,
            invoice.total,
            invoice.customer_doc_type,
            invoice.customer_doc_number,
          ]
        );

        const jobId = queueResult.rows[0].id;

        // Update invoice with pending CAE info
        await pool.query(
          `UPDATE invoices
           SET afip_invoice_type = $1,
               punto_venta = $2,
               afip_invoice_number = $3,
               afip_cae_status = 'pending',
               afip_cae_job_id = $4,
               updated_at = NOW()
           WHERE id = $5`,
          [finalInvoiceType, finalPuntoVenta, nextNumber, jobId, id]
        );

        // Queue for processing (in production, this would add to BullMQ)
        try {
          const { getQueueManager } = await import('../../../../lib/queue/queue-manager');
          const queueManager = getQueueManager();
          await queueManager.addJob('cae-queue', {
            jobId,
            invoiceId: id,
            orgId: apiContext.orgId,
          });
        } catch {
          // Queue not available, will be processed by cron
        }

        log.info('CAE request queued', {
          invoiceId: id,
          jobId,
          invoiceType: finalInvoiceType,
          puntoVenta: finalPuntoVenta,
          number: nextNumber,
        });

        res.status(202).json({
          success: true,
          data: {
            job_id: jobId,
            invoice_id: id,
            invoice_type: finalInvoiceType,
            punto_venta: finalPuntoVenta,
            invoice_number: nextNumber,
            status: 'pending',
            message: 'CAE request queued for processing',
          },
        });
      } catch (error) {
        log.error('[Invoices API] CAE request error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to request CAE' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /invoices/:id/pdf - Download invoice PDF
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/:id/pdf',
    requireScopes(readScope('invoices')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const regenerate = req.query.regenerate === 'true';

        // Get invoice
        const invoiceResult = await pool.query(
          `SELECT i.*,
                  c.name as customer_name,
                  c.address as customer_address,
                  c.doc_type as customer_doc_type,
                  c.doc_number as customer_doc_number,
                  o.name as org_name,
                  o.legal_name as org_legal_name,
                  o.cuit as org_cuit,
                  o.address as org_address,
                  o.iva_condition as org_iva_condition,
                  o.logo_url as org_logo
           FROM invoices i
           JOIN customers c ON i.customer_id = c.id
           JOIN organizations o ON i.org_id = o.id
           WHERE i.id = $1 AND i.org_id = $2`,
          [id, apiContext.orgId]
        );

        if (invoiceResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Invoice not found' },
          });
        }

        const invoice = invoiceResult.rows[0];

        // Check if invoice has CAE (required for official PDF)
        if (!invoice.cae && invoice.afip_invoice_type) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'CAE_REQUIRED',
              message: 'Invoice must have CAE before generating PDF',
            },
          });
        }

        // Check for cached PDF
        if (invoice.pdf_url && !regenerate) {
          // Redirect to stored PDF
          return res.redirect(invoice.pdf_url);
        }

        // Get line items
        const itemsResult = await pool.query(
          `SELECT description, quantity, unit, unit_price, tax_rate, subtotal, tax_amount, total
           FROM invoice_items
           WHERE invoice_id = $1
           ORDER BY sort_order`,
          [id]
        );

        // Generate PDF (in production, this would use a PDF library)
        // For now, return invoice data that can be rendered client-side

        const pdfData = {
          invoice: {
            id: invoice.id,
            number: invoice.afip_invoice_number || invoice.invoice_number,
            type: invoice.afip_invoice_type,
            punto_venta: invoice.punto_venta,
            date: invoice.created_at,
            due_date: invoice.due_date,
            cae: invoice.cae,
            cae_expiry: invoice.cae_expiry,
          },
          organization: {
            name: invoice.org_legal_name || invoice.org_name,
            cuit: invoice.org_cuit,
            address: invoice.org_address,
            iva_condition: invoice.org_iva_condition,
            logo: invoice.org_logo,
          },
          customer: {
            name: invoice.customer_name,
            address: invoice.customer_address,
            doc_type: invoice.customer_doc_type,
            doc_number: invoice.customer_doc_number,
          },
          items: itemsResult.rows,
          totals: {
            subtotal: invoice.subtotal,
            tax_total: invoice.tax_total,
            discount_total: invoice.discount_total,
            total: invoice.total,
            amount_paid: invoice.amount_paid,
            amount_due: invoice.amount_due,
          },
          notes: invoice.notes,
          footer: invoice.footer,
        };

        // If Accept header requests JSON, return data
        if (req.accepts('json')) {
          return res.json({
            success: true,
            data: pdfData,
          });
        }

        // Otherwise, return HTML that can be printed/saved as PDF
        const html = generateInvoiceHtml(pdfData);
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="factura-${pdfData.invoice.number}.html"`);
        res.send(html);
      } catch (error) {
        log.error('[Invoices API] PDF error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to generate PDF' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /invoices/queue - Show AFIP queue status
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/queue',
    requireScopes(readScope('invoices')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = listQueueSchema.safeParse(req.query);

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

        const { status, limit, offset } = parseResult.data;

        const conditions = ['org_id = $1'];
        const values: any[] = [apiContext.orgId];
        let paramIndex = 2;

        if (status) {
          conditions.push(`status = $${paramIndex++}`);
          values.push(status);
        }

        // Get count
        const countResult = await pool.query(
          `SELECT COUNT(*) FROM afip_cae_queue WHERE ${conditions.join(' AND ')}`,
          values
        );

        // Get items
        values.push(limit, offset);
        const result = await pool.query(
          `SELECT
            q.id, q.invoice_id, q.invoice_type, q.punto_venta, q.invoice_number,
            q.status, q.attempts, q.last_error, q.cae, q.cae_expiry,
            q.created_at as queued_at, q.completed_at,
            i.invoice_number as original_invoice_number, i.total
           FROM afip_cae_queue q
           JOIN invoices i ON q.invoice_id = i.id
           WHERE ${conditions.join(' AND ')}
           ORDER BY q.created_at DESC
           LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
          values
        );

        // Get summary stats
        const statsResult = await pool.query(
          `SELECT
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'processing') as processing,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) FILTER (WHERE status = 'completed') as avg_processing_seconds
           FROM afip_cae_queue
           WHERE org_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
          [apiContext.orgId]
        );

        res.json({
          success: true,
          data: {
            items: result.rows,
            stats: {
              pending: parseInt(statsResult.rows[0].pending || '0'),
              processing: parseInt(statsResult.rows[0].processing || '0'),
              completed: parseInt(statsResult.rows[0].completed || '0'),
              failed: parseInt(statsResult.rows[0].failed || '0'),
              avg_processing_seconds: parseFloat(statsResult.rows[0].avg_processing_seconds || '0'),
            },
            pagination: {
              total: parseInt(countResult.rows[0].count),
              limit,
              offset,
              has_more: offset + result.rows.length < parseInt(countResult.rows[0].count),
            },
          },
        });
      } catch (error) {
        log.error('[Invoices API] Queue status error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to get queue status' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /invoices/:id/cae/retry - Retry failed CAE request
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/:id/cae/retry',
    requireScopes(writeScope('invoices')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        // Get invoice and its CAE job
        const invoiceResult = await pool.query(
          `SELECT i.*, q.id as job_id, q.status as cae_status, q.attempts
           FROM invoices i
           LEFT JOIN afip_cae_queue q ON i.afip_cae_job_id = q.id
           WHERE i.id = $1 AND i.org_id = $2`,
          [id, apiContext.orgId]
        );

        if (invoiceResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Invoice not found' },
          });
        }

        const invoice = invoiceResult.rows[0];

        if (!invoice.job_id) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'NO_CAE_REQUEST',
              message: 'No CAE request found for this invoice',
            },
          });
        }

        if (invoice.cae_status !== 'failed') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: 'Only failed CAE requests can be retried',
            },
          });
        }

        // Reset job status
        await pool.query(
          `UPDATE afip_cae_queue
           SET status = 'pending', last_error = NULL, updated_at = NOW()
           WHERE id = $1`,
          [invoice.job_id]
        );

        // Re-queue for processing
        try {
          const { getQueueManager } = await import('../../../../lib/queue/queue-manager');
          const queueManager = getQueueManager();
          await queueManager.addJob('cae-queue', {
            jobId: invoice.job_id,
            invoiceId: id,
            orgId: apiContext.orgId,
            retry: true,
          });
        } catch {
          // Queue not available
        }

        log.info('CAE retry queued', { invoiceId: id, jobId: invoice.job_id });

        res.json({
          success: true,
          data: {
            job_id: invoice.job_id,
            invoice_id: id,
            status: 'pending',
            previous_attempts: invoice.attempts,
            message: 'CAE request re-queued for processing',
          },
        });
      } catch (error) {
        log.error('[Invoices API] CAE retry error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to retry CAE request' },
        });
      }
    }
  );

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTML GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateInvoiceHtml(data: any): string {
  const { invoice, organization, customer, items, totals, notes, footer } = data;

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString('es-AR');

  const invoiceTypeNames: Record<string, string> = {
    A: 'FACTURA A',
    B: 'FACTURA B',
    C: 'FACTURA C',
    M: 'FACTURA M',
    E: 'FACTURA E',
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${invoiceTypeNames[invoice.type] || 'Factura'} ${invoice.number}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .invoice-type { font-size: 24px; font-weight: bold; text-align: center; padding: 10px; border: 2px solid #333; }
    .invoice-type .letter { font-size: 48px; }
    .parties { display: flex; justify-content: space-between; margin: 20px 0; }
    .party { width: 48%; }
    .items { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .items th, .items td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    .items th { background-color: #f5f5f5; }
    .items .amount { text-align: right; }
    .totals { float: right; width: 300px; }
    .totals table { width: 100%; }
    .totals td { padding: 5px; }
    .totals .total { font-weight: bold; font-size: 1.2em; border-top: 2px solid #333; }
    .cae-info { clear: both; margin-top: 40px; padding: 10px; background: #f9f9f9; border: 1px solid #ddd; }
    .footer { margin-top: 20px; font-size: 0.9em; color: #666; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="org-info">
      ${organization.logo ? `<img src="${organization.logo}" alt="Logo" style="max-height: 60px;">` : ''}
      <h2>${organization.name}</h2>
      <p>CUIT: ${organization.cuit || 'N/A'}</p>
      <p>${organization.address || ''}</p>
      <p>IVA: ${organization.iva_condition || 'N/A'}</p>
    </div>
    <div class="invoice-type">
      <div class="letter">${invoice.type || 'X'}</div>
      <div>COD. ${invoice.type === 'A' ? '01' : invoice.type === 'B' ? '06' : invoice.type === 'C' ? '11' : 'XX'}</div>
    </div>
    <div class="invoice-info">
      <h2>${invoiceTypeNames[invoice.type] || 'Factura'}</h2>
      <p>Punto de Venta: ${String(invoice.punto_venta || 1).padStart(5, '0')}</p>
      <p>N&uacute;mero: ${String(invoice.number).padStart(8, '0')}</p>
      <p>Fecha: ${formatDate(invoice.date)}</p>
      ${invoice.due_date ? `<p>Vencimiento: ${formatDate(invoice.due_date)}</p>` : ''}
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Cliente</h3>
      <p><strong>${customer.name}</strong></p>
      <p>${customer.doc_type || 'DNI'}: ${customer.doc_number || 'N/A'}</p>
      <p>${customer.address || ''}</p>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>Descripci&oacute;n</th>
        <th>Cant.</th>
        <th>Precio Unit.</th>
        <th>IVA</th>
        <th class="amount">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item: any) => `
        <tr>
          <td>${item.description}</td>
          <td>${item.quantity} ${item.unit || ''}</td>
          <td class="amount">${formatMoney(item.unit_price)}</td>
          <td>${item.tax_rate}%</td>
          <td class="amount">${formatMoney(item.subtotal)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal:</td><td class="amount">${formatMoney(totals.subtotal)}</td></tr>
      <tr><td>IVA:</td><td class="amount">${formatMoney(totals.tax_total)}</td></tr>
      ${totals.discount_total > 0 ? `<tr><td>Descuento:</td><td class="amount">-${formatMoney(totals.discount_total)}</td></tr>` : ''}
      <tr class="total"><td>TOTAL:</td><td class="amount">${formatMoney(totals.total)}</td></tr>
    </table>
  </div>

  ${invoice.cae ? `
  <div class="cae-info">
    <p><strong>CAE:</strong> ${invoice.cae}</p>
    <p><strong>Vencimiento CAE:</strong> ${formatDate(invoice.cae_expiry)}</p>
  </div>
  ` : ''}

  ${notes ? `<div class="notes"><h4>Notas:</h4><p>${notes}</p></div>` : ''}
  ${footer ? `<div class="footer">${footer}</div>` : ''}
</body>
</html>`;
}
