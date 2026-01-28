'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { TeamMember } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE CONFIRMATION MODAL (with 3-second safety button)
// ═══════════════════════════════════════════════════════════════════════════════

interface DeleteConfirmationModalProps {
    member: TeamMember;
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting: boolean;
}

export function DeleteConfirmationModal({ member, onConfirm, onCancel, isDeleting }: DeleteConfirmationModalProps) {
    const [secondsLeft, setSecondsLeft] = useState(3);
    const [canDelete, setCanDelete] = useState(false);

    // Countdown timer
    useEffect(() => {
        if (secondsLeft > 0) {
            const timer = setTimeout(() => {
                setSecondsLeft(secondsLeft - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            setCanDelete(true);
        }
    }, [secondsLeft]);

    // Reset on close
    useEffect(() => {
        return () => {
            setSecondsLeft(3);
            setCanDelete(false);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
                onClick={onCancel}
                aria-hidden="true"
            />

            {/* Modal */}
            <div className="flex h-full items-center justify-center p-4">
                <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl overflow-hidden">
                    {/* Header with warning icon */}
                    <div className="p-6 text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">
                            ¿Estás seguro?
                        </h2>
                        <p className="text-sm text-gray-600">
                            Esta acción eliminará a <strong>{member.name}</strong> permanentemente y no se puede deshacer.
                        </p>
                    </div>

                    {/* Footer with buttons */}
                    <div className="px-6 pb-6 flex gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isDeleting}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>

                        {/* Safety Delete Button with animation */}
                        <button
                            type="button"
                            onClick={canDelete ? onConfirm : undefined}
                            disabled={!canDelete || isDeleting}
                            className={cn(
                                "flex-1 relative overflow-hidden px-4 py-2.5 text-sm font-medium rounded-lg transition-all",
                                canDelete
                                    ? "bg-red-600 text-white hover:bg-red-700"
                                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                            )}
                        >
                            {/* Animated overlay that shrinks from 100% to 0% */}
                            {!canDelete && (
                                <div
                                    className="absolute inset-0 bg-gray-400 transition-all ease-linear"
                                    style={{
                                        width: `${(secondsLeft / 3) * 100}%`,
                                        transitionDuration: '1000ms',
                                    }}
                                />
                            )}
                            <span className="relative z-10">
                                {isDeleting
                                    ? 'Eliminando...'
                                    : canDelete
                                        ? 'Confirmar Eliminación'
                                        : `Espere (${secondsLeft}s)...`}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DeleteConfirmationModal;
