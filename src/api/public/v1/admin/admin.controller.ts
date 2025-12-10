/**
 * Admin Controller
 * ================
 *
 * API endpoints for admin monitoring and operations:
 * - GET /admin/queues - All queue statuses
 * - GET /admin/dlq - List Dead Letter Queue items
 * - POST /admin/dlq/:id/retry - Retry failed job
 * - POST /admin/dlq/:id/discard - Discard failed job
 * - GET /admin/panic - Panic mode status per service
 * - POST /admin/panic/:service - Manual panic mode control
 * - GET /admin/metrics - Operational metrics dashboard
 * - GET /admin/health - System health check
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { requireScopes } from '../../middleware';
import { ApiRequestContext } from '../../public-api.types';
import { log } from '../../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const retryJobSchema = z.object({
  priority: z.number().int().min(1).max(10).optional(),
  delay_ms: z.number().int().min(0).max(3600000).optional(),
});

const panicControlSchema = z.object({
  action: z.enum(['enter', 'exit']),
  reason: z.string().optional(),
  duration_minutes: z.number().int().min(1).max(1440).optional(),
});

const listDlqSchema = z.object({
  queue: z.string().optional(),
  status: z.enum(['pending', 'retrying', 'retried', 'discarded', 'resolved']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface QueueStatus {
  name: string;
  pending: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  oldest_job_age_ms?: number;
  processing_rate?: number;
}

interface PanicStatus {
  service: string;
  active: boolean;
  consecutive_failures: number;
  panic_started_at?: Date;
  last_success?: Date;
  last_failure?: Date;
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createAdminController(pool: Pool): Router {
  const router = Router();

  // Require admin scope for all routes
  router.use(requireScopes(['admin:read']));

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /admin/health - System health check
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/health', async (req: Request, res: Response) => {
    try {
      const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};

      // Database check
      const dbStart = Date.now();
      try {
        await pool.query('SELECT 1');
        checks.database = { status: 'healthy', latency_ms: Date.now() - dbStart };
      } catch (error) {
        checks.database = { status: 'unhealthy', error: String(error) };
      }

      // Redis check (if available)
      try {
        const { getRedisManager } = await import('../../../../lib/redis/redis-manager');
        const redis = getRedisManager('default');
        const health = await redis.getHealth();
        checks.redis = {
          status: health.connected ? 'healthy' : 'unhealthy',
          latency_ms: health.latencyMs,
        };
      } catch {
        checks.redis = { status: 'not_configured' };
      }

      const allHealthy = Object.values(checks).every(
        (c) => c.status === 'healthy' || c.status === 'not_configured'
      );

      res.status(allHealthy ? 200 : 503).json({
        success: true,
        data: {
          status: allHealthy ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString(),
          checks,
        },
      });
    } catch (error) {
      log.error('[Admin API] Health check error:', { error });
      res.status(503).json({
        success: false,
        error: { code: 'HEALTH_CHECK_FAILED', message: 'Health check failed' },
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /admin/queues - All queue statuses
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/queues', async (req: Request, res: Response) => {
    try {
      const queues: QueueStatus[] = [];

      // Try to get BullMQ queue stats
      try {
        const { getQueueManager } = await import('../../../../lib/queue/queue-manager');
        const queueManager = getQueueManager();

        const queueNames = ['cae-queue', 'whatsapp-queue', 'payment-queue', 'notification-queue', 'voice-queue'];

        for (const name of queueNames) {
          try {
            const queue = queueManager.getQueue(name);
            if (queue) {
              const counts = await queue.getJobCounts();
              const isPaused = await queue.isPaused();

              queues.push({
                name,
                pending: counts.waiting || 0,
                active: counts.active || 0,
                completed: counts.completed || 0,
                failed: counts.failed || 0,
                delayed: counts.delayed || 0,
                paused: isPaused,
              });
            }
          } catch {
            queues.push({
              name,
              pending: 0,
              active: 0,
              completed: 0,
              failed: 0,
              delayed: 0,
              paused: false,
            });
          }
        }
      } catch {
        // Queue manager not available
      }

      // Get DLQ stats from database
      const dlqResult = await pool.query(`
        SELECT
          queue_name,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'retrying') as retrying,
          COUNT(*) FILTER (WHERE status = 'retried') as retried,
          COUNT(*) FILTER (WHERE status = 'discarded') as discarded,
          MIN(failed_at) FILTER (WHERE status = 'pending') as oldest_pending
        FROM failed_jobs
        GROUP BY queue_name
      `);

      const dlqStats = dlqResult.rows.reduce((acc: any, row: any) => {
        acc[row.queue_name] = {
          pending: parseInt(row.pending),
          retrying: parseInt(row.retrying),
          retried: parseInt(row.retried),
          discarded: parseInt(row.discarded),
          oldest_pending: row.oldest_pending,
        };
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          queues,
          dead_letter_queue: dlqStats,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      log.error('[Admin API] Queues error:', { error });
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to get queue statuses' },
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /admin/dlq - List Dead Letter Queue items
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/dlq', async (req: Request, res: Response) => {
    try {
      const parseResult = listDlqSchema.safeParse(req.query);

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

      const { queue, status, limit, offset } = parseResult.data;

      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (queue) {
        conditions.push(`queue_name = $${paramIndex++}`);
        values.push(queue);
      }

      if (status) {
        conditions.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM failed_jobs ${whereClause}`,
        values
      );

      values.push(limit, offset);
      const result = await pool.query(
        `SELECT
          id, queue_name, job_id, job_name, job_data,
          error_message, error_code, error_type,
          attempts, max_attempts, status, priority,
          org_id, related_entity_type, related_entity_id,
          resolution_notes, failed_at, created_at
         FROM failed_jobs
         ${whereClause}
         ORDER BY priority DESC, failed_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        values
      );

      res.json({
        success: true,
        data: {
          items: result.rows,
          pagination: {
            total: parseInt(countResult.rows[0].count),
            limit,
            offset,
            has_more: offset + result.rows.length < parseInt(countResult.rows[0].count),
          },
        },
      });
    } catch (error) {
      log.error('[Admin API] DLQ list error:', { error });
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to list DLQ items' },
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /admin/dlq/:id/retry - Retry failed job
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/dlq/:id/retry',
    requireScopes(['admin:write']),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const parseResult = retryJobSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid retry options',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { priority, delay_ms } = parseResult.data;

        // Get failed job
        const jobResult = await pool.query(
          `SELECT * FROM failed_jobs WHERE id = $1 AND status = 'pending'`,
          [id]
        );

        if (jobResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Failed job not found or already processed' },
          });
        }

        const failedJob = jobResult.rows[0];

        // Update status to retrying
        await pool.query(
          `UPDATE failed_jobs
           SET status = 'retrying', retry_count = retry_count + 1, updated_at = NOW()
           WHERE id = $1`,
          [id]
        );

        // Try to re-queue the job
        let retryJobId: string | null = null;
        try {
          const { getQueueManager } = await import('../../../../lib/queue/queue-manager');
          const queueManager = getQueueManager();
          const queue = queueManager.getQueue(failedJob.queue_name);

          if (queue) {
            const job = await queue.add(
              failedJob.job_name || 'retry',
              failedJob.job_data,
              {
                priority: priority || failedJob.priority || 5,
                delay: delay_ms || 0,
                jobId: `retry-${failedJob.job_id}-${Date.now()}`,
              }
            );
            retryJobId = job.id || null;
          }
        } catch (queueError) {
          log.error('Failed to requeue job', { error: queueError, failedJobId: id });
        }

        // Update with retry result
        await pool.query(
          `UPDATE failed_jobs
           SET status = $1, retry_job_id = $2, retried_at = NOW()
           WHERE id = $3`,
          [retryJobId ? 'retried' : 'pending', retryJobId, id]
        );

        log.info('DLQ job retry initiated', { failedJobId: id, retryJobId });

        res.json({
          success: true,
          data: {
            failed_job_id: id,
            retry_job_id: retryJobId,
            status: retryJobId ? 'retried' : 'retry_failed',
          },
        });
      } catch (error) {
        log.error('[Admin API] DLQ retry error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to retry job' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /admin/dlq/:id/discard - Discard failed job
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/dlq/:id/discard',
    requireScopes(['admin:write']),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const { reason } = req.body;

        const result = await pool.query(
          `UPDATE failed_jobs
           SET status = 'discarded',
               resolution_notes = $1,
               resolved_by = $2,
               resolved_at = NOW()
           WHERE id = $3 AND status IN ('pending', 'retrying')
           RETURNING id`,
          [reason || 'Manually discarded', apiContext.userId, id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Failed job not found or already processed' },
          });
        }

        log.info('DLQ job discarded', { failedJobId: id, userId: apiContext.userId });

        res.json({
          success: true,
          data: { id, status: 'discarded' },
        });
      } catch (error) {
        log.error('[Admin API] DLQ discard error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to discard job' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /admin/panic - Panic mode status per service
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/panic', async (req: Request, res: Response) => {
    try {
      // Get panic status from database
      const result = await pool.query(`
        SELECT
          service_name,
          is_active,
          consecutive_failures,
          started_at,
          last_success_at,
          last_failure_at,
          reason
        FROM panic_status
        ORDER BY service_name
      `);

      const services: PanicStatus[] = result.rows.map((row: any) => ({
        service: row.service_name,
        active: row.is_active,
        consecutive_failures: row.consecutive_failures,
        panic_started_at: row.started_at,
        last_success: row.last_success_at,
        last_failure: row.last_failure_at,
        reason: row.reason,
      }));

      // Add default services if not in database
      const defaultServices = ['afip', 'mercadopago', 'whatsapp', 'voice_ai'];
      for (const svc of defaultServices) {
        if (!services.find((s) => s.service === svc)) {
          services.push({
            service: svc,
            active: false,
            consecutive_failures: 0,
          });
        }
      }

      res.json({
        success: true,
        data: {
          services,
          any_active: services.some((s) => s.active),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      log.error('[Admin API] Panic status error:', { error });
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to get panic status' },
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /admin/panic/:service - Manual panic mode control
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/panic/:service',
    requireScopes(['admin:write']),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { service } = req.params;
        const parseResult = panicControlSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid panic control data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { action, reason, duration_minutes } = parseResult.data;
        const validServices = ['afip', 'mercadopago', 'whatsapp', 'voice_ai'];

        if (!validServices.includes(service)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_SERVICE',
              message: `Invalid service. Valid: ${validServices.join(', ')}`,
            },
          });
        }

        if (action === 'enter') {
          await pool.query(
            `INSERT INTO panic_status (service_name, is_active, started_at, reason, expires_at, triggered_by)
             VALUES ($1, true, NOW(), $2, $3, $4)
             ON CONFLICT (service_name) DO UPDATE SET
               is_active = true,
               started_at = NOW(),
               reason = $2,
               expires_at = $3,
               triggered_by = $4`,
            [
              service,
              reason || 'Manual panic mode',
              duration_minutes ? new Date(Date.now() + duration_minutes * 60 * 1000) : null,
              apiContext.userId,
            ]
          );

          log.warn('Manual panic mode entered', { service, userId: apiContext.userId, reason });
        } else {
          await pool.query(
            `UPDATE panic_status
             SET is_active = false, ended_at = NOW(), consecutive_failures = 0
             WHERE service_name = $1`,
            [service]
          );

          log.info('Manual panic mode exited', { service, userId: apiContext.userId });
        }

        // Log audit
        await pool.query(
          `INSERT INTO audit_log (action, entity_type, entity_id, user_id, details, created_at)
           VALUES ($1, 'panic_mode', $2, $3, $4, NOW())`,
          [
            action === 'enter' ? 'panic_enter' : 'panic_exit',
            service,
            apiContext.userId,
            JSON.stringify({ reason, duration_minutes }),
          ]
        );

        res.json({
          success: true,
          data: {
            service,
            action,
            active: action === 'enter',
            expires_at: duration_minutes
              ? new Date(Date.now() + duration_minutes * 60 * 1000)
              : null,
          },
        });
      } catch (error) {
        log.error('[Admin API] Panic control error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to control panic mode' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /admin/metrics - Operational metrics dashboard
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const period = (req.query.period as string) || '24h';
      let interval: string;

      switch (period) {
        case '1h':
          interval = '1 hour';
          break;
        case '6h':
          interval = '6 hours';
          break;
        case '24h':
          interval = '24 hours';
          break;
        case '7d':
          interval = '7 days';
          break;
        default:
          interval = '24 hours';
      }

      // Get API metrics
      const apiMetrics = await pool.query(
        `SELECT
          COUNT(*) as total_requests,
          COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as successful,
          COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500) as client_errors,
          COUNT(*) FILTER (WHERE status_code >= 500) as server_errors,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as p50_latency,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_latency,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_latency,
          AVG(duration_ms) as avg_latency
         FROM api_metrics
         WHERE created_at > NOW() - INTERVAL '${interval}'`
      );

      // Get job metrics
      const jobMetrics = await pool.query(
        `SELECT
          COUNT(*) as total_jobs,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          AVG(duration_ms) as avg_duration
         FROM job_metrics
         WHERE created_at > NOW() - INTERVAL '${interval}'`
      );

      // Get external service metrics
      const externalMetrics = await pool.query(
        `SELECT
          service_name,
          COUNT(*) as total_calls,
          COUNT(*) FILTER (WHERE success = true) as successful,
          AVG(latency_ms) as avg_latency,
          MAX(latency_ms) as max_latency
         FROM external_service_metrics
         WHERE created_at > NOW() - INTERVAL '${interval}'
         GROUP BY service_name`
      );

      // Get active users
      const activeUsers = await pool.query(
        `SELECT COUNT(DISTINCT user_id) as count
         FROM sessions
         WHERE last_used_at > NOW() - INTERVAL '${interval}' AND is_active = true`
      );

      res.json({
        success: true,
        data: {
          period,
          api: apiMetrics.rows[0] || {},
          jobs: jobMetrics.rows[0] || {},
          external_services: externalMetrics.rows,
          active_users: parseInt(activeUsers.rows[0]?.count || '0'),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      log.error('[Admin API] Metrics error:', { error });
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to get metrics' },
      });
    }
  });

  return router;
}
