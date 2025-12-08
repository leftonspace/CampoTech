/**
 * WSAA Module Index
 * =================
 *
 * Web Service de Autenticación y Autorización
 */

export { createSignedTRA, generateTRAXml, signTRA } from './tra-generator';
export type { SignedTRA } from './tra-generator';

export {
  getCachedToken,
  setCachedToken,
  invalidateToken,
  invalidateAllTokens,
  clearCache,
  cleanupExpiredTokens,
  getCacheStats,
  TokenManager,
} from './token-cache';
export type { CacheStats } from './token-cache';

export { WSAAClient, getWSAAClient, resetWSAAClient } from './wsaa.client';
