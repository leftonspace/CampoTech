'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ExternalLink } from 'lucide-react';

interface EndpointInfo {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  parameters?: {
    name: string;
    in: 'path' | 'query' | 'body';
    type: string;
    required: boolean;
    description: string;
  }[];
  requestBody?: {
    type: string;
    properties: { name: string; type: string; required: boolean; description: string }[];
  };
  responses: {
    status: number;
    description: string;
    example?: object;
  }[];
}

const apiReference: Record<string, EndpointInfo[]> = {
  Customers: [
    {
      method: 'GET',
      path: '/v1/customers',
      summary: 'Listar clientes',
      description: 'Obtiene una lista paginada de clientes de la organización.',
      parameters: [
        { name: 'page', in: 'query', type: 'integer', required: false, description: 'Número de página (default: 1)' },
        { name: 'limit', in: 'query', type: 'integer', required: false, description: 'Resultados por página (default: 20, max: 100)' },
        { name: 'search', in: 'query', type: 'string', required: false, description: 'Buscar por nombre o email' },
      ],
      responses: [
        {
          status: 200,
          description: 'Lista de clientes',
          example: {
            data: [{ id: 'cust_abc123', name: 'Juan Pérez', email: 'juan@example.com' }],
            meta: { total: 150, page: 1, limit: 20, totalPages: 8 },
          },
        },
      ],
    },
    {
      method: 'POST',
      path: '/v1/customers',
      summary: 'Crear cliente',
      description: 'Crea un nuevo cliente en la organización.',
      requestBody: {
        type: 'object',
        properties: [
          { name: 'name', type: 'string', required: true, description: 'Nombre completo del cliente' },
          { name: 'email', type: 'string', required: true, description: 'Email del cliente' },
          { name: 'phone', type: 'string', required: false, description: 'Teléfono de contacto' },
          { name: 'address', type: 'string', required: false, description: 'Dirección' },
          { name: 'city', type: 'string', required: false, description: 'Ciudad' },
          { name: 'province', type: 'string', required: false, description: 'Provincia' },
        ],
      },
      responses: [
        { status: 201, description: 'Cliente creado exitosamente' },
        { status: 400, description: 'Datos inválidos' },
        { status: 409, description: 'Email ya registrado' },
      ],
    },
    {
      method: 'GET',
      path: '/v1/customers/:id',
      summary: 'Obtener cliente',
      description: 'Obtiene los detalles de un cliente específico.',
      parameters: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'ID del cliente' }],
      responses: [
        { status: 200, description: 'Detalles del cliente' },
        { status: 404, description: 'Cliente no encontrado' },
      ],
    },
    {
      method: 'PATCH',
      path: '/v1/customers/:id',
      summary: 'Actualizar cliente',
      description: 'Actualiza los datos de un cliente existente.',
      parameters: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'ID del cliente' }],
      responses: [
        { status: 200, description: 'Cliente actualizado' },
        { status: 404, description: 'Cliente no encontrado' },
      ],
    },
    {
      method: 'DELETE',
      path: '/v1/customers/:id',
      summary: 'Eliminar cliente',
      description: 'Elimina un cliente. Esta acción no puede deshacerse.',
      parameters: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'ID del cliente' }],
      responses: [
        { status: 204, description: 'Cliente eliminado' },
        { status: 404, description: 'Cliente no encontrado' },
      ],
    },
  ],
  Jobs: [
    {
      method: 'GET',
      path: '/v1/jobs',
      summary: 'Listar trabajos',
      description: 'Obtiene una lista paginada de trabajos.',
      parameters: [
        { name: 'status', in: 'query', type: 'string', required: false, description: 'Filtrar por estado' },
        { name: 'customerId', in: 'query', type: 'string', required: false, description: 'Filtrar por cliente' },
        { name: 'assignedTo', in: 'query', type: 'string', required: false, description: 'Filtrar por técnico' },
      ],
      responses: [{ status: 200, description: 'Lista de trabajos' }],
    },
    {
      method: 'POST',
      path: '/v1/jobs',
      summary: 'Crear trabajo',
      description: 'Crea un nuevo trabajo de servicio.',
      requestBody: {
        type: 'object',
        properties: [
          { name: 'customerId', type: 'string', required: true, description: 'ID del cliente' },
          { name: 'description', type: 'string', required: true, description: 'Descripción del trabajo' },
          { name: 'address', type: 'string', required: true, description: 'Dirección del servicio' },
          { name: 'scheduledAt', type: 'datetime', required: false, description: 'Fecha/hora programada' },
          { name: 'assignedTo', type: 'string', required: false, description: 'ID del técnico asignado' },
        ],
      },
      responses: [{ status: 201, description: 'Trabajo creado' }],
    },
    {
      method: 'POST',
      path: '/v1/jobs/:id/complete',
      summary: 'Completar trabajo',
      description: 'Marca un trabajo como completado.',
      parameters: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'ID del trabajo' }],
      requestBody: {
        type: 'object',
        properties: [
          { name: 'photos', type: 'array', required: false, description: 'URLs de fotos del trabajo' },
          { name: 'signature', type: 'string', required: false, description: 'Firma del cliente (base64)' },
          { name: 'notes', type: 'string', required: false, description: 'Notas de completación' },
        ],
      },
      responses: [{ status: 200, description: 'Trabajo completado' }],
    },
  ],
  Invoices: [
    {
      method: 'GET',
      path: '/v1/invoices',
      summary: 'Listar facturas',
      description: 'Obtiene una lista paginada de facturas.',
      responses: [{ status: 200, description: 'Lista de facturas' }],
    },
    {
      method: 'POST',
      path: '/v1/invoices',
      summary: 'Crear factura',
      description: 'Crea una nueva factura.',
      requestBody: {
        type: 'object',
        properties: [
          { name: 'customerId', type: 'string', required: true, description: 'ID del cliente' },
          { name: 'jobId', type: 'string', required: false, description: 'ID del trabajo asociado' },
          { name: 'lineItems', type: 'array', required: true, description: 'Items de la factura' },
          { name: 'dueDate', type: 'date', required: false, description: 'Fecha de vencimiento' },
        ],
      },
      responses: [{ status: 201, description: 'Factura creada' }],
    },
    {
      method: 'POST',
      path: '/v1/invoices/:id/send',
      summary: 'Enviar factura',
      description: 'Envía la factura al cliente por email.',
      responses: [{ status: 204, description: 'Factura enviada' }],
    },
  ],
  Webhooks: [
    {
      method: 'GET',
      path: '/v1/webhooks',
      summary: 'Listar webhooks',
      description: 'Lista los webhooks configurados.',
      responses: [{ status: 200, description: 'Lista de webhooks' }],
    },
    {
      method: 'POST',
      path: '/v1/webhooks',
      summary: 'Crear webhook',
      description: 'Crea una nueva suscripción a webhooks.',
      requestBody: {
        type: 'object',
        properties: [
          { name: 'url', type: 'string', required: true, description: 'URL de destino (HTTPS)' },
          { name: 'events', type: 'array', required: true, description: 'Eventos a suscribir' },
          { name: 'secret', type: 'string', required: false, description: 'Secret para firmar' },
        ],
      },
      responses: [{ status: 201, description: 'Webhook creado' }],
    },
    {
      method: 'POST',
      path: '/v1/webhooks/:id/test',
      summary: 'Probar webhook',
      description: 'Envía un evento de prueba al webhook.',
      responses: [{ status: 200, description: 'Evento de prueba enviado' }],
    },
  ],
};

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PUT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  PATCH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function ReferencePage() {
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-950 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-xl font-bold text-primary-600">
                CampoTech API
              </Link>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600 dark:text-slate-400">API Reference</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/docs" className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Docs
              </Link>
              <Link href="/playground" className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Playground
              </Link>
              <a
                href="/api/openapi.json"
                target="_blank"
                className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center"
              >
                OpenAPI <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">API Reference</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Documentación completa de todos los endpoints de la API de CampoTech.
          </p>
        </div>

        <div className="space-y-8">
          {Object.entries(apiReference).map(([category, endpoints]) => (
            <section key={category} id={category.toLowerCase()}>
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <span className="bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 px-3 py-1 rounded-lg text-sm mr-3">
                  {endpoints.length}
                </span>
                {category}
              </h2>

              <div className="space-y-2">
                {endpoints.map((endpoint) => {
                  const key = `${endpoint.method} ${endpoint.path}`;
                  const isExpanded = expandedEndpoint === key;

                  return (
                    <div
                      key={key}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedEndpoint(isExpanded ? null : key)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${methodColors[endpoint.method]}`}>
                            {endpoint.method}
                          </span>
                          <code className="text-sm font-mono">{endpoint.path}</code>
                          <span className="text-slate-500 text-sm">{endpoint.summary}</span>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            {endpoint.description}
                          </p>

                          {endpoint.parameters && endpoint.parameters.length > 0 && (
                            <div className="mb-4">
                              <h4 className="font-medium text-sm mb-2">Parameters</h4>
                              <div className="bg-white dark:bg-slate-900 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-100 dark:bg-slate-700">
                                    <tr>
                                      <th className="text-left px-3 py-2 font-medium">Name</th>
                                      <th className="text-left px-3 py-2 font-medium">In</th>
                                      <th className="text-left px-3 py-2 font-medium">Type</th>
                                      <th className="text-left px-3 py-2 font-medium">Required</th>
                                      <th className="text-left px-3 py-2 font-medium">Description</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {endpoint.parameters.map((param) => (
                                      <tr key={param.name} className="border-t border-slate-100 dark:border-slate-700">
                                        <td className="px-3 py-2 font-mono">{param.name}</td>
                                        <td className="px-3 py-2">{param.in}</td>
                                        <td className="px-3 py-2 font-mono text-primary-600">{param.type}</td>
                                        <td className="px-3 py-2">{param.required ? 'Yes' : 'No'}</td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{param.description}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {endpoint.requestBody && (
                            <div className="mb-4">
                              <h4 className="font-medium text-sm mb-2">Request Body</h4>
                              <div className="bg-white dark:bg-slate-900 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-100 dark:bg-slate-700">
                                    <tr>
                                      <th className="text-left px-3 py-2 font-medium">Field</th>
                                      <th className="text-left px-3 py-2 font-medium">Type</th>
                                      <th className="text-left px-3 py-2 font-medium">Required</th>
                                      <th className="text-left px-3 py-2 font-medium">Description</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {endpoint.requestBody.properties.map((prop) => (
                                      <tr key={prop.name} className="border-t border-slate-100 dark:border-slate-700">
                                        <td className="px-3 py-2 font-mono">{prop.name}</td>
                                        <td className="px-3 py-2 font-mono text-primary-600">{prop.type}</td>
                                        <td className="px-3 py-2">{prop.required ? 'Yes' : 'No'}</td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{prop.description}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          <div>
                            <h4 className="font-medium text-sm mb-2">Responses</h4>
                            <div className="space-y-1">
                              {endpoint.responses.map((resp) => (
                                <div
                                  key={resp.status}
                                  className="flex items-center space-x-2 text-sm"
                                >
                                  <span
                                    className={`px-2 py-0.5 rounded font-mono ${
                                      resp.status < 300
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : resp.status < 500
                                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}
                                  >
                                    {resp.status}
                                  </span>
                                  <span className="text-slate-600 dark:text-slate-400">{resp.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <Link
                              href={`/playground?endpoint=${encodeURIComponent(key)}`}
                              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                            >
                              Probar en Playground →
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
