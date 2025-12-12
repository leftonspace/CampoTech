'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Truck,
  Calendar,
  Fuel,
  FileText,
  Gauge,
  Save,
} from 'lucide-react';

const FUEL_TYPES = [
  { value: 'GASOLINE', label: 'Nafta' },
  { value: 'DIESEL', label: 'Diesel' },
  { value: 'GNC', label: 'GNC' },
  { value: 'ELECTRIC', label: 'Electrico' },
  { value: 'HYBRID', label: 'Hibrido' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'MAINTENANCE', label: 'En Mantenimiento' },
  { value: 'INACTIVE', label: 'Inactivo' },
];

interface Vehicle {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  color: string | null;
  vin: string | null;
  status: string;
  fuelType: string;
  currentMileage: number | null;
  insuranceCompany: string | null;
  insurancePolicyNumber: string | null;
  insuranceExpiry: string | null;
  vtvExpiry: string | null;
  registrationExpiry: string | null;
  notes: string | null;
}

function formatDateForInput(dateString: string | null): string {
  if (!dateString) return '';
  return new Date(dateString).toISOString().split('T')[0];
}

export default function EditVehiclePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const vehicleId = params.id as string;

  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    plateNumber: '',
    make: '',
    model: '',
    year: new Date().getFullYear().toString(),
    vin: '',
    color: '',
    status: 'ACTIVE',
    fuelType: 'GASOLINE',
    currentMileage: '',
    insuranceCompany: '',
    insurancePolicyNumber: '',
    insuranceExpiry: '',
    vtvExpiry: '',
    registrationExpiry: '',
    notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: async () => {
      const res = await fetch(`/api/vehicles/${vehicleId}`);
      return res.json();
    },
  });

  // Populate form when data loads
  useEffect(() => {
    if (data?.data) {
      const v = data.data as Vehicle;
      setFormData({
        plateNumber: v.plateNumber || '',
        make: v.make || '',
        model: v.model || '',
        year: v.year?.toString() || new Date().getFullYear().toString(),
        vin: v.vin || '',
        color: v.color || '',
        status: v.status || 'ACTIVE',
        fuelType: v.fuelType || 'GASOLINE',
        currentMileage: v.currentMileage?.toString() || '',
        insuranceCompany: v.insuranceCompany || '',
        insurancePolicyNumber: v.insurancePolicyNumber || '',
        insuranceExpiry: formatDateForInput(v.insuranceExpiry),
        vtvExpiry: formatDateForInput(v.vtvExpiry),
        registrationExpiry: formatDateForInput(v.registrationExpiry),
        notes: v.notes || '',
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
        queryClient.invalidateQueries({ queryKey: ['vehicles'] });
        router.push(`/dashboard/fleet/${vehicleId}`);
      } else {
        setError(response.error || 'Error al actualizar');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.plateNumber || !formData.make || !formData.model || !formData.year) {
      setError('Completa todos los campos requeridos');
      return;
    }

    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/fleet/${vehicleId}`}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Vehiculo</h1>
          <p className="text-gray-500">{formData.plateNumber}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        {/* Basic Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Informacion Basica
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="plateNumber" className="label mb-1 block">
                Patente *
              </label>
              <input
                id="plateNumber"
                type="text"
                value={formData.plateNumber}
                onChange={(e) =>
                  setFormData({ ...formData, plateNumber: e.target.value.toUpperCase() })
                }
                placeholder="ABC 123"
                className="input uppercase"
                required
              />
            </div>
            <div>
              <label htmlFor="status" className="label mb-1 block">
                Estado
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="input"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="make" className="label mb-1 block">
                Marca *
              </label>
              <input
                id="make"
                type="text"
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                placeholder="Ej: Toyota, Ford, Fiat"
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="model" className="label mb-1 block">
                Modelo *
              </label>
              <input
                id="model"
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="Ej: Hilux, Ranger, Cronos"
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="year" className="label mb-1 block">
                Ano *
              </label>
              <input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                min="1900"
                max={new Date().getFullYear() + 1}
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="color" className="label mb-1 block">
                Color
              </label>
              <input
                id="color"
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="Ej: Blanco, Negro, Gris"
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="vin" className="label mb-1 block">
                VIN / Chasis
              </label>
              <input
                id="vin"
                type="text"
                value={formData.vin}
                onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                placeholder="17 caracteres"
                className="input uppercase font-mono"
                maxLength={17}
              />
            </div>
          </div>
        </div>

        {/* Technical Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Informacion Tecnica
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fuelType" className="label mb-1 block">
                Combustible
              </label>
              <div className="relative">
                <Fuel className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  id="fuelType"
                  value={formData.fuelType}
                  onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                  className="input pl-10"
                >
                  {FUEL_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="currentMileage" className="label mb-1 block">
                Kilometraje actual
              </label>
              <div className="relative">
                <Gauge className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="currentMileage"
                  type="number"
                  value={formData.currentMileage}
                  onChange={(e) =>
                    setFormData({ ...formData, currentMileage: e.target.value })
                  }
                  placeholder="Ej: 50000"
                  className="input pl-10"
                  min="0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Documents & Expiry */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentacion y Vencimientos
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="insuranceCompany" className="label mb-1 block">
                Compania de Seguro
              </label>
              <input
                id="insuranceCompany"
                type="text"
                value={formData.insuranceCompany}
                onChange={(e) =>
                  setFormData({ ...formData, insuranceCompany: e.target.value })
                }
                placeholder="Ej: La Caja, Zurich, Mapfre"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="insurancePolicyNumber" className="label mb-1 block">
                Numero de Poliza
              </label>
              <input
                id="insurancePolicyNumber"
                type="text"
                value={formData.insurancePolicyNumber}
                onChange={(e) =>
                  setFormData({ ...formData, insurancePolicyNumber: e.target.value })
                }
                placeholder="Numero de poliza"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="insuranceExpiry" className="label mb-1 block">
                Vencimiento Seguro
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="insuranceExpiry"
                  type="date"
                  value={formData.insuranceExpiry}
                  onChange={(e) =>
                    setFormData({ ...formData, insuranceExpiry: e.target.value })
                  }
                  className="input pl-10"
                />
              </div>
            </div>
            <div>
              <label htmlFor="vtvExpiry" className="label mb-1 block">
                Vencimiento VTV
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="vtvExpiry"
                  type="date"
                  value={formData.vtvExpiry}
                  onChange={(e) =>
                    setFormData({ ...formData, vtvExpiry: e.target.value })
                  }
                  className="input pl-10"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="registrationExpiry" className="label mb-1 block">
                Vencimiento Registro
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="registrationExpiry"
                  type="date"
                  value={formData.registrationExpiry}
                  onChange={(e) =>
                    setFormData({ ...formData, registrationExpiry: e.target.value })
                  }
                  className="input pl-10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="label mb-1 block">
            Notas adicionales
          </label>
          <textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Observaciones sobre el vehiculo..."
            rows={3}
            className="input"
          />
        </div>

        {error && <p className="text-sm text-danger-500">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Link href={`/dashboard/fleet/${vehicleId}`} className="btn-outline">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
