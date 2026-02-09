'use client';

/**
 * Checkout Page
 * =============
 *
 * Dedicated checkout page shown after signup when a paid plan was selected.
 * Displays plan summary, accepted payment methods, and initiates payment.
 * 
 * Flow: Signup → OTP → /checkout?plan=PROFESIONAL → MercadoPago → /checkout/success → Dashboard
 * 
 * This page is outside the dashboard layout (no sidebar) for a clean checkout UX.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    CreditCard,
    Building2,
    Wallet,
    Shield,
    CheckCircle,
    ArrowRight,
    Loader2,
    BadgeCheck,
    Sparkles,
    ChevronLeft,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN DATA (mirrors server config)
// ═══════════════════════════════════════════════════════════════════════════════

const PLANS: Record<string, { name: string; description: string; priceARS: number; priceUSD: number; features: string[] }> = {
    INICIAL: {
        name: 'Inicial',
        description: 'Ideal para empezar tu negocio de servicios',
        priceARS: 25000,
        priceUSD: 25,
        features: ['Hasta 5 usuarios', 'Hasta 200 clientes', 'Hasta 300 trabajos/mes', 'Soporte por email'],
    },
    PROFESIONAL: {
        name: 'Profesional',
        description: 'Para equipos en crecimiento',
        priceARS: 55000,
        priceUSD: 55,
        features: ['Hasta 15 usuarios', 'Hasta 1,000 clientes', 'Hasta 1,000 trabajos/mes', 'Integraciones avanzadas', 'Soporte prioritario'],
    },
    EMPRESA: {
        name: 'Empresa',
        description: 'Para operaciones a gran escala',
        priceARS: 120000,
        priceUSD: 120,
        features: ['Usuarios ilimitados', 'Clientes ilimitados', 'Trabajos ilimitados', 'API access', 'Soporte dedicado'],
    },
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT METHOD CARD
// ═══════════════════════════════════════════════════════════════════════════════

function PaymentMethodCard({
    icon: Icon,
    title,
    description,
    brands,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    brands?: string[];
}) {
    return (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-200">
            <div className="p-2 rounded-lg bg-gray-50">
                <Icon className="h-5 w-5 text-gray-700" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                {brands && brands.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {brands.map((brand) => (
                            <span
                                key={brand}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
                            >
                                {brand}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CHECKOUT PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function CheckoutPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const planId = searchParams.get('plan')?.toUpperCase() || 'PROFESIONAL';
    const plan = PLANS[planId] || PLANS.PROFESIONAL;

    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if user is authenticated
    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            router.push('/signup');
        }
    }, [router]);

    const handleCheckout = async () => {
        setIsProcessing(true);
        setError(null);

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch('/api/subscription/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify({
                    tier: planId,
                    billingCycle: 'MONTHLY',
                }),
            });

            const data = await response.json();

            if (data.success && data.data?.checkoutUrl) {
                // Redirect to MercadoPago - shows all payment options (credit, debit, cash, transfer, wallet)
                window.location.href = data.data.checkoutUrl;
            } else {
                setError(data.error || 'Error al crear el checkout. Intentá de nuevo.');
                setIsProcessing(false);
            }
        } catch (err) {
            console.error('Checkout error:', err);
            setError('Error de conexión. Verificá tu conexión e intentá de nuevo.');
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
            {/* Header */}
            <header className="border-b border-gray-200 bg-white">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/dashboard"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">CT</span>
                            </div>
                            <span className="font-semibold text-gray-900">CampoTech</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Shield className="h-4 w-4 text-green-600" />
                        <span>Pago seguro</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="grid lg:grid-cols-5 gap-8">
                    {/* Left: Plan Summary */}
                    <div className="lg:col-span-2 order-2 lg:order-1">
                        <div className="sticky top-8">
                            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                                Resumen del pedido
                            </h2>

                            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                                {/* Plan Header */}
                                <div className="p-6 bg-gradient-to-br from-primary-50 to-purple-50 border-b border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles className="h-5 w-5 text-primary-600" />
                                        <span className="text-sm font-medium text-primary-700">Plan {plan.name}</span>
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">
                                        {formatCurrency(plan.priceARS)}
                                        <span className="text-base font-normal text-gray-500">/mes</span>
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">≈ USD {plan.priceUSD}/mes</p>
                                </div>

                                {/* Features */}
                                <div className="p-6">
                                    <h3 className="text-sm font-medium text-gray-900 mb-3">Incluye:</h3>
                                    <ul className="space-y-2.5">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-600">
                                                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Trial Info */}
                                <div className="p-4 bg-emerald-50 border-t border-emerald-100">
                                    <div className="flex items-center gap-2">
                                        <BadgeCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-emerald-800">
                                                21 días de prueba gratis
                                            </p>
                                            <p className="text-xs text-emerald-600 mt-0.5">
                                                Cancelá cuando quieras. Sin compromiso.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Payment Methods & Checkout */}
                    <div className="lg:col-span-3 order-1 lg:order-2">
                        <h1 className="text-2xl font-bold text-gray-900 mb-1">
                            Completá tu suscripción
                        </h1>
                        <p className="text-gray-500 mb-8">
                            Elegí cómo querés pagar. Todas las opciones son procesadas de forma segura.
                        </p>

                        {/* Accepted Payment Methods */}
                        <div className="mb-6">
                            <h2 className="text-sm font-medium text-gray-700 mb-3">
                                Medios de pago aceptados
                            </h2>
                            <div className="space-y-3">
                                <PaymentMethodCard
                                    icon={CreditCard}
                                    title="Tarjeta de crédito"
                                    description="Hasta 12 cuotas sin interés"
                                    brands={['Visa', 'Mastercard', 'American Express', 'Naranja', 'Cabal']}
                                />
                                <PaymentMethodCard
                                    icon={CreditCard}
                                    title="Tarjeta de débito"
                                    description="Débito inmediato de tu cuenta"
                                    brands={['Visa Débito', 'Maestro', 'Cabal Débito']}
                                />
                                <PaymentMethodCard
                                    icon={Building2}
                                    title="Transferencia bancaria"
                                    description="Transferencia directa desde tu banco"
                                    brands={['CBU', 'CVU', 'Alias']}
                                />
                                <PaymentMethodCard
                                    icon={Wallet}
                                    title="Dinero en MercadoPago"
                                    description="Pagá con tu saldo de MercadoPago"
                                />
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Checkout Button */}
                        <button
                            onClick={handleCheckout}
                            disabled={isProcessing}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-primary-600 text-white rounded-xl font-semibold text-lg hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary-600/20"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    Pagar {formatCurrency(plan.priceARS)}
                                    <ArrowRight className="h-5 w-5" />
                                </>
                            )}
                        </button>

                        <p className="text-center text-xs text-gray-400 mt-3">
                            Serás redirigido a una página segura para completar el pago
                        </p>

                        {/* Trust Signals */}
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <Shield className="h-6 w-6 text-gray-400 mx-auto mb-1.5" />
                                    <p className="text-xs text-gray-500">Pago 100% seguro</p>
                                </div>
                                <div>
                                    <BadgeCheck className="h-6 w-6 text-gray-400 mx-auto mb-1.5" />
                                    <p className="text-xs text-gray-500">21 días gratis</p>
                                </div>
                                <div>
                                    <CheckCircle className="h-6 w-6 text-gray-400 mx-auto mb-1.5" />
                                    <p className="text-xs text-gray-500">Cancelá cuando quieras</p>
                                </div>
                            </div>
                        </div>

                        {/* Skip for now */}
                        <div className="mt-6 text-center">
                            <Link
                                href="/dashboard"
                                className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
                            >
                                Continuar sin pagar (usar prueba gratuita)
                            </Link>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-100 mt-16">
                <div className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-gray-400">
                    <p>
                        Pago procesado de forma segura por{' '}
                        <span className="font-medium text-gray-500">Mercado Pago</span>
                        {' '}·{' '}
                        Aceptamos tarjetas de crédito, débito, transferencia y efectivo
                    </p>
                    <p className="mt-2">
                        Al suscribirte aceptás los{' '}
                        <Link href="/terminos" className="text-primary-500 hover:underline">
                            Términos de Servicio
                        </Link>
                        {' '}y la{' '}
                        <Link href="/privacidad" className="text-primary-500 hover:underline">
                            Política de Privacidad
                        </Link>
                    </p>
                </div>
            </footer>
        </div>
    );
}
