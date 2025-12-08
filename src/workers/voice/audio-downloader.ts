/**
 * Audio Downloader
 * ================
 *
 * Download audio from WhatsApp Media API
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DownloadResult {
  filePath: string;
  mimeType: string;
  size: number;
  tempFile: boolean;
}

export interface WhatsAppMediaInfo {
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNLOADER
// ═══════════════════════════════════════════════════════════════════════════════

export class AudioDownloader {
  private accessToken: string;
  private tempDir: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.tempDir = path.join(os.tmpdir(), 'campotech-voice');
  }

  /**
   * Download audio from WhatsApp media ID
   */
  async downloadFromMediaId(mediaId: string): Promise<DownloadResult> {
    // Step 1: Get media URL from WhatsApp API
    const mediaInfo = await this.getMediaInfo(mediaId);

    // Step 2: Download the actual file
    return this.downloadFromUrl(mediaInfo.url, mediaInfo.mime_type);
  }

  /**
   * Download audio from direct URL
   */
  async downloadFromUrl(url: string, mimeType?: string): Promise<DownloadResult> {
    await this.ensureTempDir();

    const ext = this.getExtension(mimeType || 'audio/ogg');
    const filePath = path.join(this.tempDir, `${uuidv4()}.${ext}`);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        });

        if (!response.ok) {
          throw new DownloadError(
            `Download failed: ${response.status} ${response.statusText}`
          );
        }

        // Get actual content type from response
        const contentType = response.headers.get('content-type') || mimeType || 'audio/ogg';
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

        // Stream to file
        const arrayBuffer = await response.arrayBuffer();
        await fs.writeFile(filePath, Buffer.from(arrayBuffer));

        // Verify file was written
        const stats = await fs.stat(filePath);

        return {
          filePath,
          mimeType: contentType,
          size: stats.size,
          tempFile: true,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < MAX_RETRIES) {
          console.warn(`[Audio Downloader] Attempt ${attempt} failed, retrying...`);
          await this.delay(RETRY_DELAY * attempt);
        }
      }
    }

    throw new DownloadError(
      `Failed to download after ${MAX_RETRIES} attempts: ${lastError?.message}`
    );
  }

  /**
   * Get media info from WhatsApp API
   */
  async getMediaInfo(mediaId: string): Promise<WhatsAppMediaInfo> {
    const response = await this.fetchWithTimeout(
      `${WHATSAPP_API_URL}/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new DownloadError(
        `Failed to get media info: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    return {
      url: data.url,
      mime_type: data.mime_type,
      sha256: data.sha256,
      file_size: data.file_size,
    };
  }

  /**
   * Clean up downloaded file
   */
  async cleanup(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Clean up all temp files
   */
  async cleanupAll(): Promise<number> {
    try {
      const files = await fs.readdir(this.tempDir);
      let count = 0;

      for (const file of files) {
        try {
          await fs.unlink(path.join(this.tempDir, file));
          count++;
        } catch {
          // Ignore individual file errors
        }
      }

      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Get temp directory size
   */
  async getTempDirSize(): Promise<number> {
    try {
      const files = await fs.readdir(this.tempDir);
      let totalSize = 0;

      for (const file of files) {
        const stats = await fs.stat(path.join(this.tempDir, file));
        totalSize += stats.size;
      }

      return totalSize;
    } catch {
      return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private getExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'audio/ogg': 'ogg',
      'audio/opus': 'opus',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'mp4',
      'audio/m4a': 'm4a',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'audio/x-opus+ogg': 'opus',
    };

    return extensions[mimeType] || 'ogg';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class DownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DownloadError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let audioDownloader: AudioDownloader | null = null;

export function getAudioDownloader(): AudioDownloader {
  if (!audioDownloader) {
    audioDownloader = new AudioDownloader();
  }
  return audioDownloader;
}
