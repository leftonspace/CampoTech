'use client';

/**
 * Account Status Card Component
 * =============================
 *
 * Summary card showing combined subscription and verification status.
 * Can be used in sidebar or dashboard home.
 *
 * Features:
 * - Subscription status with trial days or renewal date
 * - Verification status with progress
 * - Quick links to each section
 * - Compact mode for sidebar
 */

import Link from 'next/link';
import {
  CreditCard,
  Shield,
  CheckCircle,
  AlertCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccessStatus, useSubscriptionStatus, useVerificationStatus } from '@/hooks/useAccessStatus';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AccountStatusCardProps {
  className?: string;
  /** Compact mode for sidebar */
  compact?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface StatusBadgeProps {
  status: 'good' | 'warning' | 'error' | 'pending';
  label: string;
  compact?: boolean;
}

function StatusBadge({ status, label, compact = false }: StatusBadgeProps) {
  const styles = {
    good: {
      bg: 'bg-success-100',
      text: 'text-success-700',
      icon: CheckCircle,
    },
    warning: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      icon: AlertTriangle,
    },
    error: {
      bg: 'bg-danger-100',
      text: 'text-danger-700',
      icon: AlertCircle,
    },
    pending: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      icon: Clock,
    },
  };

  const style = styles[status];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        style.bg,
        style.text,
        compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
    >
      <Icon className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      {label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION STATUS ROW
// ═══════════════════════════════════════════════════════════════════════════════

interface SubscriptionRowProps {
  compact?: boolean;
}

function SubscriptionRow({ compact = false }: SubscriptionRowProps) {
  const { subscription, isLoading, isTrialExpiring, trialDaysRemaining, isPaid } =
    useSubscriptionStatus();

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-32" />
      </div>
    );
  }

  // Determine status and label
  let status: StatusBadgeProps['status'] = 'good';
  let statusLabel = 'Activo';
  let details = '';

  if (!subscription) {
    status = 'pending';
    statusLabel = 'Sin plan';
    details = 'Elegí un plan';
  } else if (subscription.isTrialExpired) {
    status = 'error';
    statusLabel = 'Prueba vencida';
    details = 'Elegí un plan para continuar';
  } else if (isTrialExpiring) {
    status = 'warning';
    statusLabel = 'Prueba expirando';
    details = `${trialDaysRemaining} días restantes`;
  } else if (trialDaysRemaining !== null && trialDaysRemaining > 0) {
    status = 'pending';
    statusLabel = 'En prueba';
    details = `${trialDaysRemaining} días restantes`;
  } else if (isPaid) {
    status = 'good';
    statusLabel = subscription.tier || 'Activo';
    details = 'Próxima renovación: 15 ene';
  } else if (!subscription.isActive) {
    status = 'error';
    statusLabel = 'Inactivo';
    details = 'Reactiva tu suscripción';
  }

  return (
    <Link
      href="/dashboard/settings/billing"
      className={cn(
        'flex items-center justify-between group',
        compact ? 'p-3' : 'p-4'
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'rounded-lg bg-primary-100 text-primary-600',
          compact ? 'p-1.5' : 'p-2'
        )}>
          <CreditCard className={cn(compact ? 'h-4 w-4' : 'h-5 w-5')} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={cn('font-medium text-gray-900', compact && 'text-sm')}>
              Suscripción
            </span>
            <StatusBadge status={status} label={statusLabel} compact={compact} />
          </div>
          {details && !compact && (
            <p className="text-xs text-gray-500 mt-0.5">{details}</p>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION STATUS ROW
// ═══════════════════════════════════════════════════════════════════════════════

interface VerificationRowProps {
  compact?: boolean;
}

function VerificationRow({ compact = false }: VerificationRowProps) {
  const { verification, isLoading, isComplete, hasExpiredDocs, hasExpiringDocs, pendingCount } =
    useVerificationStatus();

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-32" />
      </div>
    );
  }

  // Determine status and label
  let status: StatusBadgeProps['status'] = 'good';
  let statusLabel = 'Verificado';
  let details = '';

  if (hasExpiredDocs) {
    status = 'error';
    statusLabel = 'Docs vencidos';
    details = 'Actualiza tu documentación';
  } else if (hasExpiringDocs) {
    status = 'warning';
    statusLabel = 'Docs por vencer';
    const expiring = verification?.expiringDocuments[0];
    if (expiring) {
      details = `${expiring.requirementName} vence en ${expiring.daysUntilExpiry}d`;
    }
  } else if (pendingCount > 0) {
    status = 'pending';
    statusLabel = 'Incompleto';
    details = `${pendingCount} ${pendingCount === 1 ? 'requisito pendiente' : 'requisitos pendientes'}`;
  } else if (isComplete) {
    status = 'good';
    statusLabel = 'Verificado';
    details = 'Visible en marketplace';
  } else {
    status = 'pending';
    statusLabel = 'Pendiente';
    details = 'Completá tu verificación';
  }

  return (
    <Link
      href="/dashboard/verificacion"
      className={cn(
        'flex items-center justify-between group',
        compact ? 'p-3' : 'p-4'
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'rounded-lg bg-purple-100 text-purple-600',
          compact ? 'p-1.5' : 'p-2'
        )}>
          <Shield className={cn(compact ? 'h-4 w-4' : 'h-5 w-5')} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={cn('font-medium text-gray-900', compact && 'text-sm')}>
              Verificación
            </span>
            <StatusBadge status={status} label={statusLabel} compact={compact} />
          </div>
          {details && !compact && (
            <p className="text-xs text-gray-500 mt-0.5">{details}</p>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPACT CARD (for sidebar)
// ═══════════════════════════════════════════════════════════════════════════════

function CompactCard({ className }: { className?: string }) {
  const { hasBlockingIssues, hasWarnings, accessStatus, isLoading } = useAccessStatus();

  if (isLoading) {
    return (
      <div className={cn('p-3 rounded-lg border border-gray-200 animate-pulse', className)}>
        <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-full" />
      </div>
    );
  }

  // Determine overall status
  let statusColor = 'bg-success-100 text-success-700';
  let statusLabel = 'Todo en orden';

  if (hasBlockingIssues) {
    statusColor = 'bg-danger-100 text-danger-700';
    statusLabel = 'Acción requerida';
  } else if (hasWarnings) {
    statusColor = 'bg-amber-100 text-amber-700';
    statusLabel = 'Atención';
  } else if (!accessStatus?.subscription?.isPaid) {
    statusColor = 'bg-blue-100 text-blue-700';
    statusLabel = 'En prueba';
  }

  return (
    <div className={cn('rounded-lg border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className={cn('px-3 py-2 text-xs font-medium', statusColor)}>
        {statusLabel}
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100">
        <SubscriptionRow compact />
        <VerificationRow compact />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AccountStatusCard({ className, compact = false }: AccountStatusCardProps) {
  const { hasBlockingIssues, hasWarnings, isLoading } = useAccessStatus();

  // Compact mode
  if (compact) {
    return <CompactCard className={className} />;
  }

  // Full mode
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Estado de la cuenta</h3>
        {!isLoading && (
          <div className="flex items-center gap-1">
            {hasBlockingIssues ? (
              <span className="flex items-center gap-1 text-xs text-danger-600">
                <AlertCircle className="h-3.5 w-3.5" />
                Acción requerida
              </span>
            ) : hasWarnings ? (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Atención
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-success-600">
                <CheckCircle className="h-3.5 w-3.5" />
                Todo en orden
              </span>
            )}
          </div>
        )}
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100">
        <SubscriptionRow />
        <VerificationRow />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
        <Link
          href="/dashboard/settings"
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          Ver todas las configuraciones
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { CompactCard as AccountStatusCardCompact };
export default AccountStatusCard;
