'use client';

/**
 * Checkout Pending Page
 * =====================
 *
 * Shown when payment is pending (e.g., cash payment via Rapipago/Pago Fácil).
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, ArrowRight, FileText, Loader2 } from 'lucide-react';

function CheckoutPendingContent() {
    const searchParams = useSearchParams();
    const collectionId = searchParams.get('collection_id');

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
            <div className="max-w-lg w-full text-center p-8">
                {/* Pending Icon */}
                <div className="relative mx-auto w-24 h-24 mb-8">
                    <div className="absolute inset-0 bg-amber-100 rounded-full animate-pulse opacity-50" />
                    <div className="relative bg-amber-100 rounded-full w-24 h-24 flex items-center justify-center">
                        <Clock className="h-12 w-12 text-amber-600" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-3">
                    Pago pendiente de acreditación
                </h1>

                <p className="text-gray-600 mb-8">
                    Tu pago está siendo procesado. Te notificaremos cuando se acredite.
                    Mientras tanto, podés usar todas las funciones de CampoTech.
                </p>

                {collectionId && (
                    <div className="bg-amber-50 rounded-xl p-5 mb-8 text-left">
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-5 w-5 text-amber-600" />
                            <h3 className="text-sm font-medium text-amber-800">Detalles</h3>
                        </div>
                        <p className="text-sm text-amber-700">
                            ID de operación: <span className="font-mono font-medium">{collectionId}</span>
                        </p>
                        <p className="text-xs text-amber-600 mt-2">
                            Si pagaste en efectivo (Rapipago/Pago Fácil), la acreditación puede demorar hasta 2 horas.
                        </p>
                    </div>
                )}

                <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-xl font-semibold text-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20 w-full"
                >
                    Ir al Panel
                    <ArrowRight className="h-5 w-5" />
                </Link>
            </div>
        </div>
    );
}

export default function CheckoutPendingPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        }>
            <CheckoutPendingContent />
        </Suspense>
    );
}
