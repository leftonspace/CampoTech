'use client';

import { useState } from 'react';
import Link from 'next/link';
import { searchMatchesAny } from '@/lib/utils';
import {
  Package,
  Search,
  Filter,
  Star,
  Download,
  CheckCircle,
  ExternalLink,
  Zap,
  Shield,
  CreditCard,
  FileText,
  MessageSquare,
  Truck,
  BarChart,
  MapPin,
  Users,
} from 'lucide-react';

// Integration categories
const categories = [
  { id: 'all', name: 'Todas', count: 24 },
  { id: 'payments', name: 'Pagos', count: 5 },
  { id: 'invoicing', name: 'Facturación', count: 4 },
  { id: 'communication', name: 'Comunicación', count: 6 },
  { id: 'logistics', name: 'Logística', count: 3 },
  { id: 'analytics', name: 'Analytics', count: 4 },
  { id: 'crm', name: 'CRM', count: 2 },
];

// Available integrations
const integrations = [
  // Payments
  {
    id: 'mercadopago',
    name: 'MercadoPago',
    description: 'Procesa pagos con tarjetas, transferencias y efectivo en puntos de pago.',
    category: 'payments',
    icon: CreditCard,
    installed: true,
    official: true,
    rating: 4.8,
    installs: 1250,
    features: ['Pagos con tarjeta', 'QR', 'Links de pago', 'Suscripciones'],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Plataforma global de pagos para negocios en internet.',
    category: 'payments',
    icon: CreditCard,
    installed: false,
    official: true,
    rating: 4.9,
    installs: 890,
    features: ['Pagos internacionales', 'Suscripciones', 'Facturación'],
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Acepta pagos de clientes internacionales con PayPal.',
    category: 'payments',
    icon: CreditCard,
    installed: false,
    official: false,
    rating: 4.5,
    installs: 456,
    features: ['Pagos internacionales', 'Express checkout'],
  },
  {
    id: 'modo',
    name: 'MODO',
    description: 'Pagos con billetera digital MODO.',
    category: 'payments',
    icon: CreditCard,
    installed: false,
    official: true,
    rating: 4.6,
    installs: 320,
    features: ['QR', 'Push de pago', 'Billetera digital'],
  },
  {
    id: 'ualá',
    name: 'Ualá',
    description: 'Integración con la app de pagos Ualá.',
    category: 'payments',
    icon: CreditCard,
    installed: false,
    official: false,
    rating: 4.4,
    installs: 180,
    features: ['Transferencias', 'QR'],
  },
  // Invoicing
  {
    id: 'afip',
    name: 'AFIP Factura Electrónica',
    description: 'Emite facturas electrónicas homologadas por AFIP.',
    category: 'invoicing',
    icon: FileText,
    installed: true,
    official: true,
    rating: 4.7,
    installs: 2100,
    features: ['Factura A/B/C', 'Notas de crédito', 'Remitos'],
  },
  {
    id: 'alegra',
    name: 'Alegra',
    description: 'Software de contabilidad y facturación en la nube.',
    category: 'invoicing',
    icon: FileText,
    installed: false,
    official: false,
    rating: 4.3,
    installs: 290,
    features: ['Contabilidad', 'Inventario', 'Reportes'],
  },
  {
    id: 'colppy',
    name: 'Colppy',
    description: 'Sistema de gestión contable argentino.',
    category: 'invoicing',
    icon: FileText,
    installed: false,
    official: false,
    rating: 4.2,
    installs: 210,
    features: ['Contabilidad', 'Facturación', 'Reportes fiscales'],
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Software de contabilidad global.',
    category: 'invoicing',
    icon: FileText,
    installed: false,
    official: true,
    rating: 4.6,
    installs: 340,
    features: ['Contabilidad', 'Bancos', 'Reportes'],
  },
  // Communication
  {
    id: 'whatsapp',
    name: 'WhatsApp Business API',
    description: 'Envía notificaciones y mensajes a clientes por WhatsApp.',
    category: 'communication',
    icon: MessageSquare,
    installed: true,
    official: true,
    rating: 4.9,
    installs: 1890,
    features: ['Mensajes', 'Templates', 'Chatbot', 'Media'],
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS, llamadas y WhatsApp con Twilio.',
    category: 'communication',
    icon: MessageSquare,
    installed: false,
    official: true,
    rating: 4.7,
    installs: 560,
    features: ['SMS', 'Llamadas', 'WhatsApp'],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Emails transaccionales y marketing.',
    category: 'communication',
    icon: MessageSquare,
    installed: false,
    official: true,
    rating: 4.6,
    installs: 480,
    features: ['Emails', 'Templates', 'Analytics'],
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Email marketing y automatización.',
    category: 'communication',
    icon: MessageSquare,
    installed: false,
    official: false,
    rating: 4.5,
    installs: 320,
    features: ['Campañas', 'Automatización', 'Segmentación'],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Notificaciones y alertas en canales de Slack.',
    category: 'communication',
    icon: MessageSquare,
    installed: false,
    official: true,
    rating: 4.8,
    installs: 670,
    features: ['Notificaciones', 'Comandos', 'Workflows'],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Integración con Microsoft Teams para notificaciones.',
    category: 'communication',
    icon: MessageSquare,
    installed: false,
    official: false,
    rating: 4.4,
    installs: 230,
    features: ['Notificaciones', 'Tarjetas adaptativas'],
  },
  // Logistics
  {
    id: 'google-maps',
    name: 'Google Maps',
    description: 'Geocodificación, rutas y mapas.',
    category: 'logistics',
    icon: MapPin,
    installed: true,
    official: true,
    rating: 4.9,
    installs: 2340,
    features: ['Geocodificación', 'Rutas', 'Distancias', 'ETA'],
  },
  {
    id: 'andreani',
    name: 'Andreani',
    description: 'Envíos y logística con Andreani.',
    category: 'logistics',
    icon: Truck,
    installed: false,
    official: false,
    rating: 4.3,
    installs: 180,
    features: ['Cotización', 'Etiquetas', 'Tracking'],
  },
  {
    id: 'oca',
    name: 'OCA',
    description: 'Servicios de envío y courier OCA.',
    category: 'logistics',
    icon: Truck,
    installed: false,
    official: false,
    rating: 4.2,
    installs: 150,
    features: ['Envíos', 'Retiros', 'Tracking'],
  },
  // Analytics
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    description: 'Analíticas del portal de clientes.',
    category: 'analytics',
    icon: BarChart,
    installed: false,
    official: true,
    rating: 4.8,
    installs: 890,
    features: ['Tráfico', 'Conversiones', 'Audiencias'],
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    description: 'Análisis de comportamiento de usuarios.',
    category: 'analytics',
    icon: BarChart,
    installed: false,
    official: true,
    rating: 4.7,
    installs: 340,
    features: ['Eventos', 'Funnels', 'Retention'],
  },
  {
    id: 'amplitude',
    name: 'Amplitude',
    description: 'Product analytics y experimentación.',
    category: 'analytics',
    icon: BarChart,
    installed: false,
    official: false,
    rating: 4.6,
    installs: 210,
    features: ['Analytics', 'Segmentación', 'Cohortes'],
  },
  {
    id: 'datadog',
    name: 'Datadog',
    description: 'Monitoreo y observabilidad.',
    category: 'analytics',
    icon: BarChart,
    installed: false,
    official: true,
    rating: 4.8,
    installs: 180,
    features: ['APM', 'Logs', 'Métricas', 'Alertas'],
  },
  // CRM
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM, marketing y ventas.',
    category: 'crm',
    icon: Users,
    installed: false,
    official: true,
    rating: 4.7,
    installs: 450,
    features: ['CRM', 'Deals', 'Marketing', 'Tickets'],
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'CRM empresarial líder en el mercado.',
    category: 'crm',
    icon: Users,
    installed: false,
    official: true,
    rating: 4.6,
    installs: 320,
    features: ['CRM', 'Sales Cloud', 'Service Cloud'],
  },
];

