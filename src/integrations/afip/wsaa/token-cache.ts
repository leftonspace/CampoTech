/**
 * AFIP Token Cache
 * ================
 *
 * Caches the Ticket de Acceso (TA) to avoid unnecessary authentication calls.
 * TA is valid for 12-24 hours, so we cache and refresh before expiry.
 */

import { TicketDeAcceso } from '../afip.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CacheEntry {
  ticket: TicketDeAcceso;
  cuit: string;
  service: string;
}

type TokenRefresher = (cuit: string, service: string) => Promise<TicketDeAcceso>;

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY CACHE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * In-memory token cache
 * Key format: `{cuit}:{service}`
 */
const cache = new Map<string, CacheEntry>();

/**
 * Pending refresh promises to avoid concurrent refresh calls
 */
const pendingRefreshes = new Map<string, Promise<TicketDeAcceso>>();

/**
 * Safety margin before expiration (10 minutes)
 * We refresh the token before it actually expires to avoid request failures
 */
const EXPIRY_SAFETY_MARGIN_MS = 10 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE KEY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getCacheKey(cuit: string, service: string): string {
  return `${cuit}:${service}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a cached ticket is still valid
 */
function isTicketValid(ticket: TicketDeAcceso): boolean {
  const now = new Date();
  const expiryWithMargin = new Date(ticket.expirationTime.getTime() - EXPIRY_SAFETY_MARGIN_MS);
  return now < expiryWithMargin;
}

/**
 * Get a cached ticket if valid
 */
export function getCachedToken(cuit: string, service: string = 'wsfe'): TicketDeAcceso | null {
  const key = getCacheKey(cuit, service);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (!isTicketValid(entry.ticket)) {
    cache.delete(key);
    return null;
  }

  return entry.ticket;
}

/**
 * Store a ticket in the cache
 */
export function setCachedToken(
  cuit: string,
  service: string,
  ticket: TicketDeAcceso
): void {
  const key = getCacheKey(cuit, service);
  cache.set(key, {
    ticket,
    cuit,
    service,
  });
}

/**
 * Remove a ticket from the cache
 */
export function invalidateToken(cuit: string, service: string = 'wsfe'): void {
  const key = getCacheKey(cuit, service);
  cache.delete(key);
  pendingRefreshes.delete(key);
}

/**
 * Clear all cached tokens for an organization
 */
export function invalidateAllTokens(cuit: string): void {
  for (const [key] of cache) {
    if (key.startsWith(`${cuit}:`)) {
      cache.delete(key);
      pendingRefreshes.delete(key);
    }
  }
}

/**
 * Clear entire cache
 */
export function clearCache(): void {
  cache.clear();
  pendingRefreshes.clear();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Token manager for a specific organization
 */
export class TokenManager {
  private cuit: string;
  private refresher: TokenRefresher;

  constructor(cuit: string, refresher: TokenRefresher) {
    this.cuit = cuit;
    this.refresher = refresher;
  }

  /**
   * Get a valid token, refreshing if necessary
   */
  async getToken(service: string = 'wsfe'): Promise<TicketDeAcceso> {
    // Check cache first
    const cached = getCachedToken(this.cuit, service);
    if (cached) {
      return cached;
    }

    // Check if there's already a pending refresh
    const key = getCacheKey(this.cuit, service);
    const pending = pendingRefreshes.get(key);
    if (pending) {
      return pending;
    }

    // Start a new refresh
    const refreshPromise = this.refresh(service);
    pendingRefreshes.set(key, refreshPromise);

    try {
      const ticket = await refreshPromise;
      setCachedToken(this.cuit, service, ticket);
      return ticket;
    } finally {
      pendingRefreshes.delete(key);
    }
  }

  /**
   * Force refresh the token
   */
  async refresh(service: string = 'wsfe'): Promise<TicketDeAcceso> {
    const ticket = await this.refresher(this.cuit, service);
    setCachedToken(this.cuit, service, ticket);
    return ticket;
  }

  /**
   * Check if we have a valid token without refreshing
   */
  hasValidToken(service: string = 'wsfe'): boolean {
    const cached = getCachedToken(this.cuit, service);
    return cached !== null;
  }

  /**
   * Get token expiration time if cached
   */
  getTokenExpiry(service: string = 'wsfe'): Date | null {
    const cached = getCachedToken(this.cuit, service);
    return cached?.expirationTime || null;
  }

  /**
   * Invalidate all tokens for this organization
   */
  invalidate(): void {
    invalidateAllTokens(this.cuit);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CacheStats {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
  pendingRefreshes: number;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  let validEntries = 0;
  let expiredEntries = 0;

  for (const entry of cache.values()) {
    if (isTicketValid(entry.ticket)) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }

  return {
    totalEntries: cache.size,
    validEntries,
    expiredEntries,
    pendingRefreshes: pendingRefreshes.size,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clean up expired entries from the cache
 * Call this periodically to free memory
 */
export function cleanupExpiredTokens(): number {
  let removed = 0;

  for (const [key, entry] of cache) {
    if (!isTicketValid(entry.ticket)) {
      cache.delete(key);
      removed++;
    }
  }

  return removed;
}

// Auto-cleanup every 5 minutes
setInterval(cleanupExpiredTokens, 5 * 60 * 1000);
