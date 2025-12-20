/**
 * Feature Degradation Types
 * =========================
 *
 * Type definitions for the feature degradation framework.
 * Manages graceful degradation when external services are unavailable.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Services that can be monitored for degradation
 */
export type ServiceId =
  | 'mercadopago'
  | 'whatsapp'
  | 'openai'
  | 'afip'
  | 'database'
  | 'redis'
  | 'storage';

/**
 * Service health status
 */
export type ServiceStatus = 'healthy' | 'degraded' | 'unavailable' | 'unknown';

/**
 * Circuit breaker states
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE STATE
// ═══════════════════════════════════════════════════════════════════════════════

export interface ServiceState {
  /** Service identifier */
  id: ServiceId;
  /** Human-readable name */
  name: string;
  /** Current status */
  status: ServiceStatus;
  /** Circuit breaker state if applicable */
  circuitState?: CircuitState;
  /** Success rate (0-100) */
  successRate: number;
  /** Average latency in ms */
  avgLatency: number;
  /** Last successful operation */
  lastSuccess: Date | null;
  /** Last error */
  lastError: Date | null;
  /** Last error message */
  lastErrorMessage?: string;
  /** Time until potential recovery (for open circuits) */
  recoveryEta?: Date;
  /** Fallback available */
  hasFallback: boolean;
  /** Fallback description */
  fallbackDescription?: string;
  /** Impact level */
  impactLevel: 'critical' | 'high' | 'medium' | 'low';
  /** Updated timestamp */
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE DEGRADATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Features that can be degraded
 */
export type FeatureId =
  | 'online_payments'
  | 'whatsapp_messaging'
  | 'ai_responses'
  | 'invoice_generation'
  | 'voice_transcription'
  | 'document_extraction'
  | 'payment_webhooks'
  | 'sms_notifications';

/**
 * Feature degradation state
 */
