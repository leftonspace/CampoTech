/**
 * WhatsApp Send Message API Route
 * ================================
 *
 * Send WhatsApp messages (text, media, templates).
 * POST: Send a new message
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  sendMessage,
  sendTemplate,
  getWhatsAppConfig,
} from '@/src/integrations/whatsapp/whatsapp.service';
import { WhatsAppClient } from '@/src/integrations/whatsapp/client';
import { validateBody } from '@/lib/validation/api-schemas';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate request body
    const body = await request.json();
    const sendMessageSchema = z.object({
      type: z.enum(['text', 'template', 'media']),
      to: z.string().max(20).optional(),
      conversationId: z.string().uuid().optional(),
      text: z.string().max(4096).optional(),
      templateName: z.string().max(100).optional(),
      templateParams: z.record(z.string()).optional(),
      mediaType: z.enum(['image', 'video', 'audio', 'document']).optional(),
      mediaUrl: z.string().url().optional(),
      mediaId: z.string().optional(),
      caption: z.string().max(1024).optional(),
      filename: z.string().max(255).optional(),
    });

    const validation = validateBody(body, sendMessageSchema);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { type, to, conversationId, text, templateName, templateParams } = validation.data;

    // Handle different message types
    switch (type) {
      case 'text': {
        if (!text) {
          return NextResponse.json(
            { success: false, error: 'Text content is required' },
            { status: 400 }
          );
        }

        if (!conversationId) {
          return NextResponse.json(
            { success: false, error: 'Conversation ID is required for text messages' },
            { status: 400 }
          );
        }

        const result = await sendMessage(session.organizationId, conversationId, text);
        return NextResponse.json(result);
      }

      case 'template': {
        if (!templateName || !to) {
          return NextResponse.json(
            { success: false, error: 'Template name and phone number are required' },
            { status: 400 }
          );
        }

        const result = await sendTemplate(
          session.organizationId,
          to,
          templateName,
          templateParams || {}
        );
        return NextResponse.json(result);
      }

      case 'media': {
        const { mediaType, mediaUrl, mediaId, caption, filename } = body;

        if (!mediaType || (!mediaUrl && !mediaId)) {
          return NextResponse.json(
            { success: false, error: 'Media type and URL/ID are required' },
            { status: 400 }
          );
        }

        if (!to) {
          return NextResponse.json(
            { success: false, error: 'Phone number is required' },
            { status: 400 }
          );
        }

        // Get WhatsApp config for direct send
        const config = await getWhatsAppConfig(session.organizationId);
        if (!config) {
          return NextResponse.json(
            { success: false, error: 'WhatsApp not configured' },
            { status: 400 }
          );
        }

        const client = WhatsAppClient.fromConfig(config);
        const mediaSource = mediaId || mediaUrl!;

        const response = await client.sendMediaMessage(
          to,
          mediaType,
          mediaSource,
          { caption, filename }
        );

        return NextResponse.json({
          success: true,
          messageId: response.messages?.[0]?.id,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid message type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error sending message' },
      { status: 500 }
    );
  }
}
