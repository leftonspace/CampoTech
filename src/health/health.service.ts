/**
 * Health Service
 * ==============
 *
 * Main service for health checks
 */

import type {
  HealthChecker,
  HealthCheckResult,
  ReadinessCheckResult,
  LivenessCheckResult,
  HealthStatus,
  ComponentHealth,
} from './health.types';

const startTime = Date.now();
const appVersion = process.env.APP_VERSION || process.env.npm_package_version || '0.0.0';

export class HealthService {
  private checkers: HealthChecker[] = [];
  private readinessCheckers: HealthChecker[] = [];
  private lastHealthCheck?: HealthCheckResult;
  private cacheMs: number;

  constructor(cacheMs: number = 5000) {
    this.cacheMs = cacheMs;
  }

  /**
   * Register a health checker for the /health endpoint
   */
  registerChecker(checker: HealthChecker): void {
    this.checkers.push(checker);
  }

  /**
   * Register a checker for the /ready endpoint
   * These are critical dependencies that must be healthy
   */
  registerReadinessChecker(checker: HealthChecker): void {
    this.readinessCheckers.push(checker);
  }

  /**
   * Perform full health check (/health)
   */
  async checkHealth(useCache: boolean = true): Promise<HealthCheckResult> {
    // Return cached result if fresh
    if (
      useCache &&
      this.lastHealthCheck &&
      Date.now() - this.lastHealthCheck.timestamp.getTime() < this.cacheMs
    ) {
      return this.lastHealthCheck;
    }

    // Run all checks in parallel
    const componentResults = await Promise.all(
      this.checkers.map((checker) => this.safeCheck(checker))
    );

    // Determine overall status
    const overallStatus = this.determineOverallStatus(componentResults);

    const result: HealthCheckResult = {
      status: overallStatus,
      version: appVersion,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date(),
      components: componentResults,
    };

    this.lastHealthCheck = result;
    return result;
  }

  /**
   * Check readiness (/ready)
   * Returns false if any critical dependency is unhealthy
   */
  async checkReadiness(): Promise<ReadinessCheckResult> {
    const checks = await Promise.all(
      this.readinessCheckers.map(async (checker) => {
        const result = await this.safeCheck(checker);
        return {
          name: result.name,
          ready: result.status !== 'unhealthy',
          message: result.message,
        };
      })
    );

    const ready = checks.every((check) => check.ready);

    return {
      ready,
      timestamp: new Date(),
      checks,
    };
  }

  /**
   * Check liveness (/live)
   * Simple check that the process is alive
   */
  checkLiveness(): LivenessCheckResult {
    const memUsage = process.memoryUsage();

    return {
      alive: true,
      timestamp: new Date(),
      pid: process.pid,
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
      },
    };
  }

  /**
   * Safe wrapper for health checks
   */
  private async safeCheck(checker: HealthChecker): Promise<ComponentHealth> {
    try {
      return await checker.check();
    } catch (error) {
      return {
        name: checker.name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Check failed',
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Determine overall health status from component results
   */
  private determineOverallStatus(components: ComponentHealth[]): HealthStatus {
    const hasUnhealthy = components.some((c) => c.status === 'unhealthy');
    const hasDegraded = components.some((c) => c.status === 'degraded');

    if (hasUnhealthy) return 'unhealthy';
    if (hasDegraded) return 'degraded';
    return 'healthy';
  }

  /**
   * Get the current status for metrics
   */
  getStatusCode(status: HealthStatus): number {
    switch (status) {
      case 'healthy':
        return 200;
      case 'degraded':
        return 200; // Still operational, just degraded
      case 'unhealthy':
        return 503;
    }
  }
}

// Singleton instance
let healthService: HealthService | null = null;

export function getHealthService(): HealthService {
  if (!healthService) {
    healthService = new HealthService();
  }
  return healthService;
}

export function initHealthService(cacheMs?: number): HealthService {
  healthService = new HealthService(cacheMs);
  return healthService;
}
