/**
 * Health Controller
 * =================
 *
 * Express routes for health check endpoints
 */

import { Router, Request, Response } from 'express';
import { getHealthService } from './health.service';

const router = Router();
const healthService = getHealthService();

/**
 * GET /health
 *
 * Full health check including all registered components.
 * Returns 200 for healthy/degraded, 503 for unhealthy.
 *
 * Query params:
 * - nocache: Skip cache and force fresh check
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const useCache = req.query.nocache === undefined;
    const result = await healthService.checkHealth(useCache);
    const statusCode = healthService.getStatusCode(result.status);

    res.status(statusCode).json(result);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date(),
    });
  }
});

/**
 * GET /ready
 *
 * Readiness probe for Kubernetes.
 * Returns 200 if ready to accept traffic, 503 otherwise.
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const result = await healthService.checkReadiness();
    const statusCode = result.ready ? 200 : 503;

    res.status(statusCode).json(result);
  } catch (error) {
    res.status(503).json({
      ready: false,
      message: error instanceof Error ? error.message : 'Readiness check failed',
      timestamp: new Date(),
    });
  }
});

/**
 * GET /live
 *
 * Liveness probe for Kubernetes.
 * Returns 200 if the process is alive.
 * This should never fail unless the process is dead.
 */
router.get('/live', (_req: Request, res: Response) => {
  try {
    const result = healthService.checkLiveness();
    res.status(200).json(result);
  } catch (error) {
    // If this fails, the process is in a bad state
    res.status(503).json({
      alive: false,
      message: error instanceof Error ? error.message : 'Liveness check failed',
      timestamp: new Date(),
    });
  }
});

/**
 * GET /health/components/:name
 *
 * Get health status of a specific component
 */
router.get('/health/components/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const result = await healthService.checkHealth(false);

    const component = result.components.find((c) => c.name === name);

    if (!component) {
      res.status(404).json({
        error: 'Component not found',
        availableComponents: result.components.map((c) => c.name),
      });
      return;
    }

    const statusCode = component.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(component);
  } catch (error) {
    res.status(503).json({
      error: error instanceof Error ? error.message : 'Check failed',
    });
  }
});

export { router as healthRouter };
