/**
 * Invoices Controller
 * ====================
 *
 * Public API controller for invoice management.
 * Provides CRUD operations plus invoice lifecycle actions.
 */

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

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface InvoiceRow {
  id: string;
  org_id: string;
  customer_id: string;
  job_id: string | null;
  invoice_number: string;
  status: string;
  line_items: any[];
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  payment_terms: string;
  due_date: Date | null;
  sent_at: Date | null;
  viewed_at: Date | null;
  paid_at: Date | null;
  notes: string | null;
  footer: string | null;
  metadata: any;
  pdf_url: string | null;
  created_at: Date;
  updated_at: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CURSOR HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function encodeCursor(id: string, sortValue: any): string {
  return Buffer.from(JSON.stringify({ id, sv: sortValue })).toString('base64url');
}

function decodeCursor(cursor: string): { id: string; sv: any } | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateDueDate(paymentTerms: string, invoiceDate: Date = new Date()): Date | null {
  const daysMap: Record<string, number> = {
    due_on_receipt: 0,
    net_7: 7,
    net_15: 15,
    net_30: 30,
    net_45: 45,
    net_60: 60,
  };

  const days = daysMap[paymentTerms];
  if (days === undefined) return null;

  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + days);
  return dueDate;
}

function calculateTotals(lineItems: any[]): {
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
} {
  let subtotal = 0;
  let taxTotal = 0;
  let discountTotal = 0;

  for (const item of lineItems) {
    const itemTotal = item.quantity * item.unit_price;
    const itemDiscount = item.discount || 0;
    const afterDiscount = itemTotal - itemDiscount;
    const itemTax = afterDiscount * ((item.tax_rate || 0) / 100);

    subtotal += itemTotal;
    discountTotal += itemDiscount;
    taxTotal += itemTax;
  }

  return {
    subtotal,
    taxTotal,
    discountTotal,
    total: subtotal - discountTotal + taxTotal,
  };
}

async function generateInvoiceNumber(pool: Pool, orgId: string): Promise<string> {
  const result = await pool.query(
    `SELECT COUNT(*) + 1 as next_num FROM invoices WHERE org_id = $1`,
    [orgId]
  );
  const nextNum = result.rows[0].next_num;
  const year = new Date().getFullYear();
  return `INV-${year}-${String(nextNum).padStart(6, '0')}`;
}

