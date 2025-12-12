'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { cn, searchMatchesAny } from '@/lib/utils';
import {
  ArrowLeft,
  Users,
  Plus,
  UserPlus,
  UserMinus,
  Search,
  Briefcase,
  Star,
  Check,
} from 'lucide-react';

interface Technician {
  userId: string;
  userName: string;
  specialty: string | null;
  skillLevel: string | null;
  homeLocationId: string | null;
  homeLocationName: string | null;
  isActive: boolean;
  currentJobCount: number;
  todayJobCount: number;
}

interface LocationTeam {
  locationId: string;
  locationName: string;
  locationCode: string;
  technicians: Technician[];
  totalTechnicians: number;
  activeTechnicians: number;
  techniciansBySpecialty: Record<string, number>;
}

const SPECIALTIES: Record<string, string> = {
  PLOMERO: 'Plomero',
  ELECTRICISTA: 'Electricista',
  GASISTA: 'Gasista',
  CALEFACCIONISTA: 'Calefaccionista',
  REFRIGERACION: 'Refrigeración',
  ALBANIL: 'Albañil',
  PINTOR: 'Pintor',
  CARPINTERO: 'Carpintero',
  OTRO: 'Otro',
};

const SKILL_LEVELS: Record<string, string> = {
  AYUDANTE: 'Ayudante',
  MEDIO_OFICIAL: 'Medio Oficial',
  OFICIAL: 'Oficial',
  OFICIAL_ESPECIALIZADO: 'Oficial Especializado',
};

async function fetchLocationTeam(id: string): Promise<{ success: boolean; data: LocationTeam }> {
  const response = await fetch(`/api/locations/team?view=teams`);
  const result = await response.json();
  const team = result.data?.teams?.find((t: LocationTeam) => t.locationId === id);
  return { success: !!team, data: team };
}

async function fetchUnassignedTechnicians(): Promise<{ success: boolean; data: { assignments: Technician[] } }> {
  const response = await fetch('/api/locations/team?view=assignments&onlyUnassigned=true');
  return response.json();
}

async function assignTechnician(userId: string, locationId: string) {
  const response = await fetch('/api/locations/team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, locationId }),
  });
  return response.json();
}

async function unassignTechnician(userId: string) {
  const response = await fetch(`/api/locations/team?userId=${userId}`, {
    method: 'DELETE',
  });
  return response.json();
}

export default function LocationTeamPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');

  const { data: teamData, isLoading } = useQuery({
    queryKey: ['location-team', params.id],
    queryFn: () => fetchLocationTeam(params.id as string),
    enabled: !!params.id,
  });

  const { data: unassignedData } = useQuery({
    queryKey: ['unassigned-technicians'],
    queryFn: fetchUnassignedTechnicians,
    enabled: showAddModal,
  });

  const team = teamData?.data;
  const unassignedTechnicians = unassignedData?.data?.assignments || [];

  const handleAssign = async (userId: string) => {
    const result = await assignTechnician(userId, params.id as string);
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ['location-team'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-technicians'] });
      setShowAddModal(false);
    }
  };

  const handleUnassign = async (userId: string) => {
    if (confirm('¿Estás seguro de que deseas desasignar a este técnico?')) {
      const result = await unassignTechnician(userId);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['location-team'] });
      }
    }
  };

  const filteredTechnicians = team?.technicians.filter((tech) =>
    searchMatchesAny([tech.userName, tech.specialty], search)
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="card p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-12 w-12 animate-pulse rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/locations/${params.id}`}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
            <p className="text-gray-500">{team?.locationName}</p>
          </div>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <UserPlus className="mr-2 h-4 w-4" />
          Agregar técnico
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total técnicos</p>
              <p className="text-xl font-bold">{team?.totalTechnicians || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Activos</p>
              <p className="text-xl font-bold">{team?.activeTechnicians || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <Briefcase className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Trabajos hoy</p>
              <p className="text-xl font-bold">
                {team?.technicians.reduce((sum, t) => sum + t.todayJobCount, 0) || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Specialty breakdown */}
      {team?.techniciansBySpecialty && Object.keys(team.techniciansBySpecialty).length > 0 && (
        <div className="card p-4">
          <h3 className="font-medium text-gray-900 mb-3">Por especialidad</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(team.techniciansBySpecialty).map(([specialty, count]) => (
              <span
                key={specialty}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm"
              >
                {SPECIALTIES[specialty] || specialty}
                <span className="font-medium text-primary-600">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar técnico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Technicians list */}
      <div className="card">
        {filteredTechnicians?.length ? (
          <div className="divide-y">
            {filteredTechnicians.map((tech) => (
              <div key={tech.userId} className="flex items-center gap-4 p-4">
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full font-medium',
                    tech.isActive ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  {tech.userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-gray-900">{tech.userName}</p>
                    {!tech.isActive && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    {tech.specialty && (
                      <span>{SPECIALTIES[tech.specialty] || tech.specialty}</span>
                    )}
                    {tech.skillLevel && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {SKILL_LEVELS[tech.skillLevel] || tech.skillLevel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="font-medium text-gray-900">{tech.todayJobCount}</p>
                  <p className="text-xs text-gray-500">trabajos hoy</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{tech.currentJobCount}</p>
                  <p className="text-xs text-gray-500">activos</p>
                </div>
                <button
                  onClick={() => handleUnassign(tech.userId)}
                  className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="Desasignar"
                >
                  <UserMinus className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">No hay técnicos asignados</p>
            <button onClick={() => setShowAddModal(true)} className="btn-primary mt-4">
              <UserPlus className="mr-2 h-4 w-4" />
              Agregar técnico
            </button>
          </div>
        )}
      </div>

      {/* Add Technician Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="border-b p-4">
              <h3 className="text-lg font-semibold text-gray-900">Agregar técnico</h3>
              <p className="text-sm text-gray-500">Selecciona un técnico sin asignar</p>
            </div>
            <div className="overflow-y-auto max-h-96">
              {unassignedTechnicians.length ? (
                <div className="divide-y">
                  {unassignedTechnicians.map((tech) => (
                    <button
                      key={tech.userId}
                      onClick={() => handleAssign(tech.userId)}
                      className="flex w-full items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600 font-medium">
                        {tech.userName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-gray-900">{tech.userName}</p>
                        <p className="text-sm text-gray-500">
                          {tech.specialty ? SPECIALTIES[tech.specialty] || tech.specialty : 'Sin especialidad'}
                        </p>
                      </div>
                      <Plus className="h-5 w-5 text-primary-600" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Users className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">No hay técnicos disponibles</p>
                </div>
              )}
            </div>
            <div className="border-t p-4 flex justify-end">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
