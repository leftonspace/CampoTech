'use client';

/**
 * Access Banner Component
 * =======================
 *
 * Displays banners for access restrictions based on subscription
 * and verification status. Shows warnings, soft blocks, and hard blocks
 * with appropriate actions.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  XCircle,
  AlertCircle,
  X,
  ArrowRight,
  FileCheck,
  CreditCard,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccessStatus, type BlockReason } from '@/hooks/useAccessStatus';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AccessBannerProps {
  /** Additional class names */
  className?: string;
  /** Whether hard blocks should redirect */
  redirectOnHardBlock?: boolean;
  /** Custom redirect URL for hard blocks */
  hardBlockRedirectUrl?: string;
  /** Whether to show all warnings or just the primary one */
  showAllWarnings?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DISMISS_STORAGE_KEY = 'access-warnings-dismissed';

const SEVERITY_STYLES = {
  warning: {
    container: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
    icon: AlertTriangle,
    iconClass: 'text-white/80',
    button: 'bg-white text-amber-600 hover:bg-gray-100',
    dismiss: 'text-white/60 hover:text-white hover:bg-white/10',
  },
  soft_block: {
    container: 'bg-gradient-to-r from-red-500 to-rose-600 text-white',
    icon: AlertCircle,
    iconClass: 'text-white/80',
    button: 'bg-white text-red-600 hover:bg-gray-100',
    dismiss: 'text-white/60 hover:text-white hover:bg-white/10',
  },
  hard_block: {
    container: 'bg-gradient-to-r from-gray-800 to-gray-900 text-white',
    icon: XCircle,
    iconClass: 'text-red-400',
    button: 'bg-red-500 text-white hover:bg-red-600',
    dismiss: 'hidden', // Can't dismiss hard blocks
  },
};

const TYPE_ICONS = {
  subscription: CreditCard,
  verification: FileCheck,
  compliance: Shield,
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AccessBanner({
  className,
  redirectOnHardBlock = true,
  hardBlockRedirectUrl = '/blocked',
  showAllWarnings = false,
}: AccessBannerProps) {
  const router = useRouter();
  const { accessStatus, isLoading, primaryBlockReason } = useAccessStatus();
  const [dismissedCodes, setDismissedCodes] = useState<Set<string>>(new Set());

  // Load dismissed codes from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setDismissedCodes(new Set(parsed.codes || []));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Redirect on hard block
  useEffect(() => {
    if (
      accessStatus?.isHardBlocked &&
      redirectOnHardBlock &&
      !isLoading
    ) {
      const hardBlock = accessStatus.blockReasons.find(
        (r) => r.severity === 'hard_block'
      );
      const redirectUrl = hardBlock?.actionUrl || hardBlockRedirectUrl;
      router.push(redirectUrl);
    }
  }, [accessStatus?.isHardBlocked, redirectOnHardBlock, hardBlockRedirectUrl, isLoading, router, accessStatus?.blockReasons]);

  // Handle dismiss
  const handleDismiss = (code: string) => {
    const newDismissed = new Set(dismissedCodes);
    newDismissed.add(code);
    setDismissedCodes(newDismissed);

    try {
      localStorage.setItem(
        DISMISS_STORAGE_KEY,
        JSON.stringify({
          codes: Array.from(newDismissed),
          timestamp: Date.now(),
        })
      );
    } catch {
      // Ignore storage errors
    }
  };

  // Don't render if loading or no issues
  if (isLoading || !accessStatus) {
    return null;
  }

  // Filter out dismissed warnings (but never dismiss blocks)
  const visibleReasons = accessStatus.blockReasons.filter((reason) => {
    if (reason.severity === 'warning') {
      return !dismissedCodes.has(reason.code);
    }
    return true; // Always show soft and hard blocks
  });

  if (visibleReasons.length === 0) {
    return null;
  }

  // Determine what to show
  const reasonsToShow = showAllWarnings
    ? visibleReasons
    : [primaryBlockReason || visibleReasons[0]].filter(Boolean);

  return (
    <div className={cn('space-y-2', className)}>
      {reasonsToShow.map((reason) => (
        <BannerItem
          key={reason.code}
          reason={reason}
          onDismiss={
            reason.severity === 'warning'
              ? () => handleDismiss(reason.code)
              : undefined
          }
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BANNER ITEM
// ═══════════════════════════════════════════════════════════════════════════════

interface BannerItemProps {
  reason: BlockReason;
  onDismiss?: () => void;
}

function BannerItem({ reason, onDismiss }: BannerItemProps) {
  const styles = SEVERITY_STYLES[reason.severity];
  const SeverityIcon = styles.icon;
  const TypeIcon = TYPE_ICONS[reason.type] || AlertCircle;

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 px-4 py-3 rounded-lg shadow-sm',
        styles.container
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0 flex items-center gap-2">
        <SeverityIcon className={cn('h-5 w-5', styles.iconClass)} />
        <TypeIcon className="h-4 w-4 opacity-60" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{reason.message}</p>
        {reason.actionRequired && (
          <p className="text-xs opacity-80 mt-0.5">{reason.actionRequired}</p>
        )}
      </div>

      {/* Action button */}
      {reason.actionUrl && (
        <Link
          href={reason.actionUrl}
          className={cn(
            'flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            styles.button
          )}
        >
          Resolver
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}

      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={cn(
            'flex-shrink-0 p-1.5 rounded-lg transition-colors',
            styles.dismiss
          )}
          aria-label="Descartar"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE WARNING BADGE
// ═══════════════════════════════════════════════════════════════════════════════

export interface AccessWarningBadgeProps {
  className?: string;
}

/**
 * Simple badge that shows when there are access issues
 */
export function AccessWarningBadge({ className }: AccessWarningBadgeProps) {
  const { accessStatus, isLoading, hasBlockingIssues, hasWarnings } = useAccessStatus();

  if (isLoading || !accessStatus) {
    return null;
  }

  if (!hasBlockingIssues && !hasWarnings) {
    return null;
  }

  const count = accessStatus.blockReasons.length;
  const isBlocked = hasBlockingIssues;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium',
        isBlocked
          ? 'bg-red-500 text-white'
          : 'bg-amber-500 text-white',
        className
      )}
    >
      {count}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default AccessBanner;
