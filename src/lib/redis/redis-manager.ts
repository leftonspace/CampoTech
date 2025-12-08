/**
 * Redis Connection Manager
 * ========================
 *
 * Centralized Redis connection management with:
 * - Automatic reconnection with exponential backoff
 * - Connection pooling
 * - Health monitoring
 * - Graceful shutdown
 */

import { Redis, RedisOptions } from 'ioredis';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RedisManagerConfig {
  /** Redis connection URL */
  url: string;
  /** Connection name for identification */
  name?: string;
  /** Maximum reconnection attempts (0 = infinite) */
  maxReconnectAttempts?: number;
  /** Initial reconnection delay in ms */
  reconnectDelay?: number;
  /** Maximum reconnection delay in ms */
  maxReconnectDelay?: number;
  /** Enable ready check */
  enableReadyCheck?: boolean;
  /** Connection timeout in ms */
  connectTimeout?: number;
  /** Command timeout in ms */
  commandTimeout?: number;
  /** Callback on connection */
  onConnect?: () => void;
  /** Callback on disconnect */
  onDisconnect?: (error?: Error) => void;
  /** Callback on reconnection */
  onReconnect?: (attempt: number) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface ConnectionHealth {
  /** Whether connected */
  connected: boolean;
  /** Time of last successful ping */
  lastPing?: Date;
  /** Ping latency in ms */
  latencyMs?: number;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Connection uptime in ms */
  uptimeMs?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class RedisManager {
  private client: Redis;
  private config: Required<RedisManagerConfig>;
  private reconnectAttempts = 0;
  private connectedAt?: Date;
  private lastPing?: Date;
  private lastLatency?: number;
  private isShuttingDown = false;

  constructor(config: RedisManagerConfig) {
    this.config = {
      url: config.url,
      name: config.name || 'redis',
      maxReconnectAttempts: config.maxReconnectAttempts ?? 0,
      reconnectDelay: config.reconnectDelay ?? 1000,
      maxReconnectDelay: config.maxReconnectDelay ?? 30000,
      enableReadyCheck: config.enableReadyCheck ?? true,
      connectTimeout: config.connectTimeout ?? 10000,
      commandTimeout: config.commandTimeout ?? 5000,
      onConnect: config.onConnect ?? (() => {}),
      onDisconnect: config.onDisconnect ?? (() => {}),
      onReconnect: config.onReconnect ?? (() => {}),
      onError: config.onError ?? (() => {}),
    };

    this.client = this.createClient();
  }

  /**
   * Create Redis client with reconnection strategy
   */
  private createClient(): Redis {
    const options: RedisOptions = {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: this.config.enableReadyCheck,
      connectTimeout: this.config.connectTimeout,
      commandTimeout: this.config.commandTimeout,
      retryStrategy: (times: number) => this.retryStrategy(times),
      reconnectOnError: (err: Error) => this.shouldReconnectOnError(err),
    };

    const client = new Redis(this.config.url, options);

    // Set up event handlers
    this.setupEventHandlers(client);

    return client;
  }

  /**
   * Retry strategy with exponential backoff
   */
  private retryStrategy(times: number): number | null {
    if (this.isShuttingDown) {
      return null; // Don't retry during shutdown
    }

    this.reconnectAttempts = times;

    // Check max attempts
    if (this.config.maxReconnectAttempts > 0 &&
        times > this.config.maxReconnectAttempts) {
      console.error(`[${this.config.name}] Max reconnection attempts (${this.config.maxReconnectAttempts}) exceeded`);
      return null;
    }

    // Exponential backoff with jitter
    const baseDelay = this.config.reconnectDelay;
    const maxDelay = this.config.maxReconnectDelay;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, times - 1), maxDelay);
    const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
    const delay = Math.round(exponentialDelay + jitter);

    console.log(`[${this.config.name}] Reconnecting in ${delay}ms (attempt ${times})`);
    this.config.onReconnect(times);

    return delay;
  }

  /**
   * Determine if we should reconnect on specific errors
   */
  private shouldReconnectOnError(err: Error): boolean | 1 | 2 {
    const message = err.message.toLowerCase();

    // Reconnect on connection errors
    if (message.includes('econnreset') ||
        message.includes('econnrefused') ||
        message.includes('etimedout') ||
        message.includes('connection') ||
        message.includes('socket')) {
      return 2; // Reconnect and resend failed command
    }

    // Reconnect on readonly errors (might be failover)
    if (message.includes('readonly')) {
      return 1; // Reconnect only
    }

    return false;
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(client: Redis): void {
    client.on('connect', () => {
      console.log(`[${this.config.name}] Connected to Redis`);
      this.connectedAt = new Date();
      this.reconnectAttempts = 0;
      this.config.onConnect();
    });

    client.on('ready', () => {
      console.log(`[${this.config.name}] Redis ready`);
    });

    client.on('close', () => {
      console.log(`[${this.config.name}] Redis connection closed`);
      this.connectedAt = undefined;
      this.config.onDisconnect();
    });

    client.on('reconnecting', () => {
      console.log(`[${this.config.name}] Reconnecting to Redis...`);
    });

    client.on('error', (error: Error) => {
      console.error(`[${this.config.name}] Redis error:`, error.message);
      this.config.onError(error);
    });

    client.on('end', () => {
      console.log(`[${this.config.name}] Redis connection ended`);
      this.config.onDisconnect();
    });
  }

  /**
   * Get the Redis client
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Create a duplicate connection (for pub/sub)
   */
  duplicate(): Redis {
    return this.client.duplicate();
  }

  /**
   * Check connection health
   */
  async getHealth(): Promise<ConnectionHealth> {
    const health: ConnectionHealth = {
      connected: this.client.status === 'ready',
      reconnectAttempts: this.reconnectAttempts,
    };

    if (this.connectedAt) {
      health.uptimeMs = Date.now() - this.connectedAt.getTime();
    }

    // Try to ping
    if (health.connected) {
      try {
        const start = Date.now();
        await this.client.ping();
        health.latencyMs = Date.now() - start;
        health.lastPing = new Date();
        this.lastPing = health.lastPing;
        this.lastLatency = health.latencyMs;
      } catch {
        health.connected = false;
      }
    }

    // Use cached values if ping failed
    if (!health.lastPing && this.lastPing) {
      health.lastPing = this.lastPing;
      health.latencyMs = this.lastLatency;
    }

    return health;
  }

  /**
   * Wait for connection to be ready
   */
  async waitForReady(timeoutMs = 30000): Promise<void> {
    if (this.client.status === 'ready') {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Redis connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const onReady = () => {
        clearTimeout(timeout);
        this.client.off('error', onError);
        resolve();
      };

      const onError = (err: Error) => {
        clearTimeout(timeout);
        this.client.off('ready', onReady);
        reject(err);
      };

      this.client.once('ready', onReady);
      this.client.once('error', onError);
    });
  }

  /**
   * Gracefully shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    console.log(`[${this.config.name}] Shutting down Redis connection...`);

    try {
      await this.client.quit();
      console.log(`[${this.config.name}] Redis connection closed gracefully`);
    } catch (error) {
      console.error(`[${this.config.name}] Error during Redis shutdown:`, error);
      this.client.disconnect();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

const managers: Map<string, RedisManager> = new Map();

/**
 * Get or create a Redis manager
 */
export function getRedisManager(
  name: string,
  config?: RedisManagerConfig
): RedisManager {
  let manager = managers.get(name);

  if (!manager && config) {
    manager = new RedisManager({ ...config, name });
    managers.set(name, manager);
  }

  if (!manager) {
    throw new Error(`Redis manager '${name}' not initialized`);
  }

  return manager;
}

/**
 * Initialize the default Redis manager
 */
export function initializeRedis(config: RedisManagerConfig): RedisManager {
  return getRedisManager('default', config);
}

/**
 * Get the default Redis client
 */
export function getRedis(): Redis {
  return getRedisManager('default').getClient();
}

/**
 * Shutdown all Redis managers
 */
export async function shutdownAllRedis(): Promise<void> {
  const shutdowns = Array.from(managers.values()).map((m) => m.shutdown());
  await Promise.all(shutdowns);
  managers.clear();
}
