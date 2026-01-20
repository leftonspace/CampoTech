'use client';

/**
 * Pricing Settings Page
 * 
 * Phase 2 - Dynamic Pricing UI (Jan 2026)
 * 
 * Allows organization owners to configure:
 * - Default exchange rate source (OFICIAL/BLUE/MEP)
 * - Smart rounding preferences
 * - Exchange rate markup
 * - Auto-update settings
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { ExchangeRateDisplay, RateHistoryChart } from '@/components/pricing';
import {
    ArrowLeft,
    Save,
    DollarSign,
    Calculator,
    Settings,
    Info,
    CheckCircle,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const EXCHANGE_RATE_SOURCES = [
    { value: 'OFICIAL', label: 'Dólar Oficial', description: 'Tipo de cambio BCRA - Solo para referencia' },
    { value: 'BLUE', label: 'Cotización de Mercado', description: 'Recomendado - Refleja precios reales' },
    { value: 'MEP', label: 'Dólar MEP', description: 'Dólar bolsa - Para empresas con acceso' },
];

const ROUNDING_STRATEGIES = [
    { value: 'NO_ROUNDING', label: 'Sin redondeo', description: 'Mantener precio exacto' },
    { value: 'ROUND_100', label: 'Redondear a $100', description: 'Ej: $16,020 → $16,000' },
    { value: 'ROUND_500', label: 'Redondear a $500', description: 'Ej: $16,020 → $16,000 (Recomendado)', recommended: true },
    { value: 'ROUND_1000', label: 'Redondear a $1,000', description: 'Ej: $16,520 → $17,000' },
    { value: 'ROUND_5000', label: 'Redondear a $5,000', description: 'Para montos altos' },
];

const ROUNDING_DIRECTIONS = [
    { value: 'NEAREST', label: 'Al más cercano', description: 'Redondeo estándar' },
    { value: 'UP', label: 'Siempre arriba', description: 'Protege tu margen' },
    { value: 'DOWN', label: 'Siempre abajo', description: 'Amigable al cliente' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PricingSettings {
    defaultCurrency: string;
    exchangeRateSource: string;
    customExchangeRate?: number;
    exchangeRateMarkup: number;
    exchangeRateLabel?: string;
    autoUpdateExchangeRate: boolean;
    roundingStrategy: string;
    roundingDirection: string;
    autoUpdateThreshold: number;
    anchorExchangeRate?: number;
    anchorSetAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function PricingSettingsPage() {
    const queryClient = useQueryClient();
    const [isSaved, setIsSaved] = useState(false);

    // Fetch current settings
    const { data, isLoading } = useQuery({
        queryKey: ['pricing-settings'],
        queryFn: async () => {
            const res = await api.settings.pricing.get();
            return res.data as PricingSettings | null;
        },
    });

    const [formData, setFormData] = useState<Partial<PricingSettings>>({
        exchangeRateSource: 'BLUE',
        exchangeRateMarkup: 0,
        autoUpdateExchangeRate: true,
        roundingStrategy: 'ROUND_500',
        roundingDirection: 'NEAREST',
        autoUpdateThreshold: 5,
    });

    // Update form when data loads
    useState(() => {
        if (data) {
            setFormData({
                exchangeRateSource: data.exchangeRateSource || 'BLUE',
                exchangeRateMarkup: data.exchangeRateMarkup || 0,
                autoUpdateExchangeRate: data.autoUpdateExchangeRate ?? true,
                roundingStrategy: data.roundingStrategy || 'ROUND_500',
                roundingDirection: data.roundingDirection || 'NEAREST',
                autoUpdateThreshold: data.autoUpdateThreshold || 5,
            });
        }
    });

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async (settings: Partial<PricingSettings>) => {
            return api.settings.pricing.update(settings);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pricing-settings'] });
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 3000);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/settings"
                    className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">Configuración de Precios</h1>
                    <p className="text-gray-500">Cotización del dólar y redondeo inteligente</p>
                </div>
            </div>

            {/* Exchange Rate Display */}
            <div className="card p-4">
                <ExchangeRateDisplay compact />
            </div>

            {/* Rate History Chart */}
            <div className="card p-4">
                <h3 className="font-medium text-gray-900 mb-4">Historial de Cotizaciones</h3>
                <RateHistoryChart source="BLUE" days={7} height={180} showStats />
            </div>

            {isLoading ? (
                <div className="card p-8">
                    <div className="flex items-center justify-center text-gray-500">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary-500" />
                        <span className="ml-2">Cargando configuración...</span>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Exchange Rate Source */}
                    <div className="card p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            <h2 className="text-lg font-semibold text-gray-900">Fuente de Cotización</h2>
                        </div>

                        <p className="text-sm text-gray-600 mb-4">
                            Seleccioná la cotización que se usará para convertir precios en USD a pesos argentinos.
                        </p>

                        <div className="space-y-3">
                            {EXCHANGE_RATE_SOURCES.map((source) => (
                                <label
                                    key={source.value}
                                    className={`flex items - start gap - 3 p - 4 rounded - lg border cursor - pointer transition - all ${formData.exchangeRateSource === source.value
                                        ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                                        : 'border-gray-200 hover:border-gray-300'
                                        } `}
                                >
                                    <input
                                        type="radio"
                                        name="exchangeRateSource"
                                        value={source.value}
                                        checked={formData.exchangeRateSource === source.value}
                                        onChange={(e) => setFormData({ ...formData, exchangeRateSource: e.target.value })}
                                        className="mt-1 text-primary-600"
                                    />
                                    <div>
                                        <span className="font-medium text-gray-900">{source.label}</span>
                                        <p className="text-sm text-gray-500">{source.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        {/* Exchange Rate Markup */}
                        <div className="mt-6">
                            <label htmlFor="markup" className="label mb-2 block">
                                Recargo sobre cotización (%)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    id="markup"
                                    type="number"
                                    min="0"
                                    max="50"
                                    step="0.5"
                                    value={formData.exchangeRateMarkup || 0}
                                    onChange={(e) => setFormData({ ...formData, exchangeRateMarkup: parseFloat(e.target.value) || 0 })}
                                    className="input w-32"
                                />
                                <span className="text-sm text-gray-500">
                                    Agregá un % extra para cubrir variaciones
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Smart Rounding */}
                    <div className="card p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Calculator className="h-5 w-5 text-blue-600" />
                            <h2 className="text-lg font-semibold text-gray-900">Redondeo Inteligente</h2>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">El Redondeo</span>
                        </div>

                        <p className="text-sm text-gray-600 mb-4">
                            Nadie cobra $16.020 — redondeá a $16.000 o $16.500 para precios más profesionales.
                        </p>

                        {/* Rounding Strategy */}
                        <div className="space-y-3 mb-6">
                            {ROUNDING_STRATEGIES.map((strategy) => (
                                <label
                                    key={strategy.value}
                                    className={`flex items - start gap - 3 p - 3 rounded - lg border cursor - pointer transition - all ${formData.roundingStrategy === strategy.value
                                        ? 'border-primary-500 bg-primary-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        } `}
                                >
                                    <input
                                        type="radio"
                                        name="roundingStrategy"
                                        value={strategy.value}
                                        checked={formData.roundingStrategy === strategy.value}
                                        onChange={(e) => setFormData({ ...formData, roundingStrategy: e.target.value })}
                                        className="mt-1 text-primary-600"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900">{strategy.label}</span>
                                            {strategy.recommended && (
                                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Recomendado</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500">{strategy.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        {/* Rounding Direction */}
                        <div>
                            <label className="label mb-2 block">Dirección del redondeo</label>
                            <div className="flex gap-3">
                                {ROUNDING_DIRECTIONS.map((direction) => (
                                    <label
                                        key={direction.value}
                                        className={`flex - 1 flex items - center gap - 2 p - 3 rounded - lg border cursor - pointer text - center transition - all ${formData.roundingDirection === direction.value
                                            ? 'border-primary-500 bg-primary-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            } `}
                                    >
                                        <input
                                            type="radio"
                                            name="roundingDirection"
                                            value={direction.value}
                                            checked={formData.roundingDirection === direction.value}
                                            onChange={(e) => setFormData({ ...formData, roundingDirection: e.target.value })}
                                            className="text-primary-600"
                                        />
                                        <div>
                                            <span className="text-sm font-medium text-gray-900">{direction.label}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Jitter Control */}
                    <div className="card p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Settings className="h-5 w-5 text-purple-600" />
                            <h2 className="text-lg font-semibold text-gray-900">Control de Variación</h2>
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200 mb-4">
                            <Info className="h-5 w-5 text-purple-600 mt-0.5" />
                            <p className="text-sm text-purple-800">
                                Evitá notificaciones constantes por pequeñas variaciones en el dólar.
                                Solo te avisamos cuando el cambio supera el umbral que configures.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="threshold" className="label mb-2 block">
                                Umbral de notificación (%)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    id="threshold"
                                    type="number"
                                    min="1"
                                    max="20"
                                    step="0.5"
                                    value={formData.autoUpdateThreshold || 5}
                                    onChange={(e) => setFormData({ ...formData, autoUpdateThreshold: parseFloat(e.target.value) || 5 })}
                                    className="input w-32"
                                />
                                <span className="text-sm text-gray-500">
                                    Notificar solo cuando la cotización cambie más del {formData.autoUpdateThreshold || 5}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex items-center justify-end gap-4">
                        {isSaved && (
                            <span className="flex items-center gap-1 text-green-600 text-sm">
                                <CheckCircle className="h-4 w-4" />
                                Guardado
                            </span>
                        )}
                        <button
                            type="submit"
                            disabled={saveMutation.isPending}
                            className="btn-primary"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {saveMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
