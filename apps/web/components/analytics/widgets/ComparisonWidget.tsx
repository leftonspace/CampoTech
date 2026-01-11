'use client';

/**
 * Comparison Widget
 * =================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Displays comparison between two periods or values.
 */

import { ArrowRight } from 'lucide-react';
import TrendIndicator from './TrendIndicator';

interface ComparisonWidgetProps {
  title: string;
  currentValue: number;
  previousValue: number;
  currentLabel?: string;
  previousLabel?: string;
  unit?: 'currency' | 'percentage' | 'number';
  invertColors?: boolean;
}

export default function ComparisonWidget({
  title,
  currentValue,
  previousValue,
  currentLabel = 'Actual',
  previousLabel = 'Anterior',
  unit = 'number',
  invertColors = false,
}: ComparisonWidgetProps) {
  const change = previousValue !== 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
  const trend: 'up' | 'down' | 'stable' =
    change > 1 ? 'up' : change < -1 ? 'down' : 'stable';

  const formatValue = (value: number): string => {
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
      default:
        return new Intl.NumberFormat('es-AR').format(Math.round(value));
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <h4 className="text-sm font-medium text-gray-600 mb-3">{title}</h4>

      <div className="flex items-center justify-between gap-4">
        {/* Previous value */}
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1">{previousLabel}</p>
          <p className="text-lg font-semibold text-gray-700">{formatValue(previousValue)}</p>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0">
          <ArrowRight size={20} className="text-gray-400" />
        </div>

        {/* Current value */}
        <div className="flex-1 text-right">
          <p className="text-xs text-gray-500 mb-1">{currentLabel}</p>
          <p className="text-lg font-bold text-gray-900">{formatValue(currentValue)}</p>
        </div>
      </div>

      {/* Change indicator */}
      <div className="flex items-center justify-center mt-3 pt-3 border-t border-gray-100">
        <TrendIndicator value={change} trend={trend} invertColors={invertColors} />
      </div>
    </div>
  );
}

// Multiple period comparison
interface MultiPeriodComparisonProps {
  title: string;
  periods: {
    label: string;
    value: number;
  }[];
  unit?: 'currency' | 'percentage' | 'number';
}

export function MultiPeriodComparison({
  title,
  periods,
  unit = 'number',
}: MultiPeriodComparisonProps) {
  if (periods.length === 0) return null;

  const maxValue = Math.max(...periods.map((p) => p.value), 1);

  const formatValue = (value: number): string => {
    switch (unit) {
      case 'currency':
        return new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
          notation: 'compact',
        }).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return new Intl.NumberFormat('es-AR', { notation: 'compact' }).format(value);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <h4 className="text-sm font-medium text-gray-600 mb-4">{title}</h4>

      <div className="space-y-3">
        {periods.map((period, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{period.label}</span>
              <span className="font-medium text-gray-900">{formatValue(period.value)}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${(period.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
