/**
 * Cost Dashboard API (Phase 8A.1.1)
 * ==================================
 *
 * API endpoint for the admin cost dashboard.
 *
 * Endpoints:
 * - GET /api/admin/costs - Get cost dashboard data
 * - GET /api/admin/costs?date=YYYY-MM-DD - Get costs for specific date
 * - GET /api/admin/costs?month=YYYY-MM - Get monthly breakdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { costs, BUDGET_CONFIG } from '@/lib/costs/aggregator';
import { getCostSummary } from '@/lib/costs/alerts';

/**
 * GET /api/admin/costs
 * Returns cost dashboard data
 */
export async function GET(request: NextRequest) {
  // Note: Admin auth is handled by middleware

  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get('date');
  const month = searchParams.get('month');

  try {
    if (date) {
      // Get specific date breakdown
      const breakdown = await costs.getBreakdown(date);
      return NextResponse.json(breakdown);
    }

    if (month) {
      // Get monthly breakdown
      const breakdown = await costs.getMonthlyBreakdown(month);
      return NextResponse.json(breakdown);
    }

    // Get full dashboard data
    const [, summary, trend] = await Promise.all([
      costs.getDashboardData(),
      getCostSummary(),
      costs.getDailyTrend(30),
    ]);

    // Get current month stats
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyBreakdown = await costs.getMonthlyBreakdown(currentMonth);

    return NextResponse.json({
      timestamp: new Date().toISOString(),

      // Current month totals
      currentMonth: {
        month: currentMonth,
        total: monthlyBreakdown.total,
        budget: BUDGET_CONFIG.total.monthly,
        percentUsed: (monthlyBreakdown.total / BUDGET_CONFIG.total.monthly) * 100,
        byService: monthlyBreakdown.byService,
      },

      // Today's totals
      today: {
        date: summary.date,
        total: summary.total,
        budget: BUDGET_CONFIG.total.daily,
        percentUsed: (summary.total / BUDGET_CONFIG.total.daily) * 100,
        byService: summary.byService,
        overBudget: summary.overBudget,
        nearBudget: summary.nearBudget,
      },

      // Daily trend (last 30 days)
      trend,

      // Budget configuration
      budgets: BUDGET_CONFIG,
    });
  } catch (error) {
    console.error('[Costs API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost data' },
      { status: 500 }
    );
  }
}
