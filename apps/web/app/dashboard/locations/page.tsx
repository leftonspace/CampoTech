'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { cn, formatAddress } from '@/lib/utils';
import {
  Plus,
  Search,
  ChevronRight,
  MapPin,
  Users,
  Building2,
  Phone,
  Globe,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface Location {
  id: string;
  code: string;
  name: string;
  type: string;
  isHeadquarters: boolean;
  isActive: boolean;
  address?: string;
  phone?: string;
  coordinates?: { lat: number; lng: number };
  _count?: {
    technicians: number;
    zones: number;
    jobs: number;
  };
}

async function fetchLocations(search: string): Promise<{ success: boolean; data: Location[] }> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);

  const response = await fetch(`/api/locations?${params.toString()}`);
  return response.json();
}

export default function LocationsPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['locations', { search }],
    queryFn: () => fetchLocations(search),
  });

  const locations = data?.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zonas de Servicio</h1>
          <p className="text-gray-500">Gestiona las zonas de cobertura y técnicos asignados</p>
        </div>
        <Link href="/dashboard/locations/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nueva zona
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
              <MapPin className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total zonas</p>
              <p className="text-xl font-bold">{locations?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Técnicos asignados</p>
              <p className="text-xl font-bold">
                {locations?.reduce((sum, l) => sum + (l._count?.technicians || 0), 0) || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Zonas activas</p>
              <p className="text-xl font-bold">
                {locations?.filter((l) => l.isActive).length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar zona..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Locations list */}
      <div className="card">
        {isLoading ? (
          <div className="divide-y">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="h-12 w-12 animate-pulse rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : locations?.length ? (
          <div className="divide-y">
            {locations.map((location) => (
              <Link
                key={location.id}
                href={`/dashboard/locations/${location.id}`}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-gray-50"
              >
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-lg font-medium',
                    location.isHeadquarters
                      ? 'bg-primary-100 text-primary-600'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {location.isHeadquarters ? (
                    <Building2 className="h-6 w-6" />
                  ) : (
                    <MapPin className="h-6 w-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-gray-900">{location.name}</p>
                    {location.isHeadquarters && (
                      <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                        Principal
                      </span>
                    )}
                    {!location.isActive && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Inactiva
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="font-mono">{location.code}</span>
                    {location.address && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {formatAddress(location.address)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="hidden items-center gap-6 text-sm text-gray-500 md:flex">
                  <div className="text-center">
                    <p className="font-medium text-gray-900">{location._count?.technicians || 0}</p>
                    <p className="text-xs">Técnicos</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-900">{location._count?.zones || 0}</p>
                    <p className="text-xs">Zonas</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <MapPin className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">No se encontraron zonas</p>
            <Link href="/dashboard/locations/new" className="btn-primary mt-4 inline-flex">
              <Plus className="mr-2 h-4 w-4" />
              Crear zona
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
