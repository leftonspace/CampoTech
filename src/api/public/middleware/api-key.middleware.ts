/**
 * API Key Middleware
 * ==================
 *
 * Middleware for API key authentication and validation.
 */

import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import { ApiRequestContext, ApiKey } from '../public-api.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const API_KEY_HEADER = 'X-API-Key';
const API_KEY_QUERY_PARAM = 'api_key';
const API_KEY_PREFIX = 'ct_';

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

export function createApiKeyMiddleware(pool: Pool) {
  return async function apiKeyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Extract API key from header or query parameter
      const apiKey = extractApiKey(req);

      if (!apiKey) {
        res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_API_KEY',
            message: 'API key is required. Provide it via X-API-Key header or api_key query parameter.',
          },
        });
        return;
      }

      // Validate format
      if (!apiKey.startsWith(API_KEY_PREFIX)) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_API_KEY_FORMAT',
            message: 'Invalid API key format.',
          },
        });
        return;
      }

      // Hash the key for lookup
      const keyHash = hashApiKey(apiKey);
      const keyPrefix = apiKey.substring(0, 11); // ct_ + 8 chars

      // Look up the key
      const keyResult = await pool.query<ApiKey>(
        `
        SELECT
          id, org_id, name, key_hash, key_prefix, scopes, rate_limit,
          last_used_at, expires_at, is_active, created_at, created_by, metadata
        FROM api_keys
        WHERE key_prefix = $1 AND key_hash = $2
        `,
        [keyPrefix, keyHash]
      );

      if (keyResult.rows.length === 0) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid or unknown API key.',
          },
        });
        return;
      }

      const keyRecord = mapRowToApiKey(keyResult.rows[0]);

      // Check if key is active
      if (!keyRecord.isActive) {
        res.status(401).json({
          success: false,
          error: {
            code: 'API_KEY_INACTIVE',
            message: 'This API key has been deactivated.',
          },
        });
        return;
      }

      // Check if key has expired
      if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
        res.status(401).json({
          success: false,
          error: {
            code: 'API_KEY_EXPIRED',
            message: 'This API key has expired.',
          },
        });
        return;
      }

      // Update last used timestamp (async, don't wait)
      updateLastUsed(pool, keyRecord.id).catch((err) =>
        console.error('[ApiKeyMiddleware] Failed to update last_used_at:', err)
      );

      // Attach context to request
      const context: ApiRequestContext = {
        requestId: generateRequestId(),
        orgId: keyRecord.orgId,
        authenticationType: 'api_key',
        apiKeyId: keyRecord.id,
        scopes: keyRecord.scopes,
        ipAddress: getClientIp(req),
        userAgent: req.get('User-Agent'),
        timestamp: new Date(),
      };

      (req as any).apiContext = context;
      (req as any).apiKey = keyRecord;

      // Add request ID to response headers
      res.setHeader('X-Request-ID', context.requestId);

      next();
    } catch (error) {
      console.error('[ApiKeyMiddleware] Error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'An error occurred during authentication.',
        },
      });
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function extractApiKey(req: Request): string | null {
  // Check header first
  const headerKey = req.get(API_KEY_HEADER);
  if (headerKey) return headerKey;

  // Check query parameter
  const queryKey = req.query[API_KEY_QUERY_PARAM] as string;
  if (queryKey) return queryKey;

  // Check Authorization header (Bearer token format)
  const authHeader = req.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token.startsWith(API_KEY_PREFIX)) {
      return token;
    }
  }

  return null;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const hash = hashApiKey(key);
  const prefix = key.substring(0, 11);

  return { key, hash, prefix };
}

function generateRequestId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

async function updateLastUsed(pool: Pool, keyId: string): Promise<void> {
  await pool.query(
    'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
    [keyId]
  );
}

function mapRowToApiKey(row: any): ApiKey {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    keyHash: row.key_hash,
    keyPrefix: row.key_prefix,
    scopes: row.scopes || [],
    rateLimit: row.rate_limit || 60,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    createdBy: row.created_by,
    metadata: row.metadata,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPTIONAL API KEY (for endpoints that support both auth and public access)
// ═══════════════════════════════════════════════════════════════════════════════

export function createOptionalApiKeyMiddleware(pool: Pool) {
  const requireApiKey = createApiKeyMiddleware(pool);

  return async function optionalApiKeyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      // No API key provided, continue without auth
      (req as any).apiContext = {
        requestId: generateRequestId(),
        authenticationType: null,
        scopes: [],
        ipAddress: getClientIp(req),
        userAgent: req.get('User-Agent'),
        timestamp: new Date(),
      };
      res.setHeader('X-Request-ID', (req as any).apiContext.requestId);
      next();
      return;
    }

    // API key provided, validate it
    await requireApiKey(req, res, next);
  };
}
