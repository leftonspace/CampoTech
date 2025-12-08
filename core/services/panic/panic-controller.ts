/**
 * Panic Mode Controller
 * =====================
 *
 * Automatically detects integration failures and triggers panic mode
 * to protect the system and enable graceful degradation.
 *
 * PANIC MODE FLOW:
 * 1. Monitor failure rates for each integration
 * 2. When threshold exceeded, trigger panic mode
 * 3. Disable capability via CapabilityService
 * 4. Queue jobs for later processing
 * 5. Send alerts to operations team
 * 6. Monitor for recovery
 * 7. Automatically re-enable when healthy
 *
 * USAGE:
 * ```typescript
 * const panicController = new PanicController(capabilityService, alertService);
 * await panicController.initialize();
 *
 * // Record failures from service calls
 * panicController.recordFailure('afip');
 * panicController.recordSuccess('afip');
 *
 * // Manual control
 * await panicController.enablePanic('afip', 'Manual trigger: AFIP maintenance');
 * await panicController.disablePanic('afip');
 * ```
 */

import {
  CapabilityService,
  getCapabilityService,
  type CapabilityPath,
} from '../../config/capabilities';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type IntegrationName = 'afip' | 'whatsapp' | 'mercadopago' | 'openai_voice';

export interface PanicThreshold {
  /** Number of consecutive failures to trigger panic */
  failureThreshold: number;
  /** Time window in milliseconds for failure counting */
  windowMs: number;
  /** How long to keep panic mode active (ms) */
  panicDurationMs: number;
  /** Interval for recovery probes (ms) */
  recoveryProbeIntervalMs: number;
  /** Number of successful probes needed to recover */
  recoveryProbesRequired: number;
  /** Capability path to disable */
  capabilityPath: CapabilityPath;
}

export interface PanicState {
  integration: IntegrationName;
  active: boolean;
  triggeredAt: Date | null;
  reason: string | null;
  failureCount: number;
  lastFailureAt: Date | null;
  recoveryProbesSuccessful: number;
  autoRecoveryEnabled: boolean;
}

