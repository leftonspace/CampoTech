/**
 * WhatsApp Media Handler
 * ======================
 *
 * Handles media upload, download, and sending via WhatsApp Business API.
 */

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import {
  WhatsAppConfig,
  SendMessageRequest,
  SendMessageResponse,
  MediaUploadResponse,
  MediaUrlResponse,
  OutboundMedia,
  WAError,
  WA_API_BASE_URL,
  WA_API_VERSION,
} from '../whatsapp.types';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA DOWNLOAD
// ═══════════════════════════════════════════════════════════════════════════════

export interface MediaDownloadResult {
  success: true;
  data: Buffer;
  mimeType: string;
  filename?: string;
}

export interface MediaDownloadError {
  success: false;
  error: string;
}

/**
 * Get media URL from media ID
 */
export async function getMediaUrl(
  config: WhatsAppConfig,
  mediaId: string
): Promise<{ success: true; url: string; mimeType: string } | MediaDownloadError> {
  try {
    const response = await makeApiRequest<MediaUrlResponse>(
      config,
      'GET',
      `/${mediaId}`
    );

    return {
      success: true,
      url: response.url,
      mimeType: response.mimeType,
    };
  } catch (error) {
    const waError = error as WAError;
    log.error('Failed to get media URL', { mediaId, error: waError.message });
    return {
      success: false,
      error: waError.message || 'Failed to get media URL',
    };
  }
}

/**
 * Download media from WhatsApp
 */
