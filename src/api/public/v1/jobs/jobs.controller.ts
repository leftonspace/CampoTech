import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import {
  createJobSchema,
  updateJobSchema,
  listJobsSchema,
  assignJobSchema,
  scheduleJobSchema,
  startJobSchema,
  completeJobSchema,
  cancelJobSchema,
  addJobNoteSchema,
  batchUpdateJobsSchema,
  batchDeleteJobsSchema,
  CreateJobInput,
  UpdateJobInput,
  ListJobsInput,
} from './jobs.schema';
import { requireScopes, readScope, writeScope, deleteScope } from '../../middleware';
import { ApiRequestContext, CursorPaginationResult } from '../../public-api.types';
import { JobService } from '../../../../services/job.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface JobRow {
  id: string;
  org_id: string;
  customer_id: string;
  title: string;
  description: string | null;
  service_type: string;
  status: string;
  priority: string;
  scheduled_start: Date | null;
  scheduled_end: Date | null;
  estimated_duration_minutes: number | null;
  actual_start: Date | null;
  actual_end: Date | null;
  address: any;
  assigned_technician_id: string | null;
  line_items: any[] | null;
  subtotal: number;
  tax_total: number;
  total: number;
  tags: string[];
  metadata: any;
  notes: string | null;
  internal_notes: string | null;
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
// CONTROLLER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createJobsController(pool: Pool): Router {
  const router = Router();

  // ─────────────────────────────────────────────────────────────────────────────
  // LIST JOBS
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/',
    readScope('jobs'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = listJobsSchema.safeParse(req.query);

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
        const { limit = 20, cursor, sort_by = 'createdAt', sort_order = 'desc' } = params;

        const result = await JobService.listJobs(apiContext.orgId, {
          status: params.status as string,
          technicianId: params.technician_id,
          customerId: params.customer_id,
          // Map other filters if needed
        }, {
          page: 1, // Cursor pagination would be better but the current service uses page
          limit,
        });

        // Build response
        const data = result.items.map(formatJobResponse);

        const response: CursorPaginationResult<any> = {
          data,
          pagination: {
            has_more: result.pagination.totalPages > result.pagination.page,
            next_cursor: result.pagination.page < result.pagination.totalPages
              ? String(result.pagination.page + 1) // Simple next page cursor for now
              : undefined,
          },
        };

        res.json({
          success: true,
          ...response,
        });
      } catch (error) {
        console.error('[Jobs API] List error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to list jobs' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET SINGLE JOB
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/:id',
    readScope('jobs'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        const jobData = await JobService.getJobById(apiContext.orgId, id);

        if (!jobData) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Job not found' },
          });
        }

        res.json({ success: true, data: formatJobResponse(jobData) });
      } catch (error) {
        console.error('[Jobs API] Get error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to get job' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE JOB
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/',
    writeScope('jobs'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = createJobSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid job data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const data = parseResult.data;
        const job = await JobService.createJob(apiContext.orgId, apiContext.apiKeyId || apiContext.oauthClientId || 'api', {
          ...data,
          // Map snake_case to camelCase if needed, JobService handles some of this
        });

        res.status(201).json({ success: true, data: formatJobResponse(job) });
      } catch (error) {
        console.error('[Jobs API] Create error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to create job' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // UPDATE JOB
  // ─────────────────────────────────────────────────────────────────────────────

  router.put(
    '/:id',
    writeScope('jobs'),
    async (req: Request, res: Response) => {
      await handleUpdateJob(pool, req, res);
    }
  );

  router.patch(
    '/:id',
    writeScope('jobs'),
    async (req: Request, res: Response) => {
      await handleUpdateJob(pool, req, res);
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE JOB
  // ─────────────────────────────────────────────────────────────────────────────

  router.delete(
    '/:id',
    deleteScope('jobs'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        const result = await pool.query(
          'DELETE FROM jobs WHERE id = $1 AND org_id = $2 RETURNING id',
          [id, apiContext.orgId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Job not found' },
          });
        }

        res.json({ success: true, data: { id, deleted: true } });
      } catch (error) {
        console.error('[Jobs API] Delete error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to delete job' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // JOB ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  // Assign technician
  router.post(
    '/:id/assign',
    writeScope('jobs'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = assignJobSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid assignment data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { technician_id } = parseResult.data;
        const job = await JobService.assignJob(apiContext.orgId, id, technician_id);

        res.json({ success: true, data: formatJobResponse(job) });
      } catch (error) {
        console.error('[Jobs API] Assign error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to assign job' },
        });
      }
    }
  );

  // Schedule job
  router.post(
    '/:id/schedule',
    writeScope('jobs'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = scheduleJobSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid schedule data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { scheduled_start, scheduled_end } = parseResult.data;
        const job = await JobService.scheduleJob(apiContext.orgId, id, new Date(scheduled_start), {
          start: scheduled_start,
          end: scheduled_end
        });

        res.json({ success: true, data: formatJobResponse(job) });
      } catch (error) {
        console.error('[Jobs API] Schedule error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to schedule job' },
        });
      }
    }
  );

  // Start job
  router.post(
    '/:id/start',
    writeScope('jobs'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        const job = await JobService.startJob(apiContext.orgId, id);

        res.json({ success: true, data: formatJobResponse(job) });
      } catch (error) {
        console.error('[Jobs API] Start error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to start job' },
        });
      }
    }
  );

  // Complete job
  router.post(
    '/:id/complete',
    writeScope('jobs'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = completeJobSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid completion data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const data = parseResult.data;
        const job = await JobService.completeJob(apiContext.orgId, id, {
          notes: data.completion_notes,
          materials: data.line_items,
        });

        res.json({ success: true, data: formatJobResponse(job) });
      } catch (error) {
        console.error('[Jobs API] Complete error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to complete job' },
        });
      }
    }
  );

  // Cancel job
  router.post(
    '/:id/cancel',
    writeScope('jobs'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = cancelJobSchema.safeParse(req.body);

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
          `UPDATE jobs
           SET status = 'cancelled', notes = COALESCE(notes, '') || E'\\n\\nCancellation reason: ' || $1, updated_at = NOW()
           WHERE id = $2 AND org_id = $3 AND status NOT IN ('completed', 'cancelled')
           RETURNING *`,
          [reason, id, apiContext.orgId]
        );

        if (result.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_STATUS', message: 'Job cannot be cancelled in current status' },
          });
        }

        // Log action
        await pool.query(
          `INSERT INTO job_history (job_id, action, actor_type, actor_id, details)
           VALUES ($1, 'cancelled', 'api', $2, $3)`,
          [id, apiContext.apiKeyId || apiContext.oauthClientId, JSON.stringify({ reason })]
        );

        res.json({ success: true, data: formatJobResponse(result.rows[0]) });
      } catch (error) {
        console.error('[Jobs API] Cancel error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to cancel job' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // JOB STATUS TRANSITION
  // POST /:id/status
  // Generic status transition endpoint with validation
  // ─────────────────────────────────────────────────────────────────────────────
  router.post(
    '/:id/status',
    writeScope('jobs'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        const statusSchema = z.object({
          status: z.enum([
            'pending',
            'assigned',
            'scheduled',
            'en_route',
            'in_progress',
            'on_hold',
            'completed',
            'cancelled',
            'needs_revisit',
          ]),
          reason: z.string().max(500).optional(),
          notes: z.string().max(2000).optional(),
        });

        const parseResult = statusSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid status transition data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { status: newStatus, reason, notes } = parseResult.data;

        // Get current job status
        const currentJob = await pool.query(
          'SELECT id, status, assigned_technician_id FROM jobs WHERE id = $1 AND org_id = $2',
          [id, apiContext.orgId]
        );

        if (currentJob.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Job not found' },
          });
        }

        const currentStatus = currentJob.rows[0].status;

        // Define valid transitions
        const validTransitions: Record<string, string[]> = {
          pending: ['assigned', 'scheduled', 'cancelled'],
          assigned: ['pending', 'scheduled', 'en_route', 'cancelled'],
          scheduled: ['pending', 'assigned', 'en_route', 'in_progress', 'on_hold', 'cancelled'],
          en_route: ['scheduled', 'in_progress', 'on_hold', 'cancelled'],
          in_progress: ['on_hold', 'completed', 'needs_revisit', 'cancelled'],
          on_hold: ['scheduled', 'in_progress', 'cancelled'],
          completed: ['needs_revisit'], // Very limited - mostly final
          cancelled: [], // Final state
          needs_revisit: ['scheduled', 'assigned', 'cancelled'],
        };

        const allowedTransitions = validTransitions[currentStatus] || [];

        if (!allowedTransitions.includes(newStatus)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_TRANSITION',
              message: `Cannot transition from '${currentStatus}' to '${newStatus}'`,
              details: {
                currentStatus,
                requestedStatus: newStatus,
                allowedTransitions,
              },
            },
          });
        }

        // Build update query
        const updates: string[] = ['status = $1', 'updated_at = NOW()'];
        const values: any[] = [newStatus];
        let paramIndex = 2;

        // Handle specific status transitions
        if (newStatus === 'in_progress' && currentStatus !== 'on_hold') {
          updates.push(`actual_start = COALESCE(actual_start, NOW())`);
        }

        if (newStatus === 'completed') {
          updates.push(`actual_end = NOW()`);
        }

        if (notes) {
          updates.push(`notes = COALESCE(notes, '') || E'\\n\\n[Status: ${newStatus}] ' || $${paramIndex++}`);
          values.push(notes);
        }

        if (reason && ['cancelled', 'on_hold', 'needs_revisit'].includes(newStatus)) {
          updates.push(`internal_notes = COALESCE(internal_notes, '') || E'\\n\\n[${newStatus} reason] ' || $${paramIndex++}`);
          values.push(reason);
        }

        values.push(id, apiContext.orgId);

        const result = await pool.query(
          `UPDATE jobs
           SET ${updates.join(', ')}
           WHERE id = $${paramIndex++} AND org_id = $${paramIndex}
           RETURNING *`,
          values
        );

        // Log action
        await pool.query(
          `INSERT INTO job_history (job_id, action, actor_type, actor_id, details)
           VALUES ($1, 'status_changed', 'api', $2, $3)`,
          [
            id,
            apiContext.apiKeyId || apiContext.oauthClientId,
            JSON.stringify({ from: currentStatus, to: newStatus, reason }),
          ]
        );

        res.json({ success: true, data: formatJobResponse(result.rows[0]) });
      } catch (error) {
        console.error('[Jobs API] Status transition error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to update job status' },
        });
      }
    }
  );

  // Add note
  router.post(
    '/:id/notes',
    writeScope('jobs'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = addJobNoteSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid note data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { content, is_internal } = parseResult.data;
        const noteField = is_internal ? 'internal_notes' : 'notes';

        const result = await pool.query(
          `UPDATE jobs
           SET ${noteField} = COALESCE(${noteField}, '') || E'\\n\\n[' || NOW()::text || '] ' || $1, updated_at = NOW()
           WHERE id = $2 AND org_id = $3
           RETURNING *`,
          [content, id, apiContext.orgId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Job not found' },
          });
        }

        // Log action
        await pool.query(
          `INSERT INTO job_history (job_id, action, actor_type, actor_id, details)
           VALUES ($1, 'note_added', 'api', $2, $3)`,
          [id, apiContext.apiKeyId || apiContext.oauthClientId, JSON.stringify({ is_internal })]
        );

        res.json({ success: true, data: formatJobResponse(result.rows[0]) });
      } catch (error) {
        console.error('[Jobs API] Add note error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to add note' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // BATCH OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/batch-update',
    writeScope('jobs'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = batchUpdateJobsSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid batch update data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { job_ids, updates } = parseResult.data;

        const setClauses: string[] = ['updated_at = NOW()'];
        const values: any[] = [];
        let paramIndex = 1;

        if (updates.status !== undefined) {
          setClauses.push(`status = $${paramIndex++}`);
          values.push(updates.status);
        }

        if (updates.priority !== undefined) {
          setClauses.push(`priority = $${paramIndex++}`);
          values.push(updates.priority);
        }

        if (updates.assigned_technician_id !== undefined) {
          setClauses.push(`assigned_technician_id = $${paramIndex++}`);
          values.push(updates.assigned_technician_id);
        }

        if (updates.tags !== undefined) {
          setClauses.push(`tags = $${paramIndex++}`);
          values.push(updates.tags);
        }

        values.push(job_ids, apiContext.orgId);

        const result = await pool.query(
          `UPDATE jobs
           SET ${setClauses.join(', ')}
           WHERE id = ANY($${paramIndex++}) AND org_id = $${paramIndex}
           RETURNING id`,
          values
        );

        res.json({
          success: true,
          data: {
            updated_count: result.rowCount,
            updated_ids: result.rows.map((r: any) => r.id),
          },
        });
      } catch (error) {
        console.error('[Jobs API] Batch update error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to batch update jobs' },
        });
      }
    }
  );

  router.post(
    '/batch-delete',
    deleteScope('jobs'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = batchDeleteJobsSchema.safeParse(req.body);

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

        const { job_ids } = parseResult.data;

        const result = await pool.query(
          'DELETE FROM jobs WHERE id = ANY($1) AND org_id = $2 RETURNING id',
          [job_ids, apiContext.orgId]
        );

        res.json({
          success: true,
          data: {
            deleted_count: result.rowCount,
            deleted_ids: result.rows.map((r: any) => r.id),
          },
        });
      } catch (error) {
        console.error('[Jobs API] Batch delete error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to batch delete jobs' },
        });
      }
    }
  );

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function handleUpdateJob(pool: Pool, req: Request, res: Response): Promise<void> {
  try {
    const apiContext = (req as any).apiContext as ApiRequestContext;
    const { id } = req.params;
    const parseResult = updateJobSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid job data',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const data = parseResult.data;

    // Build dynamic update query
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      service_type: 'service_type',
      status: 'status',
      priority: 'priority',
      scheduled_start: 'scheduled_start',
      scheduled_end: 'scheduled_end',
      estimated_duration_minutes: 'estimated_duration_minutes',
      assigned_technician_id: 'assigned_technician_id',
      tags: 'tags',
      notes: 'notes',
      internal_notes: 'internal_notes',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (data[key as keyof UpdateJobInput] !== undefined) {
        setClauses.push(`${column} = $${paramIndex++}`);
        values.push(data[key as keyof UpdateJobInput]);
      }
    }

    if (data.address !== undefined) {
      setClauses.push(`address = $${paramIndex++}`);
      values.push(JSON.stringify(data.address));
    }

    if (data.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(data.metadata));
    }

    if (data.line_items !== undefined) {
      let subtotal = 0;
      let taxTotal = 0;
      for (const item of data.line_items) {
        const itemTotal = item.quantity * item.unit_price;
        const discount = item.discount || 0;
        const afterDiscount = itemTotal - discount;
        const tax = afterDiscount * ((item.tax_rate || 0) / 100);
        subtotal += afterDiscount;
        taxTotal += tax;
      }
      setClauses.push(`line_items = $${paramIndex++}`);
      values.push(JSON.stringify(data.line_items));
      setClauses.push(`subtotal = $${paramIndex++}`);
      values.push(subtotal);
      setClauses.push(`tax_total = $${paramIndex++}`);
      values.push(taxTotal);
      setClauses.push(`total = $${paramIndex++}`);
      values.push(subtotal + taxTotal);
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
      UPDATE jobs
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex++} AND org_id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job not found' },
      });
      return;
    }

    // Log update
    await pool.query(
      `INSERT INTO job_history (job_id, action, actor_type, actor_id, details)
       VALUES ($1, 'updated', 'api', $2, $3)`,
      [id, apiContext.apiKeyId || apiContext.oauthClientId, JSON.stringify({ fields: Object.keys(data) })]
    );

    res.json({ success: true, data: formatJobResponse(result.rows[0]) });
  } catch (error) {
    console.error('[Jobs API] Update error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update job' },
    });
  }
}

function formatJobResponse(job: any): any {
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    customerId: job.customerId,
    serviceType: job.serviceType,
    description: job.description,
    status: job.status,
    urgency: job.urgency,
    scheduledDate: job.scheduledDate?.toISOString() || null,
    scheduledTimeSlot: job.scheduledTimeSlot,
    technicianId: job.technicianId,
    durationType: job.durationType,
    visitCount: job.visitCount,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    customer: job.customer ? {
      id: job.customer.id,
      name: job.customer.name,
      phone: job.customer.phone,
      email: job.customer.email,
    } : undefined,
    technician: job.technician ? {
      id: job.technician.id,
      name: job.technician.name,
    } : undefined,
    assignments: job.assignments?.map((a: any) => ({
      technicianId: a.technicianId,
      technician: a.technician,
    })),
    visits: job.visits?.map((v: any) => ({
      visitNumber: v.visitNumber,
      scheduledDate: v.scheduledDate?.toISOString(),
      status: v.status,
      technician: v.technician,
    })),
  };
}
