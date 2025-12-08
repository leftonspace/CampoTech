/**
 * Health Module
 * =============
 *
 * Health check system for monitoring application status
 *
 * Usage:
 * ```typescript
 * import { initHealthService, healthRouter, DatabaseHealthChecker } from '@/health';
 *
 * // Initialize the health service
 * const healthService = initHealthService();
 *
 * // Register checkers
 * healthService.registerChecker(new DatabaseHealthChecker(prisma));
 * healthService.registerChecker(new RedisHealthChecker(redis));
 * healthService.registerReadinessChecker(new DatabaseHealthChecker(prisma));
 *
 * // Mount routes
 * app.use(healthRouter);
 * ```
 *
 * Endpoints:
 * - GET /health - Full health check with all components
 * - GET /ready - Readiness probe (Kubernetes)
 * - GET /live - Liveness probe (Kubernetes)
 * - GET /health/components/:name - Individual component health
 */

export {
  HealthService,
  getHealthService,
  initHealthService,
} from './health.service';

export { healthRouter } from './health.controller';

export {
  DatabaseHealthChecker,
  ExtendedDatabaseHealthChecker,
  RedisHealthChecker,
  ExtendedRedisHealthChecker,
  WhatsAppHealthChecker,
  OpenAIHealthChecker,
  HTTPHealthChecker,
} from './checkers';

export type {
  HealthStatus,
  ComponentHealth,
  HealthCheckResult,
  ReadinessCheckResult,
  LivenessCheckResult,
  HealthChecker,
} from './health.types';
