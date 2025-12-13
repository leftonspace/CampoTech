/**
 * Jobs Controller
 * ================
 *
 * Public API controller for job/work order management.
 * Provides full CRUD operations plus job lifecycle actions.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
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
        const { limit, cursor, sort_by, sort_order, include } = params;

        // Build query
        const conditions: string[] = ['j.org_id = $1'];
        const values: any[] = [apiContext.orgId];
        let paramIndex = 2;

        // Filter conditions
        if (params.customer_id) {
          conditions.push(`j.customer_id = $${paramIndex++}`);
          values.push(params.customer_id);
        }

        if (params.technician_id) {
          conditions.push(`j.assigned_technician_id = $${paramIndex++}`);
          values.push(params.technician_id);
        }

        if (params.status) {
          const statuses = Array.isArray(params.status) ? params.status : [params.status];
          conditions.push(`j.status = ANY($${paramIndex++})`);
          values.push(statuses);
        }

        if (params.priority) {
          const priorities = Array.isArray(params.priority) ? params.priority : [params.priority];
          conditions.push(`j.priority = ANY($${paramIndex++})`);
          values.push(priorities);
        }

        if (params.service_type) {
          conditions.push(`j.service_type = $${paramIndex++}`);
          values.push(params.service_type);
        }

        if (params.scheduled_after) {
          conditions.push(`j.scheduled_start >= $${paramIndex++}`);
          values.push(params.scheduled_after);
        }

        if (params.scheduled_before) {
          conditions.push(`j.scheduled_start <= $${paramIndex++}`);
          values.push(params.scheduled_before);
        }

        if (params.created_after) {
          conditions.push(`j.created_at >= $${paramIndex++}`);
          values.push(params.created_after);
        }

        if (params.created_before) {
          conditions.push(`j.created_at <= $${paramIndex++}`);
          values.push(params.created_before);
        }

        if (params.tags) {
          const tags = Array.isArray(params.tags) ? params.tags : [params.tags];
          conditions.push(`j.tags && $${paramIndex++}`);
          values.push(tags);
        }

        if (params.search) {
          conditions.push(`(
            j.title ILIKE $${paramIndex} OR
            j.description ILIKE $${paramIndex} OR
            j.notes ILIKE $${paramIndex}
          )`);
          values.push(`%${params.search}%`);
          paramIndex++;
        }

        // Cursor pagination
        if (cursor) {
          const decoded = decodeCursor(cursor);
          if (decoded) {
            const op = sort_order === 'desc' ? '<' : '>';
            conditions.push(`(j.${sort_by}, j.id) ${op} ($${paramIndex++}, $${paramIndex++})`);
            values.push(decoded.sv, decoded.id);
          }
        }

        // Build SELECT with optional joins
        let selectClause = 'j.*';
        let joinClause = '';

        if (include?.includes('customer')) {
          selectClause += `, row_to_json(c.*) as customer_data`;
          joinClause += ' LEFT JOIN customers c ON j.customer_id = c.id';
        }

        if (include?.includes('technician')) {
          selectClause += `, row_to_json(t.*) as technician_data`;
          joinClause += ' LEFT JOIN technicians t ON j.assigned_technician_id = t.id';
        }

        const query = `
          SELECT ${selectClause}
          FROM jobs j
          ${joinClause}
          WHERE ${conditions.join(' AND ')}
          ORDER BY j.${sort_by} ${sort_order}, j.id ${sort_order}
          LIMIT $${paramIndex}
        `;
        values.push(limit + 1);

        const result = await pool.query(query, values);
        const hasMore = result.rows.length > limit;
        const jobs = result.rows.slice(0, limit);

        // Build response
        const data = jobs.map((row: any) => {
          const job = formatJobResponse(row);
          if (row.customer_data) {
            job.customer = row.customer_data;
          }
          if (row.technician_data) {
            job.technician = row.technician_data;
          }
          return job;
        });

        const response: CursorPaginationResult<any> = {
          data,
          pagination: {
            has_more: hasMore,
            next_cursor: hasMore
              ? encodeCursor(jobs[jobs.length - 1].id, jobs[jobs.length - 1][sort_by])
              : undefined,
            limit,
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
        const include = req.query.include as string | string[] | undefined;
        const includeArr = include ? (Array.isArray(include) ? include : [include]) : [];

        let selectClause = 'j.*';
        let joinClause = '';

        if (includeArr.includes('customer')) {
          selectClause += `, row_to_json(c.*) as customer_data`;
          joinClause += ' LEFT JOIN customers c ON j.customer_id = c.id';
        }

        if (includeArr.includes('technician')) {
          selectClause += `, row_to_json(t.*) as technician_data`;
          joinClause += ' LEFT JOIN technicians t ON j.assigned_technician_id = t.id';
        }

        const query = `
          SELECT ${selectClause}
          FROM jobs j
          ${joinClause}
          WHERE j.id = $1 AND j.org_id = $2
        `;
        const result = await pool.query(query, [id, apiContext.orgId]);

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Job not found' },
          });
        }

        const row = result.rows[0];
        const job = formatJobResponse(row);

        if (row.customer_data) {
          job.customer = row.customer_data;
        }
        if (row.technician_data) {
          job.technician = row.technician_data;
        }

        // Include history if requested
        if (includeArr.includes('history')) {
          const historyQuery = `
            SELECT * FROM job_history
            WHERE job_id = $1
            ORDER BY created_at DESC
            LIMIT 50
          `;
          const historyResult = await pool.query(historyQuery, [id]);
          job.history = historyResult.rows;
        }

        res.json({ success: true, data: job });
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

        // Verify technician if provided
        if (data.assigned_technician_id) {
          const techCheck = await pool.query(
            'SELECT id FROM technicians WHERE id = $1 AND org_id = $2',
            [data.assigned_technician_id, apiContext.orgId]
          );

          if (techCheck.rows.length === 0) {
            return res.status(400).json({
              success: false,
              error: { code: 'INVALID_TECHNICIAN', message: 'Technician not found' },
            });
          }
        }

        // Calculate totals from line items
        const lineItems = data.line_items || [];
        let subtotal = 0;
        let taxTotal = 0;

        for (const item of lineItems) {
          const itemTotal = item.quantity * item.unit_price;
          const discount = item.discount || 0;
          const afterDiscount = itemTotal - discount;
          const tax = afterDiscount * ((item.tax_rate || 0) / 100);
          subtotal += afterDiscount;
          taxTotal += tax;
        }

        const total = subtotal + taxTotal;

        const query = `
          INSERT INTO jobs (
            org_id, customer_id, title, description, service_type,
            status, priority, scheduled_start, scheduled_end,
            estimated_duration_minutes, address, assigned_technician_id,
            line_items, subtotal, tax_total, total, tags, metadata,
            notes, internal_notes, created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5,
            'pending', $6, $7, $8,
            $9, $10, $11,
            $12, $13, $14, $15, $16, $17,
            $18, $19, NOW(), NOW()
          )
          RETURNING *
        `;

        const values = [
          apiContext.orgId,
          data.customer_id,
          data.title,
          data.description || null,
          data.service_type,
          data.priority,
          data.scheduled_start || null,
          data.scheduled_end || null,
          data.estimated_duration_minutes || null,
          data.address ? JSON.stringify(data.address) : null,
          data.assigned_technician_id || null,
          JSON.stringify(lineItems),
          subtotal,
          taxTotal,
          total,
          data.tags || [],
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.notes || null,
          data.internal_notes || null,
        ];

        const result = await pool.query(query, values);
        const job = formatJobResponse(result.rows[0]);

        // Log job creation in history
        await pool.query(
          `INSERT INTO job_history (job_id, action, actor_type, actor_id, details)
           VALUES ($1, 'created', 'api', $2, $3)`,
          [job.id, apiContext.apiKeyId || apiContext.oauthClientId, JSON.stringify({ via: 'public_api' })]
        );

        res.status(201).json({ success: true, data: job });
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

        // Verify technician
        const techCheck = await pool.query(
          'SELECT id FROM technicians WHERE id = $1 AND org_id = $2',
          [technician_id, apiContext.orgId]
        );

        if (techCheck.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_TECHNICIAN', message: 'Technician not found' },
          });
        }

        const result = await pool.query(
          `UPDATE jobs
           SET assigned_technician_id = $1, status = CASE WHEN status = 'pending' THEN 'assigned' ELSE status END, updated_at = NOW()
           WHERE id = $2 AND org_id = $3
           RETURNING *`,
          [technician_id, id, apiContext.orgId]
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
           VALUES ($1, 'assigned', 'api', $2, $3)`,
          [id, apiContext.apiKeyId || apiContext.oauthClientId, JSON.stringify({ technician_id })]
        );

        res.json({ success: true, data: formatJobResponse(result.rows[0]) });
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

        const result = await pool.query(
          `UPDATE jobs
           SET scheduled_start = $1, scheduled_end = $2, status = 'scheduled', updated_at = NOW()
           WHERE id = $3 AND org_id = $4
           RETURNING *`,
          [scheduled_start, scheduled_end || null, id, apiContext.orgId]
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
           VALUES ($1, 'scheduled', 'api', $2, $3)`,
          [id, apiContext.apiKeyId || apiContext.oauthClientId, JSON.stringify({ scheduled_start, scheduled_end })]
        );

        res.json({ success: true, data: formatJobResponse(result.rows[0]) });
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
        const parseResult = startJobSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid start data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const result = await pool.query(
          `UPDATE jobs
           SET status = 'in_progress', actual_start = NOW(), updated_at = NOW()
           WHERE id = $1 AND org_id = $2 AND status IN ('scheduled', 'assigned', 'en_route')
           RETURNING *`,
          [id, apiContext.orgId]
        );

        if (result.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_STATUS', message: 'Job cannot be started in current status' },
          });
        }

        // Log action
        await pool.query(
          `INSERT INTO job_history (job_id, action, actor_type, actor_id, details)
           VALUES ($1, 'started', 'api', $2, $3)`,
          [id, apiContext.apiKeyId || apiContext.oauthClientId, JSON.stringify(parseResult.data)]
        );

        res.json({ success: true, data: formatJobResponse(result.rows[0]) });
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

        // Update line items if provided (recalculate totals)
        let updateFields = 'status = $1, actual_end = NOW(), updated_at = NOW()';
        const values: any[] = ['completed'];
        let paramIndex = 2;

        if (data.line_items && data.line_items.length > 0) {
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
          updateFields += `, line_items = $${paramIndex++}, subtotal = $${paramIndex++}, tax_total = $${paramIndex++}, total = $${paramIndex++}`;
          values.push(JSON.stringify(data.line_items), subtotal, taxTotal, subtotal + taxTotal);
        }

        if (data.completion_notes) {
          updateFields += `, notes = COALESCE(notes, '') || E'\\n\\nCompletion: ' || $${paramIndex++}`;
          values.push(data.completion_notes);
        }

        values.push(id, apiContext.orgId);

        const result = await pool.query(
          `UPDATE jobs
           SET ${updateFields}
           WHERE id = $${paramIndex++} AND org_id = $${paramIndex} AND status = 'in_progress'
           RETURNING *`,
          values
        );

        if (result.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_STATUS', message: 'Job must be in progress to complete' },
          });
        }

        // Log action
        await pool.query(
          `INSERT INTO job_history (job_id, action, actor_type, actor_id, details)
           VALUES ($1, 'completed', 'api', $2, $3)`,
          [id, apiContext.apiKeyId || apiContext.oauthClientId, JSON.stringify(data)]
        );

        res.json({ success: true, data: formatJobResponse(result.rows[0]) });
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

function formatJobResponse(row: JobRow): any {
  return {
    id: row.id,
    org_id: row.org_id,
    customer_id: row.customer_id,
    title: row.title,
    description: row.description,
    service_type: row.service_type,
    status: row.status,
    priority: row.priority,
    scheduled_start: row.scheduled_start?.toISOString() || null,
    scheduled_end: row.scheduled_end?.toISOString() || null,
    estimated_duration_minutes: row.estimated_duration_minutes,
    actual_start: row.actual_start?.toISOString() || null,
    actual_end: row.actual_end?.toISOString() || null,
    address: row.address,
    assigned_technician_id: row.assigned_technician_id,
    line_items: row.line_items,
    subtotal: Number(row.subtotal),
    tax_total: Number(row.tax_total),
    total: Number(row.total),
    tags: row.tags || [],
    metadata: row.metadata,
    notes: row.notes,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
