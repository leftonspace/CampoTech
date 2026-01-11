'use client';

/**
 * Dashboard Alerts Component
 * ==========================
 *
 * Displays combined subscription and verification alerts at the top of the dashboard.
 * Alerts are sorted by priority (critical first) and can be dismissed where appropriate.
 *
 * Alert types:
 * - Subscription: trial expiring, payment failed, subscription cancelled
 * - Verification: docs expiring, docs expired, rejected, pending review
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  AlertCircle,
  XCircle,
  Clock,
  CreditCard,
  FileText,
  X,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccessStatus, type BlockReason } from '@/hooks/useAccessStatus';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DashboardAlert {
  id: string;
  type: 'subscription' | 'verification';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  actionLabel: string;
  actionUrl: string;
  icon: React.ComponentType<{ className?: string }>;
  dismissible: boolean;
  /** If set, the alert can be snoozed for this many hours */
  snoozeHours?: number;
}

export interface DashboardAlertsProps {
  className?: string;
  maxAlerts?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DISMISSED_ALERTS_KEY = 'dashboard-dismissed-alerts';
const SNOOZED_ALERTS_KEY = 'dashboard-snoozed-alerts';

const SEVERITY_STYLES = {
  critical: {
    container: 'bg-danger-50 border-danger-200',
    icon: 'text-danger-600',
    title: 'text-danger-900',
    description: 'text-danger-700',
    button: 'bg-danger-600 hover:bg-danger-700 text-white',
  },
  warning: {
    container: 'bg-amber-50 border-amber-200',
    icon: 'text-amber-600',
    title: 'text-amber-900',
    description: 'text-amber-700',
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  info: {
    container: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-600',
    title: 'text-blue-900',
    description: 'text-blue-700',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getDismissedAlerts(): Set<string> {
  try {
    const data = localStorage.getItem(DISMISSED_ALERTS_KEY);
    return data ? new Set(JSON.parse(data)) : new Set();
  } catch {
    return new Set();
  }
}

function dismissAlert(alertId: string): void {
  try {
    const dismissed = getDismissedAlerts();
    dismissed.add(alertId);
    localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify([...dismissed]));
  } catch {
    // Ignore storage errors
  }
}

interface SnoozedAlert {
  id: string;
  until: number; // timestamp
}

function getSnoozedAlerts(): Map<string, number> {
  try {
    const data = localStorage.getItem(SNOOZED_ALERTS_KEY);
    if (!data) return new Map();
    const parsed: SnoozedAlert[] = JSON.parse(data);
    const now = Date.now();
    // Filter out expired snoozes
    return new Map(parsed.filter((s) => s.until > now).map((s) => [s.id, s.until]));
  } catch {
    return new Map();
  }
}

function snoozeAlert(alertId: string, hours: number): void {
  try {
    const snoozed = getSnoozedAlerts();
    snoozed.set(alertId, Date.now() + hours * 60 * 60 * 1000);
    const data: SnoozedAlert[] = [...snoozed].map(([id, until]) => ({ id, until }));
    localStorage.setItem(SNOOZED_ALERTS_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

function convertBlockReasonToAlert(reason: BlockReason): DashboardAlert {
  const baseAlert: Partial<DashboardAlert> = {
    id: reason.code,
    type: reason.type as 'subscription' | 'verification',
    actionUrl: reason.actionUrl || '/dashboard/settings/billing',
  };

  // Map specific reason codes to alert details
  switch (reason.code) {
    case 'TRIAL_EXPIRING':
      return {
        ...baseAlert,
        id: 'trial_expiring',
        severity: 'warning',
        title: 'Tu período de prueba está por terminar',
        description: reason.message || 'Elegí un plan para seguir usando CampoTech.',
        actionLabel: 'Elegir plan',
        actionUrl: '/dashboard/settings/billing',
        icon: Clock,
        dismissible: true,
        snoozeHours: 24,
      } as DashboardAlert;

    case 'TRIAL_EXPIRED':
      return {
        ...baseAlert,
        id: 'trial_expired',
        severity: 'critical',
        title: 'Tu período de prueba terminó',
        description: reason.message || 'Elegí un plan para recuperar el acceso completo.',
        actionLabel: 'Elegir plan',
        actionUrl: '/dashboard/settings/billing',
        icon: AlertCircle,
        dismissible: false,
      } as DashboardAlert;

    case 'PAYMENT_FAILED':
    case 'PAYMENT_PAST_DUE':
      return {
        ...baseAlert,
        id: 'payment_failed',
        severity: 'critical',
        title: 'Problema con tu pago',
        description: reason.message || 'Actualizá tu método de pago para evitar interrupciones.',
        actionLabel: 'Actualizar pago',
        actionUrl: '/dashboard/settings/billing',
        icon: CreditCard,
        dismissible: false,
      } as DashboardAlert;

    case 'SUBSCRIPTION_CANCELLED':
      return {
        ...baseAlert,
        id: 'subscription_cancelled',
        severity: 'warning',
        title: 'Tu suscripción está cancelada',
        description: reason.message || 'Reactivá tu suscripción para seguir usando todas las funciones.',
        actionLabel: 'Reactivar',
        actionUrl: '/dashboard/settings/billing',
        icon: XCircle,
        dismissible: false,
      } as DashboardAlert;

    case 'DOCUMENT_EXPIRED':
      return {
        ...baseAlert,
        id: `doc_expired_${reason.code}`,
        severity: 'critical',
        title: 'Documento vencido',
        description: reason.message || 'Actualizá tu documentación para seguir operando.',
        actionLabel: 'Actualizar',
        actionUrl: '/dashboard/verificacion',
        icon: FileText,
        dismissible: false,
      } as DashboardAlert;

    case 'DOCUMENT_EXPIRING':
      return {
        ...baseAlert,
        id: `doc_expiring_${reason.code}`,
        severity: 'warning',
        title: 'Documento por vencer',
        description: reason.message || 'Renovalo antes de que expire.',
        actionLabel: 'Renovar',
        actionUrl: '/dashboard/verificacion',
        icon: Clock,
        dismissible: true,
        snoozeHours: 24,
      } as DashboardAlert;

    case 'DOCUMENT_REJECTED':
    case 'VERIFICATION_REJECTED':
      return {
        ...baseAlert,
        id: `doc_rejected_${reason.code}`,
        severity: 'critical',
        title: 'Documento rechazado',
        description: reason.message || 'Subí un nuevo documento para continuar.',
        actionLabel: 'Ver detalles',
        actionUrl: '/dashboard/verificacion',
        icon: XCircle,
        dismissible: false,
      } as DashboardAlert;

    case 'VERIFICATION_PENDING':
    case 'DOCUMENT_PENDING':
      return {
        ...baseAlert,
        id: `verification_pending`,
        severity: 'info',
        title: 'Verificación en proceso',
        description: reason.message || 'Tu documentación está siendo revisada.',
        actionLabel: 'Ver estado',
        actionUrl: '/dashboard/verificacion',
        icon: RefreshCw,
        dismissible: true,
        snoozeHours: 24,
      } as DashboardAlert;

    default:
      return {
        ...baseAlert,
        id: reason.code,
        severity: reason.severity === 'hard_block' ? 'critical' : reason.severity === 'soft_block' ? 'warning' : 'info',
        title: reason.message || 'Acción requerida',
        description: reason.actionRequired || 'Hay un problema que requiere tu atención.',
        actionLabel: 'Ver detalles',
        actionUrl: reason.actionUrl || '/dashboard/settings',
        icon: AlertTriangle,
        dismissible: reason.severity === 'warning',
      } as DashboardAlert;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface AlertItemProps {
  alert: DashboardAlert;
  onDismiss: (id: string) => void;
  onSnooze: (id: string, hours: number) => void;
}

function AlertItem({ alert, onDismiss, onSnooze }: AlertItemProps) {
  const styles = SEVERITY_STYLES[alert.severity];
  const Icon = alert.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-4 p-4 rounded-lg border',
        styles.container
      )}
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0 mt-0.5', styles.icon)}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className={cn('font-semibold text-sm', styles.title)}>
          {alert.title}
        </h4>
        <p className={cn('text-sm mt-0.5', styles.description)}>
          {alert.description}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={alert.actionUrl}
          className={cn(
            'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
            styles.button
          )}
        >
          {alert.actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>

        {alert.dismissible && (
          <>
            {alert.snoozeHours && (
              <button
                onClick={() => onSnooze(alert.id, alert.snoozeHours!)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/50 transition-colors"
                title={`Recordar en ${alert.snoozeHours}h`}
              >
                <Clock className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onDismiss(alert.id)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/50 transition-colors"
              title="Descartar"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function DashboardAlerts({ className, maxAlerts = 3 }: DashboardAlertsProps) {
  const { accessStatus, isLoading } = useAccessStatus();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [snoozedUntil, setSnoozedUntil] = useState<Map<string, number>>(new Map());
  const [forceUpdate, setForceUpdate] = useState(0);

  // Load dismissed and snoozed alerts on mount
  useEffect(() => {
    setDismissedIds(getDismissedAlerts());
    setSnoozedUntil(getSnoozedAlerts());
  }, []);

  // Convert block reasons to alerts
  const alerts = useMemo<DashboardAlert[]>(() => {
    if (!accessStatus?.blockReasons) return [];

    const now = Date.now();
    const allAlerts: DashboardAlert[] = [];

    for (const reason of accessStatus.blockReasons) {
      const alert = convertBlockReasonToAlert(reason);

      // Skip dismissed alerts
      if (dismissedIds.has(alert.id)) continue;

      // Skip snoozed alerts
      const snoozedTime = snoozedUntil.get(alert.id);
      if (snoozedTime && snoozedTime > now) continue;

      allAlerts.push(alert);
    }

    // Sort by severity (critical first)
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    allAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return allAlerts.slice(0, maxAlerts);
  }, [accessStatus, dismissedIds, snoozedUntil, maxAlerts, forceUpdate]);

  const handleDismiss = (alertId: string) => {
    dismissAlert(alertId);
    setDismissedIds((prev) => new Set([...prev, alertId]));
  };

  const handleSnooze = (alertId: string, hours: number) => {
    snoozeAlert(alertId, hours);
    setSnoozedUntil((prev) => {
      const next = new Map(prev);
      next.set(alertId, Date.now() + hours * 60 * 60 * 1000);
      return next;
    });
  };

  // Don't render if loading or no alerts
  if (isLoading || alerts.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {alerts.map((alert) => (
        <AlertItem
          key={alert.id}
          alert={alert}
          onDismiss={handleDismiss}
          onSnooze={handleSnooze}
        />
      ))}
    </div>
  );
}

export default DashboardAlerts;
