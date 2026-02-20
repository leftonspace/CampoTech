'use client';

/**
 * Technician Route Widget
 * ========================
 *
 * Phase 2.3 Task 2.3.6: Dashboard Route Visualization
 *
 * Shows the optimized route for a technician in the dispatch board.
 * Allows dispatchers to:
 * - View current route summary (distance, duration, segments)
 * - Generate/regenerate routes for a technician
 * - Open the route in Google Maps (new tab)
 * - Invalidate stale routes
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import {
    Navigation,
    RefreshCw,
    ExternalLink,
    Route,
    Clock,
    Trash2,
    MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TechnicianRouteWidgetProps {
    technicianId: string;
    technicianName: string;
    date: string; // YYYY-MM-DD
    jobCount: number;
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

function formatDistance(meters: number): string {
    if (meters < 1000) return `${meters}m`;
    const km = (meters / 1000).toFixed(1);
    return `${km} km`;
}

export default function TechnicianRouteWidget({
    technicianId,
    technicianName: _technicianName,
    date,
    jobCount,
}: TechnicianRouteWidgetProps) {
    const queryClient = useQueryClient();
    const [isExpanded, setIsExpanded] = useState(false);

    const { data: routeData, isLoading } = useQuery({
        queryKey: ['technician-route', technicianId, date],
        queryFn: () => api.routes.getToday(technicianId),
        enabled: jobCount > 0,
        staleTime: 60_000,
    });

    const generateMutation = useMutation({
        mutationFn: () => api.routes.generate(technicianId, date),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['technician-route', technicianId],
            });
        },
    });

    const invalidateMutation = useMutation({
        mutationFn: () => api.routes.invalidate(technicianId, date),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['technician-route', technicianId],
            });
        },
    });

    const route = routeData?.data;
    const hasRoute = route && route.totalJobs > 0;
    const isGenerating = generateMutation.isPending;
    const isInvalidating = invalidateMutation.isPending;

    // No jobs = no route widget
    if (jobCount === 0) return null;

    // Loading state
    if (isLoading) {
        return (
            <div className="mt-2 animate-pulse rounded-lg bg-gray-50 p-2">
                <div className="h-3 w-20 rounded bg-gray-200" />
            </div>
        );
    }

    // No route yet - offer generation
    if (!hasRoute) {
        return (
            <button
                onClick={() => generateMutation.mutate()}
                disabled={isGenerating}
                className={cn(
                    'mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-blue-300',
                    'bg-blue-50/50 px-3 py-2 text-xs text-blue-600 transition-all',
                    'hover:border-blue-400 hover:bg-blue-50',
                    isGenerating && 'cursor-wait opacity-60'
                )}
            >
                {isGenerating ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <Route className="h-3.5 w-3.5" />
                )}
                <span className="font-medium">
                    {isGenerating ? 'Generando ruta...' : 'Generar ruta optimizada'}
                </span>
            </button>
        );
    }

    // Route exists - show summary
    return (
        <div className="mt-2 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            {/* Compact Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-blue-100/50"
            >
                <Navigation className="h-3.5 w-3.5 text-blue-600" />
                <span className="font-semibold text-blue-700">
                    {route.totalJobs} trabajo{route.totalJobs !== 1 ? 's' : ''}
                </span>
                {route.totalDistance > 0 && (
                    <>
                        <span className="text-blue-400">•</span>
                        <span className="text-blue-600">
                            {formatDistance(route.totalDistance)}
                        </span>
                    </>
                )}
                {route.totalDuration > 0 && (
                    <>
                        <span className="text-blue-400">•</span>
                        <Clock className="h-3 w-3 text-blue-500" />
                        <span className="text-blue-600">
                            {formatDuration(route.totalDuration)}
                        </span>
                    </>
                )}
                {route.totalSegments > 1 && (
                    <span className="ml-auto rounded-full bg-blue-200 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                        {route.totalSegments} seg
                    </span>
                )}
            </button>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="border-t border-blue-200 px-3 py-2 space-y-2">
                    {/* Segments List */}
                    {route.segments.map((segment, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-2 text-xs text-gray-600"
                        >
                            <MapPin className="h-3 w-3 shrink-0 text-blue-400" />
                            <div className="min-w-0 flex-1">
                                <span className="font-medium text-gray-700">
                                    Tramo {segment.segmentNumber}
                                </span>
                                <span className="ml-1 text-gray-400">
                                    ({segment.jobIds.length} trabajo
                                    {segment.jobIds.length !== 1 ? 's' : ''})
                                </span>
                                {segment.distanceMeters > 0 && (
                                    <span className="ml-1 text-gray-500">
                                        · {formatDistance(segment.distanceMeters)}
                                    </span>
                                )}
                            </div>
                            <a
                                href={segment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-blue-600 transition-colors hover:bg-blue-100"
                                title="Abrir en Google Maps"
                            >
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    ))}

                    {/* Actions */}
                    <div className="flex items-center gap-1 border-t border-blue-100 pt-2">
                        <a
                            href={route.primaryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                                'bg-blue-600 text-white transition-colors hover:bg-blue-700'
                            )}
                        >
                            <Navigation className="h-3 w-3" />
                            Abrir ruta
                        </a>
                        <button
                            onClick={() => generateMutation.mutate()}
                            disabled={isGenerating}
                            className={cn(
                                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                                'text-blue-600 transition-colors hover:bg-blue-100',
                                isGenerating && 'cursor-wait opacity-60'
                            )}
                            title="Regenerar ruta"
                        >
                            <RefreshCw
                                className={cn('h-3 w-3', isGenerating && 'animate-spin')}
                            />
                            Regenerar
                        </button>
                        <button
                            onClick={() => invalidateMutation.mutate()}
                            disabled={isInvalidating}
                            className={cn(
                                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                                'text-red-500 transition-colors hover:bg-red-50',
                                isInvalidating && 'cursor-wait opacity-60'
                            )}
                            title="Invalidar ruta"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
