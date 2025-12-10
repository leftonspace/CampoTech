'use client';

/**
 * Trend Indicator Widget
 * ======================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Displays trend direction with percentage change.
 */

import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from 'lucide-react';

interface TrendIndicatorProps {
  value: number;
  trend: 'up' | 'down' | 'stable';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showArrow?: boolean;
  invertColors?: boolean; // For metrics where down is good (e.g., response time)
  suffix?: string;
}

export default function TrendIndicator({
  value,
  trend,
  size = 'md',
  showIcon = true,
  showArrow = false,
  invertColors = false,
  suffix = '%',
}: TrendIndicatorProps) {
  const sizeClasses = {
    sm: { text: 'text-xs', icon: 12, gap: 'gap-0.5' },
    md: { text: 'text-sm', icon: 14, gap: 'gap-1' },
    lg: { text: 'text-base', icon: 18, gap: 'gap-1.5' },
  };

  const isPositive = invertColors ? trend === 'down' : trend === 'up';
  const isNegative = invertColors ? trend === 'up' : trend === 'down';

  const colorClass = isPositive
    ? 'text-green-600 bg-green-50'
    : isNegative
    ? 'text-red-600 bg-red-50'
    : 'text-gray-500 bg-gray-50';

  const Icon = showArrow
    ? trend === 'up'
      ? ArrowUp
      : trend === 'down'
      ? ArrowDown
      : Minus
    : trend === 'up'
    ? TrendingUp
    : trend === 'down'
    ? TrendingDown
    : Minus;

  const s = sizeClasses[size];

  return (
    <span className={`inline-flex items-center ${s.gap} px-1.5 py-0.5 rounded-full ${colorClass} ${s.text} font-medium`}>
      {showIcon && <Icon size={s.icon} />}
      <span>
        {value > 0 && trend !== 'stable' ? '+' : ''}
        {value.toFixed(1)}
        {suffix}
      </span>
    </span>
  );
}

// Trend badge variant
interface TrendBadgeProps {
  trend: 'up' | 'down' | 'stable';
  label?: string;
  size?: 'sm' | 'md';
}

export function TrendBadge({ trend, label, size = 'md' }: TrendBadgeProps) {
  const config = {
    up: { color: 'bg-green-100 text-green-700', label: label || 'Subiendo' },
    down: { color: 'bg-red-100 text-red-700', label: label || 'Bajando' },
    stable: { color: 'bg-gray-100 text-gray-700', label: label || 'Estable' },
  };

  const { color, label: defaultLabel } = config[trend];
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${color} ${sizeClass}`}>
      {label || defaultLabel}
    </span>
  );
}
