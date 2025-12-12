'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatRelativeTime, searchMatchesAny } from '@/lib/utils';
import {
  MessageCircle,
  Search,
  Filter,
  MoreVertical,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
  Send,
  Paperclip,
  Smile,
  Phone,
  Image,
  FileText,
  Mic,
} from 'lucide-react';

interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastMessage: {
    content: string;
    timestamp: string;
    direction: 'inbound' | 'outbound';
    status: 'sent' | 'delivered' | 'read' | 'failed';
  };
  unreadCount: number;
  isInWindow: boolean;
}

interface Message {
  id: string;
  waMessageId: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'image' | 'document' | 'audio' | 'template';
  content: string;
  mediaUrl?: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

export default function WhatsAppPage() {
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'in_window'>('all');

  const { data: conversationsData, isLoading: loadingConversations } = useQuery({
    queryKey: ['whatsapp-conversations', filter],
    queryFn: () => api.whatsapp.conversations.list({ filter }),
  });

  const conversations = (conversationsData?.data || []) as Conversation[];

  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ['whatsapp-messages', selectedConversation],
    queryFn: () => api.whatsapp.messages.list(selectedConversation!),
    enabled: !!selectedConversation,
  });

  const messages = (messagesData?.data || []) as Message[];

  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      api.whatsapp.messages.send(selectedConversation!, { text }),
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    },
  });

  const selectedCustomer = conversations.find(
    (c) => c.id === selectedConversation
  );

  const filteredConversations = conversations.filter((c) => {
    if (searchQuery) {
      return searchMatchesAny([c.customerName, c.customerPhone], searchQuery);
    }
    return true;
  });

  const handleSend = () => {
    if (!messageInput.trim() || !selectedConversation) return;
    sendMutation.mutate(messageInput.trim());
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6">
      {/* Conversations sidebar */}
      <div className="w-80 border-r flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-900">WhatsApp</h1>
            <Link
              href="/dashboard/whatsapp/templates"
              className="text-sm text-primary-600 hover:underline"
            >
              Templates
            </Link>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar conversaciones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-3">
            {(['all', 'unread', 'in_window'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-full ${
                  filter === f
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'all' && 'Todas'}
                {f === 'unread' && 'No leídas'}
                {f === 'in_window' && 'En ventana'}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="p-4 text-center text-gray-500">Cargando...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No hay conversaciones
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={`w-full p-4 flex items-start gap-3 border-b hover:bg-gray-50 text-left ${
                  selectedConversation === conv.id ? 'bg-primary-50' : ''
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                    {conv.customerName[0].toUpperCase()}
                  </div>
                  {conv.isInWindow && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 truncate">
                      {conv.customerName}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatRelativeTime(conv.lastMessage.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    {conv.lastMessage.direction === 'outbound' && (
                      <MessageStatus status={conv.lastMessage.status} />
                    )}
                    <span className="truncate">{conv.lastMessage.content}</span>
                  </div>
                </div>
                {conv.unreadCount > 0 && (
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-success-500 text-white text-xs rounded-full">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedConversation && selectedCustomer ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b bg-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                  {selectedCustomer.customerName[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="font-medium text-gray-900">
                    {selectedCustomer.customerName}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedCustomer.customerPhone}
                    {selectedCustomer.isInWindow && (
                      <span className="ml-2 text-success-600">En ventana 24h</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/customers/${selectedCustomer.customerId}`}
                  className="btn-outline text-sm"
                >
                  Ver cliente
                </Link>
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="text-center text-gray-500">Cargando mensajes...</div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))
              )}
            </div>

            {/* Input area */}
            <div className="p-4 border-t bg-white">
              {!selectedCustomer.isInWindow && (
                <div className="mb-3 p-3 bg-warning-50 border border-warning-200 rounded-lg">
                  <div className="flex items-center gap-2 text-warning-700 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>
                      Fuera de la ventana de 24 horas. Solo podés enviar mensajes de template.
                    </span>
                  </div>
                  <Link
                    href="/dashboard/whatsapp/templates"
                    className="text-sm text-primary-600 hover:underline mt-1 inline-block"
                  >
                    Enviar template
                  </Link>
                </div>
              )}
              <div className="flex items-end gap-2">
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded">
                  <Paperclip className="h-5 w-5" />
                </button>
                <div className="flex-1">
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={
                      selectedCustomer.isInWindow
                        ? 'Escribí un mensaje...'
                        : 'Solo templates fuera de la ventana 24h'
                    }
                    disabled={!selectedCustomer.isInWindow}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="w-full px-4 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
                    rows={1}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!messageInput.trim() || !selectedCustomer.isInWindow || sendMutation.isPending}
                  className="p-2 bg-success-500 text-white rounded-lg hover:bg-success-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Seleccioná una conversación para ver los mensajes</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageStatus({ status }: { status: string }) {
  switch (status) {
    case 'sent':
      return <Check className="h-4 w-4 text-gray-400" />;
    case 'delivered':
      return <CheckCheck className="h-4 w-4 text-gray-400" />;
    case 'read':
      return <CheckCheck className="h-4 w-4 text-primary-500" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-danger-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'outbound';

  return (
    <div
      className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[70%] rounded-lg p-3 ${
          isOutbound
            ? 'bg-success-100 text-gray-900'
            : 'bg-white border text-gray-900'
        }`}
      >
        {/* Media preview */}
        {message.type === 'image' && message.mediaUrl && (
          <img
            src={message.mediaUrl}
            alt="Image"
            className="rounded mb-2 max-w-full"
          />
        )}
        {message.type === 'document' && (
          <div className="flex items-center gap-2 p-2 bg-gray-100 rounded mb-2">
            <FileText className="h-5 w-5 text-gray-500" />
            <span className="text-sm">Documento</span>
          </div>
        )}
        {message.type === 'audio' && (
          <div className="flex items-center gap-2 p-2 bg-gray-100 rounded mb-2">
            <Mic className="h-5 w-5 text-gray-500" />
            <span className="text-sm">Audio</span>
          </div>
        )}

        {/* Text content */}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {/* Timestamp and status */}
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-xs text-gray-500">
            {new Date(message.timestamp).toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {isOutbound && <MessageStatus status={message.status} />}
        </div>
      </div>
    </div>
  );
}
