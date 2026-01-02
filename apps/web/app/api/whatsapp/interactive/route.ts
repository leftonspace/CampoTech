/**
 * WhatsApp Interactive Messages API Route
 * Send button and list messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WhatsAppClient } from '@/src/integrations/whatsapp/client';

interface InteractiveButton {
  id: string;
  title: string;
}

interface ListRow {
  id: string;
  title: string;
  description?: string;
}

interface ListSection {
  title: string;
  rows: ListRow[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organizationId = session.organizationId;
    const body = await request.json();

    const {
      type,
      phone,
      conversationId,
      bodyText,
      headerText,
      footerText,
      buttons,
      buttonText,
      sections,
    } = body;

    if (!type || !phone || !bodyText) {
      return NextResponse.json(
        { success: false, error: 'Type, phone, and body text are required' },
        { status: 400 }
      );
    }

    if (type === 'button' && (!buttons || buttons.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Buttons are required for button type' },
        { status: 400 }
      );
    }

    if (type === 'list' && (!sections || sections.length === 0 || !buttonText)) {
      return NextResponse.json(
        { success: false, error: 'Sections and button text are required for list type' },
        { status: 400 }
      );
    }

    // Get organization's WhatsApp config
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
        whatsappBusinessAccountId: true,
      },
    });

    if (!org?.whatsappAccessToken || !org?.whatsappPhoneNumberId) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp not configured' },
        { status: 400 }
      );
    }

    // Create WhatsApp client
    const client = new WhatsAppClient({
      accessToken: org.whatsappAccessToken,
      phoneNumberId: org.whatsappPhoneNumberId,
      businessAccountId: org.whatsappBusinessAccountId || undefined,
    });

    let result;

    if (type === 'button') {
      // Send button message
      if (buttons.length > 3) {
        return NextResponse.json(
          { success: false, error: 'Maximum 3 buttons allowed' },
          { status: 400 }
        );
      }

      result = await client.sendButtonMessage(
        phone,
        bodyText,
        (buttons as InteractiveButton[]).map((btn) => ({
          id: btn.id,
          title: btn.title.substring(0, 20), // Max 20 chars
        })),
        {
          headerText,
          footerText,
        }
      );
    } else if (type === 'list') {
      // Validate total rows
      const totalRows = (sections as ListSection[]).reduce(
        (sum, s) => sum + (s.rows?.length || 0),
        0
      );
      if (totalRows > 10) {
        return NextResponse.json(
          { success: false, error: 'Maximum 10 total rows allowed' },
          { status: 400 }
        );
      }

      result = await client.sendListMessage(
        phone,
        bodyText,
        buttonText,
        (sections as ListSection[]).map((section) => ({
          title: section.title,
          rows: section.rows.map((row) => ({
            id: row.id,
            title: row.title.substring(0, 24), // Max 24 chars
            description: row.description?.substring(0, 72), // Max 72 chars
          })),
        })),
        {
          headerText,
          footerText,
        }
      );
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "button" or "list"' },
        { status: 400 }
      );
    }

    // Find or create conversation
    let conversation = await prisma.waConversation.findFirst({
      where: {
        organizationId,
        customerPhone: phone,
      },
    });

    if (!conversation) {
      conversation = await prisma.waConversation.create({
        data: {
          organizationId,
          customerPhone: phone,
          customerName: 'Unknown',
          lastMessageAt: new Date(),
        },
      });
    }

    // Store message
    const messageId = result.messages?.[0]?.id;
    const message = await prisma.waMessage.create({
      data: {
        organizationId,
        conversationId: conversation.id,
        waMessageId: messageId,
        direction: 'outbound',
        type: 'interactive',
        from: org.whatsappPhoneNumberId,
        to: phone,
        content: bodyText,
        metadata: {
          interactiveType: type,
          headerText,
          footerText,
          ...(type === 'button' ? { buttons } : { buttonText, sections }),
        },
        status: 'sent',
      },
    });

    // Update conversation
    await prisma.waConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: `[${type === 'button' ? 'Botones' : 'Lista'}] ${bodyText.substring(0, 50)}`,
        windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        messageId: message.id,
        waMessageId: messageId,
        conversationId: conversation.id,
      },
    });
  } catch (error) {
    console.error('WhatsApp interactive message error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error sending interactive message',
      },
      { status: 500 }
    );
  }
}
