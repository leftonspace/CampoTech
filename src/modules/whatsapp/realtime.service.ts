/**
 * WhatsApp Real-Time Updates Service
 * ====================================
 *
 * Handles real-time updates for WhatsApp conversations
 * using Pusher or WebSocket-based broadcasting.
 */

import Pusher from 'pusher';
import { log } from '../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RealtimeConfig {
  appId: string;
  key: string;
  secret: string;
  cluster: string;
  useTLS?: boolean;
}

export type WhatsAppEvent =
  | 'new_message'
  | 'message_status_update'
  | 'new_conversation'
  | 'conversation_updated'
  | 'typing_indicator';

export interface NewMessageEvent {
  type: 'new_message';
  conversationId: string;
  message: {
    id: string;
    direction: 'inbound' | 'outbound';
    type: string;
    content: string;
    timestamp: string;
    status: string;
    mediaUrl?: string;
  };
  customerPhone: string;
  customerName: string;
}

export interface MessageStatusEvent {
  type: 'message_status_update';
  conversationId: string;
  messageId: string;
  waMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
}

export interface NewConversationEvent {
  type: 'new_conversation';
  conversation: {
    id: string;
    customerPhone: string;
    customerName: string;
    customerId?: string;
    lastMessage: {
      content: string;
      timestamp: string;
      direction: string;
    };
    unreadCount: number;
    isInWindow: boolean;
  };
}

export interface ConversationUpdatedEvent {
  type: 'conversation_updated';
  conversationId: string;
  changes: {
    unreadCount?: number;
    status?: string;
    assignedToId?: string;
    lastMessageAt?: string;
    lastMessagePreview?: string;
  };
}

export interface TypingIndicatorEvent {
  type: 'typing_indicator';
  conversationId: string;
  customerPhone: string;
  isTyping: boolean;
}

export type WhatsAppRealtimeEvent =
  | NewMessageEvent
  | MessageStatusEvent
  | NewConversationEvent
  | ConversationUpdatedEvent
  | TypingIndicatorEvent;

// ═══════════════════════════════════════════════════════════════════════════════
// REALTIME SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class WhatsAppRealtimeService {
  private pusher: Pusher | null = null;
  private isInitialized = false;

  /**
   * Initialize Pusher client
   */
  initialize(config: RealtimeConfig): void {
    if (this.isInitialized) return;

    try {
      this.pusher = new Pusher({
        appId: config.appId,
        key: config.key,
        secret: config.secret,
        cluster: config.cluster,
        useTLS: config.useTLS ?? true,
      });
      this.isInitialized = true;
      log.info('WhatsApp realtime service initialized');
    } catch (error) {
      log.error('Failed to initialize Pusher', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Initialize from environment variables
   */
  initializeFromEnv(): void {
    const config: RealtimeConfig = {
      appId: process.env.PUSHER_APP_ID || '',
      key: process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY || '',
      secret: process.env.PUSHER_SECRET || '',
      cluster: process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
    };

    if (config.appId && config.key && config.secret) {
      this.initialize(config);
    } else {
      log.warn('Pusher credentials not configured - realtime updates disabled');
    }
  }

  /**
   * Get channel name for organization
   */
  private getChannelName(organizationId: string): string {
    return `private-whatsapp-${organizationId}`;
  }

  /**
   * Get channel name for specific conversation
   */
  private getConversationChannel(conversationId: string): string {
    return `private-wa-conversation-${conversationId}`;
  }

  /**
   * Broadcast event to organization channel
   */
  async broadcast(
    organizationId: string,
    event: WhatsAppRealtimeEvent
  ): Promise<void> {
    if (!this.pusher) {
      log.debug('Pusher not initialized, skipping broadcast');
      return;
    }

    const channel = this.getChannelName(organizationId);

    try {
      await this.pusher.trigger(channel, event.type, event);
      log.debug('Realtime event broadcast', {
        channel,
        eventType: event.type,
      });
    } catch (error) {
      log.error('Failed to broadcast realtime event', {
        channel,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Broadcast to conversation-specific channel
   */
  async broadcastToConversation(
    conversationId: string,
    event: WhatsAppRealtimeEvent
  ): Promise<void> {
    if (!this.pusher) {
      return;
    }

    const channel = this.getConversationChannel(conversationId);

    try {
      await this.pusher.trigger(channel, event.type, event);
    } catch (error) {
      log.error('Failed to broadcast to conversation channel', {
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONVENIENCE METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Notify about new inbound message
   */
  async notifyNewMessage(
    organizationId: string,
    conversationId: string,
    message: NewMessageEvent['message'],
    customerPhone: string,
    customerName: string
  ): Promise<void> {
    const event: NewMessageEvent = {
      type: 'new_message',
      conversationId,
      message,
      customerPhone,
      customerName,
    };

    // Broadcast to both org channel and conversation channel
    await Promise.all([
      this.broadcast(organizationId, event),
      this.broadcastToConversation(conversationId, event),
    ]);
  }

  /**
   * Notify about message status update
   */
  async notifyMessageStatus(
    organizationId: string,
    conversationId: string,
    messageId: string,
    waMessageId: string,
    status: MessageStatusEvent['status']
  ): Promise<void> {
    const event: MessageStatusEvent = {
      type: 'message_status_update',
      conversationId,
      messageId,
      waMessageId,
      status,
      timestamp: new Date().toISOString(),
    };

    await Promise.all([
      this.broadcast(organizationId, event),
      this.broadcastToConversation(conversationId, event),
    ]);
  }

  /**
   * Notify about new conversation
   */
  async notifyNewConversation(
    organizationId: string,
    conversation: NewConversationEvent['conversation']
  ): Promise<void> {
    const event: NewConversationEvent = {
      type: 'new_conversation',
      conversation,
    };

    await this.broadcast(organizationId, event);
  }

  /**
   * Notify about conversation update
   */
  async notifyConversationUpdated(
    organizationId: string,
    conversationId: string,
    changes: ConversationUpdatedEvent['changes']
  ): Promise<void> {
    const event: ConversationUpdatedEvent = {
      type: 'conversation_updated',
      conversationId,
      changes,
    };

    await this.broadcast(organizationId, event);
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(
    organizationId: string,
    conversationId: string,
    customerPhone: string,
    isTyping: boolean
  ): Promise<void> {
    const event: TypingIndicatorEvent = {
      type: 'typing_indicator',
      conversationId,
      customerPhone,
      isTyping,
    };

    await this.broadcastToConversation(conversationId, event);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Authenticate Pusher channel subscription
   */
  authenticateChannel(
    socketId: string,
    channelName: string,
    organizationId: string
  ): { auth: string } | null {
    if (!this.pusher) {
      return null;
    }

    // Verify channel belongs to organization
    if (
      channelName !== this.getChannelName(organizationId) &&
      !channelName.startsWith('private-wa-conversation-')
    ) {
      return null;
    }

    try {
      const auth = this.pusher.authorizeChannel(socketId, channelName);
      return auth;
    } catch (error) {
      log.error('Failed to authenticate Pusher channel', {
        channelName,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

const realtimeService = new WhatsAppRealtimeService();

// Auto-initialize from environment
if (typeof process !== 'undefined' && process.env) {
  realtimeService.initializeFromEnv();
}

export { realtimeService };
export default realtimeService;
