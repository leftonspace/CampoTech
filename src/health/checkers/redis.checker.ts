/**
 * Redis Health Checker
 * ====================
 *
 * Checks Redis connectivity and performance
 */

import type { Redis } from 'ioredis';
import type { HealthChecker, ComponentHealth } from '../health.types';

export class RedisHealthChecker implements HealthChecker {
  name = 'redis';
  private redis: Redis;
  private timeoutMs: number;

  constructor(redis: Redis, timeoutMs: number = 3000) {
    this.redis = redis;
    this.timeoutMs = timeoutMs;
  }

  async check(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Redis check timed out')), this.timeoutMs);
      });

      // Ping Redis
      const pingPromise = this.redis.ping();
      const result = await Promise.race([pingPromise, timeoutPromise]);

      const latencyMs = Date.now() - startTime;

      if (result !== 'PONG') {
        return {
          name: this.name,
          status: 'unhealthy',
          latencyMs,
          message: `Unexpected ping response: ${result}`,
          lastChecked: new Date(),
        };
      }

      if (latencyMs > 100) {
        return {
          name: this.name,
          status: 'degraded',
          latencyMs,
          message: 'Redis responding slowly',
          lastChecked: new Date(),
        };
      }

      return {
        name: this.name,
        status: 'healthy',
        latencyMs,
        message: 'Redis connection successful',
        lastChecked: new Date(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown Redis error';

      return {
        name: this.name,
        status: 'unhealthy',
        latencyMs,
        message,
        lastChecked: new Date(),
      };
    }
  }
}

/**
 * Extended Redis health check with memory and stats
 */
export class ExtendedRedisHealthChecker implements HealthChecker {
  name = 'redis-extended';
  private redis: Redis;
  private timeoutMs: number;

  constructor(redis: Redis, timeoutMs: number = 3000) {
    this.redis = redis;
    this.timeoutMs = timeoutMs;
  }

  async check(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Redis check timed out')), this.timeoutMs);
      });

      // Get Redis info
      const infoPromise = this.redis.info('memory');
      const info = await Promise.race([infoPromise, timeoutPromise]);

      const latencyMs = Date.now() - startTime;

      // Parse memory info
      const usedMemoryMatch = info.match(/used_memory:(\d+)/);
      const maxMemoryMatch = info.match(/maxmemory:(\d+)/);
      const fragmentationMatch = info.match(/mem_fragmentation_ratio:([\d.]+)/);

      const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1], 10) : 0;
      const maxMemory = maxMemoryMatch ? parseInt(maxMemoryMatch[1], 10) : 0;
      const fragmentation = fragmentationMatch ? parseFloat(fragmentationMatch[1]) : 1;

      // Check memory usage
      const memoryUsagePercent = maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0;

      let status: ComponentHealth['status'] = 'healthy';
      let message = 'Redis operating normally';

      if (memoryUsagePercent > 90) {
        status = 'unhealthy';
        message = 'Redis memory critically high';
      } else if (memoryUsagePercent > 75) {
        status = 'degraded';
        message = 'Redis memory usage elevated';
      } else if (fragmentation > 1.5) {
        status = 'degraded';
        message = 'Redis memory fragmentation detected';
      }

      return {
        name: this.name,
        status,
        latencyMs,
        message,
        details: {
          usedMemoryBytes: usedMemory,
          maxMemoryBytes: maxMemory,
          memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
          fragmentationRatio: fragmentation,
        },
        lastChecked: new Date(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown Redis error';

      return {
        name: this.name,
        status: 'unhealthy',
        latencyMs,
        message,
        lastChecked: new Date(),
      };
    }
  }
}
