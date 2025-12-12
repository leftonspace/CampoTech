/**
 * WhatsApp Media API Route
 * =========================
 *
 * Handle media upload and download for WhatsApp messages.
 * GET: Download media by ID
 * POST: Upload new media
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWhatsAppConfig } from '@/src/integrations/whatsapp/whatsapp.service';
import { WhatsAppClient } from '@/src/integrations/whatsapp/client';

/**
 * GET: Download media by ID
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('mediaId');

    if (!mediaId) {
      return NextResponse.json(
        { success: false, error: 'Media ID is required' },
        { status: 400 }
      );
    }

    // Get WhatsApp config
    const config = await getWhatsAppConfig(session.user.organizationId);
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp not configured' },
        { status: 400 }
      );
    }

    const client = WhatsAppClient.fromConfig(config);

    // Get media URL
    const mediaInfo = await client.getMediaUrl(mediaId);

    // Download media
    const mediaBuffer = await client.downloadMedia(mediaInfo.url);

    // Return media with appropriate content type
    return new NextResponse(mediaBuffer, {
      headers: {
        'Content-Type': mediaInfo.mimeType || 'application/octet-stream',
        'Content-Length': String(mediaBuffer.length),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('WhatsApp media download error:', error);
    return NextResponse.json(
      { success: false, error: 'Error downloading media' },
      { status: 500 }
    );
  }
}

/**
 * POST: Upload media to WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get WhatsApp config
    const config = await getWhatsAppConfig(session.user.organizationId);
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp not configured' },
        { status: 400 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File is required' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const client = WhatsAppClient.fromConfig(config);

    // Upload to WhatsApp
    const result = await client.uploadMedia(buffer, file.type, file.name);

    return NextResponse.json({
      success: true,
      data: {
        mediaId: result.id,
        filename: file.name,
        mimeType: file.type,
        size: buffer.length,
      },
    });
  } catch (error) {
    console.error('WhatsApp media upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Error uploading media' },
      { status: 500 }
    );
  }
}
