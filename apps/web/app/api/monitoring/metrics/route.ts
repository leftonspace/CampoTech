/**
 * Prometheus Metrics Endpoint (Phase 8.2.1)
 * ==========================================
 *
 * Exposes application metrics in Prometheus text format for scraping.
 *
 * Endpoint: GET /api/monitoring/metrics
 *
 * Security:
 * - Protected by bearer token in production
 * - Rate limited to prevent abuse
 *
 * Usage:
 * ```bash
 * # Development
 * curl http://localhost:3000/api/monitoring/metrics
 *
 * # Production
 * curl -H "Authorization: Bearer $METRICS_TOKEN" https://api.campotech.com/api/monitoring/metrics
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { toPrometheusFormat, getMetricsSnapshot } from '@/lib/monitoring/business-metrics';
import { collector } from '@/core/observability/metrics';

/**
 * GET /api/monitoring/metrics
 * Returns Prometheus-formatted metrics
 */
export async function GET(request: NextRequest) {
  // Check authorization in production
  if (process.env.NODE_ENV === 'production') {
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.METRICS_AUTH_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  // Check if JSON format requested
  const acceptHeader = request.headers.get('accept') || '';
  const wantsJson = acceptHeader.includes('application/json');

  try {
    if (wantsJson) {
      // Return JSON snapshot for dashboards
      const snapshot = await getMetricsSnapshot();
      return NextResponse.json(snapshot);
    }

    // Combine business metrics with core observability metrics
    const [businessMetrics, coreMetrics] = await Promise.all([
      toPrometheusFormat(),
      Promise.resolve(collector.toPrometheusFormat()),
    ]);

    const combinedMetrics = [
      '# CampoTech Application Metrics',
      `# Scraped at: ${new Date().toISOString()}`,
      '',
      '# ═══════════════════════════════════════════════════════════════',
      '# Business Metrics',
      '# ═══════════════════════════════════════════════════════════════',
      '',
      businessMetrics,
      '',
      '# ═══════════════════════════════════════════════════════════════',
      '# Core Observability Metrics',
      '# ═══════════════════════════════════════════════════════════════',
      '',
      coreMetrics,
    ].join('\n');

    return new NextResponse(combinedMetrics, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[Metrics] Error generating metrics:', error);
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    );
  }
}
