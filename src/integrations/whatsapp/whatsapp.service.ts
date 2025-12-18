/**
 * WhatsApp Service
 * ================
 *
 * Central orchestrator for WhatsApp Business API operations.
 * Manages conversations, messages, templates, and configuration.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { QueueManager } from '../../lib/queue/queue-manager';
import {
  WhatsAppConfig,
  WAMessageRecord,
  WAConversation,
  SendMessageResponse,
  InboundMessage,
  MessageStatus,
  WAMessageDirection,
} from './whatsapp.types';
import { sendTemplateMessage, buildTemplateWithParams } from './messages/template.sender';
import { sendTextMessage, sendButtonMessage, sendListMessage } from './messages/text.sender';
import { downloadMedia } from './messages/media.handler';
import {
  getOrganizationTemplates,
  syncTemplatesFromMeta,
  getTemplate,
  RegisteredTemplate,
} from './templates/template-registry';
import {
  extractMessageContent,
  hasMedia,
  getMediaId,
} from './webhook/webhook.handler';
import { processAutoResponse } from '../../modules/localization/auto-responder.service';
import { processAudioMessage } from './messages/audio.handler';
import {
  getMessageAggregator,
  BufferedMessage,
  AggregationResult,
} from './aggregation/message-aggregator.service';
import { realtimeService } from '../../modules/whatsapp/realtime.service';
import { processAIResponse } from './ai/ai-responder.integration';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConversationFilter {
  filter?: 'all' | 'unread' | 'in_window';
  limit?: number;
  offset?: number;
}

export interface ConversationListItem {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastMessage: {
    content: string;
    timestamp: string;
    direction: WAMessageDirection;
    status: string;
  };
  unreadCount: number;
  isInWindow: boolean;
}

export interface MessageListItem {
  id: string;
  waMessageId: string;
  direction: WAMessageDirection;
  type: string;
  content: string;
  mediaUrl?: string;
  timestamp: string;
  status: string;
}

export interface WhatsAppStats {
  conversations: {
    total: number;
    active: number;
    inWindow: number;
  };
  messages: {
    sent24h: number;
    received24h: number;
    failed24h: number;
  };
  templates: {
    total: number;
    approved: number;
    pending: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get WhatsApp configuration for an organization
 */
