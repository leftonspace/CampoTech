/**
 * WhatsApp Templates Sync API Route
 * Syncs templates from Meta Business API via service layer
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { syncTemplates, listTemplates } from '@/src/integrations/whatsapp/whatsapp.service';

export async function POST() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organizationId = session.organizationId;

    // Sync templates via service layer
    await syncTemplates(organizationId);

    // Get updated template list to return count
    const templates = await listTemplates(organizationId);

    return NextResponse.json({
      success: true,
      data: {
        synced: templates.length,
        templates: templates.map(t => ({
          name: t.name,
          status: t.status,
          category: t.category,
        })),
      },
    });
  } catch (error) {
    console.error('WhatsApp templates sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error syncing templates'
      },
      { status: 500 }
    );
  }
}
