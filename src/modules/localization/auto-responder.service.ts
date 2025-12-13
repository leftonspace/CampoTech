/**
 * Auto-Responder Service
 * ======================
 *
 * Phase 9.7: Argentine Communication Localization
 * Handles automatic responses for after-hours messages and audio processing.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import {
  isBusinessOpen,
  getBusinessHoursConfig,
  getAutoResponderMessage,
  BusinessHoursCheck,
} from './business-hours.service';
import { sendTextMessage } from '../../integrations/whatsapp/messages/text.sender';
import { sendTemplateMessage } from '../../integrations/whatsapp/messages/template.sender';
import { getWhatsAppConfig } from '../../integrations/whatsapp/whatsapp.service';
import { InboundMessage } from '../../integrations/whatsapp/whatsapp.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AutoResponderResult {
  shouldRespond: boolean;
  responded: boolean;
  responseType: 'none' | 'after_hours' | 'audio_confirmation' | 'message_received';
  message?: string;
}

interface ProcessingContext {
  organizationId: string;
  phoneNumberId: string;
  accessToken: string;
  senderPhone: string;
  senderName?: string;
  messageType: string;
  isAfterHours: boolean;
  businessHoursCheck?: BusinessHoursCheck;
}

// Rate limiting to avoid spam
const recentResponses = new Map<string, number>();
const RESPONSE_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AUTO-RESPONDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process incoming message and send auto-response if needed
 */