export async function downloadMedia(
  config: WhatsAppConfig,
  mediaId: string
): Promise<MediaDownloadResult | MediaDownloadError> {
  // First get the media URL
  const urlResult = await getMediaUrl(config, mediaId);
  if (!urlResult.success) {
    return urlResult;
  }

  try {
    const data = await downloadFromUrl(urlResult.url, config.accessToken);

    return {
      success: true,
      data,
      mimeType: urlResult.mimeType,
    };
  } catch (error) {
    log.error('Failed to download media', {
      mediaId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download failed',
    };
  }
}

/**
 * Download media and save to file
 */
export async function downloadMediaToFile(
  config: WhatsAppConfig,
  mediaId: string,
  outputDir: string,
  filename?: string
): Promise<{ success: true; filePath: string; mimeType: string } | MediaDownloadError> {
  const result = await downloadMedia(config, mediaId);
  if (!result.success) {
    return result;
  }

  // Determine extension from mime type
  const ext = getExtensionFromMimeType(result.mimeType);
  const finalFilename = filename || `${mediaId}${ext}`;
  const filePath = path.join(outputDir, finalFilename);

  try {
    await fs.promises.mkdir(outputDir, { recursive: true });
    await fs.promises.writeFile(filePath, result.data);

    return {
      success: true,
      filePath,
      mimeType: result.mimeType,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save file',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA UPLOAD
// ═══════════════════════════════════════════════════════════════════════════════

export interface MediaUploadResult {
  success: true;
  mediaId: string;
}

/**
 * Upload media to WhatsApp (for sending)
 */
export async function uploadMedia(
  config: WhatsAppConfig,
  filePath: string,
  mimeType: string
): Promise<MediaUploadResult | MediaDownloadError> {
  try {
    const fileBuffer = await fs.promises.readFile(filePath);
    const filename = path.basename(filePath);

    const response = await uploadMediaBuffer(
      config,
      fileBuffer,
      filename,
      mimeType
    );

    return {
      success: true,
      mediaId: response.id,
    };
  } catch (error) {
    log.error('Failed to upload media', {
      filePath,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

async function uploadMediaBuffer(
  config: WhatsAppConfig,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<MediaUploadResponse> {
  return new Promise((resolve, reject) => {
    const boundary = `----WebKitFormBoundary${Date.now()}`;
    const apiVersion = config.apiVersion || WA_API_VERSION;

    // Build multipart form data
    const formData = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="messaging_product"\r\n\r\n` +
        `whatsapp\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`
      ),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const options: https.RequestOptions = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/${apiVersion}/${config.phoneNumberId}/media`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': formData.length.toString(),
      },
      timeout: 60000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject({
              code: parsed.error?.code || res.statusCode,
              message: parsed.error?.message || 'Upload failed',
            });
            return;
          }
          resolve(parsed);
        } catch {
          reject({ code: 0, message: `Failed to parse response: ${data}` });
        }
      });
    });

    req.on('error', (err) => reject({ code: 0, message: err.message }));
    req.on('timeout', () => {
      req.destroy();
      reject({ code: 0, message: 'Upload timeout' });
    });

    req.write(formData);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND MEDIA MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SendMediaResult {
  success: true;
  messageId: string;
  waId: string;
}

export interface SendMediaError {
  success: false;
  error: string;
  code?: number;
}

/**
 * Send an image message
 */
export async function sendImageMessage(
  config: WhatsAppConfig,
  to: string,
  media: { id?: string; link?: string },
  caption?: string
): Promise<SendMediaResult | SendMediaError> {
  return sendMediaMessage(config, to, 'image', { ...media, caption });
}

/**
 * Send a document message
 */
export async function sendDocumentMessage(
  config: WhatsAppConfig,
  to: string,
  media: { id?: string; link?: string; filename?: string },
  caption?: string
): Promise<SendMediaResult | SendMediaError> {
  return sendMediaMessage(config, to, 'document', { ...media, caption });
}

/**
 * Send an audio message
 */
export async function sendAudioMessage(
  config: WhatsAppConfig,
  to: string,
  media: { id?: string; link?: string }
): Promise<SendMediaResult | SendMediaError> {
  return sendMediaMessage(config, to, 'audio', media);
}

/**
 * Send a video message
 */
export async function sendVideoMessage(
  config: WhatsAppConfig,
  to: string,
  media: { id?: string; link?: string },
  caption?: string
): Promise<SendMediaResult | SendMediaError> {
  return sendMediaMessage(config, to, 'video', { ...media, caption });
}

async function sendMediaMessage(
  config: WhatsAppConfig,
  to: string,
  type: 'image' | 'document' | 'audio' | 'video',
  media: OutboundMedia
): Promise<SendMediaResult | SendMediaError> {
  const request: SendMessageRequest = {
    messagingProduct: 'whatsapp',
    recipientType: 'individual',
    to: normalizePhoneNumber(to),
    type,
    [type]: media,
  };

  try {
    const response = await makeApiRequest<SendMessageResponse>(
      config,
      'POST',
      `/${config.phoneNumberId}/messages`,
      request
    );

    if (response.messages?.[0]?.id) {
      return {
        success: true,
        messageId: response.messages[0].id,
        waId: response.contacts?.[0]?.waId || to,
      };
    }

    return {
      success: false,
      error: 'No message ID in response',
    };
  } catch (error) {
    const waError = error as WAError;
    return {
      success: false,
      error: waError.message || 'Failed to send media',
      code: waError.code,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function normalizePhoneNumber(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (!digits.startsWith('54') && digits.length === 10) {
    digits = '54' + digits;
  }
  if (digits.startsWith('54') && !digits.startsWith('549') && digits.length === 12) {
    digits = '549' + digits.slice(2);
  }
  return digits;
}

function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/amr': '.amr',
    'audio/aac': '.aac',
    'video/mp4': '.mp4',
    'video/3gpp': '.3gp',
    'application/pdf': '.pdf',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };

  return mimeToExt[mimeType] || '';
}

async function downloadFromUrl(url: string, accessToken: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
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
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Download timeout'));
    });

    req.end();
  });
}

async function makeApiRequest<T>(
  config: WhatsAppConfig,
  method: 'POST' | 'GET',
  path: string,
  body?: object
): Promise<T> {
  return new Promise((resolve, reject) => {
    const apiVersion = config.apiVersion || WA_API_VERSION;
    const url = new URL(`${WA_API_BASE_URL}/${apiVersion}${path}`);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    };

    const bodyString = body ? JSON.stringify(body) : undefined;
    if (bodyString) {
      headers['Content-Length'] = Buffer.byteLength(bodyString).toString();
    }

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers,
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject({
              code: parsed.error?.code || res.statusCode,
              message: parsed.error?.message || 'API request failed',
            });
            return;
          }
          resolve(parsed);
        } catch {
          reject({ code: 0, message: `Failed to parse response: ${data}` });
        }
      });
    });

    req.on('error', (err) => reject({ code: 0, message: err.message }));
    req.on('timeout', () => {
      req.destroy();
      reject({ code: 0, message: 'Request timeout' });
    });

    if (bodyString) {
      req.write(bodyString);
    }
    req.end();
  });
}
