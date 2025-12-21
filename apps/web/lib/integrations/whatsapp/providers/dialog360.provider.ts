/**
 * 360dialog WhatsApp BSP Provider
 * ================================
 *
 * Implementation of the WhatsAppBSPProvider interface for 360dialog.
 * 360dialog is a Meta Business Solution Provider (BSP) that allows
 * CampoTech to provision WhatsApp numbers for customers.
 *
 * Features:
 * - Number provisioning via Partner API
 * - Message sending via WABA API
 * - Webhook handling
 * - Account status and usage tracking
 *
 * API Documentation: https://docs.360dialog.com/
 */

import type {
  WhatsAppBSPProvider,
  BSPProviderType,
  PhoneNumber,
  ProvisionResult,
  VerificationResult,
  OutboundMessage,
  SendResult,
  WebhookConfig,
  InboundMessage,
  MessageStatusUpdate,
  AccountStatus,
  UsageStats,
  TemplateComponent,
  Dialog360Config,
} from './types';

import {
  DIALOG360_API_BASE_URL,
  DIALOG360_PARTNER_API_BASE_URL,
  type CreateChannelRequest,
  type CreateChannelResponse,
  type Channel,
  type AvailableNumber,
  type SendMessageRequest,
  type SendMessageResponse,
  type Dialog360Error,
  type WebhookPayload,
  type WebhookMessage,
  type WebhookStatus,
  type PhoneInfo,
} from './dialog360.types';

