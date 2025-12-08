/**
 * Base Repository
 * ===============
 *
 * Abstract base repository with common CRUD operations.
 * All repositories extend this for consistent data access patterns.
 */

import { Pool, PoolClient } from 'pg';
import { PaginatedResult, PaginationParams, BaseEntity, OrgScopedEntity } from '../types/domain.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface QueryOptions {
  client?: PoolClient;
}

export interface FindOptions<T> extends QueryOptions {
  where?: Partial<T>;
  orderBy?: { field: keyof T; order: 'asc' | 'desc' };
}

export interface CreateResult<T> {
  data: T;
  isNew: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: ALLOWED SORT COLUMNS (prevents SQL injection)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Whitelist of allowed sort columns to prevent SQL injection
 * These are snake_case database column names
 */
const ALLOWED_SORT_COLUMNS = new Set([
  'id', 'created_at', 'updated_at', 'name', 'full_name', 'email', 'phone',
  'status', 'scheduled_at', 'completed_at', 'cancelled_at', 'due_date',
  'total', 'subtotal', 'amount', 'unit_price', 'quantity',
  'invoice_number', 'invoice_type', 'punto_venta',
  'city', 'province', 'address', 'code', 'category', 'sort_order',
  'issued_at', 'sent_at', 'paid_at', 'voided_at',
  'last_login_at', 'role', 'is_active',
]);

/**
 * Validate and sanitize sort column name
 * Throws error if column is not in whitelist
 */
export function validateSortColumn(column: string): string {
  const snakeColumn = toSnakeCase(column);
  if (!ALLOWED_SORT_COLUMNS.has(snakeColumn)) {
    throw new Error(`Invalid sort column: ${column}`);
  }
  return snakeColumn;
}

/**
 * Validate sort order
 */
export function validateSortOrder(order?: string): 'ASC' | 'DESC' {
  if (!order) return 'ASC';
  const upper = order.toUpperCase();
  if (upper !== 'ASC' && upper !== 'DESC') {
    throw new Error('Sort order must be ASC or DESC');
  }
  return upper as 'ASC' | 'DESC';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CASE CONVERSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert camelCase to snake_case
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert object keys from camelCase to snake_case
 */
export function objectToSnake<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[toSnakeCase(key)] = value;
    }
  }
  return result;
}

/**
 * Convert object keys from snake_case to camelCase
 */
