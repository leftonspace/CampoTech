/**
 * WhatsApp Statistics API Route
 * Returns real-time statistics about WhatsApp messaging
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organizationId = session.user.organizationId;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d'; // 7d, 30d, 90d

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get conversation statistics
    const [
      totalConversations,
      activeConversations,
      newConversations,
      closedConversations,
    ] = await Promise.all([
      prisma.waConversation.count({
        where: { organizationId },
      }),
      prisma.waConversation.count({
        where: {
          organizationId,
          status: 'OPEN',
        },
      }),
      prisma.waConversation.count({
        where: {
          organizationId,
          createdAt: { gte: startDate },
        },
      }),
      prisma.waConversation.count({
        where: {
          organizationId,
          status: 'CLOSED',
          updatedAt: { gte: startDate },
        },
      }),
    ]);

    // Get message statistics
    const [
      totalMessages,
      inboundMessages,
      outboundMessages,
      failedMessages,
    ] = await Promise.all([
      prisma.waMessage.count({
        where: {
          conversation: { organizationId },
          createdAt: { gte: startDate },
        },
      }),
      prisma.waMessage.count({
        where: {
          conversation: { organizationId },
          direction: 'INBOUND',
          createdAt: { gte: startDate },
        },
      }),
      prisma.waMessage.count({
        where: {
          conversation: { organizationId },
          direction: 'OUTBOUND',
          createdAt: { gte: startDate },
        },
      }),
      prisma.waMessage.count({
        where: {
          conversation: { organizationId },
          status: 'FAILED',
          createdAt: { gte: startDate },
        },
      }),
    ]);

    // Get message status breakdown
    const [deliveredMessages, readMessages] = await Promise.all([
      prisma.waMessage.count({
        where: {
          conversation: { organizationId },
          direction: 'OUTBOUND',
          status: { in: ['DELIVERED', 'READ'] },
          createdAt: { gte: startDate },
        },
      }),
      prisma.waMessage.count({
        where: {
          conversation: { organizationId },
          direction: 'OUTBOUND',
          status: 'READ',
          createdAt: { gte: startDate },
        },
      }),
    ]);

    // Get template statistics
    const [templateCount, approvedTemplates, templateUsage] = await Promise.all([
      prisma.waTemplate.count({
        where: { organizationId },
      }),
      prisma.waTemplate.count({
        where: { organizationId, status: 'APPROVED' },
      }),
      prisma.waMessage.count({
        where: {
          conversation: { organizationId },
          messageType: 'TEMPLATE',
          createdAt: { gte: startDate },
        },
      }),
    ]);

    // Get media statistics
    const mediaMessages = await prisma.waMessage.count({
      where: {
        conversation: { organizationId },
        messageType: { in: ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'] },
        createdAt: { gte: startDate },
      },
    });

    // Get unread count
    const unreadConversations = await prisma.waConversation.count({
      where: {
        organizationId,
        unreadCount: { gt: 0 },
      },
    });

    // Calculate rates
    const deliveryRate = outboundMessages > 0
      ? Math.round((deliveredMessages / outboundMessages) * 100)
      : 0;
    const readRate = outboundMessages > 0
      ? Math.round((readMessages / outboundMessages) * 100)
      : 0;
    const responseRate = inboundMessages > 0 && outboundMessages > 0
      ? Math.round((outboundMessages / inboundMessages) * 100)
      : 0;

    // Get daily message counts for chart
    const dailyMessages = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT
        DATE("createdAt") as date,
        COUNT(*) as count
      FROM "WaMessage"
      WHERE "conversationId" IN (
        SELECT id FROM "WaConversation" WHERE "organizationId" = ${organizationId}
      )
      AND "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    // Get top templates by usage
    const topTemplates = await prisma.waTemplate.findMany({
      where: { organizationId },
      orderBy: { usageCount: 'desc' },
      take: 5,
      select: {
        name: true,
        usageCount: true,
        lastUsedAt: true,
      },
    });

    // Get response time statistics (average time to first response)
    // This is an approximation based on conversation data

    return NextResponse.json({
      success: true,
      data: {
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        conversations: {
          total: totalConversations,
          active: activeConversations,
          new: newConversations,
          closed: closedConversations,
          unread: unreadConversations,
        },
        messages: {
          total: totalMessages,
          inbound: inboundMessages,
          outbound: outboundMessages,
          failed: failedMessages,
          media: mediaMessages,
          templates: templateUsage,
        },
        rates: {
          delivery: deliveryRate,
          read: readRate,
          response: responseRate,
        },
        templates: {
          total: templateCount,
          approved: approvedTemplates,
          topUsed: topTemplates,
        },
        chart: {
          daily: dailyMessages.map(d => ({
            date: d.date,
            count: Number(d.count),
          })),
        },
      },
    });
  } catch (error) {
    console.error('WhatsApp statistics error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching statistics' },
      { status: 500 }
    );
  }
}
