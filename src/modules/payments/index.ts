/**
 * Payment Module
 * ==============
 *
 * Payment processing with state machine and refund support.
 */

import { Pool } from 'pg';
import { Router, Request, Response, NextFunction } from 'express';
import { OrgScopedRepository, objectToCamel } from '../../shared/repositories/base.repository';
import { Payment, PaymentStatus, PaymentMethod, PaginatedResult, PaginationParams, DateRange } from '../../shared/types/domain.types';
import { createPaymentStateMachine } from '../../shared/utils/state-machine';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreatePaymentDTO {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export interface RefundPaymentDTO {
  amount: number;
  reason: string;
}

export interface PaymentFilters {
  status?: PaymentStatus | PaymentStatus[];
  invoiceId?: string;
  customerId?: string;
  method?: PaymentMethod;
  dateRange?: DateRange;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class PaymentRepository extends OrgScopedRepository<Payment> {
  constructor(pool: Pool) {
    super(pool, 'payments');
  }

  async findByInvoice(orgId: string, invoiceId: string): Promise<Payment[]> {
    const result = await this.pool.query(
      `SELECT * FROM payments WHERE org_id = $1 AND invoice_id = $2 ORDER BY created_at DESC`,
      [orgId, invoiceId]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async findFiltered(orgId: string, filters: PaymentFilters, pagination: PaginationParams): Promise<PaginatedResult<Payment>> {
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE p.org_id = $1';
    const values: any[] = [orgId];
    let paramIndex = 2;

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        whereClause += ` AND p.status = ANY($${paramIndex})`;
        values.push(filters.status);
      } else {
        whereClause += ` AND p.status = $${paramIndex}`;
        values.push(filters.status);
      }
      paramIndex++;
    }

    if (filters.invoiceId) {
      whereClause += ` AND p.invoice_id = $${paramIndex}`;
      values.push(filters.invoiceId);
      paramIndex++;
    }

    if (filters.customerId) {
      whereClause += ` AND i.customer_id = $${paramIndex}`;
      values.push(filters.customerId);
      paramIndex++;
    }

    if (filters.method) {
      whereClause += ` AND p.method = $${paramIndex}`;
      values.push(filters.method);
      paramIndex++;
    }

    if (filters.dateRange?.start) {
      whereClause += ` AND p.created_at >= $${paramIndex}`;
      values.push(filters.dateRange.start);
      paramIndex++;
    }

    if (filters.dateRange?.end) {
      whereClause += ` AND p.created_at <= $${paramIndex}`;
      values.push(filters.dateRange.end);
      paramIndex++;
    }

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM payments p
       LEFT JOIN invoices i ON p.invoice_id = i.id
       ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT p.* FROM payments p
       LEFT JOIN invoices i ON p.invoice_id = i.id
       ${whereClause}
       ORDER BY p.${pagination.sortBy || 'created_at'} ${(pagination.sortOrder || 'desc').toUpperCase()}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      data: result.rows.map(row => this.mapRow(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTotalPaidForInvoice(orgId: string, invoiceId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM payments
       WHERE org_id = $1 AND invoice_id = $2 AND status IN ('completed', 'partial_refund')`,
      [orgId, invoiceId]
    );
    return parseFloat(result.rows[0].total);
  }

  async getTotalRefundedForPayment(paymentId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM payment_refunds WHERE payment_id = $1`,
      [paymentId]
    );
    return parseFloat(result.rows[0].total);
  }

  async createRefund(paymentId: string, amount: number, reason: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO payment_refunds (id, payment_id, amount, reason, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
      [paymentId, amount, reason]
    );
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<void> {
    const updates: Record<string, string> = {
      completed: 'completed_at = NOW()',
      failed: 'failed_at = NOW()',
      refunded: 'refunded_at = NOW()',
      partial_refund: 'refunded_at = NOW()',
    };

    const extraUpdate = updates[status] ? `, ${updates[status]}` : '';

    await this.pool.query(
      `UPDATE payments SET status = $2, updated_at = NOW()${extraUpdate} WHERE id = $1`,
      [id, status]
    );
  }

  protected mapRow(row: Record<string, any>): Payment {
    return objectToCamel<Payment>(row);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class PaymentService {
  private repo: PaymentRepository;
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
    this.repo = new PaymentRepository(pool);
  }

  async getById(orgId: string, id: string): Promise<Payment> {
    const payment = await this.repo.findByIdInOrg(orgId, id);
    if (!payment) throw new Error('Payment not found');
    return payment;
  }

  async list(orgId: string, filters: PaymentFilters, pagination: PaginationParams): Promise<PaginatedResult<Payment>> {
    return this.repo.findFiltered(orgId, filters, pagination);
  }

  async getByInvoice(orgId: string, invoiceId: string): Promise<Payment[]> {
    return this.repo.findByInvoice(orgId, invoiceId);
  }

  async create(orgId: string, data: CreatePaymentDTO): Promise<Payment> {
    // Verify invoice exists and get amount due
    const invoiceResult = await this.pool.query(
      `SELECT * FROM invoices WHERE org_id = $1 AND id = $2`,
      [orgId, data.invoiceId]
    );

    if (!invoiceResult.rows[0]) {
      throw new Error('Invoice not found');
    }

    const invoice = objectToCamel<any>(invoiceResult.rows[0]);

    if (!['issued', 'sent'].includes(invoice.status)) {
      throw new Error('Invoice must be issued or sent to accept payments');
    }

    // Check payment doesn't exceed remaining balance
    const totalPaid = await this.repo.getTotalPaidForInvoice(orgId, data.invoiceId);
    const remaining = invoice.total - totalPaid;

    if (data.amount > remaining) {
      throw new Error(`Payment amount exceeds remaining balance of ${remaining}`);
    }

    // Create payment
    const payment = await this.repo.createInOrg(orgId, {
      invoiceId: data.invoiceId,
      customerId: invoice.customerId,
      amount: data.amount,
      method: data.method,
      status: 'pending',
      reference: data.reference,
      notes: data.notes,
    });

    return payment;
  }

  async processPayment(orgId: string, id: string): Promise<Payment> {
    const payment = await this.getById(orgId, id);

    if (payment.status !== 'pending') {
      throw new Error('Payment must be pending to process');
    }

    // In real implementation, this would integrate with payment gateway
    // For now, mark as completed
    await this.repo.updateStatus(id, 'completed');

    // Check if invoice is fully paid
    const totalPaid = await this.repo.getTotalPaidForInvoice(orgId, payment.invoiceId);
    const invoiceResult = await this.pool.query(
      `SELECT total FROM invoices WHERE id = $1`,
      [payment.invoiceId]
    );

    if (invoiceResult.rows[0] && totalPaid >= invoiceResult.rows[0].total) {
      await this.pool.query(
        `UPDATE invoices SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [payment.invoiceId]
      );
    }

    return this.getById(orgId, id);
  }

  async failPayment(orgId: string, id: string, reason: string): Promise<Payment> {
    const payment = await this.getById(orgId, id);

    if (payment.status !== 'pending') {
      throw new Error('Payment must be pending to mark as failed');
    }

    await this.repo.updateStatus(id, 'failed');
    await this.repo.updateInOrg(orgId, id, { failureReason: reason } as any);

    return this.getById(orgId, id);
  }

  async refund(orgId: string, id: string, data: RefundPaymentDTO): Promise<Payment> {
    const payment = await this.getById(orgId, id);

    if (!['completed', 'partial_refund'].includes(payment.status)) {
      throw new Error('Payment must be completed to refund');
    }

    // Check refund doesn't exceed payment amount
    const totalRefunded = await this.repo.getTotalRefundedForPayment(id);
    const refundable = payment.amount - totalRefunded;

    if (data.amount > refundable) {
      throw new Error(`Refund amount exceeds refundable balance of ${refundable}`);
    }

    // Create refund record
    await this.repo.createRefund(id, data.amount, data.reason);

    // Update payment status
    const newTotalRefunded = totalRefunded + data.amount;
    const newStatus: PaymentStatus = newTotalRefunded >= payment.amount ? 'refunded' : 'partial_refund';
    await this.repo.updateStatus(id, newStatus);

    // Update invoice status if fully refunded
    if (newStatus === 'refunded') {
      // Recalculate invoice payment status
      const totalPaid = await this.repo.getTotalPaidForInvoice(orgId, payment.invoiceId);
      const invoiceResult = await this.pool.query(
        `SELECT total, status FROM invoices WHERE id = $1`,
        [payment.invoiceId]
      );

      if (invoiceResult.rows[0] && totalPaid < invoiceResult.rows[0].total) {
        // Revert to sent status if was paid
        if (invoiceResult.rows[0].status === 'paid') {
          await this.pool.query(
            `UPDATE invoices SET status = 'sent', paid_at = NULL, updated_at = NOW() WHERE id = $1`,
            [payment.invoiceId]
          );
        }
      }
    }

    return this.getById(orgId, id);
  }

  async getDailySummary(orgId: string, date: Date): Promise<{ total: number; count: number; byMethod: Record<string, number> }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.pool.query(
      `SELECT
         COUNT(*) as count,
         COALESCE(SUM(amount), 0) as total,
         method,
         COALESCE(SUM(amount), 0) as method_total
       FROM payments
       WHERE org_id = $1 AND status = 'completed'
         AND completed_at >= $2 AND completed_at <= $3
       GROUP BY method`,
      [orgId, startOfDay, endOfDay]
    );

    const byMethod: Record<string, number> = {};
    let total = 0;
    let count = 0;

    for (const row of result.rows) {
      byMethod[row.method] = parseFloat(row.method_total);
      total += parseFloat(row.method_total);
      count += parseInt(row.count, 10);
    }

    return { total, count, byMethod };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createPaymentRoutes(pool: Pool): Router {
  const router = Router();
  const service = new PaymentService(pool);

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const filters: PaymentFilters = {};
      if (req.query.status) filters.status = req.query.status as PaymentStatus;
      if (req.query.invoiceId) filters.invoiceId = req.query.invoiceId as string;
      if (req.query.method) filters.method = req.query.method as PaymentMethod;

      const result = await service.list(orgId, filters, {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });
      res.json({ data: result.data, meta: { total: result.total, page: result.page } });
    } catch (error) { next(error); }
  });

  router.get('/summary/daily', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      const summary = await service.getDailySummary(orgId, date);
      res.json({ data: summary });
    } catch (error) { next(error); }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const payment = await service.getById(orgId, req.params.id);
      res.json({ data: payment });
    } catch (error) { next(error); }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const payment = await service.create(orgId, req.body);
      res.status(201).json({ data: payment });
    } catch (error) { next(error); }
  });

  router.post('/:id/process', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const payment = await service.processPayment(orgId, req.params.id);
      res.json({ data: payment });
    } catch (error) { next(error); }
  });

  router.post('/:id/fail', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const payment = await service.failPayment(orgId, req.params.id, req.body.reason);
      res.json({ data: payment });
    } catch (error) { next(error); }
  });

  router.post('/:id/refund', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const payment = await service.refund(orgId, req.params.id, req.body);
      res.json({ data: payment });
    } catch (error) { next(error); }
  });

  return router;
}

export { PaymentRepository, PaymentService };
