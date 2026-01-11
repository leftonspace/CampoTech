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
  CopilotPanel,
  Conversation,
  ConversationFilter,
  ConversationStats,
  Message,
} from './components';
import ContactsPanel from './components/ContactsPanel';
import { Sparkles } from 'lucide-react';

export default function WhatsAppPage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // AI Assistant context
  const { isEnabled: aiEnabled } = useAIAssistant();

  // State
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [messageInputValue, setMessageInputValue] = useState('');

  // Fetch conversations
  const { data: conversationsData, isLoading: loadingConversations } = useQuery({
    queryKey: ['whatsapp-conversations', filter],
    queryFn: () => api.whatsapp.conversations.list({ filter }),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Calculate stats from conversations
  const stats: ConversationStats = useMemo(() => {
    const conversations = (conversationsData?.data || []) as Conversation[];
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
  }, [conversationsData?.data]);

  const conversations = (conversationsData?.data || []) as Conversation[];

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
    setShowContacts(false);
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
    queryClient.invalidateQueries({ queryKey: ['whatsapp-contacts'] });
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

  // Handle copilot suggesting a reply
  const handleCopilotSuggestReply = useCallback((text: string) => {
    setMessageInputValue(text);
  }, []);

  // Start conversation from contact
  const handleStartConversation = useCallback((phone: string) => {
    // Create or get conversation for this phone
    fetch('/api/whatsapp/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.id) {
          setSelectedConversationId(data.id);
          setShowContacts(false);
          queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
        }
      });
  }, [queryClient]);

  return (
    <div className="h-[calc(100vh-7rem)] -m-6 p-6">
      {/* Main container with rounded corners */}
      <div className="h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex relative">
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
          onShowContacts={() => setShowContacts(true)}
          isConnected={true}
          stats={stats}
        />

        {/* Chat window */}
        <div className="flex-1 flex flex-col relative">
          <ChatWindow
            conversation={selectedConversation}
            messages={messages}
            isLoadingMessages={loadingMessages}
            isSending={sendMutation.isPending}
            onSendMessage={handleSendMessage}
            onSendTemplate={handleSendTemplate}
            onAction={handleAction}
            aiEnabled={aiEnabled}
            aiHandlingConversation={selectedConversation?.aiHandling}
            aiDisabledUntil={selectedConversation?.aiDisabledUntil}
            onDisableAI={handleDisableAI}
            onEnableAI={handleEnableAI}
            onGoToSettings={handleGoToSettings}
            inputValue={messageInputValue}
            onInputChange={setMessageInputValue}
          />

          {/* Copilot toggle button */}
          {selectedConversation && !showCopilot && (
            <button
              onClick={() => setShowCopilot(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-teal-500 text-white rounded-l-lg shadow-lg hover:bg-teal-600 transition-all flex items-center justify-center group"
              title="Abrir Asistente AI"
            >
              <Sparkles className="h-5 w-5" />
              <span className="absolute right-full mr-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Asistente AI
              </span>
            </button>
          )}
        </div>

        {/* Contacts panel (sliding) */}
        {showContacts && (
          <ContactsPanel
            onClose={() => setShowContacts(false)}
            onStartConversation={handleStartConversation}
          />
        )}

        {/* Contact info sidebar */}
        {showContactInfo && (
          <ContactInfo
            isOpen={showContactInfo}
            onClose={() => setShowContactInfo(false)}
            conversation={selectedConversation}
          />
        )}

        {/* Copilot panel */}
        {showCopilot && (
          <CopilotPanel
            isOpen={showCopilot}
            onClose={() => setShowCopilot(false)}
            conversation={selectedConversation}
            messages={messages}
            onSuggestReply={handleCopilotSuggestReply}
          />
        )}
      </div>

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
