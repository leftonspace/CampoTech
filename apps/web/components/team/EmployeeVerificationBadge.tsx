'use client';

/**
 * Employee Verification Badge Component
 * ======================================
 *
 * Displays verification status badge for employees in team list.
 * Shows appropriate status and warning indicators.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type VerificationStatus = 'not_started' | 'pending' | 'in_review' | 'verified' | 'suspended';

export interface EmployeeVerificationBadgeProps {
  employeeId: string;
  employeeName: string;
  status: VerificationStatus;
  canBeAssignedJobs: boolean;
  pendingDocuments?: number;
  expiringDocuments?: number;
  lastReminderSentAt?: Date | string;
  onSendReminder?: (employeeId: string) => Promise<void>;
  showDetails?: boolean;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  verified: {
    label: 'Verificado',
    icon: CheckCircle,
    color: 'bg-success-100 text-success-700 border-success-200',
    iconColor: 'text-success-600',
  },
  in_review: {
    label: 'En revisión',
    icon: Clock,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    iconColor: 'text-blue-600',
  },
  pending: {
    label: 'Pendiente',
    icon: Clock,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    iconColor: 'text-amber-600',
  },
  not_started: {
    label: 'Sin verificar',
    icon: AlertCircle,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    iconColor: 'text-gray-500',
  },
  suspended: {
    label: 'Suspendido',
    icon: XCircle,
    color: 'bg-danger-100 text-danger-700 border-danger-200',
    iconColor: 'text-danger-600',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function EmployeeVerificationBadge({
  employeeId,
  employeeName,
  status,
  canBeAssignedJobs,
  pendingDocuments = 0,
  expiringDocuments = 0,
  lastReminderSentAt,
  onSendReminder,
  showDetails = false,
  className,
}: EmployeeVerificationBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const handleSendReminder = async () => {
    if (!onSendReminder || isSending) return;

    setIsSending(true);
    setReminderError(null);

    try {
      await onSendReminder(employeeId);
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : 'Error al enviar');
    } finally {
      setIsSending(false);
    }
  };

  // Check if reminder was sent recently
  const canSendReminder = () => {
    if (!lastReminderSentAt) return true;
    const lastSent = new Date(lastReminderSentAt);
    const hoursSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
    return hoursSince >= 24;
  };

  const reminderAllowed = canSendReminder();

  // Simple badge view
  if (!showDetails) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
          config.color,
          className
        )}
      >
        <Icon className={cn('h-3.5 w-3.5', config.iconColor)} />
        {config.label}
      </span>
    );
  }

  // Detailed view with actions
  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between p-3 text-left',
          config.color.split(' ')[0] // Just the bg color
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', config.iconColor)} />
          <span className="font-medium text-sm">{config.label}</span>
          {!canBeAssignedJobs && status !== 'verified' && (
            <span className="text-xs text-danger-600 font-medium">
              No puede recibir trabajos
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-3 space-y-3 bg-white">
          {/* Pending items */}
          {pendingDocuments > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <Clock className="h-4 w-4" />
              <span>{pendingDocuments} documento(s) pendiente(s)</span>
            </div>
          )}

          {/* Expiring items */}
          {expiringDocuments > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              <span>{expiringDocuments} documento(s) por vencer</span>
            </div>
          )}

          {/* Warning for unverified */}
          {!canBeAssignedJobs && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-2">
              <p className="text-xs text-danger-700">
                {employeeName} no puede recibir trabajos hasta completar su verificación.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            {/* Send reminder button */}
            {status !== 'verified' && onSendReminder && (
              <button
                onClick={handleSendReminder}
                disabled={isSending || !reminderAllowed}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  reminderAllowed
                    ? 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
                title={
                  !reminderAllowed
                    ? 'Ya se envió un recordatorio en las últimas 24h'
                    : 'Enviar recordatorio de verificación'
                }
              >
                {isSending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {isSending ? 'Enviando...' : 'Enviar recordatorio'}
              </button>
            )}

            {/* View details link */}
            <Link
              href={`/dashboard/verificacion?employee=${employeeId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              Ver detalles
            </Link>
          </div>

          {/* Error message */}
          {reminderError && (
            <p className="text-xs text-danger-600">{reminderError}</p>
          )}

          {/* Last reminder info */}
          {lastReminderSentAt && (
            <p className="text-xs text-gray-500">
              Último recordatorio: {new Date(lastReminderSentAt).toLocaleDateString('es-AR', { timeZone: 'America/Buenos_Aires' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE BADGE (for table rows)
// ═══════════════════════════════════════════════════════════════════════════════

export function EmployeeVerificationInlineBadge({
  status,
  canBeAssignedJobs,
  className,
}: {
  status: VerificationStatus;
  canBeAssignedJobs: boolean;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
          config.color
        )}
      >
        <Icon className={cn('h-3 w-3', config.iconColor)} />
        {config.label}
      </span>
      {!canBeAssignedJobs && status !== 'verified' && (
        <span className="text-[10px] text-danger-600 flex items-center gap-0.5">
          <AlertTriangle className="h-2.5 w-2.5" />
          Sin asignar trabajos
        </span>
      )}
    </div>
  );
}

export default EmployeeVerificationBadge;
