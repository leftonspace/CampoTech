/**
 * Admin Aggregation Stats API
 * ===========================
 *
 * Phase 9.8: Message Aggregation System
 * Provides monitoring endpoints for message buffer statistics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma as db } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    if (session.role !== 'admin' && session.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get buffer stats for the period
    const stats = await db.messageBufferStats.findMany({
      where: {
        organizationId: session.organizationId,
        date: { gte: startDate },
      },
      orderBy: { date: 'desc' },
    });

    // Calculate totals
    const totals = stats.reduce(
      (acc: { buffersCreated: number; messagesAggregated: number; immediateTriggers: number; timeoutTriggers: number }, stat: typeof stats[number]) => ({
        buffersCreated: acc.buffersCreated + stat.totalBuffersCreated,
        messagesAggregated: acc.messagesAggregated + stat.totalMessagesAggregated,
        immediateTriggers: acc.immediateTriggers + stat.totalImmediateTriggers,
        timeoutTriggers: acc.timeoutTriggers + stat.totalTimeoutTriggers,
      }),
      {
        buffersCreated: 0,
        messagesAggregated: 0,
        immediateTriggers: 0,
        timeoutTriggers: 0,
      }
    );

    // Calculate average messages per buffer
    const avgMessagesPerBuffer =
      totals.buffersCreated > 0
        ? (totals.messagesAggregated / totals.buffersCreated).toFixed(2)
        : '0';

    // Get active contexts count
    const activeContexts = await db.conversationContext.count({
      where: {
        organizationId: session.organizationId,
        expiresAt: { gt: new Date() },
      },
    });

    // Get recent aggregation events
    const recentEvents = await db.messageAggregationEvent.findMany({
      where: {
        organizationId: session.organizationId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Group events by trigger reason
    const triggerReasons = recentEvents.reduce(
      (acc: Record<string, number>, event: typeof recentEvents[number]) => {
        const reason = event.triggerReason;
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      data: {
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
        totals,
        averages: {
          messagesPerBuffer: parseFloat(avgMessagesPerBuffer),
          buffersPerDay: (totals.buffersCreated / days).toFixed(2),
        },
        activeContexts,
        triggerReasons,
        dailyStats: stats.map((s: typeof stats[number]) => ({
          date: s.date.toISOString().split('T')[0],
          buffersCreated: s.totalBuffersCreated,
          messagesAggregated: s.totalMessagesAggregated,
          immediateTriggers: s.totalImmediateTriggers,
          timeoutTriggers: s.totalTimeoutTriggers,
        })),
      },
    });
  } catch (error) {
    console.error('Admin aggregation stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching aggregation stats' },
      { status: 500 }
    );
  }
}
