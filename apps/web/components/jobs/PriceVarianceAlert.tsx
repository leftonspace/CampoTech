'use client';

/**
 * PriceVarianceAlert Component
 * 
 * Displays a visual alert when there's a difference between estimated
 * and technician-proposed prices. Allows Admins to approve/reject.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    CheckCircle,
    XCircle,
    ArrowUpRight,
    ArrowDownRight,
    Loader2,
    Lock,
} from 'lucide-react';

interface PriceVarianceAlertProps {
    jobId: string;
    estimatedTotal?: number | string | null;
    techProposedTotal?: number | string | null;
    finalTotal?: number | string | null;
    priceVarianceReason?: string | null;
    pricingLockedAt?: string | null;
    varianceApprovedAt?: string | null;
    varianceRejectedAt?: string | null;
    className?: string;
}

export function PriceVarianceAlert({
    jobId,
    estimatedTotal,
    techProposedTotal,
    finalTotal,
    priceVarianceReason,
    pricingLockedAt,
    varianceApprovedAt,
    varianceRejectedAt,
    className = '',
}: PriceVarianceAlertProps) {
    const queryClient = useQueryClient();

    // Convert to numbers
    const estimated = Number(estimatedTotal) || 0;
    const proposed = Number(techProposedTotal) || 0;
    const final = Number(finalTotal) || 0;

    // Calculate variance
    const hasVariance = proposed > 0 && estimated > 0 && proposed !== estimated;
    const diff = proposed - estimated;
    const percent = estimated > 0 ? (diff / estimated) * 100 : 0;
    const isIncrease = diff > 0;

    // Status checks
    const isLocked = !!pricingLockedAt;
    const isApproved = !!varianceApprovedAt;
    const isRejected = !!varianceRejectedAt;
    const _isPending = hasVariance && !isApproved && !isRejected && !isLocked;

    // Mutation for approving/rejecting
    const varianceMutation = useMutation({
        mutationFn: async ({ action }: { action: 'approve' | 'reject' }) => {
            const res = await fetch(`/api/jobs/${jobId}/variance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            if (!res.ok) throw new Error('Failed to process variance');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job', jobId] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
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

    // Don't render if no variance
    if (!hasVariance) {
        return null;
    }

    // Resolved state (approved or rejected)
    if (isApproved || isRejected) {
        return (
            <div className={`rounded-xl border bg-gray-50 p-4 ${className}`}>
                <div className="flex items-center gap-2 text-gray-600">
                    {isApproved ? (
                        <>
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <span className="text-sm font-medium">Variación aprobada</span>
                        </>
                    ) : (
                        <>
                            <XCircle className="h-5 w-5 text-gray-500" />
                            <span className="text-sm font-medium">Variación rechazada</span>
                        </>
                    )}
                </div>
                <div className="mt-2 text-sm text-gray-500">
                    <span className="line-through">{formatCurrency(estimated)}</span>
                    <span className="mx-2">→</span>
                    <span className="font-medium text-gray-900">{formatCurrency(final || (isApproved ? proposed : estimated))}</span>
                </div>
            </div>
        );
    }

    // Locked state (invoice generated)
    if (isLocked) {
        return (
            <div className={`rounded-xl border border-gray-200 bg-gray-50 p-4 ${className}`}>
                <div className="flex items-center gap-2 text-gray-600">
                    <Lock className="h-5 w-5 text-gray-400" />
                    <span className="text-sm font-medium">Precio bloqueado por factura</span>
                </div>
            </div>
        );
    }

    // Pending approval state
    return (
        <div className={`rounded-xl border-2 ${isIncrease ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'} p-4 ${className}`}>
            <div className="flex items-start gap-3">
                <div className={`rounded-full p-2 ${isIncrease ? 'bg-amber-100' : 'bg-green-100'}`}>
                    {isIncrease ? (
                        <ArrowUpRight className="h-5 w-5 text-amber-600" />
                    ) : (
                        <ArrowDownRight className="h-5 w-5 text-green-600" />
                    )}
                </div>
                <div className="flex-1">
                    <h3 className={`font-semibold ${isIncrease ? 'text-amber-800' : 'text-green-800'}`}>
                        Variación de Precio Pendiente
                    </h3>
                    <p className={`text-sm ${isIncrease ? 'text-amber-700' : 'text-green-700'}`}>
                        El técnico propuso un precio diferente al estimado
                    </p>
                </div>
            </div>

            {/* Pricing comparison */}
            <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Estimado Original</p>
                    <p className="text-lg font-medium text-gray-700">{formatCurrency(estimated)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Propuesto por Técnico</p>
                    <p className={`text-lg font-bold ${isIncrease ? 'text-amber-700' : 'text-green-700'}`}>
                        {formatCurrency(proposed)}
                    </p>
                </div>
            </div>

            {/* Variance badge */}
            <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${isIncrease ? 'bg-amber-200 text-amber-800' : 'bg-green-200 text-green-800'
                }`}>
                {isIncrease ? '+' : ''}{percent.toFixed(1)}%
                <span className="text-xs">
                    ({isIncrease ? '+' : ''}{formatCurrency(diff)})
                </span>
            </div>

            {/* Variance reason */}
            {priceVarianceReason && (
                <div className="mt-3 rounded-lg bg-white/50 p-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">💬 Motivo del técnico:</p>
                    <p className="text-sm text-gray-600">&ldquo;{priceVarianceReason}&rdquo;</p>
                </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex gap-2">
                <button
                    onClick={() => varianceMutation.mutate({ action: 'approve' })}
                    disabled={varianceMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                    {varianceMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <CheckCircle className="h-4 w-4" />
                    )}
                    Aprobar {formatCurrency(proposed)}
                </button>
                <button
                    onClick={() => varianceMutation.mutate({ action: 'reject' })}
                    disabled={varianceMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                    <XCircle className="h-4 w-4" />
                    Mantener Original
                </button>
            </div>
        </div>
    );
}

export default PriceVarianceAlert;
