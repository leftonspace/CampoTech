'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  Package,
  Wrench,
  X,
  Save,
} from 'lucide-react';

interface PriceItem {
  id: string;
  name: string;
  description?: string;
  type: 'service' | 'product';
  price: number;
  unit?: string;
  taxRate?: number;
  isActive: boolean;
}

export default function PricebookPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceItem | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['pricebook'],
    queryFn: () => api.settings.pricebook.list(),
  });

  const items = (data?.data as PriceItem[]) || [];

  const filteredItems = items.filter((item) => {
    if (typeFilter && item.type !== typeFilter) return false;
    return true;
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<PriceItem>) => api.settings.pricebook.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricebook'] });
      setShowModal(false);
      setEditingItem(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PriceItem> }) =>
      api.settings.pricebook.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricebook'] });
      setShowModal(false);
      setEditingItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.settings.pricebook.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricebook'] });
    },
  });

  const handleOpenModal = (item?: PriceItem) => {
    setEditingItem(item || null);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este item?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/settings"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Lista de precios</h1>
          <p className="text-gray-500">Servicios y productos predefinidos</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo item
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">Filtrar por:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="">Todos</option>
            <option value="service">Servicios</option>
            <option value="product">Productos</option>
          </select>
        </div>
      </div>

      {/* Items grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4">
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-gray-200" />
              <div className="mt-4 h-6 w-1/3 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : filteredItems.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="card p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {item.type === 'service' ? (
                    <Wrench className="h-5 w-5 text-primary-500" />
                  ) : (
                    <Package className="h-5 w-5 text-secondary-500" />
                  )}
                  <span className="text-xs uppercase text-gray-500">
                    {item.type === 'service' ? 'Servicio' : 'Producto'}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleOpenModal(item)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <h3 className="mt-2 font-medium text-gray-900">{item.name}</h3>
              {item.description && (
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                  {item.description}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(item.price)}
                </span>
                {item.unit && (
                  <span className="text-sm text-gray-500">/ {item.unit}</span>
                )}
              </div>
              {item.taxRate !== undefined && item.taxRate > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  + {item.taxRate}% IVA
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">No hay items en la lista de precios</p>
          <button onClick={() => handleOpenModal()} className="btn-primary mt-4">
            <Plus className="mr-2 h-4 w-4" />
            Agregar item
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <PriceItemModal
          item={editingItem}
          onClose={() => {
            setShowModal(false);
            setEditingItem(null);
          }}
          onSave={(data) => {
            if (editingItem) {
              updateMutation.mutate({ id: editingItem.id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}

interface PriceItemModalProps {
  item: PriceItem | null;
  onClose: () => void;
  onSave: (data: Partial<PriceItem>) => void;
  isLoading: boolean;
}

function PriceItemModal({ item, onClose, onSave, isLoading }: PriceItemModalProps) {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    description: item?.description || '',
    type: item?.type || 'service',
    price: item?.price?.toString() || '',
    unit: item?.unit || '',
    taxRate: item?.taxRate?.toString() || '21',
    isActive: item?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type as 'service' | 'product',
      price: parseFloat(formData.price) || 0,
      unit: formData.unit || undefined,
      taxRate: parseFloat(formData.taxRate) || 0,
      isActive: formData.isActive,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-medium text-gray-900">
            {item ? 'Editar item' : 'Nuevo item'}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <div className="space-y-4">
            <div>
              <label className="label mb-1 block">Tipo</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="type"
                    value="service"
                    checked={formData.type === 'service'}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as 'service' | 'product' })
                    }
                    className="text-primary-600"
                  />
                  <Wrench className="h-4 w-4 text-primary-500" />
                  Servicio
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="type"
                    value="product"
                    checked={formData.type === 'product'}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as 'service' | 'product' })
                    }
                    className="text-primary-600"
                  />
                  <Package className="h-4 w-4 text-secondary-500" />
                  Producto
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="name" className="label mb-1 block">
                Nombre *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Instalación de aire acondicionado"
                className="input"
                required
                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el nombre del item')}
                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
              />
            </div>

            <div>
              <label htmlFor="description" className="label mb-1 block">
                Descripción
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descripción opcional..."
                rows={2}
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="price" className="label mb-1 block">
                  Precio *
                </label>
                <input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  placeholder="0.00"
                  className="input"
                  required
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el precio')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                />
              </div>
              <div>
                <label htmlFor="unit" className="label mb-1 block">
                  Unidad
                </label>
                <input
                  id="unit"
                  type="text"
                  value={formData.unit}
                  onChange={(e) =>
                    setFormData({ ...formData, unit: e.target.value })
                  }
                  placeholder="hora, unidad, m2..."
                  className="input"
                />
              </div>
            </div>

            <div>
              <label htmlFor="taxRate" className="label mb-1 block">
                Tasa IVA (%)
              </label>
              <select
                id="taxRate"
                value={formData.taxRate}
                onChange={(e) =>
                  setFormData({ ...formData, taxRate: e.target.value })
                }
                className="input"
              >
                <option value="0">0% - Exento</option>
                <option value="10.5">10.5%</option>
                <option value="21">21%</option>
                <option value="27">27%</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="rounded text-primary-600"
                />
                <span className="text-sm text-gray-700">Item activo</span>
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancelar
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary">
              <Save className="mr-2 h-4 w-4" />
              {isLoading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
