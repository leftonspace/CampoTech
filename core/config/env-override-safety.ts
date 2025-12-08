/**
 * Environment Override Safety Utilities
 * ======================================
 *
 * Utilities for monitoring and managing environment-based capability overrides.
 * Environment overrides are intended for EMERGENCY USE ONLY and should not
 * become permanent configuration.
 *
 * IMPORTANT GUIDELINES:
 * 1. Environment overrides are for emergencies only (incidents, maintenance)
 * 2. Always document the reason when enabling an env override
 * 3. Set a reminder to remove the override after the incident
 * 4. Use database overrides for any change lasting > 24 hours
 * 5. Never commit env override values to version control
 *
 * MONITORING:
 * - This module emits warnings for stale overrides (> 24 hours)
 * - Integrate with your alerting system for long-running overrides
 * - Review active overrides during incident postmortems
 */

import Capabilities, {
  type CapabilityCategory,
  getCapabilityService,
} from './capabilities';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EnvOverrideInfo {
  envKey: string;
  value: string;
  capabilityPath: string;
  effectiveValue: boolean;
  /** Timestamp when first detected (app startup) */
  detectedAt: Date;
  /** Whether this override is considered stale (> threshold) */
  isStale: boolean;
}

export interface EnvOverrideSafetyConfig {
  /** Threshold in ms after which an override is considered stale (default: 24h) */
  staleThresholdMs: number;
  /** Alert callback for stale overrides */
  onStaleOverride?: (info: EnvOverrideInfo) => void;
  /** Whether to log warnings on startup */
  logWarnings: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_ENV_SAFETY_CONFIG: EnvOverrideSafetyConfig = {
  staleThresholdMs: 24 * 60 * 60 * 1000, // 24 hours
  logWarnings: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// OVERRIDE DETECTION TIMESTAMP FILE
// ═══════════════════════════════════════════════════════════════════════════════

// In a real implementation, this would be persisted to a file or database
// to track when overrides were first detected across restarts
const OVERRIDE_DETECTION_KEY = 'CAPABILITY_OVERRIDE_DETECTION_TIMESTAMP';

/**
 * Get the timestamp when overrides were first detected
 * In production, this should be persisted to disk/database
 */
function getOverrideDetectionTimestamp(): Date {
  const stored = process.env[OVERRIDE_DETECTION_KEY];
  if (stored) {
    return new Date(stored);
  }
  // If not stored, assume they were just set
  return new Date();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENV OVERRIDE SAFETY MONITOR
// ═══════════════════════════════════════════════════════════════════════════════

export class EnvOverrideSafetyMonitor {
  private config: EnvOverrideSafetyConfig;
  private detectedOverrides: Map<string, EnvOverrideInfo> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<EnvOverrideSafetyConfig>) {
    this.config = { ...DEFAULT_ENV_SAFETY_CONFIG, ...config };
  }

  /**
   * Initialize the monitor and detect active overrides
   */
  initialize(): void {
    this.detectActiveOverrides();

    if (this.config.logWarnings) {
      this.logOverrideWarnings();
    }

    // Check for stale overrides periodically (every hour)
    this.checkInterval = setInterval(() => {
      this.checkForStaleOverrides();
    }, 60 * 60 * 1000);
  }

  /**
   * Detect all active environment capability overrides
   */
  private detectActiveOverrides(): void {
    const detectionTime = getOverrideDetectionTimestamp();

    for (const category of Object.keys(Capabilities) as CapabilityCategory[]) {
      const categoryObj = Capabilities[category];

      for (const capability of Object.keys(categoryObj)) {
        const envKey = `CAPABILITY_${category.toUpperCase()}_${capability.toUpperCase()}`;
        const envValue = process.env[envKey];

        if (envValue !== undefined) {
          const capabilityPath = `${category}.${capability}`;
          const effectiveValue = envValue.toLowerCase() === 'true';
          const isStale = Date.now() - detectionTime.getTime() > this.config.staleThresholdMs;

          this.detectedOverrides.set(envKey, {
            envKey,
            value: envValue,
            capabilityPath,
            effectiveValue,
            detectedAt: detectionTime,
            isStale,
          });
        }
      }
    }
  }

  /**
   * Log warnings about active overrides
   */
  private logOverrideWarnings(): void {
    if (this.detectedOverrides.size === 0) return;

    console.warn('\n');
    console.warn('╔══════════════════════════════════════════════════════════════════════╗');
    console.warn('║           ⚠️  ENVIRONMENT CAPABILITY OVERRIDES DETECTED              ║');
    console.warn('╠══════════════════════════════════════════════════════════════════════╣');
    console.warn('║ Environment overrides should be TEMPORARY (emergency use only).      ║');
    console.warn('║ Use database overrides via admin dashboard for persistent changes.   ║');
    console.warn('╠══════════════════════════════════════════════════════════════════════╣');

    for (const [envKey, info] of this.detectedOverrides) {
      const staleMarker = info.isStale ? ' 🚨 STALE' : '';
      const status = info.effectiveValue ? 'ENABLED' : 'DISABLED';
      console.warn(`║ ${envKey}=${info.value}${staleMarker}`);
      console.warn(`║   └─ ${info.capabilityPath} is ${status}`);
    }

    console.warn('╠══════════════════════════════════════════════════════════════════════╣');
    console.warn('║ To remove overrides:                                                  ║');
    console.warn('║   1. Unset the environment variable                                   ║');
    console.warn('║   2. Restart the application                                          ║');
    console.warn('║   3. Or use: npm run capability:clear-env-overrides                  ║');
    console.warn('╚══════════════════════════════════════════════════════════════════════╝');
    console.warn('\n');
  }

  /**
   * Check for stale overrides and trigger alerts
   */
  checkForStaleOverrides(): void {
    const now = Date.now();

    for (const [envKey, info] of this.detectedOverrides) {
      const age = now - info.detectedAt.getTime();
      const wasStale = info.isStale;
      info.isStale = age > this.config.staleThresholdMs;

      // Alert when override becomes stale
      if (info.isStale && !wasStale && this.config.onStaleOverride) {
        this.config.onStaleOverride(info);
      }

      if (info.isStale) {
        const ageHours = Math.round(age / (60 * 60 * 1000));
        console.warn(
          `[EnvOverrideSafety] 🚨 STALE OVERRIDE: ${envKey} has been active for ${ageHours} hours. ` +
          `Consider removing or converting to database override.`
        );
      }
    }
  }

  /**
   * Get all detected overrides
   */
  getActiveOverrides(): EnvOverrideInfo[] {
    return Array.from(this.detectedOverrides.values());
  }

  /**
   * Get only stale overrides
   */
  getStaleOverrides(): EnvOverrideInfo[] {
    return this.getActiveOverrides().filter(info => info.isStale);
  }

  /**
   * Generate a report of current override status
   */
  generateReport(): string {
    const overrides = this.getActiveOverrides();

    if (overrides.length === 0) {
      return 'No environment capability overrides active.';
    }

    let report = 'Environment Capability Override Report\n';
    report += '======================================\n\n';
    report += `Total active overrides: ${overrides.length}\n`;
    report += `Stale overrides (>24h): ${overrides.filter(o => o.isStale).length}\n\n`;

    for (const info of overrides) {
      const ageMs = Date.now() - info.detectedAt.getTime();
      const ageHours = Math.round(ageMs / (60 * 60 * 1000));

      report += `${info.envKey}\n`;
      report += `  Capability: ${info.capabilityPath}\n`;
      report += `  Value: ${info.value} (${info.effectiveValue ? 'enabled' : 'disabled'})\n`;
      report += `  Age: ${ageHours} hours\n`;
      report += `  Status: ${info.isStale ? '🚨 STALE - Please review!' : '✅ Recent'}\n`;
      report += '\n';
    }

    return report;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get list of all possible capability environment variable names
 */
export function getAllCapabilityEnvVarNames(): string[] {
  const names: string[] = [];

  for (const category of Object.keys(Capabilities) as CapabilityCategory[]) {
    const categoryObj = Capabilities[category];
    for (const capability of Object.keys(categoryObj)) {
      names.push(`CAPABILITY_${category.toUpperCase()}_${capability.toUpperCase()}`);
    }
  }

  return names;
}

/**
 * Generate a shell script to clear all capability overrides
 */
export function generateClearOverridesScript(): string {
  const envVars = getAllCapabilityEnvVarNames();

  let script = '#!/bin/bash\n';
  script += '# Clear all capability environment overrides\n';
  script += '# Generated by env-override-safety.ts\n\n';

  for (const envVar of envVars) {
    script += `unset ${envVar}\n`;
  }

  script += '\necho "All capability overrides cleared."\n';
  script += 'echo "Restart the application for changes to take effect."\n';

  return script;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let monitorInstance: EnvOverrideSafetyMonitor | null = null;

export function getEnvOverrideSafetyMonitor(
  config?: Partial<EnvOverrideSafetyConfig>
): EnvOverrideSafetyMonitor {
  if (!monitorInstance) {
    monitorInstance = new EnvOverrideSafetyMonitor(config);
  }
  return monitorInstance;
}

export function resetEnvOverrideSafetyMonitor(): void {
  monitorInstance?.destroy();
  monitorInstance = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default EnvOverrideSafetyMonitor;
