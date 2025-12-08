/**
 * CampoTech Application Bootstrap
 * ================================
 *
 * Initializes all core services and integrations for the CampoTech application.
 * Call `bootstrapApplication()` during application startup.
 *
 * INITIALIZATION ORDER:
 * 1. Metrics collector (for observability from the start)
 * 2. Capability service (for feature flags)
 * 3. Environment override safety monitor
 * 4. Panic controller (for circuit breakers)
 * 5. Fair scheduler (for queue fairness)
 *
 * USAGE:
 * ```typescript
 * import { bootstrapApplication } from './core/bootstrap';
 *
 * async function main() {
 *   const services = await bootstrapApplication({
 *     database: yourDatabasePool,
 *     redis: yourRedisConnection,
 *   });
 *
 *   // Use services...
 *   app.get('/metrics', services.metricsHandler);
 * }
 * ```
 */

import {
  getCapabilityService,
  type CapabilityDatabaseAdapter,
} from './config/capabilities';
import {
  getEnvOverrideSafetyMonitor,
  type EnvOverrideSafetyConfig,
} from './config/env-override-safety';
import {
  getPanicController,
  type PanicControllerConfig,
} from './services/panic/panic-controller';
import {
  getFairScheduler,
  type FairSchedulerConfig,
} from './queue/fair-scheduler';
import {
  getMetricsCollector,
  getMetricsHandler,
  metrics,
} from './observability/metrics';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BootstrapConfig {
  /** Database connection for capability overrides */
  database?: {
    query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  };
  /** Redis connection for panic state persistence (optional) */
  redis?: unknown;
  /** Capability service configuration */
  capabilities?: {
    cacheTtlMs?: number;
  };
  /** Environment override safety configuration */
  envOverrideSafety?: Partial<EnvOverrideSafetyConfig>;
  /** Panic controller configuration */
  panicController?: Partial<PanicControllerConfig>;
  /** Fair scheduler configuration */
  fairScheduler?: Partial<FairSchedulerConfig>;
  /** Alert callback for panic mode changes */
  onPanicModeChange?: (integration: string, active: boolean, reason?: string) => void;
  /** Alert callback for stale environment overrides */
  onStaleOverride?: (envKey: string, ageHours: number) => void;
}

