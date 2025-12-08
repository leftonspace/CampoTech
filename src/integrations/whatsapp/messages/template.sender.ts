/**
 * WhatsApp Template Message Sender
 * =================================
 *
 * Sends pre-approved template messages via WhatsApp Business API.
 * Required for initiating conversations outside 24-hour window.
 */

import * as https from 'https';
import {
  WhatsAppConfig,
  SendMessageRequest,
  SendMessageResponse,
  TemplateMessage,
  TemplateComponent,
  TemplateParameter,
  WAError,
  WA_API_BASE_URL,
  WA_API_VERSION,
} from '../whatsapp.types';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a simple text template (no parameters)
 */
export function buildSimpleTemplate(
  templateName: string,
  languageCode: string = 'es_AR'
): TemplateMessage {
  return {
    name: templateName,
    language: { code: languageCode },
  };
}

/**
 * Build template with body parameters
 */
export function buildTemplateWithParams(
  templateName: string,
  bodyParams: string[],
  languageCode: string = 'es_AR'
): TemplateMessage {
  return {
    name: templateName,
    language: { code: languageCode },
    components: [
      {
        type: 'body',
        parameters: bodyParams.map((text) => ({ type: 'text', text })),
      },
    ],
  };
}

/**
 * Build template with header image
 */
export function buildTemplateWithImage(
  templateName: string,
  imageUrl: string,
  bodyParams: string[] = [],
  languageCode: string = 'es_AR'
): TemplateMessage {
  const components: TemplateComponent[] = [
    {
      type: 'header',
      parameters: [{ type: 'image', image: { link: imageUrl } }],
    },
  ];

  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((text) => ({ type: 'text', text })),
    });
  }

  return {
    name: templateName,
    language: { code: languageCode },
    components,
  };
}

/**
 * Build template with document
 */
export function buildTemplateWithDocument(
  templateName: string,
  documentUrl: string,
  filename: string,
  bodyParams: string[] = [],
  languageCode: string = 'es_AR'
): TemplateMessage {
  const components: TemplateComponent[] = [
    {
      type: 'header',
      parameters: [
        {
          type: 'document',
          document: { link: documentUrl, filename },
        },
      ],
    },
  ];

  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((text) => ({ type: 'text', text })),
    });
  }

  return {
    name: templateName,
    language: { code: languageCode },
    components,
  };
}

/**
 * Build template with currency parameter
 */
export function buildTemplateWithCurrency(
  templateName: string,
  amount: number,
  currencyCode: string = 'ARS',
  otherParams: string[] = [],
  languageCode: string = 'es_AR'
): TemplateMessage {
  const parameters: TemplateParameter[] = [
    {
      type: 'currency',
      currency: {
        fallbackValue: `$${(amount / 1000).toFixed(2)}`,
        code: currencyCode,
        amount1000: amount,
      },
    },
    ...otherParams.map((text) => ({ type: 'text' as const, text })),
  ];

  return {
    name: templateName,
    language: { code: languageCode },
    components: [
      {
        type: 'body',
        parameters,
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

export interface SendTemplateResult {
  success: true;
  messageId: string;
  waId: string;
}

export interface SendTemplateError {
  success: false;
  error: string;
  code?: number;
}

/**
 * Send a template message
 */
export async function sendTemplateMessage(
  config: WhatsAppConfig,
  to: string,
  template: TemplateMessage
): Promise<SendTemplateResult | SendTemplateError> {
  const request: SendMessageRequest = {
    messagingProduct: 'whatsapp',
    recipientType: 'individual',
    to: normalizePhoneNumber(to),
    type: 'template',
    template,
  };

  log.info('Sending template message', {
    to,
    template: template.name,
    language: template.language.code,
  });

  try {
    const response = await makeApiRequest<SendMessageResponse>(
      config,
      'POST',
      `/${config.phoneNumberId}/messages`,
      request
    );

    if (response.messages?.[0]?.id) {
      log.info('Template message sent', {
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
    log.error('Failed to send template message', {
      to,
      template: template.name,
      error: waError.message,
      code: waError.code,
    });

    return {
      success: false,
      error: waError.message || 'Failed to send message',
      code: waError.code,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREDEFINED TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send job scheduled notification
 */
export async function sendJobScheduledTemplate(
  config: WhatsAppConfig,
  to: string,
  params: {
    customerName: string;
    serviceName: string;
    date: string;
    timeRange: string;
    technicianName: string;
  }
): Promise<SendTemplateResult | SendTemplateError> {
  const template = buildTemplateWithParams('trabajo_programado', [
    params.customerName,
    params.serviceName,
    params.date,
    params.timeRange,
    params.technicianName,
  ]);

  return sendTemplateMessage(config, to, template);
}

/**
 * Send technician en route notification
 */
export async function sendTechnicianEnRouteTemplate(
  config: WhatsAppConfig,
  to: string,
  params: {
    customerName: string;
    technicianName: string;
    estimatedTime: string;
  }
): Promise<SendTemplateResult | SendTemplateError> {
  const template = buildTemplateWithParams('tecnico_en_camino', [
    params.customerName,
    params.technicianName,
    params.estimatedTime,
  ]);

  return sendTemplateMessage(config, to, template);
}

/**
 * Send invoice notification with PDF
 */
export async function sendInvoiceTemplate(
  config: WhatsAppConfig,
  to: string,
  params: {
    customerName: string;
    invoiceNumber: string;
    amount: string;
    pdfUrl: string;
  }
): Promise<SendTemplateResult | SendTemplateError> {
  const template = buildTemplateWithDocument(
    'factura_emitida',
    params.pdfUrl,
    `Factura_${params.invoiceNumber}.pdf`,
    [params.customerName, params.invoiceNumber, params.amount]
  );

  return sendTemplateMessage(config, to, template);
}

/**
 * Send payment link notification
 */
export async function sendPaymentLinkTemplate(
  config: WhatsAppConfig,
  to: string,
  params: {
    customerName: string;
    invoiceNumber: string;
    amount: string;
    paymentUrl: string;
  }
): Promise<SendTemplateResult | SendTemplateError> {
  const template = buildTemplateWithParams('link_de_pago', [
    params.customerName,
    params.invoiceNumber,
    params.amount,
    params.paymentUrl,
  ]);

  return sendTemplateMessage(config, to, template);
}

/**
 * Send payment confirmation
 */
export async function sendPaymentConfirmedTemplate(
  config: WhatsAppConfig,
  to: string,
  params: {
    customerName: string;
    amount: string;
    invoiceNumber: string;
  }
): Promise<SendTemplateResult | SendTemplateError> {
  const template = buildTemplateWithParams('pago_confirmado', [
    params.customerName,
    params.amount,
    params.invoiceNumber,
  ]);

  return sendTemplateMessage(config, to, template);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function normalizePhoneNumber(phone: string): string {
  // Remove non-digits
  let digits = phone.replace(/\D/g, '');

  // Add Argentina country code if not present
  if (!digits.startsWith('54') && digits.length === 10) {
    digits = '54' + digits;
  }

  // Remove leading 0 from area code for mobile numbers
  if (digits.startsWith('549') && digits.length === 13) {
    // Format: 54 9 11 1234-5678 (mobile)
    return digits;
  }

  // Add 9 for mobile if missing
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
