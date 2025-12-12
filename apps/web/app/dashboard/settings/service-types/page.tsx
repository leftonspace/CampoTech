'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Wrench,
  Save,
  X,
} from 'lucide-react';

interface ServiceType {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  isActive: boolean;
  sortOrder: number;
}

export default function ServiceTypesSettingsPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServiceType, setNewServiceType] = useState({ code: '', name: '', description: '' });
  const [error, setError] = useState('');

  // Fetch service types
  const { data, isLoading } = useQuery({
    queryKey: ['service-types'],
    queryFn: async () => {
      const res = await fetch('/api/settings/service-types');
      return res.json();
    },
  });

  const serviceTypes = data?.data as ServiceType[] | undefined;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { code: string; name: string; description?: string }) => {
      const res = await fetch('/api/settings/service-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['service-types'] });
        setShowAddForm(false);
        setNewServiceType({ code: '', name: '', description: '' });
        setError('');
      } else {
        setError(response.error || 'Error al crear');
      }
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ServiceType> }) => {
      const res = await fetch(`/api/settings/service-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['service-types'] });
        setEditingId(null);
        setError('');
      } else {
        setError(response.error || 'Error al actualizar');
      }
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/service-types/${id}`, {
        method: 'DELETE',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-types'] });
    },
  });

  const handleStartEdit = (st: ServiceType) => {
    setEditingId(st.id);
    setEditForm({ name: st.name, description: st.description || '' });
  };

  const handleSaveEdit = (id: string) => {
    updateMutation.mutate({
      id,
      data: {
        name: editForm.name,
        description: editForm.description || null,
      },
    });
  };

  const handleCreate = () => {
    if (!newServiceType.code || !newServiceType.name) {
      setError('Código y nombre son requeridos');
      return;
    }
    createMutation.mutate(newServiceType);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`¿Eliminar "${name}"? Los trabajos existentes mantendrán este tipo.`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/settings"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Tipos de servicio</h1>
          <p className="text-gray-500">Configura los servicios que ofrece tu empresa</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Agregar
        </button>
      </div>

      {/* Notice about migration */}
      {data?._notice && (
        <div className="rounded-lg bg-warning-50 border border-warning-200 p-4">
          <p className="text-sm text-warning-800">
            <strong>Nota:</strong> La personalización de tipos de servicio requiere actualizar la base de datos.
            Por ahora, puedes usar los tipos predeterminados.
          </p>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="card p-4">
          <h3 className="font-medium text-gray-900 mb-4">Nuevo tipo de servicio</h3>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label mb-1 block">Código *</label>
                <input
                  type="text"
                  value={newServiceType.code}
                  onChange={(e) => setNewServiceType({ ...newServiceType, code: e.target.value.toUpperCase() })}
                  placeholder="LIMPIEZA_CONDUCTO"
                  className="input font-mono uppercase"
                />
                <p className="mt-1 text-xs text-gray-500">Identificador único (sin espacios)</p>
              </div>
              <div>
                <label className="label mb-1 block">Nombre *</label>
                <input
                  type="text"
                  value={newServiceType.name}
                  onChange={(e) => setNewServiceType({ ...newServiceType, name: e.target.value })}
                  placeholder="Limpieza de conducto"
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="label mb-1 block">Descripción (opcional)</label>
              <input
                type="text"
                value={newServiceType.description}
                onChange={(e) => setNewServiceType({ ...newServiceType, description: e.target.value })}
                placeholder="Descripción del servicio..."
                className="input"
              />
            </div>
            {error && <p className="text-sm text-danger-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewServiceType({ code: '', name: '', description: '' });
                  setError('');
                }}
                className="btn-outline"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service types list */}
      <div className="card divide-y">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : !serviceTypes?.length ? (
          <div className="p-8 text-center text-gray-500">
            No hay tipos de servicio configurados
          </div>
        ) : (
          serviceTypes.map((st) => (
            <div
              key={st.id}
              className="flex items-center gap-4 p-4 hover:bg-gray-50"
            >
              <GripVertical className="h-5 w-5 text-gray-300 cursor-grab" />

              <div className="rounded-lg bg-primary-100 p-2">
                <Wrench className="h-5 w-5 text-primary-600" />
              </div>

              {editingId === st.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="input flex-1"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(st.id)}
                    disabled={updateMutation.isPending}
                    className="p-2 text-success-600 hover:bg-success-50 rounded-md"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-md"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{st.name}</div>
                    <div className="text-sm text-gray-500 font-mono">{st.code}</div>
                    {st.description && (
                      <div className="text-sm text-gray-400 mt-1">{st.description}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(st)}
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-md"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(st.id, st.name)}
                      className="p-2 text-danger-500 hover:bg-danger-50 rounded-md"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Help text */}
      <div className="text-sm text-gray-500 space-y-2">
        <p>
          <strong>Código:</strong> Identificador interno usado en la base de datos.
          No se puede cambiar después de crear.
        </p>
        <p>
          <strong>Nombre:</strong> Lo que verán los usuarios al crear un trabajo.
        </p>
      </div>
    </div>
  );
}
