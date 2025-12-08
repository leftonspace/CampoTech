'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { cn, formatDate, JOB_STATUS_LABELS, JOB_STATUS_COLORS } from '@/lib/utils';
import { Plus, Search, Filter, Calendar, List, ChevronRight } from 'lucide-react';
import { Job } from '@/types';

type ViewMode = 'list' | 'calendar';

export default function JobsPage() {
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get('status') || ''
  );

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', { search, status: statusFilter }],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      return api.jobs.list(params);
    },
  });

  const jobs = data?.data as Job[] | undefined;

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar trabajos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-full sm:w-auto"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="scheduled">Programado</option>
            <option value="en_camino">En camino</option>
            <option value="working">En trabajo</option>
            <option value="completed">Completado</option>
            <option value="cancelled">Cancelado</option>
          </select>

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
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'flex items-center gap-1 px-3 py-2 text-sm',
                viewMode === 'calendar'
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <Calendar className="h-4 w-4" />
              Calendario
            </button>
          </div>
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                    #{job.id.slice(0, 4)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
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
                      {job.scheduledDate && ` • ${formatDate(job.scheduledDate)}`}
                    </p>
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

      {/* Calendar view placeholder */}
      {viewMode === 'calendar' && (
        <div className="card p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-500">Vista de calendario próximamente</p>
        </div>
      )}
    </div>
  );
}
