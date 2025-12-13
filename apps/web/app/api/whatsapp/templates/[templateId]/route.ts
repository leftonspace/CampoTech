/**
 * WhatsApp Individual Template API Route
 * Get, update, and delete specific templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WhatsAppClient } from '@/src/integrations/whatsapp/client';

interface RouteParams {
  params: Promise<{ templateId: string }>;
}

// GET - Get template by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { templateId } = await params;
    const organizationId = session.user.organizationId;

    const template = await prisma.waTemplate.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('WhatsApp template get error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching template' },
      { status: 500 }
    );
  }
}

// PATCH - Update template (local only, cannot update Meta template after submission)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { templateId } = await params;
    const organizationId = session.user.organizationId;
    const body = await request.json();

    // Only allow updating certain fields locally
    const { usageCount, lastUsedAt } = body;

    const template = await prisma.waTemplate.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (usageCount !== undefined) updateData.usageCount = usageCount;
    if (lastUsedAt !== undefined) updateData.lastUsedAt = new Date(lastUsedAt);

    const updated = await prisma.waTemplate.update({
      where: { id: templateId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('WhatsApp template update error:', error);
    return NextResponse.json(
      { success: false, error: 'Error updating template' },
      { status: 500 }
    );
  }
}

// DELETE - Delete template from Meta and database
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { templateId } = await params;
    const organizationId = session.user.organizationId;

    const template = await prisma.waTemplate.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Get organization's WhatsApp config
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
        whatsappBusinessAccountId: true,
      },
    });

    // Try to delete from Meta if config exists
    if (org?.whatsappAccessToken && org?.whatsappBusinessAccountId) {
      try {
        const client = new WhatsAppClient({
          accessToken: org.whatsappAccessToken,
          phoneNumberId: org.whatsappPhoneNumberId || '',
          businessAccountId: org.whatsappBusinessAccountId,
        });

        await client.deleteTemplate(template.name);
      } catch (metaError) {
        // Log but continue - template might not exist in Meta
        console.warn('Could not delete template from Meta:', metaError);
      }
    }

    // Delete from database
    await prisma.waTemplate.delete({
      where: { id: templateId },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error('WhatsApp template delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Error deleting template' },
      { status: 500 }
    );
  }
}
