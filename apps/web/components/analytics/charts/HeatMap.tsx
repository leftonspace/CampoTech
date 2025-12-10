'use client';

/**
 * HeatMap Chart Component
 * =======================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Displays data intensity across two dimensions (time/category).
 */

import { useMemo } from 'react';

interface HeatMapCell {
  x: string;
  y: string;
  value: number;
}

interface HeatMapProps {
  data: HeatMapCell[];
  xLabels: string[];
  yLabels: string[];
  height?: number;
  colorScale?: 'green' | 'blue' | 'red' | 'purple';
  showValues?: boolean;
  formatValue?: (value: number) => string;
  title?: string;
}

const COLOR_SCALES = {
  green: ['#dcfce7', '#86efac', '#22c55e', '#16a34a', '#15803d'],
  blue: ['#dbeafe', '#93c5fd', '#3b82f6', '#2563eb', '#1d4ed8'],
  red: ['#fee2e2', '#fca5a5', '#ef4444', '#dc2626', '#b91c1c'],
  purple: ['#f3e8ff', '#d8b4fe', '#a855f7', '#9333ea', '#7c3aed'],
};

export default function HeatMap({
  data,
  xLabels,
  yLabels,
  height = 300,
  colorScale = 'green',
  showValues = false,
  formatValue = (v) => v.toLocaleString('es-AR'),
  title,
}: HeatMapProps) {
  const processedData = useMemo(() => {
    if (data.length === 0) return null;

    const values = data.map((d) => d.value);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;

    const matrix: { [key: string]: { [key: string]: number } } = {};
    for (const cell of data) {
      if (!matrix[cell.y]) matrix[cell.y] = {};
      matrix[cell.y][cell.x] = cell.value;
    }

    return { matrix, maxValue, minValue, range };
  }, [data]);

  if (!processedData) {
    return (
      <div className="flex items-center justify-center text-gray-400" style={{ height }}>
        Sin datos
      </div>
    );
  }

  const colors = COLOR_SCALES[colorScale];
  const cellHeight = Math.floor((height - 60) / yLabels.length);
  const cellWidth = 100 / xLabels.length;

  const getColor = (value: number): string => {
    const normalized = (value - processedData.minValue) / processedData.range;
    const index = Math.min(Math.floor(normalized * colors.length), colors.length - 1);
    return colors[index];
  };

  return (
    <div className="w-full">
      {title && <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>}

      <div className="relative" style={{ height }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 w-16 flex flex-col" style={{ height: height - 30 }}>
          {yLabels.map((label, i) => (
            <div
              key={i}
              className="flex items-center justify-end pr-2 text-xs text-gray-500"
              style={{ height: cellHeight }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Heat map grid */}
        <div className="ml-16" style={{ height: height - 30 }}>
          {yLabels.map((yLabel, yi) => (
            <div key={yi} className="flex" style={{ height: cellHeight }}>
              {xLabels.map((xLabel, xi) => {
                const value = processedData.matrix[yLabel]?.[xLabel] ?? 0;
                const bgColor = getColor(value);

                return (
                  <div
                    key={xi}
                    className="relative border border-white/50 flex items-center justify-center transition-all hover:scale-105 hover:z-10"
                    style={{
                      width: `${cellWidth}%`,
                      backgroundColor: bgColor,
                    }}
                    title={`${yLabel} - ${xLabel}: ${formatValue(value)}`}
                  >
                    {showValues && (
                      <span className="text-[10px] font-medium text-gray-800">
                        {formatValue(value)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* X-axis labels */}
        <div className="ml-16 flex mt-1">
          {xLabels.map((label, i) => (
            <div
              key={i}
              className="text-xs text-gray-500 text-center truncate"
              style={{ width: `${cellWidth}%` }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <span className="text-xs text-gray-500">Bajo</span>
        <div className="flex h-3">
          {colors.map((color, i) => (
            <div key={i} className="w-6 h-full" style={{ backgroundColor: color }} />
          ))}
        </div>
        <span className="text-xs text-gray-500">Alto</span>
      </div>
    </div>
  );
}

// Pre-built time-based heatmap component
interface TimeHeatMapProps {
  data: { day: number; hour: number; value: number }[];
  colorScale?: 'green' | 'blue' | 'red' | 'purple';
  formatValue?: (value: number) => string;
}

export function TimeHeatMap({ data, colorScale = 'green', formatValue }: TimeHeatMapProps) {
  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  const heatMapData = data.map((d) => ({
    x: hourLabels[d.hour],
    y: dayLabels[d.day],
    value: d.value,
  }));

  return (
    <HeatMap
      data={heatMapData}
      xLabels={hourLabels.filter((_, i) => i % 3 === 0)} // Show every 3 hours
      yLabels={dayLabels}
      colorScale={colorScale}
      formatValue={formatValue}
      height={220}
      title="Actividad por Hora y Día"
    />
  );
}
