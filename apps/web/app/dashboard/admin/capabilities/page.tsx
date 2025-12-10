'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { cn, formatDateTime } from '@/lib/utils';
import { ProtectedRoute } from '@/lib/auth-context';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Power,
  Zap,
  MessageSquare,
  CreditCard,
  FileText,
  Bell,
  Settings,
  Clock,
  Activity,
  MapPin,
  Package,
  Users,
  BarChart3,
  ShieldCheck,
  Gauge,
  Store,
  Palette,
} from 'lucide-react';

interface Capability {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'integration' | 'feature' | 'system';
  source?: string;
  lastChanged?: string;
  changedBy?: string;
  isPanicMode?: boolean;
  panicReason?: string;
}

const CAPABILITY_ICONS: Record<string, React.ElementType> = {
  // External integrations
  'external.afip': FileText,
  'external.mercadopago': CreditCard,
  'external.whatsapp': MessageSquare,
  'external.whatsapp_voice_ai': Zap,
  'external.push_notifications': Bell,
  // Domain capabilities
  'domain.invoicing': FileText,
  'domain.payments': CreditCard,
  'domain.scheduling': Clock,
  'domain.job_assignment': Users,
  'domain.offline_sync': RefreshCw,
  'domain.technician_gps': MapPin,
  'domain.consumer_marketplace': Store,
  'domain.customer_portal': Users,
  'domain.inventory_management': Package,
  'domain.audit_logging': Activity,
  // Services
  'services.cae_queue': Activity,
  'services.whatsapp_queue': MessageSquare,
  'services.whatsapp_aggregation': MessageSquare,
  'services.payment_reconciliation': CreditCard,
  'services.abuse_detection': ShieldCheck,
  'services.rate_limiting': Gauge,
  'services.analytics_pipeline': BarChart3,
  'services.review_fraud_detection': ShieldCheck,
  'services.notification_queue': Bell,
  // UI
  'ui.simple_mode': Settings,
  'ui.advanced_mode': Settings,
  'ui.pricebook': FileText,
  'ui.reporting_dashboard': BarChart3,
  'ui.marketplace_dashboard': Store,
  'ui.whitelabel_portal': Palette,
  // Fallback mappings for old-style IDs
  afip: FileText,
  mercadopago: CreditCard,
  whatsapp: MessageSquare,
  notifications: Bell,
  voice_ai: Zap,
  invoicing: FileText,
  payments: CreditCard,
  scheduling: Clock,
};

export default function CapabilitiesPage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'admin']}>
      <CapabilitiesContent />
    </ProtectedRoute>
  );
}

