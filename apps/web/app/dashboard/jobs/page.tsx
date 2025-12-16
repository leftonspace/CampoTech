'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { cn, formatDate, JOB_STATUS_LABELS, JOB_STATUS_COLORS, searchMatchesAny } from '@/lib/utils';
import { Plus, Search, Filter, Calendar, List, ChevronRight, X, Users, Wrench, AlertTriangle } from 'lucide-react';
import { Job } from '@/types';

type ViewMode = 'list' | 'calendar';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

export default function JobsPage() {
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get('status') || ''
  );
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', { status: statusFilter }],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      return api.jobs.list(params);
    },
  });

  const allJobs = data?.data as Job[] | undefined;

  // Client-side filtering with accent-insensitive search
  const jobs = allJobs?.filter((job) => {
    // Search filter - searches across multiple fields
    if (search) {
      const searchFields = [
        job.jobNumber,
        job.title,
        job.description,
        job.customer?.name,
        job.customer?.phone,
        job.address,
        job.serviceType,
        ...(job.assignments?.map(a => a.technician?.name) || []),
      ];
      if (!searchMatchesAny(searchFields, search)) return false;
    }

    // Priority filter
    if (priorityFilter && job.priority !== priorityFilter) return false;

    return true;
  });

  const hasActiveFilters = search || statusFilter || priorityFilter;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
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

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-4">
          {/* Main row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
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

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'btn-outline',
                hasActiveFilters && 'border-primary-500 text-primary-600'
              )}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <span className="ml-2 rounded-full bg-primary-500 px-2 py-0.5 text-xs text-white">
                  {[statusFilter, priorityFilter].filter(Boolean).length + (search ? 1 : 0)}
                </span>
              )}
            </button>

            {/* View mode toggle */}
            <div className="flex rounded-md border">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-1 px-3 py-2 text-sm',
                  viewMode === 'list'
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <List className="h-4 w-4" />
                Lista
              </button>
              <Link
                href="/dashboard/calendar"
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                <Calendar className="h-4 w-4" />
                Calendario
              </Link>
            </div>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-4 border-t pt-4">
              {/* Status filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Estado:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input w-auto py-1.5 text-sm"
                >
                  <option value="">Todos</option>
                  <option value="pending">Pendiente</option>
                  <option value="scheduled">Programado</option>
                  <option value="en_camino">En camino</option>
                  <option value="working">En trabajo</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

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
      {viewMode === 'list' && (
        <div className="card">
          {isLoading ? (
            <div className="divide-y">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : jobs?.length ? (
            <div className="divide-y">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/dashboard/jobs/${job.id}`}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex h-12 w-16 flex-col items-center justify-center rounded-lg bg-gray-100 text-xs font-medium text-gray-600">
                    <span className="text-sm">#{job.jobNumber || job.id.slice(0, 4)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Job title as main heading */}
                    {job.title && (
                      <p className="truncate font-semibold text-gray-900">
                        {job.title}
                      </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <p className="truncate text-sm text-gray-600">
                        {job.customer?.name || 'Sin cliente'}
                      </p>
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-gray-500">{formatDate(job.scheduledDate || job.createdAt)}</span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                          JOB_STATUS_COLORS[job.status]
                        )}
                      >
                        {JOB_STATUS_LABELS[job.status]}
                      </span>
                      {job.priority !== 'normal' && (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                            PRIORITY_COLORS[job.priority]
                          )}
                        >
                          {PRIORITY_LABELS[job.priority]}
                        </span>
                      )}
                    </div>
                    {job.address && (
                      <p className="truncate text-sm text-gray-500 mt-0.5">
                        📍 {job.address}
                      </p>
                    )}
                    {/* Show assigned technicians */}
                    {job.assignments && job.assignments.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {job.assignments.map((assignment) => (
                          <span
                            key={assignment.id}
                            className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                          >
                            {assignment.technician?.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500">No se encontraron trabajos</p>
              <Link href="/dashboard/jobs/new" className="btn-primary mt-4 inline-flex">
                <Plus className="mr-2 h-4 w-4" />
                Crear trabajo
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Calendar view redirect */}
      {viewMode === 'calendar' && (
        <div className="card p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-500">Ver trabajos en calendario</p>
          <Link href="/dashboard/calendar" className="btn-primary mt-4 inline-flex">
            <Calendar className="mr-2 h-4 w-4" />
            Abrir calendario
          </Link>
        </div>
      )}
    </div>
  );
}
