'use client';

/**
 * Jobs List Page
 * ==============
 *
 * Shows customer's job history with filtering and pagination.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  Calendar,
  ArrowRight,
  Loader2,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { formatDate, formatCurrency, getStatusColor, getStatusLabel, cn } from '@/lib/utils';

type StatusFilter = 'all' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'scheduled', label: 'Programados' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'completed', label: 'Completados' },
  { value: 'cancelled', label: 'Cancelados' },
];

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadJobs();
  }, [statusFilter, currentPage]);

  const loadJobs = async () => {
    setIsLoading(true);
    const result = await customerApi.getJobs({
      status: statusFilter === 'all' ? undefined : statusFilter,
      page: currentPage,
      limit: 10,
    });

    if (result.success && result.data) {
      setJobs(result.data.jobs || []);
      setTotalPages(result.data.pagination?.totalPages || 1);
    }
    setIsLoading(false);
  };

  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      job.serviceType?.toLowerCase().includes(query) ||
      job.address?.toLowerCase().includes(query) ||
      job.technicianName?.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mis trabajos</h1>
        <p className="text-gray-600">
          Historial de servicios y reservas
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por servicio, dirección..."
              className="input pl-10"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setStatusFilter(option.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                  statusFilter === option.value
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Jobs list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : filteredJobs.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {filteredJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No se encontraron trabajos</p>
            <Link href="/book" className="text-primary-600 hover:text-primary-700">
              Reservar un servicio
            </Link>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <span className="text-sm text-gray-500">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({ job }: { job: any }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
    >
      {/* Icon */}
      <div className="w-14 h-14 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
        <Calendar className="w-7 h-7 text-primary-600" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-medium text-gray-900 truncate">
              {job.serviceType}
            </h3>
            <p className="text-sm text-gray-500 truncate">{job.address}</p>
          </div>
          <span
            className={cn(
              'px-2 py-1 rounded-full text-xs font-medium flex-shrink-0',
              getStatusColor(job.status)
            )}
          >
            {getStatusLabel(job.status)}
          </span>
        </div>

        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          <span>{formatDate(job.scheduledDate || job.createdAt)}</span>
          {job.technicianName && <span>• {job.technicianName}</span>}
          {job.total && <span>• {formatCurrency(job.total)}</span>}
        </div>
      </div>

      {/* Arrow */}
      <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
    </Link>
  );
}
