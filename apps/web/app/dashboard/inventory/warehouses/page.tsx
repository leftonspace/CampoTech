'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { cn, formatCurrency } from '@/lib/utils';
import {
  Plus,
  MapPin,
  Package,
  ChevronRight,
  X,
  Building2,
  Truck,
  RefreshCw,
} from 'lucide-react';

interface VehicleInfo {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  status: string;
}

interface WarehouseData {
  id: string;
  name: string;
  code: string;
  type: string;
  address?: string;
  city?: string;
  isDefault: boolean;
  isActive: boolean;
  productCount?: number;
  stockValue?: number;
  vehicle?: VehicleInfo | null;
  vehicleId?: string | null;
}

const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  MAIN: 'Principal',
  SECONDARY: 'Secundario',
  TRANSIT: 'En tránsito',
  VEHICLE: 'Vehículo',
};

type TabType = 'all' | 'office' | 'vehicle';

export default function WarehousesPage() {
  const queryClient = useQueryClient();
  const [showNewModal, setShowNewModal] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['warehouses', { includeInactive }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (includeInactive) params.set('includeInactive', 'true');
      const res = await fetch(`/api/inventory/warehouses?${params}`);
      return res.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/inventory/sync-vehicle-storage', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Error syncing');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });

  const allWarehouses = data?.data?.warehouses as WarehouseData[] | undefined;

  // Filter warehouses based on active tab
  const warehouses = allWarehouses?.filter((w) => {
    if (activeTab === 'office') return w.type !== 'VEHICLE';
    if (activeTab === 'vehicle') return w.type === 'VEHICLE';
    return true;
  });

  const officeCount = allWarehouses?.filter((w) => w.type !== 'VEHICLE').length || 0;
  const vehicleCount = allWarehouses?.filter((w) => w.type === 'VEHICLE').length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Almacenes</h1>
          <p className="text-gray-500">Gestiona ubicaciones de inventario (depósitos y vehículos)</p>
        </div>
        <button onClick={() => setShowNewModal(true)} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo depósito
        </button>
      </div>

      {/* Tabs */}
      <div className="card p-1">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'all'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            Todos ({allWarehouses?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('office')}
            className={cn(
              'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2',
              activeTab === 'office'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Building2 className="h-4 w-4" />
            Depósitos ({officeCount})
          </button>
          <button
            onClick={() => setActiveTab('vehicle')}
            className={cn(
              'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2',
              activeTab === 'vehicle'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Truck className="h-4 w-4" />
            Vehículos ({vehicleCount})
          </button>
        </div>
      </div>

      {/* Filters and sync button */}
      <div className="card p-4 flex items-center justify-between">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-600">Mostrar inactivos</span>
        </label>

        {activeTab === 'vehicle' && vehicleCount === 0 && (
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="btn-outline text-sm"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', syncMutation.isPending && 'animate-spin')} />
            {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar vehículos de flota'}
          </button>
        )}
      </div>

      {/* Warehouses grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 animate-pulse rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-1/2 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : warehouses?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((warehouse) => (
            <Link
              key={warehouse.id}
              href={`/dashboard/inventory/warehouses/${warehouse.id}`}
              className={cn(
                'card p-6 transition-colors hover:bg-gray-50',
                !warehouse.isActive && 'opacity-60'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-lg',
                      warehouse.type === 'MAIN' && 'bg-blue-100 text-blue-600',
                      warehouse.type === 'SECONDARY' && 'bg-green-100 text-green-600',
                      warehouse.type === 'VEHICLE' && 'bg-purple-100 text-purple-600',
                      warehouse.type === 'TRANSIT' && 'bg-yellow-100 text-yellow-600'
                    )}
                  >
                    {warehouse.type === 'VEHICLE' ? (
                      <Truck className="h-6 w-6" />
                    ) : (
                      <Building2 className="h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{warehouse.name}</h3>
                      {warehouse.isDefault && (
                        <span className="rounded bg-primary-100 px-1.5 py-0.5 text-xs font-medium text-primary-700">
                          Principal
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {WAREHOUSE_TYPE_LABELS[warehouse.type]} • {warehouse.code}
                    </p>
                    {warehouse.vehicle && (
                      <p className="text-xs text-purple-600 mt-1">
                        {warehouse.vehicle.make} {warehouse.vehicle.model}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>

              {warehouse.address && warehouse.type !== 'VEHICLE' && (
                <div className="mt-4 flex items-start gap-2 text-sm text-gray-500">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="line-clamp-2">
                    {warehouse.address}
                    {warehouse.city && `, ${warehouse.city}`}
                  </span>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Package className="h-4 w-4" />
                  <span>{warehouse.productCount ?? 0} productos</span>
                </div>
                {warehouse.stockValue !== undefined && (
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(warehouse.stockValue)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          {activeTab === 'vehicle' ? (
            <>
              <Truck className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500">No hay vehículos con almacén configurado</p>
              <p className="mt-2 text-sm text-gray-400">
                Los almacenes de vehículos se crean automáticamente al agregar vehículos en Flota.
              </p>
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="btn-outline mt-4 inline-flex"
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', syncMutation.isPending && 'animate-spin')} />
                {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar vehículos existentes'}
              </button>
            </>
          ) : (
            <>
              <Building2 className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500">No hay depósitos configurados</p>
              <button
                onClick={() => setShowNewModal(true)}
                className="btn-primary mt-4 inline-flex"
              >
                <Plus className="mr-2 h-4 w-4" />
                Crear depósito
              </button>
            </>
          )}
        </div>
      )}

      {/* New warehouse modal */}
      {showNewModal && (
        <NewWarehouseModal onClose={() => setShowNewModal(false)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW WAREHOUSE MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function NewWarehouseModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'MAIN',
    address: '',
    city: '',
    state: '',
    isDefault: false,
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/inventory/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Error creating warehouse');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nuevo depósito</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-1 text-sm text-gray-500">
          Los almacenes de vehículos se crean automáticamente al agregar vehículos en Flota.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input mt-1 w-full"
              placeholder="Depósito central"
              onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el nombre del depósito')}
              onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Código</label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="input mt-1 w-full"
              placeholder="DEP-001"
              onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el código del depósito')}
              onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="input mt-1 w-full"
            >
              <option value="MAIN">Principal</option>
              <option value="SECONDARY">Secundario</option>
              <option value="TRANSIT">En tránsito</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Dirección</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input mt-1 w-full"
              placeholder="Av. Principal 123"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Ciudad</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="input mt-1 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Provincia</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="input mt-1 w-full"
              />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Establecer como almacén principal</span>
          </label>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary"
            >
              {mutation.isPending ? 'Creando...' : 'Crear almacén'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
