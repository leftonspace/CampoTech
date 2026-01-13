'use client';

/**
 * On-Call Assignment Warning Modal
 * Displays warnings when assigning jobs to on-call technicians who require advance notice
 */

import { AlertTriangle, Clock, CalendarX, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidationWarning } from '@/hooks/useAssignmentValidation';

interface OnCallWarningModalProps {
    isOpen: boolean;
    warnings: ValidationWarning[];
    technicianName: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

const WARNING_ICONS = {
    advance_notice: Clock,
    outside_availability: AlertTriangle,
    day_off: CalendarX,
    exception: CalendarX,
};

const WARNING_COLORS = {
    advance_notice: 'bg-amber-50 border-amber-200 text-amber-700',
    outside_availability: 'bg-orange-50 border-orange-200 text-orange-700',
    day_off: 'bg-red-50 border-red-200 text-red-700',
    exception: 'bg-purple-50 border-purple-200 text-purple-700',
};

export function OnCallWarningModal({
    isOpen,
    warnings,
    technicianName,
    onConfirm,
    onCancel,
    isLoading = false,
}: OnCallWarningModalProps) {
    if (!isOpen || warnings.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 transition-opacity duration-200"
                onClick={onCancel}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b bg-amber-50 flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-100">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                            Advertencia de Asignación
                        </h3>
                        <p className="text-sm text-gray-600">
                            Técnico: {technicianName}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-1.5 hover:bg-amber-100 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-400" />
                    </button>
                </div>

                {/* Warnings List */}
                <div className="px-6 py-4 space-y-3 max-h-[300px] overflow-y-auto">
                    {warnings.map((warning, index) => {
                        const Icon = WARNING_ICONS[warning.type] || AlertTriangle;
                        const colorClass = WARNING_COLORS[warning.type] || 'bg-gray-50 border-gray-200 text-gray-700';

                        return (
                            <div
                                key={index}
                                className={cn(
                                    "p-3 rounded-lg border flex items-start gap-3",
                                    colorClass
                                )}
                            >
                                <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{warning.message}</p>
                                    {warning.type === 'advance_notice' && warning.details.advanceNoticeRequired && (
                                        <p className="text-xs mt-1 opacity-75">
                                            Requiere: {warning.details.advanceNoticeRequired}h de anticipación
                                            {warning.details.actualNoticeHours !== undefined && (
                                                <> • Actual: {warning.details.actualNoticeHours}h</>
                                            )}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Question */}
                <div className="px-6 py-3 bg-gray-50 border-t">
                    <p className="text-sm text-gray-600 text-center">
                        ¿Desea asignar el trabajo de todas formas?
                    </p>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-t flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={cn(
                            "flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50",
                            "bg-amber-500 hover:bg-amber-600"
                        )}
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Asignando...
                            </span>
                        ) : (
                            'Sí, asignar de todas formas'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
