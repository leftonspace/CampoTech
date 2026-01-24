'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Bot,
  Send,
  RefreshCw,
  Settings,
  Eye,
  Clipboard,
  MessageSquare,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Activity,
  MessageCircle,
  Zap,
  Plus,
} from 'lucide-react';
import type { Conversation, Message } from './index';
import AIActivityFeed, { ActivityItem, generateDemoActivities } from './AIActivityFeed';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface CopilotMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  type: 'message' | 'suggestion' | 'warning' | 'action_result';
  timestamp: Date;
  actions?: CopilotAction[];
  metadata?: Record<string, unknown>;
  // Phase 5.1: Feedback tracking
  feedback?: 'positive' | 'negative' | null;
}

interface CopilotAction {
  id: string;
  label: string;
  action: string;
  variant: 'primary' | 'secondary' | 'ghost';
  data?: Record<string, unknown>;
}

interface CopilotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  messages: Message[];
  onSuggestReply?: (text: string) => void;
  onSimulate?: () => void;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// QUICK ACTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const QUICK_ACTIONS = [
  { id: 'create-job', icon: Clipboard, label: 'Crear trabajo' },
  { id: 'suggest-reply', icon: MessageSquare, label: 'Sugerir respuesta' },
  { id: 'summary', icon: FileText, label: 'Resumen' },
  { id: 'check-schedule', icon: Calendar, label: 'Ver agenda' },
];

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export default function CopilotPanel({
  isOpen,
  onClose,
  conversation,
  messages,
  onSuggestReply,
  onSimulate,
}: CopilotPanelProps) {
  const queryClient = useQueryClient();
  // Tab state: 'activity' or 'chat'
  const [activeTab, setActiveTab] = useState<'activity' | 'chat'>('activity');
  // Activity feed state
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDemoMode, setShowDemoMode] = useState(false);
  // Chat state (legacy, kept for chat tab)
  const [input, setInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load demo activities when demo mode is toggled
  useEffect(() => {
    if (showDemoMode && conversation) {
      setActivities(generateDemoActivities());
    } else if (!showDemoMode) {
      setActivities([]);
    }
  }, [showDemoMode, conversation]);

  // Reset activities when conversation changes
  useEffect(() => {
    setActivities([]);
    setShowDemoMode(false);
    setIsAnalyzing(false);
  }, [conversation?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages]);

  // Generate welcome message when conversation changes
  useEffect(() => {
    if (conversation && copilotMessages.length === 0) {
      const welcomeMessage: CopilotMessage = {
        id: 'welcome',
        role: 'assistant',
        content: `Hola, estoy viendo tu conversación con ${conversation.customerName}. ¿En qué puedo ayudarte?`,
        type: 'message',
        timestamp: new Date(),
      };
      setCopilotMessages([welcomeMessage]);
    }
  }, [conversation, copilotMessages.length]);

  // Reset messages when conversation changes
  useEffect(() => {
    setCopilotMessages([]);
  }, [conversation?.id]);

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationId: conversation?.id,
          context: {
            messages: messages.slice(-20), // Last 20 messages
            customer: {
              name: conversation?.customerName,
              phone: conversation?.customerPhone,
            },
          },
        }),
      });
      if (!response.ok) throw new Error('Failed to get copilot response');
      return response.json();
    },
    onSuccess: (data) => {
      const aiMessage: CopilotMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        type: data.type || 'message',
        timestamp: new Date(),
        actions: data.actions,
        metadata: data.metadata,
      };
      setCopilotMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    },
    onError: () => {
      const errorMessage: CopilotMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Lo siento, hubo un error. Por favor intentá de nuevo.',
        type: 'warning',
        timestamp: new Date(),
      };
      setCopilotMessages((prev) => [...prev, errorMessage]);
      setIsTyping(false);
    },
  });

  // Handle send message
  const handleSend = useCallback(() => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      type: 'message',
      timestamp: new Date(),
    };

    setCopilotMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    chatMutation.mutate(input.trim());
  }, [input, chatMutation]);

  // Handle quick action
  const handleQuickAction = useCallback((actionId: string) => {
    let prompt = '';
    switch (actionId) {
      case 'create-job':
        prompt = 'Creá un trabajo para este cliente con la información de la conversación';
        break;
      case 'suggest-reply':
        prompt = 'Sugiereme una respuesta para el último mensaje del cliente';
        break;
      case 'summary':
        prompt = 'Dame un resumen de esta conversación';
        break;
      case 'check-schedule':
        prompt = '¿Qué horarios tenemos disponibles para esta semana?';
        break;
    }

    if (prompt) {
      const userMessage: CopilotMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: prompt,
        type: 'message',
        timestamp: new Date(),
      };
      setCopilotMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);
      chatMutation.mutate(prompt);
    }
  }, [chatMutation]);

  // Handle action button click
  const handleActionClick = useCallback(async (action: CopilotAction) => {
    if (action.action === 'use_reply' && action.data?.text && onSuggestReply) {
      onSuggestReply(action.data.text as string);
      const confirmMessage: CopilotMessage = {
        id: `confirm-${Date.now()}`,
        role: 'assistant',
        content: '✅ Respuesta copiada al chat. Podés editarla antes de enviar.',
        type: 'action_result',
        timestamp: new Date(),
      };
      setCopilotMessages((prev) => [...prev, confirmMessage]);
    } else if (action.action === 'create_job') {
      // Execute create job action
      try {
        const response = await fetch('/api/copilot/execute-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action_type: 'create_job',
            data: action.data,
            conversation_id: conversation?.id,
          }),
        });
        const result = await response.json();

        const resultMessage: CopilotMessage = {
          id: `result-${Date.now()}`,
          role: 'assistant',
          content: result.success
            ? `✅ ${result.confirmation_message}`
            : `âŒ Error: ${result.error}`,
          type: result.success ? 'action_result' : 'warning',
          timestamp: new Date(),
        };
        setCopilotMessages((prev) => [...prev, resultMessage]);
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
      } catch {
        const errorMessage: CopilotMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'âŒ Error al crear el trabajo. Por favor intentá de nuevo.',
          type: 'warning',
          timestamp: new Date(),
        };
        setCopilotMessages((prev) => [...prev, errorMessage]);
      }
    } else if (action.action === 'dismiss') {
      // Just dismiss the suggestion
    }
  }, [conversation?.id, onSuggestReply, queryClient]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Handle reset
  const handleReset = useCallback(() => {
    setCopilotMessages([]);
    if (conversation) {
      const welcomeMessage: CopilotMessage = {
        id: 'welcome',
        role: 'assistant',
        content: `Conversación reiniciada. Estoy viendo tu chat con ${conversation.customerName}.`,
        type: 'message',
        timestamp: new Date(),
      };
      setCopilotMessages([welcomeMessage]);
    }
  }, [conversation]);

  if (!isOpen) return null;

  // Count voice memos in messages
  const _voiceMemoCount = messages.filter((m) => m.type === 'audio').length;

  // Show empty state when no conversation is selected
  if (!conversation) {
    return (
      <div className="w-[380px] border-l flex flex-col bg-white">
        {/* Header - matching left panel style */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900">Asistente IA</h1>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
              Listo
            </span>
          </div>
        </div>

        {/* Empty state content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <Bot className="h-6 w-6 text-gray-400" />
          </div>
          <p className="font-medium text-gray-900 mb-1">
            Asistente IA
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Seleccioná una conversación para que te ayude con:
          </p>
          <ul className="text-sm text-gray-600 space-y-2 text-left">
            <li className="flex items-center gap-2">
              <span className="text-teal-600">✓</span>
              Sugerir respuestas
            </li>
            <li className="flex items-center gap-2">
              <span className="text-teal-600">✓</span>
              Crear turnos automáticamente
            </li>
            <li className="flex items-center gap-2">
              <span className="text-teal-600">✓</span>
              Detectar conflictos de agenda
            </li>
            <li className="flex items-center gap-2">
              <span className="text-teal-600">✓</span>
              Transcribir mensajes de voz
            </li>
          </ul>
          {/* Phase 3: Simulation button in empty state */}
          {process.env.NODE_ENV !== 'production' && onSimulate && (
            <button
              onClick={onSimulate}
              className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
            >
              <Zap className="h-4 w-4" />
              Simular mensaje
            </button>
          )}
        </div>

        {/* Footer note */}
        <div className="px-4 py-3 border-t bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            🎵 La IA transcribe audios de voz automáticamente pero siempre responde por texto
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[380px] border-l flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-teal-600" />
          <span className="text-base font-semibold text-gray-900">Asistente IA</span>
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Activo
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
            title="Reiniciar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
            title="Configurar"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs + Context */}
      {conversation && (
        <div className="border-b bg-gray-50">
          {/* Tabs row */}
          <div className="flex items-center border-b">
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${activeTab === 'activity'
                ? 'text-teal-600 border-b-2 border-teal-500 bg-white'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Activity className="h-4 w-4" />
              Actividad
              {activities.length > 0 && (
                <span className="px-1.5 text-xs bg-teal-100 text-teal-700 rounded-full">
                  {activities.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${activeTab === 'chat'
                ? 'text-teal-600 border-b-2 border-teal-500 bg-white'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <MessageCircle className="h-4 w-4" />
              Chat
            </button>
          </div>
          {/* Context row */}
          <div className="px-3 py-1.5 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1.5 truncate">
              <Eye className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate font-medium">{conversation.customerName}</span>
              <span className="text-gray-300">•</span>
              <span>{messages.length} msgs</span>
            </div>
            <div className="flex items-center gap-1.5">
              {process.env.NODE_ENV !== 'production' && onSimulate && (
                <button
                  onClick={onSimulate}
                  className="px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600 text-xs font-medium flex items-center gap-1"
                  title="Simular mensaje"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Simular
                </button>
              )}
              <button
                onClick={() => setShowDemoMode(!showDemoMode)}
                className={`p-1.5 rounded ${showDemoMode
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                title={showDemoMode ? 'Demo activo' : 'Activar demo'}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Tab Content */}
      {activeTab === 'activity' && conversation && (
        <AIActivityFeed
          activities={activities}
          isLoading={isAnalyzing}
          onUseResponse={(response) => {
            if (onSuggestReply) {
              onSuggestReply(response);
            }
          }}
          onViewJob={(jobId) => {
            // TODO: Navigate to job page
            console.log('View job:', jobId);
          }}
          onViewCustomer={(customerId) => {
            // TODO: Navigate to customer page
            console.log('View customer:', customerId);
          }}
          onViewCalendar={(date) => {
            // TODO: Open calendar
            console.log('View calendar:', date);
          }}
        />
      )}

      {/* Chat Tab Content */}
      {activeTab === 'chat' && (
        <>
          {/* Chat area - scrollbar hidden for cleaner look */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {copilotMessages.map((msg) => (
              <CopilotMessageBubble
                key={msg.id}
                message={msg}
                onActionClick={handleActionClick}
                onFeedback={(messageId, feedback) => {
                  // Update feedback state locally
                  setCopilotMessages(prev => prev.map(m =>
                    m.id === messageId ? { ...m, feedback } : m
                  ));
                  // Send feedback to API (fire and forget)
                  fetch('/api/ai/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      conversationLogId: messageId,
                      feedback,
                      feedbackType: 'response',
                    }),
                  }).catch(err => console.error('Feedback error:', err));
                }}
              />
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Bot className="h-4 w-4 text-gray-600" />
                </div>
                <div className="bg-gray-100 rounded-lg rounded-tl-none px-4 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer: Collapsible Actions + Auto-growing Input */}
          <div className="border-t bg-gray-50">
            {/* Expandable actions panel */}
            {showActions && (
              <div className="px-3 py-2 border-b bg-white flex flex-wrap items-center gap-2 animate-in slide-in-from-bottom-2 duration-200">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      handleQuickAction(action.id);
                      setShowActions(false);
                    }}
                    disabled={chatMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-colors disabled:opacity-50"
                  >
                    <action.icon className="h-4 w-4" />
                    {action.label}
                  </button>
                ))}
              </div>
            )}
            {/* Auto-growing input area with + button */}
            <div className="p-3 flex gap-2 items-end">
              {/* Plus button to toggle actions */}
              <button
                onClick={() => setShowActions(!showActions)}
                className={`p-2.5 rounded-lg transition-all flex-shrink-0 ${showActions
                  ? 'bg-teal-100 text-teal-700 rotate-45'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                title={showActions ? 'Cerrar acciones' : 'Acciones rápidas'}
              >
                <Plus className="h-5 w-5 transition-transform" />
              </button>
              {/* Auto-growing textarea */}
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // Auto-resize the textarea
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                  }}
                  onKeyDown={handleKeyPress}
                  placeholder="Preguntame algo sobre esta conversación..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent overflow-hidden transition-all"
                  style={{ minHeight: '40px', maxHeight: '160px' }}
                  rows={1}
                  disabled={chatMutation.isPending}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || chatMutation.isPending}
                className="p-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MESSAGE BUBBLE COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface CopilotMessageBubbleProps {
  message: CopilotMessage;
  onActionClick: (action: CopilotAction) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
}

function CopilotMessageBubble({ message, onActionClick, onFeedback }: CopilotMessageBubbleProps) {
  const isUser = message.role === 'user';

  // Get styling based on message type
  const getMessageStyle = () => {
    if (isUser) {
      return 'bg-teal-500 text-white rounded-tr-none ml-auto';
    }

    switch (message.type) {
      case 'suggestion':
        return 'bg-blue-50 border border-blue-200 rounded-tl-none';
      case 'warning':
        return 'bg-amber-50 border border-amber-300 rounded-tl-none';
      case 'action_result':
        return 'bg-green-50 border border-green-200 rounded-tl-none';
      default:
        return 'bg-gray-100 rounded-tl-none';
    }
  };

  // Get icon for message type
  const getIcon = () => {
    switch (message.type) {
      case 'suggestion':
        return <Sparkles className="h-4 w-4 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'action_result':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Bot className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${message.type === 'suggestion' ? 'bg-blue-100' :
          message.type === 'warning' ? 'bg-amber-100' :
            message.type === 'action_result' ? 'bg-green-100' :
              'bg-gray-100'
          }`}>
          {getIcon()}
        </div>
      )}

      <div className={`max-w-[85%] rounded-lg px-3 py-2 ${getMessageStyle()}`}>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</div>

        {/* Action buttons */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.actions.map((action) => (
              <button
                key={action.id}
                onClick={() => onActionClick(action)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${action.variant === 'primary'
                  ? 'bg-teal-500 text-white hover:bg-teal-600'
                  : action.variant === 'secondary'
                    ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'text-teal-600 hover:bg-teal-50'
                  }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Feedback buttons for AI messages */}
        {!isUser && onFeedback && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200/50">
            <span className="text-xs text-gray-400">¿Útil?</span>
            <button
              onClick={() => onFeedback(message.id, 'positive')}
              className={`p-1 rounded transition-colors ${message.feedback === 'positive'
                ? 'bg-green-100 text-green-600'
                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
              title="Útil"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onFeedback(message.id, 'negative')}
              className={`p-1 rounded transition-colors ${message.feedback === 'negative'
                ? 'bg-red-100 text-red-600'
                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
              title="No útil"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
