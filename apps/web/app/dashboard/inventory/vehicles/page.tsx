'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { cn, formatCurrency, searchMatchesAny } from '@/lib/utils';
import {
  Search,
  Truck,
  Package,
  User,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

interface VehicleStock {
  id: string;
  vehicleId: string;
  vehicleName: string;
  technicianId: string;
  technicianName: string;
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  lastReplenishedAt?: string;
}

interface VehicleStockItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  minLevel: number;
  maxLevel: number;
  status: 'OK' | 'LOW' | 'OUT' | 'OVERSTOCK';
}

interface ReplenishmentRequest {
  id: string;
  vehicleName: string;
  technicianName: string;
  status: string;
  itemCount: number;
  requestedAt: string;
}

export default function VehicleInventoryPage() {
  const [search, setSearch] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  const { data: vehiclesData, isLoading } = useQuery({
    queryKey: ['vehicle-stocks'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/vehicle-stock?view=summary');
      return res.json();
    },
  });

  const { data: detailData } = useQuery({
    queryKey: ['vehicle-stock-detail', selectedVehicle],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/vehicle-stock?technicianId=${selectedVehicle}`);
      return res.json();
    },
    enabled: !!selectedVehicle,
  });

  const { data: requestsData } = useQuery({
    queryKey: ['replenishment-requests'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/vehicle-stock?view=requests');
      return res.json();
    },
  });

  const vehicles = vehiclesData?.data?.vehicles as VehicleStock[] | undefined;
  const stockItems = detailData?.data?.items as VehicleStockItem[] | undefined;
  const requests = requestsData?.data?.requests as ReplenishmentRequest[] | undefined;

  const filteredVehicles = vehicles?.filter((v) =>
    searchMatchesAny([v.vehicleName, v.technicianName], search)
  );

  const pendingRequests = requests?.filter((r) => r.status === 'PENDING') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario de vehículos</h1>
          <p className="text-gray-500">Stock asignado a técnicos</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2 text-blue-600">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Vehículos</p>
              <p className="text-xl font-bold text-gray-900">{vehicles?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2 text-green-600">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Valor total</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(vehicles?.reduce((sum, v) => sum + v.totalValue, 0) || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-yellow-100 p-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Con stock bajo</p>
              <p className="text-xl font-bold text-gray-900">
                {vehicles?.filter((v) => v.lowStockCount > 0).length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2 text-purple-600">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Reposiciones pendientes</p>
              <p className="text-xl font-bold text-gray-900">{pendingRequests.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Vehicle list */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar vehículo o técnico..."
              className="input pl-10 w-full"
            />
          </div>

          <div className="card divide-y">
            {isLoading ? (
              <div className="p-4">
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded bg-gray-200" />
                  ))}
                </div>
              </div>
            ) : filteredVehicles?.length ? (
              filteredVehicles.map((vehicle) => (
                <button
                  key={vehicle.technicianId}
                  onClick={() => setSelectedVehicle(vehicle.technicianId)}
                  className={cn(
                    'flex w-full items-center gap-4 p-4 text-left transition-colors',
                    selectedVehicle === vehicle.technicianId
                      ? 'bg-primary-50'
                      : 'hover:bg-gray-50'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full',
                      vehicle.lowStockCount > 0
                        ? 'bg-yellow-100 text-yellow-600'
                        : 'bg-green-100 text-green-600'
                    )}
                  >
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{vehicle.vehicleName}</p>
                    <p className="text-sm text-gray-500">{vehicle.technicianName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {vehicle.totalProducts} items
                    </p>
                    {vehicle.lowStockCount > 0 && (
                      <p className="text-xs text-yellow-600">
                        {vehicle.lowStockCount} bajo
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </button>
              ))
            ) : (
              <div className="p-8 text-center">
                <Truck className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-500">No hay vehículos con stock</p>
              </div>
            )}
          </div>
        </div>

        {/* Vehicle detail */}
        <div className="lg:col-span-2">
          {selectedVehicle ? (
            <div className="space-y-6">
              {/* Selected vehicle info */}
              <div className="card p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                      <Truck className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        {vehicles?.find((v) => v.technicianId === selectedVehicle)?.vehicleName}
                      </h2>
                      <p className="text-gray-500">
                        {vehicles?.find((v) => v.technicianId === selectedVehicle)?.technicianName}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/inventory/stock/adjust?technicianId=${selectedVehicle}`}
                    className="btn-outline"
                  >
                    Ajustar stock
                  </Link>
                </div>
              </div>

              {/* Stock items */}
              <div className="card">
                <div className="border-b px-6 py-4">
                  <h3 className="font-medium text-gray-900">Inventario del vehículo</h3>
                </div>
                {stockItems?.length ? (
                  <div className="divide-y">
                    {stockItems.map((item) => (
                      <div
                        key={item.productId}
                        className="flex items-center gap-4 p-4"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                          <Package className="h-5 w-5 text-gray-500" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          <p className="text-sm text-gray-500">{item.productSku}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{item.quantity}</p>
                          <p className="text-xs text-gray-500">
                            Mín: {item.minLevel} / Máx: {item.maxLevel}
                          </p>
                        </div>
                        <div className="w-20">
                          {item.status === 'OUT' ? (
                            <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                              Sin stock
                            </span>
                          ) : item.status === 'LOW' ? (
                            <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                              Bajo
                            </span>
                          ) : item.status === 'OVERSTOCK' ? (
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                              Exceso
                            </span>
                          ) : (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                              OK
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-4 text-gray-500">Sin items en el vehículo</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Truck className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500">
                Seleccioná un vehículo para ver su inventario
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pending replenishment requests */}
      {pendingRequests.length > 0 && (
        <div className="card">
          <div className="border-b px-6 py-4">
            <h2 className="font-medium text-gray-900">Solicitudes de reposición pendientes</h2>
          </div>
          <div className="divide-y">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                    <RefreshCw className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{request.vehicleName}</p>
                    <p className="text-sm text-gray-500">
                      {request.technicianName} • {request.itemCount} items
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    {new Date(request.requestedAt).toLocaleDateString()}
                  </span>
                  <Link
                    href={`/dashboard/inventory/vehicle-stock/requests/${request.id}`}
                    className="btn-outline text-sm"
                  >
                    Ver solicitud
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
