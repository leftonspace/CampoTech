/**
 * API Key Service
 * ================
 *
 * Service for managing API keys - generation, validation, rotation, and revocation.
 */

import { Pool } from 'pg';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiKey {
  id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  rate_limit: number | null;
  expires_at: Date | null;
  last_used_at: Date | null;
  last_used_ip: string | null;
  is_active: boolean;
  metadata: Record<string, any> | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateApiKeyOptions {
  orgId: string;
  name: string;
  scopes: string[];
  rateLimit?: number;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  createdBy?: string;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: ApiKey;
  error?: string;
}

export interface ApiKeyUsageStats {
  totalRequests: number;
  requestsToday: number;
  requestsThisMonth: number;
  lastUsed: Date | null;
  topEndpoints: Array<{ path: string; count: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ApiKeyService {
  constructor(private pool: Pool) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // KEY GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate a new API key
   * Returns the full key only once - must be stored by the client
   */
  async createApiKey(options: CreateApiKeyOptions): Promise<{ apiKey: ApiKey; fullKey: string }> {
    const { orgId, name, scopes, rateLimit, expiresAt, metadata, createdBy } = options;

    // Generate key components
    const keyPrefix = this.generateKeyPrefix();
    const keySecret = this.generateKeySecret();
    const fullKey = `${keyPrefix}_${keySecret}`;
    const keyHash = this.hashKey(fullKey);

    const query = `
      INSERT INTO api_keys (
        org_id, name, key_prefix, key_hash, scopes,
        rate_limit, expires_at, is_active, metadata,
        created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      orgId,
      name,
      keyPrefix,
      keyHash,
      scopes,
      rateLimit || null,
      expiresAt || null,
      metadata ? JSON.stringify(metadata) : null,
      createdBy || null,
    ];

    const result = await this.pool.query(query, values);
    const apiKey = this.mapRowToApiKey(result.rows[0]);

    return { apiKey, fullKey };
  }

  /**
   * Generate multiple API keys at once
   */
  async createApiKeys(
    optionsList: CreateApiKeyOptions[]
  ): Promise<Array<{ apiKey: ApiKey; fullKey: string }>> {
    const results: Array<{ apiKey: ApiKey; fullKey: string }> = [];

    for (const options of optionsList) {
      const result = await this.createApiKey(options);
      results.push(result);
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // KEY VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Validate an API key and return the associated data
   */
  async validateApiKey(key: string): Promise<ApiKeyValidationResult> {
    if (!key || !this.isValidKeyFormat(key)) {
      return { valid: false, error: 'Invalid key format' };
    }

    const keyHash = this.hashKey(key);

    const query = `
      SELECT * FROM api_keys
      WHERE key_hash = $1
    `;

    const result = await this.pool.query(query, [keyHash]);

    if (result.rows.length === 0) {
      return { valid: false, error: 'Key not found' };
    }

    const apiKey = this.mapRowToApiKey(result.rows[0]);

    // Check if active
    if (!apiKey.is_active) {
      return { valid: false, error: 'Key is inactive' };
    }

    // Check expiration
    if (apiKey.expires_at && new Date() > apiKey.expires_at) {
      return { valid: false, error: 'Key has expired' };
    }

    return { valid: true, apiKey };
  }

  /**
   * Update last used timestamp and IP
   */
  async recordKeyUsage(keyId: string, ipAddress?: string): Promise<void> {
    await this.pool.query(
      `UPDATE api_keys
       SET last_used_at = NOW(), last_used_ip = $2, updated_at = NOW()
       WHERE id = $1`,
      [keyId, ipAddress || null]
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // KEY MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get API key by ID
   */
  async getApiKey(keyId: string, orgId: string): Promise<ApiKey | null> {
    const result = await this.pool.query(
      'SELECT * FROM api_keys WHERE id = $1 AND org_id = $2',
      [keyId, orgId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToApiKey(result.rows[0]);
  }

  /**
   * List all API keys for an organization
   */
  async listApiKeys(
    orgId: string,
    options?: {
      includeInactive?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ keys: ApiKey[]; total: number }> {
    const { includeInactive = false, limit = 50, offset = 0 } = options || {};

    const conditions = ['org_id = $1'];
    if (!includeInactive) {
      conditions.push('is_active = true');
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM api_keys
      WHERE ${conditions.join(' AND ')}
    `;

    const listQuery = `
      SELECT *
      FROM api_keys
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const [countResult, listResult] = await Promise.all([
      this.pool.query(countQuery, [orgId]),
      this.pool.query(listQuery, [orgId, limit, offset]),
    ]);

    return {
      keys: listResult.rows.map(this.mapRowToApiKey),
      total: parseInt(countResult.rows[0].total),
    };
  }

  /**
   * Update API key properties
   */
  async updateApiKey(
    keyId: string,
    orgId: string,
    updates: {
      name?: string;
      scopes?: string[];
      rateLimit?: number | null;
      expiresAt?: Date | null;
      metadata?: Record<string, any>;
    }
  ): Promise<ApiKey | null> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }

    if (updates.scopes !== undefined) {
      setClauses.push(`scopes = $${paramIndex++}`);
      values.push(updates.scopes);
    }

    if (updates.rateLimit !== undefined) {
      setClauses.push(`rate_limit = $${paramIndex++}`);
      values.push(updates.rateLimit);
    }

    if (updates.expiresAt !== undefined) {
      setClauses.push(`expires_at = $${paramIndex++}`);
      values.push(updates.expiresAt);
    }

    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    values.push(keyId, orgId);

    const query = `
      UPDATE api_keys
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex++} AND org_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) return null;
    return this.mapRowToApiKey(result.rows[0]);
  }

  /**
   * Rotate an API key - creates new key, invalidates old one
   */
  async rotateApiKey(
    keyId: string,
    orgId: string
  ): Promise<{ newApiKey: ApiKey; fullKey: string } | null> {
    // Get existing key
    const existing = await this.getApiKey(keyId, orgId);
    if (!existing) return null;

    // Create new key with same settings
    const { apiKey: newApiKey, fullKey } = await this.createApiKey({
      orgId,
      name: `${existing.name} (rotated)`,
      scopes: existing.scopes,
      rateLimit: existing.rate_limit || undefined,
      expiresAt: existing.expires_at || undefined,
      metadata: {
        ...existing.metadata,
        rotated_from: existing.id,
        rotated_at: new Date().toISOString(),
      },
    });

    // Deactivate old key
    await this.revokeApiKey(keyId, orgId);

    return { newApiKey, fullKey };
  }

  /**
   * Revoke (deactivate) an API key
   */
  async revokeApiKey(keyId: string, orgId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE api_keys
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND org_id = $2
       RETURNING id`,
      [keyId, orgId]
    );

    return result.rows.length > 0;
  }

  /**
   * Permanently delete an API key
   */
  async deleteApiKey(keyId: string, orgId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM api_keys WHERE id = $1 AND org_id = $2 RETURNING id',
      [keyId, orgId]
    );

    return result.rows.length > 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // USAGE STATISTICS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get usage statistics for an API key
   */
  async getKeyUsageStats(keyId: string, orgId: string): Promise<ApiKeyUsageStats | null> {
    // Verify key belongs to org
    const keyCheck = await this.pool.query(
      'SELECT id, last_used_at FROM api_keys WHERE id = $1 AND org_id = $2',
      [keyId, orgId]
    );

    if (keyCheck.rows.length === 0) return null;

    const statsQuery = `
      SELECT
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as requests_today,
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) as requests_month
      FROM api_usage_logs
      WHERE api_key_id = $1
    `;

    const topEndpointsQuery = `
      SELECT path, COUNT(*) as count
      FROM api_usage_logs
      WHERE api_key_id = $1
      GROUP BY path
      ORDER BY count DESC
      LIMIT 10
    `;

    const [statsResult, endpointsResult] = await Promise.all([
      this.pool.query(statsQuery, [keyId]),
      this.pool.query(topEndpointsQuery, [keyId]),
    ]);

    const stats = statsResult.rows[0];

    return {
      totalRequests: parseInt(stats.total_requests),
      requestsToday: parseInt(stats.requests_today),
      requestsThisMonth: parseInt(stats.requests_month),
      lastUsed: keyCheck.rows[0].last_used_at,
      topEndpoints: endpointsResult.rows.map((r: any) => ({
        path: r.path,
        count: parseInt(r.count),
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private generateKeyPrefix(): string {
    // Format: ct_live or ct_test
    const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
    return `ct_${env}`;
  }

  private generateKeySecret(): string {
    // 32 bytes = 64 hex characters
    return crypto.randomBytes(32).toString('hex');
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  private isValidKeyFormat(key: string): boolean {
    // Expected format: ct_live_<64 hex chars> or ct_test_<64 hex chars>
    const pattern = /^ct_(live|test)_[a-f0-9]{64}$/;
    return pattern.test(key);
  }

  private mapRowToApiKey(row: any): ApiKey {
    return {
      id: row.id,
      org_id: row.org_id,
      name: row.name,
      key_prefix: row.key_prefix,
      key_hash: row.key_hash,
      scopes: row.scopes || [],
      rate_limit: row.rate_limit,
      expires_at: row.expires_at,
      last_used_at: row.last_used_at,
      last_used_ip: row.last_used_ip,
      is_active: row.is_active,
      metadata: row.metadata,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createApiKeyService(pool: Pool): ApiKeyService {
  return new ApiKeyService(pool);
}
