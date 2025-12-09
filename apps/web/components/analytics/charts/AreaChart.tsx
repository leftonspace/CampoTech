'use client';

/**
 * Area Chart Component
 * ====================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Reusable area chart for trend visualization.
 */

import { useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface AreaChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  gradientFrom?: string;
  gradientTo?: string;
  showLabels?: boolean;
  showGrid?: boolean;
  formatValue?: (value: number) => string;
}

export default function AreaChart({
  data,
  height = 200,
  color = '#16a34a',
  gradientFrom = 'rgba(22, 163, 74, 0.3)',
  gradientTo = 'rgba(22, 163, 74, 0.0)',
  showLabels = true,
  showGrid = true,
  formatValue = (v) => v.toLocaleString('es-AR'),
}: AreaChartProps) {
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const values = data.map((d) => d.value);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;

    const padding = 40;
    const chartWidth = 100; // Percentage
    const chartHeight = height - padding;

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * (chartWidth - 10) + 5;
      const y = chartHeight - ((d.value - minValue) / range) * chartHeight + padding / 2;
      return { x, y, ...d };
    });

    // Create SVG path for area
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x}% ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x}% ${height} L ${points[0].x}% ${height} Z`;

    return { points, linePath, areaPath, maxValue, minValue };
  }, [data, height]);

  if (!chartData) {
    return (
      <div
        className="flex items-center justify-center text-gray-400"
        style={{ height }}
      >
        Sin datos
      </div>
    );
  }

  const gradientId = useMemo(() => `gradient-${Math.random().toString(36).substr(2, 9)}`, []);

  return (
    <div className="relative w-full" style={{ height }}>
      <svg width="100%" height={height} className="overflow-visible">
        {/* Gradient definition */}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientFrom} />
            <stop offset="100%" stopColor={gradientTo} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {showGrid && (
          <g className="text-gray-200">
            {[0, 25, 50, 75, 100].map((percent) => (
              <line
                key={percent}
                x1="5%"
                y1={`${20 + (percent / 100) * (height - 40)}px`}
                x2="95%"
                y2={`${20 + (percent / 100) * (height - 40)}px`}
                stroke="currentColor"
                strokeDasharray="4 4"
              />
            ))}
          </g>
        )}

        {/* Area fill */}
        <path d={chartData.areaPath} fill={`url(#${gradientId})`} />

        {/* Line */}
        <path
          d={chartData.linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {chartData.points.map((point, i) => (
          <g key={i}>
            <circle
              cx={`${point.x}%`}
              cy={point.y}
              r="4"
              fill="white"
              stroke={color}
              strokeWidth="2"
            />
          </g>
        ))}
      </svg>

      {/* Labels */}
      {showLabels && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-[5%] text-xs text-gray-500">
          {data.map((d, i) => (
            <span
              key={i}
              className="truncate"
              style={{ maxWidth: `${100 / data.length}%` }}
            >
              {d.label}
            </span>
          ))}
        </div>
      )}

      {/* Y-axis labels */}
      <div className="absolute top-5 left-0 flex flex-col justify-between h-[calc(100%-40px)] text-xs text-gray-500">
        <span>{formatValue(chartData.maxValue)}</span>
        <span>{formatValue(chartData.minValue)}</span>
      </div>
    </div>
  );
}
