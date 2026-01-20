'use client';

/**
 * PriceCurrencyInput Component
 * 
 * Phase 2 - Dynamic Pricing UI (Jan 2026)
 * 
 * A currency-aware price input that supports:
 * - Toggle between ARS and USD
 * - Live ARS conversion below USD input
 * - Smart rounding preview
 * - Stale rate warning
 */

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, RefreshCw, AlertCircle, ArrowRightLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type Currency = 'ARS' | 'USD';

export interface PriceCurrencyInputProps {
    /** Current price value */
    value: string;
    /** Callback when price changes */
    onChange: (value: string) => void;
    /** Current currency */
    currency: Currency;
    /** Callback when currency changes */
    onCurrencyChange: (currency: Currency) => void;
    /** 
     * If true, convert the value when switching currencies
     * ARS 1500 → USD ~$1, USD 1 → ARS ~$1505
     * @default true
     */
    convertOnToggle?: boolean;
    /** Label for the input */
    label?: string;
    /** Optional unit display (e.g., "/ hora") */
    unit?: string;
    /** Whether the input is required */
    required?: boolean;
    /** Whether to show the currency toggle */
    showToggle?: boolean;
    /** Custom class name */
    className?: string;
    /** Input ID */
    id?: string;
    /** Placeholder text */
    placeholder?: string;
}

