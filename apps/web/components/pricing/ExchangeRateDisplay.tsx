'use client';

/**
 * ExchangeRateDisplay Component
 * 
 * Phase 2 - Dynamic Pricing UI (Jan 2026)
 * 
 * Shows current exchange rates from all sources with:
 * - Rate comparison between OFICIAL, BLUE, MEP
 * - Refresh button
 * - Stale rate warnings
 * - Selection for organization default
 */

import { useState, useEffect, useCallback } from 'react';
import {
    RefreshCw,
    AlertCircle,
    Check,
    TrendingUp,
    Building2,
    BadgeDollarSign,
    Landmark,
    Coins,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type ExchangeRateSource = 'OFICIAL' | 'BLUE' | 'MEP' | 'CCL' | 'CRYPTO' | 'CUSTOM';

interface RateData {
    source: ExchangeRateSource;
    label: string;
    buyRate: number;
    sellRate: number;
    averageRate: number;
    fetchedAt: string;
    isStale: boolean;
    display: {
        buy: string;
        sell: string;
        average: string;
    };
}

interface ExchangeRateDisplayProps {
    /** Currently selected source */
    selectedSource?: ExchangeRateSource;
    /** Callback when source is selected */
    onSourceSelect?: (source: ExchangeRateSource) => void;
    /** Whether to show selection UI */
    showSelection?: boolean;
    /** Compact mode (less details) */
    compact?: boolean;
    /** Custom class name */
    className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const SOURCE_ICONS: Record<ExchangeRateSource, typeof Landmark> = {
    OFICIAL: Landmark,
    BLUE: BadgeDollarSign,
    MEP: TrendingUp,
    CCL: TrendingUp,
    CRYPTO: Coins,
    CUSTOM: Building2,
};

const SOURCE_COLORS: Record<ExchangeRateSource, { bg: string; text: string; border: string }> = {
    OFICIAL: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    BLUE: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    MEP: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    CCL: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    CRYPTO: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    CUSTOM: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

// Legal shield descriptions
const SOURCE_DESCRIPTIONS: Record<ExchangeRateSource, string> = {
    OFICIAL: 'Tipo de cambio oficial del BCRA',
    BLUE: 'Cotización de referencia del mercado informal',
    MEP: 'Dólar bolsa (Mercado Electrónico de Pagos)',
    CCL: 'Contado con liquidación',
    CRYPTO: 'Cotización USDT/ARS en exchanges',
    CUSTOM: 'Cotización personalizada ingresada manualmente',
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function ExchangeRateDisplay({
    selectedSource = 'BLUE',
    onSourceSelect,
    showSelection = false,
    compact = false,
    className = '',
}: ExchangeRateDisplayProps) {
    const [rates, setRates] = useState<RateData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Fetch all exchange rates
    const fetchRates = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/exchange-rates');
            const data = await response.json();

            if (data.success && data.data) {
                setRates(data.data);
                setLastUpdated(new Date());
            } else {
                throw new Error(data.error || 'Failed to fetch rates');
            }
        } catch (err) {
            console.error('Failed to fetch exchange rates:', err);
            setError('No se pudieron obtener las cotizaciones');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchRates();
    }, [fetchRates]);

    // Format time ago
    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'hace menos de 1 min';
        if (diffMins < 60) return `hace ${diffMins} min`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `hace ${diffHours}h`;
        return `hace ${Math.floor(diffHours / 24)}d`;
    };

    // Loading state
    if (isLoading && rates.length === 0) {
        return (
            <div className={`rounded-lg border bg-white p-4 ${className}`}>
                <div className="flex items-center gap-2 text-gray-500">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Cargando cotizaciones...</span>
                </div>
            </div>
        );
    }

    // Error state
    if (error && rates.length === 0) {
        return (
            <div className={`rounded-lg border border-red-200 bg-red-50 p-4 ${className}`}>
                <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                    <button
                        onClick={fetchRates}
                        className="ml-auto rounded bg-red-100 px-2 py-1 text-xs hover:bg-red-200"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Header with refresh */}
            <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Cotizaciones del Dólar</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    {lastUpdated && <span>Actualizado {formatTimeAgo(lastUpdated)}</span>}
                    <button
                        onClick={fetchRates}
                        disabled={isLoading}
                        className="rounded p-1 hover:bg-gray-100 disabled:opacity-50"
                        title="Actualizar cotizaciones"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Rate Cards */}
            <div className={`grid gap-3 ${compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
                {rates.map((rate) => {
                    const Icon = SOURCE_ICONS[rate.source];
                    const colors = SOURCE_COLORS[rate.source];
                    const isSelected = rate.source === selectedSource;

                    return (
                        <div
                            key={rate.source}
                            onClick={() => showSelection && onSourceSelect?.(rate.source)}
                            className={`
                relative rounded-lg border p-3 transition-all
                ${colors.bg} ${colors.border}
                ${showSelection ? 'cursor-pointer hover:shadow-md' : ''}
                ${isSelected && showSelection ? 'ring-2 ring-primary-500 ring-offset-1' : ''}
              `}
                        >
                            {/* Selected indicator */}
                            {isSelected && showSelection && (
                                <div className="absolute -right-1 -top-1 rounded-full bg-primary-500 p-0.5 text-white">
                                    <Check className="h-3 w-3" />
                                </div>
                            )}

                            {/* Stale indicator */}
                            {rate.isStale && (
                                <div className="absolute right-2 top-2" title="Cotización desactualizada">
                                    <AlertCircle className="h-4 w-4 text-amber-500" />
                                </div>
                            )}

                            {/* Rate Content */}
                            <div className="flex items-center gap-2">
                                <Icon className={`h-5 w-5 ${colors.text}`} />
                                <span className={`text-sm font-medium ${colors.text}`}>
                                    {rate.label}
                                </span>
                            </div>

                            {compact ? (
                                <p className={`mt-2 text-xl font-bold ${colors.text}`}>
                                    {rate.display.sell}
                                </p>
                            ) : (
                                <>
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-gray-500">Compra</span>
                                            <p className="font-semibold text-gray-900">{rate.display.buy}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Venta</span>
                                            <p className="font-semibold text-gray-900">{rate.display.sell}</p>
                                        </div>
                                    </div>

                                    {showSelection && (
                                        <p className="mt-2 text-xs text-gray-500">
                                            {SOURCE_DESCRIPTIONS[rate.source]}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Selection hint */}
            {showSelection && (
                <p className="text-xs text-gray-500">
                    Seleccioná la cotización que se usará para convertir precios en USD a pesos argentinos.
                </p>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPACT RATE BADGE
// ═══════════════════════════════════════════════════════════════════════════════

interface RateBadgeProps {
    source?: ExchangeRateSource;
    className?: string;
}

/**
 * Small badge showing current rate for headers/cards
 */
export function ExchangeRateBadge({ source = 'BLUE', className = '' }: RateBadgeProps) {
    const [rate, setRate] = useState<RateData | null>(null);

    useEffect(() => {
        fetch(`/api/exchange-rates/${source.toLowerCase()}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    setRate(data.data);
                }
            })
            .catch(console.error);
    }, [source]);

    if (!rate) return null;

    const colors = SOURCE_COLORS[source];

    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${className}`}>
            <BadgeDollarSign className="h-3 w-3" />
            {rate.display.sell}
            {rate.isStale && <AlertCircle className="h-3 w-3 text-amber-500" />}
        </span>
    );
}
