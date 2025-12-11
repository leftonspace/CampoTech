'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Truck,
  AlertTriangle,
  CheckCircle,
  Settings,
  ArrowRight,
} from 'lucide-react';

interface FleetResponse {
  success: boolean;
  data: {
    vehicles: Array<{
      id: string;
      plateNumber: string;
      make: string;
      model: string;
      status: string;
      complianceAlerts: string[];
      isCompliant: boolean;
    }>;
    stats: {
      total: number;
      active: number;
      maintenance: number;
      inactive: number;
      withAlerts: number;
    };
  };
}

async function fetchFleetStatus(): Promise<FleetResponse> {
  const res = await fetch('/api/vehicles');
  if (!res.ok) throw new Error('Error cargando flota');
  return res.json();
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  MAINTENANCE: 'bg-amber-100 text-amber-700',
  INACTIVE: 'bg-gray-100 text-gray-700',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Activo',
  MAINTENANCE: 'Mantenimiento',
  INACTIVE: 'Inactivo',
};

export function FleetStatus() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-fleet-status'],
    queryFn: fetchFleetStatus,
    staleTime: 60000,
  });

  const vehicles = data?.data?.vehicles || [];
  const stats = data?.data?.stats || { total: 0, active: 0, maintenance: 0, inactive: 0, withAlerts: 0 };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 flex-1 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-10 w-10 rounded-lg bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-gray-200" />
              <div className="h-3 w-3/4 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Truck className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">Error cargando flota</p>
      </div>
    );
  }

  if (stats.total === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Truck className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">No hay vehículos registrados</p>
        <Link
          href="/dashboard/fleet/new"
          className="mt-3 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
        >
          Agregar vehículo
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  // Get vehicles with alerts
  const vehiclesWithAlerts = vehicles.filter((v) => !v.isCompliant);

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-green-50 p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-lg font-bold text-green-700">{stats.active}</span>
          </div>
          <p className="text-xs text-green-600">Activos</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <Settings className="h-4 w-4 text-amber-600" />
            <span className="text-lg font-bold text-amber-700">{stats.maintenance}</span>
          </div>
          <p className="text-xs text-amber-600">Mant.</p>
        </div>
        <div className="rounded-lg bg-red-50 p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-lg font-bold text-red-700">{stats.withAlerts}</span>
          </div>
          <p className="text-xs text-red-600">Alertas</p>
        </div>
      </div>

      {/* Vehicles with alerts */}
      {vehiclesWithAlerts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Requieren atención
          </p>
          <ul className="space-y-2">
            {vehiclesWithAlerts.slice(0, 3).map((vehicle) => (
              <li key={vehicle.id}>
                <Link
                  href={`/dashboard/fleet/${vehicle.id}`}
                  className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 transition-colors hover:bg-red-100"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100">
                    <Truck className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{vehicle.plateNumber}</p>
                    <p className="truncate text-xs text-red-600">
                      {vehicle.complianceAlerts.slice(0, 2).join(' • ')}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[vehicle.status]}`}>
                    {statusLabels[vehicle.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-sm text-green-700">Toda la flota está en cumplimiento</p>
        </div>
      )}

      {/* View all link */}
      <Link
        href="/dashboard/fleet"
        className="flex items-center justify-center gap-1 text-sm text-primary-600 hover:underline"
      >
        Ver flota completa
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
