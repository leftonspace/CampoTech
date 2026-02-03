'use client';

/**
 * Inflation Adjustment Modal
 * 
 * Phase 5 - Dynamic Pricing (Jan 2026)
 * 
 * Modal for organization owners to apply CAC/INDEC index adjustments
 * to their pricebook items with preview and smart rounding.
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import {
    X,
    TrendingUp,
    Calculator,
    CheckCircle,
    AlertCircle,
    Info,
    RefreshCw,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PriceItem {
    id: string;
    name: string;
    description?: string;
    type: 'service' | 'product';
    price: number;
    unit?: string;
    specialty?: string | null;
    priceCurrency?: 'ARS' | 'USD';
    priceInUsd?: number | null;
    isActive: boolean;
}

interface InflationIndex {
    source: string;
    label: string;
    period: string;
    rate: number;
    isRecommended?: boolean;
}

interface AdjustmentPreview {
    id: string;
    name: string;
    type: 'service' | 'product';
    specialty?: string | null;
    priceCurrency?: 'ARS' | 'USD';
    originalPrice: number;
    adjustedPrice: number;
    difference: number;
    percentChange: number;
    excluded: boolean;
    excludeReason?: string;
    hasOverride?: boolean; // User manually changed this item's price
}

// Map of item ID to overridden price (absolute value)
type PriceOverrides = Record<string, number>;

interface InflationAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: PriceItem[];
    onApply: (data: AdjustmentSubmission) => Promise<void>;
    isLoading?: boolean;
}

export interface AdjustmentSubmission {
    indexSource: string;
    indexPeriod: string;
    indexRate: number;
    extraPercent: number;
    scope: AdjustmentScope;
    specialtyFilter?: string;
    typeFilter?: 'service' | 'product' | 'all';
    roundingStrategy: string;
    roundingDirection: string;
    itemIds: string[];
}

type AdjustmentScope = 'all' | 'services' | 'products' | 'specialty';

// Cumulative drift tracking from API
interface CumulativeDrift {
    adjustmentCount: number;
    officialInflation: number; // Sum of all index rates applied
    actualAdjustment: number;  // Sum of all actual adjustments (includes rounding)
    drift: number;             // actualAdjustment - officialInflation
    firstAdjustmentAt: string;
    lastAdjustmentAt: string;
}

interface InflationApiResponse {
    latest: InflationIndex[];
    cumulativeDrift: CumulativeDrift | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const SPECIALTY_OPTIONS = [
    { value: 'PLOMERO', label: 'Plomero' },
    { value: 'ELECTRICISTA', label: 'Electricista' },
    { value: 'GASISTA', label: 'Gasista' },
    { value: 'CLIMATIZACION', label: 'Climatización' },
    { value: 'CONSTRUCCION', label: 'Construcción' },
    { value: 'OTRO', label: 'Otro' },
];

const ROUNDING_STRATEGIES = [
    { value: 'NO_ROUNDING', label: 'Sin redondeo', example: '$16,020 → $16,020' },
    { value: 'ROUND_100', label: 'A $100', example: '$16,020 → $16,000' },
    { value: 'ROUND_500', label: 'A $500', example: '$16,020 → $16,000 (Recomendado)', recommended: true },
    { value: 'ROUND_1000', label: 'A $1,000', example: '$16,020 → $16,000' },
];

const ROUNDING_DIRECTIONS = [
    { value: 'NEAREST', label: 'Al más cercano' },
    { value: 'UP', label: 'Siempre arriba' },
    { value: 'DOWN', label: 'Siempre abajo' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function applyRounding(price: number, strategy: string, direction: string): number {
    const units: Record<string, number> = {
        ROUND_100: 100,
        ROUND_500: 500,
        ROUND_1000: 1000,
        ROUND_5000: 5000,
        NO_ROUNDING: 1,
    };

    const unit = units[strategy] || 1;
    if (unit === 1) return Math.round(price * 100) / 100;

    switch (direction) {
        case 'UP':
            return Math.ceil(price / unit) * unit;
        case 'DOWN':
            return Math.floor(price / unit) * unit;
        default:
            return Math.round(price / unit) * unit;
    }
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function InflationAdjustmentModal({
    isOpen,
    onClose,
    items,
    onApply,
    isLoading = false,
}: InflationAdjustmentModalProps) {
    // Index selection
    const [selectedIndex, setSelectedIndex] = useState<InflationIndex | null>(null);
    const [customPercent, setCustomPercent] = useState(0); // Start at 0 - user must enter their own %

    // Scope selection
    const [scope, setScope] = useState<AdjustmentScope>('all');
    const [specialtyFilter, setSpecialtyFilter] = useState<string>('');

    // Rounding settings
    const [roundingStrategy, setRoundingStrategy] = useState('NO_ROUNDING');
    const [roundingDirection, setRoundingDirection] = useState('NEAREST');

    // Preview state
    const [previews, setPreviews] = useState<AdjustmentPreview[]>([]);

    // Per-item price overrides (user can manually adjust individual prices)
    const [priceOverrides, setPriceOverrides] = useState<PriceOverrides>({});
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingPercentItemId, setEditingPercentItemId] = useState<string | null>(null);

    // Fetch available indices
    const { data: inflationData } = useQuery({
        queryKey: ['inflation-indices'],
        queryFn: async () => {
            const res = await api.settings.inflation.get();
            return res.data as InflationApiResponse;
        },
        enabled: isOpen,
    });

    // Get cumulative drift from API
    const cumulativeDrift = inflationData?.cumulativeDrift;

    // Calculate previews when settings change
    useEffect(() => {
        if (!selectedIndex || !items.length) {
            setPreviews([]);
            return;
        }

        // For custom index, use the custom percent
        const effectiveRate = selectedIndex.source === 'CUSTOM' ? customPercent : selectedIndex.rate;
        const totalRate = effectiveRate;
        const multiplier = 1 + totalRate / 100;

        const newPreviews: AdjustmentPreview[] = items
            .filter(item => item.isActive)
            .map(item => {
                // Check scope filtering
                let excluded = false;
                let excludeReason = '';

                // Type filter
                if (scope === 'services' && item.type !== 'service') {
                    excluded = true;
                    excludeReason = 'Solo servicios seleccionados';
                } else if (scope === 'products' && item.type !== 'product') {
                    excluded = true;
                    excludeReason = 'Solo productos seleccionados';
                } else if (scope === 'specialty' && specialtyFilter && item.specialty !== specialtyFilter) {
                    excluded = true;
                    excludeReason = 'Especialidad no coincide';
                }

                // USD items - skip (they adjust via exchange rate instead)
                if (item.priceCurrency === 'USD') {
                    excluded = true;
                    excludeReason = 'Precio en USD (se ajusta vía tipo de cambio)';
                }

                const beforeRounding = item.price * multiplier;
                let adjustedPrice = excluded
                    ? item.price
                    : applyRounding(beforeRounding, roundingStrategy, roundingDirection);

                // CRITICAL: When applying positive inflation, never let rounding push 
                // the price BELOW the original. This can happen with aggressive rounding 
                // (e.g., $1,200 + 2.8% = $1,233.60, rounded to $500 nearest = $1,000)
                // In that case, use the next rounding step UP instead.
                if (!excluded && totalRate > 0 && adjustedPrice < item.price) {
                    // Apply UP rounding instead to ensure price doesn't decrease
                    adjustedPrice = applyRounding(beforeRounding, roundingStrategy, 'UP');
                }

                // Check if user has overridden this item's price
                const hasOverride = item.id in priceOverrides;
                const finalPrice = hasOverride ? priceOverrides[item.id] : adjustedPrice;
                const finalDifference = finalPrice - item.price;
                const finalPercentChange = item.price > 0
                    ? ((finalPrice - item.price) / item.price) * 100
                    : 0;

                return {
                    id: item.id,
                    name: item.name,
                    type: item.type,
                    specialty: item.specialty,
                    priceCurrency: item.priceCurrency,
                    originalPrice: item.price,
                    adjustedPrice: finalPrice,
                    difference: finalDifference,
                    percentChange: finalPercentChange,
                    excluded,
                    excludeReason,
                    hasOverride,
                };
            });

        setPreviews(newPreviews);
    }, [items, selectedIndex, customPercent, scope, specialtyFilter, roundingStrategy, roundingDirection, priceOverrides]);

    // Handle setting a price override for an item
    const handlePriceOverride = (itemId: string, value: string) => {
        const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
        if (!isNaN(numValue) && numValue >= 0) {
            setPriceOverrides(prev => ({
                ...prev,
                [itemId]: numValue,
            }));
        }
        setEditingItemId(null);
    };

    // Remove override for an item
    const clearOverride = (itemId: string) => {
        setPriceOverrides(prev => {
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
    };

    // Handle setting override via percentage (converts % to absolute price)
    const handlePercentOverride = (itemId: string, percentValue: string, originalPrice: number) => {
        const percent = parseFloat(percentValue.replace(/[^0-9.-]/g, ''));
        if (!isNaN(percent) && originalPrice > 0) {
            // Convert % to absolute price
            const newPrice = originalPrice * (1 + percent / 100);
            setPriceOverrides(prev => ({
                ...prev,
                [itemId]: Math.round(newPrice), // Round to nearest peso
            }));
        }
        setEditingPercentItemId(null);
    };

    // Count overrides
    const overrideCount = Object.keys(priceOverrides).length;

    // Calculate summary stats
    const includedItems = previews.filter(p => !p.excluded);
    const excludedItems = previews.filter(p => p.excluded);
    const usdItems = previews.filter(p => p.excludeReason?.includes('USD'));
    const otherExcludedItems = excludedItems.filter(p => !p.excludeReason?.includes('USD'));

    // For average calculation, only include items with actual prices (>$0)
    // $0 items are still shown in the list, but don't affect the average
    const itemsWithPrices = includedItems.filter(p => p.originalPrice > 0);
    const zeroPricedItems = includedItems.filter(p => p.originalPrice === 0);

    const avgPercentChange = itemsWithPrices.length > 0
        ? itemsWithPrices.reduce((sum, p) => sum + p.percentChange, 0) / itemsWithPrices.length
        : 0;

    // Calculate the selected index rate and rounding drift
    const selectedIndexRate = selectedIndex
        ? (selectedIndex.source === 'CUSTOM' ? customPercent : selectedIndex.rate)
        : 0;
    const roundingDrift = avgPercentChange - selectedIndexRate;
    const hasSignificantDrift = Math.abs(roundingDrift) > 0.1; // Show when drift exceeds 0.1%

    // Handle apply
    const handleApply = async () => {
        if (!selectedIndex) return;

        await onApply({
            indexSource: selectedIndex.source,
            indexPeriod: selectedIndex.period,
            indexRate: selectedIndex.source === 'CUSTOM' ? customPercent : selectedIndex.rate,
            extraPercent: 0, // No longer used separately
            scope,
            specialtyFilter: scope === 'specialty' ? specialtyFilter : undefined,
            typeFilter: scope === 'services' ? 'service' : scope === 'products' ? 'product' : 'all',
            roundingStrategy,
            roundingDirection,
            itemIds: includedItems.map(p => p.id),
        });
    };

    if (!isOpen) return null;

    // Use portal to render at document root for proper backdrop coverage
    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl mx-8">
                {/* Header */}
                <div className="flex items-center justify-between border-b px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-green-100 p-2">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">
                                Ajuste por Inflación
                            </h2>
                            <p className="text-sm text-gray-500">
                                Aplicar índice CAC/INDEC a tu lista de precios
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded p-1 hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-8 py-6">
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                        {/* Settings Column */}
                        <div className="space-y-6 lg:col-span-1">
                            {/* Index Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Índice a Aplicar
                                </label>
                                <div className="space-y-2">
                                    {inflationData?.latest?.map((index) => (
                                        <label
                                            key={index.source}
                                            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${selectedIndex?.source === index.source
                                                ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="indexSource"
                                                checked={selectedIndex?.source === index.source}
                                                onChange={() => setSelectedIndex(index)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900">{index.label}</span>
                                                    {index.isRecommended && (
                                                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                                            Recomendado
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-500">
                                                    {index.period}: <strong className="text-green-600">{index.rate.toFixed(1)}%</strong>
                                                </p>
                                            </div>
                                        </label>
                                    ))}

                                    {/* Custom percentage option */}
                                    <label
                                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${selectedIndex?.source === 'CUSTOM'
                                            ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="indexSource"
                                            checked={selectedIndex?.source === 'CUSTOM'}
                                            onChange={() => setSelectedIndex({
                                                source: 'CUSTOM',
                                                label: 'Personalizado',
                                                period: new Date().toISOString().slice(0, 7),
                                                rate: customPercent,
                                            })}
                                            className="mt-1"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900">Personalizado</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.5"
                                                    value={customPercent === 0 ? '' : customPercent}
                                                    placeholder="0"
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        setCustomPercent(val);
                                                        if (selectedIndex?.source === 'CUSTOM') {
                                                            setSelectedIndex({
                                                                source: 'CUSTOM',
                                                                label: 'Personalizado',
                                                                period: new Date().toISOString().slice(0, 7),
                                                                rate: val,
                                                            });
                                                        }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-16 rounded border px-2 py-1 text-sm text-right appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    style={{ MozAppearance: 'textfield' }}
                                                />
                                                <span className="text-sm text-gray-500">%</span>
                                            </div>
                                        </div>
                                    </label>

                                    {!inflationData?.latest?.length && (
                                        <div className="text-center py-4 text-gray-500">
                                            <Info className="h-5 w-5 mx-auto mb-2" />
                                            <p className="text-sm">No hay índices disponibles</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Rounding Settings */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Calculator className="h-4 w-4 inline mr-1" />
                                    El Redondeo
                                </label>
                                <select
                                    value={roundingStrategy}
                                    onChange={(e) => setRoundingStrategy(e.target.value)}
                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                >
                                    {ROUNDING_STRATEGIES.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label} {opt.recommended ? '★' : ''}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={roundingDirection}
                                    onChange={(e) => setRoundingDirection(e.target.value)}
                                    className="w-full mt-2 rounded-lg border px-3 py-2 text-sm"
                                >
                                    {ROUNDING_DIRECTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Preview Column */}
                        <div className="lg:col-span-2">
                            {/* Summary Header - Inline */}
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-medium text-gray-700">Resumen del Ajuste</h3>
                                {selectedIndex && (
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="text-gray-500">
                                            <strong className="text-gray-900">{includedItems.length}</strong> ítems
                                        </span>
                                        <span className="text-gray-500">
                                            Índice: <strong className="text-gray-700">{selectedIndexRate.toFixed(1)}%</strong>
                                        </span>
                                        <span className="text-gray-500">
                                            Real: <strong className="text-green-600">+{avgPercentChange.toFixed(1)}%</strong>
                                        </span>
                                        {hasSignificantDrift && (
                                            <span className={`flex items-center gap-1 ${roundingDrift > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                                <AlertCircle className="h-3 w-3" />
                                                {roundingDrift > 0 ? '+' : ''}{roundingDrift.toFixed(1)}% por redondeo
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Info messages (only show when there are special cases) */}
                            {selectedIndex && (usdItems.length > 0 || otherExcludedItems.length > 0 || zeroPricedItems.length > 0 || overrideCount > 0) && (
                                <div className="mb-3 text-xs space-y-1">
                                    {usdItems.length > 0 && (
                                        <div className="flex items-center gap-1 text-blue-600">
                                            <Info className="h-3 w-3" />
                                            <span>{usdItems.length} ítem(s) en USD</span>
                                        </div>
                                    )}
                                    {otherExcludedItems.length > 0 && (
                                        <div className="flex items-center gap-1 text-amber-600">
                                            <AlertCircle className="h-3 w-3" />
                                            <span>{otherExcludedItems.length} ítem(s) excluidos por filtro</span>
                                        </div>
                                    )}
                                    {zeroPricedItems.length > 0 && (
                                        <div className="flex items-center gap-1 text-gray-500">
                                            <Info className="h-3 w-3" />
                                            <span>{zeroPricedItems.length} ítem(s) sin precio</span>
                                        </div>
                                    )}
                                    {overrideCount > 0 && (
                                        <div className="flex items-center gap-1 text-blue-600">
                                            <CheckCircle className="h-3 w-3" />
                                            <span>{overrideCount} precio(s) ajustado(s) manualmente</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Cumulative Drift Tracking - Historical data */}
                            {cumulativeDrift && cumulativeDrift.adjustmentCount > 0 && (
                                <div className={`mb-3 px-3 py-2 rounded-lg text-xs ${cumulativeDrift.drift > 1
                                    ? 'bg-amber-50 border border-amber-200'
                                    : cumulativeDrift.drift < -1
                                        ? 'bg-green-50 border border-green-200'
                                        : 'bg-gray-50 border border-gray-200'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600 flex items-center gap-1">
                                            <TrendingUp className="h-3 w-3" />
                                            Historial de ajustes ({cumulativeDrift.adjustmentCount} aplicados)
                                        </span>
                                        <span className={`font-medium ${cumulativeDrift.drift > 1
                                            ? 'text-amber-600'
                                            : cumulativeDrift.drift < -1
                                                ? 'text-green-600'
                                                : 'text-gray-600'
                                            }`}>
                                            {cumulativeDrift.drift > 0 ? '+' : ''}{cumulativeDrift.drift.toFixed(1)}% diferencia acumulada
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1 text-gray-500">
                                        <span>Índices oficiales: {cumulativeDrift.officialInflation.toFixed(1)}%</span>
                                        <span>Ajustes aplicados: {cumulativeDrift.actualAdjustment.toFixed(1)}%</span>
                                    </div>
                                </div>
                            )}

                            {/* Preview Table */}
                            <div className="rounded-lg border overflow-hidden">
                                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium text-gray-500">
                                                    <div className="flex items-center gap-2">
                                                        <span>Ítem</span>
                                                        <select
                                                            value={scope}
                                                            onChange={(e) => setScope(e.target.value as AdjustmentScope)}
                                                            className="text-xs font-normal bg-gray-100 border-0 rounded px-2 py-1 cursor-pointer hover:bg-gray-200"
                                                        >
                                                            <option value="all">Todos</option>
                                                            <option value="services">Servicios</option>
                                                            <option value="products">Productos</option>
                                                            <option value="specialty">Especialidad</option>
                                                        </select>
                                                        {scope === 'specialty' && (
                                                            <select
                                                                value={specialtyFilter}
                                                                onChange={(e) => setSpecialtyFilter(e.target.value)}
                                                                className="text-xs font-normal bg-gray-100 border-0 rounded px-2 py-1 cursor-pointer hover:bg-gray-200"
                                                            >
                                                                <option value="">Todas</option>
                                                                {SPECIALTY_OPTIONS.map((opt) => (
                                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                </th>
                                                <th className="px-3 py-2 text-right font-medium text-gray-500">Actual</th>
                                                <th className="px-3 py-2 text-right font-medium text-gray-500" title="Clic para editar el precio">
                                                    Nuevo
                                                </th>
                                                <th className="px-3 py-2 text-right font-medium text-gray-500" title="Clic para editar el porcentaje">
                                                    Cambio
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {previews.map((preview) => (
                                                <tr
                                                    key={preview.id}
                                                    className={`${preview.excluded ? 'bg-gray-50 opacity-60' : ''} ${preview.hasOverride ? 'bg-blue-50' : ''}`}
                                                >
                                                    <td className="px-3 py-2">
                                                        <div className="font-medium text-gray-900">
                                                            {preview.name}
                                                            {preview.priceCurrency === 'USD' && (
                                                                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">USD</span>
                                                            )}
                                                            {preview.hasOverride && (
                                                                <span className="ml-2 text-xs text-blue-600">(modificado)</span>
                                                            )}
                                                        </div>
                                                        {preview.excluded && preview.priceCurrency !== 'USD' && (
                                                            <div className="text-xs text-amber-600">{preview.excludeReason}</div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-gray-500">
                                                        {formatCurrency(preview.originalPrice)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {editingItemId === preview.id ? (
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                defaultValue={preview.adjustedPrice}
                                                                autoFocus
                                                                className="w-24 text-right rounded border px-2 py-1 text-sm appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                style={{ MozAppearance: 'textfield' }}
                                                                onBlur={(e) => handlePriceOverride(preview.id, e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        handlePriceOverride(preview.id, (e.target as HTMLInputElement).value);
                                                                    } else if (e.key === 'Escape') {
                                                                        setEditingItemId(null);
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-1">
                                                                {preview.hasOverride && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => clearOverride(preview.id)}
                                                                        className="text-xs text-gray-400 hover:text-red-500"
                                                                        title="Revertir"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => !preview.excluded && setEditingItemId(preview.id)}
                                                                    disabled={preview.excluded}
                                                                    className={`font-medium ${preview.excluded
                                                                        ? 'text-gray-400 cursor-not-allowed'
                                                                        : preview.hasOverride
                                                                            ? 'text-blue-600 hover:underline cursor-pointer'
                                                                            : 'text-green-600 hover:underline cursor-pointer'
                                                                        }`}
                                                                >
                                                                    {formatCurrency(preview.adjustedPrice)}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {preview.excluded ? (
                                                            <span className="text-gray-400">—</span>
                                                        ) : editingPercentItemId === preview.id ? (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    defaultValue={preview.percentChange.toFixed(1)}
                                                                    autoFocus
                                                                    className="w-16 text-right rounded border px-1 py-1 text-sm appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    style={{ MozAppearance: 'textfield' }}
                                                                    onBlur={(e) => handlePercentOverride(preview.id, e.target.value, preview.originalPrice)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            handlePercentOverride(preview.id, (e.target as HTMLInputElement).value, preview.originalPrice);
                                                                        } else if (e.key === 'Escape') {
                                                                            setEditingPercentItemId(null);
                                                                        }
                                                                    }}
                                                                />
                                                                <span className="text-gray-500">%</span>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => preview.originalPrice > 0 && setEditingPercentItemId(preview.id)}
                                                                disabled={preview.originalPrice === 0}
                                                                className={`hover:underline cursor-pointer ${preview.originalPrice === 0
                                                                    ? 'text-gray-400 cursor-not-allowed'
                                                                    : preview.hasOverride
                                                                        ? 'text-blue-600'
                                                                        : 'text-green-600'
                                                                    }`}
                                                            >
                                                                {preview.percentChange >= 0
                                                                    ? `+${preview.percentChange.toFixed(1)}%`
                                                                    : `${preview.percentChange.toFixed(1)}%`
                                                                }
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {previews.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-3 py-8 text-center text-gray-500">
                                                        Seleccioná un índice para ver la vista previa
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t px-6 py-4 bg-gray-50">
                    <div className="text-sm text-gray-500">
                        {selectedIndex && (
                            <span>
                                Índice: <strong>{selectedIndex.label}</strong> ({selectedIndex.source === 'CUSTOM' ? customPercent : selectedIndex.rate}%)
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={!selectedIndex || includedItems.length === 0 || isLoading}
                            className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCircle className="h-4 w-4" />
                            )}
                            Aplicar Ajuste ({includedItems.length} ítems)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // Render portal to document body for proper full-screen backdrop
    if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
    }

    return modalContent;
}
