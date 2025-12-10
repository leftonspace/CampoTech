/**
 * OAuth 2.0 Types
 * ================
 *
 * Type definitions for OAuth 2.0 implementation.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// GRANT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type OAuth2GrantType =
  | 'authorization_code'
  | 'client_credentials'
  | 'refresh_token';

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface OAuth2Client {
  id: string;
  org_id: string;
  name: string;
  client_id: string;
  client_secret_hash: string;
  redirect_uris: string[];
  allowed_grant_types: OAuth2GrantType[];
  scopes: string[];
  is_confidential: boolean;
  is_active: boolean;
  metadata: Record<string, any> | null;
  logo_url: string | null;
  homepage_url: string | null;
  privacy_policy_url: string | null;
  terms_of_service_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOAuth2ClientOptions {
  orgId: string;
  name: string;
  redirectUris: string[];
  allowedGrantTypes: OAuth2GrantType[];
  scopes: string[];
  isConfidential?: boolean;
  metadata?: Record<string, any>;
  logoUrl?: string;
  homepageUrl?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHORIZATION CODE
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuthorizationCode {
  id: string;
  code: string;
  client_id: string;
  user_id: string;
  org_id: string;
  redirect_uri: string;
  scopes: string[];
  code_challenge: string | null;
  code_challenge_method: 'plain' | 'S256' | null;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  responseType: 'code';
  scopes: string[];
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'plain' | 'S256';
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

export interface OAuth2Token {
  id: string;
  access_token_hash: string;
  refresh_token_hash: string | null;
  client_id: string;
  user_id: string | null;
  org_id: string;
  scopes: string[];
  token_type: 'Bearer';
  expires_at: Date;
  refresh_expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface TokenRequest {
  grant_type: OAuth2GrantType;
  client_id: string;
  client_secret?: string;
  code?: string;
  redirect_uri?: string;
  refresh_token?: string;
  scope?: string;
  code_verifier?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN INTROSPECTION
// ═══════════════════════════════════════════════════════════════════════════════

export interface TokenIntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  aud?: string;
  iss?: string;
  jti?: string;
  org_id?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export type OAuth2ErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'invalid_scope'
  | 'access_denied'
  | 'server_error'
  | 'temporarily_unavailable';

export interface OAuth2Error {
  error: OAuth2ErrorCode;
  error_description?: string;
  error_uri?: string;
  state?: string;
}

export class OAuth2Exception extends Error {
  constructor(
    public code: OAuth2ErrorCode,
    public description?: string,
    public state?: string
  ) {
    super(description || code);
    this.name = 'OAuth2Exception';
  }

  toJSON(): OAuth2Error {
    return {
      error: this.code,
      error_description: this.description,
      state: this.state,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConsentRecord {
  id: string;
  user_id: string;
  client_id: string;
  scopes: string[];
  granted_at: Date;
  revoked_at: Date | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface OAuth2Config {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  introspectionEndpoint: string;
  revocationEndpoint: string;
  accessTokenTtl: number; // seconds
  refreshTokenTtl: number; // seconds
  authorizationCodeTtl: number; // seconds
  requirePkce: boolean;
  allowedScopes: string[];
}

export const DEFAULT_OAUTH2_CONFIG: OAuth2Config = {
  issuer: 'https://api.campotech.com',
  authorizationEndpoint: '/oauth/authorize',
  tokenEndpoint: '/oauth/token',
  introspectionEndpoint: '/oauth/introspect',
  revocationEndpoint: '/oauth/revoke',
  accessTokenTtl: 3600, // 1 hour
  refreshTokenTtl: 2592000, // 30 days
  authorizationCodeTtl: 600, // 10 minutes
  requirePkce: true,
  allowedScopes: [
    'read:customers',
    'write:customers',
    'delete:customers',
    'read:jobs',
    'write:jobs',
    'delete:jobs',
    'read:invoices',
    'write:invoices',
    'delete:invoices',
    'read:payments',
    'write:payments',
    'delete:payments',
    'read:webhooks',
    'write:webhooks',
    'delete:webhooks',
    'read:technicians',
    'write:technicians',
    'read:routes',
    'write:routes',
    'read:inventory',
    'write:inventory',
    'read:reports',
    'offline_access',
  ],
};
