import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  listMessages,
  sendMessage,
} from '@/../../src/integrations/whatsapp/whatsapp.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before') || undefined;

    const messages = await listMessages(
      session.organizationId,
      params.id,
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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { text } = body;

    if (!text?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message text is required' },
        { status: 400 }
      );
    }

    const result = await sendMessage(session.organizationId, params.id, text);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { messageId: result.messageId },
    });
  } catch (error) {
    console.error('WhatsApp send message error:', error);
    return NextResponse.json(
      { success: false, error: 'Error sending message' },
      { status: 500 }
    );
  }
}
