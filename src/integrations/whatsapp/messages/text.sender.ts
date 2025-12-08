/**
 * WhatsApp Text Message Sender
 * ============================
 *
 * Sends free-form text messages via WhatsApp Business API.
 * Only works within 24-hour customer service window.
 */

import * as https from 'https';
import {
  WhatsAppConfig,
  SendMessageRequest,
  SendMessageResponse,
  TextMessage,
  InteractiveMessage,
  InteractiveButton,
  InteractiveSection,
  LocationMessage,
  WAError,
  WA_API_BASE_URL,
  WA_API_VERSION,
} from '../whatsapp.types';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// SEND TEXT MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

export interface SendMessageResult {
  success: true;
  messageId: string;
  waId: string;
}

export interface SendMessageError {
  success: false;
  error: string;
  code?: number;
  isOutsideWindow?: boolean;
}

/**
 * Send a simple text message
 */
export async function sendTextMessage(
  config: WhatsAppConfig,
  to: string,
  text: string,
  previewUrl: boolean = false
): Promise<SendMessageResult | SendMessageError> {
  const request: SendMessageRequest = {
    messagingProduct: 'whatsapp',
    recipientType: 'individual',
    to: normalizePhoneNumber(to),
    type: 'text',
    text: {
      body: text,
      previewUrl,
    },
  };

  return sendMessage(config, request, to);
}

/**
 * Send a reply to a specific message
 */
export async function sendReplyMessage(
  config: WhatsAppConfig,
  to: string,
  text: string,
  replyToMessageId: string
): Promise<SendMessageResult | SendMessageError> {
  const request: SendMessageRequest & { context: { message_id: string } } = {
    messagingProduct: 'whatsapp',
    recipientType: 'individual',
    to: normalizePhoneNumber(to),
    type: 'text',
    text: { body: text },
    context: { message_id: replyToMessageId },
  };

  return sendMessage(config, request as SendMessageRequest, to);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACTIVE MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send a message with quick reply buttons (max 3)
 */
export async function sendButtonMessage(
  config: WhatsAppConfig,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  headerText?: string,
  footerText?: string
): Promise<SendMessageResult | SendMessageError> {
  if (buttons.length > 3) {
    return {
      success: false,
      error: 'Maximum 3 buttons allowed',
    };
  }

  const interactive: InteractiveMessage = {
    type: 'button',
    body: { text: bodyText },
    action: {
      buttons: buttons.map((btn) => ({
        type: 'reply',
        reply: { id: btn.id, title: btn.title.slice(0, 20) },
      })),
    },
  };

  if (headerText) {
    interactive.header = { type: 'text', text: headerText };
  }

  if (footerText) {
    interactive.footer = { text: footerText };
  }

  const request: SendMessageRequest = {
    messagingProduct: 'whatsapp',
    recipientType: 'individual',
    to: normalizePhoneNumber(to),
    type: 'interactive',
    interactive,
  };

  return sendMessage(config, request, to);
}

/**
 * Send a list message (max 10 items per section, max 10 sections)
 */
export async function sendListMessage(
  config: WhatsAppConfig,
  to: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
  headerText?: string,
  footerText?: string
): Promise<SendMessageResult | SendMessageError> {
  const interactive: InteractiveMessage = {
    type: 'list',
    body: { text: bodyText },
    action: {
      button: buttonText.slice(0, 20),
      sections: sections.map((section) => ({
        title: section.title?.slice(0, 24),
        rows: section.rows.slice(0, 10).map((row) => ({
          id: row.id.slice(0, 200),
          title: row.title.slice(0, 24),
          description: row.description?.slice(0, 72),
        })),
      })),
    },
  };

  if (headerText) {
    interactive.header = { type: 'text', text: headerText };
  }

  if (footerText) {
    interactive.footer = { text: footerText };
  }

  const request: SendMessageRequest = {
    messagingProduct: 'whatsapp',
    recipientType: 'individual',
    to: normalizePhoneNumber(to),
    type: 'interactive',
    interactive,
  };

  return sendMessage(config, request, to);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send a location message
 */
export async function sendLocationMessage(
  config: WhatsAppConfig,
  to: string,
  location: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  }
): Promise<SendMessageResult | SendMessageError> {
  const request: SendMessageRequest = {
    messagingProduct: 'whatsapp',
    recipientType: 'individual',
    to: normalizePhoneNumber(to),
    type: 'location',
    location,
  };

  return sendMessage(config, request, to);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REACTION MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send a reaction to a message
 */
export async function sendReactionMessage(
  config: WhatsAppConfig,
  to: string,
  messageId: string,
  emoji: string
): Promise<SendMessageResult | SendMessageError> {
  const request = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneNumber(to),
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji,
    },
  };

  return sendMessage(config, request as unknown as SendMessageRequest, to);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE SEND FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function sendMessage(
  config: WhatsAppConfig,
  request: SendMessageRequest,
  to: string
): Promise<SendMessageResult | SendMessageError> {
  log.info('Sending WhatsApp message', {
    to,
    type: request.type,
  });

  try {
    const response = await makeApiRequest<SendMessageResponse>(
      config,
      'POST',
      `/${config.phoneNumberId}/messages`,
      request
    );

    if (response.messages?.[0]?.id) {
      log.info('Message sent', {
        messageId: response.messages[0].id,
        to,
      });

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

    // Check if error is due to being outside 24-hour window
    const isOutsideWindow =
      waError.code === 131047 ||
      waError.message?.includes('24 hour');

    log.error('Failed to send message', {
      to,
      error: waError.message,
      code: waError.code,
      isOutsideWindow,
    });

    return {
      success: false,
      error: waError.message || 'Failed to send message',
      code: waError.code,
      isOutsideWindow,
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

  if (digits.startsWith('549') && digits.length === 13) {
    return digits;
  }

  if (digits.startsWith('54') && !digits.startsWith('549') && digits.length === 12) {
    digits = '549' + digits.slice(2);
  }

  return digits;
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
            const error = parsed.error || parsed;
            reject({
              code: error.code || res.statusCode,
              message: error.message || 'API request failed',
            } as WAError);
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
