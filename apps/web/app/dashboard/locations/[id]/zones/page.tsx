'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Globe,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Save,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface Zone {
  id: string;
  code: string;
  name: string;
  description?: string;
  priority: number;
  isActive: boolean;
  coverageArea?: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  color?: string;
}

const ZONE_COLORS = [
  { value: '#3B82F6', label: 'Azul' },
  { value: '#10B981', label: 'Verde' },
  { value: '#F59E0B', label: 'Amarillo' },
  { value: '#EF4444', label: 'Rojo' },
  { value: '#8B5CF6', label: 'Violeta' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#6B7280', label: 'Gris' },
];

async function fetchZones(locationId: string): Promise<{ success: boolean; data: Zone[] }> {
  const response = await fetch(`/api/locations/${locationId}/zones`);
  return response.json();
}

async function createZone(locationId: string, data: Partial<Zone>) {
  const response = await fetch(`/api/locations/${locationId}/zones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

async function updateZone(zoneId: string, data: Partial<Zone>) {
  const response = await fetch(`/api/zones/${zoneId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

async function deleteZone(zoneId: string) {
  const response = await fetch(`/api/zones/${zoneId}`, { method: 'DELETE' });
  return response.json();
}

export default function LocationZonesPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    priority: 1,
    isActive: true,
    color: '#3B82F6',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['location-zones', params.id],
    queryFn: () => fetchZones(params.id as string),
    enabled: !!params.id,
  });

  const zones = data?.data || [];

  const handleEdit = (zone: Zone) => {
    setEditingZone(zone);
    setFormData({
      code: zone.code,
      name: zone.name,
      description: zone.description || '',
      priority: zone.priority,
      isActive: zone.isActive,
      color: zone.color || '#3B82F6',
    });
    setShowForm(true);
  };

  const handleDelete = async (zoneId: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta zona?')) {
      const result = await deleteZone(zoneId);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['location-zones', params.id] });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      let result;
      if (editingZone) {
        result = await updateZone(editingZone.id, formData);
      } else {
        result = await createZone(params.id as string, formData);
      }

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['location-zones', params.id] });
        setShowForm(false);
        setEditingZone(null);
        setFormData({
          code: '',
          name: '',
          description: '',
          priority: zones.length + 1,
          isActive: true,
          color: '#3B82F6',
        });
      } else {
        setError(result.error || 'Error al guardar');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingZone(null);
    setError(null);
  };

  const movePriority = async (zone: Zone, direction: 'up' | 'down') => {
    const newPriority = direction === 'up' ? zone.priority - 1 : zone.priority + 1;
    if (newPriority < 1) return;

    await updateZone(zone.id, { priority: newPriority });
    queryClient.invalidateQueries({ queryKey: ['location-zones', params.id] });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="card p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/locations/${params.id}`}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Zonas de cobertura</h1>
            <p className="text-gray-500">Define las áreas de servicio</p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setFormData({
                code: '',
                name: '',
                description: '',
                priority: zones.length + 1,
                isActive: true,
                color: '#3B82F6',
              });
              setShowForm(true);
            }}
            className="btn-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva zona
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="card">
          <div className="border-b p-4">
            <h2 className="font-semibold text-gray-900">
              {editingZone ? 'Editar zona' : 'Nueva zona'}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-red-600 text-sm">{error}</div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="input mt-1"
                  placeholder="ZONA-001"
                  required
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el código de la zona')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  className="input mt-1"
                  placeholder="Zona Centro"
                  required
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el nombre de la zona')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Descripción</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                className="input mt-1"
                rows={2}
                placeholder="Descripción opcional de la zona..."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Prioridad</label>
                <input
                  type="number"
                  min="1"
                  value={formData.priority}
                  onChange={(e) => setFormData((p) => ({ ...p, priority: parseInt(e.target.value) }))}
                  className="input mt-1"
                />
                <p className="mt-1 text-xs text-gray-500">1 = mayor prioridad</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Color</label>
                <select
                  value={formData.color}
                  onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                  className="input mt-1"
                >
                  {ZONE_COLORS.map((color) => (
                    <option key={color.value} value={color.value}>
                      {color.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  />
                  <span className="text-sm text-gray-700">Zona activa</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={handleCancel} className="btn-secondary">
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Guardando...' : 'Guardar zona'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Zones list */}
      <div className="card">
        {zones.length ? (
          <div className="divide-y">
            {zones
              .sort((a, b) => a.priority - b.priority)
              .map((zone, index) => (
                <div key={zone.id} className="flex items-center gap-4 p-4">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => movePriority(zone, 'up')}
                      disabled={index === 0}
                      className={cn(
                        'rounded p-1',
                        index === 0 ? 'text-gray-300' : 'text-gray-400 hover:bg-gray-100'
                      )}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => movePriority(zone, 'down')}
                      disabled={index === zones.length - 1}
                      className={cn(
                        'rounded p-1',
                        index === zones.length - 1
                          ? 'text-gray-300'
                          : 'text-gray-400 hover:bg-gray-100'
                      )}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: zone.color || '#3B82F6' }}
                  >
                    <Globe className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-gray-900">{zone.name}</p>
                      <span className="font-mono text-sm text-gray-500">{zone.code}</span>
                      {!zone.isActive && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          Inactiva
                        </span>
                      )}
                    </div>
                    {zone.description && (
                      <p className="text-sm text-gray-500 truncate">{zone.description}</p>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">#{zone.priority}</p>
                    <p className="text-xs text-gray-500">Prioridad</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(zone)}
                      className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(zone.id)}
                      className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Globe className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">No hay zonas definidas</p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary mt-4"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear zona
            </button>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="card p-4 bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-blue-900">Sobre las zonas</p>
            <p className="text-sm text-blue-700">
              Las zonas permiten organizar las áreas de servicio de cada sucursal. La prioridad
              determina qué zona se asigna cuando un cliente está en múltiples zonas. Puedes
              definir polígonos de cobertura desde el editor de mapas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
