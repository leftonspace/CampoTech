'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import {
  Calendar,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { formatDateBuenosAires, getBuenosAiresNow, formatDisplayTime } from '@/lib/timezone';

interface TechnicianSchedule {
  id: string;
  name: string;
  avatar: string | null;
  todayJobs: Array<{
    id: string;
    jobNumber: string;
    status: string;
    scheduledTimeSlot: { start?: string; end?: string } | null;
    customer: {
      name: string;
    } | null;
  }>;
  completedToday: number;
  totalToday: number;
}

async function fetchTodaySchedule(): Promise<{ success: boolean; data: TechnicianSchedule[] }> {
  // Get technicians with their jobs for today (in Argentina timezone)
  const today = formatDateBuenosAires(getBuenosAiresNow());
  const res = await fetch(`/api/jobs/calendar?start=${today}&end=${today}`);
  if (!res.ok) throw new Error('Error cargando agenda');

  const data = await res.json();

  // Group jobs by technician
  const technicianMap = new Map<string, TechnicianSchedule>();

  // API returns { data: { events: [...], technicians: [...] } }
  const events = data.data?.events || [];
  for (const event of events) {
    const tech = event.extendedProps?.technician;
    if (!tech) continue;

    if (!technicianMap.has(tech.id)) {
      technicianMap.set(tech.id, {
        id: tech.id,
        name: tech.name,
        avatar: tech.avatar,
        todayJobs: [],
        completedToday: 0,
        totalToday: 0,
      });
    }

    const techSchedule = technicianMap.get(tech.id)!;
    techSchedule.todayJobs.push({
      id: event.id,
      jobNumber: event.extendedProps.jobNumber,
      status: event.extendedProps.status,
      scheduledTimeSlot: event.extendedProps.scheduledTimeSlot,
      customer: event.extendedProps.customer,
    });
    techSchedule.totalToday++;
    if (event.extendedProps.status === 'COMPLETED') {
      techSchedule.completedToday++;
    }
  }

  return {
    success: true,
    data: Array.from(technicianMap.values()).sort((a, b) => b.totalToday - a.totalToday),
  };
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  ASSIGNED: 'bg-purple-100 text-purple-700',
  EN_ROUTE: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  ASSIGNED: 'Asignado',
  EN_ROUTE: 'En camino',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

export function TodaySchedule() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-today-schedule'],
    queryFn: fetchTodaySchedule,
    staleTime: 30000,
  });

  const technicians = data?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Calendar className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">Error cargando agenda</p>
      </div>
    );
  }

  if (technicians.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Calendar className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">No hay trabajos agendados para hoy</p>
        <Link
          href="/dashboard/calendar"
          className="mt-3 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
        >
          Agendar trabajo
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {technicians.slice(0, 4).map((tech) => (
        <div key={tech.id} className="rounded-lg border p-3">
          {/* Technician header */}
          <div className="flex items-center gap-3 mb-3">
            {tech.avatar ? (
              <Image
                src={tech.avatar}
                alt={tech.name}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600 font-medium">
                {getInitials(tech.name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{tech.name}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{tech.completedToday}/{tech.totalToday} completados</span>
                {tech.completedToday === tech.totalToday && tech.totalToday > 0 && (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
              </div>
            </div>
            {/* Progress indicator */}
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{
                  width: `${tech.totalToday > 0 ? (tech.completedToday / tech.totalToday) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Jobs list */}
          <ul className="space-y-1.5">
            {tech.todayJobs.slice(0, 3).map((job) => (
              <li key={job.id}>
                <Link
                  href={`/dashboard/jobs/${job.id}`}
                  className="flex items-center gap-2 rounded p-1.5 text-sm hover:bg-gray-50"
                >
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${statusColors[job.status]}`}>
                    {statusLabels[job.status] || job.status}
                  </span>
                  <span className="truncate text-gray-600">
                    {job.customer?.name || job.jobNumber}
                  </span>
                  {job.scheduledTimeSlot?.start && (
                    <span className="ml-auto shrink-0 text-xs text-gray-400">
                      {formatDisplayTime(new Date(job.scheduledTimeSlot.start))}
                    </span>
                  )}
                </Link>
              </li>
            ))}
            {tech.todayJobs.length > 3 && (
              <li className="text-xs text-gray-500 pl-2">
                +{tech.todayJobs.length - 3} más
              </li>
            )}
          </ul>
        </div>
      ))}

      {/* View all link */}
      <Link
        href="/dashboard/calendar"
        className="flex items-center justify-center gap-1 text-sm text-primary-600 hover:underline"
      >
        Ver calendario completo
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
