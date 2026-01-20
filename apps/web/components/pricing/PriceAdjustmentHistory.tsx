'use client';

/**
 * Price Adjustment History Component
 * 
 * Phase 5 - Dynamic Pricing (Jan 2026)
 * 
 * Shows history of bulk price adjustments for audit trail and compliance.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    History,
    TrendingUp,
    User,
    ChevronDown,
    ChevronUp,
    FileText,
    RefreshCw,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AdjustmentEvent {
    id: string;
    indexSource: string;
    indexPeriod: string;
    indexRate: number;
    extraPercent: number;
    totalAdjustment: number;
    adjustmentType: string;
    specialtyFilter: string | null;
    itemsAffected: number;
    totalValueBefore: number;
    totalValueAfter: number;
    appliedAt: string;
    appliedBy: {
        id: string;
        name: string;
    };
    notes: string | null;
}

interface PriceAdjustmentHistoryProps {
    limit?: number;
    compact?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const SOURCE_LABELS: Record<string, string> = {
    CAC_ICC_GENERAL: 'ICC General (CAC)',
    CAC_ICC_MANO_OBRA: 'ICC Mano de Obra (CAC)',
    CAC_ICC_MATERIALES: 'ICC Materiales (CAC)',
    INDEC_IPC: 'IPC General (INDEC)',
    INDEC_IPC_VIVIENDA: 'IPC Vivienda (INDEC)',
    CUSTOM: 'Ajuste Manual',
};

const SCOPE_LABELS: Record<string, string> = {
    ALL: 'Todos los ítems',
    SERVICES: 'Solo servicios',
    PRODUCTS: 'Solo productos',
    BY_SPECIALTY: 'Por especialidad',
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

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatPeriod(period: string): string {
    const [year, month] = period.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${months[parseInt(month) - 1]} ${year}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function PriceAdjustmentHistory({ limit = 10, compact: _compact = false }: PriceAdjustmentHistoryProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['price-adjustment-history', limit],
        queryFn: async () => {
            const res = await fetch(`/api/settings/pricebook/history?limit=${limit}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            return data.data as { events: AdjustmentEvent[] };
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 text-sm">
                Error al cargar historial: {error.message}
            </div>
        );
    }

    const events = data?.events || [];

    if (events.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <History className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No hay ajustes de precios registrados</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {events.map((event) => (
                <div
                    key={event.id}
                    className="rounded-lg border bg-white overflow-hidden"
                >
                    {/* Summary Row */}
                    <button
                        onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-green-100 p-2">
                                <TrendingUp className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">
                                    {SOURCE_LABELS[event.indexSource] || event.indexSource}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {formatPeriod(event.indexPeriod)} · {event.itemsAffected} ítems
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="font-bold text-green-600">+{event.totalAdjustment.toFixed(1)}%</p>
                                <p className="text-xs text-gray-500">{formatDate(event.appliedAt)}</p>
                            </div>
                            {expandedId === event.id ? (
                                <ChevronUp className="h-5 w-5 text-gray-400" />
                            ) : (
                                <ChevronDown className="h-5 w-5 text-gray-400" />
                            )}
                        </div>
                    </button>

                    {/* Expanded Details */}
                    {expandedId === event.id && (
                        <div className="border-t px-4 py-3 bg-gray-50 space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500">Índice aplicado</p>
                                    <p className="font-medium">{event.indexRate.toFixed(1)}%</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Extra agregado</p>
                                    <p className="font-medium">{event.extraPercent.toFixed(1)}%</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Alcance</p>
                                    <p className="font-medium">
                                        {SCOPE_LABELS[event.adjustmentType] || event.adjustmentType}
                                        {event.specialtyFilter && ` (${event.specialtyFilter})`}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Aplicado por</p>
                                    <p className="font-medium flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {event.appliedBy.name}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 pt-2 border-t text-sm">
                                <div>
                                    <span className="text-gray-500">Total antes:</span>{' '}
                                    <span className="font-medium">{formatCurrency(event.totalValueBefore)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Total después:</span>{' '}
                                    <span className="font-medium text-green-600">{formatCurrency(event.totalValueAfter)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Diferencia:</span>{' '}
                                    <span className="font-medium text-green-600">
                                        +{formatCurrency(event.totalValueAfter - event.totalValueBefore)}
                                    </span>
                                </div>
                            </div>

                            {event.notes && (
                                <div className="flex items-start gap-2 text-sm text-gray-600 pt-2 border-t">
                                    <FileText className="h-4 w-4 mt-0.5" />
                                    <p>{event.notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
