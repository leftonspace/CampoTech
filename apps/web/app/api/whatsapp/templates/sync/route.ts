/**
 * WhatsApp Templates Sync API Route
 * Syncs templates from Meta Business API to local database
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WhatsAppClient } from '@/src/integrations/whatsapp/client';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organizationId = session.user.organizationId;

    // Get organization's WhatsApp config
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
        whatsappBusinessAccountId: true,
      },
    });

    if (!org?.whatsappAccessToken || !org?.whatsappBusinessAccountId) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp Business Account not configured' },
        { status: 400 }
      );
    }

    // Create WhatsApp client
    const client = new WhatsAppClient({
      accessToken: org.whatsappAccessToken,
      phoneNumberId: org.whatsappPhoneNumberId || '',
      businessAccountId: org.whatsappBusinessAccountId,
    });

    // Fetch templates from Meta
    const metaTemplates = await client.getTemplates();

    // Sync each template to database
    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const template of metaTemplates) {
      try {
        // Parse template components
        const headerComponent = template.components?.find(
          (c: any) => c.type === 'HEADER'
        );
        const bodyComponent = template.components?.find(
          (c: any) => c.type === 'BODY'
        );
        const footerComponent = template.components?.find(
          (c: any) => c.type === 'FOOTER'
        );
        const buttonComponent = template.components?.find(
          (c: any) => c.type === 'BUTTONS'
        );

        // Map Meta status to our enum
        const statusMap: Record<string, 'PENDING' | 'APPROVED' | 'REJECTED'> = {
          PENDING: 'PENDING',
          APPROVED: 'APPROVED',
          REJECTED: 'REJECTED',
          PAUSED: 'PENDING',
          DISABLED: 'REJECTED',
        };

        const templateData = {
          waTemplateId: template.id,
          name: template.name,
          language: template.language || 'es_AR',
          category: template.category as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION',
          components: template.components || [],
          headerType: headerComponent?.format || null,
          headerContent: headerComponent?.text || headerComponent?.example?.header_handle?.[0] || null,
          bodyText: bodyComponent?.text || null,
          footerText: footerComponent?.text || null,
          buttons: buttonComponent?.buttons || null,
          status: statusMap[template.status] || 'PENDING',
          rejectionReason: template.rejected_reason || null,
        };

        // Upsert template
        const existing = await prisma.waTemplate.findFirst({
          where: {
            organizationId,
            name: template.name,
            language: templateData.language,
          },
        });

        if (existing) {
          await prisma.waTemplate.update({
            where: { id: existing.id },
            data: templateData,
          });
          results.updated++;
        } else {
          await prisma.waTemplate.create({
            data: {
              ...templateData,
              organizationId,
            },
          });
          results.created++;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        results.errors.push(`${template.name}: ${errorMsg}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        synced: metaTemplates.length,
        created: results.created,
        updated: results.updated,
        errors: results.errors,
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
