/**
 * WhatsApp Templates API Route
 * List and create message templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WhatsAppClient } from '@/src/integrations/whatsapp/client';
import { listTemplates } from '@/src/integrations/whatsapp/whatsapp.service';

// GET - List templates from service layer
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organizationId = session.organizationId;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    // Get templates from service layer
    const templates = await listTemplates(organizationId);

    // Apply optional client-side filtering
    let filteredTemplates = templates;
    if (status) {
      filteredTemplates = filteredTemplates.filter(t => t.status === status);
    }
    if (category) {
      filteredTemplates = filteredTemplates.filter(t => t.category === category);
    }

    return NextResponse.json({
      success: true,
      data: filteredTemplates,
    });
  } catch (error) {
    console.error('WhatsApp templates list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching templates' },
      { status: 500 }
    );
  }
}

// POST - Create a new template
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

    const { name, language, category, headerType, headerContent, bodyText, footerText, buttons } = body;

    if (!name || !bodyText) {
      return NextResponse.json(
        { success: false, error: 'Name and body text are required' },
        { status: 400 }
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

    if (!org?.whatsappAccessToken || !org?.whatsappBusinessAccountId) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp Business Account not configured' },
        { status: 400 }
      );
    }

    // Build components array for Meta API
    const components: any[] = [];

    // Header component
    if (headerType && headerContent) {
      components.push({
        type: 'HEADER',
        format: headerType,
        ...(headerType === 'TEXT' ? { text: headerContent } : { example: { header_handle: [headerContent] } }),
      });
    }

    // Body component
    components.push({
      type: 'BODY',
      text: bodyText,
    });

    // Footer component
    if (footerText) {
      components.push({
        type: 'FOOTER',
        text: footerText,
      });
    }

    // Buttons component
    if (buttons && buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons,
      });
    }

    // Create template in Meta
    const client = new WhatsAppClient({
      accessToken: org.whatsappAccessToken,
      phoneNumberId: org.whatsappPhoneNumberId || '',
      businessAccountId: org.whatsappBusinessAccountId,
    });

    const metaResult = await client.createTemplate({
      name: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      language: language || 'es_AR',
      category: category || 'UTILITY',
      components,
    });

    // Save to database
    const template = await prisma.waTemplate.create({
      data: {
        organizationId,
        waTemplateId: metaResult.id,
        name: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        language: language || 'es_AR',
        category: category || 'UTILITY',
        components,
        headerType: headerType || null,
        headerContent: headerContent || null,
        bodyText,
        footerText: footerText || null,
        buttons: buttons || null,
        status: 'PENDING', // Templates start as pending until Meta approves
      },
    });

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('WhatsApp template create error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error creating template'
      },
      { status: 500 }
    );
  }
}
