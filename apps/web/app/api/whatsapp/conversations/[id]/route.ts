/**
 * WhatsApp Conversation Detail API Route
 * =======================================
 *
 * Get/update a specific conversation.
 * GET: Get conversation details
 * PATCH: Update conversation (assign, close, archive)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getConversation } from '@/src/integrations/whatsapp/whatsapp.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

    const conversation = await getConversation(session.user.organizationId, id);

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error('WhatsApp conversation get error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching conversation' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const { action, assignToId } = body;

    // Verify conversation belongs to organization
    const conversation = await prisma.waConversation.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Handle different actions
    switch (action) {
      case 'assign':
        await prisma.waConversation.update({
          where: { id },
          data: { assignedToId: assignToId || null },
        });
        break;

      case 'close':
        await prisma.waConversation.update({
          where: { id },
          data: { status: 'CLOSED' },
        });
        break;

      case 'reopen':
        await prisma.waConversation.update({
          where: { id },
          data: { status: 'OPEN' },
        });
        break;

      case 'archive':
        await prisma.waConversation.update({
          where: { id },
          data: { status: 'ARCHIVED', isActive: false },
        });
        break;

      case 'spam':
        await prisma.waConversation.update({
          where: { id },
          data: { status: 'SPAM', isActive: false },
        });
        break;

      case 'markRead':
        await prisma.waConversation.update({
          where: { id },
          data: { isUnread: false, unreadCount: 0 },
        });
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Get updated conversation
    const updated = await getConversation(session.user.organizationId, id);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('WhatsApp conversation update error:', error);
    return NextResponse.json(
      { success: false, error: 'Error updating conversation' },
      { status: 500 }
    );
  }
}
