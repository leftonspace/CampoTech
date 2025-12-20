/**
 * Adaptive Real-time Client (Phase 6B.3.1)
 * =========================================
 *
 * Provides resilient real-time communication with automatic fallback.
 * WebSocket → SSE → Polling based on connection quality.
 *
 * Usage:
 * ```typescript
 * import { AdaptiveClient } from '@/lib/realtime';
 *
 * const client = new AdaptiveClient({
 *   preferredMode: 'sse',
 *   pollingInterval: 10000,
 * });
 *
 * client.on('message', (msg) => console.log(msg));
 * client.on('mode_changed', (event) => console.log('Mode:', event.to));
 *
 * await client.connect('/api/tracking/subscribe?orgId=123');
 * ```
 */

import {
  ConnectionMode,
  ConnectionState,
  ConnectionQuality,
  ConnectionMetrics,
  AdaptiveConfig,
  DEFAULT_ADAPTIVE_CONFIG,
  RealtimeMessage,
  AdaptiveClientEvent,
  EventCallback,
  MessagePriority,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// ADAPTIVE CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export class AdaptiveClient {
  private config: AdaptiveConfig;
  private state: ConnectionState = 'disconnected';
  private mode: ConnectionMode;
  private url: string = '';
  private pollingUrl: string = '';

  // Connection references
  private eventSource: EventSource | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;

  // Metrics tracking
  private metrics: ConnectionMetrics;
  private latencies: number[] = [];
  private messageTimestamps: number[] = [];
  private lastSequence = 0;
  private missedMessages = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = 0;

  // Reconnection
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private modeStartTime = 0;
  private currentModeIndex = 0;

  // Subscriptions
  private listeners: Set<EventCallback> = new Set();

  constructor(config: Partial<AdaptiveConfig> = {}) {
    this.config = { ...DEFAULT_ADAPTIVE_CONFIG, ...config };
    this.mode = this.config.preferredMode;
    this.currentModeIndex = this.config.fallbackOrder.indexOf(this.mode);
    if (this.currentModeIndex === -1) this.currentModeIndex = 0;

    this.metrics = this.createInitialMetrics();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONNECTION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Connect to the real-time endpoint
   */
  async connect(sseUrl: string, pollingUrl?: string): Promise<void> {
    this.url = sseUrl;
    this.pollingUrl = pollingUrl || sseUrl.replace('/subscribe', '/poll');
    this.state = 'connecting';
    this.modeStartTime = Date.now();

    await this.connectWithMode(this.mode);
  }

  /**
   * Connect using specified mode
   */
  private async connectWithMode(mode: ConnectionMode): Promise<void> {
    this.cleanup();
    this.mode = mode;
    this.modeStartTime = Date.now();

    switch (mode) {
      case 'websocket':
        await this.connectWebSocket();
        break;
      case 'sse':
        await this.connectSSE();
        break;
      case 'polling':
        this.startPolling();
        break;
    }
  }

  /**
   * Connect via WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    // Convert HTTP URL to WS URL
    const wsUrl = this.url.replace(/^http/, 'ws');

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        this.handleConnected();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as RealtimeMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error('[AdaptiveClient] Error parsing WS message:', error);
        }
      };

      ws.onerror = () => {
        this.handleError(new Error('WebSocket error'));
      };

      ws.onclose = () => {
        this.handleDisconnected('WebSocket closed');
      };
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('WebSocket failed'));
    }
  }

  /**
   * Connect via Server-Sent Events
   */
  private async connectSSE(): Promise<void> {
    try {
      this.eventSource = new EventSource(this.url);

      this.eventSource.onopen = () => {
        this.handleConnected();
      };

      this.eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as RealtimeMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error('[AdaptiveClient] Error parsing SSE message:', error);
        }
      };

      this.eventSource.onerror = () => {
        this.handleDisconnected('SSE connection error');
      };
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('SSE failed'));
    }
  }

  /**
   * Start polling mode
   */
  private startPolling(): void {
    this.handleConnected();
    this.poll();
  }

  /**
   * Perform a poll request
   */
  private async poll(): Promise<void> {
    if (this.mode !== 'polling') return;

    const startTime = Date.now();

    try {
      const url = new URL(this.pollingUrl, window.location.origin);
      url.searchParams.set('lastSequence', String(this.lastSequence));

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Poll failed: ${response.status}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;
      this.recordLatency(latency);

      // Handle messages
      if (data.messages && Array.isArray(data.messages)) {
        for (const msg of data.messages) {
          this.handleMessage(msg as RealtimeMessage);
        }
      }

      // Schedule next poll
      const interval = this.calculatePollingInterval();
      this.pollingTimer = setTimeout(() => this.poll(), interval);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Poll failed'));

      // Retry with backoff
      const delay = Math.min(
        this.config.reconnectDelayBase * Math.pow(2, this.reconnectAttempts),
        this.config.reconnectDelayMax
      );
      this.pollingTimer = setTimeout(() => this.poll(), delay);
    }
  }

  /**
   * Calculate dynamic polling interval based on quality
   */
  private calculatePollingInterval(): number {
    if (!this.config.enableDynamicPolling) {
      return this.config.pollingInterval;
    }

    const quality = this.calculateQuality();

    // Fast polling for poor quality (more frequent checks)
    if (quality.score < 50) {
      return this.config.fastPollingInterval;
    }

    // Slower polling for good quality
    return this.config.pollingInterval;
  }

  /**
   * Disconnect from real-time
   */
  disconnect(): void {
    this.state = 'disconnected';
    this.cleanup();
    this.emit({ type: 'disconnected' });
  }

  /**
   * Clean up all connections
   */
  private cleanup(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  private handleConnected(): void {
    this.state = 'connected';
    this.reconnectAttempts = 0;
    this.metrics.connectedAt = new Date();
    this.startHeartbeat();

    this.emit({ type: 'connected', mode: this.mode });
  }

  private handleDisconnected(reason?: string): void {
    if (this.state === 'disconnected') return;

    this.state = 'reconnecting';
    this.stopHeartbeat();
    this.reconnectAttempts++;

    this.emit({ type: 'disconnected', reason });

    // Check if we should switch modes
    if (this.shouldSwitchMode()) {
      this.switchToNextMode('Connection failed');
    } else {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Error): void {
    this.metrics.totalErrors++;
    this.metrics.lastErrorAt = new Date();

    this.emit({ type: 'error', error });

    // Switch mode if too many errors
    if (this.metrics.totalErrors > 5 && this.shouldSwitchMode()) {
      this.switchToNextMode('Too many errors');
    }
  }

  private handleMessage(message: RealtimeMessage): void {
    const now = Date.now();

    // Track message timing
    this.messageTimestamps.push(now);
    if (this.messageTimestamps.length > 100) {
      this.messageTimestamps.shift();
    }

    // Track sequence for gap detection
    if (message.sequence !== undefined) {
      if (this.lastSequence > 0 && message.sequence > this.lastSequence + 1) {
        this.missedMessages += message.sequence - this.lastSequence - 1;
      }
      this.lastSequence = message.sequence;
    }

    // Calculate latency if timestamp present
    if (message.timestamp) {
      const messageTime = new Date(message.timestamp).getTime();
      const latency = now - messageTime;
      if (latency >= 0 && latency < 60000) {
        this.recordLatency(latency);
      }
    }

    this.metrics.totalMessages++;
    this.metrics.lastMessageAt = new Date();

    this.emit({ type: 'message', message });

    // Check quality periodically
    this.checkQuality();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ADAPTIVE MODE SWITCHING
  // ─────────────────────────────────────────────────────────────────────────────

  private shouldSwitchMode(): boolean {
    if (!this.config.enableAdaptation) return false;

    // Don't switch too frequently
    if (Date.now() - this.modeStartTime < this.config.minModeTime) {
      return false;
    }

    // Switch if too many reconnect attempts
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      return true;
    }

    // Switch if quality is too low
    const quality = this.calculateQuality();
    if (quality.score < this.config.qualityThreshold) {
      return true;
    }

    return false;
  }

  private switchToNextMode(reason: string): void {
    const previousMode = this.mode;
    this.currentModeIndex++;

    if (this.currentModeIndex >= this.config.fallbackOrder.length) {
      // No more fallbacks - stay on last mode
      this.currentModeIndex = this.config.fallbackOrder.length - 1;
      this.scheduleReconnect();
      return;
    }

    const nextMode = this.config.fallbackOrder[this.currentModeIndex];
    this.reconnectAttempts = 0;

    console.log(
      `[AdaptiveClient] Switching from ${previousMode} to ${nextMode}: ${reason}`
    );

    this.emit({
      type: 'mode_changed',
      from: previousMode,
      to: nextMode,
      reason,
    });

    this.connectWithMode(nextMode);
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      this.config.reconnectDelayBase * Math.pow(2, this.reconnectAttempts - 1),
      this.config.reconnectDelayMax
    );

    this.emit({
      type: 'reconnecting',
      attempt: this.reconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.connectWithMode(this.mode);
    }, delay);
  }

  /**
   * Force mode switch (for testing or manual override)
   */
  forceMode(mode: ConnectionMode): void {
    if (mode === this.mode) return;

    const previousMode = this.mode;
    this.currentModeIndex = this.config.fallbackOrder.indexOf(mode);
    if (this.currentModeIndex === -1) this.currentModeIndex = 0;

    this.emit({
      type: 'mode_changed',
      from: previousMode,
      to: mode,
      reason: 'Manual override',
    });

    this.connectWithMode(mode);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // QUALITY MONITORING
  // ─────────────────────────────────────────────────────────────────────────────

  private calculateQuality(): ConnectionQuality {
    // Calculate average latency
    const avgLatency =
      this.latencies.length > 0
        ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
        : 0;

    // Calculate jitter (variance in latency)
    let jitter = 0;
    if (this.latencies.length > 1) {
      for (let i = 1; i < this.latencies.length; i++) {
        jitter += Math.abs(this.latencies[i] - this.latencies[i - 1]);
      }
      jitter /= this.latencies.length - 1;
    }

    // Calculate message rate (per minute)
    const now = Date.now();
    const recentMessages = this.messageTimestamps.filter(
      (t) => now - t < 60000
    ).length;

    // Calculate packet loss (missed messages)
    const totalExpected = this.metrics.totalMessages + this.missedMessages;
    const packetLoss =
      totalExpected > 0 ? (this.missedMessages / totalExpected) * 100 : 0;

    // Calculate uptime
    const uptime = this.metrics.connectedAt
      ? now - this.metrics.connectedAt.getTime()
      : 0;
    const totalTime = this.modeStartTime ? now - this.modeStartTime : 0;
    const uptimePercent =
      totalTime > 0 ? Math.min(100, (uptime / totalTime) * 100) : 100;

    // Calculate overall score (0-100)
    let score = 100;
    score -= Math.min(30, avgLatency / 100); // -30 for 3s latency
    score -= Math.min(20, jitter / 50); // -20 for 1s jitter
    score -= Math.min(30, packetLoss * 3); // -30 for 10% packet loss
    score -= Math.max(0, 20 - uptimePercent / 5); // -20 for 0% uptime
    score = Math.max(0, Math.min(100, score));

    return {
      latency: Math.round(avgLatency),
      packetLoss: Math.round(packetLoss * 10) / 10,
      jitter: Math.round(jitter),
      messageRate: recentMessages,
      uptimePercent: Math.round(uptimePercent),
      score: Math.round(score),
    };
  }

  private checkQuality(): void {
    const quality = this.calculateQuality();
    this.metrics.quality = quality;

    // Emit quality change event if significant
    if (quality.score < this.config.qualityThreshold) {
      this.emit({ type: 'quality_changed', quality });

      if (this.shouldSwitchMode()) {
        this.switchToNextMode('Quality degraded');
      }
    }
  }

  private recordLatency(latency: number): void {
    this.latencies.push(latency);
    if (this.latencies.length > 50) {
      this.latencies.shift();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HEARTBEAT
  // ─────────────────────────────────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastHeartbeat = Date.now();

    this.heartbeatTimer = setInterval(() => {
      this.checkHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private checkHeartbeat(): void {
    const now = Date.now();

    // Check if we've received any message recently
    const lastMessageTime = this.metrics.lastMessageAt?.getTime() || 0;
    const timeSinceMessage = now - lastMessageTime;

    if (
      timeSinceMessage > this.config.heartbeatTimeout &&
      this.state === 'connected'
    ) {
      console.warn('[AdaptiveClient] Heartbeat timeout');
      this.state = 'degraded';
      this.handleDisconnected('Heartbeat timeout');
    }

    this.lastHeartbeat = now;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENT SUBSCRIPTION
  // ─────────────────────────────────────────────────────────────────────────────

  on(callback: EventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: AdaptiveClientEvent): void {
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('[AdaptiveClient] Error in event listener:', error);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATUS & METRICS
  // ─────────────────────────────────────────────────────────────────────────────

  getState(): ConnectionState {
    return this.state;
  }

  getMode(): ConnectionMode {
    return this.mode;
  }

  getMetrics(): ConnectionMetrics {
    return {
      ...this.metrics,
      quality: this.calculateQuality(),
      uptime: this.metrics.connectedAt
        ? Date.now() - this.metrics.connectedAt.getTime()
        : 0,
    };
  }

  getQuality(): ConnectionQuality {
    return this.calculateQuality();
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  private createInitialMetrics(): ConnectionMetrics {
    return {
      mode: this.mode,
      state: 'disconnected',
      quality: {
        latency: 0,
        packetLoss: 0,
        jitter: 0,
        messageRate: 0,
        uptimePercent: 100,
        score: 100,
      },
      reconnectAttempts: 0,
      totalMessages: 0,
      totalErrors: 0,
      connectedAt: null,
      lastMessageAt: null,
      lastErrorAt: null,
      uptime: 0,
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = this.createInitialMetrics();
    this.latencies = [];
    this.messageTimestamps = [];
    this.missedMessages = 0;
    this.lastSequence = 0;
  }
}
