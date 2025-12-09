import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listTemplates } from '@/../../src/integrations/whatsapp/whatsapp.service';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const templates = await listTemplates(session.organizationId);

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('WhatsApp templates list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching templates' },
      { status: 500 }
    );
  }
}
