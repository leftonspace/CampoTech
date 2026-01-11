'use client';

/**
 * Badges Grid Component
 * =====================
 *
 * Displays optional verification badges in a grid layout.
 * Shows earned badges and available badges to obtain.
 */

import {
  Award,
  Shield,
  Star,
  Leaf,
  Truck,
  Clock,
  CheckCircle,
  Calendar,
  ArrowRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface Badge {
  code: string;
  name: string;
  description?: string;
  icon: string | null;
  label: string | null;
  earnedAt?: string;
  expiresAt?: string | null;
  isValid?: boolean;
  isEarned: boolean;
  isExpiringSoon?: boolean;
  daysUntilExpiry?: number | null;
}

export interface BadgesGridProps {
  badges: Badge[];
  onObtain: (badgeCode: string) => void;
  onRenew: (badgeCode: string) => void;
  className?: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ICON MAPPING
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  award: Award,
  shield: Shield,
  star: Star,
  leaf: Leaf,
  truck: Truck,
  clock: Clock,
  sparkles: Sparkles,
  check: CheckCircle,
};

function getBadgeIcon(iconName: string | null): React.ComponentType<{ className?: string }> {
  if (!iconName) return Award;
  const icon = ICON_MAP[iconName.toLowerCase()];
  return icon || Award;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// BADGE CARD COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface BadgeCardProps {
  badge: Badge;
  onObtain: (code: string) => void;
  onRenew: (code: string) => void;
}

function BadgeCard({ badge, onObtain, onRenew }: BadgeCardProps) {
  const Icon = getBadgeIcon(badge.icon);
  const isExpiring = badge.isExpiringSoon && badge.isEarned;
  const _isExpired = badge.isEarned && !badge.isValid;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div
      className={cn(
        'relative p-4 rounded-xl border transition-all',
        badge.isEarned && badge.isValid
          ? 'border-success-200 bg-success-50/50'
          : badge.isEarned && !badge.isValid
          ? 'border-danger-200 bg-danger-50/50'
          : 'border-gray-200 bg-white hover:border-primary-200 hover:shadow-sm'
      )}
    >
      {/* Status indicator */}
      {badge.isEarned && badge.isValid && (
        <div className="absolute -top-2 -right-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success-500 text-white">
            <CheckCircle className="h-4 w-4" />
          </span>
        </div>
      )}

      {/* Icon */}
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center mb-3',
          badge.isEarned && badge.isValid
            ? 'bg-success-100 text-success-600'
            : badge.isEarned && !badge.isValid
            ? 'bg-danger-100 text-danger-600'
            : 'bg-gray-100 text-gray-400'
        )}
      >
        <Icon className="h-6 w-6" />
      </div>

      {/* Content */}
      <h4
        className={cn(
          'font-semibold text-sm',
          badge.isEarned && badge.isValid
            ? 'text-success-900'
            : badge.isEarned && !badge.isValid
            ? 'text-danger-900'
            : 'text-gray-900'
        )}
      >
        {badge.name}
      </h4>

      {badge.description && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{badge.description}</p>
      )}

      {/* Status */}
      <div className="mt-3">
        {badge.isEarned && badge.isValid && !isExpiring && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success-700">
            <CheckCircle className="h-3.5 w-3.5" />
            Obtenido
          </span>
        )}

        {badge.isEarned && badge.isValid && isExpiring && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
            <AlertCircle className="h-3.5 w-3.5" />
            Vence en {badge.daysUntilExpiry}d
          </span>
        )}

        {badge.isEarned && !badge.isValid && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-danger-700">
            <AlertCircle className="h-3.5 w-3.5" />
            Vencido
          </span>
        )}

        {!badge.isEarned && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            No obtenido
          </span>
        )}
      </div>

      {/* Expiry date */}
      {badge.expiresAt && badge.isEarned && (
        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {badge.isValid ? 'Vence:' : 'Venció:'} {formatDate(badge.expiresAt)}
        </p>
      )}

      {/* Action button */}
      <div className="mt-4">
        {!badge.isEarned && (
          <button
            onClick={() => onObtain(badge.code)}
            className="w-full py-2 px-3 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            Obtener
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}

        {badge.isEarned && (isExpiring || !badge.isValid) && (
          <button
            onClick={() => onRenew(badge.code)}
            className={cn(
              'w-full py-2 px-3 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1',
              badge.isValid
                ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                : 'text-danger-600 bg-danger-50 hover:bg-danger-100'
            )}
          >
            Renovar
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function BadgesGrid({ badges, onObtain, onRenew, className }: BadgesGridProps) {
  // Separate earned and not earned badges
  const earnedBadges = badges.filter((b) => b.isEarned);
  const availableBadges = badges.filter((b) => !b.isEarned);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2 text-success-600">
          <Award className="h-5 w-5" />
          <span className="font-medium">{earnedBadges.length} obtenidos</span>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          <span>{availableBadges.length} disponibles</span>
        </div>
      </div>

      {/* Earned badges section */}
      {earnedBadges.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Tus Badges</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {earnedBadges.map((badge) => (
              <BadgeCard
                key={badge.code}
                badge={badge}
                onObtain={onObtain}
                onRenew={onRenew}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available badges section */}
      {availableBadges.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Badges Disponibles</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {availableBadges.map((badge) => (
              <BadgeCard
                key={badge.code}
                badge={badge}
                onObtain={onObtain}
                onRenew={onRenew}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {badges.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Award className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No hay badges disponibles.</p>
        </div>
      )}
    </div>
  );
}

export default BadgesGrid;