export interface PanicEvent {
  type: 'panic_enabled' | 'panic_disabled' | 'recovery_started' | 'recovery_complete';
  integration: IntegrationName;
  reason: string;
  timestamp: Date;
  automatic: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT THRESHOLDS (from architecture spec)
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_PANIC_THRESHOLDS: Record<IntegrationName, PanicThreshold> = {
  afip: {
    failureThreshold: 5,
    windowMs: 5 * 60 * 1000,           // 5 minutes
    panicDurationMs: 15 * 60 * 1000,   // 15 minutes minimum
    recoveryProbeIntervalMs: 30 * 1000, // 30 seconds
    recoveryProbesRequired: 3,
    capabilityPath: 'external.afip',
  },
  whatsapp: {
    failureThreshold: 10,
    windowMs: 1 * 60 * 1000,           // 1 minute
    panicDurationMs: 10 * 60 * 1000,   // 10 minutes minimum
    recoveryProbeIntervalMs: 15 * 1000, // 15 seconds
    recoveryProbesRequired: 5,
    capabilityPath: 'external.whatsapp',
  },
  mercadopago: {
    failureThreshold: 5,
    windowMs: 2 * 60 * 1000,           // 2 minutes
    panicDurationMs: 10 * 60 * 1000,   // 10 minutes minimum
    recoveryProbeIntervalMs: 30 * 1000, // 30 seconds
    recoveryProbesRequired: 3,
    capabilityPath: 'external.mercadopago',
  },
  openai_voice: {
    failureThreshold: 3,
    windowMs: 30 * 1000,               // 30 seconds
    panicDurationMs: 5 * 60 * 1000,    // 5 minutes minimum
    recoveryProbeIntervalMs: 10 * 1000, // 10 seconds
    recoveryProbesRequired: 3,
    capabilityPath: 'external.whatsapp_voice_ai',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PANIC CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

export class PanicController {
  private states: Map<IntegrationName, PanicState> = new Map();
  private failureTimestamps: Map<IntegrationName, Date[]> = new Map();
  private thresholds: Record<IntegrationName, PanicThreshold>;
  private recoveryTimers: Map<IntegrationName, NodeJS.Timeout> = new Map();
  private eventListeners: Array<(event: PanicEvent) => void> = [];
  private capabilityService: CapabilityService;
  private alertService: AlertService | null;
  private initialized = false;

  constructor(
    capabilityService?: CapabilityService,
    alertService?: AlertService,
    thresholds?: Partial<Record<IntegrationName, Partial<PanicThreshold>>>
  ) {
    this.capabilityService = capabilityService ?? getCapabilityService();
    this.alertService = alertService ?? null;

    // Merge custom thresholds with defaults
    this.thresholds = { ...DEFAULT_PANIC_THRESHOLDS };
    if (thresholds) {
      for (const [key, value] of Object.entries(thresholds)) {
        if (value) {
          this.thresholds[key as IntegrationName] = {
            ...this.thresholds[key as IntegrationName],
            ...value,
          };
        }
      }
    }

    // Initialize states
    for (const integration of Object.keys(this.thresholds) as IntegrationName[]) {
      this.states.set(integration, this.createInitialState(integration));
      this.failureTimestamps.set(integration, []);
    }
  }

  /**
   * Initialize the panic controller
   * Loads persisted state and starts recovery monitoring
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load persisted panic states from capability overrides
    await this.loadPersistedStates();

    // Start recovery monitoring for any active panic modes
    for (const [integration, state] of this.states) {
      if (state.active && state.autoRecoveryEnabled) {
        this.startRecoveryMonitoring(integration);
      }
    }

    this.initialized = true;
    console.log('[PanicController] Initialized');
  }

  /**
   * Record a failure for an integration
   */
  recordFailure(integration: IntegrationName, error?: Error): void {
    const now = new Date();
    const threshold = this.thresholds[integration];
    const timestamps = this.failureTimestamps.get(integration) ?? [];

    // Add new failure timestamp
    timestamps.push(now);

    // Remove timestamps outside the window
    const windowStart = new Date(now.getTime() - threshold.windowMs);
    const recentFailures = timestamps.filter(t => t >= windowStart);
    this.failureTimestamps.set(integration, recentFailures);

    // Update state
    const state = this.states.get(integration)!;
    state.failureCount = recentFailures.length;
    state.lastFailureAt = now;

    console.log(
      `[PanicController] ${integration} failure recorded. ` +
      `Count: ${recentFailures.length}/${threshold.failureThreshold} in window. ` +
      (error ? `Error: ${error.message}` : '')
    );

    // Check if we should trigger panic
    if (!state.active && recentFailures.length >= threshold.failureThreshold) {
      this.triggerPanic(
        integration,
        `Automatic trigger: ${recentFailures.length} consecutive failures in ${threshold.windowMs / 1000}s`,
        true
      );
    }
  }

  /**
   * Record a success for an integration
   */
  recordSuccess(integration: IntegrationName): void {
    const state = this.states.get(integration);
    if (!state) return;

    // Clear failure timestamps on success
    this.failureTimestamps.set(integration, []);
    state.failureCount = 0;

    // If in panic mode with auto-recovery, count successful probe
    if (state.active && state.autoRecoveryEnabled) {
      state.recoveryProbesSuccessful++;

      const threshold = this.thresholds[integration];
      console.log(
        `[PanicController] ${integration} recovery probe successful. ` +
        `${state.recoveryProbesSuccessful}/${threshold.recoveryProbesRequired}`
      );

      if (state.recoveryProbesSuccessful >= threshold.recoveryProbesRequired) {
        this.disablePanic(integration, 'Auto-recovery: service healthy', true);
      }
    }
  }

  /**
   * Manually enable panic mode for an integration
   */
  async enablePanic(
    integration: IntegrationName,
    reason: string,
    autoRecovery = true
  ): Promise<void> {
    await this.triggerPanic(integration, reason, false, autoRecovery);
  }

  /**
   * Manually disable panic mode for an integration
   */
  async disablePanic(
    integration: IntegrationName,
    reason = 'Manual disable',
    automatic = false
  ): Promise<void> {
    const state = this.states.get(integration);
    if (!state?.active) {
      console.log(`[PanicController] ${integration} is not in panic mode`);
      return;
    }

    // Re-enable the capability
    const threshold = this.thresholds[integration];
    await this.capabilityService.removeOverride(threshold.capabilityPath);

    // Update state
    state.active = false;
    state.triggeredAt = null;
    state.reason = null;
    state.recoveryProbesSuccessful = 0;

    // Stop recovery monitoring
    this.stopRecoveryMonitoring(integration);

    // Clear failure history
    this.failureTimestamps.set(integration, []);
    state.failureCount = 0;

    // Emit event
    this.emitEvent({
      type: 'panic_disabled',
      integration,
      reason,
      timestamp: new Date(),
      automatic,
    });

    // Send alert
    await this.sendAlert(
      automatic ? 'info' : 'warning',
      `Panic mode DISABLED for ${integration}`,
      reason
    );

    console.log(`[PanicController] Panic mode DISABLED for ${integration}: ${reason}`);
  }

  /**
   * Get current panic state for an integration
   */
  getState(integration: IntegrationName): PanicState | undefined {
    return this.states.get(integration);
  }

  /**
   * Get all panic states
   */
  getAllStates(): Map<IntegrationName, PanicState> {
    return new Map(this.states);
  }

  /**
   * Get summary of all integrations
   */
  getStatusSummary(): Array<{
    integration: IntegrationName;
    status: 'healthy' | 'degraded' | 'panic';
    failureCount: number;
    panicReason: string | null;
  }> {
    const summary: Array<{
      integration: IntegrationName;
      status: 'healthy' | 'degraded' | 'panic';
      failureCount: number;
      panicReason: string | null;
    }> = [];

    for (const [integration, state] of this.states) {
      const threshold = this.thresholds[integration];
      let status: 'healthy' | 'degraded' | 'panic';

      if (state.active) {
        status = 'panic';
      } else if (state.failureCount > threshold.failureThreshold / 2) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      summary.push({
        integration,
        status,
        failureCount: state.failureCount,
        panicReason: state.reason,
      });
    }

    return summary;
  }

  /**
   * Subscribe to panic events
   */
  onEvent(listener: (event: PanicEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index >= 0) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Trigger panic mode for an integration
   */
  private async triggerPanic(
    integration: IntegrationName,
    reason: string,
    automatic: boolean,
    autoRecovery = true
  ): Promise<void> {
    const state = this.states.get(integration)!;
    const threshold = this.thresholds[integration];

    // Disable the capability
    await this.capabilityService.setOverride({
      capability_path: threshold.capabilityPath,
      enabled: false,
      reason: `PANIC: ${reason}`,
    });

    // Update state
    state.active = true;
    state.triggeredAt = new Date();
    state.reason = reason;
    state.autoRecoveryEnabled = autoRecovery;
    state.recoveryProbesSuccessful = 0;

    // Emit event
    this.emitEvent({
      type: 'panic_enabled',
      integration,
      reason,
      timestamp: new Date(),
      automatic,
    });

    // Send alert
    await this.sendAlert(
      'critical',
      `🚨 PANIC MODE ENABLED for ${integration}`,
      `${reason}\n\nFallback behavior is now active. Auto-recovery: ${autoRecovery ? 'enabled' : 'disabled'}`
    );

    console.log(`[PanicController] 🚨 PANIC MODE ENABLED for ${integration}: ${reason}`);

    // Start recovery monitoring if auto-recovery is enabled
    if (autoRecovery) {
      this.startRecoveryMonitoring(integration);
    }
  }

  /**
   * Start monitoring for recovery
   */
  private startRecoveryMonitoring(integration: IntegrationName): void {
    // Stop any existing timer
    this.stopRecoveryMonitoring(integration);

    const threshold = this.thresholds[integration];
    const state = this.states.get(integration)!;

    console.log(
      `[PanicController] Starting recovery monitoring for ${integration}. ` +
      `Probing every ${threshold.recoveryProbeIntervalMs / 1000}s`
    );

    // Emit recovery started event
    this.emitEvent({
      type: 'recovery_started',
      integration,
      reason: 'Auto-recovery monitoring started',
      timestamp: new Date(),
      automatic: true,
    });

    // Note: Actual health probes would be implemented per-integration
    // This timer just tracks recovery probe timing
    const timer = setInterval(() => {
      // Reset probe count if minimum panic duration hasn't passed
      if (state.triggeredAt) {
        const elapsed = Date.now() - state.triggeredAt.getTime();
        if (elapsed < threshold.panicDurationMs) {
          console.log(
            `[PanicController] ${integration} minimum panic duration not reached. ` +
            `${Math.round((threshold.panicDurationMs - elapsed) / 1000)}s remaining`
          );
          return;
        }
      }

      // Health probe would be called here
      // For now, external code calls recordSuccess() or recordFailure()
      console.log(`[PanicController] ${integration} recovery probe scheduled`);
    }, threshold.recoveryProbeIntervalMs);

    this.recoveryTimers.set(integration, timer);
  }

  /**
   * Stop recovery monitoring
   */
  private stopRecoveryMonitoring(integration: IntegrationName): void {
    const timer = this.recoveryTimers.get(integration);
    if (timer) {
      clearInterval(timer);
      this.recoveryTimers.delete(integration);
    }
  }

  /**
   * Load persisted panic states from capability overrides
   */
  private async loadPersistedStates(): Promise<void> {
    try {
      const overrides = await this.capabilityService.getAllOverrides();

      for (const override of overrides) {
        // Find integration by capability path
        for (const [integration, threshold] of Object.entries(this.thresholds)) {
          if (threshold.capabilityPath === override.capability_path && !override.enabled) {
            const state = this.states.get(integration as IntegrationName)!;
            state.active = true;
            state.triggeredAt = override.created_at;
            state.reason = override.reason ?? 'Persisted panic state';
            state.autoRecoveryEnabled = true;

            console.log(
              `[PanicController] Loaded persisted panic state for ${integration}: ${state.reason}`
            );
          }
        }
      }
    } catch (error) {
      console.error('[PanicController] Failed to load persisted states:', error);
    }
  }

  /**
   * Create initial state for an integration
   */
  private createInitialState(integration: IntegrationName): PanicState {
    return {
      integration,
      active: false,
      triggeredAt: null,
      reason: null,
      failureCount: 0,
      lastFailureAt: null,
      recoveryProbesSuccessful: 0,
      autoRecoveryEnabled: true,
    };
  }

  /**
   * Emit a panic event to all listeners
   */
  private emitEvent(event: PanicEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[PanicController] Event listener error:', error);
      }
    }
  }

  /**
   * Send alert via alert service
   */
  private async sendAlert(
    severity: 'info' | 'warning' | 'critical',
    title: string,
    message: string
  ): Promise<void> {
    if (!this.alertService) {
      console.log(`[PanicController] Alert (${severity}): ${title} - ${message}`);
      return;
    }

    try {
      await this.alertService.send({ severity, title, message });
    } catch (error) {
      console.error('[PanicController] Failed to send alert:', error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    for (const timer of this.recoveryTimers.values()) {
      clearInterval(timer);
    }
    this.recoveryTimers.clear();
    this.eventListeners = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT SERVICE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

export interface AlertService {
  send(alert: {
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
  }): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let panicControllerInstance: PanicController | null = null;

export function getPanicController(
  capabilityService?: CapabilityService,
  alertService?: AlertService
): PanicController {
  if (!panicControllerInstance) {
    panicControllerInstance = new PanicController(capabilityService, alertService);
  }
  return panicControllerInstance;
}

export function resetPanicController(): void {
  if (panicControllerInstance) {
    panicControllerInstance.destroy();
    panicControllerInstance = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default PanicController;
