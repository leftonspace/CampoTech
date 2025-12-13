'use client';

import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import type { Conversation } from './ConversationList';

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

function MessageStatus({ status }: { status: string }) {
  switch (status) {
    case 'sent':
      return <Check className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />;
    case 'delivered':
      return <CheckCheck className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />;
    case 'read':
      return <CheckCheck className="h-3.5 w-3.5 text-primary-500 flex-shrink-0" />;
    case 'failed':
      return <AlertCircle className="h-3.5 w-3.5 text-danger-500 flex-shrink-0" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />;
  }
}

export default function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: ConversationItemProps) {
  const { customerName, customerPhone, lastMessage, unreadCount, isInWindow } = conversation;
  const initials = customerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 flex items-start gap-3 border-b hover:bg-gray-50 text-left transition-colors ${
        isSelected ? 'bg-primary-50' : ''
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
          {initials}
        </div>
        {isInWindow && (
          <div
            className="absolute -bottom-1 -right-1 w-4 h-4 bg-success-500 rounded-full border-2 border-white"
            title="En ventana de 24h"
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-medium truncate ${unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
            {customerName}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0">
            {formatRelativeTime(lastMessage.timestamp)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm mt-0.5">
          {lastMessage.direction === 'outbound' && (
            <MessageStatus status={lastMessage.status} />
          )}
          <span className={`truncate ${unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            {lastMessage.content}
          </span>
        </div>
        {/* Phone number on smaller text */}
        <span className="text-xs text-gray-400 mt-0.5 block truncate">
          {customerPhone}
        </span>
      </div>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-success-500 text-white text-xs font-medium rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
