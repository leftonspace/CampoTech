'use client';

/**
 * Phase 6.2: Inbox Stats Card
 * ============================
 * 
 * Shows shared inbox statistics for the current user.
 * Different stats shown based on user role.
 */

import { useQuery } from '@tanstack/react-query';
import { Inbox, User, Clock, CheckCircle, Users, AlertCircle } from 'lucide-react';

interface InboxStats {
    total: number;
    unassigned: number;
    assignedToMe: number;
    open: number;
    closed: number;
    byAgent: Record<string, number>;
}

interface InboxStatsCardProps {
    showAdminStats?: boolean;
    compact?: boolean;
}

export default function InboxStatsCard({ showAdminStats = false, compact = false }: InboxStatsCardProps) {
    const { data, isLoading, error } = useQuery<{ stats: InboxStats }>({
        queryKey: ['shared-inbox', 'stats'],
        queryFn: async () => {
            const res = await fetch('/api/whatsapp/shared-inbox?action=stats');
            if (!res.ok) throw new Error('Failed to fetch stats');
            return res.json();
        },
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    if (isLoading) {
        return (
            <div className={`animate-pulse ${compact ? 'h-12' : 'p-4'} bg-gray-100 rounded-lg`} />
        );
    }

    if (error || !data?.stats) {
        return null;
    }

    const stats = data.stats;

    if (compact) {
        return (
            <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b">
                <div className="flex items-center gap-1.5">
                    <Inbox className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{stats.open}</span>
                    <span className="text-xs text-gray-500">abiertas</span>
                </div>
                {showAdminStats && stats.unassigned > 0 && (
                    <div className="flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-orange-400" />
                        <span className="text-sm font-medium text-orange-600">{stats.unassigned}</span>
                        <span className="text-xs text-gray-500">sin asignar</span>
                    </div>
                )}
                <div className="flex items-center gap-1.5">
                    <User className="h-4 w-4 text-teal-400" />
                    <span className="text-sm font-medium text-teal-600">{stats.assignedToMe}</span>
                    <span className="text-xs text-gray-500">mías</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border p-4 space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Inbox className="h-5 w-5 text-teal-600" />
                Bandeja Compartida
            </h3>

            <div className="grid grid-cols-2 gap-3">
                {/* Open conversations */}
                <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="text-2xl font-bold text-gray-900">{stats.open}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Conversaciones abiertas</p>
                </div>

                {/* Assigned to me */}
                <div className="bg-teal-50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-teal-600" />
                        <span className="text-2xl font-bold text-teal-700">{stats.assignedToMe}</span>
                    </div>
                    <p className="text-xs text-teal-600 mt-1">Asignadas a mí</p>
                </div>

                {showAdminStats && (
                    <>
                        {/* Unassigned */}
                        <div className={`rounded-lg p-3 ${stats.unassigned > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2">
                                <AlertCircle className={`h-4 w-4 ${stats.unassigned > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
                                <span className={`text-2xl font-bold ${stats.unassigned > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                    {stats.unassigned}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Sin asignar</p>
                        </div>

                        {/* Total agents */}
                        <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-400" />
                                <span className="text-2xl font-bold text-gray-600">
                                    {Object.keys(stats.byAgent).length}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Agentes activos</p>
                        </div>
                    </>
                )}

                {/* Closed */}
                <div className="bg-green-50 rounded-lg p-3 col-span-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-2xl font-bold text-green-600">{stats.closed}</span>
                    </div>
                    <p className="text-xs text-green-600 mt-1">Cerradas</p>
                </div>
            </div>
        </div>
    );
}
