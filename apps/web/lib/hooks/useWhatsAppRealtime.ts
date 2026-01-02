/**
 * WhatsApp Real-Time Hook
 * ========================
 *
 * React hook for subscribing to WhatsApp real-time updates
 * via Pusher channels.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Pusher from 'pusher-js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface WhatsAppRealtimeConfig {
  organizationId: string;
  enabled?: boolean;
  onNewMessage?: (data: NewMessageData) => void;
  onMessageStatus?: (data: MessageStatusData) => void;
  onNewConversation?: (data: NewConversationData) => void;
  onConversationUpdated?: (data: ConversationUpdatedData) => void;
}

interface NewMessageData {
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

interface MessageStatusData {
  conversationId: string;
  messageId: string;
  waMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
}

interface NewConversationData {
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

interface ConversationUpdatedData {
  conversationId: string;
  changes: {
    unreadCount?: number;
    status?: string;
    assignedToId?: string;
    lastMessageAt?: string;
    lastMessagePreview?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUSHER CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY || '';
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2';

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useWhatsAppRealtime({
  organizationId,
  enabled = true,
  onNewMessage,
  onMessageStatus,
  onNewConversation,
  onConversationUpdated,
}: WhatsAppRealtimeConfig) {
  const queryClient = useQueryClient();
  const pusherRef = useRef<Pusher | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  // Initialize Pusher
  useEffect(() => {
    if (!enabled || !PUSHER_KEY || !organizationId) {
      return;
    }

    // Create Pusher instance
    pusherRef.current = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      authEndpoint: '/api/pusher/auth',
    });

    // Subscribe to organization channel
    const channelName = `private-whatsapp-${organizationId}`;
    channelRef.current = pusherRef.current.subscribe(channelName);

    // Bind event handlers
    channelRef.current.bind('new_message', (data: NewMessageData) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      queryClient.invalidateQueries({
        queryKey: ['whatsapp-messages', data.conversationId],
      });

      // Call custom handler
      onNewMessage?.(data);
    });

    channelRef.current.bind('message_status_update', (data: MessageStatusData) => {
      // Optimistically update message status in cache
      queryClient.setQueryData(
        ['whatsapp-messages', data.conversationId],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (oldData: any) => {
          if (!oldData?.data) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((msg: Record<string, unknown>) =>
              msg.id === data.messageId || msg.waMessageId === data.waMessageId
                ? { ...msg, status: data.status }
                : msg
            ),
          };
        }
      );

      onMessageStatus?.(data);
    });

    channelRef.current.bind('new_conversation', (data: NewConversationData) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      onNewConversation?.(data);
    });

    channelRef.current.bind('conversation_updated', (data: ConversationUpdatedData) => {
      // Optimistically update conversation in cache
      queryClient.setQueryData(
        ['whatsapp-conversations'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (oldData: any) => {
          if (!oldData?.data) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((conv: Record<string, unknown>) =>
              conv.id === data.conversationId
                ? { ...conv, ...data.changes }
                : conv
            ),
          };
        }
      );

      onConversationUpdated?.(data);
    });

    // Cleanup
    return () => {
      if (channelRef.current) {
        channelRef.current.unbind_all();
        pusherRef.current?.unsubscribe(channelName);
      }
      pusherRef.current?.disconnect();
    };
  }, [
    enabled,
    organizationId,
    queryClient,
    onNewMessage,
    onMessageStatus,
    onNewConversation,
    onConversationUpdated,
  ]);

  // Subscribe to specific conversation channel
  const subscribeToConversation = useCallback(
    (conversationId: string) => {
      if (!pusherRef.current || !conversationId) return null;

      const conversationChannel = pusherRef.current.subscribe(
        `private-wa-conversation-${conversationId}`
      );

      return () => {
        conversationChannel.unbind_all();
        pusherRef.current?.unsubscribe(`private-wa-conversation-${conversationId}`);
      };
    },
    []
  );

  return {
    subscribeToConversation,
    isConnected: pusherRef.current?.connection.state === 'connected',
  };
}

export default useWhatsAppRealtime;
