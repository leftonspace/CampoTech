#!/usr/bin/env ts-node

/**
 * Panic Mode CLI Tool
 * ===================
 *
 * Command-line interface for managing panic mode / kill switches.
 *
 * Usage:
 *   npm run panic:status               # Show panic mode status for all integrations
 *   npm run panic:enable -- --service=afip --reason="AFIP maintenance"
 *   npm run panic:disable -- --service=afip
 *   npm run panic:history -- --service=afip
 */

import Redis from 'ioredis';

// =============================================================================
// CONFIGURATION
// =============================================================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

interface ServiceConfig {
  name: string;
  capabilityPath: string;
  description: string;
  criticalityLevel: 'high' | 'medium' | 'low';
}

const SERVICES: ServiceConfig[] = [
  {
    name: 'afip',
    capabilityPath: 'external.afip',
    description: 'AFIP Electronic Invoicing (CAE)',
    criticalityLevel: 'high',
  },
  {
    name: 'mercadopago',
    capabilityPath: 'external.mercadopago',
    description: 'MercadoPago Payment Processing',
    criticalityLevel: 'high',
  },
  {
    name: 'whatsapp',
    capabilityPath: 'external.whatsapp',
    description: 'WhatsApp Cloud API Messaging',
    criticalityLevel: 'high',
  },
  {
    name: 'voice_ai',
    capabilityPath: 'external.whatsapp_voice_ai',
    description: 'Voice AI (Whisper Transcription)',
    criticalityLevel: 'medium',
  },
  {
    name: 'push',
    capabilityPath: 'external.push_notifications',
    description: 'Mobile Push Notifications',
    criticalityLevel: 'low',
  },
  {
    name: 'offline_sync',
    capabilityPath: 'domain.offline_sync',
    description: 'Mobile Offline Synchronization',
    criticalityLevel: 'medium',
  },
  {
    name: 'gps',
    capabilityPath: 'domain.technician_gps',
    description: 'Real-time GPS Tracking',
    criticalityLevel: 'low',
  },
];

interface PanicState {
  enabled: boolean;
  reason?: string;
  enabledAt?: string;
  enabledBy?: string;
  disabledAt?: string;
  failureCount?: number;
  lastFailureAt?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function parseArgs(): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);

  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value ?? true;
    }
  }

  return args;
}

function getStatusIcon(enabled: boolean): string {
  return enabled ? '\x1b[31m⛔ PANIC\x1b[0m' : '\x1b[32m✅ OK\x1b[0m';
}

function getCriticalityColor(level: string): string {
  switch (level) {
    case 'high': return '\x1b[31m';    // Red
    case 'medium': return '\x1b[33m';  // Yellow
    case 'low': return '\x1b[36m';     // Cyan
    default: return '\x1b[0m';
  }
}

async function getRedisClient(): Promise<Redis> {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: null });
}

// =============================================================================
// PANIC STATE MANAGEMENT
// =============================================================================

const PANIC_KEY_PREFIX = 'panic:';

async function getPanicState(redis: Redis, serviceName: string): Promise<PanicState> {
  const key = `${PANIC_KEY_PREFIX}${serviceName}`;
  const data = await redis.get(key);

  if (!data) {
    return { enabled: false };
  }

  try {
    return JSON.parse(data);
  } catch {
    return { enabled: false };
  }
}

async function setPanicState(
  redis: Redis,
  serviceName: string,
  state: PanicState
): Promise<void> {
  const key = `${PANIC_KEY_PREFIX}${serviceName}`;
  await redis.set(key, JSON.stringify(state));

  // Also store in history
  const historyKey = `${PANIC_KEY_PREFIX}${serviceName}:history`;
  await redis.lpush(historyKey, JSON.stringify({
    ...state,
    timestamp: new Date().toISOString(),
  }));
  await redis.ltrim(historyKey, 0, 99); // Keep last 100 entries
}

async function getPanicHistory(redis: Redis, serviceName: string, limit: number = 20): Promise<any[]> {
  const historyKey = `${PANIC_KEY_PREFIX}${serviceName}:history`;
  const entries = await redis.lrange(historyKey, 0, limit - 1);

  return entries.map((entry) => {
    try {
      return JSON.parse(entry);
    } catch {
      return { raw: entry };
    }
  });
}

// =============================================================================
// COMMANDS
// =============================================================================

async function showStatus(): Promise<void> {
  const redis = await getRedisClient();

  console.log('\n=== Panic Mode Status ===\n');
  console.log(
    'Service'.padEnd(20) +
    'Status'.padEnd(15) +
    'Criticality'.padEnd(12) +
    'Reason'.padEnd(30) +
    'Since'
  );
  console.log('-'.repeat(100));

  let panicCount = 0;

  for (const service of SERVICES) {
    const state = await getPanicState(redis, service.name);
    const critColor = getCriticalityColor(service.criticalityLevel);

    if (state.enabled) panicCount++;

    console.log(
      service.name.padEnd(20) +
      getStatusIcon(state.enabled).padEnd(24) + // Extra padding for ANSI codes
      `${critColor}${service.criticalityLevel}\x1b[0m`.padEnd(21) +
      (state.reason || '-').slice(0, 28).padEnd(30) +
      (state.enabledAt ? new Date(state.enabledAt).toLocaleString() : '-')
    );
  }

  console.log('-'.repeat(100));

  if (panicCount > 0) {
    console.log(`\n\x1b[31m⚠️  ${panicCount} service(s) in PANIC mode\x1b[0m`);
  } else {
    console.log('\n\x1b[32m✅ All services operational\x1b[0m');
  }

  console.log('');
  await redis.quit();
}