import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// DIALOG 360 PROVIDER IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export class Dialog360Provider implements WhatsAppBSPProvider {
  readonly name: BSPProviderType = 'DIALOG_360';
  readonly displayName = '360dialog';

  private readonly config: Dialog360Config;
  private readonly partnerApiUrl: string;
  private readonly wabaApiUrl: string;

  constructor(config: Dialog360Config) {
    this.config = config;
    this.partnerApiUrl = config.apiBaseUrl || DIALOG360_PARTNER_API_BASE_URL;
    this.wabaApiUrl = DIALOG360_API_BASE_URL;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Number Provisioning
  // ─────────────────────────────────────────────────────────────────────────────

  async getAvailableNumbers(countryCode: string, areaCode?: string): Promise<PhoneNumber[]> {
    try {
      // 360dialog Partner API endpoint for available numbers
      const url = new URL(`${this.partnerApiUrl}/v1/partners/${this.config.partnerId}/numbers/available`);
      url.searchParams.set('country', countryCode);
      if (areaCode) {
        url.searchParams.set('area_code', areaCode);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json() as Dialog360Error;
        console.error('[Dialog360] Failed to get available numbers:', error);
        return [];
      }

      const data = await response.json() as { numbers: AvailableNumber[] };

      return data.numbers.map((num) => ({
        id: num.phone,
        phoneNumber: num.phone,
        displayNumber: num.displayPhone,
        countryCode: num.countryCode,
        areaCode: num.areaCode,
        available: true,
        monthlyCost: num.monthlyCostCents
          ? { amount: num.monthlyCostCents / 100, currency: num.currency || 'USD' }
          : undefined,
        metadata: { source: '360dialog' },
      }));
    } catch (error) {
      console.error('[Dialog360] Error fetching available numbers:', error);
      return [];
    }
  }

  async provisionNumber(organizationId: string, phoneNumber: string): Promise<ProvisionResult> {
    try {
      const { prisma } = await import('@/lib/prisma');

      // Get organization details for the channel name
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });

      if (!org) {
        return {
          success: false,
          status: 'NOT_STARTED',
          error: 'Organization not found',
        };
      }

      // Build webhook URL for this organization
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
      const webhookUrl = `${baseUrl}/api/webhooks/dialog360?orgId=${organizationId}`;

      // Create channel via Partner API
      const createRequest: CreateChannelRequest = {
        name: org.name,
        phone: phoneNumber,
        webhookUrl,
      };

      const response = await fetch(
        `${this.partnerApiUrl}/v1/partners/${this.config.partnerId}/channels`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createRequest),
        }
      );

      if (!response.ok) {
        const error = await response.json() as Dialog360Error;
        console.error('[Dialog360] Failed to provision number:', error);
        return {
          success: false,
          status: 'NOT_STARTED',
          error: error.error?.message || 'Failed to provision number',
        };
      }

      const channel = await response.json() as CreateChannelResponse;

      // Update organization's WhatsApp business account
      await prisma.whatsAppBusinessAccount.upsert({
        where: { organizationId },
        create: {
          organizationId,
          phoneNumberId: channel.phoneNumberId || channel.id,
          displayPhoneNumber: phoneNumber,
          accessToken: channel.apiKey, // Channel-specific API key
          bspProvider: 'DIALOG_360',
          bspAccountId: channel.id,
          provisioningStatus: channel.status === 'active' ? 'ACTIVE' : 'VERIFICATION_PENDING',
        },
        update: {
          phoneNumberId: channel.phoneNumberId || channel.id,
          displayPhoneNumber: phoneNumber,
          accessToken: channel.apiKey,
          bspProvider: 'DIALOG_360',
          bspAccountId: channel.id,
          provisioningStatus: channel.status === 'active' ? 'ACTIVE' : 'VERIFICATION_PENDING',
        },
      });

      // Update organization's integration type
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          whatsappIntegrationType: 'BSP_API',
        },
      });

      return {
        success: true,
        phoneNumberId: channel.phoneNumberId || channel.id,
        phoneNumber,
        displayNumber: phoneNumber,
        status: channel.status === 'active' ? 'ACTIVE' : 'VERIFICATION_PENDING',
        nextStep: channel.status === 'pending' ? 'VERIFY_CODE' : undefined,
        providerData: {
          channelId: channel.id,
          wabaId: channel.wabaId,
        },
      };
    } catch (error) {
      console.error('[Dialog360] Error provisioning number:', error);
      return {
        success: false,
        status: 'NOT_STARTED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async releaseNumber(organizationId: string): Promise<void> {
    try {
      const { prisma } = await import('@/lib/prisma');

      // Get the WhatsApp business account
      const account = await prisma.whatsAppBusinessAccount.findUnique({
        where: { organizationId },
        select: { bspAccountId: true },
      });

      if (!account?.bspAccountId) {
        console.warn('[Dialog360] No channel found for organization:', organizationId);
        return;
      }

      // Delete channel via Partner API
      const response = await fetch(
        `${this.partnerApiUrl}/v1/partners/${this.config.partnerId}/channels/${account.bspAccountId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        }
      );

      if (!response.ok && response.status !== 404) {
        const error = await response.json() as Dialog360Error;
        console.error('[Dialog360] Failed to release number:', error);
        throw new Error(error.error?.message || 'Failed to release number');
      }

      // Update database
      await prisma.whatsAppBusinessAccount.update({
        where: { organizationId },
        data: {
          provisioningStatus: 'RELEASED',
          bspAccountId: null,
        },
      });

      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          whatsappIntegrationType: 'NONE',
        },
      });
    } catch (error) {
      console.error('[Dialog360] Error releasing number:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Verification
  // ─────────────────────────────────────────────────────────────────────────────

  async sendVerificationCode(
    organizationId: string,
    ownerPhone: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { prisma } = await import('@/lib/prisma');

      // Get channel info
      const account = await prisma.whatsAppBusinessAccount.findUnique({
        where: { organizationId },
        select: { bspAccountId: true, accessToken: true },
      });

      if (!account?.bspAccountId) {
        return { success: false, error: 'No channel found' };
      }

      // 360dialog verification is typically done via their dashboard
      // or through the phone verification flow
      // For programmatic verification, we request a code to be sent
      const response = await fetch(
        `${this.wabaApiUrl}/v1/${account.bspAccountId}/request_code`,
        {
          method: 'POST',
          headers: {
            'D360-API-KEY': account.accessToken!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code_method: 'SMS',
            phone_number: ownerPhone,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json() as Dialog360Error;
        return { success: false, error: error.error?.message || 'Failed to send verification code' };
      }

      // Store verification state
      await prisma.whatsAppBusinessAccount.update({
        where: { organizationId },
        data: {
          verificationCode: null,
          verificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          provisioningStatus: 'VERIFICATION_PENDING',
        },
      });

      return { success: true };
    } catch (error) {
      console.error('[Dialog360] Error sending verification code:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async verifyCode(organizationId: string, code: string): Promise<VerificationResult> {
    try {
      const { prisma } = await import('@/lib/prisma');

      const account = await prisma.whatsAppBusinessAccount.findUnique({
        where: { organizationId },
        select: { bspAccountId: true, accessToken: true },
      });

      if (!account?.bspAccountId) {
        return { success: false, status: 'NOT_STARTED', error: 'No channel found', ready: false };
      }

      // Verify the code with 360dialog
      const response = await fetch(
        `${this.wabaApiUrl}/v1/${account.bspAccountId}/register`,
        {
          method: 'POST',
          headers: {
            'D360-API-KEY': account.accessToken!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        }
      );

      if (!response.ok) {
        const error = await response.json() as Dialog360Error;
        return {
          success: false,
          status: 'VERIFICATION_PENDING',
          error: error.error?.message || 'Invalid verification code',
          ready: false,
        };
      }

      // Update status
      await prisma.whatsAppBusinessAccount.update({
        where: { organizationId },
        data: {
          provisioningStatus: 'VERIFIED',
          verificationCode: null,
          verificationExpiresAt: null,
          provisionedAt: new Date(),
        },
      });

      return {
        success: true,
        status: 'VERIFIED',
        ready: true,
      };
    } catch (error) {
      console.error('[Dialog360] Error verifying code:', error);
      return {
        success: false,
        status: 'VERIFICATION_PENDING',
        error: error instanceof Error ? error.message : 'Unknown error',
        ready: false,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Messaging
  // ─────────────────────────────────────────────────────────────────────────────

  async sendMessage(organizationId: string, message: OutboundMessage): Promise<SendResult> {
    try {
      const { prisma } = await import('@/lib/prisma');

      const account = await prisma.whatsAppBusinessAccount.findUnique({
        where: { organizationId },
        select: { accessToken: true, provisioningStatus: true },
      });

      if (!account?.accessToken) {
        return { success: false, error: 'No WhatsApp account configured' };
      }

      if (account.provisioningStatus !== 'ACTIVE' && account.provisioningStatus !== 'VERIFIED') {
        return { success: false, error: 'WhatsApp account not active' };
      }

      // Build the message request based on type
      const messageRequest = this.buildMessageRequest(message);

      const response = await fetch(`${this.wabaApiUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'D360-API-KEY': account.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageRequest),
      });

      if (!response.ok) {
        const error = await response.json() as Dialog360Error;
        console.error('[Dialog360] Failed to send message:', error);
        return {
          success: false,
          error: error.error?.message || 'Failed to send message',
          errorCode: String(error.error?.code),
          retryable: error.error?.code === 429 || error.error?.code >= 500,
        };
      }

      const result = await response.json() as SendMessageResponse;

      // Increment message count
      await prisma.whatsAppBusinessAccount.update({
        where: { organizationId },
        data: { monthlyMessageCount: { increment: 1 } },
      });

      return {
        success: true,
        messageId: result.messages[0]?.id,
        waMessageId: result.messages[0]?.id,
      };
    } catch (error) {
      console.error('[Dialog360] Error sending message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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

  private buildMessageRequest(message: OutboundMessage): SendMessageRequest {
    const baseRequest: SendMessageRequest = {
      to: message.to,
      type: 'text',
    };

    if (message.replyTo) {
      baseRequest.context = { message_id: message.replyTo };
    }

    switch (message.content.type) {
      case 'text':
        return {
          ...baseRequest,
          type: 'text',
          text: {
            body: message.content.body,
            preview_url: message.content.previewUrl,
          },
        };

      case 'template':
        return {
          ...baseRequest,
          type: 'template',
          template: {
            namespace: 'default', // 360dialog uses 'default' namespace
            name: message.content.name,
            language: {
              code: message.content.language,
              policy: 'deterministic',
            },
            components: message.content.components?.map((c) => ({
              type: c.type,
              sub_type: c.subType,
              index: c.index,
              parameters: c.parameters.map((p) => ({
                type: p.type,
                text: p.text,
                currency: p.currency,
                date_time: p.date_time,
                image: p.image,
                document: p.document,
                video: p.video,
              })),
            })),
          },
        };

      case 'interactive':
        return {
          ...baseRequest,
          type: 'interactive',
          interactive: {
            type: message.content.interactiveType,
            header: message.content.header
              ? {
                  type: message.content.header.type,
                  text: message.content.header.text,
                  image: message.content.header.image,
                  video: message.content.header.video,
                  document: message.content.header.document,
                }
              : undefined,
            body: { text: message.content.body },
            footer: message.content.footer ? { text: message.content.footer } : undefined,
            action: {
              buttons: message.content.buttons,
              sections: message.content.sections?.map((s) => ({
                title: s.title,
                rows: s.rows,
              })),
            },
          },
        };

      case 'media':
        const mediaType = message.content.mediaType;
        return {
          ...baseRequest,
          type: mediaType,
          [mediaType]: {
            id: message.content.mediaId,
            link: message.content.url,
            caption: message.content.caption,
            ...(mediaType === 'document' && message.content.filename
              ? { filename: message.content.filename }
              : {}),
          },
        };

      default:
        throw new Error(`Unsupported message type: ${(message.content as { type: string }).type}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Webhook
  // ─────────────────────────────────────────────────────────────────────────────

  async getWebhookConfig(organizationId: string): Promise<WebhookConfig> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
    return {
      url: `${baseUrl}/api/webhooks/dialog360?orgId=${organizationId}`,
      verifyToken: this.config.webhookSecret || '',
      secret: this.config.webhookSecret,
    };
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!secret || !signature) {
      return false;
    }

    // 360dialog uses HMAC-SHA256 for webhook signatures
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Handle both formats: "sha256=..." and plain hex
    const actualSignature = signature.startsWith('sha256=')
      ? signature.slice(7)
      : signature;

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(actualSignature)
    );
  }

  parseInboundMessage(payload: unknown): InboundMessage | null {
    try {
      const webhookPayload = payload as WebhookPayload;

      if (webhookPayload.object !== 'whatsapp_business_account') {
        return null;
      }

      for (const entry of webhookPayload.entry) {
        for (const change of entry.changes) {
          if (change.field !== 'messages') continue;

          const value = change.value;
          const messages = value.messages;
          const contacts = value.contacts;

          if (!messages?.length) continue;

          const msg = messages[0];
          const contact = contacts?.[0];

          return {
            messageId: msg.id,
            waMessageId: msg.id,
            from: msg.from,
            fromName: contact?.profile?.name,
            timestamp: new Date(parseInt(msg.timestamp) * 1000),
            type: this.mapMessageType(msg.type),
            content: this.parseMessageContent(msg),
            context: msg.context
              ? { messageId: msg.context.id, from: msg.context.from }
              : undefined,
            metadata: {
              phoneNumberId: value.metadata.phone_number_id,
              displayPhoneNumber: value.metadata.display_phone_number,
            },
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[Dialog360] Error parsing inbound message:', error);
      return null;
    }
  }

  parseStatusUpdate(payload: unknown): MessageStatusUpdate | null {
    try {
      const webhookPayload = payload as WebhookPayload;

      if (webhookPayload.object !== 'whatsapp_business_account') {
        return null;
      }

      for (const entry of webhookPayload.entry) {
        for (const change of entry.changes) {
          if (change.field !== 'messages') continue;

          const statuses = change.value.statuses;
          if (!statuses?.length) continue;

          const status = statuses[0];

          return {
            messageId: status.id,
            waMessageId: status.id,
            recipient: status.recipient_id,
            status: status.status,
            timestamp: new Date(parseInt(status.timestamp) * 1000),
            error: status.errors?.[0]
              ? {
                  code: String(status.errors[0].code),
                  title: status.errors[0].title,
                  message: status.errors[0].message,
                }
              : undefined,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[Dialog360] Error parsing status update:', error);
      return null;
    }
  }

  private mapMessageType(type: string): InboundMessage['type'] {
    const typeMap: Record<string, InboundMessage['type']> = {
      text: 'text',
      image: 'image',
      video: 'video',
      audio: 'audio',
      document: 'document',
      sticker: 'sticker',
      location: 'location',
      contacts: 'contacts',
      reaction: 'reaction',
      button: 'button',
      interactive: 'interactive',
    };
    return typeMap[type] || 'text';
  }

  private parseMessageContent(msg: WebhookMessage): InboundMessage['content'] {
    switch (msg.type) {
      case 'text':
        return { type: 'text', body: msg.text?.body || '' };

      case 'image':
        return {
          type: 'image',
          id: msg.image!.id,
          mimeType: msg.image!.mime_type,
          sha256: msg.image!.sha256,
          caption: msg.image!.caption,
        };

      case 'video':
        return {
          type: 'video',
          id: msg.video!.id,
          mimeType: msg.video!.mime_type,
          sha256: msg.video!.sha256,
          caption: msg.video!.caption,
        };

      case 'audio':
        return {
          type: 'audio',
          id: msg.audio!.id,
          mimeType: msg.audio!.mime_type,
          sha256: msg.audio!.sha256,
          voice: msg.audio!.voice,
        };

      case 'document':
        return {
          type: 'document',
          id: msg.document!.id,
          mimeType: msg.document!.mime_type,
          sha256: msg.document!.sha256,
          filename: msg.document!.filename,
          caption: msg.document!.caption,
        };

      case 'sticker':
        return {
          type: 'sticker',
          id: msg.sticker!.id,
          mimeType: msg.sticker!.mime_type,
          animated: msg.sticker!.animated,
        };

      case 'location':
        return {
          type: 'location',
          latitude: msg.location!.latitude,
          longitude: msg.location!.longitude,
          name: msg.location!.name,
          address: msg.location!.address,
        };

      case 'contacts':
        return {
          type: 'contacts',
          contacts:
            msg.contacts?.map((c) => ({
              name: { formatted_name: c.name.formatted_name },
              phones: c.phones?.map((p) => ({ phone: p.phone })),
            })) || [],
        };

      case 'reaction':
        return {
          type: 'reaction',
          messageId: msg.reaction!.message_id,
          emoji: msg.reaction!.emoji,
        };

      case 'button':
        return {
          type: 'button',
          payload: msg.button!.payload,
          text: msg.button!.text,
        };

      case 'interactive':
        return {
          type: 'interactive',
          buttonReply: msg.interactive?.button_reply,
          listReply: msg.interactive?.list_reply,
        };

      default:
        return { type: 'text', body: '' };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Status & Usage
  // ─────────────────────────────────────────────────────────────────────────────

  async getAccountStatus(organizationId: string): Promise<AccountStatus> {
    try {
      const { prisma } = await import('@/lib/prisma');

      const account = await prisma.whatsAppBusinessAccount.findUnique({
        where: { organizationId },
        select: {
          phoneNumberId: true,
          displayPhoneNumber: true,
          accessToken: true,
          provisioningStatus: true,
          bspAccountId: true,
        },
      });

      if (!account) {
        return {
          active: false,
          provisioningStatus: 'NOT_STARTED',
        };
      }

      // Get phone info from 360dialog
      let phoneInfo: PhoneInfo | null = null;
      if (account.accessToken && account.phoneNumberId) {
        try {
          const response = await fetch(
            `${this.wabaApiUrl}/v1/settings/business/profile`,
            {
              headers: {
                'D360-API-KEY': account.accessToken,
              },
            }
          );

          if (response.ok) {
            phoneInfo = await response.json() as PhoneInfo;
          }
        } catch {
          // Ignore errors fetching phone info
        }
      }

      const isActive =
        account.provisioningStatus === 'ACTIVE' ||
        account.provisioningStatus === 'VERIFIED';

      return {
        active: isActive,
        provisioningStatus: account.provisioningStatus as AccountStatus['provisioningStatus'],
        phoneNumber: account.displayPhoneNumber
          ? {
              id: account.phoneNumberId!,
              number: account.displayPhoneNumber,
              displayNumber: account.displayPhoneNumber,
            }
          : undefined,
        qualityRating: phoneInfo?.quality_rating,
        messagingTier: phoneInfo?.messaging_limit_tier,
      };
    } catch (error) {
      console.error('[Dialog360] Error getting account status:', error);
      return {
        active: false,
        provisioningStatus: 'NOT_STARTED',
      };
    }
  }

  async getUsageStats(organizationId: string): Promise<UsageStats> {
    try {
      const { prisma } = await import('@/lib/prisma');

      const account = await prisma.whatsAppBusinessAccount.findUnique({
        where: { organizationId },
        select: {
          monthlyMessageCount: true,
          lastBillingReset: true,
          organization: {
            select: {
              subscription: {
                select: { tier: true },
              },
            },
          },
        },
      });

      // Get message counts from database
      const now = new Date();
      const periodStart = account?.lastBillingReset || new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get actual message counts
      const [sentCount, receivedCount] = await Promise.all([
        prisma.whatsAppMessage.count({
          where: {
            conversation: { organizationId },
            direction: 'OUTBOUND',
            createdAt: { gte: periodStart },
          },
        }),
        prisma.whatsAppMessage.count({
          where: {
            conversation: { organizationId },
            direction: 'INBOUND',
            createdAt: { gte: periodStart },
          },
        }),
      ]);

      // Determine monthly limit based on subscription tier
      const tier = account?.organization?.subscription?.tier || 'FREE';
      const monthlyLimit = this.getMonthlyLimitForTier(tier);
      const used = account?.monthlyMessageCount || 0;

      return {
        periodStart,
        periodEnd,
        messagesSent: sentCount,
        messagesReceived: receivedCount,
        conversationsOpened: 0, // Would need separate tracking
        aiResponses: 0, // Would need separate tracking
        limits: {
          monthlyMessages: monthlyLimit,
          used,
          remaining: Math.max(0, monthlyLimit - used),
          percentUsed: monthlyLimit > 0 ? (used / monthlyLimit) * 100 : 0,
        },
      };
    } catch (error) {
      console.error('[Dialog360] Error getting usage stats:', error);
      const now = new Date();
      return {
        periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
        periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        messagesSent: 0,
        messagesReceived: 0,
        conversationsOpened: 0,
        aiResponses: 0,
        limits: {
          monthlyMessages: 0,
          used: 0,
          remaining: 0,
          percentUsed: 0,
        },
      };
    }
  }

  private getMonthlyLimitForTier(tier: string): number {
    const limits: Record<string, number> = {
      FREE: 0,
      INICIAL: 0,
      PROFESIONAL: 1000,
      EMPRESARIAL: 5000,
      ENTERPRISE: 50000,
    };
    return limits[tier] || 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Provider Capabilities
  // ─────────────────────────────────────────────────────────────────────────────

  supportsProvisioning(): boolean {
    return true;
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
}
