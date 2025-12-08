/**
 * Capability Guards
 * =================
 *
 * This file provides guard utilities for all external service integrations.
 * Every external call MUST use these guards to ensure graceful degradation.
 *
 * USAGE:
 * ```typescript
 * import { guards } from '@/core/services/capability-guards';
 *
 * // In your service method:
 * async createInvoice(data: InvoiceData) {
 *   if (!await guards.afip(data.orgId)) {
 *     return this.createDraftInvoice(data); // Fallback
 *   }
 *   return this.requestCAE(data); // Normal flow
 * }
 * ```
 */

import {
  getCapabilityService,
  type CapabilityPath,
  type CapabilityDatabaseAdapter,
} from '../config/capabilities';

// ═══════════════════════════════════════════════════════════════════════════════
// GUARD TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface GuardResult {
  enabled: boolean;
  reason?: string;
}

export interface GuardOptions {
  /** Log when guard blocks execution */
  logOnBlock?: boolean;
  /** Custom fallback message */
  fallbackMessage?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GUARD FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a guard function for a specific capability
 */
function createGuard(path: CapabilityPath, defaultOptions?: GuardOptions) {
  return async (orgId?: string, options?: GuardOptions): Promise<boolean> => {
    const opts = { ...defaultOptions, ...options };
    const service = getCapabilityService();
    const enabled = await service.isEnabled(path, orgId);

    if (!enabled && opts.logOnBlock !== false) {
      console.warn(
        `[Guard Blocked] ${path}${orgId ? ` for org ${orgId}` : ''}` +
        (opts.fallbackMessage ? `: ${opts.fallbackMessage}` : '')
      );
    }

    return enabled;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTERNAL INTEGRATION GUARDS
// ═══════════════════════════════════════════════════════════════════════════════

export const guards = {
  // ─────────────────────────────────────────────────────────────────────────────
  // AFIP Electronic Invoicing
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Guard for AFIP CAE requests
   * FALLBACK: Create draft invoice without CAE, queue for later processing
   */
  afip: createGuard('external.afip', {
    fallbackMessage: 'Creating draft invoice without CAE',
  }),

  // ─────────────────────────────────────────────────────────────────────────────
  // Mercado Pago Payments
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Guard for Mercado Pago payment processing
   * FALLBACK: Show cash + bank transfer options only
   */
  mercadopago: createGuard('external.mercadopago', {
    fallbackMessage: 'Mercado Pago disabled, showing alternative payment methods',
  }),

  // ─────────────────────────────────────────────────────────────────────────────
  // WhatsApp Messaging
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Guard for WhatsApp Cloud API
   * FALLBACK: SMS for critical messages, skip promotional
   */
  whatsapp: createGuard('external.whatsapp', {
    fallbackMessage: 'WhatsApp disabled, using SMS fallback for critical messages',
  }),

  /**
   * Guard for Voice AI processing (Whisper + extraction)
   * FALLBACK: Prompt user to send text, log voice for manual review
   */
  voiceAI: createGuard('external.whatsapp_voice_ai', {
    fallbackMessage: 'Voice AI disabled, requesting text input',
  }),

  // ─────────────────────────────────────────────────────────────────────────────
  // Push Notifications
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Guard for Expo push notifications
   * FALLBACK: In-app notifications only
   */
  pushNotifications: createGuard('external.push_notifications', {
    fallbackMessage: 'Push notifications disabled, using in-app only',
  }),

  // ─────────────────────────────────────────────────────────────────────────────
  // Domain Capabilities
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Guard for invoicing module
   * WARNING: Core module, should rarely be disabled
   */
  invoicing: createGuard('domain.invoicing'),

  /**
   * Guard for payment processing
   * FALLBACK: Manual payment recording only
   */
  payments: createGuard('domain.payments', {
    fallbackMessage: 'Payment processing disabled, manual recording only',
  }),

  /**
   * Guard for job scheduling
   * FALLBACK: Create jobs without scheduling
   */
  scheduling: createGuard('domain.scheduling', {
    fallbackMessage: 'Scheduling disabled, jobs created without time slots',
  }),

  /**
   * Guard for technician assignment logic
   * FALLBACK: Manual assignment only, no smart suggestions
   */
  jobAssignment: createGuard('domain.job_assignment', {
    fallbackMessage: 'Smart assignment disabled, manual assignment only',
  }),

  /**
   * Guard for offline synchronization
   * FALLBACK: Online-only mode
   */
  offlineSync: createGuard('domain.offline_sync', {
    fallbackMessage: 'Offline sync disabled, connection required',
  }),

  /**
   * Guard for technician GPS tracking
   * FALLBACK: No location updates, static ETA estimates
   */
  technicianGPS: createGuard('domain.technician_gps', {
    fallbackMessage: 'GPS tracking disabled, using static ETAs',
  }),

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal Services
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Guard for CAE processing queue
   * FALLBACK: Direct AFIP calls (not recommended)
   */
  caeQueue: createGuard('services.cae_queue'),

  /**
   * Guard for WhatsApp message queue
   * FALLBACK: Direct WhatsApp calls (not recommended)
   */
  whatsappQueue: createGuard('services.whatsapp_queue'),

  /**
   * Guard for payment reconciliation service
   * FALLBACK: Manual reconciliation required
   */
  paymentReconciliation: createGuard('services.payment_reconciliation', {
    fallbackMessage: 'Auto-reconciliation disabled, manual processing required',
  }),

  /**
   * Guard for abuse detection
   * WARNING: Disabling removes fraud protection
   */
  abuseDetection: createGuard('services.abuse_detection'),

  /**
   * Guard for API rate limiting
   * WARNING: Disabling can expose system to abuse
   */
  rateLimiting: createGuard('services.rate_limiting'),

  /**
   * Guard for analytics pipeline
   * FALLBACK: No metrics collection
   */
  analyticsPipeline: createGuard('services.analytics_pipeline', {
    fallbackMessage: 'Analytics collection disabled',
  }),

  // ─────────────────────────────────────────────────────────────────────────────
  // UI Capabilities
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Guard for simple mode UI
   */
  simpleMode: createGuard('ui.simple_mode'),

  /**
   * Guard for advanced mode features
   * FALLBACK: Hide advanced features
   */
  advancedMode: createGuard('ui.advanced_mode'),

  /**
   * Guard for price book management
   * FALLBACK: Manual price entry only
   */
  pricebook: createGuard('ui.pricebook', {
    fallbackMessage: 'Price book disabled, manual entry required',
  }),

  /**
   * Guard for reporting dashboard
   * FALLBACK: Basic lists only, no analytics
   */
  reportingDashboard: createGuard('ui.reporting_dashboard', {
    fallbackMessage: 'Reporting dashboard disabled',
  }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize the capability service with a database adapter
 * Call this once at application startup
 */
export async function initializeCapabilities(db?: CapabilityDatabaseAdapter): Promise<void> {
  const service = getCapabilityService(db);
  await service.initialize();
}

/**
 * Check multiple capabilities at once
 * Returns true only if ALL capabilities are enabled
 */
export async function checkAllCapabilities(
  paths: CapabilityPath[],
  orgId?: string
): Promise<boolean> {
  const service = getCapabilityService();
  const results = await Promise.all(
    paths.map(path => service.isEnabled(path, orgId))
  );
  return results.every(Boolean);
}

/**
 * Check if any of the capabilities are enabled
 * Returns true if AT LEAST ONE capability is enabled
 */
export async function checkAnyCapability(
  paths: CapabilityPath[],
  orgId?: string
): Promise<boolean> {
  const service = getCapabilityService();
  const results = await Promise.all(
    paths.map(path => service.isEnabled(path, orgId))
  );
  return results.some(Boolean);
}

/**
 * Decorator for async methods that require a capability
 * Usage:
 * ```typescript
 * class MyService {
 *   @requireCapability('external.afip')
 *   async requestCAE(data: any) { ... }
 * }
 * ```
 */
export function requireCapability(path: CapabilityPath) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: { orgId?: string }, ...args: unknown[]) {
      const service = getCapabilityService();
      const enabled = await service.isEnabled(path, this.orgId);

      if (!enabled) {
        throw new CapabilityDisabledError(path, this.orgId);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class CapabilityDisabledError extends Error {
  public readonly capability: CapabilityPath;
  public readonly orgId?: string;

  constructor(capability: CapabilityPath, orgId?: string) {
    super(`Capability '${capability}' is disabled${orgId ? ` for org ${orgId}` : ''}`);
    this.name = 'CapabilityDisabledError';
    this.capability = capability;
    this.orgId = orgId;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default guards;
