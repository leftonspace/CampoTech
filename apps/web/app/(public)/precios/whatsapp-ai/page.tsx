/**
 * Phase 4.8: WhatsApp AI Public Pricing Page
 * ============================================
 * 
 * Transparent pricing page explaining free vs premium WhatsApp options.
 * /precios/whatsapp-ai
 */

import Link from 'next/link';
import { Check, X, AlertCircle, Sparkles, Link as LinkIcon, Bot } from 'lucide-react';

export const metadata = {
    title: 'WhatsApp con Inteligencia Artificial - Precios | CampoTech',
    description: 'Automatizá tus respuestas de WhatsApp con IA. Precios transparentes, sin sorpresas. Desde $12.000 por 200 conversaciones.',
};

const CREDIT_PACKAGES = [
    {
        name: 'Starter',
        credits: 200,
        priceARS: 12000,
        pricePerCredit: 60,
        description: 'Ideal para comenzar',
        popular: false,
    },
    {
        name: 'Standard',
        credits: 500,
        priceARS: 25000,
        pricePerCredit: 50,
        description: 'Mejor relación precio/calidad',
        popular: true,
    },
    {
        name: 'Profesional',
        credits: 1000,
        priceARS: 45000,
        pricePerCredit: 45,
        description: 'Para negocios en crecimiento',
        popular: false,
    },
    {
        name: 'Empresa',
        credits: 5000,
        priceARS: 175000,
        pricePerCredit: 35,
        description: 'Máximo ahorro',
        popular: false,
    },
];

