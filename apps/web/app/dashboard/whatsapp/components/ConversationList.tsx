'use client';

import { useState } from 'react';
import { Search, RefreshCw, Plus, Users } from 'lucide-react';
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
    senderType?: 'customer' | 'ai' | 'human';
  };
  unreadCount: number;
  isInWindow: boolean;
  // AI-related fields
  aiHandling?: boolean;
  isNewLead?: boolean;
  needsAttention?: boolean;
  hasPendingJob?: boolean;
  aiDisabledUntil?: string | null;
}

export type ConversationFilter = 'all' | 'unread' | 'in_window' | 'ai_handling' | 'needs_attention';

export interface ConversationStats {
  totalToday: number;
  aiResolvedPercent: number;
  pendingCount: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: ConversationFilter;
  onFilterChange: (filter: ConversationFilter) => void;
  isLoading: boolean;
  onRefresh?: () => void;
  onNewConversation?: () => void;
  onShowContacts?: () => void;
  isConnected?: boolean;
  stats?: ConversationStats;
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
  onShowContacts,
  isConnected = true,
  stats,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter((c) => {
    // Apply search filter
    if (searchQuery && !searchMatchesAny([c.customerName, c.customerPhone], searchQuery)) {
      return false;
    }

    // Apply status filter
    switch (filter) {
      case 'unread':
        return c.unreadCount > 0;
      case 'in_window':
        return c.isInWindow;
      case 'ai_handling':
        return c.aiHandling;
      case 'needs_attention':
        return c.needsAttention;
      default:
        return true;
    }
  });

  const filterOptions: { value: ConversationFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'unread', label: 'No leidas' },
    { value: 'in_window', label: 'En ventana' },
  ];

  return (
    <div className="w-[350px] border-r flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900">WhatsApp</h1>
            {/* Connection Status Badge */}
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                isConnected
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {onShowContacts && (
              <button
                onClick={onShowContacts}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                title="Ver contactos"
              >
                <Users className="h-4 w-4" />
              </button>
            )}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                title="Sincronizar"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            {onNewConversation && (
              <button
                onClick={onNewConversation}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                title="Nueva conversacion"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar conversaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {filterOptions.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filter === f.value
                  ? 'bg-teal-100 text-teal-700 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-around">
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">{stats.totalToday}</p>
            <p className="text-xs text-gray-500">Hoy</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-green-600">{stats.aiResolvedPercent}%</p>
            <p className="text-xs text-gray-500">AI Resuelto</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-orange-500">{stats.pendingCount}</p>
            <p className="text-xs text-gray-500">Pendientes</p>
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
            Cargando...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Search className="h-6 w-6 text-gray-400" />
            </div>
            <p className="font-medium">
              {searchQuery ? 'No se encontraron resultados' : 'No hay conversaciones'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery
                ? 'Intentá con otros términos de búsqueda'
                : 'Las conversaciones de WhatsApp aparecerán aquí'}
            </p>
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
