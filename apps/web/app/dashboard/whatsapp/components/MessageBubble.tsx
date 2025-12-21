'use client';

import { useState } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  Mic,
  MapPin,
  User,
  Play,
  Download,
  Maximize2,
  Bot,
  Sparkles,
  Zap,
  UserPlus,
  CalendarPlus,
  UserCheck,
} from 'lucide-react';

export interface Message {
  id: string;
  waMessageId: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'template' | 'location' | 'contacts' | 'interactive' | 'sticker' | 'ai_action';
  content: string;
  mediaUrl?: string;
  timestamp: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  // AI-related fields
  senderType?: 'customer' | 'ai' | 'human' | 'system';
  senderUserId?: string;
  senderUserName?: string;
  aiConfidence?: number;
  aiActionTaken?: 'customer_created' | 'job_created' | 'technician_assigned' | 'schedule_confirmed' | 'suggestion' | 'conflict_detected' | 'price_quoted';
  aiActionMetadata?: {
    customerName?: string;
    jobNumber?: string;
    technicianName?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    serviceType?: string;
    price?: string;
  };
  isProactiveSuggestion?: boolean; // AI suggested this without being asked
}

interface MessageBubbleProps {
  message: Message;
  onImageClick?: (url: string) => void;
  onMediaDownload?: (messageId: string) => void;
}

function MessageStatus({ status }: { status: string }) {
  switch (status) {
    case 'sent':
      return <Check className="h-3.5 w-3.5 text-white/70" />;
    case 'delivered':
      return <CheckCheck className="h-3.5 w-3.5 text-white/70" />;
    case 'read':
      return <CheckCheck className="h-3.5 w-3.5 text-white" />;
    case 'failed':
      return <AlertCircle className="h-3.5 w-3.5 text-red-300" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-white/70" />;
  }
}

function InboundMessageStatus({ status }: { status: string }) {
  switch (status) {
    case 'sent':
      return <Check className="h-3.5 w-3.5 text-gray-400" />;
    case 'delivered':
      return <CheckCheck className="h-3.5 w-3.5 text-gray-400" />;
    case 'read':
      return <CheckCheck className="h-3.5 w-3.5 text-teal-500" />;
    case 'failed':
      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-gray-400" />;
  }
}

