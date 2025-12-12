'use client';

import { useState } from 'react';
import { Search, Filter, Plus, RefreshCw } from 'lucide-react';
import { searchMatchesAny, formatRelativeTime } from '@/lib/utils';
import ConversationItem from './ConversationItem';

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastMessage: {
    content: string;
    timestamp: string;
    direction: 'inbound' | 'outbound';
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  };
  unreadCount: number;
  isInWindow: boolean;
}

export type ConversationFilter = 'all' | 'unread' | 'in_window';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: ConversationFilter;
  onFilterChange: (filter: ConversationFilter) => void;
  isLoading: boolean;
  onRefresh?: () => void;
  onNewConversation?: () => void;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  isLoading,
  onRefresh,
  onNewConversation,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter((c) => {
    if (searchQuery) {
      return searchMatchesAny([c.customerName, c.customerPhone], searchQuery);
    }
    return true;
  });

  return (
    <div className="w-80 border-r flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-900">WhatsApp</h1>
          <div className="flex items-center gap-1">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                title="Actualizar"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            {onNewConversation && (
              <button
                onClick={onNewConversation}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                title="Nueva conversacion"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
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
              onClick={() => onFilterChange(f)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filter === f
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' && 'Todas'}
              {f === 'unread' && 'No leidas'}
              {f === 'in_window' && 'En ventana'}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
            Cargando...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery ? 'No se encontraron resultados' : 'No hay conversaciones'}
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedId === conversation.id}
              onClick={() => onSelect(conversation.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
