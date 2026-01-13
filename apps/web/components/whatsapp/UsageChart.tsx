'use client';

import { useMemo } from 'react';

interface UsageHistoryItem {
  date: Date | string;
  messagesSent: number;
  messagesReceived: number;
  conversationsOpened: number;
  aiResponses: number;
}

interface UsageChartProps {
  data: UsageHistoryItem[];
  height?: number;
}

export function UsageChart({ data, height = 200 }: UsageChartProps) {
  const { chartData, maxValue, dateRange } = useMemo(() => {
    // Ensure dates are Date objects and sort
    const sorted = [...data]
      .map((d) => ({
        ...d,
        date: typeof d.date === 'string' ? new Date(d.date) : d.date,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Find max value for scaling
    const max = Math.max(
      ...sorted.map((d) => d.messagesSent + d.messagesReceived),
      10 // Minimum scale
    );

    // Get date range for labels
    const firstDate = sorted[0]?.date;
    const lastDate = sorted[sorted.length - 1]?.date;

    return {
      chartData: sorted,
      maxValue: max,
      dateRange: { start: firstDate, end: lastDate },
    };
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 rounded-lg text-gray-500"
        style={{ height }}
      >
        No hay datos disponibles
      </div>
    );
  }

  const barWidth = 100 / chartData.length;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Buenos_Aires' });
  };

  return (
    <div className="space-y-2">
      {/* Chart */}
      <div
        className="relative bg-gray-50 rounded-lg overflow-hidden"
        style={{ height }}
      >
        {/* Y-axis grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 25, 50, 75, 100].map((percent) => (
            <div
              key={percent}
              className="border-t border-gray-200"
              style={{ opacity: percent === 0 ? 0 : 0.5 }}
            />
          ))}
        </div>

        {/* Bars */}
        <div className="absolute inset-0 flex items-end">
          {chartData.map((item, index) => {
            const total = item.messagesSent + item.messagesReceived;
            const sentHeight = (item.messagesSent / maxValue) * 100;
            const receivedHeight = (item.messagesReceived / maxValue) * 100;

            return (
              <div
                key={index}
                className="relative group"
                style={{ width: `${barWidth}%`, height: '100%' }}
              >
                {/* Stacked bar */}
                <div className="absolute bottom-0 left-1 right-1 flex flex-col">
                  {/* Received (bottom) */}
                  <div
                    className="bg-blue-400 rounded-t-sm transition-all duration-300"
                    style={{ height: `${receivedHeight}%` }}
                  />
                  {/* Sent (top) */}
                  <div
                    className="bg-green-500 rounded-t-sm transition-all duration-300 order-first"
                    style={{ height: `${sentHeight}%` }}
                  />
                </div>

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    <div className="font-medium">
                      {formatDate(item.date)}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      Enviados: {item.messagesSent}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-blue-400 rounded-full" />
                      Recibidos: {item.messagesReceived}
                    </div>
                    <div className="text-gray-400">Total: {total}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Y-axis labels */}
        <div className="absolute left-0 inset-y-0 flex flex-col justify-between text-xs text-gray-400 pr-1">
          <span>{maxValue}</span>
          <span>{Math.round(maxValue / 2)}</span>
          <span>0</span>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-gray-500 px-1">
        {dateRange.start && <span>{formatDate(dateRange.start)}</span>}
        <span className="text-gray-400">Últimos {chartData.length} días</span>
        {dateRange.end && <span>{formatDate(dateRange.end)}</span>}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-green-500 rounded-sm" />
          <span className="text-gray-600">Enviados</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-400 rounded-sm" />
          <span className="text-gray-600">Recibidos</span>
        </div>
      </div>
    </div>
  );
}

interface UsageProgressProps {
  used: number;
  limit: number;
  showLabel?: boolean;
}

export function UsageProgress({ used, limit, showLabel = true }: UsageProgressProps) {
  const isUnlimited = limit === -1;
  const percent = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);

  let colorClass = 'bg-primary-500';
  if (!isUnlimited) {
    if (percent >= 100) {
      colorClass = 'bg-red-500';
    } else if (percent >= 80) {
      colorClass = 'bg-yellow-500';
    }
  }

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            {used.toLocaleString('es-AR')} mensajes usados
          </span>
          <span className="text-gray-500">
            {isUnlimited ? 'Ilimitado' : `${limit.toLocaleString('es-AR')} límite`}
          </span>
        </div>
      )}
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all duration-500 rounded-full`}
          style={{ width: isUnlimited ? '5%' : `${percent}%` }}
        />
      </div>
      {!isUnlimited && (
        <p className="text-xs text-gray-500 text-right">
          {Math.round(percent)}% usado
        </p>
      )}
    </div>
  );
}
