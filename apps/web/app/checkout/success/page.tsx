'use client';

/**
 * Checkout Success Page
 * =====================
 *
 * Shown after successful payment through MercadoPago.
 * Auto-redirects to dashboard after a few seconds.
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, ArrowRight, Sparkles, PartyPopper, Loader2 } from 'lucide-react';

function CheckoutSuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [countdown, setCountdown] = useState(5);

    const paymentInfo = {
        collectionId: searchParams.get('collection_id') || undefined,
        paymentType: searchParams.get('payment_type') || undefined,
        status: searchParams.get('collection_status') || undefined,
    };

    // Auto-redirect to dashboard after 5 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    router.push('/dashboard');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [router]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
            <div className="max-w-lg w-full text-center p-8">
                {/* Success Animation */}
                <div className="relative mx-auto w-24 h-24 mb-8">
                    <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-30" />
                    <div className="relative bg-green-100 rounded-full w-24 h-24 flex items-center justify-center">
                        <CheckCircle className="h-12 w-12 text-green-600" />
                    </div>
                    <PartyPopper className="absolute -top-3 -right-3 h-10 w-10 text-amber-500" />
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-gray-900 mb-3">
                    ¡Pago exitoso! 🎉
                </h1>

                <p className="text-lg text-gray-600 mb-8">
                    Tu suscripción fue activada correctamente. Ya podés disfrutar de todas
                    las funcionalidades de CampoTech.
                </p>

                {/* Payment Details */}
                {paymentInfo.collectionId && (
                    <div className="bg-gray-50 rounded-xl p-5 mb-8 text-left">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                            Detalles del pago
                        </h3>
                        <dl className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <dt className="text-gray-500">ID de pago:</dt>
                                <dd className="font-mono text-gray-900">{paymentInfo.collectionId}</dd>
                            </div>
                            {paymentInfo.paymentType && (
                                <div className="flex justify-between">
                                    <dt className="text-gray-500">Método:</dt>
                                    <dd className="text-gray-900 capitalize">{paymentInfo.paymentType}</dd>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <dt className="text-gray-500">Estado:</dt>
                                <dd className="text-green-600 font-medium">Aprobado ✓</dd>
                            </div>
                        </dl>
                    </div>
                )}

                {/* Next Steps */}
                <div className="bg-primary-50 rounded-xl p-5 mb-8 text-left">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-5 w-5 text-primary-600" />
                        <h3 className="font-medium text-primary-900">Próximos pasos</h3>
                    </div>
                    <ul className="space-y-2.5 text-sm text-primary-800">
                        <li className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-primary-200 text-primary-700 text-xs flex items-center justify-center font-bold">
                                1
                            </span>
                            Explorá tu panel de control
                        </li>
                        <li className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-primary-200 text-primary-700 text-xs flex items-center justify-center font-bold">
                                2
                            </span>
                            Invitá a tu equipo de trabajo
                        </li>
                        <li className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-primary-200 text-primary-700 text-xs flex items-center justify-center font-bold">
                                3
                            </span>
                            Cargá tus primeros clientes y trabajos
                        </li>
                    </ul>
                </div>

                {/* Action */}
                <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-xl font-semibold text-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20 w-full"
                >
                    Ir al Panel
                    <ArrowRight className="h-5 w-5" />
                </Link>

                <p className="text-sm text-gray-400 mt-4">
                    Redirigiendo automáticamente en {countdown} segundos...
                </p>

                {/* Receipt Notice */}
                <p className="text-xs text-gray-400 mt-6">
                    Recibirás un comprobante de pago en tu email registrado.
                </p>
            </div>
        </div>
    );
}

export default function CheckoutSuccessPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        }>
            <CheckoutSuccessContent />
        </Suspense>
    );
}
