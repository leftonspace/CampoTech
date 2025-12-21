/**
 * Meta Direct Provider
 * ====================
 *
 * WhatsApp BSP provider for organizations using their own Meta Business credentials.
 * This provider wraps the Meta WhatsApp Cloud API.
 *
 * Note: This provider does NOT support number provisioning.
 * Organizations must set up their WhatsApp Business account manually through Meta.
 */

import crypto from 'crypto';
import type {
  WhatsAppBSPProvider,
  BSPProviderType,
  MetaDirectConfig,
  PhoneNumber,
  ProvisionResult,
  VerificationResult,
  OutboundMessage,
  SendResult,
  WebhookConfig,
  InboundMessage,
  InboundContent,
  MessageStatusUpdate,
  AccountStatus,
  UsageStats,
  TemplateComponent,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// META API TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface MetaAPIResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

interface MetaAPIError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

interface MetaWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: { name: string };
        wa_id: string;
      }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        type: string;
        text?: { body: string };
        image?: { id: string; mime_type: string; sha256?: string; caption?: string };
        video?: { id: string; mime_type: string; sha256?: string; caption?: string };
        audio?: { id: string; mime_type: string; sha256?: string; voice?: boolean };
        document?: { id: string; mime_type: string; sha256?: string; filename?: string; caption?: string };
        sticker?: { id: string; mime_type: string; animated?: boolean };
        location?: { latitude: number; longitude: number; name?: string; address?: string };
        contacts?: Array<{ name: { formatted_name: string }; phones?: Array<{ phone: string }> }>;
        reaction?: { message_id: string; emoji: string };
        button?: { payload: string; text: string };
        interactive?: {
          type: string;
          button_reply?: { id: string; title: string };
          list_reply?: { id: string; title: string };
        };
        context?: { from?: string; id: string };
      }>;
      statuses?: Array<{
        id: string;
        recipient_id: string;
        status: string;
        timestamp: string;
        errors?: Array<{
          code: number;
          title: string;
          message?: string;
        }>;
      }>;
    };
    field: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// META DIRECT PROVIDER IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export class MetaDirectProvider implements WhatsAppBSPProvider {
  readonly name: BSPProviderType = 'META_DIRECT';
  readonly displayName = 'Meta Direct';

  private config: MetaDirectConfig;
  private apiVersion: string;
  private baseUrl = 'https://graph.facebook.com';

  constructor(config: MetaDirectConfig) {
    this.config = config;
    this.apiVersion = config.apiVersion || 'v18.0';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Number Provisioning (NOT SUPPORTED for Meta Direct)
  // ─────────────────────────────────────────────────────────────────────────────

  async getAvailableNumbers(_countryCode: string, _areaCode?: string): Promise<PhoneNumber[]> {
    // Meta Direct doesn't support number provisioning via API
    // Users must set up their own WhatsApp Business account through Meta
    return [];
  }

  async provisionNumber(_organizationId: string, _phoneNumber: string): Promise<ProvisionResult> {
    return {
      success: false,
      status: 'NOT_STARTED',
      error: 'Meta Direct provider does not support number provisioning. Please configure your WhatsApp Business credentials manually.',
    };
  }

  async releaseNumber(_organizationId: string): Promise<void> {
    // No-op for Meta Direct
    console.log('[MetaDirect] releaseNumber is a no-op for manual credentials');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Verification (NOT SUPPORTED for Meta Direct)
  // ─────────────────────────────────────────────────────────────────────────────

  async sendVerificationCode(_organizationId: string, _ownerPhone: string): Promise<{ success: boolean; error?: string }> {
    return {
      success: false,
      error: 'Meta Direct provider does not require verification through CampoTech. Your number is verified through Meta Business Manager.',
    };
  }

  async verifyCode(_organizationId: string, _code: string): Promise<VerificationResult> {
    return {
      success: false,
      status: 'NOT_STARTED',
      error: 'Meta Direct provider does not require verification through CampoTech.',
      ready: false,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Messaging
  // ─────────────────────────────────────────────────────────────────────────────

  async sendMessage(_organizationId: string, message: OutboundMessage): Promise<SendResult> {
    try {
      const formattedPhone = this.formatPhoneNumber(message.to);

      let body: Record<string, unknown>;

      switch (message.content.type) {
        case 'text':
          body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'text',
            text: {
              preview_url: message.content.previewUrl || false,
              body: message.content.body,
            },
          };
          break;

        case 'template':
          body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'template',
            template: {
              name: message.content.name,
              language: { code: message.content.language },
              components: message.content.components,
            },
          };
          break;

        case 'interactive':
          body = this.buildInteractiveMessage(formattedPhone, message.content);
          break;

        case 'media':
          body = this.buildMediaMessage(formattedPhone, message.content);
          break;

        default:
          return {
            success: false,
            error: 'Unsupported message type',
          };
      }

      // Add context for replies
      if (message.replyTo) {
        body.context = { message_id: message.replyTo };
      }

      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as MetaAPIError;
        console.error('[MetaDirect] API error:', errorData.error);
        return {
          success: false,
          error: errorData.error.message,
          errorCode: String(errorData.error.code),
          retryable: this.isRetryableError(errorData.error.code),
        };
      }

      const successData = data as MetaAPIResponse;
      return {
        success: true,
        messageId: successData.messages[0].id,
        waMessageId: successData.messages[0].id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[MetaDirect] Send error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
        retryable: true,
      };
    }
  }

  async sendTemplate(
    organizationId: string,
    to: string,
    templateName: string,
    language: string,
    components?: TemplateComponent[]
  ): Promise<SendResult> {
    return this.sendMessage(organizationId, {
      to,
      type: 'template',
      content: {
        type: 'template',
        name: templateName,
        language,
        components,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Webhook
  // ─────────────────────────────────────────────────────────────────────────────

  async getWebhookConfig(_organizationId: string): Promise<WebhookConfig> {
    return {
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.campo.tech'}/api/webhooks/whatsapp`,
      verifyToken: this.config.webhookVerifyToken || '',
      secret: this.config.appSecret,
    };
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!secret) {
      console.warn('[MetaDirect] No app secret configured for webhook verification');
      return true; // Allow if no secret configured (not recommended for production)
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    );
  }

  parseInboundMessage(payload: unknown): InboundMessage | null {
    try {
      const webhookPayload = payload as { entry?: MetaWebhookEntry[] };

      if (!webhookPayload.entry || webhookPayload.entry.length === 0) {
        return null;
      }

      const entry = webhookPayload.entry[0];
      const changes = entry.changes?.[0]?.value;

      if (!changes?.messages || changes.messages.length === 0) {
        return null;
      }

      const message = changes.messages[0];
      const contact = changes.contacts?.[0];

      const content = this.parseMessageContent(message);
      if (!content) {
        return null;
      }

      return {
        messageId: message.id,
        waMessageId: message.id,
        from: message.from,
        fromName: contact?.profile?.name,
        timestamp: new Date(parseInt(message.timestamp) * 1000),
        type: message.type as InboundMessage['type'],
        content,
        context: message.context ? {
          messageId: message.context.id,
          from: message.context.from,
        } : undefined,
        metadata: {
          phoneNumberId: changes.metadata.phone_number_id,
          displayPhoneNumber: changes.metadata.display_phone_number,
        },
      };
    } catch (error) {
      console.error('[MetaDirect] Error parsing inbound message:', error);
      return null;
    }
  }

  parseStatusUpdate(payload: unknown): MessageStatusUpdate | null {
    try {
      const webhookPayload = payload as { entry?: MetaWebhookEntry[] };

      if (!webhookPayload.entry || webhookPayload.entry.length === 0) {
        return null;
      }

      const entry = webhookPayload.entry[0];
      const changes = entry.changes?.[0]?.value;

      if (!changes?.statuses || changes.statuses.length === 0) {
        return null;
      }

      const status = changes.statuses[0];

      return {
        messageId: status.id,
        waMessageId: status.id,
        recipient: status.recipient_id,
        status: status.status as MessageStatusUpdate['status'],
        timestamp: new Date(parseInt(status.timestamp) * 1000),
        error: status.errors?.[0] ? {
          code: String(status.errors[0].code),
          title: status.errors[0].title,
          message: status.errors[0].message,
        } : undefined,
      };
    } catch (error) {
      console.error('[MetaDirect] Error parsing status update:', error);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Status & Usage
  // ─────────────────────────────────────────────────────────────────────────────

  async getAccountStatus(_organizationId: string): Promise<AccountStatus> {
    try {
      // Fetch phone number info from Meta API
      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${this.config.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating,messaging_limit_tier`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        return {
          active: false,
          provisioningStatus: 'NOT_STARTED',
          issues: [{
            type: 'ERROR',
            code: 'API_ERROR',
            message: 'Failed to fetch account status from Meta',
          }],
        };
      }

      const data = await response.json();

      return {
        active: true,
        provisioningStatus: 'ACTIVE',
        phoneNumber: {
          id: this.config.phoneNumberId,
          number: data.display_phone_number,
          displayNumber: data.display_phone_number,
        },
        qualityRating: data.quality_rating as AccountStatus['qualityRating'],
        messagingTier: data.messaging_limit_tier,
      };
    } catch (error) {
      console.error('[MetaDirect] Error fetching account status:', error);
      return {
        active: false,
        provisioningStatus: 'NOT_STARTED',
        issues: [{
          type: 'ERROR',
          code: 'FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        }],
      };
    }
  }

  async getUsageStats(_organizationId: string): Promise<UsageStats> {
    // Meta doesn't provide usage stats via API for individual phone numbers
    // This would need to be tracked by CampoTech internally
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      periodStart,
      periodEnd,
      messagesSent: 0, // Would be fetched from CampoTech database
      messagesReceived: 0,
      conversationsOpened: 0,
      aiResponses: 0,
      limits: {
        monthlyMessages: -1, // Unlimited for Meta Direct (depends on Meta tier)
        used: 0,
        remaining: -1,
        percentUsed: 0,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Provider Capabilities
  // ─────────────────────────────────────────────────────────────────────────────

  supportsProvisioning(): boolean {
    return false;
  }

  supportsTemplates(): boolean {
    return true;
  }

  supportsInteractive(): boolean {
    return true;
  }

  supportsMedia(): boolean {
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    return phone.replace(/\D/g, '');
  }

  private isRetryableError(errorCode: number): boolean {
    // Meta API error codes that are retryable
    const retryableCodes = [
      1, // Unknown error
      2, // Service unavailable
      4, // API too many calls
      17, // API user too many calls
      130429, // Rate limit hit
      131031, // Generic error (retry)
    ];
    return retryableCodes.includes(errorCode);
  }

  private buildInteractiveMessage(to: string, content: OutboundMessage['content']): Record<string, unknown> {
    if (content.type !== 'interactive') {
      throw new Error('Invalid content type for interactive message');
    }

    const interactive: Record<string, unknown> = {
      type: content.interactiveType,
      body: { text: content.body },
    };

    if (content.header) {
      interactive.header = content.header;
    }

    if (content.footer) {
      interactive.footer = { text: content.footer };
    }

    if (content.buttons) {
      interactive.action = {
        buttons: content.buttons.map(btn => ({
          type: btn.type,
          reply: btn.reply,
        })),
      };
    }

    if (content.sections) {
      interactive.action = {
        sections: content.sections,
      };
    }

    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    };
  }

  private buildMediaMessage(to: string, content: OutboundMessage['content']): Record<string, unknown> {
    if (content.type !== 'media') {
      throw new Error('Invalid content type for media message');
    }

    const mediaContent: Record<string, unknown> = {};

    if (content.url) {
      mediaContent.link = content.url;
    } else if (content.mediaId) {
      mediaContent.id = content.mediaId;
    }

    if (content.caption) {
      mediaContent.caption = content.caption;
    }

    if (content.filename && content.mediaType === 'document') {
      mediaContent.filename = content.filename;
    }

    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: content.mediaType,
      [content.mediaType]: mediaContent,
    };
  }

  private parseMessageContent(message: {
    type: string;
    text?: { body: string };
    image?: { id: string; mime_type: string; sha256?: string; caption?: string };
    video?: { id: string; mime_type: string; sha256?: string; caption?: string };
    audio?: { id: string; mime_type: string; sha256?: string; voice?: boolean };
    document?: { id: string; mime_type: string; sha256?: string; filename?: string; caption?: string };
    sticker?: { id: string; mime_type: string; animated?: boolean };
    location?: { latitude: number; longitude: number; name?: string; address?: string };
    contacts?: Array<{ name: { formatted_name: string }; phones?: Array<{ phone: string }> }>;
    reaction?: { message_id: string; emoji: string };
    button?: { payload: string; text: string };
    interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
  }): InboundContent | null {
    switch (message.type) {
      case 'text':
        return message.text ? { type: 'text', body: message.text.body } : null;

      case 'image':
        return message.image ? {
          type: 'image',
          id: message.image.id,
          mimeType: message.image.mime_type,
          sha256: message.image.sha256,
          caption: message.image.caption,
        } : null;

      case 'video':
        return message.video ? {
          type: 'video',
          id: message.video.id,
          mimeType: message.video.mime_type,
          sha256: message.video.sha256,
          caption: message.video.caption,
        } : null;

      case 'audio':
        return message.audio ? {
          type: 'audio',
          id: message.audio.id,
          mimeType: message.audio.mime_type,
          sha256: message.audio.sha256,
          voice: message.audio.voice,
        } : null;

      case 'document':
        return message.document ? {
          type: 'document',
          id: message.document.id,
          mimeType: message.document.mime_type,
          sha256: message.document.sha256,
          filename: message.document.filename,
          caption: message.document.caption,
        } : null;

      case 'sticker':
        return message.sticker ? {
          type: 'sticker',
          id: message.sticker.id,
          mimeType: message.sticker.mime_type,
          animated: message.sticker.animated,
        } : null;

      case 'location':
        return message.location ? {
          type: 'location',
          latitude: message.location.latitude,
          longitude: message.location.longitude,
          name: message.location.name,
          address: message.location.address,
        } : null;

      case 'contacts':
        return message.contacts ? {
          type: 'contacts',
          contacts: message.contacts,
        } : null;

      case 'reaction':
        return message.reaction ? {
          type: 'reaction',
          messageId: message.reaction.message_id,
          emoji: message.reaction.emoji,
        } : null;

      case 'button':
        return message.button ? {
          type: 'button',
          payload: message.button.payload,
          text: message.button.text,
        } : null;

      case 'interactive':
        return message.interactive ? {
          type: 'interactive',
          buttonReply: message.interactive.button_reply,
          listReply: message.interactive.list_reply,
        } : null;

      default:
        console.warn(`[MetaDirect] Unknown message type: ${message.type}`);
        return null;
    }
  }
}
