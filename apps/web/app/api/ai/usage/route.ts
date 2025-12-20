/**
 * AI Usage API
 * ============
 *
 * Provides usage statistics and budget information for AI operations.
 *
 * GET /api/ai/usage - Get usage summary
 * GET /api/ai/usage?period=daily - Get daily usage
 * GET /api/ai/usage?period=monthly - Get monthly usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOpenAIUsageTracker } from '@/lib/integrations/openai';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || 'daily') as 'daily' | 'monthly';
    const orgId = session.organizationId;

    const tracker = getOpenAIUsageTracker();

    // Get usage summary
    const summary = await tracker.getUsageSummary(period, orgId);

    // Get budget status
    const budgetStatus = await tracker.getBudgetStatus(orgId);

    return NextResponse.json({
      period,
      summary,
      budget: budgetStatus,
      orgId,
    });
  } catch (error) {
    console.error('[AI Usage API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get AI usage' },
      { status: 500 }
    );
  }
}
