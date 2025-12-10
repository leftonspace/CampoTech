/**
 * OAuth 2.0 Router
 * =================
 *
 * Express router implementing OAuth 2.0 endpoints.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { OAuth2Service } from './oauth2.service';
import {
  OAuth2Exception,
  TokenRequest,
  OAuth2Config,
  DEFAULT_OAUTH2_CONFIG,
} from './oauth2.types';

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createOAuth2Router(
  pool: Pool,
  config?: Partial<OAuth2Config>
): Router {
  const router = Router();
  const oauth2Service = new OAuth2Service(pool, config);
  const oauthConfig = { ...DEFAULT_OAUTH2_CONFIG, ...config };

  // ─────────────────────────────────────────────────────────────────────────────
  // DISCOVERY ENDPOINT (RFC 8414)
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/.well-known/oauth-authorization-server', (req: Request, res: Response) => {
    res.json({
      issuer: oauthConfig.issuer,
      authorization_endpoint: `${oauthConfig.issuer}${oauthConfig.authorizationEndpoint}`,
      token_endpoint: `${oauthConfig.issuer}${oauthConfig.tokenEndpoint}`,
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      token_endpoint_auth_signing_alg_values_supported: ['RS256'],
      introspection_endpoint: `${oauthConfig.issuer}${oauthConfig.introspectionEndpoint}`,
      introspection_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      revocation_endpoint: `${oauthConfig.issuer}${oauthConfig.revocationEndpoint}`,
      revocation_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      scopes_supported: oauthConfig.allowedScopes,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      service_documentation: 'https://developers.campotech.com/docs/oauth',
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTHORIZATION ENDPOINT
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/authorize', async (req: Request, res: Response) => {
    try {
      const {
        client_id,
        redirect_uri,
        response_type,
        scope,
        state,
        code_challenge,
        code_challenge_method,
      } = req.query;

      // Validate response_type
      if (response_type !== 'code') {
        return sendAuthError(res, redirect_uri as string, 'unsupported_response_type', 'Only code response type is supported', state as string);
      }

      // Parse scopes
      const scopes = scope ? (scope as string).split(' ') : [];

      // Validate request
      const client = await oauth2Service.validateAuthorizationRequest({
        clientId: client_id as string,
        redirectUri: redirect_uri as string,
        responseType: 'code',
        scopes,
        state: state as string,
        codeChallenge: code_challenge as string,
        codeChallengeMethod: code_challenge_method as 'plain' | 'S256',
      });

      // Check if user is logged in (session middleware should set this)
      const userId = (req as any).session?.userId;
      if (!userId) {
        // Redirect to login page with return URL
        const returnUrl = encodeURIComponent(req.originalUrl);
        return res.redirect(`/login?return_to=${returnUrl}`);
      }

      // Check existing consent
      const existingConsent = await oauth2Service.getConsent(userId, client.client_id);
      const hasAllScopes = existingConsent && scopes.every(s => existingConsent.scopes.includes(s));

      if (hasAllScopes) {
        // Auto-approve if consent already given
        const code = await oauth2Service.createAuthorizationCode(
          client.client_id,
          userId,
          client.org_id,
          redirect_uri as string,
          scopes,
          code_challenge as string,
          code_challenge_method as 'plain' | 'S256'
        );

        const redirectUrl = new URL(redirect_uri as string);
        redirectUrl.searchParams.set('code', code);
        if (state) redirectUrl.searchParams.set('state', state as string);

        return res.redirect(redirectUrl.toString());
      }

      // Render consent page
      res.render('oauth/consent', {
        client,
        scopes,
        redirectUri: redirect_uri,
        state,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
      });
    } catch (error) {
      if (error instanceof OAuth2Exception) {
        const redirectUri = req.query.redirect_uri as string;
        const state = req.query.state as string;
        return sendAuthError(res, redirectUri, error.code, error.description, state);
      }

      console.error('[OAuth2] Authorization error:', error);
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
    }
  });

  // Handle consent form submission
  router.post('/authorize', async (req: Request, res: Response) => {
    try {
      const {
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method,
        consent,
      } = req.body;

      const userId = (req as any).session?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'unauthorized', error_description: 'Not logged in' });
      }

      const scopes = scope ? scope.split(' ') : [];

      if (consent !== 'granted') {
        // User denied consent
        return sendAuthError(res, redirect_uri, 'access_denied', 'User denied consent', state);
      }

      // Validate client
      const client = await oauth2Service.getClientByClientId(client_id);
      if (!client) {
        return sendAuthError(res, redirect_uri, 'invalid_client', 'Client not found', state);
      }

      // Record consent
      await oauth2Service.recordConsent(userId, client_id, scopes);

      // Generate authorization code
      const code = await oauth2Service.createAuthorizationCode(
        client_id,
        userId,
        client.org_id,
        redirect_uri,
        scopes,
        code_challenge,
        code_challenge_method
      );

      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('code', code);
      if (state) redirectUrl.searchParams.set('state', state);

      res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('[OAuth2] Consent error:', error);
      const redirectUri = req.body.redirect_uri;
      const state = req.body.state;
      sendAuthError(res, redirectUri, 'server_error', 'Internal server error', state);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TOKEN ENDPOINT
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/token', async (req: Request, res: Response) => {
    try {
      // Parse client credentials from body or Basic auth header
      let clientId = req.body.client_id;
      let clientSecret = req.body.client_secret;

      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Basic ')) {
        const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
        const [id, secret] = credentials.split(':');
        clientId = decodeURIComponent(id);
        clientSecret = decodeURIComponent(secret);
      }

      const tokenRequest: TokenRequest = {
        grant_type: req.body.grant_type,
        client_id: clientId,
        client_secret: clientSecret,
        code: req.body.code,
        redirect_uri: req.body.redirect_uri,
        refresh_token: req.body.refresh_token,
        scope: req.body.scope,
        code_verifier: req.body.code_verifier,
      };

      let tokenResponse;

      switch (tokenRequest.grant_type) {
        case 'authorization_code':
          if (!tokenRequest.code || !tokenRequest.redirect_uri) {
            throw new OAuth2Exception('invalid_request', 'code and redirect_uri are required');
          }
          tokenResponse = await oauth2Service.exchangeAuthorizationCode(
            tokenRequest.code,
            tokenRequest.client_id,
            tokenRequest.redirect_uri,
            tokenRequest.code_verifier
          );
          break;

        case 'client_credentials':
          if (!tokenRequest.client_secret) {
            throw new OAuth2Exception('invalid_client', 'client_secret is required');
          }
          const scopes = tokenRequest.scope ? tokenRequest.scope.split(' ') : undefined;
          tokenResponse = await oauth2Service.clientCredentialsGrant(
            tokenRequest.client_id,
            tokenRequest.client_secret,
            scopes
          );
          break;

        case 'refresh_token':
          if (!tokenRequest.refresh_token) {
            throw new OAuth2Exception('invalid_request', 'refresh_token is required');
          }
          tokenResponse = await oauth2Service.refreshAccessToken(
            tokenRequest.refresh_token,
            tokenRequest.client_id,
            tokenRequest.client_secret
          );
          break;

        default:
          throw new OAuth2Exception('unsupported_grant_type', `Grant type '${tokenRequest.grant_type}' is not supported`);
      }

      // Set cache headers
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');

      res.json(tokenResponse);
    } catch (error) {
      if (error instanceof OAuth2Exception) {
        return res.status(400).json(error.toJSON());
      }

      console.error('[OAuth2] Token error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error',
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // INTROSPECTION ENDPOINT (RFC 7662)
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/introspect', async (req: Request, res: Response) => {
    try {
      // Validate client credentials
      const clientAuth = extractClientCredentials(req);
      if (!clientAuth) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Client authentication required',
        });
      }

      const client = await oauth2Service.validateClientCredentials(
        clientAuth.clientId,
        clientAuth.clientSecret
      );

      if (!client) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Invalid client credentials',
        });
      }

      const { token } = req.body;
      if (!token) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'token parameter is required',
        });
      }

      const introspection = await oauth2Service.introspectToken(token);
      res.json(introspection);
    } catch (error) {
      console.error('[OAuth2] Introspection error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error',
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // REVOCATION ENDPOINT (RFC 7009)
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/revoke', async (req: Request, res: Response) => {
    try {
      // Validate client credentials
      const clientAuth = extractClientCredentials(req);
      if (!clientAuth) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Client authentication required',
        });
      }

      const client = await oauth2Service.validateClientCredentials(
        clientAuth.clientId,
        clientAuth.clientSecret
      );

      if (!client) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Invalid client credentials',
        });
      }

      const { token } = req.body;
      if (!token) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'token parameter is required',
        });
      }

      await oauth2Service.revokeToken(token);

      // Always return 200 per RFC 7009
      res.status(200).send();
    } catch (error) {
      console.error('[OAuth2] Revocation error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error',
      });
    }
  });

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function extractClientCredentials(req: Request): { clientId: string; clientSecret: string } | null {
  // Try Basic auth header first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
    const [clientId, clientSecret] = credentials.split(':');
    if (clientId && clientSecret) {
      return {
        clientId: decodeURIComponent(clientId),
        clientSecret: decodeURIComponent(clientSecret),
      };
    }
  }

  // Fall back to body parameters
  if (req.body.client_id && req.body.client_secret) {
    return {
      clientId: req.body.client_id,
      clientSecret: req.body.client_secret,
    };
  }

  return null;
}

function sendAuthError(
  res: Response,
  redirectUri: string | undefined,
  error: string,
  description?: string,
  state?: string
): void {
  if (redirectUri) {
    try {
      const url = new URL(redirectUri);
      url.searchParams.set('error', error);
      if (description) url.searchParams.set('error_description', description);
      if (state) url.searchParams.set('state', state);
      res.redirect(url.toString());
      return;
    } catch {
      // Invalid redirect URI, fall through to JSON response
    }
  }

  res.status(400).json({
    error,
    error_description: description,
    state,
  });
}
