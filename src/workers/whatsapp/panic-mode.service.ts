/**
 * Panic Mode Service
 * ==================
 *
 * Monitors integration health and triggers panic mode when critical issues detected.
 * Panic mode temporarily halts operations and alerts administrators.
 *
 * Triggers:
 * - High failure rate (>30% in 1 hour)
 * - Rate limiting from providers
 * - Authentication failures
 * - Critical API errors
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type IntegrationType = 'whatsapp' | 'afip' | 'mercadopago' | 'sms';

export type PanicReason =
  | 'high_failure_rate'
  | 'rate_limited'
  | 'auth_failure'
  | 'api_error'
  | 'manual';

export interface PanicState {
  active: boolean;
  integration: IntegrationType;
  reason: PanicReason;
  triggeredAt: Date;
  resolvedAt?: Date;
  metadata: Record<string, unknown>;
  autoResolveAt?: Date;
}

export interface PanicEvaluationResult {
  triggered: boolean;
  reason?: PanicReason;
  message?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const THRESHOLDS = {
  whatsapp: {
    failureRateThreshold: 0.3, // 30%
    minSampleSize: 10, // Need at least 10 messages to evaluate
    autoResolveMinutes: 60, // Auto-resolve after 1 hour
  },
  afip: {
    failureRateThreshold: 0.5, // 50% (AFIP can be flaky)
    minSampleSize: 5,
    autoResolveMinutes: 30,
  },
  mercadopago: {
    failureRateThreshold: 0.3,
    minSampleSize: 5,
    autoResolveMinutes: 30,
  },
  sms: {
    failureRateThreshold: 0.4,
    minSampleSize: 10,
    autoResolveMinutes: 60,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PANIC MODE SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class PanicModeService {
  /**
   * Evaluate if panic mode should be triggered
   */
  static async evaluate(
    organizationId: string,
    integration: IntegrationType,
    metrics: {
      failureRate?: number;
      errorCode?: number;
      errorTitle?: string;
      recentFailures?: number;
      totalMessages?: number;
    }
  ): Promise<PanicEvaluationResult> {
    const config = THRESHOLDS[integration];

    // Check if already in panic mode
    const existingPanic = await this.getActivePanic(organizationId, integration);
    if (existingPanic) {
      return { triggered: false, message: 'Already in panic mode' };
    }

    // Evaluate failure rate
    if (metrics.failureRate !== undefined && metrics.totalMessages !== undefined) {
      if (
        metrics.totalMessages >= config.minSampleSize &&
        metrics.failureRate > config.failureRateThreshold
      ) {
        await this.trigger(organizationId, integration, 'high_failure_rate', {
          failureRate: metrics.failureRate,
          threshold: config.failureRateThreshold,
          recentFailures: metrics.recentFailures,
          totalMessages: metrics.totalMessages,
        });

        return {
          triggered: true,
          reason: 'high_failure_rate',
          message: `Failure rate ${(metrics.failureRate * 100).toFixed(1)}% exceeds threshold`,
        };
      }
    }

    // Check for critical error codes (rate limiting, blocking)
    const rateLimitCodes = [131048, 131056, 429, 503];
    if (metrics.errorCode && rateLimitCodes.includes(metrics.errorCode)) {
      await this.trigger(organizationId, integration, 'rate_limited', {
        errorCode: metrics.errorCode,
        errorTitle: metrics.errorTitle,
      });

      return {
        triggered: true,
        reason: 'rate_limited',
        message: `Rate limit or blocking detected: ${metrics.errorTitle || metrics.errorCode}`,
      };
    }

    // Check for auth failures
    const authErrorCodes = [401, 403, 131051];
    if (metrics.errorCode && authErrorCodes.includes(metrics.errorCode)) {
      await this.trigger(organizationId, integration, 'auth_failure', {
        errorCode: metrics.errorCode,
        errorTitle: metrics.errorTitle,
      });

      return {
        triggered: true,
        reason: 'auth_failure',
        message: `Authentication failure: ${metrics.errorTitle || metrics.errorCode}`,
      };
    }

    return { triggered: false };
  }

  /**
   * Trigger panic mode for an integration
   */
  static async trigger(
    organizationId: string,
    integration: IntegrationType,
    reason: PanicReason,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const config = THRESHOLDS[integration];
    const autoResolveAt = new Date(
      Date.now() + config.autoResolveMinutes * 60 * 1000
    );

    await db.panicMode.create({
      data: {
        organizationId,
        integration,
        reason,
        metadata,
        active: true,
        triggeredAt: new Date(),
        autoResolveAt,
      },
    });

    log.error('PANIC MODE TRIGGERED', {
      organizationId,
      integration,
      reason,
      metadata,
      autoResolveAt: autoResolveAt.toISOString(),
    });

    // Notify administrators
    await this.notifyAdmins(organizationId, integration, reason, metadata);

    // Emit event for monitoring
    await this.emitPanicEvent(organizationId, integration, reason);
  }

  /**
   * Get active panic state for an organization/integration
   */
  static async getActivePanic(
    organizationId: string,
    integration: IntegrationType
  ): Promise<PanicState | null> {
    const panic = await db.panicMode.findFirst({
      where: {
        organizationId,
        integration,
        active: true,
      },
    });

    if (!panic) return null;

    // Check if should auto-resolve
    if (panic.autoResolveAt && panic.autoResolveAt <= new Date()) {
      await this.resolve(organizationId, integration, 'auto');
      return null;
    }

    return {
      active: panic.active,
      integration: panic.integration as IntegrationType,
      reason: panic.reason as PanicReason,
      triggeredAt: panic.triggeredAt,
      resolvedAt: panic.resolvedAt || undefined,
      metadata: panic.metadata as Record<string, unknown>,
      autoResolveAt: panic.autoResolveAt || undefined,
    };
  }

  /**
   * Check if an integration is in panic mode
   */
  static async isInPanic(
    organizationId: string,
    integration: IntegrationType
  ): Promise<boolean> {
    const panic = await this.getActivePanic(organizationId, integration);
    return panic !== null;
  }

  /**
   * Resolve panic mode
   */
  static async resolve(
    organizationId: string,
    integration: IntegrationType,
    resolvedBy: 'manual' | 'auto'
  ): Promise<void> {
    await db.panicMode.updateMany({
      where: {
        organizationId,
        integration,
        active: true,
      },
      data: {
        active: false,
        resolvedAt: new Date(),
        metadata: {
          resolvedBy,
          resolvedAt: new Date().toISOString(),
        },
      },
    });

    log.info('Panic mode resolved', {
      organizationId,
      integration,
      resolvedBy,
    });
  }

  /**
   * Get all active panics for an organization
   */
  static async getAllActivePanics(
    organizationId: string
  ): Promise<PanicState[]> {
    const panics = await db.panicMode.findMany({
      where: {
        organizationId,
        active: true,
      },
    });

    return panics.map((p: typeof panics[number]) => ({
      active: p.active,
      integration: p.integration as IntegrationType,
      reason: p.reason as PanicReason,
      triggeredAt: p.triggeredAt,
      resolvedAt: p.resolvedAt || undefined,
      metadata: p.metadata as Record<string, unknown>,
      autoResolveAt: p.autoResolveAt || undefined,
    }));
  }

  /**
   * Get panic history for an organization
   */
  static async getPanicHistory(
    organizationId: string,
    integration?: IntegrationType,
    limit: number = 20
  ): Promise<PanicState[]> {
    const panics = await db.panicMode.findMany({
      where: {
        organizationId,
        ...(integration ? { integration } : {}),
      },
      orderBy: { triggeredAt: 'desc' },
      take: limit,
    });

    return panics.map((p: typeof panics[number]) => ({
      active: p.active,
      integration: p.integration as IntegrationType,
      reason: p.reason as PanicReason,
      triggeredAt: p.triggeredAt,
      resolvedAt: p.resolvedAt || undefined,
      metadata: p.metadata as Record<string, unknown>,
      autoResolveAt: p.autoResolveAt || undefined,
    }));
  }

  /**
   * Notify organization admins about panic mode
   */
  private static async notifyAdmins(
    organizationId: string,
    integration: IntegrationType,
    reason: PanicReason,
    metadata: Record<string, unknown>
  ): Promise<void> {
    // Get organization admins
    const admins = await db.user.findMany({
      where: {
        organizationId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { id: true, email: true, phone: true },
    });

    // Create notifications for each admin
    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          type: 'panic_mode',
          title: `⚠️ Alerta: ${integration.toUpperCase()} en modo pánico`,
          body: getReasonMessage(reason),
          metadata: {
            integration,
            reason,
            ...metadata,
          },
          priority: 'critical',
        },
      });
    }

    log.info('Panic mode notifications sent', {
      organizationId,
      adminCount: admins.length,
    });
  }

  /**
   * Emit panic event for external monitoring
   */
  private static async emitPanicEvent(
    organizationId: string,
    integration: IntegrationType,
    reason: PanicReason
  ): Promise<void> {
    // Create an event record for monitoring dashboards
    await db.event.create({
      data: {
        organizationId,
        type: 'panic_mode_triggered',
        source: integration,
        data: { reason },
        severity: 'critical',
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getReasonMessage(reason: PanicReason): string {
  switch (reason) {
    case 'high_failure_rate':
      return 'Se detectó una alta tasa de errores. El sistema ha pausado temporalmente los envíos.';
    case 'rate_limited':
      return 'El proveedor ha limitado los envíos. El sistema está en pausa hasta que se levante la restricción.';
    case 'auth_failure':
      return 'Error de autenticación detectado. Verificá la configuración de credenciales.';
    case 'api_error':
      return 'Error crítico en la API del proveedor. El sistema está en pausa.';
    case 'manual':
      return 'Un administrador ha activado el modo pánico manualmente.';
    default:
      return 'Se ha detectado un problema crítico en la integración.';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANIC MODE CHECKER (for workers)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Guard function to check panic mode before processing
 * Returns false if operation should be blocked
 */
export async function canProcessMessage(
  organizationId: string,
  integration: IntegrationType
): Promise<boolean> {
  const inPanic = await PanicModeService.isInPanic(organizationId, integration);

  if (inPanic) {
    log.debug('Message blocked due to panic mode', {
      organizationId,
      integration,
    });
  }

  return !inPanic;
}

/**
 * Auto-resolve checker - run periodically
 */
export async function checkAutoResolve(): Promise<number> {
  const expired = await db.panicMode.findMany({
    where: {
      active: true,
      autoResolveAt: { lte: new Date() },
    },
  });

  let resolved = 0;

  for (const panic of expired) {
    await PanicModeService.resolve(
      panic.organizationId,
      panic.integration as IntegrationType,
      'auto'
    );
    resolved++;
  }

  if (resolved > 0) {
    log.info('Auto-resolved panic modes', { count: resolved });
  }

  return resolved;
}
