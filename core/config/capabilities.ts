/**
 * CampoTech Capability Map
 * ========================
 *
 * Master Kill-Switch Architecture / Feature Orchestration Layer
 *
 * This file is the SINGLE SOURCE OF TRUTH for all feature toggles in CampoTech.
 * It allows instant enabling/disabling of any subsystem without code changes.
 *
 * Documentation: /architecture/capabilities.md
 *
 * PRINCIPLES:
 * 1. All capabilities default to TRUE (full functionality)
 * 2. When FALSE, system uses fallback behavior (never throws)
 * 3. All checks are logged for observability
 * 4. Environment variables can override static values
 *
 * USAGE:
 * ```typescript
 * import { Capabilities, ensureCapability } from '@/core/config/capabilities';
 *
 * if (!ensureCapability("external.afip", Capabilities.external.afip)) {
 *   return createDraftInvoice(data); // fallback
 * }
 * return AfipService.requestCAE(data); // normal flow
 * ```
 */

// ═══════════════════════════════════════════════════════════════════════════════
// MASTER CAPABILITY MATRIX
// ═══════════════════════════════════════════════════════════════════════════════

export const Capabilities = {
  // ═══════════════════════════════════════════════════════════════════════════
  // EXTERNAL INTEGRATIONS
  // Third-party services that may fail independently
  // ═══════════════════════════════════════════════════════════════════════════
  external: {
    /**
     * AFIP Electronic Invoicing (CAE)
     * FALLBACK: Create draft invoices without CAE, queue for later processing
     */
    afip: true,

    /**
     * Mercado Pago Payment Processing
     * FALLBACK: Show cash + bank transfer options only
     */
    mercadopago: true,

    /**
     * WhatsApp Cloud API Messaging
     * FALLBACK: SMS for critical messages, skip promotional
     */
    whatsapp: true,

    /**
     * Voice AI (Whisper Transcription + Job Extraction)
     * FALLBACK: Prompt user to send text, log voice for manual review
     */
    whatsapp_voice_ai: true,

    /**
     * Mobile Push Notifications (Expo)
     * FALLBACK: In-app notifications only
     */
    push_notifications: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN CAPABILITIES
  // Core business logic modules
  // ═══════════════════════════════════════════════════════════════════════════
  domain: {
    /**
     * Invoice Creation and Management
     * FALLBACK: N/A (core module, should not be disabled)
     */
    invoicing: true,

    /**
     * Payment Processing and Recording
     * FALLBACK: Manual payment recording only
     */
    payments: true,

    /**
     * Job Scheduling and Calendar
     * FALLBACK: Create jobs without scheduling
     */
    scheduling: true,

    /**
     * Technician Assignment Logic
     * FALLBACK: Manual assignment only, no smart suggestions
     */
    job_assignment: true,

    /**
     * Mobile Offline Synchronization
     * FALLBACK: Online-only mode, show "connection required" message
     */
    offline_sync: true,

    /**
     * Real-time Technician GPS Tracking
     * FALLBACK: No location updates, static ETA estimates
     */
    technician_gps: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL SERVICES
  // Background workers and processing pipelines
  // ═══════════════════════════════════════════════════════════════════════════
  services: {
    /**
     * AFIP CAE Request Queue
     * FALLBACK: Direct AFIP calls (not recommended, risky)
     */
    cae_queue: true,

    /**
     * WhatsApp Message Queue
     * FALLBACK: Direct WhatsApp calls (not recommended, risky)
     */
    whatsapp_queue: true,

    /**
     * Mercado Pago Webhook Reconciliation
     * FALLBACK: Manual payment reconciliation
     */
    payment_reconciliation: true,

    /**
     * Suspicious Activity Detection
     * FALLBACK: No abuse protection (use with caution)
     */
    abuse_detection: true,

    /**
     * API Rate Limiting
     * FALLBACK: Unlimited API calls (use with extreme caution)
     */
    rate_limiting: true,

    /**
     * Metrics Collection Pipeline
     * FALLBACK: No analytics collection
     */
    analytics_pipeline: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UI CAPABILITIES
  // Frontend feature visibility
  // ═══════════════════════════════════════════════════════════════════════════
  ui: {
    /**
     * Simplified UI Mode (default for new users)
     * FALLBACK: Show advanced UI by default
     */
    simple_mode: true,

    /**
     * Advanced Features Visibility
     * FALLBACK: Hide advanced features entirely
     */
    advanced_mode: true,

    /**
     * Price Book Management
     * FALLBACK: Manual price entry only
     */
    pricebook: true,

    /**
     * Analytics/Reporting Dashboard
     * FALLBACK: Hide dashboard, basic lists only
     */
    reporting_dashboard: true,
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type ExternalCapability = keyof typeof Capabilities.external;
export type DomainCapability = keyof typeof Capabilities.domain;
export type ServiceCapability = keyof typeof Capabilities.services;
export type UICapability = keyof typeof Capabilities.ui;

export type CapabilityCategory = keyof typeof Capabilities;

export type CapabilityPath =
  | `external.${ExternalCapability}`
  | `domain.${DomainCapability}`
  | `services.${ServiceCapability}`
  | `ui.${UICapability}`;

// ═══════════════════════════════════════════════════════════════════════════════
// GUARD FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Universal capability guard with logging and observability
 *
 * Use this function at the entry point of any capability-dependent code path.
 * It logs when capabilities are disabled and returns false to trigger fallback behavior.
 *
 * @param path - Capability path for logging (e.g., "external.afip")
 * @param capability - Boolean value from Capabilities object
 * @returns boolean - true if capability is enabled, false otherwise
 *
 * @example
 * if (!ensureCapability("external.afip", Capabilities.external.afip)) {
 *   return createDraftInvoice(data); // fallback
 * }
 * return AfipService.requestCAE(data); // normal flow
 */
export function ensureCapability(path: string, capability: boolean): boolean {
  if (!capability) {
    console.warn(`[Capability Disabled] ${path}`);

    // Optional: Integrate with your observability stack
    // Sentry.addBreadcrumb({
    //   category: 'capability',
    //   message: `Capability disabled: ${path}`,
    //   level: 'warning',
    // });

    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC CAPABILITY CHECK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a capability is enabled by path string
 *
 * Useful for dynamic capability checks where the path is computed at runtime.
 *
 * @param path - Full capability path (e.g., "external.afip")
 * @returns boolean - true if capability is enabled
 *
 * @example
 * const isEnabled = isCapabilityEnabled("external.whatsapp");
 */
export function isCapabilityEnabled(path: CapabilityPath): boolean {
  const [category, capability] = path.split('.') as [CapabilityCategory, string];
  const categoryObj = Capabilities[category];

  if (!categoryObj || !(capability in categoryObj)) {
    console.error(`[Capability] Invalid path: ${path}`);
    return false;
  }

  return (categoryObj as Record<string, boolean>)[capability] ?? false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT OVERRIDE SUPPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get capability value with environment variable override support
 *
 * Environment variables take precedence over static configuration.
 * Format: CAPABILITY_CATEGORY_NAME (e.g., CAPABILITY_EXTERNAL_AFIP)
 *
 * @param category - Capability category (external, domain, services, ui)
 * @param capability - Capability name within the category
 * @returns boolean - Resolved capability value
 *
 * @example
 * // With env var CAPABILITY_EXTERNAL_AFIP=false
 * getCapabilityWithEnvOverride('external', 'afip') // returns false
 */
export function getCapabilityWithEnvOverride(
  category: CapabilityCategory,
  capability: string
): boolean {
  // Check environment override first
  const envKey = `CAPABILITY_${category.toUpperCase()}_${capability.toUpperCase()}`;
  const envValue = process.env[envKey];

  if (envValue !== undefined) {
    return envValue.toLowerCase() === 'true';
  }

  // Fall back to static configuration
  const categoryObj = Capabilities[category];
  if (!categoryObj || !(capability in categoryObj)) {
    return true; // Default to enabled for unknown capabilities
  }

  return (categoryObj as Record<string, boolean>)[capability] ?? true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY STATE EXPORT (for admin dashboard)
// ═══════════════════════════════════════════════════════════════════════════════

export interface CapabilityState {
  enabled: boolean;
  source: 'static' | 'environment';
  envVar?: string;
}

export interface CapabilitySnapshot {
  external: Record<ExternalCapability, CapabilityState>;
  domain: Record<DomainCapability, CapabilityState>;
  services: Record<ServiceCapability, CapabilityState>;
  ui: Record<UICapability, CapabilityState>;
}

/**
 * Get complete snapshot of all capability states
 *
 * Returns the current value and source (static vs environment) for each capability.
 * Useful for admin dashboards and debugging.
 *
 * @returns CapabilitySnapshot - Complete capability state
 */
export function getCapabilitySnapshot(): CapabilitySnapshot {
  const snapshot: CapabilitySnapshot = {
    external: {} as Record<ExternalCapability, CapabilityState>,
    domain: {} as Record<DomainCapability, CapabilityState>,
    services: {} as Record<ServiceCapability, CapabilityState>,
    ui: {} as Record<UICapability, CapabilityState>,
  };

  for (const category of Object.keys(Capabilities) as CapabilityCategory[]) {
    const categoryObj = Capabilities[category];

    for (const capability of Object.keys(categoryObj)) {
      const envKey = `CAPABILITY_${category.toUpperCase()}_${capability.toUpperCase()}`;
      const envValue = process.env[envKey];
      const hasEnvOverride = envValue !== undefined;

      (snapshot[category] as Record<string, CapabilityState>)[capability] = {
        enabled: hasEnvOverride
          ? envValue!.toLowerCase() === 'true'
          : (categoryObj as Record<string, boolean>)[capability],
        source: hasEnvOverride ? 'environment' : 'static',
        ...(hasEnvOverride && { envVar: envKey }),
      };
    }
  }

  return snapshot;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default Capabilities;
