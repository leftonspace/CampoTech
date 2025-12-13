/**
 * Audio Message Handler
 * =====================
 *
 * Phase 9.7: Argentine Communication Localization
 * Handles WhatsApp audio/voice message processing.
 */

import * as https from 'https';
import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { InboundMessage, WhatsAppConfig, WA_API_VERSION } from '../whatsapp.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AudioMessageInfo {
  id: string;
  mimeType: string;
  sha256?: string;
  voice?: boolean;
}

export interface ProcessedAudio {
  id: string;
  organizationId: string;
  messageId: string;
  senderPhone: string;
  senderName?: string;
  mediaId: string;
  mimeType: string;
  mediaUrl?: string;
  duration?: number;
  transcription?: string;
  status: 'received' | 'downloading' | 'downloaded' | 'transcribing' | 'transcribed' | 'failed';
  receivedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract audio info from inbound message
 */
export function extractAudioInfo(message: InboundMessage): AudioMessageInfo | null {
  if (message.type !== 'audio' || !message.audio) {
    return null;
  }

  return {
    id: message.audio.id,
    mimeType: message.audio.mimeType || 'audio/ogg',
    sha256: message.audio.sha256,
    voice: (message.audio as { voice?: boolean }).voice,
  };
}

/**
 * Check if message is a voice message (vs audio file)
 */
export function isVoiceMessage(message: InboundMessage): boolean {
  return message.type === 'audio' && ((message.audio as { voice?: boolean })?.voice === true || false);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA URL RETRIEVAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get media URL from WhatsApp API
 */
export async function getMediaUrl(
  config: WhatsAppConfig,
  mediaId: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const apiVersion = config.apiVersion || WA_API_VERSION;

    const options: https.RequestOptions = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/${apiVersion}/${mediaId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            log.error('Failed to get media URL', {
              mediaId,
              error: parsed.error?.message,
            });
            resolve(null);
            return;
          }
          resolve(parsed.url || null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      log.error('Media URL request error', { mediaId, error: err.message });
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

/**
 * Download media content
 */
export async function downloadMedia(
  mediaUrl: string,
  accessToken: string
): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const url = new URL(mediaUrl);

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      timeout: 60000,
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          log.error('Failed to download media', { statusCode: res.statusCode });
          resolve(null);
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });

    req.on('error', (err) => {
      log.error('Media download error', { error: err.message });
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO PROCESSING PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process incoming audio message
 */
export async function processAudioMessage(
  organizationId: string,
  message: InboundMessage,
  senderName?: string
): Promise<ProcessedAudio> {
  const audioInfo = extractAudioInfo(message);

  if (!audioInfo) {
    throw new Error('Not an audio message');
  }

  // Create initial record
  const audioRecord = await db.audioMessage.create({
    data: {
      organizationId,
      waMessageId: message.id,
      senderPhone: message.from,
      senderName,
      mediaId: audioInfo.id,
      mimeType: audioInfo.mimeType,
      isVoice: audioInfo.voice || false,
      status: 'received',
      receivedAt: new Date(),
    },
  });

  return {
    id: audioRecord.id,
    organizationId,
    messageId: message.id,
    senderPhone: message.from,
    senderName,
    mediaId: audioInfo.id,
    mimeType: audioInfo.mimeType,
    status: 'received',
    receivedAt: new Date(),
  };
}

/**
 * Queue audio for transcription (if enabled)
 */
export async function queueForTranscription(audioId: string): Promise<void> {
  await db.audioMessage.update({
    where: { id: audioId },
    data: { status: 'transcribing' },
  });

  // Note: Actual transcription would be handled by a background worker
  // using services like OpenAI Whisper, Google Speech-to-Text, etc.
  log.info('Audio queued for transcription', { audioId });
}

/**
 * Update audio with transcription result
 */
export async function updateTranscription(
  audioId: string,
  transcription: string,
  duration?: number
): Promise<void> {
  await db.audioMessage.update({
    where: { id: audioId },
    data: {
      transcription,
      duration,
      status: 'transcribed',
      transcribedAt: new Date(),
    },
  });

  log.info('Audio transcription completed', { audioId });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get pending audio messages for review
 */
export async function getPendingAudioMessages(
  organizationId: string,
  limit: number = 20
): Promise<ProcessedAudio[]> {
  const messages = await db.audioMessage.findMany({
    where: {
      organizationId,
      status: { in: ['received', 'downloaded', 'transcribed'] },
      reviewed: false,
    },
    orderBy: { receivedAt: 'desc' },
    take: limit,
  });

  return messages.map((m: typeof messages[number]) => ({
    id: m.id,
    organizationId: m.organizationId,
    messageId: m.waMessageId,
    senderPhone: m.senderPhone,
    senderName: m.senderName || undefined,
    mediaId: m.mediaId,
    mimeType: m.mimeType,
    mediaUrl: m.mediaUrl || undefined,
    duration: m.duration || undefined,
    transcription: m.transcription || undefined,
    status: m.status as ProcessedAudio['status'],
    receivedAt: m.receivedAt,
  }));
}

/**
 * Mark audio as reviewed
 */
export async function markAudioReviewed(
  audioId: string,
  reviewedById: string
): Promise<void> {
  await db.audioMessage.update({
    where: { id: audioId },
    data: {
      reviewed: true,
      reviewedAt: new Date(),
      reviewedById,
    },
  });
}

/**
 * Get audio statistics for organization
 */
export async function getAudioStats(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  total: number;
  transcribed: number;
  pending: number;
  averageDuration: number;
}> {
  const [total, transcribed, pending, avgResult] = await Promise.all([
    db.audioMessage.count({
      where: {
        organizationId,
        receivedAt: { gte: startDate, lte: endDate },
      },
    }),
    db.audioMessage.count({
      where: {
        organizationId,
        receivedAt: { gte: startDate, lte: endDate },
        status: 'transcribed',
      },
    }),
    db.audioMessage.count({
      where: {
        organizationId,
        receivedAt: { gte: startDate, lte: endDate },
        reviewed: false,
      },
    }),
    db.audioMessage.aggregate({
      where: {
        organizationId,
        receivedAt: { gte: startDate, lte: endDate },
        duration: { not: null },
      },
      _avg: { duration: true },
    }),
  ]);

  return {
    total,
    transcribed,
    pending,
    averageDuration: avgResult._avg.duration || 0,
  };
}
