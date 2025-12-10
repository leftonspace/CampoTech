/**
 * Customers API Controller
 * ========================
 *
 * RESTful API controller for customer resources.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersSchema,
  batchDeleteCustomersSchema,
  CustomerResponse,
  CreateCustomerInput,
  UpdateCustomerInput,
} from './customers.schema';
import { requireScopes } from '../../middleware/scope-check.middleware';
import { ApiRequestContext, CursorPaginationResult, ApiCustomer } from '../../public-api.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

export function createCustomersController(pool: Pool): Router {
  const router = Router();

  // ─────────────────────────────────────────────────────────────────────────────
  // LIST CUSTOMERS
  // GET /customers
  // ─────────────────────────────────────────────────────────────────────────────
  router.get(
    '/',
    requireScopes('read:customers'),
    async (req: Request, res: Response) => {
      try {
        const context = (req as any).apiContext as ApiRequestContext;

        // Validate query parameters
        const parseResult = listCustomersSchema.safeParse(req.query);
        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
              details: parseResult.error.flatten(),
            },
          });
        }

        const params = parseResult.data;
        const result = await listCustomers(pool, context.orgId, params);

        res.json({
          success: true,
          data: result.data,
          meta: {
            pagination: result.pagination,
            requestId: context.requestId,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('[CustomersAPI] List error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while fetching customers.',
          },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET CUSTOMER
  // GET /customers/:id
  // ─────────────────────────────────────────────────────────────────────────────
  router.get(
    '/:id',
    requireScopes('read:customers'),
    async (req: Request, res: Response) => {
      try {
        const context = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        // Validate UUID
        if (!isValidUUID(id)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_ID',
              message: 'Invalid customer ID format.',
            },
          });
        }

        const customer = await getCustomer(pool, context.orgId, id);

        if (!customer) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Customer with ID '${id}' not found.`,
            },
          });
        }

        res.json({
          success: true,
          data: customer,
          meta: {
            requestId: context.requestId,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('[CustomersAPI] Get error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while fetching the customer.',
          },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE CUSTOMER
  // POST /customers
  // ─────────────────────────────────────────────────────────────────────────────
  router.post(
    '/',
    requireScopes('write:customers'),
    async (req: Request, res: Response) => {
      try {
        const context = (req as any).apiContext as ApiRequestContext;

        // Validate request body
        const parseResult = createCustomerSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: parseResult.error.flatten(),
            },
          });
        }

        const customer = await createCustomer(pool, context.orgId, parseResult.data);

        res.status(201).json({
          success: true,
          data: customer,
          meta: {
            requestId: context.requestId,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error: any) {
        console.error('[CustomersAPI] Create error:', error);

        if (error.code === '23505') {
          // Unique constraint violation
          return res.status(409).json({
            success: false,
            error: {
              code: 'DUPLICATE_ENTRY',
              message: 'A customer with this email or phone already exists.',
            },
          });
        }

        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while creating the customer.',
          },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // UPDATE CUSTOMER
  // PUT /customers/:id
  // ─────────────────────────────────────────────────────────────────────────────
  router.put(
    '/:id',
    requireScopes('write:customers'),
    async (req: Request, res: Response) => {
      try {
        const context = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        if (!isValidUUID(id)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_ID',
              message: 'Invalid customer ID format.',
            },
          });
        }

        // Validate request body
        const parseResult = updateCustomerSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: parseResult.error.flatten(),
            },
          });
        }

        const customer = await updateCustomer(pool, context.orgId, id, parseResult.data);

        if (!customer) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Customer with ID '${id}' not found.`,
            },
          });
        }

        res.json({
          success: true,
          data: customer,
          meta: {
            requestId: context.requestId,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('[CustomersAPI] Update error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while updating the customer.',
          },
        });
      }
    }
  );

  // Also support PATCH for partial updates
  router.patch('/:id', requireScopes('write:customers'), router.stack.find(
    (r) => r.route?.path === '/:id' && r.route?.methods?.put
  )?.route?.stack[1]?.handle);

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE CUSTOMER
  // DELETE /customers/:id
  // ─────────────────────────────────────────────────────────────────────────────
  router.delete(
    '/:id',
    requireScopes('delete:customers'),
    async (req: Request, res: Response) => {
      try {
        const context = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        if (!isValidUUID(id)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_ID',
              message: 'Invalid customer ID format.',
            },
          });
        }

        const deleted = await deleteCustomer(pool, context.orgId, id);

        if (!deleted) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Customer with ID '${id}' not found.`,
            },
          });
        }

        res.status(204).send();
      } catch (error) {
        console.error('[CustomersAPI] Delete error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while deleting the customer.',
          },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // BATCH DELETE CUSTOMERS
  // POST /customers/batch-delete
  // ─────────────────────────────────────────────────────────────────────────────
  router.post(
    '/batch-delete',
    requireScopes('delete:customers'),
    async (req: Request, res: Response) => {
      try {
        const context = (req as any).apiContext as ApiRequestContext;

        const parseResult = batchDeleteCustomersSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: parseResult.error.flatten(),
            },
          });
        }

        const { ids } = parseResult.data;
        const result = await batchDeleteCustomers(pool, context.orgId, ids);

        res.json({
          success: true,
          data: {
            deleted: result.deleted,
            failed: result.failed,
          },
          meta: {
            requestId: context.requestId,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('[CustomersAPI] Batch delete error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred during batch delete.',
          },
        });
      }
    }
  );

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function listCustomers(
  pool: Pool,
  orgId: string,
  params: z.infer<typeof listCustomersSchema>
): Promise<CursorPaginationResult<ApiCustomer>> {
  const { cursor, limit, search, email, phone, tag, sort, order, createdAfter, createdBefore } = params;

  let query = `
    SELECT
      id, name, email, phone, company_name as company,
      address_street, address_city, address_state, address_postal_code, address_country,
      notes, tags, custom_fields, created_at, updated_at
    FROM customers
    WHERE org_id = $1 AND deleted_at IS NULL
  `;
  const values: any[] = [orgId];
  let paramIndex = 2;

  // Apply filters
  if (search) {
    query += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR phone ILIKE $${paramIndex})`;
    values.push(`%${search}%`);
    paramIndex++;
  }

  if (email) {
    query += ` AND email = $${paramIndex}`;
    values.push(email);
    paramIndex++;
  }

  if (phone) {
    query += ` AND phone = $${paramIndex}`;
    values.push(phone);
    paramIndex++;
  }

  if (tag) {
    query += ` AND $${paramIndex} = ANY(tags)`;
    values.push(tag);
    paramIndex++;
  }

  if (createdAfter) {
    query += ` AND created_at >= $${paramIndex}`;
    values.push(createdAfter);
    paramIndex++;
  }

  if (createdBefore) {
    query += ` AND created_at <= $${paramIndex}`;
    values.push(createdBefore);
    paramIndex++;
  }

  // Cursor pagination
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      const cursorOp = order === 'desc' ? '<' : '>';
      query += ` AND (${sort}, id) ${cursorOp} ($${paramIndex}, $${paramIndex + 1})`;
      values.push(cursorData.value, cursorData.id);
      paramIndex += 2;
    }
  }

  // Sorting
  const sortColumn = sort === 'name' ? 'name' : sort;
  query += ` ORDER BY ${sortColumn} ${order.toUpperCase()}, id ${order.toUpperCase()}`;

  // Limit + 1 to check for more results
  query += ` LIMIT $${paramIndex}`;
  values.push(limit + 1);

  const result = await pool.query(query, values);
  const hasMore = result.rows.length > limit;
  const customers = result.rows.slice(0, limit).map(mapRowToApiCustomer);

  let nextCursor: string | undefined;
  if (hasMore && customers.length > 0) {
    const lastCustomer = customers[customers.length - 1];
    const sortValue = sort === 'name' ? lastCustomer.name : lastCustomer.createdAt;
    nextCursor = encodeCursor({ value: sortValue, id: lastCustomer.id });
  }

  return {
    data: customers,
    pagination: {
      hasMore,
      nextCursor,
    },
  };
}

async function getCustomer(
  pool: Pool,
  orgId: string,
  id: string
): Promise<ApiCustomer | null> {
  const result = await pool.query(
    `
    SELECT
      id, name, email, phone, company_name as company,
      address_street, address_city, address_state, address_postal_code, address_country,
      notes, tags, custom_fields, created_at, updated_at
    FROM customers
    WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
    `,
    [id, orgId]
  );

  if (result.rows.length === 0) return null;
  return mapRowToApiCustomer(result.rows[0]);
}

async function createCustomer(
  pool: Pool,
  orgId: string,
  input: CreateCustomerInput
): Promise<ApiCustomer> {
  const result = await pool.query(
    `
    INSERT INTO customers (
      org_id, name, email, phone, company_name,
      address_street, address_city, address_state, address_postal_code, address_country,
      notes, tags, custom_fields
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING
      id, name, email, phone, company_name as company,
      address_street, address_city, address_state, address_postal_code, address_country,
      notes, tags, custom_fields, created_at, updated_at
    `,
    [
      orgId,
      input.name,
      input.email || null,
      input.phone || null,
      input.company || null,
      input.address?.street || null,
      input.address?.city || null,
      input.address?.state || null,
      input.address?.postalCode || null,
      input.address?.country || 'AR',
      input.notes || null,
      input.tags || [],
      input.customFields || null,
    ]
  );

  return mapRowToApiCustomer(result.rows[0]);
}

async function updateCustomer(
  pool: Pool,
  orgId: string,
  id: string,
  input: UpdateCustomerInput
): Promise<ApiCustomer | null> {
  // Build dynamic update query
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.email !== undefined) {
    updates.push(`email = $${paramIndex++}`);
    values.push(input.email);
  }
  if (input.phone !== undefined) {
    updates.push(`phone = $${paramIndex++}`);
    values.push(input.phone);
  }
  if (input.company !== undefined) {
    updates.push(`company_name = $${paramIndex++}`);
    values.push(input.company);
  }
  if (input.address !== undefined) {
    updates.push(`address_street = $${paramIndex++}`);
    values.push(input.address?.street || null);
    updates.push(`address_city = $${paramIndex++}`);
    values.push(input.address?.city || null);
    updates.push(`address_state = $${paramIndex++}`);
    values.push(input.address?.state || null);
    updates.push(`address_postal_code = $${paramIndex++}`);
    values.push(input.address?.postalCode || null);
    updates.push(`address_country = $${paramIndex++}`);
    values.push(input.address?.country || 'AR');
  }
  if (input.notes !== undefined) {
    updates.push(`notes = $${paramIndex++}`);
    values.push(input.notes);
  }
  if (input.tags !== undefined) {
    updates.push(`tags = $${paramIndex++}`);
    values.push(input.tags);
  }
  if (input.customFields !== undefined) {
    updates.push(`custom_fields = $${paramIndex++}`);
    values.push(input.customFields);
  }

  if (updates.length === 0) {
    return getCustomer(pool, orgId, id);
  }

  updates.push(`updated_at = NOW()`);
  values.push(id, orgId);

  const result = await pool.query(
    `
    UPDATE customers
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex++} AND org_id = $${paramIndex} AND deleted_at IS NULL
    RETURNING
      id, name, email, phone, company_name as company,
      address_street, address_city, address_state, address_postal_code, address_country,
      notes, tags, custom_fields, created_at, updated_at
    `,
    values
  );

  if (result.rows.length === 0) return null;
  return mapRowToApiCustomer(result.rows[0]);
}

async function deleteCustomer(
  pool: Pool,
  orgId: string,
  id: string
): Promise<boolean> {
  // Soft delete
  const result = await pool.query(
    `
    UPDATE customers
    SET deleted_at = NOW()
    WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
    `,
    [id, orgId]
  );

  return (result.rowCount ?? 0) > 0;
}

async function batchDeleteCustomers(
  pool: Pool,
  orgId: string,
  ids: string[]
): Promise<{ deleted: string[]; failed: string[] }> {
  const deleted: string[] = [];
  const failed: string[] = [];

  for (const id of ids) {
    try {
      const success = await deleteCustomer(pool, orgId, id);
      if (success) {
        deleted.push(id);
      } else {
        failed.push(id);
      }
    } catch {
      failed.push(id);
    }
  }

  return { deleted, failed };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function mapRowToApiCustomer(row: any): ApiCustomer {
  return {
    id: row.id,
    name: row.name,
    email: row.email || null,
    phone: row.phone || null,
    company: row.company || null,
    address: row.address_street
      ? {
          street: row.address_street,
          city: row.address_city,
          state: row.address_state,
          postalCode: row.address_postal_code,
          country: row.address_country || 'AR',
        }
      : null,
    notes: row.notes || null,
    tags: row.tags || [],
    customFields: row.custom_fields || null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function encodeCursor(data: { value: any; id: string }): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decodeCursor(cursor: string): { value: any; id: string } | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    return null;
  }
}
