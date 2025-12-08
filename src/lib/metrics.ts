/**
 * Prometheus Metrics
 * ==================
 *
 * Application metrics collection using prom-client
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

export const metricsRegistry = new Registry();

// Collect default Node.js metrics
collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'campotech_',
});

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP METRICS
// ═══════════════════════════════════════════════════════════════════════════════

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const httpRequestsInProgress = new Gauge({
  name: 'http_requests_in_progress',
  help: 'Number of HTTP requests currently in progress',
  labelNames: ['method'],
  registers: [metricsRegistry],
});

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE METRICS
// ═══════════════════════════════════════════════════════════════════════════════

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [metricsRegistry],
});

export const dbConnectionsActive = new Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
  registers: [metricsRegistry],
});

export const dbQueryErrors = new Counter({
  name: 'db_query_errors_total',
  help: 'Total number of database query errors',
  labelNames: ['operation', 'table', 'error_type'],
  registers: [metricsRegistry],
});

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE METRICS
// ═══════════════════════════════════════════════════════════════════════════════

export const queueJobsTotal = new Counter({
  name: 'bullmq_jobs_total',
  help: 'Total number of jobs processed',
  labelNames: ['queue', 'status'],
  registers: [metricsRegistry],
});

export const queueJobDuration = new Histogram({
  name: 'bullmq_job_duration_seconds',
  help: 'Queue job processing duration in seconds',
  labelNames: ['queue'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120],
  registers: [metricsRegistry],
});

export const queueWaiting = new Gauge({
  name: 'bullmq_queue_waiting',
  help: 'Number of jobs waiting in queue',
  labelNames: ['queue'],
  registers: [metricsRegistry],
});

export const queueActive = new Gauge({
  name: 'bullmq_queue_active',
  help: 'Number of jobs currently being processed',
  labelNames: ['queue'],
  registers: [metricsRegistry],
});

export const queueFailed = new Gauge({
  name: 'bullmq_queue_failed',
  help: 'Number of failed jobs in queue',
  labelNames: ['queue'],
  registers: [metricsRegistry],
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION METRICS
// ═══════════════════════════════════════════════════════════════════════════════

// AFIP
export const afipRequestsTotal = new Counter({
  name: 'afip_requests_total',
  help: 'Total number of AFIP API requests',
  labelNames: ['operation', 'status'],
  registers: [metricsRegistry],
});

export const afipRequestsFailed = new Counter({
  name: 'afip_requests_failed_total',
  help: 'Total number of failed AFIP API requests',
  labelNames: ['operation', 'error_type'],
  registers: [metricsRegistry],
});

export const afipRequestDuration = new Histogram({
  name: 'afip_request_duration_seconds',
  help: 'AFIP API request duration in seconds',
  labelNames: ['operation'],
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [metricsRegistry],
});

// MercadoPago
export const mercadopagoRequestsTotal = new Counter({
  name: 'mercadopago_requests_total',
  help: 'Total number of MercadoPago API requests',
  labelNames: ['operation', 'status'],
  registers: [metricsRegistry],
});

export const mercadopagoRequestsFailed = new Counter({
  name: 'mercadopago_requests_failed_total',
  help: 'Total number of failed MercadoPago API requests',
  labelNames: ['operation', 'error_type'],
  registers: [metricsRegistry],
});

// WhatsApp
export const whatsappMessagesTotal = new Counter({
  name: 'whatsapp_messages_total',
  help: 'Total number of WhatsApp messages',
  labelNames: ['direction', 'type', 'status'],
  registers: [metricsRegistry],
});

export const whatsappMessagesFailed = new Counter({
  name: 'whatsapp_messages_failed_total',
  help: 'Total number of failed WhatsApp messages',
  labelNames: ['type', 'error_type'],
  registers: [metricsRegistry],
});

export const whatsappPanicMode = new Gauge({
  name: 'whatsapp_panic_mode',
  help: 'WhatsApp panic mode status (1 = active, 0 = inactive)',
  registers: [metricsRegistry],
});

// OpenAI
export const openaiRequestsTotal = new Counter({
  name: 'openai_requests_total',
  help: 'Total number of OpenAI API requests',
  labelNames: ['model', 'operation', 'status'],
  registers: [metricsRegistry],
});

export const openaiRequestsFailed = new Counter({
  name: 'openai_requests_failed_total',
  help: 'Total number of failed OpenAI API requests',
  labelNames: ['model', 'operation', 'error_type'],
  registers: [metricsRegistry],
});

export const openaiTokensUsed = new Counter({
  name: 'openai_tokens_used_total',
  help: 'Total number of OpenAI tokens used',
  labelNames: ['model', 'type'],
  registers: [metricsRegistry],
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS METRICS
// ═══════════════════════════════════════════════════════════════════════════════

export const jobsCreated = new Counter({
  name: 'jobs_created_total',
  help: 'Total number of jobs created',
  labelNames: ['service_type', 'source'],
  registers: [metricsRegistry],
});

export const jobsCompleted = new Counter({
  name: 'jobs_completed_total',
  help: 'Total number of jobs completed',
  labelNames: ['service_type'],
  registers: [metricsRegistry],
});

export const invoicesGenerated = new Counter({
  name: 'invoices_generated_total',
  help: 'Total number of invoices generated',
  labelNames: ['type', 'status'],
  registers: [metricsRegistry],
});

export const invoicesFailed = new Counter({
  name: 'invoices_failed_total',
  help: 'Total number of failed invoice generations',
  labelNames: ['type', 'error_type'],
  registers: [metricsRegistry],
});

export const paymentsProcessed = new Counter({
  name: 'payments_processed_total',
  help: 'Total number of payments processed',
  labelNames: ['method', 'status'],
  registers: [metricsRegistry],
});

export const paymentsFailed = new Counter({
  name: 'payments_failed_total',
  help: 'Total number of failed payments',
  labelNames: ['method', 'error_type'],
  registers: [metricsRegistry],
});

export const paymentAmount = new Histogram({
  name: 'payment_amount_ars',
  help: 'Payment amounts in ARS',
  labelNames: ['method'],
  buckets: [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000],
  registers: [metricsRegistry],
});

// Voice AI
export const voiceMessagesProcessed = new Counter({
  name: 'voice_messages_processed_total',
  help: 'Total number of voice messages processed',
  labelNames: ['route', 'status'],
  registers: [metricsRegistry],
});

export const voiceExtractionConfidence = new Histogram({
  name: 'voice_extraction_confidence',
  help: 'Voice message extraction confidence scores',
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  registers: [metricsRegistry],
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION METRICS
// ═══════════════════════════════════════════════════════════════════════════════

export const authAttempts = new Counter({
  name: 'auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['method', 'status'],
  registers: [metricsRegistry],
});

export const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Number of currently active users',
  labelNames: ['role'],
  registers: [metricsRegistry],
});

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE METRICS
// ═══════════════════════════════════════════════════════════════════════════════

export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache'],
  registers: [metricsRegistry],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache'],
  registers: [metricsRegistry],
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all metrics as string for /metrics endpoint
 */
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Get metrics content type
 */
export function getMetricsContentType(): string {
  return metricsRegistry.contentType;
}

/**
 * Update queue metrics from BullMQ
 */
export async function updateQueueMetrics(
  queueName: string,
  counts: { waiting: number; active: number; failed: number }
): Promise<void> {
  queueWaiting.set({ queue: queueName }, counts.waiting);
  queueActive.set({ queue: queueName }, counts.active);
  queueFailed.set({ queue: queueName }, counts.failed);
}

/**
 * Record HTTP request
 */
export function recordHttpRequest(
  method: string,
  path: string,
  status: number,
  durationSeconds: number
): void {
  const labels = { method, path: normalizePath(path), status: String(status) };
  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, durationSeconds);
}

/**
 * Normalize path for metrics (remove IDs)
 */
function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}
