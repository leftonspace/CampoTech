'use client';

/**
 * Phase 6.2: Team Performance Analytics
 * ======================================
 * 
 * Shows agent performance metrics for owners/admins.
 * Displays conversations handled, messages sent, and response times.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, MessageSquare, TrendingUp, Clock, ChevronDown } from 'lucide-react';
import { subDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AgentPerformance {
    agentId: string;
    agentName: string;
    conversationsHandled: number;
    messagesSent: number;
    avgResponseTimeMinutes: number;
}

type TimeRange = '7d' | '30d' | '90d';

export default function TeamPerformance() {
    const [timeRange, setTimeRange] = useState<TimeRange>('7d');
    const [isRangeOpen, setIsRangeOpen] = useState(false);

    const getDateRange = (range: TimeRange) => {
        const endDate = new Date();
        let startDate: Date;

        switch (range) {
            case '7d':
                startDate = subDays(endDate, 7);
                break;
            case '30d':
                startDate = subDays(endDate, 30);
                break;
            case '90d':
                startDate = subDays(endDate, 90);
                break;
        }

        return { startDate, endDate };
    };

    const { startDate, endDate } = getDateRange(timeRange);

    const { data, isLoading, error } = useQuery<{ performance: AgentPerformance[] }>({
        queryKey: ['shared-inbox', 'performance', timeRange],
        queryFn: async () => {
            const params = new URLSearchParams({
                action: 'performance',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            });
            const res = await fetch(`/api/whatsapp/shared-inbox?${params}`);
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to fetch performance');
            }
            return res.json();
        },
    });

    const rangeOptions: { value: TimeRange; label: string }[] = [
        { value: '7d', label: 'Últimos 7 días' },
        { value: '30d', label: 'Últimos 30 días' },
        { value: '90d', label: 'Últimos 90 días' },
    ];

    const currentRangeLabel = rangeOptions.find((r) => r.value === timeRange)?.label;

    // Calculate totals
    const totals = data?.performance?.reduce(
        (acc, agent) => ({
            conversations: acc.conversations + agent.conversationsHandled,
            messages: acc.messages + agent.messagesSent,
        }),
        { conversations: 0, messages: 0 }
    ) || { conversations: 0, messages: 0 };

    if (error) {
        return (
            <div className="bg-white rounded-xl border p-6">
                <div className="text-center text-gray-500">
                    <p>No tienes permisos para ver métricas de rendimiento</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" />
                    <h3 className="font-semibold text-gray-900">Rendimiento del Equipo</h3>
                </div>

                {/* Time range selector */}
                <div className="relative">
                    <button
                        onClick={() => setIsRangeOpen(!isRangeOpen)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        {currentRangeLabel}
                        <ChevronDown className="h-4 w-4" />
                    </button>

                    {isRangeOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsRangeOpen(false)} />
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border z-20 py-1 min-w-[150px]">
                                {rangeOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            setTimeRange(option.value);
                                            setIsRangeOpen(false);
                                        }}
                                        className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-50 ${timeRange === option.value ? 'bg-teal-50 text-teal-700' : ''
                                            }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 p-4 border-b bg-gray-50">
                <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{totals.conversations}</p>
                    <p className="text-xs text-gray-500">Conversaciones</p>
                </div>
                <div className="text-center">
                    <p className="text-2xl font-bold text-teal-600">{totals.messages}</p>
                    <p className="text-xs text-gray-500">Mensajes enviados</p>
                </div>
                <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                        {data?.performance?.length || 0}
                    </p>
                    <p className="text-xs text-gray-500">Agentes activos</p>
                </div>
            </div>

            {/* Agent list */}
            <div className="divide-y">
                {isLoading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
                        <p className="text-sm text-gray-500 mt-2">Cargando métricas...</p>
                    </div>
                ) : data?.performance?.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                        <p>No hay actividad en este período</p>
                    </div>
                ) : (
                    data?.performance?.map((agent) => (
                        <div key={agent.agentId} className="p-4 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                                        <span className="text-teal-700 font-semibold">
                                            {agent.agentName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{agent.agentName}</p>
                                        <p className="text-xs text-gray-500">
                                            {format(startDate, "d MMM", { locale: es })} - {format(endDate, "d MMM yyyy", { locale: es })}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-center">
                                        <div className="flex items-center gap-1 text-gray-600">
                                            <TrendingUp className="h-3 w-3" />
                                            <span className="text-sm font-medium">{agent.conversationsHandled}</span>
                                        </div>
                                        <p className="text-xs text-gray-400">conv.</p>
                                    </div>

                                    <div className="text-center">
                                        <div className="flex items-center gap-1 text-teal-600">
                                            <MessageSquare className="h-3 w-3" />
                                            <span className="text-sm font-medium">{agent.messagesSent}</span>
                                        </div>
                                        <p className="text-xs text-gray-400">msgs.</p>
                                    </div>

                                    {agent.avgResponseTimeMinutes > 0 && (
                                        <div className="text-center">
                                            <div className="flex items-center gap-1 text-blue-600">
                                                <Clock className="h-3 w-3" />
                                                <span className="text-sm font-medium">
                                                    {agent.avgResponseTimeMinutes}m
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400">resp.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