export interface BootstrapResult {
  /** Capability service instance */
  capabilityService: ReturnType<typeof getCapabilityService>;
  /** Environment override safety monitor */
  envOverrideMonitor: ReturnType<typeof getEnvOverrideSafetyMonitor>;
  /** Panic controller instance */
  panicController: ReturnType<typeof getPanicController>;
  /** Fair scheduler instance */
  fairScheduler: ReturnType<typeof getFairScheduler>;
  /** Metrics collector instance */
  metricsCollector: ReturnType<typeof getMetricsCollector>;
  /** Express/HTTP handler for /metrics endpoint */
  metricsHandler: ReturnType<typeof getMetricsHandler>;
  /** Convenience metrics object for direct use */
  metrics: typeof metrics;
  /** Shutdown function to cleanup resources */
  shutdown: () => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE ADAPTER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates a CapabilityDatabaseAdapter from a database connection
 */
function createDatabaseAdapter(
  db: BootstrapConfig['database']
): CapabilityDatabaseAdapter | undefined {
  if (!db) return undefined;

  return {
    async getOverride(capabilityPath: string, orgId?: string) {
      const result = await db.query<{
        enabled: boolean;
        reason: string | null;
        expires_at: Date | null;
      }>(
        `SELECT enabled, reason, expires_at
         FROM capability_overrides
         WHERE capability_path = $1
           AND (org_id = $2 OR (org_id IS NULL AND $2 IS NULL))
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY org_id NULLS LAST
         LIMIT 1`,
        [capabilityPath, orgId ?? null]
      );

      if (result.rows.length === 0) return null;

      return {
        enabled: result.rows[0].enabled,
        reason: result.rows[0].reason ?? undefined,
        expiresAt: result.rows[0].expires_at ?? undefined,
      };
    },

    async setOverride(capabilityPath: string, enabled: boolean, options?: {
      orgId?: string;
      reason?: string;
      expiresAt?: Date;
      disabledBy?: string;
    }) {
      await db.query(
        `INSERT INTO capability_overrides (capability_path, org_id, enabled, reason, expires_at, disabled_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (capability_path, COALESCE(org_id, '00000000-0000-0000-0000-000000000000'))
         DO UPDATE SET enabled = $3, reason = $4, expires_at = $5, disabled_by = $6, updated_at = NOW()`,
        [
          capabilityPath,
          options?.orgId ?? null,
          enabled,
          options?.reason ?? null,
          options?.expiresAt ?? null,
          options?.disabledBy ?? null,
        ]
      );
    },

    async clearOverride(capabilityPath: string, orgId?: string) {
      await db.query(
        `DELETE FROM capability_overrides
         WHERE capability_path = $1
           AND (org_id = $2 OR (org_id IS NULL AND $2 IS NULL))`,
        [capabilityPath, orgId ?? null]
      );
    },

    async getAllOverrides(orgId?: string) {
      const result = await db.query<{
        capability_path: string;
        enabled: boolean;
        reason: string | null;
        expires_at: Date | null;
        org_id: string | null;
      }>(
        `SELECT capability_path, enabled, reason, expires_at, org_id
         FROM capability_overrides
         WHERE (org_id = $1 OR org_id IS NULL OR $1 IS NULL)
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY capability_path`,
        [orgId ?? null]
      );

      return result.rows.map(row => ({
        capabilityPath: row.capability_path,
        enabled: row.enabled,
        reason: row.reason ?? undefined,
        expiresAt: row.expires_at ?? undefined,
        orgId: row.org_id ?? undefined,
      }));
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Bootstrap all CampoTech core services
 *
 * @param config - Bootstrap configuration
 * @returns Initialized services and utilities
 */
export async function bootstrapApplication(
  config: BootstrapConfig = {}
): Promise<BootstrapResult> {
  console.log('[Bootstrap] Initializing CampoTech core services...');

  // 1. Initialize metrics collector first (for observability)
  const metricsCollector = getMetricsCollector();
  console.log('[Bootstrap] Metrics collector initialized');

  // 2. Initialize capability service
  const capabilityService = getCapabilityService();
  const dbAdapter = createDatabaseAdapter(config.database);
  if (dbAdapter) {
    await capabilityService.initialize(dbAdapter);
    console.log('[Bootstrap] Capability service initialized with database');
  } else {
    console.log('[Bootstrap] Capability service initialized (no database - using defaults only)');
  }

  // 3. Initialize environment override safety monitor
  const envOverrideMonitor = getEnvOverrideSafetyMonitor({
    ...config.envOverrideSafety,
    onStaleOverride: config.onStaleOverride
      ? (info) => config.onStaleOverride!(info.envKey, Math.round((Date.now() - info.detectedAt.getTime()) / (60 * 60 * 1000)))
      : undefined,
  });
  envOverrideMonitor.initialize();
  console.log('[Bootstrap] Environment override safety monitor initialized');

  // 4. Initialize panic controller
  const panicController = getPanicController(config.panicController);
  await panicController.initialize();

  // Set up panic mode change alerts
  if (config.onPanicModeChange) {
    panicController.onPanicStateChange((integration, state) => {
      config.onPanicModeChange!(integration, state.active, state.reason);

      // Update metrics
      metrics.panicModeActive.set(
        { integration },
        state.active ? 1 : 0
      );
    });
  }
  console.log('[Bootstrap] Panic controller initialized');

  // 5. Initialize fair scheduler
  const fairScheduler = getFairScheduler(config.fairScheduler);
  console.log('[Bootstrap] Fair scheduler initialized');

  // Create shutdown function
  const shutdown = async () => {
    console.log('[Bootstrap] Shutting down services...');
    envOverrideMonitor.destroy();
    panicController.destroy();
    fairScheduler.reset();
    console.log('[Bootstrap] Shutdown complete');
  };

  console.log('[Bootstrap] All services initialized successfully');

  return {
    capabilityService,
    envOverrideMonitor,
    panicController,
    fairScheduler,
    metricsCollector,
    metricsHandler: getMetricsHandler(),
    metrics,
    shutdown,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS MIDDLEWARE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates Express middleware for capability checking
 *
 * @example
 * app.use('/api/invoices', requireCapability('domain.invoicing'));
 */
export function requireCapability(capabilityPath: string) {
  return async (
    req: { headers?: { 'x-org-id'?: string }; orgId?: string },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void
  ) => {
    const orgId = req.orgId ?? req.headers?.['x-org-id'];
    const capabilityService = getCapabilityService();

    const enabled = await capabilityService.isEnabled(capabilityPath, orgId);

    if (!enabled) {
      metrics.capabilityCheck.inc({
        capability: capabilityPath,
        result: 'blocked',
      });

      return res.status(503).json({
        error: 'Service temporarily unavailable',
        code: 'CAPABILITY_DISABLED',
        capability: capabilityPath,
      });
    }

    metrics.capabilityCheck.inc({
      capability: capabilityPath,
      result: 'allowed',
    });

    next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  getCapabilityService,
  getEnvOverrideSafetyMonitor,
  getPanicController,
  getFairScheduler,
  getMetricsCollector,
  getMetricsHandler,
  metrics,
};

export default bootstrapApplication;
