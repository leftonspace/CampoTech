/**
 * Real-time Communication Module (Phase 6B.3)
 * ============================================
 *
 * Adaptive real-time communication with automatic fallback.
 * WebSocket → SSE → Polling based on connection quality.
 *
 * Usage:
 * ```typescript
 * import { useAdaptiveTracking, AdaptiveClient } from '@/lib/realtime';
 *
 * // React hook (recommended)
 * function TrackingMap({ orgId }) {
 *   const { technicians, connectionMode, quality } = useAdaptiveTracking({
 *     organizationId: orgId,
 *   });
 *   // ...
 * }
 *
 * // Direct client usage
 * const client = new AdaptiveClient();
 * client.on((event) => console.log(event));
 * await client.connect('/api/tracking/subscribe?orgId=123');
 * ```
 */

// Types
export type {
  ConnectionMode,
  ConnectionState,
  ConnectionQuality,
  ConnectionMetrics,
  AdaptiveConfig,
  RealtimeMessage,
  RealtimeSubscription,
  MessagePriority,
  AdaptiveClientEvent,
  EventCallback,
  TrackingUpdate,
  JobUpdate,
  TrackingMessageType,
  TrackingSubscriptionOptions,
} from './types';

export { DEFAULT_ADAPTIVE_CONFIG } from './types';

// Adaptive client
export { AdaptiveClient } from './adaptive-client';

// React hooks
export {
  useAdaptiveTracking,
  useTechnicianLocations,
  useJobStatusUpdates,
  type UseAdaptiveTrackingOptions,
  type UseAdaptiveTrackingResult,
} from './use-adaptive-tracking';

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

import type { ConnectionQuality } from './types';

/**
 * Get quality description for display
 */
export function getQualityLabel(quality: ConnectionQuality): string {
  if (quality.score >= 80) return 'Excelente';
  if (quality.score >= 60) return 'Buena';
  if (quality.score >= 40) return 'Regular';
  if (quality.score >= 20) return 'Deficiente';
  return 'Crítica';
}

/**
 * Get quality color for display
 */
export function getQualityColor(quality: ConnectionQuality): string {
  if (quality.score >= 80) return 'green';
  if (quality.score >= 60) return 'lime';
  if (quality.score >= 40) return 'yellow';
  if (quality.score >= 20) return 'orange';
  return 'red';
}

/**
 * Format latency for display
 */
export function formatLatency(latencyMs: number): string {
  if (latencyMs < 100) return `${latencyMs}ms`;
  if (latencyMs < 1000) return `${Math.round(latencyMs)}ms`;
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

/**
 * Check if connection quality is acceptable for real-time
 */
export function isRealtimeViable(quality: ConnectionQuality): boolean {
  return quality.score >= 40 && quality.latency < 5000;
}

/**
 * Get recommended mode based on quality
 */
export function getRecommendedMode(
  quality: ConnectionQuality
): 'sse' | 'polling' {
  if (quality.score >= 60 && quality.packetLoss < 5) {
    return 'sse';
  }
  return 'polling';
}
