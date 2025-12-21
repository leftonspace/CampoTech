'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, JOB_STATUS_LABELS } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Briefcase,
  FileText,
  DollarSign,
  Users,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Phone,
  MoreHorizontal,
  TrendingUp,
  User,
} from 'lucide-react';
import { OnboardingChecklist } from '@/components/dashboard';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface DashboardStats {
  // Jobs
  todayJobs: number;
  yesterdayJobs: number;
  jobsTrend: string | null;
  pendingJobs: number;
  completedToday: number;
  // Customers
  activeCustomers: number;
  customerTrend: string | null;
  // Revenue
  pendingInvoices: number;
  unpaidAmount: number;
  todayRevenue: number;
  revenueTrend: string | null;
  // Rating
  averageRating: string | null;
  ratingCount: number;
}

interface Job {
  id: string;
  jobNumber: string;
  serviceType: string;
  description?: string;
  status: string;
  urgency: string;
  customer?: {
    name: string;
    address?: { street?: string; number?: string; city?: string } | string;
  };
  technician?: {
    id: string;
    name: string;
  };
  scheduledTimeSlot?: { start?: string; end?: string };
}

interface Technician {
  id: string;
  name: string;
  avatar?: string;
  currentJob?: string;
  currentLocation?: string;
  phone?: string;
  status: 'available' | 'busy' | 'offline';
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatAddress(address: { street?: string; number?: string; city?: string } | string | undefined): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  const parts = [address.street, address.number, address.city].filter(Boolean);
  return parts.join(', ');
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  INSTALACION_SPLIT: 'Instalación de Split',
  MANTENIMIENTO_SPLIT: 'Mantenimiento de Split',
  REPARACION_SPLIT: 'Reparación de Split',
  INSTALACION: 'Instalación',
  REPARACION: 'Reparación',
  MANTENIMIENTO: 'Mantenimiento',
  DIAGNOSTICO: 'Diagnóstico',
  EMERGENCIA: 'Emergencia',
};

