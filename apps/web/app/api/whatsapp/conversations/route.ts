/**
 * WhatsApp Conversations API Route
 * =================================
 *
 * List and manage WhatsApp conversations.
 * GET: List conversations with filtering and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listConversations, ConversationFilter } from '@/src/integrations/whatsapp/whatsapp.service';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') as ConversationFilter['filter'] || 'all';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const conversations = await listConversations(session.user.organizationId, {
      filter,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error('WhatsApp conversations list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching conversations' },
      { status: 500 }
    );
  }
}
