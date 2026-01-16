'use client';

/**
 * Compliance Widget
 * =================
 * 
 * Phase 5: Dashboard Compliance Widget
 * 
 * Displays compliance status for:
 * - Driver's licenses (expiring/expired/missing)
 * - Vehicle insurance
 * - VTV (technical inspection)
 */

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Clock, ShieldAlert, ChevronRight, Car, CreditCard, FileWarning } from 'lucide-react';
import Link from 'next/link';

interface ComplianceAlert {
    type: 'error' | 'warning' | 'info';
    category: string;
    message: string;
    count: number;
    action?: string;
}

interface ComplianceSummary {
    licensesExpiring30Days: number;
    licensesExpiring7Days: number;
    licensesExpired: number;
    techniciansWithoutLicense: number;
    vehicleInsuranceExpiring: number;
    vehicleInsuranceExpired: number;
    vtvExpiring: number;
    totalIssues: number;
    criticalIssues: number;
    warningIssues: number;
}

interface ComplianceData {
    success: boolean;
    summary: ComplianceSummary;
    alerts: ComplianceAlert[];
    lastChecked: string;
}

export function ComplianceWidget() {
    const { data, isLoading, error } = useQuery<ComplianceData>({
        queryKey: ['dashboard-compliance'],
        queryFn: async () => {
            const response = await fetch('/api/dashboard/compliance');
            if (!response.ok) throw new Error('Failed to fetch compliance data');
            return response.json();
        },
        refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    });

    if (isLoading) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-4 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
            </div>
        );
    }

    if (error || !data?.success) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 text-gray-500">
                    <ShieldAlert className="h-5 w-5" />
                    <span className="text-sm">No se pudo cargar el estado de cumplimiento</span>
                </div>
            </div>
        );
    }

    const { summary, alerts } = data;
    const hasIssues = summary.totalIssues > 0;
    const hasCritical = summary.criticalIssues > 0;

    return (
        <div className={`rounded-xl border ${hasCritical ? 'border-red-200 bg-red-50/50' : hasIssues ? 'border-amber-200 bg-amber-50/50' : 'border-green-200 bg-green-50/50'} p-4`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${hasCritical ? 'bg-red-100' : hasIssues ? 'bg-amber-100' : 'bg-green-100'}`}>
                        {hasCritical ? (
                            <ShieldAlert className="h-4 w-4 text-red-600" />
                        ) : hasIssues ? (
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                        ) : (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                    </div>
                    <h3 className="font-semibold text-gray-900">Cumplimiento</h3>
                </div>

                {/* Status badge */}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${hasCritical
                    ? 'bg-red-100 text-red-700'
                    : hasIssues
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                    {hasCritical ? `${summary.criticalIssues} crítico` : hasIssues ? `${summary.warningIssues} pendiente` : 'Todo OK'}
                </span>
            </div>

            {/* Quick stats grid */}
            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 bg-white/60 rounded-lg">
                    <div className="flex items-center justify-center gap-1">
                        <CreditCard className="h-3.5 w-3.5 text-gray-500" />
                        <span className={`text-lg font-bold ${summary.licensesExpired > 0 ? 'text-red-600' : summary.licensesExpiring7Days > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
                            {summary.licensesExpired + summary.licensesExpiring7Days}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500">Licencias</p>
                </div>

                <div className="text-center p-2 bg-white/60 rounded-lg">
                    <div className="flex items-center justify-center gap-1">
                        <FileWarning className="h-3.5 w-3.5 text-gray-500" />
                        <span className={`text-lg font-bold ${summary.vehicleInsuranceExpired > 0 ? 'text-red-600' : summary.vehicleInsuranceExpiring > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
                            {summary.vehicleInsuranceExpired + summary.vehicleInsuranceExpiring}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500">Seguros</p>
                </div>

                <div className="text-center p-2 bg-white/60 rounded-lg">
                    <div className="flex items-center justify-center gap-1">
                        <Car className="h-3.5 w-3.5 text-gray-500" />
                        <span className={`text-lg font-bold ${summary.vtvExpiring > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
                            {summary.vtvExpiring}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500">VTV</p>
                </div>
            </div>

            {/* Alerts list */}
            {alerts.length > 0 ? (
                <div className="space-y-1.5">
                    {alerts.slice(0, 3).map((alert, index) => (
                        <Link
                            key={index}
                            href={alert.action || '#'}
                            className={`flex items-center justify-between p-2 rounded-lg transition-colors ${alert.type === 'error'
                                ? 'bg-red-100/70 hover:bg-red-100'
                                : alert.type === 'warning'
                                    ? 'bg-amber-100/70 hover:bg-amber-100'
                                    : 'bg-blue-100/70 hover:bg-blue-100'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                {alert.type === 'error' ? (
                                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                                ) : (
                                    <Clock className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                                )}
                                <span className={`text-xs ${alert.type === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                                    {alert.message}
                                </span>
                            </div>
                            <ChevronRight className={`h-3.5 w-3.5 ${alert.type === 'error' ? 'text-red-400' : 'text-amber-400'}`} />
                        </Link>
                    ))}

                    {alerts.length > 3 && (
                        <p className="text-xs text-center text-gray-500 pt-1">
                            +{alerts.length - 3} más
                        </p>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 p-2 bg-green-100/50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-700">
                        Sin alertas de cumplimiento
                    </span>
                </div>
            )}

            {/* Footer */}
            <div className="mt-3 pt-2 border-t border-gray-200/50 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                    Actualizado: {new Date(data.lastChecked).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'America/Argentina/Buenos_Aires'
                    })}
                </span>
                <Link
                    href="/dashboard/team"
                    className="text-xs text-primary-600 hover:underline flex items-center gap-0.5"
                >
                    Ver equipo
                    <ChevronRight className="h-3 w-3" />
                </Link>
            </div>
        </div>
    );
}

export default ComplianceWidget;
