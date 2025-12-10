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
  PublicApiConfig,
  createCustomersController,
  createJobsController,
  createInvoicesController,
  createPaymentsController,
  createWebhooksController,
} from './v1/router';

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION & AUTHORIZATION
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // API Keys
  ApiKeyService,
  createApiKeyService,
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
  DEFAULT_OAUTH2_CONFIG,

  // OAuth 2.0 Service
  OAuth2Service,
  createOAuth2Service,

  // OAuth 2.0 Router
  createOAuth2Router,
} from './auth';

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Types
  WEBHOOK_EVENT_TYPES,
  WebhookEventType,
  WebhookEvent,
  WebhookSubscription,
  RetryPolicy,
  DEFAULT_RETRY_POLICY,
  DeliveryStatus,
  WebhookDelivery,
  DeliveryResult,
  WebhookConfig,
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
  EmitEventOptions,
  EventEmitterConfig,

  // Delivery worker
  WebhookDeliveryWorker,
  createWebhookWorker,
  WorkerStats,
} from './webhooks';

// ═══════════════════════════════════════════════════════════════════════════════
// DEVELOPER PORTAL
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Types
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
  // Types
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
  createIntegrationError,

  // Google Calendar
  GoogleCalendarService,
  createGoogleCalendarService,
  GoogleCalendarConfig,
  CalendarEvent,
  CalendarSyncOptions,
  GoogleCalendarCredentials,

  // QuickBooks
  QuickBooksService,
  createQuickBooksService,
  QuickBooksConfig,
  QuickBooksCredentials,
  QuickBooksCustomer,
  QuickBooksInvoice,
  QuickBooksPayment,
  QuickBooksSyncOptions,

  // Zapier
  ZapierService,
  createZapierService,
  ZapierConfig,
  ZapierTrigger,
  ZapierAction,
  ZapierWebhook,
  TriggerType,
  ActionType,
  AVAILABLE_TRIGGERS,
  AVAILABLE_ACTIONS,

  // Utilities
  getAvailableIntegrations,
  validateIntegrationConfig,
} from './integrations';

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS & MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Unified Analytics Service
  AnalyticsService,
  createAnalyticsService,

  // Time types
  TimePeriod,
  TimeGranularity,
  TimeRange,

  // Usage types and service
  ApiRequest,
  UsageMetrics,
  UsageSummary,
  UsageTrend,
  UsageTrackingService,
  createUsageTrackingService,
  TrackRequestOptions,
  UsageQueryOptions,
  TopEndpoint,
  TopApiKey,

  // Rate limit types and service
  RateLimitStatus,
  RateLimitEvent,
  RateLimitMetrics,
  RateLimitConfig,
  RateLimitMonitorService,
  createRateLimitMonitorService,
  RecordLimitEventOptions,
  RateLimitOverride,
  RateLimitAnalysis,

  // Error types and service
  ErrorSeverity,
  ErrorCategory,
  ApiError,
  ErrorGroup,
  ErrorMetrics,
  ErrorTrend,
  ErrorTrackingService,
  createErrorTrackingService,
  TrackErrorOptions,
  ErrorQueryOptions,
  ErrorSearchResult,
  ErrorGroupUpdateOptions,

  // Alert types and service
  AlertChannel,
  AlertCondition,
  AlertRule,
  Alert,
  AlertNotification,
  AlertingService,
  createAlertingService,
  CreateAlertRuleOptions,
  AlertCheckResult,
  NotificationResult,

  // Dashboard types and service
  WidgetType,
  MetricType,
  DashboardWidget,
  Dashboard,
  DashboardService,
  createDashboardService,
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
  DEFAULT_ANALYTICS_CONFIG,
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
