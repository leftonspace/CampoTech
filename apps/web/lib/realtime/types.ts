/**
 * Real-time Communication Types (Phase 6B.3)
 * ===========================================
 *
 * Type definitions for adaptive real-time communication.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ConnectionMode = 'websocket' | 'sse' | 'polling';

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'degraded'
  | 'failed';

export interface ConnectionQuality {
  /** Latency in milliseconds */
  latency: number;
  /** Packet loss percentage (0-100) */
  packetLoss: number;
  /** Jitter in milliseconds */
  jitter: number;
  /** Messages received per minute */
  messageRate: number;
  /** Connection uptime percentage (0-100) */
  uptimePercent: number;
  /** Overall quality score (0-100) */
  score: number;
}

export interface ConnectionMetrics {
  mode: ConnectionMode;
  state: ConnectionState;
  quality: ConnectionQuality;
  reconnectAttempts: number;
  totalMessages: number;
  totalErrors: number;
  connectedAt: Date | null;
  lastMessageAt: Date | null;
  lastErrorAt: Date | null;
  uptime: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADAPTIVE CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export interface AdaptiveConfig {
  /** Preferred mode (will fallback if unavailable) */
  preferredMode: ConnectionMode;
  /** Fallback order when preferred mode fails */
  fallbackOrder: ConnectionMode[];
  /** Quality threshold to trigger mode switch (0-100) */
  qualityThreshold: number;
  /** Minimum time in mode before allowing switch (ms) */
  minModeTime: number;
  /** Maximum reconnect attempts before mode switch */
  maxReconnectAttempts: number;
  /** Reconnect delay base (ms) */
  reconnectDelayBase: number;
  /** Maximum reconnect delay (ms) */
  reconnectDelayMax: number;
  /** Polling interval (ms) - only for polling mode */
  pollingInterval: number;
  /** Fast polling interval (ms) - for high-priority updates */
  fastPollingInterval: number;
  /** Latency threshold for degraded state (ms) */
  latencyThreshold: number;
  /** Enable automatic mode adaptation */
  enableAdaptation: boolean;
  /** Enable quality-based polling interval adjustment */
  enableDynamicPolling: boolean;
  /** Heartbeat interval (ms) */
  heartbeatInterval: number;
  /** Heartbeat timeout (ms) */
  heartbeatTimeout: number;
}

export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveConfig = {
  preferredMode: 'sse',
  fallbackOrder: ['sse', 'polling'],
  qualityThreshold: 50,
  minModeTime: 30000, // 30 seconds
  maxReconnectAttempts: 3,
  reconnectDelayBase: 1000,
  reconnectDelayMax: 30000,
  pollingInterval: 15000,
  fastPollingInterval: 5000,
  latencyThreshold: 5000,
  enableAdaptation: true,
  enableDynamicPolling: true,
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type MessagePriority = 'high' | 'normal' | 'low';

export interface RealtimeMessage<T = unknown> {
  id: string;
  type: string;
  data: T;
  priority: MessagePriority;
  timestamp: Date;
  sequence?: number;
}

export interface RealtimeSubscription {
  id: string;
  channel: string;
  filter?: Record<string, unknown>;
  callback: (message: RealtimeMessage) => void;
  priority: MessagePriority;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AdaptiveClientEvent =
  | { type: 'connected'; mode: ConnectionMode }
  | { type: 'disconnected'; reason?: string }
  | { type: 'reconnecting'; attempt: number; delay: number }
  | { type: 'mode_changed'; from: ConnectionMode; to: ConnectionMode; reason: string }
  | { type: 'quality_changed'; quality: ConnectionQuality }
  | { type: 'error'; error: Error }
  | { type: 'message'; message: RealtimeMessage };

export type EventCallback = (event: AdaptiveClientEvent) => void;

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKING SPECIFIC TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrackingUpdate {
  technicianId: string;
  technicianName: string;
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  };
  status: 'en_linea' | 'en_camino' | 'trabajando' | 'sin_conexion';
  currentJobId?: string;
  etaMinutes?: number;
  batteryLevel?: number;
  isMoving: boolean;
  updatedAt: Date;
}

export interface JobUpdate {
  jobId: string;
  jobNumber: string;
  status: string;
  previousStatus?: string;
  technicianId?: string;
  customerId: string;
  location?: {
    lat: number;
    lng: number;
  };
  updatedAt: Date;
}

export type TrackingMessageType =
  | 'technician_location'
  | 'technician_status'
  | 'job_status'
  | 'job_assigned'
  | 'job_completed'
  | 'eta_updated'
  | 'heartbeat';

export interface TrackingSubscriptionOptions {
  organizationId: string;
  technicianIds?: string[];
  jobIds?: string[];
  onTechnicianUpdate?: (update: TrackingUpdate) => void;
  onJobUpdate?: (update: JobUpdate) => void;
  onConnectionChange?: (state: ConnectionState, mode: ConnectionMode) => void;
  priority?: MessagePriority;
}
