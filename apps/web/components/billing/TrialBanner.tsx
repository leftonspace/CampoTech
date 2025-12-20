/**
 * Trial Banner Component
 * ======================
 *
 * Displays a banner when the organization is on a trial subscription.
 * Shows days remaining and becomes more urgent as trial approaches end.
 * Links to billing page for upgrade.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, X, ArrowUpRight, Sparkles, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrialBannerProps {
  /** Days remaining in trial */
  daysRemaining: number;
  /** Trial end date for display */
  trialEndsAt?: string | Date;
  /** Whether the banner can be dismissed */
  dismissible?: boolean;
  /** Callback when dismissed (receives days remaining to allow conditional storage) */
  onDismiss?: (daysRemaining: number) => void;
  /** Additional class names */
  className?: string;
}

export interface TrialStatusResponse {
  isTrialing: boolean;
  daysRemaining: number;
  trialEndsAt: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DISMISS_STORAGE_KEY = 'trial-banner-dismissed-at';
const URGENT_DAYS_THRESHOLD = 3;
const WARNING_DAYS_THRESHOLD = 7;

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const VARIANT_STYLES = {
  normal: {
    container: 'bg-gradient-to-r from-primary-600 to-purple-600 text-white',
    icon: 'text-white/80',
    button: 'bg-white text-primary-600 hover:bg-gray-100',
    dismiss: 'text-white/60 hover:text-white hover:bg-white/10',
  },
  warning: {
    container: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
    icon: 'text-white/80',
    button: 'bg-white text-amber-600 hover:bg-gray-100',
    dismiss: 'text-white/60 hover:text-white hover:bg-white/10',
  },
  urgent: {
    container: 'bg-gradient-to-r from-red-500 to-rose-600 text-white',
    icon: 'text-white/80',
    button: 'bg-white text-red-600 hover:bg-gray-100',
    dismiss: 'text-white/60 hover:text-white hover:bg-white/10',
  },
  expired: {
    container: 'bg-gradient-to-r from-gray-700 to-gray-800 text-white',
    icon: 'text-white/80',
    button: 'bg-white text-gray-700 hover:bg-gray-100',
    dismiss: 'text-white/60 hover:text-white hover:bg-white/10',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getVariant(daysRemaining: number): keyof typeof VARIANT_STYLES {
  if (daysRemaining <= 0) return 'expired';
  if (daysRemaining <= URGENT_DAYS_THRESHOLD) return 'urgent';
  if (daysRemaining <= WARNING_DAYS_THRESHOLD) return 'warning';
  return 'normal';
}

function getMessage(daysRemaining: number): string {
  if (daysRemaining <= 0) {
    return 'Tu periodo de prueba ha terminado. Actualiza tu plan para seguir usando todas las funciones.';
  }
  if (daysRemaining === 1) {
    return 'Tu periodo de prueba termina mañana. Actualiza ahora para no perder acceso.';
  }
  if (daysRemaining <= URGENT_DAYS_THRESHOLD) {
    return `Tu periodo de prueba termina en ${daysRemaining} días. ¡Actualiza ahora!`;
  }
  if (daysRemaining <= WARNING_DAYS_THRESHOLD) {
    return `Quedan ${daysRemaining} días de tu periodo de prueba. Explora todas las funciones.`;
  }
  return `Estás en periodo de prueba. Quedan ${daysRemaining} días para explorar todas las funciones.`;
}

function getButtonText(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'Elegir plan';
  if (daysRemaining <= URGENT_DAYS_THRESHOLD) return 'Actualizar ahora';
  return 'Ver planes';
}

function getIcon(daysRemaining: number) {
  if (daysRemaining <= 0) return AlertTriangle;
  if (daysRemaining <= URGENT_DAYS_THRESHOLD) return AlertTriangle;
  if (daysRemaining <= WARNING_DAYS_THRESHOLD) return Clock;
  return Sparkles;
}

function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIAL BANNER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function TrialBanner({
  daysRemaining,
  trialEndsAt,
  dismissible = true,
  onDismiss,
  className,
}: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Check if banner was recently dismissed (only for non-urgent trials)
  useEffect(() => {
    if (daysRemaining > URGENT_DAYS_THRESHOLD) {
      const dismissedAt = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (dismissedAt) {
        const dismissedTime = new Date(dismissedAt).getTime();
        const now = Date.now();
        // Allow dismissal for 24 hours
        if (now - dismissedTime < 24 * 60 * 60 * 1000) {
          setDismissed(true);
        } else {
          localStorage.removeItem(DISMISS_STORAGE_KEY);
        }
      }
    }
  }, [daysRemaining]);

  if (dismissed) return null;

  const variant = getVariant(daysRemaining);
  const styles = VARIANT_STYLES[variant];
  const message = getMessage(daysRemaining);
  const buttonText = getButtonText(daysRemaining);
  const IconComponent = getIcon(daysRemaining);

  // Don't allow dismissing if urgent or expired
  const canDismiss = dismissible && daysRemaining > URGENT_DAYS_THRESHOLD;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_STORAGE_KEY, new Date().toISOString());
    onDismiss?.(daysRemaining);
  };

  return (
    <div
      role="alert"
      className={cn(
        'px-4 py-3 flex items-center justify-between gap-4',
        styles.container,
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <IconComponent className={cn('h-5 w-5 shrink-0', styles.icon)} />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate sm:whitespace-normal">
            {message}
          </p>
          {trialEndsAt && daysRemaining > 0 && daysRemaining <= WARNING_DAYS_THRESHOLD && (
            <p className="text-xs opacity-80 mt-0.5 hidden sm:block">
              Termina el {formatDate(trialEndsAt)}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/dashboard/settings/billing"
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            styles.button
          )}
        >
          {buttonText}
          <ArrowUpRight className="h-4 w-4" />
        </Link>

        {canDismiss && (
          <button
            onClick={handleDismiss}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              styles.dismiss
            )}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIAL BANNER WITH FETCH
// ═══════════════════════════════════════════════════════════════════════════════

interface TrialBannerWithFetchProps {
  /** Fallback if API fails */
  fallbackDaysRemaining?: number;
  className?: string;
}

/**
 * TrialBanner that fetches trial status from API
 * Use this when you don't have trial info from context
 */
export function TrialBannerWithFetch({
  fallbackDaysRemaining,
  className,
}: TrialBannerWithFetchProps) {
  const [trialStatus, setTrialStatus] = useState<TrialStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchTrialStatus() {
      try {
        const response = await fetch('/api/subscription/trial-status');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.isTrialing) {
            setTrialStatus(data.data);
          }
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchTrialStatus();
  }, []);

  // Don't render while loading or if there's an error and no fallback
  if (loading) return null;
  if (error && fallbackDaysRemaining === undefined) return null;
  if (!trialStatus && fallbackDaysRemaining === undefined) return null;

  const daysRemaining = trialStatus?.daysRemaining ?? fallbackDaysRemaining ?? 0;
  const trialEndsAt = trialStatus?.trialEndsAt ?? undefined;

  // Don't show if not trialing (daysRemaining would be 0 or negative in expired case)
  if (!trialStatus && !fallbackDaysRemaining) return null;

  return (
    <TrialBanner
      daysRemaining={daysRemaining}
      trialEndsAt={trialEndsAt}
      className={className}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPACT TRIAL INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

interface TrialIndicatorProps {
  daysRemaining: number;
  className?: string;
}

/**
 * Compact trial indicator for use in headers, sidebars, etc.
 */
export function TrialIndicator({ daysRemaining, className }: TrialIndicatorProps) {
  const variant = getVariant(daysRemaining);

  const colorClasses = {
    normal: 'bg-primary-100 text-primary-700 border-primary-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    urgent: 'bg-red-100 text-red-700 border-red-200 animate-pulse',
    expired: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  const label = daysRemaining <= 0
    ? 'Prueba finalizada'
    : daysRemaining === 1
    ? '1 día restante'
    : `${daysRemaining} días restantes`;

  return (
    <Link
      href="/dashboard/settings/billing"
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border hover:opacity-80 transition-opacity',
        colorClasses[variant],
        className
      )}
    >
      <Clock className="h-3 w-3" />
      {label}
    </Link>
  );
}

export default TrialBanner;
