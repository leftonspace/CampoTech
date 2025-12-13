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
  Info,
} from 'lucide-react';
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

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-50">
        <div className="text-center">
          <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
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
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success-500 rounded-full border-2 border-white" />
            )}
          </div>
          <div>
            <h2 className="font-medium text-gray-900">{conversation.customerName}</h2>
            <p className="text-sm text-gray-500">
              {conversation.customerPhone}
              {conversation.isInWindow && (
                <span className="ml-2 text-success-600 font-medium">En ventana 24h</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conversation.customerId && (
            <Link
              href={`/dashboard/customers/${conversation.customerId}`}
              className="btn-outline text-sm"
            >
              Ver cliente
            </Link>
          )}

          {/* Actions menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded"
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
                    className="w-full px-4 py-2 text-left text-sm text-danger-600 hover:bg-danger-50 flex items-center gap-2"
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
              className="text-sm text-primary-600 hover:underline"
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

      {/* Message input */}
      <MessageInput
        isInWindow={conversation.isInWindow}
        isSending={isSending}
        onSend={onSendMessage}
        onSendTemplate={onSendTemplate}
      />

      {/* Image modal */}
      {imageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setImageModal(null)}
        >
          <img
            src={imageModal}
            alt="Full size"
            className="max-w-[90vw] max-h-[90vh] object-contain"
          />
        </div>
      )}
    </div>
  );
}
