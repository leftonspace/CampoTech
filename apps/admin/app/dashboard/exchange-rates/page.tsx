'use client';

/**
 * Exchange Rate Monitoring Dashboard
 * 
 * Phase 3 - Dynamic Pricing (Jan 2026)
 * 
 * Platform admin dashboard for:
 * - Viewing current exchange rates
 * - Monitoring scraper health
 * - Setting manual rate overrides
 * - Viewing rate history
 */

import { useState, useEffect, useCallback } from 'react';
import {
    RefreshCw,
    AlertCircle,
    CheckCircle,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Clock,
    Edit3,
    X,
    Save,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ExchangeRate {
    id: string;
    source: string;
    buyRate: number;
    sellRate: number;
    averageRate: number;
    fetchedAt: string;
    validUntil: string;
    isStale: boolean;
}

interface RateStats {
    source: string;
    label: string;
    current: number;
    min: number;
    max: number;
    change: number;
    changePercent: number;
    dataPoints: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════

const SOURCE_LABELS: Record<string, string> = {
    OFICIAL: 'Dólar Oficial',
    BLUE: 'Cotización de Mercado',
    MEP: 'Dólar MEP',
};

const SOURCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    OFICIAL: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    BLUE: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    MEP: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ExchangeRatesPage() {
    const [rates, setRates] = useState<ExchangeRate[]>([]);
    const [stats, setStats] = useState<RateStats[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<string | null>(null);

    // Manual override modal
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [overrideSource, setOverrideSource] = useState('BLUE');
    const [overrideBuyRate, setOverrideBuyRate] = useState('');
    const [overrideSellRate, setOverrideSellRate] = useState('');
    const [overrideReason, setOverrideReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch rates
    const fetchRates = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/exchange-rates');
            const data = await response.json();

            if (data.success) {
                setRates(data.data.rates);
                setLastUpdate(data.data.stats.lastUpdate);
                setError(null);
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch rates');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch history/stats
    const fetchStats = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/exchange-rates/history?days=7');
            const data = await response.json();

            if (data.success) {
                setStats(data.data.stats);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchRates();
        fetchStats();
    }, [fetchRates, fetchStats]);

    // Trigger manual refresh
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const response = await fetch('/api/admin/exchange-rates', {
                method: 'POST',
            });
            const data = await response.json();

            if (data.success) {
                await fetchRates();
                await fetchStats();
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to refresh');
        } finally {
            setIsRefreshing(false);
        }
    };

    // Submit manual override
    const handleSubmitOverride = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const response = await fetch('/api/admin/exchange-rates/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: overrideSource,
                    buyRate: parseFloat(overrideBuyRate),
                    sellRate: parseFloat(overrideSellRate),
                    reason: overrideReason,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setShowOverrideModal(false);
                setOverrideBuyRate('');
                setOverrideSellRate('');
                setOverrideReason('');
                await fetchRates();
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to set rate');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Format time ago
    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'hace menos de 1 min';
        if (diffMins < 60) return `hace ${diffMins} min`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `hace ${diffHours}h`;
        return `hace ${Math.floor(diffHours / 24)}d`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Cotizaciones del Dólar</h1>
                    <p className="text-sm text-gray-500">
                        Monitoreo de exchange rates y scrapers
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdate && (
                        <span className="text-sm text-gray-500">
                            Última actualización: {formatTimeAgo(lastUpdate)}
                        </span>
                    )}
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Actualizando...' : 'Actualizar Ahora'}
                    </button>
                    <button
                        onClick={() => setShowOverrideModal(true)}
                        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        <Edit3 className="h-4 w-4" />
                        Override Manual
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">{error}</span>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            ) : (
                <>
                    {/* Rate Cards */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {rates.map((rate) => {
                            const colors = SOURCE_COLORS[rate.source] || SOURCE_COLORS.BLUE;
                            const statInfo = stats.find(s => s.source === rate.source);

                            return (
                                <div
                                    key={rate.id}
                                    className={`rounded-lg border p-4 ${colors.bg} ${colors.border}`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <DollarSign className={`h-5 w-5 ${colors.text}`} />
                                            <span className={`font-semibold ${colors.text}`}>
                                                {SOURCE_LABELS[rate.source] || rate.source}
                                            </span>
                                        </div>
                                        {rate.isStale ? (
                                            <span className="flex items-center gap-1 text-xs text-amber-600">
                                                <AlertCircle className="h-3 w-3" />
                                                Desactualizado
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs text-green-600">
                                                <CheckCircle className="h-3 w-3" />
                                                Vigente
                                            </span>
                                        )}
                                    </div>

                                    <div className="text-3xl font-bold text-gray-900 mb-2">
                                        ${rate.averageRate.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                        <div>
                                            <span className="text-gray-500">Compra</span>
                                            <p className="font-medium text-gray-900">
                                                ${rate.buyRate.toLocaleString('es-AR')}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Venta</span>
                                            <p className="font-medium text-gray-900">
                                                ${rate.sellRate.toLocaleString('es-AR')}
                                            </p>
                                        </div>
                                    </div>

                                    {statInfo && (
                                        <div className="flex items-center justify-between text-xs border-t pt-2">
                                            <span className="flex items-center gap-1 text-gray-500">
                                                <Clock className="h-3 w-3" />
                                                {formatTimeAgo(rate.fetchedAt)}
                                            </span>
                                            <span className={`flex items-center gap-1 ${statInfo.change > 0 ? 'text-red-600' :
                                                    statInfo.change < 0 ? 'text-green-600' :
                                                        'text-gray-500'
                                                }`}>
                                                {statInfo.change > 0 ? (
                                                    <TrendingUp className="h-3 w-3" />
                                                ) : statInfo.change < 0 ? (
                                                    <TrendingDown className="h-3 w-3" />
                                                ) : null}
                                                {statInfo.change > 0 ? '+' : ''}
                                                {statInfo.changePercent.toFixed(2)}% (7d)
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Stats Table */}
                    {stats.length > 0 && (
                        <div className="rounded-lg border bg-white">
                            <div className="border-b px-4 py-3">
                                <h3 className="font-semibold text-gray-900">Estadísticas (últimos 7 días)</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Fuente</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Actual</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Mínimo</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Máximo</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Cambio</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Datos</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.map((stat) => (
                                            <tr key={stat.source} className="border-t">
                                                <td className="px-4 py-2 font-medium">{stat.label}</td>
                                                <td className="px-4 py-2 text-right">${stat.current.toLocaleString('es-AR')}</td>
                                                <td className="px-4 py-2 text-right text-green-600">${stat.min.toLocaleString('es-AR')}</td>
                                                <td className="px-4 py-2 text-right text-red-600">${stat.max.toLocaleString('es-AR')}</td>
                                                <td className={`px-4 py-2 text-right ${stat.change > 0 ? 'text-red-600' :
                                                        stat.change < 0 ? 'text-green-600' : ''
                                                    }`}>
                                                    {stat.change > 0 ? '+' : ''}{stat.changePercent.toFixed(2)}%
                                                </td>
                                                <td className="px-4 py-2 text-right text-gray-500">{stat.dataPoints}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Manual Override Modal */}
            {showOverrideModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Override Manual de Cotización</h2>
                            <button
                                onClick={() => setShowOverrideModal(false)}
                                className="rounded p-1 hover:bg-gray-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitOverride} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Fuente
                                </label>
                                <select
                                    value={overrideSource}
                                    onChange={(e) => setOverrideSource(e.target.value)}
                                    className="w-full rounded-lg border px-3 py-2"
                                >
                                    <option value="OFICIAL">Dólar Oficial</option>
                                    <option value="BLUE">Cotización de Mercado (Blue)</option>
                                    <option value="MEP">Dólar MEP</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Compra ($)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={overrideBuyRate}
                                        onChange={(e) => setOverrideBuyRate(e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2"
                                        placeholder="1150.00"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Venta ($)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={overrideSellRate}
                                        onChange={(e) => setOverrideSellRate(e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2"
                                        placeholder="1180.00"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Razón (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={overrideReason}
                                    onChange={(e) => setOverrideReason(e.target.value)}
                                    className="w-full rounded-lg border px-3 py-2"
                                    placeholder="Scraper caído, datos de mercado..."
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowOverrideModal(false)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
                                >
                                    <Save className="h-4 w-4" />
                                    {isSubmitting ? 'Guardando...' : 'Guardar Override'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
