'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Star,
  Download,
  Shield,
  CheckCircle,
  ExternalLink,
  Settings,
  Trash2,
  RefreshCw,
  Check,
  X,
  Clock,
  Zap,
  Book,
  MessageSquare,
  CreditCard,
  FileText,
  MapPin,
  Users,
} from 'lucide-react';

// Integration data (in production, this would come from an API)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const integrationsData: Record<string, any> = {
  mercadopago: {
    id: 'mercadopago',
    name: 'MercadoPago',
    description: 'Procesa pagos con tarjetas, transferencias y efectivo en puntos de pago.',
    longDescription: `MercadoPago es la plataforma de pagos líder en Latinoamérica. Con esta integración podrás:

- Aceptar pagos con tarjetas de crédito y débito
- Generar códigos QR para pagos presenciales
- Crear links de pago para enviar a clientes
- Configurar suscripciones recurrentes
- Gestionar devoluciones automáticamente

La integración sincroniza automáticamente los pagos con las facturas de CampoTech.`,
    category: 'payments',
    icon: CreditCard,
    installed: true,
    official: true,
    rating: 4.8,
    reviewCount: 156,
    installs: 1250,
    version: '2.3.1',
    lastUpdated: '2024-12-01',
    developer: 'CampoTech',
    website: 'https://www.mercadopago.com.ar',
    documentation: 'https://developers.campotech.com/integrations/mercadopago',
    features: [
      { name: 'Pagos con tarjeta', available: true },
      { name: 'QR', available: true },
      { name: 'Links de pago', available: true },
      { name: 'Suscripciones', available: true },
      { name: 'Devoluciones', available: true },
      { name: 'Webhooks', available: true },
    ],
    permissions: [
      'Leer datos de pagos',
      'Crear pagos y cobros',
      'Gestionar suscripciones',
      'Emitir devoluciones',
    ],
    config: {
      publicKey: 'APP_USR-abc123...',
      accessToken: '•••••••••••••',
      sandboxMode: false,
      autoCapture: true,
    },
  },
  afip: {
    id: 'afip',
    name: 'AFIP Factura Electrónica',
    description: 'Emite facturas electrónicas homologadas por AFIP.',
    longDescription: `Integración oficial con AFIP para emitir comprobantes fiscales electrónicos homologados.

- Facturas A, B y C
- Notas de crédito y débito
- Remitos electrónicos
- Validación automática de CUIT
- Sincronización con el libro IVA

Cumple con todas las normativas vigentes de facturación electrónica.`,
    category: 'invoicing',
    icon: FileText,
    installed: true,
    official: true,
    rating: 4.7,
    reviewCount: 234,
    installs: 2100,
    version: '3.1.0',
    lastUpdated: '2024-11-15',
    developer: 'CampoTech',
    website: 'https://www.afip.gob.ar',
    documentation: 'https://developers.campotech.com/integrations/afip',
    features: [
      { name: 'Factura A/B/C', available: true },
      { name: 'Notas de crédito', available: true },
      { name: 'Remitos', available: true },
      { name: 'Recibos', available: true },
      { name: 'Libro IVA', available: true },
      { name: 'Validación CUIT', available: true },
    ],
    permissions: [
      'Emitir comprobantes',
      'Consultar CAE',
      'Validar contribuyentes',
    ],
    config: {
      cuit: '20-12345678-9',
      puntoVenta: 1,
      certificado: 'cert_prod.pem',
      modo: 'produccion',
    },
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp Business API',
    description: 'Envía notificaciones y mensajes a clientes por WhatsApp.',
    longDescription: `Comunica con tus clientes a través de WhatsApp Business API.

- Envía notificaciones de estado de trabajos
- Recordatorios de citas automáticos
- Confirmaciones de pago
- Chatbot para consultas frecuentes
- Soporte para mensajes con imágenes y documentos

Los templates de mensajes están pre-aprobados para uso comercial.`,
    category: 'communication',
    icon: MessageSquare,
    installed: true,
    official: true,
    rating: 4.9,
    reviewCount: 312,
    installs: 1890,
    version: '2.0.5',
    lastUpdated: '2024-12-05',
    developer: 'CampoTech',
    website: 'https://business.whatsapp.com',
    documentation: 'https://developers.campotech.com/integrations/whatsapp',
    features: [
      { name: 'Mensajes', available: true },
      { name: 'Templates', available: true },
      { name: 'Chatbot', available: true },
      { name: 'Media', available: true },
      { name: 'Buttons', available: true },
      { name: 'Lists', available: true },
    ],
    permissions: [
      'Enviar mensajes',
      'Leer mensajes entrantes',
      'Gestionar templates',
      'Subir media',
    ],
    config: {
      phoneNumberId: '123456789',
      businessId: 'WABA-abc123',
      accessToken: '•••••••••••••',
    },
  },
  'google-maps': {
    id: 'google-maps',
    name: 'Google Maps',
    description: 'Geocodificación, rutas y mapas.',
    longDescription: `Integración con Google Maps Platform para funcionalidades geográficas.

- Geocodificación de direcciones
- Cálculo de rutas y tiempos estimados
- Optimización de rutas para técnicos
- Visualización de trabajos en mapa
- Tracking de ubicación en tiempo real

Incluye mapas interactivos en el dashboard y portal de clientes.`,
    category: 'logistics',
    icon: MapPin,
    installed: true,
    official: true,
    rating: 4.9,
    reviewCount: 423,
    installs: 2340,
    version: '1.8.2',
    lastUpdated: '2024-11-28',
    developer: 'CampoTech',
    website: 'https://cloud.google.com/maps-platform',
    documentation: 'https://developers.campotech.com/integrations/google-maps',
    features: [
      { name: 'Geocodificación', available: true },
      { name: 'Rutas', available: true },
      { name: 'Distancias', available: true },
      { name: 'ETA', available: true },
      { name: 'Mapas estáticos', available: true },
      { name: 'Street View', available: false },
    ],
    permissions: [
      'Geocodificar direcciones',
      'Calcular rutas',
      'Acceder a Maps API',
    ],
    config: {
      apiKey: 'AIza•••••••••••••',
      region: 'AR',
    },
  },
  stripe: {
    id: 'stripe',
    name: 'Stripe',
    description: 'Plataforma global de pagos para negocios en internet.',
    longDescription: `Stripe es la infraestructura de pagos más completa para internet.

- Acepta pagos de más de 135 monedas
- Suscripciones y facturación recurrente
- Connect para marketplaces
- Radar para prevención de fraude
- Terminal para pagos presenciales

Ideal para empresas con clientes internacionales.`,
    category: 'payments',
    icon: CreditCard,
    installed: false,
    official: true,
    rating: 4.9,
    reviewCount: 89,
    installs: 890,
    version: '1.5.0',
    lastUpdated: '2024-12-03',
    developer: 'CampoTech',
    website: 'https://stripe.com',
    documentation: 'https://developers.campotech.com/integrations/stripe',
    features: [
      { name: 'Pagos internacionales', available: true },
      { name: 'Suscripciones', available: true },
      { name: 'Facturación', available: true },
      { name: 'Connect', available: true },
      { name: 'Radar', available: true },
      { name: 'Terminal', available: false },
    ],
    permissions: [
      'Crear pagos',
      'Gestionar clientes',
      'Configurar webhooks',
      'Emitir reembolsos',
    ],
  },
  hubspot: {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM, marketing y ventas.',
    longDescription: `Sincroniza CampoTech con HubSpot CRM para una vista unificada de tus clientes.

- Sincronización bidireccional de contactos
- Creación automática de deals desde trabajos
- Tracking de actividades
- Segmentación por comportamiento
- Workflows de automatización

Ideal para equipos de ventas y marketing.`,
    category: 'crm',
    icon: Users,
    installed: false,
    official: true,
    rating: 4.7,
    reviewCount: 67,
    installs: 450,
    version: '2.1.0',
    lastUpdated: '2024-11-20',
    developer: 'CampoTech',
    website: 'https://www.hubspot.com',
    documentation: 'https://developers.campotech.com/integrations/hubspot',
    features: [
      { name: 'CRM', available: true },
      { name: 'Deals', available: true },
      { name: 'Marketing', available: true },
      { name: 'Tickets', available: true },
      { name: 'Workflows', available: true },
      { name: 'Reports', available: true },
    ],
    permissions: [
      'Sincronizar contactos',
      'Crear deals',
      'Leer actividades',
      'Gestionar tickets',
    ],
  },
};

