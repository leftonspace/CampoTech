'use client';

/**
 * Pie Chart Component
 * ===================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Reusable pie/donut chart for distributions.
 */

import { useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: DataPoint[];
  size?: number;
  donut?: boolean;
  donutWidth?: number;
  showLegend?: boolean;
  showPercentages?: boolean;
  formatValue?: (value: number) => string;
}

const COLORS = [
  '#16a34a', // Green
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
];

export default function PieChart({
  data,
  size = 200,
  donut = true,
  donutWidth = 40,
  showLegend = true,
  showPercentages = true,
  formatValue = (v) => v.toLocaleString('es-AR'),
}: PieChartProps) {
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return null;

    let cumulativeAngle = -90; // Start from top
    const segments = data.map((d, i) => {
      const percentage = (d.value / total) * 100;
      const angle = (d.value / total) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle += angle;

      return {
        ...d,
        percentage,
        startAngle,
        endAngle,
        color: d.color || COLORS[i % COLORS.length],
      };
    });

    return { segments, total };
  }, [data]);

  if (!chartData) {
    return (
      <div
        className="flex items-center justify-center text-gray-400"
        style={{ width: size, height: size }}
      >
        Sin datos
      </div>
    );
  }

  const radius = size / 2;
  const innerRadius = donut ? radius - donutWidth : 0;

  return (
    <div className="flex items-center gap-6">
      {/* Pie chart */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {chartData.segments.map((segment, i) => (
            <path
              key={i}
              d={describeArc(radius, radius, radius - 2, innerRadius, segment.startAngle, segment.endAngle)}
              fill={segment.color}
              className="transition-opacity hover:opacity-80"
            />
          ))}
        </svg>

        {/* Center label for donut */}
        {donut && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">
              {formatValue(chartData.total)}
            </span>
            <span className="text-xs text-gray-500">Total</span>
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="space-y-2 flex-1 min-w-0">
          {chartData.segments.map((segment, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-sm text-gray-700 truncate flex-1">
                {segment.label}
              </span>
              <span className="text-sm text-gray-500 whitespace-nowrap">
                {showPercentages
                  ? `${segment.percentage.toFixed(1)}%`
                  : formatValue(segment.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Create SVG arc path
 */
function describeArc(
  x: number,
  y: number,
  radius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  // Handle full circle case
  if (endAngle - startAngle >= 359.99) {
    endAngle = startAngle + 359.99;
  }

  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const x1 = x + radius * Math.cos(startRad);
  const y1 = y + radius * Math.sin(startRad);
  const x2 = x + radius * Math.cos(endRad);
  const y2 = y + radius * Math.sin(endRad);

  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  if (innerRadius === 0) {
    // Pie slice
    return `M ${x} ${y} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  }

  // Donut segment
  const x3 = x + innerRadius * Math.cos(endRad);
  const y3 = y + innerRadius * Math.sin(endRad);
  const x4 = x + innerRadius * Math.cos(startRad);
  const y4 = y + innerRadius * Math.sin(startRad);

  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
}
