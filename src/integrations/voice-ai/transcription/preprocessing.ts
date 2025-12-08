/**
 * Audio Preprocessing
 * ===================
 *
 * Audio preprocessing utilities for optimal transcription
 */

import { createWriteStream, createReadStream, promises as fs } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const SUPPORTED_FORMATS = ['mp3', 'mp4', 'm4a', 'mpeg', 'mpga', 'wav', 'webm', 'ogg', 'opus'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (Whisper limit)
const MIN_DURATION = 0.5; // 500ms minimum
const MAX_DURATION = 120; // 2 minutes maximum for processing

// ═══════════════════════════════════════════════════════════════════════════════
// PREPROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

export interface AudioMetadata {
  format: string;
  size: number;
  duration?: number;
  sampleRate?: number;
  channels?: number;
  bitrate?: number;
}

export interface PreprocessingResult {
  filePath: string;
  originalFormat: string;
  processedFormat: string;
  metadata: AudioMetadata;
  tempFile: boolean;
}

/**
 * Preprocess audio for Whisper transcription
 */
export async function preprocessAudio(
  inputPath: string
): Promise<PreprocessingResult> {
  // Get file stats
  const stats = await fs.stat(inputPath);
  const ext = path.extname(inputPath).toLowerCase().replace('.', '');

  // Validate file size
  if (stats.size > MAX_FILE_SIZE) {
    throw new PreprocessingError(
      `Audio file too large: ${formatBytes(stats.size)}. Maximum is ${formatBytes(MAX_FILE_SIZE)}`
    );
  }

  // Validate format
  if (!SUPPORTED_FORMATS.includes(ext)) {
    throw new PreprocessingError(
      `Unsupported audio format: ${ext}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`
    );
  }

  // For WhatsApp voice messages (opus/ogg), we can pass directly
  // Whisper handles these formats well
  const metadata: AudioMetadata = {
    format: ext,
    size: stats.size,
  };

  return {
    filePath: inputPath,
    originalFormat: ext,
    processedFormat: ext,
    metadata,
    tempFile: false,
  };
}

/**
 * Preprocess audio from buffer
 */
export async function preprocessAudioBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<PreprocessingResult> {
  // Validate size
  if (buffer.length > MAX_FILE_SIZE) {
    throw new PreprocessingError(
      `Audio buffer too large: ${formatBytes(buffer.length)}. Maximum is ${formatBytes(MAX_FILE_SIZE)}`
    );
  }

  // Determine format from MIME type
  const format = mimeTypeToFormat(mimeType);

  if (!SUPPORTED_FORMATS.includes(format)) {
    throw new PreprocessingError(
      `Unsupported audio format: ${format}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`
    );
  }

  // Write buffer to temp file
  const tempDir = await getTempDir();
  const tempPath = path.join(tempDir, `${uuidv4()}.${format}`);

  await fs.writeFile(tempPath, buffer);

  const metadata: AudioMetadata = {
    format,
    size: buffer.length,
  };

  return {
    filePath: tempPath,
    originalFormat: format,
    processedFormat: format,
    metadata,
    tempFile: true,
  };
}

/**
 * Download and preprocess audio from URL
 */
export async function preprocessAudioFromUrl(
  url: string,
  authHeaders?: Record<string, string>
): Promise<PreprocessingResult> {
  // Download the file
  const response = await fetch(url, {
    headers: authHeaders,
  });

  if (!response.ok) {
    throw new PreprocessingError(`Failed to download audio: ${response.status} ${response.statusText}`);
  }

  // Get content type
  const contentType = response.headers.get('content-type') || 'audio/ogg';
  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

  // Validate size
  if (contentLength > MAX_FILE_SIZE) {
    throw new PreprocessingError(
      `Audio file too large: ${formatBytes(contentLength)}. Maximum is ${formatBytes(MAX_FILE_SIZE)}`
    );
  }

  // Determine format
  const format = mimeTypeToFormat(contentType);

  // Download to temp file
  const tempDir = await getTempDir();
  const tempPath = path.join(tempDir, `${uuidv4()}.${format}`);

  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(tempPath, Buffer.from(arrayBuffer));

  // Get actual file size
  const stats = await fs.stat(tempPath);

  const metadata: AudioMetadata = {
    format,
    size: stats.size,
  };

  return {
    filePath: tempPath,
    originalFormat: format,
    processedFormat: format,
    metadata,
    tempFile: true,
  };
}

/**
 * Validate audio for transcription
 */
export function validateAudioForTranscription(metadata: AudioMetadata): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file size
  if (metadata.size > MAX_FILE_SIZE) {
    errors.push(`File too large: ${formatBytes(metadata.size)}`);
  } else if (metadata.size > MAX_FILE_SIZE * 0.8) {
    warnings.push('File is near size limit');
  }

  // Check duration if available
  if (metadata.duration !== undefined) {
    if (metadata.duration < MIN_DURATION) {
      errors.push(`Audio too short: ${metadata.duration}s (minimum ${MIN_DURATION}s)`);
    }
    if (metadata.duration > MAX_DURATION) {
      warnings.push(`Audio is long (${metadata.duration}s). Consider splitting.`);
    }
  }

  // Check format
  if (!SUPPORTED_FORMATS.includes(metadata.format)) {
    errors.push(`Unsupported format: ${metadata.format}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Clean up temporary files
 */
export async function cleanupTempFiles(results: PreprocessingResult[]): Promise<void> {
  for (const result of results) {
    if (result.tempFile) {
      try {
        await fs.unlink(result.filePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function mimeTypeToFormat(mimeType: string): string {
  const mapping: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'mp4',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/x-opus+ogg': 'opus',
  };

  const format = mapping[mimeType.toLowerCase()];
  if (format) return format;

  // Try to extract from MIME type
  const match = mimeType.match(/audio\/([a-z0-9]+)/i);
  if (match) return match[1].toLowerCase();

  return 'ogg'; // Default for WhatsApp voice messages
}

async function getTempDir(): Promise<string> {
  const tempDir = path.join(os.tmpdir(), 'campotech-voice');
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class PreprocessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreprocessingError';
  }
}
