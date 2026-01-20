'use client';

/**
 * Items Excluded Warning Component
 * 
 * Phase 6 - Dynamic Pricing (Jan 2026)
 * 
 * Shows a detailed breakdown of which items are excluded from
 * an inflation adjustment and why.
 */

import { useState } from 'react';
import {
    AlertCircle,
    ChevronDown,
    ChevronUp,
    DollarSign,
    Filter,
    Tag,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExcludedItem {
    id: string;
    name: string;
    price: number;
    reason: string;
    reasonCode: 'USD_CURRENCY' | 'INACTIVE' | 'SCOPE_FILTER' | 'SPECIALTY_FILTER' | 'OTHER';
}

interface ItemsExcludedWarningProps {
    items: ExcludedItem[];
    totalItems: number;
    className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const REASON_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    USD_CURRENCY: DollarSign,
    SCOPE_FILTER: Filter,
    SPECIALTY_FILTER: Tag,
    INACTIVE: AlertCircle,
    OTHER: AlertCircle,
};

const REASON_LABELS: Record<string, string> = {
    USD_CURRENCY: 'Precio en USD',
    SCOPE_FILTER: 'Fuera del alcance',
    SPECIALTY_FILTER: 'Especialidad no coincide',
    INACTIVE: 'Ítem inactivo',
    OTHER: 'Otro motivo',
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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

export function ItemsExcludedWarning({
    items,
    totalItems,
    className,
}: ItemsExcludedWarningProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (items.length === 0) return null;

    // Group items by reason
    const byReason = items.reduce((acc, item) => {
        const key = item.reasonCode;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {} as Record<string, ExcludedItem[]>);

    const excludedTotal = items.reduce((sum, i) => sum + i.price, 0);
    const percentExcluded = Math.round((items.length / totalItems) * 100);

    return (
        <div className={`rounded-lg border border-amber-200 bg-amber-50 ${className || ''}`}>
            {/* Summary Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-amber-100 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <span className="font-medium text-amber-900">
                        {items.length} ítem{items.length !== 1 ? 's' : ''} excluido{items.length !== 1 ? 's' : ''} del ajuste
                    </span>
                    <span className="text-sm text-amber-700">
                        ({percentExcluded}% de tu lista)
                    </span>
                </div>
                {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-amber-600" />
                ) : (
                    <ChevronDown className="h-5 w-5 text-amber-600" />
                )}
            </button>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="border-t border-amber-200 p-3 space-y-3">
                    {/* Reason Groups */}
                    {Object.entries(byReason).map(([reasonCode, reasonItems]) => {
                        const Icon = REASON_ICONS[reasonCode] || AlertCircle;
                        const label = REASON_LABELS[reasonCode] || 'Otro motivo';

                        return (
                            <div key={reasonCode} className="rounded bg-white p-3 border border-amber-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon className="h-4 w-4 text-amber-600" />
                                    <span className="font-medium text-gray-900">{label}</span>
                                    <span className="text-xs text-gray-500">({reasonItems.length})</span>
                                </div>
                                <div className="space-y-1 text-sm">
                                    {reasonItems.slice(0, 5).map((item) => (
                                        <div key={item.id} className="flex items-center justify-between text-gray-600">
                                            <span className="truncate flex-1">{item.name}</span>
                                            <span className="ml-2 text-gray-500">{formatCurrency(item.price)}</span>
                                        </div>
                                    ))}
                                    {reasonItems.length > 5 && (
                                        <p className="text-xs text-gray-400">
                                            + {reasonItems.length - 5} más...
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Excluded Total */}
                    <div className="pt-2 border-t border-amber-200 flex items-center justify-between text-sm">
                        <span className="text-amber-700">Total no ajustado:</span>
                        <span className="font-medium text-amber-900">{formatCurrency(excludedTotal)}</span>
                    </div>

                    {/* Tip */}
                    <p className="text-xs text-amber-700 bg-amber-100 rounded p-2">
                        💡 <strong>Tip:</strong> Los ítems en USD se ajustan automáticamente con el tipo de cambio.
                        Podés ajustar el alcance del ajuste para incluir más ítems.
                    </p>
                </div>
            )}
        </div>
    );
}
