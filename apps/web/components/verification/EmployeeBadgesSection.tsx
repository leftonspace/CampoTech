'use client';

/**
 * Employee Badges Section Component
 * ==================================
 *
 * Displays optional verification badges available to employees.
 * Shows earned badges and available badges to obtain.
 *
 * Available badges:
 * - Antecedentes penales (background check)
 * - Professional certifications
 */

import {
  Award,
  Shield,
  FileCheck,
  CheckCircle,
  ArrowRight,
  Star,
  AlertCircle,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmployeeBadge {
  code: string;
  name: string;
  description: string;
  benefit: string;
  icon: string | null;
  isEarned: boolean;
  earnedAt?: string;
  expiresAt?: string | null;
  isValid?: boolean;
  isExpiringSoon?: boolean;
  daysUntilExpiry?: number | null;
}

export interface EmployeeBadgesSectionProps {
  badges: EmployeeBadge[];
  onObtain: (badgeCode: string) => void;
  onRenew: (badgeCode: string) => void;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  award: Award,
  filecheck: FileCheck,
  star: Star,
  check: CheckCircle,
  sparkles: Sparkles,
};

function getBadgeIcon(iconName: string | null): React.ComponentType<{ className?: string }> {
  if (!iconName) return Award;
  const icon = ICON_MAP[iconName.toLowerCase()];
  return icon || Award;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BADGE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface BadgeCardProps {
  badge: EmployeeBadge;
  onObtain: (code: string) => void;
  onRenew: (code: string) => void;
}

function BadgeCard({ badge, onObtain, onRenew }: BadgeCardProps) {
  const Icon = getBadgeIcon(badge.icon);
  const isExpiring = badge.isExpiringSoon && badge.isEarned;
  const isExpired = badge.isEarned && !badge.isValid;

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
        'relative bg-white border rounded-xl p-4 transition-all',
        badge.isEarned && badge.isValid
          ? 'border-success-200 bg-success-50/30'
          : badge.isEarned && !badge.isValid
          ? 'border-danger-200 bg-danger-50/30'
          : 'border-gray-200 hover:border-primary-200 hover:shadow-sm'
      )}
    >
      {/* Earned badge indicator */}
      {badge.isEarned && badge.isValid && !isExpiring && (
        <div className="absolute -top-2 -right-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success-500 text-white shadow-sm">
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
            : 'bg-primary-50 text-primary-600'
        )}
      >
        <Icon className="h-6 w-6" />
      </div>

      {/* Content */}
      <h4
        className={cn(
          'font-semibold text-sm mb-1',
          badge.isEarned && badge.isValid
            ? 'text-success-900'
            : badge.isEarned && !badge.isValid
            ? 'text-danger-900'
            : 'text-gray-900'
        )}
      >
        {badge.name}
      </h4>

      <p className="text-xs text-gray-500 mb-3">{badge.description}</p>

      {/* Benefit */}
      {!badge.isEarned && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mb-3">
          <p className="text-xs text-amber-700 flex items-start gap-1">
            <Sparkles className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>{badge.benefit}</span>
          </p>
        </div>
      )}

      {/* Status */}
      <div className="mb-3">
        {badge.isEarned && badge.isValid && !isExpiring && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-700">
            <CheckCircle className="h-3.5 w-3.5" />
            Obtenido
          </span>
        )}

        {badge.isEarned && badge.isValid && isExpiring && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <AlertCircle className="h-3.5 w-3.5" />
            Vence en {badge.daysUntilExpiry} días
          </span>
        )}

        {badge.isEarned && !badge.isValid && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger-700">
            <AlertCircle className="h-3.5 w-3.5" />
            Vencido
          </span>
        )}
      </div>

      {/* Expiry date */}
      {badge.expiresAt && badge.isEarned && (
        <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {badge.isValid ? 'Vence:' : 'Venció:'} {formatDate(badge.expiresAt)}
        </p>
      )}

      {/* Action button */}
      {!badge.isEarned && (
        <button
          onClick={() => onObtain(badge.code)}
          className="w-full py-2 px-3 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors flex items-center justify-center gap-1"
        >
          Obtener badge
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
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function EmployeeBadgesSection({
  badges,
  onObtain,
  onRenew,
  className,
}: EmployeeBadgesSectionProps) {
  const earnedBadges = badges.filter((b) => b.isEarned);
  const availableBadges = badges.filter((b) => !b.isEarned);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary-100">
          <Award className="h-5 w-5 text-primary-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Badges Opcionales</h3>
          <p className="text-sm text-gray-500">
            Obtené badges para destacar tu perfil y acceder a más trabajos
          </p>
        </div>
      </div>

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

      {/* Earned badges */}
      {earnedBadges.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Tus Badges</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Available badges */}
      {availableBadges.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Badges Disponibles
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
    </div>
  );
}

export default EmployeeBadgesSection;
