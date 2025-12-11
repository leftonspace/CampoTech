'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  Users,
  Navigation,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Truck,
  X,
} from 'lucide-react';
import { LiveTechnicianMap, TechnicianLocation } from '@/components/maps/LiveTechnicianMap';
import { TechnicianPanel } from '@/components/maps/TechnicianPanel';

interface LocationsResponse {
  success: boolean;
  data: {
    technicians: TechnicianLocation[];
    stats: {
      total: number;
      online: number;
      enRoute: number;
      working: number;
      available: number;
    };
    updatedAt: string;
  };
}

async function fetchTechnicianLocations(): Promise<LocationsResponse> {
  const res = await fetch('/api/tracking/locations?onlineOnly=false');
  if (!res.ok) throw new Error('Error cargando ubicaciones');
  return res.json();
}

export default function LiveMapPage() {
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianLocation | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['technician-locations'],
    queryFn: fetchTechnicianLocations,
    refetchInterval: autoRefresh ? 15000 : false, // Refresh every 15 seconds
    staleTime: 10000,
  });

  const handleTechnicianSelect = useCallback((tech: TechnicianLocation) => {
    setSelectedTechnician(tech);
    setShowPanel(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setShowPanel(false);
    setSelectedTechnician(null);
  }, []);

  const stats = data?.data?.stats || {
    total: 0,
    online: 0,
    enRoute: 0,
    working: 0,
    available: 0,
  };

  const technicians = data?.data?.technicians || [];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mapa en Vivo</h1>
          <p className="text-sm text-gray-500">
            Seguimiento en tiempo real de técnicos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              autoRefresh
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-actualización' : 'Pausado'}
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-500">Total</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-gray-500">En línea</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-green-600">{stats.online}</p>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-gray-500">En camino</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-blue-600">{stats.enRoute}</p>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-amber-500" />
            <span className="text-sm text-gray-500">Trabajando</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-600">{stats.working}</p>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-emerald-500" />
            <span className="text-sm text-gray-500">Disponibles</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.available}</p>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative flex-1 overflow-hidden rounded-lg bg-white shadow-sm">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary-600" />
              <p className="mt-2 text-sm text-gray-500">Cargando mapa...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
              <p className="mt-2 text-sm text-gray-500">Error cargando ubicaciones</p>
              <button
                onClick={() => refetch()}
                className="mt-2 text-sm text-primary-600 hover:underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : (
          <>
            <LiveTechnicianMap
              technicians={technicians}
              selectedTechnician={selectedTechnician}
              onTechnicianSelect={handleTechnicianSelect}
            />

            {/* Side Panel */}
            {showPanel && selectedTechnician && (
              <div className="absolute right-0 top-0 h-full w-full sm:w-96">
                <TechnicianPanel
                  technician={selectedTechnician}
                  onClose={handleClosePanel}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span>En línea</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span>En camino</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-amber-500" />
          <span>Trabajando</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-gray-400" />
          <span>Sin conexión</span>
        </div>
        {data?.data?.updatedAt && (
          <span className="ml-auto">
            Última actualización: {new Date(data.data.updatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
