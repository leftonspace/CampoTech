/**
 * Voice AI Service
 * ================
 *
 * Main orchestration service for voice message processing
 */

import {
  VoiceMessage,
  VoiceMessageStatus,
  ProcessVoiceMessageRequest,
  ProcessVoiceMessageResponse,
  TranscriptionResult,
  ExtractedJobRequest,
  RoutingDecision,
} from './voice-ai.types';
import { getWhisperClient, WhisperError } from './transcription/whisper.client';
import {
  preprocessAudioFromUrl,
  cleanupTempFiles,
  PreprocessingResult,
} from './transcription/preprocessing';
import { getGPTExtractor, ExtractionError } from './extraction/gpt-extractor';
import { getConfidenceRouter } from './routing/confidence-router';
import { prisma } from '../../lib/prisma';
import { publishEvent } from '../../lib/events';

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class VoiceAIService {
  private whisper = getWhisperClient();
  private extractor = getGPTExtractor();
  private router = getConfidenceRouter();

  /**
   * Process a voice message end-to-end
   */
  async processVoiceMessage(
    request: ProcessVoiceMessageRequest,
    organizationId: string
  ): Promise<ProcessVoiceMessageResponse> {
    // Create voice message record
    const voiceMessage = await this.createVoiceMessage(request, organizationId);

    let preprocessResult: PreprocessingResult | null = null;

    try {
      // Step 1: Download and preprocess audio
      await this.updateStatus(voiceMessage.id, 'downloading');
      preprocessResult = await this.downloadAudio(request.audioUrl);

      // Step 2: Transcribe
      await this.updateStatus(voiceMessage.id, 'transcribing');
      const transcription = await this.transcribe(preprocessResult.filePath);
      await this.saveTranscription(voiceMessage.id, transcription);

      // Step 3: Extract
      await this.updateStatus(voiceMessage.id, 'extracting');
      const extraction = await this.extract(transcription.text, request.customerPhone);
      await this.saveExtraction(voiceMessage.id, extraction);

      // Step 4: Route
      await this.updateStatus(voiceMessage.id, 'routing');
      const routing = this.router.route(extraction, transcription);
      await this.saveRouting(voiceMessage.id, routing);

      // Step 5: Execute route action
      const newStatus = await this.executeRoute(voiceMessage.id, routing, organizationId);

      return {
        success: true,
        voiceMessageId: voiceMessage.id,
        status: newStatus,
        route: routing.route,
        extractedData: extraction,
      };
    } catch (error) {
      // Handle failure
      await this.handleProcessingError(voiceMessage.id, error);

      return {
        success: false,
        voiceMessageId: voiceMessage.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Processing failed',
      };
    } finally {
      // Cleanup temp files
      if (preprocessResult) {
        await cleanupTempFiles([preprocessResult]);
      }
    }
  }

  /**
   * Retry a failed voice message
   */
  async retryProcessing(voiceMessageId: string): Promise<ProcessVoiceMessageResponse> {
    const voiceMessage = await prisma.voiceMessage.findUnique({
      where: { id: voiceMessageId },
    });

    if (!voiceMessage) {
      throw new VoiceAIError(`Voice message ${voiceMessageId} not found`);
    }

    if (voiceMessage.status !== 'failed') {
      throw new VoiceAIError(`Voice message ${voiceMessageId} is not in failed state`);
    }

    // Reset and reprocess
    await prisma.voiceMessage.update({
      where: { id: voiceMessageId },
      data: { status: 'pending' },
    });

    return this.processVoiceMessage(
      {
        waMessageId: voiceMessage.waMessageId,
        audioUrl: voiceMessage.audioUrl,
        audioDuration: voiceMessage.audioDuration,
        customerPhone: voiceMessage.customerPhone,
        conversationId: voiceMessage.conversationId,
      },
      voiceMessage.organizationId
    );
  }

  /**
   * Handle user confirmation response
   */
  async handleConfirmation(
    voiceMessageId: string,
    confirmed: boolean,
    corrections?: Partial<ExtractedJobRequest>
  ): Promise<{ success: boolean; jobId?: string }> {
    const voiceMessage = await prisma.voiceMessage.findUnique({
      where: { id: voiceMessageId },
    });

    if (!voiceMessage || voiceMessage.status !== 'awaiting_confirmation') {
      throw new VoiceAIError('Voice message not awaiting confirmation');
    }

    if (confirmed) {
      // Apply corrections if any
      const finalData = corrections
        ? this.mergeCorrections(voiceMessage.extraction as ExtractedJobRequest, corrections)
        : voiceMessage.extraction as ExtractedJobRequest;

      // Create the job
      const job = await this.createJobFromExtraction(
        finalData,
        voiceMessage.organizationId,
        voiceMessage.customerId || undefined
      );

      // Update voice message
      await prisma.voiceMessage.update({
        where: { id: voiceMessageId },
        data: {
          status: 'completed',
          jobId: job.id,
          outcome: 'job_created',
          correctedData: corrections ? finalData : undefined,
        },
      });

      return { success: true, jobId: job.id };
    } else {
      // User rejected - route to human review
      await prisma.voiceMessage.update({
        where: { id: voiceMessageId },
        data: {
          status: 'awaiting_review',
          reviewNotes: 'User rejected automatic extraction',
        },
      });

      return { success: true };
    }
  }

  /**
   * Submit human review
   */
  async submitReview(
    voiceMessageId: string,
    reviewerId: string,
    action: 'approve' | 'edit' | 'reject',
    corrections?: ExtractedJobRequest,
    notes?: string
  ): Promise<{ success: boolean; jobId?: string }> {
    const voiceMessage = await prisma.voiceMessage.findUnique({
      where: { id: voiceMessageId },
    });

    if (!voiceMessage || voiceMessage.status !== 'awaiting_review') {
      throw new VoiceAIError('Voice message not awaiting review');
    }

    if (action === 'reject') {
      await prisma.voiceMessage.update({
        where: { id: voiceMessageId },
        data: {
          status: 'completed',
          outcome: 'rejected',
          reviewerId,
          reviewedAt: new Date(),
          reviewNotes: notes,
        },
      });

      return { success: true };
    }

    // Approve or edit - create job
    const finalData = action === 'edit' && corrections
      ? corrections
      : voiceMessage.extraction as ExtractedJobRequest;

    const job = await this.createJobFromExtraction(
      finalData,
      voiceMessage.organizationId,
      voiceMessage.customerId || undefined
    );

    await prisma.voiceMessage.update({
      where: { id: voiceMessageId },
      data: {
        status: 'completed',
        outcome: 'job_created',
        jobId: job.id,
        reviewerId,
        reviewedAt: new Date(),
        reviewNotes: notes,
        correctedData: action === 'edit' ? finalData : undefined,
      },
    });

    // Save feedback for model improvement
    if (action === 'edit' && corrections) {
      await this.saveFeedback(
        voiceMessageId,
        voiceMessage.extraction as ExtractedJobRequest,
        corrections
      );
    }

    return { success: true, jobId: job.id };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private async createVoiceMessage(
    request: ProcessVoiceMessageRequest,
    organizationId: string
  ): Promise<VoiceMessage> {
    const record = await prisma.voiceMessage.create({
      data: {
        waMessageId: request.waMessageId,
        conversationId: request.conversationId,
        customerPhone: request.customerPhone,
        audioUrl: request.audioUrl,
        audioDuration: request.audioDuration,
        audioMimeType: 'audio/ogg',
        audioSize: 0,
        status: 'pending',
        organizationId,
      },
    });

    return record as unknown as VoiceMessage;
  }

  private async updateStatus(id: string, status: VoiceMessageStatus): Promise<void> {
    const data: Record<string, unknown> = { status };

    if (status === 'downloading' || status === 'transcribing') {
      data.processingStartedAt = new Date();
    }
    if (status === 'completed' || status === 'failed') {
      data.processingCompletedAt = new Date();
    }

    await prisma.voiceMessage.update({
      where: { id },
      data,
    });
  }

  private async downloadAudio(audioUrl: string): Promise<PreprocessingResult> {
    // WhatsApp media URLs require authentication
    const authHeaders = {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    };

    return preprocessAudioFromUrl(audioUrl, authHeaders);
  }

  private async transcribe(audioPath: string): Promise<TranscriptionResult> {
    return this.whisper.transcribe(audioPath);
  }

  private async extract(
    transcription: string,
    customerPhone?: string
  ): Promise<ExtractedJobRequest> {
    return this.extractor.extract(transcription, customerPhone);
  }

  private async saveTranscription(
    id: string,
    transcription: TranscriptionResult
  ): Promise<void> {
    await prisma.voiceMessage.update({
      where: { id },
      data: { transcription: transcription as unknown as Record<string, unknown> },
    });
  }

  private async saveExtraction(
    id: string,
    extraction: ExtractedJobRequest
  ): Promise<void> {
    await prisma.voiceMessage.update({
      where: { id },
      data: { extraction: extraction as unknown as Record<string, unknown> },
    });
  }

  private async saveRouting(
    id: string,
    routing: RoutingDecision
  ): Promise<void> {
    await prisma.voiceMessage.update({
      where: { id },
      data: { routing: routing as unknown as Record<string, unknown> },
    });
  }

  private async executeRoute(
    id: string,
    routing: RoutingDecision,
    organizationId: string
  ): Promise<VoiceMessageStatus> {
    switch (routing.route) {
      case 'auto_create': {
        // Create job automatically
        const job = await this.createJobFromExtraction(
          routing.extractedData!,
          organizationId
        );

        await prisma.voiceMessage.update({
          where: { id },
          data: {
            status: 'completed',
            jobId: job.id,
            outcome: 'job_created',
          },
        });

        // Publish event
        await publishEvent('voice.job_created', {
          voiceMessageId: id,
          jobId: job.id,
          organizationId,
        });

        return 'completed';
      }

      case 'confirm_user': {
        // Send confirmation message
        const message = await this.extractor.generateConfirmationMessage(
          routing.extractedData!
        );

        // Queue confirmation message
        await publishEvent('voice.confirmation_needed', {
          voiceMessageId: id,
          message,
          organizationId,
        });

        await this.updateStatus(id, 'awaiting_confirmation');
        return 'awaiting_confirmation';
      }

      case 'human_review':
      case 'fallback': {
        // Add to review queue
        await publishEvent('voice.review_needed', {
          voiceMessageId: id,
          reason: routing.reason,
          organizationId,
        });

        await this.updateStatus(id, 'awaiting_review');
        return 'awaiting_review';
      }
    }
  }

  private async createJobFromExtraction(
    extraction: ExtractedJobRequest,
    organizationId: string,
    customerId?: string
  ): Promise<{ id: string }> {
    // Map extraction to job data
    const jobData = {
      organizationId,
      customerId,
      serviceType: extraction.serviceType?.value || 'otro',
      status: 'PENDING',
      priority: extraction.urgency?.value === 'urgente' ? 'high' : 'normal',
      address: extraction.customerAddress?.value,
      notes: extraction.description?.value,
      internalNotes: extraction.notes?.value,
      scheduledDate: extraction.preferredDate?.value
        ? this.parseDate(extraction.preferredDate.value)
        : null,
      source: 'voice_ai',
    };

    const job = await prisma.job.create({
      data: jobData,
    });

    return { id: job.id };
  }

  private parseDate(dateStr: string): Date | null {
    try {
      // Try ISO format first
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) return date;

      // Try to parse Spanish date phrases
      const today = new Date();
      const lowerStr = dateStr.toLowerCase();

      if (lowerStr.includes('hoy')) return today;
      if (lowerStr.includes('manana') || lowerStr.includes('mañana')) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      }

      return null;
    } catch {
      return null;
    }
  }

  private mergeCorrections(
    original: ExtractedJobRequest,
    corrections: Partial<ExtractedJobRequest>
  ): ExtractedJobRequest {
    return { ...original, ...corrections };
  }

  private async saveFeedback(
    voiceMessageId: string,
    original: ExtractedJobRequest,
    corrected: ExtractedJobRequest
  ): Promise<void> {
    await prisma.voiceAIFeedback.create({
      data: {
        voiceMessageId,
        originalExtraction: original as unknown as Record<string, unknown>,
        correctedExtraction: corrected as unknown as Record<string, unknown>,
        feedbackType: 'correction',
        timestamp: new Date(),
      },
    });
  }

  private async handleProcessingError(id: string, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await prisma.voiceMessage.update({
      where: { id },
      data: {
        status: 'failed',
        processingCompletedAt: new Date(),
        routing: {
          route: 'fallback',
          reason: errorMessage,
        },
      },
    });

    // Log error
    console.error(`Voice message ${id} processing failed:`, error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class VoiceAIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoiceAIError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let voiceAIService: VoiceAIService | null = null;

export function getVoiceAIService(): VoiceAIService {
  if (!voiceAIService) {
    voiceAIService = new VoiceAIService();
  }
  return voiceAIService;
}
