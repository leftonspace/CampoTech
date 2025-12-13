/**
 * Audit Module
 * ============
 *
 * Tamper-evident audit logging with hash chain integrity.
 * Provides complete audit trail for compliance and forensics.
 */

import * as crypto from 'crypto';
import { Pool } from 'pg';
import { Router, Request, Response, NextFunction } from 'express';
import { AuditLog, PaginatedResult, PaginationParams, DateRange } from '../../shared/types/domain.types';
import { objectToCamel } from '../../shared/repositories/base.repository';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AuditAction =
  | 'create' | 'update' | 'delete' | 'soft_delete' | 'restore'
  | 'login' | 'logout' | 'login_failed' | 'password_change' | 'password_reset'
  | 'permission_grant' | 'permission_revoke' | 'role_change'
  | 'view' | 'export' | 'import'
  | 'state_change' | 'approval' | 'rejection'
  | 'payment' | 'refund' | 'invoice_issue' | 'invoice_void'
  | 'config_change' | 'integration_connect' | 'integration_disconnect';

export type AuditEntityType =
  | 'user' | 'organization' | 'customer' | 'job' | 'invoice' | 'payment'
  | 'pricebook_item' | 'pricebook_category' | 'afip_config' | 'system';

export interface CreateAuditLogDTO {
  orgId?: string;
  userId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditFilters {
  userId?: string;
  action?: AuditAction | AuditAction[];
  entityType?: AuditEntityType | AuditEntityType[];
  entityId?: string;
  dateRange?: DateRange;
}

export interface AuditIntegrityResult {
  valid: boolean;
  totalRecords: number;
  checkedRecords: number;
  firstInvalidRecord?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HASH CHAIN UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get HMAC secret for audit hash chain
 * SECURITY: Must be set in production to prevent hash recalculation attacks
 */
function getAuditHmacSecret(): string {
  const secret = process.env.AUDIT_HMAC_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUDIT_HMAC_SECRET environment variable is required in production');
    }
    console.warn('WARNING: AUDIT_HMAC_SECRET not set. Using fallback for development only.');
    return 'DEVELOPMENT_ONLY_AUDIT_SECRET_DO_NOT_USE_IN_PRODUCTION';
  }
  return secret;
}

/**
 * Calculate HMAC hash for an audit entry
 * Creates tamper-evident chain by including previous hash
 * Uses HMAC-SHA256 for stronger security (prevents hash recalculation attacks)
 */
export function calculateAuditHash(entry: {
  id: string;
  orgId?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
  createdAt: Date;
  previousHash: string;
}): string {
  const data = JSON.stringify({
    id: entry.id,
    orgId: entry.orgId,
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    metadata: entry.metadata,
    createdAt: entry.createdAt.toISOString(),
    previousHash: entry.previousHash,
  });

  // SECURITY: Use HMAC-SHA256 with server secret for tamper protection
  return crypto.createHmac('sha256', getAuditHmacSecret()).update(data).digest('hex');
}

/**
 * Verify integrity of a single audit entry
 */
