/**
 * System Health API
 * =================
 *
 * GET /api/health - Get overall system health status
 * GET /api/health?service=mercadopago - Get specific service status
 * GET /api/health?feature=online_payments - Get specific feature status
 * GET /api/health?format=simple - Simple format for monitoring
 * GET /api/health?format=prometheus - Prometheus metrics format
 *
 * This endpoint is public (no auth required) for monitoring tools.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getSystemHealth,
  getServiceState,
  formatHealthResponse,
} from '@/lib/degradation';
import type { ServiceId, FeatureId, SystemHealth } from '@/lib/degradation';

// Valid service and feature IDs
const VALID_SERVICES: ServiceId[] = [
  'mercadopago',
  'whatsapp',
  'openai',
  'afip',
  'database',
  'redis',
  'storage',
];

const VALID_FEATURES: FeatureId[] = [
  'online_payments',
  'whatsapp_messaging',
  'ai_responses',
  'invoice_generation',
  'voice_transcription',
  'document_extraction',
  'payment_webhooks',
  'sms_notifications',
];

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const serviceId = params.get('service');
    const featureId = params.get('feature');
    const format = params.get('format') || 'full';
    const legacy = params.get('legacy') === 'true';

    // Legacy format for backwards compatibility
    if (legacy) {
      return getLegacyHealth();
    }

    // Specific service check
    if (serviceId) {
      if (!VALID_SERVICES.includes(serviceId as ServiceId)) {
        return NextResponse.json(
          { error: `Invalid service ID. Valid: ${VALID_SERVICES.join(', ')}` },
          { status: 400 }
        );
      }

      const state = await getServiceState(serviceId as ServiceId);

      // Return simple status for monitoring tools
      if (format === 'simple') {
        return NextResponse.json({
          service: state.id,
          status: state.status,
          healthy: state.status === 'healthy',
        });
      }

      return NextResponse.json({
        service: {
          id: state.id,
          name: state.name,
          status: state.status,
          circuitState: state.circuitState,
          successRate: state.successRate,
          avgLatency: state.avgLatency,
          lastSuccess: state.lastSuccess?.toISOString() || null,
          lastError: state.lastError?.toISOString() || null,
          lastErrorMessage: state.lastErrorMessage,
          recoveryEta: state.recoveryEta?.toISOString() || null,
          hasFallback: state.hasFallback,
          fallbackDescription: state.fallbackDescription,
        },
        updatedAt: state.updatedAt.toISOString(),
      });
    }

    // Specific feature check
    if (featureId) {
      if (!VALID_FEATURES.includes(featureId as FeatureId)) {
        return NextResponse.json(
          { error: `Invalid feature ID. Valid: ${VALID_FEATURES.join(', ')}` },
          { status: 400 }
        );
      }

      const health = await getSystemHealth();
      const feature = health.features[featureId as FeatureId];

      if (format === 'simple') {
        return NextResponse.json({
          feature: feature.id,
          available: feature.available,
        });
      }

      return NextResponse.json({
        feature: {
          id: feature.id,
          name: feature.name,
          available: feature.available,
          degradedReason: feature.degradedReason,
          affectedServices: feature.affectedServices,
          userMessage: feature.userMessage,
          alternativeAction: feature.alternativeAction,
          severity: feature.severity,
        },
        updatedAt: feature.updatedAt.toISOString(),
      });
    }

    // Full system health
    const health = await getSystemHealth();

    // Simple format for monitoring tools (Prometheus, Datadog, etc.)
    if (format === 'simple') {
      return NextResponse.json({
        status: health.status,
        healthy: health.status === 'operational',
        degradedCount: health.degradedCount,
        healthyServices: health.healthyCount,
        totalServices: health.totalServices,
        activeIncidents: health.activeIncidents.length,
      });
    }

    // Prometheus metrics format
    if (format === 'prometheus') {
      const metrics = generatePrometheusMetrics(health);
      return new NextResponse(metrics, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Full format
    const response = formatHealthResponse(health);

    // Set cache headers for CDN
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('[Health API] Error:', error);

    // Return unhealthy status on error
    return NextResponse.json(
      {
        status: 'major_outage',
        message: 'Error checking system health',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

/**
 * Legacy health check (backwards compatible)
 */
async function getLegacyHealth() {
  const dbUrl = process.env.DATABASE_URL || '';
  let dbInfo = {};
  try {
    const url = new URL(dbUrl);
    dbInfo = {
      protocol: url.protocol,
      username: url.username,
      host: url.host,
      port: url.port,
      pathname: url.pathname,
      search: url.search,
    };
  } catch {
    dbInfo = { parseError: 'Could not parse DATABASE_URL' };
  }

  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      dbUrlLength: dbUrl.length,
    },
    connectionInfo: dbInfo,
  };

  try {
    const userCount = await prisma.user.count();
    checks.database = {
      connected: true,
      userCount,
    };

    const owner = await prisma.user.findFirst({
      where: { role: 'OWNER' },
      select: { id: true, name: true, phone: true, email: true },
    });
    checks.ownerUser = owner;
  } catch (error) {
    checks.database = {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  return NextResponse.json(checks);
}

/**
 * Generate Prometheus-compatible metrics
 */
function generatePrometheusMetrics(health: SystemHealth): string {
  const lines: string[] = [];

  // Overall status
  lines.push('# HELP campotech_system_status Overall system health status');
  lines.push('# TYPE campotech_system_status gauge');
  const statusValue =
    health.status === 'operational'
      ? 1
      : health.status === 'degraded'
        ? 0.5
        : 0;
  lines.push(`campotech_system_status ${statusValue}`);

  // Service status
  lines.push(
    '# HELP campotech_service_status Service health status (1=healthy, 0.5=degraded, 0=unavailable)'
  );
  lines.push('# TYPE campotech_service_status gauge');
  for (const service of Object.values(health.services)) {
    const value =
      service.status === 'healthy'
        ? 1
        : service.status === 'degraded'
          ? 0.5
          : 0;
    lines.push(`campotech_service_status{service="${service.id}"} ${value}`);
  }

  // Service success rate
  lines.push(
    '# HELP campotech_service_success_rate Service success rate percentage'
  );
  lines.push('# TYPE campotech_service_success_rate gauge');
  for (const service of Object.values(health.services)) {
    lines.push(
      `campotech_service_success_rate{service="${service.id}"} ${service.successRate}`
    );
  }

  // Service latency
  lines.push(
    '# HELP campotech_service_latency_ms Service average latency in milliseconds'
  );
  lines.push('# TYPE campotech_service_latency_ms gauge');
  for (const service of Object.values(health.services)) {
    lines.push(
      `campotech_service_latency_ms{service="${service.id}"} ${service.avgLatency}`
    );
  }

  // Feature availability
  lines.push(
    '# HELP campotech_feature_available Feature availability (1=available, 0=unavailable)'
  );
  lines.push('# TYPE campotech_feature_available gauge');
  for (const feature of Object.values(health.features)) {
    lines.push(
      `campotech_feature_available{feature="${feature.id}"} ${feature.available ? 1 : 0}`
    );
  }

  // Active incidents
  lines.push('# HELP campotech_active_incidents Number of active incidents');
  lines.push('# TYPE campotech_active_incidents gauge');
  lines.push(`campotech_active_incidents ${health.activeIncidents.length}`);

  return lines.join('\n') + '\n';
}