async function enablePanic(serviceName: string, reason: string): Promise<void> {
  const service = SERVICES.find((s) => s.name === serviceName);
  if (!service) {
    console.error(`Unknown service: ${serviceName}`);
    console.error(`Available services: ${SERVICES.map((s) => s.name).join(', ')}`);
    process.exit(1);
  }

  const redis = await getRedisClient();

  const currentState = await getPanicState(redis, serviceName);
  if (currentState.enabled) {
    console.log(`⚠️  Panic mode already enabled for '${serviceName}'`);
    await redis.quit();
    return;
  }

  const newState: PanicState = {
    enabled: true,
    reason,
    enabledAt: new Date().toISOString(),
    enabledBy: process.env.USER || 'cli',
  };

  await setPanicState(redis, serviceName, newState);

  console.log(`\x1b[31m⛔ PANIC MODE ENABLED for '${serviceName}'\x1b[0m`);
  console.log(`   Reason: ${reason}`);
  console.log(`   Time: ${newState.enabledAt}`);
  console.log(`\n   Fallback behavior activated for: ${service.description}`);

  await redis.quit();
}

async function disablePanic(serviceName: string): Promise<void> {
  const service = SERVICES.find((s) => s.name === serviceName);
  if (!service) {
    console.error(`Unknown service: ${serviceName}`);
    console.error(`Available services: ${SERVICES.map((s) => s.name).join(', ')}`);
    process.exit(1);
  }

  const redis = await getRedisClient();

  const currentState = await getPanicState(redis, serviceName);
  if (!currentState.enabled) {
    console.log(`ℹ️  Panic mode already disabled for '${serviceName}'`);
    await redis.quit();
    return;
  }

  const newState: PanicState = {
    enabled: false,
    reason: currentState.reason,
    enabledAt: currentState.enabledAt,
    disabledAt: new Date().toISOString(),
  };

  await setPanicState(redis, serviceName, newState);

  console.log(`\x1b[32m✅ PANIC MODE DISABLED for '${serviceName}'\x1b[0m`);
  console.log(`   Previous reason: ${currentState.reason || 'N/A'}`);
  console.log(`   Was enabled at: ${currentState.enabledAt}`);
  console.log(`   Disabled at: ${newState.disabledAt}`);

  if (currentState.enabledAt) {
    const duration = Date.now() - new Date(currentState.enabledAt).getTime();
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    console.log(`   Duration: ${hours}h ${minutes}m`);
  }

  await redis.quit();
}

async function showHistory(serviceName: string, limit: number): Promise<void> {
  const service = SERVICES.find((s) => s.name === serviceName);
  if (!service) {
    console.error(`Unknown service: ${serviceName}`);
    console.error(`Available services: ${SERVICES.map((s) => s.name).join(', ')}`);
    process.exit(1);
  }

  const redis = await getRedisClient();
  const history = await getPanicHistory(redis, serviceName, limit);

  if (history.length === 0) {
    console.log(`No panic history for '${serviceName}'`);
    await redis.quit();
    return;
  }

  console.log(`\n=== Panic History for '${serviceName}' ===\n`);
  console.log(
    'Timestamp'.padEnd(22) +
    'Status'.padEnd(10) +
    'Reason'.padEnd(40) +
    'By'
  );
  console.log('-'.repeat(90));

  for (const entry of history) {
    const status = entry.enabled ? '\x1b[31mENABLED\x1b[0m' : '\x1b[32mDISABLED\x1b[0m';
    const time = entry.timestamp
      ? new Date(entry.timestamp).toLocaleString()
      : 'Unknown';

    console.log(
      time.padEnd(22) +
      status.padEnd(19) +
      (entry.reason || '-').slice(0, 38).padEnd(40) +
      (entry.enabledBy || '-')
    );
  }

  console.log('');
  await redis.quit();
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  const args = parseArgs();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'status':
        await showStatus();
        break;

      case 'enable':
        if (!args.service) {
          console.error('Error: --service is required');
          process.exit(1);
        }
        if (!args.reason) {
          console.error('Error: --reason is required');
          process.exit(1);
        }
        await enablePanic(args.service as string, args.reason as string);
        break;

      case 'disable':
        if (!args.service) {
          console.error('Error: --service is required');
          process.exit(1);
        }
        await disablePanic(args.service as string);
        break;

      case 'history':
        if (!args.service) {
          console.error('Error: --service is required');
          process.exit(1);
        }
        await showHistory(
          args.service as string,
          parseInt(args.limit as string, 10) || 20
        );
        break;

      default:
        console.log(`
Panic Mode CLI Tool
===================

Commands:
  status              Show panic mode status for all services
  enable              Enable panic mode (--service=<name> --reason="<reason>")
  disable             Disable panic mode (--service=<name>)
  history             Show panic history (--service=<name> --limit=<n>)

Available Services:
${SERVICES.map((s) => `  ${s.name.padEnd(15)} ${s.description}`).join('\n')}

Examples:
  npm run panic:status
  npm run panic:enable -- --service=afip --reason="AFIP maintenance window"
  npm run panic:disable -- --service=afip
  npm run panic:history -- --service=afip --limit=50
        `);
    }
  } finally {
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
