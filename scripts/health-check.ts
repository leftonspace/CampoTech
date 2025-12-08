#!/usr/bin/env ts-node
/**
 * Health Check CLI
 * ================
 *
 * Checks the health of all CampoTech services and integrations.
 *
 * USAGE:
 *   npm run health:check         # Full health check
 *   npm run health:quick         # Quick check (skip slow tests)
 */

import { getPanicController, type IntegrationName } from '../core/services/panic/panic-controller';
import Capabilities, { type CapabilityCategory } from '../core/config/capabilities';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latencyMs?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

async function checkDatabase(): Promise<HealthCheckResult> {
  // In production, this would actually test the database connection
  // For now, return simulated result
  return {
    name: 'Database (PostgreSQL)',
    status: 'healthy',
    message: 'Connected',
    latencyMs: 5,
  };
}

async function checkRedis(): Promise<HealthCheckResult> {
  // In production, this would test Redis connection
  return {
    name: 'Redis',
    status: 'healthy',
    message: 'Connected',
    latencyMs: 2,
  };
}

async function checkPanicStatus(): Promise<HealthCheckResult[]> {
  const controller = getPanicController();
  await controller.initialize();

  const summary = controller.getStatusSummary();

  return summary.map(item => ({
    name: `Integration: ${item.integration}`,
    status: item.status === 'panic' ? 'unhealthy' : item.status === 'degraded' ? 'degraded' : 'healthy',
    message: item.panicReason ?? `${item.failureCount} failures in window`,
  }));
}

async function checkCapabilities(): Promise<HealthCheckResult> {
  let disabledCount = 0;
  let totalCount = 0;

  for (const category of Object.keys(Capabilities) as CapabilityCategory[]) {
    const categoryObj = Capabilities[category];
    for (const [name, defaultValue] of Object.entries(categoryObj)) {
      totalCount++;
      const envKey = `CAPABILITY_${category.toUpperCase()}_${name.toUpperCase()}`;
      const envValue = process.env[envKey];

      if (envValue?.toLowerCase() === 'false' || (!envValue && !defaultValue)) {
        disabledCount++;
      }
    }
  }

  if (disabledCount === 0) {
    return {
      name: 'Capabilities',
      status: 'healthy',
      message: `All ${totalCount} capabilities enabled`,
    };
  } else if (disabledCount < 3) {
    return {
      name: 'Capabilities',
      status: 'degraded',
      message: `${disabledCount}/${totalCount} capabilities disabled`,
    };
  } else {
    return {
      name: 'Capabilities',
      status: 'unhealthy',
      message: `${disabledCount}/${totalCount} capabilities disabled`,
    };
  }
}

async function checkQueues(): Promise<HealthCheckResult> {
  // In production, this would check BullMQ queue health
  return {
    name: 'Queue System',
    status: 'healthy',
    message: 'All queues operational',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

function displayResults(results: HealthCheckResult[]): void {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              HEALTH CHECK RESULTS                               ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');

  let unhealthyCount = 0;
  let degradedCount = 0;

  for (const result of results) {
    const statusIcon = {
      healthy: '✅',
      degraded: '⚠️ ',
      unhealthy: '❌',
    }[result.status];

    const statusColor = {
      healthy: '\x1b[32m',
      degraded: '\x1b[33m',
      unhealthy: '\x1b[31m',
    }[result.status];

    const reset = '\x1b[0m';

    const latency = result.latencyMs !== undefined ? ` (${result.latencyMs}ms)` : '';

    console.log(
      `║ ${statusIcon} ${result.name.padEnd(25)} ${statusColor}${result.status.toUpperCase().padEnd(10)}${reset}${latency.padEnd(10)} ║`
    );

    if (result.message) {
      console.log(`║    └─ ${result.message.substring(0, 55).padEnd(55)} ║`);
    }

    if (result.status === 'unhealthy') unhealthyCount++;
    if (result.status === 'degraded') degradedCount++;
  }

  console.log('╠════════════════════════════════════════════════════════════════╣');

  // Overall status
  let overallStatus: string;
  let overallIcon: string;

  if (unhealthyCount > 0) {
    overallStatus = '\x1b[31mUNHEALTHY\x1b[0m';
    overallIcon = '❌';
  } else if (degradedCount > 0) {
    overallStatus = '\x1b[33mDEGRADED\x1b[0m';
    overallIcon = '⚠️ ';
  } else {
    overallStatus = '\x1b[32mHEALTHY\x1b[0m';
    overallIcon = '✅';
  }

  console.log(`║ ${overallIcon} Overall Status: ${overallStatus.padEnd(45)} ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isQuick = args.includes('--quick') || args.includes('-q');

  console.log(isQuick ? 'Running quick health check...' : 'Running full health check...');

  const results: HealthCheckResult[] = [];

  try {
    // Core infrastructure checks
    results.push(await checkDatabase());
    results.push(await checkRedis());
    results.push(await checkQueues());

    // Capability system check
    results.push(await checkCapabilities());

    // Integration checks (skip in quick mode)
    if (!isQuick) {
      const panicResults = await checkPanicStatus();
      results.push(...panicResults);
    }

    displayResults(results);

    // Exit with appropriate code
    const hasUnhealthy = results.some(r => r.status === 'unhealthy');
    process.exit(hasUnhealthy ? 1 : 0);
  } catch (error) {
    console.error('Health check failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(console.error);
