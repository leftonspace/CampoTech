'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { cn, JOB_STATUS_LABELS, JOB_STATUS_COLORS } from '@/lib/utils';
import { ProtectedRoute } from '@/lib/auth-context';
import { getBuenosAiresNow, formatDisplayDate, formatDateBuenosAires } from '@/lib/timezone';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  GripVertical,
  UserPlus,
  X,
} from 'lucide-react';
import { Job, User as UserType } from '@/types';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'border-l-gray-400',
  normal: 'border-l-blue-400',
  high: 'border-l-orange-400',
  urgent: 'border-l-red-400',
};

export default function DispatchPage() {
  return (
    <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
      <DispatchContent />
    </ProtectedRoute>
  );
}

function DispatchContent() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(getBuenosAiresNow());
  const [draggingJob, setDraggingJob] = useState<Job | null>(null);
  const [dragOverTechnician, setDragOverTechnician] = useState<string | null>(null);

  const dateStr = formatDateBuenosAires(selectedDate);

  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ['dispatch-jobs', dateStr],
    queryFn: () => api.jobs.calendar(dateStr, dateStr),
    refetchInterval: 30000,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users-technicians'],
    queryFn: () => api.users.list({ role: 'TECHNICIAN' }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ jobId, userId }: { jobId: string; userId: string }) =>
      api.jobs.assign(jobId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-jobs'] });
    },
  });

  const jobs = useMemo(() => (jobsData?.data as Job[]) || [], [jobsData?.data]);
  const technicians = useMemo(() => (usersData?.data as UserType[]) || [], [usersData?.data]);

  // Group jobs by assignee
  const { unassigned, byTechnician } = useMemo(() => {
    const unassigned: Job[] = [];
    const byTechnician: Record<string, Job[]> = {};

    // Initialize each technician
    technicians.forEach((tech) => {
      byTechnician[tech.id] = [];
    });

    // Distribute jobs
    jobs.forEach((job) => {
      if (!job.assignedToId) {
        unassigned.push(job);
      } else if (byTechnician[job.assignedToId]) {
        byTechnician[job.assignedToId].push(job);
      } else {
        // Assigned to someone not in technicians list
        byTechnician[job.assignedToId] = byTechnician[job.assignedToId] || [];
        byTechnician[job.assignedToId].push(job);
      }
    });

    // Sort jobs by time
    const sortByTime = (a: Job, b: Job) => {
      const timeA = a.scheduledTimeStart || '23:59';
      const timeB = b.scheduledTimeStart || '23:59';
      return timeA.localeCompare(timeB);
    };

    unassigned.sort(sortByTime);
    Object.values(byTechnician).forEach((jobList) => jobList.sort(sortByTime));

    return { unassigned, byTechnician };
  }, [jobs, technicians]);

  const navigateDate = (days: number) => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + days);
      return newDate;
    });
  };

  const goToToday = () => {
    setSelectedDate(getBuenosAiresNow());
  };

  // Drag and drop handlers
  const handleDragStart = (job: Job) => {
    setDraggingJob(job);
  };

  const handleDragEnd = () => {
    setDraggingJob(null);
    setDragOverTechnician(null);
  };

  const handleDragOver = (e: React.DragEvent, technicianId: string) => {
    e.preventDefault();
    setDragOverTechnician(technicianId);
  };

  const handleDragLeave = () => {
    setDragOverTechnician(null);
  };

  const handleDrop = (technicianId: string) => {
    if (draggingJob && draggingJob.assignedToId !== technicianId) {
      assignMutation.mutate({ jobId: draggingJob.id, userId: technicianId });
    }
    setDraggingJob(null);
    setDragOverTechnician(null);
  };

  const handleUnassign = (jobId: string) => {
    assignMutation.mutate({ jobId, userId: '' });
  };

  const isLoading = jobsLoading || usersLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/jobs"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Despacho</h1>
            <p className="text-gray-500">Asignar trabajos a técnicos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchJobs()}
            className="btn-outline"
            title="Actualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link href="/dashboard/jobs/calendar" className="btn-outline">
            <Calendar className="mr-2 h-4 w-4" />
            Calendario
          </Link>
        </div>
      </div>

      {/* Date navigation */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate(-1)}
              className="rounded-md p-2 hover:bg-gray-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigateDate(1)}
              className="rounded-md p-2 hover:bg-gray-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="ml-2 text-lg font-semibold">
              {formatFullDate(selectedDate)}
            </span>
            {isToday(selectedDate) && (
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                Hoy
              </span>
            )}
          </div>
          <button onClick={goToToday} className="btn-outline text-sm">
            Ir a hoy
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-96 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {/* Unassigned column */}
          <div className="card flex flex-col">
            <div className="border-b p-4">
              <h2 className="font-medium text-gray-900">Sin asignar</h2>
              <p className="text-sm text-gray-500">
                {unassigned.length} trabajo{unassigned.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div
              className={cn(
                'flex-1 overflow-y-auto p-2',
                dragOverTechnician === 'unassigned' && 'bg-primary-50'
              )}
              onDragOver={(e) => handleDragOver(e, 'unassigned')}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop('')}
            >
              {unassigned.length > 0 ? (
                <div className="space-y-2">
                  {unassigned.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onDragStart={() => handleDragStart(job)}
                      onDragEnd={handleDragEnd}
                      isDragging={draggingJob?.id === job.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-gray-500">
                  Todos los trabajos asignados
                </div>
              )}
            </div>
          </div>

          {/* Technician columns */}
          {technicians.map((tech) => (
            <div key={tech.id} className="card flex flex-col">
              <div className="border-b p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="font-medium text-gray-900">{tech.name}</h2>
                    <p className="text-sm text-gray-500">
                      {byTechnician[tech.id]?.length || 0} trabajo
                      {(byTechnician[tech.id]?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
              <div
                className={cn(
                  'flex-1 overflow-y-auto p-2 transition-colors',
                  dragOverTechnician === tech.id && 'bg-primary-50'
                )}
                onDragOver={(e) => handleDragOver(e, tech.id)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(tech.id)}
              >
                {byTechnician[tech.id]?.length > 0 ? (
                  <div className="space-y-2">
                    {byTechnician[tech.id].map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onDragStart={() => handleDragStart(job)}
                        onDragEnd={handleDragEnd}
                        isDragging={draggingJob?.id === job.id}
                        onUnassign={() => handleUnassign(job.id)}
                        showUnassign
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center text-sm text-gray-500">
                    {draggingJob ? (
                      <span className="text-primary-600">Soltar aquí</span>
                    ) : (
                      'Sin trabajos'
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {technicians.length === 0 && (
            <div className="card col-span-3 flex flex-col items-center justify-center p-8">
              <UserPlus className="h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500">No hay técnicos registrados</p>
              <Link
                href="/dashboard/team"
                className="btn-primary mt-4"
              >
                Agregar técnicos
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <span>Pendiente: {jobs.filter((j) => j.status === 'PENDING').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span>Asignado: {jobs.filter((j) => j.status === 'ASSIGNED').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-purple-500" />
            <span>En camino: {jobs.filter((j) => j.status === 'EN_ROUTE').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            <span>Trabajando: {jobs.filter((j) => j.status === 'IN_PROGRESS').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span>Completado: {jobs.filter((j) => j.status === 'COMPLETED').length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface JobCardProps {
  job: Job;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
  onUnassign?: () => void;
  showUnassign?: boolean;
}

function JobCard({
  job,
  onDragStart,
  onDragEnd,
  isDragging,
  onUnassign,
  showUnassign,
}: JobCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group cursor-grab rounded-lg border-l-4 bg-white p-3 shadow-sm transition-all',
        'hover:shadow-md active:cursor-grabbing',
        PRIORITY_COLORS[job.priority],
        isDragging && 'opacity-50'
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/dashboard/jobs/${job.id}`}
            className="block truncate font-medium text-gray-900 hover:text-primary-600"
            onClick={(e) => e.stopPropagation()}
          >
            {job.serviceType?.replace(/_/g, ' ') || job.description || 'Trabajo'}
          </Link>
          {job.customer && (
            <p className="truncate text-sm text-gray-500">{job.customer.name}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
            {job.scheduledTimeStart && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {job.scheduledTimeStart}
              </span>
            )}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 font-medium',
                JOB_STATUS_COLORS[job.status]
              )}
            >
              {JOB_STATUS_LABELS[job.status]}
            </span>
          </div>
        </div>
        {showUnassign && onUnassign && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnassign();
            }}
            className="rounded p-1 opacity-0 transition-opacity hover:bg-gray-100 group-hover:opacity-100"
            title="Desasignar"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatFullDate(date: Date): string {
  return formatDisplayDate(date, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isToday(date: Date): boolean {
  const todayStr = formatDateBuenosAires(getBuenosAiresNow());
  const dateStr = formatDateBuenosAires(date);
  return dateStr === todayStr;
}
