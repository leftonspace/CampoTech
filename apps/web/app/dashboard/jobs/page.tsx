'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn, formatDate, formatAddress, JOB_STATUS_LABELS, getInitials } from '@/lib/utils';
import {
  Plus,
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Job } from '@/types';
import NewJobModal from '@/components/jobs/NewJobModal';
import EditJobModal from '@/components/jobs/EditJobModal';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES & CONSTANTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface JobStats {
  totalCount: number;
  inProgressCount: number;
  scheduledTodayCount: number;
  completedThisMonthCount: number;
  pendingVarianceCount?: number;
  activeCount?: number;
  cancelledCount?: number;
}

// Response type for v2 API endpoint
interface JobsApiResponse {
  success: boolean;
  data: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  _optimized?: boolean;
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export default function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();


  // State
  const [activeTab, setActiveTab] = useState<'todos' | 'activos' | 'cancelados'>('activos'); // Job folder tabs
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [technicianFilter, setTechnicianFilter] = useState<string>('');
  const [durationTypeFilter, setDurationTypeFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('scheduled_desc'); // Default: most recent scheduled date first
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [assignModalJob, setAssignModalJob] = useState<Job | null>(null);
  const [cancelConfirmJob, setCancelConfirmJob] = useState<Job | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
  const [page, setPage] = useState(1); // Pagination state for v2 API

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, technicianFilter, durationTypeFilter, activeTab]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // GLOBAL SEARCH INTEGRATION
  // Handle URL params for search pre-fill and auto-open modal
  // ═══════════════════════════════════════════════════════════════════════════════

  // Sync search state with URL 'search' param (for inline global search)
  useEffect(() => {
    const searchParam = searchParams.get('search') || '';
    // Only update if different to avoid loops
    if (searchParam !== search) {
      setSearch(searchParam);
    }
  }, [searchParams, search]);