const URGENCY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  HIGH: { bg: 'bg-red-100', text: 'text-red-700', label: 'Alta' },
  URGENT: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgente' },
  NORMAL: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Media' },
  LOW: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Baja' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-gray-100', text: 'text-gray-700' },
  ASSIGNED: { bg: 'bg-purple-100', text: 'text-purple-700' },
  EN_ROUTE: { bg: 'bg-teal-100', text: 'text-teal-700' },
  IN_PROGRESS: { bg: 'bg-green-100', text: 'text-green-700' },
  COMPLETED: { bg: 'bg-green-50 border border-green-500', text: 'text-green-700' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const { user } = useAuth();
  const { isOnboardingComplete, isLoading: onboardingLoading } = useOnboardingStatus();

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.dashboard.stats(),
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['today-jobs'],
    queryFn: () => api.jobs.today(),
  });

  const { data: techData } = useQuery({
    queryKey: ['technicians-status'],
    queryFn: () => api.users.list({ role: 'TECHNICIAN' }),
  });

  const stats = statsData?.data as DashboardStats | undefined;
  const jobsResponse = jobsData?.data as { jobs?: Job[] } | undefined;
  const jobs = jobsResponse?.jobs || [];
  const technicians = (techData?.data || []) as Array<{
    id: string;
    name: string;
    avatar?: string;
    phone?: string;
    isActive?: boolean;
  }>;

  const firstName = user?.name?.split(' ')[0] || 'Usuario';
  const activeTechnicians = technicians.filter((t) => t.isActive !== false);

  return (
    <div className="space-y-6">
      {/* Personalized Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-gray-500">Acá tenés el resumen de tu negocio hoy.</p>
        </div>
        <Link href="/dashboard/jobs/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo trabajo
        </Link>
      </div>


      {/* Onboarding Checklist - Show for incomplete setups */}
      {!onboardingLoading && !isOnboardingComplete && (
        <OnboardingChecklist />
      )}

      {/* Stats Cards - Lovable Design with filled icon backgrounds */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Trabajos Hoy"
          value={stats?.todayJobs ?? 0}
          icon={Briefcase}
          color="teal"
          trend={stats?.jobsTrend}
          loading={statsLoading}
        />
        <StatCard
          title="Clientes Activos"
          value={stats?.activeCustomers ?? 0}
          icon={Users}
          color="coral"
          trend={stats?.customerTrend}
          loading={statsLoading}
        />
        <StatCard
          title="Facturado Hoy"
          value={stats?.todayRevenue ? formatCurrency(stats.todayRevenue) : '$0'}
          icon={DollarSign}
          color="green"
          trend={stats?.revenueTrend}
          loading={statsLoading}
        />
        <StatCard
          title="Rating Promedio"
          value={stats?.averageRating ?? '-'}
          icon={TrendingUp}
          color="pink"
          trend={stats?.ratingCount ? `${stats.ratingCount} reseñas` : null}
          loading={statsLoading}
        />
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Jobs Table - Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header border-b pb-4">
              <div>
                <h2 className="card-title text-lg font-semibold">Trabajos de Hoy</h2>
                <p className="text-sm text-gray-500">{jobs.length} trabajos programados</p>
              </div>
            </div>
            <div className="card-content p-0">
              <JobsTable jobs={jobs} loading={jobsLoading} />
            </div>
          </div>
        </div>

        {/* Right Sidebar (1/3) */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title text-lg font-semibold">Acciones Rápidas</h2>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-2 gap-3">
                <QuickActionButton
                  href="/dashboard/jobs/new"
                  icon={Plus}
                  label="Nuevo Trabajo"
                  primary
                />
                <QuickActionButton
                  href="/dashboard/customers/new"
                  icon={Users}
                  label="Nuevo Cliente"
                />
                <QuickActionButton
                  href="/dashboard/calendar"
                  icon={Calendar}
                  label="Agendar"
                />
                <QuickActionButton
                  href="/dashboard/invoices/new"
                  icon={FileText}
                  label="Nueva Factura"
                />
              </div>
            </div>
          </div>

          {/* Team Status */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title text-lg font-semibold">Estado del Equipo</h2>
              <p className="text-sm text-gray-500">{activeTechnicians.length} técnicos activos hoy</p>
            </div>
            <div className="card-content">
              <TeamStatus technicians={activeTechnicians} jobs={jobs} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: 'teal' | 'coral' | 'pink' | 'green';
  trend?: string | null;
  loading?: boolean;
}

function StatCard({ title, value, icon: Icon, color, trend, loading }: StatCardProps) {
  // Lovable design uses filled circular backgrounds with white icons
  const colorClasses = {
    teal: 'bg-teal-500',
    coral: 'bg-orange-500',
    pink: 'bg-pink-500',
    green: 'bg-emerald-500',
  };

  const iconBg = colorClasses[color];

  return (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded bg-gray-200 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          )}
          {trend && (
            <p className="text-xs text-emerald-600 font-medium mt-1">{trend}</p>
          )}
        </div>
        <div className={cn('rounded-full p-3', iconBg)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOBS TABLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function JobsTable({ jobs, loading }: { jobs: Job[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!jobs.length) {
    return (
      <div className="p-8 text-center">
        <Briefcase className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 text-gray-500">No hay trabajos programados para hoy</p>
        <Link href="/dashboard/jobs/new" className="btn-primary mt-4 inline-flex">
          <Plus className="mr-2 h-4 w-4" />
          Crear trabajo
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Trabajo
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Cliente
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Técnico
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Hora
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">

            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobRow({ job }: { job: Job }) {
  const urgencyStyle = URGENCY_STYLES[job.urgency] || URGENCY_STYLES.NORMAL;
  const statusStyle = STATUS_STYLES[job.status] || STATUS_STYLES.PENDING;
  const serviceLabel = SERVICE_TYPE_LABELS[job.serviceType] || job.serviceType;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-4">
        <div className="space-y-1">
          <p className="font-medium text-gray-900">{job.jobNumber}</p>
          <p className="text-sm text-gray-500">{serviceLabel}</p>
          <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', urgencyStyle.bg, urgencyStyle.text)}>
            {urgencyStyle.label}
          </span>
        </div>
      </td>
      <td className="px-4 py-4">
        <p className="font-medium text-gray-900">{job.customer?.name || '-'}</p>
        {job.customer?.address && (
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" />
            {formatAddress(job.customer.address)}
          </p>
        )}
      </td>
      <td className="px-4 py-4">
        {job.technician ? (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-900">{job.technician.name}</span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">Sin asignar</span>
        )}
      </td>
      <td className="px-4 py-4">
        <span className={cn('rounded-full px-3 py-1 text-xs font-medium', statusStyle.bg, statusStyle.text)}>
          {JOB_STATUS_LABELS[job.status] || job.status}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-1 text-gray-500">
          <Clock className="h-4 w-4" />
          <span className="text-sm">{job.scheduledTimeSlot?.start || '-'}</span>
        </div>
      </td>
      <td className="px-4 py-4 text-right">
        <Link
          href={`/dashboard/jobs/${job.id}`}
          className="p-2 hover:bg-gray-100 rounded-full inline-flex"
        >
          <MoreHorizontal className="h-4 w-4 text-gray-400" />
        </Link>
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK ACTION BUTTON
// ═══════════════════════════════════════════════════════════════════════════════

interface QuickActionButtonProps {
  href: string;
  icon: React.ElementType;
  label: string;
  primary?: boolean;
}

function QuickActionButton({ href, icon: Icon, label, primary }: QuickActionButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg p-4 text-center transition-all',
        primary
          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border'
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM STATUS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface TeamStatusProps {
  technicians: Array<{
    id: string;
    name: string;
    avatar?: string;
    phone?: string;
  }>;
  jobs: Job[];
}

function TeamStatus({ technicians, jobs }: TeamStatusProps) {
  if (!technicians.length) {
    return (
      <div className="text-center py-6">
        <Users className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm text-gray-500">No hay técnicos registrados</p>
      </div>
    );
  }

  // Find current job for each technician
  const getTechnicianCurrentJob = (techId: string) => {
    return jobs.find(
      (j) => j.technician?.id === techId && ['EN_ROUTE', 'IN_PROGRESS'].includes(j.status)
    );
  };

  return (
    <div className="space-y-3">
      {technicians.slice(0, 4).map((tech) => {
        const currentJob = getTechnicianCurrentJob(tech.id);
        const isAvailable = !currentJob;
        const statusLabel = currentJob
          ? JOB_STATUS_LABELS[currentJob.status] || currentJob.status
          : 'Disponible';
        const statusColor = currentJob
          ? 'bg-teal-100 text-teal-700'
          : 'bg-green-100 text-green-700';

        return (
          <div key={tech.id} className="flex items-start gap-3 p-3 rounded-lg border">
            {tech.avatar ? (
              <img
                src={tech.avatar}
                alt={tech.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                {getInitials(tech.name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-gray-900 truncate">{tech.name}</p>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', statusColor)}>
                  {statusLabel}
                </span>
              </div>
              {currentJob && (
                <>
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {SERVICE_TYPE_LABELS[currentJob.serviceType] || currentJob.serviceType}
                  </p>
                  {currentJob.customer?.address && (
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{formatAddress(currentJob.customer.address)}</span>
                    </p>
                  )}
                </>
              )}
              {tech.phone && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" />
                  {tech.phone}
                </p>
              )}
            </div>
          </div>
        );
      })}
      {technicians.length > 4 && (
        <Link
          href="/dashboard/settings/team"
          className="block text-center text-sm text-primary-600 hover:underline py-2"
        >
          Ver {technicians.length - 4} más
        </Link>
      )}
    </div>
  );
}
