/**
 * WhatsApp Interactive Messages API Route
 * Send button and list messages via service layer
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  sendInteractiveButtonMessage,
  sendInteractiveListMessage,
} from '@/src/integrations/whatsapp/whatsapp.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/whatsapp/conversations/:id/interactive
 * Send interactive messages (buttons or lists) within a conversation
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id: conversationId } = await params;

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
      bodyText,
      headerText,
      footerText,
      buttons,
      buttonText,
      sections,
    } = body;

    if (!type || !bodyText) {
      return NextResponse.json(
        { success: false, error: 'Type and body text are required' },
        { status: 400 }
      );
    }

    let result;

    if (type === 'button') {
      // Validate buttons
      if (!buttons || buttons.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Buttons are required for button type' },
          { status: 400 }
        );
      }

      if (buttons.length > 3) {
        return NextResponse.json(
          { success: false, error: 'Maximum 3 buttons allowed' },
          { status: 400 }
        );
      }

      // Send button message via service layer
      result = await sendInteractiveButtonMessage(
        organizationId,
        conversationId,
        bodyText,
        buttons.map((btn: any) => ({
          id: btn.id,
          title: btn.title.substring(0, 20), // Max 20 chars
        })),
        { headerText, footerText }
      );
    } else if (type === 'list') {
      // Validate list
      if (!sections || sections.length === 0 || !buttonText) {
        return NextResponse.json(
          { success: false, error: 'Sections and button text are required for list type' },
          { status: 400 }
        );
      }

      // Validate total rows
      const totalRows = sections.reduce(
        (sum: number, s: any) => sum + (s.rows?.length || 0),
        0
      );
      if (totalRows > 10) {
        return NextResponse.json(
          { success: false, error: 'Maximum 10 total rows allowed' },
          { status: 400 }
        );
      }

      // Send list message via service layer
      result = await sendInteractiveListMessage(
        organizationId,
        conversationId,
        bodyText,
        buttonText,
        sections.map((section: any) => ({
          title: section.title,
          rows: section.rows.map((row: any) => ({
            id: row.id,
            title: row.title.substring(0, 24), // Max 24 chars
            description: row.description?.substring(0, 72), // Max 72 chars
          })),
        })),
        { headerText, footerText }
      );
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "button" or "list"' },
        { status: 400 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        messageId: result.messageId,
        conversationId,
        type,
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