export default function IntegrationsMarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showInstalled, setShowInstalled] = useState(false);

  const filteredIntegrations = integrations.filter((integration) => {
    const matchesSearch = searchMatchesAny(
      [integration.name, integration.description],
      searchQuery
    );
    const matchesCategory =
      selectedCategory === 'all' || integration.category === selectedCategory;
    const matchesInstalled = !showInstalled || integration.installed;
    return matchesSearch && matchesCategory && matchesInstalled;
  });

  const installedCount = integrations.filter((i) => i.installed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="h-7 w-7 text-primary-600" />
            Marketplace de Integraciones
          </h1>
          <p className="text-gray-500">
            Conecta CampoTech con tus herramientas favoritas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {installedCount} instaladas
          </span>
          <span className="h-1 w-1 rounded-full bg-gray-300" />
          <span className="text-sm text-gray-500">
            {integrations.length} disponibles
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar integraciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <button
          onClick={() => setShowInstalled(!showInstalled)}
          className={`btn ${showInstalled ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
        >
          <Filter className="h-4 w-4" />
          {showInstalled ? 'Mostrando instaladas' : 'Mostrar instaladas'}
        </button>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === category.id
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            {category.name}
            <span className="ml-1 text-xs opacity-70">({category.count})</span>
          </button>
        ))}
      </div>

      {/* Integrations Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredIntegrations.map((integration) => (
          <Link
            key={integration.id}
            href={`/dashboard/integrations/${integration.id}`}
            className="card p-5 transition-shadow hover:shadow-md group"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-gray-100 p-3 group-hover:bg-primary-50 transition-colors">
                <integration.icon className="h-6 w-6 text-gray-600 group-hover:text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {integration.name}
                  </h3>
                  {integration.official && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                      <Shield className="h-3 w-3" />
                      Oficial
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {integration.description}
                </p>
              </div>
            </div>

            {/* Features */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {integration.features.slice(0, 3).map((feature, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                >
                  {feature}
                </span>
              ))}
              {integration.features.length > 3 && (
                <span className="px-2 py-0.5 text-gray-400 text-xs">
                  +{integration.features.length - 3}
                </span>
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-warning-500 fill-warning-500" />
                  {integration.rating}
                </span>
                <span className="flex items-center gap-1">
                  <Download className="h-4 w-4" />
                  {integration.installs.toLocaleString()}
                </span>
              </div>
              {integration.installed ? (
                <span className="flex items-center gap-1 text-sm text-success-600">
                  <CheckCircle className="h-4 w-4" />
                  Instalada
                </span>
              ) : (
                <span className="text-sm text-primary-600 font-medium group-hover:underline">
                  Ver detalles
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Empty State */}
      {filteredIntegrations.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">
            No se encontraron integraciones
          </h3>
          <p className="text-gray-500 mt-1">
            Intenta con otros términos de búsqueda o categorías
          </p>
        </div>
      )}

      {/* Developer CTA */}
      <div className="card bg-gradient-to-r from-primary-50 to-primary-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary-600" />
              ¿Quieres crear tu propia integración?
            </h3>
            <p className="text-gray-600 mt-1">
              Usa nuestra API pública para construir integraciones personalizadas
              o publicarlas en el marketplace.
            </p>
          </div>
          <a
            href="https://developers.campotech.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            Portal de desarrolladores
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
