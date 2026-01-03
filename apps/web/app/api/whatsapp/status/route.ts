/**
 * WhatsApp Status API
 * ===================
 *
 * GET /api/whatsapp/status - Get WhatsApp service status
 * POST /api/whatsapp/status - Admin actions (reset circuit, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getWASystemStatus,
  getWACircuitBreaker,
  resetRateLimiters,
  // isWAAvailable,
} from '@/lib/integrations/whatsapp';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId =
      request.nextUrl.searchParams.get('organizationId') || session.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const systemStatus = await getWASystemStatus(organizationId);

    return NextResponse.json({
      available: systemStatus.service.available,
      configured: systemStatus.configured,
      service: {
        circuitState: systemStatus.service.circuitState,
        successRate: systemStatus.service.successRate,
        avgLatency: systemStatus.service.avgLatency,
        lastSuccess: systemStatus.service.lastSuccess?.toISOString() || null,
        lastError: systemStatus.service.lastError?.toISOString() || null,
      },
      rateLimiter: systemStatus.service.rateLimiter,
      queue: {
        totalQueued: systemStatus.queue.totalQueued,
        health: systemStatus.queue.health,
        sentLastMinute: systemStatus.queue.sentLastMinute,
        currentRate: systemStatus.queue.currentRate,
      },
      updatedAt: systemStatus.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('[WA Status API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for admin role
    if (session.role !== 'admin' && session.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, state } = body;

    const circuitBreaker = getWACircuitBreaker();

    switch (action) {
      case 'reset_circuit':
        circuitBreaker.reset();
        return NextResponse.json({
          success: true,
          message: 'Circuit breaker reset',
          state: circuitBreaker.getState(),
        });

      case 'force_circuit_state':
        if (!['closed', 'open', 'half-open'].includes(state)) {
          return NextResponse.json(
            { error: 'Invalid state. Must be closed, open, or half-open' },
            { status: 400 }
          );
        }
        circuitBreaker.forceState(state);
        return NextResponse.json({
          success: true,
          message: `Circuit breaker forced to ${state}`,
          state: circuitBreaker.getState(),
        });

      case 'reset_rate_limiters':
        resetRateLimiters();
        return NextResponse.json({
          success: true,
          message: 'Rate limiters reset',
        });

      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Must be reset_circuit, force_circuit_state, or reset_rate_limiters',
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[WA Status API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    );
  }
}