function formatInvoiceResponse(row: InvoiceRow): any {
  return {
    id: row.id,
    org_id: row.org_id,
    customer_id: row.customer_id,
    job_id: row.job_id,
    invoice_number: row.invoice_number,
    status: row.status,
    line_items: row.line_items,
    subtotal: Number(row.subtotal),
    tax_total: Number(row.tax_total),
    discount_total: Number(row.discount_total),
    total: Number(row.total),
    amount_paid: Number(row.amount_paid),
    amount_due: Number(row.amount_due),
    payment_terms: row.payment_terms,
    due_date: row.due_date?.toISOString() || null,
    sent_at: row.sent_at?.toISOString() || null,
    viewed_at: row.viewed_at?.toISOString() || null,
    paid_at: row.paid_at?.toISOString() || null,
    notes: row.notes,
    footer: row.footer,
    metadata: row.metadata,
    pdf_url: row.pdf_url,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
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
        const { limit, cursor, sort_by, sort_order, include } = params;

        // Build query
        const conditions: string[] = ['i.org_id = $1'];
        const values: any[] = [apiContext.orgId];
        let paramIndex = 2;

        if (params.customer_id) {
          conditions.push(`i.customer_id = $${paramIndex++}`);
          values.push(params.customer_id);
        }

        if (params.job_id) {
          conditions.push(`i.job_id = $${paramIndex++}`);
          values.push(params.job_id);
        }

        if (params.status) {
          const statuses = Array.isArray(params.status) ? params.status : [params.status];
          conditions.push(`i.status = ANY($${paramIndex++})`);
          values.push(statuses);
        }

        if (params.created_after) {
          conditions.push(`i.created_at >= $${paramIndex++}`);
          values.push(params.created_after);
        }

        if (params.created_before) {
          conditions.push(`i.created_at <= $${paramIndex++}`);
          values.push(params.created_before);
        }

        if (params.due_after) {
          conditions.push(`i.due_date >= $${paramIndex++}`);
          values.push(params.due_after);
        }

        if (params.due_before) {
          conditions.push(`i.due_date <= $${paramIndex++}`);
          values.push(params.due_before);
        }

        if (params.min_amount !== undefined) {
          conditions.push(`i.total >= $${paramIndex++}`);
          values.push(params.min_amount);
        }

        if (params.max_amount !== undefined) {
          conditions.push(`i.total <= $${paramIndex++}`);
          values.push(params.max_amount);
        }

        if (params.search) {
          conditions.push(`(
            i.invoice_number ILIKE $${paramIndex} OR
            i.notes ILIKE $${paramIndex}
          )`);
          values.push(`%${params.search}%`);
          paramIndex++;
        }

        // Cursor pagination
        if (cursor) {
          const decoded = decodeCursor(cursor);
          if (decoded) {
            const op = sort_order === 'desc' ? '<' : '>';
            conditions.push(`(i.${sort_by}, i.id) ${op} ($${paramIndex++}, $${paramIndex++})`);
            values.push(decoded.sv, decoded.id);
          }
        }

        // Build SELECT with optional joins
        let selectClause = 'i.*';
        let joinClause = '';

        if (include?.includes('customer')) {
          selectClause += `, row_to_json(c.*) as customer_data`;
          joinClause += ' LEFT JOIN customers c ON i.customer_id = c.id';
        }

        if (include?.includes('job')) {
          selectClause += `, row_to_json(j.*) as job_data`;
          joinClause += ' LEFT JOIN jobs j ON i.job_id = j.id';
        }

        const query = `
          SELECT ${selectClause}
          FROM invoices i
          ${joinClause}
          WHERE ${conditions.join(' AND ')}
          ORDER BY i.${sort_by} ${sort_order}, i.id ${sort_order}
          LIMIT $${paramIndex}
        `;
        values.push(limit + 1);

        const result = await pool.query(query, values);
        const hasMore = result.rows.length > limit;
        const invoices = result.rows.slice(0, limit);

        // Build response
        const data = await Promise.all(invoices.map(async (row: any) => {
          const invoice = formatInvoiceResponse(row);
          if (row.customer_data) {
            invoice.customer = row.customer_data;
          }
          if (row.job_data) {
            invoice.job = row.job_data;
          }
          if (include?.includes('payments')) {
            const paymentsResult = await pool.query(
              'SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY payment_date DESC',
              [invoice.id]
            );
            invoice.payments = paymentsResult.rows;
          }
          return invoice;
        }));

        const response: CursorPaginationResult<any> = {
          data,
          pagination: {
            has_more: hasMore,
            next_cursor: hasMore
              ? encodeCursor(invoices[invoices.length - 1].id, invoices[invoices.length - 1][sort_by])
              : undefined,
            limit,
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
        const include = req.query.include as string | string[] | undefined;
        const includeArr = include ? (Array.isArray(include) ? include : [include]) : [];

        let selectClause = 'i.*';
        let joinClause = '';

        if (includeArr.includes('customer')) {
          selectClause += `, row_to_json(c.*) as customer_data`;
          joinClause += ' LEFT JOIN customers c ON i.customer_id = c.id';
        }

        if (includeArr.includes('job')) {
          selectClause += `, row_to_json(j.*) as job_data`;
          joinClause += ' LEFT JOIN jobs j ON i.job_id = j.id';
        }

        const query = `
          SELECT ${selectClause}
          FROM invoices i
          ${joinClause}
          WHERE i.id = $1 AND i.org_id = $2
        `;
        const result = await pool.query(query, [id, apiContext.orgId]);

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Invoice not found' },
          });
        }

        const row = result.rows[0];
        const invoice = formatInvoiceResponse(row);

        if (row.customer_data) {
          invoice.customer = row.customer_data;
        }
        if (row.job_data) {
          invoice.job = row.job_data;
        }
        if (includeArr.includes('payments')) {
          const paymentsResult = await pool.query(
            'SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY payment_date DESC',
            [id]
          );
          invoice.payments = paymentsResult.rows;
        }

        res.json({ success: true, data: invoice });
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

        const data = parseResult.data;

        // Verify customer belongs to org
        const customerCheck = await pool.query(
          'SELECT id FROM customers WHERE id = $1 AND org_id = $2',
          [data.customer_id, apiContext.orgId]
        );

        if (customerCheck.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_CUSTOMER', message: 'Customer not found' },
          });
        }

        // Verify job if provided
        if (data.job_id) {
          const jobCheck = await pool.query(
            'SELECT id FROM jobs WHERE id = $1 AND org_id = $2',
            [data.job_id, apiContext.orgId]
          );

          if (jobCheck.rows.length === 0) {
            return res.status(400).json({
              success: false,
              error: { code: 'INVALID_JOB', message: 'Job not found' },
            });
          }
        }

        // Generate invoice number if not provided
        const invoiceNumber = data.invoice_number || await generateInvoiceNumber(pool, apiContext.orgId);

        // Calculate totals
        const { subtotal, taxTotal, discountTotal, total } = calculateTotals(data.line_items);

        // Calculate due date
        const dueDate = data.due_date ? new Date(data.due_date) : calculateDueDate(data.payment_terms);

        const query = `
          INSERT INTO invoices (
            org_id, customer_id, job_id, invoice_number, status,
            line_items, subtotal, tax_total, discount_total, total,
            amount_paid, amount_due, payment_terms, due_date,
            notes, footer, metadata, created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, 'draft',
            $5, $6, $7, $8, $9,
            0, $9, $10, $11,
            $12, $13, $14, NOW(), NOW()
          )
          RETURNING *
        `;

        const values = [
          apiContext.orgId,
          data.customer_id,
          data.job_id || null,
          invoiceNumber,
          JSON.stringify(data.line_items),
          subtotal,
          taxTotal,
          discountTotal,
          total,
          data.payment_terms,
          dueDate,
          data.notes || null,
          data.footer || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ];

        const result = await pool.query(query, values);
        const invoice = formatInvoiceResponse(result.rows[0]);

        // Send immediately if requested
        if (data.send_immediately) {
          await pool.query(
            `UPDATE invoices SET status = 'sent', sent_at = NOW() WHERE id = $1`,
            [invoice.id]
          );
          invoice.status = 'sent';
          invoice.sent_at = new Date().toISOString();
        }

        res.status(201).json({ success: true, data: invoice });
      } catch (error: any) {
        console.error('[Invoices API] Create error:', error);

        if (error.code === '23505' && error.constraint?.includes('invoice_number')) {
          return res.status(409).json({
            success: false,
            error: { code: 'DUPLICATE_INVOICE_NUMBER', message: 'Invoice number already exists' },
          });
        }

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
      await handleUpdateInvoice(pool, req, res);
    }
  );

  router.patch(
    '/:id',
    writeScope('invoices'),
    async (req: Request, res: Response) => {
      await handleUpdateInvoice(pool, req, res);
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

        // Only allow deleting draft invoices
        const result = await pool.query(
          `DELETE FROM invoices WHERE id = $1 AND org_id = $2 AND status = 'draft' RETURNING id`,
          [id, apiContext.orgId]
        );

        if (result.rows.length === 0) {
          // Check if invoice exists but isn't draft
          const existsCheck = await pool.query(
            'SELECT status FROM invoices WHERE id = $1 AND org_id = $2',
            [id, apiContext.orgId]
          );

          if (existsCheck.rows.length > 0) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'CANNOT_DELETE',
                message: 'Only draft invoices can be deleted. Use void for sent invoices.',
              },
            });
          }

          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Invoice not found' },
          });
        }

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
        const parseResult = sendInvoiceSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid send data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const result = await pool.query(
          `UPDATE invoices
           SET status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
               sent_at = COALESCE(sent_at, NOW()),
               updated_at = NOW()
           WHERE id = $1 AND org_id = $2 AND status IN ('draft', 'pending')
           RETURNING *`,
          [id, apiContext.orgId]
        );

        if (result.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_STATUS', message: 'Invoice cannot be sent in current status' },
          });
        }

        // TODO: Trigger actual email sending via notification service

        res.json({ success: true, data: formatInvoiceResponse(result.rows[0]) });
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

        const { amount, payment_method, payment_date, reference, notes } = parseResult.data;

        // Get current invoice
        const invoiceResult = await pool.query(
          'SELECT * FROM invoices WHERE id = $1 AND org_id = $2',
          [id, apiContext.orgId]
        );

        if (invoiceResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Invoice not found' },
          });
        }

        const invoice = invoiceResult.rows[0];
        const newAmountPaid = Number(invoice.amount_paid) + amount;
        const newAmountDue = Number(invoice.total) - newAmountPaid;

        // Determine new status
        let newStatus = invoice.status;
        if (newAmountDue <= 0) {
          newStatus = 'paid';
        } else if (newAmountPaid > 0) {
          newStatus = 'partially_paid';
        }

        // Insert payment record
        await pool.query(
          `INSERT INTO invoice_payments (
            invoice_id, amount, payment_method, payment_date, reference, notes, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [id, amount, payment_method, payment_date || new Date(), reference || null, notes || null]
        );

        // Update invoice
        const result = await pool.query(
          `UPDATE invoices
           SET amount_paid = $1, amount_due = $2, status = $3,
               paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END,
               updated_at = NOW()
           WHERE id = $4
           RETURNING *`,
          [newAmountPaid, Math.max(0, newAmountDue), newStatus, id]
        );

        res.json({ success: true, data: formatInvoiceResponse(result.rows[0]) });
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

        // Get current invoice
        const invoiceResult = await pool.query(
          'SELECT * FROM invoices WHERE id = $1 AND org_id = $2',
          [id, apiContext.orgId]
        );

        if (invoiceResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Invoice not found' },
          });
        }

        const invoice = invoiceResult.rows[0];

        if (amount > Number(invoice.amount_paid)) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_AMOUNT', message: 'Refund amount exceeds amount paid' },
          });
        }

        const newAmountPaid = Number(invoice.amount_paid) - amount;
        const newAmountDue = Number(invoice.total) - newAmountPaid;
        const newStatus = newAmountPaid <= 0 ? 'refunded' : 'partially_paid';

        // Insert refund record
        await pool.query(
          `INSERT INTO invoice_payments (
            invoice_id, amount, payment_method, payment_date, notes, is_refund, created_at
          ) VALUES ($1, $2, 'refund', NOW(), $3, true, NOW())`,
          [id, -amount, `Refund: ${reason}`]
        );

        // Update invoice
        const result = await pool.query(
          `UPDATE invoices
           SET amount_paid = $1, amount_due = $2, status = $3, updated_at = NOW()
           WHERE id = $4
           RETURNING *`,
          [newAmountPaid, newAmountDue, newStatus, id]
        );

        res.json({ success: true, data: formatInvoiceResponse(result.rows[0]) });
      } catch (error) {
        console.error('[Invoices API] Refund error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to process refund' },
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
        const parseResult = voidInvoiceSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid void data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { reason } = parseResult.data;

        const result = await pool.query(
          `UPDATE invoices
           SET status = 'cancelled',
               notes = COALESCE(notes, '') || E'\\n\\nVoided: ' || $1,
               updated_at = NOW()
           WHERE id = $2 AND org_id = $3 AND status NOT IN ('paid', 'refunded', 'cancelled')
           RETURNING *`,
          [reason, id, apiContext.orgId]
        );

        if (result.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_STATUS', message: 'Invoice cannot be voided in current status' },
          });
        }

        res.json({ success: true, data: formatInvoiceResponse(result.rows[0]) });
      } catch (error) {
        console.error('[Invoices API] Void error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to void invoice' },
        });
      }
    }
  );

  // Mark as viewed (for tracking when customer opens invoice link)
  router.post(
    '/:id/viewed',
    writeScope('invoices'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        const result = await pool.query(
          `UPDATE invoices
           SET status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
               viewed_at = COALESCE(viewed_at, NOW()),
               updated_at = NOW()
           WHERE id = $1 AND org_id = $2
           RETURNING *`,
          [id, apiContext.orgId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Invoice not found' },
          });
        }

        res.json({ success: true, data: formatInvoiceResponse(result.rows[0]) });
      } catch (error) {
        console.error('[Invoices API] Mark viewed error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to mark invoice as viewed' },
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
        const parseResult = batchSendInvoicesSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid batch send data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { invoice_ids } = parseResult.data;

        const result = await pool.query(
          `UPDATE invoices
           SET status = 'sent', sent_at = NOW(), updated_at = NOW()
           WHERE id = ANY($1) AND org_id = $2 AND status IN ('draft', 'pending')
           RETURNING id`,
          [invoice_ids, apiContext.orgId]
        );

        res.json({
          success: true,
          data: {
            sent_count: result.rowCount,
            sent_ids: result.rows.map((r: any) => r.id),
          },
        });
      } catch (error) {
        console.error('[Invoices API] Batch send error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to batch send invoices' },
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
        const parseResult = batchDeleteInvoicesSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid batch delete data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { invoice_ids } = parseResult.data;

        const result = await pool.query(
          `DELETE FROM invoices WHERE id = ANY($1) AND org_id = $2 AND status = 'draft' RETURNING id`,
          [invoice_ids, apiContext.orgId]
        );

        res.json({
          success: true,
          data: {
            deleted_count: result.rowCount,
            deleted_ids: result.rows.map((r: any) => r.id),
          },
        });
      } catch (error) {
        console.error('[Invoices API] Batch delete error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to batch delete invoices' },
        });
      }
    }
  );

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

async function handleUpdateInvoice(pool: Pool, req: Request, res: Response): Promise<void> {
  try {
    const apiContext = (req as any).apiContext as ApiRequestContext;
    const { id } = req.params;
    const parseResult = updateInvoiceSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid invoice data',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }

    // Only allow updates to draft invoices
    const statusCheck = await pool.query(
      'SELECT status FROM invoices WHERE id = $1 AND org_id = $2',
      [id, apiContext.orgId]
    );

    if (statusCheck.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invoice not found' },
      });
      return;
    }

    if (statusCheck.rows[0].status !== 'draft') {
      res.status(400).json({
        success: false,
        error: { code: 'CANNOT_UPDATE', message: 'Only draft invoices can be updated' },
      });
      return;
    }

    const data = parseResult.data;

    // Build dynamic update query
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.line_items !== undefined) {
      const { subtotal, taxTotal, discountTotal, total } = calculateTotals(data.line_items);
      setClauses.push(`line_items = $${paramIndex++}`);
      values.push(JSON.stringify(data.line_items));
      setClauses.push(`subtotal = $${paramIndex++}`);
      values.push(subtotal);
      setClauses.push(`tax_total = $${paramIndex++}`);
      values.push(taxTotal);
      setClauses.push(`discount_total = $${paramIndex++}`);
      values.push(discountTotal);
      setClauses.push(`total = $${paramIndex++}`);
      values.push(total);
      setClauses.push(`amount_due = $${paramIndex++}`);
      values.push(total);
    }

    if (data.payment_terms !== undefined) {
      setClauses.push(`payment_terms = $${paramIndex++}`);
      values.push(data.payment_terms);
    }

    if (data.due_date !== undefined) {
      setClauses.push(`due_date = $${paramIndex++}`);
      values.push(data.due_date);
    }

    if (data.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      values.push(data.notes);
    }

    if (data.footer !== undefined) {
      setClauses.push(`footer = $${paramIndex++}`);
      values.push(data.footer);
    }

    if (data.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(data.metadata));
    }

    if (setClauses.length === 1) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_UPDATES', message: 'No valid fields to update' },
      });
      return;
    }

    values.push(id, apiContext.orgId);

    const query = `
      UPDATE invoices
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex++} AND org_id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    res.json({ success: true, data: formatInvoiceResponse(result.rows[0]) });
  } catch (error) {
    console.error('[Invoices API] Update error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update invoice' },
    });
  }
}
