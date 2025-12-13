/**
 * CampoTech Public API
 * ====================
 *
 * Complete public API module providing RESTful endpoints, authentication,
 * webhooks, integrations, SDKs, and analytics for third-party developers.
 *
 * @module @campotech/api
 * @version 1.0.0
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CORE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export * from './public-api.types';

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  createApiKeyMiddleware,
  createRateLimitMiddleware,
  createScopeCheckMiddleware,
  versionExtractionMiddleware,
} from './middleware';

// ═══════════════════════════════════════════════════════════════════════════════
// API V1 ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

export {
  createPublicApiV1Router,
  createCustomersController,
  createJobsController,
  createInvoicesController,
  createPaymentsController,
  createWebhooksController,
} from './v1/router';
export type { PublicApiConfig } from './v1/router';

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION & AUTHORIZATION
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // API Keys
  ApiKeyService,
  createApiKeyService,

  // OAuth 2.0 Constants
  DEFAULT_OAUTH2_CONFIG,

  // OAuth 2.0 Service
  OAuth2Service,
  createOAuth2Service,

  // OAuth 2.0 Router
  createOAuth2Router,
} from './auth';

export type {
  // API Key Types
  ApiKey,
  CreateApiKeyOptions,
  ApiKeyValidationResult,
  ApiKeyUsageStats,

  // OAuth 2.0 Types
  OAuth2GrantType,
  OAuth2Client,
  CreateOAuth2ClientOptions,
  AuthorizationCode,
  AuthorizationRequest,
  OAuth2Token,
  TokenResponse,
  TokenRequest,
  TokenIntrospectionResponse,
  OAuth2ErrorCode,
  OAuth2Error,
  OAuth2Exception,
  ConsentRecord,
  OAuth2Config,
} from './auth';

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Constants
  WEBHOOK_EVENT_TYPES,
  DEFAULT_RETRY_POLICY,
  DEFAULT_WEBHOOK_CONFIG,

  // Signature utilities
  generateSignature,
  generateWebhookHeaders,
  verifySignature,
  verifyWebhookRequest,
  generateWebhookSecret,
  isValidWebhookSecret,
  SIGNATURE_VERSION,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  WEBHOOK_ID_HEADER,
  SIGNATURE_MAX_AGE_SECONDS,

  // Event emitter
  WebhookEventEmitter,
  createWebhookEmitter,

  // Delivery worker
  WebhookDeliveryWorker,
  createWebhookWorker,
} from './webhooks';

export type {
  // Webhook Types
  WebhookEventType,
  WebhookEvent,
  WebhookSubscription,
  RetryPolicy,
  DeliveryStatus,
  WebhookDelivery,
  DeliveryResult,
  WebhookConfig,
  EmitEventOptions,
  EventEmitterConfig,
  WorkerStats,
} from './webhooks';

// ═══════════════════════════════════════════════════════════════════════════════
// DEVELOPER PORTAL
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // API Reference
  ApiReferenceService,
  createApiReferenceService,

  // Developer Console
  DeveloperConsoleService,
  createDeveloperConsoleService,

  // API Playground
  PlaygroundService,
  createPlaygroundService,
} from './developer-portal';

export type {
  // Developer Portal Types
  DocPage,
  DocSection,
  DocCategory,
  ApiEndpointDoc,
  CodeSample,
  ApiReferenceData,
  Application,
  ApplicationStatus,
  CreateApplicationOptions,
  PlaygroundRequest,
  PlaygroundResponse,
  GeneratedCode,
} from './developer-portal';

// ═══════════════════════════════════════════════════════════════════════════════
// SDK GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export {
  generateOpenApiSpec,
  getOpenApiJson,
  getOpenApiYaml,
} from './sdk';

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Integration Utilities
  createIntegrationError,

  // Google Calendar
  GoogleCalendarService,
  createGoogleCalendarService,

  // QuickBooks
  QuickBooksService,
  createQuickBooksService,

  // Zapier
  ZapierService,
  createZapierService,
  AVAILABLE_TRIGGERS,
  AVAILABLE_ACTIONS,

  // Utilities
  getAvailableIntegrations,
  validateIntegrationConfig,
} from './integrations';

export type {
  // Integration Types
  IntegrationProvider,
  IntegrationStatus,
  BaseIntegrationConfig,
  IntegrationCredentials,
  IntegrationConnection,
  SyncDirection,
  SyncFrequency,
  SyncStatus,
  SyncResult,
  SyncLog,
  FieldMapping,
  MappingConfig,
  IntegrationError,
  IntegrationErrorCode,

  // Google Calendar Types
  GoogleCalendarConfig,
  CalendarEvent,
  CalendarSyncOptions,
  GoogleCalendarCredentials,

  // QuickBooks Types
  QuickBooksConfig,
  QuickBooksCredentials,
  QuickBooksCustomer,
  QuickBooksInvoice,
  QuickBooksPayment,
  QuickBooksSyncOptions,

  // Zapier Types
  ZapierConfig,
  ZapierTrigger,
  ZapierAction,
  ZapierWebhook,
  TriggerType,
  ActionType,
} from './integrations';

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS & MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Unified Analytics Service
  AnalyticsService,
  createAnalyticsService,

  // Usage service
  UsageTrackingService,
  createUsageTrackingService,

  // Rate limit service
  RateLimitMonitorService,
  createRateLimitMonitorService,

  // Error service
  ErrorTrackingService,
  createErrorTrackingService,

  // Alert service
  AlertingService,
  createAlertingService,

  // Dashboard service
  DashboardService,
  createDashboardService,

  // Configuration
  DEFAULT_ANALYTICS_CONFIG,
} from './analytics';

export type {
  // Time types
  TimePeriod,
  TimeGranularity,
  TimeRange,

  // Usage types
  ApiRequest,
  UsageMetrics,
  UsageSummary,
  UsageTrend,
  TrackRequestOptions,
  UsageQueryOptions,
  TopEndpoint,
  TopApiKey,

  // Rate limit types
  RateLimitStatus,
  RateLimitEvent,
  RateLimitMetrics,
  RateLimitConfig,
  RecordLimitEventOptions,
  RateLimitOverride,
  RateLimitAnalysis,

  // Error types
  ErrorSeverity,
  ErrorCategory,
  ApiError,
  ErrorGroup,
  ErrorMetrics,
  ErrorTrend,
  TrackErrorOptions,
  ErrorQueryOptions,
  ErrorSearchResult,
  ErrorGroupUpdateOptions,

  // Alert types
  AlertChannel,
  AlertCondition,
  AlertRule,
  Alert,
  AlertNotification,
  CreateAlertRuleOptions,
  AlertCheckResult,
  NotificationResult,

  // Dashboard types
  WidgetType,
  MetricType,
  DashboardWidget,
  Dashboard,
  CreateDashboardOptions,
  WidgetData,
  DashboardData,

  // Report types
  ReportFormat,
  ReportFrequency,
  ReportConfig,
  GeneratedReport,
  CreateReportOptions,

  // Real-time types
  RealTimeMetrics,
  HealthStatus,

  // Configuration
  AnalyticsConfig,
} from './analytics';

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { Router } from 'express';
import { createPublicApiV1Router, PublicApiConfig } from './v1/router';
import { createOAuth2Router } from './auth';
import { createAnalyticsService, AnalyticsService } from './analytics';
import { createWebhookEmitter, WebhookEventEmitter, createWebhookWorker, WebhookDeliveryWorker } from './webhooks';

export interface CampoTechApiOptions {
  pool: Pool;
  basePath?: string;
  enableRateLimiting?: boolean;
  rateLimitDefaults?: {
    windowMs?: number;
    maxRequests?: number;
  };
  webhookConfig?: {
    concurrency?: number;
    retryAttempts?: number;
  };
  analyticsConfig?: {
    retentionDays?: number;
    enableRealTimeMetrics?: boolean;
  };
}

export interface CampoTechApi {
  router: Router;
  analytics: AnalyticsService;
  webhooks: {
    emitter: WebhookEventEmitter;
    worker: WebhookDeliveryWorker;
  };
}

/**
 * Create the complete CampoTech Public API
 *
 * @example
 * ```typescript
 * import { createCampoTechApi } from '@campotech/api';
 * import express from 'express';
 *
 * const app = express();
 * const { router, analytics, webhooks } = createCampoTechApi({ pool });
 *
 * app.use('/api', router);
 *
 * // Start webhook worker
 * webhooks.worker.start();
 *
 * app.listen(3000);
 * ```
 */
export function createCampoTechApi(options: CampoTechApiOptions): CampoTechApi {
  const {
    pool,
    basePath = '/api',
    enableRateLimiting = true,
    rateLimitDefaults,
    webhookConfig,
    analyticsConfig,
  } = options;

  // Create main router
  const router = Router();

  // Mount v1 API
  const v1Router = createPublicApiV1Router({
    pool,
    basePath,
    enableRateLimiting,
    rateLimitDefaults,
  });
  router.use('/v1', v1Router);

  // Mount OAuth 2.0 endpoints
  const oauth2Router = createOAuth2Router(pool);
  router.use('/oauth', oauth2Router);

  // Create analytics service
  const analytics = createAnalyticsService(pool, analyticsConfig);

  // Create webhook services
  const webhookEmitter = createWebhookEmitter(pool, {
    batchSize: webhookConfig?.concurrency || 10,
  });
  const webhookWorker = createWebhookWorker(pool, {
    concurrency: webhookConfig?.concurrency || 5,
    maxRetries: webhookConfig?.retryAttempts || 3,
  });

  return {
    router,
    analytics,
    webhooks: {
      emitter: webhookEmitter,
      worker: webhookWorker,
    },
  };
}
