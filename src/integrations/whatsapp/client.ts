/**
 * WhatsApp Cloud API Client
 * =========================
 *
 * Axios-based client for WhatsApp Business Cloud API.
 * Handles all API communication with Meta's Graph API.
 */

import axios from 'axios';
import type { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { log } from '../../lib/logging/logger';
import {
  WhatsAppConfig,
  SendMessageResponse,
  TemplateComponent,
  TemplateDefinition,
  MediaUploadResponse,
  MediaUrlResponse,
  InteractiveMessage,
  WA_API_BASE_URL,
  WA_API_VERSION,
  WAError,
  classifyWAError,
} from './whatsapp.types';

export interface WhatsAppClientConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
  apiVersion?: string;
}

export interface SendTextOptions {
  previewUrl?: boolean;
}

export interface SendTemplateOptions {
  languageCode?: string;
  components?: TemplateComponent[];
}

export interface SendMediaOptions {
  caption?: string;
  filename?: string;
}

export class WhatsAppClient {
  private client: AxiosInstance;
  private phoneNumberId: string;
  private businessAccountId?: string;
  private apiVersion: string;

  constructor(config: WhatsAppClientConfig) {
    this.phoneNumberId = config.phoneNumberId;
    this.businessAccountId = config.businessAccountId;
    this.apiVersion = config.apiVersion || WA_API_VERSION;

    this.client = axios.create({
      baseURL: `${WA_API_BASE_URL}/${this.apiVersion}`,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (error.response?.data) {
          const waError = this.parseError(error.response.data);
          log.error('WhatsApp API error', {
            code: waError.code,
            message: waError.message,
            type: classifyWAError(waError),
          });
        }
        throw error;
      }
    );
  }

