/**
 * Terms of Service Page
 * =====================
 *
 * Public terms of service page.
 * Route: /terms
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Términos de Servicio | CampoTech',
  description: 'Términos y condiciones de uso de la plataforma CampoTech.',
};

export default function TermsPage() {
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
            <FileText className="h-8 w-8 text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Términos de Servicio
              </h1>
              <p className="text-sm text-gray-500">
                Última actualización: Enero 2026
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="prose prose-gray max-w-none">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-8">
              <p className="text-blue-800 text-sm">
                <strong>Aviso:</strong> Este documento establece los términos
                generales de uso de la plataforma. Se recomienda revisión legal
                profesional antes del lanzamiento comercial.
              </p>
            </div>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                1. Aceptación de los términos
              </h2>
              <p className="text-gray-600">
                Al acceder y utilizar CampoTech, aceptás estos términos de
                servicio. Si no estás de acuerdo con alguna parte de estos
                términos, no debés utilizar la plataforma.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                2. Descripción del servicio
              </h2>
              <p className="text-gray-600">
                CampoTech es una plataforma de gestión de servicios de campo que
                permite a las empresas gestionar técnicos, órdenes de trabajo,
                clientes y facturación.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                3. Cuentas de usuario
              </h2>
              <p className="text-gray-600">
                Sos responsable de mantener la confidencialidad de tu cuenta y
                contraseña. Debés notificarnos inmediatamente cualquier uso no
                autorizado de tu cuenta.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                4. Uso aceptable
              </h2>
              <p className="text-gray-600">
                Te comprometés a usar CampoTech solo para fines legales y de
                acuerdo con estos términos. Está prohibido el uso de la
                plataforma para actividades fraudulentas o ilegales.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                5. Facturación y pagos
              </h2>
              <p className="text-gray-600">
                Los precios y planes de suscripción están disponibles en nuestra
                página de precios. Los pagos se procesan a través de MercadoPago
                de forma segura.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                6. Propiedad intelectual
              </h2>
              <p className="text-gray-600">
                CampoTech y su contenido son propiedad de CampoTech S.R.L. Los
                datos que subas a la plataforma siguen siendo de tu propiedad.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                7. Naturaleza del servicio y responsabilidades
              </h2>
              <div className="text-gray-600 space-y-4">
                <p>
                  <strong>7.1 CampoTech como herramienta de gestión:</strong>{' '}
                  CampoTech es una plataforma de software (SaaS) que provee
                  herramientas de gestión empresarial. CampoTech NO es un
                  proveedor de servicios de campo, ni actúa como intermediario
                  entre empresas y consumidores finales.
                </p>
                <p>
                  <strong>7.2 Responsabilidad del usuario:</strong> El usuario
                  de CampoTech (la empresa de servicios) es el único responsable de:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    Verificar las habilitaciones profesionales de su personal
                    (matrículas de gasista, electricista, instalador, etc.)
                  </li>
                  <li>
                    Cumplir con las normativas aplicables a su rubro (ENARGAS,
                    ENRE, AEA, normativas provinciales y municipales)
                  </li>
                  <li>
                    La relación laboral o contractual con sus empleados y
                    contratistas
                  </li>
                  <li>
                    La calidad, seguridad y legalidad de los servicios prestados
                    a sus clientes finales
                  </li>
                  <li>
                    La veracidad de los datos cargados en la plataforma,
                    incluyendo matrículas y certificaciones
                  </li>
                </ul>
                <p>
                  <strong>7.3 No verificación de habilitaciones:</strong>{' '}
                  CampoTech no verifica la validez de las matrículas profesionales
                  ni las habilitaciones declaradas por los usuarios. Los campos
                  de &quot;matrícula&quot; y &quot;especialidad&quot; son informativos y su
                  veracidad es responsabilidad exclusiva del usuario.
                </p>
                <p>
                  <strong>7.4 Facturación electrónica:</strong> Si el usuario
                  utiliza CampoTech para generar facturas electrónicas, es
                  responsable de la correcta configuración de sus datos fiscales
                  ante AFIP y del cumplimiento de las normativas de facturación.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                8. Limitación de responsabilidad
              </h2>
              <p className="text-gray-600">
                CampoTech no será responsable por daños indirectos, incidentales
                o consecuentes que resulten del uso de la plataforma, incluyendo
                pero no limitado a: daños derivados de servicios prestados por
                usuarios a terceros, incumplimientos regulatorios de los usuarios,
                o accidentes laborales.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                9. Modificaciones
              </h2>
              <p className="text-gray-600">
                Nos reservamos el derecho de modificar estos términos en
                cualquier momento. Te notificaremos de cambios significativos
                con al menos 30 días de anticipación.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                10. Ley aplicable
              </h2>
              <p className="text-gray-600">
                Estos términos se rigen por las leyes de la República Argentina.
                Cualquier disputa será resuelta por los tribunales ordinarios de
                la Ciudad Autónoma de Buenos Aires.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                11. Contacto
              </h2>
              <p className="text-gray-600">
                Para consultas sobre estos términos, contactanos en{' '}
                <a
                  href="mailto:legal@campotech.com"
                  className="text-primary-600 hover:underline"
                >
                  legal@campotech.com
                </a>
              </p>
            </section>
          </div>
        </div>

        {/* Related Links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm">
          <Link href="/privacy" className="text-primary-600 hover:underline">
            Política de Privacidad
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/cookies" className="text-primary-600 hover:underline">
            Política de Cookies
          </Link>
        </div>
      </main>
    </div>
  );
}
