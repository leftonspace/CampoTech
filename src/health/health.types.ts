/**
 * Health Check Types
 * ==================
 *
 * Type definitions for health check system
 */

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
  lastChecked: Date;
}

export interface HealthCheckResult {
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: Date;
  components: ComponentHealth[];
}

export interface ReadinessCheckResult {
  ready: boolean;
  timestamp: Date;
  checks: {
    name: string;
    ready: boolean;
    message?: string;
  }[];
}

export interface LivenessCheckResult {
  alive: boolean;
  timestamp: Date;
  pid: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}

export interface HealthChecker {
  name: string;
  check(): Promise<ComponentHealth>;
}
