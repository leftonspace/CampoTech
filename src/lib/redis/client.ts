/**
 * Redis Client
 * ============
 *
 * Simple Redis client wrapper that provides connection management.
 * Re-exports from redis-manager for backwards compatibility.
 */

import { Redis } from 'ioredis';
import { getRedis, getRedisManager, initializeRedis, RedisManager } from './redis-manager';

// Environment configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Lazy-initialized connection
let connectionPromise: Promise<Redis> | null = null;

/**
 * Get a Redis connection (lazy initialization)
 */
export async function getRedisConnection(): Promise<Redis> {
  if (!connectionPromise) {
    connectionPromise = (async () => {
      try {
        const manager = initializeRedis({
          url: REDIS_URL,
          name: 'default',
          onConnect: () => {
            console.log('[Redis] Connected');
          },
          onError: (error) => {
            console.error('[Redis] Error:', error.message);
          },
        });
        await manager.waitForReady(10000);
        return manager.getClient();
      } catch (error) {
        connectionPromise = null; // Reset so we can retry
        throw error;
      }
    })();
  }
  return connectionPromise;
}

/**
 * Get Redis client synchronously (assumes already initialized)
 */
export function getRedisClient(): Redis {
  return getRedis();
}

// Re-export from redis-manager
export { getRedis, getRedisManager, initializeRedis, RedisManager };
export type { RedisManagerConfig, ConnectionHealth } from './redis-manager';