  // Handle job modal open from URL param
  useEffect(() => {
    const jobParam = searchParams.get('job');

    if (jobParam) {
      setSelectedJobId(jobParam);
      // Clean up URL after opening (remove the job param, keep search)
      const url = new URL(window.location.href);
      url.searchParams.delete('job');
      router.replace(url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ''), { scroll: false });
    }
  }, [searchParams, router]);


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

  // ═══════════════════════════════════════════════════════════════════════════════
  // OPTIMIZED DATA FETCHING (Phase 4 - Feb 2026)
  // Uses v2 API endpoints with SQL views for sub-500ms response times
  // ═══════════════════════════════════════════════════════════════════════════════

  // Fetch jobs using optimized v2 endpoint
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs-v2', {
      status: statusFilter,
      durationType: durationTypeFilter,
      technician: technicianFilter,
      search, // Server-side search
      sortBy,
      page,
      activeTab, // Include tab filter in query key
    }],
    queryFn: async () => {
      // Map frontend sort options to API sort/order params
      let sort = 'scheduledDate';
      let order = 'desc';

      switch (sortBy) {
        case 'scheduled_desc':
          sort = 'scheduledDate';
          order = 'desc';
          break;
        case 'scheduled_asc':
          sort = 'scheduledDate';
          order = 'asc';
          break;
        case 'created_desc':
          sort = 'createdAt';
          order = 'desc';
          break;
        case 'created_asc':
          sort = 'createdAt';
          order = 'asc';
          break;
      }

      // Build query params for v2 endpoint
      const params = new URLSearchParams({
        limit: '50', // Paginated - 50 per page
        page: String(page),
        sort,
        order,
      });

      // Apply tab-based status filter
      if (activeTab === 'cancelados') {
        params.set('status', 'CANCELLED');
      } else if (activeTab === 'activos') {
        // Activos = jobs in progress (excludes CANCELLED and COMPLETED)
        // PENDING, ASSIGNED, EN_ROUTE, IN_PROGRESS
        params.set('status', 'PENDING,ASSIGNED,EN_ROUTE,IN_PROGRESS');
      }
      // 'todos' = no status filter (show all)

      // Additional filters
      if (statusFilter) params.set('status', statusFilter);
      if (durationTypeFilter) params.set('durationType', durationTypeFilter);
      if (technicianFilter) params.set('technicianId', technicianFilter);
      if (search) params.set('search', search); // Server-side search!

      const res = await fetch(`/api/jobs/v2?${params}`);
      if (!res.ok) throw new Error('Error fetching jobs');
      return res.json() as Promise<JobsApiResponse>;
    },
    placeholderData: (previousData) => previousData, // Smooth pagination transitions (React Query v5)
  });

  // Fetch stats using optimized v2 endpoint (single query for all counts)
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['jobs-stats-v2'],
    queryFn: async () => {
      const res = await fetch('/api/jobs/stats/v2');
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

  // Pending variance count now comes from v2 stats endpoint
  const pendingVarianceCount = statsData?.data?.pendingVarianceCount || 0;

  const allJobs = jobsData?.data as Job[] | undefined;
  const pagination = jobsData?.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 };
  const stats: JobStats = statsData?.data || {
    totalCount: 0,
    inProgressCount: 0,
    scheduledTodayCount: 0,
    completedThisMonthCount: 0,
    pendingVarianceCount: 0,
    activeCount: 0,
    cancelledCount: 0,
  };
  const technicians: TechnicianOption[] = techniciansData?.data || [];

  // Client-side processing: grouping visits by their original "Visita" config
  // NOTE: Tab, search, and technician filtering is now handled server-side by v2 API
  const jobRows = useMemo((): JobOrVisitRow[] => {
    if (!allJobs) return [];

    const rows: JobOrVisitRow[] = [];

    for (const job of allJobs) {
      // NOTE: Tab filtering (activos/cancelados/todos) is now server-side
      // NOTE: Search filtering is now server-side (accent-insensitive!)
      // NOTE: Technician filtering is now server-side

      // Priority filter (still client-side - not in v2 view)
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

          // NOTE: Technician filter now handled server-side

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
        // NOTE: Technician filter now handled server-side

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
        case 'scheduled_desc':
          // Most recent scheduled date first
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        case 'scheduled_asc':
          // Oldest scheduled date first
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        case 'created_desc':
          // Newest created first
          return new Date(createdB).getTime() - new Date(createdA).getTime();
        case 'created_asc':
          // Oldest created first
          return new Date(createdA).getTime() - new Date(createdB).getTime();
        default:
          // Default to most recent scheduled date
          return new Date(dateB).getTime() - new Date(dateA).getTime();
      }
    });

    return rows;
  }, [allJobs, priorityFilter, sortBy]); // Removed server-side filters from dependencies

  const hasActiveFilters = search || statusFilter || priorityFilter || technicianFilter || durationTypeFilter;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setTechnicianFilter('');
    setDurationTypeFilter('');
    setSortBy('scheduled_desc');
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
      queryClient.invalidateQueries({ queryKey: ['jobs-v2'] });
      queryClient.invalidateQueries({ queryKey: ['jobs-stats-v2'] });
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
      queryClient.invalidateQueries({ queryKey: ['jobs-v2'] });
      queryClient.invalidateQueries({ queryKey: ['jobs-stats-v2'] });
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
          {/* Tabs - Use stats counts which are always accurate */}
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
              <span className={cn(
                'px-2 py-0.5 text-xs rounded-full',
                activeTab === 'todos' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600'
              )}>
                {stats.totalCount}
              </span>
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
              <span className={cn(
                'px-2 py-0.5 text-xs rounded-full',
                activeTab === 'activos' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
              )}>
                {stats.activeCount || (stats.totalCount - (stats.cancelledCount || 0))}
              </span>
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
              <span className={cn(
                'px-2 py-0.5 text-xs rounded-full',
                activeTab === 'cancelados' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
              )}>
                {stats.cancelledCount || 0}
              </span>
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
              {(priorityFilter || technicianFilter || durationTypeFilter || sortBy !== 'scheduled_desc') && (
                <span className="ml-2 rounded-full bg-primary-500 px-2 py-0.5 text-xs text-white">
                  {[priorityFilter, technicianFilter, durationTypeFilter, sortBy !== 'scheduled_desc' ? 'sort' : ''].filter(Boolean).length}
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
                <option value="scheduled_desc">Fecha más reciente</option>
                <option value="scheduled_asc">Fecha más antigua</option>
                <option value="created_desc">Creado más reciente</option>
                <option value="created_asc">Creado más antiguo</option>
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

        {/* Pagination Controls (Phase 4) */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-b-lg">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                disabled={page === pagination.totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Mostrando <span className="font-medium">{(page - 1) * pagination.limit + 1}</span> a{' '}
                  <span className="font-medium">{Math.min(page * pagination.limit, pagination.total)}</span> de{' '}
                  <span className="font-medium">{pagination.total}</span> resultados
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Anterior</span>
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    // Show pages around current page
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={cn(
                          'relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 focus:z-20 focus:outline-offset-0',
                          page === pageNum
                            ? 'z-10 bg-primary-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600'
                            : 'text-gray-900 hover:bg-gray-50'
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                    disabled={page === pagination.totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Siguiente</span>
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
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
            queryClient.invalidateQueries({ queryKey: ['jobs-v2'] });
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
            queryClient.invalidateQueries({ queryKey: ['jobs-v2'] });
            queryClient.invalidateQueries({ queryKey: ['jobs-stats-v2'] });
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