export function verifyAuditEntry(entry: AuditLog): boolean {
  const calculatedHash = calculateAuditHash({
    id: entry.id,
    orgId: entry.orgId,
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    metadata: entry.metadata,
    createdAt: entry.createdAt,
    previousHash: entry.previousHash,
  });

  return calculatedHash === entry.hash;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class AuditRepository {
  constructor(private pool: Pool) {}

  async create(data: CreateAuditLogDTO): Promise<AuditLog> {
    // Get previous hash for chain integrity
    const previousResult = await this.pool.query(
      data.orgId
        ? `SELECT hash FROM audit_logs WHERE org_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`
        : `SELECT hash FROM audit_logs WHERE org_id IS NULL ORDER BY created_at DESC, id DESC LIMIT 1`,
      data.orgId ? [data.orgId] : []
    );

    const previousHash = previousResult.rows[0]?.hash || 'GENESIS';

    // Generate ID and timestamp
    const id = crypto.randomUUID();
    const createdAt = new Date();

    // Calculate hash
    const hash = calculateAuditHash({
      id,
      orgId: data.orgId,
      userId: data.userId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      oldValue: data.oldValue,
      newValue: data.newValue,
      metadata: data.metadata,
      createdAt,
      previousHash,
    });

    // Insert with hash
    const result = await this.pool.query(
      `INSERT INTO audit_logs (
        id, org_id, user_id, action, entity_type, entity_id,
        old_value, new_value, metadata, ip_address, user_agent,
        previous_hash, hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        id, data.orgId, data.userId, data.action, data.entityType, data.entityId,
        data.oldValue ? JSON.stringify(data.oldValue) : null,
        data.newValue ? JSON.stringify(data.newValue) : null,
        data.metadata ? JSON.stringify(data.metadata) : null,
        data.ipAddress, data.userAgent,
        previousHash, hash, createdAt
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<AuditLog | null> {
    const result = await this.pool.query(
      `SELECT * FROM audit_logs WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByOrg(orgId: string, filters: AuditFilters, pagination: PaginationParams): Promise<PaginatedResult<AuditLog>> {
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 50, 200);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE org_id = $1';
    const values: any[] = [orgId];
    let paramIndex = 2;

    if (filters.userId) {
      whereClause += ` AND user_id = $${paramIndex}`;
      values.push(filters.userId);
      paramIndex++;
    }

    if (filters.action) {
      if (Array.isArray(filters.action)) {
        whereClause += ` AND action = ANY($${paramIndex})`;
        values.push(filters.action);
      } else {
        whereClause += ` AND action = $${paramIndex}`;
        values.push(filters.action);
      }
      paramIndex++;
    }

    if (filters.entityType) {
      if (Array.isArray(filters.entityType)) {
        whereClause += ` AND entity_type = ANY($${paramIndex})`;
        values.push(filters.entityType);
      } else {
        whereClause += ` AND entity_type = $${paramIndex}`;
        values.push(filters.entityType);
      }
      paramIndex++;
    }

    if (filters.entityId) {
      whereClause += ` AND entity_id = $${paramIndex}`;
      values.push(filters.entityId);
      paramIndex++;
    }

    if (filters.dateRange?.start) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      values.push(filters.dateRange.start);
      paramIndex++;
    }

    if (filters.dateRange?.end) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      values.push(filters.dateRange.end);
      paramIndex++;
    }

    const countResult = await this.pool.query(`SELECT COUNT(*) FROM audit_logs ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT * FROM audit_logs ${whereClause}
       ORDER BY created_at DESC, id DESC
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

  async findByEntity(orgId: string, entityType: AuditEntityType, entityId: string): Promise<AuditLog[]> {
    const result = await this.pool.query(
      `SELECT * FROM audit_logs
       WHERE org_id = $1 AND entity_type = $2 AND entity_id = $3
       ORDER BY created_at DESC`,
      [orgId, entityType, entityId]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async findByUser(orgId: string, userId: string, limit: number = 100): Promise<AuditLog[]> {
    const result = await this.pool.query(
      `SELECT * FROM audit_logs
       WHERE org_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [orgId, userId, limit]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async verifyChainIntegrity(orgId: string, startDate?: Date, endDate?: Date): Promise<AuditIntegrityResult> {
    let whereClause = 'WHERE org_id = $1';
    const values: any[] = [orgId];
    let paramIndex = 2;

    if (startDate) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      values.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      values.push(endDate);
      paramIndex++;
    }

    // Get all records in order
    const result = await this.pool.query(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at ASC, id ASC`,
      values
    );

    const totalRecords = result.rows.length;
    let checkedRecords = 0;
    let expectedPreviousHash = 'GENESIS';

    for (const row of result.rows) {
      const entry = this.mapRow(row);

      // Check chain linkage
      if (entry.previousHash !== expectedPreviousHash) {
        return {
          valid: false,
          totalRecords,
          checkedRecords,
          firstInvalidRecord: entry.id,
          error: `Chain break: expected previous hash ${expectedPreviousHash}, got ${entry.previousHash}`,
        };
      }

      // Verify entry hash
      if (!verifyAuditEntry(entry)) {
        return {
          valid: false,
          totalRecords,
          checkedRecords,
          firstInvalidRecord: entry.id,
          error: 'Hash mismatch - record may have been tampered with',
        };
      }

      expectedPreviousHash = entry.hash;
      checkedRecords++;
    }

    return {
      valid: true,
      totalRecords,
      checkedRecords,
    };
  }

  async getStatistics(orgId: string, dateRange?: DateRange): Promise<{
    totalLogs: number;
    byAction: Record<string, number>;
    byEntityType: Record<string, number>;
    byUser: Record<string, number>;
  }> {
    let whereClause = 'WHERE org_id = $1';
    const values: any[] = [orgId];
    let paramIndex = 2;

    if (dateRange?.start) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      values.push(dateRange.start);
      paramIndex++;
    }

    if (dateRange?.end) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      values.push(dateRange.end);
      paramIndex++;
    }

    const [totalResult, actionResult, entityResult, userResult] = await Promise.all([
      this.pool.query(`SELECT COUNT(*) FROM audit_logs ${whereClause}`, values),
      this.pool.query(`SELECT action, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY action`, values),
      this.pool.query(`SELECT entity_type, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY entity_type`, values),
      this.pool.query(
        `SELECT user_id, COUNT(*) as count FROM audit_logs ${whereClause} AND user_id IS NOT NULL GROUP BY user_id LIMIT 20`,
        values
      ),
    ]);

    const byAction: Record<string, number> = {};
    for (const row of actionResult.rows) {
      byAction[row.action] = parseInt(row.count, 10);
    }

    const byEntityType: Record<string, number> = {};
    for (const row of entityResult.rows) {
      byEntityType[row.entity_type] = parseInt(row.count, 10);
    }

    const byUser: Record<string, number> = {};
    for (const row of userResult.rows) {
      byUser[row.user_id] = parseInt(row.count, 10);
    }

    return {
      totalLogs: parseInt(totalResult.rows[0].count, 10),
      byAction,
      byEntityType,
      byUser,
    };
  }

  private mapRow(row: Record<string, any>): AuditLog {
    const mapped = objectToCamel<AuditLog>(row);
    if (typeof mapped.oldValue === 'string') {
      mapped.oldValue = JSON.parse(mapped.oldValue);
    }
    if (typeof mapped.newValue === 'string') {
      mapped.newValue = JSON.parse(mapped.newValue);
    }
    if (typeof mapped.metadata === 'string') {
      mapped.metadata = JSON.parse(mapped.metadata);
    }
    return mapped;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class AuditService {
  private repo: AuditRepository;

  constructor(pool: Pool) {
    this.repo = new AuditRepository(pool);
  }

  /**
   * Log an audit event
   */
  async log(data: CreateAuditLogDTO): Promise<AuditLog> {
    return this.repo.create(data);
  }

  /**
   * Log a CRUD operation with automatic diff
   */
  async logCrud(
    action: 'create' | 'update' | 'delete' | 'soft_delete',
    entityType: AuditEntityType,
    entityId: string,
    options: {
      orgId: string;
      userId?: string;
      oldValue?: Record<string, any>;
      newValue?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<AuditLog> {
    return this.log({
      orgId: options.orgId,
      userId: options.userId,
      action,
      entityType,
      entityId,
      oldValue: options.oldValue,
      newValue: options.newValue,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    });
  }

  /**
   * Log authentication event
   */
  async logAuth(
    action: 'login' | 'logout' | 'login_failed' | 'password_change' | 'password_reset',
    options: {
      orgId?: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<AuditLog> {
    return this.log({
      orgId: options.orgId,
      userId: options.userId,
      action,
      entityType: 'user',
      entityId: options.userId,
      metadata: options.metadata,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    });
  }

  /**
   * Log state change (job, invoice, payment status transitions)
   */
  async logStateChange(
    entityType: AuditEntityType,
    entityId: string,
    options: {
      orgId: string;
      userId?: string;
      fromState: string;
      toState: string;
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<AuditLog> {
    return this.log({
      orgId: options.orgId,
      userId: options.userId,
      action: 'state_change',
      entityType,
      entityId,
      metadata: {
        fromState: options.fromState,
        toState: options.toState,
        reason: options.reason,
      },
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    });
  }

  /**
   * Get audit log by ID
   */
  async getById(id: string): Promise<AuditLog> {
    const log = await this.repo.findById(id);
    if (!log) throw new Error('Audit log not found');
    return log;
  }

  /**
   * List audit logs for organization
   */
  async list(orgId: string, filters: AuditFilters, pagination: PaginationParams): Promise<PaginatedResult<AuditLog>> {
    return this.repo.findByOrg(orgId, filters, pagination);
  }

  /**
   * Get audit history for specific entity
   */
  async getEntityHistory(orgId: string, entityType: AuditEntityType, entityId: string): Promise<AuditLog[]> {
    return this.repo.findByEntity(orgId, entityType, entityId);
  }

  /**
   * Get audit history for user
   */
  async getUserActivity(orgId: string, userId: string, limit?: number): Promise<AuditLog[]> {
    return this.repo.findByUser(orgId, userId, limit);
  }

  /**
   * Verify integrity of audit chain
   */
  async verifyIntegrity(orgId: string, startDate?: Date, endDate?: Date): Promise<AuditIntegrityResult> {
    return this.repo.verifyChainIntegrity(orgId, startDate, endDate);
  }

  /**
   * Get audit statistics
   */
  async getStatistics(orgId: string, dateRange?: DateRange): Promise<{
    totalLogs: number;
    byAction: Record<string, number>;
    byEntityType: Record<string, number>;
    byUser: Record<string, number>;
  }> {
    return this.repo.getStatistics(orgId, dateRange);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create audit logging middleware
 * Automatically logs API requests
 */
export function createAuditMiddleware(auditService: AuditService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalEnd = res.end;
    const startTime = Date.now();

    // Override response.end to capture response
    res.end = function(this: Response, ...args: any[]): Response {
      const duration = Date.now() - startTime;

      // Log significant operations
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const orgId = (req as any).auth?.orgId;
        const userId = (req as any).auth?.userId;

        if (orgId) {
          // Fire and forget - don't block response
          auditService.log({
            orgId,
            userId,
            action: req.method === 'DELETE' ? 'delete' : req.method === 'POST' ? 'create' : 'update',
            entityType: extractEntityType(req.path),
            entityId: extractEntityId(req.path),
            metadata: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              duration,
            },
            ipAddress: getClientIP(req),
            userAgent: req.get('user-agent'),
          }).catch(() => {});
        }
      }

      return originalEnd.apply(this, args);
    };

    next();
  };
}

function extractEntityType(path: string): AuditEntityType {
  const segments = path.split('/').filter(Boolean);
  const typeMap: Record<string, AuditEntityType> = {
    users: 'user',
    organizations: 'organization',
    customers: 'customer',
    jobs: 'job',
    invoices: 'invoice',
    payments: 'payment',
    pricebook: 'pricebook_item',
  };

  for (const segment of segments) {
    if (typeMap[segment]) return typeMap[segment];
  }

  return 'system';
}

function extractEntityId(path: string): string | undefined {
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = path.match(uuidRegex);
  return match ? match[0] : undefined;
}

function getClientIP(req: Request): string {
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createAuditRoutes(pool: Pool): Router {
  const router = Router();
  const service = new AuditService(pool);

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const filters: AuditFilters = {};
      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.action) filters.action = req.query.action as AuditAction;
      if (req.query.entityType) filters.entityType = req.query.entityType as AuditEntityType;
      if (req.query.entityId) filters.entityId = req.query.entityId as string;

      if (req.query.startDate || req.query.endDate) {
        filters.dateRange = {};
        if (req.query.startDate) filters.dateRange.start = new Date(req.query.startDate as string);
        if (req.query.endDate) filters.dateRange.end = new Date(req.query.endDate as string);
      }

      const result = await service.list(orgId, filters, {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      });
      res.json({ data: result.data, meta: { total: result.total, page: result.page } });
    } catch (error) { next(error); }
  });

  router.get('/statistics', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      let dateRange: DateRange | undefined;
      if (req.query.startDate || req.query.endDate) {
        dateRange = {};
        if (req.query.startDate) dateRange.start = new Date(req.query.startDate as string);
        if (req.query.endDate) dateRange.end = new Date(req.query.endDate as string);
      }

      const stats = await service.getStatistics(orgId, dateRange);
      res.json({ data: stats });
    } catch (error) { next(error); }
  });

  router.get('/verify', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const result = await service.verifyIntegrity(orgId, startDate, endDate);
      res.json({ data: result });
    } catch (error) { next(error); }
  });

  router.get('/entity/:entityType/:entityId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const logs = await service.getEntityHistory(
        orgId,
        req.params.entityType as AuditEntityType,
        req.params.entityId
      );
      res.json({ data: logs });
    } catch (error) { next(error); }
  });

  router.get('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await service.getUserActivity(orgId, req.params.userId, limit);
      res.json({ data: logs });
    } catch (error) { next(error); }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const log = await service.getById(req.params.id);
      res.json({ data: log });
    } catch (error) { next(error); }
  });

  return router;
}
