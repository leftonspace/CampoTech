/**
 * Adaptive Tracking Hook (Phase 6B.3.1)
 * ======================================
 *
 * React hook for resilient real-time tracking with automatic fallback.
 *
 * Usage:
 * ```typescript
 * import { useAdaptiveTracking } from '@/lib/realtime';
 *
 * function TrackingMap({ organizationId }) {
 *   const {
 *     technicians,
 *     connectionState,
 *     connectionMode,
 *     quality,
 *   } = useAdaptiveTracking({
 *     organizationId,
 *     onTechnicianUpdate: (update) => console.log('Technician moved:', update),
 *   });
 *
 *   return (
 *     <div>
 *       <p>Connection: {connectionState} via {connectionMode}</p>
 *       <p>Quality: {quality.score}%</p>
 *       {technicians.map(tech => (
 *         <Marker key={tech.id} position={tech.location} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AdaptiveClient } from './adaptive-client';
import {
  ConnectionMode,
  ConnectionState,
  ConnectionQuality,
  AdaptiveConfig,
  DEFAULT_ADAPTIVE_CONFIG,
  TrackingUpdate,
  JobUpdate,
  RealtimeMessage,
  AdaptiveClientEvent,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface UseAdaptiveTrackingOptions {
  /** Organization ID to subscribe to */
  organizationId: string;
  /** Enable the tracking subscription */
  enabled?: boolean;
  /** Filter to specific technician IDs */
  technicianIds?: string[];
  /** Filter to specific job IDs */
  jobIds?: string[];
  /** Callback for technician updates */
  onTechnicianUpdate?: (update: TrackingUpdate) => void;
  /** Callback for job updates */
  onJobUpdate?: (update: JobUpdate) => void;
  /** Callback for connection state changes */
  onConnectionChange?: (state: ConnectionState, mode: ConnectionMode) => void;
  /** Callback for quality changes */
  onQualityChange?: (quality: ConnectionQuality) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Custom adaptive config */
  config?: Partial<AdaptiveConfig>;
}

