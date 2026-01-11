'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Truck,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { VehicleCard } from '@/components/fleet/VehicleCard';
import { VehicleDetailModal } from '@/components/fleet/VehicleDetailModal';

interface VehicleAssignment {
  id: string;
  isPrimaryDriver: boolean;
  user: {
    id: string;
    name: string;
    avatar: string | null;
    phone: string;
  };
}

interface Vehicle {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  color: string | null;
  status: string;
  fuelType: string;
  currentMileage: number | null;
  insuranceExpiry: string | null;
  vtvExpiry: string | null;
  registrationExpiry: string | null;
  assignments: VehicleAssignment[];
  complianceAlerts: string[];
  isCompliant: boolean;
  _count: {
    documents: number;
    maintenanceLogs: number;
  };
}

interface FleetResponse {
  success: boolean;
  data: {
    vehicles: Vehicle[];
    stats: {
      total: number;
      active: number;
      maintenance: number;
      inactive: number;
      withAlerts: number;
    };
  };
}

async function fetchVehicles(search?: string, status?: string): Promise<FleetResponse> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const res = await fetch(`/api/vehicles?${params.toString()}`);
  if (!res.ok) throw new Error('Error cargando vehículos');
  return res.json();
}

export default function FleetPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [showAlerts, setShowAlerts] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['vehicles', search, statusFilter],
    queryFn: () => fetchVehicles(search, statusFilter),
    staleTime: 30000,
  });

  const vehicles = data?.data?.vehicles || [];
  const stats = data?.data?.stats || {
    total: 0,
    active: 0,
    maintenance: 0,
    inactive: 0,
    withAlerts: 0,
  };

  const filteredVehicles = showAlerts
    ? vehicles.filter((v) => v.complianceAlerts.length > 0)
    : vehicles;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flota de Vehículos</h1>
          <p className="text-sm text-gray-500">
            Gestión de vehículos y cumplimiento normativo
          </p>
        </div>
        <Link
          href="/dashboard/fleet/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Agregar Vehículo
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-500">Total</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-sm text-gray-500">Activos</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-amber-500" />
            <span className="text-sm text-gray-500">Mantenimiento</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-600">{stats.maintenance}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-500">Inactivos</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-600">{stats.inactive}</p>
        </div>
        <button
          onClick={() => setShowAlerts(!showAlerts)}
          className={`rounded-lg p-4 shadow-sm text-left transition-colors ${showAlerts ? 'bg-red-50 ring-2 ring-red-500' : 'bg-white'
            }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-sm text-gray-500">Con Alertas</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-red-600">{stats.withAlerts}</p>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por patente, marca o modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter || ''}
            onChange={(e) => setStatusFilter(e.target.value || undefined)}
            className="rounded-lg border border-gray-300 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="MAINTENANCE">En mantenimiento</option>
            <option value="INACTIVE">Inactivos</option>
          </select>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Vehicles Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Cargando vehículos...</span>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-red-600">Error cargando vehículos</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm text-primary-600 hover:underline"
          >
            Reintentar
          </button>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <Truck className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {showAlerts ? 'No hay vehículos con alertas' : 'No hay vehículos'}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {showAlerts
              ? 'Todos los vehículos están en cumplimiento'
              : 'Agrega tu primer vehículo para comenzar'}
          </p>
          {!showAlerts && (
            <Link
              href="/dashboard/fleet/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              Agregar Vehículo
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              onClick={() => setSelectedVehicleId(vehicle.id)}
            />
          ))}
        </div>
      )}

      {/* Vehicle Detail Modal */}
      <VehicleDetailModal
        vehicleId={selectedVehicleId}
        onClose={() => setSelectedVehicleId(null)}
        onEdit={(vehicleId) => {
          setSelectedVehicleId(null);
          window.location.href = `/dashboard/fleet/${vehicleId}/edit`;
        }}
        onRefresh={() => refetch()}
      />
    </div>
  );
}
