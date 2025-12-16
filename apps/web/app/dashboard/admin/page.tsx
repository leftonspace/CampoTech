'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { ProtectedRoute } from '@/lib/auth-context';
import {
  Activity,
  Server,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Layers,
  Shield,
  Database,
  Cloud,
} from 'lucide-react';

interface SystemHealth {
  database: 'healthy' | 'degraded' | 'down';
  redis: 'healthy' | 'degraded' | 'down';
  afip: 'healthy' | 'degraded' | 'down';
  mercadopago: 'healthy' | 'degraded' | 'down';
  whatsapp: 'healthy' | 'degraded' | 'down';
}

interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export default function AdminPage() {
  return (
    <ProtectedRoute allowedRoles={['OWNER']}>
      <AdminContent />
    </ProtectedRoute>
  );
}

function AdminContent() {
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['admin-health'],
    queryFn: () => api.admin.health(),
    refetchInterval: 30000,
  });

  const { data: queuesData, isLoading: queuesLoading } = useQuery({
    queryKey: ['admin-queues'],
    queryFn: () => api.admin.queues(),
    refetchInterval: 10000,
  });

  const health = healthData?.data as SystemHealth | undefined;
  const queues = queuesData?.data as QueueStatus[] | undefined;

  const totalFailed = queues?.reduce((sum, q) => sum + q.failed, 0) || 0;
  const totalWaiting = queues?.reduce((sum, q) => sum + q.waiting, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de administración</h1>
        <p className="text-gray-500">Monitoreo y control del sistema</p>
      </div>

      {/* Alert banner */}
      {totalFailed > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-danger-50 p-4 text-danger-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">{totalFailed} tareas fallidas en cola</p>
            <p className="text-sm">Revisá la cola de DLQ para reintentar o descartar</p>
          </div>
          <Link href="/dashboard/admin/queues" className="btn-outline text-danger-700">
            Ver colas
          </Link>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickStat
          title="Estado del sistema"
          value={getOverallHealth(health)}
          icon={Activity}
          color={getHealthColor(health)}
        />
        <QuickStat
          title="Tareas en cola"
          value={totalWaiting.toString()}
          icon={Layers}
          color="blue"
        />
        <QuickStat
          title="Tareas fallidas"
          value={totalFailed.toString()}
          icon={XCircle}
          color={totalFailed > 0 ? 'red' : 'green'}
        />
        <QuickStat
          title="Servicios activos"
          value={countHealthyServices(health)}
          icon={Server}
          color="green"
        />
      </div>

      {/* Health status */}
      <div className="card">
        <div className="card-header flex flex-row items-center justify-between">
          <h2 className="card-title text-lg">Estado de servicios</h2>
          <Link
            href="/dashboard/admin/health"
            className="text-sm text-primary-600 hover:underline"
          >
            Ver detalles
            <ChevronRight className="ml-1 inline h-4 w-4" />
          </Link>
        </div>
        <div className="card-content">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <ServiceCard
              name="Base de datos"
              status={health?.database}
              icon={Database}
              loading={healthLoading}
            />
            <ServiceCard
              name="Redis"
              status={health?.redis}
              icon={Server}
              loading={healthLoading}
            />
            <ServiceCard
              name="AFIP"
              status={health?.afip}
              icon={Shield}
              loading={healthLoading}
            />
            <ServiceCard
              name="MercadoPago"
              status={health?.mercadopago}
              icon={Cloud}
              loading={healthLoading}
            />
            <ServiceCard
              name="WhatsApp"
              status={health?.whatsapp}
              icon={Cloud}
              loading={healthLoading}
            />
          </div>
        </div>
      </div>

      {/* Queues */}
      <div className="card">
        <div className="card-header flex flex-row items-center justify-between">
          <h2 className="card-title text-lg">Colas de trabajo</h2>
          <Link
            href="/dashboard/admin/queues"
            className="text-sm text-primary-600 hover:underline"
          >
            Gestionar colas
            <ChevronRight className="ml-1 inline h-4 w-4" />
          </Link>
        </div>
        <div className="card-content">
          {queuesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : queues?.length ? (
            <div className="space-y-2">
              {queues.map((queue) => (
                <QueueRow key={queue.name} queue={queue} />
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">No hay colas configuradas</p>
          )}
        </div>
      </div>

      {/* Admin links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AdminLink
          href="/dashboard/admin/health"
          icon={Activity}
          title="Salud del sistema"
          description="Monitoreo detallado de servicios"
        />
        <AdminLink
          href="/dashboard/admin/queues"
          icon={Layers}
          title="Gestión de colas"
          description="Ver y gestionar tareas en cola"
        />
        <AdminLink
          href="/dashboard/admin/capabilities"
          icon={Shield}
          title="Capacidades"
          description="Activar/desactivar funcionalidades"
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function QuickStat({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={cn('rounded-full p-2', colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ServiceCard({
  name,
  status,
  icon: Icon,
  loading,
}: {
  name: string;
  status?: 'healthy' | 'degraded' | 'down';
  icon: React.ElementType;
  loading?: boolean;
}) {
  const statusConfig = {
    healthy: { icon: CheckCircle, color: 'text-success-500', bg: 'bg-success-50', label: 'OK' },
    degraded: { icon: AlertTriangle, color: 'text-warning-500', bg: 'bg-warning-50', label: 'Degradado' },
    down: { icon: XCircle, color: 'text-danger-500', bg: 'bg-danger-50', label: 'Caído' },
  };

  const config = status ? statusConfig[status] : statusConfig.healthy;

  return (
    <div className={cn('rounded-lg p-4', config.bg)}>
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-gray-500" />
        <config.icon className={cn('h-5 w-5', config.color)} />
      </div>
      <p className="mt-2 font-medium text-gray-900">{name}</p>
      <p className={cn('text-sm', config.color)}>{loading ? '...' : config.label}</p>
    </div>
  );
}

function QueueRow({ queue }: { queue: QueueStatus }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <Layers className="h-5 w-5 text-gray-400" />
        <span className="font-medium text-gray-900">{queue.name}</span>
      </div>
      <div className="flex gap-4 text-sm">
        <span className="text-blue-600">{queue.waiting} esperando</span>
        <span className="text-green-600">{queue.active} activos</span>
        {queue.failed > 0 && <span className="text-red-600">{queue.failed} fallidos</span>}
      </div>
    </div>
  );
}

function AdminLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-md"
    >
      <div className="rounded-lg bg-primary-100 p-3 text-primary-600">
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1">
        <h3 className="font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-gray-400" />
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getOverallHealth(health?: SystemHealth): string {
  if (!health) return 'Cargando...';
  const statuses = Object.values(health);
  if (statuses.some((s) => s === 'down')) return 'Crítico';
  if (statuses.some((s) => s === 'degraded')) return 'Degradado';
  return 'Saludable';
}

function getHealthColor(health?: SystemHealth): string {
  if (!health) return 'blue';
  const statuses = Object.values(health);
  if (statuses.some((s) => s === 'down')) return 'red';
  if (statuses.some((s) => s === 'degraded')) return 'yellow';
  return 'green';
}

function countHealthyServices(health?: SystemHealth): string {
  if (!health) return '-';
  const total = Object.keys(health).length;
  const healthy = Object.values(health).filter((s) => s === 'healthy').length;
  return `${healthy}/${total}`;
}
