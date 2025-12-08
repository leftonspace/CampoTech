#!/usr/bin/env ts-node
/**
 * Metrics Export CLI
 * ==================
 *
 * Exports current metrics in Prometheus format.
 *
 * USAGE:
 *   npm run metrics:export              # Print metrics to stdout
 *   npm run metrics:export > metrics.txt  # Save to file
 */

import { getMetricsCollector } from '../core/observability/metrics';

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Metrics Export CLI
==================

Exports all collected metrics in Prometheus format.

Usage:
  npm run metrics:export              Print metrics to stdout
  npm run metrics:export > file.txt   Save metrics to file

The output can be used with:
  - Prometheus (scraping endpoint)
  - Grafana (visualization)
  - Custom monitoring tools

Metrics included:
  - queue_wait_time_seconds
  - queue_processing_time_seconds
  - jobs_total (by status, queue, org)
  - capability_check_total (by capability, result)
  - panic_mode_active (by integration)
  - external_request_duration_seconds
  - external_request_total
`);
    return;
  }

  const collector = getMetricsCollector();
  const output = collector.exportPrometheus();

  console.log(output);
}

main();
