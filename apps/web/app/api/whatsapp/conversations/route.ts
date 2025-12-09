import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  listConversations,
  ConversationFilter,
} from '@/../../src/integrations/whatsapp/whatsapp.service';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filter = (searchParams.get('filter') || 'all') as ConversationFilter['filter'];

    const conversations = await listConversations(session.organizationId, { filter });

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
