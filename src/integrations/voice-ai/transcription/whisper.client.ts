/**
 * Whisper Client
 * ==============
 *
 * OpenAI Whisper integration for audio transcription
 */

import OpenAI from 'openai';
import { createReadStream } from 'fs';
import { TranscriptionResult, TranscriptionSegment, WhisperConfig } from '../voice-ai.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: WhisperConfig = {
  model: 'whisper-1',
  language: 'es', // Spanish for Argentina
  responseFormat: 'verbose_json',
  temperature: 0,
  prompt: 'Transcripcion de mensaje de voz en espanol argentino sobre servicios de aire acondicionado y calefaccion.',
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export class WhisperClient {
  private client: OpenAI;
  private config: WhisperConfig;

  constructor(apiKey?: string, config?: Partial<WhisperConfig>) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Transcribe audio file using Whisper API
   */
  async transcribe(audioFilePath: string): Promise<TranscriptionResult> {
    try {
      const response = await this.client.audio.transcriptions.create({
        file: createReadStream(audioFilePath),
        model: this.config.model,
        language: this.config.language,
        response_format: this.config.responseFormat,
        temperature: this.config.temperature,
        prompt: this.config.prompt,
      });

      // Parse verbose JSON response
      const verboseResponse = response as unknown as WhisperVerboseResponse;

      return this.parseResponse(verboseResponse);
    } catch (error) {
      throw new WhisperError(
        `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Transcribe audio from buffer
   */
  async transcribeBuffer(
    buffer: Buffer,
    filename: string = 'audio.ogg'
  ): Promise<TranscriptionResult> {
    try {
      // Create a File-like object from buffer
      const file = new File([buffer], filename, { type: this.getMimeType(filename) });

      const response = await this.client.audio.transcriptions.create({
        file,
        model: this.config.model,
        language: this.config.language,
        response_format: this.config.responseFormat,
        temperature: this.config.temperature,
        prompt: this.config.prompt,
      });

      const verboseResponse = response as unknown as WhisperVerboseResponse;

      return this.parseResponse(verboseResponse);
    } catch (error) {
      throw new WhisperError(
        `Transcription from buffer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Parse Whisper verbose JSON response
   */
  private parseResponse(response: WhisperVerboseResponse): TranscriptionResult {
    const segments: TranscriptionSegment[] = (response.segments || []).map((seg, index) => ({
      id: index,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
      confidence: seg.avg_logprob ? this.logprobToConfidence(seg.avg_logprob) : 0.8,
      words: seg.words?.map((w) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.probability || 0.8,
      })),
    }));

    // Calculate overall confidence
    const avgConfidence =
      segments.length > 0
        ? segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length
        : 0.8;

    return {
      text: response.text.trim(),
      language: response.language || 'es',
      duration: response.duration || 0,
      segments,
      confidence: avgConfidence,
    };
  }

  /**
   * Convert log probability to confidence score (0-1)
   */
  private logprobToConfidence(logprob: number): number {
    // Whisper returns negative log probabilities
    // Convert to probability: exp(logprob)
    // Then normalize to a 0-1 scale
    const prob = Math.exp(logprob);
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, prob));
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      mp4: 'audio/mp4',
      mpeg: 'audio/mpeg',
      mpga: 'audio/mpeg',
      m4a: 'audio/m4a',
      wav: 'audio/wav',
      webm: 'audio/webm',
      ogg: 'audio/ogg',
      opus: 'audio/opus',
    };
    return mimeTypes[ext || ''] || 'audio/ogg';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface WhisperVerboseResponse {
  text: string;
  language: string;
  duration: number;
  segments: WhisperSegment[];
}

interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  avg_logprob: number;
  no_speech_prob: number;
  words?: WhisperWord[];
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
  probability: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class WhisperError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'WhisperError';
    this.cause = cause;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let whisperClient: WhisperClient | null = null;

export function getWhisperClient(): WhisperClient {
  if (!whisperClient) {
    whisperClient = new WhisperClient();
  }
  return whisperClient;
}
