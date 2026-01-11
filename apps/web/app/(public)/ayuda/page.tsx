/**
 * Phase 7.2: FAQ Page
 * ====================
 * 
 * Public FAQ page with common questions and answers.
 * /ayuda
 */

import Link from 'next/link';
import {
    ChevronDown,
    MessageSquare,
    CreditCard,
    Smartphone,
    Shield,
    MapPin,
    FileText,
    HelpCircle,
    ExternalLink,
} from 'lucide-react';

export const metadata = {
    title: 'Preguntas Frecuentes | CampoTech',
    description: 'Respuestas a las preguntas más comunes sobre CampoTech. Facturación, WhatsApp AI, subscripciones, y más.',
};

// ═══════════════════════════════════════════════════════════════════════════════
// FAQ DATA
// ═══════════════════════════════════════════════════════════════════════════════

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQCategory {
    id: string;
    title: string;
    icon: React.ReactNode;
    items: FAQItem[];
}

const FAQ_CATEGORIES: FAQCategory[] = [
    {
        id: 'general',
        title: 'General',
        icon: <HelpCircle className="w-5 h-5" />,
        items: [
            {
                question: '¿Qué es CampoTech?',
                answer: 'CampoTech es una plataforma todo-en-uno para profesionales de servicios técnicos en Argentina. Te ayuda a gestionar trabajos, clientes, facturación AFIP, y comunicación con clientes via WhatsApp con IA.',
            },
            {
                question: '¿CampoTech tiene costo?',
                answer: 'CampoTech tiene un plan gratuito con funcionalidades básicas y planes pagos con más características. Podés empezar gratis y actualizar cuando quieras.',
            },
            {
                question: '¿En qué zonas funciona CampoTech?',
                answer: 'CampoTech está diseñado para toda Argentina. Soportamos facturación AFIP, zonas horarias argentinas, y estamos optimizados para profesionales locales.',
            },
            {
                question: '¿Cómo creo una cuenta?',
                answer: 'Podés registrarte con tu email o cuenta de Google. El proceso toma menos de 2 minutos y no necesitás tarjeta de crédito para empezar.',
            },
        ],
    },
    {
        id: 'facturacion',
        title: 'Facturación AFIP',
        icon: <FileText className="w-5 h-5" />,
        items: [
            {
                question: '¿Cómo conecto mi cuenta de AFIP?',
                answer: 'Andá a Configuración > AFIP y seguí los pasos. Necesitás tu CUIT, certificado digital, y clave privada. Te guiamos paso a paso en el proceso.',
            },
            {
                question: '¿CampoTech genera facturas legales?',
                answer: 'Sí, CampoTech está integrado con los web services de AFIP y genera facturas electrónicas oficiales con CAE (Código de Autorización Electrónico).',
            },
            {
                question: '¿Puedo facturar como Monotributista?',
                answer: 'Sí, soportamos todas las categorías de Monotributo desde A hasta K. También mostramos alertas cuando te acercás al límite de facturación de tu categoría.',
            },
            {
                question: '¿Qué tipos de comprobante puedo emitir?',
                answer: 'Podés emitir Factura C (para Monotributistas), Factura A y B (para Responsables Inscriptos), y Notas de Crédito correspondientes.',
            },
        ],
    },
    {
        id: 'whatsapp',
        title: 'WhatsApp AI',
        icon: <MessageSquare className="w-5 h-5" />,
        items: [
            {
                question: '¿Qué es WhatsApp AI?',
                answer: 'WhatsApp AI es un asistente inteligente que responde automáticamente a tus clientes por WhatsApp. Puede dar información sobre tus servicios, agendar citas, y crear trabajos automáticamente.',
            },
            {
                question: '¿Cómo funcionan los créditos de WhatsApp?',
                answer: 'Cada conversación con un cliente consume 1 crédito. Una conversación incluye todos los mensajes intercambiados hasta que se cierra el tema. Los créditos no vencen.',
            },
            {
                question: '¿Qué pasa si me quedo sin créditos?',
                answer: 'La primera vez que te quedás sin créditos, se activan 50 créditos de emergencia (uso único). Después de usar esos, tu WhatsApp vuelve al modo gratuito con link directo a tu número personal.',
            },
            {
                question: '¿Necesito un número de WhatsApp especial?',
                answer: 'Para WhatsApp AI necesitás un número de WhatsApp Business dedicado. Podés usar la opción gratuita (link a tu WhatsApp personal) o la opción premium con número dedicado y IA.',
            },
        ],
    },
    {
        id: 'pagos',
        title: 'Pagos y Subscripciones',
        icon: <CreditCard className="w-5 h-5" />,
        items: [
            {
                question: '¿Qué métodos de pago aceptan?',
                answer: 'Aceptamos Mercado Pago (tarjetas de crédito, débito, y saldo en cuenta). También podés pagar en efectivo en Rapipago o Pago Fácil.',
            },
            {
                question: '¿Puedo cancelar mi subscripción?',
                answer: 'Sí, podés cancelar en cualquier momento desde Configuración > Subscripción. Según la Ley 24.240 de Defensa del Consumidor, no hay penalidades por cancelación.',
            },
            {
                question: '¿Hay reembolsos?',
                answer: 'Ofrecemos reembolsos dentro de los primeros 7 días si no estás satisfecho. Después de ese período, la cancelación aplica para el próximo período de facturación.',
            },
            {
                question: '¿Cómo actualizo mi plan?',
                answer: 'Podés actualizar tu plan en cualquier momento desde Configuración > Subscripción. El cambio se aplica inmediatamente y se prorratea el costo.',
            },
        ],
    },
    {
        id: 'app',
        title: 'App Móvil',
        icon: <Smartphone className="w-5 h-5" />,
        items: [
            {
                question: '¿Hay app para celular?',
                answer: 'Sí, tenemos apps para iOS y Android. Podés descargarlas desde App Store o Google Play buscando "CampoTech".',
            },
            {
                question: '¿Qué puedo hacer desde la app?',
                answer: 'Desde la app podés ver y gestionar trabajos, navegar a direcciones de clientes, tomar fotos de trabajos, y marcar trabajos como completados. Funciona offline.',
            },
            {
                question: '¿La app funciona sin internet?',
                answer: 'Sí, la app guarda tus trabajos del día localmente. Cuando recuperes conexión, se sincroniza automáticamente con el servidor.',
            },
        ],
    },
    {
        id: 'seguridad',
        title: 'Seguridad y Privacidad',
        icon: <Shield className="w-5 h-5" />,
        items: [
            {
                question: '¿Mis datos están seguros?',
                answer: 'Sí, usamos encriptación de nivel bancario para proteger tus datos. Tus credenciales de AFIP se almacenan encriptadas y nunca se comparten con terceros.',
            },
            {
                question: '¿Quién puede ver mis datos?',
                answer: 'Solo vos y los miembros de tu equipo que autorices. No vendemos ni compartimos datos con terceros para publicidad.',
            },
            {
                question: '¿Cómo elimino mi cuenta?',
                answer: 'Podés solicitar la eliminación de tu cuenta desde Configuración > Cuenta > Eliminar cuenta. Según la Ley de Protección de Datos Personales, te eliminaremos completamente en 30 días.',
            },
        ],
    },
    {
        id: 'zonas',
        title: 'Zonas y Cobertura',
        icon: <MapPin className="w-5 h-5" />,
        items: [
            {
                question: '¿Cómo configuro mis zonas de trabajo?',
                answer: 'En Configuración > Zonas podés definir las áreas donde ofrecés servicios. Esto ayuda a que clientes cercanos te encuentren primero.',
            },
            {
                question: '¿Puedo trabajar en múltiples ciudades?',
                answer: 'Sí, podés configurar múltiples zonas de cobertura. El sistema optimiza las rutas y te muestra trabajos cercanos primero.',
            },
        ],
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function FAQPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2 text-emerald-600 font-bold text-xl">
                            CampoTech
                        </Link>
                        <Link
                            href="/"
                            className="text-gray-600 hover:text-gray-900 text-sm flex items-center gap-1"
                        >
                            Ir al sitio <ExternalLink className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-16">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h1 className="text-4xl font-bold mb-4">
                        Preguntas Frecuentes
                    </h1>
                    <p className="text-emerald-100 text-lg">
                        Respuestas rápidas a las dudas más comunes
                    </p>
                </div>
            </div>

            {/* Category Navigation */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-3">
                    <div className="flex gap-2 overflow-x-auto pb-2 -mb-2">
                        {FAQ_CATEGORIES.map((category) => (
                            <a
                                key={category.id}
                                href={`#${category.id}`}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 rounded-full whitespace-nowrap text-sm font-medium transition-colors"
                            >
                                {category.icon}
                                {category.title}
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            {/* FAQ Content */}
            <main className="max-w-4xl mx-auto px-4 py-8 space-y-12">
                {FAQ_CATEGORIES.map((category) => (
                    <section key={category.id} id={category.id}>
                        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                            <span className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                {category.icon}
                            </span>
                            {category.title}
                        </h2>

                        <div className="space-y-4">
                            {category.items.map((item, index) => (
                                <FAQAccordion key={index} item={item} />
                            ))}
                        </div>
                    </section>
                ))}
            </main>

            {/* Still Need Help */}
            <section className="bg-white border-t border-gray-200 py-12">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        ¿No encontraste lo que buscabas?
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Nuestro equipo de soporte está listo para ayudarte
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a
                            href="mailto:soporte@campotech.com.ar"
                            className="inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                        >
                            📧 Contactar soporte
                        </a>
                        <Link
                            href="/estado"
                            className="inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                        >
                            📊 Ver estado del sistema
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-8">
                <div className="max-w-4xl mx-auto px-4 text-center text-sm">
                    <p>© 2026 CampoTech. Todos los derechos reservados.</p>
                </div>
            </footer>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCORDION COMPONENT (Client-side interactivity via details/summary)
// ═══════════════════════════════════════════════════════════════════════════════

function FAQAccordion({ item }: { item: FAQItem }) {
    return (
        <details className="group bg-white rounded-xl border border-gray-200 overflow-hidden">
            <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors list-none">
                <span className="font-medium text-gray-900 pr-4">{item.question}</span>
                <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="px-4 pb-4 pt-0">
                <p className="text-gray-600 leading-relaxed">{item.answer}</p>
            </div>
        </details>
    );
}
