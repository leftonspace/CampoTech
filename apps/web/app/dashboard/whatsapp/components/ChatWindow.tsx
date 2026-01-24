'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MessageCircle,
  MoreVertical,
  RefreshCw,
  Archive,
  XCircle,
  UserPlus,
  User,
  Info,
  Phone,
  Bot,
} from 'lucide-react';
import { formatDisplayTime } from '@/lib/timezone';
import MessageBubble, { Message } from './MessageBubble';
import MessageInput from './MessageInput';
import type { Conversation } from './ConversationList';

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  isLoadingMessages: boolean;
  isSending: boolean;
  onSendMessage: (text: string) => void;
  onSendTemplate: () => void;
  onLoadMore?: () => void;
  hasMoreMessages?: boolean;
  onAction?: (action: 'archive' | 'close' | 'assign' | 'info') => void;
  // AI-related props
  aiEnabled?: boolean;
  aiHandlingConversation?: boolean;
  aiDisabledUntil?: string | null;
  onDisableAI?: (minutes: number) => void;
  onEnableAI?: () => void;
  onGoToSettings?: () => void;
  // Controlled input for copilot suggestions
  inputValue?: string;
  onInputChange?: (value: string) => void;
}

export default function ChatWindow({
  conversation,
  messages,
  isLoadingMessages,
  isSending,
  onSendMessage,
  onSendTemplate,
  onLoadMore,
  hasMoreMessages,
  onAction,
  aiEnabled = false,
  aiHandlingConversation: _aiHandlingConversation = false,
  aiDisabledUntil = null,
  onDisableAI,
  onEnableAI: _onEnableAI,
  onGoToSettings: _onGoToSettings,
  inputValue,
  onInputChange,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [imageModal, setImageModal] = useState<string | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle scroll to load more
  const handleScroll = () => {
    if (!messagesContainerRef.current || !onLoadMore || !hasMoreMessages) return;

    const { scrollTop } = messagesContainerRef.current;
    if (scrollTop === 0) {
      onLoadMore();
    }
  };

  // Format time for AI disabled until display
  const formatDisabledUntil = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return formatDisplayTime(date);
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-lg font-medium text-gray-600">Selecciona una conversacion</p>
          <p className="text-sm text-gray-400 mt-1">
            Elige una conversacion de la lista para ver los mensajes
          </p>
        </div>
      </div>
    );
  }

  const initials = conversation.customerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Chat header */}
      <div className="p-4 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
              {initials}
            </div>
            {conversation.isInWindow && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
            )}
          </div>
          <div>
            <h2 className="font-medium text-gray-900">{conversation.customerName}</h2>
            <p className="text-sm text-gray-500">{conversation.customerPhone}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Phone button */}
          <button
            className="p-2 text-gray-500 hover:bg-gray-100 rounded transition-colors"
            title="Llamar"
          >
            <Phone className="h-5 w-5" />
          </button>

          {/* Actions menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded transition-colors"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-lg shadow-lg z-20">
                  <button
                    onClick={() => {
                      onAction?.('info');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Info className="h-4 w-4" />
                    Ver informacion
                  </button>
                  {conversation.customerId && (
                    <Link
                      href={`/dashboard/customers/${conversation.customerId}`}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      onClick={() => setShowMenu(false)}
                    >
                      <User className="h-4 w-4" />
                      Ver perfil del cliente
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      onAction?.('assign');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Asignar
                  </button>
                  <button
                    onClick={() => {
                      onAction?.('archive');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Archive className="h-4 w-4" />
                    Archivar
                  </button>
                  <button
                    onClick={() => {
                      onAction?.('close');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Cerrar conversacion
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Load more indicator */}
        {hasMoreMessages && (
          <div className="text-center">
            <button
              onClick={onLoadMore}
              className="text-sm text-teal-600 hover:underline"
            >
              Cargar mensajes anteriores
            </button>
          </div>
        )}

        {isLoadingMessages ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Cargando mensajes...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageCircle className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p>No hay mensajes aun</p>
            <p className="text-sm">Envia el primer mensaje para iniciar la conversacion</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onImageClick={(url) => setImageModal(url)}
            />
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* AI Status Bar - only show if AI is enabled */}
      {aiEnabled ? (
        <div className="px-4 py-2 border-t bg-teal-50 border-teal-100">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-teal-700">
              <Bot className="h-4 w-4" />
              <span>AI Copilot activo</span>
            </div>
            {aiDisabledUntil ? (
              <span className="text-xs text-gray-500">
                Pausado hasta {formatDisabledUntil(aiDisabledUntil)}
              </span>
            ) : onDisableAI && (
              <button
                onClick={() => onDisableAI(30)}
                className="text-xs text-teal-600 hover:text-teal-800 hover:underline"
              >
                Pausar 30 min
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Message input */}
      <MessageInput
        isInWindow={conversation.isInWindow}
        isSending={isSending}
        onSend={onSendMessage}
        onSendTemplate={onSendTemplate}
        value={inputValue}
        onChange={onInputChange}
      />

      {/* Image modal */}
      {imageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setImageModal(null)}
        >
          <img src={imageModal} alt="Full size" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}
