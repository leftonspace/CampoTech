/**
 * WhatsApp Stats API Route
 * Returns real-time statistics via service layer
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStats } from '@/src/integrations/whatsapp/whatsapp.service';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organizationId = session.organizationId;

    // Get stats from service layer
    const stats = await getStats(organizationId);

    return NextResponse.json({
      success: true,
      data: {
        conversations: stats.conversations,
        messages: {
          sent: stats.messages.sent24h,
          received: stats.messages.received24h,
          failed: stats.messages.failed24h,
        },
        templates: stats.templates,
        // Legacy format for backwards compatibility
        totalConversations: stats.conversations.total,
        activeConversations: stats.conversations.active,
        inWindowConversations: stats.conversations.inWindow,
        messagesSent: stats.messages.sent24h,
        messagesReceived: stats.messages.received24h,
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

