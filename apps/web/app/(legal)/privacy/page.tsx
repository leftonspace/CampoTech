/**
 * Privacy Policy Page (Phase 7.1.1)
 * ==================================
 *
 * Public privacy policy page per Ley 25.326
 * (Argentina's Personal Data Protection Law)
 *
 * Route: /privacy
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield, Mail, Building2, Scale } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidad | CampoTech',
  description:
    'Política de privacidad y protección de datos personales de CampoTech conforme a la Ley 25.326.',
};

export default function PrivacyPolicyPage() {
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
            <Shield className="h-8 w-8 text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Política de Privacidad
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
          {/* Quick Summary */}
          <div className="mb-8 p-4 bg-primary-50 border border-primary-200 rounded-lg">
            <h2 className="font-semibold text-primary-900 mb-2">
              Resumen de tus derechos
            </h2>
            <ul className="text-sm text-primary-800 space-y-1">
              <li>✓ Acceso a tus datos personales</li>
              <li>✓ Rectificación de datos inexactos</li>
              <li>✓ Supresión de tus datos (con excepciones legales)</li>
              <li>✓ Oposición al tratamiento para fines específicos</li>
              <li>✓ Portabilidad de tus datos</li>
            </ul>
            <p className="text-xs text-primary-700 mt-2">
              Estos derechos están garantizados por la{' '}
              <a
                href="https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                Ley 25.326 de Protección de Datos Personales
              </a>
            </p>
          </div>

          {/* Table of Contents */}
          <nav className="mb-8 p-4 bg-gray-50 rounded-lg">
            <h2 className="font-semibold text-gray-900 mb-3">Contenido</h2>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>
                <a href="#responsable" className="hover:text-primary-600">
                  Responsable del tratamiento
                </a>
              </li>
              <li>
                <a href="#datos-recopilados" className="hover:text-primary-600">
                  Datos que recopilamos
                </a>
              </li>
              <li>
                <a href="#finalidad" className="hover:text-primary-600">
                  Finalidad del tratamiento
                </a>
              </li>
              <li>
                <a href="#base-legal" className="hover:text-primary-600">
                  Base legal
                </a>
              </li>
              <li>
                <a href="#compartir" className="hover:text-primary-600">
                  Cómo compartimos tus datos
                </a>
              </li>
              <li>
                <a href="#retencion" className="hover:text-primary-600">
                  Retención de datos
                </a>
              </li>
              <li>
                <a href="#derechos" className="hover:text-primary-600">
                  Tus derechos (ARCO)
                </a>
              </li>
              <li>
                <a href="#seguridad" className="hover:text-primary-600">
                  Medidas de seguridad
                </a>
              </li>
              <li>
                <a href="#contacto" className="hover:text-primary-600">
                  Contacto
                </a>
              </li>
            </ol>
          </nav>

          {/* Sections */}
          <div className="prose prose-gray max-w-none">
            <section id="responsable" className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-gray-400" />
                1. Responsable del tratamiento
              </h2>
              <p className="text-gray-600 mb-4">
                El responsable del tratamiento de tus datos personales es:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg text-sm">
                <p className="font-medium text-gray-900">
                  CampoTech S.R.L.
                </p>
                <p className="text-gray-600">
                  {/* Note: This should be replaced with actual company information */}
                  Domicilio: [Dirección de la empresa]
                  <br />
                  CUIT: [CUIT de la empresa]
                  <br />
                  Email: privacidad@campotech.com
                </p>
              </div>
              <p className="text-gray-600 mt-4">
                CampoTech está inscripta en el Registro Nacional de Bases de
                Datos Personales de la Dirección Nacional de Protección de
                Datos Personales (DNPDP) conforme lo establecido en la Ley
                25.326.
              </p>
            </section>

            <section id="datos-recopilados" className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                2. Datos que recopilamos
              </h2>
              <p className="text-gray-600 mb-4">
                Recopilamos los siguientes tipos de datos personales:
              </p>

              <h3 className="font-semibold text-gray-800 mb-2">
                2.1 Datos de identificación
              </h3>
              <ul className="list-disc list-inside text-gray-600 mb-4 ml-4">
                <li>Nombre completo</li>
                <li>Número de teléfono</li>
                <li>Dirección de correo electrónico</li>
                <li>Dirección postal (para servicios)</li>
                <li>CUIT/CUIL (para facturación)</li>
              </ul>

              <h3 className="font-semibold text-gray-800 mb-2">
                2.2 Datos laborales (para técnicos)
              </h3>
              <ul className="list-disc list-inside text-gray-600 mb-4 ml-4">
                <li>Especialidad y habilidades técnicas</li>
                <li>Historial de trabajos realizados</li>
                <li>Ubicación durante jornada laboral (con consentimiento)</li>
                <li>Calificaciones y feedback de clientes</li>
              </ul>

              <h3 className="font-semibold text-gray-800 mb-2">
                2.3 Datos de uso del servicio
              </h3>
              <ul className="list-disc list-inside text-gray-600 mb-4 ml-4">
                <li>Historial de órdenes de trabajo</li>
                <li>Conversaciones de WhatsApp Business</li>
                <li>Grabaciones de audio de órdenes (transcriptas)</li>
                <li>Fotos de trabajos realizados</li>
                <li>Historial de pagos y facturas</li>
              </ul>

              <h3 className="font-semibold text-gray-800 mb-2">
                2.4 Datos técnicos
              </h3>
              <ul className="list-disc list-inside text-gray-600 ml-4">
                <li>Dirección IP</li>
                <li>Tipo de dispositivo y navegador</li>
                <li>Registros de acceso (logs)</li>
              </ul>
            </section>

            <section id="finalidad" className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                3. Finalidad del tratamiento
              </h2>
              <p className="text-gray-600 mb-4">
                Utilizamos tus datos personales para:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>
                  <strong>Prestación del servicio:</strong> Gestionar órdenes
                  de trabajo, coordinar técnicos, y procesar pagos.
                </li>
                <li>
                  <strong>Comunicación:</strong> Enviar notificaciones sobre
                  trabajos, confirmaciones y recordatorios vía WhatsApp, SMS o
                  email.
                </li>
                <li>
                  <strong>Facturación:</strong> Emitir comprobantes fiscales
                  conforme a normativa AFIP.
                </li>
                <li>
                  <strong>Mejora del servicio:</strong> Analizar el uso del
                  sistema para mejorar funcionalidades (datos anonimizados).
                </li>
                <li>
                  <strong>Seguridad:</strong> Detectar fraudes, proteger la
                  plataforma y cumplir obligaciones legales.
                </li>
                <li>
                  <strong>Marketing:</strong> Enviar promociones y novedades
                  (solo con tu consentimiento expreso).
                </li>
              </ul>
            </section>

            <section id="base-legal" className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Scale className="h-5 w-5 text-gray-400" />
                4. Base legal del tratamiento
              </h2>
              <p className="text-gray-600 mb-4">
                El tratamiento de tus datos se basa en:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>
                  <strong>Ejecución de contrato:</strong> Los datos necesarios
                  para prestar el servicio que contratas.
                </li>
                <li>
                  <strong>Obligación legal:</strong> Datos requeridos por AFIP,
                  leyes laborales, y normativa aplicable.
                </li>
                <li>
                  <strong>Consentimiento:</strong> Para el tratamiento de datos
                  opcionales como marketing o ubicación.
                </li>
                <li>
                  <strong>Interés legítimo:</strong> Para mejorar el servicio y
                  garantizar la seguridad de la plataforma.
                </li>
              </ul>
            </section>

            <section id="compartir" className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                5. Cómo compartimos tus datos
              </h2>
              <p className="text-gray-600 mb-4">
                Compartimos tus datos únicamente con:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>
                  <strong>Tu organización:</strong> Los administradores de tu
                  empresa pueden ver datos de empleados y clientes.
                </li>
                <li>
                  <strong>Proveedores de servicios:</strong>
                  <ul className="list-disc list-inside ml-6 mt-1">
                    <li>Supabase (base de datos - servidores en EE.UU.)</li>
                    <li>Vercel (hosting - servidores en EE.UU.)</li>
                    <li>Meta/WhatsApp Business (mensajería)</li>
                    <li>MercadoPago (procesamiento de pagos)</li>
                    <li>AFIP (facturación electrónica)</li>
                    <li>OpenAI (transcripciones de voz - anonimizado)</li>
                  </ul>
                </li>
                <li>
                  <strong>Autoridades:</strong> Cuando lo exija la ley o una
                  orden judicial.
                </li>
              </ul>
              <p className="text-gray-600 mt-4">
                <strong>Nunca vendemos tus datos personales a terceros.</strong>
              </p>
            </section>

            <section id="retencion" className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                6. Retención de datos
              </h2>
              <p className="text-gray-600 mb-4">
                Conservamos tus datos durante los siguientes períodos:
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-900">
                        Tipo de dato
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-900">
                        Período
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-900">
                        Motivo legal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    <tr className="border-t">
                      <td className="px-4 py-2">Facturas y comprobantes</td>
                      <td className="px-4 py-2">10 años</td>
                      <td className="px-4 py-2">AFIP - Ley 11.683</td>
                    </tr>
                    <tr className="border-t bg-gray-50">
                      <td className="px-4 py-2">Registros laborales</td>
                      <td className="px-4 py-2">10 años post-cese</td>
                      <td className="px-4 py-2">Ley 20.744</td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-4 py-2">Registros de auditoría</td>
                      <td className="px-4 py-2">5 años</td>
                      <td className="px-4 py-2">Ley 25.326</td>
                    </tr>
                    <tr className="border-t bg-gray-50">
                      <td className="px-4 py-2">Datos de cuenta</td>
                      <td className="px-4 py-2">
                        Mientras la cuenta esté activa
                      </td>
                      <td className="px-4 py-2">Contrato de servicio</td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-4 py-2">Historial de ubicación</td>
                      <td className="px-4 py-2">90 días</td>
                      <td className="px-4 py-2">Operativo/con consentimiento</td>
                    </tr>
                    <tr className="border-t bg-gray-50">
                      <td className="px-4 py-2">Grabaciones de voz</td>
                      <td className="px-4 py-2">30 días</td>
                      <td className="px-4 py-2">Solo transcripción permanente</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section id="derechos" className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                7. Tus derechos (ARCO)
              </h2>
              <p className="text-gray-600 mb-4">
                Conforme a la Ley 25.326, tenés derecho a:
              </p>

              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-1">
                    Acceso (Art. 14)
                  </h3>
                  <p className="text-sm text-gray-600">
                    Solicitar una copia de todos tus datos personales. Podés
                    hacerlo desde{' '}
                    <Link
                      href="/dashboard/settings/privacy"
                      className="text-primary-600 hover:underline"
                    >
                      Configuración &gt; Privacidad
                    </Link>{' '}
                    o enviando un email a privacidad@campotech.com.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-1">
                    Rectificación (Art. 16)
                  </h3>
                  <p className="text-sm text-gray-600">
                    Corregir datos inexactos o desactualizados. Podés editar tu
                    perfil directamente o solicitar correcciones.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-1">
                    Cancelación/Supresión (Art. 16)
                  </h3>
                  <p className="text-sm text-gray-600">
                    Solicitar la eliminación de tu cuenta y datos. Aplicamos un
                    período de espera de 30 días durante el cual podés cancelar
                    la solicitud. Algunos datos se conservan por obligación
                    legal.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-1">
                    Oposición (Art. 27)
                  </h3>
                  <p className="text-sm text-gray-600">
                    Oponerte al tratamiento de tus datos para fines específicos
                    como marketing. Podés configurar esto desde{' '}
                    <Link
                      href="/dashboard/settings/privacy"
                      className="text-primary-600 hover:underline"
                    >
                      Configuración &gt; Privacidad
                    </Link>
                    .
                  </p>
                </div>
              </div>

              <p className="text-gray-600 mt-4">
                <strong>Plazo de respuesta:</strong> Responderemos a tu
                solicitud dentro de los 10 días hábiles conforme Art. 14 de la
                Ley 25.326.
              </p>
            </section>

            <section id="seguridad" className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                8. Medidas de seguridad
              </h2>
              <p className="text-gray-600 mb-4">
                Implementamos las siguientes medidas para proteger tus datos:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Cifrado en tránsito (TLS 1.3) y en reposo (AES-256)</li>
                <li>Autenticación de dos factores disponible</li>
                <li>Copias de seguridad diarias con retención de 30 días</li>
                <li>Registro de auditoría de todos los accesos</li>
                <li>Servidores en centros de datos certificados (SOC 2)</li>
                <li>Pruebas de penetración periódicas</li>
                <li>Política de acceso mínimo necesario para empleados</li>
              </ul>
            </section>

            <section id="contacto" className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-gray-400" />
                9. Contacto
              </h2>
              <p className="text-gray-600 mb-4">
                Para ejercer tus derechos o consultas sobre privacidad:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-600">
                  <strong>Oficial de Protección de Datos:</strong>
                  <br />
                  Email:{' '}
                  <a
                    href="mailto:privacidad@campotech.com"
                    className="text-primary-600 hover:underline"
                  >
                    privacidad@campotech.com
                  </a>
                  <br />
                  <br />
                  <strong>
                    Dirección Nacional de Protección de Datos Personales:
                  </strong>
                  <br />
                  Si no estás satisfecho con nuestra respuesta, podés presentar
                  un reclamo ante la{' '}
                  <a
                    href="https://www.argentina.gob.ar/aaip/datospersonales"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    AAIP (Agencia de Acceso a la Información Pública)
                  </a>
                  .
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                10. Cambios a esta política
              </h2>
              <p className="text-gray-600">
                Podemos actualizar esta política periódicamente. Te notificaremos
                cambios significativos por email o mediante un aviso en la
                plataforma. Te recomendamos revisar esta página regularmente.
              </p>
            </section>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Esta política de privacidad cumple con la Ley 25.326 de Protección
              de Datos Personales de la República Argentina y su Decreto
              Reglamentario 1558/2001.
            </p>
          </div>
        </div>

        {/* Related Links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm">
          <Link href="/terms" className="text-primary-600 hover:underline">
            Términos de Servicio
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/cookies" className="text-primary-600 hover:underline">
            Política de Cookies
          </Link>
          <span className="text-gray-300">|</span>
          <Link
            href="/dashboard/settings/privacy"
            className="text-primary-600 hover:underline"
          >
            Gestionar mis datos
          </Link>
        </div>
      </main>
    </div>
  );
}
