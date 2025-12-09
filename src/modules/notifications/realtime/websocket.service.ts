/**
 * WebSocket Notification Service
 * ==============================
 *
 * Phase 9.6: Notification Preferences System
 * Real-time notification delivery via WebSocket connections.
 */

import { log } from '../../../lib/logging/logger';
import { getRedisConnection } from '../../../lib/redis/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WebSocketNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  timestamp: string;
  read: boolean;
}

export interface WebSocketMessage {
  event: 'notification' | 'notification_read' | 'notification_clear' | 'ping' | 'pong';
  payload?: WebSocketNotification | string | string[];
}

interface ConnectedClient {
  userId: string;
  organizationId: string;
  connectedAt: Date;
  lastPing: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY CONNECTION STORE (for single-server deployments)
// For multi-server, use Redis pub/sub
// ═══════════════════════════════════════════════════════════════════════════════

const connections = new Map<string, Set<WebSocket>>();
const clientInfo = new Map<WebSocket, ConnectedClient>();

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Register a WebSocket connection for a user
 */
export function registerConnection(
  ws: WebSocket,
  userId: string,
  organizationId: string
): void {
  // Add to user's connection set
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(ws);

  // Store client info
  clientInfo.set(ws, {
    userId,
    organizationId,
    connectedAt: new Date(),
    lastPing: new Date(),
  });

  log.debug('WebSocket connection registered', {
    userId,
    totalConnections: connections.get(userId)!.size,
  });
}

/**
 * Remove a WebSocket connection
 */
export function removeConnection(ws: WebSocket): void {
  const info = clientInfo.get(ws);
  if (!info) return;

  const userConnections = connections.get(info.userId);
  if (userConnections) {
    userConnections.delete(ws);
    if (userConnections.size === 0) {
      connections.delete(info.userId);
    }
  }

  clientInfo.delete(ws);

  log.debug('WebSocket connection removed', {
    userId: info.userId,
    remainingConnections: connections.get(info.userId)?.size || 0,
  });
}

/**
 * Update last ping time for a connection
 */
export function updatePing(ws: WebSocket): void {
  const info = clientInfo.get(ws);
  if (info) {
    info.lastPing = new Date();
  }
}

/**
 * Get connection count for a user
 */
export function getConnectionCount(userId: string): number {
  return connections.get(userId)?.size || 0;
}

/**
 * Check if user has active connections
 */
export function isUserConnected(userId: string): boolean {
  return getConnectionCount(userId) > 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION DELIVERY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send notification to a specific user via WebSocket
 */
export async function sendToUser(
  userId: string,
  notification: WebSocketNotification
): Promise<boolean> {
  const userConnections = connections.get(userId);

  if (!userConnections || userConnections.size === 0) {
    log.debug('No active connections for user', { userId });
    return false;
  }

  const message: WebSocketMessage = {
    event: 'notification',
    payload: notification,
  };

  const messageStr = JSON.stringify(message);
  let sent = 0;

  for (const ws of userConnections) {
    try {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(messageStr);
        sent++;
      }
    } catch (error) {
      log.error('Failed to send WebSocket message', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      // Remove dead connection
      removeConnection(ws);
    }
  }

  log.debug('WebSocket notification sent', {
    userId,
    sentTo: sent,
    totalConnections: userConnections.size,
  });

  return sent > 0;
}

/**
 * Broadcast notification to all users in an organization
 */
export async function broadcastToOrganization(
  organizationId: string,
  notification: WebSocketNotification
): Promise<number> {
  let sent = 0;

  for (const [ws, info] of clientInfo.entries()) {
    if (info.organizationId === organizationId) {
      try {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            event: 'notification',
            payload: notification,
          }));
          sent++;
        }
      } catch {
        removeConnection(ws);
      }
    }
  }

  return sent;
}

/**
 * Send notification read acknowledgment
 */
export async function sendReadAck(
  userId: string,
  notificationIds: string[]
): Promise<void> {
  const userConnections = connections.get(userId);
  if (!userConnections) return;

  const message: WebSocketMessage = {
    event: 'notification_read',
    payload: notificationIds as any,
  };

  const messageStr = JSON.stringify(message);

  for (const ws of userConnections) {
    try {
      if (ws.readyState === 1) {
        ws.send(messageStr);
      }
    } catch {
      removeConnection(ws);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS PUB/SUB FOR MULTI-SERVER SCALING
// ═══════════════════════════════════════════════════════════════════════════════

const NOTIFICATION_CHANNEL = 'notifications:realtime';

/**
 * Initialize Redis pub/sub for multi-server notification delivery
 */
export async function initializeRedisPubSub(): Promise<void> {
  try {
    const redis = await getRedisConnection();
    const subscriber = redis.duplicate();

    await subscriber.subscribe(NOTIFICATION_CHANNEL);

    subscriber.on('message', async (channel, message) => {
      if (channel !== NOTIFICATION_CHANNEL) return;

      try {
        const { userId, notification } = JSON.parse(message);
        await sendToUser(userId, notification);
      } catch (error) {
        log.error('Failed to process pub/sub notification', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    });

    log.info('Redis pub/sub initialized for WebSocket notifications');
  } catch (error) {
    log.warn('Redis pub/sub not available, using local connections only', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Publish notification via Redis for multi-server delivery
 */
export async function publishNotification(
  userId: string,
  notification: WebSocketNotification
): Promise<void> {
  try {
    const redis = await getRedisConnection();
    await redis.publish(
      NOTIFICATION_CHANNEL,
      JSON.stringify({ userId, notification })
    );
  } catch (error) {
    // Fallback to local delivery
    await sendToUser(userId, notification);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEARTBEAT / CLEANUP
// ═══════════════════════════════════════════════════════════════════════════════

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const STALE_TIMEOUT = 60000; // 60 seconds

/**
 * Start heartbeat interval to clean up stale connections
 */
export function startHeartbeat(): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    const staleConnections: WebSocket[] = [];

    for (const [ws, info] of clientInfo.entries()) {
      const timeSinceLastPing = now - info.lastPing.getTime();

      if (timeSinceLastPing > STALE_TIMEOUT) {
        staleConnections.push(ws);
      } else if (ws.readyState === 1) {
        // Send ping
        try {
          ws.send(JSON.stringify({ event: 'ping' }));
        } catch {
          staleConnections.push(ws);
        }
      }
    }

    // Clean up stale connections
    for (const ws of staleConnections) {
      try {
        ws.close();
      } catch {
        // Ignore
      }
      removeConnection(ws);
    }

    if (staleConnections.length > 0) {
      log.debug('Cleaned up stale WebSocket connections', {
        count: staleConnections.length,
      });
    }
  }, HEARTBEAT_INTERVAL);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

export function getStats(): {
  totalConnections: number;
  uniqueUsers: number;
  connectionsByOrg: Record<string, number>;
} {
  let totalConnections = 0;
  const connectionsByOrg: Record<string, number> = {};

  for (const [ws, info] of clientInfo.entries()) {
    totalConnections++;
    connectionsByOrg[info.organizationId] = (connectionsByOrg[info.organizationId] || 0) + 1;
  }

  return {
    totalConnections,
    uniqueUsers: connections.size,
    connectionsByOrg,
  };
}
