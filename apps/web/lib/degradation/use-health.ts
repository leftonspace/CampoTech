'use client';

/**
 * Health Status Hook
 * ==================
 *
 * React hook for consuming system health status on the client side.
 * Polls the health endpoint and provides real-time updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  SystemHealth,
  ServiceId,
  FeatureId,
  SystemHealthStatus,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface HealthState {
  /** Current health data */
  health: SystemHealth | null;
  /** Is loading */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Last successful fetch */
  lastUpdated: Date | null;
  /** Is stale (last update > 60s ago) */
  isStale: boolean;
}

export interface UseHealthOptions {
  /** Polling interval in ms (default: 30000) */
  pollInterval?: number;
  /** Enable polling (default: true) */
  enabled?: boolean;
  /** Callback on status change */
  onStatusChange?: (status: SystemHealthStatus) => void;
  /** Callback on incident */
  onIncident?: (incident: SystemHealth['activeIncidents'][0]) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useHealth(options: UseHealthOptions = {}): HealthState & {
  refresh: () => Promise<void>;
  isFeatureAvailable: (featureId: FeatureId) => boolean;
  isServiceHealthy: (serviceId: ServiceId) => boolean;
  getDegradedFeatures: () => FeatureId[];
} {
  const {
    pollInterval = 30000,
    enabled = true,
    onStatusChange,
    onIncident,
  } = options;

  const [state, setState] = useState<HealthState>({
    health: null,
    loading: true,
    error: null,
    lastUpdated: null,
    isStale: false,
  });

  const previousStatusRef = useRef<SystemHealthStatus | null>(null);
  const previousIncidentsRef = useRef<Set<string>>(new Set());

  // Fetch health data
  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/health');

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = await response.json();

      // Transform API response to SystemHealth format
      const health: SystemHealth = {
        status: data.status as SystemHealthStatus,
        message: data.message,
        services: data.services.reduce(
          (acc: Record<ServiceId, SystemHealth['services'][ServiceId]>, s: { id: ServiceId; name: string; status: string; successRate: number }) => {
            acc[s.id] = {
              id: s.id,
              name: s.name,
              status: s.status as SystemHealth['services'][ServiceId]['status'],
              successRate: s.successRate,
              avgLatency: 0,
              lastSuccess: null,
              lastError: null,
              hasFallback: false,
              impactLevel: 'medium',
              updatedAt: new Date(data.updatedAt),
            };
            return acc;
          },
          {} as Record<ServiceId, SystemHealth['services'][ServiceId]>
        ),
        features: data.features.reduce(
          (acc: Record<FeatureId, SystemHealth['features'][FeatureId]>, f: { id: FeatureId; name: string; available: boolean; message: string }) => {
            acc[f.id] = {
              id: f.id,
              name: f.name,
              available: f.available,
              affectedServices: [],
              userMessage: f.message,
              severity: f.available ? 'info' : 'warning',
              updatedAt: new Date(data.updatedAt),
            };
            return acc;
          },
          {} as Record<FeatureId, SystemHealth['features'][FeatureId]>
        ),
        activeIncidents: data.incidents.map((i: { id: string; title: string; severity: string; status: string }) => ({
          id: i.id,
          services: [],
          features: [],
          title: i.title,
          description: '',
          severity: i.severity as 'minor' | 'major' | 'critical',
          status: i.status as 'investigating' | 'identified' | 'monitoring' | 'resolved',
          startedAt: new Date(),
          updates: [],
        })),
        degradedCount: data.features.filter((f: { available: boolean }) => !f.available).length,
        totalServices: data.services.length,
        healthyCount: data.services.filter((s: { status: string }) => s.status === 'healthy').length,
        updatedAt: new Date(data.updatedAt),
      };

      // Check for status change
      if (onStatusChange && previousStatusRef.current !== null && previousStatusRef.current !== health.status) {
        onStatusChange(health.status);
      }
      previousStatusRef.current = health.status;

      // Check for new incidents
      if (onIncident) {
        for (const incident of health.activeIncidents) {
          if (!previousIncidentsRef.current.has(incident.id)) {
            onIncident(incident);
          }
        }
        previousIncidentsRef.current = new Set(health.activeIncidents.map((i) => i.id));
      }

      setState({
        health,
        loading: false,
        error: null,
        lastUpdated: new Date(),
        isStale: false,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
        isStale: prev.lastUpdated
          ? Date.now() - prev.lastUpdated.getTime() > 60000
          : true,
      }));
    }
  }, [onStatusChange, onIncident]);

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) return;

    fetchHealth();

    const interval = setInterval(fetchHealth, pollInterval);

    return () => clearInterval(interval);
  }, [enabled, pollInterval, fetchHealth]);

  // Check staleness
  useEffect(() => {
    if (!state.lastUpdated) return;

    const checkStale = () => {
      const isStale = Date.now() - state.lastUpdated!.getTime() > 60000;
      if (isStale !== state.isStale) {
        setState((prev) => ({ ...prev, isStale }));
      }
    };

    const interval = setInterval(checkStale, 10000);
    return () => clearInterval(interval);
  }, [state.lastUpdated, state.isStale]);

  // Helper functions
  const isFeatureAvailable = useCallback(
    (featureId: FeatureId): boolean => {
      return state.health?.features[featureId]?.available ?? true;
    },
    [state.health]
  );

  const isServiceHealthy = useCallback(
    (serviceId: ServiceId): boolean => {
      return state.health?.services[serviceId]?.status === 'healthy';
    },
    [state.health]
  );

  const getDegradedFeatures = useCallback((): FeatureId[] => {
    if (!state.health) return [];
    return Object.entries(state.health.features)
      .filter(([, f]) => !f.available)
      .map(([id]) => id as FeatureId);
  }, [state.health]);

  return {
    ...state,
    refresh: fetchHealth,
    isFeatureAvailable,
    isServiceHealthy,
    getDegradedFeatures,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a specific feature is available
 */
export function useFeatureAvailable(featureId: FeatureId): {
  available: boolean;
  loading: boolean;
  message: string;
} {
  const { health, loading, isFeatureAvailable } = useHealth({
    pollInterval: 60000, // Less frequent for individual features
  });

  return {
    available: isFeatureAvailable(featureId),
    loading,
    message: health?.features[featureId]?.userMessage ?? '',
  };
}

/**
 * Check if a specific service is healthy
 */
export function useServiceHealth(serviceId: ServiceId): {
  healthy: boolean;
  loading: boolean;
  status: string;
} {
  const { health, loading, isServiceHealthy } = useHealth({
    pollInterval: 60000,
  });

  return {
    healthy: isServiceHealthy(serviceId),
    loading,
    status: health?.services[serviceId]?.status ?? 'unknown',
  };
}

/**
 * Get overall system status
 */
export function useSystemStatus(): {
  status: SystemHealthStatus;
  message: string;
  loading: boolean;
  hasIncidents: boolean;
} {
  const { health, loading } = useHealth();

  return {
    status: health?.status ?? 'operational',
    message: health?.message ?? 'Cargando estado del sistema...',
    loading,
    hasIncidents: (health?.activeIncidents.length ?? 0) > 0,
  };
}
