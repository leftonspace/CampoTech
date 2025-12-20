/**
 * MercadoPago Status API
 * ======================
 *
 * GET /api/mercadopago/status - Get MP service status
 * POST /api/mercadopago/status - Admin actions (reset circuit, force state)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getMPClient,
  getMPCircuitBreaker,
  getMPHealth,
} from '@/lib/integrations/mercadopago';

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

    // Get health status
    const health = await getMPHealth(organizationId);

    // Get full system status
    const client = getMPClient();
    const systemStatus = await client.getSystemStatus(organizationId);

    return NextResponse.json({
      health,
      system: {
        configured: systemStatus.configured,
        tokenValid: systemStatus.tokenValid,
        tokenExpiresAt: systemStatus.tokenExpiresAt?.toISOString() || null,
        lastWebhook: systemStatus.lastWebhook?.toISOString() || null,
      },
      circuitBreaker: {
        state: systemStatus.service.circuitState,
        lastSuccess: systemStatus.service.lastSuccess?.toISOString() || null,
        lastError: systemStatus.service.lastError?.toISOString() || null,
      },
      updatedAt: systemStatus.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('[MP Status API] Error:', error);
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

    const circuitBreaker = getMPCircuitBreaker();

    switch (action) {
      case 'reset':
        circuitBreaker.reset();
        return NextResponse.json({
          success: true,
          message: 'Circuit breaker reset',
          state: circuitBreaker.getState(),
        });

      case 'force_state':
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

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be reset or force_state' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[MP Status API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    );
  }
}