// Default integration data for unknown IDs
const defaultIntegration = {
  id: 'unknown',
  name: 'Integración',
  description: 'Detalles no disponibles.',
  longDescription: 'No se encontró información para esta integración.',
  category: 'other',
  icon: Zap,
  installed: false,
  official: false,
  rating: 0,
  reviewCount: 0,
  installs: 0,
  version: '1.0.0',
  lastUpdated: '-',
  developer: 'Desconocido',
  features: [],
  permissions: [],
};

export default function IntegrationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [isInstalling, setIsInstalling] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'logs'>('overview');

  const integrationId = params.id as string;
  const integration = integrationsData[integrationId] || { ...defaultIntegration, id: integrationId };
  const Icon = integration.icon;

  const handleInstall = async () => {
    setIsInstalling(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsInstalling(false);
    // In production, this would trigger OAuth flow or configuration modal
    alert('Instalación iniciada. Configura las credenciales en el panel de ajustes.');
  };

  const handleUninstall = async () => {
    if (!confirm('¿Estás seguro de que deseas desinstalar esta integración? Se perderán todas las configuraciones.')) {
      return;
    }
    setIsUninstalling(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsUninstalling(false);
    router.push('/dashboard/integrations');
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/dashboard/integrations"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al marketplace
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="rounded-xl bg-gray-100 p-4">
            <Icon className="h-12 w-12 text-gray-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{integration.name}</h1>
              {integration.official && (
                <span className="flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 text-sm rounded-full">
                  <Shield className="h-4 w-4" />
                  Oficial
                </span>
              )}
              {integration.installed && (
                <span className="flex items-center gap-1 px-2 py-1 bg-success-100 text-success-700 text-sm rounded-full">
                  <CheckCircle className="h-4 w-4" />
                  Instalada
                </span>
              )}
            </div>
            <p className="text-gray-500 mt-2">{integration.description}</p>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 text-warning-500 fill-warning-500" />
                {integration.rating} ({integration.reviewCount} reseñas)
              </span>
              <span className="flex items-center gap-1">
                <Download className="h-4 w-4" />
                {integration.installs.toLocaleString()} instalaciones
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                v{integration.version}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {integration.installed ? (
              <>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Configurar
                </button>
                <button
                  onClick={handleUninstall}
                  disabled={isUninstalling}
                  className="btn btn-secondary text-error-600 hover:bg-error-50 flex items-center gap-2"
                >
                  {isUninstalling ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Desinstalar
                </button>
              </>
            ) : (
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="btn btn-primary flex items-center gap-2"
              >
                {isInstalling ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {isInstalling ? 'Instalando...' : 'Instalar'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-6">
          {[
            { id: 'overview', label: 'Descripción' },
            { id: 'settings', label: 'Configuración', requiresInstall: true },
            { id: 'logs', label: 'Actividad', requiresInstall: true },
          ].map((tab) => (
            <button
              key={tab.id}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={() => setActiveTab(tab.id as any)}
              disabled={tab.requiresInstall && !integration.installed}
              className={`pb-3 border-b-2 transition-colors ${activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                } ${tab.requiresInstall && !integration.installed ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Descripción</h2>
              <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-line">
                {integration.longDescription}
              </div>
            </div>

            {/* Features */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Funcionalidades</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {integration.features?.map((feature: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
                  >
                    {feature.available ? (
                      <Check className="h-5 w-5 text-success-500" />
                    ) : (
                      <X className="h-5 w-5 text-gray-300" />
                    )}
                    <span className={feature.available ? 'text-gray-700' : 'text-gray-400'}>
                      {feature.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Permissions */}
            {integration.permissions?.length > 0 && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Permisos requeridos</h2>
                <div className="space-y-2">
                  {integration.permissions.map((permission: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 text-gray-600">
                      <Shield className="h-4 w-4 text-gray-400" />
                      {permission}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Info card */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Información</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Desarrollador</dt>
                  <dd className="font-medium text-gray-900">{integration.developer}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Versión</dt>
                  <dd className="font-medium text-gray-900">{integration.version}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Actualizada</dt>
                  <dd className="font-medium text-gray-900">{integration.lastUpdated}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Categoría</dt>
                  <dd className="font-medium text-gray-900 capitalize">{integration.category}</dd>
                </div>
              </dl>
            </div>

            {/* Links */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Enlaces</h2>
              <div className="space-y-2">
                {integration.website && (
                  <a
                    href={integration.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary-600 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Sitio web
                  </a>
                )}
                {integration.documentation && (
                  <a
                    href={integration.documentation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary-600 hover:underline"
                  >
                    <Book className="h-4 w-4" />
                    Documentación
                  </a>
                )}
              </div>
            </div>

            {/* Support */}
            <div className="card p-6 bg-gray-50">
              <h3 className="font-medium text-gray-900">¿Necesitas ayuda?</h3>
              <p className="text-sm text-gray-500 mt-1">
                Contacta a nuestro equipo de soporte para asistencia con la configuración.
              </p>
              <a
                href="mailto:soporte@campotech.com"
                className="btn btn-secondary mt-3 w-full text-center"
              >
                Contactar soporte
              </a>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && integration.installed && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Configuración</h2>

          {integration.config && (
            <div className="space-y-4 max-w-xl">
              {Object.entries(integration.config).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  {typeof value === 'boolean' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={value}
                        readOnly
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-600">
                        {value ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={String(value)}
                      readOnly
                      className="input w-full bg-gray-50"
                    />
                  )}
                </div>
              ))}

              <div className="pt-4 flex gap-3">
                <button className="btn btn-primary">Guardar cambios</button>
                <button className="btn btn-secondary">Reconectar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && integration.installed && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Actividad reciente</h2>
            <button className="btn btn-secondary flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
          </div>

          {/* Sample logs */}
          <div className="space-y-3">
            {[
              { time: 'Hace 5 min', action: 'Pago procesado', status: 'success', details: 'MP-123456' },
              { time: 'Hace 15 min', action: 'Webhook recibido', status: 'success', details: 'payment.created' },
              { time: 'Hace 1 hora', action: 'Sincronización', status: 'success', details: '12 registros' },
              { time: 'Hace 2 horas', action: 'Error de conexión', status: 'error', details: 'Timeout' },
              { time: 'Hace 3 horas', action: 'Reembolso procesado', status: 'success', details: 'RF-789012' },
            ].map((log, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 p-3 rounded-lg bg-gray-50"
              >
                <div
                  className={`h-2 w-2 rounded-full ${log.status === 'success' ? 'bg-success-500' : 'bg-error-500'
                    }`}
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{log.action}</div>
                  <div className="text-sm text-gray-500">{log.details}</div>
                </div>
                <div className="text-sm text-gray-400">{log.time}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-center">
            <button className="text-sm text-primary-600 hover:underline">
              Ver todos los logs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
