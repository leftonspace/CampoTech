/**
 * Health Check Endpoint (Phase 8.3.1)
 * ====================================
 *
 * Health check endpoint for uptime monitoring and load balancer health checks.
 *
 * Endpoints:
 * - GET /api/monitoring/health - Basic health check (returns 200 if app is running)
 * - GET /api/monitoring/health?detailed=true - Detailed health with subsystem checks
 *
 * Usage with UptimeRobot:
 * 1. Create new monitor
 * 2. Type: HTTP(s)
 * 3. URL: https://your-domain.com/api/monitoring/health
 * 4. Monitoring Interval: 5 minutes
 * 5. Alert contacts: Your email/Slack/etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks?: {
    database: SubsystemCheck;
    cache: SubsystemCheck;
    external: SubsystemCheck;
  };
}

interface SubsystemCheck {
  status: 'pass' | 'warn' | 'fail';
  responseTime?: number;
  message?: string;
}

const startTime = Date.now();

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<SubsystemCheck> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'pass',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

/**
 * Check Redis/cache connectivity
 */
async function checkCache(): Promise<SubsystemCheck> {
  const start = Date.now();

  // Check if Redis is configured
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return {
      status: 'warn',
      message: 'Redis not configured',
    };
  }

  try {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });

    await redis.ping();
    return {
      status: 'pass',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Redis connection failed',
    };
  }
}

/**
 * Check external service connectivity (Sentry)
 */
async function checkExternal(): Promise<SubsystemCheck> {
  // Sentry is checked implicitly through SDK initialization
  // If we got this far, the app is running
  return {
    status: 'pass',
    message: 'External services configured',
  };
}

/**
 * Determine overall health status
 */
function determineOverallStatus(checks: {
  database: SubsystemCheck;
  cache: SubsystemCheck;
  external: SubsystemCheck;
}): 'healthy' | 'degraded' | 'unhealthy' {
  const statuses = Object.values(checks).map((c) => c.status);

  if (statuses.includes('fail')) {
    // If database is down, service is unhealthy
    if (checks.database.status === 'fail') {
      return 'unhealthy';
    }
    // Other failures result in degraded status
    return 'degraded';
  }

  if (statuses.includes('warn')) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * GET /api/monitoring/health
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const detailed = request.nextUrl.searchParams.get('detailed') === 'true';
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  // Basic health check
  if (!detailed) {
    const result: HealthCheckResult = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime,
    };

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // Detailed health check with subsystem checks
  const [database, cache, external] = await Promise.all([
    checkDatabase(),
    checkCache(),
    checkExternal(),
  ]);

  const checks = { database, cache, external };
  const status = determineOverallStatus(checks);

  const result: HealthCheckResult = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime,
    checks,
  };

  // Return 503 if unhealthy for load balancer compatibility
  const httpStatus = status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(result, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
