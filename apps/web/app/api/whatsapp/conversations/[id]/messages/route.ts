/**
 * WhatsApp Messages API Route
 * ============================
 *
 * Get and send messages in a conversation.
 * GET: List messages with pagination
 * POST: Send a new message
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listMessages, sendMessage } from '@/src/integrations/whatsapp/whatsapp.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET: List messages in conversation
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const before = searchParams.get('before') || undefined;

    const messages = await listMessages(
      session.organizationId,
      id,
      limit,
      before
    );

    return NextResponse.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('WhatsApp messages list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching messages' },
      { status: 500 }
    );
  }
}

/**
 * POST: Send a new message
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { text, type = 'text' } = body;

    if (!text && type === 'text') {
      return NextResponse.json(
        { success: false, error: 'Message text is required' },
        { status: 400 }
      );
    }

    const result = await sendMessage(
      session.organizationId,
      id,
      text
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('WhatsApp send message error:', error);
    return NextResponse.json(
      { success: false, error: 'Error sending message' },
      { status: 500 }
    );
  }
}
