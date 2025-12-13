/**
 * Webhooks Controller
 * ====================
 *
 * Public API controller for webhook management.
 * Allows creating, managing, and monitoring webhooks.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import crypto from 'crypto';
import {
  createWebhookSchema,
  updateWebhookSchema,
  listWebhooksSchema,
  testWebhookSchema,
  rotateSecretSchema,
  listDeliveriesSchema,
  CreateWebhookInput,
} from './webhooks.schema';
import { requireScopes, readScope, writeScope, deleteScope } from '../../middleware';
import { ApiRequestContext, CursorPaginationResult } from '../../public-api.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface WebhookRow {
  id: string;
  org_id: string;
  url: string;
  events: string[];
  description: string | null;
  secret: string;
  enabled: boolean;
  metadata: any;
  headers: Record<string, string> | null;
  retry_policy: any;
  last_delivery_at: Date | null;
  last_delivery_status: string | null;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  created_at: Date;
  updated_at: Date;
}

interface DeliveryRow {
  id: string;
  webhook_id: string;
  event_type: string;
  event_id: string;
  status: string;
  request_url: string;
  request_headers: Record<string, string>;
  request_body: any;
  response_status: number | null;
  response_headers: Record<string, string> | null;
  response_body: string | null;
  attempts: number;
  next_retry_at: Date | null;
  delivered_at: Date | null;
  duration_ms: number | null;
  error: string | null;
  created_at: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

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

function formatWebhookResponse(row: WebhookRow, includeSecret: boolean = false): any {
  const response: any = {
    id: row.id,
    org_id: row.org_id,
    url: row.url,
    events: row.events,
    description: row.description,
    enabled: row.enabled,
    metadata: row.metadata,
    headers: row.headers,
    retry_policy: row.retry_policy,
    last_delivery_at: row.last_delivery_at?.toISOString() || null,
    last_delivery_status: row.last_delivery_status,
    total_deliveries: row.total_deliveries || 0,
    successful_deliveries: row.successful_deliveries || 0,
    failed_deliveries: row.failed_deliveries || 0,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };

  if (includeSecret) {
    response.secret = row.secret;
  }

  return response;
}

function formatDeliveryResponse(row: DeliveryRow): any {
  return {
    id: row.id,
    webhook_id: row.webhook_id,
    event_type: row.event_type,
    event_id: row.event_id,
    status: row.status,
    request_url: row.request_url,
    request_headers: row.request_headers,
    request_body: row.request_body,
    response_status: row.response_status,
    response_headers: row.response_headers,
    response_body: row.response_body,
    attempts: row.attempts,
    next_retry_at: row.next_retry_at?.toISOString() || null,
    delivered_at: row.delivered_at?.toISOString() || null,
    duration_ms: row.duration_ms,
    error: row.error,
    created_at: row.created_at.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createWebhooksController(pool: Pool): Router {
  const router = Router();

  // ─────────────────────────────────────────────────────────────────────────────
  // LIST WEBHOOKS
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/',
    readScope('webhooks'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = listWebhooksSchema.safeParse(req.query);

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
        const { limit, cursor } = params;

        // Build query
        const conditions: string[] = ['org_id = $1'];
        const values: any[] = [apiContext.orgId];
        let paramIndex = 2;

        if (params.enabled !== undefined) {
          conditions.push(`enabled = $${paramIndex++}`);
          values.push(params.enabled);
        }

        if (params.event) {
          conditions.push(`$${paramIndex++} = ANY(events)`);
          values.push(params.event);
        }

        if (params.search) {
          conditions.push(`(url ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
          values.push(`%${params.search}%`);
          paramIndex++;
        }

        // Cursor pagination
        if (cursor) {
          const decoded = decodeCursor(cursor);
          if (decoded) {
            conditions.push(`(created_at, id) < ($${paramIndex++}, $${paramIndex++})`);
            values.push(decoded.sv, decoded.id);
          }
        }

        const query = `
          SELECT *
          FROM webhooks
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at DESC, id DESC
          LIMIT $${paramIndex}
        `;
        values.push(limit + 1);

        const result = await pool.query(query, values);
        const hasMore = result.rows.length > limit;
        const webhooks = result.rows.slice(0, limit);

        const response: CursorPaginationResult<any> = {
          data: webhooks.map((row: WebhookRow) => formatWebhookResponse(row)),
          pagination: {
            has_more: hasMore,
            next_cursor: hasMore
              ? encodeCursor(webhooks[webhooks.length - 1].id, webhooks[webhooks.length - 1].created_at)
              : undefined,
            limit,
          },
        };

        res.json({ success: true, ...response });
      } catch (error) {
        console.error('[Webhooks API] List error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to list webhooks' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET SINGLE WEBHOOK
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/:id',
    readScope('webhooks'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        const result = await pool.query(
          'SELECT * FROM webhooks WHERE id = $1 AND org_id = $2',
          [id, apiContext.orgId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Webhook not found' },
          });
        }

        res.json({ success: true, data: formatWebhookResponse(result.rows[0]) });
      } catch (error) {
        console.error('[Webhooks API] Get error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to get webhook' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE WEBHOOK
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/',
    writeScope('webhooks'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = createWebhookSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid webhook data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const data = parseResult.data;
        const secret = data.secret || generateWebhookSecret();

        const retryPolicy = data.retry_policy || {
          max_attempts: 5,
          initial_delay_ms: 1000,
          max_delay_ms: 300000,
        };

        const query = `
          INSERT INTO webhooks (
            org_id, url, events, description, secret, enabled,
            metadata, headers, retry_policy,
            total_deliveries, successful_deliveries, failed_deliveries,
            created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9,
            0, 0, 0,
            NOW(), NOW()
          )
          RETURNING *
        `;

        const values = [
          apiContext.orgId,
          data.url,
          data.events,
          data.description || null,
          secret,
          data.enabled,
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.headers ? JSON.stringify(data.headers) : null,
          JSON.stringify(retryPolicy),
        ];

        const result = await pool.query(query, values);

        // Return with secret visible (only on create)
        res.status(201).json({
          success: true,
          data: formatWebhookResponse(result.rows[0], true),
        });
      } catch (error) {
        console.error('[Webhooks API] Create error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to create webhook' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // UPDATE WEBHOOK
  // ─────────────────────────────────────────────────────────────────────────────

  router.patch(
    '/:id',
    writeScope('webhooks'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = updateWebhookSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid webhook data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const data = parseResult.data;

        // Build dynamic update query
        const setClauses: string[] = ['updated_at = NOW()'];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.url !== undefined) {
          setClauses.push(`url = $${paramIndex++}`);
          values.push(data.url);
        }

        if (data.events !== undefined) {
          setClauses.push(`events = $${paramIndex++}`);
          values.push(data.events);
        }

        if (data.description !== undefined) {
          setClauses.push(`description = $${paramIndex++}`);
          values.push(data.description);
        }

        if (data.enabled !== undefined) {
          setClauses.push(`enabled = $${paramIndex++}`);
          values.push(data.enabled);
        }

        if (data.metadata !== undefined) {
          setClauses.push(`metadata = $${paramIndex++}`);
          values.push(JSON.stringify(data.metadata));
        }

        if (data.headers !== undefined) {
          setClauses.push(`headers = $${paramIndex++}`);
          values.push(data.headers ? JSON.stringify(data.headers) : null);
        }

        if (data.retry_policy !== undefined) {
          setClauses.push(`retry_policy = $${paramIndex++}`);
          values.push(data.retry_policy ? JSON.stringify(data.retry_policy) : null);
        }

        if (setClauses.length === 1) {
          return res.status(400).json({
            success: false,
            error: { code: 'NO_UPDATES', message: 'No valid fields to update' },
          });
        }

        values.push(id, apiContext.orgId);

        const query = `
          UPDATE webhooks
          SET ${setClauses.join(', ')}
          WHERE id = $${paramIndex++} AND org_id = $${paramIndex}
          RETURNING *
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Webhook not found' },
          });
        }

        res.json({ success: true, data: formatWebhookResponse(result.rows[0]) });
      } catch (error) {
        console.error('[Webhooks API] Update error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to update webhook' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE WEBHOOK
  // ─────────────────────────────────────────────────────────────────────────────

  router.delete(
    '/:id',
    deleteScope('webhooks'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        const result = await pool.query(
          'DELETE FROM webhooks WHERE id = $1 AND org_id = $2 RETURNING id',
          [id, apiContext.orgId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Webhook not found' },
          });
        }

        res.json({ success: true, data: { id, deleted: true } });
      } catch (error) {
        console.error('[Webhooks API] Delete error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to delete webhook' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // WEBHOOK ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  // Test webhook
  router.post(
    '/:id/test',
    writeScope('webhooks'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = testWebhookSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid test data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { event_type, payload } = parseResult.data;

        // Get webhook
        const webhookResult = await pool.query(
          'SELECT * FROM webhooks WHERE id = $1 AND org_id = $2',
          [id, apiContext.orgId]
        );

        if (webhookResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Webhook not found' },
          });
        }

        const webhook = webhookResult.rows[0];

        // Create test payload
        const testPayload = {
          id: crypto.randomUUID(),
          type: event_type,
          created_at: new Date().toISOString(),
          test: true,
          data: payload || getSamplePayload(event_type),
        };

        // Sign the payload
        const timestamp = Math.floor(Date.now() / 1000);
        const signaturePayload = `${timestamp}.${JSON.stringify(testPayload)}`;
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(signaturePayload)
          .digest('hex');

        // Prepare request
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-ID': webhook.id,
          'X-Webhook-Timestamp': timestamp.toString(),
          'X-Webhook-Signature': `v1=${signature}`,
          'User-Agent': 'CampoTech-Webhook/1.0',
          ...(webhook.headers || {}),
        };

        // Send test request
        const startTime = Date.now();
        let response: any;
        let error: string | null = null;

        try {
          const fetchResponse = await fetch(webhook.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(testPayload),
            signal: AbortSignal.timeout(30000),
          });

          response = {
            status: fetchResponse.status,
            headers: Object.fromEntries(fetchResponse.headers.entries()),
            body: await fetchResponse.text(),
          };
        } catch (err: any) {
          error = err.message;
        }

        const duration = Date.now() - startTime;

        // Record test delivery
        await pool.query(
          `INSERT INTO webhook_deliveries (
            webhook_id, event_type, event_id, status,
            request_url, request_headers, request_body,
            response_status, response_headers, response_body,
            attempts, delivered_at, duration_ms, error, created_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10,
            1, $11, $12, $13, NOW()
          )`,
          [
            webhook.id,
            event_type,
            testPayload.id,
            error ? 'failed' : (response?.status >= 200 && response?.status < 300 ? 'delivered' : 'failed'),
            webhook.url,
            JSON.stringify(headers),
            JSON.stringify(testPayload),
            response?.status || null,
            response?.headers ? JSON.stringify(response.headers) : null,
            response?.body || null,
            error ? null : new Date(),
            duration,
            error,
          ]
        );

        res.json({
          success: true,
          data: {
            test: true,
            webhook_id: webhook.id,
            event_type,
            request: {
              url: webhook.url,
              headers,
              body: testPayload,
            },
            response: response || null,
            duration_ms: duration,
            error,
            delivered: !error && response?.status >= 200 && response?.status < 300,
          },
        });
      } catch (error) {
        console.error('[Webhooks API] Test error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to test webhook' },
        });
      }
    }
  );

  // Rotate secret
  router.post(
    '/:id/rotate-secret',
    writeScope('webhooks'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = rotateSecretSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid rotation data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const newSecret = parseResult.data.new_secret || generateWebhookSecret();

        const result = await pool.query(
          `UPDATE webhooks
           SET secret = $1, updated_at = NOW()
           WHERE id = $2 AND org_id = $3
           RETURNING *`,
          [newSecret, id, apiContext.orgId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Webhook not found' },
          });
        }

        res.json({
          success: true,
          data: {
            ...formatWebhookResponse(result.rows[0]),
            secret: newSecret, // Include new secret in response
          },
        });
      } catch (error) {
        console.error('[Webhooks API] Rotate secret error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to rotate secret' },
        });
      }
    }
  );

  // Enable/disable webhook
  router.post(
    '/:id/enable',
    writeScope('webhooks'),
    async (req: Request, res: Response) => {
      await toggleWebhook(pool, req, res, true);
    }
  );

  router.post(
    '/:id/disable',
    writeScope('webhooks'),
    async (req: Request, res: Response) => {
      await toggleWebhook(pool, req, res, false);
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // DELIVERY LOGS
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/:id/deliveries',
    readScope('webhooks'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = listDeliveriesSchema.safeParse(req.query);

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

        // Verify webhook belongs to org
        const webhookCheck = await pool.query(
          'SELECT id FROM webhooks WHERE id = $1 AND org_id = $2',
          [id, apiContext.orgId]
        );

        if (webhookCheck.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Webhook not found' },
          });
        }

        const params = parseResult.data;
        const { limit, cursor } = params;

        const conditions: string[] = ['webhook_id = $1'];
        const values: any[] = [id];
        let paramIndex = 2;

        if (params.event_type) {
          conditions.push(`event_type = $${paramIndex++}`);
          values.push(params.event_type);
        }

        if (params.status) {
          conditions.push(`status = $${paramIndex++}`);
          values.push(params.status);
        }

        if (params.created_after) {
          conditions.push(`created_at >= $${paramIndex++}`);
          values.push(params.created_after);
        }

        if (params.created_before) {
          conditions.push(`created_at <= $${paramIndex++}`);
          values.push(params.created_before);
        }

        if (cursor) {
          const decoded = decodeCursor(cursor);
          if (decoded) {
            conditions.push(`(created_at, id) < ($${paramIndex++}, $${paramIndex++})`);
            values.push(decoded.sv, decoded.id);
          }
        }

        const query = `
          SELECT *
          FROM webhook_deliveries
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at DESC, id DESC
          LIMIT $${paramIndex}
        `;
        values.push(limit + 1);

        const result = await pool.query(query, values);
        const hasMore = result.rows.length > limit;
        const deliveries = result.rows.slice(0, limit);

        const response: CursorPaginationResult<any> = {
          data: deliveries.map((row: DeliveryRow) => formatDeliveryResponse(row)),
          pagination: {
            has_more: hasMore,
            next_cursor: hasMore
              ? encodeCursor(deliveries[deliveries.length - 1].id, deliveries[deliveries.length - 1].created_at)
              : undefined,
            limit,
          },
        };

        res.json({ success: true, ...response });
      } catch (error) {
        console.error('[Webhooks API] List deliveries error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to list deliveries' },
        });
      }
    }
  );

  // Retry a failed delivery
  router.post(
    '/:id/deliveries/:deliveryId/retry',
    writeScope('webhooks'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id, deliveryId } = req.params;

        // Verify webhook belongs to org
        const webhookResult = await pool.query(
          'SELECT * FROM webhooks WHERE id = $1 AND org_id = $2',
          [id, apiContext.orgId]
        );

        if (webhookResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Webhook not found' },
          });
        }

        // Get delivery
        const deliveryResult = await pool.query(
          'SELECT * FROM webhook_deliveries WHERE id = $1 AND webhook_id = $2',
          [deliveryId, id]
        );

        if (deliveryResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Delivery not found' },
          });
        }

        const delivery = deliveryResult.rows[0];

        if (delivery.status === 'delivered') {
          return res.status(400).json({
            success: false,
            error: { code: 'ALREADY_DELIVERED', message: 'Delivery was already successful' },
          });
        }

        // Queue for retry by setting next_retry_at to now
        await pool.query(
          `UPDATE webhook_deliveries
           SET status = 'pending', next_retry_at = NOW()
           WHERE id = $1`,
          [deliveryId]
        );

        res.json({
          success: true,
          data: { id: deliveryId, queued_for_retry: true },
        });
      } catch (error) {
        console.error('[Webhooks API] Retry delivery error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to retry delivery' },
        });
      }
    }
  );

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function toggleWebhook(
  pool: Pool,
  req: Request,
  res: Response,
  enabled: boolean
): Promise<void> {
  try {
    const apiContext = (req as any).apiContext as ApiRequestContext;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE webhooks
       SET enabled = $1, updated_at = NOW()
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      [enabled, id, apiContext.orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook not found' },
      });
      return;
    }

    res.json({ success: true, data: formatWebhookResponse(result.rows[0]) });
  } catch (error) {
    console.error('[Webhooks API] Toggle error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update webhook' },
    });
  }
}

function getSamplePayload(eventType: string): any {
  const samplePayloads: Record<string, any> = {
    'customer.created': {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Customer',
      email: 'test@example.com',
      phone: '+54 11 1234-5678',
      created_at: new Date().toISOString(),
    },
    'job.created': {
      id: '550e8400-e29b-41d4-a716-446655440001',
      customer_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Test Job',
      status: 'pending',
      scheduled_start: new Date().toISOString(),
    },
    'job.completed': {
      id: '550e8400-e29b-41d4-a716-446655440001',
      customer_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Test Job',
      status: 'completed',
      completed_at: new Date().toISOString(),
    },
    'invoice.paid': {
      id: '550e8400-e29b-41d4-a716-446655440002',
      invoice_number: 'INV-2024-000001',
      customer_id: '550e8400-e29b-41d4-a716-446655440000',
      total: 15000,
      paid_at: new Date().toISOString(),
    },
    'payment.completed': {
      id: '550e8400-e29b-41d4-a716-446655440003',
      invoice_id: '550e8400-e29b-41d4-a716-446655440002',
      amount: 15000,
      payment_method: 'card',
      completed_at: new Date().toISOString(),
    },
  };

  return samplePayloads[eventType] || { sample: true, event: eventType };
}
