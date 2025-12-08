/**
 * CampoTech Metrics Library
 * ==========================
 *
 * Standardized metrics emission for all workers and services.
 * Provides Prometheus-compatible metrics with consistent labels and naming.
 *
 * METRIC NAMING CONVENTION:
 * - Prefix: campotech_
 * - Snake_case names
 * - Units in suffix: _seconds, _bytes, _total
 *
 * USAGE:
 * ```typescript
 * import { metrics, trackJobProcessing } from '@/core/observability/metrics';
 *
 * // Track job processing
 * const stopTimer = trackJobProcessing('cae_queue', 'org-123');
 * try {
 *   await processJob();
 *   stopTimer({ status: 'success' });
 * } catch (error) {
 *   stopTimer({ status: 'failure', error: error.message });
 * }
 *
 * // Record capability check
 * metrics.capabilityCheck.inc({ capability: 'external.afip', result: 'enabled' });
 * ```
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MetricLabels {
  [key: string]: string | number;
}

export interface HistogramBuckets {
  buckets: number[];
}

export interface MetricValue {
  value: number;
  labels: MetricLabels;
  timestamp: Date;
}

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MetricDefinition {
  name: string;
  help: string;
  type: MetricType;
  labelNames: string[];
  buckets?: number[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRIC DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  // Queue Metrics
  queueWaitTime: {
    name: 'campotech_queue_wait_time_seconds',
    help: 'Time jobs spend waiting in queue before processing',
    type: 'histogram',
    labelNames: ['queue', 'org_id'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  },
  processingTime: {
    name: 'campotech_processing_time_seconds',
    help: 'Time spent processing jobs',
    type: 'histogram',
    labelNames: ['queue', 'org_id', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  },
  jobsTotal: {
    name: 'campotech_jobs_total',
    help: 'Total number of jobs processed',
    type: 'counter',
    labelNames: ['queue', 'org_id', 'status'],
  },
  jobsActive: {
    name: 'campotech_jobs_active',
    help: 'Number of jobs currently being processed',
    type: 'gauge',
    labelNames: ['queue', 'org_id'],
  },
  jobsWaiting: {
    name: 'campotech_jobs_waiting',
    help: 'Number of jobs waiting in queue',
    type: 'gauge',
    labelNames: ['queue'],
  },

  // Capability Metrics
  capabilityCheck: {
    name: 'campotech_capability_check_total',
    help: 'Total capability checks performed',
    type: 'counter',
    labelNames: ['capability', 'result', 'org_id'],
  },
  capabilityOverrideActive: {
    name: 'campotech_capability_override_active',
    help: 'Number of active capability overrides',
    type: 'gauge',
    labelNames: ['capability', 'source'],
  },

  // Panic Mode Metrics
  panicModeActive: {
    name: 'campotech_panic_mode_active',
    help: 'Whether panic mode is active for a service (1=active, 0=inactive)',
    type: 'gauge',
    labelNames: ['integration'],
  },
  panicModeTriggered: {
    name: 'campotech_panic_mode_triggered_total',
    help: 'Total times panic mode has been triggered',
    type: 'counter',
    labelNames: ['integration', 'trigger_type'],
  },
  integrationFailures: {
    name: 'campotech_integration_failures_total',
    help: 'Total integration failures',
    type: 'counter',
    labelNames: ['integration', 'error_type'],
  },

  // External Service Metrics
  externalRequestDuration: {
    name: 'campotech_external_request_duration_seconds',
    help: 'Duration of external service requests',
    type: 'histogram',
    labelNames: ['service', 'endpoint', 'status'],
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  },
  externalRequestTotal: {
    name: 'campotech_external_request_total',
    help: 'Total external service requests',
    type: 'counter',
    labelNames: ['service', 'endpoint', 'status'],
  },

  // Fair Scheduler Metrics
  schedulerOrgActive: {
    name: 'campotech_scheduler_org_active',
    help: 'Number of active jobs per organization',
    type: 'gauge',
    labelNames: ['org_id'],
  },
  schedulerOrgWaitTime: {
    name: 'campotech_scheduler_org_wait_time_seconds',
    help: 'Average wait time per organization',
    type: 'gauge',
    labelNames: ['org_id'],
  },

  // API Metrics
  httpRequestDuration: {
    name: 'campotech_http_request_duration_seconds',
    help: 'HTTP request duration',
    type: 'histogram',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  },
  httpRequestTotal: {
    name: 'campotech_http_request_total',
    help: 'Total HTTP requests',
    type: 'counter',
    labelNames: ['method', 'route', 'status_code'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// METRIC COLLECTOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * In-memory metric collector
 * In production, replace with prom-client or similar
 */
