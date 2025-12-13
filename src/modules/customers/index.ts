/**
 * Customer Module
 * ===============
 *
 * Customer management with CUIT validation and IVA condition.
 */

import { Pool } from 'pg';
import { Router, Request, Response, NextFunction } from 'express';
import { OrgScopedRepository, objectToCamel } from '../../shared/repositories/base.repository';
import { Customer, IVACondition, PaginatedResult, PaginationParams } from '../../shared/types/domain.types';
import { validateCUIT, validatePhone, normalizePhone, validateEmail } from '../../shared/utils/validation';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateCustomerDTO {
  fullName: string;
  phone: string;
  email?: string;
  cuit?: string;
  ivaCondition?: IVACondition;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  notes?: string;
}

export interface UpdateCustomerDTO {
  fullName?: string;
  phone?: string;
  email?: string;
  cuit?: string;
  ivaCondition?: IVACondition;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  notes?: string;
}

export interface CustomerSearchParams {
  query?: string;
  city?: string;
  hasJobs?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class CustomerRepository extends OrgScopedRepository<Customer> {
  constructor(pool: Pool) {
    super(pool, 'customers');
  }

  async findByPhone(orgId: string, phone: string): Promise<Customer | null> {
    const result = await this.pool.query(
      `SELECT * FROM customers WHERE org_id = $1 AND phone = $2 AND is_active = true`,
      [orgId, phone]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByCUIT(orgId: string, cuit: string): Promise<Customer | null> {
    const result = await this.pool.query(
      `SELECT * FROM customers WHERE org_id = $1 AND cuit = $2 AND is_active = true`,
      [orgId, cuit]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async search(
    orgId: string,
    params: CustomerSearchParams,
    pagination: PaginationParams
  ): Promise<PaginatedResult<Customer>> {
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE org_id = $1 AND is_active = true';
    const values: any[] = [orgId];
    let paramIndex = 2;

    if (params.query) {
      whereClause += ` AND (
        full_name ILIKE $${paramIndex} OR
        phone ILIKE $${paramIndex} OR
        cuit ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex}
      )`;
      values.push(`%${params.query}%`);
      paramIndex++;
    }

    if (params.city) {
      whereClause += ` AND city = $${paramIndex}`;
      values.push(params.city);
      paramIndex++;
    }

    // Count query
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM customers ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Data query
    const result = await this.pool.query(
      `SELECT * FROM customers ${whereClause}
       ORDER BY ${pagination.sortBy ? pagination.sortBy : 'full_name'} ${pagination.sortOrder || 'ASC'}
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

  async getWithJobCount(orgId: string, id: string): Promise<Customer & { jobCount: number } | null> {
    const result = await this.pool.query(
      `SELECT c.*, COUNT(j.id) as job_count
       FROM customers c
       LEFT JOIN jobs j ON j.customer_id = c.id
       WHERE c.org_id = $1 AND c.id = $2
       GROUP BY c.id`,
      [orgId, id]
    );
    if (!result.rows[0]) return null;
    return { ...this.mapRow(result.rows[0]), jobCount: parseInt(result.rows[0].job_count, 10) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class CustomerService {
  private repo: CustomerRepository;

  constructor(pool: Pool) {
    this.repo = new CustomerRepository(pool);
  }

  async getById(orgId: string, id: string): Promise<Customer> {
    const customer = await this.repo.findByIdInOrg(orgId, id);
    if (!customer) throw new Error('Customer not found');
    return customer;
  }

  async search(
    orgId: string,
    params: CustomerSearchParams,
    pagination: PaginationParams
  ): Promise<PaginatedResult<Customer>> {
    return this.repo.search(orgId, params, pagination);
  }

  async create(orgId: string, data: CreateCustomerDTO): Promise<Customer> {
    // Validate phone
    const phoneValidation = validatePhone(data.phone);
    if (!phoneValidation.valid) throw new Error(phoneValidation.error);

    // Check duplicate phone
    const existingByPhone = await this.repo.findByPhone(orgId, phoneValidation.normalized!);
    if (existingByPhone) throw new Error('A customer with this phone already exists');

    // Validate and format CUIT if provided
    let formattedCUIT: string | undefined;
    if (data.cuit) {
      const cuitValidation = validateCUIT(data.cuit);
      if (!cuitValidation.valid) throw new Error(cuitValidation.error);
      formattedCUIT = cuitValidation.formatted;

      // Check duplicate CUIT
      const existingByCUIT = await this.repo.findByCUIT(orgId, formattedCUIT!);
      if (existingByCUIT) throw new Error('A customer with this CUIT already exists');
    }

    // Validate email if provided
    if (data.email) {
      const emailValidation = validateEmail(data.email);
      if (!emailValidation.valid) throw new Error(emailValidation.error);
    }

    // Default IVA condition
    const ivaCondition = data.ivaCondition || (formattedCUIT ? 'responsable_inscripto' : 'consumidor_final');

    return this.repo.createInOrg(orgId, {
      fullName: data.fullName,
      phone: phoneValidation.normalized!,
      email: data.email,
      cuit: formattedCUIT,
      ivaCondition,
      address: data.address,
      city: data.city,
      province: data.province,
      postalCode: data.postalCode,
      notes: data.notes,
      isActive: true,
    });
  }

  async update(orgId: string, id: string, data: UpdateCustomerDTO): Promise<Customer> {
    await this.getById(orgId, id);

    const updateData: Partial<Customer> = { ...data };

    // Validate phone if changed
    if (data.phone) {
      const phoneValidation = validatePhone(data.phone);
      if (!phoneValidation.valid) throw new Error(phoneValidation.error);
      updateData.phone = phoneValidation.normalized;
    }

    // Validate CUIT if changed
    if (data.cuit) {
      const cuitValidation = validateCUIT(data.cuit);
      if (!cuitValidation.valid) throw new Error(cuitValidation.error);
      updateData.cuit = cuitValidation.formatted;
    }

    const updated = await this.repo.updateInOrg(orgId, id, updateData);
    if (!updated) throw new Error('Failed to update customer');
    return updated;
  }

  async delete(orgId: string, id: string): Promise<void> {
    const customer = await this.repo.getWithJobCount(orgId, id);
    if (!customer) throw new Error('Customer not found');

    if (customer.jobCount > 0) {
      // Soft delete if has jobs
      await this.repo.softDeleteInOrg(orgId, id);
    } else {
      // Hard delete if no jobs
      await this.repo.deleteInOrg(orgId, id);
    }
  }

  async findOrCreateByPhone(orgId: string, phone: string, name: string): Promise<Customer> {
    const normalized = normalizePhone(phone);
    const existing = await this.repo.findByPhone(orgId, normalized);
    if (existing) return existing;

    return this.repo.createInOrg(orgId, {
      fullName: name,
      phone: normalized,
      ivaCondition: 'consumidor_final',
      isActive: true,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createCustomerRoutes(pool: Pool): Router {
  const router = Router();
  const service = new CustomerService(pool);

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const result = await service.search(
        orgId,
        { query: req.query.q as string, city: req.query.city as string },
        {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
          sortBy: req.query.sortBy as string,
          sortOrder: req.query.sortOrder as 'asc' | 'desc',
        }
      );
      res.json({ data: result.data, meta: { total: result.total, page: result.page, totalPages: result.totalPages } });
    } catch (error) { next(error); }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const customer = await service.getById(orgId, req.params.id);
      res.json({ data: customer });
    } catch (error) { next(error); }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const customer = await service.create(orgId, req.body);
      res.status(201).json({ data: customer });
    } catch (error) { next(error); }
  });

  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const customer = await service.update(orgId, req.params.id, req.body);
      res.json({ data: customer });
    } catch (error) { next(error); }
  });

  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      await service.delete(orgId, req.params.id);
      res.status(204).send();
    } catch (error) { next(error); }
  });

  return router;
}
