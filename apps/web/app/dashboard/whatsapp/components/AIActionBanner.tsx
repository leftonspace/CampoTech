'use client';

/**
 * AI Action Banner
 * ================
 *
 * Displays AI actions as distinct system notifications in the conversation.
 * These are visually different from regular messages to clearly indicate
 * automated actions taken by the AI.
 *
 * Action Types:
 * - customer_created: New customer profile created
 * - job_created: New job/booking created
 * - technician_assigned: Technician assigned to job
 * - schedule_confirmed: Appointment confirmed
 * - conflict_detected: Scheduling conflict detected
 * - suggestion: Proactive AI suggestion (needs review)
 */

import {
  UserPlus,
  CalendarPlus,
  UserCheck,
  CalendarCheck,
  AlertTriangle,
  Lightbulb,
  Bot,
  CheckCircle,
  Clock,
  MapPin,
  Wrench,
} from 'lucide-react';

export type AIActionType =
  | 'customer_created'
  | 'job_created'
  | 'technician_assigned'
  | 'schedule_confirmed'
  | 'conflict_detected'
  | 'suggestion'
  | 'transfer_to_human'
  | 'availability_checked'
  | 'price_quoted';

export interface AIAction {
  id: string;
  type: AIActionType;
  timestamp: string;
  title: string;
  description?: string;
  metadata?: {
    customerId?: string;
    customerName?: string;
    jobId?: string;
    jobNumber?: string;
    technicianId?: string;
    technicianName?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    serviceType?: string;
    address?: string;
    price?: string;
    conflictReason?: string;
    suggestion?: string;
    confidence?: number;
  };
  requiresAction?: boolean; // For suggestions that need staff approval
}

interface AIActionBannerProps {
  action: AIAction;
  onApprove?: (actionId: string) => void;
  onDismiss?: (actionId: string) => void;
  onViewDetails?: (action: AIAction) => void;
}

const ACTION_CONFIG: Record<AIActionType, {
  icon: React.ElementType;
  bgColor: string;
  borderColor: string;
  iconBg: string;
  iconColor: string;
  textColor: string;
}> = {
  customer_created: {
    icon: UserPlus,
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    textColor: 'text-emerald-800',
  },
  job_created: {
    icon: CalendarPlus,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    textColor: 'text-blue-800',
  },
  technician_assigned: {
    icon: UserCheck,
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    textColor: 'text-indigo-800',
  },
  schedule_confirmed: {
    icon: CalendarCheck,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    textColor: 'text-green-800',
  },
  conflict_detected: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    textColor: 'text-amber-800',
  },
  suggestion: {
    icon: Lightbulb,
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    textColor: 'text-purple-800',
  },
  transfer_to_human: {
    icon: UserCheck,
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    textColor: 'text-orange-800',
  },
  availability_checked: {
    icon: Clock,
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
    textColor: 'text-cyan-800',
  },
  price_quoted: {
    icon: Wrench,
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    textColor: 'text-teal-800',
  },
};

