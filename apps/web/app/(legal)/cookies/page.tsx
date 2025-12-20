/**
 * Cookie Policy Page
 * ==================
 *
 * Public cookie policy page.
 * Route: /cookies
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Cookie } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Cookies | CampoTech',
  description: 'Información sobre el uso de cookies en CampoTech.',
};

export default function CookiesPage() {
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
            <Cookie className="h-8 w-8 text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Política de Cookies
              </h1>
              <p className="text-sm text-gray-500">
                Última actualización: Diciembre 2025
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                ¿Qué son las cookies?
              </h2>
              <p className="text-gray-600">
                Las cookies son pequeños archivos de texto que se almacenan en tu
                dispositivo cuando visitás un sitio web. Se utilizan para mejorar
                tu experiencia de navegación y recordar tus preferencias.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Cookies que utilizamos
              </h2>

              <h3 className="font-semibold text-gray-800 mb-2 mt-4">
                Cookies esenciales
              </h3>
              <p className="text-gray-600 mb-4">
                Son necesarias para el funcionamiento de la plataforma. Sin
                ellas, no podrías iniciar sesión ni usar funciones básicas.
              </p>
              <div className="overflow-x-auto mb-6">
                <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-900">
                        Cookie
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-900">
                        Propósito
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-900">
                        Duración
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    <tr className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">
                        accessToken
                      </td>
                      <td className="px-4 py-2">Autenticación de sesión</td>
                      <td className="px-4 py-2">7 días</td>
                    </tr>
                    <tr className="border-t bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs">
                        refreshToken
                      </td>
                      <td className="px-4 py-2">Renovación de sesión</td>
                      <td className="px-4 py-2">30 días</td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">
                        __csrf
                      </td>
                      <td className="px-4 py-2">Protección CSRF</td>
                      <td className="px-4 py-2">Sesión</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="font-semibold text-gray-800 mb-2">
                Cookies de preferencias
              </h3>
              <p className="text-gray-600 mb-4">
                Guardan tus preferencias como tema oscuro, idioma, y configuración
                de la interfaz.
              </p>
              <div className="overflow-x-auto mb-6">
                <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-900">
                        Cookie
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-900">
                        Propósito
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-900">
                        Duración
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    <tr className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">theme</td>
                      <td className="px-4 py-2">Preferencia de tema</td>
                      <td className="px-4 py-2">1 año</td>
                    </tr>
                    <tr className="border-t bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs">sidebar</td>
                      <td className="px-4 py-2">Estado del menú lateral</td>
                      <td className="px-4 py-2">1 año</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="font-semibold text-gray-800 mb-2">
                Cookies de análisis
              </h3>
              <p className="text-gray-600 mb-4">
                Nos ayudan a entender cómo usás la plataforma para poder
                mejorarla. Estos datos son anónimos.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-900">
                        Cookie
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-900">
                        Proveedor
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-900">
                        Propósito
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    <tr className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">
                        _vercel_insights
                      </td>
                      <td className="px-4 py-2">Vercel</td>
                      <td className="px-4 py-2">Métricas de rendimiento</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Cómo gestionar las cookies
              </h2>
              <p className="text-gray-600 mb-4">
                Podés configurar tu navegador para rechazar cookies. Sin embargo,
                esto puede afectar el funcionamiento de CampoTech.
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>
                  <a
                    href="https://support.google.com/chrome/answer/95647"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    Chrome
                  </a>
                </li>
                <li>
                  <a
                    href="https://support.mozilla.org/es/kb/cookies-informacion-que-los-sitios-web-guardan-en-"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    Firefox
                  </a>
                </li>
                <li>
                  <a
                    href="https://support.apple.com/es-es/guide/safari/sfri11471/mac"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    Safari
                  </a>
                </li>
                <li>
                  <a
                    href="https://support.microsoft.com/es-es/windows/eliminar-y-administrar-cookies-168dab11-0753-043d-7c16-ede5947fc64d"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    Edge
                  </a>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Contacto
              </h2>
              <p className="text-gray-600">
                Para consultas sobre el uso de cookies, contactanos en{' '}
                <a
                  href="mailto:privacidad@campotech.com"
                  className="text-primary-600 hover:underline"
                >
                  privacidad@campotech.com
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
          <Link href="/terms" className="text-primary-600 hover:underline">
            Términos de Servicio
          </Link>
        </div>
      </main>
    </div>
  );
}
