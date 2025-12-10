/**
 * Authentication Module
 * ======================
 *
 * Exports for API authentication and authorization.
 */

// API Key Service
export { ApiKeyService, createApiKeyService } from './api-key.service';
export type {
  ApiKey,
  CreateApiKeyOptions,
  ApiKeyValidationResult,
  ApiKeyUsageStats,
} from './api-key.service';

// OAuth 2.0 Types
export type {
  OAuth2GrantType,
  OAuth2Client,
  CreateOAuth2ClientOptions,
  AuthorizationCode,
  AuthorizationRequest,
  OAuth2Token,
  TokenResponse,
  TokenRequest,
  TokenIntrospectionResponse,
  OAuth2ErrorCode,
  OAuth2Error,
  ConsentRecord,
  OAuth2Config,
} from './oauth2.types';
export { OAuth2Exception, DEFAULT_OAUTH2_CONFIG } from './oauth2.types';

// OAuth 2.0 Service
export { OAuth2Service, createOAuth2Service } from './oauth2.service';

// OAuth 2.0 Router
export { createOAuth2Router } from './oauth2.router';
