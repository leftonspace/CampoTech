'use client';

/**
 * Dashboard Page
 * ==============
 *
 * Main dashboard showing customer overview: upcoming jobs,
 * pending invoices, recent activity, and quick actions.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  FileText,
  CreditCard,
  MapPin,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  Star,
} from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { useCustomerAuth } from '@/lib/customer-auth';
import { formatCurrency, formatDate, formatRelativeTime, getStatusColor, getStatusLabel } from '@/lib/utils';

interface DashboardData {
  upcomingJobs: any[];
  pendingInvoices: any[];
  recentJobs: any[];
  stats: {
    totalJobs: number;
    completedJobs: number;
    pendingPayments: number;
    pendingPaymentsAmount: number;
  };
  unratedJobs: any[];
}

export default function DashboardPage() {
  const { customer } = useCustomerAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError('');

    const result = await customerApi.getDashboard();

    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error?.message || 'Error al cargar el dashboard');
    }

    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={loadDashboard} className="btn-primary">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          ¡Hola, {customer?.name?.split(' ')[0] || 'Cliente'}!
        </h1>
        <p className="text-primary-100">
          Bienvenido a tu portal de servicios
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Trabajos totales"
          value={data?.stats.totalJobs || 0}
          icon={FileText}
          color="blue"
        />
        <StatCard
          label="Completados"
          value={data?.stats.completedJobs || 0}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          label="Pagos pendientes"
          value={data?.stats.pendingPayments || 0}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          label="Monto pendiente"
          value={formatCurrency(data?.stats.pendingPaymentsAmount || 0)}
          icon={CreditCard}
          color="red"
          isAmount
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickActionCard
          href="/book"
          label="Reservar servicio"
          icon={Calendar}
          color="primary"
        />
        <QuickActionCard
          href="/track"
          label="Seguir técnico"
          icon={MapPin}
          color="green"
        />
        <QuickActionCard
          href="/invoices"
          label="Ver facturas"
          icon={FileText}
          color="blue"
        />
        <QuickActionCard
          href="/support"
          label="Soporte"
          icon={AlertCircle}
          color="orange"
        />
      </div>

      {/* Pending ratings */}
      {data?.unratedJobs && data.unratedJobs.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Star className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-yellow-800 mb-1">
                Calificá tu experiencia
              </h3>
              <p className="text-sm text-yellow-700 mb-3">
                Tenés {data.unratedJobs.length} trabajo(s) sin calificar
              </p>
              <div className="flex flex-wrap gap-2">
                {data.unratedJobs.slice(0, 3).map((job: any) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}/feedback`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 rounded-full text-sm text-yellow-800 transition-colors"
                  >
                    <Star className="w-3.5 h-3.5" />
                    {job.serviceType}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming jobs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Próximos trabajos</h2>
            <Link
              href="/jobs"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data?.upcomingJobs && data.upcomingJobs.length > 0 ? (
              data.upcomingJobs.map((job: any) => (
                <JobListItem key={job.id} job={job} />
              ))
            ) : (
              <EmptyState
                icon={Calendar}
                message="No tenés trabajos programados"
                action={{ label: 'Reservar servicio', href: '/book' }}
              />
            )}
          </div>
        </div>

        {/* Pending invoices */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Facturas pendientes</h2>
            <Link
              href="/invoices"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              Ver todas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data?.pendingInvoices && data.pendingInvoices.length > 0 ? (
              data.pendingInvoices.map((invoice: any) => (
                <InvoiceListItem key={invoice.id} invoice={invoice} />
              ))
            ) : (
              <EmptyState
                icon={CheckCircle}
                message="No tenés facturas pendientes"
              />
            )}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Actividad reciente</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {data?.recentJobs && data.recentJobs.length > 0 ? (
            data.recentJobs.map((job: any) => (
              <JobListItem key={job.id} job={job} showStatus />
            ))
          ) : (
            <EmptyState
              icon={FileText}
              message="No hay actividad reciente"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Stat card component
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  isAmount,
}: {
  label: string;
  value: number | string;
  icon: any;
  color: 'blue' | 'green' | 'yellow' | 'red';
  isAmount?: boolean;
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className={`text-2xl font-bold text-gray-900 ${isAmount ? 'text-lg' : ''}`}>
        {value}
      </p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

// Quick action card
function QuickActionCard({
  href,
  label,
  icon: Icon,
  color,
}: {
  href: string;
  label: string;
  icon: any;
  color: 'primary' | 'green' | 'blue' | 'orange';
}) {
  const colors = {
    primary: 'bg-primary-50 text-primary-600 hover:bg-primary-100',
    green: 'bg-green-50 text-green-600 hover:bg-green-100',
    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    orange: 'bg-orange-50 text-orange-600 hover:bg-orange-100',
  };

  return (
    <Link
      href={href}
      className={`${colors[color]} rounded-xl p-4 flex flex-col items-center text-center transition-colors`}
    >
      <Icon className="w-6 h-6 mb-2" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

// Job list item
function JobListItem({ job, showStatus }: { job: any; showStatus?: boolean }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
    >
      <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <FileText className="w-6 h-6 text-primary-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{job.serviceType}</p>
        <p className="text-sm text-gray-500">
          {job.scheduledDate ? formatDate(job.scheduledDate) : 'Sin fecha'}
        </p>
      </div>
      {showStatus && (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
          {getStatusLabel(job.status)}
        </span>
      )}
      <ArrowRight className="w-4 h-4 text-gray-400" />
    </Link>
  );
}

// Invoice list item
function InvoiceListItem({ invoice }: { invoice: any }) {
  return (
    <Link
      href={`/invoices/${invoice.id}`}
      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
    >
      <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <CreditCard className="w-6 h-6 text-red-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">Factura #{invoice.invoiceNumber}</p>
        <p className="text-sm text-gray-500">
          Vence {formatRelativeTime(invoice.dueDate)}
        </p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-gray-900">{formatCurrency(invoice.total)}</p>
        <p className="text-xs text-red-600">Pendiente</p>
      </div>
    </Link>
  );
}

// Empty state
function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: any;
  message: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="p-8 text-center">
      <Icon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 mb-3">{message}</p>
      {action && (
        <Link href={action.href} className="text-sm text-primary-600 hover:text-primary-700">
          {action.label}
        </Link>
      )}
    </div>
  );
}
