/**
 * WhatsApp Stats API Route
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
    const period = searchParams.get('period') || '7d';

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
    ]);

    // Get message statistics
    const [
      totalMessages,
      messagesSent,
      messagesReceived,
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
          direction: 'OUTBOUND',
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
          status: 'FAILED',
          createdAt: { gte: startDate },
        },
      }),
    ]);

    // Get template usage
    const templatesUsed = await prisma.waMessage.count({
      where: {
        conversation: { organizationId },
        messageType: 'TEMPLATE',
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
    const deliveredMessages = await prisma.waMessage.count({
      where: {
        conversation: { organizationId },
        direction: 'OUTBOUND',
        status: { in: ['DELIVERED', 'READ'] },
        createdAt: { gte: startDate },
      },
    });

    const readMessages = await prisma.waMessage.count({
      where: {
        conversation: { organizationId },
        direction: 'OUTBOUND',
        status: 'READ',
        createdAt: { gte: startDate },
      },
    });

    const deliveryRate = messagesSent > 0
      ? Math.round((deliveredMessages / messagesSent) * 100)
      : 0;
    const readRate = messagesSent > 0
      ? Math.round((readMessages / messagesSent) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        period,
        conversations: {
          total: totalConversations,
          active: activeConversations,
          new: newConversations,
          unread: unreadConversations,
        },
        messages: {
          total: totalMessages,
          sent: messagesSent,
          received: messagesReceived,
          failed: failedMessages,
          templates: templatesUsed,
        },
        rates: {
          delivery: deliveryRate,
          read: readRate,
        },
        // Legacy format for backwards compatibility
        totalConversations,
        activeConversations,
        messagesSent,
        messagesReceived,
        templatesUsed,
      },
    });
  } catch (error) {
    console.error('WhatsApp stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching stats' },
      { status: 500 }
    );
  }
}
