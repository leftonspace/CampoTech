/**
 * CampoTech Monitoring & Observability (Phase 8)
 * ===============================================
 *
 * Centralized exports for all monitoring functionality.
 *
 * Includes:
 * - Error tracking (Sentry)
 * - Business metrics
 * - Request instrumentation
 * - Alerting
 *
 * Usage:
 * ```typescript
 * import {
 *   businessMetrics,
 *   alertManager,
 *   AlertSeverity,
 *   recordActiveUser,
 *   trackDatabaseQuery,
 * } from '@/lib/monitoring';
 *
 * // Track user activity
 * await recordActiveUser(userId);
 *
 * // Track database queries
 * const endTimer = trackDatabaseQuery('findMany', 'jobs');
 * const result = await prisma.job.findMany();
 * endTimer({ success: true });
 *
 * // Send alert
 * await alertManager.send({
 *   severity: AlertSeverity.ERROR,
 *   title: 'Payment Failed',
 *   message: 'Customer payment processing failed',
 * });
 * ```
 */

// Business metrics
export {
  businessMetrics,
  recordRequestLatency,
  recordActiveUser,
  recordDatabaseLatency,
  trackDatabaseQuery,
  recordJobCreated,
  recordInvoiceGenerated,
  recordAIConversation,
  getMetricsSnapshot,
  toPrometheusFormat,
} from './business-metrics';

// Request instrumentation
export {
  instrumentRequest,
  createRequestTimer,
  withInstrumentation,
} from './request-instrumentation';

// Alerting
export {
  alertManager,
  AlertSeverity,
  AlertChannel,
  alertInfo,
  alertWarning,
  alertError,
  alertCritical,
  type Alert,
  type AlertThresholds,
} from './alerts';
