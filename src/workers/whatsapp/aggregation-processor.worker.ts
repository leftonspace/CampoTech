/**
 * Aggregation Processor Worker
 * ============================
 *
 * Phase 9.8: Message Aggregation System
 * Processes message buffers when they timeout (8-second window expires).
 * Runs as a background worker polling for expired buffers.
 */

import { Redis } from 'ioredis';
import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import {
  getMessageAggregator,
  AGGREGATION_WINDOW_MS,
  MessageBuffer,
  AggregationResult,
} from '../../integrations/whatsapp/aggregation/message-aggregator.service';
import { getCapabilityService, CapabilityPath } from '../../../core/config/capabilities';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const POLL_INTERVAL_MS = 1000; // Check every second
const BATCH_SIZE = 50; // Process up to 50 buffers per cycle

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER STATE
// ═══════════════════════════════════════════════════════════════════════════════

let isRunning = false;
let redis: Redis | null = null;

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start the aggregation processor worker
 */
export async function startAggregationProcessor(): Promise<void> {
  if (isRunning) {
    log.warn('Aggregation processor already running');
    return;
  }

  try {
    // Initialize Redis connection
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(redisUrl);

    await redis.ping();
    log.info('Aggregation processor connected to Redis');

    isRunning = true;
    log.info('Starting aggregation processor worker');

    // Start polling loop
    runProcessingLoop();
  } catch (error) {
    log.error('Failed to start aggregation processor', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Stop the aggregation processor worker
 */
export async function stopAggregationProcessor(): Promise<void> {
  isRunning = false;

  if (redis) {
    await redis.quit();
    redis = null;
  }

  log.info('Aggregation processor stopped');
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCESSING LOOP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main processing loop
 */
async function runProcessingLoop(): Promise<void> {
  while (isRunning) {
    try {
      // Check capability system first
      const capabilityService = getCapabilityService();
      const aggregationEnabled = await capabilityService.ensure('services.whatsapp_aggregation' as CapabilityPath);
      const whatsappEnabled = await capabilityService.ensure('external.whatsapp' as CapabilityPath);

      if (!aggregationEnabled || !whatsappEnabled) {
        log.debug('WhatsApp aggregation capability disabled, skipping cycle');
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const processedCount = await processExpiredBuffers();

      if (processedCount > 0) {
        log.debug('Processed expired buffers', { count: processedCount });
      }
    } catch (error) {
      log.error('Error in aggregation processing cycle', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    // Wait before next poll
    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Process all expired message buffers
 */
async function processExpiredBuffers(): Promise<number> {
  if (!redis) return 0;

  const now = Date.now();
  let processedCount = 0;

  try {
    // Find all buffer keys
    const bufferKeys = await redis.keys('msgbuf:*');

    for (const key of bufferKeys.slice(0, BATCH_SIZE)) {
      try {
        const bufferData = await redis.get(key);
        if (!bufferData) continue;

        const buffer: MessageBuffer = JSON.parse(bufferData);

        // Check if buffer has expired (8 seconds since last message)
        const timeSinceLastMessage = now - buffer.lastMessageAt;
        if (timeSinceLastMessage >= AGGREGATION_WINDOW_MS) {
          // Process the buffer
          await processBuffer(key, buffer);
          processedCount++;
        }
      } catch (error) {
        log.error('Error processing individual buffer', {
          key,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    return processedCount;
  } catch (error) {
    log.error('Error fetching buffer keys', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return 0;
  }
}

/**
 * Process a single expired buffer
 */
async function processBuffer(key: string, buffer: MessageBuffer): Promise<void> {
  if (!redis) return;

  try {
    // Delete the buffer first (to prevent duplicate processing)
    await redis.del(key);

    // Get the aggregator and process
    const aggregator = getMessageAggregator();
    const result = await aggregator.processTimeout(key);

    if (result && result.shouldProcess) {
      // Log the aggregation event
      await logAggregationEvent(buffer, result);

      log.info('Buffer timeout processed', {
        organizationId: buffer.organizationId,
        phone: buffer.phone,
        messageCount: buffer.messages.length,
        combinedLength: result.combinedContent.length,
      });
    }
  } catch (error) {
    log.error('Error processing buffer', {
      key,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Log aggregation event for analytics
 */
async function logAggregationEvent(
  buffer: MessageBuffer,
  result: AggregationResult
): Promise<void> {
  try {
    await db.messageAggregationEvent.create({
      data: {
        organizationId: buffer.organizationId,
        customerPhone: buffer.phone,
        customerName: result.context?.customerName,
        messageCount: result.messageCount,
        combinedContent: result.combinedContent,
        triggerReason: result.triggerReason || 'timeout',
        customerId: result.context?.customerId,
        activeJobId: result.context?.activeJobId,
        processedAt: new Date(),
      },
    });
  } catch (error) {
    // Table may not exist, just log
    log.debug('Could not log aggregation event', { error });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS & MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current buffer statistics
 */
export async function getBufferStats(): Promise<{
  activeBuffers: number;
  totalMessages: number;
  oldestBufferAge: number;
  averageBufferAge: number;
}> {
  if (!redis) {
    return {
      activeBuffers: 0,
      totalMessages: 0,
      oldestBufferAge: 0,
      averageBufferAge: 0,
    };
  }

  try {
    const bufferKeys = await redis.keys('msgbuf:*');
    const now = Date.now();

    let totalMessages = 0;
    let oldestAge = 0;
    let totalAge = 0;

    for (const key of bufferKeys) {
      const data = await redis.get(key);
      if (!data) continue;

      const buffer: MessageBuffer = JSON.parse(data);
      totalMessages += buffer.messages.length;

      const age = now - buffer.createdAt;
      totalAge += age;

      if (age > oldestAge) {
        oldestAge = age;
      }
    }

    return {
      activeBuffers: bufferKeys.length,
      totalMessages,
      oldestBufferAge: oldestAge,
      averageBufferAge: bufferKeys.length > 0 ? totalAge / bufferKeys.length : 0,
    };
  } catch (error) {
    log.error('Error getting buffer stats', { error });
    return {
      activeBuffers: 0,
      totalMessages: 0,
      oldestBufferAge: 0,
      averageBufferAge: 0,
    };
  }
}

/**
 * Force process all buffers (for maintenance)
 */
export async function forceProcessAllBuffers(): Promise<number> {
  if (!redis) return 0;

  const bufferKeys = await redis.keys('msgbuf:*');
  let processedCount = 0;

  for (const key of bufferKeys) {
    try {
      const data = await redis.get(key);
      if (!data) continue;

      const buffer: MessageBuffer = JSON.parse(data);
      await processBuffer(key, buffer);
      processedCount++;
    } catch (error) {
      log.error('Error force-processing buffer', { key, error });
    }
  }

  log.info('Force processed all buffers', { count: processedCount });
  return processedCount;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

// Auto-start if running as main process
if (require.main === module) {
  startAggregationProcessor().catch((error) => {
    log.error('Failed to start aggregation processor', { error });
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    await stopAggregationProcessor();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await stopAggregationProcessor();
    process.exit(0);
  });
}