function CapabilitiesContent() {
  const queryClient = useQueryClient();
  const [confirmToggle, setConfirmToggle] = useState<Capability | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-capabilities'],
    queryFn: () => api.admin.capabilities(),
    refetchInterval: 30000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ capability, enabled }: { capability: string; enabled: boolean }) =>
      api.admin.toggleCapability(capability, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-capabilities'] });
      setConfirmToggle(null);
    },
  });

  // Use real data from API, no more mock data
  const capabilities: Capability[] = (data?.data as Capability[]) || [];

  const groupedCapabilities = {
    integration: capabilities.filter((c) => c.category === 'integration'),
    feature: capabilities.filter((c) => c.category === 'feature'),
    system: capabilities.filter((c) => c.category === 'system'),
  };

  const panicModeCapabilities = capabilities.filter((c) => c.isPanicMode);

  const handleToggle = (capability: Capability) => {
    if (capability.enabled) {
      // Confirm before disabling
      setConfirmToggle(capability);
    } else {
      // Enable directly
      toggleMutation.mutate({ capability: capability.id, enabled: true });
    }
  };

  const confirmDisable = () => {
    if (confirmToggle) {
      toggleMutation.mutate({ capability: confirmToggle.id, enabled: false });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/admin"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Capacidades del sistema</h1>
            <p className="text-gray-500">Activar/desactivar funcionalidades</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-outline"
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Panic mode alert */}
      {panicModeCapabilities.length > 0 && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-red-800">Modo pánico activo</h3>
              <p className="mt-1 text-sm text-red-700">
                Las siguientes integraciones están en modo pánico:
              </p>
              <ul className="mt-2 space-y-1">
                {panicModeCapabilities.map((cap) => (
                  <li key={cap.id} className="text-sm text-red-600">
                    • {cap.name}: {cap.panicReason || 'Error de conexión'}
                  </li>
                ))}
              </ul>
            </div>
            <button className="btn-outline text-red-600 hover:bg-red-100">
              Resolver pánico
            </button>
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Activas</p>
              <p className="text-2xl font-bold text-green-600">
                {capabilities.filter((c) => c.enabled).length}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gray-100 p-2 text-gray-600">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Desactivadas</p>
              <p className="text-2xl font-bold">
                {capabilities.filter((c) => !c.enabled).length}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">En pánico</p>
              <p className="text-2xl font-bold text-red-600">
                {panicModeCapabilities.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="card">
        <div className="border-b p-4">
          <h2 className="font-medium text-gray-900">Integraciones externas</h2>
          <p className="text-sm text-gray-500">Conexiones con servicios de terceros</p>
        </div>
        <div className="divide-y">
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))
          ) : (
            groupedCapabilities.integration.map((cap) => (
              <CapabilityRow
                key={cap.id}
                capability={cap}
                onToggle={() => handleToggle(cap)}
                isLoading={toggleMutation.isPending}
              />
            ))
          )}
        </div>
      </div>

      {/* Features */}
      <div className="card">
        <div className="border-b p-4">
          <h2 className="font-medium text-gray-900">Funcionalidades</h2>
          <p className="text-sm text-gray-500">Características del sistema</p>
        </div>
        <div className="divide-y">
          {groupedCapabilities.feature.map((cap) => (
            <CapabilityRow
              key={cap.id}
              capability={cap}
              onToggle={() => handleToggle(cap)}
              isLoading={toggleMutation.isPending}
            />
          ))}
        </div>
      </div>

      {/* System */}
      <div className="card">
        <div className="border-b p-4">
          <h2 className="font-medium text-gray-900">Sistema</h2>
          <p className="text-sm text-gray-500">Configuración del sistema</p>
        </div>
        <div className="divide-y">
          {groupedCapabilities.system.map((cap) => (
            <CapabilityRow
              key={cap.id}
              capability={cap}
              onToggle={() => handleToggle(cap)}
              isLoading={toggleMutation.isPending}
            />
          ))}
        </div>
      </div>

      {/* Confirm disable modal */}
      {confirmToggle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-yellow-600">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-medium">Confirmar desactivación</h3>
            </div>
            <p className="mt-4 text-gray-600">
              ¿Estás seguro de desactivar <strong>{confirmToggle.name}</strong>?
            </p>
            <p className="mt-2 text-sm text-gray-500">
              {confirmToggle.description}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmToggle(null)}
                className="btn-outline"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDisable}
                disabled={toggleMutation.isPending}
                className="btn-danger"
              >
                {toggleMutation.isPending ? 'Desactivando...' : 'Desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CapabilityRow({
  capability,
  onToggle,
  isLoading,
}: {
  capability: Capability;
  onToggle: () => void;
  isLoading: boolean;
}) {
  const Icon = CAPABILITY_ICONS[capability.id] || Settings;

  return (
    <div className="flex items-center gap-4 p-4">
      <div className={cn(
        'rounded-lg p-2',
        capability.enabled
          ? 'bg-green-100 text-green-600'
          : 'bg-gray-100 text-gray-400'
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900">{capability.name}</h3>
          {capability.isPanicMode && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
              Pánico
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">{capability.description}</p>
        {capability.lastChanged && (
          <p className="mt-1 text-xs text-gray-400">
            Modificado: {formatDateTime(capability.lastChanged)}
            {capability.changedBy && ` por ${capability.changedBy}`}
          </p>
        )}
      </div>
      <button
        onClick={onToggle}
        disabled={isLoading || capability.isPanicMode}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          capability.enabled ? 'bg-green-500' : 'bg-gray-300',
          (isLoading || capability.isPanicMode) && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            capability.enabled && 'translate-x-5'
          )}
        />
      </button>
    </div>
  );
}
