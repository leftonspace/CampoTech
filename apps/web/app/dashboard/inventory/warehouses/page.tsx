'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { cn, formatCurrency } from '@/lib/utils';
import {
  Plus,
  Warehouse,
  MapPin,
  Package,
  ChevronRight,
  Settings,
  X,
} from 'lucide-react';

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
}

const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  MAIN: 'Principal',
  BRANCH: 'Sucursal',
  VEHICLE: 'Vehículo',
  VIRTUAL: 'Virtual',
};

export default function WarehousesPage() {
  const [showNewModal, setShowNewModal] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['warehouses', { includeInactive }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (includeInactive) params.set('includeInactive', 'true');
      const res = await fetch(`/api/inventory/warehouses?${params}`);
      return res.json();
    },
  });

  const warehouses = data?.data?.warehouses as WarehouseData[] | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Almacenes</h1>
          <p className="text-gray-500">Gestiona ubicaciones de inventario</p>
        </div>
        <button onClick={() => setShowNewModal(true)} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo almacén
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-600">Mostrar inactivos</span>
        </label>
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
                      warehouse.type === 'BRANCH' && 'bg-green-100 text-green-600',
                      warehouse.type === 'VEHICLE' && 'bg-purple-100 text-purple-600',
                      warehouse.type === 'VIRTUAL' && 'bg-gray-100 text-gray-600'
                    )}
                  >
                    <Warehouse className="h-6 w-6" />
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
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>

              {warehouse.address && (
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
          <Warehouse className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-500">No hay almacenes configurados</p>
          <button
            onClick={() => setShowNewModal(true)}
            className="btn-primary mt-4 inline-flex"
          >
            <Plus className="mr-2 h-4 w-4" />
            Crear almacén
          </button>
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
    type: 'BRANCH',
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
          <h2 className="text-lg font-semibold">Nuevo almacén</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input mt-1 w-full"
              placeholder="Almacén central"
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
              placeholder="WH-001"
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
              <option value="BRANCH">Sucursal</option>
              <option value="VEHICLE">Vehículo</option>
              <option value="VIRTUAL">Virtual</option>
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
