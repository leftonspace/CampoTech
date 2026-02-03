'use client';

/**
 * Pending Variance Page
 * 
 * Dashboard page for dispatchers to review and approve/reject
 * price variances proposed by technicians.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
    AlertTriangle,
    CheckCircle,
    XCircle,
    ArrowUpRight,
    ArrowDownRight,
    ExternalLink,
    Loader2,
    DollarSign,
    Edit3,
} from 'lucide-react';

interface JobWithVariance {
    id: string;
    jobNumber: string;
    title: string;
    status: string;
    scheduledDate: string | null;
    completedAt: string | null;
    estimatedTotal: number;
    techProposedTotal: number;
    finalTotal: number | null;
    customer: {
        id: string;
        name: string;
    } | null;
    technician: {
        id: string;
        name: string;
    } | null;
    visits: Array<{
        priceVarianceReason: string | null;
    }>;
}

export default function PendingVariancePage() {
    const queryClient = useQueryClient();
    const [adjustModal, setAdjustModal] = useState<{ jobId: string; amount: string } | null>(null);

    // Fetch jobs with pending variances
    const { data: response, isLoading, error } = useQuery({
        queryKey: ['jobs-pending-variance'],
        queryFn: async () => {
            const res = await fetch('/api/jobs?hasPendingVariance=true&limit=50');
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
        },
    });

    const jobs: JobWithVariance[] = response?.data || [];

    // Approve mutation
    const approveMutation = useMutation({
        mutationFn: async ({ jobId, action, adjustedAmount }: { jobId: string; action: 'approve' | 'reject' | 'adjust'; adjustedAmount?: number }) => {
            const res = await fetch(`/api/jobs/${jobId}/variance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, adjustedAmount }),
            });
            if (!res.ok) throw new Error('Failed to process variance');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs-pending-variance'] });
            setAdjustModal(null);
        },
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'short',
        });
    };

    const getVarianceInfo = (job: JobWithVariance) => {
        const estimated = job.estimatedTotal || 0;
        const proposed = job.techProposedTotal || 0;
        const diff = proposed - estimated;
        const percent = estimated > 0 ? (diff / estimated) * 100 : 0;
        const isIncrease = diff > 0;

        return { diff, percent, isIncrease };
    };

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-red-800">Error al cargar las variaciones pendientes.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-amber-500" />
                    Variaciones de Precio Pendientes
                </h1>
                <p className="mt-1 text-gray-500">
                    Revisa y aprueba las diferencias de precio propuestas por técnicos
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-amber-100 p-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{jobs.length}</p>
                            <p className="text-sm text-gray-500">Pendientes</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-red-100 p-2">
                            <ArrowUpRight className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">
                                {jobs.filter(j => getVarianceInfo(j).isIncrease).length}
                            </p>
                            <p className="text-sm text-gray-500">Aumentos</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-green-100 p-2">
                            <ArrowDownRight className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">
                                {jobs.filter(j => !getVarianceInfo(j).isIncrease).length}
                            </p>
                            <p className="text-sm text-gray-500">Reducciones</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Empty State */}
            {jobs.length === 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
                    <h3 className="mt-4 text-lg font-medium text-gray-900">
                        ¡Todo al día!
                    </h3>
                    <p className="mt-2 text-gray-500">
                        No hay variaciones de precio pendientes de aprobación.
                    </p>
                </div>
            )}

            {/* Jobs List */}
            <div className="space-y-4">
                {jobs.map((job) => {
                    const { diff, percent, isIncrease } = getVarianceInfo(job);
                    const varianceReason = job.visits?.[0]?.priceVarianceReason;

                    return (
                        <div
                            key={job.id}
                            className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
                        >
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                {/* Job Info */}
                                <div className="flex-1">
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 rounded-full p-2 ${isIncrease ? 'bg-red-100' : 'bg-green-100'
                                            }`}>
                                            {isIncrease ? (
                                                <ArrowUpRight className="h-4 w-4 text-red-600" />
                                            ) : (
                                                <ArrowDownRight className="h-4 w-4 text-green-600" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-gray-900">
                                                    {job.jobNumber}
                                                </h3>
                                                <Link
                                                    href={`/dashboard/jobs/${job.id}`}
                                                    className="text-blue-600 hover:text-blue-700"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </Link>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-0.5">
                                                {job.title || 'Sin título'}
                                            </p>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                                                <span>👤 {job.customer?.name || 'Sin cliente'}</span>
                                                <span>🔧 {job.technician?.name || 'Sin asignar'}</span>
                                                <span>📅 {formatDate(job.completedAt || job.scheduledDate)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Variance Reason */}
                                    {varianceReason && (
                                        <div className="mt-4 rounded-lg bg-gray-50 p-3">
                                            <p className="text-sm font-medium text-gray-700 mb-1">
                                                💬 Motivo del técnico:
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                &ldquo;{varianceReason}&rdquo;
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Pricing Info */}
                                <div className="lg:text-right lg:min-w-[280px]">
                                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">
                                                Estimado
                                            </p>
                                            <p className="text-lg font-medium text-gray-700">
                                                {formatCurrency(job.estimatedTotal || 0)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">
                                                Propuesto
                                            </p>
                                            <p className={`text-lg font-bold ${isIncrease ? 'text-red-600' : 'text-green-600'
                                                }`}>
                                                {formatCurrency(job.techProposedTotal || 0)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${isIncrease
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-green-100 text-green-700'
                                        }`}>
                                        {isIncrease ? '+' : ''}
                                        {percent.toFixed(1)}%
                                        <span className="text-xs">
                                            ({isIncrease ? '+' : ''}{formatCurrency(diff)})
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
                                <button
                                    onClick={() => approveMutation.mutate({ jobId: job.id, action: 'approve' })}
                                    disabled={approveMutation.isPending}
                                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                                >
                                    <CheckCircle className="h-4 w-4" />
                                    Aprobar {formatCurrency(job.techProposedTotal || 0)}
                                </button>
                                <button
                                    onClick={() => approveMutation.mutate({ jobId: job.id, action: 'reject' })}
                                    disabled={approveMutation.isPending}
                                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                >
                                    <XCircle className="h-4 w-4" />
                                    Mantener {formatCurrency(job.estimatedTotal || 0)}
                                </button>
                                <button
                                    onClick={() => setAdjustModal({
                                        jobId: job.id,
                                        amount: String(job.techProposedTotal || job.estimatedTotal || '')
                                    })}
                                    disabled={approveMutation.isPending}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                >
                                    <Edit3 className="h-4 w-4" />
                                    Ajustar
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Adjust Modal */}
            {adjustModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Ajustar Precio Final
                        </h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Monto Final (ARS)
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="number"
                                    value={adjustModal.amount}
                                    onChange={(e) => setAdjustModal({ ...adjustModal, amount: e.target.value })}
                                    className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-lg font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    placeholder="0"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setAdjustModal(null)}
                                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const amount = parseFloat(adjustModal.amount);
                                    if (!isNaN(amount) && amount > 0) {
                                        approveMutation.mutate({
                                            jobId: adjustModal.jobId,
                                            action: 'adjust',
                                            adjustedAmount: amount,
                                        });
                                    }
                                }}
                                disabled={approveMutation.isPending || !adjustModal.amount}
                                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                {approveMutation.isPending ? 'Guardando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
