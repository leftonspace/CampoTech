import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { syncTemplates } from '@/../../src/integrations/whatsapp/whatsapp.service';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await syncTemplates(session.organizationId);

    return NextResponse.json({
      success: true,
      message: 'Templates synced successfully',
    });
  } catch (error) {
    console.error('WhatsApp templates sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Error syncing templates' },
      { status: 500 }
    );
  }
}
