'use client';

/**
 * Checkout Failure Page
 * =====================
 *
 * Shown when payment fails or is rejected.
 */

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, RefreshCw, ArrowRight, MessageSquare } from 'lucide-react';

export default function CheckoutFailurePage() {
    const searchParams = useSearchParams();
    const externalReference = searchParams.get('external_reference');
    const plan = externalReference?.split('_')[1] || '';

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
            <div className="max-w-lg w-full text-center p-8">
                {/* Error Icon */}
                <div className="relative mx-auto w-24 h-24 mb-8">
                    <div className="bg-red-100 rounded-full w-24 h-24 flex items-center justify-center">
                        <XCircle className="h-12 w-12 text-red-500" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-3">
                    El pago no pudo ser procesado
                </h1>

                <p className="text-gray-600 mb-8">
                    No te preocupes, tu cuenta sigue activa con la prueba gratuita de 21 días.
                    Podés intentar de nuevo cuando quieras.
                </p>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    <Link
                        href={`/checkout?plan=${plan || 'PROFESIONAL'}`}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
                    >
                        <RefreshCw className="h-5 w-5" />
                        Intentar de nuevo
                    </Link>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                    >
                        Ir al Panel
                        <ArrowRight className="h-5 w-5" />
                    </Link>
                </div>

                <p className="text-xs text-gray-400 mt-8">
                    ¿Necesitás ayuda?{' '}
                    <a
                        href="mailto:soporte@campotech.com"
                        className="text-primary-500 hover:underline inline-flex items-center gap-1"
                    >
                        <MessageSquare className="h-3 w-3" />
                        Contactar soporte
                    </a>
                </p>
            </div>
        </div>
    );
}
