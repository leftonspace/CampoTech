/**
 * MercadoPago Token Refresh Service
 * ==================================
 *
 * Automatic token refresh management with caching and concurrency protection.
 */

import { MPConfig, MPCredentials } from '../mercadopago.types';
import { refreshAccessToken, areCredentialsValid, credentialsNeedRefresh } from './oauth.handler';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CachedCredentials {
  credentials: MPCredentials;
  orgId: string;
  lastRefresh: Date;
}

interface RefreshPromise {
  promise: Promise<MPCredentials | null>;
  expiresAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREDENTIAL CACHE
// ═══════════════════════════════════════════════════════════════════════════════

const credentialCache = new Map<string, CachedCredentials>();
const refreshInProgress = new Map<string, RefreshPromise>();

/**
 * Get cached credentials for an organization
 */
export function getCachedCredentials(orgId: string): MPCredentials | null {
  const cached = credentialCache.get(orgId);
  if (!cached) return null;

  if (!areCredentialsValid(cached.credentials)) {
    credentialCache.delete(orgId);
    return null;
  }

  return cached.credentials;
}

/**
 * Store credentials in cache
 */
export function setCachedCredentials(orgId: string, credentials: MPCredentials): void {
  credentialCache.set(orgId, {
    credentials,
    orgId,
    lastRefresh: new Date(),
  });
}

/**
 * Remove credentials from cache
 */
export function invalidateCredentials(orgId: string): void {
  credentialCache.delete(orgId);
  refreshInProgress.delete(orgId);
}

/**
 * Clear all cached credentials
 */
export function clearCredentialCache(): void {
  credentialCache.clear();
  refreshInProgress.clear();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN REFRESH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ensure valid credentials, refreshing if necessary
 * Handles concurrent refresh requests with deduplication
 */
export async function ensureValidCredentials(
  config: MPConfig,
  orgId: string,
  currentCredentials: MPCredentials
): Promise<MPCredentials | null> {
  // Check if credentials are still valid
  if (areCredentialsValid(currentCredentials) && !credentialsNeedRefresh(currentCredentials)) {
    return currentCredentials;
  }

  // Check for in-progress refresh
  const existing = refreshInProgress.get(orgId);
  if (existing && existing.expiresAt > Date.now()) {
    log.debug('Waiting for existing refresh', { orgId });
    return existing.promise;
  }

  // Start new refresh
  const refreshPromise = performRefresh(config, orgId, currentCredentials);

  refreshInProgress.set(orgId, {
    promise: refreshPromise,
    expiresAt: Date.now() + 30000, // 30 second timeout
  });

  try {
    const result = await refreshPromise;
    return result;
  } finally {
    refreshInProgress.delete(orgId);
  }
}

async function performRefresh(
  config: MPConfig,
  orgId: string,
  currentCredentials: MPCredentials
): Promise<MPCredentials | null> {
  log.info('Refreshing MercadoPago token', { orgId });

  const result = await refreshAccessToken(config, currentCredentials.refreshToken);

  if (!result.success) {
    log.error('Token refresh failed', { orgId, error: result.error });
    invalidateCredentials(orgId);
    return null;
  }

  setCachedCredentials(orgId, result.credentials);

  log.info('Token refresh successful', {
    orgId,
    expiresAt: result.credentials.expiresAt,
  });

  return result.credentials;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export interface TokenManagerConfig {
  refreshBeforeExpiry: number; // milliseconds before expiry to refresh
  checkInterval: number; // how often to check for expiring tokens
}

const DEFAULT_TOKEN_MANAGER_CONFIG: TokenManagerConfig = {
  refreshBeforeExpiry: 30 * 60 * 1000, // 30 minutes
  checkInterval: 5 * 60 * 1000, // 5 minutes
};

/**
 * Token manager for proactive refresh
 */
export class MPTokenManager {
  private config: TokenManagerConfig;
  private mpConfig: MPConfig;
  private checkInterval: NodeJS.Timeout | null = null;
  private onRefresh?: (orgId: string, credentials: MPCredentials) => Promise<void>;

  constructor(
    mpConfig: MPConfig,
    config: Partial<TokenManagerConfig> = {},
    onRefresh?: (orgId: string, credentials: MPCredentials) => Promise<void>
  ) {
    this.mpConfig = mpConfig;
    this.config = { ...DEFAULT_TOKEN_MANAGER_CONFIG, ...config };
    this.onRefresh = onRefresh;
  }

  /**
   * Start proactive token refresh
   */
  start(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.checkExpiringTokens();
    }, this.config.checkInterval);

    log.info('MPTokenManager started', { checkInterval: this.config.checkInterval });
  }

  /**
   * Stop proactive token refresh
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      log.info('MPTokenManager stopped');
    }
  }

  /**
   * Register credentials for proactive refresh
   */
  register(orgId: string, credentials: MPCredentials): void {
    setCachedCredentials(orgId, credentials);
    log.debug('Registered credentials for refresh', { orgId });
  }

  /**
   * Unregister credentials
   */
  unregister(orgId: string): void {
    invalidateCredentials(orgId);
    log.debug('Unregistered credentials', { orgId });
  }

  /**
   * Check for tokens that need refresh
   */
  private async checkExpiringTokens(): Promise<void> {
    const now = Date.now();

    for (const [orgId, cached] of credentialCache.entries()) {
      const expiresAt = cached.credentials.expiresAt.getTime();
      const shouldRefresh = expiresAt - now < this.config.refreshBeforeExpiry;

      if (shouldRefresh) {
        try {
          const newCredentials = await ensureValidCredentials(
            this.mpConfig,
            orgId,
            cached.credentials
          );

          if (newCredentials && this.onRefresh) {
            await this.onRefresh(orgId, newCredentials);
          }
        } catch (error) {
          log.error('Proactive token refresh failed', {
            orgId,
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE STATS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CacheStats {
  totalCached: number;
  expiringWithin30Min: number;
  refreshesInProgress: number;
}

export function getCacheStats(): CacheStats {
  const now = Date.now();
  const thirtyMinutes = 30 * 60 * 1000;

  let expiringWithin30Min = 0;
  for (const cached of credentialCache.values()) {
    if (cached.credentials.expiresAt.getTime() - now < thirtyMinutes) {
      expiringWithin30Min++;
    }
  }

  return {
    totalCached: credentialCache.size,
    expiringWithin30Min,
    refreshesInProgress: refreshInProgress.size,
  };
}
