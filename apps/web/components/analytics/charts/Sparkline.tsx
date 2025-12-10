'use client';

/**
 * Sparkline Component
 * ===================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Mini inline chart for compact trend visualization.
 */

import { useMemo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  showFill?: boolean;
  showDot?: boolean;
  strokeWidth?: number;
}

export default function Sparkline({
  data,
  width = 80,
  height = 24,
  color = '#16a34a',
  fillColor,
  showFill = true,
  showDot = true,
  strokeWidth = 1.5,
}: SparklineProps) {
  const path = useMemo(() => {
    if (data.length < 2) return null;

    const maxValue = Math.max(...data, 1);
    const minValue = Math.min(...data, 0);
    const range = maxValue - minValue || 1;

    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = data.map((value, i) => {
      const x = padding + (i / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
      return { x, y, value };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;

    return { points, linePath, areaPath };
  }, [data, width, height]);

  if (!path) {
    return <div style={{ width, height }} className="bg-gray-100 rounded" />;
  }

  const gradientId = `sparkline-${Math.random().toString(36).substr(2, 9)}`;
  const lastPoint = path.points[path.points.length - 1];

  return (
    <svg width={width} height={height} className="inline-block align-middle">
      {showFill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor || color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={fillColor || color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={path.areaPath} fill={`url(#${gradientId})`} />
        </>
      )}
      <path
        d={path.linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && (
        <circle cx={lastPoint.x} cy={lastPoint.y} r="2" fill={color} />
      )}
    </svg>
  );
}

// Sparkline with value display
interface SparklineWithValueProps extends SparklineProps {
  value: number | string;
  label?: string;
  trend?: 'up' | 'down' | 'stable';
  formatValue?: (value: number) => string;
}

export function SparklineWithValue({
  data,
  value,
  label,
  trend,
  formatValue = (v) => v.toLocaleString('es-AR'),
  ...sparklineProps
}: SparklineWithValueProps) {
  const displayValue = typeof value === 'number' ? formatValue(value) : value;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500';

  return (
    <div className="flex items-center gap-2">
      <div>
        <div className="text-lg font-semibold text-gray-900">{displayValue}</div>
        {label && <div className="text-xs text-gray-500">{label}</div>}
      </div>
      <Sparkline
        data={data}
        color={trend === 'up' ? '#16a34a' : trend === 'down' ? '#ef4444' : '#6b7280'}
        {...sparklineProps}
      />
    </div>
  );
}
