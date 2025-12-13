/**
 * WhatsApp Send Template API Route
 * Send pre-approved template messages
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
    const body = await request.json();

    const { templateName, templateId, phone, parameters, language } = body;

    if ((!templateName && !templateId) || !phone) {
      return NextResponse.json(
        { success: false, error: 'Template name/ID and phone are required' },
        { status: 400 }
      );
    }

    // Get template from database
    const template = await prisma.waTemplate.findFirst({
      where: {
        organizationId,
        ...(templateId ? { id: templateId } : { name: templateName }),
      },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    if (template.status !== 'APPROVED') {
      return NextResponse.json(
        { success: false, error: 'Template is not approved by Meta' },
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

    if (!org?.whatsappAccessToken || !org?.whatsappPhoneNumberId) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp not configured' },
        { status: 400 }
      );
    }

    // Create WhatsApp client
    const client = new WhatsAppClient({
      accessToken: org.whatsappAccessToken,
      phoneNumberId: org.whatsappPhoneNumberId,
      businessAccountId: org.whatsappBusinessAccountId || undefined,
    });

    // Build template components from parameters
    const components = [];

    // Header parameters
    if (parameters?.header && parameters.header.length > 0) {
      components.push({
        type: 'header',
        parameters: parameters.header.map((param: string | { type: string; value: string }) => {
          if (typeof param === 'string') {
            return { type: 'text', text: param };
          }
          // Handle media headers
          if (param.type === 'image') {
            return { type: 'image', image: { link: param.value } };
          }
          if (param.type === 'document') {
            return { type: 'document', document: { link: param.value } };
          }
          if (param.type === 'video') {
            return { type: 'video', video: { link: param.value } };
          }
          return { type: 'text', text: param.value };
        }),
      });
    }

    // Body parameters
    if (parameters?.body && parameters.body.length > 0) {
      components.push({
        type: 'body',
        parameters: parameters.body.map((text: string) => ({
          type: 'text',
          text,
        })),
      });
    }

    // Button parameters
    if (parameters?.buttons && parameters.buttons.length > 0) {
      parameters.buttons.forEach((btn: any, index: number) => {
        components.push({
          type: 'button',
          subType: btn.subType || 'quick_reply',
          index,
          parameters: btn.parameters || [],
        });
      });
    }

    // Send template message
    const result = await client.sendTemplateMessage(
      phone,
      template.name,
      {
        languageCode: language || template.language,
        components: components.length > 0 ? components : undefined,
      }
    );

    // Find or create conversation
    let conversation = await prisma.waConversation.findFirst({
      where: {
        organizationId,
        customerPhone: phone,
      },
    });

    if (!conversation) {
      conversation = await prisma.waConversation.create({
        data: {
          organizationId,
          customerPhone: phone,
          waId: phone.replace(/\D/g, ''),
          status: 'OPEN',
        },
      });
    }

    // Store message
    const messageId = result.messages?.[0]?.id;
    const message = await prisma.waMessage.create({
      data: {
        conversationId: conversation.id,
        waMessageId: messageId,
        direction: 'OUTBOUND',
        messageType: 'TEMPLATE',
        content: template.bodyText || template.name,
        templateName: template.name,
        templateParams: parameters,
        status: 'SENT',
      },
    });

    // Update conversation
    await prisma.waConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: `[Template] ${template.name}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Update template usage
    await prisma.waTemplate.update({
      where: { id: template.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        messageId: message.id,
        waMessageId: messageId,
        conversationId: conversation.id,
        templateName: template.name,
      },
    });
  } catch (error) {
    console.error('WhatsApp send template error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error sending template',
      },
      { status: 500 }
    );
  }
}
