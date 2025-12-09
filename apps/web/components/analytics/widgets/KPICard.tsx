'use client';

/**
 * KPI Card Widget
 * ===============
 *
 * Phase 10.4: Analytics Dashboard UI
 * Displays a single KPI metric with trend indicator.
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number | string;
  unit?: 'currency' | 'percentage' | 'number' | 'days' | 'hours' | 'minutes';
  trend?: 'up' | 'down' | 'stable';
  changePercent?: number;
  previousValue?: number;
  description?: string;
  icon?: React.ReactNode;
  color?: 'green' | 'blue' | 'amber' | 'red' | 'purple';
  size?: 'sm' | 'md' | 'lg';
}

export default function KPICard({
  title,
  value,
  unit = 'number',
  trend,
  changePercent,
  previousValue,
  description,
  icon,
  color = 'green',
  size = 'md',
}: KPICardProps) {
  const formattedValue = formatValue(value, unit);
  const formattedPrevious = previousValue !== undefined ? formatValue(previousValue, unit) : null;

  const colorClasses = {
    green: {
      bg: 'bg-green-50',
      icon: 'text-green-600 bg-green-100',
      accent: 'text-green-600',
    },
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600 bg-blue-100',
      accent: 'text-blue-600',
    },
    amber: {
      bg: 'bg-amber-50',
      icon: 'text-amber-600 bg-amber-100',
      accent: 'text-amber-600',
    },
    red: {
      bg: 'bg-red-50',
      icon: 'text-red-600 bg-red-100',
      accent: 'text-red-600',
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600 bg-purple-100',
      accent: 'text-purple-600',
    },
  };

  const sizeClasses = {
    sm: {
      card: 'p-3',
      title: 'text-xs',
      value: 'text-lg',
      change: 'text-xs',
    },
    md: {
      card: 'p-4',
      title: 'text-sm',
      value: 'text-2xl',
      change: 'text-xs',
    },
    lg: {
      card: 'p-6',
      title: 'text-base',
      value: 'text-3xl',
      change: 'text-sm',
    },
  };

  const colors = colorClasses[color];
  const sizes = sizeClasses[size];

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500';

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${sizes.card} shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={`${sizes.title} font-medium text-gray-600 truncate`}>{title}</p>
          <p className={`${sizes.value} font-bold text-gray-900 mt-1`}>{formattedValue}</p>

          {/* Trend indicator */}
          {(trend || changePercent !== undefined) && (
            <div className={`flex items-center gap-1 mt-2 ${sizes.change}`}>
              <TrendIcon size={14} className={trendColor} />
              {changePercent !== undefined && (
                <span className={trendColor}>
                  {changePercent > 0 ? '+' : ''}
                  {changePercent.toFixed(1)}%
                </span>
              )}
              {formattedPrevious && (
                <span className="text-gray-400 ml-1">vs {formattedPrevious}</span>
              )}
            </div>
          )}

          {/* Description */}
          {description && (
            <p className="text-xs text-gray-500 mt-2">{description}</p>
          )}
        </div>

        {/* Icon */}
        {icon && (
          <div className={`p-2 rounded-lg ${colors.icon} flex-shrink-0`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Format value based on unit type
 */
function formatValue(value: number | string, unit: KPICardProps['unit']): string {
  if (typeof value === 'string') return value;

  switch (unit) {
    case 'currency':
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);

    case 'percentage':
      return `${value.toFixed(1)}%`;

    case 'number':
      return new Intl.NumberFormat('es-AR').format(Math.round(value));

    case 'days':
      return `${Math.round(value)} días`;

    case 'hours':
      return `${value.toFixed(1)} hrs`;

    case 'minutes':
      return `${Math.round(value)} min`;

    default:
      return String(value);
  }
}

/**
 * KPI Grid Component
 */
interface KPIGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}

export function KPIGrid({ children, columns = 4 }: KPIGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid gap-4 ${gridCols[columns]}`}>
      {children}
    </div>
  );
}
