'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { cn, formatDate, formatAddress, JOB_STATUS_LABELS, searchMatchesAny, getInitials } from '@/lib/utils';
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
  X,
  Briefcase,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Repeat,
  CalendarDays,
  Lock,
} from 'lucide-react';
import { Job } from '@/types';
import NewJobModal from '@/components/jobs/NewJobModal';
import EditJobModal from '@/components/jobs/EditJobModal';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES & CONSTANTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// Represents either a single-visit job or one "Visita" config from a multi-visit job
interface JobOrVisitRow {
  job: Job;
  visitConfig?: {
    configIndex: number; // The original "Visita" config number (1, 2, 3...)
    visits: Array<{
      id: string;
      visitNumber: number;
      scheduledDate: string;
      scheduledTimeSlot?: { start?: string; end?: string } | null;
      status: string;
      technician?: { id: string; name: string } | null;
    }>;
    // Summary info for this config
    firstDate: string;
    lastDate: string;
    totalDates: number;
    technician?: { id: string; name: string } | null;
    timeSlot?: { start?: string; end?: string } | null;
  };
  isVisitRow: boolean;
  totalConfigs: number; // How many "Visita" configs the job has
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export default function JobsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // State
  const [activeTab, setActiveTab] = useState<'todos' | 'activos' | 'cancelados'>('activos'); // Job folder tabs
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [technicianFilter, setTechnicianFilter] = useState<string>('');
  const [durationTypeFilter, setDurationTypeFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest'); // Default: newest first by creation date
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [assignModalJob, setAssignModalJob] = useState<Job | null>(null);
  const [cancelConfirmJob, setCancelConfirmJob] = useState<Job | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is outside the menu (not on menu button or menu items)
      if (!target.closest('[data-menu-container]')) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  // Fetch jobs
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', { status: statusFilter, durationType: durationTypeFilter }],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (durationTypeFilter) params.durationType = durationTypeFilter;
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

  // Fetch pending variance count for header badge
  const { data: pendingVarianceData } = useQuery({
    queryKey: ['jobs-pending-variance-count'],
    queryFn: async () => {
      const res = await fetch('/api/jobs?hasPendingVariance=true&limit=1');
      if (!res.ok) return { meta: { total: 0 } };
      return res.json();
    },
    staleTime: 1000 * 60, // Cache for 1 minute
  });

  const pendingVarianceCount = pendingVarianceData?.meta?.total || 0;

  const allJobs = jobsData?.data as Job[] | undefined;
  const stats: JobStats = statsData?.data || {
    totalCount: 0,
    inProgressCount: 0,
    scheduledTodayCount: 0,
    completedThisMonthCount: 0,
  };
  const technicians: TechnicianOption[] = techniciansData?.data || [];

  // Client-side filtering and grouping visits by their original "Visita" config
  const jobRows = useMemo((): JobOrVisitRow[] => {
    if (!allJobs) return [];

    const rows: JobOrVisitRow[] = [];

    for (const job of allJobs) {
      // Tab filter: Todos shows all, Activos excludes cancelled, Cancelados shows only cancelled
      if (activeTab === 'activos' && job.status === 'CANCELLED') continue;
      if (activeTab === 'cancelados' && job.status !== 'CANCELLED') continue;
      // 'todos' shows all jobs (no filter)

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
        if (!searchMatchesAny(searchFields, search)) continue;
      }

      // Priority filter
      if (priorityFilter && job.priority !== priorityFilter) continue;

      // Check if job has visits
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jobAny = job as any;
      const visits = jobAny.visits as Array<{
        id: string;
        visitNumber: number;
        visitConfigIndex?: number;
        scheduledDate: string;
        scheduledTimeSlot?: { start?: string; end?: string } | null;
        status: string;
        technicianId?: string;
        technician?: { id: string; name: string } | null;
      }> | undefined;

      if (visits && visits.length > 0) {
        // Group visits by visitConfigIndex (each "Visita" config from the form)
        const configGroups = new Map<number, typeof visits>();

        for (const visit of visits) {
          // Default to 1 if visitConfigIndex not set (legacy data)
          const configIndex = visit.visitConfigIndex || 1;
          if (!configGroups.has(configIndex)) {
            configGroups.set(configIndex, []);
          }
          configGroups.get(configIndex)!.push(visit);
        }

        // Create one row per config group
        const totalConfigs = configGroups.size;

        for (const [configIndex, configVisits] of configGroups) {
          // Sort visits by date within this config
          configVisits.sort((a, b) =>
            new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
          );

          const firstVisit = configVisits[0];
          const lastVisit = configVisits[configVisits.length - 1];

          // Technician filter - check if any visit in this config matches
          if (technicianFilter) {
            const hasMatchingTech = configVisits.some(v => {
              const visitTechId = v.technician?.id || v.technicianId;
              return visitTechId === technicianFilter;
            });
            if (!hasMatchingTech) continue;
          }

          rows.push({
            job,
            visitConfig: {
              configIndex,
              visits: configVisits.map(v => ({
                id: v.id,
                visitNumber: v.visitNumber,
                scheduledDate: v.scheduledDate,
                scheduledTimeSlot: v.scheduledTimeSlot,
                status: v.status,
                technician: v.technician,
              })),
              firstDate: firstVisit.scheduledDate,
              lastDate: lastVisit.scheduledDate,
              totalDates: configVisits.length,
              technician: firstVisit.technician,
              timeSlot: firstVisit.scheduledTimeSlot,
            },
            isVisitRow: true,
            totalConfigs,
          });
        }
      } else {
        // Single-visit job - show as regular row
        // Technician filter for non-visit jobs
        if (technicianFilter) {
          const hasAssignment = job.assignments?.some(
            (a) => a.technician?.id === technicianFilter
          );
          if (!hasAssignment && job.assignedTo?.id !== technicianFilter) continue;
        }

        rows.push({
          job,
          isVisitRow: false,
          totalConfigs: 1,
        });
      }
    }

    // Sort based on selected option
    rows.sort((a, b) => {
      const dateA = a.visitConfig?.firstDate || a.job.scheduledDate || '';
      const dateB = b.visitConfig?.firstDate || b.job.scheduledDate || '';
      const createdA = a.job.createdAt || '';
      const createdB = b.job.createdAt || '';

      switch (sortBy) {
        case 'newest':
          // Newest created first
          return new Date(createdB).getTime() - new Date(createdA).getTime();
        case 'oldest':
          // Oldest created first
          return new Date(createdA).getTime() - new Date(createdB).getTime();
        case 'scheduled_asc':
          // Soonest scheduled first
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        case 'scheduled_desc':
          // Latest scheduled first
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        default:
          return new Date(createdB).getTime() - new Date(createdA).getTime();
      }
    });

    return rows;
  }, [allJobs, search, priorityFilter, technicianFilter, sortBy, activeTab]);

