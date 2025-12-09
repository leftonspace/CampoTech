import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getWhatsAppConfig,
  testWhatsAppConnection,
} from '@/../../src/integrations/whatsapp/whatsapp.service';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const config = await getWhatsAppConfig(session.organizationId);

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp not configured' },
        { status: 400 }
      );
    }

    const result = await testWhatsAppConnection(config);

    return NextResponse.json({
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    console.error('WhatsApp test connection error:', error);
    return NextResponse.json(
      { success: false, error: 'Error testing connection' },
      { status: 500 }
    );
  }
}
