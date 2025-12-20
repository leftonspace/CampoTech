/**
 * Degradation Manager
 * ===================
 *
 * Central manager for feature degradation across all services.
 * Aggregates circuit breaker states and provides unified health view.
 */

import {
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
  DEFAULT_DEGRADATION_CONFIG,
  SERVICE_METADATA,
  FEATURE_METADATA,
} from './types';

// Import circuit breakers
import { getMPCircuitBreaker } from '@/lib/integrations/mercadopago';
import { getWACircuitBreaker } from '@/lib/integrations/whatsapp';

// ═══════════════════════════════════════════════════════════════════════════════
// DEGRADATION MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class DegradationManager {
  private config: DegradationConfig;
  private incidents: Map<string, Incident> = new Map();
  private listeners: Set<(health: SystemHealth) => void> = new Set();
  private lastHealth: SystemHealth | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<DegradationConfig> = {}) {
    this.config = { ...DEFAULT_DEGRADATION_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SERVICE STATE COLLECTION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get state for a specific service
   */
  async getServiceState(serviceId: ServiceId): Promise<ServiceState> {
    const metadata = SERVICE_METADATA[serviceId];

    switch (serviceId) {
      case 'mercadopago':
        return this.getMercadoPagoState();

      case 'whatsapp':
        return this.getWhatsAppState();

      case 'openai':
        return this.getOpenAIState();

      case 'afip':
        return this.getAFIPState();

      case 'database':
        return this.getDatabaseState();

      case 'redis':
        return this.getRedisState();

      case 'storage':
        return this.getStorageState();

      default:
        return {
          id: serviceId,
          name: metadata.name,
          status: 'unknown',
          successRate: 0,
          avgLatency: 0,
          lastSuccess: null,
          lastError: null,
          hasFallback: metadata.hasFallback,
          fallbackDescription: metadata.fallbackDescription,
          impactLevel: metadata.impactLevel,
          updatedAt: new Date(),
        };
    }
  }

  /**
   * Get MercadoPago service state
   */
  private getMercadoPagoState(): ServiceState {
    const metadata = SERVICE_METADATA.mercadopago;
    const circuitBreaker = getMPCircuitBreaker();
    const status = circuitBreaker.getStatus();

    return {
      id: 'mercadopago',
      name: metadata.name,
      status: this.circuitStateToStatus(status.state),
      circuitState: status.state,
      successRate: this.calculateSuccessRate(status.successes, status.failures),
      avgLatency: 0, // Would need latency tracking
      lastSuccess: status.lastSuccess,
      lastError: status.lastFailure,
      recoveryEta: status.nextRetryAt || undefined,
      hasFallback: metadata.hasFallback,
      fallbackDescription: metadata.fallbackDescription,
      impactLevel: metadata.impactLevel,
      updatedAt: new Date(),
    };
  }

  /**
   * Get WhatsApp service state
   */
  private getWhatsAppState(): ServiceState {
    const metadata = SERVICE_METADATA.whatsapp;
    const circuitBreaker = getWACircuitBreaker();
    const status = circuitBreaker.getStatus();

    return {
      id: 'whatsapp',
      name: metadata.name,
      status: this.circuitStateToStatus(status.state),
      circuitState: status.state,
      successRate: this.calculateSuccessRate(status.successes, status.failures),
      avgLatency: circuitBreaker.getAverageLatency(),
      lastSuccess: status.lastSuccess,
      lastError: status.lastFailure,
      recoveryEta: status.nextRetryAt || undefined,
      hasFallback: metadata.hasFallback,
      fallbackDescription: metadata.fallbackDescription,
      impactLevel: metadata.impactLevel,
      updatedAt: new Date(),
    };
  }

  /**
   * Get OpenAI service state
   */
  private async getOpenAIState(): Promise<ServiceState> {
    const metadata = SERVICE_METADATA.openai;

    try {
      const { getOpenAIFallbackHandler } = await import(
        '@/lib/integrations/openai'
      );
      const fallbackHandler = getOpenAIFallbackHandler();
      const serviceStatus = fallbackHandler.getServiceStatus();

      return {
        id: 'openai',
        name: metadata.name,
        status: serviceStatus.available ? 'healthy' : 'unavailable',
        circuitState: serviceStatus.circuitState,
        successRate: serviceStatus.successRate,
        avgLatency: serviceStatus.avgLatency,
        lastSuccess: serviceStatus.lastSuccess,
        lastError: serviceStatus.lastError,
        hasFallback: metadata.hasFallback,
        fallbackDescription: metadata.fallbackDescription,
        impactLevel: metadata.impactLevel,
        updatedAt: new Date(),
      };
    } catch {
      return this.getDefaultServiceState('openai');
    }
  }

  /**
   * Get AFIP service state
   */
  private async getAFIPState(): Promise<ServiceState> {
    const metadata = SERVICE_METADATA.afip;

    try {
      const { getAFIPCircuitBreaker } = await import('@/lib/integrations/afip');
      const circuitBreaker = getAFIPCircuitBreaker();
      // Use getGlobalStatus() since the singleton is a PerOrgCircuitBreaker
      const status = circuitBreaker.getGlobalStatus();

      return {
        id: 'afip',
        name: metadata.name,
        status: this.circuitStateToStatus(status.state),
        circuitState: status.state,
        successRate: this.calculateSuccessRate(status.successes, status.failures),
        avgLatency: 0,
        lastSuccess: status.lastSuccess,
        lastError: status.lastFailure,
        recoveryEta: status.nextRetryAt || undefined,
        hasFallback: metadata.hasFallback,
        fallbackDescription: metadata.fallbackDescription,
        impactLevel: metadata.impactLevel,
        updatedAt: new Date(),
      };
    } catch {
      return this.getDefaultServiceState('afip');
    }
  }

  /**
   * Get Database service state
   */
  private async getDatabaseState(): Promise<ServiceState> {
    const metadata = SERVICE_METADATA.database;

    try {
      const { prisma } = await import('@/lib/prisma');
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      return {
        id: 'database',
        name: metadata.name,
        status: 'healthy',
        successRate: 100,
        avgLatency: latency,
        lastSuccess: new Date(),
        lastError: null,
        hasFallback: metadata.hasFallback,
        impactLevel: metadata.impactLevel,
        updatedAt: new Date(),
      };
    } catch (error) {
      return {
        id: 'database',
        name: metadata.name,
        status: 'unavailable',
        successRate: 0,
        avgLatency: 0,
        lastSuccess: null,
        lastError: new Date(),
        lastErrorMessage: error instanceof Error ? error.message : 'Unknown error',
        hasFallback: metadata.hasFallback,
        impactLevel: metadata.impactLevel,
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Get Redis service state
   */
  private getRedisState(): ServiceState {
    const metadata = SERVICE_METADATA.redis;

    // TODO: Implement actual Redis health check
    return {
      id: 'redis',
      name: metadata.name,
      status: 'healthy',
      successRate: 100,
      avgLatency: 0,
      lastSuccess: new Date(),
      lastError: null,
      hasFallback: metadata.hasFallback,
      fallbackDescription: metadata.fallbackDescription,
      impactLevel: metadata.impactLevel,
      updatedAt: new Date(),
    };
  }

  /**
   * Get Storage service state
   */
  private getStorageState(): ServiceState {
    const metadata = SERVICE_METADATA.storage;

    // TODO: Implement actual storage health check
    return {
      id: 'storage',
      name: metadata.name,
      status: 'healthy',
      successRate: 100,
      avgLatency: 0,
      lastSuccess: new Date(),
      lastError: null,
      hasFallback: metadata.hasFallback,
      impactLevel: metadata.impactLevel,
      updatedAt: new Date(),
    };
  }

  /**
   * Get default service state for unknown/errored services
   */
  private getDefaultServiceState(serviceId: ServiceId): ServiceState {
    const metadata = SERVICE_METADATA[serviceId];
    return {
      id: serviceId,
      name: metadata.name,
      status: 'unknown',
      successRate: 0,
      avgLatency: 0,
      lastSuccess: null,
      lastError: null,
      hasFallback: metadata.hasFallback,
      fallbackDescription: metadata.fallbackDescription,
      impactLevel: metadata.impactLevel,
      updatedAt: new Date(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE STATE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get feature state based on service dependencies
   */
  getFeatureState(
    featureId: FeatureId,
    services: Record<ServiceId, ServiceState>
  ): FeatureState {
    const metadata = FEATURE_METADATA[featureId];
    const affectedServices = metadata.dependencies.filter(
      (dep) => services[dep]?.status !== 'healthy'
    );

    const available = affectedServices.length === 0;

    let degradedReason: string | undefined;
    let userMessage = `${metadata.name} funcionando normalmente`;

    if (!available) {
      const serviceNames = affectedServices
        .map((s) => SERVICE_METADATA[s].name)
        .join(', ');
      degradedReason = `Servicios afectados: ${serviceNames}`;
      userMessage = `${metadata.name} temporalmente no disponible. ${
        metadata.alternativeAction || ''
      }`;
    }

    return {
      id: featureId,
      name: metadata.name,
      available,
      degradedReason,
      affectedServices,
      userMessage,
      alternativeAction: available ? undefined : metadata.alternativeAction,
      severity: available ? 'info' : metadata.severity,
      updatedAt: new Date(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SYSTEM HEALTH
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get overall system health
   */
  async getSystemHealth(): Promise<SystemHealth> {
    // Collect all service states
    const serviceIds: ServiceId[] = [
      'mercadopago',
      'whatsapp',
      'openai',
      'afip',
      'database',
      'redis',
      'storage',
    ];

    const services: Record<ServiceId, ServiceState> = {} as Record<
      ServiceId,
      ServiceState
    >;

    for (const id of serviceIds) {
      services[id] = await this.getServiceState(id);
    }

    // Collect all feature states
    const featureIds: FeatureId[] = [
      'online_payments',
      'whatsapp_messaging',
      'ai_responses',
      'invoice_generation',
      'voice_transcription',
      'document_extraction',
      'payment_webhooks',
      'sms_notifications',
    ];

    const features: Record<FeatureId, FeatureState> = {} as Record<
      FeatureId,
      FeatureState
    >;

    for (const id of featureIds) {
      features[id] = this.getFeatureState(id, services);
    }

    // Calculate overall status
    const healthyCount = Object.values(services).filter(
      (s) => s.status === 'healthy'
    ).length;
    const degradedCount = Object.values(features).filter(
      (f) => !f.available
    ).length;
    const totalServices = serviceIds.length;

    const status = this.calculateOverallStatus(services);
    const message = this.getStatusMessage(status, degradedCount);

    // Check for auto-incident creation
    if (this.config.autoCreateIncidents) {
      this.checkAndCreateIncidents(services, features);
    }

    const health: SystemHealth = {
      status,
      message,
      services,
      features,
      activeIncidents: Array.from(this.incidents.values()).filter(
        (i) => i.status !== 'resolved'
      ),
      degradedCount,
      totalServices,
      healthyCount,
      updatedAt: new Date(),
    };

    this.lastHealth = health;
    return health;
  }

  /**
   * Get cached health (without re-fetching)
   */
  getCachedHealth(): SystemHealth | null {
    return this.lastHealth;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INCIDENT MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new incident
   */
  createIncident(params: {
    services: ServiceId[];
    features: FeatureId[];
    title: string;
    description: string;
    severity: Incident['severity'];
  }): Incident {
    const incident: Incident = {
      id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      services: params.services,
      features: params.features,
      title: params.title,
      description: params.description,
      severity: params.severity,
      status: 'investigating',
      startedAt: new Date(),
      updates: [
        {
          timestamp: new Date(),
          message: 'Incidente detectado, investigando...',
          status: 'investigating',
        },
      ],
    };

    this.incidents.set(incident.id, incident);
    console.log('[Degradation] Incident created:', incident.id, incident.title);

    return incident;
  }

  /**
   * Update an incident
   */
  updateIncident(
    incidentId: string,
    update: {
      status?: Incident['status'];
      message: string;
    }
  ): Incident | null {
    const incident = this.incidents.get(incidentId);
    if (!incident) return null;

    const newStatus = update.status || incident.status;

    incident.updates.push({
      timestamp: new Date(),
      message: update.message,
      status: newStatus,
    });

    incident.status = newStatus;

    if (newStatus === 'resolved') {
      incident.resolvedAt = new Date();
    }

    return incident;
  }

  /**
   * Get active incidents
   */
  getActiveIncidents(): Incident[] {
    return Array.from(this.incidents.values()).filter(
      (i) => i.status !== 'resolved'
    );
  }

  /**
   * Auto-check and create incidents
   */
  private checkAndCreateIncidents(
    services: Record<ServiceId, ServiceState>,
    features: Record<FeatureId, FeatureState>
  ): void {
    // Check for critical service outages
    for (const [id, state] of Object.entries(services)) {
      if (
        state.status === 'unavailable' &&
        state.impactLevel === 'critical'
      ) {
        // Check if there's already an active incident for this service
        const existingIncident = Array.from(this.incidents.values()).find(
          (i) => i.services.includes(id as ServiceId) && i.status !== 'resolved'
        );

        if (!existingIncident) {
          const affectedFeatures = Object.entries(features)
            .filter(([, f]) => f.affectedServices.includes(id as ServiceId))
            .map(([fId]) => fId as FeatureId);

          this.createIncident({
            services: [id as ServiceId],
            features: affectedFeatures,
            title: `${state.name} no disponible`,
            description: `El servicio ${state.name} no está respondiendo. ${
              state.lastErrorMessage || ''
            }`,
            severity: 'critical',
          });
        }
      }
    }

    // Auto-resolve incidents when services recover
    for (const incident of this.incidents.values()) {
      if (incident.status === 'resolved') continue;

      const allServicesHealthy = incident.services.every(
        (s) => services[s]?.status === 'healthy'
      );

      if (allServicesHealthy && incident.status !== 'monitoring') {
        this.updateIncident(incident.id, {
          status: 'monitoring',
          message: 'Servicios recuperados, monitoreando estabilidad...',
        });

        // Schedule auto-resolve
        setTimeout(() => {
          const currentIncident = this.incidents.get(incident.id);
          if (currentIncident?.status === 'monitoring') {
            this.updateIncident(incident.id, {
              status: 'resolved',
              message: 'Incidente resuelto automáticamente',
            });
          }
        }, this.config.incidentAutoResolveDelay);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LISTENERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to health updates
   */
  subscribe(listener: (health: SystemHealth) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      const health = await this.getSystemHealth();
      this.listeners.forEach((listener) => listener(health));
    }, this.config.healthCheckInterval);

    // Initial check
    this.getSystemHealth().then((health) => {
      this.listeners.forEach((listener) => listener(health));
    });
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private circuitStateToStatus(
    state: 'closed' | 'open' | 'half-open'
  ): ServiceStatus {
    switch (state) {
      case 'closed':
        return 'healthy';
      case 'half-open':
        return 'degraded';
      case 'open':
        return 'unavailable';
      default:
        return 'unknown';
    }
  }

  private calculateSuccessRate(successes: number, failures: number): number {
    const total = successes + failures;
    if (total === 0) return 100;
    return Math.round((successes / total) * 100);
  }

  private calculateOverallStatus(
    services: Record<ServiceId, ServiceState>
  ): SystemHealthStatus {
    const states = Object.values(services);
    const unavailableCount = states.filter(
      (s) => s.status === 'unavailable'
    ).length;
    const degradedCount = states.filter((s) => s.status === 'degraded').length;
    const criticalUnavailable = states.filter(
      (s) => s.status === 'unavailable' && s.impactLevel === 'critical'
    ).length;

    if (criticalUnavailable > 0) return 'major_outage';
    if (unavailableCount >= 2) return 'partial_outage';
    if (unavailableCount > 0 || degradedCount > 0) return 'degraded';
    return 'operational';
  }

  private getStatusMessage(
    status: SystemHealthStatus,
    degradedCount: number
  ): string {
    switch (status) {
      case 'operational':
        return 'Todos los sistemas operando normalmente';
      case 'degraded':
        return `${degradedCount} funcionalidad${
          degradedCount > 1 ? 'es' : ''
        } con rendimiento reducido`;
      case 'partial_outage':
        return 'Algunos servicios no disponibles temporalmente';
      case 'major_outage':
        return 'Interrupción mayor en curso - equipo trabajando en resolución';
      default:
        return 'Estado del sistema desconocido';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let degradationManager: DegradationManager | null = null;

export function getDegradationManager(): DegradationManager {
  if (!degradationManager) {
    degradationManager = new DegradationManager();
  }
  return degradationManager;
}

export function resetDegradationManager(): void {
  if (degradationManager) {
    degradationManager.stopHealthChecks();
  }
  degradationManager = null;
}
