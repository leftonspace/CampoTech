/**
 * Payments Controller
 * ====================
 *
 * Public API controller for payment management.
 * Provides CRUD operations plus payment processing actions.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import {
  createPaymentSchema,
  updatePaymentSchema,
  listPaymentsSchema,
  refundPaymentSchema,
  cancelPaymentSchema,
  batchRecordPaymentsSchema,
  CreatePaymentInput,
} from './payments.schema';
import { requireScopes, readScope, writeScope, deleteScope } from '../../middleware';
import { ApiRequestContext, CursorPaginationResult } from '../../public-api.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PaymentRow {
  id: string;
  org_id: string;
  customer_id: string;
  invoice_id: string | null;
  job_id: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  payment_type: string;
  reference: string | null;
  payment_date: Date;
  notes: string | null;
  metadata: any;
  external_transaction_id: string | null;
  processor: string | null;
  refunded_amount: number;
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

function formatPaymentResponse(row: PaymentRow): any {
  return {
    id: row.id,
    org_id: row.org_id,
    customer_id: row.customer_id,
    invoice_id: row.invoice_id,
    job_id: row.job_id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    payment_method: row.payment_method,
    payment_type: row.payment_type,
    reference: row.reference,
    payment_date: row.payment_date.toISOString(),
    notes: row.notes,
    metadata: row.metadata,
    external_transaction_id: row.external_transaction_id,
    processor: row.processor,
    refunded_amount: Number(row.refunded_amount || 0),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createPaymentsController(pool: Pool): Router {
  const router = Router();

  // ─────────────────────────────────────────────────────────────────────────────
  // LIST PAYMENTS
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/',
    requireScopes(readScope('payments')),
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
        const { limit, cursor, sort_by, sort_order, include } = params;

        // Build query
        const conditions: string[] = ['p.org_id = $1'];
        const values: any[] = [apiContext.orgId];
        let paramIndex = 2;

        if (params.customer_id) {
          conditions.push(`p.customer_id = $${paramIndex++}`);
          values.push(params.customer_id);
        }

        if (params.invoice_id) {
          conditions.push(`p.invoice_id = $${paramIndex++}`);
          values.push(params.invoice_id);
        }

        if (params.job_id) {
          conditions.push(`p.job_id = $${paramIndex++}`);
          values.push(params.job_id);
        }

        if (params.status) {
          const statuses = Array.isArray(params.status) ? params.status : [params.status];
          conditions.push(`p.status = ANY($${paramIndex++})`);
          values.push(statuses);
        }

        if (params.payment_method) {
          const methods = Array.isArray(params.payment_method) ? params.payment_method : [params.payment_method];
          conditions.push(`p.payment_method = ANY($${paramIndex++})`);
          values.push(methods);
        }

        if (params.payment_type) {
          const types = Array.isArray(params.payment_type) ? params.payment_type : [params.payment_type];
          conditions.push(`p.payment_type = ANY($${paramIndex++})`);
          values.push(types);
        }

        if (params.created_after) {
          conditions.push(`p.created_at >= $${paramIndex++}`);
          values.push(params.created_after);
        }

        if (params.created_before) {
          conditions.push(`p.created_at <= $${paramIndex++}`);
          values.push(params.created_before);
        }

        if (params.min_amount !== undefined) {
          conditions.push(`p.amount >= $${paramIndex++}`);
          values.push(params.min_amount);
        }

        if (params.max_amount !== undefined) {
          conditions.push(`p.amount <= $${paramIndex++}`);
          values.push(params.max_amount);
        }

        if (params.search) {
          conditions.push(`(
            p.reference ILIKE $${paramIndex} OR
            p.notes ILIKE $${paramIndex} OR
            p.external_transaction_id ILIKE $${paramIndex}
          )`);
          values.push(`%${params.search}%`);
          paramIndex++;
        }

        // Cursor pagination
        if (cursor) {
          const decoded = decodeCursor(cursor);
          if (decoded) {
            const op = sort_order === 'desc' ? '<' : '>';
            conditions.push(`(p.${sort_by}, p.id) ${op} ($${paramIndex++}, $${paramIndex++})`);
            values.push(decoded.sv, decoded.id);
          }
        }

        // Build SELECT with optional joins
        let selectClause = 'p.*';
        let joinClause = '';

        if (include?.includes('customer')) {
          selectClause += `, row_to_json(c.*) as customer_data`;
          joinClause += ' LEFT JOIN customers c ON p.customer_id = c.id';
        }

        if (include?.includes('invoice')) {
          selectClause += `, row_to_json(i.*) as invoice_data`;
          joinClause += ' LEFT JOIN invoices i ON p.invoice_id = i.id';
        }

        if (include?.includes('job')) {
          selectClause += `, row_to_json(j.*) as job_data`;
          joinClause += ' LEFT JOIN jobs j ON p.job_id = j.id';
        }

        const query = `
          SELECT ${selectClause}
          FROM payments p
          ${joinClause}
          WHERE ${conditions.join(' AND ')}
          ORDER BY p.${sort_by} ${sort_order}, p.id ${sort_order}
          LIMIT $${paramIndex}
        `;
        values.push(limit + 1);

        const result = await pool.query(query, values);
        const hasMore = result.rows.length > limit;
        const payments = result.rows.slice(0, limit);

        // Build response
        const data = payments.map((row: any) => {
          const payment = formatPaymentResponse(row);
          if (row.customer_data) {
            payment.customer = row.customer_data;
          }
          if (row.invoice_data) {
            payment.invoice = row.invoice_data;
          }
          if (row.job_data) {
            payment.job = row.job_data;
          }
          return payment;
        });

        const response: CursorPaginationResult<any> = {
          data,
          pagination: {
            has_more: hasMore,
            next_cursor: hasMore
              ? encodeCursor(payments[payments.length - 1].id, payments[payments.length - 1][sort_by])
              : undefined,
            limit,
          },
        };

        res.json({
          success: true,
          ...response,
        });
      } catch (error) {
        console.error('[Payments API] List error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to list payments' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET SINGLE PAYMENT
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/:id',
    requireScopes(readScope('payments')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const include = req.query.include as string | string[] | undefined;
        const includeArr = include ? (Array.isArray(include) ? include : [include]) : [];

        let selectClause = 'p.*';
        let joinClause = '';

        if (includeArr.includes('customer')) {
          selectClause += `, row_to_json(c.*) as customer_data`;
          joinClause += ' LEFT JOIN customers c ON p.customer_id = c.id';
        }

        if (includeArr.includes('invoice')) {
          selectClause += `, row_to_json(i.*) as invoice_data`;
          joinClause += ' LEFT JOIN invoices i ON p.invoice_id = i.id';
        }

        if (includeArr.includes('job')) {
          selectClause += `, row_to_json(j.*) as job_data`;
          joinClause += ' LEFT JOIN jobs j ON p.job_id = j.id';
        }

        const query = `
          SELECT ${selectClause}
          FROM payments p
          ${joinClause}
          WHERE p.id = $1 AND p.org_id = $2
        `;
        const result = await pool.query(query, [id, apiContext.orgId]);

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Payment not found' },
          });
        }

        const row = result.rows[0];
        const payment = formatPaymentResponse(row);

        if (row.customer_data) {
          payment.customer = row.customer_data;
        }
        if (row.invoice_data) {
          payment.invoice = row.invoice_data;
        }
        if (row.job_data) {
          payment.job = row.job_data;
        }

        // Get refunds if any
        const refundsResult = await pool.query(
          'SELECT * FROM payment_refunds WHERE payment_id = $1 ORDER BY created_at DESC',
          [id]
        );
        if (refundsResult.rows.length > 0) {
          payment.refunds = refundsResult.rows;
        }

        res.json({ success: true, data: payment });
      } catch (error) {
        console.error('[Payments API] Get error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to get payment' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE PAYMENT
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/',
    requireScopes(writeScope('payments')),
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

        // Verify invoice if provided
        if (data.invoice_id) {
          const invoiceCheck = await pool.query(
            'SELECT id, customer_id FROM invoices WHERE id = $1 AND org_id = $2',
            [data.invoice_id, apiContext.orgId]
          );

          if (invoiceCheck.rows.length === 0) {
            return res.status(400).json({
              success: false,
              error: { code: 'INVALID_INVOICE', message: 'Invoice not found' },
            });
          }

          // Verify invoice belongs to customer
          if (invoiceCheck.rows[0].customer_id !== data.customer_id) {
            return res.status(400).json({
              success: false,
              error: { code: 'INVOICE_CUSTOMER_MISMATCH', message: 'Invoice does not belong to this customer' },
            });
          }
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

        const query = `
          INSERT INTO payments (
            org_id, customer_id, invoice_id, job_id, amount, currency,
            status, payment_method, payment_type, reference, payment_date,
            notes, metadata, external_transaction_id, processor,
            refunded_amount, created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            'completed', $7, $8, $9, $10,
            $11, $12, $13, $14,
            0, NOW(), NOW()
          )
          RETURNING *
        `;

        const values = [
          apiContext.orgId,
          data.customer_id,
          data.invoice_id || null,
          data.job_id || null,
          data.amount,
          data.currency,
          data.payment_method,
          data.payment_type,
          data.reference || null,
          data.payment_date || new Date(),
          data.notes || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.external_transaction_id || null,
          data.processor || null,
        ];

        const result = await pool.query(query, values);
        const payment = formatPaymentResponse(result.rows[0]);

        // Update invoice if linked
        if (data.invoice_id) {
          await updateInvoicePayment(pool, data.invoice_id, data.amount);
        }

        res.status(201).json({ success: true, data: payment });
      } catch (error) {
        console.error('[Payments API] Create error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to create payment' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // UPDATE PAYMENT
  // ─────────────────────────────────────────────────────────────────────────────

  router.patch(
    '/:id',
    requireScopes(writeScope('payments')),
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

        const data = parseResult.data;

        // Build dynamic update query
        const setClauses: string[] = ['updated_at = NOW()'];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.status !== undefined) {
          setClauses.push(`status = $${paramIndex++}`);
          values.push(data.status);
        }

        if (data.reference !== undefined) {
          setClauses.push(`reference = $${paramIndex++}`);
          values.push(data.reference);
        }

        if (data.notes !== undefined) {
          setClauses.push(`notes = $${paramIndex++}`);
          values.push(data.notes);
        }

        if (data.metadata !== undefined) {
          setClauses.push(`metadata = $${paramIndex++}`);
          values.push(JSON.stringify(data.metadata));
        }

        if (data.external_transaction_id !== undefined) {
          setClauses.push(`external_transaction_id = $${paramIndex++}`);
          values.push(data.external_transaction_id);
        }

        if (setClauses.length === 1) {
          return res.status(400).json({
            success: false,
            error: { code: 'NO_UPDATES', message: 'No valid fields to update' },
          });
        }

        values.push(id, apiContext.orgId);

        const query = `
          UPDATE payments
          SET ${setClauses.join(', ')}
          WHERE id = $${paramIndex++} AND org_id = $${paramIndex}
          RETURNING *
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Payment not found' },
          });
        }

        res.json({ success: true, data: formatPaymentResponse(result.rows[0]) });
      } catch (error) {
        console.error('[Payments API] Update error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to update payment' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE PAYMENT
  // ─────────────────────────────────────────────────────────────────────────────

  router.delete(
    '/:id',
    requireScopes(deleteScope('payments')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        // Get payment to check if we need to update invoice
        const paymentResult = await pool.query(
          'SELECT * FROM payments WHERE id = $1 AND org_id = $2',
          [id, apiContext.orgId]
        );

        if (paymentResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Payment not found' },
          });
        }

        const payment = paymentResult.rows[0];

        // Only allow deleting pending payments
        if (payment.status !== 'pending') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'CANNOT_DELETE',
              message: 'Only pending payments can be deleted. Use refund for completed payments.',
            },
          });
        }

        await pool.query('DELETE FROM payments WHERE id = $1', [id]);

        res.json({ success: true, data: { id, deleted: true } });
      } catch (error) {
        console.error('[Payments API] Delete error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to delete payment' },
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
    requireScopes(writeScope('payments')),
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

        const { amount: refundAmount, reason, notes } = parseResult.data;

        // Get payment
        const paymentResult = await pool.query(
          'SELECT * FROM payments WHERE id = $1 AND org_id = $2',
          [id, apiContext.orgId]
        );

        if (paymentResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Payment not found' },
          });
        }

        const payment = paymentResult.rows[0];

        if (payment.status !== 'completed' && payment.status !== 'partially_refunded') {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_STATUS', message: 'Payment cannot be refunded in current status' },
          });
        }

        const availableForRefund = Number(payment.amount) - Number(payment.refunded_amount || 0);
        const actualRefundAmount = refundAmount || availableForRefund;

        if (actualRefundAmount > availableForRefund) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_AMOUNT',
              message: `Refund amount exceeds available amount (${availableForRefund})`,
            },
          });
        }

        const newRefundedAmount = Number(payment.refunded_amount || 0) + actualRefundAmount;
        const isFullRefund = newRefundedAmount >= Number(payment.amount);
        const newStatus = isFullRefund ? 'refunded' : 'partially_refunded';

        // Create refund record
        await pool.query(
          `INSERT INTO payment_refunds (
            payment_id, amount, reason, notes, created_at
          ) VALUES ($1, $2, $3, $4, NOW())`,
          [id, actualRefundAmount, reason, notes || null]
        );

        // Update payment
        const result = await pool.query(
          `UPDATE payments
           SET refunded_amount = $1, status = $2, updated_at = NOW()
           WHERE id = $3
           RETURNING *`,
          [newRefundedAmount, newStatus, id]
        );

        // Update invoice if linked
        if (payment.invoice_id) {
          await updateInvoicePayment(pool, payment.invoice_id, -actualRefundAmount);
        }

        res.json({
          success: true,
          data: {
            ...formatPaymentResponse(result.rows[0]),
            refund: {
              amount: actualRefundAmount,
              reason,
              is_full_refund: isFullRefund,
            },
          },
        });
      } catch (error) {
        console.error('[Payments API] Refund error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to process refund' },
        });
      }
    }
  );

  // Cancel payment
  router.post(
    '/:id/cancel',
    requireScopes(writeScope('payments')),
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

        const { reason } = parseResult.data;

        const result = await pool.query(
          `UPDATE payments
           SET status = 'cancelled',
               notes = COALESCE(notes, '') || E'\\n\\nCancelled: ' || $1,
               updated_at = NOW()
           WHERE id = $2 AND org_id = $3 AND status = 'pending'
           RETURNING *`,
          [reason, id, apiContext.orgId]
        );

        if (result.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_STATUS', message: 'Only pending payments can be cancelled' },
          });
        }

        res.json({ success: true, data: formatPaymentResponse(result.rows[0]) });
      } catch (error) {
        console.error('[Payments API] Cancel error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to cancel payment' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // BATCH OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/batch',
    requireScopes(writeScope('payments')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = batchRecordPaymentsSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid batch payment data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { payments } = parseResult.data;
        const results: any[] = [];
        const errors: any[] = [];

        for (const paymentData of payments) {
          try {
            // Verify customer
            const customerCheck = await pool.query(
              'SELECT id FROM customers WHERE id = $1 AND org_id = $2',
              [paymentData.customer_id, apiContext.orgId]
            );

            if (customerCheck.rows.length === 0) {
              errors.push({
                customer_id: paymentData.customer_id,
                error: 'Customer not found',
              });
              continue;
            }

            const query = `
              INSERT INTO payments (
                org_id, customer_id, invoice_id, amount, currency,
                status, payment_method, payment_type, reference, payment_date,
                notes, refunded_amount, created_at, updated_at
              )
              VALUES (
                $1, $2, $3, $4, 'ARS',
                'completed', $5, 'invoice', $6, $7,
                $8, 0, NOW(), NOW()
              )
              RETURNING *
            `;

            const result = await pool.query(query, [
              apiContext.orgId,
              paymentData.customer_id,
              paymentData.invoice_id || null,
              paymentData.amount,
              paymentData.payment_method,
              paymentData.reference || null,
              paymentData.payment_date || new Date(),
              paymentData.notes || null,
            ]);

            results.push(formatPaymentResponse(result.rows[0]));

            // Update invoice if linked
            if (paymentData.invoice_id) {
              await updateInvoicePayment(pool, paymentData.invoice_id, paymentData.amount);
            }
          } catch (error) {
            errors.push({
              customer_id: paymentData.customer_id,
              error: 'Failed to create payment',
            });
          }
        }

        res.status(201).json({
          success: true,
          data: {
            created_count: results.length,
            error_count: errors.length,
            payments: results,
            errors: errors.length > 0 ? errors : undefined,
          },
        });
      } catch (error) {
        console.error('[Payments API] Batch create error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to batch create payments' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUMMARY / STATISTICS
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/summary/stats',
    requireScopes(readScope('payments')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { period } = req.query;

        let dateFilter = '';
        if (period === 'today') {
          dateFilter = `AND payment_date >= CURRENT_DATE`;
        } else if (period === 'week') {
          dateFilter = `AND payment_date >= CURRENT_DATE - INTERVAL '7 days'`;
        } else if (period === 'month') {
          dateFilter = `AND payment_date >= CURRENT_DATE - INTERVAL '30 days'`;
        } else if (period === 'year') {
          dateFilter = `AND payment_date >= CURRENT_DATE - INTERVAL '365 days'`;
        }

        const query = `
          SELECT
            COUNT(*) as total_count,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_received,
            COALESCE(SUM(refunded_amount), 0) as total_refunded,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending,
            COUNT(DISTINCT customer_id) as unique_customers,
            COALESCE(AVG(CASE WHEN status = 'completed' THEN amount END), 0) as average_payment
          FROM payments
          WHERE org_id = $1 ${dateFilter}
        `;

        const result = await pool.query(query, [apiContext.orgId]);
        const stats = result.rows[0];

        // Get breakdown by payment method
        const methodQuery = `
          SELECT
            payment_method,
            COUNT(*) as count,
            COALESCE(SUM(amount), 0) as total
          FROM payments
          WHERE org_id = $1 AND status = 'completed' ${dateFilter}
          GROUP BY payment_method
          ORDER BY total DESC
        `;

        const methodResult = await pool.query(methodQuery, [apiContext.orgId]);

        res.json({
          success: true,
          data: {
            total_count: parseInt(stats.total_count),
            total_received: Number(stats.total_received),
            total_refunded: Number(stats.total_refunded),
            total_pending: Number(stats.total_pending),
            net_received: Number(stats.total_received) - Number(stats.total_refunded),
            unique_customers: parseInt(stats.unique_customers),
            average_payment: Number(stats.average_payment),
            by_method: methodResult.rows.map((r: any) => ({
              method: r.payment_method,
              count: parseInt(r.count),
              total: Number(r.total),
            })),
          },
        });
      } catch (error) {
        console.error('[Payments API] Stats error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to get payment statistics' },
        });
      }
    }
  );

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function updateInvoicePayment(pool: Pool, invoiceId: string, amountDelta: number): Promise<void> {
  const invoiceResult = await pool.query(
    'SELECT total, amount_paid FROM invoices WHERE id = $1',
    [invoiceId]
  );

  if (invoiceResult.rows.length === 0) return;

  const invoice = invoiceResult.rows[0];
  const newAmountPaid = Math.max(0, Number(invoice.amount_paid) + amountDelta);
  const newAmountDue = Math.max(0, Number(invoice.total) - newAmountPaid);

  let newStatus: string;
  if (newAmountDue <= 0) {
    newStatus = 'paid';
  } else if (newAmountPaid > 0) {
    newStatus = 'partially_paid';
  } else {
    newStatus = 'sent';
  }

  await pool.query(
    `UPDATE invoices
     SET amount_paid = $1, amount_due = $2, status = $3,
         paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END,
         updated_at = NOW()
     WHERE id = $4`,
    [newAmountPaid, newAmountDue, newStatus, invoiceId]
  );
}
