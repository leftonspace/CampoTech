import Link from 'next/link';
import { Code, Book, Terminal, Zap, Shield, Webhook, Key, BarChart3 } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-primary-600">
              CampoTech API
            </Link>
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/docs" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Documentación
              </Link>
              <Link href="/reference" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Referencia API
              </Link>
              <Link href="/playground" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Playground
              </Link>
              <Link href="/console" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Consola
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/console/login"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/console/register"
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Crear cuenta
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-6">
            Construye con la API de{' '}
            <span className="text-primary-600">CampoTech</span>
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-10">
            API RESTful completa para gestión de servicios de campo. Integra clientes, trabajos,
            facturas, pagos y más en tu aplicación.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/docs/quickstart"
              className="bg-primary-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-primary-700 transition-colors inline-flex items-center justify-center"
            >
              <Zap className="w-5 h-5 mr-2" />
              Comenzar
            </Link>
            <Link
              href="/reference"
              className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center justify-center"
            >
              <Book className="w-5 h-5 mr-2" />
              Ver API Reference
            </Link>
          </div>

          {/* Code Example */}
          <div className="mt-16 max-w-3xl mx-auto text-left">
            <div className="bg-slate-900 rounded-xl overflow-hidden shadow-2xl">
              <div className="flex items-center px-4 py-3 bg-slate-800 border-b border-slate-700">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="ml-4 text-sm text-slate-400">Ejemplo de uso</span>
              </div>
              <pre className="p-6 text-sm overflow-x-auto">
                <code className="text-slate-300 font-mono">
{`import { CampoTechClient } from '@campotech/sdk';

const client = new CampoTechClient({
  apiKey: process.env.CAMPOTECH_API_KEY
});

// Crear un nuevo trabajo
const job = await client.jobs.create({
  customerId: 'cust_abc123',
  description: 'Instalación de aire acondicionado',
  address: 'Av. Corrientes 1234, CABA',
  scheduledAt: new Date('2025-01-15T10:00:00')
});

console.log('Trabajo creado:', job.id);`}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Todo lo que necesitas para integrar
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Key className="w-6 h-6" />}
              title="API Keys & OAuth 2.0"
              description="Autenticación flexible con API keys para servidores y OAuth 2.0 para aplicaciones de usuario."
            />
            <FeatureCard
              icon={<Webhook className="w-6 h-6" />}
              title="Webhooks en tiempo real"
              description="Recibe notificaciones instantáneas cuando ocurren eventos en tu cuenta."
            />
            <FeatureCard
              icon={<Code className="w-6 h-6" />}
              title="SDKs oficiales"
              description="SDKs para TypeScript y Python con tipado completo y manejo de errores."
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Scopes granulares"
              description="Control preciso de permisos con scopes como read:customers, write:jobs."
            />
            <FeatureCard
              icon={<Terminal className="w-6 h-6" />}
              title="API Playground"
              description="Prueba endpoints interactivamente sin escribir código."
            />
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6" />}
              title="Analytics & Logs"
              description="Monitorea el uso de tu API con métricas y logs detallados."
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Integraciones"
              description="Conecta con Google Calendar, QuickBooks y Zapier fácilmente."
            />
            <FeatureCard
              icon={<Book className="w-6 h-6" />}
              title="Documentación completa"
              description="Guías, tutoriales y ejemplos para cada caso de uso."
            />
          </div>
        </div>
      </section>

      {/* API Endpoints Preview */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            API RESTful completa
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            Endpoints para gestionar todos los aspectos de tu negocio de servicios de campo
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <EndpointGroup
              title="Customers"
              endpoints={[
                { method: 'GET', path: '/v1/customers', desc: 'Listar clientes' },
                { method: 'POST', path: '/v1/customers', desc: 'Crear cliente' },
                { method: 'GET', path: '/v1/customers/:id', desc: 'Obtener cliente' },
              ]}
            />
            <EndpointGroup
              title="Jobs"
              endpoints={[
                { method: 'GET', path: '/v1/jobs', desc: 'Listar trabajos' },
                { method: 'POST', path: '/v1/jobs', desc: 'Crear trabajo' },
                { method: 'POST', path: '/v1/jobs/:id/complete', desc: 'Completar trabajo' },
              ]}
            />
            <EndpointGroup
              title="Invoices"
              endpoints={[
                { method: 'GET', path: '/v1/invoices', desc: 'Listar facturas' },
                { method: 'POST', path: '/v1/invoices', desc: 'Crear factura' },
                { method: 'POST', path: '/v1/invoices/:id/send', desc: 'Enviar factura' },
              ]}
            />
            <EndpointGroup
              title="Payments"
              endpoints={[
                { method: 'GET', path: '/v1/payments', desc: 'Listar pagos' },
                { method: 'POST', path: '/v1/payments', desc: 'Registrar pago' },
                { method: 'POST', path: '/v1/payments/:id/refund', desc: 'Reembolsar pago' },
              ]}
            />
            <EndpointGroup
              title="Webhooks"
              endpoints={[
                { method: 'GET', path: '/v1/webhooks', desc: 'Listar webhooks' },
                { method: 'POST', path: '/v1/webhooks', desc: 'Crear webhook' },
                { method: 'POST', path: '/v1/webhooks/:id/test', desc: 'Probar webhook' },
              ]}
            />
            <EndpointGroup
              title="OAuth"
              endpoints={[
                { method: 'GET', path: '/oauth/authorize', desc: 'Autorización' },
                { method: 'POST', path: '/oauth/token', desc: 'Obtener token' },
                { method: 'POST', path: '/oauth/introspect', desc: 'Introspección' },
              ]}
            />
          </div>
          <div className="text-center mt-10">
            <Link
              href="/reference"
              className="text-primary-600 hover:text-primary-700 font-medium inline-flex items-center"
            >
              Ver todos los endpoints
              <span className="ml-2">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">
            Comienza a construir hoy
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Crea tu cuenta de desarrollador y obtén tus API keys en minutos.
            Incluye 1,000 llamadas gratuitas por mes.
          </p>
          <Link
            href="/console/register"
            className="bg-primary-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-primary-700 transition-colors inline-flex items-center"
          >
            Crear cuenta gratuita
            <span className="ml-2">→</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-4">CampoTech API</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Plataforma de gestión de servicios de campo para empresas de Argentina y LATAM.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Documentación</h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li><Link href="/docs/quickstart" className="hover:text-primary-600">Inicio rápido</Link></li>
              <li><Link href="/docs/authentication" className="hover:text-primary-600">Autenticación</Link></li>
              <li><Link href="/docs/webhooks" className="hover:text-primary-600">Webhooks</Link></li>
              <li><Link href="/docs/sdks" className="hover:text-primary-600">SDKs</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Recursos</h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li><Link href="/reference" className="hover:text-primary-600">API Reference</Link></li>
              <li><Link href="/playground" className="hover:text-primary-600">Playground</Link></li>
              <li><Link href="/changelog" className="hover:text-primary-600">Changelog</Link></li>
              <li><Link href="/status" className="hover:text-primary-600">Estado del servicio</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li><Link href="/terms" className="hover:text-primary-600">Términos de uso</Link></li>
              <li><Link href="/privacy" className="hover:text-primary-600">Privacidad</Link></li>
              <li><Link href="/security" className="hover:text-primary-600">Seguridad</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
          © 2025 CampoTech. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/20 rounded-lg flex items-center justify-center text-primary-600 mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-slate-600 dark:text-slate-400 text-sm">{description}</p>
    </div>
  );
}

function EndpointGroup({
  title,
  endpoints,
}: {
  title: string;
  endpoints: { method: string; path: string; desc: string }[];
}) {
  const methodColors: Record<string, string> = {
    GET: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    PUT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    PATCH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {endpoints.map((ep, idx) => (
          <div key={idx} className="px-4 py-3 flex items-center space-x-3">
            <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${methodColors[ep.method]}`}>
              {ep.method}
            </span>
            <code className="text-sm text-slate-600 dark:text-slate-300 font-mono flex-1 truncate">
              {ep.path}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}
