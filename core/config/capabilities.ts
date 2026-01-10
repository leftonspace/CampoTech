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
     * Voice AI V2 (LangGraph + Python Service)
     * 
     * Uses the new Python-based LangGraph workflow for voice processing:
     * - Whisper transcription
     * - GPT-4 job extraction with confidence scoring
     * - Automatic job creation (high confidence)
     * - Confirmation flow (medium confidence)
     * - Human review queue (low confidence)
     * 
     * REQUIREMENTS: Organization must have WhatsApp Business BSP connected
     * FALLBACK: N/A (V1 code removed - prompt user to send text)
     * 
     * V1 Code Removed: January 2026
     * Now the only voice processing system in CampoTech.
     */
    voice_ai_v2_langgraph: true, // Enabled for all orgs with WhatsApp BSP

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

    /**
     * Two-Sided Consumer Marketplace
     * FALLBACK: Show maintenance message, disable consumer app
     */
    consumer_marketplace: true,

    /**
     * White-Label Customer Tracking Portal
     * FALLBACK: Show "temporarily unavailable", SMS-only notifications
     */
    customer_portal: true,

    /**
     * Parts/Materials Inventory Tracking
     * FALLBACK: Manual inventory management, use pricebook only
     */
    inventory_management: true,

    /**
     * Comprehensive Audit Trail Logging
     * FALLBACK: Basic logs only, no change tracking
     */
    audit_logging: true,
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
     * Multi-Number WhatsApp Aggregation
     * FALLBACK: Single number only, no load balancing
     */
    whatsapp_aggregation: true,

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

    /**
     * Consumer Review Fraud Detection
     * FALLBACK: All reviews accepted without automated checks
     */
    review_fraud_detection: true,

    /**
     * Unified Notification Dispatch Queue
     * FALLBACK: Direct notification calls (higher latency)
     */
    notification_queue: true,
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

    /**
     * Consumer Marketplace Admin Dashboard
     * FALLBACK: Moderation via CLI/database only
     */
    marketplace_dashboard: true,

    /**
     * White-Label Portal Configuration UI
     * FALLBACK: Default CampoTech branding, no customization
     */
    whitelabel_portal: true,
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
    // Per spec: "All capabilities default to TRUE (full functionality)"
    // Unknown capabilities should default to enabled with warning
    console.warn(`[Capability] Unknown path: ${path}, defaulting to TRUE`);
    return true;
  }

  return (categoryObj as Record<string, boolean>)[capability] ?? true;
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
// DATABASE OVERRIDE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CapabilityOverride {
  id: string;
  org_id: string | null;        // null = global override
  capability_path: CapabilityPath;
  enabled: boolean;
  reason: string | null;
  disabled_by: string | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CapabilityOverrideInput {
  org_id?: string | null;
  capability_path: CapabilityPath;
  enabled: boolean;
  reason?: string;
  expires_at?: Date | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY SERVICE
// Database-backed capability management with caching
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CapabilityService - Centralized capability management with DB overrides
 *
 * Priority order (highest to lowest):
 * 1. Environment variables (emergency override)
 * 2. Per-organization database overrides
 * 3. Global database overrides (org_id = NULL)
 * 4. Static defaults from Capabilities object
 *
 * @example
 * const service = new CapabilityService(db);
 * await service.initialize();
 *
 * // Check capability for specific org
 * const canUseAfip = await service.isEnabled('external.afip', 'org-uuid');
 *
 * // Use guard pattern
 * if (!await service.ensure('external.afip', 'org-uuid')) {
 *   return fallbackBehavior();
 * }
 */
export class CapabilityService {
  private cache: Map<string, { value: boolean; expires: number }> = new Map();
  private globalOverrides: Map<string, boolean> = new Map();
  private orgOverrides: Map<string, Map<string, boolean>> = new Map();
  private initialized = false;
  private activeEnvOverrides: string[] = [];

  // Cache TTL in milliseconds (30 seconds default)
  private readonly CACHE_TTL = 30_000;

  // Database adapter interface (to be injected)
  private db: CapabilityDatabaseAdapter | null = null;

  constructor(db?: CapabilityDatabaseAdapter) {
    this.db = db ?? null;
  }

  /**
   * Initialize the service by loading overrides from database
   * Should be called once at application startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Check for active environment overrides and warn
    this.checkEnvironmentOverrides();

    // Load database overrides if DB adapter is available
    if (this.db) {
      await this.loadOverridesFromDatabase();
    }

    this.initialized = true;
    console.log('[CapabilityService] Initialized');
  }

  /**
   * Check if a capability is enabled for a specific organization
   *
   * @param path - Capability path (e.g., "external.afip")
   * @param orgId - Organization UUID (optional for global check)
   * @returns boolean - Whether the capability is enabled
   */
  async isEnabled(path: CapabilityPath, orgId?: string): Promise<boolean> {
    const cacheKey = orgId ? `${orgId}:${path}` : `global:${path}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    // Resolve capability value
    const value = await this.resolveCapability(path, orgId);

    // Cache the result
    this.cache.set(cacheKey, {
      value,
      expires: Date.now() + this.CACHE_TTL,
    });

    return value;
  }

  /**
   * Guard function - logs when capability is disabled
   *
   * @param path - Capability path
   * @param orgId - Organization UUID (optional)
   * @returns boolean - Whether to proceed (true) or use fallback (false)
   */
  async ensure(path: CapabilityPath, orgId?: string): Promise<boolean> {
    const enabled = await this.isEnabled(path, orgId);

    if (!enabled) {
      console.warn(`[Capability Disabled] ${path}${orgId ? ` for org ${orgId}` : ' (global)'}`);
    }

    return enabled;
  }

  /**
   * Resolve capability value following priority order
   */
  private async resolveCapability(path: CapabilityPath, orgId?: string): Promise<boolean> {
    const [category, capability] = path.split('.') as [CapabilityCategory, string];

    // 1. Check environment override (highest priority - emergency use)
    const envKey = `CAPABILITY_${category.toUpperCase()}_${capability.toUpperCase()}`;
    const envValue = process.env[envKey];
    if (envValue !== undefined) {
      return envValue.toLowerCase() === 'true';
    }

    // 2. Check per-org database override
    if (orgId) {
      const orgOverride = this.orgOverrides.get(orgId)?.get(path);
      if (orgOverride !== undefined) {
        // Check if expired (reload from DB if needed)
        return orgOverride;
      }
    }

    // 3. Check global database override (org_id = NULL)
    const globalOverride = this.globalOverrides.get(path);
    if (globalOverride !== undefined) {
      return globalOverride;
    }

    // 4. Fall back to static defaults
    const categoryObj = Capabilities[category];
    if (categoryObj && capability in categoryObj) {
      return (categoryObj as Record<string, boolean>)[capability] ?? true;
    }

    // Unknown capability - default to enabled per spec
    console.warn(`[Capability] Unknown path: ${path}, defaulting to TRUE`);
    return true;
  }

  /**
   * Load overrides from database
   */
  private async loadOverridesFromDatabase(): Promise<void> {
    if (!this.db) return;

    try {
      const overrides = await this.db.getAllActiveOverrides();

      // Clear existing overrides
      this.globalOverrides.clear();
      this.orgOverrides.clear();

      for (const override of overrides) {
        // Skip expired overrides
        if (override.expires_at && new Date(override.expires_at) < new Date()) {
          continue;
        }

        if (override.org_id) {
          // Per-org override
          if (!this.orgOverrides.has(override.org_id)) {
            this.orgOverrides.set(override.org_id, new Map());
          }
          this.orgOverrides.get(override.org_id)!.set(override.capability_path, override.enabled);
        } else {
          // Global override
          this.globalOverrides.set(override.capability_path, override.enabled);
        }
      }

      console.log(`[CapabilityService] Loaded ${overrides.length} overrides from database`);
    } catch (error) {
      console.error('[CapabilityService] Failed to load overrides from database:', error);
      // Continue with static defaults on error
    }
  }

  /**
   * Check for environment overrides and warn if any are active
   */
  private checkEnvironmentOverrides(): void {
    this.activeEnvOverrides = [];

    for (const category of Object.keys(Capabilities) as CapabilityCategory[]) {
      const categoryObj = Capabilities[category];
      for (const capability of Object.keys(categoryObj)) {
        const envKey = `CAPABILITY_${category.toUpperCase()}_${capability.toUpperCase()}`;
        if (process.env[envKey] !== undefined) {
          this.activeEnvOverrides.push(envKey);
        }
      }
    }

    if (this.activeEnvOverrides.length > 0) {
      console.warn('════════════════════════════════════════════════════════════════');
      console.warn('⚠️  ENVIRONMENT CAPABILITY OVERRIDES ACTIVE');
      console.warn('   These should be temporary. Use DB overrides for persistence.');
      console.warn('   Active overrides:');
      for (const envKey of this.activeEnvOverrides) {
        console.warn(`   - ${envKey}=${process.env[envKey]}`);
      }
      console.warn('════════════════════════════════════════════════════════════════');
    }
  }

  /**
   * Invalidate cache for a specific capability or all capabilities
   */
  invalidateCache(path?: CapabilityPath, orgId?: string): void {
    if (path && orgId) {
      this.cache.delete(`${orgId}:${path}`);
    } else if (path) {
      // Invalidate all orgs for this path
      for (const key of Array.from(this.cache.keys())) {
        if (key.endsWith(`:${path}`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Invalidate all
      this.cache.clear();
    }
  }

  /**
   * Reload overrides from database
   */
  async reloadOverrides(): Promise<void> {
    await this.loadOverridesFromDatabase();
    this.invalidateCache();
  }

  /**
   * Create or update an override
   */
  async setOverride(input: CapabilityOverrideInput, userId?: string): Promise<CapabilityOverride | null> {
    if (!this.db) {
      console.error('[CapabilityService] No database adapter configured');
      return null;
    }

    const override = await this.db.upsertOverride(input, userId);

    // Update local cache
    if (input.org_id) {
      if (!this.orgOverrides.has(input.org_id)) {
        this.orgOverrides.set(input.org_id, new Map());
      }
      this.orgOverrides.get(input.org_id)!.set(input.capability_path, input.enabled);
    } else {
      this.globalOverrides.set(input.capability_path, input.enabled);
    }

    // Invalidate cache
    this.invalidateCache(input.capability_path, input.org_id ?? undefined);

    console.log(`[CapabilityService] Override set: ${input.capability_path} = ${input.enabled}` +
      (input.org_id ? ` for org ${input.org_id}` : ' (global)') +
      (input.reason ? ` - ${input.reason}` : ''));

    return override;
  }

  /**
   * Remove an override (revert to default behavior)
   */
  async removeOverride(path: CapabilityPath, orgId?: string): Promise<boolean> {
    if (!this.db) {
      console.error('[CapabilityService] No database adapter configured');
      return false;
    }

    const success = await this.db.deleteOverride(path, orgId);

    if (success) {
      // Update local cache
      if (orgId) {
        this.orgOverrides.get(orgId)?.delete(path);
      } else {
        this.globalOverrides.delete(path);
      }

      // Invalidate cache
      this.invalidateCache(path, orgId);

      console.log(`[CapabilityService] Override removed: ${path}` +
        (orgId ? ` for org ${orgId}` : ' (global)'));
    }

    return success;
  }

  /**
   * Get all overrides (for admin dashboard)
   */
  async getAllOverrides(): Promise<CapabilityOverride[]> {
    if (!this.db) return [];
    return this.db.getAllActiveOverrides();
  }

  /**
   * Get overrides for a specific organization
   */
  async getOrgOverrides(orgId: string): Promise<CapabilityOverride[]> {
    if (!this.db) return [];
    return this.db.getOverridesForOrg(orgId);
  }

  /**
   * Get complete snapshot including DB overrides
   */
  async getFullSnapshot(orgId?: string): Promise<FullCapabilitySnapshot> {
    const snapshot: FullCapabilitySnapshot = {
      external: {} as Record<ExternalCapability, FullCapabilityState>,
      domain: {} as Record<DomainCapability, FullCapabilityState>,
      services: {} as Record<ServiceCapability, FullCapabilityState>,
      ui: {} as Record<UICapability, FullCapabilityState>,
    };

    for (const category of Object.keys(Capabilities) as CapabilityCategory[]) {
      const categoryObj = Capabilities[category];

      for (const capability of Object.keys(categoryObj)) {
        const path = `${category}.${capability}` as CapabilityPath;
        const [cat, cap] = path.split('.') as [CapabilityCategory, string];

        // Determine source and value
        const envKey = `CAPABILITY_${category.toUpperCase()}_${capability.toUpperCase()}`;
        const envValue = process.env[envKey];
        const hasEnvOverride = envValue !== undefined;

        const orgOverride = orgId ? this.orgOverrides.get(orgId)?.get(path) : undefined;
        const globalOverride = this.globalOverrides.get(path);

        let source: 'static' | 'environment' | 'database_org' | 'database_global' = 'static';
        let enabled: boolean;

        if (hasEnvOverride) {
          source = 'environment';
          enabled = envValue!.toLowerCase() === 'true';
        } else if (orgOverride !== undefined) {
          source = 'database_org';
          enabled = orgOverride;
        } else if (globalOverride !== undefined) {
          source = 'database_global';
          enabled = globalOverride;
        } else {
          enabled = (categoryObj as Record<string, boolean>)[capability] ?? true;
        }

        (snapshot[category] as Record<string, FullCapabilityState>)[capability] = {
          enabled,
          source,
          ...(hasEnvOverride && { envVar: envKey }),
        };
      }
    }

    return snapshot;
  }

  /**
   * Get active environment overrides (for monitoring)
   */
  getActiveEnvOverrides(): string[] {
    return [...this.activeEnvOverrides];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE ADAPTER INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Interface for database operations
 * Implement this interface to connect to your database
 */
export interface CapabilityDatabaseAdapter {
  getAllActiveOverrides(): Promise<CapabilityOverride[]>;
  getOverridesForOrg(orgId: string): Promise<CapabilityOverride[]>;
  upsertOverride(input: CapabilityOverrideInput, userId?: string): Promise<CapabilityOverride>;
  deleteOverride(path: CapabilityPath, orgId?: string): Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTENDED TYPES FOR FULL SNAPSHOT
// ═══════════════════════════════════════════════════════════════════════════════

export interface FullCapabilityState {
  enabled: boolean;
  source: 'static' | 'environment' | 'database_org' | 'database_global';
  envVar?: string;
}

export interface FullCapabilitySnapshot {
  external: Record<ExternalCapability, FullCapabilityState>;
  domain: Record<DomainCapability, FullCapabilityState>;
  services: Record<ServiceCapability, FullCapabilityState>;
  ui: Record<UICapability, FullCapabilityState>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE (for convenience)
// ═══════════════════════════════════════════════════════════════════════════════

let capabilityServiceInstance: CapabilityService | null = null;

/**
 * Get or create the singleton CapabilityService instance
 *
 * @param db - Database adapter (only needed on first call)
 * @returns CapabilityService instance
 */
export function getCapabilityService(db?: CapabilityDatabaseAdapter): CapabilityService {
  if (!capabilityServiceInstance) {
    capabilityServiceInstance = new CapabilityService(db);
  }
  return capabilityServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetCapabilityService(): void {
  capabilityServiceInstance = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default Capabilities;
