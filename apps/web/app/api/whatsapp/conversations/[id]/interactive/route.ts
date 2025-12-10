import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  sendInteractiveButtonMessage,
  sendInteractiveListMessage,
} from '@/../../src/integrations/whatsapp/whatsapp.service';

/**
 * POST /api/whatsapp/conversations/:id/interactive
 *
 * Send interactive messages (buttons or lists) within a conversation.
 * Only works within the 24-hour customer service window.
 */
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
    const { type, bodyText, buttons, buttonText, sections, headerText, footerText } = body;

    if (!type || !['button', 'list'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "button" or "list"' },
        { status: 400 }
      );
    }

    if (!bodyText?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Body text is required' },
        { status: 400 }
      );
    }

    let result;

    if (type === 'button') {
      // Validate buttons
      if (!buttons || !Array.isArray(buttons) || buttons.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Buttons array is required for button type' },
          { status: 400 }
        );
      }

      if (buttons.length > 3) {
        return NextResponse.json(
          { success: false, error: 'Maximum 3 buttons allowed' },
          { status: 400 }
        );
      }

      // Validate each button
      for (const btn of buttons) {
        if (!btn.id || !btn.title) {
          return NextResponse.json(
            { success: false, error: 'Each button must have id and title' },
            { status: 400 }
          );
        }
        if (btn.title.length > 20) {
          return NextResponse.json(
            { success: false, error: 'Button title must be 20 characters or less' },
            { status: 400 }
          );
        }
      }

      result = await sendInteractiveButtonMessage(
        session.organizationId,
        params.id,
        bodyText,
        buttons,
        { headerText, footerText }
      );
    } else {
      // type === 'list'
      if (!buttonText?.trim()) {
        return NextResponse.json(
          { success: false, error: 'Button text is required for list type' },
          { status: 400 }
        );
      }

      if (!sections || !Array.isArray(sections) || sections.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Sections array is required for list type' },
          { status: 400 }
        );
      }

      // Validate sections
      let totalRows = 0;
      for (const section of sections) {
        if (!section.rows || !Array.isArray(section.rows)) {
          return NextResponse.json(
            { success: false, error: 'Each section must have a rows array' },
            { status: 400 }
          );
        }

        for (const row of section.rows) {
          if (!row.id || !row.title) {
            return NextResponse.json(
              { success: false, error: 'Each row must have id and title' },
              { status: 400 }
            );
          }
          if (row.title.length > 24) {
            return NextResponse.json(
              { success: false, error: 'Row title must be 24 characters or less' },
              { status: 400 }
            );
          }
          if (row.description && row.description.length > 72) {
            return NextResponse.json(
              { success: false, error: 'Row description must be 72 characters or less' },
              { status: 400 }
            );
          }
          totalRows++;
        }
      }

      if (totalRows > 10) {
        return NextResponse.json(
          { success: false, error: 'Maximum 10 total rows allowed across all sections' },
          { status: 400 }
        );
      }

      result = await sendInteractiveListMessage(
        session.organizationId,
        params.id,
        bodyText,
        buttonText,
        sections,
        { headerText, footerText }
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
      data: { messageId: result.messageId },
    });
  } catch (error) {
    console.error('WhatsApp interactive message error:', error);
    return NextResponse.json(
      { success: false, error: 'Error sending interactive message' },
      { status: 500 }
    );
  }
}