export interface FeatureState {
  /** Feature identifier */
  id: FeatureId;
  /** Human-readable name */
  name: string;
  /** Is feature available */
  available: boolean;
  /** Degradation reason if unavailable */
  degradedReason?: string;
  /** Affected services */
  affectedServices: ServiceId[];
  /** User-facing message */
  userMessage: string;
  /** Alternative action available */
  alternativeAction?: string;
  /** Severity for UI display */
  severity: 'info' | 'warning' | 'error';
  /** Updated timestamp */
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM HEALTH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Overall system health status
 */
export type SystemHealthStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage';

/**
 * System health overview
 */
export interface SystemHealth {
  /** Overall status */
  status: SystemHealthStatus;
  /** Status message */
  message: string;
  /** Individual service states */
  services: Record<ServiceId, ServiceState>;
  /** Feature availability */
  features: Record<FeatureId, FeatureState>;
  /** Active incidents */
  activeIncidents: Incident[];
  /** Degraded features count */
  degradedCount: number;
  /** Total monitored services */
  totalServices: number;
  /** Healthy services count */
  healthyCount: number;
  /** Last updated */
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INCIDENTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface Incident {
  id: string;
  /** Affected services */
  services: ServiceId[];
  /** Affected features */
  features: FeatureId[];
  /** Incident title */
  title: string;
  /** Description */
  description: string;
  /** Severity */
  severity: 'minor' | 'major' | 'critical';
  /** Current status */
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  /** Started at */
  startedAt: Date;
  /** Resolved at */
  resolvedAt?: Date;
  /** Updates */
  updates: IncidentUpdate[];
}

export interface IncidentUpdate {
  timestamp: Date;
  message: string;
  status: Incident['status'];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface DegradationConfig {
  /** Polling interval for health checks (ms) */
  healthCheckInterval: number;
  /** Success rate threshold for degraded status (0-100) */
  degradedThreshold: number;
  /** Success rate threshold for unavailable status (0-100) */
  unavailableThreshold: number;
  /** Enable automatic incident creation */
  autoCreateIncidents: boolean;
  /** Incident auto-resolve after recovery (ms) */
  incidentAutoResolveDelay: number;
}

export const DEFAULT_DEGRADATION_CONFIG: DegradationConfig = {
  healthCheckInterval: 30000, // 30 seconds
  degradedThreshold: 90, // Below 90% = degraded
  unavailableThreshold: 50, // Below 50% = unavailable
  autoCreateIncidents: true,
  incidentAutoResolveDelay: 300000, // 5 minutes
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE METADATA
// ═══════════════════════════════════════════════════════════════════════════════

export const SERVICE_METADATA: Record<
  ServiceId,
  {
    name: string;
    description: string;
    impactLevel: ServiceState['impactLevel'];
    hasFallback: boolean;
    fallbackDescription?: string;
  }
> = {
  mercadopago: {
    name: 'MercadoPago',
    description: 'Procesamiento de pagos online',
    impactLevel: 'high',
    hasFallback: true,
    fallbackDescription: 'Pago por transferencia bancaria disponible',
  },
  whatsapp: {
    name: 'WhatsApp Business',
    description: 'Mensajería y notificaciones WhatsApp',
    impactLevel: 'high',
    hasFallback: true,
    fallbackDescription: 'SMS de respaldo disponible',
  },
  openai: {
    name: 'OpenAI',
    description: 'Respuestas automáticas e IA',
    impactLevel: 'medium',
    hasFallback: true,
    fallbackDescription: 'Escalamiento a operador humano',
  },
  afip: {
    name: 'AFIP',
    description: 'Facturación electrónica',
    impactLevel: 'critical',
    hasFallback: true,
    fallbackDescription: 'Cola de facturación diferida',
  },
  database: {
    name: 'Base de datos',
    description: 'Almacenamiento principal',
    impactLevel: 'critical',
    hasFallback: false,
  },
  redis: {
    name: 'Redis',
    description: 'Caché y sesiones',
    impactLevel: 'medium',
    hasFallback: true,
    fallbackDescription: 'Modo degradado sin caché',
  },
  storage: {
    name: 'Almacenamiento',
    description: 'Archivos y documentos',
    impactLevel: 'medium',
    hasFallback: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE METADATA
// ═══════════════════════════════════════════════════════════════════════════════

export const FEATURE_METADATA: Record<
  FeatureId,
  {
    name: string;
    description: string;
    dependencies: ServiceId[];
    severity: FeatureState['severity'];
    alternativeAction?: string;
  }
> = {
  online_payments: {
    name: 'Pagos Online',
    description: 'Cobros con MercadoPago',
    dependencies: ['mercadopago'],
    severity: 'warning',
    alternativeAction: 'Usar pago por transferencia',
  },
  whatsapp_messaging: {
    name: 'Mensajes WhatsApp',
    description: 'Envío de mensajes y notificaciones',
    dependencies: ['whatsapp'],
    severity: 'warning',
    alternativeAction: 'Usar SMS como alternativa',
  },
  ai_responses: {
    name: 'Respuestas IA',
    description: 'Respuestas automáticas inteligentes',
    dependencies: ['openai'],
    severity: 'info',
    alternativeAction: 'Atención manual por operador',
  },
  invoice_generation: {
    name: 'Facturación',
    description: 'Generación de facturas electrónicas',
    dependencies: ['afip', 'database'],
    severity: 'error',
    alternativeAction: 'Facturación diferida automática',
  },
  voice_transcription: {
    name: 'Transcripción de Voz',
    description: 'Conversión de audio a texto',
    dependencies: ['openai'],
    severity: 'info',
    alternativeAction: 'Revisión manual del audio',
  },
  document_extraction: {
    name: 'Extracción de Documentos',
    description: 'Lectura automática de remitos',
    dependencies: ['openai', 'storage'],
    severity: 'info',
    alternativeAction: 'Carga manual de datos',
  },
  payment_webhooks: {
    name: 'Webhooks de Pago',
    description: 'Notificaciones de pago en tiempo real',
    dependencies: ['mercadopago', 'database'],
    severity: 'warning',
    alternativeAction: 'Reconciliación manual periódica',
  },
  sms_notifications: {
    name: 'Notificaciones SMS',
    description: 'Envío de SMS',
    dependencies: ['database'],
    severity: 'info',
    alternativeAction: 'Notificación por email',
  },
};
