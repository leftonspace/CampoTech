'use client';

/**
 * Line Chart Component
 * ====================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Reusable line chart for trend visualization with multiple datasets.
 */

import { useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface Dataset {
  label: string;
  data: DataPoint[];
  color: string;
}

interface LineChartProps {
  datasets: Dataset[];
  height?: number;
  showLabels?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  formatValue?: (value: number) => string;
}

export default function LineChart({
  datasets,
  height = 200,
  showLabels = true,
  showGrid = true,
  showLegend = true,
  formatValue = (v) => v.toLocaleString('es-AR'),
}: LineChartProps) {
  const chartData = useMemo(() => {
    if (datasets.length === 0 || datasets[0].data.length === 0) return null;

    const allValues = datasets.flatMap((ds) => ds.data.map((d) => d.value));
    const maxValue = Math.max(...allValues, 1);
    const minValue = Math.min(...allValues, 0);
    const range = maxValue - minValue || 1;

    const padding = 40;
    const chartWidth = 100;
    const chartHeight = height - padding;

    const processedDatasets = datasets.map((ds) => ({
      ...ds,
      points: ds.data.map((d, i) => {
        const x = (i / (ds.data.length - 1 || 1)) * (chartWidth - 10) + 5;
        const y = chartHeight - ((d.value - minValue) / range) * chartHeight + padding / 2;
        return { x, y, ...d };
      }),
    }));

    return { processedDatasets, maxValue, minValue, labels: datasets[0].data.map((d) => d.label) };
  }, [datasets, height]);

  if (!chartData) {
    return (
      <div className="flex items-center justify-center text-gray-400" style={{ height }}>
        Sin datos
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height: height + (showLegend ? 40 : 0) }}>
      <svg width="100%" height={height} className="overflow-visible">
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

        {/* Lines */}
        {chartData.processedDatasets.map((ds, dsIndex) => {
          const linePath = ds.points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x}% ${p.y}`)
            .join(' ');

          return (
            <g key={dsIndex}>
              <path
                d={linePath}
                fill="none"
                stroke={ds.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Data points */}
              {ds.points.map((point, i) => (
                <circle
                  key={i}
                  cx={`${point.x}%`}
                  cy={point.y}
                  r="4"
                  fill="white"
                  stroke={ds.color}
                  strokeWidth="2"
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* X-axis Labels */}
      {showLabels && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-[5%] text-xs text-gray-500">
          {chartData.labels.map((label, i) => (
            <span key={i} className="truncate" style={{ maxWidth: `${100 / chartData.labels.length}%` }}>
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Y-axis labels */}
      <div className="absolute top-5 left-0 flex flex-col justify-between h-[calc(100%-40px)] text-xs text-gray-500">
        <span>{formatValue(chartData.maxValue)}</span>
        <span>{formatValue(chartData.minValue)}</span>
      </div>

      {/* Legend */}
      {showLegend && datasets.length > 1 && (
        <div className="flex items-center justify-center gap-4 mt-2">
          {datasets.map((ds, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ds.color }} />
              <span className="text-xs text-gray-600">{ds.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
