'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Warehouse,
  Calendar,
  User,
  Package,
} from 'lucide-react';

interface WarehouseOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  name: string;
}

const COUNT_TYPES = [
  { value: 'FULL', label: 'Conteo completo', description: 'Todos los productos del almacén' },
  { value: 'CYCLE', label: 'Conteo cíclico', description: 'Selección rotativa de productos' },
  { value: 'SPOT', label: 'Conteo puntual', description: 'Productos específicos' },
  { value: 'ANNUAL', label: 'Conteo anual', description: 'Auditoría anual completa' },
];

export default function NewInventoryCountPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    warehouseId: '',
    countType: 'FULL',
    scheduledAt: '',
    assignedToId: '',
    notes: '',
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/warehouses');
      return res.json();
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      return res.json();
    },
  });

  const warehouses = warehousesData?.data?.warehouses as WarehouseOption[] | undefined;
  const users = usersData?.data as UserOption[] | undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.warehouseId) {
      setError('Seleccioná un almacén');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createCount',
          warehouseId: formData.warehouseId,
          countType: formData.countType,
          scheduledAt: formData.scheduledAt || undefined,
          assignedToId: formData.assignedToId || undefined,
          notes: formData.notes || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/dashboard/inventory/stock/counts/${data.data.count.id}`);
      } else {
        setError(data.error || 'Error al crear el conteo');
      }
    } catch (err) {
      setError('Error de conexión');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/inventory/stock"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo conteo de inventario</h1>
          <p className="text-gray-500">Crear una nueva sesión de conteo</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        {/* Warehouse */}
        <div>
          <label className="label mb-1 block">Almacén *</label>
          <div className="relative">
            <Warehouse className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={formData.warehouseId}
              onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
              className="input pl-10"
              required
              onInvalid={(e) => (e.target as HTMLSelectElement).setCustomValidity('Por favor, seleccioná un almacén')}
              onInput={(e) => (e.target as HTMLSelectElement).setCustomValidity('')}
            >
              <option value="">Seleccionar almacén</option>
              {warehouses?.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Count Type */}
        <div>
          <label className="label mb-2 block">Tipo de conteo *</label>
          <div className="grid gap-3 sm:grid-cols-2">
            {COUNT_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData({ ...formData, countType: type.value })}
                className={`rounded-lg border-2 p-4 text-left transition-colors ${
                  formData.countType === type.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-gray-900">{type.label}</p>
                <p className="text-sm text-gray-500">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Schedule */}
        <div>
          <label className="label mb-1 block">Fecha programada</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="datetime-local"
              value={formData.scheduledAt}
              onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
              className="input pl-10"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Dejar vacío para iniciar inmediatamente
          </p>
        </div>

        {/* Assigned to */}
        <div>
          <label className="label mb-1 block">Asignar a</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={formData.assignedToId}
              onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
              className="input pl-10"
            >
              <option value="">Sin asignar</option>
              {users?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label mb-1 block">Notas</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Instrucciones o notas adicionales..."
            rows={3}
            className="input"
          />
        </div>

        {error && <p className="text-sm text-danger-500">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Link href="/dashboard/inventory/stock" className="btn-outline">
            Cancelar
          </Link>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            <FileText className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Creando...' : 'Crear conteo'}
          </button>
        </div>
      </form>
    </div>
  );
}
