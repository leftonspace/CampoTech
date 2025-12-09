import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStats } from '@/../../src/integrations/whatsapp/whatsapp.service';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const stats = await getStats(session.organizationId);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('WhatsApp stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching stats' },
      { status: 500 }
    );
  }
}