export class MetricCollector {
  private counters: Map<string, Map<string, number>> = new Map();
  private gauges: Map<string, Map<string, number>> = new Map();
  private histograms: Map<string, Map<string, number[]>> = new Map();
  private listeners: Array<(metric: string, labels: MetricLabels, value: number) => void> = [];

  constructor() {
    // Initialize metric maps
    for (const [key, def] of Object.entries(METRIC_DEFINITIONS)) {
      switch (def.type) {
        case 'counter':
          this.counters.set(def.name, new Map());
          break;
        case 'gauge':
          this.gauges.set(def.name, new Map());
          break;
        case 'histogram':
          this.histograms.set(def.name, new Map());
          break;
      }
    }
  }

  /**
   * Generate label key for metric storage
   */
  private labelKey(labels: MetricLabels): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  /**
   * Increment a counter
   */
  incCounter(name: string, labels: MetricLabels = {}, value = 1): void {
    const counter = this.counters.get(name);
    if (!counter) {
      console.warn(`[Metrics] Unknown counter: ${name}`);
      return;
    }

    const key = this.labelKey(labels);
    counter.set(key, (counter.get(key) ?? 0) + value);
    this.emit(name, labels, counter.get(key)!);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, labels: MetricLabels, value: number): void {
    const gauge = this.gauges.get(name);
    if (!gauge) {
      console.warn(`[Metrics] Unknown gauge: ${name}`);
      return;
    }

    const key = this.labelKey(labels);
    gauge.set(key, value);
    this.emit(name, labels, value);
  }

  /**
   * Increment a gauge
   */
  incGauge(name: string, labels: MetricLabels = {}, value = 1): void {
    const gauge = this.gauges.get(name);
    if (!gauge) {
      console.warn(`[Metrics] Unknown gauge: ${name}`);
      return;
    }

    const key = this.labelKey(labels);
    gauge.set(key, (gauge.get(key) ?? 0) + value);
    this.emit(name, labels, gauge.get(key)!);
  }

  /**
   * Decrement a gauge
   */
  decGauge(name: string, labels: MetricLabels = {}, value = 1): void {
    this.incGauge(name, labels, -value);
  }

  /**
   * Observe a histogram value
   */
  observeHistogram(name: string, labels: MetricLabels, value: number): void {
    const histogram = this.histograms.get(name);
    if (!histogram) {
      console.warn(`[Metrics] Unknown histogram: ${name}`);
      return;
    }

    const key = this.labelKey(labels);
    const values = histogram.get(key) ?? [];
    values.push(value);

    // Keep only last 1000 values per label set (for memory efficiency)
    if (values.length > 1000) {
      values.shift();
    }

    histogram.set(key, values);
    this.emit(name, labels, value);
  }

  /**
   * Create a timer for histogram observation
   */
  startTimer(name: string, labels: MetricLabels = {}): () => void {
    const start = Date.now();
    return () => {
      const duration = (Date.now() - start) / 1000;
      this.observeHistogram(name, labels, duration);
    };
  }

