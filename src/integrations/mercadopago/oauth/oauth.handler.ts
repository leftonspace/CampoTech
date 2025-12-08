/**
 * MercadoPago OAuth Handler
 * =========================
 *
 * Implements OAuth 2.0 authorization code flow for MercadoPago.
 * Handles authorization URL generation, callback processing, and token exchange.
 */

import * as https from 'https';
import * as crypto from 'crypto';
import {
  MPConfig,
  MPCredentials,
  OAuthTokenRequest,
  OAuthTokenResponse,
  OAuthError,
  MP_API_BASE_URL,
  MP_AUTH_URL,
} from '../mercadopago.types';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHORIZATION URL
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuthorizationUrlParams {
  appId: string;
  redirectUri: string;
  state?: string;
}

/**
 * Generate the authorization URL for OAuth flow
 */
export function generateAuthorizationUrl(params: AuthorizationUrlParams): string {
  const state = params.state || crypto.randomBytes(16).toString('hex');

  const queryParams = new URLSearchParams({
    client_id: params.appId,
    response_type: 'code',
    redirect_uri: params.redirectUri,
    platform_id: 'mp',
    state,
  });

  return `${MP_AUTH_URL}?${queryParams.toString()}`;
}

/**
 * Generate state parameter for CSRF protection
 */
export function generateState(orgId: string): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  const signature = crypto
    .createHmac('sha256', process.env.MP_STATE_SECRET || 'default-secret')
    .update(`${orgId}:${timestamp}`)
    .digest('hex')
    .substring(0, 16);

  return `${orgId}:${timestamp}:${random}:${signature}`;
}

/**
 * Validate state parameter
 */
export function validateState(state: string): { valid: boolean; orgId?: string; error?: string } {
  const parts = state.split(':');
  if (parts.length !== 4) {
    return { valid: false, error: 'Invalid state format' };
  }

  const [orgId, timestamp, , signature] = parts;

  // Check timestamp (valid for 10 minutes)
  const stateTime = parseInt(timestamp, 36);
  if (Date.now() - stateTime > 10 * 60 * 1000) {
    return { valid: false, error: 'State expired' };
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.MP_STATE_SECRET || 'default-secret')
    .update(`${orgId}:${timestamp}`)
    .digest('hex')
    .substring(0, 16);

  if (signature !== expectedSignature) {
    return { valid: false, error: 'Invalid state signature' };
  }

  return { valid: true, orgId };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN EXCHANGE
// ═══════════════════════════════════════════════════════════════════════════════

interface HttpResponse<T> {
  statusCode: number;
  data: T;
}

function makeRequest<T>(
  method: 'POST' | 'GET',
  path: string,
  body?: object,
  accessToken?: string
): Promise<HttpResponse<T>> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, MP_API_BASE_URL);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const bodyString = body ? JSON.stringify(body) : undefined;
    if (bodyString) {
      headers['Content-Length'] = Buffer.byteLength(bodyString).toString();
    }

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers,
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            statusCode: res.statusCode || 0,
            data: parsed,
          });
        } catch {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (bodyString) {
      req.write(bodyString);
    }
    req.end();
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  config: MPConfig,
  code: string
): Promise<{ success: true; credentials: MPCredentials } | { success: false; error: string }> {
  log.info('Exchanging authorization code for tokens');

  try {
    const tokenRequest: OAuthTokenRequest = {
      grant_type: 'authorization_code',
      client_id: config.appId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    };

    const response = await makeRequest<OAuthTokenResponse | OAuthError>(
      'POST',
      '/oauth/token',
      tokenRequest
    );

    if (response.statusCode !== 200) {
      const error = response.data as OAuthError;
      log.error('Token exchange failed', {
        status: response.statusCode,
        error: error.error,
        description: error.error_description,
      });
      return {
        success: false,
        error: error.error_description || error.error || 'Token exchange failed',
      };
    }

    const tokenResponse = response.data as OAuthTokenResponse;

    const credentials: MPCredentials = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      tokenType: tokenResponse.token_type,
      expiresIn: tokenResponse.expires_in,
      expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
      scope: tokenResponse.scope,
      userId: tokenResponse.user_id,
      publicKey: tokenResponse.public_key,
    };

    log.info('Token exchange successful', {
      userId: credentials.userId,
      expiresAt: credentials.expiresAt,
    });

    return { success: true, credentials };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Token exchange error', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  config: MPConfig,
  refreshToken: string
): Promise<{ success: true; credentials: MPCredentials } | { success: false; error: string }> {
  log.info('Refreshing access token');

  try {
    const tokenRequest: OAuthTokenRequest = {
      grant_type: 'refresh_token',
      client_id: config.appId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    };

    const response = await makeRequest<OAuthTokenResponse | OAuthError>(
      'POST',
      '/oauth/token',
      tokenRequest
    );

    if (response.statusCode !== 200) {
      const error = response.data as OAuthError;
      log.error('Token refresh failed', {
        status: response.statusCode,
        error: error.error,
      });
      return {
        success: false,
        error: error.error_description || error.error || 'Token refresh failed',
      };
    }

    const tokenResponse = response.data as OAuthTokenResponse;

    const credentials: MPCredentials = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      tokenType: tokenResponse.token_type,
      expiresIn: tokenResponse.expires_in,
      expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
      scope: tokenResponse.scope,
      userId: tokenResponse.user_id,
      publicKey: tokenResponse.public_key,
    };

    log.info('Token refresh successful', {
      userId: credentials.userId,
      expiresAt: credentials.expiresAt,
    });

    return { success: true, credentials };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Token refresh error', { error: message });
    return { success: false, error: message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if credentials are valid and not expired
 */
export function areCredentialsValid(credentials: MPCredentials | null): boolean {
  if (!credentials) return false;
  if (!credentials.accessToken) return false;

  // Check expiration with 10-minute safety margin
  const safetyMargin = 10 * 60 * 1000;
  return new Date() < new Date(credentials.expiresAt.getTime() - safetyMargin);
}

/**
 * Check if credentials need refresh (within 30 minutes of expiry)
 */
export function credentialsNeedRefresh(credentials: MPCredentials): boolean {
  const refreshThreshold = 30 * 60 * 1000; // 30 minutes
  return new Date() >= new Date(credentials.expiresAt.getTime() - refreshThreshold);
}

// ═══════════════════════════════════════════════════════════════════════════════
// API CLIENT HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Make authenticated API request
 */
export async function makeAuthenticatedRequest<T>(
  accessToken: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: object
): Promise<{ success: true; data: T } | { success: false; error: string; status?: number }> {
  try {
    const response = await makeRequest<T>(method as any, path, body, accessToken);

    if (response.statusCode >= 400) {
      const errorData = response.data as any;
      return {
        success: false,
        error: errorData?.message || errorData?.error || 'Request failed',
        status: response.statusCode,
      };
    }

    return { success: true, data: response.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
