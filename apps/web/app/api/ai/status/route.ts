/**
 * AI System Status API
 * ====================
 *
 * Provides status information about the AI system including budget and service health.
 *
 * GET /api/ai/status - Get AI system status
 * POST /api/ai/status - Control operations (pause/resume AI)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAISystemStatus } from '@/lib/integrations/openai';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId') || session.organizationId;

    const status = await getAISystemStatus(orgId);

    // Determine overall health
    let health: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (!status.service.available || status.budget.isDailyExceeded || status.budget.isMonthlyExceeded) {
      health = 'critical';
    } else if (status.budget.isApproachingLimit || status.service.successRate < 0.9) {
      health = 'degraded';
    }

    return NextResponse.json({
      health,
      ...status,
      orgId,
    });
  } catch (error) {
    console.error('[AI Status API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get AI status' },
      { status: 500 }
    );
  }
}
