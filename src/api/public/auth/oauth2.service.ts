/**
 * OAuth 2.0 Service
 * ==================
 *
 * Service for OAuth 2.0 authorization server functionality.
 * Supports authorization code flow (with PKCE) and client credentials flow.
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import {
  OAuth2Client,
  CreateOAuth2ClientOptions,
  OAuth2GrantType,
  AuthorizationCode,
  AuthorizationRequest,
  OAuth2Token,
  TokenResponse,
  TokenRequest,
  TokenIntrospectionResponse,
  OAuth2Exception,
  OAuth2Config,
  DEFAULT_OAUTH2_CONFIG,
  ConsentRecord,
} from './oauth2.types';

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class OAuth2Service {
  private config: OAuth2Config;

  constructor(
    private pool: Pool,
    config?: Partial<OAuth2Config>
  ) {
    this.config = { ...DEFAULT_OAUTH2_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CLIENT MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Register a new OAuth2 client
   */
  async createClient(
    options: CreateOAuth2ClientOptions
  ): Promise<{ client: OAuth2Client; clientSecret: string }> {
    const clientId = this.generateClientId();
    const clientSecret = this.generateClientSecret();
    const clientSecretHash = this.hashSecret(clientSecret);

    const query = `
      INSERT INTO oauth2_clients (
        org_id, name, client_id, client_secret_hash,
        redirect_uris, allowed_grant_types, scopes,
        is_confidential, is_active, metadata,
        logo_url, homepage_url, privacy_policy_url, terms_of_service_url,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, true, $9,
        $10, $11, $12, $13,
        NOW(), NOW()
      )
      RETURNING *
    `;

    const values = [
      options.orgId,
      options.name,
      clientId,
      clientSecretHash,
      options.redirectUris,
      options.allowedGrantTypes,
      options.scopes,
      options.isConfidential ?? true,
      options.metadata ? JSON.stringify(options.metadata) : null,
      options.logoUrl || null,
      options.homepageUrl || null,
      options.privacyPolicyUrl || null,
      options.termsOfServiceUrl || null,
    ];

    const result = await this.pool.query(query, values);
    const client = this.mapRowToClient(result.rows[0]);

    return { client, clientSecret };
  }

  /**
   * Get client by client_id
   */
  async getClientByClientId(clientId: string): Promise<OAuth2Client | null> {
    const result = await this.pool.query(
      'SELECT * FROM oauth2_clients WHERE client_id = $1',
      [clientId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToClient(result.rows[0]);
  }

  /**
   * Validate client credentials
   */
  async validateClientCredentials(
    clientId: string,
    clientSecret: string
  ): Promise<OAuth2Client | null> {
    const client = await this.getClientByClientId(clientId);
    if (!client || !client.is_active) return null;

    const secretHash = this.hashSecret(clientSecret);
    if (secretHash !== client.client_secret_hash) return null;

    return client;
  }

  /**
   * List clients for an organization
   */
  async listClients(orgId: string): Promise<OAuth2Client[]> {
    const result = await this.pool.query(
      'SELECT * FROM oauth2_clients WHERE org_id = $1 ORDER BY created_at DESC',
      [orgId]
    );

    return result.rows.map(this.mapRowToClient);
  }

  /**
   * Rotate client secret
   */
  async rotateClientSecret(
    clientId: string,
    orgId: string
  ): Promise<{ client: OAuth2Client; newSecret: string } | null> {
    const newSecret = this.generateClientSecret();
    const newSecretHash = this.hashSecret(newSecret);

    const result = await this.pool.query(
      `UPDATE oauth2_clients
       SET client_secret_hash = $1, updated_at = NOW()
       WHERE client_id = $2 AND org_id = $3
       RETURNING *`,
      [newSecretHash, clientId, orgId]
    );

    if (result.rows.length === 0) return null;

    return {
      client: this.mapRowToClient(result.rows[0]),
      newSecret,
    };
  }

  /**
   * Revoke a client (disable all tokens)
   */
  async revokeClient(clientId: string, orgId: string): Promise<boolean> {
    const client = await this.pool.query(
      `UPDATE oauth2_clients
       SET is_active = false, updated_at = NOW()
       WHERE client_id = $1 AND org_id = $2
       RETURNING id`,
      [clientId, orgId]
    );

    if (client.rows.length === 0) return false;

    // Revoke all tokens for this client
    await this.pool.query(
      `UPDATE oauth2_tokens
       SET revoked_at = NOW()
       WHERE client_id = $1 AND revoked_at IS NULL`,
      [clientId]
    );

    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTHORIZATION CODE FLOW
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Validate an authorization request
   */
  async validateAuthorizationRequest(request: AuthorizationRequest): Promise<OAuth2Client> {
    const client = await this.getClientByClientId(request.clientId);

    if (!client || !client.is_active) {
      throw new OAuth2Exception('invalid_client', 'Client not found or inactive');
    }

    if (!client.allowed_grant_types.includes('authorization_code')) {
      throw new OAuth2Exception('unauthorized_client', 'Client not authorized for authorization code flow');
    }

    if (!client.redirect_uris.includes(request.redirectUri)) {
      throw new OAuth2Exception('invalid_request', 'Invalid redirect URI');
    }

    // Validate scopes
    const invalidScopes = request.scopes.filter(s => !client.scopes.includes(s));
    if (invalidScopes.length > 0) {
      throw new OAuth2Exception('invalid_scope', `Invalid scopes: ${invalidScopes.join(', ')}`);
    }

    // Validate PKCE if required
    if (this.config.requirePkce && !request.codeChallenge) {
      throw new OAuth2Exception('invalid_request', 'PKCE code_challenge is required');
    }

    if (request.codeChallenge && request.codeChallengeMethod !== 'S256') {
      throw new OAuth2Exception('invalid_request', 'Only S256 code_challenge_method is supported');
    }

    return client;
  }

  /**
   * Create authorization code after user consent
   */
  async createAuthorizationCode(
    clientId: string,
    userId: string,
    orgId: string,
    redirectUri: string,
    scopes: string[],
    codeChallenge?: string,
    codeChallengeMethod?: 'plain' | 'S256'
  ): Promise<string> {
    const code = this.generateAuthorizationCode();
    const expiresAt = new Date(Date.now() + this.config.authorizationCodeTtl * 1000);

    await this.pool.query(
      `INSERT INTO oauth2_authorization_codes (
        code, client_id, user_id, org_id, redirect_uri, scopes,
        code_challenge, code_challenge_method, expires_at, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        code,
        clientId,
        userId,
        orgId,
        redirectUri,
        scopes,
        codeChallenge || null,
        codeChallengeMethod || null,
        expiresAt,
      ]
    );

    return code;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeAuthorizationCode(
    code: string,
    clientId: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<TokenResponse> {
    // Get and validate authorization code
    const codeResult = await this.pool.query(
      `SELECT * FROM oauth2_authorization_codes
       WHERE code = $1 AND client_id = $2 AND redirect_uri = $3
       AND used_at IS NULL AND expires_at > NOW()`,
      [code, clientId, redirectUri]
    );

    if (codeResult.rows.length === 0) {
      throw new OAuth2Exception('invalid_grant', 'Invalid or expired authorization code');
    }

    const authCode = codeResult.rows[0] as AuthorizationCode;

    // Validate PKCE
    if (authCode.code_challenge) {
      if (!codeVerifier) {
        throw new OAuth2Exception('invalid_grant', 'code_verifier is required');
      }

      const expectedChallenge = this.generateCodeChallenge(codeVerifier);
      if (expectedChallenge !== authCode.code_challenge) {
        throw new OAuth2Exception('invalid_grant', 'Invalid code_verifier');
      }
    }

    // Mark code as used
    await this.pool.query(
      'UPDATE oauth2_authorization_codes SET used_at = NOW() WHERE code = $1',
      [code]
    );

    // Generate tokens
    return this.createTokens(
      clientId,
      authCode.user_id,
      authCode.org_id,
      authCode.scopes,
      authCode.scopes.includes('offline_access')
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CLIENT CREDENTIALS FLOW
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Issue tokens using client credentials
   */
  async clientCredentialsGrant(
    clientId: string,
    clientSecret: string,
    scopes?: string[]
  ): Promise<TokenResponse> {
    const client = await this.validateClientCredentials(clientId, clientSecret);

    if (!client) {
      throw new OAuth2Exception('invalid_client', 'Invalid client credentials');
    }

    if (!client.allowed_grant_types.includes('client_credentials')) {
      throw new OAuth2Exception('unauthorized_client', 'Client not authorized for client credentials flow');
    }

    // Validate requested scopes
    const requestedScopes = scopes || client.scopes;
    const invalidScopes = requestedScopes.filter(s => !client.scopes.includes(s));
    if (invalidScopes.length > 0) {
      throw new OAuth2Exception('invalid_scope', `Invalid scopes: ${invalidScopes.join(', ')}`);
    }

    // Generate access token only (no refresh token for client credentials)
    return this.createTokens(clientId, null, client.org_id, requestedScopes, false);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REFRESH TOKEN FLOW
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret?: string
  ): Promise<TokenResponse> {
    // Validate client if secret provided
    if (clientSecret) {
      const client = await this.validateClientCredentials(clientId, clientSecret);
      if (!client) {
        throw new OAuth2Exception('invalid_client', 'Invalid client credentials');
      }
    }

    const refreshTokenHash = this.hashSecret(refreshToken);

    // Get token
    const tokenResult = await this.pool.query(
      `SELECT * FROM oauth2_tokens
       WHERE refresh_token_hash = $1 AND client_id = $2
       AND revoked_at IS NULL AND refresh_expires_at > NOW()`,
      [refreshTokenHash, clientId]
    );

    if (tokenResult.rows.length === 0) {
      throw new OAuth2Exception('invalid_grant', 'Invalid or expired refresh token');
    }

    const oldToken = tokenResult.rows[0] as OAuth2Token;

    // Revoke old token
    await this.pool.query(
      'UPDATE oauth2_tokens SET revoked_at = NOW() WHERE id = $1',
      [oldToken.id]
    );

    // Create new tokens
    return this.createTokens(
      clientId,
      oldToken.user_id,
      oldToken.org_id,
      oldToken.scopes,
      true
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TOKEN MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create access and optional refresh tokens
   */
  private async createTokens(
    clientId: string,
    userId: string | null,
    orgId: string,
    scopes: string[],
    includeRefreshToken: boolean
  ): Promise<TokenResponse> {
    const accessToken = this.generateAccessToken();
    const accessTokenHash = this.hashSecret(accessToken);
    const expiresAt = new Date(Date.now() + this.config.accessTokenTtl * 1000);

    let refreshToken: string | undefined;
    let refreshTokenHash: string | null = null;
    let refreshExpiresAt: Date | null = null;

    if (includeRefreshToken) {
      refreshToken = this.generateRefreshToken();
      refreshTokenHash = this.hashSecret(refreshToken);
      refreshExpiresAt = new Date(Date.now() + this.config.refreshTokenTtl * 1000);
    }

    await this.pool.query(
      `INSERT INTO oauth2_tokens (
        access_token_hash, refresh_token_hash, client_id, user_id, org_id,
        scopes, token_type, expires_at, refresh_expires_at, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'Bearer', $7, $8, NOW())`,
      [
        accessTokenHash,
        refreshTokenHash,
        clientId,
        userId,
        orgId,
        scopes,
        expiresAt,
        refreshExpiresAt,
      ]
    );

    const response: TokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenTtl,
      scope: scopes.join(' '),
    };

    if (refreshToken) {
      response.refresh_token = refreshToken;
    }

    return response;
  }

  /**
   * Validate an access token
   */
  async validateAccessToken(accessToken: string): Promise<OAuth2Token | null> {
    const tokenHash = this.hashSecret(accessToken);

    const result = await this.pool.query(
      `SELECT * FROM oauth2_tokens
       WHERE access_token_hash = $1
       AND revoked_at IS NULL AND expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0] as OAuth2Token;
  }

  /**
   * Introspect a token (RFC 7662)
   */
  async introspectToken(token: string): Promise<TokenIntrospectionResponse> {
    const tokenHash = this.hashSecret(token);

    // Check access token
    let result = await this.pool.query(
      `SELECT t.*, c.name as client_name
       FROM oauth2_tokens t
       JOIN oauth2_clients c ON t.client_id = c.client_id
       WHERE t.access_token_hash = $1`,
      [tokenHash]
    );

    // Check refresh token if not found
    if (result.rows.length === 0) {
      result = await this.pool.query(
        `SELECT t.*, c.name as client_name
         FROM oauth2_tokens t
         JOIN oauth2_clients c ON t.client_id = c.client_id
         WHERE t.refresh_token_hash = $1`,
        [tokenHash]
      );
    }

    if (result.rows.length === 0) {
      return { active: false };
    }

    const tokenData = result.rows[0];
    const isAccessToken = tokenData.access_token_hash === tokenHash;
    const expiresAt = isAccessToken ? tokenData.expires_at : tokenData.refresh_expires_at;
    const isActive = !tokenData.revoked_at && new Date() < new Date(expiresAt);

    if (!isActive) {
      return { active: false };
    }

    return {
      active: true,
      scope: tokenData.scopes.join(' '),
      client_id: tokenData.client_id,
      token_type: tokenData.token_type,
      exp: Math.floor(new Date(expiresAt).getTime() / 1000),
      iat: Math.floor(new Date(tokenData.created_at).getTime() / 1000),
      sub: tokenData.user_id || tokenData.client_id,
      iss: this.config.issuer,
      org_id: tokenData.org_id,
    };
  }

  /**
   * Revoke a token
   */
  async revokeToken(token: string): Promise<boolean> {
    const tokenHash = this.hashSecret(token);

    // Try revoking by access token
    let result = await this.pool.query(
      `UPDATE oauth2_tokens
       SET revoked_at = NOW()
       WHERE access_token_hash = $1 AND revoked_at IS NULL
       RETURNING id`,
      [tokenHash]
    );

    if (result.rows.length > 0) return true;

    // Try revoking by refresh token
    result = await this.pool.query(
      `UPDATE oauth2_tokens
       SET revoked_at = NOW()
       WHERE refresh_token_hash = $1 AND revoked_at IS NULL
       RETURNING id`,
      [tokenHash]
    );

    return result.rows.length > 0;
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeUserTokens(userId: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE oauth2_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );

    return result.rowCount || 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONSENT MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Record user consent
   */
  async recordConsent(
    userId: string,
    clientId: string,
    scopes: string[]
  ): Promise<ConsentRecord> {
    // Upsert consent record
    const result = await this.pool.query(
      `INSERT INTO oauth2_consents (user_id, client_id, scopes, granted_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, client_id)
       DO UPDATE SET scopes = $3, granted_at = NOW(), revoked_at = NULL
       RETURNING *`,
      [userId, clientId, scopes]
    );

    return result.rows[0];
  }

  /**
   * Get existing consent
   */
  async getConsent(userId: string, clientId: string): Promise<ConsentRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM oauth2_consents
       WHERE user_id = $1 AND client_id = $2 AND revoked_at IS NULL`,
      [userId, clientId]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  /**
   * Revoke consent
   */
  async revokeConsent(userId: string, clientId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE oauth2_consents
       SET revoked_at = NOW()
       WHERE user_id = $1 AND client_id = $2 AND revoked_at IS NULL
       RETURNING id`,
      [userId, clientId]
    );

    if (result.rows.length > 0) {
      // Also revoke all tokens
      await this.pool.query(
        `UPDATE oauth2_tokens
         SET revoked_at = NOW()
         WHERE user_id = $1 AND client_id = $2 AND revoked_at IS NULL`,
        [userId, clientId]
      );
    }

    return result.rows.length > 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private generateClientId(): string {
    return `ct_client_${crypto.randomBytes(16).toString('hex')}`;
  }

  private generateClientSecret(): string {
    return `ct_secret_${crypto.randomBytes(32).toString('hex')}`;
  }

  private generateAuthorizationCode(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private generateAccessToken(): string {
    return `ct_at_${crypto.randomBytes(32).toString('hex')}`;
  }

  private generateRefreshToken(): string {
    return `ct_rt_${crypto.randomBytes(32).toString('hex')}`;
  }

  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  private hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  private mapRowToClient(row: any): OAuth2Client {
    return {
      id: row.id,
      org_id: row.org_id,
      name: row.name,
      client_id: row.client_id,
      client_secret_hash: row.client_secret_hash,
      redirect_uris: row.redirect_uris || [],
      allowed_grant_types: row.allowed_grant_types || [],
      scopes: row.scopes || [],
      is_confidential: row.is_confidential,
      is_active: row.is_active,
      metadata: row.metadata,
      logo_url: row.logo_url,
      homepage_url: row.homepage_url,
      privacy_policy_url: row.privacy_policy_url,
      terms_of_service_url: row.terms_of_service_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createOAuth2Service(
  pool: Pool,
  config?: Partial<OAuth2Config>
): OAuth2Service {
  return new OAuth2Service(pool, config);
}
