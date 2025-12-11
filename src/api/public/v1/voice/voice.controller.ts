/**
 * Voice AI Controller
 * ===================
 *
 * API endpoints for Voice AI processing:
 * - POST /voice/process - Manually trigger voice processing
 * - GET /voice/queue - Human review queue
 * - POST /voice/review/:id - Submit human review/corrections
 * - GET /voice/stats - Accuracy and performance statistics
 * - GET /voice/:id - Get voice transcript details
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { requireScopes, readScope, writeScope } from '../../middleware';
import { ApiRequestContext } from '../../public-api.types';
import { log } from '../../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const processVoiceSchema = z.object({
  message_id: z.string().uuid().optional(),
  audio_url: z.string().url().optional(),
  customer_phone: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  auto_create_job: z.boolean().optional().default(false),
}).refine(data => data.message_id || data.audio_url, {
  message: 'Either message_id or audio_url is required',
});

const reviewVoiceSchema = z.object({
  transcription: z.string().optional(),
  extraction: z.object({
    customer_name: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    service_type: z.string().optional(),
    urgency: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    preferred_date: z.string().optional(),
    preferred_time: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
  action: z.enum(['approve', 'reject', 'create_job']),
  notes: z.string().optional(),
});

const listQueueSchema = z.object({
  status: z.enum(['pending', 'needs_review', 'reviewed']).optional(),
  min_confidence: z.coerce.number().min(0).max(1).optional(),
  max_confidence: z.coerce.number().min(0).max(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  sort_by: z.enum(['created_at', 'overall_confidence', 'audio_duration']).optional().default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
});

const statsSchema = z.object({
  period: z.enum(['today', 'week', 'month', '30d', '90d']).optional().default('30d'),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createVoiceController(pool: Pool): Router {
  const router = Router();

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /voice/process - Manually trigger voice processing
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/process',
    requireScopes(writeScope('voice')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = processVoiceSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid voice processing request',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { message_id, audio_url, customer_phone, priority, auto_create_job } = parseResult.data;

        let messageId = message_id;
        let audioUrlToProcess = audio_url;

        // If message_id provided, get the audio URL
        if (message_id) {
          const msgResult = await pool.query(
            `SELECT id, media_url, phone FROM whatsapp_messages
             WHERE id = $1 AND org_id = $2 AND type = 'audio'`,
            [message_id, apiContext.orgId]
          );

          if (msgResult.rows.length === 0) {
            return res.status(404).json({
              success: false,
              error: { code: 'MESSAGE_NOT_FOUND', message: 'Voice message not found' },
            });
          }

          audioUrlToProcess = msgResult.rows[0].media_url;
        }

        // Check for existing transcript
        if (messageId) {
          const existingResult = await pool.query(
            `SELECT id, status FROM voice_transcripts WHERE message_id = $1`,
            [messageId]
          );

          if (existingResult.rows.length > 0) {
            const existing = existingResult.rows[0];
            if (existing.status === 'completed' || existing.status === 'reviewed') {
              return res.status(400).json({
                success: false,
                error: {
                  code: 'ALREADY_PROCESSED',
                  message: 'Voice message already processed',
                  transcript_id: existing.id,
                },
              });
            }
          }
        }

        // Create or update transcript record
        const result = await pool.query(
          `INSERT INTO voice_transcripts (
            message_id, audio_url, status, auto_created,
            processing_started_at, created_at, updated_at
          ) VALUES ($1, $2, 'pending', $3, NULL, NOW(), NOW())
          ON CONFLICT (message_id) DO UPDATE SET
            status = 'pending',
            processing_started_at = NULL,
            retry_count = voice_transcripts.retry_count + 1,
            updated_at = NOW()
          RETURNING id`,
          [messageId, audioUrlToProcess, auto_create_job]
        );

        const transcriptId = result.rows[0].id;

        // Queue for processing
        const priorityMap = { low: 1, normal: 5, high: 8, urgent: 10 };
        try {
          const { getQueueManager } = await import('../../../../lib/queue/queue-manager');
          const queueManager = getQueueManager();
          await queueManager.addJob('voice-queue', {
            transcriptId,
            orgId: apiContext.orgId,
            audioUrl: audioUrlToProcess,
            customerPhone: customer_phone,
            autoCreateJob: auto_create_job,
          }, {
            priority: priorityMap[priority],
          });
        } catch {
          // Queue not available, will be processed by cron
        }

        log.info('Voice processing queued', {
          transcriptId,
          orgId: apiContext.orgId,
          priority,
        });

        res.status(202).json({
          success: true,
          data: {
            transcript_id: transcriptId,
            status: 'pending',
            message: 'Voice processing queued',
          },
        });
      } catch (error) {
        log.error('[Voice API] Process error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to queue voice processing' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /voice/queue - Human review queue
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/queue',
    requireScopes(readScope('voice')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = listQueueSchema.safeParse(req.query);

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

        const { status, min_confidence, max_confidence, limit, offset, sort_by, sort_order } = parseResult.data;

        const conditions = ['wm.org_id = $1'];
        const values: any[] = [apiContext.orgId];
        let paramIndex = 2;

        if (status) {
          conditions.push(`vt.status = $${paramIndex++}`);
          values.push(status);
        } else {
          // Default to needs_review
          conditions.push(`vt.status = 'needs_review'`);
        }

        if (min_confidence !== undefined) {
          conditions.push(`vt.overall_confidence >= $${paramIndex++}`);
          values.push(min_confidence);
        }

        if (max_confidence !== undefined) {
          conditions.push(`vt.overall_confidence <= $${paramIndex++}`);
          values.push(max_confidence);
        }

        // Get count
        const countResult = await pool.query(
          `SELECT COUNT(*)
           FROM voice_transcripts vt
           JOIN whatsapp_messages wm ON vt.message_id = wm.id
           WHERE ${conditions.join(' AND ')}`,
          values
        );

        // Get items
        values.push(limit, offset);
        const result = await pool.query(
          `SELECT
            vt.id, vt.message_id, vt.audio_url, vt.audio_duration,
            vt.transcription, vt.transcription_confidence,
            vt.extraction_data, vt.overall_confidence,
            vt.status, vt.error_message, vt.processing_duration_ms,
            vt.created_at, vt.updated_at,
            wm.phone as customer_phone
           FROM voice_transcripts vt
           JOIN whatsapp_messages wm ON vt.message_id = wm.id
           WHERE ${conditions.join(' AND ')}
           ORDER BY vt.${sort_by} ${sort_order}
           LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
          values
        );

        res.json({
          success: true,
          data: {
            items: result.rows.map(row => ({
              id: row.id,
              message_id: row.message_id,
              audio_url: row.audio_url,
              audio_duration: row.audio_duration,
              customer_phone: row.customer_phone,
              transcription: row.transcription,
              transcription_confidence: row.transcription_confidence,
              extraction: row.extraction_data,
              overall_confidence: row.overall_confidence,
              status: row.status,
              error_message: row.error_message,
              processing_duration_ms: row.processing_duration_ms,
              created_at: row.created_at,
              updated_at: row.updated_at,
            })),
            pagination: {
              total: parseInt(countResult.rows[0].count),
              limit,
              offset,
              has_more: offset + result.rows.length < parseInt(countResult.rows[0].count),
            },
          },
        });
      } catch (error) {
        log.error('[Voice API] Queue error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to get review queue' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /voice/:id - Get voice transcript details
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/:id',
    requireScopes(readScope('voice')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        const result = await pool.query(
          `SELECT
            vt.*,
            wm.phone as customer_phone,
            wm.content as message_content,
            u.name as reviewer_name
           FROM voice_transcripts vt
           JOIN whatsapp_messages wm ON vt.message_id = wm.id
           LEFT JOIN users u ON vt.reviewed_by = u.id
           WHERE vt.id = $1 AND wm.org_id = $2`,
          [id, apiContext.orgId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Voice transcript not found' },
          });
        }

        const row = result.rows[0];

        res.json({
          success: true,
          data: {
            id: row.id,
            message_id: row.message_id,
            audio_url: row.audio_url,
            audio_duration: row.audio_duration,
            audio_quality: row.audio_quality,
            audio_language: row.audio_language,
            customer_phone: row.customer_phone,
            transcription: {
              text: row.transcription,
              model: row.transcription_model,
              confidence: row.transcription_confidence,
              segments: row.transcription_segments,
            },
            extraction: {
              data: row.extraction_data,
              model: row.extraction_model,
              confidence: row.overall_confidence,
            },
            human_review: row.human_transcription || row.human_extraction ? {
              transcription: row.human_transcription,
              extraction: row.human_extraction,
              reviewed_by: row.reviewer_name,
              reviewed_at: row.reviewed_at,
              notes: row.review_notes,
            } : null,
            status: row.status,
            error: row.error_message ? {
              message: row.error_message,
              code: row.error_code,
            } : null,
            processing: {
              started_at: row.processing_started_at,
              completed_at: row.processing_completed_at,
              duration_ms: row.processing_duration_ms,
              retry_count: row.retry_count,
            },
            job: row.created_job_id ? {
              id: row.created_job_id,
              auto_created: row.auto_created,
            } : null,
            created_at: row.created_at,
            updated_at: row.updated_at,
          },
        });
      } catch (error) {
        log.error('[Voice API] Get error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to get transcript' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /voice/review/:id - Submit human review/corrections
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/review/:id',
    requireScopes(writeScope('voice')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = reviewVoiceSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid review data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { transcription, extraction, action, notes } = parseResult.data;

        // Get transcript
        const transcriptResult = await pool.query(
          `SELECT vt.*, wm.org_id, wm.phone
           FROM voice_transcripts vt
           JOIN whatsapp_messages wm ON vt.message_id = wm.id
           WHERE vt.id = $1 AND wm.org_id = $2`,
          [id, apiContext.orgId]
        );

        if (transcriptResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Voice transcript not found' },
          });
        }

        const transcript = transcriptResult.rows[0];

        if (transcript.status === 'reviewed' && action !== 'create_job') {
          return res.status(400).json({
            success: false,
            error: { code: 'ALREADY_REVIEWED', message: 'Transcript already reviewed' },
          });
        }

        // Update transcript with review
        await pool.query(
          `UPDATE voice_transcripts
           SET human_transcription = COALESCE($1, human_transcription),
               human_extraction = COALESCE($2, human_extraction),
               reviewed_by = $3,
               reviewed_at = NOW(),
               review_notes = $4,
               status = 'reviewed',
               updated_at = NOW()
           WHERE id = $5`,
          [
            transcription,
            extraction ? JSON.stringify(extraction) : null,
            apiContext.userId,
            notes,
            id,
          ]
        );

        let createdJobId: string | null = null;

        // Create job if requested
        if (action === 'create_job' || action === 'approve') {
          const finalExtraction = extraction || transcript.extraction_data;

          if (finalExtraction) {
            // Get or create customer
            let customerId: string | null = null;
            const phone = transcript.phone;

            const customerResult = await pool.query(
              `SELECT id FROM customers WHERE org_id = $1 AND phone = $2`,
              [apiContext.orgId, phone]
            );

            if (customerResult.rows.length > 0) {
              customerId = customerResult.rows[0].id;
            } else if (finalExtraction.customer_name) {
              const newCustomer = await pool.query(
                `INSERT INTO customers (org_id, name, phone, created_at, updated_at)
                 VALUES ($1, $2, $3, NOW(), NOW())
                 RETURNING id`,
                [apiContext.orgId, finalExtraction.customer_name, phone]
              );
              customerId = newCustomer.rows[0].id;
            }

            if (customerId) {
              // Create job
              const jobResult = await pool.query(
                `INSERT INTO jobs (
                  org_id, customer_id, status, service_type,
                  address, notes, urgency, scheduled_date,
                  source, created_at, updated_at
                ) VALUES (
                  $1, $2, 'pending', $3,
                  $4, $5, $6, $7,
                  'voice_ai', NOW(), NOW()
                ) RETURNING id`,
                [
                  apiContext.orgId,
                  customerId,
                  finalExtraction.service_type || 'general',
                  finalExtraction.address,
                  finalExtraction.notes || transcript.transcription,
                  finalExtraction.urgency || 'normal',
                  finalExtraction.preferred_date,
                ]
              );

              createdJobId = jobResult.rows[0].id;

              // Update transcript with job reference
              await pool.query(
                `UPDATE voice_transcripts
                 SET created_job_id = $1, auto_created = $2
                 WHERE id = $3`,
                [createdJobId, action === 'approve', id]
              );
            }
          }
        }

        log.info('Voice transcript reviewed', {
          transcriptId: id,
          action,
          reviewedBy: apiContext.userId,
          createdJobId,
        });

        res.json({
          success: true,
          data: {
            transcript_id: id,
            action,
            status: 'reviewed',
            job_created: createdJobId !== null,
            job_id: createdJobId,
          },
        });
      } catch (error) {
        log.error('[Voice API] Review error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to submit review' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /voice/stats - Accuracy and performance statistics
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/stats',
    requireScopes(readScope('voice')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = statsSchema.safeParse(req.query);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid query parameters',
            },
          });
        }

        const { period } = parseResult.data;

        const intervalMap: Record<string, string> = {
          today: '1 day',
          week: '7 days',
          month: '30 days',
          '30d': '30 days',
          '90d': '90 days',
        };

        const interval = intervalMap[period];

        const result = await pool.query(
          `SELECT
            COUNT(*) as total_processed,
            COUNT(*) FILTER (WHERE status = 'completed' AND auto_created = true) as auto_approved,
            COUNT(*) FILTER (WHERE status = 'needs_review') as needs_review,
            COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed,
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            ROUND(AVG(overall_confidence)::numeric, 3) as avg_confidence,
            ROUND(AVG(transcription_confidence)::numeric, 3) as avg_transcription_confidence,
            ROUND(AVG(processing_duration_ms)::numeric, 0) as avg_processing_ms,
            ROUND(AVG(audio_duration)::numeric, 0) as avg_audio_duration,
            COUNT(*) FILTER (WHERE created_job_id IS NOT NULL) as jobs_created,
            COUNT(*) FILTER (WHERE auto_created = true AND created_job_id IS NOT NULL) as auto_jobs_created
           FROM voice_transcripts vt
           JOIN whatsapp_messages wm ON vt.message_id = wm.id
           WHERE wm.org_id = $1
             AND vt.created_at > NOW() - INTERVAL '${interval}'`,
          [apiContext.orgId]
        );

        const stats = result.rows[0];
        const total = parseInt(stats.total_processed) || 1;

        // Get daily breakdown
        const dailyResult = await pool.query(
          `SELECT
            DATE(vt.created_at) as date,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            ROUND(AVG(overall_confidence)::numeric, 3) as avg_confidence
           FROM voice_transcripts vt
           JOIN whatsapp_messages wm ON vt.message_id = wm.id
           WHERE wm.org_id = $1
             AND vt.created_at > NOW() - INTERVAL '${interval}'
           GROUP BY DATE(vt.created_at)
           ORDER BY date DESC
           LIMIT 30`,
          [apiContext.orgId]
        );

        // Get correction rates by field
        const correctionResult = await pool.query(
          `SELECT
            COUNT(*) FILTER (WHERE human_transcription IS NOT NULL AND human_transcription != transcription) as transcription_corrections,
            COUNT(*) FILTER (WHERE human_extraction IS NOT NULL) as extraction_corrections,
            COUNT(*) FILTER (WHERE status = 'reviewed') as total_reviewed
           FROM voice_transcripts vt
           JOIN whatsapp_messages wm ON vt.message_id = wm.id
           WHERE wm.org_id = $1
             AND vt.created_at > NOW() - INTERVAL '${interval}'
             AND status = 'reviewed'`,
          [apiContext.orgId]
        );

        const corrections = correctionResult.rows[0];
        const totalReviewed = parseInt(corrections.total_reviewed) || 1;

        res.json({
          success: true,
          data: {
            period,
            summary: {
              total_processed: parseInt(stats.total_processed),
              auto_approved: parseInt(stats.auto_approved),
              needs_review: parseInt(stats.needs_review),
              reviewed: parseInt(stats.reviewed),
              failed: parseInt(stats.failed),
              jobs_created: parseInt(stats.jobs_created),
              auto_jobs_created: parseInt(stats.auto_jobs_created),
            },
            rates: {
              auto_approval_rate: ((parseInt(stats.auto_approved) / total) * 100).toFixed(1),
              failure_rate: ((parseInt(stats.failed) / total) * 100).toFixed(1),
              job_creation_rate: ((parseInt(stats.jobs_created) / total) * 100).toFixed(1),
              transcription_correction_rate: ((parseInt(corrections.transcription_corrections) / totalReviewed) * 100).toFixed(1),
              extraction_correction_rate: ((parseInt(corrections.extraction_corrections) / totalReviewed) * 100).toFixed(1),
            },
            confidence: {
              avg_overall: parseFloat(stats.avg_confidence) || 0,
              avg_transcription: parseFloat(stats.avg_transcription_confidence) || 0,
            },
            performance: {
              avg_processing_ms: parseInt(stats.avg_processing_ms) || 0,
              avg_audio_duration: parseInt(stats.avg_audio_duration) || 0,
            },
            daily: dailyResult.rows,
          },
        });
      } catch (error) {
        log.error('[Voice API] Stats error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to get statistics' },
        });
      }
    }
  );

  return router;
}
