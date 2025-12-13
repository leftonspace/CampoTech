/**
 * WhatsApp Service
 * ================
 *
 * WhatsApp Business API integration for notifications.
 * Phase 15: Consumer Marketplace
 *
 * Uses Meta's WhatsApp Business Cloud API
 * https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import axios from 'axios';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string;
  apiVersion?: string;
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters?: TemplateParameter[];
  sub_type?: 'quick_reply' | 'url';
  index?: number;
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
  date_time?: {
    fallback_value: string;
  };
  image?: {
    link: string;
  };
}

export interface SendMessageResult {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export interface WhatsAppError {
  code: number;
  title: string;
  message: string;
  error_data?: {
    messaging_product: string;
    details: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE TEMPLATES (Spanish - Argentina)
// ═══════════════════════════════════════════════════════════════════════════════

export const MESSAGE_TEMPLATES = {
  // Consumer notifications
  new_quote: {
    name: 'nueva_cotizacion',
    language: 'es_AR',
    params: ['business_name', 'service', 'price', 'request_number'],
    // Template text (configured in WhatsApp Business):
    // "¡Hola! {{1}} te envió una cotización para {{2}} por {{3}}.
    //  Pedido #{{4}}. Ingresá a la app para ver los detalles."
  },
  quote_accepted: {
    name: 'cotizacion_aceptada',
    language: 'es_AR',
    params: ['service', 'request_number'],
    // "¡Excelente! Tu cotización para {{1}} fue aceptada.
    //  Pedido #{{2}}. Contactá al cliente para coordinar."
  },
  new_lead: {
    name: 'nuevo_pedido',
    language: 'es_AR',
    params: ['service', 'category', 'neighborhood', 'urgency'],
    // "Nuevo pedido de servicio: {{1}}
    //  Categoría: {{2}}
    //  Zona: {{3}}
    //  Urgencia: {{4}}
    //  Ingresá a la app para enviar tu cotización."
  },
  request_created: {
    name: 'pedido_creado',
    language: 'es_AR',
    params: ['service', 'request_number'],
    // "Tu pedido para {{1}} fue creado exitosamente.
    //  Número: #{{2}}. Te notificaremos cuando recibas cotizaciones."
  },
  job_reminder: {
    name: 'recordatorio_trabajo',
    language: 'es_AR',
    params: ['service', 'business_name', 'date', 'time'],
    // "Recordatorio: Tu servicio de {{1}} con {{2}} está programado para {{3}} a las {{4}}."
  },
  review_request: {
    name: 'solicitud_resena',
    language: 'es_AR',
    params: ['business_name', 'service'],
    // "¿Cómo te fue con {{1}}? Tu opinión sobre {{2}} ayuda a otros usuarios.
    //  Dejá tu reseña en la app."
  },
  otp_code: {
    name: 'codigo_verificacion',
    language: 'es_AR',
    params: ['code'],
    // "Tu código de verificación es: {{1}}. Válido por 10 minutos. No compartas este código."
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class WhatsAppService {
  private client: any; // AxiosInstance type causes conflicts
  private phoneNumberId: string;

  constructor(config: WhatsAppConfig) {
    const apiVersion = config.apiVersion || 'v18.0';
    this.phoneNumberId = config.phoneNumberId;

    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${apiVersion}`,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Send a template message
   */
  async sendTemplate(
    phone: string,
    templateId: keyof typeof MESSAGE_TEMPLATES,
    params: Record<string, string>
  ): Promise<SendMessageResult> {
    const template = MESSAGE_TEMPLATES[templateId];
    if (!template) {
      throw new Error(`Unknown template: ${templateId}`);
    }

    // Normalize phone number for Argentina
    const normalizedPhone = this.normalizeArgentinePhone(phone);

    // Build template parameters
    const parameters: TemplateParameter[] = template.params.map(paramName => ({
      type: 'text' as const,
      text: params[paramName] || '',
    }));

    const message = {
      messaging_product: 'whatsapp',
      to: normalizedPhone,
      type: 'template',
      template: {
        name: template.name,
        language: {
          code: template.language,
        },
        components: [
          {
            type: 'body',
            parameters,
          },
        ],
      },
    };

    try {
      const response = await this.client.post<SendMessageResult>(
        `/${this.phoneNumberId}/messages`,
        message
      );
      return response.data;
    } catch (error: any) {
      const whatsappError = error.response?.data?.error as WhatsAppError;
      if (whatsappError) {
        throw new Error(
          `WhatsApp API Error ${whatsappError.code}: ${whatsappError.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Send a text message (non-template, requires 24h window)
   */
  async sendText(phone: string, text: string): Promise<SendMessageResult> {
    const normalizedPhone = this.normalizeArgentinePhone(phone);

    const message = {
      messaging_product: 'whatsapp',
      to: normalizedPhone,
      type: 'text',
      text: {
        body: text,
      },
    };

    try {
      const response = await this.client.post<SendMessageResult>(
        `/${this.phoneNumberId}/messages`,
        message
      );
      return response.data;
    } catch (error: any) {
      const whatsappError = error.response?.data?.error as WhatsAppError;
      if (whatsappError) {
        throw new Error(
          `WhatsApp API Error ${whatsappError.code}: ${whatsappError.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Send an interactive message with buttons
   */
  async sendInteractive(
    phone: string,
    body: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<SendMessageResult> {
    const normalizedPhone = this.normalizeArgentinePhone(phone);

    const message = {
      messaging_product: 'whatsapp',
      to: normalizedPhone,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: body,
        },
        action: {
          buttons: buttons.map(btn => ({
            type: 'reply',
            reply: {
              id: btn.id,
              title: btn.title.substring(0, 20), // Max 20 chars
            },
          })),
        },
      },
    };

    try {
      const response = await this.client.post<SendMessageResult>(
        `/${this.phoneNumberId}/messages`,
        message
      );
      return response.data;
    } catch (error: any) {
      const whatsappError = error.response?.data?.error as WhatsAppError;
      if (whatsappError) {
        throw new Error(
          `WhatsApp API Error ${whatsappError.code}: ${whatsappError.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  /**
   * Get message status (requires webhook setup)
   */
  async getMessageStatus(messageId: string): Promise<'sent' | 'delivered' | 'read' | 'failed' | 'unknown'> {
    // Status is typically received via webhooks
    // This is a placeholder for direct status checking
    return 'unknown';
  }

  /**
   * Normalize phone number for Argentina
   * Converts various formats to WhatsApp format: 549XXXXXXXXXX
   */
  private normalizeArgentinePhone(phone: string): string {
    // Remove all non-digits
    let digits = phone.replace(/\D/g, '');

    // Remove leading zeros
    digits = digits.replace(/^0+/, '');

    // Handle different formats
    if (digits.startsWith('549')) {
      // Already in correct format
      return digits;
    } else if (digits.startsWith('54')) {
      // Has country code but missing 9 (mobile indicator)
      return '549' + digits.substring(2);
    } else if (digits.startsWith('9')) {
      // Has mobile indicator, needs country code
      return '54' + digits;
    } else if (digits.startsWith('11') || digits.startsWith('15')) {
      // Buenos Aires format
      if (digits.startsWith('15')) {
        digits = digits.substring(2); // Remove 15 prefix
      }
      return '5491' + digits;
    } else if (digits.length === 10) {
      // Standard 10-digit format (area code + number)
      return '549' + digits;
    } else if (digits.length === 8) {
      // Buenos Aires number without area code
      return '54911' + digits;
    }

    // Return as-is if we can't parse it
    return digits;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

let whatsAppServiceInstance: WhatsAppService | null = null;

export function initializeWhatsAppService(config: WhatsAppConfig): WhatsAppService {
  whatsAppServiceInstance = new WhatsAppService(config);
  return whatsAppServiceInstance;
}

export function getWhatsAppService(): WhatsAppService {
  if (!whatsAppServiceInstance) {
    throw new Error('WhatsApp service not initialized');
  }
  return whatsAppServiceInstance;
}

export function resetWhatsAppService(): void {
  whatsAppServiceInstance = null;
}