interface ExchangeRateData {
    source: string;
    label: string;
    sellRate: number;
    isStale: boolean;
    fetchedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function PriceCurrencyInput({
    value,
    onChange,
    currency,
    onCurrencyChange,
    convertOnToggle = true,
    label = 'Precio',
    unit,
    required = false,
    showToggle = true,
    className = '',
    id = 'price',
    placeholder = '0.00',
}: PriceCurrencyInputProps) {
    const [exchangeRate, setExchangeRate] = useState<ExchangeRateData | null>(null);
    const [isLoadingRate, setIsLoadingRate] = useState(false);
    const [rateError, setRateError] = useState<string | null>(null);

    // Fetch exchange rate - needed for conversions
    const fetchExchangeRate = useCallback(async () => {
        setIsLoadingRate(true);
        setRateError(null);

        try {
            const response = await fetch('/api/exchange-rates/blue');
            const data = await response.json();

            if (data.success && data.data) {
                setExchangeRate({
                    source: data.data.source,
                    label: data.data.label,
                    sellRate: data.data.sellRate,
                    isStale: data.data.isStale,
                    fetchedAt: data.data.fetchedAt,
                });
                return data.data.sellRate;
            } else {
                throw new Error(data.error || 'Failed to fetch rate');
            }
        } catch (err) {
            console.error('Failed to fetch exchange rate:', err);
            setRateError('No se pudo obtener la cotización');
            return null;
        } finally {
            setIsLoadingRate(false);
        }
    }, []);

    // Fetch rate on mount (always, so we can convert in either direction)
    useEffect(() => {
        if (!exchangeRate && !isLoadingRate) {
            fetchExchangeRate();
        }
    }, [exchangeRate, isLoadingRate, fetchExchangeRate]);

    // Calculate ARS equivalent
    const arsEquivalent = currency === 'USD' && exchangeRate && value
        ? parseFloat(value) * exchangeRate.sellRate
        : null;

    // Handle currency toggle with optional conversion
    const handleToggle = async () => {
        const newCurrency = currency === 'ARS' ? 'USD' : 'ARS';
        const currentValue = parseFloat(value) || 0;

        console.log('[PriceCurrencyInput] Toggle clicked:', {
            from: currency,
            to: newCurrency,
            currentValue,
            convertOnToggle,
            cachedRate: exchangeRate?.sellRate
        });

        if (convertOnToggle && currentValue > 0) {
            // Get the exchange rate (use cached or fetch)
            let rate = exchangeRate?.sellRate;
            if (!rate) {
                console.log('[PriceCurrencyInput] No cached rate, fetching...');
                rate = await fetchExchangeRate();
            }

            console.log('[PriceCurrencyInput] Using rate:', rate);

            if (rate && rate > 0) {
                let convertedValue: number;

                if (currency === 'ARS') {
                    // ARS → USD: divide by rate
                    // e.g., ARS 1500 ÷ 1505 = USD ~$1
                    convertedValue = currentValue / rate;
                } else {
                    // USD → ARS: multiply by rate
                    // e.g., USD 1 × 1505 = ARS ~$1505
                    convertedValue = currentValue * rate;
                }

                // Format the converted value (2 decimal places for USD, whole number for ARS)
                const formattedValue = newCurrency === 'USD'
                    ? convertedValue.toFixed(2)
                    : Math.round(convertedValue).toString();

                console.log('[PriceCurrencyInput] Converting:', {
                    from: currentValue,
                    to: formattedValue,
                    rate,
                    convertedValue
                });

                onChange(formattedValue);
            }
        }

        onCurrencyChange(newCurrency);
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
        <div className={`space-y-2 ${className}`}>
            {/* Label Row */}
            <div className="flex items-center justify-between">
                <label htmlFor={id} className="label">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>

                {/* Currency Toggle */}
                {showToggle && (
                    <button
                        type="button"
                        onClick={handleToggle}
                        className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
                        title="Cambiar moneda"
                    >
                        <ArrowRightLeft className="h-3 w-3" />
                        <span>{currency === 'ARS' ? 'Cambiar a USD' : 'Cambiar a ARS'}</span>
                    </button>
                )}
            </div>

            {/* Input with Currency Indicator */}
            <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    {currency === 'USD' ? (
                        <span className="text-sm font-medium text-green-600">US$</span>
                    ) : (
                        <DollarSign className="h-4 w-4 text-gray-400" />
                    )}
                </div>

                <input
                    id={id}
                    type="number"
                    min="0"
                    step="0.01"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={`input pl-10 pr-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${currency === 'USD' ? 'border-green-300 bg-green-50/30 focus:border-green-500 focus:ring-green-500' : ''}`}
                    required={required}
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el precio')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                />

                {/* Currency Badge */}
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${currency === 'USD'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                        }`}>
                        {currency}
                    </span>
                </div>
            </div>

            {/* Unit display */}
            {unit && (
                <p className="text-xs text-gray-500">por {unit}</p>
            )}

            {/* ARS Conversion Display (when USD) */}
            {currency === 'USD' && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    {isLoadingRate ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>Cargando cotización...</span>
                        </div>
                    ) : rateError ? (
                        <div className="flex items-center gap-2 text-sm text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            <span>{rateError}</span>
                            <button
                                type="button"
                                onClick={fetchExchangeRate}
                                className="ml-auto text-xs underline hover:no-underline"
                            >
                                Reintentar
                            </button>
                        </div>
                    ) : exchangeRate ? (
                        <div className="space-y-2">
                            {/* Conversion Result */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Equivalente en ARS:</span>
                                <span className="text-lg font-bold text-green-700">
                                    {arsEquivalent ? formatCurrency(arsEquivalent) : '-'}
                                </span>
                            </div>

                            {/* Exchange Rate Info */}
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>
                                    {exchangeRate.label}: ${exchangeRate.sellRate.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="flex items-center gap-1">
                                    {exchangeRate.isStale && (
                                        <span title="Cotización desactualizada">
                                            <AlertCircle className="h-3 w-3 text-amber-500" />
                                        </span>
                                    )}
                                    {formatTimeAgo(exchangeRate.fetchedAt)}
                                    <button
                                        type="button"
                                        onClick={fetchExchangeRate}
                                        className="ml-1 rounded p-0.5 hover:bg-green-100"
                                        title="Actualizar cotización"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                    </button>
                                </span>
                            </div>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY HOOK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to manage currency state for forms
 */
export function usePriceCurrency(initialCurrency: Currency = 'ARS') {
    const [currency, setCurrency] = useState<Currency>(initialCurrency);
    const [price, setPrice] = useState('');

    return {
        currency,
        setCurrency,
        price,
        setPrice,
        isUSD: currency === 'USD',
        isARS: currency === 'ARS',
    };
}
