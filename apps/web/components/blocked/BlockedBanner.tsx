'use client';

/**
 * Blocked Banner Component
 * ========================
 *
 * Displays a warning banner for soft-blocked users.
 * Shows in the dashboard with warning style (orange/yellow).
 * Lists issues and how to resolve them.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  X,
  ArrowRight,
  CreditCard,
  FileCheck,
  Shield,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccessStatus, type BlockReason } from '@/hooks/useAccessStatus';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BlockedBannerProps {
  /** Additional class names */
  className?: string;
  /** Whether to allow dismissing (temporarily hides until refresh) */
  allowDismiss?: boolean;
  /** Callback when user clicks to resolve */
  onResolveClick?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const TYPE_ICONS = {
  subscription: CreditCard,
  verification: FileCheck,
  compliance: Shield
};

const TYPE_LABELS = {
  subscription: 'Suscripción',
  verification: 'Verificación',
  compliance: 'Cumplimiento'
};

const DISMISS_KEY = 'blocked-banner-dismissed';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function BlockedBanner({
  className,
  allowDismiss = true,
  onResolveClick }: BlockedBannerProps) {
  const { accessStatus, isLoading, isSoftBlocked } = useAccessStatus();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if banner was dismissed in this session
  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        setIsDismissed(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Handle dismiss
  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
  };

  // Don't show if loading, dismissed, or no soft blocks
  if (isLoading || !accessStatus || isDismissed) {
    return null;
  }

  // Only show for soft blocks (not hard blocks - those redirect)
  if (!isSoftBlocked || accessStatus.isHardBlocked) {
    return null;
  }

  // Get soft block reasons only
  const softBlockReasons = accessStatus.blockReasons.filter(
    (r) => r.severity === 'soft_block'
  );

  if (softBlockReasons.length === 0) {
    return null;
  }

  // Group by type
  const groupedReasons = softBlockReasons.reduce(
    (acc, reason) => {
      if (!acc[reason.type]) acc[reason.type] = [];
      acc[reason.type].push(reason);
      return acc;
    },
    {} as Record<string, BlockReason[]>
  );

  const primaryReason = softBlockReasons[0];
  const hasMultiple = softBlockReasons.length > 1;

  return (
    <div
      className={cn(
        'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Main Banner */}
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-white/80" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">
                Acceso Restringido
              </p>
              <span className="text-xs text-white/80">
                {hasMultiple
                  ? `${softBlockReasons.length} problemas por resolver`
                  : primaryReason.message}
              </span>
            </div>
            {!hasMultiple && primaryReason.actionRequired && (
              <p className="text-xs text-white/70 mt-0.5">
                {primaryReason.actionRequired}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Expand button for multiple issues */}
            {hasMultiple && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}

            {/* Resolve button */}
            <Link
              href="/blocked"
              onClick={onResolveClick}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-amber-600 hover:bg-gray-100 transition-colors"
            >
              Ver Detalles
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            {/* Dismiss button */}
            {allowDismiss && (
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Descartar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && hasMultiple && (
          <div className="mt-3 pt-3 border-t border-white/20 space-y-2">
            {Object.entries(groupedReasons).map(([type, reasons]) => {
              const Icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS] || AlertTriangle;
              const label = TYPE_LABELS[type as keyof typeof TYPE_LABELS] || type;

              return (
                <div key={type} className="flex items-start gap-2">
                  <Icon className="h-4 w-4 text-white/60 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/80">{label}</p>
                    <ul className="mt-0.5 space-y-0.5">
                      {reasons.map((reason, index) => (
                        <li key={index} className="text-xs text-white/70">
                          • {reason.message}
                          {reason.actionUrl && (
                            <Link
                              href={reason.actionUrl}
                              className="ml-1 text-white underline hover:no-underline"
                            >
                              Resolver
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPACT BLOCKED INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

export interface BlockedIndicatorProps {
  className?: string;
}

/**
 * Small indicator showing blocked status (for header/sidebar)
 */
export function BlockedIndicator({ className }: BlockedIndicatorProps) {
  const { isSoftBlocked, isLoading, accessStatus } = useAccessStatus();

  if (isLoading || !accessStatus || accessStatus.isHardBlocked) {
    return null;
  }

  if (!isSoftBlocked) {
    return null;
  }

  const count = accessStatus.blockReasons.filter(
    (r) => r.severity === 'soft_block'
  ).length;

  return (
    <Link
      href="/blocked"
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        'bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors',
        className
      )}
    >
      <AlertTriangle className="h-3 w-3" />
      <span>{count} {count === 1 ? 'problema' : 'problemas'}</span>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default BlockedBanner;
