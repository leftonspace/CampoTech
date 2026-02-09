/**
 * Feature Degradation & System Monitoring Module
 * ===============================================
 *
 * Central module for graceful feature degradation and system health monitoring.
 *
 * Two complementary systems:
 * 1. OPERATIONAL HEALTH - Is it working right now? (this module)
 * 2. INFRASTRUCTURE CAPACITY - How much room left? (system-capacity.service.ts)
 *
 * Usage:
 *   import { getDegradationManager, isFeatureAvailable, getSystemHealth } from '@/lib/degradation';
 *
 * For unified status (health + capacity):
 *   import { getUnifiedSystemStatus } from '@/lib/services/system-capacity.service';
 */


// Manager
export {
  DegradationManager,
  getDegradationManager,
  resetDegradationManager,
} from './manager';

// Types
export type {
  ServiceId,
  ServiceStatus,
  ServiceState,
  FeatureId,
  FeatureState,
  SystemHealth,
  SystemHealthStatus,
  Incident,
  IncidentUpdate,
  DegradationConfig,
  CircuitState,
} from './types';

export {
  DEFAULT_DEGRADATION_CONFIG,
  SERVICE_METADATA,
  FEATURE_METADATA,
} from './types';

// Client-side hooks (re-exported for convenience)
export {
  useHealth,
  useFeatureAvailable,
  useServiceHealth,
  useSystemStatus,
} from './use-health';

export type { HealthState, UseHealthOptions } from './use-health';

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

import { getDegradationManager } from './manager';
import type { ServiceId, FeatureId, SystemHealth, ServiceState } from './types';

/**
 * Check if a feature is currently available
 */
export async function isFeatureAvailable(featureId: FeatureId): Promise<boolean> {
  const manager = getDegradationManager();
  const health = await manager.getSystemHealth();
  return health.features[featureId]?.available ?? false;
}

/**
 * Check if a service is healthy
 */
export async function isServiceHealthy(serviceId: ServiceId): Promise<boolean> {
  const manager = getDegradationManager();
  const state = await manager.getServiceState(serviceId);
  return state.status === 'healthy';
}

/**
 * Get service state
 */
export async function getServiceState(serviceId: ServiceId): Promise<ServiceState> {
  const manager = getDegradationManager();
  return manager.getServiceState(serviceId);
}

/**
 * Get current system health
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const manager = getDegradationManager();
  return manager.getSystemHealth();
}

/**
 * Get user-friendly message for a degraded feature
 */
export async function getFeatureMessage(featureId: FeatureId): Promise<string> {
  const manager = getDegradationManager();
  const health = await manager.getSystemHealth();
  return health.features[featureId]?.userMessage ?? 'Estado desconocido';
}

/**
 * Get active incidents
 */
export function getActiveIncidents() {
  const manager = getDegradationManager();
  return manager.getActiveIncidents();
}

/**
 * Subscribe to health updates
 */
export function subscribeToHealth(
  callback: (health: SystemHealth) => void
): () => void {
  const manager = getDegradationManager();
  return manager.subscribe(callback);
}

/**
 * Start health monitoring
 */
export function startHealthMonitoring(): void {
  const manager = getDegradationManager();
  manager.startHealthChecks();
}

/**
 * Stop health monitoring
 */
export function stopHealthMonitoring(): void {
  const manager = getDegradationManager();
  manager.stopHealthChecks();
}

/**
 * Format health status for API response
 */
export function formatHealthResponse(health: SystemHealth): {
  status: string;
  message: string;
  services: Array<{
    id: string;
    name: string;
    status: string;
    successRate: number;
  }>;
  features: Array<{
    id: string;
    name: string;
    available: boolean;
    message: string;
  }>;
  incidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
  }>;
  updatedAt: string;
} {
  return {
    status: health.status,
    message: health.message,
    services: Object.values(health.services).map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      successRate: s.successRate,
    })),
    features: Object.values(health.features).map((f) => ({
      id: f.id,
      name: f.name,
      available: f.available,
      message: f.userMessage,
    })),
    incidents: health.activeIncidents.map((i) => ({
      id: i.id,
      title: i.title,
      severity: i.severity,
      status: i.status,
    })),
    updatedAt: health.updatedAt.toISOString(),
  };
}