export interface UseAdaptiveTrackingResult {
  /** Current technician locations */
  technicians: Map<string, TrackingUpdate>;
  /** Current job statuses */
  jobs: Map<string, JobUpdate>;
  /** Connection state */
  connectionState: ConnectionState;
  /** Current connection mode */
  connectionMode: ConnectionMode;
  /** Connection quality metrics */
  quality: ConnectionQuality;
  /** Whether connected */
  isConnected: boolean;
  /** Whether degraded (using fallback mode) */
  isDegraded: boolean;
  /** Manual reconnect */
  reconnect: () => void;
  /** Force specific mode */
  forceMode: (mode: ConnectionMode) => void;
  /** Last update time */
  lastUpdate: Date | null;
  /** Error if any */
  error: Error | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export function useAdaptiveTracking(
  options: UseAdaptiveTrackingOptions
): UseAdaptiveTrackingResult {
  const {
    organizationId,
    enabled = true,
    technicianIds,
    jobIds,
    onTechnicianUpdate,
    onJobUpdate,
    onConnectionChange,
    onQualityChange,
    onError,
    config,
  } = options;

  // State
  const [technicians, setTechnicians] = useState<Map<string, TrackingUpdate>>(
    new Map()
  );
  const [jobs, setJobs] = useState<Map<string, JobUpdate>>(new Map());
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('sse');
  const [quality, setQuality] = useState<ConnectionQuality>({
    latency: 0,
    packetLoss: 0,
    jitter: 0,
    messageRate: 0,
    uptimePercent: 100,
    score: 100,
  });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Refs for stable callbacks
  const clientRef = useRef<AdaptiveClient | null>(null);
  const callbacksRef = useRef({
    onTechnicianUpdate,
    onJobUpdate,
    onConnectionChange,
    onQualityChange,
    onError,
  });

  // Update callbacks ref
  useEffect(() => {
    callbacksRef.current = {
      onTechnicianUpdate,
      onJobUpdate,
      onConnectionChange,
      onQualityChange,
      onError,
    };
  }, [onTechnicianUpdate, onJobUpdate, onConnectionChange, onQualityChange, onError]);

  // Handle tracking message
  const handleMessage = useCallback(
    (message: RealtimeMessage) => {
      setLastUpdate(new Date());
      setError(null);

      switch (message.type) {
        case 'technician_location':
        case 'technician_status': {
          const update = message.data as TrackingUpdate;

          // Apply filter if specified
          if (
            technicianIds &&
            technicianIds.length > 0 &&
            !technicianIds.includes(update.technicianId)
          ) {
            return;
          }

          setTechnicians((prev) => {
            const next = new Map(prev);
            next.set(update.technicianId, {
              ...update,
              updatedAt: new Date(update.updatedAt),
            });
            return next;
          });

          callbacksRef.current.onTechnicianUpdate?.(update);
          break;
        }

        case 'job_status':
        case 'job_assigned':
        case 'job_completed': {
          const update = message.data as JobUpdate;

          // Apply filter if specified
          if (
            jobIds &&
            jobIds.length > 0 &&
            !jobIds.includes(update.jobId)
          ) {
            return;
          }

          setJobs((prev) => {
            const next = new Map(prev);
            next.set(update.jobId, {
              ...update,
              updatedAt: new Date(update.updatedAt),
            });
            return next;
          });

          callbacksRef.current.onJobUpdate?.(update);
          break;
        }

        case 'eta_updated': {
          const update = message.data as TrackingUpdate;
          setTechnicians((prev) => {
            const next = new Map(prev);
            const existing = prev.get(update.technicianId);
            if (existing) {
              next.set(update.technicianId, {
                ...existing,
                etaMinutes: update.etaMinutes,
                updatedAt: new Date(),
              });
            }
            return next;
          });
          break;
        }

        case 'heartbeat':
          // Just update last update time
          break;
      }
    },
    [technicianIds, jobIds]
  );

  // Handle client events
  const handleEvent = useCallback(
    (event: AdaptiveClientEvent) => {
      switch (event.type) {
        case 'connected':
          setConnectionState('connected');
          setConnectionMode(event.mode);
          setError(null);
          callbacksRef.current.onConnectionChange?.('connected', event.mode);
          break;

        case 'disconnected':
          setConnectionState('disconnected');
          break;

        case 'reconnecting':
          setConnectionState('reconnecting');
          break;

        case 'mode_changed':
          setConnectionMode(event.to);
          callbacksRef.current.onConnectionChange?.(
            connectionState,
            event.to
          );
          break;

        case 'quality_changed':
          setQuality(event.quality);
          callbacksRef.current.onQualityChange?.(event.quality);
          break;

        case 'error':
          setError(event.error);
          callbacksRef.current.onError?.(event.error);
          break;

        case 'message':
          handleMessage(event.message);
          break;
      }
    },
    [connectionState, handleMessage]
  );

  // Create and connect client
  useEffect(() => {
    if (!enabled || !organizationId) {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      return;
    }

    // Create client
    const client = new AdaptiveClient({
      ...DEFAULT_ADAPTIVE_CONFIG,
      ...config,
    });
    clientRef.current = client;

    // Subscribe to events
    const unsubscribe = client.on(handleEvent);

    // Build URLs
    const sseUrl = `/api/tracking/subscribe?organizationId=${organizationId}`;
    const pollingUrl = `/api/tracking/poll?organizationId=${organizationId}`;

    // Connect
    client.connect(sseUrl, pollingUrl);

    // Cleanup
    return () => {
      unsubscribe();
      client.disconnect();
      clientRef.current = null;
    };
  }, [enabled, organizationId, config, handleEvent]);

  // Update quality periodically
  useEffect(() => {
    if (!clientRef.current) return;

    const interval = setInterval(() => {
      if (clientRef.current) {
        setQuality(clientRef.current.getQuality());
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (!clientRef.current || !organizationId) return;

    clientRef.current.disconnect();

    const sseUrl = `/api/tracking/subscribe?organizationId=${organizationId}`;
    const pollingUrl = `/api/tracking/poll?organizationId=${organizationId}`;

    clientRef.current.connect(sseUrl, pollingUrl);
  }, [organizationId]);

  // Force mode
  const forceMode = useCallback((mode: ConnectionMode) => {
    if (clientRef.current) {
      clientRef.current.forceMode(mode);
    }
  }, []);

  // Computed values
  const isConnected = connectionState === 'connected';
  const isDegraded =
    connectionMode !== DEFAULT_ADAPTIVE_CONFIG.preferredMode ||
    quality.score < 70;

  return {
    technicians,
    jobs,
    connectionState,
    connectionMode,
    quality,
    isConnected,
    isDegraded,
    reconnect,
    forceMode,
    lastUpdate,
    error,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLIFIED HOOK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simplified hook for just technician locations
 */
export function useTechnicianLocations(
  organizationId: string,
  options: {
    enabled?: boolean;
    technicianIds?: string[];
    onUpdate?: (technicians: Map<string, TrackingUpdate>) => void;
  } = {}
) {
  const { enabled = true, technicianIds, onUpdate } = options;

  const result = useAdaptiveTracking({
    organizationId,
    enabled,
    technicianIds,
    onTechnicianUpdate: () => {
      // Will trigger re-render, then call onUpdate
    },
  });

  // Call onUpdate when technicians change
  useEffect(() => {
    if (result.technicians.size > 0) {
      onUpdate?.(result.technicians);
    }
  }, [result.technicians, onUpdate]);

  return {
    technicians: Array.from(result.technicians.values()),
    isConnected: result.isConnected,
    isDegraded: result.isDegraded,
    quality: result.quality.score,
    reconnect: result.reconnect,
  };
}

/**
 * Simplified hook for job status updates
 */
export function useJobStatusUpdates(
  organizationId: string,
  options: {
    enabled?: boolean;
    jobIds?: string[];
    onStatusChange?: (update: JobUpdate) => void;
  } = {}
) {
  const { enabled = true, jobIds, onStatusChange } = options;

  const result = useAdaptiveTracking({
    organizationId,
    enabled,
    jobIds,
    onJobUpdate: onStatusChange,
  });

  return {
    jobs: Array.from(result.jobs.values()),
    isConnected: result.isConnected,
    lastUpdate: result.lastUpdate,
  };
}
