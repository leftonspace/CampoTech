/**
 * AI Analytics API Route
 * ======================
 *
 * Provides analytics data about AI-powered WhatsApp interactions:
 * - Resolution rates
 * - Confidence distributions
 * - Response times
 * - Intent breakdowns
 * - Booking conversions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface AIAnalyticsData {
  summary: {
    totalConversations: number;
    aiResolved: number;
    aiResolvedPercent: number;
    transferred: number;
    transferredPercent: number;
    avgConfidence: number;
    avgResponseTimeMs: number;
  };
  confidenceDistribution: {
    high: number;    // 80-100
    medium: number;  // 50-79
    low: number;     // 0-49
  };
  intentBreakdown: Array<{
    intent: string;
    count: number;
    percent: number;
  }>;
  dailyStats: Array<{
    date: string;
    total: number;
    resolved: number;
    transferred: number;
  }>;
  topQuestions: Array<{
    question: string;
    count: number;
  }>;
  bookingStats: {
    attempted: number;
    completed: number;
    conversionRate: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Fetch all AI conversation logs for the period
    const aiLogs = await prisma.aIConversationLog.findMany({
      where: {
        organizationId: session.organizationId,
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        conversationId: true,
        detectedIntent: true,
        confidenceScore: true,
        responseStatus: true,
        customerMessage: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate summary stats
    const totalConversations = new Set(aiLogs.map(l => l.conversationId)).size;
    const aiResolved = aiLogs.filter(l => l.responseStatus === 'sent').length;
    const transferred = aiLogs.filter(l => l.responseStatus === 'transferred').length;
    const confidenceScores = aiLogs
      .filter(l => l.confidenceScore !== null)
      .map(l => l.confidenceScore as number);
    const avgConfidence = confidenceScores.length > 0
      ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
      : 0;

    // Confidence distribution
    const confidenceDistribution = {
      high: confidenceScores.filter(c => c >= 80).length,
      medium: confidenceScores.filter(c => c >= 50 && c < 80).length,
      low: confidenceScores.filter(c => c < 50).length,
    };

    // Intent breakdown
    const intentCounts = new Map<string, number>();
    aiLogs.forEach(log => {
      if (log.detectedIntent) {
        const count = intentCounts.get(log.detectedIntent) || 0;
        intentCounts.set(log.detectedIntent, count + 1);
      }
    });

    const intentBreakdown = Array.from(intentCounts.entries())
      .map(([intent, count]) => ({
        intent,
        count,
        percent: Math.round((count / aiLogs.length) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // Daily stats (last 7 days)
    const dailyStats: AIAnalyticsData['dailyStats'] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayLogs = aiLogs.filter(l =>
        l.createdAt >= date && l.createdAt < nextDate
      );

      dailyStats.push({
        date: date.toISOString().split('T')[0],
        total: dayLogs.length,
        resolved: dayLogs.filter(l => l.responseStatus === 'sent').length,
        transferred: dayLogs.filter(l => l.responseStatus === 'transferred').length,
      });
    }

    // Booking stats
    const bookingIntents = aiLogs.filter(l => l.detectedIntent === 'booking');
    const bookingsCompleted = await prisma.job.count({
      where: {
        organizationId: session.organizationId,
        source: 'whatsapp_ai',
        createdAt: { gte: startDate },
      },
    });

    const bookingStats = {
      attempted: bookingIntents.length,
      completed: bookingsCompleted,
      conversionRate: bookingIntents.length > 0
        ? Math.round((bookingsCompleted / bookingIntents.length) * 100)
        : 0,
    };

    // Get top questions (from question intents)
    const questionLogs = aiLogs
      .filter(l => l.detectedIntent === 'question' && l.customerMessage)
      .slice(0, 20);

    // Group similar questions (simplified - just take first 50 chars)
    const questionCounts = new Map<string, number>();
    questionLogs.forEach(log => {
      if (log.customerMessage) {
        const key = log.customerMessage.substring(0, 50).toLowerCase();
        const count = questionCounts.get(key) || 0;
        questionCounts.set(key, count + 1);
      }
    });

    const topQuestions = Array.from(questionCounts.entries())
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const analytics: AIAnalyticsData = {
      summary: {
        totalConversations,
        aiResolved,
        aiResolvedPercent: aiLogs.length > 0 ? Math.round((aiResolved / aiLogs.length) * 100) : 0,
        transferred,
        transferredPercent: aiLogs.length > 0 ? Math.round((transferred / aiLogs.length) * 100) : 0,
        avgConfidence,
        avgResponseTimeMs: 0, // Would need to track this separately
      },
      confidenceDistribution,
      intentBreakdown,
      dailyStats,
      topQuestions,
      bookingStats,
    };

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('AI Analytics error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching analytics' },
      { status: 500 }
    );
  }
}
