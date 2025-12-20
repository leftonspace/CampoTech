/**
 * AFIP Status Dashboard API
 * =========================
 *
 * Provides real-time status information about the AFIP integration.
 *
 * GET /api/afip/status - Get system-wide AFIP status
 * GET /api/afip/status?orgId=xxx - Get org-specific status
 *
 * Response includes:
 * - Overall health (healthy/degraded/critical)
 * - AFIP connectivity status
 * - Rate limiter state
 * - Circuit breaker status
 * - Queue metrics
 * - Performance metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAFIPClient } from '@/lib/integrations/afip';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get optional orgId filter
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId') || undefined;

    // Verify user has access to the org if specified
    if (orgId && session.organizationId !== orgId) {
      // Only OWNER can access other organization status
      if (session.role !== 'OWNER') {
        return NextResponse.json(
          { error: 'Forbidden: Cannot access other organization status' },
          { status: 403 }
        );
      }
    }

    // Get AFIP client and status
    const client = getAFIPClient();
    const status = await client.getSystemStatus(orgId || session.organizationId);

    // Add additional context
    const response = {
      ...status,
      requestedAt: new Date().toISOString(),
      orgId: orgId || session.organizationId || 'global',
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-AFIP-Health': status.health,
      },
    });
  } catch (error) {
    console.error('[AFIP Status API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get AFIP status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/afip/status - Control operations
 *
 * Body: {
 *   action: 'pause' | 'resume' | 'reset_circuit' | 'open_circuit',
 *   orgId?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only OWNER can perform control actions
    if (session.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Forbidden: Owner access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, orgId } = body as { action: string; orgId?: string };

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    const client = getAFIPClient();
    let message: string;

    switch (action) {
      case 'pause':
        client.pauseProcessing();
        message = 'AFIP processing paused';
        break;

      case 'resume':
        client.resumeProcessing();
        message = 'AFIP processing resumed';
        break;

      case 'reset_circuit':
        client.forceCircuitClose(orgId);
        message = orgId
          ? `Circuit breaker reset for org ${orgId}`
          : 'Global circuit breaker reset';
        break;

      case 'open_circuit':
        client.forceCircuitOpen(orgId, 'Manual activation via API');
        message = orgId
          ? `Circuit breaker opened for org ${orgId}`
          : 'Global circuit breaker opened';
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    console.info(`[AFIP Status API] ${message} by user ${session.email}`);

    return NextResponse.json({
      success: true,
      message,
      action,
      orgId: orgId || 'global',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AFIP Status API] Control error:', error);

    return NextResponse.json(
      {
        error: 'Failed to perform action',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
