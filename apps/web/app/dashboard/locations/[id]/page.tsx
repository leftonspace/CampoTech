'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Users,
  Globe,
  Settings,
  Phone,
  Mail,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Briefcase,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';

interface Location {
  id: string;
  code: string;
  name: string;
  type: string;
  isHeadquarters: boolean;
  isActive: boolean;
  address?: string;
  phone?: string;
  email?: string;
  coordinates?: { lat: number; lng: number };
  coverageRadiusKm?: number;
  settings?: {
    operatingHours?: Record<string, { open: string; close: string; closed?: boolean }>;
    maxJobsPerDay?: number;
  };
  afipConfig?: {
    puntoDeVenta: number;
    cuit: string;
    condicionIva: string;
    isActive: boolean;
  };
  _count?: {
    technicians: number;
    zones: number;
    jobs: number;
  };
}

async function fetchLocation(id: string): Promise<{ success: boolean; data: Location }> {
  const response = await fetch(`/api/locations/${id}`);
  return response.json();
}

async function deleteLocation(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/locations/${id}`, { method: 'DELETE' });
  return response.json();
}

const DAYS_ES = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

export default function LocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['location', params.id],
    queryFn: () => fetchLocation(params.id as string),
    enabled: !!params.id,
  });

  const location = data?.data;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteLocation(params.id as string);
      if (result.success) {
        router.push('/dashboard/locations');
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="card p-6">
          <div className="space-y-4">
            <div className="h-6 w-1/3 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="card p-8 text-center">
        <Building2 className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-4 text-gray-500">Sucursal no encontrada</p>
        <Link href="/dashboard/locations" className="btn-primary mt-4 inline-flex">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a sucursales
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/locations"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{location.name}</h1>
              {location.isHeadquarters && (
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                  Casa central
                </span>
              )}
              {location.isActive ? (
                <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  <CheckCircle className="h-3 w-3" />
                  Activa
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  <XCircle className="h-3 w-3" />
                  Inactiva
                </span>
              )}
            </div>
            <p className="text-gray-500 font-mono">{location.code}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/locations/${location.id}/settings`}
            className="btn-secondary"
          >
            <Settings className="mr-2 h-4 w-4" />
            Configuración
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="btn-secondary text-red-600 hover:bg-red-50"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={`/dashboard/locations/${location.id}/team`} className="card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Técnicos</p>
              <p className="text-xl font-bold">{location._count?.technicians || 0}</p>
            </div>
          </div>
        </Link>
        <Link href={`/dashboard/locations/${location.id}/zones`} className="card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
              <Globe className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Zonas</p>
              <p className="text-xl font-bold">{location._count?.zones || 0}</p>
            </div>
          </div>
        </Link>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Briefcase className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Trabajos</p>
              <p className="text-xl font-bold">{location._count?.jobs || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Cap. diaria</p>
              <p className="text-xl font-bold">{location.settings?.maxJobsPerDay || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Location Info */}
        <div className="card">
          <div className="border-b p-4">
            <h2 className="font-semibold text-gray-900">Información</h2>
          </div>
          <div className="p-4 space-y-4">
            {location.address && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Dirección</p>
                  <p className="text-gray-900">{location.address}</p>
                </div>
              </div>
            )}
            {location.phone && (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Teléfono</p>
                  <p className="text-gray-900">{location.phone}</p>
                </div>
              </div>
            )}
            {location.email && (
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-gray-900">{location.email}</p>
                </div>
              </div>
            )}
            {location.coordinates && (
              <div className="flex items-start gap-3">
                <Globe className="mt-0.5 h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Coordenadas</p>
                  <p className="text-gray-900 font-mono text-sm">
                    {location.coordinates.lat.toFixed(6)}, {location.coordinates.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            )}
            {location.coverageRadiusKm && (
              <div className="flex items-start gap-3">
                <Globe className="mt-0.5 h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Radio de cobertura</p>
                  <p className="text-gray-900">{location.coverageRadiusKm} km</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Operating Hours */}
        <div className="card">
          <div className="border-b p-4">
            <h2 className="font-semibold text-gray-900">Horarios de operación</h2>
          </div>
          <div className="p-4">
            {location.settings?.operatingHours ? (
              <div className="space-y-2">
                {Object.entries(DAYS_ES).map(([day, label]) => {
                  const hours = location.settings?.operatingHours?.[day];
                  return (
                    <div key={day} className="flex items-center justify-between py-1">
                      <span className="text-gray-600">{label}</span>
                      {hours?.closed ? (
                        <span className="text-gray-400">Cerrado</span>
                      ) : hours ? (
                        <span className="font-mono text-sm">
                          {hours.open} - {hours.close}
                        </span>
                      ) : (
                        <span className="text-gray-400">No definido</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <Clock className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">Horarios no configurados</p>
                <Link
                  href={`/dashboard/locations/${location.id}/settings`}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Configurar horarios
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* AFIP Config */}
        <div className="card">
          <div className="border-b p-4">
            <h2 className="font-semibold text-gray-900">Configuración AFIP</h2>
          </div>
          <div className="p-4">
            {location.afipConfig ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Punto de venta</span>
                  <span className="font-mono font-medium">
                    {String(location.afipConfig.puntoDeVenta).padStart(4, '0')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CUIT</span>
                  <span className="font-mono">{location.afipConfig.cuit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Condición IVA</span>
                  <span>{location.afipConfig.condicionIva}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Estado</span>
                  {location.afipConfig.isActive ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Activo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-500">
                      <XCircle className="h-4 w-4" />
                      Inactivo
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <FileText className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">AFIP no configurado</p>
                <Link
                  href={`/dashboard/locations/${location.id}/settings`}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Configurar AFIP
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="border-b p-4">
            <h2 className="font-semibold text-gray-900">Acciones rápidas</h2>
          </div>
          <div className="p-4 space-y-2">
            <Link
              href={`/dashboard/locations/${location.id}/team`}
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-gray-50 transition-colors"
            >
              <Users className="h-5 w-5 text-primary-600" />
              <div>
                <p className="font-medium text-gray-900">Gestionar equipo</p>
                <p className="text-sm text-gray-500">Asignar técnicos a esta sucursal</p>
              </div>
            </Link>
            <Link
              href={`/dashboard/locations/${location.id}/zones`}
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-gray-50 transition-colors"
            >
              <Globe className="h-5 w-5 text-primary-600" />
              <div>
                <p className="font-medium text-gray-900">Editar zonas</p>
                <p className="text-sm text-gray-500">Definir áreas de cobertura</p>
              </div>
            </Link>
            <Link
              href={`/dashboard/jobs?locationId=${location.id}`}
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-gray-50 transition-colors"
            >
              <Briefcase className="h-5 w-5 text-primary-600" />
              <div>
                <p className="font-medium text-gray-900">Ver trabajos</p>
                <p className="text-sm text-gray-500">Trabajos de esta sucursal</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900">Eliminar sucursal</h3>
            <p className="mt-2 text-gray-500">
              ¿Estás seguro de que deseas eliminar la sucursal "{location.name}"? Esta acción no
              se puede deshacer.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="btn-primary bg-red-600 hover:bg-red-700"
                disabled={isDeleting}
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