export async function getWhatsAppConfig(organizationId: string): Promise<WhatsAppConfig | null> {
  try {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        whatsappPhoneNumberId: true,
        whatsappBusinessAccountId: true,
        whatsappAccessToken: true,
        whatsappWebhookVerifyToken: true,
        whatsappAppSecret: true,
      },
    });

    if (!org?.whatsappPhoneNumberId || !org?.whatsappAccessToken) {
      return null;
    }

    return {
      phoneNumberId: org.whatsappPhoneNumberId,
      businessAccountId: org.whatsappBusinessAccountId || '',
      accessToken: org.whatsappAccessToken,
      webhookVerifyToken: org.whatsappWebhookVerifyToken || '',
      appSecret: org.whatsappAppSecret || '',
      apiVersion: 'v18.0',
    };
  } catch (error) {
    log.error('Error getting WhatsApp config', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

/**
 * Save WhatsApp configuration for an organization
 */
export async function saveWhatsAppConfig(
  organizationId: string,
  config: Partial<WhatsAppConfig>
): Promise<void> {
  await db.organization.update({
    where: { id: organizationId },
    data: {
      whatsappPhoneNumberId: config.phoneNumberId,
      whatsappBusinessAccountId: config.businessAccountId,
      whatsappAccessToken: config.accessToken,
      whatsappWebhookVerifyToken: config.webhookVerifyToken,
      whatsappAppSecret: config.appSecret,
    },
  });

  log.info('WhatsApp config saved', { organizationId });
}

/**
 * Test WhatsApp connection
 */
export async function testWhatsAppConnection(
  config: WhatsAppConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // Test by fetching phone number info
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.phoneNumberId}`,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Connection failed',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * List conversations for an organization
 */
export async function listConversations(
  organizationId: string,
  options: ConversationFilter = {}
): Promise<ConversationListItem[]> {
  const { filter = 'all', limit = 50, offset = 0 } = options;

  const now = new Date();
  const windowCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let where: any = { organizationId };

  if (filter === 'unread') {
    where.unreadCount = { gt: 0 };
  } else if (filter === 'in_window') {
    where.lastMessageAt = { gte: windowCutoff };
  }

  const conversations = await db.waConversation.findMany({
    where,
    orderBy: { lastMessageAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
  });

  return conversations.map((conv: typeof conversations[number]) => ({
    id: conv.id,
    customerId: conv.customerId,
    customerName: conv.customer?.name || conv.customerName || 'Desconocido',
    customerPhone: conv.customerPhone,
    lastMessage: {
      content: conv.lastMessagePreview || '',
      timestamp: conv.lastMessageAt.toISOString(),
      direction: (conv.lastMessageDirection as WAMessageDirection) || 'inbound',
      status: conv.lastMessageStatus || 'sent',
    },
    unreadCount: conv.unreadCount,
    isInWindow: conv.lastMessageAt >= windowCutoff,
  }));
}

/**
 * Get a single conversation
 */
export async function getConversation(
  organizationId: string,
  conversationId: string
): Promise<ConversationListItem | null> {
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const conv = await db.waConversation.findFirst({
    where: {
      id: conversationId,
      organizationId,
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
  });

  if (!conv) return null;

  return {
    id: conv.id,
    customerId: conv.customerId,
    customerName: conv.customer?.name || conv.customerName || 'Desconocido',
    customerPhone: conv.customerPhone,
    lastMessage: {
      content: conv.lastMessagePreview || '',
      timestamp: conv.lastMessageAt.toISOString(),
      direction: (conv.lastMessageDirection as WAMessageDirection) || 'inbound',
      status: conv.lastMessageStatus || 'sent',
    },
    unreadCount: conv.unreadCount,
    isInWindow: conv.lastMessageAt >= windowCutoff,
  };
}

/**
 * Get or create conversation for a customer
 */
export async function getOrCreateConversation(
  organizationId: string,
  customerPhone: string,
  customerName?: string
): Promise<string> {
  // Normalize phone number
  const normalizedPhone = normalizePhone(customerPhone);

  // Try to find existing conversation
  let conversation = await db.waConversation.findFirst({
    where: {
      organizationId,
      customerPhone: normalizedPhone,
    },
  });

  if (!conversation) {
    // Try to find customer by phone
    const customer = await db.customer.findFirst({
      where: {
        organizationId,
        phone: { contains: normalizedPhone.slice(-10) },
      },
    });

    // Create new conversation
    conversation = await db.waConversation.create({
      data: {
        organizationId,
        customerId: customer?.id || '',
        customerPhone: normalizedPhone,
        customerName: customerName || customer?.name || 'Desconocido',
        lastMessageAt: new Date(),
        lastMessagePreview: '',
        unreadCount: 0,
        isActive: true,
      },
    });
  }

  return conversation.id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * List messages in a conversation
 */
export async function listMessages(
  organizationId: string,
  conversationId: string,
  limit: number = 50,
  before?: string
): Promise<MessageListItem[]> {
  const where: any = {
    organizationId,
    conversationId,
  };

  if (before) {
    where.createdAt = { lt: new Date(before) };
  }

  const messages = await db.waMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Mark conversation as read
  await db.waConversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });

  return messages.reverse().map((msg: typeof messages[number]) => ({
    id: msg.id,
    waMessageId: msg.waMessageId || '',
    direction: msg.direction as WAMessageDirection,
    type: msg.type,
    content: msg.content,
    mediaUrl: msg.mediaUrl || undefined,
    timestamp: msg.createdAt.toISOString(),
    status: msg.status,
  }));
}

/**
 * Send a text message
 */
export async function sendMessage(
  organizationId: string,
  conversationId: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = await getWhatsAppConfig(organizationId);
  if (!config) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  const conversation = await db.waConversation.findFirst({
    where: { id: conversationId, organizationId },
  });

  if (!conversation) {
    return { success: false, error: 'Conversation not found' };
  }

  // Check if within 24h window
  const windowCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (conversation.lastMessageAt < windowCutoff) {
    return { success: false, error: 'Outside 24h window. Use template message.' };
  }

  // Create message record
  const message = await db.waMessage.create({
    data: {
      organizationId,
      conversationId,
      customerId: conversation.customerId,
      direction: 'outbound',
      type: 'text',
      from: config.phoneNumberId,
      to: conversation.customerPhone,
      content: text,
      status: 'pending',
    },
  });

  // Queue for sending
  try {
    await QueueManager.getInstance().addToQueue('WHATSAPP', 'send_message', {
      organizationId,
      messageId: message.id,
      to: conversation.customerPhone,
      content: text,
    });

    return { success: true, messageId: message.id };
  } catch (error) {
    await db.waMessage.update({
      where: { id: message.id },
      data: { status: 'failed' },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue message',
    };
  }
}

/**
 * Send a template message
 */
export async function sendTemplate(
  organizationId: string,
  phone: string,
  templateName: string,
  params: Record<string, string>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = await getWhatsAppConfig(organizationId);
  if (!config) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  // Get template
  const template = await getTemplate(organizationId, templateName);
  if (!template) {
    return { success: false, error: 'Template not found' };
  }

  if (template.status !== 'APPROVED') {
    return { success: false, error: 'Template not approved' };
  }

  // Get or create conversation
  const conversationId = await getOrCreateConversation(organizationId, phone);

  // Create message record
  const message = await db.waMessage.create({
    data: {
      organizationId,
      conversationId,
      direction: 'outbound',
      type: 'template',
      from: config.phoneNumberId,
      to: normalizePhone(phone),
      content: `[Template: ${templateName}]`,
      templateName,
      status: 'pending',
    },
  });

  // Queue for sending
  try {
    await QueueManager.getInstance().addToQueue('WHATSAPP', 'send_template', {
      organizationId,
      messageId: message.id,
      to: normalizePhone(phone),
      templateName,
      params,
    });

    return { success: true, messageId: message.id };
  } catch (error) {
    await db.waMessage.update({
      where: { id: message.id },
      data: { status: 'failed' },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue message',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACTIVE MESSAGES (Buttons & Lists)
// ═══════════════════════════════════════════════════════════════════════════════

export interface InteractiveButton {
  id: string;
  title: string;
}

export interface ListSection {
  title?: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}

/**
 * Send a message with quick reply buttons (max 3 buttons)
 */
export async function sendInteractiveButtonMessage(
  organizationId: string,
  conversationId: string,
  bodyText: string,
  buttons: InteractiveButton[],
  options?: {
    headerText?: string;
    footerText?: string;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = await getWhatsAppConfig(organizationId);
  if (!config) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  const conversation = await db.waConversation.findFirst({
    where: { id: conversationId, organizationId },
  });

  if (!conversation) {
    return { success: false, error: 'Conversation not found' };
  }

  // Check if within 24h window
  const windowCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (conversation.lastMessageAt < windowCutoff) {
    return { success: false, error: 'Outside 24h window. Use template message.' };
  }

  if (buttons.length > 3) {
    return { success: false, error: 'Maximum 3 buttons allowed' };
  }

  // Create message record
  const message = await db.waMessage.create({
    data: {
      organizationId,
      conversationId,
      customerId: conversation.customerId,
      direction: 'outbound',
      type: 'interactive',
      from: config.phoneNumberId,
      to: conversation.customerPhone,
      content: bodyText,
      metadata: {
        interactiveType: 'button',
        buttons: buttons.map((b: typeof buttons[number]) => ({ id: b.id, title: b.title })),
      },
      status: 'pending',
    },
  });

  // Send directly (interactive messages are time-sensitive)
  try {
    const result = await sendButtonMessage(
      config,
      conversation.customerPhone,
      bodyText,
      buttons,
      options?.headerText,
      options?.footerText
    );

    if (result.success) {
      await db.waMessage.update({
        where: { id: message.id },
        data: {
          waMessageId: result.messageId,
          status: 'sent',
        },
      });

      return { success: true, messageId: message.id };
    } else {
      await db.waMessage.update({
        where: { id: message.id },
        data: {
          status: 'failed',
          errorMessage: result.error,
        },
      });

      return { success: false, error: result.error };
    }
  } catch (error) {
    await db.waMessage.update({
      where: { id: message.id },
      data: { status: 'failed' },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    };
  }
}

/**
 * Send a list message for selection menus (max 10 items per section)
 */
export async function sendInteractiveListMessage(
  organizationId: string,
  conversationId: string,
  bodyText: string,
  buttonText: string,
  sections: ListSection[],
  options?: {
    headerText?: string;
    footerText?: string;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = await getWhatsAppConfig(organizationId);
  if (!config) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  const conversation = await db.waConversation.findFirst({
    where: { id: conversationId, organizationId },
  });

  if (!conversation) {
    return { success: false, error: 'Conversation not found' };
  }

  // Check if within 24h window
  const windowCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (conversation.lastMessageAt < windowCutoff) {
    return { success: false, error: 'Outside 24h window. Use template message.' };
  }

  // Validate sections
  const totalRows = sections.reduce((sum: number, s: typeof sections[number]) => sum + s.rows.length, 0);
  if (totalRows > 10) {
    return { success: false, error: 'Maximum 10 total rows allowed across all sections' };
  }

  // Create message record
  const message = await db.waMessage.create({
    data: {
      organizationId,
      conversationId,
      customerId: conversation.customerId,
      direction: 'outbound',
      type: 'interactive',
      from: config.phoneNumberId,
      to: conversation.customerPhone,
      content: bodyText,
      metadata: {
        interactiveType: 'list',
        buttonText,
        sections: sections.map((s: typeof sections[number]) => ({
          title: s.title,
          rows: s.rows.map((r: typeof s.rows[number]) => ({ id: r.id, title: r.title, description: r.description })),
        })),
      },
      status: 'pending',
    },
  });

  // Send directly
  try {
    const result = await sendListMessage(
      config,
      conversation.customerPhone,
      bodyText,
      buttonText,
      sections,
      options?.headerText,
      options?.footerText
    );

    if (result.success) {
      await db.waMessage.update({
        where: { id: message.id },
        data: {
          waMessageId: result.messageId,
          status: 'sent',
        },
      });

      return { success: true, messageId: message.id };
    } else {
      await db.waMessage.update({
        where: { id: message.id },
        data: {
          status: 'failed',
          errorMessage: result.error,
        },
      });

      return { success: false, error: result.error };
    }
  } catch (error) {
    await db.waMessage.update({
      where: { id: message.id },
      data: { status: 'failed' },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * List templates for an organization
 */
export async function listTemplates(organizationId: string): Promise<RegisteredTemplate[]> {
  return getOrganizationTemplates(organizationId);
}

/**
 * Sync templates with Meta
 */
export async function syncTemplates(organizationId: string): Promise<void> {
  const config = await getWhatsAppConfig(organizationId);
  if (!config) {
    throw new Error('WhatsApp not configured');
  }

  await syncTemplatesFromMeta(config, organizationId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get WhatsApp statistics for an organization
 */
export async function getStats(organizationId: string): Promise<WhatsAppStats> {
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalConversations,
    activeConversations,
    inWindowConversations,
    sentMessages,
    receivedMessages,
    failedMessages,
    templates,
  ] = await Promise.all([
    db.waConversation.count({ where: { organizationId } }),
    db.waConversation.count({
      where: { organizationId, isActive: true },
    }),
    db.waConversation.count({
      where: { organizationId, lastMessageAt: { gte: windowCutoff } },
    }),
    db.waMessage.count({
      where: {
        organizationId,
        direction: 'outbound',
        createdAt: { gte: windowCutoff },
      },
    }),
    db.waMessage.count({
      where: {
        organizationId,
        direction: 'inbound',
        createdAt: { gte: windowCutoff },
      },
    }),
    db.waMessage.count({
      where: {
        organizationId,
        status: 'failed',
        createdAt: { gte: windowCutoff },
      },
    }),
    db.waTemplate.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: { status: true },
    }),
  ]);

  const templateCounts = {
    total: 0,
    approved: 0,
    pending: 0,
  };

  for (const t of templates) {
    templateCounts.total += t._count.status;
    if (t.status === 'APPROVED') templateCounts.approved = t._count.status;
    if (t.status === 'PENDING') templateCounts.pending = t._count.status;
  }

  return {
    conversations: {
      total: totalConversations,
      active: activeConversations,
      inWindow: inWindowConversations,
    },
    messages: {
      sent24h: sentMessages,
      received24h: receivedMessages,
      failed24h: failedMessages,
    },
    templates: templateCounts,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INBOUND MESSAGE PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process an inbound message from webhook
 */
export async function processInboundMessage(
  organizationId: string,
  message: InboundMessage,
  contactName?: string
): Promise<void> {
  const conversationId = await getOrCreateConversation(
    organizationId,
    message.from,
    contactName
  );

  const content = extractMessageContent(message);
  const mediaId = hasMedia(message) ? getMediaId(message) : null;

  // Store message
  const storedMessage = await db.waMessage.create({
    data: {
      organizationId,
      conversationId,
      waMessageId: message.id,
      direction: 'inbound',
      type: message.type,
      from: message.from,
      to: '',
      content,
      mediaId: mediaId || undefined,
      status: 'delivered',
    },
  });

  // Update conversation
  await db.waConversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: content.substring(0, 100),
      lastMessageDirection: 'inbound',
      lastMessageStatus: 'delivered',
      unreadCount: { increment: 1 },
    },
  });

  // Broadcast real-time notification for new message
  try {
    await realtimeService.notifyNewMessage(
      organizationId,
      conversationId,
      {
        id: storedMessage.id,
        direction: 'inbound',
        type: message.type,
        content,
        timestamp: storedMessage.createdAt.toISOString(),
        status: 'delivered',
        mediaUrl: storedMessage.mediaUrl || undefined,
      },
      message.from,
      contactName || 'Unknown'
    );
  } catch (error) {
    log.error('Error broadcasting realtime new message', {
      organizationId,
      conversationId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  // Process audio messages specially
  if (message.type === 'audio') {
    try {
      await processAudioMessage(organizationId, message, contactName);
    } catch (error) {
      log.error('Error processing audio message', {
        organizationId,
        messageId: message.id,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  // Process auto-response (after-hours, audio confirmation)
  try {
    await processAutoResponse(organizationId, message, contactName);
  } catch (error) {
    log.error('Error processing auto-response', {
      organizationId,
      messageId: message.id,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  // Process AI-powered response if enabled
  try {
    await processAIResponse(organizationId, conversationId, message, content, contactName);
  } catch (error) {
    log.error('Error processing AI response', {
      organizationId,
      messageId: message.id,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  // Feed message to aggregator for intelligent batching
  try {
    const bufferedMessage: BufferedMessage = {
      id: message.id,
      content,
      type: message.type,
      timestamp: Date.now(),
      mediaId: mediaId || undefined,
    };

    const aggregator = getMessageAggregator();
    const result = await aggregator.handleMessage(
      organizationId,
      message.from,
      bufferedMessage
    );

    // If aggregator returns a result, process the aggregated content
    if (result && result.shouldProcess) {
      await processAggregatedMessage(organizationId, message.from, result, contactName);
    }
  } catch (error) {
    log.error('Error in message aggregation', {
      organizationId,
      messageId: message.id,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  log.info('Inbound message processed', {
    organizationId,
    conversationId,
    messageType: message.type,
  });
}

/**
 * Process aggregated messages (after buffer triggers)
 */
async function processAggregatedMessage(
  organizationId: string,
  phone: string,
  result: AggregationResult,
  contactName?: string
): Promise<void> {
  log.info('Processing aggregated message', {
    organizationId,
    phone,
    messageCount: result.messageCount,
    triggerReason: result.triggerReason,
    hasContext: !!result.context,
  });

  // Store aggregation event for analytics
  try {
    await db.messageAggregationEvent.create({
      data: {
        organizationId,
        customerPhone: phone,
        customerName: contactName || result.context?.customerName,
        messageCount: result.messageCount,
        combinedContent: result.combinedContent,
        triggerReason: result.triggerReason || 'unknown',
        customerId: result.context?.customerId,
        activeJobId: result.context?.activeJobId,
        processedAt: new Date(),
      },
    });
  } catch (error) {
    // Table may not exist yet, log and continue
    log.debug('Could not store aggregation event', { error });
  }

  // Future: This is where GPT/AI processing would happen
  // For now, we just log and let the human agents handle it
  // The aggregated content is available in result.combinedContent
  // The context includes customer info, active job, previous messages
}

/**
 * Process message status update from webhook
 */
export async function processStatusUpdate(
  organizationId: string,
  status: MessageStatus
): Promise<void> {
  await db.waMessage.updateMany({
    where: {
      organizationId,
      waMessageId: status.id,
    },
    data: {
      status: status.status,
      statusUpdatedAt: new Date(parseInt(status.timestamp) * 1000),
    },
  });

  // Update conversation last message status if this is the latest
  const message = await db.waMessage.findFirst({
    where: { waMessageId: status.id },
    include: { conversation: true },
  });

  if (message?.conversation) {
    await db.waConversation.update({
      where: { id: message.conversationId },
      data: { lastMessageStatus: status.status },
    });

    // Broadcast real-time notification for status update
    try {
      const statusMap: Record<string, 'sent' | 'delivered' | 'read' | 'failed'> = {
        sent: 'sent',
        delivered: 'delivered',
        read: 'read',
        failed: 'failed',
      };
      const mappedStatus = statusMap[status.status] || 'sent';

      await realtimeService.notifyMessageStatus(
        organizationId,
        message.conversationId,
        message.id,
        status.id,
        mappedStatus
      );
    } catch (error) {
      log.error('Error broadcasting realtime status update', {
        organizationId,
        messageId: status.id,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');

  // Add Argentina country code if not present
  if (!digits.startsWith('54') && digits.length === 10) {
    digits = '54' + digits;
  }

  // Add 9 for mobile if missing
  if (digits.startsWith('54') && !digits.startsWith('549') && digits.length === 12) {
    digits = '549' + digits.slice(2);
  }

  return digits;
}
