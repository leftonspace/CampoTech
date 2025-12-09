import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getWhatsAppConfig,
  saveWhatsAppConfig,
} from '@/../../src/integrations/whatsapp/whatsapp.service';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const config = await getWhatsAppConfig(session.organizationId);

    // Return masked config (don't expose tokens)
    return NextResponse.json({
      success: true,
      data: config ? {
        phoneNumberId: config.phoneNumberId,
        businessAccountId: config.businessAccountId,
        hasAccessToken: !!config.accessToken,
        hasAppSecret: !!config.appSecret,
        webhookVerifyToken: config.webhookVerifyToken,
        isConfigured: !!(config.phoneNumberId && config.accessToken),
      } : {
        isConfigured: false,
      },
    });
  } catch (error) {
    console.error('WhatsApp settings get error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check admin permissions
    if (session.role !== 'owner' && session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      phoneNumberId,
      businessAccountId,
      accessToken,
      webhookVerifyToken,
      appSecret,
    } = body;

    await saveWhatsAppConfig(session.organizationId, {
      phoneNumberId,
      businessAccountId,
      accessToken,
      webhookVerifyToken,
      appSecret,
    });

    return NextResponse.json({
      success: true,
      message: 'WhatsApp settings saved',
    });
  } catch (error) {
    console.error('WhatsApp settings save error:', error);
    return NextResponse.json(
      { success: false, error: 'Error saving settings' },
      { status: 500 }
    );
  }
}
