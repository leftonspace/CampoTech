import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendTemplate } from '@/../../src/integrations/whatsapp/whatsapp.service';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { templateName, phone, params } = body;

    if (!templateName || !phone) {
      return NextResponse.json(
        { success: false, error: 'Template name and phone are required' },
        { status: 400 }
      );
    }

    const result = await sendTemplate(
      session.organizationId,
      phone,
      templateName,
      params || {}
    );

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
    console.error('WhatsApp send template error:', error);
    return NextResponse.json(
      { success: false, error: 'Error sending template' },
      { status: 500 }
    );
  }
}
