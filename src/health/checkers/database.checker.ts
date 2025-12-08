/**
 * Database Health Checker
 * =======================
 *
 * Checks PostgreSQL database connectivity and performance
 */

import { PrismaClient } from '@prisma/client';
import type { HealthChecker, ComponentHealth } from '../health.types';

export class DatabaseHealthChecker implements HealthChecker {
  name = 'database';
  private prisma: PrismaClient;
  private timeoutMs: number;

  constructor(prisma: PrismaClient, timeoutMs: number = 5000) {
    this.prisma = prisma;
    this.timeoutMs = timeoutMs;
  }

  async check(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database check timed out')), this.timeoutMs);
      });

      // Execute a simple query to check connectivity
      const queryPromise = this.prisma.$queryRaw`SELECT 1 as health_check`;

      await Promise.race([queryPromise, timeoutPromise]);

      const latencyMs = Date.now() - startTime;

      // Check if latency is acceptable
      if (latencyMs > 1000) {
        return {
          name: this.name,
          status: 'degraded',
          latencyMs,
          message: 'Database responding slowly',
          lastChecked: new Date(),
        };
      }

      return {
        name: this.name,
        status: 'healthy',
        latencyMs,
        message: 'Database connection successful',
        lastChecked: new Date(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown database error';

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
 * Extended database health check with connection pool stats
 */
export class ExtendedDatabaseHealthChecker implements HealthChecker {
  name = 'database-extended';
  private prisma: PrismaClient;
  private timeoutMs: number;

  constructor(prisma: PrismaClient, timeoutMs: number = 5000) {
    this.prisma = prisma;
    this.timeoutMs = timeoutMs;
  }

  async check(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database check timed out')), this.timeoutMs);
      });

      // Get database stats
      const statsPromise = this.prisma.$queryRaw<Array<{ numbackends: bigint; xact_commit: bigint; xact_rollback: bigint }>>`
        SELECT numbackends, xact_commit, xact_rollback
        FROM pg_stat_database
        WHERE datname = current_database()
      `;

      const stats = await Promise.race([statsPromise, timeoutPromise]);
      const latencyMs = Date.now() - startTime;

      const dbStats = stats[0];
      const activeConnections = Number(dbStats?.numbackends || 0);
      const commits = Number(dbStats?.xact_commit || 0);
      const rollbacks = Number(dbStats?.xact_rollback || 0);

      return {
        name: this.name,
        status: 'healthy',
        latencyMs,
        message: 'Database statistics retrieved',
        details: {
          activeConnections,
          totalCommits: commits,
          totalRollbacks: rollbacks,
          rollbackRate: commits > 0 ? (rollbacks / (commits + rollbacks)) * 100 : 0,
        },
        lastChecked: new Date(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown database error';

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
