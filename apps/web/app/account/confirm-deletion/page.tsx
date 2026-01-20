/**
 * Account Deletion Confirmation Page
 * ===================================
 *
 * Handles the email confirmation link for account deletion.
 * Route: /account/confirm-deletion?token=XXXX
 *
 * Per Ley 25.326, this starts the 30-day waiting period.
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, XCircle, Loader2, ArrowLeft, Calendar } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type ConfirmationState = 'loading' | 'success' | 'error' | 'expired' | 'already_confirmed';

interface ConfirmationResult {
    state: ConfirmationState;
    scheduledDate?: string;
    daysRemaining?: number;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRMATION COMPONENT (uses useSearchParams)
// ═══════════════════════════════════════════════════════════════════════════════

function ConfirmDeletionContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [result, setResult] = useState<ConfirmationResult>({ state: 'loading' });

    useEffect(() => {
        if (!token) {
            setResult({
                state: 'error',
                error: 'Token de confirmación no proporcionado.',
            });
            return;
        }

        async function confirmDeletion() {
            try {
                const response = await fetch('/api/account/confirm-deletion', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    setResult({
                        state: 'success',
                        scheduledDate: data.scheduledDate,
                        daysRemaining: data.daysRemaining,
                    });
                } else if (data.error === 'already_confirmed') {
                    setResult({
                        state: 'already_confirmed',
                        scheduledDate: data.scheduledDate,
                        daysRemaining: data.daysRemaining,
                    });
                } else if (data.error === 'token_expired') {
                    setResult({ state: 'expired' });
                } else {
                    setResult({
                        state: 'error',
                        error: data.message || 'Error al confirmar la eliminación.',
                    });
                }
            } catch (_error) {
                setResult({
                    state: 'error',
                    error: 'Error de conexión. Por favor, intentá de nuevo.',
                });
            }
        }

        confirmDeletion();
    }, [token]);

    // Loading state
    if (result.state === 'loading') {
        return (
            <div className="flex flex-col items-center gap-4 p-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary-500" />
                <p className="text-lg text-gray-600">Confirmando eliminación...</p>
            </div>
        );
    }

    // Success state
    if (result.state === 'success') {
        return (
            <div className="flex flex-col items-center gap-6 p-8 text-center">
                <div className="rounded-full bg-danger-100 p-4">
                    <Calendar className="h-12 w-12 text-danger-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Eliminación Confirmada</h1>
                <p className="text-gray-600">
                    Tu cuenta será eliminada permanentemente en:
                </p>
                <div className="rounded-lg bg-danger-50 border border-danger-200 p-6">
                    <p className="text-3xl font-bold text-danger-700">
                        {result.daysRemaining} días
                    </p>
                    {result.scheduledDate && (
                        <p className="mt-2 text-sm text-danger-600">
                            {new Date(result.scheduledDate).toLocaleDateString('es-AR', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                timeZone: 'America/Argentina/Buenos_Aires',
                            })}
                        </p>
                    )}
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                    <p className="font-medium mb-2">¿Cambiaste de opinión?</p>
                    <p>
                        Podés cancelar la eliminación en cualquier momento desde{' '}
                        <Link href="/dashboard/settings/privacy" className="text-primary-600 hover:underline">
                            Configuración → Privacidad
                        </Link>
                    </p>
                </div>
                <Link
                    href="/dashboard/settings/privacy"
                    className="btn-primary mt-4"
                >
                    Ir a Configuración
                </Link>
            </div>
        );
    }

    // Already confirmed state
    if (result.state === 'already_confirmed') {
        return (
            <div className="flex flex-col items-center gap-6 p-8 text-center">
                <div className="rounded-full bg-amber-100 p-4">
                    <AlertTriangle className="h-12 w-12 text-amber-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Ya Confirmado</h1>
                <p className="text-gray-600">
                    Tu cuenta ya fue confirmada para eliminación.
                </p>
                {result.daysRemaining !== undefined && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                        <p className="text-lg font-semibold text-amber-700">
                            Faltan {result.daysRemaining} días para la eliminación
                        </p>
                    </div>
                )}
                <Link
                    href="/dashboard/settings/privacy"
                    className="btn-outline mt-4"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Ir a Configuración
                </Link>
            </div>
        );
    }

    // Expired state
    if (result.state === 'expired') {
        return (
            <div className="flex flex-col items-center gap-6 p-8 text-center">
                <div className="rounded-full bg-gray-100 p-4">
                    <XCircle className="h-12 w-12 text-gray-400" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Enlace Expirado</h1>
                <p className="text-gray-600">
                    El enlace de confirmación ha expirado (válido por 24 horas).
                </p>
                <p className="text-sm text-gray-500">
                    Si todavía querés eliminar tu cuenta, podés solicitar un nuevo enlace.
                </p>
                <Link
                    href="/dashboard/settings/privacy"
                    className="btn-primary mt-4"
                >
                    Solicitar Nuevo Enlace
                </Link>
            </div>
        );
    }

    // Error state
    return (
        <div className="flex flex-col items-center gap-6 p-8 text-center">
            <div className="rounded-full bg-danger-100 p-4">
                <XCircle className="h-12 w-12 text-danger-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Error</h1>
            <p className="text-gray-600">
                {result.error || 'No pudimos procesar tu solicitud.'}
            </p>
            <div className="flex gap-4 mt-4">
                <Link href="/dashboard/settings/privacy" className="btn-outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                </Link>
                <button
                    onClick={() => router.refresh()}
                    className="btn-primary"
                >
                    Reintentar
                </button>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ConfirmDeletionPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-danger-600 to-danger-700 px-6 py-4">
                    <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Eliminación de Cuenta
                    </h2>
                    <p className="text-danger-100 text-sm">Ley 25.326 - Derecho de Supresión</p>
                </div>
                <Suspense
                    fallback={
                        <div className="flex flex-col items-center gap-4 p-8">
                            <Loader2 className="h-12 w-12 animate-spin text-primary-500" />
                            <p className="text-lg text-gray-600">Cargando...</p>
                        </div>
                    }
                >
                    <ConfirmDeletionContent />
                </Suspense>
            </div>
        </div>
    );
}
