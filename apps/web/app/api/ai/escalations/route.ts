/**
 * AI Escalations API
 * ==================
 *
 * Manages escalation tickets when AI cannot handle requests.
 *
 * GET /api/ai/escalations - Get pending escalations
 * POST /api/ai/escalations/:id/assign - Assign escalation
 * POST /api/ai/escalations/:id/resolve - Resolve escalation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOpenAIFallbackHandler } from '@/lib/integrations/openai';

/**
 * GET - Get pending escalations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    const fallbackHandler = getOpenAIFallbackHandler();
    const escalations = await fallbackHandler.getPendingEscalations(orgId);
    const count = await fallbackHandler.countPendingEscalations(orgId);

    return NextResponse.json({
      escalations,
      total: count,
      orgId,
    });
  } catch (error) {
    console.error('[AI Escalations API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get escalations' },
      { status: 500 }
    );
  }
}

/**
 * POST - Actions on escalations (assign/resolve)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ticketId, userId, resolution } = body as {
      action: 'assign' | 'resolve' | 'expire_old';
      ticketId?: string;
      userId?: string;
      resolution?: string;
    };

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const fallbackHandler = getOpenAIFallbackHandler();

    switch (action) {
      case 'assign': {
        if (!ticketId || !userId) {
          return NextResponse.json(
            { error: 'ticketId and userId are required' },
            { status: 400 }
          );
        }

        const assigned = await fallbackHandler.assignEscalation(ticketId, userId);
        return NextResponse.json({
          success: assigned,
          action: 'assign',
          ticketId,
          userId,
        });
      }

      case 'resolve': {
        if (!ticketId || !resolution) {
          return NextResponse.json(
            { error: 'ticketId and resolution are required' },
            { status: 400 }
          );
        }

        const resolved = await fallbackHandler.resolveEscalation(ticketId, resolution);
        return NextResponse.json({
          success: resolved,
          action: 'resolve',
          ticketId,
        });
      }

      case 'expire_old': {
        // Owner only action
        if (session.role !== 'OWNER') {
          return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
        }

        const expiredCount = await fallbackHandler.expireOldEscalations();
        return NextResponse.json({
          success: true,
          action: 'expire_old',
          expiredCount,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[AI Escalations API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process escalation action' },
      { status: 500 }
    );
  }
}
