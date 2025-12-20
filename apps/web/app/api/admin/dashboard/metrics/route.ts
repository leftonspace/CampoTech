/**
 * Admin Dashboard Metrics API
 * ============================
 *
 * GET /api/admin/dashboard/metrics - Get launch monitoring metrics
 *
 * Returns comprehensive metrics for launch monitoring dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { launchDashboard } from '@/lib/services/launch-dashboard';

// Cache metrics for 30 seconds
let cachedMetrics: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 30 * 1000;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify admin access
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check cache
    const now = Date.now();
    if (cachedMetrics && now - cachedMetrics.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cachedMetrics.data,
        cached: true,
      });
    }

    // Get metrics
    const metrics = await launchDashboard.getMetrics();
    const health = await launchDashboard.getHealthStatus();

    const response = {
      metrics,
      health,
    };

    // Update cache
    cachedMetrics = {
      data: response,
      timestamp: now,
    };

    return NextResponse.json({
      success: true,
      data: response,
      cached: false,
    });
  } catch (error) {
    console.error('[DashboardMetrics] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
