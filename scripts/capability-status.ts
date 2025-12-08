#!/usr/bin/env ts-node
/**
 * Capability Status CLI
 * =====================
 *
 * Shows current capability configuration and overrides.
 *
 * USAGE:
 *   npm run capability:status           # Show all capabilities
 *   npm run capability:status -- --report  # Generate detailed report
 */

import Capabilities, {
  getCapabilityService,
  type CapabilityCategory,
} from '../core/config/capabilities';
import {
  getEnvOverrideSafetyMonitor,
  getAllCapabilityEnvVarNames,
} from '../core/config/env-override-safety';

// ═══════════════════════════════════════════════════════════════════════════════
// CLI IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

async function showStatus(): Promise<void> {
  const service = getCapabilityService();
  const envMonitor = getEnvOverrideSafetyMonitor();
  envMonitor.initialize();

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              CAPABILITY STATUS                                  ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');

  // Show capabilities by category
  for (const category of Object.keys(Capabilities) as CapabilityCategory[]) {
    console.log(`║                                                                ║`);
    console.log(`║ ${category.toUpperCase().padEnd(62)} ║`);
    console.log('║ ────────────────────────────────────────────────────────────── ║');

    const categoryObj = Capabilities[category];
    for (const [name, defaultValue] of Object.entries(categoryObj)) {
      const path = `${category}.${name}`;
      const envKey = `CAPABILITY_${category.toUpperCase()}_${name.toUpperCase()}`;
      const envValue = process.env[envKey];

      // Determine effective value
      let effectiveValue = defaultValue;
      let source = 'default';

      if (envValue !== undefined) {
        effectiveValue = envValue.toLowerCase() === 'true';
        source = 'ENV';
      }

      const statusIcon = effectiveValue ? '✅' : '❌';
      const sourceTag = source === 'ENV' ? ' [ENV]' : '';

      console.log(
        `║   ${statusIcon} ${name.padEnd(25)} ${effectiveValue ? 'enabled' : 'disabled'}${sourceTag.padEnd(20)} ║`
      );
    }
  }

  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Show environment overrides if any
  const envOverrides = envMonitor.getActiveOverrides();
  if (envOverrides.length > 0) {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║         ⚠️  ACTIVE ENVIRONMENT OVERRIDES                       ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');

    for (const override of envOverrides) {
      const staleMarker = override.isStale ? ' 🚨 STALE' : '';
      console.log(`║ ${override.envKey}=${override.value}${staleMarker}`);
      console.log(`║   Path: ${override.capabilityPath}`);
      console.log(`║   Age: ${Math.round((Date.now() - override.detectedAt.getTime()) / (60 * 60 * 1000))} hours`);
      console.log('║ ────────────────────────────────────────────────────────────── ║');
    }

    console.log('╚════════════════════════════════════════════════════════════════╝');

    const staleCount = envOverrides.filter(o => o.isStale).length;
    if (staleCount > 0) {
      console.log(`\n⚠️  ${staleCount} override(s) are STALE (>24h). Consider removing or converting to DB override.`);
    }
  } else {
    console.log('\n✅ No environment overrides active.');
  }

  console.log('\n');
}

async function generateReport(): Promise<void> {
  const envMonitor = getEnvOverrideSafetyMonitor();
  envMonitor.initialize();

  console.log(envMonitor.generateReport());

  console.log('\nAll Capability Environment Variables:');
  console.log('─────────────────────────────────────');

  const allEnvVars = getAllCapabilityEnvVarNames();
  for (const envVar of allEnvVars) {
    const value = process.env[envVar];
    if (value !== undefined) {
      console.log(`  ${envVar}=${value} (SET)`);
    } else {
      console.log(`  ${envVar} (not set)`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isReport = args.includes('--report') || args.includes('-r');

  try {
    if (isReport) {
      await generateReport();
    } else {
      await showStatus();
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(console.error);