  /**
   * Create client from WhatsAppConfig
   */
  static fromConfig(config: WhatsAppConfig): WhatsAppClient {
    return new WhatsAppClient({
      accessToken: config.accessToken,
      phoneNumberId: config.phoneNumberId,
      businessAccountId: config.businessAccountId,
      apiVersion: config.apiVersion,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEXT MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Send a text message
   */
  async sendTextMessage(
    to: string,
    text: string,
    options?: SendTextOptions
  ): Promise<SendMessageResponse> {
    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        body: text,
        preview_url: options?.previewUrl ?? false,
      },
    });

    log.info('Text message sent', { to, messageId: response.data.messages?.[0]?.id });
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEMPLATE MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Send a template message
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    options?: SendTemplateOptions
  ): Promise<SendMessageResponse> {
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: options?.languageCode || 'es_AR',
        },
      },
    };

    if (options?.components && options.components.length > 0) {
      payload.template.components = options.components;
    }

    const response = await this.client.post(`/${this.phoneNumberId}/messages`, payload);

    log.info('Template message sent', {
      to,
      template: templateName,
      messageId: response.data.messages?.[0]?.id,
    });
    return response.data;
  }

  /**
   * Build template components with variables
   */
  buildTemplateComponents(
    bodyParams?: string[],
    headerParams?: string[],
    buttonParams?: Array<{ index: number; type: string; text?: string }>
  ): TemplateComponent[] {
    const components: TemplateComponent[] = [];

    if (headerParams && headerParams.length > 0) {
      components.push({
        type: 'header',
        parameters: headerParams.map((text) => ({ type: 'text', text })),
      });
    }

    if (bodyParams && bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParams.map((text) => ({ type: 'text', text })),
      });
    }

    if (buttonParams && buttonParams.length > 0) {
      buttonParams.forEach((btn) => {
        components.push({
          type: 'button',
          subType: btn.type as any,
          index: btn.index,
          parameters: btn.text ? [{ type: 'text', text: btn.text }] : [],
        });
      });
    }

    return components;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MEDIA MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Send a media message (image, video, audio, document)
   */
  async sendMediaMessage(
    to: string,
    type: 'image' | 'video' | 'audio' | 'document',
    mediaIdOrUrl: string,
    options?: SendMediaOptions
  ): Promise<SendMessageResponse> {
    const mediaObject: any = mediaIdOrUrl.startsWith('http')
      ? { link: mediaIdOrUrl }
      : { id: mediaIdOrUrl };

    if (options?.caption && ['image', 'video', 'document'].includes(type)) {
      mediaObject.caption = options.caption;
    }

    if (options?.filename && type === 'document') {
      mediaObject.filename = options.filename;
    }

    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type,
      [type]: mediaObject,
    });

    log.info('Media message sent', {
      to,
      type,
      messageId: response.data.messages?.[0]?.id,
    });
    return response.data;
  }

  /**
   * Upload media to WhatsApp servers
   */
  async uploadMedia(
    file: Buffer,
    mimeType: string,
    filename: string
  ): Promise<MediaUploadResponse> {
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(file)], { type: mimeType }), filename);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mimeType);

    const response = await this.client.post(`/${this.phoneNumberId}/media`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    log.info('Media uploaded', { mediaId: response.data.id, mimeType });
    return response.data;
  }

  /**
   * Get media URL for downloading
   */
  async getMediaUrl(mediaId: string): Promise<MediaUrlResponse> {
    const response = await this.client.get(`/${mediaId}`);
    return response.data;
  }

  /**
   * Download media content
   */
  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    const response = await this.client.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: this.client.defaults.headers.Authorization as string,
      },
    });
    return Buffer.from(response.data);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INTERACTIVE MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Send a button message (max 3 buttons)
   */
  async sendButtonMessage(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    options?: { headerText?: string; footerText?: string }
  ): Promise<SendMessageResponse> {
    if (buttons.length > 3) {
      throw new Error('Maximum 3 buttons allowed');
    }

    const interactive: InteractiveMessage = {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((btn) => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title },
        })),
      },
    };

    if (options?.headerText) {
      interactive.header = { type: 'text', text: options.headerText };
    }

    if (options?.footerText) {
      interactive.footer = { text: options.footerText };
    }

    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    });

    log.info('Button message sent', { to, buttonCount: buttons.length });
    return response.data;
  }

  /**
   * Send a list message (max 10 items total)
   */
  async sendListMessage(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    options?: { headerText?: string; footerText?: string }
  ): Promise<SendMessageResponse> {
    const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);
    if (totalRows > 10) {
      throw new Error('Maximum 10 total rows allowed');
    }

    const interactive: InteractiveMessage = {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections: sections.map((section) => ({
          title: section.title,
          rows: section.rows,
        })),
      },
    };

    if (options?.headerText) {
      interactive.header = { type: 'text', text: options.headerText };
    }

    if (options?.footerText) {
      interactive.footer = { text: options.footerText };
    }

    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    });

    log.info('List message sent', { to, sectionCount: sections.length });
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MESSAGE STATUS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });

    log.debug('Message marked as read', { messageId });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEMPLATES MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get all message templates
   */
  async getTemplates(): Promise<TemplateDefinition[]> {
    if (!this.businessAccountId) {
      throw new Error('Business Account ID required for template operations');
    }

    const response = await this.client.get(
      `/${this.businessAccountId}/message_templates`,
      {
        params: {
          limit: 100,
          fields: 'name,language,status,category,components',
        },
      }
    );

    return response.data.data || [];
  }

  /**
   * Create a new message template
   */
  async createTemplate(template: {
    name: string;
    language: string;
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
    components: any[];
  }): Promise<any> {
    if (!this.businessAccountId) {
      throw new Error('Business Account ID required for template operations');
    }

    const response = await this.client.post(
      `/${this.businessAccountId}/message_templates`,
      template
    );

    log.info('Template created', { name: template.name });
    return response.data;
  }

  /**
   * Delete a message template
   */
  async deleteTemplate(templateName: string): Promise<void> {
    if (!this.businessAccountId) {
      throw new Error('Business Account ID required for template operations');
    }

    await this.client.delete(
      `/${this.businessAccountId}/message_templates`,
      {
        params: { name: templateName },
      }
    );

    log.info('Template deleted', { name: templateName });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PHONE NUMBER INFO
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get phone number details
   */
  async getPhoneNumberInfo(): Promise<{
    id: string;
    verified_name: string;
    display_phone_number: string;
    quality_rating: string;
  }> {
    const response = await this.client.get(`/${this.phoneNumberId}`, {
      params: {
        fields: 'verified_name,display_phone_number,quality_rating',
      },
    });
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOCATION MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Send a location message
   */
  async sendLocationMessage(
    to: string,
    latitude: number,
    longitude: number,
    options?: { name?: string; address?: string }
  ): Promise<SendMessageResponse> {
    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'location',
      location: {
        latitude,
        longitude,
        name: options?.name,
        address: options?.address,
      },
    });

    log.info('Location message sent', { to, latitude, longitude });
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONTACTS MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Send a contact card
   */
  async sendContactMessage(
    to: string,
    contacts: Array<{
      name: { formatted_name: string; first_name?: string; last_name?: string };
      phones?: Array<{ phone: string; type?: string }>;
      emails?: Array<{ email: string; type?: string }>;
    }>
  ): Promise<SendMessageResponse> {
    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'contacts',
      contacts,
    });

    log.info('Contact message sent', { to, contactCount: contacts.length });
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Parse API error response
   */
  private parseError(data: any): WAError {
    const error = data.error || data;
    return {
      code: error.code || 0,
      message: error.message || 'Unknown error',
      errorSubcode: error.error_subcode,
      fbtraceId: error.fbtrace_id,
    };
  }
}

// Default export
export default WhatsAppClient;
