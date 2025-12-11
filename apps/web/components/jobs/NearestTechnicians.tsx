'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  Clock,
  Navigation,
  User,
  Phone,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';

interface NearestTechnician {
  id: string;
  name: string;
  phone: string;
  avatar: string | null;
  specialty: string | null;
  skillLevel: string | null;
  isOnline: boolean;
  isAvailable: boolean;
  isBusy: boolean;
  location: {
    lat: number;
    lng: number;
  };
  distance: number;
  etaMinutes: number;
  currentJobCount: number;
}

interface NearestTechniciansResponse {
  success: boolean;
  data: {
    destination: {
      lat: number;
      lng: number;
      job?: {
        id: string;
        jobNumber: string;
        description: string;
        customerName: string;
      };
    };
    technicians: NearestTechnician[];
    count: number;
  };
}

interface NearestTechniciansProps {
  jobId?: string;
  lat?: number;
  lng?: number;
  specialty?: string;
  onSelect?: (technician: NearestTechnician) => void;
  onAssign?: (technicianId: string) => void;
  selectedId?: string;
  limit?: number;
}

const specialtyLabels: Record<string, string> = {
  PLOMERO: 'Plomero',
  ELECTRICISTA: 'Electricista',
  GASISTA: 'Gasista',
  CALEFACCIONISTA: 'Calefaccionista',
  REFRIGERACION: 'Refrigeración',
  ALBANIL: 'Albañil',
  PINTOR: 'Pintor',
};

async function fetchNearestTechnicians(
  params: Pick<NearestTechniciansProps, 'jobId' | 'lat' | 'lng' | 'specialty' | 'limit'>
): Promise<NearestTechniciansResponse> {
  const searchParams = new URLSearchParams();
  if (params.jobId) searchParams.set('jobId', params.jobId);
  if (params.lat) searchParams.set('lat', params.lat.toString());
  if (params.lng) searchParams.set('lng', params.lng.toString());
  if (params.specialty) searchParams.set('specialty', params.specialty);
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const res = await fetch(`/api/tracking/nearest?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Error buscando técnicos');
  return res.json();
}

export function NearestTechnicians({
  jobId,
  lat,
  lng,
  specialty,
  onSelect,
  onAssign,
  selectedId,
  limit = 10,
}: NearestTechniciansProps) {
  const [expanded, setExpanded] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['nearest-technicians', jobId, lat, lng, specialty, limit],
    queryFn: () => fetchNearestTechnicians({ jobId, lat, lng, specialty, limit }),
    enabled: !!(jobId || (lat && lng)),
    staleTime: 30000,
  });

  const handleAssign = async (technicianId: string) => {
    if (!onAssign) return;
    setAssigningId(technicianId);
    try {
      await onAssign(technicianId);
    } finally {
      setAssigningId(null);
    }
  };

  const technicians = data?.data?.technicians || [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary-600" />
          <span className="font-medium text-gray-900">
            Técnicos Cercanos
          </span>
          {technicians.length > 0 && (
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
              {technicians.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              refetch();
            }}
            disabled={isFetching}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Buscando técnicos...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="mt-2 text-sm text-gray-500">Error buscando técnicos</p>
              <button
                onClick={() => refetch()}
                className="mt-2 text-sm text-primary-600 hover:underline"
              >
                Reintentar
              </button>
            </div>
          ) : technicians.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <User className="h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">
                No hay técnicos disponibles en este momento
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {technicians.map((tech, index) => (
                <div
                  key={tech.id}
                  onClick={() => onSelect?.(tech)}
                  className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 cursor-pointer transition-colors ${
                    selectedId === tech.id
                      ? 'bg-primary-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Rank */}
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      index === 0
                        ? 'bg-green-100 text-green-700'
                        : index === 1
                          ? 'bg-blue-100 text-blue-700'
                          : index === 2
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {index + 1}
                  </div>

                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {tech.avatar ? (
                      <img
                        src={tech.avatar}
                        alt={tech.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 font-medium">
                        {getInitials(tech.name)}
                      </div>
                    )}
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                        tech.isOnline ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">
                        {tech.name}
                      </span>
                      {tech.isAvailable && (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                          Disponible
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {tech.specialty && (
                        <span>{specialtyLabels[tech.specialty] || tech.specialty}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {tech.distance < 1
                          ? `${Math.round(tech.distance * 1000)} m`
                          : `${tech.distance.toFixed(1)} km`}
                      </span>
                    </div>
                  </div>

                  {/* ETA & Actions */}
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm font-medium text-blue-600">
                        <Clock className="h-4 w-4" />
                        {tech.etaMinutes} min
                      </div>
                      {tech.currentJobCount > 0 && (
                        <span className="text-xs text-amber-600">
                          {tech.currentJobCount} trabajo(s)
                        </span>
                      )}
                    </div>

                    {onAssign && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssign(tech.id);
                        }}
                        disabled={assigningId === tech.id}
                        className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                      >
                        {assigningId === tech.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Asignar'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
