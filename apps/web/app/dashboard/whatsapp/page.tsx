'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { useAIAssistant } from '@/lib/ai-assistant-context';
import {
  ConversationList,
  ChatWindow,
  TemplateSelector,
  ContactInfo,
  NewConversationModal,
  Conversation,
  ConversationFilter,
  ConversationStats,
  Message,
} from './components';

export default function WhatsAppPage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // AI Assistant context
  const { isEnabled: aiEnabled, isLoading: aiLoading } = useAIAssistant();

  // State
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);

  // Fetch conversations
  const { data: conversationsData, isLoading: loadingConversations } = useQuery({
    queryKey: ['whatsapp-conversations', filter],
    queryFn: () => api.whatsapp.conversations.list({ filter }),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const conversations = (conversationsData?.data || []) as Conversation[];

  // Calculate stats from conversations
  const stats: ConversationStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayConversations = conversations.filter((c) => {
      const msgDate = new Date(c.lastMessage.timestamp);
      return msgDate >= today;
    });

    const aiHandled = todayConversations.filter((c) => c.aiHandling).length;
    const pending = conversations.filter((c) => c.needsAttention || c.unreadCount > 0).length;

    return {
      totalToday: todayConversations.length,
      aiResolvedPercent: todayConversations.length > 0
        ? Math.round((aiHandled / todayConversations.length) * 100)
        : 0,
      pendingCount: pending,
    };
  }, [conversations]);

  // Fetch messages for selected conversation
  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ['whatsapp-messages', selectedConversationId],
    queryFn: () => api.whatsapp.messages.list(selectedConversationId!),
    enabled: !!selectedConversationId,
    refetchInterval: 10000, // Refetch every 10 seconds for active chat
  });

  const messages = (messagesData?.data || []) as Message[];

  // Get selected conversation
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) || null;

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      api.whatsapp.messages.send(selectedConversationId!, { text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    },
  });

  // Send template mutation
  const sendTemplateMutation = useMutation({
    mutationFn: (data: { templateName: string; params: Record<string, string> }) =>
      api.whatsapp.templates.send({
        templateName: data.templateName,
        phone: selectedConversation?.customerPhone || '',
        params: data.params,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      setShowTemplateSelector(false);
    },
  });

  // Handlers
  const handleSelectConversation = useCallback((id: string) => {
    setSelectedConversationId(id);
    setShowContactInfo(false);
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    sendMutation.mutate(text);
  }, [sendMutation]);

  const handleSendTemplate = useCallback(() => {
    setShowTemplateSelector(true);
  }, []);

  const handleTemplateSelect = useCallback((template: { name: string }, params: Record<string, string>) => {
    sendTemplateMutation.mutate({
      templateName: template.name,
      params,
    });
  }, [sendTemplateMutation]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    if (selectedConversationId) {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedConversationId] });
    }
  }, [queryClient, selectedConversationId]);

  const handleAction = useCallback((action: 'archive' | 'close' | 'assign' | 'info') => {
    if (action === 'info') {
      setShowContactInfo(true);
    } else {
      // Handle other actions via API
      if (selectedConversationId) {
        api.whatsapp.conversations.update(selectedConversationId, { action }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
        });
      }
    }
  }, [selectedConversationId, queryClient]);

  // AI-related handlers
  const handleDisableAI = useCallback((minutes: number) => {
    if (!selectedConversationId) return;

    // Call API to disable AI for this conversation
    fetch(`/api/whatsapp/conversations/${selectedConversationId}/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disable', minutes }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    });
  }, [selectedConversationId, queryClient]);

  const handleEnableAI = useCallback(() => {
    if (!selectedConversationId) return;

    // Call API to re-enable AI for this conversation
    fetch(`/api/whatsapp/conversations/${selectedConversationId}/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enable' }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    });
  }, [selectedConversationId, queryClient]);

  const handleGoToSettings = useCallback(() => {
    router.push('/dashboard/settings/ai-assistant');
  }, [router]);

  return (
    <div className="flex h-full -m-6">
      {/* Conversations sidebar */}
      <ConversationList
        conversations={conversations}
        selectedId={selectedConversationId}
        onSelect={handleSelectConversation}
        filter={filter}
        onFilterChange={setFilter}
        isLoading={loadingConversations}
        onRefresh={handleRefresh}
        onNewConversation={() => setShowNewConversation(true)}
        isConnected={true}
        stats={stats}
      />

      {/* Chat window */}
      <ChatWindow
        conversation={selectedConversation}
        messages={messages}
        isLoadingMessages={loadingMessages}
        isSending={sendMutation.isPending}
        onSendMessage={handleSendMessage}
        onSendTemplate={handleSendTemplate}
        onAction={handleAction}
        // AI-related props
        aiEnabled={aiEnabled}
        aiHandlingConversation={selectedConversation?.aiHandling}
        aiDisabledUntil={selectedConversation?.aiDisabledUntil}
        onDisableAI={handleDisableAI}
        onEnableAI={handleEnableAI}
        onGoToSettings={handleGoToSettings}
      />

      {/* Contact info sidebar */}
      {showContactInfo && (
        <ContactInfo
          isOpen={showContactInfo}
          onClose={() => setShowContactInfo(false)}
          conversation={selectedConversation}
        />
      )}

      {/* Template selector modal */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelect={handleTemplateSelect}
        phone={selectedConversation?.customerPhone}
      />

      {/* New conversation modal */}
      <NewConversationModal
        isOpen={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        onSelectConversation={(id) => {
          setSelectedConversationId(id);
          setShowNewConversation(false);
        }}
      />
    </div>
  );
}
