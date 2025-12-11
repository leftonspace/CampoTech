'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatCurrency, formatRelativeTime, JOB_STATUS_LABELS, JOB_STATUS_COLORS } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Briefcase,
  FileText,
  DollarSign,
  TrendingUp,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Truck,
  Package,
  Calendar,
} from 'lucide-react';
import { StockAlerts, FleetStatus, TodaySchedule } from '@/components/dashboard';

interface DashboardStats {
  todayJobs: number;
  pendingJobs: number;
  completedToday: number;
  pendingInvoices: number;
  unpaidAmount: number;
  monthlyRevenue: number;
}

interface RecentActivity {
  id: string;
  type: 'job' | 'invoice' | 'payment';
  message: string;
  timestamp: string;
  status?: string;
}

export default function DashboardPage() {
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.dashboard.stats(),
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => api.dashboard.recentActivity(),
  });

  const stats = statsData?.data as DashboardStats | undefined;
  const activity = activityData?.data as RecentActivity[] | undefined;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Resumen de tu negocio</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/jobs/new" className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo trabajo
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Trabajos hoy"
          value={stats?.todayJobs ?? '-'}
          icon={Briefcase}
          loading={statsLoading}
          color="blue"
        />
        <StatCard
          title="Completados"
          value={stats?.completedToday ?? '-'}
          icon={CheckCircle}
          loading={statsLoading}
          color="green"
        />
        <StatCard
          title="Facturas pendientes"
          value={stats?.pendingInvoices ?? '-'}
          icon={FileText}
          loading={statsLoading}
          color="yellow"
        />
        <StatCard
          title="Por cobrar"
          value={stats?.unpaidAmount ? formatCurrency(stats.unpaidAmount) : '-'}
          icon={DollarSign}
          loading={statsLoading}
          color="purple"
        />
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's jobs */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header flex flex-row items-center justify-between">
              <h2 className="card-title text-lg">Trabajos de hoy</h2>
              <Link
                href="/dashboard/jobs?date=today"
                className="text-sm text-primary-600 hover:underline"
              >
                Ver todos
                <ArrowRight className="ml-1 inline h-4 w-4" />
              </Link>
            </div>
            <div className="card-content">
              <TodayJobsList />
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title text-lg">Actividad reciente</h2>
            </div>
            <div className="card-content">
              {activityLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex gap-3">
                      <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activity?.length ? (
                <ul className="space-y-3">
                  {activity.slice(0, 5).map((item) => (
                    <li key={item.id} className="flex gap-3">
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          item.type === 'job' && 'bg-blue-100 text-blue-600',
                          item.type === 'invoice' && 'bg-purple-100 text-purple-600',
                          item.type === 'payment' && 'bg-green-100 text-green-600'
                        )}
                      >
                        {item.type === 'job' && <Briefcase className="h-4 w-4" />}
                        {item.type === 'invoice' && <FileText className="h-4 w-4" />}
                        {item.type === 'payment' && <DollarSign className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm text-gray-900">{item.message}</p>
                        <p className="text-xs text-gray-500">
                          {formatRelativeTime(item.timestamp)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-sm text-gray-500">Sin actividad reciente</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Operations widgets row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's schedule by technician */}
        <div className="card">
          <div className="card-header flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary-600" />
              <h2 className="card-title text-lg">Agenda de hoy</h2>
            </div>
            <Link
              href="/dashboard/calendar"
              className="text-sm text-primary-600 hover:underline"
            >
              Ver calendario
              <ArrowRight className="ml-1 inline h-4 w-4" />
            </Link>
          </div>
          <div className="card-content">
            <TodaySchedule />
          </div>
        </div>

        {/* Fleet status */}
        <div className="card">
          <div className="card-header flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary-600" />
              <h2 className="card-title text-lg">Estado de flota</h2>
            </div>
            <Link
              href="/dashboard/fleet"
              className="text-sm text-primary-600 hover:underline"
            >
              Ver flota
              <ArrowRight className="ml-1 inline h-4 w-4" />
            </Link>
          </div>
          <div className="card-content">
            <FleetStatus />
          </div>
        </div>

        {/* Stock alerts */}
        <div className="card">
          <div className="card-header flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary-600" />
              <h2 className="card-title text-lg">Alertas de stock</h2>
            </div>
            <Link
              href="/dashboard/inventory/stock?filter=low"
              className="text-sm text-primary-600 hover:underline"
            >
              Ver inventario
              <ArrowRight className="ml-1 inline h-4 w-4" />
            </Link>
          </div>
          <div className="card-content">
            <StockAlerts />
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title text-lg">Acciones rápidas</h2>
        </div>
        <div className="card-content">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickAction
              href="/dashboard/jobs/new"
              icon={Plus}
              title="Crear trabajo"
              description="Agendar nuevo servicio"
            />
            <QuickAction
              href="/dashboard/customers/new"
              icon={Plus}
              title="Nuevo cliente"
              description="Agregar al sistema"
            />
            <QuickAction
              href="/dashboard/invoices?status=draft"
              icon={FileText}
              title="Borradores"
              description="Facturas sin emitir"
            />
            <QuickAction
              href="/dashboard/payments/reconciliation"
              icon={DollarSign}
              title="Conciliación"
              description="Verificar pagos"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  loading?: boolean;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}

function StatCard({ title, value, icon: Icon, loading, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-4">
        <div className={cn('rounded-full p-3', colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          {loading ? (
            <div className="h-7 w-16 animate-pulse rounded bg-gray-200" />
          ) : (
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface QuickActionProps {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}

function QuickAction({ href, icon: Icon, title, description }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-gray-50"
    >
      <div className="rounded-full bg-primary-100 p-2 text-primary-600">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </Link>
  );
}

function TodayJobsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['today-jobs'],
    queryFn: () => api.jobs.today(),
  });

  const jobs = data?.data as Array<{
    id: string;
    title: string;
    status: string;
    customer?: { name: string };
    scheduledTimeStart?: string;
    scheduledTimeEnd?: string;
    address?: string;
  }> | undefined;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 rounded-lg border p-4">
            <div className="h-12 w-12 animate-pulse rounded-lg bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!jobs?.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <Briefcase className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-gray-500">No hay trabajos programados para hoy</p>
        <Link href="/dashboard/jobs/new" className="btn-primary mt-4 inline-flex">
          <Plus className="mr-2 h-4 w-4" />
          Crear trabajo
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {jobs.map((job) => (
        <li key={job.id}>
          <Link
            href={`/dashboard/jobs/${job.id}`}
            className="flex gap-4 rounded-lg border p-4 transition-colors hover:bg-gray-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
              <Clock className="h-6 w-6 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium text-gray-900">{job.title}</p>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                    JOB_STATUS_COLORS[job.status]
                  )}
                >
                  {JOB_STATUS_LABELS[job.status]}
                </span>
              </div>
              <p className="truncate text-sm text-gray-500">
                {job.customer?.name}
                {job.scheduledTimeStart && ` • ${job.scheduledTimeStart}`}
              </p>
              {job.address && (
                <p className="truncate text-xs text-gray-400">{job.address}</p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