export function objectToCamel<T>(obj: Record<string, any>): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toCamelCase(key)] = value;
  }
  return result as T;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BASE REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export abstract class BaseRepository<T extends BaseEntity> {
  protected pool: Pool;
  protected tableName: string;

  constructor(pool: Pool, tableName: string) {
    this.pool = pool;
    this.tableName = tableName;
  }

  /**
   * Find by ID
   */
  async findById(id: string, options?: QueryOptions): Promise<T | null> {
    const client = options?.client || this.pool;
    const result = await client.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find one by criteria
   */
  async findOne(criteria: Partial<T>, options?: QueryOptions): Promise<T | null> {
    const client = options?.client || this.pool;
    const { whereClause, values } = this.buildWhereClause(criteria);

    const result = await client.query(
      `SELECT * FROM ${this.tableName} ${whereClause} LIMIT 1`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find all matching criteria
   */
  async findAll(options?: FindOptions<T>): Promise<T[]> {
    const client = options?.client || this.pool;
    const { whereClause, values } = options?.where
      ? this.buildWhereClause(options.where)
      : { whereClause: '', values: [] };

    let query = `SELECT * FROM ${this.tableName} ${whereClause}`;

    if (options?.orderBy) {
      const field = toSnakeCase(String(options.orderBy.field));
      query += ` ORDER BY ${field} ${options.orderBy.order.toUpperCase()}`;
    }

    const result = await client.query(query, values);
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Find with pagination
   */
  async findPaginated(
    criteria: Partial<T>,
    pagination: PaginationParams,
    options?: QueryOptions
  ): Promise<PaginatedResult<T>> {
    const client = options?.client || this.pool;
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = (page - 1) * limit;

    const { whereClause, values } = this.buildWhereClause(criteria);

    // Get total count
    const countResult = await client.query(
      `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated data
    let query = `SELECT * FROM ${this.tableName} ${whereClause}`;

    if (pagination.sortBy) {
      // SECURITY: Validate sort column against whitelist to prevent SQL injection
      const field = validateSortColumn(pagination.sortBy);
      const order = validateSortOrder(pagination.sortOrder);
      query += ` ORDER BY ${field} ${order}`;
    } else {
      query += ` ORDER BY created_at DESC`;
    }

    query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;

    const result = await client.query(query, [...values, limit, offset]);

    return {
      data: result.rows.map(row => this.mapRow(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new record
   */
  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>, options?: QueryOptions): Promise<T> {
    const client = options?.client || this.pool;
    const id = crypto.randomUUID();
    const now = new Date();

    const snakeData = objectToSnake(data as Record<string, any>);
    const fields = ['id', 'created_at', 'updated_at', ...Object.keys(snakeData)];
    const placeholders = fields.map((_, i) => `$${i + 1}`);
    const values = [id, now, now, ...Object.values(snakeData)];

    const result = await client.query(
      `INSERT INTO ${this.tableName} (${fields.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      values
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Update a record
   */
  async update(id: string, data: Partial<T>, options?: QueryOptions): Promise<T | null> {
    const client = options?.client || this.pool;
    const snakeData = objectToSnake(data as Record<string, any>);

    // Remove id, createdAt from update
    delete snakeData.id;
    delete snakeData.created_at;

    // Always update updated_at
    snakeData.updated_at = new Date();

    const fields = Object.keys(snakeData);
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = [id, ...Object.values(snakeData)];

    const result = await client.query(
      `UPDATE ${this.tableName}
       SET ${setClause}
       WHERE id = $1
       RETURNING *`,
      values
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Delete a record
   */
  async delete(id: string, options?: QueryOptions): Promise<boolean> {
    const client = options?.client || this.pool;
    const result = await client.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Soft delete (set is_active = false)
   */
  async softDelete(id: string, options?: QueryOptions): Promise<boolean> {
    const client = options?.client || this.pool;
    const result = await client.query(
      `UPDATE ${this.tableName} SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if record exists
   */
  async exists(id: string, options?: QueryOptions): Promise<boolean> {
    const client = options?.client || this.pool;
    const result = await client.query(
      `SELECT 1 FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rows.length > 0;
  }

  /**
   * Count records
   */
  async count(criteria?: Partial<T>, options?: QueryOptions): Promise<number> {
    const client = options?.client || this.pool;
    const { whereClause, values } = criteria
      ? this.buildWhereClause(criteria)
      : { whereClause: '', values: [] };

    const result = await client.query(
      `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`,
      values
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Build WHERE clause from criteria
   */
  protected buildWhereClause(criteria: Partial<T>): { whereClause: string; values: any[] } {
    const snakeCriteria = objectToSnake(criteria as Record<string, any>);
    const entries = Object.entries(snakeCriteria).filter(([, v]) => v !== undefined);

    if (entries.length === 0) {
      return { whereClause: '', values: [] };
    }

    const conditions = entries.map(([key], i) => `${key} = $${i + 1}`);
    const values = entries.map(([, value]) => value);

    return {
      whereClause: `WHERE ${conditions.join(' AND ')}`,
      values,
    };
  }

  /**
   * Map database row to domain entity
   */
  protected mapRow(row: Record<string, any>): T {
    return objectToCamel<T>(row);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORG-SCOPED REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export abstract class OrgScopedRepository<T extends OrgScopedEntity> extends BaseRepository<T> {
  /**
   * Find by ID within org scope
   */
  async findByIdInOrg(orgId: string, id: string, options?: QueryOptions): Promise<T | null> {
    const client = options?.client || this.pool;
    const result = await client.query(
      `SELECT * FROM ${this.tableName} WHERE org_id = $1 AND id = $2`,
      [orgId, id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find all within org scope
   */
  async findAllInOrg(orgId: string, options?: FindOptions<T>): Promise<T[]> {
    const client = options?.client || this.pool;
    const criteria = { ...options?.where, orgId } as Partial<T>;
    return this.findAll({ ...options, where: criteria, client });
  }

  /**
   * Find paginated within org scope
   */
  async findPaginatedInOrg(
    orgId: string,
    criteria: Partial<T>,
    pagination: PaginationParams,
    options?: QueryOptions
  ): Promise<PaginatedResult<T>> {
    const scopedCriteria = { ...criteria, orgId } as Partial<T>;
    return this.findPaginated(scopedCriteria, pagination, options);
  }

  /**
   * Create within org scope
   */
  async createInOrg(
    orgId: string,
    data: Omit<T, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>,
    options?: QueryOptions
  ): Promise<T> {
    return this.create({ ...data, orgId } as any, options);
  }

  /**
   * Update within org scope
   */
  async updateInOrg(
    orgId: string,
    id: string,
    data: Partial<T>,
    options?: QueryOptions
  ): Promise<T | null> {
    const client = options?.client || this.pool;
    const snakeData = objectToSnake(data as Record<string, any>);

    // Remove id, orgId, createdAt from update
    delete snakeData.id;
    delete snakeData.org_id;
    delete snakeData.created_at;

    // Always update updated_at
    snakeData.updated_at = new Date();

    const fields = Object.keys(snakeData);
    const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
    const values = [orgId, id, ...Object.values(snakeData)];

    const result = await client.query(
      `UPDATE ${this.tableName}
       SET ${setClause}
       WHERE org_id = $1 AND id = $2
       RETURNING *`,
      values
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Delete within org scope
   */
  async deleteInOrg(orgId: string, id: string, options?: QueryOptions): Promise<boolean> {
    const client = options?.client || this.pool;
    const result = await client.query(
      `DELETE FROM ${this.tableName} WHERE org_id = $1 AND id = $2`,
      [orgId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Soft delete within org scope
   */
  async softDeleteInOrg(orgId: string, id: string, options?: QueryOptions): Promise<boolean> {
    const client = options?.client || this.pool;
    const result = await client.query(
      `UPDATE ${this.tableName} SET is_active = false, updated_at = NOW() WHERE org_id = $1 AND id = $2`,
      [orgId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Count within org scope
   */
  async countInOrg(orgId: string, criteria?: Partial<T>, options?: QueryOptions): Promise<number> {
    const scopedCriteria = { ...criteria, orgId } as Partial<T>;
    return this.count(scopedCriteria, options);
  }
}
