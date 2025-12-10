'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Play, Copy, ChevronDown, Clock, Check, X } from 'lucide-react';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  category: string;
}

const endpoints: Endpoint[] = [
  // Customers
  { method: 'GET', path: '/v1/customers', description: 'Listar clientes', category: 'Customers' },
  { method: 'POST', path: '/v1/customers', description: 'Crear cliente', category: 'Customers' },
  { method: 'GET', path: '/v1/customers/:id', description: 'Obtener cliente', category: 'Customers' },
  { method: 'PATCH', path: '/v1/customers/:id', description: 'Actualizar cliente', category: 'Customers' },
  { method: 'DELETE', path: '/v1/customers/:id', description: 'Eliminar cliente', category: 'Customers' },
  // Jobs
  { method: 'GET', path: '/v1/jobs', description: 'Listar trabajos', category: 'Jobs' },
  { method: 'POST', path: '/v1/jobs', description: 'Crear trabajo', category: 'Jobs' },
  { method: 'GET', path: '/v1/jobs/:id', description: 'Obtener trabajo', category: 'Jobs' },
  { method: 'POST', path: '/v1/jobs/:id/complete', description: 'Completar trabajo', category: 'Jobs' },
  { method: 'POST', path: '/v1/jobs/:id/cancel', description: 'Cancelar trabajo', category: 'Jobs' },
  // Invoices
  { method: 'GET', path: '/v1/invoices', description: 'Listar facturas', category: 'Invoices' },
  { method: 'POST', path: '/v1/invoices', description: 'Crear factura', category: 'Invoices' },
  { method: 'POST', path: '/v1/invoices/:id/send', description: 'Enviar factura', category: 'Invoices' },
  // Payments
  { method: 'GET', path: '/v1/payments', description: 'Listar pagos', category: 'Payments' },
  { method: 'POST', path: '/v1/payments', description: 'Crear pago', category: 'Payments' },
  { method: 'POST', path: '/v1/payments/:id/refund', description: 'Reembolsar pago', category: 'Payments' },
  // Webhooks
  { method: 'GET', path: '/v1/webhooks', description: 'Listar webhooks', category: 'Webhooks' },
  { method: 'POST', path: '/v1/webhooks', description: 'Crear webhook', category: 'Webhooks' },
  { method: 'POST', path: '/v1/webhooks/:id/test', description: 'Probar webhook', category: 'Webhooks' },
];

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PUT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  PATCH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function PlaygroundPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>(endpoints[0]);
  const [apiKey, setApiKey] = useState('');
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState('{\n  \n}');
  const [response, setResponse] = useState<{ status: number; body: string; time: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const categories = [...new Set(endpoints.map((e) => e.category))];

  const executeRequest = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

    // Mock response
    const mockResponses: Record<string, { status: number; body: object }> = {
      'GET /v1/customers': {
        status: 200,
        body: {
          data: [
            { id: 'cust_abc123', name: 'Juan Pérez', email: 'juan@example.com' },
            { id: 'cust_def456', name: 'María García', email: 'maria@example.com' },
          ],
          meta: { total: 2, page: 1, limit: 20 },
        },
      },
      'POST /v1/customers': {
        status: 201,
        body: {
          data: { id: 'cust_new123', name: 'Nuevo Cliente', email: 'nuevo@example.com', createdAt: new Date().toISOString() },
        },
      },
    };

    const key = `${selectedEndpoint.method} ${selectedEndpoint.path}`;
    const mockResponse = mockResponses[key] || {
      status: 200,
      body: { data: { id: 'resource_123', message: 'Operación exitosa' } },
    };

    setResponse({
      status: mockResponse.status,
      body: JSON.stringify(mockResponse.body, null, 2),
      time: Math.floor(100 + Math.random() * 200),
    });
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-xl font-bold text-primary-600">
                CampoTech
              </Link>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600 dark:text-slate-400">API Playground</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/docs" className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Docs
              </Link>
              <Link href="/reference" className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Reference
              </Link>
              <Link
                href="/console"
                className="text-sm bg-primary-600 text-white px-4 py-1.5 rounded-lg hover:bg-primary-700"
              >
                Consola
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Endpoint Selector */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold">Endpoints</h3>
              </div>
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                {categories.map((category) => (
                  <div key={category}>
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700 text-sm font-medium text-slate-500">
                      {category}
                    </div>
                    {endpoints
                      .filter((e) => e.category === category)
                      .map((endpoint) => (
                        <button
                          key={`${endpoint.method} ${endpoint.path}`}
                          onClick={() => setSelectedEndpoint(endpoint)}
                          className={`w-full px-4 py-2 text-left flex items-center space-x-2 hover:bg-slate-50 dark:hover:bg-slate-700 ${
                            selectedEndpoint === endpoint ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                          }`}
                        >
                          <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-medium ${methodColors[endpoint.method]}`}>
                            {endpoint.method}
                          </span>
                          <span className="text-sm truncate flex-1">{endpoint.description}</span>
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Request Builder */}
          <div className="lg:col-span-5 space-y-4">
            {/* URL */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded text-sm font-mono font-medium ${methodColors[selectedEndpoint.method]}`}>
                  {selectedEndpoint.method}
                </span>
                <code className="flex-1 text-sm bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded font-mono">
                  https://api.campotech.com{selectedEndpoint.path}
                </code>
              </div>
            </div>

            {/* API Key */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <label className="block text-sm font-medium mb-2">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="ct_live_..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm font-mono"
              />
            </div>

            {/* Request Body */}
            {['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method) && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <label className="block text-sm font-medium mb-2">Request Body</label>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-900 text-green-400 text-sm font-mono"
                />
              </div>
            )}

            {/* Execute Button */}
            <button
              onClick={executeRequest}
              disabled={isLoading || !apiKey}
              className="w-full bg-primary-600 text-white px-4 py-3 rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Ejecutando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Ejecutar Request
                </>
              )}
            </button>
          </div>

          {/* Response */}
          <div className="lg:col-span-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden h-full">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold">Response</h3>
                {response && (
                  <div className="flex items-center space-x-3 text-sm">
                    <span className={`flex items-center ${response.status < 400 ? 'text-green-600' : 'text-red-600'}`}>
                      {response.status < 400 ? <Check className="w-4 h-4 mr-1" /> : <X className="w-4 h-4 mr-1" />}
                      {response.status}
                    </span>
                    <span className="flex items-center text-slate-500">
                      <Clock className="w-4 h-4 mr-1" />
                      {response.time}ms
                    </span>
                    <button className="text-slate-400 hover:text-slate-600">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="p-4 bg-slate-900 min-h-[400px]">
                {response ? (
                  <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                    {response.body}
                  </pre>
                ) : (
                  <p className="text-slate-500 text-sm">
                    Ejecuta una request para ver la respuesta aquí.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
