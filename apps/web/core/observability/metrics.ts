/**
 * CampoTech Metrics Collector (Phase 8.1.2)
 * =========================================
 *
 * Collects and exports application metrics in Prometheus format.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface MetricValue {
  value: number;
  labels: Record<string, string>;
  timestamp?: number;
}

interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  values: MetricValue[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRICS STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

const metrics: Map<string, Metric> = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class MetricsCollector {
  /**
   * Register a new metric
   */
  register(
    name: string,
    type: Metric['type'],
    help: string
  ): void {
    if (!metrics.has(name)) {
      metrics.set(name, {
        name,
        type,
        help,
        values: [],
      });
    }
  }

  /**
   * Increment a counter
   */
  increment(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const metric = metrics.get(name);
    if (!metric) {
      this.register(name, 'counter', `Counter ${name}`);
    }

    const existing = this.findValue(name, labels);
    if (existing) {
      existing.value += value;
    } else {
      metrics.get(name)?.values.push({ value, labels, timestamp: Date.now() });
    }
  }

  /**
   * Set a gauge value
   */
  set(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric = metrics.get(name);
    if (!metric) {
      this.register(name, 'gauge', `Gauge ${name}`);
    }

    const existing = this.findValue(name, labels);
    if (existing) {
      existing.value = value;
      existing.timestamp = Date.now();
    } else {
      metrics.get(name)?.values.push({ value, labels, timestamp: Date.now() });
    }
  }

  /**
   * Record a histogram observation
   */
  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric = metrics.get(name);
    if (!metric) {
      this.register(name, 'histogram', `Histogram ${name}`);
    }

    metrics.get(name)?.values.push({ value, labels, timestamp: Date.now() });
  }

  /**
   * Find an existing metric value by labels
   */
  private findValue(name: string, labels: Record<string, string>): MetricValue | undefined {
    const metric = metrics.get(name);
    if (!metric) return undefined;

    return metric.values.find((v) => {
      const vLabels = Object.keys(v.labels);
      const searchLabels = Object.keys(labels);
      if (vLabels.length !== searchLabels.length) return false;
      return searchLabels.every((key) => v.labels[key] === labels[key]);
    });
  }

  /**
   * Format labels for Prometheus output
   */
  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';
    const formatted = entries.map(([k, v]) => `${k}="${v}"`).join(',');
    return `{${formatted}}`;
  }

  /**
   * Export all metrics in Prometheus format
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];

    for (const metric of metrics.values()) {
      // Add HELP and TYPE comments
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      // Add metric values
      for (const value of metric.values) {
        const labels = this.formatLabels(value.labels);
        lines.push(`${metric.name}${labels} ${value.value}`);
      }

      lines.push(''); // Empty line between metrics
    }

    // Add default metrics if none exist
    if (metrics.size === 0) {
      lines.push('# HELP campotech_up Whether CampoTech is up');
      lines.push('# TYPE campotech_up gauge');
      lines.push('campotech_up 1');
      lines.push('');
      lines.push('# HELP campotech_info CampoTech application info');
      lines.push('# TYPE campotech_info gauge');
      lines.push('campotech_info{version="1.0.0",env="' + (process.env.NODE_ENV || 'development') + '"} 1');
    }

    return lines.join('\n');
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clear(): void {
    metrics.clear();
  }

  /**
   * Get all metrics as JSON (for debugging)
   */
  toJSON(): Record<string, Metric> {
    const result: Record<string, Metric> = {};
    for (const [name, metric] of metrics) {
      result[name] = metric;
    }
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

export const collector = new MetricsCollector();

// Pre-register common metrics
collector.register('http_requests_total', 'counter', 'Total HTTP requests');
collector.register('http_request_duration_seconds', 'histogram', 'HTTP request duration in seconds');
collector.register('http_request_errors_total', 'counter', 'Total HTTP request errors');
collector.register('active_connections', 'gauge', 'Number of active connections');
collector.register('queue_jobs_total', 'counter', 'Total jobs processed by queue');
collector.register('queue_jobs_failed_total', 'counter', 'Total failed queue jobs');
collector.register('external_api_calls_total', 'counter', 'Total external API calls');
collector.register('external_api_errors_total', 'counter', 'Total external API errors');
collector.register('external_api_latency_seconds', 'histogram', 'External API latency in seconds');

export default collector;
