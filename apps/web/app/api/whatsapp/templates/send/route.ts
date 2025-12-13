/**
 * WhatsApp Send Template API Route
 * Send pre-approved template messages via service layer
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendTemplate } from '@/src/integrations/whatsapp/whatsapp.service';

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

    const { templateName, phone, parameters } = body;

    if (!templateName || !phone) {
      return NextResponse.json(
        { success: false, error: 'Template name and phone are required' },
        { status: 400 }
      );
    }

    // Convert parameters to flat record format expected by service
    const params: Record<string, string> = {};
    if (parameters?.body) {
      parameters.body.forEach((value: string, index: number) => {
        params[`body_${index + 1}`] = value;
      });
    }
    if (parameters?.header) {
      parameters.header.forEach((value: string | { value: string }, index: number) => {
        params[`header_${index + 1}`] = typeof value === 'string' ? value : value.value;
      });
    }

    // Send template via service layer
    const result = await sendTemplate(
      organizationId,
      phone,
      templateName,
      params
    );

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
        templateName,
      },
    });
  } catch (error) {
    console.error('WhatsApp send template error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error sending template',
      },
      { status: 500 }
    );
  }
}
