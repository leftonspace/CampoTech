/**
 * Developer Console Service
 * ==========================
 *
 * Service for managing developer applications, API keys, and OAuth clients.
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import {
  DeveloperApp,
  DeveloperApiKey,
  DeveloperOAuthClient,
  DeveloperWebhook,
} from './portal.types';
import { ApiKeyService } from '../auth/api-key.service';
import { OAuth2Service } from '../auth/oauth2.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateAppOptions {
  orgId: string;
  userId: string;
  name: string;
  description?: string;
  type?: 'personal' | 'organization';
}

export interface AppWithCredentials {
  app: DeveloperApp;
  apiKey?: { key: DeveloperApiKey; fullKey: string };
  oauthClient?: { client: DeveloperOAuthClient; clientSecret: string };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEVELOPER CONSOLE SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class DeveloperConsoleService {
  private apiKeyService: ApiKeyService;
  private oauth2Service: OAuth2Service;

  constructor(private pool: Pool) {
    this.apiKeyService = new ApiKeyService(pool);
    this.oauth2Service = new OAuth2Service(pool);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // APPLICATION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new developer application
   */
  async createApp(options: CreateAppOptions): Promise<AppWithCredentials> {
    const { orgId, userId, name, description, type = 'personal' } = options;

    // Create app record
    const appResult = await this.pool.query(
      `INSERT INTO developer_apps (org_id, user_id, name, description, type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [orgId, userId, name, description || null, type]
    );

    const app = this.mapRowToApp(appResult.rows[0]);

    // Create initial API key
    const { apiKey, fullKey } = await this.apiKeyService.createApiKey({
      orgId,
      name: `${name} - Default Key`,
      scopes: ['read:customers', 'read:jobs', 'read:invoices'],
      createdBy: userId,
    });

    // Link API key to app
    await this.pool.query(
      `UPDATE api_keys SET app_id = $1 WHERE id = $2`,
      [app.id, apiKey.id]
    );

    return {
      app,
      apiKey: {
        key: this.mapApiKeyToDevKey(apiKey, app.id),
        fullKey,
      },
    };
  }

  /**
   * Get application by ID
   */
  async getApp(appId: string, orgId: string): Promise<DeveloperApp | null> {
    const result = await this.pool.query(
      `SELECT * FROM developer_apps WHERE id = $1 AND org_id = $2`,
      [appId, orgId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToApp(result.rows[0]);
  }

  /**
   * Get application with all credentials
   */
  async getAppWithCredentials(appId: string, orgId: string): Promise<DeveloperApp | null> {
    const app = await this.getApp(appId, orgId);
    if (!app) return null;

    // Get API keys
    const keysResult = await this.pool.query(
      `SELECT * FROM api_keys WHERE app_id = $1 AND is_active = true`,
      [appId]
    );
    app.api_keys = keysResult.rows.map(r => this.mapApiKeyToDevKey(r, appId));

    // Get OAuth clients
    const clientsResult = await this.pool.query(
      `SELECT * FROM oauth2_clients WHERE app_id = $1 AND is_active = true`,
      [appId]
    );
    app.oauth_clients = clientsResult.rows.map(r => this.mapOAuthClientToDevClient(r, appId));

    // Get webhooks
    const webhooksResult = await this.pool.query(
      `SELECT * FROM webhooks WHERE app_id = $1`,
      [appId]
    );
    app.webhooks = webhooksResult.rows.map(r => this.mapWebhookToDevWebhook(r, appId));

    return app;
  }

  /**
   * List all applications for an organization
   */
  async listApps(orgId: string, userId?: string): Promise<DeveloperApp[]> {
    let query = `SELECT * FROM developer_apps WHERE org_id = $1`;
    const values: any[] = [orgId];

    if (userId) {
      query += ` AND (user_id = $2 OR type = 'organization')`;
      values.push(userId);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.pool.query(query, values);
    return result.rows.map(this.mapRowToApp);
  }

  /**
   * Update application
   */
  async updateApp(
    appId: string,
    orgId: string,
    updates: { name?: string; description?: string }
  ): Promise<DeveloperApp | null> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }

    values.push(appId, orgId);

    const result = await this.pool.query(
      `UPDATE developer_apps
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex++} AND org_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToApp(result.rows[0]);
  }

  /**
   * Delete application and all associated credentials
   */
  async deleteApp(appId: string, orgId: string): Promise<boolean> {
    // Delete associated API keys
    await this.pool.query(
      `UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE app_id = $1`,
      [appId]
    );

    // Delete associated OAuth clients
    await this.pool.query(
      `UPDATE oauth2_clients SET is_active = false, updated_at = NOW() WHERE app_id = $1`,
      [appId]
    );

    // Delete associated webhooks
    await this.pool.query(
      `UPDATE webhooks SET enabled = false WHERE app_id = $1`,
      [appId]
    );

    // Soft delete the app
    const result = await this.pool.query(
      `UPDATE developer_apps
       SET deleted_at = NOW()
       WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [appId, orgId]
    );

    return result.rows.length > 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // API KEY MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create new API key for an application
   */
  async createApiKey(
    appId: string,
    orgId: string,
    options: {
      name: string;
      scopes: string[];
      rateLimit?: number;
      expiresAt?: Date;
    }
  ): Promise<{ key: DeveloperApiKey; fullKey: string }> {
    const { apiKey, fullKey } = await this.apiKeyService.createApiKey({
      orgId,
      name: options.name,
      scopes: options.scopes,
      rateLimit: options.rateLimit,
      expiresAt: options.expiresAt,
    });

    // Link to app
    await this.pool.query(
      `UPDATE api_keys SET app_id = $1 WHERE id = $2`,
      [appId, apiKey.id]
    );

    return {
      key: this.mapApiKeyToDevKey(apiKey, appId),
      fullKey,
    };
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(keyId: string, orgId: string): Promise<boolean> {
    return this.apiKeyService.revokeApiKey(keyId, orgId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // OAUTH CLIENT MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create OAuth client for an application
   */
  async createOAuthClient(
    appId: string,
    orgId: string,
    options: {
      name: string;
      redirectUris: string[];
      allowedGrantTypes: ('authorization_code' | 'client_credentials' | 'refresh_token')[];
      scopes: string[];
    }
  ): Promise<{ client: DeveloperOAuthClient; clientSecret: string }> {
    const { client, clientSecret } = await this.oauth2Service.createClient({
      orgId,
      name: options.name,
      redirectUris: options.redirectUris,
      allowedGrantTypes: options.allowedGrantTypes,
      scopes: options.scopes,
    });

    // Link to app
    await this.pool.query(
      `UPDATE oauth2_clients SET app_id = $1 WHERE id = $2`,
      [appId, client.id]
    );

    return {
      client: this.mapOAuthClientToDevClient(client, appId),
      clientSecret,
    };
  }

  /**
   * Rotate OAuth client secret
   */
  async rotateClientSecret(
    clientId: string,
    orgId: string
  ): Promise<{ clientSecret: string } | null> {
    const result = await this.oauth2Service.rotateClientSecret(clientId, orgId);
    if (!result) return null;
    return { clientSecret: result.newSecret };
  }

  /**
   * Revoke OAuth client
   */
  async revokeOAuthClient(clientId: string, orgId: string): Promise<boolean> {
    return this.oauth2Service.revokeClient(clientId, orgId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // USAGE STATISTICS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get API usage statistics for an application
   */
  async getAppUsageStats(
    appId: string,
    orgId: string,
    period: 'day' | 'week' | 'month' = 'month'
  ): Promise<any> {
    const periodFilter = {
      day: `created_at >= NOW() - INTERVAL '1 day'`,
      week: `created_at >= NOW() - INTERVAL '7 days'`,
      month: `created_at >= NOW() - INTERVAL '30 days'`,
    }[period];

    // Get API keys for this app
    const keysResult = await this.pool.query(
      `SELECT id FROM api_keys WHERE app_id = $1`,
      [appId]
    );
    const keyIds = keysResult.rows.map(r => r.id);

    if (keyIds.length === 0) {
      return {
        total_requests: 0,
        requests_by_endpoint: [],
        requests_by_status: [],
        average_latency: 0,
      };
    }

    const statsQuery = `
      SELECT
        COUNT(*) as total_requests,
        AVG(duration_ms) as average_latency,
        COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as successful,
        COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500) as client_errors,
        COUNT(*) FILTER (WHERE status_code >= 500) as server_errors
      FROM api_usage_logs
      WHERE api_key_id = ANY($1) AND ${periodFilter}
    `;

    const endpointQuery = `
      SELECT path, method, COUNT(*) as count
      FROM api_usage_logs
      WHERE api_key_id = ANY($1) AND ${periodFilter}
      GROUP BY path, method
      ORDER BY count DESC
      LIMIT 10
    `;

    const [statsResult, endpointResult] = await Promise.all([
      this.pool.query(statsQuery, [keyIds]),
      this.pool.query(endpointQuery, [keyIds]),
    ]);

    const stats = statsResult.rows[0];

    return {
      total_requests: parseInt(stats.total_requests),
      average_latency_ms: Math.round(parseFloat(stats.average_latency) || 0),
      requests_by_status: {
        successful: parseInt(stats.successful),
        client_errors: parseInt(stats.client_errors),
        server_errors: parseInt(stats.server_errors),
      },
      top_endpoints: endpointResult.rows.map(r => ({
        path: r.path,
        method: r.method,
        count: parseInt(r.count),
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private mapRowToApp(row: any): DeveloperApp {
    return {
      id: row.id,
      org_id: row.org_id,
      name: row.name,
      description: row.description,
      type: row.type,
      api_keys: [],
      oauth_clients: [],
      webhooks: [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapApiKeyToDevKey(key: any, appId: string): DeveloperApiKey {
    return {
      id: key.id,
      app_id: appId,
      name: key.name,
      key_prefix: key.key_prefix,
      scopes: key.scopes || [],
      rate_limit: key.rate_limit,
      expires_at: key.expires_at,
      last_used_at: key.last_used_at,
      is_active: key.is_active,
      created_at: key.created_at,
    };
  }

  private mapOAuthClientToDevClient(client: any, appId: string): DeveloperOAuthClient {
    return {
      id: client.id,
      app_id: appId,
      name: client.name,
      client_id: client.client_id,
      redirect_uris: client.redirect_uris || [],
      allowed_grant_types: client.allowed_grant_types || [],
      scopes: client.scopes || [],
      is_active: client.is_active,
      created_at: client.created_at,
    };
  }

  private mapWebhookToDevWebhook(webhook: any, appId: string): DeveloperWebhook {
    return {
      id: webhook.id,
      app_id: appId,
      url: webhook.url,
      events: webhook.events || [],
      enabled: webhook.enabled,
      last_delivery_at: webhook.last_delivery_at,
      last_delivery_status: webhook.last_delivery_status,
      created_at: webhook.created_at,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createConsoleService(pool: Pool): DeveloperConsoleService {
  return new DeveloperConsoleService(pool);
}
