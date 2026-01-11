'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
  Truck,
  Wrench,
  AlertCircle,
  Navigation,
  RefreshCw,
} from 'lucide-react';

interface ItineraryJob {
  id: string;
  jobNumber: string;
  order: number;
  status: string;
  serviceType: string;
  description: string;
  urgency: string;
  scheduledDate: string;
  scheduledTime: {
    start: string | null;
    end: string | null;
  };
  startedAt: string | null;
  completedAt: string | null;
  estimatedDuration: number | null;
  actualDuration: number | null;
  travelTimeFromPrevious: number | null;
  location: {
    lat: number | null;
    lng: number | null;
    address: string;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  tracking: {
    sessionId: string;
    status: string;
    etaMinutes: number | null;
    arrivedAt: string | null;
  } | null;
}

interface ItineraryData {
  technician: {
    id: string;
    name: string;
    phone: string;
    avatar: string | null;
    specialty: string | null;
    skillLevel: string | null;
    currentLocation: { lat: number; lng: number } | null;
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
    totalTravelMinutes: number;
  };
}

interface ItineraryPanelProps {
  technicianId: string;
  technicianName: string;
  onClose: () => void;
  onJobClick?: (job: ItineraryJob) => void;
  onNavigate?: (job: ItineraryJob) => void;
}

async function fetchItinerary(
  technicianId: string,
  date: string
): Promise<ItineraryData> {
  const res = await fetch(
    `/api/technicians/${technicianId}/itinerary?date=${date}`
  );
  if (!res.ok) throw new Error('Error cargando itinerario');
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '--:--';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return '--';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'COMPLETED':
      return {
        icon: CheckCircle,
        color: 'text-green-500',
        bg: 'bg-green-50',
        border: 'border-green-200',
        label: 'Completado',
      };
    case 'IN_PROGRESS':
      return {
        icon: Wrench,
        color: 'text-orange-500',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        label: 'En progreso',
      };
    case 'EN_ROUTE':
      return {
        icon: Truck,
        color: 'text-blue-500',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        label: 'En camino',
      };
    case 'ASSIGNED':
      return {
        icon: Circle,
        color: 'text-blue-400',
        bg: 'bg-blue-50',
        border: 'border-blue-100',
        label: 'Asignado',
      };
    case 'PENDING':
      return {
        icon: Circle,
        color: 'text-gray-400',
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        label: 'Pendiente',
      };
    case 'CANCELLED':
      return {
        icon: AlertCircle,
        color: 'text-red-500',
        bg: 'bg-red-50',
        border: 'border-red-200',
        label: 'Cancelado',
      };
    default:
      return {
        icon: Circle,
        color: 'text-gray-400',
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        label: status,
      };
  }
}

export function ItineraryPanel({
  technicianId,
  technicianName,
  onClose,
  onJobClick,
  onNavigate,
}: ItineraryPanelProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['itinerary', technicianId, selectedDate],
    queryFn: () => fetchItinerary(technicianId, selectedDate),
  });

  const changeDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white h-full flex flex-col shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary-600" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Itinerario
            </h3>
            <p className="text-xs text-gray-500">{technicianName}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded-full"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <button
          onClick={() => changeDate(-1)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900">
            {new Date(selectedDate).toLocaleDateString('es-AR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          {isToday && (
            <span className="text-xs text-primary-600 font-medium">Hoy</span>
          )}
        </div>
        <button
          onClick={() => changeDate(1)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronRight className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <AlertCircle className="h-6 w-6 mb-2" />
            <p className="text-sm">Error cargando itinerario</p>
            <button
              onClick={() => refetch()}
              className="text-xs text-primary-600 mt-1"
            >
              Reintentar
            </button>
          </div>
        ) : data?.itinerary.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Calendar className="h-6 w-6 mb-2" />
            <p className="text-sm">Sin trabajos programados</p>
          </div>
        ) : (
          <div className="py-2">
            {/* Jobs Timeline */}
            {data?.itinerary.map((job, index) => {
              const config = getStatusConfig(job.status);
              const StatusIcon = config.icon;
              const isActive = ['EN_ROUTE', 'IN_PROGRESS'].includes(
                job.status
              );

              return (
                <div key={job.id} className="relative">
                  {/* Travel time indicator */}
                  {job.travelTimeFromPrevious && job.travelTimeFromPrevious > 0 && (
                    <div className="flex items-center gap-2 px-4 py-1 text-xs text-gray-400">
                      <div className="w-6 flex justify-center">
                        <div className="h-6 border-l-2 border-dashed border-gray-200" />
                      </div>
                      <Navigation className="h-3 w-3" />
                      <span>{job.travelTimeFromPrevious} min de viaje</span>
                    </div>
                  )}

                  {/* Job Card */}
                  <button
                    onClick={() => onJobClick?.(job)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      isActive ? 'bg-orange-50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Status Icon */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`p-1.5 rounded-full ${config.bg} ${config.border} border`}
                        >
                          <StatusIcon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        {index < (data?.itinerary.length || 0) - 1 && (
                          <div className="flex-1 w-0.5 bg-gray-200 my-1" />
                        )}
                      </div>

                      {/* Job Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              #{job.jobNumber}
                            </p>
                            <p className="text-xs text-gray-500">
                              {config.label}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {job.scheduledTime.start || '--:--'}
                            </p>
                            {job.estimatedDuration && (
                              <p className="text-xs text-gray-500">
                                ~{formatDuration(job.estimatedDuration)}
                              </p>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-gray-700 mt-1 line-clamp-1">
                          {job.description}
                        </p>

                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.location.address || 'Sin dirección'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-600 font-medium">
                            {job.customer.name}
                          </span>
                          {job.status === 'IN_PROGRESS' && job.startedAt && (
                            <span className="text-xs text-orange-600 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Desde {formatTime(job.startedAt)}
                            </span>
                          )}
                          {job.tracking?.etaMinutes && (
                            <span className="text-xs text-blue-600">
                              ETA: {job.tracking.etaMinutes} min
                            </span>
                          )}
                        </div>

                        {/* Quick Actions */}
                        {isActive && (
                          <div className="flex gap-2 mt-2">
                            <a
                              href={`tel:${job.customer.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                            >
                              <Phone className="h-3 w-3" />
                              Llamar
                            </a>
                            {job.location.lat && job.location.lng && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate?.(job);
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded text-blue-700"
                              >
                                <Navigation className="h-3 w-3" />
                                Navegar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      {data && (
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
          <p className="text-xs font-medium text-gray-500 mb-2">
            Resumen del día
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-semibold text-green-600">
                {data.stats.completed}
              </p>
              <p className="text-xs text-gray-500">Completados</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-orange-600">
                {data.stats.inProgress + data.stats.enRoute}
              </p>
              <p className="text-xs text-gray-500">En curso</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-600">
                {data.stats.pending}
              </p>
              <p className="text-xs text-gray-500">Pendientes</p>
            </div>
          </div>
          {data.stats.totalActualMinutes > 0 && (
            <p className="text-xs text-gray-500 text-center mt-2">
              Tiempo trabajado: {formatDuration(data.stats.totalActualMinutes)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default ItineraryPanel;