export async function processAutoResponse(
  organizationId: string,
  message: InboundMessage,
  senderName?: string
): Promise<AutoResponderResult> {
  try {
    // Get organization config
    const config = await getBusinessHoursConfig(organizationId);

    if (!config.autoResponderEnabled) {
      return { shouldRespond: false, responded: false, responseType: 'none' };
    }

    // Check business hours
    const hoursCheck = await isBusinessOpen(organizationId);

    // Get WhatsApp config for sending
    const waConfig = await getWhatsAppConfig(organizationId);
    if (!waConfig) {
      log.warn('No WhatsApp config for auto-responder', { organizationId });
      return { shouldRespond: false, responded: false, responseType: 'none' };
    }

    const context: ProcessingContext = {
      organizationId,
      phoneNumberId: waConfig.phoneNumberId,
      accessToken: waConfig.accessToken,
      senderPhone: message.from,
      senderName,
      messageType: message.type,
      isAfterHours: !hoursCheck.isOpen,
      businessHoursCheck: hoursCheck,
    };

    // Check for rate limiting
    if (isRateLimited(context.senderPhone)) {
      log.debug('Auto-responder rate limited', { phone: context.senderPhone });
      return { shouldRespond: false, responded: false, responseType: 'none' };
    }

    // Handle audio messages specially
    if (message.type === 'audio') {
      return await handleAudioMessage(context, message, config);
    }

    // Handle after-hours messages
    if (!hoursCheck.isOpen) {
      return await handleAfterHoursMessage(context, hoursCheck, config);
    }

    // During business hours - no auto-response needed
    return { shouldRespond: false, responded: false, responseType: 'none' };
  } catch (error) {
    log.error('Auto-responder error', {
      organizationId,
      messageId: message.id,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { shouldRespond: false, responded: false, responseType: 'none' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle after-hours messages
 */
async function handleAfterHoursMessage(
  context: ProcessingContext,
  hoursCheck: BusinessHoursCheck,
  config: ReturnType<typeof getBusinessHoursConfig> extends Promise<infer T> ? T : never
): Promise<AutoResponderResult> {
  const message = getAutoResponderMessage(hoursCheck, config);

  try {
    // Get WhatsApp config for sending
    const waConfig = await getWhatsAppConfig(context.organizationId);
    if (!waConfig) {
      return { shouldRespond: true, responded: false, responseType: 'after_hours' };
    }

    await sendTextMessage(waConfig, context.senderPhone, message);

    // Mark as responded
    markResponded(context.senderPhone);

    // Log the auto-response
    await logAutoResponse(
      context.organizationId,
      context.senderPhone,
      'after_hours',
      message
    );

    return {
      shouldRespond: true,
      responded: true,
      responseType: 'after_hours',
      message,
    };
  } catch (error) {
    log.error('Failed to send after-hours response', {
      phone: context.senderPhone,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { shouldRespond: true, responded: false, responseType: 'after_hours' };
  }
}

/**
 * Handle audio/voice messages
 */
async function handleAudioMessage(
  context: ProcessingContext,
  message: InboundMessage,
  config: ReturnType<typeof getBusinessHoursConfig> extends Promise<infer T> ? T : never
): Promise<AutoResponderResult> {
  const responseText =
    '🎤 Recibimos tu audio.\n\n' +
    'Lo estamos procesando y te confirmamos tu pedido en breve.';

  try {
    // Get WhatsApp config for sending
    const waConfig = await getWhatsAppConfig(context.organizationId);
    if (!waConfig) {
      return { shouldRespond: true, responded: false, responseType: 'audio_confirmation' };
    }

    await sendTextMessage(waConfig, context.senderPhone, responseText);

    // Log audio receipt
    await db.audioMessage.create({
      data: {
        organizationId: context.organizationId,
        waMessageId: message.id,
        senderPhone: context.senderPhone,
        senderName: context.senderName,
        mediaId: message.audio?.id || '',
        mimeType: message.audio?.mimeType || 'audio/ogg',
        status: 'received',
        receivedAt: new Date(),
      },
    });

    // If after hours, also send after-hours message
    if (context.isAfterHours && context.businessHoursCheck) {
      const afterHoursMsg = getAutoResponderMessage(context.businessHoursCheck, config);
      await sendTextMessage(waConfig, context.senderPhone, afterHoursMsg);
    }

    markResponded(context.senderPhone);

    return {
      shouldRespond: true,
      responded: true,
      responseType: 'audio_confirmation',
      message: responseText,
    };
  } catch (error) {
    log.error('Failed to send audio confirmation', {
      phone: context.senderPhone,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { shouldRespond: true, responded: false, responseType: 'audio_confirmation' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════════

function isRateLimited(phone: string): boolean {
  const lastResponse = recentResponses.get(phone);
  if (!lastResponse) return false;

  return Date.now() - lastResponse < RESPONSE_COOLDOWN_MS;
}

function markResponded(phone: string): void {
  recentResponses.set(phone, Date.now());

  // Clean up old entries periodically
  if (recentResponses.size > 1000) {
    const cutoff = Date.now() - RESPONSE_COOLDOWN_MS;
    for (const [p, time] of recentResponses.entries()) {
      if (time < cutoff) {
        recentResponses.delete(p);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

async function logAutoResponse(
  organizationId: string,
  phone: string,
  responseType: string,
  message: string
): Promise<void> {
  try {
    await db.autoResponseLog.create({
      data: {
        organizationId,
        recipientPhone: phone,
        responseType,
        message,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    log.warn('Failed to log auto-response', { error });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE RECEIVED CONFIRMATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send message received confirmation during business hours
 * Only for first-time contacts or long gaps
 */
export async function sendMessageReceivedConfirmation(
  organizationId: string,
  recipientPhone: string,
  estimatedWaitMinutes: number = 10
): Promise<boolean> {
  try {
    const waConfig = await getWhatsAppConfig(organizationId);
    if (!waConfig) return false;

    const message =
      `✅ Recibimos tu mensaje.\n\n` +
      `Un representante te va a responder en breve. ` +
      `Tiempo estimado: ~${estimatedWaitMinutes} minutos.`;

    await sendTextMessage(waConfig, recipientPhone, message);

    return true;
  } catch (error) {
    log.error('Failed to send message confirmation', {
      phone: recipientPhone,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return false;
  }
}
