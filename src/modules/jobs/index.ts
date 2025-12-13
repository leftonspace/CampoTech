/**
 * Job Module
 * ==========
 *
 * Job management with state machine for status transitions.
 */

import { Pool } from 'pg';
import { Router, Request, Response, NextFunction } from 'express';
import { OrgScopedRepository, objectToCamel, objectToSnake } from '../../shared/repositories/base.repository';
import { Job, JobStatus, JobLineItem, PaginatedResult, PaginationParams, DateRange } from '../../shared/types/domain.types';
import { createJobStateMachine, JobTransitionContext } from '../../shared/utils/state-machine';
import { startOfDay, endOfDay } from '../../shared/utils/validation';
import { createTrackingSession, completeSession, cancelSession } from '../tracking/tracking.service';
import { log } from '../../lib/logging/logger';
import { useMaterial, getJobMaterials } from '../inventory';
import { emitWebhookSafe } from '../../shared/services/webhook-bridge';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateJobDTO {
  customerId: string;
  assignedTo?: string;
  scheduledAt?: Date;
  description: string;
  address: string;
  city?: string;
  province?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  estimatedDuration?: number;
  lineItems?: CreateJobLineItemDTO[];
}

export interface CreateJobLineItemDTO {
  priceBookItemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface UpdateJobDTO {
  assignedTo?: string;
  scheduledAt?: Date;
  description?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  estimatedDuration?: number;
  lineItems?: CreateJobLineItemDTO[];
}

export interface TransitionJobDTO {
  status: JobStatus;
  reason?: string;
  photos?: string[];
  signature?: string;
  notes?: string;
}

export interface JobFilters {
  status?: JobStatus | JobStatus[];
  assignedTo?: string;
  customerId?: string;
  dateRange?: DateRange;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class JobRepository extends OrgScopedRepository<Job> {
  constructor(pool: Pool) {
    super(pool, 'jobs');
  }

  async findFiltered(
    orgId: string,
    filters: JobFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<Job>> {
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

    if (filters.assignedTo) {
      whereClause += ` AND assigned_to = $${paramIndex}`;
      values.push(filters.assignedTo);
      paramIndex++;
    }

    if (filters.customerId) {
      whereClause += ` AND customer_id = $${paramIndex}`;
      values.push(filters.customerId);
      paramIndex++;
    }

    if (filters.dateRange?.from) {
      whereClause += ` AND scheduled_at >= $${paramIndex}`;
      values.push(startOfDay(filters.dateRange.from));
      paramIndex++;
    }

    if (filters.dateRange?.to) {
      whereClause += ` AND scheduled_at <= $${paramIndex}`;
      values.push(endOfDay(filters.dateRange.to));
      paramIndex++;
    }

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM jobs ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const sortField = pagination.sortBy || 'scheduled_at';
    const sortOrder = pagination.sortOrder || 'asc';

    const result = await this.pool.query(
      `SELECT * FROM jobs ${whereClause}
       ORDER BY ${sortField} ${sortOrder.toUpperCase()} NULLS LAST
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

  async findTodayForTechnician(orgId: string, technicianId: string): Promise<Job[]> {
    const today = new Date();
    const result = await this.pool.query(
      `SELECT * FROM jobs
       WHERE org_id = $1
         AND assigned_to = $2
         AND scheduled_at >= $3
         AND scheduled_at < $4
         AND status NOT IN ('completed', 'cancelled')
       ORDER BY scheduled_at ASC`,
      [orgId, technicianId, startOfDay(today), endOfDay(today)]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async updateStatus(
    id: string,
    status: JobStatus,
    extras?: { completedAt?: Date; cancelledAt?: Date; cancellationReason?: string; photos?: string[]; signature?: string; completionNotes?: string }
  ): Promise<Job | null> {
    const updates: string[] = ['status = $2', 'updated_at = NOW()'];
    const values: any[] = [id, status];
    let paramIndex = 3;

    if (extras?.completedAt) {
      updates.push(`completed_at = $${paramIndex}`);
      values.push(extras.completedAt);
      paramIndex++;
    }

    if (extras?.cancelledAt) {
      updates.push(`cancelled_at = $${paramIndex}`);
      values.push(extras.cancelledAt);
      paramIndex++;
    }

    if (extras?.cancellationReason) {
      updates.push(`cancellation_reason = $${paramIndex}`);
      values.push(extras.cancellationReason);
      paramIndex++;
    }

    if (extras?.photos) {
      updates.push(`photos = $${paramIndex}`);
      values.push(JSON.stringify(extras.photos));
      paramIndex++;
    }

    if (extras?.signature) {
      updates.push(`signature = $${paramIndex}`);
      values.push(extras.signature);
      paramIndex++;
    }

    if (extras?.completionNotes) {
      updates.push(`completion_notes = $${paramIndex}`);
      values.push(extras.completionNotes);
      paramIndex++;
    }

    const result = await this.pool.query(
      `UPDATE jobs SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  protected mapRow(row: Record<string, any>): Job {
    const mapped = objectToCamel<Job>(row);
    if (typeof mapped.lineItems === 'string') {
      mapped.lineItems = JSON.parse(mapped.lineItems);
    }
    if (typeof mapped.photos === 'string') {
      mapped.photos = JSON.parse(mapped.photos);
    }
    return mapped;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class JobService {
  private repo: JobRepository;
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
    this.repo = new JobRepository(pool);
  }

  async getById(orgId: string, id: string): Promise<Job> {
    const job = await this.repo.findByIdInOrg(orgId, id);
    if (!job) throw new Error('Job not found');
    return job;
  }

  async list(orgId: string, filters: JobFilters, pagination: PaginationParams): Promise<PaginatedResult<Job>> {
    return this.repo.findFiltered(orgId, filters, pagination);
  }

  async getTodayForTechnician(orgId: string, technicianId: string): Promise<Job[]> {
    return this.repo.findTodayForTechnician(orgId, technicianId);
  }

  async create(orgId: string, data: CreateJobDTO): Promise<Job> {
    // Calculate totals from line items
    let subtotal = 0;
    let taxAmount = 0;

    const lineItems: JobLineItem[] = (data.lineItems || []).map(item => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemTax = Math.round(itemSubtotal * item.taxRate * 100) / 100;
      const itemTotal = itemSubtotal + itemTax;

      subtotal += itemSubtotal;
      taxAmount += itemTax;

      return {
        id: crypto.randomUUID(),
        priceBookItemId: item.priceBookItemId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        total: itemTotal,
      };
    });

    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    const job = await this.repo.createInOrg(orgId, {
      customerId: data.customerId,
      assignedTo: data.assignedTo,
      scheduledAt: data.scheduledAt,
      status: data.scheduledAt && data.assignedTo ? 'scheduled' : 'pending',
      description: data.description,
      address: data.address,
      city: data.city,
      province: data.province,
      postalCode: data.postalCode,
      latitude: data.latitude,
      longitude: data.longitude,
      estimatedDuration: data.estimatedDuration,
      photos: [],
      lineItems,
      subtotal,
      taxAmount,
      total,
    });

    // Emit job.created webhook event
    emitWebhookSafe(orgId, 'job.created', {
      job: {
        id: job.id,
        customer_id: job.customerId,
        assigned_to: job.assignedTo,
        status: job.status,
        description: job.description,
        address: job.address,
        scheduled_at: job.scheduledAt,
        total: job.total,
        created_at: job.createdAt,
      },
    }, { actor_type: 'system' });

    return job;
  }

  async update(orgId: string, id: string, data: UpdateJobDTO): Promise<Job> {
    const job = await this.getById(orgId, id);

    // Can only update draft or scheduled jobs
    if (!['pending', 'scheduled'].includes(job.status)) {
      throw new Error('Can only update pending or scheduled jobs');
    }

    const updateData: Partial<Job> = { ...data };

    // Recalculate totals if line items changed
    if (data.lineItems) {
      let subtotal = 0;
      let taxAmount = 0;

      updateData.lineItems = data.lineItems.map(item => {
        const itemSubtotal = item.quantity * item.unitPrice;
        const itemTax = Math.round(itemSubtotal * item.taxRate * 100) / 100;
        const itemTotal = itemSubtotal + itemTax;

        subtotal += itemSubtotal;
        taxAmount += itemTax;

        return {
          id: crypto.randomUUID(),
          priceBookItemId: item.priceBookItemId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          total: itemTotal,
        };
      });

      updateData.subtotal = subtotal;
      updateData.taxAmount = taxAmount;
      updateData.total = Math.round((subtotal + taxAmount) * 100) / 100;
    }

    // Auto-transition to scheduled if now has assignment and schedule
    const wasScheduled = job.status === 'pending' && (data.assignedTo || job.assignedTo) && (data.scheduledAt || job.scheduledAt);
    if (wasScheduled) {
      updateData.status = 'scheduled';
    }

    const updated = await this.repo.updateInOrg(orgId, id, updateData);
    if (!updated) throw new Error('Failed to update job');

    // Emit job.updated webhook event
    emitWebhookSafe(orgId, 'job.updated', {
      job: {
        id: updated.id,
        customer_id: updated.customerId,
        assigned_to: updated.assignedTo,
        status: updated.status,
        description: updated.description,
        address: updated.address,
        scheduled_at: updated.scheduledAt,
        total: updated.total,
        updated_at: updated.updatedAt,
      },
      changes: Object.keys(data),
    }, { actor_type: 'system' });

    // Emit job.scheduled if auto-transitioned
    if (wasScheduled) {
      emitWebhookSafe(orgId, 'job.scheduled', {
        job: {
          id: updated.id,
          customer_id: updated.customerId,
          assigned_to: updated.assignedTo,
          scheduled_at: updated.scheduledAt,
        },
      }, { actor_type: 'system' });
    }

    // Emit job.assigned if technician was assigned
    if (data.assignedTo && data.assignedTo !== job.assignedTo) {
      emitWebhookSafe(orgId, 'job.assigned', {
        job: { id: updated.id, customer_id: updated.customerId },
        technician_id: data.assignedTo,
        previous_technician_id: job.assignedTo || null,
      }, { actor_type: 'system' });
    }

    return updated;
  }

  async transition(orgId: string, id: string, userId: string, data: TransitionJobDTO): Promise<Job> {
    const job = await this.getById(orgId, id);

    // Create state machine from current state
    const sm = createJobStateMachine(job.status);

    // Check if transition is valid
    if (!sm.canTransition(data.status)) {
      throw new Error(`Invalid transition from ${job.status} to ${data.status}`);
    }

    // Build context
    const context: JobTransitionContext = {
      job,
      userId,
      reason: data.reason,
      photos: data.photos,
      signature: data.signature,
      notes: data.notes,
    };

    // Execute transition
    const result = await sm.transition(data.status, context);
    if (!result.success) {
      throw new Error(result.error || 'Transition failed');
    }

    // Update in database
    const extras: any = {};

    if (data.status === 'completed') {
      extras.completedAt = new Date();
      extras.photos = data.photos;
      extras.signature = data.signature;
      extras.completionNotes = data.notes;

      // Deduct materials from inventory
      try {
        const materials = await getJobMaterials(orgId, id);
        for (const material of materials) {
          if (material.estimatedQty > material.usedQty) {
            // Auto-use remaining estimated quantity
            await useMaterial(orgId, {
              jobMaterialId: material.id,
              usedQty: material.estimatedQty - material.usedQty,
              fromVehicle: material.sourceType === 'VEHICLE',
              technicianId: job.assignedTo || undefined,
            });
          }
        }
      } catch (err) {
        log.error('Failed to deduct job materials', { jobId: id, error: err });
        // Non-blocking: job still completes even if inventory deduction fails
      }
    }

    if (data.status === 'cancelled') {
      extras.cancelledAt = new Date();
      extras.cancellationReason = data.reason;
    }

    const updated = await this.repo.updateStatus(id, data.status, extras);
    if (!updated) throw new Error('Failed to update job status');

    // Handle tracking session based on status transition
    try {
      if (data.status === 'en_camino' && job.assignedTo) {
        // Auto-start tracking session when technician marks "en route"
        const trackingResult = await createTrackingSession(id, job.assignedTo, orgId);
        log.info('Tracking session auto-started', {
          jobId: id,
          sessionId: trackingResult.sessionId,
          technicianId: job.assignedTo,
        });
      } else if (data.status === 'completed') {
        // Complete tracking session when job is completed
        await completeSession(id);
        log.info('Tracking session completed', { jobId: id });
      } else if (data.status === 'cancelled') {
        // Cancel tracking session when job is cancelled
        await cancelSession(id);
        log.info('Tracking session cancelled', { jobId: id });
      }
    } catch (trackingError) {
      // Log but don't fail the job transition if tracking fails
      log.error('Tracking session error (non-blocking)', {
        jobId: id,
        status: data.status,
        error: trackingError instanceof Error ? trackingError.message : 'Unknown',
      });
    }

    // Emit webhook event for status change
    const statusEventMap: Record<string, string> = {
      'scheduled': 'job.scheduled',
      'en_camino': 'job.started',
      'in_progress': 'job.started',
      'completed': 'job.completed',
      'cancelled': 'job.cancelled',
    };
    const eventType = statusEventMap[data.status] || 'job.updated';

    const webhookData: Record<string, any> = {
      job: {
        id: updated.id,
        customer_id: updated.customerId,
        assigned_to: updated.assignedTo,
        status: updated.status,
        previous_status: job.status,
        updated_at: updated.updatedAt,
      },
    };

    if (data.status === 'cancelled') {
      webhookData.reason = data.reason;
    }

    emitWebhookSafe(orgId, eventType, webhookData, {
      actor_type: 'user',
      actor_id: userId
    });

    return updated;
  }

  async cancel(orgId: string, id: string, userId: string, reason: string): Promise<Job> {
    return this.transition(orgId, id, userId, { status: 'cancelled', reason });
  }

  async complete(
    orgId: string,
    id: string,
    userId: string,
    data: { photos?: string[]; signature?: string; notes?: string }
  ): Promise<Job> {
    return this.transition(orgId, id, userId, { status: 'completed', ...data });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createJobRoutes(pool: Pool): Router {
  const router = Router();
  const service = new JobService(pool);

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const filters: JobFilters = {};
      if (req.query.status) {
        filters.status = Array.isArray(req.query.status)
          ? req.query.status as JobStatus[]
          : req.query.status as JobStatus;
      }
      if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo as string;
      if (req.query.customerId) filters.customerId = req.query.customerId as string;
      if (req.query.from || req.query.to) {
        filters.dateRange = {
          from: req.query.from ? new Date(req.query.from as string) : undefined,
          to: req.query.to ? new Date(req.query.to as string) : undefined,
        };
      }

      const result = await service.list(orgId, filters, {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      });
      res.json({ data: result.data, meta: { total: result.total, page: result.page, totalPages: result.totalPages } });
    } catch (error) { next(error); }
  });

  router.get('/today', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      const userId = req.auth?.userId;
      if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

      const jobs = await service.getTodayForTechnician(orgId, userId);
      res.json({ data: jobs });
    } catch (error) { next(error); }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const job = await service.getById(orgId, req.params.id);
      res.json({ data: job });
    } catch (error) { next(error); }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const job = await service.create(orgId, req.body);
      res.status(201).json({ data: job });
    } catch (error) { next(error); }
  });

  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const job = await service.update(orgId, req.params.id, req.body);
      res.json({ data: job });
    } catch (error) { next(error); }
  });

  router.post('/:id/transition', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      const userId = req.auth?.userId;
      if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

      const job = await service.transition(orgId, req.params.id, userId, req.body);
      res.json({ data: job });
    } catch (error) { next(error); }
  });

  router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      const userId = req.auth?.userId;
      if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

      const job = await service.complete(orgId, req.params.id, userId, req.body);
      res.json({ data: job });
    } catch (error) { next(error); }
  });

  router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      const userId = req.auth?.userId;
      if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

      const job = await service.cancel(orgId, req.params.id, userId, req.body.reason);
      res.json({ data: job });
    } catch (error) { next(error); }
  });

  return router;
}
