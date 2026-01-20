'use client';

/**
 * RateHistoryChart Component
 * 
 * Phase 3 - Dynamic Pricing (Jan 2026)
 * 
 * Displays historical exchange rates in a line chart.
 * Uses lightweight canvas-based charting for performance.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ChartDataPoint {
    date: string;
    buy: number;
    sell: number;
    avg: number;
}

interface ChartSeries {
    source: string;
    label: string;
    data: ChartDataPoint[];
}

interface RateStats {
    source: string;
    period: string;
    current: number;
    min: number;
    max: number;
    change: number;
    changePercent: number;
    dataPoints: number;
}

interface RateHistoryChartProps {
    source?: string;
    days?: number;
    height?: number;
    showStats?: boolean;
    className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR SCHEME
// ═══════════════════════════════════════════════════════════════════════════════

const SOURCE_COLORS: Record<string, { line: string; fill: string }> = {
    OFICIAL: { line: '#3b82f6', fill: 'rgba(59, 130, 246, 0.1)' },
    BLUE: { line: '#22c55e', fill: 'rgba(34, 197, 94, 0.1)' },
    MEP: { line: '#a855f7', fill: 'rgba(168, 85, 247, 0.1)' },
    CCL: { line: '#6366f1', fill: 'rgba(99, 102, 241, 0.1)' },
    CRYPTO: { line: '#f97316', fill: 'rgba(249, 115, 22, 0.1)' },
    CUSTOM: { line: '#6b7280', fill: 'rgba(107, 114, 128, 0.1)' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function RateHistoryChart({
    source = 'BLUE',
    days = 7,
    height = 200,
    showStats = true,
    className = '',
}: RateHistoryChartProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [data, setData] = useState<ChartSeries[]>([]);
    const [stats, setStats] = useState<RateStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredPoint, setHoveredPoint] = useState<{
        x: number;
        y: number;
        value: number;
        date: string;
    } | null>(null);

    // Fetch data
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const url = `/api/exchange-rates/history?source=${source}&days=${days}&stats=true`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.success && result.data) {
                setData(result.data.history);
                setStats(result.data.stats);
            } else {
                throw new Error(result.error || 'Failed to load data');
            }
        } catch (err) {
            console.error('Failed to fetch rate history:', err);
            setError(err instanceof Error ? err.message : 'Error loading chart');
        } finally {
            setIsLoading(false);
        }
    }, [source, days]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Draw chart
    useEffect(() => {
        if (!canvasRef.current || data.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Get device pixel ratio for high-DPI displays
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        // Set canvas size
        canvas.width = rect.width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Clear canvas
        ctx.clearRect(0, 0, rect.width, height);

        // Find data range across all series
        let minVal = Infinity;
        let maxVal = -Infinity;
        for (const series of data) {
            for (const point of series.data) {
                minVal = Math.min(minVal, point.buy, point.sell);
                maxVal = Math.max(maxVal, point.buy, point.sell);
            }
        }

        // Add padding to range
        const padding = (maxVal - minVal) * 0.1;
        minVal -= padding;
        maxVal += padding;

        const chartPadding = { top: 20, right: 20, bottom: 30, left: 60 };
        const chartWidth = rect.width - chartPadding.left - chartPadding.right;
        const chartHeight = height - chartPadding.top - chartPadding.bottom;

        // Draw each series
        for (const series of data) {
            const color = SOURCE_COLORS[series.source] || SOURCE_COLORS.CUSTOM;
            const points = series.data;

            if (points.length < 2) continue;

            // Calculate points
            const chartPoints = points.map((p, i) => ({
                x: chartPadding.left + (i / (points.length - 1)) * chartWidth,
                y: chartPadding.top + (1 - (p.avg - minVal) / (maxVal - minVal)) * chartHeight,
                value: p.avg,
                date: p.date,
            }));

            // Draw area fill
            ctx.beginPath();
            ctx.moveTo(chartPoints[0].x, chartPoints[0].y);
            for (const pt of chartPoints) {
                ctx.lineTo(pt.x, pt.y);
            }
            ctx.lineTo(chartPoints[chartPoints.length - 1].x, height - chartPadding.bottom);
            ctx.lineTo(chartPoints[0].x, height - chartPadding.bottom);
            ctx.closePath();
            ctx.fillStyle = color.fill;
            ctx.fill();

            // Draw line
            ctx.beginPath();
            ctx.moveTo(chartPoints[0].x, chartPoints[0].y);
            for (const pt of chartPoints) {
                ctx.lineTo(pt.x, pt.y);
            }
            ctx.strokeStyle = color.line;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Draw axes
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;

        // Y-axis
        ctx.beginPath();
        ctx.moveTo(chartPadding.left, chartPadding.top);
        ctx.lineTo(chartPadding.left, height - chartPadding.bottom);
        ctx.stroke();

        // X-axis
        ctx.beginPath();
        ctx.moveTo(chartPadding.left, height - chartPadding.bottom);
        ctx.lineTo(rect.width - chartPadding.right, height - chartPadding.bottom);
        ctx.stroke();

        // Y-axis labels
        ctx.fillStyle = '#6b7280';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';

        const ySteps = 4;
        for (let i = 0; i <= ySteps; i++) {
            const val = minVal + (maxVal - minVal) * (1 - i / ySteps);
            const y = chartPadding.top + (i / ySteps) * chartHeight;
            ctx.fillText(`$${val.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`, chartPadding.left - 8, y + 4);
        }

    }, [data, height]);

    // Handle mouse move for tooltip
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || data.length === 0) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const _y = e.clientY - rect.top;

        // Find closest point
        const chartPadding = { left: 60, right: 20 };
        const chartWidth = rect.width - chartPadding.left - chartPadding.right;

        for (const series of data) {
            const points = series.data;
            if (points.length < 2) continue;

            const pointIndex = Math.round(((x - chartPadding.left) / chartWidth) * (points.length - 1));
            if (pointIndex >= 0 && pointIndex < points.length) {
                const point = points[pointIndex];
                setHoveredPoint({
                    x: e.clientX,
                    y: e.clientY,
                    value: point.avg,
                    date: new Date(point.date).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                    }),
                });
                return;
            }
        }
    };

    // Format change indicator
    const getChangeIcon = () => {
        if (!stats) return null;
        if (stats.change > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
        if (stats.change < 0) return <TrendingDown className="h-4 w-4 text-green-500" />;
        return <Minus className="h-4 w-4 text-gray-400" />;
    };

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center ${className}`} style={{ height }}>
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className={`flex flex-col items-center justify-center text-sm text-gray-500 ${className}`} style={{ height }}>
                <p>{error}</p>
                <button onClick={fetchData} className="mt-2 text-primary-600 underline">
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Stats Header */}
            {showStats && stats && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-gray-900">
                            ${stats.current.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="flex items-center gap-1">
                            {getChangeIcon()}
                            <span className={`text-sm font-medium ${stats.change > 0 ? 'text-red-600' : stats.change < 0 ? 'text-green-600' : 'text-gray-500'
                                }`}>
                                {stats.change > 0 ? '+' : ''}{stats.changePercent.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                    <div className="text-xs text-gray-500">
                        Min: ${stats.min.toLocaleString('es-AR')} | Max: ${stats.max.toLocaleString('es-AR')}
                    </div>
                </div>
            )}

            {/* Chart */}
            <div className="relative">
                <canvas
                    ref={canvasRef}
                    className="w-full"
                    style={{ height }}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHoveredPoint(null)}
                />

                {/* Tooltip */}
                {hoveredPoint && (
                    <div
                        className="pointer-events-none absolute z-10 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg"
                        style={{
                            left: hoveredPoint.x - 50,
                            top: hoveredPoint.y - 40,
                        }}
                    >
                        <div className="font-bold">${hoveredPoint.value.toLocaleString('es-AR')}</div>
                        <div className="text-gray-300">{hoveredPoint.date}</div>
                    </div>
                )}
            </div>

            {/* Period Selector */}
            <div className="flex justify-center gap-2">
                {[7, 14, 30].map(d => (
                    <button
                        key={d}
                        className={`rounded px-3 py-1 text-xs font-medium transition-colors ${d === days
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        {d}d
                    </button>
                ))}
            </div>
        </div>
    );
}
