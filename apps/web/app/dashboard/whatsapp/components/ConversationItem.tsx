'use client';

import { Check, CheckCheck, Clock, AlertCircle, Bot, AlertTriangle, Briefcase } from 'lucide-react';
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
      return <CheckCheck className="h-3.5 w-3.5 text-teal-500 flex-shrink-0" />;
    case 'failed':
      return <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />;
  }
}

/**
 * Get AI confidence color based on score
 */
function getAIConfidenceStyle(confidence: number): { bg: string; text: string; label: string } {
  if (confidence >= 80) {
    return { bg: 'bg-green-100', text: 'text-green-700', label: 'Alto' };
  } else if (confidence >= 50) {
    return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medio' };
  } else {
    return { bg: 'bg-red-100', text: 'text-red-700', label: 'Bajo' };
  }
}

export default function ConversationItem({
  conversation,
  isSelected,
  onClick }: ConversationItemProps) {
  const {
    customerName,
    lastMessage,
    unreadCount,
    isInWindow,
    aiHandling,
    aiConfidence,
    isNewLead,
    needsAttention,
    hasPendingJob } = conversation;

  const initials = customerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Get AI confidence styling
  const confidenceStyle = aiConfidence !== undefined ? getAIConfidenceStyle(aiConfidence) : null;

  // Determine which tags to show (max 2 to avoid clutter)
  const tags: Array<{ label: string; color: string; icon?: React.ReactNode }> = [];

  // Show AI confidence as first tag if available
  if (aiConfidence !== undefined && aiHandling) {
    tags.push({
      label: `IA ${aiConfidence}%`,
      color: `${confidenceStyle?.bg} ${confidenceStyle?.text}`,
      icon: <Bot className="h-3 w-3" />
    });
  } else if (aiHandling) {
    tags.push({
      label: 'AI Manejando',
      color: 'bg-teal-100 text-teal-700',
      icon: <Bot className="h-3 w-3" />
    });
  }
  if (isNewLead) {
    tags.push({
      label: 'Nuevo Lead',
      color: 'bg-orange-100 text-orange-700'
    });
  }
  if (needsAttention) {
    tags.push({
      label: 'Requiere atención',
      color: 'bg-red-100 text-red-700',
      icon: <AlertTriangle className="h-3 w-3" />
    });
  }
  if (hasPendingJob) {
    tags.push({
      label: 'Trabajo pendiente',
      color: 'bg-purple-100 text-purple-700',
      icon: <Briefcase className="h-3 w-3" />
    });
  }

  // Show only first 2 tags
  const visibleTags = tags.slice(0, 2);

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 flex items-start gap-3 border-b hover:bg-gray-50 text-left transition-colors ${isSelected ? 'bg-teal-50 border-l-2 border-l-teal-500' : ''
        }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
          {initials}
        </div>
        {isInWindow && (
          <div
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"
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
          {/* AI/Human indicator for outbound messages */}
          {lastMessage.direction === 'outbound' && lastMessage.senderType === 'ai' && (
            <Bot className="h-3 w-3 text-teal-500 flex-shrink-0" />
          )}
          <span className={`truncate ${unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            {lastMessage.content}
          </span>
        </div>

        {/* Tags row */}
        {visibleTags.length > 0 && (
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {visibleTags.map((tag, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${tag.color}`}
              >
                {tag.icon}
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-teal-500 text-white text-xs font-medium rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
