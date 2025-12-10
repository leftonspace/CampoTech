'use client';

/**
 * LeaderBoard Widget
 * ==================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Displays ranked list of items with metrics.
 */

import { Trophy, Medal, Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface LeaderBoardItem {
  id: string;
  name: string;
  value: number;
  secondaryValue?: number;
  avatar?: string;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
}

interface LeaderBoardProps {
  title: string;
  items: LeaderBoardItem[];
  valueLabel?: string;
  secondaryValueLabel?: string;
  unit?: 'currency' | 'percentage' | 'number';
  showRank?: boolean;
  showTrend?: boolean;
  maxItems?: number;
  emptyMessage?: string;
}

export default function LeaderBoard({
  title,
  items,
  valueLabel = 'Valor',
  secondaryValueLabel,
  unit = 'number',
  showRank = true,
  showTrend = true,
  maxItems = 5,
  emptyMessage = 'No hay datos disponibles',
}: LeaderBoardProps) {
  const displayItems = items.slice(0, maxItems);

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

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy size={16} className="text-yellow-500" />;
      case 2:
        return <Medal size={16} className="text-gray-400" />;
      case 3:
        return <Award size={16} className="text-amber-600" />;
      default:
        return <span className="text-xs font-medium text-gray-500 w-4 text-center">{rank}</span>;
    }
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    if (!trend) return null;
    switch (trend) {
      case 'up':
        return <TrendingUp size={14} className="text-green-500" />;
      case 'down':
        return <TrendingDown size={14} className="text-red-500" />;
      default:
        return <Minus size={14} className="text-gray-400" />;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-gray-900">{title}</h4>
        <span className="text-xs text-gray-500">{valueLabel}</span>
      </div>

      {displayItems.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">{emptyMessage}</div>
      ) : (
        <div className="space-y-3">
          {displayItems.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {/* Rank */}
              {showRank && (
                <div className="flex-shrink-0 w-6 flex items-center justify-center">
                  {getRankIcon(index + 1)}
                </div>
              )}

              {/* Avatar */}
              {item.avatar ? (
                <img
                  src={item.avatar}
                  alt={item.name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-medium">
                    {item.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}

              {/* Name & Secondary value */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                {item.secondaryValue !== undefined && secondaryValueLabel && (
                  <p className="text-xs text-gray-500">
                    {secondaryValueLabel}: {formatValue(item.secondaryValue)}
                  </p>
                )}
              </div>

              {/* Trend */}
              {showTrend && item.trend && (
                <div className="flex-shrink-0">{getTrendIcon(item.trend)}</div>
              )}

              {/* Value */}
              <div className="flex-shrink-0 text-right">
                <span className="text-sm font-semibold text-gray-900">
                  {formatValue(item.value)}
                </span>
                {item.change !== undefined && (
                  <p
                    className={`text-xs ${
                      item.change > 0
                        ? 'text-green-600'
                        : item.change < 0
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {item.change > 0 ? '+' : ''}
                    {item.change.toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > maxItems && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-center">
          <button className="text-sm text-green-600 hover:text-green-700 font-medium">
            Ver todos ({items.length})
          </button>
        </div>
      )}
    </div>
  );
}

// Compact leaderboard variant
interface CompactLeaderBoardProps {
  items: { name: string; value: number }[];
  unit?: 'currency' | 'percentage' | 'number';
  showBars?: boolean;
}

export function CompactLeaderBoard({ items, unit = 'number', showBars = true }: CompactLeaderBoardProps) {
  const maxValue = Math.max(...items.map((i) => i.value), 1);

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
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 truncate">{item.name}</span>
            <span className="font-medium text-gray-900">{formatValue(item.value)}</span>
          </div>
          {showBars && (
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
