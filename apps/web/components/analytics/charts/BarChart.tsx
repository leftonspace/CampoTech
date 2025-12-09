'use client';

/**
 * Bar Chart Component
 * ===================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Reusable bar chart for comparisons.
 */

import { useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  orientation?: 'vertical' | 'horizontal';
  showLabels?: boolean;
  showValues?: boolean;
  formatValue?: (value: number) => string;
}

export default function BarChart({
  data,
  height = 200,
  color = '#16a34a',
  orientation = 'vertical',
  showLabels = true,
  showValues = true,
  formatValue = (v) => v.toLocaleString('es-AR'),
}: BarChartProps) {
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const values = data.map((d) => d.value);
    const maxValue = Math.max(...values, 1);

    return data.map((d) => ({
      ...d,
      percentage: (d.value / maxValue) * 100,
    }));
  }, [data]);

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

  if (orientation === 'horizontal') {
    return (
      <div className="space-y-3" style={{ minHeight: height }}>
        {chartData.map((item, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700 truncate">{item.label}</span>
              {showValues && (
                <span className="text-gray-500 font-medium ml-2">
                  {formatValue(item.value)}
                </span>
              )}
            </div>
            <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.color || color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Vertical orientation
  const barWidth = Math.min(60, (100 / data.length) - 10);

  return (
    <div className="relative w-full" style={{ height }}>
      {/* Chart area */}
      <div className="absolute inset-0 bottom-6 flex items-end justify-around px-4">
        {chartData.map((item, i) => (
          <div
            key={i}
            className="flex flex-col items-center"
            style={{ width: `${barWidth}%` }}
          >
            {/* Value label */}
            {showValues && (
              <span className="text-xs text-gray-500 mb-1">
                {formatValue(item.value)}
              </span>
            )}

            {/* Bar */}
            <div
              className="w-full rounded-t-md transition-all duration-500 ease-out"
              style={{
                height: `${item.percentage}%`,
                backgroundColor: item.color || color,
                minHeight: item.value > 0 ? '4px' : '0',
              }}
            />
          </div>
        ))}
      </div>

      {/* X-axis labels */}
      {showLabels && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-around px-4 text-xs text-gray-500">
          {data.map((d, i) => (
            <span
              key={i}
              className="truncate text-center"
              style={{ width: `${barWidth}%` }}
            >
              {d.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
