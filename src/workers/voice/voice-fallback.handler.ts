/**
 * Voice Fallback Handler
 * ======================
 *
 * Handle voice processing failures with graceful fallbacks
 */

import { prisma } from '../../lib/prisma';
import { publishEvent } from '../../lib/events';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type FallbackReason =
  | 'transcription_failed'
  | 'extraction_failed'
  | 'audio_download_failed'
  | 'audio_too_long'
  | 'audio_too_short'
  | 'unsupported_format'
  | 'rate_limited'
  | 'api_error'
  | 'unknown';

export interface FallbackAction {
  action: 'notify_user' | 'escalate_human' | 'retry_later' | 'discard';
  message?: string;
  retryDelay?: number;
}

export interface FallbackContext {
  voiceMessageId: string;
  waMessageId: string;
  customerPhone: string;
  conversationId: string;
  organizationId: string;
  error?: Error;
  attemptCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export class VoiceFallbackHandler {
  /**
   * Handle voice processing failure
   */
  async handleFailure(
    reason: FallbackReason,
    context: FallbackContext
  ): Promise<FallbackAction> {
    console.log(`[Voice Fallback] Handling failure: ${reason}`, {
      voiceMessageId: context.voiceMessageId,
      attemptCount: context.attemptCount,
    });

    // Determine fallback action
    const action = this.determineAction(reason, context);

    // Execute fallback
    await this.executeAction(action, reason, context);

    // Log for analytics
    await this.logFallback(reason, context, action);

    return action;
  }

  /**
   * Determine the appropriate fallback action
   */
  private determineAction(
    reason: FallbackReason,
    context: FallbackContext
  ): FallbackAction {
    // Max retries exceeded - escalate to human
    if (context.attemptCount >= 3) {
      return {
        action: 'escalate_human',
        message: 'No pudimos procesar tu mensaje de voz despues de varios intentos. Un operador te contactara pronto.',
      };
    }

    switch (reason) {
      case 'transcription_failed':
        return {
          action: 'notify_user',
          message: 'No pudimos entender tu mensaje de voz. Podrias escribirlo en texto o grabar uno nuevo con mejor audio?',
        };

      case 'extraction_failed':
        return {
          action: 'escalate_human',
          message: 'Recibimos tu mensaje pero necesitamos mas detalles. Un operador te contactara pronto.',
        };

      case 'audio_download_failed':
        return {
          action: 'retry_later',
          retryDelay: 60000, // 1 minute
        };

      case 'audio_too_long':
        return {
          action: 'notify_user',
          message: 'Tu mensaje de voz es muy largo. Podrias enviarnos un mensaje mas corto (maximo 2 minutos)?',
        };

      case 'audio_too_short':
        return {
          action: 'notify_user',
          message: 'Tu mensaje de voz es muy corto. Podrias enviarnos mas detalles?',
        };

      case 'unsupported_format':
        return {
          action: 'notify_user',
          message: 'No pudimos procesar el formato de audio. Podrias enviarnos un mensaje de voz normal?',
        };

      case 'rate_limited':
        return {
          action: 'retry_later',
          retryDelay: 300000, // 5 minutes
        };

      case 'api_error':
        return {
          action: 'retry_later',
          retryDelay: 120000, // 2 minutes
        };

      case 'unknown':
      default:
        return {
          action: 'escalate_human',
          message: 'Tuvimos un problema procesando tu mensaje. Un operador te contactara pronto.',
        };
    }
  }

  /**
   * Execute the fallback action
   */
  private async executeAction(
    action: FallbackAction,
    reason: FallbackReason,
    context: FallbackContext
  ): Promise<void> {
    switch (action.action) {
      case 'notify_user':
        await this.notifyUser(context, action.message!);
        await this.updateVoiceMessageStatus(context.voiceMessageId, 'failed', reason);
        break;

      case 'escalate_human':
        await this.escalateToHuman(context, reason);
        await this.notifyUser(context, action.message!);
        await this.updateVoiceMessageStatus(context.voiceMessageId, 'awaiting_review', reason);
        break;

      case 'retry_later':
        await this.scheduleRetry(context, action.retryDelay!);
        break;

      case 'discard':
        await this.updateVoiceMessageStatus(context.voiceMessageId, 'failed', reason);
        break;
    }
  }

  /**
   * Send notification to user via WhatsApp
   */
  private async notifyUser(context: FallbackContext, message: string): Promise<void> {
    await publishEvent('whatsapp.send_text', {
      conversationId: context.conversationId,
      customerPhone: context.customerPhone,
      text: message,
      organizationId: context.organizationId,
    });
  }

  /**
   * Escalate to human review queue
   */
  private async escalateToHuman(
    context: FallbackContext,
    reason: FallbackReason
  ): Promise<void> {
    await publishEvent('voice.review_needed', {
      voiceMessageId: context.voiceMessageId,
      reason: `Fallback: ${reason}`,
      priority: this.getPriority(reason),
      organizationId: context.organizationId,
    });

    // Create review queue entry
    await prisma.voiceReviewQueue.create({
      data: {
        voiceMessageId: context.voiceMessageId,
        priority: this.getPriority(reason),
        reason,
        organizationId: context.organizationId,
      },
    });
  }

  /**
   * Schedule retry for later
   */
  private async scheduleRetry(context: FallbackContext, delay: number): Promise<void> {
    await publishEvent('voice.schedule_retry', {
      voiceMessageId: context.voiceMessageId,
      waMessageId: context.waMessageId,
      delay,
      attemptCount: context.attemptCount + 1,
      organizationId: context.organizationId,
    });
  }

  /**
   * Update voice message status
   */
  private async updateVoiceMessageStatus(
    id: string,
    status: string,
    reason: FallbackReason
  ): Promise<void> {
    await prisma.voiceMessage.update({
      where: { id },
      data: {
        status,
        routing: {
          route: 'fallback',
          reason,
        },
        processingCompletedAt: new Date(),
      },
    });
  }

  /**
   * Log fallback for analytics
   */
  private async logFallback(
    reason: FallbackReason,
    context: FallbackContext,
    action: FallbackAction
  ): Promise<void> {
    await prisma.voiceFallbackLog.create({
      data: {
        voiceMessageId: context.voiceMessageId,
        reason,
        action: action.action,
        attemptCount: context.attemptCount,
        errorMessage: context.error?.message,
        organizationId: context.organizationId,
      },
    });
  }

  /**
   * Get priority based on failure reason
   */
  private getPriority(reason: FallbackReason): number {
    const priorities: Record<FallbackReason, number> = {
      extraction_failed: 1, // High priority - we have audio, just couldn't understand
      transcription_failed: 2,
      audio_download_failed: 3,
      api_error: 3,
      rate_limited: 4,
      audio_too_long: 5,
      audio_too_short: 5,
      unsupported_format: 5,
      unknown: 3,
    };

    return priorities[reason] || 3;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Classify error into fallback reason
 */
export function classifyError(error: Error): FallbackReason {
  const message = error.message.toLowerCase();

  if (message.includes('transcription') || message.includes('whisper')) {
    return 'transcription_failed';
  }

  if (message.includes('extraction') || message.includes('gpt')) {
    return 'extraction_failed';
  }

  if (message.includes('download') || message.includes('fetch')) {
    return 'audio_download_failed';
  }

  if (message.includes('too large') || message.includes('too long')) {
    return 'audio_too_long';
  }

  if (message.includes('too short') || message.includes('too small')) {
    return 'audio_too_short';
  }

  if (message.includes('format') || message.includes('unsupported')) {
    return 'unsupported_format';
  }

  if (message.includes('rate limit') || message.includes('429')) {
    return 'rate_limited';
  }

  if (message.includes('api') || message.includes('500') || message.includes('503')) {
    return 'api_error';
  }

  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let fallbackHandler: VoiceFallbackHandler | null = null;

export function getFallbackHandler(): VoiceFallbackHandler {
  if (!fallbackHandler) {
    fallbackHandler = new VoiceFallbackHandler();
  }
  return fallbackHandler;
}