export default function MessageBubble({ message, onImageClick, onMediaDownload }: MessageBubbleProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const isOutbound = message.direction === 'outbound';
  const isAI = message.senderType === 'ai';
  const isHuman = message.senderType === 'human';

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMediaContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <div className="relative group">
            {message.mediaUrl ? (
              <>
                <img
                  src={message.mediaUrl}
                  alt="Image"
                  className={`rounded-lg max-w-full cursor-pointer transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setImageLoaded(true)}
                  onClick={() => onImageClick?.(message.mediaUrl!)}
                />
                {!imageLoaded && (
                  <div className="w-48 h-32 bg-gray-200 rounded-lg animate-pulse" />
                )}
                <button
                  onClick={() => onImageClick?.(message.mediaUrl!)}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="w-48 h-32 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                <span className="text-sm">Imagen no disponible</span>
              </div>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="relative">
            {message.mediaUrl ? (
              <video
                src={message.mediaUrl}
                controls
                className="rounded-lg max-w-full max-h-64"
              />
            ) : (
              <div className="w-48 h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                <Play className="h-8 w-8 text-gray-500" />
              </div>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className={`flex items-center gap-3 p-3 rounded-lg min-w-[200px] ${isOutbound ? 'bg-teal-600/20' : 'bg-gray-100'}`}>
            <button className="p-2 bg-teal-500 text-white rounded-full">
              <Play className="h-4 w-4" />
            </button>
            {message.mediaUrl ? (
              <audio src={message.mediaUrl} controls className="flex-1 h-8" />
            ) : (
              <div className="flex-1 h-1 bg-gray-300 rounded" />
            )}
            <Mic className="h-4 w-4 text-gray-400" />
          </div>
        );

      case 'document':
        return (
          <div className={`flex items-center gap-3 p-3 rounded-lg ${isOutbound ? 'bg-teal-600/20' : 'bg-gray-100'}`}>
            <div className={`p-2 rounded ${isOutbound ? 'bg-teal-500/20' : 'bg-teal-100'}`}>
              <FileText className={`h-6 w-6 ${isOutbound ? 'text-white' : 'text-teal-600'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isOutbound ? 'text-white' : 'text-gray-900'}`}>
                {message.content || 'Documento'}
              </p>
              <p className={`text-xs ${isOutbound ? 'text-white/70' : 'text-gray-500'}`}>PDF, DOC, XLS...</p>
            </div>
            <button
              onClick={() => onMediaDownload?.(message.id)}
              className={`p-2 rounded ${isOutbound ? 'hover:bg-teal-600/30 text-white' : 'hover:bg-gray-200 text-gray-500'}`}
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        );

      case 'location':
        return (
          <div className={`flex items-center gap-3 p-3 rounded-lg ${isOutbound ? 'bg-teal-600/20' : 'bg-gray-100'}`}>
            <div className={`p-2 rounded ${isOutbound ? 'bg-red-500/20' : 'bg-red-100'}`}>
              <MapPin className={`h-6 w-6 ${isOutbound ? 'text-white' : 'text-red-600'}`} />
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${isOutbound ? 'text-white' : 'text-gray-900'}`}>Ubicacion</p>
              <p className={`text-xs truncate ${isOutbound ? 'text-white/70' : 'text-gray-500'}`}>{message.content}</p>
            </div>
          </div>
        );

      case 'contacts':
        return (
          <div className={`flex items-center gap-3 p-3 rounded-lg ${isOutbound ? 'bg-teal-600/20' : 'bg-gray-100'}`}>
            <div className={`p-2 rounded ${isOutbound ? 'bg-green-500/20' : 'bg-green-100'}`}>
              <User className={`h-6 w-6 ${isOutbound ? 'text-white' : 'text-green-600'}`} />
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${isOutbound ? 'text-white' : 'text-gray-900'}`}>Contacto</p>
              <p className={`text-xs truncate ${isOutbound ? 'text-white/70' : 'text-gray-500'}`}>{message.content}</p>
            </div>
          </div>
        );

      case 'sticker':
        return (
          <div className="w-32 h-32">
            {message.mediaUrl ? (
              <img
                src={message.mediaUrl}
                alt="Sticker"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                <span role="img" aria-label="sticker">{message.content}</span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // For stickers, render without bubble wrapper
  if (message.type === 'sticker') {
    return (
      <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[70%]">
          {renderMediaContent()}
          <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
            <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
            {isOutbound && <MessageStatus status={message.status} />}
          </div>
        </div>
      </div>
    );
  }

  // AI Action Banner - system notification style (centered)
  if (message.type === 'ai_action' || message.aiActionTaken) {
    return <AIActionMessage message={message} formatTime={formatTime} />;
  }

  // Determine bubble colors based on sender type
  let bubbleClasses = '';
  let textClasses = '';
  let wrapperClasses = '';

  if (isOutbound) {
    if (isAI) {
      // AI message - teal-500 with subtle glow for proactive suggestions
      bubbleClasses = 'bg-teal-500 text-white rounded-lg rounded-tr-none';
      textClasses = 'text-white';
      if (message.isProactiveSuggestion) {
        wrapperClasses = 'ring-2 ring-purple-300 ring-offset-2';
      }
    } else {
      // Human message - teal-600 (darker)
      bubbleClasses = 'bg-teal-600 text-white rounded-lg rounded-tr-none';
      textClasses = 'text-white';
    }
  } else {
    // Inbound (customer) message - white with border
    bubbleClasses = 'bg-white border border-gray-200 text-gray-900 rounded-lg rounded-tl-none';
    textClasses = 'text-gray-900';
  }

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] p-3 ${bubbleClasses} ${wrapperClasses}`}>
        {/* Proactive suggestion indicator */}
        {message.isProactiveSuggestion && isAI && (
          <div className="flex items-center gap-1 mb-2 px-2 py-1 bg-purple-400/30 rounded-full w-fit">
            <Sparkles className="h-3 w-3 text-purple-200" />
            <span className="text-xs text-purple-100 font-medium">Sugerencia proactiva</span>
          </div>
        )}

        {/* Sender indicator for outbound messages */}
        {isOutbound && (isAI || isHuman) && (
          <div className="flex items-center gap-1 mb-1 text-xs text-white/80">
            {isAI ? (
              <>
                <Bot className="h-3 w-3" />
                <span>AI</span>
                {message.aiConfidence && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
                    message.aiConfidence >= 80 ? 'bg-green-400/30' :
                    message.aiConfidence >= 50 ? 'bg-yellow-400/30' : 'bg-red-400/30'
                  }`}>
                    {message.aiConfidence}%
                  </span>
                )}
              </>
            ) : (
              <>
                <User className="h-3 w-3" />
                <span>{message.senderUserName || 'Vos'}</span>
              </>
            )}
          </div>
        )}

        {/* Media content */}
        {message.type !== 'text' && message.type !== 'template' && message.type !== 'ai_action' && (
          <div className="mb-2">{renderMediaContent()}</div>
        )}

        {/* Template badge */}
        {message.type === 'template' && (
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full mb-2 ${
            isOutbound ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            <FileText className="h-3 w-3" />
            Template
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <p className={`text-sm whitespace-pre-wrap break-words ${textClasses}`}>{message.content}</p>
        )}

        {/* Timestamp and status */}
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className={`text-xs ${isOutbound ? 'text-white/70' : 'text-gray-500'}`}>
            {formatTime(message.timestamp)}
          </span>
          {isOutbound && <MessageStatus status={message.status} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI ACTION MESSAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface AIActionMessageProps {
  message: Message;
  formatTime: (timestamp: string) => string;
}

const AI_ACTION_CONFIG: Record<string, {
  icon: React.ElementType;
  bgColor: string;
  borderColor: string;
  iconBg: string;
  iconColor: string;
  title: string;
}> = {
  customer_created: {
    icon: UserPlus,
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    title: 'Cliente Creado',
  },
  job_created: {
    icon: CalendarPlus,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    title: 'Turno Creado',
  },
  technician_assigned: {
    icon: UserCheck,
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    title: 'Técnico Asignado',
  },
  schedule_confirmed: {
    icon: Check,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    title: 'Turno Confirmado',
  },
  suggestion: {
    icon: Sparkles,
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    title: 'Sugerencia de IA',
  },
  conflict_detected: {
    icon: AlertCircle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    title: 'Conflicto Detectado',
  },
  price_quoted: {
    icon: Zap,
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    title: 'Precio Informado',
  },
};

function AIActionMessage({ message, formatTime }: AIActionMessageProps) {
  const actionType = message.aiActionTaken || 'suggestion';
  const config = AI_ACTION_CONFIG[actionType] || AI_ACTION_CONFIG.suggestion;
  const Icon = config.icon;
  const metadata = message.aiActionMetadata;

  // Build detail items
  const details: string[] = [];
  if (metadata?.customerName) details.push(`Cliente: ${metadata.customerName}`);
  if (metadata?.jobNumber) details.push(`Turno: ${metadata.jobNumber}`);
  if (metadata?.technicianName) details.push(`Técnico: ${metadata.technicianName}`);
  if (metadata?.scheduledDate) {
    const dateStr = new Date(metadata.scheduledDate).toLocaleDateString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    details.push(`Fecha: ${dateStr}${metadata.scheduledTime ? ` ${metadata.scheduledTime}` : ''}`);
  }
  if (metadata?.serviceType) details.push(`Servicio: ${metadata.serviceType}`);
  if (metadata?.price) details.push(`Precio: ${metadata.price}`);

  return (
    <div className="flex justify-center my-2">
      <div className={`max-w-sm ${config.bgColor} ${config.borderColor} border rounded-lg p-3 shadow-sm`}>
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 p-2 rounded-full ${config.iconBg}`}>
            <Icon className={`h-4 w-4 ${config.iconColor}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Bot className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-500">IA</span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
            </div>

            <h4 className="font-semibold text-sm mt-1 text-gray-900">
              {config.title}
            </h4>

            {/* Details */}
            {details.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {details.map((detail, idx) => (
                  <p key={idx} className="text-xs text-gray-600">{detail}</p>
                ))}
              </div>
            )}

            {/* Additional text content */}
            {message.content && !details.length && (
              <p className="text-xs text-gray-600 mt-1">{message.content}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
