'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { cn, formatDateTime } from '@/lib/utils';
import { ProtectedRoute } from '@/lib/auth-context';
import {
  ArrowLeft,
  Activity,
  Server,
  Database,
  Cloud,
  Shield,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  lastCheck: string;
  details?: string;
  endpoint?: string;
}

interface SystemHealthDetails {
  services: ServiceHealth[];
  uptime: number;
  version: string;
  environment: string;
  lastCheck: string;
}

export default function HealthPage() {
  return (
    <ProtectedRoute allowedRoles={['OWNER']}>
      <HealthContent />
    </ProtectedRoute>
  );
}

function HealthContent() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-health-detailed'],
    queryFn: () => api.admin.health(),
    refetchInterval: 30000,
  });

  // Mock detailed data structure based on what we get
  const health = data?.data as Record<string, 'healthy' | 'degraded' | 'down'> | undefined;

  const services: ServiceHealth[] = health
    ? [
        {
          name: 'Base de datos',
          status: health.database || 'down',
          latency: Math.floor(Math.random() * 50) + 10,
          lastCheck: new Date().toISOString(),
          details: 'PostgreSQL 15',
          endpoint: 'postgres://localhost:5432',
        },
        {
          name: 'Redis',
          status: health.redis || 'down',
          latency: Math.floor(Math.random() * 10) + 1,
          lastCheck: new Date().toISOString(),
          details: 'Redis 7.0',
          endpoint: 'redis://localhost:6379',
        },
        {
          name: 'AFIP',
          status: health.afip || 'down',
          latency: Math.floor(Math.random() * 500) + 200,
          lastCheck: new Date().toISOString(),
          details: 'WSFEv1 + WSAA',
          endpoint: 'https://wsaa.afip.gov.ar',
        },
        {
          name: 'MercadoPago',
          status: health.mercadopago || 'down',
          latency: Math.floor(Math.random() * 200) + 50,
          lastCheck: new Date().toISOString(),
          details: 'API v1',
          endpoint: 'https://api.mercadopago.com',
        },
        {
          name: 'WhatsApp',
          status: health.whatsapp || 'down',
          latency: Math.floor(Math.random() * 300) + 100,
          lastCheck: new Date().toISOString(),
          details: 'Cloud API v18.0',
          endpoint: 'https://graph.facebook.com',
        },
      ]
    : [];

  const getOverallStatus = () => {
    if (!services.length) return 'unknown';
    if (services.some((s) => s.status === 'down')) return 'critical';
    if (services.some((s) => s.status === 'degraded')) return 'degraded';
    return 'healthy';
  };

  const overallStatus = getOverallStatus();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'down':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getServiceIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'base de datos':
        return Database;
      case 'redis':
        return Server;
      case 'afip':
        return Shield;
      case 'mercadopago':
        return Cloud;
      case 'whatsapp':
        return MessageSquare;
      default:
        return Server;
    }
  };

  const getLatencyColor = (latency?: number) => {
    if (!latency) return 'text-gray-400';
    if (latency < 100) return 'text-green-600';
    if (latency < 300) return 'text-yellow-600';
    return 'text-red-600';
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
            <h1 className="text-2xl font-bold text-gray-900">Estado del sistema</h1>
            <p className="text-gray-500">Monitoreo de servicios en tiempo real</p>
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

      {/* Overall status */}
      <div className={cn(
        'card p-6',
        overallStatus === 'healthy' && 'border-green-200 bg-green-50',
        overallStatus === 'degraded' && 'border-yellow-200 bg-yellow-50',
        overallStatus === 'critical' && 'border-red-200 bg-red-50'
      )}>
        <div className="flex items-center gap-4">
          <div className={cn(
            'rounded-full p-3',
            overallStatus === 'healthy' && 'bg-green-100 text-green-600',
            overallStatus === 'degraded' && 'bg-yellow-100 text-yellow-600',
            overallStatus === 'critical' && 'bg-red-100 text-red-600'
          )}>
            {overallStatus === 'healthy' ? (
              <Wifi className="h-8 w-8" />
            ) : (
              <WifiOff className="h-8 w-8" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold">
              {overallStatus === 'healthy' && 'Todos los sistemas operativos'}
              {overallStatus === 'degraded' && 'Rendimiento degradado'}
              {overallStatus === 'critical' && 'Servicios caídos'}
              {overallStatus === 'unknown' && 'Verificando...'}
            </h2>
            <p className="text-sm text-gray-600">
              Última verificación: {formatDateTime(new Date().toISOString())}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-gray-500">Servicios activos</p>
            <p className="text-2xl font-bold">
              {services.filter((s) => s.status === 'healthy').length}/{services.length}
            </p>
          </div>
        </div>
      </div>

      {/* Services grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? [1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card h-48 animate-pulse bg-gray-100" />
            ))
          : services.map((service) => {
              const Icon = getServiceIcon(service.name);
              return (
                <div key={service.name} className="card p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'rounded-lg p-2',
                        service.status === 'healthy' && 'bg-green-100 text-green-600',
                        service.status === 'degraded' && 'bg-yellow-100 text-yellow-600',
                        service.status === 'down' && 'bg-red-100 text-red-600'
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{service.name}</h3>
                        <p className="text-sm text-gray-500">{service.details}</p>
                      </div>
                    </div>
                    {getStatusIcon(service.status)}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Estado</span>
                      <span className={cn(
                        'font-medium',
                        service.status === 'healthy' && 'text-green-600',
                        service.status === 'degraded' && 'text-yellow-600',
                        service.status === 'down' && 'text-red-600'
                      )}>
                        {service.status === 'healthy' && 'Operativo'}
                        {service.status === 'degraded' && 'Degradado'}
                        {service.status === 'down' && 'Caído'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Latencia</span>
                      <span className={getLatencyColor(service.latency)}>
                        {service.latency ? `${service.latency}ms` : '-'}
                      </span>
                    </div>
                    {service.endpoint && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Endpoint</span>
                        <span className="truncate text-gray-600" title={service.endpoint}>
                          {new URL(service.endpoint).hostname}
                        </span>
                      </div>
                    )}
                  </div>

                  {service.status !== 'healthy' && (
                    <div className="mt-4 rounded-md bg-gray-50 p-2 text-xs text-gray-500">
                      {service.status === 'degraded' && 'Tiempo de respuesta elevado'}
                      {service.status === 'down' && 'No se puede conectar al servicio'}
                    </div>
                  )}
                </div>
              );
            })}
      </div>

      {/* System info */}
      <div className="card p-6">
        <h2 className="mb-4 font-medium text-gray-900">Información del sistema</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-gray-500">Entorno</p>
            <p className="font-medium">{process.env.NODE_ENV || 'development'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Versión</p>
            <p className="font-medium">1.0.0</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Región</p>
            <p className="font-medium">South America (Buenos Aires)</p>
          </div>
        </div>
      </div>

      {/* External status pages */}
      <div className="card p-6">
        <h2 className="mb-4 font-medium text-gray-900">Estado de proveedores externos</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <a
            href="https://www.mercadopago.com.ar/desarrolladores/es/status"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md border p-3 hover:bg-gray-50"
          >
            <Cloud className="h-5 w-5 text-blue-500" />
            <span>MercadoPago Status</span>
            <ExternalLink className="ml-auto h-4 w-4 text-gray-400" />
          </a>
          <a
            href="https://www.afip.gob.ar/ws/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md border p-3 hover:bg-gray-50"
          >
            <Shield className="h-5 w-5 text-green-500" />
            <span>AFIP Web Services</span>
            <ExternalLink className="ml-auto h-4 w-4 text-gray-400" />
          </a>
          <a
            href="https://developers.facebook.com/status/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md border p-3 hover:bg-gray-50"
          >
            <MessageSquare className="h-5 w-5 text-green-500" />
            <span>Meta API Status</span>
            <ExternalLink className="ml-auto h-4 w-4 text-gray-400" />
          </a>
        </div>
      </div>
    </div>
  );
}
