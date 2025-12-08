/**
 * MercadoPago OAuth Module
 * ========================
 *
 * OAuth 2.0 authorization code flow implementation
 */

export {
  generateAuthorizationUrl,
  generateState,
  validateState,
  exchangeCodeForTokens,
  refreshAccessToken,
  areCredentialsValid,
  credentialsNeedRefresh,
  makeAuthenticatedRequest,
} from './oauth.handler';
export type { AuthorizationUrlParams } from './oauth.handler';

export {
  getCachedCredentials,
  setCachedCredentials,
  invalidateCredentials,
  clearCredentialCache,
  ensureValidCredentials,
  MPTokenManager,
  getCacheStats,
} from './token-refresh';
export type { TokenManagerConfig, CacheStats } from './token-refresh';
