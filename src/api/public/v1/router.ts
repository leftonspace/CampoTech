/**
 * Public API v1 Router
 * =====================
 *
 * Main router for the public API version 1.
 * Combines all resource endpoints and applies common middleware.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import {
  createApiKeyMiddleware,
  createRateLimitMiddleware,
  versionExtractionMiddleware,
} from '../middleware';
import { createCustomersController } from './customers/customers.controller';
import { createJobsController } from './jobs/jobs.controller';
import { createInvoicesController } from './invoices/invoices.controller';
import { createPaymentsController } from './payments/payments.controller';
import { createWebhooksController } from './webhooks/webhooks.controller';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PublicApiConfig {
  pool: Pool;
  basePath?: string;
  enableRateLimiting?: boolean;
  rateLimitDefaults?: {
    windowMs?: number;
    maxRequests?: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createPublicApiV1Router(config: PublicApiConfig): Router {
  const router = Router();
  const { pool, enableRateLimiting = true, rateLimitDefaults } = config;

  // ─────────────────────────────────────────────────────────────────────────────
  // COMMON MIDDLEWARE
  // ─────────────────────────────────────────────────────────────────────────────

  // Version extraction
  router.use(versionExtractionMiddleware);

  // API Key authentication
  router.use(createApiKeyMiddleware(pool));

  // Rate limiting
  if (enableRateLimiting) {
    router.use(createRateLimitMiddleware(pool, {
      windowMs: rateLimitDefaults?.windowMs || 60000,
      maxRequests: rateLimitDefaults?.maxRequests || 1000,
    }));
  }

  // Request logging
  router.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || generateRequestId();

    // Add request ID to response
    res.setHeader('X-Request-ID', requestId);

    // Log request completion
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const apiContext = (req as any).apiContext;

      // Log API usage (async, don't wait)
      if (apiContext?.orgId) {
        logApiUsage(pool, {
          orgId: apiContext.orgId,
          apiKeyId: apiContext.apiKeyId,
          oauthClientId: apiContext.oauthClientId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: duration,
          requestId: requestId as string,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
        }).catch(console.error);
      }
    });

    next();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // API INFO ENDPOINT
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        name: 'CampoTech Public API',
        version: 'v1',
        documentation: 'https://developers.campotech.com/docs',
        endpoints: {
          customers: '/v1/customers',
          jobs: '/v1/jobs',
          invoices: '/v1/invoices',
          payments: '/v1/payments',
          webhooks: '/v1/webhooks',
        },
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // RESOURCE ROUTES
  // ─────────────────────────────────────────────────────────────────────────────

  router.use('/customers', createCustomersController(pool));
  router.use('/jobs', createJobsController(pool));
  router.use('/invoices', createInvoicesController(pool));
  router.use('/payments', createPaymentsController(pool));
  router.use('/webhooks', createWebhooksController(pool));

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITY ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  // Health check
  router.get('/health', async (req: Request, res: Response) => {
    try {
      await pool.query('SELECT 1');
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database connection failed',
        },
      });
    }
  });

  // Echo endpoint (for testing)
  router.post('/echo', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        method: req.method,
        path: req.path,
        headers: sanitizeHeaders(req.headers),
        query: req.query,
        body: req.body,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Rate limit status
  router.get('/rate-limit', (req: Request, res: Response) => {
    const rateLimitInfo = (req as any).rateLimit;
    res.json({
      success: true,
      data: rateLimitInfo || {
        message: 'Rate limiting not enabled',
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ERROR HANDLING
  // ─────────────────────────────────────────────────────────────────────────────

  // 404 handler
  router.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.path} not found`,
        documentation: 'https://developers.campotech.com/docs',
      },
    });
  });

  // Error handler
  router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('[Public API] Error:', err);

    // Handle known error types
    if (err.name === 'UnauthorizedError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing authentication',
        },
      });
    }

    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message,
        },
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        request_id: res.getHeader('X-Request-ID'),
      },
    });
  });

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

interface ApiUsageLog {
  orgId: string;
  apiKeyId?: string;
  oauthClientId?: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  requestId: string;
  userAgent?: string;
  ipAddress?: string;
}

async function logApiUsage(pool: Pool, log: ApiUsageLog): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO api_usage_logs (
        org_id, api_key_id, oauth_client_id,
        method, path, status_code, duration_ms,
        request_id, user_agent, ip_address, created_at
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7,
        $8, $9, $10, NOW()
      )`,
      [
        log.orgId,
        log.apiKeyId || null,
        log.oauthClientId || null,
        log.method,
        log.path,
        log.statusCode,
        log.durationMs,
        log.requestId,
        log.userAgent || null,
        log.ipAddress || null,
      ]
    );
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('[API Usage] Failed to log:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { createCustomersController } from './customers/customers.controller';
export { createJobsController } from './jobs/jobs.controller';
export { createInvoicesController } from './invoices/invoices.controller';
export { createPaymentsController } from './payments/payments.controller';
export { createWebhooksController } from './webhooks/webhooks.controller';