export default function WhatsAppAIPricingPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <Link href="/" className="text-emerald-600 hover:text-emerald-700 font-medium">
                        ← Volver al inicio
                    </Link>
                </div>
            </div>

            {/* Hero */}
            <div className="max-w-4xl mx-auto px-4 py-16 text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                    WhatsApp Inteligente para <span className="text-emerald-600">Profesionales</span>
                </h1>
                <p className="text-xl text-gray-600 mb-8">
                    Elegí el nivel de automatización que necesitás. Sin letra chica, sin sorpresas.
                </p>
            </div>

            {/* Comparison Section */}
            <div className="max-w-6xl mx-auto px-4 pb-16">
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Free Option */}
                    <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <LinkIcon className="w-6 h-6 text-gray-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Opción Gratuita</h2>
                                <p className="text-gray-600">Link de WhatsApp</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <div className="text-3xl font-bold text-gray-900">$0</div>
                            <div className="text-sm text-gray-600">Para siempre • Incluído en todos los planes</div>
                        </div>

                        <div className="space-y-4 mb-8">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Check className="w-5 h-5 text-emerald-600" />
                                Qué incluye:
                            </h3>
                            <ul className="space-y-2 text-gray-600">
                                <li className="flex items-start gap-2">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Link directo a tu WhatsApp personal</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Clientes hacen click → abre chat con vos</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Sin costo adicional ni límites</span>
                                </li>
                            </ul>

                            <h3 className="font-semibold text-gray-900 flex items-center gap-2 pt-4">
                                <X className="w-5 h-5 text-gray-400" />
                                Qué NO incluye:
                            </h3>
                            <ul className="space-y-2 text-gray-600">
                                <li className="flex items-start gap-2">
                                    <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                    <span>Asistente AI que responde automáticamente</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                    <span>Creación automática de trabajos</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                    <span>Análisis de conversaciones</span>
                                </li>
                            </ul>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm font-medium text-gray-900 mb-2">📱 Ejemplo:</div>
                            <p className="text-sm text-gray-600">
                                {"\"Juan envía un mensaje a tu WhatsApp. Vos lo recibís en tu teléfono personal y respondés manualmente cuando podés.\""}
                            </p>
                        </div>
                    </div>

                    {/* Premium Option */}
                    <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl shadow-lg border-2 border-emerald-200 p-8 relative">
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                            <div className="bg-emerald-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                                Recomendado por profesionales
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <Bot className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Opción Premium</h2>
                                <p className="text-gray-600">WhatsApp con IA</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <div className="text-3xl font-bold text-gray-900">Desde $12.000</div>
                            <div className="text-sm text-gray-600">200 conversaciones • Pago único</div>
                        </div>

                        <div className="space-y-4 mb-8">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-emerald-600" />
                                Qué incluye:
                            </h3>
                            <ul className="space-y-2 text-gray-600">
                                <li className="flex items-start gap-2">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Número de WhatsApp Business dedicado (separado de tu personal)</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Asistente AI que responde automáticamente 24/7</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Crea trabajos desde los mensajes de clientes</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Análisis de todas tus conversaciones</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span>Respuestas inteligentes basadas en tus servicios</span>
                                </li>
                            </ul>
                        </div>

                        <div className="bg-emerald-50 rounded-lg p-4">
                            <div className="text-sm font-medium text-gray-900 mb-2">🤖 Ejemplo:</div>
                            <p className="text-sm text-gray-600">
                                {`"Juan manda mensaje a las 11pm preguntando por un presupuesto. El AI responde: 'Hola Juan, soy el asistente de Pedro. Gracias por escribirnos. ¿Necesitás un presupuesto para reparación de aire acondicionado? Te paso los horarios disponibles de Pedro para esta semana...' Y crea automáticamente un trabajo pendiente para vos."`}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pricing Packages */}
            <div className="bg-gray-50 py-16">
                <div className="max-w-6xl mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
                        Paquetes de Créditos
                    </h2>
                    <p className="text-center text-gray-600 mb-12">
                        1 crédito = 1 conversación de WhatsApp con IA • Sin vencimiento
                    </p>

                    <div className="grid md:grid-cols-4 gap-6">
                        {CREDIT_PACKAGES.map((pkg) => (
                            <div
                                key={pkg.name}
                                className={`bg-white rounded-xl shadow-sm p-6 relative ${pkg.popular ? 'ring-2 ring-emerald-600' : 'border border-gray-200'
                                    }`}
                            >
                                {pkg.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                                            Más elegido
                                        </span>
                                    </div>
                                )}

                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
                                    <div className="text-3xl font-bold text-emerald-600 mb-1">
                                        ${pkg.priceARS.toLocaleString()}
                                    </div>
                                    <div className="text-sm text-gray-600 mb-4">{pkg.description}</div>

                                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                                        <div className="text-2xl font-bold text-gray-900">{pkg.credits}</div>
                                        <div className="text-xs text-gray-600">créditos</div>
                                    </div>

                                    <div className="text-sm text-gray-600 mb-6">
                                        ${pkg.pricePerCredit} por crédito
                                    </div>

                                    <Link
                                        href="/login"
                                        className={`block w-full py-2 px-4 rounded-lg font-medium text-center transition-colors ${pkg.popular
                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                            }`}
                                    >
                                        Comprar
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Grace Period Explanation */}
            <div className="max-w-4xl mx-auto px-4 py-16">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <AlertCircle className="w-7 h-7 text-amber-600" />
                        ¿Qué pasa si se me acaban los créditos?
                    </h2>

                    <ol className="space-y-4 text-gray-700">
                        <li className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-amber-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                                1
                            </div>
                            <div>
                                <strong className="text-gray-900">Primera vez:</strong> Se activan automáticamente 50 créditos de emergencia (gratis, uso único). El AI sigue funcionando normalmente.
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-amber-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                                2
                            </div>
                            <div>
                                <strong className="text-gray-900">Si comprás antes de usar los de emergencia:</strong> Los créditos de emergencia que no usaste se pierden (no son acumulables).
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-amber-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                                3
                            </div>
                            <div>
                                <strong className="text-gray-900">Si usás todos los de emergencia:</strong> Tu WhatsApp vuelve a la opción gratuita (link a tu número personal). Podés seguir recibiendo mensajes.
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                                ✓
                            </div>
                            <div>
                                <strong className="text-gray-900">NUNCA perdés mensajes:</strong> Siempre te llegan, solo que sin las funciones de AI.
                            </div>
                        </li>
                    </ol>
                </div>
            </div>

            {/* CTA Section */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-16">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-3xl font-bold mb-4">
                        ¿Listo para automatizar tu WhatsApp?
                    </h2>
                    <p className="text-emerald-100 text-lg mb-8">
                        Probá CampoTech gratis por 21 días. Sin tarjeta de crédito.
                    </p>
                    <Link
                        href="/login"
                        className="inline-block bg-white text-emerald-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors"
                    >
                        Comenzar ahora →
                    </Link>
                </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-900 text-gray-400 py-8">
                <div className="max-w-4xl mx-auto px-4 text-center text-sm">
                    <p>© 2026 CampoTech. Todos los derechos reservados.</p>
                </div>
            </div>
        </div>
    );
}
