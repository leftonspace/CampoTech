'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Clock,
  MapPin,
  User,
  Phone,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Truck,
  PlayCircle,
  AlertCircle,
  Calendar,
  RefreshCw,
} from 'lucide-react';

interface ItineraryJob {
  id: string;
  jobNumber: string;
  status: string;
  serviceType: string;
  description: string;
  urgency: string;
  scheduledDate: string | null;
  scheduledTime: {
    start: string | null;
    end: string | null;
  };
  startedAt: string | null;
  completedAt: string | null;
  estimatedDuration: number | null;
  actualDuration: number | null;
  customer: {
    id: string;
    name: string;
    phone: string;
    address: unknown;
  };
  tracking: {
    sessionId: string;
    status: string;
    etaMinutes: number | null;
    arrivedAt: string | null;
  } | null;
}

interface ItineraryResponse {
  success: boolean;
  data: {
    technician: {
      id: string;
      name: string;
      phone: string;
      specialty: string | null;
    };
    date: string;
    itinerary: ItineraryJob[];
    stats: {
      total: number;
      completed: number;
      inProgress: number;
      enRoute: number;
      pending: number;
      totalEstimatedMinutes: number;
      totalActualMinutes: number;
    };
  };
}

interface ItineraryTimelineProps {
  technicianId: string;
  initialDate?: Date;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  PENDING: {
    color: 'bg-gray-100 text-gray-600 border-gray-300',
    icon: <Clock className="h-4 w-4" />,
    label: 'Pendiente',
  },
  ASSIGNED: {
    color: 'bg-purple-100 text-purple-600 border-purple-300',
    icon: <User className="h-4 w-4" />,
    label: 'Asignado',
  },
  EN_ROUTE: {
    color: 'bg-blue-100 text-blue-600 border-blue-300',
    icon: <Truck className="h-4 w-4" />,
    label: 'En Camino',
  },
  IN_PROGRESS: {
    color: 'bg-amber-100 text-amber-600 border-amber-300',
    icon: <PlayCircle className="h-4 w-4" />,
    label: 'En Progreso',
  },
  COMPLETED: {
    color: 'bg-green-100 text-green-600 border-green-300',
    icon: <CheckCircle className="h-4 w-4" />,
    label: 'Completado',
  },
};

function formatAddress(address: unknown): string {
  if (!address) return 'Sin dirección';
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    const addr = address as Record<string, unknown>;
    const parts: string[] = [];
    if (addr.street) parts.push(String(addr.street));
    if (addr.number) parts.push(String(addr.number));
    if (addr.city) parts.push(String(addr.city));
    return parts.join(', ') || 'Sin dirección';
  }
  return 'Sin dirección';
}

async function fetchItinerary(technicianId: string, date: string): Promise<ItineraryResponse> {
  const res = await fetch(`/api/technicians/${technicianId}/itinerary?date=${date}`);
  if (!res.ok) throw new Error('Error cargando itinerario');
  return res.json();
}

export function ItineraryTimeline({ technicianId, initialDate }: ItineraryTimelineProps) {
  const [date, setDate] = useState(initialDate || new Date());

  const dateStr = date.toISOString().split('T')[0];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['itinerary', technicianId, dateStr],
    queryFn: () => fetchItinerary(technicianId, dateStr),
    enabled: !!technicianId,
  });

  const handlePrevDay = () => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() - 1);
    setDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + 1);
    setDate(newDate);
  };

  const handleToday = () => {
    setDate(new Date());
  };

  const itinerary = data?.data?.itinerary || [];
  const stats = data?.data?.stats;

  const isToday = dateStr === new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-900">Itinerario del Día</h3>
        <button onClick={() => refetch()} className="text-gray-400 hover:text-gray-600">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <button
          onClick={handlePrevDay}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="font-medium text-gray-900">
            {date.toLocaleDateString('es-AR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
          {!isToday && (
            <button
              onClick={handleToday}
              className="text-xs text-primary-600 hover:underline"
            >
              Hoy
            </button>
          )}
        </div>
        <button
          onClick={handleNextDay}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-2 px-4 py-2 border-b bg-gray-50 text-xs">
          <div className="text-center">
            <span className="font-bold text-gray-900">{stats.total}</span>
            <span className="text-gray-500 ml-1">Total</span>
          </div>
          <div className="text-center">
            <span className="font-bold text-green-600">{stats.completed}</span>
            <span className="text-gray-500 ml-1">Hecho</span>
          </div>
          <div className="text-center">
            <span className="font-bold text-amber-600">{stats.inProgress + stats.enRoute}</span>
            <span className="text-gray-500 ml-1">Activo</span>
          </div>
          <div className="text-center">
            <span className="font-bold text-gray-600">{stats.pending}</span>
            <span className="text-gray-500 ml-1">Pend.</span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="mt-2 text-sm text-gray-500">Error cargando itinerario</p>
          </div>
        ) : itinerary.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Calendar className="h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">Sin trabajos programados</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

            {itinerary.map((job, index) => {
              const config = statusConfig[job.status] || statusConfig.PENDING;

              return (
                <div key={job.id} className="relative pl-12 pr-4 py-3 hover:bg-gray-50">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-4 w-4 h-4 rounded-full border-2 ${config.color}`}
                    style={{ top: '1rem' }}
                  >
                    {job.status === 'COMPLETED' && (
                      <CheckCircle className="h-3 w-3 absolute -top-0.5 -left-0.5" />
                    )}
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-500">
                      {job.scheduledTime.start || '--:--'}
                      {job.scheduledTime.end && ` - ${job.scheduledTime.end}`}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}
                    >
                      {config.icon}
                      {config.label}
                    </span>
                  </div>

                  {/* Job Info */}
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="block group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-gray-900 group-hover:text-primary-600">
                        {job.jobNumber}
                      </span>
                      {job.urgency === 'URGENTE' && (
                        <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                          Urgente
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-1">{job.description}</p>
                  </Link>

                  {/* Customer */}
                  <div className="mt-2 flex items-start gap-2 text-xs text-gray-500">
                    <User className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>{job.customer.name}</span>
                  </div>
                  <div className="mt-1 flex items-start gap-2 text-xs text-gray-500">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-1">{formatAddress(job.customer.address)}</span>
                  </div>

                  {/* Tracking info */}
                  {job.tracking && job.tracking.etaMinutes && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                      <Clock className="h-3.5 w-3.5" />
                      <span>ETA: {job.tracking.etaMinutes} min</span>
                    </div>
                  )}

                  {/* Duration */}
                  {job.status === 'COMPLETED' && job.actualDuration && (
                    <div className="mt-1 text-xs text-gray-400">
                      Duración: {job.actualDuration} min
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