  /**
   * Subscribe to metric updates
   */
  onMetric(listener: (metric: string, labels: MetricLabels, value: number) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit metric to listeners
   */
  private emit(name: string, labels: MetricLabels, value: number): void {
    for (const listener of this.listeners) {
      try {
        listener(name, labels, value);
      } catch (error) {
        console.error('[Metrics] Listener error:', error);
      }
    }
  }

  /**
   * Get all metrics in Prometheus text format
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];

    // Counters
    for (const [name, values] of this.counters) {
      const def = Object.values(METRIC_DEFINITIONS).find(d => d.name === name);
      if (def) {
        lines.push(`# HELP ${name} ${def.help}`);
        lines.push(`# TYPE ${name} counter`);
      }
      for (const [labels, value] of values) {
        lines.push(`${name}{${labels}} ${value}`);
      }
    }

    // Gauges
    for (const [name, values] of this.gauges) {
      const def = Object.values(METRIC_DEFINITIONS).find(d => d.name === name);
      if (def) {
        lines.push(`# HELP ${name} ${def.help}`);
        lines.push(`# TYPE ${name} gauge`);
      }
      for (const [labels, value] of values) {
        lines.push(`${name}{${labels}} ${value}`);
      }
    }

    // Histograms (simplified - just sum and count)
    for (const [name, labelValues] of this.histograms) {
      const def = Object.values(METRIC_DEFINITIONS).find(d => d.name === name);
      if (def) {
        lines.push(`# HELP ${name} ${def.help}`);
        lines.push(`# TYPE ${name} histogram`);
      }
      for (const [labels, values] of labelValues) {
        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          const count = values.length;
          lines.push(`${name}_sum{${labels}} ${sum}`);
          lines.push(`${name}_count{${labels}} ${count}`);

          // Add bucket counts
          const buckets = def?.buckets ?? [0.1, 0.5, 1, 5, 10];
          for (const bucket of buckets) {
            const bucketCount = values.filter(v => v <= bucket).length;
            lines.push(`${name}_bucket{${labels},le="${bucket}"} ${bucketCount}`);
          }
          lines.push(`${name}_bucket{${labels},le="+Inf"} ${count}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    for (const map of this.counters.values()) map.clear();
    for (const map of this.gauges.values()) map.clear();
    for (const map of this.histograms.values()) map.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL COLLECTOR INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

export const collector = new MetricCollector();

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE METRICS OBJECT
// ═══════════════════════════════════════════════════════════════════════════════

export const metrics = {
  // Queue metrics
  queueWaitTime: {
    observe: (labels: { queue: string; org_id: string }, value: number) =>
      collector.observeHistogram(METRIC_DEFINITIONS.queueWaitTime.name, labels, value),
    startTimer: (labels: { queue: string; org_id: string }) =>
      collector.startTimer(METRIC_DEFINITIONS.queueWaitTime.name, labels),
  },
  processingTime: {
    observe: (labels: { queue: string; org_id: string; status: string }, value: number) =>
      collector.observeHistogram(METRIC_DEFINITIONS.processingTime.name, labels, value),
    startTimer: (labels: { queue: string; org_id: string }) => {
      const start = Date.now();
      return (endLabels: { status: string }) => {
        const duration = (Date.now() - start) / 1000;
        collector.observeHistogram(METRIC_DEFINITIONS.processingTime.name, { ...labels, ...endLabels }, duration);
      };
    },
  },
  jobsTotal: {
    inc: (labels: { queue: string; org_id: string; status: string }) =>
      collector.incCounter(METRIC_DEFINITIONS.jobsTotal.name, labels),
  },
  jobsActive: {
    set: (labels: { queue: string; org_id: string }, value: number) =>
      collector.setGauge(METRIC_DEFINITIONS.jobsActive.name, labels, value),
    inc: (labels: { queue: string; org_id: string }) =>
      collector.incGauge(METRIC_DEFINITIONS.jobsActive.name, labels),
    dec: (labels: { queue: string; org_id: string }) =>
      collector.decGauge(METRIC_DEFINITIONS.jobsActive.name, labels),
  },
  jobsWaiting: {
    set: (labels: { queue: string }, value: number) =>
      collector.setGauge(METRIC_DEFINITIONS.jobsWaiting.name, labels, value),
  },

  // Capability metrics
  capabilityCheck: {
    inc: (labels: { capability: string; result: string; org_id?: string }) =>
      collector.incCounter(METRIC_DEFINITIONS.capabilityCheck.name, { org_id: 'global', ...labels }),
  },
  capabilityOverrideActive: {
    set: (labels: { capability: string; source: string }, value: number) =>
      collector.setGauge(METRIC_DEFINITIONS.capabilityOverrideActive.name, labels, value),
  },

  // Panic mode metrics
  panicModeActive: {
    set: (labels: { integration: string }, value: 0 | 1) =>
      collector.setGauge(METRIC_DEFINITIONS.panicModeActive.name, labels, value),
  },
  panicModeTriggered: {
    inc: (labels: { integration: string; trigger_type: string }) =>
      collector.incCounter(METRIC_DEFINITIONS.panicModeTriggered.name, labels),
  },
  integrationFailures: {
    inc: (labels: { integration: string; error_type: string }) =>
      collector.incCounter(METRIC_DEFINITIONS.integrationFailures.name, labels),
  },

  // External service metrics
  externalRequest: {
    observe: (labels: { service: string; endpoint: string; status: string }, duration: number) => {
      collector.observeHistogram(METRIC_DEFINITIONS.externalRequestDuration.name, labels, duration);
      collector.incCounter(METRIC_DEFINITIONS.externalRequestTotal.name, labels);
    },
    startTimer: (labels: { service: string; endpoint: string }) => {
      const start = Date.now();
      return (status: string) => {
        const duration = (Date.now() - start) / 1000;
        metrics.externalRequest.observe({ ...labels, status }, duration);
      };
    },
  },

  // Scheduler metrics
  schedulerOrgActive: {
    set: (labels: { org_id: string }, value: number) =>
      collector.setGauge(METRIC_DEFINITIONS.schedulerOrgActive.name, labels, value),
  },
  schedulerOrgWaitTime: {
    set: (labels: { org_id: string }, value: number) =>
      collector.setGauge(METRIC_DEFINITIONS.schedulerOrgWaitTime.name, labels, value),
  },

  // HTTP metrics
  httpRequest: {
    observe: (labels: { method: string; route: string; status_code: string }, duration: number) => {
      collector.observeHistogram(METRIC_DEFINITIONS.httpRequestDuration.name, labels, duration);
      collector.incCounter(METRIC_DEFINITIONS.httpRequestTotal.name, labels);
    },
    startTimer: (labels: { method: string; route: string }) => {
      const start = Date.now();
      return (status_code: string) => {
        const duration = (Date.now() - start) / 1000;
        metrics.httpRequest.observe({ ...labels, status_code }, duration);
      };
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Track job processing with automatic metrics
 */
export function trackJobProcessing(queue: string, orgId: string, queuedAt?: Date) {
  // Record wait time if queued timestamp available
  if (queuedAt) {
    const waitTime = (Date.now() - queuedAt.getTime()) / 1000;
    metrics.queueWaitTime.observe({ queue, org_id: orgId }, waitTime);
  }

  // Increment active jobs
  metrics.jobsActive.inc({ queue, org_id: orgId });

  // Return timer function
  const stopTimer = metrics.processingTime.startTimer({ queue, org_id: orgId });

  return (result: { status: 'success' | 'failure'; error?: string }) => {
    // Stop timer and record
    stopTimer({ status: result.status });

    // Decrement active jobs
    metrics.jobsActive.dec({ queue, org_id: orgId });

    // Increment total
    metrics.jobsTotal.inc({ queue, org_id: orgId, status: result.status });
  };
}

/**
 * Track external service request with automatic metrics
 */
export function trackExternalRequest(service: string, endpoint: string) {
  const stopTimer = metrics.externalRequest.startTimer({ service, endpoint });

  return (status: 'success' | 'failure' | string) => {
    stopTimer(status);
  };
}

/**
 * Get Prometheus metrics endpoint handler
 */
export function getMetricsHandler() {
  return (_req: unknown, res: { setHeader: (k: string, v: string) => void; end: (s: string) => void }) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.end(collector.toPrometheusFormat());
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default metrics;
