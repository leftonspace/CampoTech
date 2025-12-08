/**
 * Invoice Module
 * ==============
 *
 * Invoice management with AFIP compliance and state machine.
 */

import { Pool } from 'pg';
import { Router, Request, Response, NextFunction } from 'express';
import { OrgScopedRepository, objectToCamel } from '../../shared/repositories/base.repository';
import { Invoice, InvoiceStatus, InvoiceType, InvoiceLineItem, IVACondition, PaginatedResult, PaginationParams, DateRange } from '../../shared/types/domain.types';
import { createInvoiceStateMachine, InvoiceTransitionContext } from '../../shared/utils/state-machine';
import { determineInvoiceType, calculateTax, IVA_RATES } from '../../shared/utils/validation';
import { validateMoney, validateQuantity, validateTaxRate } from '../../shared/utils/database.utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateInvoiceDTO {
  jobId?: string;
  customerId: string;
  lineItems: CreateInvoiceLineItemDTO[];
  dueDate?: Date;
}

export interface CreateInvoiceLineItemDTO {
  productCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface InvoiceFilters {
  status?: InvoiceStatus | InvoiceStatus[];
  customerId?: string;
  jobId?: string;
  invoiceType?: InvoiceType;
  dateRange?: DateRange;
}

export interface IssueCAEResult {
  success: boolean;
  cae?: string;
  caeExpiry?: Date;
  invoiceNumber?: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class InvoiceRepository extends OrgScopedRepository<Invoice> {
  constructor(pool: Pool) {
    super(pool, 'invoices');
  }

  async getNextInvoiceNumber(orgId: string, puntoVenta: number, invoiceType: InvoiceType): Promise<number> {
    // Use database function for atomic sequence
    const result = await this.pool.query(
      `SELECT get_next_invoice_number($1, $2, $3) as next_number`,
      [orgId, puntoVenta, invoiceType]
    );
    return result.rows[0].next_number;
  }

  async findByInvoiceNumber(orgId: string, puntoVenta: number, invoiceType: InvoiceType, invoiceNumber: number): Promise<Invoice | null> {
    const result = await this.pool.query(
      `SELECT * FROM invoices WHERE org_id = $1 AND punto_venta = $2 AND invoice_type = $3 AND invoice_number = $4`,
      [orgId, puntoVenta, invoiceType, invoiceNumber]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findFiltered(orgId: string, filters: InvoiceFilters, pagination: PaginationParams): Promise<PaginatedResult<Invoice>> {
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE org_id = $1';
    const values: any[] = [orgId];
    let paramIndex = 2;

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        whereClause += ` AND status = ANY($${paramIndex})`;
        values.push(filters.status);
      } else {
        whereClause += ` AND status = $${paramIndex}`;
        values.push(filters.status);
      }
      paramIndex++;
    }

    if (filters.customerId) {
      whereClause += ` AND customer_id = $${paramIndex}`;
      values.push(filters.customerId);
      paramIndex++;
    }

    if (filters.jobId) {
      whereClause += ` AND job_id = $${paramIndex}`;
      values.push(filters.jobId);
      paramIndex++;
    }

    if (filters.invoiceType) {
      whereClause += ` AND invoice_type = $${paramIndex}`;
      values.push(filters.invoiceType);
      paramIndex++;
    }

    const countResult = await this.pool.query(`SELECT COUNT(*) FROM invoices ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT * FROM invoices ${whereClause}
       ORDER BY ${pagination.sortBy || 'created_at'} ${(pagination.sortOrder || 'desc').toUpperCase()}
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

  async updateCAE(id: string, cae: string, caeExpiry: Date, invoiceNumber: number): Promise<Invoice | null> {
    const result = await this.pool.query(
      `UPDATE invoices SET
        cae = $2, cae_expiry = $3, invoice_number = $4,
        status = 'issued', issued_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, cae, caeExpiry, invoiceNumber]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markSent(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE invoices SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  async markPaid(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE invoices SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  async voidInvoice(id: string, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE invoices SET status = 'voided', voided_at = NOW(), void_reason = $2, updated_at = NOW() WHERE id = $1`,
      [id, reason]
    );
  }

  protected mapRow(row: Record<string, any>): Invoice {
    const mapped = objectToCamel<Invoice>(row);
    if (typeof mapped.lineItems === 'string') {
      mapped.lineItems = JSON.parse(mapped.lineItems);
    }
    if (typeof mapped.afipResponse === 'string') {
      mapped.afipResponse = JSON.parse(mapped.afipResponse);
    }
    return mapped;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class InvoiceService {
  private repo: InvoiceRepository;
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
    this.repo = new InvoiceRepository(pool);
  }

  async getById(orgId: string, id: string): Promise<Invoice> {
    const invoice = await this.repo.findByIdInOrg(orgId, id);
    if (!invoice) throw new Error('Invoice not found');
    return invoice;
  }

  async list(orgId: string, filters: InvoiceFilters, pagination: PaginationParams): Promise<PaginatedResult<Invoice>> {
    return this.repo.findFiltered(orgId, filters, pagination);
  }

  async create(orgId: string, data: CreateInvoiceDTO, sellerIVA: IVACondition, buyerIVA: IVACondition, puntoVenta: number): Promise<Invoice> {
    // Determine invoice type based on IVA conditions
    const invoiceType = determineInvoiceType(sellerIVA, buyerIVA);

    // Validate line items
    if (!data.lineItems || data.lineItems.length === 0) {
      throw new Error('Invoice must have at least one line item');
    }

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;

    const lineItems: InvoiceLineItem[] = data.lineItems.map((item, index) => {
      // Validate numeric fields
      validateQuantity(item.quantity, `lineItems[${index}].quantity`);
      validateMoney(item.unitPrice, `lineItems[${index}].unitPrice`);
      validateTaxRate(item.taxRate, `lineItems[${index}].taxRate`);

      const itemSubtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
      const itemTax = Math.round(itemSubtotal * item.taxRate * 100) / 100;
      const itemTotal = itemSubtotal + itemTax;

      subtotal += itemSubtotal;
      taxAmount += itemTax;

      return {
        id: crypto.randomUUID(),
        productCode: item.productCode,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxAmount: itemTax,
        total: itemTotal,
      };
    });

    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    return this.repo.createInOrg(orgId, {
      jobId: data.jobId,
      customerId: data.customerId,
      invoiceType,
      puntoVenta,
      status: 'draft',
      dueDate: data.dueDate,
      lineItems,
      subtotal,
      taxAmount,
      total,
    });
  }

  async submitToAFIP(orgId: string, id: string): Promise<Invoice> {
    const invoice = await this.getById(orgId, id);

    if (invoice.status !== 'draft') {
      throw new Error('Invoice must be in draft status to submit to AFIP');
    }

    // Update status to pending_cae
    await this.repo.updateInOrg(orgId, id, { status: 'pending_cae' } as any);

    // TODO: Add to AFIP queue for processing
    // await addToQueue('cae-queue', { invoiceId: id, orgId });

    return this.getById(orgId, id);
  }

  async processCAEResult(orgId: string, id: string, result: IssueCAEResult): Promise<Invoice> {
    const invoice = await this.getById(orgId, id);

    if (invoice.status !== 'pending_cae') {
      throw new Error('Invoice must be in pending_cae status');
    }

    if (result.success && result.cae && result.caeExpiry && result.invoiceNumber) {
      // CAE obtained successfully
      const updated = await this.repo.updateCAE(id, result.cae, result.caeExpiry, result.invoiceNumber);
      if (!updated) throw new Error('Failed to update invoice with CAE');
      return updated;
    } else {
      // CAE failed
      await this.repo.updateInOrg(orgId, id, {
        status: 'cae_failed',
        afipResponse: { error: result.error },
      } as any);
      throw new Error(`AFIP Error: ${result.error}`);
    }
  }

  async markAsSent(orgId: string, id: string): Promise<void> {
    const invoice = await this.getById(orgId, id);
    if (!['issued', 'sent'].includes(invoice.status)) {
      throw new Error('Invoice must be issued to mark as sent');
    }
    await this.repo.markSent(id);
  }

  async markAsPaid(orgId: string, id: string): Promise<void> {
    const invoice = await this.getById(orgId, id);
    if (!['issued', 'sent'].includes(invoice.status)) {
      throw new Error('Invoice must be issued or sent to mark as paid');
    }
    await this.repo.markPaid(id);
  }

  async void(orgId: string, id: string, reason: string): Promise<void> {
    const invoice = await this.getById(orgId, id);
    if (invoice.status === 'voided') {
      throw new Error('Invoice is already voided');
    }
    await this.repo.voidInvoice(id, reason);
  }

  async createFromJob(orgId: string, jobId: string, sellerIVA: IVACondition, buyerIVA: IVACondition, puntoVenta: number): Promise<Invoice> {
    // Get job with line items
    const jobResult = await this.pool.query(
      `SELECT * FROM jobs WHERE org_id = $1 AND id = $2`,
      [orgId, jobId]
    );

    if (!jobResult.rows[0]) throw new Error('Job not found');
    const job = objectToCamel<any>(jobResult.rows[0]);

    const lineItems = (typeof job.lineItems === 'string' ? JSON.parse(job.lineItems) : job.lineItems) || [];

    return this.create(
      orgId,
      {
        jobId,
        customerId: job.customerId,
        lineItems: lineItems.map((item: any) => ({
          productCode: item.priceBookItemId || '999999',
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
        })),
      },
      sellerIVA,
      buyerIVA,
      puntoVenta
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createInvoiceRoutes(pool: Pool): Router {
  const router = Router();
  const service = new InvoiceService(pool);

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const filters: InvoiceFilters = {};
      if (req.query.status) filters.status = req.query.status as InvoiceStatus;
      if (req.query.customerId) filters.customerId = req.query.customerId as string;

      const result = await service.list(orgId, filters, {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });
      res.json({ data: result.data, meta: { total: result.total, page: result.page } });
    } catch (error) { next(error); }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const invoice = await service.getById(orgId, req.params.id);
      res.json({ data: invoice });
    } catch (error) { next(error); }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      // TODO: Get IVA conditions from org and customer
      const invoice = await service.create(orgId, req.body, 'responsable_inscripto', 'consumidor_final', 1);
      res.status(201).json({ data: invoice });
    } catch (error) { next(error); }
  });

  router.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const invoice = await service.submitToAFIP(orgId, req.params.id);
      res.json({ data: invoice });
    } catch (error) { next(error); }
  });

  router.post('/:id/sent', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      await service.markAsSent(orgId, req.params.id);
      res.status(204).send();
    } catch (error) { next(error); }
  });

  router.post('/:id/void', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      await service.void(orgId, req.params.id, req.body.reason);
      res.status(204).send();
    } catch (error) { next(error); }
  });

  return router;
}

export { InvoiceRepository, InvoiceService };
