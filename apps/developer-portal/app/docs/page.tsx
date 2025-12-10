import Link from 'next/link';

export default function DocsPage() {
  return (
    <div>
      <h1>Documentación de la API de CampoTech</h1>

      <p>
        Bienvenido a la documentación de la API de CampoTech. Aquí encontrarás todo lo necesario
        para integrar tu aplicación con nuestra plataforma de gestión de servicios de campo.
      </p>

      <h2>Comenzar</h2>

      <p>
        La API de CampoTech te permite gestionar clientes, trabajos, facturas, pagos y más
        de forma programática. Utiliza nuestra API RESTful con autenticación basada en API keys
        u OAuth 2.0.
      </p>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <QuickLink
          href="/docs/quickstart"
          title="Inicio rápido"
          description="Comienza a usar la API en 5 minutos"
        />
        <QuickLink
          href="/docs/authentication"
          title="Autenticación"
          description="Configura API keys u OAuth 2.0"
        />
        <QuickLink
          href="/docs/webhooks"
          title="Webhooks"
          description="Recibe eventos en tiempo real"
        />
        <QuickLink
          href="/docs/sdks"
          title="SDKs"
          description="TypeScript y Python SDKs oficiales"
        />
      </div>

      <h2>Recursos de la API</h2>

      <p>La API expone los siguientes recursos principales:</p>

      <ul>
        <li><strong>Customers</strong> - Gestión de clientes y sus datos de contacto</li>
        <li><strong>Jobs</strong> - Trabajos de servicio con asignación y programación</li>
        <li><strong>Invoices</strong> - Facturación electrónica con soporte AFIP</li>
        <li><strong>Payments</strong> - Registro y procesamiento de pagos</li>
        <li><strong>Webhooks</strong> - Suscripciones a eventos del sistema</li>
      </ul>

      <h2>Base URL</h2>

      <p>Todas las requests a la API deben usar el siguiente base URL:</p>

      <pre><code>https://api.campotech.com/v1</code></pre>

      <h2>Formato de respuesta</h2>

      <p>
        La API devuelve respuestas en formato JSON. Todas las respuestas exitosas incluyen
        un objeto <code>data</code> con el recurso solicitado:
      </p>

      <pre><code>{`{
  "data": {
    "id": "cust_abc123",
    "name": "Juan Pérez",
    "email": "juan@example.com"
  }
}`}</code></pre>

      <p>
        Las respuestas con listas incluyen información de paginación en el objeto <code>meta</code>:
      </p>

      <pre><code>{`{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}`}</code></pre>

      <h2>Soporte</h2>

      <p>
        Si tienes preguntas o problemas, puedes contactarnos en{' '}
        <a href="mailto:api@campotech.com">api@campotech.com</a> o a través de nuestro{' '}
        <a href="https://github.com/campotech/api" target="_blank" rel="noopener noreferrer">
          repositorio de GitHub
        </a>.
      </p>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors"
    >
      <h3 className="font-semibold text-primary-600 mb-1">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </Link>
  );
}