  const hasActiveFilters = search || statusFilter || priorityFilter || technicianFilter || durationTypeFilter;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setTechnicianFilter('');
    setDurationTypeFilter('');
    setSortBy('newest');
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

  // Prefetch default vehicles for technicians when hovering over a job card
  // This ensures the data is cached before the Edit modal opens
  const handleJobHover = useCallback((job: Job) => {
    // Get all technician IDs from job assignments
    const technicianIds = job.assignments?.map((a: { technicianId: string }) => a.technicianId) || [];
    if (technicianIds.length === 0) return;

    // Prefetch default vehicle for each technician (in parallel, silent)
    for (const techId of technicianIds) {
      // Use a date for the query - we just need the permanent assignment
      const today = new Date().toISOString().split('T')[0];
      const queryKey = ['default-vehicle', techId, today];

      // Only prefetch if not already cached
      const cached = queryClient.getQueryData(queryKey);
      if (!cached) {
        queryClient.prefetchQuery({
          queryKey,
          queryFn: async () => {
            const response = await fetch(
              `/api/scheduling/vehicle-for-job?technicianId=${techId}&date=${today}`
            );
            if (!response.ok) return null;
            return response.json();
          },
          staleTime: 1000 * 60 * 5, // Cache for 5 minutes
        });
      }
    }
  }, [queryClient]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trabajos</h1>
          <p className="text-gray-500">Gestiona los trabajos de tu equipo</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/jobs/pending-variance"
            className="btn-outline flex items-center gap-2 text-amber-600 border-amber-300 hover:bg-amber-50 relative"
          >
            <AlertTriangle className="h-4 w-4" />
            Variaciones de Precio
            {pendingVarianceCount > 0 && (
              <span className="absolute -top-2 -right-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-amber-500 rounded-full">
                {pendingVarianceCount > 9 ? '9+' : pendingVarianceCount}
              </span>
            )}
          </Link>
          <button onClick={() => setIsNewJobModalOpen(true)} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo trabajo
          </button>
        </div>
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

      {/* Tabs + Filters Row */}
      <div className="flex flex-col gap-4">
        {/* Main row: Tabs + Filters */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('todos')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                activeTab === 'todos'
                  ? 'bg-gray-100 text-gray-900 border border-gray-300'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <List className="h-4 w-4" />
              Todos
              {allJobs && (
                <span className={cn(
                  'px-2 py-0.5 text-xs rounded-full',
                  activeTab === 'todos' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600'
                )}>
                  {allJobs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('activos')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                activeTab === 'activos'
                  ? 'bg-primary-50 text-primary-600 border border-primary-200'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <Briefcase className="h-4 w-4" />
              Activos
              {allJobs && (
                <span className={cn(
                  'px-2 py-0.5 text-xs rounded-full',
                  activeTab === 'activos' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                )}>
                  {allJobs.filter(j => j.status !== 'CANCELLED').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('cancelados')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                activeTab === 'cancelados'
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <XCircle className="h-4 w-4" />
              Cancelados
              {allJobs && (
                <span className={cn(
                  'px-2 py-0.5 text-xs rounded-full',
                  activeTab === 'cancelados' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                )}>
                  {allJobs.filter(j => j.status === 'CANCELLED').length}
                </span>
              )}
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-auto text-sm py-2"
            >
              <option value="">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="ASSIGNED">Asignado</option>
              <option value="EN_ROUTE">En camino</option>
              <option value="IN_PROGRESS">En trabajo</option>
              <option value="COMPLETED">Completado</option>
            </select>

            {/* More filters button */}
            <button
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              className={cn(
                'btn-outline whitespace-nowrap text-sm py-2',
                showMoreFilters && 'border-primary-500 text-primary-600'
              )}
            >
              <Filter className="mr-2 h-4 w-4" />
              Más Filtros
              {(priorityFilter || technicianFilter || durationTypeFilter || sortBy !== 'newest') && (
                <span className="ml-2 rounded-full bg-primary-500 px-2 py-0.5 text-xs text-white">
                  {[priorityFilter, technicianFilter, durationTypeFilter, sortBy !== 'newest' ? 'sort' : ''].filter(Boolean).length}
                </span>
              )}
            </button>

            {/* View toggle */}
            <div className="flex rounded-lg border bg-gray-50">
              <button
                className="flex items-center gap-2 rounded-l-lg px-3 py-2 text-sm font-medium bg-white text-primary-600 shadow-sm"
              >
                <List className="h-4 w-4" />
                Lista
              </button>
              <Link
                href="/dashboard/calendar"
                className="flex items-center gap-2 rounded-r-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                <Calendar className="h-4 w-4" />
                Calendario
              </Link>
            </div>
          </div>
        </div>

        {/* Expanded filters row */}
        {showMoreFilters && (
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
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

            {/* Duration type filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Tipo:</label>
              <select
                value={durationTypeFilter}
                onChange={(e) => setDurationTypeFilter(e.target.value)}
                className="input w-auto py-1.5 text-sm"
              >
                <option value="">Todos</option>
                <option value="SINGLE_VISIT">Visita única</option>
                <option value="MULTIPLE_VISITS">Múltiples visitas</option>
                <option value="RECURRING">Recurrente</option>
              </select>
            </div>

            {/* Sort dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Ordenar:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input w-auto py-1.5 text-sm"
              >
                <option value="newest">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="scheduled_asc">Fecha próxima</option>
                <option value="scheduled_desc">Fecha lejana</option>
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

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, técnico, descripción, dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
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
        ) : jobRows.length ? (
          jobRows.map((row) => (
            <JobCard
              key={row.visitConfig ? `config-${row.job.id}-${row.visitConfig.configIndex}` : row.job.id}
              job={row.job}
              visitConfig={row.visitConfig}
              isVisitRow={row.isVisitRow}
              totalConfigs={row.totalConfigs}
              openMenuId={openMenuId}
              onMenuClick={handleMenuClick}
              onAction={handleAction}
              onAssignClick={handleAssignClick}
              onCardClick={(job) => setSelectedJobId(job.id)}
              onHover={handleJobHover}
            />
          ))
        ) : (
          <div className="card p-12 text-center">
            {activeTab === 'cancelados' ? (
              <>
                <XCircle className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-gray-500">No hay trabajos cancelados</p>
                <button
                  onClick={() => setActiveTab('activos')}
                  className="btn-outline mt-4"
                >
                  Ver trabajos activos
                </button>
              </>
            ) : (
              <>
                <Briefcase className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-gray-500">No se encontraron trabajos</p>
                {hasActiveFilters ? (
                  <button onClick={clearFilters} className="btn-outline mt-4">
                    Limpiar filtros
                  </button>
                ) : (
                  <button onClick={() => setIsNewJobModalOpen(true)} className="btn-primary mt-4 inline-flex">
                    <Plus className="mr-2 h-4 w-4" />
                    Crear trabajo
                  </button>
                )}
              </>
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

      {/* Job Edit Modal - replaces the old detail modal */}
      {selectedJobId && (
        <EditJobModal
          isOpen={!!selectedJobId}
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['jobs-stats'] });
            setSelectedJobId(null);
          }}
        />
      )}

      {/* New Job Modal */}
      <NewJobModal
        isOpen={isNewJobModalOpen}
        onClose={() => setIsNewJobModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
          queryClient.invalidateQueries({ queryKey: ['jobs-stats'] });
        }}
      />
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STAT CARD COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// JOB CARD COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface JobCardProps {
  job: Job;
  visitConfig?: {
    configIndex: number;
    visits: Array<{
      id: string;
      visitNumber: number;
      scheduledDate: string;
      scheduledTimeSlot?: { start?: string; end?: string } | null;
      status: string;
      technician?: { id: string; name: string } | null;
    }>;
    firstDate: string;
    lastDate: string;
    totalDates: number;
    technician?: { id: string; name: string } | null;
    timeSlot?: { start?: string; end?: string } | null;
  };
  isVisitRow: boolean;
  totalConfigs: number;
  openMenuId: string | null;
  onMenuClick: (jobId: string, e: React.MouseEvent) => void;
  onAction: (action: string, job: Job, e: React.MouseEvent) => void;
  onAssignClick: (job: Job, e: React.MouseEvent) => void;
  onCardClick: (job: Job) => void;
  onHover?: (job: Job) => void;
}

function JobCard({ job, visitConfig, isVisitRow, totalConfigs, openMenuId, onMenuClick, onAction, onAssignClick, onCardClick, onHover }: JobCardProps) {
  // For visit config rows, calculate aggregate status
  const pendingCount = visitConfig?.visits.filter(v => v.status === 'PENDING').length || 0;
  const completedCount = visitConfig?.visits.filter(v => v.status === 'COMPLETED').length || 0;
  const totalVisitDates = visitConfig?.totalDates || 1;

  // Display status: show job status for single jobs, or summary for visit configs
  const displayStatus = visitConfig
    ? (completedCount === totalVisitDates ? 'COMPLETED' : (pendingCount === totalVisitDates ? 'PENDING' : 'IN_PROGRESS'))
    : job.status;

  const _hasAssignment = visitConfig?.technician || (job.assignments && job.assignments.length > 0);
  const isCompleted = displayStatus === 'COMPLETED' || displayStatus === 'CANCELLED';
  const canCancel = !isCompleted;
  const canAssign = !isCompleted;
  const isUrgent = job.priority === 'urgent' || job.priority === 'high';

  // Multi-visit job info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobAny = job as any;
  const durationType = jobAny.durationType || 'SINGLE_VISIT';
  const isRecurring = durationType === 'RECURRING';

  // Parse time slot - prefer visit config time slot if available
  let timeSlot = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeSlotSource = visitConfig?.timeSlot || (job as any).scheduledTimeSlot;
  if (job.scheduledTimeStart && job.scheduledTimeEnd && !visitConfig) {
    timeSlot = `${job.scheduledTimeStart} - ${job.scheduledTimeEnd}`;
  } else if (job.scheduledTimeStart && !visitConfig) {
    timeSlot = job.scheduledTimeStart;
  } else if (timeSlotSource) {
    try {
      const slot = typeof timeSlotSource === 'string' ? JSON.parse(timeSlotSource) : timeSlotSource;
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
      onMouseEnter={() => onHover?.(job)}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all duration-200 block cursor-pointer"
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Section 1: Job Info - flex-1 */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Job ID + Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500 font-mono">
              {job.jobNumber?.replace('JOB-', 'Trabajo-')}
              {isVisitRow && visitConfig && totalConfigs > 1 && (
                <span className="text-primary-600 font-semibold"> (Visita {visitConfig.configIndex}/{totalConfigs})</span>
              )}
            </span>
            <span className={cn(
              'px-2.5 py-0.5 text-xs font-medium rounded-full',
              STATUS_BADGE_COLORS[displayStatus] || STATUS_BADGE_COLORS['PENDING']
            )}>
              {JOB_STATUS_LABELS[displayStatus] || displayStatus}
            </span>
            {isUrgent && (
              <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-red-500 text-white">
                {PRIORITY_LABELS[job.priority]}
              </span>
            )}
            {/* Show date count for visit configs */}
            {visitConfig && visitConfig.totalDates > 1 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                <CalendarDays className="h-3 w-3" />
                {visitConfig.totalDates} fechas
              </span>
            )}
            {/* Recurring badge */}
            {isRecurring && isVisitRow && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                <Repeat className="h-3 w-3" />
                Recurrente
              </span>
            )}
            {/* Pricing locked badge (AFIP compliance) */}
            {job.pricingLockedAt && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200" title="Precio bloqueado - ya se generó factura">
                <Lock className="h-3 w-3" />
                Bloqueado
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

        {/* Section 3: Schedule - lg:w-48 */}
        <div className="lg:w-48 space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-gray-700">
              {visitConfig
                ? (visitConfig.firstDate === visitConfig.lastDate
                  ? formatDate(visitConfig.firstDate)
                  : `${formatDate(visitConfig.firstDate)} - ${formatDate(visitConfig.lastDate)}`)
                : (job.scheduledDate ? formatDate(job.scheduledDate) : 'Sin fecha')}
            </span>
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
          {job.assignments && job.assignments.length > 0 ? (
            // Show technicians from job.assignments (contains all assigned technicians)
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
                <User className="h-4 w-4 text-teal-600" />
              </div>
              <span className="text-sm text-gray-700 truncate">
                {job.assignments[0].technician?.name}
                {job.assignments.length > 1 && (
                  <span className="ml-1 text-xs text-teal-600 font-medium">+{job.assignments.length - 1}</span>
                )}
              </span>
            </div>
          ) : visitConfig?.technician ? (
            // Fallback: Visit config technician (legacy, single technician)
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
                <User className="h-4 w-4 text-teal-600" />
              </div>
              <span className="text-sm text-gray-700 truncate">
                {visitConfig.technician.name}
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
          <div className="relative" data-menu-container>
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ASSIGN TECHNICIAN MODAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
          <p className="text-sm text-gray-500">{job.jobNumber?.replace('JOB-', 'Trabajo-')}</p>
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CANCEL CONFIRMATION MODAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
          Esta acción cancelará el trabajo <strong>{job.jobNumber?.replace('JOB-', 'Trabajo-')}</strong>. Esta acción no se puede deshacer.
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