export function AIActionBanner({
  action,
  onApprove,
  onDismiss,
  onViewDetails,
}: AIActionBannerProps) {
  const config = ACTION_CONFIG[action.type] || ACTION_CONFIG.suggestion;
  const Icon = config.icon;

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMetadata = () => {
    const { metadata } = action;
    if (!metadata) return null;

    const items: { icon: React.ElementType; label: string; value: string }[] = [];

    if (metadata.customerName) {
      items.push({ icon: UserPlus, label: 'Cliente', value: metadata.customerName });
    }
    if (metadata.jobNumber) {
      items.push({ icon: CalendarPlus, label: 'Trabajo', value: metadata.jobNumber });
    }
    if (metadata.technicianName) {
      items.push({ icon: UserCheck, label: 'Técnico', value: metadata.technicianName });
    }
    if (metadata.scheduledDate || metadata.scheduledTime) {
      const dateTime = [
        metadata.scheduledDate ? new Date(metadata.scheduledDate).toLocaleDateString('es-AR', { timeZone: 'America/Buenos_Aires' }) : '',
        metadata.scheduledTime,
      ].filter(Boolean).join(' - ');
      if (dateTime) {
        items.push({ icon: Clock, label: 'Horario', value: dateTime });
      }
    }
    if (metadata.serviceType) {
      items.push({ icon: Wrench, label: 'Servicio', value: metadata.serviceType });
    }
    if (metadata.address) {
      items.push({ icon: MapPin, label: 'Dirección', value: metadata.address });
    }
    if (metadata.price) {
      items.push({ icon: Wrench, label: 'Precio', value: metadata.price });
    }

    if (items.length === 0) return null;

    return (
      <div className="mt-2 space-y-1">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
            <item.icon className="h-3 w-3 text-gray-400" />
            <span className="font-medium">{item.label}:</span>
            <span>{item.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex justify-center my-3">
      <div
        className={`
          max-w-md w-full mx-4
          ${config.bgColor} ${config.borderColor}
          border rounded-lg p-3
          shadow-sm
        `}
      >
        {/* Header */}
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
              <span className="text-xs text-gray-500">{formatTime(action.timestamp)}</span>
              {action.metadata?.confidence && (
                <>
                  <span className="text-xs text-gray-400">•</span>
                  <span className={`text-xs ${action.metadata.confidence >= 80 ? 'text-green-600' : action.metadata.confidence >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {action.metadata.confidence}% confianza
                  </span>
                </>
              )}
            </div>

            <h4 className={`font-medium text-sm mt-1 ${config.textColor}`}>
              {action.title}
            </h4>

            {action.description && (
              <p className="text-xs text-gray-600 mt-1">{action.description}</p>
            )}

            {/* Conflict reason for conflicts */}
            {action.type === 'conflict_detected' && action.metadata?.conflictReason && (
              <p className="text-xs text-amber-700 mt-1 font-medium">
                {action.metadata.conflictReason}
              </p>
            )}

            {/* Suggestion text */}
            {action.type === 'suggestion' && action.metadata?.suggestion && (
              <div className="mt-2 p-2 bg-white/50 rounded text-xs text-purple-700 italic">
                &quot;{action.metadata.suggestion}&quot;
              </div>
            )}

            {renderMetadata()}
          </div>
        </div>

        {/* Action buttons for suggestions requiring approval */}
        {action.requiresAction && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200/50">
            {onApprove && (
              <button
                onClick={() => onApprove(action.id)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 transition-colors"
              >
                <CheckCircle className="h-3 w-3" />
                Aprobar
              </button>
            )}
            {onDismiss && (
              <button
                onClick={() => onDismiss(action.id)}
                className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded hover:bg-gray-200 transition-colors"
              >
                Ignorar
              </button>
            )}
          </div>
        )}

        {/* View details link */}
        {onViewDetails && !action.requiresAction && (
          <button
            onClick={() => onViewDetails(action)}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Ver detalles
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Grouped AI Actions Summary
 * Shows a compact summary when multiple actions happened together
 */
interface AIActionsSummaryProps {
  actions: AIAction[];
  onExpand?: () => void;
}

export function AIActionsSummary({ actions, onExpand }: AIActionsSummaryProps) {
  if (actions.length === 0) return null;

  if (actions.length === 1) {
    return <AIActionBanner action={actions[0]} />;
  }

  // Group by type
  const grouped = actions.reduce((acc, action) => {
    acc[action.type] = (acc[action.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex justify-center my-3">
      <div className="max-w-md w-full mx-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-medium text-indigo-800">
            IA realizó {actions.length} acciones
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(grouped).map(([type, count]) => {
            const config = ACTION_CONFIG[type as AIActionType];
            const Icon = config?.icon || Bot;
            return (
              <span
                key={type}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${config?.bgColor || 'bg-gray-100'} ${config?.textColor || 'text-gray-600'}`}
              >
                <Icon className="h-3 w-3" />
                {count}x {getActionLabel(type as AIActionType)}
              </span>
            );
          })}
        </div>

        {onExpand && (
          <button
            onClick={onExpand}
            className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 underline"
          >
            Ver todas las acciones
          </button>
        )}
      </div>
    </div>
  );
}

function getActionLabel(type: AIActionType): string {
  const labels: Record<AIActionType, string> = {
    customer_created: 'cliente creado',
    job_created: 'turno creado',
    technician_assigned: 'técnico asignado',
    schedule_confirmed: 'confirmado',
    conflict_detected: 'conflicto',
    suggestion: 'sugerencia',
    transfer_to_human: 'transferido',
    availability_checked: 'disponibilidad',
    price_quoted: 'precio',
  };
  return labels[type] || type;
}

export default AIActionBanner;
