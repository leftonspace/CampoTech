'use client';

/**
 * PerVisitQuoteBreakdown Component
 * =================================
 * Displays line items grouped by visit for multi-visit jobs.
 * Shows subtotals per visit and allows visual tracking of what
 * was billed on each visit.
 */

import { useQuery } from '@tanstack/react-query';
import { Calendar, Package, ChevronDown, ChevronUp, CheckCircle, Clock } from 'lucide-react';
import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

interface Visit {
    id: string;
    visitNumber: number;
    scheduledDate: string | null;
    completedAt: string | null;
    status: string;
    lineItems: LineItem[];
    actualPrice: number | null;
    notes: string | null;
}

interface Props {
    jobId: string;
    durationType?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Sin programar';
    return new Intl.DateTimeFormat('es-AR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date(dateString));
};

const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
    }).format(amount);
};

const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
        SCHEDULED: { label: 'Programada', className: 'bg-blue-100 text-blue-700' },
        IN_PROGRESS: { label: 'En progreso', className: 'bg-amber-100 text-amber-700' },
        COMPLETED: { label: 'Completada', className: 'bg-green-100 text-green-700' },
        CANCELLED: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
        PENDING: { label: 'Pendiente', className: 'bg-gray-100 text-gray-700' },
    };

    const config = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
            {config.label}
        </span>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function PerVisitQuoteBreakdown({ jobId, durationType }: Props) {
    const [expandedVisits, setExpandedVisits] = useState<Set<string>>(new Set());

    const { data: visitsResponse, isLoading } = useQuery({
        queryKey: ['job-visits-with-items', jobId],
        queryFn: async () => {
            const res = await fetch(`/api/jobs/${jobId}/visits?includeLineItems=true`);
            if (!res.ok) throw new Error('Failed to fetch visits');
            return res.json();
        },
        enabled: !!jobId && durationType === 'MULTI_VISIT',
    });

    // Don't show for single-visit jobs
    if (durationType !== 'MULTI_VISIT') return null;

    // Loading state
    if (isLoading) {
        return (
            <div className="card p-4">
                <div className="animate-pulse space-y-3">
                    <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-20 bg-gray-100 rounded"></div>
                    <div className="h-20 bg-gray-100 rounded"></div>
                </div>
            </div>
        );
    }

    const visits: Visit[] = visitsResponse?.data || [];

    // No visits to show
    if (visits.length === 0) return null;

    const toggleVisit = (visitId: string) => {
        setExpandedVisits(prev => {
            const next = new Set(prev);
            if (next.has(visitId)) {
                next.delete(visitId);
            } else {
                next.add(visitId);
            }
            return next;
        });
    };

    // Calculate grand total from all visits
    const grandTotal = visits.reduce((sum, visit) => {
        const visitTotal = visit.lineItems?.reduce((s, item) => s + item.total, 0) || 0;
        return sum + visitTotal;
    }, 0);

    const completedVisits = visits.filter(v => v.status === 'COMPLETED').length;

    return (
        <div className="card overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-emerald-600" />
                        <h3 className="font-semibold text-gray-900">Desglose por Visita</h3>
                    </div>
                    <div className="text-sm text-gray-600">
                        <span className="font-medium text-emerald-700">{completedVisits}</span>
                        <span className="text-gray-400"> / </span>
                        <span>{visits.length} visitas</span>
                    </div>
                </div>
            </div>

            {/* Visits List */}
            <div className="divide-y divide-gray-100">
                {visits.map((visit, index) => {
                    const isExpanded = expandedVisits.has(visit.id);
                    const visitTotal = visit.lineItems?.reduce((sum, item) => sum + item.total, 0) || 0;
                    const isCompleted = visit.status === 'COMPLETED';

                    return (
                        <div key={visit.id} className="group">
                            {/* Visit Header */}
                            <button
                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                                onClick={() => toggleVisit(visit.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCompleted
                                            ? 'bg-emerald-100 text-emerald-600'
                                            : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {isCompleted ? (
                                            <CheckCircle className="h-5 w-5" />
                                        ) : (
                                            <span className="text-sm font-semibold">{index + 1}</span>
                                        )}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900">
                                                Visita {visit.visitNumber || index + 1}
                                            </span>
                                            {getStatusBadge(visit.status)}
                                        </div>
                                        <div className="flex items-center gap-1 text-sm text-gray-500">
                                            <Calendar className="h-3.5 w-3.5" />
                                            {formatDate(visit.scheduledDate)}
                                            {visit.lineItems?.length > 0 && (
                                                <span className="ml-2 text-gray-400">
                                                    • {visit.lineItems.length} item{visit.lineItems.length !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className={`font-semibold ${visitTotal > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                        {visitTotal > 0 ? formatCurrency(visitTotal) : '—'}
                                    </span>
                                    {isExpanded ? (
                                        <ChevronUp className="h-5 w-5 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="h-5 w-5 text-gray-400" />
                                    )}
                                </div>
                            </button>

                            {/* Expanded Line Items */}
                            {isExpanded && (
                                <div className="px-4 pb-4 bg-gray-50">
                                    {visit.lineItems?.length > 0 ? (
                                        <div className="space-y-2 pt-2">
                                            {visit.lineItems.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-100"
                                                >
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-800">
                                                            {item.description}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {item.quantity} × {formatCurrency(item.unitPrice)}
                                                        </p>
                                                    </div>
                                                    <span className="text-sm font-semibold text-gray-700">
                                                        {formatCurrency(item.total)}
                                                    </span>
                                                </div>
                                            ))}

                                            {/* Visit Subtotal */}
                                            <div className="flex justify-between pt-2 mt-2 border-t border-gray-200">
                                                <span className="text-sm font-medium text-gray-600">
                                                    Subtotal Visita {visit.visitNumber || index + 1}
                                                </span>
                                                <span className="font-semibold text-emerald-600">
                                                    {formatCurrency(visitTotal)}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-4 text-center text-sm text-gray-500">
                                            <Clock className="h-5 w-5 mx-auto mb-2 text-gray-300" />
                                            <p>Sin items registrados para esta visita</p>
                                        </div>
                                    )}

                                    {/* Visit Notes */}
                                    {visit.notes && (
                                        <div className="mt-3 p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
                                            <strong>Notas:</strong> {visit.notes}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Grand Total Footer */}
            {grandTotal > 0 && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">Total del Proyecto</span>
                        <span className="text-lg font-bold text-emerald-600">
                            {formatCurrency(grandTotal)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PerVisitQuoteBreakdown;
