'use client';

/**
 * MultiVisitProgress Component
 * ============================
 * Visual progress indicator for multi-visit jobs.
 * Shows completed vs total visits with a progress bar
 * and individual visit status indicators.
 */

import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Circle, Clock, AlertCircle, Calendar } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Visit {
    id: string;
    visitNumber: number;
    scheduledDate: string | null;
    completedAt: string | null;
    status: string;
}

interface Props {
    jobId: string;
    durationType?: string;
    // Optional: pass visits directly if already fetched
    visits?: Visit[];
    // Compact mode for cards/list views
    compact?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const formatDate = (dateString: string | null): string => {
    if (!dateString) return '';
    return new Intl.DateTimeFormat('es-AR', {
        day: 'numeric',
        month: 'short',
    }).format(new Date(dateString));
};

const getVisitStatus = (visit: Visit) => {
    if (visit.status === 'COMPLETED' || visit.completedAt) {
        return {
            icon: CheckCircle,
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-500',
            label: 'Completada',
        };
    }
    if (visit.status === 'IN_PROGRESS') {
        return {
            icon: Clock,
            color: 'text-amber-500',
            bgColor: 'bg-amber-500',
            label: 'En progreso',
        };
    }
    if (visit.status === 'CANCELLED') {
        return {
            icon: AlertCircle,
            color: 'text-red-400',
            bgColor: 'bg-red-400',
            label: 'Cancelada',
        };
    }
    // SCHEDULED, PENDING, or default
    return {
        icon: Circle,
        color: 'text-gray-300',
        bgColor: 'bg-gray-300',
        label: 'Pendiente',
    };
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function MultiVisitProgress({ jobId, durationType, visits: propVisits, compact = false }: Props) {
    // Fetch visits if not provided
    const { data: fetchedVisits, isLoading } = useQuery({
        queryKey: ['job-visits-progress', jobId],
        queryFn: async () => {
            const res = await fetch(`/api/jobs/${jobId}/visits`);
            if (!res.ok) throw new Error('Failed to fetch visits');
            return res.json();
        },
        enabled: !!jobId && durationType === 'MULTI_VISIT' && !propVisits,
    });

    // Don't show for single-visit jobs
    if (durationType !== 'MULTI_VISIT') return null;

    const visits: Visit[] = propVisits || fetchedVisits?.data || [];

    // Loading state
    if (isLoading && !propVisits) {
        return (
            <div className="animate-pulse flex items-center gap-2">
                <div className="h-2 w-24 bg-gray-200 rounded-full"></div>
                <div className="h-4 w-12 bg-gray-200 rounded"></div>
            </div>
        );
    }

    // No visits to show
    if (visits.length === 0) return null;

    const totalVisits = visits.length;
    const completedVisits = visits.filter(
        (v) => v.status === 'COMPLETED' || v.completedAt
    ).length;
    const progressPercent = totalVisits > 0 ? (completedVisits / totalVisits) * 100 : 0;
    const allCompleted = completedVisits === totalVisits;

    // Compact mode: just progress bar and count
    if (compact) {
        return (
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${allCompleted ? 'bg-emerald-500' : 'bg-blue-500'
                            }`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                    {completedVisits}/{totalVisits}
                </span>
            </div>
        );
    }

    // Full mode with visit indicators
    return (
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <h3 className="font-medium text-gray-900 text-sm">Progreso del Proyecto</h3>
                </div>
                <span className={`text-sm font-semibold ${allCompleted ? 'text-emerald-600' : 'text-gray-600'}`}>
                    {completedVisits}/{totalVisits} visitas
                </span>
            </div>

            {/* Progress Bar */}
            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${allCompleted
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                            : 'bg-gradient-to-r from-blue-400 to-blue-500'
                        }`}
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Visit Indicators */}
            <div className="flex items-center justify-between">
                {visits.map((visit, index) => {
                    const status = getVisitStatus(visit);
                    const StatusIcon = status.icon;
                    const isLast = index === visits.length - 1;

                    return (
                        <div key={visit.id} className="flex items-center flex-1">
                            {/* Visit Circle */}
                            <div className="relative group">
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center ${visit.status === 'COMPLETED' || visit.completedAt
                                            ? 'bg-emerald-100'
                                            : visit.status === 'IN_PROGRESS'
                                                ? 'bg-amber-100'
                                                : 'bg-gray-100'
                                        }`}
                                >
                                    <StatusIcon className={`h-4 w-4 ${status.color}`} />
                                </div>

                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                    V{visit.visitNumber || index + 1}
                                    {visit.scheduledDate && ` · ${formatDate(visit.scheduledDate)}`}
                                    <br />
                                    <span className="text-gray-300">{status.label}</span>
                                </div>
                            </div>

                            {/* Connector Line */}
                            {!isLast && (
                                <div
                                    className={`flex-1 h-0.5 mx-1 ${(visit.status === 'COMPLETED' || visit.completedAt) &&
                                            (visits[index + 1].status === 'COMPLETED' || visits[index + 1].completedAt)
                                            ? 'bg-emerald-300'
                                            : 'bg-gray-200'
                                        }`}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Status Message */}
            {allCompleted && (
                <div className="mt-3 flex items-center justify-center gap-1.5 text-sm text-emerald-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Proyecto completado</span>
                </div>
            )}
        </div>
    );
}

export default MultiVisitProgress;
