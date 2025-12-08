#!/usr/bin/env ts-node
/**
 * Panic Mode CLI
 * ==============
 *
 * Command-line interface for managing panic mode states.
 *
 * USAGE:
 *   npm run panic:status              # Show all integration statuses
 *   npm run panic:enable <integration> [reason]   # Enable panic mode
 *   npm run panic:disable <integration> [reason]  # Disable panic mode
 *
 * EXAMPLES:
 *   npm run panic:enable afip "AFIP maintenance window"
 *   npm run panic:disable afip "Maintenance complete"
 *   npm run panic:status
 */

import {
  PanicController,
  getPanicController,
  type IntegrationName,
  DEFAULT_PANIC_THRESHOLDS,
} from '../../core/services/panic/panic-controller';
import { getCapabilityService } from '../../core/config/capabilities';

// ═══════════════════════════════════════════════════════════════════════════════
// CLI COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

async function showStatus(): Promise<void> {
  const controller = getPanicController();
  await controller.initialize();

  const summary = controller.getStatusSummary();

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║              PANIC MODE STATUS                                  ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');

  for (const item of summary) {
    const statusIcon = {
      healthy: '✅',
      degraded: '⚠️ ',
      panic: '🚨',
    }[item.status];

    const statusColor = {
      healthy: '\x1b[32m',  // Green
      degraded: '\x1b[33m', // Yellow
      panic: '\x1b[31m',    // Red
    }[item.status];

    const reset = '\x1b[0m';

    console.log(
      `║ ${statusIcon} ${item.integration.padEnd(15)} ${statusColor}${item.status.toUpperCase().padEnd(10)}${reset} ` +
      `Failures: ${item.failureCount.toString().padStart(2)}  ║`
    );

    if (item.panicReason) {
      console.log(`║    └─ Reason: ${item.panicReason.substring(0, 45).padEnd(45)} ║`);
    }
  }

  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Show threshold info
  console.log('Panic Thresholds:');
  console.log('─────────────────────────────────────────────────────────');
  console.log('Integration     | Failures | Window  | Recovery Interval');
  console.log('─────────────────────────────────────────────────────────');

  for (const [name, threshold] of Object.entries(DEFAULT_PANIC_THRESHOLDS)) {
    console.log(
      `${name.padEnd(15)} | ${threshold.failureThreshold.toString().padStart(8)} | ` +
      `${(threshold.windowMs / 1000).toString().padStart(5)}s | ` +
      `${(threshold.recoveryProbeIntervalMs / 1000).toString().padStart(5)}s`
    );
  }

  console.log('─────────────────────────────────────────────────────────\n');
}

async function enablePanic(integration: string, reason?: string): Promise<void> {
  const validIntegrations = Object.keys(DEFAULT_PANIC_THRESHOLDS);

  if (!validIntegrations.includes(integration)) {
    console.error(`\n❌ Invalid integration: ${integration}`);
    console.error(`Valid options: ${validIntegrations.join(', ')}\n`);
    process.exit(1);
  }

  const controller = getPanicController();
  await controller.initialize();

  const panicReason = reason ?? `Manual trigger via CLI at ${new Date().toISOString()}`;

  console.log(`\n🚨 Enabling panic mode for ${integration}...`);
  console.log(`   Reason: ${panicReason}\n`);

  await controller.enablePanic(integration as IntegrationName, panicReason, true);

  console.log(`✅ Panic mode ENABLED for ${integration}`);
  console.log('   Fallback behavior is now active.');
  console.log('   Auto-recovery is enabled.\n');
}

async function disablePanic(integration: string, reason?: string): Promise<void> {
  const validIntegrations = Object.keys(DEFAULT_PANIC_THRESHOLDS);

  if (!validIntegrations.includes(integration)) {
    console.error(`\n❌ Invalid integration: ${integration}`);
    console.error(`Valid options: ${validIntegrations.join(', ')}\n`);
    process.exit(1);
  }

  const controller = getPanicController();
  await controller.initialize();

  const state = controller.getState(integration as IntegrationName);

  if (!state?.active) {
    console.log(`\nℹ️  ${integration} is not in panic mode.\n`);
    return;
  }

  const disableReason = reason ?? `Manual disable via CLI at ${new Date().toISOString()}`;

  console.log(`\n🔧 Disabling panic mode for ${integration}...`);
  console.log(`   Reason: ${disableReason}\n`);

  await controller.disablePanic(integration as IntegrationName, disableReason);

  console.log(`✅ Panic mode DISABLED for ${integration}`);
  console.log('   Normal operation resumed.\n');
}

function showHelp(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    PANIC MODE CLI                               ║
╠════════════════════════════════════════════════════════════════╣
║ Commands:                                                       ║
║   status              Show all integration statuses             ║
║   enable <int> [msg]  Enable panic mode for integration         ║
║   disable <int> [msg] Disable panic mode for integration        ║
║   help                Show this help message                    ║
╠════════════════════════════════════════════════════════════════╣
║ Integrations:                                                   ║
║   afip, whatsapp, mercadopago, openai_voice                    ║
╠════════════════════════════════════════════════════════════════╣
║ Examples:                                                       ║
║   npm run panic:status                                          ║
║   npm run panic:enable afip "AFIP maintenance"                  ║
║   npm run panic:disable afip                                    ║
╚════════════════════════════════════════════════════════════════╝
`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  try {
    switch (command) {
      case 'status':
        await showStatus();
        break;

      case 'enable':
        if (!args[1]) {
          console.error('\n❌ Missing integration name.');
          console.error('Usage: npm run panic:enable <integration> [reason]\n');
          process.exit(1);
        }
        await enablePanic(args[1], args.slice(2).join(' ') || undefined);
        break;

      case 'disable':
        if (!args[1]) {
          console.error('\n❌ Missing integration name.');
          console.error('Usage: npm run panic:disable <integration> [reason]\n');
          process.exit(1);
        }
        await disablePanic(args[1], args.slice(2).join(' ') || undefined);
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        if (command) {
          console.error(`\n❌ Unknown command: ${command}`);
        }
        showHelp();
        process.exit(command ? 1 : 0);
    }
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if called directly
main().catch(console.error);

export { showStatus, enablePanic, disablePanic };
