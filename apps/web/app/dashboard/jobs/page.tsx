'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { cn, formatDate, formatAddress, JOB_STATUS_LABELS, JOB_STATUS_COLORS, searchMatchesAny, getInitials } from '@/lib/utils';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  List,
  MoreHorizontal,
  User,
  MapPin,
  Clock,
  Eye,
  Edit2,
  Copy,
  FileText,
  XCircle,
  ChevronDown,
  X,
  Briefcase,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { Job } from '@/types';
import JobDetailModal from './JobDetailModal';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

interface JobStats {
  totalCount: number;
  inProgressCount: number;
  scheduledTodayCount: number;
  completedThisMonthCount: number;
}

interface TechnicianOption {
  id: string;
  name: string;
  isActive: boolean;
  jobCount?: number;
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700 border-gray-200',
  ASSIGNED: 'bg-purple-100 text-purple-700 border-purple-200',
  EN_ROUTE: 'bg-blue-100 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-orange-100 text-orange-700 border-orange-200',
  COMPLETED: 'bg-green-100 text-green-700 border-green-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  INSTALACION_SPLIT: 'Instalación Split',
  REPARACION_SPLIT: 'Reparación Split',
  MANTENIMIENTO_SPLIT: 'Mantenimiento Split',
  INSTALACION_CALEFACTOR: 'Instalación Calefactor',
  REPARACION_CALEFACTOR: 'Reparación Calefactor',
  MANTENIMIENTO_CALEFACTOR: 'Mantenimiento Calefactor',
  OTRO: 'Otro',
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function JobsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [technicianFilter, setTechnicianFilter] = useState<string>('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [assignModalJob, setAssignModalJob] = useState<Job | null>(null);
  const [cancelConfirmJob, setCancelConfirmJob] = useState<Job | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Fetch jobs
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', { status: statusFilter }],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      return api.jobs.list(params);
    },
  });

  // Fetch stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['jobs-stats'],
    queryFn: async () => {
      const res = await fetch('/api/jobs/stats');
      if (!res.ok) throw new Error('Error fetching stats');
      return res.json();
    },
  });

  // Fetch technicians for filter and assignment
  const { data: techniciansData } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const res = await fetch('/api/users?role=TECHNICIAN');
      if (!res.ok) throw new Error('Error fetching technicians');
      return res.json();
    },
  });

  const allJobs = jobsData?.data as Job[] | undefined;
  const stats: JobStats = statsData?.data || {
    totalCount: 0,
    inProgressCount: 0,
    scheduledTodayCount: 0,
    completedThisMonthCount: 0,
  };
  const technicians: TechnicianOption[] = techniciansData?.data || [];

  // Client-side filtering
  const jobs = useMemo(() => {
    return allJobs?.filter((job) => {
      // Search filter
      if (search) {
        const searchFields = [
          job.jobNumber,
          job.serviceType,
          job.description,
          job.customer?.name,
          job.customer?.phone,
          job.address,
          ...(job.assignments?.map((a) => a.technician?.name) || []),
        ];
        if (!searchMatchesAny(searchFields, search)) return false;
      }

      // Priority filter
      if (priorityFilter && job.priority !== priorityFilter) return false;

      // Technician filter
      if (technicianFilter) {
        const hasAssignment = job.assignments?.some(
          (a) => a.technician?.id === technicianFilter
        );
        if (!hasAssignment && job.assignedTo?.id !== technicianFilter) return false;
      }

      return true;
    });
  }, [allJobs, search, priorityFilter, technicianFilter]);

  const hasActiveFilters = search || statusFilter || priorityFilter || technicianFilter;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setTechnicianFilter('');
  };

  // Duplicate job mutation
  const duplicateJobMutation = useMutation({
    mutationFn: async (job: Job) => {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: job.serviceType,
          description: job.description,
          customerId: job.customerId,
          urgency: 'NORMAL',
          // Don't copy: date, time, technician, status
        }),
      });
      if (!res.ok) throw new Error('Error duplicating job');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs-stats'] });
      // Navigate to edit the new job
      router.push(`/dashboard/jobs/${data.data.id}?edit=true`);
    },
  });

  // Cancel job mutation
  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (!res.ok) throw new Error('Error cancelling job');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs-stats'] });
      setCancelConfirmJob(null);
    },
  });

  // Close menu when clicking outside
  const handleMenuClick = (jobId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenuId(openMenuId === jobId ? null : jobId);
  };

  const handleAction = (action: string, job: Job, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenuId(null);

    switch (action) {
      case 'view':
        router.push(`/dashboard/jobs/${job.id}`);
        break;
      case 'edit':
        router.push(`/dashboard/jobs/${job.id}?edit=true`);
        break;
      case 'duplicate':
        duplicateJobMutation.mutate(job);
        break;
      case 'invoice':
        router.push(`/dashboard/invoices/new?jobId=${job.id}`);
        break;
      case 'cancel':
        setCancelConfirmJob(job);
        break;
    }
  };

  const handleAssignClick = (job: Job, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAssignModalJob(job);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trabajos</h1>
          <p className="text-gray-500">Gestiona los trabajos de tu equipo</p>
        </div>
        <Link href="/dashboard/jobs/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo trabajo
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Trabajos"
          value={stats.totalCount}
          icon={<Briefcase className="h-5 w-5 text-gray-400" />}
          loading={statsLoading}
        />
        <StatCard
          title="En Progreso"
          value={stats.inProgressCount}
          icon={<TrendingUp className="h-5 w-5 text-orange-500" />}
          color="orange"
          loading={statsLoading}
        />
        <StatCard
          title="Programados Hoy"
          value={stats.scheduledTodayCount}
          icon={<Calendar className="h-5 w-5 text-teal-500" />}
          color="teal"
          loading={statsLoading}
        />
        <StatCard
          title="Completados Este Mes"
          value={stats.completedThisMonthCount}
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          color="green"
          loading={statsLoading}
        />
      </div>

      {/* Filter Bar */}
      <div className="card p-4">
        <div className="flex flex-col gap-4">
          {/* Main row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, técnico, descripción, dirección..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>

            {/* Status dropdown (inline) */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-auto min-w-[180px]"
            >
              <option value="">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="ASSIGNED">Asignado</option>
              <option value="EN_ROUTE">En camino</option>
              <option value="IN_PROGRESS">En trabajo</option>
              <option value="COMPLETED">Completado</option>
              <option value="CANCELLED">Cancelado</option>
            </select>

            {/* More filters button */}
            <button
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              className={cn(
                'btn-outline whitespace-nowrap',
                showMoreFilters && 'border-primary-500 text-primary-600'
              )}
            >
              <Filter className="mr-2 h-4 w-4" />
              Más Filtros
              {(priorityFilter || technicianFilter) && (
                <span className="ml-2 rounded-full bg-primary-500 px-2 py-0.5 text-xs text-white">
                  {[priorityFilter, technicianFilter].filter(Boolean).length}
                </span>
              )}
            </button>

            {/* View toggle */}
            <div className="flex rounded-lg border bg-gray-50">
              <button
                className="flex items-center gap-2 rounded-l-lg px-4 py-2 text-sm font-medium bg-white text-primary-600 shadow-sm"
              >
                <List className="h-4 w-4" />
                Lista
              </button>
              <Link
                href="/dashboard/calendar"
                className="flex items-center gap-2 rounded-r-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                <Calendar className="h-4 w-4" />
                Calendario
              </Link>
            </div>
          </div>

          {/* Expanded filters */}
          {showMoreFilters && (
            <div className="flex flex-wrap items-center gap-4 border-t pt-4">
              {/* Priority filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Prioridad:</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="input w-auto py-1.5 text-sm"
                >
                  <option value="">Todas</option>
                  <option value="low">Baja</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>

              {/* Technician filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Técnico:</label>
                <select
                  value={technicianFilter}
                  onChange={(e) => setTechnicianFilter(e.target.value)}
                  className="input w-auto py-1.5 text-sm"
                >
                  <option value="">Todos</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Jobs list */}
      <div className="space-y-3">
        {jobsLoading ? (
          // Loading skeleton
          [...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="h-16 w-24 rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 bg-gray-200 rounded" />
                  <div className="h-3 w-1/2 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          ))
        ) : jobs?.length ? (
          jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              openMenuId={openMenuId}
              onMenuClick={handleMenuClick}
              onAction={handleAction}
              onAssignClick={handleAssignClick}
              onCardClick={(job) => setSelectedJobId(job.id)}
            />
          ))
        ) : (
          <div className="card p-12 text-center">
            <Briefcase className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">No se encontraron trabajos</p>
            {hasActiveFilters ? (
              <button onClick={clearFilters} className="btn-outline mt-4">
                Limpiar filtros
              </button>
            ) : (
              <Link href="/dashboard/jobs/new" className="btn-primary mt-4 inline-flex">
                <Plus className="mr-2 h-4 w-4" />
                Crear trabajo
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Technician Assignment Modal */}
      {assignModalJob && (
        <AssignTechnicianModal
          job={assignModalJob}
          technicians={technicians}
          onClose={() => setAssignModalJob(null)}
          onSuccess={() => {
            setAssignModalJob(null);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
          }}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {cancelConfirmJob && (
        <CancelConfirmModal
          job={cancelConfirmJob}
          isLoading={cancelJobMutation.isPending}
          onConfirm={() => cancelJobMutation.mutate(cancelConfirmJob.id)}
          onClose={() => setCancelConfirmJob(null)}
        />
      )}

      {/* Job Detail Modal */}
      <JobDetailModal
        jobId={selectedJobId}
        onClose={() => setSelectedJobId(null)}
        onEdit={(jobId) => {
          setSelectedJobId(null);
          router.push(`/dashboard/jobs/${jobId}?edit=true`);
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface StatCardProps {
  title: string;
  value: number;
  icon?: React.ReactNode;
  color?: 'default' | 'orange' | 'teal' | 'green';
  loading?: boolean;
}

function StatCard({ title, value, icon, color = 'default', loading }: StatCardProps) {
  const valueColors = {
    default: 'text-gray-900',
    orange: 'text-orange-600',
    teal: 'text-teal-600',
    green: 'text-green-600',
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {icon}
      </div>
      {loading ? (
        <div className="h-8 w-16 animate-pulse rounded bg-gray-200 mt-2" />
      ) : (
        <p className={cn('text-2xl font-bold mt-2', valueColors[color])}>
          {value}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface JobCardProps {
  job: Job;
  openMenuId: string | null;
  onMenuClick: (jobId: string, e: React.MouseEvent) => void;
  onAction: (action: string, job: Job, e: React.MouseEvent) => void;
  onAssignClick: (job: Job, e: React.MouseEvent) => void;
  onCardClick: (job: Job) => void;
}

function JobCard({ job, openMenuId, onMenuClick, onAction, onAssignClick, onCardClick }: JobCardProps) {
  const hasAssignment = job.assignments && job.assignments.length > 0;
  const isCompleted = job.status === 'COMPLETED' || job.status === 'CANCELLED';
  const canCancel = !isCompleted;
  const canAssign = !isCompleted;
  const isUrgent = job.priority === 'urgent' || job.priority === 'high';

  // Parse time slot from JSON or use direct fields
  let timeSlot = '';
  if (job.scheduledTimeStart && job.scheduledTimeEnd) {
    timeSlot = `${job.scheduledTimeStart} - ${job.scheduledTimeEnd}`;
  } else if (job.scheduledTimeStart) {
    timeSlot = job.scheduledTimeStart;
  } else if ('scheduledTimeSlot' in job && job.scheduledTimeSlot) {
    try {
      const slotData = job.scheduledTimeSlot;
      const slot = typeof slotData === 'string' ? JSON.parse(slotData) : slotData;
      if (slot?.start && slot?.end) {
        timeSlot = `${slot.start} - ${slot.end}`;
      } else if (slot?.start) {
        timeSlot = slot.start;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Format service type as title
  const serviceTypeLabel = SERVICE_TYPE_LABELS[job.serviceType] || job.serviceType?.replace(/_/g, ' ') || '';

  // Format price - show demo price if not available (for display purposes)
  const estimatedPrice = 'estimatedPrice' in job ? (job as { estimatedPrice?: number }).estimatedPrice : null;
  const totalPrice = 'total' in job ? (job as { total?: number }).total : null;
  const priceValue = estimatedPrice || totalPrice;
  const formattedPrice = priceValue
    ? `$${Number(priceValue).toLocaleString('es-AR')}`
    : null;

  // Get address - prefer job address, fallback to customer address
  const displayAddress = formatAddress(job.address) || formatAddress(job.customer?.address) || '';

  return (
    <div
      onClick={() => onCardClick(job)}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all duration-200 block cursor-pointer"
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Section 1: Job Info - flex-1 */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Job ID + Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500 font-mono">{job.jobNumber}</span>
            <span className={cn(
              'px-2.5 py-0.5 text-xs font-medium rounded-full',
              STATUS_BADGE_COLORS[job.status]
            )}>
              {JOB_STATUS_LABELS[job.status]}
            </span>
            {isUrgent && (
              <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-red-500 text-white">
                {PRIORITY_LABELS[job.priority]}
              </span>
            )}
          </div>
          {/* Title + Description */}
          <div>
            <h3 className="font-semibold text-gray-900">
              {serviceTypeLabel || job.description || 'Trabajo sin descripción'}
            </h3>
            {job.description && serviceTypeLabel && (
              <p className="text-sm text-gray-500 truncate">{job.description}</p>
            )}
          </div>
        </div>

        {/* Section 2: Customer & Location - lg:w-48 */}
        <div className="lg:w-48 space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="text-gray-700 truncate">{job.customer?.name || 'Sin cliente'}</span>
          </div>
          {displayAddress && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="text-gray-500 truncate">{displayAddress}</span>
            </div>
          )}
        </div>

        {/* Section 3: Schedule - lg:w-40 */}
        <div className="lg:w-40 space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-gray-700">{job.scheduledDate ? formatDate(job.scheduledDate) : 'Sin fecha'}</span>
          </div>
          {timeSlot && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">{timeSlot}</span>
            </div>
          )}
        </div>

        {/* Section 4: Technician - lg:w-36 */}
        <div className="lg:w-36">
          {hasAssignment ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
                <User className="h-4 w-4 text-teal-600" />
              </div>
              <span className="text-sm text-gray-700 truncate">
                {job.assignments![0].technician?.name}
                {job.assignments!.length > 1 && (
                  <span className="text-gray-400">...</span>
                )}
              </span>
            </div>
          ) : canAssign ? (
            <button
              onClick={(e) => onAssignClick(job, e)}
              className="px-4 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Asignar
            </button>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>

        {/* Section 5: Price + Actions */}
        <div className="flex items-center gap-3">
          {/* Price */}
          {formattedPrice ? (
            <span className="font-semibold text-gray-900 text-base min-w-[80px] text-right">
              {formattedPrice}
            </span>
          ) : (
            <span className="text-gray-400 min-w-[80px] text-right">-</span>
          )}

          {/* 3-dot menu */}
          <div className="relative">
            <button
              onClick={(e) => onMenuClick(job.id, e)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <MoreHorizontal className="h-5 w-5 text-gray-400" />
            </button>

            {openMenuId === job.id && (
              <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-20">
                <button
                  onClick={(e) => onAction('view', job, e)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Ver Detalles
                </button>
                <button
                  onClick={(e) => onAction('edit', job, e)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Editar
                </button>
                <button
                  onClick={(e) => onAction('duplicate', job, e)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Duplicar
                </button>
                <button
                  onClick={(e) => onAction('invoice', job, e)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Generar Factura
                </button>
                {canCancel && (
                  <>
                    <div className="border-t my-1" />
                    <button
                      onClick={(e) => onAction('cancel', job, e)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGN TECHNICIAN MODAL
// ═══════════════════════════════════════════════════════════════════════════════

interface AssignTechnicianModalProps {
  job: Job;
  technicians: TechnicianOption[];
  onClose: () => void;
  onSuccess: () => void;
}

function AssignTechnicianModal({ job, technicians, onClose, onSuccess }: AssignTechnicianModalProps) {
  const [isAssigning, setIsAssigning] = useState<string | null>(null);

  const handleAssign = async (technicianId: string) => {
    setIsAssigning(technicianId);
    try {
      const res = await fetch(`/api/jobs/${job.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: technicianId }),
      });
      if (!res.ok) throw new Error('Error assigning technician');
      onSuccess();
    } catch (error) {
      console.error('Assignment error:', error);
    } finally {
      setIsAssigning(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Asignar Técnico</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Job summary */}
        <div className="p-4 bg-gray-50 border-b">
          <p className="text-sm text-gray-500">{job.jobNumber}</p>
          <p className="font-medium">{SERVICE_TYPE_LABELS[job.serviceType] || job.serviceType}</p>
          <p className="text-sm text-gray-600">
            {job.customer?.name} • {job.scheduledDate ? formatDate(job.scheduledDate) : 'Sin fecha'}
          </p>
        </div>

        {/* Technicians list */}
        <div className="max-h-80 overflow-y-auto p-2">
          {technicians.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No hay técnicos disponibles</p>
          ) : (
            <div className="space-y-2">
              {technicians.map((tech) => (
                <div
                  key={tech.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-medium">
                      {getInitials(tech.name)}
                    </div>
                    <div>
                      <p className="font-medium">{tech.name}</p>
                      <p className="text-sm text-gray-500">
                        {tech.isActive ? 'Disponible' : 'No disponible'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAssign(tech.id)}
                    disabled={isAssigning === tech.id}
                    className="btn-primary text-sm py-1.5 px-3"
                  >
                    {isAssigning === tech.id ? 'Asignando...' : 'Asignar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-4">
          <button onClick={onClose} className="btn-outline w-full">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANCEL CONFIRMATION MODAL
// ═══════════════════════════════════════════════════════════════════════════════

interface CancelConfirmModalProps {
  job: Job;
  isLoading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function CancelConfirmModal({ job, isLoading, onConfirm, onClose }: CancelConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6">
        <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-red-100 mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-center">¿Cancelar trabajo?</h3>
        <p className="text-gray-500 text-center mt-2">
          Esta acción cancelará el trabajo <strong>{job.jobNumber}</strong>. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1" disabled={isLoading}>
            No, volver
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Cancelando...' : 'Sí, cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}
