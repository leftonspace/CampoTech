/**
 * Botón de Arrepentimiento Page (Ley 24.240)
 * ==========================================
 *
 * Public page for subscription cancellation per Argentine Consumer Protection Law.
 * Route: /arrepentimiento
 *
 * Key requirements:
 * - Visible and accessible cancellation option
 * - 10-day withdrawal period for full refund
 * - Clear process explanation
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, XCircle, Shield, Clock, CreditCard, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Botón de Arrepentimiento | CampoTech',
  description:
    'Cancelá tu suscripción a CampoTech. Derecho de arrepentimiento según Ley 24.240.',
};

export default function ArrepentimientoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver al inicio
          </Link>
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-danger-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Botón de Arrepentimiento
              </h1>
              <p className="text-sm text-gray-500">
                Ley 24.240 - Defensa del Consumidor
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Info Banner */}
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-4">
            <Shield className="h-6 w-6 text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-primary-900">Tu derecho está protegido</h2>
              <p className="text-primary-700 mt-1">
                Según la Ley 24.240 de Defensa del Consumidor, tenés derecho a
                arrepentirte de tu compra dentro de los <strong>10 días corridos</strong> desde
                la contratación y recibir un reembolso completo.
              </p>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                Período de Arrepentimiento
              </h2>
              <p className="text-gray-600">
                Tenés <strong>10 días corridos</strong> desde la fecha de contratación
                para ejercer tu derecho de arrepentimiento sin necesidad de justificar
                tu decisión. Durante este período:
              </p>
              <ul className="list-disc list-inside text-gray-600 mt-4 space-y-2">
                <li>Podés cancelar tu suscripción en cualquier momento</li>
                <li>Recibirás un reembolso completo del importe pagado</li>
                <li>El reembolso se procesará en un plazo máximo de 10 días hábiles</li>
                <li>
                  El reembolso se realizará por el mismo medio de pago utilizado para
                  la contratación
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-gray-500" />
                Cómo cancelar tu suscripción
              </h2>

              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Opción 1: Desde tu cuenta (recomendado)
                  </h3>
                  <ol className="list-decimal list-inside text-gray-600 space-y-1">
                    <li>
                      Iniciá sesión en tu cuenta de CampoTech
                    </li>
                    <li>
                      Andá a{' '}
                      <Link
                        href="/dashboard/settings/billing"
                        className="text-primary-600 hover:underline"
                      >
                        Configuración → Plan y Facturación
                      </Link>
                    </li>
                    <li>Hacé clic en &quot;Cancelar suscripción&quot;</li>
                    <li>Confirmá la cancelación</li>
                  </ol>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Opción 2: Por correo electrónico
                  </h3>
                  <p className="text-gray-600">
                    Enviá un correo a{' '}
                    <a
                      href="mailto:arrepentimiento@campotech.com"
                      className="text-primary-600 hover:underline"
                    >
                      arrepentimiento@campotech.com
                    </a>{' '}
                    con:
                  </p>
                  <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
                    <li>Asunto: &quot;Solicitud de Arrepentimiento&quot;</li>
                    <li>Tu email de registro</li>
                    <li>Nombre de tu empresa</li>
                    <li>Fecha de contratación</li>
                  </ul>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Opción 3: Por WhatsApp
                  </h3>
                  <p className="text-gray-600">
                    Escribinos al{' '}
                    <a
                      href="https://wa.me/5491100000000?text=Quiero%20cancelar%20mi%20suscripción"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline"
                    >
                      +54 9 11 0000-0000
                    </a>{' '}
                    indicando que querés ejercer tu derecho de arrepentimiento.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Después del período de 10 días
              </h2>
              <p className="text-gray-600">
                Si han pasado más de 10 días desde tu contratación, igualmente podés
                cancelar tu suscripción. En este caso:
              </p>
              <ul className="list-disc list-inside text-gray-600 mt-4 space-y-2">
                <li>
                  Tu suscripción se cancelará al final del período de facturación actual
                </li>
                <li>
                  Podrás seguir usando CampoTech hasta esa fecha
                </li>
                <li>
                  No se realizará ningún cobro adicional
                </li>
                <li>
                  Tu cuenta pasará automáticamente al plan gratuito
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Marco Legal
              </h2>
              <p className="text-gray-600">
                Este derecho está garantizado por la{' '}
                <a
                  href="https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/638/texact.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline"
                >
                  Ley 24.240 de Defensa del Consumidor
                </a>{' '}
                (Artículo 34) y sus modificatorias. Para más información, podés
                consultar en la{' '}
                <a
                  href="https://www.argentina.gob.ar/produccion/defensadelconsumidor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline"
                >
                  Dirección Nacional de Defensa del Consumidor
                </a>
                .
              </p>
            </section>
          </div>
        </div>

        {/* CTA for logged-in users */}
        <div className="mt-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200 text-center">
          <h3 className="font-semibold text-gray-900 mb-2">
            ¿Querés cancelar tu suscripción ahora?
          </h3>
          <p className="text-gray-600 mb-4">
            Si ya tenés una cuenta, podés gestionar tu suscripción desde el panel
            de configuración.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-2 border border-primary-500 text-primary-600 rounded-lg hover:bg-primary-50 font-medium transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/dashboard/settings/billing"
              className="inline-flex items-center justify-center px-6 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 font-medium transition-colors"
            >
              Ir a Cancelar Suscripción
            </Link>
          </div>
        </div>

        {/* Related Links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm">
          <Link href="/privacy" className="text-primary-600 hover:underline">
            Política de Privacidad
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/terms" className="text-primary-600 hover:underline">
            Términos de Servicio
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/cookies" className="text-primary-600 hover:underline">
            Política de Cookies
          </Link>
        </div>

        {/* Contact */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            ¿Tenés dudas? Contactanos en{' '}
            <a
              href="mailto:soporte@campotech.com"
              className="text-primary-600 hover:underline"
            >
              soporte@campotech.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
