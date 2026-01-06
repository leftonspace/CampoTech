'use client';

/**
 * Fiscal Health Widget
 * ====================
 *
 * Phase 2.4 Task 2.4.4: Dashboard Widget Component
 *
 * Traffic light widget showing Monotributo billing status.
 * Provides visual feedback on fiscal health with compliance-focused messaging.
 *
 * Status indicators:
 * - 🟢 GREEN (< 70%): Healthy - within limits
 * - 🟡 YELLOW (70-90%): Approaching limit
 * - 🔴 RED (> 90%): At risk - consult accountant
 */

import { useState, useEffect } from 'react';
import { Building2, TrendingUp, AlertTriangle, Info, ChevronRight, RefreshCw } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type FiscalHealthStatus = 'green' | 'yellow' | 'red';

interface FiscalHealthData {
    category: string;
    categoryName: string;
    ytdBilling: number;
    annualLimit: number;
    percentUsed: number;
    remainingAmount: number;
    status: FiscalHealthStatus;
    statusLabel: string;
    recommendation: string;
    suggestedCategory: string | null;
    invoiceCount: number;
    averageMonthlyBilling: number;
    projectedAnnual: number;
    projectedStatus: FiscalHealthStatus;
    formatted: {
        ytdBilling: string;
        annualLimit: string;
        remainingAmount: string;
        remainingMonthly: string;
        averageMonthly: string;
        projectedAnnual: string;
    };
}

interface FiscalHealthWidgetProps {
    onViewDetails?: () => void;
    compact?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS COLORS & STYLING
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
    green: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-700',
        icon: '🟢',
        barColor: 'bg-green-500',
        barBg: 'bg-green-200',
    },
    yellow: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        icon: '🟡',
        barColor: 'bg-amber-500',
        barBg: 'bg-amber-200',
    },
    red: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
        icon: '🔴',
        barColor: 'bg-red-500',
        barBg: 'bg-red-200',
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function FiscalHealthWidget({ onViewDetails, compact = false }: FiscalHealthWidgetProps) {
    const [data, setData] = useState<FiscalHealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('/api/analytics/fiscal-health');
            const result = await response.json();

            if (result.success) {
                setData(result.data);
            } else {
                setError(result.error || 'Error al cargar datos');
            }
        } catch {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Loading state
    if (loading) {
        return (
            <div className="rounded-lg border border-gray-200 bg-white p-6 animate-pulse">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 bg-gray-200 rounded"></div>
                    <div className="h-5 bg-gray-200 rounded w-48"></div>
                </div>
                <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6">
                <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Error</span>
                </div>
                <p className="mt-2 text-sm text-red-600">{error}</p>
                <button
                    onClick={fetchData}
                    className="mt-3 flex items-center gap-1 text-sm text-red-700 hover:text-red-800"
                >
                    <RefreshCw className="h-4 w-4" />
                    Reintentar
                </button>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    const statusConfig = STATUS_CONFIG[data.status];

    // Compact view (for sidebars)
    if (compact) {
        return (
            <div
                className={`rounded-lg border ${statusConfig.border} ${statusConfig.bg} p-4 cursor-pointer hover:shadow-sm transition-shadow`}
                onClick={onViewDetails}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{statusConfig.icon}</span>
                        <span className={`font-medium ${statusConfig.text}`}>
                            Monotributo: {Math.round(data.percentUsed)}% usado
                        </span>
                    </div>
                    <ChevronRight className={`h-4 w-4 ${statusConfig.text}`} />
                </div>
                <p className="mt-1 text-sm text-gray-600">
                    Disponible: {data.formatted.remainingAmount}
                </p>
            </div>
        );
    }

    // Full widget view
    return (
        <div className={`rounded-lg border ${statusConfig.border} ${statusConfig.bg} overflow-hidden`}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-opacity-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-900">Salud Fiscal - Monotributo</h3>
                </div>
                <button
                    onClick={fetchData}
                    className="p-1 rounded hover:bg-white/50 transition-colors"
                    title="Actualizar"
                >
                    <RefreshCw className="h-4 w-4 text-gray-500" />
                </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
                {/* Category */}
                <div>
                    <p className="text-sm text-gray-500">Categoría</p>
                    <p className="text-lg font-semibold text-gray-900">{data.categoryName}</p>
                </div>

                {/* Progress bar */}
                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Uso del límite anual</span>
                        <span className={`font-medium ${statusConfig.text}`}>
                            {Math.round(data.percentUsed)}%
                        </span>
                    </div>
                    <div className={`h-3 rounded-full ${statusConfig.barBg} overflow-hidden`}>
                        <div
                            className={`h-full rounded-full ${statusConfig.barColor} transition-all duration-500`}
                            style={{ width: `${Math.min(100, data.percentUsed)}%` }}
                        />
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                        <span className="text-lg">{statusConfig.icon}</span>
                        <span className={`text-sm font-medium ${statusConfig.text}`}>
                            {data.statusLabel.toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 py-2">
                    <div>
                        <p className="text-sm text-gray-500">Facturado YTD</p>
                        <p className="text-lg font-semibold text-gray-900">{data.formatted.ytdBilling}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Límite anual</p>
                        <p className="text-lg font-semibold text-gray-900">{data.formatted.annualLimit}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Disponible</p>
                        <p className="text-lg font-semibold text-green-600">{data.formatted.remainingAmount}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Promedio mensual</p>
                        <p className="text-lg font-semibold text-gray-900">{data.formatted.averageMonthly}</p>
                    </div>
                </div>

                {/* Projected warning */}
                {data.projectedStatus !== 'green' && (
                    <div className="flex items-start gap-2 p-3 bg-white/50 rounded-lg">
                        <TrendingUp className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-medium text-amber-800">Proyección anual</p>
                            <p className="text-gray-600">
                                Al ritmo actual, facturarás {data.formatted.projectedAnnual} este año.
                            </p>
                        </div>
                    </div>
                )}

                {/* Recommendation */}
                <div className="flex items-start gap-2 p-3 bg-white/50 rounded-lg">
                    <Info className={`h-4 w-4 mt-0.5 ${statusConfig.text}`} />
                    <p className="text-sm text-gray-700">{data.recommendation}</p>
                </div>

                {/* Suggested category upgrade */}
                {data.suggestedCategory && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-800">
                            Considerá pasar a <strong>Categoría {data.suggestedCategory}</strong>
                        </p>
                        <AlertTriangle className="h-4 w-4 text-blue-600" />
                    </div>
                )}

                {/* View details link */}
                {onViewDetails && (
                    <button
                        onClick={onViewDetails}
                        className="w-full text-center py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/30 rounded transition-colors"
                    >
                        Ver detalles
                    </button>
                )}
            </div>

            {/* Footer with invoice count */}
            <div className="px-6 py-3 bg-white/30 border-t border-opacity-50 text-xs text-gray-500">
                Basado en {data.invoiceCount} factura{data.invoiceCount !== 1 ? 's' : ''} con CAE este año
            </div>
        </div>
    );
}

export default FiscalHealthWidget;
